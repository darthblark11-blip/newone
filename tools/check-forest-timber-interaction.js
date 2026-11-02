// Solid timber must match its visible heading, share the native damage/drop
// loop, and stay gone in every published/resident/generated view after salvage.
const assert = require('assert');
const { ctx, probe } = require('./harness');
const P = code => probe('(' + code + ')');
let checks = 0;
const ok = (value, label) => { checks++; assert(value, label); };
let saved = null;
ctx.localStorage = { getItem:()=>saved, setItem:(key,value)=>{saved=value;}, removeItem:()=>{saved=null;} };
probe(`authoredCore=authoredMask=authoredChunks=null;biomeState={};
  currentBiome=currentLevel=2;BIOME_ACTIVE=true;enemiesList=[];forestWildlife.length=0;
  activeParkingCars=[];barrels=[];buildings=[];activeBuildings=[];
  viewLeft=viewTop=-1000;viewRight=viewBottom=1000;frameCount=100;
  __walker={eType:'NORMAL',ignoreBldgTimer:0,isCityCivilian:false};
  function timberFixture(species,scale,angle){
    const d={t:species,forestSpecies:species,forestRegion:'TIMBER',forestHabitat:'TIMBER',
      forestLiveProp:true,x:300,y:300,s:scale,r:angle,c:.41};
    const ch={solid:[],decor:[d],decorBake:[],cars:[]};
    appendForestTimberSolids(2,0,0,ch);__d=d;__wood=ch.solid[0];
    activeBuildings=buildings=[__wood];invalidateColIndex();buildColIndex();return __wood;
  }
  function timberWorld(x,y){return {x:__wood.x+x*__wood.forestTimberCos-y*__wood.forestTimberSin,
    y:__wood.y+x*__wood.forestTimberSin+y*__wood.forestTimberCos};}
`);
for (const species of ['LOG','STUMP']) for (const scale of [.8,1.4,2]) for (const angle of [.2,.8,1.6,2.5]) {
  probe(`timberFixture('${species}',${scale},${angle});`);
  ok(P('Character.prototype.checkCol.call(__walker,__wood.x,__wood.y)'), species+' centre must stop an actor');
  probe('__outside=timberWorld(0,__wood.forestTimberDepth*.5+15.1);__inside=timberWorld(0,__wood.forestTimberDepth*.5+14.9);');
  ok(!P('Character.prototype.checkCol.call(__walker,__outside.x,__outside.y)') &&
    P('Character.prototype.checkCol.call(__walker,__inside.x,__inside.y)'), species+' collision follows the rotated visible side');
  ok(P(`(function(){const a=timberWorld(0,-100),b=timberWorld(0,100);
    const ray={prevX:a.x,prevY:a.y,x:b.x,y:b.y,tH:'BODY',shooter:null};
    return coverBulletBlock(ray).solid===__wood&&forestShotCover(ray,[],[]).kind==='SOLID';})()`),
    species+' thin footprint catches a swept native projectile');
}
probe("timberFixture('LOG',2,Math.PI/4);__corner={x:__wood.x+__wood.w*.5-.1,y:__wood.y-__wood.h*.5+.1};");
ok(!P('forestTimberPointBlocked(__wood,__corner.x,__corner.y)'), 'empty diagonal AABB corners must not become solid');
ok(P('forestTimberSegmentTime(__wood,__corner.x-.01,__corner.y,__corner.x+.01,__corner.y)===Infinity'),
  'rounds through empty diagonal AABB corners must not damage timber');
ok(P('coverSolidKind(__wood)===null&&hasLOS(0,300,600,300)'), 'low timber must not become a fake high cover wall');

// Exercise the actual projectile update, not only the shape helper. The round
// crosses the whole narrow log in one tick, so endpoint-only collision fails.
probe(`timberFixture('LOG',1.4,.8);player=new Character(800,800,true);enemiesList=[];forestWildlife.length=0;
  bullets=[];doTick=true;__start=timberWorld(0,-100);__end=timberWorld(0,100);
  __hp=harvestProfile(__wood).hp;
  __round=spawnBullet(__start.x,__start.y,Math.atan2(__end.y-__start.y,__end.x-__start.x),true,'BODY',WEAPONS.ASSAULT_RIFLE,player);
  __round.vx=__end.x-__start.x;__round.vy=__end.y-__start.y;updateBullets();`);
ok(P('!__round.active&&harvestProfile(__wood).hp<__hp'), 'native fast gunfire must stop and damage the wood');

function stage(species) {
  ctx.__species = species;
  probe(`authoredCore=authoredMask=authoredChunks=null;authoredSolids=[];authoredCars=[];
    biomeState={};currentBiome=currentLevel=2;BIOME_ACTIVE=true;
    buildings=[];activeBuildings=[];activeParkingCars=[];parkingCars=[];barrels=[];forestWildlife.length=0;
    playerStructures=[];buildSites=[];resourceDrops=[];particles=[];_standDecor=[];
    window.resources={WOOD:0,METAL:0,STONE:0};
    frameCount=100;lastActiveUpdate=0;viewLeft=viewTop=-100000;viewRight=viewBottom=100000;
    __fixtureCoord=null;
    for(let cx=-8;cx<=8&&!__fixtureCoord;cx++)for(let cy=-8;cy<=8;cy++){
      if(generateChunkContent(2,cx,cy).solid.some(b=>b.isForestTimber&&b.forestSpecies===window.__species)){
        __fixtureCoord={cx,cy};break;
      }
    }
    if(!__fixtureCoord)throw Error('No generated '+window.__species+' population');
    chunkMgr=new ChunkManager(2);chunkMgr.anchors=[];
    for(let cx=__fixtureCoord.cx-1;cx<=__fixtureCoord.cx+1;cx++)
      for(let cy=__fixtureCoord.cy-1;cy<=__fixtureCoord.cy+1;cy++)chunkMgr.adopt(cx,cy);
    chunkMgr.rebuildWorldArrays();chunkMgr.dirty=false;
    __wood=__ch=__d=null;
    (function(){const all=activeBuildings;
      for(const ch of chunkMgr.chunks.values())for(const b of ch.solid){
        if(!b.isForestTimber||b.forestSpecies!==window.__species)continue;
        __wood=b;__ch=ch;__d=ch.decor.find(d=>d.forestSolidKey===b.chunkKey);return;
      }})();
    if(!__wood||!__d)throw Error('No generated '+window.__species+' fixture');
    __key=__wood.chunkKey;__cx=__ch.cx;__cy=__ch.cy;__worth=harvestProfile(__wood).yield;
    __alias={...__wood,__hv:{...harvestProfile(__wood)}};_standDecor.push(__d);
    player=new Character(__wood.x,__wood.y,true);player.flags={};`);
}
function absent(label) {
  ok(P(`!buildings.some(b=>b.chunkKey===__key)&&!activeBuildings.some(b=>b.chunkKey===__key)&&
    !Array.from(chunkMgr.chunks.values()).some(ch=>ch.solid.some(b=>b.chunkKey===__key)||
      ch.decor.some(d=>d.forestSolidKey===__key))&&
    !_standDecor.some(d=>d.forestSolidKey===__key)&&getBiomeState(2).destroyed[__key]===true`), label);
}
for (const species of ['LOG','STUMP']) {
  stage(species);
  ok(P('Character.prototype.checkCol.call(__walker,__wood.x,__wood.y)'), species+' generated body collides');
  probe('while(harvestProfile(__wood).hp>0)damageHarvestable(__wood,HARVEST_SWING.PICKAXE);');
  absent(species+' harvest removes body, collider and queued drawing immediately');
  ok(P('resourceDrops.reduce((n,d)=>n+d.qty,0)===__worth'), species+' yields exactly its wood inventory value');
  probe('damageHarvestable(__alias,10000);chunkMgr.rebuildWorldArrays();chunkMgr.dirty=false;');
  absent(species+' cannot reappear through an adjacent chunk rebuild');
  ok(P('resourceDrops.reduce((n,d)=>n+d.qty,0)===__worth'), species+' stale aliases cannot duplicate the yield');
  probe('chunkMgr.chunks.delete(__cx+","+__cy);chunkMgr.adopt(__cx,__cy);chunkMgr.rebuildWorldArrays();chunkMgr.dirty=false;');
  absent(species+' stays gone when its owner regenerates');
  probe('doTick=true;for(let f=0;f<100;f++){frameCount++;updateResourceDrops();}');
  ok(P('resourceCount("WOOD")===__worth&&resourceDrops.length===0'), species+' pickup enters the existing WOOD inventory');
  probe('isStoryMode=false;started=true;saveGame();window.resources.WOOD=0;biomeState={};loadGame();');
  ok(P('resourceCount("WOOD")===__worth&&getBiomeState(2).destroyed[__key]===true'), species+' inventory and removal survive save/load');
  ok(P('!generateChunkContent(2,__cx,__cy).solid.some(b=>b.chunkKey===__key)&&!generateChunkContent(2,__cx,__cy).decor.some(d=>d.forestSolidKey===__key)'),
    species+' saved removal strips both generated representations');
  stage(species);
  probe('__won=clearBuildLot(__wood.x,__wood.y,0,0);');
  absent(species+' build clearing removes the same body and collider');
  ok(P('__won.WOOD===__worth&&resourceCount("WOOD")===__worth&&resourceDrops.length===0'), species+' build clearing banks wood exactly once');
  probe('damageHarvestable(__alias,10000);clearBuildLot(__wood.x,__wood.y,0,0);');
  ok(P('resourceCount("WOOD")===__worth&&resourceDrops.length===0'), species+' cleared stale references cannot add a second payout');
  stage(species);
  probe('player.x=__wood.x+1000;player.y=__wood.y+1000;triggerExplosion(__wood.x,__wood.y,80,false,true,player);');
  absent(species+' player blast follows the same timber removal lifecycle');
  ok(P('resourceDrops.filter(d=>d.kind==="WOOD").reduce((n,d)=>n+d.qty,0)>=__worth'), species+' blast salvage drops wood');
}
console.log(`Forest timber interaction passed: ${checks} oriented collision, native bullet, salvage, inventory, build clearing, blast and reload checks.`);

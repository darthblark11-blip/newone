// Real pooled projectiles, actual floor-bank painting, and bounded trail state.
const assert=require('assert'),{ctx,mkG,probe}=require('./harness');
const P=s=>probe('('+s+')'),run=s=>probe(s);
let checks=0;
const check=(source,label)=>{assert(P(source),label);checks++;};
ctx.setTimeout=()=>0;
ctx.createGraphics=(w,h)=>{
  const g=mkG();g.width=w;g.height=h;g.marks=[];g.ink=null;
  g.fill=(...v)=>{g.ink=v[0]&&v[0].levels?[...v[0].levels]:v;};
  g.ellipse=(x,y,w,h=w)=>g.marks.push({x,y,w,h,col:[...g.ink]});
  g.clear=()=>{g.marks=[];};
  g.image=(src,x,y)=>g.marks.push(...src.marks.map(p=>({...p,x:p.x+x,y:p.y+y})));
  return g;
};
run(`window.floorMarks=function(){return Object.entries(bloodChunks).flatMap(([key,e])=>{
  const xy=key.split(',').map(Number);return e.pg.marks.map(p=>({...p,key,
    x:p.x+e.bx+xy[0]*CHUNK_SIZE,y:p.y+e.by+xy[1]*CHUNK_SIZE}));});};`);
function reset(type='NORMAL',isPlayer=false){
  run(`currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=isPaused=isDead=isWin=killcamMode=false;inTownCutscene=inFortCutscene=false;
    inStoryIntro=inDarchonCall=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=false;
    inOverworldView=inTravelMenu=inWorldBuildingMenu=false;
    enemiesList=[];bullets=[];particles=[];corpses=[];barrels=[];activeBuildings=[];
    activeParkingCars=[];parkingCars=[];resetForestWildlife();resetShovelState();invalidateColIndex();
    wipeAllBloodBanks();useBloodBank('test');frameCount++;deltaTime=250;
    player=new Character(-2000,-2000,true);player.hp=100000;player.shield=100;
    window.victim=new Character(200,200,${isPlayer},'${type}');victim.hp=1000;victim.maxHp=1000;victim.aimAngle=0;
    ${isPlayer?'player=victim;':'enemiesList=[victim];'}
    viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
    nm0AmbushActive=false;window.milLvl=0;`);
}
function shoot(weapon='PISTOL',head='BODY'){
  run(`window.round=spawnBullet(160,200,0,${P('!victim.isPlayer')},'${head}',WEAPONS.${weapon},
    {x:0,y:200,isPlayer:${P('!victim.isPlayer')},isFriendly:false});
    for(let i=0;i<10&&round.active;i++)updateBullets();`);
}
for(const type of ['NORMAL','FEMALE_PISTOL','SIA','MOLOTOV','NM0_ROOKIE','NM0_ROOKIE_F','FARMER_MALE','COWBOY','ARMORED_STANDARD','ARMORED']){
  reset(type);shoot();
  check(`victim.hp<1000&&floorMarks().length===3&&bloodPools.length===0`,type+' gets exactly three small floor drops');
  check(`floorMarks().every(p=>p.col.join(',')==='111,9,16,255'&&p.w>=3&&p.w<8&&!p.key.endsWith(',B'))`,type+' uses the animal color, size and floor layer');
  check(`!victim.arrowBloodTrail`,type+' gun impacts do not start arrow trails');
}
for(const type of ['ROBOT','SAUCER','SAUCER_RED','BUG','SNAIL','SNAIL_HYBRID','ALIEN_GATOR','COW','HORSE']){
  reset(type);shoot('BOW');
  check(`floorMarks().filter(p=>p.col.join(',')==='111,9,16,255').length===0&&!victim.arrowBloodTrail`,type+' does not receive human red blood');
}
for(const type of ['ARMORED','ARMORED_STANDARD']){
  reset(type);shoot('BOW','HEAD');
  check(`victim.hp<1000&&floorMarks().length===0&&!victim.arrowBloodTrail`,type+' helmet impacts keep their hard-material effect');
}
reset('NORMAL',true);run('victim.shield=100;');shoot('BOW');
check(`victim.hp===1000&&victim.shield<100&&floorMarks().length===0&&!victim.arrowBloodTrail`,
  'A shield-only hit does not bleed');
reset('NORMAL',true);run('victim.shield=1;');shoot('BOW');
check(`victim.hp<1000&&floorMarks().length===3&&victim.arrowBloodTrail`,
  'Shield-break overflow that reaches HP does bleed');
reset('NORMAL',true);run('victim.shield=0;inTownCutscene=true;');shoot('BOW');
check(`victim.hp===1000&&floorMarks().length===0&&!victim.arrowBloodTrail`,
  'Cutscene immunity does not leave false blood');

reset();shoot('BOW');
check(`victim.arrowBloodTrail&&victim.arrowBloodTrail.leftMs===60000&&floorMarks().length===3`,
  'A real arrow starts one bounded trail alongside its impact droplets');
run('window.originalFloor=JSON.stringify(floorMarks());window.originalMarks=floorMarks();victim.x+=100;victim.aimAngle=Math.PI/2;frameCount++;updateArrowBloodTrail(victim,250);');
check(`floorMarks().length===4&&floorMarks().slice(0,3).every((p,i)=>JSON.stringify(p)===JSON.stringify(originalMarks[i]))`,
  'Moving an arrow victim leaves old ground marks fixed and deposits one new drop');
check(`floorMarks()[3].x>280&&floorMarks()[3].w>=2.5&&floorMarks()[3].w<5&&victim.arrowBloodTrail.leftMs===59750`,
  'A quarter-second drop follows the body-local wound at a compact size');
const before=P('floorMarks().length');
run('frameCount++;updateArrowBloodTrail(victim,10000);');
check(`floorMarks().length===${before+1}`,'A delayed frame deposits one drop rather than a catch-up burst');
check('victim.hp===1000-WEAPONS.BOW.bodyDmg','Human trails are visual and do not introduce automatic human bleed-out damage');
for(const flag of ['isPaused','inTravelMenu','inWorldBuildingMenu','inTownCutscene','inFortCutscene','inDarchonCall','killcamMode']){
  reset();shoot('BOW');run(`${flag}=true;frameCount++;updateArrowBloodTrail(victim,10000);${flag}=false;`);
  check('victim.arrowBloodTrail.leftMs===60000&&floorMarks().length===3',flag+' freezes trails');
}
reset();shoot('BOW');run('frameCount++;updateArrowBloodTrail(victim,60000);');
check('victim.arrowBloodTrail===null&&victim.hp>0','Human cosmetic bleeding ends after one active minute');
for(const stop of ['victim.dead=true','victim.hp=0',"victim.state='STUNNED'",'currentLevel=3',"useBloodBank('elsewhere')"]){
  reset();shoot('BOW');run(stop+';frameCount++;updateArrowBloodTrail(victim,250);');
  check('victim.arrowBloodTrail===null','Death, stun and travel release trail state: '+stop);
}
reset('NORMAL',true);run('victim.shield=0;');shoot('BOW');
run('victim.shield=100;frameCount++;updateArrowBloodTrail(victim,250);');
check('!!victim.arrowBloodTrail','Armor regeneration does not stop an HP wound trail');
run('victim.restoreHealth(1);');
check('!victim.arrowBloodTrail','Restoring actual HP closes a human arrow wound');
reset();shoot('BOW');run('frameCount++;updateEntities();');
check('victim.arrowBloodTrail.leftMs===59750&&floorMarks().length===4',
  'The existing army update advances a human trail exactly once');

// Visual caps never roll gameplay random numbers or queue an unbounded backlog.
reset();
run(`window.visualOldRandom=random;window.visualSeed=serializeForestWildlife().seed;
  random=()=>{throw Error('Blood used gameplay RNG');};
  for(let i=0;i<100;i++)stampImpactBlood(200,200,0,30,100+i);
  window.trailActors=[];for(let i=0;i<24;i++){
    const actor={x:200,y:200,hp:100,aimAngle:0,bodyW:21,bodyH:27};
    startArrowBloodTrail(actor,{shotId:i},{x:200,y:200});trailActors.push(actor);
  }
  window.dropCounts=[];for(let f=0;f<3;f++){
    frameCount++;let n=floorMarks().length;
    for(const actor of trailActors)updateArrowBloodTrail(actor,f?16:250);
    dropCounts.push(floorMarks().length-n);
  }random=visualOldRandom;`);
check('floorMarks().length===24*3+24&&dropCounts.every(n=>n===8)',
  'Impact and drip work is capped, while deferred actors get their turn');
check('trailActors.every(a=>a.arrowBloodTrail.untilDropMs>0)&&serializeForestWildlife().seed===visualSeed',
  'All 24 simultaneous wounds receive droplets without consuming combat/ecology RNG');

// Pit marks reuse the established floor/depth depositor, never the surface bank.
reset();
run(`victim.shovelLevel=currentLevel;victim.shovelDepth=18;victim.shovelDepthTarget=240;
  stampImpactBlood(victim.x,victim.y,0,20,124,victim);window.pitMark=shovelBloodMarks[0];
  victim.shovelDepth=140;updateBloodPools();`);
check('Object.keys(bloodChunks).length===0&&shovelEffectDepth(pitMark)===140',
  'Small pit impacts recede with a falling victim instead of staining the surface');
run('victim.shovelDepth=240;updateBloodPools();victim.shovelDepth=0;victim.shovelDepthTarget=0;victim.x+=100;updateBloodPools();');
check('shovelEffectDepth(pitMark)===240&&pitMark.x===200&&pitMark.y===200&&pitMark.shovelOwner===null',
  'Settled pit drops remain on their own floor when the victim moves or climbs out');
console.log(`${checks}/${checks} human impact and arrow trail checks passed.`);

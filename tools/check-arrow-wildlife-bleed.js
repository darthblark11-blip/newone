// Actual projectile anatomy and active-gameplay timing for arrow vital wounds.
const assert = require('assert');
const { probe } = require('./harness');
let checks = 0;
const run = code => probe(code);
function check(code, message) { assert.ok(run(code), message); checks++; }
run(`currentBiome=currentLevel=2;BIOME_ACTIVE=true;isStoryMode=false;
  player={x:14700,y:6600,hp:300};doTick=true;
  isPaused=isDead=isWin=killcamMode=inCutscene=inStoryIntro=false;
  inOverworldView=inTravelMenu=inDarchonCall=inTownCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inWorldBuildingMenu=false;
  viewLeft=14000;viewRight=16000;viewTop=6000;viewBottom=7200;
  activeBuildings=[];authoredMask=null;authoredCore=null;chunkMgr=null;colGrid=null;
  function bleedAnimal(id='ELK',angle=0) {
    resetForestWildlife();var a=wildlifeSpawnAnimal(id,15000,6600),s=WILDLIFE_SPECIES[id];
    a.bodyR=s.size;a.headR=s.headR;a.angle=angle;
    a.sensorAt=a.thinkAt=1e12;a.goalX=a.x;a.goalY=a.y;
    _wildlifeSpawnClock=1e12;return a;
  }
  function bleedSegment(a,x0,y0,x1,y1,arrow=true,mode='BODY') {
    var c=Math.cos(a.angle),s=Math.sin(a.angle);
    return forestWildlifeHitTest({prevX:a.x+c*x0-s*y0,prevY:a.y+s*x0+c*y0,
      x:a.x+c*x1-s*y1,y:a.y+s*x1+c*y1,isArrow:arrow,tH:mode});
  }
  function bleedHit(a,extra={}) {
    return applyForestWildlifeHit(a,Object.assign({weapon:'BOW',head:false,vital:true,
      damage:1,arrowPower:1,arrowDud:false,shotId:'vital-1',owner:player},extra));
  }
  var qaBleed;
`);
for (const id of ['ELK','GRIZZLY_BEAR','GRAY_WOLF','MOUNTAIN_LION','MOOSE','BEAVER','BALD_EAGLE','TIMBER_RATTLESNAKE']) {
  for(let heading=0;heading<8;heading++) {
    run(`qaBleed=bleedAnimal('${id}',${heading}*Math.PI/4);
      var shape=_WILDLIFE_SHOT_BODY[WILDLIFE_SPECIES[qaBleed.species].family],r=qaBleed.bodyR;
      var chestX=r*shape[0]*.24,bodyX=r*shape[0]+1,bodyY=r*shape[1]+1;
      var entryY=-bodyY*Math.sqrt(1-chestX*chestX/(bodyX*bodyX));`);
    check(`var h=bleedSegment(qaBleed,chestX,entryY-2,chestX,entryY+.01);
      h&&!h.head&&h.vital`, id+' tiny surface-entry step reaches interior chest at heading '+heading);
    check(`var h=bleedSegment(qaBleed,chestX,-200,chestX,200,true,'HEAD');
      h&&!h.head&&h.vital`, id+' long equivalent path has same vital classification in HEAD mode '+heading);
    check(`var h=bleedSegment(qaBleed,-r*shape[0]*.75,-200,-r*shape[0]*.75,200);
      h&&!h.head&&!h.vital`, id+' rump-only trajectory avoids chest at heading '+heading);
    check(`var h=bleedSegment(qaBleed,-200,r*shape[1]*.90,200,r*shape[1]*.90);
      h&&!h.head&&!h.vital`, id+' torso graze stays nonvital at heading '+heading);
  }
}
run(`qaBleed=bleedAnimal();`);
for(let angle=0;angle<16;angle++) {
  const theta=angle*Math.PI/8;
  check(`var cx=qaBleed.bodyR*.24,h=bleedSegment(qaBleed,
    cx+Math.cos(${theta})*200,Math.sin(${theta})*200,cx,0);
    h&&(h.head?!h.vital:h.vital)`, 'Oblique chest path respects first head/body anatomy at bearing '+angle);
}
check(`var h=bleedSegment(qaBleed,200,0,-200,0);h.head&&!h.vital`, 'First exposed head remains a headshot rather than a vital torso hit');
check(`var h=bleedSegment(qaBleed,0,-200,0,200,false);h&&!h.head&&!h.vital`, 'Ordinary rounds avoid extra vital-path work');
check(`!wildlifeVitalPath(qaBleed,qaBleed.x,qaBleed.y,qaBleed.x,qaBleed.y,0)`, 'Zero-length arrow paths cannot invent chest penetration');
run(`qaBleed=bleedAnimal();bleedHit(qaBleed);var qaBleedSeed=serializeForestWildlife().seed;
  updateForestWildlife(1,59999);`);
check(`!qaBleed.dead&&qaBleed.hp>0&&qaBleed.arrowVitalBleed.remainingMs===1`, 'Vital animal is alive after 59.999 active seconds');
run(`updateForestWildlife(1,1);`);
check(`qaBleed.dead&&qaBleed.hp===0&&qaBleed.arrowVitalBleed===null`, 'Vital animal bleeds out at exactly sixty active seconds');
check(`qaBleed.state==='DEAD'&&qaBleed.fall&&qaBleed.deathType==='BODY_COLLAPSE'&&qaBleed.ttl===18000`, 'Bleed-out uses the ordinary directional corpse lifecycle');
check(`qaBleed.shots===1&&qaBleed.headshots===0&&qaBleed.method==='BOW'&&qaBleed.condition==='FAIR'`, 'Bleed ticks never count as synthetic shots or award a perfect body specimen');
check(`serializeForestWildlife().seed===qaBleedSeed`, 'Bleed timing and death consume no ecology RNG');
check(`!Array.from(_wildlifeGrid.values()).some(cell=>cell.includes(qaBleed))`, 'Bleed-out leaves the live collision/projectile grid immediately');
run(`player.x=qaBleed.x;player.y=qaBleed.y;var qaBleedLoot=wildlifeHarvest(qaBleed);updateForestWildlife(1,16);`);
check(`qaBleedLoot&&qaBleedLoot.method==='BOW'&&qaBleedLoot.condition==='FAIR'&&qaBleedLoot.state==='DEAD'&&forestWildlife.length===0`, 'A bleed-out corpse is harvestable once and releases its runtime state');
run(`qaBleed=bleedAnimal();bleedHit(qaBleed);updateForestWildlife(1,30000);
  var qaBeforeRepeat=qaBleed.arrowVitalBleed.remainingMs;
  bleedHit(qaBleed,{shotId:'vital-2'});`);
check(`qaBleed.arrowVitalBleed.remainingMs===qaBeforeRepeat&&qaBleed.shots===2`, 'A repeated vital hit cannot extend the original deadline');
run(`updateForestWildlife(1,30000);`);
check(`qaBleed.dead&&qaBleed.condition==='FAIR'&&qaBleed.shots===2`, 'Repeated arrows preserve real shot counts at bleed-out');
run(`qaBleed=bleedAnimal('GRIZZLY_BEAR');for(let i=0;i<4;i++)bleedHit(qaBleed,{shotId:'ruined-'+i});
  updateForestWildlife(1,60000);`);
check(`qaBleed.dead&&qaBleed.shots===4&&qaBleed.condition==='BAD'`, 'Four-arrow bleed-out retains scraps quality');
for(const extra of ['vital:false','arrowDud:true','arrowPower:.54','damage:0','head:true,arrowPower:.2']) {
  run(`qaBleed=bleedAnimal('GRIZZLY_BEAR');bleedHit(qaBleed,{${extra}});var qaHp=qaBleed.hp;
    updateForestWildlife(1,60000);`);
  check(`!qaBleed.dead&&qaBleed.hp===qaHp&&qaBleed.arrowVitalBleed===null`, extra+' cannot cause mortal chest bleed');
}
run(`qaBleed=bleedAnimal('GRIZZLY_BEAR');bleedHit(qaBleed,{head:true,arrowPower:.55});`);
check(`qaBleed.dead&&qaBleed.condition==='PERFECT'&&qaBleed.method==='BOW_HEAD'&&qaBleed.arrowVitalBleed===null`, 'Powered clean arrow headshots still kill immediately in perfect condition');
run(`qaBleed=bleedAnimal();bleedHit(qaBleed);`);
for(const flag of ['isPaused','isDead','isWin','killcamMode','inCutscene','inStoryIntro','inOverworldView','inTravelMenu','inDarchonCall','inTownCutscene','inFarmCutscene','inFarmPostCutscene','inPostAmbushCutscene','inFortCutscene','inWorldBuildingMenu']) {
  run(`${flag}=true;var qaHp=qaBleed.hp;updateForestWildlife(1,120000);${flag}=false;`);
  check(`qaBleed.hp===qaHp&&qaBleed.arrowVitalBleed.remainingMs===60000`, flag+' freezes mortal bleeding');
}
run(`doTick=false;updateForestWildlife(1,120000);doTick=true;`);
check(`qaBleed.arrowVitalBleed.remainingMs===60000&&!qaBleed.dead`, 'Frozen simulation does not age bleeding');
run(`qaBleed=bleedAnimal();bleedHit(qaBleed);deltaTime=250;
  for(let i=0;i<239;i++)updateForestWildlife();`);
check(`!qaBleed.dead&&qaBleed.arrowVitalBleed.remainingMs===250`, 'A four-FPS render cadence does not stretch the sixty-second deadline');
run(`updateForestWildlife();`);
check(`qaBleed.dead`, 'Low-FPS vital bleed still completes after sixty real active seconds');
run(`qaBleed=bleedAnimal();bleedHit(qaBleed);deltaTime=60000;updateForestWildlife();`);
check(`qaBleed.dead`, 'An unusually long active frame ages the deadline without movement-step clamping');
run(`qaBleed=bleedAnimal();bleedHit(qaBleed);qaBleed.x+=10000;
  _wildlifeGridDirty=true;updateForestWildlife(1,59999);`);
check(`forestWildlife.includes(qaBleed)&&!qaBleed.dead&&qaBleed.arrowVitalBleed.remainingMs===1`, 'Fleeing beyond ordinary off-screen culling cannot delete a tracked mortal wound');
run(`updateForestWildlife(1,1);updateForestWildlife(1,16);`);
check(`forestWildlife.includes(qaBleed)&&qaBleed.dead&&qaBleed.fall.progress>0`, 'A far vital corpse finishes its directional fall before cleanup');
run(`for(let i=0;i<60;i++)updateForestWildlife(1,16);`);
check(`forestWildlife.includes(qaBleed)&&qaBleed.fall.progress===1&&qaBleed.ttl>0`, 'A settled far arrow prey remains available through its ordinary corpse lifetime');
check(`qaBleed.arrowBleedTracked===true&&!Object.hasOwn(serializeForestWildlife(),'arrowBleedTracked')`, 'Tracking remains bounded ephemeral actor state outside save data');
run(`qaBleed.ttl=1;updateForestWildlife(1,16);`);
check(`!forestWildlife.includes(qaBleed)`, 'The normal corpse TTL releases tracked far prey');
run(`qaBleed=bleedAnimal();bleedHit(qaBleed);updateForestWildlife(1,1000);
  applyForestWildlifeHit(qaBleed,{weapon:'TASER',damage:0});updateForestWildlife(1,120000);`);
check(`!qaBleed.dead&&qaBleed.state==='STUNNED'&&qaBleed.arrowVitalBleed===null&&qaBleed.condition==='PERFECT'`, 'Nonlethal taser collection stops the mortal wound and keeps its existing reward');
run(`qaBleed=bleedAnimal();bleedHit(qaBleed);var qaWound=qaBleed.arrowVitalBleed;
  currentBiome=1;updateForestWildlife(1,100);`);
check(`forestWildlife.length===0`, 'Leaving the forest releases wounded actors rather than retaining timers');
console.log(checks+'/'+checks+' arrow wildlife bleed checks passed.');

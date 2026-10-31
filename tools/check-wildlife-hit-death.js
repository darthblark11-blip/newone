// Human-relative wildlife sizes, real hit effects and deterministic falls.
const assert = require('assert');
const { probe } = require('./harness');
let checks = 0;
const run = source => probe(source);
function check(source, message) { assert.ok(run(source), message); checks++; }
run(`
  currentBiome=2;currentLevel=2;BIOME_ACTIVE=true;isStoryMode=false;doTick=true;
  isPaused=false;isDead=false;isWin=false;killcamMode=false;inCutscene=false;
  inStoryIntro=false;inOverworldView=false;inTravelMenu=false;inDarchonCall=false;
  inTownCutscene=false;inFarmCutscene=false;inFarmPostCutscene=false;
  inPostAmbushCutscene=false;inFortCutscene=false;inWorldBuildingMenu=false;
  player={x:15000,y:6600,hp:300};viewLeft=14400;viewRight=15600;viewTop=6200;viewBottom=7000;
  activeBuildings=[];authoredMask=null;authoredCore=null;chunkMgr=null;colGrid=null;
  resetForestWildlife();particles=[];bloodPools=[];
`);
check(`WILDLIFE_SPECIES.GRIZZLY_BEAR.size>=45&&WILDLIFE_SPECIES.MOOSE.size>=44&&WILDLIFE_SPECIES.ELK.size>=36`, 'Bears, moose and elk have substantial human-relative bulk');
check(`WILDLIFE_SPECIES.GRAY_WOLF.size>=26&&WILDLIFE_SPECIES.MULE_DEER.size>=28`, 'Wolves and deer remain readable beside human units');
check(`WILDLIFE_SPECIES.PIKA.size>=8&&WILDLIFE_SPECIES.WARBLER.size>=7&&WILDLIFE_SPECIES.WOODLAND_SALAMANDER.size>=7`, 'Small fauna remain smaller than mammals while visible at mobile zoom');
// Put the root at the final unit of a grid cell, with its head well into the
// next cell. Checking only a former 40-unit pad would miss these real targets.
run(`var qaLarge=wildlifeSpawnAnimal('GRIZZLY_BEAR',128*117+127,6600);qaLarge.angle=0;var qaHead=wildlifeHeadPoint(qaLarge);`);
check(`forestWildlifeHitTest({prevX:qaHead.x-1,prevY:qaHead.y,x:qaHead.x+1,y:qaHead.y,tH:'HEAD'}).animal===qaLarge`, 'Enlarged head hits cross wildlife grid boundaries');
check(`forestWildlifeHitTest({prevX:qaLarge.x+qaLarge.bodyR*.90,prevY:qaLarge.y,x:qaLarge.x+qaLarge.bodyR*.92,y:qaLarge.y,tH:'BODY'}).animal===qaLarge`, 'Enlarged forebody hits cross wildlife grid boundaries');
for (let direction = 0; direction < 8; direction++) {
  run(`qaLarge.angle=${direction}*Math.PI/4;qaHead=wildlifeHeadPoint(qaLarge);`);
  check(`forestWildlifeHitTest({prevX:qaHead.x-1,prevY:qaHead.y,x:qaHead.x+1,y:qaHead.y,tH:'HEAD'}).animal===qaLarge`, 'Anatomical head hit works at bearing '+direction);
}
function animal(species='MOOSE') {
  run(`resetForestWildlife();particles=[];bloodPools=[];activeBuildings=[];colGrid=null;_wildlifeSpawnClock=1e9;var qaAnimal=wildlifeSpawnAnimal('${species}',15000,6600);qaAnimal.angle=0;qaAnimal.sensorAt=qaAnimal.thinkAt=1e9;qaAnimal.goalX=qaAnimal.x;qaAnimal.goalY=qaAnimal.y;`);
}
animal();
run(`qaAnimal.angle=Math.PI/2;var qaSeed=serializeForestWildlife().seed;var qaRandom=random;random=()=>{throw Error('Wildlife hit consumed world RNG');};applyForestWildlifeHit(qaAnimal,{weapon:'PISTOL',head:false,damage:10,shotId:'wound',x:qaAnimal.x+qaAnimal.bodyR*.5,y:qaAnimal.y+qaAnimal.bodyR*.25,angle:0,owner:player});random=qaRandom;`);
check(`Math.abs(qaAnimal.decals[0].x-.25)<1e-8&&Math.abs(qaAnimal.decals[0].y+.5)<1e-8`, 'Impact wounds follow the hit point in the animal’s local facing');
check(`serializeForestWildlife().seed===qaSeed`, 'Blood effects preserve the isolated encounter RNG');
check(`particles.length===5&&particles.filter(p=>p.t==='BLOOD_SMOKE').length===2&&particles.some(p=>p.t==='BLOOD')`, 'A flesh impact emits pooled droplets and smooth blood smoke');
check(`Object.keys(bloodChunks).length>0`, 'Flesh impacts bake ground droplets into the existing floor bank');
run(`var qaDecal=JSON.stringify(qaAnimal.decals[0]);qaAnimal.angle=Math.PI;qaAnimal.state='GRAZE';qaAnimal.aggressor=null;for(let i=0;i<30;i++)updateForestWildlife(1);`);
check(`qaAnimal.hitFlash===0&&JSON.stringify(qaAnimal.decals[0])===qaDecal`, 'Blood wounds persist after hit flash and animal turning');
run(`for(let i=0;i<12;i++)applyForestWildlifeHit(qaAnimal,{weapon:'PISTOL',head:false,damage:1,shotId:'small'+i,x:qaAnimal.x,y:qaAnimal.y,angle:0});`);
check(`qaAnimal.decals.length===8&&!qaAnimal.dead`, 'Persistent body wound storage remains bounded');
animal();
run(`applyForestWildlifeHit(qaAnimal,{weapon:'TASER',head:true,damage:0,shotId:'stun'});`);
check(`qaAnimal.state==='STUNNED'&&!qaAnimal.dead&&qaAnimal.hp===qaAnimal.maxHp&&qaAnimal.condition==='PERFECT'`, 'Taser keeps the target alive and undamaged');
check(`qaAnimal.decals.length===0&&particles.length===0&&bloodPools.length===0&&qaAnimal.fall===null`, 'Taser never emits blood or invokes a lethal death type');
for (const [weapon,head,damage,type] of [
  ['PISTOL',false,150,'BODY_COLLAPSE'],['PISTOL',true,150,'HEADSHOT'],
  ['SHOTGUN',false,150,'SHOTGUN'],['PISTOL',false,400,'OVERKILL'],['EXPLOSIVE',false,400,'EXPLOSIVE']
]) {
  animal();
  run(`qaAnimal.vx=2;qaAnimal.vy=1;applyForestWildlifeHit(qaAnimal,{weapon:'${weapon}',head:${head},damage:${damage},shotId:'kill',angle:Math.PI/2,owner:player});`);
  check(`qaAnimal.deathType==='${type}'&&qaAnimal.fall.progress===0&&qaAnimal.vx>0&&qaAnimal.vy>1`, type+' keeps running momentum and incoming force');
  run(`var qaStartX=qaAnimal.x,qaStartY=qaAnimal.y,qaFacing=qaAnimal.angle;for(let i=0;i<50;i++)updateForestWildlife(1);`);
  check(`qaAnimal.x>qaStartX&&qaAnimal.y>qaStartY&&qaAnimal.angle===qaFacing&&qaAnimal.fall.progress===1&&qaAnimal.vx===0&&qaAnimal.vy===0`, type+' settles directionally without spinning');
  check(`bloodPools.length===1&&qaAnimal.fall.poolStamped`, type+' creates one growing blood pool on settlement');
}
animal('ELK');
run(`applyForestWildlifeHit(qaAnimal,{weapon:'BOW',head:true,damage:1,shotId:'arrow',angle:0});`);
check(`qaAnimal.dead&&qaAnimal.method==='BOW_HEAD'&&qaAnimal.condition==='PERFECT'&&qaAnimal.deathType==='HEADSHOT'`, 'Arrow headshots retain PERFECT quality with a headshot fall');
run(`var qaFallAge=qaAnimal.fall.age;isPaused=true;updateForestWildlife(3);isPaused=false;`);
check(`qaAnimal.fall.age===qaFallAge`, 'Pause freezes fall animation and corpse lifetime');
run(`doTick=false;updateForestWildlife(3);doTick=true;`);
check(`qaAnimal.fall.age===qaFallAge`, 'Menu tick suppression freezes falls');
run(`var qaLoot=wildlifeHarvest(qaAnimal);`);
check(`qaLoot.condition==='PERFECT'&&bloodPools.length===1&&qaAnimal.fall.poolStamped`, 'Immediate harvest preserves PERFECT loot and leaves a corpse blood pool');
animal();
run(`qaAnimal.bodyR=40;qaAnimal.angle=0;activeBuildings=[{x:15090,y:6600,w:20,h:240}];buildColIndex();qaAnimal.vx=4;applyForestWildlifeHit(qaAnimal,{weapon:'EXPLOSIVE',head:false,damage:400,shotId:'wall',angle:0});for(let i=0;i<50;i++)updateForestWildlife(1);`);
check(`qaAnimal.x+qaAnimal.bodyR*1.35+2<=15080&&qaAnimal.fall.progress===1`, 'The full falling body stops outside solid walls');
// COL_PAD only covers army-sized bodies. Put a solid beyond that margin in
// an adjacent cell, where the old one-cell probe cannot see it at all.
animal('GRIZZLY_BEAR');
for (let heading = 0; heading < 8; heading++) for (const side of [-1,1]) {
  const alongX = Math.abs(Math.cos(heading*Math.PI/4)) >= Math.abs(Math.sin(heading*Math.PI/4));
  run(`qaAnimal.bodyR=45;qaAnimal.angle=${heading}*Math.PI/4;
    qaAnimal.x=COL_CELL*68+${alongX?(side<0?10:210):110};
    qaAnimal.y=COL_CELL*30+${alongX?110:(side<0?10:210)};
    activeBuildings=[{x:qaAnimal.x+${alongX?side*50:0},y:qaAnimal.y+${alongX?0:side*50},w:2,h:2}];
    buildColIndex();`);
  check(`colNear(qaAnimal.x,qaAnimal.y).length===0&&!wildlifeCanStand(qaAnimal,qaAnimal.x,qaAnimal.y)`,
    'Enlarged body finds adjacent-cell solids at bearing '+heading+' and side '+side);
}
run(`qaAnimal.x=15000;qaAnimal.y=6600;qaAnimal.airborne=true;
  activeBuildings=[{x:15000,y:6600,w:1200,h:20}];buildColIndex();
  var qaBlockCalls=0,qaOldSolidBlocks=wildlifeSolidBlocks;
  wildlifeSolidBlocks=(b,a)=>{qaBlockCalls++;return qaOldSolidBlocks(b,a);};
  var qaCanFly=wildlifeCanStand(qaAnimal,qaAnimal.x,qaAnimal.y);
  wildlifeSolidBlocks=qaOldSolidBlocks;`);
check(`qaCanFly&&qaBlockCalls===1`, 'Expanded wildlife probes check the long-solid list once');
animal('GRIZZLY_BEAR');
run(`qaAnimal.bodyR=45;qaAnimal.angle=0;qaAnimal.state='FLEE';qaAnimal.alarm=1e9;
  qaAnimal.goalY=qaAnimal.y+200;_wildlifeClock=2;
  activeBuildings=[{x:qaAnimal.x,y:qaAnimal.y+52,w:200,h:2}];buildColIndex();
  var qaTurnX=qaAnimal.x,qaTurnY=qaAnimal.y;updateForestWildlife(1);`);
check(`qaAnimal.x===qaTurnX&&qaAnimal.y===qaTurnY&&qaAnimal.angle===0&&qaAnimal.vx===0&&qaAnimal.vy===0&&wildlifeCanStand(qaAnimal,qaAnimal.x,qaAnimal.y)`,
  'A blocked quarter-turn keeps the previous clear orientation and root');
animal('GRIZZLY_BEAR');
run(`qaAnimal.bodyR=45;qaAnimal.angle=0;qaAnimal.state='FLEE';qaAnimal.alarm=1e9;
  qaAnimal.goalY=qaAnimal.y+200;_wildlifeClock=2;
  var qaTurnY=qaAnimal.y,qaTurnSeed=serializeForestWildlife().seed;updateForestWildlife(1);`);
check(`qaAnimal.y>qaTurnY&&qaAnimal.angle===Math.PI/2&&wildlifeCanStand(qaAnimal,qaAnimal.x,qaAnimal.y)&&serializeForestWildlife().seed===qaTurnSeed`,
  'A clear turn moves in the new heading without consuming encounter RNG');
for (const vertical of [true,false]) {
  animal('GRIZZLY_BEAR');
  run(`qaAnimal.bodyR=45;qaAnimal.angle=${vertical?'Math.PI/2':'0'};qaAnimal.state='FLEE';qaAnimal.alarm=1e9;
    qaAnimal.goalX=qaAnimal.x+200;qaAnimal.goalY=qaAnimal.y+200;_wildlifeClock=2;
    activeBuildings=[{x:qaAnimal.x+${vertical?55:0},y:qaAnimal.y+${vertical?0:55},w:${vertical?2:200},h:${vertical?200:2}}];buildColIndex();
    var qaTurnX=qaAnimal.x,qaTurnY=qaAnimal.y,qaTurnSeed=serializeForestWildlife().seed;updateForestWildlife(1);`);
  check(`${vertical?'qaAnimal.x===qaTurnX&&qaAnimal.y>qaTurnY&&qaAnimal.angle===Math.PI/2':'qaAnimal.x>qaTurnX&&qaAnimal.y===qaTurnY&&qaAnimal.angle===0'}&&wildlifeCanStand(qaAnimal,qaAnimal.x,qaAnimal.y)&&serializeForestWildlife().seed===qaTurnSeed`,
    'Blocked diagonal movement validates the '+(vertical?'vertical':'horizontal')+' slide footprint without RNG calls');
}
animal('BALD_EAGLE');
run(`qaAnimal.vx=2;applyForestWildlifeHit(qaAnimal,{weapon:'PISTOL',head:false,damage:80,shotId:'bird',angle:0});updateForestWildlife(10);`);
check(`qaAnimal.deathType==='BIRD_DROP'&&qaAnimal.airborne&&qaAnimal.fall.drop>0&&qaAnimal.fall.drop<1`, 'Airborne kills visibly drop before joining the ground layer');
run(`for(let i=0;i<50;i++)updateForestWildlife(1);`);
check(`!qaAnimal.airborne&&qaAnimal.fall.grounded&&qaAnimal.fall.drop===1&&qaAnimal.fall.progress===1`, 'A dropped bird finishes as a stable ground carcass');
animal('BALD_EAGLE');
run(`activeBuildings=[{x:qaAnimal.x,y:qaAnimal.y,w:60,h:60}];buildColIndex();applyForestWildlifeHit(qaAnimal,{weapon:'PISTOL',head:false,damage:80,shotId:'bird-tree',angle:0});for(let i=0;i<50;i++)updateForestWildlife(1);`);
check(`!qaAnimal.airborne&&wildlifeCanStand(qaAnimal,qaAnimal.x,qaAnimal.y)`, 'A bird shot above an obstacle finds a nearby clear landing');
animal('GRIZZLY_BEAR');
run(`for(let i=0;i<20;i++)applyForestWildlifeHit(qaAnimal,{weapon:'PISTOL',head:false,damage:1,shotId:'budget'+i,angle:0});`);
check(`particles.length===32&&qaAnimal.decals.length===8`, 'Sustained hits stay inside the per-tick particle budget');
animal('ELK');
run(`var qaEnemyCount=enemiesList.length;nm0AmbushActive=true;nm0AmbushKills=17;window.ambushSpawnsRemaining=23;applyForestWildlifeHit(qaAnimal,{weapon:'PISTOL',head:true,damage:100,shotId:'objective',angle:0});`);
check(`qaAnimal.dead&&enemiesList.length===qaEnemyCount&&nm0AmbushKills===17&&window.ambushSpawnsRemaining===23`, 'Wildlife deaths keep military lists and ambush objective counts separate');
console.log('Wildlife hit/death: '+checks+' checks passed.');

// Wildlife ecology, hit selection and loot rules in the real game script.
// No browser dependency: the harness stubs painting, not wildlife arithmetic.
const assert = require('assert');
const { probe } = require('./harness');
let checks = 0;
function check(source, message) {
  assert.ok(probe(source), message); checks++;
}
function run(source) { return probe(source); }
run(`
  currentBiome=2;currentLevel=2;BIOME_ACTIVE=true;isStoryMode=false;
  isPaused=false;isDead=false;isWin=false;killcamMode=false;inCutscene=false;
  inDarchonCall=false;inTownCutscene=false;inFarmCutscene=false;inFarmPostCutscene=false;
  inPostAmbushCutscene=false;inFortCutscene=false;inWorldBuildingMenu=false;doTick=true;
  player={x:15000,y:6600,hp:300,takeDamage(n){this.hp-=n;}};
  viewLeft=14400;viewRight=15600;viewTop=6200;viewBottom=7000;
  activeBuildings=[];authoredMask=null;authoredCore=null;chunkMgr=null;colGrid=null;
  resetForestWildlife();
`);
check(`WILDLIFE_SPECIES_IDS.length===39`, 'Every requested wildlife species has a catalog entry');
check(`WILDLIFE_SPECIES_IDS.every(id=>{const s=WILDLIFE_SPECIES[id];return s.name&&s.habitats.length&&s.size>0&&s.headR>0&&s.hp>0&&s.color.length===3;})`, 'Catalog entries have usable hit and art profiles');
const habitats=['TIMBER','MARSH','BURN','HEATH','VIBRANT','MEADOW','EDGE'];
for(const habitat of habitats){
  check(`Array.from({length:101},(_,i)=>wildlifePickSpecies('${habitat}',i/101)).every(s=>s&&s.habitats.includes('${habitat}'))`, habitat+' habitat never receives an incompatible species');
  run(`restoreForestWildlife({seed:123,nextId:1,rareMisses:18});`);
  check(`Array.from({length:101},(_,i)=>wildlifePickSpecies('${habitat}',i/101)).every(s=>s&&s.rarity>=3)`, habitat+' pseudo-luck guarantees a rare encounter after 18 common encounters');
  run(`resetForestWildlife();`);
}
run(`var wildlifeQAWeights=[0,0,0,0,0];for(let i=0;i<1000;i++)wildlifeQAWeights[wildlifePickSpecies('TIMBER',i/1000).rarity]++;`);
check(`wildlifeQAWeights[1]>wildlifeQAWeights[3]&&wildlifeQAWeights[2]>wildlifeQAWeights[4]`, 'Common species are meaningfully more common than rare species');
run(`var wildlifeQABefore=serializeForestWildlife();var wildlifeQARolls=Array.from({length:40},()=>wildlifeRandom());restoreForestWildlife(wildlifeQABefore);`);
check(`wildlifeQARolls.every(v=>v===wildlifeRandom())`, 'Rarity RNG sequence resumes exactly after save/load');
run(`restoreForestWildlife({seed:0,nextId:-20,rareMisses:900,encounters:Infinity});`);
check(`serializeForestWildlife().seed===1&&serializeForestWildlife().nextId===1&&serializeForestWildlife().rareMisses===18&&serializeForestWildlife().encounters===0`, 'Corrupt save numbers are bounded before use');
function animal(species='ELK'){
  run(`resetForestWildlife();var wildlifeQAAnimal=wildlifeSpawnAnimal('${species}',player.x,player.y);`);
}
function hit(weapon,head,damage,shotId){
  run(`applyForestWildlifeHit(wildlifeQAAnimal,{weapon:${JSON.stringify(weapon)},head:${head},damage:${damage},shotId:${JSON.stringify(shotId)},owner:player});`);
}
animal();hit('PISTOL',true,100,'one');
check(`wildlifeQAAnimal.dead&&wildlifeQAAnimal.condition==='GOOD'&&wildlifeQAAnimal.shots===1`, 'One lethal gun headshot produces GOOD condition');
animal();hit('PISTOL',true,50,'one');hit('PISTOL',true,50,'two');
check(`wildlifeQAAnimal.dead&&wildlifeQAAnimal.condition==='FAIR'&&wildlifeQAAnimal.headshots===2`, 'Two gun headshots produce FAIR condition');
animal();hit('PISTOL',true,30,'one');hit('PISTOL',true,30,'two');hit('PISTOL',true,30,'three');
check(`wildlifeQAAnimal.dead&&wildlifeQAAnimal.condition==='FAIR'`, 'Exactly three shots have FAIR condition');
animal();for(let i=0;i<4;i++)hit('PISTOL',false,25,'shot'+i);
check(`wildlifeQAAnimal.dead&&wildlifeQAAnimal.condition==='BAD'&&wildlifeQAAnimal.shots===4`, 'Four gun shots produce BAD scraps');
animal('GRIZZLY_BEAR');for(let i=0;i<5;i++)hit('SHOTGUN',true,35,'same-trigger');
check(`wildlifeQAAnimal.dead&&wildlifeQAAnimal.condition==='GOOD'&&wildlifeQAAnimal.shots===1`, 'Shotgun pellets from one trigger count as one shot');
animal('GRIZZLY_BEAR');hit('BOW',true,1,'bow');
check(`wildlifeQAAnimal.dead&&wildlifeQAAnimal.condition==='PERFECT'&&wildlifeQAAnimal.method==='BOW_HEAD'`, 'Arrow headshots instantly kill the largest mammal in PERFECT condition');
animal();hit('BOW',false,55,'bow1');hit('BOW',false,55,'bow2');
check(`wildlifeQAAnimal.dead&&wildlifeQAAnimal.condition==='FAIR'&&wildlifeQAAnimal.method==='BOW'`, 'Arrow body kills do not pass the perfect headshot activity');
animal();hit('TASER',false,0,'taser');
check(`!wildlifeQAAnimal.dead&&wildlifeQAAnimal.hp===wildlifeQAAnimal.maxHp&&wildlifeQAAnimal.state==='STUNNED'&&wildlifeQAAnimal.condition==='PERFECT'`, 'Taser stun is nonlethal and PERFECT');
run(`var wildlifeQALoot=wildlifeHarvest(wildlifeQAAnimal);`);
check(`wildlifeQALoot.state==='STUNNED'&&wildlifeQALoot.method==='TASER'&&wildlifeQALoot.count===1`, 'Stun harvest keeps its live state and method in inventory metadata');
check(`wildlifeHarvest(wildlifeQAAnimal)===null`, 'A harvest cannot duplicate an inventory item');
animal();hit('PISTOL',true,100,'one');run(`wildlifeQAAnimal.x+=1000;`);
check(`wildlifeHarvest(wildlifeQAAnimal)===null&&!wildlifeQAAnimal.harvested`, 'A distant corpse cannot be collected remotely');
animal();hit('EXPLOSIVE',false,200,'boom');
check(`wildlifeQAAnimal.condition==='BAD'`, 'Explosive kills yield scraps');
animal('RED_FOX');hit('PISTOL',false,10,'hurt');
check(`wildlifeQAAnimal.state==='TERRITORIAL'&&!wildlifeQAAnimal.dead`, 'Injured predators react defensively to crossfire');
animal('MULE_DEER');hit('PISTOL',false,10,'hurt');
run(`wildlifeBrain(wildlifeQAAnimal);`);
check(`wildlifeQAAnimal.state==='FLEE'&&!wildlifeQAAnimal.dead`, 'Injured herd herbivores flee');
animal();run(`notifyForestWildlifeThreat(player.x-100,player.y,450);`);
check(`wildlifeQAAnimal.state==='ALARM'&&wildlifeQAAnimal.alarm>0`, 'Nearby gunfire triggers a visible alarm state');
run(`wildlifeBrain(wildlifeQAAnimal);`);
check(`wildlifeQAAnimal.state==='FLEE'&&wildlifeQAAnimal.goalX>wildlifeQAAnimal.x`, 'Alarm resolves to flight away from the sound');
// Segment intersection must find the first animal, even at projectile speeds
// that can cross a small critter between frame endpoints.
run(`resetForestWildlife();var wildlifeQAFar=wildlifeSpawnAnimal('ELK',15100,6600);var wildlifeQANear=wildlifeSpawnAnimal('PIKA',15050,6600);wildlifeQAFar.angle=0;wildlifeQANear.angle=0;`);
check(`forestWildlifeHitTest({prevX:15000,prevY:6600,x:15150,y:6600,tH:'BODY'}).animal===wildlifeQANear`, 'Fast segments hit the nearest animal, independent of array order');
check(`forestWildlifeHitTest({prevX:15000,prevY:6640,x:15150,y:6640,tH:'BODY'})===null`, 'A segment outside all animal bounds misses');
run(`var wildlifeQAHead=wildlifeHeadPoint(wildlifeQAFar);`);
check(`forestWildlifeHitTest({prevX:wildlifeQAHead.x-10,prevY:wildlifeQAHead.y,x:wildlifeQAHead.x+10,y:wildlifeQAHead.y,tH:'HEAD'}).head`, 'HEAD aim can hit the drawn head');
run(`applyForestWildlifeHit(wildlifeQANear,{weapon:'TASER',head:false,shotId:'stun',damage:0});`);
check(`forestWildlifeHitTest({prevX:15000,prevY:6600,x:15150,y:6600,tH:'BODY'}).animal===wildlifeQAFar`, 'Stunned animals leave the projectile hit grid');
run(`resetForestWildlife();for(let i=0;i<60;i++)wildlifeSpawnAnimal('ELK',15000+i*50,6600);`);
check(`forestWildlife.length===WILDLIFE_MAX_ACTORS`, 'Dense herds cannot exceed the wildlife budget');
const armyCount=run(`enemiesList.length`);
check(`enemiesList.length===${armyCount}`, 'Wildlife does not join the military list');
// A moving animal sees the shared solid index, not a per-animal full-world scan.
run(`resetForestWildlife();var wildlifeQAMover=wildlifeSpawnAnimal('ELK',15000,6600);wildlifeQAMover.goalX=15200;wildlifeQAMover.goalY=6600;wildlifeQAMover.thinkAt=1e9;wildlifeQAMover.state='FLEE';wildlifeQAMover.alarm=1e9;activeBuildings=[{x:15100,y:6600,w:40,h:200}];buildColIndex();_wildlifeSpawnClock=1e9;`);
run(`for(let i=0;i<120;i++)updateForestWildlife(1);`);
check(`wildlifeQAMover.x<15100-20-wildlifeQAMover.bodyR`, 'Movement does not walk through a solid wall');
run(`activeBuildings=[];colGrid=null;wildlifeQAMover.goalX=wildlifeQAMover.x+500;wildlifeQAMover.thinkAt=1e9;var wildlifeQAFrozen=wildlifeQAMover.x;isPaused=true;updateForestWildlife(1);isPaused=false;`);
check(`wildlifeQAMover.x===wildlifeQAFrozen`, 'Pause freezes wildlife');
for(const flag of ['inCutscene','inDarchonCall','inTownCutscene','inFarmCutscene','inFarmPostCutscene','inPostAmbushCutscene','inFortCutscene','inWorldBuildingMenu','killcamMode','isDead','isWin']){
 run(`${flag}=true;updateForestWildlife(1);${flag}=false;`);
 check(`wildlifeQAMover.x===wildlifeQAFrozen`, flag+' freezes wildlife');
}
run(`resetForestWildlife();activeBuildings=[];colGrid=null;_wildlifeSpawnClock=1e9;wildlifeQAMover=wildlifeSpawnAnimal('ELK',15000,6600);wildlifeQAMover.goalX=15500;wildlifeQAMover.goalY=6600;wildlifeQAMover.state='FLEE';wildlifeQAMover.alarm=1e9;wildlifeQAMover.thinkAt=1e9;var wildlifeQAMoves=[];for(let i=0;i<20;i++){var x=wildlifeQAMover.x;updateForestWildlife(1);wildlifeQAMoves.push(wildlifeQAMover.x-x);}`);
check(`wildlifeQAMoves.slice(4).every(x=>x>0)`, 'Cached collision probes still permit smooth motion every frame');
// Actual procedural rules, not a mocked predicate, gate off-screen encounters.
run(`resetForestWildlife();activeBuildings=[];colGrid=null;chunkMgr=null;var wildlifeQASpawned=0;for(let i=0;i<12;i++)wildlifeQASpawned+=wildlifeSpawnEncounter();`);
check(`wildlifeQASpawned>0`, 'The actual forest generator has viable wildlife encounter locations');
check(`forestWildlife.every(a=>!inView(a.x,a.y,a.bodyR+100))`, 'Every member of a newly spawned herd starts off screen');
check(`forestWildlife.every(a=>!insideFortYard(2,a.x,a.y,460))`, 'Encounter spawning avoids the NM-0 fortress');
check(`forestWildlife.every(a=>!groundReserved(2,Math.floor(a.x/CHUNK_W),Math.floor(a.y/CHUNK_W),a.x,a.y,(WILDLIFE_SPECIES[a.species].size+18)*2,(WILDLIFE_SPECIES[a.species].size+18)*2,24))`, 'Encounter spawning keeps army roads and river crossings clear');
run(`var wildlifeQAFort=outpostFortDef(2);`);
check(`!wildlifeSpawnAllowed(WILDLIFE_SPECIES.ELK,wildlifeQAFort.x,wildlifeQAFort.y)`, 'Fort interior is never a wildlife spawn point');
check(`!wildlifeSpawnAllowed(WILDLIFE_SPECIES.ELK,player.x,player.y)`, 'Visible points are rejected');
run(`currentBiome=1;updateForestWildlife(1);`);
check(`forestWildlife.length===0`, 'Leaving Level 2 releases ephemeral wildlife actors');
run(`restoreForestWildlife({seed:123,nextId:8,rareMisses:17,encounters:20});`);
check(`forestWildlife.length===0&&serializeForestWildlife().rareMisses===17&&serializeForestWildlife().seed===123`, 'Save restoration keeps encounter luck without cloning corpses');
console.log('Wildlife core: '+checks+' checks passed.');

// Ambient encounter work must not compete with Level 2's starting compound
// or NM0 muster. Keep existing animals alive and animated through the fight.
const assert = require('assert');
const { probe } = require('./harness');
let checks = 0;
function check(source, message) { assert.ok(probe(source), message); checks++; }
probe(`
  currentLevel=2;currentBiome=2;BIOME_ACTIVE=true;isStoryMode=true;
  isPaused=false;isDead=false;isWin=false;killcamMode=false;doTick=true;
  inCutscene=false;inStoryIntro=false;inOverworldView=false;inTravelMenu=false;
  inDarchonCall=false;inTownCutscene=false;inFarmCutscene=false;inFarmPostCutscene=false;
  inPostAmbushCutscene=false;inFortCutscene=false;inWorldBuildingMenu=false;
  nm0AmbushActive=false;window.undercityNorthBreached=false;window.undercitySouthBreached=false;
  player={x:600,y:600,hp:300,takeDamage(n){this.hp-=n;}};
  sealedSector={x0:-1200,x1:2400,y0:-1400,y1:2600};
  buildings=[
    {x:600,y:-1800,w:3600,h:800,isGovFortress:true,hp:3000},
    {x:600,y:3000,w:3600,h:800,isGovFortress:true,hp:3000},
    {x:-1450,y:600,w:500,h:5600,isGiantBarrier:true},
    {x:2650,y:600,w:500,h:5600,isGiantBarrier:true}
  ];
  activeBuildings=[];colGrid=null;chunkMgr=null;authoredMask=null;authoredCore=null;
  viewLeft=14400;viewRight=15600;viewTop=6200;viewBottom=7000;
  resetForestWildlife();
  var qaBattleLedger=JSON.stringify(serializeForestWildlife());
`);
check(`!wildlifeEncountersAllowed() && wildlifeSpawnEncounter()===0`, 'The starting compound suppresses encounter placement');
check(`JSON.stringify(serializeForestWildlife())===qaBattleLedger`, 'Suppressed encounters consume no ecology RNG or encounter luck');
probe(`window.undercitySouthBreached=true;buildings[1].hp=0;player.y=3399;`);
check(`!wildlifeEncountersAllowed()`, 'An open door still suppresses spawning until the player crosses its outer face');
probe(`player.y=3400;`);
check(`!wildlifeEncountersAllowed()`, 'The gate boundary remains part of the compound');
probe(`player.y=3401;`);
check(`wildlifeEncountersAllowed()`, 'Walking beyond the south gate enables forest encounters');
probe(`player.y=-2201;`);
check(`wildlifeEncountersAllowed()`, 'Walking beyond the north gate also enables forest encounters');
probe(`player.x=-1699;player.y=600;`);
check(`!wildlifeEncountersAllowed()`, 'A root within the curtain wall cannot enable distant herds');
probe(`
  player.x=15000;player.y=6600;nm0AmbushActive=true;
  var qaSpawnCalls=0,qaGridCalls=0;
  var qaSpawnEncounter=wildlifeSpawnEncounter,qaRebuildGrid=wildlifeRebuildGrid;
  wildlifeSpawnEncounter=function(){qaSpawnCalls++;return qaSpawnEncounter();};
  wildlifeRebuildGrid=function(){qaGridCalls++;return qaRebuildGrid();};
  for(let i=0;i<1800;i++)updateForestWildlife(1);
  wildlifeSpawnEncounter=qaSpawnEncounter;wildlifeRebuildGrid=qaRebuildGrid;
`);
check(`qaSpawnCalls===0 && qaGridCalls===0 && forestWildlife.length===0`, 'A thirty-second empty ambush performs no encounter or wildlife grid passes');
check(`JSON.stringify(serializeForestWildlife())===qaBattleLedger`, 'An empty ambush preserves all ecology RNG and encounter counters');
check(`wildlifeSpawnEncounter()===0`, 'Direct encounter calls also respect an active ambush outside the fort');
probe(`
  nm0AmbushActive=false;
  var qaPlaced=0;for(let i=0;i<12;i++)qaPlaced+=wildlifeSpawnEncounter();
`);
check(`qaPlaced>0`, 'The real encounter placement still works outside the compound after the ambush');
probe(`
  resetForestWildlife();
  var qaLive=wildlifeSpawnAnimal('ELK',15200,6600);
  qaLive.sensorAt=qaLive.thinkAt=1e9;qaLive.goalX=15600;qaLive.goalY=6600;
  qaLive.state='FLEE';qaLive.alarm=1e9;qaLive.vx=2;qaLive.vy=0;
  var qaCorpse=wildlifeSpawnAnimal('PIKA',15100,6600);
  qaCorpse.dead=true;qaCorpse.state='DEAD';qaCorpse.ttl=18000;
  nm0AmbushActive=true;var qaLiveX=qaLive.x,qaWing=qaLive.wingPhase;
  var qaBeforeClock=_wildlifeSpawnClock;
  for(let i=0;i<20;i++)updateForestWildlife(1);
`);
check(`forestWildlife.includes(qaLive) && qaLive.x>qaLiveX && qaLive.wingPhase>qaWing`, 'Existing animals keep their normal movement and animation during an ambush');
check(`forestWildlife.includes(qaCorpse) && qaCorpse.ttl===17980`, 'Existing corpse lifetime continues during the ambush');
check(`_wildlifeSpawnClock===qaBeforeClock`, 'Only encounter timing is held while spawning is suppressed');
probe(`
  nm0AmbushActive=false;sealedSector=null;player.x=600;player.y=600;
`);
check(`wildlifeEncountersAllowed()`, 'A settled fully streamed Level 2 needs no obsolete escape flags');
probe(`currentBiome=1;`);
check(`!wildlifeEncountersAllowed() && wildlifeSpawnEncounter()===0`, 'Encounter entry points cannot create forest wildlife in another biome');
console.log('Wildlife battle budget: '+checks+' checks passed.');

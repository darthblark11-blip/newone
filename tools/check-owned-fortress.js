// Capture protects every hostile spawn path while keeping story fights and
// friendly deployment available. Run: node tools/check-owned-fortress.js
const assert = require('assert');
const { ctx, probe } = require('./harness');
const P = source => probe('(' + source + ')');
let checks = 0;
const ok = (condition, label) => { checks++; assert(condition, label); };
let seed = 19970421;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const n = seed / 4294967296;
  if (a === undefined) return n;
  if (Array.isArray(a)) return a[(n * a.length) | 0];
  return b === undefined ? n * a : a + n * (b - a);
};
ctx.setTimeout = () => 0;
let saveSlot = null;
ctx.localStorage = { getItem: () => saveSlot, setItem: (key, value) => { saveSlot = value; }, removeItem: () => { saveSlot = null; } };

function fresh(level = 1, story = true) {
  probe(`isStoryMode=${story};townsData={};window.outpostForts={};
    window.towersDefeated=false;window.storyBeats={};
    window.southGateBreachedStatus=false;window.northGateBreachedStatus=false;
    window.militaryToBring=0;window.militaryToBringM=0;window.militaryToBringF=0;
    window.pendingEscortRoster=[];startAtLevel(${level});started=true;doTick=true;
    inTownCutscene=false;inPostAmbushCutscene=false;inFortCutscene=false;
    inFarmCutscene=false;inFarmPostCutscene=false;inLvl4Cutscene=false;
    inDarchonCall=false;darchonCallCompleted=true;inStoryIntro=false;inStoryRoom=false;
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
    window.showOnScreenControls=false;
    inWorldBuildingMenu=false;inOverworldView=false;isPaused=false;killcamMode=false;
    enemiesList=[];townCitizens=[];`);
}

fresh();
ok(P('ownedFortresses(1).length===0'), 'new sectors do not start player-owned');
ok(P('getOwnedFortressSpawnPoint()===null'), 'deployment without a captured fortress has no player fallback');
probe('window.southGateBreachedStatus=true;outpostFortState(1).breached=true;');
ok(P('ownedFortresses(1).length===0'), 'breaching either kind of gate is not ownership');
probe('outpostFortState(1).captured=true;sectorLedger(1).established=true;');
ok(P('sectorTowers().some(b=>b.hp>0)&&!window.towersDefeated'), 'outpost-first fixture retains the live starting fortress towers');
ok(P('ownedFortresses(1).length===1&&ownedFortresses(1)[0].id==="OUTPOST"'), 'establishing at a captured relay does not award the starting fortress');
ok(!P('insideOwnedFortress(1,600,600)'), 'relay-only ownership leaves the starting enclosure hostile');
probe('saveGame();loadGame();');
ok(P('townsData[1].established&&ownedFortresses(1).length===1&&ownedFortresses(1)[0].id==="OUTPOST"'), 'relay-only ownership remains distinct after a real reload');
ok(P('sectorTowers().some(b=>b.hp>0)'), 'relay-only reload does not erase the starting transmission grid');
probe('outpostFortState(1).captured=false;');
probe('markSectorTowersDown(1);');
ok(P('ownedFortresses(1).length===1&&ownedFortresses(1)[0].id==="SECTOR"'), 'starting fortress is owned when its grid falls');
ok(P('ownedFortresses(2).length===0'), 'starting fortress ownership does not leak to another biome');
for (const [x, y] of [[600, 600], [-4700, 600], [5900, 600], [600, -4600], [600, 5800]])
  ok(P(`insideOwnedFortress(1,${x},${y})`), `starting fortress perimeter includes ${x},${y}`);
for (const [x, y] of [[-5000, 600], [6200, 600], [600, -5000], [600, 6200]])
  ok(!P(`insideOwnedFortress(1,${x},${y})`), `starting fortress leaves exterior ${x},${y} hostile`);
probe('outpostFortState(1).captured=true;player.x=7200;player.y=10800;');
ok(P('ownedFortresses(1).length===2'), 'both fortresses can be owned independently');
ok(P('nearestOwnedFortress(1).id==="OUTPOST"'), 'deployment selects the nearer owned outpost');
probe('player.x=600;player.y=600;');
ok(P('nearestOwnedFortress(1).id==="SECTOR"'), 'deployment near the city uses its starting fortress');

// Friendly placement respects the real map's solids, gates and occupants.
for (const id of ['SECTOR', 'OUTPOST']) {
  probe(`player.x=${id === 'SECTOR' ? 600 : 7200};player.y=${id === 'SECTOR' ? 600 : 10800};
    enemiesList=[];townCitizens=[];`);
  for (let n = 0; n < 24; n++) {
    probe(`window.ownedPoint=getOwnedFortressSpawnPoint(${n});`);
    const point = P('ownedPoint');
    ok(!!point && point.fortress.id === id, `${id} placement ${n} uses its own fortress`);
    ok(P('insideOwnedFortress(1,ownedPoint.x,ownedPoint.y)'), `${id} placement ${n} is inside the compound`);
    ok(P('(ownedPoint.x-player.x)**2+(ownedPoint.y-player.y)**2>=160*160'), `${id} placement ${n} is away from the player`);
    ok(P('!buildings.some(b=>!b.noClip&&!b.isPalm&&!b.isAlienPlant&&!b.isEnergyPole&&!(b.isGrassLot&&!b.isPond)&&Math.abs(ownedPoint.x-b.x)<(b.w||0)/2+34&&Math.abs(ownedPoint.y-b.y)<(b.h||0)/2+34)'), `${id} placement ${n} clears structures`);
    probe('townCitizens.push({x:ownedPoint.x,y:ownedPoint.y});');
  }
  probe('window.ownedPoint=getOwnedFortressSpawnPoint(0,1,true);');
  ok(P('ownedPoint&&(ownedPoint.x-player.x)**2+(ownedPoint.y-player.y)**2<1100*1100'), `${id} active military placement stays near the player inside its fortress`);
}
probe('buildings=[{x:7200,y:10800,w:10000,h:10000}];townCitizens=[];');
ok(P('getOwnedFortressSpawnPoint()===null'), 'a blocked fortress does not force a friendly into a wall');

// Compatibility requires evidence of the main compound, not simply a town
// label that could have come from establishing the outpost's Directive.
fresh();
probe('townsData[1]={established:true};');
ok(!P('startingFortressOwned(1)'), 'an ambiguous older established record is not presumed captured');
probe('townsData[1]={established:true,popSeeded:80,popKilled:79};');
ok(!P('startingFortressOwned(1)'), 'a surviving original defender prevents old genocide capture inference');
probe('townsData[1].popKilled=80;');
ok(P('startingFortressOwned(1)'), 'an established older genocide run retains ownership of its cleared main roster');
probe('townsData[1]={established:true,popAmbushCleared:true};');
ok(P('startingFortressOwned(1)'), 'a saved main-sector liberation award preserves older capture ownership');
probe('townsData[1]={established:true};window.storyBeats={L1_POSTAMBUSH:true};');
ok(P('startingFortressOwned(1)'), 'the named main-sector liberation beat preserves older capture ownership');

fresh();
probe('markSectorTowersDown(1);player.x=600;player.y=600;');
for (let n = 0; n < 12; n++) {
  probe('window.ownedPoint=getSafeSpawn(true);');
  ok(P('!insideOwnedFortress(1,ownedPoint.x,ownedPoint.y,60)'), 'random ring and last-resort hostile placement respect the starting enclosure');
}
probe('window.ownedPoint=legacyGetSafeSpawn(true);');
ok(P('!insideOwnedFortress(1,ownedPoint.x,ownedPoint.y,60)'), 'legacy rejection exhaustion cannot spawn inside owned gates');
probe('triggerGateAmbush(5400,false);');
ok(P('enemiesList.length>0&&enemiesList.every(e=>!insideOwnedFortress(1,e.x,e.y,60))'), 'south gate breach musters outside a captured compound');
ok(P('gateIsOpen(sectorGates().find(b=>b.y>0))'), 'exterior story defenders remain reachable through the south door');
ok(P('!gateIsOpen(sectorGates().find(b=>b.y<0))'), 'north keeps its authored HQ interaction');
probe('enemiesList=[];triggerGateAmbush(-4200,true);');
ok(P('enemiesList.length>0&&enemiesList.every(e=>!insideOwnedFortress(1,e.x,e.y,60))'), 'north gate breach does not remuster inside captured walls');
ok(P('enemiesList.every(e=>e.y>5800)'), 'north breach defenders assemble at the reachable south approach');
probe('activeBuildings=buildings;activeParkingCars=parkingCars;invalidateColIndex();');
ok(P(`enemiesList.filter(e=>e.eType!=='AERIAL').every(e=>{
  for(let y=e.y;y>=4940;y-=20)if(e.checkCol(e.x,y))return false;
  return true;
})`), 'ground troops from a north breach can cross the captured south doorway');
probe('enemiesList=[];window.ambushSpawnsRemaining=4;window.ambushOrigin=null;spawnAmbushReinforcement();');
ok(P('enemiesList.length===1&&!insideOwnedFortress(1,enemiesList[0].x,enemiesList[0].y,60)'), 'shared story reinforcements spawn outside the owned compound');

// Exercise the real tower scene, not just the shared factory.
fresh();
probe('markSectorTowersDown(1);window.towersDefeated=true;inTownCutscene=true;townPhase=7;draw();');
ok(P('enemiesList.filter(e=>e.isAmbush).length===100'), 'tower capture keeps the authored ambush headcount');
ok(P('enemiesList.every(e=>e.isFriendly||!insideOwnedFortress(1,e.x,e.y,60))'), 'tower cutscene puts every new hostile beyond the owned gates');
ok(P('window.ambushKind==="TOWER"&&nm0AmbushKills===300&&window.ambushSpawnsRemaining===200'), 'exterior deployment preserves story objectives and reinforcement budget');
ok(P('gateIsOpen(sectorGates().find(b=>b.y>0))'), 'ownership opens the south approach during the tower fight');
probe('saveGame();enemiesList=[];loadGame();');
ok(P('enemiesList.some(e=>e.isAmbush)&&enemiesList.every(e=>e.isFriendly||!insideOwnedFortress(1,e.x,e.y,60))'), 'reloaded tower ambushers still assemble outside the captured main fortress');
ok(P('nm0AmbushActive&&nm0AmbushKills===300'), 'saving an exterior tower fight does not prematurely award its clear');

// Checkpoint and city patrol rosters must obey the same ownership rule.
fresh(1, false);
probe(`window.towersDefeated=true;buildings=[];activeBuildings=[];parkingCars=[];
  activeParkingCars=[];barrels=[];authoredCore=null;authoredChunks=null;invalidateColIndex();
  window.ownedMgr={biome:1,chunks:new Map([['0,0',{solid:[]}]])};
  player.x=600;player.y=600;zoom=2;viewLeft=500;viewRight=700;viewTop=500;viewBottom=700;
  biomeState={};cityPeopleFrame=-99;
  for(let tick=0;tick<4;tick++){frameCount+=30;refreshCityPeople(ownedMgr,0,0);}`);
ok(P('enemiesList.length===0'), 'repeated arcade refreshes keep captured blocks clear of guards and ambient civilians');
probe(`enemiesList=[];getBiomeState(1).cityPeople={};
  for(let n=0;n<6;n++)getBiomeState(1).cityPeople['0,0,people:'+n]={dead:true};
  frameCount+=30;refreshCityPeople(ownedMgr,0,0);`);
ok(P('enemiesList.length===0'), 'a guard-only refresh cannot bypass main fortress ownership');
probe(`getBiomeState(1).cityPeople['0,0,people:6']={x:900,y:900,hp:200,dead:false,stun:0,d:500};
  frameCount+=30;refreshCityPeople(ownedMgr,0,0);`);
ok(P('enemiesList.length===0'), 'an off-screen saved guard inside owned gates remains deferred');
ok(P('getBiomeState(1).cityPeople["0,0,people:6"].hp===200'), 'rejecting a saved guard preserves its existing resident state');
probe(`player.x=5700;player.y=600;viewLeft=5600;viewRight=5800;
  getBiomeState(1).cityPeople['0,0,people:6']={x:6200,y:600,hp:200,dead:false,stun:0,d:500};
  frameCount+=30;refreshCityPeople(ownedMgr,0,0);`);
ok(P('enemiesList.length===1&&enemiesList[0].isCityPatrol&&enemiesList[0].x===6200&&enemiesList[0].hp===200'), 'saved guards on unowned exterior ground retain their spawn and state');
probe(`enemiesList=[];window.towersDefeated=false;townsData={};outpostFortState(1).captured=true;
  ownedMgr.chunks=new Map([['6,9',{solid:[]}]]);getBiomeState(1).cityPeople={};
  player.x=7200;player.y=10800;viewLeft=7100;viewRight=7300;viewTop=10700;viewBottom=10900;
  for(let n=0;n<6;n++)getBiomeState(1).cityPeople['6,9,people:'+n]={dead:true};
  for(let tick=0;tick<4;tick++){frameCount+=30;refreshCityPeople(ownedMgr,6,9);}`);
ok(P('enemiesList.every(e=>!insideOwnedFortress(1,e.x,e.y,60))'), 'guard-only refreshes also protect the captured relay yard');
probe(`enemiesList=[];window.towersDefeated=true;ownedMgr.chunks=new Map([['0,0',{solid:[]}]]);
  player.x=600;player.y=600;`);
probe(`enemiesList=[];chunkPop.clear();popLosses.clear();window.savedSettlementRoster=settlementRoster;
  settlementRoster=()=>[{type:'NM0_ROOKIE',x:600,y:600},{type:'FARMER_MALE',x:620,y:600}];
  refreshPopulation(ownedMgr,0,0);settlementRoster=savedSettlementRoster;`);
ok(P('enemiesList.length===1&&enemiesList[0].isFriendly'), 'streamed checkpoint hostiles are rejected without losing neutral residents');

// The outpost's canceled waves are removed from its remaining battle count.
fresh();
probe(`player.x=7200;player.y=10800;triggerOutpostAmbush(outpostFortDef(1));
  window.liveMuster=enemiesList.filter(e=>e.isAmbush).length;
  for(const b of buildings)if(b.isTower&&b.isOutpost)b.hp=0;checkOutpostCaptured();`);
ok(P('outpostFortState(1).captured&&outpostFortState(1).musterWaves===0'), 'capture cancels its reinforcement order');
ok(P('outpostFortState(1).musterLeft===liveMuster&&nm0AmbushKills===liveMuster'), 'canceled waves cannot leave a phantom battle counter');
probe('window.musterBodies=enemiesList.length;outpostFortState(1).musterWaves=5;');
ok(!P('spawnFortWave()') && P('enemiesList.length===musterBodies'), 'even a stale wave budget cannot spawn in a captured fortress');
probe('triggerOutpostAmbush(outpostFortDef(1));frameCount=30;maintainOutpostGarrison();');
ok(P('enemiesList.length===musterBodies'), 'captured fortresses do not restart their muster or hostile garrison');
probe(`enemiesList=[];window.ambushFort={x:7200,y:10800};window.ambushKind='GATE';
  restoreFortMuster();`);
ok(P('enemiesList.length===0&&outpostFortState(1).musterDone&&!outpostFortState(1).musterOn'), 'reloading a captured fort does not rematerialize its old hostiles');
ok(P('!nm0AmbushActive&&window.fortMusterJustCleared'), 'captured-fort reload can finish its pending liberation beat');

// A separate ongoing sector fight must not be canceled by fort restoration.
probe(`outpostFortState(1).musterOn=true;outpostFortState(1).musterLeft=8;
  nm0AmbushActive=true;nm0AmbushKills=300;window.ambushKind='TOWER';
  window.ambushSpawnsRemaining=200;restoreFortMuster();`);
ok(P('nm0AmbushActive&&nm0AmbushKills===300&&window.ambushSpawnsRemaining===200'), 'captured-fort restoration preserves a distinct tower battle');

fresh();
probe(`player.x=7200;player.y=10800;triggerOutpostAmbush(outpostFortDef(1));
  for(const b of buildings)if(b.isTower&&b.isOutpost)b.hp=0;
  checkOutpostCaptured();saveGame();enemiesList=[];loadGame();`);
ok(P('outpostFortState(1).captured&&outpostFortState(1).musterDone&&!nm0AmbushActive'), 'a real captured-muster save/load settles the saved battle');
ok(P('enemiesList.every(e=>e.isFriendly||!insideOwnedFortress(1,e.x,e.y))'), 'real reload does not resurrect hostile occupants of the captured fortress');

fresh(3, false);
probe('outpostFortState(3).captured=true;player.x=outpostFortDef(3).x;player.y=outpostFortDef(3).y;');
for (let n = 0; n < 12; n++) {
  probe('spawnSingleEnemy();');
}
ok(P('enemiesList.length>0&&enemiesList.every(e=>!insideOwnedFortress(3,e.x,e.y,60))'), 'frontier enemies still spawn outside a captured biome fortress');
probe('window.outpostForts={};window.towersDefeated=false;townsData={};');
ok(P('newHostileCharacter(0,0,"ARMORED_STANDARD").x===0'), 'unowned ground keeps its original hostile coordinates');
console.log(`${checks} owned-fortress checks passed`);

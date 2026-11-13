// Gate fights suspend ambient actors without recording casualties, and keep
// their finite soldiers pursuing across the streamed world.
// Run: node tools/check-gate-ambush-isolation.js
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness');
const P = source => probe('(' + source + ')');
let checks = 0, seed = 76119, saved = null;
const timers = [];
function ok(label, condition) { assert.ok(condition, label); checks++; }
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const n = seed / 4294967296;
  if (a === undefined) return n;
  if (Array.isArray(a)) return a[(n * a.length) | 0];
  return b === undefined ? n * a : a + n * (b - a);
};
ctx.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
ctx.clearTimeout = () => {};
ctx.localStorage = { getItem: () => saved, setItem: (key, value) => { saved = value; }, removeItem: () => { saved = null; } };
ctx.console = { ...console, warn(...args) {
  console.warn(...args);
  if (String(args[0]).startsWith('frame fault in ')) throw args[1];
} };
function fresh(level = 1) {
  timers.length = 0;
  probe(`resetStoryProgress();townsData={};window.outpostForts={};biomeState={};
    isStoryMode=true;window.pendingEscortRoster=[];window.militaryToBringM=0;
    window.militaryToBringF=0;startAtLevel(${level});started=true;doTick=true;
    isDead=isWin=isPaused=killcamMode=false;inDarchonCall=false;darchonCallCompleted=true;
    inStoryIntro=inStoryRoom=inTownCutscene=inPostAmbushCutscene=inFortCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=false;
    inWorldBuildingMenu=inOverworldView=inTravelMenu=false;
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
    window.showOnScreenControls=false;
    viewLeft=player.x-600;viewRight=player.x+600;viewTop=player.y-400;viewBottom=player.y+400;`);
  timers.length = 0;
}
function flushArrivals() {
  const pending = timers.splice(0);
  for (const t of pending) t.fn();
}
// Use the real kill ledger and native delayed reinforcement callbacks. Other
// combat tests cover projectile contact; this test follows the finite roster.
probe(`function isolationKill(e) {
  e.hp=0;e.dead=true;
  processKill(e.x,e.y,false,e.eType,e.isFriendly,e,player);
  const i=enemiesList.indexOf(e);if(i>=0)enemiesList.splice(i,1);
}`);

console.log('== immediate purge preserves people and casualties ==');
fresh();
probe(`window.keepPopulation=enemiesList.find(e=>e.isPopulation);
  keepPopulation.hp=137;
  window.keepFreed=new Character(400,400,false,'NORMAL');keepFreed.isFriendly=true;
  keepFreed.isRecruit=true;keepFreed.hp=129;enemiesList.push(keepFreed);
  window.keepMilitary=new Character(500,400,false,'MILITARY_ALLY');
  keepMilitary.isFriendly=true;keepMilitary.isMilitary=true;keepMilitary.hp=173;
  enemiesList.push(keepMilitary);
  window.keepCombat=new Character(600,400,false,'NORMAL');keepCombat.isFriendly=true;
  keepCombat.isNeutral=false;keepCombat.hp=151;enemiesList.push(keepCombat);
  window.testCity=new Character(18000,18000,false,'CITY_CIVILIAN');
  cityAppearance(testCity,31);testCity.cityPersonKey='15,15,people:0';testCity.hp=63;
  enemiesList.push(testCity);
  window.testResident=new Character(18200,18000,false,'NM0_ROOKIE');
  testResident.hp=74;enemiesList.push(testResident);chunkPop.set('15,15',[testResident]);
  window.testRobot=new Character(18400,18000,false,'ROBOT');enemiesList.push(testRobot);
  townCitizens.push(new Citizen(500,500,'ARCHITECTURE'));
  window.beforeIsolation={count:globalPopulationCount(),lost:sectorLedger(1).popKilled,
    kills:totalKills,score,losses:Array.from(popLosses)};
  triggerGateAmbush(sectorGates().find(g=>g.y>0).y,false);`);
ok('a real breach starts isolation immediately', P('gateAmbushIsolated()'));
ok('ambient actors leave in the trigger call', P('!enemiesList.includes(testCity)&&!enemiesList.includes(testResident)&&!enemiesList.includes(testRobot)&&townCitizens.length===0'));
ok('native city wounds are banked as a living resident', P('getBiomeState(1).cityPeople[testCity.cityPersonKey].hp===63&&!getBiomeState(1).cityPeople[testCity.cityPersonKey].dead'));
ok('living checkpoint removal creates no settlement losses', P('!chunkPop.has("15,15")&&JSON.stringify(Array.from(popLosses))===JSON.stringify(beforeIsolation.losses)'));
ok('despawning creates no score or casualties', P('globalPopulationCount()===beforeIsolation.count&&sectorLedger(1).popKilled===beforeIsolation.lost&&totalKills===beforeIsolation.kills&&score===beforeIsolation.score'));
ok('finite population, freed recruits and combat allies retain identity and wounds', P('[keepPopulation,keepFreed,keepMilitary,keepCombat].every(e=>enemiesList.includes(e))&&keepPopulation.hp===137&&keepFreed.hp===129&&keepMilitary.hp===173&&keepCombat.hp===151'));
ok('all twenty opening soldiers are counted with 130 reserves', P('enemiesList.filter(e=>e.isAmbush).length===20&&nm0AmbushKills===150&&window.ambushSpawnsRemaining===130'));
ok('sector travel stays locked during the fight', P('!canTravel("SOUTH")'));

probe(`window.beforeRefresh=enemiesList.length;player.x=18000;player.y=18000;
  window.testMgr={biome:1,chunks:new Map([['15,15',{solid:[]}]])};
  for(let n=0;n<6;n++){frameCount+=45;refreshPopulation(testMgr,15,15);
    refreshCityPeople(testMgr,15,15);ensureCityRookiePatrols();maintainHostiles();
    spawnSingleEnemy();deployDirectivePopulation();}
  suspendGateOverworld();`);
ok('city streaming, rookie patrols, delayed replacements and departments stay absent', P('enemiesList.length===beforeRefresh&&townCitizens.length===0&&chunkPop.size===0'));

console.log('== native pursuit and distant reserve arrivals ==');
fresh();
probe(`BIOME_ACTIVE=false;buildings=[];activeBuildings=[];parkingCars=[];
  activeParkingCars=[];barrels=[];sealedSector=null;authoredCore=null;colGrid=null;colBig=[];
  player.x=0;player.y=0;enemiesList=[];nm0AmbushActive=true;nm0AmbushKills=3;
  window.gateAmbushLevel=1;window.gateAmbushFortIds=[];window.ambushSpawnsRemaining=0;
  window.testUnits=['ARMORED_STANDARD','ARMORED','AERIAL'].map((t,i)=>{
    const e=new Character(9000,200*i,false,t);e.isAmbush=true;e.state='CHASE';
    e.stunTimer=0;enemiesList.push(e);return e;});
  window.beforePursuit=testUnits.map(e=>Math.hypot(e.x,e.y));
  for(let n=0;n<120;n++){frameCount++;updateEntities();}`);
ok('real infantry, heavy and aerial AI advances from beyond 6000', P('testUnits.every((e,i)=>enemiesList.includes(e)&&e.state==="CHASE"&&Math.hypot(e.x,e.y)<beforePursuit[i]-100)'));
probe(`player.x=30000;player.y=28000;
  viewLeft=29400;viewRight=30600;viewTop=27600;viewBottom=28400;
  window.livePositions=testUnits.map(e=>({x:e.x,y:e.y}));
  window.ambushSpawnsRemaining=1;spawnAmbushReinforcement();
  window.newArrival=enemiesList[enemiesList.length-1];`);
ok('a reserve arrives near the distant player and outside the view', P('Math.hypot(newArrival.x-player.x,newArrival.y-player.y)<2200&&!inView(newArrival.x,newArrival.y,100)'));
ok('new arrivals never teleport existing soldiers', P('testUnits.every((e,i)=>e.x===livePositions[i].x&&e.y===livePositions[i].y)'));
probe('frameCount=180;cullDistantEnemies();');
ok('the world distance recycler keeps pursuing soldiers', P('testUnits.every(e=>enemiesList.includes(e))'));

console.log('== forest and frontier activity stays suspended ==');
fresh(2);
probe('window.animal=wildlifeSpawnAnimal(Object.keys(WILDLIFE_SPECIES)[0],player.x+300,player.y,null);');
ok('forest fixture contains a real animal before the breach', P('forestWildlife.length>0'));
probe(`triggerGateAmbush(sectorGates().find(g=>g.y>0).y,false);
  window.forestCount=enemiesList.length;
  for(let n=0;n<3;n++){frameCount+=45;updateForestWildlife();wildlifeSpawnEncounter();
    updateForestHuntingActivity();interactForestHuntingActivity();}
  deployDirectivePopulation();`);
ok('forest animals and hunting interaction are absent during the fight', P('forestWildlife.length===0&&!forestHuntingContext()&&_forestHuntingPrompt===null&&enemiesList.length===forestCount&&townCitizens.length===0'));
fresh(3);
probe(`window.bountyDef=FRONTIER_BOUNTY_DEFS[0];frontierBounties.activeId=bountyDef.id;
  frontierBountyRecord(bountyDef).stage='ACTIVE';player.x=bountyDef.x;player.y=bountyDef.y;
  updateFrontierBounties();window.bountyVictim=Array.from(_frontierBountyActors.values())[0];
  bountyVictim.hp=53;window.bountyBefore=frontierBountyRecord(bountyDef).killed.length;
  window.frontierWorker=enemiesList.find(e=>e.frontierResidentKey);
  window.fort=outpostFortDefs(3)[0];player.x=fort.x;player.y=fort.y;
  triggerOutpostAmbush(fort);
  window.frontierCount=enemiesList.length;
  for(let n=0;n<3;n++){frameCount+=45;spawnFrontierTownWorkers();updateFrontierBounties();
    maintainHostiles();deployDirectivePopulation();updateFrontierSaloonActivity();}`);
ok('a real bounty gang is banked without striking a poster', P('_frontierBountyActors.size===0&&frontierBountyRecord(bountyDef).killed.length===bountyBefore&&frontierBountyRecord(bountyDef).survivors[bountyVictim.frontierBountySlot].hp===53'));
ok('workers, bounty gangs, departments and side activities do not respawn', P('enemiesList.length===frontierCount&&townCitizens.length===0&&!frontierBountyContext()&&!frontierSaloonContext()&&(!frontierWorker||!enemiesList.includes(frontierWorker))'));

console.log('== relay objective cohorts and save restoration ==');
fresh();
probe(`window.fort=outpostFortDefs(1)[0];player.x=fort.x;player.y=fort.y;
  maintainFortGarrison(fort);window.garrison=enemiesList.filter(e=>e.isOutpostGarrison&&outpostFortMatches(e,fort));
  garrison[0].hp=91;triggerOutpostAmbush(fort);`);
ok('the breached objective keeps its live garrison and wounds', P('garrison.length>0&&garrison.every(e=>enemiesList.includes(e))&&garrison[0].hp===91'));
probe(`for(const b of buildings)if(b.isTower&&b.isOutpost&&outpostFortMatches(b,fort))b.hp=0;
  checkFortCaptured(fort);window.freedCount=garrison.length;
  garrison[0].hp=87;suspendGateOverworld();
  window.recruitIds=garrison.map(e=>e.fortRecruitId);`);
ok('freed relay recruits survive repeated isolation without healing', P('garrison.every(e=>enemiesList.includes(e)&&e.isFriendly&&e.isRecruit)&&garrison[0].hp===87'));
probe('saveGame();enemiesList=[];loadGame();');
ok('a real relay save reloads its fight and isolated objective', P('gateAmbushIsolated()&&outpostFortState(1,fort).musterOn&&(window.gateAmbushFortIds||[]).includes(outpostFortId(fort))&&enemiesList.some(e=>e.isAmbush&&e.outpostFortId===outpostFortId(fort))'));
ok('reloaded freed survivors retain their saved wound and pending count', P('enemiesList.filter(e=>e.isOutpostGarrison&&outpostFortMatches(e,fort)&&e.isRecruit).length===freedCount&&enemiesList.some(e=>e.isOutpostGarrison&&e.fortRecruitId===recruitIds[0]&&e.hp===87)'));

fresh();
probe('triggerGateAmbush(sectorGates().find(g=>g.y>0).y,false);saveGame();enemiesList=[];loadGame();');
ok('a main gate save restores with its towers still standing', P('gateAmbushIsolated()&&!window.towersDefeated&&sectorTowers().some(t=>t.hp>0)&&nm0AmbushKills===150&&enemiesList.some(e=>e.isAmbush)'));
ok('reload restores the exact live plus reserve budget', P('enemiesList.filter(e=>e.isAmbush&&!e.dead&&e.hp>0).length+window.ambushSpawnsRemaining===150'));
ok('restoring the main gate does not restore ambient rookies or citizens', P('enemiesList.every(e=>gateBattleActor(e))&&townCitizens.length===0'));

console.log('== missing bodies cannot grant an early clear ==');
for (const relay of [false,true]) {
  fresh();
  probe(relay ? `window.missingFort=outpostFortDef(1);player.x=missingFort.x;player.y=missingFort.y;
    triggerOutpostAmbush(missingFort);` : 'triggerGateAmbush(sectorGates().find(g=>g.y>0).y,false);');
  probe(`enemiesList=enemiesList.filter(e=>!e.isAmbush);window.ambushSpawnsRemaining=0;
    if(${relay})outpostFortState(1,missingFort).musterWaves=0;
    killcamMode=false;checkAmbushCleared();`);
  ok((relay?'relay':'main gate')+' re-forms an outstanding quota instead of awarding victory',
    P('gateAmbushIsolated()&&!killcamMode&&!window.nm0AmbushCleared&&nm0AmbushKills===150&&enemiesList.filter(e=>e.isAmbush).length===6&&window.ambushSpawnsRemaining===144'));
}

console.log('== every counted soldier is required before resume ==');
fresh();
probe('triggerGateAmbush(sectorGates().find(g=>g.y>0).y,false);');
let killed = 0;
while (killed < 149) {
  ok('an outstanding counted soldier exists', P('enemiesList.some(e=>e.isAmbush&&!e.dead&&e.hp>0)'));
  probe('isolationKill(enemiesList.find(e=>e.isAmbush&&!e.dead&&e.hp>0));');
  killed++;
  flushArrivals();
}
ok('149 real casualty records leave the final soldier and travel lock', P('nm0AmbushKills===1&&gateAmbushIsolated()&&!canTravel("SOUTH")&&!window.nm0AmbushCleared'));
probe('isolationKill(enemiesList.find(e=>e.isAmbush&&!e.dead&&e.hp>0));');
flushArrivals();
ok('the 150th kill clears the full objective with no reserves', P('nm0AmbushKills===0&&window.ambushSpawnsRemaining===0&&window.nm0AmbushCleared&&!enemiesList.some(e=>e.isAmbush&&!e.dead&&e.hp>0)'));
probe('killcamTimer=1;draw();updateEntities();');
ok('the native clear handoff resumes travel and ambient rookie patrols', P('!gateAmbushIsolated()&&!window.gateOverworldSuspended&&canTravel("SOUTH")&&enemiesList.some(e=>e.isExteriorPatrol)'));
ok('gate combat never credits an unconverted city population', P('poolLedger().popTotal===0&&!sectorLedger(1).popGranted&&sectorLedger(1).popKilled===0'));
console.log(`${checks}/${checks} gate isolation checks passed`);

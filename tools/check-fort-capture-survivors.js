// Fort masts free a cohort; the gate muster must finish before its survivors
// enter the Directive. Run: node tools/check-fort-capture-survivors.js
const assert = require('assert/strict');
const { ctx, probe } = require('./harness.js');
const P = source => probe('(' + source + ')');
let checks = 0, seed = 20261101, slot = null;
const timers = [];
const ok = (condition, label) => { assert.ok(condition, label); checks++; };
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[Math.floor(r * a.length)];
  return b === undefined ? r * a : a + r * (b - a);
};
ctx.setTimeout = fn => { timers.push(fn); return timers.length; };
ctx.clearTimeout = () => {};
ctx.localStorage = {
  getItem: () => slot,
  setItem: (key, value) => { slot = value; },
  removeItem: () => { slot = null; }
};

function fresh(level) {
  timers.length = 0;
  probe(`resetPopulation();resetStoryProgress();window.outpostForts={};
    isStoryMode=true;window.towersDefeated=false;startAtLevel(${level});
    started=true;doTick=true;isPaused=false;isWin=false;isDead=false;
    inTownCutscene=false;inPostAmbushCutscene=false;inFortCutscene=false;
    inStoryIntro=false;inStoryRoom=false;inDarchonCall=false;killcamMode=false;
    inWorldBuildingMenu=false;inOverworldView=false;nm0AmbushActive=false;
    nm0AmbushKills=0;window.ambushSpawnsRemaining=0;window.ambushFort=null;
    window.ambushKind=null;window.nm0AmbushCleared=false;
    enemiesList=[];townCitizens=[];window.testFort=outpostFortDef(currentBiome);
    player.x=testFort.x;player.y=testFort.y;frameCount=30;maintainFortGarrison(testFort);`);
  ok(P('enemiesList.filter(e=>e.isOutpostGarrison&&!e.dead).length===50'), 'fresh fort has exactly its own fifty guards');
}

function dropMasts() {
  probe(`for(const b of buildings)if(b.isTower&&b.isOutpost&&outpostFortMatches(b,testFort))b.hp=0;
    checkFortCaptured(testFort);`);
}

function loseGuards(count, friendly) {
  probe(`window.testLost=enemiesList.filter(e=>e.isOutpostGarrison&&outpostFortMatches(e,testFort)&&
      e.isFriendly===${friendly}&&!e.dead&&e.hp>0).slice(0,${count});
    for(const e of testLost){e.hp=0;e.dead=true;processKill(e.x,e.y,false,e.eType,e.isFriendly,e);}`);
}

// Exercise every original arrival and reserve through native kill bookkeeping.
function drainMuster() {
  let kills = 0;
  while (P('outpostFortState(currentBiome,testFort).musterOn') && kills < 1000) {
    probe(`window.testAmbusher=enemiesList.find(e=>e.isAmbush&&outpostFortMatches(e,testFort)&&!e.dead&&e.hp>0);
      if(!testAmbusher){spawnFortWave(testFort);testAmbusher=enemiesList.find(e=>e.isAmbush&&outpostFortMatches(e,testFort)&&!e.dead&&e.hp>0);}`);
    assert.ok(P('!!testAmbusher'), 'an outstanding fort muster always has a body or reserve to spawn: ' +
      JSON.stringify({ kills, state: P('(()=>{const s=outpostFortState(currentBiome,testFort);return {left:s.musterLeft,waves:s.musterWaves,on:s.musterOn};})()') }));
    probe('testAmbusher.hp=0;testAmbusher.dead=true;processKill(testAmbusher.x,testAmbusher.y,false,testAmbusher.eType,false,testAmbusher);');
    kills++;
    while (timers.length) timers.shift()();
  }
  ok(kills > 0 && kills < 1000 && P('outpostFortState(currentBiome,testFort).musterDone'), 'native enemy deaths fully complete the finite muster');
  // These are the battle-to-story flags normally consumed by the killcam.
  probe('nm0AmbushActive=false;killcamMode=false;window.ambushFort=null;checkFortCaptured(testFort);finishFortCapture();');
  return kills;
}

// Smaller fixtures focus on the survivor award after the native clear hook.
function completeMuster() {
  probe(`enemiesList=enemiesList.filter(e=>!(e.isAmbush&&outpostFortMatches(e,testFort)));
    nm0AmbushKills=0;window.ambushSpawnsRemaining=0;finishActiveFortMusters();
    nm0AmbushActive=false;killcamMode=false;window.ambushFort=null;
    checkFortCaptured(testFort);finishFortCapture();`);
}

console.log('== freed guards fight through the whole muster before joining departments ==');
fresh(1);
probe(`grantCitizens(POP_POOL,12,3);beginDirective(POP_POOL,'W');
  window.popFarmingM=4;window.popMilitaryM=3;window.popUnassignedM=5;storeWindowIntoLedger(POP_POOL);
  inWorldBuildingMenu=false;inOverworldView=false;`);
loseGuards(3, false);
probe('triggerOutpostAmbush(testFort);');
dropMasts();
ok(P('outpostFortState(1).freed&&!outpostFortState(1).captured&&!outpostFortState(1).rosterGranted'), 'masts free the cohort without capturing or paying the fort');
ok(P('outpostFortState(1).pendingRecruits.length===47&&enemiesList.filter(e=>e.isOutpostGarrison&&e.isFriendly&&!e.dead).length===47'), 'only the forty-seven spared guards enter its pending cohort');
ok(P('outpostFortState(1).musterLeft===150&&outpostFortState(1).musterWaves===120&&nm0AmbushKills===150&&window.ambushSpawnsRemaining===120'), 'masts preserve the full gate fight and all unspawned reserves');
ok(P('!inFortCutscene&&!inWorldBuildingMenu&&!cityRelayTerritoryUnlocked()&&outpostFortDefs(1).length===1'), 'the active battle opens neither the liberation scene nor owned territory or successor');
probe('window.fortCutsceneId="OUTPOST";finishFortCapture();openDirectiveWithGrant(1);');
ok(P('poolLedger().popTotal===15&&!outpostFortState(1).rosterGranted'), 'early completion and manual Directive access cannot award the pending fort');
probe('inWorldBuildingMenu=false;inOverworldView=false;');
loseGuards(7, true);
probe('processKill(testLost[0].x,testLost[0].y,false,testLost[0].eType,true,testLost[0]);');
ok(P('outpostFortState(1).pendingRecruits.length===40&&nm0AmbushKills===150'), 'seven ally losses count once without reducing the enemy objective');
probe(`window.testVisitor=new Character(testFort.x+100,testFort.y+200,false,'NORMAL');
  testVisitor.isFriendly=true;testVisitor.isRecruit=true;enemiesList.push(testVisitor);
  window.testCitizen=new Character(testFort.x+150,testFort.y+200,false,'FEMALE_PISTOL');
  testCitizen.isFriendly=true;testCitizen.isCityCivilian=true;enemiesList.push(testCitizen);
  window.testMilitary=new Character(testFort.x+200,testFort.y+200,false,'NORMAL');
  testMilitary.isFriendly=true;testMilitary.isMilitary=true;enemiesList.push(testMilitary);
  testVisitor.hp=0;testVisitor.dead=true;processKill(testVisitor.x,testVisitor.y,false,testVisitor.eType,true,testVisitor);`);
ok(P('outpostFortState(1).pendingRecruits.length===40&&poolLedger().popTotal===15'), 'unrelated recruits and civilians cannot change the fort cohort or its existing army');

console.log('== pending casualties, identity and battle survive save/load ==');
probe(`window.testKept=enemiesList.find(e=>e.isOutpostGarrison&&e.isFriendly&&!e.dead);
  testKept.hp=137;testKept.x+=81;testKept.y+=59;window.testKeptId=testKept.fortRecruitId;
  markSectorTowersDown(1);window.towersDefeated=true;sectorLedger(1).popGranted=true;
  townsData[1].established=true;saveGame();`);
const pendingSave = JSON.parse(slot);
ok(pendingSave.outpostForts[1].pendingRecruits.length === 40 && !pendingSave.outpostForts[1].rosterGranted, 'save banks forty pending survivors without a payout');
probe('window.outpostForts={};enemiesList=[];loadGame();window.testFort=outpostFortDef(1);');
ok(P('outpostFortState(1).freed&&!outpostFortState(1).captured&&outpostFortState(1).pendingRecruits.length===40'), 'reload preserves pending freedom and every previous casualty');
ok(P('enemiesList.filter(e=>e.isOutpostGarrison&&e.isFriendly&&!e.dead&&e.hp>0).length===40&&new Set(enemiesList.filter(e=>e.isOutpostGarrison&&e.isFriendly&&!e.dead).map(e=>e.fortRecruitId)).size===40'), 'reload restores exactly forty marked recruits after the main-sector enemy wipe');
ok(P('enemiesList.some(e=>e.isOutpostGarrison&&e.fortRecruitId===testKeptId&&e.hp===137)'), 'a restored cohort member retains damage and its casualty identity');
ok(P('nm0AmbushActive&&outpostFortState(1).musterOn&&outpostFortState(1).musterLeft===150&&enemiesList.some(e=>e.isAmbush&&e.outpostFortId==="OUTPOST")'), 'reload reforms the still-unbeaten fort fight');
loseGuards(2, true);
ok(P('outpostFortState(1).pendingRecruits.length===38&&poolLedger().popTotal===15'), 'new casualties after reload debit the pending cohort only');
ok(drainMuster() === 150, 'reload retains all 150 outstanding enemies rather than discarding the original live wave');
ok(P('outpostFortState(1).captured&&outpostFortState(1).rosterGranted&&poolLedger().popTotal===53'), 'exactly thirty-eight surviving men join the existing fifteen citizens');
ok(P('poolLedger().popFarmingM===4&&poolLedger().popMilitaryM===3&&poolLedger().popUnassignedM===43&&poolLedger().popUnassignedF===3'), 'the award preserves existing jobs and both genders');
probe('checkFortCaptured(testFort);finishFortCapture();openDirectiveWithGrant(1);saveGame();loadGame();');
ok(P('poolLedger().popTotal===53&&outpostFortState(1).rosterGranted'), 'repeated completion, Directive and reload never repay the cohort');

console.log('== towers before breach still require the gate muster ==');
fresh(3);
dropMasts();
ok(P('outpostFortState(3).freed&&!outpostFortState(3).captured&&!outpostFortState(3).breached&&!outpostFortState(3).musterOn&&!outpostFortState(3).musterDone'), 'dropping masts first does not invent a completed gate battle');
probe('openDirectiveWithGrant(3);window.fortCutsceneId="OUTPOST";finishFortCapture();');
ok(P('poolLedger().popTotal===0&&!outpostFortState(3).rosterGranted'), 'an unseeded sector Directive cannot count pending fort guards as sector survivors');
probe('inWorldBuildingMenu=false;inOverworldView=false;triggerOutpostAmbush(testFort);');
ok(P('outpostFortState(3).musterOn&&outpostFortState(3).musterLeft===150'), 'a later gate breach starts the full muster despite already-freed guards');
loseGuards(50, true);
completeMuster();
ok(P('outpostFortState(3).captured&&outpostFortState(3).rosterGranted&&poolLedger().popTotal===0'), 'zero survivors finish the fort and latch a zero award');
// The later sector's separate ambient grant is outside this zero-fort award.
// Mark it paid so regenerating its residents cannot change this fixture's pool.
probe('sectorLedger(3).popGranted=true;finishFortCapture();saveGame();loadGame();openDirectiveWithGrant(3);');
ok(P('poolLedger().popTotal===0&&outpostFortState(3).rosterGranted'), 'zero remains zero through repeated completion and reload');

console.log('== travel retains the female cohort and independent fort identities ==');
fresh(2);
loseGuards(2, false);
probe('triggerOutpostAmbush(testFort);');
dropMasts();
loseGuards(3, true);
probe('startAtLevel(3);startAtLevel(2);window.testFort=outpostFortDef(2);');
ok(P('outpostFortState(2).pendingRecruits.length===45&&enemiesList.filter(e=>e.isOutpostGarrison&&e.isFriendly&&!e.dead&&e.hp>0).length===45'), 'travel banks and restores precisely forty-five pending women');
loseGuards(2, true);
completeMuster();
ok(P('poolLedger().popTotal===43&&poolLedger().popUnassignedF===43&&poolLedger().popUnassignedM===0'), 'only the forty-three surviving women are awarded after returning');

fresh(1);
loseGuards(3, false);
probe('triggerOutpostAmbush(testFort);');
dropMasts();
probe('window.testPrimaryRecruit=enemiesList.find(e=>e.isOutpostGarrison&&e.isFriendly&&!e.dead);');
completeMuster();
ok(P('poolLedger().popTotal===47&&outpostFortState(1).rosterGranted&&outpostFortDefs(1).length===2'), 'primary completion pays forty-seven and unlocks the southwest relay');
probe(`inFortCutscene=false;inWorldBuildingMenu=false;inOverworldView=false;
  window.testFort=CITY_RELAY_SW;player.x=testFort.x;player.y=testFort.y;
  maintainFortGarrison(testFort);triggerOutpostAmbush(testFort);`);
dropMasts();
loseGuards(4, true);
probe('testPrimaryRecruit.hp=0;testPrimaryRecruit.dead=true;processKill(testPrimaryRecruit.x,testPrimaryRecruit.y,false,testPrimaryRecruit.eType,true,testPrimaryRecruit);');
ok(P('outpostFortState(1,"RELAY_SW").pendingRecruits.length===46&&!outpostFortState(1,"RELAY_SW").rosterGranted&&poolLedger().popTotal===47'), 'southwest casualties and a stale primary casualty never debit each other or pay early');
completeMuster();
ok(P('poolLedger().popTotal===93&&outpostFortState(1).rosterGranted&&outpostFortState(1,"RELAY_SW").rosterGranted'), 'each fort awards its own surviving cohort exactly once');
probe('finishFortCapture();saveGame();loadGame();');
ok(P('poolLedger().popTotal===93'), 'saving both completed forts never duplicates either award');

console.log('== captured legacy saves have already paid their garrison ==');
fresh(1);
probe(`grantCitizens(POP_POOL,15,0);var legacy=outpostFortState(1);
  legacy.captured=true;legacy.breached=true;legacy.garrison=0;
  legacy.towerHp=[0,0];legacy.musterDone=false;legacy.musterOn=false;
  inFortCutscene=true;fortPhase=4;
  saveGame();`);
const legacySave = JSON.parse(slot);
delete legacySave.outpostForts[1].rosterGranted;
delete legacySave.outpostForts[1].freed;
delete legacySave.outpostForts[1].pendingRecruits;
slot = JSON.stringify(legacySave);
probe('window.outpostForts={};loadGame();window.testFort=outpostFortDef(1);checkFortCaptured(testFort);finishFortCapture();');
ok(P('outpostFortState(1).rosterGranted&&poolLedger().popTotal===15'), 'old captured records migrate to paid without awarding again');
ok(P('!inFortCutscene&&outpostFortState(1).musterDone'), 'an old paid tower-only cutscene finishes without a null speaker or another award');

console.log(checks + ' fort survivor checks passed');

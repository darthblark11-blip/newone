// Real gate blasts, tower conversion, friendly casualties and ambush clears.
const assert = require('assert/strict');
const { ctx, probe } = require('./harness.js');
const P = s => probe('(' + s + ')');
let checks = 0, seed = 5107, slot = null;
const timers = [];
const ok = (name, condition) => { assert.ok(condition, name); checks++; };
ctx.random = function (a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  return b === undefined ? r * a : a + r * (b - a);
};
ctx.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
ctx.clearTimeout = () => {};
ctx.localStorage = { getItem: () => slot, setItem: (k, v) => { slot = v; }, removeItem: () => { slot = null; } };
ctx.console = { ...console, warn(...args) {
  console.warn(...args);
  if (String(args[0]).startsWith('frame fault in ')) throw args[1];
} };

function fresh(level) {
  timers.length = 0;
  probe(`resetStoryProgress(); window.outpostForts = {}; isStoryMode = true;
    startAtLevel(${level}); started = true; isPaused = false; isWin = false;
    inDarchonCall = false; darchonCallCompleted = true;
    inStoryIntro = false; inStoryRoom = false; doTick = true;
    leftStick = {active:false, dx:0, dy:0, base:{x:80, y:640}};
    rightStick = {active:false, dx:0, dy:0, dist:0, base:{x:1120, y:690}};
    window.showOnScreenControls = false;
    viewLeft = viewTop = -1e6; viewRight = viewBottom = 1e6;`);
}

// Keep the real victim, projectile and fatality paths; isolate the contact from
// geometry and other bodies so the assertions concern exactly one death.
probe(`function testFatalBullet(e, fromPlayer) {
  e.x = 20000; e.y = 20000; e.hp = 1; e.shield = 0;
  frameCount++; doTick = true;
  viewLeft = viewTop = -1e6; viewRight = viewBottom = 1e6;
  const b = new Bullet(); b.init(e.x - 10, e.y, 0, fromPlayer, "BODY", WEAPONS.PISTOL);
  b.vx = 10; b.vy = 0; bullets = [b]; updateBullets();
}`);

function walkCached() {
  return P(`(() => {
    const g = window.testGate;
    for (let y = g.y - g.h / 2 - 120; y <= g.y + g.h / 2 + 120; y += 20)
      if (player.checkCol(g.x, y)) return false;
    return true;
  })()`);
}

console.log('== destruction opens the road before the delayed ambush ==');
for (const [level, north] of [[1, false], [2, false], [2, true]]) {
  fresh(level);
  const label = `L${level} ${north ? 'north' : 'south'}`;
  probe(`window.testGate = sectorGates().find(b => ${north} ? b.y < 0 : b.y > 0);
    window.testGate.hp = 600;
    window.testWall = {x: testGate.x, y: testGate.y, w: 160, h: 160, isWall: true};
    window.testCar = {x: testGate.x, y: testGate.y + 100};
    window.testBarrel = {x: testGate.x, y: testGate.y - 100};
    buildings.push(testWall); parkingCars.push(testCar); barrels.push(testBarrel);
    activeBuildings = buildings.slice(); activeParkingCars = parkingCars.slice(); buildColIndex();
    player.x = testGate.x; player.y = testGate.y - testGate.h / 2 - 800;`);
  ok(label + ' is solid before destruction', !walkCached());
  probe('triggerExplosion(testGate.x, gateFaceY(testGate), 100, false, true);');
  ok(label + ' nonfatal damage leaves it closed', P('testGate.hp') === 300 && !P('gateIsOpen(testGate)'));
  probe('triggerExplosion(testGate.x, gateFaceY(testGate), 100, false, true);');
  ok(label + ' opens in the same blast call', P('testGate.hp') <= 0 && P('gateIsOpen(testGate)'));
  ok(label + ' has not needed to clear or start the ambush', !P('nm0AmbushActive') && !P('window.nm0AmbushClearedStatus'));
  ok(label + ' clears the existing collision cache immediately', walkCached());
  ok(label + ' removes approach debris from world and caches', P(`
    !buildings.includes(testWall) && !activeBuildings.includes(testWall) &&
    !parkingCars.includes(testCar) && !activeParkingCars.includes(testCar) && !barrels.includes(testBarrel)`));
  ok(label + ' preserves both wall wings', P('player.checkCol(testGate.x - 900, testGate.y) && player.checkCol(testGate.x + 900, testGate.y)'));
  ok(label + ' opens line of sight through the doorway', P('hasLOS(testGate.x, testGate.y - testGate.h / 2 - 80, testGate.x, testGate.y + testGate.h / 2 + 80)'));
  probe(`(() => {
    const b = new Bullet(); b.init(testGate.x, testGate.y - 10, HALF_PI, true, "BODY", WEAPONS.PISTOL);
    b.vx = 0; b.vy = 10; bullets = [b]; updateBullets(); window.testRound = b;
  })()`);
  ok(label + ' lets a real round cross the former barrier', P('testRound.active && testRound.l > 0'));
  const arrival = timers.find(t => t.ms === 2000);
  ok(label + ' still schedules its garrison', !!arrival);
  arrival.fn();
  ok(label + ' stays open during the ambush', P('nm0AmbushActive') && walkCached());
  if (level === 1) ok('L1 north still uses the HQ interaction', P('!gateIsOpen(sectorGates().find(b => b.y < 0))'));
  else ok(label + ' leaves the untouched opposite door closed', P(`!gateIsOpen(sectorGates().find(b => ${north} ? b.y > 0 : b.y < 0))`));
  probe('saveGame(); loadGame();');
  ok(label + ' breach survives a reload', P(`gateIsOpen(sectorGates().find(b => ${north} ? b.y < 0 : b.y > 0))`));
}

function capture(level, killedBefore) {
  fresh(level);
  probe(`for (const e of enemiesList.filter(e => e.isPopulation).slice(0, ${killedBefore})) testFatalBullet(e, true);
    for (const b of sectorTowers()) b.hp = 0;
    frameCount++; draw();`);
  ok('tower destruction converts the remaining roster', P(`enemiesList.filter(e => e.isPopulation && e.isRecruit && e.isFriendly && !e.dead && e.hp > 0).length`) === 80 - killedBefore);
  ok('tower destruction awards no citizens yet', P('poolLedger().popTotal') === 0 && !P('!!sectorLedger(currentLevel).popGranted'));
  probe('killcamTimer = 1; draw(); townPhase = 7; draw();');
  ok('the authored tower scene starts a real ambush', P('nm0AmbushActive && window.ambushKind === "TOWER"') && P('enemiesList.filter(e => e.isAmbush && !e.dead && e.hp > 0).length') === 100);
}

function loseRecruits(n) {
  probe(`for (const e of enemiesList.filter(e => e.isPopulation && e.isFriendly && !e.dead && e.hp > 0).slice(0, ${n})) testFatalBullet(e, false);`);
}

function finishFight(counterClear) {
  probe(`window.ambushSpawnsRemaining = 0;
    ${counterClear ? 'nm0AmbushKills = enemiesList.filter(e => e.isAmbush && !e.dead && e.hp > 0).length;' : ''}
    for (const e of enemiesList.filter(e => !e.dead && e.hp > 0 &&
      (${counterClear} ? e.isAmbush : !e.isFriendly && !e.isPopulation && !e.isOutpostGarrison && !e.cityPersonKey)))
      testFatalBullet(e, true);
    ${counterClear ? '' : 'checkAmbushCleared();'}`);
}

console.log('== post-conversion casualties reduce only the final award ==');
for (const level of [1, 2]) {
  capture(level, 20);
  probe('openDirectiveWithGrant(currentLevel); finishSectorRecruitment(); inWorldBuildingMenu = false; inOverworldView = false;');
  ok('an early Directive cannot grant or latch this sector', P('poolLedger().popTotal === 0 && !sectorLedger(currentLevel).popGranted'));
  loseRecruits(7);
  ok('seven freed ally deaths reduce the pending sixty to fifty-three', P('sectorSurvivorCount(currentLevel)') === 53 && P('sectorLedger(currentLevel).popKilled') === 27);
  ok('ally losses do not drain the NM0 counter', P('nm0AmbushKills') === 300);
  ok('the army remains unawarded during the fight', P('poolLedger().popTotal') === 0);
  probe('checkAmbushCleared();');
  ok('live enemies and reserves prevent an early award', !P('!!sectorLedger(currentLevel).popAmbushCleared'));
  finishFight(level === 1);
  ok('the actual clear grants exactly fifty-three survivors', P('window.nm0AmbushCleared && sectorLedger(currentLevel).popGranted') && P('poolLedger().popTotal') === 53);
  ok('the sector gender split is retained', P(`poolLedger().popUnassigned${level === 2 ? 'F' : 'M'}`) === 53);
  ok('the displayed army uses the final count', P('popTotal') === 53 && P('globalPopulation') === 53);
  probe('killcamTimer = 1; draw(); openDirectiveWithGrant(currentLevel);');
  ok('the cinematic and Directive do not pay a second award', P('poolLedger().popTotal') === 53);
  probe('saveGame(); loadGame(); openDirectiveWithGrant(currentLevel);');
  ok('a completed save does not pay again', P('poolLedger().popTotal') === 53);
}

console.log('== saving during the ambush retains losses and the existing army ==');
capture(2, 15);
probe(`grantCitizens(POP_POOL, 24, 0); beginDirective(POP_POOL, 'W');
  window.popFarmingM = 10; window.popMilitaryM = 8; window.popUnassignedM = 6;
  storeWindowIntoLedger(POP_POOL);`);
loseRecruits(5);
probe('saveGame();');
const saved = JSON.parse(slot);
ok('the pending seed and deaths are saved without an award', saved.townsData[2].popSeeded === 80 && saved.townsData[2].popKilled === 20 && !saved.townsData[2].popGranted);
probe('townsData = {}; enemiesList = []; loadGame();');
ok('reload restores exactly sixty marked recruits', P('enemiesList.filter(e => e.isPopulation && e.isRecruit && e.isFriendly && !e.dead && e.hp > 0).length') === 60);
ok('reload has not credited those recruits', P('poolLedger().popTotal') === 24 && !P('!!sectorLedger(2).popGranted'));
ok('reload retains the live fight', P('nm0AmbushActive && window.ambushKind === "TOWER"'));
loseRecruits(3);
ok('reloaded recruits still report new deaths', P('sectorSurvivorCount(2)') === 57);
finishFight(true);
ok('only the final fifty-seven join the existing army', P('poolLedger().popTotal') === 81 && P('poolLedger().popUnassignedF') === 57);
ok('existing assignments survive that award', P('poolLedger().popFarmingM === 10 && poolLedger().popMilitaryM === 8 && poolLedger().popUnassignedM === 6'));

console.log('== exact victims, unrelated people and zero survivors ==');
capture(1, 0);
probe(`window.testVictim = enemiesList.find(e => e.isPopulation && e.isFriendly);
  window.testOldBody = new Character(20000, 20000, false, "NORMAL");
  testOldBody.isPopulation = true; testOldBody.isFriendly = true; testOldBody.dead = true;
  testOldBody.hp = 0; testOldBody.populationDeathCounted = true;
  enemiesList.unshift(testOldBody); testFatalBullet(testVictim, false);
  processKill(testVictim.x, testVictim.y, false, testVictim.eType, true, testVictim);`);
ok('overlapping bodies count the actual victim once', P('sectorLedger(1).popKilled') === 1);
probe(`window.testVisitor = new Character(21000, 20000, false, "NORMAL");
  testVisitor.isFriendly = true; enemiesList.push(testVisitor); testFatalBullet(testVisitor, false);`);
ok('a non-roster ally is not deducted from the capture', P('sectorLedger(1).popKilled') === 1);
probe('triggerGateAmbush(sectorGates().find(b => b.y > 0).y, false);');
ok('a new breach does not heal or resurrect fallen recruits', P('testVictim.dead && testVictim.hp <= 0 && testOldBody.dead && testOldBody.hp === 0'));

capture(2, 12);
loseRecruits(68);
finishFight(true);
ok('losing every captured ally grants zero and latches the result', P('poolLedger().popTotal === 0 && sectorLedger(2).popGranted && sectorSurvivorCount(2) === 0'));
probe('saveGame(); loadGame(); openDirectiveWithGrant(2);');
ok('zero survivors remain zero after reload and Directive', P('poolLedger().popTotal === 0 && popTotal === 0 && popUnassigned === 0'));

fresh(1);
probe(`for (const e of enemiesList.filter(e => e.isPopulation).slice(0, 12)) testFatalBullet(e, true);
  saveGame(); loadGame();`);
ok('a reload before tower capture does not respawn the twelve dead people', P('enemiesList.filter(e => e.isPopulation && !e.dead && e.hp > 0).length') === 68);
probe(`nm0AmbushActive = true; window.ambushSpawnsRemaining = 0;
  enemiesList = enemiesList.filter(e => e.isPopulation); killcamMode = false; checkAmbushCleared();`);
ok('clearing a gate fight with the towers still up awards no unconverted people', P('poolLedger().popTotal === 0 && !sectorLedger(1).popGranted && !sectorLedger(1).popAmbushCleared'));

fresh(2);
probe(`window.nm0AmbushClearedStatus = true; markSectorTowersDown(2);
  recruitSectorSurvivors(); openDirectiveWithGrant(2);`);
ok('another sector\'s cleared status cannot award this sector', P('poolLedger().popTotal === 0 && !sectorLedger(2).popGranted'));
probe(`window.nm0AmbushCleared = true; window.ambushFort = outpostFortDef(2);
  finishSectorRecruitment();`);
ok('clearing an overworld fort cannot award the pending city roster', P('poolLedger().popTotal === 0 && !sectorLedger(2).popAmbushCleared'));
probe('window.ambushFort = null; window.fortMusterJustCleared = true; finishSectorRecruitment();');
ok('the fort\'s cinematic handoff also leaves the city award pending', P('poolLedger().popTotal === 0 && !sectorLedger(2).popGranted'));

console.log(`\n${checks}/${checks} gate and survivor checks passed`);

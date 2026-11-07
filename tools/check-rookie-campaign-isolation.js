// Exterior recruits keep their own campaign membership and never drain the
// original city population. Run real kill, breach, ambush-clear and HUD paths.
const assert = require('assert/strict');
const { ctx, probe } = require('./harness.js');
const P = s => probe('(' + s + ')');
let checks = 0, seed = 74183;
const ok = (name, value) => { assert.ok(value, name); checks++; };
ctx.random = function(a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  return b === undefined ? r * a : a + r * (b - a);
};
ctx.setTimeout = () => 0;
function fresh(level) {
  probe(`resetStoryProgress(); isStoryMode = true; startAtLevel(${level});
    started = true; isPaused = isDead = isWin = killcamMode = false;
    inStoryIntro = inStoryRoom = inDarchonCall = false; darchonCallCompleted = true;
    nm0AmbushActive = false; window.ambushFort = null; window.outpostForts = {};
    leftStick = {active:false, dx:0, dy:0, base:{x:80,y:640}};
    rightStick = {active:false, dx:0, dy:0, dist:0, base:{x:1120,y:690}};
    window.showOnScreenControls = false;`);
}
function barWidth() {
  const widths = [], previous = ctx.rect;
  ctx.rect = function(x, y, w, h, ...rest) {
    if (x === 20 && y === 55 && h === 5) widths.push(w);
    return previous(x, y, w, h, ...rest);
  };
  try { probe('drawUI();'); } finally { ctx.rect = previous; }
  return widths[1];
}
for (const level of [1, 2]) {
  fresh(level);
  const rookie = level === 1 ? 'NM0_ROOKIE' : 'NM0_ROOKIE_F';
  probe(`window.testIntake = new Character(22000, 22000, false, '${rookie}');
    testIntake.state = 'PATROL'; testIntake.loseSightTimer = 0;
    enemiesList.push(testIntake);
    window.testPopulation = enemiesList.find(e => e.isPopulation);`);
  ok(`L${level} independent rookie has no city ambush membership`, P('independentCityRookie(testIntake)'));
  const initialRatio = P('citySectorPopulationRatio()');
  const initialBar = barWidth();
  ok(`L${level} fresh finite population bar is full`, initialRatio === 1 && initialBar === 200);
  const before = P('({kills:totalKills,score,pop:sectorSurvivorCount(currentLevel),lost:sectorLedger(currentLevel).popKilled})');
  probe(`testIntake.dead = true; testIntake.hp = 0;
    processKill(testIntake.x, testIntake.y, true, testIntake.eType, false, testIntake);`);
  ok(`L${level} rookie kill still advances ordinary kill succession`, P('totalKills') === before.kills + 1);
  ok(`L${level} rookie headshot still pays its normal score`, P('score') > before.score);
  ok(`L${level} rookie kill preserves the original survivor ledger`,
    P('sectorSurvivorCount(currentLevel)') === before.pop && P('sectorLedger(currentLevel).popKilled') === before.lost);
  ok(`L${level} rookie kill preserves the displayed city population`, P('citySectorPopulationRatio()') === initialRatio && barWidth() === initialBar);
  probe(`processKill(testPopulation.x, testPopulation.y, false, testPopulation.eType, false, testPopulation);
    testPopulation.dead = true; testPopulation.hp = 0;`);
  ok(`L${level} original resident death reduces its own ledger`, P('sectorLedger(currentLevel).popKilled') === before.lost + 1);
  ok(`L${level} original resident death reduces the actual painted bar`, Math.abs(barWidth() - 200 * (before.pop - 1) / before.pop) < 1e-9);
  probe(`totalKills = 999;`);
  ok(`L${level} unrelated score progression cannot empty the city bar`, Math.abs(P('citySectorPopulationRatio()') - (before.pop - 1) / before.pop) < 1e-9);

  // With the city fight exhausted, offsite rookies are still alive and hostile.
  probe(`enemiesList = [new Character(22000, 22000, false, '${rookie}')];
    window.testIntake = enemiesList[0]; nm0AmbushActive = true; nm0AmbushKills = 7;
    window.ambushSpawnsRemaining = 0; window.nm0AmbushCleared = false;
    window.fortMusterJustCleared = false; window.ambushFort = null;
    killcamMode = false; checkAmbushCleared();`);
  ok(`L${level} untouched exterior intake cannot stall an exhausted city fight`, P('window.nm0AmbushCleared && nm0AmbushKills === 0'));

  // Explicit conscription is authoritative, even for exactly the same type.
  probe(`nm0AmbushActive = true; nm0AmbushKills = 1; killcamMode = false;
    window.nm0AmbushCleared = false; testIntake.isAmbush = true;
    checkAmbushCleared();`);
  ok(`L${level} explicitly enlisted rookie still blocks premature clear`, !P('window.nm0AmbushCleared') && P('nm0AmbushKills') === 1);
  const ambushKillBefore = P('totalKills');
  probe(`testIntake.dead = true; testIntake.hp = 0;
    processKill(testIntake.x, testIntake.y, false, testIntake.eType, false, testIntake);`);
  ok(`L${level} explicitly enlisted rookie drains the real ambush counter`, P('nm0AmbushKills') === 0 && P('window.nm0AmbushCleared'));
  ok(`L${level} conscripted ambush kills retain the existing ordinary-kill separation`, P('totalKills') === ambushKillBefore);

  fresh(level);
  probe(`window.testIntake = new Character(22000, 22000, false, '${rookie}');
    testIntake.state = 'PATROL'; testIntake.loseSightTimer = 0;
    enemiesList.push(testIntake); window.testPopulation = enemiesList.find(e => e.isPopulation);
    triggerGateAmbush(${level === 1 ? 5400 : 3000}, false);`);
  ok(`L${level} a gate breach leaves exterior rookie patrols on their own beat`, P('testIntake.state === "PATROL" && testIntake.loseSightTimer === 0 && !testIntake.isAmbush'));
  ok(`L${level} a gate breach still wakes the authored garrison`, P('testPopulation.state === "CHASE"'));

  // Old unseeded records read only tagged residents, never neutral townsfolk.
  probe(`townsData = {}; enemiesList = [testPopulation, testIntake]; testPopulation.dead = false;
    testPopulation.hp = 100;`);
  ok(`L${level} old unseeded save fallback counts only original tagged residents`, P('citySectorPopulationRatio()') === 1 / 80);
}

fresh(3);
probe(`window.testIntake = new Character(22000, 22000, false, 'NM0_ROOKIE');
  enemiesList = [testIntake]; nm0AmbushActive = true; nm0AmbushKills = 1;
  window.ambushSpawnsRemaining = 0; window.nm0AmbushCleared = false;
  checkAmbushCleared();`);
ok('other story biomes retain their existing hostile clear rules', !P('window.nm0AmbushCleared') && !P('independentCityRookie(testIntake)'));
ok('other story biomes retain their own population display behavior', P('citySectorPopulationRatio()') === null);
probe('currentLevel = 1; isStoryMode = false; checkAmbushCleared();');
ok('arcade retains its existing hostile clear rules', !P('window.nm0AmbushCleared') && !P('independentCityRookie(testIntake)'));
ok('arcade retains its ordinary kill-based bar', P('citySectorPopulationRatio()') === null);

fresh(1);
probe(`window.towersDefeated = true; window.militaryToBring = 0;
  window.militaryToBringM = window.militaryToBringF = 0;
  enemiesList = [];
  for (let i = 0; i < 4; i++) { const e = new Character(400 + i * 50, 500, false, 'NORMAL');
    e.isFriendly = true; enemiesList.push(e); }
  window.maxArmySize = 8; totalKills = 999;`);
ok('army population bar remains based on the existing army count', barWidth() === 100);
console.log(`${checks}/${checks} rookie campaign isolation checks passed`);

// Save/load round trip. The save is a flat snapshot of a very wide slice of
// game state, and the failure mode is always the same shape: something is
// written but never read back, or read back before startAtLevel() overwrites
// it. Both are invisible until a player reloads.
const { ctx, probe } = require('./harness.js');
const P = (s) => probe('(' + s + ')');
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  ' + x : '')); if (!c) fails++; };

// legacyStartAtLevel runs against p5's global RNG, so the constant stub the
// harness ships is useless for anything with a spawn ladder in it.
let seed = 4242;
ctx.random = function (a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  if (b === undefined) return r * a;
  return a + r * (b - a);
};
// A localStorage that actually stores.
let slot = null;
ctx.localStorage = { getItem: () => slot, setItem: (k, v) => { slot = v; }, removeItem: () => { slot = null; } };

const saved = () => JSON.parse(slot);

console.log('== the escort survives a reload ==');
probe(`isStoryMode = true; townsData = {1: {established: true}};
       window.southGateBreachedStatus = true;
       window.militaryToBring = 0; window.militaryToBringM = 0; window.militaryToBringF = 0;`);
probe('startAtLevel(1);');
probe('window.militaryToBringM = 18; window.militaryToBringF = 12;');
probe('window.travelArrival = "NORTH"; startAtLevel(2);');
ok('escort landed', P('enemiesList.filter(e => e.isMilitary && e.isFriendly).length') === 30);
probe('saveGame();');
ok('the live escort is folded into the save',
   saved().militaryToBringM + saved().militaryToBringF === 30,
   saved().militaryToBringM + '/' + saved().militaryToBringF);
probe('enemiesList = []; window.militaryToBringM = 0; window.militaryToBringF = 0; window.militaryToBring = 0;');
probe('loadGame();');
const back = P('enemiesList.filter(e => e.isMilitary && e.isFriendly).length');
ok('and comes back on the map', back === 30, back + ' of 30');
ok('beside the player',
   P('enemiesList.filter(e => e.isMilitary && Math.hypot(e.x-player.x, e.y-player.y) < 700).length') === back);
ok('and is not left pending, ready to spawn twice',
   P('window.militaryToBringM') === 0 && P('window.militaryToBringF') === 0);

console.log('\n== the world clock and the sky ==');
probe('worldTimeMs = 9.25 / 24 * DAY_MS; isRaining = true; lastWeatherRollHour = 9; applyBiomeWeather();');
const kindBefore = P('weather ? weather.kind : null');
probe('saveGame();');
probe('worldTimeMs = 0; isRaining = false; lastWeatherRollHour = -1; weather = null;');
probe('loadGame();');
ok('time of day is restored', Math.abs(P('worldHour()') - 9.25) < 0.01, P('worldHour()').toFixed(2));
ok('the rain is still falling', P('isRaining') === true);
ok('and the particle system matches it', P('weather ? weather.kind : null') === kindBefore, P('weather ? weather.kind : null'));
ok('the roll schedule is restored, not reset', P('lastWeatherRollHour') === 9, P('lastWeatherRollHour'));

console.log('\n== ambush state ==');
probe(`isStoryMode = true; townsData = {}; startAtLevel(3);
       farmAmbushActive = true; window.farmAmbushKills = 317; window.farmAmbushCleared = false;
       nm0AmbushActive = true; nm0AmbushKills = 88; window.ambushSpawnsRemaining = 41;
       window.ambushKind = "TOWER";`);
probe('saveGame();');
probe(`farmAmbushActive = false; window.farmAmbushKills = 0; nm0AmbushActive = false;
       nm0AmbushKills = 0; window.ambushSpawnsRemaining = 0; window.ambushKind = null;`);
probe('loadGame();');
ok('the bug swarm knows how many are left', P('window.farmAmbushKills') === 317, P('window.farmAmbushKills'));
ok('the bug swarm is still running', P('farmAmbushActive') === true);
ok('the NM-0 muster keeps its counter', P('nm0AmbushKills') === 88, P('nm0AmbushKills'));
ok('and its spawn budget, which is what lets it ever finish',
   P('window.ambushSpawnsRemaining') === 41, P('window.ambushSpawnsRemaining'));
ok('and which beat it belongs to', P('window.ambushKind') === "TOWER");

console.log('\n== cutscenes ==');
probe(`isStoryMode = true; townsData = {}; window.storyBeats = {}; startAtLevel(3);
       inFarmCutscene = true; farmPhase = 4; markStoryBeat("L0_PROLOGUE");`);
probe('saveGame();');
probe('inFarmCutscene = false; farmPhase = 0; window.storyBeats = {};');
probe('loadGame();');
ok('a cutscene saved mid-run comes back mid-run', P('inFarmCutscene') === true && P('farmPhase') === 4);
ok('and its speaker is re-cast rather than left null', P('farmSpeaker !== null') === true);
ok('completed beats are remembered', P('storyBeatDone("L0_PROLOGUE")') === true);

// The one that actually bit: every flag the replay guard keys off is cleared by
// the beat that follows the town scene.
console.log('\n== a finished cutscene does not replay ==');
probe(`isStoryMode = true; townsData = {2: {towersDown: true}}; window.storyBeats = {};
       startAtLevel(2); window.towersDefeated = true; markStoryBeat("L2_TOWN");
       window.nm0AmbushClearedStatus = true; window.nm0AmbushCleared = false;
       nm0AmbushActive = false; inTownCutscene = false; popTotal = 40;`);
probe('saveGame();');
probe('inTownCutscene = false; window.storyBeats = {};');
probe('loadGame();');
ok('the town scene stays watched', P('inTownCutscene') === false);

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

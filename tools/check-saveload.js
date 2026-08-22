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

// The overworld fortress is the widest thing the save carries that is not a
// scalar: what is left of its gate, its two masts and its garrison, and whether
// it is the player's. And it is the first thing in the save that the world is
// BUILT FROM rather than merely displayed -- ChunkManager makes the fort's
// solids out of this record the moment startAtLevel() runs, so a record read
// back one line too late is a fort that comes home shut, garrisoned and
// unbreached however hard the player fought for it.
console.log('\n== the overworld fortress ==');
probe(`isStoryMode = true; townsData = {}; window.outpostForts = {}; window.storyBeats = {};
       startAtLevel(1);`);
// Half way through taking it: the door is in, the muster is beaten, four of the
// garrison are down, and one mast is still standing.
probe(`const _fs = outpostFortState(1);
       _fs.breached = true; _fs.gateHp = 0; _fs.garrison = FORT_GARRISON - 4;
       _fs.towerHp = [0, FORT_TOWER_HP]; _fs.captured = false;`);
probe('saveGame();');
ok('the fort is written to the save', saved().outpostForts !== undefined &&
   saved().outpostForts[1] !== undefined, JSON.stringify(saved().outpostForts));
ok('with what is left of it, not just a flag',
   saved().outpostForts[1].garrison === P('FORT_GARRISON') - 4 &&
   saved().outpostForts[1].towerHp[0] === 0 &&
   saved().outpostForts[1].towerHp[1] === P('FORT_TOWER_HP'),
   JSON.stringify(saved().outpostForts[1]));

// Wipe it the way a fresh session would, and load.
probe('window.outpostForts = {};');
probe('loadGame();');
ok('the record comes back', P('outpostFortState(1).breached') === true &&
   P('outpostFortState(1).captured') === false);
ok('the garrison comes back at what the player left it',
   P('outpostFortState(1).garrison') === P('FORT_GARRISON') - 4,
   P('outpostFortState(1).garrison') + ' of ' + (P('FORT_GARRISON') - 4));

// AND THE WORLD IS BUILT FROM IT. This is the half that the ordering fault
// breaks: loadGame() restores the record and then calls startAtLevel(), which
// is what turns it into solids. Reading the record after that line leaves the
// world holding a fort nobody has touched.
ok('and the world is built from it: the gate is down',
   P('buildings.find(b=>b.isOutpostGate).hp') === 0,
   'gate hp ' + P('buildings.find(b=>b.isOutpostGate).hp'));
ok('one mast down, one still standing',
   P('buildings.filter(b=>b.isTower && b.isOutpost && b.hp <= 0).length') === 1 &&
   P('buildings.filter(b=>b.isTower && b.isOutpost && b.hp > 0).length') === 1,
   P('buildings.filter(b=>b.isTower && b.isOutpost).map(b=>b.hp)').join('/'));
ok('and its door is a road again', P('gateIsOpen(buildings.find(b=>b.isOutpostGate))') === true);

// The opposite ordering fault: a fort nobody has been near must not come back
// looking taken. This is the one the player saw -- a gate that loads blown.
console.log('\n== an untouched fort loads untouched ==');
probe(`isStoryMode = true; townsData = {}; window.outpostForts = {}; startAtLevel(1);`);
probe('saveGame();');
probe('window.outpostForts = {};');
probe('loadGame();');
ok('its record is clean', P('outpostFortState(1).breached') === false &&
   P('outpostFortState(1).captured') === false);
ok('its gate loads at full health', P('buildings.find(b=>b.isOutpostGate).hp') ===
   P('buildings.find(b=>b.isOutpostGate).maxHp'),
   P('buildings.find(b=>b.isOutpostGate).hp') + ' of ' + P('buildings.find(b=>b.isOutpostGate).maxHp'));
ok('and it loads SHUT', P('gateIsOpen(buildings.find(b=>b.isOutpostGate))') === false);
ok('both masts standing, garrison full',
   P('buildings.filter(b=>b.isTower && b.isOutpost && b.hp > 0).length') === 2 &&
   P('outpostFortState(1).garrison') === P('FORT_GARRISON'));

// An older save has no fortress in it at all. It must not come back captured,
// and it must not throw.
console.log('\n== a save written before the fortress existed ==');
probe('saveGame();');
{
  const old = JSON.parse(slot);
  delete old.outpostForts;
  slot = JSON.stringify(old);
}
probe('window.outpostForts = {};');
let threw = null;
try { probe('loadGame();'); } catch (e) { threw = e.message; }
ok('it loads without throwing', threw === null, threw || '');
ok('and the fort is simply untaken', P('outpostFortState(1).captured') === false &&
   P('outpostFortState(1).garrison') === P('FORT_GARRISON'));

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

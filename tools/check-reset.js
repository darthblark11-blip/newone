// Replacing a run must not bank its dead player or retain its world/effects.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness.js');
const P = s => probe('(' + s + ')');
let slot = null, checks = 0;
ctx.localStorage = { getItem: () => slot, setItem: (k, v) => { slot = v; }, removeItem: () => { slot = null; } };
const ok = (name, condition) => { assert(condition, name); checks++; console.log('  ok   ' + name); };
// Realistic map placement rather than the harness's constant RNG.
let seed = 1291;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  return b === undefined ? a * r : a + r * (b - a);
};
probe(`isStoryMode = false; isHardMode = true; window.farmLvl = 2;
       startAtLevel(2); player.hp = 123; player.shield = 72;
       window.resources = { WOOD: 17, METAL: 2, STONE: 3 }; saveGame();`);
const cleanSave = slot;
const corpse = `new Corpse(player.x, player.y, 0, 0, player.shirtCol, player.pantsCol,
                            0, 0, [], player.currentWeapon, 0, 'NORMAL', player.bodyW, player.bodyH, player)`;
ctx.__removed = 0; ctx.__stamps = 0;
probe(`const originalStamp = stampCorpse;
       stampCorpse = function(c) { window.__stamps++; return originalStamp(c); };`);
function dirtyRun() {
  probe(`useBloodBank(1); bloodChunks.old = { pg: { remove() { window.__removed++; } } };
         useBloodBank(3); bloodChunks.old = { pg: { remove() { window.__removed++; } } };
         corpses.push(${corpse}); player.hp = 0; player.dead = true; isDead = true;
         playerGrenades = [{}]; playerFlasks = [{}]; waterPuddles = [{}]; shockwaves = [{}];
         lightnings = [{}]; floatingScores = [{}]; isCooking = true; cookTime = 100;
         extraction = { phase: 3 }; window.travelArrival = 'SOUTH';
         inStoryIntro = true; inStoryRoom = true; inUpstairsRoom = true;
         inTravelMenu = true; window.inNM0SecretOverlay = true;
         buildGhost = {}; biomeState = { staleRun: true };
         playerStructures = [{x:999999,y:999999,w:200,h:200,isUBarrier:true,isPlayerBuilt:true,buildLevel:2}];
         window.farmLvl = 1; window.farmerBlueprintUnlocked = true;
         window.popUnassignedM = 12; window.popUnassignedF = 9;
         isHardMode = false;`);
}
function tap(y) {
  ctx.mouseX = P('width / 2'); ctx.mouseY = P('height / 2') + y;
  probe('touchStarted();');
}
console.log('== death load replaces the run ==');
for (let n = 0; n < 2; n++) {
  dirtyRun();
  tap(110);
  ok('load removes every previous blood bank, cycle ' + n,
     P('Object.keys(bloodBanks).length === 1 && Object.keys(bloodChunks).length === 0'));
  ok('old corpses were discarded without stamping', ctx.__stamps === 0 && P('corpses.length') === 0);
  ok('bank surfaces were released', ctx.__removed === (n + 1) * 2);
  ok('saved player and difficulty return alive', P('!isDead && !player.dead && started && player.hp === 123 && player.shield === 72 && isHardMode'));
  ok('farming maximum health is applied before player creation', P('player.maxHp === 125'));
  ok('old effects, travel and cutscene overlays are gone',
     P('!playerGrenades.length && !playerFlasks.length && !waterPuddles.length && !shockwaves.length && !lightnings.length && !floatingScores.length && !isCooking && !extraction && !inTravelMenu && !inStoryIntro && !inStoryRoom && !inUpstairsRoom && !window.inNM0SecretOverlay'));
  ok('saved resources replace old world deltas and construction',
     P('window.resources.WOOD === 17 && !biomeState.staleRun && !buildGhost && !playerStructures.length && !buildings.some(b => b.x === 999999)'));
}
console.log('== old save defaults do not inherit the previous run ==');
const old = JSON.parse(cleanSave);
for (const key of ['biomeState', 'townsData', 'farmLvl', 'farmerBlueprintUnlocked', 'isHardMode']) delete old[key];
slot = JSON.stringify(old);
dirtyRun(); probe('window.farmLvl = 2; loadGame();');
ok('missing upgrade and difficulty use fresh defaults', P('player.maxHp === 100 && window.farmLvl === 1 && !isHardMode'));
ok('missing world and blueprint data stay clean', P('!biomeState.staleRun && !window.farmerBlueprintUnlocked'));
console.log('== reset from death returns to a clean main menu ==');
slot = cleanSave; dirtyRun(); tap(160);
ok('reset clears death and leaves no old player', P('!started && !isDead && !isPaused && player === null'));
ok('reset clears all banks without preserving the dead player', P('!corpses.length && !Object.keys(bloodBanks).length && !Object.keys(bloodChunks).length') && ctx.__stamps === 0);
ok('reset clears persistent campaign, construction and upgrades', P('!Object.keys(biomeState).length && !Object.keys(townsData).length && !buildSites.length && !playerStructures.length && !window.farmerBlueprintUnlocked && window.farmLvl === 1 && window.resources.WOOD === 0'));
ok('reset empties the unassigned population buffer', P('window.popUnassignedM === 0 && window.popUnassignedF === 0'));
ok('reset preserves the stored save', slot === cleanSave);
probe('pendingLevel = 2; pendingStoryMode = false; beginSelectedRun();');
ok('starting again has no corpse or bank left from death', P('started && !isDead && !player.dead && !corpses.length && !Object.keys(bloodChunks).length'));
console.log('== pause reset uses the same clean path ==');
probe('isPaused = true; pauseMenuState = "MAIN"; window.lastPauseTime = -1000;'); tap(260);
ok('pause reset returns to a clean menu', P('!started && player === null && !Object.keys(bloodBanks).length'));
console.log('== absent or damaged saves preserve the current run ==');
probe('pendingLevel = 2; beginSelectedRun(); player.hp = 77;');
for (const invalid of [null, '{bad json', '{}', '{"currentLevel":99}']) {
  slot = invalid; probe('loadGame();');
  ok('invalid save does not destroy the current player: ' + invalid, P('started && player.hp === 77'));
}
console.log('== ordinary travel still preserves bodies ==');
probe(`corpses.push(${corpse}); startAtLevel(3);`);
ok('travel banks the corpse in the sector being left', ctx.__stamps === 1 && P('!!bloodBanks["2"] && Object.keys(bloodBanks["2"].chunks).length > 0'));
console.log(`${checks}/${checks} checks passed`);

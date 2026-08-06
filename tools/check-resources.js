// The resource loop end to end: something in the world is worth something, a
// swing takes it apart, the drop is collected, the total is spent-able and it
// survives a reload. Every link is a place the chain has silently broken before
// in this file — a flag set but never read, a key that renumbers, a drop nobody
// draws.
const { ctx, probe } = require('./harness.js');
const P = (s) => probe('(' + s + ')');
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  ' + x : '')); if (!c) fails++; };
let seed = 90210;
ctx.random = function (a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  if (b === undefined) return r * a;
  return a + r * (b - a);
};
let slot = null;
ctx.localStorage = { getItem: () => slot, setItem: (k, v) => { slot = v; }, removeItem: () => { slot = null; } };

console.log('== what the world is worth ==');
probe('authoredCore = null; authoredChunks = null; authoredMask = null; biomeState = {}; currentLevel = 2; currentBiome = 2; BIOME_ACTIVE = true;');
{
  const kinds = {};
  let trees = 0, girthLo = 99, girthHi = 0, yieldLo = 99, yieldHi = 0;
  for (let cx = -8; cx <= 8; cx++) for (let cy = -8; cy <= 8; cy++) {
    const ch = P(`generateChunkContent(2, ${cx}, ${cy})`);
    for (const sd of ch.solid) {
      ctx.__s = sd;
      const hv = P('harvestProfile(window.__s)');
      if (!hv) continue;
      kinds[hv.kind] = (kinds[hv.kind] || 0) + 1;
      if (sd.isTreeTrunk) {
        trees++;
        girthLo = Math.min(girthLo, sd.girth); girthHi = Math.max(girthHi, sd.girth);
        yieldLo = Math.min(yieldLo, hv.yield); yieldHi = Math.max(yieldHi, hv.yield);
      }
    }
  }
  console.log('   harvestable solids by kind: ' + JSON.stringify(kinds));
  ok('the woodland yields all three materials',
     kinds.WOOD > 0 && kinds.STONE > 0 && kinds.METAL > 0);
  ok('trees carry their canopy size', trees > 0 && girthHi > girthLo,
     `girth ${girthLo.toFixed(2)}..${girthHi.toFixed(2)}`);
  ok('and yield scales with it', yieldHi > yieldLo, `${yieldLo}..${yieldHi} wood`);
  ok('nothing yields an absurd amount', yieldHi <= 40, 'max ' + yieldHi);
}

console.log('\n== a swing takes it apart ==');
probe(`isStoryMode = false; townsData = {}; startAtLevel(2);
       window.resources = { WOOD: 0, METAL: 0, STONE: 0 };
       resourceDrops = []; window.pickaxeOwned = true; setMeleeTool("PICKAXE");`);
ok('the pickaxe is the equipped tool', P('meleeTool()') === "PICKAXE");
ok('and the sword flag follows it', P('window.swordEquipped') === false);
{
  // Plant a tree we control and chop it.
  probe(`window.__tree = { x: player.x + 60, y: player.y, w: 34, h: 34, isTreeTrunk: true, girth: 1.4, chunkKey: "9,9,3" };
         buildings.push(window.__tree); activeBuildings.push(window.__tree);`);
  const worth = P('harvestProfile(window.__tree).yield');
  const work  = P('harvestProfile(window.__tree).maxHp');
  console.log(`   the tree is worth ${worth} wood and takes ${Math.ceil(work / 100)} swings`);
  let swings = 0;
  while (P('buildings.indexOf(window.__tree)') > -1 && swings < 20) {
    probe('damageHarvestable(window.__tree, HARVEST_SWING.PICKAXE);');
    swings++;
  }
  ok('it comes down', P('buildings.indexOf(window.__tree)') === -1, swings + ' swings');
  ok('and leaves its wood on the ground', P('resourceDrops.length') > 0, P('resourceDrops.length') + ' bundles');
  ok('the bundles add up to the full yield',
     P('resourceDrops.reduce((a, d) => a + d.qty, 0)') === worth,
     P('resourceDrops.reduce((a, d) => a + d.qty, 0)') + ' of ' + worth);
  ok('it is remembered as destroyed, so it does not grow back',
     P('getBiomeState(2).destroyed["9,9,3"]') === true);
}

console.log('\n== the drop is collected ==');
probe('frameCount = 10; doTick = true;');
for (let f = 0; f < 90; f++) probe('frameCount++; updateResourceDrops();');
ok('walking over it banks the wood', P('resourceCount("WOOD")') > 0, P('resourceCount("WOOD")') + ' wood');
ok('and the ground is clear again', P('resourceDrops.length') === 0);

console.log('\n== a fist is not a tool ==');
{
  probe(`window.__rock = { x: player.x + 60, y: player.y, w: 120, h: 100, isBiomeProp: true, propType: "BOULDER" };
         buildings.push(window.__rock); activeBuildings.push(window.__rock);`);
  const hp0 = P('harvestProfile(window.__rock).maxHp');
  probe('damageHarvestable(window.__rock, HARVEST_SWING.NONE);');
  const afterFist = P('harvestProfile(window.__rock).hp');
  probe('damageHarvestable(window.__rock, HARVEST_SWING.PICKAXE);');
  const afterPick = P('harvestProfile(window.__rock).hp');
  ok('a bare hand barely marks stone', hp0 - afterFist <= 10, `${hp0 - afterFist} damage`);
  ok('a pick takes a real bite out of it', afterFist - afterPick >= 90, `${afterFist - afterPick} damage`);
}

console.log('\n== robots are salvage ==');
probe('resourceDrops = [];');
probe('processKill(player.x + 200, player.y, false, "ROBOT", false);');
{
  const q = P('resourceDrops.reduce((a, d) => a + (d.kind === "METAL" ? d.qty : 0), 0)');
  ok('a downed robot drops metal', q >= 5 && q <= 15, q + ' metal');
}

console.log('\n== it survives a reload ==');
probe('window.resources = { WOOD: 41, METAL: 12, STONE: 7 }; setMeleeTool("PICKAXE"); saveGame();');
probe('window.resources = { WOOD: 0, METAL: 0, STONE: 0 }; setMeleeTool("NONE");');
probe('loadGame();');
ok('the materials come back', P('resourceCount("WOOD")') === 41 && P('resourceCount("METAL")') === 12 &&
   P('resourceCount("STONE")') === 7,
   JSON.stringify(P('window.resources')));
ok('and so does the equipped tool', P('meleeTool()') === "PICKAXE");

// The art. Logic that works and a draw call that throws is still a broken
// feature, and neither the generation nor the render check covers a pickup or
// a tool in the player's hand.
console.log('\n== it draws ==');
probe('viewLeft = -100000; viewRight = 100000; viewTop = -100000; viewBottom = 100000;');
{
  let err = null;
  try {
    probe(`resourceDrops = [];
           for (const k of RESOURCE_KINDS) {
             spawnResourceDrop(player.x + 300, player.y + 300, k, 9);
           }`);
    // Far enough from the player that the magnet does not eat them mid-test.
    probe('for (let f = 0; f < 4; f++) { frameCount++; updateResourceDrops(); }');
  } catch (e) { err = e.message; }
  ok('every material draws as a pickup', err === null, err || P('resourceDrops.length') + ' on the ground');

  // setup() never runs in the harness, so the on-screen sticks Character.show()
  // reads do not exist. Stand them up rather than guarding the game code for a
  // condition that cannot happen in a browser.
  probe(`leftStick = { active: false, dx: 0, dy: 0, base: { x: 0, y: 0 } };
         rightStick = { active: false, dx: 0, dy: 0, dist: 0, base: { x: 0, y: 0 } };`);
  for (const tool of ["NONE", "SWORD", "PICKAXE"]) {
    let e2 = null;
    try {
      probe(`swordPickedUp = true; window.pickaxeOwned = true; setMeleeTool("${tool}");`);
      // Mid-swing and at rest, both hands, both combo branches.
      probe(`player.meleeTimer = 12; player.meleePhase = 2; player.isBackhand = false; player.show();
             player.meleePhase = 4; player.meleeTimer = 20; player.show();
             player.isBackhand = true; player.meleePhase = 2; player.meleeTimer = 8; player.show();
             player.meleeTimer = 0; player.meleePhase = 0; player.show();`);
    } catch (e) { e2 = e.message; }
    ok('the ' + tool + ' melee tool draws through a swing', e2 === null, e2 || '');
  }
}

// The arm swing used to hide the hand between two thresholds to fake depth,
// which deleted the weapon twice a stride and left an idle player (swing === 0)
// empty-handed. Count the geometry an equipped tool adds at every point of the
// cycle; if any point comes back at zero the tool has vanished again.
console.log('\n== the tool stays in hand ==');
{
  let geo = 0;
  const rect0 = ctx.rect, ell0 = ctx.ellipse, bs0 = ctx.beginShape;
  ctx.rect = () => { geo++; }; ctx.ellipse = () => { geo++; }; ctx.beginShape = () => { geo++; };
  const shapes = (tool, moving, phase) => {
    probe(`setMeleeTool("${tool}"); player.isArmed = false; player.meleeTimer = 0;
           player.meleePhase = 0; player.isMoving = ${moving}; player.walkCycle = ${phase};`);
    geo = 0; probe('player.show()'); return geo;
  };
  let worst = Infinity, worstAt = '';
  for (const tool of ['SWORD', 'PICKAXE']) {
    for (let i = 0; i <= 8; i++) {
      const moving = i < 8, ph = (i * Math.PI) / 4;
      const d = shapes(tool, moving, ph) - shapes('NONE', moving, ph);
      if (d < worst) { worst = d; worstAt = tool + (moving ? ' @ stride ' + i + '/8' : ' idle'); }
    }
  }
  ctx.rect = rect0; ctx.ellipse = ell0; ctx.beginShape = bs0;
  ok('an equipped melee tool never blinks out mid-stride or at rest',
     worst > 0, 'thinnest frame ' + worstAt + ' = +' + worst + ' shapes');
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

// Frame-time profiler. Runs the real update phases headlessly, under a load
// chosen to look like a bad moment in a firefight, and reports where the
// milliseconds actually go.
//
// The harness stubs the drawing API, so this measures LOGIC, not rasterising:
// AI, collision, projectile stepping, particle stepping, sorting, and the
// per-frame array churn behind them. That is exactly where the algorithmic
// problems live -- a draw call that is issued is the renderer's cost, but a
// draw call that should never have been issued is this file's business, so
// draw calls are counted as well as timed.
//
//   node tools/profile.js [frames] [level]
const { ctx, probe, calls } = require('./harness.js');

const FRAMES = +(process.argv[2] || 240);
const LEVEL = +(process.argv[3] || 2);

let seed = 90210;
ctx.random = function (a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  if (b === undefined) return r * a;
  return a + r * (b - a);
};

probe(`isStoryMode = false; townsData = {}; startAtLevel(${LEVEL}); started = true; doTick = true;`);
probe(`leftStick = { active: false, dx: 0, dy: 0, base: { x: 0, y: 0 } };
       rightStick = { active: false, dx: 0, dy: 0, dist: 0, base: { x: 0, y: 0 } };`);
// A camera-sized window, so culling behaves the way it does in play rather
// than passing everything.
probe(`camX = player.x; camY = player.y; zoom = 1;
       viewLeft = player.x - 700; viewRight = player.x + 700;
       viewTop = player.y - 500; viewBottom = player.y + 500;`);

// --- a busy frame ----------------------------------------------------------
// Numbers picked to sit at the top of what the game actually produces: the
// sector roster is 80, the particle cap is generous, and a firefight puts
// dozens of rounds in the air at once.
probe(`
  for (let i = enemiesList.length; i < 60; i++) {
    const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 900;
    const e = new Character(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r, false, "NORMAL");
    e.isArmed = true; enemiesList.push(e);
  }
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    spawnBullet(player.x + Math.cos(a) * 40, player.y + Math.sin(a) * 40, a, true, "BODY", WEAPONS.SMG, player);
  }
  for (let i = 0; i < 24; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 500;
    corpses.push(new Corpse(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r, a, a,
                 color(80), color(40), 0, 0, [], null, a, "NORMAL", 21, 27, null));
  }
  for (let i = 0; i < 200; i++) emit(player.x + (Math.random() - 0.5) * 800,
                                     player.y + (Math.random() - 0.5) * 600, 1, color(200), "SPARK");
`);

const has = (n) => probe(`typeof ${n} === 'function'`);
const PHASES = [
  ['updateActiveWorld', 'updateActiveWorld()'],
  ['updateEntities', 'updateEntities()'],
  ['updateBullets', 'updateBullets()'],
  ['updateParticles', 'updateParticles()'],
  ['updateCorpses', 'updateCorpses()'],
  ['updateOrbs', 'updateOrbs()'],
  ['sceneEmitters', 'sceneEmitters()'],
  ['drawDepthSorted', 'drawDepthSorted()'],
  ['drawBuildings', 'drawBuildings()'],
  ['drawBiomeProps', 'drawBiomeProps()'],
  ['drawBiomeShadows', 'drawBiomeShadows()'],
  ['chunk drawTerrain', 'chunkMgr && chunkMgr.drawTerrain()'],
  ['chunk drawDecor', 'chunkMgr && chunkMgr.drawDecor()'],
  ['drawCloudShadows', 'drawCloudShadows()'],
  ['drawGroundLots', 'drawGroundLots()'],
  ['drawBloodChunks', 'drawBloodChunks()'],
].filter(([n, e]) => has(e.split(/[ .(]/)[0]) || e.startsWith('chunkMgr'));

const t = {}, c = {};
for (const [name] of PHASES) { t[name] = 0; c[name] = 0; }

// Warm up, so the first-call cost of lazily built caches is not charged to the
// measurement -- that cost is real but it is a startup cost, not a frame cost.
for (let i = 0; i < 12; i++) for (const [, expr] of PHASES) { try { probe(expr); } catch (e) {} }

const t0 = process.hrtime.bigint();
for (let f = 0; f < FRAMES; f++) {
  probe(`frameCount++;`);
  for (const [name, expr] of PHASES) {
    const before = calls.shape + calls.fill + calls.img;
    const a = process.hrtime.bigint();
    try { probe(expr); } catch (e) { /* a phase this level does not run */ }
    t[name] += Number(process.hrtime.bigint() - a) / 1e6;
    c[name] += calls.shape + calls.fill + calls.img - before;
  }
}
const total = Number(process.hrtime.bigint() - t0) / 1e6;

const rows = PHASES.map(([n]) => [n, t[n] / FRAMES, c[n] / FRAMES]).sort((a, b) => b[1] - a[1]);
console.log(`\n${FRAMES} frames, level ${LEVEL}, ${probe('enemiesList.length')} enemies, ` +
            `${probe('bullets.length')} bullets, ${probe('particles.length')} particles, ` +
            `${probe('corpses.length')} corpses, ${probe('activeBuildings.length')} active solids\n`);
console.log('phase                 ms/frame    share   draw calls/frame');
for (const [n, ms, dc] of rows) {
  if (ms < 0.002 && dc < 1) continue;
  const bar = '#'.repeat(Math.min(30, Math.round(ms / (rows[0][1] || 1) * 30)));
  console.log(`${n.padEnd(20)} ${ms.toFixed(3).padStart(8)}  ${(100 * ms * FRAMES / total).toFixed(1).padStart(5)}%  ${dc.toFixed(0).padStart(6)}  ${bar}`);
}
console.log(`\nmeasured logic total: ${(total / FRAMES).toFixed(3)} ms/frame of the 16.6 ms budget`);

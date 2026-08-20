const { ctx, probe, calls } = require('./harness.js');
const P = (s) => probe('(' + s + ')');
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; if (!c) { fails++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + x : '')); } };

probe('seedWorldClock();');

// ---------------------------------------------------------------------------
// Live draw path: every prop the two sectors can produce, at four times of day
// so the sun-driven shadow helpers are exercised at both ends of their range.
// ---------------------------------------------------------------------------
const seen = new Set();
// Every streamed sector, not only the two authored ones. The outer sectors grew
// sub-biomes with their own set pieces, and a prop that no test ever draws is a
// prop nobody finds out is broken until they walk into it a kilometre from the
// nearest checkpoint.
for (const b of [1, 2, 3, 4, 5, 6, 7]) {
  probe(`authoredCore = null; authoredChunks = null; authoredMask = null; biomeState = {};
         currentLevel = ${b}; currentBiome = ${b}; BIOME_ACTIVE = true;`);
  // Wide enough to catch the rare landmarks -- a stone row turns up in roughly
  // one chunk in ninety, an impactor in one in forty, and a prop that is never
  // drawn is never tested.
  const all = [];
  const R = b === 2 ? 13 : b >= 3 ? 12 : 8;
  for (let cx = -R; cx <= R; cx++) for (let cy = -R; cy <= R; cy++) {
    const ch = P(`generateChunkContent(${b}, ${cx}, ${cy})`);
    for (const s of ch.solid) { all.push(s); if (s.propType) seen.add(s.propType); }
  }
  ctx.__all = all;
  probe('buildings = window.__all; activeBuildings = window.__all;');
  probe('viewLeft = -100000; viewRight = 100000; viewTop = -100000; viewBottom = 100000;');
  for (const hour of [2, 8, 13, 19]) {
    // updateSunVector() is what draw() runs before any of this; without it the
    // hour changes and the light does not, which would make this whole sweep
    // four copies of one test.
    probe(`worldTimeMs = ${hour} / 24 * DAY_MS; updateSunVector();`);
    for (const fn of ['drawBiomeProps()', 'drawBiomeShadows()', 'drawBiomeDecks()',
                      'drawGroundLots()', 'drawBuildings()', 'sceneEmitters()']) {
      let err = null;
      try { probe(fn); } catch (e) { err = e.message; }
      ok(`biome ${b} ${hour}:00 ${fn}`, err === null, err || '');
    }
  }
}
console.log('   prop types drawn: ' + Array.from(seen).sort().join(' '));

// ---------------------------------------------------------------------------
// AND THE LIVE PASS ACTUALLY READS THE SUN.
// The bake is pinned to a reference vector (check-generation proves that), so
// the danger at this end is the opposite one: a travelling sun that nothing
// live picks up. calls.sig is a rolling hash of every coordinate drawn, so a
// shadow landing somewhere else changes it -- which a call count cannot see.
// ---------------------------------------------------------------------------
console.log('\n== the live pass reads the travelling sun ==');
{
  const drawAt = (h) => {
    probe(`worldTimeMs = ${h} / 24 * DAY_MS; updateSunVector();`);
    calls.sig = 0;
    probe('drawBiomeShadows(); drawBiomeProps(); drawBuildings();');
    return calls.sig;
  };
  const morning = drawAt(9), noon = drawAt(12), evening = drawAt(16);
  ok('a morning scene and an afternoon one are not the same picture',
     morning !== evening, morning + ' vs ' + evening);
  ok('and midday is its own', noon !== morning && noon !== evening);
  // The projection is the CAMERA and the shadow is the SUN, and the whole scene
  // only reads as solid when those two disagree. Moving the sun must not move
  // the lean, or every building goes back to leaning the way its shadow falls.
  const leanAt = (h) => P(`(() => {
    worldTimeMs = ${h} / 24 * DAY_MS; updateSunVector();
    width = 1200; height = 800; zoom = 1; camX = -600; camY = -400;
    const o = [0, 0]; massLean(400, 250, 20, o); return o.join(',');
  })()`);
  ok('the lean is the camera and does not move with the sun',
     leanAt(8) === leanAt(17), leanAt(8) + ' | ' + leanAt(17));
}

// Every propType the generators emit must have a branch in drawBiomeProps,
// otherwise it is a solid with no art -- an invisible wall.
const src = require('fs').readFileSync(process.env.GAME_JS || __dirname + '/../game.js','utf8');
const cases = new Set();
// drawBiomeProps dispatches on a switch; drawBiomeDecks on an if-chain, because
// a deck is drawn in the ground stack rather than with the standing props.
for (const l of src.split('function drawBiomeProps')[1].split(/\n}\n/)[0].split('\n')) {
  const m = l.match(/^\s*case "([A-Z]+)":/); if (m) cases.add(m[1]);
}
for (const m of src.split('function drawBiomeDecks')[1].split(/\n}\n/)[0].matchAll(/propType === "([A-Z]+)"/g)) {
  cases.add(m[1]);
}
const invisible = Array.from(seen).filter(t => !cases.has(t));
console.log('   deliberately invisible (collision only): ' + invisible.join(' '));
ok('the only art-less props are the water volumes',
   invisible.every(t => t === 'RIVER' || t === 'CANAL'), invisible.join(','));

// ---------------------------------------------------------------------------
// Hybrid sector: an authored core in the middle, streamed chunks around it.
// The taper is what stops a river or a road running across the story map.
// ---------------------------------------------------------------------------
console.log('\n== hybrid core ==');
ctx.__core = new Set();
for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) ctx.__core.add(i + ',' + j);
probe(`authoredChunks = window.__core;
       authoredCore = { x0: -2400, y0: -2400, x1: 3600, y1: 3600, rx0: -2300, ry0: -2300, rx1: 3500, ry1: 3500 };
       authoredMask = new Map(); biomeState = {}; currentLevel = 2; currentBiome = 2;`);
ok('taper is zero inside the core', P('coreTaperX(0, 0, 600)') === 0 && P('coreTaperY(0, 0, 600)') === 0);
ok('taper eases in beside the core',
   P('coreTaperX(3, 0, 3600)') < 0.05 && P('coreTaperX(3, 0, 4200)') > 0.9,
   `${P('coreTaperX(3, 0, 3600)').toFixed(2)} .. ${P('coreTaperX(3, 0, 4200)').toFixed(2)}`);
ok('taper is 1 well away from any core', P('coreTaperX(20, 20, 24600)') === 1);
let coreEmpty = true, ringOk = true, bakeErr = null;
for (let cx = -3; cx <= 3; cx++) for (let cy = -3; cy <= 3; cy++) {
  const ch = P(`generateChunkContent(2, ${cx}, ${cy})`);
  const inCore = Math.abs(cx) <= 2 && Math.abs(cy) <= 2;
  if (inCore && ch.solid.length) coreEmpty = false;
  // no water may be generated in a chunk whose taper has already reached zero
  for (const s of ch.solid) {
    if ((s.propType === 'RIVER' || s.propType === 'CANAL') && P(`coreTaperX(${cx}, ${cy}, ${s.x})`) < 0.4) ringOk = false;
  }
  try { ctx.__d = ch.decorBake; probe(`bakeChunkTerrain(2, ${cx}, ${cy}, window.__d)`); }
  catch (e) { bakeErr = `(${cx},${cy}) ${e.message}`; }
}
ok('the streamer contributes nothing inside the authored core', coreEmpty);
ok('no water is left standing where the taper has closed it off', ringOk);
ok('chunks around a core bake without throwing', bakeErr === null, bakeErr || '');

// Water collision and the water the bake actually paints must describe the
// same thing. An invisible wall beside the authored core is the failure this
// guards: the taper closes the channel in the bake, and collision has to close
// with it.
console.log('\n== water agrees with its own bake ==');
{
  // Park the fake authored core on a row that genuinely carries a canal, or
  // the test proves nothing.
  let row = null;
  for (let cy = -60; cy <= 60 && row === null; cy++) if (P(`cityHasCanal(1, ${cy})`)) row = cy;
  ctx.__core2 = new Set();
  for (let i = -2; i <= 2; i++) for (let j = row - 2; j <= row + 2; j++) ctx.__core2.add(i + ',' + j);
  probe('authoredChunks = window.__core2; currentLevel = 1; currentBiome = 1; biomeState = {};');
  console.log(`   core straddles canal row ${row}`);
  let bad = 0, canalChunks = 0;
  for (let cx = -6; cx <= 6; cx++) for (let cy = row - 3; cy <= row + 3; cy++) {
    const ch = P(`generateChunkContent(1, ${cx}, ${cy})`);
    const water = ch.solid.filter(s => s.propType === 'CANAL');
    const deck  = ch.solid.find(s => s.propType === 'CANALBRIDGE');
    if (water.length) canalChunks++;
    for (const w of water) if (P(`coreTaperX(${cx}, ${cy}, ${w.x})`) < 0.4) bad++;
    if (deck && P(`coreTaperX(${cx}, ${cy}, ${deck.x})`) <= 0.5) bad++;
  }
  ok('no canal collision survives where the bake has tapered the water away', bad === 0, bad + ' volumes');
  console.log(`   ${canalChunks} canal chunks around the core`);
}
console.log(`\n${checks - fails}/${checks} checks passed (final)`);
process.exit(fails ? 1 : 0);

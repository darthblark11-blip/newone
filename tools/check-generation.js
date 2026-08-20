const { ctx, probe, mkG } = require('./harness.js');
let fails = 0, checks = 0;
const ok = (name, cond, extra) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL ' + name + (extra !== undefined ? '  ' + extra : '')); }
};
const P = (src) => probe('(' + src + ')');
const CW = P('CHUNK_W');

// Pure streamed biome: no authored core, so the travel anchors exist.
probe('authoredCore = null; authoredChunks = null; authoredMask = null; biomeState = {}; currentLevel = 2; BIOME_ACTIVE = true; currentBiome = 2;');

const gen = (b, cx, cy) => P(`generateChunkContent(${b}, ${cx}, ${cy})`);

// ---------------------------------------------------------------- determinism
console.log('\n== determinism ==');
for (const [b, cx, cy] of [[1,0,0],[1,3,-2],[1,-5,7],[2,0,0],[2,4,1],[2,-3,-6],[2,11,5]]) {
  const a = JSON.stringify(gen(b,cx,cy));
  probe('biomeState = {};');
  const c = JSON.stringify(gen(b,cx,cy));
  ok(`chunk (${b},${cx},${cy}) regenerates identically`, a === c);
}

// ------------------------------------------------------------------- network
console.log('\n== network shape ==');
let trunks = 0, links = 0, rivers = 0, canals = 0, trams = 0;
for (let i = -400; i < 400; i++) {
  if (P(`woodHasTrunk(2, ${i})`)) trunks++;
  if (P(`woodHasLink(2, ${i})`))  links++;
  if (P(`woodHasRiver(2, ${i})`)) rivers++;
  if (P(`cityHasCanal(1, ${i})`)) canals++;
  if (P(`cityHasTram(1, ${i})`))  trams++;
}
console.log(`   trunk columns ${(trunks/8).toFixed(1)}%  link rows ${(links/8).toFixed(1)}%  river rows ${(rivers/8).toFixed(1)}%`);
console.log(`   canal rows ${(canals/8).toFixed(1)}%  tram streets ${(trams/8).toFixed(1)}%`);
ok('trunks are sparse, not every column', trunks/800 > 0.3 && trunks/800 < 0.55, (trunks/800).toFixed(3));
ok('some rows carry links', links/800 > 0.2 && links/800 < 0.4, (links/800).toFixed(3));
ok('some rows carry rivers', rivers/800 > 0.15 && rivers/800 < 0.33, (rivers/800).toFixed(3));
ok('rivers and links never share a row',
   !Array.from({length:800},(_,k)=>k-400).some(i => P(`woodHasRiver(2,${i}) && woodHasLink(2,${i})`)));
ok('column 0 always carries the trunk the anchors sit on', P('woodHasTrunk(2, 0)') === true);

// --------------------------------------------------------------------- seams
console.log('\n== seams ==');
for (let cx = -4; cx <= 4; cx++) {
  for (const wy of [-3600, -1200, 0, 1200, 4800]) {
    const a = P(`woodTrailX(2, ${cx}, ${wy})`);
    const b = P(`woodTrailX(2, ${cx}, ${wy})`);
    ok('trunk centreline is a pure function of column and world y', a === b);
  }
}
for (let cy = -4; cy <= 4; cy++) {
  if (!P(`woodHasRiver(2, ${cy})`)) continue;
  for (let cx = -3; cx <= 3; cx++) {
    const bx = (cx + 1) * CW;                       // the seam these two share
    const fromWest = P(`woodRiverY(2, ${cy}, ${bx})`);
    const fromEast = P(`woodRiverY(2, ${cy}, ${bx})`);
    ok(`river meets itself at the x seam (row ${cy})`, Math.abs(fromWest - fromEast) < 1e-9);
    // and never leaves its own row, banks included
    let lo = Infinity, hi = -Infinity;
    for (let x = cx * CW; x <= (cx + 1) * CW; x += 25) {
      const y = P(`woodRiverY(2, ${cy}, ${x})`), h = P(`woodRiverHalf(2, ${cy}, ${x})`);
      lo = Math.min(lo, y - h * 1.30); hi = Math.max(hi, y + h * 1.30);
    }
    ok(`river stays inside row ${cy}`, lo > cy * CW + 40 && hi < (cy + 1) * CW - 40,
       `[${(lo - cy*CW).toFixed(0)}..${(hi - cy*CW).toFixed(0)}] of 0..${CW}`);
  }
}

// ----------------------------------------------------------------- crossings
console.log('\n== crossings ==');
let nBridge = 0, nFord = 0;
for (let cy = -30; cy <= 30; cy++) {
  if (!P(`woodHasRiver(2, ${cy})`)) continue;
  for (let cx = -30; cx <= 30; cx++) {
    const c = P(`woodCrossing(2, ${cx}, ${cy})`);
    if (!c) { ok(`no crossing implies no trunk (${cx},${cy})`, !P(`woodHasTrunk(2,${cx})`)); continue; }
    c.ford ? nFord++ : nBridge++;
    // the solve has to land on BOTH curves, or the deck misses the road
    ok(`crossing sits on the trunk (${cx},${cy})`, Math.abs(P(`woodTrailX(2,${cx},${c.y})`) - c.x) < 1.5);
    ok(`crossing sits on the river (${cx},${cy})`, Math.abs(P(`woodRiverY(2,${cy},${c.x})`) - c.y) < 1.5);
    ok(`crossing is inside its own chunk (${cx},${cy})`, c.x > cx*CW + 60 && c.x < (cx+1)*CW - 60);
  }
}
console.log(`   ${nBridge} bridges, ${nFord} fords over ${nBridge+nFord} crossings`);
ok('both grades of crossing occur', nBridge > 0 && nFord > 0);

// ------------------------------------------- river solids vs the way across
console.log('\n== river gap and deck ==');
let riverRowsTested = 0;
for (let cy = -20; cy <= 20 && riverRowsTested < 6; cy++) {
  if (!P(`woodHasRiver(2, ${cy})`)) continue;
  for (let cx = -6; cx <= 6; cx++) {
    const c = P(`woodCrossing(2, ${cx}, ${cy})`);
    if (!c || c.ford) continue;
    const ch = gen(2, cx, cy);
    const deck = ch.solid.find(s => s.propType === 'BRIDGE');
    if (!deck) continue;
    riverRowsTested++;
    ok(`deck spans the whole channel (${cx},${cy})`,
       deck.h / 2 > P(`woodRiverHalf(2,${cy},${c.x})`) * 1.30,
       `${(deck.h/2).toFixed(0)} vs ${(P(`woodRiverHalf(2,${cy},${c.x})`)*1.3).toFixed(0)}`);
    const blocked = ch.solid.filter(s => s.propType === 'RIVER' &&
      Math.abs(s.x - deck.x) < (s.w + deck.w) / 2 && Math.abs(s.y - deck.y) < (s.h + deck.h) / 2);
    ok(`nothing blocks the deck (${cx},${cy})`, blocked.length === 0, blocked.length + ' segments');
    ok('deck is walkable', deck.isDeck === true);
    break;
  }
}
ok('found bridges to test', riverRowsTested > 0);

// --------------------------------------------------------------- city canal
console.log('\n== city canal ==');
probe('authoredCore = null; authoredChunks = null; authoredMask = null; biomeState = {}; currentLevel = 1; currentBiome = 1;');
let canalTested = 0;
for (let cy = -20; cy <= 20 && canalTested < 5; cy++) {
  if (!P(`cityHasCanal(1, ${cy})`)) continue;
  const cx = (cy * 7) % 11;
  const ch = gen(1, cx, cy);
  const water = ch.solid.filter(s => s.propType === 'CANAL');
  const deck  = ch.solid.find(s => s.propType === 'CANALBRIDGE');
  if (!water.length) continue;
  canalTested++;
  const oy = cy * CW, ox = cx * CW;
  const lo = Math.min(...water.map(s => s.y - s.h / 2)) - P('CITY_QUAY');
  const hi = Math.max(...water.map(s => s.y + s.h / 2)) + P('CITY_QUAY');
  ok(`canal keeps a terrace on both banks (row ${cy})`, lo > oy + 165 + 60 && hi < oy + 1035 - 60,
     `[${(lo-oy).toFixed(0)}..${(hi-oy).toFixed(0)}] inside 165..1035`);
  ok(`canal is bridged at the street (row ${cy})`, !!deck && deck.isDeck === true);
  const nearW = water.filter(s => Math.abs(s.x - ox) < P('CITY_BRIDGE_HALF'));
  const nearE = water.filter(s => Math.abs(s.x - (ox + CW)) < P('CITY_BRIDGE_HALF'));
  ok(`both street crossings are left open (row ${cy})`, nearW.length === 0 && nearE.length === 0,
     `${nearW.length}/${nearE.length}`);
  ok('canal water does not stop bullets', water.every(s => s.isRiver === true));
}
ok('found canal rows to test', canalTested > 0);

// ---------------------------------------------------------------------------
// SUB-BIOMES
// Five layouts resolve a landscape from world position. What can go wrong is
// not that the arithmetic throws -- it is that a threshold lands somewhere the
// noise never reaches, so a region exists in the source and nowhere in the
// world, or that one region swallows the sector and the other four are
// rounding error. Neither is visible until you have walked a kilometre.
// ---------------------------------------------------------------------------
console.log('\n== sub-biomes ==');
const REGIONS = {
  WOODLAND: [2, 'woodRegion',    ['MEADOW','TIMBER','MARSH','HEATH','BURN','FARM']],
  JUNGLE:   [4, 'jungleRegion',  ['CANOPY','SWAMP','CLEARING','BAMBOO','CORDON']],
  TUNDRA:   [5, 'tundraRegion',  ['SNOWFIELD','ICEFIELD','TAIGA','MORAINE','FELLFIELD']],
  ALIEN:    [6, 'alienRegion',   ['MYCELIA','CRATER','HIVE','FLESH','ASHFALL']],
  CRYSTAL:  [7, 'crystalRegion', ['PAN','SPIRE','SALT','GLASS','LATTICE']]
};
for (const lay of Object.keys(REGIONS)) {
  const [bi, fn, names] = REGIONS[lay];
  // Sampled well wider than the fields' own period. A window a few chunks
  // across sits inside one lobe of a slow lattice and reports whichever region
  // happens to own that lobe at 50% -- which is a property of the window, not
  // of the world.
  const hist = P(`(() => { const h = {};
    for (let i = -70; i < 70; i++) for (let j = -70; j < 70; j++) {
      const r = ${fn}(${bi}, i * 620, j * 620); h[r] = (h[r] || 0) + 1;
    } return h; })()`);
  const total = Object.values(hist).reduce((a, b) => a + b, 0);
  const share = {}; for (const k of Object.keys(hist)) share[k] = hist[k] / total;
  console.log('   ' + lay.padEnd(9) + Object.keys(share).sort((a, b) => share[b] - share[a])
    .map(k => `${k} ${(100 * share[k]).toFixed(1)}%`).join('  '));
  for (const nm of names) {
    ok(`${lay}: ${nm} occurs somewhere`, (share[nm] || 0) > 0.02,
       ((share[nm] || 0) * 100).toFixed(2) + '%');
  }
  ok(`${lay}: resolves only its own regions`,
     Object.keys(share).every(k => names.includes(k)),
     Object.keys(share).filter(k => !names.includes(k)).join(','));
  // A landscape nobody ever leaves is not a landscape.
  const top = Math.max(...Object.values(share));
  ok(`${lay}: no single region owns the sector`, top < 0.60, (top * 100).toFixed(1) + '%');
  // Pure function of position: the bake and the generator both call these and
  // neither runs first, so the only thing making them agree is that there is
  // nothing else in the answer.
  ok(`${lay}: is a pure function of world position`,
     P(`${fn}(${bi}, 4321, -8765) === ${fn}(${bi}, 4321, -8765)`));
  // One question for the whole world: every consumer calls regionAt().
  ok(`${lay}: regionAt() dispatches to ${fn}`,
     P(`regionAt(${bi}, 4321, -8765, "${lay}") === ${fn}(${bi}, 4321, -8765)`));
}
// Layouts with no sub-biomes must say so rather than guessing, because the
// clutter scatter reads the answer straight into pickClutterType.
for (const lay of ['CITY', 'CITY_DENSE', 'FRONTIER']) {
  ok(`regionAt() returns null for ${lay}`, P(`regionAt(1, 900, -300, "${lay}")`) === null);
}

// ----------------------------------------------------------------- overlaps
console.log('\n== placement ==');
const walkable = (s) => (s.isGrassLot && !s.isPond) || s.isDeck || s.isCropField;
let worst = null, overlaps = 0, tested = 0;
// Every streamed sector. Sector 3 used to be exempt here for nine touches of
// its own -- a wagon and a cactus standing in a field fence -- which turned out
// to be one missing lattice block rather than nine separate accidents: the
// field's two rails stand 340 out from its middle and only the field itself was
// ever reserved.
for (const b of [1, 2, 3, 4, 5, 6, 7]) {
  probe(`authoredCore = null; authoredChunks = null; authoredMask = null; biomeState = {}; currentLevel = ${b}; currentBiome = ${b};`);
  for (let cx = -6; cx <= 6; cx++) {
    for (let cy = -6; cy <= 6; cy++) {
      const ch = gen(b, cx, cy);
      tested++;
      for (let i = 0; i < ch.solid.length; i++) {
        for (let j = i + 1; j < ch.solid.length; j++) {
          const a = ch.solid[i], c = ch.solid[j];
          if (walkable(a) || walkable(c)) continue;
          if (a.propType === 'RIVER' || c.propType === 'RIVER') continue;   // banks intentionally abut
          if (a.propType === 'CANAL' || c.propType === 'CANAL') continue;
          // Composed pieces that are MEANT to touch: a barrier and the guard
          // box on its corner are one post, and the four runs of a site
          // hoarding meet at the corners because a fence is closed.
          const pair = [a.propType, c.propType].sort().join('|');
          if (pair === 'CHECKPOINT|GUARDBOX' || pair === 'HOARDING|HOARDING' ||
              pair === 'HEDGE|HEDGE') continue;   // a fence corner is closed
          const ox2 = (a.w + c.w) / 2 - Math.abs(a.x - c.x);
          const oy2 = (a.h + c.h) / 2 - Math.abs(a.y - c.y);
          if (ox2 > 0 && oy2 > 0) {
            overlaps++;
            const d = Math.min(ox2, oy2);
            if (!worst || d > worst.d) worst = { d, a: a.propType || (a.isBlockBuilding ? 'block' : '?'),
                                                 b: c.propType || (c.isBlockBuilding ? 'block' : '?'), cx, cy, biome: b };
          }
        }
      }
    }
  }
}
console.log(`   ${tested} chunks, ${overlaps} overlapping solid pairs`);
if (worst) console.log(`   worst: ${worst.a} x ${worst.b} by ${worst.d.toFixed(0)}u at biome ${worst.biome} (${worst.cx},${worst.cy})`);
ok('solids do not intersect each other', overlaps === 0);


// ---------------------------------------------------------------------------
// NOTHING IS BUILT ON A ROAD OR IN THE WATER
// The placements are eleven searches across five layouts and several of them
// place by offset from a seed rather than by a search at all, so this is
// asserted against the final output rather than trusted to any of them.
// ---------------------------------------------------------------------------
console.log('\n== reserved ground ==');
{
  let onRoad = 0, checked = 0;
  const worstK = {};
  for (const b of [1, 2, 3, 4, 5, 6, 7]) {
    probe(`authoredCore = null; authoredChunks = null; authoredMask = null; biomeState = {}; currentLevel = ${b}; currentBiome = ${b};`);
    for (let cx = -5; cx <= 5; cx++) for (let cy = -5; cy <= 5; cy++) {
      for (const s of gen(b, cx, cy).solid) {
        // The water volumes, the things built to be stood on and the quayside
        // furniture are what a waterway LOOKS like, not something put on one.
        if (s.isDeck || s.isMarshPool || s.isPond) continue;
        if (['RIVER','CANAL','BRIDGE','CANALBRIDGE','BOARDWALK',
             'BARGE','BOLLARD','QUAYCRANE'].includes(s.propType)) continue;
        checked++;
        if (P(`groundReserved(${b},${cx},${cy},${s.x},${s.y},${s.w || 0},${s.h || 0},0)`)) {
          onRoad++;
          const k = s.propType || Object.keys(s).filter(q => q.startsWith('is'))[0] || '?';
          worstK[k] = (worstK[k] || 0) + 1;
        }
      }
    }
  }
  console.log(`   ${checked} solids checked across seven sectors`);
  ok('no structure stands on a trail, a road or in the water', onRoad === 0,
     Object.entries(worstK).map(([k, v]) => `${k}:${v}`).join(' '));
}

// --------------------------------------------------------------------- bake
console.log('\n== terrain bake ==');
let baked = 0, threw = null;
for (const b of [1, 2, 3, 4, 5, 6, 7]) {
  probe(`authoredCore = null; authoredChunks = null; authoredMask = null; currentLevel = ${b}; currentBiome = ${b};`);
  for (let cx = -4; cx <= 4; cx++) {
    for (let cy = -4; cy <= 4; cy++) {
      try {
        const ch = gen(b, cx, cy);
        ctx.__decor = ch.decorBake;
        probe(`bakeChunkTerrain(${b}, ${cx}, ${cy}, window.__decor)`);
        baked++;
      } catch (e) { threw = `${b} (${cx},${cy}): ${e.message}`; break; }
    }
    if (threw) break;
  }
}
console.log(`   ${baked} chunks baked`);
ok('every chunk bakes without throwing', threw === null, threw || '');

// ------------------------------------------------------------------- clutter
console.log('\n== clutter ==');
const types = new Set();
// One vm evaluation per rotation rather than three thousand: the sweep now
// covers seven layouts and twenty-six sub-biomes, and a probe() per draw put
// this file's runtime up by an order of magnitude for no extra coverage.
const sweep = (biome, lay, rg, n) => P(`(() => { const s = {};
  for (let i = 0; i < ${n}; i++) {
    s[pickClutterType(BIOMES[${biome}], makeRng(i * 7 + 3), "${lay}", ${rg ? '"' + rg + '"' : 'null'})] = 1;
  } return Object.keys(s); })()`);
// Every layout's default rotation -- the one taken when a region is null,
// which is what the city layouts and the frontier always get.
for (const lay of ['CITY', 'CITY_DENSE', 'WOODLAND', 'FRONTIER', 'JUNGLE', 'TUNDRA', 'ALIEN', 'CRYSTAL']) {
  for (const t of sweep(2, lay, null, 4000)) types.add(t);
}
// And every sub-biome's own rotation. A region whose rotation names a type with
// no case in paintClutter() paints nothing at all and never says so -- which is
// exactly what GRASS did for a quarter of all woodland clutter.
for (const lay of Object.keys(REGIONS)) {
  const [bi, , names] = REGIONS[lay];
  for (const rg of names) for (const t of sweep(bi, lay, rg, 4000)) types.add(t);
}
// Plus every species the generators push into decor directly rather than
// through pickClutterType -- the standing timber, in both sectors that have it.
for (const b of [1, 2, 4, 5, 6, 7]) {
  probe(`authoredCore = null; authoredChunks = null; authoredMask = null; biomeState = {}; currentLevel = ${b}; currentBiome = ${b};`);
  for (let cx = -8; cx <= 8; cx++) for (let cy = -8; cy <= 8; cy++) {
    const ch = P(`generateChunkContent(${b}, ${cx}, ${cy})`);
    for (const d of ch.decor) types.add(d.t);
    for (const d of ch.decorBake) types.add(d.t);
  }
}
const painted = [];
for (const t of types) {
  ctx.__d = { t, x: 0, y: 0, s: 1, r: 0.3, c: 0.4 };
  const g = mkG();
  ctx.__g = g;
  const before = g;
  let drew = 0;
  const rec = mkG();
  let n = 0;
  ['rect','ellipse','line','vertex','arc'].forEach(fn => { const o = rec[fn]; rec[fn] = function(){ n++; return o.apply(this, arguments); }; });
  ctx.__g = rec;
  probe('paintClutter(window.__g, window.__d, 100)');
  if (n === 0) painted.push(t);
}
console.log('   types in rotation: ' + Array.from(types).sort().join(' '));
ok('every clutter type pickClutterType can return has art', painted.length === 0, painted.join(','));

// ---------------------------------------------------------------------------
// MARSH POOLS
// The generator and the terrain bake both call woodPools(). If they ever
// disagree the player gets water they cannot wade, or wades ground that looks
// dry — so the agreement is the whole contract, and the placement rules have to
// live inside woodPools() rather than in either caller.
// ---------------------------------------------------------------------------
console.log('\n== marsh pools ==');
probe('authoredCore = null; authoredChunks = null; authoredMask = null; biomeState = {}; currentLevel = 2; currentBiome = 2;');
{
  let chunks = 0, wet = 0, marsh = 0, total = 0, mismatch = 0, tooNear = 0, overlap = 0;
  for (let cx = -12; cx <= 12; cx++) for (let cy = -12; cy <= 12; cy++) {
    chunks++;
    if (P(`woodRegion(2, ${cx * 1200 + 600}, ${cy * 1200 + 600})`) === 'MARSH') marsh++;
    const list = P(`woodPools(2, ${cx}, ${cy})`) || [];
    const built = P(`generateChunkContent(2, ${cx}, ${cy})`).solid.filter(s => s.isMarshPool);
    if (built.length !== list.length) mismatch++;
    if (list.length) { wet++; total += list.length; }
    for (const p of list) {
      // Never on a travel anchor — that is the first ground the player stands on.
      for (const a of [[0, 0], [0, -2400], [0, 2400]]) {
        if (Math.abs(p.x - a[0]) < p.w / 2 + 780 && Math.abs(p.y - a[1]) < p.h / 2 + 780) tooNear++;
      }
      if (P(`woodHasTrunk(2, ${cx})`) &&
          Math.abs(p.x - P(`woodTrailX(2, ${cx}, ${p.y})`)) < p.w / 2 + 160) tooNear++;
      if (P(`woodHasRiver(2, ${cy})`) &&
          Math.abs(p.y - P(`woodRiverY(2, ${cy}, ${p.x})`)) <
            p.h / 2 + P(`woodRiverHalf(2, ${cy}, ${p.x})`) + 140) tooNear++;
      for (const q of list) {
        if (q === p) continue;
        if (Math.abs(p.x - q.x) < (p.w + q.w) / 2 && Math.abs(p.y - q.y) < (p.h + q.h) / 2) overlap++;
      }
    }
  }
  console.log(`   ${chunks} chunks: ${marsh} marsh, ${wet} carrying water, ${total} pools`);
  ok('the bake and the generator agree about where the water is', mismatch === 0, mismatch + ' chunks differ');
  ok('marsh country actually has water in it', wet / marsh > 0.4, `${(100 * wet / marsh).toFixed(0)}% of marsh chunks`);
  ok('no pool sits on an anchor, a road or the river', tooNear === 0, tooNear + ' bad');
  ok('pools do not overlap each other', overlap === 0, overlap + ' pairs');
  // Depth ramps from the rim to the middle, and stops at the rim.
  const one = P(`(() => { for (let cx=-12;cx<=12;cx++) for (let cy=-12;cy<=12;cy++) { const l = woodPools(2,cx,cy); if (l) return l[0]; } return null; })()`);
  ctx.__pool = one;
  probe('activeBuildings = [Object.assign({}, window.__pool, {isPond: true})]; frameCount = 1;');
  ok('a pool is wadeable in the middle', P('waterDepthAt(window.__pool.x, window.__pool.y)') === 1);
  ok('and dry outside it', P('waterDepthAt(window.__pool.x + window.__pool.w, window.__pool.y)') === 0);
  probe('frameCount = 2;');
  ok('depth ramps rather than steps at the rim',
     P('waterDepthAt(window.__pool.x + window.__pool.w * 0.47, window.__pool.y)') < 0.5);
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

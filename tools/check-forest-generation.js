// Forest ecology changes its art without changing the saved woodland template.
const assert = require('assert');
const crypto = require('crypto');
const { ctx, probe } = require('./harness');
const P = s => probe('(' + s + ')');
const digest = a => crypto.createHash('sha256').update(JSON.stringify(a)).digest('hex');
probe('authoredCore=null; authoredMask=null; authoredChunks=null; biomeState={}; currentLevel=2; currentBiome=2; BIOME_ACTIVE=true;');

// Recorded before the forest overhaul at 58222a7. Other levels retain the full
// content; Sector 2 retains each old collider, girth, type and destruction key.
const BASELINE = {
  1: '9fe043caf9a848ec68e44315e71c02f636abe939a55913ea59ce21548fdfe7fa',
  2: 'df640dcecc2342f5062d58fd299316ed7c0624c23ec87d357e95b80e876f91f6',
  3: 'a3b0b103987a53c5d10999df77f7302c001fa3705d1c756096c7d4e268ca1e7a',
  4: 'ac5e7e92f4b43b6f2014545917a0693a8ca21a269bfee4a74e800f2e303ae1c2',
  5: '201bf8997f965daffac4fe86817c28bc8c865077bc837c58720e0fe4621b262b',
  6: '2cc14265cb9fcea4d0d594afe51f009ab3efe88e8c0774309f2d266f7831e653',
  7: '2a32f0a3c37c9e71d37bf30e247188ed4a4d4b934eebefee45aca9b4597f2758'
};
for (let biome = 1; biome <= 7; biome++) {
  const chunks = [];
  for (const x of [-9,-4,0,3,8]) for (const y of [-7,-2,0,5,11]) {
    const ch = P(`generateChunkContent(${biome},${x},${y})`);
    assert.equal(JSON.stringify(ch), JSON.stringify(P(`generateChunkContent(${biome},${x},${y})`)), 'generation order cannot change a chunk');
    chunks.push(biome === 2 ? ch.solid.filter(s => !s.chunkKey.includes('forest:')).map(s =>
      Object.fromEntries(Object.entries(s).filter(([k]) => !k.startsWith('forest')))) : ch);
  }
  assert.equal(digest(chunks), BASELINE[biome], `sector ${biome} changed historical content identities`);
}

const species = new Set(), regions = new Set();
let newTrees = 0, canopy = 0, midstory = 0, baked = 0, seamPairs = 0;
for (let x = -8; x <= 8; x++) for (let y = -8; y <= 8; y++) {
  const ch = P(`generateChunkContent(2,${x},${y})`);
  const added = ch.solid.filter(s => s.chunkKey.includes('forest:'));
  assert(added.length <= 10, 'extra live forest stems exceeded the chunk cap');
  assert.equal(new Set(ch.solid.map(s => s.chunkKey)).size, ch.solid.length, 'destruction keys must be unique');
  newTrees += added.length;
  for (const d of ch.decor) {
    if (!d.forestTrunkKey) continue;
    const trunk = ch.solid.find(s => s.chunkKey === d.forestTrunkKey);
    assert(trunk, 'styled standing art must retain its exact surviving root collider');
    species.add(d.forestSpecies); regions.add(d.forestRegion);
    assert.equal(d.x, trunk.x); assert.equal(d.y, trunk.y);
    assert.equal(d.s, trunk.girth, 'harvest girth follows the canopy scale');
    ctx.__forestD = d;
    const reach = P('forestPropRadius(window.__forestD)');
    assert(!P(`groundReserved(2,${x},${y},${d.x},${d.y},${reach * 2},${reach * 2},0)`), 'visible crown blocked a road, waterway or compound');
    if (d.forestTier === 'canopy') canopy++;
    if (d.forestTier === 'midstory') midstory++;
  }
  for (const d of ch.decorBake) if (d.forestTier === 'underbrush') {
    assert(!P(`CLUTTER_ANIMATED[${JSON.stringify(d.t)}]`), 'bulk understory must remain baked');
    ctx.__forestD = d;
    const reach = P('forestPropRadius(window.__forestD)') || 12 * (d.s || 1);
    assert(d.x - reach >= x * 1200 && d.x + reach <= (x + 1) * 1200 &&
      d.y - reach >= y * 1200 && d.y + reach <= (y + 1) * 1200,
      'baked forest silhouette was clipped by its owner texture');
    baked++;
  }
  ctx.__forestBaked = ch.decorBake;
  assert(P(`window.__forestBaked.every(d => {
    if (!d.forestSpecies) return true;
    const r = forestPropRadius(d) || 12 * (d.s || 1);
    if (woodHasTrunk(2,${x}) && crossesNS(y => woodTrailX(2,${x},y),d.x,d.y,r,r,ROAD_HALF.WOODLAND)) return false;
    if (woodHasLink(2,${y}) && crossesEW(x => woodLinkY(2,${y},x),() => ROAD_HALF.WOODLAND,d.x,d.y,r,r)) return false;
    const sp = woodSpur(2,${x},${y});
    return !sp || !segHitsRect(sp.x0,sp.y0,sp.x0+(sp.x1-sp.x0)*0.82,sp.y0+(sp.y1-sp.y0)*0.82,d.x,d.y,r+SPUR_HALF,r+SPUR_HALF);
  })`), 'baked forest foliage extended into an army route');
  // A shared point just either side of an arbitrary chunk boundary must agree
  // except when a genuine ecology threshold happens to cross that point.
  const sy = y * 1200 + 433, sx = (x + 1) * 1200;
  if (P(`woodRegion(2,${sx - 0.001},${sy}) === woodRegion(2,${sx + 0.001},${sy})`)) seamPairs++;
}
assert.equal(species.size, 6, 'all six PNW species need actual placements');
assert.equal(regions.size, 4, 'all four forest habitats need actual placements');
assert(newTrees > 500 && canopy > 500 && midstory > 500, 'forest layers need meaningful populations');
assert(baked > 1000, 'the density belongs in static forest-floor dressing');
assert(seamPairs > 280, 'forest habitats snapped to chunk borders');

// Riverbed habitat follows the same channel both neighbouring chunks paint.
let bankChecks = 0;
for (let row = -20; row <= 20; row++) {
  if (!P(`woodHasRiver(2,${row})`)) continue;
  for (let column = -10; column <= 10; column++) {
    const x = column * 1200;
    const y = P(`woodRiverY(2,${row},${x}) + woodRiverHalf(2,${row},${x}) * 1.35 + 90`);
    if (P(`bnoise(2,${x}+2600,${y}-7100,0.000065) > 0.63`)) continue;
    assert.equal(P(`woodRegion(2,${x},${y})`), 'MARSH'); bankChecks++;
  }
}
assert(bankChecks > 30, 'riverbank bias was not exercised');
console.log(`Forest generation passed: saved identities for 7 sectors; ${newTrees} new stems, ${canopy} canopies, ${midstory} midstory, ${baked} baked plants; ${bankChecks} river seams.`);

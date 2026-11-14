// Forest expansion is append-only, clustered, walkable and regeneration-safe.
const assert = require('assert');
const { ctx, probe } = require('./harness');
const P = source => probe('(' + source + ')');
probe('authoredCore=null;authoredMask=null;authoredChunks=null;biomeState={};BIOME_ACTIVE=true;currentBiome=currentLevel=2;');
const groves = new Map();
let stems = 0, shrubs = 0, sharedGroves = 0;
const chunks = new Map(), solidsByChunk = new Map();
for (let cx = -8; cx <= 8; cx++) for (let cy = -8; cy <= 8; cy++) {
  const ch = P(`generateChunkContent(2,${cx},${cy})`);
  chunks.set(`${cx},${cy}`, JSON.stringify(ch));
  solidsByChunk.set(`${cx},${cy}`, ch.solid);
  const added = ch.solid.filter(s => s.forestGroveKey);
  assert(added.length <= 14, 'copse live stems exceed the chunk budget');
  const bushes = ch.decor.filter(d => d.forestSpecies === 'BUSH');
  assert(bushes.length <= 12, 'raised shrubs exceed the live budget');
  assert(!ch.decorBake.some(d => d.forestSpecies === 'BUSH'), 'flat bush stamps remain on the forest floor');
  shrubs += bushes.length;
  assert.equal(new Set(ch.solid.map(s => s.chunkKey)).size, ch.solid.length, 'destruction keys collide');
  for (const root of added) {
    stems++;
    const crown = ch.decor.find(d => d.forestTrunkKey === root.chunkKey);
    assert(crown && crown.x === root.x && crown.y === root.y && crown.s === root.girth,
      'grove art lost its exact harvest/collision root');
    assert(root.x >= cx * 1200 && root.x < (cx + 1) * 1200 && root.y >= cy * 1200 && root.y < (cy + 1) * 1200,
      'a chunk owns a grove root beyond its bounds');
    ctx.__copse = crown;
    assert(!P(`groundReserved(2,${cx},${cy},__copse.x,__copse.y,forestPropRadius(__copse)*2,forestPropRadius(__copse)*2,18)`),
      'grove crown obstructs a reserved road, river, pool or fortress approach');
    for (const other of ch.solid) {
      // Timber was already dressed around these saved roots before it became
      // salvageable. This assertion protects original copse placement gaps;
      // fallen wood has its own precise footprint and reserved-route checks.
      if (other === root || other.isForestTimber || other.isGrassLot && !other.isPond) continue;
      assert(Math.abs(root.x - other.x) >= (root.w + (other.w || 0)) / 2 + 28 ||
        Math.abs(root.y - other.y) >= (root.h + (other.h || 0)) / 2 + 28,
        'grove trunks or buildings close a player-sized gap');
    }
    if (!groves.has(root.forestGroveKey)) groves.set(root.forestGroveKey, []);
    groves.get(root.forestGroveKey).push({ ...root, owner: `${cx},${cy}` });
  }
}
// The historical camp/ruin generator can spill a footprint over its owner
// boundary. Test the published neighbouring solids, not only each owner list.
for (const group of groves.values()) for (const root of group) {
  const [cx, cy] = root.owner.split(',').map(Number);
  for (let nx = cx - 1; nx <= cx + 1; nx++) for (let ny = cy - 1; ny <= cy + 1; ny++) {
    if (nx === cx && ny === cy) continue;
    const key = `${nx},${ny}`;
    if (!solidsByChunk.has(key)) solidsByChunk.set(key, P(`generateChunkContent(2,${nx},${ny})`).solid);
    for (const other of solidsByChunk.get(key)) {
      if (other.isForestTimber || other.isGrassLot && !other.isPond) continue;
      assert(Math.abs(root.x - other.x) >= (root.w + (other.w || 0)) / 2 + 28 ||
        Math.abs(root.y - other.y) >= (root.h + (other.h || 0)) / 2 + 28,
        `copse ${root.chunkKey} intersects neighbouring solid ${other.chunkKey}`);
    }
  }
}
// Regression: this neighbour's ruin spills into the copse owner. Removing it
// must not make a previously rejected grove slot appear on the next reload.
const blockedKey = '3,-5,forest:grove:4:-8:2';
assert(!P('generateChunkContent(2,3,-5)').solid.some(s => s.chunkKey === blockedKey), 'seam ruin overlap returned');
probe("getBiomeState(2).destroyed['2,-5,4']=true;");
assert(!P('generateChunkContent(2,3,-5)').solid.some(s => s.chunkKey === blockedKey), 'neighbour harvest changed copse acceptance');
assert(P("generateChunkContent(2,2,-5,true).solid.some(s=>s.chunkKey==='2,-5,4')"), 'base probe lost a saved reservation');
probe("delete getBiomeState(2).destroyed['2,-5,4'];");
let clustered = 0;
for (const group of groves.values()) {
  if (group.length >= 4) clustered += group.length;
  if (new Set(group.map(s => s.owner)).size > 1) sharedGroves++;
  for (const a of group) for (const b of group)
    assert(Math.hypot(a.x - b.x, a.y - b.y) < 350, 'a named copse is scattered across the landscape');
}
assert(stems > 1000 && clustered / stems > .70, 'forest additions did not form substantial tree clusters');
assert(shrubs > 1000, 'raised shrubs are missing from generated forest scenes');
assert(sharedGroves > 20, 'world-space copses never crossed a chunk boundary');
// Regenerate in reverse order: shared grove plans must not depend on neighbours.
for (const [key, expected] of [...chunks].reverse())
  assert.equal(JSON.stringify(P(`generateChunkContent(2,${key})`)), expected, 'generation order changes forest content');
console.log(`Forest copses passed: ${stems} new roots, ${Math.round(clustered / stems * 100)}% in groups of 4+, ${sharedGroves} shared groves, ${shrubs} raised shrubs; routes and saved root keys intact.`);

// Visual/ecology diversification must not move even namespaced saved stems.
const assert = require('assert');
const crypto = require('crypto');
const { ctx, probe } = require('./harness');
const P = source => probe('(' + source + ')');
probe('authoredCore=null;authoredMask=null;authoredChunks=null;biomeState={};BIOME_ACTIVE=true;currentBiome=currentLevel=2;');
const expected = '8e650a3c53b83a327e0015f5437750a389a52cbd1ae9225c29497476981dae56';
const stems = [], habitats = new Map();
let comicTrees = 0, checkedRoots = 0;
for (let cx = -8; cx <= 8; cx++) for (let cy = -8; cy <= 8; cy++) {
  const chunk = P(`generateChunkContent(2,${cx},${cy})`);
  stems.push(chunk.solid.filter(d => d.isTreeTrunk).map(d => [d.chunkKey,d.x,d.y,d.w,d.h,d.girth]));
  for (const d of [...chunk.decor,...chunk.decorBake,...chunk.solid]) {
    if (!d.forestSpecies) continue;
    const region = P(`forestHabitatAt(${d.x},${d.y})`);
    assert.equal(d.forestHabitat, region, 'ecology must match the painted prop at its own world root');
    habitats.set(region,(habitats.get(region)||0)+1);
    if (d.forestCanopyStyle === 'COMIC') {
      assert.equal(region,'VIBRANT','bright rounded comic trees belong only to sunlit groves');
      comicTrees++;
    }
    checkedRoots++;
  }
}
assert.equal(crypto.createHash('sha256').update(JSON.stringify(stems)).digest('hex'),expected,
  'habitat art changed a saved tree position, collision footprint, harvest girth or key');
assert.equal(habitats.size,7,'all seven forest habitats need real generated props');
assert(comicTrees>100,'the vibrant region needs a real tree population');
const colours=[];
for (const region of habitats.keys()) {
  colours.push(P(`woodlandFloorColour(${JSON.stringify(region)},.5,.5,.5)`));
  ctx.__habitat=region;
  assert(P('Object.keys(FOREST_PROPS).filter(k=>FOREST_PROPS[k].canopyMass&&k!=="CHARRED_SNAG").every(k=>forestTreePalette(k,window.__habitat).every(v=>Number.isFinite(v)&&v>=0&&v<=255))'),
    'habitat canopy colours exceeded the renderer range');
}
assert.equal(new Set(colours.map(c=>JSON.stringify(c.map(v=>Math.round(v))))).size,7,
  'forest habitats need distinct floor materials at equal light and soil conditions');
let boundaryPairs=0;
for(let x=-12;x<=12;x++)for(let y=-12;y<=12;y++) {
  const wx=x*1200,wy=y*1200+517;
  if(P(`forestHabitatAt(${wx-.001},${wy})===forestHabitatAt(${wx+.001},${wy})`))boundaryPairs++;
}
assert(boundaryPairs>610,'habitats snapped to chunk boundaries');
console.log(`Forest habitats passed: ${checkedRoots} rooted props, ${comicTrees} comic crowns, seven distinct palettes; every saved stem unchanged.`);
console.log(JSON.stringify(Object.fromEntries(habitats)));

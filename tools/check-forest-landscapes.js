// New forest accents preserve saved scenery and share their terrain surface
// across streamed chunk boundaries. Run with the ordinary headless harness.
const assert = require('assert');
const crypto = require('crypto');
const { probe } = require('./harness');
const P = src => probe('(' + src + ')');
probe('authoredCore=null;authoredMask=null;authoredChunks=null;biomeState={};currentLevel=2;currentBiome=2;BIOME_ACTIVE=true;');
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };

// Captured from 471b510f, including the existing timber collision and all old
// floor art. Landscape decoration is append-only, with its own RNG stream.
const legacy = [];
for (const cx of [-8,-3,0,4,11]) for (const cy of [-6,0,5,9]) {
  const chunk = P(`generateChunkContent(2,${cx},${cy})`);
  chunk.decor = chunk.decor.filter(d => !d.forestLandscapeProp);
  legacy.push(chunk);
}
check(crypto.createHash('sha256').update(JSON.stringify(legacy)).digest('hex') ===
  '78fd1bf6bdb4d82fa2a99457edac905f8bf7f7e726a6dc65ad8e9b708f3aa8ce',
  'landscape dressing changed existing saved forest content');

const kinds = new Set(), flora = new Set(), bog = new Set();
let raised = 0, accents = 0, seamHeight = 0, roadHeight = 0, revisit = null;
const snapshots = new Map();
for (let cy=-8;cy<=12;cy++) for (let cx=-8;cx<=12;cx++) {
  const chunk = P(`generateChunkContent(2,${cx},${cy})`);
  const added = chunk.decor.filter(d => d.forestLandscapeProp);
  check(added.filter(d=>!d.forestBogProp).length<=10, 'flower/mushroom live budget exceeded');
  check(added.filter(d=>d.forestBogProp).length<=6, 'wetland live budget exceeded');
  for (const d of added) {
    accents++;
    (d.forestBogProp ? bog : flora).add(d.forestSpecies);
    check(!d.forestSolidKey && !d.forestLiveProp, 'decorative plants consumed timber/old floor identities');
    check(P(`FOREST_PROPS[${JSON.stringify(d.forestSpecies)}].collision===null`), 'new small plants blocked movement');
    check(P(`forestStandingFloorProp(${JSON.stringify(d)})`), 'raised plant was baked below the depth pass');
    check(!P(`groundReserved(2,${cx},${cy},${d.x},${d.y},20,20,0)`), 'plant blocked a route or waterway');
  }
  if ((cx+cy)%7===0) snapshots.set(cx+','+cy,JSON.stringify(added));
  const x=cx*1200,y=cy*1200+433;
  const sites=P(`forestLandscapeSites(2,${cx},${cy},0)`);
  for(const s of sites)kinds.add(s.kind);
  check(new Set(sites.map(s=>s.key)).size===sites.length, 'site replay duplicated a landmark');
  for(const s of sites) {
    const same=P(`forestLandscapeSites(2,${cx+1},${cy},1400).find(s=>s.key===${JSON.stringify(s.key)})`);
    check(JSON.stringify(same)===JSON.stringify(s), 'neighbouring chunks disagreed about a shared site');
  }
  const za=P(`forestRidgeHeight(${x-.0001},${y})`),zb=P(`forestRidgeHeight(${x+.0001},${y})`);
  const ya=P(`forestRidgeHeight(${y},${x-.0001})`),yb=P(`forestRidgeHeight(${y},${x+.0001})`);
  seamHeight=Math.max(seamHeight,Math.abs(za-zb),Math.abs(ya-yb));
  check(Math.abs(za-zb)<.001 && Math.abs(ya-yb)<.001, 'walkable ridge had a chunk-edge height step');
  const z=P(`forestRidgeHeight(${cx*1200+600},${cy*1200+600})`);
  if(z>8) { raised++; revisit = { x: cx*1200+600, y: cy*1200+600, height: z }; }
  check(Number.isFinite(z)&&z>=0&&z<=76.001, 'forest relief height invalid');
  if(P(`woodHasTrunk(2,${cx})`)) {
    const rx=P(`woodTrailX(2,${cx},${y})`);
    roadHeight=Math.max(roadHeight,P(`forestRidgeHeight(${rx},${y})`));
  }
}
check(accents>250 && flora.size===4 && bog.size===3, 'new habitats lack meaningful species populations');
check(kinds.size===4 && raised>5, 'forest needs all four landscape forms and actual walkable hills');
check(roadHeight<.01, 'ridge elevation raised the centre of an existing trail');
for(const [key,snapshot]of [...snapshots].reverse()) {
  const [cx,cy]=key.split(',');
  check(JSON.stringify(P(`generateChunkContent(2,${cx},${cy}).decor.filter(d=>d.forestLandscapeProp)`))===snapshot,
    'streaming order changed landscape dressing');
}

// Stream further than every bounded cache, then revisit an old hill. Returning
// to an evicted area must reconstruct exactly the same walkable surface.
probe('for(let i=0;i<700;i++){forestLandscapeSites(2,i*3,-i*2);forestRidgeHeight(i*3600+333,-i*2400+777);}');
check(P('forestLandscapeSiteCache.size')<=512 && P('forestLandscapeGroundPlans.size')<=128 &&
  P('_forestRidgeGrids.size')<=128, 'walking indefinitely grew landscape caches without a bound');
check(revisit && P(`forestRidgeHeight(${revisit.x},${revisit.y})`)===revisit.height, 'cache eviction changed a ridge height');
for(const biome of [1,3,4,5,6,7]) check(P(`forestLandscapeSites(${biome},7,7).length`)===0, 'forest accents leaked into another level');
console.log(`Forest landscapes: ${checks} checks; ${accents} new plants, ${raised} raised chunk centres, maximum seam delta ${seamHeight.toExponential(2)}, trail height ${roadHeight.toFixed(3)}.`);

// Substantial forest props must be crisp live volumes, while overflow becomes
// actual floor litter rather than low-resolution silhouettes of raised objects.
const assert = require('assert');
const { ctx, probe } = require('./harness');
const P = source => probe('(' + source + ')');
probe('authoredCore=null;authoredMask=null;authoredChunks=null;biomeState={};BIOME_ACTIVE=true;currentBiome=currentLevel=2;');
const standing = new Set(['LOG','STUMP','FERN','REED','PEBBLE']);
const species = new Map();
let raised = 0, litter = 0, nonForest = 0;
for (let cx=-8;cx<=8;cx++) for (let cy=-8;cy<=8;cy++) {
  const chunk = P(`generateChunkContent(2,${cx},${cy})`);
  const props = chunk.decor.filter(d=>d.forestLiveProp);
  assert(props.length<=20, 'forest floor volumes exceeded their per-chunk budget');
  assert(chunk.decor.filter(d=>d.forestSpecies==='BUSH').length<=12, 'shrubs exceeded their separate budget');
  assert(!chunk.decorBake.some(d=>standing.has(d.forestSpecies)||d.forestSpecies==='BUSH'),
    'a substantial raised prop remains flattened into the terrain texture');
  for (const d of props) {
    raised++;
    species.set(d.forestSpecies,(species.get(d.forestSpecies)||0)+1);
    assert(standing.has(d.forestSpecies), 'a live marker escaped the selected prop families');
    assert(!d.forestTrunkKey && !chunk.solid.some(s=>s===d), 'floor art must stay separate from solid records');
    if (d.forestSpecies==='LOG'||d.forestSpecies==='STUMP')
      assert(d.forestSolidKey && chunk.solid.filter(s=>s.isForestTimber&&s.chunkKey===d.forestSolidKey).length===1,
        'salvageable timber must have exactly one matching ground collider');
    else assert(!d.forestSolidKey, 'non-wood ground foliage unexpectedly gained a solid');
    ctx.__floorProp=d;
    assert(P('forestStandingFloorProp(__floorProp)&&!forestRaisedCrown(__floorProp)'),
      'a floor volume bypassed root sorting or became an overhead occluder');
    assert(d.x>=cx*1200&&d.x<(cx+1)*1200&&d.y>=cy*1200&&d.y<(cy+1)*1200,
      'a live floor prop migrated to another chunk');
  }
  for (const d of chunk.decorBake) if(d.forestSpecies==='LITTER') {
    litter++;
    assert(d.t==='LITTER' && (standing.has(d.forestLitterSource)||d.forestLitterSource==='BUSH'),
      'floor litter lost its deterministic source/palette cue');
    assert(!d.forestLiveProp && !d.forestLiveShrub, 'quiet litter unexpectedly became a live object');
  }
}
assert(raised>1500 && litter>1500, 'the live-detail/litter split has no meaningful generated population');
assert(species.size===standing.size, 'a rebuilt prop family disappeared from generated forest scenes');
for (const biome of [1,3,4,5,6,7]) for (const [cx,cy] of [[-4,-2],[3,5]]) {
  const ch=P(`generateChunkContent(${biome},${cx},${cy})`);
  assert(!ch.decor.some(d=>d.forestLiveProp)&&!ch.decorBake.some(d=>d.forestSpecies==='LITTER'),
    'forest-only floor conversion changed another biome');
  nonForest++;
}
console.log(`Forest floor props passed: ${raised} raised volumes, ${litter} quiet litter patches, all ${species.size} prop families; budgets, depth and ${nonForest} other-biome samples intact.`);

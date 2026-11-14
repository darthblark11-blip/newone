// The glades add visible raised flowers without rerolling a saved forest,
// growing over a route, or turning walk-through foliage into cover.
const assert = require('assert');
const { ctx, mkG, calls, probe } = require('./harness');
const P = source => probe('(' + source + ')');
probe('authoredCore=null;authoredMask=null;authoredChunks=null;biomeState={};BIOME_ACTIVE=true;currentBiome=currentLevel=2;');
const families = new Set(['LUPINE', 'FOXGLOVE', 'SUN_DAISY', 'AMBER_FUNGUS']);
const population = new Map();
const fixtures = [[-9,-6],[-9,0],[-4,5],[7,-8],[8,-8],[-11,-9],[8,-4]];
let count = 0;
for (const [cx,cy] of fixtures) {
  ctx.__cx=cx;ctx.__cy=cy;
  const before = P(`(()=>{const original=appendForestFlora;try{appendForestFlora=()=>{};return generateChunkContent(2,__cx,__cy);}finally{appendForestFlora=original;}})()`);
  const after = P('generateChunkContent(2,__cx,__cy)');
  const flora = after.decor.filter(d=>families.has(d.forestSpecies));
  assert(flora.length<=10, 'wildflower clumps exceeded their live geometry budget');
  assert.strictEqual(JSON.stringify(after.solid),JSON.stringify(before.solid), 'flora changed saved cover or tree collision');
  assert.strictEqual(JSON.stringify(after.cars),JSON.stringify(before.cars), 'flora changed an existing layout RNG stream');
  assert.strictEqual(JSON.stringify(after.decorBake),JSON.stringify(before.decorBake), 'flora changed old baked decor');
  assert.strictEqual(JSON.stringify(after.decor.filter(d=>!families.has(d.forestSpecies))),JSON.stringify(before.decor),
    'flora changed saved trees, props, or the existing live floor budget');
  assert.strictEqual(JSON.stringify(after),JSON.stringify(P('generateChunkContent(2,__cx,__cy)')),
    'revisiting a flower glade moved or rerolled its plants');
  for(const d of flora) {
    count++;population.set(d.forestSpecies,(population.get(d.forestSpecies)||0)+1);ctx.__flora=d;
    assert(P('forestPropProfile(__flora).collision===null&&forestStandingFloorProp(__flora)&&!forestRaisedCrown(__flora)'),
      'a flower lost root-depth sorting or became blocking cover');
    assert(d.forestLandscapeProp&&!d.forestLiveProp&&!d.forestSolidKey&&!d.forestTrunkKey,
      'landscape flora entered a saved timber/shrub budget');
    assert(P('forestFloraRootClear(2,__cx,__cy,__flora.x,__flora.y,forestPropRadius(__flora),generateChunkContent(2,__cx,__cy).solid)'),
      'a flower grew across a trail, structure, anchor or solid root');
    assert(d.forestLandscape===(d.forestSpecies==='AMBER_FUNGUS'?'HOLLOW':'BLOOM'),
      'sun flowers and shade fungi lost their distinct landscape');
    assert(P('forestHabitatAt(__flora.x,__flora.y,2)===__flora.forestHabitat'), 'flora has stale ecology metadata');
  }
}
assert(population.size===4&&count>=15,'fixtures no longer exercise every flower/fungus family');
// Inactive biomes and base forest queries are unaffected by this pass.
for(const biome of [1,3,4,5,6,7]) {
  ctx.__empty={solid:[],decor:[],decorBake:[],cars:[]};ctx.__biome=biome;
  probe('appendForestFlora(__biome,-9,0,__empty)');assert.strictEqual(ctx.__empty.decor.length,0);
}
const g=mkG();ctx.__floraG=g;
const saved=JSON.stringify([...population]);
for(const family of families) {
  ctx.__flora={forestSpecies:family,t:family,x:600,y:400,s:1.2,r:.7,c:.39,forestHabitat:'TIMBER',forestRegion:'TIMBER'};
  const input=JSON.stringify(ctx.__flora);
  calls.sig=0;assert(P('paintForestFlora(__floraG,__flora,100,"shadow")'));const shadow=calls.sig;
  calls.sig=0;assert(P('paintForestFlora(__floraG,__flora,100,"root")'));const root=calls.sig;
  assert(root!==shadow&&root!==0,'flora root/body pass collapsed into a floor shadow');
  calls.sig=0;P('paintForestFlora(__floraG,__flora,100,"root")');assert.strictEqual(calls.sig,root,'flora paint flickers across identical frames');
  assert.strictEqual(JSON.stringify(ctx.__flora),input,'drawing mutated saved flora');
}
assert.strictEqual(JSON.stringify([...population]),saved);
ctx.__flora={forestSpecies:'LOG'};assert.strictEqual(P('paintForestFlora(__floraG,__flora,100)'),false,'flora painter intercepted old timber art');
console.log(`Forest flora passed: ${count} raised clumps across all four families; saved layout/collision, route clearance, depth sorting, deterministic rendering and biome isolation intact.`);

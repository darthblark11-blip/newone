// Wetland dressing must share real water, leave saved layouts intact and stay
// a bounded, root-sorted vegetation layer rather than new invisible obstacles.
const assert = require('assert');
const { ctx, probe, mkG, calls } = require('./harness');
const P = source => probe('(' + source + ')');
probe('authoredCore=null;authoredMask=null;authoredChunks=null;biomeState={};BIOME_ACTIVE=true;currentBiome=currentLevel=2;');
const families = new Set(['BOG_HUMMOCK','BOG_MOSS','BOG_SEDGE']);
const population = new Map(), fixtures = [];
let plants=0,pools=0,maxPlants=0;
for(let cx=-8;cx<=8;cx++)for(let cy=-8;cy<=8;cy++) {
  const chunk=P(`generateChunkContent(2,${cx},${cy})`),bog=chunk.decor.filter(d=>d.forestBogProp);
  const water=P(`woodPools(2,${cx},${cy})`);
  if(water){pools+=water.length;fixtures.push([cx,cy]);}
  plants+=bog.length;maxPlants=Math.max(maxPlants,bog.length);
  assert(bog.length<=P('BOG_PROP_MAX'),'wetland live-object budget exceeded');
  const saved=JSON.stringify(bog),solid=JSON.stringify(chunk.solid),bake=JSON.stringify(chunk.decorBake);
  for(const d of bog) {
    population.set(d.forestSpecies,(population.get(d.forestSpecies)||0)+1);
    assert(families.has(d.forestSpecies)&&d.forestLandscapeProp&&!d.forestLiveProp,
      'wetland dressing escaped its independent live vegetation budget');
    assert(d.x>cx*1200&&d.x<(cx+1)*1200&&d.y>cy*1200&&d.y<(cy+1)*1200,
      'a plant is owned by a chunk different from its ground root');
    assert(!d.forestTrunkKey&&!d.forestSolidKey,'soft bank plants gained a saved wood identity');
    ctx.__bog=d;
    assert(P('forestPropProfile(__bog).collision===null&&forestStandingFloorProp(__bog)&&!forestRaisedCrown(__bog)'),
      'soft wetland plants became colliders or overhead crowns');
    assert(!P(`groundReserved(2,${cx},${cy},__bog.x,__bog.y,forestPropRadius(__bog)*1.7,forestPropRadius(__bog)*1.7,8)`),
      'bank vegetation overlaps a road, crossing, fort or actual water');
    ctx.__solids=chunk.solid;
    assert(P('solidsClearAt(__solids,__bog.x,__bog.y,forestPropRadius(__bog)*1.7,forestPropRadius(__bog)*1.7,8)'),
      'bank vegetation is rooted inside a tree, timber collider or building');
  }
  ctx.__chunk=chunk;
  chunk.decor=chunk.decor.filter(d=>!d.forestBogProp);
  probe(`appendForestBogDressing(2,${cx},${cy},__chunk)`);
  assert.strictEqual(JSON.stringify(chunk.decor.filter(d=>d.forestBogProp)),saved,'wetland placement is not repeatable');
  assert.strictEqual(JSON.stringify(chunk.solid),solid,'wetland dressing changed water or saved solid records');
  assert.strictEqual(JSON.stringify(chunk.decorBake),bake,'wetland append changed the existing material bake');
}
assert(plants>100&&pools>20&&population.size===families.size,'a wetland prop family or real pool population disappeared');

// Each pool owns its complete water art. Replaying a bake must be identical;
// a chunk without pools must never receive a painted but nonphysical pond.
ctx.__bogG=mkG();
ctx.__bogLilyCalls=[];
probe('__bogLilyOriginal=bakeForestBogLily;bakeForestBogLily=function(g,x,y,r){__bogLilyCalls.push({x,y,r});return __bogLilyOriginal.apply(this,arguments);};');
for(const [cx,cy] of fixtures.concat([[0,0]])) {
  ctx.__bogLilyCalls.length=0;
  calls.sig=0;probe(`bakeForestBogDressing(__bogG,2,${cx},${cy})`);const first=calls.sig;
  const water=P(`woodPools(2,${cx},${cy})`)||[];
  for(const lily of ctx.__bogLilyCalls)assert(water.some(p=>{
    const dx=(lily.x-p.x)/(p.w/2),dy=(lily.y-p.y)/(p.h/2),angle=Math.atan2(dy,dx);
    const edge=1+.17*Math.sin(angle*3+p.k*21)+.09*Math.sin(angle*5-p.k*13);
    return Math.hypot(dx,dy)+lily.r/Math.min(p.w/2,p.h/2)<=Math.min(.84,edge*.92)+1e-8;
  }),'a lily pad extends past real water onto the bank');
  for(const p of water)assert(p.x-p.w*.5*1.47>cx*1200&&p.x+p.w*.5*1.47<(cx+1)*1200&&
    p.y-p.h*.5*1.47>cy*1200&&p.y+p.h*.5*1.47<(cy+1)*1200,
    'a complete pool footprint reaches a neighboring terrain bake');
  calls.sig=0;probe(`bakeForestBogDressing(__bogG,2,${cx},${cy})`);assert.strictEqual(calls.sig,first,'pool art depends on bake order');
  if(!P(`woodPools(2,${cx},${cy})`))assert.strictEqual(first,0,'a dry chunk received decorative water');
}
probe('bakeForestBogLily=__bogLilyOriginal;');

// The split actor pass owns one shadow and one raised body. Height projection
// responds to the camera, and painting never edits immutable streamed records.
probe('zoom=.7;width=1200;height=800;LIGHT_DX=-.7;LIGHT_DY=.7;shadowDensity=()=>1;shadowLengthScale=()=>1;');
for(const species of families) {
  const d={t:species,x:400,y:400,s:1.2,r:.51,c:.68,forestSpecies:species,
    forestRegion:'MARSH',forestLandscapeProp:true,forestBogProp:true};
  const saved=JSON.stringify(d);ctx.__bog=d;
  const record=phase=>{
    const points=[];
    for(const name of ['vertex','quad','triangle','ellipse','line','bezier']) {
      const previous=ctx[name];ctx[name]=function(...args){for(const v of args)assert(Number.isFinite(v),'nonfinite wetland vertex');points.push(name,...args);return previous.apply(this,args);};
    }
    calls.sig=0;probe(`paintForestClutter(window,__bog,100,${JSON.stringify(phase)})`);
    const signature=calls.sig;
    // Restore the harness drawing methods after the captured production pass.
    for(const name of ['vertex','quad','triangle','ellipse','line','bezier'])ctx[name]=ctx.__bogOriginal[name];
    return {signature,points};
  };
  ctx.__bogOriginal={};for(const name of ['vertex','quad','triangle','ellipse','line','bezier'])ctx.__bogOriginal[name]=ctx[name];
  probe('camX=camY=0;');const rootA=record('root'),shadowA=record('shadow');
  probe('camX=700;camY=-500;');const rootB=record('root'),shadowB=record('shadow');
  assert(rootA.points.length>20&&shadowA.points.length>0,'wetland split pass omitted a body or ground shadow');
  assert.notStrictEqual(rootA.signature,rootB.signature,'raised wetland geometry ignored camera perspective');
  assert.strictEqual(shadowA.signature,shadowB.signature,'wetland ground shadows drifted with the camera');
  assert.strictEqual(JSON.stringify(d),saved,'wetland paint mutated its streamed root or art seed');
}
for(const biome of [1,3,4,5,6,7]) {
  const chunk=P(`generateChunkContent(${biome},-3,4)`);
  assert(!chunk.decor.some(d=>d.forestBogProp),'wetland plants leaked into another biome');
}
console.log(`Forest bog checks passed: ${plants} plants, all ${population.size} families, ${pools} real pools, max ${maxPlants}/chunk; layout, routes, split projection and deterministic water art intact.`);

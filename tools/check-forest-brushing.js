// Player contact is a swept soft trigger, not an obstacle. Foliage reacts in
// ephemeral bounded springs while generated roots and contact shade stay put.
const assert = require('assert');
const { probe } = require('./harness');
const P = code => probe('(' + code + ')');
probe(`
  BIOME_ACTIVE=true;currentBiome=currentLevel=2;doTick=true;isPaused=false;
  activeBuildings=[];activeParkingCars=[];barrels=[];forestWildlife.length=0;
  invalidateColIndex();frameCount=100;deltaTime=1000/60;
  function brushFixture(x=540,y=600,count=1) {
    resetForestBrushInteractions();doTick=true;isPaused=false;
    player=new Character(x,y,true);player.hp=100;player.dead=false;
    __bushes=Array.from({length:count},(_,i)=>({t:'WEED',x:600,y:600,s:1,r:.61,c:.7,
      forestSpecies:'BUSH',forestRegion:'TIMBER',forestHabitat:'VIBRANT',slot:i}));
    __brushChunk={cx:0,cy:0,decor:__bushes};
    chunkMgr={chunks:new Map([['0,0',__brushChunk]])};
    frameCount++;updateForestBrushInteractions(1000/60);
    __brushOriginal=JSON.stringify(__bushes);
  }
  function brushTick(x,y,dt=1000/60) {
    player.x=x;player.y=y;frameCount++;updateForestBrushInteractions(dt);
  }
  function brushGeometry(phase){
    __brushPaths=[];__brushSides=[];__brushTriangles=[];__brushBerries=[];
    beginShape=function(){__brushPaths.push([]);};
    vertex=function(x,y){__brushPaths[__brushPaths.length-1].push([x,y]);};
    quad=function(){__brushSides.push(Array.from(arguments));};
    triangle=function(){__brushTriangles.push(Array.from(arguments));};
    ellipse=function(){__brushBerries.push(Array.from(arguments));};
    paintForestClutter(window,__bushes[0],100,phase);
    return {paths:__brushPaths,sides:__brushSides,triangles:__brushTriangles,berries:__brushBerries};
  }
  brushFixture();
`);
assert.equal(P('player.checkCol(600,600)'),false,'bushes must not block the native player collision path');
const shade = P("brushGeometry('shadow')"), rested = P("brushGeometry('root')");
probe('brushTick(565,600);brushTick(580,600);brushTick(600,600);brushTick(620,600);');
assert(P('forestBrushState(__bushes[0]).x>.5'),'rightward player contact must bend the bush in that direction');
assert.equal(P('player.checkCol(600,600)'),false,'reacting shrubs must remain pass-through');
const bent = P("brushGeometry('root')");
assert.deepEqual(P("brushGeometry('shadow')"),shade,'contact shade must not move with the foliage');
assert.deepEqual(bent.paths,rested.paths,'low foliage rims must stay rooted while the raised ridges bend');
assert.deepEqual(bent.sides,rested.sides,'the rooted foliage skirts must keep their contact geometry');
assert(bent.triangles.some((a,i)=>a[4]!==rested.triangles[i][4]||a[5]!==rested.triangles[i][5]),
  'contact must actually alter raised leaf geometry');
const front=rested.paths[0].length;
for(let i=0;i<2;i++) {
  assert(Math.abs(bent.berries[i][0]-rested.berries[i][0]-(bent.triangles[front][4]-rested.triangles[front][4]))<1e-8 &&
    Math.abs(bent.berries[i][1]-rested.berries[i][1]-(bent.triangles[front][5]-rested.triangles[front][5]))<1e-8,
    'berries must stay attached to the bending front leaf ridge');
}
assert(P('JSON.stringify(__bushes)===__brushOriginal'),'brushing must never write spring state into generated decor');
const beforeRepeated=P('JSON.stringify(forestBrushState(__bushes[0]))');
probe('updateForestBrushInteractions(1000/60);');
assert.equal(P('JSON.stringify(forestBrushState(__bushes[0]))'),beforeRepeated,'a repeated frame must not double-step the spring');
probe('doTick=false;isPaused=true;brushTick(620,600);');
assert.equal(P('JSON.stringify(forestBrushState(__bushes[0]))'),beforeRepeated,'pause must freeze the reaction');
probe('doTick=true;isPaused=false;for(let i=0;i<180;i++)brushTick(620,600);');
assert(P('forestBrushState(__bushes[0])===null&&_forestBrushActive.length===0'),'idle foliage must settle and release active state');
assert.deepEqual(P("brushGeometry('root')"),rested,'settled foliage must return to the original artwork');

probe('brushFixture(660,600);brushTick(635,600);brushTick(615,600);');
assert(P('forestBrushState(__bushes[0]).x<-.5'),'opposite movement must reverse the brush direction');
probe('brushFixture(540,600);brushTick(660,600);');
assert(P('forestBrushState(__bushes[0]).x>0'),'a fast swept crossing must react even when both endpoints are outside');
probe('brushFixture(540,660);brushTick(660,660);');
assert(P('forestBrushState(__bushes[0])===null'),'nearby movement outside the footprint must not animate the bush');
probe('brushFixture(0,600);brushTick(600,600);');
assert(P('_forestBrushActive.length===0'),'teleports must not brush every bush along their travel path');
probe('brushFixture();brushTick(585,600);chunkMgr.chunks.delete("0,0");brushTick(585,600);');
assert(P('_forestBrushActive.length===0&&forestBrushState(__bushes[0])===null'),'evicting a chunk must release its reactions');
probe('brushFixture();brushTick(585,600);player.hp=0;brushTick(585,600);');
assert(P('_forestBrushActive.length===0&&_forestBrushManager===null'),'death must drop ephemeral brush state');

// A pathological crowd of props still cannot grow the spring budget or make
// the trigger scan all forty-nine resident chunks.
probe(`
  brushFixture(540,600,100);
  for(let cx=-3;cx<=3;cx++)for(let cy=-3;cy<=3;cy++){
    if(cx===0&&cy===0)continue;
    chunkMgr.chunks.set(cx+','+cy,{cx,cy,decor:Array.from({length:100},()=>({forestSpecies:'BUSH',x:cx*1200+600,y:cy*1200+600,s:1}))});
  }
  brushTick(585,600);
`);
assert(P('_forestBrushActive.length===FOREST_BRUSH_MAX_ACTIVE'),'active reactions must stay within their fixed budget');
assert(P('_forestBrushStats.chunks<=4&&_forestBrushStats.candidates===100'),'contact must only visit nearby chunk decor');
assert(P('JSON.stringify(__bushes)===__brushOriginal'),'bounded contact processing must preserve all generated records');
probe('resetForestBrushInteractions();');
assert(P('_forestBrushActive.length===0&&_forestBrushStats.active===0'),'reset must release all brush state');
console.log('Forest brushing passed: pass-through swept contact, directional bending, fixed roots/shade, settling, pause, eviction and bounded work.');

// Material contours must remain coherent at chunk cuts and never introduce
// fresh terrain, collision, lighting or gameplay randomness.
const assert=require('assert');
const {ctx,probe}=require('./harness');
let checks=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
probe(`isStoryMode=false;townsData={};startAtLevel(3);started=true;
 activeBuildings=[];activeParkingCars=[];colGrid=null;`);
for(const axis of ['X','Y'])for(const index of [-1,0,2])for(const u of [-9600,-4800,-1200,-156,0,156,1200,4800,9600]){
 const beds=Array.from(probe(`Array.from({length:7},(_,k)=>frontierCanyonBedding('${axis}',${u},${index},k))`));
 check(beds[0]===0&&beds[6]===222,'Bedding keeps the actual toe and rim fixed');
 check(beds.every(Number.isFinite)&&beds.slice(1).every((v,i)=>v>beds[i]+7),'All six stone beds have positive thickness');
 const near=Array.from(probe(`Array.from({length:7},(_,k)=>frontierCanyonBedding('${axis}',${u+.00001},${index},k))`));
 check(beds.every((v,i)=>Math.abs(v-near[i])<.001),'World bedding stays continuous across signed lattice and chunk coordinates');
 const wash=probe(`frontierCanyonWash('${axis}',${u},${index})`),p=probe(`frontierCanyonProfile('${axis}',${u},${index})`);
 check(Number.isFinite(wash.center)&&wash.width>20&&wash.width<70&&Math.abs(wash.center-p.center)+wash.width<p.floorHalf,'Dry wash stays inside its walkable canyon floor');
}
function recorder(){
 const shapes=[];let points=[],fill=[],stroke=null,weight=0;
 return {shapes,push(){},pop(){},fill(...v){fill=v;},stroke(...v){stroke=v;},noStroke(){stroke=null;},strokeWeight(v){weight=v;},
  beginShape(){points=[];},vertex(x,y){assert(Number.isFinite(x)&&Number.isFinite(y),'All baked vertices are finite');points.push([x,y]);},
  endShape(mode){if(points.length)shapes.push({points,fill:mode?fill:null,stroke,weight:stroke?weight:0,closed:!!mode});}};
}
function paint(axis,index,lo,hi){const g=recorder();ctx.canyonMaterialProbe=g;probe(`withBakedSun(()=>bakeFrontierCanyonGeology(canyonMaterialProbe,'${axis}',${index},${lo},${hi}));`);return g.shapes;}
function crosses(shapes,axis,seam){const component=axis==='X'?0:1;return shapes.filter(s=>{
 const v=s.points.map(p=>p[component]);return Math.min(...v)<=seam+1&&Math.max(...v)>=seam-1;
});}
for(const axis of ['X','Y'])for(const seam of [-4800,-1200,0,1200,4800]){
 const a=crosses(paint(axis,2,seam-1200,seam),axis,seam),b=crosses(paint(axis,2,seam,seam+1200),axis,seam);
 check(a.length>20,'Seam comparison samples actual rock and sediment geometry');
 assert.deepEqual(a,b,'Shared material features have identical world vertices/styles on both chunk sides: '+axis+' '+seam);checks++;
}
const first=paint('Y',2,0,1200);
probe('generateChunkContent(3,-8,6);generateChunkContent(3,9,-4);');
assert.deepEqual(paint('Y',2,0,1200),first,'Residency/generation order cannot change the baked material');checks++;
check(first.some(s=>s.weight>=3)&&first.some(s=>s.closed&&s.points.length>=5),'Rock grain survives the terrain texel scale and plates have filled irregular faces');
check(new Set(first.filter(s=>s.fill).map(s=>s.fill.join(','))).size>12,'Canyon material includes distinct lit rock, shade, silt and gravel tones');
const random=ctx.random;ctx.random=()=>{throw Error('Material painter consumed gameplay RNG');};
try{check(paint('X',2,-1200,0).length>100,'Material bake does not read gameplay randomness');}finally{ctx.random=random;}
const sun=probe('[LIGHT_DX,LIGHT_DY]');paint('Y',2,0,1200);
assert.deepEqual(Array.from(probe('[LIGHT_DX,LIGHT_DY]')),Array.from(sun),'Baked material shading restores the live sun');checks++;
console.log('Frontier canyon materials: '+checks+' contour, signed seam, material, RNG and lighting checks passed.');

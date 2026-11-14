// Ground materials must have the same identity on both sides of a streamed
// chunk border, including the negative-coordinate quadrants.
const assert=require('assert');
const {ctx,probe}=require('./harness');
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
ctx.materialRecorder=function(){
  let fill=[],stroke=[],weight=1,points=null;
  const commands=[];
  return {commands,noStroke(){stroke=[];},noFill(){fill=[];},
    fill(...v){fill=v;},stroke(...v){stroke=v;},strokeWeight(v){weight=v;},
    beginShape(){points=[];},vertex(x,y){points.push([x,y]);},
    endShape(close){commands.push({points,fill:fill.slice(),stroke:stroke.slice(),weight:stroke.length?weight:0,close});points=null;}};
};
function area(x0,y0,x1,y1,biome=3){
  return probe(`(()=>{const g=materialRecorder();bakeFrontierGroundArea(g,${biome},${x0},${y0},${x1},${y1});return g.commands;})()`);
}
function crossing(commands,axis,line,lo,hi){
  const perp=1-axis;
  return commands.filter(c=>{
    const p=c.points;
    const a=Math.min(...p.map(x=>x[axis])),b=Math.max(...p.map(x=>x[axis]));
    const u=Math.min(...p.map(x=>x[perp])),v=Math.max(...p.map(x=>x[perp]));
    return a<=line&&b>=line&&u<=hi&&v>=lo;
  });
}
for(const seam of [-2400,-1200,0,1200,2400]){
  for(const row of [-2400,-1200,0,1200]){
    const left=area(seam-1200,row,seam,row+1200),right=area(seam,row,seam+1200,row+1200);
    assert.deepStrictEqual(crossing(left,0,seam,row,row+1200),crossing(right,0,seam,row,row+1200),`Vertical material border at ${seam},${row}`);checks++;
    const top=area(row,seam-1200,row+1200,seam),bottom=area(row,seam,row+1200,seam+1200);
    assert.deepStrictEqual(crossing(top,1,seam,row,row+1200),crossing(bottom,1,seam,row,row+1200),`Horizontal material border at ${row},${seam}`);checks++;
  }
}
const kinds=new Set();
for(let iy=-9;iy<=9;iy++)for(let ix=-9;ix<=9;ix++){
  const feature=probe(`frontierGroundMaterial(${ix},${iy})`);
  kinds.add(feature.kind);
  const repeat=probe(`frontierGroundMaterial(${ix},${iy})`);
  assert.deepStrictEqual(feature,repeat,'Returning to a negative or positive material cell is deterministic');checks++;
  const commands=probe(`(()=>{const g=materialRecorder();frontierGroundBed(g,frontierGroundMaterial(${ix},${iy}));return g.commands;})()`);
  check(commands.length>=5,'Every material bed contains actual ridges, fractures or cut stone faces');
  for(const command of commands){
    check(command.points.length>=2&&command.points.every(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])),'Every contour uses finite world coordinates');
    check(command.points.every(p=>Math.abs(p[0]-feature.x)<290&&Math.abs(p[1]-feature.y)<290),'Every ridge, fracture and stone lies within the shared border reach');
  }
}
assert.deepStrictEqual([...kinds].sort(),['CRUST','SAND','SCREE']);checks++;
for(const biome of [1,2,4,5,6,7,8])check(area(-1200,-1200,1200,1200,biome).length===0,'Ground material is exclusive to Dry Gulch');
const commands=area(0,0,1200,1200);
check(commands.length<350,'The baked material layer keeps a bounded vector budget');
check(commands.some(c=>Math.max(...c.points.map(p=>p[0]))-Math.min(...c.points.map(p=>p[0]))>200),'Material reads as broad connected ground rather than isolated dot noise');
assert.deepStrictEqual(commands,area(0,0,1200,1200),'Rebaking cannot randomize the ground texture');checks++;
console.log(`Frontier ground materials: ${checks} checks passed.`);

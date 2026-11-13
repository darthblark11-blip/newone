// Roof height plans must reproduce source geometry under the live camera,
// retain native proxy encoding and reuse cached styles as the camera moves.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {ctx,probe}=require('./harness');
const {geometryKey}=require('./extract-building-lighting.cjs');
if(probe("typeof BuildingRoofLighting==='undefined'"))vm.runInContext(fs.readFileSync(__dirname+'/building3d/roof-lighting.js','utf8'),ctx);
const api=probe('BuildingRoofLighting'),asset=JSON.parse(fs.readFileSync(__dirname+'/../assets/buildings/roof-lighting.json'));
let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const near=(a,b,label,tolerance=.00003)=>{assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tolerance,label+': '+a+' vs '+b);checks++;};
const building={x:73,y:-47},local=[[0,0,20],[80,0,40],[80,60,60],[0,60,40]];
const mesh={faces:[{points:local.map(p=>[p[0]+building.x,p[1]+building.y,p[2]])}]};
const key=api.geometryKey(building,mesh);
ok(key===geometryKey([{points:local}]),'runtime and Blender extraction use the same stable geometry key');
const length=Math.hypot(.25,1/3,1),plane=[-.25/length,-1/3/length,1/length,-20/length];
const fixtureAsset={schema:1,quantization:10000,models:{[key]:{faces:[{points:local,plane,minZ:20,maxZ:60}]}}};
const imported=api.compilePlan(building,mesh,fixtureAsset),fallback=api.compilePlan(building,mesh,null);
ok(imported.source==='blender'&&fallback.source==='runtime','exported authored roofs and procedural fallback both compile');
for(const [ux,uy] of [[0,0],[.7,.62],[-1.5,-.9],[1.5,2.12]])for(const [x,y] of [[5,8],[40,30],[74,52]]) {
 const z=20+x*.25+y/3,X=x+ux*z,Y=y+uy*z;
 near(api.projectedHeight(imported.faces[0],X,Y,ux,uy,-136),z-136,'exported continuous projected height');
 near(api.projectedHeight(fallback.faces[0],X,Y,ux,uy,-136),z-136,'fallback continuous projected height');
}
const broken={schema:1,quantization:10000,models:{[key]:{faces:[{points:local,plane:[1,0,0,900],minZ:20,maxZ:60}]}}};
ok(api.compilePlan(building,mesh,broken).source==='runtime','invalid exported planes fall back safely');
const warped={faces:[{points:[[0,0,10],[80,0,20],[80,60,40],[0,60,50]].map(p=>[p[0]+building.x,p[1]+building.y,p[2]])}]};
ok(api.compilePlan(building,warped,null).faces.length===2,'non-planar procedural quad compiles to ordered triangles');

function recordingContext(){
 const stack=[],calls=[],m=[1,0,0,1,0,0];let vertices=[],style='original';
 const context={calls,gradients:0,
  save(){stack.push({m:m.slice(),style});},restore(){const s=stack.pop();m.splice(0,6,...s.m);style=s.style;},
  transform(a,b,c,d,e,f){const q=m.slice();m[0]=q[0]*a+q[2]*b;m[1]=q[1]*a+q[3]*b;m[2]=q[0]*c+q[2]*d;m[3]=q[1]*c+q[3]*d;m[4]=q[0]*e+q[2]*f+q[4];m[5]=q[1]*e+q[3]*f+q[5];},
  beginPath(){vertices=[];},moveTo(x,y){vertices.push([x,y]);},lineTo(x,y){vertices.push([x,y]);},closePath(){},
  fill(){calls.push({vertices:vertices.map(p=>p.slice()),matrix:m.slice(),style});},
  createLinearGradient(x0,y0,x1,y1){context.gradients++;const gradient={x0,y0,x1,y1,stops:[],addColorStop(t,color){this.stops.push([t,color]);}};return gradient;},
  set fillStyle(value){style=value;},get fillStyle(){return style;},depth:()=>stack.length};
 return context;
}
function colorAt(style,x,y){
 const parse=s=>s.slice(4,-1).split(',').map(Number);
 if(typeof style==='string')return parse(style);
 const dx=style.x1-style.x0,dy=style.y1-style.y0,t=Math.max(0,Math.min(1,((x-style.x0)*dx+(y-style.y0)*dy)/(dx*dx+dy*dy)));
 let left=style.stops[0],right=style.stops[style.stops.length-1];
 for(let i=1;i<style.stops.length;i++)if(t<=style.stops[i][0]){left=style.stops[i-1];right=style.stops[i];break;}
 const a=parse(left[1]),b=parse(right[1]),u=(t-left[0])/Math.max(1e-12,right[0]-left[0]);return a.map((v,i)=>v+(b[i]-v)*u);
}
const originalGround=ctx.groundElev,originalOrigin=ctx.glRigHeightOrigin,originalRange=ctx.glRigHeightRange;
let ground=0,origin=0,range=200,groundQueries=0;
ctx.groundElev=()=>{groundQueries++;return ground;};ctx.glRigHeightOrigin=()=>origin;ctx.glRigHeightRange=()=>range;
try{
 const target=recordingContext(),g={drawingContext:target};
 ok(api.draw(g,building,mesh,.7,.62,0),'production roof height painter draws to the supplied Canvas context');
 ok(groundQueries===1,'ground elevation is sampled once per building');
 const initialGradients=target.gradients,plan=api.plan(building,mesh),face=plan.faces[0];
 for(const [ux,uy] of [[.3,.4],[-1.1,.9],[1.5,2.12]])api.draw(g,building,mesh,ux,uy,0);
 ok(target.gradients===initialGradients,'moving camera lean reuses face-local CanvasGradient objects');
 ok(target.fillStyle==='original'&&target.depth()===0,'direct Canvas height rendering restores drawing state');
 const draw=target.calls[0],matrix=draw.matrix;
 for(let i=0;i<local.length;i++) {
  const q=draw.vertices[i],p=local[i];
  near(matrix[0]*q[0]+matrix[2]*q[1]+matrix[4],building.x+p[0]+.7*p[2],'cached path preserves live X parallax');
  near(matrix[1]*q[0]+matrix[3]*q[1]+matrix[5],building.y+p[1]+.62*p[2],'cached path preserves live Y parallax');
 }
 for(const [g0,o,r] of [[-250,-192,392],[170,0,200],[-136,-192,392],[300,0,200]]) {
  ground=g0;origin=o;range=r;api.draw(g,building,mesh,.7,.62,1);
  const style=target.calls[target.calls.length-1].style;
  for(let i=0;i<local.length;i++) {
   const q=[face.vertices[i*2],face.vertices[i*2+1]],color=colorAt(style,q[0],q[1]);
   near(color[0],Math.max(0,Math.min(255,(40+ground-origin)*255/range)),'cached native proxy preserves signed/clamped height bytes');
   near(color[1],(.13+.26)*255,'wet roof gloss channel matches the native material');near(color[2],0,'roof facing channel remains zero');
  }
 }
 const vertical={faces:[{points:[[0,0,10],[0,60,10],[0,60,50],[0,0,50]].map(p=>[p[0]+building.x,p[1]+building.y,p[2]])}]};
 const vplan=api.plan(building,vertical),vface=vplan.faces[0];
 near(api.projectedHeight(vface,.5*30,30, .5,.6),30,'vertical face retains actual height under parallax');
 ok(Number.isNaN(api.projectedHeight(vface,0,30,0,.6)),'edge-on vertical face has no false finite height');
 const before=target.calls.length;api.draw(g,building,vertical,0,.6,0);
 ok(target.calls.length===before,'edge-on polygons are skipped without drawing invalid gradients');
 ok(api.draw(null,building,mesh,.3,.6,0)===false,'missing Canvas context retains the native fallback');
}finally{ctx.groundElev=originalGround;ctx.glRigHeightOrigin=originalOrigin;ctx.glRigHeightRange=originalRange;}

// Check all authored geometry against independent barycentric vertex heights.
// Camera shifts and negative elevations must never change the represented roof.
let models=0,faces=0,maxError=0;
for(const model of Object.values(asset.models)) {
 const b={x:-901,y:773},mesh={faces:model.faces.map(f=>({points:f.points.map(p=>[p[0]+b.x,p[1]+b.y,p[2]])}))};
 const plan=api.compilePlan(b,mesh,asset);ok(plan.source==='blender','authored roof uses its validated Blender plan');models++;
 for(let i=0;i<model.faces.length;i++) {
  const points=model.faces[i].points,face=plan.faces[i];faces++;
  for(const [ux,uy] of [[.3,.62],[-1.1,.8],[1.3,-.4]]) {
   const a=points[0],b=points[1],c=points[2],x=a[0]*.2+b[0]*.3+c[0]*.5,y=a[1]*.2+b[1]*.3+c[1]*.5,z=a[2]*.2+b[2]*.3+c[2]*.5;
   const predicted=api.projectedHeight(face,x+ux*z,y+uy*z,ux,uy,-136);
   if(Number.isNaN(predicted))continue;
   maxError=Math.max(maxError,Math.abs(predicted-(z-136)));near(predicted,z-136,'authored roof barycentric height',.0002);
  }
 }
}
console.log(JSON.stringify({checks,models,faces,maxHeightError:maxError,diagnostics:api.getDiagnostics()},null,2));

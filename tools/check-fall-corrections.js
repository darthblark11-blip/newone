// Verify the real corpse drawing, including its transformed head/hair axis.
// FALL_LEGACY_GAME=/path/to/pre-refinement-game.js node tools/check-fall-corrections.js
const assert=require('assert'),fs=require('fs'),{execFileSync}=require('child_process');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let seed=479;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
 return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
probe('currentLevel=1;buildings=[];activeBuildings=[];activeParkingCars=[];barrels=[];invalidateColIndex();');
let matrix=[1,0,0,1,0,0],style={fill:null,stroke:null,weight:1},stack=[],draws=[],heads=[],headPaint=false;
const mul=u=>{const t=matrix;matrix=[t[0]*u[0]+t[2]*u[1],t[1]*u[0]+t[3]*u[1],t[0]*u[2]+t[2]*u[3],t[1]*u[2]+t[3]*u[3],t[0]*u[4]+t[2]*u[5]+t[4],t[1]*u[4]+t[3]*u[5]+t[5]];};
const color=a=>a.map(v=>v&&v.levels?[...v.levels]:v);
const round=v=>typeof v==='number'?Math.round(v*1e8)/1e8:v;
const originals={};
// New clothing and the corrected bald scalp are appearance changes. Compare
// the original body/limb/gib painters independently of that added layer.
if(process.argv.includes('--legacy-snapshot'))ctx.drawFallenAttire=()=>{};
for(const n of ['push','pop','translate','rotate','scale','fill','stroke','noFill','noStroke','strokeWeight','ellipse','rect','arc','line','quad','triangle','vertex','curveVertex','drawFigureHair'])originals[n]=ctx[n];
ctx.push=()=>{stack.push({matrix:[...matrix],style:{...style}});originals.push();};
ctx.pop=()=>{assert(stack.length,'unbalanced corpse pop');({matrix,style}=stack.pop());originals.pop();};
ctx.translate=(x,y)=>{mul([1,0,0,1,x,y]);originals.translate(x,y);};
ctx.rotate=a=>{mul([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);originals.rotate(a);};
ctx.scale=(x,y=x)=>{mul([x,0,0,y,0,0]);originals.scale(x,y);};
ctx.fill=(...a)=>{style.fill=color(a);originals.fill(...a);};
ctx.stroke=(...a)=>{style.stroke=color(a);originals.stroke(...a);};
ctx.noFill=()=>{style.fill=null;originals.noFill();};
ctx.noStroke=()=>{style.stroke=null;originals.noStroke();};
ctx.strokeWeight=w=>{style.weight=w;originals.strokeWeight(w);};
for(const n of ['ellipse','rect','arc','line','quad','triangle','vertex','curveVertex'])ctx[n]=(...a)=>{
 if(!(headPaint&&style.fill&&style.fill[0]===96&&style.fill[1]===6&&style.fill[2]===6))
  draws.push([n,a.map(round),matrix.map(round),JSON.parse(JSON.stringify(style))]);originals[n](...a);
};
ctx.drawFigureHair=(g,id,x,y,sway)=>{headPaint=true;heads.push({axis:[matrix[0],matrix[1]],position:[matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]]});originals.drawFigureHair(g,id,x,y,sway);};
function fixture(type,weapon,age=0,facing=.4,motion=-.9,eType='NORMAL'){
 const width=eType==='ARMORED'?105:21,height=eType==='ARMORED'?45:27;
 seed=479;probe(`frameCount=1000;corpses=[];particles=[];
 window.source={eType:'${eType}',isPlayer:false,isMoving:true,moveAngle:${motion},aimAngle:${facing},bodyW:${width},bodyH:${height},
  motionX:Math.cos(${motion})*4,motionY:Math.sin(${motion})*4,motionFrame:frameCount,
  fallHit:{frame:frameCount,kind:'BODY',weapon:WEAPONS.${weapon},angle:1.2,force:6,mx:Math.cos(${motion})*4,my:Math.sin(${motion})*4,wound:null}};
 window.c=new Corpse(0,0,source.moveAngle,source.aimAngle,color(70,110,170),color(58,65,84),${type},.7,[],WEAPONS.PISTOL,1.2,'${eType}',${width},${height},source);
 for(let i=0;i<${age};i++){frameCount++;c.update();}`);
 matrix=[1,0,0,1,0,0];style={fill:null,stroke:null,weight:1};stack=[];draws=[];heads=[];headPaint=false;
 probe('c.show();');assert.equal(stack.length,0);
 // Separate head marks, gradual pooling and the previously added heavy
 // face-down torso surface are appearance layers, separate from legacy motion.
 const bodyDraws=draws.filter(d=>!(type===7&&d[0]==='ellipse'&&(
  d[1][0]===-4&&d[1][1]===0&&d[3].fill&&d[3].fill[0]===90&&d[3].fill[1]===0&&d[3].fill[2]===0||
  d[1][1]===0&&d[1][2]===11&&d[1][3]===11||
  eType==='ARMORED'&&d[1][0]===0&&d[1][1]===0&&Math.abs(d[1][2]-height*1.08)<1e-8&&Math.abs(d[1][3]-width*.96)<1e-8)));
 return {state:P('({x:c.x,y:c.y,fP:c.fP,sep:c.sep,bits:c.bits,overkill:c.overkillBits,rag:c.rag&&{t:c.rag.t,done:c.rag.done,ang:c.rag.ang,limbs:c.rag.limbs.map(l=>[l.a,l.b,l.va,l.vb])}})'),draws:bodyDraws,heads:type===7?[]:heads};
}
if(process.argv.includes('--legacy-snapshot')){
 const snapshots=[];
 for(const eType of ['NORMAL','ARMORED'])for(const w of ['SHOTGUN','DUAL_SMG'])for(const type of [2,4,7,8,9,10])for(const age of [0,1,4,7,17,34,60])snapshots.push(fixture(type,w,age,.4,-.9,eType));
 process.stdout.write(JSON.stringify(snapshots));
}else{
 for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const backward of [false,true]){
  const facing=a+(backward?Math.PI:0),r=fixture(0,'PISTOL',40,facing,a);assert(r.heads.length);
  assert.equal(P('c.fall.faceDown'),!backward,'forward/back classification depends on map direction');
  const expected=a+(backward?Math.PI:0)+P('c.rag.ang'),axis=r.heads[0].axis;
  assert(Math.cos(expected)*axis[0]+Math.sin(expected)*axis[1]>.79,'head did not roll with the fall side');
  const head=r.heads[0].position;
  assert((head[0]-r.state.x)*Math.cos(a)+(head[1]-r.state.y)*Math.sin(a)>10,'head correction reversed the body');
  probe('window.hair={eType:"FEMALE_PISTOL",hairStyle:3,hairCol:color(55,33,20)};c.id=hair;');
  draws=[];heads=[];probe('c.show();');assert.equal(stack.length,0);
  assert(Math.cos(expected)*heads[0].axis[0]+Math.sin(expected)*heads[0].axis[1]>.79);
 }
 // A detached hat stays in its body/world frame when the head alone turns.
 fixture(0,'PISTOL',40,-Math.PI/2,Math.PI/2);
 probe('c.id={eType:"BANDIT"};c.hatOff={x:20,y:7,r:.5};');
 const hats=[],wear=ctx.drawHeadwear;ctx.drawHeadwear=(g,id,kind)=>{hats.push([...matrix]);wear(g,id,kind);};
 heads=[];probe('c.show();');ctx.drawHeadwear=wear;
 assert.equal(hats.length,1);assert.equal(stack.length,0);
 const yaw=P('c.fall.a+c.rag.ang'),head=heads[0].position;
 assert(Math.abs(hats[0][4]-head[0]-(Math.cos(yaw)*20-Math.sin(yaw)*7)*P('RAG_SCALE'))<1e-8);
 assert(Math.abs(hats[0][5]-head[1]-(Math.sin(yaw)*20+Math.cos(yaw)*7)*P('RAG_SCALE'))<1e-8);
 // Retired bodies use the same orientation on an off-screen graphics target.
 fixture(0,'PISTOL',40,-Math.PI/2,Math.PI/2);
 const g={...ctx,drawingContext:ctx.drawingContext};ctx.__target=g;heads=[];probe('c.show(__target);');assert(heads[0].axis[1]<0);assert.equal(stack.length,0);
 if(process.env.FALL_LEGACY_GAME){
  assert(fs.existsSync(process.env.FALL_LEGACY_GAME));
  const args=[__filename,'--legacy-snapshot'];
  const old=JSON.parse(execFileSync(process.execPath,args,{env:{...process.env,GAME_JS:process.env.FALL_LEGACY_GAME},maxBuffer:12*1024*1024}));
  const current=JSON.parse(execFileSync(process.execPath,args,{env:{...process.env,GAME_JS:require('path').join(__dirname,'../game.js')},maxBuffer:12*1024*1024}));
  assert.deepStrictEqual(current,old,'overkill state or transformed drawing differs from the pre-refinement version');
  console.log('Legacy comparison passed: 168 ordinary/heavy-armored shotgun/dual-SMG overkill snapshots match the previous state and transformed body drawing; clothing details, bald scalp, head marks and ground-puddle growth are checked separately.');
 }
 for(const [n,fn]of Object.entries(originals))ctx[n]=fn;
 console.log('Corpse head corrections passed: forward/back face orientation in every cardinal direction, unchanged body direction, long hair, detached hat placement, balanced transforms and graphics-target drawing.');
}

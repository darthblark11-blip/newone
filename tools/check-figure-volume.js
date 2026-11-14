// Trace the actual cel surfaces and their cubic paths. The rig tests retain
// anatomy/weapon pose checks; this checks the new art's volume, smooth joints,
// alpha, light direction and state balance without relying on source patterns.
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,fails=0;
function ok(name,value,detail){checks++;if(!value)fails++;console.log((value?'  ok   ':'  FAIL ')+name+(detail===undefined?'':'  '+detail));}
const cubic=(a,b,c,d,t)=>{const u=1-t;return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d;};
function capture(draw){
  const original={},names=['push','pop','translate','rotate','scale','fill','stroke','strokeWeight','noStroke','noFill',
    'ellipse','rect','quad','triangle','line','beginShape','vertex','bezierVertex','endShape'];
  for(const k of names)original[k]=ctx[k];
  const oldTransform=ctx.drawingContext.getTransform;
  let m=[1,0,0,1,0,0],state={rgba:[0,0,0,255],outlined:false,weight:1,filled:true};
  const stack=[],shapes=[],groups=[];let current=null,group=null,minDepth=0;
  const transform=(x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
  const mul=u=>{const t=m;m=[t[0]*u[0]+t[2]*u[1],t[1]*u[0]+t[3]*u[1],t[0]*u[2]+t[2]*u[3],t[1]*u[2]+t[3]*u[3],t[0]*u[4]+t[2]*u[5]+t[4],t[1]*u[4]+t[3]*u[5]+t[5]];};
  const rgba=a=>a.length===1&&a[0]&&a[0].levels?Array.from(a[0].levels):
    a.length===1?[a[0],a[0],a[0],255]:a.length===2?[a[0],a[0],a[0],a[1]]:[a[0],a[1],a[2],a.length>3?a[3]:255];
  function shape(kind,points,commands=[]){return {kind,points,commands,rgba:state.rgba.slice(),outlined:state.outlined,weight:state.weight,filled:state.filled,group};}
  function emit(s){shapes.push(s);if(group)group.shapes.push(s);}
  ctx.push=()=>stack.push({m:m.slice(),state:{...state,rgba:state.rgba.slice()}});
  ctx.pop=()=>{if(!stack.length){minDepth--;return;}const p=stack.pop();m=p.m;state=p.state;};
  ctx.translate=(x,y)=>mul([1,0,0,1,x,y]);
  ctx.rotate=a=>mul([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);
  ctx.scale=(x,y=x)=>mul([x,0,0,y,0,0]);
  ctx.fill=(...a)=>{state.rgba=rgba(a);state.filled=true;};
  ctx.stroke=()=>{state.outlined=true;};ctx.noStroke=()=>{state.outlined=false;};
  ctx.noFill=()=>{state.filled=false;};ctx.strokeWeight=w=>{state.weight=w;};
  ctx.ellipse=(x,y,w,h=w)=>{const p=[];for(let i=0;i<64;i++){const a=i*Math.PI/32;p.push(transform(x+Math.cos(a)*w/2,y+Math.sin(a)*h/2));}emit(shape('ellipse',p,[[x,y,w,h]]));};
  ctx.rect=(x,y,w,h=w)=>emit(shape('rect',[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(p=>transform(...p))));
  ctx.quad=(...a)=>emit(shape('quad',[0,2,4,6].map(i=>transform(a[i],a[i+1]))));
  ctx.triangle=(...a)=>emit(shape('triangle',[0,2,4].map(i=>transform(a[i],a[i+1]))));
  ctx.line=(...a)=>emit(shape('line',[transform(a[0],a[1]),transform(a[2],a[3])]));
  ctx.beginShape=()=>{current=shape('path',[],[]);};
  ctx.vertex=(x,y)=>{if(!current)return;current.points.push(transform(x,y));current.commands.push({kind:'move',point:transform(x,y)});};
  ctx.bezierVertex=(x1,y1,x2,y2,x,y)=>{
    if(!current||!current.points.length)return;
    const a=current.points[current.points.length-1],b=transform(x1,y1),c=transform(x2,y2),d=transform(x,y);
    current.commands.push({kind:'cubic',a,b,c,d});
    for(let i=1;i<=24;i++){const t=i/24;current.points.push([cubic(a[0],b[0],c[0],d[0],t),cubic(a[1],b[1],c[1],d[1],t)]);}
  };
  ctx.endShape=()=>{if(current)emit(current);current=null;};
  ctx.drawingContext.getTransform=()=>({a:m[0],b:m[1],c:m[2],d:m[3],e:m[4],f:m[5]});
  for(const key of ['figureCelOval','figureCelLimb']){
    original[key]=ctx[key];
    ctx[key]=function(){const prev=group;group={kind:key,args:Array.from(arguments).slice(1),shapes:[]};groups.push(group);
      try{return original[key].apply(this,arguments);}finally{group=prev;}};
  }
  try{probe(draw);}finally{Object.assign(ctx,original);if(oldTransform)ctx.drawingContext.getTransform=oldTransform;else delete ctx.drawingContext.getTransform;}
  const finite=shapes.every(s=>s.points.flat().every(Number.isFinite)&&s.rgba.every(Number.isFinite)&&Number.isFinite(s.weight));
  return {shapes,groups,finite,depth:stack.length,minDepth};
}
function centroid(points){
  let area=0,x=0,y=0;
  for(let i=0;i<points.length;i++){const p=points[i],q=points[(i+1)%points.length],a=p[0]*q[1]-q[0]*p[1];area+=a;x+=(p[0]+q[0])*a;y+=(p[1]+q[1])*a;}
  return Math.abs(area)>1e-9?[x/(3*area),y/(3*area)]:[0,0];
}
function inside(p,polygon){
  let odd=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[j],b=polygon[i],dx=b[0]-a[0],dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
    if(Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)<.005)return true;
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])odd=!odd;
  }
  return odd;
}
function smoothJoin(a,b){
  const x=[a.d[0]-a.c[0],a.d[1]-a.c[1]],y=[b.b[0]-b.a[0],b.b[1]-b.a[1]];
  return Math.hypot(a.d[0]-b.a[0],a.d[1]-b.a[1])<1e-9&&Math.hypot(x[0]-y[0],x[1]-y[1])<1e-9;
}
console.log('== rounded cel surfaces ==');
for(const [w,h,a] of [[20,32,255],[7,7,137],[60,36,0]]){
  const r=capture(`figureCelOval(window,2,3,${w},${h},[70,115,180,${a}],1,1,0);`),s=r.shapes;
  ok(w+'x'+h+' emits three finite surfaces',r.finite&&s.length===3);
  ok(w+'x'+h+' retains the exact outer ellipse',s[0].kind==='ellipse'&&JSON.stringify(s[0].commands[0])===JSON.stringify([2,3,w,h]));
  ok(w+'x'+h+' shades preserve the supplied alpha',s.every(p=>p.rgba[3]===a));
  ok(w+'x'+h+' outlines only the silhouette',s[0].outlined&&s.slice(1).every(p=>!p.outlined));
  ok(w+'x'+h+' curved planes stay inside the original mass',s.slice(1).every(p=>p.points.every(q=>Math.pow((q[0]-2)/(w/2),2)+Math.pow((q[1]-3)/(h/2),2)<1.002)));
}
{
  let light=true,shadow=true,finite=true;
  const L=P('[LIGHT_DX,LIGHT_DY]');
  for(let i=0;i<24;i++){
    const angle=i*Math.PI/12,r=capture(`push();rotate(${angle});figureCelOval(window,0,0,22,34,[100,120,150,255]);pop();`);
    const sh=centroid(r.shapes[1].points),hi=centroid(r.shapes[2].points);
    light&&=hi[0]*L[0]+hi[1]*L[1]<0;shadow&&=sh[0]*L[0]+sh[1]*L[1]>0;
    finite&&=r.finite&&r.depth===0&&r.minDepth===0;
  }
  ok('turning through 24 headings keeps the highlight toward the scene light',light);
  ok('and keeps the curved shadow on the far side',shadow);
  ok('light extraction and every draw leave transforms balanced',finite);
  const r=capture('push();rotate(.7);scale(1.3,.65);figureCelOval(window,0,0,22,34,[100,120,150,255]);pop();');
  const hi=centroid(r.shapes[2].points);ok('light remains in world space under rotation and nonuniform scale',hi[0]*L[0]+hi[1]*L[1]<0);
}
console.log('\n== connected joint surfaces ==');
for(const [name,p] of [['straight',[0,0,8,0,15,0]],['elbow',[0,0,8,0,10,7]],['acute',[0,0,8,0,3,5]],['zero upper',[0,0,0,0,7,2]],['zero fore',[0,0,8,0,8,0]]]){
  const r=capture(`figureCelLimb(window,${p.join(',')},7,5.5,4,[80,110,150,153]);`),s=r.shapes;
  ok(name+': one continuous outline and two unoutlined cel bands',r.finite&&s.length===3&&s[0].outlined&&s.slice(1).every(p=>!p.outlined));
  ok(name+': both sides cross the joint with continuous tangents',s.every(p=>{const c=p.commands.filter(q=>q.kind==='cubic');return c.length===6&&smoothJoin(c[0],c[1])&&smoothJoin(c[3],c[4]);}));
  const outside=s.slice(1).flatMap(p=>p.points.filter(q=>!inside(q,s[0].points)));
  ok(name+': shaded paths preserve alpha and remain inside the outer surface',s.every(p=>p.rgba[3]===153)&&!outside.length,
    outside.length?outside.length+' points outside: '+JSON.stringify(outside.slice(0,2)):undefined);
}
{
  // At the heading where light runs along the limb, its lit/shaded sides
  // exchange places. Sample the visible color at the same point on the sleeve
  // just before/after that crossing, so a hard side flip cannot pass merely
  // because it emitted the same two palette values in a different position.
  const light=P('[LIGHT_DX,LIGHT_DY]'),angle=Math.atan2(light[1],light[0]),base=[80,110,150];
  const samples=[];
  for(const delta of [-.001,0,.001]){
    const a=angle+delta,r=capture(`push();rotate(${a});figureCelLimb(window,0,0,8,0,15,0,7,5.5,4,[80,110,150,255]);pop();`);
    const x=8*Math.cos(a)-2*Math.sin(a),y=8*Math.sin(a)+2*Math.cos(a);
    let color=null;
    for(const s of r.shapes)if(s.filled&&inside([x,y],s.points))color=s.rgba.slice(0,3);
    samples.push(color);
  }
  const step=samples.every(Boolean)?Math.max(...base.map((_,i)=>Math.abs(samples[0][i]-samples[2][i]))):Infinity;
  ok('a turning sleeve has no visible color jump as its lit side changes',step<.15,'largest channel step '+step.toFixed(4));
  ok('the crossing fades through the base color before swapping sides',samples[1]&&samples[1].every((v,i)=>Math.abs(v-base[i])<1e-8));
}
{
  const r=capture('figureCelLimb(window,1,2,1,2,1,2,7,6,5,[80,100,130,99]);');
  ok('a collapsed two-bone pose uses a finite rounded cap',r.finite&&r.shapes[0].kind==='ellipse'&&r.shapes.every(s=>s.rgba[3]===99));
  const r2=capture('volShadeCol(0,0,20,30,color(70,115,180,137),1,1,0);');
  ok('legacy color entry points retain model transparency',r2.shapes.every(s=>s.rgba[3]===137));
}
console.log('\n== real entities and action states ==');
probe(`isStoryMode=false;townsData={};startAtLevel(2);started=true;doTick=false;
viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0};
swordPickedUp=false;setMeleeTool("NONE");chemistSuitUnlocked=false;explosiveArmorUnlocked=false;ninjaSuitUnlocked=false;`);
const types=['NORMAL','FEMALE_PISTOL','NM0_ROOKIE','NM0_ROOKIE_F','ARMORED_STANDARD','CITY_CITIZEN_M','CITY_CITIZEN_F',
  'BANDIT','MOLOTOV','SIA','ROBOT','ARMORED','AERIAL','AERIAL_PISTOL','COW','HORSE','BUG','SNAIL','SNAIL_HYBRID','ALIEN_GATOR','SAUCER','SAUCER_RED'];
let empty=[],nonfinite=[],unbalanced=[],mutated=[];
for(const type of types)for(const gait of [0,.2,.5,1]){
  probe(`window.__figure=new Character(0,0,false,${JSON.stringify(type)});__figure.isMoving=${gait>0};__figure.gait=${gait};__figure.walkCycle=1.2;__figure.aimAngle=.83;`);
  const state=P('JSON.stringify([__figure.x,__figure.y,__figure.hp,__figure.bodyW,__figure.bodyH,__figure.ammo,__figure.reloadTimer,__figure.cannonCharge,__figure.currentWeapon,__figure.shirtCol.levels,__figure.pantsCol.levels])');
  const r=capture('__figure.show();'),key=type+' '+gait;
  if(!r.groups.length)empty.push(key);if(!r.finite)nonfinite.push(key);if(r.depth||r.minDepth)unbalanced.push(key);
  if(state!==P('JSON.stringify([__figure.x,__figure.y,__figure.hp,__figure.bodyW,__figure.bodyH,__figure.ammo,__figure.reloadTimer,__figure.cannonCharge,__figure.currentWeapon,__figure.shirtCol.levels,__figure.pantsCol.levels])'))mutated.push(key);
}
ok('all 22 entity forms use dimensional surfaces at idle, walk, jog and run',!empty.length,empty.join(',')||'88 poses');
ok('every actual entity path and shade color remains finite',!nonfinite.length,nonfinite.join(',')||'88 poses');
ok('every entity restores its transform stack',!unbalanced.length,unbalanced.join(',')||'88 poses');
ok('rendering preserves position, health, rig, weapon, action timers and palette',!mutated.length,mutated.join(',')||'88 poses');
let actionsFinite=true,actionsBalanced=true,states=0;
for(const weapon of ['PISTOL','DUAL_SMG','ASSAULT_RIFLE','BOW'])for(const action of ['carry','aim','reload','throw','cannon','boxing','fall']){
  probe(`player.x=0;player.y=0;player.isMoving=true;player.gait=.8;player.walkCycle=1.3;player.isArmed=true;player.currentWeapon=WEAPONS.${weapon};
    player.aimHold=0;player.reloadTimer=0;player.throwAnimTimer=0;player.cannonCharge=0;player.cannonFireDelay=0;player.boxingHold=0;player.stunTimer=0;player.meleeTimer=0;
    rightStick.active=false;chemistSuitUnlocked=false;
    ${action==='aim'?'rightStick.active=true;player.aimHold=AIM_HOLD;':''}
    ${action==='reload'?'player.reloadTimer=45;':''}
    ${action==='throw'?'player.throwAnimTimer=8;':''}
    ${action==='cannon'?'chemistSuitUnlocked=true;player.cannonCharge=60;':''}
    ${action==='boxing'?'player.isArmed=false;player.boxingHold=180;':''}
    ${action==='fall'?'startPunchStun(player,.3);player.stunPose.age=30;player.stunTimer=100;':''}`);
  const r=capture('player.show();');actionsFinite&&=r.finite;actionsBalanced&&=r.depth===0&&r.minDepth===0;states++;
}
ok('carry, aim, reload, throw, cannon, boxing and falls emit finite geometry',actionsFinite,states+' weapon/action poses');
ok('all action branches restore painter transforms',actionsBalanced,states+' weapon/action poses');
console.log('\n'+(checks-fails)+'/'+checks+' checks passed');process.exitCode=fails?1:0;

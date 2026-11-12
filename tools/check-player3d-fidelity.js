// Compare the live mesh pose with the original painter's actual projected
// anatomy. This deliberately records native drawing calls, rather than
// blessing finite matrices or duplicating the replacement pose arithmetic.
const assert = require('node:assert/strict');
const {ctx, probe} = require('./harness');
const P = source => probe('(' + source + ')');
const failures=[];let checks=0,poses=0,maxPointError=0,maxHeadingError=0;
const close=(a,b,tolerance=.025)=>Math.hypot(a.x-b.x,a.y-b.y)<=tolerance;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function check(value,label){checks++;if(!value)failures.push(label);}
function pointCheck(actual,expected,label,tolerance=.025){
 const error=actual&&expected?Math.hypot(actual.x-expected.x,actual.y-expected.y):Infinity;
 maxPointError=Math.max(maxPointError,error);check(error<=tolerance,label+' (error '+error.toFixed(4)+')');
}

probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
 inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
 currentLevel=currentBiome=2;BIOME_ACTIVE=false;isStoryMode=false;
 window.inNM0SecretOverlay=false;buildGhost=null;resetUndergroundRoute();
 setMeleeTool('NONE');swordPickedUp=false;window.shovelOwned=window.pickaxeOwned=false;
 chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
 isCooking=meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;
 leftStick={active:false,dx:0,dy:0,dist:0};rightStick={active:false,dx:0,dy:0,dist:0};
 buildings=activeBuildings=[];barrels=[];activeParkingCars=[];enemiesList=[];
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;`);

function fresh({aim=0,travel=0,gait=.6,phase=.7,weapon='PISTOL',armed=false,presentation=0,stance='STAND'}={}){
 probe(`player=new Character(0,0,true);player.aimAngle=${aim};player.moveAngle=${travel};
  player.gait=${gait};player.walkCycle=${phase};player.isMoving=${gait>0};player.isArmed=${armed};
  player.currentWeapon=WEAPONS[${JSON.stringify(weapon)}];player.aimHold=${presentation>0?14:0};
  player.meleeTimer=player.reloadTimer=player.dashTimer=player.muzzleFlash=player.hitFlash=0;
  player._weaponPresentation=${armed?'{value:'+presentation+'}':'null'};
  resetActorStance(player,${JSON.stringify(stance)});frameCount++;
  leftStick.active=${gait>0};rightStick.active=${armed&&presentation>0};
  for(let i=0;i<130;i++){frameCount++;updateStandingFacing(player,1000/60);updateCrouchFacing(player,1000/60);}`);
}

function nativeTrace(){
 const old={},dc=ctx.drawingContext,oldDC={},limbs=[],ovals=[],heads=[],stack=[];
 let m=[1,0,0,1,0,0];
 const save=()=>stack.push(m.slice()),restore=()=>{assert.ok(stack.length,'native transform stack');m=stack.pop();};
 const multiply=u=>{const a=m;m=[a[0]*u[0]+a[2]*u[1],a[1]*u[0]+a[3]*u[1],a[0]*u[2]+a[2]*u[3],a[1]*u[2]+a[3]*u[3],a[0]*u[4]+a[2]*u[5]+a[4],a[1]*u[4]+a[3]*u[5]+a[5]];};
 const point=(x,y)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
 const transforms={push:save,pop:restore,translate:(x,y)=>multiply([1,0,0,1,x,y]),
  rotate:a=>multiply([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]),scale:(x,y=x)=>multiply([x,0,0,y,0,0]),applyMatrix:(...u)=>multiply(u)};
 for(const [key,value] of Object.entries(transforms)){old[key]=ctx[key];ctx[key]=value;}
 for(const [key,value] of Object.entries({save,restore,translate:transforms.translate,rotate:transforms.rotate,scale:transforms.scale,
  transform:(...u)=>multiply(u),getTransform:()=>({a:m[0],b:m[1],c:m[2],d:m[3],e:m[4],f:m[5]})})){
  oldDC[key]=dc[key];dc[key]=value;
 }
 for(const key of ['figureCelLimb','figureCelOval','drawFigureHead'])old[key]=ctx[key];
 const rgb=c=>c&&c.levels?Array.from(c.levels).slice(0,3):Array.from(c||[]).slice(0,3);
 ctx.figureCelLimb=(g,sx,sy,ex,ey,hx,hy,w0,w1,w2,c)=>limbs.push({shoulder:point(sx,sy),elbow:point(ex,ey),hand:point(hx,hy),widths:[w0,w1,w2],color:rgb(c)});
 ctx.figureCelOval=(g,x,y,w,h,c)=>ovals.push({center:point(x,y),width:w,height:h,matrix:m.slice(),color:rgb(c)});
 // The base native head painter uses an 11-unit oval; preserve its parent
 // transform so lowered/elevated heads are compared at their actual size.
 ctx.drawFigureHead=(g,c,x,y)=>{const center=point(x,y);heads.push({...center,center,width:11,height:11,matrix:m.slice()});};
 const enabled=P('Player3D.enabled');
 try{probe('Player3D.enabled=false;player.show();');}
 finally{
  probe('Player3D.enabled='+JSON.stringify(enabled));Object.assign(ctx,old);
  for(const [key,value] of Object.entries(oldDC)){if(value===undefined)delete dc[key];else dc[key]=value;}
 }
 assert.equal(stack.length,0,'native painter restores its transforms');
 const same=(a,b)=>a.every((x,i)=>Math.abs(x-b[i])<1);
 let arms=limbs.filter(l=>l.color[0]>100&&l.color[1]<80&&l.color[2]<80);
 // Low stances deliberately draw upper/fore sleeves separately around the
 // native elbow. Recombine those records into their anatomical two-bone chain.
 if(arms.length===4&&close(arms[0].hand,arms[1].shoulder)&&close(arms[2].hand,arms[3].shoulder))
  arms=[0,2].map(i=>({shoulder:arms[i].shoulder,elbow:arms[i].hand,hand:arms[i+1].hand,
   widths:[arms[i].widths[0],arms[i].widths[2],arms[i+1].widths[2]]}));
 return {arms,legs:limbs.filter(l=>same(l.color,[30,80,180])),
  hands:ovals.filter(o=>same(o.color,[235,180,140])),boots:ovals.filter(o=>same(o.color,[16.5,44,99])),
  torso:ovals.filter(o=>same(o.color,[200,30,30])).sort((a,b)=>b.width*b.height-a.width*a.height)[0],head:heads[0]};
}

function transformedWidth(part,asset){
 const m=part.matrix,dx=m[0],dy=m[1],length=Math.hypot(dx,dy);if(length<.01)return null;
 const nx=-dy/length,ny=dx/length,p=asset.positions;let low=Infinity,high=-Infinity;
 for(let i=0;i<p.length;i+=3){const x=m[0]*p[i]+m[4]*p[i+1]+m[8]*p[i+2],y=m[1]*p[i]+m[5]*p[i+1]+m[9]*p[i+2];
  const v=x*nx+y*ny;low=Math.min(low,v);high=Math.max(high,v);}
 return high-low;
}
const asset=P('PLAYER3D_ASSET');
function projectedSpan(part,heading){
 const m=part.matrix,p=asset.meshes[part.mesh].positions,nx=Math.cos(heading),ny=Math.sin(heading);
 let lo=Infinity,hi=-Infinity;
 for(let i=0;i<p.length;i+=3){const x=m[0]*p[i]+m[4]*p[i+1]+m[8]*p[i+2],y=m[1]*p[i]+m[5]*p[i+1]+m[9]*p[i+2];
  const v=x*nx+y*ny;lo=Math.min(lo,v);hi=Math.max(hi,v);}
 return hi-lo;
}
function projectedCenter(part,heading){
 const m=part.matrix,p=asset.meshes[part.mesh].positions,co=Math.cos(heading),si=Math.sin(heading);
 let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
 for(let i=0;i<p.length;i+=3){
  const x=m[0]*p[i]+m[4]*p[i+1]+m[8]*p[i+2]+m[12],y=m[1]*p[i]+m[5]*p[i+1]+m[9]*p[i+2]+m[13];
  const u=co*x+si*y,v=-si*x+co*y;
  x0=Math.min(x0,u);x1=Math.max(x1,u);y0=Math.min(y0,v);y1=Math.max(y1,v);
 }
 const u=(x0+x1)*.5,v=(y0+y1)*.5;
 return {x:co*u-si*v,y:si*u+co*v};
}
function compareOval(part,reference,label){
 const m=reference.matrix,heading=Math.atan2(m[1],m[0]);
 const length=reference.width*Math.hypot(m[0],m[1]),width=reference.height*Math.hypot(m[2],m[3]);
 const meshLength=projectedSpan(part,heading),meshWidth=projectedSpan(part,heading+Math.PI/2);
 pointCheck(projectedCenter(part,heading),reference.center,label+' visible surface center',.2);
 check(meshLength>=length*.88&&meshLength<=length*1.12,label+' retains native length');
 check(meshWidth>=width*.88&&meshWidth<=width*1.12,label+' retains native width');
}
function compare(label,{stance='STAND'}={}){
 poses++;
 const native=nativeTrace(),snapshot=P('player3DPose(player)'),s=snapshot.sockets;
 pointCheck(s.head,native.head,label+' head follows native body frame');
 const head=snapshot.parts.find(p=>p.part==='head');if(head)compareOval(head,native.head,label+' head');
 const torso=snapshot.parts.find(p=>p.part==='torso');
 pointCheck({x:torso.matrix[12],y:torso.matrix[13]},native.torso.center,label+' torso follows native bob/lean');
 const nativeChestAngle=Math.atan2(native.torso.matrix[1],native.torso.matrix[0]);
 const lateralAngle=Math.atan2(torso.matrix[5],torso.matrix[4])-Math.PI/2;
 const headingError=Math.abs(wrap(lateralAngle-nativeChestAngle));maxHeadingError=Math.max(maxHeadingError,headingError);
 check(headingError<.025,label+' chest follows native yaw ('+headingError.toFixed(4)+')');
 const bodyDepth=native.torso.width*Math.hypot(native.torso.matrix[0],native.torso.matrix[1]);
 const bodyWidth=native.torso.height*Math.hypot(native.torso.matrix[2],native.torso.matrix[3]);
 const meshDepth=projectedSpan(torso,nativeChestAngle),meshWidth=projectedSpan(torso,nativeChestAngle+Math.PI/2);
 check(meshDepth>=bodyDepth*.85&&meshDepth<=bodyDepth*1.15,label+' torso retains native front-to-back proportion');
 check(meshWidth>=bodyWidth*.85&&meshWidth<=bodyWidth*1.15,label+' torso retains native shoulder width');
 // Native sleeves are authored left then right in both standing and low poses.
 const arms=native.arms.slice(0,2);
 check(arms.length===2,label+' has two native sleeve references');
 for(let i=0;i<arms.length;i++){
  const side=i?'right':'left',a=arms[i];
  pointCheck(s[side+'Shoulder'],a.shoulder,label+' '+side+' shoulder');
  pointCheck(s[side+'Elbow'],a.elbow,label+' '+side+' elbow');
  pointCheck(s[side+'Hand'],a.hand,label+' '+side+' wrist');
  const upper=snapshot.parts.find(p=>p.part==='upper_arm_'+side),fore=snapshot.parts.find(p=>p.part==='forearm_'+side);
  if(upper&&fore){
   const upperWidth=transformedWidth(upper,asset.meshes[upper.mesh]),foreWidth=transformedWidth(fore,asset.meshes[fore.mesh]);
   if(upperWidth!==null)check(upperWidth>=a.widths[0]*.89&&upperWidth<=a.widths[0]*1.18,label+' '+side+' upper sleeve retains native mass');
   if(foreWidth!==null)check(foreWidth>=a.widths[1]*.89&&foreWidth<=a.widths[1]*1.18,label+' '+side+' forearm retains native mass');
  }
  const hand=snapshot.parts.find(p=>p.part==='hand_'+side);
  const nativeHand=native.hands.find(h=>close(h.center,a.hand));
  check(!!nativeHand,label+' '+side+' has an original palm reference');
  if(hand&&nativeHand)compareOval(hand,nativeHand,label+' '+side+' hand');
 }
 native.boots.slice(0,2).forEach((boot,i)=>{const side=i?'right':'left',part=snapshot.parts.find(p=>p.part==='foot_'+side);
  check(!!part,label+' '+side+' has a boot mesh');if(part)compareOval(part,boot,label+' '+side+' boot');});
 check(native.boots.length===2,label+' has two original boot references');
 if(stance==='STAND'){
  native.legs.slice(0,2).forEach((leg,i)=>{const side=i?'right':'left';
   pointCheck(s[side+'Hip'],leg.shoulder,label+' '+side+' hip');
   pointCheck(s[side+'Knee'],leg.elbow,label+' '+side+' knee');
   pointCheck(s[side+'Ankle'],leg.hand,label+' '+side+' ankle');});
  const lower=P('standingLowerPose(player)'),pelvis=snapshot.parts.find(p=>p.part==='pelvis');
  if(lower&&pelvis){const heading=Math.atan2(pelvis.matrix[5],pelvis.matrix[4])-Math.PI/2;
   check(Math.abs(wrap(heading-lower.angle))<.025,label+' pelvis retains independent locomotion heading');}
 } else {
  const joints=P(`(()=>{const b=stanceBodyPose(player),a=stanceFacingAngle(player),co=Math.cos(a),si=Math.sin(a),lift=proneDiveLift(player);
   const project=p=>({x:(co*p.x-si*p.y)*b.size,y:(si*p.x+co*p.y)*b.size-lift});
   return b.joints.map(j=>({hip:project(j.hip),knee:project(j.knee),ankle:project(j.ankle)}));})()`);
  joints.forEach((leg,i)=>{const side=i?'right':'left';
   pointCheck(s[side+'Hip'],leg.hip,label+' '+side+' lowered hip');
   pointCheck(s[side+'Knee'],leg.knee,label+' '+side+' lowered knee');
   pointCheck(s[side+'Ankle'],leg.ankle,label+' '+side+' lowered ankle');});
 }
 if(stance==='PRONE'){
  const aim=P('stanceFacingAngle(player)'),front={x:Math.cos(aim),y:Math.sin(aim)};
  check((s.head.x-s.pelvis.x)*front.x+(s.head.y-s.pelvis.y)*front.y>0,label+' prone head stays toward aim');
  check((s.leftAnkle.x-s.head.x)*front.x+(s.leftAnkle.y-s.head.y)*front.y<0,label+' prone feet remain behind head');
 }
 if(P('player.isArmed')){
  const muzzle=P('aimLaserMuzzle(player,0)');pointCheck(s.muzzle,muzzle,label+' projectile origin',.001);
 }
 const before=P('JSON.stringify(player)');P('player3DPose(player)');
 check(P('JSON.stringify(player)')===before,label+' pose sampling preserves animation state');
}

for(const gait of [.25,.65,1])for(const phase of [.4,2.1])for(const relative of [0,Math.PI/2,Math.PI]){
 const sample={aim:.37,travel:.37+relative,gait,phase};fresh(sample);compare('unarmed '+[gait,phase,relative].join('/'));
 for(const weapon of ['PISTOL','ASSAULT_RIFLE'])for(const presentation of [0,.5,1]){
  fresh({...sample,armed:true,weapon,presentation});compare(weapon+' '+[gait,phase,relative,presentation].join('/'));
 }
}
for(const stance of ['CROUCH','PRONE'])for(const aim of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const gait of [0,.65]){
 fresh({aim,travel:aim,gait,phase:.8,armed:true,weapon:'ASSAULT_RIFLE',presentation:1,stance});
 compare(stance+' '+[aim,gait].join('/'),{stance});
}
// First-frame/legacy actors can present before a presentation spring exists.
for(const weapon of ['PISTOL','ASSAULT_RIFLE'])for(const gait of [0,1]){
 fresh({aim:.4,travel:1.1,gait,phase:.8,armed:true,weapon,presentation:1});
 probe('player._weaponPresentation=null;');compare('uncached '+weapon+' gait '+gait);
}
// Turning the aim thumb must move the shoulders while planted hips retain
// their simulation heading until the locomotion controller itself advances.
fresh({aim:.1,travel:.1,gait:.65,phase:.9,armed:true,presentation:1});
const beforeTurn=P('player3DPose(player)'),hipBefore=beforeTurn.parts.find(p=>p.part==='pelvis').matrix;
const chestBefore=beforeTurn.parts.find(p=>p.part==='torso').matrix;
probe('player.aimAngle+=.6;');compare('aim turns independently of planted hips');
const afterTurn=P('player3DPose(player)'),hipAfter=afterTurn.parts.find(p=>p.part==='pelvis').matrix;
const chestAfter=afterTurn.parts.find(p=>p.part==='torso').matrix;
const heading=m=>Math.atan2(m[5],m[4])-Math.PI/2;
check(Math.abs(wrap(heading(hipAfter)-heading(hipBefore)))<.00001,'same-frame aim input preserves native planted hip heading');
check(Math.abs(wrap(heading(chestAfter)-heading(chestBefore))-.6)<.00001,'same-frame aim input turns the chest independently');
for(const backward of [false,true])for(const elapsed of [1,12,60]){
 fresh({aim:.1,travel:.1+(backward?Math.PI:0),gait:.65,phase:1.2,armed:true,presentation:.4});
 probe(`player.isMoving=false;leftStick.active=false;for(let i=0;i<${elapsed};i++){frameCount++;updateStandingFacing(player,1000/60);}`);
 compare((backward?'rear':'forward')+' stopped '+elapsed+' frames');
}
console.log(JSON.stringify({checks,poses,failures:failures.length,maxPointError,maxHeadingError,examples:failures.slice(0,18),
 stopExamples:failures.filter(s=>/stopped|planted/.test(s)).slice(0,18)},null,2));
if(!process.argv.includes('--report-only'))assert.equal(failures.length,0,'The 3D pose must preserve the original visible animation anatomy');

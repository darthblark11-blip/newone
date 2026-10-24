// Low stance artwork uses real joint folds and a shared rigid weapon mount.
// These checks protect readable anatomy and the support/recovery crawl cycle.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
ctx.setTimeout=()=>0;
probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=false;
 inLvl4Cutscene=inUpgradeMenu=false;currentLevel=currentBiome=2;BIOME_ACTIVE=false;
 window.inNM0SecretOverlay=false;buildGhost=null;resetUndergroundRoute();
 ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0};
 setMeleeTool('NONE');player=new Character(70,90,true);player.isArmed=true;
 player.currentWeapon=WEAPONS.ASSAULT_RIFLE;player.aimHold=player.muzzleFlash=player.reloadTimer=0;
 player.meleeTimer=player.dashTimer=player.weaponKick=0;player.walkCycle=0;player.aimAngle=0;`);
function body(stance,moving=false,cycle=0,aim=false) {
 probe(`resetActorStance(player,'${stance}');player.isMoving=${moving};player.walkCycle=${cycle};
  player.aimHold=${aim?14:0};rightStick.active=false;player.muzzleFlash=0;`);
 return P('stanceBodyPose(player)');
}

const crouch=body('CROUCH');
ok('crouch lowers camera height uniformly without flattening the actor',
 P('actorStancePose(player).scaleX===actorStancePose(player).scaleY')&&crouch.size>.9&&crouch.size<1);
ok('crouch retains the native torso depth instead of stretching it into a pose',
 Math.abs(crouch.torsoLength-P('player.bodyW*TORSO_DEPTH'))<1e-8);
ok('crouched chest and head lean forward from the hips',
 crouch.hipX<crouch.chestX&&crouch.chestX<crouch.head.x);
ok('each knee folds forward of both hip and ankle, with visible trouser contours',crouch.joints.every(j=>
 j.knee.x>j.hip.x+5&&j.knee.x>j.ankle.x+5&&
 Math.abs(j.knee.y)+crouch.R.shinW*.5>crouch.torsoWidth*.5&&
 j.hip.y*j.knee.y>0&&j.knee.y*j.ankle.y>0));

const scales=[],nativeScale=ctx.scale;
ctx.scale=(x,y)=>scales.push([x,y===undefined?x:y]);
probe('drawCombatStanceFigure(player,actorStancePose(player));');ctx.scale=nativeScale;
ok('the real crouch renderer never squashes the body canvas on one axis',
 scales.length>0&&scales.every(([x,y])=>Math.abs(x-y)<1e-8));

const prone=body('PRONE');
ok('prone torso is shorter than the old stretched silhouette',prone.torsoLength<P('player.bodyW*1.1'));
ok('prone legs have substantial thighs and shins relative to the torso',prone.joints.every(j=>{
 const thigh=distance(j.hip,j.knee),shin=distance(j.knee,j.ankle);
 return thigh>prone.torsoLength*.4&&shin>prone.torsoLength*.4&&
  thigh+shin>prone.torsoLength&&thigh/shin>.6&&thigh/shin<1.6;
}));
ok('stationary prone places both legs behind the pelvis and shoulders ahead',prone.joints.every(j=>
 j.ankle.x<j.knee.x&&j.knee.x<j.hip.x&&j.hip.x<j.shoulder.x));
ok('neutral prone centers the head instead of inheriting a cheek weld',prone.head.y===0);
const aimed=body('PRONE',false,0,true);
ok('active aiming adds a head offset while retaining its forward neck position',
 Math.abs(aimed.head.y)>2&&Math.abs(aimed.head.x-prone.head.x)<2);
body('PRONE');
ok('a stationary prone figure has no residual crawl sway',
 P('stanceBodyPose(player).yaw===0&&stanceBodyPose(player).joints.every(j=>j.support.reach===0&&j.support.lift===0)'));

const TAU=Math.PI*2;
const elbow=t=>P(`stanceElbowCycle(${t*TAU},true)`);
const early=elbow(.1),late=elbow(.6),recover=elbow(.82);
ok('a planted elbow pulls rearward while staying on the floor',early.reach>late.reach&&early.lift===0&&late.lift===0);
ok('recovery advances the elbow along an outward arc instead of sliding the whole actor',
 recover.lift>1&&elbow(.98).reach>elbow(.68).reach);
ok('the elbow cycle joins continuously at contact and recovery boundaries',
 [0,.64,1].every(t=>{const a=elbow(t-1e-6),b=elbow(t+1e-6);return Math.abs(a.reach-b.reach)<.001&&Math.abs(a.lift-b.lift)<.001;}));
const derivativeStep=1e-5;
ok('elbow recovery meets the planted floor with continuous velocity',
 [0,.64,1].every(t=>{
  const a=elbow(t-derivativeStep),b=elbow(t),c=elbow(t+derivativeStep);
  return ['reach','lift'].every(key=>Math.abs((b[key]-a[key])/derivativeStep-(c[key]-b[key])/derivativeStep)<.01);
 }));
ok('forward and rearward elbow pulls ease their acceleration at contact changes',
 [0,.64,1].every(t=>{
  const h=derivativeStep,a=elbow(t-2*h),b=elbow(t-h),c=elbow(t),d=elbow(t+h),e=elbow(t+2*h);
  return Math.abs((c.reach-2*b.reach+a.reach)/(h*h))<.25&&Math.abs((e.reach-2*d.reach+c.reach)/(h*h))<.25;
 }));
const first=body('PRONE',true,0),second=body('PRONE',true,Math.PI/.65);
ok('half a crawl cycle exchanges leading elbows and opposite knee drive',
 first.joints[1].elbow.x>first.joints[0].elbow.x&&second.joints[0].elbow.x>second.joints[1].elbow.x&&
 first.joints[0].knee.x>first.joints[1].knee.x&&second.joints[1].knee.x>second.joints[0].knee.x);
ok('pelvis and chest counter-rotate under alternating support',first.yaw*second.yaw<0&&
 [first,second].every(b=>Math.sign(b.joints[1].hip.x-b.joints[0].hip.x)===Math.sign(b.yaw)));
ok('the crawl leaves the actor root fixed rather than adding lateral wobble',P('player.x===70&&player.y===90'));
ok('opposite knee recovery has no velocity kick as it starts or finishes its fold',
 [.32,.82].every(t=>{
  const h=derivativeStep,point=q=>body('PRONE',true,q*TAU/.65).joints[1].knee;
  const a=point(t-h),b=point(t),c=point(t+h);
  return ['x','y'].every(key=>Math.abs((b[key]-a[key])/h-(c[key]-b[key])/h)<.05);
 }));

for(const key of ['PISTOL','ASSAULT_RIFLE','SHOTGUN']) {
 probe(`player.currentWeapon=WEAPONS.${key};`);body('PRONE',true,1.7,false);
 const neutral=P('stanceWeaponMount(player)');
 probe('player.aimHold=14;');const aim=P('stanceWeaponMount(player)');
 ok(key+' has separate neutral and aimed weapon holds',Math.abs(neutral.angle-aim.angle)>.1&&Math.abs(aim.angle)<1e-8);
 for(const aiming of [false,true]) {
  body('PRONE',true,1.7,aiming);
  const a=P('stanceLocalPoint(player,0,0)'),x=P('stanceLocalPoint(player,10,0)'),y=P('stanceLocalPoint(player,0,10)');
  ok(key+' '+(aiming?'aim':'carry')+' mounts gun geometry rigidly with equal axis lengths',
   Math.abs(distance(a,x)-distance(a,y))<1e-8&&
   Math.abs((x.x-a.x)*(y.x-a.x)+(x.y-a.y)*(y.y-a.y))<1e-8);
 }
}
probe('player.currentWeapon=WEAPONS.ASSAULT_RIFLE;');body('PRONE',false,0,false);
probe('var anatomyGun=stanceLongGunPose(player);var anatomyRear=stanceLocalPoint(player,...anatomyGun.rear);var anatomyFore=stanceLocalPoint(player,...anatomyGun.fore);');
ok('neutral rifle grips cross the upper chest rather than remain in firing presentation',
 P('anatomyRear.y*anatomyFore.y<0&&anatomyRear.x>stanceBodyPose(player).chestX&&anatomyFore.x>stanceBodyPose(player).chestX'));
const support=P('stanceLocalPoint(player,12,0,true)'),gun=P('stanceLocalPoint(player,12,0)');
ok('chemist support actions remain independent of the rifle port angle',support.x>0&&support.y===0&&Math.abs(gun.y)>1);

// Capture the actual native figure draw, rather than checking an elbow helper
// alone: sleeve endpoints, rendered palms and projected gun grips must agree.
const nativeSleeve=ctx.drawCombatStanceSleeve,nativeOval=ctx.figureCelOval;
let drawnLimbs=[],drawnPalms=[];
ctx.drawCombatStanceSleeve=(...args)=>{drawnLimbs.push(args);return nativeSleeve(...args);};
ctx.figureCelOval=(...args)=>{
 if(args[3]===6.3&&args[4]===6.3)drawnPalms.push({x:args[1],y:args[2]});
 return nativeOval(...args);
};
probe('player.bodyW=21;player.bodyH=27;player.fireTimer=0;player.ammo=30;player.reloadTimer=0;');
for(const stance of ['CROUCH','PRONE'])for(const key of ['PISTOL','ASSAULT_RIFLE','SHOTGUN'])for(const aiming of [false,true]) {
 probe(`player.currentWeapon=WEAPONS.${key};`);
 let bounded=true,grips=true,palms=true,maxRatio=0;
 for(const phase of [0,.12,.34,.5,.64,.72,.82,.94])for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
  const b=body(stance,true,phase*TAU/.65,aiming);
  probe(`player.aimAngle=${heading};player.stance.proneHeading=${heading};`);
  drawnLimbs=[];drawnPalms=[];
  probe('drawCombatStanceFigure(player,actorStancePose(player));');
  const arms=drawnLimbs.filter(a=>Math.abs(a[7]-b.R.upperW)<1e-8);
  if(arms.length!==2||drawnPalms.length!==2){bounded=grips=palms=false;continue;}
  const grip=P(key==='PISTOL'?'({right:stancePointInBody(player,16,8),left:null})':
   '(()=>{const g=stanceLongGunPose(player);return {right:stancePointInBody(player,...g.rear),left:stancePointInBody(player,...g.fore)};})()');
  for(let i=0;i<arms.length;i++) {
   const a=arms[i],shoulder={x:a[1],y:a[2]},elbow={x:a[3],y:a[4]},wrist={x:a[5],y:a[6]};
   const ratio=Math.max(distance(shoulder,elbow)/b.R.upper,distance(elbow,wrist)/b.R.fore);
   maxRatio=Math.max(maxRatio,ratio);bounded&&=ratio<=1.02;
   const expected=i===1?grip.right:grip.left;
   if(expected)grips&&=distance(wrist,{x:expected.x/b.size,y:expected.y/b.size})<1e-7;
   palms&&=distance(wrist,drawnPalms[i])<1e-7;
  }
 }
 const label=stance+' '+key+' '+(aiming?'aimed':'neutral');
 ok(label+' sleeves stay within authored upper-arm and forearm lengths (max '+maxRatio.toFixed(4)+'×)',bounded);
 ok(label+' actual sleeve wrists remain on projected native gun grips through the crawl',grips);
 ok(label+' visible palms remain attached to their rendered sleeve endpoints',palms);
}
ctx.drawCombatStanceSleeve=nativeSleeve;ctx.figureCelOval=nativeOval;

// At a nearly folded elbow the old single ribbon reversed its normal and
// turned into a point. Trace the painted bone surfaces around that crossing:
// each surface must remain straight, with a round filled joint between them.
const nativeBone=ctx.figureCelLimb;
let boneSurfaces=[],jointSurfaces=[];
ctx.figureCelLimb=(...args)=>{boneSurfaces.push(args);return nativeBone(...args);};
ctx.figureCelOval=(...args)=>{jointSurfaces.push(args);return nativeOval(...args);};
let roundFolds=true,finiteFolds=true;
for(const turn of [-.15,-1e-5,0,1e-5,.15]) {
 boneSurfaces=[];jointSurfaces=[];
 const hx=10-Math.cos(turn)*9,hy=Math.sin(turn)*9;
 probe(`drawCombatStanceSleeve(window,0,0,10,0,${hx},${hy},8.4,7.5,5.6,[180,40,40]);`);
 finiteFolds&&=boneSurfaces.every(a=>a.slice(1,10).every(Number.isFinite));
 roundFolds&&=boneSurfaces.length===2&&boneSurfaces.every(a=>{
  const ux=a[3]-a[1],uy=a[4]-a[2],vx=a[5]-a[3],vy=a[6]-a[4];
  return ux*vx+uy*vy>=0&&Math.abs(ux*vy-uy*vx)<1e-8;
 })&&jointSurfaces.some(a=>a[1]===10&&a[2]===0&&a[3]===a[4]&&a[3]>=7);
}
ctx.figureCelLimb=nativeBone;ctx.figureCelOval=nativeOval;
ok('deep elbow folds retain rounded joint surfaces on both sides of a full reversal',roundFolds);
ok('rounded sleeve geometry remains finite through the formerly jagged reversal',finiteFolds);

let finite=true,continuous=true;
for(const stance of ['CROUCH','PRONE'])for(const dimensions of [[21,27],[24,30],[18,24]])for(const aiming of [false,true]) {
 probe(`player.bodyW=${dimensions[0]};player.bodyH=${dimensions[1]};`);
 let previous=null;
 for(let i=0;i<=160;i++) {
  body(stance,true,i*TAU/(160*.65),aiming);
  probe(`player.aimAngle=${i*TAU/160};`);
  if(stance==='CROUCH')probe('frameCount++;updateCrouchFacing(player,1000/60);');
  const b=P('stanceBodyPose(player)'),angle=i*TAU/160;
  const pts=b.joints.flatMap(j=>[j.hip,j.knee,j.ankle,j.shoulder,j.elbow]);
  const world=pts.map(q=>({x:Math.cos(angle)*q.x-Math.sin(angle)*q.y,y:Math.sin(angle)*q.x+Math.cos(angle)*q.y}));
  finite&&=world.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y));
  if(previous)continuous&&=world.every((q,j)=>distance(q,previous[j])<3);
  previous=world;
 }
}
ok('all joint positions remain finite across body sizes, headings and crawl phases',finite);
ok('turning and gait changes move joints continuously without teleporting limbs',continuous);
console.log(`${checks}/${checks} articulated crouch, prone anatomy, crawl support and rigid weapon mount checks passed`);

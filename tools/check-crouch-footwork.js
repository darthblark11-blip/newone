// Recovering crouch steps fold into the torso footprint and expose a lifted
// heel; the other foot remains planted. Rendering must not advance gameplay.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
probe(`player=new Character(70,90,true);player.isMoving=false;player.walkCycle=0;
 player.aimAngle=player.moveAngle=0;player.gait=.4;player.aimHold=0;
 rightStick={active:false,dx:0,dy:0};resetActorStance(player,'CROUCH');
 setMeleeTool('NONE');player.meleeTimer=player.reloadTimer=player.dashTimer=0;`);
const TAU=Math.PI*2,pose=t=>P(`crouchStepPose(player,${t*TAU})`);
const rest=P('stanceBodyPose(player)'),idle=pose(.79);
ok('a still crouch keeps both legs settled without residual lift or twist',
 idle.legs.every(l=>l.planted&&l.lift===0&&l.sole===0&&l.calf===0&&l.footPitch===0&&
  l.knee.x===0&&l.knee.y===0&&l.ankle.x===0&&l.ankle.y===0)&&idle.counterYaw===0&&idle.hipYaw===0);
probe('player.isMoving=true;');
const right=pose(.79),left=pose(.29);
ok('each recovering leg alternates with a foot that stays on the floor',
 right.legs[1].lift>.9&&right.legs[0].planted&&right.legs[0].lift===0&&
 left.legs[0].lift>.9&&left.legs[1].planted&&left.legs[1].lift===0);
ok('the lifted knee withdraws rearward and medially toward the torso',
 [right.legs[1],left.legs[0]].every(l=>l.knee.x<-5&&l.knee.y*l.side<-3));
ok('recovery brings the knee center under the actual crouched torso contour',
 [right.legs[1],left.legs[0]].every(l=>{
  const leg=rest.joints.find(j=>j.side===l.side),x=leg.knee.x+l.knee.x-rest.chestX,y=leg.knee.y+l.knee.y;
  return (x/(rest.torsoLength*.5))**2+(y/(rest.torsoWidth*.5))**2<1;
 }));
ok('the lifted heel and calf expose their rear planes while the knee is tucked',
 [right.legs[1],left.legs[0]].every(l=>l.ankle.x<0&&l.sole>.8&&l.calf>.9&&l.footPitch>.7));
ok('a planted foot exposes no sole, lift or calf recovery surface',
 right.legs.filter(l=>l.planted).every(l=>l.sole===0&&l.calf===0&&l.footPitch===0));
ok('chest and arm counter-motion opposes the recovering leg and hip turn',
 right.counterYaw<0&&right.hipYaw>0&&right.armCounter>0&&
 left.counterYaw>0&&left.hipYaw<0&&left.armCounter<0);
ok('the crouch counter-twist stays small enough to preserve the aiming line',
 Math.abs(right.counterYaw)<.12&&Math.abs(left.counterYaw)<.12&&
 Math.abs(right.hipYaw)<Math.abs(right.counterYaw));

const h=1e-5;
const sample=(t,index)=>{
 const p=pose(t),l=p.legs[index];
 return [l.knee.x,l.knee.y,l.ankle.x,l.ankle.y,l.lift,l.sole,l.footPitch,p.counterYaw,p.hipYaw,p.armCounter];
};
let smoothPosition=true,smoothVelocity=true;
for(const seam of [0,.08,.5,.58,1])for(const index of [0,1]){
 const a=sample(seam-h,index),b=sample(seam,index),c=sample(seam+h,index);
 smoothPosition&&=a.every((v,i)=>Math.abs(c[i]-v)<.005);
 smoothVelocity&&=a.every((v,i)=>Math.abs((b[i]-v)/h-(c[i]-b[i])/h)<.1);
}
ok('contact and recovery join without teleporting any crouch joint',smoothPosition);
ok('heel lift and joint recovery meet the planted phase with continuous velocity',smoothVelocity);

let finite=true,bounded=true,legReach=true;
for(let i=-160;i<=320;i++){
 const p=pose(i/160);
 for(const l of p.legs){
  const leg=rest.joints.find(j=>j.side===l.side),k={x:leg.knee.x+l.knee.x,y:leg.knee.y+l.knee.y},
   a={x:leg.ankle.x+l.ankle.x,y:leg.ankle.y+l.ankle.y};
  finite&&=[l.knee.x,l.knee.y,l.ankle.x,l.ankle.y,l.lift,l.sole,l.calf,l.footPitch,p.counterYaw].every(Number.isFinite);
  bounded&&=l.lift>=0&&l.lift<=1&&l.sole>=0&&l.sole<=1&&Math.abs(l.knee.y)<=4.6;
  legReach&&=Math.hypot(k.x-leg.hip.x,k.y-leg.hip.y)<=Math.hypot(leg.knee.x-leg.hip.x,leg.knee.y-leg.hip.y)*1.01&&
   Math.hypot(k.x-a.x,k.y-a.y)<=Math.hypot(leg.knee.x-leg.ankle.x,leg.knee.y-leg.ankle.y)*1.03;
 }
}
ok('negative and wrapped phases retain finite joint and exposure values',finite);
ok('knee folds and sole exposure remain bounded through the whole step',bounded);
ok('recovery folds existing leg lengths instead of stretching the bones',legReach);

const before=P('JSON.stringify({x:player.x,y:player.y,hp:player.hp,ammo:player.ammo,angle:player.aimAngle,walk:player.walkCycle,gait:player.gait})');
for(let i=0;i<24;i++)pose(i/24);
ok('resolving a crouch pose never changes movement, health, ammo or animation clocks',
 before===P('JSON.stringify({x:player.x,y:player.y,hp:player.hp,ammo:player.ammo,angle:player.aimAngle,walk:player.walkCycle,gait:player.gait})'));

const draws=[],g={};let depth=0,minDepth=0;
for(const name of ['stroke','strokeWeight','fill','noStroke','line'])g[name]=(...args)=>draws.push({name,args});
g.push=()=>depth++;g.pop=()=>{depth--;minDepth=Math.min(minDepth,depth);};
g.rect=(...args)=>draws.push({name:'rect',args});ctx.__crouchSoleG=g;
probe('drawCrouchStepSole(__crouchSoleG,{sole:0},8,6,1);');
ok('a planted shoe does not acquire an invented sole surface',draws.length===0);
probe('drawCrouchStepSole(__crouchSoleG,{sole:1},8,6,1);');
const sole=draws.find(d=>d.name==='rect').args;
ok('the exposed sole remains inside the real shoe footprint',sole[2]>0&&sole[2]<=8&&sole[3]>0&&sole[3]<=6&&
 sole[0]>=1.5-4&&sole[0]+sole[2]<=1.5+4);
ok('lifted sole art contains readable tread strokes and restores painter state',
 draws.filter(d=>d.name==='line').length>=3&&depth===0&&minDepth===0);
draws.length=0;probe('drawCrouchStepSole(__crouchSoleG,{sole:1},8,6,0);');
ok('the sole overlay fades fully away outside the crouch blend',draws.length===0);
delete ctx.__crouchSoleG;

// Hips resolve movement independently from the gun, and the slower crouch
// clock is advanced by updates rather than by drawing an extra review frame.
probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=false;
 inLvl4Cutscene=inUpgradeMenu=false;currentLevel=currentBiome=2;BIOME_ACTIVE=false;
 window.inNM0SecretOverlay=false;buildGhost=null;resetUndergroundRoute();`);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function moving(travel=0,aim=0){
 probe(`player=new Character(70,90,true);player.aimAngle=${aim};player.moveAngle=${travel};
  player.isMoving=true;player.walkCycle=0;player.gait=.6;player.aimHold=14;player.isArmed=true;
  player.currentWeapon=WEAPONS.PISTOL;player.meleeTimer=player.reloadTimer=player.dashTimer=0;
  rightStick={active:true,dx:Math.cos(${aim}),dy:Math.sin(${aim}),dist:.4};resetActorStance(player,'CROUCH');
  frameCount++;updateCrouchFacing(player,1000/60);`);
}
function advance(frames=1,cycle=.3){
 for(let i=0;i<frames;i++)probe(`player.walkCycle+=${cycle};frameCount++;updateCrouchFacing(player,1000/60);`);
}
let directions=true;
for(const [travel,hip,reverse] of [[0,0,0],[Math.PI/4,Math.PI/4,0],[-Math.PI/4,-Math.PI/4,0],
 [Math.PI/2,Math.PI/2,0],[-Math.PI/2,-Math.PI/2,0],[3*Math.PI/4,-Math.PI/4,1],
 [-3*Math.PI/4,Math.PI/4,1],[Math.PI,0,1]]){
 moving(travel);const p=P('crouchLowerPose(player)');
 directions&&=Math.abs(wrap(p.angle-hip))<1e-7&&p.backward===reverse;
}
ok('eight travel directions turn the crouched hips toward travel or use rear-diagonal backsteps',directions);
moving(Math.PI/4);advance(30);
const heading=P('crouchLowerPose(player).angle');
probe('player.aimAngle=.28;');advance();
ok('adjusting sights without changing travel leaves the planted crouch hip heading fixed',
 Math.abs(wrap(P('crouchLowerPose(player).angle')-heading))<1e-8);
ok('the crouched torso still follows the true right-stick aim independently from the lower chain',
 P('stanceFacingAngle(player)===player.aimAngle')&&Math.abs(P('stanceBodyPose(player).lower.yaw')-heading+.28)<1e-7);

moving(Math.PI/2);advance(40);
let previous=P('crouchLowerPose(player).angle'),maxTurn=0;
probe('player.moveAngle=3*Math.PI/4;');
for(let i=0;i<100;i++){
 advance();const now=P('crouchLowerPose(player).angle');maxTurn=Math.max(maxTurn,Math.abs(wrap(now-previous)));previous=now;
}
ok('lateral-to-backward hip turns ease at a bounded anatomical rate instead of snapping across the spine',
 maxTurn>0&&maxTurn<=.0032*(1000/60)+1e-8&&Math.abs(wrap(previous+Math.PI/4))<.01);
ok('rear-diagonal travel settles into a real backward stride rather than an inverted upper body',
 P('crouchLowerPose(player).backward>.999')&&Math.abs(P('stanceBodyPose(player).lower.yaw'))<Math.PI*.5);

moving();const phaseStart=P('crouchLowerPose(player).phase');advance(60);
ok('a crouched step cycle runs below half of the ordinary standing cadence',
 Math.abs(P('crouchLowerPose(player).phase')-phaseStart-60*.3*.46)<1e-7);
const stepMotion=P('crouchLowerPose(player).motion');
probe('player.isMoving=false;');advance(1,0);
ok('stopping a crouch lets weight transfer settle rather than snapping folded joints to idle',
 P('crouchLowerPose(player).motion')>0&&P('crouchLowerPose(player).motion')<stepMotion);
advance(100,0);
ok('a settled crouch removes all residual step lift and counter-motion',
 P('crouchLowerPose(player).motion===0&&crouchStepPose(player,crouchLowerPose(player).phase).legs.every(l=>l.lift===0)'));

moving(Math.PI/2,.1);advance(60);
ok('leg wounds use the rotated crouch shin rather than a standing shin or the sight direction',P(`(()=>{
 const b=stanceBodyPose(player),leg=b.joints[1],u=.8;
 const x=(leg.knee.x+(leg.ankle.x-leg.knee.x)*u)*b.size,y=(leg.knee.y+(leg.ankle.y-leg.knee.y)*u)*b.size;
 const ca=Math.cos(stanceFacingAngle(player)),sa=Math.sin(stanceFacingAngle(player));
 const d=mapLegHitDecal(player,player.x+ca*x-sa*y,player.y+sa*x+ca*y,{sz:2});
 return d.isLeg&&d.legIndex===1&&Math.abs(d.legU-u)<1e-7&&Math.abs(d.legV)<1e-7;
})()`));
const paused=P('JSON.stringify(player._crouchMotion)');
probe('isPaused=true;frameCount++;player.walkCycle+=.3;updateCrouchFacing(player,100);isPaused=false;');
ok('pause freezes the crouch hip and support clocks',paused===P('JSON.stringify(player._crouchMotion)'));
console.log(`${checks}/${checks} crouch travel-facing hips, backsteps, support transfer, heel lift and sole checks passed`);

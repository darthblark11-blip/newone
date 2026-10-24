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
 Math.abs(right.counterYaw)<.10&&Math.abs(left.counterYaw)<.10&&
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
console.log(`${checks}/${checks} crouch knee recovery, heel lift, counter-twist and sole checks passed`);

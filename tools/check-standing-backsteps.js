// Standing locomotion keeps the native front/side stride. Only aimed rear
// travel gets a backstep: anatomical hips face the torso while feet recover
// along the actual movement vector. This must never alter movement or aim.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const near=(a,b,tolerance=1e-8)=>Math.abs(a-b)<tolerance;
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;ctx.navigator.getGamepads=()=>[];
function fresh(aim=0,move=Math.PI){
 probe(`currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
  isPaused=isDead=isWin=killcamMode=false;isStoryMode=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
  inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
  window.inNM0SecretOverlay=false;buildGhost=null;resetUndergroundRoute();
  buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];bullets=[];
  invalidateColIndex();setMeleeTool('NONE');window.shovelOwned=window.pickaxeOwned=false;
  swordPickedUp=false;chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=false;
  jetpackUnlocked=false;isCooking=meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;
  leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
  rightStick={active:true,dx:Math.cos(${aim}),dy:Math.sin(${aim}),dist:.4,base:{x:313,y:690}};
  player=new Character(70,90,true);player.aimAngle=${aim};player.moveAngle=${move};
  player.isArmed=true;player.isMoving=true;player.gait=.6;player.walkCycle=.8;
  player.currentWeapon=WEAPONS.PISTOL;player.ammo=30;
  player.aimHold=14;player.meleeTimer=player.reloadTimer=player.dashTimer=player.muzzleFlash=0;
  resetActorStance(player,'STAND');window.isDesktop=false;frameCount++;deltaTime=1000/60;
  viewLeft=viewTop=-100000;viewRight=viewBottom=100000;`);
}
const pose=()=>P('standingRearPose(player)');
const leg=index=>P(`standingRearLeg(player,standingRearPose(player),figureRig(player.bodyW,player.bodyH),${index})`);

let frontUntouched=true,rearSelected=true,backAligned=true,directionRelative=true;
for(let facing=0;facing<8;facing++)for(let travel=0;travel<8;travel++){
 const aim=facing*Math.PI/4,move=travel*Math.PI/4,delta=wrap(move-aim);
 fresh(aim,move);const p=pose();
 if(Math.cos(delta)>=-1e-9)frontUntouched&&=p===null;
 else{
  rearSelected&&=p!==null&&p.blend>0&&p.blend<=1;
  if(!p)continue;
  const relativeTravel=wrap(move-p.angle);
  directionRelative&&=near(p.travelX,Math.cos(relativeTravel))&&near(p.travelY,Math.sin(relativeTravel));
  if(Math.abs(Math.abs(delta)-Math.PI)<1e-8)backAligned&&=Math.abs(wrap(p.angle-aim))<1e-8;
 }
}
ok('all front diagonals and both lateral directions retain the original stride for every aim heading',frontUntouched);
ok('all rear diagonals select a backward stride relative to aim, regardless of world direction',rearSelected);
ok('moving directly away from aim keeps the hips facing the torso',backAligned);
ok('rear feet use actual movement in the hip frame instead of torso-forward travel',directionRelative);

for(const side of [-1,1]){
 fresh(.37,.37+side*(Math.PI/2+.00001));
 const p=pose(),R=P('figureRig(player.bodyW,player.bodyH)'),fore=P('STAND_FORE_LEG');
 const gp=P('({...gaitPose(player.gait)})'),phase=P('player.walkCycle');
 ok('the '+(side<0?'left':'right')+' rear boundary joins the original lateral heading without a snap',
  p&&Math.abs(wrap(p.angle-P('player.moveAngle')))<1e-8&&p.blend<1e-8);
 let original=true;
 for(let index=0;index<2;index++){
  const l=leg(index),sideIndex=index?1:-1;
  const sx=-10+R.thighW*.5-sideIndex*Math.sin(phase)*12*gp.swing,sy=sideIndex*6;
  const expected={sx,sy,kx:sx+R.thigh*fore*.92,ky:sy,ax:sx+R.thigh*fore*.92+R.shin*fore,ay:sy};
  original&&=Object.entries(expected).every(([key,value])=>near(l[key],value,1e-7));
 }
 ok('the '+(side<0?'left':'right')+' rear boundary preserves the native limb positions',original);
}
fresh(0,Math.PI-.000001);const beforeSeam=pose(),beforeLeg=[leg(0),leg(1)];
probe('player.moveAngle=-Math.PI+.000001;');const afterSeam=pose();
ok('the rear half-circle is continuous across the angle wrap',
 Math.abs(wrap(beforeSeam.angle-afterSeam.angle))<1e-8&&beforeLeg.every((l,index)=>
  ['sx','sy','kx','ky','ax','ay'].every(key=>near(l[key],leg(index)[key],.0001))));

for(const throttle of [.2,.5,1]){
 fresh();probe(`player.gait=${throttle};`);
 let rootsFixed=true,boundedLimbs=true,feetBehind=false,pairedRecovery=true,finite=true,stepsAlternate=true;
 const R=P('figureRig(player.bodyW,player.bodyH)');
 const feet=[[],[]];
 for(let i=0;i<64;i++){
  probe(`player.walkCycle=${i*Math.PI/32};`);const a=leg(0),b=leg(1);
  rootsFixed&&=near(a.sx,b.sx)&&near(a.sy,-6)&&near(b.sy,6);
  boundedLimbs&&=[a,b].every(l=>Math.hypot(l.kx-l.sx,l.ky-l.sy)<=R.thigh&&
   Math.hypot(l.ax-l.kx,l.ay-l.ky)<=R.shin*1.15);
  feetBehind||=a.ax<a.sx||b.ax<b.sx;
  pairedRecovery&&=a.lift>=0&&b.lift>=0&&Math.min(a.lift,b.lift)<1e-8;
  finite&&=[a,b].every(l=>['sx','sy','kx','ky','ax','ay','lift'].every(k=>Number.isFinite(l[k])));
  feet[0].push(a.ax);feet[1].push(b.ax);
  if(i===16)stepsAlternate&&=a.ax<b.ax;
  if(i===48)stepsAlternate&&=a.ax>b.ax;
 }
 ok('backward '+throttle+' throttle anchors hip roots instead of sliding whole rigid legs',rootsFixed);
 ok('backward '+throttle+' throttle keeps both limb segments within their native-scale reach',boundedLimbs);
 ok('backward '+throttle+' throttle alternates rear-reaching feet with a separate recovery lift',pairedRecovery&&stepsAlternate&&finite);
 if(throttle===1)ok('full backward run reaches a foot behind its hip',feetBehind);
}

fresh();
probe('player.walkCycle=0;');let a=leg(0),b=leg(1);
ok('at the first rear recovery apex only the returning foot lifts',a.lift>0&&near(b.lift,0));
probe('player.walkCycle=Math.PI;');a=leg(0);b=leg(1);
ok('half a stride later the other foot recovers while the planted foot stays down',near(a.lift,0)&&b.lift>0);
probe('player.walkCycle=Math.PI/2;');const firstReach=leg(0);
probe('player.walkCycle=Math.PI*1.5;');const secondReach=leg(0);
ok('backward knees and ankles project behind the waist instead of hiding underneath the head',
 (firstReach.kx+secondReach.kx)/2<firstReach.sx&&
 (firstReach.ax+secondReach.ax)/2<(firstReach.kx+secondReach.kx)/2);

fresh();let separateTracks=true;
const trackRig=P('figureRig(player.bodyW,player.bodyH)');
for(let direction=1;direction<36;direction++)for(let phase=0;phase<32;phase++){
 probe(`player.gait=1;player.moveAngle=Math.PI/2+${direction*Math.PI/36};player.walkCycle=${phase*Math.PI/16};`);
 for(let index=0;index<2;index++){
  const l=leg(index),side=index?1:-1;
  separateTracks&&=side*l.ky>=trackRig.shinW*.5&&side*l.ay>=trackRig.shinW*.8*.5;
 }
}
ok('diagonal backsteps keep knees and ankles in separate tracks throughout the rear half-circle',separateTracks);

for(const [label,setup]of [
 ['ordinary travel','player.aimHold=0;rightStick.active=false;'],
 ['standing still','player.isMoving=false;'],['nonplayer','player.isPlayer=false;'],
 ['mounted rider','player.mounted=true;'],['dash','player.dashTimer=10;'],
 ['melee strike','player.meleeTimer=10;'],['boxing','player._boxing={active:true};'],
 ['knockout','player.knockedOut=true;'],['stun','player.stunTimer=10;'],
 ['skeleton stun','player.skeletonTimer=10;'],
 ['shovel',"window.shovelOwned=true;setMeleeTool('SHOVEL');"],
 ['mantle','player.shovelMantle={};'],['held grenade','isCooking=true;'],
 ['throw follow-through','player.throwAnimTimer=12;'],
 ['chemist cannon','chemistSuitUnlocked=true;player.cannonCharge=40;'],
 ['crouch',"resetActorStance(player,'CROUCH');"],
 ['prone',"resetActorStance(player,'PRONE');"],['lowering transition','player.stance.to=1;']]){
 fresh();probe(setup);ok(label+' retains its existing dedicated animation',pose()===null);
}
for(const [tool,setup]of [['SWORD',"swordPickedUp=true;setMeleeTool('SWORD');"],
 ['PICKAXE',"window.pickaxeOwned=true;setMeleeTool('PICKAXE');"]]){
 fresh();probe(setup+'player.isArmed=false;player.aimHold=14;rightStick.active=false;');
 ok(tool+' carry retains original travel even with an old aim hold',pose()===null);
}

fresh(.4,.4+Math.PI*.75);const saved=P('JSON.stringify(player)');
for(let i=0;i<20;i++){pose();leg(0);leg(1);}
ok('backstep queries never rewrite actor movement, aim, phase or simulation state',P('JSON.stringify(player)')===saved);
probe('player.show();player.show();');
ok('painting backsteps does not introduce a second hip motion state',P('player._standingHip==null'));

fresh(.4,.4+Math.PI*.75);probe('player.walkCycle=.8;');
const p=pose(),l=leg(0),u=.8,x=l.kx+(l.ax-l.kx)*u,y=l.ky+(l.ay-l.ky)*u;
probe(`window.rearLegWound={sz:2};mapLegHitDecal(player,
 player.x+${Math.cos(p.angle)*x-Math.sin(p.angle)*y},
 player.y+${Math.sin(p.angle)*x+Math.cos(p.angle)*y},rearLegWound);`);
ok('rear leg hits map to the same visibly bent shin as the painter',P('rearLegWound.legIndex===0&&Math.abs(rearLegWound.legU-.8)<1e-6'));

for(const aimed of [false,true])for(const throttle of [.2,.5,1]){
 fresh();probe(`player.walkCycle=2;player.aimHold=0;
 leftStick.active=true;leftStick.dx=-${throttle};leftStick.dy=0;
 rightStick.active=${aimed};rightStick.dx=1;rightStick.dy=0;rightStick.dist=.4;
 frameCount++;player.updatePlayer();`);
 ok((aimed?'backward aimed':'ordinary')+' movement preserves native cadence at '+throttle,
  near(P('player.walkCycle')-2,P('gaitPose(player.gait).cadence')));
}

// Observe the real painter, rather than only checking the public pose helpers.
// The same coordinates must reach cel surfaces, dark boots and wound drawing.
fresh();
const native={limb:ctx.figureCelLimb,oval:ctx.figureCelOval,decals:ctx.drawLegDecals,
 push:ctx.push,pop:ctx.pop,rotate:ctx.rotate};
let drawn=[],boots=[],stains=[],angle=0,stack=[],depth=0,minDepth=0;
const matches=(c,rgb)=>{c=c&&(c.levels||c);return c&&rgb.every((v,i)=>near(c[i],v));};
const pants=P('player.pantsCol.levels').slice(0,3),bootColor=pants.map(c=>c*.55);
ctx.push=(...args)=>{stack.push(angle);depth++;return native.push(...args);};
ctx.pop=(...args)=>{angle=stack.pop();depth--;minDepth=Math.min(minDepth,depth);return native.pop(...args);};
ctx.rotate=(a,...args)=>{angle+=a;return native.rotate(a,...args);};
ctx.figureCelLimb=(...args)=>{
 if(matches(args[10],pants))drawn.push({points:args.slice(1,7),widths:args.slice(7,10),angle});
 return native.limb(...args);
};
ctx.figureCelOval=(...args)=>{
 if(matches(args[5],bootColor))boots.push({geometry:args.slice(1,5),angle});
 return native.oval(...args);
};
ctx.drawLegDecals=(...args)=>{
 stains.push({index:args[2],points:args.slice(3,9),widths:args.slice(9,12),angle});
 return native.decals(...args);
};
try{
 let limbsMatch=true,bootsMatch=true,woundsMatch=true,framesMatch=true;
 for(const throttle of [.2,.5,1])for(const delta of [Math.PI*.75,Math.PI,-Math.PI*.75])for(let phase=0;phase<8;phase++){
  probe(`player.aimAngle=.4;player.moveAngle=.4+${delta};player.gait=${throttle};player.walkCycle=${phase*Math.PI/4};`);
  const p=pose(),R=P('figureRig(player.bodyW,player.bodyH)'),expected=[leg(0),leg(1)];
  drawn=[];boots=[];stains=[];probe('player.show();');
  limbsMatch&&=drawn.length===2;bootsMatch&&=boots.length===2;woundsMatch&&=stains.length===2;
  expected.forEach((l,index)=>{
   const points=[l.sx,l.sy,l.kx,l.ky,l.ax,l.ay],widths=[R.thighW,R.shinW,R.shinW*.8];
   limbsMatch&&=drawn[index]&&drawn[index].points.every((v,i)=>near(v,points[i]))&&drawn[index].widths.every((v,i)=>near(v,widths[i]));
   bootsMatch&&=boots[index]&&boots[index].geometry.every((v,i)=>near(v,[l.ax+R.foot*.34,l.ay,R.foot,R.shinW*.8][i]));
   woundsMatch&&=stains[index]&&stains[index].index===index&&stains[index].points.every((v,i)=>near(v,points[i]));
  });
  framesMatch&&=drawn.every(l=>Math.abs(wrap(l.angle-p.angle))<1e-8)&&boots.every(l=>Math.abs(wrap(l.angle-p.angle))<1e-8);
 }
 ok('all real backward painters use the canonical hip, knee and ankle points with original limb widths',limbsMatch);
 ok('real backward footwear remains the original dark oval fixed ahead of the ankle',bootsMatch);
 ok('rear wounds paint onto the same bent joints as the visible leg surfaces',woundsMatch);
 ok('rear limbs and footwear share their anatomical hip frame throughout every gait and phase',framesMatch);
 ok('real backward painting leaves the graphics stack balanced',depth===0&&minDepth===0&&stack.length===0);
}finally{
 Object.assign(ctx,{figureCelLimb:native.limb,figureCelOval:native.oval,drawLegDecals:native.decals,
  push:native.push,pop:native.pop,rotate:native.rotate});
}
console.log(`${checks}/${checks} rear-only standing selection, native boundaries, backward steps, exclusions and decal checks passed`);

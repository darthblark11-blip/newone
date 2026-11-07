// Backpedalling presents the original broad rear trouser surface. Its cloth
// projection is independent from the unchanged gait joints and hip heading.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')'),near=(a,b,eps=1e-8)=>Math.abs(a-b)<eps;
let checks=0;const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;ctx.navigator.getGamepads=()=>[];
function fresh(aim=.37,delta=Math.PI){
 probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
  currentLevel=currentBiome=2;BIOME_ACTIVE=false;resetUndergroundRoute();
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
  inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
  window.inNM0SecretOverlay=false;buildGhost=null;setMeleeTool('NONE');
  window.shovelOwned=window.pickaxeOwned=false;swordPickedUp=false;
  chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=false;
  jetpackUnlocked=false;isCooking=meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;
  buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];bullets=[];invalidateColIndex();
  leftStick={active:true,dx:Math.cos(${aim+delta}),dy:Math.sin(${aim+delta})};
  rightStick={active:true,dx:Math.cos(${aim}),dy:Math.sin(${aim}),dist:.4};
  player=new Character(70,90,true);player.isMoving=player.isArmed=true;
  player.aimAngle=${aim};player.moveAngle=${aim+delta};player.gait=.7;player.walkCycle=.8;
  player.currentWeapon=WEAPONS.PISTOL;player.aimHold=14;player.ammo=30;
  player.reloadTimer=player.meleeTimer=player.dashTimer=player.muzzleFlash=0;
  resetActorStance(player,'STAND');window.isDesktop=false;
  frameCount++;deltaTime=1000/60;viewLeft=viewTop=-100000;viewRight=viewBottom=100000;`);
}
fresh();
let nativeMesh=true,broadRear=true,anchored=true,finite=true;
for(const gait of [.2,.5,1])for(const degrees of [91,100,112,135,180,225,248,260,269])for(let phase=0;phase<16;phase++){
 probe(`player.gait=${gait};player.moveAngle=player.aimAngle+${degrees*Math.PI/180};player.walkCycle=${phase*Math.PI/8};`);
 for(let index=0;index<2;index++){
  const r=P('figureRig(player.bodyW,player.bodyH)'),fore=P('STAND_FORE_LEG');
  const joint=P(`standingRearLeg(player,standingRearPose(player),figureRig(player.bodyW,player.bodyH),${index})`);
  ctx.__surfaceJoint=joint;ctx.__surfaceRig=r;ctx.__surfaceBlend=P('standingRearPose(player).blend');
  const cloth=P('standingRearClothPose(__surfaceJoint,__surfaceRig,__surfaceBlend)');
  nativeMesh&&=near(cloth.kx-cloth.sx,r.thigh*fore*.92)&&near(cloth.ax-cloth.kx,r.shin*fore)&&
   near(cloth.sy,cloth.ky)&&near(cloth.ky,cloth.ay);
  broadRear&&=cloth.sx<cloth.kx&&cloth.kx<cloth.ax&&r.thighW>r.shinW&&r.shinW>r.shinW*.8;
  const blend=ctx.__surfaceBlend;
  anchored&&=near(cloth.sx,joint.sx+(joint.ax-r.foot*.16-joint.sx)*blend)&&
   near(cloth.sy,joint.sy+(joint.ay-joint.sy)*blend);
  finite&&=Object.values(cloth).every(Number.isFinite);
 }
}
ok('rear cloth uses the original standing thigh/shin split and straight local surface',nativeMesh);
ok('the broad trouser cap faces backward while the taper runs forward beneath the body',broadRear);
ok('the rear cloth surface follows the established gait endpoint through each stride',anchored);
ok('cloth projection remains finite through walk, jog, run and shallow rear angles',finite);
delete ctx.__surfaceJoint;delete ctx.__surfaceRig;delete ctx.__surfaceBlend;


// The cloth surface meets the original strafe mesh at the same position.
// Test the visible vertices in the hip frame on either side of the boundary.
let exactEntry=true,continuousEntry=true;
for(const gait of [.2,.5,1])for(const side of [-1,1])for(let phase=0;phase<8;phase++){
 const h=1e-6,aim=.37;
 fresh(aim,side*(Math.PI/2-h));
 probe(`player.gait=${gait};player.walkCycle=${phase*Math.PI/4};`);
 const rig=P('figureRig(player.bodyW,player.bodyH)'),fore=P('STAND_FORE_LEG');
 const originalHeading=P('standingLowerPose(player).angle'),swing=Math.sin(phase*Math.PI/4)*12*P('gaitPose(player.gait).swing');
 for(let index=0;index<2;index++){
  const sign=index?1:-1,sx=-10-sign*swing+rig.thighW*.5,sy=sign*6;
  const original={sx,sy,kx:sx+rig.thigh*fore*.92,ky:sy,
   ax:sx+rig.thigh*fore*.92+rig.shin*fore,ay:sy};
  ctx.__entryLeg={...original};ctx.__entryRig=rig;
  const entry=P('standingRearClothPose(__entryLeg,__entryRig,0)');
  exactEntry&&=Object.entries(original).every(([k,v])=>near(entry[k],v));
  probe(`player.moveAngle=player.aimAngle+${side*(Math.PI/2+h)};`);
  const pose=P('standingRearPose(player)');
  const after=P(`standingRearClothPose(standingRearLeg(player,standingRearPose(player),figureRig(player.bodyW,player.bodyH),${index}),figureRig(player.bodyW,player.bodyH),standingRearPose(player).blend)`);
  for(const point of [['sx','sy'],['kx','ky'],['ax','ay']]){
   const [x,y]=point,ox=Math.cos(originalHeading)*original[x]-Math.sin(originalHeading)*original[y],
    oy=Math.sin(originalHeading)*original[x]+Math.cos(originalHeading)*original[y],
    nx=Math.cos(pose.angle)*after[x]-Math.sin(pose.angle)*after[y],
    ny=Math.sin(pose.angle)*after[x]+Math.cos(pose.angle)*after[y];
   continuousEntry&&=Math.hypot(nx-ox,ny-oy)<.0001;
  }
 }
}
delete ctx.__entryLeg;delete ctx.__entryRig;
ok('zero rear blend is exactly the original strafe cloth mesh',exactEntry);
ok('both rear boundaries enter without a visible trouser-vertex jump',continuousEntry);

// Observe the real draw delegate, including its raw Canvas translation. The
// original local mesh must reach the canvas without a dark rear boot overlay.
fresh();
const native={limb:ctx.figureCelLimb,oval:ctx.figureCelOval,decals:ctx.drawLegDecals,
 heel:ctx.drawStandingRearHeel,save:ctx.drawingContext.save,restore:ctx.drawingContext.restore,
 translate:ctx.drawingContext.translate};
const pants=P('player.pantsCol.levels').slice(0,3),boot=pants.map(v=>v*.55);
const sameColor=(c,rgb)=>{c=c&&(c.levels||c);return c&&rgb.every((v,i)=>near(v,c[i]));};
let events=[],tx=0,ty=0,stack=[],depth=0,minDepth=0;
const points=a=>{const result=[];for(let i=0;i<a.length;i+=2)result.push(a[i]+tx,a[i+1]+ty);return result;};
ctx.drawingContext.save=(...args)=>{stack.push([tx,ty]);depth++;return native.save(...args);};
ctx.drawingContext.restore=(...args)=>{[tx,ty]=stack.pop();depth--;minDepth=Math.min(minDepth,depth);return native.restore(...args);};
ctx.drawingContext.translate=(x,y,...args)=>{tx+=x;ty+=y;return native.translate(x,y,...args);};
ctx.figureCelLimb=(...args)=>{
 if(sameColor(args[10],pants))events.push({kind:'cloth',local:args.slice(1,7),points:points(args.slice(1,7)),widths:args.slice(7,10),color:args[10]});
 return native.limb(...args);
};
ctx.figureCelOval=(...args)=>{
 if(sameColor(args[5],boot))events.push({kind:'boot',points:points(args.slice(1,3)),size:args.slice(3,5)});
 return native.oval(...args);
};
ctx.drawLegDecals=(...args)=>{
 events.push({kind:'decal',index:args[2],points:points(args.slice(3,9)),widths:args.slice(9,12)});
 return native.decals(...args);
};
if(native.heel)ctx.drawStandingRearHeel=(...args)=>{events.push({kind:'heel'});return native.heel(...args);};
try{
 let order=true,clothGeometry=true,clothMaterial=true,bootForward=true,wounds=true;
 for(const gait of [.2,.5,1])for(const degrees of [91,112,135,180,225,248,269])for(let phase=0;phase<8;phase++){
  probe(`player.gait=${gait};player.moveAngle=player.aimAngle+${degrees*Math.PI/180};player.walkCycle=${phase*Math.PI/4};`);
  const r=P('figureRig(player.bodyW,player.bodyH)'),fore=P('STAND_FORE_LEG');
  for(let index=0;index<2;index++){
   const cloth=P(`standingRearClothPose(standingRearLeg(player,standingRearPose(player),figureRig(player.bodyW,player.bodyH),${index}),figureRig(player.bodyW,player.bodyH),standingRearPose(player).blend)`);
   events=[];
   probe(`drawStandingRearLeg(window,player,standingRearPose(player),figureRig(player.bodyW,player.bodyH),${index},[${boot.join(',')}]);`);
   order&&=events.length===3&&events.map(e=>e.kind).join(',')==='cloth,boot,decal';
   if(events.length!==3)continue;
   const [body,shoe,stain]=events,expected=[cloth.sx,cloth.sy,cloth.kx,cloth.ky,cloth.ax,cloth.ay];
   clothGeometry&&=body.points.every((v,i)=>near(v,expected[i]))&&
    body.local.every((v,i)=>near(v,[0,0,r.thigh*fore*.92,0,r.thigh*fore*.92+r.shin*fore,0][i]))&&
    body.widths.every((v,i)=>near(v,[r.thighW,r.shinW,r.shinW*.8][i]));
   clothMaterial&&=sameColor(body.color,pants);
   bootForward&&=shoe.points[0]>cloth.ax&&near(shoe.points[0],cloth.ax+r.foot*.34)&&near(shoe.points[1],cloth.ay)&&
    shoe.size.every((v,i)=>near(v,[r.foot,r.shinW*.8][i]));
   wounds&&=stain.index===index&&stain.points.every((v,i)=>near(v,expected[i]))&&
    stain.widths.every((v,i)=>near(v,[r.thighW,r.shinW,r.shinW*.8][i]));
  }
 }
 ok('the rear painter draws the original cloth, forward boot and stain without a heel overlay on the cloth cap',order);
 ok('actual rear painting reuses the original local taper and broad trouser width',clothGeometry);
 ok('the camera-facing rear mass retains the original trouser material rather than dark boot material',clothMaterial);
 ok('the original dark boot is placed at the narrow forward end beneath the body',bootForward);
 ok('drawn leg stains use the same projected trouser surface as the visible cloth',wounds);
 ok('the cloth painter restores its raw Canvas transform after every leg',depth===0&&minDepth===0&&stack.length===0&&tx===0&&ty===0);
}finally{
 Object.assign(ctx,{figureCelLimb:native.limb,figureCelOval:native.oval,drawLegDecals:native.decals});
 if(native.heel)ctx.drawStandingRearHeel=native.heel;
 Object.assign(ctx.drawingContext,{save:native.save,restore:native.restore,translate:native.translate});
}

fresh(.37,Math.PI*.75);
const state=P('JSON.stringify(player)'),r=P('figureRig(player.bodyW,player.bodyH)');
for(let i=0;i<20;i++)probe('standingRearClothPose(standingRearLeg(player,standingRearPose(player),figureRig(player.bodyW,player.bodyH),0),figureRig(player.bodyW,player.bodyH),standingRearPose(player).blend);');
ok('repeated rear cloth queries preserve hip state, gait joints, clock and player data',P('JSON.stringify(player)')===state);
let mapping=true;
for(const index of [0,1]){
 const pose=P('standingRearPose(player)'),l=P(`standingRearClothPose(standingRearLeg(player,standingRearPose(player),figureRig(player.bodyW,player.bodyH),${index}),figureRig(player.bodyW,player.bodyH),standingRearPose(player).blend)`);
 const u=.8,x=l.kx+(l.ax-l.kx)*u,y=l.ky+(l.ay-l.ky)*u;
 probe(`window.rearSurfaceWound={sz:2};mapLegHitDecal(player,player.x+${Math.cos(pose.angle)*x-Math.sin(pose.angle)*y},player.y+${Math.sin(pose.angle)*x+Math.cos(pose.angle)*y},rearSurfaceWound);`);
 mapping&&=P(`rearSurfaceWound.isLeg&&rearSurfaceWound.legIndex===${index}&&Math.abs(rearSurfaceWound.legU-.8)<1e-7&&Math.abs(rearSurfaceWound.legV)<1e-7`);
}
ok('rear leg impacts map to the displayed cloth surface and its corresponding leg',mapping);
console.log(`${checks}/${checks} original rear trouser surface, material, projection and wound checks passed`);

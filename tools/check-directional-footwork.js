// Regression checks for the original standing legs: aim/fire must not replace
// their geometry, material or cadence. Only the aimed rear half uses backsteps.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
const near=(a,b)=>Math.abs(a-b)<1e-8;
ctx.setTimeout=()=>0;
probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=false;
 inLvl4Cutscene=inUpgradeMenu=false;currentLevel=currentBiome=2;BIOME_ACTIVE=false;
 window.inNM0SecretOverlay=false;buildGhost=null;resetUndergroundRoute();
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:1,dy:0,dist:0};
 setMeleeTool('NONE');jetpackUnlocked=false;
 ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
 player=new Character(70,90,true);player.isArmed=true;player.currentWeapon=WEAPONS.ASSAULT_RIFLE;
 player.reloadTimer=player.meleeTimer=player.dashTimer=player.muzzleFlash=0;
 player.isMoving=true;player.walkCycle=0;player.gait=.6;player.aimAngle=player.moveAngle=0;
 buildings=activeBuildings=[];activeParkingCars=[];barrels=[];invalidateColIndex();
 viewLeft=viewTop=-100000;viewRight=viewBottom=100000;resetActorStance(player);frameCount++;`);
const rig=P('figureRig(player.bodyW,player.bodyH)'),fore=P('STAND_FORE_LEG');
const pants=P('player.pantsCol.levels').slice(0,3),th=rig.thigh*fore,sh=rig.shin*fore;
const boot=pants.map(c=>c*.55),native={limb:ctx.figureCelLimb,oval:ctx.figureCelOval,push:ctx.push,pop:ctx.pop,rotate:ctx.rotate};
let legs=[],shoes=[],angle=0,stack=[],depth=0,min=0;
ctx.push=(...a)=>{stack.push(angle);depth++;return native.push(...a);};
ctx.pop=(...a)=>{angle=stack.pop();depth--;min=Math.min(min,depth);return native.pop(...a);};
ctx.rotate=(a,...rest)=>{angle+=a;return native.rotate(a,...rest);};
const sameColor=(c,expected)=>{c=c&&(c.levels||c);return !!c&&expected.every((v,i)=>near(c[i],v));};
ctx.figureCelLimb=(...a)=>{
 if(sameColor(a[10],pants))legs.push({geometry:a.slice(1,10),angle});
 return native.limb(...a);
};
ctx.figureCelOval=(...a)=>{
 if(sameColor(a[5],boot))shoes.push({geometry:a.slice(1,5),angle});
 return native.oval(...a);
};
try{
 let allGeometry=true,allHeading=true,allShoes=true,aimDoesNotAlter=true,rearPoses=0;
 for(const gait of [.2,.5,1])for(let direction=0;direction<8;direction++)for(let phase=0;phase<8;phase++){
  const move=direction*Math.PI/4;
  let reference=null;
  for(const state of ['CARRY','AIM','FIRE']){
   probe(`player.gait=${gait};player.walkCycle=${phase*Math.PI/4};player.moveAngle=${move};
    player.aimAngle=-Math.PI/2;player.aimHold=${state==='CARRY'?0:14};
    rightStick.active=${state!=='CARRY'};player.muzzleFlash=${state==='FIRE'?3:0};`);
   legs=[];shoes=[];probe('player.show();');
   const expected=[0,0,th*.92,0,th*.92+sh,0,rig.thighW,rig.shinW,rig.shinW*.8];
   const rear=P('standingRearPose(player)');
   if(!rear)allGeometry&&=legs.length===2&&legs.every(l=>l.geometry.every((v,i)=>near(v,expected[i])));
   else rearPoses++;
   const expectedHeading=rear?rear.angle:move;
   allHeading&&=legs.every(l=>Math.abs(Math.atan2(Math.sin(l.angle-expectedHeading),Math.cos(l.angle-expectedHeading)))<1e-8);
   allShoes&&=shoes.length===2&&shoes.every(s=>near(s.geometry[2],rig.foot)&&near(s.geometry[3],rig.shinW*.8));
   if(!rear)allShoes&&=shoes.every(s=>near(s.geometry[0],th*.92+sh+rig.foot*.34)&&near(s.geometry[1],0));
   const signature=JSON.stringify({legs:legs.map(l=>l.geometry),shoes:shoes.map(s=>s.geometry)});
   if(reference===null)reference=signature;else if(!rear)aimDoesNotAlter&&=signature===reference;
  }
 }
 ok('ordinary, forward and lateral travel retain the original legs at every gait and phase',allGeometry);
 ok('only rear aimed travel uses backsteps; forward and side legs keep their original headings',allHeading&&rearPoses===144);
 ok('standing footwear retains original dark material and compact foot geometry',allShoes);
 ok('aim and firing preserve original forward and lateral leg and footwear geometry',aimDoesNotAlter);
 ok('the standing painter balances its stack throughout every pose',depth===0&&min===0&&stack.length===0);
}finally{Object.assign(ctx,{figureCelLimb:native.limb,figureCelOval:native.oval,push:native.push,pop:native.pop,rotate:native.rotate});}

for(const aimed of [false,true])for(const throttle of [.2,.5,1]){
 probe(`player.walkCycle=2;player.aimHold=0;player.muzzleFlash=0;
 leftStick.active=true;leftStick.dx=0;leftStick.dy=${throttle};
 rightStick.active=${aimed};rightStick.dx=1;rightStick.dy=0;rightStick.dist=.4;
 frameCount++;player.updatePlayer();`);
 ok((aimed?'aimed':'ordinary')+' movement retains full original cadence at throttle '+throttle,
  near(P('player.walkCycle')-2,P('gaitPose(player.gait).cadence')));
}
probe('leftStick.active=false;rightStick.active=false;player.aimHold=0;player.muzzleFlash=0;player.gait=.7;player.walkCycle=.8;player.moveAngle=Math.PI*.75;');
const gp=P('({...gaitPose(player.gait)})'),swing=Math.sin(.8)*12*gp.swing;
const sx=-10-swing*-1+rig.thighW*.5,kx=sx+th*.92,ax=kx+sh;
const x=kx+(ax-kx)*.8,y=-6,move=Math.PI*.75;
probe(`window.restoredLegWound={sz:2};mapLegHitDecal(player,player.x+${Math.cos(move)*x-Math.sin(move)*y},player.y+${Math.sin(move)*x+Math.cos(move)*y},restoredLegWound);`);
ok('leg wounds map onto the original travel-facing shin',P('restoredLegWound.legIndex===0&&Math.abs(restoredLegWound.legU-.8)<1e-6'));
ok('the removed standing hip, backstep and skip state cannot affect later updates',
 P("typeof playerFootworkPose==='undefined'&&typeof updateDirectionalFootwork==='undefined'&&typeof standingFootworkLeg==='undefined'&&typeof standingHipHeading==='undefined'&&typeof updateStandingHip==='undefined'"));
console.log(`${checks}/${checks} restored standing leg geometry, footwear, heading, cadence and decal checks passed`);

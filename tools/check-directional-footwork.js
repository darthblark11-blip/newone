// Ordinary locomotion retains the original renderer and cadence. Only aimed
// travel constrains the hips, while keeping the original trouser geometry.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
function fresh(delta=0){
 probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=false;
  inLvl4Cutscene=inUpgradeMenu=false;currentLevel=currentBiome=2;BIOME_ACTIVE=false;
  window.inNM0SecretOverlay=false;buildGhost=null;resetUndergroundRoute();
  leftStick={active:false,dx:0,dy:0};rightStick={active:true,dx:1,dy:0};
  setMeleeTool('NONE');player=new Character(70,90,true);player.isArmed=true;
  player.currentWeapon=WEAPONS.ASSAULT_RIFLE;player.aimHold=14;player.muzzleFlash=0;
  player.reloadTimer=player.meleeTimer=player.dashTimer=0;player.isMoving=true;
  player.walkCycle=0;player.gait=.6;player.aimAngle=0;player.moveAngle=${delta};
  buildings=activeBuildings=[];activeParkingCars=[];barrels=[];invalidateColIndex();
  resetActorStance(player);frameCount++;`);
}
function advance(ms){for(let left=ms;left>0;left-=50)probe(`frameCount++;updateDirectionalFootwork(player,${Math.min(50,left)});`);}
fresh(Math.PI);advance(350);
ok('opposite travel uses backward steps while hips face the weapon',
 P('playerFootworkPose(player).backward>.99&&Math.abs(playerFootworkPose(player).angle-player.aimAngle)<.01'));
probe('player.walkCycle=0;');const back=P('standingFootworkLeg(player,0)');
probe('player.moveAngle=0;');advance(350);const forward=P('standingFootworkLeg(player,0)');
ok('backward travel keeps the original positive thigh and shin directions',
 back.kx>back.sx&&back.ax>back.kx&&forward.kx>forward.sx&&forward.ax>forward.kx);
ok('backward toes keep facing forward instead of turning the legs around',Math.abs(back.heading)<.01);

let honestBones=true,originalTaper=true,nativeForward=true,nativeBack=true;
for(const [label,direction]of [['forward',0],['left',-Math.PI/2],['right',Math.PI/2],['backward',Math.PI],['back-left',Math.PI*.75],['back-right',-Math.PI*.75]]){
 fresh(direction);advance(350);
 for(const gait of [.2,.5,1])for(let i=0;i<48;i++){
  const phase=i*Math.PI/24;
  probe(`player.gait=${gait};player.walkCycle=${phase};`);
  const body=P('({w:player.bodyW,h:player.bodyH,rig:figureRig(player.bodyW,player.bodyH),gait:{...gaitPose(player.gait)}})');
  const legs=[P('standingFootworkLeg(player,0)'),P('standingFootworkLeg(player,1)')];
  for(let j=0;j<2;j++){
   const l=legs[j],side=j?1:-1,th=body.rig.thigh*.46,sh=body.rig.shin*.46;
   originalTaper&&=
    l.hipW===body.rig.thighW&&l.kneeW===body.rig.shinW&&l.ankleW===body.rig.shinW*.8;
   const expected=(direction===Math.PI?1:-1)*Math.sin(phase)*12*body.gait.swing*side-10+body.rig.thighW*.5;
   const native=Math.abs(l.sx-expected)<1e-8&&l.sy===side*6&&
    Math.abs(l.kx-l.sx-th*.92)<1e-8&&l.ky===l.sy&&Math.abs(l.ax-l.kx-sh)<1e-8&&l.ay===l.sy;
   if(direction===0)nativeForward&&=native;
   if(direction===Math.PI)nativeBack&&=native;
  }
  honestBones&&=legs.every(l=>Math.hypot(l.kx-l.sx,l.ky-l.sy)<=body.rig.thigh&&Math.hypot(l.ax-l.kx,l.ay-l.ky)<=body.rig.shin);
 }
}
ok('aimed travel preserves the original thigh, knee and ankle widths',originalTaper);
ok('aimed forward walk, jog and run preserve every original trouser station',nativeForward);
ok('aimed backsteps reverse the step cycle without inverting or widening the trouser bones',nativeBack);
ok('forward and backward trouser segments retain the shared rig proportions',honestBones);

fresh();advance(500);probe('player.walkCycle=1.8;');
probe('player.aimHold=0;rightStick.active=false;');
ok('carrying a weapon uses the original standing leg renderer',!P('playerFootworkPose(player).active'));
probe('player.isArmed=false;');
ok('unarmed locomotion uses the original standing leg renderer',!P('playerFootworkPose(player).active'));
probe('rightStick.active=true;rightStick.dist=.4;');
ok('the first aim press constrains hips before the drawing pass raises the gun',P('playerFootworkPose(player).active'));

fresh();probe('player.aimHold=0;rightStick.active=false;leftStick.active=true;leftStick.dx=0;leftStick.dy=1;player.walkCycle=2;');
probe('frameCount++;player.updatePlayer();');
ok('normal movement keeps the original full gait cadence',
 Math.abs(P('player.walkCycle')-2-P('gaitPose(player.gait).cadence'))<1e-8);
ok('normal movement immediately faces its original movement heading',
 P('player.aimAngle===player.moveAngle')&&!P('playerFootworkPose(player).active'));
fresh();probe('leftStick.active=true;leftStick.dx=1;leftStick.dy=0;player.walkCycle=2;frameCount++;player.updatePlayer();');
ok('aimed movement also retains the original walk, jog and run clock',
 Math.abs(P('player.walkCycle')-2-P('gaitPose(player.gait).cadence'))<1e-8);

fresh();advance(800);const plantedHeading=P('playerFootworkPose(player).angle');
probe('player.aimAngle=.7;');
ok('a sight correction cannot tow the planted world-space hips before simulation',
 Math.abs(P('playerFootworkPose(player).angle')-plantedHeading)<1e-8);
advance(150);
ok('the pelvis keeps following travel beneath independent upper-body aiming',
 Math.abs(P('playerFootworkPose(player).angle')-plantedHeading)<1e-8);
probe('player.aimAngle=0;player.moveAngle=-Math.PI*.75;');
let previousHip=P('playerFootworkPose(player).angle'),smoothPivot=true;
for(let i=0;i<100;i++){
 probe('frameCount++;updateDirectionalFootwork(player,1000/60);');
 const next=P('playerFootworkPose(player).angle');
 smoothPivot&&=Math.abs(Math.atan2(Math.sin(next-previousHip),Math.cos(next-previousHip)))<=.0054*1000/60+1e-8;
 previousHip=next;
}
ok('rear-diagonal direction changes pivot the pelvis at a bounded support-foot rate',
 smoothPivot&&Math.abs(previousHip-Math.PI/4)<.02&&P('playerFootworkPose(player).backward>.99'));

let rearStable=true;
for(const direction of [Math.PI*.72,Math.PI*.75,Math.PI,Math.PI*1.25,Math.PI*1.28]){
 fresh(direction);advance(1000);
 for(let i=0;i<48;i++){
  probe(`player.walkCycle=${i*Math.PI/24};`);
  for(const l of P('[standingFootworkLeg(player,0),standingFootworkLeg(player,1)]'))
   rearStable&&=l.hipW>l.kneeW&&l.kneeW>l.ankleW&&l.kx>l.sx&&l.ax>l.kx&&
    Math.hypot(l.kx-l.sx,l.ky-l.sy)>.25&&Math.abs(l.ay)===6;
 }
}
ok('rear diagonals preserve the original connected tapered leg style through the full gait',rearStable);

let bounded=true,finite=true,continuous=true,previous=null;
fresh();
for(let i=0;i<=720;i++){
 probe(`player.moveAngle=${i*Math.PI/360};player.walkCycle=1.1;frameCount++;updateDirectionalFootwork(player,16.67);`);
 const pose=P('playerFootworkPose(player)'),leg=P('standingFootworkLeg(player,0)');
 const turn=Math.atan2(Math.sin(pose.angle),Math.cos(pose.angle));
 bounded&&=Math.abs(turn)<=Math.PI/4+1e-8;
 finite&&=Object.values(leg).filter(x=>typeof x==='number').every(Number.isFinite);
 if(previous)continuous&&=Math.hypot(leg.ax-previous.ax,leg.ay-previous.ay)<.8;
 previous=leg;
}
ok('hips remain anatomically bounded over a complete aim/travel rotation',bounded);
ok('all directional ankle and knee positions remain finite',finite);
ok('crossing forward, lateral and backward directions does not teleport a foot',continuous);

for(const side of [-1,1]){
 fresh(side*Math.PI/2);advance(3300);
 ok((side<0?'left':'right')+' lateral travel stays normal through 3.3 continuous seconds',P('playerFootworkPose(player).skip<.001'));
 advance(900);
 ok((side<0?'left':'right')+' sustained strafe blends into a side skip',P('playerFootworkPose(player).skip>.85'));
 probe(`window.footworkSkip={...playerFootworkPose(player),skip:1,skipPhase:Math.PI*.2};`);
 const leading=P(`standingFootworkLeg(player,${side<0?0:1},footworkSkip)`),following=P(`standingFootworkLeg(player,${side<0?1:0},footworkSkip)`);
 ok((side<0?'left':'right')+' travel starts its skip with the direction-side foot',leading.leading&&!following.leading&&leading.lift>following.lift+.5);
 probe('player.moveAngle=0;');advance(1100);
 ok('leaving the '+(side<0?'left':'right')+' strafe releases the skip pose',P('playerFootworkPose(player).skip<.05'));
}

for(const diagonal of [Math.PI/4,Math.PI*.75,-Math.PI/4,-Math.PI*.75]){
 fresh(diagonal);advance(5000);
 ok('diagonal '+diagonal+' never accumulates lateral skip time',P('player._directionalFootwork.strafeMs===0&&playerFootworkPose(player).skip<.001'));
}
for(const interrupt of ['player.moveAngle=Math.PI/4;','player.isMoving=false;','player.moveAngle=-Math.PI/2;']){
 fresh(Math.PI/2);advance(3250);probe(interrupt);advance(50);
 probe('player.isMoving=true;player.moveAngle=Math.PI/2;');advance(100);
 ok('a brief '+interrupt+' interruption restarts the lateral hold',P('player._directionalFootwork.strafeMs<=150&&playerFootworkPose(player).skip===0'));
}
fresh(Math.PI/2);advance(4300);
const rhythmStart=P('player._directionalFootwork.skipPhase');advance(1000);
const rhythmTurns=(P('player._directionalFootwork.skipPhase')-rhythmStart)/(Math.PI*2);
ok('the long skip advances at a measured rhythm below one cycle per second',rhythmTurns>.5&&rhythmTurns<.8);
let smoothSkip=true,previousSkip=null;
for(let i=0;i<240;i++){
 probe('frameCount++;updateDirectionalFootwork(player,1000/120);');const l=P('standingFootworkLeg(player,0)');
 if(previousSkip)smoothSkip&&=Math.hypot(l.ax-previousSkip.ax,l.ay-previousSkip.ay)<.9;
 previousSkip=l;
}
ok('long lateral contacts and recovery remain smooth at frame boundaries',smoothSkip);
const oldSide=P('player._directionalFootwork.skipSide'),oldHeading=P('player._directionalFootwork.skipHeading');
const oldFeet=P('[standingFootworkLeg(player,0),standingFootworkLeg(player,1)]');
probe('player.moveAngle=-Math.PI/2;frameCount++;updateDirectionalFootwork(player,1000/60);');
const changedFeet=P('[standingFootworkLeg(player,0),standingFootworkLeg(player,1)]');
ok('reversing travel eases out the outgoing support-foot sequence rather than swapping feet',
 P('player._directionalFootwork.skipSide')===oldSide&&P('player._directionalFootwork.skipHeading')===oldHeading&&
 changedFeet.every((l,i)=>Math.hypot(l.ax-oldFeet[i].ax,l.ay-oldFeet[i].ay)<4));
probe('player.isMoving=false;frameCount++;updateDirectionalFootwork(player,1000/60);');
const stoppedFeet=P('[standingFootworkLeg(player,0),standingFootworkLeg(player,1)]');
ok('releasing movement lets the long skip settle without snapping the ankle to rest',
 stoppedFeet.every((l,i)=>Math.hypot(l.ax-changedFeet[i].ax,l.ay-changedFeet[i].ay)<4));

for(const weapon of ['PISTOL','SMG','REVOLVER','TASER']){
 fresh(Math.PI/2);advance(4300);probe(`player.currentWeapon=WEAPONS.${weapon};player._directionalFootwork.skip=1;player._directionalFootwork.skipPhase=.9;player.gait=1;`);
 const hands=[],nativeLimb=ctx.figureCelLimb;
 ctx.figureCelLimb=(...args)=>{if(Math.abs(args[1]+1.5)<1e-8&&Math.abs(args[2]+P('player.bodyH')*.425)<1e-8)hands.push([args[5],args[6]]);return nativeLimb(...args);};
 for(let i=0;i<16;i++)probe(`player.walkCycle=${i*Math.PI/8};player.show();`);
 ctx.figureCelLimb=nativeLimb;
 ok(weapon+' skip keeps its free hand relaxed instead of following the run cycle',hands.length===16&&hands.every(h=>Math.hypot(h[0]-hands[0][0],h[1]-hands[0][1])<1e-8));
}

fresh(Math.PI/2);advance(300);
probe('isPaused=true;');const frozen=P('JSON.stringify(player._directionalFootwork)');advance(800);
ok('pausing does not accumulate strafe time',P('JSON.stringify(player._directionalFootwork)')===frozen);
probe('isPaused=false;');
const unchanged=P('JSON.stringify(player._directionalFootwork)');
probe('for(let i=0;i<10;i++){playerFootworkPose(player);standingFootworkLeg(player,0);}');
ok('painting and querying joints never advance the side-skip state',P('JSON.stringify(player._directionalFootwork)')===unchanged);

for(const [label,setup] of [
 ['un-aimed carry','player.aimHold=0;rightStick.active=false;'],
 ['unarmed actor','player.isArmed=false;player.aimHold=0;rightStick.active=false;'],
 ['mounted actor','player.mounted=true;'],
 ['crouch stance',"resetActorStance(player,'CROUCH');"],
 ['prone stance',"resetActorStance(player,'PRONE');"],
 ['melee action','player.meleeTimer=10;'],
 ['shovel utility',"window.shovelOwned=true;setMeleeTool('SHOVEL');"]]){
 fresh(Math.PI);probe(setup);
 ok(label+' retains its dedicated animation path',!P('playerFootworkPose(player).active'));
}

fresh(Math.PI);advance(400);probe('player.walkCycle=.8;');
const leg=P('standingFootworkLeg(player,0)'),angle=P('playerFootworkPose(player).angle');
const x=leg.kx+(leg.ax-leg.kx)*.8,y=leg.ky+(leg.ay-leg.ky)*.8;
probe(`window.footworkWound={sz:2};mapLegHitDecal(player,player.x+${Math.cos(angle)*x-Math.sin(angle)*y},player.y+${Math.sin(angle)*x+Math.cos(angle)*y},footworkWound);`);
ok('leg-hit stains attach to the current backward-step shin',P('footworkWound.legIndex===0&&Math.abs(footworkWound.legU-.8)<1e-6'));
let painted=0,depth=0,minimum=0;
const saved={draw:ctx.drawStandingFootworkLegs,push:ctx.push,pop:ctx.pop};
ctx.drawStandingFootworkLegs=(...args)=>{painted++;return saved.draw(...args);};
ctx.push=(...args)=>{depth++;return saved.push(...args);};
ctx.pop=(...args)=>{depth--;minimum=Math.min(minimum,depth);return saved.pop(...args);};
probe('player.show();');Object.assign(ctx,{drawStandingFootworkLegs:saved.draw,push:saved.push,pop:saved.pop});
ok('the actual standing renderer paints the shared directional leg rig once',painted===1);
ok('directional standing footwork restores the native painter stack',depth===0&&minimum===0);
let surfaces=0,boots=0;
const nativeSurface=ctx.figureCelLimb,nativeOval=ctx.figureCelOval;
ctx.figureCelLimb=(...args)=>{surfaces++;return nativeSurface(...args);};
ctx.figureCelOval=(...args)=>{boots++;return nativeOval(...args);};
probe('drawStandingFootworkLegs(player,window,figureRig(player.bodyW,player.bodyH),playerFootworkPose(player));');
ctx.figureCelLimb=nativeSurface;ctx.figureCelOval=nativeOval;
ok('aimed trousers retain exactly two original continuous leg surfaces and two boots',surfaces===2&&boots===2);
console.log(`${checks}/${checks} standing backward, strafe, skip and leg-decal checks passed`);

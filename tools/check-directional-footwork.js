// Standing aim-relative leg strokes, sustained side skipping and shared decal
// attachment. Rendering is pure; elapsed side travel is owned by simulation.
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
probe('player.walkCycle=1.7;');const back=P('standingFootworkLeg(player,0)');
probe('player.moveAngle=0;');advance(350);const forward=P('standingFootworkLeg(player,0)');
ok('a backstep reverses ankle travel and plants the heel behind the hips',Math.abs(back.ax+forward.ax)<1e-6&&back.ax<back.sx);
ok('backward toes keep facing forward instead of turning the legs around',Math.abs(back.heading)<.01);

let honestBones=true;
for(const [label,direction]of [['forward',0],['backward',Math.PI]]){
 fresh(direction);advance(350);let exposed=true;
 for(const gait of [.2,.5])for(let i=0;i<48;i++){
  const phase=i*Math.PI/24;
  probe(`player.gait=${gait};player.walkCycle=${phase};`);
  const body=P('({w:player.bodyW,h:player.bodyH,rig:figureRig(player.bodyW,player.bodyH),gait:{...gaitPose(player.gait)}})');
  const bob=Math.abs(Math.sin(phase))*2*body.gait.bob+body.gait.lean;
  const legs=[P('standingFootworkLeg(player,0)'),P('standingFootworkLeg(player,1)')];
  exposed&&=legs.some(l=>{
   const x=l.ax+body.rig.foot*.34,y=l.ay+Math.sign(l.ay)*l.ankleW*.5;
   return ((x-bob)/(body.w*.84*.5))**2+(y/(body.h*.5))**2>1.02&&Math.abs(y)>12;
  });
  honestBones&&=legs.every(l=>Math.hypot(l.kx-l.sx,l.ky-l.sy)<=body.rig.thigh&&Math.hypot(l.ax-l.kx,l.ay-l.ky)<=body.rig.shin);
 }
 ok(label+' walk/jog retains an exposed shoe edge through the whole aimed stride',exposed);
}
ok('wider aimed feet keep both knee segments within their actual bone lengths',honestBones);

let bounded=true,finite=true,continuous=true,previous=null;
fresh();
for(let i=0;i<=720;i++){
 probe(`player.moveAngle=${i*Math.PI/360};player.walkCycle=1.1;frameCount++;updateDirectionalFootwork(player,16.67);`);
 const pose=P('playerFootworkPose(player)'),leg=P('standingFootworkLeg(player,0)');
 const turn=Math.atan2(Math.sin(pose.angle),Math.cos(pose.angle));
 bounded&&=Math.abs(turn)<=.62;
 finite&&=Object.values(leg).filter(x=>typeof x==='number').every(Number.isFinite);
 if(previous)continuous&&=Math.hypot(leg.ax-previous.ax,leg.ay-previous.ay)<.8;
 previous=leg;
}
ok('hips remain anatomically bounded over a complete aim/travel rotation',bounded);
ok('all directional ankle and knee positions remain finite',finite);
ok('crossing forward, lateral and backward directions does not teleport a foot',continuous);

for(const side of [-1,1]){
 fresh(side*Math.PI/2);advance(450);
 ok((side<0?'left':'right')+' brief strafe stays a side step rather than immediately skipping',P('playerFootworkPose(player).skip<.001'));
 advance(650);
 ok((side<0?'left':'right')+' sustained strafe blends into a side skip',P('playerFootworkPose(player).skip>.85'));
 probe(`window.footworkSkip={...playerFootworkPose(player),skip:1,skipPhase:Math.PI*.2};`);
 const leading=P(`standingFootworkLeg(player,${side<0?0:1},footworkSkip)`),following=P(`standingFootworkLeg(player,${side<0?1:0},footworkSkip)`);
 ok((side<0?'left':'right')+' travel starts its skip with the direction-side foot',leading.leading&&!following.leading&&leading.lift>following.lift+.5);
 probe('player.moveAngle=0;');advance(500);
 ok('leaving the '+(side<0?'left':'right')+' strafe releases the skip pose',P('playerFootworkPose(player).skip<.05'));
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
console.log(`${checks}/${checks} standing backward, strafe, skip and leg-decal checks passed`);

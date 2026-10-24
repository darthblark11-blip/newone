// Standing aim changes the hip frame, never the native leg rig or movement.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;ctx.navigator.getGamepads=()=>[];
function fresh(aim=0,move=Math.PI*.75){
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
function step(ms=1000/60){probe(`frameCount++;updateStandingHip(player,${ms});`);}
function settle(ms=1400){for(let left=ms;left>0;left-=50)step(Math.min(50,left));}

let bounded=true,forwardBack=true,diagonalFlex=true;
for(let facing=0;facing<8;facing++)for(let travel=0;travel<8;travel++){
 const aim=facing*Math.PI/4,move=travel*Math.PI/4;
 fresh(aim,move);settle();
 const relative=wrap(P('standingHipHeading(player)')-aim),delta=wrap(move-aim),limit=P('STANDING_HIP_TWIST_MAX');
 bounded&&=P('standingHipCoupled(player)')&&Math.abs(relative)<=limit+1e-9;
 if(Math.abs(Math.sin(delta))<1e-8)forwardBack&&=Math.abs(relative)<1e-8;
 if(Math.abs(Math.sin(2*delta))>.99)diagonalFlex&&=Math.abs(relative)>limit*.95&&relative*Math.sin(2*delta)>0;
}
ok('all 64 aim/travel combinations keep the hips within 25 degrees of the torso',bounded);
ok('straight forward and backward travel share the aimed torso heading',forwardBack);
ok('front and rear diagonals retain a small opposing natural twist',diagonalFlex);

fresh(0,0);settle();let previous=P('standingHipHeading(player)'),smooth=true,limited=true;
for(let i=1;i<=720;i++){
 probe(`player.moveAngle=${i*Math.PI/360};`);step();
 const heading=P('standingHipHeading(player)');
 smooth&&=Math.abs(wrap(heading-previous))<=P('STANDING_HIP_TURN_RATE')/60*1000+1e-9;
 limited&&=Math.abs(wrap(heading))<=P('STANDING_HIP_TWIST_MAX')+1e-9;previous=heading;
}
ok('a full movement-stick revolution cannot spin the hips around a fixed torso',limited);
ok('direction changes respect a bounded support-foot twist rate',smooth);

fresh(0,Math.PI/4);settle();const reversalBefore=P('standingHipHeading(player)');
probe('player.moveAngle=-Math.PI/4;');step();
const reversalChange=wrap(P('standingHipHeading(player)')-reversalBefore);
ok('an abrupt opposite diagonal cannot exceed the twist rate limit',reversalChange<0&&Math.abs(reversalChange)<=P('STANDING_HIP_TURN_RATE')/60*1000+1e-9);
fresh(0,Math.PI/4);settle();const torsoTurnBefore=P('standingHipHeading(player)');
probe('player.aimAngle=Math.PI/2;');
ok('a torso turn carries the hips with it instead of leaving an independent world heading',Math.abs(wrap(P('standingHipHeading(player)')-torsoTurnBefore-Math.PI/2))<1e-9);
fresh();settle();probe('player.isMoving=false;');settle();
ok('stopping travel lets the small twist settle back to the aimed torso',Math.abs(wrap(P('standingHipHeading(player)')-P('player.aimAngle')))<1e-4);

fresh(Math.PI-.02,Math.PI*.75);settle();const seamBefore=P('standingHipHeading(player)');
probe('player.aimAngle=-Math.PI+.02;');step();
ok('crossing the aiming-angle seam takes a short continuous turn',Math.abs(wrap(P('standingHipHeading(player)')-seamBefore))<.10);
fresh(0,Math.PI*.75);step();const once=P('JSON.stringify(player._standingHip)');
probe('updateStandingHip(player,1000/60);');
ok('multiple consumers cannot advance the hip state twice in one simulation frame',P('JSON.stringify(player._standingHip)')===once);
const pausedHeading=P('standingHipHeading(player)');
probe('isPaused=true;frameCount++;updateStandingHip(player,100);');
ok('pause retains both the coupled viewing frame and frozen hip simulation',P('JSON.stringify(player._standingHip)')===once&&P('standingHipHeading(player)')===pausedHeading);
probe('isPaused=false;doTick=false;frameCount++;updateStandingHip(player,100);');
ok('a suspended simulation cannot advance the hip twist',P('JSON.stringify(player._standingHip)')===once);

fresh();const beforeFallback=P('standingHipHeading(player)');
probe('player.show();player.show();');
ok('rendering an uninitialized hip frame is pure and deterministic',P('player._standingHip==null')&&P('standingHipHeading(player)')===beforeFallback);
settle();const beforePaint=P('JSON.stringify(player._standingHip)');
probe('player.show();player.show();player.show();');
ok('repeated painting never advances cached hip motion',P('JSON.stringify(player._standingHip)')===beforePaint);

for(const [label,setup]of [
 ['ordinary movement','player.aimHold=0;rightStick.active=false;'],
 ['nonplayer','player.isPlayer=false;'],['mounted rider','player.mounted=true;'],
 ['dash','player.dashTimer=10;'],['melee strike','player.meleeTimer=10;'],
 ['boxing','player._boxing={active:true};'],['knockout','player.knockedOut=true;'],
 ['stun','player.stunTimer=10;'],['skeleton stun','player.skeletonTimer=10;'],
 ['shovel',"window.shovelOwned=true;setMeleeTool('SHOVEL');"],
 ['mantle','player.shovelMantle={};'],['held grenade','isCooking=true;'],
 ['throw follow-through','player.throwAnimTimer=12;'],
 ['chemist cannon','chemistSuitUnlocked=true;player.cannonCharge=40;'],
 ['crouch',"resetActorStance(player,'CROUCH');"],
 ['prone',"resetActorStance(player,'PRONE');"],['lowering transition','player.stance.to=1;']]){
 fresh();probe(setup);
 ok(label+' keeps its dedicated movement-facing frame',!P('standingHipCoupled(player)')&&Math.abs(wrap(P('standingHipHeading(player)')-P('player.moveAngle')))<1e-9);
}
fresh();settle();probe('rightStick.active=false;player.aimHold=0;frameCount++;updateStandingHip(player,20);');
ok('releasing the final aimed cue retires hip state and restores ordinary travel',P('player._standingHip===null&&standingHipHeading(player)===player.moveAngle'));
for(const [label,setup]of [['first aim press','player.aimHold=0;'],
 ['muzzle flash','rightStick.active=false;player.aimHold=0;player.muzzleFlash=3;'],
 ['reload','rightStick.active=false;player.aimHold=0;player.reloadTimer=12;']]){
 fresh();probe(setup);ok(label+' immediately selects the coupled hip frame',P('standingHipCoupled(player)'));
}
for(const [tool,setup]of [['SWORD',"swordPickedUp=true;setMeleeTool('SWORD');"],
 ['PICKAXE',"window.pickaxeOwned=true;setMeleeTool('PICKAXE');"]]){
 fresh();probe(setup+'player.isArmed=false;player.aimHold=14;rightStick.active=false;');
 ok(tool+' carry ignores an old gun-aim hold and retains movement-facing hips',P('!standingHipCoupled(player)&&standingHipHeading(player)===player.moveAngle'));
 probe('rightStick.active=true;player.show();');
 ok(tool+' carry can raise the actual gun and couple on a new aim press',P('player.isArmed&&standingHipCoupled(player)'));
}

fresh();settle();const rig=P('figureRig(player.bodyW,player.bodyH)'),fore=P('STAND_FORE_LEG');
const heading=P('standingHipHeading(player)'),swing=P('Math.sin(player.walkCycle)*12*gaitPose(player.gait).swing');
const kx=-10+swing+rig.thighW*.5+rig.thigh*fore*.92,ax=kx+rig.shin*fore,x=kx+(ax-kx)*.8,y=-6;
probe(`window.coupledLegWound={sz:2};mapLegHitDecal(player,player.x+${Math.cos(heading)*x-Math.sin(heading)*y},player.y+${Math.sin(heading)*x+Math.cos(heading)*y},coupledLegWound);`);
ok('a leg hit stays attached to the visible coupled shin frame',P('coupledLegWound.legIndex===0&&Math.abs(coupledLegWound.legU-.8)<1e-6'));
const aimBefore=P('player.aimAngle'),moveBefore=P('player.moveAngle'),phaseBefore=P('player.walkCycle'),gaitBefore=P('player.gait');
for(let i=0;i<30;i++)step();
ok('the hip update never rewrites aim, travel, gait or leg phase',P('player.aimAngle')===aimBefore&&P('player.moveAngle')===moveBefore&&P('player.walkCycle')===phaseBefore&&P('player.gait')===gaitBefore);
ok('the obsolete footwork and skip rig remains absent',P("typeof playerFootworkPose==='undefined'&&typeof updateDirectionalFootwork==='undefined'&&typeof standingFootworkLeg==='undefined'"));
console.log(`${checks}/${checks} standing hip bounds, smoothing, frame ownership, exceptions and decal checks passed`);

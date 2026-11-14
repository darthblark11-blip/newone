// Simulation-owned pose transitions: input reversals preserve momentum, the
// same solid travels between carry/aim, and shots leave its current muzzle.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
ctx.setTimeout=()=>0;ctx.navigator.getGamepads=()=>[];
const P=s=>probe('('+s+')'),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
let checks=0;const ok=(value,label)=>{assert(value,label);checks++;};
function fresh(weapon='ASSAULT_RIFLE',stance='STAND') {
  probe(`resetRunState();resetUndergroundRoute();currentBiome=currentLevel=2;BIOME_ACTIVE=false;
    started=doTick=true;isPaused=isDead=isWin=killcamMode=isStoryMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
    inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
    window.inNM0SecretOverlay=false;window.isDesktop=false;buildGhost=null;
    activeBuildings=buildings=[];activeParkingCars=[];enemiesList=[];barrels=[];bullets=[];invalidateColIndex();
    setMeleeTool('NONE');window.shovelOwned=false;chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=false;
    isCooking=meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;
    leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
    player=new Character(70,90,true);player.currentWeapon=WEAPONS.${weapon};player.isArmed=true;
    player.aimHold=player.meleeTimer=player.reloadTimer=player.dashTimer=player.muzzleFlash=0;
    player.ammo=10000;resetActorStance(player,${JSON.stringify(stance)});
    frameCount=100;deltaTime=1000/60;__faults=[];noteFrameFault=(where,e)=>__faults.push(where+': '+e.message);`);
}
function target(active,angle=0,fire=false) {
  probe(`rightStick.active=${active};rightStick.dx=Math.cos(${angle});rightStick.dy=Math.sin(${angle});rightStick.dist=${fire?1:.4};`);
}
function tick(n=1,ms=1000/60) {for(let i=0;i<n;i++)probe(`frameCount++;deltaTime=${ms};player.updatePlayer();`);}

fresh();tick();ok(P('standingWeaponPresentation(player)===0'),'an un-aimed simulation begins in its original carry');
target(true);tick();
const raised=P('standingWeaponPresentation(player)');
ok(raised>0&&raised<.15,'first raise frame contains a genuine intermediate pose');
let previous=raised,bounded=true,monotone=true;
for(let i=0;i<75;i++){tick();const t=P('standingWeaponPresentation(player)');bounded&&=t>=0&&t<=1;monotone&&=t>=previous;previous=t;}
ok(bounded&&monotone&&previous===1,'the raising spring reaches a stable exact aim without overshooting');
target(false);tick(P('AIM_HOLD'));
const firstLower=P('standingWeaponPresentation(player)');
ok(firstLower<1&&firstLower>.90,'letting aim expire begins a connected return instead of dropping the gun');
tick(5);const beforeReverse=P('({v:player._weaponPresentation.velocity,t:standingWeaponPresentation(player)})');
target(true);tick();
const reversed=P('({v:player._weaponPresentation.velocity,t:standingWeaponPresentation(player)})');
ok(beforeReverse.v<0&&reversed.t>0&&reversed.t<1&&Math.abs(reversed.t-beforeReverse.t)<.12,
  'reversing a partial lowering keeps its position and brakes its velocity');
tick(90);ok(P('standingWeaponPresentation(player)===1'),'a reversed raise converges exactly');

for(const rate of [15,30,60,120]) {
  fresh();target(true);tick(rate*.4,1000/rate);
  const value=P('standingWeaponPresentation(player)');
  ok(Math.abs(value-(1-(1+27*.4)*Math.exp(-27*.4)))<.0006,'analytic pose integration agrees across '+rate+' Hz');
}

// Verify both the gun's first shot and its post-shot recoil pose. A recoil
// update may move the receiver, but the crown cannot detach from its flash.
for(const weapon of ['PISTOL','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','PARTICLE_BEAM','REVOLVER','ROCKET_LAUNCHER','COACH_GUN','BOW']) {
  fresh(weapon);tick();target(true,.7,weapon!=='BOW');
  probe('__fireRandom=random;random=function(a,b){return b===undefined?__fireRandom(a):(a+b)/2;};');tick();
  if(weapon==='BOW')probe('player.fire(player.aimAngle,{tension:.4,quality:1,power:.3});');
  probe('random=__fireRandom;');
  const result=P(`(()=>{const pose=standingPresentationPose(player),a=player.aimAngle,
    co=Math.cos(a+pose.tw),si=Math.sin(a+pose.tw);
    return {t:pose.t,faults:__faults,bullets:bullets.map(b=>({x:b.startX,y:b.startY,a:b.a})),
      guns:pose.weapons.map(g=>({x:player.x+co*(pose.bob+g.muzzle.x)-si*g.muzzle.y,
        y:player.y+si*(pose.bob+g.muzzle.x)+co*g.muzzle.y,a:g.heading})),
      valid:pose.arms.every(j=>Object.values(j).every(v=>typeof v!=='number'||Number.isFinite(v))),
      maxBone:Math.max(...pose.arms.flatMap(j=>[Math.hypot(j.ex-j.sx,j.ey-j.sy)/pose.R.upper,Math.hypot(j.hx-j.ex,j.hy-j.ey)/pose.R.fore]))};})()`);
  ok(result.t>0&&result.t<1&&result.bullets.length>0,weapon+' fires immediately during its raise');
  for(let i=0;i<result.guns.length;i++) {
    const b=result.bullets[weapon==='SHOTGUN'?0:i],g=result.guns[i];
    ok(b&&Math.hypot(b.x-g.x,b.y-g.y)<1e-7,weapon+' muzzle stays attached through same-frame recoil ('+i+')');
    if(weapon!=='SHOTGUN')
      ok(Math.abs(wrap(b.a-g.a))<1e-8,weapon+' center ray follows its actual intermediate barrel');
  }
  ok(result.valid&&result.maxBone<=1.001,weapon+' transitional sleeves remain finite and retain their bone lengths');
  probe('player.show();player.show();');ok(P('__faults.length===0'),weapon+' renders twice without a scene fault');
}

for(const weapon of ['PISTOL','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN'])for(const warm of [false,true]) {
  fresh(weapon);if(warm)tick();
  target(true,0,true);probe('leftStick.active=true;leftStick.dx=1;leftStick.dy=0;');
  for(const direction of [1,-1,1]) {
    probe(`leftStick.dx=${direction};player.fireTimer=0;`);tick();
    ok(P(`(()=>{const rays=player.currentWeapon===WEAPONS.DUAL_SMG?2:1;
      return Array.from({length:rays},(_,i)=>{const m=aimLaserMuzzle(player,i),b=bullets[bullets.length-rays+i];
        return Math.hypot(b.startX-m.x,b.startY-m.y)<1e-7;}).every(Boolean);})()`),
      weapon+' '+(warm?'warm':'cold')+' move/raise reversal '+direction+' preserves the same-frame muzzle');
  }
}

fresh();tick();target(true,.8);tick(5);
const frozen=P('JSON.stringify(player._weaponPresentation)');
probe('player.show();player.show();standingPresentationPose(player);');
ok(P('JSON.stringify(player._weaponPresentation)')===frozen,'multiple paint/muzzle consumers never advance the animation');
probe('isPaused=true;frameCount++;updateWeaponPresentation(player,100);');
ok(P('JSON.stringify(player._weaponPresentation)')===frozen,'pause freezes pose position, velocity and phase');
probe('isPaused=false;doTick=false;frameCount++;updateWeaponPresentation(player,100);');
ok(P('JSON.stringify(player._weaponPresentation)')===frozen,'a suspended simulation also freezes presentation');

fresh();tick();probe('leftStick.active=true;leftStick.dx=-1;leftStick.dy=0;');tick();
ok(P('player.x<70&&Math.abs(player.aimAngle)<.1'),'movement responds immediately while the body begins a connected turn');
const firstAngle=P('player.aimAngle');tick();
ok(Math.abs(wrap(P('player.aimAngle')-firstAngle))<11/60,'a full opposite input cannot flip the torso in one frame');

fresh('ASSAULT_RIFLE','CROUCH');tick();target(true);tick();
ok(P('standingWeaponPresentation(player)>0&&standingWeaponPresentation(player)<1&&stanceWeaponMount(player).angle<0'),
  'crouched carry and aim share the same presentation envelope');
tick(90);ok(P('Math.abs(stanceWeaponMount(player).angle)<1e-8'),'a crouched raise reaches its ordinary firing mount');

// Endpoints matter too: a solve that fits only the first partial raise can
// still stretch a settled support arm or leave a sprinting hand off its gun.
fresh();
probe(`__sweep={poses:0,bone:0,grip:0,finite:true};
  for(const weapon of ['PISTOL','SMG','DUAL_SMG','REVOLVER','TASER','ASSAULT_RIFLE','SHOTGUN','PARTICLE_BEAM','ROCKET_LAUNCHER','COACH_GUN','BOW']) {
    player.currentWeapon=WEAPONS[weapon];player.isMoving=true;
    player._standingMotion={active:true,motion:1};
    for(const gait of [.2,.5,1])for(let phase=0;phase<24;phase++)for(const presentation of [0,.2,.5,.8,1])
      for(let heading=0;heading<8;heading++)for(const kick of [0,6]) {
        frameCount++;player.gait=gait;player.walkCycle=phase*Math.PI/12;player.aimAngle=heading*Math.PI/4;
        player.weaponKick=kick;player._weaponPresentation={value:presentation};
        const pose=standingPresentationPose(player);__sweep.poses++;
        for(const arm of pose.arms) {
          __sweep.finite&&=Object.values(arm).every(v=>typeof v!=='number'||Number.isFinite(v));
          __sweep.bone=Math.max(__sweep.bone,Math.hypot(arm.ex-arm.sx,arm.ey-arm.sy)/pose.R.upper,
            Math.hypot(arm.hx-arm.ex,arm.hy-arm.ey)/pose.R.fore);
          if(arm.grip!==null) {
            const grip=pose.weapons[arm.weaponIndex].point(arm.grip);
            __sweep.grip=Math.max(__sweep.grip,Math.hypot(grip.x-arm.hx,grip.y-arm.hy));
          }
        }
      }
  }`);
ok(P('__sweep.poses===63360&&__sweep.finite'),'all weapons, gaits, headings, recoil and carry/aim endpoints remain finite');
ok(P('__sweep.bone<=1.0000001'),'no sleeve grows beyond its actual upper/forearm length across the complete pose sweep');
ok(P('__sweep.grip<1e-8'),'every holding wrist remains exactly on its actual grip or handguard through the sweep');

fresh();target(true);probe('leftStick.active=true;leftStick.dx=-1;leftStick.dy=0;');tick(100);
probe(`__rearJoints=()=>{const lower=standingLowerPose(player),pose=standingRearPose(player,lower),R=figureRig(player.bodyW,player.bodyH);
  return [0,1].flatMap(i=>{const leg=standingRearLeg(player,pose,R,i);return ['sx','sy','kx','ky','ax','ay'].map(key=>leg[key]);});};
  __backBefore=__rearJoints();`);
tick();probe('__backSteady=__rearJoints();leftStick.dx=1;');
const oldX=P('player.x');tick();
ok(P('player.x')>oldX,'a backward-to-forward reversal keeps physical input immediate');
ok(P('Math.max(...__backSteady.map((v,i)=>Math.abs(v-__rearJoints()[i])))<2.2'),
  'backstep feet connect through a travel vector instead of mirroring their stride in one frame');
ok(P('player._standingMotion.travelX<0&&player.moveAngle===0'),
  'the visual travel vector brakes through zero while the actual travel direction reverses immediately');

fresh();probe(`player.mounted=true;player.mountCoat=color(92,62,40);player.mountMane=color(48,35,28);
  leftStick.active=true;leftStick.dx=1;leftStick.dy=0;
  __horseAmplitudes=[];__horseArt=drawHorseArt;drawHorseArt=function(){__horseAmplitudes.push(arguments[3]);return __horseArt.apply(this,arguments);};`);
tick(40);probe('player.show();leftStick.active=false;leftStick.dx=0;');tick();probe('player.show();');
ok(P('__horseAmplitudes.length===2&&__horseAmplitudes[0]>.99&&__horseAmplitudes[1]>0&&__horseAmplitudes[1]<__horseAmplitudes[0]'),
  'a mounted horse inherits the rider\'s eased gait on the first real stop frame');
ok(P('__faults.length===0'),'the mounted transition retains the native horse and rider drawing');
probe('drawHorseArt=__horseArt;');
console.log(`${checks}/${checks} entity carry/aim, recoil muzzle and reversal checks passed.`);

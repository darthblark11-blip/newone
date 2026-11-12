// Reproduce a player running around a fighting human through the real
// Character update, native turn consumer, weapon muzzle and figure painter.
// No AI, movement, facing or firing function is replaced by this test.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>a===undefined?.5:Array.isArray(a)?a[0]:b===undefined?a*.5:a+(b-a)*.5;
let checks=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

function scene(radius=30,type='NORMAL',stance='STAND'){
  P(`resetRunState();resetShovelState();resetUndergroundRoute();
    currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inCutscene=false;
    inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
    window.inNM0SecretOverlay=false;buildGhost=null;
    leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
    buildings=activeBuildings=parkingCars=activeParkingCars=barrels=[];
    bullets=[];particles=[];corpses=[];invalidateColIndex();resetForestWildlife();
    player=new Character(${radius},0,true);player.hp=player.maxHp=1000000;player.shield=1000000;
    var trackingGuard=new Character(0,0,false,${JSON.stringify(type)});
    trackingGuard.isArmed=true;trackingGuard.currentWeapon=WEAPONS.PISTOL;
    trackingGuard.aimAngle=trackingGuard.moveAngle=0;trackingGuard.state='CHASE';
    trackingGuard.fireTimer=0;trackingGuard.aiOffset=0;
    trackingGuard.postX=trackingGuard.postY=trackingGuard.postR=0;
    resetActorStance(trackingGuard,${JSON.stringify(stance)});
    enemiesList=[trackingGuard];frameCount=100;deltaTime=1000/60;
    viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
    worldTimeMs=DAY_MS/2;updateSunVector();stealthPerceptionReset();
    stealthAlert(trackingGuard,player.x,player.y);
    stealthPerceptionState(trackingGuard).visible=true;
    var trackingAngle=0,trackingElapsed=0,trackingRows=[];`);
}

function orbit(radius,hz,seconds=4,reverse=false){
  P(`for(let i=0;i<${hz*seconds};i++){
    deltaTime=1000/${hz};frameCount++;trackingElapsed+=deltaTime;
    trackingAngle+=(trackingElapsed<=2000||!${reverse}?1:-1)*312/${radius}/${hz};
    player.x=${radius}*Math.cos(trackingAngle);player.y=${radius}*Math.sin(trackingAngle);
    const before=trackingGuard.aimAngle,shotsBefore=bullets.length;
    trackingGuard.updateEnemy();
    const state=stealthPerceptionState(trackingGuard),muzzle=aimLaserMuzzle(trackingGuard);
    const newShots=bullets.slice(shotsBefore).map(b=>({angle:b.a,x:b.startX,y:b.startY}));
    trackingRows.push({at:trackingElapsed,angle:trackingGuard.aimAngle,
      error:Math.abs(Math.atan2(Math.sin(trackingAngle-trackingGuard.aimAngle),Math.cos(trackingAngle-trackingGuard.aimAngle))),
      step:Math.abs(Math.atan2(Math.sin(trackingGuard.aimAngle-before),Math.cos(trackingGuard.aimAngle-before))),
      phase:state.phase,nativeState:trackingGuard.state,sharedAngle:trackingGuard._entityFacing.angle,
      weaponAngle:weaponAimHeading(trackingGuard),muzzle:{x:muzzle.x,y:muzzle.y},shots:newShots});
  }`);
  return P('trackingRows');
}

const summaries=[];
for(const [type,stance]of[['NORMAL','STAND'],['FEMALE_PISTOL','CROUCH']]){
  for(const hz of[15,30,60,120])for(const radius of[30,45,60]){
    scene(radius,type,stance);const rows=orbit(radius,hz),label=`${type} ${stance} r${radius} ${hz}Hz`;
    const steady=rows.filter(r=>r.at>=1000),shots=rows.flatMap(r=>r.shots.map(s=>({row:r,shot:s})));
    const maxError=Math.max(...steady.map(r=>r.error));
    ok(maxError<Math.PI/12,`${label}: a full-speed tight orbit stays within 15 degrees of the visible player`);
    ok(rows.every(r=>r.phase==='ALERT'&&r.nativeState==='CHASE'),`${label}: circling cannot send an engaged guard back to investigation`);
    ok(rows.every(r=>r.step<=24/hz+1e-8),`${label}: every shoulder step respects the combat angular speed limit`);
    ok(rows.every(r=>Math.abs(wrap(r.sharedAngle-r.angle))<1e-8&&Math.abs(wrap(r.weaponAngle-r.angle))<1e-8),
      `${label}: shared body and weapon poses consume the same shoulder heading`);
    ok(shots.length>=2,`${label}: the actual firearm continues firing through the orbit`);
    ok(shots.every(({row,shot})=>Math.abs(wrap(shot.angle-row.weaponAngle))<1e-8&&Math.hypot(shot.x-row.muzzle.x,shot.y-row.muzzle.y)<1e-8),
      `${label}: emitted projectiles use the visible barrel heading and native muzzle`);
    summaries.push({type,stance,hz,radius,maxErrorDeg:maxError*180/Math.PI,shots:shots.length});
  }
}

scene();const reversing=orbit(30,60,4,true);
ok(reversing.filter(r=>r.at>2300).every(r=>r.error<Math.PI/12),
  'A tight clockwise orbit reversed in place is reacquired within 300ms');
ok(reversing.every(r=>r.step<=24/60+1e-8),
  'Reversing the target never teleports the fighting shoulders');

// Begin unaware or already investigating, then drive the real player with
// its movement stick. Footsteps must come from that achieved displacement,
// rather than injecting a synthetic acoustic event or assigning new positions.
const runningSummaries=[];
for(const initial of['PATROL','INVESTIGATE'])for(const radius of[30,45,60]){
  scene(radius);P(`stealthPerceptionReset();
    delete trackingGuard.stealthPerception;delete trackingGuard.redMesaStealth;
    trackingGuard._entityFacing=null;trackingGuard.state='PATROL';trackingGuard.aimAngle=Math.PI;
    trackingGuard.fireTimer=999999;trackingGuard.beatX=-100;trackingGuard.beatY=0;trackingGuard.beatTimer=999999;
    stealthEnterPhase(trackingGuard,${JSON.stringify(initial)});
    stealthPerceptionState(trackingGuard).goalX=-1000;stealthPerceptionState(trackingGuard).goalY=0;
    ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=false;
    meleeInputHeld=grenadeInputHeld=cannonInputHeld=false;setMeleeTool('NONE');
    var nativeRunningRows=[],nativeFirstAlert=null;
    for(let i=0;i<180;i++){
      deltaTime=1000/60;frameCount++;
      const bearing=Math.atan2(player.y-trackingGuard.y,player.x-trackingGuard.x),next=bearing+6/${radius};
      const tx=trackingGuard.x+${radius}*Math.cos(next),ty=trackingGuard.y+${radius}*Math.sin(next);
      const dx=(tx-player.x)/6,dy=(ty-player.y)/6,scale=Math.max(1,Math.hypot(dx,dy));
      leftStick.active=true;leftStick.dx=dx/scale;leftStick.dy=dy/scale;
      const oldX=player.x,oldY=player.y;player.updatePlayer();trackingGuard.updateEnemy();
      const state=stealthPerceptionState(trackingGuard);
      if(!nativeFirstAlert&&state.phase==='ALERT')nativeFirstAlert={frame:i,heardId:state.heardId,atMs:(i+1)*1000/60};
      nativeRunningRows.push({atMs:(i+1)*1000/60,phase:state.phase,heardId:state.heardId,
        moved:Math.hypot(player.x-oldX,player.y-oldY),
        error:Math.abs(Math.atan2(Math.sin(Math.atan2(player.y-trackingGuard.y,player.x-trackingGuard.x)-trackingGuard.aimAngle),
          Math.cos(Math.atan2(player.y-trackingGuard.y,player.x-trackingGuard.x)-trackingGuard.aimAngle)))});
    }`);
  const first=P('nativeFirstAlert'),rows=P('nativeRunningRows'),noise=P('_redMesaNoise.nextId');
  const label=`${initial} native running orbit r${radius}`;
  ok(rows.every(r=>r.moved>0&&r.moved<=6+1e-8),`${label}: the actual player collision/movement path drives every step`);
  ok(noise>5&&first&&first.heardId>0,`${label}: real running displacement emits and accepts the sound that confirms the player`);
  ok(first&&first.atMs<=250,`${label}: the first audible close pass enters combat without waiting in investigation`);
  ok(first&&rows.slice(first.frame).every(r=>r.phase==='ALERT'),`${label}: continued circling cannot restore the pre-alert state`);
  const maxError=Math.max(...rows.filter(r=>r.atMs>=1000).map(r=>r.error));
  ok(maxError<Math.PI/9,`${label}: combat tracks the full native running speed after hearing`);
  runningSummaries.push({initial,radius,firstAlertMs:first.atMs,maxErrorDeg:maxError*180/Math.PI});
}

// A large initial turn still has connecting poses; speed must not be bought
// by teleporting a facing angle or advancing it again in fire/finally/draw.
scene();P('trackingGuard.aimAngle=trackingGuard.moveAngle=Math.PI;trackingGuard.fireTimer=99999;');
P('frameCount++;trackingGuard.updateEnemy();');
const first=P('trackingGuard.aimAngle');
ok(Math.abs(wrap(first-Math.PI))>0&&Math.abs(wrap(first-Math.PI))<24/60,
  'An engaged human starting backwards first draws an intermediate shoulder pose');
const facingBefore=P('JSON.stringify(trackingGuard._entityFacing)');
P('finishEntityFacing(trackingGuard,1000/60);');
ok(P('JSON.stringify(trackingGuard._entityFacing)')===facingBefore,
  'A second finally consumer cannot soften or advance combat aim in the same frame');

// Execute the real figure painter. Its body rotation includes the final
// shoulder heading, and rendering must not tick its simulation a second time.
const nativeRotate=ctx.rotate,painted=[];
ctx.rotate=angle=>{painted.push(angle);return nativeRotate(angle);};
try{P('trackingGuard.show();');}finally{ctx.rotate=nativeRotate;}
ok(painted.some(a=>Math.abs(wrap(a-first))<1e-8),
  'The real armed figure painter rotates its body through the simulated shoulder pose');
ok(P('JSON.stringify(trackingGuard._entityFacing)')===facingBefore&&P('trackingGuard.aimAngle')===first,
  'Drawing the body and weapon leaves combat angular momentum unchanged');

// The prior urgent path returns from Character early, but still runs finally.
// Its single-consumer contract must survive the new combat tuning as well.
scene(2000);P(`trackingGuard.fireTimer=99999;trackingGuard.aimAngle=Math.PI;
  stealthPerceptionReset();stealthEnterPhase(trackingGuard,'CURIOUS');
  stealthPerceptionState(trackingGuard).goalX=300;stealthPerceptionState(trackingGuard).goalY=0;
  frameCount++;trackingGuard.updateEnemy();`);
const urgent=P('({angle:trackingGuard.aimAngle,shared:trackingGuard._entityFacing.angle,frame:trackingGuard._entityFacing.frame,now:frameCount})');
ok(urgent.angle===urgent.shared&&urgent.frame===urgent.now&&Math.abs(wrap(urgent.angle-Math.PI))>0,
  'Pre-alert curiosity consumes its own faster turn before Character finally');
P('finishEntityFacing(trackingGuard,1000/60);');
ok(P('trackingGuard.aimAngle')===urgent.angle,
  'Pre-alert urgent turns remain free of a second combat/finally filter');

P('isPaused=true;frameCount++;finishEntityFacing(trackingGuard,100);');
ok(P('trackingGuard.aimAngle')===urgent.angle,'Pause freezes the final visible shoulder heading');

console.log('Stealth combat tracking: '+checks+' native orbit, dropped-frame, reversal, projectile and pose checks passed.');
console.log(JSON.stringify({maxOrbitErrorDeg:Math.max(...summaries.map(r=>r.maxErrorDeg)),orbits:summaries.length,nativeRunning:runningSummaries}));

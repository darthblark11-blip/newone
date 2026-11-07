// Native directional locomotion and planted prone aiming. This renders the
// real actors and checks real barrel/core positions, rather than a mock rig.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.DIRECTIONAL_STANCE_OUT||'/tmp/newone-directional-stances';
const frames=path.join(out,'frames');fs.mkdirSync(frames,{recursive:true});
const fps=30,totalFrames=300;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1320,height:1020},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(1320,1020);pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('__ready');
  await page.evaluate(()=>{
   resetRunState();resetUndergroundRoute();currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
   isStoryMode=isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
   window.inNM0SecretOverlay=false;buildGhost=null;
   buildings=activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
   leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
   rightStick={active:false,dx:0,dy:-1,dist:0,base:{x:width-80,y:height-110}};
   setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
   jetpackUnlocked=true;window.milLvl=1;zoom=1;camX=camY=0;
   viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
   window.__directionalDraw={depth:0,minDepth:0,figures:0,frames:0};
   const oldPush=window.push,oldPop=window.pop;
   window.push=function(...args){__directionalDraw.depth++;return oldPush(...args);};
   window.pop=function(...args){__directionalDraw.depth--;__directionalDraw.minDepth=Math.min(__directionalDraw.minDepth,__directionalDraw.depth);return oldPop(...args);};
   window.__directionalBack=(title,subtitle)=>{
    background(37,50,57);stroke(57,73,80);strokeWeight(1);
    for(let x=0;x<width;x+=28)line(x,0,x,height);for(let y=0;y<height;y+=28)line(0,y,width,y);
    noStroke();textFont('sans-serif');textAlign(CENTER,CENTER);fill(226,236,231);textSize(21);text(title,width/2,28);
    fill(156,185,188);textSize(11);text(subtitle,width/2,54);
   };
   window.__directionalActor=(stance,weapon='ASSAULT_RIFLE',aim=-Math.PI/2)=>{
    const c=new Character(0,0,true);c.currentWeapon=WEAPONS[weapon];c.isArmed=true;c.ammo=30;
    c.aimAngle=c.moveAngle=aim;c.aimHold=14;c.hp=c.maxHp;c.gait=.5;
    c.reloadTimer=c.meleeTimer=c.dashTimer=c.muzzleFlash=c.weaponKick=c.fireTimer=0;c.name='';
    resetActorStance(c,stance);return c;
   };
   window.__directionalPaint=(c,x,y,magnify=3)=>{
    // The native aim hold retains the exact pose without drawing an aim
    // laser through every neighboring review card.
    player=c;rightStick.active=false;rightStick.dx=Math.cos(c.aimAngle);rightStick.dy=Math.sin(c.aimAngle);rightStick.dist=0;
    push();translate(x,y);scale(magnify);c.show();pop();__directionalDraw.figures++;
   };
   window.__directionalPrepareFeet=(c,direction,elapsed=0)=>{
    c.isMoving=true;c.moveAngle=c.aimAngle+direction;player=c;rightStick.active=true;
    frameCount+=Math.ceil(elapsed/100);
   };
   window.__directionalPrepareCrouch=(c,direction,elapsed=1000)=>{
    c.isMoving=true;c.moveAngle=c.aimAngle+direction;player=c;rightStick.active=true;
    if(typeof updateCrouchFacing==='function')for(let remaining=elapsed;remaining>0;){
     const dt=Math.min(100,remaining);remaining-=dt;frameCount++;updateCrouchFacing(c,dt);
    }
   };
   window.__directionalLabels=['N / BELLY','NW / RIGHT ELBOW','W / RIGHT SIDE','SW / ROLL BACK','S / BACK','SE / ROLL BACK','E / LEFT SIDE','NE / LEFT ELBOW'];
   window.__directionalDeltas=[0,-Math.PI/4,-Math.PI/2,-Math.PI*.75,-Math.PI,Math.PI*.75,Math.PI/2,Math.PI/4];
  });
  const alignment=await page.evaluate(()=>{
   const barrels=[],torches=[],cannons=[],nativeLong=window.drawLongGunSolid,nativeAction=window.drawLeftHandAction,nativeEllipse=window.ellipse;
   const point=(m,x,y)=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});
   const close=(a,b,label)=>{const error=Math.hypot(a.x-b.x,a.y-b.y);if(error>1e-4)throw Error(label+' differs by '+error);return error;};
   let barrel=null,core=null,insideCannon=false;
   window.drawLongGunSolid=function(w,P,...args){
    const m=drawingContext.getTransform(),p=P.point(w===WEAPONS.SHOTGUN?37:39,0,0);
    barrel={...point(m,p[0],p[1]),angle:Math.atan2(m.b,m.a)};return nativeLong(w,P,...args);
   };
   window.drawLeftHandAction=function(c,action,...args){insideCannon=action===2;try{return nativeAction(c,action,...args);}finally{insideCannon=false;}};
   window.ellipse=function(x,y,w,h,...args){
    if(insideCannon&&!core&&w>10&&Math.abs(w-h)<1e-8)core=point(drawingContext.getTransform(),x,y);
    return nativeEllipse(x,y,w,h,...args);
   };
   try{
    for(const stance of ['STAND','CROUCH','PRONE'])for(const weapon of ['ASSAULT_RIFLE','SHOTGUN'])for(const delta of __directionalDeltas){
     const base=-Math.PI/2,c=__directionalActor(stance,weapon,base);c.x=37;c.y=-22;
     c.aimAngle=base+delta;c.walkCycle=1.7;c.isMoving=stance!=='PRONE';
     if(stance==='STAND')__directionalPrepareFeet(c,Math.PI,800);
     if(stance==='PRONE'){c.stance.proneHeading=base;c.stance.proneAimBlend=1;}
     player=c;rightStick.active=true;rightStick.dx=Math.cos(c.aimAngle);rightStick.dy=Math.sin(c.aimAngle);bullets=[];frameCount++;
     c.fire(c.aimAngle);if(!bullets.length)throw Error('No real projectile for '+stance+' '+weapon);
     const shot={x:bullets[0].startX,y:bullets[0].startY};barrel=null;
     push();translate(207,119);rotate(.23);scale(2.75);const outer=drawingContext.getTransform();c.show();pop();
     if(!barrel)throw Error('The native gun solid was not drawn.');
     const error=close(barrel,point(outer,shot.x,shot.y),stance+' '+weapon+' '+delta);
     if(stance==='PRONE'&&Math.abs(Math.atan2(Math.sin(stanceFacingAngle(c)-base),Math.cos(stanceFacingAngle(c)-base)))>1e-8)throw Error('Prone feet turned with the shot.');
     barrels.push({stance,weapon,delta,error});
    }
    BIOME_ACTIVE=true;
    for(const delta of __directionalDeltas){
     const base=-Math.PI/2,c=__directionalActor('PRONE','ASSAULT_RIFLE',base);c.aimAngle=base+delta;
     c.stance.proneHeading=base;c.stance.proneAimBlend=1;player=c;rightStick.active=true;barrel=null;frameCount++;
     push();translate(101,81);rotate(.23);scale(2.75);c.show();pop();
     const torch=sceneEmitters().find(e=>e.aim!==undefined);if(!torch||!barrel)throw Error('Missing native rifle torch.');
     const angleError=Math.abs(Math.atan2(Math.sin(torch.aim-barrel.angle+.23),Math.cos(torch.aim-barrel.angle+.23)));
     if(angleError>1e-7)throw Error('Torch angle is detached from the rolled weapon: '+angleError);
     torches.push({delta,angleError});
    }
    BIOME_ACTIVE=false;chemistSuitUnlocked=true;
    for(const delta of __directionalDeltas){
     const base=-Math.PI/2,c=__directionalActor('PRONE','ASSAULT_RIFLE',base);c.x=31;c.y=-17;c.aimAngle=base+delta;
     c.stance.proneHeading=base;c.stance.proneAimBlend=1;c.cannonCharge=60;player=c;rightStick.active=true;core=null;frameCount++;
     push();translate(211,143);rotate(.23);scale(2.75);const outer=drawingContext.getTransform();c.show();pop();
     if(!core)throw Error('Missing cannon core in rolled pose.');
     const origin=leftActionMuzzle(c,c.aimAngle),error=close(core,point(outer,origin.x,origin.y),'Cannon '+delta);
     cannons.push({delta,error});
    }
   }finally{window.drawLongGunSolid=nativeLong;window.drawLeftHandAction=nativeAction;window.ellipse=nativeEllipse;BIOME_ACTIVE=chemistSuitUnlocked=false;bullets=[];}
   return {barrels,torches,cannons,...__directionalDraw};
  });
  assert.equal(alignment.barrels.length,48);assert.equal(alignment.torches.length,8);assert.equal(alignment.cannons.length,8);
  assert.equal(alignment.depth,0);assert.equal(alignment.minDepth,0);
  await page.setViewportSize({width:1320,height:1050});
  const standing=await page.evaluate(()=>{
   resizeCanvas(1320,1050);__directionalBack('AIMED WALK / JOG / RUN','Original standing leg animation and free hip heading in forward, backward and lateral travel.');
   const cases=[['FORWARD',0,800],['BACKWARD',Math.PI,800],['LEFT',-Math.PI/2,300],['DIAGONAL',-Math.PI/4,4300],['RIFLE / LEFT',-Math.PI/2,4300],['PISTOL / RIGHT',Math.PI/2,4300]],records=[];
   for(let row=0;row<3;row++)for(let col=0;col<cases.length;col++){
    const [label,delta,elapsed]=cases[col],c=__directionalActor('STAND',label.startsWith('PISTOL')?'PISTOL':'ASSAULT_RIFLE');c.gait=[.2,.5,1][row];
    __directionalPrepareFeet(c,delta,elapsed);c.walkCycle+=(.7+row*.25);frameCount++;
    const x=110+col*220,y=200+row*310;__directionalPaint(c,x,y,3.1);__directionalPaint(c,x+70,y+75,1);
    noStroke();fill(212,227,222);textSize(12);text(['WALK','JOG','RUN'][row]+' / '+label,x,y+123);
    records.push({gait:c.gait,label,legHeading:c.moveAngle,moveAngle:c.moveAngle});
   }
   return {records,...__directionalDraw};
  });
  assert.equal(standing.records.length,18);assert.equal(standing.depth,0);assert.equal(standing.minDepth,0);
  for(const card of standing.records)assert.equal(card.legHeading,card.moveAngle,'standing legs follow original movement heading');
  await page.locator('canvas').first().screenshot({path:path.join(out,'standing-footwork.png')});
  const comparison=await page.evaluate(()=>{
   __directionalBack('TROUSER CONTOURS / NATIVE AND AIMED','The same walking, jogging and running leg surfaces remain in forward and brief sideways movement.');
   const records=[],cases=[['NATIVE FORWARD',0,false],['AIMED FORWARD',0,true],['NATIVE SIDE',Math.PI/2,false],['AIMED SIDE',Math.PI/2,true]];
   for(let row=0;row<3;row++)for(let col=0;col<4;col++){
    const [label,direction,aimed]=cases[col],c=__directionalActor('STAND');c.gait=[.2,.5,1][row];c.walkCycle=1.1;
    if(aimed)__directionalPrepareFeet(c,direction,300);
    else {c.aimHold=0;c.isMoving=true;c.moveAngle=c.aimAngle+direction;rightStick.active=false;}
    const x=165+col*330,y=200+row*310;frameCount++;__directionalPaint(c,x,y,3.5);__directionalPaint(c,x+85,y+71,1);
    noStroke();fill(212,227,222);textSize(12);text(['WALK','JOG','RUN'][row]+' / '+label,x,y+123);
    records.push({label,gait:c.gait,aimed});
   }
   return {records,...__directionalDraw};
  });
  assert.equal(comparison.records.length,12);assert.equal(comparison.depth,0);assert.equal(comparison.minDepth,0);
  await page.locator('canvas').first().screenshot({path:path.join(out,'standing-native-comparison.png')});
  await page.setViewportSize({width:1320,height:1140});
  const crouch=await page.evaluate(()=>{
   resizeCanvas(1320,1140);__directionalBack('CROUCH / FOLDED STEP AND COUNTERROTATION','The recovering knee withdraws beneath the shirt; heel lift reveals the sole while the chest counters the stepping leg.');
   const records=[];let row=0;
   for(const weapon of ['PISTOL','ASSAULT_RIFLE'])for(const aimed of [false,true]){
    for(let col=0;col<6;col++){
     const c=__directionalActor('CROUCH',weapon,0);c.aimHold=aimed?14:0;c.isMoving=true;c.walkCycle=col*Math.PI/(3*.46);c.gait=.5;
     const x=110+col*220,y=185+row*260;player=c;rightStick.active=false;
     push();translate(x,y);scale(3.1);c.show();pop();push();translate(x+73,y+60);c.show();pop();__directionalDraw.figures+=2;
     noStroke();fill(212,227,222);textSize(11);text((weapon==='PISTOL'?'PISTOL':'RIFLE')+' / '+(aimed?'AIM':'CARRY')+' / '+col+'/6',x,y+105);
     const lower=typeof crouchLowerPose==='function'?crouchLowerPose(c):{phase:c.walkCycle};
     records.push({weapon,aimed,phase:lower.phase,step:crouchStepPose(c,lower.phase)});
    }row++;
   }
   return {records,...__directionalDraw};
  });
  assert.equal(crouch.records.length,24);assert.equal(crouch.depth,0);assert.equal(crouch.minDepth,0);
  await page.locator('canvas').first().screenshot({path:path.join(out,'crouch-steps.png')});
  await page.setViewportSize({width:1440,height:760});
  const crouchDirections=await page.evaluate(()=>{
   resizeCanvas(1440,760);__directionalBack('CROUCH / HIPS FOLLOW TRAVEL, WEAPON STAYS NORTH','Forward and side steps turn the pelvis beneath the shoulders; rear-diagonal travel becomes backward stepping.');
   const records=[];
   for(let row=0;row<2;row++)for(let col=0;col<8;col++){
    const weapon=row?'ASSAULT_RIFLE':'PISTOL',c=__directionalActor('CROUCH',weapon);c.gait=.5;c.walkCycle=1.5;
    __directionalPrepareCrouch(c,__directionalDeltas[col]);
    const x=90+col*180,y=210+row*330;frameCount++;__directionalPaint(c,x,y,3);__directionalPaint(c,x+62,y+91,1);
    noStroke();fill(212,227,222);textSize(10);text('TRAVEL '+['N','NW','W','SW','S','SE','E','NE'][col],x,y+143);
    const body=stanceBodyPose(c);records.push({weapon,moveAngle:c.moveAngle,aimAngle:c.aimAngle,hipYaw:body.hipYaw,joints:body.joints});
   }
   return {records,...__directionalDraw};
  });
  assert.equal(crouchDirections.records.length,16);assert.equal(crouchDirections.depth,0);assert.equal(crouchDirections.minDepth,0);
  await page.locator('canvas').first().screenshot({path:path.join(out,'crouch-travel-directions.png')});
  await page.setViewportSize({width:1440,height:760});
  const prone=await page.evaluate(()=>{
   resizeCanvas(1440,760);__directionalBack('PRONE / EIGHT AIM DIRECTIONS','Body and feet are planted north. The upper body posts, rolls to either side, then onto its back as aim passes behind.');
   const records=[];
   for(let row=0;row<2;row++)for(let col=0;col<8;col++){
    const base=-Math.PI/2,weapon=row?'ASSAULT_RIFLE':'PISTOL',c=__directionalActor('PRONE',weapon,base);
    c.stance.proneHeading=base;c.stance.proneAimBlend=1;c.aimAngle=base+__directionalDeltas[col];c.isMoving=false;
    const x=90+col*180,y=210+row*330;frameCount++;__directionalPaint(c,x,y,3);__directionalPaint(c,x+62,y+91,1);
    noStroke();fill(212,227,222);textSize(10);text(__directionalLabels[col],x,y+143);
    const heading=stanceFacingAngle(c);if(Math.abs(heading-base)>1e-8)throw Error('Prone anchored heading changed in card '+col);
    records.push({weapon,delta:__directionalDeltas[col],heading,roll:typeof proneRollPose==='function'?proneRollPose(c):null});
   }
   return {records,...__directionalDraw};
  });
  assert.equal(prone.records.length,16);assert.equal(prone.depth,0);assert.equal(prone.minDepth,0);
  await page.locator('canvas').first().screenshot({path:path.join(out,'prone-eight-directions.png')});
  await page.setViewportSize({width:1600,height:1030});
  const rollAngles=await page.evaluate(()=>{
   resizeCanvas(1600,1030);__directionalBack('PRONE / CONTINUOUS PACK ROLL AND REAR PISTOL REACH','Each successive view adds 22.5 degrees of aim. The backpack remains a solid shell around the moving torso.');
   const records=[];
   for(let row=0;row<4;row++)for(let col=0;col<8;col++){
    const base=-Math.PI/2,weapon=row<2?'PISTOL':'ASSAULT_RIFLE',index=(row%2)*8+col,delta=-index*Math.PI/8;
    const c=__directionalActor('PRONE',weapon,base);c.aimAngle=base+delta;c.stance.proneHeading=base;c.stance.proneAimBlend=1;c.isMoving=false;
    const x=100+col*200,y=180+row*240;frameCount++;__directionalPaint(c,x,y,2.8);__directionalPaint(c,x+67,y+61,1);
    noStroke();fill(212,227,222);textSize(10);text(weapon+' / '+Math.round(-delta*180/Math.PI)+'°',x,y+104);
    const b=stanceBodyPose(c),hand=stancePointInBody(c,weapon==='PISTOL'?16:stanceLongGunPose(c).rear[0],weapon==='PISTOL'?8:stanceLongGunPose(c).rear[1]);
    records.push({weapon,delta,roll:b.roll,hand,shoulder:b.joints[1].shoulder});
   }
   return {records,...__directionalDraw};
  });
  assert.equal(rollAngles.records.length,32);assert.equal(rollAngles.depth,0);assert.equal(rollAngles.minDepth,0);
  await page.locator('canvas').first().screenshot({path:path.join(out,'prone-roll-angles.png')});
  await page.setViewportSize({width:1200,height:1000});
  await page.evaluate(()=>{
   resizeCanvas(1200,1000);window.__directionalMovie=[];
   for(const [index,delta] of [0,Math.PI,-Math.PI/2,Math.PI/2].entries()){const c=__directionalActor('STAND',index===3?'PISTOL':'ASSAULT_RIFLE');c.isMoving=true;c.moveAngle=c.aimAngle+delta;__directionalMovie.push(c);}
   for(const weapon of ['PISTOL','ASSAULT_RIFLE']){const c=__directionalActor('CROUCH',weapon);c.isMoving=true;__directionalMovie.push(c);}
   for(const weapon of ['PISTOL','ASSAULT_RIFLE']){const c=__directionalActor('PRONE',weapon);c.stance.proneHeading=-Math.PI/2;c.stance.proneAimBlend=1;__directionalMovie.push(c);}
  });
  let motion;
  for(let f=0;f<totalFrames;f++){
   motion=await page.evaluate(({f,fps,totalFrames})=>{
    frameCount++;deltaTime=1000/fps;__directionalBack('DIRECTIONAL STANCES / NATIVE MOTION','Original standing legs follow travel; crouch hips turn beneath a fixed aim; prone backpack follows the full roll.');
    const throttle=f<55?.2:f<110?.5:1;
    for(let i=0;i<__directionalMovie.length;i++){
     const c=__directionalMovie[i];player=c;rightStick.active=true;c.aimHold=14;c.muzzleFlash=Math.max(0,c.muzzleFlash-1);c.weaponKick=Math.max(0,c.weaponKick-1);
     if(i<4){
      c.gait=throttle;c.walkCycle+=gaitPose(c.gait).cadence*2;
      const x=150+i*300,y=220;__directionalPaint(c,x,y,3.1);__directionalPaint(c,x+76,y+65,1);
      noStroke();fill(211,227,220);textSize(12);text(['FORWARD','BACKWARD','LEFT STRAFE','RIGHT STRAFE'][i]+' / '+(throttle<.3?'WALK':throttle<.6?'JOG':'RUN'),x,y+122);
     }else if(i<6){
      c.gait=.55;c.walkCycle+=gaitPose(c.gait).cadence*2;
      c.moveAngle=c.aimAngle+(f<100?0:f<200?Math.PI/2:Math.PI*.85);
      if(typeof updateCrouchFacing==='function')updateCrouchFacing(c,deltaTime);
      const x=300+(i-4)*600,y=510;__directionalPaint(c,x,y,3.7);__directionalPaint(c,x+132,y+58,1);
      noStroke();fill(211,227,220);textSize(12);text((i===4?'PISTOL':'RIFLE')+' / CROUCH '+(f<100?'FORWARD':f<200?'SIDE STEP':'BACKSTEP'),x,y+100);
     }else{
      c.isMoving=false;c.aimAngle=-Math.PI/2-f*Math.PI*2/(totalFrames-1);c.stance.proneHeading=-Math.PI/2;c.stance.proneAimBlend=1;
      if(f%15===0){bullets=[];c.fire(c.aimAngle);}
      const x=300+(i-6)*600,y=815;__directionalPaint(c,x,y,3.7);__directionalPaint(c,x+132,y+63,1);
      if(Math.abs(stanceFacingAngle(c)+Math.PI/2)>1e-8)throw Error('Movie prone heading changed.');
      noStroke();fill(211,227,220);textSize(12);text((i===6?'PISTOL':'RIFLE')+' / PLANTED AIM '+Math.round(f*360/(totalFrames-1))+'°',x,y+118);
     }
    }
    __directionalDraw.frames++;return {...__directionalDraw,fault:window.FRAME_FAULT||null};
   },{f,fps,totalFrames});
   assert.equal(motion.depth,0,'balanced frame '+f);assert.equal(motion.minDepth,0);assert.equal(motion.fault,null);
   await page.locator('canvas').first().screenshot({path:path.join(frames,String(f).padStart(4,'0')+'.png')});
  }
  assert.deepEqual(errors,[]);
  const encode=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(frames,'%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',path.join(out,'directional-stances.mp4')],{encoding:'utf8'});
  if(encode.error)throw encode.error;assert.equal(encode.status,0,encode.stderr);
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({alignment,standing,comparison,crouch,crouchDirections,prone,rollAngles,motion,errors,fps,totalFrames},null,2));
  console.log('64 native barrel/torch/cannon checks, 118 directional pose cards and '+totalFrames+' motion frames passed. Previews: '+out);
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});

// Native jointed stance review. Run with VIS_DEPS/VIS_CHROME as for
// visual-combat-stances.js. Outputs stay outside the checkout by default.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.STANCE_MOTION_OUT||'/tmp/newone-stance-motion';
const frames=path.join(out,'frames');fs.mkdirSync(frames,{recursive:true});
const fps=30,frameTotal=180;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1120,height:1680},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};setup=function(){createCanvas(1120,1680);pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('__ready');
  await page.evaluate(()=>{
   resetRunState();currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
   isPaused=isDead=isWin=killcamMode=false;isStoryMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
   window.inNM0SecretOverlay=false;buildGhost=null;
   buildings=activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
   leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
   rightStick={active:false,dx:1,dy:0,dist:0,base:{x:width-80,y:height-110}};
   setMeleeTool('NONE');jetpackUnlocked=false;chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
   window.milLvl=1;zoom=1;camX=camY=0;viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
   window.__stancePainter={depth:0,minDepth:0,frames:0,figures:0};
   const savedPush=window.push,savedPop=window.pop;
   window.push=function(...args){__stancePainter.depth++;return savedPush(...args);};
   window.pop=function(...args){__stancePainter.depth--;__stancePainter.minDepth=Math.min(__stancePainter.minDepth,__stancePainter.depth);return savedPop(...args);};
   window.__stanceBack=(title,subtitle)=>{
    background(40,52,58);stroke(58,73,79);strokeWeight(1);
    for(let x=0;x<width;x+=28)line(x,0,x,height);for(let y=0;y<height;y+=28)line(0,y,width,y);
    noStroke();fill(225,235,230);textFont('sans-serif');textAlign(CENTER,CENTER);textSize(20);text(title,width/2,27);
    fill(151,182,184);textSize(11);text(subtitle,width/2,52);
   };
   window.__stanceActor=(stance,key,aimed,heading=0)=>{
    const c=new Character(0,0,true);c.currentWeapon=WEAPONS[key];c.isArmed=true;c.ammo=30;
    c.aimHold=aimed?14:0;c.aimAngle=c.moveAngle=heading;c.reloadTimer=c.meleeTimer=c.dashTimer=0;
    c.muzzleFlash=c.weaponKick=0;c.hp=c.maxHp;c.gait=1;c.name='';resetActorStance(c,stance);return c;
   };
   window.__stancePaint=(c,x,y,magnify,aimed)=>{
    player=c;rightStick.active=aimed;rightStick.dx=Math.cos(c.aimAngle);rightStick.dy=Math.sin(c.aimAngle);
    push();translate(x,y);scale(magnify);c.show();pop();__stancePainter.figures++;
   };
  });
  const nativeMuzzles=await page.evaluate(()=>{
   const records=[],torches=[],cannons=[],nativeLongGun=window.drawLongGunSolid;
   const nativeAction=window.drawLeftHandAction,nativeEllipse=window.ellipse;
   const point=(matrix,x,y)=>({x:matrix.a*x+matrix.c*y+matrix.e,y:matrix.b*x+matrix.d*y+matrix.f});
   // Canvas composes float transforms internally; 0.0001 screen pixel is
   // below raster precision while still exposing a detached physical muzzle.
   const close=(a,b,label)=>{const error=Math.hypot(a.x-b.x,a.y-b.y);if(error>1e-4)throw Error(label+' differs by '+error);return error;};
   let barrel=null,outer=null,cannonCore=null,insideCannon=false;
   window.drawLongGunSolid=function(w,P,...args){
    const matrix=drawingContext.getTransform(),p=P.point(w===WEAPONS.SHOTGUN?37:39,0,0);
    barrel={...point(matrix,p[0],p[1]),angle:Math.atan2(matrix.b,matrix.a)};
    return nativeLongGun(w,P,...args);
   };
   window.drawLeftHandAction=function(c,action,...args){
    insideCannon=action===2;
    try{return nativeAction(c,action,...args);}finally{insideCannon=false;}
   };
   window.ellipse=function(x,y,w,h,...args){
    if(insideCannon&&!cannonCore&&w>10&&Math.abs(w-h)<1e-8)cannonCore=point(drawingContext.getTransform(),x,y);
    return nativeEllipse(x,y,w,h,...args);
   };
   try{
    for(const stance of ['CROUCH','PRONE'])for(const weapon of ['ASSAULT_RIFLE','SHOTGUN'])
     for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(let phase=0;phase<6;phase++){
      const c=__stanceActor(stance,weapon,false,heading);c.x=37;c.y=-22;c.isMoving=true;c.walkCycle=phase*Math.PI/3;
      player=c;rightStick.active=false;bullets=[];frameCount++;c.fire(heading);
      if(!bullets.length||c.aimHold<=0)throw Error('A shot from neutral must raise the weapon and create a round.');
      const bullet={x:bullets[0].startX,y:bullets[0].startY};barrel=null;
      push();translate(217,130);rotate(.23);scale(2.75);outer=drawingContext.getTransform();c.show();pop();
      if(!barrel)throw Error('The native long-gun solid was not drawn.');
      const error=close(barrel,point(outer,bullet.x,bullet.y),stance+' '+weapon+' heading '+heading+' phase '+phase);
      records.push({stance,weapon,heading,phase,error});
    }
    // Read the actual weapon frame from Canvas, so a neutral port angle or
    // crawl rotation cannot leave the flashlight facing its old standing axis.
    BIOME_ACTIVE=true;
    for(const stance of ['CROUCH','PRONE'])for(const aimed of [false,true])
     for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const phase of [0,2]){
      const c=__stanceActor(stance,'ASSAULT_RIFLE',aimed,heading);c.isMoving=true;c.walkCycle=phase*Math.PI/3;
      player=c;rightStick.active=aimed;barrel=null;frameCount++;
      push();translate(99,77);rotate(.23);scale(2.75);c.show();pop();
      const torch=sceneEmitters().find(e=>e.aim!==undefined);
      if(!torch||!barrel)throw Error('The rifle must expose its native barrel and flashlight.');
      const angleError=Math.abs(Math.atan2(Math.sin(torch.aim-(barrel.angle-.23)),Math.cos(torch.aim-(barrel.angle-.23))));
      if(angleError>1e-7)throw Error('The flashlight diverges from the native weapon frame by '+angleError);
      torches.push({stance,aimed,heading,phase,angleError});
    }
    BIOME_ACTIVE=false;chemistSuitUnlocked=true;
    for(const stance of ['CROUCH','PRONE'])for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
     const c=__stanceActor(stance,'ASSAULT_RIFLE',false,heading);c.x=31;c.y=-17;c.isMoving=true;c.walkCycle=1.7;c.cannonCharge=60;
     player=c;rightStick.active=false;cannonCore=null;frameCount++;
     push();translate(201,149);rotate(.23);scale(2.75);outer=drawingContext.getTransform();c.show();pop();
     if(!cannonCore)throw Error('The native charged cannon core was not drawn.');
     const origin=leftActionMuzzle(c,heading),error=close(cannonCore,point(outer,origin.x,origin.y),stance+' cannon heading '+heading);
     cannons.push({stance,heading,error});
    }
   }finally{
    window.drawLongGunSolid=nativeLongGun;window.drawLeftHandAction=nativeAction;window.ellipse=nativeEllipse;
    BIOME_ACTIVE=chemistSuitUnlocked=false;bullets=[];rightStick.active=false;
   }
   return {records,torches,cannons,...__stancePainter};
  });
  assert.equal(nativeMuzzles.records.length,96);assert.equal(nativeMuzzles.torches.length,32);assert.equal(nativeMuzzles.cannons.length,8);
  assert.equal(nativeMuzzles.depth,0);assert.equal(nativeMuzzles.minDepth,0);
  const contacts=await page.evaluate(()=>{
   __stanceBack('JOINTED STANCES / IDLE AND AIM','Native c.show() at 3× and 1×. Columns turn right, up, left and down.');
   const headings=[0,-Math.PI/2,Math.PI,Math.PI/2],records=[];
   let row=0;
   for(const stance of ['CROUCH','PRONE'])for(const weapon of ['PISTOL','ASSAULT_RIFLE'])for(const aimed of [false,true]){
    for(let col=0;col<4;col++){
     const c=__stanceActor(stance,weapon,aimed,headings[col]),cx=140+col*280,cy=155+row*198;
     c.isMoving=false;frameCount++;__stancePaint(c,cx,cy,3,aimed);__stancePaint(c,cx+95,cy+44,1,aimed);
     noStroke();fill(194,218,213);textSize(10);text(stance+' / '+(weapon==='PISTOL'?'PISTOL':'RIFLE')+' / '+(aimed?'AIM':'NEUTRAL'),cx,cy+83);
     records.push({stance,weapon,aimed,heading:headings[col]});
    }row++;
   }
   return {records,...__stancePainter};
  });
  assert.equal(contacts.records.length,32);assert.equal(contacts.depth,0);assert.equal(contacts.minDepth,0);
  await page.locator('canvas').first().screenshot({path:path.join(out,'idle-aim-headings.png')});
  const gait=await page.evaluate(()=>{
   resizeCanvas(1120,1540);__stanceBack('JOINTED STANCES / MOVEMENT PHASES','Six samples per cycle; alternating joint contact and weapon carry, enlarged with native-size reference.');
   const records=[];let row=0;
   for(const stance of ['CROUCH','PRONE'])for(const weapon of ['PISTOL','ASSAULT_RIFLE'])for(const aimed of [false,true]){
    for(let col=0;col<6;col++){
     const phase=col*Math.PI/3,c=__stanceActor(stance,weapon,aimed,0),cx=94+col*186,cy=143+row*176;
     c.isMoving=true;c.walkCycle=phase;frameCount++;__stancePaint(c,cx,cy,2.6,aimed);__stancePaint(c,cx+60,cy+47,1,aimed);
     noStroke();fill(194,218,213);textSize(9);text(stance+' / '+(weapon==='PISTOL'?'PISTOL':'RIFLE')+' / '+(aimed?'AIM':'CARRY'),cx,cy+66);
     fill(145,174,179);text('PHASE '+col+'/6',cx,cy+80);records.push({stance,weapon,aimed,phase});
    }row++;
   }
   return {records,...__stancePainter};
  });
  assert.equal(gait.records.length,48);assert.equal(gait.depth,0);assert.equal(gait.minDepth,0);
  await page.locator('canvas').first().screenshot({path:path.join(out,'gait-phases.png')});
  await page.setViewportSize({width:960,height:720});
  await page.evaluate(()=>{
   resizeCanvas(960,720);window.__stanceMotionActors=[];
   for(const weapon of ['PISTOL','ASSAULT_RIFLE'])for(const aimed of [false,true])
    __stanceMotionActors.push({actor:__stanceActor('STAND',weapon,aimed,0),weapon,aimed});
  });
  let lastMotion;
  for(let f=0;f<frameTotal;f++){
   lastMotion=await page.evaluate(({f,fps})=>{
    frameCount++;deltaTime=1000/fps;
    __stanceBack('CROUCH / PRONE / CRAWL','Neutral carry on the left; aiming on the right. Native-scale reference beside each enlarged figure.');
    const requested=f===9?'CROUCH':f===70?'PRONE':f===155?'STAND':null;
    for(let i=0;i<__stanceMotionActors.length;i++){
     const {actor:c,weapon,aimed}=__stanceMotionActors[i],x=230+(i%2)*480,y=217+Math.floor(i/2)*290;
     player=c;rightStick.active=aimed;c.aimHold=aimed?14:0;
     if(requested)assertStanceRequest(requestActorStance(c,requested),requested);
     updateActorStance(c,deltaTime);c.isMoving=f>=21&&f<151;c.walkCycle=f*Math.PI*2/42;
     __stancePaint(c,x,y,3.5,aimed);__stancePaint(c,x+164,y+30,1,aimed);
     noStroke();fill(209,226,219);textSize(13);text((weapon==='PISTOL'?'PISTOL':'RIFLE')+' / '+(aimed?'AIM':'NEUTRAL'),x,y-100);
     fill(153,186,188);textSize(11);text(actorStance(c)+(c.isMoving?' / MOVING':' / STILL'),x,y+100);
    }
    fill(162,194,196);textSize(11);text((f/fps).toFixed(2)+' s / joint transitions and opposing limb phases',width/2,height-27);
    __stancePainter.frames++;return {...__stancePainter,fault:window.FRAME_FAULT||null};
    function assertStanceRequest(ok,name){if(!ok)throw Error('The native '+name+' transition was rejected at frame '+f);}
   },{f,fps});
   assert.equal(lastMotion.depth,0,'balanced drawing at motion frame '+f);assert.equal(lastMotion.minDepth,0);
   assert.equal(lastMotion.fault,null);await page.locator('canvas').first().screenshot({path:path.join(frames,String(f).padStart(4,'0')+'.png')});
  }
  assert.deepEqual(errors,[]);
  const encoded=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(frames,'%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',path.join(out,'stance-motion.mp4')],{encoding:'utf8'});
  if(encoded.error)throw encoded.error;assert.equal(encoded.status,0,encoded.stderr);
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({nativeMuzzles,contacts,gait,motion:lastMotion,errors,fps,frameTotal},null,2));
  console.log('136 native barrel/torch/cannon checks, 80 pose cards and '+frameTotal+' animation frames pass painter/browser checks. Previews: '+out);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});

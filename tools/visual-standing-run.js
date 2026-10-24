// Native standing gait and aim-turn review. Pose sheets compare the same
// player garment, while turn sequences advance the real input/update path.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.STANDING_RUN_OUT||'/tmp/newone-standing-run';
const frames=path.join(out,'frames');fs.mkdirSync(frames,{recursive:true});
const fps=30,totalFrames=360;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1080},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(1600,1080);pixelDensity(1);noLoop();window.__ready=true;};</script>');
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
   jetpackUnlocked=true;window.milLvl=1;window.isDesktop=false;zoom=1;camX=camY=0;
   viewLeft=viewTop=-100000;viewRight=viewBottom=100000;
   window.__standingDraw={depth:0,minDepth:0,figures:0,frames:0};
   const oldPush=window.push,oldPop=window.pop;
   window.push=function(...args){__standingDraw.depth++;return oldPush(...args);};
   window.pop=function(...args){__standingDraw.depth--;__standingDraw.minDepth=Math.min(__standingDraw.minDepth,__standingDraw.depth);return oldPop(...args);};
   window.__standingBack=(title,subtitle)=>{
    background(37,50,57);stroke(57,73,80);strokeWeight(1);
    for(let x=0;x<width;x+=28)line(x,0,x,height);for(let y=0;y<height;y+=28)line(0,y,width,y);
    noStroke();textFont('sans-serif');textAlign(CENTER,CENTER);fill(226,236,231);textSize(21);text(title,width/2,28);
    fill(156,185,188);textSize(11);text(subtitle,width/2,54);
   };
   window.__standingActor=(weapon='ASSAULT_RIFLE',angle=-Math.PI/2)=>{
    const c=new Character(0,0,true);c.currentWeapon=WEAPONS[weapon];c.isArmed=true;c.ammo=10000;
    c.aimAngle=c.moveAngle=angle;c.aimHold=0;c.hp=c.maxHp;c.gait=0;c.walkCycle=0;
    c.reloadTimer=c.meleeTimer=c.dashTimer=c.muzzleFlash=c.weaponKick=c.fireTimer=0;c.name='';
    resetActorStance(c,'STAND');return c;
   };
   window.__standingInput=(c,move,throttle,aim,fire=false)=>{
    player=c;leftStick.active=throttle>0;leftStick.dx=throttle?Math.cos(move)*throttle:0;leftStick.dy=throttle?Math.sin(move)*throttle:0;
    rightStick.active=aim!==null;rightStick.dx=aim===null?0:Math.cos(aim);rightStick.dy=aim===null?0:Math.sin(aim);rightStick.dist=aim===null?0:fire?1:.4;
    rightStick.gamepadInput=false;
   };
   window.__standingStep=(c,move,throttle,aim,frames=1,fire=false)=>{
    for(let i=0;i<frames;i++){frameCount++;deltaTime=1000/60;__standingInput(c,move,throttle,aim,fire);c.updatePlayer();}
   };
   window.__standingPaint=(c,x,y,magnify=3,laser=false)=>{
    player=c;const active=rightStick.active;rightStick.active=laser;
    push();translate(x,y);scale(magnify);translate(-c.x,-c.y);c.show();pop();rightStick.active=active;__standingDraw.figures++;
   };
   window.__standingLabel=(textValue,x,y)=>{noStroke();fill(212,227,222);textSize(11);text(textValue,x,y);};
   window.__standingRecord=c=>({aim:c.aimAngle,move:c.moveAngle,cycle:c.walkCycle,gait:c.gait,footwork:{...playerFootworkPose(c)},
    legs:[standingFootworkLeg(c,0),standingFootworkLeg(c,1)]});
  });
  const alignment=await page.evaluate(()=>{
   const records=[],nativeLong=window.drawLongGunSolid,nativeLine=window.line;
   const point=(m,x,y)=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});
   const near=(a,b,label)=>{const error=Math.hypot(a.x-b.x,a.y-b.y);if(error>1e-4)throw Error(label+' differs by '+error);return error;};
   let barrel=null,laser=null;
   window.drawLongGunSolid=function(w,P,...args){const m=drawingContext.getTransform(),p=P.point(w===WEAPONS.SHOTGUN?37:39,0,0);barrel={...point(m,p[0],p[1]),angle:Math.atan2(m.b,m.a)};return nativeLong(w,P,...args);};
   window.line=function(x,y,x2,y2,...args){if(x2===800&&y===y2&&x>0&&x<100){const m=drawingContext.getTransform();laser={start:point(m,x,y),end:point(m,x2,y2)};}return nativeLine(x,y,x2,y2,...args);};
   try{
    for(const weapon of ['ASSAULT_RIFLE','SHOTGUN'])for(const moving of [false,true]){
     const c=__standingActor(weapon);__standingStep(c,-Math.PI/2,moving?1:0,-Math.PI/2,40);
     for(let i=0;i<72;i++){
      const target=i<24?Math.PI/2:i<48?-Math.PI*.98:Math.PI*.98;
      __standingStep(c,-Math.PI/2,moving?1:0,target);c.fireTimer=0;c.reloadTimer=0;c.ammo=10000;bullets=[];c.fire(c.aimAngle);
      if(!bullets.length)throw Error('Missing native shot during turn');
      const shot=bullets[0];barrel=laser=null;rightStick.active=true;BIOME_ACTIVE=true;_emitFrame=-1;
      push();translate(311-c.x*2.3,227-c.y*2.3);scale(2.3);const outer=drawingContext.getTransform();c.show();pop();
      if(!barrel||!laser)throw Error('Missing barrel or laser during '+weapon+' turn');
      const shotError=near(barrel,point(outer,shot.startX,shot.startY),'Barrel/projectile');
      const laserError=near(barrel,laser.start,'Barrel/laser');
      const emitters=sceneEmitters(),torch=emitters.find(e=>e.aim!==undefined),flash=emitters.find(e=>e.r===MUZZLE_FLASH_R);
      if(!flash)throw Error('Missing native muzzle flash emitter');
      const flashError=near(barrel,point(outer,flash.x,flash.y),'Barrel/flash');
      let torchError=null,torchAngleError=null;
      if(WEAPON_TORCH[weaponKey(c.currentWeapon)]){
       if(!torch)throw Error('Missing native weapon torch');
       torchError=near(barrel,point(outer,torch.x,torch.y),'Barrel/torch');
       torchAngleError=Math.abs(Math.atan2(Math.sin(torch.aim-c.aimAngle),Math.cos(torch.aim-c.aimAngle)));
       if(torchAngleError>1e-7)throw Error('Torch direction differs from smooth gun aim');
      }
      records.push({weapon,moving,frame:i,aim:c.aimAngle,target,shotError,laserError,flashError,torchError,torchAngleError});
      BIOME_ACTIVE=false;
     }
    }
   }finally{window.drawLongGunSolid=nativeLong;window.line=nativeLine;BIOME_ACTIVE=false;bullets=[];}
   return {records,...__standingDraw};
  });
  assert.equal(alignment.records.length,288);assert.equal(alignment.depth,0);assert.equal(alignment.minDepth,0);
  const visibility=await page.evaluate(()=>{
   const records=[],cases=[['FORWARD CARRY',0,false],['AIMED FORWARD',0,true],['BACKWARD',Math.PI,true],['BACK LEFT',-Math.PI*.75,true],['BACK RIGHT',Math.PI*.75,true]];
   for(const weapon of ['PISTOL','ASSAULT_RIFLE'])for(const throttle of [.2,.5,1])for(const [label,delta,aimed]of cases){
    const c=__standingActor(weapon),base=-Math.PI/2;__standingStep(c,base+delta,throttle,aimed?base:null,100);
    const interval=Math.max(1,Math.round(Math.PI*2/(gaitPose(throttle).cadence*.60*12))),samples=[];
    for(let phase=0;phase<12;phase++){
     if(phase)__standingStep(c,base+delta,throttle,aimed?base:null,interval);
     background(35,44,49);__standingPaint(c,320,240,3.2);
     const pixels=drawingContext.getImageData(240,160,160,160).data,col=c.pantsCol.levels||c.pantsCol;
     const redGap=Math.max(20,(col[2]-col[0])*.20),greenGap=Math.max(18,(col[2]-col[1])*.20);
     let blue=0;
     for(let i=0;i<pixels.length;i+=4)if(pixels[i+2]>65&&pixels[i+2]-pixels[i]>redGap&&pixels[i+2]-pixels[i+1]>greenGap)blue++;
     samples.push(blue);
    }
    records.push({weapon,throttle,label,interval,samples,min:Math.min(...samples),mean:samples.reduce((a,b)=>a+b,0)/samples.length});
   }
   return {records,...__standingDraw};
  });
  assert.equal(visibility.records.length,30);assert.equal(visibility.depth,0);assert.equal(visibility.minDepth,0);
  fs.writeFileSync(path.join(out,'visibility.json'),JSON.stringify(visibility,null,2));
  for(const r of visibility.records){
   assert(r.samples.filter(p=>p>=12).length>=10,r.weapon+' '+r.throttle+' '+r.label+' hides jeans through most of the step: '+r.samples.join(','));
   assert(r.mean>=60,r.weapon+' '+r.throttle+' '+r.label+' hides almost all trousers beneath the torso: '+r.samples.join(','));
   assert(r.throttle<1||r.min>=12,r.weapon+' '+r.label+' loses the running trouser silhouette: '+r.samples.join(','));
   for(let i=0;i<r.samples.length;i++)assert(r.samples[i]>=12||r.samples[(i+1)%12]>=12||r.samples[(i+2)%12]>=12,
    r.weapon+' '+r.throttle+' '+r.label+' keeps jeans hidden for an extended contact/recovery interval');
  }
  const gaitSheets=[];
  for(const weapon of ['PISTOL','ASSAULT_RIFLE']){
   const sheet=await page.evaluate(weapon=>{
    resizeCanvas(1600,1080);__standingBack('STANDING JEANS / '+weapon,'One garment across forward carry, aimed forward, backward and rear-diagonal travel. Each card uses the real movement update.');
    const cases=[['FORWARD CARRY',0,false],['AIMED FORWARD',0,true],['BACKWARD',Math.PI,true],['BACK LEFT',-Math.PI*.75,true],['BACK RIGHT',Math.PI*.75,true]],records=[];
    for(let row=0;row<3;row++)for(let col=0;col<cases.length;col++){
     const [label,delta,aimed]=cases[col],c=__standingActor(weapon),base=-Math.PI/2,throttle=[.2,.5,1][row];
     __standingStep(c,base+delta,throttle,aimed?base:null,100);
     const x=160+col*320,y=210+row*320;__standingPaint(c,x,y,3.5);__standingPaint(c,x+95,y+68,1);
     __standingLabel(['WALK','JOG','RUN'][row]+' / '+label,x,y+132);records.push({weapon,label,throttle,...__standingRecord(c)});
    }
    return {records,...__standingDraw};
   },weapon);
   assert.equal(sheet.records.length,15);assert.equal(sheet.depth,0);assert.equal(sheet.minDepth,0);gaitSheets.push(sheet);
   await page.locator('canvas').first().screenshot({path:path.join(out,'jeans-'+weapon.toLowerCase()+'.png')});
  }
  const phases=await page.evaluate(()=>{
   resizeCanvas(1600,1080);__standingBack('RUN / PLANT, RECOVERY AND BACKSTEP','Stable pelvis, knee flex and heel-leading backward recovery, shown at consecutive real update intervals.');
   const cases=[['FORWARD',0,null],['BACKWARD',Math.PI,-Math.PI/2],['BACK LEFT',-Math.PI*.75,-Math.PI/2]],records=[];
   for(let row=0;row<cases.length;row++){
    const [label,delta,aim]=cases[row],c=__standingActor('ASSAULT_RIFLE');__standingStep(c,-Math.PI/2+delta,1,aim,100);
    for(let col=0;col<8;col++){
     if(col)__standingStep(c,-Math.PI/2+delta,1,aim,5);
     const x=100+col*200,y=210+row*320;__standingPaint(c,x,y,3.3);__standingPaint(c,x+68,y+70,1);
     __standingLabel(label+' / +'+col*5+' FRAMES',x,y+130);records.push({label,frame:col*5,...__standingRecord(c)});
    }
   }
   return {records,...__standingDraw};
  });
  assert.equal(phases.records.length,24);assert.equal(phases.depth,0);assert.equal(phases.minDepth,0);
  await page.locator('canvas').first().screenshot({path:path.join(out,'run-step-phases.png')});
  const turns=await page.evaluate(()=>{
   resizeCanvas(1600,1080);__standingBack('AIM TURN / INPUT TO PLANTED PIVOT','The sight, gun and torso turn together. Hips follow through their own support motion; no pose teleport is used.');
   const records=[],sample=[0,1,3,6,10,16,28,44];
   for(let row=0;row<3;row++){
    const move=row===0?0:row===1?-Math.PI/2:Math.PI*.98,throttle=row===0?0:1,start=row===2?Math.PI*.98:-Math.PI/2,target=row===2?-Math.PI*.98:Math.PI/2;
    const c=__standingActor('ASSAULT_RIFLE',start);__standingStep(c,move,throttle,start,60);let last=0;
    for(let col=0;col<sample.length;col++){
     if(sample[col]>last)__standingStep(c,move,throttle,target,sample[col]-last);last=sample[col];
     const x=100+col*200,y=210+row*320;__standingPaint(c,x,y,3.2);__standingPaint(c,x+68,y+70,1);
     __standingLabel(['STILL 180°','MOVING 180°','±180° SEAM'][row]+' / '+Math.round(sample[col]*1000/60)+' MS',x,y+130);
     records.push({row,frame:sample[col],target,...__standingRecord(c)});
    }
   }
   return {records,...__standingDraw};
  });
  assert.equal(turns.records.length,24);assert.equal(turns.depth,0);assert.equal(turns.minDepth,0);
  for(const row of [0,1]){
   const samples=turns.records.filter(r=>r.row===row),first=samples.find(r=>r.frame===1),last=samples.at(-1);
   assert(Math.abs(Math.atan2(Math.sin(first.aim-first.target),Math.cos(first.aim-first.target)))>.3,'first aim frame must remain an intermediate pose');
   assert(Math.abs(Math.atan2(Math.sin(last.aim-last.target),Math.cos(last.aim-last.target)))<.01,'turn must settle promptly');
  }
  await page.locator('canvas').first().screenshot({path:path.join(out,'aim-turn-progress.png')});
  await page.setViewportSize({width:1280,height:980});
  await page.evaluate(()=>{
   resizeCanvas(1280,980);window.__standingMovie=[__standingActor('ASSAULT_RIFLE'),__standingActor('ASSAULT_RIFLE'),__standingActor('PISTOL'),__standingActor('ASSAULT_RIFLE')];
   for(let i=0;i<4;i++)__standingStep(__standingMovie[i],-Math.PI/2+(i===1?Math.PI:i===2?-Math.PI*.75:0),.2,i===0?null:-Math.PI/2,60);
  });
  let motion;
  for(let f=0;f<totalFrames;f++){
   motion=await page.evaluate(({f,fps})=>{
    const throttle=f<60?.2:f<120?.5:1;
    for(let step=0;step<2;step++){
     frameCount++;deltaTime=1000/60;
     for(let i=0;i<__standingMovie.length;i++){
      const c=__standingMovie[i],base=-Math.PI/2;
      const target=f<135?base:f<180?Math.PI/2:f<225?Math.PI*.98:f<270?-Math.PI*.98:f<315?0:base;
      const move=i===0?base:i===1?base+Math.PI:i===2?base-Math.PI*.75:f<200?base:Math.PI*.25;
      __standingInput(c,move,throttle,i===0?null:i===3?target:base,false);c.updatePlayer();
     }
    }
    __standingBack('STANDING RUN / KINETIC CHAIN','Regular forward, heel-leading backsteps, rear diagonal and abrupt input turns. Native simulation at 60 Hz; review video at 30 fps.');
    for(let i=0;i<4;i++){
     const c=__standingMovie[i],x=320+(i%2)*640,y=245+Math.floor(i/2)*440;
     __standingPaint(c,x,y,4.7);__standingPaint(c,x+142,y+75,1);
     __standingLabel(['FORWARD CARRY','BACKWARD AIM','BACK DIAGONAL / PISTOL','MOVING AIM CHANGES'][i]+' / '+(throttle<.3?'WALK':throttle<.6?'JOG':'RUN'),x,y+170);
    }
    __standingDraw.frames++;return {...__standingDraw,fault:window.FRAME_FAULT||null,poses:__standingMovie.map(__standingRecord)};
   },{f,fps});
   assert.equal(motion.depth,0,'balanced motion frame '+f);assert.equal(motion.minDepth,0);assert.equal(motion.fault,null);
   await page.locator('canvas').first().screenshot({path:path.join(frames,String(f).padStart(4,'0')+'.png')});
  }
  assert.deepEqual(errors,[]);
  const encode=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(frames,'%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',path.join(out,'standing-run.mp4')],{encoding:'utf8'});
  if(encode.error)throw encode.error;assert.equal(encode.status,0,encode.stderr);
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({alignment,visibility,gaitSheets,phases,turns,motion,errors,fps,totalFrames},null,2));
  console.log('288 native barrel/projectile/laser/flash/torch turn checks, 360 visible-jeans samples, 78 standing pose cards and '+totalFrames+' motion frames passed. Previews: '+out);
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});

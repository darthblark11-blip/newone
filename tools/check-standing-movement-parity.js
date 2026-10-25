// Native p5 checks: original front/side art, unchanged hip/aim history, and rear heel poses.
// STANDING_BASELINE=/tmp/game-before.js VIS_DEPS=/tmp/newone-hip-deps node tools/check-standing-movement-parity.js
// Set STANDING_REVIEW_OUT to also write standing/crouch reference sheets and a real-input clip.
// STANDING_FLUID_REVIEW=1 adds a before/after gait movie; STANDING_FLUID_ONLY=1 renders only that movie.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const deps=process.env.VIS_DEPS||'/tmp/newone-hip-deps';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const p5=fs.readFileSync(process.env.STANDING_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const baseline=process.env.STANDING_BASELINE;
if(!baseline)throw Error('Set STANDING_BASELINE to the original movement source');
const candidate=process.env.GAME_JS||path.join(__dirname,'../game.js');
const out=process.env.STANDING_REVIEW_OUT;
const fixture=`Object.defineProperty(window,'localStorage',{value:{getItem(){return null},setItem(){},removeItem(){}}});
let __seed=447;Math.random=()=>{__seed=(Math.imul(__seed,1664525)+1013904223)>>>0;return __seed/4294967296;};`;
const setup=`preload=function(){};draw=function(){};windowResized=function(){};
setup=function(){createCanvas(1024,1024);pixelDensity(1);noLoop();window.__ready=true;};
window.__movementReset=()=>{
 resetRunState();resetUndergroundRoute();currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 window.inNM0SecretOverlay=false;buildGhost=null;buildings=activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
 leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
 rightStick={active:false,dx:0,dy:-1,dist:0,base:{x:width-80,y:height-110}};
 setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
 jetpackUnlocked=true;window.milLvl=1;window.isDesktop=false;zoom=1;camX=camY=0;
 viewLeft=viewTop=-100000;viewRight=viewBottom=100000;
 window.__paintStats={depth:0,minDepth:0};
 const oldPush=window.push,oldPop=window.pop;
 window.push=function(...a){__paintStats.depth++;return oldPush(...a);};
 window.pop=function(...a){__paintStats.depth--;__paintStats.minDepth=Math.min(__paintStats.minDepth,__paintStats.depth);return oldPop(...a);};
};
window.__movementActor=(weapon,aim)=>{
 randomSeed(771);noiseSeed(1337);__seed=447;
 const c=new Character(0,0,true);c.currentWeapon=WEAPONS[weapon];c.isArmed=true;c.ammo=10000;
 c.aimAngle=c.moveAngle=aim;c.aimHold=0;c.hp=c.maxHp;c.gait=0;c.walkCycle=0;
 c.reloadTimer=c.meleeTimer=c.dashTimer=c.muzzleFlash=c.weaponKick=c.fireTimer=0;c.name='';
 resetActorStance(c,'STAND');return c;
};
window.__movementInput=(c,move,throttle,aim)=>{
 player=c;leftStick.active=throttle>0;leftStick.dx=Math.cos(move)*throttle;leftStick.dy=Math.sin(move)*throttle;
 rightStick.active=aim!==null;rightStick.dx=aim===null?0:Math.cos(aim);rightStick.dy=aim===null?0:Math.sin(aim);
 rightStick.dist=aim===null?0:.4;rightStick.gamepadInput=false;
};
window.__movementStep=(c,move,throttle,aim,frames=1)=>{
 for(let i=0;i<frames;i++){frameCount++;deltaTime=1000/60;__movementInput(c,move,throttle,aim);c.updatePlayer();}
};
window.__movementPaint=(c,x,y,magnify=1.7)=>{
 player=c;const active=rightStick.active;rightStick.active=false;
 push();translate(x,y);scale(magnify);translate(-c.x,-c.y);c.show();pop();rightStick.active=active;
};
window.__movementBytes=()=>{
 const px=drawingContext.getImageData(0,0,width,height).data;let raw='';
 for(let i=0;i<px.length;i+=32768)raw+=String.fromCharCode.apply(null,px.subarray(i,i+32768));return btoa(raw);
};
window.__movementAtlas=(cases,biome,withoutRear=false)=>{
 const nativeRear=window.standingRearPose;if(withoutRear)window.standingRearPose=()=>null;
 BIOME_ACTIVE=biome;GLRig.on=GLRig.ok=false;GLRig.failure=GLRIG_SHED_MSG;frameCount=43;
 worldTimeMs=13/24*DAY_MS;updateSunVector();background(46,56,61);const states=[];
 for(let i=0;i<cases.length;i++){
  const row=cases[i],c=__movementActor(row.weapon,row.aim);player=c;c.moveAngle=row.move;c.gait=row.gait;c.walkCycle=row.phase;c.isMoving=true;
  c.aimHold=row.aimed?14:0;if(row.stance)resetActorStance(c,row.stance);if(row.state)Object.assign(c,row.state);rightStick.active=row.aimed;rightStick.dx=Math.cos(row.aim);rightStick.dy=Math.sin(row.aim);rightStick.dist=.4;
  const x=64+(i%8)*128,y=64+Math.floor(i/8)*128;
  push();drawingContext.beginPath();drawingContext.rect(x-64,y-64,128,128);drawingContext.clip();__movementPaint(c,x,y);pop();
  states.push({aim:c.aimAngle,move:c.moveAngle,gait:c.gait,cycle:c.walkCycle,armed:c.isArmed,hold:c.aimHold});
 }
 if(withoutRear)window.standingRearPose=nativeRear;
 return {pixels:__movementBytes(),states,stats:__paintStats};
};`;
function cases(){
 const result=[];
 for(const weapon of ['PISTOL','ASSAULT_RIFLE'])for(const gait of [.2,.5,1])for(let phase=0;phase<8;phase++)for(let a=0;a<4;a++)for(const aimed of [false,true])for(const delta of [-Math.PI/2,-Math.PI/4,0,Math.PI/4,Math.PI/2]){
  const aim=-Math.PI/2+a*Math.PI/2;
  result.push({weapon,gait,phase:phase*Math.PI/4,aim,move:aim+delta,aimed});
 }
 return result;
}
async function load(browser,file){
 const page=await browser.newPage({viewport:{width:1024,height:1024},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>'+fixture+'</script><script>'+p5+'</script><script>'+fs.readFileSync(file,'utf8')+'</script><script>'+setup+'</script>');
 await page.waitForFunction('__ready');await page.evaluate(()=>__movementReset());return {page,errors};
}
function hashPixels(result){const hash=crypto.createHash('sha256').update(Buffer.from(result.pixels,'base64')).digest('hex');delete result.pixels;return hash;}
async function locomotionHistory(page,stance='CROUCH'){
 return page.evaluate(stance=>{
  const records=[],snapshots=[];
  for(const weapon of ['PISTOL','ASSAULT_RIFLE'])for(let heading=0;heading<4;heading++){
   const base=-Math.PI/2+heading*Math.PI/2,c=__movementActor(weapon,base);resetActorStance(c,stance);
   for(let f=0;f<720;f++){
    let move=base,aim=base,throttle=.7;
    if(f<120)move=base+f*Math.PI/60;
    else if(f<240)move=base+Math.PI;
    else if(f<300)throttle=0;
    else if(f<420){throttle=0;aim=base+Math.PI;}
    else if(f<480){throttle=0;aim=null;}
    else if(f<600){move=base+Math.PI/2;aim=null;}
    else{move=base+(f-600)*Math.PI/60;aim=base+(f-600)*.01;}
    __movementStep(c,move,throttle,aim);
    records.push({heading,weapon,frame:f,aim:c.aimAngle,move:c.moveAngle,cycle:c.walkCycle,gait:c.gait,x:c.x,y:c.y,pose:stance==='CROUCH'?crouchLowerPose(c):standingLowerPose(c),motion:{...(stance==='CROUCH'?c._crouchMotion:c._standingMotion)},aimFilter:c._standingAim?{...c._standingAim}:null});
    if(f%30===0||f===719)snapshots.push({weapon,aim:c.aimAngle,move:c.moveAngle,gait:c.gait,phase:c.walkCycle,aimed:aim!==null,stance,state:{
     x:c.x,y:c.y,aimAngle:c.aimAngle,moveAngle:c.moveAngle,isMoving:c.isMoving,walkCycle:c.walkCycle,gait:c.gait,aimHold:c.aimHold,[stance==='CROUCH'?'_crouchMotion':'_standingMotion']:{...(stance==='CROUCH'?c._crouchMotion:c._standingMotion)}
    }});
   }
  }
  return {records,snapshots};
 },stance);
}
async function review(page){
 fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(out,'frames'),{recursive:true});
 await page.setViewportSize({width:1600,height:1080});
 await page.evaluate(()=>{
  resizeCanvas(1600,1080);BIOME_ACTIVE=false;
  window.__wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  window.__referencePair=(weapon='ASSAULT_RIFLE',aim=-Math.PI/2)=>{
   const stand=__movementActor(weapon,aim),crouch=__movementActor(weapon,aim);resetActorStance(crouch,'CROUCH');return {stand,crouch};
  };
  window.__referenceStep=(pair,move,throttle,aim)=>{
   const c=pair.stand,r=pair.crouch;frameCount++;deltaTime=1000/60;__movementInput(c,move,throttle,aim);c.updatePlayer();
   // Compare the same torso heading: standing retains its native aim filter.
   for(const key of ['x','y','aimAngle','moveAngle','isMoving','walkCycle','gait','aimHold','isArmed','muzzleFlash','reloadTimer'])r[key]=c[key];
   updateCrouchFacing(r,deltaTime);
   const a=standingLowerPose(c),b=crouchLowerPose(r);
   if(!a)throw Error('Missing standing lower pose after actual input');
   if(Math.abs(__wrap(a.angle-b.angle))>1e-10||Math.abs(a.backward-b.backward)>1e-10||Math.abs(a.motion-b.motion)>1e-10)throw Error('Standing hips differ from actual crouch reference');
   if(Math.abs(__wrap(a.angle-c.aimAngle))>Math.PI*.54+1e-10)throw Error('Hips exceed crouch torso-relative limit');
   return {aim:c.aimAngle,move:c.moveAngle,cycle:c.walkCycle,gait:c.gait,moving:c.isMoving,standing:a,crouch:b};
  };
  const nativeLimb=window.figureCelLimb,nativeOval=window.figureCelOval;
  window.__lowerPaintRecords=[];window.__recordLower=null;
  const matchesPants=col=>{col=col&&(col.levels||col);const p=player.pantsCol.levels;return col&&p.slice(0,3).every((v,i)=>Math.abs(v-col[i])<1e-8);};
  window.figureCelLimb=function(...a){
   if(__recordLower==='STAND'&&matchesPants(a[10])){const m=drawingContext.getTransform();__lowerPaintRecords.push({kind:'leg',angle:Math.atan2(m.b,m.a)});}
   return nativeLimb(...a);
  };
  window.figureCelOval=function(...a){
   if(__recordLower==='CROUCH'&&matchesPants(a[5])&&Math.abs(a[3]-11)<1e-8&&Math.abs(a[4]-player.bodyH*.61)<1e-8){const m=drawingContext.getTransform();__lowerPaintRecords.push({kind:'hip',angle:Math.atan2(m.b,m.a)});}
   return nativeOval(...a);
  };
  window.__referencePaint=(c,x,y,scaleValue,stance)=>{
   __lowerPaintRecords=[];__recordLower=stance;__movementPaint(c,x,y,scaleValue);__recordLower=null;
   const records=__lowerPaintRecords.slice(),expected=stance==='STAND'?standingLowerPose(c).angle:stanceFacingAngle(c)+stanceBodyPose(c).hipYaw;
   if((stance==='STAND'?records.length<2:records.length!==1)||records.some(r=>Math.abs(__wrap(r.angle-expected))>1e-8))throw Error('Native '+stance+' painter did not consume its lower-body heading');
   return records;
  };
  window.__reviewBackground=(title,sub)=>{background(37,50,57);noStroke();textFont('sans-serif');textAlign(CENTER,CENTER);fill(226,236,231);textSize(21);text(title,width/2,28);fill(156,185,188);textSize(11);text(sub,width/2,54);};
  window.__reviewLabel=(s,x,y)=>{noStroke();fill(212,227,222);textSize(11);text(s,x,y);};
 });
 const sweep=await page.evaluate(()=>{
  const records=[];
  for(let facing=0;facing<4;facing++)for(const throttle of [.2,.5,1]){
   const aim=-Math.PI/2+facing*Math.PI/2,pair=__referencePair('ASSAULT_RIFLE',aim);
   for(let f=0;f<1200;f++){
    let move=aim,look=aim,mag=throttle,label='CIRCLE';
    if(f<360)move=aim+f*Math.PI/180;
    else if(f<480){move=aim+Math.PI;label='BACKWARD';}
    else if(f<660){move=aim+Math.PI;mag=0;label='STOP AIMING OPPOSITE';}
    else if(f<840){move=aim+Math.PI;mag=0;look=aim+Math.PI;label='TURN WHILE IDLE';}
    else if(f<960){mag=0;look=null;label='RELEASE AIM';}
    else if(f<1080){move=aim+Math.PI/2;look=null;label='RESUME WITHOUT AIM';}
    else{move=aim+Math.PI/2;look=aim-Math.PI/2;label='REAR DIAGONAL';}
    const record=__referenceStep(pair,move,mag,look);
    if(f%20===0){background(37,50,57);record.renderedStand=__referencePaint(pair.stand,350,350,3,'STAND');record.renderedCrouch=__referencePaint(pair.crouch,850,350,3,'CROUCH');}
    records.push({facing,throttle,frame:f,label,...record});
   }
  }
  return records;
 });
 fs.writeFileSync(path.join(out,'reference-sweep.json'),JSON.stringify(sweep,null,2));
 await page.evaluate(()=>{
  __reviewBackground('STANDING HIPS / EXISTING CROUCH REFERENCE','Both actors use the same resolved torso heading and input history. Standing keeps its own leg art and stride clock.');
  const labels=['N','NE','E','SE','S','SW','W','NW'];
  for(let col=0;col<8;col++){
   const aim=-Math.PI/2,move=aim+col*Math.PI/4,pair=__referencePair();
   for(let f=0;f<120;f++)__referenceStep(pair,move,1,aim);
   for(const [row,stance,c]of [[0,'STAND',pair.stand],[1,'CROUCH',pair.crouch]]){
    __referencePaint(c,100+col*200,270+row*460,3.8,stance);const p=stance==='STAND'?standingLowerPose(c):crouchLowerPose(c);
    __reviewLabel(stance+' / '+labels[col]+' / HIP '+Math.round(__wrap(p.angle-aim)*180/Math.PI)+'°',100+col*200,460+row*460);
   }
  }
 });
 await page.locator('canvas').first().screenshot({path:path.join(out,'standing-crouch-directions.png')});
 await page.evaluate(()=>{
  __reviewBackground('STOPPING WHILE AIMING OPPOSITE / IDLE TURN','Standing keeps the same planted-heading and idle-pivot rules as crouch. No fallback to the last movement heading.');
  const samples=[['BACK RUN',-1],['STOP 1',1],['STOP 6',6],['STOP 18',18],['STOP 60',60],['STOP 180',180],['TURN 12',192],['TURN 60',240]];
  for(let col=0;col<8;col++){
   const pair=__referencePair(),aim=-Math.PI/2;for(let f=0;f<120;f++)__referenceStep(pair,aim+Math.PI,1,aim);
   const [label,count]=samples[col];for(let f=0;f<count;f++)__referenceStep(pair,aim+Math.PI,0,f>=180?aim+Math.PI:aim);
   for(const [row,stance,c]of [[0,'STAND',pair.stand],[1,'CROUCH',pair.crouch]]){
    __referencePaint(c,100+col*200,270+row*460,3.8,stance);const p=stance==='STAND'?standingLowerPose(c):crouchLowerPose(c);
    __reviewLabel(stance+' / '+label+' / HIP '+Math.round(__wrap(p.angle-c.aimAngle)*180/Math.PI)+'°',100+col*200,460+row*460);
   }
  }
 });
 await page.locator('canvas').first().screenshot({path:path.join(out,'standing-crouch-stop.png')});
 await page.setViewportSize({width:1280,height:960});
 await page.evaluate(()=>{resizeCanvas(1280,960);window.__moviePair=__referencePair();});
 const total=Number(process.env.STANDING_REVIEW_FRAMES||300),motion=[];
 for(let f=0;f<total;f++){
  const result=await page.evaluate(({f,total})=>{
   const ratio=f/total,base=-Math.PI/2;let move=base,look=base,throttle=1,label;
   if(ratio<.2){move=base+ratio/.2*Math.PI*2;label='CIRCLE MOVEMENT / AIM NORTH';}
   else if(ratio<.4){move=base+Math.PI;label='BACKWARD RUN / AIM NORTH';}
   else if(ratio<.6){move=base+Math.PI;throttle=0;label='STOP / KEEP AIMING OPPOSITE';}
   else if(ratio<.8){move=base+Math.PI;throttle=0;look=base+Math.PI;label='TURN AIM WHILE IDLE';}
   else{move=base+Math.PI;throttle=0;look=null;label='RELEASE BOTH STICKS';}
   let record;for(let step=0;step<2;step++)record=__referenceStep(__moviePair,move,throttle,look);
   __reviewBackground('STANDING / CROUCH HIP REFERENCE',label+' — identical hip policy; original standing leg proportions.');
   for(let i=0;i<2;i++){
    const c=i?__moviePair.crouch:__moviePair.stand,x=320+i*640,y=460,scaleValue=5.2,stance=i?'CROUCH':'STAND';
    push();drawingContext.beginPath();drawingContext.rect(x-300,y-300,600,550);drawingContext.clip();stroke(57,73,80);strokeWeight(1);
    const gx=((c.x*scaleValue)%72+72)%72,gy=((c.y*scaleValue)%72+72)%72;
    for(let xx=x-330-gx;xx<x+330;xx+=72)line(xx,y-310,xx,y+270);
    for(let yy=y-310-gy;yy<y+270;yy+=72)line(x-330,yy,x+330,yy);
    record[i?'renderedCrouch':'renderedStand']=__referencePaint(c,x,y,scaleValue,stance);pop();
    const p=i?crouchLowerPose(c):standingLowerPose(c);
    __reviewLabel(stance+' / HIP '+Math.round(__wrap(p.angle-c.aimAngle)*180/Math.PI)+'° / '+(c.isMoving?'MOVING':'IDLE'),x,y+285);
   }
   return {...record,frame:f,stats:__paintStats};
  },{f,total});
  assert.equal(result.stats.depth,0,'balanced native motion frame '+f);assert.equal(result.stats.minDepth,0);motion.push(result);
  await page.locator('canvas').first().screenshot({path:path.join(out,'frames',String(f).padStart(4,'0')+'.png')});
 }
 const encode=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(out,'frames','%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',path.join(out,'standing-crouch-reference.mp4')],{encoding:'utf8'});
 if(encode.error)throw encode.error;assert.equal(encode.status,0,encode.stderr);
 fs.writeFileSync(path.join(out,'motion.json'),JSON.stringify(motion,null,2));return {frames:total,actualInputSamples:sweep.length,renderedSweepPoses:sweep.filter(r=>r.renderedStand).length*2};
}
// Measure visible heel pixels after the torso has painted. A pose helper can
// return a heel that is completely hidden, so compare native frames with only
// the heel delegate omitted across the vulnerable rear-side angles.
async function heelVisibility(page){
 const rows=await page.evaluate(()=>{
  resizeCanvas(400,400);const rows=[],angles=[];
  for(let a=91;a<=112;a++)angles.push(a,360-a);
  angles.push(120,135,150,165,180,195,210,225,240);
  const native=window.drawStandingRearHeel;
  const paint=(c,hidden)=>{
   window.drawStandingRearHeel=hidden?()=>{}:native;
   background(37,50,57);__movementPaint(c,200,190,6);
   return drawingContext.getImageData(50,75,300,300).data;
  };
  try{
   for(const weapon of ['PISTOL','ASSAULT_RIFLE'])for(const throttle of [.2,.5,1])for(const degrees of angles){
    const aim=-Math.PI/2,c=__movementActor(weapon,aim);
    __movementStep(c,aim+degrees*Math.PI/180,throttle,aim,180);
    const pixels=[];
    for(let phase=0;phase<4;phase++){
     c.walkCycle=phase*Math.PI/2;
     const a=paint(c,false),b=paint(c,true);let count=0;
     for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])count++;
     pixels.push(count);
    }
    rows.push({weapon,throttle,degrees,pixels,max:Math.max(...pixels)});
   }
  }finally{window.drawStandingRearHeel=native;}
  return rows;
 });
 for(const r of rows)assert(r.max>0,'heel hidden for whole stride: '+JSON.stringify(r));
 if(out)fs.writeFileSync(path.join(out,'heel-visibility.json'),JSON.stringify(rows,null,2));
 console.log('PASS '+rows.length+' rear angle/speed/weapon groups expose visible native heel pixels.');
 return {groups:rows.length,frames:rows.length*4,minimumVisiblePixels:Math.min(...rows.map(r=>r.max))};
}
async function heelReview(page){
 const heelOut=path.join(out,'heels');fs.mkdirSync(path.join(heelOut,'frames'),{recursive:true});
 await page.setViewportSize({width:1728,height:1140});
 await page.evaluate(()=>resizeCanvas(1728,1140));
 const sheets=[];
 for(const weapon of ['PISTOL','ASSAULT_RIFLE']){
  const records=await page.evaluate(weapon=>{
   __reviewBackground('REAR HALF / KNEES FORWARD / HEELS VISIBLE — '+weapon,'Aim stays north. Actual movement updates cover the full rear half, including 91° through 112° where the hip policy remains lateral.');
   const degrees=[91,100,112,135,180,225,248,260,269],records=[];
   for(let row=0;row<3;row++)for(let col=0;col<degrees.length;col++){
    const aim=-Math.PI/2,move=aim+degrees[col]*Math.PI/180,pair=__referencePair(weapon,aim),throttle=[.2,.5,1][row];
    for(let f=0;f<180;f++)__referenceStep(pair,move,throttle,aim);
    const c=pair.stand;c.walkCycle=Math.PI*.75;if(c._standingMotion)c._standingMotion.phase=c.walkCycle;
    const lower=standingLowerPose(c),pose=standingRearPose(c,lower);
    if(!pose)throw Error('Missing rear heel art at '+degrees[col]+'°');
    const R=figureRig(c.bodyW,c.bodyH),legs=[0,1].map(i=>standingRearLeg(c,pose,R,i));
    __referencePaint(c,96+col*192,220+row*360,3.5,'STAND');__referencePaint(c,153+col*192,295+row*360,1,'STAND');
    __reviewLabel(['WALK','JOG','RUN'][row]+' / '+degrees[col]+'° / HIP '+Math.round(__wrap(lower.angle-aim)*180/Math.PI)+'°',96+col*192,370+row*360);
    records.push({weapon,degrees:degrees[col],throttle,lower,pose,legs});
   }
   return records;
  },weapon);
  sheets.push(...records);
  await page.locator('canvas').first().screenshot({path:path.join(heelOut,'rear-half-'+weapon.toLowerCase()+'.png')});
 }
 await page.setViewportSize({width:1600,height:1080});
 await page.evaluate(()=>{
  resizeCanvas(1600,1080);__reviewBackground('BACKWARD GAIT / KNEE AND HEEL PHASES','North-facing rifle. The thigh points forward while the heel recedes and lifts behind the body. Same hips and torso as before.');
  for(let row=0;row<3;row++)for(let col=0;col<8;col++){
   const aim=-Math.PI/2,move=aim+[Math.PI,Math.PI*.75,-Math.PI*.75][row],pair=__referencePair();
   for(let f=0;f<180;f++)__referenceStep(pair,move,1,aim);
   const c=pair.stand;c.walkCycle=col*Math.PI/4;if(c._standingMotion)c._standingMotion.phase=c.walkCycle;
   __referencePaint(c,100+col*200,220+row*320,3.8,'STAND');__referencePaint(c,162+col*200,295+row*320,1,'STAND');
   __reviewLabel(['BACKWARD','BACK RIGHT','BACK LEFT'][row]+' / '+col+'π/4',100+col*200,365+row*320);
  }
 });
 await page.locator('canvas').first().screenshot({path:path.join(heelOut,'knee-heel-phases.png')});
 await page.setViewportSize({width:1440,height:850});
 await page.evaluate(()=>{
  resizeCanvas(1440,850);window.__heelPairs=Array.from({length:3},(_,i)=>__referencePair(i===1?'PISTOL':'ASSAULT_RIFLE'));
  for(let i=0;i<3;i++)for(let f=0;f<120;f++)__referenceStep(__heelPairs[i],-Math.PI/2+[Math.PI,Math.PI*.55,Math.PI*.75][i],.2,-Math.PI/2);
 });
 const total=Number(process.env.STANDING_HEEL_FRAMES||240),motion=[];
 for(let f=0;f<total;f++){
  const record=await page.evaluate(({f,total})=>{
   const throttle=f<total/3?.2:f<total*2/3?.5:1,aim=-Math.PI/2,deltas=[Math.PI,Math.PI*.55,Math.PI*.75],poses=[];
   for(let step=0;step<2;step++)for(let i=0;i<3;i++)poses[i]=__referenceStep(__heelPairs[i],aim+deltas[i],throttle,aim);
   __reviewBackground('BACKWARD WALK / JOG / RUN — KNEES AND HEELS','Shared hip and torso handling is unchanged. The rear leg articulation and heel surfaces sell backward steps.');
   for(let i=0;i<3;i++){
    const c=__heelPairs[i].stand,x=240+i*480,y=400,scaleValue=5;
    push();drawingContext.beginPath();drawingContext.rect(x-230,y-250,460,540);drawingContext.clip();stroke(57,73,80);strokeWeight(1);
    const gx=((c.x*scaleValue)%72+72)%72,gy=((c.y*scaleValue)%72+72)%72;
    for(let xx=x-250-gx;xx<x+250;xx+=72)line(xx,y-260,xx,y+300);
    for(let yy=y-260-gy;yy<y+300;yy+=72)line(x-250,yy,x+250,yy);
    poses[i].rendered=__referencePaint(c,x,y,scaleValue,'STAND');pop();
    __reviewLabel(['BACKWARD 180°','REAR EDGE 99°','BACK RIGHT 135°'][i]+' / '+(throttle<.3?'WALK':throttle<.6?'JOG':'RUN'),x,y+310);
   }
   return {frame:f,poses,stats:__paintStats};
  },{f,total});
  assert.equal(record.stats.depth,0);assert.equal(record.stats.minDepth,0);motion.push(record);
  await page.locator('canvas').first().screenshot({path:path.join(heelOut,'frames',String(f).padStart(4,'0')+'.png')});
 }
 const encode=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(heelOut,'frames','%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',path.join(heelOut,'backward-heels.mp4')],{encoding:'utf8'});
 if(encode.error)throw encode.error;assert.equal(encode.status,0,encode.stderr);
 fs.writeFileSync(path.join(heelOut,'review.json'),JSON.stringify({sheets,motion},null,2));
 return {frames:total,directionCards:sheets.length,phaseCards:24,out:heelOut};
}
async function fluidReview(beforePage,afterPage){
 const fluidOut=path.join(out,'fluid');
 for(const label of ['before','after'])fs.mkdirSync(path.join(fluidOut,label),{recursive:true});
 for(const [page,label]of [[beforePage,'BEFORE'],[afterPage,'AFTER']]){
  await page.setViewportSize({width:960,height:1080});
  await page.evaluate(label=>{
   resizeCanvas(960,1080);BIOME_ACTIVE=false;frameCount=10000;deltaTime=1000/60;
   window.__fluidLabel=label;window.__fluidActors=[.2,.5,1].map(()=>__movementActor('ASSAULT_RIFLE',-Math.PI/2));
   for(let i=0;i<3;i++)__movementStep(__fluidActors[i],Math.PI/2,[.2,.5,1][i],-Math.PI/2,120);
   window.__fluidFrame=(f,total)=>{
    const t=f/total,aim=-Math.PI/2;let move=aim+Math.PI,look=aim,weight=1,stage='BACKWARD STRIDE';
    if(t<.25){}
    else if(t<5/12){move=aim+Math.PI*(1-(t-.25)*6);stage='BACKWARD → FORWARD';}
    else if(t<7/12){move=aim+Math.PI*((t-5/12)*6);stage='FORWARD → BACKWARD';}
    else if(t<2/3){weight=1-(t-7/12)*12;stage='SETTLE TO STOP';}
    else if(t<.75){weight=0;stage='STOP / KEEP AIM';}
    else if(t<5/6){weight=(t-.75)*12;stage='RESTART BACKWARD';}
    else if(t<11/12){look=null;stage='RELEASE AIM / KEEP MOVING';}
    else stage='RE-AIM / KEEP MOVING';
    for(let step=0;step<2;step++)for(let i=0;i<3;i++){
     frameCount++;deltaTime=1000/60;__movementInput(__fluidActors[i],move,[.2,.5,1][i]*weight,look);__fluidActors[i].updatePlayer();
    }
    background(37,50,57);noStroke();textFont('sans-serif');textAlign(CENTER,CENTER);fill(226,236,231);textSize(23);text(__fluidLabel+' / '+stage,width/2,30);
    const records=[];
    for(let i=0;i<3;i++){
     const c=__fluidActors[i],x=480,y=260+i*340,scaleValue=3.8;
     push();drawingContext.beginPath();drawingContext.rect(30,y-195,900,325);drawingContext.clip();stroke(57,73,80);strokeWeight(1);
     const gx=((c.x*scaleValue)%56+56)%56,gy=((c.y*scaleValue)%56+56)%56;
     for(let xx=0-gx;xx<width;xx+=56)line(xx,y-205,xx,y+140);
     for(let yy=y-205-gy;yy<y+140;yy+=56)line(0,yy,width,yy);
     __movementPaint(c,x,y,scaleValue);__movementPaint(c,x+210,y+70,1);pop();
     noStroke();fill(212,227,222);textSize(14);text(['WALK','JOG','RUN'][i],120,y+85);
     records.push({x:c.x,y:c.y,aim:c.aimAngle,move:c.moveAngle,gait:c.gait,cycle:c.walkCycle,moving:c.isMoving,lower:standingLowerPose(c),motion:{...c._standingMotion},aimFilter:c._standingAim?{...c._standingAim}:null});
    }
    return {stage,records,depth:__paintStats.depth,minDepth:__paintStats.minDepth};
   };
  },label);
 }
 const total=Number(process.env.STANDING_FLUID_FRAMES||360),records=[];
 for(let f=0;f<total;f++){
  const a=await beforePage.evaluate(({f,total})=>__fluidFrame(f,total),{f,total}),b=await afterPage.evaluate(({f,total})=>__fluidFrame(f,total),{f,total});
  assert.deepEqual(b,a,'fluid gait retains exact physical hip/torso/input state, frame '+f);assert.equal(b.depth,0);assert.equal(b.minDepth,0);records.push(b);
  await beforePage.locator('canvas').first().screenshot({path:path.join(fluidOut,'before',String(f).padStart(4,'0')+'.png')});
  await afterPage.locator('canvas').first().screenshot({path:path.join(fluidOut,'after',String(f).padStart(4,'0')+'.png')});
 }
 const encode=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(fluidOut,'before','%04d.png'),'-framerate','30','-i',path.join(fluidOut,'after','%04d.png'),'-filter_complex','[0:v][1:v]hstack=inputs=2','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',path.join(fluidOut,'standing-fluid-before-after.mp4')],{encoding:'utf8'});
 if(encode.error)throw encode.error;assert.equal(encode.status,0,encode.stderr);
 fs.writeFileSync(path.join(fluidOut,'motion.json'),JSON.stringify(records,null,2));return {frames:total,out:fluidOut};
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const a=await load(browser,baseline),b=await load(browser,candidate),samples=cases(),records=[];
  if(process.env.STANDING_FLUID_ONLY){if(!out)throw Error('Set STANDING_REVIEW_OUT for fluid review');const fluid=await fluidReview(a.page,b.page);assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);console.log('PASS '+fluid.frames+' native before/after fluid-gait frames. Preview: '+fluid.out);return;}
  const beforeStand=await locomotionHistory(a.page,'STAND'),afterStand=await locomotionHistory(b.page,'STAND');
  assert.deepEqual(afterStand,beforeStand,'standing hip/aim/input histories remain exactly unchanged');
  console.log('PASS '+beforeStand.records.length+' original standing hip/aim/input samples unchanged.');
  // Bypass only the changed leg branch to compare the retained hip transform,
  // torso, arms and firearm over actual histories, including rear/idle.
  for(let offset=0;offset<beforeStand.snapshots.length;offset+=64){
   const batch=beforeStand.snapshots.slice(offset,offset+64),pa=await a.page.evaluate(batch=>__movementAtlas(batch,false,true),batch),pb=await b.page.evaluate(batch=>__movementAtlas(batch,false,true),batch);
   assert.equal(hashPixels(pb),hashPixels(pa),'retained model and torso pixels outside rear leg art, batch='+offset);assert.deepEqual(pb,pa);
  }
  console.log('PASS '+beforeStand.snapshots.length+' retained hip/torso/arm/firearm native poses unchanged with rear leg art bypassed.');
  const beforeCrouch=await locomotionHistory(a.page),afterCrouch=await locomotionHistory(b.page);
  assert.deepEqual(afterCrouch,beforeCrouch,'existing crouch input histories and solver state remain unchanged');
  for(let offset=0;offset<beforeCrouch.snapshots.length;offset+=64){
   const batch=beforeCrouch.snapshots.slice(offset,offset+64),pa=await a.page.evaluate(batch=>__movementAtlas(batch,false),batch),pb=await b.page.evaluate(batch=>__movementAtlas(batch,false),batch);
   assert.equal(hashPixels(pb),hashPixels(pa),'existing crouch input-history pixels, batch='+offset);assert.deepEqual(pb,pa);
  }
  console.log('PASS '+beforeCrouch.records.length+' original crouch input/state samples and '+beforeCrouch.snapshots.length+' native crouch poses unchanged.');
  if(!process.env.STANDING_REVIEW_ONLY)for(const biome of [false,true])for(let offset=0;offset<samples.length;offset+=64){
   const batch=samples.slice(offset,offset+64),pa=await a.page.evaluate(({batch,biome})=>__movementAtlas(batch,biome),{batch,biome}),pb=await b.page.evaluate(({batch,biome})=>__movementAtlas(batch,biome),{batch,biome});
   const ha=hashPixels(pa),hb=hashPixels(pb);assert.equal(hb,ha,'original front/side pixels, biome='+biome+', batch='+offset);
   assert.deepEqual(pb,pa,'original front/side painter state, biome='+biome+', batch='+offset);
   assert.equal(pb.stats.depth,0);assert.equal(pb.stats.minDepth,0);records.push({biome,offset,poses:batch.length,sha256:ha});
  }
  if(!process.env.STANDING_REVIEW_ONLY)console.log('PASS '+samples.length*2+' native front/side poses match original pixels and state exactly.');
  let previews=null;if(out){previews=await review(b.page);if(process.env.STANDING_HEEL_REVIEW){previews.heelVisibility=await heelVisibility(b.page);previews.heels=await heelReview(b.page);}if(process.env.STANDING_FLUID_REVIEW)previews.fluid=await fluidReview(a.page,b.page);fs.writeFileSync(path.join(out,'parity.json'),JSON.stringify({baseline,candidate,poses:records.reduce((n,r)=>n+r.poses,0),records,previews,errors:b.errors},null,2));console.log('PASS '+previews.frames+' input-driven motion frames and '+previews.actualInputSamples+' actual-input reference samples. Previews: '+out);}
  assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

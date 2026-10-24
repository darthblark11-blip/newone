// Native p5 regression for the user's original front/side/unaimed locomotion.
// STANDING_BASELINE=/tmp/game-before.js VIS_DEPS=/tmp/newone-hip-deps node tools/check-standing-movement-parity.js
// Set STANDING_REVIEW_OUT to also write rear-step contact sheets and an input-driven clip.
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
window.__movementAtlas=(cases,biome)=>{
 BIOME_ACTIVE=biome;GLRig.on=GLRig.ok=false;GLRig.failure=GLRIG_SHED_MSG;frameCount=43;
 worldTimeMs=13/24*DAY_MS;updateSunVector();background(46,56,61);const states=[];
 for(let i=0;i<cases.length;i++){
  const row=cases[i],c=__movementActor(row.weapon,row.aim);player=c;c.moveAngle=row.move;c.gait=row.gait;c.walkCycle=row.phase;c.isMoving=true;
  c.aimHold=row.aimed?14:0;rightStick.active=row.aimed;rightStick.dx=Math.cos(row.aim);rightStick.dy=Math.sin(row.aim);rightStick.dist=.4;
  const x=64+(i%8)*128,y=64+Math.floor(i/8)*128;
  push();drawingContext.beginPath();drawingContext.rect(x-64,y-64,128,128);drawingContext.clip();__movementPaint(c,x,y);pop();
  states.push({aim:c.aimAngle,move:c.moveAngle,gait:c.gait,cycle:c.walkCycle,armed:c.isArmed,hold:c.aimHold});
 }
 return {pixels:__movementBytes(),states,stats:__paintStats};
};`;
function cases(){
 const result=[];
 for(const weapon of ['PISTOL','ASSAULT_RIFLE'])for(const gait of [.2,.5,1])for(let phase=0;phase<8;phase++)for(let a=0;a<4;a++){
  const aim=-Math.PI/2+a*Math.PI/2;
  for(const delta of [-Math.PI/2,-Math.PI/2+.001,-Math.PI/4,0,Math.PI/4,Math.PI/2-.001,Math.PI/2])
   result.push({weapon,gait,phase:phase*Math.PI/4,aim,move:aim+delta,aimed:true});
  for(let d=0;d<8;d++)result.push({weapon,gait,phase:phase*Math.PI/4,aim,move:d*Math.PI/4,aimed:false});
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
async function review(page){
 fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(out,'frames'),{recursive:true});
 const sweep=await page.evaluate(()=>{
  const records=[];BIOME_ACTIVE=false;
  for(let facing=0;facing<4;facing++)for(const throttle of [.2,.5,1]){
   const aim=-Math.PI/2+facing*Math.PI/2,c=__movementActor('ASSAULT_RIFLE',aim);
   __movementStep(c,aim,throttle,aim,100);
   for(let direction=0;direction<360;direction++){
    __movementStep(c,aim+direction*Math.PI/180,throttle,aim);
    const pose=standingRearPose(c),rear=-Math.cos(c.moveAngle-c.aimAngle)>1e-8;
    if(!!pose!==rear)throw Error('Wrong actual-input front/rear selection at facing '+facing+', direction '+direction);
    if(pose&&!Object.values(pose).every(Number.isFinite))throw Error('Nonfinite actual-input rear pose');
    records.push({aim:c.aimAngle,move:c.moveAngle,gait:c.gait,cycle:c.walkCycle,rear:!!pose,hip:pose?pose.angle:c.moveAngle});
   }
  }
  return records;
 });
 fs.writeFileSync(path.join(out,'input-sweep.json'),JSON.stringify(sweep,null,2));
 await page.setViewportSize({width:1600,height:1080});
 await page.evaluate(()=>{resizeCanvas(1600,1080);BIOME_ACTIVE=false;window.__reviewBackground=(title,sub)=>{
  background(37,50,57);noStroke();textFont('sans-serif');textAlign(CENTER,CENTER);fill(226,236,231);textSize(21);text(title,width/2,28);
  fill(156,185,188);textSize(11);text(sub,width/2,54);
 };window.__reviewLabel=(s,x,y)=>{noStroke();fill(212,227,222);textSize(11);text(s,x,y);};});
 for(const weapon of ['PISTOL','ASSAULT_RIFLE']){
  await page.evaluate(weapon=>{
   __reviewBackground('ORIGINAL FRONT / SIDE — REAR-ONLY BACKSTEPS / '+weapon,'Aim stays north. Movement comes from the actual left-stick update. Original footwear and cadence.');
   const names=['N','NE','E','SE','S','SW','W','NW'];
   for(let row=0;row<3;row++)for(let col=0;col<8;col++){
    const aim=-Math.PI/2,move=aim+col*Math.PI/4,c=__movementActor(weapon,aim),gait=[.2,.5,1][row];
    __movementStep(c,move,gait,aim,100);__movementPaint(c,100+col*200,210+row*320,3.3);
    __movementPaint(c,168+col*200,280+row*320,1);
    __reviewLabel(['WALK','JOG','RUN'][row]+' / '+names[col],100+col*200,340+row*320);
   }
  },weapon);
  await page.locator('canvas').first().screenshot({path:path.join(out,'directions-'+weapon.toLowerCase()+'.png')});
 }
 await page.evaluate(()=>{
  __reviewBackground('BACKWARD STEP PHASES','North-facing rifle: original N run above; the rear-only S / SW steps below.');
  for(let row=0;row<3;row++)for(let col=0;col<8;col++){
   const aim=-Math.PI/2,move=aim+[0,Math.PI,Math.PI*1.25][row],c=__movementActor('ASSAULT_RIFLE',aim);
   __movementStep(c,move,1,aim,100);c.walkCycle=col*Math.PI/4;
   __movementPaint(c,100+col*200,210+row*320,3.3);__movementPaint(c,168+col*200,280+row*320,1);
   __reviewLabel(['FORWARD','BACKWARD','BACK LEFT'][row]+' / '+col+'π/4',100+col*200,340+row*320);
  }
 });
 await page.locator('canvas').first().screenshot({path:path.join(out,'rear-step-phases.png')});
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>{
  resizeCanvas(1440,1000);window.__movieActors=Array.from({length:6},(_,i)=>__movementActor(i===3?'PISTOL':'ASSAULT_RIFLE',-Math.PI/2));
  for(let i=0;i<6;i++)__movementStep(__movieActors[i],-Math.PI/2+[0,-Math.PI/2,Math.PI/2,-Math.PI*.75,Math.PI,Math.PI*.75][i],.2,-Math.PI/2,80);
 });
 const total=Number(process.env.STANDING_REVIEW_FRAMES||240),motion=[];
 for(let f=0;f<total;f++){
  const result=await page.evaluate(({f,total})=>{
   const throttle=f<total/3?.2:f<total*2/3?.5:1,base=-Math.PI/2,deltas=[0,-Math.PI/2,Math.PI/2,-Math.PI*.75,Math.PI,Math.PI*.75];
   for(let step=0;step<2;step++){
    frameCount++;deltaTime=1000/60;
    for(let i=0;i<6;i++){const c=__movieActors[i];__movementInput(c,base+deltas[i],throttle,base);c.updatePlayer();}
   }
   __reviewBackground('ORIGINAL FRONT / STRAFE — NEW BACKWARD RUN','Same walk/jog/run throttle and stride clock. Rear half of the stick selects backsteps while the torso keeps aiming north.');
   for(let i=0;i<6;i++){
    const c=__movieActors[i],x=240+(i%3)*480,y=300+Math.floor(i/3)*450,scaleValue=4.5;
    push();drawingContext.beginPath();drawingContext.rect(x-230,y-190,460,340);drawingContext.clip();stroke(57,73,80);strokeWeight(1);
    const gx=((c.x*scaleValue)%72+72)%72,gy=((c.y*scaleValue)%72+72)%72;
    for(let xx=x-250-gx;xx<x+250;xx+=72)line(xx,y-210,xx,y+170);
    for(let yy=y-210-gy;yy<y+170;yy+=72)line(x-250,yy,x+250,yy);
    __movementPaint(c,x,y,scaleValue);__movementPaint(c,x+145,y+80,1);pop();
    __reviewLabel(['FORWARD','LEFT STRAFE','RIGHT STRAFE','BACK LEFT','BACKWARD','BACK RIGHT'][i]+' / '+(throttle<.3?'WALK':throttle<.6?'JOG':'RUN'),x,y+190);
   }
   return {frame:f,stats:__paintStats,poses:__movieActors.map(c=>({aim:c.aimAngle,move:c.moveAngle,cycle:c.walkCycle,gait:c.gait,x:c.x,y:c.y}))};
  },{f,total});
  assert.equal(result.stats.depth,0,'balanced native motion frame '+f);assert.equal(result.stats.minDepth,0);motion.push(result);
  await page.locator('canvas').first().screenshot({path:path.join(out,'frames',String(f).padStart(4,'0')+'.png')});
 }
 const encode=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate','30','-i',path.join(out,'frames','%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',path.join(out,'rear-run.mp4')],{encoding:'utf8'});
 if(encode.error)throw encode.error;assert.equal(encode.status,0,encode.stderr);
 fs.writeFileSync(path.join(out,'motion.json'),JSON.stringify(motion,null,2));return {frames:total,actorUpdates:total*12,inputSweep:sweep.length};
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const a=await load(browser,baseline),b=await load(browser,candidate),samples=cases(),records=[];
  if(!process.env.STANDING_REVIEW_ONLY)for(const biome of [false,true])for(let offset=0;offset<samples.length;offset+=64){
   const batch=samples.slice(offset,offset+64),pa=await a.page.evaluate(({batch,biome})=>__movementAtlas(batch,biome),{batch,biome}),pb=await b.page.evaluate(({batch,biome})=>__movementAtlas(batch,biome),{batch,biome});
   const ha=hashPixels(pa),hb=hashPixels(pb);assert.equal(hb,ha,'original front/side/unaimed pixels, biome='+biome+', batch='+offset);
   assert.deepEqual(pb,pa,'original front/side/unaimed painter state, biome='+biome+', batch='+offset);
   assert.equal(pb.stats.depth,0);assert.equal(pb.stats.minDepth,0);records.push({biome,offset,poses:batch.length,sha256:ha});
  }
  if(!process.env.STANDING_REVIEW_ONLY)console.log('PASS '+samples.length*2+' native original front/side/unaimed poses match baseline pixels and state exactly.');
  let previews=null;if(out){previews=await review(b.page);fs.writeFileSync(path.join(out,'parity.json'),JSON.stringify({baseline,candidate,poses:records.reduce((n,r)=>n+r.poses,0),records,previews,errors:b.errors},null,2));console.log('PASS '+previews.frames+' input-driven motion frames and '+previews.inputSweep+' actual-input direction samples. Previews: '+out);}
  assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

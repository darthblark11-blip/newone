// Native seated-injury timing and figure review; all anatomy comes from game.js.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(process.env.VIS_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.SEATED_INJURY_OUT||'/tmp/newone-seated-refinement';
const frames=path.join(out,'frames');fs.mkdirSync(frames,{recursive:true});
const count=Number(process.env.SEATED_INJURY_FRAMES||120),fps=30;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const errors=[],page=await browser.newPage({viewport:{width:2400,height:1480},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(2400,1480);pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('__ready');
  await page.evaluate(()=>{
   resetRunState();currentLevel=currentBiome=2;BIOME_ACTIVE=false;
   isStoryMode=false;started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
   inOverworldView=false;window.inNM0SecretOverlay=false;buildGhost=null;nm0AmbushActive=farmAmbushActive=false;
   townsData={};window.outpostForts={};buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
   particles=[];corpses=[];enemiesList=[];bullets=[];invalidateColIndex();resetShovelState();resetForestWildlife();
   setMeleeTool('NONE');jetpackUnlocked=jetpackFireExplosion=chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
   leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
   viewLeft=viewTop=-100000;viewRight=viewBottom=100000;zoom=1;camX=camY=0;deltaTime=1000/60;
   window.setTimeout=()=>0;window.__seatedFixtures=[];window.__seatedStack={depth:0,minDepth:0};
   const nativePush=window.push,nativePop=window.pop;
   window.push=function(...a){__seatedStack.depth++;return nativePush(...a);};
   window.pop=function(...a){__seatedStack.depth--;__seatedStack.minDepth=Math.min(__seatedStack.minDepth,__seatedStack.depth);return nativePop(...a);};
   window.__seatedUse=f=>{player=f.player;enemiesList=[f.e];particles=f.particles;bullets=f.bullets;corpses=f.corpses;};
   window.__seatedMake=(index,moving=false,side=0,weapon='PISTOL')=>{
    frameCount++;randomSeed(32840+index);doTick=true;particles=[];bullets=[];corpses=[];enemiesList=[];
    const e=new Character(0,0,false,index%2?'ARMORED_STANDARD':'NORMAL');
    e.hp=e.maxHp=450;e.shield=0;e.isFriendly=e.isNeutral=false;e.isArmed=true;e.name='';
    e.aimAngle=e.moveAngle=-Math.PI/2;e.isMoving=moving;e.gait=moving?.9:0;e.walkCycle=moving?1.4:0;
    e.muzzleFlash=e.reloadTimer=e.meleeTimer=e.weaponKick=e.hitFlash=0;e.currentWeapon=WEAPONS[weapon];
    resetActorStance(e,'STAND');rememberFigureMotion(e,0,moving?-4:0);enemiesList=[e];
    player=new Character(0,-200,true);player.hp=player.maxHp=100000;player.shield=0;
    e.decals=[{isLeg:true,legIndex:side,legSegment:1,legU:.73,legV:.05,sz:3,col:[90,0,0,220]}];
    e.fallHit={frame:frameCount,kind:'LEGS',mx:0,my:moving?-4:0,wound:e.decals[0]};
    legInjurySerial=1;if(!beginLegInjury(e,{tH:'LEGS',a:-Math.PI/2,w:WEAPONS.PISTOL},side))throw Error('Native seated injury fixture rejected');
    e.hitFlash=0;e.stanceDamage=null;
    const f={index,e,player,particles,bullets,corpses,ms:0,moving,side,weapon,startX:e.x,startY:e.y};
    __seatedFixtures.push(f);return f;
   };
   window.__seatedState=f=>({index:f.index,ms:f.ms,moving:f.moving,side:f.side,weapon:f.weapon,x:f.e.x,y:f.e.y,
    phase:f.e.legInjury?.phase||'NORMAL AI',stance:actorStance(f.e),pose:legInjuryPose(f.e),
    profile:['HEAD','BODY','LEGS'].map(z=>stanceHitProfile(f.e,z)?.zone||'MISS'),stack:{...__seatedStack}});
   window.__seatedAdvance=(f,toMs)=>{
    __seatedUse(f);doTick=true;push();translate(-10000,-10000);
    while(f.ms+1e-5<toMs){frameCount++;deltaTime=Math.min(1000/60,toMs-f.ms);f.e.updateEnemy();updateBullets();updateParticles();f.ms+=deltaTime;}
    pop();return __seatedState(f);
   };
   window.__seatedPaint=(f,x,y,magnify=2.8)=>{
    __seatedUse(f);doTick=false;frameCount++;
    const before=JSON.stringify({injury:f.e.legInjury,stance:f.e.stance,decals:f.e.decals,x:f.e.x,y:f.e.y});
    push();translate(x,y);scale(magnify);
    stroke(54,75,70);strokeWeight(.4);for(let i=-40;i<=40;i+=20){line(i,-40,i,40);line(-40,i,40,i);}
    push();translate(-f.startX,-f.startY);f.e.show();pop();pop();
    if(JSON.stringify({injury:f.e.legInjury,stance:f.e.stance,decals:f.e.decals,x:f.e.x,y:f.e.y})!==before)throw Error('Seated injury paint changed simulation or wound attachment');
    return __seatedState(f);
   };
   window.__seatedBack=()=>{background(27,41,44);noStroke();textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);
    fill(231,240,223);textSize(23);text('LEG INJURY / FALL ONTO THE BACK, THEN SIT UP',width/2,16);
    fill(156,187,174);textSize(12);text('Native injury state, shared body joints, native weapon mounts and elevation hit profiles.',width/2,50);};
   window.__seatedCard=(x,y,w,h,title,subtitle='')=>{noStroke();fill(17,30,33);rect(x,y,w,h,9);
    textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);fill(216,231,216);textSize(11);text(title,x+w/2,y+12);
    fill(146,178,165);textSize(10);text(subtitle,x+w/2,y+31);};
  });
  const phases=await page.evaluate(()=>{
   __seatedBack();const records=[],times=[0,250,650,850,1050,1250,1500,1900];
   for(let row=0;row<4;row++){
    const f=__seatedMake(row,row<2,row%2,row%2?'ASSAULT_RIFLE':'PISTOL'),y=82+row*347;
    for(let col=0;col<times.length;col++){
     __seatedAdvance(f,times[col]);const x=col*300,phase=f.e.legInjury?.phase||'NORMAL AI';
     __seatedCard(x+7,y,286,335,(f.moving?'MOVING':'STILL')+' / '+(f.side?'RIGHT':'LEFT')+' / '+f.weapon,'+'+times[col]+' ms / '+phase);
     records.push(__seatedPaint(f,x+150,y+191,2.55));
    }
   }return records;
  });
  assert(phases.every(r=>r.stack.depth===0&&r.stack.minDepth===0),'phase painters balance transforms');
  await page.locator('canvas').first().screenshot({path:path.join(out,'seated-drop-phases.png')});
  await page.setViewportSize({width:1440,height:1040});
  await page.evaluate(()=>{resizeCanvas(1440,1040);window.__seatedMovie=[__seatedMake(10,true,0,'PISTOL'),__seatedMake(11,true,1,'ASSAULT_RIFLE'),__seatedMake(12,false,0,'PISTOL'),__seatedMake(13,false,1,'ASSAULT_RIFLE')];});
  let motion=[];
  for(let frame=0;frame<count;frame++){
   motion=await page.evaluate(frame=>{
    __seatedBack();return __seatedMovie.map((f,i)=>{
     __seatedAdvance(f,frame*1000/30);const x=i%2*720,y=82+Math.floor(i/2)*475;
     __seatedCard(x+9,y,702,460,(f.moving?'MOVING':'STILL')+' / '+(f.side?'RIGHT':'LEFT')+' LEG / '+f.weapon,(f.ms/1000).toFixed(2)+' s / '+(f.e.legInjury?.phase||'NORMAL AI'));
     return __seatedPaint(f,x+355,y+235,3.8);
    });
   },frame);
   assert(motion.every(r=>r.stack.depth===0&&r.stack.minDepth===0),'motion painters balance transforms');
   await page.locator('canvas').first().screenshot({path:path.join(frames,String(frame).padStart(4,'0')+'.png')});
  }
  assert.deepEqual(errors,[],'native seated injury simulation has no browser errors');
  if(count){
   const r=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(frames,'%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','19','-movflags','+faststart',path.join(out,'seated-drop.mp4')],{encoding:'utf8'});
   if(r.error)throw r.error;assert.equal(r.status,0,r.stderr);
  }
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({phases,motion,errors,frames:count,fps},null,2));
  console.log(`Native seated injury: ${phases.length} phase cards, ${count} movie frames. Output: ${out}`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});

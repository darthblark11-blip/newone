// Native bullet kills, corpse updates, blood banking and p5 corpse painters.
// Every preview starts with an actual close-range BODY hit; no corpse art or
// ballistic state is replaced by the preview. The movie advances at 60 ticks/s.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const deps=process.env.VIS_DEPS||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const sourceHash=require('node:crypto').createHash('sha256').update(source).digest('hex');
const p5=fs.readFileSync(process.env.VIS_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.GUN_OVERKILL_OUT||'/tmp/newone-gun-overkill';
const frames=path.join(out,'frames');fs.mkdirSync(frames,{recursive:true});
const phases=[0,12,30,50,110,179,180],deathTypes=[2,7,10];
const identities=['NORMAL','ARMORED_STANDARD','NM0_ROOKIE_F'];
const totalFrames=Number(process.env.GUN_OVERKILL_FRAMES||96),fps=30;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:2800,height:1200},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>window.__gunNativeDraw=draw;preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(2800,1200);pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('__ready');
  await page.evaluate(()=>{
   resetRunState();resetUndergroundRoute();currentLevel=currentBiome=1;BIOME_ACTIVE=false;
   isStoryMode=false;started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
   window.inNM0SecretOverlay=false;buildGhost=null;nm0AmbushActive=farmAmbushActive=false;
   buildings=activeBuildings=[];activeParkingCars=parkingCars=[];barrels=[];enemiesList=[];corpses=[];particles=[];bullets=[];
   weaponDrops=[];healthPacks=[];floatingScores=[];fires=[];invalidateColIndex();
   setMeleeTool('NONE');jetpackUnlocked=jetpackFireExplosion=chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
   leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
   rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
   player=new Character(-100,0,true);player.currentWeapon=WEAPONS.SHOTGUN;
   player.hp=player.maxHp=100;player.shield=100;MAX_KILLS=1000000;
   viewLeft=viewTop=-100000;viewRight=viewBottom=100000;zoom=1;camX=camY=0;
   window.setTimeout=()=>0;window.__gunFixtures=[];window.__gunSerial=0;window.__gunPaintChecks=0;
   window.__gunStack={depth:0,minDepth:0};
   const nativePush=window.push,nativePop=window.pop;
   window.push=function(...a){__gunStack.depth++;return nativePush(...a);};
   window.pop=function(...a){__gunStack.depth--;__gunStack.minDepth=Math.min(__gunStack.minDepth,__gunStack.depth);return nativePop(...a);};
   window.__gunUse=f=>{particles=f.particles;corpses=f.corpses;enemiesList=[];bullets=[];useBloodBank(f.bank);};
   window.__gunMake=(dT,type='NORMAL',angle=0,weapon='SHOTGUN')=>{
    particles=[];corpses=[];bullets=[];enemiesList=[];weaponDrops=[];healthPacks=[];floatingScores=[];
    totalKills=consecutiveKills=comboTimer=killStreak=streakMsgTimer=0;
    doTick=true;frameCount++;randomSeed(19270+__gunSerial);
    useBloodBank('gun-overkill-'+__gunSerial++);viewLeft=viewTop=-100000;viewRight=viewBottom=100000;
    const e=new Character(0,0,false,type);e.hp=1;e.shield=0;e.dead=false;e.isFriendly=e.isNeutral=false;
    e.aimAngle=e.moveAngle=angle+PI;e.isMoving=false;e.isArmed=true;e.name='';
    e.walkCycle=e.gait=e.muzzleFlash=e.reloadTimer=e.meleeTimer=e.weaponKick=0;
    e.currentWeapon=WEAPONS.PISTOL;resetActorStance(e,'STAND');rememberFigureMotion(e,0,0);
    player.x=-Math.cos(angle)*100;player.y=-Math.sin(angle)*100;
    player.aimAngle=angle;player.currentWeapon=WEAPONS[weapon];enemiesList=[e];
    bodyOverkillCounter=[2,7,10].indexOf(dT);
    const b=new Bullet().init(-Math.cos(angle)*40,-Math.sin(angle)*40,angle,true,'BODY',WEAPONS[weapon],player);
    bullets=[b];for(let i=0;i<4&&!e.dead;i++)updateBullets();
    const c=corpses[0];
    if(!e.dead||!c||c.dT!==dT||enemiesList.includes(e))throw Error(type+' native bullet kill did not produce death '+dT);
    if(dT===2&&c.blast?.mode!=='SLICE'||dT===10&&c.blast?.mode!=='BREAKUP')throw Error('Shared firearm piece mode not installed');
    const f={dT,type,angle,weapon,bank:bloodBankId,corpses,particles,c,e,tick:0,
      label:({2:'BODY SLICE',7:'INTACT OVERKILL FALL',10:'TORSO / ARM BREAKUP'})[dT]};
    __gunFixtures.push(f);return f;
   };
   window.__gunAdvance=(f,toTick)=>{
    __gunUse(f);doTick=true;viewLeft=viewTop=-100000;viewRight=viewBottom=100000;
    push();translate(-10000,-10000);
    for(;f.tick<toTick;f.tick++){frameCount++;deltaTime=1000/60;updateCorpses();updateBloodPools();updateParticles();}
    pop();
   };
   window.__gunState=f=>{
    __gunUse(f);const c=f.c,b=c.blast;
    return{dT:c.dT,type:f.type,angle:f.angle,weapon:f.weapon,tick:f.tick,mode:b?.mode||null,
      liveCorpses:f.corpses.length,static:!!c.isStatic,bloodTimer:c.bloodTimer,
      done:b?.done||false,age:b?.age??null,fall:c.fall?{age:c.fall.age,progress:c.fP,done:c.fall.done}:null,
      parts:b?.parts.map(p=>({type:p.type,x:p.x,y:p.y,z:p.z,rot:p.rot,landed:p.landed,bounces:p.bounces,vx:p.vx,vy:p.vy})),
      particles:f.particles.length,pools:bloodPools.map(p=>({age:p.age,frames:p.frames,hold:p.hold})),
      stack:{...__gunStack}};
   };
   window.__gunPaint=(f,x,y,magnify,bounds,originX=0)=>{
    __gunUse(f);doTick=false;const before=JSON.stringify(__gunState(f));
    drawingContext.save();drawingContext.beginPath();drawingContext.rect(bounds.x,bounds.y,bounds.w,bounds.h);drawingContext.clip();
    push();translate(x,y);scale(magnify);noFill();stroke(57,72,72);strokeWeight(.6);
    for(let i=-400;i<=400;i+=32){line(i,-350,i,350);line(-400,i,400,i);}
    noStroke();fill(153,176,163);ellipse(originX,0,3,3);
    push();translate(-Math.cos(f.angle)*38,-Math.sin(f.angle)*38);rotate(f.angle);
    stroke(165,189,173);strokeWeight(1);line(-20,0,0,0);line(0,0,-6,-4);line(0,0,-6,4);pop();
    drawBloodLayer(false);drawBloodLayer(true);
    for(const c of f.corpses)c.show();for(const p of f.particles)p.show();
    pop();drawingContext.restore();
    if(JSON.stringify(__gunState(f))!==before)throw Error('Native corpse painting changed simulation state');
    __gunPaintChecks++;
    return __gunState(f);
   };
   window.__gunBack=(title,subtitle)=>{
    background(27,39,43);noStroke();textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);
    fill(233,240,227);textSize(22);text(title,width/2,13);fill(164,192,182);textSize(12);text(subtitle,width/2,43);
   };
   window.__gunCard=(f,x,y,w,h,scale=.9,center=false)=>{
    noStroke();fill(18,29,32);rect(x+6,y,w-12,h-10,8);
    textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(12);fill(209,226,214);
    text(f.label+' / '+f.type,x+w/2,y+10);fill(146,181,167);
    text('+'+f.tick+' TICKS / '+(f.tick/60).toFixed(2)+' s',x+w/2,y+29);
    const parts=f.c.blast?.parts||[{x:0,y:0,z:0}];
    const offsetX=center?(Math.min(...parts.map(p=>p.x))+Math.max(...parts.map(p=>p.x)))/2:0;
    const offsetY=center?(Math.min(...parts.map(p=>p.y-p.z))+Math.max(...parts.map(p=>p.y-p.z)))/2:0;
    return __gunPaint(f,x+(center?w/2:w>=500?105:88)-offsetX*scale,
      y+h*.59-offsetY*scale,scale,{x:x+7,y:y+52,w:w-14,h:h-65});
   };
  });
  const overview=await page.evaluate(({deathTypes,phases})=>{
   __gunBack('SHOTGUN BODY OVERKILL / NATIVE BULLET KILLS','One body per row: initial pose, airborne pieces, contact, floor slide, rest, last blood tick and blood stop.');
   return deathTypes.flatMap((dT,row)=>{
    const f=__gunMake(dT);return phases.map((age,col)=>{__gunAdvance(f,age);return __gunCard(f,col*400,75+row*370,400,370);});
   });
  },{deathTypes,phases});
  await page.locator('canvas').first().screenshot({path:path.join(out,'shotgun-native-phases.png')});
  const detail=[];
  await page.setViewportSize({width:2000,height:1400});
  for(const type of identities)for(const dT of deathTypes){
   detail.push(await page.evaluate(({type,dT,phases})=>{
    resizeCanvas(2000,1400);__gunBack(type+' / '+({2:'SLICE',7:'INTACT FALL',10:'BREAKUP'})[dT],
      'Native shotgun BODY kill at 1.25x. The same victim advances through all seven phases; the arrow shows shot direction.');
    const f=__gunMake(dT,type);return phases.map((age,index)=>{
     __gunAdvance(f,age);return __gunCard(f,(index%4)*500,75+Math.floor(index/4)*650,500,650,1.25);
    });
   },{type,dT,phases}));
   await page.locator('canvas').first().screenshot({path:path.join(out,type.toLowerCase()+'-'+dT+'-phases.png')});
  }
  await page.setViewportSize({width:1800,height:2500});
  const cardinal=await page.evaluate(({deathTypes})=>{
   resizeCanvas(1800,2500);__gunBack('CARDINAL SHOTS / SETTLED HUMAN CLOTHING AND ANATOMY',
     'Rows compare NORMAL / NM-0 armored for each death. Columns: east, south, west, north. Actual close-range bullet kills at +110 ticks.');
   const records=[];
   for(let row=0;row<6;row++)for(let col=0;col<4;col++){
    const f=__gunMake(deathTypes[Math.floor(row/2)],row%2?'ARMORED_STANDARD':'NORMAL',col*HALF_PI);
    __gunAdvance(f,110);records.push(__gunCard(f,col*450,75+row*400,450,400,1.0,true));
   }return records;
  },{deathTypes});
  await page.locator('canvas').first().screenshot({path:path.join(out,'cardinal-shot-comparison.png')});
  const dual=await page.evaluate(()=>{
   resizeCanvas(1800,900);__gunBack('DUAL SMG / SHARED BREAKUP','The same shared corpse mode from an actual DUAL_SMG BODY kill.');
   const f=__gunMake(10,'ARMORED_STANDARD',0,'DUAL_SMG');return[0,12,30,110].map((age,i)=>{
    __gunAdvance(f,age);return __gunCard(f,i*450,75,450,800,1.3);
   });
  });
  await page.setViewportSize({width:1800,height:900});
  await page.locator('canvas').first().screenshot({path:path.join(out,'dual-smg-shared-breakup.png')});
  // Also run the actual game draw() for three representative deaths. These
  // panels include the native world, camera, body pass, blood pass and HUD.
  const gameplay=[];
  await page.setViewportSize({width:1400,height:900});
  for(let i=0;i<deathTypes.length;i++){
   gameplay.push(await page.evaluate(({dT,type})=>{
    resizeCanvas(1400,900);const f=__gunMake(dT,type);__gunAdvance(f,49);__gunUse(f);
    player.x=80;player.y=160;player.aimAngle=-HALF_PI;player.currentWeapon=WEAPONS.SHOTGUN;
    player.fireTimer=player.reloadTimer=player.meleeTimer=0;streakMsgTimer=0;objectiveTimer=0;
    zoom=(1-.065)/.9;camX=player.x-width/2;camY=player.y-height/2;
    leftStick.base={x:80,y:height-160};rightStick.base={x:width-80,y:height-110};
    lastActiveUpdate=-1000;activeBuildings=[];invalidateColIndex();frameCount++;__gunNativeDraw();f.tick++;
    return{...__gunState(f),fault:window.FRAME_FAULT||null};
   },{dT:deathTypes[i],type:identities[i]}));
   await page.locator('canvas').first().screenshot({path:path.join(out,'gameplay-death-'+deathTypes[i]+'.png')});
  }
  await page.setViewportSize({width:1800,height:1100});
  await page.evaluate(deathTypes=>{resizeCanvas(1800,1100);window.__gunMovie=['NORMAL','ARMORED_STANDARD'].flatMap(type=>deathTypes.map(dT=>__gunMake(dT,type)));},deathTypes);
  let motion=[];
  for(let frame=0;frame<totalFrames;frame++){
   motion=await page.evaluate(frame=>{
    __gunBack('SHOTGUN BODY OVERKILL / ONE DEATH THROUGH FLIGHT AND BLEED STOP',
      'NORMAL above / NM-0 armored below. Native bullet kills and updates at 60 ticks/s; no rerolled poses or hand-painted parts.');
    return __gunMovie.map((f,i)=>{__gunAdvance(f,frame*2);return __gunCard(f,(i%3)*600,75+Math.floor(i/3)*510,600,510,1.4);});
   },frame);
   await page.locator('canvas').first().screenshot({path:path.join(frames,String(frame).padStart(4,'0')+'.png')});
  }
  assert.deepEqual(errors,[],'native firearm overkills produce no browser errors');
  const all=[...overview,...detail.flat(),...cardinal,...dual,...gameplay,...motion];
  assert(all.every(s=>s.stack.depth===0&&s.stack.minDepth===0),'native painters balance p5 transforms');
  assert(gameplay.every(s=>!s.fault),'native full game draws have no frame fault');
  assert(detail.every(stages=>stages.find(s=>s.tick===180).bloodTimer===0),'blood production ends after 180 native ticks');
  if(totalFrames){
   const encoded=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(frames,'%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',path.join(out,'gun-overkill.mp4')],{encoding:'utf8'});
   if(encoded.error)throw encoded.error;assert.equal(encoded.status,0,encoded.stderr);
  }
  const counts=await page.evaluate(()=>({nativeBulletKills:__gunFixtures.length,paintChecks:__gunPaintChecks}));
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({sourceHash,phases,identities,overview,detail,cardinal,dual,gameplay,motion,errors,fps,totalFrames,counts},null,2));
  console.log(`Native firearm overkills: ${counts.nativeBulletKills} native bullet kills, ${counts.paintChecks} pure native paint checks, ${detail.length} identity/death replays, ${cardinal.length} cardinal shots, ${gameplay.length} full draw() scenes, ${totalFrames} movie frames. Output: ${out}`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});

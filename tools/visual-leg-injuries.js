// Native firearm contacts, injury clocks and cel-shaded figure painters.
// This review contains no copy of character geometry or injury animation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(process.env.VIS_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.LEG_INJURY_OUT||'/tmp/newone-leg-injuries';
const frames=path.join(out,'frames');fs.mkdirSync(frames,{recursive:true});
const movieFrames=Number(process.env.LEG_INJURY_FRAMES||300),fps=30;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:2160,height:1510},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(2160,1510);pixelDensity(1);noLoop();window.__ready=true;};</script>');
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
   window.setTimeout=()=>0;window.__injuryFixtures=[];window.__injuryStack={depth:0,minDepth:0};
   const nativePush=window.push,nativePop=window.pop;
   window.push=function(...a){__injuryStack.depth++;return nativePush(...a);};
   window.pop=function(...a){__injuryStack.depth--;__injuryStack.minDepth=Math.min(__injuryStack.minDepth,__injuryStack.depth);return nativePop(...a);};
   window.__injuryUse=f=>{player=f.player;enemiesList=[f.e];particles=f.particles;bullets=f.bullets;corpses=f.corpses;};
   window.__injuryMake=(index,legIndex=0,moving=false,outcome=0,weapon='PISTOL')=>{
    for(let attempt=0;attempt<120;attempt++){
     frameCount++;randomSeed(62200+index);doTick=true;particles=[];bullets=[];corpses=[];enemiesList=[];
     const e=new Character(0,0,false,index%3===2?'ARMORED_STANDARD':'NORMAL');
     e.hp=e.maxHp=450;e.shield=0;e.isFriendly=e.isNeutral=false;e.isArmed=true;e.name='';
     e.aimAngle=e.moveAngle=-Math.PI/2;e.isMoving=moving;e.gait=moving?.9:0;e.walkCycle=moving?1.4:0;
     e.muzzleFlash=e.reloadTimer=e.meleeTimer=e.weaponKick=e.hitFlash=0;e.currentWeapon=WEAPONS[weapon];
     resetActorStance(e,'STAND');rememberFigureMotion(e,0,moving?-4:0);enemiesList=[e];
     player=new Character(0,180,true);player.hp=player.maxHp=100000;player.shield=0;
     const g=humanLegHitGeometry(e),leg=g.legs.find(l=>l.index===legIndex)||g.legs[legIndex],u=.62;
     const lx=leg.kx+(leg.ax-leg.kx)*u,ly=leg.ky+(leg.ay-leg.ky)*u,
      co=Math.cos(g.angle),si=Math.sin(g.angle),scaleBy=g.scale||1;
     const tx=e.x+(co*lx-si*ly)*scaleBy,ty=e.y+(si*lx+co*ly)*scaleBy;
     legInjurySerial=outcome;
     const b=spawnBullet(tx,ty+110,-Math.PI/2,true,'LEGS',WEAPONS.PISTOL,player,500000+index*200+attempt);
     push();translate(-10000,-10000);
     for(let tick=0;tick<8&&b.active&&!e.legInjury;tick++){frameCount++;updateBullets();}
     pop();
     if(!e.legInjury)continue;
     if(e.legInjury.legIndex!==legIndex)throw Error('Actual firearm selected wrong injured leg '+index+'/'+legIndex);
     e.hitFlash=0;e.stanceDamage=null;
     const f={index,e,player,particles,bullets,corpses,ms:0,legIndex,moving,outcome,weapon,
      startX:e.x,startY:e.y,shot:{x:b.x,y:b.y,id:b.shotId},initial:{...e.legInjury}};
     __injuryFixtures.push(f);return f;
    }
    throw Error('Could not trigger native leg injury '+index+'/'+legIndex+'/'+moving);
   };
   window.__injuryState=f=>({index:f.index,ms:f.ms,legIndex:f.legIndex,moving:f.moving,outcome:f.outcome,weapon:f.weapon,
    x:f.e.x,y:f.e.y,hp:f.e.hp,state:f.e.state,stance:actorStance(f.e),injury:f.e.legInjury?{...f.e.legInjury}:null,
    bullets:f.bullets.length,liveBullets:f.bullets.filter(b=>b.active).length,particles:f.particles.length,
    stack:{...__injuryStack}});
   window.__injuryAdvance=(f,toMs)=>{
    __injuryUse(f);doTick=true;push();translate(-10000,-10000);
    while(f.ms+1e-5<toMs){frameCount++;deltaTime=Math.min(1000/60,toMs-f.ms);f.e.updateEnemy();updateBullets();updateParticles();f.ms+=deltaTime;}
    pop();return __injuryState(f);
   };
   window.__injuryPaint=(f,x,y,magnify=2.8,aim=null,flash=false)=>{
    __injuryUse(f);doTick=false;frameCount++;
    if(aim!==null){f.e.aimAngle=aim;player.x=f.e.x+Math.cos(aim)*220;player.y=f.e.y+Math.sin(aim)*220;}
    if(flash)f.e.muzzleFlash=2;
    const before=JSON.stringify(f.e.legInjury),decals=JSON.stringify(f.e.decals);
    push();translate(x,y);scale(magnify);
    noStroke();fill(13,23,25,110);ellipse(0,0,100,70);
    stroke(49,70,66);strokeWeight(.45);for(let i=-40;i<=40;i+=20){line(i,-40,i,40);line(-40,i,40,i);}
    push();translate(-f.startX,-f.startY);f.e.show();pop();pop();
    if(JSON.stringify(f.e.legInjury)!==before)throw Error('Injury painter changed simulation state');
    if(JSON.stringify(f.e.decals)!==decals)throw Error('Injury painter changed saved wound attachment');
    return __injuryState(f);
   };
   window.__injuryBack=(title,subtitle)=>{
    background(28,42,45);noStroke();textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);
    fill(235,242,227);textSize(24);text(title,width/2,14);fill(157,190,179);textSize(12);text(subtitle,width/2,49);
   };
   window.__injuryCard=(x,y,w,h,title,subtitle='')=>{
    noStroke();fill(18,31,34);rect(x,y,w,h,9);textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);
    fill(213,231,218);textSize(12);text(title,x+w/2,y+13);fill(142,177,166);textSize(10);text(subtitle,x+w/2,y+32);
   };
  });
  const falls=await page.evaluate(()=>{
   __injuryBack('LEG INJURY / THE STRUCK SIDE COLLAPSES','Actual low firearm contacts. Moving victims lose the shot leg; stationary victims reach for it while dropping.');
   const records=[],phases=[0,120,280,480,730,1100];
   for(let row=0;row<4;row++){
    const moving=row<2,side=row%2,f=__injuryMake(row,side,moving,row%3),y=84+row*350;
    for(let col=0;col<phases.length;col++){
     __injuryAdvance(f,phases[col]);const x=col*360;
     __injuryCard(x+7,y,346,338,(moving?'MOVING':'STILL')+' / '+(side?'RIGHT':'LEFT')+' LEG','+'+phases[col]+' ms / '+(f.e.legInjury?.phase||'ACTIVE'));
     records.push(__injuryPaint(f,x+175,y+190,2.6));
    }
   }return records;
  });
  assert(falls.every(r=>r.stack.depth===0&&r.stack.minDepth===0),'fall painters balance transforms');
  await page.locator('canvas').first().screenshot({path:path.join(out,'leg-injury-falls.png')});
  await page.setViewportSize({width:2160,height:1240});
  const outcomes=await page.evaluate(()=>{
   resizeCanvas(2160,1240);__injuryBack('LEG INJURY / FIGHT FROM THE FLOOR OR GET BACK UP','One native enemy through each outcome. The same injury eventually releases back into normal combat.');
   const records=[],phases=[0,750,1600,3500,6200,8500];
   for(let row=0;row<3;row++){
    const f=__injuryMake(10+row,row%2,row!==1,row,row===1?'ASSAULT_RIFLE':'PISTOL'),y=84+row*378;
    for(let col=0;col<phases.length;col++){
     __injuryAdvance(f,phases[col]);const x=col*360;
     __injuryCard(x+7,y,346,365,['PRONE FIRE','SEATED FIRE','RECOVER'][row],'+'+phases[col]+' ms / '+(f.e.legInjury?.phase||'NORMAL AI'));
     records.push(__injuryPaint(f,x+175,y+210,2.4,null,phases[col]>1000&&phases[col]<6000));
    }
   }return records;
  });
  await page.locator('canvas').first().screenshot({path:path.join(out,'leg-injury-outcomes.png')});
  await page.setViewportSize({width:2400,height:950});const directions={};
  for(const [name,outcome]of [['prone',0],['seated',1]]){
   directions[name]=await page.evaluate(({name,outcome})=>{
    resizeCanvas(2400,950);__injuryBack(name.toUpperCase()+' / EIGHT AIM DIRECTIONS','Native sidearm and rifle mounts, wrists, muzzle flash and original clothing. No independently drawn preview weapon.');
    const records=[];
    for(let row=0;row<2;row++){
     const f=__injuryMake(30+outcome*3+row,row%2,false,outcome,row?'ASSAULT_RIFLE':'PISTOL');__injuryAdvance(f,outcome===1?1900:1400);
     for(let col=0;col<8;col++){
      const x=col*300,y=84+row*425,angle=-Math.PI/2+col*Math.PI/4;
      __injuryCard(x+7,y,286,413,(row?'RIFLE':'PISTOL')+' / '+['N','NE','E','SE','S','SW','W','NW'][col],f.e.legInjury?.phase||'NORMAL AI');
      records.push(__injuryPaint(f,x+150,y+222,2.8,angle,true));
     }
    }return records;
   },{name,outcome});
   await page.locator('canvas').first().screenshot({path:path.join(out,'leg-injury-'+name+'-directions.png')});
  }
  await page.setViewportSize({width:1800,height:1000});
  await page.evaluate(()=>{resizeCanvas(1800,1000);window.__injuryMovie=[__injuryMake(60,0,true,0,'PISTOL'),__injuryMake(61,1,false,1,'ASSAULT_RIFLE'),__injuryMake(62,1,true,2,'COACH_GUN')];});
  let motion=[];
  for(let frame=0;frame<movieFrames;frame++){
   motion=await page.evaluate(frame=>{
    __injuryBack('LEG SHOTS / FALL, RETURN FIRE, RECOVER','Actual low projectile hits at 60 simulation ticks per second. One enemy per column; the injury is never re-triggered for the clip.');
    return __injuryMovie.map((f,i)=>{
     __injuryAdvance(f,frame*1000/30);const x=i*600,y=84;
     __injuryCard(x+8,y,584,897,['MOVING / LEFT LEG / PRONE','STILL / RIGHT LEG / SEATED','MOVING / RIGHT LEG / RECOVER'][i],(f.ms/1000).toFixed(2)+' s / '+(f.e.legInjury?.phase||'NORMAL AI'));
     return __injuryPaint(f,x+300,y+415,3.4);
    });
   },frame);
   assert(motion.every(r=>r.stack.depth===0&&r.stack.minDepth===0),'motion painters balance transforms');
   await page.locator('canvas').first().screenshot({path:path.join(frames,String(frame).padStart(4,'0')+'.png')});
  }
  assert.deepEqual(errors,[],'native injury simulation produces no browser errors');
  if(movieFrames){
   const result=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(frames,'%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','19','-movflags','+faststart',path.join(out,'leg-injuries.mp4')],{encoding:'utf8'});
   if(result.error)throw result.error;assert.equal(result.status,0,result.stderr);
  }
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({falls,outcomes,directions,motion,errors,movieFrames,fps},null,2));
  console.log(`Native leg injuries: ${falls.length} fall phases, ${outcomes.length} outcome phases, ${Object.values(directions).flat().length} weapon/aim cards and ${movieFrames} motion frames. Output: ${out}`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});

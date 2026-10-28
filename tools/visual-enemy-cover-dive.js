// Native NPC dive geometry, cover landings and p5 painting. No duplicate art.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(process.env.VIS_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.ENEMY_DIVE_OUT||'/tmp/newone-enemy-cover-dive';
const frames=path.join(out,'frames');fs.mkdirSync(frames,{recursive:true});
const movieFrames=Number(process.env.ENEMY_DIVE_FRAMES||45),fps=30;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const errors=[],page=await browser.newPage({viewport:{width:2400,height:1740},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(2400,1740);pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('__ready');
  await page.evaluate(()=>{
   resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
   isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
   inOverworldView=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
   window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
   setMeleeTool('NONE');jetpackUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
   leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
   viewLeft=viewTop=-10000;viewRight=viewBottom=10000;zoom=1;camX=camY=0;deltaTime=1000/60;
   window.setTimeout=()=>0;window.__diveStack={depth:0,minDepth:0};
   const nativePush=window.push,nativePop=window.pop;
   window.push=function(...a){__diveStack.depth++;return nativePush(...a);};
   window.pop=function(...a){__diveStack.depth--;__diveStack.minDepth=Math.min(__diveStack.minDepth,__diveStack.depth);return nativePop(...a);};
   window.__diveUse=f=>{player=f.player;enemiesList=[f.e];buildings=activeBuildings=[f.cover];particles=f.particles;bullets=[];corpses=[];parkingCars=activeParkingCars=[];barrels=[];invalidateColIndex();};
   window.__diveMake=(index)=>{
    frameCount++;randomSeed(63210+index);doTick=true;particles=[];bullets=[];corpses=[];resetShovelState();resetForestWildlife();
    const q=Math.floor(index/2)%4,a=q*Math.PI/2,co=Math.cos(a),si=Math.sin(a),bx=index%2?20:-86,by=140;
    const cover={x:co*bx-si*by,y:si*bx+co*by,w:q%2?100:80,h:q%2?80:100,isLowWall:true,hp:1000};
    player=new Character(-350*co,-350*si,true);player.hp=player.maxHp=100000;player.shield=0;
    const e=new Character(0,0,false,index%2?'ARMORED_STANDARD':'NORMAL');
    e.hp=e.maxHp=400;e.shield=0;e.isFriendly=e.isNeutral=false;e.isUnarmed=false;e.isArmed=true;
    e.currentWeapon=WEAPONS[index%2?'ASSAULT_RIFLE':'PISTOL'];e.ammo=40;
    e.aimAngle=e.moveAngle=a;e.isMoving=false;e.gait=e.walkCycle=e.muzzleFlash=e.reloadTimer=e.hitFlash=0;
    resetActorStance(e);buildings=activeBuildings=[cover];enemiesList=[e];parkingCars=activeParkingCars=[];barrels=[];invalidateColIndex();
    if(!beginEnemyCoverDive(e,player))throw Error('Native cover dive fixture rejected '+index);
    const f={index,e,player,cover,particles,ms:0,startX:e.x,startY:e.y,
     targetX:e.stance.dive.landingX,targetY:e.stance.dive.landingY,distance:e.stance.dive.distance,heading:e.stance.dive.angle};
    return f;
   };
   window.__diveState=f=>({index:f.index,ms:f.ms,x:f.e.x,y:f.e.y,heading:f.heading,distance:f.distance,
    value:f.e.stance.value,elapsed:f.e.stance.elapsedMs,landed:f.e.stance.dive?.landed,
    lift:proneDiveLift(f.e),poseActive:proneDivePoseActive(f.e),immune:proneDiveActive(f.e),
    clear:stanceProneSpotClear(f.e),covered:!coverLineClear(f.player.x,f.player.y,f.e.x,f.e.y,'LEGS',f.player,f.e,true),
    dust:particles.filter(p=>p.t==='PRONE_DUST').length,stack:{...__diveStack}});
   window.__diveAdvance=(f,toMs)=>{
    __diveUse(f);doTick=true;push();translate(-10000,-10000);
    while(f.ms+1e-7<toMs){frameCount++;deltaTime=Math.min(1000/60,toMs-f.ms);updateEnemyCoverDive(f.e,deltaTime);updateParticles();f.ms+=deltaTime;}
    pop();return __diveState(f);
   };
   window.__divePaint=(f,x,y,scaleBy=3.1,scene=false)=>{
    __diveUse(f);doTick=false;frameCount++;
    const before=JSON.stringify({s:f.e.stance,x:f.e.x,y:f.e.y,ammo:f.e.ammo,particles:particles.length});
    push();translate(x,y);scale(scaleBy);
    const unfold=Math.max(0,Math.min(1,f.e.stance.value/2)),center=20-22*unfold;
    const cx=scene?(f.startX+f.targetX)*.5:f.e.x+Math.cos(f.heading)*center,
     cy=scene?(f.startY+f.targetY)*.5:f.e.y+Math.sin(f.heading)*center-proneDiveLift(f.e);
    translate(-cx,-cy);stroke(55,77,70);strokeWeight(.4);
    for(let gx=Math.floor((cx-170)/20)*20;gx<cx+170;gx+=20)line(gx,cy-170,gx,cy+170);
    for(let gy=Math.floor((cy-170)/20)*20;gy<cy+170;gy+=20)line(cx-170,gy,cx+170,gy);
    if(scene){
     const b=f.cover;noStroke();fill(69,90,87);rect(b.x-b.w/2,b.y-b.h/2,b.w,b.h,3);fill(119,144,127);rect(b.x-b.w/2,b.y-b.h/2,b.w,4,2);
     noFill();stroke(219,183,81,100);strokeWeight(1);line(f.startX,f.startY,f.targetX,f.targetY);ellipse(f.targetX,f.targetY,14,14);
    }
    f.e.show();pop();
    if(JSON.stringify({s:f.e.stance,x:f.e.x,y:f.e.y,ammo:f.e.ammo,particles:particles.length})!==before)throw Error('Native enemy dive paint changed simulation');
    const state=__diveState(f);if(state.immune)throw Error('Enemy visual dive granted player invulnerability');
    if(state.stack.depth!==0||state.stack.minDepth!==0)throw Error('Native enemy dive leaked p5 transforms');
    return state;
   };
   window.__diveBack=(title)=>{background(25,39,43);noStroke();textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);
    fill(229,238,222);textSize(25);text(title,width/2,15);fill(156,188,176);textSize(12);text('Actual NPC cover dives: 420 ms, up to 270 units, shared native pose and swept collision. Player timing is unchanged.',width/2,51);};
   window.__diveCard=(x,y,w,h,title,sub)=>{noStroke();fill(16,29,33);rect(x,y,w,h,9);fill(216,231,216);textSize(12);text(title,x+w/2,y+12);fill(145,178,165);textSize(10);text(sub,x+w/2,y+33);};
  });
  const cards=await page.evaluate(()=>{
   __diveBack('LEG FIRE REACTION / DIVE INTO COVER');const records=[],times=[0,65,140,210,350,420];
   for(let row=0;row<8;row++){
    const f=__diveMake(row),y=82+row*204;
    for(let col=0;col<times.length;col++){
     __diveAdvance(f,times[col]);const x=col*400;
     __diveCard(x+7,y,386,193,(row%2?'RIFLE':'PISTOL')+' / '+Math.round(f.heading*180/Math.PI)+'°','+'+times[col]+' ms / '+(f.e.stance.dive.landed?'LANDED':'DIVING'));
     drawingContext.save();drawingContext.beginPath();drawingContext.rect(x+8,y+52,384,140);drawingContext.clip();
     records.push(__divePaint(f,x+200,y+123,1.65));drawingContext.restore();
    }
   }return records;
  });
  assert(cards.length===48);assert(cards.every(r=>!r.immune));
  assert(cards.filter(r=>r.ms===210).every(r=>Math.abs(r.lift-14)<1e-7),'NPC dive shares native mid-flight lift');
  assert(cards.filter(r=>r.ms===420).every(r=>r.landed&&!r.poseActive&&r.lift===0),'NPC lands in its native prone figure');
  assert(cards.filter(r=>r.ms===420).every(r=>r.clear&&r.covered&&r.dust===8),'native landing is clear of solid cover and protected from low fire');
  await page.locator('canvas').first().screenshot({path:path.join(out,'enemy-cover-dive-phases.png')});
  await page.setViewportSize({width:1920,height:1080});
  await page.evaluate(()=>{resizeCanvas(1920,1080);window.__diveMovie=[__diveMake(0),__diveMake(1),__diveMake(4),__diveMake(5)];});
  let motion=[];
  for(let frame=0;frame<movieFrames;frame++){
   motion=await page.evaluate(frame=>{
    __diveBack('ENEMY COVER DIVE / ORIGINAL SHORT TIMING');return __diveMovie.map((f,i)=>{
     __diveAdvance(f,frame*1000/30);const x=i%2*960,y=82+Math.floor(i/2)*490;
     __diveCard(x+9,y,942,479,(i%2?'RIFLE':'PISTOL')+' / '+Math.round(f.heading*180/Math.PI)+'°',(f.ms/1000).toFixed(2)+' s / '+(f.e.stance.dive.landed?'IN COVER':'DIVE'));
     drawingContext.save();drawingContext.beginPath();drawingContext.rect(x+12,y+56,936,418);drawingContext.clip();
     const state=__divePaint(f,x+480,y+271,1.7,true);drawingContext.restore();return state;
    });
   },frame);
   await page.locator('canvas').first().screenshot({path:path.join(frames,String(frame).padStart(4,'0')+'.png')});
  }
  assert.deepEqual(errors,[],'native enemy cover dive has no browser errors');
  if(movieFrames){const r=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(frames,'%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','19','-movflags','+faststart',path.join(out,'enemy-cover-dive.mp4')],{encoding:'utf8'});if(r.error)throw r.error;assert.equal(r.status,0,r.stderr);}
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({cards,motion,errors,movieFrames,fps},null,2));
  console.log(`Native enemy cover dives: ${cards.length} phase cards, ${movieFrames} motion frames. Output: ${out}`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});

// Native p5 preview of the three blast dismemberments, their ballistic parts,
// raining blood/gibs and fast oval pools beside an ordinary slow death pool.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(process.env.VIS_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.EXPLOSION_DEATH_OUT||'/tmp/newone-explosion-deaths';
const frames=path.join(out,'frames');fs.mkdirSync(frames,{recursive:true});
const phases=[0,8,18,36,60,180],deathTypes=[18,19,20],fps=30;
const totalFrames=Number(process.env.EXPLOSION_DEATH_FRAMES||120);
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:2400,height:1510},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(2400,1510);pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('__ready');
  await page.evaluate(()=>{
   resetRunState();resetUndergroundRoute();currentLevel=currentBiome=1;BIOME_ACTIVE=false;
   isStoryMode=false;started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
   window.inNM0SecretOverlay=false;buildGhost=null;nm0AmbushActive=farmAmbushActive=false;
   buildings=activeBuildings=[];activeParkingCars=[];parkingCars=[];barrels=[];enemiesList=[];corpses=[];particles=[];bullets=[];
   invalidateColIndex();setMeleeTool('NONE');jetpackUnlocked=false;jetpackFireExplosion=false;
   chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
   leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
   player=new Character(10000,10000,true);player.currentWeapon=WEAPONS.PISTOL;
   viewLeft=viewTop=-100000;viewRight=viewBottom=100000;zoom=1;camX=camY=0;
   window.setTimeout=()=>0;window.__blastFixtures=[];window.__blastStack={depth:0,minDepth:0};
   const nativePush=window.push,nativePop=window.pop;
   window.push=function(...a){__blastStack.depth++;return nativePush(...a);};
   window.pop=function(...a){__blastStack.depth--;__blastStack.minDepth=Math.min(__blastStack.minDepth,__blastStack.depth);return nativePop(...a);};
   window.__blastUse=f=>{particles=f.particles;corpses=f.corpses;enemiesList=[];useBloodBank(f.bank);};
   window.__blastMake=(dT,index,type='NORMAL',route=null)=>{
    particles=[];corpses=[];bullets=[];enemiesList=[];frameCount++;randomSeed(7110+index);
    useBloodBank('blast-death-'+index+'-'+frameCount);
    const e=new Character(0,0,false,type);e.hp=0;e.dead=true;e.isFriendly=e.isNeutral=false;
    e.aimAngle=e.moveAngle=-Math.PI/2;e.isMoving=false;e.isArmed=true;e.name='';
    e.walkCycle=e.gait=e.muzzleFlash=e.reloadTimer=e.meleeTimer=e.weaponKick=0;
    resetActorStance(e,'STAND');
    let c;
    if(route){
     e.dead=false;e.hp=20;enemiesList=[e];explosionDeathCounter=[18,19,20,5,2,7,10,11].indexOf(dT);
     if(route==='ROCKET')triggerRocketExplosion(-35,-8,true,e,player);
     else triggerExplosion(-35,-8,150,false,true,player);
     c=corpses[0];
     if(!e.dead||!c||c.dT!==dT||!e._killVectorBloodStamped)throw Error(route+' did not use the requested native blast corpse/vector stain');
    }else{
     c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,dT,0,e.decals,e.currentWeapon,.27,type,e.bodyW,e.bodyH,e);
     corpses=[c];
     spawnSplatter(0,0,'BLOOD',color(90,0,0),c,c.blastBlood?'BLAST':undefined);
     stampKillVectorBlood(e,player,0,0);
    }
    if(dT>=18&&(!c.blast||!c.blastBlood))throw Error('New blast death '+dT+' is not installed or has no fast-blood marker');
    const f={dT,type,route,bank:bloodBankId,corpses,particles,c,e,tick:0,
     label:({18:'BOTH LEGS DESTROYED / TORSO THROWN',19:'ONE LEG OFF / BODY THROWN',20:'DIAGONAL SPLIT / FLYING HALVES',0:'ORDINARY DEATH / SLOW POOL'})[dT]};
    __blastFixtures.push(f);return f;
   };
   window.__blastAdvance=(f,toTick)=>{
    __blastUse(f);doTick=true;push();translate(-10000,-10000);
    for(;f.tick<toTick;f.tick++){frameCount++;deltaTime=1000/60;updateCorpses();updateBloodPools();updateParticles();}
    pop();
   };
   window.__blastState=f=>{
    __blastUse(f);
    const b=f.c.blast||f.c.blastDeath||null;
    return {dT:f.c.dT,type:f.type,route:f.route,tick:f.tick,liveCorpses:f.corpses.length,static:!!f.c.isStatic,
     pieces:b&&b.parts?b.parts.map(p=>({x:p.x,y:p.y,z:p.z,rot:p.rot,vx:p.vx,vy:p.vy,vz:p.vz})):[],
     liveParticles:f.particles.length,particleKinds:[...new Set(f.particles.map(p=>p.t))],
     pools:bloodPools.map(p=>({age:p.age,frames:p.frames,hold:p.hold})),stack:{...__blastStack}};
   };
   window.__blastPaint=(f,x,y,magnify=1,showBody=true,bounds=null)=>{
    __blastUse(f);doTick=false;const before=JSON.stringify(__blastState(f));
    if(bounds){drawingContext.save();drawingContext.beginPath();drawingContext.rect(bounds.x,bounds.y,bounds.w,bounds.h);drawingContext.clip();}
    push();translate(x,y);scale(magnify);
    stroke(53,70,69);strokeWeight(.5);
    for(let i=-280;i<=280;i+=32){line(i,-260,i,260);line(-280,i,280,i);}
    drawBloodLayer(false);
    if(showBody){drawBloodLayer(true);for(const c of f.corpses)c.show();for(const p of f.particles)p.show();}
    pop();if(bounds)drawingContext.restore();
    if(JSON.stringify(__blastState(f))!==before)throw Error('Death painting changed simulation state');
    return __blastState(f);
   };
   window.__blastBack=(title,subtitle)=>{
    background(28,41,45);noStroke();textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);
    fill(236,242,228);textSize(23);text(title,width/2,16);fill(165,194,185);textSize(12);text(subtitle,width/2,49);
   };
  });
  const overview=await page.evaluate(({deathTypes,phases})=>{
   __blastBack('EXPLOSION DEATHS / BALLISTIC DISMEMBERMENT','The actual native corpse painter at 0.8×. Parts fly above their floor shadows, then land and bake into the body layer.');
   const records=[];
   for(let row=0;row<deathTypes.length;row++){
    const f=__blastMake(deathTypes[row],row,row===2?'ARMORED_STANDARD':'NORMAL');
    for(let col=0;col<phases.length;col++){
     __blastAdvance(f,phases[col]);const x=col*400,y=86+row*470;
     noStroke();fill(19,31,34);rect(x+7,y,386,454,10);
     textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(11);fill(204,225,214);text(f.label,x+200,y+13);
     fill(150,185,172);text('+'+f.tick+' TICKS / '+(f.tick/60).toFixed(2)+' s',x+200,y+32);
     records.push(__blastPaint(f,x+95,y+230,.8,true,{x:x+8,y:y+55,w:384,h:395}));
    }
   }
   return records;
  },{deathTypes,phases});
  assert(overview.every(r=>r.stack.depth===0&&r.stack.minDepth===0),'native death painters balance p5 transforms');
  await page.locator('canvas').first().screenshot({path:path.join(out,'explosion-deaths-native-phases.png')});
  const detail=[];
  await page.setViewportSize({width:1800,height:2110});
  for(let i=0;i<deathTypes.length;i++){
   const result=await page.evaluate(({dT,index})=>{
     resizeCanvas(1800,2110);const f=__blastMake(dT,20+index,index===2?'ARMORED_STANDARD':'NORMAL');
    __blastBack(f.label+' / NATIVE PAINTER AT 2×','One corpse and its actual blood/gib effects. Forward and backward surfaces keep the victim’s original clothing and anatomy.');
    const records=[];
    for(let j=0;j<4;j++){
     const age=[0,12,28,90][j];__blastAdvance(f,age);const x=(j%2)*900,y=85+Math.floor(j/2)*1000;
     noStroke();fill(19,31,34);rect(x+8,y,884,984,10);fill(204,225,214);textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(13);text('+'+age+' TICKS',x+450,y+15);
     records.push(__blastPaint(f,x+260,y+420,2,true,{x:x+9,y:y+45,w:882,h:936}));
    }return records;
   },{dT:deathTypes[i],index:i});detail.push(result);
   await page.locator('canvas').first().screenshot({path:path.join(out,'death-'+deathTypes[i]+'-2x.png')});
  }
  await page.setViewportSize({width:1600,height:900});
  const pools=await page.evaluate(()=>{
   resizeCanvas(1600,900);__blastBack('FLOOR POOLS / BLAST VERSUS ORDINARY DEATH','Blast pools spread after a brief hold. Ordinary-death pools retain the long delay that exposes their directional vector splatter.');
   const blast=__blastMake(18,40),ordinary=__blastMake(0,41),records=[];
   for(let row=0;row<2;row++){
    const f=row?ordinary:blast;
    for(let col=0;col<4;col++){
     __blastAdvance(f,[6,18,54,180][col]);const x=col*400,y=86+row*400;
     noStroke();fill(19,31,34);rect(x+7,y,386,382,10);fill(204,225,214);textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(12);
     text((row?'ORDINARY':'BLAST')+' / +'+f.tick+' TICKS',x+200,y+15);records.push(__blastPaint(f,x+200,y+215,2,false,{x:x+8,y:y+45,w:384,h:334}));
    }
   }return records;
  });
  await page.locator('canvas').first().screenshot({path:path.join(out,'explosion-pools-versus-ordinary.png')});
  await page.setViewportSize({width:1800,height:950});
  await page.evaluate(deathTypes=>{resizeCanvas(1800,950);window.__blastMovie=deathTypes.map((dT,i)=>__blastMake(dT,60+i,i===2?'ARMORED_STANDARD':'NORMAL',i===1?'ROCKET':'GRENADE'));},deathTypes);
  let motion;
  for(let frame=0;frame<totalFrames;frame++){
   motion=await page.evaluate(frame=>{
    __blastBack('EXPLOSION DEATHS / ONE DEATH THROUGH LANDING','Actual grenade / rocket / grenade kills at 60 ticks/second. The same three bodies fly, shed blood/gibs, land and settle.');
    return __blastMovie.map((f,i)=>{
     __blastAdvance(f,frame*2);const x=i*600,y=86;noStroke();fill(19,31,34);rect(x+8,y,584,842,10);
     textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(13);fill(204,225,214);text(f.label,x+300,y+18);fill(148,183,172);text('+'+f.tick+' TICKS / '+(f.tick/60).toFixed(2)+' s',x+300,y+40);
     return __blastPaint(f,x+170,y+465,1.4,true,{x:x+9,y:y+70,w:582,h:768});
    });
   },frame);
   assert(motion.every(r=>r.stack.depth===0&&r.stack.minDepth===0),'motion painters balance transforms');
   await page.locator('canvas').first().screenshot({path:path.join(frames,String(frame).padStart(4,'0')+'.png')});
  }
  assert.deepEqual(errors,[],'native explosion deaths produce no browser errors');
  if(totalFrames){
   const encoded=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(frames,'%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',path.join(out,'explosion-deaths.mp4')],{encoding:'utf8'});
   if(encoded.error)throw encoded.error;assert.equal(encoded.status,0,encoded.stderr);
  }
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({overview,detail,pools,motion,errors,fps,totalFrames},null,2));
  console.log(`Three native explosion deaths, ${overview.length} timed phases, fast/ordinary pool comparison and ${totalFrames} motion frames rendered. Previews: ${out}`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});

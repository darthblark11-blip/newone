// Native explosion routes and the pooled cel painter: ground projection,
// rising volume, fire/blue palettes, violent strokes and finite retirement.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.CEL_EXPLOSION_OUT||'/tmp/newone-cel-explosions';
const frames=path.join(out,'frames');fs.mkdirSync(frames,{recursive:true});
const phases=[0,3,8,16,28,42],kinds=['GRENADE','ROCKET','BLUE DASH','LEGACY FIRE'];
const fps=30,totalFrames=Number(process.env.CEL_EXPLOSION_FRAMES||120);
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:2400,height:1530},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(2400,1530);pixelDensity(1);noLoop();window.__ready=true;};</script>');
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
   window.setTimeout=()=>0;window.__celFixtures=[];window.__celCurrent=null;
   window.__celStack={depth:0,minDepth:0};window.__celGeometry={softBlob:0,vertices:0,strokeWeights:[],ellipses:[]};
   const nativePush=window.push,nativePop=window.pop,nativePaint=Particle.prototype.paint;
   window.push=function(...a){__celStack.depth++;return nativePush(...a);};
   window.pop=function(...a){__celStack.depth--;__celStack.minDepth=Math.min(__celStack.minDepth,__celStack.depth);return nativePop(...a);};
   Particle.prototype.paint=function(...a){const before=__celCurrent;__celCurrent=this.t;try{return nativePaint.apply(this,a);}finally{__celCurrent=before;}};
   const originalBlob=window.softBlob,originalVertex=window.vertex,originalWeight=window.strokeWeight,originalEllipse=window.ellipse;
   window.softBlob=function(...a){if(__celCurrent==='CEL_EXPLOSION')__celGeometry.softBlob++;return originalBlob(...a);};
   window.vertex=function(...a){if(__celCurrent==='CEL_EXPLOSION')__celGeometry.vertices++;return originalVertex(...a);};
   window.strokeWeight=function(w,...a){if(__celCurrent==='CEL_EXPLOSION')__celGeometry.strokeWeights.push(w);return originalWeight(w,...a);};
   window.ellipse=function(x,y,w,h=w,...a){if(__celCurrent==='CEL_EXPLOSION')__celGeometry.ellipses.push({w,h});return originalEllipse(x,y,w,h,...a);};
   window.__celUse=f=>{particles=f.particles;corpses=f.corpses;enemiesList=[];useBloodBank(f.bank);};
   window.__celMake=(kind,index,withKill=false)=>{
    particles=[];corpses=[];bullets=[];enemiesList=[];player.x=player.y=10000;
    frameCount++;randomSeed(1770+index);useBloodBank('cel-explosion-'+index+'-'+frameCount);
    if(withKill){
     const e=new Character(-65,105,false,'NORMAL');e.hp=20;e.isFriendly=e.isNeutral=false;e.aimAngle=-Math.PI/2;
     enemiesList=[e];const b=spawnBullet(e.x-90,e.y,0,true,'BODY',WEAPONS.PISTOL,player);doTick=true;
     push();translate(-10000,-10000);for(let i=0;i<16&&b.active;i++){frameCount++;updateBullets();}
     for(let i=0;i<60;i++){frameCount++;deltaTime=1000/60;updateCorpses();updateBloodPools();updateParticles();}pop();
     if(!e.dead||!e._killVectorBloodStamped)throw Error('Phone fixture needs an actual fatal projectile and vector stain');
     enemiesList=[];
    }
    doTick=true;frameCount++;
    if(kind==='GRENADE')triggerExplosion(0,0,130,false,true,player);
    else if(kind==='ROCKET')triggerRocketExplosion(0,0,true,null,player);
    else if(kind==='BLUE DASH'){
     player.x=player.y=0;player.hp=player.maxHp;player.dead=false;player.dashTimer=1;player.lastMoveAngle=0;
     player.meleeTimer=player.reloadTimer=player.muzzleFlash=player.fireTimer=0;
     resetActorStance(player,'STAND');jetpackFireExplosion=true;deltaTime=1000/60;player.updatePlayer();
     jetpackFireExplosion=false;player.x=player.y=10000;
    }else emit(0,0,40,color(255,100,0),'EXPLOSION',0,0,player);
    const fx=particles.find(p=>p.t==='CEL_EXPLOSION');
    if(!fx)throw Error('Native '+kind+' route did not create a coherent cel explosion');
    const reference=new Character(fx.x+82,fx.y+45,false,'NORMAL');reference.aimAngle=-Math.PI/2;
    reference.isArmed=true;reference.isMoving=false;reference.name='';
    const types={};for(const p of particles)types[p.t]=(types[p.t]||0)+1;
    const f={kind,bank:bloodBankId,particles,corpses,reference,x:fx.x,y:fx.y,tick:0,types,fx,
     initial:{count:particles.length,sz:fx.sz,material:fx.fxMaterial,life:fx.fxLife},withKill};
    __celFixtures.push(f);return f;
   };
   window.__celAdvance=(f,toTick)=>{
    __celUse(f);doTick=true;push();translate(-10000,-10000);
    for(;f.tick<toTick;f.tick++){frameCount++;deltaTime=1000/60;if(f.withKill){updateCorpses();updateBloodPools();}updateParticles();}
    pop();
   };
   window.__celPaint=(f,x,y,magnify=1,reference=true)=>{
    __celUse(f);doTick=false;push();translate(x,y);scale(magnify);translate(-f.x,-f.y);
    stroke(44,59,62);strokeWeight(.5);
    for(let i=-160;i<=160;i+=32){line(f.x+i,f.y-160,f.x+i,f.y+160);line(f.x-160,f.y+i,f.x+160,f.y+i);}
    drawBloodChunks();if(reference)f.reference.show();for(const c of f.corpses)c.show();updateParticles();pop();
    return {tick:f.tick,live:f.particles.length,stack:{...__celStack}};
   };
   window.__celBack=(title,subtitle)=>{
    background(26,39,44);noStroke();textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);
    fill(235,240,226);textSize(23);text(title,width/2,16);fill(166,193,186);textSize(12);text(subtitle,width/2,49);
   };
   window.__celPixels=f=>{
    clear();__celUse(f);doTick=false;push();translate(400-f.x,400-f.y);f.fx.show();pop();
    const pixels=drawingContext.getImageData(0,0,width,height).data;
    let ink=0,yellow=0,orange=0,blue=0,painted=0,minX=width,minY=height,maxX=-1,maxY=-1;
    for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<20)continue;
     const r=pixels[i],g=pixels[i+1],b=pixels[i+2],x=(i/4)%width,y=Math.floor(i/4/width);
     painted++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
     if(Math.max(r,g,b)<105)ink++;if(r>190&&g>150&&b<155)yellow++;
     if(r>180&&g>45&&g<180&&b<110)orange++;if(b>150&&b>r*1.3)blue++;
    }
    return {painted,ink,yellow,orange,blue,bounds:{minX,maxX,minY,maxY},above:400-minY,below:maxY-400};
   };
  });
  const routes=await page.evaluate(kinds=>kinds.map((kind,index)=>{
   const f=__celMake(kind,index);return {kind,types:f.types,initial:f.initial};
  }),kinds);
  for(const r of routes){
   assert.equal(r.types.CEL_EXPLOSION,1,r.kind+' creates one coherent cloud');
   assert(!r.types.EXPLOSION,'legacy explosion puffs are consolidated');
   if(r.kind==='GRENADE'||r.kind==='ROCKET')assert(!r.types.SMOKE,'main blast avoids a separate gray smoke cloud');
   assert(r.initial.sz>=28&&r.initial.sz<=105);assert.equal(r.initial.life,48);
   assert.equal(r.initial.material,r.kind==='BLUE DASH'?'BLUE':'FIRE');
  }
  const overview=await page.evaluate(({phases,kinds})=>{
   __celBack('CEL EXPLOSIONS / REAL ROUTES AT NATIVE SCALE','Each row fires once. Ground plane, reference figure and the full native effect show footprint and rising volume.');
   const records=[];
   for(let row=0;row<kinds.length;row++){
    const f=__celFixtures[row];
    for(let col=0;col<phases.length;col++){
     __celAdvance(f,phases[col]);const x=col*400,y=86+row*355;
     noStroke();fill(18,29,34);rect(x+7,y,386,338,10);
     textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(12);fill(195,218,209);text(f.kind+' / +'+f.tick+' TICKS',x+200,y+12);
     records.push({kind:f.kind,...__celPaint(f,x+200,y+215,1)});
    }
   }
   return {records,geometry:{...__celGeometry}};
  },{phases,kinds});
  assert(overview.geometry.ellipses.some(e=>e.w>e.h*2.5),'blast footprint projects as a flattened ellipse on the floor');
  assert(Math.max(...overview.geometry.strokeWeights)>=3,'blast includes bold ink strokes at native scale');
  await page.locator('canvas').first().screenshot({path:path.join(out,'explosions-native-phases.png')});
  const enlarged=[];
  for(let i=0;i<kinds.length;i++){
   const result=await page.evaluate(({kind,index,phases})=>{
    resizeCanvas(2400,1330);__celBack(kind+' / NATIVE CEL PAINTER AT 2×','One actual effect, advanced to each shown age. Sharp rays, lobe shadows and hot caps share the same pooled renderer.');
    const f=__celMake(kind,20+index),records=[];
    for(let j=0;j<phases.length;j++){
     __celAdvance(f,phases[j]);const x=(j%3)*800,y=86+Math.floor(j/3)*610;
     noStroke();fill(18,29,34);rect(x+8,y,784,592,10);
     textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(14);fill(195,218,209);text('+'+f.tick+' TICKS',x+400,y+15);
     records.push(__celPaint(f,x+400,y+388,2));
    }
    return {kind,records};
   },{kind:kinds[i],index:i,phases});
   enlarged.push(result);await page.setViewportSize({width:2400,height:1330});
   await page.locator('canvas').first().screenshot({path:path.join(out,kinds[i].toLowerCase().replaceAll(' ','-')+'-2x.png')});
  }
  const materials=await page.evaluate(kinds=>{
   resizeCanvas(1200,1000);return kinds.map((kind,i)=>{const f=__celMake(kind,40+i);__celAdvance(f,16);return {kind,...__celPixels(f)};});
  },kinds);
  for(const m of materials){assert(m.painted>400,'coherent cloud paints a readable native area');assert(m.ink>20,'cel explosion includes dark ink/shadow');
   assert(m.above>m.below*1.25,'rising blast volume extends above its fixed floor anchor');
   if(m.kind==='BLUE DASH')assert(m.blue>100,'blue finisher retains its blue energy palette');
   else{assert(m.yellow>80,'fire explosion has a vivid hot yellow region');assert(m.orange>80,'fire explosion has saturated orange volume');}
  }
  const phone=await page.evaluate(()=>{
   resizeCanvas(393,820);__celBack('GRENADE / PHONE SCALE','Existing corpse, slow pool and fixed kill splatter.');
   const f=__celMake('GRENADE',60,true);__celAdvance(f,8);__celPaint(f,196,338,1);
   fill(48);noStroke();rect(20,80,200,15,4);fill(220,30,30);rect(20,80,166,15,4);
   fill(0,200,255);rect(20,104,130,8,4);textFont('sans-serif');textStyle(NORMAL);textAlign(LEFT,TOP);textSize(11);fill(225);text('17 / 4',24,146);
   return {types:f.types,initial:f.initial,...__celStack};
  });
  await page.setViewportSize({width:393,height:820});await page.locator('canvas').first().screenshot({path:path.join(out,'explosion-phone-floor-stain.png')});
  assert.equal(phone.depth,0);assert.equal(phone.minDepth,0);
  await page.setViewportSize({width:1800,height:1100});
  await page.evaluate(kinds=>{resizeCanvas(1800,1100);window.__celMovie=kinds.map((kind,i)=>__celMake(kind,80+i));},kinds);
  let motion;
  for(let frame=0;frame<totalFrames;frame++){
   motion=await page.evaluate(frame=>{
    __celBack('CEL EXPLOSIONS / ONE SHOT THROUGH RETIREMENT','Each route triggers once at the beginning. Native scale and 1.7× detail; the coherent clouds retire without repeat spawns.');
    const records=[];
    for(let i=0;i<__celMovie.length;i++){
     const f=__celMovie[i],x=450+(i%2)*900,y=260+Math.floor(i/2)*500;
     __celAdvance(f,frame*2);noStroke();fill(18,29,34);rect(x-438,y-145,876,462,10);
     textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(13);fill(195,218,209);text(f.kind+' / +'+f.tick+' TICKS',x,y-125);
     __celPaint(f,x-240,y+90,1);__celPaint(f,x+160,y+90,1.7);
     records.push({kind:f.kind,tick:f.tick,live:f.particles.length,cel:f.particles.filter(p=>p.t==='CEL_EXPLOSION').length});
    }
    return {records,stack:{...__celStack},pool:_particlePool.length,poolMax:PARTICLE_POOL_MAX,geometry:{...__celGeometry}};
   },frame);
   assert.equal(motion.stack.depth,0);assert.equal(motion.stack.minDepth,0);assert(motion.pool<=motion.poolMax);
   for(const r of motion.records)assert(r.cel<=1,'an explosion cannot silently respawn its coherent cloud');
   await page.locator('canvas').first().screenshot({path:path.join(frames,String(frame).padStart(4,'0')+'.png')});
  }
  assert.deepEqual(errors,[],'native explosion renderer has no page errors');
  if(totalFrames){
   assert(motion.records.every(r=>r.live===0),'all particles from the single explosions retire');
   assert.equal(motion.geometry.softBlob,0,'coherent cel clouds do not use the old soft oval painter');
   const encoded=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(frames,'%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',path.join(out,'cel-explosions.mp4')],{encoding:'utf8'});
   if(encoded.error)throw encoded.error;assert.equal(encoded.status,0,encoded.stderr);
  }
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({routes,overview,enlarged,materials,phone,motion,errors,fps,totalFrames},null,2));
  console.log(`${routes.length} native explosion routes, ${overview.records.length} timed phases, fire/blue palette and phone-floor checks, ${totalFrames} motion frames passed. Previews: ${out}`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});

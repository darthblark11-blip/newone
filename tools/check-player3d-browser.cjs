// Real p5 + WebGL2 regression and visual review; serves all inputs locally.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(process.env.GAME_JS||path.join(root,'game.js'),'utf8');
const p5=fs.readFileSync(process.env.PLAYER3D_P5||'/workspace/.environment/newone/node_modules/p5/lib/p5.min.js','utf8');
const out=process.env.PLAYER3D_OUT||'/tmp/player3d-qa';fs.mkdirSync(out,{recursive:true});
const bootstrap=`preload=function(){};setup=function(){createCanvas(1200,1000);pixelDensity(1);noLoop();window.__ready=true;};draw=function(){};windowResized=function(){};`;
async function main(){
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:1200,height:1000},deviceScaleFactor:1});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.stack||String(e)));
 await page.route('http://player3d.local/**',r=>{
  const url=r.request().url();
  if(url.endsWith('/p5.js'))return r.fulfill({contentType:'application/javascript',body:p5});
  if(url.endsWith('/game.js'))return r.fulfill({contentType:'application/javascript',body:source});
  const init=url.includes('/world')?'preload=function(){};':bootstrap;
  return r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0;background:#a8b0a6}canvas{display:block}</style><script src="/p5.js"></script><script src="/game.js"></script><script>'+init+'</script>'});
 });
 try{
  await page.goto('http://player3d.local/',{waitUntil:'load'});await page.waitForFunction(()=>window.__ready);
  const result=await page.evaluate(()=>{
   started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
   inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
   currentLevel=currentBiome=2;BIOME_ACTIVE=false;window.inNM0SecretOverlay=false;buildGhost=null;
   resetUndergroundRoute();setMeleeTool('NONE');
   leftStick={active:true,dx:1,dy:0,dist:1};rightStick={active:true,dx:1,dy:0,dist:1};
   camX=camY=0;zoom=1;viewLeft=viewTop=-100000;viewRight=viewBottom=100000;
   LIGHT_DX=.7;LIGHT_DY=.7;
   window.__fresh3D=()=>{
    chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
    setMeleeTool('NONE');player=new Character(0,0,true);player.isArmed=true;player.isMoving=true;
    player.aimAngle=.3;player.moveAngle=1.8;player.gait=.6;player.walkCycle=.9;player.aimHold=14;
    player.reloadTimer=player.meleeTimer=player.dashTimer=player.muzzleFlash=player.skeletonTimer=0;
    player.currentWeapon=WEAPONS.PISTOL;resetActorStance(player,'STAND');return player;
   };__fresh3D();
   const ready=Player3D.ensure();
   clear();push();translate(300,300);scale(4);const drawn=Player3D.draw(player3DPose(player),drawingContext);pop();
   const pixels=drawingContext.getImageData(0,0,width,height).data;
   let opaque=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>20)opaque++;
   const head=player3DPose(player).sockets.head;
   const sampleHead=()=>Array.from(drawingContext.getImageData(Math.round(300+head.x*4),Math.round(300+head.y*4),1,1).data);
   const cleanHead=sampleHead();
   player.decals=[{x:0,y:0,sz:6,isHead:true,col:[255,0,0,255]}];
   clear();push();translate(300,300);scale(4);Player3D.draw(player3DPose(player),drawingContext);pop();
   const stainedHead=sampleHead(),woundVisible=stainedHead[1]<cleanHead[1]-20;player.decals=[];
   player.hitFlash=1;clear();push();translate(300,300);scale(4);Player3D.draw(player3DPose(player),drawingContext);pop();
   const flashPixels=drawingContext.getImageData(0,0,width,height).data;let flashDelta=0;
   for(let i=0;i<pixels.length;i+=4)flashDelta+=Math.abs(pixels[i]-flashPixels[i])+Math.abs(pixels[i+1]-flashPixels[i+1])+Math.abs(pixels[i+2]-flashPixels[i+2]);
   const flashVisible=flashDelta>1000;player.hitFlash=0;
   const clip=(right)=>{clear();drawingContext.save();drawingContext.beginPath();drawingContext.rect(0,0,300,600);drawingContext.clip();
    push();translate(300,300);scale(4);Player3D.draw(player3DPose(player),drawingContext);pop();drawingContext.restore();
    const d=drawingContext.getImageData(right?300:0,0,300,600).data;let count=0;for(let i=3;i<d.length;i+=4)if(d[i]>20)count++;return count;};
   const outsideClip=clip(true),insideClip=clip(false);
   const g=createGraphics(240,240);g.pixelDensity(1);g.clear();g.push();g.translate(120,120);g.scale(2);
   const graphicsDrawn=Player3D.draw(player3DPose(player),g.drawingContext);g.pop();
   const gd=g.drawingContext.getImageData(0,0,240,240).data;let graphicsPixels=0;for(let i=3;i<gd.length;i+=4)if(gd[i]>20)graphicsPixels++;g.remove();
   background(168,176,166);textFont('sans-serif');const cases=[];
   const drawCase=(name,setup,index)=>{__fresh3D();setup();const count=Player3D.stats.draws||0;
    drawingContext.save();drawingContext.beginPath();drawingContext.rect((index%5)*240,Math.floor(index/5)*240,240,240);drawingContext.clip();
    push();translate(120+(index%5)*240,145+Math.floor(index/5)*240);scale(2.6);player.show();pop();drawingContext.restore();
    const used=(Player3D.stats.draws||0)>count;push();fill(25);noStroke();textSize(13);textAlign(CENTER);text(name,120+(index%5)*240,230+Math.floor(index/5)*240);pop();cases.push({name,used});};
   const specs=[['Pistol',()=>{}],['Rifle',()=>{player.currentWeapon=WEAPONS.ASSAULT_RIFLE;}],['Shotgun',()=>{player.currentWeapon=WEAPONS.SHOTGUN;}],['Bow',()=>{player.currentWeapon=WEAPONS.BOW;}],['Dual SMG',()=>{player.currentWeapon=WEAPONS.DUAL_SMG;}],
    ['Crouch',()=>{resetActorStance(player,'CROUCH');}],['Prone',()=>{resetActorStance(player,'PRONE');}],['Armor',()=>{explosiveArmorUnlocked=true;}],['Chemist',()=>{chemistSuitUnlocked=true;}],['Ninja',()=>{ninjaSuitUnlocked=true;}],
    ['Cowboy',()=>{cowboySuitEquipped=true;}],['Jetpack',()=>{jetpackUnlocked=true;}],['Boxing',()=>{boxingEnter(player,[],'WORLD');}],['Sword',()=>{swordPickedUp=true;setMeleeTool('SWORD');}],['Reload',()=>{player.reloadTimer=30;}]];
   specs.forEach((s,i)=>drawCase(s[0],s[1],i));
   __fresh3D();push();translate(120,865);scale(2.6);const beforeCorpse=Player3D.stats.draws||0;
   const corpse=new Corpse(0,0,0,0,player.shirtCol,player.pantsCol,0,0,[],WEAPONS.PISTOL,0,player.eType,player.bodyW,player.bodyH,player);
   corpse.paint(window);pop();cases.push({name:'Corpse',used:(Player3D.stats.draws||0)>beforeCorpse});
   __fresh3D();const beforeFallback=Player3D.stats.draws||0;Player3D.enabled=false;push();translate(360,865);scale(2.6);player.show();pop();Player3D.enabled=true;
   const fallback=(Player3D.stats.draws||0)===beforeFallback;
   push();fill(25);noStroke();textSize(13);textAlign(CENTER);text('Corpse',120,950);text('Native fallback',360,950);pop();
   const gpu=Player3D.gl;const gpuError=gpu?gpu.getError():null;
   // Measure in a scratch target so timing draws cannot mark the review sheet.
   const scratch=createGraphics(240,240);scratch.translate(100,100);
   for(let i=0;i<10;i++)Player3D.draw(player3DPose(player),scratch.drawingContext);
   const uploadsBefore=Player3D.stats.meshUploads;const samples=[];
   for(let i=0;i<35;i++){player.walkCycle=i*.17;const t=performance.now();Player3D.draw(player3DPose(player),scratch.drawingContext);samples.push(performance.now()-t);}
   const uploadsAfter=Player3D.stats.meshUploads;samples.sort((a,b)=>a-b);
   GLRig.on=false;const independent=Player3D.draw(player3DPose(player),scratch.drawingContext);scratch.remove();
   window.__restoreScene=()=>{background(168,176,166);__fresh3D();};
   return {ready,drawn,opaque,woundVisible,flashVisible,outsideClip,insideClip,graphicsDrawn,graphicsPixels,cases,fallback,gpuError,independent,uploadsBefore,uploadsAfter,stats:{...Player3D.stats},cpuMs:{median:samples[17],p95:samples[33]},sourceBytes:0};
  });
  await page.screenshot({path:path.join(out,'player-contact-sheet.png')});
  assert.ok(result.ready&&result.drawn&&result.opaque>100,'real WebGL mesh produces visible pixels');
  assert.ok(result.woundVisible,'head wounds remain visible on the mesh');assert.ok(result.flashVisible,'damage produces a visible transient flash');
  assert.equal(result.outsideClip,0,'current Canvas clip is honored');assert.ok(result.insideClip>0,'visible half survives clipping');
  assert.ok(result.graphicsDrawn&&result.graphicsPixels>100,'p5.Graphics corpse targets work');
  for(const row of result.cases)assert.ok(row.used,'native '+row.name+' uses 3D');
  assert.ok(result.fallback,'disabled renderer preserves native path');assert.ok(result.independent,'mesh renderer works with deferred world lighting disabled');
  assert.equal(result.uploadsAfter,result.uploadsBefore,'recurring animation reuses GPU meshes');
  assert.ok(result.gpuError===null||result.gpuError===0,'no WebGL errors');
  const loss=await page.evaluate(()=>{const ext=Player3D.gl?.getExtension('WEBGL_lose_context');if(!ext)return {supported:false};window.__lossExt=ext;ext.loseContext();return {supported:true};});
  if(loss.supported){
   await page.waitForTimeout(80);loss.fallback=await page.evaluate(()=>Player3D.draw(player3DPose(player),drawingContext)===false);
   await page.evaluate(()=>window.__lossExt.restoreContext());
   await page.waitForFunction(()=>Player3D.ensure(),{},{timeout:15000});
   loss.restored=await page.evaluate(()=>Player3D.draw(player3DPose(player),drawingContext));
   assert.ok(loss.fallback&&loss.restored,'context loss falls back and restoration recovers');
  }
  // A short real-mesh motion sequence can be encoded without browser video setup.
  const frames=path.join(out,'motion');fs.mkdirSync(frames,{recursive:true});
  for(let i=0;i<24;i++){
   await page.evaluate(i=>{__restoreScene();player.aimAngle=i*Math.PI/12;player.moveAngle=player.aimAngle+1.4;player.walkCycle=i*.35;
    push();translate(width/2,height/2);scale(6);player.show();pop();},i);
   await page.screenshot({path:path.join(frames,String(i).padStart(3,'0')+'.png')});
  }
  // Exercise the real game setup/draw and native world compositor as well.
  await page.goto('http://player3d.local/world',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof width==='number'&&width>0&&!!document.querySelector('canvas'));
  result.world=await page.evaluate(()=>{
   noLoop();randomSeed(7);noiseSeed(BIOME_SEED);isStoryMode=true;started=true;isDead=isWin=isPaused=false;
   window.outpostForts={};seedWorldClock();startAtLevel(3);
   inStoryIntro=inStoryRoom=killcamMode=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=inTravelMenu=inOverworldView=false;
   window.showOnScreenControls=false;window.isDesktop=true;leftStick.active=rightStick.active=false;
   player.x=1300;player.y=-1730;player.aimAngle=-Math.PI/2;player.isArmed=true;player.aimHold=14;
   worldTimeMs=13/24*DAY_MS;updateSunVector();
   chunkMgr.update(player.x,player.y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();lastActiveUpdate=-100;updateActiveWorld();
   const before=Player3D.stats.draws;
   for(let i=0;i<3;i++){zoom=(1.7-.065)/.9;camX=player.x-width/3.4;camY=player.y-height/3.4;frameCount++;draw();}
   return {meshDraws:Player3D.stats.draws-before,mesh:Player3D.getDiagnostics(),fault:window.FRAME_FAULT||null,worldLighting:{ok:GLRig.ok,on:GLRig.on,failure:GLRig.failure}};
  });
  await page.screenshot({path:path.join(out,'player-in-game.png')});
  assert.ok(result.world.meshDraws>0&&!result.world.fault,'real game world draws the 3D player');
  assert.deepEqual(errors,[],'no uncaught browser errors');result.contextLoss=loss;result.sourceBytes=Buffer.byteLength(source);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

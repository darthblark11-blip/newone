// Exercise the actual shader -> WebGL drawing buffer -> Canvas2D transfer.
// Fault injection reproduces silent blank output, rather than throwing a JS
// exception that the pre-existing native fallback already handled.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(process.env.GAME_JS||path.join(root,'game.js'),'utf8');
const p5=fs.readFileSync(process.env.PLAYER3D_P5||'/workspace/.environment/newone/node_modules/p5/lib/p5.min.js','utf8');
const out=process.env.PLAYER3D_TRANSFER_OUT||'/tmp/player3d-transfer-qa';
const bootstrap='preload=function(){};setup=function(){createCanvas(720,720);pixelDensity(1);noLoop();window.__ready=true;};draw=function(){};windowResized=function(){};';
async function main(){
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:720,height:720},deviceScaleFactor:1}),errors=[];
 await context.addInitScript(()=>{
  const gpuCanvases=new WeakSet(),nativeContext=HTMLCanvasElement.prototype.getContext;
  window.__transferFault=new URL(location.href).searchParams.get('fault')||'';
  window.__transferCalls={contexts:0,readbacks:0,finishes:0,draws:0,imports:0};
  HTMLCanvasElement.prototype.getContext=function(kind,...args){
   const gl=nativeContext.call(this,kind,...args);
   if(!gl||kind!=='webgl2'||gpuCanvases.has(this))return gl;
   gpuCanvases.add(this);__transferCalls.contexts++;
   let pendingError=0;
   const draw=gl.drawElements.bind(gl),read=gl.readPixels.bind(gl),error=gl.getError.bind(gl),finish=gl.finish.bind(gl);
   gl.drawElements=function(...values){
    __transferCalls.draws++;
    if(__transferFault==='no-fragments')return;
    if(__transferFault==='gl-error')pendingError=gl.INVALID_OPERATION;
    return draw(...values);
   };
   gl.readPixels=function(...values){__transferCalls.readbacks++;return read(...values);};
   gl.getError=function(){if(pendingError){const result=pendingError;pendingError=0;return result;}return error();};
   gl.finish=function(...values){__transferCalls.finishes++;return finish(...values);};
   return gl;
  };
  const copy=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(...args){
   if(gpuCanvases.has(args[0])){
    __transferCalls.imports++;
    if(__transferFault==='no-canvas-import')return;
   }
   return copy.apply(this,args);
  };
 });
 await context.route('http://transfer-qa.local/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/p5.js')return route.fulfill({contentType:'application/javascript',body:p5});
  if(url.pathname==='/game.js')return route.fulfill({contentType:'application/javascript',body:source});
  return route.fulfill({contentType:'text/html',body:'<!doctype html><script src="/p5.js"></script><script src="/game.js"></script><script>'+bootstrap+'</script>'});
 });
 const pages=[];
 async function open(fault=''){
  const page=await context.newPage();pages.push(page);page.on('pageerror',error=>errors.push(error.stack||String(error)));
  await page.goto('http://transfer-qa.local/?fault='+fault,{waitUntil:'load'});await page.waitForFunction(()=>window.__ready);
  await page.evaluate(()=>{
   started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
   inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
   currentLevel=currentBiome=2;BIOME_ACTIVE=false;window.inNM0SecretOverlay=false;buildGhost=null;
   resetUndergroundRoute();setMeleeTool('NONE');
   chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
   leftStick={active:true,dx:1,dy:0,dist:1};rightStick={active:true,dx:1,dy:0,dist:1};
   camX=camY=0;zoom=1;viewLeft=viewTop=-100000;viewRight=viewBottom=100000;
   player=new Character(0,0,true);player.isArmed=true;player.isMoving=true;
   player.aimAngle=.3;player.moveAngle=1.8;player.gait=.6;player.walkCycle=.9;player.aimHold=14;
   player.reloadTimer=player.meleeTimer=player.dashTimer=player.muzzleFlash=player.skeletonTimer=0;
   player.currentWeapon=WEAPONS.PISTOL;resetActorStance(player,'STAND');
   window.__visiblePixels=()=>{const data=drawingContext.getImageData(0,0,width,height).data;let count=0;
    for(let i=3;i<data.length;i+=4)if(data[i]>20)count++;return count;};
   window.__drawMesh=(scale=3)=>{clear();push();translate(360,360);window.scale(scale);
    const drawn=Player3D.draw(player3DPose(player),drawingContext);pop();
    return {drawn,pixels:__visiblePixels(),diagnostics:Player3D.getDiagnostics(),calls:{...__transferCalls}};};
  });
  return page;
 }
 try{
  const page=await open(),healthy=await page.evaluate(()=>__drawMesh());
  assert.ok(healthy.drawn&&healthy.pixels>100,'healthy shader and Canvas transfer produce a visible character');
  assert.equal(healthy.diagnostics.pipeline.profile,'single-sample');
  assert.equal(healthy.diagnostics.pipeline.validation,'verified');
  assert.equal(healthy.diagnostics.pipeline.stage,'ready');
  assert.ok(healthy.diagnostics.pipeline.gpuPixels>0&&healthy.diagnostics.pipeline.canvasPixels>0);
  assert.equal(healthy.diagnostics.context.contextAttributes.antialias,false,'character context avoids the per-actor MSAA resolve');
  assert.equal(healthy.calls.contexts,1,'validation uses the actual character context');
  const stable=await page.evaluate(()=>{
   const before={calls:{...__transferCalls},uploads:Player3D.stats.meshUploads,buffers:Player3D.stats.bufferCreates,checks:Player3D.getDiagnostics().pipeline.checks};
   for(let i=0;i<100;i++)__drawMesh();
   return {before,after:{calls:{...__transferCalls},uploads:Player3D.stats.meshUploads,buffers:Player3D.stats.bufferCreates,diagnostics:Player3D.getDiagnostics()}};
  });
  assert.equal(stable.after.calls.readbacks,stable.before.calls.readbacks,'steady actor drawing performs no readback');
  assert.equal(stable.after.calls.finishes,0,'no gl.finish is introduced');
  assert.equal(stable.after.uploads,stable.before.uploads,'steady animation reuses uploaded meshes');
  assert.equal(stable.after.buffers,stable.before.buffers,'steady animation creates no GPU buffers');
  assert.equal(stable.after.diagnostics.pipeline.checks,stable.before.checks,'health validation stays outside the actor hot path');
  const resized=await page.evaluate(()=>__drawMesh(10));
  assert.ok(resized.drawn&&resized.diagnostics.pipeline.checks>healthy.diagnostics.pipeline.checks,'growing the backing buffer rechecks real rendered pixels');
  assert.equal(resized.diagnostics.pipeline.validation,'verified');
  const transparentPage=await open(),transparent=await transparentPage.evaluate(()=>{
   const snapshot=player3DPose(player);for(const part of snapshot.parts)part.alpha=0;
   const empty=Player3D.draw(snapshot,drawingContext,{includeParts:['not-a-part']});
   clear();push();translate(360,360);scale(3);const drawn=Player3D.draw(snapshot,drawingContext);pop();
   for(const part of snapshot.parts)part.alpha=1e-6;
   const subPrecision=Player3D.draw(snapshot,drawingContext);
   return {empty,drawn,subPrecision,pixels:__visiblePixels(),diagnostics:Player3D.getDiagnostics(),calls:{...__transferCalls}};
  });
  assert.equal(transparent.empty,true,'an empty selected part set is a legitimate successful draw');
  assert.ok(transparent.drawn&&transparent.pixels===0,'an intentionally invisible pose is still a successful draw');
  assert.equal(transparent.subPrecision,true,'alpha below RGBA8 precision can legitimately produce no pixels');
  assert.equal(transparent.diagnostics.pipeline.validation,'pending','a transparent pose does not poison the renderer');
  assert.equal(transparent.calls.readbacks,0,'intentionally transparent poses do not force a readback');
  const followingOpaque=await transparentPage.evaluate(()=>__drawMesh());
  assert.ok(followingOpaque.drawn&&followingOpaque.pixels>100,'the following opaque pose validates successfully');
  const faults=[];
  for(const [fault,stage] of [['no-fragments','draw'],['no-canvas-import','canvas-transfer'],['gl-error','draw']]){
   const broken=await open(fault),result=await broken.evaluate(()=>{
    const direct=__drawMesh();clear();const before=Player3D.stats.draws;
    push();translate(360,360);scale(3);player.show();pop();
    return {direct,nativePixels:__visiblePixels(),nativeUsed:Player3D.stats.draws===before,
     diagnostics:Player3D.getDiagnostics(),calls:{...__transferCalls}};
   });
   assert.equal(result.direct.drawn,false,fault+' does not report a blank image as success');
   assert.equal(result.diagnostics.pipeline.validation,'failed',fault+' is retained in diagnostics');
   assert.equal(result.diagnostics.pipeline.stage,stage,fault+' identifies the failed pipeline stage');
   assert.equal(result.diagnostics.pipeline.canvasPixels,0,fault+' reports no confirmed Canvas output');
   if(fault==='no-canvas-import')assert.ok(result.diagnostics.pipeline.gpuPixels>0,'an import failure preserves evidence of successful GPU rasterization');
   else assert.equal(result.diagnostics.pipeline.gpuPixels,0,fault+' reports no confirmed GPU output');
   if(fault==='gl-error'){
    assert.equal(result.diagnostics.pipeline.glError,'INVALID_OPERATION','the actual WebGL error is named');
    assert.equal(result.calls.readbacks,0,'an existing GPU error avoids an unnecessary readback');
   }
   assert.ok(result.nativeUsed&&result.nativePixels>100,fault+' keeps the real native character visible');
   assert.equal(result.calls.contexts,1,fault+' allocates no retry/probe WebGL contexts');
   const calls=await broken.evaluate(()=>{const before={...__transferCalls};for(let i=0;i<10;i++)__drawMesh();return {before,after:{...__transferCalls}};});
   assert.equal(calls.after.readbacks,calls.before.readbacks,fault+' does not repeat failed readbacks every frame');
   if(fault==='no-canvas-import'){
    result.enemy=await broken.evaluate(()=>{
     const enemy=new Character(0,0,false,'NM0_GREY_FATIGUE');
     enemy.isFriendly=enemy.isNeutral=false;enemy.isMoving=true;enemy.isArmed=false;
     enemy.currentWeapon=WEAPONS.PISTOL;enemy.aimAngle=.4;enemy.moveAngle=1.1;
     enemy.gait=.6;enemy.walkCycle=.9;enemy.hitFlash=enemy.muzzleFlash=enemy.reloadTimer=enemy.meleeTimer=0;
     enemy.stunTimer=enemy.skeletonTimer=0;enemy.legInjury=enemy.stunPose=null;resetActorStance(enemy,'STAND');
     clear();const before=Player3D.stats.draws;push();translate(360,360);scale(3);enemy.show();pop();
     return {eligible:enemy3DLivingEligible(enemy),nativeUsed:before===Player3D.stats.draws,pixels:__visiblePixels()};
    });
    assert.ok(result.enemy.eligible&&result.enemy.nativeUsed&&result.enemy.pixels>100,'a failed transfer also preserves the real native living human enemy');
   }
   result.recovery=await broken.evaluate(()=>{__transferFault='';const requested=Player3D.requestValidation();return {requested,...__drawMesh()};});
   assert.ok(result.recovery.requested&&result.recovery.drawn&&result.recovery.pixels>100,fault+' recovers through an explicit recheck');
   assert.equal(result.recovery.diagnostics.pipeline.validation,'verified',fault+' recovery validates real output');
   assert.ok(result.recovery.diagnostics.pipeline.checks>result.diagnostics.pipeline.checks,fault+' recovery records another check');
   assert.equal(result.recovery.diagnostics.generation,result.diagnostics.generation,fault+' recovery reuses the existing GPU mesh generation');
   assert.equal(result.recovery.calls.contexts,1,fault+' recovery creates no extra GPU context');
   faults.push({fault,...result});
  }
  const loss=await page.evaluate(()=>{const ext=Player3D.gl.getExtension('WEBGL_lose_context');if(!ext)return {supported:false};
   window.__loss=ext;const checks=Player3D.getDiagnostics().pipeline.checks;ext.loseContext();return {supported:true,checks};});
  if(loss.supported){
   await page.waitForFunction(()=>!Player3D.ready);
   assert.equal(await page.evaluate(()=>__drawMesh().drawn),false,'a lost context returns to native rendering');
   await page.evaluate(()=>__loss.restoreContext());
   await page.waitForFunction(()=>Player3D.ensure(),{},{timeout:15000});
   loss.restored=await page.evaluate(()=>__drawMesh());
   assert.ok(loss.restored.drawn&&loss.restored.pixels>100,'restored context renders a visible character');
   assert.equal(loss.restored.diagnostics.pipeline.validation,'verified');
   assert.ok(loss.restored.diagnostics.pipeline.checks>loss.checks,'context restoration validates new GPU handles');
   assert.equal(loss.restored.calls.contexts,1,'restoration reuses the production WebGL context');
  }
  assert.deepEqual(errors,[],'no uncaught browser exceptions');
  const report={healthy,stable,resized,transparent,followingOpaque,faults,loss,errors};fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log('Actual shader/Canvas transfer, injected blank output, native fallback, stable hot path, resize and restoration checks passed: '+out+'/report.json');
 }finally{for(const page of pages)await page.close();await context.close();await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

// Inspect the two real GPU contexts, including loss/restoration, without
// replacing Android/Chrome driver policy or allocating diagnostic probes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(process.env.GAME_JS||path.join(root,'game.js'),'utf8');
const p5=fs.readFileSync(process.env.PLAYER3D_P5||'/workspace/.environment/newone/node_modules/p5/lib/p5.min.js','utf8');
const out=process.env.GRAPHICS_QA_OUT||'/tmp/game-graphics-context-qa';
const bootstrap='preload=function(){};setup=function(){createCanvas(720,480);pixelDensity(1);noLoop();window.__ready=true;};draw=function(){};windowResized=function(){};';
async function main(){
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 const context=await browser.newContext(),errors=[];
 await context.addInitScript(()=>{
  window.__graphicsRequests=[];const original=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(kind,options){
   if(kind==='webgl'||kind==='webgl2')window.__graphicsRequests.push({kind,options});
   if(window.__denyGraphics&&(kind==='webgl'||kind==='webgl2'))return null;
   return original.apply(this,arguments);
  };
 });
 await context.route('http://graphics-qa.local/**',route=>{
  const url=route.request().url();
  if(url.endsWith('/p5.js'))return route.fulfill({contentType:'application/javascript',body:p5});
  if(url.endsWith('/game.js'))return route.fulfill({contentType:'application/javascript',body:source});
  return route.fulfill({contentType:'text/html',body:'<!doctype html><script src="/p5.js"></script><script src="/game.js"></script><script>'+bootstrap+'</script>'});
 });
 try{
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://graphics-qa.local/',{waitUntil:'load'});await page.waitForFunction(()=>window.__ready);
  const report=await page.evaluate(()=>{
   const initial=getGameGraphicsDiagnostics(),initialRequests=__graphicsRequests.length;
   const lighting=glRigInit(),characters=Player3D.ensure();
   const ready=getGameGraphicsDiagnostics(),actual={lighting:GLRig.gl.getContextAttributes(),characters:Player3D.gl.getContextAttributes()};
   window.__parameterReads=0;
   for(const gl of [GLRig.gl,Player3D.gl])for(const method of ['getParameter','getContextAttributes','getExtension']){
    const native=gl[method].bind(gl);gl[method]=function(...args){__parameterReads++;return native(...args);};
   }
   for(let i=0;i<1000;i++)getGameGraphicsDiagnostics();
   return {initial,initialRequests,lighting,characters,ready,actual,requests:__graphicsRequests.slice(),repeatDriverReads:__parameterReads};
  });
  assert.equal(report.initialRequests,0,'diagnostics do not create contexts before either renderer initializes');
  assert.equal(report.initial.lighting.context.state,'not-created');
  assert.equal(report.initial.characters.context.state,'not-created');
  assert.ok(report.lighting&&report.characters,'both production renderers initialize');
  assert.equal(report.requests.length,2,'only the two game contexts are created');
  for(const request of report.requests){
   assert.equal(request.kind,'webgl2');assert.equal(request.options.powerPreference,'high-performance');
   assert.equal(request.options.preserveDrawingBuffer,true,'Canvas composition retains its required buffer');
   assert.equal(request.options.failIfMajorPerformanceCaveat,false,'software/legacy environments retain fallback support');
  }
  for(const key of ['lighting','characters']){
   assert.equal(report.ready[key].context.state,'ready');
   assert.deepEqual(report.ready[key].context.contextAttributes,report.actual[key],'report uses the browser\'s actual context attributes');
   const renderer=report.ready[key].context.unmaskedRenderer||report.ready[key].context.renderer||'';
   if(/swiftshader|llvmpipe|lavapipe|softpipe|\bwarp\b/i.test(renderer))
    assert.equal(report.ready[key].context.acceleration,'software','Vulkan software rendering is never described as hardware');
  }
  assert.equal(report.repeatDriverReads,0,'one thousand reports make zero extra GPU queries');
  const loss=await page.evaluate(()=>{
   const extension=Player3D.gl.getExtension('WEBGL_lose_context');if(!extension)return {supported:false};
   window.__graphicsLoss=extension;const generation=Player3D.getDiagnostics().generation;extension.loseContext();
   return {supported:true,generation};
  });
  if(loss.supported){
   await page.waitForFunction(()=>getGameGraphicsDiagnostics().characters.context.state==='lost');
   loss.lost=await page.evaluate(()=>getGameGraphicsDiagnostics());
   assert.ok(!loss.lost.characters.ready&&loss.lost.lighting.ready,'a lost character context preserves independent lighting');
   assert.equal(loss.lost.characters.context.backend,'unknown','a lost context does not expose cached driver data as current');
   await page.evaluate(()=>__graphicsLoss.restoreContext());
   await page.waitForFunction(()=>Player3D.ensure()&&getGameGraphicsDiagnostics().characters.context.state==='ready',{},{timeout:15000});
   loss.restored=await page.evaluate(()=>({diagnostics:getGameGraphicsDiagnostics(),generation:Player3D.getDiagnostics().generation,
    requests:__graphicsRequests.length,driverReads:__parameterReads}));
   assert.ok(loss.restored.generation>loss.generation&&loss.restored.driverReads>0,'restoration refreshes context-generation metadata');
   assert.equal(loss.restored.requests,2,'restoring a context does not allocate a diagnostic probe');
  }
  report.contextLoss=loss;
  report.disposed=await page.evaluate(()=>{Player3D.dispose();return {diagnostics:getGameGraphicsDiagnostics(),requests:__graphicsRequests.length};});
  assert.equal(report.disposed.diagnostics.characters.context.state,'not-created');
  assert.equal(report.disposed.requests,2,'reporting after disposal never recreates the renderer');
  const unavailable=await context.newPage();unavailable.on('pageerror',error=>errors.push(error.message));
  await unavailable.goto('http://graphics-qa.local/unavailable',{waitUntil:'load'});await unavailable.waitForFunction(()=>window.__ready);
  report.unavailable=await unavailable.evaluate(()=>{
   __denyGraphics=true;const lighting=glRigInit(),characters=Player3D.ensure();
   return {lighting,characters,diagnostics:getGameGraphicsDiagnostics(),canvas2D:!!drawingContext.getImageData,requests:__graphicsRequests.length};
  });
  assert.ok(!report.unavailable.lighting&&!report.unavailable.characters&&report.unavailable.canvas2D,'a host denying WebGL retains its main 2D canvas');
  assert.equal(report.unavailable.diagnostics.lighting.context.state,'unavailable');
  assert.equal(report.unavailable.diagnostics.characters.context.state,'unavailable');
  assert.equal(report.unavailable.requests,2,'failure reports do not retry or probe a different context');
  const standalone=await context.newPage();standalone.on('pageerror',error=>errors.push(error.message));
  await standalone.goto('http://graphics-qa.local/standalone',{waitUntil:'load'});await standalone.waitForFunction(()=>window.__ready);
  report.standalone=await standalone.evaluate(()=>{
   gameGraphicsContextInfo=undefined;gameGraphicsForgetContext=undefined;
   const ready=Player3D.ensure(),diagnostics=Player3D.getDiagnostics();Player3D.dispose();
   return {ready,context:diagnostics.context,requests:__graphicsRequests.length};
  });
  assert.ok(report.standalone.ready&&report.standalone.context===null&&report.standalone.requests===1,
   'the character renderer initializes and disposes without the optional shared helper');
  assert.deepEqual(errors,[],'no browser exceptions');report.errors=errors;
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log('Actual lighting/character context, high-performance request, zero-query cache, loss/restore and WebGL-denial browser checks passed: '+out+'/report.json');
 }finally{await context.close();await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

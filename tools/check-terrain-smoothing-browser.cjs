// Real p5 1.9.0 regression: terrain smoothing must use Canvas2D, without
// requesting WebGL attributes. Compare every texture/blit pixel with HEAD.
// VIS_P5=/path/to/p5-1.9.0.min.js node tools/check-terrain-smoothing-browser.cjs
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const {chromium}=require('playwright-core');
const repo=path.resolve(__dirname,'..');
const p5=fs.readFileSync(process.env.VIS_P5||'/workspace/newone-dev/vendor/p5-1.9.0.min.js','utf8');
const candidate=fs.readFileSync(path.join(repo,'game.js'),'utf8');
const baseline=cp.execFileSync('git',['show',(process.env.SMOOTHING_BASELINE||'1f86f85')+':game.js'],{cwd:repo,maxBuffer:16e6,encoding:'utf8'});
const blank=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR3kAAAAASUVORK5CYII=','base64');
async function inspect(browser,source){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 await context.addInitScript(()=>window.addEventListener('resize',e=>{try{if(typeof leftStick==='undefined'||!leftStick||!rightStick)e.stopImmediatePropagation();}catch(_){e.stopImmediatePropagation();}},true));
 const page=await context.newPage(),warnings=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(/setAttributes.*WEBGL renderer/.test(m.text()))warnings.push(m.text());});
 await page.route('http://smoothing.local/**',r=>{
  const url=r.request().url();
  if(url.endsWith('/p5.js'))return r.fulfill({contentType:'application/javascript',body:p5});
  if(url.endsWith('/game.js'))return r.fulfill({contentType:'application/javascript',body:source});
  if(/\.(mp3|wav)(\?.*)?$/.test(url))return r.fulfill({status:204,body:''});
  if(/\.png(\?.*)?$/.test(url))return r.fulfill({contentType:'image/png',body:blank});
  return r.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/p5.js"></script><script src="/game.js"></script>'});
 });
 try{
  await page.goto('http://smoothing.local/',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof leftStick!=='undefined'&&leftStick&&document.querySelector('canvas'));
  const pixels=await page.evaluate(()=>{
   noLoop();resizeCanvas(240,240);pixelDensity(1);randomSeed(7);noiseSeed(BIOME_SEED);seedWorldClock();
   worldTimeMs=13/24*DAY_MS;BIOME_ACTIVE=true;authoredSolids=[];authoredCore=authoredMask=null;chunkMgr=null;buildings=[];activeBuildings=[];
   player=new Character(0,0,true);zoom=1;camX=camY=0;viewLeft=viewTop=0;viewRight=viewBottom=240;
   const hash=data=>{let h=2166136261;for(let i=0;i<data.length;i++)h=Math.imul(h^data[i],16777619);return h>>>0;};
   const out=[];
   for(const biome of [1,2,3]){
    currentLevel=currentBiome=biome;const tile=bakeChunkTerrain(biome,6,8,[]);
    const textureHash=hash(tile.drawingContext.getImageData(0,0,tile.width,tile.height).data);
    // A fully prepared visible window exercises the real ground blit without
    // introducing unrelated streaming, population or random terrain fixtures.
    const mgr=Object.create(ChunkManager.prototype);mgr.chunks=new Map();
    for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)mgr.chunks.set(x+','+y,{cx:x,cy:y,tex:tile});
    resetMatrix();clear();noSmooth();mgr.drawTerrain();
    out.push({biome,textureHash,canvasHash:hash(drawingContext.getImageData(0,0,width,height).data),
     textureSmoothing:tile.drawingContext.imageSmoothingEnabled,canvasSmoothing:drawingContext.imageSmoothingEnabled});
    tile.remove();
   }
   // Check startup and a live production frame with the actual lighting rig.
   isStoryMode=true;started=true;isDead=isWin=isPaused=false;window.outpostForts={};startAtLevel(1);
   inStoryIntro=inStoryRoom=killcamMode=inTownCutscene=inFarmCutscene=inPostAmbushCutscene=false;
   glRigInit();GLRig.on=GLRig.ok;deltaTime=1000/60;frameCount++;draw();
   const rig={ok:GLRig.ok,on:GLRig.on,error:GLRig.gl?.getError(),fault:window.FRAME_FAULT||null};
   return {out,rig};
  });
  return {pixels,warnings,errors};
 }finally{await context.close();}
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 try{
  const before=await inspect(browser,baseline),after=await inspect(browser,candidate);
  assert.ok(before.warnings.length>=3,'Baseline reproduces the reported p5 warning');
  assert.equal(after.warnings.length,0,'Candidate never requests WebGL attributes for Canvas2D');
  assert.deepEqual(after.pixels.out,before.pixels.out,'All sampled terrain and blit pixels remain identical');
  assert.ok(after.pixels.out.every(r=>!r.textureSmoothing&&r.canvasSmoothing),'Texture-detail and ground-blit filtering are preserved');
  assert.deepEqual(after.errors,[],'No native browser exceptions');
  assert.ok(after.pixels.rig.ok&&after.pixels.rig.on,'The real advanced lighting rig remains active');
  assert.equal(after.pixels.rig.error,0,'WebGL reports no actual GPU error');
  assert.equal(after.pixels.rig.fault,null,'The native frame completes');
  console.log(JSON.stringify({baselineWarnings:before.warnings.length,candidateWarnings:after.warnings.length,pixelParity:after.pixels.out,rig:after.pixels.rig},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

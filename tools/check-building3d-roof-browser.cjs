// Real Canvas height-field sampling, cached parallax, and native world lighting.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.BUILDING3D_OUT||'/tmp/building3d-qa';
const source=fs.readFileSync(path.join(root,'game.js'),'utf8');
const p5=fs.readFileSync(process.env.PLAYER3D_P5||'/workspace/.environment/newone/node_modules/p5/lib/p5.min.js','utf8');
const baseline=execFileSync('git',['show',process.env.BUILDING3D_BASELINE||'e45c886:game.js'],{cwd:root,maxBuffer:10e6}).toString();
const from=baseline.indexOf('function paintFrontierRoofMesh('),to=baseline.indexOf('function drawFrontierArchitecture(',from);
assert.ok(from>=0&&to>from);const oldPainter=baseline.slice(from,to).replace('function paintFrontierRoofMesh(','function baselineRoofHeightPaint(');
fs.mkdirSync(out,{recursive:true});
const bootstrap=`preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(1200,900);pixelDensity(1);noLoop();window.__ready=true;};`;
async function main(){
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||String(e)));
  await page.route('http://building3d.local/**',r=>{
   const url=r.request().url();
   if(url.endsWith('/p5.js'))return r.fulfill({contentType:'application/javascript',body:p5});
   if(url.endsWith('/game.js'))return r.fulfill({contentType:'application/javascript',body:source});
   const init=url.includes('/world')?'preload=function(){};':bootstrap;
   return r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}canvas{display:block}</style><script src="/p5.js"></script><script src="/game.js"></script><script>'+init+'</script>'});
  });
  await page.goto('http://building3d.local/',{waitUntil:'load'});await page.waitForFunction(()=>window.__ready);
  await page.addScriptTag({content:oldPainter});
  const report=await page.evaluate(()=>{
   currentLevel=currentBiome=3;BIOME_ACTIVE=true;zoom=1;
   const originalGround=groundElev;groundElev=()=>window.__roofGround||0;
   const fixtureFaces=[
    [[-45,-30,10],[45,-30,10],[45,30,60],[-45,30,60]],
    [[-45,-30,10],[45,-30,50],[45,30,70],[-45,30,30]],
    [[-20,-30,5],[-20,30,5],[-20,30,65],[-20,-30,65]],
    [[-45,-30,30],[45,-30,30],[45,30,30],[-45,30,30]]
   ];
   const samples=[],g=createGraphics(400,400);g.pixelDensity(1);
   const setLean=(ux,uy)=>{camX=-width/2-width/2*ux/MASS_LEAN;camY=-height/2-height/2*(uy-MASS_TILT)/MASS_LEAN;};
   try{
    for(const [fi,points] of fixtureFaces.entries())for(const [ux,uy] of [[.5,.8],[-.6,-.4],[0,.62]])for(const ground of [0,60])for(const wet of [0,1]){
     const b={x:0,y:0,w:90,h:60,frontierDesign:{}},face={points,color:[100,100,100]},mesh={faces:[face],commands:[face]};
     _frontierRoofMeshes.set(b,mesh);window.__roofGround=ground;setLean(ux,uy);
     const draw=painter=>{g.clear();g.push();g.translate(200,150);g.scale(2);painter(g,b,true,wet);g.pop();return g.drawingContext.getImageData(0,0,400,400).data;};
     const revised=draw(paintFrontierRoofMesh),old=draw(baselineRoofHeightPaint);
     for(const t of [.2,.5,.8]){
      const s=.5,a=points[0],u=points[1].map((v,i)=>v-a[i]),v=points[3].map((q,i)=>q-a[i]);
      const p=a.map((q,i)=>q+s*u[i]+t*v[i]),px=200+(p[0]+ux*p[2])*2,py=150+(p[1]+uy*p[2])*2;
      if(fi===2&&Math.abs(ux)<.00001)continue;
      const x=Math.round(px),y=Math.round(py),k=(y*400+x)*4;
      const mean=points.reduce((sum,p)=>sum+p[2],0)/points.length;
      const expected=glRigHeightByte(mean+ground),gloss=(.13+.26*wet)*255;
      samples.push({face:fi,ux,uy,ground,wet,t,expected,actual:revised[k],old:old[k],alpha:revised[k+3],gloss:revised[k+1],expectedGloss:gloss});
     }
    }
   }finally{groundElev=originalGround;g.remove();}
   return {samples,diagnostics:BuildingRoofLighting.getDiagnostics()};
  });
  for(const s of report.samples){
   assert.ok(s.alpha>245,'opaque roof sample '+JSON.stringify(s));
   assert.ok(Math.abs(s.actual-s.expected)<1.2,'native projected height proxy '+JSON.stringify(s));
   assert.ok(Math.abs(s.actual-s.old)<=1,'Blender cached proxy matches native painter '+JSON.stringify(s));
   assert.ok(Math.abs(s.gloss-s.expectedGloss)<1.2,'wet material preserved '+JSON.stringify(s));
  }
  const sloped=report.samples.filter(s=>s.face<3&&s.t!==.5);
  report.heightErrorBytes={before:Math.max(...sloped.map(s=>Math.abs(s.old-s.expected))),after:Math.max(...sloped.map(s=>Math.abs(s.actual-s.expected)))};
  assert.ok(report.heightErrorBytes.before<1.2&&report.heightErrorBytes.after<1.2,'native shadow heights are preserved');
  // Cache/profile actual authored roofs, including the original p5 painter.
  report.profile=await page.evaluate(()=>{
   currentLevel=currentBiome=3;BIOME_ACTIVE=true;legacyGenerateMap();
   zoom=.65;camX=1300-width/zoom/2;camY=-1730-height/zoom/2;
   viewLeft=camX;viewTop=camY;viewRight=camX+width/zoom;viewBottom=camY+height/zoom;
   const bs=buildings.filter(b=>b.frontierDesign&&inView(b.x,b.y,Math.max(b.w,b.h)+150));
   const g=createGraphics(480,360);g.pixelDensity(1);
   const run=painter=>{g.clear();g.push();g.scale(.26);g.translate(-camX,-camY);for(const b of bs)painter(g,b,true,0);g.pop();g.drawingContext.getImageData(0,0,1,1);};
   for(let i=0;i<3;i++){run(baselineRoofHeightPaint);run(paintFrontierRoofMesh);}
   const before=BuildingRoofLighting.getDiagnostics(),old=[],next=[];
   for(let i=0;i<24;i++){
    let t=performance.now();run(i%2?baselineRoofHeightPaint:paintFrontierRoofMesh);(i%2?old:next).push(performance.now()-t);
    t=performance.now();run(i%2?paintFrontierRoofMesh:baselineRoofHeightPaint);(i%2?next:old).push(performance.now()-t);
   }
   const summary=a=>{a.sort((a,b)=>a-b);return {median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)]};};
   const after=BuildingRoofLighting.getDiagnostics();
   for(let i=0;i<6;i++){camX+=20;camY-=11;run(paintFrontierRoofMesh);}
   const afterPan=BuildingRoofLighting.getDiagnostics();g.remove();
   return {buildings:bs.length,faces:bs.reduce((n,b)=>n+frontierRoofMesh(b).faces.length,0),beforeMs:summary(old),afterMs:summary(next),before,after,afterPan};
  });
  assert.equal(report.profile.after.gradients,report.profile.before.gradients,'repeated roofs reuse gradients');
  assert.equal(report.profile.afterPan.gradients,report.profile.after.gradients,'camera parallax reuses gradients');
  assert.equal(report.profile.after.pathBuilds,report.profile.before.pathBuilds,'unchanged camera reuses projected paths');
  assert.ok(report.profile.afterPan.pathBuilds>report.profile.after.pathBuilds,'camera movement refreshes native projected edges');
  assert.ok(report.profile.after.blenderPlans>0&&report.profile.after.invalidExports===0,'actual authored roofs consume Blender plans');
  // Real G-buffer, sun and local lamps, with changing camera lean.
  await page.goto('http://building3d.local/world',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof width==='number'&&width>0&&!!document.querySelector('canvas'));
  await page.addScriptTag({content:oldPainter});
  await page.evaluate(()=>{
   noLoop();randomSeed(7);noiseSeed(BIOME_SEED);isStoryMode=true;started=true;isDead=isWin=false;
   window.outpostForts={};seedWorldClock();startAtLevel(3);
   inStoryIntro=inStoryRoom=killcamMode=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=inTravelMenu=inOverworldView=false;
   window.showOnScreenControls=false;window.isDesktop=true;leftStick.active=rightStick.active=false;
   glRigClock=glRigWatchdog=function(){};isPaused=true;window.__revisedRoofPainter=paintFrontierRoofMesh;
   const nativeFrame=glRigFrame;
   glRigFrame=function(){const drawn=nativeFrame();
    if(drawn)window.__roofLitCapture=drawingContext.getImageData(0,0,drawingContext.canvas.width,drawingContext.canvas.height);
    return drawn;};
  });
  report.world=[];
  report.heightBufferParity={};
  for(const scene of [{name:'church-morning',x:1300,y:-180,zoom:.9,hour:9},{name:'church-evening-angle',x:1750,y:-400,zoom:.8,hour:17},{name:'street-night-lamps',x:1300,y:-1730,zoom:1.1,hour:22}]){
   for(const mode of ['before','after']){
    const row=await page.evaluate(({scene,mode})=>{
     paintFrontierRoofMesh=mode==='before'?baselineRoofHeightPaint:__revisedRoofPainter;
     player.x=scene.x;player.y=scene.y;player.aimAngle=-Math.PI/2;player.hp=player.maxHp;
     chunkMgr.update(player.x,player.y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();lastActiveUpdate=-100;updateActiveWorld();
     worldTimeMs=scene.hour/24*DAY_MS;updateSunVector();
     for(let i=0;i<2;i++){zoom=(scene.zoom-.065)/.9;camX=player.x-width/(2*scene.zoom);camY=player.y-height/(2*scene.zoom);frameCount++;draw();}
     // Capture the native lit world before pause/HUD overlays obscure roofs.
     if(__roofLitCapture)drawingContext.putImageData(__roofLitCapture,0,0);
     return {scene:scene.name,mode,fault:window.FRAME_FAULT||null,gl:{ok:GLRig.ok,on:GLRig.on,failure:GLRig.failure,error:GLRig.gl?.getError()},diagnostics:BuildingRoofLighting.getDiagnostics()};
    },{scene,mode});
    await page.screenshot({path:path.join(out,scene.name+'-'+mode+'.png')});
    const field=await page.evaluate(()=>(GLRig.hgt.canvas||GLRig.hgt.elt).toDataURL('image/png'));
    const bytes=Buffer.from(field.split(',')[1],'base64');
    fs.writeFileSync(path.join(out,scene.name+'-'+mode+'-height.png'),bytes);
    if(mode==='after'){
     report.heightBufferParity[scene.name]=bytes.equals(fs.readFileSync(path.join(out,scene.name+'-before-height.png')));
     assert.ok(report.heightBufferParity[scene.name],'native world height-buffer parity '+scene.name);
    }
    assert.ok(!row.fault&&row.gl.ok&&row.gl.on&&row.gl.error===0,'native lit world '+JSON.stringify(row));report.world.push(row);
   }
  }
  assert.deepEqual(errors,[],'no uncaught browser errors');
  report.renderer='Chromium / SwiftShader; physical-phone performance unmeasured';
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({out,heightSamples:report.samples.length,heightErrorBytes:report.heightErrorBytes,profile:report.profile,world:report.world.map(r=>({scene:r.scene,mode:r.mode,gl:r.gl}))},null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

// Actual p5/Canvas roof geometry, projected lighting pixels and native world
// before/after review. Chromium SwiftShader is not a physical-phone benchmark.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.CITY3D_OUT||'/tmp/city3d-qa';
const source=fs.readFileSync(process.env.GAME_JS||path.join(root,'game.js'),'utf8');
const baseline=execFileSync('git',['show',process.env.CITY3D_BASELINE||'e2fd618:game.js'],{cwd:root,maxBuffer:12e6}).toString();
const p5=fs.readFileSync(process.env.PLAYER3D_P5||'/workspace/.environment/newone/node_modules/p5/lib/p5.min.js','utf8');
const boot='preload=function(){};setup=function(){createCanvas(1200,900);pixelDensity(1);noLoop();window.__ready=true;};draw=function(){};windowResized=function(){};';
fs.mkdirSync(out,{recursive:true});
async function main(){
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 const pages=[],errors=[];
 try{
  async function open(mode){
   const page=await browser.newPage({viewport:{width:1200,height:900}});pages.push(page);
   page.on('pageerror',error=>errors.push(mode+': '+(error.stack||String(error))));
   await page.addInitScript(()=>{window.__cityContexts=0;const get=HTMLCanvasElement.prototype.getContext,seen=new WeakSet();
    HTMLCanvasElement.prototype.getContext=function(kind,...args){const value=get.call(this,kind,...args);
     if(kind==='webgl2'&&value&&!seen.has(this)){seen.add(this);__cityContexts++;}return value;};});
   await page.route('http://city3d.local/**',route=>{
    const name=new URL(route.request().url()).pathname;
    if(name==='/p5.js')return route.fulfill({contentType:'application/javascript',body:p5});
    if(name==='/game.js')return route.fulfill({contentType:'application/javascript',body:mode==='before'?baseline:source});
    return route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0;background:#333}</style><script src="/p5.js"></script><script src="/game.js"></script><script>'+boot+'</script>'});
   });
   await page.goto('http://city3d.local/');await page.waitForFunction(()=>window.__ready);
   await page.evaluate(()=>{
    started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
    inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
    currentLevel=currentBiome=1;BIOME_ACTIVE=true;authoredCore=authoredMask=authoredChunks=null;biomeState={};
    enemiesList=[];buildings=[];activeBuildings=[];barrels=[];parkingCars=[];activeParkingCars=[];
    randomSeed(7);noiseSeed(BIOME_SEED);seedWorldClock();worldTimeMs=13/24*DAY_MS;updateSunVector();
    leftStick={active:false,dx:0,dy:0,dist:0};rightStick={active:false,dx:0,dy:0,dist:0};
    resetUndergroundRoute();setMeleeTool('NONE');
    chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
    player=new Character(600,7800,true);player.isArmed=true;player.currentWeapon=WEAPONS.PISTOL;
    frameCount=140;weather=null;zoom=1;camX=camY=0;
    viewLeft=viewTop=-100000;viewRight=viewBottom=100000;GLRig.on=false;
   });return page;
  }
  const report={renderer:'Chromium / SwiftShader; physical-phone performance unmeasured',
   sourceSha256:createHash('sha256').update(source).digest('hex'),gallery:{},world:[]};
  const before=await open('before'),after=await open('after');
  let referenceGallery;
  for(const [mode,page]of[['before',before],['after',after]]){
   const gallery=await page.evaluate(()=>{
    resizeCanvas(1200,1560);background(66,79,79);const cases=[];
    const specimens=[
     {label:'Quay brick house',w:190,h:130,style:1},
     {label:'Wharf sawtooth warehouse',w:210,h:150,style:3},
     {label:'Canal office',w:190,h:165,style:0},
     {label:'Brownstone mews',w:104,h:280,style:1,cityArchitecture:0},
     {label:'Office campus',w:260,h:260,style:3,cityArchitecture:1},
     {label:'Workshop yard',w:320,h:290,style:0,cityArchitecture:4}
    ];
    const views=[[-1,-.5],[0,.62],[1,1.2]];
    for(let row=0;row<specimens.length;row++)for(let col=0;col<views.length;col++){
     const fixture=specimens[row],b={...fixture,x:0,y:0,isBlockBuilding:true,cityAccent:2,cityStoreys:3,details:[]};
     const [ux,uy]=views[col];camX=-width/2-ux*width/(2*MASS_LEAN);camY=-height/2-(uy-MASS_TILT)*height/(2*MASS_LEAN);
     push();translate(col*400+200,row*260+130);scale(.68);drawBuildings([b],0,1);pop();
     noStroke();fill(235,229,199);textAlign(CENTER,CENTER);textSize(14);text(fixture.label+' / view '+(col+1),col*400+200,row*260+240);
     cases.push({label:fixture.label,ux,uy,rise:buildingRise(b)});
    }
    return {cases,contexts:__cityContexts,diagnostics:typeof CityBuildings3D!=='undefined'?CityBuildings3D.getDiagnostics():null,
     image:drawingContext.canvas.toDataURL()};
   });
   fs.writeFileSync(path.join(out,'city-roof-angles-'+mode+'.png'),Buffer.from(gallery.image.split(',')[1],'base64'));
   if(mode==='before')referenceGallery=gallery.image;delete gallery.image;report.gallery[mode]=gallery;
  }
  assert.equal(report.gallery.after.contexts,0,'Blender city artwork creates no WebGL context');
  assert.ok(report.gallery.after.diagnostics.draws>=18,'actual native building dispatcher uses the Blender kit');
  report.gallery.changedPixels=await after.evaluate(async url=>{
   const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
   const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const a=ctx.getImageData(0,0,c.width,c.height).data,b=drawingContext.getImageData(0,0,c.width,c.height).data;
   let count=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])count++;return count;
  },referenceGallery);
  assert.ok(report.gallery.changedPixels>10000,'the revised roof kit makes a visible geometric/material improvement');

  report.height=await after.evaluate(()=>{
   const samples=[],g=createGraphics(700,700);g.pixelDensity(1);const nativeGround=groundElev;
   groundElev=()=>window.__cityGround||0;
   function inside(q,x,y){let odd=false;for(let i=0,j=q.length-2;i<q.length;j=i,i+=2)
    if((q[i+1]>y)!==(q[j+1]>y)&&x<(q[j]-q[i])*(y-q[i+1])/(q[j+1]-q[i+1])+q[i])odd=!odd;return odd;}
   function nearEdge(q,x,y){let distance=Infinity;for(let i=0,j=q.length-2;i<q.length;j=i,i+=2){
    const ax=q[j],ay=q[j+1],dx=q[i]-ax,dy=q[i+1]-ay,length=dx*dx+dy*dy;
    const t=Math.max(0,Math.min(1,length?((x-ax)*dx+(y-ay)*dy)/length:0));
    distance=Math.min(distance,Math.hypot(x-ax-t*dx,y-ay-t*dy));}return distance;}
   try{
    for(const style of[0,1,3])for(const [ux,uy]of[[-1,-.5],[0,.62],[1,1.2]])for(const ground of[0,60])for(const wet of[0,1]){
     const b={x:0,y:0,w:190,h:150,style,isBlockBuilding:true};window.__cityGround=ground;
     camX=-width/2-ux*width/(2*MASS_LEAN);camY=-height/2-(uy-MASS_TILT)*height/(2*MASS_LEAN);
     const p=CityBuildings3D.project(b),faces=p.faces.filter(f=>f.visible&&f.kind!=='facade');
     g.clear();g.push();g.translate(350,350);g.scale(2);CityBuildings3D.paintHeight(g,b,wet);g.pop();
     for(let fi=0;fi<faces.length;fi++){
      const f=faces[fi],q=f.projected;
      const x=Array.from(q).filter((_,i)=>!(i%2)).reduce((a,c)=>a+c,0)/(q.length/2);
      const y=Array.from(q).filter((_,i)=>i%2).reduce((a,c)=>a+c,0)/(q.length/2);
      if(!inside(q,x,y)||nearEdge(q,x,y)<2||faces.slice(fi+1).some(next=>
       inside(next.projected,x,y)||nearEdge(next.projected,x,y)<2))continue;
      // Keep the entire sample footprint off polygon edges so antialiasing
      // cannot turn a correct projected proxy into a one-byte false failure.
      if(![[-1,-1],[1,-1],[-1,1],[1,1]].every(([a,c])=>inside(q,x+a,y+c)&&
        !faces.slice(fi+1).some(next=>inside(next.projected,x+a,y+c))))continue;
      const pixel=Array.from(g.drawingContext.getImageData(Math.round(350+x*2),Math.round(350+y*2),1,1).data);
      const gloss=(f.material==='glass'?.30:.12)+.26*wet;
      samples.push({style,ux,uy,ground,wet,kind:f.kind,material:f.material,expected:glRigHeightByte(ground+f.meanZ),
       actual:pixel[0],expectedGloss:Math.min(255,gloss*255),gloss:pixel[1],alpha:pixel[3]});
     }
    }
   }finally{groundElev=nativeGround;g.remove();}
   return {samples,diagnostics:CityBuildings3D.getDiagnostics()};
  });
  assert.ok(report.height.samples.length>=60,'height pixels cover multiple models, opposite views, wetness and ground elevation');
  for(const row of report.height.samples){
   assert.ok(row.alpha>250&&Math.abs(row.actual-row.expected)<1.3,'projected native height '+JSON.stringify(row));
   assert.ok(Math.abs(row.gloss-row.expectedGloss)<1.3,'roof material wetness '+JSON.stringify(row));
  }
  report.transformedTargets=await after.evaluate(()=>{
   const cases=[],matrices=[[1.5,0,0,1.5,256,256],[1.1,.25,-.2,.9,256,256],[-1.1,.2,.3,1.4,256,256]];
   for(const style of[0,1,3])for(const [index,matrix]of matrices.entries()){
    const a=document.createElement('canvas'),h=document.createElement('canvas');a.width=a.height=h.width=h.height=512;
    const art=a.getContext('2d'),heightContext=h.getContext('2d'),b={x:0,y:0,w:190,h:150,style,isBlockBuilding:true};
    camX=-width/2-width/(2*MASS_LEAN);camY=-height/2-(1.1-MASS_TILT)*height/(2*MASS_LEAN);
    for(const ctx of[art,heightContext]){if(index===2){ctx.beginPath();ctx.rect(80,80,250,300);ctx.clip();}ctx.setTransform(...matrix);}
    const before=['a','b','c','d','e','f'].map(k=>art.getTransform()[k]);
    const drawn=CityBuildings3D.draw(b,art),stamped=CityBuildings3D.paintHeight(heightContext,b,0);
    const after=['a','b','c','d','e','f'].map(k=>art.getTransform()[k]),heightAfter=['a','b','c','d','e','f'].map(k=>heightContext.getTransform()[k]);
    const p=art.getImageData(0,0,512,512).data,q=heightContext.getImageData(0,0,512,512).data;let opaque=0,maskDelta=0;
    for(let i=3;i<p.length;i+=4){const x=p[i]>20,y=q[i]>20;if(x)opaque++;if(x!==y)maskDelta++;}
    cases.push({style,index,drawn,stamped,opaque,maskDelta,before,after,heightAfter});
   }return cases;
  });
  fs.writeFileSync(path.join(out,'transformed-targets.json'),JSON.stringify(report.transformedTargets,null,2));
  for(const row of report.transformedTargets){
   assert.ok(row.drawn&&row.stamped&&row.opaque>1000,'transformed Canvas targets contain actual building pixels '+JSON.stringify(row));
   assert.ok(row.maskDelta<row.opaque*.005,'visible art and height preserve the same transformed/clipped silhouette '+JSON.stringify(row));
   assert.deepEqual(row.after,row.before,'drawing restores its caller transform');
   assert.deepEqual(row.heightAfter,row.before,'height drawing restores its caller transform');
  }
  const scenes=[{name:'canal-day',x:600,y:7800,zoom:.85,hour:13,rain:false},
   {name:'canal-evening-angle',x:1150,y:7500,zoom:1.1,hour:17,rain:true},
   {name:'canal-night',x:600,y:7800,zoom:.85,hour:23,rain:false}];
  for(const [mode,page]of[['before',before],['after',after]]){
   await page.evaluate(()=>{
    resizeCanvas(1200,900);refreshPopulation=function(){};chunkMgr=new ChunkManager(1);
    glRigWatchdog=glRigClock=function(){};if(!glRigInit())throw Error(GLRig.failure);
    GLRig.on=true;GLRig.tier=GLRig.lightTier=0;GLRig.resize=true;
    window.__paintCityWorld=()=>{
     background(...BIOMES[1].sky);push();scale(zoom);translate(-camX,-camY);
     chunkMgr.drawTerrain();_depthOn=true;chunkMgr.drawDecor();drawBiomeDecks();drawBuildingShadows();
     actorShow(player);drawDepthSorted();drawAirborneActors();drawNightLights();pop();
     if(!glRigFrame())throw Error('World lighting failed: '+GLRig.failure);
    };
   });
   for(const scene of scenes){
    const row=await page.evaluate(scene=>{
     player.x=scene.x;player.y=cityCanalY(1,6,scene.x)-cityCanalHalf(1,6,scene.x)-CITY_QUAY/2;
     player.aimAngle=.3;player.isArmed=true;
     chunkMgr.update(scene.x,scene.y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();activeBuildings=buildings;invalidateColIndex();
     zoom=scene.zoom;camX=scene.x-width/(zoom*2);camY=scene.y-height/(zoom*2);
     viewLeft=camX;viewTop=camY;viewRight=camX+width/zoom;viewBottom=camY+height/zoom;
     worldTimeMs=scene.hour/24*DAY_MS;isRaining=scene.rain;updateSunVector();
     __paintCityWorld();__paintCityWorld();
     const renderer=typeof CityBuildings3D!=='undefined'?CityBuildings3D:null;
     const start=renderer&&renderer.getDiagnostics();
     const props=typeof CityQuayProps3D!=='undefined'?CityQuayProps3D:null,propsStart=props&&{...props.stats};
     for(let i=0;i<3;i++)__paintCityWorld();const end=renderer&&renderer.getDiagnostics();
     return {scene:scene.name,contexts:__cityContexts,start,end,characters:Player3D.getDiagnostics(),
      lighting:{ok:GLRig.ok,on:GLRig.on,error:GLRig.gl.getError()},buildings:activeBuildings.filter(b=>b.isBlockBuilding).length,
      propsStart,propsEnd:props&&{...props.stats}};
    },scene);
    assert.ok(row.lighting.ok&&row.lighting.on&&row.lighting.error===0,'actual advanced city world renders '+scene.name);
    assert.ok(row.characters.draws>0&&row.characters.pipeline.validation==='verified','the working character pipeline remains active');
    if(mode==='after'){
     assert.ok(row.end.draws>row.start.draws&&row.end.heightDraws>row.start.heightDraws,'visible art and actual world height pass both use the Blender kit');
     assert.equal(row.end.plans,row.start.plans,'idle world rendering reuses compiled building geometry');
     assert.equal(row.end.projections,row.start.projections,'idle world rendering reuses projection');
     assert.equal(row.end.pathBuilds,row.start.pathBuilds,'idle world rendering reuses Canvas paths');
     assert.ok(row.propsEnd.draws>row.propsStart.draws&&row.propsEnd.heightDraws>row.propsStart.heightDraws,
      'visible quayside props and their world height fields use grounded geometry');
     for(const key of['plans','projections','pathBuilds'])assert.equal(row.propsEnd[key],row.propsStart[key],'idle quayside props reuse '+key);
    }
    assert.equal(row.contexts,2,'city upgrade uses only the existing lighting and character WebGL contexts');
    await page.locator('#defaultCanvas0').screenshot({path:path.join(out,scene.name+'-'+mode+'.png')});report.world.push({mode,...row});
   }
  }
  report.profile={timing:'Host CPU elapsed milliseconds including Canvas synchronization; not GPU timestamps or physical-phone FPS',scenes:[]};
  for(const [mode,page]of[['before',before],['after',after]]){
   const timings=await page.evaluate(()=>{
    zoom=.85;const baseX=600-width/(2*zoom),baseY=7800-height/(2*zoom);camX=baseX;camY=baseY;
    viewLeft=camX;viewTop=camY;viewRight=camX+width/zoom;viewBottom=camY+height/zoom;
    worldTimeMs=13/24*DAY_MS;updateSunVector();
    const renderer=typeof CityBuildings3D!=='undefined'?CityBuildings3D:null;
    const bs=activeBuildings.filter(b=>b.isBlockBuilding&&
     (b.cityArchitecture===undefined||[0,1,3,4].includes(b.cityArchitecture))&&inView(b.x,b.y,Math.max(b.w,b.h)+150));
    const g=createGraphics(width,height);g.pixelDensity(1);
    function run(index,pan){
     camX=baseX+(pan?index*3.1:0);camY=baseY-(pan?index*2.3:0);
     background(66,79,79);g.clear();push();scale(zoom);translate(-camX,-camY);
     let t=performance.now();drawBuildings(bs,0,bs.length);pop();drawingContext.getImageData(0,0,1,1);const roof=performance.now()-t;
     g.push();g.scale(zoom);g.translate(-camX,-camY);t=performance.now();
     for(const b of bs){
      if(renderer)renderer.paintHeight(g,b,0);
      else {glRigMat(g,buildingRise(b)+groundElev(b.x,b.y),.12,0);g.rect(b.x-b.w/2,b.y-b.h/2,b.w,b.h);}
     }
     g.pop();g.drawingContext.getImageData(0,0,1,1);return {roof,height:performance.now()-t};
    }
    const summary=values=>{const sorted=values.slice().sort((a,b)=>a-b);
     return {median:sorted[Math.floor(sorted.length/2)],p95:sorted[Math.floor(sorted.length*.95)]};};
    const phases=[];
    try{
     for(const pan of[false,true]){
      for(let i=0;i<5;i++)run(0,false);
      const before=renderer&&renderer.getDiagnostics(),values=[];
      for(let i=0;i<25;i++)values.push(run(i,pan));
      phases.push({phase:pan?'camera-pan':'idle',samples:values.length,roofMs:summary(values.map(v=>v.roof)),
       heightMs:summary(values.map(v=>v.height)),before,after:renderer&&renderer.getDiagnostics()});
     }
    }finally{g.remove();}
    return {buildings:bs.length,faces:renderer?bs.reduce((n,b)=>n+renderer.plan(b).faces.length,0):null,phases};
   });
   assert.ok(timings.buildings>0,'stage profile uses actual visible canal buildings');
   for(const phase of timings.phases){
    assert.equal(phase.samples,25);
    if(mode==='after'){
     assert.equal(phase.after.plans,phase.before.plans,'camera movement reuses compiled mesh data');
     assert.equal(phase.after.pathBuilds,phase.before.pathBuilds,'both idle and moving cameras reuse compiled face paths');
     if(phase.phase==='camera-pan')assert.ok(phase.after.projections>phase.before.projections,'camera movement refreshes numeric projection and bounds');
    }
   }
   report.profile.scenes.push({mode,...timings});
  }
  assert.deepEqual(errors,[],'no uncaught browser errors');report.errors=errors;
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log('Actual Blender city artwork, '+report.height.samples.length+' projected height/material samples, native day/night/rain world and stable caches passed: '+out+'/report.json');
 }finally{await Promise.all(pages.map(p=>p.close()));await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

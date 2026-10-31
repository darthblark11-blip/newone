// Real p5 camera-pan evidence using the repository's actual world renderer.
// The viewport matches the landscape aspect ratio in the reported gameplay.
// Artifacts stay outside the checkout. This is visual/geometry QA, not an FPS
// benchmark: PNG capture and instrumentation intentionally add browser work.
//
// VIS_DEPS=/workspace/onboarding-newone VIS_CHROME=/usr/bin/chromium \
//   VIS_P5=/tmp/p5-1.9.4.min.js FOREST_PAN_OUT=/tmp/forest-pan \
//   node tools/visual-forest-pan.js 2 15000 6600 .66 hour=13
// Add `night hour=19` for the dusk light pass. ffmpeg is optional; the HTML
// frame viewer remains available when no video encoder is installed.
const fs=require('fs'),path=require('path'),Module=require('module');
const filename=path.join(__dirname,'visual-world.js');
process.env.VW_W=process.env.VW_W||'1460';
process.env.VW_H=process.env.VW_H||'675';
process.argv[2]=process.argv[2]||'2';process.argv[3]=process.argv[3]||'15000';
process.argv[4]=process.argv[4]||'6600';process.argv[5]=process.argv[5]||'.66';
let src=fs.readFileSync(filename,'utf8')
  .replace("const OUT = path.join(__dirname, 'out');", "const OUT=process.env.FOREST_PAN_OUT||'/tmp/newone-forest-pan';")
  .replace("const P5 = path.join(SP, 'node_modules/p5/lib/p5.min.js');", "const P5=process.env.VIS_P5||path.join(SP,'node_modules/p5/lib/p5.min.js');")
  .replace('const page = ', "const GAME_SOURCE=fs.readFileSync(GAME,'utf8');\nconst page = ")
  .replace("${fs.readFileSync(GAME, 'utf8')}", '${GAME_SOURCE}')
  .replace("  step('sorted',  () => drawDepthSorted());", "  if(player)step('player',()=>actorShow(player));\n  step('sorted',  () => drawDepthSorted());");
const inject=String.raw`
  const sourceHash=require('crypto').createHash('sha256').update(GAME_SOURCE).digest('hex');
  fs.writeFileSync(path.join(OUT,'game-source.js'),GAME_SOURCE);
  const captured=await p.evaluate(({frames,dx,dy})=>{
    const start={x:window.__wx,y:window.__wy};
    let witness=null,best=Infinity;
    for(const ch of chunkMgr.chunks.values())for(const d of ch.decor){
      if(d.forestSpecies!=='DOUGLAS_FIR')continue;
      const distance=(d.x-start.x)**2+(d.y-start.y)**2;
      if(distance<best){best=distance;witness=d;}
    }
    if(!witness)throw new Error('No Douglas fir in the generated pan scene');
    // Record the real helper's local vertices while still calling its native
    // painter. Camera movement may change translation, never these vertices.
    let focused=false,current=null,helperCalls=[];
    const painter=forestPolygonPainter,proxyCache=new WeakMap();
    forestPolygonPainter=function(g){
      const original=painter(g);let proxy=proxyCache.get(original);
      if(!proxy){proxy={
        beginShape(){if(current)current.paths.push([]);return original.beginShape.apply(original,arguments);},
        vertex(x,y){if(current&&current.paths.length){
          const transform=current.context.getTransform(),base=current.transform;
          current.paths[current.paths.length-1].push([
            (transform.a*x+transform.c*y+transform.e-base.e)/zoom,
            (transform.b*x+transform.d*y+transform.f-base.f)/zoom]);
        }
          return original.vertex.apply(original,arguments);},
        endShape(){return original.endShape.apply(original,arguments);}
      };proxyCache.set(original,proxy);}return proxy;
    };
    const paint=paintForestClutter;
    paintForestClutter=function(g,d,t){const was=focused;focused=d===witness;
      try{return paint(g,d,t);}finally{focused=was;}};
    const wrap=fn=>function(){
      if(!focused)return fn.apply(this,arguments);
      const previous=current,captured={paths:[]};
      const context=arguments[0].drawingContext;
      // Keep the actual Canvas basis but subtract the layer translation. A
      // rotate before the helper must be caught too, not merely raw vertices.
      Object.defineProperties(captured,{context:{value:context},transform:{value:context.getTransform()}});
      current=captured;
      try{return fn.apply(this,arguments);}finally{current=previous;helperCalls.push(captured);}
    };
    if(typeof forestTreeCrown==='function')forestTreeCrown=wrap(forestTreeCrown);
    if(typeof forestTreeBough==='function')forestTreeBough=wrap(forestTreeBough);
    if(typeof forestTreeBoughFacet==='function')forestTreeBoughFacet=wrap(forestTreeBoughFacet);
    if(typeof forestEvergreenTier==='function')forestEvergreenTier=wrap(forestEvergreenTier);
    leftStick={active:false,dx:0,dy:0,dist:0};rightStick={active:false,dx:0,dy:0,dist:0};
    const actor=new Character(start.x,start.y,true);player=actor;
    actor.isMoving=true;actor.gait=.4;actor.aimAngle=0;
    const images=[],geometry=[],camera=[];
    for(let i=0;i<frames;i++){
      const angle=i*Math.PI*2/(frames-1);
      const centerX=start.x+Math.sin(angle)*dx;
      const centerY=start.y+Math.cos(angle)*dy;
      camX=centerX-width/zoom*.5;camY=centerY-height/zoom*.5;
      viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;
      actor.x=centerX;actor.y=centerY;actor.walkCycle=i*.18;
      frameCount++;helperCalls=[];redraw();
      images.push(document.querySelector('#defaultCanvas0').toDataURL('image/png').split(',')[1]);
      geometry.push(helperCalls);camera.push({x:centerX,y:centerY});
    }
    return {images,geometry,camera,witness:{species:witness.forestSpecies,x:witness.x,y:witness.y,
      key:witness.forestTrunkKey,scale:witness.s},errors:window.__errs,
      p5:typeof p5==='undefined'?null:p5.VERSION};
  },{frames:Number(process.env.FOREST_PAN_FRAMES||120),dx:Number(process.env.FOREST_PAN_DX||430),dy:Number(process.env.FOREST_PAN_DY||300)});
  const frameDir=path.join(OUT,'frames');fs.mkdirSync(frameDir,{recursive:true});
  const files=captured.images.map((data,i)=>{
    const name='frame-'+String(i).padStart(4,'0')+'.png';
    fs.writeFileSync(path.join(frameDir,name),Buffer.from(data,'base64'));return 'frames/'+name;
  });
  // A rotated old evergreen changes these arrays even though rotate() is never
  // called. Keep the samples so the invariant can be inspected independently.
  const same=(a,b)=>typeof a==='number'&&typeof b==='number'?Math.abs(a-b)<1e-7:
    Array.isArray(a)&&Array.isArray(b)?a.length===b.length&&a.every((v,i)=>same(v,b[i])):
    a&&b&&typeof a==='object'&&typeof b==='object'?Object.keys(a).length===Object.keys(b).length&&
      Object.keys(a).every(k=>same(a[k],b[k])):a===b;
  const first=captured.geometry[0];
  const changed=captured.geometry.map((g,i)=>!same(g,first)?i:-1).filter(i=>i>=0);
  const report={source:GAME,sourceHash,p5:captured.p5,viewport:{width:W,height:H},
    zoom:ZOOM,hour:HOUR,frames:files.length,witness:captured.witness,
    camera:captured.camera,crownLocalGeometryStable:changed.length===0,
    changedFrames:changed,geometrySamples:captured.geometry,
    errors:captured.errors.concat(bad),note:'Visual/geometry QA capture, not a framerate benchmark'};
  fs.writeFileSync(path.join(OUT,'pan-report.json'),JSON.stringify(report,null,2));
  const title='Level 2 forest camera pan — '+HOUR+':00';
  fs.writeFileSync(path.join(OUT,'index.html'),
    '<!doctype html><meta charset=utf8><title>'+title+'</title>'+ 
    '<style>body{margin:0;background:#172522;color:#e9efd9;font:16px sans-serif}header{padding:12px}img{display:block;width:100%;height:auto}input{width:95%;margin:12px}</style>'+ 
    '<header>'+title+' · <button id=play>Pause</button> · <a href=pan-report.json>Geometry report</a> · <a href=forest-pan.mp4>Video</a></header>'+ 
    '<img id=frame><input id=scrub type=range min=0 max='+(files.length-1)+' value=0>'+ 
    '<script>const frames='+JSON.stringify(files)+';let n=0,playing=true;const image=document.getElementById("frame"),scrub=document.getElementById("scrub");function show(){image.src=frames[n];scrub.value=n}show();setInterval(()=>{if(playing){n=(n+1)%frames.length;show()}},1000/30);scrub.oninput=()=>{n=+scrub.value;show()};document.getElementById("play").onclick=()=>{playing=!playing;document.getElementById("play").textContent=playing?"Pause":"Play"}</script>');
  const encode=require('child_process').spawnSync('ffmpeg',['-y','-loglevel','error','-framerate','30',
    '-i',path.join(frameDir,'frame-%04d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p',
    '-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-movflags','+faststart',path.join(OUT,'forest-pan.mp4')],{encoding:'utf8'});
  if(encode.error||encode.status)console.log('Video encoding unavailable; HTML frame viewer is complete.');
  console.log(JSON.stringify({...report,camera:undefined,geometrySamples:undefined}));
  if(report.errors.length||!report.crownLocalGeometryStable)process.exitCode=1;
`;
const needle="  const position = await p.evaluate('({x:window.__wx,y:window.__wy})');";
if(!src.includes(needle))throw new Error('World renderer capture hook changed');
src=src.replace(needle,needle+inject);
const mod=new Module(filename,module);mod.filename=filename;
mod.paths=Module._nodeModulePaths(__dirname);mod._compile(src,filename);

// Real WebGL parity for the lighting rig's persistent canvas textures.
// Compare every output pixel with the former texImage2D-per-frame upload,
// including physical canvas density, rig tiers, resize and fresh contexts.
// VIS_DEPS=/workspace/onboarding-newone VIS_CHROME=/usr/bin/chromium \
//   node tools/check-lighting-upload.js
const fs = require('fs'), path = require('path');
const deps = process.env.VIS_DEPS || '/workspace/onboarding-newone';
const { chromium } = require(path.join(deps, 'node_modules/playwright'));
const p5 = fs.readFileSync(path.join(deps, 'node_modules/p5/lib/p5.min.js'), 'utf8');
const source = fs.readFileSync(process.env.GAME_JS || path.join(__dirname, '..', 'game.js'), 'utf8');
const fixture = `
window.preload=function(){};
window.setup=function(){createCanvas(360,640);pixelDensity(1);noLoop();
  randomSeed(71);noiseSeed(1337);window.__ready=true;};
window.__lightingCheck=function(){
  BIOME_ACTIVE=true;currentBiome=1;currentLevel=1;authoredCore=false;
  zoom=.65;camX=camY=0;isRaining=false;
  activeBuildings=buildings=[
    {x:125,y:230,w:90,h:120},
    {x:330,y:440,w:130,h:180},
    {x:210,y:570,w:65,h:90,isParkingCar:true},
    {x:160,y:760,w:150,h:100,isWater:true},
    {x:90,y:180,w:12,h:12,isStreetLight:true},
    {x:320,y:640,w:12,h:12,isStreetLight:true},
    {x:410,y:170,w:12,h:12,isStreetLight:true}
  ];
  enemiesList=[{x:250,y:250,hp:100,eType:'ARMORED',aimAngle:.8,muzzleFlash:3,
    currentWeapon:WEAPONS.SMG,stunTimer:0},
    {x:340,y:380,hp:100,eType:'ROBOT',aimAngle:1.7,muzzleFlash:2,
    currentWeapon:WEAPONS.PISTOL,stunTimer:0}];
  allies=[{x:185,y:425,hp:100,aimAngle:1.4,stunTimer:0}];
  player={x:205,y:480,hp:100,aimAngle:-.5,stunTimer:0,muzzleFlash:3,
    currentWeapon:WEAPONS.ASSAULT_RIFLE};
  fires=[{x:390,y:800,r:35,life:100}];
  chunkMgr=null;
  window.glRigClock=function(){};window.glRigWatchdog=function(){};
  if(!glRigInit())throw Error('WebGL2 unavailable: '+GLRig.failure);
  const optimizedUpload=window.glRigUploadCanvas;
  const optimizedBind=window.glRigBindTex;
  const referenceUpload=function(gl,tex,canvas){
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
  };
  const referenceBind=function(gl,prog,name,unit,tex){
    const loc=prog._u[name];if(loc===undefined)return;
    gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.uniform1i(loc,unit);
  };
  const cases=[],errors=[];let imageCalls=0,subCalls=0,bindCalls=0,samplerCalls=0;
  const countedContexts=new WeakSet();
  function instrument(){
    const gl=GLRig.gl;if(countedContexts.has(gl))return;countedContexts.add(gl);
    const image=gl.texImage2D.bind(gl),sub=gl.texSubImage2D.bind(gl);
    const bind=gl.bindTexture.bind(gl),sampler=gl.uniform1i.bind(gl);
    gl.texImage2D=function(){imageCalls++;return image.apply(null,arguments);};
    gl.texSubImage2D=function(){subCalls++;return sub.apply(null,arguments);};
    gl.bindTexture=function(){bindCalls++;return bind.apply(null,arguments);};
    gl.uniform1i=function(){samplerCalls++;return sampler.apply(null,arguments);};
  }
  function base(){
    resetMatrix();background(92,103,117);noStroke();
    fill(138,151,163);rect(40,70,120,220);fill(46,63,82);rect(210,260,110,180);
    fill(176,91,54);ellipse(145,450,90,65);fill(224,206,118);rect(0,530,width,7);
  }
  function render(upload){
    window.glRigUploadCanvas=upload;
    window.glRigBindTex=upload===optimizedUpload?optimizedBind:referenceBind;
    base();_emitFrame=-1;GLRig.on=true;
    if(!glRigFrame())throw Error('Rig did not render: '+GLRig.failure);
    const gl=GLRig.gl,px=new Uint8Array(GLRig.w*GLRig.h*4);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.readPixels(0,0,GLRig.w,GLRig.h,gl.RGBA,gl.UNSIGNED_BYTE,px);
    const error=gl.getError();if(error!==gl.NO_ERROR)errors.push(error);
    return px;
  }
  function compare(name,w,h,density,tier,hour,wet){
    pixelDensity(density);resizeCanvas(w,h);GLRig.host=drawingContext.canvas;
    GLRig.tier=tier;GLRig.resize=false;glRigResize();instrument();
    viewLeft=0;viewTop=0;viewRight=width/zoom;viewBottom=height/zoom;
    worldTimeMs=hour/24*DAY_MS;updateSunVector();isRaining=wet;
    frameCount=91+cases.length;GLRig.ms=16;
    const img0=imageCalls,sub0=subCalls;
    const actual=render(optimizedUpload);
    const first={image:imageCalls-img0,sub:subCalls-sub0};
    const img1=imageCalls,sub1=subCalls,bind1=bindCalls,sampler1=samplerCalls;
    const repeat=render(optimizedUpload);
    const stable={image:imageCalls-img1,sub:subCalls-sub1,
      bindings:bindCalls-bind1,samplers:samplerCalls-sampler1};
    const expected=render(referenceUpload);
    let changed=0,repeatChanged=0,colourPixels=0;
    for(let i=0;i<actual.length;i++){
      if(actual[i]!==expected[i])changed++;
      if(actual[i]!==repeat[i])repeatChanged++;
    }
    for(let i=0;i<actual.length;i+=4){
      if(actual[i] || actual[i+1] || actual[i+2])colourPixels++;
    }
    cases.push({name,pixels:actual.length/4,colourPixels,changed,repeatChanged,first,stable,
      dimensions:[GLRig.host.width,GLRig.host.height,GLRig.hw,GLRig.hh]});
  }
  compare('phone night',360,640,1,0,22,false);
  const atlas=document.createElement('canvas');atlas.width=atlas.height=2;
  const atlasCtx=atlas.getContext('2d');atlasCtx.fillStyle='rgb(160,128,250)';
  atlasCtx.fillRect(0,0,2,2);
  if(!glRigSetNormalAtlas(atlas,.35))throw Error('Normal atlas upload failed');
  compare('normal atlas update',360,640,1,0,22,false);
  compare('same-size day rain',360,640,1,0,13,true);
  compare('phone tier 1',360,640,1,1,21,false);
  compare('phone tier 2',360,640,1,2,21,true);
  compare('physical density 2',360,640,2,2,17,true);
  compare('landscape resize',640,360,1,0,20,false);
  // A restored context creates fresh texture objects. Reinitializing that same
  // lifecycle path here also verifies that old upload dimensions cannot survive.
  GLRig.ok=false;GLRig.on=false;GLRig.prog={};GLRig.tex={};GLRig.fbo={};
  GLRig.w=GLRig.h=0;
  if(!glRigInit())throw Error('Fresh context unavailable: '+GLRig.failure);
  compare('fresh context',360,640,1,0,22,false);
  window.glRigUploadCanvas=optimizedUpload;
  window.glRigBindTex=optimizedBind;
  return {cases,errors};
};`;
(async () => {
  const browser = await chromium.launch({executablePath:process.env.VIS_CHROME || '/usr/bin/chromium',
    headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
      '--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:640,height:640}});
    const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
    const storage=`const mem={};Object.defineProperty(window,'localStorage',{value:{
      getItem:k=>mem[k] || null,setItem:(k,v)=>mem[k]=String(v),removeItem:k=>delete mem[k]}});`;
    await page.setContent('<html><body><script>'+storage+'</script><script>'+p5+
      '</script><script>'+source+'\n'+fixture+'</script></body></html>');
    await page.waitForFunction(()=>window.__ready,{timeout:30000});
    const result=await page.evaluate(()=>window.__lightingCheck());
    let failures=0;
    for(const c of result.cases){
      const pass=c.colourPixels>1000 && c.changed===0 && c.repeatChanged===0 && c.stable.image===0 &&
        c.stable.sub===2 && c.stable.bindings<=7 && c.stable.samplers===0;
      if(!pass)failures++;
      console.log((pass?'PASS ':'FAIL ')+c.name+': '+c.pixels+' pixels, '+c.changed+
        ' differing channels; initial uploads '+JSON.stringify(c.first)+
        ', steady uploads '+JSON.stringify(c.stable));
    }
    if(result.errors.length || pageErrors.length){failures++;console.error(result.errors,pageErrors);}
    console.log(result.cases.length-failures+'/'+result.cases.length+' real WebGL cases passed');
    if(failures)process.exitCode=1;
  } finally {await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});

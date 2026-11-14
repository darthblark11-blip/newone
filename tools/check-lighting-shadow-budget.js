// Exact WebGL parity for saturated directional/polar shadow early exits.
// Native glRigFrame paints the G-buffer, all local-light passes and composite.
// Baseline shaders come from the published branch rather than a second copy
// of the optimized loop. Synthetic shader counters prove both exits execute.
// VIS_DEPS=/path/to/deps BATTLE_P5=/path/to/p5.min.js node tools/check-lighting-shadow-budget.js
// SHADOW_BASELINE_JS=/path/to/before.js GAME_JS=/path/to/after.js selects snapshots.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
function dependency(name){try{return require(name);}catch(e){if(!process.env.VIS_DEPS)throw e;return require(path.join(process.env.VIS_DEPS,'node_modules',name));}}
let chromium;try{chromium=dependency('playwright-core').chromium;}catch(_){chromium=dependency('playwright').chromium;}
const sourcePath=process.env.GAME_JS||path.join(__dirname,'..','game.js');
const source=fs.readFileSync(sourcePath,'utf8');
const baseline=process.env.SHADOW_BASELINE_JS?fs.readFileSync(process.env.SHADOW_BASELINE_JS,'utf8'):
 execFileSync('git',['show','37dfd72:game.js'],{cwd:path.join(__dirname,'..'),maxBuffer:8e6}).toString();
function shaderOf(text,name){const match=text.match(new RegExp('const '+name+' = `([\\s\\S]*?)`;'));assert(match,name+' exists');return match[1];}
const reference={sun:shaderOf(baseline,'GLRIG_FS_SUN'),polar:shaderOf(baseline,'GLRIG_FS_POLAR')};
const candidate={sun:shaderOf(source,'GLRIG_FS_SUN'),polar:shaderOf(source,'GLRIG_FS_POLAR')};
assert(/if\s*\(vis\s*==\s*0\.0\)\s*break;/.test(candidate.sun),'Candidate exits only at zero sun visibility');
assert(/if\s*\(strength\s*==\s*1\.0\)\s*break;/.test(candidate.polar),'Candidate exits only at full polar occlusion');
for(const name of ['sun','polar'])assert.notEqual(reference[name],candidate[name],name+' parity requires distinct published and candidate shaders');
const p5Path=process.env.BATTLE_P5||(process.env.VIS_DEPS?path.join(process.env.VIS_DEPS,'node_modules/p5/lib/p5.min.js'):require.resolve('p5/lib/p5.min.js'));
const p5=fs.readFileSync(p5Path,'utf8');
const fixture=`
window.preload=function(){};
window.setup=function(){createCanvas(320,480);pixelDensity(1);noLoop();
 leftStick={active:false,dx:0,dy:0,base:{x:80,y:320}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:240,y:370}};
 randomSeed(71);noiseSeed(1337);window.__ready=true;};
window.__shadowCheck=function(){
 window.glRigClock=window.glRigWatchdog=function(){};
 if(!glRigInit())throw Error('WebGL unavailable: '+GLRig.failure);
 const gl=GLRig.gl,candidate={sun:GLRig.prog.sun,polar:GLRig.prog.polar};
 const sources={reference:${JSON.stringify(reference)},candidate:${JSON.stringify(candidate)}};
 const expand=text=>text.split('$'+'{GLRIG_SUN_STEPS}').join(String(GLRIG_SUN_STEPS))
   .split('$'+'{GLRIG_POLAR_STEPS}').join(String(GLRIG_POLAR_STEPS));
 const reference={},uniforms={},cases=[],glErrors=[];
 for(const name of ['sun','polar']){
  reference[name]=glRigProgram(gl,expand(sources.reference[name]),name+'-published');
  if(!reference[name])throw Error('Published shader failed: '+GLRig.failure);
  uniforms[name]={reference:Object.keys(reference[name]._u).sort(),candidate:Object.keys(candidate[name]._u).sort()};
 }
 const nativeHeight=glRigPaintHeight;
 let alphaFixture=false;
 window.glRigPaintHeight=function(){nativeHeight();if(alphaFixture){
  // Partial coverage and translucent undersurfaces stress the normal pass's
  // alpha-dependent branch, without replacing the native scene heightfield.
  const g=GLRig.hgt;g.push();g.noStroke();g.fill(190,95,42,85);
  g.rect(GLRig.hw*.62,GLRig.hh*.28,GLRig.hw*.18,GLRig.hh*.15);
  g.fill(115,160,90,175);g.ellipse(GLRig.hw*.20,GLRig.hh*.70,47,63);g.pop();
 }};
 function scene(kind,level,hour,wet){
  currentLevel=currentBiome=level;BIOME_ACTIVE=level!==9;authoredCore=false;isRaining=wet;
  isPaused=false;doTick=true;started=true;isDead=isWin=killcamMode=false;
  zoom=.65;camX=0;camY=level===9?-1450:0;
  viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;
  worldTimeMs=hour/24*DAY_MS;updateSunVector();
  const w=width/zoom,h=height/zoom,x=v=>camX+v*w,y=v=>camY+v*h;
  activeParkingCars=[];parkingCars=[];barrels=[];allies=[];chunkMgr=null;
  activeBuildings=buildings=[
   {x:x(.22),y:y(.22),w:w*.16,h:h*.19,_rise:85,undergroundProp:level===9?'PILLAR':undefined},
   {x:x(.70),y:y(.64),w:w*.22,h:h*.21,_rise:65},
   {x:x(.23),y:y(.50),w:12,h:12,isStreetLight:true},
   {x:x(.74),y:y(.45),w:12,h:12,isStreetLight:true},
   {x:x(.57),y:y(.78),w:w*.28,h:h*.13,isWater:true},
   {x:x(.38),y:y(.39),w:w*.16,h:h*.04,propType:'CABIN',_rise:45},
   {x:x(.85),y:y(.18),w:65,h:90,isParkingCar:true}
  ];
  if(kind==='dense'||kind==='doors')for(let row=0;row<4;row++)for(let col=0;col<4;col++)
   buildings.push({x:x(.13+col*.23),y:y(.10+row*.23),w:w*.15,h:h*.16,_rise:140});
  if(kind==='doors'){
   buildings.push({x:x(.27),y:y(.51),w:w*.25,h:20,_rise:120,isGovFortress:true,hp:1000},
     {x:x(.73),y:y(.51),w:w*.25,h:20,_rise:120,isGovFortress:true,hp:0},
     {x:x(.46),y:y(.51),w:12,h:60,_rise:80,nm0OfficeDoor:true,hp:1000},
     {x:x(.54),y:y(.51),w:12,h:60,_rise:80,nm0OfficeDoor:true,hp:0});
   window.undercityNorthBreached=true;window.undercitySouthBreached=false;
  }
  if(kind==='forest'){
   const decor=[];for(let row=0;row<5;row++)for(let col=0;col<4;col++){
    const species=['DOUGLAS_FIR','WESTERN_CEDAR','RED_ALDER','CHARRED_SNAG'][(col+row)%4];
    decor.push({t:species==='CHARRED_SNAG'?'SNAG':'TREE',forestSpecies:species,
      x:x(.14+col*.23),y:y(.10+row*.20),s:1.2+(row%2)*.5,c:.15,k:-.2,r:(row+col)*.7,
      forestCrownScale:1.1,forestCanopyStyle:'TIMBER'});
   }
   chunkMgr={biome:level,chunks:new Map([['0,0',{cx:0,cy:0,decor}]])};
  }
  player=new Character(x(.47),y(.52),true);player.aimAngle=-.5;player.hp=100;
  player.currentWeapon=WEAPONS.ASSAULT_RIFLE;player.stunTimer=0;player.muzzleFlash=3;
  enemiesList=[new Character(x(.40),y(.38),false,'ARMORED_STANDARD'),new Character(x(.68),y(.68),false,'ROBOT')];
  enemiesList[0].aimAngle=.8;enemiesList[0].muzzleFlash=2;enemiesList[1].aimAngle=1.7;
  if(kind==='alpha'){
   player.shovelLevel=level;player.shovelDepth=36;player.shovelDepthTarget=36;
   enemiesList[0].stance={value:1,to:1,elapsedMs:0,durationMs:0};
  }
  fires=[{x:x(.78),y:y(.81),r:35,life:100},{x:x(.15),y:y(.79),r:26,life:100}];
  occultProjectiles.length=occultGroundEffects.length=occultSpellBursts.length=0;
  if(level===9){
   const red=createOccultMagician('RED',x(.53),y(.37),'shadow-red');enemiesList.push(red);
   red.occult.phase='CHARGE';red.occult.cast='FIREBALL';red.occult.chargeMs=600;red.occult.chargeDurationMs=780;
  }
 }
 function base(){
  resetMatrix();background(92,103,117);noStroke();fill(138,151,163);rect(20,45,110,180);
  fill(46,63,82);rect(width*.63,height*.40,width*.25,height*.34);
  fill(176,91,54);ellipse(width*.40,height*.74,90,65);fill(224,206,118);rect(0,height*.86,width,7);
 }
 function read(target){
  const w=target?target.w:GLRig.w,h=target?target.h:GLRig.h;
  gl.bindFramebuffer(gl.FRAMEBUFFER,target?target.fbo:null);
  const pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;
 }
 function render(programs){
  GLRig.prog.sun=programs.sun;GLRig.prog.polar=programs.polar;GLRig.on=true;_emitFrame=-1;base();
  // Native frames overwrite used atlas rows only. Clear unused rows equally so
  // a comparison cannot accidentally inherit the preceding shader's result.
  gl.disable(gl.SCISSOR_TEST);gl.bindFramebuffer(gl.FRAMEBUFFER,GLRig.fbo.polar.fbo);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  if(!glRigFrame())throw Error('Rig failed: '+GLRig.failure);
  const targets={composite:read(null),normal:read(GLRig.fbo.normal),light:read(GLRig.fbo.light),
    polar:read(GLRig.fbo.polar),occlusion:read(GLRig.fbo.occ)};
  const error=gl.getError();if(error!==gl.NO_ERROR)glErrors.push(error);
  return targets;
 }
 function difference(actual,expected){let changed=0,maxDiff=0,nonzero=0;
  for(let i=0;i<actual.length;i++){
   if(actual[i]!==expected[i])changed++;maxDiff=Math.max(maxDiff,Math.abs(actual[i]-expected[i]));
   if((i&3)!==3&&actual[i])nonzero++;
  }return {pixels:actual.length/4,changed,maxDiff,nonzero};
 }
 function compare(name,kind,level,hour,wet,w=320,h=480,density=1,tier=0,lightTier=0){
  started=false;pixelDensity(density);resizeCanvas(w,h,true);GLRig.host=drawingContext.canvas;
  GLRig.tier=tier;GLRig.lightTier=lightTier;GLRig.resize=false;glRigResize();GLRig.ms=16;
  alphaFixture=kind==='alpha';scene(kind,level,hour,wet);frameCount=131+cases.length;
  const actual=render(candidate),lights=GLRig.lights.length,spotlights=GLRig.lights.filter(l=>l.half!==undefined).length;
  const expected=render(reference),targets={};
  for(const target of Object.keys(actual))targets[target]=difference(actual[target],expected[target]);
  let saturatedPolar=0;for(let i=1;i<actual.polar.length;i+=4)if(actual.polar[i]===255)saturatedPolar++;
  cases.push({name,targets,lights,spotlights,saturatedPolar,day:sceneLightDaylight(),wet,density,tier,lightTier});
 }
 compare('daylight walls','dense',1,13,false);
 compare('midnight walls','dense',1,0,false);
 compare('dawn walls','dense',2,6,false);
 compare('dusk walls','dense',2,18,false);
 compare('rain daylight','dense',2,13,true);
 compare('rain night','dense',2,22,true);
 compare('open and adjoining closed doors','doors',2,18,false);
 compare('door shadows at night','doors',2,22,true);
 compare('dense forest daylight','forest',2,12,false);
 compare('canopy over light carriers','forest',2,22,false);
 compare('rain and translucent undersurfaces','alpha',2,21,true);
 compare('low sun and partial alpha','alpha',1,7,false);
 const atlas=document.createElement('canvas');atlas.width=atlas.height=2;
 atlas.getContext('2d').fillStyle='rgb(160,128,250)';atlas.getContext('2d').fillRect(0,0,2,2);
 if(!glRigSetNormalAtlas(atlas,.35))throw Error('Authored normal atlas upload failed');
 compare('rotated authored normal atlas','forest',2,18,true);
 compare('landscape resize','dense',2,22,false,480,320);
 compare('physical density two','forest',2,17,true,320,480,2);
 compare('rig resolution tier one','doors',2,21,false,320,480,1,1);
 compare('rig resolution tier two','alpha',2,21,true,320,480,2,2);
 compare('local light budget tier one','dense',2,22,false,320,480,1,0,1);
 compare('local light budget tier two','forest',2,22,true,320,480,1,0,2);
 compare('underground noon','dense',9,12,false);
 compare('underground midnight','dense',9,0,false);
 window.glRigPaintHeight=nativeHeight;

 // Count texture samples in the real GLSL loops. The first channel stores an
 // integer tap count, while remaining channels retain visibility/nearest/peak.
 // Uniform synthetic textures isolate saturation from geometry and filtering.
 function debugSource(kind,text){
  text=expand(text);
  if(kind==='sun'){
   text=text.replace('float marchSun(', 'float sampleCount = 0.0;\\nfloat marchSun(')
    .replace('float hs  = texture(uHgt, p).r * uHeightMax;', 'sampleCount += 1.0;\\n    float hs  = texture(uHgt, p).r * uHeightMax;');
   return text.slice(0,text.indexOf('void main()'))+'void main(){float vis=marchSun(vUV,0.0);oCol=vec4(sampleCount/255.0,vis,0.0,1.0);}';
  }
  return text.replace('float nearest = 1.0;', 'float sampleCount = 0.0;\\n  float nearest = 1.0;')
   .replace('float o = texture(uOcc, vec2(0.5) + dir * r * 0.5).r;',
     'sampleCount += 1.0;\\n    float o = texture(uOcc, vec2(0.5) + dir * r * 0.5).r;')
   .replace('oCol = vec4(nearest, clamp(strength, 0.0, 1.0), 0.0, 1.0);',
     'oCol = vec4(sampleCount/255.0, nearest, clamp(strength,0.0,1.0), 1.0);');
 }
 const synthetic=glRigTexture(gl,8,8,gl.NEAREST),debugTarget=glRigTarget(gl,8,8,gl.NEAREST),counters=[];
 function count(kind,version,saturated){
  const program=glRigProgram(gl,debugSource(kind,sources[version][kind]),kind+'-'+version+'-count');
  if(!program)throw Error('Counter shader failed: '+GLRig.failure);
  const data=new Uint8Array(8*8*4);for(let i=0;i<data.length;i+=4){data[i]=saturated?255:128;data[i+3]=255;}
  gl.activeTexture(gl.TEXTURE7);gl.bindTexture(gl.TEXTURE_2D,synthetic);
  gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,8,8,gl.RGBA,gl.UNSIGNED_BYTE,data);
  gl.bindFramebuffer(gl.FRAMEBUFFER,debugTarget.fbo);gl.viewport(0,0,8,8);
  gl.bindVertexArray(GLRig.vao);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.BLEND);gl.useProgram(program);
  const set=(name,value)=>{if(program._u[name]!==undefined)gl.uniform1f(program._u[name],value);};
  const sampler=kind==='sun'?'uHgt':'uOcc';gl.uniform1i(program._u[sampler],7);
  if(kind==='sun'){
   gl.uniform2f(program._u.uMarchUV,.001,0);set('uSlope',0);set('uHeightMax',saturated?100:.1);
   set('uStep0',1);set('uGrow',1);set('uPenumbra',.1);
  }else set('uRMin',0);
  glRigDraw(gl,program,GLRIG_FULL);const pixels=read(debugTarget);gl.deleteProgram(program);
  const error=gl.getError();if(error!==gl.NO_ERROR)glErrors.push(error);
  return Array.from(pixels.slice(0,4));
 }
 for(const kind of ['sun','polar'])for(const saturated of [true,false])
  counters.push({kind,saturated,reference:count(kind,'reference',saturated),candidate:count(kind,'candidate',saturated)});
 gl.deleteTexture(synthetic);gl.deleteTexture(debugTarget.tex);gl.deleteFramebuffer(debugTarget.fbo);
 for(const name of ['sun','polar']){GLRig.prog[name]=candidate[name];gl.deleteProgram(reference[name]);}
 return {cases,glErrors,uniforms,counters,sunSteps:GLRIG_SUN_STEPS};
};`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:640,height:640}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const storage=`const mem={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>mem[k]||null,setItem:(k,v)=>mem[k]=String(v),removeItem:k=>delete mem[k]}});`;
  await page.setContent('<html><body><script>'+storage+'</script><script>'+p5+'</script><script>'+source+'\n'+fixture+'</script></body></html>');
  await page.waitForFunction(()=>window.__ready,{timeout:30000});
  const result=await page.evaluate(()=>window.__shadowCheck());
  assert.equal(errors.length,0,'Browser finishes without exceptions');assert.equal(result.glErrors.length,0,'WebGL finishes without errors');
  for(const [name,uniforms]of Object.entries(result.uniforms))assert.deepEqual(uniforms.candidate,uniforms.reference,name+' retains every published uniform');
  let saturatedRays=0,spotlights=0;
  for(const c of result.cases){
   assert(c.targets.composite.nonzero>1000,c.name+' must render a nonempty frame');
   for(const [name,target]of Object.entries(c.targets))assert.equal(target.changed,0,c.name+' preserves every '+name+' framebuffer channel');
   saturatedRays+=c.saturatedPolar;spotlights+=c.spotlights;
   console.log('PASS '+c.name+': composite/normal/light/polar/occlusion bytes identical; '+c.lights+' lights');
  }
  assert(saturatedRays>0,'Native scenes exercise fully opaque polar rays');assert(spotlights>0,'Native weapon spotlight participates');
  for(const c of result.counters){
   assert.deepEqual(c.candidate.slice(1),c.reference.slice(1),c.kind+' counter keeps the original shadow result');
   if(c.saturated){assert(c.candidate[0]<c.reference[0],c.kind+' actually skips saturated texture samples');assert.equal(c.candidate[0],1,c.kind+' saturates at its first sample');}
   else assert.equal(c.candidate[0],c.reference[0],c.kind+' keeps every unsaturated texture sample');
   console.log('PASS '+c.kind+' '+(c.saturated?'saturated':'partial')+' GPU counter: '+c.reference[0]+' → '+c.candidate[0]+' samples');
  }
  console.log(result.cases.length+' native WebGL scenes preserve all five framebuffer targets; saturated loops skip work only after exact saturation.');
  if(process.env.SHADOW_REPORT)fs.writeFileSync(process.env.SHADOW_REPORT,JSON.stringify({source:sourcePath,...result},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

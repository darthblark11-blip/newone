// Real WebGL pixel parity for the zero-directional-light shader fast path.
// No resolution, shadow, light-count or picture-quality reduction is allowed.
// SUN_BASELINE=/tmp/before.js GAME_JS=/tmp/after.js node tools/check-dungeon-gpu-performance.js
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
function dependency(name){try{return require(name);}catch(e){if(!process.env.VIS_DEPS)throw e;return require(path.join(process.env.VIS_DEPS,'node_modules',name));}}
let chromium;try{chromium=dependency('playwright-core').chromium;}catch(_){chromium=dependency('playwright').chromium;}
const sourcePath=process.env.GAME_JS||path.join(__dirname,'..','game.js');
const source=fs.readFileSync(sourcePath,'utf8');
const shaderOf=s=>{const m=s.match(/const GLRIG_FS_SUN = `([\s\S]*?)`;/);assert(m,'Sun shader missing');return m[1];};
const optimized=shaderOf(source);
const fastPath=/  \/\/ Uniform across the draw:[\s\S]*?  vec4 hgt = texture\(uHgt, vUV\);/;
assert(fastPath.test(optimized),'Uniform early return must precede all texture reads');
const reference=process.env.SUN_BASELINE?shaderOf(fs.readFileSync(process.env.SUN_BASELINE,'utf8')):
 optimized.replace(fastPath,'  vec4 hgt = texture(uHgt, vUV);');
assert.notEqual(reference,optimized,'Parity requires the prior shader, not a duplicate fast path');
const p5Path=process.env.BATTLE_P5||(process.env.VIS_DEPS?path.join(process.env.VIS_DEPS,'node_modules/p5/lib/p5.min.js'):require.resolve('p5/lib/p5.min.js'));
const p5=fs.readFileSync(p5Path,'utf8');
const fixture=`
window.preload=function(){};
window.setup=function(){createCanvas(360,640);pixelDensity(1);noLoop();
 leftStick={active:false,dx:0,dy:0,base:{x:80,y:480}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:280,y:530}};
 randomSeed(71);noiseSeed(1337);window.__ready=true;};
window.__sunCheck=function(){
 window.glRigClock=window.glRigWatchdog=function(){};
 if(!glRigInit())throw Error('WebGL unavailable: '+GLRig.failure);
 const gl=GLRig.gl,optimizedProgram=GLRig.prog.sun;
 const referenceSource=${JSON.stringify(reference)}.replace('$'+'{GLRIG_SUN_STEPS}',String(GLRIG_SUN_STEPS));
 const referenceProgram=glRigProgram(gl,referenceSource,'sun-baseline');
 if(!referenceProgram)throw Error('Baseline shader failed: '+GLRig.failure);
 const expectedUniforms=Object.keys(referenceProgram._u).sort(),actualUniforms=Object.keys(optimizedProgram._u).sort();
 const cases=[],glErrors=[];
 function scene(level,hour,wet){
  currentLevel=currentBiome=level;BIOME_ACTIVE=level!==9;authoredCore=false;isRaining=wet;
  zoom=.65;camX=0;camY=level===9?-1450:0;
  viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;
  worldTimeMs=hour/24*DAY_MS;updateSunVector();chunkMgr=null;
  activeParkingCars=[];parkingCars=[];barrels=[];allies=[];
  const y=level===9?-1100:330;
  activeBuildings=buildings=[{x:130,y,w:85,h:120,undergroundProp:level===9?'PILLAR':undefined},
    {x:340,y:y+200,w:130,h:180},{x:85,y:y-100,w:12,h:12,isStreetLight:true},
    {x:350,y:y+300,w:12,h:12,isStreetLight:true},{x:160,y:y+420,w:150,h:100,isWater:true}];
  player=new Character(200,y+150,true);player.aimAngle=-.5;player.hp=100;
  player.currentWeapon=WEAPONS.ASSAULT_RIFLE;player.stunTimer=0;player.muzzleFlash=3;
  enemiesList=[new Character(240,y+40,false,'ARMORED_STANDARD'),new Character(330,y+240,false,'ROBOT')];
  enemiesList[0].aimAngle=.8;enemiesList[1].aimAngle=1.7;
  fires=[{x:390,y:y+400,r:35,life:100}];
  occultProjectiles.length=occultGroundEffects.length=occultSpellBursts.length=0;
  if(level===9){
   const red=createOccultMagician('RED',270,y+80,'gpu-red');enemiesList.push(red);
   red.occult.phase='CHARGE';red.occult.cast='FIREBALL';red.occult.chargeMs=600;red.occult.chargeDurationMs=780;
   occultProjectiles.push({kind:'SHARD',x:300,y:y+160,ageMs:120,radius:6,angle:.3});
   occultGroundEffects.push({kind:'LAVA',x:130,y:y+260,angle:.15,length:300,ageMs:270,ttlMs:780,hitIds:[]});
  }
 }
 function base(){
  resetMatrix();background(92,103,117);noStroke();fill(138,151,163);rect(40,70,120,220);
  fill(46,63,82);rect(210,260,110,180);fill(176,91,54);ellipse(145,450,90,65);
  fill(224,206,118);rect(0,530,width,7);
 }
 function render(program){
  GLRig.prog.sun=program;GLRig.on=true;_emitFrame=-1;base();
  if(!glRigFrame())throw Error('Rig failed: '+GLRig.failure);
  const px=new Uint8Array(GLRig.w*GLRig.h*4);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  gl.readPixels(0,0,GLRig.w,GLRig.h,gl.RGBA,gl.UNSIGNED_BYTE,px);
  const error=gl.getError();if(error!==gl.NO_ERROR)glErrors.push(error);
  return px;
 }
 function compare(name,level,hour,wet,w=360,h=640,density=1,tier=0){
  pixelDensity(density);resizeCanvas(w,h);GLRig.host=drawingContext.canvas;
  GLRig.tier=tier;GLRig.resize=false;glRigResize();GLRig.ms=16;scene(level,hour,wet);frameCount=131+cases.length;
  const actual=render(optimizedProgram),expected=render(referenceProgram);let changed=0,nonzero=0,maxDiff=0;
  for(let i=0;i<actual.length;i++){if(actual[i]!==expected[i])changed++;maxDiff=Math.max(maxDiff,Math.abs(actual[i]-expected[i]));if((i&3)!==3&&actual[i])nonzero++;}
  cases.push({name,pixels:actual.length/4,changed,maxDiff,nonzero,day:sceneLightDaylight(),ambient:sceneLightAmbient(),lights:GLRig.lights.length});
 }
 compare('dungeon noon',9,12,false);
 compare('dungeon midnight',9,0,false);
 compare('dungeon landscape density2',9,12,false,640,360,2,0);
 compare('dungeon reduced rig tier',9,12,false,360,640,2,2);
 compare('surface midnight',1,0,false);
 compare('surface night rain',2,22,true);
 compare('surface daylight',1,13,false);
 compare('surface daylight rain',2,13,true);
 compare('surface sunset',3,18,true,640,360);
 GLRig.prog.sun=optimizedProgram;gl.deleteProgram(referenceProgram);
 return {cases,glErrors,expectedUniforms,actualUniforms,skippedShadowSamples:GLRIG_SUN_STEPS};
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
  const result=await page.evaluate(()=>window.__sunCheck());
  assert.deepEqual(result.actualUniforms,result.expectedUniforms,'The optimized shader retains every native uniform');
  assert.equal(result.glErrors.length,0,'Native WebGL frames must finish without errors');
  assert.equal(errors.length,0,'Browser must finish without exceptions');
  for(const c of result.cases){assert(c.nonzero>1000,c.name+' must render a nonempty frame');assert.equal(c.changed,0,c.name+' must preserve every framebuffer channel');console.log('PASS '+c.name+': '+c.pixels+' pixels, '+c.changed+' differing channels');}
  console.log(result.cases.length+'/'+result.cases.length+' native GPU parity cases passed; zero-sun path skips '+result.skippedShadowSamples+' shadow samples per light-buffer pixel');
  if(process.env.SUN_REPORT)fs.writeFileSync(process.env.SUN_REPORT,JSON.stringify({source:sourcePath,...result},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

// Native pixel parity through updateEntities -> actorShow -> depth painters.
// The reference injects the original 150-unit predicate, with AI frozen.
// DUNGEON_P5=/path/to/p5.min.js node tools/check-zombie-render-culling.js
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function dependency(name){try{return require(name);}catch(e){if(!process.env.VIS_DEPS)throw e;return require(path.join(process.env.VIS_DEPS,'node_modules',name));}}
let chromium;try{chromium=dependency('playwright-core').chromium;}catch(_){chromium=dependency('playwright').chromium;}
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'..','game.js'),'utf8');
const p5Path=process.env.DUNGEON_P5||(process.env.VIS_DEPS?path.join(process.env.VIS_DEPS,'node_modules/p5/lib/p5.min.js'):require.resolve('p5/lib/p5.min.js'));
const p5=fs.readFileSync(p5Path,'utf8');
const fixture=`
window.preload=()=>{};window.setup=()=>{createCanvas(320,240);pixelDensity(1);noLoop();
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};window.__ready=true;};
window.__checkCull=()=>{
 const nativePad=actorRenderCullPad,nativeShow=Character.prototype.show,rows=[];
 let shown=0,totalPoses=0,guardChecks=0;
 Character.prototype.show=function(){shown++;return nativeShow.apply(this,arguments);};
 currentLevel=currentBiome=9;BIOME_ACTIVE=false;authoredCore=null;started=true;doTick=false;
 isPaused=true;isDead=isWin=killcamMode=false;inStoryIntro=inStoryRoom=inTravelMenu=inWorldBuildingMenu=false;
 nm0AmbushActive=farmAmbushActive=false;window.outpostForts={};townsData={};
 buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];barrels=[];townCitizens=[];
 enemiesList=[];corpses=[];particles=[];bullets=[];comboTimer=0;frameCount=43;invalidateColIndex();
 player=new Character(10000,10000,true);player.hp=100;randomSeed(83);noiseSeed(17);
 worldTimeMs=DAY_MS*.5;updateSunVector();GLRig.on=GLRig.ok=false;GLRig.failure=GLRIG_SHED_MSG;
 function guard(c,want,label){if(nativePad(c)!==want)throw Error('Cull fallback: '+label);guardChecks++;}
 const z=createOccultZombie(0,-1100,'cull-owner');guard(z,64,'canonical zombie');
 z.stunTimer=10;guard(z,150,'stunned');z.stunTimer=0;
 z.knockedOut=true;guard(z,150,'knocked out');z.knockedOut=false;
 z.isCorpse=true;guard(z,150,'corpse');z.isCorpse=false;
 z._boxing={active:true};guard(z,150,'boxing');z._boxing=null;
 z.bodyW=22;guard(z,150,'custom width');z.bodyW=21;z.bodyH=28;guard(z,150,'custom height');z.bodyH=27;
 for(const level of [1,3,7,8]){currentLevel=level;guard(z,150,'level '+level);}currentLevel=9;
 guard(createOccultMagician('RED',0,-1100,'cull-mage'),150,'mage');guard(player,150,'player');
 function render(reference,shake){
  actorRenderCullPad=reference?()=>150:nativePad;shown=0;
  resetMatrix();background(79,88,103);push();scale(zoom);translate(-camX+shake,-camY-shake*.7);
  _depthActors.length=_airborneActors.length=_shovelBelowActors.length=0;
  _depthOn=depthSortActive();_legacyActorsQueued=!_depthOn;
  updateEntities();if(_depthOn)drawDepthSorted();else drawLegacyActors();pop();
  return {pixels:drawingContext.getImageData(0,0,width*pixelDensity(),height*pixelDensity()).data,
   shown,stack:frameStackDepth()};
 }
 try{
  for(const [density,magnification,shake] of [[1,.45,0],[1,.8,24],[1,1.4,0],[2,.45,24],[2,.8,0],[2,1.4,24]]){
   pixelDensity(density);zoom=magnification;camX=100;camY=-1300;
   const right=camX+width/zoom,bottom=camY+height/zoom,pad=shake>0?shake/zoom+8:0;
   viewLeft=camX-pad;viewRight=right+pad;viewTop=camY-pad;viewBottom=bottom+pad;
   enemiesList=[];
   // Every edge/corner gets walk and bite poses at twelve facings. Include
   // visible roots and the entire newly skipped band, rather than testing
   // manually culled .show() calls or only transparent reference pictures.
   for(const distance of [-8,24,70,100,140])for(let edge=0;edge<8;edge++)for(let facing=0;facing<12;facing++){
    const x=edge===0||edge===4||edge===6?camX-distance:edge===1||edge===5||edge===7?right+distance:(camX+right)/2;
    const y=edge===2||edge===4||edge===5?camY-distance:edge===3||edge===6||edge===7?bottom+distance:(camY+bottom)/2;
    const c=createOccultZombie(x,y,'cull-owner');c.aimAngle=facing*Math.PI/6+.037;
    c.isMoving=facing%3!==0;c.walkCycle=.37+facing*.61;c.occultZombie.windupMs=facing%3*210;
    c.occultZombie.emergeMs=facing%2?200:0;enemiesList.push(c);totalPoses++;
   }
   const before=enemiesList.map(c=>[c.x,c.y,c.hp,c.walkCycle,c.occultZombie.windupMs]);
   const a=render(true,shake),b=render(false,shake);let changed=0,painted=0;
   for(let i=0;i<a.pixels.length;i++){if(a.pixels[i]!==b.pixels[i])changed++;if(i%4===0&&a.pixels[i]!==79)painted++;}
   if(changed)throw Error(changed+' framebuffer channels changed at density='+density+', zoom='+zoom+', shake='+shake);
   if(!painted||b.shown>=a.shown||a.stack!==b.stack)throw Error('Native culling fixture did not prove visible art, fewer paints and balanced state');
   if(JSON.stringify(before)!==JSON.stringify(enemiesList.map(c=>[c.x,c.y,c.hp,c.walkCycle,c.occultZombie.windupMs])))throw Error('Rendering advanced gameplay');
   rows.push({density,zoom,shake,actors:enemiesList.length,before:a.shown,after:b.shown,changed,painted});
  }
 }finally{actorRenderCullPad=nativePad;Character.prototype.show=nativeShow;}
 return {guardChecks,totalPoses,rows};
};`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.setContent('<!doctype html><script>Object.defineProperty(window,"localStorage",{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});</script><script>'+p5+'</script><script>'+source+'</script><script>'+fixture+'</script>');
  await page.waitForFunction(()=>window.__ready);const result=await page.evaluate(()=>window.__checkCull());
  assert.deepEqual(errors,[]);assert.equal(result.rows.length,6);assert.equal(result.guardChecks,13);
  for(const row of result.rows)console.log(JSON.stringify(row));
  console.log('Zombie culling: '+result.totalPoses+' native edge/corner poses and '+result.guardChecks+' fallback guards retain exact pixels with fewer paints.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

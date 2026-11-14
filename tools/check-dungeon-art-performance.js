// Exact native Canvas parity for the p5 1.11.10/1.11.11 cel drawing fast path.
// DUNGEON_BASELINE=/tmp/game-before.js DUNGEON_P5=/path/to/p5.min.js node tools/check-dungeon-art-performance.js
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function dependency(name){try{return require(name);}catch(e){if(!process.env.VIS_DEPS)throw e;return require(path.join(process.env.VIS_DEPS,'node_modules',name));}}
let chromium;try{chromium=dependency('playwright-core').chromium;}catch(_){chromium=dependency('playwright').chromium;}
const baseline=process.env.DUNGEON_BASELINE;
if(!baseline)throw Error('Set DUNGEON_BASELINE to the unchanged game.js snapshot');
const candidate=process.env.GAME_JS||path.join(__dirname,'..','game.js');
const p5Path=process.env.DUNGEON_P5||(process.env.VIS_DEPS?path.join(process.env.VIS_DEPS,'node_modules/p5/lib/p5.min.js'):require.resolve('p5/lib/p5.min.js'));
const p5Source=fs.readFileSync(p5Path,'utf8');
const setup=`
Object.defineProperty(window,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
let artSeed=917;Math.random=()=>{artSeed=(Math.imul(artSeed,1664525)+1013904223)>>>0;return artSeed/4294967296;};
`;
const fixture=`
window.preload=()=>{};window.setup=()=>{createCanvas(960,3200);pixelDensity(1);noLoop();
 randomSeed(1291);leftStick={active:false};rightStick={active:false};window.__ready=true;};
window.__capture=(advanced)=>{
 currentLevel=currentBiome=9;BIOME_ACTIVE=false;frameCount=43;
 viewLeft=-200;viewRight=1200;viewTop=-200;viewBottom=3500;
 GLRig.on=GLRig.ok=advanced;GLRig.failure=advanced?'':GLRIG_SHED_MSG;
 background(85,78,70);worldTimeMs=DAY_MS*.54;updateSunVector();
 const nativeBegin=window.beginShape,nativeBezier=window.bezierVertex;
 let beginCalls=0,bezierCalls=0,count=0;
 window.beginShape=function(){beginCalls++;return nativeBegin.apply(this,arguments);};
 window.bezierVertex=function(){bezierCalls++;return nativeBezier.apply(this,arguments);};
 try{
  for(const kind of ['BLACK','RED','BLUE','ZOMBIE'])for(let state=0;state<10;state++)for(let facing=0;facing<12;facing++){
   const i=count++,x=40+i%12*80,y=40+Math.floor(i/12)*80;
   const c=kind==='ZOMBIE'?createOccultZombie(x,y,'art-owner','art-'+i):createOccultMagician(kind,x,y,'art-'+i);
   c.aimAngle=facing*Math.PI/6+.073;c.moveAngle=c.aimAngle+.4;
   c.walkCycle=.27+state*.61;c.isMoving=state%3!==0;c.gait=state/10;c.isCharred=state===8;
   if(c.occult){
    c.occult.phase=state<3?'IDLE':state<8?'CHARGE':'RECOVER';
    c.occult.cast=kind==='BLACK'?'SUMMON':kind==='RED'?(state%2?'FIREBALL':'LAVA'):(state%2?'SHARD':'SHOCK');
    c.occult.chargeDurationMs=1000;c.occult.chargeMs=(state%5)*200;c.occult.recoverMs=(state-7)*100;
    c.occult.awakened=state!==0;
   }else c.occultZombie.windupMs=state%5*80;
   c.show();
  }
 }finally{window.beginShape=nativeBegin;window.bezierVertex=nativeBezier;}
 const pixels=drawingContext.getImageData(0,0,width,height).data;let text='';
 for(let i=0;i<pixels.length;i+=32768)text+=String.fromCharCode.apply(null,pixels.subarray(i,i+32768));
 return {pixels:btoa(text),beginCalls,bezierCalls,count,stack:frameStackDepth(),
  style:[p5.instance._renderer._doFill,p5.instance._renderer._doStroke,drawingContext.fillStyle,drawingContext.strokeStyle,drawingContext.lineWidth]};
};`;
async function capture(browser,source,advanced){
 const page=await browser.newPage({viewport:{width:960,height:800}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.setContent('<!doctype html><script>'+setup+'</script><script>'+p5Source+'</script><script>'+fs.readFileSync(source,'utf8')+'</script><script>'+fixture+'</script>');
  await page.waitForFunction(()=>window.__ready);
  const result=await page.evaluate(advanced=>window.__capture(advanced),advanced);
  assert.deepEqual(errors,[],'Native character painters must not throw');return result;
 }finally{await page.close();}
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const advanced of [false,true]){
   const a=await capture(browser,baseline,advanced),b=await capture(browser,candidate,advanced);
   const before=Buffer.from(a.pixels,'base64'),after=Buffer.from(b.pixels,'base64');
   assert.equal(Buffer.compare(before,after),0,'All 480 magician/zombie poses must retain identical Canvas pixels');
   assert.equal(a.count,b.count);assert.equal(b.count,480);
   assert.deepEqual(a.style,b.style,'Native painter styles must remain identical');assert.equal(a.stack,b.stack);
   assert.ok(b.bezierCalls<=a.bezierCalls,'The faster cel path must not allocate more p5 vertex arrays');
   console.log(JSON.stringify({advanced,poses:b.count,sha256:crypto.createHash('sha256').update(after).digest('hex'),p5BezierCalls:{before:a.bezierCalls,after:b.bezierCalls}}));
  }
 }finally{await browser.close();}
 console.log('Dungeon cel art: 960 native poses retain exact pixels and painter state.');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

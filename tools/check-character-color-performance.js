// Exact RGB palette conversion versus the active native p5 color parser.
// Includes color modes/maxima, mutable arrays and Color objects, and fallbacks.
// CHARACTER_P5=/path/to/p5.min.js node tools/check-character-color-performance.js
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function dependency(name){try{return require(name);}catch(e){if(!process.env.VIS_DEPS)throw e;return require(path.join(process.env.VIS_DEPS,'node_modules',name));}}
let chromium;try{chromium=dependency('playwright-core').chromium;}catch(_){chromium=dependency('playwright').chromium;}
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'..','game.js'),'utf8');
const p5Path=process.env.CHARACTER_P5||(process.env.VIS_DEPS?path.join(process.env.VIS_DEPS,'node_modules/p5/lib/p5.min.js'):require.resolve('p5/lib/p5.min.js'));
const p5=fs.readFileSync(p5Path,'utf8');
const fixture=`
window.preload=()=>{};window.setup=()=>{createCanvas(32,32);pixelDensity(1);noLoop();window.__ready=true;};
window.__checkColors=()=>{
 let count=0;const cases=[],failures=[],inst=p5.instance;
 const test=(args,label)=>{
  const painter=figurePainter(),renderer=inst._renderer;
  let expected,error;
  try{expected=inst.color.apply(inst,args).toString();}catch(e){error=e.constructor.name;}
  let actual,actualError;
  try{painter.fill.apply(null,args);actual=renderer._getFill();}catch(e){actualError=e.constructor.name;}
  if(error!==actualError)failures.push({label,expectedError:error,actualError});
  if(!error){
   // Canvas may canonicalize malformed/transparent CSS. Set the reference by
   // the same native renderer setter and compare its actual accepted style.
   renderer._setFill(expected);const accepted=renderer._getFill();
   if(actual!==accepted)failures.push({label,expected,accepted,actual});
   painter.stroke.apply(null,args);const stroke=renderer._getStroke();
   renderer._setStroke(expected);if(stroke!==renderer._getStroke())failures.push({label,kind:'stroke'});
  }
  count++;
 };
 let seed=901;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(const mode of [RGB,HSB,HSL])for(const maxes of [[255,255,255,255],[1,1,1,1],[360,100,100,1],[31,101,511,7]]){
  colorMode(mode,...maxes);
  for(let i=0;i<600;i++){
   const args=[(rng()*2-.5)*maxes[0],(rng()*2-.5)*maxes[1],(rng()*2-.5)*maxes[2],(rng()*2-.5)*maxes[3]];
   const n=1+i%4;args.length=n;test(args,mode+' numeric '+i);test([args],mode+' array '+i);
  }
  for(const args of [[0],[255],[128,undefined],[12,undefined,undefined],[12,22,32,undefined],[12,22,32,'x'],[NaN],[Infinity],[-Infinity],[12,22,32,NaN],[12,22,32,Infinity],['#a34b82'],['rgba(50,70,90,.4)'],['gold']])test(args,mode+' fallback '+String(args));
  cases.push({mode,maxes,count});
 }
 colorMode(RGB,255);
 for(const edge of [-.5,.5,127.5,254.5,255.5])for(const epsilon of [-Number.EPSILON,0,Number.EPSILON,-1e-12,1e-12])test([edge+epsilon,edge+epsilon,edge+epsilon,128.5],'rounding edge');
 const palette=[31,70,112];for(let i=0;i<20;i++){palette[i%3]+=1;test([palette],'mutable array');}
 const c=color(10,20,30,120);for(let i=0;i<20;i++){c.setRed(20+i);c.setAlpha(80+i);test([c],'mutable Color');}
 colorMode(RGB,255);const painter=figurePainter(),nativeColor=inst.color;let colorCalls=0;
 inst.color=function(){colorCalls++;return nativeColor.apply(this,arguments);};
 try{for(let i=0;i<500;i++){painter.fill(77.4+i*.00001,95.2,131.2);painter.stroke([130.2,82.3,61.2,128]);}}finally{inst.color=nativeColor;}
 return {version:p5.VERSION,count,failures,colorCalls,cacheSize:painter.numeric.size,cases};
};`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.setContent('<!doctype html><script>Object.defineProperty(window,\'localStorage\',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});</script><script>'+p5+'</script><script>'+source+'</script><script>'+fixture+'</script>');
  await page.waitForFunction(()=>window.__ready);const result=await page.evaluate(()=>window.__checkColors());
  assert.deepEqual(errors,[]);assert.deepEqual(result.failures,[]);
  if(['1.9.4','1.11.10','1.11.11'].includes(result.version))assert.equal(result.colorCalls,0,'Verified RGB palettes must allocate no native Color objects');
  else assert.ok(result.colorCalls>0,'Other p5 versions retain native color conversion');
  assert.ok(result.cacheSize<=1024,'Palette cache stays bounded');
  console.log(JSON.stringify({p5:result.version,checks:result.count,nativeColorCallsFor1000Paints:result.colorCalls,cacheSize:result.cacheSize}));
  console.log('Character RGB palette: native color, mode, mutation, fallback and bounded-cache parity passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

// Build an offline phone benchmark with original and current game source.
// No Playwright or network access is needed to build this standalone HTML.
// Supply a local p5 1.11.11 library (or install p5 for require.resolve).
// node tools/build-s25-benchmark.js --p5 /path/to/p5.min.js
// Options: --final game.js --original /path/to/original.js --out output.html
// Default original source: git show 37dfd72:game.js. Default output: work/.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),childProcess=require('child_process');
const repo=path.resolve(__dirname,'..'),options={};
for(let i=2;i<process.argv.length;i++){
  const key=process.argv[i];
  if(key==='--help'){console.log('Usage: node tools/build-s25-benchmark.js [--p5 file] [--final file] [--original file] [--out file]');process.exit(0);}
  if(!['--p5','--final','--original','--out'].includes(key)||!process.argv[i+1])throw Error('Unknown or missing argument: '+key);
  options[key.slice(2)]=process.argv[++i];
}
let p5Path=options.p5||process.env.BATTLE_P5||process.env.VIS_P5;
if(!p5Path){try{p5Path=require.resolve('p5/lib/p5.min.js');}catch{throw Error('Provide --p5 /path/to/p5.min.js, or install p5 before building.');}}
Object.assign(process.env,{BATTLE_DRIVER:'native',BATTLE_AUDIO:'native',BATTLE_HEALTH:'normal',BATTLE_WARM:'0',
  BATTLE_FRAMES:'1',BATTLE_TRACE:'',BATTLE_PROFILE:'',BATTLE_PIXELS:'',BATTLE_PAINT_COUNTS:'',BATTLE_RIG_TIMERS:'',BATTLE_AUDIO_TIMERS:'',
  BATTLE_W:'540',BATTLE_H:'1170',BATTLE_DPR:'1',BATTLE_DENSITY:'1',BATTLE_TOUCH:''});
const {fixture:baseFixture,diagnostics}=require('./profile-nm0-combat.js');
const finalPath=path.resolve(options.final||path.join(repo,'game.js'));
const original=options.original?fs.readFileSync(path.resolve(options.original),'utf8'):childProcess.execFileSync('git',['show','37dfd722d2524a1810851ffc62905b3aa1d655a4:game.js'],{cwd:repo,encoding:'utf8',maxBuffer:32*1024*1024});
const final=fs.readFileSync(finalPath,'utf8');
const p5=fs.readFileSync(path.resolve(p5Path),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
let fixture=baseFixture.replace('pixelDensity(1);createCanvas(540,1170);',
  'pixelDensity(Math.min(displayDensity(),2));createCanvas(windowWidth,windowHeight);');
fixture=fixture.replace('window.__ready=true;};',
  "if(typeof initComboHudFont==='function')initComboHudFont();if(typeof initHudFont==='function')initHudFont();window.__ready=true;};");
const bootstrap=`(function(){let memory={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>memory[k]??null,setItem:(k,v)=>memory[k]=String(v),removeItem:k=>delete memory[k],clear:()=>memory={}}});let seed=90210;window.__randCalls=0;Math.random=function(){__randCalls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};window.__resetRandom=function(){seed=90210;__randCalls=0;};})();`;
const phoneRuntime=`
(function(){
  const warmMs=2500,measureMs=15000;
  let started=false,stopped=false,hiddenEvents=0,resizeEvents=0;
  document.addEventListener('visibilitychange',()=>{if(started&&!stopped&&document.hidden)hiddenEvents++;});
  window.addEventListener('resize',()=>{if(started&&!stopped)resizeEvents++;});
  window.addEventListener('error',event=>parent.postMessage({tag:'nm0-phone',type:'error',id:window.__phoneVersion,message:event.message},'*'));
  const summarize=values=>{if(!values.length)return null;const a=values.slice().sort((x,y)=>x-y);return {mean:values.reduce((x,y)=>x+y,0)/values.length,median:a[Math.floor(a.length*.5)],p95:a[Math.min(a.length-1,Math.floor(a.length*.95))],max:a[a.length-1]};};
  window.__disposePhoneBenchmark=async function(){
    noLoop();if(sfx.ctx&&sfx.ctx.state!=='closed')await sfx.ctx.close();
    if(GLRig.gl){const lose=GLRig.gl.getExtension('WEBGL_lose_context');if(lose)lose.loseContext();}
    if(p5.instance)p5.instance.remove();
  };
  window.__startPhoneBenchmark=async function(){
    if(started)return;started=true;
    try{
      // Called synchronously by the explicit parent button's user gesture.
      const initialized=sfx.ctx;
      if(!initialized)sfx.init();
      if(sfx.ctx&&sfx.ctx.state==='suspended')await sfx.ctx.resume();
      if(!sfx.ctx||sfx.ctx.state!=='running')throw Error('Audio did not start. Tap Start again in Chrome.');
      // __battleInit normally initializes audio itself. Reuse the context that
      // was unlocked by this gesture, including its native decoded samples.
      const init=sfx.init;sfx.init=function(){};
      const advanced=glRigInit();
      try{await __battleInit(80,advanced?'advanced':'fallback');}finally{sfx.init=init;}
      const lighting=advanced?'advanced/full-quality':'native 2D fallback';
      const nativeDraw=window.draw,all=[],measured=[];
      let clockStart=null,measureStart=null,previous=null,startLoad=null;
      function finish(reason){
        if(stopped)return;stopped=true;noLoop();
        const detail=__battleResult(),cpu=measured.map(r=>r.cpu),intervals=measured.map(r=>r.interval).filter(Number.isFinite);
        const stages=Object.fromEntries(Object.entries(__stage).map(([key,values])=>[key,summarize(values)]));
        const report={version:window.__phoneVersion,source:window.__phoneSourceMeta,
          createdAt:new Date().toISOString(),userAgent:navigator.userAgent,platform:navigator.platform,
          hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory,
          settings:{seed:90210,lighting,targetFrameRate:60,normalNpcHealth:true,nativeReserveCallbacks:true,
            observerHealthAndAmmoRefreshed:true,scriptedTouchInput:true,warmupMs:warmMs,requestedMeasureMs:measureMs},
          reason,hiddenEvents,resizeEvents,initial:detail.initial,measurementStartLoad:startLoad,
          frames:measured.length,actualMeasuredMs:measureStart===null?0:performance.now()-measureStart,
          drawCpuMs:summarize(cpu),frameIntervalMs:summarize(intervals),stages,
          hardware:detail.hardware,audio:detail.audio,final:{allies:detail.allies,ambushers:detail.ambushers,reserves:detail.reserves,
            actors:detail.actors,bullets:detail.bullets,particles:detail.particles,counts:detail.counts,rig:detail.rig,
            flags:detail.flags,frameFault:detail.fault},framesDuringWarmupAndMeasurement:all};
        parent.postMessage({tag:'nm0-phone',type:'result',id:window.__phoneVersion,report},'*');
      }
      window.draw=function(){
        if(stopped)return;
        __battleInputs();__stageFrame={};const start=performance.now();
        if(clockStart===null)clockStart=start;
        nativeDraw();const row=__battleFinishFrame(performance.now()-start,start);
        row.interval=previous===null?null:start-previous;previous=start;all.push(row);
        if(measureStart===null&&start-clockStart>=warmMs){measureStart=start;startLoad={...row};__stage={};}
        if(measureStart!==null)measured.push(row);
        if(window.FRAME_FAULT)finish('frame fault');
        else if(killcamMode||isWin||!nm0AmbushActive)finish('native ambush completed');
        else if(measureStart!==null&&start-measureStart>=measureMs)finish('capture completed');
      };
      frameRate(60);loop();
    }catch(error){stopped=true;noLoop();parent.postMessage({tag:'nm0-phone',type:'error',id:window.__phoneVersion,message:error.stack||String(error)},'*');}
  };
  const ready=()=>{if(!window.__ready)return requestAnimationFrame(ready);
    Promise.resolve(document.fonts&&document.fonts.ready).then(()=>parent.postMessage({tag:'nm0-phone',type:'ready',id:window.__phoneVersion},'*'));};ready();
})();`;
const payload={p5,bootstrap,diagnostics,fixture,phoneRuntime,sources:{
  original:{code:original,meta:{label:'Original directional falls and footwork',commit:'37dfd722d2524a1810851ffc62905b3aa1d655a4',sha256:sha(original)}},
  optimized:{code:final,meta:{label:'Optimized candidate',sha256:sha(final)}}}};
const serialized=JSON.stringify(payload).replace(/</g,'\\u003c');
const html=`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>S25 combat benchmark</title>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#101b24;color:#f3f5f7;font:16px/1.4 system-ui,sans-serif}
iframe{position:fixed;inset:0;border:0;width:100%;height:100%;background:#101b24}
#panel{position:fixed;inset:0;z-index:3;overflow:auto;box-sizing:border-box;padding:24px 20px;background:#101b24f5}
#panel[hidden]{display:none}main{max-width:620px;margin:0 auto}h1{font-size:25px;margin:0 0 16px}p{margin:12px 0}.small{font-size:13px;color:#becbd6}
button{display:block;width:100%;padding:14px 16px;margin:12px 0;border:1px solid #748c9c;border-radius:8px;background:#24475a;color:#fff;font:600 17px system-ui}
button:disabled{opacity:.45}#download{background:#236651}#status{min-height:25px;font-weight:600}.result{padding:12px 0;border-top:1px solid #49606d}pre{white-space:pre-wrap;word-break:break-word}
</style>
<iframe id="game" title="Native Level 2 battle" allow="autoplay; fullscreen"></iframe>
<section id="panel"><main>
<h1>80 allies · Level 2 NM0</h1>
<p>This local benchmark runs the original and optimized game on your phone. Each run starts with 80 allies and the native NM0 ambush. NPC health, wounds, deaths and reinforcements stay normal.</p>
<p>The player moves and fires automatically. Only the player's health and ammo are refreshed. The controls disappear during the capture, which takes about 18 seconds.</p>
<p class="small">Keep Chrome visible and use the same phone settings for both runs. Native battles can end with different actor counts; the report records that alongside the timings. Audio starts with each explicit tap.</p>
<p id="status">Preparing the original game…</p>
<button id="original" disabled>1 · Start original</button>
<button id="optimized" disabled>2 · Start optimized</button>
<div id="results"></div>
<button id="download" hidden>Download timing report</button>
<p class="small">Everything needed for the test is embedded in this file. The JSON report stays on your phone until you choose to share it.</p>
</main></section>
<script id="payload" type="application/json">${serialized}</script>
<script>
const payload=JSON.parse(document.getElementById('payload').textContent);
const panel=document.getElementById('panel'),statusNode=document.getElementById('status'),resultsNode=document.getElementById('results');
const buttons={original:document.getElementById('original'),optimized:document.getElementById('optimized')};
let frame=document.getElementById('game'),prepared=null,running=false;const reports={};
const escaped=code=>code.replace(/<\\/script/gi,'<\\\\/script');
async function prepare(version){
  prepared=null;for(const button of Object.values(buttons))button.disabled=true;
  if(frame.contentWindow&&frame.contentWindow.__disposePhoneBenchmark){try{await frame.contentWindow.__disposePhoneBenchmark();}catch{}}
  const replacement=document.createElement('iframe');replacement.id='game';replacement.title='Native Level 2 battle';replacement.allow='autoplay; fullscreen';frame.replaceWith(replacement);frame=replacement;
  const source=payload.sources[version];
  const scripts=[payload.bootstrap,payload.p5,source.code,
    'window.__phoneVersion='+JSON.stringify(version)+';window.__phoneSourceMeta='+JSON.stringify(source.meta)+';',payload.diagnostics,payload.fixture,payload.phoneRuntime];
  frame.srcdoc='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;overflow:hidden;touch-action:none}</style>'+scripts.map(code=>'<script>'+escaped(code)+'<\\/script>').join('');
}
function start(version){
  if(running||prepared!==version)return;running=true;panel.hidden=true;
  for(const button of Object.values(buttons))button.disabled=true;
  frame.contentWindow.__startPhoneBenchmark();
}
buttons.original.onclick=()=>start('original');buttons.optimized.onclick=()=>start('optimized');
window.addEventListener('message',async event=>{
  const data=event.data;if(event.source!==frame.contentWindow||!data||data.tag!=='nm0-phone')return;
  if(data.type==='ready'){prepared=data.id;buttons[data.id].disabled=false;statusNode.textContent=data.id==='original'?'Original game ready. Tap Start original.':'Optimized game ready. Tap Start optimized.';return;}
  if(data.type==='error'){running=false;panel.hidden=false;statusNode.textContent='The capture stopped: '+data.message;return;}
  if(data.type==='result'){
    running=false;panel.hidden=false;reports[data.id]=data.report;document.getElementById('download').hidden=false;
    const block=document.createElement('div');block.className='result';
    const report=data.report,cpu=report.drawCpuMs,interval=report.frameIntervalMs;
    block.textContent=(data.id==='original'?'Original':'Optimized')+': '+(cpu?cpu.median.toFixed(1)+' ms median draw CPU':'no active sample')+
      (interval?' · '+interval.median.toFixed(1)+' ms median frame interval':'')+' · '+report.frames+' measured frames.';
    resultsNode.append(block);
    if(data.id==='original'){statusNode.textContent='Original captured. Preparing optimized…';await prepare('optimized');}
    else{statusNode.textContent='Both captures are ready. Download the report to share the actual phone measurements.';
      try{await frame.contentWindow.__disposePhoneBenchmark();}catch{}prepared=null;}
  }
});
document.getElementById('download').onclick=()=>{
  const output={benchmark:'80 allies / Level 2 native NM0',createdAt:new Date().toISOString(),
    p5:reports.original?.hardware?.p5||reports.optimized?.hardware?.p5||'embedded',sources:Object.fromEntries(Object.entries(payload.sources).map(([key,value])=>[key,value.meta])),reports};
  const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='s25-combat-timings.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
prepare('original');
</script></html>`;
const output=path.resolve(options.out||path.join(repo,'work','s25-combat-benchmark.html'));
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,html);
console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),originalSha256:sha(original),finalSha256:sha(final),finalPath}));

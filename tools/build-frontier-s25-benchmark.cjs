// Build a self-contained, source-pinned Level 3 benchmark for a physical phone.
// node tools/build-frontier-s25-benchmark.cjs --p5 /path/to/p5-1.9.0.min.js --out /tmp/frontier-s25.html
// Open the HTML in Chrome. Run baseline and candidate at identical settings.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const opts={};for(let i=2;i<process.argv.length;i+=2){if(!['--p5','--out','--baseline','--candidate'].includes(process.argv[i])||!process.argv[i+1])throw Error('Usage: --p5 file --out file [--baseline file] [--candidate file]');opts[process.argv[i].slice(2)]=process.argv[i+1];}
const repo=path.resolve(__dirname,'..'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const p5=fs.readFileSync(opts.p5||process.env.FRONTIER_P5||'/tmp/frontier-qa/p5-1.9.0.min.js','utf8');
if(sha(p5)!=='726ac96626b93f5bcaff83a910b6c60d3a9728f063e0eb73b5d0819ffc356915')throw Error('Expected the production p5 1.9.0 library; supply its exact minified bytes.');
const baseline=opts.baseline?fs.readFileSync(opts.baseline,'utf8'):cp.execFileSync('git',['show','5d1583efc9966873b0e66ca8803b8e7aebf3f40e:game.js'],{cwd:repo,encoding:'utf8',maxBuffer:32*1024*1024});
const candidate=fs.readFileSync(opts.candidate||path.join(repo,'game.js'),'utf8');
const runtime=`
window.preload=function(){}; // Optional dialogue portraits are absent from this offline benchmark.
window.__frontierErrors=[];window.addEventListener('error',e=>__frontierErrors.push(e.message));
const summary=values=>{const a=values.slice().sort((a,b)=>a-b);return {count:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.min(a.length-1,Math.floor(a.length*.95))],p99:a[Math.min(a.length-1,Math.floor(a.length*.99))],max:a[a.length-1]};};
(function ready(){if(typeof leftStick==='undefined'||!leftStick||!document.querySelector('canvas'))return requestAnimationFrame(ready);noLoop();
 randomSeed(7);noiseSeed(BIOME_SEED);isStoryMode=true;started=true;isPaused=isDead=isWin=false;window.outpostForts={};seedWorldClock();startAtLevel(3);
 inStoryIntro=inStoryRoom=killcamMode=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=inTravelMenu=inOverworldView=false;
 objectiveTimer=streakMsgTimer=0;frontierBountyHudAlpha();_frontierBountyHud.clockMs=10000;worldTimeMs=13/24*DAY_MS;updateSunVector();
 let p={x:1300,y:-1730};if(__config.scene==='copper-wash')p={x:-6000,y:600};if(__config.scene==='sunspur')p={x:8400,y:-6600};if(__config.scene==='mesa-relay')p={x:1200,y:6600};
 if(__config.scene==='canyon'){p={x:-6000,y:frontierCanyonProfile('X',-6000,100.125).center};}
 if(__config.scene==='streaming')p={x:1300,y:-900};
 if(__config.scene==='combat'){const enemy=enemiesList.find(e=>frontierAmbientActor(e)&&!e.dead&&e.hp>0);if(enemy)p={x:enemy.x,y:enemy.y+240};player.currentWeapon=WEAPONS.PISTOL;player.isArmed=true;player.ammo=1000;}
 player.x=p.x;player.y=p.y;zoom=.65;camX=p.x-width/(2*zoom);camY=p.y-height/(2*zoom);viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;
 chunkMgr.update(p.x,p.y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();lastActiveUpdate=-100;updateActiveWorld();
 glRigClock=function(){};glRigWatchdog=function(){};if(__config.mode==='advanced'){glRigInit();GLRig.on=GLRig.ok;}else GLRig.on=false;
 updateFrontierExplorationNotice(1);_frontierExplorationNotice.ageMs=10000;
 const nativeDraw=window.draw,rows=[];let start=null,prior=null,hidden=0,stopped=false;document.addEventListener('visibilitychange',()=>{if(document.hidden)hidden++;});
 window.draw=function(){if(stopped)return;const t=performance.now();if(start===null)start=t;const elapsed=t-start;
  if(__config.scene==='streaming'){leftStick.active=true;leftStick.dx=0;leftStick.dy=-1;}
  if(__config.scene==='combat'){const target=enemiesList.filter(e=>frontierAmbientActor(e)&&!e.dead&&e.hp>0).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0];player.hp=player.maxHp;player.ammo=1000;if(target){const a=Math.atan2(target.y-player.y,target.x-player.x);player.aimAngle=a;rightStick.active=true;rightStick.gamepadInput=false;rightStick.dx=-Math.cos(a);rightStick.dy=-Math.sin(a);rightStick.dist=1;}}
  const before=(p5.instance||window._p5Instance)?._styles?.length||0;
  nativeDraw();const cpu=performance.now()-t;
  if(elapsed>=3000)rows.push({cpu,interval:prior===null?null:t-prior,stackBefore:before,stackAfter:(p5.instance||window._p5Instance)?._styles?.length||0});prior=t;
  if(elapsed>=18000||window.FRAME_FAULT){stopped=true;noLoop();parent.postMessage({tag:'frontier-benchmark',result:{source:__config.source,scene:__config.scene,mode:__config.mode,
   userAgent:navigator.userAgent,viewport:{width,height,dpr:devicePixelRatio,density:pixelDensity()},durationMs:elapsed,hiddenEvents:hidden,
   cpuDrawMs:summary(rows.map(r=>r.cpu)),frameIntervalMs:summary(rows.map(r=>r.interval).filter(Number.isFinite)),frames:rows.length,
   stackBalanced:rows.every(r=>r.stackBefore===r.stackAfter),errors:__frontierErrors,fault:window.FRAME_FAULT||null,
   initialPlayer:p,final:{player:{x:player.x,y:player.y},actors:enemiesList.length,solids:activeBuildings.length,chunks:chunkMgr.chunks.size,canvases:document.querySelectorAll('canvas').length,lighting:{on:GLRig.on,ok:GLRig.ok,tier:GLRig.tier,width:GLRig.w,height:GLRig.h,error:GLRig.gl?.getError()}}}},'*');}
 };frameRate(60);loop();})();`;
const payload={p5,p5Sha256:sha(p5),runtime,sources:{baseline:{code:baseline,sha256:sha(baseline),commit:'5d1583efc9966873b0e66ca8803b8e7aebf3f40e'},candidate:{code:candidate,sha256:sha(candidate)}}};
const html=`<!doctype html><html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Level 3 phone benchmark</title>
<style>html,body{margin:0;font:16px system-ui;background:#211c18;color:#fff}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}main{position:fixed;z-index:2;inset:0;background:#211c18;overflow:auto;padding:24px}button,select{font:inherit;padding:12px;margin:6px 0;display:block;width:100%;box-sizing:border-box}pre{white-space:pre-wrap;word-break:break-word}</style>
<iframe title="Native Level 3 game" id="game"></iframe><main id="panel"><h1>Level 3 · Galaxy S25 benchmark</h1><p>Choose a scene and lighting mode, then run both versions with the same phone settings. Each capture warms for 3 seconds and measures native frames for 15 seconds. Keep Chrome visible.</p>
<select id="scene"><option value="dry-gulch">Dry Gulch</option><option value="copper-wash">Copper Wash</option><option value="sunspur">Sunspur</option><option value="mesa-relay">Mesa Relay</option><option value="canyon">Canyon bridge</option><option value="streaming">Native movement and streaming</option><option value="combat">Native ambient bandit combat</option></select>
<select id="mode"><option value="fallback">Fallback lighting</option><option value="advanced">Advanced lighting</option></select><button id="baseline">Run baseline</button><button id="candidate">Run candidate</button><button id="download">Download reports</button><pre id="results">Ready. p5 1.9.0, production pixel-density cap 2.</pre></main>
<script id="payload" type="application/json">${JSON.stringify(payload).replace(/</g,'\\u003c')}</script><script>
const payload=JSON.parse(document.getElementById('payload').textContent),reports=[];let frame=document.getElementById('game');
function run(version){const source=payload.sources[version],config={scene:document.getElementById('scene').value,mode:document.getElementById('mode').value,source:{version,sha256:source.sha256,commit:source.commit,p5Sha256:payload.p5Sha256}};
 const replacement=document.createElement('iframe');replacement.id='game';replacement.title='Native Level 3 game';frame.replaceWith(replacement);frame=replacement;
 const escape=code=>code.replace(/<\\/script/gi,'<\\\\/script');const scripts=[payload.p5,source.code,'window.__config='+JSON.stringify(config)+';',payload.runtime];
 frame.srcdoc='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;overflow:hidden;touch-action:none}canvas{display:block}</style>'+scripts.map(s=>'<script>'+escape(s)+'<\\/script>').join('');document.getElementById('panel').hidden=true;
}
document.getElementById('baseline').onclick=()=>run('baseline');document.getElementById('candidate').onclick=()=>run('candidate');
window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.data?.tag!=='frontier-benchmark')return;reports.push(event.data.result);document.getElementById('results').textContent=JSON.stringify(reports,null,2);document.getElementById('panel').hidden=false;});
document.getElementById('download').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(reports,null,2)],{type:'application/json'}));a.download='frontier-phone-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
</script></html>`;
const destination=path.resolve(opts.out||path.join(repo,'tools/out/frontier-s25.html'));fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,html);console.log(JSON.stringify({path:destination,bytes:Buffer.byteLength(html),baseline:sha(baseline),candidate:sha(candidate),p5:sha(p5)}));

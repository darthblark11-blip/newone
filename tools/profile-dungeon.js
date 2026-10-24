// Reproducible native dungeon frame profiler. No repository dependencies added.
// GAME_JS=/tmp/before.js DUNGEON_P5=/path/to/p5.min.js \
// DUNGEON_OUT=/tmp/before.json node tools/profile-dungeon.js
// VIS_DEPS=/path/to/dependencies locates node_modules/playwright or playwright-core.
// Optional DUNGEON_CASES=opening_horde:fallback,populated_dungeon:advanced,
// dense_horde:advanced; DUNGEON_FRAMES=120; DUNGEON_WARM=30;
// DUNGEON_W=390; DUNGEON_H=844; DUNGEON_DPR=3; DUNGEON_SHOTS=1.
// Frame CPU time and painted start intervals describe this Chromium host;
// software WebGL measurements do not establish a phone's hardware frame rate.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..');
const deps=process.env.VIS_DEPS;
function dependency(name){try{return require(name);}catch(error){if(!deps)throw error;return require(path.join(deps,'node_modules',name));}}
let chromium;try{chromium=dependency('playwright-core').chromium;}catch(_){chromium=dependency('playwright').chromium;}
const p5Path=process.env.DUNGEON_P5||process.env.BATTLE_P5||(deps?path.join(deps,'node_modules/p5/lib/p5.min.js'):require.resolve('p5/lib/p5.min.js'));
const p5Source=fs.readFileSync(p5Path,'utf8');
const viewport={width:+(process.env.DUNGEON_W||390),height:+(process.env.DUNGEON_H||844)};
const dpr=+(process.env.DUNGEON_DPR||3);
const blank=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR3kAAAAASUVORK5CYII=','base64');
async function launchGame({source}){
 const game=fs.readFileSync(source,'utf8'),sha=crypto.createHash('sha256').update(game).digest('hex');
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport,deviceScaleFactor:dpr,isMobile:true,hasTouch:true});
 await context.addInitScript(()=>window.addEventListener('resize',e=>{
  try{if(typeof leftStick==='undefined'||!leftStick||!rightStick)e.stopImmediatePropagation();}catch(_){e.stopImmediatePropagation();}
 },true));
 const page=await context.newPage(),errors=[],consoleErrors=[],failedRequests=[];
 page.on('pageerror',e=>errors.push(e.stack||String(e)));
 page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 page.on('requestfailed',r=>failedRequests.push({url:r.url(),reason:r.failure()?.errorText}));
 await page.route('http://dungeon-profile.local/**',async route=>{
  const pathname=new URL(route.request().url()).pathname;
  if(pathname==='/index.html')return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;overflow:hidden;background:#000}canvas{display:block}</style><script src="/p5.min.js"></script><script src="/game.js"></script>'});
  if(pathname==='/p5.min.js')return route.fulfill({status:200,contentType:'application/javascript',body:p5Source});
  if(pathname==='/game.js')return route.fulfill({status:200,contentType:'application/javascript',body:game});
  if(/\/darchon_.*\.png$/.test(pathname))return route.fulfill({status:200,contentType:'image/png',body:blank});
  if(/\.(?:mp3|wav)$/.test(pathname))return route.fulfill({status:204,body:''});
  const local=path.resolve(repo,'.'+decodeURIComponent(pathname));
  if(local.startsWith(repo+path.sep)&&fs.existsSync(local)&&fs.statSync(local).isFile())return route.fulfill({status:200,body:fs.readFileSync(local)});
  return route.fulfill({status:404,body:'Not found'});
 });
 await page.goto('http://dungeon-profile.local/index.html',{waitUntil:'load'});
 await page.waitForFunction(()=>typeof width==='number'&&width>0&&typeof setup==='function'&&!!document.querySelector('canvas'));
 await page.evaluate(()=>noLoop());
 return{page,context,sourceSha:sha,eval:code=>page.evaluate(code),
  status:async()=>({sourcePath:source,sourceSha:sha,viewport,errors,consoleErrors,failedRequests,native:await page.evaluate(()=>({width,height,density:pixelDensity(),dpr:devicePixelRatio,gl:{ok:GLRig.ok,on:GLRig.on,error:GLRig.gl?.getError()}}))}),
  screenshot:async name=>{const dir=process.env.DUNGEON_SHOT_DIR||path.dirname(path.resolve(process.env.DUNGEON_OUT||'/tmp/dungeon-perf.json'));fs.mkdirSync(dir,{recursive:true});const target=path.join(dir,name+'.png');await page.screenshot({path:target});return target;},
  close:async()=>{await context.close();await browser.close();}};
}
async function startLevel(api,level){return api.page.evaluate(level=>{
 isStoryMode=started=true;isDead=isWin=isPaused=false;window.outpostForts={};seedWorldClock();startAtLevel(level);
 inStoryIntro=inStoryRoom=killcamMode=false;killcamTimer=0;window.isDesktop=false;window.showOnScreenControls=true;
 leftStick.active=rightStick.active=false;leftStick.dx=leftStick.dy=rightStick.dx=rightStick.dy=rightStick.dist=0;
},level);}

const source=process.env.GAME_JS||path.join(repo,'game.js');
const out=process.env.DUNGEON_OUT||'/tmp/dungeon-perf.json';
const frames=+(process.env.DUNGEON_FRAMES||120),warm=+(process.env.DUNGEON_WARM||30);
const cases=(process.env.DUNGEON_CASES||'opening_horde:fallback,populated_dungeon:fallback,dense_horde:fallback,clear_chamber:advanced,opening_horde:advanced,populated_dungeon:advanced,dense_horde:advanced').split(',').map(x=>{const [scenario,lighting]=x.split(':');return{scenario,lighting};});
function stats(a){const b=a.slice().sort((x,y)=>x-y);return{mean:a.reduce((s,v)=>s+v,0)/a.length,median:b[Math.floor(b.length*.5)],p95:b[Math.floor(b.length*.95)],p99:b[Math.floor(b.length*.99)],max:b.at(-1)};}
function samplingSummary(p){const n=new Map(p.nodes.map(n=>[n.id,n])),times=new Map();(p.samples||[]).forEach((id,i)=>{const f=n.get(id)?.callFrame;const key=f?`${f.functionName||'(anonymous)'}:${f.lineNumber+1}`:'unknown';times.set(key,(times.get(key)||0)+(p.timeDeltas[i]||0)/1000);});return [...times].map(([functionName,ms])=>({functionName,ms})).sort((a,b)=>b.ms-a.ms).slice(0,35);}
(async()=>{
 const report={source,p5:p5Path,viewport,dpr,host:'Headless Chromium / SwiftShader; timings describe cloud host, not phone frame rate.',frames,warm,results:[]};
 for(const c of cases){
  const api=await launchGame({source,viewport:{width:390,height:844},dpr:3});report.sha=api.sourceSha;
  try{
   await startLevel(api,9,{story:true});
   await api.eval(`(()=>{
    isStoryMode=true;started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inDarchonCall=inOverworldView=inWorldBuildingMenu=inTravelMenu=false;
    undergroundRoute.arrivalMs=900;undergroundDungeon.opened=UNDERGROUND_GATES.map(g=>g.id);for(const g of UNDERGROUND_GATES)removeUndergroundGateBuilding(g.id);
    window.FRAME_FAULT=null;objectiveTimer=streakMsgTimer=0;player.x=0;player.y=-1100;player.hp=player.maxHp=1e8;player.shield=0;
    player.aimAngle=-HALF_PI;player.currentWeapon=WEAPONS.PISTOL;player.ammo=1e7;resetActorStance(player);
    leftStick.active=rightStick.active=false;leftStick.dx=leftStick.dy=rightStick.dx=rightStick.dy=rightStick.dist=0;
    frameCount=1000;worldTimeMs=DAY_MS*.5;updateSunVector();window.__fixedMs=0;window.millis=()=>window.__fixedMs;
    randomSeed(90210);noiseSeed(1337);let rand=90210;Math.random=()=>{rand=(Math.imul(rand,1664525)+1013904223)>>>0;return rand/4294967296;};
    window.__dungeonRandom=()=>rand;
    if('${c.scenario}'==='clear_chamber')enemiesList=[];
    else if('${c.scenario}'==='opening_horde')enemiesList=enemiesList.filter(e=>e.occult?.room==='chamber');
    const owners=enemiesList.filter(e=>e.occult?.kind==='BLACK'),dense='${c.scenario}'==='dense_horde';
    for(const owner of owners){const room=UNDERGROUND_ROOMS.find(r=>r.id===(dense?'chamber':owner.occult.room));let placed=0;
     for(let y=room.y+55;y<room.y+room.h-50&&placed<24;y+=58)for(let x=room.x+55;x<room.x+room.w-50&&placed<24;x+=58)
      if(occultPointClear(x,y,18,player)){const z=createOccultZombie(x,y,owner);z.occultZombie.emergeMs=0;z.hp=z.maxHp=1e8;enemiesList.push(z);placed++;}
    }
    for(const e of enemiesList){e.hp=e.maxHp=1e8;if(e.occult){e.occult.cooldownMs=100+(Math.abs(Math.round(e.x+e.y))%900);}}
    window.__initialCounts={casters:enemiesList.filter(e=>e.occult).length,zombies:enemiesList.filter(e=>e.occultZombie).length};
    zoom=(.8-.065)/.9;camX=player.x-width/(2*.8);camY=player.y-height/(2*.8);window.currentPan=0;
    activeBuildings=buildings;activeParkingCars=[];lastActiveUpdate=-10000;invalidateColIndex();
    const names=['drawGround','drawUndergroundGround','updateActiveWorld','updateEntities','occultUpdateWorld','occultSenseTarget','occultTacticalGoal','occultNavigate','occultFindPath','occultHordeTarget','occultHordeNavigate','occultHordePump','drawDepthSorted','drawBuildings','drawOccultMagician','drawOccultZombie','occultDrawGroundEffects','occultDrawProjectiles','occultDrawDispersions','updateBullets','updateParticles','glRigPaintHeight','glRigFrame','drawLightPass','gatherOccultSpellEmitters','drawUI'];
    window.__timers={};window.__timerStack=[];
    const wrap=(obj,name,key=name)=>{const fn=obj[name];if(typeof fn!=='function')return;obj[name]=function(){const t=performance.now(),frame={child:0};window.__timerStack.push(frame);try{return fn.apply(this,arguments);}finally{const elapsed=performance.now()-t;window.__timerStack.pop();const row=window.__timers[key]||(window.__timers[key]={ms:0,self:0,calls:0});row.ms+=elapsed;row.self+=Math.max(0,elapsed-frame.child);row.calls++;const parent=window.__timerStack.at(-1);if(parent)parent.child+=elapsed;}};};
    for(const name of names)wrap(window,name);wrap(Character.prototype,'updateEnemy','Character.updateEnemy');wrap(Character.prototype,'show','Character.show');
    window.__step=0;window.__stepDungeon=()=>{const f=window.__step++;frameCount++;deltaTime=1000/60;window.__fixedMs=f*deltaTime;player.hp=1e8;player.shield=0;player.ammo=1e7;
     // Continuous aim/fire and a small real movement circle preserve an active
     // battle while keeping the same deterministic input on both snapshots.
     leftStick.active='${c.scenario}'!=='clear_chamber';leftStick.dx=Math.cos(f*.025)*.2;leftStick.dy=Math.sin(f*.025)*.2;
     rightStick.active='${c.scenario}'!=='clear_chamber';rightStick.dx=Math.cos(f*.035);rightStick.dy=Math.sin(f*.035);rightStick.dist=rightStick.active?1:0;
     const start=performance.now();draw();return performance.now()-start;};
    // Pin the existing full-resolution rig and budget in each measured mode;
    // a quality-tier change would otherwise compare unlike pictures.
    glRigClock=function(){};glRigWatchdog=function(){};
    GLRig.on=${c.lighting==='advanced'};GLRig.lightTier=0;GLRig.tier=0;GLRig.ms=16;GLRig.resize=true;
   })()`);
   await api.page.evaluate(async count=>{for(let i=0;i<count;i++){await new Promise(requestAnimationFrame);window.__stepDungeon();}window.__timers={};},warm);
   const cdp=await api.context.newCDPSession(api.page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:250});await cdp.send('Profiler.start');
   const samples=await api.page.evaluate(async count=>{const cpu=[],intervals=[],loads=[];let last;for(let i=0;i<count;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(last!==undefined)intervals.push(now-last);last=now;cpu.push(window.__stepDungeon());loads.push([enemiesList.length,occultProjectiles.length,occultGroundEffects.length,occultSpellBursts.length]);}return{cpu,intervals,loads};},frames);
   const {profile}=await cdp.send('Profiler.stop');
   const detail=await api.eval(`({timers:window.__timers,initial:window.__initialCounts,final:{actors:enemiesList.length,casters:enemiesList.filter(e=>e.occult).length,zombies:enemiesList.filter(e=>e.occultZombie).length,projectiles:occultProjectiles.length,grounds:occultGroundEffects.length,bursts:occultSpellBursts.length},nav:{...occultNavigation.stats},horde:typeof occultHorde==='undefined'?null:{...occultHorde.stats},pools:typeof occultProjectilePool==='undefined'?null:[occultProjectilePool,occultGroundPool,occultBurstPool].map(p=>({capacity:p.capacity,records:p.records.length,active:p.active,acquired:p.acquired,released:p.released,highWater:p.highWater})),rig:{on:GLRig.on,ok:GLRig.ok,tier:GLRig.tier,lightTier:GLRig.lightTier},fault:window.FRAME_FAULT||null})`);
   const status=await api.status();const result={...c,cpu:stats(samples.cpu),interval:stats(samples.intervals),stage:Object.entries(detail.timers).map(([name,v])=>({name,ms:v.ms/frames,self:v.self/frames,calls:v.calls/frames})).sort((a,b)=>b.self-a.self),sampling:samplingSummary(profile),...detail,status,samples};
   report.results.push(result);fs.writeFileSync(out,JSON.stringify(report,null,2));
   console.log(JSON.stringify({scenario:c.scenario,lighting:c.lighting,sha:report.sha,cpu:result.cpu,initial:detail.initial,final:detail.final,stages:result.stage.slice(0,10),sampling:result.sampling.slice(0,15),errors:status.errors,fault:detail.fault}));
   if(process.env.DUNGEON_SHOTS==='1')await api.screenshot('dungeon-perf-'+c.scenario+'-'+c.lighting);
   if(status.errors.length||status.consoleErrors.length||detail.fault)throw Error('Native benchmark frame failed');
  }finally{await api.close();}
 }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

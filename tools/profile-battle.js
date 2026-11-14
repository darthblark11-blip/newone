// Sustained full-frame battle profiler: real p5, Chromium, AI, projectiles,
// particles, terrain, shadows, lighting and HUD. The crowd stays alive, unlike
// check-frame.js, which deliberately drains its actors to exercise death paths.
//
// VIS_DEPS=/workspace/onboarding-newone VIS_CHROME=/usr/bin/chromium \
//   GAME_JS=/tmp/game-before.js node tools/profile-battle.js
// Options: BATTLE_COUNTS=80,150 BATTLE_LIGHTING=fallback,advanced
// BATTLE_FRAMES=180 BATTLE_WARM=60 BATTLE_PROFILE=1 BATTLE_OUT=/tmp/battle.json
// BATTLE_P5=/absolute/path/to/p5.min.js selects the game's deployed p5 version.
// BATTLE_SHOT=/tmp/battle.png (last scene). BATTLE_FINE=1 adds nested AI/art
// phase timers for diagnosis. No dependencies are added here.
//
// CPU draw time and start-to-start painted frame intervals are both reported.
// Headless Chromium uses software WebGL; these figures describe this host,
// not a guarantee of 60 FPS on a phone. Advanced and fallback stay pinned so
// a watchdog quality change cannot make unlike pictures look like a speedup.
const fs = require('fs'), path = require('path');
const deps = process.env.VIS_DEPS || '/workspace/onboarding-newone';
const { chromium } = require(path.join(deps, 'node_modules/playwright'));
const p5Path = process.env.BATTLE_P5 || path.join(deps, 'node_modules/p5/lib/p5.min.js');
const p5 = fs.readFileSync(p5Path, 'utf8');
const sourcePath = process.env.GAME_JS || path.join(__dirname, '..', 'game.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const counts = (process.env.BATTLE_COUNTS || '80,150').split(',').map(Number);
const modes = (process.env.BATTLE_LIGHTING || 'fallback,advanced').split(',');
const frames = Number(process.env.BATTLE_FRAMES || 180);
const warm = Number(process.env.BATTLE_WARM || 60);
const viewport = { width: Number(process.env.BATTLE_W || 540), height: Number(process.env.BATTLE_H || 1170) };
function stats(a) {
  const sorted = a.slice().sort((x, y) => x - y);
  return { mean: a.reduce((x, y) => x + y, 0) / a.length,
    median: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
    max: sorted[sorted.length - 1] };
}
function profileSummary(profile) {
  const nodes = new Map(profile.nodes.map(n => [n.id, n]));
  const self = new Map();
  (profile.samples || []).forEach((id, i) => {
    const n = nodes.get(id), f = n && n.callFrame;
    const key = f ? `${f.functionName || '(anonymous)'}:${f.lineNumber + 1}` : '(unknown)';
    self.set(key, (self.get(key) || 0) + (profile.timeDeltas[i] || 0) / 1000);
  });
  return Array.from(self, ([name, ms]) => ({ name, ms })).sort((a, b) => b.ms - a.ms).slice(0, 25);
}
const bootstrap = `
(function(){var mem={};Object.defineProperty(window,'localStorage',{value:{
getItem:k=>Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null,
setItem:(k,v)=>mem[k]=String(v),removeItem:k=>delete mem[k],clear:()=>mem={}}});
var seed=90210;window.__randCalls=0;Math.random=function(){window.__randCalls++;
seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
window.__resetRandom=function(){seed=90210;window.__randCalls=0;};})();`;
const fixture = `
window.preload=function(){};
window.setup=function(){createCanvas(${viewport.width},${viewport.height});pixelDensity(1);noLoop();
randomSeed(7);noiseSeed(typeof BIOME_SEED!=='undefined'?BIOME_SEED:1337);
leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};window.__ready=true;};
window.__battleInit=function(count,mode){
  isStoryMode=true;started=true;isPaused=false;startAtLevel(1);
  isDead=false;isWin=false;killcamMode=false;inStoryIntro=false;inStoryRoom=false;
  inTownCutscene=false;inDarchonCall=false;inFarmCutscene=false;inFarmPostCutscene=false;
  inPostAmbushCutscene=false;inFortCutscene=false;nm0AmbushActive=true;nm0AmbushKills=1000000;
  window.ambushSpawnsRemaining=0;window.ambushOrigin=null;
  darchonCallCompleted=true;headAimToggle=false;objectiveTimer=0;
  // Keep the real authored map and streamed chunks. The normal starting plaza
  // supplies an open approach, nearby roofs, and the same collision workload.
  player.x=600;player.y=700;player.maxHp=player.hp=1e8;player.shield=0;
  player.currentWeapon=WEAPONS.SMG;player.isArmed=true;player.ammo=1e7;
  player.forceNudge();const px=player.x,py=player.y;
  // Scenery remains solid and visible; stop barrel chain reactions from
  // instantly deleting even high-HP actors and draining the timed workload.
  for(const b of barrels)b.hp=1e8;
  enemiesList.length=0;townCitizens.length=0;bullets.length=0;particles.length=0;
  if(typeof orbs!=='undefined')orbs.length=0;
  randomSeed(90210);window.__resetRandom();
  const types=['ARMORED_STANDARD','ARMORED_STANDARD','NM0_ROOKIE','ARMORED_STANDARD','ROBOT','ARMORED'];
  for(let i=0;i<count;i++){
    const a=i*2.399963229728653,r=240+(i%9)*48;
    const e=new Character(px+Math.cos(a)*r,py+Math.sin(a)*r,false,types[i%types.length]);
    e.hp=e.maxHp=1e8;e.state='CHASE';e.isFriendly=false;e.isNeutral=false;e.isArmed=true;
    e.isAmbush=true;
    if(e.eType==='ROBOT')e.headHP=1e8;
    e.loseSightTimer=3500;e.lastKnownX=px;e.lastKnownY=py;e.fireTimer=i%35;
    e.forceNudge();enemiesList.push(e);
  }
  zoom=.65;camX=px-width/2/zoom;camY=py-height/2/zoom;
  worldTimeMs=20.4/24*DAY_MS;updateSunVector();
  window.__fixedMs=0;window.millis=()=>window.__fixedMs;
  // Pin both lighting modes and their existing full-quality parameters.
  window.glRigWatchdog=function(){};window.glRigClock=function(){};
  if(mode==='advanced'){glRigInit();GLRig.on=true;GLRig.tier=0;GLRig.lightTier=0;
    GLRig.ms=16;GLRig.resize=true;if(!GLRig.ok)throw Error('WebGL unavailable: '+GLRig.failure);}
  else{GLRig.on=false;GLRig.failure=GLRIG_SHED_MSG;}
  window.__stage={};window.__stageFrame={};window.__counts={shots:0,hits:0,orbs:0,emit:0};
  window.__crowd=enemiesList.slice();
  const names=['manageChunkMemory','updateActiveWorld','updateWorldClock','updateBuildCrews',
  'drawGround','drawBuildingPads','drawGroundLots','drawBiomeDecks','updateBloodPools',
  'drawBloodChunks','updateCorpses','updateEntities','drawBuildingShadows','drawDepthSorted',
  'drawParkingCars','drawAirborneActors','updateBullets','updateGrenades','updateParticles',
  'updateOrbs','drawNightLights','glRigFrame','drawLightPass','drawBiomeScreenLayer','drawUI'];
  for(const name of names){const fn=window[name];if(typeof fn!=='function')continue;
    window[name]=function(){const t=performance.now();try{return fn.apply(this,arguments);}
      finally{window.__stageFrame[name]=(window.__stageFrame[name]||0)+performance.now()-t;}};}
  for(const [name,key]of[['spawnBullet','shots'],['spawnOrb','orbs'],['emit','emit']]){
    const fn=window[name];if(typeof fn==='function')window[name]=function(){
      window.__counts[key]++;return fn.apply(this,arguments);};}
  const takeDamage=Character.prototype.takeDamage;
  Character.prototype.takeDamage=function(){window.__counts.hits++;return takeDamage.apply(this,arguments);};
  if(${process.env.BATTLE_FINE === '1'}){
    for(const [name,label]of[['show','characterArt'],['updateEnemy','characterAI'],
      ['checkCol','characterCollision'],['forceNudge','characterNudge'],['attemptMove','characterMovement']]){
      const fn=Character.prototype[name];if(typeof fn!=='function')continue;
      Character.prototype[name]=function(){const t=performance.now();try{return fn.apply(this,arguments);}
        finally{window.__stageFrame[label]=(window.__stageFrame[label]||0)+performance.now()-t;}};
    }
    for(const name of ['drawBuildings','drawBiomeProps','sceneEmitters','glRigBuildHeight']){
      const fn=window[name];if(typeof fn!=='function')continue;
      window[name]=function(){const t=performance.now();try{return fn.apply(this,arguments);}
        finally{window.__stageFrame[name]=(window.__stageFrame[name]||0)+performance.now()-t;}};
    }
  }
  window.__hash=2166136261;window.__state=[];window.__origin=[px,py];window.__tick=0;
};
window.__battleStep=function(){
  const f=window.__tick++;window.__fixedMs=f*1000/60;deltaTime=1000/60;
  isPaused=false;isDead=false;isWin=false;killcamMode=false;inTownCutscene=false;inDarchonCall=false;
  inFarmCutscene=false;inFarmPostCutscene=false;inPostAmbushCutscene=false;inFortCutscene=false;
  // Real touch inputs strafe and shoot continuously; no scripted fake flashes.
  leftStick.active=true;leftStick.dx=Math.cos(f*.025)*.7;leftStick.dy=Math.sin(f*.025)*.7;
  rightStick.active=true;rightStick.dx=Math.cos(f*.045);rightStick.dy=Math.sin(f*.045);rightStick.dist=1;
  player.hp=player.maxHp;player.shield=0;player.ammo=1e7;
  window.__stageFrame={};const begin=performance.now();redraw();const cpu=performance.now()-begin;
  for(const [name,ms]of Object.entries(window.__stageFrame)){
    if(!window.__stage[name])window.__stage[name]=[];window.__stage[name].push(ms);}
  // Fingerprint gameplay, not benchmark cache/pool metadata. Full precision
  // coordinates expose changes in trajectories and collision decisions.
  const state=[player.x,player.y,player.hp,player.aimAngle,player.fireTimer,
    enemiesList.map(e=>[e.eType,e.x,e.y,e.hp,e.state,e.aimAngle,e.fireTimer,e.reloadTimer,e.orbChargeTimer]),
    bullets.map(b=>[b.x,b.y,b.px,b.py,b.life,b.angle,b.vx,b.vy,b.dead]),
    typeof orbs!=='undefined'?orbs.map(o=>[o.x,o.y,o.life,o.vx,o.vy]):[],
    particles.map(p=>[p.x,p.y,p.type,p.life,p.vx,p.vy,p.sz]),window.__randCalls];
  const json=JSON.stringify(state);let h=window.__hash;
  for(let i=0;i<json.length;i++)h=Math.imul(h^json.charCodeAt(i),16777619)>>>0;
  window.__hash=h;return {cpu,actors:enemiesList.length,bullets:bullets.length,particles:particles.length};
};
window.__battleResult=function(){
const rgba=drawingContext.getImageData(0,0,width,height).data;let pixelHash=2166136261;
for(let i=0;i<rgba.length;i++)pixelHash=Math.imul(pixelHash^rgba[i],16777619)>>>0;
return {stages:window.__stage,counts:window.__counts,pixelHash,
hash:window.__hash,randCalls:window.__randCalls,actors:enemiesList.length,
bullets:bullets.length,particles:particles.length,buildings:buildings.length,
activeBuildings:activeBuildings.length,rig:{on:GLRig.on,ok:GLRig.ok,failure:GLRig.failure,tier:GLRig.tier},
flags:{doTick,isPaused,isDead,isWin,killcamMode,inTownCutscene,inDarchonCall,inFortCutscene},
states:enemiesList.reduce((o,e)=>(o[e.state]=(o[e.state]||0)+1,o),{}),
removed:window.__crowd.filter(e=>enemiesList.indexOf(e)===-1).map(e=>({type:e.eType,hp:e.hp,dead:e.dead,enraged:e.enraged})),
fault:window.FRAME_FAULT?{n:window.FRAME_FAULT.n,message:window.FRAME_FAULT.msg}:null};};
`;
async function run() {
  const browser = await chromium.launch({ executablePath: process.env.VIS_CHROME || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    for (const mode of modes) for (const count of counts) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', e => errors.push(e.stack || String(e)));
      await page.setContent('<!doctype html><meta charset="utf-8"><style>body{margin:0}</style>' +
        '<script>' + bootstrap + '</script><script>' + p5 + '</script><script>' + source +
        '</script><script>' + fixture + '</script>', { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__ready, { timeout: 30000 });
      await page.evaluate(({ count, mode }) => window.__battleInit(count, mode), { count, mode });
      await page.evaluate(async warm => { for (let i = 0; i < warm; i++) {
        await new Promise(requestAnimationFrame); window.__battleStep(); }
        window.__stage = {}; }, warm);
      let cdp;
      if (process.env.BATTLE_PROFILE === '1') {
        cdp = await page.context().newCDPSession(page);
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
        await cdp.send('Profiler.start');
      }
      const measured = await page.evaluate(async frames => {
        const cpu = [], intervals = [], loads = []; let previous;
        for (let i = 0; i < frames; i++) {
          await new Promise(requestAnimationFrame);
          const t = performance.now(); if (previous !== undefined) intervals.push(t - previous); previous = t;
          const r = window.__battleStep(); cpu.push(r.cpu); loads.push([r.actors,r.bullets,r.particles]);
        }
        await new Promise(requestAnimationFrame);
        return { cpu, intervals, loads, detail: window.__battleResult() };
      }, frames);
      let sampling;
      if (cdp) { const { profile } = await cdp.send('Profiler.stop'); sampling = profileSummary(profile); }
      const detail = measured.detail;
      detail.stages = Object.fromEntries(Object.entries(detail.stages).map(([name, a]) => [name, stats(a)]));
      const result = { mode, count, frames, warm, cpu: stats(measured.cpu),
        paintedInterval: stats(measured.intervals), under16_7: measured.cpu.filter(x => x <= 1000/60).length,
        meanLoad: measured.loads.reduce((a, b) => a.map((x, i) => x + b[i]/frames), [0,0,0]),
        detail, errors, sampling };
      console.log(JSON.stringify({ source: sourcePath, ...result }));
      // Preserve each sample in the artifact so cloud scheduling pauses and
      // frame spikes can be inspected instead of being concealed by averages.
      results.push({ ...result, cpuSamples: measured.cpu, intervalSamples: measured.intervals });
      if (process.env.BATTLE_SHOT) await page.screenshot({ path: process.env.BATTLE_SHOT });
      await page.close();
      if (errors.length || detail.fault) throw Error('Benchmark encountered a frame error');
    }
  } finally { await browser.close(); }
  const report = { source: sourcePath, p5: p5Path, viewport,
    renderer: 'Chromium headless; software WebGL',
    audio: 'Sound cues execute with the Web Audio context uninitialized; synthesized voice cost is excluded.', results };
  if (process.env.BATTLE_OUT) fs.writeFileSync(process.env.BATTLE_OUT, JSON.stringify(report, null, 2));
}
run().catch(e => { console.error(e.stack || e); process.exitCode = 1; });

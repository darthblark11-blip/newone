// Native normal-health Level 2 battle profiler and deterministic mechanics replay.
// Uses real p5 draw(), native enemy death/wounds/corpses/reinforcements and
// initialized Web Audio. No game source is changed by this tool.
//
// BATTLE_P5=work/p5-1.11.11.min.js BATTLE_DRIVER=native BATTLE_AUDIO=native \
//   BATTLE_LIGHTING=fallback,advanced BATTLE_WARM=60 BATTLE_FRAMES=240 \
//   BATTLE_PROFILE=1 BATTLE_OUT=work/nm0-native.json node tools/profile-nm0-combat.js
// Native driver runs p5 loop() with frameRate(1000), actual deltaTime and real
// timers. Actual GPU/ANGLE renderer and AudioContext state are recorded.
// BATTLE_HEALTH=sustained opts back into raised actor HP; normal is the default.
// BATTLE_DRIVER=replay uses fixed 60 Hz simulation and a deterministic timer
// queue honoring native callback delays, for mechanics comparisons only.
// BATTLE_COMPARE=/absolute/baseline.js BATTLE_AUDIO=off BATTLE_DRIVER=replay
// compares every frame, including warm-up, and reports the first state change.
// BATTLE_TRACE=1 records full simulation hashes outside draw CPU timing.
// BATTLE_PIXELS=1 additionally hashes each measured frame outside that timer.
// BATTLE_AUDIO_TIMERS=1 adds diagnostic nested audio timers/node counts.
// BATTLE_RIG_TIMERS=1 separates GL upload, same-frame transfer and host-copy time.
// BATTLE_PAINT_COUNTS=1 counts actual character painters and tightened-cull bands
// for a separate correctness replay; keep it off during clean timing.
// BATTLE_ZONES=LEGS BATTLE_PLAYER_Y=1600 stages close-range native leg fire.
// BATTLE_ALLOW_SOFTWARE=0 omits the software WebGL enable flag.
// Phone geometry: BATTLE_W=360 BATTLE_H=780 BATTLE_DPR=3 BATTLE_DENSITY=2
// BATTLE_TOUCH=1 enables a mobile touch page. Full physical-canvas pixels are hashed.
// Existing external dependencies are reused; no package files are added.
const fs = require('fs'), path = require('path');
const deps = process.env.VIS_DEPS || '/workspace/.environment/newone';
let chromium;
function loadBrowserDependency(){
  if(chromium)return;
  try { ({chromium}=require('playwright')); }
  catch { ({chromium}=require(path.join(deps,'node_modules/playwright'))); }
}
let p5Path = process.env.BATTLE_P5;
if (!p5Path) {
  try { p5Path = require.resolve('p5/lib/p5.min.js'); }
  catch { p5Path = path.join(deps, 'node_modules/p5/lib/p5.min.js'); }
}
let p5;
const sourcePath = process.env.GAME_JS || path.join(__dirname, '..', 'game.js');
let source;
function loadSources(){
  if(p5===undefined)p5=fs.readFileSync(p5Path,'utf8');
  if(source===undefined)source=fs.readFileSync(sourcePath,'utf8');
}
const counts = (process.env.BATTLE_COUNTS || '80').split(',').map(Number);
const modes = (process.env.BATTLE_LIGHTING || 'fallback,advanced').split(',');
const nativeDriver = process.env.BATTLE_DRIVER !== 'replay';
const normalHealth = process.env.BATTLE_HEALTH !== 'sustained';
const nativeAudio = process.env.BATTLE_AUDIO !== 'off';
const comparePath = process.env.BATTLE_COMPARE;
const traceState = !!comparePath || process.env.BATTLE_TRACE === '1';
const dtSequence=(process.env.BATTLE_DT_SEQUENCE||String(1000/60)).split(',').map(Number);
const zoneFrames=Number(process.env.BATTLE_ZONE_FRAMES||40);
const zones=(process.env.BATTLE_ZONES||'BODY,HEAD,LEGS').split(',');
const playerX=Number(process.env.BATTLE_PLAYER_X||200),playerY=Number(process.env.BATTLE_PLAYER_Y||1250);
if (comparePath && nativeDriver) throw Error('BATTLE_COMPARE requires BATTLE_DRIVER=replay');
const frames = Number(process.env.BATTLE_FRAMES || 180);
const warm = Number(process.env.BATTLE_WARM || 60);
const viewport = { width: Number(process.env.BATTLE_W || 540), height: Number(process.env.BATTLE_H || 1170) };
const deviceScaleFactor=Number(process.env.BATTLE_DPR||process.env.BATTLE_DEVICE_SCALE||1);
const density=Number(process.env.BATTLE_DENSITY||Math.min(deviceScaleFactor,2));
const touchDevice=process.env.BATTLE_TOUCH==='1';
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
function profileCallers(profile) {
  const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map();
  for(const node of profile.nodes)for(const child of node.children||[])parents.set(child,node.id);
  const gameScripts=new Set(profile.nodes.filter(n=>['updateEnemy','paintString','glRigFrame'].includes(n.callFrame.functionName)&&n.callFrame.lineNumber>1000).map(n=>n.callFrame.scriptId));
  const groups=new Map(),totals={p5SelfMs:0,nativeSelfMs:0,gameSelfMs:0,otherMs:0};
  for(let i=0;i<(profile.samples||[]).length;i++){
    const leaf=nodes.get(profile.samples[i]),f=leaf&&leaf.callFrame,ms=(profile.timeDeltas[i]||0)/1000;
    if(!f)continue;
    const p5=f.lineNumber>=0&&f.lineNumber<=2&&!gameScripts.has(f.scriptId);
    const native=f.lineNumber<0&&!/^\((?:program|idle|garbage collector)\)$/.test(f.functionName);
    const kind=p5?'p5SelfMs':native?'nativeSelfMs':gameScripts.has(f.scriptId)?'gameSelfMs':'otherMs';totals[kind]+=ms;
    let node=leaf,caller=null;
    while(node){const frame=node.callFrame;
      if(gameScripts.has(frame.scriptId)||(gameScripts.size===0&&frame.lineNumber>1000)){caller=frame;break;}
      node=nodes.get(parents.get(node.id));}
    if(!caller)continue;
    const key=(caller.functionName||'(anonymous)')+':'+(caller.lineNumber+1);
    let group=groups.get(key);if(!group)groups.set(key,group={name:key,p5SelfMs:0,nativeSelfMs:0,gameSelfMs:0,otherMs:0,p5Operations:{},nativeOperations:{}});
    group[kind]+=ms;
    if(p5){const key=f.functionName||'(anonymous)';group.p5Operations[key]=(group.p5Operations[key]||0)+ms;}
    if(native){const key=f.functionName||'(anonymous)';group.nativeOperations[key]=(group.nativeOperations[key]||0)+ms;}
  }
  return {gameScriptIds:Array.from(gameScripts),totals,nearestGameCallers:Array.from(groups.values()).sort((a,b)=>b.p5SelfMs-a.p5SelfMs).slice(0,50)};
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
window.setup=function(){pixelDensity(${density});createCanvas(${viewport.width},${viewport.height});noLoop();
randomSeed(7);noiseSeed(typeof BIOME_SEED!=='undefined'?BIOME_SEED:1337);
leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};window.__ready=true;};
window.__battleInit=async function(count,mode){
  window.__nativeAudio=${nativeAudio};
  if(window.__nativeAudio){sfx.init();if(sfx.ctx&&sfx.ctx.state==='suspended')await sfx.ctx.resume();
    const wait=[];for(const def of Object.values(sfx.SAMPLES||{})){const list=typeof def.data==='string'?[def.data]:def.data||[];for(const data of list){
      const binary=atob(data),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      if(sfx.ctx)wait.push(sfx.ctx.decodeAudioData(bytes.buffer).catch(()=>null));}}
    await Promise.all(wait);await Promise.resolve();
    if(!sfx.ctx||sfx.ctx.state!=='running')throw Error('Native AudioContext failed to run');
  }
  window.__nativeDriver=${nativeDriver};
  if(!window.__nativeDriver)window.__installTimerReplay();
  randomSeed(90210);window.__resetRandom();
  window.__fixedMs=0;if(!window.__nativeDriver)window.millis=()=>window.__fixedMs;
  resetRunState();resetStoryProgress();
  isStoryMode=true;started=true;isPaused=false;startAtLevel(2);
  isDead=false;isWin=false;killcamMode=false;inStoryIntro=false;inStoryRoom=false;
  inTownCutscene=false;inDarchonCall=false;inFarmCutscene=false;inFarmPostCutscene=false;
  inPostAmbushCutscene=false;inFortCutscene=false;inOverworldView=false;
  inWorldBuildingMenu=false;inTravelMenu=false;inLvl4Cutscene=false;
  window.inNM0SecretOverlay=false;darchonCallCompleted=true;headAimToggle=false;
  player.x=${playerX};player.y=${playerY};player.maxHp=player.hp=1e8;player.shield=0;
  player.currentWeapon=WEAPONS.SMG;player.isArmed=true;player.ammo=1e7;
  player.forceNudge();const px=player.x,py=player.y;
  if(!${normalHealth})for(const b of barrels)b.hp=1e8;
  // Recreate the real tower victory: convert the finite native population,
  // remove the defeated tower geometry, then advance its cutscene to the
  // existing ambush spawn phase. No substitute enemy spawn or AI loop.
  enemiesList=enemiesList.filter(e=>e.isPopulation);
  recruitSectorSurvivors();
  let recruits=enemiesList.filter(e=>e.isFriendly);
  while(recruits.length<count){
    const e=new Character(px,py,false,'FEMALE_PISTOL');
    e.isFriendly=true;e.isNeutral=false;e.isRecruit=true;e.isPopulation=true;
    enemiesList.push(e);recruits.push(e);
  }
  if(recruits.length>count){
    const excess=new Set(recruits.slice(count));
    enemiesList=enemiesList.filter(e=>!excess.has(e));recruits=recruits.slice(0,count);
  }
  for(let i=0;i<recruits.length;i++){
    const e=recruits[i];
    e.x=px+((i%12)-5.5)*65;e.y=py-200+Math.floor(i/12)*48;
    if(!${normalHealth}){e.hp=e.maxHp=1e8;e.fireTimer=i%35;}e.state='CHASE';
    e.forceNudge();
  }
  window.towersDefeated=true;markSectorTowersDown(2);
  for(const b of sectorTowers())b.hp=0;
  buildings=buildings.filter(b=>!b.isTower);
  authoredSolids=authoredSolids.filter(b=>!b.isTower);
  clearGateApproach();invalidateColIndex();lastActiveUpdate=-1000;
  townCitizens.length=0;bullets.length=0;particles.length=0;
  if(typeof orbs!=='undefined')orbs.length=0;
  // A quiet encounter timer isolates AI/render equivalence from the separately
  // authorized wildlife spawn suppression. BATTLE_WILDLIFE=native includes
  // the unchanged native animal-spawn clock for end-to-end measurements.
  if(${process.env.BATTLE_WILDLIFE !== 'native'})_wildlifeSpawnClock=1e9;
  randomSeed(90210);window.__resetRandom();
  inTownCutscene=true;townPhase=7;deltaTime=1000/60;redraw();
  if(!nm0AmbushActive)throw Error('Native Level 2 tower ambush did not start');
  const ambushers=enemiesList.filter(e=>!e.isFriendly&&e.isAmbush);
  if(ambushers.length!==100)throw Error('Expected 100 initial NM-0 ambushers, got '+ambushers.length);
  if(!${normalHealth})for(const e of ambushers){e.hp=e.maxHp=1e8;e.fireTimer=e.aiOffset*3;}
  window.__initial={allies:recruits.length,ambushers:ambushers.length,reserves:window.ambushSpawnsRemaining};
  zoom=.65;camX=px-width/2/zoom;camY=py-height/2/zoom;
  worldTimeMs=20.4/24*DAY_MS;updateSunVector();
  window.__fixedMs=0;if(!window.__nativeDriver)window.millis=()=>window.__fixedMs;
  // Pin both lighting modes and their existing full-quality parameters.
  window.glRigWatchdog=function(){};window.glRigClock=function(){};
  if(mode==='advanced'){glRigInit();GLRig.on=true;GLRig.tier=0;GLRig.lightTier=0;
    GLRig.ms=16;GLRig.resize=true;if(!GLRig.ok)throw Error('WebGL unavailable: '+GLRig.failure);}
  else{GLRig.on=false;GLRig.failure=GLRIG_SHED_MSG;}
  window.__stage={};window.__stageFrame={};window.__counts={shots:0,hits:0,orbs:0,emit:0,kills:0,reinforcements:0};
  window.__crowd=enemiesList.slice();
  const names=['manageChunkMemory','updateActiveWorld','updateWorldClock','updateBuildCrews',
  'updateForestWildlife','drawGround','drawBuildingPads','drawGroundLots','drawBiomeDecks','updateBloodPools',
  'drawBloodChunks','updateCorpses','updateEntities','drawBuildingShadows','drawDepthSorted',
  'drawParkingCars','drawAirborneActors','updateBullets','updateGrenades','updateParticles',
  'updateOrbs','drawNightLights','glRigFrame','drawLightPass','drawBiomeScreenLayer','drawUI'];
  for(const name of names){const fn=window[name];if(typeof fn!=='function')continue;
    window[name]=function(){const t=performance.now();try{return fn.apply(this,arguments);}
      finally{window.__stageFrame[name]=(window.__stageFrame[name]||0)+performance.now()-t;}};}
  for(const [name,key]of[['spawnBullet','shots'],['spawnOrb','orbs'],['emit','emit'],['processKill','kills'],['spawnAmbushReinforcement','reinforcements']]){
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
    for(const name of ['drawBuildings','drawBiomeProps','sceneEmitters','glRigBuildHeight','enemyCoverDesired','enemyShotReactionEligible','actorCanUseStances','shovelActorsVisible','forestWildlifeHitTest']){
      const fn=window[name];if(typeof fn!=='function')continue;
      window[name]=function(){const t=performance.now();try{return fn.apply(this,arguments);}
        finally{window.__stageFrame[name]=(window.__stageFrame[name]||0)+performance.now()-t;}};
    }
  }
  window.__hash=2166136261;window.__state=[];window.__origin=[px,py];window.__tick=0;
  window.__capturePixels=false;window.__pixelHashes=[];window.__frameHashes=[];window.__loadSamples=[];
  window.__installFullSnapshot();window.__installAudioTimers();window.__installRigTimers();window.__installPaintCounters();
};
window.__battleInputs=function(){
  const f=window.__tick;
  if(${process.env.BATTLE_PAINT_COUNTS === '1'})window.__paintFrame={characters:0,npcs:0,eligibleBand:0};
  leftStick.active=true;leftStick.dx=Math.cos(f*.025)*.7;leftStick.dy=Math.sin(f*.025)*.7;
  let target=null,best=Infinity;
  for(const e of enemiesList)if(!e.isFriendly&&!e.dead&&e.hp>0){
    const d=(e.x-player.x)**2+(e.y-player.y)**2;if(d<best){best=d;target=e;}}
  const angle=target?Math.atan2(target.y-player.y,target.x-player.x):f*.045;
  rightStick.active=true;rightStick.dx=Math.cos(angle);rightStick.dy=Math.sin(angle);rightStick.dist=1;
  const zones=${JSON.stringify(zones)};setPlayerAimZone(zones[Math.floor(f/${zoneFrames})%zones.length]);
  // Keep the observer alive and supplied; all NPC health, damage, death and
  // reserves are native in normal-health mode. Do not restore NPC state.
  if(!isDead&&!player.dead){player.hp=player.maxHp||100;player.ammo=1e7;}
};
window.__battleFinishFrame=function(cpu,startedAt){
  const f=window.__tick++;
  for(const [name,ms]of Object.entries(window.__stageFrame)){
    if(!window.__stage[name])window.__stage[name]=[];window.__stage[name].push(ms);}
  const live=enemiesList.filter(e=>e.hp>0&&!e.dead),allies=live.filter(e=>e.isFriendly).length;
  const result={frame:f,cpu,startedAt,deltaTime,actors:live.length,allies,hostiles:live.length-allies,
    bullets:bullets.filter(b=>b.active).length,particles:particles.length,corpses:corpses.length,
    injured:live.filter(e=>e.legInjury).length,low:live.filter(e=>e.stance&&e.stance.value>.01).length,
    reserves:window.ambushSpawnsRemaining,kills:totalKills,doTick,isDead,isWin,killcamMode,
    audioVoices:sfx.activeVoices||0};
  if(${traceState}){
    const state=window.__battleSnapshot();window.__lastState=state;
    result.stateHash=window.__stateHash(state);window.__frameHashes.push([f,result.stateHash]);
  }
  if(f>=${warm})window.__capturePixels=true;
  if(window.__capturePixels&&${process.env.BATTLE_PIXELS === '1'})window.__pixelHashes.push([f,window.__battlePixels()]);
  if(${process.env.BATTLE_PAINT_COUNTS === '1'}){result.paint={...window.__paintFrame};}
  window.__loadSamples.push(result);
  if(window.__nativeDriver&&window.__tick===${warm})window.__stage={};
  return result;
};
window.__battleStep=function(){
  if(window.__nativeDriver)throw Error('Manual replay called with native driver');
  const steps=${JSON.stringify(dtSequence)};deltaTime=steps[window.__tick%steps.length];
  if(window.__tick>0)window.__fixedMs+=deltaTime;
  window.__runTimerReplay(window.__fixedMs);window.__battleInputs();
  window.__stageFrame={};const begin=performance.now();redraw();
  return window.__battleFinishFrame(performance.now()-begin,begin);
};
window.__battleStartNative=function(total){
  const nativeDraw=window.draw;window.__nativeSamples=[];window.__nativeDone=false;
  window.draw=function(){
    window.__battleInputs();window.__stageFrame={};
    const begin=performance.now();nativeDraw();
    window.__nativeSamples.push(window.__battleFinishFrame(performance.now()-begin,begin));
    if(window.__nativeSamples.length>=total){noLoop();window.__nativeDone=true;}
  };
  frameRate(1000);loop();
};
window.__battlePixels=function(){
  const canvas=drawingContext.canvas;
  const rgba=drawingContext.getImageData(0,0,canvas.width,canvas.height).data;let hash=2166136261;
  for(let i=0;i<rgba.length;i++)hash=Math.imul(hash^rgba[i],16777619)>>>0;
  return hash;
};
window.__battleResult=function(){
const pixelHash=window.__battlePixels();
const finalState=window.__lastState||window.__battleSnapshot();
return {initial:window.__initial,stages:window.__stage,counts:window.__counts,pixelHash,pixelHashes:window.__pixelHashes,
frameHashes:window.__frameHashes,loads:window.__loadSamples,rigOperations:window.__rigOperations||{},hardware:window.__battleHardware(),audio:window.__battleAudio(),
allies:enemiesList.filter(e=>e.isFriendly&&!e.dead&&e.hp>0).length,
ambushers:enemiesList.filter(e=>!e.isFriendly&&e.isAmbush&&!e.dead&&e.hp>0).length,
wildlife:forestWildlife.length,reserves:window.ambushSpawnsRemaining,
hash:window.__stateHash(finalState),randCalls:window.__randCalls,randomState:p5.instance&&p5.instance._lcg_random_state,actors:enemiesList.length,
bullets:bullets.filter(b=>b.active).length,bulletSlots:bullets.length,particles:particles.length,buildings:buildings.length,
activeBuildings:activeBuildings.length,rig:{on:GLRig.on,ok:GLRig.ok,failure:GLRig.failure,tier:GLRig.tier},
flags:{doTick,isPaused,isDead,isWin,killcamMode,inTownCutscene,inDarchonCall,inFortCutscene},
states:enemiesList.reduce((o,e)=>(o[e.state]=(o[e.state]||0)+1,o),{}),
removed:window.__crowd.filter(e=>enemiesList.indexOf(e)===-1).map(e=>({type:e.eType,hp:e.hp,dead:e.dead,enraged:e.enraged})),
fault:window.FRAME_FAULT?{n:window.FRAME_FAULT.n,message:window.FRAME_FAULT.msg}:null};};
`;
const diagnostics = `
window.__installTimerReplay=function(){
  let next=1;window.__timerQueue=[];
  window.setTimeout=function(fn,delay,...args){const id=next++;
    window.__timerQueue.push({id,due:window.__fixedMs+Math.max(0,Number(delay)||0),fn,args});return id;};
  window.clearTimeout=function(id){window.__timerQueue=window.__timerQueue.filter(t=>t.id!==id);};
  window.__runTimerReplay=function(now){let budget=10000;
    while(budget--){let index=-1,best=Infinity;
      for(let i=0;i<window.__timerQueue.length;i++)if(window.__timerQueue[i].due<=now&&window.__timerQueue[i].due<best){index=i;best=window.__timerQueue[i].due;}
      if(index<0)return;const task=window.__timerQueue.splice(index,1)[0];task.fn(...task.args);}
    throw Error('Replay timer callback runaway');};
};
window.__stateHash=function(value){const json=JSON.stringify(value);let h=2166136261;
  for(let i=0;i<json.length;i++)h=Math.imul(h^json.charCodeAt(i),16777619)>>>0;return h;};
window.__installFullSnapshot=function(){
  const actorIds=new WeakMap(),solidIds=new WeakMap();let nextActor=1,nextSolid=1;
  const derived=new Set(['_stancePose','_legHitGeometry','_blockFn','_citizenBlockFn','_figurePose','_standMotionCache']);
  const register=()=>{for(const a of [player,...enemiesList,...townCitizens])if(a&&!actorIds.has(a))actorIds.set(a,nextActor++);
    for(const b of [...buildings,...parkingCars,...barrels])if(b&&!solidIds.has(b))solidIds.set(b,nextSolid++);};
  function plain(value,seen=new Map(),path='root',root=false){
    if(value===undefined)return {$undefined:true};
    if(typeof value==='number')return Number.isFinite(value)?value:{$number:String(value)};
    if(value===null||typeof value==='string'||typeof value==='boolean')return value;
    if(typeof value==='function')return undefined;
    if(!root&&actorIds.has(value))return {$actor:actorIds.get(value)};
    if(!root&&solidIds.has(value))return {$solid:solidIds.get(value)};
    if(value instanceof p5.Color)return {$color:value.levels.slice(),rgba:value._array&&value._array.slice()};
    if(seen.has(value))return {$ref:seen.get(value)};seen.set(value,path);
    if(Array.isArray(value))return value.map((x,i)=>plain(x,seen,path+'.'+i));
    if(value instanceof Set)return {$set:Array.from(value,(x,i)=>plain(x,seen,path+'.set'+i))};
    if(value instanceof Map)return {$map:Array.from(value,([k,v],i)=>[plain(k,seen,path+'.key'+i),plain(v,seen,path+'.value'+i)])};
    if(ArrayBuffer.isView(value))return Array.from(value);
    const out={};for(const key of Object.keys(value).sort())if(!derived.has(key)&&typeof value[key]!=='function'){
      out[key]=plain(value[key],seen,path+'.'+key);}
    return out;
  }
  window.__battleSnapshot=function(){register();
    const actor=a=>({id:actorIds.get(a),state:plain(a,new Map(),'actor',true)});
    return {frame:window.__tick,frameCount,deltaTime,
      globals:{currentLevel,currentBiome,doTick,isPaused,isDead,isWin,killcamMode,inTownCutscene,inDarchonCall,inFortCutscene,
        nm0AmbushActive,nm0AmbushKills,ambushSpawnsRemaining:window.ambushSpawnsRemaining,totalKills,score,consecutiveKills,comboTimer,totalShotsFired,totalShotsHit,
        enemyShotClock:plain(enemyShotClock),legInjurySerial,headshotCounter,_comicHitSerial,_celExplosionSerial,
        randomState:p5.instance&&p5.instance._lcg_random_state,mathRandomCalls:window.__randCalls},
      player:actor(player),actors:enemiesList.map(actor),citizens:townCitizens.map(actor),
      bullets:bullets.map(b=>plain(b)),orbs:orbs.map(o=>plain(o)),particles:particles.map(p=>plain(p)),
      corpses:corpses.map(c=>plain(c)),bloodPools:plain(bloodPools),splatters:plain(splatters),
      grenades:plain(grenades),playerGrenades:plain(playerGrenades),fires:plain(fires),sludges:plain(sludges),
      healthPacks:plain(healthPacks),weaponDrops:plain(weaponDrops),resourceDrops:plain(resourceDrops),
      solids:[...buildings,...parkingCars,...barrels].map(b=>[solidIds.get(b),b.hp,b.dead,b.destroyed,b.x,b.y,b.w,b.h]),
      timers:(window.__timerQueue||[]).map(t=>({id:t.id,due:t.due,name:t.fn.name,args:plain(t.args)})),towns:plain(townsData),forts:plain(window.outpostForts||null),wildlifeLedger:plain(_wildlifeLedger),wildlife:plain(forestWildlife),counts:{...window.__counts}};
  };
};
window.__battleHardware=function(){
  const canvas=document.createElement('canvas'),gl=GLRig.gl||canvas.getContext('webgl2')||canvas.getContext('webgl');
  if(!gl)return {webgl:false};const ext=gl.getExtension('WEBGL_debug_renderer_info');
  return {webgl:true,version:gl.getParameter(gl.VERSION),vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),
    unmaskedVendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,
    unmaskedRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,
    maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE),maxRenderbufferSize:gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
    contextAttributes:gl.getContextAttributes(),p5:p5.VERSION,devicePixelRatio:window.devicePixelRatio,
    displayDensity:displayDensity(),pixelDensity:pixelDensity(),css:{width,height},
    physicalCanvas:{width:drawingContext.canvas.width,height:drawingContext.canvas.height},
    rigBuffers:{w:GLRig.w,h:GLRig.h,hw:GLRig.hw,hh:GLRig.hh,lw:GLRig.lw,lh:GLRig.lh}};
};
window.__battleAudio=function(){return {initialized:!!sfx.ctx,state:sfx.ctx&&sfx.ctx.state,
  sampleRate:sfx.ctx&&sfx.ctx.sampleRate,baseLatency:sfx.ctx&&sfx.ctx.baseLatency,outputLatency:sfx.ctx&&sfx.ctx.outputLatency,
  currentTime:sfx.ctx&&sfx.ctx.currentTime,voices:sfx.activeVoices,maxVoices:sfx.maxVoices,
  samples:Object.fromEntries(Object.entries(sfx.samples).map(([k,v])=>[k,v.variants.length])),nodes:window.__audioNodes||{}};};
window.__installPaintCounters=function(){
  if(!${process.env.BATTLE_PAINT_COUNTS === '1'})return;
  const show=Character.prototype.show;Character.prototype.show=function(...args){
    window.__paintFrame.characters++;if(!this.isPlayer)window.__paintFrame.npcs++;
    return show.apply(this,args);};
  const pad=window.actorRenderCullPad;if(pad)window.actorRenderCullPad=function(a){
    const result=pad(a);if(result===100&&inView(a.x,a.y,150)&&!inView(a.x,a.y,100))window.__paintFrame.eligibleBand++;
    return result;};
};
window.__installRigTimers=function(){
  if(!${process.env.BATTLE_RIG_TIMERS === '1'}||!GLRig.gl)return;
  window.__rigOperations={};let inside=false;
  const rigFrame=window.glRigFrame;window.glRigFrame=function(...args){inside=true;
    try{return rigFrame.apply(this,args);}finally{inside=false;}};
  const watch=(object,name,key)=>{const fn=object&&object[name];if(!fn)return;
    object[name]=function(...args){if(!inside)return fn.apply(this,args);
      const t=performance.now();try{return fn.apply(this,args);}finally{
        window.__stageFrame[key]=(window.__stageFrame[key]||0)+performance.now()-t;
        window.__rigOperations[key]=(window.__rigOperations[key]||0)+1;
        if(key==='rig.copy'){const label='copySource.'+(args[0]&&args[0].constructor&&args[0].constructor.name||'unknown');
          window.__rigOperations[label]=(window.__rigOperations[label]||0)+1;}};};};
  watch(drawingContext,'drawImage','rig.copy');
  watch(GLRig.gl,'texSubImage2D','rig.upload');watch(GLRig.gl,'texImage2D','rig.allocateTexture');
  watch(GLRig.canvas,'transferToImageBitmap','rig.transferBitmap');
};
window.__installAudioTimers=function(){window.__audioNodes={};
  if(!sfx.ctx)return;
  for(const name of ['createBufferSource','createGain','createBiquadFilter','createStereoPanner','createOscillator','createWaveShaper']){
    const fn=sfx.ctx[name];if(!fn)continue;sfx.ctx[name]=function(...args){
      window.__audioNodes[name]=(window.__audioNodes[name]||0)+1;return fn.apply(this,args);};}
  if(${process.env.BATTLE_AUDIO_TIMERS === '1'})for(const name of Object.keys(sfx))if(typeof sfx[name]==='function'&&!['init','rand','rng','profile','onePole'].includes(name)){
    const fn=sfx[name];sfx[name]=function(...args){const t=performance.now();try{return fn.apply(this,args);}
      finally{const key='audio.'+name;window.__stageFrame[key]=(window.__stageFrame[key]||0)+performance.now()-t;}};}
};
`;
const launchArgs=['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required'];
const ignoredDefaultArgs=[];
if(nativeAudio)ignoredDefaultArgs.push('--mute-audio');
if(process.env.BATTLE_ALLOW_SOFTWARE==='0')ignoredDefaultArgs.push('--enable-unsafe-swiftshader');
if(process.env.BATTLE_ALLOW_SOFTWARE!=='0')launchArgs.push('--enable-unsafe-swiftshader');
if(process.env.BATTLE_GL_ARGS)launchArgs.push(...JSON.parse(process.env.BATTLE_GL_ARGS));
async function createPage(browser,gameSource,count,mode){
  loadSources();
  const page=await browser.newPage({viewport,deviceScaleFactor,isMobile:touchDevice,hasTouch:touchDevice});page.__errors=[];
  page.on('pageerror',e=>page.__errors.push(e.stack||String(e)));
  await page.setContent('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style>'+
    '<script>'+bootstrap+'</script><script>'+p5+'</script><script>'+gameSource+'</script><script>'+diagnostics+fixture+'</script>',
    {waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>window.__ready,null,{timeout:30000});
  await page.evaluate(({count,mode})=>window.__battleInit(count,mode),{count,mode});return page;
}
function firstDifference(a,b,path='state'){
  if(Object.is(a,b))return null;
  if(!a||!b||typeof a!=='object'||typeof b!=='object')return {path,before:a,after:b};
  const keys=Array.from(new Set([...Object.keys(a),...Object.keys(b)])).sort();
  for(const key of keys){const diff=firstDifference(a[key],b[key],path+(Array.isArray(a)?'['+key+']':'.'+key));if(diff)return diff;}
  return null;
}
async function compare(browser){
  const beforeSource=fs.readFileSync(comparePath,'utf8'),comparisons=[];
  for(const mode of modes)for(const count of counts){
    const before=await createPage(browser,beforeSource,count,mode),after=await createPage(browser,source,count,mode);
    let divergence=null,pixelDivergence=null;const samples=[];
    for(let frame=0;frame<warm+frames;frame++){
      const a=await before.evaluate(()=>window.__battleStep()),b=await after.evaluate(()=>window.__battleStep());
      samples.push({frame,before:a.stateHash,after:b.stateHash});
      if(a.stateHash!==b.stateHash){
        const [oldState,newState]=await Promise.all([before.evaluate(()=>window.__lastState),after.evaluate(()=>window.__lastState)]);
        divergence={frame,difference:firstDifference(oldState,newState),before:oldState,after:newState};break;
      }
    }
    const oldDetail=await before.evaluate(()=>window.__battleResult()),newDetail=await after.evaluate(()=>window.__battleResult());
    const pixelDiff=firstDifference(oldDetail.pixelHashes,newDetail.pixelHashes,'pixelFrames');
    if(pixelDiff)pixelDivergence=pixelDiff;
    const detail={mode,count,framesCompared:samples.length,matched:!divergence&&!pixelDivergence,divergence,pixelDivergence,
      before:oldDetail,after:newDetail,samples,
      errors:{before:before.__errors,after:after.__errors}};
    comparisons.push(detail);console.log(JSON.stringify({mode,count,framesCompared:detail.framesCompared,matched:detail.matched,
      firstDivergence:divergence&&{frame:divergence.frame,...divergence.difference},pixelDivergence,errors:detail.errors}));
    await before.close();await after.close();
  }
  return {comparison:{before:comparePath,after:sourcePath},comparisons};
}
async function run(){
  loadBrowserDependency();loadSources();
  const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:launchArgs,ignoreDefaultArgs:ignoredDefaultArgs});
  const results=[];let systemInfo;
  try{
    const system=await browser.newBrowserCDPSession();systemInfo=await system.send('SystemInfo.getInfo');await system.detach();
    if(comparePath){const report=await compare(browser);if(process.env.BATTLE_OUT)fs.writeFileSync(process.env.BATTLE_OUT,JSON.stringify(report,null,2));return;}
    for(const mode of modes)for(const count of counts){
      const page=await createPage(browser,source,count,mode);let cdp;
      if(process.env.BATTLE_PROFILE==='1'){cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');
        await cdp.send('Profiler.setSamplingInterval',{interval:100});await cdp.send('Profiler.start');}
      let measured;
      if(nativeDriver){
        await page.evaluate(total=>window.__battleStartNative(total),warm+frames);
        await page.waitForFunction(()=>window.__nativeDone,null,{timeout:Number(process.env.BATTLE_TIMEOUT||300000)});
        measured=await page.evaluate(warm=>{
          const load=window.__nativeSamples.slice(warm),cpu=load.map(x=>x.cpu),intervals=load.slice(1).map((x,i)=>x.startedAt-load[i].startedAt);
          return {cpu,intervals,load,detail:window.__battleResult()};},warm);
      }else{
        measured=await page.evaluate(async({warm,frames})=>{
          const cpu=[],intervals=[],load=[];let previous;
          for(let i=0;i<warm+frames;i++){
            await new Promise(requestAnimationFrame);const t=performance.now(),r=window.__battleStep();
            if(i>=warm){cpu.push(r.cpu);if(previous!==undefined)intervals.push(t-previous);previous=t;load.push(r);}
            if(i===warm-1)window.__stage={};
          }
          return {cpu,intervals,load,detail:window.__battleResult()};},{warm,frames});
      }
      let sampling,samplingCallers,profileRawPath;if(cdp){const {profile}=await cdp.send('Profiler.stop');sampling=profileSummary(profile);samplingCallers=profileCallers(profile);
        if(process.env.BATTLE_OUT){profileRawPath=process.env.BATTLE_OUT+'.'+mode+'.'+count+'.cpuprofile';fs.writeFileSync(profileRawPath,JSON.stringify(profile));}}
      const detail=measured.detail;detail.stages=Object.fromEntries(Object.entries(detail.stages).map(([k,v])=>[k,stats(v)]));
      const result={mode,count,frames,warm,driver:nativeDriver?'native':'replay',dtSequence:nativeDriver?null:dtSequence,zoneFrames,health:normalHealth?'normal':'sustained',audio:nativeAudio,
        cpu:stats(measured.cpu),paintedInterval:stats(measured.intervals),cpuSamples:measured.cpu,intervalSamples:measured.intervals,
        measuredLoads:measured.load,detail,errors:page.__errors,sampling,samplingCallers,profileRawPath};results.push(result);
      if(process.env.BATTLE_OUT)fs.writeFileSync(process.env.BATTLE_OUT,JSON.stringify({source:sourcePath,p5:p5Path,viewport,deviceScaleFactor,density,touchDevice,launchArgs,ignoredDefaultArgs,systemInfo,results},null,2));
      console.log(JSON.stringify({...result,cpuSamples:undefined,intervalSamples:undefined,measuredLoads:undefined,
        detail:{...detail,loads:undefined,frameHashes:undefined,pixelHashes:undefined}}));
      if(process.env.BATTLE_SHOT)await page.screenshot({path:process.env.BATTLE_SHOT});await page.close();
      if(result.errors.length||detail.fault)throw Error('Native battle replay encountered a frame error');
    }
  }finally{await browser.close();}
  const crypto=require('crypto'),sha=v=>crypto.createHash('sha256').update(v).digest('hex');
  const report={source:sourcePath,sourceSha256:sha(source),p5:p5Path,p5Sha256:sha(p5),viewport,deviceScaleFactor,density,touchDevice,launchArgs,ignoredDefaultArgs,systemInfo,
    scenario:'Level2 native tower ambush; 80 recruits; normal NPC health and native kill-driven reserves unless sustained mode selected. Player health/ammo refreshed for observation. Native driver uses real deltaTime/timers; replay driver virtualizes timer scheduling and fixes simulation60Hz.',results};
  if(process.env.BATTLE_OUT)fs.writeFileSync(process.env.BATTLE_OUT,JSON.stringify(report,null,2));
}
if(require.main===module)run().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
module.exports={run,createPage,stats,firstDifference,profileCallers,launchArgs,fixture,diagnostics};

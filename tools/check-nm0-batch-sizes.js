// Smaller authored openings must keep the full NM-0 fight and refill cadence.
// Run with: node tools/check-nm0-batch-sizes.js
const assert = require('assert/strict');
const { ctx, probe } = require('./harness.js');
const P = s => probe('(' + s + ')');
let checks = 0, seed = 6047, slot = null;
const timers = [];
const ok = (name, condition) => { assert.ok(condition, name); checks++; };
ctx.random = function (a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  return b === undefined ? r * a : a + r * (b - a);
};
ctx.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
ctx.clearTimeout = () => {};
ctx.localStorage = {
  getItem: () => slot, setItem: (key, value) => { slot = value; },
  removeItem: () => { slot = null; }
};
ctx.console = { ...console, warn(...args) {
  console.warn(...args);
  if (String(args[0]).startsWith('frame fault in ')) throw args[1];
} };

function fresh(level, isolated = true) {
  timers.length = 0;
  probe(`resetStoryProgress(); window.outpostForts = {}; isStoryMode = true;
    startAtLevel(${level}); started = true; isPaused = isWin = isDead = false;
    inDarchonCall = false; darchonCallCompleted = true;
    inStoryIntro = inStoryRoom = false; doTick = true;
    leftStick = {active:false, dx:0, dy:0, base:{x:80, y:640}};
    rightStick = {active:false, dx:0, dy:0, dist:0, base:{x:1120, y:690}};
    window.showOnScreenControls = false;
    viewLeft = viewTop = -1e6; viewRight = viewBottom = 1e6;
    ${isolated ? `enemiesList = [];
      window.batchAlly = new Character(player.x, player.y, false, "NORMAL");
      batchAlly.isFriendly = true; enemiesList.push(batchAlly);` : ''}`);
}

function live() { return P('enemiesList.filter(e => e.isAmbush && !e.dead && e.hp > 0).length'); }
function reserve() { return P('window.ambushSpawnsRemaining'); }
function closed(name, total) {
  ok(name + ' counter, field and reserve agree', P('nm0AmbushKills') === total &&
    P('window.ambushKillsTotal') === total && live() + reserve() === total);
}
function killOne() {
  return P(`(() => {
    const e = enemiesList.find(e => e.isAmbush && !e.dead && e.hp > 0);
    if (!e) return false;
    e.dead = true; e.hp = 0; processKill(e.x, e.y, false, e.eType, false, e);
    enemiesList = enemiesList.filter(e => !e.dead); return true;
  })()`);
}

// Invoke the native kill and its deferred callback separately. A kill still
// schedules exactly one 200-800ms arrival, and each callback creates one body.
function drain(name, total, fort = false) {
  let kills = 0;
  timers.length = 0;
  while (P('nm0AmbushKills') > 0 && kills < total + 1) {
    const before = live(), held = reserve(), left = P('nm0AmbushKills');
    assert.ok(killOne(), name + ' ran out of bodies with ' + left + ' kills owed');
    assert.equal(P('nm0AmbushKills'), left - 1, name + ' kill decrements once');
    assert.equal(live(), before - 1, name + ' waits for its reinforcement timer');
    assert.equal(reserve(), held, name + ' preserves reserve until arrival');
    if (held > 0) {
      assert.equal(timers.length, 1, name + ' schedules one arrival');
      const timer = timers.shift();
      assert.ok(timer.ms >= 200 && timer.ms <= 800, name + ' retains delay');
      timer.fn();
      assert.equal(live(), before, name + ' callback adds one body');
      assert.equal(reserve(), held - 1, name + ' callback consumes one reserve');
    } else assert.equal(timers.length, 0, name + ' exhausted reserve schedules nothing');
    assert.equal(live() + reserve(), left - 1, name + ' conserves every remaining kill');
    if (fort) assert.equal(P('outpostFortState(currentBiome).musterLeft'), left - 1);
    kills++;
  }
  ok(name + ' drains exactly ' + total + ' kills with no stalled reserve',
    kills === total && live() === 0 && reserve() === 0 && P('!!window.nm0AmbushCleared'));
  if (fort) {
    probe('killcamMode = false; checkAmbushCleared();');
    ok(name + ' closes its persistent muster record', P('outpostFortState(currentBiome).musterDone') &&
      P('!outpostFortState(currentBiome).musterOn && outpostFortState(currentBiome).musterWaves === 0'));
  }
}

console.log('== gate opening and merge ==');
fresh(2);
probe('triggerGateAmbush(3000, false);');
ok('gate keeps all three approach groups within twenty bodies combined', P('enemiesList.length') === 21);
ok('gate counts every spawned body against the same total', live() === 20 && reserve() === 130 && !P('!!batchAlly.isAmbush'));
ok('gate composition is eighteen standard, one heavy, one aerial (three air slots halved down)',
  P('enemiesList.filter(e => !e.isFriendly && e.eType === "ARMORED_STANDARD").length') === 18 &&
  P('enemiesList.filter(e => e.eType === "ARMORED").length') === 1 &&
  P('enemiesList.filter(e => e.eType === "AERIAL" || e.eType === "AERIAL_PISTOL").length') === 1);
closed('gate', 150);
drain('gate', 150);

fresh(2);
probe('triggerGateAmbush(3000, false); triggerGateAmbush(-1800, true);');
ok('merged gate breaches append two smaller openings without tagging the ally',
  P('enemiesList.length') === 41 && live() === 40 && reserve() === 260 && !P('!!batchAlly.isAmbush'));
closed('merged gates', 300);

console.log('== native tower scene and merge ==');
function towerOpening(mergeGate) {
  fresh(2, false);
  probe(`for (const b of sectorTowers()) b.hp = 0; frameCount++; draw();
    killcamTimer = 1; draw();`);
  const allies = P('enemiesList.filter(e => e.isPopulation && e.isFriendly && !e.dead).length');
  assert.ok(allies > 0, 'native tower capture retains the recruited population');
  if (mergeGate) probe('triggerGateAmbush(3000, false);');
  probe('townPhase = 7; draw();');
  ok((mergeGate ? 'merged tower' : 'tower') + ' leaves converted allies untagged',
    P('enemiesList.filter(e => e.isPopulation && e.isFriendly && !e.dead && !e.isAmbush).length') === allies);
}
towerOpening(false);
ok('native phase seven creates twenty tagged tower hostiles', live() === 20 && reserve() === 280 && P('window.ambushKind === "TOWER"'));
ok('tower composition is seventeen standard, one heavy, two aerial (half the former four)',
  P('enemiesList.filter(e => e.isAmbush && e.eType === "ARMORED_STANDARD").length') === 17 &&
  P('enemiesList.filter(e => e.isAmbush && e.eType === "ARMORED").length') === 1 &&
  P('enemiesList.filter(e => e.isAmbush && (e.eType === "AERIAL" || e.eType === "AERIAL_PISTOL")).length') === 2);
closed('tower', 300);
probe('enemiesList = enemiesList.filter(e => e.isFriendly || e.isAmbush);');
drain('tower', 300);
towerOpening(true);
ok('tower merges twenty live and 280 held into the active gate fight', live() === 40 && reserve() === 410 && P('window.ambushKind === "TOWER"'));
closed('gate plus tower', 450);

console.log('== Grey Fatigue opening ==');
fresh(4);
probe('triggerLvl4Ambush();');
ok('Grey Fatigue opens with twenty counted hostiles and 130 held', live() === 20 && reserve() === 130 &&
  P('enemiesList.filter(e => e.isAmbush).every(e => e.eType === "NM0_GREY_FATIGUE")') && !P('!!batchAlly.isAmbush'));
closed('Grey Fatigue', 150);
drain('Grey Fatigue', 150);

console.log('== fort stations, conscription, floor and drain ==');
function fortOpening(conscripts = 0, blocked = false) {
  fresh(1);
  probe(`window.batchFort = outpostFortDef(1);
    player.x = batchFort.x; player.y = batchFort.y + FORT_HALF_H + 420;
    for (let i = 0; i < ${conscripts}; i++)
      enemiesList.push(new Character(batchFort.x + i * 40, batchFort.y, false, "NM0_ROOKIE"));
    ${blocked ? `buildings.push({x:batchFort.x, y:batchFort.y, w:3000, h:3000, isWall:true});
      activeBuildings = buildings.slice(); buildColIndex();` : ''}
    triggerOutpostAmbush(batchFort);`);
}
fortOpening(3);
const generated = P('enemiesList.filter(e => e.isAmbush && e.isOutpost).length');
ok('fort creates at most twenty new station bodies and keeps at least 130 in reserve', generated > 0 && generated <= 20 && reserve() >= 130);
ok('fort opening halves the old three aerial stations down to one', P('enemiesList.filter(e=>e.isAmbush&&(e.eType==="AERIAL"||e.eType==="AERIAL_PISTOL")).length')===1);
ok('existing fort-area overworld hostiles despawn without enlarging the 150-body battle',
  P('enemiesList.filter(e => e.isAmbush && e.eType === "NM0_ROOKIE").length') === 0 &&
  P('outpostFortState(1).musterTotal') === 150 && !P('!!batchAlly.isAmbush'));
closed('isolated fort', 150);
drain('isolated fort', 150, true);

fortOpening(0, true);
ok('blocked ground stations become extra reserves while aerial stations still spawn',
  live() > 0 && live() < 20 && reserve() === 150 - live() &&
  P('enemiesList.filter(e => e.isAmbush).every(e => e.eType === "AERIAL")'));
closed('blocked fort', 150);

fortOpening();
probe('enemiesList = enemiesList.filter(e => !e.isAmbush); frameCount = 23; maintainOutpostMuster();');
const held = reserve();
ok('fort does not refill outside its existing 24-frame cadence', live() === 0);
probe('frameCount = 24; maintainOutpostMuster();');
ok('fort adds two bodies on the first refill tick', live() === 2 && reserve() === held - 2);
probe('frameCount = 48; maintainOutpostMuster();');
ok('the next refill adds three bodies', live() === 5 && reserve() === held - 5);
probe('frameCount = 72; maintainOutpostMuster();');
ok('the next refill stops at the smaller six-body floor', live() === 6 && reserve() === held - 6);
probe('frameCount = 96; maintainOutpostMuster();');
ok('the six-body floor does not request another refill', live() === 6 && reserve() === held - 6);

let refilled = 0;
for (const frame of [120, 144, 168, 192, 216]) {
  const before = reserve();
  probe(`enemiesList = enemiesList.filter(e => !e.isAmbush);
    frameCount = ${frame}; maintainOutpostMuster();`);
  const batch = live();
  ok('fully requested fort refill at frame ' + frame + ' adds two or three bodies',
    (batch === 2 || batch === 3) && reserve() === before - batch);
  refilled += batch;
}
ok('five full fort refills total twelve arrivals, 40% below the previous twenty', refilled === 12);

console.log('== scripted fight reload cap ==');
towerOpening(false);
for (const left of [300, 150, 61, 60, 59, 21, 20, 19, 7, 2, 1, 0]) {
  probe(`nm0AmbushKills = ${left}; killcamMode = false; saveGame(); loadGame();`);
  const active = Math.min(20, left);
  ok('reload with ' + left + ' owed creates exactly ' + active + ' hostiles', live() === active && reserve() === left - active && P('nm0AmbushKills') === left);
  ok('reload keeps allies outside the counted ambush', P('enemiesList.filter(e => e.isFriendly).every(e => !e.isAmbush)'));
}

console.log('== old saves, gate/fort restoration and halved air ==');
towerOpening(false);
probe('nm0AmbushKills=77;window.ambushSpawnsRemaining=17;killcamMode=false;saveGame();');
const legacy=JSON.parse(slot);legacy.ambushSpawnsRemaining=17;slot=JSON.stringify(legacy);
probe('loadGame();');
ok('a legacy sixty-body save restores twenty and banks all other outstanding bodies',
  live()===20&&reserve()===57&&P('nm0AmbushKills')===77);
ok('scripted restore halves the old eight-percent air share to one of twenty',
  P('enemiesList.filter(e=>e.isAmbush&&(e.eType==="AERIAL"||e.eType==="AERIAL_PISTOL")).length')===1);
fresh(2);probe('triggerGateAmbush(3000,false);saveGame();loadGame();');
ok('gate reload preserves its complete quota within the existing six-body restore floor',
  live()===6&&reserve()===144&&P('nm0AmbushKills')===150);
fortOpening();probe('saveGame();loadGame();');
ok('fort reload preserves its complete quota and persistent muster ledger',
  live()===6&&reserve()===144&&P('nm0AmbushKills')===150&&P('outpostFortState(currentBiome).musterLeft')===150);

function forceUnitRoll(value,fort,callback){
  const original=ctx.random;let plain=0;
  ctx.random=(a,b)=>{
    if(a===undefined)return ++plain===(fort?1:2)?value:.5;
    if(Array.isArray(a))return a[0];return b===undefined?a*.5:(a+b)*.5;
  };
  try{callback();}finally{ctx.random=original;}
}
for(const fort of [false,true]){
  if(fort)fortOpening();else{fresh(2);probe('triggerGateAmbush(3000,false);');}
  timers.length=0;let air=0,heavy=0,standard=0;
  const opening=live(),held=reserve();
  for(let i=0;i<100;i++){
    assert.ok(killOne(),'reinforcement quota has an active body');
    assert.equal(timers.length,1,'one kill retains one deferred arrival');
    const arrival=timers.shift();
    forceUnitRoll((i+.5)/100,fort,arrival.fn);
    const type=P('enemiesList[enemiesList.length-1].eType');
    if(type==='AERIAL'||type==='AERIAL_PISTOL')air++;else if(type==='ARMORED')heavy++;else if(type==='ARMORED_STANDARD')standard++;
    assert.equal(live(),opening,'one-for-one reinforcements keep the smaller opening field');
    assert.equal(live()+reserve(),P('nm0AmbushKills'),'a replacement never changes the outstanding quota');
  }
  ok((fort?'fort':'gate')+' reinforcement air is five of a hundred, with ten heavies and 85 regulars',air===5&&heavy===10&&standard===85);
  ok((fort?'fort':'gate')+' halved air consumes exactly the same reserve budget',reserve()===held-100&&P('nm0AmbushKills')===50);
}

console.log(`\n${checks}/${checks} NM-0 batch and reserve checks passed`);

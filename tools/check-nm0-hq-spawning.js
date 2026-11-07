// NM-0 HQ is a closed encounter: its twenty armored guards are the entire
// roster. Exercise startup, ambient maintenance and real delayed kill refills.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness.js');
const P = source => probe('(' + source + ')');
let checks = 0, seed = 81720;
const pending = [];
const ok = (name, condition) => { assert.ok(condition, name); checks++; };
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  return b === undefined ? r * a : a + (b - a) * r;
};
ctx.setTimeout = callback => { pending.push(callback); return pending.length; };
function flush() { for (const callback of pending.splice(0)) callback(); }
function fresh() {
  probe(`resetRunState(); resetStoryProgress(); isStoryMode = true;
    totalKills = 999; startAtLevel(8);
    started = doTick = true; isPaused = isDead = isWin = killcamMode = false;
    inStoryIntro = inStoryRoom = inDarchonCall = false;
    leftStick = {active:false, dx:0, dy:0, base:{x:80, y:640}};
    rightStick = {active:false, dx:0, dy:0, dist:0, base:{x:1120, y:690}};`);
  pending.length = 0;
}
function maintain(times = 240) {
  probe(`for (let i = 0; i < ${times}; i++) {
    frameCount = (Math.floor(frameCount / 45) + 1) * 45; maintainHostiles();
  }`);
}

fresh();
ok('HQ arrival resets its local kill counter', P('totalKills') === 0);
ok('HQ has its original twenty-kill target', P('MAX_KILLS') === 20);
ok('HQ starts with exactly twenty enemies', P('enemiesList.length') === 20);
ok('every HQ enemy is an armored standard guard with a pistol',
  P('enemiesList.every(e => e.eType === "ARMORED_STANDARD" && e.currentWeapon === WEAPONS.PISTOL && !e.isFriendly)'));
ok('HQ remains a closed map without a chunk streamer', P('!BIOME_ACTIVE && chunkMgr === null'));
ok('HQ secret room starts locked', !P('window.nm0HqCleared'));
maintain();
ok('three minutes of ambient maintenance add no HQ enemies', P('enemiesList.length') === 20);
probe('for (let i = 0; i < 100; i++) { spawnSingleEnemy(); spawnSingleEnemy(true); }');
ok('direct and seed spawn requests cannot extend the HQ roster', P('enemiesList.length') === 20);

// Real cleanup schedules a delayed replacement while totalKills < MAX_KILLS.
// That callback must honor the current closed encounter just like maintenance.
probe('enemiesList[0].hp = 0; doTick = false; updateEntities();');
ok('the first defeated guard drains the roster and counts one kill',
  P('enemiesList.length === 19 && totalKills === 1'));
ok('the real kill cleanup exercised a delayed spawn callback', pending.includes(ctx.spawnSingleEnemy));
flush();
probe('doTick = true;');
maintain();
ok('delayed refill and ambient ticks cannot replace a defeated guard', P('enemiesList.length') === 19);
ok('the remaining roster contains no yellow regulars', P('enemiesList.every(e => e.eType === "ARMORED_STANDARD")'));

probe('for (const e of enemiesList) e.hp = 0; doTick = false; updateEntities();');
ok('all twenty guard deaths leave an empty encounter', P('enemiesList.length === 0 && totalKills === 20'));
flush();
probe('doTick = true;');
maintain();
probe('for (let i = 0; i < 20; i++) spawnSingleEnemy();');
ok('a fully cleared HQ stays empty after delayed callbacks and ambient ticks', P('enemiesList.length') === 0);
probe('isPaused = true; frameCount++; draw();');
ok('the existing twenty-kill door check still unlocks the secret room', P('window.nm0HqCleared'));
ok('clearing the HQ does not end or freeze the side encounter', P('!isWin && !killcamMode'));

// A replacement queued outside cannot leak into the HQ after a level change.
fresh();
ctx.setTimeout(ctx.spawnSingleEnemy, 100);
flush();
ok('a pre-existing generic spawn callback also respects HQ arrival', P('enemiesList.length') === 20);

// Neighboring streamed country must keep its normal intake behavior.
probe(`resetRunState(); resetStoryProgress(); isStoryMode = true; startAtLevel(1);
  started = doTick = true; isPaused = isDead = isWin = killcamMode = false;
  enemiesList = []; nm0AmbushActive = false;
  function testFindOpenRoad() {
    for (let radius = 7000; radius < 40000; radius += 900)
      for (let a = 0; a < 12; a++) {
        const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
        if (!inAuthoredSector(x, y, 900) && outerRegionUncached(x, y)) return {x, y};
      }
    return null;
  }
  const road = testFindOpenRoad(); player.x = road.x; player.y = road.y;
  for (let i = 0; i < 20; i++) { frameCount++; spawnSingleEnemy(); }`);
ok('Stick City open-road enemies still spawn', P('enemiesList.length') > 0);
ok('Stick City intake retains its own robot and rookie roster',
  P('enemiesList.every(e => ["ROBOT", "NM0_ROOKIE"].includes(e.eType))'));
console.log(`${checks}/${checks} NM-0 HQ spawning checks passed`);

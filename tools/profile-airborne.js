// Deterministic airborne-combat benchmark, with the real loaded city solids.
// The measured section uses no drawing stubs: it only runs flyer combat.
// An optional Chromium run executes that same section against real p5.
//
// GAME_JS=/tmp/game-before.js node tools/profile-airborne.js
// node tools/profile-airborne.js --browser
// AIR_FRAMES=600 AIR_REPEATS=5 node tools/profile-airborne.js
//
// Timings are observations, never pass/fail assertions. State hashes include
// every frame's movement, stations, timers, shots and RNG state, so comparisons
// with GAME_JS also check that faster logic makes the same combat decisions.
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const frames = Number(process.env.AIR_FRAMES || 240);
const warm = Number(process.env.AIR_WARM || 60);
const repeats = Number(process.env.AIR_REPEATS || 3);
const game = process.env.GAME_JS || path.join(__dirname, '..', 'game.js');

function benchmark(options) {
  let randomState = 90210, mathState = 502817, randomCalls = 0, mathCalls = 0;
  const next = state => (Math.imul(state, 1664525) + 1013904223) >>> 0;
  random = (a, b) => {
    randomState = next(randomState); randomCalls++;
    const n = randomState / 4294967296;
    return a === undefined ? n : Array.isArray(a) ? a[Math.floor(n * a.length)] : b === undefined ? n * a : a + n * (b - a);
  };
  Math.random = () => { mathState = next(mathState); mathCalls++; return mathState / 4294967296; };
  isStoryMode = false; townsData = {}; biomeState = {};
  startAtLevel(1);
  // Add streamed city blocks to the authored starting map. Both benchmark
  // sources regenerate exactly the same solids from the same seed.
  for (let cy = 5; cy < 10; cy++) for (let cx = 5; cx < 10; cx++) chunkMgr.adopt(cx, cy);
  chunkMgr.rebuildWorldArrays();
  const origin = { x: 8000, y: 7600 };
  // Keep the loaded map, reserving a local combat court for reproducible roof
  // and muzzle-corner fixtures, rather than relying on a generator accident.
  const city = JSON.parse(JSON.stringify(buildings.filter(b => Math.abs(b.x - origin.x) > 1600 + (b.w || 0) / 2 || Math.abs(b.y - origin.y) > 1600 + (b.h || 0) / 2)));
  const cars = JSON.parse(JSON.stringify(parkingCars.filter(c => Math.hypot(c.x - origin.x, c.y - origin.y) > 1600)));
  const names = ['airbornePositionOpen', 'airborneClearShot', 'airborneReturnFireClear', 'chooseAirborneStation', 'airborneBuildingBlocks', 'airborneLineHitsRect'];
  const originals = Object.fromEntries(names.map(name => [name, window[name]]));
  let counts = null;
  function fixtures(name, instrument) {
    randomState = 918273; mathState = 271828; randomCalls = mathCalls = 0;
    frameCount = 100; currentLevel = currentBiome = 1;
    buildings = JSON.parse(JSON.stringify(city));
    parkingCars = JSON.parse(JSON.stringify(cars));
    const roof = (x, y, w, h) => buildings.push({ x: origin.x + x, y: origin.y + y, w, h });
    if (name === 'roof-crossing') {
      roof(-150, 0, 520, 390); roof(440, -400, 360, 420); roof(-620, 380, 380, 330);
    } else if (name === 'narrow-lanes') {
      roof(-80, -185, 720, 280); roof(-80, 185, 720, 280);
      roof(490, -170, 200, 260); roof(490, 170, 200, 260);
      parkingCars.push({ x: origin.x - 500, y: origin.y + 105 });
    }
    activeBuildings = buildings.slice(); activeParkingCars = parkingCars.slice();
    invalidateColIndex(); buildColIndex();
    enemiesList = []; bullets = []; grenades = []; particles = []; townCitizens = [];
    player = new Character(origin.x + 360, origin.y, true);
    player.currentWeapon = WEAPONS.DUAL_SMG; player.isMoving = true; player.walkCycle = 0;
    const types = ['AERIAL', 'AERIAL_PISTOL', 'SAUCER', 'SAUCER_RED'];
    const flyers = [];
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI / 8, radius = name === 'open-city' ? 400 : 120 + 30 * (i % 4);
      const e = new Character(origin.x + Math.cos(angle) * radius, origin.y + Math.sin(angle) * radius, false, types[i % 4]);
      e.state = 'CHASE'; e.strafeDir = i % 2 ? 1 : -1;
      e.fireTimer = i * 3; e.burstCooldown = 0; e.burstsFired = 0;
      flyers.push(e); enemiesList.push(e);
    }
    // Other combatants are present as in a loaded firefight. Seed the real
    // bullet pool before starting with no pending rounds; each tick records
    // newly fired rounds and bombs. Ground AI, projectile stepping and canvas
    // rendering are deliberately outside this flight-combat CPU timer.
    for (let i = 0; i < 24; i++) enemiesList.push(new Character(origin.x + 1200 + i * 15, origin.y + 900, false, 'NORMAL'));
    for (let i = 0; i < 40; i++) spawnBullet(player.x, player.y, i * Math.PI / 20, true, 'BODY', WEAPONS.SMG, player);
    bullets.length = 0;
    counts = Object.fromEntries(names.map(n => [n, 0]));
    counts.buildingXReads = counts.carXReads = 0;
    for (const name of names) window[name] = instrument ? function (...args) { counts[name]++; return originals[name].apply(this, args); } : originals[name];
    if (instrument) {
      for (const [array, key] of [[buildings, 'buildingXReads'], [parkingCars, 'carXReads']]) {
        for (const obj of array) {
          let x = obj.x;
          Object.defineProperty(obj, 'x', { configurable: true, enumerable: true, get() { counts[key]++; return x; }, set(v) { x = v; } });
        }
      }
    }
    return flyers;
  }
  let hash = 2166136261;
  const fold = value => {
    const str = JSON.stringify(value);
    for (let n = 0; n < str.length; n++) hash = Math.imul(hash ^ str.charCodeAt(n), 16777619) >>> 0;
  };
  function step(flyers, frame, timed, record) {
    frameCount++;
    player.x = origin.x + 360 + Math.sin(frame / 27) * 75;
    player.y = origin.y + Math.sin(frame / 19) * (record.scene === 'narrow-lanes' ? 26 : 130);
    player.walkCycle += 0.18;
    player.aimAngle = Math.cos(frame / 45);
    for (const e of flyers) { if (e.fireTimer > 0) e.fireTimer--; if (e.reloadTimer > 0) e.reloadTimer--; }
    const before = timed ? __airborneNow() : 0;
    for (const e of flyers) updateAirborneCombat(e, player, 1);
    if (timed) record.samples.push(__airborneNow() - before);
    fold([
      flyers.map(e => [e.eType, e.x, e.y, e.aimAngle, e.moveAngle, e.isMoving, e.walkCycle, e.armDrag, e.fireTimer, e.reloadTimer, e.ammo, e.burstCooldown, e.burstsFired, e.airborneStationTimer, e.airborneTargetX, e.airborneTargetY, e.airborneStation && [e.airborneStation.x, e.airborneStation.y, e.airborneStation.clearLane, e.airborneStation.targetX, e.airborneStation.targetY]]),
      bullets.map(b => [b.x, b.y, b.vx, b.vy, b.a, b.active]),
      grenades.map(g => [g.x, g.y, g.tx, g.ty, g.vx, g.vy, g.timer, g.isSaucer]),
      [randomState, mathState, randomCalls, mathCalls]
    ]);
    record.rounds += bullets.length; record.bombs += grenades.length;
    bullets.length = 0; grenades.length = 0; particles.length = 0;
  }
  const report = [];
  for (const scene of ['open-city', 'roof-crossing', 'narrow-lanes']) {
    const batches = [];
    let expectedHash = null;
    for (let run = 0; run < options.repeats + 1; run++) {
      const instrument = run === options.repeats;
      hash = 2166136261;
      const flyers = fixtures(scene, instrument);
      const record = { scene, samples: [], rounds: 0, bombs: 0 };
      for (let frame = 0; frame < options.warm; frame++) step(flyers, frame, false, record);
      record.rounds = record.bombs = 0;
      counts = Object.fromEntries(Object.keys(counts).map(n => [n, 0]));
      for (let frame = options.warm; frame < options.warm + options.frames; frame++) step(flyers, frame, !instrument, record);
      const stateHash = hash.toString(16).padStart(8, '0');
      if (expectedHash && expectedHash !== stateHash) throw new Error('Non-deterministic airborne fixture: ' + scene);
      expectedHash = stateHash;
      if (!instrument) batches.push(record.samples.reduce((a, b) => a + b, 0) / options.frames);
      else {
        const sorted = batches.slice().sort((a, b) => a - b);
        report.push({ scene, frames: options.frames, warm: options.warm, flyers: flyers.length, buildings: buildings.length, cars: parkingCars.length, millisecondsPerFrame: sorted[Math.floor(sorted.length / 2)], repeatMeans: batches, rounds: record.rounds, bombs: record.bombs, stateHash, operationsPerFrame: Object.fromEntries(Object.entries(counts).map(([n, count]) => [n, count / options.frames])) });
      }
    }
  }
  for (const name of names) window[name] = originals[name];
  return report;
}

(async () => {
  const options = { frames, warm, repeats };
  let report, runtime;
  if (process.argv.includes('--browser')) {
    const deps = process.env.VIS_DEPS || '/workspace/onboarding-newone';
    const { chromium } = require(path.join(deps, 'node_modules/playwright'));
    const browser = await chromium.launch({ executablePath: process.env.VIS_CHROME || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
      await page.setContent('<!doctype html><html><body><script>' +
        'Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>' +
        fs.readFileSync(path.join(deps, 'node_modules/p5/lib/p5.min.js'), 'utf8') + '</script><script>' +
        fs.readFileSync(game, 'utf8') + '</script><script>' +
        'window.preload=function(){};window.setup=function(){createCanvas(1200,800);pixelDensity(1);noLoop();noiseSeed(BIOME_SEED);};window.draw=function(){};window.__airborneNow=()=>performance.now();</script></body></html>');
      await page.waitForSelector('canvas');
      report = await page.evaluate('(' + benchmark.toString() + ')(' + JSON.stringify(options) + ')');
      runtime = 'chromium-real-p5';
    } finally { await browser.close(); }
  } else {
    const { ctx, probe } = require('./harness');
    ctx.__airborneNow = () => performance.now();
    report = probe('(' + benchmark.toString() + ')(' + JSON.stringify(options) + ')');
    runtime = 'node-vm';
  }
  console.log(JSON.stringify({ runtime, source: game, measurement: 'airborne combat CPU; excludes rendering, other AI and projectile stepping', aggregation: 'median of per-run mean milliseconds per frame', report }, null, 2));
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });

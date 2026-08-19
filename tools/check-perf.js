// The invariants the performance work rests on.
//
// Every optimisation in this file's scope was made under one rule: the output
// has to be the SAME output, and where it is arithmetic it has to be the same
// bits. That is not a claim you can make by reading a diff -- a memoised sun
// that goes stale, a repacked cell key that aliases, a reordered filter that
// changes what it lets through, and a pooled object that carries a field from
// its last life all look correct in review and all show up on screen.
//
// So each one is checked against the code it replaced, run side by side on a
// real world. Timings are NOT asserted -- they belong to whatever machine this
// runs on -- except for one deliberately loose budget at the end, which exists
// to catch a regression of a completely different order rather than to measure
// anything.
const { ctx, probe } = require('./harness.js');
const fs = require('fs');
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  ' + x : '')); if (!c) fails++; };
const src = fs.readFileSync(__dirname + '/../game.js', 'utf8');

let seed = 90210;
ctx.random = function (a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  if (b === undefined) return r * a;
  return a + r * (b - a);
};

probe(`isStoryMode = false; townsData = {}; startAtLevel(2); started = true; doTick = true;`);
probe(`leftStick = { active: false, dx: 0, dy: 0, base: { x: 0, y: 0 } };
       rightStick = { active: false, dx: 0, dy: 0, dist: 0, base: { x: 0, y: 0 } };`);
probe(`camX = player.x; camY = player.y; zoom = 1;
       viewLeft = player.x - 700; viewRight = player.x + 700;
       viewTop = player.y - 500; viewBottom = player.y + 500; updateActiveWorld();`);

// ---------------------------------------------------------------------------
console.log('== the sun is memoised, and the memo is the same arithmetic ==');
// The chain worldHour -> sunAltitude -> daylight/sunHeight -> shadowDensity is
// a pure function of the clock, the biome and the rain, and it was recomputed
// at every call site: four trig calls for one shadowDensity(), asked once per
// character for the contact shadow alone. Caching it is only safe if the cached
// value is the value, to the bit, and if it can never be read stale.
{
  const DAY = probe('DAY_MS'), SR = probe('SUNRISE_H'), SP = probe('DAY_SPAN_H');
  let bad = 0, n = 0;
  for (let biome = 1; biome <= 7; biome++) {
    const clim = probe(`BIOMES[${biome}] && BIOMES[${biome}].climate`);
    const base = (clim && clim.cloud !== undefined) ? clim.cloud : 0.35;
    for (const rain of [false, true]) {
      for (let step = 0; step < 240; step++) {
        const t = DAY * step / 240;
        probe(`worldTimeMs = ${t}; currentBiome = ${biome}; isRaining = ${rain};`);
        const got = probe(`[sunAltitude(), daylight(), sunHeight(), goldenHour(),
                            cloudCover(), skyDiffusion(), shadowLengthScale(), shadowDensity()]`);
        // The original expressions, from first principles.
        const a = Math.sin((((t / DAY) * 24 - SR) / SP) * Math.PI);
        const k0 = (a + 0.10) / 0.36, k = k0 < 0 ? 0 : k0 > 1 ? 1 : k0;
        const day = k * k * (3 - 2 * k);
        const hgt = a < 0 ? 0 : a > 1 ? 1 : a;
        const g0 = 1 - Math.abs(a) / 0.34, gold = g0 < 0 ? 0 : g0 > 1 ? 1 : g0;
        const ct = t / DAY;
        let v = base + 0.26 * Math.sin(ct * Math.PI * 2 * 2.0 + biome * 1.7)
                     + 0.14 * Math.sin(ct * Math.PI * 2 * 5.0 + biome * 3.1);
        if (rain) v = Math.max(v, 0.88);
        const cloud = v < 0 ? 0 : v > 1 ? 1 : v;
        const dif = cloud * cloud * (3 - 2 * cloud);
        const want = [a, day, hgt, gold, cloud, dif,
                      (1.55 - 0.62 * hgt) * (1 - 0.25 * dif),
                      day * (0.55 + 0.45 * hgt) * (1 - 0.55 * dif)];
        for (let i = 0; i < want.length; i++) { n++; if (got[i] !== want[i]) bad++; }
      }
    }
  }
  ok('every sun term is bit-identical to the expression it replaced', bad === 0,
     `${n} values, 7 biomes x wet/dry x 240 times of day`);

  // Stale is the whole risk, so each input is nudged on its own.
  const read = (s) => probe(s + '; [sunAltitude(), cloudCover(), shadowDensity()]');
  const A = read('worldTimeMs = 0; currentBiome = 3; isRaining = false');
  const B = read('worldTimeMs = ' + probe('DAY_MS') * 0.31);
  const C = read('currentBiome = 5');
  const D = read('isRaining = true');
  ok('the clock moving invalidates it', A[0] !== B[0]);
  ok('the biome changing invalidates it', B[1] !== C[1]);
  ok('rain starting invalidates it', C[2] !== D[2]);
  // Keyed on the inputs rather than on frameCount, so anything that moves the
  // clock -- a cutscene, a restored save, these tools -- cannot read a stale sun.
  ok('and it is keyed on the inputs, not on the frame counter',
     /worldTimeMs === _skT && currentBiome === _skBiome && isRaining === _skRain/.test(src),
     'no frameCount in the guard');
}
probe(`currentBiome = 2; isRaining = false; worldTimeMs = DAY_MS * 0.45;`);

// ---------------------------------------------------------------------------
console.log('== spatial cells are packed into an integer, and nothing still builds a string ==');
// A string key is two number->string conversions, a concatenation and a string
// hash on every probe, and colNear() is probed by every moving body and every
// bullet step. Packing is only safe if it is a bijection over the range the
// world actually reaches, and if every producer and consumer agrees.
{
  let bad = 0, n = 0;
  const seen = new Map();
  for (let i = -400; i <= 400; i += 7) {
    for (let j = -400; j <= 400; j += 7) {
      const k = probe(`cellKey(${i}, ${j})`);
      n++;
      const tag = i + ':' + j;
      if (seen.has(k) && seen.get(k) !== tag) bad++;
      seen.set(k, tag);
      if (!Number.isInteger(k)) bad++;
    }
  }
  ok('distinct cells get distinct integer keys', bad === 0, `${n} cells, no collision`);
  // Aliasing past the 16-bit field is SAFE rather than merely unlikely, because
  // every consumer distance-tests what it gets back -- but the range still has
  // to cover the world, so it is stated here rather than assumed.
  ok('the range covers the world it has to cover',
     probe('cellKey(32767, -32768)') !== probe('cellKey(-32768, 32767)'),
     '+/- 32768 cells = +/- 4.9M world units at SPATIAL_CELL_SIZE');
  const strKeys = src.match(/\bMath\.floor\([^)]*\)\s*\+\s*","/g) || [];
  ok('no spatial index still concatenates a string key', strKeys.length === 0,
     strKeys.length ? strKeys.join(' | ') : 'all four sites packed');
  ok('and the helper that hands one out goes through the same packing',
     /function getSpatialKey\(x, y\) \{\s*return cellKey\(/.test(src), 'getSpatialKey delegates');
}

// ---------------------------------------------------------------------------
console.log('== the collision index still answers exactly what a full scan does ==');
// check-pathing.js proves this over a streamed world; repeated here because the
// key packing is what would break it, and it would break it silently.
{
  const r = probe(`(function () {
    let bad = 0, n = 0, inside = 0, scanned = 0;
    for (let k = 0; k < 3000; k++) {
      const x = player.x + (Math.random() - 0.5) * 6000;
      const y = player.y + (Math.random() - 0.5) * 6000;
      const near = colNear(x, y);
      scanned += near.length;
      const idx = new Set(near);
      for (const b of activeBuildings) {
        const hw = (b.w || 0) / 2 + 30, hh = (b.h || 0) / 2 + 30;
        if (x > b.x - hw && x < b.x + hw && y > b.y - hh && y < b.y + hh) {
          inside++;
          if (!idx.has(b)) bad++;
        }
      }
      n++;
    }
    return { bad, n, inside, scanned: scanned / n, total: activeBuildings.length };
  })()`);
  ok('the packed index never misses a solid the scan finds', r.bad === 0,
     `${r.n} points over ${r.total} solids, ${r.inside} of them inside something`);
  ok('and it still reads a handful rather than the array',
     r.scanned < r.total / 8, `${r.scanned.toFixed(1)} scanned per query vs ${r.total}`);
}

// ---------------------------------------------------------------------------
console.log('== the reordered sight test answers what the original did ==');
// hasLOS scanned all 374 world solids to keep 1.4 of them, running up to eight
// predicates and a gateIsOpen() CALL on each before the cheap numeric reject.
// Putting the box first only commutes if every predicate is a skip -- so the
// two versions are run side by side rather than argued about.
{
  probe(`function losOld(x1,y1,x2,y2){
    let minX=Math.min(x1,x2)-50,maxX=Math.max(x1,x2)+50;
    let minY=Math.min(y1,y2)-50,maxY=Math.max(y1,y2)+50;
    let relB=[];
    for (let b of buildings){
      if (b.isCropField||b.isMarket||b.isFence) continue;
      if (currentLevel===4&&b.isPalm) continue;
      if (currentLevel===6&&(b.isAlienPlant||b.isEnergyPole)) continue;
      if ((currentLevel===1||currentLevel===2)&&(b.isGrassLot||b.isCar)) continue;
      if (b.isRiver||b.isDeck) continue;
      if (b.isGovFortress&&gateIsOpen(b)) continue;
      if (b.x+b.w/2>minX&&b.x-b.w/2<maxX&&b.y+b.h/2>minY&&b.y-b.h/2<maxY) relB.push(b);
    }
    if (relB.length===0) return true;
    let steps=Math.max(5,Math.floor(dist(x1,y1,x2,y2)/20));
    for (let i=0;i<=steps;i++){
      let tx=lerp(x1,x2,i/steps),ty=lerp(y1,y2,i/steps);
      for (let b of relB){ if (tx>b.x-b.w/2&&tx<b.x+b.w/2&&ty>b.y-b.h/2&&ty<b.y+b.h/2) return false; }
    }
    return true;
  }`);
  const lvlWas = probe('currentLevel');
  let bad = 0, n = 0, blocked = 0;
  for (const lvl of [1, 2, 3, 4, 6]) {
    probe(`currentLevel = ${lvl};`);
    const r = probe(`(function(){
      let bad=0,n=0,blk=0;
      for (let k=0;k<2500;k++){
        const a=Math.random()*6.283, r=20+Math.random()*1400;
        const x1=player.x+(Math.random()-0.5)*2400, y1=player.y+(Math.random()-0.5)*2400;
        const x2=x1+Math.cos(a)*r, y2=y1+Math.sin(a)*r;
        const o=losOld(x1,y1,x2,y2);
        if (!o) blk++;
        if (o!==hasLOS(x1,y1,x2,y2)) bad++;
        n++;
      }
      return [bad,n,blk];
    })()`);
    bad += r[0]; n += r[1]; blocked += r[2];
  }
  probe(`currentLevel = ${lvlWas};`);
  ok('every sight line agrees with the original', bad === 0,
     `${n} lines across 5 levels, ${blocked} of them blocked`);
  ok('and it allocates no list to answer them',
     /const _losRel = \[\]/.test(src) && !/let relB = \[\];/.test(src), 'one shared scratch');
}

// ---------------------------------------------------------------------------
console.log('== particles are pooled, and a recycled one is a new one ==');
// The pool is only safe because init() assigns every field unconditionally. If
// a branch is ever added that does not, a particle will inherit it from its
// previous life -- a smoke puff coming back as a 40-unit spark.
{
  const shape = probe(`(function(){
    particles.length = 0; _particlePool.length = 0;
    emit(0, 0, 1, color(10, 20, 30), "SMOKE");
    const freshKeys = Object.keys(particles[0]).sort().join(",");
    const old = particles[0];
    old.a = 0; updateParticles();
    const pooled = _particlePool.length;
    emit(500, 500, 1, color(200, 100, 50), "FLECK");
    const p = particles[0];
    return { freshKeys, reused: p === old, pooled, keys: Object.keys(p).sort().join(","),
             x: p.x, y: p.y, a: p.a, t: p.t, sz: p.sz, l: p.l,
             col: p.c.levels ? p.c.levels.slice(0,3).join(",") : String(p.c) };
  })()`);
  ok('a dead particle is kept rather than dropped', shape.pooled === 1);
  ok('and the next emit gets that same object back', shape.reused, 'no allocation');
  ok('it has the same fields a fresh one has', shape.keys === shape.freshKeys, shape.keys);
  ok('and none of the old life shows through',
     shape.x === 500 && shape.y === 500 && shape.a === 255 && shape.t === 'FLECK' &&
     shape.sz >= 1.4 && shape.sz <= 3.2 && shape.l >= 6 && shape.l <= 16 && shape.col === '200,100,50',
     `sz ${shape.sz.toFixed(2)}, life ${shape.l.toFixed(1)}, colour ${shape.col}`);

  // The retirement walk stays backwards, because that is the order they are
  // drawn in and reversing it reorders the alpha blending between puffs.
  const order = probe(`(function(){
    particles.length = 0; _particlePool.length = 0;
    for (let i = 0; i < 40; i++) { emit(i, 0, 1, color(1,2,3), "SMOKE"); particles[i].tag = i; }
    for (let i = 0; i < 40; i++) if (i % 3 !== 1) particles[i].a = 0;
    const wanted = particles.filter(p => p.a > 0).map(p => p.tag);
    updateParticles();
    return { got: particles.map(p => p.tag).join(), wanted: wanted.join(), pooled: _particlePool.length };
  })()`);
  ok('the survivors keep their draw order through the compaction',
     order.got === order.wanted, order.got.split(',').length + ' of 40, in order');
  ok('and every one that died was recycled', order.pooled === 27, order.pooled + ' recycled');

  const edges = probe(`(function(){
    particles.length = 0; _particlePool.length = 0;
    for (let i = 0; i < 12; i++) emit(i, 0, 1, color(1,2,3), "SMOKE");
    updateParticles();
    const none = particles.length;
    for (const p of particles) p.a = 0;
    updateParticles();
    return { none, all: particles.length, pool: _particlePool.length };
  })()`);
  ok('a frame where nothing dies leaves the list alone', edges.none === 12, edges.none + ' still live');
  ok('a frame where everything dies empties it', edges.all === 0 && edges.pool === 12);

  const cap = probe(`(function(){
    particles.length = 0; _particlePool.length = 0;
    for (let i = 0; i < PARTICLE_POOL_MAX + 250; i++) emit(i, 0, 1, color(1,2,3), "SMOKE");
    for (const p of particles) p.a = 0;
    updateParticles();
    return _particlePool.length;
  })()`);
  ok('the pool is capped, so it is a pool and not a leak',
     cap === probe('PARTICLE_POOL_MAX'), cap + ' held');

  // The point of the whole thing: a steady firefight allocates nothing.
  const churn = probe(`(function(){
    particles.length = 0; _particlePool.length = 0;
    let made = 0;
    const P = Particle;
    Particle = function () { made++; return new P(...arguments); };
    Particle.prototype = P.prototype;
    const step = () => {
      const C = color(255, 180, 60);
      emit(0, 0, 14, C, "SPARK"); emit(0, 0, 10, C, "GORE");
      emit(0, 0, 8, C, "SMOKE");  emit(0, 0, 12, C, "FLECK");
      updateParticles();
    };
    for (let i = 0; i < 400; i++) step();      // fill the pool
    made = 0;
    for (let i = 0; i < 600; i++) step();      // steady state
    Particle = P;
    return { made, emitted: 600 * 44, live: particles.length };
  })()`);
  // Stated as a share of what was emitted rather than as a flat zero: while the
  // live population is still climbing toward its own equilibrium, more are born
  // each frame than die, so the pool legitimately runs dry once in a while. What
  // matters is that recycling covers essentially all of it -- this was 44 fresh
  // objects EVERY frame before, one per particle emitted.
  ok('and a sustained firefight allocates almost nothing',
     churn.made / churn.emitted < 0.01,
     `${churn.made} objects for ${churn.emitted} particles emitted ` +
     `(${(100 * churn.made / churn.emitted).toFixed(2)}%), ${churn.live} live`);
  probe(`particles.length = 0;`);
}

// ---------------------------------------------------------------------------
console.log('== the per-frame allocations that were removed stay removed ==');
// These are structural, because each one is an absence: nothing fails at
// runtime when a fresh array creeps back into a hot loop, it just costs a
// little more garbage every frame until somebody profiles it again.
{
  ok('the separation pass reuses its two working lists',
     /const _pushActors = \[\], _pushAerials = \[\]/.test(src) &&
     /const actors = _pushActors, aerials = _pushAerials/.test(src), 'no arrays per frame');
  ok('the flyers are collected in the walk that already finds them',
     !/enemiesList\.filter\(e => e && e\.hp > 0 && !e\.dead && \(e\.eType === "AERIAL"/.test(src),
     'the second filter is gone');
  ok('an ally finds its column slot without allocating one',
     !/enemiesList\.filter\(e => e\.isFriendly && !e\.dead\)\.indexOf/.test(src),
     'counted, not filtered');
  ok('a patrol reads one corner instead of building four',
     !/c\[this\.patrolCorner\]/.test(src) &&
     /function patrolCornerX\(b, i\)/.test(src), 'five objects per enemy per frame gone');
  ok('particles are only ever constructed through the pool',
     (src.match(/new Particle\(/g) || []).length === 1, 'one construction site');
  ok('and they are retired by compaction, not by splicing each one out',
     !/particles\.splice\(i, 1\)/.test(src) && /particles\.copyWithin\(0, w\)/.test(src),
     'one memmove per frame');
  ok('the dead spatial grid the collision pass never read is gone',
     !/spatialGrid\[neighborKey\]/.test(src), 'no second index built per frame');
}

// ---------------------------------------------------------------------------
console.log('== distances that are only ever compared are not rooted ==');
// Every one of these is a threshold test whose result nothing reads, so the
// root was pure waste -- and p5's dist() is Math.hypot, which guards against an
// overflow this game never reaches at about 3.7x the cost of a plain sqrt.
{
  const cmp = probe(`(function(){
    // a < b and a*a < b*b agree for lengths -- asserted rather than assumed,
    // because it is the whole justification for the rewrite.
    let bad = 0;
    for (let k = 0; k < 20000; k++) {
      const ax = (Math.random()-0.5)*8000, ay = (Math.random()-0.5)*8000;
      const bx = (Math.random()-0.5)*8000, by = (Math.random()-0.5)*8000;
      const lim = Math.random() * 4000;
      const dx = ax-bx, dy = ay-by;
      if ((dist(ax,ay,bx,by) < lim) !== (dx*dx+dy*dy < lim*lim)) bad++;
    }
    return bad;
  })()`);
  ok('the squared comparison agrees with the rooted one', cmp === 0, '20000 random pairs');
  ok('the AI cull no longer takes a root it does not read',
     /cdx \* cdx \+ cdy \* cdy < cullDist \* cullDist/.test(src), 'once per enemy per frame');
  ok('an ally ranks hostiles by the square', /if \(d2 < cD2\) \{ cD2 = d2; closeE = e; \}/.test(src),
     'same ranking, no roots');
  ok('the body-separation pass roots only the pairs that overlap',
     /if \(dSq < minDist \* minDist && dSq > 0\) \{\s*\n\s*let d = Math\.sqrt\(dSq\);/.test(src),
     'the sqrt is inside the test');
  ok('and so does the flyer pass',
     /if \(d2 < minDist \* minDist && d2 > 0\) \{\s*\n\s*const d = Math\.sqrt\(d2\);/.test(src));
}

// ---------------------------------------------------------------------------
console.log('== and the frame still fits ==');
// Deliberately loose. This is not a benchmark -- the number belongs to whoever
// is running it -- it is a tripwire for a regression of a different order:
// something quadratic creeping back in, or a per-frame rebuild of a structure
// that used to be cached.
{
  probe(`for (let i = enemiesList.length; i < 60; i++) {
      const a = Math.random() * 6.283, r = 120 + Math.random() * 900;
      const e = new Character(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r, false, "NORMAL");
      e.isArmed = true; enemiesList.push(e);
    }
    for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283;
      spawnBullet(player.x + Math.cos(a) * 40, player.y + Math.sin(a) * 40, a, true, "BODY", WEAPONS.SMG, player); }`);
  const FRAME = `frameCount++; updateActiveWorld(); updateEntities(); updateBullets();
                 updateParticles(); updateCorpses(); sceneEmitters(); drawDepthSorted();`;
  for (let i = 0; i < 200; i++) probe(FRAME);
  const F = 600;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < F; i++) probe(FRAME);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / F;
  ok('a busy frame of logic stays well inside the 16.6 ms budget', ms < 8,
     `${ms.toFixed(3)} ms/frame with ${probe('enemiesList.length')} enemies`);
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

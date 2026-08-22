// ---------------------------------------------------------------------------
// THE OVERWORLD FORTRESS
//
// Take a fortress, work the country around it, take the next one. This walks
// the whole loop -- the gate is shut, a charge on the OUTSIDE face breaches it
// and brings the muster out, the door is not a road until the muster is beaten,
// the yellow regulars are behind it, and dropping the two masts inside turns
// them into allies and pays them into the Directive.
//
// Two of the things it asserts fail SILENTLY if they break, which is why they
// are here rather than left to a play-through:
//
//   - the fort's masts are not the sector's masts. buildings.filter(b =>
//     b.isTower) is what decides Stick City's own objective, so two more towers
//     in the world would quietly mean the sector needs four down instead of
//     two -- and nothing would say so until a player wondered why the towers
//     cutscene never fired.
//   - the compound's ground is reserved. The streamer knows nothing about
//     landmarks except through groundReserved(), and a city block built through
//     the middle of a walled compound looks like a bug in the fort rather than
//     in the generator.
//
//   node tools/check-fortress.js
// ---------------------------------------------------------------------------
const { ctx, probe } = require(require('path').join(__dirname, 'harness.js'));
const P = (s) => probe('(' + s + ')');
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; if (!c) { fails++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + x : '')); } };

// legacyStartAtLevel() runs against p5's global RNG; the harness's constant stub
// is fine for chunk hashes and useless for a spawn ladder.
let seed = 20260822;
ctx.random = function (a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  if (b === undefined) return r * a;
  return a + r * (b - a);
};
// The muster is deferred two seconds in game so the breach has a beat of its own.
ctx.setTimeout = (fn) => { fn(); return 0; };

probe('isStoryMode = true; townsData = {}; window.outpostForts = {};');
probe('startAtLevel(1); started = true;');

console.log('== it exists, and it is where it says it is ==');
const F = P('outpostFortDef(1)');
ok('Sector 1 has a fortress', !!F, JSON.stringify(F));
const core = P('authoredCore && {x0:authoredCore.x0,y0:authoredCore.y0,x1:authoredCore.x1,y1:authoredCore.y1}');
const clearOfCore = !core || F.x - 1300 > core.x1 || F.x + 1300 < core.x0 ||
                            F.y - 1100 > core.y1 || F.y + 1100 < core.y0;
ok('it stands clear of the authored core', clearOfCore,
   'fort ' + F.x + ',' + F.y + '  core ' + JSON.stringify(core));
console.log('   at ' + F.x + ',' + F.y + '  "' + F.name + '"   core ' + JSON.stringify(core));

const kinds = P(`buildings.filter(b=>b.isOutpost).map(b=>b.propType||(b.isOutpostGate?'GATE':b.isTower?'TOWER':b.isWall?'WALL':'?'))`);
ok('a gate, three walls and two masts', kinds.filter(k => k === 'GATE').length === 1 &&
   kinds.filter(k => k === 'WALL').length === 3 && kinds.filter(k => k === 'TOWER').length === 2,
   kinds.join(' '));

// It has to survive the thing that replaces buildings[] every time the player
// crosses a chunk edge -- which is what the anchors list is for.
probe('chunkMgr.rebuildWorldArrays();');
ok('it survives a chunk rebuild', P('buildings.filter(b=>b.isOutpost).length') === kinds.length,
   P('buildings.filter(b=>b.isOutpost).length') + ' of ' + kinds.length);

console.log('\n== the ground under it is the fort\'s ==');
{
  let inside = 0, chunks = 0;
  for (let cx = 4; cx <= 7; cx++) for (let cy = 7; cy <= 10; cy++) {
    chunks++;
    const ch = P(`generateChunkContent(1, ${cx}, ${cy})`);
    for (const s of ch.solid) {
      if (Math.abs(s.x - F.x) < 1300 && Math.abs(s.y - F.y) < 1100) inside++;
    }
  }
  ok('the streamer builds nothing inside the compound', inside === 0,
     inside + ' solids in the yard over ' + chunks + ' chunks');
}

console.log('\n== the art fits the gate it is painted on ==');
// This is the bug the first build shipped: every number in the gate art was
// absolute, written against a 9600 x 800 Great Gate -- a 400-unit roundel,
// warning rings at +/-800, extractor fans at +/-1400. On a 2600-wide compound
// wall all of it was wider than the wall, so the roundel covered the whole gate
// and the fans came out as free-floating black boxes in the grass. It reads as
// a gate that has been blown apart, on a gate that is shut and solid, and no
// amount of testing the LOGIC finds it.
//
// So this measures what the art was actually asked to draw. The gate is put at
// the origin, which makes the plant's own local coordinates and the world's the
// same numbers, and every coordinate has to land inside the slab.
{
  // Each primitive is read the way p5 reads it, because a size is not a
  // position: rect(x, y, w, h) reaches x+w, and ellipse(x, y, w, h) reaches
  // x + w/2. Treating every argument as a coordinate flags a wide gate for
  // being wide, which is not the fault being looked for.
  const EXTENT = {
    rect:     (a) => [[a[0], a[0] + a[2]], [a[1], a[1] + a[3]]],
    ellipse:  (a) => [[a[0] - a[2] / 2, a[0] + a[2] / 2], [a[1] - a[3] / 2, a[1] + a[3] / 2]],
    arc:      (a) => [[a[0] - a[2] / 2, a[0] + a[2] / 2], [a[1] - a[3] / 2, a[1] + a[3] / 2]],
    line:     (a) => [[a[0], a[2]], [a[1], a[3]]],
    vertex:   (a) => [[a[0]], [a[1]]],
    triangle: (a) => [[a[0], a[2], a[4]], [a[1], a[3], a[5]]],
    quad:     (a) => [[a[0], a[2], a[4], a[6]], [a[1], a[3], a[5], a[7]]],
    text:     (a) => [[a[1]], [a[2]]]
  };
  const painters = Object.keys(EXTENT);
  const saved = {};
  const measure = (w, h, flags) => {
    let maxX = 0, maxY = 0;
    for (const k of painters) {
      saved[k] = ctx[k];
      ctx[k] = function () {
        const e = EXTENT[k](arguments);
        for (const v of e[0]) if (typeof v === 'number' && isFinite(v) && Math.abs(v) > maxX) maxX = Math.abs(v);
        for (const v of e[1]) if (typeof v === 'number' && isFinite(v) && Math.abs(v) > maxY) maxY = Math.abs(v);
        return saved[k] && saved[k].apply(this, arguments);
      };
    }
    ctx.__gate = Object.assign({ x: 0, y: 0, w: w, h: h, isGovFortress: true,
                                 hp: 1500, maxHp: 1500, hitFlash: 0, details: [] }, flags);
    probe('activeBuildings = [window.__gate]; camX = -width/2/zoom; camY = -height/2/zoom;');
    probe('drawBuildings();');
    for (const k of painters) ctx[k] = saved[k];
    return { x: maxX, y: maxY };
  };
  // A Great Gate: unchanged, and its own plant has always fitted.
  const gg = measure(9600, 800, {});
  ok('a Great Gate paints inside its own slab', gg.x <= 4800 + 80 && gg.y <= 400 + 80,
     'reached ' + (gg.x | 0) + ',' + (gg.y | 0) + ' in a 4800x400 half-slab');
  // The compound wall, which is a quarter the width and half the depth.
  const of = measure(P('FORT_HALF_W') * 2, P('FORT_GATE_H'), { isOutpostGate: true });
  const hw = P('FORT_HALF_W'), hh = P('FORT_GATE_H') / 2;
  ok('and so does the outpost gate', of.x <= hw + 80 && of.y <= hh + 80,
     'reached ' + (of.x | 0) + ',' + (of.y | 0) + ' in a ' + hw + 'x' + (hh | 0) + ' half-slab');
  console.log('   Great Gate reaches ' + (gg.x | 0) + ',' + (gg.y | 0) +
              '   outpost gate reaches ' + (of.x | 0) + ',' + (of.y | 0));
  probe('activeBuildings = buildings;');
}

console.log('\n== blow the door in ==');
ok('a fresh gate is at full health, not blown',
   P('buildings.find(b=>b.isOutpostGate).hp') === P('FORT_GATE_HP'),
   P('buildings.find(b=>b.isOutpostGate).hp') + ' of ' + P('FORT_GATE_HP'));
ok('and the leaf, the stripes and the charge are all on its OUTSIDE face',
   P('gateFaceY(buildings.find(b=>b.isOutpostGate))') >
   P('buildings.find(b=>b.isOutpostGate).y'),
   'face at ' + P('gateFaceY(buildings.find(b=>b.isOutpostGate))') +
   ' vs centre ' + P('buildings.find(b=>b.isOutpostGate).y'));
ok('the gate is shut to begin with', P('gateIsOpen(buildings.find(b=>b.isOutpostGate))') === false);
// The charge goes on the OUTSIDE face. A player standing in the country south
// of it is the only person who can reach this fort.
probe(`player.x = outpostFortDef(1).x; player.y = outpostFortDef(1).y + FORT_HALF_H + 420;
       camX = player.x - width/2/zoom; camY = player.y - height/2/zoom;`);
probe('for (let i=0;i<6;i++) triggerExplosion(player.x, player.y - 380, 320, true, true);');
ok('the breach is written down', P('outpostFortState(1).breached') === true);
ok('the muster comes out', P('nm0AmbushActive') === true &&
   P('enemiesList.filter(e=>e.isAmbush && e.isOutpost).length') > 12,
   P('enemiesList.filter(e=>e.isAmbush && e.isOutpost).length') + ' spawned');
ok('and it musters INSIDE the walls',
   P(`enemiesList.filter(e=>e.isAmbush && e.isOutpost && insideFortYard(1, e.x, e.y, 200)).length`) ===
   P('enemiesList.filter(e=>e.isAmbush && e.isOutpost).length'));
ok('clearing it must not be read as the sector\'s own beat', P('window.ambushKind') === 'GATE',
   String(P('window.ambushKind')));
ok('the door is not a road while the muster stands',
   P('gateIsOpen(buildings.find(b=>b.isOutpostGate))') === false);

probe(`for (const e of enemiesList) if (!e.isFriendly) { e.hp = 0; e.dead = true; }
       enemiesList = enemiesList.filter(e=>e.isFriendly);
       window.ambushSpawnsRemaining = 0; checkAmbushCleared();
       nm0AmbushActive = false; killcamMode = false;`);
ok('and it is one once they are beaten', P('gateIsOpen(buildings.find(b=>b.isOutpostGate))') === true);
// Movement, rounds and sight all have to agree about where the hole is.
ok('the doorway is passable at its centre',
   P(`inOpenGateway(buildings.find(b=>b.isOutpostGate), outpostFortDef(1).x)`) === true);
ok('and the wings either side are not',
   P(`inOpenGateway(buildings.find(b=>b.isOutpostGate), outpostFortDef(1).x + 900)`) === false);

console.log('\n== the garrison ==');
probe(`player.x = outpostFortDef(1).x; player.y = outpostFortDef(1).y + 300;
       frameCount = 30; doTick = true; maintainOutpostGarrison();`);
const g0 = P('enemiesList.filter(e=>e.isOutpostGarrison).length');
ok('yellow regulars muster behind the door', g0 === P('FORT_GARRISON'), g0 + ' placed');
ok('all of them inside the walls',
   P('enemiesList.filter(e=>e.isOutpostGarrison && insideFortYard(1, e.x, e.y, 0)).length') === g0);
ok('none of them standing in geometry',
   P('enemiesList.filter(e=>e.isOutpostGarrison && e.checkCol(e.x,e.y)).length') === 0);
ok('they are hostile, and they are not the sector roster',
   P('enemiesList.filter(e=>e.isOutpostGarrison && !e.isFriendly && !e.isPopulation).length') === g0);

// Kills are permanent; walking away is not. Same promise the sector's roster
// makes, and for the same reason: a headcount cannot tell "spared" from
// "not streamed in right now".
probe(`let k=0; for (const e of enemiesList) if (e.isOutpostGarrison && k<3) { e.hp=0; e.dead=true; processKill(e.x,e.y,false,e.eType,false); k++; }
       enemiesList = enemiesList.filter(e=>!e.dead);
       enemiesList = enemiesList.filter(e=>!e.isOutpostGarrison);
       frameCount = 60; maintainOutpostGarrison();`);
ok('three shot, and three fewer come back', P('enemiesList.filter(e=>e.isOutpostGarrison).length') === g0 - 3,
   P('enemiesList.filter(e=>e.isOutpostGarrison).length') + ' of ' + (g0 - 3));

console.log('\n== the masts are the fort\'s leash, not the sector\'s ==');
const secTowers = P('sectorTowers().length');
ok('the sector still has exactly its own two masts', secTowers === 2, secTowers + ' counted');
ok('and none of them is the fort\'s', P('sectorTowers().filter(b=>b.isOutpost).length') === 0);
ok('the sector\'s objective is untouched by any of this',
   P('!window.towersDefeated') && P('sectorTowers().filter(b=>b.hp>0).length') === 2);

const before = P('sectorPopSum(sectorLedger(POP_POOL))');
probe('for (const b of buildings) if (b.isTower && b.isOutpost) b.hp = 0; checkOutpostCaptured();');
ok('dropping both masts takes the fort', P('outpostFortState(1).captured') === true);
const allies = P('enemiesList.filter(e=>e.isOutpostGarrison && e.isFriendly).length');
ok('the garrison changes sides', allies === g0 - 3, allies + ' of ' + (g0 - 3));
ok('and is paid into the Directive as integers',
   P('sectorPopSum(sectorLedger(POP_POOL))') === before + allies,
   'pool ' + before + ' -> ' + P('sectorPopSum(sectorLedger(POP_POOL))'));
ok('the door stays open once it is theirs',
   P('gateIsOpen(buildings.find(b=>b.isOutpostGate))') === true);
ok('the sector\'s own masts are STILL standing', P('sectorTowers().filter(b=>b.hp>0).length') === 2);

console.log('\n== and the record is what survives ==');
// Everything the player did is a number on the fort. Rebuild the world from it
// and the fort has to come back taken, with its door open and nobody to fight.
probe('const _s = JSON.stringify(window.outpostForts); window.__fs = _s;');
probe('startAtLevel(1);');
ok('a re-entry rebuilds it from the record', P('outpostFortState(1).captured') === true);
ok('its gate comes back down', P('buildings.find(b=>b.isOutpostGate).hp') === 0);
ok('its masts come back down', P('buildings.filter(b=>b.isTower && b.isOutpost).every(b=>b.hp===0)') === true);
probe(`player.x = outpostFortDef(1).x; player.y = outpostFortDef(1).y;
       frameCount = 30; doTick = true; maintainOutpostGarrison();`);
ok('and a captured fort does not re-garrison itself',
   P('enemiesList.filter(e=>e.isOutpostGarrison && !e.isFriendly).length') === 0);

// The save is the only thing that carries it between sessions.
probe('window.__save = null;');
ctx.localStorage = {
  _v: null,
  setItem(k, v) { this._v = v; },
  getItem(k) { return this._v; },
  removeItem() { this._v = null; }
};
probe('saveGame();');
const raw = ctx.localStorage._v;
ok('the fort is written to the save', !!raw && raw.indexOf('outpostForts') !== -1);
probe('window.outpostForts = {};');
probe('loadGame();');
ok('and read back', P('outpostFortState(1).captured') === true &&
   P('outpostFortState(1).garrison') === 0,
   'captured ' + P('outpostFortState(1).captured') + '  garrison ' + P('outpostFortState(1).garrison'));

console.log('\n== and Stick City\'s own arc never touches it ==');
// The state the report was recorded in: the sector is LIBERATED. Its towers are
// down, both Great Gates are breached and its town is established -- and every
// sweep that keeps a breached Great Gate breached matched on isGovFortress
// alone, so entering that Stick City loaded the fort with its door destroyed.
// Drawn blown, still solid, and its own record correctly saying untouched.
probe(`isStoryMode = true; townsData = {}; window.outpostForts = {};
       seedDebugStoryProgress(2);
       window.northGateBreachedStatus = true; window.southGateBreachedStatus = true;
       window.northGateBreached = true; window.nm0AmbushClearedStatus = true;
       townsData[1] = { established: true, towersDown: true };
       window.towersDefeated = true;
       startAtLevel(1);`);
ok('a liberated sector leaves the fort\'s gate at full health',
   P('buildings.find(b=>b.isOutpostGate).hp') === P('FORT_GATE_HP'),
   P('buildings.find(b=>b.isOutpostGate).hp') + ' of ' + P('FORT_GATE_HP'));
ok('and shut', P('gateIsOpen(buildings.find(b=>b.isOutpostGate))') === false);
ok('while its own Great Gates ARE down',
   P('sectorGates().every(b => b.hp <= 0)') === true,
   P('sectorGates().map(b=>b.hp)').join('/'));
// recordSouthGateBreached() is the other sweep, and it runs on the towers
// coming down rather than at entry.
probe('recordSouthGateBreached(1);');
ok('and recording the breach does not take the fort with it',
   P('buildings.find(b=>b.isOutpostGate).hp') === P('FORT_GATE_HP'),
   P('buildings.find(b=>b.isOutpostGate).hp') + ' of ' + P('FORT_GATE_HP'));

console.log('\n' + (fails ? '  ' : '') + (checks - fails) + '/' + checks + ' checks passed');
process.exit(fails ? 1 : 0);

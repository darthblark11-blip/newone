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
// The muster is deferred two seconds in game so the breach has a beat of its
// own, and each reinforcement is deferred a fraction of a second after a kill.
// Both are collected and run on demand, so a fight can be played out a body at
// a time rather than depending on wall-clock timers.
// The compound's own half-depth plus the muster point outside its north gate.
const FORT_WAVE_MAX = 1600;
const _timers = [];
ctx.setTimeout = (fn) => { _timers.push(fn); return _timers.length; };
const flushTimers = () => { let n = 0; while (_timers.length && n++ < 4000) (_timers.shift())(); };
// The breach itself still resolves immediately, the way the old stub did.
probe('void 0;');

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
ok('two gates, two flanks and two masts', kinds.filter(k => k === 'GATE').length === 2 &&
   kinds.filter(k => k === 'WALL').length === 2 && kinds.filter(k => k === 'TOWER').length === 2,
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
  // And the back one, which is the same slab with its outside face on the
  // other side -- the stripes and the leaf mirror, so the extent must not grow.
  const nf = measure(P('FORT_HALF_W') * 2, P('FORT_GATE_H'), { isOutpostGate: true, fortSide: 'N' });
  ok('and so does the NORTH gate', nf.x <= hw + 80 && nf.y <= hh + 80,
     'reached ' + (nf.x | 0) + ',' + (nf.y | 0) + ' in a ' + hw + 'x' + (hh | 0) + ' half-slab');
  console.log('   Great Gate reaches ' + (gg.x | 0) + ',' + (gg.y | 0) +
              '   outpost gate reaches ' + (of.x | 0) + ',' + (of.y | 0));
  probe('activeBuildings = buildings;');
}

console.log('\n== blow the door in ==');
ok('a fresh gate is at full health, not blown',
   P('buildings.find(b=>b.isOutpostGate && !b.fortSide).hp') === P('FORT_GATE_HP'),
   P('buildings.find(b=>b.isOutpostGate && !b.fortSide).hp') + ' of ' + P('FORT_GATE_HP'));
ok('and the leaf, the stripes and the charge are all on its OUTSIDE face',
   P('gateFaceY(buildings.find(b=>b.isOutpostGate && !b.fortSide))') >
   P('buildings.find(b=>b.isOutpostGate && !b.fortSide).y'),
   'face at ' + P('gateFaceY(buildings.find(b=>b.isOutpostGate && !b.fortSide))') +
   ' vs centre ' + P('buildings.find(b=>b.isOutpostGate && !b.fortSide).y'));
ok('the gate is shut to begin with', P('gateIsOpen(buildings.find(b=>b.isOutpostGate && !b.fortSide))') === false);
// The charge goes on the OUTSIDE face. A player standing in the country south
// of it is the only person who can reach this fort.
probe(`player.x = outpostFortDef(1).x; player.y = outpostFortDef(1).y + FORT_HALF_H + 420;
       camX = player.x - width/2/zoom; camY = player.y - height/2/zoom;`);
probe('for (let i=0;i<6;i++) triggerExplosion(player.x, player.y - 380, 320, true, true);');
flushTimers();
ok('the breach is written down', P('outpostFortState(1).breached') === true);
ok('the muster comes out', P('nm0AmbushActive') === true &&
   P('enemiesList.filter(e=>e.isAmbush && e.isOutpost).length') > 12,
   P('enemiesList.filter(e=>e.isAmbush && e.isOutpost).length') + ' spawned');
ok('and it musters INSIDE the walls',
   P(`enemiesList.filter(e=>e.isAmbush && e.isOutpost && insideFortYard(1, e.x, e.y, 200)).length`) ===
   P('enemiesList.filter(e=>e.isAmbush && e.isOutpost).length'));
ok('clearing it must not be read as the sector\'s own beat', P('window.ambushKind') === 'GATE',
   String(P('window.ambushKind')));
// AND IT IS A ROAD IMMEDIATELY. Stick City's gates hold shut until the field
// is clear -- that gate is the way OUT of the sector, and holding it is what
// stops the player walking away from the fight. An overworld fort is the other
// way round: the hole is the way IN, the fight is behind it, and a player who
// has just spent a rocket on the door walks through it.
ok('the door is a road the moment it is blown, muster or no muster',
   P('gateIsOpen(buildings.find(b=>b.isOutpostGate && !b.fortSide))') === true &&
   P('nm0AmbushActive') === true);

probe(`for (const e of enemiesList) if (!e.isFriendly) { e.hp = 0; e.dead = true; }
       enemiesList = enemiesList.filter(e=>e.isFriendly);
       window.ambushSpawnsRemaining = 0; checkAmbushCleared();
       nm0AmbushActive = false; killcamMode = false;`);
ok('and still one once they are beaten', P('gateIsOpen(buildings.find(b=>b.isOutpostGate && !b.fortSide))') === true);
// Movement, rounds and sight all have to agree about where the hole is.
ok('the doorway is passable at its centre',
   P(`inOpenGateway(buildings.find(b=>b.isOutpostGate && !b.fortSide), outpostFortDef(1).x)`) === true);
ok('and the wings either side are not',
   P(`inOpenGateway(buildings.find(b=>b.isOutpostGate && !b.fortSide), outpostFortDef(1).x + 900)`) === false);

console.log('\n== the muster is a fight you can finish ==');
// Three things have to agree or the bar cannot reach zero: the number it asks
// for, the number of bodies that will ever exist, and where those bodies come
// from. The first build had 80 asked against 22 spawned plus 30 reinforcements,
// and the reinforcements spawned at Stick City's south gate five chunks away.
{
  probe(`isStoryMode = true; townsData = {}; window.outpostForts = {};
         startAtLevel(1); started = true; doTick = true;
         window.__spawnLog = [];
         // Both spawners are watched. A fort uses its own -- the shared one
         // reads window.ambushOrigin, which four other beats write -- and a
         // wave arriving through the shared one during a fort muster is
         // precisely the fault: it lands at Stick City's south Great Gate.
         for (const nm of ['spawnAmbushReinforcement', 'spawnFortWave']) {
           const _sr = window[nm];
           window[nm] = function () {
             const n0 = enemiesList.length;
             const r = _sr.apply(this, arguments);
             for (let i = n0; i < enemiesList.length; i++)
               window.__spawnLog.push({ x: enemiesList[i].x, y: enemiesList[i].y, via: nm });
             return r;
           };
         }`);
  // Loose NM-0 already wandering near the fort, which is the state a player in
  // a liberated sector actually finds it in.
  probe(`const _d = outpostFortDef(1);
         for (let i = 0; i < 6; i++)
           enemiesList.push(new Character(_d.x + (i - 3) * 300, _d.y + 1900, false, "NM0_ROOKIE"));`);
  probe(`player.x = outpostFortDef(1).x; player.y = outpostFortDef(1).y + FORT_HALF_H + 420;
         camX = player.x - width/2/zoom; camY = player.y - height/2/zoom;
         viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;`);
  probe('for (let i=0;i<6;i++) triggerExplosion(player.x, player.y - 380, 320, true, true);');
flushTimers();

  ok('the door loses its collision the moment it is blown',
     P('gateIsOpen(buildings.find(b=>b.isOutpostGate && !b.fortSide))') === true &&
     P('inOpenGateway(buildings.find(b=>b.isOutpostGate && !b.fortSide), outpostFortDef(1).x)') === true);
  ok('the loose NM-0 in the area are conscripted into it',
     P('enemiesList.filter(e=>e.isAmbush && e.eType === "NM0_ROOKIE").length') === 6,
     P('enemiesList.filter(e=>e.isAmbush && e.eType === "NM0_ROOKIE").length') + ' of 6');
  const total = P('window.ambushKillsTotal');
  ok('the bar starts full at its own size, not at a fraction of 300',
     P('nm0AmbushKills') === total && total > 0, P('nm0AmbushKills') + ' of ' + total);
  ok('and it asks for exactly the bodies that will exist',
     total === P('enemiesList.filter(e=>e.isAmbush && !e.dead && e.hp>0).length') +
              P('window.ambushSpawnsRemaining'),
     total + ' asked, ' + P('enemiesList.filter(e=>e.isAmbush).length') + ' on the field + ' +
     P('window.ambushSpawnsRemaining') + ' to come');

  // The garrison must not be part of it, or sparing them is impossible.
  probe('player.x = outpostFortDef(1).x; player.y = outpostFortDef(1).y + 300; frameCount = 30; maintainOutpostGarrison();');
  const gar = P('enemiesList.filter(e=>e.isOutpostGarrison).length');
  ok('the yard garrison musters but is not part of the count', gar === P('FORT_GARRISON') &&
     P('enemiesList.filter(e=>e.isOutpostGarrison && e.isAmbush).length') === 0, gar + ' in the yard');

  // Fight it out, one body at a time, letting the reinforcement timers run.
  let rounds = 0, dry = false;
  while (P('nm0AmbushKills') > 0 && rounds < 600) {
    rounds++;
    const hit = P(`(() => { for (const e of enemiesList) {
        if (e.isAmbush && !e.dead && e.hp > 0) { e.hp = 0; e.dead = true;
          processKill(e.x, e.y, false, e.eType, false); return 1; } } return 0; })()`);
    if (!hit) { dry = true; break; }
    probe('enemiesList = enemiesList.filter(e => !e.dead);');
    flushTimers();
  }
  ok('the bar drains to zero, and never runs out of bodies first',
     !dry && P('nm0AmbushKills') <= 0, dry ? ('dry with ' + P('nm0AmbushKills') + ' still asked') : (rounds + ' kills'));
  ok('and every wave went through the fort\'s OWN spawner',
     (P('(window.__spawnLog||[])') || []).every(p => p.via === 'spawnFortWave'),
     (P('(window.__spawnLog||[])') || []).filter(p => p.via !== 'spawnFortWave').length + ' through the shared one');
  ok('every wave came from the FORT, not from the city gate',
     P(`(() => { let m = 0; const d = outpostFortDef(1);
        for (const p of (window.__spawnLog||[])) { const q = Math.hypot(p.x - d.x, p.y - d.y); if (q > m) m = q; }
        return m; })()`) < 1600 && P('(window.__spawnLog||[]).length') === P('FORT_MUSTER_WAVES'),
     P('(window.__spawnLog||[]).length') + ' waves, furthest ' +
     (P(`(() => { let m = 0; const d = outpostFortDef(1);
         for (const p of (window.__spawnLog||[])) { const q = Math.hypot(p.x - d.x, p.y - d.y); if (q > m) m = q; }
         return m | 0; })()`)) + ' units out');
  probe('checkAmbushCleared();');
  ok('and the muster clears with the garrison still standing',
     P('!!window.nm0AmbushCleared') === true &&
     P('enemiesList.filter(e=>e.isOutpostGarrison && !e.dead && e.hp>0).length') === gar);
}

// ---------------------------------------------------------------------------
// THE MUSTER KEEPS BEING A FIGHT
//
// Conscription used to be one shot at breach time, measured from the fort's own
// centre -- and the sector this fort stands in is LIBERATED, so the country
// around it keeps being topped up with rookies and machines for as long as the
// fight lasts. Every one of those arrived untagged, which meant killing it did
// nothing to the bar AND scheduled no reinforcement. Three reports, one fault.
// ---------------------------------------------------------------------------
console.log('\n== the muster keeps being a fight ==');
{
  probe(`isStoryMode = true; townsData = {}; window.outpostForts = {};
         startAtLevel(1); started = true; doTick = true;
         player.x = outpostFortDef(1).x; player.y = outpostFortDef(1).y + FORT_HALF_H + 420;
         camX = player.x - width/2/zoom; camY = player.y - height/2/zoom;
         viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;`);
  probe('for (let i=0;i<6;i++) triggerExplosion(player.x, player.y - 380, 320, true, true);');
  flushTimers();

  const dy = P('Math.round(window.ambushOrigin.y - outpostFortDef(1).y)');
  ok('the waves come in the fort\'s NORTH gate, not out of the hole in the front',
     dy < -P('FORT_HALF_H'), 'origin dy ' + dy + ' vs half-depth ' + P('FORT_HALF_H'));
  ok('and the muster the tick belongs to is written down', P('!!window.ambushFort') === true);

  // A GATE IS SOMETHING YOU COME THROUGH. Put merely at the north END of the
  // yard a wave is a body appearing out of thin air against a blank wall, which
  // is why the compound has a back door at all. The waves have to form up
  // OUTSIDE it and inside its doorway, or half of each one materialises in the
  // slab -- the map constants spread a wave 400 out with 150 of jitter, which
  // is wider than a 600-unit door.
  ok('both gates stand open once the compound is breached',
     P('buildings.filter(b=>b.isOutpostGate).length') === 2 &&
     P('buildings.filter(b=>b.isOutpostGate).every(b=>gateIsOpen(b))') === true);
  probe('for (const e of enemiesList) if (e.isAmbush) { e.dead=true; e.hp=0; } enemiesList = enemiesList.filter(e=>!e.dead);');
  probe('for (let i=0;i<10;i++) spawnFortWave();');
  ok('a wave forms up outside the north gate, in its doorway',
     P(`(() => { const g = buildings.find(b=>b.isOutpostGate && b.fortSide === 'N');
        const a = enemiesList.filter(e=>e.isAmbush && !e.dead);
        return a.length >= 8 && a.every(e => e.y < g.y - g.h/2) &&
               a.every(e => Math.abs(e.x - g.x) < GATE_DOOR_HALF); })()`) === true,
     P(`enemiesList.filter(e=>e.isAmbush && !e.dead).length`) + ' spawned');
  ok('and the doorway it forms up at is passable',
     P(`inOpenGateway(buildings.find(b=>b.isOutpostGate && b.fortSide === 'N'), outpostFortDef(1).x)`) === true);
  // It has to get to the player, or it is a wave that never arrives.
  probe(`(() => { for (let f = 0; f < 1500; f++) { frameCount++;
           for (const e of enemiesList) if (e.updateEnemy) e.updateEnemy(); } })()`);
  const near = P(`Math.round(Math.min.apply(null, enemiesList.filter(e=>e.isAmbush && !e.dead)
                    .map(e => Math.hypot(e.x - player.x, e.y - player.y))))`);
  ok('and it crosses the whole compound and reaches the player', near < 900, near + ' units off');
  probe('for (const e of enemiesList) if (e.isAmbush) { e.dead=true; e.hp=0; } enemiesList = enemiesList.filter(e=>!e.dead);');

  // Bodies that arrive AFTER the door goes in, out in the country -- which is
  // where a player actually meets them.
  probe(`(() => { const d = outpostFortDef(1);
           for (let i = 0; i < 8; i++)
             enemiesList.push(new Character(d.x + (i - 4) * 400, d.y + 2600, false, "NM0_ROOKIE")); })()`);
  const bar0 = P('nm0AmbushKills'), tot0 = P('window.ambushKillsTotal');
  probe('frameCount = FORT_MUSTER_TICK; maintainOutpostMuster();');
  const got = P('enemiesList.filter(e=>e.isAmbush && e.eType==="NM0_ROOKIE" && !e.dead).length');
  ok('a rookie that turns up after the breach is conscripted into the muster', got === 8, got + ' of 8');
  ok('and the arithmetic stays closed -- one more body, one more kill asked for',
     P('nm0AmbushKills') === bar0 + 8 && P('window.ambushKillsTotal') === tot0 + 8,
     (P('nm0AmbushKills') - bar0) + ' on the bar, ' + (P('window.ambushKillsTotal') - tot0) + ' on the total');

  const waves0 = P('window.ambushSpawnsRemaining');
  probe(`(() => { for (const e of enemiesList) if (e.eType === "NM0_ROOKIE" && !e.dead) {
           e.hp = 0; e.dead = true; processKill(e.x, e.y, false, e.eType, false); return; } })()`);
  flushTimers();
  ok('so shooting one drains the bar AND calls the next wave in',
     P('nm0AmbushKills') === bar0 + 7 && P('window.ambushSpawnsRemaining') === waves0 - 1,
     'bar ' + P('nm0AmbushKills') + ', waves ' + P('window.ambushSpawnsRemaining') + ' of ' + waves0);

  // And a wave does not wait on a kill landing: a muster shot to pieces by the
  // fort's own garrison, or walked away from, must still keep coming.
  probe('for (const e of enemiesList) if (e.isAmbush) { e.dead = true; e.hp = 0; } enemiesList = enemiesList.filter(e=>!e.dead);');
  const waves1 = P('window.ambushSpawnsRemaining');
  probe('frameCount = FORT_MUSTER_TICK * 2; maintainOutpostMuster();');
  const arrived = P('enemiesList.filter(e=>e.isAmbush && !e.dead).length');
  ok('an empty field brings the next wave in with no kill at all',
     P('window.ambushSpawnsRemaining') === waves1 - 1 && arrived > 0,
     arrived + ' arrived, ' + P('window.ambushSpawnsRemaining') + ' of ' + waves1 + ' left');
  ok('and it arrives at the north end of the yard',
     P(`enemiesList.filter(e=>e.isAmbush && !e.dead).every(e => e.y < outpostFortDef(1).y)`) === true);

  // THE FAULT THE VIDEO SHOWED. spawnAmbushReinforcement() spawns at
  // window.ambushOrigin and falls back to Stick City's south Great Gate when
  // there is none -- and FOUR other beats write that global. A fort whose waves
  // go through it sends them nine thousand units back to the city, which is
  // what "the waves come out of the beginning fortress" is. The fort spawns its
  // own now, off window.ambushFort, so nothing else can redirect them.
  probe('window.ambushOrigin = null;');
  probe('for (const e of enemiesList) if (e.isAmbush) { e.dead=true; e.hp=0; } enemiesList = enemiesList.filter(e=>!e.dead);');
  probe('frameCount = FORT_MUSTER_TICK * 3; maintainOutpostMuster();');
  const far = P(`(() => { const d = outpostFortDef(1); let m = 0;
      for (const e of enemiesList) if (e.isAmbush && !e.dead) {
        const q = Math.hypot(e.x - d.x, e.y - d.y); if (q > m) m = q; } return Math.round(m); })()`);
  ok('a clobbered ambushOrigin cannot send the fort\'s waves back to the city',
     far > 0 && far < FORT_WAVE_MAX, far + ' units from the fort (the city gate is ~9000)');

  // And a per-kill reinforcement takes the same road.
  probe(`(() => { const d = outpostFortDef(1);
           enemiesList.push(new Character(d.x, d.y + 900, false, "NM0_ROOKIE")); })()`);
  probe('frameCount = FORT_MUSTER_TICK * 4; maintainOutpostMuster();');
  const n0 = P('enemiesList.filter(e=>e.isAmbush && !e.dead).length');
  probe(`(() => { for (const e of enemiesList) if (e.eType === "NM0_ROOKIE" && !e.dead) {
           e.hp = 0; e.dead = true; processKill(e.x, e.y, false, e.eType, false); return; } })()`);
  flushTimers();
  const far2 = P(`(() => { const d = outpostFortDef(1); let m = 0;
      for (const e of enemiesList) if (e.isAmbush && !e.dead) {
        const q = Math.hypot(e.x - d.x, e.y - d.y); if (q > m) m = q; } return Math.round(m); })()`);
  ok('and so does the reinforcement a kill calls in', far2 < FORT_WAVE_MAX,
     far2 + ' units from the fort');

  // A player who has walked back to the city is not fighting the muster, and
  // the city's own wanderers must not be dealt into a battle two kilometres
  // away -- that is what put NM-0 bodies at the Great Gate with the bar up.
  probe(`player.x = 200; player.y = 5000;
         for (let i = 0; i < 5; i++) enemiesList.push(new Character(200 + i * 120, 5100, false, "NM0_ROOKIE"));`);
  probe('frameCount = FORT_MUSTER_TICK * 5; maintainOutpostMuster();');
  ok('and the city\'s own wanderers are not conscripted from two kilometres away',
     P('enemiesList.filter(e=>e.isAmbush && Math.hypot(e.x-200,e.y-5100) < 700).length') === 0,
     P('enemiesList.filter(e=>e.isAmbush && Math.hypot(e.x-200,e.y-5100) < 700).length') + ' dragged in');
  probe(`player.x = outpostFortDef(1).x; player.y = outpostFortDef(1).y + FORT_HALF_H + 420;
         enemiesList = enemiesList.filter(e => Math.hypot(e.x - 200, e.y - 5100) > 700);`);

  // THE TICK ALONE LEAVES A GAP. A body that spawns and dies inside one tick
  // period is never tagged, so killing it drains nothing and calls no wave --
  // the same silence the tick was written to end, just narrower. processKill()
  // conscripts the body it is about to count, so the window closes.
  probe('for (const e of enemiesList) if (e.isAmbush) { e.dead=true; e.hp=0; } enemiesList = enemiesList.filter(e=>!e.dead);');
  probe(`(() => { const d = outpostFortDef(1);
           enemiesList.push(new Character(d.x, d.y + FORT_HALF_H + 700, false, "NM0_ROOKIE")); })()`);
  const tw = P('window.ambushSpawnsRemaining'), tt = P('window.ambushKillsTotal');
  probe(`(() => { for (const e of enemiesList) if (e.eType === "NM0_ROOKIE" && !e.dead) {
           e.hp = 0; e.dead = true; processKill(e.x, e.y, false, e.eType, false); return; } })()`);
  flushTimers();
  ok('a body that arrives and dies between two ticks still counts',
     P('window.ambushKillsTotal') === tt + 1 && P('window.ambushSpawnsRemaining') === tw - 1,
     'total +' + (P('window.ambushKillsTotal') - tt) + ', waves ' + P('window.ambushSpawnsRemaining') + ' of ' + tw);
}

// Stick City's own musters must be untouched by all of that.
console.log('\n== the sector\'s own musters are unchanged ==');
{
  probe(`isStoryMode = true; townsData = {}; window.outpostForts = {};
         startAtLevel(1); nm0AmbushActive = false; window.ambushOrigin = 'sentinel';
         triggerGateAmbush(5400, false);`);
  ok('a Great Gate breach still asks for 150', P('nm0AmbushKills') === 150 &&
     P('window.ambushKillsTotal') === 150 && P('window.ambushSpawnsRemaining') === 100,
     P('nm0AmbushKills') + '/' + P('window.ambushKillsTotal') + '/' + P('window.ambushSpawnsRemaining'));
  ok('and spawns its waves against the map constants, not an origin',
     P('window.ambushOrigin') === null);
}

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
   P('gateIsOpen(buildings.find(b=>b.isOutpostGate && !b.fortSide))') === true);
ok('the sector\'s own masts are STILL standing', P('sectorTowers().filter(b=>b.hp>0).length') === 2);

console.log('\n== and the record is what survives ==');
// Everything the player did is a number on the fort. Rebuild the world from it
// and the fort has to come back taken, with its door open and nobody to fight.
probe('const _s = JSON.stringify(window.outpostForts); window.__fs = _s;');
probe('startAtLevel(1);');
ok('a re-entry rebuilds it from the record', P('outpostFortState(1).captured') === true);
ok('its gate comes back down', P('buildings.find(b=>b.isOutpostGate && !b.fortSide).hp') === 0);
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
   P('buildings.find(b=>b.isOutpostGate && !b.fortSide).hp') === P('FORT_GATE_HP'),
   P('buildings.find(b=>b.isOutpostGate && !b.fortSide).hp') + ' of ' + P('FORT_GATE_HP'));
ok('and shut', P('gateIsOpen(buildings.find(b=>b.isOutpostGate && !b.fortSide))') === false);
ok('while its own Great Gates ARE down',
   P('sectorGates().every(b => b.hp <= 0)') === true,
   P('sectorGates().map(b=>b.hp)').join('/'));
// recordSouthGateBreached() is the other sweep, and it runs on the towers
// coming down rather than at entry.
probe('recordSouthGateBreached(1);');
ok('and recording the breach does not take the fort with it',
   P('buildings.find(b=>b.isOutpostGate && !b.fortSide).hp') === P('FORT_GATE_HP'),
   P('buildings.find(b=>b.isOutpostGate && !b.fortSide).hp') + ' of ' + P('FORT_GATE_HP'));

console.log('\n' + (fails ? '  ' : '') + (checks - fails) + '/' + checks + ' checks passed');
process.exit(fails ? 1 : 0);

// How everything that is not the player gets round what is in its way.
//
// The old behaviour was a wall slide: movement applied per axis, so a runner
// meeting a wall head-on smeared along it, with a second block of code adding
// extra sideways travel on top. A real turn only happened when both axes were
// blocked at once, and it was a blind 45-frame commitment to a heading nobody
// had checked. This asserts the properties that replaced it — turns, escapes,
// no oscillation, nobody inside a wall — and puts a ceiling on what it costs,
// because checkCol() is a linear scan and this runs for every walker.
const { ctx, probe } = require('./harness.js');
const P = (s) => probe('(' + s + ')');
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  ' + x : '')); if (!c) fails++; };

let seed = 24601;
ctx.random = function (a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  if (b === undefined) return r * a;
  return a + r * (b - a);
};

probe(`isStoryMode = false; townsData = {}; startAtLevel(2); started = true; doTick = true;
       viewLeft = -1e6; viewRight = 1e6; viewTop = -1e6; viewBottom = 1e6;
       leftStick = { active: false, dx: 0, dy: 0, base: { x: 0, y: 0 } };
       rightStick = { active: false, dx: 0, dy: 0, dist: 0, base: { x: 0, y: 0 } };`);

// A world with nothing in it but the walls this test puts there.
function stage(walls) {
  probe(`buildings = []; activeParkingCars = []; barrels = []; enemiesList = []; townCitizens = [];
         activeBuildings = ${JSON.stringify(walls)};
         buildings = activeBuildings.slice();
         lastActiveUpdate = frameCount + 1000;
         buildColIndex();`);   // keep updateActiveWorld off it, but index what we set
}
const wall = (x, y, w, h) => ({ x, y, w, h, isBlockBuilding: true });

// Walk an entity at a target the way the AI does — re-aim every frame — and
// report what happened.
function walk(kind, from, to, frames, spd) {
  probe(`window.__e = ${kind === 'citizen'
    ? `new Citizen(${from[0]}, ${from[1]}, "FARMING", "MALE")`
    : `new Character(${from[0]}, ${from[1]}, false, "NORMAL")`};`);
  const path = [];
  let insideWall = 0, calls = 0;
  const realCol = null;
  for (let i = 0; i < frames; i++) {
    ctx.__cc = 0;
    if (kind === 'citizen') {
      probe(`frameCount++; window.__e.walkTo(${to[0]}, ${to[1]}, ${spd});`);
    } else {
      probe(`frameCount++;
             (function () {
               const e = window.__e;
               const a = Math.atan2(${to[1]} - e.y, ${to[0]} - e.x);
               e.attemptMove(Math.cos(a) * ${spd}, Math.sin(a) * ${spd});
             })();`);
    }
    const p = P('({ x: window.__e.x, y: window.__e.y, side: window.__e.avoidSide })');
    // Heading from the step actually taken: attemptMove() does not set
    // moveAngle, and what matters is the direction they went.
    const prev = path.length ? path[path.length - 1] : { x: from[0], y: from[1] };
    p.ang = Math.atan2(p.y - prev.y, p.x - prev.x);
    p.moved = Math.hypot(p.x - prev.x, p.y - prev.y);
    path.push(p);
    const inside = kind === 'citizen'
      ? P('window.__e.citizenBlocked(window.__e.x, window.__e.y)')
      : P('window.__e.checkCol(window.__e.x, window.__e.y)');
    if (inside) insideWall++;
  }
  const last = path[path.length - 1];
  return {
    path, insideWall,
    endDist: Math.hypot(last.x - to[0], last.y - to[1]),
    startDist: Math.hypot(from[0] - to[0], from[1] - to[1]),
    sides: new Set(path.map((p) => p.side)).size
  };
}

console.log('== a wall in the way is something you go round ==');
{
  // A finite wall square across the route. Reaching the far side means the
  // turn actually resolved rather than grinding along the face forever.
  stage([wall(300, 0, 60, 400)]);
  const r = walk('enemy', [0, 0], [700, 0], 500, 3);
  ok('the runner gets past a wall to its target',
     r.endDist < 40, `${Math.round(r.startDist)} units out -> ${Math.round(r.endDist)}`);
  ok('and is never standing inside it', r.insideWall === 0, r.insideWall + ' frames inside');
}

console.log('\n== a pocket is something you back out of ==');
{
  // Three sides, opening away from the target. This is what the old blind
  // 45-frame commitment could not solve: it picked a heading without checking
  // it, walked into the wall for 45 frames, flipped, and walked into the other.
  stage([
    wall(360, 0, 40, 420),      // back of the pocket, between them and the target
    wall(200, -200, 360, 40),   // north wall
    wall(200, 200, 360, 40)     // south wall
  ]);
  const r = walk('enemy', [220, 0], [900, 0], 700, 3);
  // Reaching the mouth is the win. A reactive steerer cannot SOLVE a concave
  // trap whose goal lies beyond the closed end — that wants a real path — but
  // it must not be pinned to the back wall, which is what it was: traced with
  // the offset-first sweep it never left a 40-unit box in 1500 frames.
  const west = Math.min(...r.path.map((p) => p.x));
  ok('the runner finds the way out of a three-sided pocket',
     west < 40, `reached x=${Math.round(west)}, mouth is at x=20`);
  ok('rather than pacing the back wall',
     Math.max(...r.path.map((p) => p.x)) - west > 250,
     `worked a ${Math.round(Math.max(...r.path.map((p) => p.x)) - west)}-unit span`);
  ok('without ever ending a frame inside a wall', r.insideWall === 0);
}

console.log('\n== it turns, it does not smear ==');
{
  // Head-on into a long face. The heading has to leave the intended one by a
  // real angle — a slide keeps pointing at the wall and travels sideways.
  stage([wall(300, 0, 60, 3000)]);
  const r = walk('enemy', [0, 0], [700, 0], 200, 3);
  // Only the frames actually in contact — the run-up is open road and would
  // dilute the measurement to nothing.
  const contact = r.path.filter((p) => p.x > 235);
  const turned = contact.filter((p) => Math.abs(p.ang) > 0.3).length;
  ok('the heading swings well off the blocked one',
     turned > contact.length * 0.8,
     `${turned}/${contact.length} contact frames steered more than 17 degrees off`);
  ok('and they travel along the wall at close to full speed',
     Math.abs(r.path[r.path.length - 1].y) > contact.length * 2.4,
     `${Math.round(Math.abs(r.path[r.path.length - 1].y))} units in ${contact.length} frames`);
}

console.log('\n== no dithering ==');
{
  // A pillar dead ahead is the case that flickers: both sides are equally
  // good, so the choice has to stick.
  stage([wall(300, 0, 120, 120)]);
  const r = walk('enemy', [0, 0], [700, 0], 260, 3);
  ok('one side is picked and kept', r.sides === 1, r.sides + ' different sides chosen');
  ok('and the pillar is cleared', r.endDist < 40, Math.round(r.endDist) + ' from target');
}

console.log('\n== citizens are in the world now ==');
{
  // They used to have no collision at all and walked straight through houses.
  stage([wall(300, 0, 200, 200)]);
  const r = walk('citizen', [0, 0], [700, 0], 1400, 0.8);
  ok('a townsman no longer walks through a house', r.insideWall === 0, r.insideWall + ' frames inside');
  ok('and still gets where he was going', r.endDist < 40, Math.round(r.endDist) + ' from target');
}

console.log('\n== but not through the site they are building ==');
{
  // A hauler has to reach into the lorry and a mason has to stand against the
  // hoarding. What the player put up is not an obstacle to the crew.
  stage([]);
  probe(`buildSites = [{ level: currentLevel, kind: "WAREHOUSE", x: 300, y: 0,
                         w: BLUEPRINTS.WAREHOUSE.w, h: BLUEPRINTS.WAREHOUSE.h,
                         progress: 0.3, done: false }];
         playerStructures = []; republishPlayerStructures();
         activeBuildings = buildings.slice(); lastActiveUpdate = frameCount + 1000; buildColIndex();
         window.__c = new Citizen(300, 0, "ARCHITECTURE", "MALE");`);
  ok('a build site does not block a citizen',
     P('window.__c.citizenBlocked(300, 0)') === false);
  ok('nor does its lorry',
     P('(function(){ const t = buildTruckAt(buildSites[0]); return window.__c.citizenBlocked(t.x, t.y); })()') === false);
  probe(`buildSites[0].done = true; republishPlayerStructures();
         activeBuildings = buildings.slice(); lastActiveUpdate = frameCount + 1000; buildColIndex();`);
  ok('but the finished warehouse does',
     P('window.__c.citizenBlocked(300, 0)') === true);
  probe('buildSites = []; playerStructures = []; republishPlayerStructures();');
}

console.log('\n== what it costs ==');
{
  // checkCol() is a linear scan of activeBuildings and this runs for every
  // walker every frame, so the common cases have a ceiling.
  function probes(walls, from, to, frames) {
    stage(walls);
    probe(`window.__e = new Character(${from[0]}, ${from[1]}, false, "NORMAL");
           window.__n = 0;
           window.__e.__cc = window.__e.checkCol;
           window.__e.checkCol = function (x, y) { window.__n++; return this.__cc(x, y); };`);
    for (let i = 0; i < frames; i++) {
      probe(`frameCount++;
             (function () {
               const e = window.__e;
               const a = Math.atan2(${to[1]} - e.y, ${to[0]} - e.x);
               e.attemptMove(Math.cos(a) * 3, Math.sin(a) * 3);
             })();`);
    }
    return P('window.__n') / frames;
  }
  const clear = probes([], [0, 0], [3000, 0], 120);
  ok('an open road costs four collision tests a frame or fewer', clear <= 4.05, clear.toFixed(2) + ' per frame');
  const along = probes([wall(300, 0, 60, 3000)], [0, 0], [700, 0], 200);
  ok('and walking a long wall stays under seven', along <= 7, along.toFixed(2) + ' per frame');
}

console.log('\n== the player is not steered ==');
{
  // The player's heading is the player's business: they turn by turning.
  stage([wall(300, 0, 60, 3000)]);
  probe('player.x = 0; player.y = 0; player.avoidHold = 0;');
  const before = P('({ x: player.x, y: player.y })');
  for (let i = 0; i < 160; i++) probe('frameCount++; player.attemptMove(3, 0);');
  const after = P('({ x: player.x, y: player.y })');
  ok('walking the player into a wall does not turn them',
     Math.abs(after.y - before.y) < 0.001, `drifted ${(after.y - before.y).toFixed(2)} in y`);
  ok('and they stop at its face', after.x > 200 && after.x < 275, 'x = ' + Math.round(after.x));
}

console.log('\n== the collision index answers exactly what a full scan does ==');
{
  // The index is only safe if it can never MISS. Solids are inserted into every
  // cell they overlap padded by the largest body radius, so a point query needs
  // one cell — this proves that against the brute-force scan it replaced, on a
  // real streamed world rather than a contrived one.
  probe(`buildSites = []; playerStructures = []; buildings = [];
         isStoryMode = false; startAtLevel(2);
         player.x = 0; player.y = 0;
         viewLeft = -2000; viewRight = 2000; viewTop = -2000; viewBottom = 2000;
         lastActiveUpdate = 0; activeBuildings = []; updateActiveWorld();
         window.__e = new Character(0, 0, false, "NORMAL");`);
  const n = P('activeBuildings.length');
  let disagreed = 0, hits = 0, scanned = 0, pts = 0;
  for (let i = 0; i < 3000; i++) {
    const x = -2400 + (i * 977) % 4800, y = -2400 + (i * 1583) % 4800;
    const r = P(`(function () {
      const e = window.__e, x = ${x}, y = ${y};
      const fast = e.checkCol(x, y);
      const g = colGrid, bg = colBig;
      colGrid = null;                       // force the full-scan path
      const slow = e.checkCol(x, y);
      colGrid = g; colBig = bg;
      return { fast: fast, slow: slow, near: colNear(x, y).length };
    })()`);
    pts++; scanned += r.near;
    if (r.fast) hits++;
    if (r.fast !== r.slow) disagreed++;
  }
  ok('every point agrees with the brute-force scan', disagreed === 0,
     `${pts} points over ${n} solids, ${hits} of them inside something`);
  ok('and a query looks at a handful of solids, not all of them',
     scanned / pts < n * 0.1, `${(scanned / pts).toFixed(1)} scanned per query vs ${n} in the array`);
  ok('the world under test was not empty', n > 40 && hits > 40, n + ' solids');
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

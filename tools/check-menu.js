// Where the travel button lives, and — more to the point — where it does not.
//
// Travel ends the level. It used to be a green button drawn on the play screen
// while the overworld was open, with a second invisible hitbox at bottom-centre
// that did the same thing with nothing drawn over it. Both are gone; it is in
// the pause menu beside CONTINUE now, which is the only place a level-ending
// button belongs. This checks the drawing and the taps, because a button that
// draws in the right place and answers taps in the old one is the bug.
const { ctx, probe } = require('./harness.js');
const P = (s) => probe('(' + s + ')');
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  ' + x : '')); if (!c) fails++; };

let seed = 606;
ctx.random = function (a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  if (b === undefined) return r * a;
  return a + r * (b - a);
};

let slot = null;
ctx.localStorage = { getItem: () => slot, setItem: (k, v) => { slot = v; }, removeItem: () => { slot = null; } };

probe(`isStoryMode = false; townsData = {}; startAtLevel(2); started = true; doTick = true;
       viewLeft = -1e6; viewRight = 1e6; viewTop = -1e6; viewBottom = 1e6;
       width = 400; height = 800;
       leftStick = { active: false, dx: 0, dy: 0, base: { x: 0, y: 0 } };
       rightStick = { active: false, dx: 0, dy: 0, dist: 0, base: { x: 0, y: 0 } };
       townsData[currentLevel] = townsData[currentLevel] || {};
       townsData[currentLevel].established = true;
       viewingTownId = currentLevel;`);
const W = P('width'), H = P('height');

// Every string drawn in one frame, with where it landed. The overworld
// readouts and the whole pause menu are drawn inline in draw(), not in
// drawUI(), so the frame is what has to be run.
function labels(setup) {
  const real = ctx.text, seen = [];
  ctx.text = (s, x, y) => { seen.push({ s: String(s), x: x, y: y }); };
  probe(setup);
  try { probe('draw();'); } catch (e) { if (!labels.warned) { console.log('   (draw threw: ' + e.message + ')'); labels.warned = 1; } }
  ctx.text = real;
  return seen;
}

console.log('== the play screen ==');
{
  const seen = labels('isPaused = false; inOverworldView = true; inTravelMenu = false;');
  ok('no TOWN OVERVIEW panel over the world',
     !seen.some((t) => /TOWN OVERVIEW|LOCAL POPULATION|GLOBAL POPULATION/.test(t.s)),
     seen.filter((t) => /OVERVIEW|POPULATION/.test(t.s)).map((t) => t.s).join(' / ') || 'clear');
  ok('and no TRAVEL button on it either',
     !seen.some((t) => /^TRAVEL$/.test(t.s.trim())),
     seen.filter((t) => /TRAVEL/.test(t.s)).map((t) => t.s).join(' / ') || 'clear');
}

console.log('\n== the pause menu ==');
{
  const over = labels('isPaused = true; pauseMenuState = "MAIN"; inOverworldView = true;');
  const trav = over.find((t) => t.s.trim() === 'TRAVEL');
  const cont = over.find((t) => t.s.trim() === 'CONTINUE');
  ok('TRAVEL appears while the overworld is open', !!trav);
  ok('and CONTINUE is still there beside it', !!cont);
  ok('TRAVEL sits to the RIGHT of CONTINUE', trav && cont && trav.x > cont.x,
     trav && cont ? `CONTINUE at x=${Math.round(cont.x)}, TRAVEL at x=${Math.round(trav.x)}` : '');
  ok('on the same row, not stacked under it', trav && cont && Math.abs(trav.y - cont.y) < 1,
     trav && cont ? `y ${Math.round(cont.y)} vs ${Math.round(trav.y)}` : '');
  ok('and both are inside the button column',
     trav && cont && cont.x > W / 2 - 120 && trav.x < W / 2 + 120);

  const closed = labels('isPaused = true; pauseMenuState = "MAIN"; inOverworldView = false;');
  ok('it is not there with the overworld closed',
     !closed.some((t) => t.s.trim() === 'TRAVEL'));
  ok('and CONTINUE takes the whole row again',
     Math.abs(closed.find((t) => t.s.trim() === 'CONTINUE').x - W / 2) < 1);
}

console.log('\n== the taps ==');
function tap(x, y, setup) {
  // The pause menu ignores taps for 300 ms after opening, and the harness's
  // millis() is frozen at 0 — push the stamp back so every tap counts.
  probe(`${setup} window.lastPauseTime = -100000; mouseX = ${x}; mouseY = ${y}; touches = [];`);
  try { probe('touchStarted();'); } catch (e) { return 'threw: ' + e.message; }
  return { travel: P('inTravelMenu'), paused: P('isPaused'), over: P('inOverworldView') };
}
const OPEN = 'isPaused = true; pauseMenuState = "MAIN"; inOverworldView = true; inTravelMenu = false;';
{
  // Right half of the CONTINUE row.
  let r = tap(W / 2 + 60, H / 2 - 190, OPEN);
  ok('the right half opens the travel menu', r.travel === true && r.paused === false && r.over === false,
     JSON.stringify(r));

  // Left half of the same row.
  r = tap(W / 2 - 60, H / 2 - 190, OPEN);
  ok('the left half just unpauses', r.travel === false && r.paused === false && r.over === true,
     JSON.stringify(r));

  // Same row with the overworld shut: the whole row is CONTINUE.
  r = tap(W / 2 + 60, H / 2 - 190,
          'isPaused = true; pauseMenuState = "MAIN"; inOverworldView = false; inTravelMenu = false;');
  ok('with the overworld closed it can never travel', r.travel === false && r.paused === false,
     JSON.stringify(r));
}

console.log('\n== nothing on the play screen still travels ==');
{
  // Sweep the whole unpaused overworld screen. This is the actual complaint:
  // a tap while exploring must not end the level, wherever it lands.
  let fired = null;
  for (let x = 4; x < W && !fired; x += 12) {
    for (let y = 4; y < H && !fired; y += 12) {
      const r = tap(x, y, 'isPaused = false; inOverworldView = true; inTravelMenu = false; inWorldBuildingMenu = false;');
      if (r === undefined || typeof r === 'string') continue;
      if (r.travel === true) fired = `(${x}, ${y})`;
    }
  }
  ok('no tap anywhere on the overworld play screen starts travel', fired === null,
     fired ? 'travelled from ' + fired : `${Math.ceil(W / 12) * Math.ceil(H / 12)} points swept, none`);
}

console.log('\n== the day does not stop for the overworld ==');
{
  // The overworld is the world with a different camera on it, not a menu. Only
  // the screens that genuinely stop play may hold the clock.
  const tick = (setup) => {
    probe(`${setup} clockLastMs = null; worldClockDtMs = 0; updateWorldClock();`);
    // First call only seeds clockLastMs; the second is the one that bills time.
    probe('updateWorldClock();');
    return P('worldClockDtMs');
  };
  ctx.millis = (() => { let t = 0; return () => (t += 16); })();
  ok('the clock runs while exploring the overworld',
     tick('isPaused = false; inOverworldView = true; inWorldBuildingMenu = false; inTravelMenu = false;') > 0,
     tick('isPaused = false; inOverworldView = true; inWorldBuildingMenu = false; inTravelMenu = false;') + ' ms billed');
  ok('and so do the build sites it drives', (() => {
    probe(`buildSites = [{ level: currentLevel, kind: "WAREHOUSE", x: 0, y: 0,
                           w: BLUEPRINTS.WAREHOUSE.w, h: BLUEPRINTS.WAREHOUSE.h,
                           progress: 0, done: false }];
           window.popArchitectureM = 100; window.popArchitectureF = 0; window.archLvl = 1;
           isPaused = false; inOverworldView = true; inWorldBuildingMenu = false; inTravelMenu = false;
           worldClockDtMs = DAY_MS / 4; updateBuildSites();`);
    return P('buildSites[0].progress') > 0.2;
  })(), (P('buildSites[0].progress') * 100).toFixed(0) + '% in a quarter day');
  ok('the pause menu still holds it',
     tick('isPaused = true; inOverworldView = false; inWorldBuildingMenu = false; inTravelMenu = false;') === 0);
  ok('so does the Directive',
     tick('isPaused = false; inOverworldView = false; inWorldBuildingMenu = true; inTravelMenu = false;') === 0);
  ok('and so does the travel menu',
     tick('isPaused = false; inOverworldView = false; inWorldBuildingMenu = false; inTravelMenu = true;') === 0);
  probe('isPaused = false; inOverworldView = false; inWorldBuildingMenu = false; inTravelMenu = false;');
}

console.log('\n== MY BUILDINGS ==');
{
  probe(`buildSites = [
           { level: currentLevel, kind: "WAREHOUSE",  x: player.x + 4000, y: player.y,
             w: BLUEPRINTS.WAREHOUSE.w,  h: BLUEPRINTS.WAREHOUSE.h,  progress: 0.4, done: false, marked: false },
           { level: currentLevel, kind: "LABORATORY", x: player.x - 4000, y: player.y,
             w: BLUEPRINTS.LABORATORY.w, h: BLUEPRINTS.LABORATORY.h, progress: 1, done: true, marked: false },
           { level: currentLevel + 3, kind: "RANGE",  x: 0, y: 0,
             w: BLUEPRINTS.RANGE.w,      h: BLUEPRINTS.RANGE.h,      progress: 0.6, done: false, marked: false }];
         republishPlayerStructures();`);
  const main = labels('isPaused = true; pauseMenuState = "MAIN"; inOverworldView = false;');
  ok('the button is on the main menu', main.some((t) => t.s.trim() === 'MY BUILDINGS'));
  const bld = main.find((t) => t.s.trim() === 'BUILD' || t.s.trim() === 'NO ARCHITECTS');
  const mine = main.find((t) => t.s.trim() === 'MY BUILDINGS');
  ok('sharing a row with BUILD rather than growing the stack',
     bld && mine && Math.abs(bld.y - mine.y) < 1 && mine.x > bld.x);

  const list = labels('pauseMenuState = "BUILDINGS";');
  ok('the list names every structure',
     list.some((t) => t.s === 'WAREHOUSE') && list.some((t) => t.s === 'LABORATORY') &&
     list.some((t) => t.s === 'SHOOTING RANGE'));
  ok('a finished one reads BUILT', list.some((t) => t.s === 'BUILT'));
  ok('and one under construction reads its percentage',
     list.some((t) => t.s === '40%') && list.some((t) => t.s === '60%'),
     list.filter((t) => /%$/.test(t.s)).map((t) => t.s).join(' '));
  ok('a site in another sector says which one',
     list.some((t) => t.s === 'SECTOR ' + (P('currentLevel') + 3)));

  // Tapping row 0 marks it. Rows are sorted: this sector first, unfinished
  // first — so row 0 is the warehouse.
  const row0 = () => P('buildSites.find(s => s.kind === "WAREHOUSE").marked');
  tap(W / 2, H / 2 - 150, 'isPaused = true; pauseMenuState = "BUILDINGS";');
  ok('tapping a row marks it', row0() === true);
  tap(W / 2, H / 2 - 150, 'isPaused = true; pauseMenuState = "BUILDINGS";');
  ok('and tapping again clears it', row0() === false);

  // A structure in another sector cannot be marked from here: the arrow would
  // point at nothing.
  const far = () => P('buildSites.find(s => s.kind === "RANGE").marked');
  tap(W / 2, H / 2 - 170 + 2 * 54 + 20, 'isPaused = true; pauseMenuState = "BUILDINGS";');
  ok('a site in another sector cannot be marked', far() === false);
  ok('BACK returns to the main menu', (() => {
    tap(W / 2, H / 2 + 210, 'isPaused = true; pauseMenuState = "BUILDINGS";');
    return P('pauseMenuState') === 'MAIN';
  })());
}

console.log('\n== the marker arrows ==');
{
  // Same screen-edge arrow the towers use. Orange while building, blue once
  // built, and only for marked sites in this sector.
  const arrows = (setup) => {
    const real = ctx.triangle, real2 = ctx.fill, seen = [];
    let last = null;
    ctx.fill = (...a) => { last = a; };
    ctx.triangle = (x1, y1) => { if (x1 === 12) seen.push(last); };
    probe(setup);
    try { probe('drawUI();'); } catch (e) { /* the arrows are what matter */ }
    ctx.triangle = real; ctx.fill = real2;
    return seen;
  };
  probe(`isPaused = false; pauseMenuState = "MAIN"; isStoryMode = false;
         buildSites.forEach(s => s.marked = false);`);
  ok('an unmarked structure draws no arrow', arrows('').length === 0);

  probe('buildSites.find(s => s.kind === "WAREHOUSE").marked = true;');
  let a = arrows('');
  ok('a marked site under construction draws one', a.length === 1, JSON.stringify(a));
  ok('and it is orange', a.length === 1 && a[0][0] > 200 && a[0][1] > 90 && a[0][1] < 180 && a[0][2] < 90,
     a.length ? `rgb(${a[0].slice(0, 3).join(',')})` : '');

  probe(`buildSites.find(s => s.kind === "WAREHOUSE").marked = false;
         buildSites.find(s => s.kind === "LABORATORY").marked = true;`);
  a = arrows('');
  ok('a marked finished one draws one too', a.length === 1);
  ok('and it is blue', a.length === 1 && a[0][2] > 200 && a[0][0] < 130,
     a.length ? `rgb(${a[0].slice(0, 3).join(',')})` : '');

  probe('buildSites.find(s => s.kind === "RANGE").marked = true;');
  ok('a marked site in another sector is not drawn here', arrows('').length === 1);

  // Standing on it, there is nothing to point at.
  probe(`player.x = buildSites.find(s => s.kind === "LABORATORY").x;
         player.y = buildSites.find(s => s.kind === "LABORATORY").y;`);
  ok('and the arrow goes once you are there', arrows('').length === 0);
}

console.log('\n== the mark survives a reload ==');
{
  probe(`player.x = 0; player.y = 0;
         buildSites.forEach(s => s.marked = false);
         buildSites.find(s => s.kind === "WAREHOUSE").marked = true;
         saveGame(); buildSites = []; loadGame();`);
  ok('a marked structure is still marked',
     P('buildSites.filter(s => s.marked).length') === 1 &&
     P('buildSites.find(s => s.marked).kind') === 'WAREHOUSE',
     P('buildSites.map(s => s.kind + (s.marked ? "*" : "")).join(" ")'));
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

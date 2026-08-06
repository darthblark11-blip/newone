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

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

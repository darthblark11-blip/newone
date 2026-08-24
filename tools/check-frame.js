// ---------------------------------------------------------------------------
// A FRAME THAT FAILS MUST NOT TAKE THE CONTROLS WITH IT.
//
// draw() paints the world, then lights it, then draws the HUD and reads the
// sticks -- in that order. So anything that throws in the lighting pass takes
// the joysticks, the buttons and handleTouches() down with it, and because p5
// simply calls draw() again next frame the game keeps running with the player
// walking in whatever direction the stick was last left in and no way to stop.
// That is the "controls go away and it goes to daytime" report: daytime is the
// ungraded frame, and the controls are gone because draw() never reached them.
//
// The node harness cannot catch this on its own -- it has no canvas, so the
// 2D light rig's gradients and composite modes are stubs. This runs the REAL
// draw(), against real p5, in real headless Chromium, with an error trap on
// window.onerror, over a scene deliberately built to be the worst case: night,
// a large crowd, and every one of them firing.
//
//   node tools/check-frame.js
//
// Deps are the same as tools/visual.js; see its header.
// ---------------------------------------------------------------------------
const fs = require('fs'), path = require('path');
const SP = process.env.VIS_DEPS ||
  '/tmp/claude-0/-home-user-newone/8482112a-c646-5134-bd53-0f1ebb34fae6/scratchpad';
const CHROME = process.env.VIS_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const { chromium } = require(path.join(SP, 'node_modules/playwright'));
const P5 = path.join(SP, 'node_modules/p5/lib/p5.min.js');
const GAME = process.env.GAME_JS || path.join(__dirname, '..', 'game.js');

// A phone, because that is where this happens and because LIGHT_W and the rig's
// buffers are all sized off the canvas.
const W = +(process.env.CF_W || 540), H = +(process.env.CF_H || 1170);
const FRAMES = +(process.env.CF_FRAMES || 240);

const page = `<!doctype html><meta charset=utf8>
<style>html,body{margin:0;background:#111}</style>
<script>
// about:blank has no localStorage, and the game reads it on the title screen
// and in saveGame(). A plain object is enough for a render check.
(function () {
  var mem = {};
  try { window.localStorage.getItem('x'); return; } catch (e) {}
  Object.defineProperty(window, 'localStorage', { value: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
    setItem: function (k, v) { mem[k] = String(v); },
    removeItem: function (k) { delete mem[k]; },
    clear: function () { mem = {}; }
  }, configurable: true });
})();
</script>
<script>${fs.readFileSync(P5, 'utf8')}</script>
<script>${fs.readFileSync(GAME, 'utf8')}</script>
<script>
window.preload = function () {};
window.loadImage = function () { return { width: 1, height: 1 }; };
window.loadSound = function () { return { isLoaded: function(){return false;},
  play: function(){}, stop: function(){}, setVolume: function(){} }; };
window.loadFont = function () { return null; };

window.__log = [];
window.__errs = [];
window.__done = false;
window.__stage = 'boot';
const note = (m) => window.__log.push(m);

window.setup = function () {
  createCanvas(${W}, ${H});
  pixelDensity(1);
  noLoop();                       // we step draw() ourselves, one frame at a time
  randomSeed(7); noiseSeed(typeof BIOME_SEED !== 'undefined' ? BIOME_SEED : 1337);
  try { if (typeof seedWorldClock === 'function') seedWorldClock(); } catch (e) {}
  // The sticks are built inside the game's own touch-setup block, which this
  // harness does not run. draw() reads them on the very first frame.
  leftStick = { active: false, dx: 0, dy: 0, base: { x: 80, y: height - 160 } };
  rightStick = { active: false, dx: 0, dy: 0, dist: 0, base: { x: width - 80, y: height - 110 } };
};

window.__run = function (frames) {
  const rec = (tag, e) => {
    const m = tag + ': ' + (e && e.stack ? e.stack : e);
    if (window.__errs.indexOf(m) === -1) window.__errs.push(m);
  };
  try {
    isStoryMode = true;
    started = true;
    isPaused = false;
    window.showOnScreenControls = true;
    startAtLevel(1);
  } catch (e) { rec('startAtLevel', e); return; }

  // Night, which is the only time the light rig does anything at all.
  worldTimeMs = 20.4 / 24 * DAY_MS;
  if (typeof updateSunVector === 'function') updateSunVector();

  note('level ' + currentLevel + '  BIOME_ACTIVE=' + BIOME_ACTIVE +
       '  enemies=' + enemiesList.length + '  buildings=' + buildings.length);

  // Walk north across the sector while the crowd fires, which is the state the
  // report was recorded in: a lot of bodies on screen, at night, under fire.
  const step = () => {
    // Every hostile in view lets one off, so sceneEmitters() has to select
    // muzzle flashes out of a field far bigger than the budget.
    let flashes = 0;
    for (const e of enemiesList) {
      if (e.hp > 0 && Math.random() < 0.5) { e.muzzleFlash = 3; flashes++; }
    }
    if (player) { player.muzzleFlash = 3; player.y -= 14; }
    return flashes;
  };

  let lastFlash = 0;
  for (let f = 0; f < frames; f++) {
    lastFlash = step();
    // Bodies pile up, which is what puts pressure on the blood banks and the
    // corpse list; and a shot going off is the brightest emitter in the game.
    if (f % 7 === 3) {
      for (let i = enemiesList.length - 1; i >= 0 && i > enemiesList.length - 4; i--) {
        const e = enemiesList[i];
        if (e && e.hp > 0) { try { e.takeDamage(9999, player, Math.random() * 6.283); } catch (err) { rec('takeDamage', err); } }
      }
    }
    if (f % 23 === 11 && typeof triggerExplosion === 'function' && player) {
      try { triggerExplosion(player.x + 120, player.y - 90, true); } catch (err) { rec('triggerExplosion', err); }
    }
    // Half way through, stand the GPU rig down the way its own watchdog does,
    // so the SECOND half of the run is the 2D light pass -- the path the report
    // was actually on, and the one with no try/catch of its own.
    if (f === (frames >> 1) && typeof GLRig !== 'undefined') {
      GLRig.on = false; GLRig.failure = GLRIG_SHED_MSG;
      note('rig stood down at frame ' + f);
    }
    window.__stage = 'frame ' + f;
    try { redraw(); } catch (e) { rec('draw() frame ' + f, e); break; }
  }
  note('rig active at the end: ' + (typeof glRigActive === 'function' ? glRigActive() : '?') +
       '  failure=' + (typeof GLRig !== 'undefined' ? (GLRig.failure || 'none') : '?'));
  note('corpses ' + (typeof corpses !== 'undefined' ? corpses.length : '?') +
       '  enemies ' + enemiesList.length +
       '  player at ' + (player ? (player.x | 0) + ',' + (player.y | 0) : '?'));
  note('flashes on the last frame: ' + lastFlash);
  note('emitters on the last frame: ' +
       (typeof sceneEmitters === 'function' ? sceneEmitters().length : '?'));

  // ---------------------------------------------------------------------
  // AND THE GUARANTEE ITSELF: a lighting pass that throws must cost the
  // frame its GRADING and nothing else. Break the light rig on purpose and
  // assert the joysticks, the input handler and the HUD all still run --
  // and that the canvas transform is back where it started, so the next
  // frame is not drawn through a half-applied camera.
  // ---------------------------------------------------------------------
  window.__guard = { joysticks: 0, touches: 0, hud: 0, faults: 0, depth: null, drift: 0 };
  const realLight = window.drawLightPass, realSticks = window.drawJoysticks;
  const realTouch = window.handleTouches, realUI = window.drawUI;
  const depth0 = (typeof p5 !== 'undefined' && p5.instance && p5.instance._styles)
    ? p5.instance._styles.length : -1;
  window.__guard.depth = depth0;
  if (typeof GLRig !== 'undefined') { GLRig.on = false; GLRig.ok = false; }
  window.drawLightPass = function () { throw new Error('deliberate light-pass failure'); };
  window.drawJoysticks = function () { window.__guard.joysticks++; return realSticks.apply(this, arguments); };
  window.handleTouches = function () { window.__guard.touches++; return realTouch.apply(this, arguments); };
  window.drawUI = function () { window.__guard.hud++; return realUI.apply(this, arguments); };
  try {
    for (let f = 0; f < 12; f++) {
      window.__stage = 'guard frame ' + f;
      // The HUD and the sticks are legitimately hidden when the player is
      // dead, in a cutscene or paused, so put the run in the one state the
      // guarantee is about: alive, playing, on-screen controls up.
      isDead = false; isWin = false; killcamMode = false; isPaused = false;
      inTownCutscene = false; inDarchonCall = false;
      window.showOnScreenControls = true;
      if (player) { player.hp = player.maxHp; player.isDead = false; }
      redraw();
      const d = (typeof p5 !== 'undefined' && p5.instance && p5.instance._styles)
        ? p5.instance._styles.length : -1;
      if (d !== depth0) window.__guard.drift = d - depth0;
    }
  } catch (e) { rec('guarded draw()', e); }
  window.__guard.faults = window.FRAME_FAULT ? window.FRAME_FAULT.n : 0;
  window.drawLightPass = realLight; window.drawJoysticks = realSticks;
  window.handleTouches = realTouch; window.drawUI = realUI;
  window.FRAME_FAULT = null;

  // ---------------------------------------------------------------------
  // AND EVERY AUTHORED BRANCH PUTS THE TRANSFORM BACK.
  //
  // drawBuildings() is a long dispatch over boolean flags, and every branch
  // that opens a push() has to close it before its continue. Miss one and
  // NOTHING THROWS: the leftover camera transform is still in force when the
  // light buffer, the HUD and the joysticks are drawn, so they are painted
  // scaled by zoom and offset by -camX,-camY -- thousands of units off screen.
  // The frame comes out ungraded with no controls on it, which is exactly the
  // "everything bugs out by the stadium" report, and it is invisible to every
  // check that only looks for exceptions.
  //
  // check-depth.js already asserts this for the solids a CITY CHUNK produces.
  // The hand-authored flags never had it, and isArena was leaking one push per
  // frame. This walks every solid the authored maps emit, one at a time, at
  // five camera positions each so the lean lands in every quadrant.
  // ---------------------------------------------------------------------
  const depth = () => (p5.instance && p5.instance._styles) ? p5.instance._styles.length : -1;
  window.__bal = { n: 0, bad: [] };
  for (const lvl of [1, 3]) {
    try { startAtLevel(lvl); } catch (e) { rec('startAtLevel ' + lvl, e); continue; }
    viewLeft = -1e6; viewRight = 1e6; viewTop = -1e6; viewBottom = 1e6;
    worldTimeMs = 22 / 24 * DAY_MS;
    if (typeof updateSunVector === 'function') updateSunVector();
    const all = buildings.slice();
    const saveActive = activeBuildings;
    for (const b of all) {
      const flag = Object.keys(b).find((k) => /^is[A-Z]/.test(k) && b[k] === true) || 'plain';
      for (const c of [[0, 0], [900, 900], [-900, -900], [900, -900], [-900, 900]]) {
        camX = b.x + c[0] - width / 2 / zoom;
        camY = b.y + c[1] - height / 2 / zoom;
        activeBuildings = [b];
        const d0 = depth();
        let err = null;
        try { drawBuildings(); } catch (e) { err = String((e && e.message) || e); }
        const d1 = depth();
        window.__bal.n++;
        if (d1 !== d0 || err) {
          const line = 'level ' + lvl + ' ' + flag + ' drift ' + (d1 - d0) + (err ? ' THROW ' + err : '');
          if (window.__bal.bad.indexOf(line) === -1) window.__bal.bad.push(line);
        }
        while (depth() > d0) pop();
      }
    }
    activeBuildings = saveActive;
  }

  // ---------------------------------------------------------------------
  // THE SPEED CLICKER
  //
  // A +/- that repeats while held cannot be driven from touchStarted() --
  // a finger held still raises no further tap -- so it runs in the draw pass,
  // and that is only reachable through the real draw(). Two things have to
  // hold: a TAP steps by exactly one (the tap handlers must not also step it,
  // or a single press counts twice), and a HOLD repeats.
  // ---------------------------------------------------------------------
  window.__hold = {};
  try {
    const runMenu = (frames, downFor) => {
      for (let f = 0; f < frames; f++) {
        mouseIsPressed = f < downFor;
        window.__stage = 'menu frame ' + f;
        redraw();
      }
      mouseIsPressed = false;
    };
    const openTravel = () => {
      isPaused = true; inTravelMenu = true; travelDirection = 'SOUTH';
      inWorldBuildingMenu = false; inOverworldView = false;
      window.popMilitaryM = 40; window.popMilitaryF = 40;
      window.militaryToBringM = 0; window.militaryToBringF = 0;
      window._holdTimers = {};
      // The male '+' box: width/2 + 110 .. +135, y 270 .. 300.
      mouseX = width / 2 + 122; mouseY = 285;
    };

    openTravel(); runMenu(3, 1);
    window.__hold.tap = window.militaryToBringM;

    openTravel(); runMenu(60, 60);
    window.__hold.held = window.militaryToBringM;

    // The '-' has to come back down the same way, and stop at zero.
    mouseX = width / 2 - 107;
    window._holdTimers = {}; runMenu(60, 60);
    window.__hold.down = window.militaryToBringM;

    // And it must never exceed what the sector actually has.
    openTravel(); window.popMilitaryM = 3;
    runMenu(200, 200);
    window.__hold.capped = window.militaryToBringM;

    isPaused = false; inTravelMenu = false; travelDirection = null;
  } catch (e) { rec('speed clicker', e); }

  window.__done = true;
};
</script>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const pg = await browser.newPage({ viewport: { width: W, height: H } });
  const errs = [];
  pg.on('pageerror', (e) => errs.push('pageerror: ' + (e.stack || e.message)));
  pg.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await pg.setContent(page);
  await pg.waitForFunction('typeof window.__run === "function" && typeof redraw === "function"',
                           null, { timeout: 20000 });
  await pg.evaluate((n) => window.__run(n), FRAMES);

  const out = await pg.evaluate(() => ({
    log: window.__log, errs: window.__errs, done: window.__done, stage: window.__stage,
    guard: window.__guard, bal: window.__bal, hold: window.__hold
  }));
  await browser.close();

  for (const l of out.log) console.log('   ' + l);
  const all = out.errs.concat(errs);
  let fails = 0, checks = 0;
  const ok = (n, c, x) => { checks++; if (!c) { fails++; console.log('  FAIL ' + n + (x !== undefined ? '\n' + x : '')); } };

  ok('draw() completes ' + FRAMES + ' frames of a night firefight without throwing',
     all.length === 0, all.join('\n\n'));
  ok('the run reached the end', out.done === true, 'stopped at ' + out.stage);

  const g = out.guard || {};
  console.log('   guard: joysticks ' + g.joysticks + '  handleTouches ' + g.touches +
              '  drawUI ' + g.hud + '  faults ' + g.faults + '  stack drift ' + g.drift);
  ok('a throwing light pass is caught rather than killing the frame', g.faults >= 12,
     'faults recorded: ' + g.faults);
  ok('the joysticks still draw when the light pass throws', g.joysticks >= 12,
     'drawJoysticks ran ' + g.joysticks + ' times in 12 frames');
  ok('input is still read when the light pass throws', g.touches >= 12,
     'handleTouches ran ' + g.touches + ' times in 12 frames');
  ok('the HUD still draws when the light pass throws', g.hud >= 12,
     'drawUI ran ' + g.hud + ' times in 12 frames');
  ok('the transform is put back after a caught fault', g.drift === 0,
     'push/pop stack drifted by ' + g.drift);

  const bal = out.bal || { n: 0, bad: ['balance sweep never ran'] };
  console.log('   authored solids drawn: ' + bal.n);
  ok('every authored drawBuildings() branch leaves push/pop balanced',
     bal.n > 500 && bal.bad.length === 0, bal.bad.join('\n     ') || ('only ' + bal.n + ' drawn'));

  const h = out.hold || {};
  console.log('   speed clicker: tap ' + h.tap + '  held 60f ' + h.held +
              '  back down ' + h.down + '  capped at ' + h.capped);
  ok('a tap on the escort +/- steps by exactly one', h.tap === 1,
     'a single press moved it by ' + h.tap + ' — both the draw pass and a tap handler are stepping it');
  ok('holding it repeats', h.held > 5, 'held for 60 frames and moved ' + h.held);
  ok('and holding the minus brings it back to zero', h.down === 0, 'left at ' + h.down);
  ok('a hold cannot deploy more soldiers than the sector has', h.capped === 3,
     'brought ' + h.capped + ' of 3 available');

  console.log((fails ? '  ' : '') + (checks - fails) + '/' + checks + ' checks passed');
  process.exit(fails ? 1 : 0);
})();

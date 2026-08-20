// ---------------------------------------------------------------------------
// LOOK AT IT.
//
// tools/ has always been able to prove that the art RUNS. It has never been
// able to say whether it looks like anything, and twice now a change has gone
// out that passed every check in this directory and was obviously wrong the
// moment somebody opened the game -- a boulder with a bare quad hanging off it,
// a fallen trunk drawn as a chain of beads.
//
// This renders the game's own draw functions -- unmodified, against real p5 in
// real Chromium -- into a contact sheet, one cell per prop, so the art can be
// looked at before it ships. It is not a substitute for walking the world; it
// is the thing that catches the class of fault that is embarrassing on sight.
//
//   node tools/visual.js                 # every prop, to tools/out/props.png
//   node tools/visual.js BOULDER FALLEN  # just these
//   node tools/visual.js --clutter       # the micro-props instead
//
// Needs playwright and p5 in the scratchpad; see SETUP below if they are gone.
// ---------------------------------------------------------------------------
const fs = require('fs'), path = require('path');
const SP = process.env.VIS_DEPS ||
  '/tmp/claude-0/-home-user-newone/8482112a-c646-5134-bd53-0f1ebb34fae6/scratchpad';
const CHROME = process.env.VIS_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SETUP = `
  cd ${SP} && npm i playwright p5@1.9.4
  (chromium is pre-installed at ${CHROME})`;

let chromium;
try { chromium = require(path.join(SP, 'node_modules/playwright')).chromium; }
catch (e) { console.error('playwright not found.' + SETUP); process.exit(2); }
const P5 = path.join(SP, 'node_modules/p5/lib/p5.min.js');
if (!fs.existsSync(P5)) { console.error('p5 not found.' + SETUP); process.exit(2); }

const GAME = process.env.GAME_JS || path.join(__dirname, '..', 'game.js');
const OUT  = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const clutterMode = args.includes('--clutter');
// The legacy flags are the OTHER half of the world's art -- the hand-authored
// sectors the streamer never touches -- and they go through drawBuildings()
// rather than drawBiomeProps(), so the sheet needs its own path for them.
const legacyMode = args.includes('--legacy');
const only = args.filter(a => !a.startsWith('--'));

// Cell geometry. Big enough that a 500-unit prop is legible next to a 40-unit
// one, which is exactly the comparison that catches a prop drawn at the wrong
// scale.
const CELL = +(process.env.VIS_CELL || 260), COLS = +(process.env.VIS_COLS || 6), PAD = 8;

// What to draw, and at what footprint. Sizes are the ones the generators
// actually emit -- a prop reviewed at a size the world never produces is a
// prop nobody has reviewed.
const PROPS = [
  ['BOULDER', 110, 95], ['MONOLITH', 52, 44], ['MANGROVE', 130, 120],
  ['BRAKE', 165, 150], ['FALLEN', 280, 82], ['REVETMENT', 46, 380],
  ['SERAC', 130, 115], ['CAIRN', 60, 56], ['MAST', 76, 76],
  ['HIVETOWER', 135, 125], ['SPOREVENT', 78, 74], ['IMPACTOR', 320, 250],
  ['CRYSTALSPIRE', 150, 140], ['PYLON', 88, 88], ['CABIN', 200, 160],
  ['LOGPILE', 96, 44], ['RUINWALL', 180, 20], ['HEDGE', 300, 30],
  ['WATCHTOWER', 96, 96], ['BUNKER', 220, 190], ['WRECK', 96, 54],
  ['SIGNPOST', 26, 26], ['SPOIL', 90, 80], ['FOUNTAIN', 120, 120],
  ['BARGE', 200, 90], ['QUAYCRANE', 90, 90], ['KIOSK', 70, 60],
  ['BUSSTOP', 90, 40], ['SITEHUT', 90, 70], ['MATERIALS', 90, 70],
  ['HOARDING', 300, 16], ['BLASTWALL', 200, 40], ['SANDBAG', 60, 60],
  ['GUARDBOX', 70, 70], ['BOLLARD', 22, 22], ['PLANTER', 60, 40],
  ['BENCH', 60, 24], ['HYDRANT', 20, 20], ['POSTBOX', 24, 24],
  ['CHECKPOINT', 240, 240], ['OUTPOST', 300, 120], ['HELIPAD', 260, 260],
  ['BORDERWALL', 400, 40], ['BRIDGE', 200, 300], ['CANALBRIDGE', 180, 300],
  ['BOARDWALK', 74, 250]
];
// The legacy building flags, at the footprints legacyGenerateMap() emits. Level
// 0 and 8's interior furniture is left out: those are closed rooms with no
// projection and nothing to review.
const LEGACY = [
  ['isBlockBuilding', 160, 220], ['isStreetLight', 16, 16], ['isHouse', 200, 160],
  ['isTower', 120, 120], ['isWall', 120, 40], ['isDumpster', 40, 25],
  ['isCar', 90, 50], ['isMall', 700, 700], ['isCasino', 700, 500],
  ['isTheater', 700, 700], ['isArena', 800, 800], ['isAmusementPark', 800, 800],
  ['isCircus', 800, 800], ['isUBarrier', 300, 200], ['isTerminal', 120, 100],
  ['isWaterTower', 120, 120], ['isWell', 70, 70], ['isFence', 470, 10],
  ['isHayBale', 70, 70], ['isCrateProp', 60, 60], ['isWagonProp', 120, 70],
  ['isCactusProp', 50, 50], ['isRock', 90, 70], ['isPalm', 60, 60],
  ['isBarn', 300, 240], ['isWesternBldg', 220, 180], ['isShanty', 140, 120],
  ['isTrailer', 200, 90], ['isGasStation', 260, 200], ['isMarket', 240, 200],
  ['isLiquorStore', 200, 160], ['isApartment', 260, 300]
];
const CLUTTER = ['PEBBLE','TRASH','PAPER','PUDDLE','WEED','CRACK','GRASS','FLOWER',
  'HEATHER','ASH','TUMBLEWEED','BONE','SAGE','VINE','FERN','LOG','STUMP','MUSHROOM',
  'REED','ICE','DRIFT','SPOREPOD','GLOWMOSS','SHARD','RIPPLE','MANHOLE','CONE',
  'TREE','PINE','SNAG','BAMBOO','ROOT','WIRE','LICHEN','KRUMMHOLZ','HOARFROST',
  'CHITIN','TENDRIL','SLAG','SALTCRUST','GEODE','FULGURITE'];

const list = clutterMode
  ? CLUTTER.filter(t => !only.length || only.includes(t)).map(t => [t, 0, 0])
  : legacyMode
  ? LEGACY.filter(p => !only.length || only.includes(p[0]))
  : PROPS.filter(p => !only.length || only.includes(p[0]));
if (!list.length) { console.error('nothing matched: ' + only.join(' ')); process.exit(2); }

const rows = Math.ceil(list.length / COLS);
const W = COLS * CELL, H = rows * CELL;

const page = `<!doctype html><meta charset=utf8>
<style>html,body{margin:0;background:#20262b}</style>
<script>${fs.readFileSync(P5, 'utf8')}</script>
<script>${fs.readFileSync(GAME, 'utf8')}</script>
<script>
window.__CELLS = ${JSON.stringify(list)};
window.__CELL = ${CELL}; window.__COLS = ${COLS}; window.__CLUT = ${clutterMode};
window.__LEG = ${legacyMode};
window.__done = false;
// game.js has a preload() that loads sprite files this harness does not ship,
// and p5 will not reach setup() until preload resolves -- so the page came up
// with no canvas at all. Both are stubbed before p5 starts.
window.preload = function () {};
window.loadImage = function () { return { width: 1, height: 1 }; };
window.loadSound = function () { return { isLoaded: function () { return false; },
  play: function () {}, stop: function () {}, setVolume: function () {} }; };
window.loadFont  = function () { return null; };
window.loadJSON  = function () { return {}; };
// The game's own setup() builds a whole world. This harness only wants its
// draw functions, so p5 is started with a bare sketch and the globals the
// prop painters read are set by hand.
window.setup = function () {
  createCanvas(${W}, ${H});
  pixelDensity(1);
  noLoop();
  // Midday, clear, so the art is judged at the hour every palette was written
  // for -- and so the sun-driven helpers all return their mid-range values.
  if (typeof seedWorldClock === 'function') seedWorldClock();
  if (typeof worldTimeMs !== 'undefined') worldTimeMs = 13 / 24 * DAY_MS;
  // The legacy flags are Sector 1's, and drawBuildings() takes its mass path
  // only while BIOME_ACTIVE -- which is exactly the state the hybrid sector is
  // in, so this is the level as played rather than a special case for the sheet.
  BIOME_ACTIVE = true;
  currentLevel = window.__LEG ? 1 : 2; currentBiome = currentLevel;
  frameCount = 40;
  zoom = 1;
  // A prop leans away from the middle of the SCREEN, so every cell is drawn
  // with the camera parked on its own centre plus a fixed offset -- otherwise
  // the top-left cell leans hard and the middle one not at all, and the sheet
  // would be comparing lean strength rather than art.
  redraw();
};
window.draw = function () {
  background(96, 116, 74);
  const cells = window.__CELLS, C = window.__CELL, COLS = window.__COLS;
  textAlign(CENTER, TOP); textSize(13);
  for (let i = 0; i < cells.length; i++) {
    const cx = (i % COLS) * C, cy = ((i / COLS) | 0) * C;
    push();
    // Cell background and frame.
    noStroke(); fill(0, 0, 0, 26); rect(cx + 3, cy + 3, C - 6, C - 6, 6);
    stroke(255, 255, 255, 26); noFill(); rect(cx + 3, cy + 3, C - 6, C - 6, 6);
    noStroke(); fill(235); text(cells[i][0], cx + C / 2, cy + 8);
    pop();
    // The prop's own little world: origin at the cell centre, and the view
    // rectangle set so massLean() sees this prop offset the same way in every
    // cell.
    const ox = cx + C / 2, oy = cy + C / 2 + 12;
    viewLeft = -900; viewRight = 900; viewTop = -900; viewBottom = 900;
    // massLean() is a function of where the mass sits IN THE VIEW, so the
    // camera is parked per cell rather than once for the sheet: otherwise the
    // top-left prop leans hard and the middle one not at all, and the sheet
    // compares lean strength instead of art. Every cell gets the same modest
    // offset -- a prop a third of the way up the screen, which is where the
    // player usually sees one.
    // A prop 22% of the way to the edge of the screen, which is where the
    // player is usually looking at one. The first version parked it at 44% and
    // the lean came out roughly twice what the game shows -- so every prop on
    // the sheet looked like it had a slab floating beside it, and two of them
    // got "fixed" for a fault that was the harness's.
    camX = -width / zoom * 0.5;
    camY = -height / zoom * 0.5 - height / zoom * 0.11;
    push();
    translate(ox, oy);
    // Scale a big prop down so it fits its cell, and say by how much.
    const w = cells[i][1] || 60, h = cells[i][2] || 60;
    const fit = Math.min(1, (C - 60) / Math.max(w, h, 1));
    scale(fit);
    if (window.__CLUT) {
      const d = { t: cells[i][0], x: 0, y: 0, s: 2.2, r: 0.7, c: 0.42, k: 0 };
      try { paintClutter(window, d, frameCount); } catch (e) { drawErr(e); }
    } else if (window.__LEG) {
      const b = { x: 0, y: 0, w: w, h: h, details: [], style: 1, tint: 0.42,
                  // col is an ARRAY on these records -- the car branch reads
                  // b.col[0..2] directly, and a p5 colour object made it draw white.
                  angle: 0, hp: 2000, maxHp: 2000, col: [176, 62, 52] };
      b[cells[i][0]] = true;
      const arr = [b];
      activeBuildings = arr; buildings = arr;
      // Shadows first, then the body -- the same order draw() runs them in, and
      // a prop whose shadow is drawn over its own art is a fault worth seeing.
      try { drawBuildingShadows(); drawBuildings(arr, 0, 1); } catch (e) { drawErr(e); }
    } else {
      const b = { x: 0, y: 0, w: w, h: h, isBiomeProp: true, propType: cells[i][0],
                  tint: 0.42, angle: 0.0, isDeck: cells[i][0] === 'BRIDGE' ||
                  cells[i][0] === 'CANALBRIDGE' || cells[i][0] === 'BOARDWALK' };
      const arr = [b];
      activeBuildings = arr; buildings = arr;
      try {
        if (typeof drawBiomeDecks === 'function' && b.isDeck) drawBiomeDecks();
        drawBiomeProps(arr, 0, 1);
      } catch (e) { drawErr(e); }
    }
    pop();
    push(); noStroke(); fill(200, 200, 200, 150); textSize(10);
    text(w + 'x' + h + (fit < 1 ? '  @' + fit.toFixed(2) : ''), ox, cy + C - 20);
    pop();
  }
  window.__done = true;
};
function drawErr(e) {
  push(); noStroke(); fill(220, 60, 60); textAlign(CENTER, CENTER); textSize(11);
  text('THREW', 0, 0); pop();
  (window.__errs = window.__errs || []).push(e.message);
}
</script>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME,
    args: ['--no-sandbox', '--disable-gpu'] });
  const p = await browser.newPage({ viewport: { width: W, height: Math.min(H, 4000) } });
  const bad = [];
  p.on('pageerror', e => bad.push('page: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') bad.push('console: ' + m.text()); });
  await p.setContent(page, { waitUntil: 'load' });
  await p.waitForFunction('window.__done === true', null, { timeout: 30000 })
        .catch(() => bad.push('draw() never completed'));
  const errs = await p.evaluate('window.__errs || []');
  const file = path.join(OUT, (clutterMode ? 'clutter' : 'props') +
                              (only.length ? '-' + only.join('-') : '') + '.png');
  await p.locator('canvas').screenshot({ path: file });
  await browser.close();
  if (errs.length) console.log('  draw threw: ' + Array.from(new Set(errs)).join(' | '));
  if (bad.length)  console.log('  page errors: ' + Array.from(new Set(bad)).slice(0, 4).join(' | '));
  console.log(`${list.length} cells -> ${file}`);
})();

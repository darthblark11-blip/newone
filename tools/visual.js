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
const only = args.filter(a => !a.startsWith('--'));

// Cell geometry. Big enough that a 500-unit prop is legible next to a 40-unit
// one, which is exactly the comparison that catches a prop drawn at the wrong
// scale.
const CELL = 260, COLS = 6, PAD = 8;

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
const CLUTTER = ['PEBBLE','TRASH','PAPER','PUDDLE','WEED','CRACK','GRASS','FLOWER',
  'HEATHER','ASH','TUMBLEWEED','BONE','SAGE','VINE','FERN','LOG','STUMP','MUSHROOM',
  'REED','ICE','DRIFT','SPOREPOD','GLOWMOSS','SHARD','RIPPLE','MANHOLE','CONE',
  'TREE','PINE','SNAG','BAMBOO','ROOT','WIRE','LICHEN','KRUMMHOLZ','HOARFROST',
  'CHITIN','TENDRIL','SLAG','SALTCRUST','GEODE','FULGURITE'];

const list = clutterMode
  ? CLUTTER.filter(t => !only.length || only.includes(t)).map(t => [t, 0, 0])
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
  BIOME_ACTIVE = true; currentLevel = 2; currentBiome = 2;
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
    camX = -width / zoom * 0.5;
    camY = -height / zoom * 0.5 - height / zoom * 0.22;
    push();
    translate(ox, oy);
    // Scale a big prop down so it fits its cell, and say by how much.
    const w = cells[i][1] || 60, h = cells[i][2] || 60;
    const fit = Math.min(1, (C - 60) / Math.max(w, h, 1));
    scale(fit);
    if (window.__CLUT) {
      const d = { t: cells[i][0], x: 0, y: 0, s: 2.2, r: 0.7, c: 0.42, k: 0 };
      try { paintClutter(window, d, frameCount); } catch (e) { drawErr(e); }
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

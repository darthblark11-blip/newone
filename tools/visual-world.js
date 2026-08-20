// ---------------------------------------------------------------------------
// LOOK AT THE WORLD, NOT AT ONE PROP.
//
// tools/visual.js draws a contact sheet of props on a flat background, which is
// the right tool for judging one piece of art and the WRONG tool for finding
// the things players actually complain about: a ring baked into the terrain, a
// deck lying across a road, two props stacked on one another. Those are
// properties of a generated chunk, not of a prop.
//
// This runs the real streamer -- generateChunkContent, bakeChunkTerrain,
// drawTerrain, drawDecor, drawBiomeDecks, the shadow pass and the depth-sorted
// pass -- over a real patch of a real biome, and screenshots it.
//
//   node tools/visual-world.js 4              # biome 4 at the origin
//   node tools/visual-world.js 4 3600 -2400   # ... at that world position
//   node tools/visual-world.js 2 0 0 0.45     # ... at that zoom
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
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const BIOME = +(process.argv[2] || 4);
const WX = +(process.argv[3] || 0), WY = +(process.argv[4] || 0);
const ZOOM = +(process.argv[5] || 0.66);
const W = 900, H = 1400;

const page = `<!doctype html><meta charset=utf8>
<style>html,body{margin:0;background:#111}</style>
<script>${fs.readFileSync(P5, 'utf8')}</script>
<script>${fs.readFileSync(GAME, 'utf8')}</script>
<script>
window.preload = function () {};
window.loadImage = function () { return { width: 1, height: 1 }; };
window.loadSound = function () { return { isLoaded: function(){return false;},
  play: function(){}, stop: function(){}, setVolume: function(){} }; };
window.loadFont = function () { return null; };
window.__done = false; window.__errs = [];
window.setup = function () {
  createCanvas(${W}, ${H});
  pixelDensity(1); noLoop();
  seedWorldClock();
  worldTimeMs = 13 / 24 * DAY_MS;          // midday: the hour the palettes are for
  BIOME_ACTIVE = true;
  currentLevel = ${BIOME}; currentBiome = ${BIOME};
  authoredCore = null; authoredChunks = null; authoredMask = null;
  biomeState = {};
  weather = null;                          // no screen layer; this is about the ground
  // refreshPopulation() wants a player and a budget. Neither is what this tool
  // is looking at, and both drag in half the entity system.
  refreshPopulation = function () {};
  zoom = ${ZOOM};
  camX = ${WX} - width / zoom * 0.5;
  camY = ${WY} - height / zoom * 0.5;
  viewLeft = camX; viewRight = camX + width / zoom;
  viewTop  = camY; viewBottom = camY + height / zoom;
  chunkMgr = new ChunkManager(${BIOME});
  try {
    chunkMgr.update(${WX}, ${WY});
    chunkMgr.warmUp(120);                  // no per-frame bake budget here
    chunkMgr.rebuildWorldArrays();
  } catch (e) { window.__errs.push('stream: ' + e.message); }
  activeBuildings = buildings;
  redraw();
};
window.draw = function () {
  const sky = (BIOMES[${BIOME}] || BIOMES[1]).sky;
  background(sky[0], sky[1], sky[2]);
  push();
  scale(zoom); translate(-camX, -camY);
  const step = (name, fn) => { try { fn(); } catch (e) { window.__errs.push(name + ': ' + e.message); } };
  // The real ground stack, in the real order.
  step('terrain', () => chunkMgr.drawTerrain());
  _depthOn = true;                          // so standing decor queues, as in game
  step('decor',   () => chunkMgr.drawDecor());
  step('decks',   () => drawBiomeDecks());
  step('shadows', () => drawBuildingShadows());
  // No actors, so this draws every visible mass and every queued tree in one
  // sorted pass -- which is exactly what the game does between characters.
  step('sorted',  () => drawDepthSorted());
  pop();
  // A scale bar, because "that oval is huge" needs a number behind it.
  push(); noStroke();
  fill(0, 0, 0, 150); rect(12, height - 44, 240, 32, 4);
  fill(255); textSize(12);
  text('1 chunk = ' + CHUNK_W + 'u', 22, height - 24);
  stroke(255); strokeWeight(2);
  line(120, height - 28, 120 + CHUNK_W * zoom * 0.25, height - 28);
  noStroke(); fill(255);
  text((CHUNK_W * 0.25) + 'u', 124, height - 34);
  pop();
  window.__done = true;
};
</script>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME,
    args: ['--no-sandbox', '--disable-gpu'] });
  const p = await browser.newPage({ viewport: { width: W, height: H } });
  const bad = [];
  p.on('pageerror', e => bad.push('page: ' + e.message));
  await p.setContent(page, { waitUntil: 'load' });
  await p.waitForFunction('window.__done === true', null, { timeout: 60000 })
        .catch(() => bad.push('draw() never completed'));
  const nCanvas = await p.evaluate('document.querySelectorAll("canvas").length');
  if (!nCanvas) {
    console.log('  no canvas: ' + JSON.stringify(await p.evaluate('window.__errs')));
    console.log('  ' + bad.join('\n  '));
    await browser.close(); process.exit(1);
  }
  const errs = await p.evaluate('window.__errs || []');
  const file = path.join(OUT, `world-b${BIOME}-${WX}_${WY}.png`);
  try { await p.locator('#defaultCanvas0').screenshot({ path: file, timeout: 15000 }); }
  catch (e) {
    console.log('  screenshot failed: ' + e.message.split('\n')[0]);
    console.log('  canvases=' + nCanvas + ' done=' + await p.evaluate('window.__done'));
    console.log('  errs=' + JSON.stringify(await p.evaluate('window.__errs')));
    console.log('  page=' + bad.slice(0,3).join(' | '));
    await p.screenshot({ path: file });
  }
  await browser.close();
  if (errs.length) console.log('  ' + Array.from(new Set(errs)).join('\n  '));
  if (bad.length)  console.log('  ' + Array.from(new Set(bad)).slice(0, 3).join('\n  '));
  console.log('-> ' + file);
})();

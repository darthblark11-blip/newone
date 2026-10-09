// Real Canvas regression: woodland washes must cross chunk texture borders.
// VIS_DEPS/VIS_CHROME/VIS_P5 override the external browser dependencies.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const deps = process.env.VIS_DEPS || '/workspace/onboarding-newone';
const { chromium } = require(path.join(deps, 'node_modules/playwright'));
const p5 = process.env.VIS_P5 || path.join(deps, 'node_modules/p5/lib/p5.min.js');
const game = process.env.GAME_JS || path.join(__dirname, '..', 'game.js');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.VIS_CHROME || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox']
  });
  try {
    const page = await browser.newPage();
    const faults = [];
    page.on('pageerror', error => faults.push(error.message));
    await page.setContent('<script>' + fs.readFileSync(p5, 'utf8') + '</script><script>' +
      fs.readFileSync(game, 'utf8') + '</script><script>' +
      'window.preload=function(){};window.setup=function(){createCanvas(10,10);' +
      'pixelDensity(1);noLoop();noiseSeed(BIOME_SEED);authoredCore=null;' +
      'authoredChunks=null;authoredMask=null;biomeState={};window.__done=true;};' +
      'window.draw=function(){};</script>');
    await page.waitForFunction(() => window.__done);
    const results = await page.evaluate(() => {
      const sink = WOODLAND_PATCH_SINK;
      const scenes = [[0, -4], [6, -5], [-2, 9], [20, -28], [0, 4]];
      // Recorded from the pre-seam woodland recipe, with real p5 noise. The
      // numbers after the wash pass determine every subsequent ground detail.
      const continuation = [
        [0.649516316363588, 0.6403247222770005],
        [0.6122028273530304, 0.02343723294325173],
        [0.22817827365361154, 0.7556802607141435],
        [0.02738531050272286, 0.5562940537929535],
        [0.11278853798285127, 0.33398875454440713]
      ];
      const size = CHUNK_TEX, ratio = size / CHUNK_W;
      const prepare = (w, h, ox, oy) => {
        const g = createGraphics(w, h); g.pixelDensity(1);
        g.background(74, 111, 63); g.noStroke();
        g.scale(ratio); g.translate(-ox, -oy);
        return g;
      };
      const read = g => g.drawingContext.getImageData(0, 0, g.width, g.height).data;
      return scenes.map(([cx, cy], scene) => {
        const ox = cx * CHUNK_W, oy = cy * CHUNK_W;
        const reference = prepare(size * 2, size * 2, ox, oy);
        // One continuous canvas has no clipping boundary at the centre. It
        // paints all world features in their canonical seed order.
        for (let x = cx - 1; x <= cx + 2; x++) for (let y = cy - 1; y <= cy + 2; y++) {
          if (layoutFor(2, x, y) !== 'WOODLAND') continue;
          woodlandGroundPatches(null, 2, x * CHUNK_W, y * CHUNK_W,
            makeRng(chunkHash(2, x, y, 7)), WOOD_PAL,
            (...args) => softStamp(reference, ...args));
        }
        const expected = read(reference);
        const tiles = [[0, 0], [1, 0], [0, 1], [1, 1]];
        let maxDifference = 0, sharedError = 0, oldError = 0, samples = 0;
        let next = null;
        for (const [dx, dy] of tiles) {
          const x = cx + dx, y = cy + dy;
          const g = prepare(size, size, x * CHUNK_W, y * CHUNK_W);
          const local = prepare(size, size, x * CHUNK_W, y * CHUNK_W);
          // Suppress owner-only tiny rock plates/glints to isolate the broad
          // wash system. softStamp uses the real transformed Canvas context.
          const broadTarget = Object.assign({drawingContext: g.drawingContext}, sink);
          const rng = makeRng(chunkHash(2, x, y, 7));
          bakeSharedWoodlandPatches(broadTarget, 2, x, y, rng, WOOD_PAL);
          if (!dx && !dy) next = [rng(), rng()];
          woodlandGroundPatches(null, 2, x * CHUNK_W, y * CHUNK_W,
            makeRng(chunkHash(2, x, y, 7)), WOOD_PAL,
            (...args) => softStamp(local, ...args));
          const actual = read(g), old = read(local);
          for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
            // Check both sides of the horizontal/vertical internal seam,
            // including their intersection, rather than just mean edge tones.
            if (Math.abs(dx * size + px - size) > 16 &&
                Math.abs(dy * size + py - size) > 16) continue;
            const a = 4 * (py * size + px);
            const b = 4 * ((dy * size + py) * size * 2 + dx * size + px);
            for (let channel = 0; channel < 3; channel++) {
              const difference = Math.abs(actual[a + channel] - expected[b + channel]);
              maxDifference = Math.max(maxDifference, difference);
              sharedError += difference;
              oldError += Math.abs(old[a + channel] - expected[b + channel]);
              samples++;
            }
          }
          g.remove(); local.remove();
        }
        reference.remove();
        return {cx, cy, next, continuation: continuation[scene], maxDifference,
          sharedError: sharedError / samples, oldError: oldError / samples, samples};
      });
    });
    assert.deepEqual(faults, [], 'forest bake raised browser errors');
    for (const result of results) {
      assert.deepEqual(result.next, result.continuation,
        `woodland wash replay changed RNG continuation at ${result.cx},${result.cy}`);
      // Canvas rasterization can round a translated gradient by one RGB step.
      assert(result.maxDifference <= 1 && result.sharedError < 0.02,
        `shared woodland wash differs from seamless reference: ${JSON.stringify(result)}`);
      assert(result.oldError > 0.5 && result.sharedError < result.oldError * 0.05,
        `regression fixture did not detect the original clipped washes: ${JSON.stringify(result)}`);
    }
    console.log('Forest ground seams passed: ' + results.length +
      ' world patches; unchanged RNG continuation; continuous Canvas reference matches.');
    console.log(JSON.stringify(results.map(({cx, cy, maxDifference, sharedError, oldError}) =>
      ({cx, cy, maxDifference, sharedError, oldError}))));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

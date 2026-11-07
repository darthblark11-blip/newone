// Exact forest painter pixels before and after a rendering optimization.
// FOREST_REFERENCE_JS=/path/to/reference-game.js GAME_JS=/path/to/game.js \
// VIS_DEPS=/path/to/dependencies VIS_CHROME=/path/to/chromium \
// VIS_P5_FILES=/path/to/p5-1.9.4.min.js:/path/to/p5-1.11.11.min.js node tools/check-forest-art-parity.js
// The reference may also be the first positional argument. Both painters use
// the current prop metadata: this checks a draw optimization, not an asset migration.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const referenceFile = process.env.FOREST_REFERENCE_JS || process.argv[2];
if (!referenceFile) throw new Error('Provide FOREST_REFERENCE_JS or a reference game.js as the first argument.');
const gameFile = process.env.GAME_JS || path.join(__dirname, '..', 'game.js');
const reference = fs.readFileSync(referenceFile, 'utf8');
const game = fs.readFileSync(gameFile, 'utf8');
const deps = process.env.VIS_DEPS || '/tmp/claude-0/-home-user-newone/8482112a-c646-5134-bd53-0f1ebb34fae6/scratchpad';
const { chromium } = require(path.join(deps, 'node_modules/playwright'));
const files = process.env.VIS_P5_FILES ? process.env.VIS_P5_FILES.split(path.delimiter) :
  [path.join(deps, 'node_modules/p5/lib/p5.min.js')];
function painterBlock(source) {
  const begin = source.indexOf('const _forestPolygonPainters');
  const end = source.indexOf('function paintClutter(', begin);
  assert(begin >= 0 && end > begin, 'forest painter boundaries must exist in both sources');
  return source.slice(begin, end);
}
const baseline = painterBlock(reference), candidate = painterBlock(game);
const hash = source => crypto.createHash('sha256').update(source).digest('hex');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.VIS_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-gpu']
  });
  const results = [];
  try {
    for (const file of files) {
      const page = await browser.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setContent('<script>' + fs.readFileSync(file, 'utf8') + '</script><script>' + game +
        '</script><script>window.preload=function(){};window.setup=function(){createCanvas(384,384);' +
        'pixelDensity(1);noLoop();window.__ready=true;};window.draw=function(){};</script>');
      await page.waitForFunction('window.__ready');
      const result = await page.evaluate(({ baseline, candidate }) => {
        const before = eval('(function(){' + baseline + ';return {paintForestClutter,paintForestBoulder};})()');
        const after = eval('(function(){' + candidate +
          ';return {paintForestClutter,paintForestBoulder,forestPolygonPainter,forestTreeSideStyle,forestTreePlan};})()');
        const buffer = createGraphics(384, 384); buffer.pixelDensity(1);
        BIOME_ACTIVE = true; currentBiome = currentLevel = 2;
        let density = 1, length = 1, owned = false;
        shadowDensity = () => density; shadowLengthScale = () => length;
        glRigOwnsSunShadows = () => owned;
        const failures = [];
        let comparisons = 0, cacheInvalidations = 0, colourFallbacks = 0, cases = 0;
        function compare(d, target, label) {
          const g = target === 'live' ? window : buffer;
          const metadata = JSON.stringify(d);
          function paint(which) {
            g.clear(); g.push(); g.scale(.8); g.translate(36, 20);
            if (d.forestSpecies === 'BOULDER') which.paintForestBoulder(g, d, 12, -4);
            else which.paintForestClutter(g, d, 120);
            g.pop();
            return g.drawingContext.getImageData(0, 0, 384, 384).data;
          }
          const expected = paint(before);
          for (const cached of [false, true]) {
            const actual = paint(after);
            let diff = 0, max = 0;
            for (let i = 0; i < expected.length; i++) if (expected[i] !== actual[i]) {
              diff++; max = Math.max(max, Math.abs(expected[i] - actual[i]));
            }
            comparisons++;
            if (diff) failures.push({ label, target, cached, diff, max });
          }
          if (JSON.stringify(d) !== metadata) failures.push({ label, target, metadataChanged: true });
        }
        const habitats = ['TIMBER', 'MARSH', 'BURN', 'HEATH'];
        const scenarios = [
          { camera: [0, 0], sun: [-.7, .7], zoom: .8, density: 1, length: 1.1, owned: false },
          { camera: [-120, 80], sun: [.9, .15], zoom: .48, density: .62, length: 1.8, owned: false },
          { camera: [140, -200], sun: [-.2, -.95], zoom: 1.35, density: .1, length: .8, owned: false },
          { camera: [90, 90], sun: [.5, .8], zoom: .66, density: 1, length: 1.3, owned: true }
        ];
        for (const name of Object.keys(FOREST_PROPS)) for (const scale of [.65, 1, 1.9])
          for (const crown of FOREST_PROPS[name].canopyMass ? [.3, 1] : [1])
            for (const target of ['live', 'bake']) for (let i = 0; i < scenarios.length; i++) {
              const sc = scenarios[i];
              camX = sc.camera[0]; camY = sc.camera[1]; zoom = sc.zoom;
              LIGHT_DX = sc.sun[0]; LIGHT_DY = sc.sun[1];
              density = sc.density; length = sc.length; owned = sc.owned;
              const d = { t: name === 'RED_ALDER' ? 'TREE' : name === 'CHARRED_SNAG' ? 'SNAG' :
                FOREST_PROPS[name].canopyMass ? 'PINE' : name, x: 192, y: 120, s: scale,
                r: .47 + i * .7, c: .61, forestSpecies: name, forestRegion: habitats[i],
                forestCrownScale: crown, w: 110 * scale, h: 95 * scale };
              compare(d, target, { name, scale, crown, scenario: i }); cases++;
            }
        // Newly sculpted crowns and every habitat palette retain the same
        // exact native/fallback contract as the saved needle-tree styles.
        for (const name of Object.keys(FOREST_PROPS).filter(k => FOREST_PROPS[k].canopyMass))
          for (const habitat of Object.keys(FOREST_REGIONS)) for (const target of ['live', 'bake']) {
            const d = { t: name === 'CHARRED_SNAG' ? 'SNAG' : 'PINE', x:192, y:120,
              s:1.3, r:.73, c:.27, forestSpecies:name, forestRegion:'TIMBER',
              forestHabitat:habitat, forestCanopyStyle:'COMIC', forestCrownScale:.8 };
            compare(d, target, {name, habitat, style:'COMIC'}); cases++;
          }
        camX = camY = 0; zoom = .8; LIGHT_DX = -.7; LIGHT_DY = .7;
        density = length = 1; owned = true;
        function planFor(d) {
          const cm = forestCanopyMass(d), s = d.s || 1;
          const crown = d.forestCrownScale === undefined ? 1 : d.forestCrownScale;
          return after.forestTreePlan(d, cm[1] * s * crown * .5, cm[2] * s * crown * .5,
            d.c || 0, d.forestSpecies, d.r || 0);
        }
        for (const target of ['live', 'bake']) {
          // Reuse one decor object. Fresh objects would never expose a stale plan.
          const d = { t: 'PINE', x: 192, y: 120, s: 1, r: .47, c: .61,
            forestSpecies: 'DOUGLAS_FIR', forestRegion: 'TIMBER', forestCrownScale: 1 };
          compare(d, target, 'cache initial');
          let previous = planFor(d);
          for (const change of [{ s: .65 }, { c: .18 }, { r: -1.5 }, { forestCrownScale: .3 },
            { forestSpecies: 'WESTERN_CEDAR' }, { forestSpecies: 'RED_ALDER' },
            { forestSpecies: 'SITKA_SPRUCE' }, { forestSpecies: 'LODGEPOLE_PINE' }, { s: 1.9 },
            { forestCanopyStyle:'COMIC' }, { forestCanopyStyle:'NEEDLE' }]) {
            Object.assign(d, change); compare(d, target, { invalidation: change });
            const current = planFor(d); cacheInvalidations++;
            if (current === previous) failures.push({ target, stalePlan: change });
            previous = current;
          }
          const g = target === 'live' ? window : buffer;
          const style = () => after.forestTreeSideStyle(g, after.forestPolygonPainter(g),
            'DOUGLAS_FIR', 32, 48, 119, 73, 128, 161, 91);
          if (!style()) failures.push({ target, nativeColourPathMissing: true });
          const modes = [[RGB, 100], [RGB, 255, 255, 255, 1], [HSB, 360, 100, 100, 1]];
          for (const mode of modes) {
            g.colorMode(...mode); colourFallbacks++;
            if (style() !== null) failures.push({ target, colourFallbackMissing: mode });
            compare(d, target, { colourMode: mode });
          }
          g.colorMode(RGB, 255);
          const Constructor = window.Path2D;
          try {
            window.Path2D = undefined;
            compare(d, target, 'Path2D unavailable');
          } finally { window.Path2D = Constructor; }
        }
        buffer.remove();
        return { version: p5.VERSION, cases, comparisons, cacheInvalidations, colourFallbacks, failures };
      }, { baseline, candidate });
      result.errors = errors; results.push(result);
      await page.close();
      assert.deepStrictEqual(errors, [], 'browser errors');
      assert.deepStrictEqual(result.failures, [], 'forest optimization changed RGBA pixels or violated a cache guard');
      assert.strictEqual(result.cacheInvalidations, 22);
      assert.strictEqual(result.colourFallbacks, 6);
      console.log(`${result.comparisons}/${result.comparisons} exact reference comparisons, 22 cache invalidations and 6 color-mode fallbacks passed with p5 ${result.version}.`);
    }
  } finally {
    await browser.close();
    if (process.env.FOREST_PARITY_OUT) fs.writeFileSync(process.env.FOREST_PARITY_OUT,
      JSON.stringify({ reference: referenceFile, referenceHash: hash(reference), game: gameFile,
        gameHash: hash(game), results }, null, 2));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

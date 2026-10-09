// Pixel parity between the forest's native Canvas path and p5's own polygons.
// Run with the same external dependencies as visual-world.js. To check both
// supported p5 versions, set VIS_P5_FILES to their paths, separated by ':'.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const deps = process.env.VIS_DEPS || '/tmp/claude-0/-home-user-newone/8482112a-c646-5134-bd53-0f1ebb34fae6/scratchpad';
const { chromium } = require(path.join(deps, 'node_modules/playwright'));
const files = process.env.VIS_P5_FILES ? process.env.VIS_P5_FILES.split(path.delimiter) :
  [path.join(deps, 'node_modules/p5/lib/p5.min.js')];
const game = fs.readFileSync(process.env.GAME_JS || path.join(__dirname, '..', 'game.js'), 'utf8');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.VIS_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-gpu']
  });
  try {
    for (const file of files) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setContent('<script>' + fs.readFileSync(file, 'utf8') + '</script><script>' + game +
        '</script><script>window.preload=function(){};window.setup=function(){createCanvas(384,384);' +
        'pixelDensity(1);noLoop();window.__ready=true;};window.draw=function(){};</script>');
      await page.waitForFunction('window.__ready');
      const result = await page.evaluate(() => {
        const version = p5.VERSION;
        const buffer = createGraphics(384, 384);
        buffer.pixelDensity(1);
        BIOME_ACTIVE = true; currentBiome = currentLevel = 2;
        let density = 1, length = 1, owned = false;
        shadowDensity = () => density; shadowLengthScale = () => length;
        glRigOwnsSunShadows = () => owned;
        const failures = [];
        let checks = 0;
        const habitats = ['TIMBER', 'MARSH', 'BURN', 'HEATH'];
        const scenarios = [
          { camera:[0,0], sun:[-.7,.7], zoom:.8, density:1, length:1.1, owned:false },
          { camera:[-120,80], sun:[.9,.15], zoom:.48, density:.62, length:1.8, owned:false },
          { camera:[140,-200], sun:[-.2,-.95], zoom:1.35, density:.1, length:.8, owned:false },
          { camera:[90,90], sun:[.5,.8], zoom:.66, density:1, length:1.3, owned:true }
        ];
        for (const name of Object.keys(FOREST_PROPS)) for (const scale of [.65, 1, 1.9])
          for (const crown of FOREST_PROPS[name].canopyMass ? [.3, 1] : [1])
            for (const target of ['live', 'bake']) for (let scenario = 0; scenario < scenarios.length; scenario++) {
              const sc = scenarios[scenario];
              camX=sc.camera[0]; camY=sc.camera[1]; zoom=sc.zoom;
              LIGHT_DX=sc.sun[0]; LIGHT_DY=sc.sun[1];
              density=sc.density; length=sc.length; owned=sc.owned;
              const d = { t:name==='RED_ALDER' ? 'TREE' : name==='CHARRED_SNAG' ? 'SNAG' :
                FOREST_PROPS[name].canopyMass ? 'PINE' : name, x:192, y:120, s:scale,
                r:.47+scenario*.7, c:.61, forestSpecies:name, forestRegion:habitats[scenario],
                forestCrownScale:crown, w:110*scale, h:95*scale };
              const g = target === 'live' ? window : buffer;
              function paint(native) {
                // An unverified version deliberately selects the production
                // fallback, so the reference is p5's actual vertex renderer.
                p5.VERSION = native ? version : 'parity-reference';
                g.clear(); g.push(); g.scale(.8); g.translate(36,20);
                if (name === 'BOULDER') paintForestBoulder(g,d,12,-4);
                else paintForestClutter(g,d,120);
                g.pop(); p5.VERSION=version;
                const context = g === window ? drawingContext : g.drawingContext;
                return context.getImageData(0,0,384,384).data;
              }
              const before=paint(false), after=paint(true);
              let diff=0;
              for (let i=0; i<before.length; i++) if (before[i] !== after[i]) diff++;
              checks++;
              if (diff) failures.push({name,scale,crown,target,scenario,diff});
            }
        const inst=p5.instance, renderer=inst._renderer, accessible=inst._accessibleOutputs;
        let fallback=0;
        const native = forestPolygonPainter(window) !== window && forestPolygonPainter(buffer) !== buffer;
        p5.VERSION='unverified'; if (forestPolygonPainter(window)===window) fallback++; p5.VERSION=version;
        renderer._clipping=true; if (forestPolygonPainter(window)===window) fallback++; renderer._clipping=false;
        renderer.isP3D=true; if (forestPolygonPainter(window)===window) fallback++; renderer.isP3D=false;
        inst._accessibleOutputs={grid:true,text:false}; if (forestPolygonPainter(window)===window) fallback++;
        inst._accessibleOutputs={grid:false,text:true}; if (forestPolygonPainter(window)===window) fallback++;
        inst._accessibleOutputs=accessible;
        const unknown={_renderer:{drawingContext:buffer.drawingContext}};
        if (forestPolygonPainter(unknown)===unknown) fallback++;
        buffer.remove();
        return {version,checks,failures,native,fallback};
      });
      await page.close();
      assert.deepStrictEqual(errors, [], 'browser errors');
      assert(result.native, 'the supported renderer actually exercised the native path');
      assert.strictEqual(result.fallback, 6, 'all guarded modes retain p5 rendering');
      assert.deepStrictEqual(result.failures, [], 'RGBA pixels differ from p5');
      console.log(`${result.checks}/${result.checks} exact forest polygon comparisons and 6 fallback checks passed with p5 ${result.version}.`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode=1; });

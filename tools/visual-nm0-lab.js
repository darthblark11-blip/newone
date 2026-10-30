// Native p5 scene replay for the closed NM-0 laboratory. The arrival uses the
// real twenty-guard encounter; later art closeups remove combatants only, while
// all walls, furniture, floor, staff and the full draw() remain the game's own.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const deps = process.env.VIS_DEPS || '/workspace/newone-dev';
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(path.join(deps, 'node_modules/playwright'))); }
const source = fs.readFileSync(process.env.GAME_JS || path.join(__dirname, '../game.js'), 'utf8');
const p5 = fs.readFileSync(process.env.VIS_P5 || path.join(deps, 'node_modules/p5/lib/p5.min.js'), 'utf8');
const out = process.env.NM0_LAB_OUT || '/tmp/newone-nm0-lab';
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VIS_CHROME || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox'] });
  let checks = 0;
  const ok = (value, label) => { assert(value, label); checks++; };
  const scenes = [
    { name: 'entry-desktop', w: 940, h: 700, x: 0, y: 1200, zoom: .66, guards: true },
    { name: 'entry-phone', w: 393, h: 800, x: 0, y: 1200, zoom: .66, guards: true, touch: true },
    { name: 'overview', w: 1200, h: 1600, x: 0, y: -500, zoom: .35 },
    { name: 'hallway', w: 940, h: 800, x: 0, y: 100, zoom: .66 },
    { name: 'clone-lab', w: 940, h: 800, x: 680, y: -800, zoom: .66 },
    { name: 'archive', w: 940, h: 800, x: 0, y: -1800, zoom: .66 },
    { name: 'staff-cover', w: 940, h: 700, x: -700, y: 1180, zoom: 1, cover: true },
    { name: 'office-doors-closed', w: 1200, h: 700, x: 0, y: 800, zoom: .42 },
    { name: 'west-office-entry', w: 940, h: 700, x: -1160, y: 800, zoom: .75, open: ['WEST'], guards: true },
    { name: 'west-offices', w: 1000, h: 1000, x: -2130, y: 400, zoom: .4, open: ['WEST'], cover: true },
    { name: 'east-offices', w: 1000, h: 1000, x: 2130, y: 400, zoom: .4, open: ['EAST'], cover: true },
    { name: 'light-key-desk', w: 940, h: 700, x: 2670, y: -245, zoom: 1, open: ['EAST'], cover: true },
    { name: 'whole-hq-layout', w: 1600, h: 1300, x: 0, y: -500, zoom: .25,
      open: ['WEST', 'EAST'], cover: true }
  ];
  const results = [];
  try {
    for (const scene of scenes) {
      const context = await browser.newContext({ viewport: { width: scene.w, height: scene.h },
        isMobile: !!scene.touch, hasTouch: !!scene.touch, deviceScaleFactor: 1 });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<style>html,body{margin:0;overflow:hidden;touch-action:none}</style>' +
        '<script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script>' +
        '<script>' + p5 + '</script><script>' + source + '</script>' +
        '<script>preload=function(){};setup=function(){createCanvas(' + scene.w + ',' + scene.h +
        ');pixelDensity(1);noLoop();window.__labReady=true;};</script>');
      await page.waitForFunction('__labReady');
      const initial = await page.evaluate(() => {
        randomSeed(81720); noiseSeed(BIOME_SEED); resetRunState(); resetStoryProgress();
        isStoryMode = true; seedWorldClock(); worldTimeMs = 12 / 24 * DAY_MS;
        leftStick = { active: false, dx: 0, dy: 0, base: { x: 80, y: height - 160 } };
        rightStick = { active: false, dx: 0, dy: 0, dist: 0, base: { x: width - 80, y: height - 110 } };
        startAtLevel(8); started = doTick = true;
        isPaused = isDead = isWin = killcamMode = false;
        inStoryIntro = inStoryRoom = inTownCutscene = inFortCutscene = inPostAmbushCutscene = false;
        inFarmCutscene = inFarmPostCutscene = inDarchonCall = inWorldBuildingMenu = false;
        inOverworldView = inTravelMenu = inLvl4Cutscene = false;
        window.inNM0SecretOverlay = false; window.showOnScreenControls = true;
        resetTouchAimSelection(false); setMeleeTool('NONE'); deltaTime = 1000 / 60;
        const graphics = window.createGraphics;
        window.__labGraphicsCreated = 0;
        window.createGraphics = function (...args) { __labGraphicsCreated++; return graphics(...args); };
        return { guards: enemiesList.length, armored: enemiesList.every(e => e.eType === 'ARMORED_STANDARD'),
          staff: nm0Scientists.length, staffStates: nm0Scientists.map(a => a.scientistState),
          closed: !BIOME_ACTIVE && !chunkMgr };
      });
      ok(initial.guards === 20 && initial.armored, scene.name + ' starts with exactly twenty armored guards');
      ok(initial.staff === 3 && initial.staffStates.every(s => s === 'STARTLED'), scene.name + ' staff begin startled');
      ok(initial.closed, scene.name + ' uses the closed authored interior');
      await page.evaluate(scene => {
        for(const room of scene.open||[])openNM0Office(room);
        if (!scene.guards) { enemiesList = []; window.nm0HqCleared = true; }
        if (scene.cover) for (let i = 0; i < 500; i++) { frameCount++; updateNM0Scientists(); }
        if(!scene.guards)streakMsgTimer=0;
        player.x = scene.x; player.y = scene.y; player.aimAngle = -HALF_PI;
        // A screenshot jumps the camera farther than ten walking frames can.
        // Invalidate the arrival cull once so the native next-frame rebuild
        // includes the selected room rather than the old entrance viewport.
        lastActiveUpdate = -1000; activeBuildings = []; activeParkingCars = []; invalidateColIndex();
        // draw() eases toward its .65 play zoom. Compensate its first step to
        // capture an exact repeatable scene without replacing the real camera.
        window.__labFrame = () => {
          zoom = (scene.zoom - .065) / .9;
          camX = scene.x - width / scene.zoom / 2; camY = scene.y - height / scene.zoom / 2;
          window.currentPan = 0; rightStick.active = leftStick.active = false;
          frameCount++; draw();
        };
        __labFrame();
      }, scene);
      const first = await page.evaluate(() => ({ graphics: __labGraphicsCreated,
        tiles: nm0LabFloorCache.size, fault: window.FRAME_FAULT || null }));
      await page.evaluate(() => __labFrame());
      const state = await page.evaluate(() => {
        const visibleFloorTiles = new Set();
        for (const floor of NM0_LAB_FLOOR_RECTS) {
          const x0 = Math.max(floor.x0, viewLeft - 80), x1 = Math.min(floor.x1, viewRight + 80);
          const y0 = Math.max(floor.y0, viewTop - 80), y1 = Math.min(floor.y1, viewBottom + 80);
          if (x1 <= x0 || y1 <= y0) continue;
          for (let cy = Math.floor(y0 / 1000); cy < Math.ceil(y1 / 1000); cy++)
            for (let cx = Math.floor(x0 / 1000); cx < Math.ceil(x1 / 1000); cx++) visibleFloorTiles.add(cx + ',' + cy);
        }
        return { graphics: __labGraphicsCreated,
        tiles: nm0LabFloorCache.size, fault: window.FRAME_FAULT || null,
        visibleFloorTiles: visibleFloorTiles.size,
        guards: enemiesList.length, kills: totalKills, blocked: player.checkCol(player.x, player.y),
        opened: {...nm0OfficeOpened},lightKey:!!window.nm0LightKey,
        staff: nm0Scientists.map(a => ({ x: a.x, y: a.y, state: a.scientistState, crouch: a.scientistCrouch })) };
      });
      ok(!first.fault && !state.fault, scene.name + ' completes the real frame without a scene fault');
      ok(!state.blocked, scene.name + ' places the player in a clear floor lane');
      ok(state.tiles > 0 && state.tiles <= 24, scene.name + ' keeps floor tiles bounded');
      ok(first.graphics === state.graphics && first.tiles === state.tiles,
        scene.name + ' reuses floor graphics on a repeated frame');
      if (scene.guards) ok(state.guards === 20+8*(scene.open||[]).length,
        scene.name + ' native frame preserves the finite guard roster');
      ok(state.staff.length===3+3*(scene.open||[]).length,scene.name+' preserves the finite staff roster');
      if(scene.open)ok(scene.open.every(id=>state.opened[id]),scene.name+' opens the requested native office doors');
      if(scene.name==='light-key-desk')ok(!state.lightKey,scene.name+' keeps the desk key available for interaction');
      if(scene.name==='whole-hq-layout')ok(state.tiles===state.visibleFloorTiles,scene.name+' covers every visible tile of the expanded authored floor union');
      if (scene.cover) ok(state.staff.every(a => a.state === 'CROUCH' && a.crouch > .95),
        scene.name + ' staff reach cover and settle into crouching');
      assert.deepEqual(errors, [], scene.name + ' has no browser exceptions');
      await page.locator('canvas').first().screenshot({ path: path.join(out, scene.name + '.png') });
      results.push({ scene: scene.name, ...state });
      await context.close();
    }
    fs.writeFileSync(path.join(out, 'scenes.json'), JSON.stringify(results, null, 2));
    console.log(`${checks}/${checks} native NM-0 laboratory scene checks passed. Screenshots: ${out}`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e.stack || e); process.exit(1); });

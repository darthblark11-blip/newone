// Construction, end to end: a blueprint becomes a ghost, the ghost refuses bad
// ground, placing it breaks ground, the architecture department raises it at
// the advertised rate, and none of it is lost to the two things that eat
// player-placed geometry in this file — a chunk rebuild and a reload.
const { ctx, probe } = require('./harness.js');
const P = (s) => probe('(' + s + ')');
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  ' + x : '')); if (!c) fails++; };

let seed = 31337;
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
       leftStick = { active: false, dx: 0, dy: 0, base: { x: 0, y: 0 } };
       rightStick = { active: false, dx: 0, dy: 0, dist: 0, base: { x: 0, y: 0 } };
       buildSites = []; playerStructures = []; buildGhost = null;
       window.popArchitectureM = 0; window.popArchitectureF = 0; window.archLvl = 1;`);

const DAY_MS = P('DAY_MS');

console.log('== the blueprint list ==');
{
  const kinds = P('BUILD_ORDER');
  ok('four blueprints to start with', kinds.length === 4, kinds.join(', '));
  let bad = null;
  for (const k of kinds) {
    const bp = P(`BLUEPRINTS[${JSON.stringify(k)}]`);
    if (!bp || !(bp.w > 40) || !(bp.h > 40) || !bp.label) bad = k;
  }
  ok('every one has a label and a footprint', bad === null, bad || '');
  // Footprints are authored at 1x and multiplied. At the 20 units to the metre
  // a parked car sets, these have to come out at building sizes rather than
  // shed sizes — the warehouse is the one to hold the line on.
  const wh = P('BLUEPRINTS.WAREHOUSE');
  ok('the scale multiplier is applied', wh.w === 230 * P('BUILD_SCALE') && wh.h === 150 * P('BUILD_SCALE'),
     `x${P('BUILD_SCALE')} -> ${wh.w} x ${wh.h} units = ${Math.round(wh.w / 20)} x ${Math.round(wh.h / 20)} m`);
  ok('and every footprint is a real structure, not a shed',
     BUILD_ORDER_MIN() >= 900, 'smallest side ' + BUILD_ORDER_MIN() + ' units');
  function BUILD_ORDER_MIN() {
    let m = Infinity;
    for (const k of kinds) { const b = P(`BLUEPRINTS[${JSON.stringify(k)}]`); m = Math.min(m, b.w, b.h); }
    return m;
  }
}

console.log('\n== the camera makes room for the outline ==');
{
  // A ghost whose edges are off screen is one the player cannot line up, so
  // placement pulls the camera back to fit the footprint.
  ok('no placement zoom when nothing is being placed', P('buildPlacementZoom()') === null);
  probe('width = 400; height = 800; startBuildPlacement("WAREHOUSE"); updateBuildPlacement();');
  const z = P('buildPlacementZoom()');
  const g = P('buildGhost');
  const halfSpan = Math.abs(P('buildGhost.x') - P('player.x')) + g.w / 2;
  ok('the whole footprint fits across the screen', z !== null && (400 / z) / 2 >= halfSpan,
     `zoom ${z.toFixed(3)} shows ${Math.round(400 / z)} units across, needs ${Math.round(halfSpan * 2)}`);
  ok('and it never zooms further out than is useful', z >= 0.10 && z <= 0.66, z.toFixed(3));
  probe('cancelBuildPlacement(); width = 1200; height = 800;');
}

console.log('\n== the ghost ==');
probe(`window.popArchitectureM = 20; window.popArchitectureF = 0;`);
{
  ok('the crew is the assigned department', P('buildCrew()') === 20);
  ok('and the button unlocks with it', P('buildCrew() > 0'));

  // Somewhere with room. The streamed woodland is not empty, so walk the player
  // to a spot the placement test itself says is clear rather than assuming one.
  let placed = false;
  for (let n = 0; n < 400 && !placed; n++) {
    probe(`player.x = ${-3000 + n * 40}; player.y = 0; player.aimAngle = 0;
           lastActiveUpdate = 0; activeBuildings = []; updateActiveWorld();
           startBuildPlacement("WAREHOUSE"); updateBuildPlacement();`);
    placed = P('buildGhost && buildGhost.ok') === true;
  }
  ok('a clear patch of ground reads as placeable', placed, 'player at x=' + P('player.x'));

  const g0 = P('({ x: buildGhost.x, y: buildGhost.y })');
  probe('player.aimAngle = Math.PI; updateBuildPlacement();');
  const g1 = P('({ x: buildGhost.x, y: buildGhost.y })');
  ok('the ghost rides in front of the player on the aim angle',
     Math.abs(g1.x - g0.x) > 200, `x ${Math.round(g0.x)} -> ${Math.round(g1.x)}`);
  probe('player.aimAngle = 0; updateBuildPlacement();');

  // Drop a real building on it — big enough that the crew would not simply
  // clear it. The outline must go red.
  probe(`window.__wall = { x: buildGhost.x, y: buildGhost.y, w: 320, h: 300, isBlockBuilding: true };
         buildings.push(window.__wall); lastActiveUpdate = 0; activeBuildings = []; updateActiveWorld();
         updateBuildPlacement();`);
  ok('a solid under the footprint blocks it', P('buildGhost.ok') === false);
  ok('and a blocked ghost refuses to place', P('confirmBuildPlacement()') === false &&
     P('buildSites.length') === 0);
  probe(`buildings.splice(buildings.indexOf(window.__wall), 1);
         lastActiveUpdate = 0; activeBuildings = []; updateActiveWorld(); updateBuildPlacement();`);
  ok('and clears again when it moves off', P('buildGhost.ok') === true);
}

console.log('\n== the crew clears the lot ==');
{
  // At 9x, ground scatter is not an obstruction — it is the first day's work.
  // Without this the big footprints were unplaceable: measured over the
  // woodland, a warehouse found 0 clear spots in 81 sampled.
  const cases = [
    ['a tree', '{ x: 0, y: 0, w: 34, h: 34, isTreeTrunk: true, girth: 1.3 }', true],
    ['a boulder', '{ x: 0, y: 0, w: 90, h: 80, isBiomeProp: true, propType: "BOULDER" }', true],
    ['a cactus', '{ x: 0, y: 0, w: 60, h: 60, isCactusProp: true }', true],
    ['a fence bay', '{ x: 0, y: 0, w: 470, h: 10, isFence: true }', true],
    ['a hay bale', '{ x: 0, y: 0, w: 70, h: 70, isHayBale: true }', true],
    ['a cabin', '{ x: 0, y: 0, w: 200, h: 160, isBiomeProp: true, propType: "CABIN" }', false],
    ['a river', '{ x: 0, y: 0, w: 300, h: 300, isRiver: true }', false],
    ['a pond', '{ x: 0, y: 0, w: 200, h: 160, isPond: true, isGrassLot: true }', false],
    ['a bridge deck', '{ x: 0, y: 0, w: 200, h: 160, isBiomeProp: true, propType: "BRIDGE", isDeck: true }', false],
    ['authored ground', '{ x: 0, y: 0, w: 200, h: 160, isAuthored: true }', false],
    ['a checkpoint', '{ x: 0, y: 0, w: 200, h: 160, isBiomeProp: true, propType: "CHECKPOINT" }', false],
    ['another structure', '{ x: 0, y: 0, w: 300, h: 300, isPlayerBuilt: true, isBuiltStructure: true }', false]
  ];
  let wrong = null;
  for (const [name, obj, want] of cases) {
    ctx.__t = null;
    const got = P(`(function(){ window.__t = ${obj}; return buildClearable(window.__t); })()`);
    if (got !== want) wrong = `${name}: clearable=${got}, wanted ${want}`;
  }
  ok('scatter is clearable, structures and water are not', wrong === null, wrong || cases.length + ' cases');

  // Break ground on a lot with timber on it and the timber goes to stores.
  probe(`window.resources = { WOOD: 0, METAL: 0, STONE: 0 };
         window.__lot = [];
         for (let i = 0; i < 6; i++) {
           const t = { x: buildGhost ? 0 : 0, y: 0, w: 34, h: 34, isTreeTrunk: true, girth: 1.2 };
           window.__lot.push(t);
         }`);
  probe(`startBuildPlacement("WAREHOUSE"); updateBuildPlacement();
         window.__trees = [];
         for (let i = 0; i < 6; i++) {
           const t = { x: buildGhost.x - 400 + i * 160, y: buildGhost.y, w: 34, h: 34,
                       isTreeTrunk: true, girth: 1.2 };
           window.__trees.push(t); buildings.push(t);
         }
         lastActiveUpdate = 0; activeBuildings = []; updateActiveWorld(); updateBuildPlacement();`);
  ok('timber on the lot does not refuse the site', P('buildGhost.ok') === true);
  const wood0 = P('resourceCount("WOOD")');
  probe('confirmBuildPlacement();');
  ok('and breaking ground takes it out',
     P('window.__trees.filter(t => buildings.indexOf(t) > -1).length') === 0);
  ok('with the timber banked, not scattered',
     P('resourceCount("WOOD")') > wood0 && P('resourceDrops.length') === 0,
     `+${P('resourceCount("WOOD")') - wood0} wood, ${P('resourceDrops.length')} piles on the ground`);
  probe('buildSites = []; republishPlayerStructures();');
}

console.log('\n== breaking ground ==');
{
  probe(`player.aimAngle = 0; startBuildPlacement("WAREHOUSE"); updateBuildPlacement();`);
  ok('placing it starts a site', P('confirmBuildPlacement()') === true && P('buildSites.length') === 1);
  ok('the ghost is put away', P('buildGhost') === null);
  const s = P('buildSites[0]');
  ok('recorded against this sector', s.level === P('currentLevel') && s.kind === 'WAREHOUSE',
     `level ${s.level}, ${s.kind}`);
  ok('at zero progress', s.progress === 0 && s.done === false);
  ok('and the hoarded lot is in the world',
     P('buildings.filter(b => b.isBuildSite).length') === 1);
  ok('a site blocks a step, the way a hoarding does',
     P('player.checkCol(buildSites[0].x, buildSites[0].y)') === true);
  ok('and nothing may be placed on top of it', (() => {
    probe('startBuildPlacement("LABORATORY"); updateBuildPlacement();');
    const blocked = P('buildGhost.ok') === false;
    probe('cancelBuildPlacement();');
    return blocked;
  })());
}

console.log('\n== the rate ==');
{
  // 1% per in-game day per assigned architect. A hundred raises one in a day.
  probe('window.popArchitectureM = 100; window.popArchitectureF = 0; window.archLvl = 1;');
  probe('buildSites[0].progress = 0; buildSites[0].done = false;');
  // Fed in slices, the way the clock actually delivers it.
  for (let i = 0; i < 60; i++) probe(`worldClockDtMs = ${DAY_MS / 60}; updateBuildSites();`);
  ok('100 architects finish a structure in one in-game day',
     P('buildSites[0].done') === true, (P('buildSites[0].progress') * 100).toFixed(1) + '%');

  probe(`buildSites[0].progress = 0; buildSites[0].done = false;
         window.popArchitectureM = 10; window.popArchitectureF = 0;`);
  for (let i = 0; i < 60; i++) probe(`worldClockDtMs = ${DAY_MS / 60}; updateBuildSites();`);
  const p10 = P('buildSites[0].progress');
  ok('10 architects manage a tenth of it', Math.abs(p10 - 0.10) < 0.005, (p10 * 100).toFixed(1) + '%');

  probe(`buildSites[0].progress = 0; buildSites[0].done = false; window.archLvl = 2;`);
  for (let i = 0; i < 60; i++) probe(`worldClockDtMs = ${DAY_MS / 60}; updateBuildSites();`);
  const p2 = P('buildSites[0].progress');
  ok('architecture level 2 doubles it', Math.abs(p2 - 0.20) < 0.01, (p2 * 100).toFixed(1) + '%');
  probe('window.archLvl = 1;');

  probe(`buildSites[0].progress = 0; buildSites[0].done = false;
         window.popArchitectureM = 0; window.popArchitectureF = 0;
         worldClockDtMs = ${DAY_MS}; updateBuildSites();`);
  ok('an empty department builds nothing', P('buildSites[0].progress') === 0);
  probe('window.popArchitectureM = 50; window.popArchitectureF = 50;');
  ok('both halves of the department count', P('buildCrew()') === 100);
}

console.log('\n== it keeps going while you are elsewhere ==');
{
  probe(`buildSites[0].progress = 0; buildSites[0].done = false;
         window.popArchitectureM = 25; window.popArchitectureF = 0;`);
  const homeLevel = P('buildSites[0].level');
  probe(`currentLevel = ${homeLevel === 3 ? 4 : 3};`);
  for (let i = 0; i < 30; i++) probe(`worldClockDtMs = ${DAY_MS / 30}; updateBuildSites();`);
  const away = P('buildSites[0].progress');
  probe(`currentLevel = ${homeLevel};`);
  ok('a site in another sector still goes up', Math.abs(away - 0.25) < 0.01,
     (away * 100).toFixed(1) + '% raised from a different level');
}

console.log('\n== topping out ==');
{
  probe(`buildSites[0].progress = 0.999; buildSites[0].done = false;
         window.popArchitectureM = 100; window.popArchitectureF = 0;
         worldClockDtMs = ${DAY_MS / 10}; updateBuildSites();`);
  ok('it finishes', P('buildSites[0].done') === true);
  ok('and never overruns 100%', P('buildSites[0].progress') === 1);
  ok('the hoarding comes down', P('buildings.filter(b => b.isBuildSite).length') === 0);
  ok('and the warehouse is standing',
     P('buildings.filter(b => b.isBuiltStructure && b.kind === "WAREHOUSE").length') === 1);
  ok('you cannot walk through it',
     P('player.checkCol(buildSites[0].x, buildSites[0].y)') === true);
}

console.log('\n== the barn lays down a field ==');
{
  probe(`buildSites.push({ level: currentLevel, kind: "FARM",
           x: buildSites[0].x + 900, y: buildSites[0].y, w: BLUEPRINTS.FARM.w, h: BLUEPRINTS.FARM.h,
           progress: 1, done: true });
         republishPlayerStructures();`);
  const barn = P('buildings.filter(b => b.isBuiltStructure && b.kind === "FARM").length');
  const field = P('buildings.filter(b => b.isCropField && b.isPlayerBuilt).length');
  ok('a barn and a worked field', barn === 1 && field === 1, `barn ${barn}, field ${field}`);
  const f = P('buildings.find(b => b.isCropField && b.isPlayerBuilt)');
  ctx.__fx = f.x; ctx.__fy = f.y;
  ok('the field is ground, not a wall', P('player.checkCol(window.__fx, window.__fy)') === false);
  const bn = P('buildings.find(b => b.isBuiltStructure && b.kind === "FARM")');
  ctx.__bx = bn.x; ctx.__by = bn.y;
  ok('the barn is not', P('player.checkCol(window.__bx, window.__by)') === true);
}

console.log('\n== a chunk rebuild does not sweep it away ==');
{
  // This is the one that bites. rebuildWorldArrays() REPLACES buildings[], and
  // in a streamed biome it runs every time the player crosses a chunk edge.
  const before = P('buildings.filter(b => b.isPlayerBuilt).length');
  probe('chunkMgr.rebuildWorldArrays();');
  const after = P('buildings.filter(b => b.isPlayerBuilt).length');
  ok('structures survive the streamer republishing the world', before > 0 && after === before,
     `${before} -> ${after}`);
  // And the barrier, which had this bug all along.
  probe(`playerStructures = []; buildSites = buildSites.filter(s => s.kind !== "__none");
         window.archBarrierReady = true; buildBarrier(); chunkMgr.rebuildWorldArrays();`);
  ok('and so does a raised barrier', P('buildings.filter(b => b.isUBarrier).length') >= 1);
}

console.log('\n== it survives a reload ==');
{
  probe(`buildSites = [{ level: 2, kind: "LABORATORY", x: 640, y: -320,
                         w: BLUEPRINTS.LABORATORY.w, h: BLUEPRINTS.LABORATORY.h,
                         progress: 0.42, done: false },
                       { level: 5, kind: "RANGE", x: -900, y: 200,
                         w: BLUEPRINTS.RANGE.w, h: BLUEPRINTS.RANGE.h,
                         progress: 1, done: true }];
         currentLevel = 2; republishPlayerStructures(); saveGame();`);
  probe('buildSites = []; playerStructures = []; republishPlayerStructures();');
  ok('cleared before the reload', P('buildSites.length') === 0);
  probe('loadGame();');
  ok('both sites come back', P('buildSites.length') === 2, JSON.stringify(P('buildSites.map(s => s.kind)')));
  const lab = P('buildSites.find(s => s.kind === "LABORATORY")');
  ok('mid-build progress is exact', lab && Math.abs(lab.progress - 0.42) < 1e-6,
     lab ? (lab.progress * 100).toFixed(1) + '%' : 'missing');
  ok('and a site in another sector is kept, not dropped',
     P('buildSites.filter(s => s.level === 5).length') === 1);
  ok('only this sector is published into the world',
     P('buildings.filter(b => b.isPlayerBuilt && b.buildLevel !== currentLevel).length') === 0);
  // The `site` back-pointer is a cycle and is deliberately not saved; the
  // republish has to rebuild it or the site art reads progress off undefined.
  const sited = P('buildings.filter(b => b.isBuildSite && b.site && typeof b.site.progress === "number").length');
  ok('site solids get their back-pointer rebuilt', sited === 1, sited + ' wired');
}

console.log('\n== the crew ==');
{
  probe(`buildSites = [{ level: currentLevel, kind: "WAREHOUSE", x: player.x + 300, y: player.y,
                         w: BLUEPRINTS.WAREHOUSE.w, h: BLUEPRINTS.WAREHOUSE.h,
                         progress: 0.2, done: false }];
         republishPlayerStructures();
         townCitizens = [];
         window.__c = new Citizen(player.x + 700, player.y + 400, "ARCHITECTURE", "MALE");
         townCitizens.push(window.__c);
         window.__w = new Citizen(player.x + 700, player.y + 400, "FARMING", "FEMALE");
         townCitizens.push(window.__w);`);
  ok('an architect finds the job', P('nearestBuildSite(window.__c.x, window.__c.y) !== null'));
  for (let i = 0; i < 900; i++) probe('frameCount++; window.__c.update();');
  ok('walks to the hoarding and gets to work', P('window.__c.state') === 'BUILDING', P('window.__c.state'));
  const h0 = P('window.__c.hammer');
  for (let i = 0; i < 60; i++) probe('frameCount++; window.__c.update();');
  ok('and keeps swinging', P('window.__c.hammer') > h0,
     `${h0.toFixed(1)} -> ${P('window.__c.hammer').toFixed(1)} rad`);
  const at = P('({ x: window.__c.x, y: window.__c.y })');
  const s = P('buildSites[0]');
  const onEdge = Math.abs(Math.abs(at.x - s.x) - (s.w / 2 + 26)) < 40 ||
                 Math.abs(Math.abs(at.y - s.y) - (s.h / 2 + 26)) < 40;
  ok('standing on the perimeter, not inside the walls', onEdge,
     `(${Math.round(at.x - s.x)}, ${Math.round(at.y - s.y)}) from centre`);

  for (let i = 0; i < 600; i++) probe('frameCount++; window.__w.update();');
  ok('a farmer is not conscripted onto the site',
     P('window.__w.state') !== 'BUILDING' && P('window.__w.state') !== 'TO_SITE', P('window.__w.state'));

  // Two architects must not stand in the same place.
  probe(`window.__c2 = new Citizen(player.x + 700, player.y + 400, "ARCHITECTURE", "FEMALE");
         window.__c2.slotSeed = (window.__c.slotSeed + Math.PI) % (Math.PI * 2);
         townCitizens.push(window.__c2);`);
  for (let i = 0; i < 900; i++) probe('frameCount++; window.__c2.update();');
  const a2 = P('({ x: window.__c2.x, y: window.__c2.y })');
  ok('a second architect takes a different slot',
     Math.hypot(a2.x - at.x, a2.y - at.y) > 60,
     Math.round(Math.hypot(a2.x - at.x, a2.y - at.y)) + ' units apart');
}

console.log('\n== it all draws ==');
{
  let err = null;
  try {
    probe(`buildSites = [
             { level: currentLevel, kind: "WAREHOUSE",  x: player.x + 400, y: player.y - 400,
               w: BLUEPRINTS.WAREHOUSE.w,  h: BLUEPRINTS.WAREHOUSE.h,  progress: 0.35, done: false },
             { level: currentLevel, kind: "LABORATORY", x: player.x + 400, y: player.y + 400,
               w: BLUEPRINTS.LABORATORY.w, h: BLUEPRINTS.LABORATORY.h, progress: 1, done: true },
             { level: currentLevel, kind: "RANGE",      x: player.x - 500, y: player.y + 400,
               w: BLUEPRINTS.RANGE.w,      h: BLUEPRINTS.RANGE.h,      progress: 1, done: true },
             { level: currentLevel, kind: "FARM",       x: player.x - 500, y: player.y - 400,
               w: BLUEPRINTS.FARM.w,       h: BLUEPRINTS.FARM.h,       progress: 1, done: true }];
           republishPlayerStructures();
           drawBuildingShadows(); drawBuildings(); drawGroundLots();
           window.__c.show();
           startBuildPlacement("FARM"); updateBuildPlacement();
           drawBuildGhost(); drawBuildHud(); cancelBuildPlacement();`);
  } catch (e) { err = e.message; }
  ok('sites, structures, the crew, the ghost and its HUD', err === null, err || '4 kinds + both states');

  // Both legacy and streamed shadow paths — they are different functions.
  let e2 = null;
  try { probe('BIOME_ACTIVE = false; drawBuildingShadows(); BIOME_ACTIVE = true; drawBiomeShadows();'); }
  catch (e) { e2 = e.message; }
  ok('and both shadow passes have a branch for them', e2 === null, e2 || '');
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

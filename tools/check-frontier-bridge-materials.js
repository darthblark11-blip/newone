// Production wood painting stays deterministic across chunk bakes, follows
// each board's fibres and retains the original crossing/deck geometry.
const assert = require('assert');
const {ctx, probe, mkG, calls} = require('./harness');
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
const run = code => probe(code);
ctx.bridgeG = mkG();
const originalRandom = ctx.random;
ctx.random = () => { throw new Error('Static bridge art must not consume gameplay RNG'); };

function boardSignature(seed, vertical = false) {
  calls.sig = 0;
  run(`paintFrontierBridgeBoard(bridgeG, -80, -154, ${vertical ? 22 : 160}, ${vertical ? 308 : 22}, ${seed}, ${vertical});`);
  return calls.sig;
}
const signature = boardSignature(7632);
boardSignature(12984, true);
check(signature === boardSignature(7632), 'Repainting a board is independent of intervening art and RNG');
check(signature !== boardSignature(7633), 'Different timbers have visible material variation');

for (const vertical of [false, true]) {
  const segments = [], numbers = [];
  const g = mkG();
  for (const method of ['rect', 'ellipse', 'line']) {
    const previous = g[method];
    g[method] = (...args) => { numbers.push(...args); if (method === 'line') segments.push(args); previous(...args); };
  }
  ctx.bridgeG = g;
  boardSignature(7632, vertical);
  check(numbers.every(Number.isFinite), 'Every ' + (vertical ? 'vertical' : 'horizontal') + ' grain and fastener has finite geometry');
  check(segments.length >= 6 && segments.slice(0, 6).every(([x0, y0, x1, y1]) => vertical ? Math.abs(y1 - y0) > Math.abs(x1 - x0) * 5 : Math.abs(x1 - x0) > Math.abs(y1 - y0) * 5), 'Grain follows the actual long axis of the ' + (vertical ? 'vertical' : 'horizontal') + ' board');
}

// Adjacent chunks each paint the complete landmark and clip it to their own
// surface. The shared board's local placement, identity and geometry must
// therefore match exactly on both sides of a seam, even at negative u.
run('var bridgePainterOriginal = paintFrontierBridgeBoard; var bridgeBoardRecords=[];');
run(`paintFrontierBridgeBoard=function(g,...args){
 if(args[2]===160 && args[3]===22) bridgeBoardRecords.push({ args, signature:0 });
 bridgePainterOriginal(g,...args);
};`);
for (const axis of ['X', 'Y']) for (const u of [-4200, -1800, 600, 3000]) {
  const profile = run(`frontierCanyonProfile('${axis}',${u},0)`);
  const alongOrigin = Math.floor(u / 1200) * 1200;
  const seam = Math.round(profile.center / 1200) * 1200;
  const records = [];
  for (const acrossOrigin of [seam - 1200, seam]) {
    ctx.bridgeG = mkG();
    const x = axis === 'X' ? alongOrigin : acrossOrigin;
    const y = axis === 'X' ? acrossOrigin : alongOrigin;
    calls.sig = 0;
    run(`bridgeBoardRecords=[];bakeFrontierCanyonStrip(bridgeG,'${axis}',0,${x},${y});`);
    records.push(JSON.stringify(run('bridgeBoardRecords')));
  }
  check(records[0] !== '[]' && records[0] === records[1], axis + ' bridge at ' + u + ' stamps identical planks into neighbouring chunks');
}
run('paintFrontierBridgeBoard=bridgePainterOriginal;');

// The bridge rotates its geometry to cross the other canyon axis. Its sun
// offset must rotate back into the same world direction on both axes.
for (const axis of ['X', 'Y']) {
  const profile = run(`frontierCanyonProfile('${axis}',600,0)`);
  const g = mkG(), shadows = [];
  let fill = [], angle = 0;
  g.fill = (...args) => { fill = args; };
  g.rotate = a => { angle = a; };
  g.rect = (x, y, w, h) => {
    if (fill.join() === '46,38,33,85') {
      const cx = x + w / 2, cy = y + h / 2;
      shadows.push([cx * Math.cos(angle) - cy * Math.sin(angle), cx * Math.sin(angle) + cy * Math.cos(angle)]);
    }
  };
  ctx.bridgeG = g;
  const across = Math.floor(profile.center / 1200) * 1200;
  run(`bakeFrontierCanyonStrip(bridgeG,'${axis}',0,${axis === 'X' ? 0 : across},${axis === 'X' ? across : 0});`);
  const expected = run('[LIGHT_DX*26,LIGHT_DY*26]');
  check(shadows.length === 1 && shadows[0].every((n, i) => Math.abs(n - expected[i]) < 1e-8), axis + ' bridge keeps its cast shadow aligned with the world sun');
}

// Only the fixed deck is cached. The two live rails retain their before/after
// actor passes, and changing viewport/DPR cannot allocate a new deck texture.
const createGraphicsOriginal = ctx.createGraphics, allocations = [];
ctx.createGraphics = (w, h) => {
  const g = mkG(); g.width = w; g.height = h;
  const allocation = { w, h, density: null };
  g.pixelDensity = density => { allocation.density = density; };
  allocations.push(allocation); return g;
};
run('_frontierBridgeDeckTexture=null;var bridgeDeckFirst=frontierSaloonBridgeDeckTexture();');
for (const [width, height] of [[390,844],[940,390],[320,568]]) {
  ctx.width = width; ctx.height = height;
  check(run('frontierSaloonBridgeDeckTexture()===bridgeDeckFirst'), 'The ' + width + '×' + height + ' viewport reuses the existing deck');
}
check(allocations.length === 1 && allocations[0].w === 1276 && allocations[0].h === 316 && allocations[0].density === 1, 'Arena wood allocates one bounded density-one texture');
run('paintFrontierSaloonBridge();paintFrontierSaloonBridgeRail(1);_frontierSaloonSession={arena:"BRIDGE"};');
check(allocations.length === 1, 'Rendering the arena and foreground rail does not rebake its deck');
check(run(`frontierSaloonArenaInfo('BRIDGE').bounds.top===-156 && frontierSaloonArenaInfo('BRIDGE').bounds.bottom===156 &&
 frontierSaloonBlocked(0,157) && !frontierSaloonBlocked(0,0)`), 'Material refinement keeps the existing playable bridge boundaries');
ctx.createGraphics = createGraphicsOriginal;
ctx.random = originalRandom;
console.log('Frontier bridge materials: ' + checks + ' grain, determinism, lighting and cache checks passed.');

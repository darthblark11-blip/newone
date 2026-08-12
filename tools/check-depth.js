// The pseudo-3D pass: who draws in front of whom, and how a mass projects.
//
// This is the ordering the old renderer got wrong in one specific way -- every
// mass drew over every character, so walking along the south face of a building
// made the player sink into it. The rule that replaces it is a single
// comparison at each thing's ground contact, and the failure modes are all
// silent: a dropped mass, a double-drawn one, or an off-by-one at the boundary
// looks like a rendering glitch rather than an error.
//
// drawBuildings/drawBiomeProps are replaced with recorders, so what is asserted
// here is the SCHEDULE -- the order and the multiplicity -- not the art.

const { ctx, probe } = require('./harness.js');

let fails = 0, checks = 0;
const ok = (n, c, x) => {
  checks++;
  if (c) console.log('  ok   ' + n + (x !== undefined ? '  ' + x : ''));
  else { fails++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + x : '')); }
};

probe(`
  BIOME_ACTIVE = true;
  viewLeft = -5000; viewRight = 5000; viewTop = -5000; viewBottom = 5000;
  __order = [];
  // The real passes are kept so the projection section further down can put
  // them back -- without that it would be measuring the recorder.
  __realDrawBuildings = drawBuildings;
  __realDrawBiomeProps = drawBiomeProps;
  __realQuad = quad; __realPush = push; __realPop = pop;
  // Recorders in place of the two real mass passes. Both are handed a range of
  // an already-sorted array, so recording arr[i].id per index also proves the
  // ranges the walk produces are the right ones.
  drawBuildings  = function (arr, i0, i1) { for (let i = i0; i < i1; i++) __order.push('M' + arr[i].id); };
  drawBiomeProps = function (arr, i0, i1) { for (let i = i0; i < i1; i++) __order.push('P' + arr[i].id); };

  function mass(id, y, h, prop) {
    return { id: id, x: 0, y: y, w: 200, h: h, isBiomeProp: !!prop };
  }
  function actor(id, y) {
    return { id: id, x: 0, y: y, show: function () { __order.push('A' + this.id); } };
  }
  function run(masses, actors) {
    activeBuildings = masses;
    _depthActors = actors.slice();
    _depthOn = true;
    __order = [];
    drawDepthSorted();
    return __order.join(' ');
  }
`);

const run = (m, a) => probe(`run([${m}], [${a}])`);

console.log('\n== a character in front of a building draws over it ==');
// The reported bug. A 200x200 building centred on 0 has its base at y=100;
// a character at y=200 is standing south of it, in the street.
let o = run('mass(1, 0, 200)', 'actor(1, 200)');
ok('south of the base, the character is in front', o === 'M1 A1', o);

o = run('mass(1, 0, 200)', 'actor(1, -200)');
ok('north of it, the building is in front', o === 'A1 M1', o);

console.log('\n== but standing inside the footprint still puts you under the roof ==');
// This is the case the old fixed order existed to get right, and it has to
// survive: the feet are north of the base, so the mass still draws over them.
o = run('mass(1, 0, 200)', 'actor(1, 40)');
ok('inside the footprint, the roof still hides you', o === 'A1 M1', o);
o = run('mass(1, 0, 200)', 'actor(1, 99)');
ok('just inside the south wall, still hidden', o === 'A1 M1', o);
o = run('mass(1, 0, 200)', 'actor(1, 130)');
ok('one step out of it, in front', o === 'M1 A1', o);

console.log('\n== the sort is by ground contact, not by centre ==');
// A tall building and a short one whose centres are level contact the ground in
// different places, and a character between them has to resolve against each.
o = run('mass(1, 0, 400), mass(2, 0, 40)', 'actor(1, 120)');
ok('the character is behind the tall one and in front of the short',
   o === 'M2 A1 M1' || o === 'M2 A1 M1', o);

console.log('\n== several characters interleave ==');
// Bases are at -250, 50 and 350; the actors sit at -400, 0 and 400. So a3 is
// south of every base and lands last, behind nothing.
o = run('mass(1, -300, 100), mass(2, 0, 100), mass(3, 300, 100)',
        'actor(1, -400), actor(2, 0), actor(3, 400)');
ok('each lands between the right pair', o === 'A1 M1 A2 M2 M3 A3', o);

// Queue order must not matter: the pass sorts what it is given.
o = run('mass(3, 300, 100), mass(1, -300, 100), mass(2, 0, 100)',
        'actor(3, 400), actor(1, -400), actor(2, 0)');
ok('and the result does not depend on the order they were queued',
   o === 'A1 M1 A2 M2 M3 A3', o);

console.log('\n== nothing is dropped and nothing is drawn twice ==');
// The walk advances one index at a time through the mass array; an off-by-one
// at a run boundary loses a building or repeats one, and neither is visible as
// an error at runtime.
const many = [];
for (let i = 1; i <= 12; i++) many.push(`mass(${i}, ${i * 60 - 400}, 80)`);
const acts = [];
for (let i = 1; i <= 6; i++) acts.push(`actor(${i}, ${i * 110 - 380})`);
o = run(many.join(', '), acts.join(', '));
const toks = o.split(' ');
const ms = toks.filter(t => t[0] === 'M');
const as = toks.filter(t => t[0] === 'A');
ok('every mass drawn exactly once', ms.length === 12 && new Set(ms).size === 12,
   ms.length + ' of 12, ' + new Set(ms).size + ' distinct');
ok('every actor drawn exactly once', as.length === 6 && new Set(as).size === 6,
   as.length + ' of 6');
// The masses were built in ascending y, so their ids must come out ascending.
ok('masses stay in depth order across run boundaries',
   ms.join() === ms.slice().sort((a, b) => +a.slice(1) - +b.slice(1)).join(), ms.join(' '));

console.log('\n== props and ordinary masses go to the right pass ==');
o = run('mass(1, -100, 50, true), mass(2, 0, 50), mass(3, 100, 50, true)', 'actor(9, 400)');
ok('a run is split into stretches of one kind', o === 'P1 M2 P3 A9', o);
o = run('mass(1, -100, 50, true), mass(2, -90, 50, true), mass(3, 100, 50)', 'actor(9, 400)');
ok('and consecutive props go out in one call', o === 'P1 P2 M3 A9', o);

console.log('\n== off-screen masses are culled before the sort ==');
probe('viewLeft = -150; viewRight = 150; viewTop = -150; viewBottom = 150;');
o = run('mass(1, 0, 50), mass(2, 9000, 50)', 'actor(1, 100)');
ok('a mass a mile away is not sorted or drawn', o === 'M1 A1', o);
probe('viewLeft = -5000; viewRight = 5000; viewTop = -5000; viewBottom = 5000;');

console.log('\n== the queue does not leak between frames ==');
// _depthActors is reused, and an actor left in it draws again next frame at
// whatever position it has drifted to.
probe('__order = []; _depthActors = [actor(1, 0)]; _depthOn = true; activeBuildings = []; drawDepthSorted();');
const leaked = probe('_depthActors.length');
ok('it is emptied on the way out', leaked === 0, leaked + ' left queued');
ok('and the flag is lowered', probe('_depthOn') === false);

console.log('\n== outside a biome nothing changes ==');
// Levels 0 and 8 are closed interiors composed against the old fixed order.
probe('BIOME_ACTIVE = false;');
ok('depth sorting is off', probe('depthSortActive()') === false);
probe(`
  __order = []; _depthOn = false;
  var _a = actor(7, 0);
  actorShow(_a);
`);
ok('actorShow() paints immediately instead of queueing',
   probe('__order.join(" ")') === 'A7' && probe('_depthActors.length') === 0,
   probe('__order.join(" ")'));
probe('BIOME_ACTIVE = true;');

// ---------------------------------------------------------------------------
// The mass projection.
// ---------------------------------------------------------------------------
// A top-down camera has no horizon, so the only cue that a building has height
// is the roof being displaced from the footprint, away from the middle of the
// screen. That displacement must NOT be the light vector: extruded along
// LIGHT_DX/DY every building leaned the way its own shadow fell and the two
// merged into one smear.
console.log('\n== a mass leans away from the middle of the screen ==');
probe('drawBuildings = __realDrawBuildings; drawBiomeProps = __realDrawBiomeProps;');
probe('width = 1200; height = 800; zoom = 1; camX = -600; camY = -400;');   // centre at (0,0)

const lean = (x, y, rise) => probe(`(function(){ var o=[0,0]; massLean(${x}, ${y}, ${rise}, o); return o; })()`);

// Pure parallax is zero at the principal point, and the camera follows the
// player -- so the player would be the only thing in the world with no volume.
// A few degrees of camera tilt gives everything a constant southward term as
// well, so nothing is ever perfectly flat.
let L = lean(0, 0, 26);
ok('at the centre of the view only the camera tilt shows',
   Math.abs(L[0]) < 1e-9 && L[1] > 0, '(' + L[0] + ', ' + L[1].toFixed(1) + ')');
const tilt0 = L[1];
ok('and the tilt does not depend on where the mass is',
   Math.abs(lean(600, 0, 26)[1] - tilt0) < 1e-9 &&
   Math.abs(lean(-600, 0, 26)[1] - lean(600, 0, 26)[1]) < 1e-9,
   'tilt ' + tilt0.toFixed(1) + ' everywhere at rise 26');

L = lean(600, 0, 26);
ok('a mass to the east leans east', L[0] > 5,
   '(' + L[0].toFixed(1) + ', ' + L[1].toFixed(1) + ')');
L = lean(-600, 0, 26);
ok('and one to the west leans west', L[0] < -5, '(' + L[0].toFixed(1) + ', ' + L[1].toFixed(1) + ')');
ok('south of centre leans further south than the tilt alone',
   lean(0, 400, 26)[1] > tilt0 + 5, lean(0, 400, 26)[1].toFixed(1) + ' vs ' + tilt0.toFixed(1));
ok('north of centre leans back against it',
   lean(0, -400, 26)[1] < tilt0 - 5, lean(0, -400, 26)[1].toFixed(1) + ' vs ' + tilt0.toFixed(1));

// The direction must be the camera's, not the sun's.
const diag = lean(600, 400, 26);
const dotSun = diag[0] * probe('LIGHT_DX') + diag[1] * probe('LIGHT_DY');
const away = lean(-600, -400, 26);
const dotSun2 = away[0] * probe('LIGHT_DX') + away[1] * probe('LIGHT_DY');
ok('the lean is not the light vector -- it reverses across the view while the sun does not',
   dotSun > 0 && dotSun2 < 0, 'dot ' + dotSun.toFixed(1) + ' one side, ' + dotSun2.toFixed(1) + ' the other');

ok('it scales with the mass', lean(600, 0, 26)[0] > lean(600, 0, 8)[0] * 2,
   lean(600, 0, 26)[0].toFixed(1) + ' vs ' + lean(600, 0, 8)[0].toFixed(1));
ok('a flat thing does not lean at all, tilt included',
   lean(600, 400, 0)[0] === 0 && lean(600, 400, 0)[1] === 0);
ok('and it is clamped past the edge of the view',
   Math.abs(lean(90000, 0, 26)[0] - lean(600, 0, 26)[0]) < 1e-9,
   'edge ' + lean(600, 0, 26)[0].toFixed(1) + ', far ' + lean(90000, 0, 26)[0].toFixed(1));

console.log('\n== the footprint stays on the collision rect ==');
// The base is what you bump into. If the roof were pinned instead and the base
// slid, a building would appear to skate on the ground as the camera panned.
probe(`
  __quads = [];
  quad = function (ax, ay, bx, by, cx, cy, dx, dy) { __quads.push([ax, ay, bx, by, cx, cy, dx, dy]); };
`);
const wallQuads = (bx, by) => probe(`(function(){
  __quads = [];
  activeBuildings = [{ x: ${bx}, y: ${by}, w: 200, h: 200, isBlockBuilding: true, style: 0, details: [] }];
  drawBuildings();
  return __quads;
})()`);

let q = wallQuads(600, 400);          // down-right of centre: leans down-right
ok('a wall starts on a footprint edge, not on the roof', q.length === 2,
   q.length + ' faces drawn');
if (q.length === 2) {
  const onFootprint = q.every(v =>
    Math.abs(v[0]) === 500 || Math.abs(v[1]) === 300 ||
    v[0] === 500 || v[1] === 300 || v[0] === 700 || v[1] === 500);
  // footprint of a 200x200 at (600,400) is x 500..700, y 300..500
  const first = q[0];
  ok('the near edge of the face is the footprint edge',
     (first[1] === 300 && first[3] === 300) || (first[0] === 500 && first[2] === 500),
     '(' + first[0] + ',' + first[1] + ') -> (' + first[2] + ',' + first[3] + ')');
  ok('and the far edge is displaced by the lean',
     first[5] !== first[1] || first[4] !== first[0],
     '(' + first[4].toFixed(1) + ',' + first[5].toFixed(1) + ')');
}

console.log('\n== the visible faces flip across the middle of the view ==');
const facesAt = (bx, by) => {
  const qq = wallQuads(bx, by);
  const fp = { x0: bx - 100, y0: by - 100, x1: bx + 100, y1: by + 100 };
  const names = [];
  for (const v of qq) {
    if (v[1] === fp.y0 && v[3] === fp.y0) names.push('N');
    else if (v[1] === fp.y1 && v[3] === fp.y1) names.push('S');
    else if (v[0] === fp.x0 && v[2] === fp.x0) names.push('W');
    else if (v[0] === fp.x1 && v[2] === fp.x1) names.push('E');
  }
  return names.sort().join('');
};
ok('down-right of centre shows the north and west walls', facesAt(600, 400) === 'NW', facesAt(600, 400));
ok('up-left of centre shows the south and east walls',    facesAt(-600, -400) === 'ES', facesAt(-600, -400));
ok('down-left shows north and east',                      facesAt(-600, 400) === 'EN', facesAt(-600, 400));
ok('up-right shows south and west',                       facesAt(600, -400) === 'SW', facesAt(600, -400));

console.log('\n== the transform is balanced ==');
// An unbalanced push() does not throw: it silently leaves the canvas
// translated for everything drawn after it, for the rest of the frame.
probe(`
  __depth = 0; __minDepth = 0; __maxDepth = 0;
  push = function () { __depth++; if (__depth > __maxDepth) __maxDepth = __depth; };
  pop  = function () { __depth--; if (__depth < __minDepth) __minDepth = __depth; };
`);
probe(`
  currentLevel = 1; currentBiome = 1; BIOME_ACTIVE = true;
  authoredCore = null; authoredChunks = null; authoredMask = null; biomeState = {};
  viewLeft = -4000; viewRight = 4000; viewTop = -4000; viewBottom = 4000;
  var all = [];
  for (var cx = -2; cx <= 2; cx++) for (var cy = -2; cy <= 2; cy++) {
    var ch = generateChunkContent(1, cx, cy);
    for (var i = 0; i < ch.solid.length; i++) all.push(ch.solid[i]);
  }
  activeBuildings = all;
  __depth = 0; __minDepth = 0; __maxDepth = 0;
  drawBuildings();
`);
const kinds = probe('activeBuildings.length');
ok('drawBuildings() leaves the transform where it found it',
   probe('__depth') === 0, 'net ' + probe('__depth') + ' over ' + kinds + ' solids');
ok('and never pops past where it started',
   probe('__minDepth') === 0, 'lowest ' + probe('__minDepth'));
ok('the roof translate is actually being used',
   probe('__maxDepth') > 0, 'deepest ' + probe('__maxDepth'));

console.log('\n== props are masses too ==');
const fs = require('fs');
const src = fs.readFileSync(process.env.GAME_JS || __dirname + '/../game.js', 'utf8');
const propsAt = src.search(/function drawBiomeProps\s*\(/);
const propsFn = src.slice(propsAt, src.indexOf('function drawLightPass()'));
const drawn = new Set((propsFn.match(/case *["'](\w+)["'] *:/g) || [])
  .map(x => /["'](\w+)["']/.exec(x)[1]));
const pr = /const PROP_RISE = \{([\s\S]*?)\n\};/.exec(src);
const rkeys = pr ? (pr[1].match(/(\w+): *\[/g) || []).map(x => x.split(':')[0].trim()) : [];
ok('PROP_RISE exists and covers the posts and set pieces', rkeys.length > 20,
   rkeys.length + ' prop types are masses');
// A key with no prop behind it is a skirt drawn for something that never
// appears; the failure is silent either way.
const orphan = rkeys.filter(k => !drawn.has(k));
ok('every entry is a propType drawBiomeProps actually draws', orphan.length === 0,
   orphan.join(' ') || 'all reachable');
// A deck is a surface you stand ON. Walls round it read as a crate in the river.
const decks = ['BRIDGE', 'CANALBRIDGE', 'BOARDWALK', 'RIVER', 'CANAL', 'HELIPAD'];
const wrong = decks.filter(k => rkeys.includes(k));
ok('surfaces and collision volumes are left flat', wrong.length === 0,
   wrong.length ? wrong.join(' ') + ' should not rise' : decks.join(' '));
ok('the lean is applied once, generically, not per case',
   /const _pr = PROP_RISE\[b\.propType\]/.test(propsFn) &&
   (propsFn.match(/drawMassSides\(/g) || []).length === 1);

console.log('\n== every mass uses the one projection ==');
// buildings, props and figures all through massLean/drawMassSides, so retuning
// MASS_LEAN moves the whole world together.
ok('buildings go through drawMassSides()', /if \(rise > 0\) drawMassSides\(/.test(src));
// Figures are deliberately NOT leaned. It was tried and reverted: parallax
// sells height as a ratio of displacement to size, and a figure is too small
// to have one -- the riser under it read as a dark blob stuck to the model.
// Their third dimension is the rig's marched shadow plus the depth sort.
ok('figures are deliberately not run through the projection',
   !/drawFigureRiser/.test(src) && !/CHAR_RISE/.test(src),
   'no riser, no figure lean');
ok('and neither are parked cars',
   !/function drawParkingCars\(\)[\s\S]{0,400}?massLean\(/.test(src));
ok('a figure keeps its feet where the depth sort and the rig expect them',
   /push\(\); translate\(this\.x, this\.y\);/.test(src));

console.log('\n== the legacy flags are masses now, and safely ==');
// Every branch in drawBuildings() ends in `continue`, so the lean around them
// cannot be a plain push/pop -- the close is deferred to the top of the next
// iteration. The failure mode is an unbalanced transform, and it is silent.
const lm = /const LEGACY_MASS = \{([\s\S]*?)\n\};/.exec(src);
const lmkeys = lm ? (lm[1].match(/(is\w+):/g) || []).map(x => x.slice(0, -1)) : [];
ok('LEGACY_MASS exists and covers the frontier, the city blocks and the scatter props',
   lmkeys.length >= 24, lmkeys.length + ' flags');
ok('the walk-past props are in -- crates, rocks, bales, wagons, cacti, palms',
   ['isCrateProp','isRock','isHayBale','isWagonProp','isCactusProp','isPalm']
     .every(k => lmkeys.includes(k)));
// A flag with no branch is a skirt drawn for nothing; worse, a typo is silent.
const bodyFn = src.slice(src.search(/function drawBuildings\s*\(/), src.indexOf('function drawParkingCars()'));
const ghosts2 = lmkeys.filter(k => !new RegExp('b\\.' + k + '\\b').test(bodyFn));
ok('every flag is one drawBuildings() actually dispatches on', ghosts2.length === 0,
   ghosts2.join(' ') || 'all reachable');
ok('the gates and the energy barriers are deliberately absent',
   !lmkeys.includes('isGovFortress') && !lmkeys.includes('isUBarrier') &&
   !lmkeys.includes('isGiantBarrier'), 'no isGovFortress / isUBarrier / isGiantBarrier');
ok('the rise is buildingRise(b), the same number the shadow is cast with',
   /const _lr = buildingRise\(b\);[\s\S]{0,120}?massLean\(b\.x, b\.y, _lr/.test(bodyFn));
ok('the close is deferred past the branch continues',
   /_lgClose\(\);\s*\n\s*if \(!inView/.test(bodyFn) && /}\s*\n\s*_lgClose\(\);\s*\n}/.test(bodyFn));

// And prove the balance over a biome that actually generates these flags.
probe(`
  currentLevel = 3; currentBiome = 3; BIOME_ACTIVE = true;
  authoredCore = null; authoredChunks = null; authoredMask = null; biomeState = {};
  viewLeft = -1e5; viewRight = 1e5; viewTop = -1e5; viewBottom = 1e5;
  width = 1200; height = 800; zoom = 1; camX = -600; camY = -400;
  var all3 = [], flags3 = {};
  for (var cx = -8; cx <= 8; cx++) for (var cy = -8; cy <= 8; cy++) {
    var ch = generateChunkContent(3, cx, cy);
    for (var i = 0; i < ch.solid.length; i++) {
      var sld = ch.solid[i];
      all3.push(sld);
      for (var k in sld) if (k.slice(0,2) === 'is' && sld[k] === true) flags3[k] = 1;
    }
  }
  activeBuildings = all3;
  __flags3 = Object.keys(flags3).length;
  __depth = 0; __minDepth = 0; __maxDepth = 0;
  drawBuildings();
`);
ok('drawBuildings() stays balanced across the frontier',
   probe('__depth') === 0 && probe('__minDepth') === 0,
   'net ' + probe('__depth') + ' over ' + probe('activeBuildings.length') + ' solids, ' +
   probe('__flags3') + ' distinct flags');

console.log('\n== figures get volume from shading, not from displacement ==');
// The projection cannot help at figure scale, so the three terms that DO
// survive twenty pixels are used instead: a contour, a lit cap and a
// terminator, all offset along the scene's one light vector.
ok('volShade() exists and is driven by the light vector',
   /function volShade\(/.test(src) &&
   /LIGHT_DX \* w \* off \* k/.test(src) && /LIGHT_DX \* w \* 0\.19/.test(src));
ok('the lit side is stepped, not a single inset cap',
   /for \(let i = 1; i <= VOL_STEPS; i\+\+\)/.test(src) && /const VOL_STEPS/.test(src));
ok('the contour is canvas STATE, so parts added later inherit it',
   /function figureContour\(\)/.test(src) &&
   /volShade[\s\S]{0,2400}?figureContour\(\);\n}/.test(src));
const contourSites = (src.match(/figureContour\(\)/g) || []).length;
ok('and it is switched on for the torso, the limbs and the citizens',
   contourSites >= 5, contourSites + ' call sites');
ok('the player, the enemies and the citizens all use the same helper',
   (src.match(/volShadeCol\(0, 0, this\.bodyW, this\.bodyH/g) || []).length === 2);
ok('none of it runs outside a biome, so Levels 0 and 8 are untouched',
   /if \(BIOME_ACTIVE\) volShadeCol/.test(src) &&
   /\} else if \(BIOME_ACTIVE\) \{[\s\S]{0,300}?volShadeCol/.test(src));

console.log('\n== drawBiomeProps() leaves the transform balanced ==');
// The lean wraps the whole switch, so a case that returned or continued would
// strand a push(). Run every prop type the two sectors can produce.
probe(`
  push = function () { __depth++; if (__depth > __maxDepth) __maxDepth = __depth; };
  pop  = function () { __depth--; if (__depth < __minDepth) __minDepth = __depth; };
  currentLevel = 2; currentBiome = 2; BIOME_ACTIVE = true;
  authoredCore = null; authoredChunks = null; authoredMask = null; biomeState = {};
  viewLeft = -1e5; viewRight = 1e5; viewTop = -1e5; viewBottom = 1e5;
  width = 1200; height = 800; zoom = 1; camX = -600; camY = -400;
  var all = [], seen = {};
  for (var cx = -10; cx <= 10; cx++) for (var cy = -10; cy <= 10; cy++) {
    var ch = generateChunkContent(2, cx, cy);
    for (var i = 0; i < ch.solid.length; i++) {
      var sld = ch.solid[i];
      if (sld.propType) { all.push(sld); seen[sld.propType] = 1; }
    }
  }
  activeBuildings = all;
  __seenTypes = Object.keys(seen).length;
  __depth = 0; __minDepth = 0; __maxDepth = 0;
  drawBiomeProps();
`);
ok('net zero over every prop the biome produces', probe('__depth') === 0,
   'net ' + probe('__depth') + ' over ' + probe('activeBuildings.length') + ' props, ' +
   probe('__seenTypes') + ' distinct types');
ok('and it never pops past where it started', probe('__minDepth') === 0,
   'lowest ' + probe('__minDepth'));

console.log('\n' + (checks - fails) + '/' + checks + ' checks passed');
process.exit(fails ? 1 : 0);

// Structural checks on the deferred lighting rig (GLRig).
//
// The node harness stubs canvases out entirely, so nothing here can compile the
// GLSL -- the rig detects the stub and stands down, which is itself the first
// thing worth asserting. What this file CAN do without a GPU is check the
// things that fail silently at runtime:
//
//   * a mistyped uniform name. gl.getUniformLocation returns null for a name
//     the shader does not declare, and gl.uniform*(null, v) is a NO-OP. So a
//     typo does not throw, does not warn, and does not draw wrong -- the term
//     just quietly stays at zero. Nothing else in the pipeline would catch it.
//   * an allocation inside the render loop, which is the one thing the
//     pre-allocation requirement exists to prevent.
//   * a shader whose #version is not on line 1, which is a compile error.
//   * the two integration points that make the rig reachable at all, and the
//     interlock that stops it and drawBiomeShadows() both casting the sun.
//
// Set GLRIG_BROWSER=1 with playwright installed to additionally run the real
// pipeline against a real WebGL2 context (see tools/gl/ if present).

const fs = require('fs');
const { ctx, probe } = require('./harness.js');

const src = fs.readFileSync(process.env.GAME_JS || __dirname + '/../game.js', 'utf8');

let fails = 0, checks = 0;
const ok = (n, c, x) => {
  checks++;
  if (c) console.log('  ok   ' + n + (x !== undefined ? '  ' + x : ''));
  else { fails++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + x : '')); }
};

// The rig block, so a uniform named in some unrelated part of the file cannot
// satisfy a check here.
const rigStart = src.indexOf('// DEFERRED LIGHTING AND SHADOW RIG (WebGL2)');
const rigEnd = src.indexOf('function drawBiomeScreenLayer() {');
const rig = src.slice(rigStart, rigEnd);

console.log('\n== the rig is present and wired in ==');
ok('the rig block exists', rigStart > 0 && rigEnd > rigStart, (rig.split('\n').length) + ' lines');
ok('setup() builds it before the first frame', /glRigInit\s*===\s*'function'\s*\)\s*glRigInit\(\)|glRigInit\(\)/.test(src.slice(src.indexOf('function setup()'), src.indexOf('function setup()') + 3000)));
ok('draw() gives it first refusal, with the canvas rig as the fallback',
   /if\s*\(!\(typeof glRigFrame === 'function' && glRigFrame\(\)\)\)\s*drawLightPass\(\);/.test(src));
ok('windowResized() reallocates its targets', /windowResized\(\)[\s\S]{0,400}?glRigResize\(\)/.test(src));

console.log('\n== exactly one pass casts the sun ==');
// Both cast from the same silhouettes. If both ran, every wall in the game
// would get its shadow alpha applied twice.
const shadowFn = src.slice(src.indexOf('function drawBiomeShadows()'),
                           src.indexOf('function drawBiomeShadows()') + 900);
ok('drawBiomeShadows() stands down when the rig owns them',
   /glRigOwnsSunShadows\(\)\)\s*return;/.test(shadowFn));
ok('and it only owns them inside a streamed biome',
   /function glRigOwnsSunShadows\(\)[\s\S]{0,200}?BIOME_ACTIVE/.test(rig));

// Every prop that calls these is in activeBuildings, so the rig has already
// marched a shadow off its real silhouette. Left ungated they drew a second,
// differently shaped shadow under every anchor, bridge and hedge in the world.
for (const fn of ['castShadow', 'castShadowRect']) {
  const body = src.slice(src.indexOf('function ' + fn + '('),
                         src.indexOf('function ' + fn + '(') + 320);
  ok(fn + '() stands down too', /glRigOwnsSunShadows\(\)\)\s*return;/.test(body));
}
ok('character contact ovals stand down as well',
   (src.match(/if \(!charShadowOwned\(this\.eType\)\)/g) || []).length === 2,
   (src.match(/if \(!charShadowOwned\(this\.eType\)\)/g) || []).length + ' of 2 draw sites');

console.log('\n== a height field cannot hold a flying unit ==');
// Entered into it, a saucer reads as a tower standing on the ground: it would
// occlude lamps around its own footprint and cast from its base, not the air.
ok('airborne types are named once and shared',
   /const CHAR_AIRBORNE = \{[^}]*SAUCER[^}]*AERIAL[^}]*\}/.test(src));
ok('they are excluded from the height buffer',
   /CHAR_AIRBORNE\[c\.eType\]\) return;/.test(rig));
ok('and they keep their own offset oval',
   /function charShadowOwned\(eT\) \{\s*if \(CHAR_AIRBORNE\[eT\]\) return false;/.test(src));

console.log('\n== there is exactly one list of lights ==');
// Three consumers used to walk activeBuildings themselves and each decide what
// was lit. Three copies of "which lamps are on" is three chances for a lamp to
// throw a pool with no bulb in it, or for the two rigs to disagree the moment
// the watchdog swaps them.
const gather  = rig.slice(rig.indexOf('function glRigGatherLights()'),
                          rig.indexOf('function glRigWatchdog()'));
const emitFn  = src.slice(src.indexOf('function sceneEmitters()'),
                          src.indexOf('function weaponKey('));
// Bounded at the rig block, which sits between drawLightPass() and
// drawBiomeScreenLayer() -- otherwise this slice swallows glRigPaintHeight().
const pass2d  = src.slice(src.indexOf('function drawLightPass()'), rigStart);
const nightFn = src.slice(src.indexOf('function drawNightLights()'),
                          src.indexOf('let weather = null;'));
for (const [n, body] of [['the deferred rig', gather], ['the canvas rig', pass2d],
                         ['the fixture pass', nightFn]]) {
  ok(n + ' reads sceneEmitters()', /sceneEmitters\(\)/.test(body));
  ok(n + ' gathers no lights of its own',
     !/for \(const b of activeBuildings\)/.test(body) && !/of fires\)/.test(body));
}
ok('and sceneEmitters() is the one place that does',
   /for \(const b of activeBuildings\)/.test(emitFn) && /of fires\)/.test(emitFn));
ok('it is gathered once a frame, not once per consumer',
   /_emitFrame === frameCount/.test(emitFn));

console.log('\n== the player carries no light, the weapon does ==');
// A pool pinned to the PLAYER means the player is never in the dark. A torch
// bolted to the gun goes away when they pick up a scavenged one, which is the
// difference worth having.
ok('nothing is emitted from the player themselves',
   !/x: player\.x, y: player\.y \+ 6, r: 240/.test(src));
ok('the torch is keyed off the equipped weapon',
   /const wk = w \? weaponKey\(w\) : '';/.test(emitFn) && /WEAPON_TORCH\[wk\]/.test(emitFn));
ok('and leaves from the muzzle, not the player centre',
   /WEAPON_MUZZLE\[wk\]/.test(emitFn) && /ca \* m\[0\] - sa \* m\[1\]/.test(emitFn));
// A key that is not in WEAPONS is silent: the lookup just never matches and
// that weapon quietly has no torch.
const wt = /const WEAPON_TORCH = \{([\s\S]*?)\};/.exec(src);
const wkeys = wt ? (wt[1].match(/(\w+):\s*1/g) || []).map(s => s.split(':')[0].trim()) : [];
const known = Object.keys(probe('WEAPONS'));
const bogus = wkeys.filter(k => !known.includes(k));
// A muzzle offset that does not match the one Character.show() fires from puts
// the beam and the rounds in different places.
const mz = /const WEAPON_MUZZLE = \{([\s\S]*?)\};/.exec(src);
const mkeys = mz ? (mz[1].match(/(\w+):\s*\[/g) || []).map(x => x.split(':')[0].trim()) : [];
ok('every torch weapon has a muzzle offset',
   wkeys.length > 0 && wkeys.every(k => mkeys.includes(k)), mkeys.join(' '));
ok('every WEAPON_TORCH key is a real weapon', wkeys.length > 0 && bogus.length === 0,
   bogus.length ? 'unknown: ' + bogus.join(' ') : wkeys.join(' '));
ok('the scavenged guns deliberately have none',
   !wkeys.includes('SHOTGUN') && !wkeys.includes('REVOLVER') && !wkeys.includes('COACH_GUN'),
   'no torch: SHOTGUN REVOLVER COACH_GUN');
// The muzzle is out in front of the player, so the clearance has to reach back
// past them or the reduction finds the bearer's own silhouette behind the lamp.
ok('and the torch clears its own bearer', /rMin: m\[0\] \+ \d+/.test(emitFn));
ok('it draws no fixture -- the beam is the light', /fix: null/.test(emitFn));
ok('its spill is a fixed world radius, not a fraction of the beam',
   /const TORCH_SPILL_R = \d+;/.test(src) &&
   /uSpill \* \(1\.0 - smoothstep\(0\.0, uSpillR, r\)\)/.test(rig));

console.log('\n== outposts light themselves ==');
const pe = /const PROP_EMITTERS = \{([\s\S]*?)\n\};/.exec(src);
ok('PROP_EMITTERS exists', !!pe);
const rows = pe ? pe[1].split('\n').filter(l => /^\s*\w+:\s*\{/.test(l)) : [];
ok('the three travel anchors are all lit',
   ['OUTPOST', 'CHECKPOINT', 'HELIPAD'].every(k => new RegExp('\\b' + k + ':\\s*\\{').test(pe ? pe[1] : '')),
   rows.length + ' prop types emit');
let shape = true, badRow = '';
for (const l of rows) {
  for (const f of ['dx:', 'dy:', 'r:', 'z:', 'p:', 'c:', 'soft:', 'rMin:', 'fix:']) {
    if (!l.includes(f)) { shape = false; badRow = l.trim().split(':')[0] + ' missing ' + f; }
  }
}
ok('every emitter carries the full descriptor', shape, badRow || 'all ' + rows.length);
// A PROP_EMITTERS key with no prop behind it is a light attached to nothing.
// Taken from the case labels in drawBiomeProps() rather than from `propType:`
// literals, because the street furniture is emitted from an array with
// `propType: t` and a literal scan misses every one of them.
// Signature-agnostic: drawBiomeProps() grew (list, i0, i1) parameters when the
// depth-sorted pass started handing it runs of an already-sorted array.
const propsAt = src.search(/function drawBiomeProps\s*\(/);
const propsFn = src.slice(propsAt, src.indexOf('function drawLightPass()'));
const propTypes = new Set((propsFn.match(/case *["'](\w+)["'] *:/g) || [])
  .map(s => /["'](\w+)["']/.exec(s)[1]));
const orphanLights = rows.map(l => l.trim().split(':')[0]).filter(k => !propTypes.has(k));
ok('no emitter is attached to a propType that is never emitted',
   orphanLights.length === 0, orphanLights.join(' ') || 'all reachable');

console.log('\n== cones ==');
ok('the light shader takes an aim, a cone and a spill',
   /uniform vec2  uAim;/.test(rig) && /uniform vec2  uCone;/.test(rig) &&
   /uniform float uSpill;/.test(rig));
ok('an omnidirectional source passes a window that is always satisfied',
   /uCone, -1\.001, -1\.0/.test(rig));
ok('the canvas rig draws a wedge for a cone too',
   /ctx\.arc\(0, 0, 1, aim - half, aim \+ half\)/.test(src));

console.log('\n== canopies cast, in every biome ==');
// Only the woodland gives its timber an isTreeTrunk solid. The jungle's trees,
// and every tree the clutter scatter drops, are decor and nothing else -- so
// the height pass has to read the decor list, not the solids.
ok('the height pass walks the live decor list', /for \(const dc of ch\.decor\)/.test(rig));
ok('sized off CANOPY_MASS at the entry own scale',
   /CANOPY_MASS\[dc\.t\]/.test(rig) && /cp\[1\] \* cs, cp\[2\] \* cs/.test(rig));
ok('the trunk stays a collision volume', /if \(b\.isTreeTrunk\) continue;/.test(rig));
// A CANOPY_MASS key that no clutter type produces is a caster for a tree that
// does not exist; one with no art in paintClutter is worse.
const cm = /const CANOPY_MASS = \{([\s\S]*?)\};/.exec(src);
const ckeys = cm ? (cm[1].match(/(\w+):\s*\[/g) || []).map(x => x.split(':')[0].trim()) : [];
const clutterArt = new Set((src.match(/case "(\w+)":/g) || []).map(x => /"(\w+)"/.exec(x)[1]));
ok('every canopy type has clutter art', ckeys.length > 0 && ckeys.every(k => clutterArt.has(k)),
   ckeys.join(' '));
ok('a canopy drops its painted oval when the rig is casting for it',
   /CANOPY_MASS\[d\.t\] && typeof glRigOwnsSunShadows/.test(src));
ok('and every other live contact shadow fades with the sun',
   /const a = alpha \* sd;/.test(src) && /sd = CANOPY_MASS/.test(src));

console.log('\n== every uniform the JS sets is one the GLSL declares ==');
// Collect declarations per shader, and the names the render path writes.
const shaders = {};
for (const m of rig.matchAll(/const (GLRIG_(?:VS|FS_\w+)) = `([\s\S]*?)`;/g)) shaders[m[1]] = m[2];
ok('all seven shader sources were found', Object.keys(shaders).length === 7,
   Object.keys(shaders).join(' '));

const declared = new Set();
for (const k in shaders) {
  for (const m of shaders[k].matchAll(/^\s*uniform\s+\w+\s+(\w+)\s*;/gm)) declared.add(m[1]);
}
const written = new Set();
for (const m of rig.matchAll(/_u\.(u\w+)/g)) written.add(m[1]);
// Samplers do not go through _u directly -- glRigBindTex() takes the name as a
// string, binds the unit and sets the int itself.
for (const m of rig.matchAll(/glRigBindTex\(gl, \w+, '(u\w+)'/g)) written.add(m[1]);

const ghosts = [...written].filter(u => !declared.has(u));
ok('no JS writes a uniform no shader declares', ghosts.length === 0,
   ghosts.length ? 'orphaned: ' + ghosts.join(' ') : written.size + ' uniforms all resolve');

const unused = [...declared].filter(u => !written.has(u));
ok('no shader declares a uniform the JS never sets', unused.length === 0,
   unused.length ? 'never set: ' + unused.join(' ') : declared.size + ' uniforms all fed');

console.log('\n== every shader compiles as GLSL ES 3.00 ==');
let versionOk = true, badV = '';
for (const k in shaders) {
  // A leading newline before #version is a compile error, and the template
  // literals here are easy to reindent into one by accident.
  if (!shaders[k].startsWith('#version 300 es\n')) { versionOk = false; badV = k; }
}
ok('#version 300 es is the first line of each', versionOk, badV || 'all 7');
let ioOk = true, badIO = '';
for (const k in shaders) {
  if (k === 'GLRIG_VS') continue;
  if (!/out vec4 oCol;/.test(shaders[k])) { ioOk = false; badIO = k; }
  if (!/in vec2 vUV;/.test(shaders[k])) { ioOk = false; badIO = k; }
}
ok('each fragment stage takes vUV and writes oCol', ioOk, badIO || 'all 6');

console.log('\n== nothing allocates inside the render loop ==');
// A createTexture()/createFramebuffer() per frame is a collection pause with a
// frame number on it, which is the whole reason the targets are pre-built.
const frameFn = rig.slice(rig.indexOf('function glRigFrame()'));
const allocs = ['createTexture(', 'createFramebuffer(', 'createProgram(', 'createShader(',
                'createGraphics(', 'createBuffer(', 'createVertexArray('];
const found = allocs.filter(a => frameFn.includes(a));
ok('glRigFrame() allocates no GPU object', found.length === 0, found.join(' ') || 'clean');
const paintFn = rig.slice(rig.indexOf('function glRigPaintHeight()'),
                          rig.indexOf('function glRigDraw('));
ok('the height pass allocates no p5 buffer', !paintFn.includes('createGraphics('));
ok('the light list is reused rather than rebuilt',
   /out\s*=\s*GLRig\.lights;[\s\S]{0,60}out\.length\s*=\s*0;/.test(rig));

console.log('\n== the pass order is the one the pipeline needs ==');
const order = ['glRigPaintHeight()', 'GLRig.prog.normal', 'GLRig.prog.sun',
               'GLRig.prog.occ', 'GLRig.prog.polar', 'GLRig.prog.light', 'GLRig.prog.comp'];
let pos = -1, seq = true, badSeq = '';
for (const step of order) {
  const at = frameFn.indexOf(step);
  if (at < 0 || at < pos) { seq = false; badSeq = step; break; }
  pos = at;
}
ok('height -> normals -> sun -> occlusion -> polar -> lights -> composite', seq, badSeq);
ok('point lights are scissored to their own box', /gl\.enable\(gl\.SCISSOR_TEST\)[\s\S]{0,900}?gl\.scissor\(/.test(frameFn));
ok('and accumulate additively', /gl\.blendFunc\(gl\.ONE, gl\.ONE\)/.test(frameFn));
ok('the lit frame goes back into the 2D canvas, not onto the page',
   /drawImage\(GLRig\.canvas, 0, 0, width, height\)/.test(frameFn) &&
   !/appendChild\(GLRig\.canvas\)|document\.body\.appendChild\(cv\)/.test(rig));
ok('the haze interlock with drawBiomeScreenLayer() is honoured',
   /_rigTookHaze = hazeA > 0\.004;/.test(frameFn));

console.log('\n== a shadow needs a sun ==');
// The painted ovals used to sit at 55% density at midnight, thrown by a sun
// that had set hours earlier, while the rig had correctly stopped casting.
probe('seedWorldClock();');
probe('worldTimeMs = 2 / 24 * DAY_MS;');
const nightSD = probe('shadowDensity()');
ok('nothing is cast at 02:00', nightSD < 0.01, 'density ' + nightSD.toFixed(3));
probe('worldTimeMs = 13 / 24 * DAY_MS;');
const daySD = probe('shadowDensity()');
// Not asserted near 1: the harness's weather stub is heavily overcast, and
// skyDiffusion() legitimately takes most of the hard shadow out of a cloudy
// noon. What matters is that midday casts and midnight does not.
const q = probe('skyDiffusion()');
ok('and real weight at 13:00', daySD > 0.4,
   'density ' + daySD.toFixed(3) + ' at skyDiffusion ' + q.toFixed(2));
// Sunset is 18:00 and daylight() is fully out a little after it, so the ramp
// has to be sampled inside the window rather than past it.
probe('worldTimeMs = 18 / 24 * DAY_MS;');
const duskSD = probe('shadowDensity()');
ok('easing off through dusk rather than snapping', duskSD > 0.01 && duskSD < daySD * 0.6,
   'density ' + duskSD.toFixed(3) + ' at 18:00');
// shadowLengthScale() must NOT take the same term: it is how long a shadow is,
// not how dark, and the rig derives its ray-march slope from it.
ok('shadow LENGTH is left alone -- the rig marches against it',
   !/function shadowLengthScale\(\)[^\n]*daylight\(\)/.test(src));

console.log('\n== it stands down cleanly with no GPU ==');
// The harness stubs getContext() with a bare object. A rig that trusted that
// would throw on the first gl call of the first frame.
probe('currentLevel = 2; currentBiome = 2; BIOME_ACTIVE = true;');
let initErr = null, initRet;
try { initRet = probe('glRigInit()'); } catch (e) { initErr = e.message; }
ok('glRigInit() returns false rather than throwing', initErr === null && initRet === false,
   initErr || 'returned ' + initRet);
ok('glRigActive() is false', probe('glRigActive()') === false);
ok('glRigOwnsSunShadows() is false, so drawBiomeShadows() still runs',
   probe('glRigOwnsSunShadows()') === false);
let frameErr = null, frameRet;
try { frameRet = probe('glRigFrame()'); } catch (e) { frameErr = e.message; }
ok('glRigFrame() declines the frame rather than throwing',
   frameErr === null && frameRet === false, frameErr || 'returned ' + frameRet);
let resizeErr = null;
try { probe('glRigResize()'); } catch (e) { resizeErr = e.message; }
ok('glRigResize() is a no-op', resizeErr === null, resizeErr || '');

console.log('\n' + (checks - fails) + '/' + checks + ' checks passed');
process.exit(fails ? 1 : 0);

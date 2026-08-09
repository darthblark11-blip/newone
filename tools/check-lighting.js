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

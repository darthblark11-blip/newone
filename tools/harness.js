// Headless harness: loads game.js into a vm context with p5's global-mode API
// stubbed out, so chunk generation and the terrain bake can be exercised
// without a canvas. Verification for this repo is normally visual; this covers
// the parts that are pure arithmetic — determinism, seams, and "does it throw".
const fs = require('fs');
const vm = require('vm');

// --- deterministic stand-in for p5's perlin noise -------------------------
// Smooth, in [0,1), and a pure function of its arguments, which is all the
// world generation actually requires of it.
function fade(t){ return t*t*t*(t*(t*6-15)+10); }
function hash2(x,y){ let h=Math.imul(x^0x9e3779b9,0x85ebca6b)^Math.imul(y^0x27d4eb2f,0xc2b2ae35); h=Math.imul(h^(h>>>15),0x2545f491); return ((h^(h>>>13))>>>0)/4294967296; }
function lattice(x,y){
  const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
  const u=fade(xf), v=fade(yf);
  const a=hash2(xi,yi), b=hash2(xi+1,yi), c=hash2(xi,yi+1), d=hash2(xi+1,yi+1);
  return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}
// p5's noise() is four octaves at halving amplitude, which matters here for
// more than texture: octave-summed noise is bell-shaped around 0.5, where a
// single lattice is close to uniform. Every threshold in the world generation
// is a percentile of that distribution, so a flat stand-in would report region
// coverage and feature frequencies that the real game never produces.
function noise(x,y){
  x=x||0; y=y||0;
  let v=0, amp=0.5, f=1, tot=0;
  for (let o=0;o<4;o++){ v += lattice(x*f, y*f)*amp; tot += amp; amp*=0.5; f*=2; }
  return v/tot;
}

const calls = { shape: 0, fill: 0, stroke: 0, img: 0, sig: 0 };
// A rolling hash of WHERE things were drawn, not just how many were.
//
// Counting calls cannot see a shadow pointing the wrong way -- the same number
// of ellipses land in different places. This folds every numeric argument into
// one integer, so "did these two runs paint the same picture" is a comparison
// of two numbers. Rounded to a tenth of a unit, because the answer has to
// survive floating point without hiding a real difference.
function sig(a){
  let h = calls.sig;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    const n = typeof v === 'number' ? Math.round(v * 10) : 0;
    h = (Math.imul(h ^ (n | 0), 0x01000193) >>> 0);
  }
  calls.sig = h;
}
function mkG(){
  const g = {
    // Enough of a 2D context for the light rig, which reaches past p5 into
    // drawingContext for gradients, clips and composite modes. A missing method
    // here is not a game bug -- it is this stub being narrower than the game.
    drawingContext: {
      // The geometric ones fold into calls.sig, the same as the p5 painters do:
      // the light rig reaches PAST p5 into drawingContext for its gradients, so
      // a hash that stopped at the p5 API could not see a pool move.
      save(){},restore(){},translate(){sig(arguments);},scale(){sig(arguments);},
      rotate(){sig(arguments);},transform(){sig(arguments);},
      setTransform(){sig(arguments);},resetTransform(){},
      beginPath(){},closePath(){},moveTo(){sig(arguments);},lineTo(){sig(arguments);},
      arc(){sig(arguments);},arcTo(){sig(arguments);},ellipse(){sig(arguments);},
      rect(){sig(arguments);},roundRect(){sig(arguments);},
      quadraticCurveTo(){sig(arguments);},bezierCurveTo(){sig(arguments);},
      fill(){},stroke(){},clip(){},clearRect(){},
      fillRect(){sig(arguments);},strokeRect(){sig(arguments);},
      drawImage(){sig(arguments);},putImageData(){},
      getImageData(){ return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; },
      createRadialGradient(){ return { addColorStop(){} }; },
      createLinearGradient(){ return { addColorStop(){} }; },
      createPattern(){ return null; },
      set fillStyle(v){}, get fillStyle(){ return null; },
      set strokeStyle(v){}, get strokeStyle(){ return null; },
      set lineWidth(v){}, get lineWidth(){ return 1; },
      set lineCap(v){}, get lineCap(){ return 'butt'; },
      set lineJoin(v){}, get lineJoin(){ return 'miter'; },
      set filter(v){}, get filter(){ return 'none'; },
      set shadowBlur(v){}, get shadowBlur(){ return 0; },
      set shadowColor(v){}, get shadowColor(){ return null; },
      set imageSmoothingEnabled(v){}, get imageSmoothingEnabled(){ return true; },
      set globalCompositeOperation(v){}, get globalCompositeOperation(){ return 'source-over'; },
      set globalAlpha(v){}, get globalAlpha(){ return 1; }
    },
    width: 384, height: 384, pixels: new Uint8ClampedArray(200*200*4),
    push(){},pop(){},translate(){},scale(){},rotate(){},
    fill(){calls.fill++;sig(arguments);},stroke(){calls.stroke++;sig(arguments);},
    noFill(){},noStroke(){},strokeWeight(){},
    rect(){sig(arguments);},ellipse(){sig(arguments);},line(){sig(arguments);},
    arc(){sig(arguments);},quad(){sig(arguments);},triangle(){sig(arguments);},text(){},
    image(){calls.img++;sig(arguments);},
    beginShape(){calls.shape++;},vertex(){sig(arguments);},endShape(){},curveVertex(){sig(arguments);},
    smooth(){},noSmooth(){},pixelDensity(){},loadPixels(){},updatePixels(){},remove(){},
    background(){},clear(){},textAlign(){},textSize(){},textLeading(){}
  };
  return g;
}

const ctx = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean, Set, Map,
  Float32Array, Int32Array, Uint8Array, Uint8ClampedArray, isFinite, parseInt, parseFloat,
  setTimeout, clearTimeout, setInterval, clearInterval,
  noise, noiseSeed(){}, random(a,b){ if(a===undefined) return 0.5; if(b===undefined) return (Array.isArray(a)?a[0]:0.5*a); return (a+b)/2; },
  randomSeed(){},
  createGraphics(){ return mkG(); },
  createCanvas(){ return mkG(); }, resizeCanvas(){}, pixelDensity(){},
  PI: Math.PI, TWO_PI: Math.PI*2, HALF_PI: Math.PI/2, QUARTER_PI: Math.PI/4,
  CENTER:'center', CLOSE:'close', LEFT:'left', RIGHT:'right', TOP:'top', BOTTOM:'bottom',
  RADIUS:'radius', CORNER:'corner', CORNERS:'corners', BLEND:'blend',
  CHORD:'chord', PIE:'pie', OPEN:'open', SQUARE:'square', ROUND:'round', PROJECT:'project',
  NORMAL:'normal', BOLD:'bold', ITALIC:'italic', BOLDITALIC:'bolditalic', BASELINE:'baseline',
  width: 1200, height: 800, frameCount: 100, deltaTime: 16, mouseX:0, mouseY:0,
  windowWidth:1200, windowHeight:800, touches: [], keyCode:0, key:'',
  frameRate(){ return 60; }, keyIsDown(){ return false; }, keyIsPressed: false,
  mouseIsPressed: false, movedX: 0, movedY: 0,
  dist(x1,y1,x2,y2){ return Math.hypot(x2-x1,y2-y1); },
  lerp(a,b,t){ return a+(b-a)*t; },
  constrain(v,a,b){ return v<a?a:v>b?b:v; },
  map(v,a,b,c,d){ return c+(d-c)*((v-a)/(b-a)); },
  max: Math.max, min: Math.min, abs: Math.abs, floor: Math.floor, ceil: Math.ceil,
  round: Math.round, sqrt: Math.sqrt, pow: Math.pow, atan2: Math.atan2,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, sq(v){return v*v;},
  radians(d){ return d * Math.PI / 180; }, degrees(r){ return r * 180 / Math.PI; },
  asin: Math.asin, acos: Math.acos, atan: Math.atan, log: Math.log, mag(x,y){ return Math.hypot(x,y); },
  norm(v,a,b){ return (v-a)/(b-a); }, fract(v){ return v - Math.floor(v); },
  // p5.Color exposes .levels — the corpse art reads sC.levels[0..2] directly,
  // so a bare {} makes every body draw throw on a property of undefined.
  color(a,b,c,d){
    if (typeof a === 'object' && a && a.levels) return a;
    const l = (b === undefined) ? [a|0,a|0,a|0,255] : (d === undefined && c === undefined) ? [a|0,a|0,a|0,b|0]
            : [a|0,b|0,c|0, d === undefined ? 255 : d|0];
    return { levels: l, toString(){ return 'rgba('+l.join(',')+')'; } };
  },
  red(v){return v&&v.levels?v.levels[0]:0;}, green(v){return v&&v.levels?v.levels[1]:0;}, blue(v){return v&&v.levels?v.levels[2]:0;},
  loadImage(){ return {}; }, loadSound(){ return {}; }, loadFont(){ return {}; },
  localStorage: { getItem(){return null;}, setItem(){}, removeItem(){} },
  // The sample loader needs it to turn embedded base64 into bytes. There is no
  // decodeAudioData in the stub below, so the loader stops right after this
  // and every check keeps the synthesised weapons -- which is the fallback
  // path the game itself takes on a browser that will not decode the format.
  atob: (b) => Buffer.from(b, 'base64').toString('binary'),
  // Enough of Web Audio for sfx.init() and every cue to run without throwing.
  // Buffers report a real duration because the noise layers pick a random
  // start offset inside one, but hand back a short channel array -- nothing
  // here listens, and filling two seconds of noise per check is pure cost.
  AudioContext: function(){
    const param = () => ({ value:0, setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){}, setTargetAtTime(){} });
    return { state:'running', resume(){}, currentTime:0,
    createOscillator(){return{type:'',frequency:param(),detune:param(),connect(){},start(){},stop(){}};},
    createGain(){return{gain:param(),connect(){}};},
    createBuffer(n,len,sr){const d=new Float32Array(len);
      return{numberOfChannels:n,length:len,sampleRate:sr,duration:len/sr,getChannelData(){return d;}};},
    createBufferSource(){return{buffer:null,playbackRate:param(),connect(){},start(){},stop(){}};},
    createBiquadFilter(){return{type:'',frequency:param(),Q:param(),gain:param(),connect(){}};},
    createStereoPanner(){return{pan:param(),connect(){}};},
    createWaveShaper(){return{curve:null,oversample:'none',connect(){}};},
    createDynamicsCompressor(){return{threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){}};},
    destination:{}, sampleRate:44100 };},
};
// every p5 drawing call the file makes in global mode
for (const fn of ['push','pop','translate','rotate','scale','fill','noFill','stroke','noStroke',
  'strokeWeight','rect','ellipse','line','arc','quad','triangle','point','text','image',
  'beginShape','vertex','endShape','curveVertex','bezier','textAlign','textSize','textLeading',
  'textFont','background','clear','smooth','noSmooth','tint','noTint','rectMode','ellipseMode',
  'imageMode','angleMode','blendMode','cursor','noCursor','saveCanvas','strokeCap','strokeJoin',
  'textStyle','textWrap','textWidth','textAscent','textDescent','curve','bezierVertex','curveTightness',
  'drawingContext','shearX','shearY','applyMatrix','resetMatrix','erase','noErase','circle','square']) {
  if (!(fn in ctx)) ctx[fn] = function(){};
}
// The global-mode painters record WHERE they were asked to draw, the same way
// the buffer stub does -- see sig(). A check that wants to know whether two
// runs painted the same picture reads calls.sig around them.
for (const fn of ['rect','ellipse','line','arc','quad','triangle','point','image',
                  'vertex','curveVertex','bezier','bezierVertex','curve','circle','square']) {
  const prev = ctx[fn];
  ctx[fn] = function(){ sig(arguments); return prev.apply(this, arguments); };
}
ctx.drawingContext = mkG().drawingContext;
ctx.document = { addEventListener(){}, removeEventListener(){}, body:{}, getElementById(){return null;},
  createElement(){ return { getContext(){ return {}; }, style:{}, appendChild(){} }; } };
ctx.navigator = { userAgent: 'node', maxTouchPoints: 0, getGamepads(){ return []; } };
ctx.millis = () => 0;
ctx.addEventListener = function(){};
ctx.removeEventListener = function(){};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.env.GAME_JS || __dirname + '/../game.js','utf8'), ctx, { filename: 'game.js' });
// Top-level `const`/`let` from a vm script land in the context's global
// lexical scope, not on the context object, so reach them by evaluating in the
// same context rather than by property access.
const probe = (src) => vm.runInContext(src, ctx);
module.exports = { ctx, mkG, calls, probe };

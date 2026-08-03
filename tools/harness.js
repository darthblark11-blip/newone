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
function noise(x,y){
  x=x||0; y=y||0;
  const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
  const u=fade(xf), v=fade(yf);
  const a=hash2(xi,yi), b=hash2(xi+1,yi), c=hash2(xi,yi+1), d=hash2(xi+1,yi+1);
  return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}

const calls = { shape: 0, fill: 0, stroke: 0, img: 0 };
function mkG(){
  const g = {
    drawingContext: {
      save(){},restore(){},translate(){},scale(){},beginPath(){},arc(){},fill(){},
      createRadialGradient(){ return { addColorStop(){} }; },
      set fillStyle(v){}, get fillStyle(){ return null; },
      set globalAlpha(v){}, get globalAlpha(){ return 1; }
    },
    width: 384, height: 384, pixels: new Uint8ClampedArray(200*200*4),
    push(){},pop(){},translate(){},scale(){},rotate(){},
    fill(){calls.fill++;},stroke(){calls.stroke++;},noFill(){},noStroke(){},strokeWeight(){},
    rect(){},ellipse(){},line(){},arc(){},quad(){},triangle(){},text(){},image(){calls.img++;},
    beginShape(){calls.shape++;},vertex(){},endShape(){},curveVertex(){},
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
  width: 1200, height: 800, frameCount: 100, deltaTime: 16, mouseX:0, mouseY:0,
  windowWidth:1200, windowHeight:800, touches: [], keyCode:0, key:'',
  frameRate(){ return 60; },
  dist(x1,y1,x2,y2){ return Math.hypot(x2-x1,y2-y1); },
  lerp(a,b,t){ return a+(b-a)*t; },
  constrain(v,a,b){ return v<a?a:v>b?b:v; },
  map(v,a,b,c,d){ return c+(d-c)*((v-a)/(b-a)); },
  max: Math.max, min: Math.min, abs: Math.abs, floor: Math.floor, ceil: Math.ceil,
  round: Math.round, sqrt: Math.sqrt, pow: Math.pow, atan2: Math.atan2,
  sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, sq(v){return v*v;},
  color(){ return {}; }, red(){return 0;}, green(){return 0;}, blue(){return 0;},
  loadImage(){ return {}; }, loadSound(){ return {}; }, loadFont(){ return {}; },
  localStorage: { getItem(){return null;}, setItem(){}, removeItem(){} },
  AudioContext: function(){ return { state:'running', resume(){}, currentTime:0,
    createOscillator(){return{type:'',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}};},
    createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};},
    createBuffer(){return{getChannelData(){return new Float32Array(10);}};},
    createBufferSource(){return{buffer:null,connect(){},start(){}};},
    createBiquadFilter(){return{type:'',frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};},
    destination:{}, sampleRate:44100 };},
};
// every p5 drawing call the file makes in global mode
for (const fn of ['push','pop','translate','rotate','scale','fill','noFill','stroke','noStroke',
  'strokeWeight','rect','ellipse','line','arc','quad','triangle','point','text','image',
  'beginShape','vertex','endShape','curveVertex','bezier','textAlign','textSize','textLeading',
  'textFont','background','clear','smooth','noSmooth','tint','noTint','rectMode','ellipseMode',
  'imageMode','angleMode','blendMode','cursor','noCursor','saveCanvas','strokeCap','strokeJoin',
  'drawingContext','shearX','shearY','applyMatrix','resetMatrix','erase','noErase','circle','square']) {
  if (!(fn in ctx)) ctx[fn] = function(){};
}
ctx.drawingContext = mkG().drawingContext;
ctx.document = { addEventListener(){}, removeEventListener(){}, body:{}, getElementById(){return null;},
  createElement(){ return { getContext(){ return {}; }, style:{}, appendChild(){} }; } };
ctx.navigator = { userAgent: 'node', maxTouchPoints: 0 };
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

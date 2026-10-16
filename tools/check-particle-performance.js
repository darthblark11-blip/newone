// Particle allocation, recycling, simulation and Canvas parity against the
// version before battle optimization. Optional PARTICLE_BASELINE overrides it.
// VIS_DEPS points at the external p5/playwright installation.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
let checks = 0;
function check(label, value) { assert(value, label); checks++; }
const baseline = process.env.PARTICLE_BASELINE
  ? fs.readFileSync(process.env.PARTICLE_BASELINE, 'utf8')
  : execFileSync('git', ['show', '3787c16:game.js'], {cwd:path.join(__dirname,'..'),encoding:'utf8',maxBuffer:8*1024*1024});
const temporary = path.join(os.tmpdir(), 'particle-baseline-' + process.pid + '.js');
fs.writeFileSync(temporary, baseline);
const harnessPath = require.resolve('./harness');
function harness(file) {
  const saved = process.env.GAME_JS;
  process.env.GAME_JS = file;
  delete require.cache[harnessPath];
  const h = require(harnessPath);
  if (saved === undefined) delete process.env.GAME_JS; else process.env.GAME_JS = saved;
  let seed = 723496, draws = 0;
  h.ctx.random = (a,b) => {
    draws++; seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    const v = seed / 4294967296;
    if (a === undefined) return v;
    if (Array.isArray(a)) return a[(v*a.length)|0];
    return b === undefined ? a*v : a+(b-a)*v;
  };
  h.draws = () => draws;
  h.probe(`doTick=true;viewLeft=-200;viewRight=200;viewTop=-150;viewBottom=150;
    particles=[];_particlePool.length=0;
    window.__kinds=['WOUND_BLOOD','FLASH','MUZZLE','THRUST','SPARK','FLECK','OIL','GORE','CHIP','BONE','EXPLOSION','SMOKE','BLOOD','CUSTOM'];`);
  return h;
}
try {
  const before = harness(temporary), after = harness(path.join(__dirname,'../game.js'));
  const tick = `(function(){
    for(let i=0;i<__kinds.length;i++) emit((frameCount%9)*31-140, (i%7)*43-120, 3, color(i*15,180-i*9,50+i*10), __kinds[i],i*.17,-i*.11);
    if(frameCount%17===0) doTick=false; else doTick=true;
    updateParticles();frameCount++;
    return JSON.stringify({pool:_particlePool.length,particles:particles.map(p=>[p.x,p.y,p.vx,p.vy,p.sz,p.l,p.a,p.t,p.c.levels])});
  })()`;
  for(let f=0;f<220;f++) {
    assert.strictEqual(after.probe(tick),before.probe(tick),'particle simulation/reuse at frame '+f);
    assert.strictEqual(after.draws(),before.draws(),'random stream at frame '+f);
    assert.deepStrictEqual(after.calls,before.calls,'draw order/geometry at frame '+f);
  }
  check('220 frames preserve all particle types, pause, RNG, order and pool reuse',true);
  const alive = after.probe(`particles.every(p=>p.a>0)`);
  check('retirement leaves only live particles',alive);
} finally { fs.unlinkSync(temporary); }

(async()=>{
  const deps=process.env.VIS_DEPS||path.join(__dirname,'..');
  const {chromium}=require(path.join(deps,'node_modules/playwright'));
  const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:640,height:420}});
    const originalShow=baseline.match(/Particle\.prototype\.show = function\(\) \{[\s\S]*?\n\}/)[0];
    await page.setContent(`<style>body{margin:0}</style>
      <script>Object.defineProperty(window,'localStorage',{value:{getItem(){return null},setItem(){},removeItem(){}}});</script>
      <script>${fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8')}</script>
      <script>${fs.readFileSync(path.join(__dirname,'../game.js'),'utf8')}</script>
      <script>window.__optimizedShow=Particle.prototype.show;${originalShow};window.__originalShow=Particle.prototype.show;Particle.prototype.show=__optimizedShow;
        preload=function(){};setup=function(){createCanvas(640,420);pixelDensity(1);noLoop();window.__ready=true;};</script>`);
    await page.waitForFunction('__ready');
    const result=await page.evaluate(()=>{
      randomSeed(35217);
      const types=['WOUND_BLOOD','FLASH','MUZZLE','THRUST','SPARK','FLECK','OIL','GORE','CHIP','BONE','EXPLOSION','SMOKE','BLOOD'];
      const ps=[];
      for(let i=0;i<260;i++){
        const p=new Particle(random(640),random(420),color(70+(i%11)*16,40+(i%7)*24,30+(i%5)*36),types[i%types.length],2,-3);
        p.a=[255,195,135,75,15][i%5];ps.push(p);
      }
      const inst=_renderer._pInst, oldColor=inst.color;
      let fresh=0;
      inst.color=function(){if(!(arguments[0] instanceof p5.Color))fresh++;return oldColor.apply(this,arguments);};
      const paint=(show,scene)=>{
        background(21,32,43);push();
        if(scene===1){translate(18.723,12.813);rotate(.027);scale(.823,1.134);}
        if(scene===2){translate(31,11);scale(1.6,.65);drawingContext.globalAlpha=.43;}
        const prior=fresh;for(let i=ps.length-1;i>=0;i--)show.call(ps[i]);window.__particleFresh=fresh-prior;
        // A later p5 draw must see the same painter state and cache.
        rect(11,13,7,9);pop();
        return drawingContext.getImageData(0,0,640,420).data;
      };
      let mismatches=[];
      for(let scene=0;scene<3;scene++){
        const a=paint(__originalShow,scene),b=paint(__optimizedShow,scene);
        let n=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])n++;mismatches.push(n);
      }
      paint(__optimizedShow,0);fresh=0;paint(__optimizedShow,0);const cachedFresh=__particleFresh;
      fresh=0;paint(__originalShow,0);const originalFresh=__particleFresh;
      // Reuse tracks the RGB values, rather than the source object's identity.
      const c=color(32,45,67),a=particlePaint(c.levels,195),again=particlePaint(c.levels,195);
      c.setRed(200);const changed=particlePaint(c.levels,195);
      let modeMismatch=0;
      for(const opacity of [-45,0,15,128.3,255,300]){
        ps[0].t='BLOOD';ps[0].a=opacity;
        const old=paint(__originalShow,1),next=paint(__optimizedShow,1);
        for(let i=0;i<old.length;i++)if(old[i]!==next[i])modeMismatch++;
      }
      for(let i=0;i<PARTICLE_PAINT_MAX+200;i++)particlePaint([i&255,(i>>>8)&255,211],i%256);
      inst.color=oldColor;
      return {mismatches,modeMismatch,cachedFresh,originalFresh,reused:a===again,changed:a!==changed&&changed.levels[0]===200,size:_particlePaintCache.size,cap:PARTICLE_PAINT_MAX};
    });
    for(const [i,n]of result.mismatches.entries()) check('pixel-identical overlapping particles and painter state, transform '+i,n===0);
    check('pixel-identical fractional, transparent and clamped alpha',result.modeMismatch===0);
    check('solid particles allocate no new p5.Color objects after warmup',result.cachedFresh===0);
    check('the same baseline frame constructs colors per solid particle',result.originalFresh>150);
    check('identical RGB/alpha paints reuse their object',result.reused);
    check('a changed source color gets the correct paint',result.changed);
    check('paint cache remains bounded',result.size<=result.cap);
    console.log('Particle performance: '+checks+'/'+checks+' checks passed; p5.Color allocations per mixed frame '+result.originalFresh+' -> '+result.cachedFresh+'.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

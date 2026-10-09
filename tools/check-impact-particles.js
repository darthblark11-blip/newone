// Actual armor-hit emission plus a real Canvas pixel check for smooth spark
// falloff. Run with VIS_DEPS pointing to p5/playwright and VIS_CHROME if needed.
const assert = require('assert'), fs = require('fs'), path = require('path');
const { ctx, probe } = require('./harness');
let checks = 0;
const check = (label, condition) => { assert(condition, label); checks++; };
probe(`isStoryMode=false;townsData={};startAtLevel(1);started=true;doTick=true;
  activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();
  player.x=10000;player.y=10000;corpses=[];enemiesList=[];
  viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;`);
for (const type of ['ARMORED','ARMORED_STANDARD','SAUCER','SAUCER_RED','SNAIL_HYBRID','ROBOT']) {
  const hit = probe(`(function(){
    frameCount++;bullets=[];particles=[];
    const e=new Character(40,0,false,'${type}');e.hp=900;e.aimAngle=0;enemiesList=[e];
    const b=spawnBullet(0,0,0,true,'BODY',WEAPONS.PISTOL,player);
    for(let i=0;i<8&&b.active;i++)updateBullets();
    return {hp:e.hp,particles:particles.map(p=>({t:p.t,c:p.c.levels.slice(0,3),sz:p.sz,l:p.l}))};
  })()`);
  check(type+' actual hit still damages armor', hit.hp === 880);
  if (type === 'ROBOT') {
    check('robot metal streaks retain their existing emission', hit.particles.length === 9 && hit.particles.every(p=>p.t === 'FLECK'));
  } else if (type === 'ARMORED' || type === 'ARMORED_STANDARD') {
    const smoke = hit.particles.filter(p=>p.t === 'BLOOD_SMOKE');
    check(type+' body impacts emit blood smoke and keep five debris chips', smoke.length === 10 && hit.particles.filter(p=>p.t === 'CHIP').length === 5 && !hit.particles.some(p=>p.t === 'SPARK'));
    check(type+' blood smoke remains compact and short lived', smoke.every(p=>p.c.join(',') === '90,0,0' && p.sz >= 5 && p.sz <= 12 && p.l >= 10 && p.l <= 20));
  } else {
    const sparks = hit.particles.filter(p=>p.t === 'SPARK');
    check(type+' still emits ten sparks and five debris chips', sparks.length === 10 && hit.particles.filter(p=>p.t === 'CHIP').length === 5);
    check(type+' impact color, size, and lifespan are preserved', sparks.every(p=>p.c.join(',') === '255,150,0' && p.sz >= 5 && p.sz <= 12 && p.l >= 10 && p.l <= 20));
  }
}

(async () => {
  const deps = process.env.VIS_DEPS || path.join(__dirname, '..');
  const { chromium } = require(path.join(deps, 'node_modules/playwright'));
  const browser = await chromium.launch({executablePath:process.env.VIS_CHROME || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:800,height:480},deviceScaleFactor:1});
    await page.setContent(`<!doctype html><style>body{margin:0}</style>
      <script>Object.defineProperty(window,'localStorage',{value:{getItem(){return null},setItem(){},removeItem(){}}});</script>
      <script>${fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8')}</script>
      <script>${fs.readFileSync(path.join(__dirname,'../game.js'),'utf8')}</script>
      <script>window.preload=function(){};window.setup=function(){createCanvas(800,480);pixelDensity(1);noLoop();window.__ready=true;};</script>`);
    await page.waitForFunction('window.__ready');
    const result = await page.evaluate(() => {
      const drawSpark = (opacity) => {
        clear();
        const p = new Particle(64,64,color(255,150,0),'SPARK');
        p.sz=20;p.a=opacity;p.show();
        const data=drawingContext.getImageData(64,64,22,1).data;
        return Array.from({length:22},(_,i)=>data[i*4+3]);
      };
      const opaque=drawSpark(255),faded=drawSpark(128);
      // Check drawing leaves the surrounding canvas transform/alpha untouched.
      clear();drawingContext.save();drawingContext.translate(11,17);drawingContext.scale(1.25,.75);drawingContext.globalAlpha=.37;
      const before=drawingContext.getTransform();
      new Particle(0,0,color(255,150,0),'SPARK').show();
      const after=drawingContext.getTransform(),alpha=drawingContext.globalAlpha;
      drawingContext.restore();
      return {opaque,faded,balanced:['a','b','c','d','e','f'].every(k=>before[k]===after[k])&&Math.abs(alpha-.37)<1e-8};
    });
    check('a softened impact keeps a bright center', result.opaque[0] >= 240);
    check('the edge fades continuously instead of ending as a solid oval', new Set(result.opaque.filter(a=>a>0)).size >= 12);
    check('spark falloff stays monotonic from center to edge', result.opaque.every((a,i)=>i===0 || a <= result.opaque[i-1]+1));
    check('the falloff has no sharp alpha band', result.opaque.every((a,i)=>i===0 || result.opaque[i-1]-a < 55));
    check('the outer edge reaches fully transparent', result.opaque[19] === 0 && result.opaque[21] === 0);
    check('fading dims both the center and the halo', result.faded[0] < result.opaque[0] && result.faded[10] < result.opaque[10] && result.faded[10] > 0);
    check('particle drawing restores canvas state', result.balanced);

    await page.evaluate(() => {
      background(28,38,43);textAlign(CENTER,CENTER);noStroke();fill(236,231,210);textSize(23);
      text('ARMOR IMPACT SPARKS',400,35);textSize(15);fill(176,195,195);
      text('Previous solid edge',200,78);text('Smooth falloff and bright core',600,78);
      for(const [index,col] of [[255,150,0],[255,200,0],[0,200,255]].entries()) {
        const y=145+index*105;
        for(const [i,size] of [8,12,20].entries()) {
          const x=110+i*88;
          fill(...col);ellipse(x,y,size*3,size*3);
          const p=new Particle(x+400,y,color(...col),'SPARK');p.sz=size;
          push();translate(x+400,y);scale(3);p.x=p.y=0;p.show();pop();
        }
      }
      textSize(13);fill(176,195,195);text('Same impact colors and motion; shown at 3× size for edge inspection',400,448);
    });
    const out=process.env.IMPACT_OUT || path.join('/tmp','armor-impact-particles.png');
    await page.locator('canvas').first().screenshot({path:out});
    console.log('Armor impact particles: '+checks+'/'+checks+' checks passed. Preview: '+out);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

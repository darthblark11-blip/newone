// Real armor contacts use comic bursts and directional blood. Unrelated sparks
// retain their original falloff; native checks also inspect the new ink shapes.
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
    const spray=hit.particles.filter(p=>p.t==='HIT_BLOOD'),burst=hit.particles.filter(p=>p.t==='COMIC_IMPACT');
    check(type+' has denser directional blood and one coherent comic contact',spray.length===12&&burst.length===1&&hit.particles.length===13);
    check(type+' no longer emits smoke, gray chunks or old orange blobs',
      !hit.particles.some(p=>['CHIP','SMOKE','SPARK','BLOOD_SMOKE','ARMOR_IMPACT'].includes(p.t)));
    check(type+' spray and contact have finite compact geometry',
      hit.particles.every(p=>Number.isFinite(p.sz)&&p.sz>0&&p.sz<40&&p.l>0&&p.l<80));
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

    const comic=await page.evaluate(()=>{
      const burst=new Particle(64,64,color(90,0,0),'COMIC_IMPACT',20,0);burst.fxAge=2;burst.fxMaterial='ARMOR';
      const spray=new Particle(160,64,color(90,0,0),'HIT_BLOOD',20,0);spray.fxAge=2;
      const draw=alpha=>{clear();burst.a=alpha;burst.show();return Array.from(drawingContext.getImageData(40,40,48,48).data);};
      const full=draw(255),faded=draw(100);
      let yellow=0,light=0,ink=0,fullAlpha=0,fadedAlpha=0;
      for(let i=0;i<full.length;i+=4){
        const [r,g,b,a]=full.slice(i,i+4);fullAlpha+=a;fadedAlpha+=faded[i+3];
        if(a>100&&r>235&&g>150&&g<220&&b<55)yellow++;
        if(a>100&&r>235&&g>=220&&b<130)light++;
        if(a>100&&r<110&&g<90&&b<90)ink++;
      }
      const nativeEllipse=window.ellipse,nativeRandom=window.random;
      let ovals=0;window.ellipse=(...a)=>{ovals++;return nativeEllipse(...a);};
      window.random=()=>{throw Error('Impact painting consumed gameplay RNG');};
      try{for(let kind=0;kind<4;kind++){spray.fxKind=kind;spray.show();}burst.show();}
      finally{window.ellipse=nativeEllipse;window.random=nativeRandom;}
      // Freeze a single pose while checking the native context is restored.
      spray.fxKind=3;drawingContext.save();drawingContext.translate(11,17);drawingContext.scale(1.25,.75);drawingContext.globalAlpha=.37;
      const transform=drawingContext.getTransform();spray.show();burst.show();const after=drawingContext.getTransform(),alpha=drawingContext.globalAlpha;drawingContext.restore();
      const pose=JSON.stringify([burst,spray]);spray.show();burst.show();
      return {yellow,light,ink,fullAlpha,fadedAlpha,ovals,unchanged:pose===JSON.stringify([burst,spray]),
        balanced:['a','b','c','d','e','f'].every(k=>transform[k]===after[k])&&Math.abs(alpha-.37)<1e-8};
    });
    check('comic contact has saturated yellow lobes, a light yellow core and a hard ink rim',comic.yellow>8&&comic.light>8&&comic.ink>8);
    check('comic contact fades across its whole native footprint',comic.fadedAlpha>0&&comic.fadedAlpha<comic.fullAlpha);
    check('new spray and comic contact use shaped ink instead of repeated ovals',comic.ovals===0);
    check('native painting never advances the impact pose',comic.unchanged);
    check('new impact painters preserve Canvas transforms and opacity',comic.balanced);

    await page.evaluate(() => {
      background(28,38,43);textAlign(CENTER,CENTER);noStroke();fill(236,231,210);textSize(23);
      text('COMIC CONTACT / DIRECTIONAL BLOOD',400,35);textSize(14);fill(176,195,195);
      text('Hard ink rim and bright impact core',210,75);text('Torn ribbons, fans and sharp streaks',610,75);
      for(let row=0;row<3;row++){
        const age=[1,4,8][row],y=140+row*105;
        const p=new Particle(0,0,color(90,0,0),'COMIC_IMPACT',25,0);p.fxAge=age;p.sz=15;
        push();translate(200,y);scale(2.6);p.show();pop();
        for(let kind=0;kind<4;kind++){
          const blood=new Particle(0,0,color(90,0,0),'HIT_BLOOD',25,0);
          blood.fxKind=kind;blood.fxAngle=0;blood.fxAge=age;blood.sz=3;
          push();translate(460+kind*88,y);scale(2.6);blood.show();pop();
        }
      }
      textSize(13);fill(176,195,195);text('Shown at 2.6×; continuous wound spray and floor puddles keep their existing rendering',400,448);
    });
    const out=process.env.IMPACT_OUT || path.join('/tmp','armor-impact-particles.png');
    await page.locator('canvas').first().screenshot({path:out});
    console.log('Armor impact particles: '+checks+'/'+checks+' checks passed. Preview: '+out);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

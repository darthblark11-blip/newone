// Actual projectile impacts, armor boundaries, pooled blood smoke and the
// robot's complete charge/burst. Set VIS_DEPS for optional real Canvas checks.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {ctx, probe} = require('./harness');
let checks = 0;
function check(label, condition) { assert(condition, label); checks++; }
function read(code) { return JSON.parse(probe('JSON.stringify('+code+')')); }
ctx.setTimeout = () => 0;
probe(`isStoryMode=false;townsData={};startAtLevel(2);started=true;doTick=true;
  buildings=[];activeBuildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();
  player.x=10000;player.y=10000;corpses=[];enemiesList=[];
  leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
  viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;`);

function hit(type, kind, hp, weapon='PISTOL') {
  return read(`(function(){
    frameCount++;bullets=[];particles=[];corpses=[];
    const e=new Character(40,0,false,${JSON.stringify(type)});
    e.hp=${hp};e.aimAngle=0;e.isNeutral=false;e.isFriendly=false;enemiesList=[e];
    const b=spawnBullet(0,0,0,true,${JSON.stringify(kind)},WEAPONS.${weapon},player);
    for(let i=0;i<8&&b.active;i++)updateBullets();
    return {hp:e.hp,headHP:e.headHP,decals:e.decals.map(d=>d.isHead),
      vx:b.vx,vy:b.vy,particles:particles.map(p=>({t:p.t,c:p.c.levels.slice(0,3),sz:p.sz,l:p.l,vx:p.vx,vy:p.vy}))};
  })()`);
}
const of = (result,type) => result.particles.filter(p=>p.t===type);
for (const [type, initial, boundary] of [['ARMORED',600,300],['ARMORED_STANDARD',300,50]]) {
  for (const hp of [initial,boundary+1]) {
    const r=hit(type,'BODY',hp),smoke=of(r,'BLOOD_SMOKE');
    check(type+' body damage at HP '+hp,r.hp===hp-20);
    check(type+' replaces orange impacts without adding particles at HP '+hp,
      smoke.length===10 && r.particles.length===15 && of(r,'SPARK').length===0);
    check(type+' retains existing debris at HP '+hp,of(r,'CHIP').length===5 && of(r,'CHIP').every(p=>p.c.join(',')==='100,100,100'));
    check(type+' smoke is blood colored, compact and short lived at HP '+hp,
      smoke.every(p=>p.c.join(',')==='90,0,0' && p.sz>=5 && p.sz<=12 && p.l>=10 && p.l<=20));
    check(type+' blood smoke follows the incoming shot at HP '+hp,
      smoke.every(p=>Math.abs(p.vx-r.vx*.15)<=1.5 && Math.abs(p.vy-r.vy*.15)<=1.5));
    check(type+' retains body bullet holes at HP '+hp,r.decals.length===1 && r.decals[0]===false);
  }
  const exposed=hit(type,'BODY',boundary);
  check(type+' exact armor boundary keeps ordinary blood',of(exposed,'BLOOD').length===8 && !of(exposed,'BLOOD_SMOKE').length && !of(exposed,'FLECK').length);
  const helmet=hit(type,'HEAD',initial),flecks=of(helmet,'FLECK');
  check(type+' head damage remains unchanged',helmet.hp===initial-(type==='ARMORED'?200:100));
  check(type+' helmet uses robot spark count/color',flecks.length===9 && flecks.every(p=>p.c.join(',')==='255,214,140'));
  check(type+' helmet keeps directional robot streaks',flecks.every(p=>p.sz>=1.4 && p.sz<=3.2 && p.l>=6 && p.l<=16 && Math.abs(p.vx-helmet.vx*.35)<=7 && Math.abs(p.vy-helmet.vy*.35)<=7));
  check(type+' helmet keeps debris and head holes',of(helmet,'CHIP').length===5 && helmet.decals.length===1 && helmet.decals[0]===true);
  check(type+' helmet emits neither oval sparks nor blood smoke',!of(helmet,'SPARK').length && !of(helmet,'BLOOD_SMOKE').length);
  const crossingHead=hit(type,'HEAD',boundary+1);
  check(type+' threshold-crossing headshot still strikes the helmet',of(crossingHead,'FLECK').length===9 && !of(crossingHead,'SPARK').length && !of(crossingHead,'BLOOD_SMOKE').length);
  const bare=hit(type,'HEAD',boundary);
  check(type+' head at exact armor boundary keeps ordinary blood',of(bare,'BLOOD').length>=8 && !of(bare,'FLECK').length && !of(bare,'BLOOD_SMOKE').length);
}
for(const type of ['SAUCER','SAUCER_RED','SNAIL_HYBRID']) {
  const r=hit(type,'BODY',900);
  check(type+' keeps existing armor effects',r.hp===880 && of(r,'SPARK').length===10 && of(r,'CHIP').length===5 && !of(r,'BLOOD_SMOKE').length);
}
for(const type of ['NM0_GREY_FATIGUE','NM0_CITY_GUARD','NORMAL']) {
  const r=hit(type,'HEAD',900);
  check(type+' keeps existing head effects',r.hp===(type==='NM0_CITY_GUARD'?845:800) && of(r,'BLOOD').length===8 && !of(r,'FLECK').length && !of(r,'BLOOD_SMOKE').length);
}
const robotBody=hit('ROBOT','BODY',900);
check('robot chassis effects remain unchanged',robotBody.hp===880 && of(robotBody,'FLECK').length===9 && robotBody.particles.length===9);
const robotHead=hit('ROBOT','HEAD',900);
check('robot head retains its separate health pool and spark emissions',robotHead.hp===900 && robotHead.headHP===50 && of(robotHead,'FLECK').length===11 && robotHead.particles.length===11);

const pool=read(`(function(){
  particles=[];_particlePool.length=0;
  const old=newParticle(3,4,color(60),'SMOKE');old.a=0;particles.push(old);updateParticles();
  const p=newParticle(7,8,color(90,0,0),'BLOOD_SMOKE',20,-10);
  const reused=p===old,reset=p.x===7&&p.y===8&&p.t==='BLOOD_SMOKE'&&p.a===255&&p.c.levels[0]===90;
  p.l=1;p.update();const firstAlpha=p.a;
  particles.push(p);for(let i=0;i<5;i++)updateParticles();
  const retired=particles.length===0&&_particlePool.length===1;
  const next=newParticle(0,0,color(90,0,0),'BLOOD_SMOKE');
  return {reused,reset,firstAlpha,retired,nextReused:next===p};
})()`);
check('blood smoke reuses an existing particle',pool.reused);
check('blood smoke fully resets pooled state',pool.reset);
check('blood smoke fades by 60 after its lifetime',pool.firstAlpha===195);
check('blood smoke retires and returns to the same bounded pool',pool.retired && pool.nextReused);

const charge=read(`(function(){
  player.x=300;player.y=0;bullets=[];particles=[];buildings=[];activeBuildings=[];
  const e=new Character(0,0,false,'ROBOT');enemiesList=[e];
  e.chargeTimer=ROBOT_CHARGE;e.cachedTargetDist=300;e.cachedCanSee=true;e.cachedTargetAngle=0;
  const x=e.x,y=e.y;
  for(let i=0;i<ROBOT_CHARGE;i++){frameCount++;e.updateEnemy();}
  const ready=e.chargeTimer===0&&e.burstLeft===ROBOT_BURST;
  const stationary=e.x===x&&e.y===y&&!e.isMoving;
  const chargeParticles=particles.length;
  for(let i=0;i<=ROBOT_BURST_GAP;i++){frameCount++;e.updateEnemy();}
  return {ready,stationary,chargeParticles,beams:bullets.filter(b=>b.active&&b.isOrangeBeam).length,
    muzzle:particles.filter(p=>p.t==='MUZZLE').length,other:particles.filter(p=>p.t!=='MUZZLE').length,
    completed:e.burstLeft===0&&e.fireCooldownR===ROBOT_COOLDOWN};
})()`);
check('robot charge produces no sparks',charge.chargeParticles===0);
check('robot retains full charge timing and holds position',charge.ready && charge.stationary);
check('robot still fires its two beams and muzzle effects',charge.beams===2 && charge.muzzle===10 && charge.other===0);
check('robot still enters burst cooldown',charge.completed);
const cancel=read(`(function(){
  bullets=[];particles=[];player.x=300;player.y=0;
  const e=new Character(0,0,false,'ROBOT');enemiesList=[e];
  e.chargeTimer=60;e.cachedTargetDist=300;e.cachedCanSee=true;e.cachedTargetAngle=0;
  buildings=[{x:150,y:0,w:40,h:80}];activeBuildings=buildings;invalidateColIndex();
  frameCount+=(e.aiOffset-frameCount%10+10)%10;e.updateEnemy();
  return {timer:e.chargeTimer,cooldown:e.fireCooldownR,see:e.cachedCanSee,bullets:bullets.length,particles:particles.length};
})()`);
check('blocked sight still cancels robot charging',cancel.timer===0 && cancel.cooldown===20 && cancel.see===false && cancel.bullets===0 && cancel.particles===0);
const playerCharge=read(`(function(){
  buildings=[];activeBuildings=[];enemiesList=[];particles=[];
  chemistSuitUnlocked=true;cannonInputHeld=true;player.cannonCharge=120;
  rightStick.active=true;rightStick.dist=1;
  player.isArmed=true;player.aimHold=14;player.meleeTimer=0;player.reloadTimer=0;player.muzzleFlash=0;
  frameCount+=((3-frameCount%3)%3);player.show();
  chemistSuitUnlocked=false;cannonInputHeld=false;rightStick.active=false;
  return particles.filter(p=>p.t==='SPARK').length;
})()`);
check('player chemist charging spark remains unchanged',playerCharge===1);

async function canvasChecks() {
  const deps=process.env.VIS_DEPS||path.join(__dirname,'..');
  const {chromium}=require(path.join(deps,'node_modules/playwright'));
  const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:640,height:320},deviceScaleFactor:1});
    await page.setContent(`<style>body{margin:0}</style>
      <script>Object.defineProperty(window,'localStorage',{value:{getItem(){return null},setItem(){},removeItem(){}}});</script>
      <script>${fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8')}</script>
      <script>${fs.readFileSync(path.join(__dirname,'../game.js'),'utf8')}</script>
      <script>preload=function(){};setup=function(){createCanvas(640,320);pixelDensity(1);noLoop();window.__ready=true;};</script>`);
    await page.waitForFunction('__ready');
    const r=await page.evaluate(()=>{
      const p=new Particle(64,64,color(90,0,0),'BLOOD_SMOKE');p.sz=12;
      const draw=(alpha)=>{clear();p.a=alpha;p.show();const d=drawingContext.getImageData(64,64,12,1).data;return Array.from({length:12},(_,i)=>d[i*4+3]);};
      const full=draw(255),faded=draw(135);
      clear();drawingContext.save();drawingContext.translate(11.3,17.8);drawingContext.scale(1.2,.75);drawingContext.globalAlpha=.37;
      const before=drawingContext.getTransform();p.show();const after=drawingContext.getTransform();const alpha=drawingContext.globalAlpha;drawingContext.restore();
      return {full,faded,balanced:['a','b','c','d','e','f'].every(k=>before[k]===after[k])&&Math.abs(alpha-.37)<1e-8};
    });
    check('blood smoke has a continuous soft radial edge',new Set(r.full.filter(a=>a>0)).size>=5 && r.full.every((a,i)=>i===0||a<=r.full[i-1]+1) && r.full[10]===0);
    check('blood smoke fades its center and edge together',r.faded[0]<r.full[0] && r.faded[3]<r.full[3] && r.faded[3]>0);
    check('blood smoke restores the real Canvas transform and opacity',r.balanced);
    await page.evaluate(()=>{
      background(28,38,43);textAlign(CENTER,CENTER);noStroke();fill(236,231,210);textSize(19);
      text('NM-0 ARMORED IMPACTS',320,30);textSize(14);text('Body: blood smoke and debris',160,74);text('Helmet: robot metal sparks',480,74);
      randomSeed(45);
      for(let i=0;i<10;i++){
        const p=new Particle(150+random(-8,8),175+random(-8,8),color(90,0,0),'BLOOD_SMOKE',25,0);
        push();translate(160,175);scale(3);p.x-=160;p.y-=175;p.show();pop();
      }
      for(let i=0;i<9;i++){
        const p=new Particle(480+random(-8,8),175+random(-8,8),color(...SPARK_COL),'FLECK',25,0);
        push();translate(480,175);scale(3);p.x-=480;p.y-=175;p.show();pop();
      }
      fill(176,195,195);textSize(13);text('Shown at 3× size; charge orb remains, charging sparks removed',320,283);
    });
    const out=process.env.ARMORED_EFFECTS_OUT||'/tmp/armored-impact-effects.png';
    await page.locator('canvas').first().screenshot({path:out});
    console.log('Preview: '+out);
  } finally {await browser.close();}
}
(async()=>{
  if(process.env.VIS_DEPS||process.argv.includes('--visual'))await canvasChecks();
  console.log('Armored impact effects: '+checks+'/'+checks+' checks passed.');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

// Actual comic projectile impacts, armor boundaries, pooled blood and the
// robot's complete charge/burst. Native painting is checked separately by
// check-impact-particles.js.
const assert = require('assert');
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
      vx:b.vx,vy:b.vy,particles:particles.map(p=>({t:p.t,c:p.c.levels.slice(0,3),sz:p.sz,l:p.l,vx:p.vx,vy:p.vy,material:p.fxMaterial}))};
  })()`);
}
const of = (result,type) => result.particles.filter(p=>p.t===type);
for (const [type, initial, boundary] of [['ARMORED',600,300],['ARMORED_STANDARD',300,50]]) {
  for (const hp of [initial,boundary+1]) {
    const r=hit(type,'BODY',hp),spray=of(r,'HIT_BLOOD'),burst=of(r,'COMIC_IMPACT');
    check(type+' body damage at HP '+hp,r.hp===hp-20);
    check(type+' body emits eight blood spray particles and one comic burst at HP '+hp,
      spray.length===8 && burst.length===1 && r.particles.length===9);
    check(type+' body impact removes smoke, debris and old orange effects at HP '+hp,
      !r.particles.some(p=>['SMOKE','CHIP','SPARK','BLOOD_SMOKE','ARMOR_IMPACT','BLOOD'].includes(p.t)));
    check(type+' spray has finite bounded geometry and lifetime at HP '+hp,
      spray.every(p=>[p.sz,p.l,p.vx,p.vy].every(Number.isFinite)&&p.sz>0&&p.sz<30&&p.l>0&&p.l<80));
    check(type+' blood paints over the comic flash at HP '+hp,
      r.particles.findIndex(p=>p.t==='HIT_BLOOD')<r.particles.findIndex(p=>p.t==='COMIC_IMPACT'));
    check(type+' comic contact records intact plate at HP '+hp,burst[0].material==='ARMOR');
    check(type+' retains body bullet holes at HP '+hp,r.decals.length===1 && r.decals[0]===false);
  }
  const exposed=hit(type,'BODY',boundary);
  check(type+' exact armor boundary uses flesh spray and comic feedback',of(exposed,'HIT_BLOOD').length===8 && of(exposed,'COMIC_IMPACT').length===1 && !of(exposed,'BLOOD_SMOKE').length && !of(exposed,'FLECK').length && !of(exposed,'ARMOR_IMPACT').length && !of(exposed,'CHIP').length);
  check(type+' boundary contact records exposed flesh',of(exposed,'COMIC_IMPACT')[0].material==='FLESH');
  const helmet=hit(type,'HEAD',initial),flecks=of(helmet,'FLECK');
  check(type+' head damage remains unchanged',helmet.hp===initial-(type==='ARMORED'?200:100));
  check(type+' helmet uses robot spark count/color',flecks.length===9 && flecks.every(p=>p.c.join(',')==='255,214,140'));
  check(type+' helmet keeps directional robot streaks',flecks.every(p=>p.sz>=1.4 && p.sz<=3.2 && p.l>=6 && p.l<=16 && Math.abs(p.vx-helmet.vx*.35)<=7 && Math.abs(p.vy-helmet.vy*.35)<=7));
  check(type+' helmet replaces gray debris with a comic burst and keeps head holes',!of(helmet,'CHIP').length && helmet.decals.length===1 && helmet.decals[0]===true && helmet.particles.length===10 && of(helmet,'COMIC_IMPACT').length===1 && !of(helmet,'ARMOR_IMPACT').length);
  check(type+' helmet emits neither oval sparks nor flesh spray',!of(helmet,'SPARK').length && !of(helmet,'BLOOD_SMOKE').length && !of(helmet,'HIT_BLOOD').length);
  const crossingHead=hit(type,'HEAD',boundary+1);
  check(type+' threshold-crossing headshot still strikes the helmet',of(crossingHead,'FLECK').length===9 && !of(crossingHead,'SPARK').length && !of(crossingHead,'BLOOD_SMOKE').length);
  const bare=hit(type,'HEAD',boundary);
  check(type+' head at exact armor boundary keeps ordinary blood',of(bare,'BLOOD').length>=8 && !of(bare,'FLECK').length && !of(bare,'BLOOD_SMOKE').length && !of(bare,'ARMOR_IMPACT').length);
  check(type+' exposed head gains one comic contact',of(bare,'COMIC_IMPACT').length===1);
}
for(const type of ['SAUCER','SAUCER_RED','SNAIL_HYBRID']) {
  const r=hit(type,'BODY',900);
  check(type+' keeps existing armor effects',r.hp===880 && of(r,'SPARK').length===10 && of(r,'CHIP').length===5 && !of(r,'BLOOD_SMOKE').length && !of(r,'ARMOR_IMPACT').length);
}
for(const type of ['NM0_GREY_FATIGUE','NM0_CITY_GUARD','NORMAL']) {
  const r=hit(type,'HEAD',900);
  check(type+' keeps existing head blood alongside comic contact',r.hp===(type==='NM0_CITY_GUARD'?845:800) && of(r,'BLOOD').length===8 && of(r,'COMIC_IMPACT').length===1 && !of(r,'HIT_BLOOD').length && !of(r,'FLECK').length && !of(r,'BLOOD_SMOKE').length && !of(r,'ARMOR_IMPACT').length);
  const flesh=hit(type,'BODY',900);
  check(type+' exposed body keeps damage and uses new spray and comic contact',flesh.hp===(type==='NM0_CITY_GUARD'?889:880)&&of(flesh,'HIT_BLOOD').length===8&&of(flesh,'COMIC_IMPACT').length===1&&flesh.particles.length===9);
}
const robotBody=hit('ROBOT','BODY',900);
check('robot chassis effects remain unchanged',robotBody.hp===880 && of(robotBody,'FLECK').length===9 && robotBody.particles.length===9);
const robotHead=hit('ROBOT','HEAD',900);
check('robot head retains its separate health pool and spark emissions',robotHead.hp===900 && robotHead.headHP===50 && of(robotHead,'FLECK').length===11 && robotHead.particles.length===11);

for(const [label,shield,immune] of [['shield only',100,false],['shield overflow',1,false],['immune flesh',0,true]]) {
  const r=read(`(()=>{const savedPlayer=player;frameCount++;bullets=[];particles=[];enemiesList=[];
    const target=new Character(40,0,true);target.hp=100;target.shield=${shield};player=target;
    inTownCutscene=${immune};const b=spawnBullet(0,0,0,false,'BODY',WEAPONS.PISTOL,{isPlayer:false});
    for(let i=0;i<8&&b.active;i++)updateBullets();inTownCutscene=false;player=savedPlayer;
    return {hp:target.hp,spray:particles.filter(p=>p.t==='HIT_BLOOD').length,comic:particles.filter(p=>p.t==='COMIC_IMPACT').length};})()`);
  check(label+' only produces flesh feedback for actual HP damage',
    shield===1?r.hp<100&&r.spray===8&&r.comic===1:r.hp===100&&r.spray===0&&r.comic===0);
}

for(const type of ['HIT_BLOOD','COMIC_IMPACT']) {
  const pool=read(`(()=>{
    particles=[];_particlePool.length=0;
    const old=newParticle(3,4,color(60),'SMOKE');old.a=0;particles.push(old);updateParticles();
    const owner={x:7,y:8,shovelLevel:currentLevel,shovelDepth:18,eType:'ARMORED_STANDARD'};
    const p=newParticle(7,8,color(90,0,0),${JSON.stringify(type)},20,-10,owner);
    const reset=p===old&&p.x===7&&p.y===8&&p.a===255&&p.t===${JSON.stringify(type)}&&p.shovelOwner===owner&&p.sz>0&&p.l>0&&p.fxAge===0;
    particles.push(p);for(let i=0;i<120;i++)updateParticles();
    const retired=particles.length===0&&_particlePool.length===1&&p.shovelOwner===null;
    const q=newParticle(11,12,color(90,0,0),'WOUND_BLOOD',3,-2);
    return {reset,retired,continuous:q===p&&q.sz===2.8&&q.vx===3&&q.vy===-2&&q.l===16&&q.fxSeed===0&&q.fxAge===0&&q.fxLife===0&&q.fxMaterial===''&&q.fxKind===0&&q.fxStretch===1&&q.shovelOwner===null};
  })()`);
  check(type+' resets an existing pooled particle',pool.reset);
  check(type+' retires and releases its owner',pool.retired);
  check(type+' safely reuses its record for original continuous bleeding',pool.continuous);
}

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

console.log('Armored comic impact, material, pool and robot checks: '+checks+'/'+checks+' passed.');

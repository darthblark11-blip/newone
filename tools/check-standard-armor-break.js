// Repeated shots keep the plate boundary while the comic contact changes from
// armor to flesh. Old orange blobs, smoke and debris never return.
const assert = require('node:assert/strict');
const { probe } = require('./harness');
const read = code => JSON.parse(probe('JSON.stringify(' + code + ')'));
probe(`isStoryMode=false;townsData={};startAtLevel(2);started=true;doTick=true;
       buildings=[];activeBuildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();
       player.x=10000;player.y=10000;corpses=[];enemiesList=[];
       viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;`);
const result = read(`(() => {
  const soldier = new Character(40,0,false,'ARMORED_STANDARD');
  soldier.aimAngle=0;soldier.isNeutral=false;soldier.isFriendly=false;
  enemiesList=[soldier];
  const initialHp=soldier.hp, hits=[];
  for(let i=0;i<14;i++) {
    frameCount++;bullets=[];particles=[];
    const before=soldier.hp;
    const b=spawnBullet(soldier.x-40,soldier.y,0,true,'BODY',WEAPONS.PISTOL,player);
    for(let frame=0;frame<8&&b.active;frame++)updateBullets();
    hits.push({before,after:soldier.hp,
      bursts:particles.filter(p=>p.t==='COMIC_IMPACT').length,
      material:particles.find(p=>p.t==='COMIC_IMPACT')?.fxMaterial,
      mist:particles.filter(p=>p.t==='BLOOD_SMOKE').length,
      blood:particles.filter(p=>p.t==='HIT_BLOOD').length,
      oldOrange:particles.filter(p=>p.t==='ARMOR_IMPACT'||p.t==='SPARK').length,
      debris:particles.filter(p=>p.t==='CHIP'||p.t==='SMOKE').length});
  }
  return {initialHp,hits};
})()`);
assert.equal(result.initialHp,300,'standard soldier health is unchanged');
assert.equal(result.hits.length,14,'all repeated shots execute');
for (const hit of result.hits) {
  assert.equal(hit.after,hit.before-20,'each shot actually hits for normal pistol damage');
  assert.equal(hit.debris,0,'no gray smoke or chips return on body hits');
  assert.equal(hit.oldOrange,0,'old orange blobs and sparks are replaced');
  assert.equal(hit.mist,0,'blood smoke is replaced by shaped spray');
  assert.equal(hit.bursts,1,'a hit produces one coherent comic burst');
  assert.equal(hit.blood,8,'a hit keeps the directional blood spray');
  if (hit.before>50) {
    assert.equal(hit.material,'ARMOR','intact plate produces the armor comic contact');
  } else {
    assert.equal(hit.material,'FLESH','spent armor produces the exposed-flesh contact');
  }
}
assert(result.hits.some(h=>h.before===60&&h.after===40&&h.material==='ARMOR'),
  'the shot that breaks the plate still strikes armor');
assert(result.hits.some(h=>h.before===40&&h.after===20&&h.material==='FLESH'),
  'the next shot strikes exposed flesh');
// The exact cutoff can be skipped by twenty-point damage, so test it directly.
for (const hp of [51,50]) {
  const hit=read(`(() => {
    const e=new Character(40,0,false,'ARMORED_STANDARD');
    e.hp=${hp};e.aimAngle=0;e.isNeutral=false;e.isFriendly=false;
    enemiesList=[e];frameCount++;bullets=[];particles=[];
    const b=spawnBullet(0,0,0,true,'BODY',WEAPONS.PISTOL,player);
    for(let i=0;i<8&&b.active;i++)updateBullets();
    return {hp:e.hp,bursts:particles.filter(p=>p.t==='COMIC_IMPACT').length,
      material:particles.find(p=>p.t==='COMIC_IMPACT')?.fxMaterial};
  })()`);
  assert.equal(hit.hp,hp-20);
  assert.equal(hit.bursts,1,'one comic burst marks either material');
  assert.equal(hit.material,hp>50?'ARMOR':'FLESH','exact fifty-HP armor boundary remains unchanged');
}
console.log('Standard armor break passed: 14 real hits, 300 HP, 50 HP cutoff, crossing shot and exposed flesh.');

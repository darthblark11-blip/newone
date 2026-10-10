// Exercise actual pooled projectile updates against wildlife and military
// cover. These assertions cross the collision integration boundary rather
// than merely repeating the wildlife quality formula.
const assert = require('assert');
const { ctx, probe } = require('./harness');
let checks = 0;
const run = source => probe(source);
function check(source, message) {
  assert.ok(run(source), message); checks++;
}
ctx.setTimeout = () => 0;
function reset() {
  run(`currentLevel=2;currentBiome=2;BIOME_ACTIVE=false;doTick=true;
    isStoryMode=false;isDead=false;isWin=false;nm0AmbushActive=false;
    bullets=[];enemiesList=[];barrels=[];buildings=[];activeBuildings=[];
    activeParkingCars=[];parkingCars=[];particles=[];corpses=[];splatter=[];
    fires=[];lightnings=[];orbs=[];resetForestWildlife();invalidateColIndex();
    viewLeft=-10000;viewRight=10000;viewTop=-10000;viewBottom=10000;
    player=new Character(-2000,-2000,true);player.hp=100000;player.shieldHP=100000;
    totalShotsFired=0;totalShotsHit=0;totalKills=0;`);
}
function target(species='ELK',x=36,y=0) {
  run(`window.huntTarget=wildlifeSpawnAnimal('${species}',${x},${y});
    huntTarget.angle=0;huntTarget.bodyR=WILDLIFE_SPECIES.${species}.size;
    huntTarget.headR=WILDLIFE_SPECIES.${species}.headR;`);
}
function shoot(weapon='BOW',aim='BODY',side=true) {
  run(`window.huntBullet=spawnBullet(0,0,0,${side},'${aim}',WEAPONS.${weapon},
    ${side?'player':'{x:-100,y:0,isPlayer:false,isFriendly:false}'});updateBullets();`);
}
reset();target();shoot();
check(`huntTarget.hp===huntTarget.maxHp-WEAPONS.BOW.bodyDmg&&huntTarget.shots===1`,
  'An actual arrow body hit damages wildlife once');
check(`!huntBullet.active&&huntBullet.l===0&&totalShotsHit===1`,
  'An animal impact retires the pooled arrow and records accuracy');
for(let heading=0;heading<8;heading++) {
  reset();target('GRIZZLY_BEAR',100,100);
  run(`huntTarget.angle=${heading}*PI/4;window.huntHead=wildlifeHeadPoint(huntTarget);
    window.huntBullet=spawnBullet(huntHead.x-20,huntHead.y,0,true,'HEAD',WEAPONS.BOW,player);
    updateBullets();`);
  check(`huntTarget.dead&&huntTarget.condition==='PERFECT'&&huntTarget.method==='BOW_HEAD'`,
    'Drawn head receives the instant PERFECT arrow kill at heading '+heading);
}
reset();target('ELK',20);shoot('TASER');
check(`huntTarget.state==='STUNNED'&&!huntTarget.dead&&huntTarget.hp===huntTarget.maxHp&&huntTarget.condition==='PERFECT'`,
  'A real taser projectile stuns a live animal in PERFECT condition');
check(`huntBullet.active&&huntBullet.retracting&&huntBullet.tetheredTarget===null`,
  'Wildlife stun retracts the taser without a Character-only tether');
run(`updateBullets();`);
check(`huntTarget.shots===0&&totalShotsHit===0`,
  'Retracting taser does not damage or repeatedly harvest a stunned animal');
reset();target('ELK',8);
run(`window.huntEnemy=new Character(14,0,false,'NORMAL');huntEnemy.hp=1000;
  huntEnemy.isFriendly=false;huntEnemy.isNeutral=false;enemiesList=[huntEnemy];`);
shoot('TASER','HEAD');
check(`huntTarget.state==='STUNNED'&&huntEnemy.state!=='STUNNED'&&huntEnemy.hp===1000&&
  huntBullet.retracting&&!huntBullet.tetheredTarget&&totalShotsHit===0`,
  'Nearest wildlife taser contact consumes the frame before an overlapping army actor');

// Each cover lies before a candidate animal on the SAME frame segment. Thin
// trunks and a crossed barrel expose endpoint-only ordering failures.
reset();target();
run(`activeBuildings=[{x:10,y:0,w:2,h:80}];buildColIndex();`);shoot();
check(`huntTarget.hp===huntTarget.maxHp&&!huntBullet.active&&huntBullet.x<12`,
  'A thin trunk between frame endpoints intercepts the arrow before wildlife');
reset();target();
run(`barrels=[{x:10,y:0,hp:200}];`);shoot();
check(`huntTarget.hp===huntTarget.maxHp&&barrels[0].hp===200-WEAPONS.BOW.bodyDmg&&!huntBullet.active`,
  'A crossed explosive barrel is struck before the animal behind it');
reset();target();
run(`activeParkingCars=[{x:-5,y:0}];parkingCars=activeParkingCars.slice();`);shoot();
check(`huntTarget.hp===huntTarget.maxHp&&!huntBullet.active`,
  'A parked car consumes the arrow before wildlife');
reset();target();
run(`window.huntEnemy=new Character(14,0,false,'NORMAL');huntEnemy.hp=1000;
  huntEnemy.isFriendly=false;huntEnemy.isNeutral=false;enemiesList=[huntEnemy];`);shoot();
check(`huntTarget.hp===huntTarget.maxHp&&huntEnemy.hp===1000-WEAPONS.BOW.bodyDmg&&!huntBullet.active`,
  'An enemy ahead of the animal receives the arrow instead');
reset();target();
run(`window.huntEnemy=new Character(-36,0,false,'ARMORED');huntEnemy.hp=1000;
  huntEnemy.isFriendly=false;huntEnemy.isNeutral=false;enemiesList=[huntEnemy];`);shoot();
check(`huntTarget.hp===huntTarget.maxHp&&huntEnemy.hp<1000&&!huntBullet.active`,
  'Large actor cover at segment start is found even outside the ordinary endpoint query');
for(const transparent of ['isRiver','isDeck','isGrassLot']) {
  reset();target();
  run(`activeBuildings=[{x:10,y:0,w:2,h:80,${transparent}:true}];buildColIndex();`);shoot();
  check(`huntTarget.hp<huntTarget.maxHp`, transparent+' does not falsely block hunting');
}
reset();target();
run(`activeBuildings=[{x:10,y:0,w:2,h:80,isGovFortress:true,hp:0}];
  window.huntOldGateway=inOpenGateway;inOpenGateway=()=>true;buildColIndex();`);shoot();
check(`huntTarget.hp<huntTarget.maxHp`, 'An open fortress gateway remains passable to arrows');
run(`inOpenGateway=window.huntOldGateway;`);

reset();target('MULE_DEER',10);
shoot('PISTOL','HEAD',false);
check(`huntTarget.hp<huntTarget.maxHp&&huntTarget.shots===1`,
  'Enemy crossfire can hit wildlife without placing animals in the enemy list');
check(`enemiesList.length===0&&totalKills===0`,
  'Wildlife casualties do not change army objectives or military kills');
reset();target('GRIZZLY_BEAR',55);
run(`player.x=0;player.y=0;player.aimAngle=0;player.currentWeapon=WEAPONS.SHOTGUN;
  player.ammo=6;headAimToggle=true;player.fire(0);
  window.huntPelletIds=bullets.map(b=>b.shotId);updateBullets();`);
check(`huntPelletIds.length===4&&new Set(huntPelletIds).size===1&&huntTarget.shots===1`,
  'All four pellets from Character.fire share one hunting trigger ID');

reset();target('ELK',30);
run(`triggerRocketExplosion(0,0,true);`);
check(`huntTarget.dead&&huntTarget.condition==='BAD'&&huntTarget.method==='EXPLOSIVE'`,
  'Rocket splash damages wildlife and yields scraps');
reset();target('ELK',30);
run(`triggerExplosion(0,0,180,false,true);`);
check(`huntTarget.dead&&huntTarget.condition==='BAD'&&huntTarget.method==='EXPLOSIVE'`,
  'Grenades and barrel explosions also damage wildlife and yield scraps');
reset();target('ELK',1000);
run(`triggerExplosion(0,0,180,false,false);`);
check(`huntTarget.hp===huntTarget.maxHp`, 'Explosion damage respects its bounded radius');

// A reused slot must become an ordinary round again: no arrow visuals,
// shortened lifetime, old shooter, old trigger ID, or leftover taser state.
reset();shoot();
run(`window.huntRetired=huntBullet;huntBullet.active=false;
  window.huntOldShot=huntBullet.shotId;
  window.huntReused=spawnBullet(500,500,PI/4,false,'BODY',WEAPONS.PISTOL,{tag:'hostile'});`);
check(`huntRetired===huntReused&&!huntReused.isArrow&&!huntReused.isTaser&&
  huntReused.l===120&&!huntReused.retracting&&!huntReused.tetheredTarget&&
  huntReused.shotId!==huntOldShot&&huntReused.shooter.tag==='hostile'`,
  'Arrow pool reuse completely restores normal bullet identity');
reset();shoot();
run(`for(let i=1;i<90;i++)updateBullets();`);
check(`!huntBullet.active&&huntBullet.l===0&&Math.abs(huntBullet.x-28*90)<1e-6`,
  'An unimpeded arrow expires at its finite travel range');
console.log(`${checks}/${checks} hunting ballistics checks passed.`);

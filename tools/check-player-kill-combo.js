// Personal combo credit follows the killing attack, independently of its team.
// Exercise actual projectile and delayed blast paths as well as campaign counters.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness');
const P = expression => probe('(' + expression + ')');
let checks = 0, pending = [];
ctx.setTimeout = (callback, delay) => { pending.push({callback,delay}); return pending.length; };
const ok = (name, condition) => { assert(condition,name); checks++; console.log('  ok   '+name); };
function stage() {
  pending=[];
  probe(`currentLevel=currentBiome=2;isStoryMode=false;BIOME_ACTIVE=false;
    authoredCore=null;nm0AmbushActive=farmAmbushActive=false;isDead=isWin=killcamMode=false;
    townsData={};window.outpostForts={};window.ambushSpawnsRemaining=0;
    started=doTick=true;buildings=[];activeBuildings=[];barrels=[];activeParkingCars=[];
    parkingCars=[];bullets=[];particles=[];corpses=[];enemiesList=[];weaponDrops=[];
    invalidateColIndex();viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;
    player=new Character(1000,1000,true);score=1000;consecutiveKills=4;comboTimer=33;
    totalKills=0;MAX_KILLS=1000;floatingScores=[];
    window.__ally=new Character(1000,900,false,'NORMAL');
    window.__ally.isFriendly=true;window.__ally.isNeutral=false;
    window.__victim=new Character(40,0,false,'NORMAL');
    window.__victim.hp=20;window.__victim.isFriendly=false;window.__victim.isNeutral=false;
    enemiesList=[window.__victim];useBloodBank(2);`);
}
function shot(source, weapon='PISTOL') {
  probe(`{frameCount++;const shot=spawnBullet(window.__victim.x-40,window.__victim.y,
    0,true,'BODY',WEAPONS.${weapon},${source});
    for(let i=0;i<8&&shot.active;i++)updateBullets();}`);
}
stage();shot('window.__ally');
ok('an allied bullet really kills its target',P('window.__victim.dead && window.__victim.hp<=0'));
ok('an ally kill neither increments nor refreshes the player combo',P('consecutiveKills===4 && comboTimer===33'));
ok('team kills retain a flat score reward and ordinary progression',P('score===1005 && totalKills===1'));
stage();shot('player');
ok('a player bullet advances the combo and multiplier',P('consecutiveKills===5 && comboTimer===100 && score===1025 && totalKills===1'));

stage();probe('window.__victim.hp=40;');shot('player');
ok('the setup player shot wounds without killing',P('window.__victim.hp===20 && !window.__victim.dead'));
shot('window.__ally');
ok('an ally finishing a player-wounded enemy does not steal combo credit',P('consecutiveKills===4 && comboTimer===33 && score===1005'));
stage();probe('window.__victim.hp=40;');shot('window.__ally');shot('player');
ok('the player finishing an ally-wounded enemy earns the combo',P('consecutiveKills===5 && comboTimer===100 && score===1025'));

stage();probe('window.__victim.isAmbush=true;nm0AmbushActive=true;nm0AmbushKills=3;');shot('window.__ally');
ok('ally kills still drain the NM-0 ambush counter without changing personal combo',P('nm0AmbushKills===2 && totalKills===0 && consecutiveKills===4 && comboTimer===33'));
stage();probe(`farmAmbushActive=true;window.farmAmbushKills=3;
  window.__victim.eType='BUG';window.__victim.dead=true;
  processKill(40,0,false,'BUG',false,window.__victim,window.__ally);`);
ok('ally pest kills retain farm progress and base rewards',P('window.farmAmbushKills===2 && score===1002 && consecutiveKills===4 && comboTimer===33'));
stage();probe(`processKill(40,0,false,'MILITARY_NEUTRAL',false,window.__victim,window.__ally);`);
ok('outpost rewards cannot extend the player combo through an ally',P('score===1005 && consecutiveKills===4 && comboTimer===33'));

stage();probe('window.__victim.hp=100;');shot('window.__ally','ROCKET_LAUNCHER');
ok('an actual allied rocket kills without building player combo',P('window.__victim.dead && consecutiveKills===4 && comboTimer===33 && totalKills===1'));
stage();probe(`parkingCars=[{x:0,y:0}];window.__victim.x=140;
  triggerExplosion(0,0,100,false,true,window.__ally);`);
ok('a car chain schedules a delayed blast',pending.some(p=>p.delay>=100&&p.delay<=250));
const chain=pending.find(p=>p.delay>=100&&p.delay<=250);chain.callback();
ok('delayed car blast keeps ally ownership and still kills enemies',P('window.__victim.dead && totalKills===1 && consecutiveKills===4 && comboTimer===33'));

stage();probe(`barrels=[{x:40,y:0,hp:20}];window.__victim.x=100;
  const barrelShot=spawnBullet(0,0,0,true,'BODY',WEAPONS.PISTOL,window.__ally);
  for(let i=0;i<8&&barrelShot.active;i++)updateBullets();`);
ok('barrel damage retains the shooter for its deferred detonation',P('barrels[0].hp<=0 && barrels[0].killSource===window.__ally'));
probe(`const laterBarrelShot=spawnBullet(0,0,0,true,'BODY',WEAPONS.PISTOL,player);
  for(let i=0;i<8&&laterBarrelShot.active;i++)updateBullets();`);
ok('a later hit on the destroyed barrel cannot overwrite the lethal owner',P('barrels[0].killSource===window.__ally'));
probe('triggerExplosion(barrels[0].x,barrels[0].y,160,false,true,barrels[0].killSource);');
ok('the allied barrel explosion cannot add player combo',P('window.__victim.dead && totalKills===1 && consecutiveKills===4 && comboTimer===33'));

stage();probe(`window.__robot=new Character(0,0,false,'ROBOT');
  window.__victim.x=60;robotDeathBurst(window.__robot,0,true,0,window.__ally);`);
const fuse=pending.find(p=>p.delay>=70&&p.delay<=150);ok('robot death blast is deferred',!!fuse);fuse.callback();
ok('robot chain blast retains ally ownership',P('window.__victim.dead && consecutiveKills===4 && comboTimer===33'));

stage();probe(`window.__victim.takeDamage(100,window.__ally);
  processKill(40,0,false,'NORMAL',false,window.__victim);`);
ok('deferred death dispatch can recover its last damage owner',P('consecutiveKills===4 && comboTimer===33'));
stage();probe(`window.__victim.takeDamage(1,window.__ally);
  window.__victim.takeDamage(100);
  processKill(40,0,false,'NORMAL',false,window.__victim);`);
ok('a legacy player attack clears any stale allied damage owner',P('consecutiveKills===5 && comboTimer===100'));
stage();probe(`processKill(40,0,false,'NORMAL',true,window.__ally,player);`);
ok('losing a friendly victim never builds combo or kill progress',P('consecutiveKills===4 && comboTimer===33 && totalKills===0 && score===1000'));
stage();probe(`processKill(40,0,false,'MILITARY_NEUTRAL',true,window.__ally,player);`);
ok('the neutral-military score exception cannot turn an allied casualty into combo',P('consecutiveKills===4 && comboTimer===33 && totalKills===0 && score===1005'));
console.log(`${checks}/${checks} player kill combo checks passed.`);

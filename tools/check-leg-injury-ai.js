// Injury state ownership, deterministic rolls and native firearm behavior.
// Physical bullet contacts are covered by check-leg-injury-integration.js.
const assert = require('node:assert/strict');
const {ctx, probe} = require('./harness');
const P = s => probe('(' + s + ')');
let checks = 0;
const ok = (label, value) => { assert.ok(value, label); checks++; };
ctx.setTimeout = () => 0;
function stage(serial = 0, type = 'NORMAL') {
  probe(`currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
    isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
    inOverworldView=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
    window.inNM0SecretOverlay=false;buildGhost=null;
    buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
    enemiesList=[];bullets=[];particles=[];invalidateColIndex();resetForestWildlife();
    frameCount=400;deltaTime=1000/60;legInjurySerial=${serial};
    ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=false;
    player=new Character(-300,0,true);player.hp=player.maxHp=100000;player.shield=0;
    leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
    window.injured=new Character(0,0,false,${JSON.stringify(type)});
    injured.hp=injured.maxHp=1000;injured.shield=0;injured.isArmed=true;
    injured.isFriendly=injured.isNeutral=false;injured.currentWeapon=WEAPONS.PISTOL;
    injured.ammo=17;injured.aimAngle=injured.moveAngle=0;injured.walkCycle=.4;
    injured.gait=0;injured.isMoving=false;resetActorStance(injured);enemiesList=[injured];
    window.lowRound={tH:'LEGS',w:WEAPONS.PISTOL,a:0,shotId:1001,isP:true,shooter:player};
    injured.fallHit={frame:frameCount,kind:'LEGS',mx:0,my:0,wound:{isLeg:true,legIndex:0}};`);
}
function start(serial = 0, side = 0) {
  stage(serial);
  assert.ok(P(`beginLegInjury(injured,lowRound,${side})`), 'valid injury fixture');
}
function advance(ms, dt = 1000/60) {
  probe(`for(let left=${ms};left>1e-7;){const step=Math.min(left,${dt});
    frameCount++;updateLegInjuryActor(injured,step);left-=step;}`);
}

for (const type of ['NORMAL','ARMORED_STANDARD','FEMALE_PISTOL']) {
  stage(0,type);
  ok(type+' is eligible for a surviving leg injury', P('legInjuryEligible(injured)'));
}
for (const flag of ['isPlayer','isFriendly','isNeutral','isNM0Scientist','isUnarmed','dead','mounted','knockedOut']) {
  stage(); probe(`injured.${flag}=true;`);
  ok(flag+' prevents injury state acquisition', !P('beginLegInjury(injured,lowRound,0)'));
}
for (const expr of ['injured.hp=0','injured.stunTimer=10','injured.legInjuryCooldownMs=100','isPaused=true','doTick=false']) {
  stage(); probe(expr);
  // doTick is an update gate; impacts cannot run through updateBullets while
  // it is false. Direct authoring helpers intentionally allow a paused tick.
  if (expr !== 'doTick=false')
    ok(expr+' prevents injury acquisition', !P('beginLegInjury(injured,lowRound,0)'));
}
for (const side of [-1,2,null]) {
  stage(); ok('invalid side '+side+' does not start an injury', !P(`beginLegInjury(injured,lowRound,${JSON.stringify(side)})`));
}
for (const edit of ["lowRound.tH='BODY'",'lowRound.isArrow=true','lowRound.isTaser=true','lowRound.isRocket=true',
  'lowRound.isAlienLaser=true','lowRound.isRedLaser=true','lowRound.isPinkLaser=true','lowRound.isOrangeBeam=true',
  'injured.fallHit.frame--',"injured.fallHit.kind='BODY'",'injured.fallHit.wound.isLeg=false']) {
  stage();probe(edit);
  ok(edit+' cannot roll an immobilizer', !P('tryLegShotInjury(injured,lowRound,0)') && !P('!!injured.legInjuryAttempts'));
}

stage();
const nativeRandom=ctx.random;let randomCalls=0;
ctx.random=(...a)=>{randomCalls++;return nativeRandom(...a);};
const chance=P('legInjuryProcChance(injured,lowRound)');
for(let n=0;n<50;n++)assert.equal(P('legInjuryProcChance(injured,lowRound)'),chance);
ok('repeated chance queries are stable and consume no gameplay RNG',randomCalls===0);
const rolls=P(`(()=>{let n=0;for(let id=1;id<=10000;id++)
  if(legInjuryProcChance(injured,{shotId:id})<LEG_INJURY_CHANCE)n++;return n;})()`);
ok('the default25% roll is distributed across shot IDs',rolls>2200&&rolls<2800);
probe(`window.acceptedId=0;for(let id=1;id<1000;id++)if(legInjuryProcChance(injured,{shotId:id})<LEG_INJURY_CHANCE){acceptedId=id;break;}
  lowRound.shotId=acceptedId;`);
ok('a valid current leg wound can start its side-specific injury',P('tryLegShotInjury(injured,lowRound,1)&&injured.legInjury.legIndex===1'));
ok('starting an injury consumes no gameplay RNG',randomCalls===0);
ctx.random=nativeRandom;
ok('a running injury cannot be restarted by another contact',!P('beginLegInjury(injured,lowRound,0)'));

// Every authored fall appears with every outcome within one bounded rotation.
const pairs=new Set(),outcomes=[];
stage();
for(let n=0;n<9;n++) {
  probe('injured.legInjury=null;injured.legInjuryCooldownMs=0;resetActorStance(injured);beginLegInjury(injured,lowRound,0);');
  const state=P('injured.legInjury');pairs.add(state.variant+'/'+state.outcome);outcomes.push(state.outcome);
}
ok('nine injuries cover all three falls crossed with all three outcomes',pairs.size===9);
ok('outcome rotation stays prone, seated, recovery',outcomes.every((x,i)=>x===['PRONE','SEATED','RECOVER'][i%3]));

stage();probe('injured.isMoving=true;rememberFigureMotion(injured,-8,0);injured.fallHit.mx=3;injured.fallHit.my=4;beginLegInjury(injured,lowRound,1);');
ok('fall heading uses the actual pre-impact movement snapshot',P('injured.legInjury.wasMoving&&Math.abs(injured.legInjury.heading-Math.atan2(4,3))<1e-10'));
ok('the struck side is frozen independently of later wound changes',P('injured.legInjury.legIndex===1'));
probe('injured.fallHit.wound.legIndex=0;');
ok('later decals cannot change the injured side',P('injured.legInjury.legIndex===1'));
stage();probe('injured.isMoving=true;rememberFigureMotion(injured,4,0);injured.aimAngle=1.2;beginLegInjury(injured,lowRound,0);');
ok('zero impact motion triggers the stationary grab despite stale movement flags',P('!injured.legInjury.wasMoving&&injured.legInjury.heading===1.2'));

for(const gate of ['doTick=false','isPaused=true','inTravelMenu=true','inWorldBuildingMenu=true']) {
  start();advance(200);
  const before=P('JSON.stringify({s:injured.legInjury,x:injured.x,y:injured.y,fire:injured.fireTimer})');
  probe(gate);advance(900);
  ok(gate+' freezes simulation and timer ownership',P('JSON.stringify({s:injured.legInjury,x:injured.x,y:injured.y,fire:injured.fireTimer})')===before);
}

for(const rate of [30,60,120]) {
  start();probe('injured.fireTimer=90;injured.hitFlash=90;injured.muzzleFlash=90;injured.stanceDamage={leftMs:500,amount:20,critical:false};');
  advance(250,1000/rate);
  ok(rate+'Hz advances injury time in milliseconds',Math.abs(P('injured.legInjury.phaseMs')-250)<1e-7);
  ok(rate+'Hz cooldowns tick at the native60Hz rate',P('injured.fireTimer===75&&injured.hitFlash===75&&injured.muzzleFlash===75'));
  ok(rate+'Hz damage pop-ups retain wall-clock lifetime',Math.abs(P('injured.stanceDamage.leftMs')-250)<1e-7);
}

for(const serial of [0,1,2]) {
  start(serial);const s=P('injured.legInjury');
  advance(s.fallMs);
  ok(s.outcome+' completes its finite fall',P('injured.legInjury.phase')===(s.outcome==='SEATED'?'SEATED':'PRONE'));
  ok(s.outcome+' cannot enter ordinary voluntary stance changes',!P("requestActorStance(injured,'STAND')"));
  const x=P('injured.x'),y=P('injured.y');advance(300);
  ok(s.outcome+' stays planted after landing',Math.abs(P('injured.x')-x)+Math.abs(P('injured.y')-y)<1e-8);
  if(s.outcome==='SEATED') {
    ok('seated head-height rounds pass overhead',P("stanceHitProfile(injured,'HEAD')===null"));
    ok('seated body-height rounds resolve critical head damage',P("stanceHitProfile(injured,'BODY').zone==='HEAD'"));
    ok('seated low rounds resolve standard body damage',P("stanceHitProfile(injured,'LEGS').zone==='BODY'"));
  }
  advance(s.outcome==='RECOVER'?350:s.outcome==='SEATED'?5100:4500);
  ok(s.outcome+' enters a finite recovery',P("injured.legInjury.phase==='RECOVER'"));
  advance(950);
  ok(s.outcome+' restores a living standing fighter',P("!injured.legInjury&&actorStance(injured)==='STAND'&&injured.state==='CHASE'&&injured.hp>0"));
  ok(s.outcome+' grants a repeat-injury cooldown',P('injured.legInjuryCooldownMs===LEG_INJURY_COOLDOWN_MS&&!legInjuryEligible(injured)'));
  advance(3001);
  ok(s.outcome+' eventually permits a fresh injury',P('legInjuryEligible(injured)'));
}

// Exercise native firearm emission from both downed forms and eight headings.
for(const serial of [0,1])for(const weapon of ['PISTOL','ASSAULT_RIFLE'])for(let dir=0;dir<8;dir++) {
  start(serial);const fall=P('injured.legInjury.fallMs');advance(fall);
  probe(`bullets=[];injured.currentWeapon=WEAPONS.${weapon};injured.ammo=10;
    injured.fireTimer=injured.reloadTimer=0;injured.aimAngle=${dir}*PI/4;
    player.x=injured.x+Math.cos(injured.aimAngle)*300;player.y=injured.y+Math.sin(injured.aimAngle)*300;
    injured.aggroTarget=player;injured.legInjury.sightMs=160;updateLegInjuryCombat(injured,injured.legInjury,0);`);
  ok(`${serial?'seated':'prone'} ${weapon} direction${dir} uses the native projectile, ammo and cooldown`,
    P('bullets.length===1&&bullets[0].shooter===injured&&!bullets[0].isP&&injured.ammo===9&&injured.fireTimer>0'));
  ok(`${serial?'seated':'prone'} ${weapon} direction${dir} has a finite pose-mounted muzzle`,
    P('Number.isFinite(bullets[0].x)&&Number.isFinite(bullets[0].y)&&Math.hypot(bullets[0].x-injured.x,bullets[0].y-injured.y)<150'));
}

start();probe('injured.fireTimer=4;injured.reloadTimer=6;injured.ammo=0;');advance(100);
ok('injury reload completion fills the native weapon magazine',P('injured.reloadTimer===0&&injured.ammo===weaponMagazineCapacity(injured)'));
start();probe('injured.isFriendly=true;');advance(20);
ok('allegiance changes release the injury state',P('!injured.legInjury'));
start();probe('injured.stunTimer=20;');advance(20);
ok('a stronger existing stun safely takes over from leg injury',P('!injured.legInjury&&injured.stunTimer===20'));

console.log(`${checks}/${checks} leg-injury eligibility, rolls, states, timing and native firearm checks passed.`);

// Stance balance uses native movement/fire paths and delayed cached-sight aim.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness');
const P = source => probe('(' + source + ')');
let checks = 0;
const ok = (label, value) => { assert.ok(value, label); checks++; };
ctx.setTimeout = () => 0;
function fresh(stance = 'STAND') {
  ctx.touches = [];
  probe(`currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=false;
    inLvl4Cutscene=inOverworldView=false;window.inNM0SecretOverlay=false;buildGhost=null;
    ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=meleeUnlocked=false;
    grenadesUnlocked=false;isCooking=false;headAimToggle=false;
    player=new Character(0,0,true);player.currentWeapon=WEAPONS.SMG;player.ammo=30;
    enemiesList=[];activeBuildings=[];buildings=[];activeParkingCars=[];barrels=[];bullets=[];particles=[];
    invalidateColIndex();resetForestWildlife();setMeleeTool('NONE');
    resetActorStance(player,${JSON.stringify(stance)});
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
    meleeInputHeld=grenadeInputHeld=cannonInputHeld=false;
    frameCount=100;deltaTime=1000/60;`);
}
const moved = {};
for (const stance of ['STAND', 'CROUCH', 'PRONE']) {
  fresh(stance);
  probe('leftStick.active=true;leftStick.dx=1;frameCount++;player.updatePlayer();');
  moved[stance] = P('player.x');
}
ok('crouching movement is 60% of native standing movement', Math.abs(moved.CROUCH / moved.STAND - .60) < 1e-8);
ok('prone crawling is 25% of native standing movement', Math.abs(moved.PRONE / moved.STAND - .25) < 1e-8);

for (const stance of ['STAND', 'CROUCH', 'PRONE']) {
  fresh(stance);
  const stationary = P('stanceSpreadScale(player)'), recovery = P('stanceRecoilRecovery(player)');
  probe('player.isMoving=true;');
  ok(stance + ' movement never improves the stationary accuracy bonus', P('stanceSpreadScale(player)') >= stationary);
  probe('player.isMoving=false;player.weaponKick=6;frameCount++;player.updatePlayer();');
  ok(stance + ' native visual recoil recovers at its stance rate', Math.abs(P('player.weaponKick') - (6 - recovery)) < 1e-8);
}

// Force the extreme permitted random spread to measure the actual projectile.
const random = ctx.random;
ctx.random = (a, b) => b === undefined ? random(a) : b;
for (const stance of ['STAND', 'CROUCH', 'PRONE']) {
  fresh(stance);
  const spread = P('WEAPONS.SMG.spread * stanceSpreadScale(player)');
  probe('player.aimAngle=0;player.fire(0);');
  ok(stance + ' SMG projectile uses the stance spread without changing its weapon',
    Math.abs(P('bullets[0].a') - spread) < 1e-8 && P('WEAPONS.SMG.spread') === .1);
  ok(stance + ' does not increase fire rate', P('player.fireTimer===WEAPONS.SMG.fireCooldown'));
}
ctx.random = random;

fresh();
probe(`window.shooter=new Character(400,0,false,'NORMAL');
  resetActorStance(shooter,'PRONE');shooter.currentWeapon=WEAPONS.PISTOL;shooter.ammo=17;
  shooter.aimAngle=.4;shooter.fire(.57);`);
ok('a prone pistol preserves the AI aim-error offset passed to native fire',
  Math.abs(P('bullets[0].a') - .57) < 1e-8);
probe(`bullets=[];shooter.fireTimer=0;shooter.aimAngle=HALF_PI;shooter._stanceClearAngle=0;
  buildings=activeBuildings=[{x:400,y:40,w:20,h:12,isWall:true}];invalidateColIndex();
  shooter.fire(HALF_PI+.17);`);
ok('a blocked prone turn rotates the shot while retaining its aim-error offset',
  P('actorStance(shooter)==="PRONE" && shooter.aimAngle===0') && Math.abs(P('bullets[0].a') - .17) < 1e-8);

fresh();
probe(`window.shooter=new Character(400,0,false,'NORMAL');shooter.aiOffset=1;
  resetActorStance(player,'PRONE');window.aimFirst=combatAimElevation(shooter,player,true);`);
ok('a new prone target initially receives the prior body plane', P('aimFirst==="BODY" && shooter.stanceAimReadying'));
probe('for(let i=0;i<29;i++){frameCount++;combatAimElevation(shooter,player,true);}');
ok('enemy aim cannot correct before the 500 ms visible reaction window', P('shooter.stanceAimZone==="BODY"'));
probe('for(let i=0;i<2;i++){frameCount++;combatAimElevation(shooter,player,true);}');
ok('sustained visible prone targets receive low critical-counter shots', P('shooter.stanceAimZone==="LEGS" && !shooter.stanceAimReadying'));
probe('shooter.currentWeapon=WEAPONS.PISTOL;shooter.ammo=17;shooter.fire(0);');
ok('native hostile fire carries the corrected low elevation', P('bullets[0].tH==="LEGS" && !bullets[0].isP'));
probe('resetActorStance(player,"STAND");frameCount++;combatAimElevation(shooter,player,false);');
ok('lost sight cannot observe the target stance through cover', P('shooter.stanceAimObserved===null && shooter.stanceAimZone==="LEGS"'));
probe('for(let i=0;i<20;i++){frameCount++;combatAimElevation(shooter,player,true);}combatAimElevation(shooter,player,false);for(let i=0;i<20;i++){frameCount++;combatAimElevation(shooter,player,true);}');
ok('interrupted sight restarts rather than banks the aim reaction', P('shooter.stanceAimZone==="LEGS"'));
probe('for(let i=0;i<12;i++){frameCount++;combatAimElevation(shooter,player,true);}');
ok('returning to standing eventually restores the normal body aim', P('shooter.stanceAimZone==="BODY"'));
probe('resetActorStance(player,"CROUCH");shooter.isFriendly=true;for(let i=0;i<32;i++){frameCount++;combatAimElevation(shooter,player,true);}');
ok('allies share the target-height resolver and use torso height against crouch', P('shooter.stanceAimZone==="BODY"'));

for (const [role, range, expected, frames] of [[0, 300, 'CROUCH', 64], [7, 500, 'PRONE', 132], [1, 300, 'STAND', 132]]) {
  fresh();
  probe(`window.shooter=new Character(400,0,false,'NORMAL');shooter.aiOffset=${role};
    for(let i=0;i<${frames};i++){frameCount++;updateCombatStanceAI(shooter,player,true,${range});updateActorStance(shooter,1000/60);}`);
  ok('AI role ' + role + ' chooses ' + expected + ' only after sustained combat', P(`actorStance(shooter)===${JSON.stringify(expected)}`));
  probe('for(let i=0;i<22;i++){frameCount++;updateCombatStanceAI(shooter,player,false,100);updateActorStance(shooter,1000/60);}');
  ok('AI role ' + role + ' rises when the engagement ends', P('actorStance(shooter)==="STAND"'));
}
console.log(`${checks}/${checks} stance movement, accuracy, recoil and AI counterplay checks passed`);

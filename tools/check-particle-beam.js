// Particle Beam is a finite player firearm. Exercise the actual shop,
// Character input/fire/reload path, swept contacts and inventory lifecycle.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness');
const P = source => probe('(' + source + ')');
let checks = 0, now = 8000, pad = null;
const saved = new Map();
ctx.setTimeout = () => 0;
ctx.millis = () => now;
ctx.localStorage = {getItem:k=>saved.get(k) ?? null,setItem:(k,v)=>saved.set(k,String(v)),removeItem:k=>saved.delete(k)};
ctx.navigator.getGamepads = () => pad ? [pad] : [];
const check = (label, fn) => { fn(); checks++; console.log('  ok   ' + label); };
probe('isStoryMode=false;townsData={};startAtLevel(1);started=true;');
assert(P('!!WEAPONS.PARTICLE_BEAM'), 'Particle Beam definition is missing');

function stage() {
  pad = null; ctx.touches = [];
  probe(`if(_frontierSaloonSession)exitFrontierSaloon();
    currentLevel=currentBiome=1;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
    inWorldBuildingMenu=inTravelMenu=inOverworldView=inUpgradeMenu=false;
    window.inNM0SecretOverlay=false;buildGhost=null;
    buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
    enemiesList=[];bullets=[];corpses=[];particles=[];invalidateColIndex();resetShovelState();resetForestWildlife();
    player=new Character(0,0,true);player.hp=player.maxHp=10000;player.shield=0;
    setMeleeTool('NONE');swordPickedUp=false;window.pickaxeOwned=false;
    chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
    meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;isCooking=false;
    window.isDesktop=false;window.milLvl=1;score=500;
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
    gamepadControlSettings.shooting='R2';prevGamepadButtons=[];resetGamepadFireInput();
    viewLeft=viewTop=-10000;viewRight=viewBottom=10000;MAX_KILLS=100000;totalKills=0;
    frameCount++;`);
}
function buy() {
  assert(P('purchaseUpgrade(upgradeShopItems().find(item=>item.weapon===WEAPONS.PARTICLE_BEAM))'));
}
function connect() {
  pad = {index:0,id:'Particle Beam QA',connected:true,axes:[0,0,1,0],
    buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
}
function frame(count=1, trigger=false, controls=[]) {
  for(let i=0;i<count;i++) {
    now += 1000/60; ctx.deltaTime = 1000/60;
    if(pad)pad.buttons.forEach((b,j)=>{b.pressed=controls.includes(j)||(trigger&&j===7);b.value=b.pressed?1:0;});
    probe('frameCount++;handleTouches();handleGamepad();player.updatePlayer();');
  }
}
function hit(zone='BODY',offset=0,hp=10000,heading=0) {
  probe(`frameCount++;window.particleTarget=new Character(90,${offset},false,'NORMAL');
    particleTarget.hp=particleTarget.maxHp=${hp};particleTarget.shield=0;
    particleTarget.isFriendly=particleTarget.isNeutral=false;particleTarget.isMoving=false;
    particleTarget.aimAngle=particleTarget.moveAngle=${heading};resetActorStance(particleTarget);
    enemiesList=[particleTarget];bullets=[];corpses=[];
    window.particleRound=spawnBullet(0,0,0,true,'${zone}',WEAPONS.PARTICLE_BEAM,player);
    for(let i=0;i<20&&particleRound.active;i++){frameCount++;updateBullets();}`);
  return P('particleTarget');
}

check('definition preserves the requested damage, cadence and exact magazine size', () => {
  assert.deepEqual(Array.from(P(`(()=>{const w=WEAPONS.PARTICLE_BEAM;return [w.name,w.fireCooldown,w.enemyCooldown,w.maxAmmo,w.bodyDmg,w.headDmg,w.spread,w.pellets];})()`)),
    ['PARTICLE BEAM',5,48,100,100,400,0,1]);
  for(const level of [1,2,4]) {probe('window.milLvl='+level);assert.equal(P('playerMagazineCapacity(WEAPONS.PARTICLE_BEAM)'),100);}
});
check('shop purchase costs 50 and supplies 100 loaded plus nine reserve magazines', () => {
  stage(); assert.equal(P('upgradeShopItems().find(i=>i.weapon===WEAPONS.PARTICLE_BEAM).price'),50);
  buy();assert.equal(P('score'),450);assert(P('player.currentWeapon===WEAPONS.PARTICLE_BEAM'));
  assert.equal(P('player.ammo'),100);assert.equal(P('player.mags[WEAPONS.PARTICLE_BEAM.name]'),9);
});
check('an unaffordable purchase does not equip or manufacture ammunition', () => {
  stage();probe('score=49;');const previous=P('player.currentWeapon');
  assert.equal(P('purchaseUpgrade(upgradeShopItems().find(i=>i.weapon===WEAPONS.PARTICLE_BEAM))'),false);
  assert.equal(P('score'),49);assert.strictEqual(P('player.currentWeapon'),previous);
});
check('R2 fires one zero-spread beam every five native player ticks', () => {
  stage();buy();connect();frame();frame(21,true);
  assert.equal(P('bullets.length'),5);assert.equal(P('player.ammo'),95);
  assert(P('bullets.every(b=>b.w===WEAPONS.PARTICLE_BEAM&&b.isParticleBeam&&Math.abs(b.a)<1e-10&&Math.abs(b.vy)<1e-10)'));
});
check('normal reload consumes one reserve magazine and completes at 100 rounds', () => {
  stage();buy();probe('player.ammo=37;player.triggerReload();');
  assert.equal(P('player.mags[WEAPONS.PARTICLE_BEAM.name]'),8);assert.equal(P('player.ammo'),0);
  assert(P('player.reloadTimer>0'));frame(100);
  assert.equal(P('player.ammo'),100);assert.equal(P('player.reloadTimer'),0);
});
check('ten magazines can produce exactly 1000 rounds before finite inventory runs dry', () => {
  stage();buy();
  const result=P(`(()=>{let shots=0,reloads=0;while(player.currentWeapon===WEAPONS.PARTICLE_BEAM&&shots<1100){
    player.fireTimer=0;player.fire(0);shots++;bullets.length=particles.length=0;
    if(player.reloadTimer>0){reloads++;player.reloadTimer=1;frameCount++;player.updatePlayer();}
  }return {shots,reloads,ammo:player.weaponAmmo[WEAPONS.PARTICLE_BEAM.name],reserve:player.mags[WEAPONS.PARTICLE_BEAM.name],weapon:player.currentWeapon.name};})()`);
  assert.equal(result.shots,1000);assert.equal(result.reloads,9);assert.equal(result.ammo,0);assert.equal(result.reserve,0);
  assert.notEqual(result.weapon,'PARTICLE BEAM');
});
check('weapon cycling and dry fallback keep the new identity in the player inventory', () => {
  stage();buy();probe('cyclePlayerWeapon(1);cyclePlayerWeapon(-1);');
  assert(P('player.currentWeapon===WEAPONS.PARTICLE_BEAM'));
  probe('player.ammo=0;player.mags[WEAPONS.PARTICLE_BEAM.name]=0;player.removeCurrentWeapon();');
  assert(P('player.currentWeapon!==WEAPONS.PARTICLE_BEAM'));
});
check('heat vents after shot 50 and releases a second exhaust burst when firing ends', () => {
  stage();buy();connect();frame();frame(250,true);
  assert.equal(P('particleBeamHeat(player).shots'),50);assert.equal(P('particleBeamHeat(player).venting'),false);
  frame(1,true);assert.equal(P('particleBeamHeat(player).shots'),51);assert(P('particleBeamHeat(player).venting'));
  const before=P('particles.length');frame(1,false);
  assert(P('particleBeamHeat(player).venting&&particleBeamHeat(player).ventTicks>0&&!particleBeamHeat(player).burst'));
  assert(P('particles.length')>before,'release must emit chamber exhaust');
  frame(100,false);assert(P('particleBeamHeat(player).heat===0&&!particleBeamHeat(player).venting'));
});
check('even a short firing burst vents on release without spending an extra round', () => {
  stage();buy();connect();frame();frame(11,true);const ammo=P('player.ammo');
  frame(1,false);assert.equal(P('player.ammo'),ammo);assert(P('particleBeamHeat(player).venting'));
});
check('paused heat and hot decals stay frozen until simulation resumes', () => {
  stage();buy();connect();frame();frame(11,true);frame(1,false);
  probe(`window.hotWound={sz:4};markParticleBeamWound(hotWound,player);player.decals.push(hotWound);
    isPaused=true;window.heatSnapshot=JSON.stringify(particleBeamHeat(player));`);
  probe('for(let i=0;i<80;i++){frameCount++;updateParticleBeamHeat(player);ageParticleBeamWounds(player.decals);}');
  assert.equal(P('JSON.stringify(particleBeamHeat(player))'),P('heatSnapshot'));
  assert.equal(P('hotWound.particleBeamState.age'),0);
  probe('isPaused=false;');
});
check('impact decals are larger, orange for one second and then dark red', () => {
  stage();probe(`window.hotWound={sz:4};markParticleBeamWound(hotWound,player);player.decals.push(hotWound);`);
  assert(P('hotWound.sz>4&&particleBeamWoundHeat(hotWound)===1'));
  probe('for(let i=0;i<59;i++){frameCount++;ageParticleBeamWounds(player.decals);}');
  assert.equal(P('particleBeamWoundHeat(hotWound)'),1);
  probe('for(let i=0;i<25;i++){frameCount++;ageParticleBeamWounds(player.decals);}');
  assert.equal(P('particleBeamWoundHeat(hotWound)'),0);
  const col=P('particleBeamWoundColour(hotWound)');assert(col[0]>col[1]&&col[0]>col[2]&&col[0]<140);
});
check('equipment snapshots preserve spent rounds, an unfinished reload and selected identity', () => {
  stage();buy();probe(`player.ammo=37;player.mags['PARTICLE BEAM']=4;player.reloadTimer=19;
    particleBeamCenterCycle=2;window.particleEquipment=serializeParticleBeamEquipment(player);
    player=new Character(0,0,true);restoreParticleBeamEquipment(particleEquipment,player);`);
  assert(P('player.currentWeapon===WEAPONS.PARTICLE_BEAM&&player.ammo===37&&player.reloadTimer===19'));
  assert.equal(P("player.mags['PARTICLE BEAM']"),4);assert.equal(P('particleBeamCenterCycle'),2);
  assert.equal(P('player.particleBeamState'),null);
});
check('old saves with no unlock cannot gain the beam and invalid inventory is clamped', () => {
  stage();probe(`particleBeamUnlocked=false;restoreParticleBeamEquipment(null,player);`);
  assert(P("player.weaponAmmo['PARTICLE BEAM']===0&&player.mags['PARTICLE BEAM']===0"));
  probe(`particleBeamUnlocked=true;restoreParticleBeamEquipment({ammo:Infinity,reserve:-50,equipped:true,reloadTicks:900,centerCycle:6},player);`);
  assert(P("player.ammo===100&&player.mags['PARTICLE BEAM']===0&&player.reloadTimer===90&&particleBeamCenterCycle===2"));
});
check('native sector travel and campaign save/load preserve the finite beam supply', () => {
  stage();buy();probe(`player.ammo=23;player.mags['PARTICLE BEAM']=3;particleBeamCenterCycle=2;saveGame();`);
  const raw=JSON.parse(saved.get('urbanTwinStickSave'));
  assert.equal(raw.particleBeamUnlocked,true);
  assert.equal(raw.particleBeamEquipment.ammo,23);assert.equal(raw.particleBeamEquipment.reserve,3);
  probe('startAtLevel(2);started=true;');
  assert(P("player.currentWeapon===WEAPONS.PARTICLE_BEAM&&player.ammo===23&&player.mags['PARTICLE BEAM']===3"));
  probe(`player.ammo=1;player.mags['PARTICLE BEAM']=0;player.currentWeapon=WEAPONS.PISTOL;loadGame();`);
  assert(P("particleBeamUnlocked&&player.currentWeapon===WEAPONS.PARTICLE_BEAM&&player.ammo===23&&player.mags['PARTICLE BEAM']===3"));
  assert.equal(P('particleBeamCenterCycle'),2);
  delete raw.particleBeamUnlocked;delete raw.particleBeamEquipment;
  saved.set('urbanTwinStickSave',JSON.stringify(raw));probe('loadGame();');
  assert(P("!particleBeamUnlocked&&player.weaponAmmo['PARTICLE BEAM']===0&&player.mags['PARTICLE BEAM']===0"));
});
check('a reload interrupted by travel or campaign load cannot duplicate a battery', () => {
  stage();buy();probe(`player.ammo=37;player.triggerReload();saveGame();startAtLevel(2);started=true;`);
  assert(P("player.currentWeapon===WEAPONS.PARTICLE_BEAM&&player.ammo===0&&player.reloadTimer===90&&player.mags['PARTICLE BEAM']===8"));
  frame(100);assert(P("player.ammo===100&&player.mags['PARTICLE BEAM']===8&&player.reloadTimer===0"));
  probe('loadGame();');
  assert(P("player.currentWeapon===WEAPONS.PARTICLE_BEAM&&player.ammo===0&&player.reloadTimer===90&&player.mags['PARTICLE BEAM']===8"));
  frame(100);assert(P("player.ammo===100&&player.mags['PARTICLE BEAM']===8&&player.reloadTimer===0"));
});
check('swept beam body and head contacts use exactly 100 and 400 damage', () => {
  stage();const body=hit('BODY');assert.equal(body.hp,9900);
  stage();const head=hit('HEAD');assert.equal(head.hp,9600);
});
check('a nonfatal beam cannot steal a later pistol death in the same frame', () => {
  stage();probe(`particleBeamCenterCycle=0;window.particleTarget=new Character(90,0,false,'NORMAL');
    particleTarget.hp=particleTarget.maxHp=110;particleTarget.shield=0;particleTarget.isFriendly=particleTarget.isNeutral=false;
    particleTarget.aimAngle=particleTarget.moveAngle=0;resetActorStance(particleTarget);enemiesList=[particleTarget];
    window.particleRound=spawnBullet(0,0,0,true,'BODY',WEAPONS.PARTICLE_BEAM,player);
    while(particleRound.active)updateBullets();
    window.pistolFinisher=spawnBullet(0,0,0,true,'BODY',WEAPONS.PISTOL,player);pistolFinisher.vx=160;
    updateBullets();`);
  assert(P('particleTarget.dead&&corpses.length===1&&!corpses[0].particleBeamDeath'));
  assert.equal(P('particleBeamCenterCycle'),0);
});
check('a fast beam selects the nearest actor even when the far target was registered first', () => {
  stage();probe(`window.nearParticleTarget=new Character(40,0,false,'NORMAL');window.farParticleTarget=new Character(70,0,false,'NORMAL');
    for(const target of [nearParticleTarget,farParticleTarget]){target.hp=target.maxHp=10000;target.shield=0;
      target.isFriendly=target.isNeutral=false;target.isMoving=false;target.aimAngle=target.moveAngle=0;resetActorStance(target);}
    enemiesList=[farParticleTarget,nearParticleTarget];spawnBullet(0,0,0,true,'BODY',WEAPONS.PARTICLE_BEAM,player);
    frameCount++;updateBullets();`);
  assert.equal(P('nearParticleTarget.hp'),9900);assert.equal(P('farParticleTarget.hp'),10000);
});
check('an intact shield absorbs a leg beam before flesh can be severed', () => {
  stage();probe(`player.x=90;player.y=6;window.particleTarget=player;particleTarget.hp=particleTarget.maxHp=10000;
    particleTarget.shield=1000;particleTarget.aimAngle=particleTarget.moveAngle=0;resetActorStance(particleTarget);
    window.syntheticBeamShooter=new Character(0,0,false,'NORMAL');enemiesList=[syntheticBeamShooter];
    window.particleRound=spawnBullet(0,0,0,false,'LEGS',WEAPONS.PARTICLE_BEAM,syntheticBeamShooter);
    for(let i=0;i<5&&particleRound.active;i++){frameCount++;updateBullets();}`);
  assert(P('particleTarget.hp===10000&&particleTarget.shield<1000&&!particleTarget.dead&&corpses.length===0'));
});
check('fatal center body impacts cycle HOLE, BACKFALL and attached CHEST without borrowing other deaths', () => {
  stage();probe('particleBeamCenterCycle=0;');
  for(const [index,kind] of ['HOLE','BACKFALL','CHEST','HOLE'].entries()) {
    hit('BODY',0,100);assert(P('particleTarget.dead&&corpses.length===1'));
    assert.equal(P('corpses[0].particleBeamDeath.kind'),kind);
    assert.equal(P('corpses[0].particleBeamDeath.variant'),index%3);
    assert(P('corpses[0].blast.gibs.length>0&&corpses[0].blast.parts.length===0'));
    if(index===0) {
      hit('BODY',7,100);assert.equal(P('corpses[0].particleBeamDeath.kind'),'DIAGONAL');
      hit('HEAD',0,100);assert(!P('corpses[0].particleBeamDeath'));
      hit('BODY',0,10000);assert.equal(P('corpses.length'),0);
      assert.equal(P('particleBeamCenterCycle'),1,'only fatal center body hits advance this cycle');
    }
  }
});
check('off-center torso cuts mirror the contacted anatomical side', () => {
  stage();
  for(const offset of [-7,7]) {
    hit('BODY',offset,100);assert.equal(P('corpses[0].particleBeamDeath.kind'),'DIAGONAL');
    assert.equal(P('corpses[0].particleBeamDeath.side'),-Math.sign(offset));
    assert(P('corpses[0].blast.particleDiagonal&&corpses[0].blast.parts.length===2'));
  }
});
check('thin physical leg contacts detach the actual side at every facing', () => {
  for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5])for(const index of [0,1]) {
    stage();probe(`player.x=player.y=-2000;window.particleTarget=new Character(0,0,false,'NORMAL');
      particleTarget.hp=particleTarget.maxHp=10000;particleTarget.shield=0;
      particleTarget.isFriendly=particleTarget.isNeutral=false;particleTarget.isMoving=false;
      particleTarget.aimAngle=particleTarget.moveAngle=${angle};resetActorStance(particleTarget);enemiesList=[particleTarget];
      window.legGeometry=humanLegHitGeometry(particleTarget);window.struckLeg=legGeometry.legs[${index}];
      window.legY=(struckLeg.ky+struckLeg.ay)*.5;window.ca=Math.cos(legGeometry.angle);window.sa=Math.sin(legGeometry.angle);
      window.particleRound=spawnBullet(legGeometry.x+(ca*-80-sa*legY)*legGeometry.scale,
        legGeometry.y+(sa*-80+ca*legY)*legGeometry.scale,legGeometry.angle,true,'LEGS',WEAPONS.PARTICLE_BEAM,player);
      for(let i=0;i<20&&particleRound.active;i++){frameCount++;updateBullets();}`);
    assert(P('particleTarget.dead&&corpses.length===1'),`leg ${index}, facing ${angle} was not severed`);
    assert.equal(P('corpses[0].particleBeamDeath.kind'),'LEG');
    assert.equal(P('corpses[0].particleBeamDeath.legIndex'),index);
    assert.equal(P('corpses[0].blast.legIndex'),index);
  }
});
check('back-impact momentum raises the legs after contact and then settles them', () => {
  stage();probe('particleBeamCenterCycle=1;');hit('BODY',0,100);
  assert.equal(P('corpses[0].particleBeamDeath.kind'),'BACKFALL');
  probe('window.testCorpse=corpses[0];');assert.equal(P('particleBeamLegKick(testCorpse)'),0);
  probe('for(let i=0;i<31;i++){frameCount++;testCorpse.update();}');
  assert(P('testCorpse.fall.contacted&&particleBeamLegKick(testCorpse)>.8'));
  probe('for(let i=0;i<35;i++){frameCount++;testCorpse.update();}');
  assert.equal(P('particleBeamLegKick(testCorpse)'),0);
});
check('a swept beam stops at the first solid and cannot damage a target behind it', () => {
  stage();probe('window.particleWall={x:48,y:0,w:8,h:100,isLowWall:false,hp:1000};buildings=activeBuildings=[particleWall];invalidateColIndex();');
  const target=hit('BODY');assert.equal(target.hp,10000);assert(!P('particleRound.active'));
});
check('a barrel before an actor takes the beam without a direct hit behind it', () => {
  stage();probe('barrels=[{x:35,y:0,hp:20}];');
  const target=hit('BODY');assert.equal(target.hp,10000);assert(P('barrels[0].hp<=0&&!particleRound.active'));
});
check('pooled reuse clears Particle Beam rendering and transient contact state', () => {
  stage();probe(`window.reusedParticle=new Bullet();reusedParticle.init(0,0,0,true,'BODY',WEAPONS.PARTICLE_BEAM,player);
    reusedParticle.update();reusedParticle.active=false;reusedParticle.init(0,0,0,true,'BODY',WEAPONS.PISTOL,player);`);
  assert.equal(P('reusedParticle.isParticleBeam'),false);assert.equal(P('reusedParticle.w===WEAPONS.PISTOL'),true);
  assert.equal(P('reusedParticle.history.length'),0);
});
check('ordinary enemies never receive the player-only Particle Beam loadout', () => {
  stage();assert(P(`['NORMAL','ARMORED_STANDARD','BANDIT','MILITARY','ROBOT','COWBOY','TOWN_COP'].every(type=>
    Array.from({length:12},()=>new Character(0,0,false,type)).every(e=>e.currentWeapon!==WEAPONS.PARTICLE_BEAM))`));
});

console.log(`${checks} Particle Beam native weapon, inventory, damage, collision and pooling checks passed.`);

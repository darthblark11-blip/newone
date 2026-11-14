// Department upgrades must survive the real inventory/health entry points,
// including replacing a gun that already had its extended magazine.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness');
const run = s => probe(s), P = s => probe('(' + s + ')');
let checks = 0, now = 1000, pad = null, seed = 1291;
const ok = (label, expr) => { assert.ok(typeof expr === 'string' ? P(expr) : expr, label); checks++; };
ctx.millis = () => now;
ctx.setTimeout = () => 0;
ctx.navigator.getGamepads = () => pad ? [pad] : [];
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  return a === undefined ? r : Array.isArray(a) ? a[Math.floor(r * a.length)] : b === undefined ? a * r : a + r * (b - a);
};
const baseWeapons = P('JSON.stringify(WEAPONS)');
function reset(farm = 2, military = 2) {
  now += 1000; pad = null; ctx.touches = [];
  run(`window.farmLvl=${farm};window.milLvl=${military};window.sciLvl=window.archLvl=1;
    window.farmXP=window.milXP=window.sciXP=window.archXP=0;
    currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inDarchonCall=false;
    inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inLvl4Cutscene=false;
    inWorldBuildingMenu=inOverworldView=inTravelMenu=false;buildGhost=null;
    window.inNM0SecretOverlay=false;window.farmLvl=${farm};
    player=new Character(0,0,true);player.isArmed=true;
    bullets=[];particles=[];enemiesList=[];healthPacks=[];weaponDrops=[];
    buildings=[];activeBuildings=[];activeParkingCars=[];barrels=[];invalidateColIndex();
    resetForestWildlife();setMeleeTool('NONE');resetFrontierEquipment();
    smgUnlocked=dualSmgUnlocked=arUnlocked=shotgunUnlocked=rocketLauncherUnlocked=false;
    chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=isCooking=false;
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
    resetTouchAimSelection(false);prevGamepadButtons=[];gamepadWasConnected=false;
    window.showOnScreenControls=true;window.isDesktop=false;
    viewLeft=viewTop=-10000;viewRight=viewBottom=10000;frameCount++;`);
}
reset(1, 1);
run('player.hp=70;window.farmXP=50;checkLevelUps();');
ok('Farming achievement permanently raises maximum and grants only its increase', 'window.farmLvl===2&&player.maxHp===125&&player.hp===95');
run('applyFarmingReward(player,true);applyFarmingReward(player,true);');
ok('Reapplying a farm reward never heals the player again', 'player.maxHp===125&&player.hp===95');
run('player.hp=110;healthPacks=[{x:0,y:0}];updateHealthPacks();');
ok('A health pack heals above the former 100 HP limit', 'player.hp===125&&player.maxHp===125&&healthPacks.length===0');
run('healthPacks=[{x:0,y:0}];updateHealthPacks();');
ok('A full-health upgraded player leaves the health pack available', 'healthPacks.length===1&&player.hp===125');
reset(1, 1);run('player.hp=83;healthPacks=[{x:0,y:0}];updateHealthPacks();');
ok('A different unupgraded campaign retains normal health and healing', 'player.hp===100&&player.maxHp===100');

const magazines = ['PISTOL','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','ROCKET_LAUNCHER','TASER','REVOLVER','COACH_GUN'];
for (const key of magazines) {
  reset();
  ok(key + ' begins with an extended magazine on new player construction', `player.weaponAmmo[WEAPONS.${key}.name]===WEAPONS.${key}.maxAmmo*2`);
  run(`player.currentWeapon=WEAPONS.${key};player.mags[player.currentWeapon.name]=3;
    player.ammo=player.currentWeapon.maxAmmo+1;player.triggerReload();player.reloadTimer=1;player.updatePlayer();`);
  ok(key + ' native reload refills the upgraded capacity', `player.ammo===WEAPONS.${key}.maxAmmo*2&&player.reloadTimer===0`);
  run(`window.hostile=new Character(1000,1000,false);hostile.currentWeapon=WEAPONS.${key};`);
  ok(key + ' does not increase hostile inventory capacity', `weaponMagazineCapacity(hostile)===WEAPONS.${key}.maxAmmo`);
}
reset();run('player.currentWeapon=WEAPONS.BOW;player.ammo=7;player.triggerReload();');
ok('A bow keeps its finite quiver and cannot manufacture upgraded arrows', 'playerMagazineCapacity(WEAPONS.BOW)===24&&player.ammo===7&&player.reloadTimer===0');
run(`window.friendly=new Character(1000,1000,false);friendly.isFriendly=true;friendly.isNeutral=false;
  friendly.currentWeapon=WEAPONS.ASSAULT_RIFLE;friendly.leader=player;friendly.ammo=1;friendly.updateEnemy();`);
ok('Friendly update no longer overwrites the upgraded magazine with base capacity', 'friendly.ammo===60');

for (const [drop, expected] of [['SMG','SMG'],['SMG','DUAL_SMG'],['SMG','DUAL_SMG'],['AR','ASSAULT_RIFLE'],['SHOTGUN','SHOTGUN']]) {
  // Deliberately keep the pickup sequence: first/second/repeated SMG use
  // distinct native branches and each must retain the department reward.
  run(`weaponDrops=[{x:player.x,y:player.y,type:'${drop}'}];updateWeaponDrops();`);
  ok(drop + ' acquisition/refill preserves extended magazines (' + expected + ')', `player.currentWeapon===WEAPONS.${expected}&&player.ammo===WEAPONS.${expected}.maxAmmo*2&&weaponDrops.length===0`);
}
for (const [id, key] of [['SMG','SMG'],['DUAL','DUAL_SMG'],['RIFLE','ASSAULT_RIFLE'],['SHOTGUN','SHOTGUN'],['ROCKET','ROCKET_LAUNCHER'],['REVOLVER','REVOLVER']]) {
  run(`score=10000;window.shopItem=upgradeShopItems().find(q=>q.id==='${id}');player.ammo=1;`);
  ok(key + ' real purchase/refill keeps extended capacity', `purchaseUpgrade(shopItem)&&player.currentWeapon===WEAPONS.${key}&&player.ammo===WEAPONS.${key}.maxAmmo*2`);
}
reset();run(`player.currentWeapon=WEAPONS.PISTOL;player.ammo=20;
  touches=[{id:7,...touchCombatLayout().reload}];handleTouches();`);
ok('Touch reload works above the old full-magazine threshold', 'player.reloadTimer===90&&player.ammo===0');
reset();pad={index:0,axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:i===2,value:i===2?1:0}))};
run('player.currentWeapon=WEAPONS.PISTOL;player.ammo=20;handleGamepad();');
ok('Controller reload works above the old full-magazine threshold', 'player.reloadTimer===90&&player.ammo===0');
reset();run(`restoreFrontierEquipment({revolverUnlocked:true,revolverAmmo:11,revolverReserve:2});applyFrontierEquipment(player);`);
ok('Restored upgraded revolver retains rounds above the former six-round cap', 'player.weaponAmmo.REVOLVER===11&&player.mags.REVOLVER===2');
run('applyFrontierEquipment(player,true);');
ok('New revolver ammunition refills to the permanent capacity', 'player.weaponAmmo.REVOLVER===12');

reset();run(`smgUnlocked=dualSmgUnlocked=arUnlocked=shotgunUnlocked=rocketLauncherUnlocked=true;
  isStoryMode=false;townsData={};startAtLevel(2);`);
ok('Travel builds an upgraded player with the farming maximum intact', 'player.hp===125&&player.maxHp===125');
for (const key of ['PISTOL','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','ROCKET_LAUNCHER','TASER'])
  ok(key + ' level entry uses permanent magazine capacity', `player.weaponAmmo[WEAPONS.${key}.name]===WEAPONS.${key}.maxAmmo*2`);
run('resetRunState();player=new Character(0,0,true);');
ok('Starting a fresh file does not inherit another campaign reward', 'window.farmLvl===1&&window.milLvl===1&&player.hp===100&&player.maxHp===100&&player.ammo===17');
assert.equal(P('JSON.stringify(WEAPONS)'), baseWeapons, 'campaign rewards never mutate shared weapon definitions');checks++;
console.log(`${checks}/${checks} farming and military inventory/health checks passed.`);

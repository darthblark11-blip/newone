// The unlocked bow must be usable from the existing weapon controls, keep a
// finite quiver, and share the soldier's muzzle/heading at every view angle.
const assert = require('assert');
const { ctx, probe } = require('./harness');
let checks=0, now=1000, pad=null;
ctx.millis=()=>now;
ctx.navigator.getGamepads=()=>pad?[pad]:[];
ctx.setTimeout=()=>0;
function run(s){return probe(s);}
function check(s,label){assert.ok(run(s),label);checks++;}
function reset(){
  pad=null;now=1000;ctx.touches=[];
  run(`currentLevel=2;currentBiome=2;BIOME_ACTIVE=false;started=true;doTick=true;
    isStoryMode=false;isDead=false;isWin=false;isPaused=false;nm0AmbushActive=false;
    player=new Character(0,0,true);enemiesList=[];bullets=[];particles=[];activeBuildings=[];
    activeParkingCars=[];barrels=[];invalidateColIndex();resetForestWildlife();
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
    window.isDesktop=false;window.showOnScreenControls=true;
    prevGamepadButtons=[];gamepadWasConnected=false;lastWeaponSwapTime=0;
    smgUnlocked=dualSmgUnlocked=arUnlocked=shotgunUnlocked=rocketLauncherUnlocked=false;
    chemistSuitUnlocked=false;headAimToggle=false;isCooking=false;window.milLvl=0;`);
}
function unlock(n=24){run(`player.flags=player.flags||{};player.flags.bowUnlocked=true;player.weaponAmmo.BOW=${n};player.mags.BOW=0;`);}
function controller(buttons=[]){
  now+=400;
  pad={axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:buttons.includes(i)}))};
  run('handleGamepad();');
}
reset();run('cyclePlayerWeapon();');
check('player.currentWeapon===WEAPONS.PISTOL','Locked bow cannot be selected by weapon cycling');
unlock();run('cyclePlayerWeapon();');
check('player.currentWeapon===WEAPONS.BOW&&player.ammo===24','Keyboard cycle function selects the unlocked bow');
run('cyclePlayerWeapon(-1);');
check('player.currentWeapon===WEAPONS.PISTOL','Reverse cycling leaves the bow in the same weapon ring');
reset();unlock();controller([15]);
check('player.currentWeapon===WEAPONS.BOW','Controller D-pad right selects the bow without a gun upgrade');
controller();controller([14]);
check('player.currentWeapon===WEAPONS.PISTOL','Controller D-pad left returns to the pistol');
reset();unlock();ctx.touches=[{x:50,y:65}];run('handleTouches();');
check('player.currentWeapon===WEAPONS.BOW','Touch weapon icon selects the unlocked bow without a gun upgrade');
reset();unlock();run(`isStoryMode=true;cyclePlayerWeapon();`);
check('player.currentWeapon===WEAPONS.TASER','Story weapon cycling keeps the taser before the bow');
run('cyclePlayerWeapon();');
check('player.currentWeapon===WEAPONS.BOW','Story mode bow participates in the same controls');

reset();unlock();run(`player.currentWeapon=WEAPONS.BOW;window.milLvl=2;
  for(let i=0;i<24;i++)player.fire(0);window.bowShotCount=bullets.length;
  player.fire(0);player.triggerReload();`);
check('bowShotCount===24&&bullets.length===24&&player.ammo===0&&player.reloadTimer===0&&player.mags.BOW===0',
  'Empty quiver cannot fire or mint arrows through automatic/manual reload');
check('player.muzzleFlash===0&&particles.length===0',
  'Bow fire produces no gun muzzle flash or muzzle particles');
controller();controller([2]);
check('player.ammo===0&&player.reloadTimer===0','Controller reload cannot refill an empty bow');
pad=null;ctx.touches=[{x:1165,y:440}];run('handleTouches();');
check('player.ammo===0&&player.reloadTimer===0','Touch reload cannot refill an empty bow');
run(`cyclePlayerWeapon();cyclePlayerWeapon();`);
check('player.currentWeapon===WEAPONS.BOW&&player.ammo===0','Switching away and back preserves the depleted quiver');
reset();unlock(7);run(`player.currentWeapon=WEAPONS.BOW;player.triggerReload();`);
check('player.ammo===7&&player.reloadTimer===0','Manual reload preserves a partially used quiver');

// Every heading goes through the actual firing and Character renderer. A bow
// is authored about its grip; its drawn arrow tip and firing offset both use
// 38 local units, so facing changes rotate them together.
run(`window.bowOldDraw=drawHuntingBow;window.bowDrawCalls=0;
  drawHuntingBow=function(...args){bowDrawCalls++;return bowOldDraw(...args);};`);
for(let heading=0;heading<8;heading++){
  run(`bullets=[];player.currentWeapon=WEAPONS.BOW;player.ammo=24;
    player.aimAngle=${heading}*PI/4;player.isMoving=false;player.isArmed=true;
    rightStick.active=true;rightStick.dx=Math.cos(player.aimAngle);rightStick.dy=Math.sin(player.aimAngle);
    window.bowBeforeCalls=bowDrawCalls;player.show();player.fire(player.aimAngle);`);
  check(`bowDrawCalls>bowBeforeCalls&&bullets.length===1&&bullets[0].isArrow&&
    Math.abs(bullets[0].startX-player.x-Math.cos(player.aimAngle)*38)<1e-6&&
    Math.abs(bullets[0].startY-player.y-Math.sin(player.aimAngle)*38)<1e-6`,
    'Aimed bow and its projectile use the same muzzle at heading '+heading);
  run(`rightStick.active=false;player.fireTimer=0;player.muzzleFlash=0;player.reloadTimer=0;
    player.isMoving=true;player.moveAngle=player.aimAngle;window.bowBeforeCalls=bowDrawCalls;player.show();`);
  check('bowDrawCalls>bowBeforeCalls','Carried two-hand bow draws at heading '+heading);
}
run('drawHuntingBow=bowOldDraw;');
check('weaponHands(WEAPONS.BOW)===2','Carried bow uses the existing two-hand pose');
console.log(`${checks}/${checks} bow controls and heading checks passed.`);

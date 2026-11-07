// The sword's linking window belongs to the last accepted swing, rather than
// starting after its animation or extending when an input was rejected.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;

function fresh(tool='SWORD',finisher=false,combo=true) {
  probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
    inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
    window.inNM0SecretOverlay=false;buildGhost=null;
    buildings=activeBuildings=[];parkingCars=activeParkingCars=[];enemiesList=[];barrels=[];
    bullets=[];particles=[];corpses=[];invalidateColIndex();
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:313,y:690}};
    player=new Character(200,200,true);player.aimAngle=0;player.isArmed=false;
    player.meleeCharge=0;player.prevMeleeInputHeld=false;meleeInputHeld=false;
    swordPickedUp=window.pickaxeOwned=window.shovelOwned=true;setMeleeTool('${tool}');
    meleeComboUnlocked=${combo};window.meleeFinisherUnlocked=${finisher};
    chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
    frameCount++;deltaTime=1000/60;`);
}
const press=()=>probe('player.activateMelee(true);');
function elapse(ms,update=false) {
  ctx.deltaTime=ms;ctx.frameCount++;
  probe(update?'player.updatePlayer();':'player.updateSwordComboWindow();');
}
function phaseThree() {
  press();probe('player.meleeTimer=0;');press();probe('player.meleeTimer=0;');press();
  probe('player.meleeTimer=0;');
}

fresh();press();
ok('the first accepted sword swing opens a full one-second window',P('player.meleePhase===1&&player.meleeComboTimer===60&&player.meleeCooldown===0'));
for(let n=0;n<20;n++)elapse(1000/60,true);
ok('animation time counts toward the window instead of extending it',P('player.meleeTimer===0&&Math.abs(player.meleeComboTimer-40)<1e-8'));
const afterAnimation=P('player.meleeComboTimer');
probe('player.updateSwordComboWindow();player.updateSwordComboWindow();');
ok('input and update bookkeeping consume a frame only once',P('player.meleeComboTimer')===afterAnimation);

fresh();press();probe('player.meleeTimer=0;');elapse(999);press();
ok('a link at 999 ms still advances to the backhand',P('player.meleePhase===2&&player.isBackhand&&player.meleeCooldown===0'));
ok('every accepted link refreshes the complete one-second window',P('player.meleeComboTimer===60'));
probe('player.meleeTimer=0;');elapse(999);press();
ok('a later accepted link gets the same full window',P('player.meleePhase===3&&player.meleeComboTimer===60&&!player.isBackhand'));

fresh();phaseThree();elapse(1000);
ok('at exactly one second the stale phase is cleared without cooldown',P('player.meleePhase===0&&player.meleeComboTimer===0&&player.meleeCooldown===0'));
press();ok('the next swing restarts immediately instead of hitting an early terminal cooldown',P('player.meleePhase===1&&player.meleeTimer===20&&player.meleeCooldown===0'));

fresh();phaseThree();ctx.deltaTime=1000;ctx.frameCount++;press();
ok('input arriving before updatePlayer also expires a stale third swing',P('player.meleePhase===1&&player.meleeTimer===20&&player.meleeCooldown===0&&player.meleeComboTimer===60'));
probe('player.updatePlayer();');
ok('the update after accepted input does not age that fresh window twice',P('player.meleeComboTimer===60'));

fresh();press();ctx.deltaTime=400;ctx.frameCount++;press();
ok('an input rejected during the swing does not refresh the window',P('player.meleePhase===1&&player.meleeTimer===20&&Math.abs(player.meleeComboTimer-36)<1e-8'));
probe('player.meleeTimer=0;');ctx.deltaTime=600;ctx.frameCount++;press();
ok('rejected taps cannot keep a combo alive beyond its last accepted swing',P('player.meleePhase===1&&player.meleeCooldown===0&&player.meleeComboTimer===60'));

fresh();phaseThree();elapse(999);press();
ok('a deliberate fourth link without the finisher preserves terminal cooldown',P('player.meleePhase===0&&player.meleeComboTimer===0&&player.meleeCooldown===30'));
elapse(1000);press();
ok('window expiry cannot erase an intentional terminal cooldown',P('player.meleeTimer===0&&player.meleeCooldown===30'));

fresh('SWORD',true);phaseThree();elapse(999);press();
ok('an in-window fourth link still executes the unlocked finisher',P('player.meleePhase===4&&player.meleeTimer===30&&player.meleeComboTimer===0'));
elapse(1000);
ok('combo bookkeeping cannot cancel an active finisher',P('player.meleePhase===4&&player.meleeTimer===30'));

fresh();press();probe('isPaused=true;doTick=false;');elapse(5000);
ok('paused frames do not age the active-play combo window',P('player.meleeComboTimer===60&&player.meleePhase===1'));
probe('isPaused=false;doTick=true;');elapse(0);elapse(999);
ok('resuming preserves the unspent window',P('player.meleePhase===1&&player.meleeComboTimer>0'));
elapse(1);ok('the window expires after one second of resumed play',P('player.meleePhase===0&&player.meleeComboTimer===0'));

fresh('PICKAXE');press();elapse(500,true);
ok('pickaxe animation retains its existing idle-only frame window',P('player.meleeTimer===19&&player.meleeComboTimer===50'));
probe('player.meleeTimer=0;');elapse(500,true);
ok('pickaxe combo recovery still consumes one idle frame per native update',P('player.meleeComboTimer===49'));
fresh('SHOVEL');press();elapse(500,true);
ok('the shovel keeps its own swing and recovery timing',P('player.meleePhase===1&&player.meleeTimer===19&&player.meleeComboTimer===0&&player.meleeCooldown===8'));
fresh('SWORD',false,false);press();elapse(500,true);
ok('a sword without the combo upgrade preserves its normal cooldown',P('player.meleeTimer===19&&player.meleeComboTimer===0&&player.meleeCooldown===45'));

console.log(`${checks}/${checks} sword combo timing checks passed`);

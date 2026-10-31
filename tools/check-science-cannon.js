// Science upgrades change the native cannon's reach, not its charge timing,
// damage, ammunition, aiming arc or dry/wet chain limits.
const assert = require('node:assert/strict');
const {ctx, probe} = require('./harness');
const P = expression => probe('(' + expression + ')');
let checks = 0;
ctx.setTimeout = () => 0;
ctx.navigator.getGamepads = () => [];
function ok(label, condition) { assert.ok(condition, label); checks++; }
function reset(level, targets = [], angle = 0) {
  probe(`currentLevel=currentBiome=2;started=doTick=true;BIOME_ACTIVE=false;
    isStoryMode=isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inDarchonCall=false;
    inWorldBuildingMenu=inOverworldView=inTravelMenu=false;buildGhost=null;
    window.farmLvl=window.milLvl=1;window.sciLvl=${level};
    window.shovelOwned=false;setMeleeTool('NONE');resetForestWildlife();
    buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];barrels=[];
    bullets=[];particles=[];lightnings=[];corpses=[];enemiesList=[];waterPuddles=[];
    invalidateColIndex();chemistSuitUnlocked=true;ninjaSuitUnlocked=explosiveArmorUnlocked=false;
    isCooking=false;cannonInputHeld=meleeInputHeld=grenadeInputHeld=false;
    player=new Character(1000,1000,true);player.aimAngle=${angle};player.moveAngle=${angle};
    player.forceNudge=()=>{};player.checkCol=()=>false;player.isArmed=false;
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
    window.scienceTargets=${JSON.stringify(targets)}.map(t=>{
      const e=new Character(1000+t.x,1000+t.y,false,'NORMAL');
      e.hp=e.maxHp=5000;e.wetTimer=t.wet?1000:0;return e;
    });enemiesList=scienceTargets;`);
}
function fire(charge = 1) {
  probe(`cannonInputHeld=true;for(let i=0;i<${charge};i++){frameCount++;player.updatePlayer();}`);
  ok('holding the cannon charges without releasing a bolt',
    P(`lightnings.length===0&&player.cannonCharge===${charge}&&player.cannonAmmo===4`));
  probe('window.scienceMuzzle=leftActionMuzzle(player,supportAimAngle(player));cannonInputHeld=false;frameCount++;player.updatePlayer();');
  ok('releasing spends one cannon charge and retains the native discharge delay',
    P('lightnings.length===1&&player.cannonAmmo===3&&player.cannonCharge===0&&player.cannonFireDelay===48&&player.cannonCooldown===0'));
  return P('scienceTargets.map(e=>5000-e.hp)');
}

for (const [distance, hit1, hit2] of [[299.5,true,true],[300,false,true],
  [330,false,true],[344.5,false,true],[345,false,false],[345.5,false,false]]) {
  for (const [level, hit] of [[1,hit1],[2,hit2]]) {
    reset(level,[{x:distance,y:0}]);const damage=fire();
    ok(`science ${level} acquisition boundary ${distance}`, damage[0]===(hit?50:0));
  }
}
for (const [gap, hit1, hit2] of [[199.5,true,true],[200,false,true],
  [215,false,true],[229.5,false,true],[230,false,false]]) {
  for (const [level, hit] of [[1,hit1],[2,hit2]]) {
    reset(level,[{x:250,y:0},{x:250+gap,y:0}]);const damage=fire(80);
    ok(`science ${level} chain boundary ${gap}`, damage[0]===(hit?225:150)&&damage[1]===(hit?225:0));
  }
}
for (const level of [1,2]) {
  for (const [charge, expected] of [[1,50],[80,150],[120,350]]) {
    reset(level,[{x:250,y:0}]);const damage=fire(charge);
    ok(`science ${level} retains charge ${charge} damage`,damage[0]===expected);
  }
  reset(level,[{x:250,y:0},{x:350,y:0}]);const dry=fire();
  ok(`science ${level} retains low-charge dry target limit`,dry[0]===50&&dry[1]===0);
  reset(level,[{x:250,y:0,wet:true},{x:465,y:0,wet:true},{x:680,y:0,wet:true}]);
  const wet=fire();
  ok(`science ${level} wet chains retain existing unlimited wet targets and damage scaling`,
    level===1?wet[0]===100&&wet[1]===0&&wet[2]===0:wet.every(d=>d===200));
  reset(level,[{x:330*Math.cos(.41),y:330*Math.sin(.41)}]);
  ok(`science ${level} keeps the existing aiming arc`,fire()[0]===0);
  for(const angle of [0,Math.PI/3,Math.PI]) {
    reset(level,[],angle);fire();
    const end=P('lightnings[0].pts[1]'),range=level===1?300:345;
    ok(`science ${level} empty bolt endpoint follows range at heading ${angle}`,
      Math.hypot(end.x-1000-Math.cos(angle)*range,end.y-1000-Math.sin(angle)*range)<1e-8);
    ok(`science ${level} bolt starts at the existing cannon hand`,P(`
      Math.hypot(lightnings[0].pts[0].x-scienceMuzzle.x,
        lightnings[0].pts[0].y-scienceMuzzle.y)<1e-8`));
  }
}

// Leveling with the suit already equipped applies to the next release; no
// suit purchase or equip action is needed to cache the new reward.
reset(1,[{x:330,y:0}]);fire();
probe('window.sciLvl=2;for(let i=0;i<48;i++){frameCount++;player.updatePlayer();}lightnings=[];cannonInputHeld=true;frameCount++;player.updatePlayer();cannonInputHeld=false;frameCount++;player.updatePlayer();');
ok('equipped cannon receives a newly earned science reward immediately',
  P('chemistSuitUnlocked&&scienceTargets[0].hp===4950&&player.cannonAmmo===2&&lightnings.length===1'));
ok('science does not extend non-player lightning owners',P('chemistCannonRange({isPlayer:false},300)===300&&chemistCannonRange({isPlayer:false},200)===200'));

console.log(`${checks}/${checks} science cannon reach and native discharge checks passed.`);

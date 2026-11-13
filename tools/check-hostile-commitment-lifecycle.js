// Real shared admission must preserve a finishing telegraph without allowing
// stalled burst counters or distant culled actors to occupy firing places.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>a===undefined?.5:Array.isArray(a)?a[0]:b===undefined?a*.5:(a+b)*.5;
let checks=0;
const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
function fresh(type='SAUCER_RED'){
 P(`resetRunState();resetShovelState();resetUndergroundRoute();
  currentLevel=currentBiome=1;BIOME_ACTIVE=false;started=doTick=true;
  isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=false;farmAmbushActive=true;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inCutscene=false;
  inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
  window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
  leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
  ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=isHardMode=false;
  buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
  bullets=[];particles=[];grenades=[];orbs=[];corpses=[];invalidateColIndex();
  player=new Character(0,0,true);player.hp=player.maxHp=player.shield=100000;
  HOSTILE_FRONTLINE.enabled=true;
  window.commitCap=HOSTILE_FRONTLINE.shooters;
  window.commitActor=(type,x)=>{
    const a=new Character(x,0,false,type);a.isFriendly=a.isNeutral=false;a.state='CHASE';
    a.hp=a.maxHp=10000;a.fireTimer=a.reloadTimer=a.meleeTimer=a.stunTimer=0;a.ammo=100;
    a.aimAngle=a.moveAngle=Math.PI;a.aiOffset=7;a.loseSightTimer=10000;
    a.cachedTargetActor=player;a.cachedCanSee=a.cachedShovelVisible=true;
    a.cachedTargetDist=x;a.cachedTargetAngle=Math.PI;a.lastKnownX=a.lastKnownY=0;return a;
  };
  enemiesList=[];window.commitOwners=[];window.commitReserves=[];
  for(let i=0;i<commitCap;i++){
    const e=commitActor(${JSON.stringify(type)},100+i);commitOwners.push(e);enemiesList.push(e);
  }
  for(let i=0;i<3;i++){
    const e=commitActor('NORMAL',300+i);commitReserves.push(e);enemiesList.push(e);
  }
  frameCount=101;deltaTime=1000/60;viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
  hostileFrontlineFireAllowed(commitOwners[0],player);`);
}
for(const type of ['SAUCER_RED','SNAIL_HYBRID']){
 for(const stalled of ['range','sight']){
  fresh(type);
  ok('commitOwners.every(e=>_hostileFrontline.allowed.has(e))&&commitReserves.every(e=>!_hostileFrontline.allowed.has(e))',
   type+' initially owns the real firing team before its burst');
  P(`for(const e of commitOwners){e.burstsFired=1;e.burstCooldown=0;}
   ${stalled==='range'?'for(const e of commitOwners)e.x=650;':'for(const e of commitOwners)e.cachedCanSee=false;'}
   frameCount++;deltaTime=100;hostileFrontlineFireAllowed(commitReserves[0],player);`);
  ok('commitReserves.every(e=>hostileFrontlineFireAllowed(e,player))',
   type+' burst stalled by '+stalled+' yields to clear in-range reserves');
  ok('commitOwners.every(e=>!_hostileFrontline.allowed.has(e))&&_hostileFrontline.allowed.size<=commitCap',
   type+' stale burst counters neither retain nor manufacture extra firing places');
 }
}

// A robot that already bought its wind-up can finish slightly beyond the
// starting range, preserving its full two-beam cadence under crowd pressure.
fresh('NORMAL');
P(`window.commitRobot=commitActor('ROBOT',610);
 enemiesList=commitOwners.slice(0,commitCap-1).concat(commitRobot);
 resetHostileFrontline();hostileFrontlineFireAllowed(commitRobot,player);
 commitRobot.chargeTimer=30;commitRobot.x=650;enemiesList.push(...commitReserves);
 frameCount++;deltaTime=1000/60;`);
ok('hostileFrontlineFireAllowed(commitRobot,player)&&_hostileFrontline.allowed.size===commitCap',
 'a current robot telegraph keeps its place beyond620 while still inside700');
P('for(let i=0;i<30;i++){frameCount++;commitRobot.updateEnemy();}');
ok('commitRobot.chargeTimer===0&&commitRobot.burstLeft===ROBOT_BURST&&bullets.length===0',
 'the out-of-start-range robot completes its existing charge without early release');
P('for(let i=0;i<=ROBOT_BURST_GAP;i++){frameCount++;commitRobot.updateEnemy();}');
ok('bullets.filter(b=>b.shooter===commitRobot&&b.isOrangeBeam).length===2&&commitRobot.burstLeft===0',
 'the admitted robot completes both authored beams outside its starting range');
P('frameCount++;hostileFrontlineFireAllowed(commitReserves[0],player);');
ok('!_hostileFrontline.allowed.has(commitRobot)&&commitReserves.some(e=>_hostileFrontline.allowed.has(e))',
 'finishing the committed burst returns an out-of-range place to the waiting team');

// Far charged actors must yield even when their AI is too distant to advance
// its counters, otherwise eight parked telegraphs could lock the whole team.
for(const [type,field]of [['ROBOT','chargeTimer'],['ARMORED','orbChargeTimer']]){
 fresh(type);
 P(`for(const e of commitOwners){e.${field}=60;e.x=750;}
  frameCount++;deltaTime=100;hostileFrontlineFireAllowed(commitReserves[0],player);`);
 ok('commitReserves.every(e=>hostileFrontlineFireAllowed(e,player))&&commitOwners.every(e=>!_hostileFrontline.allowed.has(e))',
  type+' telegraphs beyond700 cannot lock out active nearby reserves');
}
console.log(checks+' real coordinator stalled-burst, finishing-charge, range and reserve-lifecycle checks passed.');

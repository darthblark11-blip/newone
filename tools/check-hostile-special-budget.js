// Alternate ranged attacks must share admission before their direct effects,
// without suspending native movement or injury/telegraph clocks. Replace only
// the coordinator's answer to exercise admission changes deterministically.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>a===undefined?.5:Array.isArray(a)?a[0]:b===undefined?a*.5:(a+b)*.5;
let checks=0,admitted=false;
const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
const nativeBudget=ctx.hostileFrontlineFireAllowed;
ctx.hostileFrontlineFireAllowed=(a,t)=>t!==ctx.specialBudgetPlayer||admitted;
function fresh(type='NORMAL',distance=350){
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
  bullets=[];particles=[];grenades=[];orbs=[];sludges=[];corpses=[];invalidateColIndex();
  player=new Character(${distance},0,true);player.hp=player.maxHp=100000;player.shield=100000;
  window.specialBudgetPlayer=player;
  window.specialActor=new Character(0,0,false,${JSON.stringify(type)});
  specialActor.hp=specialActor.maxHp=10000;specialActor.isFriendly=specialActor.isNeutral=false;
  specialActor.state='CHASE';specialActor.aimAngle=specialActor.moveAngle=0;
  specialActor.fireTimer=specialActor.reloadTimer=specialActor.meleeTimer=specialActor.stunTimer=0;
  specialActor.ammo=100;specialActor.aiOffset=7;specialActor.loseSightTimer=10000;
  specialActor.cachedTargetActor=player;specialActor.cachedCanSee=specialActor.cachedShovelVisible=true;
  specialActor.cachedTargetDist=${distance};specialActor.cachedTargetAngle=0;
  specialActor.lastKnownX=player.x;specialActor.lastKnownY=player.y;
  enemiesList=[specialActor];frameCount=101;deltaTime=1000/60;
  viewLeft=viewTop=-10000;viewRight=viewBottom=10000;`);
}
function tick(count=1){P(`for(let i=0;i<${count};i++){frameCount++;specialActor.updateEnemy();}`);}
function effects(){return P('bullets.length+grenades.length+orbs.length');}
try{
 for(const type of ['AERIAL','SAUCER','SAUCER_RED','SNAIL','SNAIL_HYBRID','MOLOTOV','AERIAL_PISTOL','ALIEN_GATOR']){
  admitted=false;fresh(type,type==='SNAIL'?230:350);tick(4);
  ok('bullets.length===0&&grenades.length===0&&orbs.length===0',type+' denied attack creates no projectile, grenade or orb');
  ok('Math.hypot(specialActor.x,specialActor.y)>.1',type+' waiting attacker keeps native movement');
  if(type==='SAUCER_RED'||type==='SNAIL_HYBRID')ok('specialActor.burstsFired===0',type+' denial does not consume its burst');
  admitted=true;tick();
  assert.ok(effects()>0,type+' resumes its authored attack after admission');checks++;
 }

 admitted=false;fresh('ROBOT',450);
 P('specialActor.chargeTimer=1;specialActor.burstLeft=2;specialActor.burstGap=0;');tick();
 ok('specialActor.chargeTimer===0&&specialActor.burstLeft===0&&specialActor.burstGap===0&&bullets.length===0',
  'denied robot cancels both pending charge and burst before deferred release');
 ok('specialActor.isMoving&&Math.hypot(specialActor.x,specialActor.y)>0',
  'robot cancellation falls through to movement rather than freezing');
 admitted=true;P('specialActor.fireCooldownR=0;');tick();
 ok('specialActor.chargeTimer===ROBOT_CHARGE&&specialActor.burstLeft===0&&bullets.length===0',
  'readmitted robot begins a full new telegraph');
 P('var specialChargeX=specialActor.x,specialChargeY=specialActor.y;');tick(P('ROBOT_CHARGE'));
 ok('specialActor.chargeTimer===0&&specialActor.burstLeft===ROBOT_BURST&&specialActor.x===specialChargeX&&specialActor.y===specialChargeY',
  'admitted robot retains its complete stationary charge cadence');
 tick(P('ROBOT_BURST_GAP')+1);
 ok('bullets.filter(b=>b.isOrangeBeam).length===2&&specialActor.burstLeft===0&&specialActor.fireCooldownR===ROBOT_COOLDOWN',
  'admitted robot releases its original two-beam burst and cooldown');

 admitted=false;fresh('ARMORED',300);P('specialActor.orbChargeTimer=2;');tick();
 ok('specialActor.orbChargeTimer===0&&orbs.length===0&&specialActor.isMoving',
  'denied armored charge cannot release an orb and does not stop movement');
 admitted=true;tick();
 ok('specialActor.orbChargeTimer===120&&orbs.length===0','readmitted armor restarts its full authored charge');
 tick(118);ok('specialActor.orbChargeTimer===2&&orbs.length===0','armor does not release before its original charge boundary');
 tick();ok('orbs.length===1&&specialActor.fireTimer===100','admitted armor releases one orb at the original boundary');

 // Faction targets bypass the player budget even through direct-spawn paths.
 for(const type of ['ROBOT','ARMORED','SAUCER_RED','AERIAL','SNAIL','SNAIL_HYBRID','MOLOTOV','ALIEN_GATOR']){
  admitted=false;fresh(type,type==='SNAIL'?230:350);
  P('window.specialFoe=new Character(player.x,player.y,false,"NORMAL");specialFoe.isFriendly=true;specialFoe.hp=10000;specialActor.aggroTarget=specialFoe;specialActor.aggroTimer=1000;');
  tick();
  assert.ok(effects()>0||P('specialActor.chargeTimer>0||specialActor.orbChargeTimer>0'),type+' keeps native attacks against a non-player faction target');checks++;
 }

 admitted=false;fresh('NORMAL',300);
 P(`beginLegInjury(specialActor,{tH:'LEGS',a:0,shotId:1001},1);
  specialActor.legInjury.phase='PRONE';specialActor.legInjury.outcome='PRONE';
  specialActor.fireTimer=0;window.specialInjury=specialActor.legInjury;
  window.specialSightCalls=0;window.specialNativeSight=shovelActorLOS;
  shovelActorLOS=(...args)=>{specialSightCalls++;return specialNativeSight(...args);};`);
 P('for(let i=0;i<10;i++){frameCount++;updateLegInjuryActor(specialActor,50);}');
 ok('specialInjury.ageMs>=500&&specialInjury.phaseMs>=500&&specialActor.fireTimer===0&&bullets.length===0',
  'denied floor gunner continues injury timers without firing');
 ok('specialSightCalls===0&&specialInjury.sightTarget===null&&!specialInjury.canSee',
  'denied floor gunner skips shooting sight and invalidates stale cache');
 admitted=true;P('frameCount++;updateLegInjuryCombat(specialActor,specialInjury,50);');
 ok('specialSightCalls>0&&specialInjury.sightTarget===player&&bullets.length===1',
  'readmitted floor gunner acquires fresh real sight before firing');
 P('shovelActorLOS=specialNativeSight;');
 console.log(checks+' alternate attack admission, telegraph/burst cadence, movement, faction and injury checks passed.');
}finally{ctx.hostileFrontlineFireAllowed=nativeBudget;}

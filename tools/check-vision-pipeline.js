// Exercise production perception and Character AI while counting real geometry
// entry points. Distance/cone rejection must precede even tunnel/low-cover prep.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');
ctx.setTimeout=()=>0;ctx.random=(a,b)=>a===undefined?.5:Array.isArray(a)?a[0]:b===undefined?a*.5:(a+b)*.5;
let checks=0;const ok=(value,label)=>{assert.ok(value,label);checks++;};
const names=['shovelActorsVisible','shovelActorLOS','shovelCellAt','stealthHiddenByLowCover','coverLineClear','hasLOS'];
const counts={},original={};
for(const name of names){original[name]=ctx[name];ctx[name]=(...args)=>{counts[name]++;return original[name](...args);};}
const clear=()=>{for(const name of names)counts[name]=0;};
const noSight=()=>counts.shovelActorsVisible===0&&counts.shovelActorLOS===0&&counts.stealthHiddenByLowCover===0&&counts.coverLineClear===0&&counts.hasLOS===0;
function scene(x=300,y=0){
 P(`resetRunState();resetShovelState();resetUndergroundRoute();
 currentLevel=currentBiome=1;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inCutscene=false;
 inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
 window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
 ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=false;
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];invalidateColIndex();
 player=new Character(${x},${y},true);player.hp=player.maxHp=100000;
 window.visionGuard=new Character(0,0,false,'NORMAL');visionGuard.aimAngle=visionGuard.moveAngle=0;
 visionGuard.fireTimer=999999;visionGuard.aiOffset=0;visionGuard.state='PATROL';
 visionGuard.postX=visionGuard.postY=visionGuard.postR=0;
 visionGuard.beatX=90;visionGuard.beatY=0;visionGuard.beatTimer=99999;
 resetActorStance(visionGuard);enemiesList=[visionGuard];
 deltaTime=1000/60;frameCount=100;worldTimeMs=DAY_MS/2;updateSunVector();stealthPerceptionReset();`);
 clear();
}
try{
 for(const [x,y,label]of[[900,0,'outside range'],[-200,0,'behind'],[200,400,'outside cone']]){
  scene(x,y);ok(!P('stealthPerceptionVisible(visionGuard,player)'),label+' is rejected by actual detector');
  ok(noSight(),label+' never enters tunnel, low-cover or solid LOS geometry');
  P(`visionGuard.shovelLevel=player.shovelLevel=1;visionGuard.shovelDepth=player.shovelDepth=36;`);clear();
  ok(!P('stealthPerceptionVisible(visionGuard,player)')&&noSight()&&counts.shovelCellAt===0,
   label+' underground also rejects before scanning excavation cells');
 }
 scene();ok(P('stealthPerceptionVisible(visionGuard,player)')&&counts.coverLineClear===1,
  'an in-range forward target reaches the real height-aware ray');
 const cone=P('STEALTH_PERCEPTION.halfCone'),range=P('STEALTH_PERCEPTION.range');
 for(const [angle,visible]of[[cone-.0001,true],[cone+.0001,false],[-cone+.0001,true],[-cone-.0001,false]]){
  scene(300*Math.cos(angle),300*Math.sin(angle));
  ok(P('stealthPerceptionVisible(visionGuard,player)')===visible,'signed cone boundary '+angle+' keeps its authored result');
 }
 for(const angle of[-cone,cone]){
  scene(300*Math.cos(angle),300*Math.sin(angle));
  ok(P('stealthPerceptionVisible(visionGuard,player)'), 'the exact signed cone edge remains inclusive: '+angle);
 }
 scene(range,0);ok(P('stealthPerceptionVisible(visionGuard,player)'), 'the exact maximum sight distance remains inclusive');
 scene(0,0);ok(P('stealthPerceptionVisible(visionGuard,player)'), 'coincident roots preserve their near-zero cone exception');
 scene(range+.01,0);ok(!P('stealthPerceptionVisible(visionGuard,player,true)')&&noSight(),
  'confirmed tracking bypasses cone but never bypasses maximum sight range');
 scene(-300,0);ok(P('stealthPerceptionVisible(visionGuard,player,true)')&&counts.coverLineClear===1,
  'confirmed combat retains rear-target sight while shoulders turn');
 scene();P(`buildings=activeBuildings=[{x:150,y:0,w:40,h:300,isWall:true,coverType:'HIGH'}];invalidateColIndex();`);clear();
 ok(!P('stealthPerceptionVisible(visionGuard,player)')&&counts.coverLineClear>0,
  'accepted broad-phase candidates still fail actual high-wall occlusion');
 scene();P(`buildings=activeBuildings=[{x:150,y:0,w:40,h:300,isWall:true,isLowWall:true,coverType:'LOW'}];
  resetActorStance(player,'CROUCH');invalidateColIndex();`);clear();
 ok(!P('stealthPerceptionVisible(visionGuard,player)')&&counts.stealthHiddenByLowCover===1,
  'the cheap gate preserves crouched low-cover concealment');
 P("resetActorStance(player,'STAND');");clear();
 ok(P('stealthPerceptionVisible(visionGuard,player)'), 'an upright head still clears the same low wall');

 // A stale visible flag must not invoke preprocessing geometry before range
 // or cone rejection during the full controller, including ready-gun checks.
 scene(-500,0);P(`var visionState=stealthPerceptionState(visionGuard);
  visionState.visible=true;visionState.sampleMs=0;visionGuard.fireTimer=0;`);clear();
 P('stealthUpdateEnemy(visionGuard);');
 ok(noSight()&&!P('visionState.visible'),'controller invalidation rejects an off-cone stale sight flag without any geometry');
 scene();P(`visionGuard.fireTimer=0;var visionState=stealthPerceptionState(visionGuard);visionState.sampleMs=100;`);clear();
 P('stealthUpdateEnemy(visionGuard);');
 ok(counts.shovelActorsVisible===1&&counts.coverLineClear===1&&P('visionState.visible'),
  'close recognition, sense sample and ready-gun validation reuse one layer query and one fresh ray');

 // The common-state handoff reaches native patrol movement; it must not run
 // the old unconditional native sight ray after the cone already rejected it.
 scene(-250,0);clear();P('visionGuard.updateEnemy();');
 ok(noSight()&&P("visionGuard.state==='PATROL'&&visionGuard.x>0"),
  'real Character native patrol handoff preserves movement without a hidden extra sight query');
 scene(-250,0);P('farmAmbushActive=true;ninjaSuitUnlocked=true;');clear();P('visionGuard.updateEnemy();');
 ok(counts.shovelActorLOS===0&&!P('visionGuard.cachedCanSee'),
  'outside common stealth, the native ninja patrol FOV rejects before its LOS cache');
 scene(0,300);P('farmAmbushActive=true;ninjaSuitUnlocked=true;');clear();P('visionGuard.updateEnemy();');
 ok(counts.shovelActorLOS===1&&P('visionGuard.cachedCanSee'), 'the native ninja ninety-degree cone edge remains inclusive');
 scene(600,0);P('farmAmbushActive=true;');clear();P('visionGuard.updateEnemy();');
 ok(counts.shovelActorLOS===1&&P("visionGuard.cachedCanSee&&visionGuard.state==='PATROL'"),
  'native sight includes its exact acquisition edge while the original strict chase threshold stays unchanged');
 scene(900,0);P('farmAmbushActive=true;');clear();P('visionGuard.updateEnemy();');
 ok(counts.shovelActorLOS===0&&!P('visionGuard.cachedCanSee'),'native human acquisition range rejects before geometry');
 scene(-650,0);P(`farmAmbushActive=true;visionGuard.state='CHASE';visionGuard.loseSightTimer=1000;`);clear();
 P('visionGuard.updateEnemy();');
 ok(counts.shovelActorLOS===1&&P('visionGuard.cachedCanSee'),
  'native confirmed combat keeps its longer firing reach and bypasses the acquisition cone');
 scene(1000,0);P(`nm0AmbushActive=true;window.ambushKind='GATE';visionGuard.isAmbush=true;
  visionGuard.state='CHASE';visionGuard.loseSightTimer=1200;`);clear();P('visionGuard.updateEnemy();');
 ok(counts.shovelActorLOS===0&&P("visionGuard.state==='CHASE'&&visionGuard.lastKnownX===player.x&&visionGuard.x>0&&visionGuard.loseSightTimer>1000"),
  'far scripted ambushers keep finite-battle pursuit without spending firearm-range geometry');
 scene();P(`farmAmbushActive=true;ninjaSuitUnlocked=true;
  visionGuard.aggroTarget=new Character(-200,0,false,'NORMAL');visionGuard.aggroTimer=500;`);clear();
 P('visionGuard.updateEnemy();');
 ok(counts.shovelActorLOS===1&&P('visionGuard.cachedTargetActor===visionGuard.aggroTarget&&visionGuard.cachedCanSee'),
  'an explicit faction target retains native rear-target tracking');
 for(const type of['ROBOT','ARMORED','AERIAL','BUG']){
  scene(2000,0);P(`visionGuard.eType=${JSON.stringify(type)};`);
  ok(P('guardNativeVisionCandidate(visionGuard,player)'),type+' retains its specialist native senses');
 }

 scene(0,0);P(`enemiesList=[];
  for(let i=0;i<240;i++){
   const e=new Character(180+i*5,(i%7-3)*8,false,'NORMAL');e.aimAngle=e.moveAngle=0;
   e.aiOffset=i%10;e.fireTimer=999999;e.state='PATROL';e.postX=e.x;e.postY=e.y;e.postR=0;
   e.beatX=e.x+90;e.beatY=e.y;e.beatTimer=99999;enemiesList.push(e);
  }`);clear();
 P('for(let f=0;f<10;f++){frameCount++;for(const guard of enemiesList)guard.updateEnemy();}');
 ok(noSight(),'240 unaware guards over ten real Character frames perform zero perception geometry for rear/out-of-range targets');
 ok(P("enemiesList.every(e=>e.state==='PATROL'&&!e.cachedCanSee)&&bullets.length===0"),
  'stress rejection causes no false detections or shots and retains native patrols');
 console.log(checks+' staged vision, geometry-call, cover/layer and combat-scope checks passed; stress:240 guards ×10 frames,0 sight rays');
}finally{for(const name of names)ctx[name]=original[name];}

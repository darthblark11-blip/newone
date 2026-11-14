// Real hearing, Character updates and collision/perception must agree on one
// historical clue while a human works around cover. AI, sight and movement
// decisions retain their native implementation; the probe wrapper only counts.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');
ctx.setTimeout=()=>0;
let seed=71493,checks=0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;
 return a===undefined?r:Array.isArray(a)?a[Math.floor(r*a.length)]:b===undefined?r*a:a+(b-a)*r;};
const ok=(expression,label)=>{assert.ok(P(expression),label);checks++;};
function scene(peer=false){
 seed=71493;
 P(`resetRunState();resetShovelState();resetUndergroundRoute();
  currentLevel=currentBiome=1;BIOME_ACTIVE=false;started=doTick=true;
  isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=false;
  inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;window.inNM0SecretOverlay=false;buildGhost=null;
  authoredCore=authoredMask=authoredChunks=null;
  buildings=activeBuildings=[{x:100,y:0,w:40,h:120,isWall:true,coverType:'HIGH',hp:Infinity}];
  parkingCars=activeParkingCars=[];barrels=[];bullets=[];particles=[];invalidateColIndex();
  setMeleeTool('NONE');leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
  player=new Character(200,0,true);player.hp=player.maxHp=99999;player.shield=99999;player.isMoving=false;
  player.currentWeapon=WEAPONS.PISTOL;player.dashTimer=0;player.muzzleFlash=0;
  var integratedGuard=new Character(0,0,false,'NORMAL');
  integratedGuard.isFriendly=integratedGuard.isNeutral=false;integratedGuard.currentWeapon=WEAPONS.PISTOL;
  integratedGuard.aiOffset=0;integratedGuard.aimAngle=integratedGuard.moveAngle=0;integratedGuard.fireTimer=0;
  integratedGuard.postX=integratedGuard.postY=0;integratedGuard.postR=1;integratedGuard.beatTimer=999999;
  var integratedPeer=${peer?"new Character(-100,20,false,'NORMAL')":'null'};
  if(integratedPeer){integratedPeer.aiOffset=1;integratedPeer.aimAngle=0;integratedPeer.fireTimer=999999;}
  enemiesList=integratedPeer?[integratedGuard,integratedPeer]:[integratedGuard];
  frameCount=100;deltaTime=1000/60;viewLeft=viewTop=-5000;viewRight=viewBottom=5000;
  worldTimeMs=DAY_MS/2;updateSunVector();stealthPerceptionReset();
  var integratedState=stealthPerceptionState(integratedGuard);
  var integratedQueries=0,integratedQueryFrames=[];
  if(!window.integratedNativeProbe)window.integratedNativeProbe=stealthCoverProbeGoal;
  stealthCoverProbeGoal=function(...args){integratedQueries++;integratedQueryFrames.push(frameCount);return integratedNativeProbe(...args);};`);
}
function tick(count=1,dt=1000/60){P(`for(var integratedTick=0;integratedTick<${count};integratedTick++){
 frameCount++;deltaTime=${dt};integratedGuard.updateEnemy();}`);}
function alertByHearing(){
 ok('!stealthPerceptionVisible(integratedGuard,player)','high wall really conceals the source before sound');
 let shots=0;
 while(P("integratedState.phase!=='ALERT'")&&shots<12){P('stealthShotNoise(player);');tick();shots++;}
 ok("integratedState.phase==='ALERT'&&integratedState.suspicion===1&&!integratedState.visible",'distinct real shot reports fill suspicion without visual recognition');
 ok('integratedState.goalX===200&&integratedState.goalY===0&&integratedGuard.lastKnownX===200&&integratedGuard.lastKnownY===0','hearing hands native combat the historical acoustic position');
 ok('integratedState.coverProbe&&integratedState.coverProbe.goal&&integratedState.coverProbe.x===200&&integratedState.coverProbe.y===0','confirmed hidden contact starts a bounded real corner route');
 ok('bullets.length===0','unseen contact supplies movement rather than blind native fire');
 return shots;
}

scene(true);const shots=alertByHearing();
ok('integratedPeer.stealthPerception.phase===\'ALERT\'&&!integratedPeer.stealthPerception.visible&&integratedPeer.lastKnownX===200&&integratedPeer.lastKnownY===0','the peer receives a historical contact without inheriting sight');
P('var integratedContactAt=integratedState.contactAt;player.x=260;player.y=-10;');tick(6);
ok('!integratedState.visible&&integratedState.goalX===200&&integratedState.goalY===0&&integratedState.coverProbe.x===200&&integratedState.coverProbe.y===0','silent relocation behind the wall does not move the clue or route origin');
ok('integratedPeer.lastKnownX===200&&integratedPeer.lastKnownY===0','team contact does not track the silently relocated player');
const hiddenRoute=P('JSON.stringify([integratedGuard.x,integratedGuard.y,integratedState.coverProbe.goal.x,integratedState.coverProbe.goal.y])');
scene(true);alertByHearing();P('player.x=220;player.y=5;');tick(6);
assert.equal(P('JSON.stringify([integratedGuard.x,integratedGuard.y,integratedState.coverProbe.goal.x,integratedState.coverProbe.goal.y])'),hiddenRoute,'different hidden live positions produce the same historical route');checks++;

// Pause the production world dispatcher, then resume its in-flight corner
// route. No synthetic clock advancement or movement stubs are involved.
P(`var integratedPauseState=JSON.stringify([integratedGuard.x,integratedGuard.y,integratedGuard.aimAngle,
 integratedState.phaseMs,integratedState.suspicion,integratedState.contactAt,integratedState.coverProbe,_redMesaNoise.clock]);
 isPaused=true;doTick=false;
 for(var pauseTick=0;pauseTick<30;pauseTick++){frameCount++;deltaTime=100;updateEntities();}
 isPaused=false;doTick=true;`);
ok('JSON.stringify([integratedGuard.x,integratedGuard.y,integratedGuard.aimAngle,integratedState.phaseMs,integratedState.suspicion,integratedState.contactAt,integratedState.coverProbe,_redMesaNoise.clock])===integratedPauseState','pause freezes sound, suspicion, clue age, route and native facing together');
const pausedPosition=P('[integratedGuard.x,integratedGuard.y]');tick();
ok(`Math.hypot(integratedGuard.x-${pausedPosition[0]},integratedGuard.y-${pausedPosition[1]})>.01`,'resuming continues the existing physical route');

scene();alertByHearing();
P('var integratedReacquired=false,integratedCollision=false,integratedMaxLateral=0,integratedReacquireFrame=0;');
for(let i=0;i<150&&!P('integratedReacquired');i++){
 tick();P(`integratedCollision=integratedCollision||integratedGuard.checkCol(integratedGuard.x,integratedGuard.y);
  integratedMaxLateral=Math.max(integratedMaxLateral,Math.abs(integratedGuard.y));
  if(integratedState.visible){integratedReacquired=true;integratedReacquireFrame=frameCount;}`);
}
ok('integratedReacquired&&integratedMaxLateral>35','native corner movement creates a real new sight line and reacquires the player');
ok('!integratedCollision','the complete flank stays outside collision geometry');
ok('integratedState.coverProbe===null&&integratedState.visible&&integratedGuard.cachedCanSee','fresh sight releases the investigative route into native visible combat');
ok('integratedQueries<=STEALTH_PERCEPTION.coverProbeNodes+1','one physical flank keeps cover searches bounded');

// After the source goes quiet and leaves sight, stale audio must not keep the
// team in combat or repeatedly rebuild a route to an expired contact.
scene();alertByHearing();
P('var integratedLastContact=integratedState.contactAt;player.x=player.y=4000;');
tick(12,100);
ok('_redMesaNoise.events.length===0&&integratedState.contactAt===integratedLastContact','the old burst expires without extending contact from a hidden live player');
P('var integratedQueriesAfterExpiry=integratedQueries;');tick(250,100);
ok("integratedState.phase==='PATROL'&&!integratedState.visible&&integratedState.suspicion===0",'an abandoned acoustic contact runs through search and returns to patrol');
ok('integratedState.goalX===200&&integratedState.goalY===0&&integratedGuard.lastKnownX===200&&integratedGuard.lastKnownY===0','search expiry never substitutes the current hidden player position');
ok('integratedQueries<=STEALTH_PERCEPTION.coverProbeNodes+Math.ceil(STEALTH_PERCEPTION.coverRouteMs/STEALTH_PERCEPTION.coverProbeMs)+1','old contact cannot cause unbounded repeated geometry probes');
P('stealthCoverProbeGoal=integratedNativeProbe;');
console.log(checks+' native acoustic escalation, historical cover flank, reacquisition, pause and stale-contact integration checks passed ('+shots+' blocked shot reports to alert).');

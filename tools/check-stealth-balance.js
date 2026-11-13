// Exercise the real Character update/facing/collision path, rather than only
// asserting tuning constants or calling a replacement AI implementation.
const assert = require('node:assert/strict');
const {ctx, probe: P} = require('./harness');
ctx.setTimeout = () => 0;
let checks = 0;
const ok = (expression, message) => { assert.ok(P(expression), message); checks++; };
const near = (expression, expected, tolerance, message) => {
  assert.ok(Math.abs(P(expression) - expected) <= tolerance, message); checks++;
};

function scene(px = 2000, py = 2000) {
  P(`resetRunState();resetShovelState();
    currentLevel=currentBiome=1;BIOME_ACTIVE=false;started=doTick=true;
    isPaused=isDead=isWin=killcamMode=inStoryIntro=inStoryRoom=inTownCutscene=inFarmCutscene=false;
    inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=inLvl4Cutscene=inWorldBuildingMenu=false;
    inTravelMenu=inUpgradeMenu=inDarchonCall=nm0AmbushActive=farmAmbushActive=false;
    inOverworldView=true;buildings=[];activeBuildings=[];activeParkingCars=[];barrels=[];
    authoredCore=authoredMask=authoredChunks=null;invalidateColIndex();
    player=new Character(${px},${py},true);player.hp=9999;player.isMoving=false;
    leftStick={dx:0,dy:0};rightStick={dx:0,dy:0};
    var qaGuard=new Character(0,0,false,'NORMAL');
    qaGuard.aiOffset=0;qaGuard.aimAngle=qaGuard.moveAngle=0;qaGuard.fireTimer=999999;
    qaGuard.postX=qaGuard.postY=qaGuard.postR=0;
    qaGuard.beatX=90;qaGuard.beatY=0;qaGuard.beatTimer=999999;
    enemiesList=[qaGuard];deltaTime=1000/60;frameCount=100;stealthPerceptionReset();
    var qaState=stealthPerceptionState(qaGuard);qaState.sampleMs=0;
    worldTimeMs=DAY_MS/2;updateSunVector();`);
}
function tick(count = 1, ms = 1000 / 60, actors = '[qaGuard]') {
  P(`deltaTime=${ms};for(var qaTick=0;qaTick<${count};qaTick++){
    frameCount++;for(const qaActor of ${actors})qaActor.updateEnemy();
  }`);
}
function wall(kind = 'HIGH', x = 195, h = 300) {
  P(`activeBuildings=buildings=[{x:${x},y:0,w:40,h:${h},hp:Infinity,
    isWall:true,isLowWall:${kind === 'LOW'},coverType:'${kind}'}];invalidateColIndex();`);
}

// 20 metres uses the physical 20-world-unit metre used by weapon ranges.
// Sample zero proves that close sight is not delayed by the 100ms sight slice.
for (const distance of [399, 400]) {
  scene(distance, 0);tick();
  ok("qaState.phase==='ALERT'&&qaGuard.state==='CHASE'&&qaState.suspicion===1&&qaState.visible",
    `An exposed player at ${distance / 20}m is confirmed on the first Character frame`);
}
scene(401, 0);tick();
ok("qaState.phase!=='ALERT'&&qaState.recognitionMs===0",
  'Just beyond 20m still waits for the normal staggered recognition sample');
scene(401, 0);
tick(1, 100);
ok("qaState.phase==='CURIOUS'&&qaState.suspicion>0&&qaState.suspicion<1&&qaState.recognitionMs>0",
  'Beyond 20m the ordinary suspicion and recognition grace remain active');
scene(600, 0);tick(4, 100);
ok("qaState.phase!=='ALERT'&&qaState.recognitionMs<=400&&qaState.suspicion<1",
  'A distant player does not bypass normal recognition after several sight samples');

for (const stance of ['CROUCH', 'PRONE']) {
  scene(300, 0);
  P(`worldTimeMs=0;updateSunVector();resetActorStance(player,'${stance}');`);tick();
  ok("qaState.phase==='ALERT'&&qaState.visible&&daylight()===0",
    `Unconcealed ${stance.toLowerCase()} at night still obeys the instant close cone`);
}
scene(-200, 0);tick(1, 100);
ok("qaState.phase!=='ALERT'&&!qaState.visible", 'Close rear targets remain outside the vision cone');
scene(300 * Math.cos(Math.PI * .29 - .001), 300 * Math.sin(Math.PI * .29 - .001));tick();
ok("qaState.phase==='ALERT'", 'The close zone includes the forward cone edge');
scene(300 * Math.cos(Math.PI * .29 + .001), 300 * Math.sin(Math.PI * .29 + .001));tick(1, 100);
ok("qaState.phase!=='ALERT'&&!qaState.visible", 'The close zone does not expand the forward cone');
scene(300, 0);wall();tick(1, 100);
ok("qaState.phase!=='ALERT'&&!qaState.visible", 'A high wall still occludes the instant close zone');
for (const stance of ['CROUCH', 'PRONE']) {
  scene(300, 0);wall('LOW');P(`resetActorStance(player,'${stance}');`);tick(1, 100);
  ok("qaState.phase!=='ALERT'&&!qaState.visible",
    `Waist-high cover still conceals a ${stance.toLowerCase()} player inside 20m`);
}
scene(300, 0);wall('LOW');tick();
ok("qaState.phase==='ALERT'&&qaState.visible", 'An upright player remains visible above waist-high cover');
scene(300, 0);
P('player.shovelLevel=1;player.shovelDepth=player.shovelDepthTarget=36;');tick();
ok("qaState.phase!=='ALERT'&&!qaState.visible", 'Close detection cannot see across surface and tunnel layers');

// A report reaches all active eligible hostiles, including guards beyond the
// former local alarm radius. The report itself is never direct vision.
scene(300, 0);
P(`var qaNear=new Character(0,800,false,'NORMAL'),qaFar=new Character(-3000,1800,false,'FEMALE');
  for(const e of[qaNear,qaFar]){e.state='PATROL';e.aimAngle=Math.PI/2;e.fireTimer=999999;}
  var qaAlly=new Character(0,900,false,'NORMAL');qaAlly.isFriendly=true;
  var qaNeutral=new Character(0,1000,false,'NORMAL');qaNeutral.isNeutral=true;
  var qaDead=new Character(0,1100,false,'NORMAL');qaDead.dead=true;qaDead.hp=0;
  var qaRobot=new Character(0,1200,false,'ROBOT');
  var qaFaction=new Character(0,1300,false,'NORMAL');qaFaction.aggroTarget=qaAlly;qaFaction.state='CHASE';
  var qaBuried=new Character(0,1400,false,'NORMAL');qaBuried.shovelLevel=1;qaBuried.shovelDepth=qaBuried.shovelDepthTarget=36;
  enemiesList.push(qaNear,qaFar,qaAlly,qaNeutral,qaDead,qaRobot,qaFaction,qaBuried);`);
tick();
ok("[qaNear,qaFar].every(e=>e.state==='CHASE'&&e.stealthPerception.phase==='ALERT'&&e.stealthPerception.suspicion===1)",
  'One confirmed sighting immediately puts nearby and distant hostile guards into combat');
ok("[qaNear,qaFar].every(e=>e.lastKnownX===300&&e.lastKnownY===0&&e.stealthPerception.goalX===300&&e.stealthPerception.goalY===0&&!e.stealthPerception.visible)",
  'Alerted peers receive the confirmed location without being granted direct sight');
ok("[qaAlly,qaNeutral,qaDead,qaRobot,qaBuried].every(e=>!e.stealthPerception)&&qaFaction.aggroTarget===qaAlly&&!qaFaction.stealthPerception",
  'Broadcast preserves allies, civilians, dead actors, dedicated machine AI, underground actors and existing faction fights');
P(`player.x=2200;player.y=-2000;frameCount++;deltaTime=16.67;qaFar.updateEnemy();`);
ok("qaFar.stealthPerception.goalX===300&&qaFar.stealthPerception.goalY===0&&qaFar.lastKnownX===300&&qaFar.lastKnownY===0&&!qaFar.stealthPerception.visible",
  'A radio report cannot track a player who moves unseen after confirmation');

// Keep one actual spotter in visual contact for longer than the loss timer.
// Far peers may pursue the report but cannot independently see the player.
scene(300, 0);
P(`var qaPeer=new Character(-3000,1800,false,'NORMAL');qaPeer.fireTimer=999999;qaPeer.aimAngle=Math.PI;
  enemiesList.push(qaPeer);`);tick();
tick(160, 100, '[qaGuard,qaPeer]');
ok("qaState.visible&&qaState.phase==='ALERT'&&qaPeer.stealthPerception.phase==='ALERT'&&!qaPeer.stealthPerception.visible",
  'The group stays in combat beyond the loss timer while a spotter still genuinely sees the player');
P('player.x=350;');tick(1, 100, '[qaGuard,qaPeer]');
ok('qaPeer.stealthPerception.goalX===350&&qaPeer.stealthPerception.goalY===0&&!qaPeer.stealthPerception.visible',
  'A still-seeing spotter shares a newly confirmed position with a distant peer');
P('player.x=9000;player.y=-9000;');tick(30, 100, '[qaGuard,qaPeer]');
ok("qaState.phase==='ALERT'&&qaPeer.stealthPerception.phase==='ALERT'&&!qaState.visible&&!qaPeer.stealthPerception.visible",
  'A brief loss of sight keeps both original spotter and distant teammate in the same fight');
tick(130, 100, '[qaGuard,qaPeer]');
ok("qaState.phase==='SEARCH'&&qaPeer.stealthPerception.phase==='SEARCH'",
  'Both spotter and alerted peer return to search after the whole group loses contact');

// Count roster element reads inside production perception. Calling the real
// helper directly isolates broadcast work from unrelated native combat AI.
scene(300, 0);
P(`var qaRoster=[qaGuard];for(var i=1;i<40;i++){
    var e=new Character(0,0,false,'NORMAL');e.state='PATROL';e.aimAngle=0;qaRoster.push(e);
  }
  for(const e of qaRoster)stealthPerceptionState(e).sampleMs=100;
  var qaRosterReads=0;
  enemiesList=new Proxy(qaRoster,{get(target,key,receiver){
    if(typeof key==='string'&&/^[0-9]+$/.test(key))qaRosterReads++;
    return Reflect.get(target,key,receiver);
  }});
  frameCount++;for(const e of qaRoster)stealthUpdateEnemy(e);
  var qaInitialReads=qaRosterReads;qaRosterReads=0;
  for(var i=0;i<6;i++){frameCount++;deltaTime=100;for(const e of qaRoster)stealthUpdateEnemy(e);}`);
ok('qaRoster.every(e=>e.stealthPerception.phase===\'ALERT\')&&qaInitialReads<=qaRoster.length*2',
  'Forty simultaneous spotters create at most a linear initial combat broadcast');
ok('qaRosterReads<=qaRoster.length*12&&_redMesaNoise.clock<650',
  'Repeated confirmed group sightings avoid quadratic roster rebroadcasts and advance sound only once per frame');

// Existing state machines, update order and temporary action ownership must
// not let a searching/investigating teammate ignore ongoing group combat.
for (const order of ['[qaGuard,qaSearching,qaInvestigating]', '[qaSearching,qaInvestigating,qaGuard]']) {
  scene(300, 0);
  P(`var qaSearching=new Character(-3000,1800,false,'NORMAL');
    var qaInvestigating=new Character(-3200,1800,false,'NORMAL');
    for(const e of[qaSearching,qaInvestigating]){e.fireTimer=999999;e.stunTimer=180;stealthPerceptionState(e);}
    stealthEnterPhase(qaSearching,'SEARCH');stealthEnterPhase(qaInvestigating,'INVESTIGATE');
    enemiesList.push(qaSearching,qaInvestigating);`);
  tick(1, 100, order);
  ok("[qaSearching,qaInvestigating].every(e=>e.state==='CHASE'&&e.stealthPerception.phase==='ALERT'&&!e.stealthPerception.visible)",
    `Initial detection promotes preinitialized stunned teammates with update order ${order}`);
  P("stealthEnterPhase(qaSearching,'SEARCH');stealthEnterPhase(qaInvestigating,'INVESTIGATE');");
  tick(1, 100, order);
  ok("[qaSearching,qaInvestigating].every(e=>e.state==='CHASE'&&e.stealthPerception.phase==='ALERT'&&e.stealthPerception.goalX===300)",
    `Continued confirmed combat corrects stale teammate phases with update order ${order}`);
}
scene(300, 0);tick();
P(`var qaLate=new Character(-3000,1800,false,'NORMAL');qaLate.fireTimer=999999;qaLate.stunTimer=180;
  stealthPerceptionState(qaLate);stealthEnterPhase(qaLate,'SEARCH');enemiesList.push(qaLate);`);
tick(1, 100);
ok("qaLate.state==='CHASE'&&qaLate.stealthPerception.phase==='ALERT'&&!qaLate.stealthPerception.visible",
  'A delayed newly active searcher joins the existing fight by the next perception slice without running its own AI');

// Cover removes the shot, not the enemy's knowledge that a fight is ongoing.
// A real escape eventually winds down after fifteen seconds without contact.
scene(300, 0);tick();wall('HIGH', 150, 6000);
P('qaGuard.fireTimer=0;bullets=[];player.x=330;');tick();
ok('!qaState.visible&&bullets.length===0',
  'A ready shot rechecks opaque cover before the next staggered perception sample');
tick(1, 100);
ok("qaState.phase==='ALERT'&&qaGuard.state==='CHASE'&&!qaState.visible&&bullets.length===0",
  'Opaque cover removes direct sight and firing while the guard retains confirmed combat');
ok('qaState.goalX===300&&qaGuard.lastKnownX===300',
  'Crossing behind cover does not copy the hidden player position into contact memory');
tick(29, 100);
ok("qaState.phase==='ALERT'&&qaGuard.state==='CHASE'&&qaState.goalX===300&&!qaState.visible",
  'Three seconds behind cover retains combat pursuit of the last confirmed position');
tick(110, 100);
ok("qaState.phase==='ALERT'&&qaState.goalX===300&&!qaState.visible",
  'Fourteen seconds without new contact still retains the confirmed fight');
tick(20, 100);
ok("qaState.phase==='SEARCH'&&!qaState.visible", 'A silent unseen escape reaches search after the fifteen-second combat memory');
tick(70, 100);
ok("qaState.phase==='PATROL'&&qaGuard.state==='PATROL'", 'A genuinely escaped player eventually lets the completed search return to patrol');

scene(300, 0);tick();
P(`player.x=9000;player.y=-9000;
  for(var i=0;i<180;i++){frameCount++;stealthUpdateNoise(100);}
  deltaTime=100;qaGuard.updateEnemy();`);
ok("qaState.phase==='SEARCH'&&qaGuard.state==='SEARCH'&&!qaState.visible",
  'A guard whose AI was delayed for eighteen world seconds expires contact immediately on its return');

// World time can be identical for several observations in one frame. Fresh
// vision wins tied older audio, and newer sound IDs win tied acoustic reports.
scene(300, 0);
P(`var qaPeer=new Character(-100,300,false,'NORMAL');qaPeer.fireTimer=999999;qaPeer.aimAngle=0;
  enemiesList.push(qaPeer);activeBuildings=buildings=[{x:100,y:200,w:300,h:40,hp:Infinity,coverType:'HIGH'}];invalidateColIndex();`);
tick();
P(`player.x=0;player.y=250;stealthShotNoise(player);player.x=300;player.y=0;
  deltaTime=100;qaGuard.updateEnemy();qaPeer.updateEnemy();`);
ok('qaState.visible&&_redMesaNoise.alarm.x===300&&_redMesaNoise.alarm.y===0&&qaPeer.stealthPerception.goalX===300&&qaPeer.stealthPerception.goalY===0',
  'A wall-hidden teammate cannot replace a newer same-frame visual report with an older sound location');
scene(300, 0);
P(`var qaPeer=new Character(500,0,false,'NORMAL');qaPeer.fireTimer=999999;
  enemiesList.push(qaPeer);`);tick();
P(`player.x=9000;player.y=-9000;frameCount++;stealthUpdateNoise(100);
  stealthEmitNoise(500,100,200,'SHOT');stealthEmitNoise(0,100,200,'SHOT');
  deltaTime=100;qaGuard.updateEnemy();qaPeer.updateEnemy();`);
ok('_redMesaNoise.alarm.x===0&&_redMesaNoise.alarm.y===100&&qaPeer.stealthPerception.goalX===0&&qaPeer.stealthPerception.goalY===100',
  'A guard hearing only an older sound ID cannot overwrite a newer same-clock acoustic report from its teammate');

// Accepted sounds refresh existing combat using their recorded positions.
// The player moves elsewhere before the listener updates, so a live-position
// leak, manufactured visibility or shooting through cover would be observable.
for (const kind of ['RUN', 'SHOT']) {
  scene(300, 0);tick();wall('HIGH', 150, 6000);
  P('player.x=9000;player.y=-9000;');tick(120, 100);
  P(`var qaSoundX=qaGuard.x-70,qaSoundY=qaGuard.y+30;
    player.x=qaSoundX-50;player.y=qaSoundY;player.isMoving=true;leftStick={dx:1,dy:0};
    frameCount++;stealthUpdateNoise(16.67);`);
  if (kind === 'RUN') {
    P('frameCount++;player.x=qaSoundX;stealthUpdateNoise(16.67);');
  } else {
    P('player.x=qaSoundX;player.currentWeapon=WEAPONS.PISTOL;stealthShotNoise(player);');
  }
  P(`player.x=9000;player.y=-9000;player.isMoving=false;leftStick={dx:0,dy:0};
    qaGuard.fireTimer=0;bullets=[];qaGuard.updateEnemy();`);
  ok("qaState.phase==='ALERT'&&qaGuard.state==='CHASE'&&Math.abs(qaState.goalX-qaSoundX)<.001&&Math.abs(qaState.goalY-qaSoundY)<.001&&!qaState.visible&&bullets.length===0",
    `An already alerted guard pursues a historical ${kind.toLowerCase()} source without seeing or firing at the hidden player`);
  tick(40, 100);
  ok("qaState.phase==='ALERT'&&Math.abs(qaState.goalX-qaSoundX)<.001&&Math.abs(qaState.goalY-qaSoundY)<.001&&!qaState.visible",
    `Accepted ${kind.toLowerCase()} sound extends combat beyond the original fifteen-second sight memory`);
}

// Identity changes can occur after this frame has already updated acoustics.
// A newly created guard must not consume the departed run/level's team alarm.
scene(300, 0);tick();
P(`stealthEmitNoise(10,20,280);player=new Character(-2000,-2000,true);
  qaGuard=new Character(1000,0,false,'NORMAL');qaGuard.aiOffset=0;qaGuard.aimAngle=0;
  enemiesList=[qaGuard];qaGuard.updateEnemy();qaState=qaGuard.stealthPerception;`);
ok("!_redMesaNoise.alarm&&_redMesaNoise.events.length===0&&_redMesaNoise.framePlayer===player&&qaState.phase==='PATROL'&&qaGuard.state!=='CHASE'",
  'Replacing the player within an already-updated frame clears old combat reports before a new guard can inherit them');
scene(300, 0);tick();
P(`stealthEmitNoise(10,20,280);currentLevel=currentBiome=2;player.x=player.y=-2000;
  qaGuard=new Character(1000,0,false,'NORMAL');qaGuard.aiOffset=0;qaGuard.aimAngle=0;
  enemiesList=[qaGuard];qaGuard.updateEnemy();qaState=qaGuard.stealthPerception;`);
ok("!_redMesaNoise.alarm&&_redMesaNoise.events.length===0&&_redMesaNoise.level===2&&qaState.phase==='PATROL'&&qaGuard.state!=='CHASE'",
  'Changing levels within an already-updated frame clears old combat reports before a new guard can inherit them');

// Running sound is produced by real displacement and current input. Its
// historical location survives moving the hidden player before AI updates.
scene(0, 200);
P(`player.isMoving=true;leftStick={dx:0,dy:1};stealthUpdateNoise(16.67);
  frameCount++;player.y=250;stealthUpdateNoise(16.67);
  player.x=2000;player.y=2000;leftStick={dx:0,dy:0};player.isMoving=false;`);
tick();
ok("qaState.goalX===0&&qaState.goalY===250&&qaState.phase==='CURIOUS'&&qaState.heardTurnFrame===frameCount",
  'Actual running emits a historical source and reacts before the next sight sample');
near('qaGuard.aimAngle', Math.PI / 2, 1e-10,
  'Running sound turns the actual Character exactly toward its source, surviving the shoulder finally filter');
ok('qaGuard._entityFacing.frame===frameCount&&qaGuard._entityFacing.angle===qaGuard.aimAngle',
  'Urgent sound orientation and the shared facing state agree within the same frame');
scene(-200, 0);
P(`player.currentWeapon=WEAPONS.PISTOL;stealthShotNoise(player);player.x=2000;player.y=2000;`);tick();
near('Math.abs(qaGuard.aimAngle)', Math.PI, 1e-10,
  'A real player gunshot immediately turns toward its recorded rearward source');
ok("qaState.goalX===-200&&qaState.goalY===0&&qaState.phase==='CURIOUS'&&!qaState.visible",
  'Gunfire supplies suspicion and a location without spotting the unseen player');
scene(0, 250);P('stealthShotNoise(player);');tick();
ok("qaState.phase==='ALERT'&&qaState.visible&&qaGuard.state==='CHASE'",
  'A sound turn exposes a close circling player and confirms them in the very same Character frame');
scene(0, 450);P('stealthShotNoise(player);');tick();
ok("qaState.phase==='CURIOUS'&&!qaState.visible&&qaState.recognitionMs===0",
  'Turning toward distant gunfire does not bypass long-range recognition');
scene(300, 0);wall('HIGH', 150);P('stealthShotNoise(player);');tick();
ok("qaState.phase==='CURIOUS'&&!qaState.visible",
  'Turning toward an audible close shot cannot spot the player through its high wall');
scene(-200, 0);
P('player.currentWeapon=WEAPONS.BOW;stealthShotNoise(player);player.x=2000;player.y=2000;');tick();
ok("_redMesaNoise.events.length===0&&qaState.phase==='PATROL'", 'A silent bow does not manufacture a gunfire reaction');
scene();P("stealthEmitNoise(0,600,280,'RUN');");tick();
ok("qaState.phase==='PATROL'&&qaState.goalX===0&&qaState.goalY===0", 'Inaudible running does not redirect a guard');
scene();wall('HIGH', 150);P("stealthEmitNoise(300,0,600,'SHOT');");tick();
ok("qaState.suspicion>0&&qaState.suspicion<STEALTH_PERCEPTION.noiseShotGain*.5&&qaState.goalX===300&&qaState.goalY===0&&!qaState.visible&&qaState.phase!=='ALERT'",
  'A distant shot behind a wall supplies a weak historical clue without instant combat');
const distantBlockedSuspicion=P('qaState.suspicion');
scene();wall('HIGH', 100);P("stealthEmitNoise(200,0,600,'SHOT');");tick();
ok("qaState.phase==='CURIOUS'&&qaState.goalX===200&&qaState.goalY===0", 'An audible wall-attenuated shot still turns the listener');
ok(`qaState.suspicion>${distantBlockedSuspicion}&&qaState.suspicion<STEALTH_PERCEPTION.noiseShotGain`,
  'A nearer blocked shot produces more suspicion than the distant blocked clue');
near('qaGuard.aimAngle', 0, 1e-10, 'Wall attenuation preserves the exact accepted source bearing');

// Stronger response speeds must flow through native movement/collision and
// consume the facing filter once, while ordinary patrols retain their beat.
for (const [phase, minimum] of [['INVESTIGATE', 25], ['SEARCH', 22]]) {
  scene();P(`qaState.goalX=1000;qaState.goalY=0;stealthEnterPhase(qaGuard,'${phase}');`);tick(10);
  ok(`qaGuard.x>${minimum}&&qaGuard.x<40&&Math.abs(qaGuard.y)<.001&&qaGuard.isMoving`,
    `${phase} covers urgent ground through real Character movement without teleporting`);
  ok('qaGuard.x/qaGuard.walkCycle>9&&qaGuard.x/qaGuard.walkCycle<18&&qaGuard._entityFacing.frame===frameCount',
    `${phase} keeps the faster travel gait and shoulder animation synchronized`);
}
scene();P("qaState.goalX=0;qaState.goalY=1000;stealthEnterPhase(qaGuard,'INVESTIGATE');");tick(12);
ok('qaGuard.aimAngle>1.4&&qaGuard.aimAngle<=Math.PI/2&&qaGuard.y>35',
  'Investigation shoulders turn promptly into a perpendicular route through the shared animation filter');
scene();P("qaState.goalX=0;qaState.goalY=0;stealthEnterPhase(qaGuard,'SEARCH');var qaMin=Infinity,qaMax=-Infinity;");
P(`for(var qaTick=0;qaTick<120;qaTick++){frameCount++;qaGuard.updateEnemy();qaMin=Math.min(qaMin,qaGuard.aimAngle);qaMax=Math.max(qaMax,qaGuard.aimAngle);}`);
ok('qaMax-qaMin>.7&&!qaGuard.isMoving&&Math.abs(qaGuard.x)<.001&&Math.abs(qaGuard.y)<.001',
  'An arrived searcher visibly scans a broad angle without drifting or jittering');
scene();wall('HIGH', 150, 160);
P("qaState.goalX=500;qaState.goalY=0;stealthEnterPhase(qaGuard,'INVESTIGATE');var qaClipped=false;");
P(`for(var qaTick=0;qaTick<120;qaTick++){frameCount++;qaGuard.updateEnemy();if(qaGuard.checkCol(qaGuard.x,qaGuard.y))qaClipped=true;}`);
ok('!qaClipped&&Math.hypot(qaGuard.x,qaGuard.y)>100',
  'Urgent investigation retains real obstacle collision and makes progress around a wall');
scene(-250, 0);tick();
ok("qaState.phase==='PATROL'&&qaState.handled===false&&qaGuard.x>0&&qaGuard.x<2&&qaGuard.beatTimer===999998",
  'An unaware ordinary guard retains the original native patrol cadence');

scene();P("qaState.goalX=1000;qaState.goalY=0;stealthEnterPhase(qaGuard,'INVESTIGATE');stealthEmitNoise(0,200,280);var qaBefore=JSON.stringify([qaGuard.x,qaGuard.y,qaGuard.aimAngle,qaState.phaseMs,_redMesaNoise.clock]);isPaused=true;doTick=false;");
P('for(var qaTick=0;qaTick<20;qaTick++){frameCount++;deltaTime=100;updateEntities();}');
ok('JSON.stringify([qaGuard.x,qaGuard.y,qaGuard.aimAngle,qaState.phaseMs,_redMesaNoise.clock])===qaBefore',
  'Pausing the real world loop freezes urgent movement, facing, phase clocks and acoustics');
scene();P('for(var qaTick=0;qaTick<100;qaTick++)stealthEmitNoise(qaTick,0,280);');
ok('_redMesaNoise.events.length===12&&_redMesaNoise.events[0].x===88',
  'Immediate hearing retains the bounded twelve-event acoustic queue');
tick(11, 100);
ok('_redMesaNoise.events.length===0', 'Old sound expires instead of being continuously rediscovered during search');

console.log(`Stealth balance: ${checks} close-cone, group-alert, historical-hearing, motion and pause integration checks passed.`);

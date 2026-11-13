// Bounded corner investigation consumes recorded contacts, native navigation
// and actual perception; it never invents sight or fires at a hidden target.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');ctx.setTimeout=()=>0;
let checks=0;const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
function fresh(px=200,py=0){
 P(`resetRunState();resetShovelState();resetUndergroundRoute();
 currentLevel=currentBiome=1;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
 window.inNM0SecretOverlay=false;buildGhost=null;leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];bullets=[];particles=[];corpses=[];invalidateColIndex();
 player=new Character(${px},${py},true);player.hp=player.maxHp=100000;player.shield=100000;
 var probeGuard=new Character(0,0,false,'NORMAL');probeGuard.currentWeapon=WEAPONS.PISTOL;probeGuard.aiOffset=0;
 probeGuard.aimAngle=probeGuard.moveAngle=0;probeGuard.fireTimer=0;probeGuard.state='CHASE';probeGuard.ammo=100;
 probeGuard.postX=probeGuard.postY=probeGuard.postR=0;enemiesList=[probeGuard];resetActorStance(probeGuard);
 frameCount=100;deltaTime=1000/60;viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
 worldTimeMs=DAY_MS/2;updateSunVector();stealthPerceptionReset();stealthAlert(probeGuard,200,0);
 var probeState=stealthPerceptionState(probeGuard);probeState.visible=false;probeState.sampleMs=100;
 var probeWall={x:100,y:0,w:40,h:120,isWall:true,hp:100};buildings=activeBuildings=[probeWall];invalidateColIndex();
 var probeRows=[];`);
}
function steps(count){P(`for(let i=0;i<${count};i++){
 frameCount++;deltaTime=1000/60;const before=bullets.length;probeGuard.updateEnemy();
 probeRows.push({x:probeGuard.x,y:probeGuard.y,visible:probeState.visible,phase:probeState.phase,
 coverActive:!!probeGuard.cover?.active,peek:probeGuard.cover?.peek||0,seenMs:probeGuard._enemyCover?.seenMs||0,
 goalX:probeState.goalX,goalY:probeState.goalY,probe:probeState.coverProbe&&{x:probeState.coverProbe.x,y:probeState.coverProbe.y,
 age:probeState.coverProbe.ageMs,attempts:probeState.coverProbe.attempts,goal:probeState.coverProbe.goal&&{x:probeState.coverProbe.goal.x,y:probeState.coverProbe.goal.y}},
 shots:bullets.length-before,blocked:probeGuard.checkCol(probeGuard.x,probeGuard.y)});
 }`);}

fresh();steps(100);
ok('probeRows.some(r=>Math.abs(r.y)>45)','The real guard flanks around the finite wall instead of charging its center');
ok('probeRows.some(r=>r.visible)&&probeRows.some(r=>r.probe&&r.probe.goal)','A real corner route regains direct native vision');
ok('probeRows.every(r=>!r.blocked)','Every actual route position remains outside native collision');
ok('probeRows.every(r=>r.visible||r.shots===0)','The guard never shoots while its perception says the player is hidden');
ok('probeRows.filter(r=>r.probe).every(r=>r.probe.attempts<=STEALTH_PERCEPTION.coverProbeNodes)','Each route stays within three bounded corner attempts');

// A normal high-wall peek temporarily hides the guard's own eyes. Its
// existing cover controller must finish that cycle before starting a flank.
fresh(180,-80);P(`probeGuard.y=-100;probeWall.x=60;probeWall.h=140;invalidateColIndex();
 stealthAlert(probeGuard,180,-80);`);steps(220);
ok('probeRows.filter(r=>r.coverActive).length>100&&probeRows.some(r=>r.peek>0)','The real native high-wall approach and repeated peek cycles retain their cover');
ok('probeRows.every(r=>r.visible||r.shots===0)','The own-cover grace never permits blind shots between peeks');
P('player.x=2000;player.y=2000;probeRows=[];');steps(160);
ok('probeRows.some(r=>r.seenMs===0)&&probeRows.some(r=>r.probe&&r.probe.attempts>0)','A genuinely lost contact expires own-cover memory and resumes bounded flanking');

// Moving a silent hidden player cannot move the plan or its recorded clue.
fresh();P('player.x=2000;player.y=2000;');steps(100);
ok('probeRows.every(r=>r.goalX===200&&r.goalY===0&&!r.visible&&r.shots===0)','Silent relocation never updates the last contact or permits hidden fire');
ok('probeRows.filter(r=>r.probe).every(r=>r.probe.x===200&&r.probe.y===0)','Every tactical waypoint is anchored to the historical contact');
ok('probeRows.some(r=>Math.abs(r.y)>45)','Searching the recorded clue still walks a real flank after the player leaves');
const moved=P('JSON.stringify([probeGuard.x,probeGuard.y,probeState.coverProbe])');
P('isPaused=true;stealthProbeLastCover(probeGuard,probeState,100,1);');
ok(`JSON.stringify([probeGuard.x,probeGuard.y,probeState.coverProbe])===${JSON.stringify(moved)}`,'Pause freezes route position and all probe clocks');
P('isPaused=false;');steps(100);
ok('probeState.coverProbe&&probeState.coverProbe.done','A stale route expires instead of scanning the same cover forever');
ok('probeState.coverProbe.ageMs<=STEALTH_PERCEPTION.coverRouteMs+100','The route stops within its short time budget');

// A nearby irrelevant wall does not divert an open-ground investigation.
fresh(2000,2000);P(`probeWall.y=250;invalidateColIndex();
 var originalFaces=coverSolidFaces,faceCalls=0;coverSolidFaces=(...args)=>{faceCalls++;return originalFaces(...args);};
 var openProbe=stealthProbeLastCover(probeGuard,probeState,16.67,1);coverSolidFaces=originalFaces;`);
ok('!openProbe&&faceCalls===0','An unobstructed recorded clue skips expensive cover-face scans');

// An unflankable long wall fails locally; it must not become a global pathfinder.
fresh(2000,2000);P('probeWall.h=2000;invalidateColIndex();var longProbe=stealthProbeLastCover(probeGuard,probeState,16.67,1);');
ok('!longProbe&&!probeState.coverProbe.goal','Distant wall ends fall back to the existing collision search');

// A far radio peer cannot reach any local clue node, so reject it before
// either the long occlusion ray or a cover-face query is attempted.
fresh(2000,2000);P(`probeGuard.x=-3000;var farRays=0,farFaces=0,oldLOS=hasLOS,oldFaces=coverSolidFaces;
 hasLOS=(...args)=>{farRays++;return oldLOS(...args);};coverSolidFaces=(...args)=>{farFaces++;return oldFaces(...args);};
 var farProbe=stealthProbeLastCover(probeGuard,probeState,16.67,1);hasLOS=oldLOS;coverSolidFaces=oldFaces;`);
ok('!farProbe&&farRays===0&&farFaces===0','Distant alert recipients do zero tactical geometry for unreachable clue nodes');

// Query cadence and candidate/path work stay bounded even in dense geometry.
fresh(2000,2000);P(`buildings=activeBuildings=[probeWall,...Array.from({length:180},(_,i)=>({x:40+i%15*24,y:-170+Math.floor(i/15)*30,w:10,h:10,isCrateProp:true}))];
 invalidateColIndex();var pathChecks=0,queries=0,nativeCheck=probeGuard.checkCol.bind(probeGuard),nativeGoal=stealthCoverProbeGoal;
 probeGuard.checkCol=(...args)=>{pathChecks++;return nativeCheck(...args);};
 stealthCoverProbeGoal=(...args)=>{queries++;return nativeGoal(...args);};
 stealthProbeLastCover(probeGuard,probeState,16.67,1);var firstChecks=pathChecks,firstQueries=queries;
 for(let i=0;i<10;i++)stealthProbeLastCover(probeGuard,probeState,16.67,1);
 stealthCoverProbeGoal=nativeGoal;probeGuard.checkCol=nativeCheck;`);
ok('firstQueries===1&&queries===firstQueries','A blocked result is cached for the decision cadence');
ok('firstChecks<=100&&probeState.coverProbe.candidates.length<=24','Dense cover keeps candidate and path collision work bounded');

// Native cover memory may keep posture, but cannot read live target geometry
// or spend ammunition until the ordinary canSee input is true again.
fresh();P(`probeGuard.x=43;probeGuard.y=0;probeWall.x=80;probeWall.y=0;probeWall.w=40;probeWall.h=80;probeWall.isWall=false;probeWall.isCrateProp=true;
 invalidateColIndex();updateActorCover(probeGuard,100,6,0,true);
 probeGuard._enemyCover={searchMs:500,cycleMs:0,seenMs:1800,target:player,goal:null,lastX:200,lastY:0};
 var hitCalls=0,elevationCalls=0,fireCalls=0,oldHit=coverActorHitCenter,oldElevation=combatAimElevation,oldFire=probeGuard.fire;
 coverActorHitCenter=(...args)=>{hitCalls++;return oldHit(...args);};combatAimElevation=(...args)=>{elevationCalls++;return oldElevation(...args);};probeGuard.fire=()=>{fireCalls++;};
 updateEnemyCoverAI(probeGuard,player,false,157,100);
 coverActorHitCenter=oldHit;combatAimElevation=oldElevation;probeGuard.fire=oldFire;`);
ok('hitCalls===0&&elevationCalls===0&&fireCalls===0','Lost cover sight never reads a hidden live hit center or shoots');
ok('probeGuard._enemyCover.lastX===200&&probeGuard._enemyCover.lastY===0','Cover posture cannot replace recorded coordinates with hidden live coordinates');
console.log(checks+' recorded-contact flank, real movement/reacquisition, collision, firing and bounded-work checks passed');

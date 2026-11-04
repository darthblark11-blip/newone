// Small environment contacts, real corner/concave escape and continuous animal
// locomotion. Shooting anatomy and human-body contact remain full sized.
const assert = require('node:assert/strict');
const { probe } = require('./harness');
const run = code => probe(code);
const P = code => probe('(' + code + ')');
let checks = 0;
const ok = (condition, label) => { assert(condition, label); checks++; };

run(`
  currentBiome=currentLevel=2;BIOME_ACTIVE=doTick=true;isStoryMode=false;
  isPaused=isDead=isWin=killcamMode=inCutscene=false;
  inStoryIntro=inOverworldView=inTravelMenu=inDarchonCall=false;
  inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=false;
  inFortCutscene=inWorldBuildingMenu=false;
  player={x:12000,y:6600,hp:300,isPlayer:true,eType:'NORMAL',takeDamage(n){this.hp-=n;}};
  viewLeft=14000;viewRight=16000;viewTop=5600;viewBottom=7600;
  activeBuildings=[];activeParkingCars=[];barrels=[];chunkMgr=null;
  authoredMask=authoredCore=null;colGrid=null;_pushBuckets.clear();
  const navX=15000,navY=6600;
  function navAnimal(species='ELK') {
    resetForestWildlife();_wildlifeSpawnClock=1e9;activeBuildings=[];buildColIndex();
    player.x=12000;player.y=6600;player.hp=300;_pushBuckets.clear();
    const a=wildlifeSpawnAnimal(species,navX,navY);
    a.bodyR=WILDLIFE_SPECIES[species].size;
    a.angle=a.contactAngle=0;a.turnVelocity=0;
    a.state='FLEE';a.alarm=1e9;a.sensorAt=a.thinkAt=1e9;
    a.goalX=navX+340;a.goalY=navY;return a;
  }
  function navRun(a,count) {
    let clear=true,finite=true,maxTurn=0,maxVelocityStep=0,travel=0;
    let minX=a.x,maxX=a.x,minY=a.y,maxY=a.y;
    for(let i=0;i<count;i++) {
      const x=a.x,y=a.y,angle=a.angle,vx=a.vx,vy=a.vy;
      updateForestWildlife(1);
      clear=clear&&wildlifeEnvironmentClear(a,x,y,a.x,a.y);
      finite=finite&&[a.x,a.y,a.vx,a.vy,a.angle,a.phase,a.motionBlend].every(Number.isFinite);
      maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(Math.sin(a.angle-angle),Math.cos(a.angle-angle))));
      maxVelocityStep=Math.max(maxVelocityStep,Math.hypot(a.vx-vx,a.vy-vy));
      travel+=Math.hypot(a.x-x,a.y-y);
      minX=Math.min(minX,a.x);maxX=Math.max(maxX,a.x);
      minY=Math.min(minY,a.y);maxY=Math.max(maxY,a.y);
    }
    return {clear,finite,maxTurn,maxVelocityStep,travel,minX,maxX,minY,maxY};
  }
`);

for(const species of ['GRIZZLY_BEAR','MOOSE','ELK','MULE_DEER','PIKA']) {
  run(`var navA=navAnimal('${species}');var navAnatomy=[navA.bodyR,navA.headR];`);
  ok(P('wildlifeEnvironmentRadius(navA)>=2&&wildlifeEnvironmentRadius(navA)<=6'), species+' uses a compact environment contact');
  run(`activeBuildings=[{x:navX-15,y:navY,w:10,h:120},{x:navX+15,y:navY,w:10,h:120}];buildColIndex();`);
  ok(P('wildlifeCanStand(navA,navX,navY)&&wildlifeEnvironmentClear(navA,navX,navY-70,navX,navY+70)'),
    species+' fits a twenty-unit opening without its art-sized torso snagging');
  ok(P('navA.bodyR===navAnatomy[0]&&navA.headR===navAnatomy[1]'), species+' keeps shooting and art dimensions');
}

run(`navA=navAnimal('GRIZZLY_BEAR');activeBuildings=[{x:navX+30,y:navY,w:2,h:140}];buildColIndex();`);
ok(P('!wildlifeCanStand(navA,navX+30,navY)&&!wildlifeEnvironmentClear(navA,navX,navY,navX+60,navY)'),
  'the small ground contact still sweeps a thin structural wall');
run(`activeBuildings=[{x:navX+30,y:navY,w:40,h:140,isRiver:true}];buildColIndex();`);
ok(P('!wildlifeEnvironmentClear(navA,navX,navY,navX+70,navY)'), 'land mammals still respect actual river volumes');
run(`navA.species='BEAVER';`);
ok(P('wildlifeEnvironmentClear(navA,navX,navY,navX+70,navY)'), 'aquatic wildlife retains water access');
run(`navA=navAnimal('BALD_EAGLE');activeBuildings=[{x:navX+30,y:navY,w:2,h:140}];buildColIndex();`);
ok(P('wildlifeEnvironmentClear(navA,navX,navY,navX+60,navY)'), 'airborne animals fly over structural walls');

run(`navA=navAnimal('GRIZZLY_BEAR');var navHead=wildlifeHeadPoint(navA);`);
ok(P('forestWildlifeHitTest({prevX:navHead.x+navHead.r+4,prevY:navHead.y,x:navHead.x,y:navHead.y}).animal===navA'),
  'the full anatomical head remains hittable beyond the small navigation contact');
ok(P('wildlifeActorBlocked({x:navX+70,y:navY,hp:100},navX+60,navY,15)'),
  'ground humans still meet the real large-animal body');

const obstacles = [
  ['finite wall', `[{x:navX+90,y:navY,w:12,h:220}]`, 280, 0, 700],
  ['convex corner', `[{x:navX+120,y:navY+60,w:240,h:12},{x:navX+240,y:navY-60,w:12,h:240}]`, 300, 140, 1000],
  ['open-mouth concave enclosure', `[{x:navX+30,y:navY-100,w:240,h:12},{x:navX+30,y:navY+100,w:240,h:12},{x:navX+150,y:navY,w:12,h:212}]`, 340, 0, 1200]
];
for(const [label,solids,gx,gy,ticks] of obstacles) {
  run(`navA=navAnimal();navA.goalX=navX+${gx};navA.goalY=navY+${gy};activeBuildings=${solids};buildColIndex();
    var navSeed=serializeForestWildlife().seed;var navResult=navRun(navA,${ticks});`);
  ok(P('navResult.clear&&navResult.finite'), label+' routes continuously without crossing geometry or producing invalid motion');
  ok(P(`Math.hypot(navA.x-(navX+${gx}),navA.y-(navY+${gy}))<45`), label+' reaches the original destination instead of pacing the barrier');
  ok(P(`navA.goalX===navX+${gx}&&navA.goalY===navY+${gy}&&serializeForestWildlife().seed===navSeed`),
    label+' keeps its goal and does not roll random fallback headings');
  ok(P('navResult.maxTurn<=.161'), label+' turns through intermediate headings instead of flipping its body');
  if(label==='open-mouth concave enclosure')ok(P('navResult.minX<navX-90'), 'the concave escape deliberately backs out through the open mouth');
}

// A streamed/placed wall can invalidate a route long before its normal expiry.
// Observe the real request boundary, then let the actual planner finish it.
run(`navA=navAnimal();var navCached=wildlifeNavigation(navA);
  navCached.path.push(navX+220,navY,navX+340,navY);
  navCached.index=0;navCached.until=_wildlifeClock+420;navCached.steerAt=0;
  navCached.wantedX=340;navCached.wantedY=0;
  activeBuildings=[{x:navX+35,y:navY,w:12,h:180}];buildColIndex();
  var navReplanCount=0,navOldRouteCleared=false,navOriginalRequest=wildlifeNavRequest;
  wildlifeNavRequest=function(a,n,dx,dy){
    if(a===navA){navReplanCount++;navOldRouteCleared=n.path.length===0&&n.index===0&&n.until===0;}
    return navOriginalRequest.apply(this,arguments);
  };
  try{updateForestWildlife(1);}finally{wildlifeNavRequest=navOriginalRequest;}
`);
ok(P('navReplanCount===1&&navOldRouteCleared'),
  'a new wall invalidates the cached route and requests a replacement before its expiry');
run(`var navDynamic=navRun(navA,800);`);
ok(P('navDynamic.clear&&navDynamic.finite&&Math.hypot(navA.x-navX-340,navA.y-navY)<45'),
  'the replacement route detours around the new wall and reaches the original goal');
ok(P('navA.goalX===navX+340&&navA.goalY===navY'),
  'dynamic route repair preserves the animal destination');

run(`navA=navAnimal();navRun(navA,24);var navOldVX=navA.vx,navOldBlend=navA.motionBlend;
  navA.goalX=navA.x-500;navA.goalY=navA.y;var navReverse=navRun(navA,1);`);
ok(P('navOldVX>5&&navA.vx>0&&navA.vx<navOldVX'), 'a reversal brakes existing momentum before travelling the other way');
ok(P('navReverse.maxTurn<=.161&&navA.motionBlend>0&&navA.motionBlend<=1'), 'reversal preserves an intermediate facing and continuous gait envelope');
run(`var navReverseRun=navRun(navA,60);`);
ok(P('navA.vx<0&&navReverseRun.maxTurn<=.161&&navReverseRun.maxVelocityStep<2.5'), 'the reversed run accelerates and turns without a one-frame velocity flip');
run(`navA.goalX=navA.x;navA.goalY=navA.y;var navStopSpeed=Math.hypot(navA.vx,navA.vy),navStopPhase=navA.phase;
  updateForestWildlife(1);`);
ok(P('Math.hypot(navA.vx,navA.vy)>0&&Math.hypot(navA.vx,navA.vy)<navStopSpeed&&navA.motionBlend>0&&navA.phase>=navStopPhase'),
  'arriving eases into rest without resetting stride or freezing a full-speed leg pose');
run(`var navFrozen=JSON.stringify([navA.x,navA.y,navA.vx,navA.vy,navA.angle,navA.phase,navA.motionBlend]);
  isPaused=true;updateForestWildlife(3);isPaused=false;`);
ok(P('JSON.stringify([navA.x,navA.y,navA.vx,navA.vy,navA.angle,navA.phase,navA.motionBlend])===navFrozen'),
  'pause freezes both navigation and continuous animation state');

// A substantially changed threat/chase direction supersedes cached waypoints.
// The reference bearing belongs to the requested route, not its next corner.
run(`navA=navAnimal();var navCached=wildlifeNavigation(navA);
  navCached.path=[navX+220,navY,navX+340,navY];navCached.until=420;
  navCached.goalX=navX+340;navCached.goalY=navY;navCached.wantedX=340;navCached.wantedY=0;
  navA.goalX=navX-340;navA.goalY=navY;updateForestWildlife(1);`);
ok(P('navCached.path.length===0&&navCached.index===0&&navCached.until===0&&navA.targetVX<0'),
  'a reversed threat immediately retires the old route and steers toward the new escape goal');
run(`navA=navAnimal();navCached=wildlifeNavigation(navA);
  navCached.path=[navX+80,navY,navX+340,navY];navCached.until=420;
  navCached.goalX=navX+340;navCached.goalY=navY;navCached.wantedX=340;navCached.wantedY=0;
  navA.herd={navPath:navCached.path.slice(),navUntil:420,navWantedX:340,navWantedY:0};
  navA.goalX=navX+120;navA.goalY=navY+330;updateForestWildlife(1);`);
ok(P('navCached.path.length===0&&navA.targetVY>navA.targetVX*2'),
  'a changed bearing cannot reinstall an incompatible route from the herd cache');
run(`navA=navAnimal();navCached=wildlifeNavigation(navA);
  navCached.path=[navX+220,navY,navX+340,navY];navCached.until=420;
  navCached.goalX=navX+340;navCached.goalY=navY;navCached.wantedX=340;navCached.wantedY=0;
  var navOriginalRoute=navCached.path;navA.goalX=navX+420;navA.goalY=navY+30;updateForestWildlife(1);`);
ok(P('navCached.path===navOriginalRoute&&navCached.path.length===4&&navCached.until===420&&navA.targetVX>0'),
  'ordinary same-bearing flee goal drift preserves its useful cached route');
run(`navA=navAnimal();navCached=wildlifeNavigation(navA);
  activeBuildings=[{x:navX+30,y:navY-100,w:240,h:12},{x:navX+30,y:navY+100,w:240,h:12},{x:navX+150,y:navY,w:12,h:212}];buildColIndex();
  wildlifeNavRequest(navA,navCached,340,0);wildlifeAdvanceNavigation();
  var navHadSearch=navCached.queued&&_wildlifeNavJob&&_wildlifeNavJob.animal===navA;
  navA.goalX=navX-340;navA.goalY=navY;updateForestWildlife(1);`);
ok(P('navHadSearch'), 'the reversal fixture starts a real bounded pending route search');
ok(P('!navCached.queued&&!_wildlifeNavQueue.includes(navA)&&(!_wildlifeNavJob||_wildlifeNavJob.animal!==navA)&&navA.targetVX<0'),
  'reversing a pending route removes both queued requests and the active obsolete search');
run('navRun(navA,80);');
ok(P('navA.goalX===navX-340&&navA.x<navX-250&&navCached.path.length===0'),
  'later planning ticks cannot restore the canceled destination');

// Streaming retires outstanding work with each population. New cohorts cannot
// accumulate requests for animals that have already left the resident world.
run(`navA=navAnimal();resetForestWildlife();_wildlifeSpawnClock=1e9;
  activeBuildings=[{x:navX+30,y:navY-100,w:240,h:12},{x:navX+30,y:navY+100,w:240,h:12},{x:navX+150,y:navY,w:12,h:212}];buildColIndex();
  var navLifecycleClean=true,navLifecycleBounded=true,navLifecycleLedger=true,navLifecycleActive=false;
  for(let cohort=0;cohort<6;cohort++){
    for(let i=0;i<WILDLIFE_MAX_ACTORS;i++){
      const a=wildlifeSpawnAnimal('ELK',navX+i*.4,navY);
      a.angle=0;a.state='FLEE';a.alarm=a.sensorAt=a.thinkAt=1e9;a.goalX=navX+340;a.goalY=navY;
      wildlifeNavRequest(a,wildlifeNavigation(a),340,0);
    }
    wildlifeAdvanceNavigation();
    navLifecycleActive=navLifecycleActive||!!_wildlifeNavJob;
    navLifecycleBounded=navLifecycleBounded&&_wildlifeNavQueue.length+(_wildlifeNavJob?1:0)<=forestWildlife.length;
    const retired=forestWildlife.slice(),ledger=JSON.stringify(serializeForestWildlife());
    for(const a of retired)a.x=navX+20000;
    updateForestWildlife(1);
    navLifecycleLedger=navLifecycleLedger&&JSON.stringify(serializeForestWildlife())===ledger;
    navLifecycleClean=navLifecycleClean&&forestWildlife.length===0&&_wildlifeNavQueue.length===0&&_wildlifeNavJob===null&&
      _wildlifeNavOpenCount===0&&retired.every(a=>!a.navigation.queued&&a.navigation.path.length===0);
  }`);
ok(P('navLifecycleActive&&navLifecycleBounded'), 'six successive full cohorts keep queued plus active searches within the live population cap');
ok(P('navLifecycleClean'), 'far despawn immediately removes retired animals from both the queue and active search');
ok(P('navLifecycleLedger'), 'streaming retirement does not reset encounter luck or consume ecology RNG');
for(const mode of ['harvested','dead','stunned']){
  run(`navA=navAnimal();var navRetiring=wildlifeNavigation(navA);wildlifeNavRequest(navA,navRetiring,340,0);
    ${mode==='harvested'?'navA.harvested=true;':mode==='dead'?"navA.dead=true;navA.state='DEAD';navA.ttl=.5;":"navA.state='STUNNED';navA.ttl=.5;"}
    updateForestWildlife(1);`);
  ok(P('forestWildlife.length===0&&!navRetiring.queued&&navRetiring.path.length===0&&_wildlifeNavQueue.length===0&&_wildlifeNavJob===null'),
    mode+' retirement releases pending route work in the actual removal frame');
}
run(`navA=navAnimal();activeBuildings=[{x:navX+30,y:navY-100,w:240,h:12},{x:navX+30,y:navY+100,w:240,h:12},{x:navX+150,y:navY,w:12,h:212}];buildColIndex();
  var navExiting=wildlifeNavigation(navA);wildlifeNavRequest(navA,navExiting,340,0);wildlifeAdvanceNavigation();
  var navExitHadJob=!!_wildlifeNavJob,navExitLedger=JSON.stringify(serializeForestWildlife());
  currentBiome=1;updateForestWildlife(1);currentBiome=2;`);
ok(P('navExitHadJob&&forestWildlife.length===0&&!navExiting.queued&&_wildlifeNavQueue.length===0&&_wildlifeNavJob===null&&_wildlifeNavOpenCount===0&&_wildlifeNavProbeCount===0&&_wildlifeNavExpansionCount===0'),
  'a direct biome exit clears active and queued navigation plus derived counters immediately');
ok(P('JSON.stringify(serializeForestWildlife())===navExitLedger'), 'biome-exit navigation cleanup preserves the ecology ledger');

// Ordinary frame updates use active elapsed time; a 30 Hz device should not
// slow animals to half speed. Explicit simulation steps retain their contract.
run(`var navRateRecords=[];for(const hz of [30,60]){
  navA=navAnimal();navA.goalX=navX+2000;navA.goalY=navY;deltaTime=1000/hz;
  for(let i=0;i<hz;i++)updateForestWildlife();
  navRateRecords.push({travel:navA.x-navX,clock:_wildlifeClock,motion:navA.motionBlend,angle:navA.angle});
}`);
ok(P('navRateRecords.every(r=>r.travel>390&&r.travel<450&&Math.abs(r.clock-60)<1e-8&&r.motion>.99)'),
  'omitted dt advances one second of smooth travel and gait at both 30 and 60 Hz');
ok(P('Math.abs(navRateRecords[0].travel-navRateRecords[1].travel)<6&&Math.abs(navRateRecords[0].angle-navRateRecords[1].angle)<1e-8'),
  '30 and 60 Hz clear travel agree within the small acceleration integration tolerance');
run(`navA=navAnimal();deltaTime=1000/30;updateForestWildlife(1);`);
ok(P('_wildlifeClock===1'), 'an explicit simulation step keeps its value independently of render elapsed time');

console.log(`${checks}/${checks} wildlife navigation, structural clearance and continuous motion checks passed.`);

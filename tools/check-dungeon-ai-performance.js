// A crowded dungeon may not spend unbounded path-search work in one frame.
// These checks count actual node expansions, preserve native movement and
// prove cache invalidation rather than relying on a machine-specific ms limit.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');
ctx.setTimeout=()=>0;
let checks=0;
const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
P(`var aiPerfFixture=()=>{
 currentLevel=currentBiome=9;BIOME_ACTIVE=false;started=doTick=true;
 isPaused=isDead=isWin=killcamMode=false;undergroundRoute.arrivalMs=900;
 inStoryIntro=inStoryRoom=inTravelMenu=inWorldBuildingMenu=false;
 inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=false;
 buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];barrels=[];enemiesList=[];
 corpses=[];particles=[];bullets=[];resetOccultWorld();generateUndergroundMap();
 activeBuildings=buildings;invalidateColIndex();player=new Character(600,-700,true);player.hp=10000;player.shield=0;
 window.meleeToolSel='NONE';window.shovelOwned=false;frameCount++;
};aiPerfFixture();
 var directMage=createOccultMagician('RED',0,-1100,'perf-direct');enemiesList.push(directMage);
 var directQueriesBefore=occultNavigation.stats.directQueries,directHitsBefore=occultNavigation.stats.directCacheHits;
 for(let i=0;i<100;i++){frameCount++;occultNavigate(directMage,0,-1600,120,20);}`);
ok('Math.abs(directMage.y+1340)<1e-7&&Math.abs(directMage.x)<1e-7',
 'Certified direct corridors preserve the exact native walking distance and heading');
ok('occultNavigation.stats.directCacheHits-directHitsBefore>=95&&occultNavigation.stats.directQueries-directQueriesBefore<=3',
 'Repeated collinear movement reuses the already-cleared segment instead of casting a long ray every frame');
P('var directBeforePush=occultNavigation.stats.directQueries;directMage.x+=5;frameCount++;occultNavigate(directMage,0,-1600,120,20);');
ok('occultNavigation.stats.directQueries===directBeforePush+1',
 'An actor pushed sideways immediately revokes its cached corridor proof');
P(`var movingWall={x:0,y:-1500,w:100,h:20,isWall:true};buildings.push(movingWall);
 var wallClosed=!occultNavigationCorridorClear(directMage,directMage._occultNav,0,-1600);
 movingWall.x=500;var wallMoved=occultNavigationCorridorClear(directMage,directMage._occultNav,0,-1600);
 movingWall.x=0;var wallReturned=!occultNavigationCorridorClear(directMage,directMage._occultNav,0,-1600);`);
ok('wallClosed&&wallMoved&&wallReturned&&!occultGeometryStatic()',
 'Loose moving fixtures never reuse a static corridor cache');

P(`aiPerfFixture();undergroundDungeon.opened=UNDERGROUND_GATES.map(g=>g.id);
 for(const g of UNDERGROUND_GATES)removeUndergroundGateBuilding(g.id);
 var longWalker=createOccultZombie(0,1100,'long-owner');enemiesList.push(longWalker);
 frameCount++;occultNavigate(longWalker,0,-6870,78,20);
 var spentBeforeRepeat=occultNavigationRuntime.expanded;
 for(let i=0;i<30;i++)occultNavigationRuntimePump();`);
ok('occultNavigationRuntime.expanded<=OCCULT_NAV.expansionsPerFrame&&occultNavigationRuntime.expanded===spentBeforeRepeat',
 'Repeated actors cannot buy a second path-expansion budget in the same frame');
P(`var spentBeforeGate=occultNavigationRuntime.expanded;
 occultInvalidateNavigation();var restoredNav={path:[],index:0,repathMs:0,revision:0};
 occultNavigationRuntimeRequest(longWalker,restoredNav,0,-6870);occultNavigationRuntimePump();`);
ok('occultNavigationRuntime.expanded<=OCCULT_NAV.expansionsPerFrame&&occultNavigationRuntime.expanded>=spentBeforeGate',
 'Door invalidation cancels old work without restarting the current frame budget');

// Every possible living actor gets one request. Their starts overlap only in
// this queue stress fixture; no movement or actor-body collision is skipped.
P(`aiPerfFixture();var queuedActors=[];
 for(let i=0;i<OCCULT.maxActors;i++){
  const e=createOccultZombie(-510,-1100,'queue-owner-'+i);enemiesList.push(e);
  const nav=e._occultNav={path:[],index:0,repathMs:0,revision:0};queuedActors.push(e);
  occultNavigationRuntimeRequest(e,nav,-510,-1660);
 }
 var queuedAtStart=occultNavigationRuntime.queue.length-occultNavigationRuntime.head;
 var duplicateBefore=queuedAtStart;
 for(const e of queuedActors)occultNavigationRuntimeRequest(e,e._occultNav,-510,-1660);`);
ok('queuedAtStart===OCCULT.maxActors&&occultNavigationRuntime.queue.length-occultNavigationRuntime.head===duplicateBefore',
 'All 342 possible actors fit one bounded queue without duplicate requests');
P(`var queueFrames=0,budgetRespected=true;
 while(queueFrames++<150&&(occultNavigationRuntime.active||occultNavigationRuntime.head<occultNavigationRuntime.queue.length)){
  frameCount++;occultNavigationRuntimePump();
  budgetRespected=budgetRespected&&occultNavigationRuntime.expanded<=OCCULT_NAV.expansionsPerFrame;
 }
 var allRoutesReady=queuedActors.every(e=>e._occultNav.pending===null&&e._occultNav.path.length>0);`);
ok('budgetRespected&&allRoutesReady&&queueFrames<=150',
 'A full crowd finishes its routes without starving late actors or exceeding any frame work budget');
ok('occultNavigationRuntime.stats.maxQueued<=OCCULT.maxActors&&occultNavigationRuntime.stats.maxFrameExpanded<=OCCULT_NAV.expansionsPerFrame',
 'The lifetime counters confirm bounded queued actors and per-frame search work');
ok('occultNavigationRuntime.stats.workspaceAllocations<=3',
 'Hundreds of searches reuse one typed workspace per map instead of allocating a heap for each actor');
P(`var firstNav=queuedActors[0]._occultNav;
 var changedActor=queuedActors[0];occultNavigationRuntimeRequest(changedActor,firstNav,-350,-1650);
 var staleJob=firstNav.pending;occultNavigationRuntimeRequest(changedActor,firstNav,-200,-1200);
 var latestJob=firstNav.pending;
 for(let i=0;i<10&&firstNav.pending;i++){frameCount++;occultNavigationRuntimePump();}`);
ok("staleJob.status==='CANCELLED'&&latestJob.status==='DONE'&&firstNav.gx===-200&&firstNav.gy===-1200",
 'A changed goal cancels stale queued work and installs only the latest destination');

P(`aiPerfFixture();var pausedActor=createOccultZombie(-510,-1100,'pause-owner');enemiesList.push(pausedActor);
 var pausedNav=pausedActor._occultNav={path:[],index:0,repathMs:0,revision:0};
 occultNavigationRuntimeRequest(pausedActor,pausedNav,-510,-1660);isPaused=true;
 var expandedAtPause=occultNavigationRuntime.stats.expanded;frameCount++;occultNavigationRuntimePump();`);
ok("occultNavigationRuntime.stats.expanded===expandedAtPause&&pausedNav.pending.status==='QUEUED'",
 'Paused combat cannot consume path-search work or complete pending routes');
P('isPaused=false;resetOccultWorld();');
ok('occultNavigationRuntime.active===null&&occultNavigationRuntime.queue.length===0&&occultNavigationRuntime.work===null&&occultCrowdBucketPool.length===0',
 'Replacing the world releases queued targets, typed search storage and reusable crowd references');

P(`aiPerfFixture();var crowdA=createOccultZombie(0,-1100,'a'),crowdB=createOccultZombie(20,-1100,'b');enemiesList.push(crowdA,crowdB);
 var crowdMap=occultNavigationCrowd(),bucketPool=occultCrowdBucketPool.slice(),separationPoint=occultNavigationSeparation(crowdA);
 frameCount++;occultNavigationCrowd();var separationAgain=occultNavigationSeparation(crowdA);`);
ok('occultNavigation.crowd===crowdMap&&occultCrowdBucketPool.every((bucket,i)=>bucket===bucketPool[i])&&separationPoint===separationAgain&&separationAgain.x<0',
 'Crowd separation retains its direction while reusing map, bucket arrays and result vectors');
console.log('Dungeon AI performance: '+checks+' work-budget, route fairness, cache and allocation checks passed.');

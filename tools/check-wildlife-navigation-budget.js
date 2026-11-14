// A startled population shares a fixed amount of path-search work. Measure
// actual queries and motion rather than elapsed time, which varies by machine.
const assert = require('node:assert/strict');
const { probe } = require('./harness');
const P = code => probe('(' + code + ')');
let checks = 0;
const ok = (value, label) => { assert(value, label); checks++; };

probe(`
  currentBiome=currentLevel=2;BIOME_ACTIVE=doTick=true;isStoryMode=false;
  isPaused=isDead=isWin=killcamMode=inCutscene=inStoryIntro=false;
  inOverworldView=inTravelMenu=inDarchonCall=inTownCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=false;
  inFortCutscene=inWorldBuildingMenu=false;
  player={x:12000,y:6600,hp:300,isPlayer:true};
  viewLeft=11000;viewRight=20000;viewTop=4000;viewBottom=18000;
  authoredCore=authoredMask=authoredChunks=null;chunkMgr=null;
  activeParkingCars=[];barrels=[];_pushBuckets.clear();
  __budgetQueries=0;__budgetVisits=0;__budgetRosterReads=0;
  const budgetClear=wildlifeEnvironmentClear,budgetSegment=wildlifeEnvironmentSegmentBlocked;
  const budgetArrays=new WeakMap();
  wildlifeEnvironmentClear=function(){__budgetQueries++;return budgetClear.apply(this,arguments);};
  wildlifeEnvironmentSegmentBlocked=function(near,...args){
    let counted=budgetArrays.get(near);
    if(!counted){
      counted=new Proxy(near,{get(target,key,receiver){
        if(typeof key==='string'&&/^\\d+$/.test(key))__budgetVisits++;
        return Reflect.get(target,key,receiver);
      }});
      budgetArrays.set(near,counted);
    }
    return budgetSegment.call(this,counted,...args);
  };
  enemiesList=new Proxy(Array.from({length:4000},(_,i)=>({x:40000+i,y:40000,hp:100})),{
    get(target,key,receiver){if(key===Symbol.iterator||key==='length')__budgetRosterReads++;return Reflect.get(target,key,receiver);}
  });
  function runNavigationBudget(farSolids) {
    resetForestWildlife();_wildlifeSpawnClock=1e9;activeBuildings=[];
    for(let i=0;i<48;i++){
      const y=6000+i*200;
      activeBuildings.push({x:15100,y,w:35,h:160,hp:100},
        {x:15020,y:y+62,w:190,h:35,hp:100});
      const a=wildlifeSpawnAnimal('ELK',15000,y);
      a.angle=a.contactAngle=0;a.goalX=19000;a.goalY=y;
      a.sensorAt=a.thinkAt=1e9;a.state='FLEE';a.alarm=1e9;
    }
    for(let i=0;i<farSolids;i++)activeBuildings.push({x:40000+i*60,y:35000,w:30,h:30,hp:100});
    buildColIndex();__budgetQueries=__budgetVisits=__budgetRosterReads=0;
    const result={peakSearch:0,peakExpansions:0,peakQueries:0,peakQueue:0,searchFrames:0,finite:true};
    for(let f=0;f<600;f++){
      const before=__budgetQueries;updateForestWildlife(1);
      result.peakSearch=Math.max(result.peakSearch,_wildlifeNavProbeCount);
      result.peakExpansions=Math.max(result.peakExpansions,_wildlifeNavExpansionCount);
      result.peakQueries=Math.max(result.peakQueries,__budgetQueries-before);
      result.peakQueue=Math.max(result.peakQueue,_wildlifeNavQueue.length);
      if(_wildlifeNavProbeCount)result.searchFrames++;
      result.finite=result.finite&&forestWildlife.every(a=>[a.x,a.y,a.angle,a.vx,a.vy].every(Number.isFinite));
      if(_wildlifeNavJob&&_wildlifeNavJob.expansions>WILDLIFE_NAV_EXPANSIONS)throw Error('Unbounded animal search');
    }
    result.queries=__budgetQueries;result.visits=__budgetVisits;result.rosterReads=__budgetRosterReads;
    result.positions=forestWildlife.map(a=>[a.x,a.y,a.angle]);
    result.meanDistance=forestWildlife.reduce((sum,a,i)=>sum+Math.hypot(a.x-15000,a.y-(6000+i*200)),0)/48;
    return result;
  }
  __localBudget=runNavigationBudget(0);
  __distantBudget=runNavigationBudget(2000);
`);

for (const name of ['__localBudget','__distantBudget']) {
  const r = P(name);
  ok(r.finite && r.positions.length === 48, name+' retains a finite full-sized frightened population');
  ok(r.searchFrames > 0 && r.peakSearch > 0 && r.peakSearch <= 96,
    name+' shares at most 96 path-edge checks across the entire population each tick');
  ok(r.peakExpansions > 0 && r.peakExpansions <= 24,
    name+' shares at most 24 node expansions across the entire population each tick');
  ok(r.peakQueue <= 48, name+' never queues duplicate path requests for one animal');
  ok(r.peakQueries <= 48*8+96, name+' bounds movement, steering and path queries when all animals are obstructed');
  ok(r.rosterReads === 0, name+' never scans the 4,000 unrelated military actors');
  ok(r.meanDistance > 500, name+' makes sustained escape progress instead of purchasing low query counts by freezing');
}
ok(P('__localBudget.queries===__distantBudget.queries&&__localBudget.visits===__distantBudget.visits'),
  'adding 2,000 distant solids does not add collision queries or candidate visits');
ok(P('JSON.stringify(__localBudget.positions)===JSON.stringify(__distantBudget.positions)'),
  'irrelevant distant geometry cannot change local escape motion');

// Cached/closed edges can make a node expansion cost no new collision query.
// Saturate that case explicitly: an edge-query cap alone must not allow the
// whole remaining frontier to execute in one rendered frame.
probe(`
  const cachedAnimal=forestWildlife[0];cachedAnimal.navigation.queued=true;
  _wildlifeNavQueue.length=0;_wildlifeNavState.fill(2);
  _wildlifeNavCost.fill(0);_wildlifeNavEdgeTested.fill(255);_wildlifeNavEdgeClear.fill(0);
  _wildlifeNavOpenCount=256;
  for(let i=0;i<256;i++){_wildlifeNavOpen[i]=i;_wildlifeNavState[i]=1;}
  _wildlifeNavJob={animal:cachedAnimal,x:cachedAnimal.x,y:cachedAnimal.y,
    start:840,goal:WILDLIFE_NAV_NODES-1,expansions:0};
  const beforeCachedQueries=__budgetQueries;
  wildlifeAdvanceNavigation();
  __cachedBudget={queries:__budgetQueries-beforeCachedQueries,edges:_wildlifeNavProbeCount,
    expansions:_wildlifeNavExpansionCount,remaining:_wildlifeNavOpenCount};
`);
ok(P('__cachedBudget.queries===0&&__cachedBudget.edges===0'),
  'the saturated cached frontier performs no new environment query');
ok(P('__cachedBudget.expansions===24&&__cachedBudget.remaining===232'),
  'cached-edge work yields after 24 expansions and retains the rest for later ticks');
console.log(`${checks}/${checks} wildlife shared navigation budget checks passed.`);

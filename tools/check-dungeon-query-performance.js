// Compare the accelerated dungeon queries with the original brute-force
// solver. Gate/floor seams and thin solids must remain exactly the same.
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {ctx,probe:P}=require('./harness');
ctx.setTimeout=()=>0;
let checks=0;
const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
P(`currentLevel=currentBiome=9;BIOME_ACTIVE=false;started=doTick=true;
 buildings=[];activeBuildings=[];barrels=[];parkingCars=[];activeParkingCars=[];enemiesList=[];
 generateUndergroundMap();activeBuildings=buildings;invalidateColIndex();
 player=new Character(0,1100,true);var referenceSolidTests=0,referenceFloorSamples=0;
 function referenceFloorPoint(x,y,r=0){
  if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(r)||r<0)return false;
  const inside=(px,py)=>UNDERGROUND_FLOORS.some(f=>px>=f.x&&px<=f.x+f.w&&py>=f.y&&py<=f.y+f.h);
  if(!inside(x,y)||undergroundGateBlocksPoint(x,y,r))return false;
  for(const [dx,dy]of[[r,0],[-r,0],[0,r],[0,-r],[r*.7071,r*.7071],[-r*.7071,r*.7071],[r*.7071,-r*.7071],[-r*.7071,-r*.7071]])
   if(!inside(x+dx,y+dy))return false;
  return true;
 }
 function referencePoint(x,y,r=0,ignore=null){
  if(!Number.isFinite(x)||!Number.isFinite(y))return false;
  if(!referenceFloorPoint(x,y,r))return false;
  for(const b of buildings){
   if(b.occultDecor||b.isUndergroundDecor||b.isDeck||!Number.isFinite(b.w)||!Number.isFinite(b.h))continue;
   referenceSolidTests++;
   if(x+r>b.x-b.w/2&&x-r<b.x+b.w/2&&y+r>b.y-b.h/2&&y-r<b.y+b.h/2)return false;
  }
  if(ignore){
   if(player&&player!==ignore&&occultAlive(player)&&Math.hypot(x-player.x,y-player.y)<r+19)return false;
   for(const e of enemiesList)if(e!==ignore&&occultAlive(e)&&Math.hypot(x-e.x,y-e.y)<r+17)return false;
  }return true;
 }
 function referenceSegment(x0,y0,x1,y1,r=2){
  if(![x0,y0,x1,y1,r].every(Number.isFinite))return false;
  const dx=x1-x0,dy=y1-y0,count=Math.max(1,Math.ceil(Math.hypot(dx,dy)/6));if(count>512)return false;
  for(let i=0;i<=count;i++){referenceFloorSamples++;if(!referenceFloorPoint(x0+dx*i/count,y0+dy*i/count,r))return false;}
  for(const b of buildings){
   if(b.occultDecor||b.isUndergroundDecor||b.isDeck||!Number.isFinite(b.w)||!Number.isFinite(b.h))continue;
   referenceSolidTests++;let lo=0,hi=1,hit=true;
   for(const [start,delta,min,max]of[[x0,dx,b.x-b.w/2-r,b.x+b.w/2+r],[y0,dy,b.y-b.h/2-r,b.y+b.h/2+r]]){
    if(Math.abs(delta)<1e-9){if(start<min||start>max){hit=false;break;}}
    else{const a=(min-start)/delta,c=(max-start)/delta;lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));if(lo>hi){hit=false;break;}}
   }if(hit)return false;
  }return true;
 }
 function referenceTrace(x0,y0,x1,y1,r=0){
  const dx=x1-x0,dy=y1-y0,distance=Math.hypot(dx,dy);let fraction=1,hit=false;
  for(const b of buildings){
   if(b.occultDecor||b.isUndergroundDecor||b.isDeck||!Number.isFinite(b.w)||!Number.isFinite(b.h))continue;
   referenceSolidTests++;let lo=0,hi=1,intersects=true;
   for(const [start,delta,min,max]of[[x0,dx,b.x-b.w/2-r,b.x+b.w/2+r],[y0,dy,b.y-b.h/2-r,b.y+b.h/2+r]]){
    if(Math.abs(delta)<1e-9){if(start<min||start>max){intersects=false;break;}}
    else{const a=(min-start)/delta,c=(max-start)/delta;lo=Math.max(lo,Math.min(a,c));hi=Math.min(hi,Math.max(a,c));if(lo>hi){intersects=false;break;}}
   }if(intersects&&lo<=fraction){fraction=lo;hit=true;}
  }
  const steps=Math.max(1,Math.ceil(distance*fraction/6));
  for(let i=0;i<=steps;i++){
   const t=fraction*i/steps;referenceFloorSamples++;if(referenceFloorPoint(x0+dx*t,y0+dy*t,r))continue;
   let lo=i?fraction*(i-1)/steps:0,hi=t;
   for(let k=0;k<10;k++){const mid=(lo+hi)/2;referenceFloorSamples++;if(referenceFloorPoint(x0+dx*mid,y0+dy*mid,r))lo=mid;else hi=mid;}
   fraction=lo;hit=true;break;
  }
  const safe=hit?Math.max(0,fraction-.05/Math.max(1,distance)):fraction;
  return{x:x0+dx*safe,y:y0+dy*safe,fraction:safe,hit};
 }
 var querySeed=428917,queryRand=()=>{querySeed=(Math.imul(querySeed,1664525)+1013904223)>>>0;return querySeed/4294967296;};
 var mismatch=[],pointCases=[],rayCases=[];
 for(let i=0;i<3500;i++){
  const room=UNDERGROUND_FLOORS[i%UNDERGROUND_FLOORS.length],x=room.x-30+queryRand()*(room.w+60),y=room.y-30+queryRand()*(room.h+60);
  const r=[0,1,3,8,15,17,20][i%7],angle=queryRand()*Math.PI*2,length=queryRand()*1300;
  pointCases.push([x,y,r]);rayCases.push([x,y,x+Math.cos(angle)*length,y+Math.sin(angle)*length,r]);
 }
 function compareQueries(label){
  for(const p of pointCases){
   if(referenceFloorPoint(...p)!==undergroundPointWalkable(...p))mismatch.push(label+':floor '+JSON.stringify(p));
   if(referencePoint(...p)!==occultPointClear(...p))mismatch.push(label+':point '+JSON.stringify(p));
  }
  for(const q of rayCases){
   if(referenceSegment(...q)!==occultClearSegment(...q))mismatch.push(label+':segment '+JSON.stringify(q));
   const a=referenceTrace(...q),b=occultTraceSpell(...q);
   if(a.hit!==b.hit||Math.abs(a.fraction-b.fraction)>1e-12||Math.abs(a.x-b.x)>1e-9||Math.abs(a.y-b.y)>1e-9)mismatch.push(label+':trace '+JSON.stringify({q,a,b}));
  }
 }
 compareQueries('closed');`);
assert.deepEqual(Array.from(P('mismatch')),[],'Closed-door query parity');checks++;
P(`undergroundDungeon.opened=UNDERGROUND_GATES.map(g=>g.id);for(const g of UNDERGROUND_GATES)removeUndergroundGateBuilding(g.id);compareQueries('open');`);
assert.deepEqual(Array.from(P('mismatch')),[],'Open-door query parity');checks++;
P(`for(const f of UNDERGROUND_FLOORS)for(const r of [0,1,15,17])for(const epsilon of [-.0001,0,.0001]){
 const pts=[[f.x+r+epsilon,f.y+f.h/2],[f.x+f.w-r+epsilon,f.y+f.h/2],[f.x+f.w/2,f.y+r+epsilon],[f.x+f.w/2,f.y+f.h-r+epsilon]];
 for(const [x,y]of pts)if(referenceFloorPoint(x,y,r)!==undergroundPointWalkable(x,y,r)||referencePoint(x,y,r)!==occultPointClear(x,y,r))mismatch.push('edge '+JSON.stringify({x,y,r}));
}`);
assert.deepEqual(Array.from(P('mismatch')),[],'Native footprint tangent and seam parity');checks++;

P(`var oldGeometryRevision=occultGeometry.stats.rebuilds;
 var authoredOnly=occultGeometryStatic();
 var mutableWall={x:0,y:-1200,w:1,h:200,isWall:true};buildings.push(mutableWall);
 var pointBlocked=occultPointClear(0,-1200,0),rayBlocked=occultClearSegment(-60,-1200,60,-1200,0);
 var mutableExcluded=!occultGeometryStatic();
 mutableWall.x=100;var liveMoved=occultClearSegment(-60,-1200,60,-1200,0);
 mutableWall.isDeck=true;var liveDeck=occultClearSegment(80,-1200,120,-1200,0);
 mutableWall.isDeck=false;mutableWall.w=NaN;var liveInvalid=occultClearSegment(80,-1200,120,-1200,0);`);
ok('!pointBlocked&&!rayBlocked&&liveMoved&&liveDeck&&liveInvalid','Thin mutable fixtures retain live bounds, deck flags and validity without stale cells');
ok('authoredOnly&&mutableExcluded','Proven static geometry can be identified without trusting mutable fixture bounds');
ok('occultGeometry.stats.rebuilds>oldGeometryRevision','Adding a fixture invalidates the array-length geometry cache');
P(`buildings.pop();var firstWall=buildings.find(b=>b.undergroundWall);occultPointClear(0,-1000,0);
 var oldIndex=occultGeometry.buckets;occultInvalidateGeometry();occultPointClear(0,-1000,0);`);
ok('occultGeometry.buckets!==oldIndex','An explicit map/door invalidation discards old spatial cells');
ok('occultPointClear(NaN,0,0)===false&&occultPointClear(0,-1000,-1)===false&&occultClearSegment(0,0,Infinity,0,0)===false',
 'Malformed geometry queries cannot escape into a grid walk');
P(`var queryOwner=createOccultMagician('BLACK',100,-1000,'query-owner');enemiesList.push(queryOwner);
 var actorQueries=[[100,-1000,17,player],[100,-1000,17,queryOwner],[0,1100,17,queryOwner]];`);
ok('actorQueries.every(p=>referencePoint(...p)===occultPointClear(...p))','Optional actor-overlap clearance keeps native owner/player exclusions');

// Operation counts are stable across machines; wall time is reported rather
// than asserted. Interior rays no longer resample the same floor hundreds of times.
P(`referenceSolidTests=referenceFloorSamples=0;
 for(let i=0;i<500;i++){referencePoint(0,-1100,17);referenceSegment(0,-600,0,-1650,1);referenceTrace(0,-1100,40,-1120,3);}
 var referenceSolidWork=referenceSolidTests,referenceFloorWork=referenceFloorSamples;
 var beforeGeometry={...occultGeometry.stats};
 for(let i=0;i<500;i++){occultPointClear(0,-1100,17);occultClearSegment(0,-600,0,-1650,1);occultTraceSpell(0,-1100,40,-1120,3);}
 var acceleratedSolids=occultGeometry.stats.solidTests-beforeGeometry.solidTests,acceleratedFloor=occultGeometry.stats.floorSamples-beforeGeometry.floorSamples;`);
ok('referenceSolidTests>100000&&acceleratedSolids<referenceSolidTests/20','Spatial broad phase eliminates at least 95% of irrelevant solid tests in interior traffic');
ok('referenceFloorSamples>80000&&acceleratedFloor===0','Interior floor containment eliminates repeated six-unit topology sampling');
const time=(body)=>{const start=performance.now();P(body);return performance.now()-start;};
time('for(let i=0;i<100;i++){referenceSegment(0,-600,0,-1650,1);occultClearSegment(0,-600,0,-1650,1);}');
const beforeMs=time('for(let i=0;i<2000;i++){referencePoint(0,-1100,17);referenceSegment(0,-600,0,-1650,1);referenceTrace(0,-1100,40,-1120,3);}');
const afterMs=time('for(let i=0;i<2000;i++){occultPointClear(0,-1100,17);occultClearSegment(0,-600,0,-1650,1);occultTraceSpell(0,-1100,40,-1120,3);}');
console.log('Dungeon geometry queries: '+checks+' parity/invalidation/work checks passed; 28,000 randomized comparisons plus edges.');
console.log(JSON.stringify({beforeMs,afterMs,speedup:beforeMs/afterMs,referenceSolids:P('referenceSolidWork'),acceleratedSolids:P('acceleratedSolids'),referenceFloorSamples:P('referenceFloorWork'),acceleratedFloorSamples:P('acceleratedFloor')}));

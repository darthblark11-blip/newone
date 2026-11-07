// Return journeys keep story arrivals and saves intact, and never trim the
// hostile roster to make an arrival safe. Run: node tools/check-return-travel.js
const assert = require('assert');
const { ctx, probe } = require('./harness');
const P = source => probe('(' + source + ')');
let checks = 0;
const ok = (condition, label) => { checks++; assert(condition, label); };
ctx.setTimeout = () => 0;
let seed = 19970421;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const n = seed / 4294967296;
  if (a === undefined) return n;
  if (Array.isArray(a)) return a[(n * a.length) | 0];
  return b === undefined ? n * a : a + n * (b - a);
};
let saveSlot = null;
ctx.localStorage = { getItem: () => saveSlot, setItem: (key, value) => { saveSlot = value; }, removeItem: () => { saveSlot = null; } };

function fresh(level = 5, story = false) {
  probe(`isStoryMode=${story};resetStoryProgress();window.outpostForts={};
    buildSites=[];playerStructures=[];townCitizens=[];window.travelArrival=null;
    startAtLevel(${level});started=true;doTick=true;`);
}
function fixture() {
  fresh();
  probe(`BIOME_ACTIVE=false;chunkMgr=null;sealedSector=null;
    buildings=[];parkingCars=[];barrels=[];enemiesList=[];townCitizens=[];
    player.x=0;player.y=0;activeBuildings=[];activeParkingCars=[];invalidateColIndex();`);
}
const clearOfHostiles = () => P(`enemiesList.every(e=>!e||e.dead||e.hp<=0||e.isFriendly||
  (player.x-e.x)**2+(player.y-e.y)**2>=1000*1000)`);

// First story contact keeps its exact authored placement, even with a distant
// owned relay available. A later journey is what opts into safe return rules.
probe(`isStoryMode=true;resetStoryProgress();window.outpostForts={};
  outpostFortState(3).captured=true;buildSites=[];playerStructures=[];
  window.travelArrival='SOUTH';startAtLevel(3);`);
ok(P('player.x===500&&player.y===0&&inFarmCutscene&&farmPhase===1'), 'first farm contact retains authored story coordinates and beat');
ok(P('getBiomeState(3).visited'), 'the first entry records the sector visit after map generation');

fresh(1, true);
probe(`window.travelArrival='NORTH';startAtLevel(1);`);
ok(clearOfHostiles(), 'a mid-arc return into visited Stick City clears every live hostile');
ok(P('insideSector(player.x,player.y,40)'), 'mid-arc arrival remains inside the sealed story arena');
ok(P('sectorTowers().some(b=>b.hp>0)&&enemiesList.some(e=>!e.isFriendly)'), 'return safety retains the unfinished objectives and their defenders');

// The public startAtLevel path captures the old visit bit before generateMap
// marks the new one, publishes the fort, then forms the escort at the result.
fresh(5, false);
probe(`outpostFortState(5).captured=true;
  window.pendingEscortRoster=[{home:POP_POOL,sex:'M',female:false}];
  window.travelArrival='NORTH';startAtLevel(5);`);
ok(P('insideOwnedFortress(5,player.x,player.y)'), 'return travel prefers the captured fortress over its ordinary border anchor');
ok(P('!player.checkCol(player.x,player.y)'), 'captured-fort arrival clears its real generated structures');
ok(P('enemiesList.some(e=>e.isMilitary&&e.isFriendly)'), 'the return journey carries its escort');
ok(P(`enemiesList.filter(e=>e.isMilitary&&e.isFriendly).every(e=>
  (e.x-player.x)**2+(e.y-player.y)**2<700*700)`), 'escorts form beside the final return arrival');
ok(P('Math.abs(camX+width/zoom/2-player.x)<0.0001&&Math.abs(camY+height/zoom/2-player.y)<0.0001'), 'camera centres on the safe return point');

fixture();
probe(`enemiesList=[{x:0,y:0,hp:100},{x:1100,y:0,hp:100,eType:'AERIAL'},
  {x:0,y:0,hp:100,isFriendly:true},{x:0,y:0,hp:100,dead:true},{x:0,y:0,hp:0}];
  window.travelPoint=safeReturnTravelPoint(5,0,0);
  player.x=travelPoint.x;player.y=travelPoint.y;`);
ok(clearOfHostiles(), 'clearance includes both ordinary and aerial live hostiles');
ok(P('enemiesList.length===5&&enemiesList[0].hp===100&&enemiesList[1].hp===100'), 'safety does not delete, damage or cap the hostile roster');
ok(P('Math.hypot(player.x,player.y)<1200'), 'fallback chooses nearby safe ground instead of a remote unchecked last resort');
probe(`enemiesList=[{x:30,y:0,hp:100,isFriendly:true},{x:0,y:0,hp:100,dead:true},
  {x:0,y:0,hp:0}];window.travelPoint=safeReturnTravelPoint(5,0,0);`);
ok(P('Math.hypot(travelPoint.x,travelPoint.y)<=100'), 'friends and corpses do not require 100 metres of clearance');
probe(`enemiesList=[{x:30,y:0,hp:100,isNeutral:true,isFriendly:false},
  {x:100,y:0,hp:100,eType:'COW'},{x:-100,y:0,hp:100,eType:'HORSE'},
  {x:0,y:-100,hp:100,isCityCivilian:true,isFriendly:false}];
  window.travelPoint=safeReturnTravelPoint(5,0,0);`);
ok(P('Math.hypot(travelPoint.x,travelPoint.y)<=200'), 'neutral actors, livestock and unarmed civilians do not create hostile exclusion zones');
ok(P('enemiesList.every(e=>(e.x-travelPoint.x)**2+(e.y-travelPoint.y)**2>=55*55)'), 'noncombatants still receive physical landing clearance');

fixture();
probe(`outpostFortState(5).captured=true;const def=outpostFortDef(5);
  enemiesList=[{x:def.x+600,y:def.y,hp:100}];
  window.travelPoint=safeReturnTravelPoint(5,def.x,def.y);
  player.x=travelPoint.x;player.y=travelPoint.y;`);
ok(P('travelPoint.area.fortress.id===\'OUTPOST\'&&insideOwnedFortress(5,player.x,player.y)'), 'ownership is a valid alternative to 100-metre enemy clearance');
ok(P('Math.hypot(player.x-enemiesList[0].x,player.y-enemiesList[0].y)<1000'), 'a captured yard can be selected while its exterior still has enemies');

fixture();
probe(`outpostFortState(5).captured=true;const fort=outpostFortDef(5);
  buildings=[{x:fort.x,y:fort.y,w:5000,h:5000}];
  enemiesList=[{x:0,y:0,hp:100}];
  window.travelPoint=safeReturnTravelPoint(5,0,0);
  player.x=travelPoint.x;player.y=travelPoint.y;`);
ok(P('!travelPoint.area'), 'a fully blocked captured compound falls through to legal unowned ground');
ok(clearOfHostiles(), 'blocked-fort fallback keeps the full hostile clearance');

fixture();
probe(`outpostFortState(5).breached=true;
  townsData[5]={established:true};
  window.travelPoint=safeReturnTravelPoint(5,0,0);`);
ok(P('!travelPoint.area&&travelPoint.x===0&&travelPoint.y===0'), 'an opened hostile door or ledger alone does not award an owned travel area');
probe(`buildSites=[{level:5,kind:'FARM',x:400,y:0,w:200,h:200,done:true}];
  republishPlayerStructures();window.travelPoint=safeReturnTravelPoint(5,0,0);`);
ok(P('travelPoint.area.site&&travelPoint.area.site.done'), 'completed player construction provides its owned working apron');
ok(P('!buildings.some(b=>!b.isCropField&&Math.abs(travelPoint.x-b.x)<b.w/2+15&&Math.abs(travelPoint.y-b.y)<b.h/2+15)'), 'owned construction arrival remains outside its barn');

fixture();
probe(`enemiesList=[];
  for(let x=-1000;x<=1000;x+=250)for(let y=-1000;y<=1000;y+=250)
    enemiesList.push({x,y,hp:100});
  buildings=[{x:2100,y:0,w:700,h:1400}];parkingCars=[{x:-2100,y:0}];
  barrels=[{x:0,y:2100,hp:20}];window.ambushSpawnsRemaining=200;nm0AmbushKills=281;
  window.travelPoint=safeReturnTravelPoint(5,0,0);player.x=travelPoint.x;player.y=travelPoint.y;
  activeBuildings=buildings;activeParkingCars=parkingCars;invalidateColIndex();`);
ok(clearOfHostiles() && P('!player.checkCol(player.x,player.y)'), 'dense enemy coverage still yields a point clear of buildings, cars and barrels');
ok(P('enemiesList.length===81&&window.ambushSpawnsRemaining===200&&nm0AmbushKills===281'), 'dense fallback preserves hostile headcount and battle counters');
ok(P('Math.hypot(player.x,player.y)<3000'), 'dense fallback stays near the arrival rather than jumping across the biome');

// An impossible interior cannot silently accept the unsafe anchor. This is a
// deliberately stricter fixture than reachable play: closed walls cover every
// point in a tiny sealed arena, so return-only fallback must use clear exterior
// ground while preserving all gates and story progress.
fixture();
probe(`isStoryMode=true;currentLevel=2;townsData={};
  sealedSector={x0:-600,y0:-600,x1:600,y1:600};
  buildings=[{x:0,y:0,w:1400,h:1400}];
  enemiesList=[{x:0,y:0,hp:100}];window.undercityNorthBreached=false;
  window.undercitySouthBreached=false;window.travelPoint=safeReturnTravelPoint(2,0,0);
  player.x=travelPoint.x;player.y=travelPoint.y;
  activeBuildings=buildings;activeParkingCars=parkingCars;invalidateColIndex();`);
ok(P('!!travelPoint&&!insideSector(player.x,player.y,40)'), 'an exhausted sealed interior finds a legal exterior return point');
ok(clearOfHostiles() && P('!player.checkCol(player.x,player.y)'), 'exterior last resort still meets both hostile clearance and movement collision rules');
ok(P('!window.undercityNorthBreached&&!window.undercitySouthBreached&&enemiesList.length===1'), 'exterior arrival does not alter closed gates or remove their defenders');

fixture();
probe(`isStoryMode=true;currentLevel=1;townsData={};
  sealedSector={x0:-600,y0:-600,x1:600,y1:600};
  outpostFortState(1).captured=true;window.travelPoint=safeReturnTravelPoint(1,0,0);`);
ok(P('travelPoint.area.fortress.id===\'OUTPOST\''), 'an owned outpost is a valid return destination beyond unfinished story bounds');

fixture();
probe(`currentLevel=1;townsData[1]={towersDown:true};outpostFortState(1).captured=true;
  window.travelPoint=safeReturnTravelPoint(1,7200,10000);`);
ok(P('travelPoint.area.fortress.id===\'OUTPOST\''), 'the nearer captured fortress is preferred when two compounds are owned');
probe('window.travelPoint=safeReturnTravelPoint(1,600,600);');
ok(P('travelPoint.area.fortress.id===\'SECTOR\''), 'returning near the original compound chooses that owned fortress');

// Save/load preserves exact player coordinates, while the visit bit remains
// available for the NEXT journey. A new campaign then owes first arrivals again.
fresh(5, false);
probe(`player.x=1234;player.y=-2345;saveGame();
  biomeState={};player.x=9;player.y=9;window.travelArrival='SOUTH';loadGame();`);
ok(P('player.x===1234&&player.y===-2345'), 'loading restores the exact saved location despite stale travel state');
ok(P('getBiomeState(5).visited'), 'visited travel destinations persist through a real save/load');
probe(`outpostFortState(5).captured=true;window.travelArrival='SOUTH';startAtLevel(5);`);
ok(P('insideOwnedFortress(5,player.x,player.y)'), 'a saved visited sector gets safe placement on its next real journey');
probe('resetStoryProgress();');
ok(P('!getBiomeState(5).visited'), 'new campaign clears visit memory so its first story arrival is preserved');

console.log(`return travel: ${checks} checks passed`);

// One shared destination/route field serves every summoned zombie. Native
// body motion and bite collision remain independent of that shared intent.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');
ctx.setTimeout=()=>0;
let checks=0;
const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
P(`var hordeFixture=()=>{
 currentLevel=currentBiome=9;BIOME_ACTIVE=false;started=doTick=true;
 isPaused=isDead=isWin=killcamMode=false;undergroundRoute.arrivalMs=900;
 inStoryIntro=inStoryRoom=inTravelMenu=inWorldBuildingMenu=false;
 inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=false;
 buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];barrels=[];enemiesList=[];
 corpses=[];particles=[];bullets=[];resetOccultWorld();generateUndergroundMap();
 activeBuildings=buildings;invalidateColIndex();player=new Character(0,-1100,true);player.hp=player.maxHp=1e9;player.shield=0;
 window.meleeToolSel='NONE';window.shovelOwned=false;frameCount++;
};
var hordeZombie=(x,y,id,room)=>{const e=createOccultZombie(x,y,'gone-owner',id,room);e.occultZombie.emergeMs=0;enemiesList.push(e);return e;};
var hordeOpen=()=>{undergroundDungeon.opened=UNDERGROUND_GATES.map(g=>g.id);for(const g of UNDERGROUND_GATES)removeUndergroundGateBuilding(g.id);activeBuildings=buildings;invalidateColIndex();};
hordeFixture();var directHorde=[];
for(let i=0;i<OCCULT.maxZombies;i++)directHorde.push(hordeZombie(0,-1500,'direct-'+i));
var targetSamplesBefore=occultHorde.stats.targetSamples,searchesBefore=occultNavigation.stats.searches;
for(const e of directHorde)occultUpdateEnemy(e,20);`);
ok('occultHorde.stats.targetSamples-targetSamplesBefore===1',
 'All 288 zombies share one player-position sample in a simulation frame');
ok('directHorde.every(e=>!e._occultSense&&!e._occultNav&&e.y> -1500)&&occultNavigation.stats.searches===searchesBefore',
 'Open-room pursuit uses no individual perception state or A* searches');
ok('occultHorde.building===null&&occultHorde.published===null&&occultHorde.fields.every(f=>f===null)',
 'An unobstructed horde allocates no reverse field or typed grid buffers');

P(`hordeFixture();player.x=-510;player.y=-1660;var blockedHorde=[];
for(let i=0;i<OCCULT.maxZombies;i++)blockedHorde.push(hordeZombie(-510,-1100,'blocked-'+i));
var buildsBefore=occultHorde.stats.builds,blockedSearches=occultNavigation.stats.searches;
for(const e of blockedHorde)occultUpdateEnemy(e,20);`);
ok('occultHorde.stats.builds===buildsBefore+1&&occultNavigation.stats.searches===blockedSearches',
 'Hundreds of obstructed zombies request one shared field instead of hundreds of searches');
P('for(let i=0;i<30&&occultHorde.building;i++){frameCount++;occultNavigationRuntimePump();}');
ok('occultHorde.published!==null&&occultHorde.building===null&&blockedHorde.every(e=>!e._occultSense&&!e._occultNav)',
 'One completed reverse field is available to the entire horde');

P(`hordeFixture();hordeOpen();player.x=0;player.y=-6870;var longHorde=hordeZombie(0,1100,'long-walker');
var completedBefore=occultHorde.stats.completed,firstBuildBefore=occultHorde.stats.builds;
occultUpdateEnemy(longHorde,20);var firstWave=occultHorde.building;
var noRestarts=true,movingFrames=0;
while(occultHorde.stats.completed===completedBefore&&movingFrames++<100){
 frameCount++;const px=Math.sin(movingFrames*.7)*160;if(occultPointClear(px,-6870,17))player.x=px;
 occultUpdateEnemy(longHorde,20);noRestarts=noRestarts&&(occultHorde.building===firstWave||occultHorde.published===firstWave);
}
var firstPublished=occultHorde.published;
player.x=occultPointClear(200,-6870,17)?200:-200;frameCount++;occultUpdateEnemy(longHorde,20);`);
ok('firstWave!==null&&noRestarts&&firstPublished===firstWave&&movingFrames<100',
 'A moving player cannot cancel the shared wave before distant cells become available');
ok('occultHorde.published===firstPublished&&occultHorde.building!==null&&occultHorde.building!==firstPublished',
 'The previous published field remains usable while the latest destination builds separately');
P(`var fieldObjects=occultHorde.fields.slice(),allocationMark=occultHorde.stats.bufferAllocations;
for(let cycle=0;cycle<3;cycle++){
 for(let i=0;i<100&&occultHorde.building;i++){frameCount++;occultNavigationRuntimePump();}
 player.x=cycle%2?200:-200;frameCount++;occultUpdateEnemy(longHorde,20);
}`);
ok('occultHorde.fields.every((f,i)=>f===fieldObjects[i])&&occultHorde.stats.bufferAllocations===allocationMark',
 'Moving-target refreshes reuse the same two typed field buffers');

P(`hordeFixture();hordeOpen();player.x=0;player.y=-6870;var budgetZombie=hordeZombie(0,1100,'budget-zombie');
for(let i=0;i<6;i++){
 const e=createOccultMagician('RED',0,1100,'budget-mage-'+i);enemiesList.push(e);
 const n=e._occultNav={path:[],index:0,repathMs:0,revision:0};occultNavigationRuntimeRequest(e,n,0,-6870);
}
var budgetExpandedBefore=occultHorde.stats.expanded,mageSearchMark=occultNavigation.stats.searches;
occultUpdateEnemy(budgetZombie,20);var jointBudget=occultNavigationRuntime.expanded;
for(let i=0;i<50;i++)occultNavigationRuntimePump();`);
ok('jointBudget<=OCCULT_NAV.expansionsPerFrame&&occultNavigationRuntime.expanded===jointBudget&&occultHorde.stats.expanded>budgetExpandedBefore&&occultNavigation.stats.searches>mageSearchMark',
 'A shared flood and independent mage routes both progress within one 1500-node frame budget');
P(`var spentBeforeInvalidation=occultNavigationRuntime.expanded;
occultInvalidateNavigation();occultHordeTarget();occultHordeRequest();occultNavigationRuntimePump();`);
ok('occultNavigationRuntime.expanded>=spentBeforeInvalidation&&occultNavigationRuntime.expanded<=OCCULT_NAV.expansionsPerFrame&&occultHorde.stats.maxFrameExpanded<=OCCULT_HORDE.expansionsPerFrame',
 'Door invalidation cannot buy another frame budget or reserved horde slice');
P(`var pausedWave=occultHorde.building,pausedExpanded=occultHorde.stats.expanded;
isPaused=true;frameCount++;occultHordePump();occultUpdateEnemy(budgetZombie,20);isPaused=false;`);
ok('occultHorde.building===pausedWave&&occultHorde.stats.expanded===pausedExpanded&&!budgetZombie.isMoving',
 'Pause suspends shared field work and native zombie movement');

P(`hordeFixture();hordeOpen();player.x=0;player.y=-6870;var traveller=hordeZombie(0,1100,'all-rooms');
var traversalClear=true,traversalFrames=0;
while(Math.hypot(traveller.x-player.x,traveller.y-player.y)>47&&traversalFrames++<7000){
 frameCount++;occultUpdateEnemy(traveller,20);traversalClear=traversalClear&&!traveller.checkCol(traveller.x,traveller.y);
}`);
ok('traversalClear&&traversalFrames<7000&&traveller.y< -6800',
 'Native zombie pursuit traverses all four rooms and bent passages without clipping or stalling');

P(`hordeFixture();player.x=0;player.y=-2370;var doorZombie=hordeZombie(0,-1780,'door-zombie');
for(let i=0;i<100;i++){frameCount++;occultUpdateEnemy(doorZombie,20);}
var stoppedAtDoor=doorZombie.y>UNDERGROUND_GATES[0].y+UNDERGROUND_GATES[0].h/2+15;
undergroundDungeon.opened=['nave'];removeUndergroundGateBuilding('nave');
var droppedClosedField=occultHorde.published===null&&occultHorde.building===null,doorClear=true;
for(let i=0;i<1200&&Math.hypot(doorZombie.x-player.x,doorZombie.y-player.y)>47;i++){
 frameCount++;occultUpdateEnemy(doorZombie,20);doorClear=doorClear&&!doorZombie.checkCol(doorZombie.x,doorZombie.y);
}`);
ok('stoppedAtDoor&&droppedClosedField&&doorClear&&doorZombie.y< -2300',
 'A sealed door blocks the horde until opening invalidates the field and admits a safe route');
P(`hordeFixture();player.y=-2500;var asleep=hordeZombie(0,-2550,'asleep','nave');
var sleepX=asleep.x,sleepY=asleep.y,sleepBuilds=occultHorde.stats.builds;
for(let i=0;i<50;i++){frameCount++;occultUpdateEnemy(asleep,20);}`);
ok('asleep.x===sleepX&&asleep.y===sleepY&&occultHorde.stats.builds===sleepBuilds',
 'Shared knowledge never awakens a zombie belonging to an unopened room');

P(`hordeFixture();player.y=-1600;var movingWall={x:0,y:-1350,w:200,h:20,isWall:true};buildings.push(movingWall);
var dynamicZombie=hordeZombie(0,-1100,'dynamic');occultUpdateEnemy(dynamicZombie,20);
var dynamicRevision=occultNavigation.revision;movingWall.x=500;frameCount++;occultUpdateEnemy(dynamicZombie,20);`);
ok('occultNavigation.revision>dynamicRevision&&dynamicZombie.y< -1100&&occultHorde.building===null&&occultHorde.published===null',
 'Moving a generic fixture in place revokes the shared geometry, grid and field caches');

P(`hordeFixture();var liveWall={x:500,y:-1350,w:80,h:20,isWall:true};buildings.push(liveWall);
var colZombie=hordeZombie(0,-1100,'native-moving-wall');occultHordeTarget();buildColIndex();
liveWall.x=0;frameCount++;occultHordeTarget();`);
ok('colGrid===null&&colZombie.checkCol(0,-1350)',
 'A moved generic wall also revokes native collision buckets before crowd motion can enter it');

P(`hordeFixture();player.y=-1131;var noBite=hordeZombie(0,-1100,'no-wall-bite');noBite.occultZombie.biteCooldownMs=0;
buildings.push({x:0,y:-1115.5,w:200,h:1,isWall:true});frameCount++;occultUpdateEnemy(noBite,20);`);
ok('noBite.occultZombie.windupMs===0&&player.hp===1e9',
 'Omniscient pursuit cannot start a swipe through a thin wall');
P(`hordeFixture();player.y=-1131;var lateWall=hordeZombie(0,-1100,'late-wall');lateWall.occultZombie.biteCooldownMs=0;
occultUpdateEnemy(lateWall,20);buildings.push({x:0,y:-1115.5,w:200,h:1,isWall:true});
for(let i=0;i<23;i++){frameCount++;occultUpdateEnemy(lateWall,20);}`);
ok('player.hp===1e9',
 'A wall appearing after swipe preparation also blocks the committed damage');

P(`hordeFixture();player.y=-1131;var biter=hordeZombie(0,-1100,'player-priority');biter.occultZombie.biteCooldownMs=0;
var friend=new Character(0,-1120,false);friend.isFriendly=true;friend.isNeutral=false;friend.hp=100;enemiesList.push(friend);
for(let i=0;i<24;i++){frameCount++;occultUpdateEnemy(biter,20);}`);
ok('occultHordeTarget()===player&&player.hp===1e9-12&&friend.hp===100',
 'The horde shares the player destination instead of scanning nearby allies for a different target');
P(`var depthHelper=shovelPlayerDepth;shovelPlayerDepth=e=>e===player?SHOVEL.underground:0;
frameCount++;biter.occultZombie.windupMs=200;occultUpdateEnemy(biter,20);var hiddenStops=occultHordeTarget()===null&&!biter.isMoving&&biter.occultZombie.windupMs===0;
shovelPlayerDepth=depthHelper;player.hp=0;frameCount++;occultUpdateEnemy(biter,20);`);
ok('hiddenStops&&occultHordeTarget()===null&&!biter.isMoving',
 'Buried or dead players cannot be chased or hit through the shared intent');

P(`hordeFixture();player.x=-510;player.y=-1660;var savedZombie=hordeZombie(-510,-1100,'saved-horde');
occultUpdateEnemy(savedZombie,20);var hiveSave=JSON.parse(JSON.stringify(serializeOccultState()));restoreOccultState(hiveSave);
var resetFields=occultHorde.target===null&&occultHorde.fields.every(f=>f===null);
var restoredZombie=enemiesList.find(e=>e.occultZombie&&e.occultZombie.id==='saved-horde');frameCount++;occultUpdateEnemy(restoredZombie,20);`);
ok("resetFields&&!JSON.stringify(hiveSave).includes('_occultHorde')&&!restoredZombie._occultSense&&!restoredZombie._occultNav&&occultHordeTarget()===player",
 'Save/load retains zombies and rebuilds shared intent without serializing routes or live targets');
P('resetOccultWorld();');
ok('occultHorde.target===null&&occultHorde.grid===null&&occultHorde.building===null&&occultHorde.published===null&&occultHorde.fields.every(f=>f===null)&&occultHorde.looseState.length===0',
 'World replacement releases both typed fields, target references and loose-fixture snapshots');
console.log('Dungeon horde: '+checks+' shared-intent, work-budget, route, bite, visibility and persistence checks passed.');

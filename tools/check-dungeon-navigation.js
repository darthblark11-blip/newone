// Dungeon actors use the same native collision volumes as their planned paths.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');
ctx.setTimeout=()=>0;
let checks=0;
const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
P(`var navFixture=()=>{
 currentLevel=currentBiome=9;BIOME_ACTIVE=false;started=doTick=true;
 isPaused=isDead=isWin=killcamMode=false;undergroundRoute.arrivalMs=900;
 inStoryIntro=inStoryRoom=inTravelMenu=inWorldBuildingMenu=false;
 inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=false;
 buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];barrels=[];
 enemiesList=[];corpses=[];particles=[];bullets=[];resetOccultWorld();
 generateUndergroundMap();activeBuildings=buildings;invalidateColIndex();
 player=new Character(0,-900,true);player.hp=10000;player.shield=0;
 window.meleeToolSel='NONE';window.shovelOwned=false;
};navFixture();
 var pathClear=(x,y,path)=>{if(!path)return false;for(const p of path){if(!occultClearSegment(x,y,p.x,p.y,17))return false;x=p.x;y=p.y;}return true;};
 var closedPath=occultFindPath(0,-1780,0,-2370),closedGrid=occultNavigation.grid,oldRevision=occultNavigation.revision;`);
ok('closedPath===null','A planned route cannot cross a shut ceremonial door');
P("undergroundDungeon.opened=['nave'];removeUndergroundGateBuilding('nave');frameCount++;var openPath=occultFindPath(0,-1780,0,-2370);");
ok('occultNavigation.revision>oldRevision&&occultNavigation.grid!==closedGrid&&pathClear(0,-1780,openPath)',
 'Opening a door invalidates the blocked route and admits a collision-safe passage');
P(`undergroundDungeon.opened=UNDERGROUND_GATES.map(g=>g.id);for(const g of UNDERGROUND_GATES)removeUndergroundGateBuilding(g.id);
 frameCount++;var dungeonRoute=occultFindPath(0,1100,0,-6870);`);
ok('dungeonRoute&&dungeonRoute.length>3&&pathClear(0,1100,dungeonRoute)',
 'A long route crosses all four rooms and the bent sanctuary passage without cutting corners');
ok('occultNavigation.grid.n<16000&&occultNavigation.stats.maxExpanded<=OCCULT_NAV.maxExpanded',
 'The complete dungeon graph and every search remain bounded');

P(`navFixture();var walker=createOccultMagician('RED',-510,-1100,'nav-walker');enemiesList.push(walker);
 var wrapsPillar=!occultClearSegment(walker.x,walker.y,-510,-1660,17),walkClear=true;
 for(let i=0;i<450;i++){frameCount++;occultNavigate(walker,-510,-1660,120,20);walkClear=walkClear&&!walker.checkCol(walker.x,walker.y);}`);
ok('wrapsPillar&&walkClear&&Math.hypot(walker.x+510,walker.y+1660)<12',
 'A moving caster routes around an actual pillar and arrives without clipping or stalling');
P('var savedGrid=occultNavigation.grid;frameCount++;occultNavigationGrid();');
ok('occultNavigation.grid===savedGrid','Repeated routes reuse the existing walkability grid');
P(`frameCount++;var searchedBefore=occultNavigation.stats.searches,deferredBefore=occultNavigation.stats.deferred;
 for(let i=0;i<15;i++)occultFindPath(-510,-1100,-510,-1660);`);
ok('occultNavigation.stats.searches-searchedBefore<=OCCULT_NAV.searchesPerFrame&&occultNavigation.stats.deferred>deferredBefore',
 'A crowd cannot request unlimited A* searches in one simulation frame');

for(const kind of ['BLACK','RED','BLUE']){
 P(`navFixture();var skirmisher=createOccultMagician('${kind}',0,-1100,'nav-${kind}');enemiesList.push(skirmisher);
  player.y=-850;skirmisher.occult.cooldownMs=100000;var startDistance=Math.hypot(skirmisher.x-player.x,skirmisher.y-player.y),retreatClear=true;
  for(let i=0;i<100;i++){frameCount++;deltaTime=20;skirmisher.updateEnemy();retreatClear=retreatClear&&!skirmisher.checkCol(skirmisher.x,skirmisher.y);}`);
 ok('retreatClear&&Math.hypot(skirmisher.x-player.x,skirmisher.y-player.y)>startDistance+100',
  kind+' caster retreats briskly from close pressure using native collision');
}

P(`navFixture();var hiddenMage=createOccultMagician('BLACK',-420,-1280,'nav-hidden');enemiesList.push(hiddenMage);
 var everHidden=false,hiddenChant=false,coverClear=true;
 for(let i=0;i<700;i++){frameCount++;deltaTime=20;hiddenMage.updateEnemy();occultUpdateWorld(20);
  const hidden=!occultClearSegment(hiddenMage.x,hiddenMage.y,player.x,player.y,1);
  everHidden=everHidden||hidden;hiddenChant=hiddenChant||hidden&&hiddenMage.occult.phase==='CHARGE'&&hiddenMage.occult.cast==='SUMMON';
  coverClear=coverClear&&!hiddenMage.checkCol(hiddenMage.x,hiddenMage.y);}`);
ok('everHidden&&hiddenChant&&coverClear','A black magician finds real cover and continues summoning out of sight');
P(`var hiddenSave=JSON.parse(JSON.stringify(serializeOccultState()));restoreOccultState(hiddenSave);
 hiddenMage=enemiesList.find(e=>e.occult&&e.occult.id==='nav-hidden');frameCount++;occultUpdateEnemy(hiddenMage,20);`);
ok('hiddenMage._occultSense.target===player&&hiddenMage._occultSense.memoryMs>0',
 'Loading a hidden awakened summoner restores its remembered threat without serializing route caches');
ok('hiddenSave.actors.every(a=>!a._occultNav&&!a._occultSense&&!a._occultTactics)',
 'Saved actors do not retain navigation grids, live target references or large path arrays');

// A pursuer that loses sight after moving behind a pillar must still route
// toward the position it actually observed, without learning an unseen move.
P(`navFixture();var pursuer=createOccultZombie(-250,-1100,'gone-owner');pursuer.occultZombie.emergeMs=0;enemiesList.push(pursuer);
 player.x=-510;player.y=-1660;frameCount++;occultUpdateEnemy(pursuer,20);
 var observedPursuit=pursuer._occultSense.target===player;pursuer.x=-510;var chaseClear=true;
 for(let i=0;i<450;i++){frameCount++;occultUpdateEnemy(pursuer,20);chaseClear=chaseClear&&!pursuer.checkCol(pursuer.x,pursuer.y);}`);
ok('observedPursuit&&chaseClear&&pursuer.y< -1550','A zombie uses its remembered target and pathfinding to get around cover');

P(`navFixture();var sleeping=createOccultMagician('BLACK',-390,-3190,'nav-dormant','nave');enemiesList.push(sleeping);
 player.x=sleeping.x;player.y=sleeping.y+100;var asleepAt={x:sleeping.x,y:sleeping.y};
 for(let i=0;i<100;i++){frameCount++;occultUpdateEnemy(sleeping,100);occultUpdateWorld(100);}`);
ok('sleeping.x===asleepAt.x&&sleeping.y===asleepAt.y&&!sleeping.occult.awakened&&enemiesList.length===1',
 'Greater awareness and summoning mobility never awaken a sealed room');
P('occultNavigationGrid();resetOccultWorld();');
ok('occultNavigation.grid===null&&occultNavigation.crowd===null','World replacement releases all cached navigation and crowd data');
console.log('Dungeon navigation: '+checks+' route, cover, pursuit, budget and persistence checks passed.');

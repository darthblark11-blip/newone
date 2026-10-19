// Native startup, exterior procedural placement and saved city conversion.
// Blue rookies must exist before the towers fall without extending the city's
// original finite roster or spending its eighty-defender allowance.
const assert = require('assert/strict');
const { ctx, probe } = require('./harness.js');
const P = s => probe('(' + s + ')');
let checks = 0, seed = 703121, slot = null;
const ok = (name, value) => { assert.ok(value, name); checks++; };
ctx.random = function(a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  return b === undefined ? r * a : a + r * (b - a);
};
ctx.setTimeout = () => 0;
ctx.localStorage = {getItem: () => slot, setItem: (key, value) => { slot = value; }, removeItem: () => { slot = null; }};
function fresh(level) {
  slot = null;
  probe(`resetStoryProgress(); window.outpostForts = {}; isStoryMode = true;
    startAtLevel(${level}); started = doTick = true;
    isPaused = isWin = isDead = killcamMode = false;
    inStoryIntro = inStoryRoom = inDarchonCall = false; darchonCallCompleted = true;
    leftStick = {active:false,dx:0,dy:0,base:{x:80,y:640}};
    rightStick = {active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};`);
}
probe(`function testPatrolClearance(e) {
  const x=e.x,y=e.y,pad=34;
  if(inAuthoredSector(x,y,500) || insideOwnedFortress(currentLevel,x,y,60))return false;
  const blocked = b => b && !b.noClip && !b.isPalm && !b.isAlienPlant && !b.isEnergyPole &&
    !(b.isGrassLot && !b.isPond) && Math.abs(x-b.x)<(b.w||0)/2+pad && Math.abs(y-b.y)<(b.h||0)/2+pad;
  if(authoredSolids.some(blocked) || buildings.some(blocked))return false;
  for(let j=Math.floor((y-pad)/CHUNK_W);j<=Math.floor((y+pad)/CHUNK_W);j++)
    for(let i=Math.floor((x-pad)/CHUNK_W);i<=Math.floor((x+pad)/CHUNK_W);i++) {
      const ch=generateChunkContent(currentLevel,i,j);
      if(ch.solid.some(blocked) || ch.cars.some(c=>Math.abs(x-c.x)<(c.w||45)/2+pad && Math.abs(y-c.y)<(c.h||85)/2+pad))return false;
    }
  return true;
}
function testOpenRoadPosition() {
  for(let r=7000;r<40000;r+=900)
    for(let a=0;a<12;a++) {
      const x=Math.cos(a)*r,y=Math.sin(a)*r;
      if(!inAuthoredSector(x,y,900) && outerRegionUncached(x,y))return {x,y};
    }
  return null;
}`);

for (const level of [1, 2]) {
  console.log(`== native L${level} exterior intake ==`);
  fresh(level);
  const rookie = level === 1 ? 'NM0_ROOKIE' : 'NM0_ROOKIE_F';
  const original = level === 1 ? 'NORMAL' : 'FEMALE_PISTOL';
  const population = P('enemiesList.filter(e=>e.isPopulation).length');
  ok(`L${level} original finite roster contains eighty defenders`, population === 80);
  ok(`L${level} every original defender retains its correct type`, P(`enemiesList.filter(e=>e.isPopulation).every(e=>e.eType==='${original}')`));
  ok(`L${level} original eighty remain the sector's saved seed`, P('sectorLedger(currentLevel).popSeeded') === 80);
  ok(`L${level} towers have not fallen before the outside intake arrives`, !P('sectorTowersAreDown(currentLevel) || window.towersDefeated'));
  ok(`L${level} four rookies already hold the exterior`, P('enemiesList.filter(e=>e.isExteriorPatrol).length') === 4);
  ok(`L${level} exterior rookies have the correct gender and remain independent`, P(`enemiesList.filter(e=>e.isExteriorPatrol).every(e=>e.eType==='${rookie}' && !e.isPopulation && !e.isFriendly && !e.isAmbush)`));
  ok(`L${level} exterior rookies occupy four distinct stations`, P('new Set(enemiesList.filter(e=>e.isExteriorPatrol).map(e=>e.exteriorStation)).size') === 4);
  ok(`L${level} every initial patrol clears authored and procedural geometry`, P('enemiesList.filter(e=>e.isExteriorPatrol).every(testPatrolClearance)'));
  ok(`L${level} exterior spawn validation does not move the player out of the city`, P('inAuthoredSector(player.x,player.y,900)'));
  probe('frameCount = 90; cullDistantEnemies();');
  ok(`L${level} city culling preserves the already existing exterior patrols`, P('enemiesList.filter(e=>e.isExteriorPatrol).length') === 4);
  const beforeInside = P('enemiesList.length');
  probe('for(let i=0;i<12;i++)spawnSingleEnemy();');
  ok(`L${level} exterior replacements never materialize inside the gate`, P('enemiesList.length') === beforeInside);

  // Only the player's position changes here; keep the real four patrols and
  // all eighty live defenders when exercising the independent spawn budget.
  probe(`window.testRoad = testOpenRoadPosition();
    if(!testRoad)throw new Error('No outer road fixture');
    player.x=testRoad.x;player.y=testRoad.y;frameCount++;
    window.testPost = new Character(24000,24000,false,'${rookie}');
    testPost.postX=24000;testPost.postY=24000;
    window.testFort = new Character(25000,25000,false,'${rookie}'); testFort.isOutpostGarrison=true;
    enemiesList.push(testPost,testFort);
    window.testNativeSpawnsStart=enemiesList.length;
    for(let i=0;i<240;i++){frameCount++;spawnSingleEnemy();}`);
  ok(`L${level} checkpoint sentries do not consume the ambient budget`, !P('cityOverworldRoamer(testPost)'));
  ok(`L${level} fortress garrisons do not consume the ambient budget`, !P('cityOverworldRoamer(testFort)'));
  ok(`L${level} eighty live original defenders do not suppress open-road intake`, P('enemiesList.length>testNativeSpawnsStart'));
  ok(`L${level} ambient intake stops at its separate eighty-unit cap`, P('enemiesList.filter(cityOverworldRoamer).length') === 80);
  ok(`L${level} open-road intake never replaces finite original defenders`, P(`enemiesList.slice(testNativeSpawnsStart).every(e=>e.eType==='ROBOT' || e.eType==='${rookie}')`));
  ok(`L${level} blue rookies appear before any tower conversion`, P(`enemiesList.slice(testNativeSpawnsStart).some(e=>e.eType==='${rookie}')`));
  ok(`L${level} hardware still shares the open-road roster`, P("enemiesList.slice(testNativeSpawnsStart).some(e=>e.eType==='ROBOT')"));
  ok(`L${level} all dynamic intake spawns stay beyond the authored city`, P('enemiesList.slice(testNativeSpawnsStart).every(e=>!inAuthoredSector(e.x,e.y,500))'));
  ok(`L${level} exterior activity leaves the original roster finite`, P('enemiesList.filter(e=>e.isPopulation).length') === population && P('sectorLedger(currentLevel).popKilled') === 0);

  probe(`markSectorTowersDown(currentLevel); window.towersDefeated=true;
    recruitSectorSurvivors();`);
  ok(`L${level} tower conversion frees only the original defenders`, P('enemiesList.filter(e=>e.isPopulation && e.isFriendly && e.isRecruit).length') === 80);
  ok(`L${level} tower conversion does not free independent blue intake`, P(`enemiesList.filter(e=>e.eType==='${rookie}').every(e=>!e.isFriendly && !e.isRecruit)`));
  probe(`enemiesList=enemiesList.filter(e=>e.isPopulation || e.isExteriorPatrol);
    window.testPostTowerStart=enemiesList.length;
    for(let i=0;i<90;i++){frameCount++;spawnSingleEnemy();}`);
  ok(`L${level} post-tower pool still sends the same independent intake`, P(`enemiesList.slice(testPostTowerStart).some(e=>e.eType==='${rookie}') && enemiesList.slice(testPostTowerStart).some(e=>e.eType==='ROBOT')`));
  ok(`L${level} post-tower intake never brings back original conscripts`, P(`enemiesList.slice(testPostTowerStart).every(e=>e.eType==='ROBOT' || e.eType==='${rookie}')`));

  // Save a liberated roster before its ambush award. loadGame rebuilds the
  // authored sector, wipes random hostiles and must then recreate its patrols.
  probe(`nm0AmbushActive=false; window.nm0AmbushCleared=false;
    window.nm0AmbushClearedStatus=false; inTownCutscene=false; inPostAmbushCutscene=false;
    markStoryBeat('L'+currentLevel+'_TOWN'); saveGame();`);
  ok(`L${level} native save records the original finite ledger`, !!slot && JSON.parse(slot).townsData[level].popSeeded === 80);
  probe('enemiesList=[]; loadGame();');
  ok(`L${level} towers-down load restores four independent exterior rookies after its hostile wipe`, P('enemiesList.filter(e=>e.isExteriorPatrol).length') === 4);
  ok(`L${level} restored exterior intake stays hostile and gender-correct`, P(`enemiesList.filter(e=>e.isExteriorPatrol).every(e=>e.eType==='${rookie}' && !e.isFriendly && !e.isPopulation && !e.isAmbush)`));
  ok(`L${level} restored exterior patrols still clear procedural terrain`, P('enemiesList.filter(e=>e.isExteriorPatrol).every(testPatrolClearance)'));
  ok(`L${level} restored blue intake cannot expand or consume the original survivor ledger`, P('sectorLedger(currentLevel).popSeeded===80 && sectorLedger(currentLevel).popKilled===0 && sectorSurvivorCount(currentLevel)===80'));
  probe('ensureCityRookiePatrols(); ensureCityRookiePatrols();');
  ok(`L${level} repeated startup safeguards do not duplicate patrol stations`, P('enemiesList.filter(e=>e.isExteriorPatrol).length') === 4);
}
console.log(`${checks}/${checks} overworld rookie spawning checks passed`);

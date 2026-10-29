// Department ledgers survive authored interiors, while their surface resident
// view stays outside. Scripted staff, enemies and military escorts keep ownership.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,seed=62521,slot=null;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
ctx.touches=[];
ctx.navigator.getGamepads=()=>[];
ctx.localStorage={getItem:key=>key==='urbanTwinStickSave'?slot:null,
  setItem:(key,value)=>{if(key==='urbanTwinStickSave')slot=String(value);},
  removeItem:key=>{if(key==='urbanTwinStickSave')slot=null;}};
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;
  return a===undefined?r:Array.isArray(a)?a[Math.floor(r*a.length)]:b===undefined?r*a:a+(b-a)*r;};
function freshSurface(){
  probe(`resetRunState();isStoryMode=true;townsData={};
    for(let level=1;level<=7;level++)townsData[level]={established:true,popGranted:true,
      popAmbushCleared:true,popSeeded:80,popKilled:0,towersDown:level<=2};
    window.departmentInteriorPool=poolLedger();
    for(const dept of POP_DEPTS){departmentInteriorPool['pop'+dept+'M']=2;departmentInteriorPool['pop'+dept+'F']=1;}
    departmentInteriorPool.popTotal=sectorPopSum(departmentInteriorPool);loadLedgerIntoWindow(POP_POOL);
    for(const dept of ['farm','mil','sci','arch']){window[dept+'Lvl']=2;window[dept+'XP']=75;}
    window.outpostForts={};for(let level=2;level<=7;level++)outpostFortState(level).captured=true;
    window.southGateBreachedStatus=window.northGateBreachedStatus=true;
    window.nm0AmbushClearedStatus=window.armorBlueprintPickedUp=true;
    startAtLevel(1);started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inPostAmbushCutscene=inFortCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
    inWorldBuildingMenu=inOverworldView=inTravelMenu=false;window.inNM0SecretOverlay=false;
    deployDirectivePopulation();`);
  ok('secured Stick City starts with all twelve assigned surface residents',P('townCitizens.length===12'));
  ok('all four department views use real owned fortress positions',
    P('new Set(townCitizens.map(c=>c.directiveDept)).size===4&&townCitizens.every(c=>insideOwnedFortress(1,c.x,c.y))'));
}
const populationState=()=>P(`JSON.stringify({
  ledgers:[POP_POOL,1,2,3,4,5,6,7].map(id=>{const t=sectorLedger(id);
    return [id,t.popTotal,...POP_DEPTS.flatMap(d=>[t['pop'+d+'M'],t['pop'+d+'F']]),t.popUnassignedM,t.popUnassignedF];}),
  levels:['farm','mil','sci','arch'].map(d=>[window[d+'Lvl'],window[d+'XP']]),
  population:globalPopulationCount()})`);
function directInteriorDeployment(level){
  const nativeSpawn=ctx.getOwnedFortressSpawnPoint;let calls=0,result;
  ctx.getOwnedFortressSpawnPoint=()=>{calls++;throw Error('interior consulted the surface resident allocator');};
  try{
    probe("townCitizens=[{directiveDept:'Farming',directiveHome:POP_POOL,x:0,y:0}];");
    result=P('deployDirectivePopulation()');
  }finally{ctx.getOwnedFortressSpawnPoint=nativeSpawn;}
  ok('level '+level+' rejects direct deployment before allocating any resident',result===0&&calls===0);
  ok('level '+level+' clears a stale resident view without changing the ledger',P('townCitizens.length===0'));
}

for(const level of [8,9,0]){
  freshSurface();const ledger=populationState();
  probe(`startAtLevel(${level});`);
  ok('entering authored level '+level+' discards carried surface department residents',P('townCitizens.length===0'));
  ok('entering authored level '+level+' preserves department counts, rewards and experience',populationState()===ledger);
  if(level===8){
    ok('HQ keeps its original three scientists and twenty main guards',
      P("nm0Scientists.length===3&&nm0HqRoomRemaining('MAIN')===20"));
    probe("openNM0Office('WEST');openNM0Office('EAST');");
    ok('opening both offices keeps all nine authored scientists and sixteen office guards',
      P("nm0Scientists.length===9&&nm0HqRoomRemaining('WEST')===8&&nm0HqRoomRemaining('EAST')===8&&!townCitizens.length"));
  }else if(level===9){
    ok('underground arrival preserves the finite fifty-four magician encounter',
      P('enemiesList.length===54&&enemiesList.every(isOccultMagician)&&nm0Scientists.length===0'));
  }else{
    ok('actual level zero retains the prologue father and three SIA actors',
      P("enemiesList.filter(e=>e.eType==='DAD').length===1&&enemiesList.filter(e=>e.eType==='SIA').length===3"));
  }
  directInteriorDeployment(level);
  ok('direct deployment in level '+level+' preserves all department ledgers',populationState()===ledger);
  probe('saveGame();loadGame();');
  ok('saving and loading authored level '+level+' cannot deploy department residents',P(`currentLevel===${level}&&townCitizens.length===0`));
  ok('saving and loading level '+level+' preserves department counts and earned levels',populationState()===ledger);
  if(level===8)ok('HQ reload retains the opened offices and authored staff',
    P("nm0Scientists.length===9&&nm0HqRoomRemaining('MAIN')===20&&nm0HqRoomRemaining('WEST')===8&&nm0HqRoomRemaining('EAST')===8"));
  if(level===9)ok('underground reload retains all fifty-four authored magicians',P('enemiesList.length===54&&enemiesList.every(isOccultMagician)'));
  probe('startAtLevel(1);');
  ok('returning from level '+level+' automatically rebuilds the surface resident view',
    P('townCitizens.length===12&&townCitizens.every(c=>insideOwnedFortress(1,c.x,c.y))'));
  ok('returning from level '+level+' does not spend or duplicate department population',populationState()===ledger);
}

// Every surface sector still permits the existing department view. Captured
// outposts provide real placement in sectors that lack Stick City's compound.
freshSurface();const surfaceLedger=populationState();
for(let level=1;level<=7;level++){
  probe(`startAtLevel(${level});`);
  ok('surface level '+level+' still deploys all assigned department residents',
    P(`townCitizens.length===12&&townCitizens.every(c=>insideOwnedFortress(${level},c.x,c.y))`));
  ok('surface level '+level+' leaves the ledger and upgrades unchanged',populationState()===surfaceLedger);
}

// The view restriction must not remove actual military chosen to accompany
// surface travel. They are combat actors and retain their home department jobs.
freshSurface();const escortLedger=populationState();
probe('window.militaryToBringM=1;window.militaryToBringF=1;startAtLevel(2);');
ok('chosen military escorts still accompany normal surface travel',
  P('enemiesList.filter(e=>e.isFriendly&&e.isMilitary).length===2&&townCitizens.length===10'));
ok('surface escorts do not consume their department ledger twice',populationState()===escortLedger);
probe('saveGame();loadGame();');
ok('surface save/load keeps combat escorts separate from their resident view',
  P('enemiesList.filter(e=>e.isFriendly&&e.isMilitary).length===2&&townCitizens.length===10'));
ok('restored escorts preserve department assignments and upgrades',populationState()===escortLedger);
probe(`startAtLevel(8);
  spawnEscortSoldier({x:-100,y:1200},'M',POP_POOL);
  spawnEscortSoldier({x:100,y:1200},'F',POP_POOL);
  deployDirectivePopulation();`);
ok('interior department filtering leaves actual military actors untouched',
  P("townCitizens.length===0&&enemiesList.filter(e=>e.isFriendly&&e.isMilitary).length===2&&nm0HqRoomRemaining('MAIN')===20"));
ok('interior filtering still preserves the military department ledger',populationState()===escortLedger);

console.log(`${checks}/${checks} surface department residency, interior isolation, ledger persistence and escort checks passed.`);

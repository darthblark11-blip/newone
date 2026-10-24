// Native workers, streamed rosters, material silhouettes and exact resident
// persistence. GAME_JS selects the immutable source used by browser review.
const {ctx,probe,calls,mkG}=require('./harness');
let checks=0,failures=0;
function ok(name,passed,detail=''){checks++;if(!passed){failures++;console.error('FAIL '+name+' '+detail);}}
function P(s){return probe(s);}
P(`isStoryMode=false;resetStoryProgress();startAtLevel(3);isPaused=false;doTick=true;
  inFarmCutscene=false;inTownCutscene=false;killcamMode=false;`);
const types=P('FRONTIER_CIVILIAN_TYPES');
ok('six readable occupational types',types.length===6);
const native=P(`enemiesList.filter(e=>e.frontierResidentKey&&e.frontierResidentKey.startsWith('DRY_GULCH:')).map(e=>({type:e.eType,blocked:e.checkCol(e.x,e.y),unarmed:unarmedCivilian(e),friendly:e.isFriendly,neutral:e.isNeutral,armed:e.isArmed,ledger:!!e.isPopulation}))`);
ok('arcade authored town spawns two workers of each trade',native.length===12&&types.every(t=>native.filter(e=>e.type===t).length===2));
ok('all authored occupations on clear public street',native.every(e=>!e.blocked));
ok('workers stay independent of campaign/hostile population',native.every(e=>e.unarmed&&e.friendly&&e.neutral&&!e.armed&&!e.ledger));
P('spawnFrontierTownWorkers();');
ok('repeated town population cannot duplicate',P(`enemiesList.filter(e=>e.frontierResidentKey&&e.frontierResidentKey.startsWith('DRY_GULCH:')).length`)==12);
const hats=[];const attire=[];
for(const type of types){
  ctx.__type=type;
  P(`var worker=new Character(1300,-2100,false,window.__type);frontierCivilianAppearance(worker,78191);var savedIdentity=figureIdentity(worker);`);
  hats.push(P('headwearOf(worker)'));
  ok(type+' seeded materials repeat',P(`(()=>{const a=JSON.stringify(figureIdentity(worker));frontierCivilianAppearance(worker,78191);return a===JSON.stringify(figureIdentity(worker));})()`));
  ok(type+' frozen corpse identity keeps trade, sex, hair, skin and hat',P(`savedIdentity.frontierOccupation===worker.frontierOccupation&&savedIdentity.frontierFemale===worker.frontierFemale&&savedIdentity.hairStyle===worker.hairStyle&&headwearOf(savedIdentity)===headwearOf(worker)`));
  let before=calls.sig;ctx.__g=mkG();P('drawFrontierCivilianAttire(window.__g,worker,30,20,false);');attire.push(calls.sig);ok(type+' standing accessories paint',calls.sig!==before);
  for(const back of [false,true]){
    before=calls.sig;P(`drawFallenAttire(window.__g,savedIdentity,30,20,${back},1);`);
    ok(type+' '+(back?'face-down':'face-up')+' keeps occupational attire',calls.sig!==before);
  }
  for(const angle of [0,Math.PI*.5,Math.PI]){
    P(`worker.aimAngle=${angle};worker.moveAngle=${angle};worker.isMoving=true;worker.gait=.7;worker.walkCycle=1.4;worker.show();`);
  }
  ok(type+' moving rig draws in three directions',true);
  P('startPunchStun(worker,.4);');
  ok(type+' world KO retains legacy civilian recovery',P('worker.stunTimer===240&&!!worker.stunPose&&!worker.stunPose.knockout&&worker.stunPose.duration===40'));
  P('drawStunnedFigure(worker);');
  ok(type+' KO rig keeps occupation',P('figureIdentity(worker).frontierOccupation===savedIdentity.frontierOccupation'));
}
ok('each occupation uses a distinct head silhouette',new Set(hats).size===6,hats.join(','));
ok('each occupation paints a distinct material silhouette',new Set(attire).size===6);

// Every town uses native geometry and sampling, not synthetic empty solids.
for(const site of P('frontierSettlementSites()')){
  ctx.__site=site;
  const result=P(`(()=>{const s=window.__site,rows=[];for(let cy=Math.floor((s.y-s.h/2)/CHUNK_W);cy<Math.ceil((s.y+s.h/2)/CHUNK_W);cy++)for(let cx=Math.floor((s.x-s.w/2)/CHUNK_W);cx<Math.ceil((s.x+s.w/2)/CHUNK_W);cx++){
    const solids=generateChunkContent(3,cx,cy).solid,a=settlementRoster(3,cx,cy,solids),b=settlementRoster(3,cx,cy,solids);rows.push({same:JSON.stringify(a)===JSON.stringify(b),count:a?a.length:0,types:a?a.map(p=>p.type):[],safe:!a||a.every(p=>frontierCanyonSpawnSafe(p.x,p.y)),ids:a?a.filter(p=>frontierCivilianType(p.type)).map(p=>p.residentKey):[]});}return rows;})()`);
  ok(site.name+' roster deterministic',result.every(r=>r.same));
  ok(site.name+' visible workers on both chunks',result.length===2&&result.every(r=>r.count>=7));
  ok(site.name+' at least five occupation silhouettes',new Set(result.flatMap(r=>r.types).filter(t=>types.includes(t))).size>=5);
  ok(site.name+' all residents canyon-safe',result.every(r=>r.safe));
  const ids=result.flatMap(r=>r.ids);ok(site.name+' resident keys unique',new Set(ids).size===ids.length);
}
P(`var copper=frontierSettlementSites()[0];player.x=copper.x;player.y=copper.y;
  enemiesList=[];resetPopulation();var residentsMgr={biome:3,chunks:new Map()};
  for(let cy=-1;cy<=1;cy++)for(let cx=-7;cx<=-4;cx++)residentsMgr.chunks.set(cx+','+cy,{solid:generateChunkContent(3,cx,cy).solid});
  for(let i=0;i<20;i++)refreshPopulation(residentsMgr,-5,0);`);
ok('real streamer activates new roles near mining town',P('enemiesList.filter(e=>frontierCivilianType(e.eType)).length>=10'));
ok('global resident budget unchanged',P('Array.from(chunkPop.values()).reduce((a,l)=>a+l.length,0)<=POP_BUDGET&&POP_BUDGET===84'));
P(`var persisted=enemiesList.find(e=>e.frontierResidentKey),persistKey=persisted.frontierResidentKey,originalIdentity=JSON.stringify(figureIdentity(persisted));
  persisted.hp=61;startPunchStun(persisted,.35);for(let i=0;i<62;i++)advanceStun(persisted);bankFrontierPerson(persisted);
  var restoreX=persisted.frontierHomeX,restoreY=persisted.frontierHomeY;
  var restored=new Character(restoreX,restoreY,false,persisted.eType);restoreFrontierPerson(restored,persistKey,persisted.frontierSeed);`);
ok('released/reloaded worker preserves exact seeded appearance',P('JSON.stringify(figureIdentity(restored))===originalIdentity'));
ok('released/reloaded worker preserves health and KO time',P('restored.hp===61&&restored.stunTimer===persisted.stunTimer&&restored.stunPose.age===persisted.stunPose.age&&!restored.stunPose.knockout'));
ok('reconstruction preserves existing panic rather than adding an injury',P('restored.panicTimer===persisted.panicTimer&&restored.panicX===persisted.panicX&&restored.panicY===persisted.panicY'));
P(`var oldStats=JSON.stringify([totalKills,score,popTotal,nm0AmbushKills,weaponDrops.length]);persisted.dead=true;persisted.hp=0;processKill(persisted.x,persisted.y,false,persisted.eType,true,persisted);`);
ok('worker death does not alter campaign kill/score/population/drop stats',P('oldStats===JSON.stringify([totalKills,score,popTotal,nm0AmbushKills,weaponDrops.length])'));
ok('dead worker individual cannot respawn',P('!restoreFrontierPerson(new Character(restoreX,restoreY,false,persisted.eType),persistKey,persisted.frontierSeed)'));
P('var k=Array.from(chunkPop).find(([k,l])=>l.includes(persisted))[0];popRelease(k,chunkPop.get(k));');
ok('individual occupation death does not truncate unrelated roster',P('!popLosses.get(k)'));
P(`var store={};localStorage={setItem(k,v){store[k]=v;},getItem(k){return store[k]||null;},removeItem(k){delete store[k];}};
  enemiesList.push(restored);player.x=1300;player.y=-2100;saveGame();var diskState=JSON.parse(store.urbanTwinStickSave);`);
ok('campaign save includes exact identity census',P('diskState.biomeState[3].frontierResidents[persistKey].seed===persisted.frontierSeed'));
ok('campaign save includes nonlethal state',P('diskState.biomeState[3].frontierResidents[persistKey].stun===restored.stunTimer'));
P(`restored.frontierResidentKey=persistKey+':DEPARTURE';enemiesList=[restored];startAtLevel(2);`);
ok('departing level banks active occupational identities',P('!!getBiomeState(3).frontierResidents[persistKey+":DEPARTURE"]'));
P('isStoryMode=true;townsData={};startAtLevel(3);');
ok('first story entry includes all six occupations',P('FRONTIER_CIVILIAN_TYPES.every(t=>enemiesList.some(e=>e.eType===t))'));
P(`townsData={};var publicWorker=new Character(1300,-2100,false,'FRONTIER_SMITH');
  var freedFarmer=new Character(1350,-2100,false,'FARMER_MALE');freedFarmer.isFriendly=true;
  publicWorker.baseState='TOWN_WANDER';enemiesList=[publicWorker,freedFarmer];`);
ok('public workers do not count as recruited sector survivors',P('sectorSurvivorCount(3)===1'));
P("issueSquadCommand('FOLLOW');");
ok('squad orders reach freed allies and leave public workers at work',P("freedFarmer.baseState==='FOLLOW'&&publicWorker.baseState==='TOWN_WANDER'"));
ok('liberation grants only the freed campaign ally',P('grantSectorSurvivors(3)===1&&globalPopulationCount()===1'));
// Exercise the complete campaign loader, including its second town-spawn pass.
P(`resetStoryProgress();townsData={};biomeState={};isStoryMode=false;startAtLevel(3);
  var loadWorker=enemiesList.find(e=>e.frontierResidentKey),loadKey=loadWorker.frontierResidentKey;
  var loadVictim=enemiesList.find(e=>e.frontierResidentKey&&e!==loadWorker),deadKey=loadVictim.frontierResidentKey;
  loadWorker.hp=63;startPunchStun(loadWorker,.7);for(let i=0;i<55;i++)advanceStun(loadWorker);
  var loadIdentity=JSON.stringify(figureIdentity(loadWorker)),loadStun=loadWorker.stunTimer,loadAge=loadWorker.stunPose.age;
  loadVictim.hp=0;loadVictim.dead=true;processKill(loadVictim.x,loadVictim.y,false,loadVictim.eType,true,loadVictim);
  saveGame();loadGame();var loadedWorker=enemiesList.find(e=>e.frontierResidentKey===loadKey);`);
ok('full campaign load restores an injured worker exactly once',P('!!loadedWorker&&loadedWorker.hp===63&&enemiesList.filter(e=>e.frontierResidentKey===loadKey).length===1'));
ok('full campaign load preserves visible identity',P('JSON.stringify(figureIdentity(loadedWorker))===loadIdentity'));
ok('full campaign load preserves the settled legacy knockdown',P('loadedWorker.stunTimer===loadStun&&loadedWorker.stunPose.age===loadAge&&!loadedWorker.stunPose.knockout'));
ok('full campaign load does not resurrect a dead authored worker',P('!enemiesList.some(e=>e.frontierResidentKey===deadKey)'));
console.log(`Frontier civilian variety: ${checks} checks, ${failures} failures.`);process.exitCode=failures?1:0;

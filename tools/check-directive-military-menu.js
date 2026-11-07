// Exercise the actual Directive draw/touch routes, including the edit buffer.
// Military accounting and hostile spawn routes have separate focused checks.
const { ctx, probe } = require('./harness.js');
const P = (s) => probe('(' + s + ')');
let checks = 0, fails = 0;
const ok = (name, condition, detail) => {
  checks++;
  if (!condition) { fails++; console.log('  FAIL ' + name + (detail === undefined ? '' : '  ' + detail)); }
};
let seed = 83107;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const n = seed / 4294967296;
  if (a === undefined) return n;
  if (Array.isArray(a)) return a[(n * a.length) | 0];
  return b === undefined ? a * n : a + (b - a) * n;
};
ctx.setTimeout = () => 0;
let slot = null;
ctx.localStorage = { getItem: () => slot, setItem: (key, value) => { slot = value; }, removeItem: () => { slot = null; } };

function fixture(panel = 'WORLD', owned = true, level = 1) {
  probe(`{ isStoryMode = true; townsData = {}; window.outpostForts = {};
    window.pendingEscortRoster = []; window.escortHome = POP_POOL;
    window.militaryToBring = 0; window.militaryToBringM = 0; window.militaryToBringF = 0;
    window.towersDefeated = false; window.southGateBreachedStatus = ${owned};
    townsData[${level}] = { established: ${owned}, towersDown: ${owned} };
    startAtLevel(${level}); started = true;
    if (${owned} && ${level} !== 1) outpostFortState(${level}).captured = true;
    enemiesList = []; townCitizens = [];
    player.x = 19000; player.y = 19000;
    window.archBarrierReady = false; window.inNM0SecretOverlay = false;
    inTownCutscene = false; inPostAmbushCutscene = false; inFortCutscene = false;
    inFarmCutscene = false; inFarmPostCutscene = false;
    killcamMode = false; isDead = false; isWin = false; nm0AmbushActive = false;
    window.nm0AmbushClearedStatus = ${owned}; window.towersDefeated = ${owned};
    inTravelMenu = false; inOverworldView = false;
    viewingTownId = ${level};
    grantCitizens(POP_POOL, 13, 8);
    const menuPool = poolLedger();
    menuPool.popUnassignedM = 2; menuPool.popUnassignedF = 0;
    menuPool.popMilitaryM = 8; menuPool.popMilitaryF = 6;
    menuPool.popFarmingM = 2; menuPool.popFarmingF = 1;
    menuPool.popScienceM = 1; menuPool.popArchitectureF = 1;
    menuPool.popTotal = sectorPopSum(menuPool);
    invalidateDirectiveBuffer(); beginDirective(POP_POOL, '${panel}');
    inWorldBuildingMenu = ${panel === 'WORLD'};
    isPaused = ${panel === 'PAUSE'}; pauseMenuState = 'GOV_DIRECTIVE';
    width = 1200; height = 800; touches = []; mouseIsPressed = false;
    leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
    window._holdTimers = {}; window.lastPauseTime = -100000; }`);
}
function labels(call = 'draw();') {
  const text = ctx.text, seen = [];
  ctx.text = (s, x, y) => seen.push({ s: String(s), x, y });
  try { probe(call); } finally { ctx.text = text; }
  return seen;
}
function tap(x, y) {
  probe(`mouseX = ${x}; mouseY = ${y}; touches = []; mouseIsPressed = false;
    window.lastPauseTime = -100000; touchStarted();`);
}
function hold(x, y, frames = 1) {
  probe(`mouseX = ${x}; mouseY = ${y}; mouseIsPressed = true; touches = [];
    for (let menuFrame = 0; menuFrame < ${frames}; menuFrame++) drawMilitaryDeploymentMenu();
    mouseIsPressed = false; drawMilitaryDeploymentMenu();`);
}
const counts = () => P('({ male: countEscort(false), female: countEscort(true) })');

console.log('== redeploying from a town icon ==');
fixture('WORLD');
probe('window.popFarmingM+=window.popUnassignedM;window.popUnassignedM=0;popUnassigned=0;');
const firstDirectiveLabels=labels();
const militaryEntry=firstDirectiveLabels.find(t=>t.s==='MILITARY TO BRING');
tap(militaryEntry.x,militaryEntry.y);
hold(710,250);hold(710,250);hold(710,324);
tap(600,735);
ok('successful military deployment returns to the world',P('!isPaused&&!inWorldBuildingMenu&&inOverworldView'));
const redeployPool=P('JSON.stringify(poolLedger())');
const redeploySector=P('JSON.stringify(sectorLedger(currentLevel))');
const redeployTotal=P('globalPopulationCount()');
tap(450,400);
ok('the town-icon tap opens the Directive after deployment',P('inWorldBuildingMenu&&!inOverworldView'));
ok('the town-icon tap keeps the pooled ledger unchanged',P('JSON.stringify(poolLedger())')===redeployPool);
ok('the town-icon tap does not copy pooled people to the sector',P('JSON.stringify(sectorLedger(currentLevel))')===redeploySector);
ok('the town-icon tap preserves the global population',P('globalPopulationCount()')===redeployTotal);
const reopenedDirectiveLabels=labels();
ok('the reopened Directive actually draws its assignment controls',reopenedDirectiveLabels.some(t=>t.s==='NEW GOVERNMENT DIRECTIVE'));
tap(600,735);
ok('confirming the reopened Directive retains the pooled ledger',P('JSON.stringify(poolLedger())')===redeployPool);
ok('confirming the reopened Directive retains the sector ledger',P('JSON.stringify(sectorLedger(currentLevel))')===redeploySector);
ok('confirming the reopened Directive retains the global population',P('globalPopulationCount()')===redeployTotal);
ok('town-icon deployment keeps the combat detachment alive once',counts().male===2&&counts().female===1);
ok('town-icon deployment creates each reserve resident once',P('townCitizens.length')===redeployTotal-3);
ok('town-icon deployment excludes active military from reserve residents',P('townCitizens.filter(c=>c.role==="MILITARY").length')===11);

fixture('WORLD');
probe('loadLedgerIntoWindow(currentLevel);openSectorDirective(currentLevel);');
ok('opening an established sector restores the pooled Directive counts',P('window.popMilitaryM===8&&window.popMilitaryF===6&&window.popFarmingM===2'));

console.log('== Directive military submenu ==');
for (const panel of ['WORLD', 'PAUSE']) {
  fixture(panel);
  const sourceLabels = labels();
  const entry = sourceLabels.find(t => t.s === 'MILITARY TO BRING');
  ok(panel + ': Directive draws the military submenu entry', !!entry);
  if (!entry) continue;
  // Assigning from UNASSIGNED before opening must survive the transition.
  probe('window.popMilitaryM++; window.popUnassignedM--; window.militaryToBringM = 1;');
  const worldBefore = P('globalPopulationCount()');
  tap(entry.x, entry.y);
  ok(panel + ': drawn entry opens the paused submenu', P('isPaused && pauseMenuState === "MILITARY_BRING" && !inWorldBuildingMenu'));
  ok(panel + ': current Directive edits were committed', P('poolLedger().popMilitaryM === 9 && poolLedger().popUnassignedM === 1'));
  const available = P('militaryDeploymentAvailable()');
  ok(panel + ': availability excludes pending travel troops', available.male === 8 && available.female === 6,
    JSON.stringify(available));
  const menuLabels = labels();
  ok(panel + ': submenu has title, deployment and return controls',
    menuLabels.some(t => t.s === 'MILITARY TO BRING') && menuLabels.some(t => t.s === 'DEPLOY') && menuLabels.some(t => t.s === 'BACK'));

  tap(710, 250);
  ok(panel + ': tap route does not also apply the drawn plus button', P('militarySelectionM') === 0);
  hold(710, 250);
  hold(710, 250);
  hold(710, 324);
  ok(panel + ': gender rows select two men and one woman', P('militarySelectionM === 2 && militarySelectionF === 1'));
  hold(490, 250);
  ok(panel + ': minus removes only the selected male count', P('militarySelectionM === 1 && militarySelectionF === 1'));
  probe('touches = [{x:710,y:250}]; drawMilitaryDeploymentMenu(); touches = []; drawMilitaryDeploymentMenu();');
  ok(panel + ': a held touch uses the same selection controls', P('militarySelectionM === 2 && militarySelectionF === 1'));
  tap(600, 735);
  const active = counts();
  ok(panel + ': DEPLOY creates the selected combat troops', active.male === 2 && active.female === 1, JSON.stringify(active));
  ok(panel + ': active troops spawn at owned fortress away from player', P(`enemiesList.filter(e => e.isMilitary).every(e =>
    insideOwnedFortress(currentLevel, e.x, e.y) && Math.hypot(e.x-player.x,e.y-player.y) > 7000)`));
  ok(panel + ': deployment leaves pool and world population unchanged',
    P('poolLedger().popMilitaryM === 9 && poolLedger().popMilitaryF === 6 && globalPopulationCount()') === worldBefore);
  ok(panel + ': deployment preserves pending travel selection', P('window.militaryToBringM === 1 && window.militaryToBringF === 0'));
  tap(600, 735);
  ok(panel + ': tapping DEPLOY again cannot repeat the dispatched selection', counts().male === 2 && counts().female === 1);

  probe(`inWorldBuildingMenu=${panel==='WORLD'};isPaused=${panel==='PAUSE'};
    pauseMenuState='GOV_DIRECTIVE';openMilitaryDeploymentMenu();`);
  const remaining = P('militaryDeploymentAvailable()');
  ok(panel + ': reopening subtracts active and pending troops from reserve', remaining.male === 6 && remaining.female === 5,
    JSON.stringify(remaining));
  hold(710, 250, 160);
  hold(710, 324, 160);
  ok(panel + ': held selection cannot exceed available department members', P('militarySelectionM === 6 && militarySelectionF === 5'));
  const beforeBack = counts();
  tap(600, 780);
  ok(panel + ': BACK returns to the Directive', panel === 'WORLD' ? P('inWorldBuildingMenu && !isPaused') : P('isPaused && pauseMenuState === "GOV_DIRECTIVE"'));
  ok(panel + ': BACK does not deploy selected troops', counts().male === beforeBack.male && counts().female === beforeBack.female);
  ok(panel + ': returning never reloads stale assignments', P('window.popMilitaryM === 9 && window.popUnassignedM === 1'));
}

console.log('\n== population deployment routes ==');
for (const panel of ['WORLD', 'PAUSE']) {
  fixture(panel);
  probe('window.popFarmingM += window.popUnassignedM; window.popUnassignedM = 0; popUnassigned = 0;');
  const worldBefore = P('globalPopulationCount()');
  tap(600, 735);
  ok(panel + ': confirming deploys the assigned department population', P('townCitizens.length') === worldBefore,
    P('townCitizens.length') + ' of ' + worldBefore);
  ok(panel + ': civilians deploy inside the captured starting fortress',
    P('townCitizens.every(c => c.fortressHome && c.fortressHome.id === "SECTOR" && insideOwnedFortress(currentLevel,c.x,c.y))'));
  ok(panel + ': civilians deploy away from the player', P('townCitizens.every(c => Math.hypot(c.x-player.x,c.y-player.y) > 7000)'));
  ok(panel + ': confirmation leaves population totals unchanged', P('globalPopulationCount()') === worldBefore);
  probe(`for (let citizenFrame = 0; citizenFrame < 360; citizenFrame++) {
    frameCount++; for (const c of townCitizens) c.update(); }`);
  ok(panel + ': idle civilians remain within their owned fortress', P(`townCitizens.every(c =>
    c.x >= c.fortressHome.innerX0 && c.x <= c.fortressHome.innerX1 &&
    c.y >= c.fortressHome.innerY0 && c.y <= c.fortressHome.innerY1)`));
}

fixture('PAUSE', true, 2);
probe('window.popFarmingM += window.popUnassignedM; window.popUnassignedM = 0; popUnassigned = 0;');
tap(600, 735);
ok('captured outpost deploys population in its own sector', P('townCitizens.length > 0 && townCitizens.every(c => c.fortressHome.id === "OUTPOST" && c.fortressHome.biome === 2 && insideOwnedFortress(2,c.x,c.y))'));
const savedPopulation = P('townCitizens.length');
probe('saveGame(); townCitizens = []; loadGame();');
ok('loading restores the deployed population at its owned fortress', P(`townCitizens.length === ${savedPopulation} && townCitizens.every(c =>
  c.fortressHome && c.fortressHome.id === 'OUTPOST' && insideOwnedFortress(2,c.x,c.y))`),
  P('JSON.stringify({count:townCitizens.length,towers:window.towersDefeated,ambush:nm0AmbushActive,townCutscene:inTownCutscene,postCutscene:inPostAmbushCutscene,forts:ownedFortresses(currentLevel),ledger:poolLedger(),population:townCitizens.map(c=>[c.role,c.gender,c.fortressHome&&c.fortressHome.id])})'));
ok('loading keeps citizens away from the saved player position', P('townCitizens.every(c => Math.hypot(c.x-player.x,c.y-player.y) > 7000)'));

fixture('PAUSE');
probe(`deployActiveMilitary(3,2); window.militaryToBringM = 1;
  window.popFarmingM += window.popUnassignedM; window.popUnassignedM = 0; popUnassigned = 0;`);
tap(600, 735);
ok('active and pending soldiers are not also shown as idle civilians', P(`townCitizens.filter(c=>c.role==='MILITARY'&&c.gender==='MALE').length===4 &&
  townCitizens.filter(c=>c.role==='MILITARY'&&c.gender==='FEMALE').length===4`));
ok('reserve visualization does not remove active or pending soldiers', counts().male === 3 && counts().female === 2 && P('window.militaryToBringM') === 1);
ok('reserve visualization does not reduce department ledgers', P('poolLedger().popMilitaryM === 8 && poolLedger().popMilitaryF === 6'));

const edgeShoves = P(`(() => {
  const f=ownedFortresses(currentLevel)[0], cx=(f.innerX0+f.innerX1)/2, cy=(f.innerY0+f.innerY1)/2;
  return [[f.innerX0+15,cy,5,0],[f.innerX1-15,cy,-5,0],
    [cx,f.innerY0+15,0,5],[cx,f.innerY1-15,0,-5]].map(([x,y,dx,dy])=>{
    const resident=new Citizen(x,y,'FARMING','MALE');resident.fortressHome=f;
    const crowd=new Citizen(x+dx,y+dy,'FARMING','FEMALE');crowd.fortressHome=f;
    townCitizens=[resident,crowd];player.x=x+dx;player.y=y+dy;
    resident.resolveCollisions();
    return resident.x>=f.innerX0+15&&resident.x<=f.innerX1-15&&
      resident.y>=f.innerY0+15&&resident.y<=f.innerY1-15;
  });
})()`);
for (const [index, edge] of ['west','east','north','south'].entries())
  ok('player and neighbor collision cannot shove a resident through the ' + edge + ' boundary', edgeShoves[index]);

fixture('PAUSE');
probe(`deployActiveMilitary(3,2); window.militaryToBringM = 1;
  mouseX=568;mouseY=325;mouseIsPressed=true;
  for(let assignmentFrame=0;assignmentFrame<180;assignmentFrame++)draw();
  mouseIsPressed=false;draw();`);
ok('Military assignment cannot unassign active or reserved men', P('window.popMilitaryM') === 4, P('window.popMilitaryM'));
probe(`mouseX=687;mouseY=325;mouseIsPressed=true;
  for(let assignmentFrame=0;assignmentFrame<180;assignmentFrame++)draw();
  mouseIsPressed=false;draw();`);
ok('Military assignment cannot unassign active women', P('window.popMilitaryF') === 2, P('window.popMilitaryF'));

fixture('PAUSE', true, 2);
probe(`postCitizen('Science','M',POP_POOL,2);
  beginDirective(POP_POOL,'PAUSE');
  window.popFarmingM+=window.popUnassignedM;window.popUnassignedM=0;popUnassigned=0;`);
const postedPopulation = P('globalPopulationCount()');
tap(600,735);
ok('sector-posted residents deploy together with the remaining pooled people', P('townCitizens.length') === postedPopulation);
ok('the sector-posted department appears once in the fortress population', P('townCitizens.filter(c=>c.role==="SCIENCE"&&c.gender==="MALE").length') === 1);
ok('deployment retains sector postings and pooled ledgers', P('sectorLedger(2).popScienceM===1&&poolLedger().popScienceM===0&&globalPopulationCount()') === postedPopulation);

console.log('\n== captured outpost without sector towers ==');
fixture('PAUSE',true,3);
probe(`{window.towersDefeated=false;townsData[3].towersDown=false;
  const outpostOnlyPool=poolLedger();
  for(const d of POP_DEPTS)for(const sex of ['M','F'])outpostOnlyPool['pop'+d+sex]=0;
  outpostOnlyPool.popUnassignedM=outpostOnlyPool.popUnassignedF=0;
  outpostOnlyPool.popFarmingM=5;outpostOnlyPool.popTotal=5;
  invalidateDirectiveBuffer();beginDirective(POP_POOL,'PAUSE');}`);
tap(600,735);
ok('an owned Level 3 outpost deploys five farmers without sector towers',P('townCitizens.length===5&&!window.towersDefeated'));
probe(`saveGame();townsData={};window.outpostForts={};townCitizens=[];enemiesList=[];
  window.popFarmingM=0;popFarming=0;loadGame();`);
ok('cold loading an outpost-only sector restores its five residents',P('townCitizens.length')===5,P('townCitizens.length'));
ok('outpost-only reload preserves the captured fortress',P('outpostFortState(3).captured===true&&ownedFortresses(3).length===1'));
ok('outpost-only reload retains fortress homes and farmer identities',P('townCitizens.length===5&&townCitizens.every(c=>c.role==="FARMING"&&c.gender==="MALE"&&c.fortressHome&&c.fortressHome.id==="OUTPOST"&&c.fortressHome.biome===3&&insideOwnedFortress(3,c.x,c.y))'));
ok('outpost-only reload preserves the five-person ledger',P('poolLedger().popFarmingM===5&&globalPopulationCount()===5'));
ok('outpost-only reload does not invent a tower capture or town scene',P('!window.towersDefeated&&!inTownCutscene&&!inPostAmbushCutscene'));

console.log('\n== fortress prerequisite ==');
fixture('WORLD', false);
const reserve = P('JSON.stringify(poolLedger())');
probe('openMilitaryDeploymentMenu(); militarySelectionM = 2; militarySelectionF = 1;');
const lockedLabels = labels();
ok('unowned sector displays the capture prerequisite', lockedLabels.some(t => /FORTRESS/i.test(t.s) && /CAPTURE|OWN/i.test(t.s)));
tap(600, 735);
ok('an unowned sector cannot deploy combat troops', counts().male + counts().female === 0);
ok('a denied deployment does not change department assignments', P('JSON.stringify(poolLedger())') === reserve);
probe('deployDirectivePopulation();');
ok('an unowned sector does not put civilians on the player', P('townCitizens.length') === 0);

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

const { ctx, probe } = require('./harness.js');
const P = expression => probe('(' + expression + ')');
let checks = 0, failures = 0;
const ok = (name, condition, detail) => {
  checks++;
  if (!condition) { failures++; console.log('FAIL ' + name + (detail === undefined ? '' : ': ' + JSON.stringify(detail))); }
};
let seed = 817263;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const n = seed / 4294967296;
  return a === undefined ? n : Array.isArray(a) ? a[Math.floor(n * a.length)] : b === undefined ? n * a : a + n * (b - a);
};
let slot;
ctx.localStorage = { getItem: () => slot || null, setItem: (key, value) => { slot = value; }, removeItem: () => { slot = null; } };
const fixture = () => probe(`
  isStoryMode = true; window.outpostForts = {}; window.travelArrival = null;
  window.militaryToBring = 0; window.militaryToBringM = 0; window.militaryToBringF = 0;
  window.pendingEscortRoster = []; window.escortHome = POP_POOL;
  townsData = {1: {established: true, towersDown: true}, POOL: {popMilitaryM: 7, popMilitaryF: 5}};
  window.southGateBreachedStatus = true; startAtLevel(1, true);
  player.x = 15000; player.y = 15000;
`);
fixture();
const population = P('globalPopulationCount()');
ok('pool soldiers are available', P('militaryDeploymentAvailable().male') === 7 && P('militaryDeploymentAvailable().female') === 5);
ok('owned starting fortress allows deployment', P('militaryDeploymentAvailable().canDeploy'));
const initial = P('deployActiveMilitary(3,2)');
ok('exact selection becomes active', initial.total === 5 && P('countEscort(false)') === 3 && P('countEscort(true)') === 2, initial);
ok('deployment does not create or emigrate citizens', P('globalPopulationCount()') === population && P('poolLedger().popMilitaryM') === 7);
ok('all troops muster inside owned gates', P('enemiesList.filter(e => e.isMilitary).every(e => insideOwnedFortress(currentLevel,e.x,e.y))'));
ok('no troops appear on player', P('enemiesList.filter(e => e.isMilitary).every(e => Math.hypot(e.x-player.x,e.y-player.y)>1000)'));
ok('troops actively follow and fight', P('enemiesList.filter(e => e.isMilitary).every(e => e.isFriendly && e.baseState === "FOLLOW" && e.hp === 300)'));
ok('distant fortress troops still receive army movement updates', P(`(() => {
  const soldiers=enemiesList.filter(e=>e.isMilitary), saved=soldiers.map(e=>e.updateEnemy);let ticks=0;
  for(const e of soldiers)e.updateEnemy=()=>ticks++;
  doTick=true;isDead=false;isWin=false;updateEntities();
  soldiers.forEach((e,i)=>e.updateEnemy=saved[i]);return ticks===soldiers.length;
})()`));
ok('active troops are unavailable for repeated deployment', P('militaryDeploymentAvailable().male') === 4 && P('militaryDeploymentAvailable().female') === 3);
probe('window.militaryToBringM = 2; window.militaryToBringF = 1;');
ok('pending travel selections also reserve troops', P('militaryDeploymentAvailable().male') === 2 && P('militaryDeploymentAvailable().female') === 2);
ok('travel availability excludes its own selection', P('travelMilitaryAvailable().male') === 4 && P('travelMilitaryAvailable().female') === 3);
probe('window.militaryToBringM = 0; window.militaryToBringF = 0;');
const extra = P('deployActiveMilitary(999,Infinity)');
ok('deployment clamps to remaining department availability', extra.male === 4 && extra.female === 0 && P('countEscort(false)') === 7, extra);
ok('an active detachment cannot be posted to another sector', P('postCitizen("Military","M",POP_POOL,2)') === false);
const invalid = P('deployActiveMilitary(NaN,-20)');
ok('invalid quantities cannot create troops', invalid.total === 0 && P('countEscort(false)') === 7);

// A female survivor must not be removed just because a male died first.
probe(`(() => { const e = enemiesList.find(e => e.isMilitary && e.escortSex === 'M');
  e.hp = 0; e.dead = true; processKill(e.x,e.y,false,e.eType,true,e); processKill(e.x,e.y,false,e.eType,true,e); })();`);
ok('male casualty debits the male department exactly once', P('poolLedger().popMilitaryM') === 6 && P('poolLedger().popMilitaryF') === 5);
ok('a casualty changes global population by one', P('globalPopulationCount()') === population - 1);
ok('a casualty updates live HUD count', P('window.militaryToBring') === 8);

// New-style saves retain the soldiers' identity, home and wounded HP while
// their old count fields remain compatible with existing save readers.
probe(`(() => { const soldiers=enemiesList.filter(e=>e.isMilitary&&!e.dead);
  soldiers[0].hp=147;soldiers[1].maxHp=325;soldiers[1].hp=325;saveGame(); })();`);
let state = JSON.parse(slot);
ok('save contains one record per survivor', state.escortRoster.length === 8);
ok('save retains department home and sex', state.escortRoster.every(e => e.home === 'POOL') && state.escortRoster.filter(e => e.sex === 'F').length === 2);
ok('live roster is distinct from empty pending selection', state.militaryPendingM === 0 && state.militaryPendingF === 0);
const positions = state.escortRoster.map(e => [e.x,e.y]);
probe('loadGame();');
ok('reload restores each survivor once', P('countEscort(false)+countEscort(true)') === 8);
ok('reload retains wound HP', P('enemiesList.some(e => e.isMilitary && e.hp === 147)'));
ok('reload retains earned military health upgrades', P('enemiesList.some(e=>e.isMilitary&&e.maxHp===325&&e.hp===325)'));
ok('reload retains fortress muster positions', JSON.stringify(P('liveMilitaryRoster().map(e => [e.x,e.y])')) === JSON.stringify(positions));
probe('saveGame(); loadGame();');
ok('repeated save-load does not multiply soldiers', P('countEscort(false)+countEscort(true)') === 8 && P('globalPopulationCount()') === population - 1);

// Additional recruits and already-active soldiers travel together, without
// replaying consumed selection counts on the next journey.
probe(`window.militaryToBringM = 1; window.militaryToBringF = 2;
  queueMilitaryDeparture(); window.travelArrival = 'SOUTH'; startAtLevel(2);`);
ok('travel carries active survivors and new recruits', P('countEscort(false)+countEscort(true)') === 10);
ok('consumed departure counts are cleared', P('window.militaryToBringM') === 0 && P('window.militaryToBringF') === 0 && P('window.pendingEscortRoster.length') === 0);
ok('travel makes the detachment arrive with player', P('enemiesList.filter(e => e.isMilitary).every(e => Math.hypot(e.x-player.x,e.y-player.y)<700)'));
probe(`window.travelArrival = 'SOUTH'; startAtLevel(3);`);
ok('another journey carries survivors once', P('countEscort(false)+countEscort(true)') === 10);
ok('another journey retains soldier health upgrades', P('enemiesList.some(e=>e.isMilitary&&e.maxHp===325&&e.hp===325)'));
ok('travel preserves global population', P('globalPopulationCount()') === population - 1);

// A posted garrison retains its separate home even alongside a pool force.
probe(`townsData[2] = {popMilitaryF: 2}; spawnEscortSoldier({x:player.x+100,y:player.y}, 'F', 2);
  saveGame(); loadGame();`);
const sectorBefore = P('sectorLedger(2).popMilitaryF'), poolBefore = P('poolLedger().popMilitaryF');
probe(`(() => { const e = enemiesList.find(e => e.isMilitary && e.escortHome === 2); e.hp = 0; e.dead = true;
  processKill(e.x,e.y,false,e.eType,true,e); })();`);
ok('mixed detachment casualty reaches exact home after reload', P('sectorLedger(2).popMilitaryF') === sectorBefore - 1 && P('poolLedger().popMilitaryF') === poolBefore);

fixture();
probe('townsData[1].established = false; townsData[1].towersDown = false; window.towersDefeated = false;');
ok('unowned fortress disables deployment', !P('militaryDeploymentAvailable().canDeploy'));
ok('unowned fortress cannot muster soldiers', P('deployActiveMilitary(7,5).total') === 0 && P('countEscort(false)+countEscort(true)') === 0);

// Legacy save files contain only aggregate pending counts. They still load
// through the normal escort path instead of dropping their army.
fixture();
probe('window.militaryToBringM=2;window.militaryToBringF=1;saveGame();');
state = JSON.parse(slot);
delete state.escortRoster; delete state.militaryPendingM; delete state.militaryPendingF;
slot = JSON.stringify(state);
probe('loadGame();');
ok('legacy saves still restore male and female escorts', P('countEscort(false)') === 2 && P('countEscort(true)') === 1);
ok('legacy pending counts are consumed on load', P('window.militaryToBringM') === 0 && P('window.militaryToBringF') === 0);

fixture();
probe('deployActiveMilitary(2,2); window.militaryToBringM=1; window.militaryToBringF=1; saveGame(); loadGame();');
ok('a save with active and pending troops restores their sum once', P('countEscort(false)') === 3 && P('countEscort(true)') === 3);
probe('saveGame(); loadGame();');
ok('consumed pending selection does not multiply on another reload', P('countEscort(false)+countEscort(true)') === 6);

// Old saves can still own sector rolls rather than the consolidated pool.
// Migration must move the soldiers' casualty paperwork with those rolls.
fixture();
probe(`townsData={1:{established:true},2:{popMilitaryF:3}};
  window.escortHome=2;window.militaryToBringM=0;window.militaryToBringF=1;saveGame();`);
state = JSON.parse(slot);
delete state.escortRoster; delete state.militaryPendingM; delete state.militaryPendingF;
slot = JSON.stringify(state);
probe(`loadGame(); (() => { const e=enemiesList.find(e=>e.isMilitary); e.hp=0;e.dead=true;
  processKill(e.x,e.y,false,e.eType,true,e); })();`);
ok('legacy ledger migration retains correct casualty home', P('poolLedger().popMilitaryF') === 2 && P('sectorLedger(2).popMilitaryF') === 0);
fixture();
probe('player.x=0;player.y=100;deployActiveMilitary(5,3);');
ok('soldiers muster near player already inside owned fortress', P('enemiesList.filter(e=>e.isMilitary).every(e=>Math.hypot(e.x-player.x,e.y-player.y)<1450)'));
console.log(`${checks} checks, ${failures} failures`);
process.exitCode = failures ? 1 : 0;

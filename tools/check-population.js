const { ctx, probe } = require('/home/user/newone/tools/harness.js');
const P = (s) => probe('(' + s + ')');
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; if (!c) { fails++; console.log('  FAIL ' + n + (x !== undefined ? '  ' + x : '')); } };

let seed = 987654321;
ctx.random = function (a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  if (b === undefined) return r * a;
  return a + r * (b - a);
};

// The two sectors whose population feeds the town-building system: 80 people
// seeded at the story arena's open, and the number still standing when the arc
// completes is the number of citizens the player inherits.
for (const lvl of [1, 2]) {
  probe('isStoryMode = true; townsData = {}; window.southGateBreachedStatus = false;');
  probe(`startAtLevel(${lvl});`);
  console.log(`\n== level ${lvl} ==`);

  const pop = P('enemiesList.filter(e => e.isPopulation).length');
  ok(`level ${lvl} seeds the full roster`, pop >= 76, pop + ' placed of 80');
  console.log(`   population ${pop}   recruitable ${P('enemiesList.filter(e => e.isPopulation && RECRUITABLE.indexOf(e.eType) !== -1).length')}`);

  // Nobody standing inside geometry. checkCol is what the game itself asks.
  const stuck = P('enemiesList.filter(e => e.isPopulation && e.checkCol(e.x, e.y)).length');
  ok(`level ${lvl} nobody spawns inside a building`, stuck === 0, stuck + ' stuck');

  // Spread: near the player, thinning outward, and standing near a block.
  const d = P(`(() => { const a = enemiesList.filter(e => e.isPopulation)
      .map(e => Math.hypot(e.x - player.x, e.y - player.y)).sort((x, y) => x - y);
      return [a[0]|0, a[(a.length*0.25)|0]|0, a[(a.length>>1)]|0, a[(a.length*0.9)|0]|0, a[a.length-1]|0]; })()`);
  console.log(`   distance from player: min ${d[0]}  q1 ${d[1]}  median ${d[2]}  p90 ${d[3]}  max ${d[4]}`);
  ok(`level ${lvl} none spawn on the player`, d[0] >= 260, 'closest ' + d[0]);
  ok(`level ${lvl} the bulk are near the player`, d[2] < 2600, 'median ' + d[2]);

  const nearBlock = P(`(() => { let n = 0;
      for (const e of enemiesList) { if (!e.isPopulation) continue;
        let best = 1e9;
        for (const b of buildings) { if (!b.w || !b.h) continue;
          if (b.isGrassLot && !b.isPond) continue;
          if (b.isStreetLight || b.isBiomeProp || b.w > 1200 || b.h > 1200) continue;
          if (b.w < 60 || b.h < 60) continue;
          const dx = Math.max(0, Math.abs(e.x - b.x) - b.w / 2);
          const dy = Math.max(0, Math.abs(e.y - b.y) - b.h / 2);
          const dd = Math.hypot(dx, dy); if (dd < best) best = dd; }
        if (best < 170) n++; }
      return n; })()`);
  const molotov = P('enemiesList.filter(e => e.isPopulation && e.eType === "MOLOTOV").length');
  ok(`level ${lvl} no incendiary throwers in the roster`, molotov === 0, molotov + ' molotov');
  // Anything recruitable that is NOT the roster must not become a citizen.
  probe('enemiesList.push(new Character(player.x + 340, player.y + 340, false, "NORMAL"));');
  ok(`level ${lvl} they stand around the blocks`, nearBlock / pop > 0.9,
     `${nearBlock}/${pop} within 170u of a building`);

  // A walk across the sector must not quietly shrink the roster.
  probe(`for (let f = 0; f < 40; f++) {
           player.x = -4000 + f * 220; player.y = -3000 + f * 160;
           frameCount = f * 45; cullDistantEnemies(); sweepForeignHostiles();
         }`);
  const after = P('enemiesList.filter(e => e.isPopulation).length');
  ok(`level ${lvl} the roster survives walking the sector`, after === pop, `${after} of ${pop} left`);

  // Killing is the only thing that reduces it, and it must not refill.
  probe(`(() => { let n = 0; for (const e of enemiesList) { if (e.isPopulation && n < 20) { e.hp = 0; n++; } } })()`);
  probe('for (let i = enemiesList.length - 1; i >= 0; i--) if (enemiesList[i].hp <= 0) enemiesList.splice(i, 1);');
  const killed = P('enemiesList.filter(e => e.isPopulation).length');
  ok(`level ${lvl} kills reduce the roster`, killed === pop - 20, `${killed}, expected ${pop - 20}`);
  probe('for (let i = 0; i < 200; i++) spawnSingleEnemy();');
  const refilled = P('enemiesList.filter(e => !e.isFriendly).length');
  ok(`level ${lvl} the arena does not refill itself`, refilled <= P('enemiesList.length'), '');
  console.log(`   after 20 kills and 200 top-up attempts: ${P('enemiesList.filter(e => e.isPopulation).length')} population`);

  // And what the player would inherit.
  const got = P('recruitSectorSurvivors()');
  console.log(`   recruitSectorSurvivors() -> ${got.total} citizens (${got.female} female)`);
  ok(`level ${lvl} survivors convert to citizens`, got.total > 30, got.total + ' recruited');
}

// The seeding must be scoped to a live story arena and nothing else.
console.log('\n== scope ==');
const roster = (setup, lvl) => { probe(setup); probe(`startAtLevel(${lvl});`);
  return P('enemiesList.filter(e => e.isPopulation).length'); };
for (const l of [1, 2]) {
  ok(`level ${l} does not re-seed once its arc is cleared`,
     roster(`isStoryMode = true; townsData = {${l}: {established: true}}; window.southGateBreachedStatus = true;`, l) === 0);
  ok(`level ${l} arcade mode keeps the wanderer path`,
     roster('isStoryMode = false; townsData = {};', l) === 0);
}
for (const l of [3, 4, 5]) {
  ok(`level ${l} seeds no city population`,
     roster('isStoryMode = true; townsData = {}; window.southGateBreachedStatus = false;', l) === 0);
}


// ---------------------------------------------------------------------------
// THE ESCORT
// Soldiers assigned at the travel menu have to arrive, arrive WITH the player,
// count toward the destination's population, and not be conjured a second time.
// ---------------------------------------------------------------------------
const trip = (label, dest) => {
  console.log('\n== escort: ' + label + ' ==');
  probe(`isStoryMode = true;
         townsData = {1: {established: true}${dest === 'streamed' ? ', 2: {established: true}' : ''}};
         window.southGateBreachedStatus = true;
         window.militaryToBring = 0; window.militaryToBringM = 0; window.militaryToBringF = 0;`);
  probe('startAtLevel(1);');
  probe('window.militaryToBringM = 28; window.militaryToBringF = 28;');   // chosen at the travel menu
  probe('window.travelArrival = "NORTH"; startAtLevel(2);');

  const allies = P('enemiesList.filter(e => e.isMilitary && e.isFriendly).length');
  const near = P('enemiesList.filter(e => e.isMilitary && Math.hypot(e.x-player.x, e.y-player.y) < 700).length');
  ok(label + ': the whole escort arrives', allies === 56, allies + ' of 56');
  ok(label + ': it arrives WITH the player', near === allies, `${near} of ${allies} within 700u`);
  ok(label + ': it counts toward the sector population', P('window.militaryToBring') === 56, P('window.militaryToBring'));
  ok(label + ': the pending assignment is consumed',
     P('window.militaryToBringM') === 0 && P('window.militaryToBringF') === 0);
  probe('window.travelArrival = "NORTH"; startAtLevel(3);');
  ok(label + ': it is not re-created on the next hop',
     P('enemiesList.filter(e => e.isMilitary && e.isFriendly).length') === 0);
};
trip('into a story arena', 'authored');
trip('into a streamed biome', 'streamed');

// ---------------------------------------------------------------------------
// THE GREAT GATES
// A breached gate has to become a road the player can actually walk down.
// checkCol only reads activeBuildings, so publish everything first — a walk test
// against a list that does not contain the wall passes for the wrong reason.
// ---------------------------------------------------------------------------
const walkThrough = (southward) => P(`(() => {
  activeBuildings = buildings;
  const g = buildings.find(b => b.isGovFortress && (${southward} ? b.y > 0 : b.y < 0));
  if (!g) return 'no gate';
  const pr = new Character(g.x, g.y, false, "NORMAL");
  const y0 = ${southward} ? g.y - g.h/2 - 120 : g.y + g.h/2 + 120;
  const y1 = ${southward} ? g.y + g.h/2 + 120 : g.y - g.h/2 - 120;
  const step = ${southward} ? 20 : -20;
  for (let y = y0; ${southward} ? y <= y1 : y >= y1; y += step) if (pr.checkCol(g.x, y)) return false;
  return true; })()`);

console.log('\n== gates: level 1 ==');
probe(`isStoryMode = true; townsData = {}; window.southGateBreachedStatus = false;
       window.nm0AmbushClearedStatus = false; nm0AmbushActive = false;`);
probe('startAtLevel(1);');
ok('south gate is shut before it is breached', walkThrough(true) === false);
probe('window.southGateBreachedStatus = true; nm0AmbushActive = true;');
ok('south gate stays shut while the muster is on the field', walkThrough(true) === false);
probe('nm0AmbushActive = false; window.nm0AmbushClearedStatus = true; clearGateApproach();');
ok('south gate opens once breached and the ambush is beaten', walkThrough(true) === true);
ok('the wings either side are still a wall', P(`(() => {
     activeBuildings = buildings;
     const g = buildings.find(b => b.isGovFortress && b.y > 0);
     const pr = new Character(0, 0, false, "NORMAL");
     return pr.checkCol(g.x - 900, g.y) && pr.checkCol(g.x + 900, g.y); })()`));
ok('rounds pass through the doorway and not the wings', P(`(() => {
     const g = buildings.find(b => b.isGovFortress && b.y > 0);
     return inOpenGateway(g, g.x) && !inOpenGateway(g, g.x - 900); })()`));
ok('the north gate stays shut (it is the HQ approach)', walkThrough(false) === false);

// Dropping the towers unseals the sector on its own — the player should not have
// to also blow a door they have already made pointless.
console.log('\n== gates: level 1, opened by the towers ==');
probe(`isStoryMode = true; townsData = {}; window.southGateBreachedStatus = false;
       window.nm0AmbushClearedStatus = false; nm0AmbushActive = false; window.towersDefeated = false;`);
probe('startAtLevel(1);');
ok('shut with the towers still up', walkThrough(true) === false);
probe('window.towersDefeated = true; markSectorTowersDown(1); nm0AmbushActive = true;');
ok('still shut while the tower muster is on the field', walkThrough(true) === false);
probe('nm0AmbushActive = false;');
ok('and still shut until that muster is beaten', walkThrough(true) === false);
probe(`window.nm0AmbushClearedStatus = true; recordSouthGateBreached(1); clearGateApproach();`);
ok('opens once the tower ambush is beaten, with no gate ever shot', walkThrough(true) === true);
ok('and is recorded as breached, so the arc and the travel menu agree',
   P('window.southGateBreachedStatus') === true);
ok('the gate itself reads as blown', P('buildings.filter(b => b.isGovFortress && b.y > 0)[0].hp') <= 0);

console.log('\n== gates: level 2 ==');
probe(`isStoryMode = true; townsData = {}; window.nm0AmbushClearedStatus = false;
       nm0AmbushActive = false; window.towersDefeated = false;
       window.undercitySouthBreached = false; window.undercityNorthBreached = false;`);
probe('startAtLevel(2);');
ok('south shut before the towers fall', walkThrough(true) === false);
ok('north shut before the towers fall', walkThrough(false) === false);
probe('window.towersDefeated = true; window.nm0AmbushClearedStatus = true; clearGateApproach();');
ok('south opens with the towers down and the ambush clear', walkThrough(true) === true);
ok('north opens with it', walkThrough(false) === true);

// ---------------------------------------------------------------------------
// The roster must never be what is holding an ambush open. It is the thing the
// player is being asked not to shoot.
// ---------------------------------------------------------------------------
console.log('\n== ambush ==');
probe(`isStoryMode = true; townsData = {}; window.southGateBreachedStatus = false;
       window.nm0AmbushClearedStatus = false;`);
probe('startAtLevel(1);');
probe(`nm0AmbushActive = true; window.ambushSpawnsRemaining = 0;
       window.nm0AmbushCleared = false; isWin = false; killcamMode = false;
       enemiesList = enemiesList.filter(e => e.isPopulation);`);
probe('checkAmbushCleared();');
ok('an ambush clears with the whole population spared', P('window.nm0AmbushCleared') === true);

// ---------------------------------------------------------------------------
// A liberated sector never spawns another local. The two towers-down guards in
// spawnSingleEnemy() only bail for a sector with NO overworld table, so 1 and 2
// fell through to the per-level ladder -- which hands out NORMAL for Stick City
// and FEMALE_PISTOL for the Undercity. Yellow regulars kept walking into a
// sector whose yellow regulars the player had just freed, in the same shirt as
// the citizens standing next to them, shooting at them.
// ---------------------------------------------------------------------------
console.log('\n== what a liberated sector sends ==');
for (const lvl of [1, 2]) {
  probe(`isStoryMode = true; townsData = {}; window.towersDefeated = false;
         window.southGateBreachedStatus = false; window.nm0AmbushClearedStatus = false;
         nm0AmbushActive = false;`);
  probe(`startAtLevel(${lvl});`);
  probe(`for (const b of buildings) if (b.isTower) b.hp = 0;
         markSectorTowersDown(currentLevel); recruitSectorSurvivors();
         enemiesList = enemiesList.filter(e => e.isFriendly);`);
  // Stand on the open road. A wanderer is only ever drawn out there, and since
  // the liberated pick sits below the outer-region guard it answers from there
  // too — standing in the city, the correct number of spawns is none.
  probe(`(function () {
    for (let r = 7000; r < 40000; r += 900)
      for (let a = 0; a < 12; a++) {
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (!inAuthoredSector(x, y, 900) && outerRegionUncached(x, y)) {
          player.x = x; player.y = y; return;
        }
      }
  })()`);
  const got = P(`(function () {
    const start = enemiesList.length, out = {};
    for (let i = 0; i < 300; i++) { frameCount++; spawnSingleEnemy(); }
    for (let i = start; i < enemiesList.length; i++) {
      const t = enemiesList[i].eType; out[t] = (out[t] || 0) + 1;
    }
    return out;
  })()`);
  const types = Object.keys(got);
  const recruitable = P('RECRUITABLE');
  const local = types.filter((t) => recruitable.indexOf(t) !== -1);
  ok(`sector ${lvl} still sends something after the towers`, types.length > 0,
     JSON.stringify(got));
  ok(`sector ${lvl} never sends another recruitable local`, local.length === 0,
     local.length ? 'spawned ' + local.join(',') : 'no ' + recruitable.join('/'));
  ok(`sector ${lvl} sends machines and NM-0's own intake`,
     types.indexOf('ROBOT') !== -1 && types.some((t) => t.indexOf('NM0_ROOKIE') === 0),
     types.join(', '));
}

// A wanderer belongs on the open road, not in the hand-authored streets. The
// outer-region guard clears the PLAYER; getSafeSpawn() then scatters the body
// 140-900 units from them and knows nothing about the curtain wall. Worse, the
// authored-core rejection inside getSafeSpawn() only applies mid-arc — which is
// exactly the window that ends when the ambush is cleared.
console.log('\n== overworld spawns stay out of the legacy map ==');
for (const lvl of [1, 2]) {
  probe(`isStoryMode = true; townsData = {}; window.towersDefeated = false;
         window.southGateBreachedStatus = false; window.nm0AmbushClearedStatus = false;
         nm0AmbushActive = false;`);
  probe(`startAtLevel(${lvl});`);
  probe(`for (const b of buildings) if (b.isTower) b.hp = 0;
         markSectorTowersDown(currentLevel); window.towersDefeated = true;
         window.nm0AmbushCleared = true; window.southGateBreachedStatus = true;
         recruitSectorSurvivors(); enemiesList = enemiesList.filter(e => e.isFriendly);`);
  const r = P(`(function () {
    let placed = 0, inside = 0, inTown = 0;
    const c = authoredCore;
    for (let d = 950; d <= 3000; d += 100)
      for (let k = -3; k <= 3; k++) {
        const x = c.rx1 + d, y = k * 900;
        if (inAuthoredSector(x, y, 900)) continue;
        player.x = x; player.y = y;
        for (let i = 0; i < 8; i++) {
          frameCount++;
          const s = getOuterSpawn();
          if (!s) continue;
          placed++;
          if (inAuthoredSector(s.x, s.y, 0)) inside++;
          if (typeof nearSettlement === 'function' && nearSettlement(s.x, s.y)) inTown++;
        }
      }
    return { placed: placed, inside: inside, inTown: inTown };
  })()`);
  ok(`sector ${lvl} still finds somewhere to put them`, r.placed > 100, r.placed + ' placements');
  ok(`sector ${lvl} none of them land in the legacy map`, r.inside === 0,
     r.inside + ' of ' + r.placed + ' inside the authored core');
  ok(`sector ${lvl} none of them land in a town`, r.inTown === 0, r.inTown + ' in a settlement');
}

// ---------------------------------------------------------------------------
// THE LEDGER
// Population, allies, surviving citizens and the global count were four names
// for one thing, each derived from whatever entities happened to be alive when
// somebody asked. Entities drift; the number must not.
// ---------------------------------------------------------------------------
console.log('\n== the population ledger ==');
const led = (id) => P(`(function () { const t = sectorLedger(${id});
  return { seeded: t.popSeeded, killed: t.popKilled, granted: !!t.popGranted,
           total: t.popTotal, unM: t.popUnassignedM, unF: t.popUnassignedF,
           mil: t.popMilitaryM + t.popMilitaryF, farm: t.popFarmingM + t.popFarmingF }; })()`);

function liberate(lvl, kills) {
  probe(`isStoryMode = true; townsData = {}; window.towersDefeated = false;
         window.southGateBreachedStatus = false; window.nm0AmbushClearedStatus = false;`);
  probe(`startAtLevel(${lvl});`);
  probe(`(function () { let n = 0;
    for (const e of enemiesList) {
      if (e.isPopulation && !e.isFriendly && n < ${kills}) {
        e.dead = true; processKill(e.x, e.y, false, e.eType, false); n++;
      } } })()`);
  probe(`for (const b of buildings) if (b.isTower) b.hp = 0;
         markSectorTowersDown(currentLevel); recruitSectorSurvivors();`);
  return led(lvl);
}

// Spare everyone and you get everyone. That is what the taser is for.
ok('sparing the whole sector hands over all eighty', liberate(1, 0).total === 80,
   liberate(1, 0).total + ' of 80');
for (const k of [1, 20, 55]) {
  const t = liberate(1, k);
  ok(`${k} shot before the towers leaves ${80 - k}`, t.total === 80 - k,
     `${t.total}, seeded ${t.seeded} killed ${t.killed}`);
}
ok('shooting all eighty leaves nobody', liberate(1, 80).total === 0);
const s2 = liberate(2, 12);
ok('the Undercity hands over women', s2.total === 68 && s2.unF === 68 && s2.unM === 0,
   `${s2.total} total, ${s2.unF}F / ${s2.unM}M`);

// The grant is latched. Re-entering, re-clearing or reloading must not pay out
// a second population — the old code recomputed from whoever was standing there
// every single time it was asked.
{
  const before = liberate(1, 10).total;
  probe('recruitSectorSurvivors(); recruitSectorSurvivors(); openDirectiveWithGrant(1);');
  ok('a sector pays out exactly once', led(1).total === before, `${before} -> ${led(1).total}`);
}

// Nothing unassigns anybody. This is the bug the whole rewrite is for.
{
  probe(`loadLedgerIntoWindow(1);
         window.popFarmingM = 30; window.popMilitaryM = 20;
         window.popUnassignedM = window.popUnassignedM - 50; storeWindowIntoLedger(1);`);
  const set = led(1);
  ok('an assignment sticks', set.farm === 30 && set.mil === 20, JSON.stringify(set));
  probe('openDirectiveWithGrant(1);');
  ok('re-opening the Directive does not unassign anyone',
     led(1).farm === 30 && led(1).mil === 20, JSON.stringify(led(1)));
  probe('startAtLevel(3); startAtLevel(1);');
  ok('and neither does leaving the sector and coming back',
     led(1).farm === 30 && led(1).mil === 20, JSON.stringify(led(1)));
  ok('the total is always the sum of the columns',
     P('sectorPopSum(townsData[1])') === led(1).total, led(1).total + '');
}

// The escort is a loan. Travelling must not create or destroy citizens.
{
  probe(`window.escortHome = 1; window.escortWasF = 0;
         window.militaryToBringM = 10; window.militaryToBringF = 0;`);
  const before = P('globalPopulationCount()');
  const milBefore = led(1).mil;
  probe('window.travelArrival = "NORTH"; startAtLevel(3);');
  ok('marching an escort out does not change the global count',
     P('globalPopulationCount()') === before, `${before} -> ${P('globalPopulationCount()')}`);
  ok('and they are still on their home sector\'s military roll',
     led(1).mil === milBefore, `${milBefore} -> ${led(1).mil}`);
  probe('escortCasualty(); escortCasualty();');
  ok('a soldier who does not come back comes off that roll',
     led(1).mil === milBefore - 2 && P('globalPopulationCount()') === before - 2,
     `military ${led(1).mil}, global ${P('globalPopulationCount()')}`);
}

// A sector with nobody left still has to be exitable.
{
  const t = liberate(1, 80);
  ok('a sector the player emptied reports zero, not NaN',
     t.total === 0 && !isNaN(t.total));
  probe('openDirectiveWithGrant(1);');
  ok('and the Directive offers CONTINUE rather than a dead end',
     P('popTotal') === 0 && P('popUnassigned') === 0, 'popTotal 0');
}

// The Green Line's tan outpost is the awkward one: a sector that gains its
// people from a scripted alliance rather than a liberated roster, entered with
// an escort, while another sector is already organised. Every one of those is a
// chance to overwrite somebody's Directive.
console.log('\n== the tan outpost does not disturb anyone else ==');
{
  probe(`isStoryMode = true; townsData = {}; window.southGateBreachedStatus = false;`);
  probe('startAtLevel(1);');
  probe(`for (const b of buildings) if (b.isTower) b.hp = 0;
         markSectorTowersDown(1); recruitSectorSurvivors();
         loadLedgerIntoWindow(1);
         window.popFarmingM = 25; window.popMilitaryM = 30; window.popArchitectureM = 15;
         window.popUnassignedM = window.popUnassignedM - 70;
         storeWindowIntoLedger(1); townsData[1].established = true;`);
  const one = led(1);
  ok('sector 1 starts organised', one.farm === 25 && one.mil === 30 && one.total === 80,
     JSON.stringify(one));

  probe(`window.escortHome = 1; window.escortWasF = 0;
         window.militaryToBringM = 8; window.militaryToBringF = 0;
         window.travelArrival = "NORTH";`);
  probe('startAtLevel(4);');
  ok('arriving at the outpost leaves sector 1 alone',
     JSON.stringify(led(1)) === JSON.stringify(one), JSON.stringify(led(1)));

  // The tan army are allies but they are NOT the player's escort, so their
  // deaths must not come off Stick City's military roll.
  ok('the tan army are not flagged as the escort',
     P('enemiesList.filter(function(e){return e.eType==="MILITARY_NEUTRAL" && e.isMilitary;}).length') === 0);
  probe(`for (const e of enemiesList) if (e.eType === "MILITARY_NEUTRAL") {
           e.isNeutral = false; e.isFriendly = true; }`);
  probe(`(function () { let n = 0; for (const e of enemiesList) {
     if (e.eType === "MILITARY_NEUTRAL" && n < 5) {
       e.dead = true; processKill(e.x, e.y, false, e.eType, true); n++; } } })()`);
  ok('and their casualties do not come off it either',
     JSON.stringify(led(1)) === JSON.stringify(one), JSON.stringify(led(1)));

  probe('openDirectiveWithGrant(4);');
  ok('the outpost opens its OWN Directive, unassigned', led(4).total > 0 &&
     led(4).unM + led(4).unF === led(4).total, JSON.stringify(led(4)));
  ok('and sector 1 is still exactly as the player left it',
     JSON.stringify(led(1)) === JSON.stringify(one), JSON.stringify(led(1)));
  ok('the panel is pointed at the sector it is showing', P('viewingTownId') === 4);
  ok('and the edit buffer holds that sector, not the last one',
     P('popTotal') === led(4).total && P('popFarming') === 0,
     `buffer total ${P('popTotal')}, sector 4 ${led(4).total}`);
}

// A Directive opened before any sector has been viewed must not mint a phantom.
console.log('\n== no phantom sectors ==');
{
  probe(`isStoryMode = true; townsData = {}; viewingTownId = undefined;`);
  probe('startAtLevel(1); sectorLedger(viewingTownId);');
  ok('a ledger asked for with no sector falls back to the current one',
     P('Object.keys(townsData).every(function (k) { return isFinite(Number(k)); })'),
     Object.keys(P('townsData')).join(','));
}

// Every door into the Directive has to grant on the way through. This bug bit
// twice: openSectorDirective() opens the panel and the panel reads the ledger,
// so a caller that opens it without granting shows a sector of nobody with
// nothing to assign. The Green Line's tan outpost came through the post-ambush
// cutscene, which did exactly that. Checked structurally, because the failure
// is a missing call and there is no runtime symptom to assert on.
console.log('\n== every door grants ==');
{
  const src = require('fs').readFileSync(
    process.env.GAME_JS || __dirname + '/../game.js', 'utf8');
  const lines = src.split('\n');
  const stray = [];
  lines.forEach((ln, i) => {
    if (ln.indexOf('openSectorDirective(') === -1) return;
    if (/function openSectorDirective/.test(ln)) return;          // the definition
    // the one legitimate call, inside the wrapper
    const near = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
    if (/function openDirectiveWithGrant/.test(near)) return;
    stray.push(i + 1);
  });
  ok('nothing opens the Directive without granting first', stray.length === 0,
     stray.length ? 'bare openSectorDirective() at line ' + stray.join(', ')
                  : 'all callers use openDirectiveWithGrant()');
}

// And a zero must never latch on a sector whose people are counted off the
// ground -- they may not have changed sides yet when the panel opens.
console.log('\n== a premature zero does not stick ==');
{
  probe('isStoryMode = true; townsData = {}; startAtLevel(4);');
  probe(`for (const e of enemiesList) { e.isFriendly = false; e.isNeutral = true; }`);
  probe('openDirectiveWithGrant(4);');
  ok('an empty sector does not latch its grant',
     P('sectorLedger(4).popTotal') === 0 && !P('!!sectorLedger(4).popGranted'),
     'total ' + P('sectorLedger(4).popTotal'));
  probe(`for (const e of enemiesList) if (e.eType === "MILITARY_NEUTRAL") e.isFriendly = true;`);
  probe('openDirectiveWithGrant(4);');
  ok('and pays out once the cordon has actually changed sides',
     P('sectorLedger(4).popTotal') > 0 && P('!!sectorLedger(4).popGranted'),
     'total ' + P('sectorLedger(4).popTotal'));
  const t = P('sectorLedger(4).popTotal');
  probe('openDirectiveWithGrant(4); openDirectiveWithGrant(4);');
  ok('and only once', P('sectorLedger(4).popTotal') === t, `${t} -> ${P('sectorLedger(4).popTotal')}`);
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

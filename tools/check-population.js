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

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

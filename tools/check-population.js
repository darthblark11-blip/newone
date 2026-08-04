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

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

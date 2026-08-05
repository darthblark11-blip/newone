// Issue 1: the level 2 tower cutscene must leave the player on the story's own
// ground, with the muster reachable.
const { ctx, probe } = require('./harness.js');
const P = (s) => probe('(' + s + ')');
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  ' + x : '')); if (!c) fails++; };
let seed = 1234;
ctx.random = function (a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  if (b === undefined) return r * a;
  return a + r * (b - a);
};

for (const lvl of [1, 2]) {
  console.log(`\n== level ${lvl} tower cutscene ==`);
  probe(`isStoryMode = true; townsData = {}; window.storyBeats = {};
         window.southGateBreachedStatus = false; window.nm0AmbushClearedStatus = false;`);
  probe(`startAtLevel(${lvl});`);
  // Recruit the roster the way towers-down does, then plant a garrison outside
  // the walls — the exact thing that used to be picked as the speaker.
  probe('recruitSectorSurvivors();');
  probe(`enemiesList.push(Object.assign(
           new Character(600, ${lvl === 1 ? 6400 : 4200}, false, "FEMALE_PISTOL"),
           { isFriendly: false }));`);
  const outside = P(`insideSector(600, ${lvl === 1 ? 6400 : 4200})`);
  ok('the planted garrison really is outside the sector', outside === false);

  // Run the branch that picks the speakers, then the teleport.
  probe(`(() => {
      let candidates = enemiesList.filter(e =>
          e && e.hp > 0 && !e.dead && (e.isPopulation || e.isRecruit) && insideSector(e.x, e.y, 200));
      candidates.sort((a, b) => dist(player.x, player.y, a.x, a.y) - dist(player.x, player.y, b.x, b.y));
      townSpeaker1 = candidates.length > 0 ? candidates[0] : player;
      townSpeaker2 = candidates.length > 1 ? candidates[1] : townSpeaker1;
  })()`);
  ok('the speaker is inside the sector', P('insideSector(townSpeaker1.x, townSpeaker1.y, 200)') === true,
     `(${P('townSpeaker1.x|0')}, ${P('townSpeaker1.y|0')})`);

  probe(`(() => {
      const ang = Math.atan2(player.y - townSpeaker1.y, player.x - townSpeaker1.x);
      const t = clampToSector(townSpeaker1.x + Math.cos(ang) * 70, townSpeaker1.y + Math.sin(ang) * 70);
      player.x = t.x; player.y = t.y; player.forceNudge();
  })()`);
  ok('the player lands inside the sector', P('insideSector(player.x, player.y, 100)') === true,
     `(${P('player.x|0')}, ${P('player.y|0')})`);
  probe('activeBuildings = buildings;');
  ok('and is not stuck in geometry', P('player.checkCol(player.x, player.y)') === false);

  // The muster spawns at fixed coordinates; the player has to be able to get there.
  const musterY = lvl === 1 ? 4950 : 1800;
  // Pad 0: the muster masses right against the gate's inner face on purpose,
  // which is inside the sector but inside the spawn margin too.
  ok('the muster spawns on the same side of the gate as the player',
     P(`insideSector(600, ${musterY}, 0)`) === true, 'muster y ' + musterY);
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

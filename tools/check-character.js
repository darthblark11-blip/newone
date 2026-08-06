// The character rig: where the arms sit relative to the torso, and whether a
// hand is ever simply missing.
//
// Both bugs this guards against were the same mistake in opposite directions.
// Drawing every arm ON TOP of the torso leaves two whole sleeve ellipses parked
// on the shoulders with nothing to sink them into the body — the bulge. Hiding
// a hand between a front and a back threshold to compensate deletes it outright
// twice a stride, and at rest (swing is exactly 0 standing still) deletes both.
// The fix is the one Citizen.show() has always used: limbs and the trailing
// hand under the torso, the leading hand over it. Occlusion, not omission.
//
// Asserted by watching the order of ellipse() calls: a hand is 8x8, the torso
// is bodyW x bodyH. Where the hands fall in that sequence is the rig.
const { ctx, probe } = require('./harness.js');
const P = (s) => probe('(' + s + ')');
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  ' + x : '')); if (!c) fails++; };

let seed = 777;
ctx.random = function (a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  if (b === undefined) return r * a;
  return a + r * (b - a);
};

probe(`isStoryMode = false; townsData = {}; startAtLevel(2); started = true; doTick = true;
       viewLeft = -1e6; viewRight = 1e6; viewTop = -1e6; viewBottom = 1e6;
       leftStick = { active: false, dx: 0, dy: 0, base: { x: 0, y: 0 } };
       rightStick = { active: false, dx: 0, dy: 0, dist: 0, base: { x: 0, y: 0 } };`);

const BODY_W = P('player.bodyW'), BODY_H = P('player.bodyH');

// Record every ellipse, in order, while one character draws itself.
function trace(setup, target) {
  const real = ctx.ellipse;
  const seq = [];
  ctx.ellipse = (x, y, w, h) => { seq.push([w, h]); };
  probe(setup);
  probe(target + '.show();');
  ctx.ellipse = real;
  const torso = seq.findIndex((e) => e[0] === BODY_W && e[1] === BODY_H);
  const hands = [];
  seq.forEach((e, i) => { if (e[0] === 8 && e[1] === 8) hands.push(i); });
  return {
    torso,
    behind: hands.filter((i) => i < torso).length,
    infront: hands.filter((i) => i > torso).length,
    total: hands.length
  };
}

console.log('== the player, empty-handed ==');
probe(`player.isArmed = false; player.meleeTimer = 0; player.meleePhase = 0;
       player.isNeutral = false; swordPickedUp = false; setMeleeTool("NONE");`);
{
  const idle = trace('player.isMoving = false; player.walkCycle = 0;', 'player');
  ok('standing still, both hands are drawn', idle.total === 2, JSON.stringify(idle));
  ok('and both sit behind the body, not on the shoulders',
     idle.behind === 2 && idle.infront === 0, `${idle.behind} behind / ${idle.infront} in front`);

  // A full stride. At the extremes one arm leads and one trails, which is the
  // whole read of a walk; nowhere in the cycle may a hand simply not exist.
  let missing = null, everSplit = false;
  for (let i = 0; i < 16; i++) {
    const ph = (i * Math.PI) / 8;
    const r = trace(`player.isMoving = true; player.walkCycle = ${ph};`, 'player');
    if (r.total !== 2) missing = { at: i, r };
    if (r.behind === 1 && r.infront === 1) everSplit = true;
  }
  ok('no point of the stride loses a hand', missing === null,
     missing ? JSON.stringify(missing) : '16/16 frames have both');
  ok('and the trailing arm passes behind the body', everSplit);
}

console.log('\n== the player, holding a melee tool ==');
for (const tool of ['SWORD', 'PICKAXE']) {
  probe(`swordPickedUp = true; window.pickaxeOwned = true; setMeleeTool("${tool}");`);
  let worst = null;
  for (let i = 0; i < 16; i++) {
    const ph = (i * Math.PI) / 8;
    const r = trace(`player.isMoving = true; player.walkCycle = ${ph};`, 'player');
    // The tool hand always rides in front — half a pickaxe swallowed by a
    // torso is worse than one drawn a layer too high.
    if (r.infront < 1 || r.total !== 2) worst = { at: i, r };
  }
  ok(`${tool}: the tool hand stays in front through the stride`, worst === null,
     worst ? JSON.stringify(worst) : '16/16 frames');
}

console.log('\n== townsfolk ==');
{
  probe(`enemiesList.length = 0;
         window.__t = new Character(player.x + 200, player.y, false, "VILLAGER_MALE");
         window.__t.isNeutral = true; window.__t.isArmed = false; window.__t.walkCycle = 0;`);
  const idle = trace('window.__t.isMoving = false;', 'window.__t');
  ok('a neutral villager stands with both hands behind the body',
     idle.behind === 2 && idle.infront === 0, JSON.stringify(idle));
  const mid = trace('window.__t.isMoving = true; window.__t.walkCycle = 1.5708;', 'window.__t');
  ok('and splits front to back once walking',
     mid.behind === 1 && mid.infront === 1, JSON.stringify(mid));
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

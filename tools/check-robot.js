// A robot is a machine, and every death site in game.js used to hand it the
// human gore table — red mist, bone, a torso and two arms it does not have.
// This walks each of the six ways one can die and asserts the same three
// things: no meat, a robot corpse that is not gibbed, and a secondary
// detonation. Plus the melee case, which is the only one that throws the body
// before it goes off.
const { ctx, probe } = require('./harness.js');
const P = (s) => probe('(' + s + ')');
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  ' + x : '')); if (!c) fails++; };

let seed = 4242;
ctx.random = function (a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  if (b === undefined) return r * a;
  return a + r * (b - a);
};

// Catch the deferred detonation rather than letting it fire on a real timer:
// robotDeathBurst() schedules it because its callers are all standing inside a
// loop over enemiesList that triggerExplosion splices out of.
const realTimeout = ctx.setTimeout;
let fuses = [];
// spawnSingleEnemy is scheduled by every kill path and is not our business —
// the charge is the anonymous arrow robotDeathBurst() arms.
ctx.setTimeout = (fn, ms) => { if (!fn.name) fuses.push({ fn, ms }); return 0; };

probe(`isStoryMode = false; townsData = {}; startAtLevel(2); started = true; doTick = true;
       viewLeft = -1e6; viewRight = 1e6; viewTop = -1e6; viewBottom = 1e6;
       leftStick = { active: false, dx: 0, dy: 0, base: { x: 0, y: 0 } };
       rightStick = { active: false, dx: 0, dy: 0, dist: 0, base: { x: 0, y: 0 } };`);

const MEAT = ['GORE', 'BLOOD', 'BONE'];

// One robot, standing `d` units in front of the player, with everything else
// cleared away so the readings are only about this kill.
function plant(d) {
  probe(`enemiesList.length = 0; corpses.length = 0; particles.length = 0;
         window.__r = new Character(player.x + ${d}, player.y, false, "ROBOT");
         window.__r.isFriendly = false; enemiesList.push(window.__r);`);
  fuses = [];
  return { x: P('window.__r.x'), y: P('window.__r.y') };
}

function reading() {
  const types = P('particles.map(p => p.t)');
  return {
    meat: types.filter((t) => MEAT.indexOf(t) !== -1).length,
    metal: types.filter((t) => ['FLECK', 'CHIP', 'OIL', 'SMOKE'].indexOf(t) !== -1).length,
    corpses: P('corpses.map(c => ({ eT: c.eT, dT: c.dT, gib: !c.isIntactBody }))'),
    gone: P('enemiesList.indexOf(window.__r)') === -1 || P('window.__r.dead') === true,
    x: P('window.__r.x'), y: P('window.__r.y')
  };
}

function assertMachineDeath(label, r) {
  ok(label + ': no blood, no bone, no meat', r.meat === 0, r.meat + ' gore particles');
  ok(label + ': throws sparks, oil and swarf', r.metal >= 40, r.metal + ' machine particles');
  const rc = r.corpses.filter((c) => c.eT === 'ROBOT');
  ok(label + ': leaves a robot chassis', rc.length === 1, JSON.stringify(r.corpses));
  ok(label + ': and is never gibbed', rc.length === 1 && !rc[0].gib,
     rc.length ? 'dT ' + rc[0].dT : '');
  ok(label + ': the cell lets go', fuses.length === 1, fuses.length + ' charges armed');
}

console.log('== grenade ==');
{
  const at = plant(90);
  probe(`triggerExplosion(player.x + 40, player.y, 200, false, true);`);
  const r = reading();
  assertMachineDeath('grenade', r);
  ok('grenade: it goes off where it stood',
     Math.hypot(r.x - at.x, r.y - at.y) < 1, Math.round(Math.hypot(r.x - at.x, r.y - at.y)) + ' units moved');
}

console.log('\n== rocket ==');
{
  plant(90);
  probe(`triggerRocketExplosion(player.x + 60, player.y, true, window.__r);`);
  assertMachineDeath('rocket', reading());
}

console.log('\n== the chemist cannon arc ==');
{
  plant(70);
  // The tesla chain fires on release, so charge it and let go inside one
  // updatePlayer(). chemistSuitUnlocked and cannonInputHeld are top-level lets,
  // not window properties — they have to be assigned in the context's scope.
  probe(`window.__r.hp = 1; chemistSuitUnlocked = true; cannonInputHeld = false;
         player.aimAngle = 0; player.meleeTimer = 0; player.dashTimer = 0;
         player.cannonAmmo = 3; player.cannonCooldown = 0; player.cannonFireDelay = 0;
         player.cannonCharge = 130;
         player.updatePlayer();
         chemistSuitUnlocked = false;`);
  assertMachineDeath('lightning', reading());
}

console.log('\n== the finisher shockwave ==');
{
  plant(70);
  probe(`window.__r.hp = 1; shockwaves.length = 0;
         shockwaves.push(new Shockwave(player.x, player.y, 0));
         for (let f = 0; f < 6; f++) shockwaves[0].update();`);
  assertMachineDeath('shockwave', reading());
}

console.log('\n== the dash blast ==');
{
  plant(70);
  probe(`window.__r.hp = 1; jetpackFireExplosion = true;
         player.dashTimer = 1; player.lastMoveAngle = 0; player.meleeTimer = 0;
         player.updatePlayer();
         jetpackFireExplosion = false; player.dashTimer = 0;`);
  assertMachineDeath('dash blast', reading());
}

console.log('\n== melee ==');
{
  const at = plant(50);
  probe(`player.aimAngle = 0; player.meleeTimer = 10; player.meleePhase = 1;
         player.isBackhand = false; player.isArmed = false;
         swordPickedUp = true; window.pickaxeOwned = true; setMeleeTool("SWORD");
         window.__r.hp = 1;
         player.meleeTimer = 11;   // updatePlayer decrements before the swing lands
         player.updatePlayer();`);
  const r = reading();
  assertMachineDeath('melee', r);
  const flung = Math.hypot(r.x - at.x, r.y - at.y);
  ok('melee: the body is thrown 5 m along the swing', flung >= 80 && flung <= 110,
     Math.round(flung) + ' units (ROBOT_MELEE_KB = ' + P('ROBOT_MELEE_KB') + ')');
  ok('melee: and away from the player, not through them',
     r.x > at.x, `x ${Math.round(at.x)} -> ${Math.round(r.x)}`);
  // The whole point of the knockback: the charge lands among whatever it was
  // driven into, and the swinger is outside their own blast.
  const toPlayer = Math.abs(r.x - P('player.x'));
  ok('melee: the blast clears whoever swung',
     toPlayer > P('ROBOT_BLAST_R'),
     Math.round(toPlayer) + ' units out, blast radius ' + P('ROBOT_BLAST_R'));
}

console.log('\n== the blast is the player\'s ==');
{
  // Fire the armed charge for real and check it hurts a bystanding hostile —
  // that is what "considered a player explosion" has to mean.
  plant(50);
  probe(`window.__v = new Character(window.__r.x + 40, window.__r.y, false, "NORMAL");
         window.__v.isFriendly = false; enemiesList.push(window.__v);`);
  const hp0 = P('window.__v.hp');
  probe(`window.__r.hp = 0; window.__r.dead = true; robotDeathBurst(window.__r, 0, true);`);
  ok('a charge is armed', fuses.length === 1);
  fuses.forEach((f) => f.fn());
  const alive = P('enemiesList.indexOf(window.__v)') > -1;
  ok('and it kills what the robot was knocked into',
     !alive || P('window.__v.hp') < hp0, alive ? 'hp ' + P('window.__v.hp') + ' of ' + hp0 : 'removed');
}

console.log('\n== the overkill table cannot reach it ==');
{
  // Belt and braces on the six branches: even asked directly for a gib death,
  // a robot corpse comes back intact.
  let worst = null;
  for (const dT of P('CORPSE_GIB_DEATHS')) {
    ctx.__dT = dT;
    const gib = P(`(function () {
      const c = new Corpse(0, 0, 0, 0, color(1), color(1), window.__dT, 0, [], null, 0, "ROBOT", 30, 34);
      return { dT: c.dT, gib: !c.isIntactBody, bits: c.bits.length, over: !!c.overkillBits };
    })()`);
    if (gib.gib || gib.bits || gib.over) worst = { asked: dT, got: gib };
  }
  ok('no gib death survives on a robot', worst === null, worst ? JSON.stringify(worst) : 'all 13 coerced');
  // …and the same request on a person still gibs, so the guard is not global.
  const human = P(`(function () {
    const c = new Corpse(0, 0, 0, 0, color(1), color(1), 10, 0, [], null, 0, "NORMAL", 30, 34);
    return { gib: !c.isIntactBody, over: !!c.overkillBits };
  })()`);
  ok('a person still comes apart', human.gib && human.over, JSON.stringify(human));
}

ctx.setTimeout = realTimeout;
console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

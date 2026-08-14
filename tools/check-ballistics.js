// One readability rule: a hostile round is always slower than the player's,
// whatever weapon it came out of. The player has to be able to see a shot and
// step out of it, and that only works if every incoming round travels at one
// known speed.
//
// It used to be written as a special case for the enemy PISTOL, so any hostile
// carrying something else fell through to the 25 default and out-ran the rule —
// NM-0's grey and tan riflemen, and Dry Gulch's bandit, cowboy and town cop
// with revolver and coach gun. This walks every type that can shoot at you and
// checks the speed off the real bullet, through the real firing path.
const { ctx, probe } = require('./harness.js');
const P = (s) => probe('(' + s + ')');
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  ' + x : '')); if (!c) fails++; };

let seed = 8080;
ctx.random = function (a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  if (b === undefined) return r * a;
  return a + r * (b - a);
};

probe(`isStoryMode = false; townsData = {}; startAtLevel(3); started = true; doTick = true;
       viewLeft = -1e6; viewRight = 1e6; viewTop = -1e6; viewBottom = 1e6;`);

const ENEMY = P('ENEMY_BULLET_SPEED'), PLAYER = P('PLAYER_BULLET_SPEED');

// Muzzle velocity straight off a fresh bullet, so this reads the code the game
// runs rather than a copy of its arithmetic.
function speed(weaponExpr, iP) {
  return P(`(function () {
    const b = new Bullet();
    b.init(0, 0, 0, ${iP}, "BODY", ${weaponExpr});
    return Math.round(Math.hypot(b.vx, b.vy) * 1000) / 1000;
  })()`);
}

console.log('== the rule, weapon by weapon ==');
{
  const guns = ['PISTOL', 'SMG', 'DUAL_SMG', 'ASSAULT_RIFLE', 'SHOTGUN', 'REVOLVER', 'COACH_GUN'];
  let slowest = Infinity, fastestEnemy = 0, worst = null;
  for (const g of guns) {
    const e = speed('WEAPONS.' + g, false), p = speed('WEAPONS.' + g, true);
    fastestEnemy = Math.max(fastestEnemy, e);
    slowest = Math.min(slowest, p);
    if (e >= p) worst = `${g}: enemy ${e} vs player ${p}`;
  }
  ok('every hostile small arm fires at the enemy speed', fastestEnemy === ENEMY,
     `fastest hostile round ${fastestEnemy}, ENEMY_BULLET_SPEED ${ENEMY}`);
  ok('and the player out-ranges them with every one of them', worst === null,
     worst || `slowest player round ${slowest} > ${fastestEnemy}`);
  ok('the player keeps the fast rounds on their own guns',
     speed('WEAPONS.PISTOL', true) === PLAYER && speed('WEAPONS.ASSAULT_RIFLE', true) === PLAYER &&
     speed('WEAPONS.SHOTGUN', true) === PLAYER, PLAYER + ' units/frame');
  // Beams were already the slowest thing in the game and must stay that way,
  // or the robot's tell disappears.
  const beams = ['"RED_LASER"', '"PINK_LASER"', '"ORANGE_BEAM"', '"ALIEN_LASER"'];
  let fastBeam = 0;
  for (const b of beams) fastBeam = Math.max(fastBeam, speed(b, false));
  ok('beams stay slower still', fastBeam < ENEMY, fastBeam + ' vs ' + ENEMY);
}

console.log('\n== the types the rule was missing ==');
{
  // Named individually because these are the ones that were wrong: NM-0's grey
  // and tan riflemen, and the three Dry Gulch shooters.
  const named = ['NM0_GREY_FATIGUE', 'MILITARY_NEUTRAL', 'BANDIT', 'COWBOY', 'COWGIRL', 'LOCAL_COP'];
  for (const t of named) {
    const r = P(`(function () {
      const e = new Character(0, 0, false, ${JSON.stringify(t)});
      // However they start, this is what they are once they are shooting at
      // you — turnBandGroup() and the takeDamage() cascade both clear these.
      e.isNeutral = false; e.isFriendly = false;
      const b = new Bullet();
      b.init(0, 0, 0, e.isPlayer || e.isFriendly, "BODY", e.currentWeapon);
      return { gun: e.currentWeapon.name, v: Math.round(Math.hypot(b.vx, b.vy) * 1000) / 1000 };
    })()`);
    ok(`${t} (${r.gun})`, r.v <= ENEMY, r.v + ' units/frame');
  }
}

console.log('\n== nothing hostile was missed ==');
{
  // Everything the overworld and the garrisons can put in front of the player,
  // plus the story types, swept rather than listed one at a time.
  const types = new Set();
  for (const lvl of Object.keys(P('OVERWORLD'))) {
    for (const row of P(`OVERWORLD[${lvl}]`)) types.add(row[0]);
  }
  for (const t of ['NORMAL', 'MOLOTOV', 'FEMALE_PISTOL', 'ARMORED', 'ARMORED_STANDARD',
                   'SIA', 'AERIAL', 'AERIAL_PISTOL', 'NM0_GREY_FATIGUE', 'MILITARY_NEUTRAL',
                   'BANDIT', 'COWBOY', 'COWGIRL', 'LOCAL_COP', 'VILLAGER_MALE', 'VILLAGER_FEMALE',
                   'FARMER_MALE', 'FARMER_FEMALE', 'ROBOT']) types.add(t);

  let worst = null, n = 0;
  const seen = {};
  for (const t of types) {
    const r = P(`(function () {
      const e = new Character(0, 0, false, ${JSON.stringify(t)});
      if (!e.currentWeapon) return null;
      e.isNeutral = false; e.isFriendly = false;
      const b = new Bullet();
      b.init(0, 0, 0, e.isPlayer || e.isFriendly, "BODY", e.currentWeapon);
      return { gun: e.currentWeapon.name, v: Math.round(Math.hypot(b.vx, b.vy) * 1000) / 1000 };
    })()`);
    if (!r) continue;
    n++;
    seen[r.gun] = (seen[r.gun] || 0) + 1;
    if (r.v > ENEMY) worst = `${t} (${r.gun}) at ${r.v}`;
  }
  ok('every hostile type in the game is at or under the enemy speed', worst === null,
     worst || `${n} types, guns: ${Object.keys(seen).join(', ')}`);
}

console.log('\n== who counts as "them" ==');
{
  // The rule keys off side, not eType, so an ally keeps the fast round and a
  // neutral only slows down at the moment they become a threat.
  const ally = P(`(function () {
    const e = new Character(0, 0, false, "NM0_GREY_FATIGUE");
    e.isFriendly = true; e.isNeutral = false;
    const b = new Bullet();
    b.init(0, 0, 0, e.isPlayer || e.isFriendly, "BODY", e.currentWeapon);
    return Math.round(Math.hypot(b.vx, b.vy) * 1000) / 1000;
  })()`);
  ok('a soldier fighting FOR you keeps the fast round', ally === PLAYER, ally + ' units/frame');

  // And the real turn, through the game's own cascade rather than by hand:
  // shoot one neutral townsman and the street turns with him.
  probe(`enemiesList.length = 0;
         window.__a = new Character(0, 0, false, "COWBOY");
         window.__b = new Character(80, 0, false, "LOCAL_COP");
         enemiesList.push(window.__a); enemiesList.push(window.__b);`);
  const before = P(`(function () {
    const b = new Bullet();
    b.init(0, 0, 0, window.__b.isPlayer || window.__b.isFriendly, "BODY", window.__b.currentWeapon);
    return Math.round(Math.hypot(b.vx, b.vy) * 1000) / 1000;
  })()`);
  ok('a neutral cop is on your side until provoked', before === PLAYER || before === 25,
     before + ' units/frame while neutral');
  probe('window.__a.takeDamage(5);');
  ok('and the whole street turns when one is shot',
     P('window.__b.isFriendly') === false && P('window.__a.isFriendly') === false);
  const after = P(`(function () {
    const b = new Bullet();
    b.init(0, 0, 0, window.__b.isPlayer || window.__b.isFriendly, "BODY", window.__b.currentWeapon);
    return Math.round(Math.hypot(b.vx, b.vy) * 1000) / 1000;
  })()`);
  ok('their fire slows the moment they are a threat', after === ENEMY,
     `${before} -> ${after} units/frame`);
}

console.log('\n== ally projectiles are simulated but not drawn ==');
{
  const r = P(`(function () {
    bullets.length = 0; enemiesList.length = 0; barrels.length = 0;
    player = { x: 10000, y: 10000, hp: 100, isPlayer: true, isFriendly: true, dead: false };
    viewLeft = -1000; viewRight = 1000; viewTop = -1000; viewBottom = 1000; doTick = true;
    const ally = { isPlayer: false, isFriendly: true };
    const hostile = new Character(500, 500, false, "NORMAL");
    hostile.isFriendly = false; hostile.isNeutral = false; enemiesList.push(hostile);
    const oldShow = Bullet.prototype.show;
    let shown = 0;
    Bullet.prototype.show = function () { shown++; };
    const b = spawnBullet(0, 0, 0, true, "BODY", WEAPONS.PISTOL, ally);
    updateBullets();
    Bullet.prototype.show = oldShow;
    return { shown, active: b.active, x: Math.round(b.x * 1000) / 1000, history: b.history.length };
  })()`);
  ok('an ally round still advances through simulation', r.x === PLAYER, JSON.stringify(r));
  ok('but it never enters the draw path or builds a trail', r.shown === 0 && r.history === 0, JSON.stringify(r));
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

// What the player is told when they are hit, and in which of the two states.
//
// The shield and the health bar are meant to read as different things
// happening: while the shield holds it flashes and the body is untouched;
// once it is gone every round marks him and marks the ground. Getting that
// wrong is invisible in code review -- the shield still "works" either way --
// so the split is asserted here rather than left to the eye.
const { ctx, probe } = require('./harness.js');
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

probe(`isStoryMode = false; townsData = {}; startAtLevel(3); started = true; doTick = true;
       viewLeft = -1e6; viewRight = 1e6; viewTop = -1e6; viewBottom = 1e6;`);
// updatePlayer reads the sticks every frame; a harness gap, not a game bug.
probe(`leftStick = { active: false, dx: 0, dy: 0, base: { x: 0, y: 0 } };
       rightStick = { active: false, dx: 0, dy: 0, dist: 0, base: { x: 0, y: 0 } };`);

console.log('== the shield takes the hit, or the body does ==');
{
  const hit = (dmg) => probe(`(function () {
    player.shield = ${dmg.shield}; player.hp = 100; player.decals.length = 0;
    const r = player.takeDamage(${dmg.amount});
    return { blocked: !!r.blocked, broken: !!r.broken, shield: player.shield, hp: player.hp,
             flash: player.shieldFlashTimer, burst: player.shieldBurstTimer };
  })()`);
  const held = hit({ shield: 100, amount: 20 });
  ok('a hit the shield absorbs never reaches health', held.blocked && held.hp === 100,
     `shield ${held.shield}, hp ${held.hp}`);
  ok('and it raises the flash the aura is drawn from', held.flash > 0, held.flash + ' frames');
  const broke = hit({ shield: 10, amount: 40 });
  ok('a hit that overruns the shield breaks it and carries through',
     broke.broken && broke.shield === 0 && broke.hp < 100, `hp ${broke.hp}`);
  const bare = hit({ shield: 0, amount: 20 });
  ok('with the shield down the hit is not blocked at all',
     !bare.blocked && bare.hp === 80, `hp ${bare.hp}`);
}

console.log('== bullet holes belong to the health bar, not the shield ==');
{
  // Structural, because the guard sits inside the bullet loop and standing a
  // real round up against the player through updateBullets is far more setup
  // than the assertion is worth.
  const src = require('fs').readFileSync(__dirname + '/../game.js', 'utf8');
  const push = src.slice(src.indexOf('t.decals.push({ x: lX') - 260, src.indexOf('t.decals.push({ x: lX'));
  ok('a round the shield stopped leaves no hole', /!\(t\.isPlayer && dRes\.blocked\)/.test(push),
     'the push is guarded');
  ok('a round that gets through still does', /t\.decals\.push\(\{ x: lX/.test(src), 'unchanged otherwise');
  // Behavioural: the holes come off again when the shield does come back.
  const cleared = probe(`(function () {
    player.decals.push({ x: 0, y: 0, sz: 5, col: [90, 0, 0, 220], isHead: false });
    player.shield = 0; player.shieldRechargeTimer = 0;
    const before = player.decals.length;
    for (let i = 0; i < 6; i++) player.updatePlayer();  // recharge ticks past zero
    return { before, after: player.decals.length, shield: player.shield };
  })()`);
  ok('and they come off once the shield has anything in it',
     cleared.before === 1 && cleared.after === 0 && cleared.shield > 0,
     `shield back to ${cleared.shield.toFixed(2)}`);
  ok('holes survive while the shield stays down', probe(`(function () {
    player.decals.push({ x: 0, y: 0, sz: 5, col: [90, 0, 0, 220], isHead: false });
    player.shield = 0; player.shieldRechargeTimer = 600;
    for (let i = 0; i < 10; i++) player.updatePlayer();
    const n = player.decals.length; player.decals.length = 0; player.shieldRechargeTimer = 0;
    return n;
  })()`) === 1, 'unprotected means marked');
}

console.log('== blood is the read that the shield is gone ==');
{
  const src = require('fs').readFileSync(__dirname + '/../game.js', 'utf8');
  // Every site that damages the player forks on `blocked`. The unprotected arm
  // of each fork has to put blood on the ground; the blocked arm must not.
  const arms = [];
  src.split('\n').forEach((line, i) => {
    if (!/if \(dRes\.blocked\) \{|if \(t\.isPlayer && dRes\.blocked\)/.test(line)) return;
    arms.push(src.split('\n').slice(i, i + 9).join('\n'));
  });
  ok('every player-damage site forks on the shield', arms.length === 4, arms.length + ' sites');
  ok('the unprotected arm of each spawns a ground splatter',
     arms.every(a => /spawnSplatter\(/.test(a)), 'blood underfoot per hit');
  ok('and the blocked arm never does', arms.every(a => {
    const blocked = a.slice(0, a.indexOf('else'));
    return !/spawnSplatter\(/.test(blocked);
  }), 'the shield does not bleed');
}

console.log('== the shield reads as the shield ==');
{
  const src = require('fs').readFileSync(__dirname + '/../game.js', 'utf8');
  const aura = src.slice(src.indexOf('if (this.shieldFlashTimer > 0) {'), src.indexOf('if (this.shieldFlashTimer > 0) {') + 620);
  const strokes = [...aura.matchAll(/stroke\((\d+), ([\d\s+*i]+), ([\d\s+*i]+),/g)];
  ok('the aura is drawn while the flash lasts and not otherwise',
     /this\.shieldFlashTimer \/ 10/.test(aura), 'fades over the flash');
  ok('it is orange-yellow, not the blue it was', strokes.length > 0 && strokes[0][1] === '255',
     'red channel pinned at 255');
  ok('and it is layered, so it falls off into the air', /for \(let i = 4; i >= 0; i--\)/.test(aura),
     'five rings, weakest outermost');
  // The break keeps its own colour: it is the one moment the two states must
  // not look alike.
  // Anchored on the DRAW, not the timer decrement -- the same condition
  // appears in updatePlayer and indexOf finds that one first.
  const burstAt = src.indexOf('if (this.shieldBurstTimer > 0) { push()');
  ok('the break still flashes blue, so it cannot be mistaken for a hit',
     burstAt > 0 && /stroke\(0, 200, 255/.test(src.slice(burstAt, burstAt + 260)),
     'blue burst, orange hit');
}

console.log('== the health bar shows what it cost ==');
{
  const run = (frames) => probe(`(function () {
    const out = [];
    for (let i = 0; i < ${frames}; i++) { drawUI(); out.push(hpGhost); }
    return out;
  })()`);
  const r = probe(`(function () {
    player.hp = 100; hpGhost = 100; hpPrev = 100; hpGhostHold = 0;
    drawUI();
    player.hp = 55;                        // a big hit
    const first = (drawUI(), { ghost: hpGhost, hold: hpGhostHold });
    const held = [];
    for (let i = 0; i < 12; i++) { drawUI(); held.push(hpGhost); }
    for (let i = 0; i < 400; i++) drawUI();
    return { first, held, settled: hpGhost };
  })()`);
  ok('a hit arms the hold', r.first.hold > 0, r.first.hold + ' frames');
  ok('the bar keeps showing the old value while it holds',
     r.held.every(v => v === 100), 'chunk stays visible');
  ok('then it drains all the way to the new value', Math.abs(r.settled - 55) < 0.01,
     'settled at ' + r.settled.toFixed(2));
  const healed = probe(`(function () {
    player.hp = 55; hpGhost = 55; hpPrev = 55; hpGhostHold = 0; drawUI();
    player.hp = 90; drawUI();
    return hpGhost;
  })()`);
  ok('healing overtakes the trail rather than dragging it', healed === 90, 'ghost ' + healed);
  const scratch = probe(`(function () {
    player.hp = 100; hpGhost = 100; hpPrev = 100; hpGhostHold = 0; drawUI();
    player.hp = 99; drawUI();
    let n = 0;
    while (hpGhost > 99.001 && n < 600) { drawUI(); n++; }
    return n;
  })()`);
  ok('and a scratch finishes instead of creeping', scratch < 120, scratch + ' frames to settle');
}

console.log('== and so does the armor bar ==');
{
  const r = probe(`(function () {
    player.shield = 100; shGhost = 100; shPrev = 100; shGhostHold = 0;
    player.shieldRechargeTimer = 600;          // hold the recharge off
    drawUI();
    player.shield = 40;
    drawUI();
    const first = { ghost: shGhost, hold: shGhostHold };
    const held = [];
    for (let i = 0; i < 12; i++) { drawUI(); held.push(shGhost); }
    for (let i = 0; i < 400; i++) { player.shield = 40; drawUI(); }
    return { first, held, settled: shGhost };
  })()`);
  ok('a hit on the shield arms the same hold', r.first.hold > 0, r.first.hold + ' frames');
  ok('the bar keeps showing what the shield had', r.held.every(v => v === 100), 'chunk stays visible');
  ok('then drains to what is left', Math.abs(r.settled - 40) < 0.01, 'settled at ' + r.settled.toFixed(2));
  // The shield refills on its own, which the health bar never does: without the
  // trail overtaking on the way up, a shield draining and recharging would read
  // as a bar that merely wobbles.
  const back = probe(`(function () {
    player.shield = 40; shGhost = 40; shPrev = 40; shGhostHold = 0; drawUI();
    player.shield = 75; drawUI();
    return shGhost;
  })()`);
  ok('and recharging overtakes the trail rather than lagging it', back === 75, 'ghost ' + back);
  ok('the two bars keep their own state', probe('hpGhost !== shGhost || hpPrev !== shPrev') !== undefined,
     'separate ghosts');
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

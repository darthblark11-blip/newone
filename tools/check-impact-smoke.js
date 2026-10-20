// Exercise real bullet impacts and particle layering, including paused frames
// and recycling. Smoke must not hide the blood emitted by another hit.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness.js');
const P = s => probe('(' + s + ')');
probe(`isStoryMode = false; townsData = {}; startAtLevel(3); started = true; doTick = true;
       viewLeft = -1e6; viewRight = 1e6; viewTop = -1e6; viewBottom = 1e6;
       barrels = []; enemiesList = []; particles = []; bullets = [];`);

for (const type of ['ARMORED', 'ARMORED_STANDARD']) {
  const hit = probe(`(() => {
    enemiesList = []; particles = []; bullets = [];
    const t = new Character(player.x + 200, player.y, false, ${JSON.stringify(type)});
    enemiesList.push(t);
    const before = t.hp;
    spawnBullet(t.x - PLAYER_BULLET_SPEED, t.y, 0, true, "BODY", WEAPONS.PISTOL, player);
    updateBullets();
    return { before, hp: t.hp, types: particles.map(p => p.t) };
  })()`);
  assert(hit.hp < hit.before, type + ': the shot must actually hit');
  assert(hit.types.includes('SMOKE'), type + ': impact uses robot smoke');
  assert(hit.types.includes('SPARK'), type + ': metal impact retains sparks');
  assert(!hit.types.includes('CHIP'), type + ': hard-edged debris is replaced');

  const exposed = probe(`(() => {
    enemiesList = []; particles = []; bullets = [];
    const t = new Character(player.x + 200, player.y, false, ${JSON.stringify(type)});
    t.hp = ${type === 'ARMORED' ? 200 : 40};
    enemiesList.push(t);
    spawnBullet(t.x - PLAYER_BULLET_SPEED, t.y, 0, true, "BODY", WEAPONS.PISTOL, player);
    updateBullets();
    return particles.map(p => p.t);
  })()`);
  assert(exposed.includes('BLOOD'), type + ': exposed flesh keeps its blood effect');
  assert(!exposed.includes('SMOKE'), type + ': exposed flesh does not vent armor smoke');
}

// Record actual show calls in both creation orders: a newer smoke puff used
// to obscure old blood, or vice versa, depending only on emission order.
for (const types of [['SMOKE', 'BLOOD', 'EXPLOSION', 'GORE', 'BONE'], ['BONE', 'GORE', 'EXPLOSION', 'BLOOD', 'SMOKE']]) {
  for (const ticking of [true, false]) {
    const draw = [];
    ctx.__draw = draw;
    probe(`particles = []; doTick = ${ticking};
      for (const t of ${JSON.stringify(types)}) {
        const p = new Particle(0, 0, color(70), t);
        p.updates = 0;
        p.update = function () { this.updates++; };
        p.show = function () { window.__draw.push(this.t); };
        particles.push(p);
      }
      updateParticles();`);
    const cloudEnd = Math.max(draw.indexOf('SMOKE'), draw.indexOf('EXPLOSION'));
    assert(['BLOOD', 'GORE', 'BONE'].every(t => draw.indexOf(t) > cloudEnd), 'blood and gore draw above clouds');
    assert.equal(draw.length, types.length, 'each visible particle draws once');
    assert(P('particles.every(p => p.updates === ' + (ticking ? 1 : 0) + ')'), 'advance once per tick, never while paused');
    assert.equal(P('particles.map(p => p.t).join()'), types.join(), 'survivor order is stable');
  }
}

probe(`particles[1].a = 0; particles[3].a = 0;
       window.__survivors = particles.filter(p => p.a > 0).map(p => p.t).join();
       window.__poolBefore = _particlePool.length;
       updateParticles();`);
assert.equal(P('particles.map(p => p.t).join()'), P('window.__survivors'), 'dead particles compact without losing survivors');
assert.equal(P('_particlePool.length'), P('window.__poolBefore + 2'), 'dead particles return to the pool');
console.log('Armored impacts, cloud/blood order, pause, compaction and pooling passed.');

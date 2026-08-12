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
// Asserted by watching the order of ellipse() calls: a hand is a circle at the
// rig's own hand size, the torso is bodyW x bodyH. Where the hands fall in that
// sequence is the rig. The hand size is READ from figureRig() rather than
// written down here — it moved once already, when the living figure was
// re-proportioned against the corpse, and a literal turns this whole file into
// eight failures that say nothing about the thing it is guarding.
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
const HAND = P(`figureRig(${BODY_W}, ${BODY_H}).hand`);

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
  seq.forEach((e, i) => { if (e[0] === HAND && e[1] === HAND) hands.push(i); });
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

// Draw the player once and report where the art actually landed, in the
// character's own frame — hand centres, sleeve segment lengths, and the angle
// any carried weapon was drawn at. Everything below needs the transform, not
// the arguments, because every limb is drawn inside its own translate+rotate.
function poseOf(setup) {
  probe(setup);
  const px = P('player.x'), py = P('player.y');
  const real = {};
  for (const k of ['ellipse', 'rect', 'push', 'pop', 'translate', 'rotate', 'scale']) {
    real[k] = ctx[k];
  }
  // Start at the character's own origin, so everything below is in the frame
  // the pose is authored in rather than out in the world. `k` accumulates the
  // along-axis squash the figure uses in two places — the torso's depth and a
  // carried weapon's depression — both of which are scale(k, 1) applied right
  // before the thing they squash, so carrying it as a scalar is exact here and
  // leaves the rotation clean to read angles off.
  let m = { x: -px, y: -py, c: 1, s: 0, k: 1 };
  const stack = [];
  const hands = [], segs = [], rects = [];
  // The torso's own angle. A weapon held against the body turns WITH the body,
  // and the shoulders counter-rotate on purpose — measuring a gun against the
  // world would score that deliberate twist as wobble.
  let bodyAng = 0, torsoAt = -1, n = 0;
  ctx.push = () => { stack.push(Object.assign({}, m)); };
  ctx.pop = () => { if (stack.length) m = stack.pop(); };
  ctx.translate = (x, y) => { m.x += x * m.c - y * m.s; m.y += x * m.s + y * m.c; };
  ctx.rotate = (a) => {
    const c = Math.cos(a), s = Math.sin(a);
    const nc = m.c * c - m.s * s, ns = m.s * c + m.c * s;
    m.c = nc; m.s = ns;
  };
  ctx.scale = (a, b) => { m.k *= a; };
  ctx.ellipse = (x, y, w, h) => {
    x *= m.k;
    const wx = m.x + x * m.c - y * m.s, wy = m.y + x * m.s + y * m.c;
    n++;
    if (w === BODY_W && h === BODY_H) { bodyAng = Math.atan2(m.s, m.c); torsoAt = n; }
    else if (w === HAND && h === HAND) hands.push([wx, wy]);
    // A sleeve segment: longer than it is wide, at one of the rig's two widths.
    else if (w > h && (Math.abs(h - RIGW.u) < 1e-6 || Math.abs(h - RIGW.f) < 1e-6)) {
      segs.push({ w: h, len: w - h });
    }
  };
  // Every rect, with its ends in the figure's own frame and its place in the
  // draw order. The weapon is picked out below.
  ctx.rect = (x, y, w, h) => {
    n++;
    const e = (t) => [m.x + t * m.c, m.y + t * m.s];
    rects.push({ w: w, h: h, at: n, ang: Math.atan2(m.s, m.c) - bodyAng,
                 a: e(x), b: e(x + w) });
  };
  probe('player.show();');
  Object.assign(ctx, real);
  // The barrel: the longest rect drawn AFTER the torso. Identifying it by a
  // literal width stopped working the moment the art began squashing itself
  // along its own axis, and "after the torso" is what separates a weapon in the
  // hands from the pack on the back, which is drawn before it and is 12 across.
  let best = null;
  for (const r of rects) {
    if (r.at > torsoAt && r.w > 6 && (!best || r.w > best.w)) best = r;
  }
  // The two grips, as fractions along the barrel. Expressed that way they ride
  // the weapon's own foreshortening: the rect runs from -22 to +24 in the gun's
  // frame and the grips sit at -11 and +9 inside it, whatever it is squashed to.
  if (best) {
    const f = (t) => [best.a[0] + (best.b[0] - best.a[0]) * t,
                      best.a[1] + (best.b[1] - best.a[1]) * t];
    best.grips = [f(11 / 46), f(31 / 46)];
  }
  return { hands, segs, guns: best ? [best] : [], torsoAt, bodyAng };
}
const RIGW = { u: P(`figureRig(${BODY_W}, ${BODY_H}).upperW`),
               f: P(`figureRig(${BODY_W}, ${BODY_H}).foreW`) };

console.log('\n== relaxed arms: the hands stay on the body, not out on stalks ==');
// The crab. The shoulder joints used to sit ON the silhouette and every unit of
// outboard reach after that came off the far side of the torso, so the figure
// walked with both hands held clear of itself. A hand is allowed to show past
// the shoulder line — they do — but only by about its own width.
{
  probe(`player.isArmed = false; player.meleeTimer = 0; player.isNeutral = false;
         swordPickedUp = false; setMeleeTool("NONE"); rightStick.active = false;
         player.aimHold = 0; player.aimAngle = 0; player.moveAngle = 0;`);
  const halfH = BODY_H / 2;
  let worst = 0, worstAt = '';
  for (const g of [0.15, 0.5, 1.0]) {
    for (let i = 0; i < 16; i++) {
      const p = poseOf(`player.isMoving = true; player.gait = ${g};
                        player.walkCycle = ${(i * Math.PI) / 8};`);
      for (const h of p.hands) {
        const proud = Math.abs(h[1]) - halfH;
        if (proud > worst) { worst = proud; worstAt = `gait ${g}, phase ${i}`; }
      }
    }
  }
  ok('a hand never strays more than its own width past the shoulder line',
     worst < HAND, `worst ${worst.toFixed(2)} past the edge (hand is ${HAND}) — ${worstAt}`);

  // The bow tie. Mid-stride the hand passes within a whisker of its own
  // shoulder, and an unclamped two-bone solve answers that with an elbow thirty
  // units out on a seven-unit bone — the forearm then runs all the way back and
  // the arm crosses itself through the chest. Every drawn segment has to stay
  // inside the bone it represents.
  let longest = 0, at = '';
  for (const g of [0.15, 0.34, 0.5, 0.66, 1.0]) {
    for (let i = 0; i < 24; i++) {
      const p = poseOf(`player.isMoving = true; player.gait = ${g};
                        player.walkCycle = ${(i * Math.PI) / 12};`);
      for (const s of p.segs) {
        const bone = Math.abs(s.w - RIGW.u) < 1e-6
          ? P(`figureRig(${BODY_W}, ${BODY_H}).upper`)
          : P(`figureRig(${BODY_W}, ${BODY_H}).fore`);
        const over = s.len / bone;
        if (over > longest) { longest = over; at = `gait ${g}, phase ${i}`; }
      }
    }
  }
  ok('and no segment is ever drawn longer than the bone it is',
     longest <= 1.001, `longest ${(longest * 100).toFixed(0)}% of its bone — ${at}`);
}

console.log('\n== a carried gun is held, not waved about ==');
// Welded to the forearm, the weapon's angle swung through the arm's whole arc
// every stride and read as a physics glitch. A wrist keeps a pistol pointing
// where it is put; the stride belongs in the hand's POSITION, not its rotation.
{
  for (const [w, label, cap] of [['PISTOL', 'a sidearm', 10], ['ASSAULT_RIFLE', 'a long gun', 7]]) {
    probe(`player.isArmed = true; player.currentWeapon = WEAPONS.${w};
           player.meleeTimer = 0; player.reloadTimer = 0; player.muzzleFlash = 0;
           player.throwAnimTimer = 0; player.dashTimer = 0;
           rightStick.active = false; player.aimHold = 0;
           swordPickedUp = false; setMeleeTool("NONE");`);
    let lo = Infinity, hi = -Infinity, n = 0;
    for (let i = 0; i < 24; i++) {
      const p = poseOf(`player.isMoving = true; player.gait = 1;
                        player.walkCycle = ${(i * Math.PI) / 12};`);
      for (const g of p.guns) { lo = Math.min(lo, g.ang); hi = Math.max(hi, g.ang); n++; }
    }
    const deg = ((hi - lo) * 180) / Math.PI;
    ok(`${label} swings less than ${cap} degrees over a full stride at a run`,
       n > 0 && deg < cap, n ? deg.toFixed(1) + ' degrees across 24 phases' : 'gun never drawn');
  }
}

console.log('\n== the run is a run: elbows in, and a real fore-and-aft swing ==');
{
  probe(`player.isArmed = false; player.meleeTimer = 0; player.isNeutral = false;
         swordPickedUp = false; setMeleeTool("NONE"); rightStick.active = false;
         player.aimHold = 0; player.aimAngle = 0; player.moveAngle = 0;`);
  // Shrinking the whole reach to fold the elbow took the axial swing away with
  // it, so a run had bent arms that barely moved. The fold comes from where the
  // elbow is PUT; the reach is free to grow, and this is the property that says
  // it did — the hands have to cover more ground the faster he goes.
  const travel = {};
  for (const [g, name] of [[0.15, 'walk'], [0.5, 'jog'], [1.0, 'run']]) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < 24; i++) {
      const p = poseOf(`player.isMoving = true; player.gait = ${g};
                        player.walkCycle = ${(i * Math.PI) / 12};`);
      for (const h of p.hands) { lo = Math.min(lo, h[0]); hi = Math.max(hi, h[0]); }
    }
    travel[name] = hi - lo;
  }
  ok('the hands travel further fore-and-aft the faster he goes',
     travel.walk < travel.jog && travel.jog < travel.run,
     `walk ${travel.walk.toFixed(1)}, jog ${travel.jog.toFixed(1)}, run ${travel.run.toFixed(1)} units`);
  ok('and a run swings them most of a body length',
     travel.run > BODY_W * 1.15,
     `${travel.run.toFixed(1)} against a ${BODY_W}-deep body`);
}

console.log('\n== a carried weapon sits ON the man, not off his side ==');
// The glitch was the long gun slung about the body's middle: its stock swung
// out past the silhouette behind the strong shoulder every stride and read as a
// loose plank stuck to his flank. A carried weapon's BUTT belongs on the man.
{
  for (const [w, label, dipped] of [['ASSAULT_RIFLE', 'the long gun', true],
                                    ['PISTOL', 'the sidearm', true]]) {
    probe(`player.isArmed = true; player.currentWeapon = WEAPONS.${w};
           player.meleeTimer = 0; player.reloadTimer = 0; player.muzzleFlash = 0;
           player.throwAnimTimer = 0; player.dashTimer = 0;
           rightStick.active = false; player.aimHold = 0;
           swordPickedUp = false; setMeleeTool("NONE");`);
    let worstBack = -Infinity, worstSide = 0, len = { lo: Infinity, hi: -Infinity };
    for (const g of [0.15, 0.5, 1.0]) {
      for (let i = 0; i < 16; i++) {
        const p = poseOf(`player.isMoving = true; player.gait = ${g};
                          player.walkCycle = ${(i * Math.PI) / 8};`);
        for (const gun of p.guns) {
          // `a` is the butt end: the rect starts at the stock.
          worstBack = Math.max(worstBack, -gun.a[0]);
          worstSide = Math.max(worstSide, Math.abs(gun.a[1]) - BODY_H / 2);
          const L = Math.hypot(gun.b[0] - gun.a[0], gun.b[1] - gun.a[1]);
          len.lo = Math.min(len.lo, L); len.hi = Math.max(len.hi, L);
        }
      }
    }
    ok(`${label}'s butt stays on the body, not out past his flank`,
       worstSide < 2.5 && worstBack < BODY_W * 0.7,
       `${worstSide.toFixed(1)} past the shoulder line, ${worstBack.toFixed(1)} behind centre`);
  }

  // A carried weapon is depressed, and from directly above a depressed barrel
  // is a SHORT one. The sidearm's dip rides the swing, so it visibly extends as
  // the wrist comes up and retracts as the muzzle drops — drawn at a fixed
  // length it reads as a bar held out sideways, which is the one thing this
  // camera cannot show as depression.
  probe(`player.currentWeapon = WEAPONS.PISTOL; player.gait = 1;`);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 24; i++) {
    const p = poseOf(`player.isMoving = true; player.walkCycle = ${(i * Math.PI) / 12};`);
    for (const gun of p.guns) {
      const L = Math.hypot(gun.b[0] - gun.a[0], gun.b[1] - gun.a[1]);
      lo = Math.min(lo, L); hi = Math.max(hi, L);
    }
  }
  ok('and the sidearm foreshortens through the swing rather than staying rigid',
     hi / lo > 1.3, `${lo.toFixed(1)} to ${hi.toFixed(1)} units long across the stride`);
}

console.log('\n== one thing in the hand at a time ==');
// The tool test and the gun test are both "is this the strong hand", so without
// a guard the right hand drew a pistol AND a sword. The blade goes away the
// moment the player raises or fires a weapon, which is how it worked before the
// carry existed.
{
  const swordVerts = () => {
    let n = 0;
    const real = ctx.vertex;
    ctx.vertex = () => { n++; };
    probe('player.show();');
    ctx.vertex = real;
    return n;
  };
  probe(`swordPickedUp = true; window.swordEquipped = true; setMeleeTool("SWORD");
         player.meleeTimer = 0; player.isMoving = true; player.gait = 0.5;
         player.walkCycle = 1.2; player.isNeutral = false;
         player.isArmed = false; rightStick.active = false; player.aimHold = 0;`);
  const unarmed = swordVerts();
  ok('unarmed, the blade is in the hand', unarmed >= 5, unarmed + ' blade vertices');

  probe(`player.isArmed = true; player.currentWeapon = WEAPONS.PISTOL;
         rightStick.active = true; player.aimHold = AIM_HOLD;`);
  ok('raising a gun puts the blade away', swordVerts() === 0);

  probe('rightStick.active = false; player.aimHold = 0;');
  ok('and it stays away while the gun is merely carried', swordVerts() === 0);

  probe(`player.isArmed = false; rightStick.active = false; player.aimHold = 0;`);
  ok('putting the gun away brings it back', swordVerts() >= 5);
  probe('swordPickedUp = false; setMeleeTool("NONE"); player.isArmed = false;');
}

console.log('\n== a living figure is the same build as its own corpse ==');
// The swap between the two happens in one frame, in front of the player, and a
// figure whose arms and legs change proportion as it falls is two different
// people. So the living rig is not a second set of numbers to keep in step —
// it IS ragRig(), scaled by the same RAG_SCALE the corpse is drawn inside.
{
  const RS = P('RAG_SCALE');
  const raw = P(`ragRig(${BODY_W}, ${BODY_H})`);
  const fig = P(`figureRig(${BODY_W}, ${BODY_H})`);
  let worstKey = null, worst = 0;
  for (const k of Object.keys(raw)) {
    const e = Math.abs(fig[k] - raw[k] * RS);
    if (e > worst) { worst = e; worstKey = k; }
  }
  ok('figureRig() is ragRig() at the corpse\'s own drawn scale',
     worst < 1e-9, worstKey ? `worst ${worstKey} off by ${worst.toExponential(1)}` : '');

  // The taper is the read. check-corpse.js asserts it on the body lying down;
  // it has to survive the trip to the standing figure or the legs and the torso
  // merge into one tube with feet on the end.
  ok('and the silhouette still only narrows going down',
     fig.thighW > fig.shinW && fig.upperW > fig.foreW,
     `thigh ${fig.thighW.toFixed(1)} > shin ${fig.shinW.toFixed(1)}, ` +
     `upper ${fig.upperW.toFixed(1)} > fore ${fig.foreW.toFixed(1)}`);

  // The bug this replaced: the sleeve's length was floored at the rig's full
  // bone length while the hand only reached a fraction of it, so a whole
  // forearm hung off the end of the arm pointing away from the body — a chain
  // of lobes, worst at rest, where the reach is near zero and the direction is
  // whatever atan2 makes of it. Fitting the segments TO the hand is the fix,
  // and the property is that nothing draws past the hand but a joint cap.
  //
  // Measured by tracking the transform: limbs are drawn inside their own
  // translate+rotate, so an ellipse's far tip has to be brought back into the
  // character's frame before it can be compared with anything.
  const fore = fig.foreW;
  let over = 0, overAt = null;
  for (let i = 0; i < 16; i++) {
    const ph = (i * Math.PI) / 8;
    // Replay the rig's own arithmetic is NOT what this does — it reads the
    // ellipses the game actually emitted and where the transform put them.
    const st = [{ x: 0, y: 0, c: 1, s: 0 }];
    const stack = [];
    const real = { e: ctx.ellipse, p: ctx.push, o: ctx.pop, t: ctx.translate, r: ctx.rotate };
    const tips = [], hands = [];
    ctx.push = () => { stack.push(Object.assign({}, st[0])); };
    ctx.pop = () => { if (stack.length) st[0] = stack.pop(); };
    ctx.translate = (x, y) => {
      const m = st[0];
      m.x += x * m.c - y * m.s; m.y += x * m.s + y * m.c;
    };
    ctx.rotate = (a) => {
      const m = st[0], c = Math.cos(a), s = Math.sin(a);
      const nc = m.c * c - m.s * s, ns = m.s * c + m.c * s;
      m.c = nc; m.s = ns;
    };
    ctx.ellipse = (x, y, w, h) => {
      const m = st[0];
      const wx = m.x + x * m.c - y * m.s, wy = m.y + x * m.s + y * m.c;
      // A limb segment is longer than it is wide and lies along the local +x.
      if (w === HAND && h === HAND) hands.push([wx, wy]);
      else if (w > h && Math.abs(h - fore) < 1e-6) {
        tips.push([wx + (w / 2) * m.c, wy + (w / 2) * m.s]);
      }
    };
    probe(`player.isArmed = false; setMeleeTool("NONE");
           player.isMoving = true; player.walkCycle = ${ph};`);
    probe('player.show();');
    Object.assign(ctx, { ellipse: real.e, push: real.p, pop: real.o,
                         translate: real.t, rotate: real.r });
    for (const t of tips) {
      // Distance from this sleeve's tip to the NEAREST hand. A tip is allowed
      // to sit one cap radius past its hand and no further.
      let best = Infinity;
      for (const h of hands) best = Math.min(best, Math.hypot(t[0] - h[0], t[1] - h[1]));
      if (best > over) { over = best; overAt = i; }
    }
  }
  ok('and no sleeve is ever drawn past its own hand',
     over <= fore * 0.60 + 1e-6,
     `worst tip ${over.toFixed(2)} from the hand, cap allows ${(fore * 0.60).toFixed(2)}` +
     (overAt === null ? '' : ` (frame ${overAt})`));
}

console.log('\n== the gait: one throttle, three bands, no seam ==');
// The whole design is that walk, jog and run are one interpolation and not
// three animations with a switch between them. A discontinuity at a band edge
// is exactly the pop this exists to avoid, and it is invisible in a still —
// you only see it as a stutter while a thumb rests near 32% or 65%.
{
  const W = P('GAIT_WALK'), J = P('GAIT_JOG');
  ok('the bands are the ones asked for: 1-32 walk, 33-65 jog, 66-100 run',
     Math.abs(W - 0.32) < 1e-9 && Math.abs(J - 0.65) < 1e-9, `${W} / ${J}`);

  // Walk the throttle across its whole range and watch every parameter.
  const keys = ['band', 'cadence', 'swing', 'twist', 'bob', 'lean'];
  const N = 400;
  let worstJump = 0, jumpAt = 0, nonMono = null, bendInWalk = 0;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const g = P(`(function(){var g=gaitPose(${t});var o={};` +
                `for(var k in g)o[k]=g[k];return o;})()`);
    if (prev) {
      for (const k of keys) {
        const d = Math.abs(g[k] - prev[k]);
        if (d > worstJump) { worstJump = d; jumpAt = t; }
        if (g[k] < prev[k] - 1e-9) nonMono = k + ' at ' + t.toFixed(3);
      }
    }
    if (t <= W && g.bend > 0) bendInWalk++;
    prev = g;
  }
  // A step at a band edge would be orders of magnitude bigger than the
  // per-sample slope; the largest legitimate step here is `band` itself.
  ok('no parameter steps at a band edge — the three gaits are one curve',
     worstJump < 0.05, 'largest step ' + worstJump.toFixed(4) +
     ' at throttle ' + jumpAt.toFixed(3));
  ok('and every one of them rises with the throttle', nonMono === null,
     nonMono || 'cadence, swing, twist, bob, lean all monotonic');
  // Zero bend through the walk is what makes a walk look like a walk: a
  // straight arm swinging from the shoulder, not a jogger's folded one.
  ok('the elbow stays straight for the whole walk band', bendInWalk === 0,
     bendInWalk + ' samples with a bent elbow below ' + W);
  const run = P('(function(){var g=gaitPose(1);return [g.cadence,g.swing,g.bend,g.twist];})()');
  const walk = P('(function(){var g=gaitPose(0.16);return [g.cadence,g.swing,g.bend,g.twist];})()');
  ok('and a run is visibly a different gait from a walk, not a faster one',
     run[0] / walk[0] > 1.5 && run[1] / walk[1] > 1.5 && run[2] > 0.9 &&
     run[3] / walk[3] > 2.5,
     `cadence x${(run[0] / walk[0]).toFixed(2)}, swing x${(run[1] / walk[1]).toFixed(2)}, ` +
     `bend ${run[2].toFixed(2)}, twist x${(run[3] / walk[3]).toFixed(2)}`);

  // The throttle is eased, not read raw: a thumb reaches 100% in one frame and
  // a body does not. Without this the arms snap to a full running stride on the
  // frame the stick moves, which reads as the animation being switched.
  probe(`player.gait = 0; player.isMoving = true;
         leftStick.active = true; leftStick.dx = 1; leftStick.dy = 0;`);
  const g1 = P('(function(){player.gait += (1 - player.gait) * GAIT_EASE; return player.gait;})()');
  let frames = 1, gv = g1;
  while (gv < 0.9 && frames < 200) {
    gv = P('(function(){player.gait += (1 - player.gait) * GAIT_EASE; return player.gait;})()');
    frames++;
  }
  ok('the body eases into a new throttle rather than snapping to it',
     g1 < 0.25 && frames > 8 && frames < 60,
     `${(g1 * 100).toFixed(0)}% after one frame, 90% after ${frames}`);
}

console.log('\n== carrying a weapon, as opposed to presenting one ==');
// Armed and not aiming, the gun comes down and the walking rig takes over. The
// silent failure is the opposite: three separate blocks lay their arms out
// around a gun that is UP, and any one of them left running gives the player a
// second pair of arms holding a second weapon.
{
  const setArm = (w, aiming) => probe(`
    player.isArmed = true; player.currentWeapon = WEAPONS.${w};
    player.meleeTimer = 0; player.reloadTimer = 0; player.muzzleFlash = 0;
    player.throwAnimTimer = 0; player.dashTimer = 0; player.isNeutral = false;
    swordPickedUp = false; setMeleeTool("NONE");
    rightStick.active = ${!!aiming};
    player.aimHold = ${aiming ? 'AIM_HOLD' : 0};
    player.isMoving = true; player.walkCycle = 1.9; player.gait = 0.5;
  `);

  setArm('ASSAULT_RIFLE', false);
  const carried = trace('', 'player');
  ok('a carried long gun puts BOTH hands on it, in front of the body',
     carried.total === 2 && carried.infront === 2 && carried.behind === 0,
     JSON.stringify(carried));

  setArm('ASSAULT_RIFLE', true);
  const presented = trace('', 'player');
  ok('and presenting it hands the arms back to the aimed pose',
     presented.total === 0, presented.total + ' rig hands while aiming');

  setArm('PISTOL', false);
  const side = trace('', 'player');
  ok('a carried sidearm swings with its own arm: one hand leading, one trailing',
     side.total === 2 && side.infront >= 1, JSON.stringify(side));

  // The draw sequence, and there are two rules in it. A long gun held across
  // the chest is IN FRONT of the body, so it goes down after the torso — drawn
  // in the back pass the shirt swallows it, which is the whole reason the arm
  // rig is split in two. And from a BIRD'S EYE the hand is UNDER the thing it
  // is gripping: drawn the other way round the rifle had two skin discs sitting
  // on top of its receiver.
  setArm('ASSAULT_RIFLE', false);
  {
    const p = poseOf(`player.isMoving = true; player.gait = 0.5;
                      player.walkCycle = 1.9;`);
    ok('the carried long gun is drawn after the torso, not behind it',
       p.guns.length === 1 && p.guns[0].at > p.torsoAt,
       p.guns.length ? `torso at ${p.torsoAt}, gun at ${p.guns[0].at}` : 'no gun found');
  }
  {
    const realE = ctx.ellipse, realR = ctx.rect;
    let n = 0, lastHand = -1, gunAt = -1, gunW = 0;
    ctx.ellipse = (x, y, w, h) => { n++; if (w === HAND && h === HAND) lastHand = n; };
    ctx.rect = (x, y, w, h) => { n++; if (w > gunW && w > 6) { gunW = w; gunAt = n; } };
    probe('player.show();');
    ctx.ellipse = realE; ctx.rect = realR;
    ok("and every hand goes down UNDER it, as a bird's eye view demands",
       gunAt > lastHand, `last hand at ${lastHand}, gun at ${gunAt}`);
  }

  // Both grips must be inside the arms' reach, or the hands hang short of the
  // weapon and it floats.
  {
    const p = poseOf(`player.isMoving = true; player.gait = 0.5;
                      player.walkCycle = 1.9;`);
    const grips = p.guns.length ? p.guns[0].grips : [];
    let worst = 0;
    for (const g of grips) {
      let best = Infinity;
      for (const h of p.hands) best = Math.min(best, Math.hypot(g[0] - h[0], g[1] - h[1]));
      worst = Math.max(worst, best);
    }
    ok('both hands actually reach the grips they are holding',
       grips.length === 2 && p.hands.length === 2 && worst < 3.5,
       `worst hand-to-grip gap ${worst.toFixed(2)} over ${grips.length} grips`);
  }
}

console.log('\n== the gun comes up instantly and goes down deliberately ==');
{
  probe(`player.isArmed = true; player.currentWeapon = WEAPONS.PISTOL;
         player.meleeTimer = 0; player.reloadTimer = 0; player.muzzleFlash = 0;
         player.throwAnimTimer = 0; player.dashTimer = 0; player.aimHold = 0;
         rightStick.active = true;`);
  probe('player.aimHold = aimIntent(player) ? AIM_HOLD : Math.max(0, player.aimHold - 1);');
  ok('touching the aim stick presents the weapon on the same frame',
     P('playerAiming(player)') === true);
  probe('rightStick.active = false;');
  let held = 0;
  while (P('playerAiming(player)') && held < 200) {
    probe('player.aimHold = aimIntent(player) ? AIM_HOLD : Math.max(0, player.aimHold - 1);');
    held++;
  }
  ok('and letting go holds it up briefly rather than dropping it that frame',
     held === P('AIM_HOLD'), held + ' frames, AIM_HOLD is ' + P('AIM_HOLD'));
  probe('rightStick.active = false; player.aimHold = 0;');
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

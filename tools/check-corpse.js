// How a body comes to rest.
//
// Every corpse used to land in one pose: legs at fixed offsets, arms lerped
// between two constants, the whole figure rotated to face the way it died. The
// settle replaces that with a torso spin and eight damped springs — a shoulder
// and an elbow, a hip and a knee, one pair per limb — shoved by the round that
// did the killing. This checks that it varies, that the impact direction is
// actually read, that it FREEZES (a corpse on the floor must cost nothing), and
// that the pieces it is not meant to touch are untouched.
const { ctx, probe } = require('./harness.js');
const P = (s) => probe('(' + s + ')');
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  ' + x : '')); if (!c) fails++; };

let seed = 5150;
ctx.random = function (a, b) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  if (b === undefined) return r * a;
  return a + r * (b - a);
};

probe(`isStoryMode = false; townsData = {}; startAtLevel(2); started = true; doTick = true;
       viewLeft = -1e6; viewRight = 1e6; viewTop = -1e6; viewBottom = 1e6;`);

const FRAMES = P('RAG_FRAMES');

// Drop a body and let it settle. `bA` is the direction the round travelled,
// `aA` the way they were facing.
function drop(dT, eT, bA, aA, frames) {
  probe(`corpses = [];
         corpses.push(new Corpse(0, 0, ${aA}, ${aA}, color(1), color(1), ${dT}, 0, [], null,
                                 ${bA}, ${JSON.stringify(eT)}, 21, 27));`);
  for (let i = 0; i < (frames === undefined ? FRAMES + 6 : frames); i++) probe('frameCount++; corpses[0].update();');
  return P(`(function () {
    const c = corpses[0];
    return c.rag ? { spin: c.rag.spin, ang: c.rag.ang, t: c.rag.t, done: c.rag.done,
                     pose: c.rag.limbs.map(function (L) { return [L.a, L.b]; }) } : null;
  })()`);
}
const flat = (r) => r.pose.reduce((a, p) => a.concat(p), []);

console.log('== who gets a settle ==');
{
  // Every death that leaves a body lying down — headshots and body shots alike.
  let missing = null;
  for (const dT of [0, 1, 2, 4, 6, 7, 8, 9]) if (!drop(dT, 'NORMAL', 0.5, 0, 2)) missing = dT;
  ok('every whole-body death type settles', missing === null, missing === null ? 'dT 0,1,2,4,6,7,8,9' : 'dT ' + missing);

  // The gib deaths come apart into their own pieces and draw their own thing.
  let wrong = null;
  for (const dT of [3, 5, 10, 11, 12, 13, 14, 15]) if (drop(dT, 'NORMAL', 0.5, 0, 2)) wrong = dT;
  ok('and the ones that come apart do not', wrong === null, wrong === null ? '8 gib types' : 'dT ' + wrong);

  // Only things shaped like people.
  const nonhuman = [['ROBOT', 30], ['BUG', 20], ['SNAIL', 30], ['COW', 45], ['ALIEN_GATOR', 63]];
  let human = null;
  for (const [t] of nonhuman) if (drop(0, t, 0.5, 0, 2)) human = t;
  ok('a bug, a cow and a machine do not get human joints', human === null, human || '5 types');
  ok('but ARMORED_STANDARD, a person in armour, does', drop(0, 'ARMORED_STANDARD', 0.5, 0, 2) !== null);
  ok("and ARMORED's 105-wide slab does not",
     P(`ragHumanoid("ARMORED_STANDARD", 105)`) === false);
}

console.log('\n== the round that killed them is read ==');
{
  // A shot across the body turns it. One straight up the spine does not.
  const across = drop(0, 'NORMAL', Math.PI / 2, 0);
  const spine  = drop(0, 'NORMAL', 0, 0);
  ok('a hit through the ribs spins the body', Math.abs(across.ang) > 0.35,
     `turned ${(across.ang * 57.3).toFixed(0)} degrees`);
  ok('a hit up the spine barely does', Math.abs(spine.ang) < Math.abs(across.ang) * 0.5,
     `turned ${(spine.ang * 57.3).toFixed(0)} degrees`);

  // And it turns the correct way round.
  const left  = drop(0, 'NORMAL', Math.PI / 2, 0);
  const right = drop(0, 'NORMAL', -Math.PI / 2, 0);
  ok('and from the other side it turns the other way',
     Math.sign(left.ang) === -Math.sign(right.ang),
     `${(left.ang * 57.3).toFixed(0)} vs ${(right.ang * 57.3).toFixed(0)} degrees`);
}

console.log('\n== no two bodies land the same ==');
{
  // Same type, same death, same shot: the poses still have to differ, or the
  // whole thing is the old single drawing with extra steps.
  const poses = [];
  for (let i = 0; i < 8; i++) poses.push(flat(drop(0, 'NORMAL', 0.6, 0)));
  let identical = 0, spread = 0;
  for (let i = 1; i < poses.length; i++) {
    let d = 0;
    for (let k = 0; k < poses[0].length; k++) d += Math.abs(poses[i][k] - poses[0][k]);
    if (d < 0.01) identical++;
    spread = Math.max(spread, d);
  }
  ok('eight bodies, eight different poses', identical === 0, identical + ' duplicates');
  ok('and the difference is visible, not a rounding error', spread > 1.0,
     `widest spread ${spread.toFixed(2)} radians across 8 joints`);

  // Every joint has to actually be doing something. A leg may legitimately
  // settle straight, so the bar is that the SET is not all at neutral.
  const r = drop(0, 'NORMAL', 0.6, 0);
  const moved = r.pose.filter((p) => Math.abs(p[0]) > 0.05).length;
  const bent = r.pose.filter((p) => Math.abs(p[1]) > 0.05).length;
  ok('the limbs end up somewhere, not all at neutral', moved >= 3, moved + '/4 shoulders and hips');
  ok('and all four hinges are bent', bent === 4, bent + '/4 elbows and knees');
}

console.log('\n== nothing bends the wrong way ==');
{
  // The anatomy is the point of the limits: a shoulder cannot swing the arm
  // through the chest, a hip lying down splays about thirty degrees, and an
  // elbow and a knee are hinges that fold ONE way. Sampled hard, because the
  // impact lean and the torso drag both shove these about.
  let bad = null, n = 0;
  for (let i = 0; i < 60 && !bad; i++) {
    const bA = (i / 60) * Math.PI * 2;
    for (const f of [1, 3, 6, 11, 18, 26, FRAMES + 4]) {
      const r = drop(0, 'NORMAL', bA, 0, f);
      const lim = P('corpses[0].rag.limbs.map(function (L) { return [L.lo, L.hi, L.bMax]; })');
      for (let k = 0; k < 4 && !bad; k++) {
        const [a, b] = r.pose[k], [lo, hi, bMax] = lim[k];
        if (a < lo - 1e-9 || a > hi + 1e-9) bad = `limb ${k} shoulder/hip at ${a.toFixed(2)}, limit ${lo}..${hi}`;
        if (b < -1e-9) bad = `limb ${k} hinge hyperextended to ${b.toFixed(2)}`;
        if (b > bMax + 1e-9) bad = `limb ${k} hinge folded past ${bMax} to ${b.toFixed(2)}`;
        n++;
      }
    }
  }
  ok('no joint ever leaves its range, at any frame of the fall', bad === null,
     bad || n + ' joint readings across 60 impact angles');

  // Arms and legs are not held to the same arc — an arm swings much further
  // than a hip does when you are lying on the ground.
  const lim = P('corpses[0].rag.limbs.map(function (L) { return L.hi - L.lo; })');
  ok('a shoulder has a wider arc than a hip', lim[0] > lim[2] * 2,
     `arm ${lim[0].toFixed(2)} rad vs leg ${lim[2].toFixed(2)} rad`);
}

console.log('\n== the proportions ==');
{
  // The torso was doing the legs' job: 36 long and 27 wide, wider than a
  // person and short enough that the limbs had nothing to reach with.
  const g = P(`(function () {
    const c = new Corpse(0, 0, 0, 0, color(1), color(1), 0, 0, [], null, 0, "NORMAL", 21, 27);
    return { TL: c.bH * 1.15, TW: c.bW * 0.78, bW: c.bW, bH: c.bH };
  })()`);
  ok('the torso is longer than it is wide', g.TL > g.TW * 1.6,
     `${g.TL.toFixed(1)} long x ${g.TW.toFixed(1)} wide = ${(g.TL / g.TW).toFixed(2)}:1`);
  ok('and narrower than the old one', g.TW < g.bH, `${g.TW.toFixed(1)} vs the old ${g.bH}`);
  // Hip to heel has to out-reach the torso, or the body is all chest.
  const legReach = 17 + 16;
  ok('the legs are longer than the torso', legReach > g.TL,
     `${legReach} of leg against ${g.TL.toFixed(1)} of torso`);
  const total = (g.TL * 0.5 + 5 + 5.5) + (g.TL * 0.36 + legReach);
  ok('and the whole body reads at about six heads tall', total / 11 > 5.5 && total / 11 < 7,
     `${total.toFixed(0)} units = ${(total / 11).toFixed(1)} heads`);
}

console.log('\n== it stops ==');
{
  // The cost argument for the whole feature: a body integrates while it is
  // falling and then never again. A hundred corpses on a floor must be free.
  const mid = drop(0, 'NORMAL', 0.6, 0, Math.floor(FRAMES / 2));
  ok('still settling halfway through', mid.done === false, `frame ${mid.t} of ${FRAMES}`);
  const end = drop(0, 'NORMAL', 0.6, 0, FRAMES + 40);
  ok('frozen once it is down', end.done === true, `stopped at frame ${end.t}`);
  ok('and the frame counter stops with it', end.t === FRAMES, end.t + ' vs ' + FRAMES);

  // Prove it by reading the pose either side of a long wait.
  const settled = flat(end);
  for (let i = 0; i < 300; i++) probe('frameCount++; corpses[0].update();');
  const later = flat(P(`({ pose: corpses[0].rag.limbs.map(function (L) { return [L.a, L.b]; }) })`));
  let drift = 0;
  for (let k = 0; k < settled.length; k++) drift += Math.abs(later[k] - settled[k]);
  ok('300 frames later it has not moved a hair', drift === 0, drift.toFixed(6) + ' radians of drift');
}

console.log('\n== the falling still reads as falling ==');
{
  // The limbs have to travel during the settle, not snap to the rest pose on
  // frame one — otherwise there is no animation, just a different still.
  const early = flat(drop(0, 'NORMAL', 0.6, 0, 3));
  const late = flat(drop(0, 'NORMAL', 0.6, 0, FRAMES + 6));
  // Same seed sequence is not guaranteed across two drops, so compare each
  // body against its own start instead.
  probe(`corpses = [];
         corpses.push(new Corpse(0, 0, 0, 0, color(1), color(1), 0, 0, [], null, 0.6, "NORMAL", 21, 27));`);
  const t0 = P('corpses[0].rag.limbs.map(function (L) { return L.a; })');
  for (let i = 0; i < FRAMES + 6; i++) probe('frameCount++; corpses[0].update();');
  const t1 = P('corpses[0].rag.limbs.map(function (L) { return L.a; })');
  let travel = 0;
  for (let k = 0; k < t0.length; k++) travel += Math.abs(t1[k] - t0[k]);
  ok('the limbs travel on the way down', travel > 0.8,
     travel.toFixed(2) + ' radians of joint travel');
}

console.log('\n== it all draws ==');
{
  probe('viewLeft = -1e6; viewRight = 1e6; viewTop = -1e6; viewBottom = 1e6;');
  let err = null, segs = 0;
  try {
    for (const dT of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
      for (const eT of ['NORMAL', 'FEMALE_PISTOL', 'ARMORED_STANDARD', 'ROBOT', 'BUG']) {
        probe(`corpses = [];
               corpses.push(new Corpse(0, 0, 0.3, 0.3, color(1), color(1), ${dT}, 0.2, [],
                                       null, 0.7, ${JSON.stringify(eT)}, 21, 27));`);
        for (let i = 0; i < 8; i++) probe('frameCount++; corpses[0].update();');
        probe('corpses[0].show();');
      }
    }
  } catch (e) { err = e.message; }
  ok('every death type and body draws mid-fall and at rest', err === null, err || '16 types x 5 bodies');

  // A jointed limb is two segments plus a hand. Count what ragLimb lays down.
  const real = ctx.ellipse;
  let n = 0;
  ctx.ellipse = () => { n++; };
  probe(`(function () { ragLimb(window, 0, 0, 0.2, 0.4, 14, 12, 8, 7, color(1), color(2), 8); })();`);
  ctx.ellipse = real;
  ok('a limb is upper arm, forearm and hand', n === 3, n + ' pieces');
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

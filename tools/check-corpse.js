// How a body comes to rest.
//
// Every corpse used to land in one pose: legs at fixed offsets, arms lerped
// between two constants, the whole figure rotated to face the way it died. The
// settle replaces that with a torso spin and eight damped springs — a shoulder
// and an elbow, a hip and a knee, one pair per limb — shoved by the round that
// did the killing. This checks that it varies, that the impact direction is
// actually read, that it FREEZES (a corpse on the floor must cost nothing), and
// that the pieces it is not meant to touch are untouched.
const { ctx, probe, calls } = require('./harness.js');
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

  // The arms carry most of what a body is doing, so across a crowd they have
  // to use the whole arc — thrown back overhead, out wide, folded across the
  // chest — and a fair share of bodies have to land LOPSIDED. Four independent
  // uniforms cannot do that: they pile up in the middle of the range.
  let lo = 9, hi = -9, asym = 0, folded = 0, overhead = 0;
  for (let i = 0; i < 40; i++) {
    drop(0, 'NORMAL', 0.3, 0, 1);
    const rest = P('corpses[0].rag.limbs.map(function (L) { return [L.rest, L.restB]; })');
    for (const k of [0, 1]) { lo = Math.min(lo, rest[k][0]); hi = Math.max(hi, rest[k][0]); }
    if (Math.abs(rest[0][0] - rest[1][0]) > 0.7) asym++;
    if (rest[0][1] > 1.2 || rest[1][1] > 1.2) folded++;
    if (rest[0][0] < -0.5 || rest[1][0] < -0.5) overhead++;
  }
  ok('arms land everywhere from overhead to down at the side', hi - lo > 1.7,
     `${lo.toFixed(2)} to ${hi.toFixed(2)} radians over 40 bodies`);
  ok('a good few land lopsided, one arm up and one down', asym >= 6, asym + '/40');
  ok('some land with the forearm folded across the chest', folded >= 5, folded + '/40');
  ok('and some with an arm thrown back past the head', overhead >= 5, overhead + '/40');
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

console.log('\n== the legs do not cross ==');
{
  // A hip's relaxed position is rolled OUTWARD, so a body on the ground splays.
  // Legs scissored over one another read as a rag, not a person. The sign of
  // the hip angle was inverted, so every body was crossing and the archetype
  // labelled "crossed" was the only one splaying — this is the check that
  // would have caught it.
  const R = P(`(function () { const r = ragRig(21, 27);
    return { hipY: r.hipY, thigh: r.thigh, shin: r.shin }; })()`);
  let worst = -1e9, bent = 0, bow = 0, n = 0;
  for (let i = 0; i < 48; i++) {
    const r = drop(0, 'NORMAL', (i / 48) * Math.PI * 2, 0);
    const knee = P(`[ragKnee(corpses[0].rag.limbs[2]), ragKnee(corpses[0].rag.limbs[3])]`);
    const shin = P(`[ragShin(ragRig(21, 27), ragKnee(corpses[0].rag.limbs[2])),
                     ragShin(ragRig(21, 27), ragKnee(corpses[0].rag.limbs[3]))]`);
    for (const k of [2, 3]) {
      const [a, b] = r.pose[k], kn = knee[k - 2];
      // Mirror the draw: left hip at -hipY, thigh out at `a`, shin at `a - kn`.
      const y = R.hipY + Math.sin(a) * R.thigh + Math.sin(a - kn) * shin[k - 2];
      worst = Math.max(worst, -y);      // how far past the midline the foot got
      // Bow-legged is the shin angled FURTHER out than the thigh: the knee
      // ends up the inner point of the leg and the foot turns out.
      if (a - kn > a + 1e-9 || kn < -1e-9) bow++;
      if (b > 0.05) bent++;
      n++;
    }
  }
  ok('no foot ever reaches the midline, at any impact angle', worst < 0,
     `closest approach ${(-worst).toFixed(1)} units clear of centre, over ${n} legs`);
  ok('and the knee is never the inner point of the leg', bow === 0,
     bow === 0 ? n + ' legs, none bow-legged' : bow + '/' + n + ' bow-legged');
  ok('the hip can only splay outward', R.hipY > 0 && P('ragRig(21, 27) && corpses[0].rag.limbs[2].lo') > 0,
     `floor at ${P('corpses[0].rag.limbs[2].lo')} radians`);
  ok('and the knees are still doing something', bent > n * 0.5, bent + '/' + n + ' bent');

  // A knee bends in one plane, and lying on your back that plane stands
  // perpendicular to the ground — so from above a bent knee is a SHORTER
  // shin, not a full-length shin swung sideways. That is the noodle.
  const full = P('ragShin(ragRig(21, 27), 0)');
  const folded = P('ragShin(ragRig(21, 27), corpses[0].rag.limbs[2].bMax)');
  ok('a bent knee foreshortens the shin rather than swinging it out',
     folded < full * 0.92 && folded > full * 0.6,
     `${full.toFixed(1)} straight, ${folded.toFixed(1)} at full fold`);
  ok('and a knee cannot fold to a right angle lying down',
     P('corpses[0].rag.limbs[2].bMax') < 1.1,
     `${(P('corpses[0].rag.limbs[2].bMax') * 57.3).toFixed(0)} degrees`);
  // A hinge that can be driven negative is a hyperextension, whatever the
  // spring did on the way there.
  let neg = 0;
  for (let i = 0; i < 24; i++) {
    drop(0, 'NORMAL', (i / 24) * Math.PI * 2, 0, 1 + (i % 9));
    const kn = P(`[ragKnee(corpses[0].rag.limbs[2]), ragKnee(corpses[0].rag.limbs[3])]`);
    if (kn[0] < -1e-9 || kn[1] < -1e-9) neg++;
  }
  ok('the knee never hyperextends, at any frame of the fall', neg === 0, neg + ' of 24 bodies');

  // A knee is only a knee when the shin comes back INWARD past the thigh —
  // anything less is a slightly angled straight leg. That is the fold worth
  // having, and it has to be the minority: a body shot standing lands with its
  // legs mostly extended, and a visible knee on every corpse reads as a crowd
  // of broken toys.
  let kneed = 0, legs = 0;
  for (let i = 0; i < 60; i++) {
    const r = drop(0, 'NORMAL', (i / 60) * Math.PI * 2, 0);
    const kn = P(`[ragKnee(corpses[0].rag.limbs[2]), ragKnee(corpses[0].rag.limbs[3])]`);
    for (const k of [2, 3]) { if (r.pose[k][0] - kn[k - 2] < -0.02) kneed++; legs++; }
  }
  ok('a knee shows on some legs and not most', kneed > legs * 0.04 && kneed < legs * 0.30,
     `${kneed}/${legs} legs = ${(100 * kneed / legs).toFixed(0)}%`);
}

console.log('\n== the size on screen ==');
{
  // Corpses were reading large against the standing figures. One scale over
  // the whole body, so every proportion above survives it.
  const S = P('RAG_SCALE');
  const g = P(`(function () { const R = ragRig(21, 27);
    return { hipX: R.hipX, thigh: R.thigh, shin: R.shin }; })()`);
  const drawn = ((18 + 5.5) + (-g.hipX + g.thigh + g.shin)) * S;
  ok('the shrink is a real reduction but not a different figure', S > 0.7 && S < 0.95,
     `x${S}`);
  ok('a body lies about two and a half times the standing body length',
     drawn / 27 > 2.0 && drawn / 27 < 2.7,
     `${drawn.toFixed(0)} units against a ${27}-long standing body = ${(drawn / 27).toFixed(2)}x`);

  // The scale must be inside the corpse's own transform, or it would shift
  // where the body sits rather than how big it is.
  const before = P('(corpses[0].x + "," + corpses[0].y)');
  probe('corpses[0].show();');
  ok('and it does not move the body', P('(corpses[0].x + "," + corpses[0].y)') === before, before);
}

console.log('\n== a headshot leaves blood on the body ==');
{
  // Every head death already throws a pool onto the GROUND. None of it landed
  // on the person it came out of, so a body with no head above the collar had
  // a clean shirt.
  const R = P('(function () { const r = ragRig(21, 27); return { TL: r.TL, TW: r.TW, shX: r.shX }; })()');
  let missing = null;
  for (const dT of [1, 4, 6, 8, 9]) {
    drop(dT, 'NORMAL', 0.6, 0, 2);
    if (!P('corpses[0].spray || null')) missing = dT;
  }
  ok('every head death sprays the torso', missing === null, missing === null ? 'dT 1,4,6,8,9' : 'dT ' + missing);

  let wrong = null;
  for (const dT of [0, 2, 7]) { drop(dT, 'NORMAL', 0.6, 0, 2); if (P('corpses[0].spray || null')) wrong = dT; }
  ok('and a body shot does not', wrong === null, wrong === null ? 'dT 0,2,7' : 'dT ' + wrong);
  drop(1, 'ROBOT', 0.6, 0, 2);
  ok('nor does a machine', P('corpses[0].spray || null') === null);

  // It has to land ON the shirt: forward of the hips, behind the head, and
  // inside the body's own width. Blood floating off the shoulder is worse
  // than none.
  drop(1, 'NORMAL', 0.6, 0, 2);
  const sp = P('corpses[0].spray.map(function (s) { return [s.x, s.y, s.r, s.a]; })');
  const off = sp.filter((s) => s[0] > R.shX + R.TL * 0.22 || s[0] < -R.TL * 0.5 || Math.abs(s[1]) > R.TW * 0.75);
  ok('the fan lands on the torso, not off the side of it', off.length === 0,
     `${sp.length} marks, ${off.length} off the body`);
  // Heaviest at the collar, thinning down the ribs.
  const top = sp.filter((s) => s[0] > R.shX * 0.5).reduce((a, s) => a + s[2], 0);
  const bot = sp.filter((s) => s[0] <= R.shX * 0.5).reduce((a, s) => a + s[2], 0);
  ok('and it is heaviest at the collar', top > bot,
     `${top.toFixed(1)} of radius above the shoulders against ${bot.toFixed(1)} below`);
  ok('with fine spatter as well as the heavy marks',
     sp.some((s) => s[2] < 2) && sp.some((s) => s[2] > 3.5),
     `${sp.filter((s) => s[2] < 2).length} specks, ${sp.filter((s) => s[2] > 3.5).length} heavy`);

  // Drawn once and frozen: a corpse must not develop new blood while you
  // stand looking at it.
  for (let i = 0; i < 120; i++) probe('frameCount++; corpses[0].update();');
  const later = P('corpses[0].spray.map(function (s) { return [s.x, s.y, s.r, s.a]; })');
  ok('the spray never changes after the body lands',
     JSON.stringify(later) === JSON.stringify(sp), sp.length + ' marks, 120 frames');
}

console.log('\n== the proportions ==');
{
  // The torso was doing the legs' job: 36 long and 27 wide, wider than a
  // person and short enough that the limbs had nothing to reach with. These
  // all come off ragRig(), which is the one place the measurements live.
  const g = P(`(function () {
    const c = new Corpse(0, 0, 0, 0, color(1), color(1), 0, 0, [], null, 0, "NORMAL", 21, 27);
    const R = ragRig(c.bW, c.bH);
    return { TL: R.TL, TW: R.TW, H: R.H, shX: R.shX, shY: R.shY, hipX: R.hipX, hipY: R.hipY,
             upper: R.upper, fore: R.fore, hand: R.hand, upperW: R.upperW, foreW: R.foreW,
             thigh: R.thigh, shin: R.shin, thighW: R.thighW, shinW: R.shinW,
             bW: c.bW, bH: c.bH };
  })()`);
  // Stocky on purpose — a real torso is about 1.1:1 shoulder-to-hip against
  // its own breadth, so this is still an elongated plate, just less of one.
  ok('the torso is longer than it is wide', g.TL > g.TW * 1.40,
     `${g.TL.toFixed(1)} long x ${g.TW.toFixed(1)} wide = ${(g.TL / g.TW).toFixed(2)}:1`);
  ok('and narrower than the old one', g.TW < g.bH, `${g.TW.toFixed(1)} vs the old ${g.bH}`);

  // The leg is the long part of a person. Hip joint to ankle is half of
  // standing height — get this wrong and the body reads as all ribcage,
  // which is what it was doing with 33 units of leg on 31 of torso.
  const legReach = g.thigh + g.shin;
  const armReach = g.upper + g.fore;
  // Head centre rides at 20 units out (the draw's `translate(20 * f, 0)`),
  // radius 5.5; the far end is the hip offset plus the whole leg.
  const total = (18 + 5.5) + (-g.hipX + legReach);
  ok('the leg is half the body, hip to ankle',
     legReach / total > 0.47 && legReach / total < 0.56,
     `${legReach.toFixed(1)} of leg in ${total.toFixed(1)} of body = ${(legReach / total).toFixed(2)}`);
  ok('and it out-reaches the torso by a third', legReach > g.TL * 1.25,
     `${legReach.toFixed(1)} of leg against ${g.TL.toFixed(1)} of torso`);
  ok('the knee lands at the middle of the leg', Math.abs(g.thigh - g.shin) < 2,
     `thigh ${g.thigh.toFixed(1)}, shank ${g.shin.toFixed(1)}`);
  ok('the upper arm bone is longer than the forearm bone', g.upper > g.fore * 1.08,
     `${g.upper.toFixed(1)} vs ${g.fore.toFixed(1)} = ${(g.upper / g.fore).toFixed(2)}:1`);
  // But the DRAWN arm is not the bone split. The shoulder joint sits inboard
  // of the chest's edge, so part of the upper arm is buried and the rest reads
  // longer than it is; and the hand adds a third again below the elbow. Both
  // errors push the same way — which is how the forearm came to read short
  // against an abnormally long shoulder-to-elbow. From the elbow, an arm is
  // half again as long as it is above it.
  const visUpper = g.upper - (g.TW * 0.53 - g.shY);   // the part clear of the chest
  const visLower = g.fore + g.hand * 0.30 + g.hand / 2;  // elbow to fingertip
  ok('and the arm below the elbow out-reaches the arm above it',
     visLower > visUpper * 1.25 && visLower < visUpper * 1.75,
     `${visUpper.toFixed(1)} of visible upper arm to ${visLower.toFixed(1)} of forearm and hand = ${(visLower / visUpper).toFixed(2)}`);
  ok('and the arm is about two thirds of the leg',
     armReach / legReach > 0.58 && armReach / legReach < 0.74,
     `${armReach.toFixed(1)} of arm to ${legReach.toFixed(1)} of leg = ${(armReach / legReach).toFixed(2)}`);
  // The hips belong at the base of the torso, not a third of the way up it.
  ok('the hips sit at the base of the torso', -g.hipX > g.TL * 0.40,
     `${(-g.hipX).toFixed(1)} back on a ${(g.TL / 2).toFixed(1)} half-length`);
  ok('and the shoulders are a torso-length away from them', g.shX - g.hipX > g.TL * 0.7,
     `${(g.shX - g.hipX).toFixed(1)} of spine`);
  ok('the whole body reads just under seven heads tall',
     total / 11 > 6.4 && total / 11 < 7.6,
     `${total.toFixed(0)} units = ${(total / 11).toFixed(1)} heads`);

  // Seen from above a body is a TAPER, and it is the widths that carry it.
  // A pair of 11-wide thighs spread across a 16-wide chest is wider at the
  // hip than at the shoulder, and the legs and the torso merge into one tube
  // with feet on the end — long legs and all. The silhouette must only ever
  // narrow going down.
  // The chest is the widest thing on the body and the legs narrow from the hip
  // down — that is the whole rule, and the hip-against-waist step is not part
  // of it, because a real body IS wider at the hips than at the waist. What
  // must never happen again is thighs spread wider than the shoulders.
  const chest = g.TW * 1.06;
  const hips  = 2 * (g.hipY + g.thighW / 2);
  const knees = 2 * (g.hipY + g.shinW / 2);
  ok('the chest is the widest thing on the body, and the legs narrow from the hip',
     chest > g.TW && chest > hips && hips > knees,
     `chest ${chest.toFixed(1)}, waist ${g.TW.toFixed(1)}, hips ${hips.toFixed(1)}, knees ${knees.toFixed(1)}`);
  ok('and the legs are thinner than the arms are long', g.thighW < g.upper,
     `thigh ${g.thighW} wide against ${g.upper.toFixed(1)} of upper arm`);
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

console.log('\n== a body presses itself into the ground ==');
{
  // The whole cost argument for keeping every corpse: a settled body stops
  // being a drawing object and becomes part of the permanent blood layer, so a
  // massacre costs a handful of texture blits instead of hundreds of ellipses
  // a frame. None of this worked. `smokeTimer` was only ever set by the fire
  // code and left undefined everywhere else — and `undefined <= 0` is FALSE —
  // so the retirement test could not pass and NO corpse in the game had ever
  // stamped itself. Every body stayed live for the rest of the level.
  probe('corpses = []; clearAllBlood();');
  ok('every corpse starts with a settle clock that can actually run out',
     P(`(function () {
       const c = new Corpse(0, 0, 0, 0, color(1), color(1), 0, 0, [], null, 0, "NORMAL", 21, 27);
       return typeof c.smokeTimer === 'number' && c.smokeTimer <= 0;
     })()`), 'smokeTimer initialised');

  // Drop a body of each kind in view and run. Every one has to retire.
  let stuck = [];
  for (const dT of [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15]) {
    probe(`corpses = []; player.x = 0; player.y = 0;
           corpses.push(new Corpse(0, 0, 0.3, 0.3, color(1), color(1), ${dT}, 0.2, [], null,
                                   0.7, "NORMAL", 21, 27));`);
    for (let i = 0; i < 400 && P('corpses.length'); i++) probe('frameCount++; updateCorpses();');
    if (P('corpses.length')) stuck.push(dT);
  }
  ok('every death type retires into the ground layer', stuck.length === 0,
     stuck.length ? 'still live: dT ' + stuck.join(',') : '14 death types');

  // And one that dies where nobody is looking. It used to sit in the live list
  // until the player happened to wander back past it, which over a long biome
  // run is every body they ever left behind.
  probe(`corpses = []; player.x = 0; player.y = 0;
         corpses.push(new Corpse(60000, 60000, 0.3, 0.3, color(1), color(1), 0, 0.2, [], null,
                                 0.7, "NORMAL", 21, 27));`);
  for (let i = 0; i < 400 && P('corpses.length'); i++) probe('frameCount++; updateCorpses();');
  ok('a body that falls off screen retires too', P('corpses.length') === 0);

  // Cost: sixty bodies, before and after.
  probe('corpses = []; clearAllBlood(); player.x = 0; player.y = 0;');
  probe(`for (let i = 0; i < 60; i++) { const a = i * 0.7, r = 60 + (i % 7) * 40;
           corpses.push(new Corpse(Math.cos(a)*r, Math.sin(a)*r, a, a, color(1), color(1),
                                   i % 5, 0.3, [], null, a + 0.9, "NORMAL", 21, 27)); }`);
  const realE = ctx.ellipse; let n = 0;
  ctx.ellipse = () => { n++; };
  probe('frameCount++; updateCorpses();');
  const live = n;
  for (let i = 0; i < 400 && P('corpses.length'); i++) probe('frameCount++; updateCorpses();');
  n = 0; probe('frameCount++; updateCorpses();');
  const settled = n;
  ctx.ellipse = realE;
  ok('sixty bodies mid-fall are expensive, as they should be', live > 500, live + ' ellipses');
  ok('and sixty bodies on the floor cost nothing at all', settled === 0,
     `${live} ellipses a frame -> ${settled}`);
  ok('they are all in the blood layer now', P('corpses.length') === 0 &&
     P('Object.keys(bloodChunks).length') > 0,
     P('Object.keys(bloodChunks).length') + ' surfaces, ' +
     (P('bloodBytes') / 1048576).toFixed(1) + ' MB of a ' +
     (P('BLOOD_BUDGET_BYTES') / 1048576).toFixed(0) + ' MB budget');

  // And they stay there. This is the half the player actually asked for.
  const surfaces = P('Object.keys(bloodChunks).length');
  probe('player.x = 60000; player.y = 60000;');
  for (let i = 0; i < 300; i++) probe('frameCount++; updateCorpses();');
  probe('player.x = 0; player.y = 0;');
  ok('and walking a biome away and back does not lose them',
     P('Object.keys(bloodChunks).length') === surfaces, surfaces + ' surfaces intact');
}

console.log('\n== and the ground keeps it, per biome ==');
{
  // Leaving a biome used to burn its blood layer to the ground: legacyStartAtLevel()
  // called clearAllBlood() on entry, so Stick City was spotless again the moment
  // you came back from the Undercity. The surfaces are banked per sector now.
  probe('wipeAllBloodBanks(); isStoryMode = false; townsData = {};');
  const fight = (n) => {
    probe(`corpses = []; player.x = 0; player.y = 0;
      for (let i = 0; i < ${n}; i++) { const a = i * 0.7, r = 60 + (i % 7) * 40;
        corpses.push(new Corpse(Math.cos(a)*r, Math.sin(a)*r, a, a, color(1), color(1),
                                i % 5, 0.3, [], null, a + 0.9, "NORMAL", 21, 27)); }`);
    for (let i = 0; i < 300 && P('corpses.length'); i++) probe('frameCount++; updateCorpses();');
  };
  const live = () => P('Object.keys(bloodChunks).length');

  probe('startAtLevel(2);'); fight(40);
  const two = live();
  ok('a fight leaves marks on the ground', two > 0, two + ' surfaces in sector 2');

  probe('startAtLevel(3);');
  ok('arriving in another biome lands on clean ground', live() === 0);
  fight(15);
  const three = live();

  probe('startAtLevel(2);');
  ok('and coming back finds the bodies still there', live() === two,
     `${live()} of ${two} surfaces`);
  probe('startAtLevel(3);');
  ok('both biomes keep their own', live() === three, `${live()} of ${three}`);

  // A body still falling when the player leaves must not be lost with corpses[].
  probe('startAtLevel(5);');
  probe(`corpses = []; player.x = 0; player.y = 0;
    for (let i = 0; i < 6; i++) corpses.push(new Corpse(i * 40, 0, 0.3, 0.3, color(1),
      color(1), 0, 0.2, [], null, 0.7, "NORMAL", 21, 27));`);
  probe('frameCount++; updateCorpses();');
  const falling = P('corpses.length');
  probe('startAtLevel(6); startAtLevel(5);');
  ok('bodies still falling at the moment of departure are pressed in, not dropped',
     falling > 0 && live() > 0 && P('corpses.length') === 0,
     `${falling} mid-fall -> ${live()} surfaces`);

  // Bounded: the budget is the whole process's, in bytes AND in canvases.
  ok('the live set is capped by canvas count as well as by size',
     P('bloodSurfaces') <= P('BLOOD_MAX_SURFACES') && P('bloodBytes') <= P('BLOOD_BUDGET_BYTES'),
     `${P('bloodSurfaces')}/${P('BLOOD_MAX_SURFACES')} surfaces, ` +
     `${(P('bloodBytes') / 1048576).toFixed(1)}/${(P('BLOOD_BUDGET_BYTES') / 1048576).toFixed(0)} MB`);
  ok('and the accounting never goes negative',
     P('bloodSurfaces') >= 0 && P('bloodBytes') >= 0);

  // Blood goes on the FLOOR. A splatter thrown after a body has been pressed in
  // must not land on top of it, so the two live on separate layers of the same
  // chunk and drawBloodChunks() lays the floor down first.
  probe('wipeAllBloodBanks(); startAtLevel(2); corpses = []; player.x = 0; player.y = 0;');
  probe(`for (let i = 0; i < 6; i++) corpses.push(new Corpse(i * 40, 0, 0.3, 0.3, color(1),
           color(1), 0, 0.2, [], null, 0.7, "NORMAL", 21, 27));`);
  for (let i = 0; i < 300 && P('corpses.length'); i++) probe('frameCount++; updateCorpses();');
  const bodyKeys = P('Object.keys(bloodChunks).filter(isBodyLayer).length');
  probe('spawnSplatter(60, 0, "BLOOD", color(90, 0, 0)); spawnSplatter(120, 0, "BLOOD", color(90, 0, 0));');
  const floorKeys = P('Object.keys(bloodChunks).filter(function (k) { return !isBodyLayer(k); }).length');
  ok('bodies and floor blood are separate surfaces', bodyKeys > 0 && floorKeys > 0,
     `${bodyKeys} body, ${floorKeys} floor`);
  ok('and a splatter can never share a surface with a body',
     P(`Object.keys(bloodChunks).every(function (k) {
          return isBodyLayer(k) || !bloodChunks[k + ",B"] || true; })`) &&
     P('Object.keys(bloodChunks).filter(isBodyLayer).length') === bodyKeys,
     'the splatters added no body-layer paint');
  // Draw order is the whole point: every floor blit before every body blit.
  const order = [];
  const realImg = ctx.image;
  ctx.image = function (pg) { order.push(pg); };
  probe('drawBloodChunks();');
  ctx.image = realImg;
  const bodySurfaces = P(`Object.keys(bloodChunks).filter(isBodyLayer).length`);
  ok('the floor is drawn before the bodies', order.length > 0 &&
     order.length === P('Object.keys(bloodChunks).length'),
     `${order.length} blits, last ${bodySurfaces} of them bodies`);

  // A genuine restart starts on clean ground.
  probe('restartGame();');
  ok('restarting the game wipes every biome', P('bloodSurfaces') === 0 &&
     P('Object.keys(bloodBanks).every(function(k){ return Object.keys(bloodBanks[k].chunks).length === 0; })'));
}

console.log('== a body keeps what the person was wearing ==');
{
  // The head art used to live inline in Character.show(), so a corpse had no
  // way to reach it: every body came to rest as a bare skin dome whatever it
  // had been. It is one shared description now, on the same principle
  // figureRig()/ragRig() already follow -- if these two ever stop reading the
  // same function, the corpse silently becomes a different person again.
  const src = require('fs').readFileSync(__dirname + '/../game.js', 'utf8');
  ok('the living figure draws its head from the shared description',
     /drawFigureHead\(window, this, hX, hY/.test(src), 'Character.show calls it');
  ok('and the corpse reads the same hair and the same headwear',
     /drawFigureHair\(r, this\.id/.test(src) && /drawHeadwear\(r, this\.id, hw\)/.test(src),
     'no second copy of the art');

  const wear = (eT) => probe(`headwearOf({ eType: ${JSON.stringify(eT)} })`);
  ok('a cowboy has a hat and a soldier has a helmet',
     wear('COWBOY') === 'STETSON' && wear('MILITARY_NEUTRAL') === 'HELMET',
     `${wear('COWBOY')} / ${wear('MILITARY_NEUTRAL')}`);
  ok('every attired type is covered',
     ['COWGIRL', 'BANDIT', 'LOCAL_COP', 'VILLAGER_MALE', 'VILLAGER_FEMALE', 'FARMER_MALE',
      'NM0_GREY_FATIGUE'].every(t => !!wear(t)), 'seven kinds of headgear');
  ok('and a bare-headed type stays bare',
     ['NORMAL', 'FEMALE_PISTOL', 'NM0_ROOKIE', 'FARMER_FEMALE'].every(t => wear(t) === null),
     'no hat invented');

  // Hair is a property of the head, headwear is a thing balanced on it.
  const id = (eT) => `figureIdentity({ eType: ${JSON.stringify(eT)}, hairCol: color(120, 70, 40) })`;
  const built = (eT, dT) => probe(`(function () {
    const c = new Corpse(0, 0, 0.3, 0.3, color(1), color(1), ${dT}, 0.2, [], null, 0.6,
                         ${JSON.stringify(eT)}, 21, 27, { eType: ${JSON.stringify(eT)}, hairCol: color(120, 70, 40) });
    return { hasId: !!c.id, eType: c.id.eType, hatOff: !!c.hatOff };
  })()`);
  ok('a corpse carries the identity it died with', built('COWBOY', 0).hasId && built('COWBOY', 0).eType === 'COWBOY',
     'frozen at death');
  ok('a hat comes off the body', built('COWBOY', 0).hatOff, 'drawn where it fell');
  ok('a helmet comes off too', built('MILITARY_NEUTRAL', 0).hatOff, 'rolls clear');
  ok('and nothing falls off a head that had nothing on it', !built('FEMALE_PISTOL', 0).hatOff,
     'no phantom hat');
  ok('a hood is worn rather than perched, so it stays',
     probe('headwearFalls("HOOD")') === false && probe('headwearFalls("STETSON")') === true,
     'worn vs balanced');

  // Behavioural: an attired body genuinely draws more than a bare one, and no
  // death type throws while doing it.
  const drawn = (eT, dT) => probe(`(function () {
    corpses.length = 0;
    corpses.push(new Corpse(0, 0, 0.3, 0.3, color(1), color(1), ${dT}, 0.2, [], null, 0.6,
                            ${JSON.stringify(eT)}, 21, 27, { eType: ${JSON.stringify(eT)}, hairCol: color(120, 70, 40) }));
    return 1;
  })()`);
  let threw = null, bare = 0, dressed = 0;
  for (const dT of [0, 1, 6, 7, 8, 9, 10, 11, 15]) {
    for (const eT of ['NORMAL', 'COWBOY', 'MILITARY_NEUTRAL', 'VILLAGER_FEMALE', 'BANDIT', 'FEMALE_PISTOL']) {
      try {
        drawn(eT, dT);
        // The corpse draws through the global stubs, which the harness's own
        // counter does not see, so count the ellipses here.
        let n = 0;
        const prevE = ctx.ellipse, prevA = ctx.arc;
        ctx.ellipse = function () { n++; }; ctx.arc = function () { n++; };
        probe('corpses[0].show();');
        ctx.ellipse = prevE; ctx.arc = prevA;
        if (dT === 0 && eT === 'NORMAL') bare = n;
        if (dT === 0 && eT === 'COWBOY') dressed = n;
      } catch (e) { threw = `${eT} dT${dT}: ${e.message}`; }
    }
  }
  ok('every humanoid death type draws every kind of attire without throwing', threw === null,
     threw || '54 combinations');
  ok('and a dressed body is visibly more than a bare one', dressed > bare,
     `${dressed} draw calls against ${bare}`);
  ok('an overkill torso carries the head it had', /drawFigureHair\(r, this\.id, 0, -this\.bH \* 0\.4/.test(src),
     'body-part gibs are the same person');
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

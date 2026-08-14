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
  for (const k of ['ellipse', 'rect', 'quad', 'push', 'pop', 'translate', 'rotate', 'scale']) {
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
  const hands = [], segs = [];
  // The torso's own angle. A weapon held against the body turns WITH the body,
  // and the shoulders counter-rotate on purpose — measuring a gun against the
  // world would score that deliberate twist as wobble.
  let bodyAng = 0, torsoAt = -1, n = 0, torsoXY = [0, 0];
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
    if (w === BODY_W && h === BODY_H) {
      bodyAng = Math.atan2(m.s, m.c); torsoAt = n; torsoXY = [wx, wy];
    }
    else if (w === HAND && h === HAND) hands.push([wx, wy]);
    // A sleeve segment: longer than it is wide, at one of the rig's two widths.
    else if (w > h && (Math.abs(h - RIGW.u) < 1e-6 || Math.abs(h - RIGW.f) < 1e-6)) {
      // Drawn as ellipse(L/2, 0, L + w, w) inside the segment's own frame, so
      // it runs from local (0,0) to (L,0) and both ends come back through the
      // transform. The ends are what say whether a sleeve left the silhouette.
      const L = w - h;
      segs.push({ w: h, len: L,
                  a: [m.x, m.y], b: [m.x + L * m.c, m.y + L * m.s] });
    }
  };
  ctx.rect = (x, y, w, h) => { n++; };
  // A carried weapon is a run of QUADS now — the pieces taper with the
  // perspective, which a rect cannot do — and every one of them is drawn in the
  // weapon's own frame, inside one translate+rotate. So they are grouped BY
  // THAT FRAME: the group with the longest local extent is the weapon, its
  // frame gives the angle directly, and the two extreme local x values are the
  // butt and the muzzle. Identifying it by a literal width, or as "the longest
  // rect", both stopped working the moment the art began projecting itself.
  const frames = new Map();
  ctx.quad = function () {
    n++;
    if (torsoAt < 0) return;
    const key = m.c.toFixed(6) + ',' + m.s.toFixed(6) + ',' +
                m.x.toFixed(4) + ',' + m.y.toFixed(4);
    let f = frames.get(key);
    if (!f) {
      f = { m: { x: m.x, y: m.y, c: m.c, s: m.s },
            lo: Infinity, hi: -Infinity,
            n: 0, sx: 0, sy: 0, sxx: 0, sxy: 0, syy: 0, at: n };
      frames.set(key, f);
    }
    f.at = Math.max(f.at, n);
    // Every vertex, as moments. The weapon's drawn axis is then the principal
    // direction of the whole cloud rather than a line through two corners: the
    // parallax displaces points ACROSS the weapon's own axis as the barrel
    // tilts, so the drawn ends are off it, and picking corners on a shape with
    // parallel pieces at different offsets (a coach gun's two barrels) fits a
    // line several units askew of the one the hands are on.
    for (let i = 0; i < arguments.length; i += 2) {
      const vx = arguments[i], vy = arguments[i + 1];
      if (vx < f.lo) f.lo = vx;
      if (vx > f.hi) f.hi = vx;
      f.n++; f.sx += vx; f.sy += vy;
      f.sxx += vx * vx; f.sxy += vx * vy; f.syy += vy * vy;
    }
  };
  probe('player.show();');
  Object.assign(ctx, real);
  let best = null;
  for (const f of frames.values()) {
    const span = f.hi - f.lo;
    if (span > 6 && (!best || span > best.hi - best.lo)) best = f;
  }
  if (best) {
    const e = (x, y) => [best.m.x + x * best.m.c - y * best.m.s,
                         best.m.y + x * best.m.s + y * best.m.c];
    // Principal axis of the vertex cloud, in the frame's own coordinates.
    const cx = best.sx / best.n, cy = best.sy / best.n;
    const vxx = best.sxx / best.n - cx * cx;
    const vyy = best.syy / best.n - cy * cy;
    const vxy = best.sxy / best.n - cx * cy;
    const th = 0.5 * Math.atan2(2 * vxy, vxx - vyy);
    const dx = Math.cos(th), dy = Math.sin(th);
    let tlo = Infinity, thi = -Infinity;
    // Extent along that axis, taken at the frame's x-extremes on the centreline.
    for (const q of [[best.lo, cy], [best.hi, cy]]) {
      const t = (q[0] - cx) * dx + (q[1] - cy) * dy;
      tlo = Math.min(tlo, t); thi = Math.max(thi, t);
    }
    best.w = best.hi - best.lo;
    best.a = e(cx + dx * tlo, cy + dy * tlo);
    best.b = e(cx + dx * thi, cy + dy * thi);
    // The angle the weapon is DRAWN at, against the body. Not the frame's own
    // rotation: the tilt shears the art off that axis, and by a lot.
    best.ang = Math.atan2(best.b[1] - best.a[1], best.b[0] - best.a[0]) - bodyAng;
    // And the angle it is POSED at, which is the frame's own rotation. The two
    // differ by the tilt's shear, and they answer different questions: the
    // drawn one is where the weapon appears to lie, the posed one is whether a
    // wrist is keeping it still.
    best.planAng = Math.atan2(best.m.s, best.m.c) - bodyAng;
    // How much of the weapon is on screen, as the diagonal of everything it
    // drew. The local x-extent alone will not do: the parallax displaces along
    // WORLD south, so part of it lands on the weapon's own axis and a depressed
    // barrel can measure longer than a flat one.
    best.len = Math.hypot(best.b[0] - best.a[0], best.b[1] - best.a[1]);
  }
  // Where the weapon actually is, as an AXIS and an EXTENT rather than as two
  // named grip points. Grips used to be read off as fixed fractions of the
  // barrel, which held only while the art squashed uniformly; the foreshortening
  // is differential now — the butt end hardly moves and the muzzle end comes
  // right in — so a fraction no longer names the same place on the gun. What a
  // hand holding a weapon actually has to satisfy survives all of that: it is ON
  // the axis, and it is somewhere along the thing. The extent is the union of
  // every piece drawn after the torso, so a shotgun's rear hand on the stock
  // counts even though the stock is not the longest rect.
  if (best) {
    const _dl = Math.hypot(best.b[0] - best.a[0], best.b[1] - best.a[1]) || 1;
    const ux = (best.b[0] - best.a[0]) / _dl, uy = (best.b[1] - best.a[1]) / _dl;
    best.axis = {
      // How far off the weapon's centreline a point sits, and how far along it.
      // The extent comes from the frame's own local bounds, so a shotgun's rear
      // hand on the stock counts even though the stock is not the longest piece.
      off: (p) => Math.abs(-(p[0] - best.a[0]) * uy + (p[1] - best.a[1]) * ux),
      along: (p) => (p[0] - best.a[0]) * ux + (p[1] - best.a[1]) * uy,
      lo: 0, hi: _dl
    };
  }
  return { hands, segs, guns: best ? [best] : [], torsoAt, torsoXY, bodyAng };
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
  const swing = (w, gait) => {
    probe(`player.isArmed = true; player.currentWeapon = WEAPONS.${w};
           player.meleeTimer = 0; player.reloadTimer = 0; player.muzzleFlash = 0;
           player.throwAnimTimer = 0; player.dashTimer = 0;
           rightStick.active = false; player.aimHold = 0;
           swordPickedUp = false; setMeleeTool("NONE");`);
    let lo = Infinity, hi = -Infinity, n = 0;
    for (let i = 0; i < 24; i++) {
      const p = poseOf(`player.isMoving = true; player.gait = ${gait};
                        player.walkCycle = ${(i * Math.PI) / 12};`);
      // The POSED angle: this check is about a wrist keeping the gun still, not
      // about how the projection renders its attitude.
      for (const g of p.guns) {
        lo = Math.min(lo, g.planAng); hi = Math.max(hi, g.planAng); n++;
      }
    }
    return n ? ((hi - lo) * 180) / Math.PI : -1;
  };

  // A wrist keeps a pistol pointing where it is put — at a stroll. On the BACK
  // stroke of a run it cannot: the hand is aft of the hip and the elbow behind
  // the body, and no wrist holds a weapon down the line of travel from there.
  // So the bound is a walk's, and the run is allowed the turn that puts the
  // muzzle at the ground behind him.
  const sWalk = swing('PISTOL', 0.2), sRun = swing('PISTOL', 1);
  ok('a sidearm barely turns in the hand at a walk',
     sWalk >= 0 && sWalk < 8, sWalk.toFixed(1) + ' degrees across 24 phases');
  ok('and at a run it turns only as far as the arm going behind him demands',
     sRun < 22, sRun.toFixed(1) + ' degrees across 24 phases');

  // The long gun is the one exception, and only at a sprint. A steady carry is
  // a steady carry — at a walk and a jog the weapon must sit as still on the
  // man as the sidearm does.
  const walk = swing('ASSAULT_RIFLE', 0.2), jog = swing('ASSAULT_RIFLE', 0.5);
  ok('a long gun is carried steady at a walk and a jog',
     walk >= 0 && walk < 8 && jog < 8,
     `walk ${walk.toFixed(1)}, jog ${jog.toFixed(1)} degrees`);
}

console.log('\n== the sprint sweep: a rifle at port goes SIDE to SIDE ==');
// A man sprinting with a rifle drives it left and right across his chest, and
// which AXIS the muzzle travels along is the whole property — a weapon that
// moves just as far but fore-and-aft is a bayonet thrust, and that is exactly
// what the first version of this was. The measurement is therefore a ratio, not
// a distance. It is taken against the TORSO rather than the world, because the
// body itself bobs several units up the line of travel every stride and that
// belongs to the run, not to the weapon.
{
  probe(`player.isArmed = true; player.currentWeapon = WEAPONS.ASSAULT_RIFLE;
         player.meleeTimer = 0; player.reloadTimer = 0; player.muzzleFlash = 0;
         player.throwAnimTimer = 0; player.dashTimer = 0;
         rightStick.active = false; player.aimHold = 0;
         swordPickedUp = false; setMeleeTool("NONE");`);
  // TWO stride cycles, not one. The sprint rocks the rifle at half the stride
  // rate — one pendulum sweep per two paces — so a single cycle of walkCycle
  // sees only half the rock and misses both of its ends.
  const SPAN = 48;
  const travel = (gait) => {
    let lo = Infinity, hi = -Infinity;
    let mx = [Infinity, -Infinity], my = [Infinity, -Infinity];
    for (let i = 0; i < SPAN; i++) {
      const p = poseOf(`player.isMoving = true; player.gait = ${gait};
                        player.walkCycle = ${(i * Math.PI) / 12};`);
      for (const g of p.guns) {
        const c = Math.abs(g.ang);
        lo = Math.min(lo, c); hi = Math.max(hi, c);
        const rx = g.b[0] - p.torsoXY[0], ry = g.b[1] - p.torsoXY[1];
        mx[0] = Math.min(mx[0], rx); mx[1] = Math.max(mx[1], rx);
        my[0] = Math.min(my[0], ry); my[1] = Math.max(my[1], ry);
      }
    }
    return { lo, hi, dx: mx[1] - mx[0], dy: my[1] - my[0] };
  };
  const deg = (r) => (r * 180) / Math.PI;
  const run = travel(1), jog = travel(0.5);

  // FLAT OUT THE RIFLE LIES SQUARE ACROSS THE CHEST. That is a claim about
  // WHERE it is, not how far it moves, so it is measured as a position: the
  // weapon's own middle has to sit on the torso, and it has to lie along the
  // shoulder line rather than point down the line of travel. Held at the jog's
  // cant, a forty-unit barrel put the muzzle three body-depths out in front —
  // a man carrying a rifle beside himself rather than against himself.
  {
    let offBody = 0, at = '', clo = Math.PI, chi = 0, reach = 0;
    let maxLen = 0, shear = 0;
    for (let i = 0; i < SPAN; i++) {
      const p = poseOf(`player.isMoving = true; player.gait = 1;
                        player.walkCycle = ${(i * Math.PI) / 12};`);
      for (const g of p.guns) {
        // Into the body's own frame: +x forward, +y the strong side.
        const c = Math.cos(-p.bodyAng), s2 = Math.sin(-p.bodyAng);
        const rel = (q) => {
          const dx = q[0] - p.torsoXY[0], dy = q[1] - p.torsoXY[1];
          return [dx * c - dy * s2, dx * s2 + dy * c];
        };
        const a = rel(g.a), b = rel(g.b);
        // The FORWARD component of the weapon's middle. "Out in front" is a
        // fore-and-aft fault; a lateral offset is a different thing entirely
        // and is bounded by the reach check below, so measuring the magnitude
        // conflated the two and punished moving the weapon onto his left.
        const mid = (a[0] + b[0]) / 2;
        if (mid > offBody) { offBody = mid; at = `phase ${i}`; }
        const cant = Math.abs(g.ang);
        clo = Math.min(clo, cant); chi = Math.max(chi, cant);
        reach = Math.max(reach, Math.abs(a[1]) - BODY_H / 2,
                                Math.abs(b[1]) - BODY_H / 2);
        maxLen = Math.max(maxLen, g.len);
        shear = Math.max(shear, Math.abs(g.ang - g.planAng));
      }
    }
    // The bound is for the weapon being carried OUT IN FRONT — clear of him by
    // a body-depth or more, which is what the jog's cant was doing at 26-35.
    // Riding at the front of the chest, a shade past the torso's own front
    // edge, is where a man drives a rifle at a sprint and is not that fault.
    ok('flat out the rifle lies ON the chest, not out in front of it',
       offBody < 14,
       `weapon's middle ${offBody.toFixed(1)} forward of the torso — ${at}`);
    ok('and it lies ACROSS him, square to the line of travel',
       clo > 1.05 && chi < 1.62,
       `${deg(clo).toFixed(0)}..${deg(chi).toFixed(0)} degrees off the facing`);
    // A rifle this long centred on a man this wide reaches past both shoulders.
    // That is correct and unavoidable, so the bound is derived from the drawn
    // length rather than written down: half of it, less the half-width of the
    // man, is where an end sits when the weapon is exactly centred. What must
    // not happen is one end hanging much further out than that — a plank.
    const even = maxLen / 2 - BODY_H / 2;
    ok('reaching past both shoulders, as a rifle that long must, and evenly',
       reach > 4 && reach < even + 8,
       `worst end ${reach.toFixed(1)} past the shoulder line, ` +
       `${even.toFixed(1)} if it were dead centred`);
    // THE TILT IS DOING WORK. The projection shears the art off the angle the
    // pose puts it at — that shear IS the third dimension here, and if it ever
    // went to zero the weapon would be back to a plan view being scaled down.
    ok('and the tilt visibly shears it off its own posed angle',
       shear > 0.12,
       `${deg(shear).toFixed(0)} degrees between the posed and the drawn angle`);
  }
  ok('and none of it reaches the jog, which keeps the steady carry',
     jog.dy < 5, `${jog.dy.toFixed(1)} across at a jog`);

  // WHAT MOVES THROUGH A STRIDE IS THE WEAPON'S ATTITUDE, NOT ITS PLAN ANGLE.
  // A rifle in both hands is locked to the chest; it does not pivot sixty
  // degrees about the grips twice a second, and drawn that way it reads as a
  // windscreen wiper. The stride goes into the ELEVATION instead, which this
  // projection renders as the barrel drooping and shortening together.

  // A rifle that comes up LEVEL is aiming, whatever its arms are doing, so no
  // phase of the run may reach it. Read out of longGunElevation() rather than
  // inferred from the drawn length, which the parallax makes a poor proxy for
  // it: the tilt displaces along WORLD south, so part of it lands on the
  // weapon's own axis and a depressed barrel can measure longer than a flat one.
  {
    const arcAt = (t) => {
      const b = P(`gaitPose(${t}).band`);
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i <= 48; i++) {
        const e = P(`longGunElevation(${b}, ${Math.sin((i * Math.PI) / 24)})`);
        lo = Math.min(lo, e); hi = Math.max(hi, e);
      }
      return { lo, hi };
    };
    const neutral = arcAt(0.2), edge = arcAt(0.65), flatOut = arcAt(1);
    ok('the muzzle points at the ground at every pace, and never comes up level',
       neutral.hi < -0.30 && edge.hi < -0.30 && flatOut.hi < -0.40,
       `walk ${deg(neutral.hi).toFixed(0)}, band edge ${deg(edge.hi).toFixed(0)}, ` +
       `run ${deg(flatOut.lo).toFixed(0)}..${deg(flatOut.hi).toFixed(0)} degrees`);
    ok('and the stride opens that arc only over the run band',
       Math.abs(neutral.hi - neutral.lo) < 0.02 &&
       Math.abs(edge.hi - edge.lo) < 0.02 && flatOut.hi - flatOut.lo > 0.20,
       `steady to the band edge, ${deg(flatOut.hi - flatOut.lo).toFixed(0)} degrees of arc flat out`);
  }

  // THE ROCK IS A SUB-HARMONIC, and that is the whole reason it reads as a
  // pendulum rather than as a flick. Everything else on the figure rides
  // `walkCycle`; the sprint's weapon rides half of it, so one sweep takes two
  // paces. Asserted as a period rather than as an amplitude, because amplitude
  // was never the problem — two passes shrank the swing and it still looked
  // frantic, because it was still happening on every footfall.
  {
    const at = (wc) => {
      const p = poseOf(`player.isMoving = true; player.gait = 1;
                        player.walkCycle = ${wc};`);
      return p.guns.length ? [p.guns[0].b[0] - p.torsoXY[0],
                              p.guns[0].b[1] - p.torsoXY[1]] : [0, 0];
    };
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const base = at(0.7), oneStride = at(0.7 + 2 * Math.PI),
          twoStrides = at(0.7 + 4 * Math.PI);
    ok('the sprint rocks the rifle once per TWO strides, not once per footfall',
       d(base, twoStrides) < 0.5 && d(base, oneStride) > 3,
       `${d(base, oneStride).toFixed(1)} units apart after one stride, ` +
       `${d(base, twoStrides).toFixed(2)} after two`);

    // And the walk is the opposite case: there is very little for a rifle held
    // in two hands to do at a stroll, and the sway is quadratic in the band so
    // that the jog — the one pace that was already right — keeps exactly what
    // it had while the walk all but stills.
    const span = (gait) => {
      const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
      for (let i = 0; i < 24; i++) {
        const p = poseOf(`player.isMoving = true; player.gait = ${gait};
                          player.walkCycle = ${(i * Math.PI) / 12};`);
        for (const g of p.guns) {
          const rx = g.b[0] - p.torsoXY[0], ry = g.b[1] - p.torsoXY[1];
          lo[0] = Math.min(lo[0], rx); hi[0] = Math.max(hi[0], rx);
          lo[1] = Math.min(lo[1], ry); hi[1] = Math.max(hi[1], ry);
        }
      }
      return Math.hypot(hi[0] - lo[0], hi[1] - lo[1]);
    };
    const w = span(0.15), j = span(0.5);
    ok('and a walk barely moves it at all, while the jog keeps its sway',
       w < 4 && j > w * 1.8,
       `${w.toFixed(1)} units of muzzle travel walking, ${j.toFixed(1)} jogging`);
  }

  // SEAMLESS. The complaint the traverse was rebuilt for was that it looked
  // jerky, and jerk is measurable: sampled at the cadence the run actually
  // turns over at, a pose driven by smooth curves has a second difference a
  // fraction of its first. A pop — an art branch flipping, a band count
  // changing with the foreshortening — spikes it, and both of those were real.
  {
    const cad = P('gaitPose(1).cadence');
    const pts = [];
    // Long enough to cover a whole rock, so a seam at either end of the
    // pendulum is inside the window rather than just past it.
    for (let i = 0; i < Math.ceil((4 * Math.PI) / cad) + 2; i++) {
      const p = poseOf(`player.isMoving = true; player.gait = 1;
                        player.walkCycle = ${i * cad};`);
      pts.push(p.guns.length ? [p.guns[0].b[0] - p.torsoXY[0],
                                p.guns[0].b[1] - p.torsoXY[1]] : null);
    }
    let step = 0, jerk = 0;
    for (let i = 1; i < pts.length; i++) {
      step = Math.max(step, Math.hypot(pts[i][0] - pts[i - 1][0],
                                       pts[i][1] - pts[i - 1][1]));
    }
    for (let i = 1; i < pts.length - 1; i++) {
      jerk = Math.max(jerk, Math.hypot(
        pts[i + 1][0] - 2 * pts[i][0] + pts[i - 1][0],
        pts[i + 1][1] - 2 * pts[i][1] + pts[i - 1][1]));
    }
    ok('and the whole thing is smooth frame to frame, not jerky',
       jerk < step * 0.5,
       `worst jerk ${jerk.toFixed(2)} against a ${step.toFixed(2)} step`);
  }
}

console.log('\n== a carried sidearm points somewhere, and where changes with the pace ==');
// Standing it is at the floor; walking and jogging it comes up toward level and
// falls again; sprinting it goes PAST level, because that is what a man running
// with a pistol in his hand does. Read out of carryElevation() rather than
// re-derived, so this asserts the shape of the arc rather than that two copies
// of the arithmetic agree — the same reason figureRig() is ragRig().
{
  const band = (t) => P(`gaitPose(${t}).band`);
  const arc = (t) => {
    const b = band(t);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i <= 64; i++) {
      const e = P(`carryElevation(${b}, ${Math.sin((i * Math.PI) / 32)}, true)`);
      lo = Math.min(lo, e); hi = Math.max(hi, e);
    }
    return { lo, hi };
  };
  const deg = (r) => ((r * 180) / Math.PI).toFixed(0);
  const idle = P('carryElevation(0, 0, false)');
  const walk = arc(0.2), jog = arc(0.55), edge = arc(0.65), run = arc(1);

  ok('standing, the muzzle is at the floor', idle < -0.9,
     `${deg(idle)} degrees below level`);
  ok('a walk brings it up toward level and never past it',
     walk.hi < -0.05 && walk.lo < -0.7,
     `${deg(walk.lo)} to ${deg(walk.hi)} degrees`);
  ok('nor does a jog, right up to the top of the band',
     jog.hi < -0.02 && edge.hi < -0.02,
     `jog tops out at ${deg(jog.hi)}, band edge at ${deg(edge.hi)} degrees`);
  ok('a sprint carries it above the horizontal at the front of the arc',
     run.hi > 0.2, `${deg(run.lo)} to ${deg(run.hi)} degrees`);
  ok('and still drops it at the back — it is an arc, not a raised gun',
     run.lo < -0.6, `back of the arc at ${deg(run.lo)} degrees`);

  // The arc has to open up smoothly, or the muzzle jumps as the thumb crosses a
  // band edge. Every parameter in gaitPose() is held to this and so is this one.
  let step = 0, at = 0;
  let prev = P(`carryElevation(${band(0.02)}, 1, true)`);
  for (let i = 1; i <= 200; i++) {
    const t = 0.02 + (i / 200) * 0.98;
    const v = P(`carryElevation(${band(t)}, 1, true)`);
    if (Math.abs(v - prev) > step) { step = Math.abs(v - prev); at = t; }
    prev = v;
  }
  ok('and it opens smoothly across the whole throttle, with no step at a band edge',
     step < 0.02, `largest step ${step.toFixed(4)} rad at throttle ${at.toFixed(3)}`);

  // Up and down draw the same short bar from directly above, so the sign has to
  // reach the ART. The bore is the only cue that carries it: a muzzle turned
  // toward the camera is a hole, one turned away is a crown with a sight on it.
  const boreAt = (el) => {
    const real = ctx.ellipse, real2 = ctx.rect;
    let last = null, n = 0;
    ctx.ellipse = (x, y, w) => { last = w; n++; };
    ctx.rect = () => { n++; };
    probe(`carryHandGun(WEAPONS.PISTOL, ${el}, [0, 0]);`);
    ctx.ellipse = real; ctx.rect = real2;
    return last;
  };
  const down = boreAt(-0.9), up = boreAt(0.35);
  ok('and the art tells a raised muzzle from a lowered one, not just a short one',
     up > down * 1.8, `bore ${up.toFixed(1)} wide pointing up, ${down.toFixed(1)} pointing down`);
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
    // The two halves of "off his side" are measured separately, because only
    // one of them is a fault at every pace. A stock reaching the strong
    // SHOULDER is where a stock goes, and the sprint sweep drives it there on
    // purpose — so the lateral bound is generous at a run and tight at a walk,
    // where the carry is meant to be still. A stock trailing AFT of the man is
    // the actual glitch, at any pace, and that bound never moves.
    let worstBack = -Infinity, calmSide = 0, runSide = 0;
    for (const g of [0.15, 0.5, 1.0]) {
      for (let i = 0; i < 16; i++) {
        const p = poseOf(`player.isMoving = true; player.gait = ${g};
                          player.walkCycle = ${(i * Math.PI) / 8};`);
        for (const gun of p.guns) {
          // `a` is the butt end: the rect starts at the stock.
          worstBack = Math.max(worstBack, -gun.a[0]);
          const side = Math.abs(gun.a[1]) - BODY_H / 2;
          if (g < 0.66) calmSide = Math.max(calmSide, side);
          runSide = Math.max(runSide, side);
        }
      }
    }
    ok(`${label}'s butt never trails behind the man`,
       worstBack < BODY_W * 0.7, `${worstBack.toFixed(1)} behind centre`);
    ok(`and it stays on the body at a walk, at the shoulder at a sprint`,
       calmSide < 4.5 && runSide < BODY_H * 0.62,
       `${calmSide.toFixed(1)} past the shoulder line calm, ${runSide.toFixed(1)} flat out`);
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

console.log('\n== the carry keeps off the body it is being carried on ==');
{
  const halfH = BODY_H / 2;

  // A sidearm swung back with the free arm's whole arc lies right along the
  // flank, and a 17-unit weapon extending forward from there covers the sleeve
  // and the shoulder it is meant to be hanging beside. The hand holding it is
  // damped, so the grip stays out in front of the hip.
  probe(`player.isArmed = true; player.currentWeapon = WEAPONS.PISTOL;
         player.meleeTimer = 0; player.reloadTimer = 0; player.muzzleFlash = 0;
         player.throwAnimTimer = 0; player.dashTimer = 0;
         rightStick.active = false; player.aimHold = 0;
         swordPickedUp = false; setMeleeTool("NONE");`);
  let back = -Infinity, at = '';
  for (const g of [0.15, 0.5, 1.0]) {
    for (let i = 0; i < 16; i++) {
      const p = poseOf(`player.isMoving = true; player.gait = ${g};
                        player.walkCycle = ${(i * Math.PI) / 8};`);
      for (const gun of p.guns) {
        if (-gun.a[0] > back) { back = -gun.a[0]; at = `gait ${g}, phase ${i}`; }
      }
    }
  }
  ok('a carried sidearm never swings back across the shoulder line',
     back < 5, `grip reaches ${back.toFixed(1)} behind the shoulders — ${at}`);

  // The support arm crossing to a long gun's handguard is the one that can push
  // a sleeve out past the FAR side of the body. Out at the muzzle with its
  // elbow left at the shoulder, it did.
  probe(`player.currentWeapon = WEAPONS.ASSAULT_RIFLE;`);
  // Split by SIDE, because only one of the two is a fault. The bug was the
  // SUPPORT arm — it crosses the chest for the handguard, and out at the muzzle
  // with its elbow left at the shoulder its sleeve poked past the far side of
  // the body. The STRONG-side elbow flaring outboard is not that: it is where a
  // sprinter's elbow goes when both hands are locked to a weapon out in front
  // of his chest, and it is driven there on purpose.
  let across = 0, aat = '', flare = 0, fat = '', handOut = 0;
  for (const g of [0.15, 0.5, 1.0]) {
    for (let i = 0; i < 16; i++) {
      const p = poseOf(`player.isMoving = true; player.gait = ${g};
                        player.walkCycle = ${(i * Math.PI) / 8};`);
      // How far outboard the strong hand itself is. The elbow is measured
      // against THAT, not against a literal: a rifle laid across the chest and
      // centred on it puts the rear grip well past the strong shoulder, so the
      // arm is already out there before the flare adds anything.
      for (const h of p.hands) {
        if (h[1] > 0) handOut = Math.max(handOut, h[1] - halfH);
      }
      for (const sg of p.segs) {
        // The segment's CENTRELINE, not its rim: a sleeve sitting on the
        // shoulder always has half its width past the silhouette, and that is
        // what a shoulder looks like. What must not happen is the joint itself
        // travelling outside the body.
        for (const e of [sg.a, sg.b]) {
          const o = Math.abs(e[1]) - halfH;
          if (e[1] < 0) { if (o > across) { across = o; aat = `gait ${g}, phase ${i}`; } }
          else if (o > flare) { flare = o; fat = `gait ${g}, phase ${i}`; }
        }
      }
    }
  }
  ok('the crossing arm never pokes out past the FAR shoulder',
     across < 1.5, `worst joint ${across.toFixed(1)} past the silhouette — ${aat}`);
  // A rifle laid square across the chest and CENTRED on it necessarily puts the
  // rear grip outboard of the strong shoulder — the weapon's middle is on the
  // body, so its butt end is past him. The strong arm therefore sits outside
  // the silhouette by a few units before the flare adds anything, and that is
  // geometry rather than a fault.
  ok('and the strong elbow flares only as far as a sprinter carries it',
     flare < handOut + 2.5,
     `worst joint ${flare.toFixed(1)} past the silhouette against a hand ` +
     `${handOut.toFixed(1)} out — ${fat}`);

  // Across the chest at a WALK and a JOG. The sprint is the one exception and
  // it buys the exception by depressing the barrel as it comes round — see the
  // traverse block above, which checks the two together.
  let flattest = Math.PI;
  for (const g of [0.15, 0.5]) {
    for (let i = 0; i < 12; i++) {
      const p = poseOf(`player.isMoving = true; player.gait = ${g};
                        player.walkCycle = ${(i * Math.PI) / 6};`);
      for (const gun of p.guns) flattest = Math.min(flattest, Math.abs(gun.ang));
    }
  }
  ok('the long gun stays across the chest at a walk and a jog, never along the body',
     flattest > 0.45,
     `shallowest cant ${((flattest * 180) / Math.PI).toFixed(0)} degrees off the facing`);
  probe('player.isArmed = false; player.aimHold = 0;');
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
    const realE = ctx.ellipse, realR = ctx.rect, realQ = ctx.quad;
    let n = 0, lastHand = -1, gunAt = -1;
    ctx.ellipse = (x, y, w, h) => { n++; if (w === HAND && h === HAND) lastHand = n; };
    ctx.rect = () => { n++; };
    // The weapon is quads now: the pieces taper with the perspective, and a
    // rect cannot. Its LAST piece is what a hand has to go down before.
    ctx.quad = () => { n++; gunAt = n; };
    probe('player.show();');
    ctx.ellipse = realE; ctx.rect = realR; ctx.quad = realQ;
    ok("and every hand goes down UNDER it, as a bird's eye view demands",
       gunAt > lastHand, `last hand at ${lastHand}, gun at ${gunAt}`);
  }

  // Both hands must be ON the weapon, or one of them hangs short and it floats.
  // The reach clamp is what tears a hand off: the grips are placed first and
  // then pulled back inside the arm's own span, so a grip the arm cannot get to
  // simply parts company with the gun. That is the whole risk in the sprint
  // sweep, so it is measured across the arc rather than at one phase — and
  // against the weapon's AXIS and EXTENT rather than at two named points, since
  // the foreshortening is differential and no fixed fraction of the drawn
  // barrel names the same place on it twice.
  {
    let off = 0, past = 0, at = '', seen = 0;
    for (const [w, gaits] of [['ASSAULT_RIFLE', [0.2, 0.5, 1.0]],
                              ['SHOTGUN', [0.5, 1.0]],
                              ['ROCKET_LAUNCHER', [0.5, 1.0]],
                              ['COACH_GUN', [0.5, 1.0]]]) {
      setArm(w, false);
      for (const g of gaits) {
        for (let i = 0; i < 12; i++) {
          const p = poseOf(`player.isMoving = true; player.gait = ${g};
                            player.walkCycle = ${(i * Math.PI) / 6};`);
          if (p.guns.length !== 1 || p.hands.length !== 2) continue;
          const ax = p.guns[0].axis;
          seen++;
          for (const h of p.hands) {
            const o = ax.off(h);
            if (o > off) { off = o; at = `${w} at gait ${g}, phase ${i}`; }
            const t = ax.along(h);
            past = Math.max(past, ax.lo - t, t - ax.hi);
          }
        }
      }
    }
    ok('both hands stay on the weapon through the whole sweep',
       seen > 0 && off < 3.5 && past < 2.5,
       `worst hand ${off.toFixed(2)} off the axis, ${past.toFixed(2)} past either end` +
       (at ? ` — ${at}` : ''));
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

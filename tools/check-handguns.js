// One-handed guns are rigid solids whose moving parts follow the gameplay
// timers. Trace the actual box -> quad draw path, as well as the native firing
// and update methods: a correct helper that never reaches show() is not enough.
const { ctx, probe } = require('./harness.js');
const P = s => probe('(' + s + ')');
let fails = 0, checks = 0;
const ok = (name, pass, detail) => {
  checks++;
  console.log((pass ? '  ok   ' : '  FAIL ') + name +
              (detail === undefined ? '' : '  ' + detail));
  if (!pass) fails++;
};
const close = (a, b, e = 1e-8) => Math.abs(a - b) < e;
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

probe(`isStoryMode = false; townsData = {}; startAtLevel(2); started = true; doTick = true;
       viewLeft = -1e6; viewRight = 1e6; viewTop = -1e6; viewBottom = 1e6;
       leftStick = { active: false, dx: 0, dy: 0, base: { x: 0, y: 0 } };
       rightStick = { active: false, dx: 0, dy: 0, dist: 0, base: { x: 0, y: 0 } };
       chemistSuitUnlocked = false; cannonInputHeld = false; isCooking = false;
       swordPickedUp = false; setMeleeTool("NONE"); window.milLvl = 0;`);

// Track complete affine transforms. In particular, measuring the untransformed
// quad arguments would miss a wrist/pitch change in the live rendering path.
function trace(source) {
  const saved = {};
  for (const k of ['push','pop','translate','rotate','scale','fill','stroke','quad','handGunBox','drawHandGunSolid']) saved[k] = ctx[k];
  let m = [1, 0, 0, 1, 0, 0], active = null, activeGun = null, fillAlpha = 1, strokeAlpha = 1;
  const stack = [], boxes = [], guns = [];
  const point = (x, y) => [m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]];
  ctx.push = () => stack.push(m.slice());
  ctx.pop = () => { if (stack.length) m = stack.pop(); };
  ctx.translate = (x, y) => { const v = point(x, y); m[4] = v[0]; m[5] = v[1]; };
  ctx.rotate = a => {
    const c = Math.cos(a), s = Math.sin(a), [a0,a1,a2,a3] = m;
    m[0] = a0*c + a2*s; m[1] = a1*c + a3*s;
    m[2] = a2*c - a0*s; m[3] = a3*c - a1*s;
  };
  ctx.scale = (x, y = x) => { m[0]*=x; m[1]*=x; m[2]*=y; m[3]*=y; };
  ctx.fill = (...v) => { fillAlpha = v.length===4 ? v[3]/255 : 1; return saved.fill(...v); };
  ctx.stroke = (...v) => { strokeAlpha = v.length===4 ? v[3]/255 : 1; return saved.stroke(...v); };
  ctx.quad = (...v) => {
    if (active) {
      active.quads.push([0,2,4,6].map(i => point(v[i], v[i+1])));
      active.fillAlpha.push(fillAlpha); active.strokeAlpha.push(strokeAlpha);
    }
    return saved.quad(...v);
  };
  ctx.handGunBox = function (projection, x0, x1, y0, y1, z0, z1, r, g, b) {
    const box = { bounds: [x0,x1,y0,y1,z0,z1], rgb: [r,g,b], quads: [], fillAlpha: [], strokeAlpha: [], gun: activeGun };
    boxes.push(box);
    if (activeGun) activeGun.boxes.push(box);
    const prior = active; active = box;
    try { return saved.handGunBox(...arguments); } finally { active = prior; }
  };
  ctx.drawHandGunSolid = function (w, el, L, S, roll, kick, magOut, slideOpen) {
    const gun = { el, roll, kick, magOut: magOut || 0, slideOpen: slideOpen || 0, boxes: [] };
    guns.push(gun);
    const prior = activeGun; activeGun = gun;
    try { return saved.drawHandGunSolid(...arguments); } finally { activeGun = prior; }
  };
  try { probe(source); } finally { Object.assign(ctx, saved); }
  return { boxes, guns, balanced: stack.length === 0 };
}
// Authored materials identify these parts, independently of their position;
// selecting by x would stop recognising the slide as soon as it retracts.
const part = (gun, rgb) => gun.boxes.find(b => b.rgb.every((v, i) => v === rgb[i]));
const BARREL = [115,124,137], SLIDE = [73,80,91], MAG = [38,42,48];
const vertices = box => box.quads.flat();
const centre = box => {
  const v = vertices(box);
  return [v.reduce((n,p) => n+p[0],0)/v.length, v.reduce((n,p) => n+p[1],0)/v.length];
};
function hullArea(points) {
  const ps = points.map(p => p.slice()).sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  const turn = (a,b,c) => (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]);
  const lower = [], upper = [];
  for (const p of ps) { while(lower.length>1 && turn(lower.at(-2),lower.at(-1),p)<=0) lower.pop(); lower.push(p); }
  for (const p of ps.slice().reverse()) { while(upper.length>1 && turn(upper.at(-2),upper.at(-1),p)<=0) upper.pop(); upper.push(p); }
  const h = lower.slice(0,-1).concat(upper.slice(0,-1));
  return Math.abs(h.reduce((n,p,i) => n+p[0]*h[(i+1)%h.length][1]-p[1]*h[(i+1)%h.length][0],0))/2;
}

console.log('== rigid basis and visible depth ==');
{
  let worst = 0, affine = 0;
  for (const heading of [0, Math.PI/4, Math.PI/2, Math.PI, -Math.PI/2]) {
    for (const pitch of [-Math.PI/2, -1.1, 0, 0.7, Math.PI/2]) {
      for (const roll of [-0.75, 0, 0.55]) {
        const r = P(`(function () {
          const p=handGunProjection(${pitch},${roll},figureLight(${heading}),figureSouth(${heading}));
          return { axes:p.axes, o:p.point(0,0,0), a:p.point(2,-3,5), b:p.point(-1,4,2), sum:p.point(1,1,7) };
        })()`);
        const a = r.axes;
        worst = Math.max(worst, ...a.map(v => Math.abs(dot(v,v)-1)),
                         Math.abs(dot(a[0],a[1])), Math.abs(dot(a[0],a[2])), Math.abs(dot(a[1],a[2])),
                         distance(cross(a[0],a[1]),a[2]));
        affine = Math.max(affine, distance(r.o,[0,0]), distance(r.sum,r.a.map((v,i) => v+r.b[i])));
      }
    }
  }
  ok('pitch, roll and heading keep an orthonormal, right-handed model basis', worst < 1e-8, worst);
  ok('projection stays affine through the grip; straight edges cannot kink', affine < 1e-8, affine);
  for (const pitch of [-Math.PI/2, Math.PI/2]) {
    const solid = trace(`handGunBox(handGunProjection(${pitch},0,[0,1],[0,1]),-2,15,-2.8,2.8,0,4,73,80,91);`);
    const plate = trace(`handGunBox(handGunProjection(${pitch},0,[0,1],[0,1]),-2,15,-2.8,2.8,0,0,73,80,91);`);
    const area = hullArea(vertices(solid.boxes[0])), flat = hullArea(vertices(plate.boxes[0]));
    ok(`at pitch ${pitch.toFixed(2)}, the cuboid retains depth when a plan plate goes edge-on`, area > 20 && area > flat + 20,
       `solid ${area.toFixed(2)}, plate ${flat.toFixed(2)}`);
  }
}

function prepare(weapon, heading = 0) {
  probe(`player.currentWeapon=WEAPONS.${weapon}; player.ammo=20; player.x=5000; player.y=5000;
         player.aimAngle=${heading}; player.moveAngle=${heading}; player.isMoving=false;
         player.gait=0; player.walkCycle=0; player.weaponKick=0; player.muzzleFlash=0;
         player.fireTimer=0; player.reloadTimer=0; player.meleeTimer=0; player.dashTimer=0;
         player.throwAnimTimer=0; player.cannonCharge=0; player.cannonFireDelay=0;
         player.aimHold=14; player.isArmed=true; bullets.length=0;`);
}
console.log('\n== native shots, not a synthetic animation timer ==');
for (const [weapon,x,y,count] of [['PISTOL',31,8,1],['SMG',38,11,1],['DUAL_SMG',38,11,2]]) {
  let bad = null;
  for (const heading of [0, Math.PI/2, Math.PI, -Math.PI/2]) {
    prepare(weapon,heading);
    probe(`player.fire(player.aimAngle);`);
    const r = P(`({ammo:player.ammo,kick:player.weaponKick,cd:player.fireTimer,
                   expectedCd:player.currentWeapon.fireCooldown,shots:bullets.map(b=>[b.x-player.x,b.y-player.y])})`);
    const expected = [1,-1].slice(0,count).map(side => [Math.cos(heading)*x-Math.sin(heading)*y*side,
                                                                    Math.sin(heading)*x+Math.cos(heading)*y*side]);
    if (r.ammo !== 20-count || r.kick !== 6 || r.cd !== r.expectedCd || r.shots.length !== count ||
        expected.some((v,i) => distance(v,r.shots[i])>1e-8)) bad = {heading,r,expected};
  }
  ok(`${weapon}: original projectile origins, ammo cost and fire cooldown survive the art change`, !bad,
     bad ? JSON.stringify(bad) : `${count} shot(s), four headings, kick starts at 6`);
}
{
  prepare('PISTOL');
  const idle = trace('player.show();').guns[0];
  probe('player.fire(player.aimAngle);');
  const frames = [trace('player.show();').guns[0]], timers = [P('player.weaponKick')];
  for (let i=0;i<6;i++) {
    probe('player.updatePlayer();');
    timers.push(P('player.weaponKick'));
    frames.push(trace('player.show();').guns[0]);
  }
  ok('one native update per frame consumes exactly the six-frame kick', timers.join(',') === '6,5,4,3,2,1,0', timers.join(','));
  const idleSlide = part(idle,SLIDE), idleBarrel = part(idle,BARREL);
  const slides = frames.map(g => part(g,SLIDE)), barrels = frames.map(g => part(g,BARREL));
  const retractions = slides.map(b => idleSlide.bounds[1] - b.bounds[1]);
  ok('show() draws the slide back on the shot and forward on each simulation frame',
     retractions[0]>2 && close(retractions.at(-1),0) && retractions.slice(1).every((r,i)=>r<retractions[i]),
     retractions.map(r=>r.toFixed(3)).join(','));
  ok('the fixed barrel does not move back with the slide',
     barrels.every(b=>distance(b.bounds,idleBarrel.bounds)<1e-8));
  const relative = g => centre(part(g,SLIDE)).map((v,i)=>v-centre(part(g,BARREL))[i]);
  ok('the retraction reaches real projected quads, independent of whole-gun recoil',
     distance(relative(frames[0]),relative(idle))>2 && distance(relative(frames.at(-1)),relative(idle))<1e-8);
  ok('shot art does not consume more ammunition while the slide settles', P('player.ammo')===19 && P('bullets.length')===1);
  prepare('PISTOL');
  probe('player.ammo=1; player.fire(player.aimAngle);');
  const lastRound = trace('player.show();').guns[0];
  ok('the final round still creates its bullet and starts the original automatic reload',
     P('bullets.length')===1 && P('player.ammo')===0 && P('player.reloadTimer')===90 && P('player.weaponKick')===6);
  ok('the final-round shot reaches a retracted slide instead of losing its art to the reload branch',
     part(lastRound,SLIDE).bounds[1]<idleSlide.bounds[1]-2 && part(lastRound,BARREL).bounds[1]===idleBarrel.bounds[1]);
  for (let i=0;i<90;i++) probe('player.updatePlayer();');
  const restored = trace('player.show();').guns[0];
  ok('automatic reload restores the ready pistol and releases its slide before the next shot',
     P('player.ammo')===P('player.currentWeapon.maxAmmo') && P('player.reloadTimer')===0 &&
     close(part(restored,SLIDE).bounds[1],idleSlide.bounds[1]));
}

console.log('\n== reload timing, magazine travel and dual sequencing ==');
for (const weapon of ['PISTOL','SMG','DUAL_SMG']) {
  prepare(weapon);
  probe('player.mags[player.currentWeapon.name]=3; player.triggerReload();');
  const start = P('({timer:player.reloadTimer,ammo:player.ammo,mags:player.mags[player.currentWeapon.name]})');
  for (let i=0;i<89;i++) probe('player.updatePlayer();');
  const before = P('({timer:player.reloadTimer,ammo:player.ammo})');
  probe('player.updatePlayer();');
  const after = P('({timer:player.reloadTimer,ammo:player.ammo,max:player.currentWeapon.maxAmmo})');
  ok(`${weapon}: reload stays empty until the original ninety-frame completion`,
     start.timer===90 && start.ammo===0 && before.timer===1 && before.ammo===0 && after.timer===0 && after.ammo===after.max,
     JSON.stringify({start,before,after}));
  ok(`${weapon}: reserve-magazine consumption is unchanged`, start.mags===(weapon==='PISTOL'?3:2));
}
{
  const stages = [0,0.2,0.36,0.65,0.82,1].map(p=>P(`handGunReloadPhase(${p})`));
  ok('a reload removes the magazine, travels to the belt, reinserts, then racks the slide',
     stages[0].out===0 && stages[1].out>0 && stages[2].out>0.99 && stages[2].belt>0.5 &&
     stages[3].out<stages[2].out && stages[4].out===0 && stages[4].rack>0.5 &&
     stages[5].out===0 && stages[5].rack===0);
  for (const weapon of ['PISTOL','SMG']) {
    const a = trace(`drawHandGunSolid(WEAPONS.${weapon},-0.62,[0,1],[0,1],0.18,0,0.9799,0);`);
    const b = trace(`drawHandGunSolid(WEAPONS.${weapon},-0.62,[0,1],[0,1],0.18,0,0.9801,0);`);
    const am = part(a.guns[0],MAG), bm = part(b.guns[0],MAG);
    ok(`${weapon}: magazine geometry crosses 98% withdrawal without vanishing`, !!am && !!bm && am.quads.length>0 && bm.quads.length>0,
       `before ${!!am}, after ${!!bm}`);
    if (am && bm) ok(`${weapon}: adjacent withdrawal poses move the magazine continuously`,
       distance(centre(am),centre(bm))<0.01);
    if (am && bm) ok(`${weapon}: magazine fill and outline fade smoothly across the old threshold`,
       Math.abs(am.fillAlpha[0]-bm.fillAlpha[0])<0.01 && Math.abs(am.strokeAlpha[0]-bm.strokeAlpha[0])<0.01);
    prepare(weapon);
    const travel = [];
    for (let timer=90; timer>=0; timer--) {
      probe(`player.reloadTimer=${timer}; player.aimHold=14;`);
      const gun = trace('player.show();').guns[0], mag = part(gun,MAG);
      travel.push({alpha:mag.fillAlpha[0],point:centre(mag),receiver:gun.boxes.filter(b=>b!==mag).every(b=>b.fillAlpha.every(a=>close(a,1)))});
    }
    const opacityStep = Math.max(...travel.slice(1).map((f,i)=>Math.abs(f.alpha-travel[i].alpha)));
    const geometryStep = Math.max(...travel.slice(1).map((f,i)=>distance(f.point,travel[i].point)));
    ok(`${weapon}: actual reload frames withdraw, conceal and reinsert the magazine without a pop`,
       close(travel[0].alpha,1) && close(travel.at(-1).alpha,1) && travel.some(f=>f.alpha===0) &&
       opacityStep<0.3 && geometryStep<2 && travel.every(f=>f.receiver),
       `largest frame step: opacity ${opacityStep.toFixed(3)}, position ${geometryStep.toFixed(3)}`);
  }
  prepare('PISTOL');
  const slidePhases = [0,0.5,0.82,0.9,0.98].map(p=>{
    probe(`player.reloadTimer=${90*(1-p)}; player.aimHold=14;`);
    return trace('player.show();').guns[0];
  });
  ok('the pistol reload keeps the empty slide locked until insertion, then releases it forward',
     slidePhases.slice(0,3).every(g=>g.slideOpen===1) &&
     slidePhases[3].slideOpen>0 && slidePhases[3].slideOpen<1 && slidePhases[4].slideOpen===0 &&
     part(slidePhases[4],SLIDE).bounds[1]>part(slidePhases[3],SLIDE).bounds[1]);
  prepare('DUAL_SMG');
  const phases = [0,0.18,0.41,0.5,0.68,0.91,1].map(p=>{
    probe(`player.reloadTimer=${90*(1-p)}; player.aimHold=14;`);
    return trace('player.show();');
  });
  ok('show() keeps both actual SMG solids during every reload phase',
     phases.every(t=>t.balanced && t.guns.length===2 && t.guns.every(g=>g.boxes.some(b=>b.quads.length>0))));
  ok('the right magazine is removed and racked while the left remains seated',
     phases[1].guns[0].magOut>0.9 && phases[1].guns[1].magOut===0 &&
     phases[2].guns[0].slideOpen>0.5 && phases[2].guns[1].slideOpen===0);
  ok('the left magazine follows after the right has reinserted and closed',
     phases[4].guns[0].magOut===0 && phases[4].guns[1].magOut>0.9 &&
     phases[5].guns[0].slideOpen===0 && phases[5].guns[1].slideOpen>0.5);
  ok('the half-reload boundary seats the right magazine before the left begins',
     phases[3].guns.every(g=>g.magOut===0 && g.slideOpen===0));
}

console.log(`\n${checks-fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);

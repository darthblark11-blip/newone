// Off-hand actions must survive every gait without raising the strong-hand gun.
// Render dispatch, visible carry count, action origins and dual-fire accounting
// are checked together so an animation cannot disagree with its projectiles.
const { ctx, probe } = require('./harness.js');
const P = s => probe('(' + s + ')');
let checks = 0, fails = 0;
function ok(name, condition, detail) {
  checks++;
  if (!condition) fails++;
  console.log((condition ? '  ok   ' : '  FAIL ') + name + (detail === undefined ? '' : '  ' + detail));
}

probe(`isStoryMode = false; townsData = {}; startAtLevel(2); started = true; doTick = true;
       enemiesList.length = 0; swordPickedUp = false; setMeleeTool("NONE");
       viewLeft = -1e6; viewRight = 1e6; viewTop = -1e6; viewBottom = 1e6;
       player.forceNudge = function(){}; player.checkCol = function(){ return false; };
       leftStick = { active: true, dx: 0.9, dy: 0, base: { x: 0, y: 0 } };
       rightStick = { active: false, dx: 0, dy: 0, dist: 0, base: { x: 0, y: 0 } };
       player.meleeTimer = 0; player.meleePhase = 0; player.dashTimer = 0;
       player.reloadTimer = 0; player.muzzleFlash = 0; player.aimHold = 0;`);

const drawAction = ctx.drawLeftHandAction, drawGun = ctx.carryHandGun;
let actions = [], guns = [];
ctx.drawLeftHandAction = function(c, action, untwist) {
  actions.push(action); return drawAction(c, action, untwist);
};
ctx.carryHandGun = function() {
  guns.push(arguments[0]); return drawGun.apply(ctx, arguments);
};
function draw(setup) {
  probe(setup); actions = []; guns = []; probe('player.show();');
  return { actions: actions.slice(), guns: guns.length };
}

console.log('== dual SMGs remain in both hands throughout the gait ==');
for (const gait of [0.2, 0.5, 1]) {
  let missing = null;
  for (let i = 0; i < 16; i++) {
    const r = draw(`chemistSuitUnlocked = false; isCooking = false; cannonInputHeld = false;
                   player.cannonCharge = 0; player.cannonFireDelay = 0; player.throwAnimTimer = 0;
                   player.currentWeapon = WEAPONS.DUAL_SMG; player.isArmed = true;
                   player.isMoving = true; player.gait = ${gait}; player.walkCycle = ${i * Math.PI / 8};`);
    if (r.guns !== 2 || r.actions.length) missing = { phase: i, ...r };
  }
  ok(`gait ${gait}: both SMGs drawn at all 16 phases`, !missing, missing && JSON.stringify(missing));
}

console.log('\n== throws animate while empty-handed and carrying each weapon ==');
for (const weapon of ['NONE', 'PISTOL', 'SMG', 'DUAL_SMG', 'ASSAULT_RIFLE']) {
  for (const phase of ['COOK', 'RELEASE']) {
    let bad = null;
    for (const gait of [0.2, 0.5, 1]) {
      for (let i = 0; i < 16; i++) {
        const r = draw(`chemistSuitUnlocked = false; cannonInputHeld = false; player.cannonCharge = 0;
                       isCooking = ${phase === 'COOK'}; player.throwAnimTimer = ${phase === 'RELEASE' ? 8 : 0};
                       player.isArmed = ${weapon !== 'NONE'};
                       player.currentWeapon = WEAPONS.${weapon === 'NONE' ? 'PISTOL' : weapon};
                       player.isMoving = true; player.gait = ${gait}; player.walkCycle = ${i * Math.PI / 8};`);
        const expected = ['PISTOL', 'SMG', 'DUAL_SMG'].includes(weapon) ? 1 : 0;
        if (r.actions.length !== 1 || r.actions[0] !== 1 || r.guns !== expected || P('aimIntent(player)')) {
          bad = { gait, phase: i, ...r };
        }
      }
    }
    ok(`${weapon} ${phase}: left arm throws without raising gun at all gaits`, !bad, bad && JSON.stringify(bad));
  }
}

console.log('\n== chemist cannon is the grey left hand ==');
for (const weapon of ['NONE', 'PISTOL', 'DUAL_SMG', 'ASSAULT_RIFLE']) {
  for (const phase of ['CHARGE', 'SHOT']) {
    let bad = null;
    for (const gait of [0.2, 0.5, 1]) {
      const r = draw(`chemistSuitUnlocked = true; isCooking = false; player.throwAnimTimer = 0;
                     cannonInputHeld = ${phase === 'CHARGE'}; player.cannonCharge = ${phase === 'CHARGE' ? 80 : 0};
                     player.cannonFireDelay = ${phase === 'SHOT' ? 42 : 0};
                     player.isArmed = ${weapon !== 'NONE'};
                     player.currentWeapon = WEAPONS.${weapon === 'NONE' ? 'PISTOL' : weapon};
                     player.isMoving = true; player.gait = ${gait}; player.walkCycle = 1.2;`);
      const expected = ['PISTOL', 'DUAL_SMG'].includes(weapon) ? 1 : 0;
      if (r.actions.length !== 1 || r.actions[0] !== 2 || r.guns !== expected || P('aimIntent(player)')) bad = { gait, ...r };
    }
    ok(`${weapon} ${phase}: cannon renders and right-hand carry survives`, !bad, bad && JSON.stringify(bad));
  }
}
{
  let oddInstrument = false;
  const fill = ctx.fill;
  ctx.fill = function(r, g, b) { if (r === 0 && g === 255 && b === 200) oddInstrument = true; return fill.apply(ctx, arguments); };
  draw(`chemistSuitUnlocked = true; cannonInputHeld = false; player.cannonCharge = 0; player.cannonFireDelay = 0;
        player.isArmed = false; player.throwAnimTimer = 0; isCooking = false;`);
  ctx.fill = fill;
  ok('inactive cannon has no cyan handheld instrument', !oddInstrument && !actions.length);
  probe('cannonInputHeld = true; player.cannonCooldown = 60; player.cannonAmmo = 4;');
  ok('holding cannon button during cooldown does not invent a charge pose', P('leftHandAction(player)') === 0);
  probe('player.cannonCooldown = 0; isCooking = true; player.cannonCharge = 80;');
  ok('a throw takes priority over cannon charge', P('leftHandAction(player)') === 1);
}

console.log('\n== the same action runs while aiming and reloading ==');
for (const mode of ['AIM', 'RELOAD']) {
  for (const action of [1, 2]) {
    const r = draw(`rightStick.active = ${mode === 'AIM'}; rightStick.dx = 1; player.aimHold = 14;
                   player.reloadTimer = ${mode === 'RELOAD' ? 60 : 0}; player.isArmed = true;
                   player.currentWeapon = WEAPONS.DUAL_SMG; chemistSuitUnlocked = ${action === 2};
                   isCooking = ${action === 1}; player.throwAnimTimer = 0; cannonInputHeld = ${action === 2};
                   player.cannonCharge = ${action === 2 ? 80 : 0}; player.cannonFireDelay = 0;`);
    ok(`${mode} action ${action}: exactly one action arm`, r.actions.length === 1 && r.actions[0] === action);
  }
}

console.log('\n== charge glow and lightning origin share the drawn hand ==');
function chargeCentre(setup) {
  probe(setup);
  const real = {};
  for (const name of ['push', 'pop', 'translate', 'rotate', 'scale', 'fill', 'ellipse']) real[name] = ctx[name];
  let m = [1, 0, 0, 1, 0, 0], glow = false, centre = null;
  const stack = [];
  ctx.push = () => stack.push({ m: m.slice(), glow });
  ctx.pop = () => { const s = stack.pop(); if (s) { m = s.m; glow = s.glow; } };
  ctx.translate = (x, y) => { m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; };
  ctx.rotate = a => {
    const c = Math.cos(a), s = Math.sin(a), [A, B, C, D] = m;
    m[0] = A * c + C * s; m[1] = B * c + D * s;
    m[2] = C * c - A * s; m[3] = D * c - B * s;
  };
  ctx.scale = (x, y = x) => { m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; };
  ctx.fill = (r, g, b, a) => { glow = r === 255 && g === 238 && b === 50 && a === 85; };
  ctx.ellipse = (x, y) => { if (glow) centre = { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }; };
  probe('player.show();');
  Object.assign(ctx, real);
  return centre;
}
for (const gait of [0.2, 0.5, 1]) {
  const centre = chargeCentre(`chemistSuitUnlocked = true; cannonInputHeld = true; isCooking = false;
                              player.throwAnimTimer = 0; player.cannonCharge = 80; player.cannonFireDelay = 0;
                              player.isArmed = true; player.aimHold = 0; rightStick.active = false;
                              player.reloadTimer = 0; player.muzzleFlash = 0; player.mounted = false;
                              player.isMoving = true; player.gait = ${gait}; player.walkCycle = 1.2;
                              player.aimAngle = 0.73;`);
  const expected = P('leftActionMuzzle(player, player.aimAngle)');
  ok(`gait ${gait}: charge source matches rendered hand after all transforms`, centre && Math.hypot(centre.x - expected.x, centre.y - expected.y) < 1e-6);
}

console.log('\n== projectiles match the off-hand state ==');
probe(`rightStick.active = false; rightStick.dx = 0; rightStick.dy = 0; rightStick.dist = 0;
       player.aimHold = 0; player.reloadTimer = 0; player.muzzleFlash = 0;
       player.isArmed = true; player.isMoving = true; player.gait = 1;
       player.currentWeapon = WEAPONS.DUAL_SMG; player.ammo = 60; player.fireTimer = 0;
       chemistSuitUnlocked = true; isCooking = false; cannonInputHeld = true;
       player.cannonCharge = 80; player.cannonFireDelay = 0; player.cannonCooldown = 0;`);
const spawn = ctx.spawnBullet, emit = ctx.emit;
let shots = [], muzzleEmits = [];
ctx.spawnBullet = function() { shots.push([...arguments]); };
ctx.emit = function(x, y, count, col, type) { if (type === 'MUZZLE') muzzleEmits.push([x, y]); };
probe('player.fire(0);');
ok('cannon in off hand fires only the right SMG', shots.length === 1 && muzzleEmits.length === 1 && P('player.ammo') === 59);
shots = []; muzzleEmits = [];
probe('cannonInputHeld = false; player.cannonCharge = 0; player.cannonFireDelay = 0; player.ammo = 60; player.fire(0);');
ok('free off hand fires both SMGs and spends both rounds', shots.length === 2 && muzzleEmits.length === 2 && P('player.ammo') === 58);
ctx.spawnBullet = spawn; ctx.emit = emit;

probe(`player.ammo = 60; player.fireTimer = 0; player.muzzleFlash = 0; player.reloadTimer = 0;
       player.isArmed = false; player.aimHold = 0; player.cannonCharge = 50; player.cannonFireDelay = 0;
       player.aimAngle = 0; player.moveAngle = 0; cannonInputHeld = false;
       leftStick.dx = 0; leftStick.dy = 1; leftStick.active = true; lightnings.length = 0;`);
const before = P('({x:player.x,y:player.y})');
const cannonOrigin = P('leftActionMuzzle(player, supportAimAngle(player))');
probe('player.updatePlayer();');
const bolt = P('lightnings[0].pts');
ok('lightning starts at the same grey hand used by the charge art', Math.hypot(bolt[0].x - cannonOrigin.x, bolt[0].y - cannonOrigin.y) < 1e-6);
ok('non-aimed lightning follows current movement direction at release', Math.abs(bolt[1].x - before.x) < 1e-6 && Math.abs(bolt[1].y - before.y - 300) < 1e-6);
ok('non-aimed cannon release preserves the lowered right-hand gun', !P('player.isArmed') && !P('playerAiming(player)') && P('player.cannonFireDelay') === 48);
probe(`chemistSuitUnlocked = false; grenadesUnlocked = true; pGrenadeAmmo = 4;
       isCooking = true; cookTime = 100; grenadeInputHeld = false; player.throwAnimTimer = 0;
       player.aimAngle = 0; player.moveAngle = 0; playerGrenades.length = 0;`);
probe('player.updatePlayer();');
ok('non-aimed grenade follows current movement direction at release', Math.abs(P('playerGrenades[0].a') - Math.PI / 2) < 1e-6 && P('player.throwAnimTimer') === 15);

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exitCode = fails ? 1 : 0;

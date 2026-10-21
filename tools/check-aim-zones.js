// Target selection must reach native projectile paths and stay transient when
// replacing a run. Touch gesture ownership is covered by its own controls test.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness.js');
let checks = 0;
const run = code => probe(code);
function check(name, code) {
  assert.ok(run(code), name);
  checks++;
}

ctx.setTimeout = () => 0;
ctx.touches = [];
ctx.navigator.getGamepads = () => [];
const storage = new Map();
ctx.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: key => storage.delete(key)
};
// Map generation needs varied, repeatable placement rather than a constant RNG.
let seed = 7621;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  return b === undefined ? a * r : a + r * (b - a);
};

run('resetRunState();');
for (const zone of ['HEAD', 'BODY', 'LEGS']) {
  check(zone + ' selection is accepted', `setPlayerAimZone('${zone}') === true`);
  check(zone + ' selection synchronizes legacy head mode',
    `playerAimTarget() === '${zone}' && headAimToggle === ${zone === 'HEAD'}`);
  for (const invalid of [null, '', 'head', 'ARMS', 1]) {
    check('invalid selection preserves ' + zone + ': ' + JSON.stringify(invalid),
      `setPlayerAimZone(${JSON.stringify(invalid)}) === false && playerAimTarget() === '${zone}' && headAimToggle === ${zone === 'HEAD'}`);
  }
}
run("setPlayerAimZone('LEGS'); togglePlayerHeadAim();");
check('legacy head toggle moves LEGS to HEAD', "playerAimTarget() === 'HEAD' && headAimToggle");
run('togglePlayerHeadAim();');
check('legacy head toggle returns to BODY', "playerAimTarget() === 'BODY' && !headAimToggle");

const weapons = ['PISTOL', 'SMG', 'DUAL_SMG', 'ASSAULT_RIFLE', 'SHOTGUN',
  'REVOLVER', 'COACH_GUN', 'TASER', 'BOW'];
for (const zone of ['HEAD', 'BODY', 'LEGS']) {
  for (const weapon of weapons) {
    run(`bullets=[];particles=[];enemiesList=[];
      player=new Character(0,0,true);player.currentWeapon=WEAPONS.${weapon};
      player.ammo=64;player.aimAngle=.6;setPlayerAimZone('${zone}');player.fire(.6);`);
    const count = weapon === 'DUAL_SMG' ? 2 : weapon === 'SHOTGUN' ? 4 : 1;
    check(weapon + ' emits ' + zone + ' through its native firing path',
      `bullets.length === ${count} && bullets.every(b => b.tH === '${zone}' && b.shooter === player && b.isP && b.w === WEAPONS.${weapon}) && player.ammo === ${64 - (weapon === 'DUAL_SMG' ? 2 : 1)}`);
    if (weapon === 'BOW') check(zone + ' bow shot remains an arrow', 'bullets[0].isArrow && !bullets[0].isTaser');
    if (weapon === 'TASER') check(zone + ' taser retains its native projectile', 'bullets[0].isTaser && !bullets[0].isArrow');
  }
}

for (const zone of ['HEAD', 'BODY', 'LEGS']) {
  for (const weapon of weapons) {
    run(`bullets=[];particles=[];setPlayerAimZone('${zone}');
      window.aimZoneAlly=new Character(0,0,false);aimZoneAlly.isFriendly=true;
      aimZoneAlly.currentWeapon=WEAPONS.${weapon};aimZoneAlly.ammo=64;aimZoneAlly.fire(.6);`);
    const expected = zone === 'HEAD' ? 'HEAD' : 'BODY';
    check('ally ' + weapon + ' retains ' + expected + ' while player selects ' + zone,
      `bullets.length > 0 && bullets.every(b => b.tH === '${expected}' && b.shooter === aimZoneAlly && b.isP)`);
  }
}

for (const zone of ['HEAD', 'LEGS']) {
  run(`setPlayerAimZone('${zone}'); resetRunState();`);
  check('reset clears ' + zone + ' selection',
    "playerAimTarget() === 'BODY' && playerAimZone === 'BODY' && !headAimToggle");
}
run("setPlayerAimZone('LEGS'); pendingLevel=2; pendingStoryMode=false; beginSelectedRun();");
check('new run begins in BODY mode',
  "started && player && playerAimTarget() === 'BODY' && !headAimToggle");

run("player.hp=73;setPlayerAimZone('LEGS');saveGame();");
const save = storage.get('urbanTwinStickSave');
const snapshot = JSON.parse(save);
assert.ok(!('playerAimZone' in snapshot) && !('headAimToggle' in snapshot) && !('aimZone' in snapshot),
  'save schema does not persist transient aiming selection');
checks++;
run("setPlayerAimZone('HEAD'); player.hp=4; window.aimZoneLoadResult=loadGame();");
check('loading replaces HEAD mode with BODY and restores saved player',
  "aimZoneLoadResult !== false && started && player.hp === 73 && playerAimTarget() === 'BODY' && playerAimZone === 'BODY' && !headAimToggle");
assert.equal(storage.get('urbanTwinStickSave'), save, 'load leaves the save snapshot unchanged');
checks++;
run('bullets=[];player.currentWeapon=WEAPONS.PISTOL;player.ammo=10;player.fire(0);');
check('first projectile after load uses BODY', "bullets.length === 1 && bullets[0].tH === 'BODY'");

console.log(`${checks}/${checks} aim-zone projectile and lifecycle checks passed.`);

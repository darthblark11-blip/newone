// Simulated standard-layout controller through the real input and player code.
const assert = require('assert');
const { ctx, probe } = require('./harness');
const P = s => probe('(' + s + ')');
let pad = null, now = 1000, checks = 0;
ctx.navigator.getGamepads = () => pad ? [null, pad] : [];
ctx.millis = () => now;
probe('isStoryMode=false;townsData={};startAtLevel(1);started=true;doTick=true;');

function reset() {
  now = 1000; pad = null; ctx.touches = [];
  probe([
    'player=new Character(0,0,true);BIOME_ACTIVE=false;',
    'buildings=[];activeBuildings=[];activeParkingCars=[];barrels=[];invalidateColIndex();',
    'enemiesList=[];bullets=[];corpses=[];particles=[];lightnings=[];',
    'playerGrenades=[];playerFlasks=[];waterPuddles=[];',
    'leftStick={active:false,dx:0,dy:0,base:{x:120,y:680}};',
    'rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1080,y:680}};',
    'window.isDesktop=false;window.showOnScreenControls=true;',
    'isStoryMode=false;headAimToggle=false;lastToggleTime=lastWeaponSwapTime=0;',
    'prevGamepadButtons=[];gamepadWasConnected=false;meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;',
    'jetpackUnlocked=true;jetpackDoubleDash=false;meleeUnlocked=true;meleeComboUnlocked=false;',
    'window.meleeFinisherUnlocked=false;ninjaSuitUnlocked=explosiveArmorUnlocked=chemistSuitUnlocked=false;',
    'grenadesUnlocked=true;isCooking=false;cookTime=0;pGrenadeAmmo=3;pFlaskAmmo=2;pGrenadeTimer=pFlaskTimer=0;',
    'smgUnlocked=dualSmgUnlocked=arUnlocked=shotgunUnlocked=rocketLauncherUnlocked=false;',
    'swordPickedUp=false;window.pickaxeOwned=false;setMeleeTool("NONE");'
  ].join('\n'));
}
function poll({ tick = false, dt = 16, touches = [] } = {}) {
  now += dt; ctx.touches = touches;
  probe('frameCount++;handleTouches();handleGamepad();handleDesktop();');
  if (tick) probe('player.updatePlayer();');
}
function frame(keys = [], opts = {}) {
  const pressed = new Set(keys || []);
  pad = keys === null ? null : {
    axes: opts.axes || [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.has(i), value: pressed.has(i) ? 1 : 0 }))
  };
  poll(opts);
}
function press(button, opts = {}) {
  frame([], { dt: 400 }); frame([button], { dt: 400, ...opts });
}
function check(name, test) {
  reset(); test(); checks++;
  console.log('  ok   ' + name);
}

check('L3 dashes on press and never repeats while held, even after cooldown', () => {
  const p = P('player'), dash = p.activateDash; let calls = 0;
  p.activateDash = function () { calls++; return dash.call(this); };
  frame([10], { tick: true, axes: [1, 0, 0, 0] });
  assert.equal(calls, 1); assert(P('player.dashTimer>0&&player.x>0'));
  for (let i = 0; i < 100; i++) frame([10], { tick: true });
  assert.equal(calls, 1); assert(P('player.dashCooldown<=0'));
  press(10); assert.equal(calls, 2);
});
check('L3 respects dash unlock, cooldown, active dash and active melee', () => {
  for (const blocked of ['jetpackUnlocked=false', 'player.dashCooldown=5', 'player.dashTimer=5', 'player.meleeTimer=5']) {
    reset(); probe(blocked); const p = P('player'); let calls = 0;
    p.activateDash = () => calls++; press(10); assert.equal(calls, 0);
  }
});
check('R3 toggles once per press; hold and debounce do not retrigger it', () => {
  press(11); assert(P('headAimToggle'));
  for (let i = 0; i < 50; i++) frame([11]);
  assert(P('headAimToggle'));
  frame([]); frame([11]); assert.equal(P('headAimToggle'), false);
  frame([]); frame([11]); assert.equal(P('headAimToggle'), false);
  for (let i = 0; i < 30; i++) frame([11]);
  assert.equal(P('headAimToggle'), false);
  press(11); assert(P('headAimToggle'));
});
check('D-pad up cycles sword, pickaxe, unarmed once per press', () => {
  probe('swordPickedUp=true;window.pickaxeOwned=true;');
  for (const expected of ['SWORD', 'PICKAXE', 'NONE', 'SWORD']) {
    press(12); assert.equal(P('meleeTool()'), expected);
    assert.equal(P('window.swordEquipped'), expected === 'SWORD');
    for (let i = 0; i < 30; i++) frame([12]);
    assert.equal(P('meleeTool()'), expected);
  }
});
check('D-pad up skips unowned melee tools', () => {
  press(12); assert.equal(P('meleeTool()'), 'NONE');
  probe('swordPickedUp=true;'); press(12); assert.equal(P('meleeTool()'), 'SWORD');
  press(12); assert.equal(P('meleeTool()'), 'NONE');
  probe('swordPickedUp=false;window.pickaxeOwned=true;');
  press(12); assert.equal(P('meleeTool()'), 'PICKAXE');
  press(12); assert.equal(P('meleeTool()'), 'NONE');
});
check('D-pad right and left wrap the available firearm/taser list in opposite directions', () => {
  probe('isStoryMode=true;smgUnlocked=dualSmgUnlocked=arUnlocked=shotgunUnlocked=rocketLauncherUnlocked=true;');
  for (const expected of ['TASER', 'DUAL_SMG', 'ASSAULT_RIFLE', 'SHOTGUN', 'ROCKET_LAUNCHER', 'PISTOL']) {
    press(15); assert(P('player.currentWeapon===WEAPONS.' + expected));
    for (let i = 0; i < 25; i++) frame([15]);
    assert(P('player.currentWeapon===WEAPONS.' + expected));
  }
  for (const expected of ['ROCKET_LAUNCHER', 'SHOTGUN', 'ASSAULT_RIFLE', 'DUAL_SMG', 'TASER', 'PISTOL']) {
    press(14); assert(P('player.currentWeapon===WEAPONS.' + expected));
  }
});
check('Story pistol/taser works before gun upgrades; other modes skip taser', () => {
  probe('isStoryMode=true;'); press(15); assert(P('player.currentWeapon===WEAPONS.TASER'));
  press(14); assert(P('player.currentWeapon===WEAPONS.PISTOL'));
  probe('isStoryMode=false;arUnlocked=true;'); press(15);
  assert(P('player.currentWeapon===WEAPONS.ASSAULT_RIFLE'));
});
check('Locked firearms are skipped and dual SMG alone is selectable', () => {
  probe('smgUnlocked=true;'); press(15); assert(P('player.currentWeapon===WEAPONS.SMG'));
  press(15); assert(P('player.currentWeapon===WEAPONS.PISTOL'));
  probe('smgUnlocked=false;dualSmgUnlocked=true;'); press(15);
  assert(P('player.currentWeapon===WEAPONS.DUAL_SMG'));
});
check('Gun swap cancels reload only when a second weapon exists', () => {
  probe('player.reloadTimer=50;'); press(15); assert.equal(P('player.reloadTimer'), 50);
  probe('shotgunUnlocked=true;'); press(15);
  assert(P('player.currentWeapon===WEAPONS.SHOTGUN')); assert.equal(P('player.reloadTimer'), 0);
});
check('Weapon debounce and opposite D-pad presses do not queue repeated swaps', () => {
  probe('isStoryMode=true;'); press(15);
  frame([]); frame([15]); assert(P('player.currentWeapon===WEAPONS.TASER'));
  for (let i = 0; i < 25; i++) frame([15]);
  assert(P('player.currentWeapon===WEAPONS.TASER'));
  frame([]); frame([14, 15], { dt: 400 }); assert(P('player.currentWeapon===WEAPONS.TASER'));
});
check('Down stays unmapped; A/B/L1 no longer trigger the old actions', () => {
  probe('isStoryMode=true;swordPickedUp=true;window.pickaxeOwned=true;');
  for (const key of [13, 0, 1, 4]) {
    press(key);
    assert(P('player.currentWeapon===WEAPONS.PISTOL&&!headAimToggle&&player.dashTimer===0'));
    assert.equal(P('meleeTool()'), 'NONE');
    assert(P('!meleeInputHeld&&!grenadeInputHeld&&!cannonInputHeld'));
  }
});
check('L2 cooks and releases a grenade without dash, melee or cannon', () => {
  frame([6], { tick: true });
  assert(P('isCooking&&grenadeInputHeld&&!meleeInputHeld&&!cannonInputHeld&&player.dashTimer===0'));
  for (let i = 0; i < 5; i++) frame([6], { tick: true });
  assert.equal(P('playerGrenades.length'), 0);
  frame([], { tick: true });
  assert.equal(P('playerGrenades.length'), 1); assert.equal(P('pGrenadeAmmo'), 2);
  assert.equal(P('playerFlasks.length'), 0); assert.equal(P('player.cannonCharge'), 0);
});
check('Chemist L2 cooks/releases a flask without consuming grenades or requiring melee unlock', () => {
  probe('chemistSuitUnlocked=true;meleeUnlocked=false;');
  frame([6], { tick: true });
  assert(P('isCooking&&meleeInputHeld&&!grenadeInputHeld&&!cannonInputHeld&&player.dashTimer===0'));
  frame([6], { tick: true }); frame([], { tick: true });
  assert.equal(P('playerFlasks.length'), 1); assert.equal(P('pFlaskAmmo'), 1);
  assert.equal(P('playerGrenades.length'), 0); assert.equal(P('pGrenadeAmmo'), 3);
});
check('Chemist L1 charges/releases the actual cannon without throwing a flask or grenade', () => {
  probe('chemistSuitUnlocked=true;');
  for (let i = 0; i < 5; i++) frame([4], { tick: true });
  assert.equal(P('player.cannonCharge'), 5); assert.equal(P('player.cannonAmmo'), 4);
  assert(P('cannonInputHeld&&!meleeInputHeld&&!grenadeInputHeld&&!isCooking'));
  frame([], { tick: true });
  assert.equal(P('player.cannonCharge'), 0); assert.equal(P('player.cannonAmmo'), 3);
  assert.equal(P('lightnings.length'), 1);
  assert(P('playerFlasks.length===0&&playerGrenades.length===0&&player.dashTimer===0'));
});
check('Chemist L1 and L2 can be held together and release their own abilities', () => {
  probe('chemistSuitUnlocked=true;');
  frame([4, 6], { tick: true }); frame([4, 6], { tick: true });
  frame([], { tick: true });
  assert.equal(P('playerFlasks.length'), 1); assert.equal(P('lightnings.length'), 1);
  assert.equal(P('playerGrenades.length'), 0);
});
check('Chemist Y/R1 do not trigger flasks; other suits keep their melee bindings', () => {
  probe('chemistSuitUnlocked=true;'); frame([3, 5], { tick: true });
  assert(P('!isCooking&&!meleeInputHeld&&playerFlasks.length===0'));
  probe('chemistSuitUnlocked=false;'); press(5, { tick: true });
  assert(P('meleeInputHeld&&player.meleeTimer>0'));
  reset(); press(3, { tick: true }); assert(P('meleeInputHeld&&player.meleeTimer>0'));
});
check('L1 stays reserved for non-chemist suits', () => {
  for (const suit of ['ninjaSuitUnlocked=true', 'explosiveArmorUnlocked=true']) {
    reset(); probe(suit); frame([4], { tick: true });
    assert(P('!isCooking&&!cannonInputHeld&&!grenadeInputHeld&&player.dashTimer===0'));
    assert(P('playerGrenades.length===0&&playerFlasks.length===0&&lightnings.length===0'));
  }
});
check('X reload still works once per press', () => {
  probe('player.ammo=0;'); press(2);
  assert.equal(P('player.reloadTimer'), 90);
  probe('player.reloadTimer=0;'); frame([2], { dt: 400 });
  assert.equal(P('player.reloadTimer'), 0);
  press(2); assert.equal(P('player.reloadTimer'), 90);
});
check('Stick axes, deadzone and controller detection retain their behavior', () => {
  frame([], { axes: [.7, -.4, .5, .6] });
  assert(P('leftStick.active&&leftStick.dx===.7&&leftStick.dy===-.4'));
  assert(P('rightStick.active&&rightStick.dx===.5&&rightStick.dy===.6'));
  assert(P('!window.showOnScreenControls&&!window.isDesktop'));
  frame([], { axes: [.1, 0, .1, 0] });
  assert(P('!leftStick.active&&!rightStick.active'));
});
check('Idle controller preserves touchscreen grenade/cannon input', () => {
  frame([], { touches: [{ x: 1165, y: 360 }] }); assert(P('grenadeInputHeld'));
  probe('chemistSuitUnlocked=true;');
  frame([], { touches: [{ x: 1165, y: 360 }] }); assert(P('cannonInputHeld'));
});
check('Disconnect releases held abilities and resets edges for reconnect', () => {
  probe('chemistSuitUnlocked=true;');
  frame([4], { tick: true }); frame(null, { tick: true });
  assert(P('!cannonInputHeld&&prevGamepadButtons.length===0'));
  assert.equal(P('lightnings.length'), 1);
  frame(null, { tick: true }); assert.equal(P('lightnings.length'), 1);
  press(11); assert(P('headAimToggle'));
  frame(null); frame([11], { dt: 400 }); assert.equal(P('headAimToggle'), false);
});
check('Short or absent pads do not throw or keep stale button history', () => {
  press(11); assert(P('prevGamepadButtons.length===17'));
  pad = { axes: [0, 0], buttons: [{ pressed: false }] }; poll();
  assert.equal(P('prevGamepadButtons.length'), 1);
  frame(null); assert.equal(P('prevGamepadButtons.length'), 0);
});

// Capture the actual HUD drawing, so hidden labels without hidden button
// circles (or vice versa) cannot pass. Status text remains useful on a pad.
function hud() {
  const labels=[],circles=[];
  const text=ctx.text,ellipse=ctx.ellipse;
  ctx.text=(s,...args)=>{labels.push(String(s));text(s,...args);};
  ctx.ellipse=(...args)=>{circles.push(args);ellipse(...args);};
  try { probe('drawUI();drawJoysticks();'); }
  finally { ctx.text=text;ctx.ellipse=ellipse; }
  return {labels,circles};
}
function noTouchHud(seen) {
  assert(!seen.labels.some(s=>/^(RELOAD|RECHARGE|MELEE|DASH|GRENADE|FLASK|CANNON|HEADSHOT|MODE)(\n|$)/.test(s)));
  assert(!seen.circles.some(([x,y])=>x>=1095&&y>=360&&y<=500),'touch button circle still drawn');
  assert(!seen.circles.some(([x,y,w])=>w===120&&y===680&&(x===120||x===1080)),'joystick circle still drawn');
  assert(seen.labels.some(s=>s.startsWith('SCORE: ')),'controller hid the status HUD');
}
check('Idle connected controller hides touch buttons and joysticks without an input', () => {
  frame([]);assert(P('!window.showOnScreenControls'));
  noTouchHud(hud());
});
check('Rendering hides controls before polling and during a paused frame', () => {
  pad={axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false}))};
  probe('isPaused=true;window.showOnScreenControls=true;');
  noTouchHud(hud());probe('isPaused=false;');
});
check('Chemist flask and cannon touch buttons also disappear on a controller', () => {
  probe('chemistSuitUnlocked=true;');frame([]);noTouchHud(hud());
});
check('Disconnect restores touchscreen HUD and joysticks', () => {
  frame([]);frame(null);
  assert(P('window.showOnScreenControls'));
  const seen=hud();
  for(const s of ['RELOAD','MELEE','DASH'])assert(seen.labels.includes(s),'missing touch '+s);
  assert(seen.labels.some(s=>s.startsWith('GRENADE\n')));
  assert.equal(seen.circles.filter(([x,y,w])=>w===120&&y===680&&(x===120||x===1080)).length,2);
});
check('Touch events cannot reveal the HUD while a controller is connected', () => {
  frame([]);probe('isPaused=true;pauseMenuState="MAIN";touchStarted();');
  assert(P('!window.showOnScreenControls'));noTouchHud(hud());probe('isPaused=false;');
});
check('Disconnected pad slots leave touchscreen HUD visible', () => {
  pad={connected:false,axes:[0,0,0,0],buttons:[]};poll();
  assert.equal(P('connectedGamepad()'),null);
  assert(hud().labels.includes('MELEE'));
});
check('Axes-only controller also restores touch controls on disconnect', () => {
  pad={connected:true,axes:[0,0,0,0],buttons:[]};poll();
  assert(P('!window.showOnScreenControls'));noTouchHud(hud());
  frame(null);assert(P('window.showOnScreenControls'));
  assert(hud().labels.includes('MELEE'));
});

console.log('\n' + checks + ' gamepad checks passed: Backbone bindings, real dash/throw/cannon/melee/reload, press/hold/release, cycles, ownership, touch coexistence and reconnect.');

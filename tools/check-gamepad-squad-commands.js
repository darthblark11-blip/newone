// Real squad dispatch through a simulated standard-layout controller. These
// checks cover release/hold transitions and the equipment inputs they consume.
const assert = require('assert');
const { ctx, probe } = require('./harness');
const P = expression => probe('(' + expression + ')');
let pad = null, now = 1000, checks = 0, orders = [];
ctx.navigator.getGamepads = () => pad ? [pad] : [];
ctx.millis = () => now;
probe('isStoryMode=false;townsData={};startAtLevel(1);started=true;doTick=true;');
const issue = ctx.issueSquadCommand;
ctx.issueSquadCommand = (command, direction = 'NORTH') => {
  orders.push([command, direction]);
  return issue(command, direction);
};

function reset() {
  pad = null; now = 1000; orders = [];
  probe(`player=new Character(0,0,true);currentLevel=1;BIOME_ACTIVE=false;
    started=true;doTick=true;isDead=isWin=isPaused=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
    inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
    window.inNM0SecretOverlay=false;buildGhost=null;
    buildings=[];activeBuildings=[];activeParkingCars=[];barrels=[];invalidateColIndex();
    enemiesList=[{isFriendly:true,hp:100,dead:false,eType:'NORMAL',x:30,y:50,baseState:'HOLD_PERIMETER'}];
    leftStick={active:false,dx:0,dy:0,base:{x:120,y:680}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1080,y:680}};
    prevGamepadButtons=[];gamepadWasConnected=false;
    window.isDesktop=false;window.showOnScreenControls=true;
    meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;
    chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
    lastWeaponSwapTime=0;isStoryMode=false;smgUnlocked=true;
    swordPickedUp=true;window.pickaxeOwned=true;setMeleeTool('NONE');
    resetGamepadSquadCommands(null,false);`);
}
function frame(keys = [], dt = 50, integrated = false) {
  const down = new Set(keys || []);
  pad = keys === null ? null : {
    connected: true, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: down.has(i), value: down.has(i) ? 1 : 0 }))
  };
  ctx.__squadPad = pad; ctx.deltaTime = dt; now += dt;
  probe('frameCount++;');
  return integrated ? probe('handleGamepad();') : probe('handleGamepadSquadCommands(window.__squadPad,deltaTime);');
}
function open(integrated = false) {
  frame([13], 0, integrated);
  for (let i = 0; i < 7; i++) frame([13], 50, integrated);
  assert.equal(P('gamepadSquadCommands.stage'), 'COMMANDS');
}
function check(name, test) {
  reset(); test(); checks++;
  console.log('  ok   ' + name);
}

check('Down tap issues FOLLOW once on release through the native dispatcher', () => {
  assert.equal(frame([13]), true); assert.equal(orders.length, 0);
  assert.equal(frame([]), true);
  assert.deepEqual(orders, [['FOLLOW', 'NORTH']]);
  assert.equal(P('enemiesList[0].baseState'), 'FOLLOW');
  assert.equal(P('isPaused'), false);
  for (let i = 0; i < 10; i++) frame([]);
  assert.equal(orders.length, 1);
});
check('holding Down opens a persistent menu without selecting FOLLOW', () => {
  open();
  for (let i = 0; i < 30; i++) frame([13]);
  assert.equal(orders.length, 0);
  frame([]);
  for (let i = 0; i < 30; i++) frame([]);
  assert.equal(P('gamepadSquadCommands.stage'), 'COMMANDS');
  assert.equal(orders.length, 0);
});
for (const [key, command, state] of [[13, 'FOLLOW', 'FOLLOW'], [14, 'HOLD', 'HOLD_PERIMETER'], [15, 'SPREAD', 'SEARCH_DIRECTION']]) {
  check(`menu ${command} changes the ally state once and consumes held/released selection`, () => {
    open(); frame([]); assert.equal(frame([key]), true);
    assert.equal(P('enemiesList[0].baseState'), state);
    assert.equal(orders[0][0], command);
    if (command === 'HOLD') assert.deepEqual(JSON.parse(probe('JSON.stringify(enemiesList[0].holdPos)')), { x: 30, y: 50 });
    for (let i = 0; i < 20; i++) assert.equal(frame([key]), true);
    assert.equal(frame([]), true);
    assert.equal(orders.length, 1); assert.equal(frame([]), false);
  });
}
for (const [key, direction] of [[12, 'NORTH'], [13, 'SOUTH'], [14, 'WEST'], [15, 'EAST']]) {
  check(`SEARCH ${direction} uses a second directional menu`, () => {
    open(); frame([]); frame([12]);
    assert.equal(P('gamepadSquadCommands.stage'), 'SEARCH');
    for (let i = 0; i < 10; i++) frame([12]);
    assert.equal(orders.length, 0);
    frame([]); frame([key]);
    assert.deepEqual(orders, [['SEARCH', direction]]);
    assert.equal(P('enemiesList[0].searchDir'), direction);
  });
}
check('diagonal menu presses cannot accidentally select an order', () => {
  open(); frame([]); frame([14, 15]); frame([14]);
  assert.equal(orders.length, 0);
  frame([]); frame([14]); assert.equal(orders[0][0], 'HOLD');
});
check('no allies, dead allies and friendly civilians leave Down inactive', () => {
  for (const enemy of [null, { isFriendly: false }, { dead: true }, { hp: 0 },
    { isCityCivilian: true }, { cityPersonKey: 'test' }, { eType: 'FRONTIER_TRADER' }]) {
    probe(`enemiesList=${enemy ? JSON.stringify([{ isFriendly: true, hp: 100, dead: false, eType: 'NORMAL', ...enemy }]) : '[]'};
      resetGamepadSquadCommands(null,false);`);
    assert.equal(frame([13]), false);
    for (let i = 0; i < 10; i++) frame([13]);
    frame([]); assert.equal(orders.length, 0);
    assert.equal(P('gamepadSquadCommands.stage'), 'IDLE');
  }
});
check('an ally arriving during an ignored Down hold does not receive a late command', () => {
  probe('enemiesList=[];'); frame([13]);
  probe("enemiesList=[{isFriendly:true,hp:100,eType:'NORMAL'}];");
  for (let i = 0; i < 10; i++) frame([13]);
  frame([]); assert.equal(orders.length, 0);
  frame([13]); frame([]); assert.equal(orders.length, 1);
});
check('losing the last ally dismisses the menu without issuing a command', () => {
  open(); probe('enemiesList[0].dead=true;'); frame([]); frame([15]);
  assert.equal(orders.length, 0); assert.equal(P('gamepadSquadCommands.stage'), 'IDLE');
});
check('B cancels opening, command and search states without issuing FOLLOW', () => {
  for (const stage of ['HOLD', 'COMMANDS', 'SEARCH']) {
    reset();
    if (stage === 'HOLD') frame([13]);
    else { open(); if (stage === 'SEARCH') { frame([]); frame([12]); } }
    frame([1, 13]); frame([]);
    assert.equal(orders.length, 0); assert.equal(P('gamepadSquadCommands.stage'), 'IDLE');
  }
});
check('pause and stopped simulation cancel input without resuming gameplay', () => {
  for (const block of ['isPaused=true', 'doTick=false', 'isDead=true', 'player.hp=0', 'inTravelMenu=true']) {
    reset(); open(); probe(block); frame([14]); frame([]);
    assert.equal(orders.length, 0);
    if (block === 'isPaused=true') assert.equal(P('isPaused'), true);
  }
});
check('reset consumes held menu/selection buttons until neutral', () => {
  for (const key of [12, 13, 14, 15]) {
    reset(); frame([key]); probe('resetGamepadSquadCommands(window.__squadPad,true);');
    for (let i = 0; i < 12; i++) assert.equal(frame([key]), true);
    assert.equal(frame([]), true); assert.equal(frame([]), false);
    assert.equal(orders.length, 0);
  }
});
check('disconnect closes the menu and reconnect cannot complete a stale order', () => {
  open(); frame(null);
  for (let i = 0; i < 12; i++) frame([13]);
  frame([]); assert.equal(orders.length, 0);
  frame([13]); frame([]); assert.equal(orders[0][0], 'FOLLOW');
});
check('hold timing clamps long or invalid frames instead of opening on a stall', () => {
  frame([13]); frame([13], 2000); frame([13], -100); frame([13], NaN);
  assert.equal(P('gamepadSquadCommands.heldMs'), 100);
  assert.equal(P('gamepadSquadCommands.stage'), 'HOLD');
  for (let i = 0; i < 5; i++) frame([13], 50);
  assert.equal(P('gamepadSquadCommands.stage'), 'COMMANDS');
});
check('HUD paints responsive command/search crosses only for the connected controller', () => {
  const texts = [], originalText = ctx.text;
  ctx.text = value => texts.push(value);
  try {
    open(); ctx.width = 320; ctx.height = 568; probe('drawGamepadSquadCommands();');
    for (const label of ['SQUAD ORDERS', 'FOLLOW', 'SEARCH', 'HOLD', 'SPREAD']) assert(texts.includes(label));
    texts.length = 0; frame([]); frame([12]); probe('drawGamepadSquadCommands();');
    for (const label of ['SEARCH DIRECTION', 'NORTH', 'SOUTH', 'WEST', 'EAST']) assert(texts.includes(label));
    texts.length = 0; pad = null; probe('drawGamepadSquadCommands();'); assert.equal(texts.length, 0);
  } finally { ctx.text = originalText; ctx.width = 1200; ctx.height = 800; }
});

// Run this through the actual controller router once the remapping is wired.
check('controller router keeps equipment unchanged through squad menu and search selection', () => {
  const startingWeapon = P('player.currentWeapon.name');
  open(true); frame([], 50, true); frame([12], 50, true);
  assert.equal(P('meleeTool()'), 'NONE');
  frame([], 50, true); frame([15], 50, true);
  assert.deepEqual(orders, [['SEARCH', 'EAST']]);
  for (let i = 0; i < 15; i++) frame([15], 50, true);
  frame([], 50, true);
  assert.equal(P('player.currentWeapon.name'), startingWeapon);
  assert.equal(P('meleeTool()'), 'NONE');
  frame([15], 400, true);
  assert.notEqual(P('player.currentWeapon.name'), startingWeapon);
});
check('controller router leaves ordinary D-pad equipment cycling available without an ally', () => {
  probe('enemiesList=[];');
  for (let i = 0; i < 12; i++) frame([13], 50, true);
  frame([], 50, true); assert.equal(orders.length, 0);
  assert.equal(P('actorStance(player)'), 'STAND');
  assert.equal(P('stanceInput.hold'), null);
  frame([12], 400, true); assert.equal(P('meleeTool()'), 'SWORD');
  frame([], 400, true); frame([15], 400, true);
  assert(P('player.currentWeapon===WEAPONS.SMG'));
});
check('cancelling a squad menu with B leaves shovel climbing on a fresh X press', () => {
  probe("BIOME_ACTIVE=true;currentBiome=0;window.shovelOwned=true;setMeleeTool('SHOVEL');");
  const nativeDig = ctx.shovelDig, digs = [];
  ctx.shovelDig = direction => digs.push(direction);
  try {
    open(true); frame([], 50, true);
    for (let i = 0; i < 12; i++) frame([1], 50, true);
    frame([], 50, true);
    assert.deepEqual(digs, []); assert.equal(orders.length, 0);
    frame([2], 50, true); assert.deepEqual(digs, ['UP']);
  } finally { ctx.shovelDig = nativeDig; }
});

console.log(`${checks} squad controller checks passed`);

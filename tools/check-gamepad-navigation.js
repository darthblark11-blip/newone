// Follow real standard-layout controller edges through title, pause and story
// actions. A confirmation must never click the next screen or leak into combat.
const assert = require('assert');
const { ctx, probe } = require('./harness');
const P = source => probe('(' + source + ')');
let pad = null, now = 10000, checks = 0;
ctx.navigator.getGamepads = () => pad ? [pad] : [];
ctx.millis = () => now;
function check(name, fn) { fn(); checks++; console.log('  ok   ' + name); }
function buttons(keys) {
  const held = new Set(keys);
  return Array.from({length:17}, (_,i) => ({pressed:held.has(i),value:held.has(i)?1:0}));
}
function poll(keys = [], axes = [0,0,0,0], gameplay = false) {
  if (!pad) pad = {index:0,id:'Backbone One Navigation QA',connected:true,axes,buttons:buttons(keys)};
  else {pad.axes=axes;pad.buttons=buttons(keys);}
  now += 16;
  probe('frameCount++;syncGamepadCombatContext();handleControllerUIInput();');
  if (gameplay) probe('handleTouches();handleGamepad();handleDesktop();');
}
function press(button, gameplay = false) {poll([],undefined,gameplay);poll([button],undefined,gameplay);}
function disconnect() {pad=null;now+=16;probe('frameCount++;handleControllerUIInput();');}
function reset() {
  pad=null;ctx.touches=[];
  probe('resetRunState();isStoryMode=false;currentLevel=currentBiome=1;BIOME_ACTIVE=false;window.lastPauseTime=0;window.isDesktop=false;window.showOnScreenControls=true;');
  disconnect();poll();poll();
}
function world() {
  reset();
  probe('started=true;player=new Character(0,0,true);jetpackUnlocked=true;setMeleeTool("NONE");');
  poll([],undefined,true);
}
function ui() {return P('controllerUIScreen()');}
function focused() {return P('controllerUIScreen().buttons.filter(b=>!b.disabled)[controllerUIInput.focus]');}
function select(pattern) {
  const screen=ui(),list=screen.buttons.filter(b=>!b.disabled),index=list.findIndex(b=>pattern.test(b.label));
  assert(index>=0,'missing controller choice '+pattern+' in '+screen.buttons.map(b=>b.label));
  ctx.__navigationFocus=index;ctx.__navigationId=list[index].id;
  probe('controllerUIInput.focus=__navigationFocus;controllerUIInput.history.set(controllerUIScreen().key,__navigationId);');
  return list[index];
}

check('Connecting with A held cannot start or choose a title option', () => {
  reset();disconnect();poll([0]);poll([0]);
  assert(!P('selectingDifficulty||started'));
});
check('A opens the chosen mode once; held A cannot also choose its difficulty', () => {
  reset();select(/ARCADE MODE/i);press(0);
  assert(P('selectingDifficulty&&!started&&!pendingStoryMode'));
  for(let i=0;i<8;i++)poll([0]);
  assert(P('selectingDifficulty&&!started'));
});
check('D-pad navigates difficulty and B goes back without selecting', () => {
  poll();select(/^NORMAL$/i);press(13);
  assert(/HARD/i.test(focused().label));
  press(1);assert(!P('selectingDifficulty||started'));
  poll([1]);assert(!P('selectingDifficulty||started'));
});
check('A starts a selected normal run through the native start action', () => {
  poll();select(/ARCADE MODE/i);press(0);poll();select(/^NORMAL$/i);press(0);
  assert(P('started&&!isHardMode&&!!player&&!isStoryMode'));
});
check('Every numbered title level stays on screen at phone sizes', () => {
  for(const [w,h] of [[320,568],[390,844],[844,390]]) {
    reset();ctx.width=w;ctx.height=h;
    const list=ui().buttons;
    for(const b of list)assert(b.x>=0&&b.y>=0&&b.x+b.w<=w+.01&&b.y+b.h<=h+.01,
      'controller choice is off-screen: '+JSON.stringify({w,h,b}));
  }
  ctx.width=1200;ctx.height=800;
});
check('Left stick moves menu focus, with neutral required for a second immediate move', () => {
  world();probe('isPaused=true;pauseMenuState="MAIN";');poll();
  select(/^CONTINUE$/i);const before=P('controllerUIInput.focus');
  poll([], [0,.9,0,0]);const after=P('controllerUIInput.focus');assert.notEqual(after,before);
  for(let i=0;i<4;i++)poll([], [0,.9,0,0]);
  assert.equal(P('controllerUIInput.focus'),after,'menu options skip immediately while held');
  poll();poll([], [0,.9,0,0]);assert.notEqual(P('controllerUIInput.focus'),after);
});
check('Landscape pause options fit and their displayed Settings button remains touchable', () => {
  world();ctx.width=844;ctx.height=390;probe('isPaused=true;pauseMenuState="MAIN";');poll();
  const screen=ui();
  for(const b of screen.buttons)assert(b.x>=0&&b.y>=0&&b.x+b.w<=844&&b.y+b.h<=390,
    'landscape pause choice is off-screen: '+b.label);
  const button=screen.buttons.find(b=>b.id==='SETTINGS');
  ctx.mouseX=button.x+button.w/2;ctx.mouseY=button.y+button.h/2;
  probe('touches=[];touchStarted();');assert.equal(P('pauseMenuState'),'SETTINGS');
  ctx.width=1200;ctx.height=800;
});
check('A opens pause Settings and controls without a second held confirmation', () => {
  world();probe('isPaused=true;pauseMenuState="MAIN";');poll();select(/^SETTINGS$/i);press(0);
  assert.equal(P('pauseMenuState'),'SETTINGS');
  poll([0]);assert.equal(P('pauseMenuState'),'SETTINGS');
  poll();select(/GAMEPAD CONTROLS/i);press(0);
  assert.equal(P('pauseMenuState'),'GAMEPAD_CONTROLS');
});
check('A keeps the same military plus button focused when minus becomes enabled', () => {
  world();
  probe('const roster=poolLedger();roster.popMilitaryM=5;roster.popTotal=5;isPaused=true;pauseMenuState="MILITARY_BRING";militarySelectionM=militarySelectionF=0;');
  poll();select(/^M \+$/);press(0);assert.equal(P('militarySelectionM'),1);
  poll();assert.equal(focused().id,'M_PLUS');
  press(0);assert.equal(P('militarySelectionM'),2);
  poll([0]);assert.equal(P('militarySelectionM'),2,'held confirmation repeats the allocation');
});
check('B unwinds one pause level per press and never dashes on resume', () => {
  world();probe('isPaused=true;pauseMenuState="GAMEPAD_CONTROLS";');poll();
  press(1,true);assert(P('isPaused&&pauseMenuState==="SETTINGS"'));
  poll([1],undefined,true);assert(P('isPaused&&pauseMenuState==="SETTINGS"'));
  press(1,true);assert(P('isPaused&&pauseMenuState==="MAIN"'));
  press(1,true);assert(P('!isPaused&&player.dashTimer===0'));
  poll([1],undefined,true);assert.equal(P('player.dashTimer'),0);
});
check('A resumes a pause; B then dashes once and respects cooldown/unlock gates', () => {
  world();probe('isPaused=true;pauseMenuState="MAIN";');poll();select(/^CONTINUE$/i);press(0,true);
  assert(P('!isPaused&&player.dashTimer===0'));
  press(1,true);assert(P('player.dashTimer>0'));
  const original=P('player.dashTimer');poll([1],undefined,true);assert.equal(P('player.dashTimer'),original);
  for(const block of ['jetpackUnlocked=false','player.dashCooldown=5','player.dashTimer=5','player.meleeTimer=5']) {
    world();probe(block);let calls=0;P('player').activateDash=()=>calls++;press(1,true);assert.equal(calls,0,block);
  }
});
check('Reconnecting with B held cannot back out of a pause', () => {
  world();probe('isPaused=true;pauseMenuState="MAIN";');poll();disconnect();poll([1]);poll([1]);
  assert(P('isPaused'));
  poll();press(1);assert(!P('isPaused'));
});
check('Reconnecting with B held cannot turn that held input into a dash', () => {
  world();disconnect();poll([1],undefined,true);poll([1],undefined,true);
  assert.equal(P('player.dashTimer'),0);
  press(1,true);assert(P('player.dashTimer>0'));
});
check('B cancels squad orders without dashing, then becomes dash after release', () => {
  world();
  probe('enemiesList=[{isFriendly:true,hp:100,dead:false,eType:"NORMAL",x:30,y:50,baseState:"HOLD_PERIMETER"}];');
  for(let i=0;i<25;i++)poll([13],undefined,true);
  assert.equal(P('gamepadSquadCommands.stage'),'COMMANDS');
  poll([],undefined,true);poll([1],undefined,true);
  assert.equal(P('player.dashTimer'),0,'squad cancel also activated dash');
  for(let i=0;i<5;i++)poll([1],undefined,true);
  assert.equal(P('player.dashTimer'),0);
  press(1,true);assert(P('player.dashTimer>0'));
});
check('Shovel keeps B dash separate from X climb', () => {
  world();probe('BIOME_ACTIVE=true;window.shovelOwned=true;setMeleeTool("SHOVEL");');
  const dig=ctx.shovelDig,requests=[];ctx.shovelDig=direction=>requests.push(direction);
  try {
    press(1,true);assert(P('player.dashTimer>0'));assert.deepEqual(requests,[]);
    probe('player.dashTimer=player.dashCooldown=0;');
    press(2,true);assert.deepEqual(requests,['UP']);
  } finally {ctx.shovelDig=dig;}
});
check('A advances a native tap-to-continue speech exactly once per press', () => {
  world();probe('isStoryMode=true;inStoryRoom=true;storyPhase=3;');poll();press(0);
  assert.equal(P('storyPhase'),4);
  for(let i=0;i<8;i++)poll([0]);assert.equal(P('storyPhase'),4);
  press(0);assert.equal(P('storyPhase'),5);
});
check('Directional dialogue choices use A to select the focused native response', () => {
  world();probe('isStoryMode=true;inFarmCutscene=true;farmPhase=3;');poll();
  assert(ui().buttons.length>=2,'farm conversation has no controller options');
  probe('controllerUIInput.focus=0;');press(13);press(0);
  assert(P('!inFarmCutscene&&streakMsgText==="FARMERS AGGROED!"'));
});
check('Holding A through the victory countdown cannot auto-continue', () => {
  world();probe('isWin=true;winTimer=20;');poll();press(0);
  assert(P('isWin&&currentLevel===1'));
  probe('winTimer=0;');poll([0]);assert(P('isWin&&currentLevel===1'));
});
check('Level 8 victory retains its native Continue route instead of restarting', () => {
  world();probe('currentLevel=currentBiome=8;isWin=true;winTimer=0;');poll();
  assert(ui().buttons.some(b=>b.id==='CONTINUE'),'HQ victory lost Continue');
  select(/^CONTINUE$/i);press(0);assert(P('currentLevel===2&&!isWin&&started'));
});
check('Victory upgrades open with A and B returns to the result panel', () => {
  world();probe('isWin=true;winTimer=0;');poll();select(/^CONTINUE$/i);press(14);
  assert.equal(focused().id,'UPGRADES');press(0);assert(P('inUpgradeMenu&&isWin'));
  poll([0]);assert(P('inUpgradeMenu&&isWin'));
  press(1);assert(P('!inUpgradeMenu&&isWin'));
});
check('Saloon pause confirms Resume with A and consumes the held confirmation', () => {
  world();probe('currentLevel=currentBiome=3;BIOME_ACTIVE=true;enterFrontierSaloon();isPaused=true;pauseMenuState="MAIN";');
  poll();select(/^RESUME$/i);press(0);probe('frontierSaloonInput(true);');
  assert(P('frontierSaloonIsInside()&&!isPaused&&!_frontierSaloonSession.menu'));
  poll([0]);probe('frontierSaloonInput(true);');
  assert(P('frontierSaloonIsInside()&&!isPaused&&!_frontierSaloonSession.menu'));
});
check('A chooses the directional saloon option without a second duel interaction', () => {
  world();probe('currentLevel=currentBiome=3;BIOME_ACTIVE=true;enterFrontierSaloon();_frontierSaloonSession.menu=true;');
  poll();press(13);assert.equal(focused().id,'DUEL');
  press(0);probe('frontierSaloonInput(true);');assert(P('_frontierSaloonSession.mode==="DUEL"'));
  poll([0]);probe('frontierSaloonInput(true);');
  assert(P('_frontierSaloonSession.duel.projectiles.length===0'));
});
check('A closes acquisition overlays without repeating held input in gameplay', () => {
  world();probe('window.inNM0SecretOverlay=true;');poll();press(0,true);
  assert(!P('window.inNM0SecretOverlay'));
  assert(P('player.dashTimer===0&&!meleeInputHeld&&!grenadeInputHeld&&!cannonInputHeld'));
  for(let i=0;i<4;i++)poll([0],undefined,true);
  assert(P('player.dashTimer===0'));
});
check('Controller confirmation preserves real pointer state for touch and mouse', () => {
  reset();ctx.mouseX=19;ctx.mouseY=37;ctx.mouseIsPressed=false;ctx.touches=[{id:99,x:14,y:29}];
  const snapshot=JSON.stringify(ctx.touches);select(/ARCADE MODE/i);press(0);
  assert.equal(ctx.mouseX,19);assert.equal(ctx.mouseY,37);assert.equal(ctx.mouseIsPressed,false);
  assert.equal(JSON.stringify(ctx.touches),snapshot);
  ctx.touches=[];
});
check('Acquisition confirmation with a shovel neither digs nor captures a real touch', () => {
  world();probe('BIOME_ACTIVE=true;window.shovelOwned=true;setMeleeTool("SHOVEL");window.inNM0SecretOverlay=true;');
  poll();
  ctx.mouseX=48;ctx.mouseY=63;ctx.mouseIsPressed=false;ctx.touches=[{id:81,x:80,y:640}];
  const touch=JSON.stringify(ctx.touches),dig=ctx.shovelDig,requests=[];ctx.shovelDig=kind=>requests.push(kind);
  try {press(0);assert(!P('window.inNM0SecretOverlay'));assert.deepEqual(requests,[]);}
  finally {ctx.shovelDig=dig;}
  assert.equal(ctx.mouseX,48);assert.equal(ctx.mouseY,63);assert.equal(ctx.mouseIsPressed,false);
  assert.equal(JSON.stringify(ctx.touches),touch);ctx.touches=[];
});
console.log('\n'+checks+' controller navigation checks passed.');

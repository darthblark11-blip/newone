// Physical fresh-edge routing for linked slips, including recovery handoffs.
// The same input reader and
// update loop used by gameplay run here; no test directly installs a pending link.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let checks = 0, pad = null;
const keys = new Set();
ctx.keyIsDown = code => keys.has(code);
ctx.navigator.getGamepads = () => pad ? [null, pad] : [];
ctx.width = 390; ctx.height = 844; ctx.deltaTime = 20;
const run = code => probe(code);
function check(value, label) { assert.ok(value, label); checks++; }
const kinds = ['LEFT', 'RIGHT', 'FORWARD', 'BACK'];
const codes = {LEFT:32, RIGHT:72, FORWARD:67, BACK:86};
const buttons = {LEFT:2, RIGHT:1, FORWARD:3, BACK:0};
function fresh() {
  keys.clear(); pad = null; ctx.touches = []; ctx.mouseIsPressed = false;
  run(`if(_frontierSaloonSession)exitFrontierSaloon();
    player=new Character(0,0,true);BIOME_ACTIVE=false;started=true;
    buildings=[];activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
    isPaused=isDead=isWin=inCutscene=false;meleeUnlocked=true;
    chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
    swordPickedUp=false;window.pickaxeOwned=false;setMeleeTool('NONE');
    leftStick={active:false,dx:0,dy:0,base:{x:66,y:height-107}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-76,y:height-107}};
    meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;prevGamepadButtons=[];gamepadWasConnected=false;
    window.isDesktop=false;window.showOnScreenControls=true;window.__frontierConsumedTouches=new Set();
    beginWorldBoxing(player);`);
}
function connect(down = [], index = 0) {
  const pressed = new Set(down);
  pad = {connected:true, index, id:'chain-test-'+index, axes:[0,0,0,0],
    buttons:Array.from({length:17},(_,i)=>({pressed:pressed.has(i),value:pressed.has(i)?1:0}))};
}
function read(state = '') { return run('boxingReadInput(player'+state+');'); }
function advance(ms) { run(`boxingUpdate(player,${ms},[]);`); }
function press(source, kind, id = 1) {
  if (source === 'KEY') keys.add(codes[kind]);
  else if (source === 'PAD') pad.buttons[buttons[kind]].pressed = true;
  else {
    const b = run(`boxingControlLayout().buttons.find(b=>b.action==='DODGE_${kind}')`);
    ctx.touches.push({id, x:b.x, y:b.y});
  }
}
function release(source, kind, id = 1) {
  if (source === 'KEY') keys.delete(codes[kind]);
  else if (source === 'PAD') pad.buttons[buttons[kind]].pressed = false;
  else ctx.touches = ctx.touches.filter(t=>t.id!==id);
}
function queued(source = 'KEY') {
  fresh(); if (source === 'PAD') connect();
  press(source,'LEFT'); read(); advance(30);
  press(source,'RIGHT',2);
  const result = read();
  check(result.actions.some(a=>a.kind==='DODGE'&&a.side==='RIGHT'&&a.accepted&&a.queued), source+' reports an accepted early link as queued');
  check(run("player._boxing.dodge.kind==='LEFT'&&player._boxing.dodge.pending.kind==='RIGHT'"), source+' preserves the outgoing slip until its apex');
}

for (const source of ['KEY','TOUCH','PAD']) for (const first of kinds) for (const next of kinds.filter(k=>k!==first)) {
  fresh(); if (source === 'PAD') connect();
  press(source,first); read(); advance(30);
  press(source,next,2); const result = read();
  check(result.actions.some(a=>a.kind==='DODGE'&&a.side===next&&a.accepted&&a.queued), source+' routes '+first+' → '+next+' before the apex');
  advance(64);
  check(run(`player._boxing.dodge.kind==='${first}'`), source+' '+first+' → '+next+' does not cancel early');
  const before = run('boxingPose(player).head');
  advance(2);
  const after = run('boxingPose(player).head');
  check(run(`player._boxing.dodge.kind==='${next}'&&!player._boxing.dodge.pending`), source+' '+first+' → '+next+' switches across the actual 95ms boundary');
  check(Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z)<1, source+' '+first+' → '+next+' starts from the previous head position');
  for (let i=0;i<32;i++) { read(); advance(20); }
  check(run('!player._boxing.dodge&&player._boxing.attackCount===0'), source+' holds do not repeat links or throw attacks');
}

// These are deliberate late button presses, not a buffered apex combo. Exercise
// every direction pair through gameplay's actual input path, just after the
// apex hold, halfway back to neutral, and immediately before the dodge ends.
for (const source of ['KEY','TOUCH','PAD']) for (const elapsed of [206,300,429])
  for (const first of kinds) for (const next of kinds.filter(k=>k!==first)) {
    fresh(); if (source === 'PAD') connect();
    press(source,first); read(); advance(elapsed);
    const before = run('boxingPose(player).head');
    press(source,next,2); const result = read();
    const after = run('boxingPose(player).head');
    const label = source+' '+first+' → '+next+' at '+elapsed+'ms';
    check(result.actions.some(a=>a.kind==='DODGE'&&a.side===next&&a.accepted&&!a.queued), label+' accepts the fresh late press immediately');
    check(run(`player._boxing.dodge.kind==='${next}'&&player._boxing.dodge.elapsedMs===0&&!player._boxing.dodge.pending`), label+' replaces the outgoing recovery with the requested movement');
    check(Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z)<1e-8, label+' begins at the currently drawn head position');
    advance(95);
    check(run(`player._boxing.dodge.kind==='${next}'`), label+' reaches its own apex without replaying the previous direction');
    for (let i=0;i<32;i++) { read(); advance(20); }
    check(run('!player._boxing.dodge&&player._boxing.attackCount===0'), label+' held source buttons cannot refresh movement or trigger a punch');
    release(source,first); release(source,next,2); read();
    check(run('!player._boxing.dodge&&player._boxing.attackCount===0'), label+' releasing the held buttons cannot replay either dodge');
  }

for (const source of ['KEY','TOUCH','PAD']) for (const kind of kinds) {
  fresh(); if (source === 'PAD') connect();
  press(source,kind); read(); advance(300);
  release(source,kind); read(); press(source,kind);
  const result = read();
  check(result.actions.some(a=>a.kind==='DODGE'&&a.side===kind&&!a.accepted&&!a.queued), source+' '+kind+' fresh same-direction recovery press does not refresh the dodge');
  check(run(`player._boxing.dodge.kind==='${kind}'&&player._boxing.dodge.elapsedMs===300&&!player._boxing.dodge.pending`), source+' '+kind+' recovery timing remains unchanged after a duplicate direction');
  advance(130);
  for (let i=0;i<8;i++) { read(); advance(20); }
  check(run('!player._boxing.dodge&&player._boxing.attackCount===0'), source+' '+kind+' held duplicate input cannot restart after recovery');
}

// A late counter can hold a little more sway than the recovering dodge alone.
// The next physical dodge must start from that resolved, visible pose too.
for (const source of ['KEY','TOUCH','PAD']) {
  fresh(); if (source === 'PAD') connect();
  press(source,'RIGHT'); read(); advance(300);
  if (source === 'KEY') keys.add(69);
  else if (source === 'PAD') pad.buttons[6].pressed=true;
  else {
    const b=run("boxingControlLayout().buttons.find(b=>b.action==='LEFT_STRAIGHT')");
    ctx.touches.push({id:3,x:b.x,y:b.y});
  }
  read();
  if (source === 'KEY') keys.delete(69);
  else if (source === 'PAD') pad.buttons[6].pressed=false;
  else ctx.touches=ctx.touches.filter(t=>t.id!==3);
  read(); advance(20);
  check(run("player._boxing.punch&&player._boxing.punch.kind==='LEFT_STRAIGHT'&&player._boxing.punch.slipSide===1"), source+' late native counter preserves its opposite-hand slip linkage');
  const before=run('boxingPose(player).head');
  press(source,'FORWARD',2); const result=read(), after=run('boxingPose(player).head');
  check(result.actions.some(a=>a.kind==='DODGE'&&a.side==='FORWARD'&&a.accepted&&!a.queued), source+' may duck immediately during the late slip counter');
  check(Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z)<1e-8, source+' late counter handoff preserves the resolved head position, including punch-carried sway');
  check(run("player._boxing.punch.kind==='LEFT_STRAIGHT'&&player._boxing.attackCount===1&&!player._boxing.queuedPunch"), source+' dodge handoff does not cancel, duplicate or queue the counter punch');
  for (let i=0;i<32;i++) { read(); advance(20); }
  check(run('!player._boxing.dodge&&player._boxing.attackCount===1'), source+' held counter and dodge buttons cannot create another movement or punch');
}

for (const source of ['KEY','TOUCH','PAD']) {
  fresh(); if (source === 'PAD') connect();
  press(source,'LEFT'); press(source,'RIGHT',2); read();
  check(run("player._boxing.dodge.kind==='LEFT'&&!player._boxing.dodge.pending"), source+' simultaneous fresh chords produce one slip, without an artificial buffered combo');
  advance(110); read();
  check(run("player._boxing.dodge.kind==='LEFT'&&!player._boxing.dodge.pending"), source+' chord holds remain consumed at the apex');
  release(source,'RIGHT',2); read(); press(source,'RIGHT',2);
  const before=run('boxingPose(player).head'), result=read(), after=run('boxingPose(player).head');
  check(result.actions.some(a=>a.kind==='DODGE'&&a.side==='RIGHT'&&a.accepted&&!a.queued), source+' fresh apex press begins the next slip immediately');
  check(Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z)<1e-8, source+' immediate apex link does not snap the head to neutral');
}

for (const source of ['KEY','TOUCH','PAD']) {
  queued(source); run('isPaused=true;'); read();
  check(run('!player._boxing.dodge.pending'), source+' pause clears a buffered link while retaining the current slip');
  run('isPaused=false;'); read(); advance(100);
  check(run("player._boxing.dodge.kind==='LEFT'&&!player._boxing.dodge.pending"), source+' held buffered direction cannot resume itself after pause');
}
queued('TOUCH'); ctx.touches.push({id:3,x:ctx.width-25,y:25}); keys.add(codes.FORWARD);
const touchPause=read();
check(touchPause.paused&&run('isPaused&&!player._boxing.dodge.pending'), 'A captured pause touch cancels the link during its own poll before later fresh keys can create another');
queued(); run('var disabledState=boxingNativeInputState(player);disabledState.disabled=true;'); read(',disabledState');
check(run('!player._boxing.dodge.pending'), 'A scene-disabled reader clears its pending slip');
run('disabledState.disabled=false;'); read(',disabledState'); advance(100);
check(run("player._boxing.dodge.kind==='LEFT'"), 'Re-enabling a scene does not replay a consumed link');

queued('PAD'); pad=null; read();
check(run('!player._boxing.dodge.pending&&player._boxing.attackCount===0'), 'Disconnect discards the queued face-button link without a release attack');
connect([buttons.RIGHT]); read(); advance(100);
check(run("player._boxing.dodge.kind==='LEFT'&&!player._boxing.dodge.pending"), 'A right slip held during reconnection cannot resurrect the canceled chain');
queued('PAD'); connect([buttons.RIGHT],1); read(); advance(100);
check(run("player._boxing.dodge.kind==='LEFT'&&!player._boxing.dodge.pending"), 'A different live controller consumes its held face buttons and cancels the old queue');

queued(); run('var exitDodge=player._boxing.dodge;'); keys.add(9); read();
check(run('!boxingActive(player)&&!exitDodge.pending'), 'Stance exit clears the queued link before removing the rig');
queued(); run('var resetDodge=player._boxing.dodge;boxingResetInput(player);');
check(run('!resetDodge.pending'), 'Resetting input clears a pending chain without destroying the current head pose');
queued(); run('boxingSeedEntryInput(player);'); advance(100);
check(run("player._boxing.dodge.kind==='LEFT'&&!player._boxing.dodge.pending"), 'Seeding resumed physical inputs cancels old buffered movement');

function room() {
  fresh(); run(`boxingExit(player);isStoryMode=false;townsData={};startAtLevel(3);started=true;
    isPaused=isDead=isWin=inCutscene=false;
    inStoryIntro=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=inDarchonCall=false;
    player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;
    enterFrontierSaloon();startFrontierSaloonBrawl();`);
  press('KEY','LEFT'); read(',_frontierSaloonSession.boxingInput'); advance(30);
  press('KEY','RIGHT',2); read(',_frontierSaloonSession.boxingInput');
  check(run("player._boxing.dodge.pending.kind==='RIGHT'"), 'Saloon input buffers a fresh second direction');
}
room(); run(`var koDodge=player._boxing.dodge;
  frontierSaloonBeginPlayerKnockout({kind:'RIGHT_HOOK',level:'HEAD',damage:30,angle:0});`);
check(run("_frontierSaloonSession.brawl==='KNOCKOUT'&&!player._boxing&&!koDodge.pending"), 'Nonfatal player knockout consumes the pending link before the articulated fall');
room(); run(`var finishDodge=player._boxing.dodge;
  _frontierSaloonSession.fighters.forEach(c=>frontierSaloonKnockOut(c,0,{kind:'LEFT_HOOK',level:'HEAD'}));
  frontierSaloonClearWave(_frontierSaloonSession);`);
check(run("_frontierSaloonSession.brawl==='INTERMISSION'&&boxingActive(player)&&!finishDodge.pending"), 'Round finish clears the buffered link but preserves the outgoing animation and boxing model');
run('frontierSaloonAdvanceGauntlet(_frontierSaloonSession,100);');
check(run("player._boxing.dodge.kind==='LEFT'"), 'Post-KO follow-through cannot switch to a stale queued dodge');
run('exitFrontierSaloon();');

fresh(); connect([3]); run('boxingSeedPhysicalEntryInput(player);'); read(); advance(20);
check(run("!player._boxing.dodge&&player._boxing.preparedPunch.kind==='LEFT_STRAIGHT'"), 'Native held Y stance entry remains its original attack alias');
pad.buttons[3].pressed=false; read(); advance(80);
check(run("player._boxing.punch.kind==='LEFT_STRAIGHT'&&player._boxing.attackCount===1"), 'Releasing entry Y throws exactly its intended left-hand punch');
advance(300); pad.buttons[3].pressed=true; read(); advance(30); pad.buttons[1].pressed=true; read();
check(run("player._boxing.dodge.kind==='FORWARD'&&player._boxing.dodge.pending.kind==='RIGHT'"), 'Fresh Y becomes duck and can link normally after the entry punch');
console.log('Boxing dodge chain input: '+checks+' physical edge, continuity and lifecycle checks passed.');

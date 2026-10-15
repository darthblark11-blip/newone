// Both selectable boxing layouts exercise the production physical input reader.
// In particular, changing button roles may never release an attack from a hold
// started before a pause, disconnect or settings change.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let pad = null, checks = 0;
const keys = new Set();
ctx.keyIsDown = code => keys.has(code);
ctx.navigator.getGamepads = () => pad ? [null, pad] : [];
ctx.width = 390; ctx.height = 844; ctx.deltaTime = 20;
const run = code => probe(code);
const punches = [[2,'LEFT_STRAIGHT'],[3,'RIGHT_JAB'],[0,'LEFT_HOOK'],[1,'RIGHT_HOOK']];
const dodges = [[4,'LEFT'],[5,'RIGHT'],[7,'FORWARD'],[6,'BACK']];
function check(value,label) {assert.ok(value,label);checks++;}
function connect(buttons = [], index = 0) {
  const down = new Set(buttons);
  pad = {connected:true,index,id:'defensive-'+index,axes:[0,0,0,0],
    buttons:Array.from({length:17},(_,i)=>({pressed:down.has(i),value:down.has(i)?1:0}))};
}
function fresh(scheme = 'DEFENSIVE') {
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
    pauseControlsInput.buttons=[];pauseControlsInput.keys=new Set();pauseControlsInput.pad=null;pauseControlsInput.screen='';
    gamepadControlSettings.boxing='${scheme}';beginWorldBoxing(player);`);
}
function read(frames = 1) {let result;for(let i=0;i<frames;i++)result=run('boxingReadInput(player);');return result;}
function advance(ms) {run(`boxingUpdate(player,${ms},[]);`);}
function tap(button) {pad.buttons[button].pressed=true;read();pad.buttons[button].pressed=false;return read();}
function beginRoom() {
  run(`isStoryMode=false;townsData={};startAtLevel(3);started=true;isPaused=isDead=isWin=inCutscene=false;
    inStoryIntro=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=inDarchonCall=false;
    player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;enterFrontierSaloon();startFrontierSaloonBrawl();`);
}
function room() {run('handlePauseMenuInput();frontierSaloonInput(true);');}

for(const [button,kind] of punches) {
  fresh();connect([button]);read();
  check(run(`player._boxing.preparedPunch.kind==='${kind}'&&player._boxing.attackCount===0&&!player._boxing.dodge`),`${kind} is prepared by face button ${button} without a slip`);
  pad.buttons[button].pressed=false;read(2);
  check(run(`player._boxing.punch.kind==='${kind}'&&player._boxing.punch.level==='HEAD'&&player._boxing.attackCount===1`),`${kind} releases one head punch`);

  fresh();connect([button]);read(14);
  check(run(`player._boxing.preparedPunch.kind==='${kind}'&&player._boxing.preparedPunch.amount===1&&player._boxing.attackCount===0`),`${kind} can hold a full body preparation`);
  pad.buttons[button].pressed=false;read(2);
  check(run(`player._boxing.punch.kind==='${kind}'&&player._boxing.punch.level==='BODY'&&player._boxing.attackCount===1`),`${kind} body shot throws only on release`);

  fresh();connect([button]);read(14);run('isPaused=true;');read();run('isPaused=false;');read(2);
  pad.buttons[button].pressed=false;read();
  check(run('player._boxing.attackCount===0&&!player._boxing.preparedPunch'),`${kind} paused hold releases harmlessly`);
  tap(button);
  check(run(`player._boxing.punch.kind==='${kind}'&&player._boxing.punch.level==='HEAD'`),`${kind} accepts a fresh post-pause tap`);

  fresh();connect([button]);read(14);pad=null;read();
  check(run('player._boxing.attackCount===0&&!player._boxing.preparedPunch'),`${kind} disconnect cancels its body load`);
  connect([button]);read(12);pad.buttons[button].pressed=false;read();
  check(run('player._boxing.attackCount===0'),`${kind} held during reconnection cannot become a release punch`);
  tap(button);
  check(run(`player._boxing.punch.kind==='${kind}'&&player._boxing.punch.level==='HEAD'`),`${kind} works after reconnect release and fresh press`);
}

for(const [button,kind] of dodges) {
  fresh();connect([button]);read();
  check(run(`player._boxing.dodge.kind==='${kind}'&&player._boxing.attackCount===0&&!player._boxing.preparedPunch`),`Shoulder ${button} selects ${kind} without an attack`);
  for(let i=0;i<35;i++){read();advance(20);}
  check(run('!player._boxing.dodge&&player._boxing.attackCount===0'),`${kind} held shoulder cannot repeat`);
  pad.buttons[button].pressed=false;read();pad.buttons[button].pressed=true;read();
  check(run(`player._boxing.dodge.kind==='${kind}'`),`${kind} accepts a fresh shoulder press`);

  fresh();connect([button]);run('isPaused=true;');read();run('isPaused=false;');read();
  check(run('!player._boxing.dodge&&player._boxing.attackCount===0'),`${kind} held through pause remains consumed`);
  pad.buttons[button].pressed=false;read();pad.buttons[button].pressed=true;read();
  check(run(`player._boxing.dodge.kind==='${kind}'`),`${kind} works after a fresh post-pause press`);

  fresh();connect();read();pad=null;read();connect([button]);read();
  check(run('!player._boxing.dodge&&player._boxing.attackCount===0'),`${kind} held on reconnection stays consumed`);
  pad.buttons[button].pressed=false;read();pad.buttons[button].pressed=true;read();
  check(run(`player._boxing.dodge.kind==='${kind}'`),`${kind} works after reconnect release and fresh press`);
}

for(const [firstButton,first] of dodges)for(const [nextButton,next] of dodges.filter(([,kind])=>kind!==first))for(const elapsed of [30,300]) {
  fresh();connect([firstButton]);read();advance(elapsed);
  const before=run('boxingPose(player).head');
  pad.buttons[nextButton].pressed=true;const result=read();
  const action=result.actions.find(a=>a.kind==='DODGE'&&a.side===next);
  check(action&&action.accepted&&action.queued===(elapsed<95),`${first} -> ${next} at ${elapsed}ms routes through the existing early/late link behavior`);
  if(elapsed<95)advance(95-elapsed);
  const after=run('boxingPose(player).head');
  if(elapsed===300)check(Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z)<1e-8,`${first} -> ${next} late handoff preserves the visible head position`);
  check(run(`player._boxing.dodge.kind==='${next}'&&player._boxing.attackCount===0`),`${first} -> ${next} switches directions without a punch`);
}

for(const scheme of ['STANDARD','DEFENSIVE'])for(const button of [0,1,2,3,4,5,6,7]) {
  fresh(scheme);connect([button]);read(12);
  run(`gamepadControlSettings.boxing='${scheme==='STANDARD'?'DEFENSIVE':'STANDARD'}';`);
  read(12);pad.buttons[button].pressed=false;read();
  check(run('player._boxing.attackCount===0&&!player._boxing.preparedPunch'),`${scheme} button ${button} changing roles cannot throw on release`);
  check(run('!player._boxing.dodge||!player._boxing.dodge.pending'),`${scheme} button ${button} changing roles cannot queue a ghost dodge`);
  advance(700);
  pad.buttons[button].pressed=true;read();pad.buttons[button].pressed=false;read();
  const nextPunch=(scheme==='STANDARD'?punches:[[6,'LEFT_STRAIGHT'],[7,'RIGHT_JAB'],[4,'LEFT_HOOK'],[5,'RIGHT_HOOK']]).find(([i])=>i===button);
  check(nextPunch?run(`player._boxing.punch.kind==='${nextPunch[1]}'&&player._boxing.attackCount===1`):run('!!player._boxing.dodge&&player._boxing.attackCount===0'),`${scheme} button ${button} uses its new role after release and fresh press`);
}

for(const [button,kind] of [[3,'RIGHT_JAB'],[5,null]]) {
  fresh();run('boxingExit(player);');connect([button]);
  run('beginWorldBoxing(player);boxingSeedPhysicalEntryInput(player);');read(14);
  check(kind?run(`player._boxing.preparedPunch.kind==='${kind}'&&!player._boxing.dodge`):run('!player._boxing.preparedPunch&&!player._boxing.dodge'),`Defensive native entry ${button} preserves its new role without an old shoulder punch`);
  pad.buttons[button].pressed=false;read();
  check(kind?run(`player._boxing.punch.kind==='${kind}'&&player._boxing.punch.level==='BODY'`):run('player._boxing.attackCount===0'),`Defensive native entry ${button} has a safe release`);
  advance(700);tap(button);
  check(kind?run(`player._boxing.punch.kind==='${kind}'&&player._boxing.punch.level==='HEAD'`):run("player._boxing.dodge.kind==='RIGHT'&&player._boxing.attackCount===0"),`Defensive native entry ${button} uses normal stance mapping on its next press`);
}

for(const scheme of ['STANDARD','DEFENSIVE'])for(const [rx,ry,sector] of [[1,0,'E'],[1,1,'SE'],[0,1,'S'],[-1,1,'SW'],[-1,0,'W'],[-1,-1,'NW'],[0,-1,'N'],[1,-1,'NE']]) {
  fresh(scheme);connect();pad.axes[2]=rx;pad.axes[3]=ry;read();
  check(run(`player._boxing.guardSector==='${sector}'&&player._boxing.attackCount===0&&!rightStick.active`),`${scheme} keeps right-stick ${sector} guard separate from weapon aiming`);
}

fresh();connect([12]);run('updateWorldBoxingPlayer(player);');
check(run('!boxingActive(player)&&player.isArmed&&!player.isUnarmed'),'D-pad up still exits Defensive stance and restores the weapon');

for(const scheme of ['STANDARD','DEFENSIVE']) {
  fresh(scheme);connect();run('handlePauseMenuInput();updateWorldBoxingPlayer(player);');
  pad.buttons[9].pressed=true;run('handlePauseMenuInput();updateWorldBoxingPlayer(player);');
  check(run('isPaused&&boxingActive(player)'),`${scheme} Start pauses the native world boxing reader`);
  pad.buttons[9].pressed=false;run('handlePauseMenuInput();');
  pad.buttons[9].pressed=true;
  run('handlePauseMenuInput();if(!isPaused)updateWorldBoxingPlayer(player);');
  check(run('!isPaused&&boxingActive(player)&&player._boxing.attackCount===0'),`${scheme} Start resume stays resumed when the world boxing reader polls in the same frame`);
  run('handlePauseMenuInput();updateWorldBoxingPlayer(player);');
  check(run('!isPaused'),`${scheme} held Start cannot re-pause a resumed boxing stance`);
}

// An actual landed punch earns the same timed continuation with face buttons.
fresh();connect();
run(`var defensiveTarget={x:40.5,y:0,aimAngle:Math.PI,isPlayer:false,hp:1000,bodyH:27};
  boxingEnter(player,[defensiveTarget],'SALOON');boxingEnter(defensiveTarget,[player],'SALOON');`);
tap(2);
let event;
for(let i=0;i<120&&!event;i++)event=run("boxingUpdate(player,6,[defensiveTarget]).find(e=>e.outcome==='HIT')");
check(event&&event.kind==='LEFT_STRAIGHT','Defensive X straight reaches real fist contact');
pad.buttons[3].pressed=true;read();pad.buttons[3].pressed=false;const followup=read();
check(followup.actions.some(a=>a.kind==='PUNCH'&&a.punch==='RIGHT_JAB'&&a.accepted&&a.queued),'Defensive Y press immediately after contact earns the unchanged alternating combo');
run('boxingUpdate(player,45,[defensiveTarget]);');
check(run("player._boxing.punch.kind==='RIGHT_JAB'&&player._boxing.punch.comboIndex===2"),'The earned face-button continuation uses the existing combo reward');

fresh();connect();run(`var defensiveMiss={x:95,y:0,aimAngle:Math.PI,isPlayer:false,hp:1000,bodyH:27};
  boxingEnter(player,[defensiveMiss],'SALOON');boxingEnter(defensiveMiss,[player],'SALOON');`);
tap(2);run('boxingUpdate(player,140,[defensiveMiss]);');const missedFollowup=tap(3);
check(missedFollowup.actions.some(a=>a.kind==='PUNCH'&&!a.accepted)&&run('!player._boxing.queuedPunch'),'A missed Defensive face-button punch still earns no recovery cancel');

for(const [button,kind] of punches) {
  fresh();beginRoom();connect([button]);room();
  check(run(`boxingActive(player)&&_frontierSaloonSession.brawl==='ACTIVE'&&!_frontierSaloonSession.menu&&player._boxing.preparedPunch.kind==='${kind}'`),`Saloon face button ${button} prepares ${kind} instead of interacting or leaving`);
  pad.buttons[button].pressed=false;room();
  check(run(`player._boxing.punch.kind==='${kind}'&&player._boxing.attackCount===1&&!player._boxing.dodge`),`Saloon face button ${button} releases its mapped head punch exactly once`);
}
for(const [button,kind] of dodges) {
  fresh();beginRoom();connect([button]);room();
  check(run(`boxingActive(player)&&_frontierSaloonSession.brawl==='ACTIVE'&&player._boxing.dodge.kind==='${kind}'&&player._boxing.attackCount===0&&!_frontierSaloonSession.menu`),`Saloon shoulder ${button} keeps ownership of ${kind}`);
}

fresh();beginRoom();connect();room();pad.buttons[12].pressed=true;room();
check(run("!boxingActive(player)&&_frontierSaloonSession.brawl==='ACTIVE'"),'Defensive D-pad stance exit preserves the running saloon wave');
pad.buttons[12].pressed=false;room();pad.buttons[3].pressed=true;room();
check(run("boxingActive(player)&&player._boxing.preparedPunch.kind==='RIGHT_JAB'&&player._boxing.attackCount===0"),'A fresh Defensive Y resumes the bout with its mapped right-jab preparation');
pad.buttons[3].pressed=false;room();
check(run("player._boxing.punch.kind==='RIGHT_JAB'&&player._boxing.punch.level==='HEAD'&&player._boxing.attackCount===1"),'Resuming Defensive Y releases the right jab without the old left-straight entry alias');

fresh();beginRoom();connect();room();pad.buttons[12].pressed=true;room();pad.buttons[12].pressed=false;room();
run('player.x=FRONTIER_SALOON_ROOM.counter.x;player.y=FRONTIER_SALOON_ROOM.counter.y;');
pad.buttons[0].pressed=true;room();
check(run('_frontierSaloonSession.menu&&!boxingActive(player)'),'A still interacts with Mae after Defensive stance exit instead of raising fists');

fresh();beginRoom();connect();room();pad.buttons[9].pressed=true;room();pad.buttons[9].pressed=false;room();
check(run('isPaused&&boxingActive(player)'),'Start pauses a Defensive saloon fight');
pad.buttons[1].pressed=true;room();
check(run('!isPaused&&boxingActive(player)&&!player._boxing.preparedPunch&&player._boxing.attackCount===0'),'B resumes pause without beginning its new right-hook hold');
pad.buttons[1].pressed=false;room();
check(run('player._boxing.attackCount===0'),'The B pause-menu release cannot throw a hook');
pad.buttons[1].pressed=true;room();pad.buttons[1].pressed=false;room();
check(run("player._boxing.punch.kind==='RIGHT_HOOK'&&player._boxing.attackCount===1"),'A fresh B after menu release is a right hook again');
run('exitFrontierSaloon();');

console.log(`Boxing Defensive controls: ${checks} mapping, body hold, chaining, guard and input handoff checks passed.`);

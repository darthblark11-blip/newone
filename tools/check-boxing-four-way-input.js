// Physical input edges and scene ownership for four directional boxing slips.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let checks = 0, pad = null;
const keys = new Set();
ctx.keyIsDown = code => keys.has(code);
ctx.navigator.getGamepads = () => pad ? [null, pad] : [];
ctx.width = 390; ctx.height = 844; ctx.deltaTime = 20;
const run = code => probe(code);
function check(condition, label) { assert.ok(condition, label); checks++; }
function fresh() {
  keys.clear(); pad = null; ctx.touches = []; ctx.mouseIsPressed = false;
  run(`exitFrontierSaloon();player=new Character(0,0,true);BIOME_ACTIVE=false;
    buildings=[];activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
    started=true;isPaused=isDead=isWin=inCutscene=false;meleeUnlocked=true;
    chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
    swordPickedUp=false;window.pickaxeOwned=false;setMeleeTool('NONE');
    leftStick={active:false,dx:0,dy:0,base:{x:66,y:height-107}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-76,y:height-107}};
    meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;prevGamepadButtons=[];gamepadWasConnected=false;
    pauseControlsInput.buttons=[];pauseControlsInput.keys=new Set();pauseControlsInput.pad=null;pauseControlsInput.screen='';
    window.isDesktop=false;window.showOnScreenControls=true;window.__frontierConsumedTouches=new Set();`);
}
function connect(buttons = []) {
  const pressed = new Set(buttons);
  pad = { connected:true, axes:[0,0,0,0], buttons:Array.from({length:17},(_,i)=>({pressed:pressed.has(i),value:pressed.has(i)?1:0})) };
}
function world(frames = 1) { for (let i=0;i<frames;i++) run('updateWorldBoxingPlayer(player);'); }
function room(frames = 1) { for (let i=0;i<frames;i++) run('handlePauseMenuInput();updateFrontierSaloonActivity();'); }
function beginRoom() {
  run(`isStoryMode=false;townsData={};startAtLevel(3);started=true;isPaused=isDead=isWin=inCutscene=false;
    inStoryIntro=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=inDarchonCall=false;
    player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;enterFrontierSaloon();startFrontierSaloonBrawl();`);
}
const bindings = [[2,'LEFT'],[3,'FORWARD'],[1,'RIGHT'],[0,'BACK']];
for (const [button,kind] of bindings) {
  fresh();run('beginWorldBoxing(player);');connect([button]);world();
  check(run(`boxingActive(player)&&player._boxing.dodge.kind==='${kind}'&&player._boxing.attackCount===0`), `Standard button ${button} selects ${kind} without a punch or stance exit`);
  world(32);
  check(run('boxingActive(player)&&!player._boxing.dodge'), `${kind} cannot repeat while held after its cooldown`);
  pad.buttons[button].pressed=false;world();pad.buttons[button].pressed=true;world();
  check(run(`player._boxing.dodge.kind==='${kind}'`), `${kind} accepts a fresh press after release`);

  fresh();run('beginWorldBoxing(player);');connect([button]);run('isPaused=true;boxingReadInput(player);isPaused=false;');world();
  check(run('!player._boxing.dodge&&player._boxing.attackCount===0'), `${kind} held through pause remains consumed`);
  pad.buttons[button].pressed=false;world();pad.buttons[button].pressed=true;world();
  check(run(`player._boxing.dodge.kind==='${kind}'`), `${kind} unlocks on a fresh post-pause press`);

  fresh();run('beginWorldBoxing(player);');connect();world();pad=null;world();connect([button]);world();
  check(run('!player._boxing.dodge&&player._boxing.attackCount===0'), `${kind} held during controller reconnection does not become a press`);
  pad.buttons[button].pressed=false;world();pad.buttons[button].pressed=true;world();
  check(run(`player._boxing.dodge.kind==='${kind}'`), `${kind} works after reconnect release and fresh press`);

  fresh();beginRoom();connect([button]);room();
  check(run(`_frontierSaloonSession.mode==='SALOON'&&_frontierSaloonSession.brawl==='ACTIVE'&&boxingActive(player)&&player._boxing.dodge.kind==='${kind}'`), `Saloon routing reserves button ${button} for ${kind}`);
}

fresh();connect([3]);run('beginWorldBoxing(player);boxingSeedPhysicalEntryInput(player);');world(14);
check(run('!player._boxing.dodge&&player._boxing.attackCount===0&&player._boxing.preparedPunch.kind===\'LEFT_STRAIGHT\''), 'Held native Y entry prepares its legacy attack without also ducking');
pad.buttons[3].pressed=false;world();
check(run('player._boxing.attackCount===1&&player._boxing.punch.kind===\'LEFT_STRAIGHT\'&&player._boxing.punch.level===\'BODY\''), 'Native Y entry releases one body punch');
world(20);pad.buttons[3].pressed=true;world();
check(run('player._boxing.dodge.kind===\'FORWARD\'&&player._boxing.attackCount===1'), 'The next Y press ducks and cannot alias a second entry punch');

fresh();connect([0,12]);run('beginWorldBoxing(player);boxingSeedPhysicalEntryInput(player);');world();
check(run('boxingActive(player)&&!player._boxing.dodge'), 'Held A and D-pad up at stance entry are consumed');
pad.buttons[12].pressed=false;world();pad.buttons[12].pressed=true;world();
check(run('!boxingActive(player)&&player.isArmed&&!player.isUnarmed'), 'Fresh D-pad up exits and restores exterior firearm stance');
run('var toolBeforeExitPad=meleeTool();handleGamepad();');
check(run('meleeTool()===toolBeforeExitPad'), 'Holding D-pad up after exit cannot cycle the melee tool in the next native frame');

fresh();beginRoom();connect();room();
run('var preservedGrit=_frontierSaloonSession.grit, preservedActors=_frontierSaloonSession.fighters.slice(),preservedXY=[player.x,player.y];');
pad.buttons[0].pressed=true;pad.buttons[12].pressed=true;room();
check(run(`!boxingActive(player)&&_frontierSaloonSession.brawl==='ACTIVE'&&_frontierSaloonSession.grit===preservedGrit&&
  _frontierSaloonSession.fighters.every((f,i)=>f===preservedActors[i]&&!boxingActive(f))`), 'Saloon exit halts fighter stances and preserves the current mission');
check(run('player.x===preservedXY[0]&&player.y===preservedXY[1]&&!player.isArmed&&player.isUnarmed'), 'Saloon stance exit neither teleports nor equips the exterior gun');
run('player.x=FRONTIER_SALOON_ROOM.counter.x;player.y=FRONTIER_SALOON_ROOM.counter.y;');room(4);
check(run('!_frontierSaloonSession.menu'), 'A held during stance exit cannot immediately talk to Mae');
pad.buttons[0].pressed=false;pad.buttons[12].pressed=false;room();pad.buttons[0].pressed=true;room();
check(run('_frontierSaloonSession.menu'), 'A fresh A after leaving the stance opens Mae interaction');
run('_frontierSaloonSession.menu=false;');pad.buttons[0].pressed=false;room();
check(run('frontierSaloonButtons().some(b=>b.action===\'BOXING\')&&!frontierSaloonButtons().some(b=>b.action===\'EXIT\')'), 'An interrupted active bout offers RAISE FISTS without a room exit');
const resume = run('frontierSaloonButtons().find(b=>b.action===\'BOXING\')');
run(`handleFrontierSaloonTap(${resume.x+resume.w/2},${resume.y+resume.h/2});`);
check(run('boxingActive(player)&&_frontierSaloonSession.grit===preservedGrit&&player._boxing.attackCount===0'), 'Visible touch RAISE FISTS resumes the same bout without throwing');
pad.buttons[12].pressed=true;room();pad.buttons[12].pressed=false;room();pad.buttons[7].pressed=true;room();
check(run('boxingActive(player)&&player._boxing.attackCount===0&&player._boxing.preparedPunch.kind===\'RIGHT_JAB\''), 'A fresh shoulder resumes the bout and prepares its anatomical hand');
room(12);pad.buttons[7].pressed=false;room();
check(run('player._boxing.attackCount===1&&player._boxing.punch.kind===\'RIGHT_JAB\'&&player._boxing.punch.level===\'BODY\''), 'A resumed shoulder hold releases exactly one body jab');
run('exitFrontierSaloon();');

fresh();beginRoom();connect();room();
pad.buttons[9].pressed=true;room();
check(run('isPaused&&boxingActive(player)'), 'Start pauses an active saloon stance');
pad.buttons[9].pressed=false;room();pad.buttons[1].pressed=true;room();
check(run('!isPaused&&boxingActive(player)&&!player._boxing.dodge'), 'B resumes the saloon pause menu without also slipping right');
pad.buttons[1].pressed=false;room();pad.buttons[1].pressed=true;room();
check(run('player._boxing.dodge.kind===\'RIGHT\''), 'B becomes a right slip again after its menu press is released');
run('player._boxing.dodge=null;player._boxing.dodgeCooldownMs=0;');
pad.buttons[1].pressed=false;pad.buttons[9].pressed=true;room();pad.buttons[9].pressed=false;room();
pad.buttons[3].pressed=true;pad.buttons[9].pressed=true;room();
check(run('!isPaused&&!player._boxing.dodge'), 'Start resume consumes a simultaneously held duck rather than firing it underneath the menu');
run('exitFrontierSaloon();');

for (const [code,kind] of [[32,'LEFT'],[72,'RIGHT'],[67,'FORWARD'],[86,'BACK']]) {
  fresh();run('beginWorldBoxing(player);');keys.add(code);world();
  check(run(`player._boxing.dodge.kind==='${kind}'`), `Desktop key ${code} owns ${kind}`);
}

for (const [w,h] of [[390,844],[320,568],[800,390],[940,390]]) {
  fresh();ctx.width=w;ctx.height=h;run('beginWorldBoxing(player);');
  const layout=run('boxingControlLayout()'), areas=[...layout.buttons,layout.exitButton,layout.leftStick,layout.rightStick];
  check(layout.buttons.length===8&&areas.every(b=>b.x-b.r>=0&&b.x+b.r<=w&&b.y-b.r>=0&&b.y+b.r<=h), `${w}×${h} has eight usable buttons and unclipped controls`);
  check(areas.every((a,i)=>areas.every((b,j)=>i===j||Math.hypot(a.x-b.x,a.y-b.y)>=a.r+b.r)), `${w}×${h} touch circles do not overlap`);
  for (const kind of ['LEFT','RIGHT','FORWARD','BACK']) {
    run('player._boxing.dodge=null;player._boxing.dodgeCooldownMs=0;');
    const button=layout.buttons.find(b=>b.action==='DODGE_'+kind);
    ctx.touches=[{id:47,x:button.x,y:button.y}];run(`boxingHandleTouch(${button.x},${button.y});`);world();
    check(run(`player._boxing.dodge.kind==='${kind}'&&player._boxing.attackCount===0`), `${w}×${h} ${kind} button routes to a slip`);
    ctx.touches=[];world();
  }
}
console.log(`Boxing four-way input: ${checks} physical control, scene and layout checks passed.`);

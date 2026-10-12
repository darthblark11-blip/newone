// Physical shoulder sides, consumed holds and actual control-overlay paints.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let pad = null, checks = 0;
ctx.navigator.getGamepads = () => pad ? [null, pad] : [];
probe('isStoryMode=false;townsData={};startAtLevel(1);started=true;doTick=true;');
function reset() {
  pad = null;
  probe(`exitFrontierSaloon();player=new Character(0,0,true);BIOME_ACTIVE=false;
    buildings=[];activeBuildings=[];activeParkingCars=[];barrels=[];invalidateColIndex();enemiesList=[];
    leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
    window.isDesktop=false;window.showOnScreenControls=true;window.__frontierConsumedTouches=new Set();
    isPaused=isDead=isWin=inCutscene=false;touches=[];mouseIsPressed=false;deltaTime=20;
    swordPickedUp=false;window.pickaxeOwned=false;setMeleeTool('NONE');
    chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;meleeUnlocked=true;
    meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;prevGamepadButtons=[];gamepadWasConnected=false;
    window.__boxingPadKeys=new Set();keyIsDown=code=>window.__boxingPadKeys.has(code);`);
}
function connect(buttons=[]) {
  const down = new Set(buttons);
  pad={connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:down.has(i),value:down.has(i)?1:0}))};
}
function input(frames=1) {for(let i=0;i<frames;i++)probe('boxingReadInput(player);');}
function check(label, test) {reset();test();checks++;console.log('  ok   '+label);}
function capture(code) {
  const labels=[],circles=[],rectangles=[],text=ctx.text,ellipse=ctx.ellipse,rect=ctx.rect;
  ctx.text=(label,...args)=>{labels.push(String(label));text(label,...args);};
  ctx.ellipse=(...args)=>{circles.push(args);ellipse(...args);};
  ctx.rect=(...args)=>{rectangles.push(args);rect(...args);};
  try{probe(code);}finally{ctx.text=text;ctx.ellipse=ellipse;ctx.rect=rect;}
  return {labels,circles,rectangles};
}
const mapping=[[6,'LEFT_STRAIGHT','L2'],[7,'RIGHT_JAB','R2'],[4,'LEFT_HOOK','L1'],[5,'RIGHT_HOOK','R1']];
for(const [button,kind,label] of mapping) {
  check(label+' taps its own anatomical hand once',()=>{
    probe('beginWorldBoxing(player);');connect([button]);input();
    assert.equal(probe('player._boxing.preparedPunch.kind'),kind);
    assert.equal(probe('player._boxing.attackCount'),0);
    pad.buttons[button].pressed=false;input(2);
    assert.equal(probe('player._boxing.punch.kind'),kind);
    assert.equal(probe('player._boxing.punch.level'),'HEAD');
    assert.equal(probe('player._boxing.attackCount'),1);
  });
  check(label+' holds a body preparation and throws only on release',()=>{
    probe('beginWorldBoxing(player);');connect([button]);input(14);
    assert.equal(probe('player._boxing.attackCount'),0);
    assert.equal(probe('player._boxing.preparedPunch.kind'),kind);
    assert.equal(probe('player._boxing.preparedPunch.amount'),1);
    pad.buttons[button].pressed=false;input(3);
    assert.equal(probe('player._boxing.punch.kind'),kind);
    assert.equal(probe('player._boxing.punch.level'),'BODY');
    assert.equal(probe('player._boxing.attackCount'),1);
  });
  check(label+' pause seeding consumes its original hold without a release punch',()=>{
    probe('beginWorldBoxing(player);');connect([button]);input(14);
    probe('isPaused=true;boxingReadInput(player);isPaused=false;');input(4);
    pad.buttons[button].pressed=false;input();
    assert.equal(probe('player._boxing.attackCount'),0);
    assert.equal(probe('player._boxing.preparedPunch'),null);
    pad.buttons[button].pressed=true;input();pad.buttons[button].pressed=false;input();
    assert.equal(probe('player._boxing.punch.kind'),kind);
    assert.equal(probe('player._boxing.punch.level'),'HEAD');
  });
  check(label+' disconnect cancels its body hold without throwing',()=>{
    probe('beginWorldBoxing(player);');connect([button]);input(14);pad=null;input();
    assert.equal(probe('player._boxing.attackCount'),0);
    assert.equal(probe('player._boxing.preparedPunch'),null);
    connect();input();pad.buttons[button].pressed=true;input();pad.buttons[button].pressed=false;input();
    assert.equal(probe('player._boxing.punch.kind'),kind);
    assert.equal(probe('player._boxing.punch.level'),'HEAD');
  });
}
for(const [button,kind] of [[5,'RIGHT_HOOK'],[3,'LEFT_STRAIGHT']]) {
  check('Native '+(button===5?'R1':'Y')+' entry preserves the intended hand through release',()=>{
    connect([button]);probe('beginWorldBoxing(player);boxingSeedPhysicalEntryInput(player);');input(14);
    assert.equal(probe('player._boxing.preparedPunch.kind'),kind);
    assert.equal(probe('player._boxing.attackCount'),0);
    pad.buttons[button].pressed=false;input(3);
    assert.equal(probe('player._boxing.punch.kind'),kind);
    assert.equal(probe('player._boxing.punch.level'),'BODY');
    assert.equal(probe('player._boxing.attackCount'),1);
  });
}
check('An idle pad hides every boxing tutorial shape and label before polling',()=>{
  probe('beginWorldBoxing(player);');connect();
  const seen=capture('drawBoxingControls(player);');
  assert.deepEqual(seen,{labels:[],circles:[],rectangles:[]});
  pad.buttons[1].pressed=true;input();assert.equal(probe('boxingActive(player)'),false,'B must still exit');
});
check('Controller disconnection restores mobile punches and desktop hints',()=>{
  probe('beginWorldBoxing(player);');connect();input();pad=null;input();
  const touch=capture('drawBoxingControls(player);');
  assert(touch.labels.includes('L STRAIGHT')&&touch.labels.includes('R HOOK')&&touch.labels.includes('WEAPON'));
  probe('window.isDesktop=true;window.showOnScreenControls=false;');
  const desktop=capture('drawBoxingControls(player);');
  assert(desktop.labels.some(s=>s.startsWith('E / R · STRAIGHT')));
  assert(desktop.labels.some(s=>s.startsWith('ARROWS / IJKL')));
});
check('Saloon and duel hide controller instructions but keep state and real action buttons',()=>{
  probe('startAtLevel(3);player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;enterFrontierSaloon();');connect();
  let seen=capture('drawFrontierSaloonHud();');
  assert(!seen.labels.some(s=>/MOVE · left stick|WASD move|TALK · A/.test(s)));
  assert(seen.labels.some(s=>s.includes('HEALTH ')));
  const buttons=probe('frontierSaloonButtons().map(b=>b.label)');
  assert(buttons.every(label=>seen.labels.includes(label)),'Scene actions remain visible');
  probe('startFrontierSaloonBrawl();');seen=capture('drawFrontierSaloonHud();');
  assert(seen.labels.some(s=>s.startsWith('GRIT ')));
  assert(!seen.labels.some(s=>/STRAIGHT|HOOKS|STICK · GUARD|HOLD → RELEASE BODY/.test(s)));
  probe('startFrontierQuickDraw();');seen=capture('drawFrontierSaloonHud();');
  assert(!seen.labels.some(s=>/STICK.*FIRE|Aim gently|70% ring|MOUSE · AIM/.test(s)));
  assert(seen.labels.some(s=>s.startsWith('DUEL ROUNDS ')));
  assert(seen.labels.includes(probe('_frontierSaloonSession.duel.phase')));
  assert(probe('frontierSaloonButtons().map(b=>b.label)').every(label=>seen.labels.includes(label)));
  probe('exitFrontierSaloon();');
});
console.log('\n'+checks+' boxing controller refinement checks passed.');

// Exercise real settings actions, device storage and paused scene input.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let checks = 0, pad = null;
const store = new Map();
ctx.localStorage = {getItem: k => store.get(k) ?? null, setItem: (k,v) => store.set(k,v)};
ctx.navigator.getGamepads = () => pad ? [pad] : [];
ctx.millis = () => 10000;
probe('isStoryMode=false;startAtLevel(3);started=true;leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};');
function check(label, fn) { fn(); checks++; console.log('  ok   '+label); }
function value(code) { return JSON.parse(JSON.stringify(probe(code))); }
function connect() {pad = {index:0,id:'settings QA',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))}; poll();}
function poll() {probe('handlePauseMenuInput();');}
function press(i) {pad.buttons[i].pressed=true;poll();pad.buttons[i].pressed=false;poll();}
function click(action) {
  const b = probe(`pauseSettingsButtons().find(b=>b.action===${JSON.stringify(action)})`);
  assert(b, action);ctx.mouseX=b.x+b.w/2;ctx.mouseY=b.y+b.h/2;probe('touches=[];touchStarted();');
}
check('A fresh device keeps the original two defaults', () => assert.deepEqual(value('loadGamepadControlSettings()'), {boxing:'STANDARD',shooting:'STICK'}));
for (const [raw, expected] of [
  ['{', {boxing:'STANDARD',shooting:'STICK'}],
  ['null', {boxing:'STANDARD',shooting:'STICK'}],
  ['{"version":2,"boxing":"DEFENSIVE","shooting":"R2"}', {boxing:'STANDARD',shooting:'STICK'}],
  ['{"version":1,"boxing":"DEFENSIVE","shooting":"invalid"}', {boxing:'DEFENSIVE',shooting:'STICK'}],
  ['{"version":1,"boxing":"invalid","shooting":"R2"}', {boxing:'STANDARD',shooting:'R2'}]
]) check('Stored input is normalized safely: '+raw, () => {store.set('urbanTwinStickControls',raw);assert.deepEqual(value('loadGamepadControlSettings()'),expected);});
check('Blocked reads fall back without preventing play', () => {const read=ctx.localStorage.getItem;ctx.localStorage.getItem=()=>{throw Error('blocked');};assert.deepEqual(value('loadGamepadControlSettings()'),{boxing:'STANDARD',shooting:'STICK'});ctx.localStorage.getItem=read;});
check('Invalid setting changes are rejected', () => {assert.equal(probe('setGamepadControlSetting("boxing","R2")'),false);assert.equal(probe('setGamepadControlSetting("campaign","DEFENSIVE")'),false);});
check('Independent settings persist outside the campaign save', () => {
  store.set('urbanTwinStickSave','existing campaign');
  probe('setGamepadControlSetting("boxing","DEFENSIVE");setGamepadControlSetting("shooting","R2");');
  assert.deepEqual(JSON.parse(store.get('urbanTwinStickControls')),{version:1,boxing:'DEFENSIVE',shooting:'R2'});
  assert.equal(store.get('urbanTwinStickSave'),'existing campaign');
  assert.deepEqual(value('loadGamepadControlSettings()'),{boxing:'DEFENSIVE',shooting:'R2'});
});
check('New games preserve device controls', () => {probe('startAtLevel(1);started=true;');assert.deepEqual(value('gamepadControlSettings'),{boxing:'DEFENSIVE',shooting:'R2'});});
check('Blocked writes keep the selected controls active and report session-only storage', () => {
  const write=ctx.localStorage.setItem;ctx.localStorage.setItem=()=>{throw Error('blocked');};
  probe('setGamepadControlSetting("boxing","STANDARD");');assert.equal(probe('gamepadBoxingDefensive()'),false);assert.equal(probe('gamepadSettingsSaved'),false);
  ctx.localStorage.setItem=write;probe('setGamepadControlSetting("boxing","DEFENSIVE");');assert.equal(probe('gamepadSettingsSaved'),true);
});
for (const [w,h] of [[320,568],[390,844],[800,390],[940,390]]) {
  ctx.width=w;ctx.height=h;
  check(`World pause touch reaches settings at ${w}x${h}`, () => {
    probe('exitFrontierSaloon();isPaused=true;pauseMenuState="MAIN";window.lastPauseTime=0;');
    ctx.mouseX=w/2+63;ctx.mouseY=h/2-140;probe('touchStarted();');assert.equal(probe('pauseMenuState'),'SETTINGS');
    click('GAMEPAD_CONTROLS');assert.equal(probe('pauseMenuState'),'GAMEPAD_CONTROLS');
  });
  check(`Controls fit and touch selects both independent choices at ${w}x${h}`, () => {
    const buttons=probe('pauseSettingsButtons()');
    for (const b of buttons) assert(b.x>=0&&b.y>=0&&b.x+b.w<=w&&b.y+b.h<=h);
    for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++) {
      const a=buttons[i],b=buttons[j];assert(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y);
    }
    click('BOXING_STANDARD');assert.equal(probe('gamepadBoxingDefensive()'),false);
    click('SHOOTING_STICK');assert.equal(probe('gamepadTriggerShooting()'),false);
    click('BOXING_DEFENSIVE');click('SHOOTING_R2');
    assert.deepEqual(value('gamepadControlSettings'),{boxing:'DEFENSIVE',shooting:'R2'});
    assert.equal(probe('isPaused'),true);
    click('BACK');assert.equal(probe('pauseMenuState'),'SETTINGS');click('BACK');assert.equal(probe('pauseMenuState'),'MAIN');assert.equal(probe('isPaused'),true);
  });
}
ctx.width=390;ctx.height=844;
check('Controller Y opens Settings; A opens gamepad controls without leaking into a second screen', () => {
  connect();press(3);assert.equal(probe('pauseMenuState'),'SETTINGS');
  pad.buttons[0].pressed=true;poll();poll();assert.equal(probe('pauseMenuState'),'GAMEPAD_CONTROLS');
  assert.equal(probe('gamepadBoxingDefensive()'),true);pad.buttons[0].pressed=false;poll();
});
check('Directional controller focus reaches each setting and Back', () => {
  press(15);assert.equal(probe('pauseSettingsButtons()[pauseControlsInput.focus].action'),'BOXING_DEFENSIVE');
  press(13);assert.equal(probe('pauseSettingsButtons()[pauseControlsInput.focus].action'),'SHOOTING_R2');
  press(14);assert.equal(probe('pauseSettingsButtons()[pauseControlsInput.focus].action'),'SHOOTING_STICK');
  press(0);assert.equal(probe('gamepadTriggerShooting()'),false);
  press(13);assert.equal(probe('pauseSettingsButtons()[pauseControlsInput.focus].action'),'BACK');press(0);
  assert.equal(probe('pauseMenuState'),'SETTINGS');
});
check('Holding B goes back exactly one screen', () => {
  press(0);assert.equal(probe('pauseMenuState'),'GAMEPAD_CONTROLS');
  pad.buttons[1].pressed=true;poll();poll();assert.equal(probe('pauseMenuState'),'SETTINGS');
  assert.equal(probe('isPaused'),true);pad.buttons[1].pressed=false;poll();
});
for(const mode of ['SALOON','DUEL']) check(`${mode} pause offers Settings and preserves its stopped simulation`, () => {
  probe(`exitFrontierSaloon();startAtLevel(3);started=true;player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;enterFrontierSaloon(${JSON.stringify(mode)});isPaused=true;pauseMenuState='MAIN';`);
  const s=probe('_frontierSaloonSession'), elapsed=s.elapsedMs;
  const b=probe('frontierSaloonButtons().find(b=>b.action==="SETTINGS")');
  ctx.mouseX=b.x+b.w/2;ctx.mouseY=b.y+b.h/2;probe('touchStarted();');assert.equal(probe('pauseMenuState'),'SETTINGS');click('GAMEPAD_CONTROLS');
  const phase=s.duel?.phase, remaining=s.duel?.remainingMs;
  probe('updateFrontierSaloonActivity(true);');assert.equal(s.elapsedMs,elapsed);assert.equal(s.duel?.phase,phase);assert.equal(s.duel?.remainingMs,remaining);
  press(1);assert.equal(probe('pauseMenuState'),'SETTINGS');assert.equal(probe('isPaused'),true);
  pad.buttons[9].pressed=true;poll();probe('frontierSaloonInput(true);');poll();probe('frontierSaloonInput(true);');
  assert.equal(probe('isPaused'),false,'Held Start resumes once');assert.equal(probe('pauseMenuState'),'MAIN');
  pad.buttons[9].pressed=false;poll();probe('frontierSaloonInput(true);');
});
console.log('\n'+checks+' gamepad settings checks passed.');

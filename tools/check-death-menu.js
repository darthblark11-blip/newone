// Death owns its inputs before world interactions. Exercise real touch/mouse
// dispatch, controller edges, and native campaign loading instead of only
// invoking button callbacks in isolation.
const assert=require('assert/strict');
const {ctx,probe:P}=require('./harness');
let checks=0,pad=null,seed=4141;
const keys=new Set(),storage=new Map();
ctx.keyIsDown=code=>keys.has(code);
ctx.navigator.getGamepads=()=>pad?[pad]:[];
ctx.localStorage={getItem:k=>storage.has(k)?storage.get(k):null,
 setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
ctx.random=(a,b)=>{
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;
 if(a===undefined)return r;if(Array.isArray(a))return a[(r*a.length)|0];
 return b===undefined?r*a:a+r*(b-a);
};
ctx.setTimeout=()=>0;
ctx.mouseButton=ctx.LEFT;
function ok(code,label){assert.ok(P(code),label);checks++;}
function connect(pressed=[]){const held=new Set(pressed);pad={index:0,connected:true,id:'death-menu',
 axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:held.has(i),value:held.has(i)?1:0}))};}
function fresh(){
 keys.clear();pad=null;ctx.touches=[];ctx.mouseIsPressed=false;
 P(`if(_frontierSaloonSession)exitFrontierSaloon();
  started=doTick=true;isDead=true;isWin=isPaused=killcamMode=false;
  inCutscene=inTownCutscene=inFortCutscene=inFarmCutscene=inFarmPostCutscene=false;
  inPostAmbushCutscene=inLvl4Cutscene=inDarchonCall=inStoryIntro=inStoryRoom=false;
  inTravelMenu=inOverworldView=inWorldBuildingMenu=false;
  player=new Character(528,720,true);player.hp=0;player.dead=true;
  currentLevel=currentBiome=1;isStoryMode=false;
  leftStick={active:false,dx:0,dy:0,base:{x:70,y:height-160}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-70,y:height-160}};
  deathMenuInput.active=false;deathMenuInput.buttons=[];deathMenuInput.keys=new Set();
  deathMenuInput.pad=null;deathMenuInput.focus=0;deathMenuInput.usingPad=false;`);
}
function button(action){return P(`deathMenuButtons().find(b=>b.action==='${action}')`);}
function tap(action,mouse=false){const b=button(action);assert.ok(b,action+' exists');
 ctx.mouseX=b.x+b.w/2;ctx.mouseY=b.y+b.h/2;
 ctx.touches=mouse?[]:[{id:7,x:ctx.mouseX,y:ctx.mouseY}];
 P(mouse?'mousePressed();':'touchStarted();');ctx.touches=[];
}

storage.clear();fresh();
ok("deathMenuButtons().some(b=>b.action==='RETRY'&&b.enabled)", 'Death exposes an enabled retry');
ok("deathMenuButtons().some(b=>b.action==='RESET'&&b.enabled)", 'Death exposes an enabled reset');
ok("deathMenuButtons().some(b=>b.action==='LOAD'&&!b.enabled)", 'A missing save disables load');
ok("activateDeathMenuAction('LOAD')===false&&isDead", 'Missing save leaves the death screen intact');
storage.set('urbanTwinStickSave','{broken');
ok("activateDeathMenuAction('LOAD')===false&&isDead&&player.hp===0", 'Malformed storage cannot dismiss death or revive a partial game');
storage.delete('urbanTwinStickSave');

for(const [w,h]of[[390,844],[844,390],[320,568]]){
 ctx.width=w;ctx.height=h;
 ok('deathMenuButtons().every(b=>b.x>=8&&b.y>=8&&b.x+b.w<=width-8&&b.y+b.h<=height-8)',
  'All death actions fit a '+w+'×'+h+' display');
 ok('deathMenuButtons().every((a,i,list)=>list.every((b,j)=>i===j||a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y))',
  'Death actions do not overlap at '+w+'×'+h);
}
ctx.width=390;ctx.height=844;

// A death tap cannot be intercepted by stale saloon/pause/tool overlays.
fresh();P(`var deathTapVisits=[];var savedDeathPauseTap=handlePauseSettingsTap;
 handlePauseSettingsTap=function(){deathTapVisits.push('PAUSE');return true;};`);
ctx.mouseX=3;ctx.mouseY=3;
P('touchStarted();');
ok('isDead&&deathTapVisits.length===0','Death dispatch precedes a stale modal pause handler, even outside the buttons');
P('handlePauseSettingsTap=savedDeathPauseTap;');
ok('handleDeathMenuTap(3,3)===true&&isDead','An outside tap is consumed without restarting');
P('isDead=false;');
ok('handleDeathMenuTap(3,3)===false','Living gameplay does not lose taps to the death menu');

// Actual controller entry must seed the held dodge/confirm that killed the
// player; fresh edges alone may navigate and activate.
fresh();connect([0]);P('handleDeathMenuInput();handleDeathMenuInput();');
ok('isDead','Held A on death entry cannot instantly retry');
pad.buttons[0].pressed=false;P('handleDeathMenuInput();');
pad.buttons[13].pressed=true;P('handleDeathMenuInput();');
ok("deathMenuButtons()[deathMenuInput.focus].action!=='RETRY'",'A fresh D-pad down edge moves focus');
P('var focusAfterDeathDown=deathMenuInput.focus;handleDeathMenuInput();');
ok('deathMenuInput.focus===focusAfterDeathDown','Held D-pad cannot repeat an edge each frame');
pad.buttons[13].pressed=false;P('handleDeathMenuInput();');
// Jump to RESET through the public list so disabled LOAD skip rules may vary.
P("deathMenuInput.focus=deathMenuButtons().findIndex(b=>b.action==='RESET');");
pad.buttons[0].pressed=true;P('handleDeathMenuInput();');
ok('!started&&!isDead&&!isPaused','Gamepad A activates the focused reset and returns to title');

fresh();keys.add(13);P('handleDeathMenuInput();handleDeathMenuInput();');
ok('isDead','Held Enter on death entry cannot retry');
keys.delete(13);P('handleDeathMenuInput();');
keys.add(40);P('handleDeathMenuInput();');
ok("deathMenuButtons()[deathMenuInput.focus].action!=='RETRY'",'Keyboard down navigates death choices');
keys.clear();

// Full native campaign path: a saved living player survives a later death;
// retry preserves that save and reset leaves it available from the title.
pad=null;P(`isDead=false;isStoryMode=false;townsData={};startAtLevel(1);
 player.x=600;player.y=710;player.hp=73;player.shield=46;score=137;
 smgUnlocked=true;player.currentWeapon=WEAPONS.SMG;saveGame();`);
const saved=storage.get('urbanTwinStickSave');assert.ok(saved);checks++;
P(`player.hp=0;player.dead=true;isDead=true;isPaused=true;pauseMenuState='SETTINGS';score=999;`);
keys.add(27);keys.add(80);P('pauseControlsInput.keys=new Set();');
tap('LOAD');
ok('started&&!isDead&&!isPaused&&player.hp===73&&player.shield===46&&score===137',
 'Touch Load Game restores the native saved health, shield and score after death');
P('handlePauseMenuInput();');
ok('!isPaused','Escape/P held during death cannot immediately pause a loaded game');
keys.clear();P('handlePauseMenuInput();');
ok('window.__frontierConsumedTouches.has(7)&&!leftStick.active&&!rightStick.active&&rightStick.dist===0',
 'The load finger stays consumed and both movement/aim sticks release');
assert.equal(storage.get('urbanTwinStickSave'),saved,'Loading never overwrites the checkpoint');checks++;
connect([9]);P('pauseControlsInput.pad=0;pauseControlsInput.buttons=Array(17).fill(false);pauseControlsInput.keys=new Set();');
P('player.hp=0;player.dead=true;isDead=true;');
ctx.mouseIsPressed=true;
tap('RETRY',true);
ok('started&&!isDead&&player.hp>0&&!player.dead&&currentLevel===1&&smgUnlocked',
 'Actual mouse retry revives the current level with its unlocked equipment');
P('handlePauseMenuInput();');
ok('!isPaused','Start held during death cannot immediately pause a retried level');
P('window.isDesktop=true;handleDesktop();');
ok('rightStick.dist===0','A held mouse retry cannot become shooting in the resumed level');
ctx.mouseIsPressed=false;P('handleDeathMenuInput();');
ctx.mouseIsPressed=true;P('handleDesktop();');
ok('rightStick.dist===1','A new mouse press can shoot after the retry click is released');
ctx.mouseIsPressed=false;pad=null;
assert.equal(storage.get('urbanTwinStickSave'),saved,'Retry keeps the saved checkpoint available');checks++;
P(`player.hp=0;player.dead=true;isDead=true;isWin=true;isPaused=true;
 inStoryIntro=inStoryRoom=inUpstairsRoom=true;selectingDifficulty=true;`);
tap('RESET');
ok('!started&&!isDead&&!isWin&&!isPaused&&!inStoryIntro&&!inStoryRoom&&!inUpstairsRoom&&!selectingDifficulty',
 'Reset clears dead/modal flags and opens the main menu');
assert.equal(storage.get('urbanTwinStickSave'),saved,'Reset preserves the saved game');checks++;
console.log('Death menu: '+checks+' native input, layout, persistence and recovery checks passed.');

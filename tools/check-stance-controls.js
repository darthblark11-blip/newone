// Stances must advance through physical hit profiles, own their input edges,
// keep their longer prone footprint out of cover, and survive campaign saves.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness');
const P = source => probe('(' + source + ')');
let checks = 0, now = 1000, seed = 82123, nextTouch = 1, slot = null, pad = null;
const keys = new Set();
ctx.millis = () => now;
ctx.keyIsDown = key => keys.has(key);
ctx.navigator.getGamepads = () => pad ? [pad] : [];
ctx.setTimeout = () => 0;
ctx.localStorage = { getItem: () => slot, setItem: (k, v) => { slot = v; }, removeItem: () => { slot = null; } };
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  return a === undefined ? r : Array.isArray(a) ? a[Math.floor(r * a.length)] : b === undefined ? a * r : a + (b - a) * r;
};
const ok = (label, value) => { assert.ok(value, label); checks++; };
function fresh() {
  pad = null; keys.clear(); ctx.touches = []; ctx.mouseIsPressed=false;
  probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=true;isPaused=isDead=isWin=killcamMode=false;inStoryIntro=inStoryRoom=false;
    inTownCutscene=inFortCutscene=inPostAmbushCutscene=inFarmCutscene=inFarmPostCutscene=false;
    inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
    inOverworldView=false;window.inNM0SecretOverlay=false;buildGhost=null;
    width=393;height=800;frameCount=100;deltaTime=1000/60;zoom=1;camX=camY=0;
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:313,y:690}};
    player=new Character(0,0,true);player.isArmed=true;player.aimAngle=0;
    setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=false;jetpackUnlocked=true;
    resetActorStance(player);resetTouchAimSelection(false);consumeStanceInputs();
    window.isDesktop=false;window.showOnScreenControls=true;window.lastPauseTime=-1000;
    activeBuildings=buildings=[];activeParkingCars=parkingCars=[];barrels=[];bullets=[];
    invalidateColIndex();prevGamepadButtons=[];gamepadWasConnected=false;`);
}
function advance(ms) {
  for (let remaining = ms; remaining > 0;) {
    const dt = Math.min(50, remaining); remaining -= dt; now += dt;
    probe(`frameCount++;updateActorStance(player,${dt});`);
  }
}
function down(x, y) {
  const touch = { id: nextTouch++, x, y }; ctx.touches.push(touch);
  probe('touchStarted();handleTouches();'); return touch;
}
function release() { ctx.touches = []; probe('touchEnded();handleTouches();'); }

fresh();
ok('a crouch request is accepted without instant hitbox immunity',
  P("requestActorStance(player,'CROUCH') && actorStance(player)==='STAND'"));
advance(50);
ok('the early crouch retains standing coverage', P("actorStance(player)==='STAND' && player.stance.value>0"));
advance(50);
ok('the lowered crouch switches coverage during its visual compression', P("actorStance(player)==='CROUCH' && player.stance.value<1"));
ok('an unfinished transition cannot reverse or become a free instant dive', !P("requestActorStance(player,'PRONE')"));
advance(50);
ok('crouching settles in exactly 150 ms', P("player.stance.value===1 && player.stance.elapsedMs===150"));
ok('the brief settled cooldown prevents stance-spam', !P("requestActorStance(player,'STAND')"));
advance(180);
ok('standing can be requested after recovery', P("requestActorStance(player,'STAND')"));
advance(150);
ok('the rise returns to the standing profile', P("actorStance(player)==='STAND' && player.stance.value===0"));

fresh();probe("requestActorStance(player,'PRONE');");advance(50);
ok('a stationary prone drop starts vulnerable at standing height', P("actorStance(player)==='STAND'"));
advance(100);
ok('the middle of a stationary prone drop uses the crouched hit matrix', P("actorStance(player)==='CROUCH'"));
advance(100);
ok('the last part of a prone drop has reached prone coverage', P("actorStance(player)==='PRONE' && player.stance.value<2"));
probe('isPaused=true;');const paused = P('JSON.stringify(player.stance)');advance(300);
ok('pausing freezes the active stance transition', P('JSON.stringify(player.stance)') === paused);
probe('isPaused=false;');advance(50);
ok('the prone drop settles after 300 simulated milliseconds', P('player.stance.value===2 && player.stance.elapsedMs===300'));
probe('doTick=false;');const stopped = P('JSON.stringify(player.stance)');advance(300);
ok('a stopped simulation does not consume recovery time', P('JSON.stringify(player.stance)') === stopped);

fresh();const pill = P('stanceTouchButton()');down(pill.x, pill.y);
ok('a stance-button press waits for tap release without aiming or moving',
  P('player.stance.to===0 && !leftStick.active && !rightStick.active && touchAimSelection.pointerId===null && bullets.length===0'));
advance(100);release();
ok('a released short touch requests crouch', P('player.stance.to===1'));
advance(500);down(pill.x,pill.y);advance(100);release();advance(500);
ok('a second short touch stands instead of advancing to prone', P("actorStance(player)==='STAND' && player.stance.to===0"));
down(pill.x,pill.y);advance(199);
ok('a touch hold below 200 milliseconds cannot enter prone or crouch', P('player.stance.to===0'));
advance(1);
ok('a 200-millisecond stationary touch hold requests prone', P('player.stance.to===2'));
advance(800);probe('handleTouches();handleTouches();');
ok('continuing to hold cannot repeat the stance action or fire', P("actorStance(player)==='PRONE' && player.stance.to===2 && bullets.length===0"));
release();advance(400);
ok('releasing a completed hold does not stand the actor up', P("actorStance(player)==='PRONE' && player.stance.to===2"));
down(pill.x,pill.y);advance(100);release();advance(500);
ok('a short tap from prone requests standing directly', P("actorStance(player)==='STAND' && player.stance.to===0"));
fresh();down(125,640);down(pill.x,pill.y);
ok('the pending stance hold leaves an already held movement finger active', P('leftStick.active && leftStick.dx>0 && player.stance.to===0'));
release();
fresh();down(pill.x,pill.y);advance(100);probe('isPaused=true;consumePauseControlInputs();');advance(1200);
probe('isPaused=false;handleTouches();');advance(1200);
ok('a touch held through pause cannot become a delayed prone request', P('player.stance.to===0'));
release();advance(300);
ok('releasing a menu-consumed stance finger cannot become a crouch tap', P('player.stance.to===0'));
fresh();const canceledTouch=down(pill.x,pill.y);advance(100);ctx.touches=[];
probe(`cancelTouchAimPointer({changedTouches:[{identifier:${canceledTouch.id}}]});touchEnded();handleTouches();`);advance(1300);
ok('a canceled touch hold cannot commit a tap or delayed prone request', P('player.stance.to===0'));
fresh();ctx.mouseX=pill.x;ctx.mouseY=pill.y;ctx.mouseIsPressed=true;probe('mousePressed();');advance(100);
ok('the mouse stance button also waits for tap release', P('player.stance.to===0'));
ctx.mouseIsPressed=false;probe('mouseReleased();');advance(500);
ok('a short mouse stance-button tap crouches', P("actorStance(player)==='CROUCH'"));
ctx.mouseIsPressed=true;probe('mousePressed();');advance(200);advance(500);ctx.mouseIsPressed=false;probe('mouseReleased();');
ok('holding the mouse stance button enters prone and release keeps it prone', P("actorStance(player)==='PRONE' && player.stance.to===2"));
for (const [w,h] of [[320,568],[393,800],[940,430]]) {
  probe(`width=${w};height=${h};leftStick.base={x:80,y:height-160};`);const b=P('stanceTouchButton()');
  ok('the left stance control fits '+w+'x'+h,b.x-b.w/2>=0&&b.x+b.w/2<=w&&b.y-b.h/2>=100&&b.y+b.h/2<h&&
    (Math.abs(b.x-80)>b.w/2+60||Math.abs(b.y-(h-160))>b.h/2+60));
  ok('the raised crouch button sits across from dash '+w+'x'+h,Math.abs(b.y-P('touchCombatLayout().dash.y'))<1e-8);
}

fresh();keys.add(67);probe('handleDesktop();');advance(100);
ok('keyboard C waits for release before crouching', P('player.stance.to===0'));
keys.clear();probe('handleDesktop();');advance(500);
ok('a short keyboard C tap crouches', P("actorStance(player)==='CROUCH' && player.stance.to===1"));
keys.add(67);probe('handleDesktop();');advance(100);keys.clear();probe('handleDesktop();');advance(500);
ok('a second short keyboard C tap stands instead of entering prone', P("actorStance(player)==='STAND' && player.stance.to===0"));
keys.add(67);probe('handleDesktop();');advance(199);
ok('keyboard C cannot enter prone before the full hold threshold', P('player.stance.to===0'));
advance(1);advance(500);
ok('holding keyboard C for 200 milliseconds enters prone', P("actorStance(player)==='PRONE' && player.stance.to===2"));
keys.clear();probe('handleDesktop();');advance(400);
ok('releasing a keyboard hold leaves prone settled', P("actorStance(player)==='PRONE'"));
keys.add(90);probe('handleDesktop();');advance(500);
ok('the explicit Z shortcut still toggles prone to standing', P("actorStance(player)==='STAND'"));
keys.clear();probe('handleDesktop();');keys.add(90);probe('handleDesktop();');advance(500);
ok('keyboard Z retains an explicit direct prone shortcut', P("actorStance(player)==='PRONE'"));
fresh();keys.add(67);probe('isPaused=true;consumePauseControlInputs();isPaused=false;handleDesktop();');advance(1300);
ok('a menu-held C key stays consumed after resume', P("actorStance(player)==='STAND' && player.stance.to===0"));
keys.clear();probe('handleDesktop();');advance(400);
ok('releasing a menu-held C key cannot become a crouch tap', P('player.stance.to===0'));
keys.add(67);probe('handleDesktop();');advance(100);keys.clear();probe('handleDesktop();');advance(500);
ok('releasing a menu-held key permits the next deliberate tap', P("actorStance(player)==='CROUCH'"));
fresh();keys.add(90);probe('isPaused=true;consumePauseControlInputs();isPaused=false;handleDesktop();');
ok('a menu-held Z shortcut stays consumed after resume', P('player.stance.to===0'));
keys.clear();probe('handleDesktop();');keys.add(90);probe('handleDesktop();');
ok('releasing a menu-held Z shortcut permits the next deliberate press', P('player.stance.to===2'));
fresh();probe('window.shovelOwned=true;setMeleeTool("SHOVEL");window.stanceDigCalls=0;var stanceOriginalDig=shovelDig;shovelDig=()=>{stanceDigCalls++;return true;};BIOME_ACTIVE=true;currentLevel=1;');
keys.add(67);probe('handleDesktop();');
ok('C remains the shovel dig command instead of crouching with the tool equipped', P('stanceDigCalls===1 && player.stance.to===0'));
probe('shovelDig=stanceOriginalDig;');

fresh();pad={index:0,id:'STANCE TEST',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
pad.buttons[13].pressed=true;probe('handleGamepad();');advance(100);
ok('D-pad down waits for tap release', P('player.stance.to===0'));
pad.buttons[13].pressed=false;probe('handleGamepad();');advance(500);
ok('a D-pad down tap crouches', P("actorStance(player)==='CROUCH' && player.stance.to===1"));
pad.buttons[13].pressed=true;probe('handleGamepad();');advance(100);pad.buttons[13].pressed=false;probe('handleGamepad();');advance(500);
ok('another D-pad down tap stands instead of entering prone', P("actorStance(player)==='STAND' && player.stance.to===0"));
pad.buttons[13].pressed=true;probe('handleGamepad();');advance(199);
ok('D-pad down cannot enter prone before 200 milliseconds', P('player.stance.to===0'));
advance(1);advance(800);probe('handleGamepad();');
ok('a held D-pad down enters prone once', P("actorStance(player)==='PRONE' && player.stance.to===2"));
pad.buttons[13].pressed=false;probe('handleGamepad();');advance(400);
ok('releasing a completed D-pad hold keeps the actor prone', P("actorStance(player)==='PRONE'"));
fresh();pad={index:0,id:'STANCE TEST',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
pad.buttons[13].pressed=true;probe('isPaused=true;consumePauseControlInputs();isPaused=false;handleGamepad();');advance(1300);
ok('a menu-held D-pad down stays consumed after resume', P('player.stance.to===0'));
pad.buttons[13].pressed=false;probe('handleGamepad();');advance(300);
ok('a menu-consumed D-pad release cannot become a tap', P('player.stance.to===0'));
pad.buttons[13].pressed=true;probe('handleGamepad();');advance(100);pad.buttons[13].pressed=false;probe('handleGamepad();');advance(500);
ok('a fresh D-pad tap after menu consumption can crouch', P("actorStance(player)==='CROUCH'"));
fresh();pad={index:0,id:'STANCE TEST',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
pad.buttons[13].pressed=true;probe('handleGamepad();');advance(100);pad=null;probe('handleGamepad();');advance(1300);
ok('disconnecting the controller cancels a pending hold without a tap or delayed prone request', P('player.stance.to===0'));
fresh();pad={index:0,id:'STANCE TEST',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
pad.buttons[10].pressed=true;probe('handleGamepad();');
ok('L3 retains the existing standing dash binding', P('player.dashTimer>0'));

fresh();probe('buildings=activeBuildings=[{x:40,y:0,w:10,h:120,isWall:true}];invalidateColIndex();');
ok('the standing root can be clear beside cover', !P('player.checkCol(player.x,player.y)'));
ok('a dive is refused if its extended body would enter cover', !P("requestActorStance(player,'PRONE')"));
probe("resetActorStance(player,'PRONE');");
ok('prone movement checks its forward end rather than only its root', P('player.checkCol(0,0)'));
probe('player.aimAngle=Math.PI/2;');
ok('gun aiming cannot rotate the anchored prone footprint',P('player.checkCol(0,0)')&&P('stanceFacingAngle(player)===0'));
probe('player.stance.proneHeading=Math.PI/2;');
ok('a physical body turn rotates the prone footprint',!P('player.checkCol(0,0)'));
probe('constrainStanceFacing(player);rightStick.active=true;rightStick.dx=1;rightStick.dy=0;rightStick.dist=0;frameCount++;player.updatePlayer();');
ok('a native aim update cannot rotate the prone body through an adjacent wall',
  P('Math.abs(player.aimAngle)<1e-8 && Math.abs(stanceFacingAngle(player)-Math.PI/2)<1e-8 && stanceProneSpotClear(player)'));
probe('leftStick.active=true;leftStick.dx=1;leftStick.dy=0;for(let i=0;i<30;i++){frameCount++;player.updatePlayer();}');
ok('holding prone aim prevents voluntary movement beside cover',P('player.x===0&&!player.isMoving'));
probe('rightStick.active=false;for(let i=0;i<60;i++){frameCount++;player.updatePlayer();}');
ok('the prone body translates until its capsule reaches cover without entering it',
  P('player.x>0 && player.x<=20 && !player.checkCol(player.x,player.y)'));
fresh();probe("requestActorStance(player,'PRONE');");advance(100);
probe('buildings=activeBuildings=[{x:40,y:0,w:10,h:120,isWall:true}];invalidateColIndex();');advance(200);
ok('cover appearing during the stationary drop stops it at a safe crouch', P("actorStance(player)==='CROUCH' && player.stance.to===1 && !player.checkCol(player.x,player.y)"));

const traveled=[];
for(const stance of ['STAND','CROUCH','PRONE']) {
  fresh();probe(`resetActorStance(player,'${stance}');leftStick.active=true;leftStick.dx=1;leftStick.dy=0;`);
  for(let i=0;i<10;i++)probe('frameCount++;player.updatePlayer();');
  traveled.push(P('player.x'));
}
ok('native crouch movement runs at 60 percent of standing speed', Math.abs(traveled[1]/traveled[0]-.6)<1e-8);
ok('native prone movement runs at 25 percent of standing speed', Math.abs(traveled[2]/traveled[0]-.25)<1e-8);

fresh();probe("startAtLevel(8);setMeleeTool('NONE');resetActorStance(player,'PRONE');saveGame();");
ok('the campaign records the settled player stance', JSON.parse(slot).playerStance==='PRONE');
probe('loadGame();');
ok('loading restores the prone profile on clear floor', P("actorStance(player)==='PRONE' && player.stance.value===2"));
probe("player.y=-760;player.aimAngle=-HALF_PI;resetActorStance(player,'PRONE');saveGame();loadGame();");
ok('a saved prone body that no longer fits beside a wall falls back to crouching',
  P("actorStance(player)==='CROUCH' && !player.checkCol(player.x,player.y)"));
let disk=JSON.parse(slot);delete disk.playerStance;slot=JSON.stringify(disk);probe('loadGame();');
ok('older saves safely default to standing', P("actorStance(player)==='STAND'"));
disk=JSON.parse(slot);disk.playerStance='FLOAT';slot=JSON.stringify(disk);probe('loadGame();');
ok('unknown save stance values cannot create an invalid profile', P("actorStance(player)==='STAND'"));
probe("resetActorStance(player,'PRONE');resetRunState();startAtLevel(8);");
ok('replacing a run starts the new player standing', P("actorStance(player)==='STAND'"));
fresh();probe("undergroundRoute.mode='CONFIRM';");
ok('the elevator confirmation blocks direct stance and touch requests',
  P("!requestActorStance(player,'CROUCH')&&!handleStanceTouch(stanceTouchButton().x,stanceTouchButton().y)"));
fresh();probe("currentLevel=9;undergroundRoute.arrivalMs=0;");
ok('arrival doors keep stance input frozen until the elevator opens',!P("requestActorStance(player,'CROUCH')"));
probe('undergroundRoute.arrivalMs=900;player.x=140;player.y=700;player.aimAngle=0;');
ok('a dive checks the underground floor boundary with its full footprint',!P("requestActorStance(player,'PRONE')"));
probe('player.x=0;');
ok('the open tunnel admits a full prone footprint',P("requestActorStance(player,'PRONE')"));
console.log(`${checks}/${checks} stance transition, control, collision and save checks passed`);

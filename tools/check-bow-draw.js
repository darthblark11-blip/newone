// Actual player/gamepad update paths: analog tension earns energy as it is
// drawn, releases once, and cannot turn a held jab into a clean arrow later.
const assert = require('assert');
const { ctx, probe } = require('./harness');
let checks = 0, now = 1000, pad;
ctx.millis = () => now;
ctx.navigator.getGamepads = () => pad ? [pad] : [];
ctx.setTimeout = () => 0;
const run = source => probe(source);
function check(source, label) { assert.ok(run(source), label); checks++; }
function reset() {
  pad = { axes:[0,0,0,0], buttons:Array.from({length:17}, () => ({pressed:false})) };
  now = 1000; ctx.touches = [];
  run(`currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=false;
    inOverworldView=inTravelMenu=false;isCooking=false;nm0AmbushActive=false;
    player=new Character(0,0,true);player.flags=player.flags||{};player.flags.bowUnlocked=true;
    player.currentWeapon=WEAPONS.BOW;player.ammo=24;player.isArmed=true;
    enemiesList=[];bullets=[];particles=[];activeBuildings=[];activeParkingCars=[];barrels=[];
    invalidateColIndex();resetForestWildlife();window.milLvl=0;headAimToggle=false;
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
    window.isDesktop=false;prevGamepadButtons=[];gamepadWasConnected=false;
    frameCount=100;deltaTime=1000/60;`);
  tick(0);
}
function tick(magnitude, ms=1000/60, angle=Math.PI, buttons=[]) {
  now += ms;
  if (pad) {
    pad.axes[2] = Math.cos(angle)*magnitude;pad.axes[3] = Math.sin(angle)*magnitude;
    pad.buttons.forEach((b,i) => b.pressed = buttons.includes(i));
    run('handleGamepad();');
  }
  run(`deltaTime=${ms};frameCount++;player.updatePlayer();`);
}
function draw(duration=900, hz=60, target=.92) {
  const frames=Math.round(duration/1000*hz), ms=1000/hz;
  for(let i=1;i<=frames;i++)tick(target*i/frames,ms);
}
reset();
check('player.bowDrawState.phase===\'IDLE\'&&player.bowDrawState.tension===0&&bullets.length===0',
  'A centered stick readies an unpulled bow without firing');
draw();
check('bullets.length===0&&player.ammo===24&&player.bowDrawState.phase===\'DRAW\'',
  'An extended smooth pull above the firearm threshold does not autofire');
check('Math.abs(player.aimAngle)<1e-8&&player.bowDrawState.quality>.99&&player.bowDrawState.power>.99',
  'Pulling left aims right and earns full energy gradually');
run('var drawTension=bowDrawAmount(player),drawLedger=serializeForestWildlife().seed;');
tick(0);
check('bullets.length===1&&player.ammo===23&&bullets[0].arrowPower>.99&&!bullets[0].arrowDud',
  'Letting go releases one clean arrow and spends one quiver slot');
check('Math.abs(bullets[0].a)<1e-8&&Math.abs(bullets[0].startX-(47-9*drawTension))<1e-8&&Math.abs(bullets[0].startY)<1e-8',
  'Release retains the drawn heading and actual sliding arrow-tip origin');
check('Math.abs(bullets[0].arrowSpeed-34)<1e-8&&Math.abs(bullets[0].arrowRange-1200)<1e-8&&serializeForestWildlife().seed===drawLedger',
  'A full smooth draw sets physical velocity/range without ecology RNG');
for(let i=0;i<100;i++)tick(0);
check('bullets.length===1&&player.ammo===23','A held center never repeats the release');

reset();tick(1);
check('bullets.length===1&&bullets[0].arrowDud&&bullets[0].arrowPower<.01&&bullets[0].arrowSpeed<5&&bullets[0].arrowRange<40',
  'An instant full-deflection jab immediately fires a short weak dud');
for(let i=0;i<120;i++)tick(1);
check('bullets.length===1&&player.ammo===23&&player.bowDrawState.phase===\'LATCHED\'',
  'Holding full deflection cannot recharge a dud or create repeated arrows');
tick(0);draw();tick(0);
check('bullets.length===2&&!bullets[1].arrowDud&&bullets[1].arrowPower>.99',
  'Returning to center permits a fresh smooth gesture');
run(`var dud=bullets[0];for(let i=0;i<100&&dud.active;i++)dud.update();`);
check('!dud.active&&dud.arrowTravel<=dud.arrowRange&&Math.hypot(dud.x-dud.startX,dud.y-dud.startY)<40',
  'The dud physically falls short instead of travelling the normal arrow range');

reset();draw(900,60,1);
check('bullets.length===1&&!bullets[0].arrowDud&&bullets[0].arrowPower>.99&&player.bowDrawState.phase===\'LATCHED\'',
  'A smooth pull to the end stop releases exactly once at strong tension');
for(let i=0;i<90;i++)tick(1);
check('bullets.length===1','The smooth end-stop release also remains latched');

reset();draw(900,60,.62);tick(0);
run('var partialPower=bullets[0].arrowPower,partialSpeed=bullets[0].arrowSpeed,partialRange=bullets[0].arrowRange;');
check('partialPower>0&&partialPower<.55&&!bullets[0].arrowDud&&partialSpeed<20&&partialRange<650',
  'A clean partial draw has less real velocity, reach and impact power');
reset();draw(160,60,.92);tick(0);
check('bullets[0].arrowPower<.55&&bullets[0].arrowSpeed<20',
  'A rushed pull cannot match a deliberately interpolated draw');
for(const hz of [30,60,120]) {
  reset();draw(900,hz);tick(0,1000/hz);
  check('bullets.length===1&&bullets[0].arrowPower>.99&&!bullets[0].arrowDud',
    'The same smooth gesture earns the same power at '+hz+' FPS');
}

reset();draw();tick(.92,1000/60,Math.PI,[11]);
check('bullets.length===1&&!headAimToggle&&bullets[0].arrowPower>.99',
  'Right-stick click releases the drawn bow without toggling animal/head aim');
for(let i=0;i<80;i++)tick(.92,1000/60,Math.PI,[11]);
check('bullets.length===1','A held R3 release cannot repeat');
reset();run('player.currentWeapon=WEAPONS.PISTOL;');tick(0,1000/60,Math.PI,[11]);
check('headAimToggle','R3 retains the existing headshot toggle for firearms');

for(const flag of ['isPaused','inTravelMenu','inWorldBuildingMenu','inTownCutscene','killcamMode']) {
  reset();draw();
  run(`${flag}=true;tickPlayerBowLifecycle(player);${flag}=false;`);tick(0);
  check('bullets.length===0&&player.weaponAmmo.BOW===24&&player.bowDrawState.tension===0',
    flag+' cancels a drawn bow without releasing or spending ammo');
}
reset();draw();run('player.currentWeapon=WEAPONS.PISTOL;tickPlayerBowLifecycle(player);player.currentWeapon=WEAPONS.BOW;');tick(0);
check('bullets.length===0&&player.ammo===24','Switching weapons discards a pending draw');
reset();draw();run('currentLevel=3;tickPlayerBowLifecycle(player);');tick(0);tick(0);
check('bullets.length===0&&player.ammo===24','Sector travel cannot preserve a charged shot');
reset();draw();pad=null;run('rightStick.active=false;rightStick.dist=0;handleGamepad();');tick(0);
check('bullets.length===0&&player.ammo===24&&player.bowDrawState.tension===0',
  'Controller disconnection cancels instead of masquerading as a release');

function touchFrame(amount) {
  const aim=run('touchAimSilhouetteLayout()'),body=aim.sections.find(s=>s.zone==='BODY');
  const origin={x:aim.centerX,y:body.y+body.h/2};
  if(amount&&!ctx.touches.length) {
    ctx.touches=[{id:91,...origin}];run('handleTouches();handleGamepad();');tick(0);
  }
  ctx.touches=amount ? [{id:91,x:origin.x-60*amount,y:origin.y}] : [];
  run('handleTouches();handleGamepad();');tick(0);
}
reset();pad=null;touchFrame(0);touchFrame(0);
for(let i=1;i<=54;i++)touchFrame(.92*i/54);
check('bullets.length===0&&player.bowDrawState.source===\'TOUCH\'&&player.bowDrawState.power>.99&&Math.abs(player.aimAngle)<1e-8',
  'Actual touch coordinates draw smoothly and aim opposite their travel');
touchFrame(0);
check('bullets.length===1&&bullets[0].arrowPower>.99&&player.ammo===23',
  'Lifting the real joystick touch releases one earned arrow');
reset();pad=null;touchFrame(0);touchFrame(0);touchFrame(1);
for(let i=0;i<90;i++)touchFrame(1);
check('bullets.length===1&&bullets[0].arrowDud&&player.ammo===23',
  'A touchscreen end-stop jab also fires one dud and remains latched');

reset();pad=null;run('window.isDesktop=true;rightStick.active=true;rightStick.dx=1;rightStick.dy=0;rightStick.dist=0;');tick(0);tick(0);
run('rightStick.dist=1;');for(let i=0;i<50;i++)tick(1);
check('bullets.length===0&&player.bowDrawState.tension===1&&player.bowDrawState.quality>.99&&player.aimAngle===0',
  'Mouse holding draws gradually with direct cursor aim and no end-stop autofire');
run('rightStick.dist=0;');tick(0);
check('bullets.length===1&&bullets[0].arrowPower===1','Mouse release fires the built tension');

reset();draw();run('player.ammo=0;');tick(0);
check('bullets.length===0&&player.ammo===0&&player.reloadTimer===0',
  'An empty quiver cannot fire or manufacture arrows');
reset();run('player.currentWeapon=WEAPONS.PISTOL;player.ammo=17;');tick(1);
check('bullets.length===1&&!bullets[0].isArrow&&player.ammo===16',
  'Firearms keep their original full-stick firing behavior');
console.log(checks+'/'+checks+' bow draw/release checks passed.');

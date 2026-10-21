// Exercise the real weapon/bow updates and quick-draw projectiles with both
// gamepad fire schemes, including held input across control handoffs.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let pad = null, now = 8000, checks = 0;
ctx.navigator.getGamepads = () => pad ? [pad] : [];
ctx.millis = () => now;
ctx.setTimeout = () => 0;
const run = code => probe(code);
function ready() {
  run(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=false;
    inOverworldView=inTravelMenu=inCutscene=false;isCooking=false;window.isDesktop=false;`);
}
function reset(scheme='R2') {
  pad = null; ctx.touches=[];
  run(`exitFrontierSaloon();isStoryMode=false;townsData={};startAtLevel(1);
    gamepadControlSettings.shooting=${JSON.stringify(scheme)};
    gamepadControlSettings.boxing='STANDARD';
    player=new Character(0,0,true);player.currentWeapon=WEAPONS.PISTOL;player.ammo=17;
    player.isArmed=true;BIOME_ACTIVE=false;enemiesList=[];bullets=[];corpses=[];particles=[];
    activeBuildings=[];activeParkingCars=[];barrels=[];invalidateColIndex();
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
    chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
    swordPickedUp=false;window.pickaxeOwned=false;setMeleeTool('NONE');
    meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;headAimToggle=false;
    prevGamepadButtons=[];gamepadWasConnected=false;resetGamepadFireInput();`);
  ready(); connect(); frame();
}
function connect(buttons=[],axes=[0,0,0,0]) {
  pad={connected:true,index:0,id:'trigger-check',axes,
    buttons:Array.from({length:17},(_,i)=>({pressed:buttons.includes(i),value:buttons.includes(i)?1:0}))};
}
function buttons(down) {pad.buttons.forEach((b,i)=>b.pressed=down.includes(i));}
function frame(count=1,ms=1000/60) {
  for(let i=0;i<count;i++) {now+=ms;ctx.deltaTime=ms;
    run('frameCount++;handleTouches();handleGamepad();player.updatePlayer();');}
}
function check(name,body) {reset();body();checks++;console.log('  ok   '+name);}
check('R2 scheme full-stick input aims without spending firearm ammunition',()=>{
  pad.axes=[0,0,.8,.6];frame(80);
  assert.equal(run('bullets.length'),0);assert.equal(run('player.ammo'),17);
  assert(Math.abs(run('player.aimAngle')-Math.atan2(.6,.8))<1e-8);
});
for(const weapon of ['PISTOL','REVOLVER','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','ROCKET_LAUNCHER','TASER'])
  check(weapon+' uses its native projectile/ammo path from R2',()=>{
    run(`player.currentWeapon=WEAPONS.${weapon};player.ammo=player.currentWeapon.maxAmmo;`);
    const ammo=run('player.ammo');pad.axes=[0,0,0,-1];buttons([7]);frame();
    assert(run('bullets.length')>0);assert(run('player.ammo')<ammo);
    assert(run('player.muzzleFlash')>0 || weapon==='TASER');
    assert(Math.abs(run('player.aimAngle')+Math.PI/2)<1e-8);
  });
check('A neutral right stick fires along the retained facing',()=>{
  run('player.aimAngle=1.2;');buttons([7]);frame();
  assert.equal(run('bullets.length'),1);assert(Math.abs(run('bullets[0].a')-1.2)<.06);
});
check('A held R2 respects the weapon fire cooldown',()=>{
  buttons([7]);frame();const first=run('player.ammo');frame(2);
  assert.equal(run('player.ammo'),first);frame(30);assert(run('player.ammo')<first);
});
check('Reload, melee, dash and empty magazines retain their firing gates',()=>{
  for(const gate of ['player.reloadTimer=10','player.meleeTimer=10','player.dashTimer=10','player.ammo=0']) {
    reset();run(gate);buttons([7]);frame();assert.equal(run('bullets.length'),0,gate);
  }
});
check('Default stick scheme retains full-stick fire and ignores R2 for native guns',()=>{
  reset('STICK');buttons([7]);frame();assert.equal(run('bullets.length'),0);
  buttons([]);pad.axes=[0,0,1,0];frame();assert.equal(run('bullets.length'),1);
});
check('Pause/resume consumes a held trigger until released',()=>{
  buttons([7]);run('isPaused=true;resetGamepadFireInput();');frame(3);
  assert.equal(run('bullets.length'),0);run('isPaused=false;');frame(30);
  assert.equal(run('bullets.length'),0);buttons([]);frame();buttons([7]);frame();
  assert.equal(run('bullets.length'),1);
});
check('Changing from stick to R2 consumes the already held trigger',()=>{
  reset('STICK');buttons([7]);frame();run("gamepadControlSettings.shooting='R2';");frame(30);
  assert.equal(run('bullets.length'),0);buttons([]);frame();buttons([7]);frame();
  assert.equal(run('bullets.length'),1);
});
check('Changing from R2 to stick waits for a centered stick',()=>{
  pad.axes=[0,0,1,0];frame();run("gamepadControlSettings.shooting='STICK';");frame(30);
  assert.equal(run('bullets.length'),0);pad.axes=[0,0,0,0];frame();pad.axes=[0,0,1,0];frame();
  assert.equal(run('bullets.length'),1);
});
check('Reconnect consumes held R2 without disabling fresh input afterward',()=>{
  pad=null;frame();connect([7],[0,0,1,0]);frame(30);assert.equal(run('bullets.length'),0);
  buttons([]);frame();buttons([7]);frame();assert.equal(run('bullets.length'),1);
});
check('R2 held through leaving boxing cannot become an exterior shot',()=>{
  run('beginWorldBoxing(player);');buttons([7]);run('boxingReadInput(player);');frame();
  assert.equal(run('bullets.length'),0);run('boxingLeaveInput(player);boxingExit(player);');frame(30);
  assert.equal(run('bullets.length'),0);buttons([]);frame();buttons([7]);frame();
  assert.equal(run('bullets.length'),1);
});
check('Touch shooting retains its full-stick gesture while R2 is selected',()=>{
  pad=null;frame();const aim=run('touchAimSilhouetteLayout()'),body=aim.sections.find(s=>s.zone==='BODY');
  const origin={x:aim.centerX,y:body.y+body.h/2};
  ctx.touches=[{id:11,...origin}];frame();
  assert.equal(run('bullets.length'),0,'touchdown selects a zone without firing');
  ctx.touches=[{id:11,x:origin.x+60,y:origin.y}];frame();
  assert.equal(run('bullets.length'),1);
});
check('Mouse firing remains independent of the selected gamepad preference',()=>{
  pad=null;frame();run('window.isDesktop=true;rightStick.active=true;rightStick.dx=1;rightStick.dy=0;rightStick.dist=1;rightStick.gamepadInput=false;player.updatePlayer();');
  assert.equal(run('bullets.length'),1);
});
check('R2 bow right stick aims without drawing or auto-releasing',()=>{
  run('player.currentWeapon=WEAPONS.BOW;player.ammo=24;');pad.axes=[0,0,1,0];frame(90);
  assert.equal(run('bullets.length'),0);assert.equal(run('player.bowDrawState.tension'),0);
  assert.equal(run('player.aimAngle'),0);
});
check('Holding then releasing R2 draws and releases one powered arrow',()=>{
  run('player.currentWeapon=WEAPONS.BOW;player.ammo=24;');pad.axes=[0,0,1,0];frame();
  buttons([7]);frame(60);assert.equal(run('bullets.length'),0);
  assert.equal(run('player.bowDrawState.tension'),1);buttons([]);frame();
  assert.equal(run('bullets.length'),1);assert(run('bullets[0].arrowPower')>.99);
  assert(Math.abs(run('bullets[0].a'))<1e-8);frame(60);assert.equal(run('bullets.length'),1);
});
check('Pausing a charged R2 bow cancels its release without an arrow',()=>{
  run('player.currentWeapon=WEAPONS.BOW;player.ammo=24;');buttons([7]);frame(60);
  run('isPaused=true;resetGamepadFireInput();isPaused=false;');frame(30);buttons([]);frame(2);
  assert.equal(run('bullets.length'),0);assert.equal(run('player.ammo'),24);
  buttons([7]);frame(60);buttons([]);frame();assert.equal(run('bullets.length'),1);
});
function duel(scheme='R2') {
  reset(scheme);run(`startAtLevel(3);player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;enterFrontierSaloon('DUEL');`);
  ready();roomFrame();
}
function roomFrame(count=1) {for(let i=0;i<count;i++){now+=16.67;ctx.deltaTime=16.67;run('updateFrontierSaloonActivity();');}}
function cue() {run('_frontierSaloonSession.duel.remainingMs=1;');roomFrame();assert.equal(run('_frontierSaloonSession.duel.phase'),'DRAW');}
check('Quick draw full stick only aims in R2 mode and preserves WAIT',()=>{
  duel();pad.axes=[0,0,1,0];roomFrame(15);
  assert.equal(run('_frontierSaloonSession.duel.phase'),'WAIT');
  assert.equal(run('_frontierSaloonSession.duel.ammo'),6);assert.equal(run('player.aimAngle'),0);
});
check('Quick draw R2 before DRAW triggers the existing false-start defeat',()=>{
  duel();buttons([7]);roomFrame();assert.equal(run('_frontierSaloonSession.duel.result'),'FALSE START');
  assert.equal(run('cowboyCostumeOwned'),false);
});
check('Quick draw R2 launches a finite round and produces a native death/reward',()=>{
  duel();cue();pad.axes=[0,0,1,0];buttons([7]);roomFrame();
  assert.equal(run('_frontierSaloonSession.duel.ammo'),5);
  assert.equal(run('_frontierSaloonSession.duel.projectiles.length'),1);
  roomFrame(30);assert(run('_frontierSaloonSession.duel.won'));
  assert(run('_frontierSaloonSession.duel.opponentCorpse instanceof Corpse'));
  assert(run('cowboyCostumeOwned'));assert.equal(run('bullets.length'),0);
});
check('A held quick-draw trigger cannot spend another duel round',()=>{
  duel();cue();pad.axes=[0,0,0,1];buttons([7]);roomFrame(25);
  assert.equal(run('_frontierSaloonSession.duel.ammo'),5);
});
check('A mis-aimed R2 duel shot still allows the opponent death trigger',()=>{
  duel();cue();pad.axes=[0,0,0,1];buttons([7]);roomFrame(110);
  assert.equal(run('_frontierSaloonSession.duel.won'),false);
  assert(run('_frontierSaloonSession.duel.playerCorpse instanceof Corpse'));
  assert.equal(run('isDead'),false);
});
check('Duel pause/resume consumes R2 and full stick until fresh input',()=>{
  duel();cue();pad.axes=[0,0,1,0];buttons([7]);run('isPaused=true;resetGamepadFireInput();');roomFrame(30);
  run('isPaused=false;');roomFrame();assert.equal(run('_frontierSaloonSession.duel.ammo'),6);
  buttons([]);roomFrame();buttons([7]);roomFrame();assert.equal(run('_frontierSaloonSession.duel.ammo'),5);
});
check('Default quick draw still fires at the right-stick outer ring',()=>{
  duel('STICK');cue();pad.axes=[0,0,1,0];roomFrame();
  assert.equal(run('_frontierSaloonSession.duel.ammo'),5);
});
check('Touch quick draw keeps its outer fire ring with R2 selected',()=>{
  duel();cue();pad=null;roomFrame();const c=run('frontierQuickDrawControls()');
  ctx.touches=[{id:22,x:c.x+c.r*.9,y:c.y}];roomFrame();
  assert.equal(run('_frontierSaloonSession.duel.ammo'),5);
});
console.log('\n'+checks+' trigger shooting checks passed.');

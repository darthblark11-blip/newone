// Native touch callbacks and player updates: targeting chooses a zone once,
// then hands an unchanged analog gesture to the existing firing/bow paths.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness');
let checks=0, now=1000, pad=null;
ctx.millis=()=>now;
ctx.setTimeout=()=>0;
ctx.navigator.getGamepads=()=>pad?[pad]:[];
const run=s=>probe(s);
const ok=(s,label)=>{assert.ok(run(s),label);checks++;};
function reset(){
  pad=null;ctx.touches=[];now+=1000;
  run(`width=393;height=800;currentLevel=currentBiome=2;BIOME_ACTIVE=false;
    started=doTick=true;isStoryMode=isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inUpstairsRoom=inTownCutscene=inFortCutscene=false;
    inPostAmbushCutscene=inFarmCutscene=inFarmPostCutscene=inDarchonCall=false;
    inWorldBuildingMenu=inOverworldView=inTravelMenu=inLvl4Cutscene=false;
    window.inNM0SecretOverlay=false;buildGhost=null;isCooking=false;
    chemistSuitUnlocked=explosiveArmorUnlocked=false;grenadesUnlocked=meleeUnlocked=jetpackUnlocked=true;
    pGrenadeAmmo=3;pFlaskAmmo=2;playerGrenades=[];playerFlasks=[];lightnings=[];
    player=new Character(0,0,true);player.isArmed=true;player.ammo=20;
    bullets=[];particles=[];enemiesList=[];activeBuildings=[];activeParkingCars=[];
    buildings=[];barrels=[];invalidateColIndex();resetForestWildlife();
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
    resetTouchAimSelection(false);resetTouchControlFade();setPlayerAimZone('BODY');setMeleeTool('NONE');
    window.__frontierConsumedTouches=new Set();window.__streetConsumedTouches=new Set();
    window.isDesktop=false;window.showOnScreenControls=true;window.lastPauseTime=0;
    prevGamepadButtons=[];gamepadWasConnected=false;frameCount=100;deltaTime=1000/60;`);
}
function point(zone,id=10){
  const p=run('touchAimSilhouetteLayout()'),s=p.sections.find(s=>s.zone===zone);
  return {id,x:p.centerX-9,y:s.y+s.h/2};
}
function actionPoint(slot,id=40){return {id,...run('touchCombatLayout().'+slot)};}
function start(t){ctx.touches.push(t);run('touchStarted();handleTouches();');return t;}
function move(t,x,y){Object.assign(t,{x,y});run('touchMoved();handleTouches();');}
function release(id){ctx.touches=ctx.touches.filter(t=>t.id!==id);run('touchEnded();handleTouches();');}
function tick(){now+=1000/60;run('frameCount++;player.updatePlayer();updateTouchControlFade();');}

for(const zone of ['HEAD','BODY','LEGS']){
  reset();const t=start(point(zone)),origin={...t};tick();
  ok(`playerAimTarget()==='${zone}'&&touchAimSelection.pointerId===10&&rightStick.active&&
    rightStick.touchOrigin.x===${origin.x}&&rightStick.touchOrigin.y===${origin.y}&&rightStick.dist===0&&bullets.length===0`,
    zone+' down selects without firing and anchors at the exact press');
  move(t,origin.x-60,origin.y);tick();
  ok(`bullets.length===1&&bullets[0].tH==='${zone}'&&player.aimAngle>0&&player.aimAngle<PI-.1&&
    Math.abs(bullets[0].a-player.aimAngle)<1e-8&&rightStick.dx===-1&&rightStick.dy===0&&rightStick.dist===1`,
    zone+' fires along the visible intermediate barrel while turning toward the touch heading');
  run('rightStick.dist=.4;');for(let i=0;i<80;i++)tick();
  ok('Math.abs(player.aimAngle-PI)<1e-8&&bullets.length===1',zone+' settles onto the selected touch heading without extra firing');
  release(t.id);
  ok(`!rightStick.active&&!rightStick.touchOrigin&&touchAimSelection.pointerId===null&&playerAimTarget()==='${zone}'`,
    zone+' release hides joystick and preserves selected target');
}

reset();const owner=start(point('HEAD')),origin={...owner};
move(owner,origin.x,point('LEGS').y);
ok("playerAimTarget()==='HEAD'&&rightStick.touchOrigin.y==="+origin.y,'Crossing sections cannot retarget or move the origin');
const extra=start(point('LEGS',20));
ok("touchAimSelection.pointerId===10&&playerAimTarget()==='HEAD'",'Another finger cannot steal targeting');
const movement=start({id:30,x:125,y:640});
ok('leftStick.active&&leftStick.dx>0&&touchAimSelection.pointerId===10','A second control finger can move independently');
run('window.touchReloads=0;player.triggerReload=()=>touchReloads++;player.ammo=2;');
const reloadPoint=actionPoint('reload'),action=start(reloadPoint);
ok('touchReloads===1&&rightStick.base.x===313&&rightStick.base.y===690',
  'Reload stays at its fixed screen position while aim floats');
release(action.id);run('touchReloads=0;');move(owner,reloadPoint.x,reloadPoint.y);
ok('touchReloads===0&&touchAimSelection.pointerId===10',"Dragging the aiming finger over reload doesn't press it");
release(owner.id);
ok('touchAimSelection.pointerId===null&&!rightStick.active','An already-held extra finger cannot become the next aim owner');
move(extra,point('BODY').x,point('BODY').y);
ok('touchAimSelection.pointerId===null','Dragging an unowned finger into a section cannot acquire aiming');
release(extra.id);release(movement.id);start(point('LEGS',21));
ok("touchAimSelection.pointerId===21&&playerAimTarget()==='LEGS'",'A fresh press after release selects a new zone');

reset();const outside=start({id:7,x:180,y:650});move(outside,point('HEAD').x,point('HEAD').y);
ok('touchAimSelection.pointerId===null&&!rightStick.active','A gesture beginning outside the silhouette cannot fire');

for(const flag of ['isPaused','isDead','isWin','killcamMode','inStoryIntro','inStoryRoom','inTownCutscene',
  'inFortCutscene','inFarmCutscene','inFarmPostCutscene','inPostAmbushCutscene','inDarchonCall',
  'inWorldBuildingMenu','inTravelMenu','inLvl4Cutscene','window.inNM0SecretOverlay']){
  reset();const t=start(point('LEGS'));
  run(`${flag}=true;syncTouchAimControlContext();${flag}=false;handleTouches();`);
  ok('touchAimSelection.pointerId===null&&!rightStick.active',flag+' consumes a held aim gesture through resume');
  release(t.id);start(point('BODY',11));
  ok("touchAimSelection.pointerId===11&&playerAimTarget()==='BODY'",flag+' allows fresh input after release');
}
reset();start(point('HEAD'));
run('inOverworldView=true;syncTouchAimControlContext();handleTouches();');
ok("touchAimSelection.pointerId===10&&rightStick.active&&playerAimTarget()==='HEAD'",
  'Live overworld exploration keeps the existing touch gesture active');
for(const phase of [1,3,4,5,6,8,9]){
  reset();start(point('HEAD'));
  run(`currentLevel=0;prologuePhase=${phase};syncTouchAimControlContext();currentLevel=2;handleTouches();`);
  ok('touchAimSelection.pointerId===null&&!rightStick.active','Prologue phase '+phase+' consumes held aim');
}
reset();start(point('HEAD'));run('currentLevel=0;inUpstairsRoom=true;upstairsPhase=3;syncTouchAimControlContext();inUpstairsRoom=false;currentLevel=2;handleTouches();');
ok('touchAimSelection.pointerId===null&&!rightStick.active','Upstairs narration consumes held aim');

reset();start(point('HEAD'));run('consumePauseControlInputs();handleTouches();');
ok('touchAimSelection.pointerId===null&&!rightStick.active','Pause/settings input consumption waits for release');
reset();start(point('HEAD'));ctx.windowWidth=393;ctx.windowHeight=800;run('windowResized();handleTouches();');
ok('touchAimSelection.pointerId===null&&!rightStick.active','Resize consumes the old pointer before moving layout');
reset();start(point('HEAD'));pad={axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false}))};
run('handleGamepad();');pad=null;run('handleTouches();');
ok('touchAimSelection.pointerId===null&&!rightStick.active','Controller takeover consumes old touch until release');

reset();const bow=start(point('LEGS')),bowOrigin={...bow};
run('player.currentWeapon=WEAPONS.BOW;player.ammo=24;');tick();
for(let i=1;i<=54;i++){move(bow,bowOrigin.x-60*.92*i/54,bowOrigin.y);tick();}
ok("bullets.length===0&&player.bowDrawState.phase==='DRAW'&&player.bowDrawState.power>.99",'Floating touch draws a smooth bow without early fire');
release(bow.id);tick();
ok("bullets.length===1&&bullets[0].isArrow&&bullets[0].tH==='LEGS'&&bullets[0].arrowPower>.99",'Neutral release emits one arrow with the selected leg target');
reset();const cancel=start(point('HEAD'));run("player.currentWeapon=WEAPONS.BOW;player.ammo=24;");
move(cancel,cancel.x-35,cancel.y);tick();run('cancelTouchAimPointer({changedTouches:[{identifier:10}]});handleTouches();');tick();
ok("bullets.length===0&&!rightStick.active&&touchAimSelection.pointerId===null",'Native touch cancellation discards bow charge without firing');

// Each column row must drive only its real action in both suits. This also
// exercises small screens where the column shifts clear of the raised aim pad.
for(const [w,h] of [[320,568],[320,700],[393,800],[940,430]]){
  const screen=()=>{reset();run(`width=${w};height=${h};leftStick.base={x:80,y:height-160};rightStick.base={x:width-80,y:height-110};`);};
  screen();
  const layout=run('touchCombatLayout()'),rows=['grenade','reload','dash','melee'].map(key=>layout[key]);
  assert(rows.every(p=>p.x===w-35)&&rows.every((p,i)=>!i||p.y>rows[i-1].y),'column order and right edge');checks++;
  assert(rows.every(p=>p.y-layout.radius>=100&&p.y+layout.radius<=h),'buttons fit below the HUD');checks++;
  const aim=run('touchAimSilhouetteLayout()');
  assert(aim.w>96&&aim.h>160,'silhouette buttons are larger than the original control');checks++;
  if(h>=640){assert(aim.centerX<w-80,'silhouette sits left of its previous position');checks++;}
  assert(aim.x>=0&&aim.x+aim.w<=w&&aim.y>=100&&aim.y+aim.h<=h,'silhouette remains on screen below the HUD');checks++;
  for(const p of rows){
    const dx=Math.max(aim.x-p.x,0,p.x-aim.x-aim.w),dy=Math.max(aim.y-p.y,0,p.y-aim.y-aim.h);
    assert(Math.hypot(dx,dy)>layout.hitRadius,'action hit region overlaps silhouette');checks++;
  }
  if(h===800){assert.deepEqual(rows.map(p=>p.y),[300,370,440,510],'full-height requested button slots');checks++;}
  screen();start(actionPoint('grenade'));tick();
  ok('isCooking&&grenadeInputHeld&&!meleeInputHeld&&!cannonInputHeld&&!rightStick.active&&!boxingActive(player)',w+' standard top row cooks only a grenade');
  release(40);tick();ok('playerGrenades.length===1&&playerFlasks.length===0&&lightnings.length===0',w+' standard top release throws the grenade');
  screen();run('player.ammo=2;');start(actionPoint('reload'));
  ok('player.reloadTimer>0&&!grenadeInputHeld&&!meleeInputHeld&&!cannonInputHeld&&!rightStick.active',w+' second row reloads without another action');
  screen();start(actionPoint('dash'));
  ok('player.dashTimer>0&&!grenadeInputHeld&&!meleeInputHeld&&!cannonInputHeld&&!rightStick.active',w+' third row dashes without another action');
  screen();start(actionPoint('melee'));tick();
  ok('boxingActive(player)&&playerGrenades.length===0&&playerFlasks.length===0&&lightnings.length===0',w+' bottom row enters the existing melee stance');
  screen();run('chemistSuitUnlocked=true;');start(actionPoint('flask'));tick();
  ok('isCooking&&meleeInputHeld&&!grenadeInputHeld&&!cannonInputHeld&&!boxingActive(player)&&!rightStick.active',w+' chemist top row cooks only a flask');
  release(40);tick();ok('playerFlasks.length===1&&playerGrenades.length===0&&lightnings.length===0',w+' chemist top release throws liquid');
  screen();run('chemistSuitUnlocked=true;');start(actionPoint('cannon'));tick();
  ok('player.cannonCharge>0&&cannonInputHeld&&!meleeInputHeld&&!grenadeInputHeld&&!isCooking&&!boxingActive(player)',w+' chemist bottom row charges only the cannon');
  release(40);tick();ok('lightnings.length===1&&playerFlasks.length===0&&playerGrenades.length===0',w+' chemist bottom release fires the metal-arm cannon');
}

// Fading changes the picture, never the input route. An analog aim below the
// firing threshold still fades the controls, and release returns them smoothly.
reset();const fadeAim=start(point('HEAD')),fadeOrigin={...fadeAim};tick();
ok('touchControlFade.alpha===1','A neutral zone press keeps the controls visible');
move(fadeAim,fadeOrigin.x-25,fadeOrigin.y);tick();
ok('touchControlFade.alpha>0&&touchControlFade.alpha<1&&bullets.length===0',
  'Aiming fades controls through an intermediate alpha before firing');
const sameFrameAlpha=run('touchControlFade.alpha');run('updateTouchControlFade();updateTouchControlFade();');
assert.equal(run('touchControlFade.alpha'),sameFrameAlpha,'drawing the same frame cannot advance the fade twice');checks++;
for(let i=0;i<15;i++)tick();
ok('touchControlFade.alpha===0&&bullets.length===0','Sustained aim fully fades the controls');
run('player.ammo=2;');const hiddenReload=start(actionPoint('reload',41));
ok('player.reloadTimer>0&&touchControlFade.alpha===0&&touchAimSelection.pointerId===10',
  'An invisible reload button still works beside the owned aiming finger');
release(hiddenReload.id);release(fadeAim.id);tick();
ok('touchControlFade.alpha>0&&touchControlFade.alpha<1','Stopping aim starts a smooth return');
for(let i=0;i<15;i++)tick();
ok('touchControlFade.alpha===1','Idle controls become fully visible again');
reset();run('player.muzzleFlash=3;frameCount++;updateTouchControlFade();');
ok('touchControlFade.alpha<1','A firing flash fades controls even after the aiming pointer releases');
reset();run('window.isDesktop=true;rightStick.active=true;rightStick.dx=1;rightStick.dy=0;rightStick.dist=0;frameCount++;updateTouchControlFade();');
ok('touchControlFade.alpha===1','An idle desktop aim vector does not count as analog stick travel');

reset();ctx.touches=[{id:92,x:run('width-35'),y:45}];
run('window.lastPauseTime=-10000;touchStarted();');
ok('isPaused&&pauseMenuState===\'MAIN\'&&touchAimSelection.pointerId===null',
  'The native corner-down callback opens pause before any input frame');
ctx.touches=[];run('touchEnded();');
ok('isPaused&&touchAimSelection.pointerId===null','A zero-frame corner down/up tap keeps its pause action');

reset();start(point('HEAD'));run('window.lastPauseTime=-10000;');
start({id:91,x:run('width-35'),y:45});
ok('isPaused&&pauseMenuState===\'MAIN\'&&touchAimSelection.pointerId===null',
  'The unmarked top-right corner opens pause and consumes an aiming gesture');
run('resumeFromPause();handleTouches();');
ok('!isPaused&&!rightStick.active&&touchAimSelection.pointerId===null',
  'A held pause-menu finger cannot resume aiming after closing pause');

console.log(`${checks}/${checks} touch aim ownership, column actions and lifecycle checks passed.`);

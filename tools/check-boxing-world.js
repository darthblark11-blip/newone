// Exercise the public native Character/input/world seams. The shared boxing
// geometry suite covers individual arcs; this checks their campaign adapters.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {ctx, probe} = require('./harness');
let checks = 0, now = 10000, saved = null;
const keys = new Set();
ctx.width = ctx.windowWidth = 390; ctx.height = ctx.windowHeight = 844;
ctx.deltaTime = 16.67; ctx.keyIsDown = code => keys.has(code); ctx.millis = () => now;
ctx.localStorage = {getItem(){return saved;},setItem(k,v){saved = v;},removeItem(){saved = null;}};
function check(code, label){assert.ok(probe(code), label); checks++;}
function tick(n = 1, entities = false){
  for(let i = 0; i < n; i++){
    now += ctx.deltaTime; ctx.frameCount++;
    probe('player.updatePlayer();');
    if(entities) probe('updateEntities();');
  }
}
function fresh(){
  keys.clear(); ctx.touches = []; ctx.mouseIsPressed = false;
  ctx.navigator.getGamepads = () => [];
  probe(`exitFrontierSaloon(); resetFrontierEquipment();
    currentLevel=currentBiome=5; BIOME_ACTIVE=false; authoredCore=null; chunkMgr=null; sealedSector=null;
    buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];barrels=[];enemiesList=[];townCitizens=[];
    bullets=[];particles=[];corpses=[];invalidateColIndex();
    started=true;doTick=true;isStoryMode=false;isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=inDarchonCall=false;
    inWorldBuildingMenu=inOverworldView=inTravelMenu=false;nm0AmbushActive=farmAmbushActive=false;
    ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=false;meleeUnlocked=true;
    swordPickedUp=false;window.pickaxeOwned=false;window.meleeFinisherUnlocked=false;window.milLvl=1;setMeleeTool('NONE');
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
    meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;window.isDesktop=false;window.__frontierConsumedTouches=new Set();
    totalKills=score=0;player=new Character(0,0,true);player.isArmed=true;player.isUnarmed=false;
    player.shield=100;player.hp=100;player.aimAngle=0;
  `);
}
function tap(x,y,id=77){ctx.touches=[{x,y,id}];ctx.mouseX=x;ctx.mouseY=y;probe('touchStarted();');}

fresh();
keys.add(69);probe('handleDesktop();');tick();
check('boxingActive(player)&&!player.isArmed&&player.isUnarmed', 'Native held E enters the unarmed world stance');
check('!player._boxing.punch&&player._boxing.attackCount===0&&player._boxing.preparedPunch.kind==="LEFT_STRAIGHT"', 'Physical entry prepares its held straight without attacking');
tick(32);keys.delete(69);tick();
check('player._boxing.attackCount===1&&player._boxing.punch.level==="BODY"', 'A held entry key throws exactly one body straight on release');
tick(20);
keys.add(82);tick(2);keys.delete(82);tick();
check('player._boxing.punch.kind==="RIGHT_JAB"&&player._boxing.punch.level==="HEAD"', 'A native R tap becomes a head jab');
tick(25);keys.add(81);tick(13);keys.delete(81);tick();
check('player._boxing.punch.kind==="LEFT_HOOK"&&player._boxing.punch.level==="BODY"', 'Holding Q requests a body hook through the native frame reader');
tick(35);keys.add(9);tick();keys.delete(9);
check('!boxingActive(player)&&player.isArmed&&!player.isUnarmed&&!player._boxingEquipment', 'Tab exits and restores the native firearm stance');

fresh();probe('player.activateMelee(true);');tick(190);
check('!boxingActive(player)&&player.isArmed&&!player.isUnarmed&&!player._boxingEquipment', 'Three seconds without a nearby target leave the stance automatically');
check('Number.isFinite(player.x)&&Number.isFinite(player.y)&&player.hp===100&&player.shield===100', 'Idle expiry does not damage the player or corrupt world coordinates');

fresh();keys.add(69);probe('handleDesktop();');tick();
for(let i=0;i<225;i++){probe('handleTouches();handleGamepad();handleDesktop();');tick();}
check('boxingActive(player)&&!player._boxing.punch&&player._boxing.attackCount===0&&player._boxing.preparedPunch.amount===1', 'A long physical entry hold keeps its body preparation without repeated punches');
keys.delete(69);probe('handleTouches();handleDesktop();');tick();
check('player._boxing.punch.level==="BODY"&&player._boxing.attackCount===1', 'Releasing a long entry hold performs one body strike');
tick(220);
check('!boxingActive(player)&&player.isArmed&&player.meleeTimer===0', 'The released entry stance expires safely after inactivity');
keys.add(69);probe('handleDesktop();');tick();keys.clear();
check('boxingActive(player)&&player._boxing.attackCount===0&&!player._boxing.punch', 'A fresh entry press after expiry prepares a deliberate new strike');
tick();
check('player._boxing.attackCount===1&&player._boxing.punch.level==="HEAD"', 'Releasing the fresh entry tap throws a head strike');

fresh();probe(`var civilian=new Character(40.5,0,false,'FARMER_MALE');civilian.hp=100;
  var townWitness=new Character(100,0,false,'COWBOY');townWitness.isNeutral=true;townWitness.isFriendly=true;
  enemiesList=[civilian,townWitness];player.activateMelee(true);`);tick(20);
check('civilian.stunTimer===240&&civilian.state==="STUNNED"&&civilian.stunPose&&civilian.hp===100&&!civilian.dead', 'A real fist contact produces the existing harmless civilian knockdown');
check('totalKills===0&&score===0&&townWitness.isNeutral&&townWitness.isFriendly', 'Civilian fists neither grant kills nor awaken the neutral town');
check('worldBoxingTargets().every(e=>e!==civilian)', 'A downed civilian leaves the target lock until standing again');

fresh();probe(`var hostile=new Character(40.5,0,false,'NORMAL');hostile.hp=130;hostile.isFriendly=hostile.isNeutral=false;
 enemiesList=[hostile];player.activateMelee(true);`);
for(let i=1;i<=4;i++){
  tick(30);
  if(i<4){check(`hostile.punchHitCount===${i}&&hostile.stunTimer===0&&hostile.hp===130`, 'Hostile fist '+i+' preserves health until the fourth-hit stun');probe('player.activateMelee(true);');}
}
check('hostile.stunTimer===1500&&hostile.hp===130&&!hostile.dead&&hostile.punchHitCount===0', 'The fourth native fist contact retains the established hostile stun');
check('totalKills===0&&score===0', 'A hostile fist knockdown does not become lethal campaign credit');

fresh();probe(`var close=new Character(90,0,false,'NORMAL'),far=new Character(160,0,false,'NORMAL');
 var ally=new Character(15,0,false,'NORMAL');ally.isFriendly=true;ally.isNeutral=false;
 var down=new Character(10,0,false,'NORMAL');down.stunTimer=60;
 enemiesList=[far,ally,down,close];player.activateMelee(true);`);
check('player._boxing.target===close', 'Native target selection ignores allies and downed bodies and locks the nearest opponent');
check('player._boxing.punch.aimAngle===0', 'Entry locks the actual committed punch direction');

fresh();probe(`var boxingEvents=[];var originalWorldBoxingHit=worldBoxingHit;
 worldBoxingHit=function(e){boxingEvents.push({attacker:e.attacker,defender:e.defender,outcome:e.outcome,damage:e.damage});return originalWorldBoxingHit(e);};
 player.shield=2000;enemiesList=[0,1,2].map((i)=>{var a=i*Math.PI*2/3;
   var e=new Character(Math.cos(a)*40.5,Math.sin(a)*40.5,false,'NORMAL');
   e.isUnarmed=true;e.isArmed=false;e.isFriendly=e.isNeutral=false;e.state='CHASE';return e;});
 player.activateMelee(true);`);
tick(1,true);
check('enemiesList.every(e=>e._boxingWorldManaged&&boxingActive(e))', 'The native entity tick enrolls nearby hostile unarmed actors in the shared director');
check('bullets.length===0&&enemiesList.every(e=>e.ammo===e.currentWeapon.maxAmmo)', 'Managed unarmed opponents never execute a second native gunfire branch');
let peak=0; const participants=new Set();
for(let i=0;i<360;i++){
  tick(1,true);peak=Math.max(peak,probe('enemiesList.filter(e=>e._boxing&&e._boxing.punch).length'));
  for(const id of probe('enemiesList.map((e,i)=>e._boxing&&e._boxing.punch?i:-1).filter(i=>i>=0)'))participants.add(id);
}
assert.equal(peak,1,'Three real world opponents hold one staggered attack lease');checks++;
assert.equal(participants.size,3,'Every real world opponent gets a turn');checks++;
check('boxingEvents.some(e=>e.defender===player&&e.outcome==="HIT")&&player.shield<2000&&player.hp===100', 'World punches pass through the native shield damage system');
check('bullets.length===0&&enemiesList.every(e=>e.ammo===e.currentWeapon.maxAmmo)', 'A full multi-opponent fight cannot leak native firearm shots');
probe(`player.shield=5;worldBoxingHit({attacker:enemiesList[0],defender:player,outcome:'HIT',damage:17,point:{x:player.x,y:player.y}});`);
check('player.shield===0&&player.hp===88&&player.shieldBurstTimer>0', 'A punch breaking the shield carries only its remaining damage into native HP');
probe('worldBoxingHit=originalWorldBoxingHit;boxingExit(player);finishWorldBoxing(player);updateWorldBoxingOpponents();');
check('enemiesList.every(e=>!e._boxingWorldManaged&&!boxingActive(e))', 'Leaving world boxing releases managed opponents back to native AI');

fresh();probe(`player.shield=2000;enemiesList=[0,1,2,3].map(i=>{
 var a=i*Math.PI/2,e=new Character(Math.cos(a)*40.5,Math.sin(a)*40.5,false,'NORMAL');
 e.isUnarmed=true;e.isArmed=false;e.isFriendly=e.isNeutral=false;e.state='CHASE';return e;});player.activateMelee(true);`);
let fourPeak=0; const fourParticipants=new Set(),leases=[]; let previous=new Set();
for(let i=0;i<400;i++){
  tick(1,true);
  const active=probe('enemiesList.map((e,i)=>e._boxing&&e._boxing.punch?i:-1).filter(i=>i>=0)');
  fourPeak=Math.max(fourPeak,active.length);
  for(const id of active){fourParticipants.add(id);if(!previous.has(id))leases.push({id,frame:i});}
  previous=new Set(active);
}
assert.equal(fourPeak,2,'Four real world opponents can hold two staggered attack leases');checks++;
assert.equal(fourParticipants.size,4,'Every member of the four-opponent world fight gets a turn');checks++;
const minimumWorldAttackGap=probe('BOXING.ENEMY_ATTACK_GAP_MS')-ctx.deltaTime;
assert(leases.every((s,i)=>i===0||(s.frame-leases[i-1].frame)*ctx.deltaTime>=minimumWorldAttackGap),'World attack starts retain their intentional minimum gap');checks++;
check('enemiesList.every(e=>Math.hypot(e.x-player.x,e.y-player.y)>30)&&bullets.length===0', 'Four hostile fighters remain separate and do not leak native firearm shots');

fresh();probe(`var armed=new Character(40.5,0,false,'NORMAL');armed.isArmed=true;armed.isUnarmed=false;
 enemiesList=[armed];player.activateMelee(true);updateWorldBoxingOpponents();`);
check('!armed._boxingWorldManaged&&!boxingActive(armed)', 'Armed enemy AI is not adopted by the fistfight director');

fresh();probe(`revolverUnlocked=true;player.currentWeapon=WEAPONS.REVOLVER;player.weaponAmmo.REVOLVER=4;player.mags.REVOLVER=2;
 player.activateMelee(true);var ammoBefore=player.ammo,reserveBefore=player.mags.REVOLVER;player.fire(0);player.triggerReload();player.activateDash();`);
check('bullets.length===0&&player.ammo===ammoBefore&&player.mags.REVOLVER===reserveBefore&&player.reloadTimer===0&&player.dashTimer===0', 'Direct native fire/reload/dash methods cannot spend bullets or dash underneath boxing');
probe('player.reloadTimer=2;player.weaponAmmo.REVOLVER=0;');tick(2);
check('player.reloadTimer===0&&player.ammo===6&&player.mags.REVOLVER===2', 'A reload already running completes once during the world stance');
probe('player._boxing.punch=null;');keys.add(9);tick();keys.clear();
check('player.currentWeapon===WEAPONS.REVOLVER&&player.ammo===6&&player.mags.REVOLVER===2', 'Explicit exit preserves the exact current weapon and finite reserves');
probe('player.fire(0);');
check('bullets.length===1&&player.ammo===5', 'Native firearm use resumes after the explicit exit');

// An earned analog bow pull is transient. Entering fists must cancel it before
// the boxing reader turns that same stick into guard input or suppresses it.
fresh();probe('player.flags=player.flags||{};player.flags.bowUnlocked=true;player.currentWeapon=WEAPONS.BOW;player.weaponAmmo.BOW=7;');
const bowPad={connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false}))};
ctx.navigator.getGamepads=()=>[bowPad];probe('handleGamepad();');tick();
for(let i=1;i<=54;i++){bowPad.axes[2]=-.92*i/54;probe('handleGamepad();');tick();}
check('player.bowDrawState.phase==="DRAW"&&player.bowDrawState.power>.99&&player.ammo===7&&bullets.length===0', 'A real native gamepad gesture earns a charged bow before entering fists');
keys.add(69);probe('handleDesktop();');tick();keys.clear();
check('boxingActive(player)&&!playerBowCanDraw(player)&&player.bowDrawState.tension===0&&player.bowDrawState.power===0', 'Native fist entry cancels the earned bow pull and disables draw eligibility');
tick(20);keys.add(9);tick();keys.clear();bowPad.axes[2]=0;
for(let i=0;i<20;i++){probe('handleTouches();handleGamepad();handleDesktop();');tick();}
check('!boxingActive(player)&&player.currentWeapon===WEAPONS.BOW&&player.ammo===7&&bullets.length===0', 'Releasing the old bow stick after leaving fists cannot spawn an arrow or spend ammunition');
probe('window.isDesktop=false;');
for(let i=1;i<=54;i++){bowPad.axes[2]=-.92*i/54;probe('handleGamepad();');tick();}
bowPad.axes[2]=0;probe('handleGamepad();');tick();
check('bullets.length===1&&bullets[0].isArrow&&bullets[0].arrowPower>.99&&player.ammo===6', 'A deliberate fresh bow draw still fires normally after returning from fists');
ctx.navigator.getGamepads=()=>[];

fresh();probe(`swordPickedUp=true;setMeleeTool('SWORD');player.activateMelee(true);`);
check('!boxingActive(player)&&player.meleeTimer===20&&meleeTool()==="SWORD"', 'An equipped sword retains its existing armed melee path');
fresh();probe(`window.pickaxeOwned=true;setMeleeTool('PICKAXE');player.activateMelee(true);`);
check('!boxingActive(player)&&player.meleeTimer===20&&meleeTool()==="PICKAXE"', 'A pickaxe retains its existing harvesting melee path');
fresh();probe('chemistSuitUnlocked=true;meleeInputHeld=true;');tick();
check('!boxingActive(player)&&isCooking&&pFlaskAmmo>0', 'Native chemist flask input keeps priority over fists');
fresh();probe('player.activateMelee(true);swordPickedUp=true;setMeleeTool("SWORD");');tick();
check('!boxingActive(player)&&player.isArmed&&meleeTool()==="SWORD"&&!player._boxingEquipment', 'Equipping a world tool exits fists and restores equipment flags');

fresh();probe(`buildings=activeBuildings=[{x:45,y:0,w:20,h:160,hp:100}];invalidateColIndex();player.activateMelee(true);`);
keys.add(68);tick(12);keys.clear();
check('player.x<=20&&!player.checkCol(player.x,player.y)&&Number.isFinite(player.x)', 'Native boxing footwork uses the real world building collision footprint');

fresh();probe('revolverUnlocked=true;player.currentWeapon=WEAPONS.REVOLVER;player.weaponAmmo.REVOLVER=4;player.mags.REVOLVER=2;player.activateMelee(true);player._boxing.punch=null;');
const layout=probe('boxingControlLayout()');
tap(layout.rightStick.x,layout.rightStick.y-35,31);tick();
check('player._boxing.guardSector==="N"&&!rightStick.active&&rightStick.dist===0', 'Native mobile guard touch never becomes gun aim or firing');
ctx.touches=[{id:31,x:layout.buttons[0].x,y:layout.buttons[0].y}];tick(14);
check('!player._boxing.punch', 'A captured guard finger cannot become a punch by sliding across its button');
ctx.touches=[];tick();
tap(layout.buttons[1].x,layout.buttons[1].y,32);tick(2);ctx.touches=[];tick();
check('player._boxing.punch.kind==="RIGHT_HOOK"&&player._boxing.punch.level==="HEAD"', 'Native mobile punch taps request shared head contact');
tap(layout.rightStick.x,layout.rightStick.y,33);tick();tap(layout.exitButton.x,layout.exitButton.y,33);
check('!boxingActive(player)&&window.__frontierConsumedTouches.has(33)', 'Explicit touch exit consumes its held finger');
probe('handleTouches();');
check('!rightStick.active&&!leftStick.active&&!meleeInputHeld&&!cannonInputHeld', 'The exit finger does not turn into native weapon or suit input');
ctx.touches=[];probe('handleTouches();');
check('!window.__frontierConsumedTouches.has(33)', 'Lifting the exit finger releases its consumed touch ID');
tick();
check('player.isArmed&&!player.isUnarmed&&player.currentWeapon===WEAPONS.REVOLVER&&player.weaponAmmo.REVOLVER===4&&player.mags.REVOLVER===2', 'The visible weapon exit restores the armed revolver without changing finite ammunition');

// Re-register only the existing native DOM listener block in this VM. This
// observes production event guards without substituting their implementation.
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'..','game.js'),'utf8');
const listeners=new Map(),oldListener=ctx.addEventListener;
ctx.addEventListener=(type,fn)=>listeners.set(type,fn);
probe(source.slice(source.indexOf('// --- NATIVE PC CONTROLS LISTENERS ---'),source.indexOf('// Both of these are now thin wrappers over the ledger')));
ctx.addEventListener=oldListener;
fresh();probe('player.activateMelee(true);player.weaponAmmo.PISTOL=3;');
let prevented=0;
for(const key of ['r','q',' ','v','Tab','ArrowUp'])listeners.get('keydown')({key,code:key===' '?'Space':'Key'+key.toUpperCase(),preventDefault(){prevented++;}});
listeners.get('mousedown')({button:2});
check('player.reloadTimer===0&&player.dashTimer===0&&!cannonInputHeld&&player.currentWeapon===WEAPONS.PISTOL&&player.ammo===3', 'Native DOM shortcuts cannot reload, charge, swap or dash through the boxing layer');
assert.equal(prevented,6,'Owned DOM shortcuts suppress their browser defaults');checks++;

// Real terrain entry catches NaN pace from missing slope velocity arguments.
for(const level of [1,3]){
  fresh();probe(`resetStoryProgress();isStoryMode=false;startAtLevel(${level});
   started=true;isPaused=isDead=isWin=killcamMode=false;inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=inDarchonCall=inStoryIntro=false;
   meleeUnlocked=true;setMeleeTool('NONE');enemiesList=[];
   player.x=${level===3?1156:1300};player.y=${level===3?-1730:0};player.activateMelee(true);`);
  tick();check('Number.isFinite(player.x)&&Number.isFinite(player.y)&&boxingActive(player)', 'Level '+level+' relief preserves finite stationary native boxing coordinates');
  keys.add(68);tick(5);keys.clear();
  check('Number.isFinite(player.x)&&Number.isFinite(player.y)&&Number.isFinite(player.gait)', 'Level '+level+' native boxing footwork keeps finite terrain and animation state');
}
probe('revolverUnlocked=true;player.currentWeapon=WEAPONS.REVOLVER;player.weaponAmmo.REVOLVER=4;player.mags.REVOLVER=2;saveGame();');
const snapshot=JSON.parse(saved);
assert.equal(snapshot.frontierEquipment.revolverAmmo,4);assert.equal(snapshot.frontierEquipment.revolverReserve,2);checks+=2;
assert.equal(snapshot.frontierWeapon,'REVOLVER');assert(Number.isFinite(snapshot.playerX)&&Number.isFinite(snapshot.playerY));checks+=2;
probe('loadGame();');
check('!boxingActive(player)&&player.currentWeapon===WEAPONS.REVOLVER&&player.ammo===4&&player.mags.REVOLVER===2', 'Saving inside world fists resumes outdoors with exact finite weapon ammunition');

function townStance(point){
  fresh();probe(`resetStoryProgress();isStoryMode=false;startAtLevel(3);
   started=true;isPaused=isDead=isWin=killcamMode=false;inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=inDarchonCall=inStoryIntro=false;
   meleeUnlocked=true;setMeleeTool('NONE');enemiesList=[];${point}
   player.isArmed=true;player.isUnarmed=false;player.currentWeapon=WEAPONS.REVOLVER;
   player.weaponAmmo.REVOLVER=4;player.mags.REVOLVER=2;player.activateMelee(true);`);
}
townStance('player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;');
keys.add(70);probe('handleDesktop();');tick();
check('frontierSaloonIsInside()&&!boxingActive(player)&&_frontierSaloonSession.save.isArmed&&!_frontierSaloonSession.save.isUnarmed', 'Native F enters the saloon from fists after restoring exterior equipment flags');
check('player.x===FRONTIER_SALOON_ROOM.entry.x&&player.y===FRONTIER_SALOON_ROOM.entry.y&&Number.isFinite(player.x)&&!player.isArmed&&player.isUnarmed&&player.weaponAmmo.REVOLVER===4&&player.mags.REVOLVER===2', 'The interaction frame cannot move room-local coordinates through the world solver, draw a gun indoors or alter weapon reserves');
probe('updateFrontierSaloonActivity();');
check('frontierSaloonIsInside()&&player.y===FRONTIER_SALOON_ROOM.entry.y', 'The held interaction key cannot immediately exit the newly entered saloon');
keys.clear();probe('exitFrontierSaloon();');
check('player.isArmed&&!player.isUnarmed&&player.currentWeapon===WEAPONS.REVOLVER&&player.x===1156&&player.y===-1730', 'Leaving the saloon restores the firearm state that preceded world fists');

townStance('player.x=frontierBountyBoard().x-40;player.y=frontierBountyBoard().y;');
const pad={connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false}))};
pad.buttons[0].pressed=true;ctx.navigator.getGamepads=()=>[pad];probe('handleGamepad();');tick();
check('boxingActive(player)&&!frontierBounties.activeId&&player._boxing.dodge.kind==="BACK"', 'Native gamepad A leans back without accepting a sheriff poster in the stance');
pad.buttons[0].pressed=false;pad.buttons[12].pressed=true;tick();
check('!boxingActive(player)&&player.isArmed', 'D-pad up restores the firearm before world interactions');
pad.buttons[12].pressed=false;probe('handleGamepad();');pad.buttons[0].pressed=true;probe('handleGamepad();');
check('frontierBounties.activeId===FRONTIER_BOUNTY_DEFS[0].id&&player.isArmed', 'A fresh gamepad A accepts the sheriff poster after leaving the stance');
pad.buttons[0].pressed=false;ctx.navigator.getGamepads=()=>[];

townStance('player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;');
tap(ctx.width/2,ctx.height-100,97);
check('frontierSaloonIsInside()&&!boxingActive(player)&&_frontierSaloonSession.save.isArmed', 'The visible saloon touch prompt remains functional while the player is boxing');
ctx.touches=[];probe('exitFrontierSaloon();');
console.log('Boxing world: '+checks+' native input, combat, equipment, terrain and save checks passed.');

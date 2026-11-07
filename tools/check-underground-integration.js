// Native HQ interaction, one-way travel, encounter lifecycle and complete
// campaign persistence. Surface routes must not leak into this authored zone.
const assert=require('assert/strict');
const {ctx,probe:P}=require('./harness');
let checks=0,seed=91722,pad=null;
const keys=new Set(),storage=new Map(),pending=[];
ctx.keyIsDown=code=>keys.has(code);
ctx.navigator.getGamepads=()=>pad?[pad]:[];
ctx.setTimeout=fn=>{pending.push(fn);return pending.length;};
ctx.localStorage={getItem:k=>storage.has(k)?storage.get(k):null,
 setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;
 if(a===undefined)return r;if(Array.isArray(a))return a[(r*a.length)|0];return b===undefined?r*a:a+r*(b-a);};
function ok(code,label){assert.ok(P(code),label);checks++;}
function connect(pressed=[]){const down=new Set(pressed);pad={index:0,connected:true,id:'underground-test',axes:[0,0,0,0],
 buttons:Array.from({length:17},(_,i)=>({pressed:down.has(i),value:down.has(i)?1:0}))};}
function freshHQ(){keys.clear();pad=null;ctx.touches=[];
 P(`resetRunState();isStoryMode=true;startAtLevel(8);started=doTick=true;
 isDead=isWin=isPaused=killcamMode=false;inStoryIntro=inStoryRoom=inDarchonCall=false;
 inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=false;
 inWorldBuildingMenu=inOverworldView=inTravelMenu=false;
 leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
 player.x=HQ_ELEVATOR.x;player.y=HQ_ELEVATOR.y;
 window.inNM0SecretOverlay=false;`);pending.length=0;}
function advance(ms){for(let left=ms;left>0;){const dt=Math.min(100,left);P(`frameCount++;updateUndergroundRoute(${dt});`);left-=dt;}}
function tap(x,y){ctx.mouseX=x;ctx.mouseY=y;ctx.touches=[{id:99,x,y}];P('touchStarted();');ctx.touches=[];}
function tapChoice(yes){const b=P(`undergroundConfirmationButtons().find(b=>b.yes===${yes})`);tap(b.x+b.w/2,b.y+b.h/2);}

freshHQ();
ok('enemiesList.length===20&&enemiesList.every(e=>e.eType==="ARMORED_STANDARD")','The HQ still owns exactly twenty armored guards');
ok('!BIOME_ACTIVE&&chunkMgr===null','The HQ remains authored without an outdoor streamer');
ok('hqElevatorAvailable()','The northern central threshold exposes the descent interaction');
const prompt=P('({x:width/2,y:height-95})');tap(prompt.x,prompt.y);
ok("undergroundRoute.mode==='CONFIRM'&&undergroundRouteBusy()",'The actual touch prompt opens the Yes/No confirmation');
ok('!leftStick.active&&!rightStick.active&&!doTick','The confirmation pauses movement and combat inputs');
tapChoice(false);
ok('currentLevel===8&&!undergroundRoute.mode&&!undergroundRouteBusy()','No dismisses the prompt and keeps the player inside HQ');
for(const [w,h]of[[390,844],[844,390],[320,568]]){ctx.width=w;ctx.height=h;
 ok('undergroundConfirmationButtons().every(b=>b.x>=8&&b.y>=8&&b.x+b.w<=width-8&&b.y+b.h<=height-8)',
  'Both elevator choices fit '+w+'×'+h);}
ctx.width=390;ctx.height=844;
P('player.x=-720;');
ok('!hqElevatorAvailable()&&!openHQElevator()','The unopened west branch cannot activate the central elevator');
P('player.x=720;');
ok('!hqElevatorAvailable()&&!openHQElevator()','The unopened east branch cannot activate the central elevator');
P('player.x=0;updateUndergroundRoute(16);');keys.add(70);P('updateUndergroundRoute(16);');
ok("undergroundRoute.mode==='CONFIRM'",'A fresh keyboard F opens the native elevator interaction');
P('updateUndergroundRoute(16);');
ok("undergroundRoute.mode==='CONFIRM'",'Holding the opening key cannot also choose Yes');
keys.delete(70);P('updateUndergroundRoute(16);');keys.add(27);P('updateUndergroundRoute(16);');
ok('currentLevel===8&&!undergroundRoute.mode','Escape selects No without starting a descent');keys.clear();P('updateUndergroundRoute(16);');
connect();P('updateUndergroundRoute(16);');pad.buttons[0].pressed=true;P('updateUndergroundRoute(16);');
ok("undergroundRoute.mode==='CONFIRM'",'A fresh gamepad A opens the native elevator prompt');
P('updateUndergroundRoute(16);');
ok("undergroundRoute.mode==='CONFIRM'",'Holding gamepad A cannot skip the Yes/No decision');
pad.buttons[0].pressed=false;P('updateUndergroundRoute(16);');pad.buttons[1].pressed=true;P('updateUndergroundRoute(16);');
ok('!undergroundRoute.mode&&currentLevel===8','Gamepad B cancels the one-way descent');
pad=null;P('updateUndergroundRoute(16);openHQElevator();');
P(`forestHuntingGrantBow();smgUnlocked=true;player.currentWeapon=WEAPONS.SMG;player.weaponAmmo[WEAPONS.SMG.name]=11;
 player.mags[WEAPONS.SMG.name]=2;player.hp=73;player.shield=46;score=137;`);
tapChoice(true);
ok("undergroundRoute.mode==='DESCEND'&&currentLevel===8",'Touch Yes begins a bounded descent before the world changes');
advance(700);P('var midwayRouteMs=undergroundRoute.elapsedMs;isPaused=true;');advance(400);
ok('undergroundRoute.elapsedMs===midwayRouteMs&&currentLevel===8','Paused gameplay cannot advance the elevator');
P('isPaused=false;saveGame();');
const midway=JSON.parse(storage.get('urbanTwinStickSave'));
assert.equal(midway.undergroundRoute.mode,'DESCEND');checks++;
P('undergroundRoute.mode=null;undergroundRoute.elapsedMs=0;loadGame();');
ok("currentLevel===8&&undergroundRoute.mode==='DESCEND'&&undergroundRoute.elapsedMs===700",'Native save/load resumes the current descent stage');
P('player.currentWeapon=WEAPONS.SMG;player.weaponAmmo[WEAPONS.SMG.name]=11;player.mags[WEAPONS.SMG.name]=2;');
advance(1000);
ok("currentLevel===8&&undergroundRoute.mode==='DESCEND'",'The 1800 ms descent does not load the next world early');
advance(100);
ok('currentLevel===9&&currentBiome===9&&!BIOME_ACTIVE&&chunkMgr===null','The descent enters authored underground Level9');
ok('player.hp===73&&player.shield===46&&score===137&&smgUnlocked','Descending retains health, shield, score and campaign upgrades');
ok('player.currentWeapon===WEAPONS.SMG&&player.weaponAmmo[WEAPONS.SMG.name]===11&&player.mags[WEAPONS.SMG.name]===2&&player.flags.bowUnlocked',
 'The elevator carries selected equipment, ammunition and bow ownership');
ok('player.x===0&&player.y===1100&&undergroundPointWalkable(player.x,player.y,15)','The player arrives safely inside the elevator alcove');
ok('undergroundDoorOpenAmount()===0&&undergroundRouteBusy()','Level9 starts with closed doors before opening them');
advance(450);
ok('undergroundDoorOpenAmount()===.5&&undergroundRouteBusy()','The arrival door opens progressively');
P('isPaused=true;var pausedDoor=undergroundDoorOpenAmount();');advance(400);
ok('undergroundDoorOpenAmount()===pausedDoor','Pausing freezes the arrival door animation');
P('isPaused=false;');advance(450);
ok('undergroundDoorOpenAmount()===1&&!undergroundRouteBusy()','The 900 ms opening releases movement into the tunnel');
ok('enemiesList.length===54&&enemiesList.every(isOccultMagician)','The four authored rooms hold their finite 54-magician roster');
ok("enemiesList.filter(e=>e.occult.room==='chamber').length===12",'The opening chamber contains twelve magicians');
ok('!barrels.length&&!parkingCars.length&&!nm0Scientists.length&&!townCitizens.length','Outdoor clutter and lab civilians do not enter the chamber');
P(`var caveRosterBefore=enemiesList.length;for(let i=0;i<40;i++){frameCount=(Math.floor(frameCount/45)+1)*45;
 maintainHostiles();spawnSingleEnemy();spawnSingleEnemy(true);}`);
for(const fn of pending.splice(0))fn();
ok('enemiesList.length===caveRosterBefore&&enemiesList.every(isOccultMagician)','Ambient ticks and delayed surface callbacks cannot add unrelated enemies');
P('player.ignoreBldgTimer=20;');
ok('player.checkCol(1000,1100)&&player.checkCol(0,1500)&&!player.checkCol(0,700)',
 'A dash collision bypass cannot leave the authored tunnel footprint');
P('player.ignoreBldgTimer=0;');

// The room doors are ordinary interaction targets, with the same physical
// threshold before and after save/load, rather than decorative painted doors.
ok("!openUndergroundGate('nave')&&!undergroundRoomAccessible('nave')",'A distant player cannot open the next chamber remotely');
P('player.x=0;player.y=-1780;activeBuildings=buildings;invalidateColIndex();');
ok("undergroundNearbyGate().id==='nave'&&player.checkCol(0,-1900)", 'The north chamber door is reachable and physically closed');
ok('!hasLOS(0,-1800,0,-2000)&&!occultClearSegment(0,-1800,0,-2000,1)', 'A closed ritual door blocks native and magical sight');
P('player.ignoreBldgTimer=20;');
ok('player.checkCol(0,-1900)', 'A dash cannot pass through an unopened ritual door');
P('player.ignoreBldgTimer=0;');
tap(ctx.width/2,ctx.height-95);
ok("undergroundDungeon.opening.id==='nave'&&undergroundGateAmount('nave')===0",'The native touch prompt starts the north door opening');
advance(300);
ok("undergroundGateAmount('nave')>0&&undergroundGateAmount('nave')<1&&player.checkCol(0,-1900)",'The door parts visibly while its threshold stays solid');
P('isPaused=true;');advance(400);
ok("undergroundDungeon.opening.elapsedMs===300",'Pause freezes the ritual door animation');
P('isPaused=false;saveGame();loadGame();');
ok("undergroundDungeon.opening.id==='nave'&&undergroundDungeon.opening.elapsedMs===300",'Loading resumes a partly opened door');
advance(350);
ok("undergroundGateAmount('nave')===1&&undergroundRoomAccessible('nave')&&!player.checkCol(0,-1900)", 'A fully parted door releases the north passage');
ok("!buildings.some(b=>b.undergroundGate==='nave')&&!activeBuildings.some(b=>b.undergroundGate==='nave')&&hasLOS(0,-1800,0,-2000)&&occultClearSegment(0,-1800,0,-2000,1)", 'Opening immediately clears collision and both sight paths');
P('player.x=0;player.y=-1900;saveGame();loadGame();');
ok("player.x===0&&player.y===-1900&&undergroundGateAmount('nave')===1", 'Loading a save on an opened doorway keeps the player at that doorway');
P("player.aimAngle=-Math.PI/2;resetActorStance(player,'PRONE');saveGame();loadGame();");
ok("actorStance(player)==='PRONE'&&stanceProneSpotClear(player)&&player.x===0&&player.y===-1900", 'A prone doorway save checks body clearance after restoring the opened door');
P('player.x=475;player.y=-3330;updateUndergroundRoute(16);');keys.add(70);P('updateUndergroundRoute(16);');keys.clear();
ok("undergroundDungeon.opening.id==='transept'", 'Keyboard F opens the offset north door');advance(650);
P('player.x=850;player.y=-4880;');connect();P('updateUndergroundRoute(16);');
P('boxingEnter(player);');pad.buttons[0].pressed=true;P('updateUndergroundRoute(16);');
ok("!undergroundDungeon.opening&&!undergroundRoomAccessible('sanctuary')", 'Boxing stance retains ownership of gamepad A at a doorway');
P('player._boxing.active=false;');pad.buttons[0].pressed=false;P('updateUndergroundRoute(16);');pad.buttons[0].pressed=true;P('updateUndergroundRoute(16);');
ok("undergroundDungeon.opening.id==='sanctuary'", 'A fresh gamepad A opens the final connected ritual door');advance(650);pad=null;
P('player.x=0;player.y=-5700;saveGame();loadGame();');
ok("undergroundCurrentRoom()==='sanctuary'&&undergroundDungeon.opened.length===3&&enemiesList.length===54", 'Native save/load retains the expanded roster and all three opened doors deep in the dungeon');

// The saved encounter keeps wounded and dead casters separate from a fresh
// seeded visit; the native load path must restore the snapshot after its map.
P(`player.x=0;player.y=-600;player.hp=61;player.shield=32;score=244;
 var woundedCaster=enemiesList.find(e=>e.eType==='OCCULT_BLACK');woundedCaster.hp=67;
 var woundedCasterId=woundedCaster.occult.id;
 var defeatedCasterId=enemiesList.find(e=>e.eType==='OCCULT_RED').occult.id;
 enemiesList=enemiesList.filter(e=>!(e.occult&&e.occult.id===defeatedCasterId));saveGame();`);
const caveSave=storage.get('urbanTwinStickSave');
P('player.hp=0;player.dead=true;isDead=true;');
ok("activateDeathMenuAction('LOAD')===true",'The death-screen preflight accepts a Level9 save');
ok('currentLevel===9&&!isDead&&player.hp===61&&player.shield===32&&score===244&&player.x===0&&player.y===-600',
 'Death Load restores the underground player through the complete campaign pipeline');
ok('enemiesList.some(e=>e.occult&&e.occult.id===woundedCasterId&&e.hp===67)&&!enemiesList.some(e=>e.occult&&e.occult.id===defeatedCasterId)',
 'Wounded casters retain health and defeated casters do not respawn on load');
ok('undergroundDoorOpenAmount()===1&&!undergroundRouteBusy()','A completed arrival does not replay its locked door sequence after loading');
ok('Math.abs(camX+width/(2*zoom)-player.x)<.01&&Math.abs(camY+height/(2*zoom)-player.y)<.01&&window.currentPan===0','A restored chamber is visible immediately, centered on its saved player');
assert.equal(storage.get('urbanTwinStickSave'),caveSave,'Loading preserves the saved checkpoint bytes');checks++;

// The expanded altar occupies formerly walkable floor. A real pre-expansion
// checkpoint must rescue blocked people rather than trap or discard them.
const oldCave=JSON.parse(caveSave);
delete oldCave.occult.dungeonRevision;delete oldCave.undergroundRoute.dungeon;
oldCave.playerX=-350;oldCave.playerY=-1790;
oldCave.occult.actors=oldCave.occult.actors.filter(a=>a.occult&&['tunnel-red','chamber-black','chamber-red','chamber-blue'].includes(a.occult.id));
const oldBlack=oldCave.occult.actors.find(a=>a.occult.id==='chamber-black');
oldBlack.x=-400;oldBlack.y=-1790;oldBlack.hp=155;
storage.set('urbanTwinStickSave',JSON.stringify(oldCave));P('loadGame();');
ok('!player.checkCol(player.x,player.y)&&Math.hypot(player.x+350,player.y+1790)<=240',
 'An older checkpoint blocked by new altar geometry loads the player onto nearby clear floor');
ok("enemiesList.some(e=>e.occult&&e.occult.id==='chamber-black'&&e.hp===155&&occultPointClear(e.x,e.y,14)&&Math.hypot(e.x+400,e.y+1790)<=240)",
 'A surviving old caster inside new furniture retains its identity and wounds on nearby clear floor');
storage.set('urbanTwinStickSave',caveSave);P('loadGame();');
P(`isStoryMode=false;totalKills=MAX_KILLS;var killFixture=enemiesList.find(isOccultMagician);
 killFixture.hp=0;doTick=false;updateEntities();`);
for(const fn of pending.splice(0))fn();
ok('!isWin&&!killcamMode&&currentLevel===9','An arcade kill threshold cannot end the incremental dungeon or send it toward Level10');
ok('enemiesList.every(isOccultMagician)','Native kill replacement callbacks cannot introduce surface enemies');
P('resetToMainMenu();');
ok('!started&&!isDead&&!isWin&&!undergroundRoute.visited&&!undergroundRoute.mode&&undergroundRoute.arrivalMs===900',
 'Reset leaves no old descent or door state in a replacement run');
ok('!occultProjectiles.length&&!occultGroundEffects.length&&!undergroundFloorCache.size','Run replacement clears spell hazards and dungeon floor buffers');
assert.equal(storage.get('urbanTwinStickSave'),caveSave,'Reset keeps the saved underground campaign available');checks++;
console.log('Underground integration: '+checks+' native HQ input, descent, encounter, save and reset checks passed.');

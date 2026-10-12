// Follow the public level, input, kill, store and persistence seams. Room
// opponents and contract progress stay separate from the campaign counters.
const assert=require('assert');
const {ctx,probe}=require('./harness');
let checks=0,now=5000,slot=null;
ctx.millis=()=>now;
ctx.localStorage={getItem(){return slot;},setItem(k,v){slot=v;},removeItem(){slot=null;}};
ctx.width=390;ctx.height=844;ctx.windowWidth=390;ctx.windowHeight=844;
const keys=new Set();ctx.keyIsDown=k=>keys.has(k);
const run=code=>probe(code);
function check(code,message){assert.ok(run(code),message);checks++;}
function play(){run(`isPaused=isDead=isWin=killcamMode=false;inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inWorldBuildingMenu=inOverworldView=inTravelMenu=inStoryIntro=inDarchonCall=false;doTick=true;window.isDesktop=false;`);}
function place(code){run(code);run(`viewLeft=player.x-600;viewRight=player.x+600;viewTop=player.y-700;viewBottom=player.y+700;
 lastActiveUpdate=-100;chunkMgr.lastKey=null;chunkMgr.update(player.x,player.y);chunkMgr.warmUp(30);chunkMgr.rebuildWorldArrays();updateActiveWorld();`);}
function tap(x,y,id=91){ctx.mouseX=x;ctx.mouseY=y;ctx.touches=[{x,y,id}];run('touchStarted();');}
function release(){ctx.touches=[];run('handleTouches();');}
function roomTick(n=1){for(let i=0;i<n;i++){now+=16.67;ctx.deltaTime=16.67;run('updateFrontierSaloonActivity();');}}
function roomTap(action){const b=run(`frontierSaloonButtons().find(b=>b.action===${JSON.stringify(action)})`);assert.ok(b,'Visible room action '+action);tap(b.x+b.w/2,b.y+b.h/2);release();}
function keyF(){keys.add(70);run('handleDesktop();');keys.delete(70);run('handleDesktop();');run('window.isDesktop=false;rightStick.active=false;');}
function shopTap(id){const point=run(`(()=>{const a=upgradeShopItems(),i=a.findIndex(x=>x.id===${JSON.stringify(id)}),L=upgradeShopLayout(a.length);
 return {x:L.startX+i%L.cols*L.spacingX,y:L.startY+Math.floor(i/L.cols)*L.spacingY};})()`);tap(point.x,point.y);release();}
run('leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};isStoryMode=false;resetStoryProgress();startAtLevel(3);');play();
check('authoredCore && buildings.filter(b=>b.isWesternBldg).length>=60','Arcade entry retains the expanded permanent western town');
place('player.x=frontierTownLandmarks().saloon.door.x;player.y=frontierTownLandmarks().saloon.door.y;');
check('!player.checkCol(player.x,player.y)','The saloon entrance stands outside all collision footprints');
keys.add(70);run('handleDesktop();');
check('frontierSaloonIsInside() && player.x===FRONTIER_SALOON_ROOM.entry.x && player.y===FRONTIER_SALOON_ROOM.entry.y','Native F input enters the larger saloon');
run('updateFrontierSaloonActivity();');
check('frontierSaloonIsInside()','Holding entry F does not immediately leave the room');
keys.delete(70);run('updateFrontierSaloonActivity();');
run(`var outerTicks=0;var outerUpdate=updateEntities;updateEntities=()=>outerTicks++;var clockBeforeRoom=worldTimeMs;
 var killsBeforeRoom=totalKills;var outsideActors=enemiesList.length;draw();updateEntities=outerUpdate;`);
check('outerTicks===0 && worldTimeMs===clockBeforeRoom && totalKills===killsBeforeRoom && enemiesList.length===outsideActors',
 'The native frame isolates room actors, objectives and outside world time');
tap(ctx.width/2,ctx.height-30);release();
check('!frontierSaloonIsInside() && player.x===frontierTownLandmarks().saloon.door.x','The visible leave button returns to the exact exterior entrance');
// The same public prompt must work on a standard controller and remain an
// edge action when A stays down through the transition.
const pad={connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false}))};
ctx.navigator.getGamepads=()=>[pad];pad.buttons[0].pressed=true;run('handleGamepad();');
check('frontierSaloonIsInside()','Native gamepad A enters the saloon');
run('updateFrontierSaloonActivity();');
check('frontierSaloonIsInside()','Holding entry A does not immediately leave the room');
pad.buttons[0].pressed=false;run('updateFrontierSaloonActivity();');ctx.navigator.getGamepads=()=>[];
run('exitFrontierSaloon();');play();
// Mission touches remain consumed for as long as that finger is held. They
// cannot turn into a gun trigger when the normal stick parser sees them.
place('player.x=frontierBountyBoard().x-40;player.y=frontierBountyBoard().y;');
check('!player.checkCol(player.x,player.y)','The sheriff board has a reachable interaction approach');
tap(ctx.width/2,ctx.height-100,37);run('handleTouches();');
check('frontierBounties.activeId===FRONTIER_BOUNTY_DEFS[0].id','The native sheriff touch prompt accepts the first wanted poster');
check('!rightStick.active && !leftStick.active && window.__frontierConsumedTouches.has(37)','A held mission touch does not become aim, fire or movement');
release();check('!window.__frontierConsumedTouches.has(37)','Lifting the interaction finger releases its consumed touch ID');
// Native combat credit consumes an explicitly tagged casualty once, and never
// satisfies the main level goal or a separate NM-0 ambush.
run('var contract=FRONTIER_BOUNTY_DEFS[0];player.x=contract.x;player.y=contract.y;');
place('player.x=contract.x;player.y=contract.y+100;');run('updateFrontierBounties();');
check('enemiesList.filter(e=>e.frontierBountyId===contract.id).length===contract.count','Approaching the selected outpost forms its unique saved gang');
run(`var bountyVictim=enemiesList.find(e=>e.frontierBountyId===contract.id);var campaignKillsBefore=totalKills;
 var ambushBefore=nm0AmbushKills;var scoreBeforeKill=score;bountyVictim.hp=0;bountyVictim.dead=true;
 processKill(bountyVictim.x,bountyVictim.y,false,bountyVictim.eType,false,bountyVictim);`);
check('frontierBountyRecord(contract).killed.length===1 && totalKills===campaignKillsBefore && nm0AmbushKills===ambushBefore',
 'Native processKill advances only the accepted bounty ledger');
run('processKill(bountyVictim.x,bountyVictim.y,false,bountyVictim.eType,false,bountyVictim);');
check('frontierBountyRecord(contract).killed.length===1 && score===scoreBeforeKill+5','Repeated death credit cannot duplicate the outlaw or score');
// Store painting and native tap routing share one adaptive descriptor layout.
run('isPaused=true;pauseMenuState="SHOP";score=99;');shopTap('REVOLVER');
check('!revolverUnlocked && score===99','The revolver cannot be purchased below its exact 100-score price');
run('score=100;');shopTap('REVOLVER');
check('revolverUnlocked && score===0 && player.currentWeapon===WEAPONS.REVOLVER && player.weaponAmmo.REVOLVER===6 && player.mags.REVOLVER===3',
 'A real store tap spends 100 score and equips a six-round revolver with reserve loaders');
shopTap('COWBOY');check('!cowboyCostumeOwned && !cowboySuitEquipped','The cowboy costume stays locked until the duel is won');
play();place('player.x=frontierTownLandmarks().duel.x;player.y=frontierTownLandmarks().duel.y;');
tap(ctx.width/2,ctx.height-100);release();
check('frontierSaloonIsInside() && _frontierSaloonSession.mode==="DUEL" && _frontierSaloonSession.duel.phase==="WAIT"','The plaza prompt starts the western quick draw');
roomTap('FIRE');
check('_frontierSaloonSession.duel.phase==="RESULT" && !_frontierSaloonSession.duel.won && !cowboyCostumeOwned','Firing before DRAW loses without granting the costume');
run('startFrontierQuickDraw();_frontierSaloonSession.duel.remainingMs=1;updateFrontierSaloonActivity();');
check('_frontierSaloonSession.duel.phase==="DRAW"','The actual activity timer reveals the draw cue');
const duelScore=run('score');roomTap('FIRE');
check('_frontierSaloonSession.duel.phase==="DRAW" && _frontierSaloonSession.duel.projectiles.length===1 && !cowboyCostumeOwned',
 'A native FIRE tap launches a finite projectile before it can award a duel victory');
roomTick(15);
check('_frontierSaloonSession.duel.won && cowboyCostumeOwned && frontierSaloonProgress.duelWon','A timely native FIRE tap immediately awards cowboy ownership');
check('_frontierSaloonSession.duel.opponentCorpse instanceof Corpse && _frontierSaloonSession.opponent.dead && !_frontierSaloonSession.opponent.knockedOut && frontierSaloonProgress.duelTier===1',
 'The impact creates a local native gun death and advances the saved challenger tier');
assert.equal(run('score'),duelScore+120,'The first duel victory awards its score exactly once');checks++;
run('startFrontierQuickDraw();_frontierSaloonSession.duel.remainingMs=1;updateFrontierSaloonActivity();');
roomTap('FIRE');assert.equal(run('score'),duelScore+120,'Rematches cannot duplicate the first victory payout');checks++;
roomTick(18);
check('_frontierSaloonSession.duel.won && frontierSaloonProgress.duelTier===2 && _frontierSaloonSession.duel.distance>380 && _frontierSaloonSession.duel.deadlineMs<700',
 'The next challenger stands farther away, draws faster and advances only after an actual impact');
assert.equal(run('score'),duelScore+120,'A second confirmed impact cannot duplicate the duel payout');checks++;
run('exitFrontierSaloon();isPaused=true;pauseMenuState="SHOP";');shopTap('COWBOY');
check('cowboySuitEquipped && !ninjaSuitUnlocked && !explosiveArmorUnlocked && !chemistSuitUnlocked','Won cowboy attire equips freely and occupies one suit slot');
// An interior save stores the exterior entrance and completed activities. A
// reload resumes the real town with exact finite revolver ammunition.
play();place('player.x=frontierTownLandmarks().saloon.door.x;player.y=frontierTownLandmarks().saloon.door.y;');
run('player.currentWeapon=WEAPONS.REVOLVER;player.weaponAmmo.REVOLVER=4;player.mags.REVOLVER=2;setMeleeTool("NONE");');
tap(ctx.width/2,ctx.height-100);release();run('saveGame();');
const saved=JSON.parse(slot);
assert.equal(saved.playerX,1156);assert.equal(saved.playerY,-1730);assert.equal(saved.frontierWeapon,'REVOLVER');checks+=3;
assert.equal(saved.frontierEquipment.revolverAmmo,4);assert.equal(saved.frontierEquipment.revolverReserve,2);checks+=2;
run('loadGame();');play();
check('!frontierSaloonIsInside() && player.x===1156 && player.y===-1730 && authoredCore','Loading an interior save resumes outside the still-present saloon');
check('cowboyCostumeOwned && cowboySuitEquipped && revolverUnlocked && player.currentWeapon===WEAPONS.REVOLVER && player.weaponAmmo.REVOLVER===4 && player.mags.REVOLVER===2',
 'Reload restores won attire and the exact equipped revolver ammunition');
check('frontierBounties.activeId===contract.id && frontierBountyRecord(contract).killed.length===1 && frontierSaloonProgress.duelWon && frontierSaloonProgress.duelTier===2',
 'Reload restores the partial accepted bounty and completed duel together');
const exactSave=slot,earnedSave=JSON.parse(slot);delete earnedSave.frontierEquipment;slot=JSON.stringify(earnedSave);
run('loadGame();');play();
check('frontierSaloonProgress.duelWon && cowboyCostumeOwned && !revolverUnlocked',
 'A recorded duel victory restores its earned costume even when the equipment record is missing');
assert.equal(run('score'),earnedSave.score,'Recovering earned costume ownership never repeats the duel score reward');checks++;
slot=exactSave;run('loadGame();');play();
run('window.travelArrival="SOUTH";startAtLevel(4);window.travelArrival="NORTH";startAtLevel(3);');play();
check('authoredCore && cowboyCostumeOwned && cowboySuitEquipped && revolverUnlocked && player.currentWeapon===WEAPONS.REVOLVER && player.weaponAmmo.REVOLVER===4 && player.mags.REVOLVER===2 && frontierBountyRecord(contract).killed.length===1 && frontierSaloonProgress.duelTier===2',
 'Return travel retains the western town, clothing, equipped revolver, exact ammunition and partial bounty');
run('isStoryMode=true;townsData[3]={established:true};startAtLevel(3);');play();
check('storyArcCleared(3) && authoredCore && buildings.filter(b=>b.isWesternBldg).length>=60','Settling the story sector retains every permanent town mission');
run('resetStoryProgress();');
check('!cowboyCostumeOwned && !cowboySuitEquipped && !revolverUnlocked && !frontierBounties.activeId && !frontierSaloonProgress.duelWon',
 'Only a new campaign resets western rewards and contracts');
console.log('Frontier integration: '+checks+' checks passed.');

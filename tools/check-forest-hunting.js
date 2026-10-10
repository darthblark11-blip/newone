// Exercise Cedar Hollow through the actual level, projectile, input and save
// hooks. Painting is stubbed; geometry, actors, quest transitions and storage
// are the real game logic.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let checks = 0, seed = 4231, now = 5000, slot = null;
ctx.random = (a,b) => {
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const r=seed/4294967296;
  if(a===undefined)return r;
  if(Array.isArray(a))return a[(r*a.length)|0];
  return b===undefined?r*a:a+r*(b-a);
};
ctx.millis = () => now;
ctx.localStorage = {getItem(){return slot;},setItem(k,v){slot=v;},removeItem(){slot=null;}};
function run(code){return probe(code);}
function check(code,message){assert.ok(run(code),message);checks++;}
function tap(x,y){ctx.mouseX=x;ctx.mouseY=y;run('touchStarted();');}
function gameplay(){run(`isPaused=false;isDead=false;isWin=false;killcamMode=false;
  inCutscene=false;inTownCutscene=false;inFortCutscene=false;inPostAmbushCutscene=false;
  inFarmCutscene=false;inFarmPostCutscene=false;inWorldBuildingMenu=false;
  inOverworldView=false;inTravelMenu=false;inStoryIntro=false;inDarchonCall=false;doTick=true;`);}
run('isStoryMode=false;resetStoryProgress();startAtLevel(2);var huntSite=forestHuntingSite();');
gameplay();
check('huntSite && Number.isFinite(huntSite.x) && huntSite.y>3600','Cedar Hollow exists outside the story fortress');
check('!hitsAuthored(huntSite.x,huntSite.y,340,280,90)','The community does not replace authored geometry');
run(`var huntGenerated=[];var huntCX=Math.floor(huntSite.x/CHUNK_W),huntCY=Math.floor(huntSite.y/CHUNK_W);
  for(let y=huntCY-1;y<=huntCY+1;y++)for(let x=huntCX-1;x<=huntCX+1;x++)huntGenerated.push(...generateChunkContent(2,x,y).solid);
  var huntLodges=forestHuntingStructures();`);
check(`huntLodges.length===3 && huntLodges.every(l=>solidsClearAt(huntGenerated,l.x,l.y,l.w,l.h,0))`,
  'Every actual lodge footprint fits the unmodified procedural geometry');
check('buildings.filter(b=>b.forestHuntingLodge).length===3','Level entry publishes all lodge collision solids');
run('chunkMgr.rebuildWorldArrays();chunkMgr.rebuildWorldArrays();');
check('buildings.filter(b=>b.forestHuntingLodge).length===3 && huntLodges.every(l=>buildings.includes(l))',
  'Chunk republication preserves lodge identity without duplicating them');
run(`player.x=huntSite.stewardX;player.y=huntSite.stewardY;
  viewLeft=player.x-800;viewRight=player.x+800;viewTop=player.y-600;viewBottom=player.y+600;
  lastActiveUpdate=0;updateActiveWorld();`);
check('player.checkCol(huntLodges[0].x,huntLodges[0].y)','Lodge art has real player collision');
check('huntLodges.every(l=>buildingRise(l)===28 && l.isBlockBuilding)','Fallback and advanced lighting read the lodge art height');
let lodgeQuads=0, nativeQuad=ctx.quad;
ctx.quad=(...args)=>{lodgeQuads++;return nativeQuad(...args);};
run('drawBuildings(huntLodges);');
ctx.quad=nativeQuad;
assert.ok(lodgeQuads>=21,'Buildings dispatch the joined cedar-lodge painter');checks++;
tap(ctx.width/2,ctx.height-100);
check(`forestHuntingQuest.stage==='HUNT' && player.flags.bowUnlocked && player.currentWeapon===WEAPONS.BOW && player.weaponAmmo.BOW===24`,
  'The visible touch prompt grants an equipped bow and finite arrows');
run('player.weaponAmmo.BOW=17;');
tap(ctx.width/2,ctx.height-100);
check('player.weaponAmmo.BOW===17 && forestHuntingQuest.stage===\'HUNT\'', 'Repeated introductions cannot duplicate arrows');
const supplyBefore=run('forestHuntingQuest.resupplyRemainingMs');
for(let i=0;i<10;i++)tap(ctx.width/2,ctx.height-100);
assert.strictEqual(run('forestHuntingQuest.resupplyRemainingMs'),supplyBefore,'Interaction refreshes do not accelerate supply time');checks++;
// A real pooled arrow strikes the drawn head, then the mobile collect prompt
// carries the resulting perfect harvest into the visible inventory.
run(`resetForestWildlife();enemiesList=[];activeBuildings=[];activeParkingCars=[];
  colGrid=null;barrels=[];bullets=[];
  var huntAnimal=wildlifeSpawnAnimal('ELK',huntSite.x+150,huntSite.y+150);huntAnimal.angle=0;
  var huntHead=wildlifeHeadPoint(huntAnimal);
  spawnBullet(huntHead.x-40,huntHead.y,0,true,'HEAD',WEAPONS.BOW,player);
  updateBullets();updateBullets();`);
check(`huntAnimal.dead && huntAnimal.condition==='PERFECT' && huntAnimal.method==='BOW_HEAD'`,
  'Actual arrow projectile yields an instant perfect headshot harvest');
run('player.x=huntAnimal.x;player.y=huntAnimal.y;');
tap(ctx.width/2,ctx.height-100);
check(`forestHuntInventory.length===1 && forestHuntInventory[0].arrowPerfectCount===1 && forestHuntingQuest.stage==='RETURN'`,
  'Collect input records the arrow specimen and advances the lesson');
tap(ctx.width/2,ctx.height-100);
check('forestHuntInventory[0].count===1','A collected corpse cannot be harvested twice');
run(`var huntStun=wildlifeSpawnAnimal('RACCOON',player.x+10,player.y);
  applyForestWildlifeHit(huntStun,{weapon:WEAPONS.TASER,head:false,shotId:'hunt-stun',damage:0,owner:player});`);
tap(ctx.width/2,ctx.height-100);
check(`forestHuntInventory.some(i=>i.species==='RACCOON'&&i.state==='STUNNED'&&i.condition==='PERFECT')`,
  'Perfect taser harvests remain labeled as stunned animals');
run(`player.x=huntSite.stewardX;player.y=huntSite.stewardY;
  var huntWoodBefore=resourceCount('WOOD');var huntStoneBefore=resourceCount('STONE');`);
tap(ctx.width/2,ctx.height-100);
check(`forestHuntingQuest.stage==='COMPLETE'&&forestHuntingQuest.rewardGranted&&resourceCount('WOOD')===huntWoodBefore+60&&resourceCount('STONE')===huntStoneBefore+20`,
  'Returning the arrow specimen completes the lesson and pays the reward once');
check('!forestHuntInventory.some(i=>i.arrowPerfectCount>0)','The returned specimen is consumed exactly once');
run('player.weaponAmmo.BOW=11;');
tap(ctx.width/2,ctx.height-100);
check(`resourceCount('WOOD')===huntWoodBefore+60&&player.weaponAmmo.BOW===11`, 'Completed lesson cannot duplicate rewards or bypass supply delay');
// Tablet uses the same touch routing as the game, and the renderer must not
// reach for draw()'s local drawBtn closure.
run('isPaused=true;pauseMenuState="TABLET";window.lastPauseTime=0;');
tap(ctx.width/2,ctx.height/2+20);
check('pauseMenuState===\'INVENTORY\'','Tablet touch routing opens the hunting inventory');
let inventoryText=[];const nativeText=ctx.text;
ctx.text=(...args)=>{inventoryText.push(String(args[0]));return nativeText(...args);};
run('drawForestHuntInventory();');ctx.text=nativeText;
assert.ok(inventoryText.some(s=>s.includes('STUNNED RACCOON'))&&inventoryText.some(s=>s.includes('ARROWS 11/24')),
  'Inventory actually renders condition-preserving harvest labels and finite quiver');checks++;
tap(ctx.width/2,ctx.height-40);
check('pauseMenuState===\'TABLET\'','Inventory back button uses its displayed hit box');
gameplay();
run('restoreForestWildlife({seed:123,nextId:80,encounters:42,rareMisses:17});saveGame();');
const snapshot=JSON.parse(slot);
assert.strictEqual(snapshot.forestHunting.quest.bowAmmo,11,'Save captures current finite arrows');checks++;
assert.strictEqual(snapshot.forestWildlife.rareMisses,17,'Save writes encounter pseudo-luck');checks++;
run('resetForestHuntingActivity();resetForestWildlife();loadGame();');
check(`forestHuntingQuest.stage==='COMPLETE'&&player.flags.bowUnlocked&&player.weaponAmmo.BOW===11`,
  'Actual save/load restores bow ownership and arrows after character reconstruction');
check(`forestHuntInventory.some(i=>i.species==='RACCOON'&&i.state==='STUNNED')&&serializeForestWildlife().rareMisses===17`,
  'Save/load restores harvests and the exact encounter rarity progression');
check(`forestHuntingSite().x===huntSite.x&&forestHuntingSite().y===huntSite.y&&buildings.filter(b=>b.forestHuntingLodge).length===3`,
  'The saved settlement site is restored before Level 2 geometry is built');
run('player.weaponAmmo.BOW=7;window.travelArrival="NORTH";startAtLevel(3);');
check('player.flags.bowUnlocked&&player.weaponAmmo.BOW===7 && buildings.every(b=>!b.forestHuntingLodge)',
  'Travel preserves the finite quiver and keeps forest lodges out of other sectors');
run('window.travelArrival="SOUTH";startAtLevel(2);');
check('player.flags.bowUnlocked&&player.weaponAmmo.BOW===7&&forestHuntingQuest.stage===\'COMPLETE\'',
  'Return travel retains the completed activity without granting a fresh quiver');
// The world clock, including travel to another biome, owns the supply timer.
run('window.travelArrival="NORTH";startAtLevel(3);forestHuntingQuest.resupplyRemainingMs=500;clockLastMs=4900;isPaused=false;inTravelMenu=false;');
now=5100;run('updateWorldClock();');
check('forestHuntingQuest.resupplyRemainingMs===300','World time advances supply cooldown outside the forest');
run('isPaused=true;clockLastMs=5100;');now=5300;run('updateWorldClock();');
check('forestHuntingQuest.resupplyRemainingMs===300','Paused time does not refresh supplies');
run('window.travelArrival="SOUTH";startAtLevel(2);forestHuntingQuest.resupplyRemainingMs=0;');gameplay();
run('player.x=forestHuntingSite().stewardX;player.y=forestHuntingSite().stewardY;');
tap(ctx.width/2,ctx.height-100);
check('player.weaponAmmo.BOW===24 && forestHuntingQuest.resupplyRemainingMs===DAY_MS/4','Eligible return grants one quiver and restarts the supply delay');
// Existing saves predate the activity. Loading them must not borrow bow or
// harvested items from a newer run in the same browser tab.
delete snapshot.forestHunting;delete snapshot.forestWildlife;slot=JSON.stringify(snapshot);
run('loadGame();');
check(`forestHuntingQuest.stage==='UNMET'&&!(player.flags&&player.flags.bowUnlocked)&&player.weaponAmmo.BOW===0&&forestHuntInventory.length===0`,
  'Older saves migrate cleanly without borrowing newer hunting progress');
run(`forestHuntingGrantBow();addForestHuntHarvest({species:'ELK',condition:'GOOD',state:'DEAD',method:'GUN'});resetStoryProgress();`);
check(`forestHuntingQuest.stage==='UNMET'&&forestHuntInventory.length===0&&serializeForestWildlife().encounters===0&&!player.flags.bowUnlocked`,
  'Only a new campaign resets hunting inventory, bow and encounter luck');
run('isStoryMode=true;resetStoryProgress();startAtLevel(2);');
check('authoredCore && authoredSolids.every(b=>!b.isForestHuntingLandmark)',
  'Hybrid forest entry never adopts settlement-owned lodges into authored geometry');
run('resetForestHuntingActivity();chunkMgr.rebuildWorldArrays();adoptLateAuthoredSolids();chunkMgr.rebuildWorldArrays();');
check('buildings.filter(b=>b.forestHuntingLodge).length===3&&authoredSolids.every(b=>!b.isForestHuntingLandmark)',
  'Activity reset and authored adoption cannot publish two sets of lodges');
console.log('Forest hunting: '+checks+' integration checks passed.');

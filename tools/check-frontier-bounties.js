// Real level entry, streamed geometry, native projectile death and save hooks.
// Painting is stubbed; the sheriff contracts use the actual game state.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let checks = 0, slot = null, seed = 3017;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  return b === undefined ? r * a : a + r * (b - a);
};
ctx.localStorage = {getItem(){return slot;},setItem(k,v){slot=v;},removeItem(){slot=null;}};
function run(code) { return probe(code); }
function check(code, message) { assert.ok(run(code), message); checks++; }
function gameplay() {
  run(`started=true;isPaused=false;isDead=false;isWin=false;killcamMode=false;
    inTownCutscene=false;inFortCutscene=false;inPostAmbushCutscene=false;
    inFarmCutscene=false;inFarmPostCutscene=false;inWorldBuildingMenu=false;
    inOverworldView=false;inTravelMenu=false;inStoryIntro=false;inDarchonCall=false;
    doTick=true;player.hp=player.maxHp;player.dead=false;`);
}
function board() {
  run(`var bountyBoard=frontierBountyBoard();player.x=bountyBoard.x-40;player.y=bountyBoard.y;
    lastActiveUpdate=0;updateActiveWorld();updateFrontierBounties(false);`);
}
function tapBoard() {
  ctx.mouseX=ctx.width/2;ctx.mouseY=ctx.height-100;run('touchStarted();');
}
run('isStoryMode=false;resetStoryProgress();startAtLevel(3);'); gameplay();
check('frontierBountySites().length===3 && new Set(frontierBountySites().map(d=>d.kind)).size===3',
  'The sheriff sends the player to three distinct named outpost styles');
check('buildings.filter(b=>b.isFrontierBountyStructure).length===21',
  'Level entry publishes every permanent outpost collision solid');
run('chunkMgr.rebuildWorldArrays();chunkMgr.rebuildWorldArrays();');
check('buildings.filter(b=>b.isFrontierBountyStructure).length===21 && authoredSolids.every(b=>!b.isFrontierBountyStructure)',
  'Chunk republication neither duplicates landmarks nor expands the authored town');
check(`frontierBountyStructures().every(b=>b.isLandmark&&buildingRise(b)===b._rise)`,
  'Lighting, shadows and depth sorting share the actual outpost heights');
run(`var bountyGenerated=[];
  for(const d of frontierBountySites()) {
    const cx=Math.floor(d.x/CHUNK_W),cy=Math.floor(d.y/CHUNK_W);
    for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)
      bountyGenerated.push(...generateChunkContent(3,x,y).solid);
  }`);
check(`frontierBountyStructures().every(b=>solidsClearAt(bountyGenerated,b.x,b.y,b.w,b.h,0))`,
  'Full outpost footprints never overlap streamed houses, cactus or crop fences');
check(`frontierBountySites().every(d=>!hitsAuthored(d.x,d.y,d.w,d.h,0))`,
  'The new destinations preserve every authored farm and town building');
board();
check('_frontierBountyPrompt && !player.checkCol(player.x,player.y)',
  'The sheriff board prompt has a reachable position outside the sheriff building');
tapBoard();
check(`frontierBounties.activeId==='RED_MESA'&&frontierBountyRecord(FRONTIER_BOUNTY_DEFS[0]).stage==='ACTIVE'`,
  'The visible touch prompt accepts the first posted bounty');
run('var bountyFirstScore=score;var bountyFirstKills=totalKills;');
for(let i=0;i<4;i++)tapBoard();
check('score===bountyFirstScore && totalKills===bountyFirstKills',
  'Reading an accepted poster cannot grant score or advance the campaign');
run(`var bountySite=FRONTIER_BOUNTY_DEFS[0];player.x=bountySite.x;player.y=bountySite.y+320;
  camX=player.x-width/zoom/2;camY=player.y-height/zoom/2;
  viewLeft=player.x-1000;viewRight=player.x+1000;viewTop=player.y-1000;viewBottom=player.y+1000;
  chunkMgr.update(player.x,player.y);lastActiveUpdate=0;updateActiveWorld();updateFrontierBounties();`);
check(`enemiesList.filter(e=>e.frontierBountyId==='RED_MESA').length===5`,
  'Approaching the accepted redoubt spawns exactly its five named-roster bandits');
run('updateFrontierBounties();updateFrontierBounties();');
check(`enemiesList.filter(e=>e.frontierBountyId==='RED_MESA').length===5`,
  'Repeated updates cannot duplicate an outpost roster');
check(`enemiesList.filter(e=>e.frontierBountyId).every(e=>e.eType==='BANDIT'&&!e.isFriendly&&!e.isNeutral&&!e.checkCol(e.x,e.y))`,
  'Every gang member is a native hostile on real clear ground');
check(`enemiesList.filter(e=>e.frontierBountyId).some(e=>e.state==='CHASE')`,
  'Sentries see an approaching player and enter the native gunfight AI');
run(`var bountyWounded=enemiesList.find(e=>e.frontierBountySlot===1&&e.frontierBountyId);
  bountyWounded.takeDamage(55,player);releaseFrontierBountyActors();updateFrontierBounties();`);
check(`enemiesList.find(e=>e.frontierBountySlot===1&&e.frontierBountyId).hp===75`,
  'Outpost release and re-entry preserve a particular survivor\'s wounds');
// A real player revolver round strikes the captain. It uses the pooled bullet,
// native damage/death path and the central kill hook, rather than a fake quest kill.
run(`var bountyCaptain=enemiesList.find(e=>e.frontierBountyId==='RED_MESA'&&e.frontierBountySlot===0);
  bountyCaptain.hp=30;bullets=[];barrels=[];
  spawnBullet(bountyCaptain.x-10,bountyCaptain.y,0,true,'BODY',WEAPONS.REVOLVER,player);
  updateBullets();updateBullets();`);
check(`frontierBountyRecord(bountySite).killed.includes(0)&&bountyCaptain.dead`,
  'Actual revolver fire records the tagged captain defeat');
check('totalKills===bountyFirstKills && !killcamMode && !isWin',
  'Bounty casualties do not complete the farm arc or arcade kill objective');
run('var bountyAfterShotScore=score;processKill(bountyCaptain.x,bountyCaptain.y,false,"BANDIT",false,bountyCaptain);');
check('score===bountyAfterShotScore && frontierBountyRecord(bountySite).killed.length===1',
  'Duplicate central death notifications cannot pay or count a tagged victim twice');
run(`var bountyFake={x:0,y:0,dead:true,hp:0,eType:'BANDIT'};var bountyKillCount=frontierBountyRecord(bountySite).killed.length;
  frontierBountyOnKill(bountyFake);`);
check('frontierBountyRecord(bountySite).killed.length===bountyKillCount',
  'An unrelated ambient bandit never advances a sheriff contract');
run('saveGame();');
assert.ok(JSON.parse(slot).frontierBounties,'Save writes the separate sheriff casualty ledger');checks++;
run('resetFrontierBounties();loadGame();');gameplay();
check(`frontierBounties.activeId==='RED_MESA'&&frontierBountyRecord(FRONTIER_BOUNTY_DEFS[0]).killed.includes(0)`,
  'Actual save/load restores the accepted poster and confirmed casualties');
run(`player.x=FRONTIER_BOUNTY_DEFS[0].x;player.y=FRONTIER_BOUNTY_DEFS[0].y+320;
  viewLeft=player.x-1000;viewRight=player.x+1000;viewTop=player.y-1000;viewBottom=player.y+1000;
  chunkMgr.update(player.x,player.y);updateFrontierBounties();`);
check(`enemiesList.filter(e=>e.frontierBountyId==='RED_MESA').length===4&&
  enemiesList.find(e=>e.frontierBountySlot===1&&e.frontierBountyId).hp===75`,
  'Loading re-forms only surviving, wounded outlaws');
run(`for(const e of enemiesList.slice())if(e.frontierBountyId==='RED_MESA'){
  e.hp=0;e.dead=true;processKill(e.x,e.y,false,e.eType,false,e);
}`);
check(`frontierBountyRecord(FRONTIER_BOUNTY_DEFS[0]).stage==='READY'&&frontierBounties.activeId==='RED_MESA'`,
  'The whole gang must be defeated before its poster can be claimed');
board();run('var bountyBeforeReward=score;');tapBoard();
check(`score===bountyBeforeReward+125&&frontierBountyRecord(FRONTIER_BOUNTY_DEFS[0]).rewardGranted&&frontierBounties.activeId===null`,
  'Returning to the sheriff pays the exact posted 125 score once');
tapBoard();
check(`frontierBounties.activeId==='DUST_RAIL'&&score===bountyBeforeReward+125`,
  'The next interaction starts a different outpost without repeating the old payment');
run('window.travelArrival="NORTH";startAtLevel(2);');gameplay();
check(`buildings.every(b=>!b.isFrontierBountyStructure)&&enemiesList.every(e=>!e.frontierBountyId)&&frontierBounties.activeId==='DUST_RAIL'`,
  'Travel banks a bounty while removing its level-specific structures and actors');
run('window.travelArrival="SOUTH";startAtLevel(3);');gameplay();
check(`frontierBounties.activeId==='DUST_RAIL'&&frontierBountyRecord(FRONTIER_BOUNTY_DEFS[0]).stage==='COMPLETE'`,
  'Return travel preserves the completed and active posters');
for (const [index, expectedCount, expectedReward] of [[1,6,175],[2,7,225]]) {
  run(`var laterBounty=FRONTIER_BOUNTY_DEFS[${index}];
    player.x=laterBounty.x;player.y=laterBounty.y+320;
    viewLeft=player.x-1000;viewRight=player.x+1000;viewTop=player.y-1000;viewBottom=player.y+1000;
    chunkMgr.update(player.x,player.y);updateFrontierBounties();`);
  check(`enemiesList.filter(e=>e.frontierBountyId===laterBounty.id).length===${expectedCount}&&
    enemiesList.filter(e=>e.frontierBountyId===laterBounty.id).every(e=>!e.checkCol(e.x,e.y))`,
    'Later outpost '+index+' forms its complete, correctly sized roster on clear floor');
  run(`for(const e of enemiesList.slice())if(e.frontierBountyId===laterBounty.id){
    e.takeDamage(999,player);e.dead=true;processKill(e.x,e.y,false,e.eType,false,e);
  }`);
  board();run('var laterBountyScore=score;');tapBoard();
  check(`score===laterBountyScore+${expectedReward}&&frontierBountyRecord(laterBounty).stage==='COMPLETE'`,
    'Later poster '+index+' pays exactly its advertised score on return');
  run('var lastClaimScore=score;');tapBoard();
  check('score===lastClaimScore','Re-reading a paid poster never repeats its reward');
}
check(`frontierBounties.activeId===null&&FRONTIER_BOUNTY_DEFS.every(d=>frontierBountyRecord(d).stage==='COMPLETE')&&totalKills===bountyFirstKills`,
  'All three distinct outposts can be cleared without consuming the campaign kill objective');
// Exercise malformed/older saves: impossible casualty indices never erase a
// legitimate objective, and one claimed reward can never become claimable again.
run(`restoreFrontierBounties({activeId:'DUST_RAIL',contracts:{
  RED_MESA:{stage:'COMPLETE',rewardGranted:true},
  DUST_RAIL:{stage:'READY',killed:[0,0,-1,99,'1'],survivors:{1:{hp:999,x:NaN,y:Infinity}}}
}});`);
check(`frontierBountyRecord(FRONTIER_BOUNTY_DEFS[1]).stage==='ACTIVE'&&
  frontierBountyRecord(FRONTIER_BOUNTY_DEFS[1]).killed.length===1&&
  frontierBountyRecord(FRONTIER_BOUNTY_DEFS[1]).survivors[1].hp===130`,
  'Restore sanitizes malformed casualties, claimed state and survivor HP');
run('resetStoryProgress();');
check('frontierBounties.activeId===null && Object.keys(frontierBounties.contracts).length===0',
  'Only a new campaign resets the sheriff contracts');
// Render the joined three-dimensional silhouettes and every touch/HUD label.
run('isStoryMode=false;startAtLevel(3);');gameplay();board();
let quads=0, labels=[];const nativeQuad=ctx.quad,nativeText=ctx.text;
ctx.quad=(...args)=>{quads++;return nativeQuad(...args);};
ctx.text=(...args)=>{labels.push(String(args[0]));return nativeText(...args);};
run(`viewLeft=-5000;viewRight=6500;viewTop=-5000;viewBottom=3000;
  drawBuildings(frontierBountyStructures());drawFrontierBountyWorld();drawFrontierBountyHud();`);
ctx.quad=nativeQuad;ctx.text=nativeText;
assert.ok(quads>=84,'All outpost walls join leaned roof planes to their rooted footprints');checks++;
assert.ok(labels.includes('SHERIFF · WANTED')&&labels.includes('ACCEPT SHERIFF BOUNTY'),
  'The board renders its posters and the actual selectable touch prompt');checks++;
console.log('Frontier bounties: '+checks+' integration checks passed.');

// Authored room rosters, dormant ceremony, six-site chants and save migration.
// Exercise native Characters and geometry rather than a second combat model.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');
ctx.setTimeout=()=>0;
let checks=0;
const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
P(`var dungeonCombatFixture=()=>{
 currentLevel=currentBiome=9;BIOME_ACTIVE=false;started=doTick=true;
 isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTravelMenu=inWorldBuildingMenu=false;
 inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=false;
 buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];barrels=[];
 enemiesList=[];corpses=[];particles=[];bullets=[];resetOccultWorld();
 generateUndergroundMap();activeBuildings=buildings;invalidateColIndex();
 player=new Character(0,1100,true);player.hp=100;player.shield=0;
 leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
 window.meleeToolSel='NONE';window.shovelOwned=false;
 seedOccultEncounter();
};
 dungeonCombatFixture();`);
ok('enemiesList.length===54&&new Set(OCCULT_ENCOUNTER.map(p=>p.id)).size===54',
 'Four finite room rosters contain 54 unique magician identities');
for(const [room,total,black,red,blue] of [
 ['chamber',12,3,6,3],['nave',9,2,4,3],['transept',15,3,6,6],['sanctuary',18,4,7,7]]){
 ok(`enemiesList.filter(e=>e.occult.room==='${room}').length===${total}&&
  ['BLACK','RED','BLUE'].every((kind,i)=>enemiesList.filter(e=>e.occult.room==='${room}'&&e.occult.kind===kind).length===[${black},${red},${blue}][i])`,
  room+' has its distinct authored encounter and color mix');
}
ok('OCCULT_ENCOUNTER.every(p=>undergroundRoomAt(p.x,p.y).id===p.room&&occultPointClear(p.x,p.y,17))',
 'Every station belongs to its room and clears native walls, fixtures and closed doors');
P('seedOccultEncounter();');
ok('enemiesList.length===54','Seeding an authored encounter twice cannot duplicate stations');
P(`var dormant=enemiesList.find(e=>e.occult.room==='nave'&&e.occult.kind==='RED');
 player.x=dormant.x;player.y=dormant.y+140;dormant.occult.cooldownMs=0;
 var dormantBefore={x:dormant.x,y:dormant.y};
 for(let i=0;i<100;i++){frameCount++;occultUpdateEnemy(dormant,100);occultUpdateWorld(100);}`);
ok(`dormant.occult.phase==='IDLE'&&!dormant.occult.awakened&&dormant.state==='OCCULT_CEREMONY'&&
 dormant.x===dormantBefore.x&&dormant.y===dormantBefore.y&&occultProjectiles.length===0&&occultGroundEffects.length===0`,
 'A sealed room remains in ceremony even with a nearby target');
ok('occultCastPose(dormant).ceremony>0&&!occultCastPose(dormant).casting',
 'Idle ceremonial arm movement cannot become a damaging spell telegraph');
P(`undergroundDungeon.opened=['nave'];removeUndergroundGateBuilding('nave');
 for(let i=0;i<7;i++)occultUpdateEnemy(dormant,100);`);
ok("dormant.occult.awakened&&dormant.occult.phase==='CHARGE'&&dormant.occult.cast==='FIREBALL'",
 'Opening the room admits its native target acquisition and attack charge');

P(`dungeonCombatFixture();var black=enemiesList.find(e=>e.occult.kind==='BLACK');
 black.x=0;black.y=-1130;player.x=0;player.y=-900;
 occultBeginCast(black,'SUMMON',player);`);
ok(`black.occult.sites.length===6&&black.occult.sites.every((p,i,a)=>occultPointClear(p.x,p.y,17,black)&&
 a.every((q,j)=>i===j||Math.hypot(p.x-q.x,p.y-q.y)>=37))`,
 'The full room still offers six separated, unobstructed emergence circles');
P(`black.occult.chargeMs=600;var sixSave=JSON.parse(JSON.stringify(serializeOccultState()));
 restoreOccultState(sixSave);black=enemiesList.find(e=>e.occult.id===black.occult.id);`);
ok("black.occult.phase==='CHARGE'&&black.occult.chargeMs===600&&black.occult.sites.length===6",
 'A mid-chant save preserves all six sites and its warning duration');
P('black.occult.chargeMs=1200;occultReleaseCast(black);');
ok('enemiesList.filter(e=>e.occultZombie).length===6&&enemiesList.filter(e=>e.occultZombie).every(e=>e.occultZombie.room===black.occult.room)',
 'Six emerging native zombies inherit their summoner room identity');

P(`dungeonCombatFixture();var saveOwners=enemiesList.filter(e=>e.occult&&e.occult.kind==='BLACK');
 for(const owner of saveOwners){
  const room=UNDERGROUND_ROOMS.find(r=>r.id===owner.occult.room);let placed=0;
  for(let y=room.y+45;y<room.y+room.h-45&&placed<24;y+=62)
   for(let x=room.x+45;x<room.x+room.w-45&&placed<24;x+=62)
    if(occultPointClear(x,y,17,player)){enemiesList.push(createOccultZombie(x,y,owner));placed++;}
 }
 var finalStation=enemiesList.find(e=>e.occult.id==='sanctuary-blue-7');finalStation.hp=111;
 var fullDungeonSave=JSON.parse(JSON.stringify(serializeOccultState()));
 restoreOccultState(fullDungeonSave);`);
ok('fullDungeonSave.actors.length===342&&fullDungeonSave.dungeonRevision===OCCULT_DUNGEON_REVISION&&enemiesList.length===342',
 'The bounded save round trip retains all 54 casters plus each of twelve summoners\' 24 zombies');
ok(`saveOwners.length===12&&saveOwners.every(owner=>enemiesList.filter(e=>e.occultZombie&&e.occultZombie.ownerId===owner.occult.id).length===24)`,
 'The 24-zombie allowance belongs to each summoner rather than being shared across the dungeon');
ok("enemiesList.find(e=>e.occult.id==='sanctuary-blue-7').hp===111&&enemiesList.filter(e=>e.occultZombie).length===288",
 'The final room beyond the previous forty-actor limit retains wounds and all summons');
P(`enemiesList.find(e=>e.occult&&e.occult.id==='nave-red-1').hp=0;
 var clearedSave=JSON.parse(JSON.stringify(serializeOccultState()));restoreOccultState(clearedSave);`);
ok("enemiesList.length===341&&!enemiesList.some(e=>e.occult&&e.occult.id==='nave-red-1')",
 'Defeated new-room casters remain defeated on every modern save load');
P(`var corruptHordeSave=JSON.parse(JSON.stringify(fullDungeonSave));
 var ownerA=saveOwners[0].occult.id,ownerB=saveOwners[1].occult.id;
 var ownerAHorde=corruptHordeSave.actors.filter(a=>a.zombie&&a.zombie.ownerId===ownerA);
 var ownerBHorde=corruptHordeSave.actors.filter(a=>a.zombie&&a.zombie.ownerId===ownerB);
 var excessZombie=JSON.parse(JSON.stringify(ownerAHorde[0]));excessZombie.zombie.id='overflow-owner-a';
 corruptHordeSave.actors=[...corruptHordeSave.actors.filter(a=>a.occult),...ownerAHorde,excessZombie,...ownerBHorde];
 restoreOccultState(corruptHordeSave);`);
ok(`enemiesList.filter(e=>e.occultZombie&&e.occultZombie.ownerId===ownerA).length===24&&
 !enemiesList.some(e=>e.occultZombie&&e.occultZombie.id==='overflow-owner-a')`,
 'Loading rejects a saved twenty-fifth zombie from one summoner');
ok(`enemiesList.length===102&&enemiesList.filter(e=>e.occultZombie&&e.occultZombie.ownerId===ownerB).length===24`,
 'Rejecting an overfull owner does not consume the second summoner\'s independent allowance');

P(`dungeonCombatFixture();var legacySave=JSON.parse(JSON.stringify(serializeOccultState()));
 delete legacySave.dungeonRevision;
 legacySave.actors=legacySave.actors.filter(a=>OCCULT_LEGACY_IDS.includes(a.occult.id)&&a.occult.id!=='chamber-red');
 legacySave.actors.find(a=>a.occult.id==='tunnel-red').y=-180;
 legacySave.actors.find(a=>a.occult.id==='chamber-black').hp=203;
 legacySave.actors.forEach(a=>delete a.occult.room);
 restoreOccultState(legacySave);`);
ok("enemiesList.length===53&&!enemiesList.some(e=>e.occult.id==='chamber-red')",
 'Migrating a four-caster save adds fifty new stations without reviving its defeated caster');
ok(`enemiesList.find(e=>e.occult.id==='tunnel-red').y===-180&&
 enemiesList.find(e=>e.occult.id==='tunnel-red').occult.room==='chamber'&&
 enemiesList.find(e=>e.occult.id==='chamber-black').hp===203`,
 'Legacy survivors retain tunnel positions, original wounds and a valid home room');
P(`var blockedLegacy=JSON.parse(JSON.stringify(legacySave));
 var blockedCaster=blockedLegacy.actors.find(a=>a.occult.id==='chamber-black');
 blockedCaster.x=-350;blockedCaster.y=-1790;blockedCaster.hp=137;
 restoreOccultState(blockedLegacy);
 var relocatedCaster=enemiesList.find(e=>e.occult.id==='chamber-black');`);
ok(`enemiesList.length===53&&relocatedCaster&&relocatedCaster.hp===137&&
 occultPointClear(relocatedCaster.x,relocatedCaster.y,14)&&
 undergroundRoomAt(relocatedCaster.x,relocatedCaster.y).id==='chamber'&&
 Math.hypot(relocatedCaster.x+350,relocatedCaster.y+1790)<=240`,
 'A legacy survivor obstructed by a newly moved altar relocates nearby with identity and health intact');
ok(`JSON.stringify(occultRestorePosition(-350,-1790,15))===JSON.stringify(occultRestorePosition(-350,-1790,15))&&
 occultRestorePosition(-350,-1790,15)!==null&&occultRestorePosition(NaN,-1790,15)===null&&
 occultRestorePosition(99999,-1790,15)===null&&occultRestorePosition(-350,-1790,-1)===null`,
 'Bounded position recovery is deterministic and rejects malformed or remote saved coordinates');
P('legacySave.actors=[];restoreOccultState(legacySave);');
ok('enemiesList.length===50&&enemiesList.every(e=>!OCCULT_LEGACY_IDS.includes(e.occult.id))',
 'A fully cleared old chamber gains only the newly introduced encounters');
console.log('Dungeon combat: '+checks+' roster, room, ceremony, six-summon and migration checks passed.');

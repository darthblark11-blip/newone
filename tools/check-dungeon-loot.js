// Dungeon death loot stays separate from native scoring, falls and hit art.
// Force successful loot rolls so a missing drop cannot pass by random chance.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');
ctx.setTimeout=()=>0;
let checks=0,randomCalls=0;
ctx.random=(a,b)=>{
  randomCalls++;
  if(Array.isArray(a))return a[0];
  if(a===100&&ctx.__lootRolls?.length)return ctx.__lootRolls.shift();
  return a===undefined?.1:b===undefined?a*.1:a+(b-a)*.1;
};
const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
P(`var lootFixture=()=>{
 currentLevel=currentBiome=9;isStoryMode=true;BIOME_ACTIVE=false;
 started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTravelMenu=inWorldBuildingMenu=false;
 nm0AmbushActive=farmAmbushActive=false;window.outpostForts={};townsData={};
 window.ambushSpawnsRemaining=0;window.nm0AmbushCleared=false;
 buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];barrels=[];invalidateColIndex();
 enemiesList=[];corpses=[];particles=[];bullets=[];resetOccultWorld();
 healthPacks=[];weaponDrops=[];resourceDrops=[];grenadePickups=[];
 player=new Character(-100,-1100,true);player.hp=100;player.shield=0;
 score=totalKills=headshotCounter=bodyOverkillCounter=consecutiveKills=comboTimer=0;
 MAX_KILLS=10000;floatingScores=[];viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
 leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
 window.meleeToolSel='NONE';window.shovelOwned=false;window.__lootRolls=[];
};
 var lootVictim=(type)=>{
  const e=type==='OCCULT_ZOMBIE'?createOccultZombie(40,-1100,'loot-owner'):
   type.startsWith('OCCULT_')?createOccultMagician(type,40,-1100,'loot-owner'):
   new Character(40,-1100,false,type);
  e.isFriendly=e.isNeutral=e.isPopulation=false;enemiesList=[e];return e;
 };
 var noDungeonItems=()=>!weaponDrops.length&&!healthPacks.length&&!resourceDrops.length&&!grenadePickups.length;
`);
for(const type of ['OCCULT_ZOMBIE','OCCULT_BLACK','OCCULT_RED','OCCULT_BLUE']){
 P(`lootFixture();var victim=lootVictim('${type}');victim.hp=0;victim.dead=true;`);
 randomCalls=0;
 P('processKill(victim.x,victim.y,true,victim.eType,false,victim,player);');
 ok('noDungeonItems()',type+' creates no firearm or other unintended item from the shared kill ledger');
 ok('score===10&&totalKills===1&&consecutiveKills===1&&comboTimer===KILL_COMBO_FRAMES',
  type+' retains ordinary headshot score, personal combo and kill progression');
 assert.equal(randomCalls,0,type+' must not spend randomness rolling nonexistent inventory');checks++;
 P(`lootFixture();victim=lootVictim('${type}');victim.isAmbush=true;victim.dead=true;victim.hp=0;
  nm0AmbushActive=true;nm0AmbushKills=3;window.__lootRolls=[90,10];
  processKill(victim.x,victim.y,false,victim.eType,false,victim,player);`);
 ok('noDungeonItems()&&nm0AmbushKills===2&&score===5&&totalKills===0',
  type+' cannot regain generic guns through the ambush kill branch');
 // Legacy callers sometimes have only the saved eType, without a live victim.
 P(`lootFixture();processKill(40,-1100,false,'${type}',false,null,player);`);
 ok('noDungeonItems()&&score===5&&totalKills===1',
  type+' remains protected for a legacy type-only kill');
}

P(`lootFixture();victim=lootVictim('NORMAL');victim.hp=0;victim.dead=true;
 processKill(victim.x,victim.y,false,victim.eType,false,victim,player);`);
ok("weaponDrops.length===1&&weaponDrops[0].type==='SMG'&&score===5&&totalKills===1",
 'Ordinary enemies keep their original successful gun roll and score');
P(`lootFixture();victim=lootVictim('NORMAL');victim.isAmbush=true;victim.dead=true;victim.hp=0;
 nm0AmbushActive=true;nm0AmbushKills=3;window.__lootRolls=[90,10];
 processKill(victim.x,victim.y,false,victim.eType,false,victim,player);`);
ok("weaponDrops.length===1&&weaponDrops[0].type==='SMG'&&nm0AmbushKills===2&&score===5",
 'Ordinary ambush enemies retain both successful loot rolls and muster progress');
P(`lootFixture();victim=lootVictim('ROBOT');victim.hp=0;victim.dead=true;
 processKill(victim.x,victim.y,false,victim.eType,false,victim,player);`);
ok("resourceDrops.length>0&&resourceDrops.every(d=>d.kind==='METAL')&&resourceDrops.reduce((n,d)=>n+d.qty,0)===6",
 'Robot salvage remains intact outside the occult loot policy');

for(const type of ['OCCULT_ZOMBIE','OCCULT_RED']){
 P(`lootFixture();victim=lootVictim('${type}');victim.hp=1;
  var round=spawnBullet(0,-1100,0,true,'BODY',WEAPONS.PISTOL,player);
  for(let i=0;i<10&&round.active;i++){frameCount++;updateBullets();}`);
 ok('victim.dead&&victim.hp<=0&&corpses.length===1&&totalKills===1&&score===5&&noDungeonItems()',
  type+' dies through a real pistol impact with its native corpse and no item drop');
 P(`lootFixture();victim=lootVictim('${type}');player.x=1000;player.y=1000;
  triggerExplosion(0,-1100,100,false,true,player);`);
 ok('victim.dead&&victim.hp<=0&&corpses.length===1&&totalKills===1&&score===5&&noDungeonItems()',
  type+' explodes through the ordinary corpse and score path without inventory');
 P(`lootFixture();victim=lootVictim('${type}');
  shovelFallImpact(victim,SHOVEL.lethalFall);frameCount++;updateEntities();`);
 ok('victim.dead&&victim.shovelFallFatal&&corpses.length===1&&totalKills===1&&score===5&&noDungeonItems()',
  type+' retains its lethal fall corpse and kill cleanup without spawning items');
}

P(`lootFixture();
 for(let i=0;i<3;i++){
  victim=lootVictim('OCCULT_ZOMBIE');victim.hp=1;
  var round=spawnBullet(0,-1100,0,true,'HEAD',WEAPONS.PISTOL,player);
  for(let f=0;f<10&&round.active;f++){frameCount++;updateBullets();}
 }`);
ok('headshotCounter===3&&totalKills===3&&corpses.length===3&&noDungeonItems()',
 'Successive zombie headshot deaths keep their native animation counter and never create guns');
ok('corpses.every((c,i)=>c.dT===[1,8,9][i])',
 'The three normal pistol headshot corpse variants continue in order');
console.log('Dungeon loot: '+checks+' native death, no-drop, score and ordinary loot checks passed.');

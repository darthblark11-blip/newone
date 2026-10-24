// Exact ranged contacts, extended danger footprints and independently owned hordes.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');
ctx.setTimeout=()=>0;
let checks=0;
const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
P(`var mageRefineFixture=()=>{
 currentLevel=currentBiome=9;BIOME_ACTIVE=false;started=doTick=true;
 isPaused=isDead=isWin=killcamMode=false;undergroundRoute.arrivalMs=900;
 inStoryIntro=inStoryRoom=inTravelMenu=inWorldBuildingMenu=false;
 inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=false;
 buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];barrels=[];
 enemiesList=[];corpses=[];particles=[];bullets=[];resetOccultWorld();resetUndergroundDungeon();invalidateColIndex();
 player=new Character(0,-500,true);player.hp=100;player.shield=0;player.dead=false;
 window.meleeToolSel='NONE';window.shovelOwned=false;
};
 var mageRefineTick=ms=>{for(let left=ms;left>0;){frameCount++;const dt=Math.min(20,left);occultUpdateWorld(dt);left-=dt;}};
 var mageRefineAdd=(kind,x=0,y=-1700)=>{const e=createOccultMagician(kind,x,y);enemiesList.push(e);return e;};
 mageRefineFixture();var ranged=mageRefineAdd('BLUE');ranged.occult.cooldownMs=0;occultUpdateEnemy(ranged,20);`);
ok("ranged.occult.phase==='IDLE'&&ranged._occultSense.target===player",
 'A caster notices a visible target 1200 units away before it enters casting range');
P('player.y=-650;ranged.occult.cooldownMs=0;for(let i=0;i<3;i++){frameCount++;occultUpdateEnemy(ranged,100);}');
ok("ranged.occult.phase==='CHARGE'&&ranged.occult.cast==='SHARD'",
 'Native AI starts a ranged attack beyond the former 480-unit limit');

P(`mageRefineFixture();ranged=mageRefineAdd('RED');occultFireProjectile(ranged,'FIREBALL',Math.PI/2);mageRefineTick(3400);`);
ok('player.hp===77','A forked fireball reaches a visible target 1200 units away within its lifetime');
P(`mageRefineFixture();ranged=mageRefineAdd('BLUE');occultFireProjectile(ranged,'SHARD',Math.PI/2);mageRefineTick(2400);`);
ok('player.hp===73','The charged shard reaches the new acquisition distance without expiring early');

P(`mageRefineFixture();ranged=mageRefineAdd('RED',-600,-1000);player.x=0;player.y=-1000;
 occultBeginCast(ranged,'LAVA',player);ranged.occult.angle=0;
 var unobstructedReach=occultLavaReach(ranged);
 buildings=[{x:-243.25,y:-1000,w:1,h:150,isWall:true}];activeBuildings=buildings;invalidateColIndex();
 var blockedReach=occultLavaReach(ranged);occultReleaseCast(ranged);mageRefineTick(350);`);
ok('unobstructedReach===600&&blockedReach>324&&blockedReach<325',
 'The thirty-metre fissure clips exactly at a one-unit wall between old six-unit samples');
ok('player.hp===100','The extended fissure never damages a target behind its clipping wall');

P(`mageRefineFixture();ranged=mageRefineAdd('BLUE',0,-1200);player.y=-841;
 occultBeginCast(ranged,'SHOCK',player);occultReleaseCast(ranged);mageRefineTick(100);`);
ok('player.hp===78','The enlarged shock reaches a target just inside its eighteen-metre boundary');
P(`mageRefineFixture();ranged=mageRefineAdd('BLUE',0,-1200);player.y=-839;
 occultBeginCast(ranged,'SHOCK',player);occultReleaseCast(ranged);mageRefineTick(100);`);
ok('player.hp===100','The enlarged shock leaves a target just beyond its boundary unharmed');
P(`mageRefineFixture();ranged=mageRefineAdd('BLUE',0,-1200);player.y=-841;
 occultBeginCast(ranged,'SHOCK',player);
 buildings=[{x:0,y:-1000,w:100,h:1,isWall:true}];activeBuildings=buildings;invalidateColIndex();
 occultReleaseCast(ranged);mageRefineTick(100);`);
ok('player.hp===100','The larger electric field still respects solid cover');

P(`mageRefineFixture();ranged=mageRefineAdd('BLUE',0,-1300);player.y=-900;
 occultFireProjectile(ranged,'SHARD',Math.PI/2);
 buildings=[{x:0,y:-1130.25,w:100,h:1,isWall:true}];activeBuildings=buildings;invalidateColIndex();mageRefineTick(400);
 var wallBurst=occultSpellBursts.find(b=>b.reason==='wall');`);
ok('player.hp===100&&wallBurst&&wallBurst.y> -1134&&wallBurst.y< -1133.5',
 'A fast shard disperses at the near wall face and protects the target beyond it');

P(`mageRefineFixture();ranged=mageRefineAdd('BLUE',0,-1300);player.y=-850;
 var nearerAlly=new Character(0,-1150,false);nearerAlly.hp=100;nearerAlly.isFriendly=true;nearerAlly.isNeutral=false;enemiesList.push(nearerAlly);
 occultFireProjectile(ranged,'SHARD',Math.PI/2);mageRefineTick(400);`);
ok('nearerAlly.hp===73&&player.hp===100&&occultSpellBursts.some(b=>b.reason===\'impact\')',
 'Swept projectile contacts hit the nearest body and emit dispersion before reaching a farther target');

P(`mageRefineFixture();ranged=mageRefineAdd('RED');player.x=600;player.y=-600;
 occultFireProjectile(ranged,'FIREBALL',Math.PI/2);mageRefineTick(300);`);
ok("occultProjectiles.filter(p=>p.kind==='FIRE_FORK').length===3&&occultSpellBursts.some(b=>b.reason==='fork')",
 'A parent fireball disperses into a complete three-projectile fork');
P(`occultProjectiles.length=0;resetOccultSpellEffects();occultFireProjectile(ranged,'SHARD',Math.PI/2);
 occultProjectiles[0].ttlMs=1;mageRefineTick(20);`);
ok("occultProjectiles.length===0&&occultSpellBursts.some(b=>b.reason==='expire')",
 'Natural projectile expiry leaves a fading remnant');
P(`resetOccultSpellEffects();occultFireProjectile(ranged,'FIREBALL',Math.PI/2);ranged.hp=0;mageRefineTick(20);`);
ok("occultProjectiles.length===0&&occultSpellBursts.some(b=>b.reason==='cancel')",
 'The last projectile of a killed caster disperses visibly');
P('var pausedBursts=JSON.stringify(occultSpellBursts);isPaused=true;mageRefineTick(1000);');
ok('JSON.stringify(occultSpellBursts)===pausedBursts','Pause freezes lingering spell remnants');
P('isPaused=false;mageRefineTick(1000);');
ok('occultSpellBursts.length===0','Dead-owner remnants finish and release their state');

P(`mageRefineFixture();ranged=mageRefineAdd('BLUE');occultFireProjectile(ranged,'SHARD',Math.PI/2);
 var speedSave=JSON.parse(JSON.stringify(serializeOccultState()));restoreOccultState(speedSave);`);
ok("occultProjectiles[0].speed===560&&occultProjectiles[0].ttlMs===2600",
 'Save/load preserves the longer-lived faster projectile profile');
console.log('Mage refinement: '+checks+' ranged contact, hazard, dispersion and persistence checks passed.');

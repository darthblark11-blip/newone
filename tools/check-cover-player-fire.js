// Player fire input must remain responsive near cover. Real Character.fire()
// rounds still meet the physical wall, even if the muzzle extends beyond it.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>a===undefined?.5:Array.isArray(a)?a[0]:b===undefined?a*.5:(a+b)*.5;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
probe('window.playerFireSound=0;sfx.shoot=()=>playerFireSound++;sfx.shotgun=()=>playerFireSound++;');
function fresh(key='PISTOL',kind='HIGH',wall=true){
 probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 inOverworldView=false;window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
 viewLeft=viewTop=-10000;viewRight=viewBottom=10000;frameCount=100;deltaTime=1000/60;
 MAX_KILLS=100000;totalKills=totalShotsHit=totalShotsFired=0;
 bullets=[];particles=[];corpses=[];barrels=[];parkingCars=activeParkingCars=[];resetForestWildlife();
 setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
 leftStick={active:false,dx:0,dy:0};rightStick={active:true,dx:1,dy:0,dist:1};
 player=new Character(0,0,true);player.hp=player.maxHp=1000;player.shield=0;
 player.currentWeapon=WEAPONS.${key};player.ammo=60;player.aimAngle=player.moveAngle=0;
 player.isArmed=true;player.isMoving=false;player.gait=player.walkCycle=0;
 player.fireTimer=player.reloadTimer=player.meleeTimer=player.dashTimer=0;resetActorStance(player);setPlayerAimZone('BODY');
 window.fireVictim=new Character(55,8,false,'NORMAL');fireVictim.hp=fireVictim.maxHp=1000;
 fireVictim.isFriendly=fireVictim.isNeutral=false;fireVictim.shield=0;
 fireVictim.aimAngle=fireVictim.moveAngle=0;fireVictim.isMoving=false;fireVictim.walkCycle=fireVictim.gait=0;resetActorStance(fireVictim);
 enemiesList=[fireVictim];window.fireWall={x:18,y:0,w:2,h:200,${kind==='LOW'?'isLowWall':'isWall'}:true};
 buildings=activeBuildings=${wall?'[fireWall]':'[]'};invalidateColIndex();playerFireSound=0;`);
}
function tick(n=1){probe(`for(let i=0;i<${n};i++){frameCount++;updateBullets();}`);}
function acquire(aiming=true){probe(`for(let i=0;i<24;i++){frameCount++;updateActorCover(player,1000/60,6,0,${aiming});}`);}
function fire(key='PISTOL'){probe(`player.fire(player.aimAngle,${key==='BOW'?'({tension:.8,power:1,quality:1,dud:false})':'null'});`);}

fresh();acquire();
ok('the regression fixture has a sealed standing wall with no available peek',P("player.cover?.active&&player.cover.kind==='HIGH'&&!player.cover.validPeek&&!coverFireAllowed(player)"));
fire();
ok('a sealed wall never swallows player fire input or its normal shot feedback',P('player.ammo===59&&playerFireSound===1&&player.fireTimer===WEAPONS.PISTOL.fireCooldown&&player.muzzleFlash===3&&player.weaponKick===6&&bullets.length===1'));
tick();
ok('a barrel beyond the thin cover face still strikes the wall first',P('!bullets[0].active&&bullets[0].x>17&&bullets[0].x<19&&fireVictim.hp===1000'));

fresh();acquire();
probe('for(let i=0;i<90;i++){frameCount++;player.updatePlayer();updateBullets();}');
ok('held native fire keeps its cadence against a wall rather than cutting off',P('playerFireSound>=5&&player.ammo===60-playerFireSound&&totalShotsFired===playerFireSound'));

for(const key of ['PISTOL','SMG','ASSAULT_RIFLE','SHOTGUN','BOW','TASER']){
 fresh(key);fire(key);
 const rounds=key==='SHOTGUN'?4:1;
 ok(key+' fires beside a wall before automatic cover is acquired',P(`!player.cover&&player.ammo===59&&playerFireSound===1&&bullets.length===${rounds}`));
 tick();
 ok(key+' is intercepted before its beyond-wall muzzle can hit a target',P('bullets.every(b=>!b.active&&b.x>17&&b.x<19)&&fireVictim.hp===1000&&fireVictim.stunTimer===0'));
}

fresh();probe('fireWall.isTower=true;fireWall.hp=1000;fireVictim.x=27;');fire();tick();
ok('a close target cannot steal the wall impact even when its broad hit circle overlaps it',P('fireVictim.hp===1000&&fireVictim.decals.length===0&&fireWall.hp===980&&!bullets[0].active'));

fresh('PISTOL','LOW');acquire(false);
probe('frameCount++;updateActorCover(player,1000/60,0,0,true);');
ok('low-cover test fires during the actual rise rather than waiting for a fully raised pose',P("player.cover?.active&&player.cover.pop>0&&player.cover.pop<.5&&actorStance(player)==='CROUCH'"));
fire();
ok('a partially raised player receives the shot, sound, recoil and cooldown immediately',P('player.ammo===59&&playerFireSound===1&&player.weaponKick===6&&player.fireTimer>0'));
tick();
ok('a shot fired before clearing the low object hits that object without changing launch height',P('!bullets[0].active&&bullets[0].coverLaunchLow&&fireVictim.hp===1000'));
probe('for(let i=0;i<12;i++){frameCount++;updateActorCover(player,1000/60,0,0,true);}player.fireTimer=0;');fire();tick();
ok('firing continues above the same low object after the player rises',P('player.ammo===58&&playerFireSound===2&&!bullets[0].coverLaunchLow&&fireVictim.hp===980'));

fresh('PISTOL','HIGH',false);probe('fireVictim.x=2000;');
const expected=P('stanceMuzzleWorld(player,31,8)');fire();
ok('an unobstructed shot starts at the real rendered muzzle',P(`Math.abs(bullets[0].startX-${expected.x})<1e-8&&Math.abs(bullets[0].startY-${expected.y})<1e-8`));
tick();
ok('an unobstructed first flight keeps its normal speed and position',P(`bullets[0].active&&Math.abs(bullets[0].x-(${expected.x}+PLAYER_BULLET_SPEED))<1e-8&&Math.abs(bullets[0].y-${expected.y})<1e-8`));

fresh('DUAL_SMG');probe('fireWall.y=7;fireWall.h=8;fireVictim.x=2000;invalidateColIndex();');fire('DUAL_SMG');tick();
ok('dual SMGs still consume both rounds and play one discharge',P('player.ammo===58&&playerFireSound===1&&bullets.length===2'));
ok('one obstructed SMG cannot cancel the other clear barrel',P('!bullets[0].active&&bullets[0].x>17&&bullets[0].x<19&&bullets[1].active&&bullets[1].x>38&&bullets[1].y<0'));

fresh();fire();probe('window.reusedFireRound=bullets[0];');tick();
probe("buildings=activeBuildings=[];invalidateColIndex();fireVictim.x=2000;resetActorStance(player);player.fireTimer=0;");fire();
ok('the blocked round is reused instead of allocating another pool slot',P('bullets.length===1&&bullets[0]===reusedFireRound'));
tick();
ok('pooled reuse cannot carry its old wall impact into a later clear shot',P('bullets[0].active&&bullets[0].x>31&&!bullets[0]._coverLaunchImpact&&!bullets[0].coverLaunchPending'));

fresh();fire();
const frozen=P('JSON.stringify({x:bullets[0].x,y:bullets[0].y,px:bullets[0].prevX,py:bullets[0].prevY,l:bullets[0].l,pending:bullets[0].coverLaunchPending})');
probe('doTick=false;');tick(4);
ok('pause preserves a pending first-flight wall check',P('JSON.stringify({x:bullets[0].x,y:bullets[0].y,px:bullets[0].prevX,py:bullets[0].prevY,l:bullets[0].l,pending:bullets[0].coverLaunchPending})')===frozen);
probe('doTick=true;');tick();
ok('resuming resolves the pending physical wall impact once',P('!bullets[0].active&&fireVictim.hp===1000'));

fresh('ROCKET_LAUNCHER');
probe('window.playerFireRocketImpacts=[];window.playerFireNativeRocket=triggerRocketExplosion;triggerRocketExplosion=(...args)=>playerFireRocketImpacts.push(args);');
try{
 fire('ROCKET_LAUNCHER');tick();
 ok('a close-wall rocket still fires and dispatches its native explosion at the wall',P('player.ammo===59&&playerFireSound===1&&playerFireRocketImpacts.length===1&&playerFireRocketImpacts[0][0]>17&&playerFireRocketImpacts[0][0]<19&&!bullets[0].active'));
}finally{probe('triggerRocketExplosion=playerFireNativeRocket;');}

fresh();probe("fireVictim.x=2000;window.legacyFireRound=spawnBullet(60,0,0,true,'BODY',WEAPONS.PISTOL,player);");tick();
ok('legacy direct projectile spawns keep their explicit launch position',P('legacyFireRound.active&&legacyFireRound.x>60&&!legacyFireRound.coverLaunchPending'));

console.log(`${checks}/${checks} native player fire, wall impact, independent muzzle and pooled launch checks passed.`);

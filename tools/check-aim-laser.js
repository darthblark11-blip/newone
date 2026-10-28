// The guide predicts the same finite surfaces as actual low/torso/head rounds.
// Querying or painting it must not fire, roll injuries, damage or tick combat.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,seed=81421;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
const near=(a,b,tolerance=1e-6)=>Math.abs(a-b)<tolerance;
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
 return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
function stage(zone='BODY',stance='STAND',weapon='PISTOL',angle=0){
 probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
 inWorldBuildingMenu=inTravelMenu=inOverworldView=inUpgradeMenu=false;
 window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
 buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
 particles=[];bullets=[];corpses=[];enemiesList=[];invalidateColIndex();resetForestWildlife();resetShovelState();
 viewLeft=viewTop=-10000;viewRight=viewBottom=10000;frameCount++;deltaTime=1000/60;MAX_KILLS=100000;totalKills=0;
 setMeleeTool('NONE');jetpackUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
 leftStick={active:false,dx:0,dy:0};rightStick={active:true,dx:1,dy:0,dist:.4};
 player=new Character(0,0,true);player.hp=player.maxHp=1000;player.shield=0;
 player.isArmed=true;player.currentWeapon=WEAPONS.${weapon};player.ammo=100;
 player.aimAngle=player.moveAngle=${angle};player.isMoving=false;player.gait=0;
 player.muzzleFlash=player.reloadTimer=player.fireTimer=player.meleeTimer=player.weaponKick=0;
 resetActorStance(player,'${stance}');player.stance.proneAimBlend=1;setPlayerAimZone('${zone}');`);
}
function target(stance='STAND',x=140,y=8){
 probe(`window.laserVictim=new Character(${x},${y},false,'NORMAL');laserVictim.hp=laserVictim.maxHp=10000;
 laserVictim.isFriendly=laserVictim.isNeutral=false;laserVictim.aimAngle=laserVictim.moveAngle=0;
 laserVictim.isMoving=false;laserVictim.gait=laserVictim.walkCycle=0;resetActorStance(laserVictim,'${stance}');
 enemiesList.push(laserVictim);`);
}
function trace(index=0){
 probe(`window.laserGuide=tracePlayerAimLaser(player,${index});`);
 return P('({startX:laserGuide.startX,startY:laserGuide.startY,x:laserGuide.x,y:laserGuide.y,distance:laserGuide.distance,kind:laserGuide.kind,zone:laserGuide.zone,launchBlocked:laserGuide.launchBlocked})');
}
function actualContact(index=0){
 probe(`window.laserLaunch=aimLaserMuzzle(player,${index});window.laserRound=spawnBullet(laserLaunch.x,laserLaunch.y,player.aimAngle,
 true,playerAimTarget(),player.currentWeapon,player,null,true);
 for(let i=0;i<130&&laserRound.active;i++){frameCount++;updateBullets();}`);
 return P('({x:laserRound.x,y:laserRound.y,hp:enemiesList[0]&&enemiesList[0].hp,active:laserRound.active})');
}

stage();
ok('laser APIs are available',P("typeof tracePlayerAimLaser==='function'&&typeof aimLaserMuzzle==='function'&&typeof drawPlayerAimLaser==='function'"));
for(const [incoming,stance,hit]of [['HEAD','STAND',true],['HEAD','CROUCH',false],['HEAD','PRONE',false],
 ['BODY','STAND',true],['BODY','CROUCH',true],['BODY','PRONE',false],['LEGS','CROUCH',true],['LEGS','PRONE',true]]){
 stage(incoming);target(stance);const guide=trace();
 ok(`${incoming}/${stance} predicts the actual target height`,hit?guide.x<170:guide.x>700);
 if(hit){const contact=actualContact();ok(`${incoming}/${stance} laser ends at the actual bullet contact`,near(guide.x,contact.x)&&near(guide.y,contact.y));}
}
for(const offset of [0,-6,6,16]){
 stage('LEGS');target('STAND',140,8+offset);const guide=trace(),hit=Math.abs(offset)===6;
 ok(`standing low offset${offset} honors the two thin legs and their empty gap`,hit?guide.x<170:near(guide.distance,260));
 const contact=actualContact();ok(`standing low offset${offset} matches native hit/floor contact`,near(guide.x,contact.x)&&near(guide.y,contact.y));
}
for(const angle of [0,.63,Math.PI/2,-Math.PI/2,Math.PI]){
 stage('LEGS','STAND','PISTOL',angle);const guide=trace(),muzzle=P('aimLaserMuzzle(player,0)');
 ok(`low floor ${angle} is exactly13m beyond the physical muzzle`,near(Math.hypot(guide.x-muzzle.x,guide.y-muzzle.y),260));
 const contact=actualContact();ok(`low floor ${angle} matches the round's final partial step`,near(guide.x,contact.x)&&near(guide.y,contact.y));
}
// Array order must never make the guide select a farther contact first.
for(const incoming of ['HEAD','BODY','LEGS']){
 stage(incoming);target('STAND',240,incoming==='LEGS'?14:8);probe('window.farVictim=laserVictim;');
 target('STAND',130,incoming==='LEGS'?14:8);const nearGuide=trace();
 probe('enemiesList.reverse();');const reversed=trace();
 ok(`${incoming} chooses the nearest contact independently of roster order`,near(nearGuide.x,reversed.x)&&nearGuide.x<160);
}
stage('HEAD');target('PRONE',130,8);target('CROUCH',230,8);target('STAND',390,8);
ok('head guide passes above two low actors and reaches the standing actor',trace().x>380&&trace().x<400);
stage('BODY');target('PRONE',130,8);target('CROUCH',230,8);
ok('torso guide passes prone and reaches the crouched critical plane',trace().x>215&&trace().x<240);
for(const phase of ['SUPINE','SEATED'])for(const zone of ['HEAD','BODY','LEGS']){
 stage(zone);target('STAND');
 probe(`legInjurySerial=1;beginLegInjury(laserVictim,{a:0},0);
  laserVictim.legInjury.phase='${phase}';laserVictim.legInjury.phaseMs=0;
  laserVictim.legInjury.ageMs=1600;legInjurySetHeight(laserVictim);`);
 const guide=trace(),hit=zone==='LEGS'||phase==='SEATED'&&zone==='BODY';
 ok(`${phase}/${zone} guide follows the injury's current anatomical height`,hit?guide.x<180:guide.x>700);
 if(hit){
  ok(`${phase}/${zone} reports the resolved damage elevation`,guide.zone===(phase==='SUPINE'||zone==='BODY'?'HEAD':'BODY'));
  const contact=actualContact();ok(`${phase}/${zone} injury guide matches actual native contact`,near(guide.x,contact.x)&&near(guide.y,contact.y));
 }
}

for(const kind of ['HIGH','LOW','CAR','BARREL'])for(const zone of ['HEAD','BODY','LEGS']){
 stage(zone);
 if(kind==='CAR')probe('parkingCars=activeParkingCars=[{x:110,y:8,hp:1000}];');
 else if(kind==='BARREL')probe('barrels=[{x:110,y:8,hp:1000}];');
 else probe(`window.laserWall={x:110,y:8,w:6,h:100,${kind==='LOW'?'isLowWall':'isWall'}:true};buildings=activeBuildings=[laserWall];invalidateColIndex();`);
 const guide=trace(),blocked=kind==='HIGH'||zone==='LEGS'||kind==='BARREL'&&zone==='BODY';
 ok(`${kind}/${zone} uses the projectile's elevation-aware obstruction`,blocked?guide.x<140:guide.x>700);
 if(blocked){const contact=actualContact();
  // Barrels retain their original endpoint-only bullet test. The guide marks
  // that same circle's entry edge; the round retires on its first point inside.
  ok(`${kind}/${zone} laser stops on the native cover surface`,kind==='BARREL'
   ?near(guide.x,95)&&near(guide.y,8)&&Math.hypot(contact.x-110,contact.y-8)<15
   :near(guide.x,contact.x,1e-3)&&near(guide.y,contact.y,1e-3));
 }
}
stage('HEAD','CROUCH');probe('buildings=activeBuildings=[{x:110,y:8,w:6,h:100,isLowWall:true}];invalidateColIndex();');
ok('low launch height blocks even selected head shots at waist-high cover',trace().x<120);
stage('BODY');probe('buildings=activeBuildings=[{x:20,y:8,w:2,h:100,isWall:true}];invalidateColIndex();');
const launchGuide=trace(),launchContact=actualContact();
ok('a muzzle projecting through a wall cannot advertise a clear shot beyond it',launchGuide.launchBlocked&&launchGuide.x<22);
ok('blocked launch guide ends at the same wall as the native shot',near(launchGuide.x,launchContact.x,.002)&&near(launchGuide.y,launchContact.y,.002));

for(const flag of ['isFriendly','dead']){
 stage('BODY');target();probe(`laserVictim.${flag}=true;`);
 ok(flag+' actors cannot intercept the player guide',trace().x>700);
}
stage('BODY');target();probe('laserVictim.hp=0;');ok('zero-health actors do not intercept the guide',trace().x>700);

// Rendering and bullet fire share physical posed muzzle positions, including
// both independent SMGs, ordinary gait bob and all low stance mounts.
for(const stance of ['STAND','CROUCH','PRONE'])for(const weapon of ['PISTOL','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','REVOLVER','COACH_GUN','BOW'])for(const angle of [0,1.4]){
 stage('BODY',stance,weapon,angle);probe(`player.isMoving=${stance!=='PRONE'};player.walkCycle=1.1;`);
 const left=weapon==='DUAL_SMG'?2:1;
 for(let index=0;index<left;index++)probe(`window.expectedMuzzle${index}=aimLaserMuzzle(player,${index});`);
 probe(weapon==='BOW'?'player.fire(player.aimAngle,{tension:bowDrawAmount(player),quality:1,power:1,dud:false});':'player.fire(player.aimAngle);');
 for(let index=0;index<left;index++){
  const bulletIndex=weapon==='SHOTGUN'?0:index;
  ok(`${stance}/${weapon}/${angle}/${index} guide begins at the native barrel`,P(`Math.hypot(bullets[${bulletIndex}].startX-expectedMuzzle${index}.x,bullets[${bulletIndex}].startY-expectedMuzzle${index}.y)<1e-7`));
 }
}

stage('LEGS','PRONE','DUAL_SMG');target('CROUCH',160,8);
const before=P('JSON.stringify({ammo:player.ammo,fire:player.fireTimer,reload:player.reloadTimer,hp:laserVictim.hp,decals:laserVictim.decals,bullets:bullets.length,particles:particles.length,kills:totalKills,shots:totalShotsFired})');
const randomBefore=seed;
probe('for(let i=0;i<50;i++){tracePlayerAimLaser(player,0);tracePlayerAimLaser(player,1);}');
ok('repeated guide traces do not consume gameplay randomness',seed===randomBefore);
ok('traces do not fire, damage, roll wounds or advance combat',before===P('JSON.stringify({ammo:player.ammo,fire:player.fireTimer,reload:player.reloadTimer,hp:laserVictim.hp,decals:laserVictim.decals,bullets:bullets.length,particles:particles.length,kills:totalKills,shots:totalShotsFired})'));

console.log(`${checks}/${checks} aim laser height, finite range, native contacts, cover, muzzle and query purity checks passed.`);

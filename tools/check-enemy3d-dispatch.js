// Production dispatch contracts for the optional living human-enemy meshes.
// GPU pixels are covered by the browser check; this exercises real Character
// and stance painters while observing the shared renderer boundary.
const assert=require('node:assert/strict');
const {ctx,probe,mkG}=require('./harness');
const P=s=>probe('('+s+')');let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;};
probe(`isStoryMode=false;townsData={};startAtLevel(2);started=doTick=true;
 isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
 inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
 window.inNM0SecretOverlay=false;buildGhost=null;resetUndergroundRoute();
 setMeleeTool('NONE');swordPickedUp=false;frameCount=100;
 leftStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
 explosiveArmorUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
 buildings=activeBuildings=[];barrels=[];activeParkingCars=[];enemiesList=[];
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;
 globalThis.__enemyMeshPasses=[];
 Player3D.enabled=true;Player3D.draw=(snapshot,target,options)=>{__enemyMeshPasses.push({snapshot,target,options});return true;};`);

function fresh(type='NORMAL',extra=''){
 probe(`globalThis.meshEnemy=new Character(30,40,false,${JSON.stringify(type)});
  meshEnemy.isFriendly=false;meshEnemy.isNeutral=false;meshEnemy.isMoving=true;meshEnemy.isArmed=false;
  meshEnemy.currentWeapon=WEAPONS.PISTOL;meshEnemy.aimAngle=.4;meshEnemy.moveAngle=1.1;
  meshEnemy.gait=.6;meshEnemy.walkCycle=.9;
  meshEnemy.hitFlash=meshEnemy.muzzleFlash=meshEnemy.reloadTimer=meshEnemy.meleeTimer=0;
  meshEnemy.stunTimer=meshEnemy.skeletonTimer=0;meshEnemy.legInjury=null;meshEnemy.stunPose=null;
  resetActorStance(meshEnemy,'STAND');frameCount++;
  Player3D.enabled=true;Player3D.draw=(snapshot,target,options)=>{__enemyMeshPasses.push({snapshot,target,options});return true;};
  ${extra};__enemyMeshPasses.length=0;`);
}
function shown(label){
 const before=P('JSON.stringify([meshEnemy.isArmed,meshEnemy.ammo,meshEnemy.fireTimer,meshEnemy.reloadTimer,meshEnemy.meleeTimer,meshEnemy.aimAngle,meshEnemy.moveAngle])');
 probe('meshEnemy.show();');
 check(ctx.__enemyMeshPasses.length===1,label+' uses exactly one mesh draw');
 const pass=ctx.__enemyMeshPasses[0];
 check(pass.snapshot.parts.length>0,label+' resolves real mesh parts');
 check(pass.target===ctx.drawingContext,label+' preserves the current Canvas target');
 check(pass.options.enemy===true,label+' explicitly opts into the guarded enemy renderer');
 check(!pass.snapshot.identity.isPlayer,label+' retains enemy identity');
 check(P('JSON.stringify([meshEnemy.isArmed,meshEnemy.ammo,meshEnemy.fireTimer,meshEnemy.reloadTimer,meshEnemy.meleeTimer,meshEnemy.aimAngle,meshEnemy.moveAngle])')===before,
  label+' painting does not mutate combat state');
 return pass;
}

for(const type of ['NORMAL','FEMALE_PISTOL','MOLOTOV','ARMORED_STANDARD','BANDIT','NM0_ROOKIE','NM0_ROOKIE_F','NM0_GREY_FATIGUE','NM0_CITY_GUARD','MILITARY_NEUTRAL']){
 fresh(type);check(P('enemy3DLivingEligible(meshEnemy)'),type+' is an ordinary hostile human');shown(type);
}
for(const weapon of ['PISTOL','REVOLVER','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','COACH_GUN','ROCKET_LAUNCHER','PARTICLE_BEAM','BOW','TASER']){
 fresh('NORMAL',`meshEnemy.currentWeapon=WEAPONS.${weapon}`);const pass=shown(weapon);
 if(!process.argv.includes('--dispatch-only')){
  check(pass.snapshot.parts.some(p=>p.part==='weapon_primary'),weapon+' remains visible when native enemy.isArmed is false');
  check(P(`(()=>{const p=player3DPose(meshEnemy),m=aimLaserMuzzle(meshEnemy,0);return Math.hypot(p.sockets.muzzle.x+meshEnemy.x-m.x,p.sockets.muzzle.y+meshEnemy.y-m.y)<.001;})()`),weapon+' mesh muzzle agrees with native projectile origin');
 }
}
if(!process.argv.includes('--dispatch-only')){
 fresh('MOLOTOV');const bottle=shown('Molotov equipment');
 check(bottle.snapshot.parts.some(p=>p.mesh==='flask'),'Molotov enemy retains its held bottle');
 check(!bottle.snapshot.parts.some(p=>p.part==='weapon_primary'&&p.mesh==='pistol'),'Molotov equipment is not replaced with its bookkeeping pistol');
 fresh('ARMORED_STANDARD');const armored=shown('standard armored equipment');
 check(armored.snapshot.parts.some(p=>p.mesh==='helmet'||p.mesh==='visor'),'ordinary armored human retains visible head armor');
}

for(const type of ['BUG','SNAIL','SNAIL_HYBRID','COW','HORSE','ALIEN_GATOR','SAUCER','SAUCER_RED','ROBOT','ARMORED','AERIAL','AERIAL_PISTOL',
 'OCCULT_BLACK','OCCULT_RED','OCCULT_BLUE','OCCULT_ZOMBIE','DAD','SIA','NM0_SCIENTIST','FARMER_MALE','FARMER_FEMALE','COWBOY','COWGIRL','LOCAL_COP',
 'VILLAGER_MALE','VILLAGER_FEMALE','FRONTIER_PROSPECTOR','FRONTIER_RANCHHAND','FRONTIER_TRADER','FRONTIER_SMITH','FRONTIER_TRAVELER','FRONTIER_TOWNSWOMAN',
 'CITY_CITIZEN_M','CITY_CITIZEN_F','CITY_NEUTRAL_M','CITY_THUG_M']){
 fresh(type);check(!P('enemy3DLivingEligible(meshEnemy)'),type+' retains its native model');
 check(P('player3DDrawActor(meshEnemy,window,{enemy:true})===false'),type+' cannot bypass the shared enemy guard');
}
const excluded=[
 ['friendly','meshEnemy.isFriendly=true'],['neutral','meshEnemy.isNeutral=true'],['dead','meshEnemy.dead=true'],['zero HP','meshEnemy.hp=0'],
 ['corpse flag','meshEnemy.isCorpse=true'],['scientist flag','meshEnemy.isNM0Scientist=true'],['leg injury','meshEnemy.legInjury={}'],
 ['mounted special','meshEnemy.mounted=true'],['unarmed special','meshEnemy.isUnarmed=true'],
 ['knockout','meshEnemy.knockedOut=true'],['stun','meshEnemy.stunTimer=30'],['skeleton','meshEnemy.skeletonTimer=30'],['special melee','meshEnemy.meleeTimer=8'],
 ['prone','resetActorStance(meshEnemy,"PRONE")'],
 ['enter prone','meshEnemy.stance={from:1,to:2,value:1,elapsedMs:0,durationMs:300}'],
 ['leave prone','meshEnemy.stance={from:2,to:1,value:1,elapsedMs:200,durationMs:300}'],
 ['prone dive','meshEnemy.stance={from:0,to:2,value:0,elapsedMs:0,durationMs:420,dive:{enemy:true,landed:false}}'],
 ['boxing',"boxingEnter(meshEnemy,[],'WORLD')"]
];
for(const [label,setup] of excluded){fresh('NORMAL',setup);check(!P('enemy3DLivingEligible(meshEnemy)'),label+' stays native');
 check(P('player3DDrawActor(meshEnemy,window,{enemy:true})===false'),label+' cannot bypass shared dispatch');}
fresh('NORMAL','meshEnemy.stunPose={stale:true}');check(P('enemy3DLivingEligible(meshEnemy)'),'stale stun data does not hide a recovered enemy');
fresh('NORMAL','meshEnemy.stance={from:2,to:1,value:1,elapsedMs:300,durationMs:300}');
check(P('enemy3DLivingEligible(meshEnemy)'),'completed get-up may use crouch meshes despite persistent from=2');
fresh('NORMAL','resetActorStance(meshEnemy,"CROUCH")');shown('crouching human');
fresh();check(P('player3DDrawActor(meshEnemy,window,{mode:"NORMAL"})===false'),'enemy meshes require explicit caller opt-in');

// A real player control/upgrades state must not leak into an enemy snapshot.
fresh('NORMAL',`rightStick.active=true;rightStick.dist=1;
 explosiveArmorUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=true;`);
const identityBefore=P('JSON.stringify([meshEnemy.shirtCol.levels,meshEnemy.pantsCol.levels,meshEnemy.isArmed])');
const isolated=shown('player input isolation');
check(P('JSON.stringify([meshEnemy.shirtCol.levels,meshEnemy.pantsCol.levels,meshEnemy.isArmed])')===identityBefore,'player upgrades do not recolor or arm the enemy');
check(!isolated.snapshot.identity.isPlayer&&!isolated.snapshot.identity.ninjaSuit&&!isolated.snapshot.identity.chemistSuit&&!isolated.snapshot.identity.cowboySuit&&!isolated.snapshot.identity.jetpack,
 'player outfits and jetpack remain player-only');
probe('explosiveArmorUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;rightStick.active=false;');
fresh('MILITARY_NEUTRAL','meshEnemy.isMilitary=true;explosiveArmorUnlocked=true');
shown('existing military armor appearance');
check(P(`(()=>{const c=new Corpse(0,0,0,0,meshEnemy.shirtCol,meshEnemy.pantsCol,0,0,[],meshEnemy.currentWeapon,0,
 meshEnemy.eType,meshEnemy.bodyW,meshEnemy.bodyH,meshEnemy);
 return c.id.explosiveArmor&&c.sC.levels.slice(0,3).join(',')==='60,100,40'&&c.pC.levels.slice(0,3).join(',')==='139,115,85';})()`),
 'native military uniform assignment reaches frozen corpse colors');
probe('explosiveArmorUnlocked=false;');

// Native overlays remain outside the mesh, and no enemy receives a player laser.
fresh('NORMAL','meshEnemy.reloadTimer=45;meshEnemy.hitFlash=3');
const oldArc=ctx.arc,oldLaser=ctx.tracePlayerAimLaser,oldTriangle=ctx.triangle,oldBegin=ctx.beginShape;
let arcs=0,lasers=0,triangles=0,beginShapes=0;
ctx.arc=(...a)=>{arcs++;return oldArc(...a);};ctx.tracePlayerAimLaser=(...a)=>{lasers++;return oldLaser(...a);};
ctx.triangle=(...a)=>{triangles++;return oldTriangle(...a);};
ctx.beginShape=(...a)=>{beginShapes++;return oldBegin(...a);};
try{
 shown('reload overlay');check(arcs===1,'native reload ring draws once');check(P('meshEnemy.hitFlash')===2,'successful mesh path consumes hit flash once');
 fresh('NORMAL','meshEnemy.muzzleFlash=3;meshEnemy.hitFlash=3;rightStick.active=true');
 shown('enemy muzzle flash');
 check(triangles>0||beginShapes>0,'enemy muzzle flash survives replacement');
 check(lasers===0,'enemy meshes never draw the player aim laser');check(P('meshEnemy.hitFlash')===2,'muzzle path consumes hit flash once');
}finally{ctx.arc=oldArc;ctx.tracePlayerAimLaser=oldLaser;ctx.triangle=oldTriangle;ctx.beginShape=oldBegin;probe('rightStick.active=false;');}

// Injury/stun dispatch happens before the ordinary human replacement slot.
for(const [field,painter] of [['legInjury','drawLegInjuryFigure'],['stunTimer','drawStunnedFigure']]){
 fresh('NORMAL',field==='legInjury'?'meshEnemy.legInjury={}':'meshEnemy.stunTimer=20');
 const old=ctx[painter];let native=0;ctx[painter]=()=>{native++;return true;};
 try{probe('meshEnemy.show();');}finally{ctx[painter]=old;}
 check(native===1&&ctx.__enemyMeshPasses.length===0,field+' remains on its production native path');
}
fresh('NORMAL','resetActorStance(meshEnemy,"PRONE");meshEnemy.isArmed=true;meshEnemy.muzzleFlash=3');
probe('meshEnemy.show();');check(ctx.__enemyMeshPasses.length===0,'prone firing stays native through Character.show');
fresh();ctx.__corpseTarget=mkG();
probe(`var meshEnemyCorpse=new Corpse(0,0,0,0,meshEnemy.shirtCol,meshEnemy.pantsCol,0,0,[],meshEnemy.currentWeapon,0,meshEnemy.eType,meshEnemy.bodyW,meshEnemy.bodyH,meshEnemy);
 meshEnemyCorpse.paint(__corpseTarget);`);
check(ctx.__enemyMeshPasses.length===0,'enemy corpses retain the native corpse painter');

for(const draw of ['()=>false',"()=>{throw Error('lost enemy context');}"]){
 fresh('NORMAL','meshEnemy.hitFlash=3');probe('Player3D.draw='+draw+';meshEnemy.show();');
 check(P('meshEnemy.hitFlash')===2,'unavailable enemy mesh falls back and consumes hit flash once');
 check(ctx.__enemyMeshPasses.length===0,'fallback does not partially paint an enemy mesh');
}
console.log(checks+' enemy mesh scope, dispatch, overlays, identity and fallback checks passed');

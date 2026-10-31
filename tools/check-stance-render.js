// Stance art and physical muzzle origins must use one root-local transform.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=false;
 currentLevel=currentBiome=2;BIOME_ACTIVE=false;window.inNM0SecretOverlay=false;
 buildings=activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
 leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
 setMeleeTool('NONE');window.milLvl=1;player=new Character(70,90,true);player.isArmed=true;
 player.aimHold=14;player.ammo=30;player.reloadTimer=0;player.meleeTimer=0;player.dashTimer=0;`);
for(const name of ['STAND','CROUCH','PRONE'])for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
 probe(`player.aimAngle=${angle};player.moveAngle=${angle};resetActorStance(player,'${name}');`);
 for(const key of ['PISTOL','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','ROCKET_LAUNCHER','REVOLVER','COACH_GUN','BOW']){
  const x=key==='BOW'?47-9*.8:['ASSAULT_RIFLE','SHOTGUN','ROCKET_LAUNCHER','REVOLVER'].includes(key)?47:['SMG','DUAL_SMG'].includes(key)?38:31;
  const y=key==='BOW'?0:['ASSAULT_RIFLE','SHOTGUN','ROCKET_LAUNCHER'].includes(key)?6:['SMG','DUAL_SMG','REVOLVER'].includes(key)?11:8;
  probe(`player.currentWeapon=WEAPONS.${key};player.ammo=30;player.reloadTimer=player.fireTimer=0;bullets=[];
    var expectedStanceMuzzle=stanceMuzzleWorld(player,player.x+Math.cos(player.aimAngle)*${x}-Math.sin(player.aimAngle)*${y},player.y+Math.sin(player.aimAngle)*${x}+Math.cos(player.aimAngle)*${y});
    player.fire(player.aimAngle,${key==='BOW'?'({tension:.8,power:1,quality:1,dud:false})':'null'});`);
  ok(`${name} ${key} at ${angle} fires from its posed muzzle`,P('bullets.length>0 && Math.abs(bullets[0].startX-expectedStanceMuzzle.x)<1e-8 && Math.abs(bullets[0].startY-expectedStanceMuzzle.y)<1e-8'));
 }
}
probe(`player.aimAngle=0;resetActorStance(player,'STAND');var standAnchor=actorStanceUIAnchor(player);
 resetActorStance(player,'CROUCH');var crouchAnchor=actorStanceUIAnchor(player);var crouchPoint=stanceLocalPoint(player,10,10);
 resetActorStance(player,'PRONE');var proneAnchor=actorStanceUIAnchor(player);var pronePoint=stanceLocalPoint(player,10,10);`);
ok('crouch weapon mount preserves equal forward and shoulder scale',P('Math.abs(crouchPoint.x-crouchPoint.y)<1e-8 && crouchPoint.x>7 && crouchPoint.x<10'));
ok('prone rigid weapon mount retains a finite uniform scale',P('Number.isFinite(pronePoint.x+pronePoint.y)&&stanceWeaponMount(player).scale>.7&&stanceWeaponMount(player).scale<1'));
ok('floating stance UI descends with the body',P('crouchAnchor.y>standAnchor.y && proneAnchor.y>crouchAnchor.y'));
let depth=0,minDepth=0;
ctx.push=()=>{depth++;};ctx.pop=()=>{depth--;minDepth=Math.min(minDepth,depth);};
for(const name of ['STAND','CROUCH','PRONE'])for(const key of ['PISTOL','ASSAULT_RIFLE','SHOTGUN','BOW','REVOLVER']){
 probe(`resetActorStance(player,'${name}');player.currentWeapon=WEAPONS.${key};player.muzzleFlash=0;player.reloadTimer=0;player.show();`);
 ok(`${name} ${key} figure balances its native canvas state`,depth===0&&minDepth===0);
}
probe(`resetActorStance(player,'PRONE');player.hitFlash=3;player.show();`);
ok('prone hit flash recovers instead of leaving the body white',P('player.hitFlash===2'));
let reloads=0,actions=[];
const reload=ctx.drawOneHandReload,action=ctx.drawLeftHandAction;
ctx.drawOneHandReload=(...args)=>{reloads++;return reload(...args);};
ctx.drawLeftHandAction=(...args)=>{actions.push(args[1]);return action(...args);};
probe(`player.currentWeapon=WEAPONS.PISTOL;player.reloadTimer=45;player.show();
 player.reloadTimer=0;chemistSuitUnlocked=true;player.cannonCharge=60;player.show();
 player.cannonCharge=0;isCooking=true;player.show();isCooking=false;chemistSuitUnlocked=false;`);
ok('prone reload reuses the native magazine/hand animation',reloads===1);
ok('prone support actions retain the cannon and held flask',actions.includes(2)&&actions.includes(1));
ctx.drawOneHandReload=reload;ctx.drawLeftHandAction=action;
probe(`BIOME_ACTIVE=true;frameCount++;player.muzzleFlash=3;var stanceLights=sceneEmitters();
 var stanceTorch=stanceLights.find(e=>e.aim!==undefined),stanceFlash=stanceLights.find(e=>e.r===MUZZLE_FLASH_R);
 var stanceLightPoint=stanceMuzzleWorld(player,player.x+31,player.y+8);`);
ok('prone torch and flash move to the physical barrel at floor height',
  P('stanceTorch && stanceFlash && Math.abs(stanceTorch.x-stanceLightPoint.x)<1e-8 && Math.abs(stanceFlash.y-stanceLightPoint.y)<1e-8 && stanceTorch.z<3 && stanceFlash.z<3'));
const labels=[],origins=[],oldText=ctx.text,oldTranslate=ctx.translate;
ctx.text=(...args)=>labels.push(args);ctx.translate=(...args)=>origins.push(args);
probe(`recordStanceDamage(player,20,'HEAD');drawCombatStanceUI(player,actorStancePose(player));`);
ok('critical damage numbers follow the current lowered head anchor',labels.some(a=>a[0]==='CRIT 20')&&
  origins.some(a=>Math.abs(a[0]-P('actorStanceUIAnchor(player).x-player.x'))<1e-8&&Math.abs(a[1]-P('actorStanceUIAnchor(player).y-player.y'))<1e-8));
ctx.text=oldText;ctx.translate=oldTranslate;
probe(`isPaused=true;updateActorStance(player,100);`);
ok('pausing freezes damage feedback alongside its stance',P('player.stanceDamage.leftMs===500'));
probe(`isPaused=false;updateActorStance(player,100);recordStanceDamage(player,10,'BODY');`);
ok('rapid follow-up hits merge actual damage without losing a critical cue',P('player.stanceDamage.amount===30&&player.stanceDamage.critical'));
probe(`for(let i=0;i<5;i++)updateActorStance(player,100);`);
ok('damage feedback expires through active combat updates',P('player.stanceDamage.leftMs===0'));
const shieldRings=[],oldEllipse=ctx.ellipse;
ctx.ellipse=(...args)=>shieldRings.push(args);
probe(`player.shieldFlashTimer=10;player.shieldBurstTimer=15;player.show();`);
ok('low stances retain shield absorption and break feedback without consuming timers',
  shieldRings.filter(a=>a[0]===-6).length>=6&&P('player.shieldFlashTimer===10&&player.shieldBurstTimer===15'));
ctx.ellipse=oldEllipse;
probe('player.shieldFlashTimer=player.shieldBurstTimer=0;');
let blades=0,picks=0,swings=0;
const oldBlade=ctx.drawSwordBlade,oldPick=ctx.drawPickHeadSolid,oldSwing=ctx.drawSwordSwing;
ctx.drawSwordBlade=(...args)=>{blades++;return oldBlade(...args);};
ctx.drawPickHeadSolid=(...args)=>{picks++;return oldPick(...args);};
ctx.drawSwordSwing=(...args)=>{swings++;return oldSwing(...args);};
probe(`swordPickedUp=true;window.pickaxeOwned=true;player.isArmed=false;setMeleeTool('SWORD');player.show();player.meleeTimer=12;player.show();
 player.meleeTimer=0;setMeleeTool('PICKAXE');player.show();setMeleeTool('NONE');player.isArmed=true;`);
ok('lowered bodies retain carried melee equipment and the native swing delegate',blades>=2&&picks===1&&swings===1);
ctx.drawSwordBlade=oldBlade;ctx.drawPickHeadSolid=oldPick;ctx.drawSwordSwing=oldSwing;
console.log(`${checks}/${checks} stance muzzle, pose, anchor and native painter checks passed`);

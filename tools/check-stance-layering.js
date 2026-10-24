// Trace actual low-stance painting, including delegates that own complete
// sleeves. The final body pass must cover arms and equipment only once.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=source=>probe('('+source+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=false;
 inLvl4Cutscene=inUpgradeMenu=false;currentLevel=currentBiome=2;BIOME_ACTIVE=false;
 window.inNM0SecretOverlay=false;buildGhost=null;resetUndergroundRoute();
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:1,dy:0};
 buildings=activeBuildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();
 swordPickedUp=true;window.pickaxeOwned=true;jetpackUnlocked=false;
 ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;`);
assert.equal(typeof ctx.drawCombatStanceBody,'function','the low stance body has a pure final painting pass');

const saved={};
for(const name of ['push','pop','figureCelLimb','figureCelOval','drawCombatStanceBody',
 'drawFigureHead','carryHandGun','drawLongGunSolid','drawHuntingBow','drawOneHandReload',
 'reloadArm','drawLeftHandAction','drawSwordSwing','drawSwordBlade','drawPickHeadSolid','emit'])saved[name]=ctx[name];
let events=[],depth=0,minDepth=0,insideBody=false,emissions=0;
ctx.push=(...args)=>{depth++;return saved.push(...args);};
ctx.pop=(...args)=>{depth--;minDepth=Math.min(minDepth,depth);return saved.pop(...args);};
ctx.figureCelLimb=(...args)=>{
 if(!insideBody)events.push('limb');
 return saved.figureCelLimb(...args);
};
ctx.figureCelOval=(...args)=>{
 if(!insideBody&&(Math.abs(args[3]-6.3)<1e-8||Math.abs(args[3]-P('figureRig(player.bodyW,player.bodyH).hand'))<1e-8)&&Math.abs(args[3]-args[4])<1e-8)events.push('palm');
 return saved.figureCelOval(...args);
};
ctx.drawCombatStanceBody=(...args)=>{
 events.push('body:start');insideBody=true;
 try{return saved.drawCombatStanceBody(...args);}finally{insideBody=false;events.push('body:end');}
};
ctx.drawFigureHead=(...args)=>{
 events.push(insideBody?'head:covered':'head:late');return saved.drawFigureHead(...args);
};
for(const name of ['carryHandGun','drawLongGunSolid','drawHuntingBow','drawSwordBlade','drawPickHeadSolid'])
 ctx[name]=(...args)=>{events.push('equipment');return saved[name](...args);};
for(const name of ['drawOneHandReload','reloadArm','drawLeftHandAction','drawSwordSwing'])
 ctx[name]=(...args)=>{events.push(name);return saved[name](...args);};
ctx.emit=(...args)=>{emissions++;return saved.emit(...args);};

const scenarios=[
 {label:'neutral pistol',weapon:'PISTOL'},
 {label:'dual SMGs',weapon:'DUAL_SMG'},
 {label:'aimed rifle',weapon:'ASSAULT_RIFLE',aim:true},
 {label:'neutral shotgun',weapon:'SHOTGUN'},
 {label:'pistol reload',weapon:'PISTOL',reload:45,delegate:'drawOneHandReload'},
 {label:'rifle reload',weapon:'ASSAULT_RIFLE',reload:45,delegate:'reloadArm'},
 {label:'chemist cannon',weapon:'ASSAULT_RIFLE',cannon:true,delegate:'drawLeftHandAction'},
 {label:'held flask',weapon:'PISTOL',flask:true,delegate:'drawLeftHandAction'},
 {label:'sword attack',weapon:'PISTOL',tool:'SWORD',attack:true,delegate:'drawSwordSwing'},
 {label:'carried pickaxe',weapon:'PISTOL',tool:'PICKAXE'}
];
try{
 for(const stance of ['CROUCH','PRONE'])for(const scenario of scenarios){
  events=[];emissions=depth=minDepth=0;insideBody=false;
  probe(`player=new Character(70,90,true);resetActorStance(player,'${stance}');
   player.isArmed=${!scenario.tool};player.currentWeapon=WEAPONS.${scenario.weapon};
   player.isMoving=true;player.walkCycle=1.7;player.gait=.5;player.aimAngle=0;
   player.aimHold=${scenario.aim?14:0};player.hitFlash=3;player.ammo=30;
   player.fireTimer=7;player.reloadTimer=${scenario.reload||0};player.meleeTimer=${scenario.attack?12:0};
   player.meleePhase=1;player.dashTimer=player.throwAnimTimer=0;player.cannonCharge=${scenario.cannon?60:0};
   chemistSuitUnlocked=${!!(scenario.cannon||scenario.flask)};isCooking=${!!scenario.flask};
   cannonInputHeld=false;setMeleeTool('${scenario.tool||'NONE'}');frameCount=303;`);
  const before=P('({ammo:player.ammo,fire:player.fireTimer,reload:player.reloadTimer,melee:player.meleeTimer,charge:player.cannonCharge})');
  probe('player.show();');
  const label=stance+' '+scenario.label,start=events.indexOf('body:start'),end=events.indexOf('body:end');
  const positions=kind=>events.flatMap((event,index)=>event===kind?[index]:[]);
  ok(label+' draws the body and head once after the arm pass',
   positions('body:start').length===1&&positions('body:end').length===1&&
   positions('head:covered').length===1&&!events.includes('head:late')&&
   positions('limb').length>=2&&positions('limb').every(index=>index<start)&&end>start);
  ok(label+' leaves no weapon or hand painting over the finished body',
   positions('equipment').length>=1&&positions('equipment').every(index=>index<start)&&
   positions('palm').length>=1&&positions('palm').every(index=>index<start));
  if(!scenario.tool)ok(label+' paints every palm below the firearm',
   Math.max(...positions('palm'))<Math.min(...positions('equipment')));
  ok(label+' preserves combat timers and consumes one hit-flash frame',
   P('player.hitFlash===2')&&JSON.stringify(before)===JSON.stringify(P('({ammo:player.ammo,fire:player.fireTimer,reload:player.reloadTimer,melee:player.meleeTimer,charge:player.cannonCharge})')));
  ok(label+' restores painter state',depth===0&&minDepth===0);
  if(scenario.delegate)ok(label+' executes its complete-arm delegate exactly once',positions(scenario.delegate).length===1);
  if(scenario.cannon)ok(label+' emits a single native charge particle batch',emissions===1);
 }
}finally{Object.assign(ctx,saved);}

let anchorsInside=true;
for(const stance of ['CROUCH','PRONE'])for(const phase of [0,.6,1.7,3.1,4.8]){
 probe(`resetActorStance(player,'${stance}');player.isMoving=true;player.walkCycle=${phase};player.meleeTimer=0;player.cannonCharge=0;
  setMeleeTool('NONE');chemistSuitUnlocked=isCooking=false;`);
 const b=P('stanceBodyPose(player)'),co=Math.cos(b.yaw),si=Math.sin(b.yaw);
 for(const joint of b.joints){
  const dx=joint.shoulder.x-b.chestX,dy=joint.shoulder.y,x=co*dx+si*dy,y=-si*dx+co*dy;
  anchorsInside&&=(x/(b.torsoLength*.5))**2+(y/(b.torsoWidth*.5))**2<1;
 }
}
ok('both shoulder roots stay inside the body contour throughout the crawl',anchorsInside);
const packRects=[],packQuads=[],packG={};
for(const key of ['push','pop','stroke','strokeWeight','fill','noStroke','line'])packG[key]=()=>{};
packG.rect=(...args)=>packRects.push(args);
packG.quad=(...args)=>packQuads.push(args);
probe('jetpackUnlocked=true;');
ctx.__stancePackG=packG;
probe('drawStanceDashPack(__stancePackG,player,{floor:0});');const side=packRects[0];packRects.length=0;
probe('drawStanceDashPack(__stancePackG,player,{floor:1});');
const full=P('stanceDashPackMesh({floor:1}).bounds');
ok('prone reveals the broad pack face with its inset surface and drive details',
  full.maxX-full.minX>side[2]*1.5&&full.maxY-full.minY>=side[3]&&packQuads.length>=12);
packRects.length=packQuads.length=0;probe('jetpackUnlocked=false;drawStanceDashPack(__stancePackG,player,{floor:1});');
ok('the dash pack is drawn only when the upgrade is owned',packRects.length===0&&packQuads.length===0);
delete ctx.__stancePackG;
console.log(`${checks}/${checks} low stance body, sleeve, gun and action layering checks passed`);

// The actual standing barrel turns with angular momentum; shots and light
// follow that barrel, while lower stances and dedicated actions retain input.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
ctx.navigator.getGamepads=()=>[];
function fresh(angle=0){
 probe(`resetRunState();currentLevel=currentBiome=2;BIOME_ACTIVE=false;
  started=doTick=true;isPaused=isDead=isWin=killcamMode=false;isStoryMode=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
  inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
  window.inNM0SecretOverlay=false;buildGhost=null;resetUndergroundRoute();
  buildings=activeBuildings=[];barrels=[];activeParkingCars=[];enemiesList=[];bullets=[];
  invalidateColIndex();setMeleeTool('NONE');window.shovelOwned=false;
  chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=false;
  isCooking=meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;
  leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:313,y:690}};
  player=new Character(70,90,true);player.aimAngle=player.moveAngle=${angle};
  player.isArmed=true;player.currentWeapon=WEAPONS.PISTOL;player.ammo=30;
  player.aimHold=player.meleeTimer=player.reloadTimer=player.dashTimer=player.muzzleFlash=0;
  resetActorStance(player,'STAND');window.isDesktop=false;frameCount=100;deltaTime=1000/60;`);
}
function target(angle,fire=false){probe(`rightStick.active=true;rightStick.dx=Math.cos(${angle});rightStick.dy=Math.sin(${angle});rightStick.dist=${fire?1:.4};`);}
function tick(count=1,ms=1000/60){for(let i=0;i<count;i++)probe(`frameCount++;deltaTime=${ms};player.updatePlayer();`);}
function turn(angle,ms=1000/60){probe(`frameCount++;player.aimAngle=standingAimHeading(player,${angle},${ms});`);return P('player.aimAngle');}

fresh();target(Math.PI/2);tick();
const first=P('player.aimAngle'),firstVelocity=P('player._standingAim.velocity');
ok('the first abrupt standing aim frame advances without snapping to its target',first>0&&first<.15);
tick();
ok('shoulder turn accelerates smoothly rather than starting at full angular speed',P('player._standingAim.velocity')>firstVelocity);
let bounded=true,nonOvershooting=true,previous=P('player.aimAngle');
for(let i=0;i<80;i++){
 tick();const now=P('player.aimAngle');bounded&&=Math.abs(wrap(now-previous))<=11/60+1e-8;
 nonOvershooting&&=now>=previous-1e-8&&now<=Math.PI/2+1e-8;previous=now;
}
ok('standing aim remains bounded and settles exactly without overshooting',bounded&&nonOvershooting&&Math.abs(previous-Math.PI/2)<1e-8);
fresh(Math.PI-.04);target(-Math.PI+.04);tick(80);
ok('crossing the angle seam takes the short arc instead of a full revolution',Math.abs(wrap(P('player.aimAngle')-(-Math.PI+.04)))<1e-8);
fresh();target(Math.PI);tick(7);const velocity=P('player._standingAim.velocity');
target(-Math.PI/2);tick();
ok('reversing a turn brakes existing shoulder momentum instead of flipping velocity',
 velocity>0&&P('player._standingAim.velocity')>0&&P('player._standingAim.velocity')<velocity);
tick(80);ok('a reversed turn still reaches its new requested heading',Math.abs(wrap(P('player.aimAngle')+Math.PI/2))<1e-8);

fresh();target(Math.PI/2);const once=turn(Math.PI/2),state=P('JSON.stringify(player._standingAim)');
probe('player.aimAngle=standingAimHeading(player,Math.PI/2,1000/60);');
ok('two heading consumers cannot advance the same simulation frame twice',P('player.aimAngle')===once&&P('JSON.stringify(player._standingAim)')===state);
probe('isPaused=true;frameCount++;player.aimAngle=standingAimHeading(player,Math.PI,100);');
ok('pause freezes standing aim velocity and heading',P('player.aimAngle')===once&&P('JSON.stringify(player._standingAim)')===state);
probe('isPaused=false;doTick=false;frameCount++;player.aimAngle=standingAimHeading(player,Math.PI,100);');
ok('a suspended simulation never advances the standing aim turn',P('player.aimAngle')===once&&P('JSON.stringify(player._standingAim)')===state);

fresh();target(Math.PI/2);tick(4);probe('rightStick.active=false;');tick(80);
ok('releasing the aim input retires the aimed-turn filter after its brief hold',P('!standingAimEligible(player)&&player._standingAim===null'));
fresh();probe('leftStick.active=true;leftStick.dx=0;leftStick.dy=1;');tick();
ok('un-aimed locomotion retains its original immediate movement facing',P('Math.abs(player.aimAngle-Math.PI/2)<1e-8&&player._standingAim===null'));

fresh();target(Math.PI/2,true);tick();
const firing=P('({a:player.aimAngle,x:player.x,y:player.y,b:bullets[0],ammo:player.ammo})');
const muzzle={x:firing.x+Math.cos(firing.a)*31-Math.sin(firing.a)*8,y:firing.y+Math.sin(firing.a)*31+Math.cos(firing.a)*8};
ok('a shot during the turn fires immediately along the intermediate barrel',firing.ammo===29&&firing.b&&Math.abs(firing.b.a-firing.a)<1e-8);
ok('turning gunfire starts at the actual rotated pistol muzzle',Math.hypot(firing.b.startX-muzzle.x,firing.b.startY-muzzle.y)<1e-8);
probe('BIOME_ACTIVE=true;frameCount++;');const lights=P('sceneEmitters()'),torch=lights.find(e=>e.aim!==undefined);
ok('the weapon torch follows the same turning barrel and muzzle',torch&&Math.abs(torch.aim-firing.a)<1e-8&&Math.hypot(torch.x-muzzle.x,torch.y-muzzle.y)<1e-8);
fresh();probe('player.aimAngle=.7;player.fire(.7);');
ok('a direct weapon fire call retains its explicit heading without a control filter',P('bullets.length===1&&Math.abs(bullets[0].a-.7)<1e-8&&player._standingAim===undefined'));

for(const stance of ['CROUCH','PRONE']){
 fresh();probe(`resetActorStance(player,'${stance}');`);target(Math.PI/2);tick();
 ok(stance+' retains its established immediate aim response',Math.abs(P('player.aimAngle')-Math.PI/2)<1e-8);
}
for(const [label,setup] of [
 ['held grenade','isCooking=true;'],['throw follow-through','player.throwAnimTimer=12;'],
 ['chemist cannon','chemistSuitUnlocked=true;player.cannonCharge=40;'],
 ['mounted rider','player.mounted=true;'],['dash','player.dashTimer=10;'],
 ['melee','player.meleeTimer=10;'],['building placement',"buildGhost={};"],
 ['crouch transition',"player.stance.to=1;"],['scripted cutscene','inCutscene=true;']]){
 fresh();probe(setup);
 ok(label+' keeps its dedicated heading path',P('standingAimHeading(player,Math.PI/2,1000/60)===Math.PI/2&&player._standingAim===null'));
}

// A smoother body may not erase a genuinely abrupt bow draw gesture.
fresh();probe('player.currentWeapon=WEAPONS.BOW;player.ammo=24;');target(0);
for(let i=1;i<=54;i++){probe(`rightStick.dist=.2+.72*${i}/54;rightStick.dx=-rightStick.dist;rightStick.dy=0;`);tick();}
const good=P('player.bowDrawState.quality');
probe('rightStick.dx=0;rightStick.dy=-rightStick.dist;');tick();
ok('bow quality still sees an abrupt raw input jerk while the body turns smoothly',
 good>.99&&P('player.bowDrawState.quality')<good*.5&&P('player.aimAngle>0&&player.aimAngle<Math.PI/2'));
const releaseAngle=P('player.aimAngle');probe('rightStick.active=false;');tick();
ok('a neutral bow release uses the current visible barrel heading and fires once',
 P('bullets.length===1&&bullets[0].isArrow&&Math.abs(bullets[0].a-player.aimAngle)<1e-8')&&P('player.aimAngle')>=releaseAngle);
console.log(`${checks}/${checks} standing aim momentum, native shots, light, bow and control checks passed`);

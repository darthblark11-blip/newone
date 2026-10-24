// Actual player updates must freeze voluntary prone movement on the first aim
// frame while the feet/collision capsule retain their anchored floor heading.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=source=>probe('('+source+')');
let checks=0,seed=94121,slot=null;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
const near=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))<1e-8;
ctx.setTimeout=()=>0;
ctx.localStorage={getItem:()=>slot,setItem:(key,value)=>{slot=value;},removeItem:()=>{slot=null;}};
ctx.random=(a,b)=>{
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=seed/4294967296;
 return a===undefined?n:Array.isArray(a)?a[Math.floor(n*a.length)]:b===undefined?n*a:a+n*(b-a);
};
function fresh(heading=0){
 probe(`resetRunState();started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
  currentLevel=currentBiome=8;BIOME_ACTIVE=false;isStoryMode=true;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
  inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
  window.inNM0SecretOverlay=false;buildGhost=null;resetUndergroundRoute();
  buildings=activeBuildings=[];activeParkingCars=parkingCars=[];barrels=[];enemiesList=[];bullets=[];
  invalidateColIndex();setMeleeTool('NONE');window.pickaxeOwned=true;
  chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
  meleeInputHeld=cannonInputHeld=grenadeInputHeld=isCooking=false;
  leftStick={active:true,dx:1,dy:0,base:{x:80,y:640}};
  rightStick={active:false,dx:0,dy:-1,dist:0,base:{x:313,y:690}};
  player=new Character(0,0,true);player.aimAngle=player.moveAngle=${heading};
  player.isArmed=true;player.currentWeapon=WEAPONS.PISTOL;player.ammo=30;
  player.hp=player.maxHp=1000;player.shield=100;player.gait=0;player.aimHold=0;
  player.meleeTimer=player.fireTimer=player.reloadTimer=player.muzzleFlash=0;
  player.dashTimer=player.throwAnimTimer=player.cannonCharge=0;
  resetActorStance(player,'PRONE');frameCount=100;deltaTime=1000/60;`);
}
function step(count=1){for(let i=0;i<count;i++)probe('frameCount++;player.updatePlayer();');}

fresh();step();
ok('a neutral prone player crawls through the real movement update',P('player.x>0&&player.isMoving&&player.walkCycle>0'));
const before=P('({x:player.x,y:player.y,cycle:player.walkCycle,gait:player.gait})');
probe('rightStick.active=true;rightStick.dx=0;rightStick.dy=-1;rightStick.dist=.45;');step();
ok('the first aim frame locks position before any requested crawl or mantle',P('player.x')===before.x&&P('player.y')===before.y);
ok('aim lock stops leg cadence and eases out locomotion',
 P('!player.isMoving')&&P('player.walkCycle')===before.cycle&&P('player.gait')<before.gait);
ok('the gun turns independently of the anchored feet',near(P('player.aimAngle'),-Math.PI/2)&&near(P('stanceFacingAngle(player)'),0));
ok('aim presentation begins a gradual roll blend instead of teleporting it',P('player.stance.proneAimBlend>0&&player.stance.proneAimBlend<1'));
probe('rightStick.dist=1;');step();
ok('aiming and firing still spend ammunition and create the real shot',P('player.ammo===29&&bullets.length===1'));
ok('the emitted shot keeps the requested gun direction',near(P('bullets[0].a'),-Math.PI/2));
ok('shooting retains the same root and floor heading',P('player.x')===before.x&&P('player.y')===before.y&&near(P('stanceFacingAngle(player)'),0));

probe('rightStick.dist=.45;');
for(let i=0;i<8;i++){
 const angle=i*Math.PI/4;
 probe(`rightStick.dx=Math.cos(${angle});rightStick.dy=Math.sin(${angle});`);step();
 ok('prone aim direction '+i+' leaves the feet and player rooted',
  P('player.x')===before.x&&P('player.y')===before.y&&near(P('stanceFacingAngle(player)'),0)&&near(P('player.aimAngle'),angle));
}
probe('rightStick.active=false;leftStick.dx=0;leftStick.dy=1;');step(3);
ok('the brief gun lowering hold keeps the actor planted',P('player.x')===before.x&&P('player.y')===before.y);
step(35);
ok('releasing aim resumes the held movement request after unrolling',P('player.y')>before.y&&P('player.isMoving&&player.stance.proneAimBlend===0'));
ok('neutral crawling transfers the floor heading to actual travel',near(P('stanceFacingAngle(player)'),Math.PI/2));

fresh();
probe(`buildings=activeBuildings=[{x:0,y:30,w:20,h:6}];invalidateColIndex();
 player.checkCol(0,0);window.proneProbe={prevX:25,prevY:-30,x:25,y:30,tH:'LEGS'};`);
for(let i=0;i<8;i++){
 probe(`player.aimAngle=${i*Math.PI/4};constrainStanceFacing(player);`);
 ok('gun direction '+i+' cannot rotate the prone wall footprint',P('stanceProneSpotClear(player)&&!player.checkCol(0,0)')&&near(P('stanceFacingAngle(player)'),0));
 ok('gun direction '+i+' cannot rotate the incoming low-shot capsule',P('Number.isFinite(stanceProjectileContact(proneProbe,player))'));
}
probe('player.aimAngle=Math.PI/4;player.stance.proneHeading=Math.PI/2;constrainStanceFacing(player);');
ok('blocked body turning restores its last safe floor heading',near(P('stanceFacingAngle(player)'),0));
ok('restoring a floor heading does not overwrite the gun aim',near(P('player.aimAngle'),Math.PI/4));
fresh();probe(`resetActorStance(player,'STAND');
 buildings=activeBuildings=[{x:0,y:30,w:20,h:6}];invalidateColIndex();
 requestActorStance(player,'PRONE');player.aimAngle=Math.PI/2;
 for(let i=0;i<6;i++)updateActorStance(player,50);`);
ok('gun turning during the dive cannot change its already checked floor footprint',
 P('player.stance.to===2&&actorStance(player)==="PRONE"')&&near(P('stanceFacingAngle(player)'),0));
probe(`window.proneNPC=new Character(0,0,false,'NORMAL');proneNPC.aimAngle=0;
 resetActorStance(proneNPC,'PRONE');proneNPC.aimAngle=Math.PI/2;`);
ok('ordinary NPC stance facing retains its existing gun-facing behavior',near(P('stanceFacingAngle(proneNPC)'),Math.PI/2));

fresh();step();const direct=P('({x:player.x,y:player.y})');
probe('player.aimAngle=Math.PI;player.fire(Math.PI);');
ok('a direct shot from neutral captures and preserves the floor anchor',near(P('stanceFacingAngle(player)'),0)&&near(P('bullets[0].a'),Math.PI));
ok('a direct shot begins the aiming pose and stops crawling immediately',P('!player.isMoving&&player.aimHold>0&&player.stance.proneAimBlend>0'));
step();ok('the next real update cannot creep forward after that shot',P('player.x')===direct.x&&P('player.y')===direct.y);
fresh();const previousShooting=P('gamepadControlSettings.shooting');
probe(`gamepadControlSettings.shooting='R2';rightStick.gamepadInput=true;
 rightStick.active=false;gamepadFireInput.trigger=true;`);step();
ok('a controller trigger without stick aim locks movement on its first shot',P('player.x===0&&player.y===0&&!player.isMoving&&player.ammo===29&&bullets.length===1'));
ctx.__pronePreviousShooting=previousShooting;
probe('gamepadControlSettings.shooting=__pronePreviousShooting;gamepadFireInput.trigger=false;');delete ctx.__pronePreviousShooting;
fresh();probe(`swordPickedUp=true;setMeleeTool('SWORD');player.meleeTimer=5;
 rightStick.active=true;rightStick.dist=.45;`);step();
ok('aim lock also prevents a voluntary melee lunge while its timer continues',P('player.x===0&&player.y===0&&player.meleeTimer===4'));

fresh();probe('rightStick.active=true;updateProneFacing(player,70);');
const blend=P('player.stance.proneAimBlend');probe('isPaused=true;updateProneFacing(player,100);');
ok('pause freezes the prone aiming blend',P('player.stance.proneAimBlend')===blend);
probe('isPaused=false;doTick=false;updateProneFacing(player,100);');
ok('a stopped simulation cannot advance the roll blend',P('player.stance.proneAimBlend')===blend);
probe('doTick=true;updateProneFacing(player,100);');
ok('active simulation completes the aiming blend',P('player.stance.proneAimBlend===1'));

fresh();probe(`chemistSuitUnlocked=true;cannonInputHeld=true;player.cannonAmmo=4;
 player.cannonCooldown=player.cannonFireDelay=0;leftStick.dx=0;leftStick.dy=-1;`);step();
ok('the first free-hand cannon charge frame locks prone movement',P('player.cannonCharge===1&&player.x===0&&player.y===0&&!player.isMoving'));
ok('cannon-only aim reads the held movement stick without turning the feet',near(P('player.aimAngle'),-Math.PI/2)&&near(P('stanceFacingAngle(player)'),0));
probe('leftStick.dx=-1;leftStick.dy=0;');step();
ok('changing cannon aim while charging turns the arms without moving the root',near(P('player.aimAngle'),Math.PI)&&P('player.x===0&&player.y===0&&player.cannonCharge===2'));
let releasedMuzzle=null;
const nativeMuzzle=ctx.leftActionMuzzle;
ctx.leftActionMuzzle=(actor,angle)=>{
 const result=nativeMuzzle(actor,angle);releasedMuzzle={...result,angle,actorAim:actor.aimAngle};return result;
};
try{probe('leftStick.dx=1;leftStick.dy=1;cannonInputHeld=false;lightnings=[];');step();}
finally{ctx.leftActionMuzzle=nativeMuzzle;}
const bolt=P('lightnings[0].pts');
ok('cannon release synchronizes actor aim before computing its beam origin',releasedMuzzle&&near(releasedMuzzle.angle,Math.PI/4)&&near(releasedMuzzle.actorAim,Math.PI/4));
ok('the cannon beam starts at the resolved posed hand and follows requested aim',releasedMuzzle&&
 Math.hypot(bolt[0].x-releasedMuzzle.x,bolt[0].y-releasedMuzzle.y)<1e-8&&near(Math.atan2(bolt[1].y,bolt[1].x),Math.PI/4));
ok('cannon discharge stays rooted while its native recovery clock runs',P('player.x===0&&player.y===0&&player.cannonFireDelay===48&&proneAimLocked(player)'));
fresh();probe(`chemistSuitUnlocked=true;isCooking=true;cookTime=100;meleeInputHeld=true;pFlaskAmmo=2;`);step();
ok('holding a flask alone does not lock neutral prone crawling',P('isCooking&&player.x>0&&player.isMoving&&!proneAimLocked(player)'));
fresh();probe(`chemistSuitUnlocked=true;cannonInputHeld=true;player.cannonCooldown=100;player.cannonFireDelay=0;
 player.cannonCharge=0;player.cannonAmmo=4;`);step();
ok('holding a cooling cannon button cannot invent an aiming lock',P('player.x>0&&player.cannonCharge===0&&!proneAimLocked(player)'));

// Eight aim headings interpolate belly -> elbow -> side -> back while the
// actor's longitudinal leg axis stays planted in the original floor frame.
fresh(-Math.PI/2);probe('leftStick.active=false;player.aimHold=14;player.stance.proneAimBlend=1;');
function rolled(delta){
 probe(`player.aimAngle=stanceFacingAngle(player)+(${delta});`);
 return P('({roll:proneRollPose(player),body:stanceBodyPose(player)})');
}
const front=rolled(0),leftPost=rolled(-Math.PI/4),rightPost=rolled(Math.PI/4);
const leftSide=rolled(-Math.PI/2),rightSide=rolled(Math.PI/2),back=rolled(Math.PI);
ok('forward prone aim keeps the belly-down pose',front.roll.side===0&&front.roll.back===0&&front.roll.post===0);
ok('northwest aim posts the right elbow while northeast mirrors to the left',leftPost.roll.post>.99&&leftPost.roll.supportSide===1&&rightPost.roll.post>.99&&rightPost.roll.supportSide===-1);
ok('west aim rolls onto the right side and narrows the visible torso',leftSide.roll.supportSide===1&&leftSide.roll.side>.99&&leftSide.body.torsoWidth<front.body.torsoWidth*.6);
ok('east aim mirrors the side-lying body and raised hip',rightSide.roll.supportSide===-1&&rightSide.roll.side>.99&&
 Math.abs(rightSide.body.torsoWidth-leftSide.body.torsoWidth)<1e-8&&Math.abs(rightSide.body.chestY+leftSide.body.chestY)<1e-8);
ok('rear diagonals interpolate between side and supine poses',[-Math.PI*.75,Math.PI*.75].every(a=>{const r=rolled(a).roll;return r.back>.45&&r.back<.55&&r.side>.7;}));
ok('aiming directly south reaches the shared on-back pose',back.roll.back===1&&back.roll.side<1e-8);
const seamLeft=rolled(-Math.PI+1e-6),seamRight=rolled(Math.PI-1e-6);
ok('crossing south keeps torso and leg positions continuous across the angle seam',
 Math.abs(seamLeft.body.chestY-seamRight.body.chestY)<1e-4&&seamLeft.body.joints.every((j,i)=>
  Math.hypot(j.hip.x-seamRight.body.joints[i].hip.x,j.hip.y-seamRight.body.joints[i].hip.y)<1e-4&&
  Math.hypot(j.ankle.x-seamRight.body.joints[i].ankle.x,j.ankle.y-seamRight.body.joints[i].ankle.y)<1e-4));
let planted=true;
for(let i=0;i<8;i++){
 const {roll,body}=rolled(i*Math.PI/4);
 planted&&=near(roll.heading,-Math.PI/2)&&body.joints.every(j=>j.ankle.x<j.knee.x&&j.knee.x<j.hip.x);
}
ok('all eight aim headings retain the same planted longitudinal leg frame',planted);

const nativeSleeve=ctx.drawCombatStanceSleeve,nativeHead=ctx.drawFigureHead;
const nativePack=ctx.drawStanceDashPack,nativeOval=ctx.figureCelOval;
let sleeves=[],heads=0,paintOrder=[],currentBody=null;
ctx.drawCombatStanceSleeve=(...args)=>{sleeves.push(args);return nativeSleeve(...args);};
ctx.drawFigureHead=(...args)=>{heads++;return nativeHead(...args);};
ctx.drawStanceDashPack=(...args)=>{paintOrder.push('pack');return nativePack(...args);};
ctx.figureCelOval=(...args)=>{
 if(currentBody&&Math.abs(args[3]-currentBody.torsoLength)<1e-8&&Math.abs(args[4]-currentBody.torsoWidth)<1e-8)paintOrder.push('torso');
 return nativeOval(...args);
};
try{
 probe('jetpackUnlocked=true;');
 for(const key of ['PISTOL','ASSAULT_RIFLE','SHOTGUN']){
  let reachable=true,singleHead=true,grips=true;
  for(let i=0;i<8;i++){
   probe(`player.currentWeapon=WEAPONS.${key};`);currentBody=rolled(i*Math.PI/4).body;
   sleeves=[];heads=0;paintOrder=[];probe('player.show();');
   singleHead&&=heads===1&&sleeves.length===2;
   const expected=P(key==='PISTOL'?'[null,stancePointInBody(player,16,8)]':
    '(()=>{const g=stanceLongGunPose(player);return [stancePointInBody(player,...g.fore),stancePointInBody(player,...g.rear)];})()');
   for(let j=0;j<sleeves.length;j++){
    const arm=sleeves[j],upper=Math.hypot(arm[3]-arm[1],arm[4]-arm[2]),fore=Math.hypot(arm[5]-arm[3],arm[6]-arm[4]);
    reachable&&=upper<=currentBody.R.upper*1.02&&fore<=currentBody.R.fore*1.02;
    if(expected[j])grips&&=Math.hypot(arm[5]-expected[j].x/currentBody.size,arm[6]-expected[j].y/currentBody.size)<1e-7;
   }
   if(key==='ASSAULT_RIFLE'&&(i===0||i===4))ok('the pack sits '+(i===0?'over the belly-down back':'under the supine torso'),
    i===0?paintOrder.indexOf('pack')>paintOrder.indexOf('torso'):paintOrder.indexOf('pack')<paintOrder.indexOf('torso'));
  }
  ok(key+' arms retain reachable native lengths through all eight aim headings',reachable);
  ok(key+' hands stay on their weapon grips through all eight aim headings',grips);
  ok(key+' directional poses draw one head and one pair of arms',singleHead);
 }
}finally{
 ctx.drawCombatStanceSleeve=nativeSleeve;ctx.drawFigureHead=nativeHead;
 ctx.drawStanceDashPack=nativePack;ctx.figureCelOval=nativeOval;
}
fresh(-Math.PI/2);probe('leftStick.active=false;player.currentWeapon=WEAPONS.ASSAULT_RIFLE;player.aimHold=0;player.aimAngle=Math.PI/2;');
let previousPort=null,smoothPort=true,settledPort=null;
for(let i=0;i<=20;i++){
 probe(`player.stance.proneAimBlend=${1-i/20};`);
 const port=P('({roll:proneRollPose(player),mount:stanceWeaponMount(player)})');
 const angle=port.roll.delta+port.mount.angle;
 if(previousPort!==null)smoothPort&&=Math.abs(Math.atan2(Math.sin(angle-previousPort),Math.cos(angle-previousPort)))<.2;
 previousPort=angle;settledPort=port;
}
ok('releasing rear aim lowers the carried rifle continuously through the unwind',smoothPort);
ok('a fully lowered rifle returns to the body-facing carry instead of crossing backward through the torso',
 near(settledPort.roll.delta+settledPort.mount.angle,-1.12));

fresh(-Math.PI/2);
probe('player.x=0;player.y=1100;player.aimAngle=Math.PI/3;saveGame();');
const saved=JSON.parse(slot);
ok('saving prone records the floor anchor independently from gun aim',saved.playerStance==='PRONE'&&near(saved.playerProneHeading,-Math.PI/2));
probe('loadGame();');
ok('loading restores the settled prone heading before clearance checks',P('actorStance(player)==="PRONE"')&&near(P('stanceFacingAngle(player)'),-Math.PI/2));
ok('loading a saved floor pose clears transient aiming interpolation',P('player.stance.proneAimBlend===0'));
delete saved.playerProneHeading;slot=JSON.stringify(saved);probe('loadGame();');
ok('older saves without a floor heading retain a finite valid prone pose',P('actorStance(player)==="PRONE"&&Number.isFinite(stanceFacingAngle(player))'));
console.log(`${checks}/${checks} prone aim lock, anchored footprint, trajectory and save checks passed`);

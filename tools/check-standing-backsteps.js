// Standing hips must follow the existing crouch direction solver, including
// transitions, stopped feet and released aim. Standing keeps its native gait.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const near=(a,b,tolerance=1e-8)=>Math.abs(a-b)<tolerance;
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;ctx.navigator.getGamepads=()=>[];
function fresh(aim=0,move=Math.PI,moving=true){
 probe(`currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
  isPaused=isDead=isWin=killcamMode=false;isStoryMode=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
  inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
  window.inNM0SecretOverlay=false;buildGhost=null;resetUndergroundRoute();
  buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];bullets=[];
  invalidateColIndex();setMeleeTool('NONE');window.shovelOwned=window.pickaxeOwned=false;
  swordPickedUp=false;chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=false;
  jetpackUnlocked=false;isCooking=meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;
  leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
  rightStick={active:true,dx:Math.cos(${aim}),dy:Math.sin(${aim}),dist:.4,base:{x:313,y:690}};
  player=new Character(70,90,true);window.crouchReference=new Character(70,90,true);
  for(const c of [player,crouchReference]){
   c.aimAngle=${aim};c.moveAngle=${move};c.isMoving=${moving};c.isArmed=true;c.gait=.6;c.walkCycle=.8;
   c.currentWeapon=WEAPONS.PISTOL;c.ammo=30;c.aimHold=14;
   c.meleeTimer=c.reloadTimer=c.dashTimer=c.muzzleFlash=0;
  }
  resetActorStance(player,'STAND');resetActorStance(crouchReference,'CROUCH');
  window.isDesktop=false;frameCount++;deltaTime=1000/60;
  viewLeft=viewTop=-100000;viewRight=viewBottom=100000;`);
}
function advance(frames=1,cycle=.3,ms=1000/60){
 for(let i=0;i<frames;i++)probe(`frameCount++;
  player.walkCycle+=${cycle};crouchReference.walkCycle+=${cycle};
  updateStandingFacing(player,${ms});updateCrouchFacing(crouchReference,${ms});`);
}
const lower=()=>P('standingLowerPose(player)'),reference=()=>P('crouchLowerPose(crouchReference)');
const rear=()=>P('standingRearPose(player)');
const leg=index=>P(`standingRearLeg(player,standingRearPose(player),figureRig(player.bodyW,player.bodyH),${index})`);
const matchesReference=()=>{
 const a=lower(),b=reference();
 return !!a&&near(wrap(a.angle-b.angle),0)&&near(a.yaw,b.yaw)&&near(a.backward,b.backward)&&near(a.motion,b.motion);
};

let directions=true,targets=true;
for(let a=0;a<8;a++)for(const [delta,hip,back]of [[0,0,0],[Math.PI/4,Math.PI/4,0],[-Math.PI/4,-Math.PI/4,0],
 [Math.PI/2,Math.PI/2,0],[-Math.PI/2,-Math.PI/2,0],[Math.PI*.75,-Math.PI/4,1],[-Math.PI*.75,Math.PI/4,1],[Math.PI,0,1]]){
 const aim=a*Math.PI/4;fresh(aim,aim+delta);advance(1,0);
 const p=lower();directions&&=matchesReference();
 targets&&=!!p&&near(wrap(p.angle-aim),hip)&&p.backward===back;
}
ok('all 64 aim and travel pairs use the same hip direction as the existing crouch',directions);
ok('standing uses crouch lateral directions and folded rear-diagonal directions',targets);

fresh();advance();const start=lower();
probe('player.isMoving=crouchReference.isMoving=false;');advance(1,0);
ok('stopping while aiming cannot fall back to the old 180-degree movement heading',
 matchesReference()&&Math.abs(wrap(lower().angle-P('player.aimAngle')))<1e-8);
ok('stopped feet retain their crouch-style direction while motion eases down',
 lower().motion>0&&lower().motion<start.motion);
probe('rightStick.active=false;player.aimHold=crouchReference.aimHold=0;player.isArmed=crouchReference.isArmed=false;');advance(1,0);
ok('aim release and empty hands retain a bounded standing hip frame',
 matchesReference()&&Math.abs(lower().yaw)<=Math.PI*.54+1e-8);
advance(120,0);
ok('standing weight settles to rest without discarding the planted hip frame',matchesReference()&&lower().motion===0);
probe('player.aimAngle=crouchReference.aimAngle=Math.PI;');advance(1,0);
ok('a large stationary torso turn pivots the feet within the same crouch limit',
 matchesReference()&&Math.abs(lower().yaw)<=Math.PI*.54+1e-8);

fresh(0,Math.PI/2);advance(40);
let matching=true,bounded=true,rate=true,prior=lower().angle;
for(let i=0;i<720;i++){
 // Abrupt reversals, full movement-stick rotations and angle-wrap crossings.
 const aim=i<180?0:i<360?Math.PI-.02:i<540?-Math.PI+.02:i%2?1.2:-1.2;
 const move=i<120?Math.PI*.75:i<240?-Math.PI*.75:i*Math.PI/90;
 probe(`player.aimAngle=crouchReference.aimAngle=${aim};player.moveAngle=crouchReference.moveAngle=${move};
  player.isMoving=crouchReference.isMoving=${i%120<95};
  rightStick.active=${i%80<40};player.aimHold=crouchReference.aimHold=${i%80<40?14:0};`);
 advance(1,.23);const p=lower();matching&&=matchesReference();bounded&&=!!p&&Math.abs(p.yaw)<=Math.PI*.54+1e-8;
 if(i<180)rate&&=Math.abs(wrap(p.angle-prior))<=.0032*1000/60+1e-8;
 prior=p.angle;
}
ok('standing and crouch remain identical through movement reversals, stops, releases and rapid aim changes',matching);
ok('every resolved standing hip remains within the existing crouch torso limit',bounded);
ok('movement-only hip turns respect the existing crouch rotation-speed limit',rate);

fresh();advance(1,0);const firstPhase=lower().phase,firstCrouchPhase=reference().phase;advance(40,.3);
ok('standing keeps the full native stride clock while crouch keeps its original slower phase',
 near(lower().phase-firstPhase,12)&&near(reference().phase-firstCrouchPhase,12*.46));
const before=P('JSON.stringify(player)');lower();rear();lower();rear();
ok('pose queries do not alter actor state or advance hip clocks',before===P('JSON.stringify(player)'));
const paused=P('JSON.stringify(player)');probe('isPaused=true;frameCount++;updateStandingFacing(player,100);isPaused=false;');
ok('pause freezes standing hip direction and support state',paused===P('JSON.stringify(player)'));
advance(1,0);const once=P('JSON.stringify(player)');probe('updateStandingFacing(player,100);');
ok('repeated consumers cannot advance the standing solver twice in one frame',once===P('JSON.stringify(player)'));

for(const [label,setup]of [
 ['nonplayer','player.isPlayer=false;'],['mounted rider','player.mounted=true;'],['dash','player.dashTimer=10;'],
 ['melee strike','player.meleeTimer=10;'],['boxing','player._boxing={active:true};'],['knockout','player.knockedOut=true;'],
 ['stun','player.stunTimer=10;'],['skeleton stun','player.skeletonTimer=10;'],
 ['shovel',"window.shovelOwned=true;setMeleeTool('SHOVEL');"],['mantle','player.shovelMantle={};'],
 ['crouch',"resetActorStance(player,'CROUCH');"],['prone',"resetActorStance(player,'PRONE');"],['lowering transition','player.stance.to=1;']]){
 fresh();probe(setup);ok(label+' retains its dedicated animation',lower()===null);
}

for(const aimed of [false,true])for(const throttle of [.2,.5,1]){
 fresh();probe(`player.walkCycle=2;player.aimHold=0;leftStick.active=true;leftStick.dx=-${throttle};leftStick.dy=0;
 rightStick.active=${aimed};rightStick.dx=1;rightStick.dy=0;rightStick.dist=.4;frameCount++;player.updatePlayer();`);
 ok((aimed?'aimed':'ordinary')+' standing retains the original cadence at '+throttle,
  near(P('player.walkCycle')-2,P('gaitPose(player.gait).cadence')));
}

// Observe the real painter: stopping and releasing aim must still draw the
// bounded hip frame, whether or not a backward geometry adapter is active.
fresh();advance(1,0);
const native={limb:ctx.figureCelLimb,oval:ctx.figureCelOval,push:ctx.push,pop:ctx.pop,rotate:ctx.rotate};
let limbs=[],boots=[],angle=0,stack=[],depth=0,minDepth=0;
const pants=P('player.pantsCol.levels').slice(0,3),bootColor=pants.map(c=>c*.55);
const sameColor=(c,rgb)=>{c=c&&(c.levels||c);return c&&rgb.every((v,i)=>near(c[i],v));};
ctx.push=(...args)=>{stack.push(angle);depth++;return native.push(...args);};
ctx.pop=(...args)=>{angle=stack.pop();depth--;minDepth=Math.min(minDepth,depth);return native.pop(...args);};
ctx.rotate=(a,...args)=>{angle+=a;return native.rotate(a,...args);};
ctx.figureCelLimb=(...args)=>{if(sameColor(args[10],pants))limbs.push({points:args.slice(1,7),widths:args.slice(7,10),angle});return native.limb(...args);};
ctx.figureCelOval=(...args)=>{if(sameColor(args[5],bootColor))boots.push({geometry:args.slice(1,5),angle});return native.oval(...args);};
try{
 let frames=true,materials=true;
 const R=P('figureRig(player.bodyW,player.bodyH)');
 for(const setup of ['', 'player.isMoving=false;', 'rightStick.active=false;player.aimHold=0;', 'player.isArmed=false;',
  'player.aimAngle=Math.PI;', 'player.isMoving=true;player.moveAngle=-Math.PI*.75;']){
  probe(setup);advance(1,0);const p=lower();limbs=[];boots=[];probe('player.show();');
  frames&&=limbs.length===(rear()?4:2)&&limbs.every(l=>near(wrap(l.angle-p.angle),0));
  const widths=[[R.thighW,R.shinW,R.shinW*.8],[R.shinW,R.shinW*.9,R.shinW*.8],
   [R.thighW,(R.thighW+R.shinW)*.5,R.shinW]];
  materials&&=limbs.every(l=>widths.some(w=>l.widths.every((v,i)=>near(v,w[i]))))&&
   boots.length===2&&boots.every(b=>near(b.geometry[2],R.foot)&&near(b.geometry[3],R.shinW*.8));
 }
 ok('the actual standing painter retains the crouch-derived hip frame after stopping or releasing aim',frames);
 ok('standing keeps its native tapered trouser widths and dark boot shape',materials);
 ok('standing hip and leg painting preserves a balanced graphics stack',depth===0&&minDepth===0&&stack.length===0);
}finally{Object.assign(ctx,{figureCelLimb:native.limb,figureCelOval:native.oval,push:native.push,pop:native.pop,rotate:native.rotate});}

fresh(.4,.4+Math.PI*.75);advance(1,0);
const p=rear();
if(p){
 const l=leg(0),u=.8,x=l.kx+(l.ax-l.kx)*u,y=l.ky+(l.ay-l.ky)*u;
 probe(`window.standingLegWound={sz:2};mapLegHitDecal(player,
  player.x+${Math.cos(p.angle)*x-Math.sin(p.angle)*y},player.y+${Math.sin(p.angle)*x+Math.cos(p.angle)*y},standingLegWound);`);
 ok('standing wounds resolve onto the same backward shin and hip frame as the painter',
  P('standingLegWound.legIndex===0&&Math.abs(standingLegWound.legU-.8)<1e-6'));
}else throw Error('rear travel must provide a backward leg pose');
console.log(`${checks}/${checks} standing/crouch hip parity, direction bounds, lifecycle, native gait and painter checks passed`);

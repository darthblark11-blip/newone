// Backward travel keeps forward knees and exposes a rear heel/calf, without
// changing the shared standing/crouch heading solver or the original footwear.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')'),near=(a,b)=>Math.abs(a-b)<1e-8;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;ctx.navigator.getGamepads=()=>[];
function fresh(aim=0,delta=Math.PI){
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
 leftStick={active:true,dx:Math.cos(${aim+delta}),dy:Math.sin(${aim+delta}),base:{x:80,y:640}};
 rightStick={active:true,dx:Math.cos(${aim}),dy:Math.sin(${aim}),dist:.4,base:{x:313,y:690}};
 player=new Character(70,90,true);player.aimAngle=${aim};player.moveAngle=${aim+delta};
 player.isMoving=player.isArmed=true;player.gait=.7;player.walkCycle=0;
 player.currentWeapon=WEAPONS.PISTOL;player.ammo=30;player.aimHold=14;
 player.meleeTimer=player.reloadTimer=player.dashTimer=player.muzzleFlash=0;
 resetActorStance(player,'STAND');window.isDesktop=false;frameCount++;deltaTime=1000/60;
 viewLeft=viewTop=-100000;viewRight=viewBottom=100000;`);
}
const rear=()=>P('standingRearPose(player)');
const leg=i=>P(`standingRearLeg(player,standingRearPose(player),figureRig(player.bodyW,player.bodyH),${i})`);

let coverage=true,visibleNearSide=true,hipsUnchanged=true;
for(let facing=0;facing<8;facing++)for(const sign of [-1,1])for(const degrees of [91,95,100,110,112.49,112.51,135,160,180]){
 fresh(facing*Math.PI/4,sign*degrees*Math.PI/180);
 const before=P('JSON.stringify(standingLowerPose(player))'),pose=rear();
 coverage&&=!!pose&&pose.heelExposure>0;
 if(degrees<=112.49)visibleNearSide&&=!!pose&&pose.heelExposure>=.45&&leg(0).heel>=.24&&leg(1).heel>=.24;
 hipsUnchanged&&=before===P('JSON.stringify(standingLowerPose(player))');
}
ok('all rear directions relative to every aim heading expose a heel pose',coverage);
ok('91 to 112 degree rear travel retains the rear-pose coverage metadata',visibleNearSide);
ok('rear coverage does not rewrite the shared hip angle or support state',hipsUnchanged);

fresh();
const sweep=P(`(()=>{
 const result={forwardKnees:true,boneLengths:true,separateTracks:true,finite:true,heelBounds:true};
 const R=figureRig(player.bodyW,player.bodyH);
 for(const gait of [.2,.5,1])for(let angle=91;angle<=180;angle+=2)for(const sign of [-1,1])for(let phase=0;phase<32;phase++){
  player.gait=gait;player.moveAngle=sign*angle*Math.PI/180;player.walkCycle=phase*Math.PI/16;
  const p=standingRearPose(player);
  for(let index=0;index<2;index++){
   const l=standingRearLeg(player,p,R,index),side=index?1:-1;
   result.forwardKnees&&=l.kx>l.sx;
   result.boneLengths&&=Math.hypot(l.kx-l.sx,l.ky-l.sy)<=R.thigh+1e-8&&
    Math.hypot(l.ax-l.kx,l.ay-l.ky)<=R.shin*.98+1e-8;
   result.separateTracks&&=side*l.ky>0&&side*l.ay>=R.shinW*.8*.55-1e-8;
   result.finite&&=['sx','sy','kx','ky','ax','ay','lift','heel','sole'].every(k=>Number.isFinite(l[k]));
   result.heelBounds&&=l.heel>0&&l.heel<=1&&l.sole>=0&&l.sole<=1;
  }
 }
 return result;
})()`);
ok('the knee stays ahead of its hip throughout rear walk, jog, run and diagonals',sweep.forwardKnees);
ok('folded thighs and shins never stretch beyond their actual bone lengths',sweep.boneLengths);
ok('rear feet and knees remain on separate anatomical tracks',sweep.separateTracks);
ok('all rear joint and exposure values stay finite across the complete phase sweep',sweep.finite);
ok('rear recovery weights remain bounded through all rear bands',sweep.heelBounds);

fresh();probe('player.walkCycle=0;');let a=leg(0),b=leg(1);
ok('a recovering rear foot exposes its sole while the opposite foot remains planted',a.sole>0&&near(b.sole,0)&&a.lift>0&&near(b.lift,0));
ok('the planted rear foot still has a readable heel face',b.heel>0);
probe('player.walkCycle=Math.PI;');a=leg(0);b=leg(1);
ok('heel lift and sole exposure alternate onto the other leg half a stride later',near(a.sole,0)&&b.sole>0&&near(a.lift,0)&&b.lift>0);
let calfBehind=false;
for(let phase=0;phase<16;phase++){
 probe(`player.walkCycle=${phase*Math.PI/8};`);
 for(const i of [0,1]){const l=leg(i);calfBehind||=l.ax<l.sx&&l.kx>l.sx&&l.kx>l.ax;}
}
ok('backward reach shows a folded shin behind a forward knee, rather than a reversed thigh',calfBehind);

let noForwardHeel=true;
for(const delta of [-Math.PI/2,-Math.PI/4,0,Math.PI/4,Math.PI/2]){fresh(0,delta);noForwardHeel&&=rear()===null;}
ok('fresh forward and exact lateral movement keep the original leg path',noForwardHeel);

// Cloth presentation is verified separately against the original forward
// surface; these checks retain the canonical rear movement/anatomy contract.
console.log(`${checks}/${checks} standing rear coverage, canonical joints and recovery checks passed`);

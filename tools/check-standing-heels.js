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
ok('91 to 112 degree rear travel exposes heels before the crouch hip-fold threshold',visibleNearSide);
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
ok('heel and sole exposure stay visible and bounded through all rear bands',sweep.heelBounds);

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

// The heel surface belongs at the back edge of the real boot, not at the
// knee or beyond the toe. Exercise the drawing delegate without a canvas.
fresh();probe('player.walkCycle=0;');
const R=P('figureRig(player.bodyW,player.bodyH)'),L=leg(0),boot=[20,35,60],calls=[];
let depth=0,minDepth=0;
const g={push(){depth++;},pop(){depth--;minDepth=Math.min(minDepth,depth);}};
for(const name of ['stroke','strokeWeight','fill','rect','line'])g[name]=(...args)=>calls.push({name,args});
ctx.__heelG=g;ctx.__heelLeg={...L,heel:0};ctx.__heelRig=R;ctx.__heelBoot=boot;
probe('drawStandingRearHeel(__heelG,__heelLeg,__heelRig,__heelBoot);');
ok('zero heel exposure produces no heel art',calls.length===0&&depth===0);
ctx.__heelLeg={...L,heel:1,sole:0};
probe('drawStandingRearHeel(__heelG,__heelLeg,__heelRig,__heelBoot);');
const panel=calls.find(c=>c.name==='rect'),plantedLines=calls.filter(c=>c.name==='line').length;
ok('the leather heel panel sits on the negative-X rear edge of the forward-pointing boot',
 !!panel&&panel.args[0]<L.ax&&panel.args[0]+panel.args[2]<L.ax+R.foot*.34);
calls.length=0;ctx.__heelLeg={...L,heel:1,sole:1};
probe('drawStandingRearHeel(__heelG,__heelLeg,__heelRig,__heelBoot);');
ok('recovering heels add readable sole tread beyond the planted leather seam',calls.filter(c=>c.name==='line').length>=plantedLines+3);
ok('heel detail restores the drawing stack',depth===0&&minDepth===0);
delete ctx.__heelG;delete ctx.__heelLeg;delete ctx.__heelRig;delete ctx.__heelBoot;

// Observe the real player painter so canonical geometry, layering and wound
// attachment cannot diverge from the pose helper's arithmetic.
fresh(.37,Math.PI);probe('player.walkCycle=Math.PI/2;');
const native={limb:ctx.figureCelLimb,oval:ctx.figureCelOval,heel:ctx.drawStandingRearHeel,
 decals:ctx.drawLegDecals,push:ctx.push,pop:ctx.pop,rotate:ctx.rotate};
let events=[],angle=0,stack=[];depth=minDepth=0;
const pants=P('player.pantsCol.levels').slice(0,3),dark=pants.map(v=>v*.55);
const colorIs=(c,rgb)=>{c=c&&(c.levels||c);return c&&rgb.every((v,i)=>near(v,c[i]));};
ctx.push=(...args)=>{stack.push(angle);depth++;return native.push(...args);};
ctx.pop=(...args)=>{angle=stack.pop();depth--;minDepth=Math.min(minDepth,depth);return native.pop(...args);};
ctx.rotate=(value,...args)=>{angle+=value;return native.rotate(value,...args);};
ctx.figureCelLimb=(...args)=>{if(colorIs(args[10],pants))events.push({kind:'limb',points:args.slice(1,7),widths:args.slice(7,10),angle});return native.limb(...args);};
ctx.figureCelOval=(...args)=>{if(colorIs(args[5],dark)&&near(args[3],R.foot))events.push({kind:'boot',points:args.slice(1,5),angle});return native.oval(...args);};
ctx.drawStandingRearHeel=(...args)=>{events.push({kind:'heel',leg:{...args[1]},angle});return native.heel(...args);};
ctx.drawLegDecals=(...args)=>{events.push({kind:'decal',index:args[2],points:args.slice(3,9),angle});return native.decals(...args);};
try{
 const pose=rear(),expected=[leg(0),leg(1)];probe('player.show();');
 const expectedOrder=['limb','boot','heel','limb','decal','limb','boot','heel','limb','decal'];
 ok('the real painter layers calf, boot, heel and forward thigh in anatomical order',
  events.length===expectedOrder.length&&events.every((event,i)=>event.kind===expectedOrder[i]));
 let canonical=true,boots=true,decals=true,frames=true;
 expected.forEach((l,index)=>{
  const row=events.slice(index*5,index*5+5),shin=row[0],shoe=row[1],heel=row[2],thigh=row[3],stain=row[4];
  canonical&&=shin&&thigh&&shin.points.every((v,i)=>near(v,[l.kx,l.ky,(l.kx+l.ax)*.5,(l.ky+l.ay)*.5,l.ax,l.ay][i]))&&
   thigh.points.every((v,i)=>near(v,[l.sx,l.sy,(l.sx+l.kx)*.5,(l.sy+l.ky)*.5,l.kx,l.ky][i]));
  canonical&&=heel&&['sx','sy','kx','ky','ax','ay','heel','sole'].every(k=>near(heel.leg[k],l[k]));
  boots&&=shoe&&shoe.points.every((v,i)=>near(v,[l.ax+R.foot*.34,l.ay,R.foot,R.shinW*.8][i]));
  decals&&=stain&&stain.index===index&&stain.points.every((v,i)=>near(v,[l.sx,l.sy,l.kx,l.ky,l.ax,l.ay][i]));
  frames&&=row.every(event=>Math.abs(wrap(event.angle-pose.angle))<1e-8);
 });
 ok('both real leg surfaces and heel details use the canonical forward-knee/backward-calf geometry',canonical);
 ok('backward footwear keeps the original dark boot dimensions and forward toe',boots);
 ok('rear wound surfaces consume the same folded knee and ankle coordinates',decals);
 ok('heel and leg rendering retain the approved shared hip transform',frames);
 ok('the complete rear player painter balances the drawing stack',depth===0&&minDepth===0&&stack.length===0);
 events=[];fresh(0,0);probe('player.show();');
 ok('the original forward painter does not acquire heel detail or split rear calf surfaces',
  !events.some(event=>event.kind==='heel')&&events.filter(event=>event.kind==='limb').length===2);
}finally{Object.assign(ctx,{figureCelLimb:native.limb,figureCelOval:native.oval,drawStandingRearHeel:native.heel,
 drawLegDecals:native.decals,push:native.push,pop:native.pop,rotate:native.rotate});}

fresh(.37,Math.PI);probe('player.walkCycle=Math.PI/2;');
const p=rear(),l=leg(0),u=.8,x=l.kx+(l.ax-l.kx)*u,y=l.ky+(l.ay-l.ky)*u;
probe(`window.heelLegWound={sz:2};mapLegHitDecal(player,
 player.x+${Math.cos(p.angle)*x-Math.sin(p.angle)*y},
 player.y+${Math.sin(p.angle)*x+Math.cos(p.angle)*y},heelLegWound);`);
ok('a real rear shin hit maps onto the visible calf rather than the obsolete reversed thigh',
 P('heelLegWound.legIndex===0&&Math.abs(heelLegWound.legU-.8)<1e-6'));
const before=P('JSON.stringify(player)');rear();leg(0);leg(1);
ok('resolving heel anatomy never advances movement, shared hips or stride clocks',before===P('JSON.stringify(player)'));
console.log(`${checks}/${checks} standing rear-hemisphere heels, forward knees, calf lengths and painter checks passed`);

// Exercise nearby and attached cover through the player's actual joystick controls.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;ctx.navigator.getGamepads=()=>[];
function fresh(q=0,kind='HIGH',end=0,distance=18){
 const angle=q*Math.PI/2,co=Math.cos(angle),si=Math.sin(angle);
 probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 window.inNM0SecretOverlay=false;buildGhost=null;setMeleeTool('NONE');
 chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;jetpackUnlocked=false;
 parkingCars=activeParkingCars=[];barrels=[];bullets=[];particles=[];enemiesList=[];
 player=new Character(${(30-distance)*co-65*end*si},${(30-distance)*si+65*end*co},true);
 player.hp=player.maxHp=300;player.shield=100;player.currentWeapon=WEAPONS.PISTOL;
 player.isArmed=true;player.ammo=100;player.aimAngle=${angle};
 player.reloadTimer=player.fireTimer=player.meleeTimer=player.dashTimer=0;resetActorStance(player);
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 window.latchWall={x:${40*co},y:${40*si},w:${q%2?160:20},h:${q%2?20:160},${kind==='HIGH'?'isWall':'isCrateProp'}:true};
 buildings=activeBuildings=[latchWall];frameCount=100;deltaTime=1000/60;invalidateColIndex();`);
 return {co,si,normal:()=>P(`-player.x*${co}-player.y*${si}`)};
}
function move(x,y){probe(`leftStick.active=${!!(x||y)};leftStick.dx=${x};leftStick.dy=${y};`);}
function aim(x,y){probe(`rightStick.active=${!!(x||y)};rightStick.dx=${x};rightStick.dy=${y};rightStick.dist=.4;`);}
function step(n=1){for(let i=0;i<n;i++)probe('frameCount++;player.updatePlayer();');}
function press(q,kind='HIGH'){
 const r=fresh(q,kind);move(r.co,r.si);step(18);move(0,0);step(10);return r;
}
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function checkPeekSwing(q,end){
 fresh(q,'HIGH',end,30);
 const inward=q*Math.PI/2,around=inward+end*.22,across=inward-end*.025;
 const label='face '+q+', end '+end;
 aim(Math.cos(around),Math.sin(around));step(24);
 let previous=null;
 for(const target of [across,around]){
  aim(Math.cos(target),Math.sin(target));
  for(let i=0;i<24;i++){
   step();
   const pose=P(`(()=>{
    const b=stanceBodyPose(player),c=player.cover,frame=stanceFacingAngle(player);
    const [l,r]=b.joints,co=Math.cos(b.hipYaw),si=Math.sin(b.hipYaw);
    const angle=player.aimAngle,ax=Math.cos(angle),ay=Math.sin(angle),u=coverUpperOffset(player);
    const muzzle=aimLaserMuzzle(player),head=coverActorHitCenter(player,'HEAD'),ui=actorStanceUIAnchor(player);
    return {engaged:c?.active&&!c.attached&&c.peek>.99,angle,chest:b.yaw+frame,hips:b.hipYaw+frame,
     socketError:Math.atan2(l.hip.x-r.hip.x,r.hip.y-l.hip.y)-b.hipYaw,
     footSpread:(r.ankle.y-l.ankle.y)*co-(r.ankle.x-l.ankle.x)*si,
     ankles:b.joints.map(j=>({x:Math.cos(frame)*j.ankle.x-Math.sin(frame)*j.ankle.y,
       y:Math.sin(frame)*j.ankle.x+Math.cos(frame)*j.ankle.y})),
     bones:b.joints.every(j=>Math.hypot(j.hip.x-j.knee.x,j.hip.y-j.knee.y)<=b.R.thigh+.01&&
       Math.hypot(j.ankle.x-j.knee.x,j.ankle.y-j.knee.y)<=b.R.shin+.01),
     gun:weaponAimHeading(player)-angle,
     muzzleError:Math.hypot(muzzle.x-player.x-u.x-31*ax+8*ay,muzzle.y-player.y-u.y-31*ay-8*ax),
     headError:Math.hypot(head.x-ui.x,head.y-ui.y-28)};
   })()`);
   assert.ok(pose.engaged,'sustained nearby peek on '+label);
   assert.ok(Math.abs(wrap(pose.chest-pose.hips))<Math.PI/3,'waist twist on '+label);
   assert.ok(Math.abs(wrap(pose.chest-pose.angle))<Math.PI/3,'chest follows the gun on '+label);
   assert.ok(Math.abs(wrap(pose.socketError))<.12&&pose.footSpread>2&&pose.bones,'hip sockets and legs on '+label);
   assert.ok(Math.abs(wrap(pose.gun))<1e-7&&pose.muzzleError<1e-7&&pose.headError<1e-7,'aim and head anchors on '+label);
   if(previous){
    assert.ok(Math.abs(wrap(pose.chest-previous.chest))<.23&&Math.abs(wrap(pose.hips-previous.hips))<.23,'turn continuity on '+label);
    assert.ok(pose.ankles.every((a,i)=>Math.hypot(a.x-previous.ankles[i].x,a.y-previous.ankles[i].y)<3.5),'foot continuity on '+label);
   }
   previous=pose;
  }
  ok('player crosses the inward direction and reaches the selected aim on '+label,Math.abs(wrap(previous.angle-target))<1e-6);
 }
 probe('frameCount++;');
 const state=()=>P('JSON.stringify([player.x,player.y,player.aimAngle,player.cover,player.stance,player._standingAim,player._weaponPresentation])');
 const before=state();
 probe('stanceBodyPose(player);stanceHeadLocal(player);aimLaserMuzzle(player);coverActorHitCenter(player,"HEAD");stanceBodyPose(player);');
 ok('pose and aiming queries preserve controller state on '+label,state()===before);
}
// Aim through the inward normal and back. The sign of the shortest turn to
// either end changes here even when the physical stick only moves a few degrees.
for(let q=0;q<4;q++)for(const end of [-1,1])checkPeekSwing(q,end);
// Press the closest face with the pistol down. Reverse the stick just as the
// pistol starts rising, then keep turning until the attached peek retracts.
fresh(0,'HIGH',-1,15);move(1,0);step(18);move(0,0);step(4);
aim(Math.cos(-.02),Math.sin(-.02));step(3);
let lastRaise=null,crossedDuringRaise=false;
for(const angle of [.2,2]){
 aim(Math.cos(angle),Math.sin(angle));
 for(let i=0;i<32;i++){
  step();
  const sample=P(`(()=>{
   const b=stanceBodyPose(player),frame=stanceFacingAngle(player),co=Math.cos(frame),si=Math.sin(frame);
   const bootsClear=b.joints.every(({ankle,knee})=>{
    const x=player.x+(co*ankle.x-si*ankle.y)*b.size,y=player.y+(si*ankle.x+co*ankle.y)*b.size;
    const boot=frame+Math.atan2(ankle.y-knee.y,ankle.x-knee.x);
    // Sample the ellipse drawn around the shin-oriented ankle by the native painter.
    for(let i=0;i<16;i++){
     const t=i*Math.PI/8,u=1.5+b.R.foot*.5*Math.cos(t),v=b.R.shinW*.41*Math.sin(t);
     const px=x+(Math.cos(boot)*u-Math.sin(boot)*v)*b.size,py=y+(Math.sin(boot)*u+Math.cos(boot)*v)*b.size;
     if(!coverRayClear(px,py,px,py))return false;
    }
    return true;
   });
   return {aim:player.aimAngle,raise:b.presentation,chest:b.yaw+frame,hips:b.hipYaw+frame,bootsClear};
  })()`);
  assert.ok(sample.bootsClear,'turned boots clear the attached wall at aim '+sample.aim);
  if(lastRaise){
   if(lastRaise.aim<0&&sample.aim>0&&sample.raise>.1&&sample.raise<.9)crossedDuringRaise=true;
   assert.ok(Math.abs(wrap(sample.chest-lastRaise.chest))<.62&&Math.abs(wrap(sample.hips-lastRaise.hips))<.62,
    'partial raise keeps the chest and hips on the same turn through the angle seam');
  }
  lastRaise=sample;
 }
}
ok('partial raise crosses the seam and reaches the open attached aim arc',
 crossedDuringRaise&&P('player.cover.attached&&player.cover.openAim&&player.cover.peek===0')&&Math.abs(wrap(lastRaise.chest-lastRaise.hips))<Math.PI/3);

// LOW cover and hostile HIGH cover keep their original wall-aligned hips.
press(0,'LOW');aim(Math.cos(.6),Math.sin(.6));step(36);
ok('player low cover retains its popped gun pose',P(`player.cover.pop===1&&Math.abs(stanceBodyPose(player).hipYaw)<1e-8&&
 Math.abs(stanceBodyPose(player).yaw-(.6-Math.PI))<1e-8`));
fresh(0,'HIGH',1,15);
ok('a hostile corner peek retains its established chest and lower-chain frames',P(`(()=>{
 const enemy=new Character(15,70,false,'NORMAL');enemy.currentWeapon=WEAPONS.PISTOL;enemy.aimAngle=.35;resetActorStance(enemy);
 for(let i=0;i<20;i++){frameCount++;updateActorCover(enemy,deltaTime,6,0,true);}
 const b=stanceBodyPose(enemy);
 return enemy.cover.validPeek&&enemy.cover.peek===1&&Math.abs(b.hipYaw)<1e-8&&Math.abs(b.yaw-(.35-Math.PI))<1e-8;
})()`));
for(let q=0;q<4;q++)for(const end of [-1,1]){
 const r=fresh(q,'HIGH',end,30),root=P('[player.x,player.y]');
 aim(r.co-end*.8*r.si,r.si+end*.8*r.co);step(24);
 ok('aiming near an open end acquires a peek without pressing, face/end '+q+'/'+end,
   P("player.cover?.active&&player.cover.kind==='HIGH'&&!player.cover.attached&&player.cover.peek>.9"));
 ok('nearby acquisition never moves or snaps the root '+q+'/'+end,
   P('player.x')===root[0]&&P('player.y')===root[1]);
 ok('the nearby lean remains bounded and its head stays clear '+q+'/'+end,
   P('Math.hypot(coverUpperOffset(player).x,coverUpperOffset(player).y)<=COVER_LEAN_MAX+1e-7&&(()=>{const h=coverActorHitCenter(player,"HEAD");return coverRayClear(h.x,h.y,h.x,h.y,6);})()'));
 const before=r.normal();move(-r.co*.2,-r.si*.2);step(3);
 ok('an unpressed nearby peek never glues free movement '+q+'/'+end,r.normal()>before+3);
 move(0,0);aim(0,0);step(22);
 ok('releasing aim leaves an unpressed nearby peek '+q+'/'+end,P('!player.cover.active&&!coverRenderActive(player)'));
}
for(let q=0;q<4;q++)for(const kind of ['HIGH','LOW']){
 let r=press(q,kind),normal=r.normal();
 ok(kind+' pressing the face creates an attachment '+q,P('player.cover?.active&&player.cover.attached'));
 move(-r.co*.18-r.si*.95,-r.si*.18+r.co*.95);step(6);
 ok(kind+' shallow outward diagonal keeps the pressed normal position '+q,Math.abs(r.normal()-normal)<1e-7&&P('player.cover.active&&player.cover.attached'));
 const tangent=P(`-player.x*${r.si}+player.y*${r.co}`);
 ok(kind+' tangent travel remains free while attached '+q,Math.abs(tangent)>10);
 move(-r.co*.49,-r.si*.49);step(4);
 ok(kind+' a soft outward thumb drift does not detach '+q,Math.abs(r.normal()-normal)<1e-7&&P('player.cover.active'));
 move(-r.co*.7-r.si*.7,-r.si*.7+r.co*.7);step();
 ok(kind+' a firm outward diagonal releases on the first movement frame '+q,r.normal()>normal+.5&&P('!player.cover.active'));
 step(12);move(0,0);step(20);
 ok(kind+' leaving restores ordinary standing '+q,P("!coverRenderActive(player)&&actorStance(player)==='STAND'"));
}
for(let q=0;q<4;q++){
 const r=fresh(q,'HIGH',1,18);aim(r.co-.8*r.si,r.si+.8*r.co);move(r.co,r.si);step(18);move(0,0);step(12);
 ok('an aimed corner starts attached after a deliberate press '+q,P('player.cover.active&&player.cover.attached'));
 const before=r.normal();move(-r.co*.7,-r.si*.7);step();move(0,0);step(20);
 ok('a one-frame firm away push remains released while aim is held '+q,r.normal()>before+.5&&P('!player.cover.active&&!coverRenderActive(player)'));
 aim(0,0);step();aim(r.co-.8*r.si,r.si+.8*r.co);step(24);
 ok('fresh aim can start a nearby peek after an intentional exit '+q,P('player.cover.active&&!player.cover.attached'));
 move(r.co,r.si);step(12);move(0,0);step(8);
 ok('pressing back into the wall can attach again '+q,P('player.cover.active&&player.cover.attached'));
}
fresh(0,'HIGH',1,39);aim(1,.8);step(24);
ok('distant aiming cannot acquire a floating wall stance',P('!player.cover?.active'));
fresh(0,'HIGH',0,30);aim(1,0);step(24);
ok('a sealed wall midpoint cannot become a nearby peek',P('!player.cover?.active'));
fresh(0,'LOW',1,30);aim(1,.8);step(24);
ok('nearby aiming leaves approved low-cover contact behavior unchanged',P('!player.cover?.active'));
press(0);probe('latchWall.hp=0;invalidateColIndex();');move(-.2,.8);step();
ok('destroyed contact immediately releases weak outward movement',P('player.x<12&&!player.cover?.active'));
press(0);probe('player.lastMoveAngle=Math.PI;player.activateDash();');move(-1,0);step();
ok('dash exits pressed cover rather than being trapped by its movement filter',P('!player.cover?.active&&player.x<0'));
press(0,'LOW');probe('cyclePlayerStance();');step(22);
ok('manual stand can still release an attached low-cover stance',P("!player.cover.active&&actorStance(player)==='STAND'"));
console.log(`${checks}/${checks} cover aim, turning pose, wall attachment and movement checks passed.`);

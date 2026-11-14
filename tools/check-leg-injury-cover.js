// Injury ownership and the new thin leg geometry must coexist with collision
// cover: visible braced limbs stay hittable while the wall remains physical.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
function fresh(face=0,side=1){
 const angle=face*Math.PI/2,nx=Math.round(Math.cos(angle)),ny=Math.round(Math.sin(angle)),tx=-ny,ty=nx;
 probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
  isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
  inOverworldView=false;window.inNM0SecretOverlay=false;buildGhost=null;
  buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
  bullets=[];particles=[];corpses=[];enemiesList=[];invalidateColIndex();resetForestWildlife();
  viewLeft=viewTop=-10000;viewRight=viewBottom=10000;frameCount=100;deltaTime=1000/60;
  MAX_KILLS=100000;totalKills=0;setMeleeTool('NONE');
  chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
  leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
  player=new Character(-1000,-1000,true);player.hp=player.maxHp=100000;player.shield=0;
  window.coverInjuryTarget=new Character(${nx*28+tx*side*71},${ny*28+ty*side*71},false,'NORMAL');
  coverInjuryTarget.hp=coverInjuryTarget.maxHp=1000;coverInjuryTarget.shield=0;
  coverInjuryTarget.isFriendly=coverInjuryTarget.isNeutral=false;coverInjuryTarget.isArmed=true;
  coverInjuryTarget.currentWeapon=WEAPONS.PISTOL;coverInjuryTarget.ammo=17;
  coverInjuryTarget.aimAngle=${Math.atan2(-ny+side*ty*1.2,-nx+side*tx*1.2)};
  coverInjuryTarget.moveAngle=${angle};coverInjuryTarget.isMoving=false;
  coverInjuryTarget.gait=coverInjuryTarget.walkCycle=0;resetActorStance(coverInjuryTarget);
  window.coverInjuryWall={x:0,y:0,w:${nx?20:160},h:${nx?160:20},isWall:true};
  coverInjuryTarget.cover={active:true,attached:true,kind:'HIGH',blend:1,pop:0,peek:1,
   solid:coverInjuryWall,rectIndex:0,nx:${nx},ny:${ny},tx:${tx},ty:${ty},bodyAngle:${angle},
   aiming:true,openAim:false,validPeek:true,offsetX:${tx*side*22},offsetY:${ty*side*22},
   upper:{x:${tx*side*22},y:${ty*side*22}}};
  enemiesList=[coverInjuryTarget];buildings=activeBuildings=[coverInjuryWall];invalidateColIndex();
  window.coverInjuryNormal={x:${nx},y:${ny}};window.coverInjuryOuter=${side>0?1:0};
  window.coverInjuryLegPoint=(index,u=.95)=>{
   const p=stanceBodyPose(coverInjuryTarget),l=p.joints[index],
    x=l.knee.x+(l.ankle.x-l.knee.x)*u,y=l.knee.y+(l.ankle.y-l.knee.y)*u,
    a=stanceFacingAngle(coverInjuryTarget),ca=Math.cos(a),sa=Math.sin(a);
   return {x:coverInjuryTarget.x+(ca*x-sa*y)*p.size,y:coverInjuryTarget.y+(sa*x+ca*y)*p.size};
  };
  window.coverInjuryRay=(point,fromSide=1)=>{
   const n=coverInjuryNormal,
    b=spawnBullet(point.x+n.x*40*fromSide,point.y+n.y*40*fromSide,
     Math.atan2(-n.y*fromSide,-n.x*fromSide),true,'LEGS',WEAPONS.PISTOL,player);
   b.x-=n.x*80*fromSide;b.y-=n.y*80*fromSide;return b;
  };`);
}

for(let face=0;face<4;face++)for(const side of [-1,1]){
 fresh(face,side);
 ok('high cover uses its visible jointed legs '+face+'/'+side,P(`(()=>{
  const g=humanLegHitGeometry(coverInjuryTarget),p=stanceBodyPose(coverInjuryTarget);
  return Math.abs(g.angle-stanceFacingAngle(coverInjuryTarget))<1e-8&&Math.abs(g.scale-p.size)<1e-8&&
   g.legs.every((l,i)=>{const j=p.joints[i];return Math.hypot(l.sx-j.hip.x,l.sy-j.hip.y,l.kx-j.knee.x,l.ky-j.knee.y,l.ax-j.ankle.x,l.ay-j.ankle.y)<1e-8;});
 })()`));
 probe('window.visibleLegRay=coverInjuryRay(coverInjuryLegPoint(coverInjuryOuter));');
 ok('exposed braced shin remains a thin physical target '+face+'/'+side,
  P('Number.isFinite(stanceProjectileContact(visibleLegRay,coverInjuryTarget))&&legShotHitSide(visibleLegRay,coverInjuryTarget)===coverInjuryOuter'));
 probe('window.protectedLegRay=coverInjuryRay(coverInjuryLegPoint(1-coverInjuryOuter),-1);');
 ok('the wall still shields the planted inner leg '+face+'/'+side,
  P('stanceProjectileContact(protectedLegRay,coverInjuryTarget)===Infinity'));
 probe(`window.coverGap=(()=>{const p=stanceBodyPose(coverInjuryTarget),a=p.joints[0].ankle,b=p.joints[1].ankle;
  const ca=Math.cos(stanceFacingAngle(coverInjuryTarget)),sa=Math.sin(stanceFacingAngle(coverInjuryTarget)),x=(a.x+b.x)/2,y=(a.y+b.y)/2;
  return {x:coverInjuryTarget.x+(ca*x-sa*y)*p.size,y:coverInjuryTarget.y+(sa*x+ca*y)*p.size};})();
  window.gapLegRay={prevX:coverGap.x,prevY:coverGap.y,x:coverGap.x,y:coverGap.y,tH:'LEGS',startX:coverGap.x,startY:coverGap.y};`);
 ok('the braced ankle gap contains no combined pelvis target '+face+'/'+side,
  P('legProjectileContact(gapLegRay,coverInjuryTarget)===null&&stanceProjectileContact(gapLegRay,coverInjuryTarget)===Infinity'));
}

// A change of upper lean can move the outside knee/foot in the same tick.
fresh();
const before=P('JSON.stringify(humanLegHitGeometry(coverInjuryTarget).legs)');
probe('coverInjuryTarget.cover.upper.y=0;coverInjuryTarget.cover.offsetY=0;');
ok('same-frame cover changes refresh thin leg geometry',P('JSON.stringify(humanLegHitGeometry(coverInjuryTarget).legs)')!==before);

for(const side of [-1,1]){
 let struck=false;
 for(let attempt=0;attempt<120;attempt++){
  fresh(0,side);
  probe(`window.nativeCoverLegPoint=coverInjuryLegPoint(coverInjuryOuter);
   window.nativeCoverLegShot=spawnBullet(nativeCoverLegPoint.x+40,nativeCoverLegPoint.y,PI,true,
    'LEGS',WEAPONS.PISTOL,player,${50001+attempt});
   nativeCoverLegShot.vx=-80;nativeCoverLegShot.vy=0;frameCount++;updateBullets();`);
  assert(P('coverInjuryTarget.hp===990&&coverInjuryTarget.decals[0].legIndex===coverInjuryOuter'),
   'native covered leg fixture missed its exposed shin');
  if(P('!!coverInjuryTarget.legInjury')){struck=true;break;}
 }
 ok('a real exposed leg impact acquires its side and releases cover '+side,
  struck&&P('coverInjuryTarget.legInjury.legIndex===coverInjuryOuter&&!coverInjuryTarget.cover'));
}

// Cover is released at impact, and neither the collision-tested fall slide nor
// an external controller update may seize the actor until recovery completes.
for(const serial of [0,1,2]){
 fresh();
 probe(`legInjurySerial=${serial};coverInjuryTarget._enemyCover={goal:{solid:coverInjuryWall},searchMs:0};
  coverInjuryTarget._coverApproach=true;
  coverInjuryTarget.fallHit={frame:frameCount,kind:'LEGS',mx:3,my:0,wound:{isLeg:true,legIndex:1}};
  window.injuryStarted=beginLegInjury(coverInjuryTarget,{tH:'LEGS',a:0,shotId:1001},1);`);
 ok('injury clears active cover and stale approach ownership '+serial,
  P('injuryStarted&&!coverInjuryTarget.cover&&!coverInjuryTarget._coverApproach&&!coverInjuryTarget._enemyCover?.goal'));
 const phases=new Set();
 for(let tick=0;tick<2700&&P('!!coverInjuryTarget.legInjury');tick++){
  probe(`frameCount++;updateLegInjuryActor(coverInjuryTarget,1000/60);
   updateActorCover(coverInjuryTarget,1000/60,-6,0,true);`);
  const phase=P('coverInjuryTarget.legInjury&&coverInjuryTarget.legInjury.phase');if(!phase)break;
  phases.add(phase);
  assert(P('actorCoverSuppressed(coverInjuryTarget)&&!enemyCoverEligible(coverInjuryTarget)&&!coverRenderActive(coverInjuryTarget)&&!coverInjuryTarget.cover'),
   'cover reacquired during '+phase+' outcome'+serial);
 }
 ok('cover cannot take control of any injury phase '+serial,phases.has('FALL')&&phases.has('RECOVER'));
 ok('a recovered survivor becomes eligible for normal cover again '+serial,
  P('!coverInjuryTarget.legInjury&&enemyCoverEligible(coverInjuryTarget)'));
}

fresh();
ok('ordinary standing cover remains active outside injury states',P('coverRenderActive(coverInjuryTarget)&&!actorCoverSuppressed(coverInjuryTarget)&&enemyCoverEligible(coverInjuryTarget)'));
probe("coverInjuryTarget.cover.kind='LOW';coverInjuryTarget.cover.pop=0;");
ok('ordinary low cover retains crouch and critical body remapping',P("actorStance(coverInjuryTarget)==='CROUCH'&&stanceHitProfile(coverInjuryTarget,'BODY').zone==='HEAD'"));
console.log(`${checks}/${checks} thin braced legs, wall protection and exclusive cover/injury ownership checks passed.`);

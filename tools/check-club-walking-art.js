// Exercise the actual normal-figure painter while the club owns movement.
// The orange rectangle in the recording was the campaign jetpack strip.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const run=source=>probe(source),P=source=>run('('+source+')');
const near=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))<1e-8;
let checks=0;
function check(value,label){assert.ok(value,label);checks++;}
ctx.navigator.getGamepads=()=>[];
ctx.keyIsDown=()=>false;
run(`leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
  isStoryMode=false;resetStoryProgress();startAtLevel(1);
  started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
  inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inWorldBuildingMenu=inOverworldView=inTravelMenu=inStoryIntro=inDarchonCall=false;
  var walkingChunk=generateChunkContent(1,3,9);
  var walkingClub=walkingChunk.solid.find(b=>b.cityVenue==='BOXING'&&!b.cityVenueSecondary);
  buildings=activeBuildings=walkingChunk.solid;invalidateColIndex();
  markSectorTowersDown(1);outpostFortState(1).captured=true;
  player.x=walkingClub.cityEntrance.x;player.y=walkingClub.cityEntrance.y;
  player.isArmed=false;player.isMoving=true;player.gait=.7;player.walkCycle=.8;
  player.aimAngle=.2;player.moveAngle=.8;
  player.reloadTimer=player.meleeTimer=player.boxingHold=player.muzzleFlash=0;
  chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=false;
  jetpackUnlocked=true;setMeleeTool('NONE');resetActorStance(player,'STAND');
  frameCount++;updateStandingFacing(player,16.67);
  var walkingCache=player._standingMotion,walkingCacheBefore=JSON.stringify(walkingCache);`);
check(P('!!walkingCache&&walkingCache.active'),'Exterior walking has a live planted-hip cache before entry');
const exteriorBefore=P('standingLowerPose(player)');

function paintPlayer(){
  const native={fill:ctx.fill,rect:ctx.rect,limb:ctx.figureCelLimb};
  const orange=[],pants=[];let fill=[];
  const pantsColor=P('player.pantsCol.levels.slice(0,3)');
  ctx.fill=(...args)=>{fill=args;return native.fill(...args);};
  ctx.rect=(...args)=>{
    if(fill[0]===255&&fill[1]===100&&fill[2]===0&&args[2]===4&&args[3]===16)orange.push(args);
    return native.rect(...args);
  };
  ctx.figureCelLimb=(...args)=>{
    const color=args[10]&&(args[10].levels||args[10]);
    if(color&&pantsColor.every((value,i)=>color[i]===value))pants.push(args.slice(1,10));
    return native.limb(...args);
  };
  try{run('player.show();');}finally{ctx.fill=native.fill;ctx.rect=native.rect;ctx.figureCelLimb=native.limb;}
  return {orange,pants};
}

check(paintPlayer().orange.length===1,'The normal exterior figure paints the owned orange jetpack strip');
check(P('enterCityBoxingClub(walkingClub)'),'The unlocked public doorway enters the boxing club');
check(P('jetpackUnlocked&&!boxingActive(player)&&player.meleeTimer===0&&player.reloadTimer===0'),
  'Free walking keeps jetpack ownership and uses the normal figure without melee or reload');

for(const [name,dx,dy] of [['north',0,-3.7],['east',3.7,0],['south',0,3.7],['west',-3.7,0]]){
  run(`player.x=0;player.y=320;
    for(let frame=0;frame<12;frame++){
      frameCount++;frontierSaloonMove(player,${dx},${dy});
      if(player.isMoving)player.aimAngle=player.moveAngle;
      updateStandingFacing(player,16.67);
    }`);
  const lower=P('standingLowerPose(player)'),angle=P('player.moveAngle'),paint=paintPlayer();
  check(P('player.isMoving')&&near(lower.angle,angle)&&near(lower.yaw,0),
    'Interior '+name+' movement draws hips with the current walking heading');
  check(paint.orange.length===0&&paint.pants.length===2,
    'Interior '+name+' movement paints both trouser legs without the orange jetpack strip');
  check(P('jetpackUnlocked&&player._standingMotion===walkingCache&&JSON.stringify(walkingCache)===walkingCacheBefore'),
    'Interior '+name+' movement leaves ownership and the exterior hip cache unchanged');
}

run('exitFrontierSaloon();');
const exteriorAfter=P('standingLowerPose(player)');
check(paintPlayer().orange.length===1&&P('jetpackUnlocked'),
  'The jetpack strip returns immediately outside with ownership preserved');
check(near(exteriorAfter.angle,exteriorBefore.angle)&&P('player._standingMotion===walkingCache&&JSON.stringify(walkingCache)===walkingCacheBefore'),
  'Returning outside resumes the original hip cache without changing its state');
console.log('Club walking art: '+checks+' painter, ownership and interior/exterior hip checks passed.');

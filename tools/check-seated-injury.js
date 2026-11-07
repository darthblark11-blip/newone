// A seated survivor must actually land on the back before lifting the chest.
// Observe native pose landmarks, height profiles, weapon motion and AI phases.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
function stage(side=0,moving=false,weapon='PISTOL',heading=0){
  probe(`currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
    isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
    inOverworldView=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
    window.inNM0SecretOverlay=false;buildGhost=null;frameCount=400;
    buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
    bullets=[];particles=[];enemiesList=[];invalidateColIndex();resetForestWildlife();
    leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
    player=new Character(300,0,true);player.hp=player.maxHp=100000;player.shield=0;
    window.seatedVictim=new Character(0,0,false,'NORMAL');
    seatedVictim.hp=seatedVictim.maxHp=1000;seatedVictim.shield=0;seatedVictim.isArmed=true;
    seatedVictim.currentWeapon=WEAPONS.${weapon};seatedVictim.ammo=30;
    seatedVictim.aimAngle=seatedVictim.moveAngle=${heading};seatedVictim.isMoving=${moving};
    seatedVictim.gait=${moving?.8:0};seatedVictim.walkCycle=1.2;resetActorStance(seatedVictim);
    rememberFigureMotion(seatedVictim,${moving?4:0}*Math.cos(${heading}),${moving?4:0}*Math.sin(${heading}));
    legInjurySerial=1;if(!beginLegInjury(seatedVictim,{a:${heading}},${side}))throw Error('seated fixture rejected');
    enemiesList=[seatedVictim];`);
}
function advance(ms,dt=1000/60){
  probe(`for(let left=${ms};left>1e-7;){const step=Math.min(left,${dt});
    frameCount++;updateLegInjuryActor(seatedVictim,step);left-=step;}`);
}
const body=()=>P('stanceBodyPose(seatedVictim)');
for(const side of [0,1])for(const moving of [false,true])for(const weapon of ['PISTOL','ASSAULT_RIFLE']){
  stage(side,moving,weapon);
  const label=`leg${side}/${moving?'moving':'still'}/${weapon}`,fall=P('seatedVictim.legInjury.fallMs');
  advance(fall);
  ok(label+' first lands flat on the back',P("seatedVictim.legInjury.phase==='SUPINE'&&actorStance(seatedVictim)==='PRONE'"));
  const floor=body();
  ok(label+' skull and chest lie behind the hips',floor.head.x<floor.hipX-18&&floor.chestX<floor.hipX-7);
  ok(label+' forward feet remain beyond the hips',floor.joints.every(j=>j.ankle.x>floor.hipX+20));
  ok(label+' exposes the face and floor-side arm layer',floor.roll.back===1&&floor.roll.foreground);
  ok(label+' overhead shots miss while the actor is flat',P("stanceHitProfile(seatedVictim,'HEAD')===null&&stanceHitProfile(seatedVictim,'BODY')===null&&stanceHitProfile(seatedVictim,'LEGS').zone==='HEAD'"));
  probe('seatedVictim.fireTimer=0;bullets=[];');advance(150);
  ok(label+' waits on the floor without firing',P("seatedVictim.legInjury.phase==='SUPINE'&&bullets.length===0"));
  const frozen=P('JSON.stringify({s:seatedVictim.legInjury,x:seatedVictim.x,y:seatedVictim.y,stance:seatedVictim.stance})');
  probe('doTick=false;');advance(500);
  ok(label+' pauses the entire drop and rise',frozen===P('JSON.stringify({s:seatedVictim.legInjury,x:seatedVictim.x,y:seatedVictim.y,stance:seatedVictim.stance})'));
  probe('doTick=true;');advance(P('LEG_INJURY_SUPINE_MS')-150);
  ok(label+' starts a separate hip-led sit-up',P("seatedVictim.legInjury.phase==='SIT_UP'"));
  advance(P('LEG_INJURY_SIT_UP_MS')*.3);
  ok(label+' early rise still lies below body-height fire',P("stanceHitProfile(seatedVictim,'BODY')===null"));
  const early=body(),feet=early.joints.map(j=>({...j.ankle}));
  advance(P('LEG_INJURY_SIT_UP_MS')*.4);
  const late=body();
  ok(label+' head and sternum rise toward the seated pose',late.head.x>early.head.x&&late.chestX>early.chestX);
  ok(label+' feet stay planted throughout the torso rise',late.joints.every((j,i)=>Math.hypot(j.ankle.x-feet[i].x,j.ankle.y-feet[i].y)<1e-7));
  ok(label+' lowered torso becomes vulnerable at the actual intermediate height',P("stanceHitProfile(seatedVictim,'BODY').zone==='HEAD'&&stanceHitProfile(seatedVictim,'LEGS').zone==='BODY'"));
  ok(label+' cannot fire while still sitting up',P('bullets.length===0'));
  // Observe the real rigid mount across the last half of the rise. A finite
  // difference catches a ready/carry boolean snap at the phase boundary.
  let previous=P('stanceWeaponMount(seatedVictim)'),largest=0;
  for(let tick=0;tick<Math.ceil(P('LEG_INJURY_SIT_UP_MS')*.3/5)+2;tick++){
    advance(5);const mount=P('stanceWeaponMount(seatedVictim)');
    largest=Math.max(largest,Math.hypot(mount.x-previous.x,mount.y-previous.y),Math.abs(mount.angle-previous.angle)*20);
    previous=mount;
  }
  ok(label+' firearm eases into its ready mount without a late snap',largest<3);
  ok(label+' seated fighting begins after the full back-to-seat motion',P("seatedVictim.legInjury.phase==='SEATED'"));
  const seated=body();
  ok(label+' finishes upright above the hip with the same extended feet',seated.head.x>seated.hipX+12&&seated.joints.every((j,i)=>Math.hypot(j.ankle.x-feet[i].x,j.ankle.y-feet[i].y)<1e-7));
  advance(200);
  ok(label+' retains native firing once seated',P('bullets.length>0'));
}
for(const rate of [30,60,120]){
  stage();const total=P('seatedVictim.legInjury.fallMs+LEG_INJURY_SUPINE_MS+LEG_INJURY_SIT_UP_MS+LEG_INJURY_DOWNED_MS+LEG_INJURY_RECOVER_MS');
  advance(total,1000/rate);
  ok(rate+'Hz complete seated sequence releases normal movement',P("!seatedVictim.legInjury&&actorStance(seatedVictim)==='STAND'&&seatedVictim.state==='CHASE'"));
}
for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const rise of [0,.3,.8]){
  stage(1,false,'ASSAULT_RIFLE',heading);
  advance(P('seatedVictim.legInjury.fallMs')+(rise?P('LEG_INJURY_SUPINE_MS')+P('LEG_INJURY_SIT_UP_MS')*rise:100));
  probe(`window.sourceBody=snapshotLegInjuryBody(seatedVictim);window.sourceHeading=stanceFacingAngle(seatedVictim);
    seatedVictim.decals=[{isLeg:true,legIndex:1,legSegment:1,legU:.7,legV:.1,sz:4}];
    seatedVictim.hp=0;seatedVictim.dead=true;
    seatedVictim.fallHit={frame:frameCount,kind:'LEGS',weapon:WEAPONS.PISTOL,angle:1.4,force:3,mx:0,my:0,
      x:seatedVictim.x,y:seatedVictim.y,wound:seatedVictim.decals[0],fatal:true};
    window.seatedCorpse=new Corpse(seatedVictim.x,seatedVictim.y,seatedVictim.moveAngle,seatedVictim.aimAngle,
      seatedVictim.shirtCol,seatedVictim.pantsCol,0,0,seatedVictim.decals,seatedVictim.currentWeapon,
      1.4,seatedVictim.eType,seatedVictim.bodyW,seatedVictim.bodyH,seatedVictim);`);
  ok(`${heading}/${rise} a fatal drop/rise remains face-up`,P('!seatedCorpse.fall.faceDown&&!!seatedCorpse.injuryFrom.body'));
  const src=P('sourceBody'),frozen=P('seatedCorpse.injuryFrom.body'),angle=P('figureFallYaw(seatedCorpse.fall,seatedCorpse.rag)'),sourceAngle=P('sourceHeading');
  const world=(p,a)=>({x:Math.cos(a)*p.x-Math.sin(a)*p.y,y:Math.sin(a)*p.x+Math.cos(a)*p.y});
  const landmarks=b=>[b.head,{x:b.chestX,y:b.chestY},...b.joints.flatMap(j=>[j.hip,j.knee,j.ankle,j.shoulder,j.elbow,j.wrist])];
  const oldPoints=landmarks(src),newPoints=landmarks(frozen);
  ok(`${heading}/${rise} actual supine/rising joints do not jump on death`,oldPoints.every((p,i)=>{
    const a=world(p,sourceAngle),b=world(newPoints[i],angle);return Math.hypot(a.x-b.x,a.y-b.y)<1e-7;
  }));
}
console.log(`${checks}/${checks} native back-drop, planted sit-up, elevation, pause and weapon continuity checks passed.`);

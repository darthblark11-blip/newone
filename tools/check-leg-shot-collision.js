// Low firearm rounds sweep the actual paired leg silhouettes and finish at
// 15/20/26 m for standing/crouched/prone shooters. Head/body flight,
// nonhuman anatomy and stance promotions stay separate.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,seed=18271;
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const u=seed/4294967296;
 return a===undefined?u:Array.isArray(a)?a[Math.floor(u*a.length)]:b===undefined?u*a:a+(b-a)*u;};
const ok=(name,value)=>{assert.ok(value,name);checks++;};
function stage(){
 probe(`currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
 inWorldBuildingMenu=inTravelMenu=inOverworldView=inUpgradeMenu=false;
 window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
 buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
 particles=[];bullets=[];corpses=[];enemiesList=[];invalidateColIndex();resetForestWildlife();resetShovelState();
 player=new Character(-2000,-2000,true);player.shield=0;resetActorStance(player);
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 viewLeft=viewTop=-10000;viewRight=viewBottom=10000;MAX_KILLS=100000;totalKills=0;
 setMeleeTool('NONE');frameCount++;`);
}
stage();
for(const heading of [0,.43,Math.PI/2,Math.PI,-Math.PI/2])for(const stride of [0,.7,2.1]){
 probe(`frameCount++;window.target=new Character(0,0,false,'NORMAL');target.isFriendly=target.isNeutral=false;
 target.aimAngle=target.moveAngle=${heading};target.isMoving=${stride!==0};target.walkCycle=${stride};target.gait=.9;
 resetActorStance(target);window.geometry=humanLegHitGeometry(target);`);
 ok(`${heading}/${stride} shared geometry contains two finite leg chains`,P(`geometry.legs.length===2&&geometry.legs.every(p=>
  [p.sx,p.sy,p.kx,p.ky,p.ax,p.ay,p.hipW,p.kneeW,p.ankleW].every(Number.isFinite))`));
 for(const side of [0,1]){
  probe(`window.limb=geometry.legs[${side}];window.cy=(limb.ky+limb.ay)*.5;
   window.localStart=Math.min(limb.sx,limb.kx,limb.ax)-20,localEnd=Math.max(limb.sx,limb.kx,limb.ax)+20;
   window.co=Math.cos(geometry.angle),sn=Math.sin(geometry.angle);
   window.lowRay={prevX:geometry.x+(co*localStart-sn*cy)*geometry.scale,
    prevY:geometry.y+(sn*localStart+co*cy)*geometry.scale,
    x:geometry.x+(co*localEnd-sn*cy)*geometry.scale,y:geometry.y+(sn*localEnd+co*cy)*geometry.scale,tH:'LEGS'};
   window.contact=legProjectileContact(lowRay,target);`);
  ok(`${heading}/${stride}/${side} a fast swept ray strikes only its physical leg`,P(`contact&&contact.index===${side}&&contact.t>=0&&contact.t<=1`));
  ok(`${heading}/${stride}/${side} stance contact uses the same thin silhouette`,P('Math.abs(stanceProjectileContact(lowRay,target)-contact.t)<1e-8'));
  probe('lowRay.x=lowRay.prevX+(lowRay.x-lowRay.prevX)*contact.t;lowRay.y=lowRay.prevY+(lowRay.y-lowRay.prevY)*contact.t;');
  ok(`${heading}/${stride}/${side} side survives clipping to the actual impact`,P(`legShotHitSide(lowRay,target)===${side}`));
 }
 // The pair stays separated even when gait changes their depth along X.
 probe(`window.gapRay={prevX:-35*Math.cos(${heading}),prevY:-35*Math.sin(${heading}),
  x:35*Math.cos(${heading}),y:35*Math.sin(${heading}),tH:'LEGS'};`);
 ok(`${heading}/${stride} the empty center gap cannot absorb a low round`,P('stanceProjectileContact(gapRay,target)===Infinity'));
 probe(`window.outerRay={prevX:-35*Math.cos(${heading})-13*Math.sin(${heading}),
  prevY:-35*Math.sin(${heading})+13*Math.cos(${heading}),
  x:35*Math.cos(${heading})-13*Math.sin(${heading}),y:35*Math.sin(${heading})+13*Math.cos(${heading}),tH:'LEGS'};`);
 ok(`${heading}/${stride} the air outside the pants is not a hit`,P('stanceProjectileContact(outerRay,target)===Infinity'));
 probe('gapRay.tH="BODY";');
 ok(`${heading}/${stride} the ordinary torso target remains unchanged`,P('stanceProjectileContact(gapRay,target)!==Infinity'));
}

stage();
probe(`window.target=new Character(0,0,false,'NORMAL');target.aimAngle=target.moveAngle=0;resetActorStance(target);
 window.a={x:0,y:0,sz:5};mapLegHitDecal(target,0,0,a,target,.3,1);`);
ok('a captured collision side overrides any ambiguous centerline decal projection',P('a.isLeg&&a.legIndex===1'));
for(const [stance,incoming,zone]of [['CROUCH','LEGS','BODY'],['CROUCH','BODY','HEAD'],['PRONE','LEGS','HEAD']]){
 probe(`frameCount++;resetActorStance(target,'${stance}');window.profile=stanceHitProfile(target,'${incoming}');
  window.ray={prevX:-80,prevY:0,x:80,y:0,tH:'${incoming}'};`);
 ok(`${stance}/${incoming} retains its authored elevation promotion and footprint`,P(`profile.zone==='${zone}'&&stanceProjectileContact(ray,target,profile)!==Infinity`));
}
stage();
probe(`window.target=new Character(0,0,false,'ROBOT');window.ray={prevX:-30,prevY:0,x:30,y:0,tH:'LEGS'};`);
ok('machines keep their existing body footprint for low shots',P('stanceProjectileContact(ray,target)!==Infinity'));

// Native flight clamps the last partial step. It still resolves target
// contacts in that step before an empty round drops onto the floor.
for(const [stance,range]of [['STAND',300],['CROUCH',400],['PRONE',520]])
for(const heading of [0,.63,Math.PI/2,Math.PI,-Math.PI/2])for(const weapon of ['PISTOL','SMG','SHOTGUN','REVOLVER']){
 stage();
 probe(`resetActorStance(player,'${stance}');window.round=spawnBullet(0,0,${heading},true,'LEGS',WEAPONS.${weapon},player);
  for(let i=0;i<100&&round.active;i++){frameCount++;updateBullets();}`);
 ok(`${stance}/${weapon}/${heading} a low round drops at its launch-stance range`,P(`!round.active&&round.l===0&&Math.abs(Math.hypot(round.x,round.y)-${range})<1e-7&&round.legShotTravel===${range}`));
 ok(`${stance}/${weapon}/${heading} the floor gets one small paired dust contact`,P("particles.filter(p=>p.t==='DUST').length===2"));
}
for(const [stance,range]of [['STAND',300],['CROUCH',400],['PRONE',520]])
for(const speed of [17,44,700])for(const offset of [7,20]){
 const x=range+offset;
 stage();
 probe(`window.target=new Character(${x},6,false,'NORMAL');target.hp=target.maxHp=100000;
  target.aimAngle=target.moveAngle=0;target.isNeutral=target.isFriendly=false;target.isMoving=false;resetActorStance(target);enemiesList=[target];
  resetActorStance(player,'${stance}');
  window.round=spawnBullet(0,0,0,true,'LEGS',WEAPONS.PISTOL,player);
  round.vx=${speed};round.vy=0;
  for(let i=0;i<100&&round.active;i++){frameCount++;updateBullets();}`);
 ok(`${stance}/speed${speed}/root${x} respects the final partial leg-shot segment`,P(offset===7?'target.hp===99990':'target.hp===100000'));
}
// Airborne rounds own their launch range; stance transitions and death later
// in flight cannot extend or shorten them, including reused pool records.
for(const [stance,range]of [['STAND',300],['CROUCH',400],['PRONE',520]]){
 stage();
 probe(`resetActorStance(player,'${stance}');window.round=spawnBullet(0,0,0,true,'LEGS',WEAPONS.PISTOL,player);
  frameCount++;updateBullets();resetActorStance(player,'${stance==='PRONE'?'STAND':'PRONE'}');
  player.dead=true;player.hp=0;player.isFriendly=true;
  for(let i=0;i<100&&round.active;i++){frameCount++;updateBullets();}`);
 ok(`${stance} range stays frozen after the shooter changes stance and dies`,P(`round.legShotRange===${range}&&Math.abs(round.x-${range})<1e-7`));
 probe(`player.dead=false;player.hp=100;resetActorStance(player,'CROUCH');round.init(0,0,0,true,'LEGS',WEAPONS.PISTOL,player);`);
 ok(`${stance} reused bullet resamples its next shooter's crouch`,P('round.legShotRange===400&&round.legShotTravel===0&&!round.legShotAtFloor'));
}
stage();
probe(`player.cover={active:true,kind:'LOW',blend:1,pop:0,bodyAngle:0,upper:{x:0,y:0}};
 window.round=spawnBullet(0,0,0,true,'LEGS',WEAPONS.PISTOL,player);`);
ok('effective crouched cover grants the crouched range without changing the raw stance',P("player.stance.value===0&&actorStance(player)==='CROUCH'&&round.legShotRange===400"));
probe('player.cover.pop=1;round.init(0,0,0,true,\'LEGS\',WEAPONS.PISTOL,player);');
ok('a standing pop from low cover uses standing range',P("actorStance(player)==='STAND'&&round.legShotRange===300"));
probe("round.init(0,0,0,true,'LEGS',WEAPONS.PISTOL,null);");
ok('rounds without an actor use the standing range',P('round.legShotRange===300'));

// Reproduce the reported stalemate: a gunner can remain at his low-cover
// firing spot and hit a prone player beyond the previous 13 m muzzle cap.
stage();
probe(`player.x=355;player.y=8;player.hp=player.maxHp=1000;resetActorStance(player,'PRONE');
 window.coverGunner=new Character(0,0,false,'NORMAL');coverGunner.hp=coverGunner.maxHp=1000;
 coverGunner.isFriendly=coverGunner.isNeutral=false;coverGunner.currentWeapon=WEAPONS.PISTOL;coverGunner.ammo=20;
 coverGunner.isMoving=false;coverGunner.aimAngle=coverGunner.moveAngle=0;coverGunner.stanceAimZone='LEGS';resetActorStance(coverGunner);
 coverGunner.cover={active:true,kind:'LOW',blend:1,pop:1,aiming:true,bodyAngle:0,upper:{x:0,y:0}};
 window.coverBehind={x:-30,y:0,w:20,h:100,isLowWall:true,hp:1000};buildings=activeBuildings=[coverBehind];invalidateColIndex();
 enemiesList=[coverGunner];coverGunner.fire(0);window.coverRound=bullets[0];
 for(let i=0;i<100&&coverRound&&coverRound.active;i++){frameCount++;updateBullets();}`);
ok('a covered gunner no longer leaves a prone player invulnerable beyond the old cap',P('coverRound&&player.hp<1000&&Math.hypot(coverRound.x-coverRound.startX,coverRound.y-coverRound.startY)>260'));
ok('the gunner hits without abandoning his covered firing location',P('coverGunner.x===0&&coverGunner.y===0&&coverGunner.cover.active'));
stage();
probe(`window.round=spawnBullet(0,0,0,true,'LEGS',WEAPONS.PISTOL,player);doTick=false;
 for(let i=0;i<30;i++)updateBullets();`);
ok('paused low shots keep their range and floor state frozen',P('round.x===0&&round.legShotTravel===0&&!round.legShotAtFloor&&round.active'));
probe(`doTick=true;round.legShotTravel=300;round.legShotAtFloor=true;
 round.init(0,0,0,true,'BODY',WEAPONS.PISTOL);`);
ok('pooled reuse clears low-shot travel and expiry state',P('round.legShotRange===0&&round.legShotTravel===0&&!round.legShotAtFloor'));
probe("round.init(0,0,0,true,'HEAD',WEAPONS.PISTOL);");
ok('head-height rounds retain their own full range',P('round.legShotRange===0'));
for(const weapon of ['BOW','TASER','ROCKET_LAUNCHER']){
 probe(`round.init(0,0,0,true,'LEGS',WEAPONS.${weapon});`);
 ok(`${weapon} retains its own non-ballistic range lifecycle`,P('round.legShotRange===0'));
}
probe("round.init(0,0,0,true,'LEGS','ALIEN_LASER');");
ok('energy projectiles keep their existing range lifecycle',P('round.legShotRange===0'));
console.log(`${checks}/${checks} thin leg collision, launch-stance range, covered counterfire, floor, pause and pooling checks passed.`);

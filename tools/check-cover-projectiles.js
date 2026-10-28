// Real pooled rounds must meet cover before actors, keep launch height while
// the shooter moves, and hit the visible upper body without moving its legs.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,seed=81211;
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;return a===undefined?r:Array.isArray(a)?a[Math.floor(r*a.length)]:b===undefined?a*r:a+(b-a)*r;};
const ok=(label,value)=>{assert.ok(value,label);checks++;};
function fresh(kind='HIGH',stance='STAND'){
 probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 inOverworldView=false;window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
 viewLeft=viewTop=-10000;viewRight=viewBottom=10000;frameCount=100;MAX_KILLS=100000;totalKills=totalShotsHit=0;
 bullets=[];particles=[];corpses=[];barrels=[];parkingCars=activeParkingCars=[];resetForestWildlife();
 setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 player=new Character(-1000,-1000,true);player.hp=player.maxHp=1000;player.shield=0;
 window.coverVictim=new Character(100,0,false,'NORMAL');coverVictim.hp=coverVictim.maxHp=1000;
 coverVictim.isFriendly=coverVictim.isNeutral=false;coverVictim.aimAngle=coverVictim.moveAngle=0;
 coverVictim.isMoving=false;coverVictim.walkCycle=coverVictim.gait=0;resetActorStance(coverVictim,'${stance}');
 enemiesList=[coverVictim];window.shotWall={x:50,y:0,w:2,h:200,${kind==='LOW'?'isLowWall':'isWall'}:true};
 buildings=activeBuildings=[shotWall];invalidateColIndex();`);
}
function launch(zone='BODY',weapon='PISTOL',x=0,y=0,angle=0,speed=140){
 probe(`window.coverRound=spawnBullet(${x},${y},${angle},true,'${zone}',WEAPONS.${weapon},player);
 coverRound.vx=Math.cos(${angle})*${speed};coverRound.vy=Math.sin(${angle})*${speed};`);
}
function tick(n=1){probe(`for(let i=0;i<${n};i++){frameCount++;updateBullets();}`);}
for(const zone of ['HEAD','BODY','LEGS'])for(const weapon of ['PISTOL','SMG','ASSAULT_RIFLE','SHOTGUN','BOW','TASER']){
 fresh();launch(zone,weapon);tick();
 ok(zone+' '+weapon+' cannot hit an actor before a thin high wall',P('coverVictim.hp===1000&&coverVictim.decals.length===0&&coverVictim.stunTimer===0'));
 ok(zone+' '+weapon+' consumes at the actual wall and preserves launch elevation',P(`!coverRound.active&&coverRound.x>=49&&coverRound.x<=51&&coverRound.tH==='${zone}'`));
}
fresh();probe('coverVictim.x=25;');launch();tick();
ok('an actor before the wall is still hit before the wall consumes the round',P('coverVictim.hp===980&&coverVictim.decals.length===1&&coverRound.x<49'));
fresh();probe('shotWall.isTower=true;shotWall.hp=1000;window.farWall={x:80,y:0,w:4,h:200,isTower:true,hp:1000};buildings=activeBuildings=[farWall,shotWall];invalidateColIndex();');launch();tick();
ok('the nearest swept wall owns damage even when the prop array is reversed',P('shotWall.hp===980&&farWall.hp===1000&&coverVictim.hp===1000'));
for(const zone of ['HEAD','BODY']){
 fresh('LOW');launch(zone);tick();
 ok('standing '+zone+' fire passes above a waist-high solid',P(`coverVictim.hp===${zone==='HEAD'?900:980}&&coverVictim.decals.length===1`));
}
fresh('LOW');launch('LEGS');tick();
ok('leg-height fire cannot pass through low cover',P('coverVictim.hp===1000&&!coverRound.active&&coverRound.x<51'));
for(const stance of ['CROUCH','PRONE']){
 fresh('LOW',stance);launch(stance==='CROUCH'?'BODY':'LEGS');tick();
 ok('manual '+stance+' behind actual low cover is protected without an automatic cover flag',P('!coverVictim.cover&&coverVictim.hp===1000&&coverVictim.decals.length===0'));
 fresh('LOW');probe(`resetActorStance(player,'${stance}');`);launch('HEAD');tick();
 ok('manual '+stance+' shots use their actual low launch height',P('coverRound.coverLaunchLow&&!coverRound.active&&coverVictim.hp===1000'));
}
fresh('LOW');launch();probe("resetActorStance(player,'CROUCH');");tick();
ok('a round launched standing stays high when its shooter ducks mid-flight',P('!coverRound.coverLaunchLow&&coverVictim.hp===980&&coverRound.tH===\'BODY\''));
fresh('LOW');probe("resetActorStance(player,'CROUCH');");launch();probe("resetActorStance(player,'STAND');");tick();
ok('a round launched crouched stays low when its shooter rises mid-flight',P('coverRound.coverLaunchLow&&coverVictim.hp===1000&&!coverRound.active'));
probe('window.oldCoverRound=coverRound;');launch();tick();
ok('the same pooled record resets launch height for a later standing shot',P('coverRound===oldCoverRound&&!coverRound.coverLaunchLow&&coverVictim.hp===980'));

// Parked cars are the same waist-height collision objects even without w/h.
fresh('LOW');probe('buildings=activeBuildings=[];parkingCars=activeParkingCars=[{x:50,y:0}];invalidateColIndex();');launch();tick();
ok('standing body shots clear the top of a parked car',P('coverVictim.hp===980'));
fresh('LOW');probe('buildings=activeBuildings=[];parkingCars=activeParkingCars=[{x:50,y:0}];invalidateColIndex();');launch('LEGS');tick();
ok('parked car geometry intercepts low fire before a farther actor',P('coverVictim.hp===1000&&!coverRound.active&&coverRound.x>=25&&coverRound.x<26'));

function peak(side=1){
 fresh();probe(`shotWall.x=40;shotWall.w=20;shotWall.h=160;coverVictim.x=12;coverVictim.y=${side*71};
 coverVictim.cover={active:true,kind:'HIGH',blend:1,peek:1,pop:0,nx:-1,ny:0,tx:0,ty:-1,
 bodyAngle:Math.PI,aiming:true,openAim:false,validPeek:true,offsetX:0,offsetY:${side*21},upper:{x:0,y:${side*21}}};
 invalidateColIndex();`);
}
for(const side of [-1,1]){
 peak(side);const head=P("coverActorHitCenter(coverVictim,'HEAD','HEAD')");
 const headAngle=P("stanceFacingAngle(coverVictim)+stanceBodyPose(coverVictim).yaw");
 launch('HEAD','PISTOL',160,head.y,Math.PI,200);tick();
 ok('an exposed head can be hit around the real wall end '+side,P('coverVictim.hp===900&&coverVictim.decals.length===1&&coverVictim.decals[0].isHead'));
 ok('the head wound follows the same rotated frame as the visible head '+side,
   P(`Math.abs(Math.atan2(Math.sin(coverVictim.decals[0].shotA-(${Math.PI-headAngle})),Math.cos(coverVictim.decals[0].shotA-(${Math.PI-headAngle}))))<1e-7`));
 ok('the upper hit keeps a finite pose-local vertical wound '+side,P('Number.isFinite(coverVictim.decals[0].x+coverVictim.decals[0].y)&&Math.abs(coverVictim.decals[0].y)<1e-6'));
 peak(side);const body=P("coverActorHitCenter(coverVictim,'BODY','BODY')");
 launch('BODY','PISTOL',160,body.y,Math.PI,200);tick();
 ok('the leaning torso is also exposed while its collision root stays behind cover '+side,P('coverVictim.hp===980&&coverVictim.decals.length===1'));
 peak(side);launch('LEGS','PISTOL',160,side*71,Math.PI,200);tick();
 ok('the legs remain physically protected on the far side during a standing peek '+side,P('coverVictim.hp===1000&&coverVictim.decals.length===0&&!coverRound.active'));
 peak(side);
 const shin=P(`(()=>{const p=stanceBodyPose(coverVictim),j=p.joints[${side>0?1:0}],
   x=j.knee.x+(j.ankle.x-j.knee.x)*.8,y=j.knee.y+(j.ankle.y-j.knee.y)*.8,
   a=stanceFacingAngle(coverVictim);return {x:coverVictim.x+(Math.cos(a)*x-Math.sin(a)*y)*p.size,
   y:coverVictim.y+(Math.sin(a)*x+Math.cos(a)*y)*p.size};})()`);
 launch('LEGS','PISTOL',-120,shin.y,0,140);tick();
 ok('cover does not make exposed legs invulnerable from the open side '+side,P('coverVictim.hp===980&&coverVictim.decals[0].isLeg'));
}

// A low cover target must expose its actual raised upper body before it is hit.
fresh('LOW');probe("coverVictim.cover={active:true,kind:'LOW',blend:1,pop:0,peek:0,bodyAngle:Math.PI,upper:{x:0,y:0}};");launch();tick();
ok('automatic crouch cover protects its lowered upper body',P('actorStance(coverVictim)===\'CROUCH\'&&coverVictim.hp===1000'));
fresh('LOW');probe("coverVictim.cover={active:true,kind:'LOW',blend:1,pop:1,peek:0,bodyAngle:Math.PI,upper:{x:0,y:0},aiming:true};");launch();tick();
ok('a popped-up actor is vulnerable to actual body shots above low cover',P('coverVictim.hp===980'));

fresh();probe('window.coverPauseRound=spawnBullet(0,0,0,true,\'BODY\',WEAPONS.PISTOL,player);doTick=false;window.coverPauseSnapshot=JSON.stringify({x:coverPauseRound.x,y:coverPauseRound.y,l:coverPauseRound.l,low:coverPauseRound.coverLaunchLow});updateBullets();');
ok('pause cannot advance collision sweeps or launch-height state',P('JSON.stringify({x:coverPauseRound.x,y:coverPauseRound.y,l:coverPauseRound.l,low:coverPauseRound.coverLaunchLow})===coverPauseSnapshot'));
console.log(`${checks}/${checks} cover swept impact, height, exposed anatomy and pooled shot checks passed.`);

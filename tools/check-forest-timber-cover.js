// Timber is physical waist-high cover: high shots clear it, lowered bodies
// shelter behind it, and contact follows each actual rotated face.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=code=>probe('('+code+')');
let checks=0;const ok=(value,label)=>{checks++;assert.ok(value,label);};
ctx.setTimeout=()=>0;
function fresh(species='LOG',angle=.7,scale=1.4){
 probe(`chunkMgr=null;resetRunState();currentLevel=currentBiome=2;BIOME_ACTIVE=started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 authoredCore=authoredMask=authoredChunks=null;biomeState={};
 viewLeft=viewTop=-10000;viewRight=viewBottom=10000;frameCount=100;MAX_KILLS=100000;
 bullets=[];particles=[];corpses=[];barrels=[];parkingCars=activeParkingCars=[];resetForestWildlife();
 setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 __decor={t:'${species}',forestSpecies:'${species}',forestRegion:'TIMBER',forestHabitat:'TIMBER',
   forestLiveProp:true,x:300,y:300,s:${scale},r:${angle},c:.41};
 __ch={cx:0,cy:0,solid:[],decor:[__decor],decorBake:[],cars:[]};
 appendForestTimberSolids(2,0,0,__ch);__wood=__ch.solid[0];
 buildings=activeBuildings=[__wood];chunkMgr={chunks:new Map([['0,0',__ch]])};invalidateColIndex();
 window.resources={WOOD:0,METAL:0,STONE:0};resourceDrops=[];
 function woodWorld(x,y){return {x:__wood.x+x*__wood.forestTimberCos-y*__wood.forestTimberSin,
   y:__wood.y+x*__wood.forestTimberSin+y*__wood.forestTimberCos};}
 __start=woodWorld(0,-160);__end=woodWorld(0,140);
 player=new Character(__start.x,__start.y,true);player.currentWeapon=WEAPONS.PISTOL;
 player.hp=player.maxHp=1000;player.shield=0;player.aimAngle=Math.atan2(__end.y-__start.y,__end.x-__start.x);
 coverVictim=new Character(__end.x,__end.y,false,'NORMAL');coverVictim.hp=coverVictim.maxHp=1000;
 coverVictim.shield=0;coverVictim.isFriendly=coverVictim.isNeutral=false;
 coverVictim.currentWeapon=WEAPONS.PISTOL;coverVictim.aimAngle=player.aimAngle+Math.PI;
 resetActorStance(player);resetActorStance(coverVictim);enemiesList=[coverVictim];`);
}
function launch(zone='BODY',ticks=1){
 probe(`__zone='${zone}';__profile=stanceHitProfile(coverVictim,__zone);
 __centre=coverActorHitCenter(coverVictim,__zone,__profile?__profile.zone:__zone);
 __shotDx=__centre.x-__start.x;__shotDy=__centre.y-__start.y;
 __round=spawnBullet(__start.x,__start.y,Math.atan2(__shotDy,__shotDx),true,__zone,WEAPONS.PISTOL,player);
 __round.vx=__shotDx*1.15;__round.vy=__shotDy*1.15;
 for(let i=0;i<${ticks};i++){frameCount++;updateBullets();}`);
}
function contact(aiming=false){
 probe(`__face=coverSolidFaces(__wood)[3];__along=(__face.edgeMin+__face.edgeMax)*.5;
 coverVictim.x=__face.nx*(__face.plane+17)+__face.tx*__along;
 coverVictim.y=__face.ny*(__face.plane+17)+__face.ty*__along;
 for(let i=0;i<12;i++){frameCount++;updateActorCover(coverVictim,20,-__face.nx*6,-__face.ny*6,${aiming});}`);
}
for(const species of ['LOG','STUMP'])for(const angle of [0,.7,1.6])for(const scale of [.8,1.4]){
 fresh(species,angle,scale);
 ok(P("coverSolidKind(__wood)==='LOW'&&!__wood.noCover"),species+' is classified as waist-height cover');
 const original=P('JSON.stringify(__ch.decor[0])');
 contact();
 ok(P("coverVictim.cover.active&&coverVictim.cover.kind==='LOW'&&actorStance(coverVictim)==='CROUCH'"),species+' native contact ducks behind the rotated face');
 ok(P('Math.abs(coverVictim.cover.nx+__wood.forestTimberSin)<1e-9&&Math.abs(coverVictim.cover.ny-__wood.forestTimberCos)<1e-9'),
   species+' cover normal belongs to the actual wood face');
 ok(P('!coverVictim.checkCol(coverVictim.x,coverVictim.y)'),species+' cover never snaps the actor into wood');
 ok(P('JSON.stringify(__ch.decor[0])')===original,species+' cover does not alter the visual root or save identity');
 for(const zone of ['BODY','HEAD']){
   fresh(species,angle,scale);launch(zone);
   ok(P(`coverVictim.hp===${zone==='HEAD'?900:980}&&harvestProfile(__wood).hp===harvestProfile(__wood).maxHp`),
     species+' standing '+zone+' shot clears timber and hits the standing actor beyond it');
 }
 fresh(species,angle,scale);launch('LEGS');
 ok(P('coverVictim.hp===1000&&!__round.active&&harvestProfile(__wood).hp<harvestProfile(__wood).maxHp'),
   species+' leg-height shot impacts and damages timber before its target');
 fresh(species,angle,scale);probe("resetActorStance(player,'CROUCH');");launch('BODY');
 ok(P('coverVictim.hp===1000&&__round.coverLaunchLow&&!__round.active'),species+' crouched launch is intercepted at timber');
 fresh(species,angle,scale);probe("resetActorStance(coverVictim,'CROUCH');");launch('BODY');
 ok(P('coverVictim.hp===1000'),species+' protects a manually lowered body without automatic contact');
 fresh(species,angle,scale);contact();launch('BODY');
 ok(P('coverVictim.hp===1000&&coverVictim.cover.active'),species+' automatic duck protects against incoming standing body fire');
 contact(true);launch('BODY');
 ok(P("actorStance(coverVictim)==='STAND'&&coverVictim.hp===980"),species+' aiming pops above cover and exposes the torso');
}

fresh('LOG',Math.PI/4,2);
probe('__corner={x:__wood.x+__wood.w*.5-.1,y:__wood.y-__wood.h*.5+.1};');
ok(P("coverLineClear(__corner.x-.01,__corner.y,__corner.x+.01,__corner.y,'LEGS',player)"),
  'low rays through an empty diagonal bounding-box corner stay clear');
probe('coverVictim.x=__corner.x;coverVictim.y=__corner.y;');
ok(!P('findCoverContact(coverVictim,-6,0)'), 'empty diagonal box corners cannot attach cover');

fresh();contact();
probe('damageHarvestable(__wood,100000);');
ok(P("coverSolidKind(__wood)===null&&coverSolidFaces(__wood).length===0"),
  'destroyed timber immediately loses cached cover classification and faces');
launch('BODY');
ok(P('coverVictim.hp===900'), 'destruction exposes the still-lowered actor to the next body-height round');
ok(P("resourceDrops.reduce((n,d)=>n+d.qty,0)>0&&getBiomeState(2).destroyed[__wood.chunkKey]"),
  'using timber as cover retains wood salvage and saved removal');

// The launch height is a property of the round, not the shooter's later pose.
fresh();probe(`__round=spawnBullet(__start.x,__start.y,player.aimAngle,true,'BODY',WEAPONS.PISTOL,player);
 __round.vx=(__end.x-__start.x)*1.15;__round.vy=(__end.y-__start.y)*1.15;
 resetActorStance(player,'CROUCH');frameCount++;updateBullets();`);
ok(P('!__round.coverLaunchLow&&coverVictim.hp===980'), 'a high round stays above timber after its shooter ducks');
fresh();probe(`resetActorStance(player,'CROUCH');
 __round=spawnBullet(__start.x,__start.y,player.aimAngle,true,'BODY',WEAPONS.PISTOL,player);
 __round.vx=(__end.x-__start.x)*1.15;__round.vy=(__end.y-__start.y)*1.15;
 resetActorStance(player,'STAND');frameCount++;updateBullets();`);
ok(P('__round.coverLaunchLow&&coverVictim.hp===1000&&!__round.active'),
  'a low round still strikes timber after its shooter rises');
fresh();probe("resetActorStance(player,'CROUCH');");
ok(!P('shovelActorLOS(coverVictim,player)'), 'manual ducking behind timber conceals the player from humanoid sight');
probe("resetActorStance(player,'STAND');");
ok(P('shovelActorLOS(coverVictim,player)'), 'standing above the same timber exposes the player to humanoid sight');
probe("resetActorStance(coverVictim,'CROUCH');");
ok(!P('shovelActorLOS(coverVictim,player)'), 'a manually lowered observer cannot see through its own timber shelter');
fresh();probe(`resetActorStance(player,'CROUCH');
 coverVictim.x=player.x+__wood.forestTimberCos*100;
 coverVictim.y=player.y+__wood.forestTimberSin*100;`);
ok(P('shovelActorLOS(coverVictim,player)'), 'manual ducking does not conceal a target from an exposed side');
probe(`__round=spawnBullet(coverVictim.x,coverVictim.y,Math.atan2(player.y-coverVictim.y,player.x-coverVictim.x),
 false,'BODY',WEAPONS.PISTOL,coverVictim);
 __round.vx=(player.x-coverVictim.x)*1.15;__round.vy=(player.y-coverVictim.y)*1.15;
 frameCount++;updateBullets();`);
ok(P('player.hp===900&&player.decals.some(d=>d.isHead)'), 'a flanking body round still hits the lowered player normally');
console.log(`${checks}/${checks} timber waist-height, rotated contact, incoming fire, pop-up, launch-height and salvage checks passed.`);

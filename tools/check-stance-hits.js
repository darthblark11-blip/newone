// Real pooled projectiles resolve launch elevation against a target-local
// stance. Overhead misses keep flying; critical contact retains its own shape.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness');
const P = source => probe('(' + source + ')');
let checks = 0, seed = 7103;
ctx.setTimeout = () => 0;
ctx.random = (a,b) => {
  seed = (Math.imul(seed,1664525)+1013904223)>>>0;
  const r=seed/4294967296;
  return a===undefined?r:Array.isArray(a)?a[Math.floor(r*a.length)]:b===undefined?r*a:a+(b-a)*r;
};
function ok(label,value) { assert.ok(value,label); checks++; }
function shot(stance,zone,options={}) {
  ctx.__stanceShot={stance,zone,type:'NORMAL',weapon:'PISTOL',owner:'PLAYER',target:'HOSTILE',
    x:80,y:0,angle:0,aim:0,sx:0,sy:0,hp:1000,shield:0,power:1,ticks:12,...options};
  probe(`currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inOverworldView=inTravelMenu=false;
    window.inNM0SecretOverlay=false;window.outpostForts={};townsData={};
    bullets=[];particles=[];corpses=[];barrels=[];enemiesList=[];buildings=[];activeBuildings=[];
    parkingCars=[];activeParkingCars=[];resetForestWildlife();invalidateColIndex();
    totalKills=totalShotsHit=0;MAX_KILLS=100000;headshotCounter=bodyOverkillCounter=0;
    viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
    leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
    window.stanceVictim=new Character(__stanceShot.x,__stanceShot.y,__stanceShot.target==='PLAYER',__stanceShot.type);
    stanceVictim.isFriendly=__stanceShot.target==='ALLY';stanceVictim.isNeutral=false;
    stanceVictim.hp=stanceVictim.maxHp=__stanceShot.hp;stanceVictim.shield=__stanceShot.shield;
    stanceVictim.aimAngle=stanceVictim.moveAngle=__stanceShot.aim;
    resetActorStance(stanceVictim,__stanceShot.stance);
    player=__stanceShot.target==='PLAYER'?stanceVictim:new Character(-2000,-2000,true);
    window.stanceShooter=__stanceShot.owner==='PLAYER'?player:new Character(-2000,-2000,false,'NORMAL');
    stanceShooter.isFriendly=__stanceShot.owner==='ALLY';
    if(__stanceShot.target!=='PLAYER')enemiesList=[stanceVictim];
    window.stanceRound=spawnBullet(__stanceShot.sx,__stanceShot.sy,__stanceShot.angle,__stanceShot.owner!=='ENEMY',
      __stanceShot.zone,typeof __stanceShot.weapon==='string'&&WEAPONS[__stanceShot.weapon]?WEAPONS[__stanceShot.weapon]:__stanceShot.weapon,stanceShooter);
    if(stanceRound.isArrow)stanceRound.arrowPower=__stanceShot.power;
    if(__stanceShot.speed){stanceRound.vx=Math.cos(__stanceShot.angle)*__stanceShot.speed;stanceRound.vy=Math.sin(__stanceShot.angle)*__stanceShot.speed;}
    for(let i=0;i<__stanceShot.ticks&&stanceRound.active;i++){frameCount++;updateBullets();}`);
  return P('({hp:stanceVictim.hp,shield:stanceVictim.shield,active:stanceRound.active,zone:stanceRound.tH,hit:totalShotsHit,decals:stanceVictim.decals,particles:particles.map(p=>p.t),dead:stanceVictim.dead,kind:stanceVictim.fallHit&&stanceVictim.fallHit.kind,kills:totalKills})');
}
const matrix={STAND:{HEAD:'HEAD',BODY:'BODY',LEGS:'LEGS'},CROUCH:{HEAD:null,BODY:'HEAD',LEGS:'BODY'},PRONE:{HEAD:null,BODY:null,LEGS:'HEAD'}};
for(const stance of Object.keys(matrix))for(const zone of ['HEAD','BODY','LEGS']) {
  const hit=matrix[stance][zone],r=shot(stance,zone);
  ok(stance+' '+zone+' preserves the immutable launch elevation',r.zone===zone);
  ok(stance+' '+zone+' applies the requested damage matrix',r.hp===1000-(hit==='HEAD'?100:hit?20:0));
  if(!hit) {
    ok(stance+' '+zone+' overhead miss leaves the projectile flying',r.active&&r.hit===0);
    ok(stance+' '+zone+' overhead miss has no wound, feedback, or kill',!r.decals.length&&!r.particles.length&&r.kills===0);
  } else {
    ok(stance+' '+zone+' impact resolves effects and wounds to anatomy',!r.active&&r.kind===hit&&r.decals.length===1&&r.decals[0].isHead===(hit==='HEAD'));
    ok(stance+' '+zone+' only standing leg contact leaves a leg wound',!!r.decals[0].isLeg===(hit==='LEGS'));
  }
}
for(const weapon of ['SMG','ASSAULT_RIFLE','SHOTGUN','BOW','REVOLVER','COACH_GUN']) {
  const head=shot('STAND','HEAD',{weapon}),crouch=shot('CROUCH','BODY',{weapon}),prone=shot('PRONE','LEGS',{weapon});
  ok(weapon+' promoted critical uses its existing head profile once',head.hp===crouch.hp&&head.hp===prone.hp);
}
const weak=shot('PRONE','LEGS',{weapon:'BOW',power:.4});
ok('prone arrow critical retains earned bow power',weak.hp===1000-120*.4);
for(const energy of ['RED_LASER','PINK_LASER','ALIEN_LASER','ORANGE_BEAM']) {
  const normal=shot('STAND','BODY',{weapon:energy}),critical=shot('CROUCH','BODY',{weapon:energy});
  ok(energy+' stance critical adds one fallback multiplier',1000-critical.hp===2*(1000-normal.hp));
}
for(const target of ['PLAYER','ALLY']) {
  const critical=shot('CROUCH','BODY',{owner:'ENEMY',target});
  ok('enemy rounds use the same stance matrix against '+target,critical.hp===900&&critical.decals[0].isHead);
  const overhead=shot('PRONE','BODY',{owner:'ENEMY',target,shield:60});
  ok(target+' overhead miss cannot touch health or shield',overhead.hp===1000&&overhead.shield===60&&overhead.active);
}
const ally=shot('PRONE','LEGS',{owner:'ALLY'});
ok('allied low rounds resolve critical damage on a prone hostile',ally.hp===900&&ally.decals[0].isHead);
const shieldHead=shot('STAND','HEAD',{owner:'ENEMY',target:'PLAYER',shield:60});
const shieldShift=shot('CROUCH','BODY',{owner:'ENEMY',target:'PLAYER',shield:60});
ok('stance critical preserves existing shield break and overflow rules',shieldHead.hp===shieldShift.hp&&shieldHead.shield===shieldShift.shield);
const armoredHead=shot('STAND','HEAD',{type:'ARMORED_STANDARD'}),armoredShift=shot('CROUCH','BODY',{type:'ARMORED_STANDARD'});
ok('armored standard critical preserves helmet impact feedback',armoredHead.hp===armoredShift.hp&&armoredShift.particles.includes('FLECK')&&!armoredShift.particles.includes('ARMOR_IMPACT'));
const armoredBody=shot('CROUCH','LEGS',{type:'ARMORED_STANDARD'});
ok('crouched low armor hit follows standard body impact feedback',armoredBody.hp===980&&armoredBody.particles.includes('COMIC_IMPACT')&&armoredBody.particles.includes('HIT_BLOOD')&&!armoredBody.decals[0].isLeg);

// The capsule's end caps remain hittable when its root is outside a head or
// body circle, at all headings. A lateral ray outside its width still misses.
for(let i=0;i<8;i++) {
  const aim=i*Math.PI/4,angle=aim+Math.PI/2;
  const sx=80+Math.cos(aim)*25-Math.cos(angle)*40,sy=Math.sin(aim)*25-Math.sin(angle)*40;
  const r=shot('PRONE','LEGS',{aim,angle,sx,sy});
  ok('prone capsule end contact is critical at heading '+i,r.hp===900&&!r.active);
}
ok('prone capsule rejects rays outside its thin width',shot('PRONE','LEGS',{sy:11}).hp===1000);
ok('a fast projectile cannot skip the prone floor footprint',shot('PRONE','LEGS',{x:180,speed:400,ticks:1}).hp===900);

// A miss must not alter a shared round before it reaches somebody farther on.
shot('CROUCH','HEAD',{ticks:0});
probe(`window.stanceFar=new Character(140,0,false,'NORMAL');stanceFar.hp=1000;stanceFar.maxHp=1000;
  enemiesList.push(stanceFar);for(let i=0;i<8&&stanceRound.active;i++){frameCount++;updateBullets();}`);
ok('overhead HEAD round continues into a standing target with original head damage',P('stanceVictim.hp===1000&&stanceFar.hp===900&&stanceRound.tH==="HEAD"&&totalShotsHit===1'));

shot('CROUCH','BODY',{hp:20});
ok('a promoted critical retains ordinary headshot kill credit',P('stanceVictim.dead&&totalKills===1&&stanceVictim.fallHit.kind==="HEAD"&&corpses.length===1&&corpses[0].dec[0].isHead'));
shot('PRONE','HEAD',{ticks:0});
probe(`stanceRound.prevX=0;stanceRound.prevY=0;stanceRound.x=160;stanceRound.y=0;`);
ok('hunting cover ignores a stance-overhead actor',P('forestShotCover(stanceRound,[stanceVictim],[]).kind===null'));
probe(`stanceRound.tH='LEGS';`);
ok('hunting cover shares the prone capsule for low projectiles',P('forestShotCover(stanceRound,[stanceVictim],[]).kind==="ACTOR"'));

shot('STAND','BODY',{ticks:0});
for(const [value,head,body,legs] of [[.49,'HEAD','BODY','LEGS'],[.5,null,'HEAD','BODY'],[1.49,null,'HEAD','BODY'],[1.5,null,null,'HEAD']]) {
  probe(`stanceVictim.stance.value=${value};`);
  for(const [zone,expected] of [['HEAD',head],['BODY',body],['LEGS',legs]])
    ok('in-progress height '+value+' resolves '+zone+' consistently',P(`(stanceHitProfile(stanceVictim,'${zone}')||{}).zone`)===(expected||undefined));
}
for(const type of ['ROBOT','ARMORED','BUG','SNAIL','SAUCER','ALIEN_GATOR']) {
  shot('STAND','BODY',{type,ticks:0});
  probe('stanceVictim.stance.value=2;');
  ok(type+' retains its existing nonhumanoid contact profile',P("stanceHitProfile(stanceVictim,'BODY').stance==='STAND'&&stanceHitProfile(stanceVictim,'BODY').zone==='BODY'"));
}
shot('PRONE','LEGS');
ok('a low-plane critical records actual damage at the lowered UI anchor',P('stanceVictim.stanceDamage.amount===100&&stanceVictim.stanceDamage.critical&&stanceVictim.stanceDamage.leftMs===500'));
shot('CROUCH','HEAD');
ok('an overhead miss creates no damage popup',P('!stanceVictim.stanceDamage'));
console.log(`${checks}/${checks} stance projectile matrix, footprint, effects and ownership checks passed`);

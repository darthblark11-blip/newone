// Dive protection belongs to the committed moving animation only. Exercise
// actual pooled bullets, contact attacks and area damage, including side effects.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=source=>probe('('+source+')');
let checks=0,seed=99217;
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const r=seed/4294967296;
  return a===undefined?r:Array.isArray(a)?a[Math.floor(r*a.length)]:b===undefined?a*r:a+(b-a)*r;
};
function ok(label,value){assert.ok(value,label);checks++;}
function fresh(moving=true){
  probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=true;isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
    inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
    window.inNM0SecretOverlay=false;buildGhost=null;
    width=393;height=800;frameCount=100;deltaTime=1000/60;zoom=1;camX=camY=0;
    viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
    buildings=activeBuildings=[];parkingCars=activeParkingCars=[];
    barrels=[];bullets=[];particles=[];corpses=[];enemiesList=[];invalidateColIndex();resetForestWildlife();
    leftStick={active:${moving},dx:${moving?1:0},dy:0,base:{x:80,y:640}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:313,y:690}};
    player=new Character(80,0,true);player.hp=player.maxHp=300;player.shield=60;
    player.isArmed=true;player.aimAngle=player.moveAngle=0;player.isMoving=${moving};
    setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
    resetActorStance(player);
    window.diveAttacker=new Character(60,0,false,'NORMAL');diveAttacker.isFriendly=diveAttacker.isNeutral=false;
    window.diveRequested=requestPlayerProne();`);
  ok((moving?'moving':'stationary')+' prone request succeeds',P('diveRequested'));
}
function shot(zone,weapon='PISTOL'){
  probe(`particles=[];bullets=[];window.diveRound=spawnBullet(40,0,0,false,'${zone}',WEAPONS.${weapon},diveAttacker);
    for(let i=0;i<4&&diveRound.active;i++){frameCount++;updateBullets();}`);
}

fresh();
ok('a committed moving drop starts its dive immunity immediately',P('proneDiveActive(player)'));
probe('window.diveBefore=JSON.stringify({hp:player.hp,shield:player.shield,recharge:player.shieldRechargeTimer,flash:player.shieldFlashTimer});window.diveBlocked=player.takeDamage(999,diveAttacker);');
ok('direct damage reports evasion without shield or health loss',P('diveBlocked.evaded&&diveBlocked.blocked&&!diveBlocked.broken&&JSON.stringify({hp:player.hp,shield:player.shield,recharge:player.shieldRechargeTimer,flash:player.shieldFlashTimer})===diveBefore'));
for(const zone of ['HEAD','BODY','LEGS']){
  fresh();shot(zone);
  ok(zone+' rounds pass through the dive without consuming their flight',P('diveRound.active&&diveRound.l>0'));
  ok(zone+' rounds leave no damage, wounds, knockback or impact feedback',P('player.hp===300&&player.shield===60&&player.decals.length===0&&player.x===80&&!player.fallHit&&particles.length===0'));
}
fresh();shot('BODY','TASER');
ok('an electric projectile cannot tether or stun the diving actor',P('diveRound.active&&!diveRound.tetheredTarget&&player.stunTimer===0&&player.skeletonTimer===0'));

fresh();probe('window.diveOccult=occultDamage(player,999,diveAttacker,0,42);');
ok('mage damage cannot consume a volley, flash, shield or corpse during evasion',P('!diveOccult&&player._occultLastVolley===undefined&&!(player.hitFlash>0)&&player.hp===300&&player.shield===60&&corpses.length===0'));
for(const blast of ['triggerExplosion(player.x,player.y,160,false,false,diveAttacker)','triggerRocketExplosion(player.x,player.y,false,null,diveAttacker)']){
  fresh();probe(blast+';');
  ok('an area explosion leaves the dive shield and health untouched',P('player.hp===300&&player.shield===60&&!player.dead&&corpses.length===0'));
  ok('area damage cannot create false player impact sparks or blood',P("!particles.some(p=>p.shovelOwner===player||p.t==='BLOOD')"));
}
fresh();probe('window.diveFire=new FireZone(player.x,player.y,60,100);diveFire.update();window.diveSludge=new SludgeZone(player.x,player.y,60,100);diveSludge.update();');
ok('fire and acid damage over time respect the same bounded immunity',P('player.hp===300&&player.shield===60&&!player.dead'));

for(const type of ['BUG','SNAIL_HYBRID']){
  fresh();probe(`window.diveContact=new Character(60,0,false,'${type}');diveContact.isFriendly=diveContact.isNeutral=false;
    diveContact.aiOffset=0;diveContact.state='CHASE';diveContact.lastKnownX=80;diveContact.lastKnownY=0;
    diveContact.fireTimer=999;diveContact.biteCooldown=0;diveContact.enraged=true;
    enemiesList=[diveContact];frameCount=110;diveContact.updateEnemy();`);
  ok(type+' contact cannot bypass dive immunity with its native attack',P('player.hp===300&&player.shield===60&&!player.dead&&corpses.length===0'));
  ok(type+' contact leaves no false hurt effects during the dive',P("!particles.some(p=>p.shovelOwner===player)"));
}
fresh();probe("worldBoxingHit({attacker:diveAttacker,defender:player,outcome:'HIT',damage:40});");
ok('a previously committed world punch cannot flash or hit a diving player',P('player.hp===300&&player.shield===60&&!(player.hitFlash>0)&&particles.length===0'));

fresh();probe(`window.divePushActor=new Character(90,0,false,'NORMAL');
  divePushActor.isFriendly=divePushActor.isNeutral=false;divePushActor.updateEnemy=()=>{};
  enemiesList=[divePushActor];updateEntities();`);
ok('native body separation cannot drag or shove an airborne dive',P('player.x===80&&player.y===0&&divePushActor.x===90&&divePushActor.y===0'));
probe('player.stance.elapsedMs=player.stance.durationMs;player.stance.value=2;updateEntities();');
ok('normal body separation resumes after landing',P('player.x!==80&&divePushActor.x!==90'));

fresh(false);
ok('stationary prone lowering has no dive immunity',!P('proneDiveActive(player)'));
probe('player.takeDamage(20,diveAttacker);');
ok('a stationary lowered transition retains normal shield damage',P('player.hp===300&&player.shield===40'));
fresh();probe('player.stance.elapsedMs=player.stance.durationMs;player.stance.value=2;player.takeDamage(20,diveAttacker);');
ok('landing ends protection immediately with ordinary prone vulnerability',P('!proneDiveActive(player)&&player.shield===40&&stanceHitProfile(player,"LEGS")!==null'));
fresh();probe('resetActorStance(player);player.takeDamage(20,diveAttacker);');
ok('resetting the stance cannot leave persistent immunity behind',P('!proneDiveActive(player)&&player.shield===40'));
console.log(`${checks}/${checks} prone dive damage, projectile, area, contact and landing checks passed.`);

// Native fire/input and the ordinary enemy loop exercise elevation reactions.
// Wounded immobilization has separate suites; these victims stay able to react.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,seed=70193;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const u=seed/4294967296;
  return a===undefined?u:Array.isArray(a)?a[Math.floor(u*a.length)]:b===undefined?u*a:a+(b-a)*u;};
ctx.tryLegShotInjury=()=>false;
function fresh(role=1,type='NORMAL',x=180,y=8){
  probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
    inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
    window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
    setMeleeTool('NONE');resetForestWildlife();resetShovelState();
    ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=false;
    leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
    playerAimZone='BODY';headAimToggle=false;
    player=new Character(0,0,true);player.hp=player.maxHp=1000000;player.shield=1000000;
    player.currentWeapon=WEAPONS.PISTOL;player.ammo=100000;player.aimAngle=player.moveAngle=0;
    player.isArmed=true;player.fireTimer=player.reloadTimer=player.meleeTimer=0;
    window.reactor=new Character(${x},${y},false,${JSON.stringify(type)});
    reactor.hp=reactor.maxHp=100000;reactor.shield=0;reactor.isArmed=true;
    reactor.isFriendly=reactor.isNeutral=false;reactor.currentWeapon=WEAPONS.PISTOL;
    reactor.ammo=100000;reactor.aiOffset=${role};reactor.aimAngle=reactor.moveAngle=PI;
    reactor.isMoving=false;reactor.gait=reactor.walkCycle=0;resetActorStance(reactor);
    reactor.state='CHASE';reactor.loseSightTimer=10000;
    buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
    enemiesList=[reactor];bullets=[];particles=[];corpses=[];invalidateColIndex();
    frameCount=100;deltaTime=1000/60;MAX_KILLS=1000000;totalKills=0;
    viewLeft=viewTop=-10000;viewRight=viewBottom=10000;`);
}
function input(zone,active=true,fire=true,extraY=0){
  probe(`playerAimZone=${JSON.stringify(zone)};headAimToggle=playerAimZone==='HEAD';
    rightStick.active=${active};rightStick.dist=${fire?1:.4};
    window.reactAimX=reactor.x-player.x,reactAimY=reactor.y+${extraY}-player.y;
    window.reactAim=Math.atan2(reactAimY,reactAimX)-Math.asin(8/Math.max(8,Math.hypot(reactAimX,reactAimY)));
    rightStick.dx=Math.cos(reactAim)*rightStick.dist;rightStick.dy=Math.sin(reactAim)*rightStick.dist;`);
}
function tick(n=1,zone=null,extraY=0){
  for(let i=0;i<n;i++){
    if(zone)input(zone,true,true,extraY);
    probe('frameCount++;deltaTime=1000/60;player.updatePlayer();reactor.updateEnemy();updateBullets();');
  }
}
const reaction=()=>P("reactor.shotReaction?({zone:reactor.shotReaction.zone,action:reactor.shotReaction.action,remainingMs:reactor.shotReaction.remainingMs,observedMs:reactor.shotReaction.observedMs,shots:reactor.shotReaction.shots}):null");
function advanceReaction(ms){
  probe(`for(let left=${ms};left>0;){const step=Math.min(left,100);
    frameCount++;deltaTime=step;updateEnemyShotReaction(reactor,player,true,180,step);
    updateActorStance(reactor,step);updateBullets();left-=step;}`);
}

fresh();
ok('enemy reactions use the shared public observation/update hooks',P("typeof recordEnemyShotThreat==='function'&&typeof updateEnemyShotReaction==='function'"));

// One actual shot must remain hittable before the delay, and stay remembered
// long enough to cause the existing response even after the shooter stops.
for(const [zone,role,expected]of [['HEAD',1,'DUCK'],['BODY',1,null],
  ['LEGS',0,'CROUCH'],['LEGS',1,'CROUCH'],['LEGS',2,'FIGHT']]){
  fresh(role);input(zone,true,true,zone==='LEGS'?6:0);tick();input(zone,false,false);
  ok(`${zone} role${role} observes a single real shot`,reaction()?.shots===1);
  advanceReaction(2599);
  ok(`${zone} role${role} cannot start an evasion before 2.6 seconds`,
    P("reactor.shotReaction.observedMs===2599&&!reactor.shotReaction.action&&reactor.stance.to===0"));
  if(zone==='HEAD')ok('a single aimed headshot lands before the enemy can duck',
    P('reactor.hp<reactor.maxHp&&reactor.decals.some(d=>d.isHead)'));
  advanceReaction(1);
  ok(`${zone} role${role} finishes the delay at exactly 2.6 seconds`,
    reaction().observedMs===2600&&reaction().action===expected);
  ok(`${zone} role${role} retains the original 1.8 second hold after reacting`,reaction().remainingMs===1800);
}

fresh();input('HEAD');tick();input('HEAD',false,false);advanceReaction(1300);
probe("isPaused=true;");advanceReaction(5000);
ok('pause does not consume a pending shot delay',reaction().observedMs===1300);
probe('isPaused=false;');advanceReaction(1299);
ok('resuming still waits the remainder of the delay',!reaction().action);
advanceReaction(1);
ok('a paused single shot reacts only after 2.6 seconds of active time',reaction().action==='DUCK');

fresh();input('HEAD');tick();input('HEAD',false,false);advanceReaction(1300);
probe('player.fireTimer=0;');input('HEAD');tick();input('HEAD',false,false);
const repeatedObserved=reaction().observedMs;
ok('another shot at the same elevation does not restart the pending delay',repeatedObserved>1300);
advanceReaction(2600-repeatedObserved);
ok('repeated fire does not postpone the first response',reaction().action==='DUCK');

fresh();input('HEAD');tick();input('HEAD',false,false);advanceReaction(2500);
probe('player.fireTimer=0;');input('BODY');tick();input('BODY',false,false);
ok('switching to body fire starts a fresh shared delay and clears the head duck',
  reaction().zone==='BODY'&&reaction().observedMs===0&&!reaction().action);
advanceReaction(2500);
probe('player.fireTimer=0;');input('LEGS');tick();input('LEGS',false,false);
ok('switching from body to leg fire also starts a fresh delay',
  reaction().zone==='LEGS'&&reaction().observedMs===0&&!reaction().action);
advanceReaction(2599);
ok('the new leg threat cannot inherit the earlier shot delay',!reaction().action);
advanceReaction(1);
ok('the new leg threat reacts after its own full delay',reaction().action==='CROUCH');

// The reported bug: a nearby shooter has already stopped walking. A high
// incoming ray must remain harmless once that enemy ducks beneath it.
fresh();tick(180,'HEAD');
ok('sustained real head-height fire makes a stationary enemy duck',P("actorStance(reactor)==='CROUCH'&&reactor.shotReaction?.action==='DUCK'"));
const duckHeadContacts=P('reactor.decals.filter(d=>d.isHead).length');
let safe=true;
for(let i=0;i<180;i++){tick(1,'HEAD');safe&&=P("actorStance(reactor)!=='STAND'");}
ok('the enemy does not stand up under a sustained stream of overhead head shots',safe);
ok('native rounds keep passing overhead instead of manufacturing wound contacts',
  P('reactor.decals.filter(d=>d.isHead).length')===duckHeadContacts&&P('reactor.hp>0'));
input('HEAD',false,false);tick(180);
ok('releasing fire eventually releases the temporary protective posture',P("actorStance(reactor)==='STAND'"));

fresh();probe("resetActorStance(reactor,'CROUCH');player.ammo=3;");
let reloadSeen=0,returnShot=false,reloadShotId=0,reloadSafe=true;
for(let i=0;i<150;i++){
  tick(1,'HEAD');
  if(P('player.reloadTimer>0')){
    reloadSeen++;
    reloadShotId=P('player.lastCombatShot.id');
  }else if(reloadShotId&&P('player.lastCombatShot.id')>reloadShotId)returnShot=true;
  reloadSafe&&=P("actorStance(reactor)!=='STAND'");
}
ok('the held headshot fixture performs a real ninety-tick pistol reload',reloadSeen>=89&&returnShot);
ok('an advantageous duck bridges the full reload and the first returning high rounds',reloadSafe);
input('HEAD',false,false);tick(180);
ok('the reload grace still releases the duck after the aiming gesture ends',P("actorStance(reactor)==='STAND'"));

fresh();probe("resetActorStance(reactor,'PRONE');");tick(150,'HEAD');
ok('head fire preserves an already advantageous prone posture',P("actorStance(reactor)==='PRONE'"));

fresh();tick(180,'HEAD');tick(300,'BODY');
ok('changing away from head shots retires the old high-shot duck hold',P("!reactor.shotReaction||reactor.shotReaction.zone!=='HEAD'||reactor.shotReaction.remainingMs<=0"));

fresh();input('HEAD',true,false);tick(90);
ok('an unused aiming control does not invent an incoming shot event',P('!reactor.shotReaction||reactor.shotReaction.shots===0'));
fresh();probe("playerAimZone='HEAD';headAimToggle=true;player.aimAngle=player.moveAngle=PI;rightStick={active:true,dx:-1,dy:0,dist:1};");tick(100);
ok('head fire aimed away from a gunner causes no remote duck',P('!reactor.shotReaction||reactor.shotReaction.shots===0'));
fresh(1,'NORMAL',1200,8);tick(45,'LEGS',6);
ok('low rounds cannot trigger reactions beyond their physical launch range',P('!reactor.shotReaction||reactor.shotReaction.shots===0'));

fresh();probe(`buildings=activeBuildings=[{x:90,y:8,w:4,h:120,isWall:true,hp:1000}];invalidateColIndex();`);
input('HEAD');
probe(`for(let i=0;i<90;i++){
  frameCount++;player.updatePlayer();updateEnemyShotReaction(reactor,player,false,180,1000/60);
  updateActorStance(reactor,1000/60);updateBullets();
}`);
ok('a high wall hides the firing evidence and intercepts rounds before a covered observer',P('!reactor.shotReaction||reactor.shotReaction.shots===0'));

for(const type of ['ROBOT','ARMORED','BUG','HORSE','OCCULT_ZOMBIE','OCCULT_BLACK','DAD','SIA']){
  fresh(1,type);
  probe(`window.reactionRound={prevX:130,prevY:8,x:210,y:8,isP:true,shooter:player,tH:'HEAD',shotId:1};
    window.reactionAccepted=recordEnemyShotThreat(reactor,reactionRound);`);
  ok(type+' retains its dedicated combat response',P('!reactionAccepted&&!reactor.shotReaction'));
}
for(const edit of ['reactor.isPlayer=true','reactor.isFriendly=true','reactor.isNeutral=true',
  'reactor.isNM0Scientist=true','reactor.mounted=true','reactor.knockedOut=true',
  'reactor.stunTimer=10','reactor.legInjury={}','reactor.dead=true','reactor.hp=0']){
  fresh();probe(edit);
  probe(`window.reactionRound={prevX:130,prevY:8,x:210,y:8,isP:true,shooter:player,tH:'HEAD',shotId:1};
    window.reactionAccepted=recordEnemyShotThreat(reactor,reactionRound);`);
  ok(edit+' cannot acquire an unrelated incoming-fire owner',P('!reactionAccepted&&!reactor.shotReaction'));
}
fresh();probe(`window.reactionRound={prevX:130,prevY:80,x:210,y:80,isP:true,shooter:player,tH:'HEAD',shotId:1};`);
ok('a distant projectile segment is not an incoming near miss',!P('recordEnemyShotThreat(reactor,reactionRound)'));
probe('reactionRound.prevY=reactionRound.y=8;reactionRound.isP=false;');
ok('hostile rounds do not manufacture reactions to their own side',!P('recordEnemyShotThreat(reactor,reactionRound)'));
probe('reactionRound.isP=true;recordEnemyShotThreat(reactor,reactionRound);recordEnemyShotThreat(reactor,reactionRound);');
ok('one pooled round can only count once for the same observer',P('reactor.shotReaction.shots===1'));
fresh();probe(`window.reactionRound={prevX:130,prevY:8,x:210,y:8,isP:true,shooter:player,tH:'BODY',shotId:200};
  recordEnemyShotThreat(reactor,reactionRound);window.newerReaction=JSON.stringify({zone:reactor.shotReaction.zone,
    id:reactor.shotReaction.lastShotId,shots:reactor.shotReaction.shots,remaining:reactor.shotReaction.remainingMs});
  reactionRound.tH='HEAD';reactionRound.shotId=199;recordEnemyShotThreat(reactor,reactionRound);`);
ok('a delayed older head-height round cannot undo a newer switch to body fire',P(`newerReaction===JSON.stringify({zone:reactor.shotReaction.zone,
  id:reactor.shotReaction.lastShotId,shots:reactor.shotReaction.shots,remaining:reactor.shotReaction.remainingMs})`));
const nativeRandom=ctx.random;let reactionRandomCalls=0;
ctx.random=(...args)=>{reactionRandomCalls++;return nativeRandom(...args);};
probe('frameCount++;updateEnemyShotReaction(reactor,player,true,180,100);window.onceObserved=reactor.shotReaction.observedMs;updateEnemyShotReaction(reactor,player,true,180,100);');
ok('two consumers cannot advance one reaction clock twice per frame',P('reactor.shotReaction.observedMs===onceObserved'));
ok('incoming-fire choices consume no shared combat randomness',reactionRandomCalls===0);
ctx.random=nativeRandom;

// Paused and overlay ticks cannot age a response or its reaction delay.
fresh();tick(90,'HEAD');const paused=reaction();
probe('isPaused=true;');probe('for(let i=0;i<20;i++){frameCount++;updateEnemyShotReaction(reactor,player,true,180,100);}');
ok('pause freezes shot response timing and choice',JSON.stringify(reaction())===JSON.stringify(paused));
probe('isPaused=false;inTravelMenu=true;');probe('for(let i=0;i<20;i++){frameCount++;updateEnemyShotReaction(reactor,player,true,180,100);}');
ok('travel overlay freezes shot response timing and choice',JSON.stringify(reaction())===JSON.stringify(paused));

// Repeated low hits can be answered by a protective crouch or by accepting
// the risk and continuing to fight. A missing safe cover dive falls back.
for(const [role,expected]of [[0,'CROUCH'],[1,'CROUCH'],[2,'FIGHT']]){
  fresh(role,'NORMAL',240,2);tick(210,'LEGS',6);
  ok(`low fire role${role} chooses ${expected}`,P(`reactor.shotReaction?.action===${JSON.stringify(expected)}`));
  ok(`low fire role${role} remains a living fighter instead of a fake leg injury`,P('!reactor.legInjury&&reactor.hp>0'));
  if(expected==='CROUCH'){
    ok(`low fire role${role} places the torso in the low plane`,P("actorStance(reactor)==='CROUCH'&&stanceHitProfile(reactor,'LEGS').zone==='BODY'"));
    ok(`low fire role${role} continues receiving native body wounds rather than new leg marks`,P('reactor.decals.length>0&&!reactor.decals[reactor.decals.length-1].isLeg&&!reactor.decals[reactor.decals.length-1].isHead'));
  }
  else ok('fight-through role retains standing legs and native return fire',P("actorStance(reactor)==='STAND'&&reactor.ammo<100000"));
}

fresh(0,'NORMAL',240,2);probe(`window.diveCover={x:140,y:122,w:80,h:100,isLowWall:true,hp:1000};
  buildings=activeBuildings=[diveCover];invalidateColIndex();
  // Keep ordinary cover seeking from reaching shelter before this longer
  // incoming-fire delay finishes; the native reactive dive still owns travel.
  reactor._enemyCover={target:player,searchMs:10000,seenMs:1800,cycleMs:0};`);
let sawDive=false,clearDive=true,diveDuration=0;
const beforeDive=P('({x:reactor.x,y:reactor.y})');
for(let i=0;i<225;i++){
  tick(1,'LEGS',6);
  if(P('enemyCoverDiveActive(reactor)')){
    sawDive=true;diveDuration=P('reactor.stance.durationMs');
    clearDive&&=P('stanceProneSpotClear(reactor,reactor.x,reactor.y,reactor.stance.proneHeading)');
  }
}
ok('a real low-shot stream can select the safe dive-to-cover response',sawDive);
ok('a reactive dive keeps the original short 420 ms animation',diveDuration===420);
ok('the reactive diver sweeps clear geometry all the way to cover',clearDive&&P('!reactor.checkCol(reactor.x,reactor.y)'));
ok('the reactive dive actually carries the actor away from the exposed position',
  Math.hypot(P('reactor.x')-beforeDive.x,P('reactor.y')-beforeDive.y)>60);

// Normal cover pop-up timing must yield to a useful headshot duck.
fresh();probe(`player.x=180;player.y=-80;reactor.x=reactor.y=0;
  window.reactCover={x:60,y:40,w:40,h:80,isCrateProp:true};
  buildings=activeBuildings=[reactCover];invalidateColIndex();`);tick(130);
ok('cover fixture reaches the actual low-wall contact solver',P("reactor.cover?.active&&reactor.cover.kind==='LOW'"));
tick(90,'HEAD');safe=true;
for(let i=0;i<180;i++){tick(1,'HEAD');safe&&=P("actorStance(reactor)!=='STAND'");}
ok('waist-cover pop-up cadence cannot expose a gunner under repeated high shots',safe);
ok('holding a headshot duck does not teleport the enemy into the cover solid',P('!reactor.checkCol(reactor.x,reactor.y)'));
input('HEAD',false,false);const resume=new Set();
for(let i=0;i<240;i++){tick();resume.add(P('actorStance(reactor)'));}
ok('ordinary cover firing cadence resumes after the incoming fire ends',resume.has('STAND')&&resume.has('CROUCH'));

// A covered gunner must not keep cycling harmless rounds at a prone player
// beyond the reach of its actual firing stance.
fresh();probe(`player.x=180;player.y=-80;reactor.x=reactor.y=0;
  buildings=activeBuildings=[{x:60,y:40,w:40,h:80,isCrateProp:true}];invalidateColIndex();`);tick(130);
probe(`player.x=650;resetActorStance(player,'PRONE');reactor.stanceAimZone='LEGS';
  reactor.fireTimer=reactor.reloadTimer=0;window.rangeCoverAmmo=reactor.ammo;
  window.rangeCoverReleased=false;
  for(let i=0;i<50&&!rangeCoverReleased;i++){
    frameCount++;reactor._enemyCover.cycleMs=0;
    const owns=updateEnemyCoverAI(reactor,player,true,650,1000/60);
    if(!owns&&!reactor.cover?.active)rangeCoverReleased=true;
  }`);
ok('a low countershot outside cover firing range releases the ineffective cover cycle',P('rangeCoverReleased&&reactor._enemyCover.goal===null'));
ok('the out-of-range gunner saves its ammunition for an approach',P('reactor.ammo===rangeCoverAmmo'));
ok('the next cover search rejects the same shelter when its low fire still cannot reach',
  P('enemyCoverGoal(reactor,player.x,player.y,{})===null'));

console.log(`${checks}/${checks} native incoming elevation, duck persistence, low-shot roles and cover timing checks passed.`);

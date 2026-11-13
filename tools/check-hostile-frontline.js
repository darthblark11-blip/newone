// Exercise the native crowd coordinator and real enemy fire/update paths.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
function fresh(count=40){
  probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
    inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
    window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
    setMeleeTool('NONE');resetForestWildlife();resetShovelState();
    ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=false;
    leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
    HOSTILE_FRONTLINE.enabled=true;isHardMode=false;
    player=new Character(0,0,true);player.hp=player.maxHp=1000000;player.shield=1000000;
    buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
    enemiesList=[];bullets=[];particles=[];corpses=[];invalidateColIndex();
    frameCount=100;deltaTime=1000/60;
    for(let i=0;i<${count};i++){
      const e=new Character(100+i*3,0,false,'NORMAL');
      e.hp=e.maxHp=1000;e.isFriendly=e.isNeutral=false;e.isArmed=true;
      e.currentWeapon=WEAPONS.PISTOL;e.ammo=weaponMagazineCapacity(e);
      e.fireTimer=e.reloadTimer=e.meleeTimer=e.stunTimer=0;e.state='CHASE';
      e.cachedTargetActor=player;e.cachedCanSee=e.cachedShovelVisible=true;
      e.cachedTargetDist=e.x;e.cachedTargetAngle=Math.PI;e.aiOffset=7;
      e.aimAngle=e.moveAngle=Math.PI;e.loseSightTimer=10000;
      resetActorStance(e);enemiesList.push(e);
    }
    window.gunners=enemiesList;window.decisions=()=>gunners.map(e=>hostileFrontlineFireAllowed(e,player));
    window.allowed=()=>gunners.filter(e=>hostileFrontlineFireAllowed(e,player));`);
}
for(const n of [0,1,4,7,8]){
  fresh(n);ok(n+' gunners retain unrestricted firing',P('decisions().every(Boolean)'));
  ok(n+' gunners do not activate the limiter',P('!_hostileFrontline.limited'));
}
fresh(9);
ok('A ninth eligible gunner activates the shared eight-shooter limit',P('allowed().length===8&&_hostileFrontline.limited'));
ok('A one-sided rush retains its nearest eight gunners',P('allowed().every((e,i)=>e===gunners[i])'));

fresh(40);
probe(`isHardMode=true;for(let d=0;d<8;d++){
  const a=-Math.PI+(d+.5)*Math.PI/4,r=500+d*10;
  gunners[d].x=Math.cos(a)*r;gunners[d].y=Math.sin(a)*r;
}
for(let i=8;i<40;i++){
  const a=Math.PI/8,r=80+i;gunners[i].x=Math.cos(a)*r;gunners[i].y=Math.sin(a)*r;
}`);
ok('All eight occupied directions retain a firing owner',P(`(()=>{
  const selected=allowed();return selected.length===8&&new Set(selected.map(e=>
    Math.min(7,Math.floor((Math.atan2(e.y,e.x)+Math.PI)*4/Math.PI)))).size===8;
})()`));
ok('Every otherwise unrepresented direction retains its nearest gunner',P('gunners.slice(0,4).concat(gunners.slice(5,8)).every(e=>allowed().includes(e))'));

fresh();probe('decisions();gunners[0].fireTimer=40;frameCount++;');
ok('Normal weapon cooldown retains the front-rank owner',P('hostileFrontlineFireAllowed(gunners[0],player)&&!hostileFrontlineFireAllowed(gunners[8],player)'));
for(const [name,change]of[
  ['death','gunners[0].dead=true'],['faction','gunners[0].isFriendly=true'],
  ['target','gunners[0].aggroTarget=gunners[39];gunners[0].aggroTimer=100'],
  ['range','gunners[0].x=401'],['stun','gunners[0].stunTimer=30'],
  ['reload','gunners[0].reloadTimer=90'],['burial','gunners[0].shovelLevel=8;currentLevel=2;gunners[0].shovelLevel=2;gunners[0].shovelDepth=36']
]){
  fresh();probe('decisions();'+change+';frameCount++;');
  ok(name+' promotes a waiting gunner on the next frame',P('hostileFrontlineFireAllowed(gunners[8],player)'));
  ok(name+' no longer occupies a front-rank slot',P('!_hostileFrontline.allowed.has(gunners[0])'));
}
fresh();probe('decisions();resetRunState();');
ok('Run reset clears cached owners and identity',P('_hostileFrontline.frame===-1&&_hostileFrontline.player===null&&_hostileFrontline.allowed.size===0'));

fresh();probe(`window.savedRandom=random;window.savedMathRandom=Math.random;
  random=()=>{throw Error('Coordinator consumed game RNG');};
  Math.random=()=>{throw Error('Coordinator consumed Math RNG');};`);
try{ok('Coordinator decisions consume no RNG',P('allowed().length===8'));}
finally{probe('random=savedRandom;Math.random=savedMathRandom;');}

for(const [name,change]of[
  ['player','gunners[39].isPlayer=true'],['ally','gunners[39].isFriendly=true'],
  ['neutral','gunners[39].isNeutral=true'],['unarmed','gunners[39].isUnarmed=true'],
  ['occult melee',"gunners[39].eType='OCCULT_ZOMBIE'"],
  ['dedicated boss',"gunners[39].eType='DAD'"]
]){
  fresh();probe(change+';');
  ok(name+' keeps its own combat path',P('hostileFrontlineFireAllowed(gunners[39],player)'));
}
for(const [name,change]of[
  ['bow','gunners[39].currentWeapon=WEAPONS.BOW'],['rocket','gunners[39].currentWeapon=WEAPONS.ROCKET_LAUNCHER'],
  ['robot',"gunners[39].eType='ROBOT'"],['armored ranged',"gunners[39].eType='ARMORED'"],
  ['aircraft',"gunners[39].eType='AERIAL_PISTOL'"],['molotov',"gunners[39].eType='MOLOTOV'"],
  ['mounted','gunners[39].mounted=true'],['leg injury',"gunners[39].legInjury={phase:'PRONE_FIRE',outcome:'PRONE'}"]
]){
  fresh();probe(change+';gunners[39].ammo=weaponMagazineCapacity(gunners[39]);');
  ok(name+' is subject to the shared player-target budget',P('!hostileFrontlineFireAllowed(gunners[39],player)'));
}
fresh();ok('An actual non-player combat target keeps unrestricted faction combat',P('hostileFrontlineFireAllowed(gunners[39],gunners[0])'));
ok('An omitted combat target is inferred instead of bypassing the limit',P('!hostileFrontlineFireAllowed(gunners[39],null)'));

fresh();
probe(`window.waiting=gunners[39];window.beforeDenied={ammo:waiting.ammo,timer:waiting.fireTimer,
  flash:waiting.muzzleFlash,kick:waiting.weaponKick,bullets:bullets.length,particles:particles.length,shot:_huntShotSequence};
  window.deniedCoverCalls=0;window.deniedAimCalls=0;
  window.savedCoverFireAllowed=coverFireAllowed;window.savedEnemyAimHeading=enemyAimHeading;
  coverFireAllowed=function(...args){deniedCoverCalls++;return savedCoverFireAllowed(...args);};
  enemyAimHeading=function(...args){deniedAimCalls++;return savedEnemyAimHeading(...args);};`);
try{probe('window.deniedResult=waiting.fire(Math.PI,null,player);');}
finally{probe('coverFireAllowed=savedCoverFireAllowed;enemyAimHeading=savedEnemyAimHeading;');}
ok('A denied actual shot reports false',P('deniedResult===false'));
ok('Denied native fire rejects before barrel turning or muzzle-line queries',P('deniedCoverCalls===0&&deniedAimCalls===0'));
ok('A denied actual shot consumes no ammunition, cooldown, recoil or effects',P(`beforeDenied.ammo===waiting.ammo&&beforeDenied.timer===waiting.fireTimer&&
  beforeDenied.flash===waiting.muzzleFlash&&beforeDenied.kick===waiting.weaponKick&&beforeDenied.bullets===bullets.length&&
  beforeDenied.particles===particles.length&&beforeDenied.shot===_huntShotSequence`));
probe(`window.front=gunners[0];window.oldAmmo=front.ammo,oldShots=_huntShotSequence;
  front.fire(Math.PI,null,player);`);
ok('An allowed actual pistol shot retains normal ammunition/cooldown and effects',P(`front.ammo===oldAmmo-1&&
  front.fireTimer===(front.currentWeapon.enemyCooldown||48)&&front.muzzleFlash===3&&front.weaponKick===6&&
  bullets.length===1&&particles.length===3&&_huntShotSequence===oldShots+1`));

for(const hard of [false,true]){
  fresh();probe(`isHardMode=${hard};window.rear=gunners[39];rear.x=${hard?450:300};
    rear.cachedTargetDist=rear.x;rear.strafeTimer=${hard?3:0};rear.strafeDir=1;
    rear.standStillTimer=0;rear.stanceCombatTarget=player;rear.stanceCombatElapsed=0;
    window.oldX=rear.x;window.oldY=rear.y;decisions();rear.updateEnemy();`);
  ok((hard?'Hard':'Normal')+' waiting rear gunner continues real movement',P('rear.x!==oldX||rear.y!==oldY'));
  ok((hard?'Hard':'Normal')+' waiting rear gunner emits no shot',P('bullets.length===0&&rear.fireTimer===0'));
  if(hard)ok('A denied hard-mode attempt preserves its ongoing strafe',P('rear.strafeTimer===2'));
}
const crowdFire=[];
for(const enabled of [true,false]){
  fresh(100);probe(`HOSTILE_FRONTLINE.enabled=${enabled};
    window.initialShotId=_huntShotSequence;
    for(const e of gunners)e.fire(Math.PI,null,player);`);
  const result=P('({enabled:HOSTILE_FRONTLINE.enabled,shots:_huntShotSequence-initialShotId,projectiles:bullets.length})');
  const expected=enabled?8:100;
  ok((enabled?'Enabled':'Disabled')+' 100-gunner fixture emits '+expected+' real shots',result.shots===expected);
  ok((enabled?'Enabled':'Disabled')+' 100-gunner fixture emits '+expected+' real pistol projectiles',result.projectiles===expected);
  crowdFire.push(result);
}

fresh();
probe(`window.coverRear=gunners[39];coverRear.y=40;
  window.rearCrate={x:coverRear.x+37,y:40,w:40,h:80,isCrateProp:true};
  buildings=activeBuildings=[rearCrate];invalidateColIndex();
  updateActorCover(coverRear,100,6,0,true);
  coverRear._enemyCover={searchMs:500,cycleMs:0,seenMs:1800,target:player,lastX:player.x,lastY:player.y,goal:null};`);
ok('Waiting cover fixture acquires real low-cover contact',P("coverRear.cover?.active&&coverRear.cover.kind==='LOW'"));
ok('Waiting cover fixture is outside the front rank',P('!hostileFrontlineFireAllowed(coverRear,player)'));
probe(`window.nativeCoverLineClear=coverLineClear;window.coverLineCalls=0;
  coverLineClear=function(){coverLineCalls++;return nativeCoverLineClear.apply(this,arguments);};`);
try{
  probe('window.coverHandled=updateEnemyCoverAI(coverRear,player,true,Math.hypot(coverRear.x,coverRear.y),16);');
  ok('Denied cover fire retains the native pose/controller update',P('coverHandled&&coverRear.cover.active&&coverRear._enemyCover.cycleMs===16'));
  ok('Denied cover fire skips expensive firing line checks and projectiles',P('coverLineCalls===0&&bullets.length===0'));
  probe(`HOSTILE_FRONTLINE.enabled=false;
    updateEnemyCoverAI(coverRear,player,true,Math.hypot(coverRear.x,coverRear.y),16);`);
  ok('The same unthrottled cover fixture performs its native line checks and fires',P('coverLineCalls>0&&bullets.length===1'));
}finally{probe('coverLineClear=nativeCoverLineClear;');}
console.log(JSON.stringify({actual100GunnerSameFrame:crowdFire}));
console.log('Hostile front line: '+checks+' coordinator, exclusion and native fire/movement checks passed.');

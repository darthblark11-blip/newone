// Count real perception/aim calls through Character.updateEnemy. A late shot
// limit alone leaves denied ready guns recasting LOS every frame.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');ctx.setTimeout=()=>0;
let checks=0,seed=77129;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
 return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
const ok=(expression,label)=>{assert.ok(typeof expression==='string'?P(expression):expression,label);checks++;};
function scene(count=100,native=false,cold=false){
 seed=77129;
 P(`resetRunState();resetShovelState();resetUndergroundRoute();
 currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inCutscene=false;
 inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
 window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
 setMeleeTool('NONE');resetForestWildlife();ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=false;
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 HOSTILE_FRONTLINE.enabled=true;isHardMode=false;
 player=new Character(0,0,true);player.hp=player.maxHp=1000000;player.shield=1000000;
 buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];bullets=[];particles=[];corpses=[];
 invalidateColIndex();frameCount=100;deltaTime=1000/60;viewLeft=viewTop=-2000;viewRight=viewBottom=2000;
 worldTimeMs=DAY_MS/2;updateSunVector();
 for(let i=0;i<${count};i++){
  const angle=i*Math.PI*2/${count},radius=240+(i%4)*30;
  const e=new Character(Math.cos(angle)*radius,Math.sin(angle)*radius,false,'NORMAL');
  e.hp=e.maxHp=1000;e.isFriendly=e.isNeutral=false;e.isArmed=true;
  e.currentWeapon=WEAPONS.PISTOL;e.ammo=weaponMagazineCapacity(e);
  e.fireTimer=e.reloadTimer=e.meleeTimer=e.stunTimer=0;e.state='CHASE';
  e.cachedTargetActor=${cold?'null':'player'};e.cachedCanSee=e.cachedShovelVisible=${!cold};
  e.cachedTargetDist=radius;e.cachedTargetAngle=angle+Math.PI;e.aiOffset=i%10;
  e.aimAngle=e.moveAngle=angle+Math.PI;e.loseSightTimer=10000;resetActorStance(e);enemiesList.push(e);
 }
 if(${native}){nm0AmbushActive=true;window.ambushKind='GATE';for(const e of enemiesList)e.isAmbush=true;}
 stealthPerceptionReset();var budgetRows=[],budgetActors=enemiesList.slice(),budgetStart=budgetActors.map(e=>({x:e.x,y:e.y}));`);
}
function tick(frames=1,dt=1000/60){
 P(`for(let f=0;f<${frames};f++){
  frameCount++;deltaTime=${dt};const previous=_huntShotSequence;
  for(const e of budgetActors)e.updateEnemy();
  budgetRows.push({frame:frameCount,shots:_huntShotSequence-previous,
   owners:budgetActors.filter(e=>hostileFrontlineFireAllowed(e,player)).map(e=>budgetActors.indexOf(e))});
 }`);
}
function counted(frames){
 const counts={},original={};
 for(const name of['stealthPerceptionVisible','coverLineClear','combatAimElevation','updateEnemyCoverAI','shovelActorLOS']){
  original[name]=ctx[name];ctx[name]=function(...args){counts[name]=(counts[name]||0)+1;return original[name].apply(this,args);};
 }
 try{tick(frames);}finally{for(const name in original)ctx[name]=original[name];}
 return counts;
}

// An entirely new cohort must not bypass admission because its first
// same-frame roster snapshot contained no cached sight entries.
for(const native of[false,true]){
 scene(100,native,true);tick();
 ok('budgetRows[0].owners.length<=HOSTILE_FRONTLINE.shooters',`${native?'Native ambush':'Shared stealth'} cold caches admit at most eight ranged attackers`);
 ok('budgetRows[0].shots>0&&budgetRows[0].shots<=HOSTILE_FRONTLINE.shooters',`${native?'Native ambush':'Shared stealth'} first acquisition cannot emit an uncapped volley`);
}

scene();const frames=60,counts=counted(frames),cap=P('HOSTILE_FRONTLINE.shooters'),n=P('budgetActors.length');
ok('budgetRows.every(row=>row.owners.length<=HOSTILE_FRONTLINE.shooters&&row.shots<=HOSTILE_FRONTLINE.shooters)',
 'Every real Character frame respects the shooter budget, including cooldown transitions');
const awarenessSamples=n*Math.ceil(frames*(1000/60)/P('STEALTH_PERCEPTION.senseMs'));
ok((counts.stealthPerceptionVisible||0)<=awarenessSamples+cap*frames,
 'Waiting ready guns retain periodic awareness without running an extra sight ray every frame');
ok((counts.combatAimElevation||0)<n*frames*.5,
 'Aiming work is admitted before the per-frame shooting posture calculation');
ok('budgetActors.every((e,i)=>Math.hypot(e.x-budgetStart[i].x,e.y-budgetStart[i].y)>.01)',
 'Waiting and admitted troops retain real navigation rather than freezing the crowd');
ok('budgetActors.filter(e=>!hostileFrontlineFireAllowed(e,player)).every(e=>e.fireTimer===0)',
 'Waiting ready guns do not consume a fake weapon cooldown to hide repeated queries');

// Slots survive ordinary cooldowns, but are eventually offered to other
// ready troops even if the original front rank stays alive and in range.
scene(24);tick(1);P('var originalBudgetOwners=budgetRows[0].owners.slice();');tick(12);
ok('budgetRows.every(row=>JSON.stringify(row.owners)===JSON.stringify(originalBudgetOwners))',
 'Ordinary weapon cooldowns do not churn active owners');
tick(180);
ok('new Set(budgetRows.flatMap(row=>row.owners)).size>HOSTILE_FRONTLINE.shooters',
 'A sustained fight eventually rotates waiting attackers into the active group');

// All attackers ask the same coordinator. Its roster work belongs to a
// staggered shared decision, not a fresh world scan for every request.
scene();P(`var budgetRosterReads=0;
 enemiesList=new Proxy(budgetActors,{get(array,key,receiver){
  if(typeof key==='string'&&/^[0-9]+$/.test(key))budgetRosterReads++;
  return Reflect.get(array,key,receiver);
 }});
 for(let f=0;f<60;f++){
  frameCount++;deltaTime=1000/60;
  for(const e of budgetActors)hostileFrontlineFireAllowed(e,player);
 }`);
ok('budgetRosterReads<=budgetActors.length*20',
 'One hundred simultaneous requesters share cadence-limited linear roster work');

// Nearest cached-visible actors can become occluded just before their first
// turn. Clear lanes must replace those failed probes rather than starve.
scene(16);P(`for(let i=0;i<budgetActors.length;i++){
 const e=budgetActors[i];e.x=i<8?-100-i:200+i;e.y=0;
 e.aimAngle=e.moveAngle=i<8?0:Math.PI;e.cachedTargetAngle=e.aimAngle;
 e.cachedCanSee=true;e.cachedTargetActor=player;
 }
 buildings=activeBuildings=[{x:-50,y:0,w:20,h:1800,isWall:true,coverType:'HIGH',hp:Infinity}];
 invalidateColIndex();`);tick(12);
ok('budgetActors.filter(e=>hostileFrontlineFireAllowed(e,player)).length===HOSTILE_FRONTLINE.shooters&&budgetActors.filter(e=>hostileFrontlineFireAllowed(e,player)).every(e=>e.x>0)',
 'Freshly blocked nearest owners yield their turns to ready attackers with a clear lane');
ok('bullets.every(b=>!b.shooter||b.shooter.x>0)',
 'A stale visible cache cannot authorize even the first shot through the new wall');

// A sight sample can remove fire permission without revealing a silently
// relocated player. Every actual shot must still respect fresh occlusion.
scene(24);tick();
P(`buildings=activeBuildings=[{x:0,y:0,w:70,h:1800,isWall:true,coverType:'HIGH',hp:Infinity}];
 invalidateColIndex();player.x=4000;player.y=4000;
 for(const e of budgetActors)e.fireTimer=0;bullets=[];var concealedShots=_huntShotSequence;`);tick(12);
ok('_huntShotSequence===concealedShots&&bullets.length===0',
 'New admissions and stale owners cannot fire at a hidden relocated player');

// Admission is an optimization, not a second simulation clock.
scene(24);tick();
P('var budgetBeforePause=JSON.stringify([budgetActors.map(e=>[e.x,e.y,e.fireTimer,e.aimAngle]),_hostileFrontline]);isPaused=true;doTick=false;');
P('for(let f=0;f<20;f++){frameCount++;deltaTime=100;updateEntities();}');
ok('JSON.stringify([budgetActors.map(e=>[e.x,e.y,e.fireTimer,e.aimAngle]),_hostileFrontline])===budgetBeforePause',
 'Pausing the world freezes owner turns and all ordinary combat updates');

console.log(JSON.stringify({guards:n,frames,cap,counts}));
console.log(checks+' cold-acquisition, hard-cap, real-work, movement, rotation, occlusion and pause checks passed');

// Real pooled rounds exercise the thin-leg contact, injury dispatch and enemy
// lifecycle together. Render geometry is reviewed separately in native p5.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,seed=18019,nextShot=41001;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const u=seed/4294967296;
 return a===undefined?u:Array.isArray(a)?a[Math.floor(u*a.length)]:b===undefined?u*a:a+(b-a)*u;};
function stage(){
 probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;isStoryMode=false;
  started=doTick=true;isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
  inOverworldView=inTravelMenu=inWorldBuildingMenu=inUpgradeMenu=false;
  window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
  buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
  bullets=[];particles=[];corpses=[];enemiesList=[];invalidateColIndex();resetForestWildlife();
  viewLeft=viewTop=-10000;viewRight=viewBottom=10000;frameCount=400;deltaTime=1000/60;
  MAX_KILLS=100000;totalKills=0;score=0;consecutiveKills=comboTimer=0;
  player=new Character(-300,0,true);player.hp=player.maxHp=100000;player.shield=0;
  player.isArmed=true;player.currentWeapon=WEAPONS.PISTOL;
  leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
  setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;`);
}
function target(type='NORMAL',moving=false,hp=1000){
 probe(`frameCount++;bullets=[];particles=[];corpses=[];
  window.injuryTarget=new Character(0,0,false,${JSON.stringify(type)});
  injuryTarget.hp=injuryTarget.maxHp=${hp};injuryTarget.shield=0;
  injuryTarget.isFriendly=injuryTarget.isNeutral=false;injuryTarget.isArmed=true;
  injuryTarget.currentWeapon=WEAPONS.PISTOL;injuryTarget.ammo=17;
  injuryTarget.aimAngle=injuryTarget.moveAngle=0;injuryTarget.gait=${moving?.95:0};
  injuryTarget.walkCycle=0;injuryTarget.isMoving=${moving};
  rememberFigureMotion(injuryTarget,${moving?4:0},0);resetActorStance(injuryTarget);enemiesList=[injuryTarget];`);
}
function legShot(index=0,weapon='PISTOL',distance=90,id=nextShot++){
 probe(`window.injuryGeometry=humanLegHitGeometry(injuryTarget);
  window.injuryLeg=injuryGeometry.legs[${index}];
  window.injuryLateral=(injuryLeg.sy+injuryLeg.ky+injuryLeg.ay)/3;
  window.injuryCo=Math.cos(injuryGeometry.angle),injurySi=Math.sin(injuryGeometry.angle);
  window.injuryRound=spawnBullet(injuryTarget.x-injuryCo*${distance}-injurySi*injuryLateral*injuryGeometry.scale,
    injuryTarget.y-injurySi*${distance}+injuryCo*injuryLateral*injuryGeometry.scale,
    injuryGeometry.angle,true,'LEGS',WEAPONS.${weapon},player,${id});
  for(let i=0;i<80&&injuryRound.active;i++){frameCount++;updateBullets();}`);
 return P('({hp:injuryTarget.hp,injury:injuryTarget.legInjury,wound:injuryTarget.decals[0],roundActive:injuryRound.active})');
}
function findProc(index=0,moving=false,type='NORMAL'){
 for(let i=0;i<200;i++){
  target(type,moving);const hit=legShot(index);
  assert(hit.hp<1000,'integration fixture missed a real leg');
  if(hit.injury)return hit;
 }
 throw Error('Two hundred surviving physical leg contacts produced no injury');
}
function advance(n=1){probe(`for(let i=0;i<${n};i++){frameCount++;deltaTime=1000/60;injuryTarget.updateEnemy();}`);}

stage();
ok('integration runs native leg geometry and injury dispatch',P("typeof humanLegHitGeometry==='function'&&typeof tryLegShotInjury==='function'"));
target();
probe("window.gapRound=spawnBullet(-90,0,0,true,'LEGS',WEAPONS.PISTOL,player,40001);for(let i=0;i<80&&gapRound.active;i++){frameCount++;updateBullets();}");
ok('a real low round passes through the air between the legs without damage or an injury',
 P('injuryTarget.hp===1000&&injuryTarget.decals.length===0&&!injuryTarget.legInjury'));
ok('a missed low round retires at its exact25m floor contact',
 P('!gapRound.active&&Math.abs(Math.hypot(gapRound.x-gapRound.startX,gapRound.y-gapRound.startY)-500)<1e-6'));
for(const distance of [480,540]){
 target();probe(`injuryTarget.x=${distance};window.farGeometry=humanLegHitGeometry(injuryTarget);
  window.farLeg=farGeometry.legs[0];window.farY=(farLeg.sy+farLeg.ky+farLeg.ay)/3;
  window.rangeRound=spawnBullet(0,farY,0,true,'LEGS',WEAPONS.PISTOL,player,40002);
  for(let i=0;i<80&&rangeRound.active;i++){frameCount++;updateBullets();}`);
 ok(`${distance}unit target is ${distance<500?'inside':'beyond'} the low round range`,
  P(distance<500?'injuryTarget.hp===980':'injuryTarget.hp===1000&&!injuryTarget.legInjury'));
}
target();probe("injuryTarget.x=540;window.bodyRangeRound=spawnBullet(0,0,0,true,'BODY',WEAPONS.PISTOL,player,40003);for(let i=0;i<80&&bodyRangeRound.active;i++){frameCount++;updateBullets();}");
ok('ordinary body rounds retain their greater range',P('injuryTarget.hp===980'));
for(const index of [0,1])for(const moving of [false,true]){
 stage();const hit=findProc(index,moving);
 ok(`physical ${index}/${moving?'moving':'still'} hit selects its actual injured side`,
  hit.injury.legIndex===hit.wound.legIndex&&hit.injury.legIndex===index);
 ok(`physical ${index}/${moving?'moving':'still'} injury starts a fall without awarding a kill`,
  hit.injury.phase==='FALL'&&P('!injuryTarget.dead&&injuryTarget.hp>0&&totalKills===0&&corpses.length===0'));
 ok(`physical ${index}/${moving?'moving':'still'} injury remembers the locomotion trigger`,hit.injury.wasMoving===moving);
 const before=P('JSON.stringify({injury:injuryTarget.legInjury,x:injuryTarget.x,y:injuryTarget.y,fire:injuryTarget.fireTimer})');
 probe('doTick=false;');advance(50);
 ok(`physical ${index}/${moving?'moving':'still'} pause freezes the complete injury`,
  P('JSON.stringify({injury:injuryTarget.legInjury,x:injuryTarget.x,y:injuryTarget.y,fire:injuryTarget.fireTimer})')===before);
 probe('doTick=true;');
}

// One continuous target sequence reaches every authored outcome and eventually
// returns each survivor to normal AI, rather than leaving a permanent stun.
stage();const outcomes=new Set();
for(let n=0;n<3;n++){
 const hit=findProc(n%2,n%2===0);outcomes.add(hit.injury.outcome);
 const seen=new Set([hit.injury.phase]);let shots=0,previous=0;
 for(let i=0;i<1100&&P('!!injuryTarget.legInjury');i++){
  previous=P('bullets.length');advance();
  shots+=Math.max(0,P('bullets.length')-previous);
  const current=P('injuryTarget.legInjury');if(current)seen.add(current.phase);
 }
 ok(`${hit.injury.outcome} leaves its temporary injury and returns a living fighter`,
  P('!injuryTarget.legInjury&&!injuryTarget.dead&&injuryTarget.hp>0'));
 ok(`${hit.injury.outcome} includes a bounded recovery phase`,seen.has('RECOVER'));
 if(hit.injury.outcome==='PRONE'||hit.injury.outcome==='SEATED')
  ok(`${hit.injury.outcome} continues fighting while unable to walk`,shots>0);
 // Native hostiles only reacquire within600units. Keep a reachable combat
 // target outside their200unit preferred spacing to exercise normal walking.
 probe("player.x=injuryTarget.x-400;player.y=injuryTarget.y;injuryTarget.state='CHASE';injuryTarget.lastKnownX=player.x;injuryTarget.lastKnownY=player.y;injuryTarget.aggroTarget=player;injuryTarget.aggroTimer=300;");
 const x=P('injuryTarget.x'),y=P('injuryTarget.y');advance(80);
 ok(`${hit.injury.outcome} recovered normal AI can move again ${P('JSON.stringify({state:injuryTarget.state,x:injuryTarget.x,y:injuryTarget.y,stance:injuryTarget.stance,cached:injuryTarget.cachedTargetDist,sight:injuryTarget.cachedCanSee,offset:injuryTarget.aiOffset,stun:injuryTarget.stunTimer})')}`,Math.hypot(P('injuryTarget.x')-x,P('injuryTarget.y')-y)>1);
}
ok('successive successful injuries include prone fire, seated fire and recovery',
 ['PRONE','SEATED','RECOVER'].every(x=>outcomes.has(x)));

// This hostile-only mechanic cannot turn friendly, animal or machine contacts
// into a hidden permanent movement state. Direct calls also guard new callers.
for(const type of ['ROBOT','ARMORED','BUG','SNAIL','SNAIL_HYBRID','ALIEN_GATOR','COW','HORSE','AERIAL','AERIAL_PISTOL']){
 stage();target(type);
 probe(`window.invalidInjuries=0;for(let id=1;id<=80;id++)if(tryLegShotInjury(injuryTarget,
  {tH:'LEGS',w:WEAPONS.PISTOL,shotId:id,isP:true,shooter:player},0))invalidInjuries++;`);
 ok(`${type} cannot enter a human leg-injury state`,P('invalidInjuries===0&&!injuryTarget.legInjury'));
}
for(const flag of ['isPlayer','isFriendly','isNeutral','isNM0Scientist']){
 stage();target();probe(`injuryTarget.${flag}=true;window.invalidInjuries=0;
  for(let id=1;id<=80;id++)if(tryLegShotInjury(injuryTarget,
   {tH:'LEGS',w:WEAPONS.PISTOL,shotId:id,isP:true,shooter:player},0))invalidInjuries++;`);
 ok(`${flag} actors cannot receive the hostile leg-injury mechanic`,P('invalidInjuries===0&&!injuryTarget.legInjury'));
}

// Ordinary low-stance elevation semantics must survive the injury override.
stage();findProc();
for(let i=0;i<100&&P('injuryTarget.legInjury&&injuryTarget.legInjury.phase===\'FALL\'');i++)advance();
const down=P('injuryTarget.legInjury');
if(down&&down.phase==='PRONE'){
 ok('prone injured enemies are below head and body shots',P("stanceHitProfile(injuryTarget,'HEAD')===null&&stanceHitProfile(injuryTarget,'BODY')===null"));
 ok('prone injured enemies receive critical low shots',P("stanceHitProfile(injuryTarget,'LEGS').zone==='HEAD'"));
}

// Killing an injured actor still uses the ordinary lethal dispatch exactly once.
stage();findProc();
probe('injuryTarget.hp=1;triggerExplosion(injuryTarget.x,injuryTarget.y,100,false,true,player);');
ok('an injured enemy can die and leave one native corpse with normal kill credit',
 P('injuryTarget.dead&&enemiesList.length===0&&corpses.length===1&&totalKills===1'));
stage();findProc();
probe('startAtLevel(2);');
ok('level travel does not carry an injured hostile into the next sector',P('enemiesList.every(e=>!e.legInjury)&&!player.legInjury'));
let saveSlot=null;
ctx.localStorage={getItem:()=>saveSlot,setItem:(key,value)=>{saveSlot=value;},removeItem:()=>{saveSlot=null;}};
stage();findProc();probe('saveGame();');
ok('campaign saves do not serialize transient hostile injury actors',!!saveSlot&&!saveSlot.includes('legInjury'));
probe('loadGame();');
ok('loading a campaign creates a clean roster without stale injury state',P('enemiesList.every(e=>!e.legInjury)&&!player.legInjury'));
probe('resetRunState();');
ok('a hard reset clears injured actors and their transient combat objects',
 P('enemiesList.length===0&&corpses.length===0&&bullets.length===0&&player===null'));

console.log(`${checks}/${checks} native leg-contact, injury, pause, combat, recovery and death integration checks passed.`);

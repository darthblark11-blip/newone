// Exercise real body separation and Character.updateEnemy, not a simulated
// replacement steering model. Report work counts rather than cloud FPS.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {ctx,probe:P}=require('./harness');
ctx.setTimeout=()=>0;
let seed=333771,checks=0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
 return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
const ok=(value,label)=>{checks++;assert.ok(value,label);};
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const out=process.env.HOSTILE_POSITION_OUT||'/tmp/hostile-positioning-qa';
ok(P("typeof HOSTILE_POSITIONING!=='undefined'&&typeof hostilePositionGoal==='function'"),
 'the native game includes the shared positioning controller');
function fresh(count=64,enabled=true,hard=false){
 seed=333771;
 P(`resetRunState();resetShovelState();resetUndergroundRoute();
 currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inCutscene=false;
 inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
 window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
 setMeleeTool('NONE');resetForestWildlife();ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=false;
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 HOSTILE_FRONTLINE.enabled=true;HOSTILE_POSITIONING.enabled=${enabled};isHardMode=${hard};
 player=new Character(0,0,true);player.hp=player.maxHp=1000000;player.shield=1000000;
 buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];bullets=[];particles=[];corpses=[];
 invalidateColIndex();frameCount=100;deltaTime=1000/60;viewLeft=viewTop=-1600;viewRight=viewBottom=1600;
 worldTimeMs=DAY_MS/2;updateSunVector();
 window.__positionWork={moves:0,collision:0,coverRays:0};
 for(let i=0;i<${count};i++){
  const e=new Character(350+Math.floor(i/8)*42,(i%8-3.5)*42,false,'NORMAL');
  e.hp=e.maxHp=1000;e.isFriendly=e.isNeutral=false;e.isArmed=true;
  e.currentWeapon=WEAPONS.PISTOL;e.ammo=weaponMagazineCapacity(e);
  e.fireTimer=e.reloadTimer=e.meleeTimer=e.stunTimer=0;e.state='CHASE';
  e.cachedTargetActor=player;e.cachedCanSee=e.cachedShovelVisible=true;
  e.cachedTargetDist=Math.hypot(e.x,e.y);e.cachedTargetAngle=Math.atan2(-e.y,-e.x);e.aiOffset=i%10;
  e.aimAngle=e.moveAngle=e.cachedTargetAngle;e.loseSightTimer=10000;resetActorStance(e);enemiesList.push(e);
 }
 window.__positionActors=enemiesList.slice();window.__positionRows=[];
 actorShow=function(){};
 checkAmbushCleared=checkFarmSwarmAlive=maintainHostiles=cullDepartedBands=sweepForeignHostiles=
 maintainOutpostGarrison=maintainOutpostMuster=checkOutpostCaptured=function(){};
 `);
}
fresh();
P(`window.__positionMove=Character.prototype.attemptMove;window.__positionCol=Character.prototype.checkCol;
 Character.prototype.attemptMove=function(){__positionWork.moves++;return __positionMove.apply(this,arguments);};
 Character.prototype.checkCol=function(){__positionWork.collision++;return __positionCol.apply(this,arguments);};
 window.__positionRay=coverLineClear;
 coverLineClear=function(){__positionWork.coverRays++;return __positionRay.apply(this,arguments);};
 window.__positionSnapshot=function(){
  const nearest=[],radii=[];let pairs44=0,pairs60=0,moving=0;
  for(let i=0;i<__positionActors.length;i++){
   const a=__positionActors[i];let close=Infinity;
   for(let j=0;j<__positionActors.length;j++)if(i!==j){const b=__positionActors[j],d=Math.hypot(a.x-b.x,a.y-b.y);
    close=Math.min(close,d);if(j>i){if(d<44)pairs44++;if(d<60)pairs60++;}}
   nearest.push(close);radii.push(Math.hypot(a.x-player.x,a.y-player.y));if(a.isMoving)moving++;
  }
  nearest.sort((a,b)=>a-b);radii.sort((a,b)=>a-b);
  return {frame:frameCount,pairs44,pairs60,nearestMin:nearest[0],nearestMedian:nearest[Math.floor(nearest.length/2)],
   radiusMedian:radii[Math.floor(radii.length/2)],radiusMax:radii[radii.length-1],moving,
   work:{...__positionWork},owners:_hostileFrontline.allowed.size,positions:__positionActors.map(e=>[e.x,e.y]),
   positioning:JSON.parse(JSON.stringify(_hostilePositioning.stats))};
 };`);
function tick(frames){P(`for(let f=0;f<${frames};f++){
 frameCount++;updateEntities();
 __positionRows.push({owners:_hostileFrontline.allowed.size,frame:frameCount});
 }`);}
function snapshot(){return P('__positionSnapshot()');}
function clearWork(){P('window.__positionWork={moves:0,collision:0,coverRays:0};');}
function cohort(enabled,hard=false){
 fresh(64,enabled,hard);const initial=snapshot();tick(360);const formed=snapshot();clearWork();tick(240);
 const settled=snapshot();
 ok(P('__positionActors.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&!e.checkCol(e.x,e.y))'),
  'real crowd movement retains finite positions outside native solids');
 ok(P('__positionRows.every(row=>row.owners<=HOSTILE_FRONTLINE.shooters)'),
  'formation steering preserves the eight-owner hard cap on every frame');
 return {enabled,hard,initial,formed,settled};
}
const baseline=cohort(false),revised=cohort(true);
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'cohort.json'),JSON.stringify({baseline,revised},null,2));
ok(revised.settled.pairs44<baseline.settled.pairs44*.65,
 'shared approach positions substantially reduce physical crowd compression');
ok(revised.settled.nearestMedian>baseline.settled.nearestMedian+8,
 'the typical gunner has useful space rather than merely avoiding exact penetration');
ok(revised.settled.radiusMedian>baseline.settled.radiusMedian+40,
 'rear pressure no longer pushes most gunners through their intended stand-off range');
ok(revised.settled.work.collision<baseline.settled.work.collision*.7,
 'settled positioning cuts native collision probes instead of adding repeated steering searches');
ok(revised.settled.work.moves<baseline.settled.work.moves*.75,
 'settled reserves stop repeatedly attempting movement');

// Stable goals should not orbit whenever a firing lease rotates. It is the
// firing right that changes; the physical waiting place remains owned.
fresh(24);
const goals=P(`(()=>{
 const result=[];for(let f=0;f<5;f++){frameCount++;
  for(const a of __positionActors){const g=hostilePositionGoal(a,player,player.x,player.y,true,false);
   if(g&&!result.some(v=>v.actor===a))result.push({actor:a,goal:g});}}
 window.__positionGoals=result;return result.length;
})()`);
ok(goals>0,'a crowded player-target fight receives real reserved goals');
const stable=P(`(()=>{
 const first=__positionGoals[0],a=first.actor,g=first.goal,x=g.x,y=g.y;
 const again=hostilePositionGoal(a,player,0,0,true,true);
 return {same:again===g,x:again&&again.x,y:again&&again.y,firstX:x,firstY:y};
})()`);
ok(stable.same&&stable.x===stable.firstX&&stable.y===stable.firstY,
 'firing admission does not invalidate an already owned physical position');
const stopped=P(`(()=>{
 const first=__positionGoals.find(v=>v.goal.kind==='hold'),a=first.actor,r=first.goal;
 a.x=r.x;a.y=r.y;const before=__positionWork.moves;
 const result=hostilePositionMove(a,r,2.45);
 return {calls:__positionWork.moves-before,x:result.x,y:result.y};
})()`);
ok(stopped.calls===0&&stopped.x===0&&stopped.y===0,
 'an actor settled on its owned mark performs no native movement attempt');
fresh(8);
const lowTarget=P(`(()=>{
 const a=__positionActors[0];a.stanceAimZone='LEGS';resetActorStance(a,'STAND');frameCount++;
 const g=hostilePositionGoal(a,player,0,0,true,true);
 return {kind:g.kind,range:legShotRangeForWeapon('LEGS',a.currentWeapon,a),distance:Math.hypot(g.x,g.y)};
})()`);
ok(lowTarget.kind==='hold'&&lowTarget.distance<lowTarget.range-12,
 'a standing low-target shooter receives a mark inside its actual anatomy-specific firing reach');
fresh(24);
P(`window.__positionGoals=[];for(const a of __positionActors){const goal=hostilePositionGoal(a,player,0,0,true,false);
 if(goal)__positionGoals.push({actor:a,goal});}`);
const reloading=P(`(()=>{const first=__positionGoals[0];first.actor.reloadTimer=90;
 return hostilePositionGoal(first.actor,player,0,0,true,false)===first.goal;})()`);
ok(reloading,'reloading changes firing admission without discarding a safe physical place');

fresh(64);
const rosterBefore=P('_hostilePositioning.stats.rosterReads');
const budgets=P(`(()=>{
 const rows=[];for(let f=0;f<12;f++){frameCount++;
  for(let repeat=0;repeat<3;repeat++)for(const a of __positionActors)
   hostilePositionGoal(a,player,0,0,true,false);
  rows.push({checks:_hostilePositioning.checks,plans:_hostilePositioning.plans});}
 return rows;
})()`);
ok(budgets.every(r=>r.checks<=P('HOSTILE_POSITIONING.planBudget')&&r.plans<=P('HOSTILE_POSITIONING.maxPlans')),
 'hundreds of same-frame callers share the strict planning and collision-probe budgets');
ok(P('_hostilePositioning.stats.rosterReads')-rosterBefore<=P('__positionActors.length')*2,
 'same-frame requesters share cadence-limited roster sweeps instead of rescanning the crowd');
P(`window.__positionSavedRandom=random;window.__positionSavedMathRandom=Math.random;
 random=()=>{throw Error('Position coordinator consumed game RNG');};
 Math.random=()=>{throw Error('Position coordinator consumed Math.random');};`);
try{
 ok(P('(()=>{frameCount++;for(const a of __positionActors)hostilePositionGoal(a,player,0,0,true,false);return true;})()'),
  'shared positioning and spatial claims consume no game RNG');
}finally{P('random=__positionSavedRandom;Math.random=__positionSavedMathRandom;');}

fresh(24);
const movingContact=P(`(()=>{
 const a=__positionActors[0];frameCount++;
 const old=hostilePositionGoal(a,player,0,0,true,false),x=old.x,y=old.y;
 player.x=160;player.y=100;frameCount++;
 const next=hostilePositionGoal(a,player,160,100,true,false);
 return {oldX:x,oldY:y,x:next.x,y:next.y,anchorX:next.anchorX,anchorY:next.anchorY};
})()`);
ok(movingContact.anchorX===160&&movingContact.anchorY===100&&
 Math.hypot(movingContact.x-movingContact.oldX,movingContact.y-movingContact.oldY)>20,
 'a materially moved visible contact refreshes the approach mark');

fresh(24);
const rangeCorrection=P(`(()=>{
 frameCount++;hostilePositionGoal(__positionActors[0],player,0,0,true,false);
 const a=__positionActors[1],old=hostilePositionGoal(a,player,0,0,true,false),radius=Math.hypot(old.x,old.y);
 const x=-old.x/radius*50,y=-old.y/radius*50;player.x=x;player.y=y;frameCount++;
 const next=hostilePositionGoal(a,player,x,y,true,false);
 return {radius,delta:Math.hypot(x,y),kind:next&&next.kind,range:next&&Math.hypot(next.x-x,next.y-y)};
})()`);
ok(rangeCorrection.radius>360&&rangeCorrection.delta<72&&rangeCorrection.kind==='hold'&&rangeCorrection.range<=388,
 'an outer mark follows a small retreat before it leaves actual normal firing reach');

fresh(24);
const obstruction=P(`(()=>{
 const a=__positionActors[0];frameCount++;
 const first=hostilePositionGoal(a,player,0,0,true,false),x=first.x,y=first.y;
 buildings=activeBuildings=[{x,y,w:28,h:28,isWall:true}];invalidateColIndex();
 let next;for(let f=0;f<10;f++){frameCount++;deltaTime=100;next=hostilePositionGoal(a,player,0,0,true,false);}
 deltaTime=1000/60;
 return {oldX:x,oldY:y,accepted:!!next&&next.kind==='hold',x:next&&next.x,y:next&&next.y,
  blocked:next&&next.kind==='hold'?a.checkCol(next.x,next.y):false};
})()`);
ok(!obstruction.accepted||(!obstruction.blocked&&Math.hypot(obstruction.x-obstruction.oldX,obstruction.y-obstruction.oldY)>20),
 'an obstacle appearing on a parked mark invalidates it without keeping a blocked goal');

// A real wall opening must remain a navigable route, rather than letting the
// position planner park actors inside geometry or freeze a pursuing group.
fresh(16);
P(`player.x=-120;player.y=0;buildings=activeBuildings=[
 {x:130,y:-210,w:30,h:260,isWall:true},{x:130,y:210,w:30,h:260,isWall:true}];
 invalidateColIndex();window.__positionChokeStart=__positionActors.map(a=>[a.x,a.y]);`);
tick(180);
const chokepoint=P(`({finite:__positionActors.every(a=>Number.isFinite(a.x)&&Number.isFinite(a.y)),
 clear:__positionActors.every(a=>!a.checkCol(a.x,a.y)),
 advanced:__positionActors.filter((a,i)=>Math.hypot(a.x-__positionChokeStart[i][0],a.y-__positionChokeStart[i][1])>50).length,
 owners:_hostileFrontline.allowed.size})`);
ok(chokepoint.finite&&chokepoint.clear&&chokepoint.advanced>=4&&chokepoint.owners<=8,
 'the native group makes progress at a wall opening while respecting collision and the firing cap');

// Sampling an old contact must never reveal a silently moved player.
fresh(24);P('player.x=1900;player.y=-1300;');
const known=P(`(()=>{
 const rows=[];for(let f=0;f<5;f++){frameCount++;for(const a of __positionActors){
  const g=hostilePositionGoal(a,player,0,0,false,false);if(g)rows.push([g.x,g.y]);}}
 return rows;
})()`);
ok(known.every(([x,y])=>Math.hypot(x,y)<900),
 'hidden-target positioning uses the supplied historical contact, not the live player position');

// Cover corners belong to bodies, not to every guard evaluating the same wall.
fresh(8);
P(`player.x=180;player.y=-80;window.__positionWall={x:60,y:0,w:40,h:140,isWall:true};
 buildings=activeBuildings=[__positionWall];invalidateColIndex();
 for(let i=0;i<__positionActors.length;i++){
  const a=__positionActors[i];a.x=-60-i*3;a.y=-130+i*2;
  a._enemyCover={target:player,lastX:180,lastY:-80,seenMs:1800,candidates:[],goal:null};
 }`);
const cover=P(`(()=>{
 const rows=[];for(const a of __positionActors){const g=enemyCoverGoal(a,180,-80,a._enemyCover);
  a._enemyCover.goal=g;if(g)rows.push({x:g.x,y:g.y});}return rows;
})()`);
ok(cover.length>0,'shared cover claims still allow an accessible physical corner');
ok(cover.every((a,i)=>cover.every((b,j)=>i===j||(a.x-b.x)**2+(a.y-b.y)**2>=HOSTILE_POSITIONING.spacing**2)),
 'different guards cannot acquire the same crowded wall-end position');

fresh(8);
const naturalContact=P(`(()=>{
 player.x=180;player.y=-80;
 buildings=activeBuildings=[{x:60,y:0,w:40,h:140,isWall:true}];invalidateColIndex();
 const a=__positionActors[0],b=__positionActors[1];a.x=23;a.y=-61;
 a.aimAngle=0;a._enemyCover={target:player,lastX:180,lastY:-80,seenMs:1800,candidates:[],goal:null,searchMs:500,cycleMs:0};
 updateActorCover(a,100,6,0,true);const attached=!!a.cover?.active;
 updateEnemyCoverAI(a,player,true,160,deltaTime,false);
 b.x=-60;b.y=-130;b._enemyCover={target:player,candidates:[],goal:null};
 const second=enemyCoverGoal(b,180,-80,b._enemyCover);
 return {attached,claimed:_hostilePositioning.records.has(a),first:{x:a.x,y:a.y},second};
})()`);
ok(naturalContact.attached&&naturalContact.claimed,
 'native cover acquired without a planned goal still reserves its occupied body position');
ok(!naturalContact.second||Math.hypot(naturalContact.second.x-naturalContact.first.x,
 naturalContact.second.y-naturalContact.first.y)>=P('HOSTILE_POSITIONING.spacing'),
 'a later cover search cannot select the occupied natural-contact corner');

// Separation must also recover an exact duplicate spawn; an equality skip
// otherwise leaves the entire stack invisible to the penetration solver.
function exactStack(aerial=false){
 fresh(2,false);P(`for(const a of __positionActors){a.x=100;a.y=100;
  ${aerial?"a.eType='AERIAL_PISTOL';":''}a.updateEnemy=function(){};}`);
 P(`window.__positionSavedRandom=random;window.__positionSavedMathRandom=Math.random;
 random=()=>{throw Error('Separation consumed game RNG');};Math.random=()=>{throw Error('Separation consumed Math.random');};`);
 try{tick(1);}finally{P('random=__positionSavedRandom;Math.random=__positionSavedMathRandom;');}
 return P('__positionActors.map(a=>[a.x,a.y])');
}
for(const aerial of [false,true]){
 const first=exactStack(aerial),again=exactStack(aerial);
 ok(Math.hypot(first[0][0]-first[1][0],first[0][1]-first[1][1])>.1,
  (aerial?'Aerial':'Ground')+' bodies escape an exact shared spawn position');
 ok(JSON.stringify(first)===JSON.stringify(again),
  (aerial?'Aerial':'Ground')+' exact-overlap resolution is deterministic and consumes no RNG');
}

// Invalidation and simulation time: dead/removing troops release their place,
// pauses preserve ownership, and run reset removes every stale spatial claim.
fresh(24);tick(120);
const beforePause=P('JSON.stringify([..._hostilePositioning.records].map(([a,r])=>[a.x,a.y,r]))');
P('isPaused=true;doTick=false;for(let i=0;i<30;i++){frameCount++;updateEntities();}');
ok(P('JSON.stringify([..._hostilePositioning.records].map(([a,r])=>[a.x,a.y,r]))')===beforePause,
 'paused world ticks do not consume positioning clocks or move reservations');
P('isPaused=false;doTick=true;');
const retired=P(`(()=>{const a=__positionActors[0];a.dead=true;a.hp=0;
 enemiesList=enemiesList.filter(e=>e!==a);return a;})()`);
P('window.__positionDiverted=__positionActors[1];__positionDiverted.aggroTarget={x:1000,y:1000,hp:100};__positionDiverted.aggroTimer=99999;');
tick(30);
ctx.__positionRetired=retired;
ok(!P('_hostilePositioning.records.has(__positionRetired)'),
 'dead or removed enemies cannot retain a shared approach reservation');
ok(!P('_hostilePositioning.records.has(__positionDiverted)'),
 'an enemy fighting another target releases its player-facing reservation');
P('resetRunState();');
ok(P('_hostilePositioning.records.size===0&&_hostilePositioning.cells.size===0'),
 'run reset clears actor and spatial positioning ownership');

const report={checks,sourceSha256:createHash('sha256').update(source).digest('hex'),
 fixture:'64 normal human gunners; actual updateEntities with native body separation and Character updates',
 baseline,revised,stableGoals:stable,historicalGoals:known.length,coverCorners:cover,
 budgets,movingContact,rangeCorrection,obstruction,chokepoint};
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({checks,baseline:baseline.settled,revised:revised.settled},(key,value)=>key==='positions'?undefined:value));
console.log(checks+' shared positioning, real crowd movement, work, cover, target-memory and lifecycle checks passed: '+out+'/report.json');

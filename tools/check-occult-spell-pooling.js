// Fixed spell banks must recycle records without changing the simulated spell.
// Optional exact before/after trajectory/art parity:
// SPELL_POOL_BASELINE=/tmp/game-before.js node tools/check-occult-spell-pooling.js
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {ctx,probe:P,calls}=require('./harness');
ctx.setTimeout=()=>0;
const fixture=`
var poolFixture=()=>{
 currentLevel=currentBiome=9;BIOME_ACTIVE=false;started=doTick=true;
 isPaused=isDead=isWin=killcamMode=false;inStoryIntro=inStoryRoom=inTravelMenu=inWorldBuildingMenu=false;
 buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];barrels=[];enemiesList=[];
 corpses=[];particles=[];bullets=[];resetOccultWorld();frameCount=100;
 player=new Character(500,-1100,true);player.hp=player.maxHp=100000;player.shield=0;player.dead=false;
 viewLeft=-1000;viewRight=1500;viewTop=-2000;viewBottom=-400;
 var mage=createOccultMagician('RED',-400,-1100,'pool-mage');enemiesList.push(mage);
 return mage;
};var poolMage=poolFixture();`;
P(fixture);

if(process.env.SPELL_POOL_CHILD==='1'){
 P(`var poolFrames=[];var poolCapture=()=>JSON.parse(JSON.stringify({
  projectiles:occultProjectiles,effects:occultGroundEffects,bursts:occultSpellBursts,
  hp:player.hp,serial:occultSpellSerial,fxSerial:occultFxSerial}));
 occultFireProjectile(poolMage,'FIREBALL',0);occultFireProjectile(poolMage,'SHARD',.05);
 occultPushGround({kind:'LAVA',x:-360,y:-1100,angle:0,length:600,ownerId:'pool-mage',ageMs:0,ttlMs:780,hitIds:[]});
 occultPushGround({kind:'SHOCK',x:-400,y:-1100,radius:360,ownerId:'pool-mage',ageMs:0,ttlMs:440,hitIds:[]});
 for(let i=0;i<240;i++){
  frameCount++;occultUpdateWorld(i%17===0?63:1000/60);
  occultDrawGroundEffects();occultDrawProjectiles();poolFrames.push(poolCapture());
  if(i===70)occultFireProjectile(poolMage,'FIREBALL',.3);
  if(i===140)poolMage.stunTimer=20;
 }
 poolMage.stunTimer=0;occultFireProjectile(poolMage,'SHARD',0);
 buildings.push({x:-300,y:-1100,w:1,h:400,isWall:true});occultInvalidateNavigation();
 for(let i=0;i<30;i++){
  frameCount++;occultUpdateWorld(1000/60);occultDrawGroundEffects();occultDrawProjectiles();poolFrames.push(poolCapture());
 }`);
 fs.writeSync(1,JSON.stringify({frames:P('poolFrames'),draw:calls}));
 process.exit(0);
}

let checks=0;
const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
ok('occultProjectilePool.records.length===97&&occultGroundPool.records.length===48&&occultBurstPool.records.length===96',
 'Spell records are prewarmed to their live budgets, with one parent-transfer spare');
P(`var projectileSlots=occultProjectilePool.records.slice(),groundSlots=occultGroundPool.records.slice(),burstSlots=occultBurstPool.records.slice();
 occultFireProjectile(poolMage,'SHARD',0,{ttlMs:1,damage:99,debugTag:'old-cast'});
 var retiredShot=occultProjectiles[0];occultUpdateWorld(20);`);
ok('occultProjectiles.length===0&&retiredShot._occultFree&&retiredShot.ownerId===undefined&&retiredShot.volley===undefined&&!("debugTag"in retiredShot)',
 'Expiry releases every reference and extension field from the retired shot');
P("occultFireProjectile(poolMage,'FIREBALL',.7);var recycledShot=occultProjectiles[0];");
ok('recycledShot===retiredShot&&recycledShot.damage===23&&recycledShot.speed===300&&recycledShot.forked===false&&recycledShot.ageMs===0',
 'A different spell reuses the same record with its own complete defaults');
ok('Object.keys(recycledShot).every(k=>!k.startsWith("_occult"))',
 'Pool ownership and lifecycle metadata never become enumerable save fields');

P(`poolMage=poolFixture();player.dead=true;
 for(let i=0;i<94;i++){occultFireProjectile(poolMage,i===93?'FIREBALL':'SHARD',.2);occultProjectiles[i].speed=0;}
 var parentShot=occultProjectiles[93],parentVolley=parentShot.volley,parentPX=parentShot.x,parentPY=parentShot.y;
 parentShot.speed=300;parentShot.travel=74;occultUpdateWorld(1000/60);
 var forkChildren=occultProjectiles.slice(-3);`);
ok("occultProjectiles.length===96&&forkChildren.every(p=>p.kind==='FIRE_FORK')&&occultProjectilePool.highWater===97",
 'A full-boundary fork fits all three children without exceeding the 96-live cap');
ok('forkChildren.every(p=>p.px===parentPX&&p.py===parentPY&&p.volley===parentVolley&&p.speed===390&&p.radius===7&&p.ttlMs===3000)&&Math.abs(forkChildren[0].angle+.1)<1e-12&&Math.abs(forkChildren[2].angle-.5)<1e-12',
 'Fork transfer preserves original previous-position, volley, angles and lifetime');
ok('parentShot._occultFree&&occultProjectilePool.active===96&&new Set(occultProjectiles).size===96',
 'The parent retires only after its children own independent live records');
P('var fullSerial=occultSpellSerial,fullAcquired=occultProjectilePool.acquired;var fullRejected=occultFireProjectile(poolMage,"SHARD",0);');
ok('!fullRejected&&occultSpellSerial===fullSerial+1&&occultProjectilePool.acquired===fullAcquired&&occultProjectiles.length===96',
 'A rejected full-bank cast preserves the old volley sequence without borrowing a record');

P(`poolMage=poolFixture();var suppliedIds=['PLAYER'];
 var hazard=occultPushGround({kind:'SHOCK',x:-400,y:-1100,radius:360,ownerId:'pool-mage',ageMs:0,ttlMs:1,hitIds:suppliedIds});
 var reusedHitIds=hazard.hitIds;occultUpdateWorld(20);
 var emergence=occultPushGround({kind:'EMERGE',x:-400,y:-1100,ownerId:'pool-mage',ageMs:0,ttlMs:650,hitIds:[]});`);
ok('emergence===hazard&&emergence.hitIds===reusedHitIds&&emergence.hitIds.length===0&&emergence.radius===undefined&&suppliedIds[0]==="PLAYER"',
 'Ground hazards retain one private hit-ID array and clear both old hits and old shape fields');
P(`for(let i=0;i<200;i++)occultPushGround({kind:'EMERGE',x:i,y:-1100,ownerId:'pool-mage',ageMs:0,ttlMs:650,hitIds:[]});`);
ok('occultGroundEffects.length===48&&occultGroundPool.active===48&&new Set(occultGroundEffects).size===48&&occultGroundEffects[0].x===152&&occultGroundEffects[47].x===199',
 'Ground eviction reuses the oldest slot and keeps stable chronological order');
P(`for(let i=0;i<250;i++)occultDisperseProjectile({kind:i%2?'SHARD':'FIREBALL',x:i,y:-1100,angle:.1},'wall');`);
ok('occultSpellBursts.length===96&&occultBurstPool.active===96&&new Set(occultSpellBursts).size===96&&occultSpellBursts[0].x===154&&occultSpellBursts[95].x===249',
 'Dispersion storms recycle bounded records without reordering the surviving bursts');
P('var retiredBurst=occultSpellBursts[0];resetOccultSpellEffects();');
ok('retiredBurst._occultFree&&retiredBurst.reason===undefined&&occultBurstPool.free.length===96&&occultSpellBursts.length===0&&occultGroundEffects.length===48',
 'Cosmetic reset releases only its own bank and retains live hazards');

P(`poolMage=poolFixture();for(let i=0;i<2000;i++){
 occultFireProjectile(poolMage,i%2?'FIREBALL':'SHARD',0,{ttlMs:1});occultUpdateWorld(20);
}
var poolSnapshot=serializeOccultState();`);
ok('occultProjectilePool.records.every((p,i)=>p===projectileSlots[i])&&occultGroundPool.records.every((p,i)=>p===groundSlots[i])&&occultBurstPool.records.every((p,i)=>p===burstSlots[i])',
 'Thousands of casts and dispersions never create another projectile, ground or burst record');
ok('occultProjectilePool.active===0&&occultProjectilePool.free.length===97&&occultBurstPool.active<=96',
 'Sustained expiry returns the entire projectile bank without leaking slots');
P(`poolMage=poolFixture();for(let i=0;i<350;i++){occultProjectiles.length=0;occultFireProjectile(poolMage,'SHARD',0);}`);
ok('occultProjectiles.length===1&&occultProjectilePool.records.length===97',
 'Debug truncation can recover orphan slots on exhaustion without growing the bank');

P(`poolMage=poolFixture();var publicTraceA=occultTraceSpell(-400,-1100,-300,-1100,2);
 var publicTraceX=publicTraceA.x,publicTraceB=occultTraceSpell(-400,-1100,-200,-1100,2);
 var publicTargetsA=occultTargets(),publicTargetsB=occultTargets();`);
ok('publicTraceA!==publicTraceB&&publicTraceA.x===publicTraceX&&publicTargetsA!==publicTargetsB',
 'Diagnostic trace/target calls still return independent snapshots by default');
P(`var pooledTraceCalls=0,pooledTargetCalls=0,pooledScratchCorrect=true;
 var nativePoolTrace=occultTraceSpell,nativePoolTargets=occultTargets;
 occultTraceSpell=function(x0,y0,x1,y1,r,out){
  pooledTraceCalls++;pooledScratchCorrect=pooledScratchCorrect&&out===occultSpellTraceScratch;
  return nativePoolTrace(x0,y0,x1,y1,r,out);
 };
 occultTargets=function(out){
  pooledTargetCalls++;pooledScratchCorrect=pooledScratchCorrect&&out===occultSpellTargetsScratch;
  return nativePoolTargets(out);
 };
 try{
  poolMage.occult.angle=0;occultLavaReach(poolMage);
  for(let i=0;i<10;i++){occultFireProjectile(poolMage,'SHARD',0,{ttlMs:1});occultUpdateWorld(20);}
 }finally{occultTraceSpell=nativePoolTrace;occultTargets=nativePoolTargets;}`);
ok('pooledScratchCorrect&&pooledTraceCalls>10&&pooledTargetCalls>=10&&occultSpellTargetsScratch[0]===player',
 'Live projectiles and lava reuse contact and target scratch buffers on every simulation step');

for(const reason of ['impact','wall','cancel','skeleton','dead']){
 P(`poolMage=poolFixture();player.dead=false;
  occultFireProjectile(poolMage,'SHARD',0);var exitingShot=occultProjectiles[0];
  if('${reason}'==='impact')player.x=exitingShot.x+15;
  if('${reason}'==='wall'){buildings.push({x:exitingShot.x+15,y:-1100,w:1,h:150,isWall:true});occultInvalidateNavigation();}
  if('${reason}'==='cancel')poolMage.stunTimer=10;
  if('${reason}'==='skeleton')poolMage.skeletonTimer=10;
  if('${reason}'==='dead')poolMage.hp=0;
  occultUpdateWorld(100);`);
 ok('exitingShot._occultFree&&occultProjectiles.length===0&&occultSpellBursts.length===1',
  reason+' leaves its normal dispersion and releases the projectile slot');
}

P(`poolMage=poolFixture();occultFireProjectile(poolMage,'SHARD',0);
 occultPushGround({kind:'SHOCK',x:-400,y:-1100,radius:360,ownerId:'pool-mage',ageMs:120,ttlMs:440,hitIds:['PLAYER']});
 var heldSave=serializeOccultState(),heldSaveJson=JSON.stringify(heldSave);
 var liveHazard=occultGroundEffects[0],liveShot=occultProjectiles[0];
 heldSave.effects[0].hitIds.push('saved-only');heldSave.projectiles[0].damage=999;`);
ok('liveHazard.hitIds.length===1&&liveShot.damage===27',
 'Save snapshots own their hit lists and projectile fields independently of pooled storage');
P('resetOccultWorld();');
ok('heldSave.effects[0].hitIds.length===2&&heldSave.projectiles[0].damage===999&&liveHazard.hitIds.length===0&&liveShot.ownerId===undefined',
 'Releasing live objects cannot mutate an earlier detached save snapshot');
P('var restoredPoolSave=restoreOccultState(JSON.parse(heldSaveJson));');
ok('restoredPoolSave&&occultProjectiles.length===1&&occultGroundEffects.length===1&&occultProjectiles[0]._occultPool===occultProjectilePool&&occultGroundEffects[0]._occultPool===occultGroundPool',
 'Loading restores validated records into the same prewarmed banks');
ok('occultProjectiles[0].damage===27&&occultGroundEffects[0].hitIds.length===1&&occultGroundEffects[0].hitIds[0]==="PLAYER"&&!JSON.stringify(serializeOccultState()).includes("_occultPool")',
 'Restore retains canonical damage and hit tracking while omitting pool metadata');
P('var pausedPoolState=JSON.stringify(serializeOccultState());isPaused=true;occultUpdateWorld(100);');
ok('JSON.stringify(serializeOccultState())===pausedPoolState','Pause freezes pooled records without aging or retiring them');
P('isPaused=false;resetOccultWorld();');
ok('occultProjectiles.length===0&&occultGroundEffects.length===0&&occultSpellBursts.length===0&&occultProjectilePool.free.length===97&&occultGroundPool.free.length===48&&occultBurstPool.free.length===96',
 'World replacement releases every bank and all temporary owner/volley/hit references');
ok('occultSpellTargetsScratch.length===0','World replacement clears target scratch references to the old actors');
ok('occultProjectilePool.records.every(p=>typeof p.x==="number"&&typeof p.speed==="number"&&p.forked===false&&p.ownerId===undefined)&&occultBurstPool.records.every(p=>typeof p.x==="number"&&typeof p.seed==="number"&&p.reason===undefined)&&occultGroundPool.records.every(p=>typeof p.x==="number"&&p.radius===undefined)',
 'Recycled numeric fields remain numbers while owner strings and optional ground shapes are cleared');

const baseline=process.env.SPELL_POOL_BASELINE;
if(baseline){
 const sources=[baseline,process.env.GAME_JS||path.join(__dirname,'..','game.js')];
 const outputs=sources.map(source=>{
  assert(fs.existsSync(source),'Missing spell parity source: '+source);
  const result=spawnSync(process.execPath,[__filename],{env:{...process.env,GAME_JS:source,SPELL_POOL_CHILD:'1'},encoding:'utf8',maxBuffer:8*1024*1024});
  assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
 });
 assert.deepEqual(outputs[1],outputs[0],'Pooled spells must retain every trajectory, damage result, fork, dispersion and recorded draw across 270 frames');checks++;
 console.log('270 complete spell simulation/art frames match the independent pre-pooling source.');
}
console.log('Occult spell pooling: '+checks+' bounded-bank, reuse, retirement, reset, save and lifecycle checks passed.');

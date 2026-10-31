// Native spell effects: lifecycle, exact attack art extents and shared lighting.
const assert=require('node:assert/strict');
const {ctx,probe:P,calls}=require('./harness');
ctx.setTimeout=()=>0;
let checks=0;
const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
P(`var spellFxFixture=()=>{
 currentLevel=currentBiome=9;BIOME_ACTIVE=false;started=doTick=true;
 isPaused=isDead=isWin=killcamMode=false;inStoryIntro=inStoryRoom=inTravelMenu=inWorldBuildingMenu=false;
 buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];barrels=[];enemiesList=[];
 player=new Character(0,-1000,true);player.hp=100;player.dead=false;
 viewLeft=-900;viewRight=900;viewTop=-2000;viewBottom=-400;
 resetOccultWorld();_emitFrame=-1;
};spellFxFixture();`);
ok('occultSpellBursts.length===0&&sceneEmitters().every(l=>l.undergroundTorch||l.undergroundFlashlight)',
 'An idle dungeon retains only its permanent torches and carried flashlight');
P(`for(const kind of ['FIREBALL','FIRE_FORK','SHARD'])for(const reason of ['impact','wall','expire','fork','cancel'])
 occultDisperseProjectile({kind,x:20,y:-1000,angle:.4},reason);`);
ok("occultSpellBursts.length===15&&['FIREBALL','FIRE_FORK','SHARD'].every(kind=>occultSpellBursts.filter(b=>b.kind===kind).length===5)",
 'Every projectile kind has dispersion records for impacts, walls, expiry, splitting and caster cancellation');
ok("occultSpellBursts.every(b=>b.ageMs===0&&b.count>=7&&b.count<=14&&b.ttlMs>=300&&b.ttlMs<=720)",
 'Burst records bound their procedural mote counts and visible lifetimes');
P('var invalidBurstBefore=occultSpellBursts.length;occultDisperseProjectile({x:NaN,y:0});');
ok('occultSpellBursts.length===invalidBurstBefore','Malformed impact coordinates cannot enter the effect bank');
P('isPaused=true;occultUpdateSpellEffects(100);');
ok('occultSpellBursts.every(b=>b.ageMs===0)','Pause freezes every dispersion clock');
P('isPaused=false;occultUpdateSpellEffects(100);');
ok('occultSpellBursts.every(b=>b.ageMs===100)','One simulation step advances every burst equally');
P('var spellFrameBefore=JSON.stringify(occultSpellBursts);doTick=false;occultUpdateSpellEffects(100);');
ok('JSON.stringify(occultSpellBursts)===spellFrameBefore','A stopped simulation cannot age cosmetic remnants');
P('doTick=true;for(let i=0;i<8;i++)occultUpdateSpellEffects(100);');
ok('occultSpellBursts.length===0','All remnants fade out and release their bounded records');
P(`for(let i=0;i<250;i++)occultDisperseProjectile({kind:i%2?'SHARD':'FIREBALL',x:0,y:-1000,angle:0},'wall');`);
ok('occultSpellBursts.length===OCCULT_FX.maxBursts&&OCCULT_FX.maxBursts===96',
 'A projectile storm cannot exceed the burst budget');
P('resetOccultSpellEffects();');
ok('occultSpellBursts.length===0&&occultFxSerial===1','World resets discard all old remnants and their deterministic seed counter');

// A dying owner must leave a visible ending that does not depend on that
// removed Character still being in the live roster.
P(`var dyingFxMage=createOccultMagician('RED',-200,-1200,'fx-owner');enemiesList.push(dyingFxMage);
 occultDisperseProjectile({kind:'FIREBALL',x:0,y:-1100,angle:0},'cancel');dyingFxMage.hp=0;enemiesList=[];
 occultUpdateSpellEffects(100);frameCount++;`);
ok("occultSpellBursts.length===1&&occultSpellBursts[0].ageMs===100&&sceneEmitters().some(l=>l.spellKind==='DISPERSE_FIREBALL')",
 'A caster death leaves independently fading and lit fire remnants');

for(const [kind,cast]of[['RED','FIREBALL'],['RED','LAVA'],['BLUE','SHARD'],['BLUE','SHOCK']]){
 P(`spellFxFixture();var chargedFxMage=createOccultMagician('${kind}',0,-1100,'fx-${cast}');
  chargedFxMage.occult.phase='CHARGE';chargedFxMage.occult.cast='${cast}';
  chargedFxMage.occult.chargeDurationMs=1000;chargedFxMage.occult.chargeMs=700;chargedFxMage.occult.angle=0;
  enemiesList.push(chargedFxMage);frameCount++;`);
 ok(`sceneEmitters().some(l=>l.undergroundSpell&&l.spellKind==='CHARGE_${cast}'&&l.p>.8&&l.z>20)`,
  cast+' preparation contributes an actual local scene light');
}
for(const kind of ['FIREBALL','FIRE_FORK','SHARD']){
 P(`spellFxFixture();occultProjectiles.push({kind:'${kind}',x:80,y:-1000,px:75,py:-1000,angle:0,radius:8,ageMs:120});frameCount++;`);
 ok(`sceneEmitters().some(l=>l.undergroundSpell&&l.spellKind==='${kind}'&&l.r>=120)`,
  kind+' flight contributes an actual local scene light');
}
P(`spellFxFixture();occultGroundEffects.push({kind:'LAVA',x:0,y:-1000,angle:0,length:600,ageMs:300,ttlMs:780,hitIds:[]},
 {kind:'SHOCK',x:-200,y:-1000,ageMs:180,ttlMs:440,hitIds:[]});frameCount++;`);
ok("sceneEmitters().filter(l=>l.spellKind==='LAVA').length>=6&&sceneEmitters().some(l=>l.spellKind==='LAVA'&&l.x>=590)",
 'Fire lighting follows the complete advancing thirty-metre fissure');
ok("sceneEmitters().some(l=>l.spellKind==='SHOCK'&&l.r>=OCCULT.shockRadius)",
 'The expanded electrical field lights its full radius');
ok('sceneEmitters()[0].undergroundFlashlight&&sceneEmitters().every((l,i,a)=>i===0||l.d2>=a[i-1].d2)',
 'Shared nearest-first lighting keeps the carried flashlight in its first slot');
P(`spellFxFixture();for(let i=0;i<200;i++)occultProjectiles.push({kind:'FIREBALL',x:i-100,y:-1000,ageMs:i});frameCount++;`);
ok('sceneEmitters().filter(l=>l.undergroundSpell).length===OCCULT_FX.maxEmitters&&OCCULT_FX.maxEmitters===32',
 'Dynamic spell lights have their own strict candidate budget');

// Rendering must use full spell footprints even when the origin is offscreen.
const nativeEllipse=ctx.ellipse,nativeRect=ctx.rect,nativeRandom=ctx.random;
let ellipses=[],rects=[];
ctx.ellipse=(...a)=>{ellipses.push(a);return nativeEllipse(...a);};
ctx.rect=(...a)=>{rects.push(a);return nativeRect(...a);};
try{
 P(`spellFxFixture();var largeFxMage=createOccultMagician('BLUE',0,-1000,'fx-large');enemiesList.push(largeFxMage);
  largeFxMage.occult.phase='CHARGE';largeFxMage.occult.cast='SHOCK';largeFxMage.occult.chargeDurationMs=1000;
  largeFxMage.occult.chargeMs=600;viewLeft=260;viewRight=400;viewTop=-1040;viewBottom=-960;`);
 ctx.random=()=>{throw Error('Spell art consumed gameplay RNG');};
 P('occultDrawGroundEffects();');
 assert(ellipses.some(a=>a[0]===0&&a[1]===-1000&&a[2]===P('OCCULT.shockRadius')*2),'Large shock telegraph must retain its exact collision radius');
 checks++;
 rects=[];
 P(`largeFxMage.eType='OCCULT_RED';largeFxMage.occult.kind='RED';largeFxMage.occult.cast='LAVA';largeFxMage.occult.angle=0;
  viewLeft=520;viewRight=650;occultDrawGroundEffects();`);
 assert(rects.some(a=>a[0]===0&&a[2]===P('OCCULT.lavaRange')&&a[3]===30),'A lava origin outside the camera must still paint the visible far end and full warning length');
 checks++;
}finally{ctx.ellipse=nativeEllipse;ctx.rect=nativeRect;ctx.random=nativeRandom;}

// Repeat art with a recording context; clocks/state may only change in update.
let finite=true,stack=0,minStack=0;
const painters=['push','pop','translate','rotate','ellipse','line','rect','quad','vertex','bezierVertex','arc','triangle'];
const saved=Object.fromEntries(painters.map(k=>[k,ctx[k]]));
for(const k of painters)ctx[k]=(...a)=>{finite&&=a.every(v=>typeof v!=='number'||Number.isFinite(v));if(k==='push')stack++;if(k==='pop'){stack--;minStack=Math.min(minStack,stack);}return saved[k](...a);};
const random=ctx.random;
try{
 P(`spellFxFixture();var fxArtMage=createOccultMagician('RED',0,-1100,'fx-art');enemiesList.push(fxArtMage);
  fxArtMage.occult.phase='CHARGE';fxArtMage.occult.cast='LAVA';fxArtMage.occult.angle=0;
  fxArtMage.occult.chargeMs=600;fxArtMage.occult.chargeDurationMs=1000;
  occultGroundEffects.push({kind:'LAVA',x:0,y:-1000,angle:0,length:600,ageMs:300,ttlMs:780,hitIds:[]},
   {kind:'SHOCK',x:-200,y:-1100,ageMs:180,ttlMs:440,hitIds:[]});
  for(const kind of ['FIREBALL','FIRE_FORK','SHARD']){
   occultProjectiles.push({kind,x:100,y:-1200,angle:.4,radius:9,ageMs:150});
   occultDisperseProjectile({kind,x:-100,y:-1100,angle:.4},'impact');
  }
  occultUpdateSpellEffects(100);
  var fxArtSnapshot=JSON.stringify([fxArtMage.occult,occultProjectiles,occultGroundEffects,occultSpellBursts]);`);
 ctx.random=()=>{throw Error('Spell art consumed gameplay RNG');};
 const beforePaint=calls.sig;
 P('occultDrawGroundEffects();occultDrawProjectiles();gatherOccultSpellEmitters([]);');
 ok('JSON.stringify([fxArtMage.occult,occultProjectiles,occultGroundEffects,occultSpellBursts])===fxArtSnapshot',
  'Fire, lightning, trail, burst and lighting painters never advance simulation state');
 assert(finite&&stack===0&&minStack===0,'Spell art must stay finite and balance transforms');checks++;
 assert(calls.sig!==beforePaint,'Native cel spell painters must draw geometry');checks++;
}finally{Object.assign(ctx,saved);ctx.random=random;}
console.log('Occult spell FX: '+checks+' dispersion, clock, range-art and shared-light checks passed.');

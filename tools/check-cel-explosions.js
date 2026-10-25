// Cosmetic blast integration: real damage/ownership plus one bounded pooled
// effect, deterministic painting, pause, depth and retirement.
const assert=require('node:assert/strict');
const {ctx,calls,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,pending=[];
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=(fn,delay)=>{pending.push({fn,delay});return pending.length;};
function stage(){
 pending=[];
 probe(`currentLevel=currentBiome=2;isStoryMode=false;BIOME_ACTIVE=false;
  started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=false;
  townsData={};window.outpostForts={};nm0AmbushActive=farmAmbushActive=false;
  buildings=activeBuildings=[];barrels=[];activeParkingCars=[];parkingCars=[];
  particles=[];_particlePool.length=0;corpses=[];enemiesList=[];bullets=[];
  weaponDrops=[];healthPacks=[];floatingScores=[];fires=[];invalidateColIndex();
  resetShovelState();resetForestWildlife();wipeAllBloodBanks();useBloodBank('cel-test');
  player=new Character(2000,2000,true);explosiveArmorUnlocked=false;
  consecutiveKills=4;comboTimer=33;totalKills=0;MAX_KILLS=100000;score=1000;
  viewLeft=viewTop=-10000;viewRight=viewBottom=10000;frameCount++;
  window.celOwner={x:40,y:50,shovelLevel:currentLevel,shovelDepth:18,shovelDepthTarget:18};`);
}
const numberOf=type=>P(`particles.filter(p=>p.t===${JSON.stringify(type)}).length`);

stage();
probe("emit(0,0,40,color(255,150,0),'EXPLOSION');");
ok('a legacy forty-puff request becomes one coherent cel blast',numberOf('CEL_EXPLOSION')===1&&P('particles.length===1'));
ok('legacy emission leaves no old explosion puffs',numberOf('EXPLOSION')===0);
probe("frameCount++;emit(40,50,30,color(0,100,255),'EXPLOSION',4,-3,celOwner);");
ok('the blue jetpack emission retains its blue material',P("particles[1].fxMaterial==='BLUE'"));
ok('owner-bound blasts retain their native depth and launch heading',
 P('particles[1].shovelOwner===celOwner&&shovelEffectDepth(particles[1])===18&&Math.abs(particles[1].fxAngle-Math.atan2(-3,4))<1e-8'));

stage();
const nativeRandom=ctx.random;
ctx.random=()=>{throw Error('cel explosion consumed gameplay randomness');};
try{
 probe("window.cel=emitCelExplosion(10,20,160,color(255,150,0),null,1,0);");
 ok('direct cosmetic emission returns a pooled fire blast',P("cel&&cel===particles[0]&&cel.t==='CEL_EXPLOSION'&&cel.fxMaterial==='FIRE'"));
 ok('the explosion is anchored instead of scattering its root',P('cel.vx===0&&cel.vy===0&&cel.x===10&&cel.y===20'));
 probe('window.celBefore=JSON.stringify(cel);');
 const snapshot=()=>JSON.stringify(calls),clearCalls=()=>{for(const key of Object.keys(calls))calls[key]=0;};
 const nativePush=ctx.push,nativePop=ctx.pop;let depth=0,minDepth=0;
 ctx.push=(...a)=>{depth++;return nativePush(...a);};
 ctx.pop=(...a)=>{depth--;minDepth=Math.min(minDepth,depth);return nativePop(...a);};
 let first;
 try{clearCalls();probe('cel.paint();');first=snapshot();clearCalls();probe('cel.paint();');}
 finally{ctx.push=nativePush;ctx.pop=nativePop;}
 ok('painting a fixed age is deterministic and never rolls combat randomness',snapshot()===first);
 ok('the layered painter balances its native transform stack',depth===0&&minDepth===0);
 ok('painting cannot advance the effect',P('JSON.stringify(cel)===celBefore'));
 probe('doTick=false;updateParticles();');
 ok('a paused particle pass freezes the complete blast',P('JSON.stringify(cel)===celBefore'));
 probe('doTick=true;updateParticles();');
 ok('active simulation advances the blast age exactly once',P('cel.fxAge===1'));
 probe('for(let i=0;i<60;i++){frameCount++;updateParticles();}');
 ok('a completed blast retires into the bounded shared particle pool',P('particles.length===0&&_particlePool.includes(cel)&&cel.shovelOwner===null'));
 probe("window.celWound=newParticle(7,8,color(90,0,0),'WOUND_BLOOD',3,-2);");
 ok('the early-return wound path clears blast state after recycling',P("celWound===cel&&celWound.fxAge===0&&celWound.fxLife===0&&celWound.fxMaterial===''&&celWound.fxSeed===0"));
 ok('continuous wound particles keep their original size and physics',P('celWound.sz===2.8&&celWound.vx===3&&celWound.vy===-2&&celWound.l===16'));
}finally{ctx.random=nativeRandom;}

stage();
probe("for(let i=0;i<100;i++)emitCelExplosion(0,0,160,color(255,150,0));");
ok('one crowded frame admits at most eight coherent explosions',numberOf('CEL_EXPLOSION')===8);
probe("frameCount++;for(let i=0;i<100;i++)emitCelExplosion(0,0,160,color(255,150,0));frameCount++;for(let i=0;i<100;i++)emitCelExplosion(0,0,160,color(255,150,0));");
ok('simultaneous live explosions remain capped at twenty-four',numberOf('CEL_EXPLOSION')===24);
probe("frameCount++;window.celRejected=emitCelExplosion(0,0,160,color(255,150,0));");
ok('over-budget effects return without queuing another blast',P('!celRejected')&&numberOf('CEL_EXPLOSION')===24);
const resetFrame=P('frameCount');
probe("resetRunState();window.celAfterReset=emitCelExplosion(0,0,160,color(255,150,0));");
ok('a real hard reset immediately clears exhausted live-budget accounting in the same frame',
 P('frameCount')===resetFrame&&P('!!celAfterReset')&&numberOf('CEL_EXPLOSION')===1);
probe("for(let i=0;i<7;i++)emitCelExplosion(0,0,160,color(255,150,0));resetRunState();window.celAfterFrameCap=emitCelExplosion(0,0,160,color(255,150,0));");
ok('a real hard reset also clears the exhausted per-frame admission cap without waiting',
 P('frameCount')===resetFrame&&P('!!celAfterFrameCap')&&numberOf('CEL_EXPLOSION')===1);

stage();
probe("window.celEdge=emitCelExplosion(-70,30,250,color(255,150,0));viewLeft=0;viewRight=100;viewTop=0;viewBottom=100;doTick=false;window.celEdgePaints=0;celEdge.show=function(){celEdgePaints++;};updateParticles();");
ok('a large blast remains visible when its root is beyond the old fifty-unit cull',P('celEdgePaints===1'));

// Main trigger paths retain damage, teams and credit; their art must not add
// a second gameplay blast or the old sixty-particle cloud.
stage();
probe('triggerExplosion(0,0,160,false,true,player);');
ok('an empty blast still stamps its scorch immediately without a blood pool',P('Object.keys(bloodChunks).length>0&&bloodPools.length===0'));
stage();
probe(`window.celInside=new Character(80,0,false,'NORMAL');celInside.hp=1000;celInside.isFriendly=celInside.isNeutral=false;
 window.celOutside=new Character(170,0,false,'NORMAL');celOutside.hp=1000;celOutside.isFriendly=celOutside.isNeutral=false;
 enemiesList=[celInside,celOutside];triggerExplosion(0,0,160,false,true,player);`);
ok('ordinary grenade-sized blasts create exactly one cel effect',numberOf('CEL_EXPLOSION')===1);
ok('ordinary blast damage still kills an in-range hostile only',P('celInside.dead&&celInside.hp===0&&celOutside.hp===1000&&!celOutside.dead'));
ok('the existing grenade death animation is retained',P("corpses.length===1&&corpses[0].dT===5"));
ok('the main blast no longer emits its old explosion or smoke cloud',numberOf('EXPLOSION')===0&&numberOf('SMOKE')===0);
const grenadeSize=P("particles.find(p=>p.t==='CEL_EXPLOSION').sz");

stage();
probe(`window.celAlly=new Character(80,0,false,'NORMAL');celAlly.hp=300;celAlly.shield=0;celAlly.isFriendly=true;celAlly.isNeutral=false;
 window.celHostile=new Character(90,0,false,'NORMAL');celHostile.hp=300;celHostile.isFriendly=celHostile.isNeutral=false;
 enemiesList=[celAlly,celHostile];triggerExplosion(0,0,160,false,false,null);`);
ok('hostile blast allegiance still applies one hundred fifty damage to allies',P('celAlly.hp===150&&celHostile.hp===300'));

stage();
probe(`window.celDirect=new Character(60,0,false,'NORMAL');celDirect.hp=1000;celDirect.isFriendly=celDirect.isNeutral=false;
 window.celSplash=new Character(90,0,false,'NORMAL');celSplash.hp=1000;celSplash.isFriendly=celSplash.isNeutral=false;
 enemiesList=[celDirect,celSplash];triggerRocketExplosion(0,0,true,celDirect,player);`);
ok('rocket art creates one coherent effect without duplicating its damage',numberOf('CEL_EXPLOSION')===1&&P('celDirect.hp===650&&celSplash.hp===900'));
ok('rocket range gives its art a smaller footprint than a grenade-sized blast',P("particles.find(p=>p.t==='CEL_EXPLOSION').sz")<grenadeSize);

stage();
probe(`window.celAllySource=new Character(1000,900,false,'NORMAL');celAllySource.isFriendly=true;
 window.celChainVictim=new Character(140,0,false,'NORMAL');celChainVictim.hp=20;celChainVictim.isFriendly=celChainVictim.isNeutral=false;
 enemiesList=[celChainVictim];parkingCars=[{x:0,y:0}];triggerExplosion(0,0,100,false,true,celAllySource);`);
const chain=pending.find(p=>p.delay>=100&&p.delay<=250);
ok('a car still schedules its separate delayed chain explosion',!!chain);
probe('frameCount++;');chain.fn();
ok('the delayed chain keeps allied ownership and cannot build player combo',P('celChainVictim.dead&&consecutiveKills===4&&comboTimer===33'));
ok('two actual blast events produce two effects, rather than a repeated animation emitter',numberOf('CEL_EXPLOSION')===2);

stage();
probe("triggerExplosion(0,0,140,true,false,null);");
ok('a molotov still creates its gameplay fire zone alongside one cel blast',P('fires.length===1')&&numberOf('CEL_EXPLOSION')===1);
console.log(`${checks}/${checks} cel explosion routing, damage, pooling, bounds, pause and ownership checks passed.`);

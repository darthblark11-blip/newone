// Real acoustic events feed the existing perception controller. These checks
// inspect audible strength and historical clues without replacing AI or LOS.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');
ctx.setTimeout=()=>0;
let checks=0;const ok=(code,label)=>{assert.ok(typeof code==='string'?P(code):code,label);checks++;};
const near=(a,b,label)=>ok(Math.abs(a-b)<1e-10,label);
function scene(){
 P(`resetShovelState();resetUndergroundRoute();
  currentLevel=currentBiome=1;BIOME_ACTIVE=false;started=doTick=true;
  isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inCutscene=false;
  inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;window.inNM0SecretOverlay=false;buildGhost=null;
  leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0};
  buildings=activeBuildings=parkingCars=activeParkingCars=barrels=[];bullets=[];particles=[];corpses=[];
  invalidateColIndex();resetForestWildlife();player=new Character(2000,2000,true);player.hp=99999;
  var soundGuard=new Character(0,0,false,'NORMAL');soundGuard.aiOffset=0;soundGuard.aimAngle=0;soundGuard.fireTimer=9999;
  enemiesList=[soundGuard];frameCount++;deltaTime=50;stealthPerceptionReset();
  var soundState=stealthPerceptionState(soundGuard);`);
}
function wall(){P("buildings=activeBuildings=[{x:150,y:0,w:30,h:300,hp:Infinity,isWall:true,coverType:'HIGH'}];invalidateColIndex()");}
scene();P("var soundEvent=stealthEmitNoise(300,0,600,'SHOT')");
ok('soundEvent.origin.x===300&&soundEvent.origin.y===0&&soundEvent.peakRadius===600&&soundEvent.radius===600&&soundEvent.attenuation===STEALTH_PERCEPTION.noiseAttenuation',
 'events expose their frozen origin, peak radius and distance attenuation');
const clear=P('stealthPerceivedNoise(soundGuard,soundEvent)');wall();
const blocked=P('stealthPerceivedNoise(soundGuard,soundEvent)');
near(blocked,clear*P('STEALTH_PERCEPTION.noiseWallGain'),'opaque wall continuously attenuates perceived volume');
ok(blocked>0&&blocked<clear,'blocked nearby sound remains a weaker historical clue');
P('soundGuard.x=500');const nearer=P('stealthPerceivedNoise(soundGuard,soundEvent)');
P('soundGuard.x=320');const closest=P('stealthPerceivedNoise(soundGuard,soundEvent)');
ok(closest>nearer&&nearer>clear,'perceived volume increases continuously as distance falls');
P('soundGuard.x=901');ok('stealthPerceivedNoise(soundGuard,soundEvent)===0','sounds outside peak radius are inaudible');
scene();P("soundEvent=stealthEmitNoise(0,0,600,'SHOT');stealthHearNoise(soundGuard,soundState,50)");
ok("soundState.suspicion>0&&soundState.suspicion<1&&soundState.phase==='CURIOUS'&&!_redMesaNoise.alarm",'one isolated gunshot builds partial suspicion without binary combat');
const single=P('soundState.suspicion');P('for(let i=0;i<100;i++)stealthHearNoise(soundGuard,soundState,50)');
near(P('soundState.suspicion'),single,'same event cannot pump suspicion across repeated AI updates');
P("stealthEmitNoise(0,0,600,'SHOT');stealthHearNoise(soundGuard,soundState,50)");
ok("soundState.suspicion===1&&soundState.phase==='ALERT'&&soundGuard.state==='CHASE'&&!soundState.visible&&soundState.goalX===0&&soundState.goalY===0",
 'distinct nearby sounds fill the meter and enter native combat at their historical origin');
P('soundGuard.fireTimer=0;frameCount++;soundGuard.updateEnemy()');
ok('bullets.length===0&&!soundState.visible&&soundState.goalX!==player.x','auditory alert cannot fire through unseen player location');
scene();wall();P("soundEvent=stealthEmitNoise(300,0,600,'SHOT');player.x=-2000;player.y=-2000;stealthHearNoise(soundGuard,soundState,50)");
ok('soundState.goalX===300&&soundState.goalY===0&&soundState.suspicion>0&&soundState.suspicion<.2&&!soundState.visible',
 'occluded hearing records only frozen event coordinates after the player moves');
// Low clues progress through the original CURIOUS/INVESTIGATE controller.
scene();P("stealthEmitNoise(0,200,500,'RUN');frameCount++;soundGuard.updateEnemy()");
ok("soundState.phase==='CURIOUS'&&soundState.suspicion>0&&soundState.suspicion<1&&soundState.goalY===200",'low footstep suspicion creates curiosity');
P('for(let i=0;i<10;i++){frameCount++;soundGuard.updateEnemy()}');
ok("soundState.phase==='INVESTIGATE'&&soundGuard.y>0&&soundGuard.state==='INVESTIGATE'",'low suspicion investigates its origin through native movement');
// Consumed inaudible and expired events cannot become fresh as a culled guard
// approaches or returns after their original lifetime.
scene();P("stealthEmitNoise(1200,0,300,'SHOT');stealthHearNoise(soundGuard,soundState,50);soundGuard.x=1200;stealthHearNoise(soundGuard,soundState,50)");
ok('soundState.suspicion===0&&soundState.heardId===1','an initially inaudible consumed event cannot replay after movement');
scene();P("stealthEmitNoise(0,0,600,'SHOT');_redMesaNoise.clock=STEALTH_PERCEPTION.noiseTtlMs+1;stealthHearNoise(soundGuard,soundState,50)");
ok('soundState.suspicion===0&&soundState.heardId===1','expired queued audio cannot create delayed suspicion');
P('frameCount++;stealthUpdateNoise(50)');ok('_redMesaNoise.events.length===0','world updates retire expired events without listeners');
// Emission/hearing/clock freeze under both pause and no-simulation frames.
for(const pause of [true,false]){
 scene();P("stealthEmitNoise(0,0,500,'RUN')");const before=P('JSON.stringify({clock:_redMesaNoise.clock,count:_redMesaNoise.events.length,suspicion:soundState.suspicion,phase:soundState.phase})');
 P(`isPaused=${pause};doTick=${pause};frameCount++;stealthEmitNoise(0,0,500,'SHOT');stealthUpdateNoise(100);stealthHearNoise(soundGuard,soundState,100)`);
 ok(P('JSON.stringify({clock:_redMesaNoise.clock,count:_redMesaNoise.events.length,suspicion:soundState.suspicion,phase:soundState.phase})')===before,'pause/no-tick freezes audio and suspicion');
}
scene();P('soundGuard.hp=0;stealthEmitNoise(0,0,500);stealthHearNoise(soundGuard,soundState,50)');
ok('soundState.suspicion===0','dead listeners do not consume clues');
P('player.hp=0');ok("stealthEmitNoise(0,0,500,'SHOT')===null",'dead players cannot manufacture new acoustic events');
scene();P('for(let i=0;i<30;i++)stealthEmitNoise(i,0,500)');
ok('_redMesaNoise.events.length===STEALTH_PERCEPTION.noiseCap&&_redMesaNoise.events[0].x===18','acoustic queue remains bounded');
P('soundState.heardId=999;stealthPerceptionReset();stealthEmitNoise(0,0,500);stealthHearNoise(soundGuard,soundState,50)');
ok('soundState.suspicion>0&&soundState.heardId===1','world reset restarts event consumption even for an existing guard');
scene();P("stealthEmitNoise(1,2,500);player=new Character(2000,2000,true);stealthEmitNoise(3,4,500)");
ok('_redMesaNoise.events.length===1&&_redMesaNoise.events[0].x===3','player replacement clears event ownership even before the first world tick');
P('currentLevel=2;stealthEmitNoise(5,6,500)');ok('_redMesaNoise.events.length===1&&_redMesaNoise.events[0].x===5','level replacement cannot leak old audio');
scene();P("soundState.suspicion=.42;soundState.heardId=999;var acousticSave=serializeRedMesaStealthActor(soundGuard);stealthPerceptionReset();var restoredSoundGuard=new Character(0,0,false,'NORMAL');restoreRedMesaStealthActor(restoredSoundGuard,acousticSave);stealthHearNoise(restoredSoundGuard,stealthPerceptionState(restoredSoundGuard),50)");
ok('restoredSoundGuard.stealthPerception.suspicion===.42&&!Object.prototype.hasOwnProperty.call(acousticSave,"heardId")',
 'saved suspicion stays compatible and never replays a runtime event cursor');
scene();P('player.shovelLevel=1;player.shovelDepth=36;stealthEmitNoise(0,0,500);player.shovelDepth=0;stealthHearNoise(soundGuard,soundState,50)');
ok('soundState.suspicion===0','buried noise cannot reveal a surface player after the source changes layers');
P('soundGuard.shovelLevel=1;soundGuard.shovelDepth=36;soundState.heardId=0;stealthHearNoise(soundGuard,soundState,50)');
ok('soundState.suspicion>0&&soundState.goalX===0&&soundState.goalY===0','historical source layer remains audible to a matching buried listener');
// Movement sounds come from real accepted actions and displacement, not SFX.
scene();P('player.x=0;player.y=500;player.isMoving=true;leftStick={active:true,dx:1,dy:0};stealthUpdateNoise(50)');
P('frameCount++;player.x+=47;stealthUpdateNoise(50);stealthUpdateNoise(50)');
ok("_redMesaNoise.events.length===1&&_redMesaNoise.events[0].kind==='RUN'",'one running stride emits one event despite repeated frame sampling');
scene();P('player.x=0;player.y=500;player.isMoving=true;leftStick={active:true,dx:1,dy:0};stealthUpdateNoise(50);player.activateDash()');
P('for(let i=0;i<8;i++){frameCount++;player.x+=15;stealthUpdateNoise(50);player.dashTimer=Math.max(0,player.dashTimer-1)}');
ok("_redMesaNoise.events.length===1&&_redMesaNoise.events[0].kind==='ROLL'",'full roll emits one event and no duplicate running strides');
scene();P('player.x=0;player.y=500;player.isMoving=true;leftStick={active:true,dx:1,dy:0};stealthUpdateNoise(50);requestPlayerProne()');
P('for(let i=0;i<14;i++){frameCount++;player.x+=10;player.stance.elapsedMs=i*50;stealthUpdateNoise(50)}');
ok("_redMesaNoise.events.length===1&&_redMesaNoise.events[0].kind==='ROLL'",'entire700ms prone dive emits one landing/movement clue');
// Actual weapon fire and surface collision paths own their event cadence.
scene();P('player.currentWeapon=WEAPONS.PISTOL;player.isMoving=false;player.fire(0)');
ok("_redMesaNoise.events.filter(e=>e.kind==='SHOT').length===1",'accepted firearm trigger emits one event independently of pellet count');
scene();P('player.currentWeapon=WEAPONS.BOW;stealthShotNoise(player)');ok('_redMesaNoise.events.length===0','bow launch retains its existing quiet behavior');
scene();P(`player.x=-500;player.y=1000;buildings=activeBuildings=[{x:100,y:0,w:20,h:200,hp:Infinity,isWall:true}];invalidateColIndex();
 var impactRound=spawnBullet(75,0,0,true,'BODY',WEAPONS.PISTOL,player);updateBullets()`);
ok("!impactRound.active&&_redMesaNoise.events.length===1&&_redMesaNoise.events[0].kind==='IMPACT'&&_redMesaNoise.events[0].x>89&&_redMesaNoise.events[0].x<101",
 'a real stopped projectile emits its surface contact origin');
P('stealthSurfaceImpactNoise(impactRound);updateBullets()');ok('_redMesaNoise.events.length===1','surface contact never emits repeatedly for a retired projectile');
P("impactRound.init(0,0,0,true,'BODY',WEAPONS.BOW,player);stealthSurfaceImpactNoise(impactRound,20,30,{isForestTimber:true})");
ok("_redMesaNoise.events.length===2&&_redMesaNoise.events[1].x===20&&_redMesaNoise.events[1].volume===.65",'pooled arrow reuse resets one-shot impact sound and keeps softer strength');
P("impactRound.init(0,0,0,false,'BODY','RED_LASER',soundGuard)");
ok('impactRound._stealthNoiseLayer===null','enemy and special projectiles allocate no player sound layer');
const count=P('_redMesaNoise.events.length');P('stealthSurfaceImpactNoise(impactRound)');ok(P('_redMesaNoise.events.length')===count,'hostile impacts cannot impersonate a player acoustic clue');
// Quiet-edge/range rejects precede geometry, and an accepted event costs at
// most one cast per listener rather than one cast per AI/frame forever.
scene();const oldLOS=ctx.hasLOS;let casts=0;ctx.hasLOS=(...args)=>{casts++;return oldLOS(...args);};
try{
 P(`var acousticListeners=Array.from({length:64},(_,i)=>{const e=new Character(i<32?2000:599,0,false,'NORMAL');return e});
  stealthEmitNoise(0,0,600,'RUN');for(const e of acousticListeners)stealthHearNoise(e,stealthPerceptionState(e),50)`);
 ok(casts===0,'many out-of-range/quiet-edge listeners reject sounds without wall geometry');
 P("stealthEmitNoise(0,0,600,'RUN');for(const e of acousticListeners){e.x=0;stealthHearNoise(e,stealthPerceptionState(e),50)}");
 ok(casts===64,'audible report performs at most one LOS cast for each listener');
 P('for(let i=0;i<30;i++)for(const e of acousticListeners)stealthHearNoise(e,stealthPerceptionState(e),50)');
 ok(casts===64,'consumed reports require no extra geometry across repeated AI frames');
}finally{ctx.hasLOS=oldLOS;}
console.log(checks+' acoustic falloff, suspicion, origin/layer, TTL, pause, roll, surface-contact and pooling checks passed');

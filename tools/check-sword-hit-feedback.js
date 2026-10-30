// Exercise real surviving sword strikes, their wall-clock stop and the existing
// target bar, alongside the pooled spray and permanent directional floor paint.
const assert = require('node:assert/strict');
const {ctx, probe} = require('./harness');
const P = source => probe('(' + source + ')');
let checks = 0, seed = 71029, now = 1000;
const ok = (label, value) => { assert.ok(value, label); checks++; };
ctx.setTimeout = () => 0;
ctx.millis = () => now;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  return a === undefined ? r : Array.isArray(a) ? a[Math.floor(r*a.length)] : b === undefined ? a*r : a+(b-a)*r;
};
const floor = [], nativeStamp = ctx.stampGroundBloodVectors;
ctx.stampGroundBloodVectors = mark => {
  floor.push(JSON.parse(JSON.stringify(mark)));
  return nativeStamp(mark);
};
function fresh(type='NORMAL', hp=900, tool='SWORD', backhand=false) {
  now += 1000; floor.length = 0;
  probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
    inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
    window.inNM0SecretOverlay=false;buildGhost=null;MAX_KILLS=totalKills;
    buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
    bullets=[];particles=[];corpses=[];enemiesList=[];invalidateColIndex();resetForestWildlife();
    wipeAllBloodBanks();useBloodBank('sword-hit-test');frameCount++;deltaTime=1000/60;
    viewLeft=viewTop=-10000;viewRight=viewBottom=10000;zoom=1;camX=camY=0;
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:313,y:690}};
    player=new Character(200,200,true);player.hp=player.maxHp=100;player.shield=0;
    player.aimAngle=player.moveAngle=0;player.isArmed=false;player.meleeCharge=0;
    player.meleeTimer=11;player.meleePhase=1;player.isBackhand=${backhand};
    player.dashTimer=0;player.fireTimer=0;player.reloadTimer=0;
    swordPickedUp=window.pickaxeOwned=window.shovelOwned=true;setMeleeTool('${tool}');
    chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
    window.swordVictim=new Character(245,200,false,'${type}');
    swordVictim.hp=swordVictim.maxHp=${hp};swordVictim.isFriendly=swordVictim.isNeutral=false;
    swordVictim.aimAngle=0;swordVictim.isMoving=false;enemiesList=[swordVictim];`);
}
function strike() { probe('frameCount++;player.updatePlayer();'); }
const noSwordFeedback = () => P(`!swordHitStopped()&&!swordVictim.swordHitFeedback&&swordHitTargets.size===0&&
  !particles.some(p=>p.t==='HIT_BLOOD'||p.t==='COMIC_IMPACT')`);

fresh();strike();
ok('a real surviving sword hit applies its existing 200 damage exactly once', P('swordVictim.hp===700&&!swordVictim.dead&&corpses.length===0'));
ok('contact stops the active frame and arms a 100 ms wall-clock freeze', P('!doTick&&swordHitStopped()&&swordHitStopUntil===millis()+100'));
ok('the survivor has a bright flash and a bar showing pre-hit health', P('swordVictim.swordHitFeedback.flashMs>0&&swordVictim.swordHitFeedback.ghostHp===900&&swordHitTargets.has(swordVictim)'));
ok('the flesh spray replaces the old oval blood particles on surviving hits', P("particles.filter(p=>p.t==='HIT_BLOOD').length===12&&particles.filter(p=>p.t==='COMIC_IMPACT').length===1&&!particles.some(p=>p.t==='BLOOD'||p.t==='GORE')"));
ok('every surviving hit immediately stamps one minor directional cut on the floor', floor.length===1 && floor[0].spread<50 && floor[0].paths.length>0 && P('bloodPools.length===0'));

const held = P('JSON.stringify(swordVictim.swordHitFeedback)'), heldParticles = P('JSON.stringify(particles)');
probe('updateSwordHitFeedback();updateParticles();');
ok('hit stop preserves the fresh flash, bar and airborne blood state', P('JSON.stringify(swordVictim.swordHitFeedback)')===held && P('JSON.stringify(particles)')===heldParticles);
now += 99;ok('the strike remains frozen just before 100 ms', P('swordHitStopped()'));
now += 1;ok('the freeze ends at 100 ms without needing simulation ticks', !P('swordHitStopped()'));
probe('doTick=true;frameCount++;player.updatePlayer();');
ok('resuming the same swing does not deal duplicate damage or stamp twice', P('swordVictim.hp===700') && floor.length===1);
probe('player.meleeTimer=11;player.meleePhase=2;player.isBackhand=true;frameCount++;player.updatePlayer();');
ok('the next surviving combo hit refreshes feedback and applies one more hit', P('swordVictim.hp===500&&swordHitStopped()&&swordVictim.swordHitFeedback.lifeMs>0') && floor.length===2);
ok('the backhand reverses the floor slash with the blade travel', Math.cos(floor[0].angle-floor[1].angle)<-.99);

fresh();probe(`player.meleeTimer=0;window.swordWave=new Shockwave(200,200,0,true,player);
  particles=[];frameCount++;swordWave.update();`);
ok('a surviving sword finisher uses the same hit stop, bar and directional blood',
  P('swordVictim.hp===770&&swordHitStopped()&&!!swordVictim.swordHitFeedback&&corpses.length===0') && floor.length===1 && Math.abs(floor[0].angle)<1e-8);
now+=100;probe('doTick=true;frameCount++;swordWave.update();');
ok('the same finisher cannot damage or deposit blood on its target twice', P('swordVictim.hp===770') && floor.length===1);

for (const stance of ['STAND','CROUCH','PRONE']) {
  fresh();probe(`resetActorStance(swordVictim,'${stance}');`);strike();
  const before=P('JSON.stringify(swordVictim.swordHitFeedback)');
  let bars=0;const rect=ctx.rect;ctx.rect=(...args)=>{bars++;return rect(...args);};
  try { probe('drawCombatStanceUI(swordVictim,actorStancePose(swordVictim));'); } finally { ctx.rect=rect; }
  ok(stance+' target reveals its existing health readout after sword contact', bars>=2);
  probe('doTick=false;drawSwordTargetFlash(swordVictim);updateSwordHitFeedback();');
  ok(stance+' hit flash painting cannot consume its held feedback clock', P('JSON.stringify(swordVictim.swordHitFeedback)')===before);
}

fresh('NORMAL',100);strike();
ok('a lethal sword strike retains its existing death dispatch without survivor feedback', P('swordVictim.hp<=0&&corpses.length===1&&!!corpses[0].sword') && noSwordFeedback());
ok('the new nonfatal stencil is not added to the death stain', floor.every(mark=>mark.spread>=50));
fresh();probe('swordVictim.x=700;');strike();ok('a whiff never requests hit stop or target feedback', noSwordFeedback() && floor.length===0);
for(const tool of ['NONE','PICKAXE','SHOVEL']) {
  fresh('NORMAL',900,tool);strike();
  ok(tool+' melee retains its own feedback path', noSwordFeedback() && floor.length===0);
}
fresh();
probe(`swordVictim.isPlayer=true;resetActorStance(swordVictim);
  swordVictim.stance.to=2;swordVictim.stance.durationMs=420;swordVictim.stance.elapsedMs=0;
  swordVictim.stance.dive={};`);
ok('the immune target fixture has committed dive protection', P('proneDiveActive(swordVictim)'));
strike();ok('a sword that deals no HP damage creates no survivor flash, bar, spray or freeze', P('swordVictim.hp===900') && noSwordFeedback() && floor.length===0);

fresh();strike();now+=100;probe('doTick=true;deltaTime=100;');
probe('for(let i=0;i<3;i++){frameCount++;updateSwordHitFeedback();}');
ok('the bar briefly holds the lost-health chunk', P('swordVictim.swordHitFeedback.ghostHp>700'));
probe('for(let i=0;i<30;i++){frameCount++;updateSwordHitFeedback();}');
ok('the temporary health reveal expires and releases its target reference', P('!swordVictim.swordHitFeedback&&swordHitTargets.size===0'));
fresh();strike();probe('swordVictim.dead=true;swordVictim.hp=0;frameCount++;updateSwordHitFeedback();');
ok('death removes surviving-hit transient state immediately', P('!swordVictim.swordHitFeedback&&swordHitTargets.size===0'));
fresh();strike();probe('resetRunState();');
ok('a real reset clears hit stop and all target feedback references', P('!swordHitStopped()&&swordHitStopUntil===0&&swordHitTargets.size===0&&!swordVictim.swordHitFeedback'));

// The effects use cosmetic seeds and bounded existing buffers; drawing a frozen
// contact must stay deterministic and contain no oval blood-cloud geometry.
fresh();probe('player.meleeTimer=0;');
const gameplayRandom=ctx.random;ctx.random=()=>{throw Error('Sword impact consumed gameplay randomness');};
try {
  probe('frameCount++;emitSwordHitBlood(245,200,0,-1,swordVictim,color(90,0,0),false);');
  let ovals=0;const ellipse=ctx.ellipse;ctx.ellipse=(...a)=>{ovals++;return ellipse(...a);};
  try { probe('for(const p of particles)p.paint();'); } finally { ctx.ellipse=ellipse; }
  ok('new sword spray and flash are inked polygons rather than ovals', ovals===0);
  ok('the floor cut remains separate from growing death pools', floor.length===1 && P('bloodPools.length===0'));
  const stamp=JSON.stringify(floor[0]);probe('swordVictim.x+=500;swordVictim.aimAngle=2;doTick=false;updateParticles();');
  ok('moving or turning the survivor leaves the deposited floor slash fixed', floor.length===1&&JSON.stringify(floor[0])===stamp);
  probe('particles=[];frameCount++;for(let i=0;i<100;i++)emitSwordHitBlood(245,200,0,-1,swordVictim,color(90,0,0),false);');
  ok('a crowded frame bounds sword contacts and floor deposits without backlog', P("particles.filter(p=>p.t==='COMIC_IMPACT').length===24&&particles.length===24*13") && floor.length===25);
  probe('particles=Array(899).fill(null);frameCount++;emitSwordHitBlood(245,200,0,-1,swordVictim,color(90,0,0),false);');
  ok('sword particles respect the shared 900-record ceiling', P('particles.length===900'));
} finally { ctx.random=gameplayRandom; }

for(const [type,material] of [['BUG','SWORD_YELLOW'],['ROBOT','SWORD_OIL']]) {
  fresh(type);strike();
  ok(type+' retains its native fluid material instead of human red blood', P(`particles.filter(p=>p.t==='HIT_BLOOD').every(p=>p.fxMaterial==='${material}')`) && floor.length===1);
}
for(const type of ['NORMAL','ARMORED_STANDARD','BUG','ROBOT','COW']) {
  fresh(type);strike();
  const flash=ctx.drawSwordTargetFlash,ui=ctx.drawCombatStanceUI;
  let flashes=0,bars=0;
  ctx.drawSwordTargetFlash=(...a)=>{flashes++;return flash(...a);};
  ctx.drawCombatStanceUI=(...a)=>{bars++;return ui(...a);};
  try { probe('swordVictim.show();'); } finally { ctx.drawSwordTargetFlash=flash;ctx.drawCombatStanceUI=ui; }
  ok(type+' native actor painter includes exactly one surviving-hit highlight and bar', flashes===1&&bars===1);
}
ctx.stampGroundBloodVectors=nativeStamp;
console.log(`${checks}/${checks} surviving sword hit, hit-stop, target bar, spray and floor decal checks passed.`);

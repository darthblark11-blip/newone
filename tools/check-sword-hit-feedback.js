// Exercise real surviving sword strikes and uninterrupted simulation, with the
// target bar, pooled spray and permanent directional floor paint.
const assert = require('node:assert/strict');
const {ctx, probe} = require('./harness');
const P = source => probe('(' + source + ')');
let checks = 0, seed = 71029;
const ok = (label, value) => { assert.ok(value, label); checks++; };
ctx.setTimeout = () => 0;
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
  floor.length = 0;
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
const noSwordFeedback = () => P(`doTick&&!swordVictim.swordHitFeedback&&swordHitTargets.size===0&&
  !particles.some(p=>p.t==='HIT_BLOOD'||p.t==='COMIC_IMPACT')`);

fresh();strike();
ok('a real surviving sword hit applies its existing 200 damage exactly once', P('swordVictim.hp===700&&!swordVictim.dead&&corpses.length===0'));
ok('a surviving sword hit adds no camera shake', P('screenShake===0'));
ok('a surviving contact leaves simulation running immediately', P('doTick'));
ok('the survivor has a bright flash and a bar showing pre-hit health', P('swordVictim.swordHitFeedback.flashMs>0&&swordVictim.swordHitFeedback.ghostHp===900&&swordHitTargets.has(swordVictim)'));
ok('the flesh spray triples to 36 inked particles on each surviving hit', P("particles.filter(p=>p.t==='HIT_BLOOD').length===36&&particles.filter(p=>p.t==='COMIC_IMPACT').length===1&&!particles.some(p=>p.t==='BLOOD'||p.t==='GORE')"));
ok('every surviving hit immediately stamps one minor directional cut on the floor', floor.length===1 && floor[0].spread<50 && floor[0].paths.length>0 && P('bloodPools.length===0'));

const initialLife=P('swordVictim.swordHitFeedback.lifeMs');
probe('frameCount++;updateSwordHitFeedback();updateParticles();');
ok('the flash, bar and airborne blood advance on the very next active update',
  P('swordVictim.swordHitFeedback.lifeMs')<initialLife&&P('particles.every(p=>p.fxAge===1)'));
const held = P('JSON.stringify(swordVictim.swordHitFeedback)'), heldParticles = P('JSON.stringify(particles)');
probe('doTick=false;frameCount++;updateSwordHitFeedback();updateParticles();');
ok('an ordinary pause preserves the flash, bar and airborne blood state', P('JSON.stringify(swordVictim.swordHitFeedback)')===held && P('JSON.stringify(particles)')===heldParticles);
probe('doTick=true;frameCount++;player.updatePlayer();');
ok('the next update continues the swing without duplicate damage or floor marks', P('player.meleeTimer===9&&swordVictim.hp===700') && floor.length===1);
probe('player.meleeTimer=11;player.meleePhase=2;player.isBackhand=true;frameCount++;player.updatePlayer();');
ok('the next surviving combo hit refreshes feedback and keeps simulation running', P('doTick&&swordVictim.hp===500&&swordVictim.swordHitFeedback.lifeMs>0') && floor.length===2);
ok('a backhand adds no camera shake', P('screenShake===0'));
ok('the backhand reverses the floor slash with the blade travel', Math.cos(floor[0].angle-floor[1].angle)<-.99);

for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const backhand of [false,true]) {
  fresh('NORMAL',900,'SWORD',backhand);
  probe(`player.aimAngle=${heading};swordVictim.x=200+45*Math.cos(${heading});
    swordVictim.y=200+45*Math.sin(${heading});`);
  strike();
  const mark=floor[0],victim=P('({x:swordVictim.x,y:swordVictim.y})');
  const away=[Math.cos(heading),Math.sin(heading)],travel=[Math.cos(mark.angle),Math.sin(mark.angle)];
  const along=p=>p[0]*travel[0]+p[1]*travel[1],out=p=>p[0]*away[0]+p[1]*away[1];
  const vertices=mark.paths.flatMap(path=>path.points),offset=[mark.x-victim.x,mark.y-victim.y];
  ok('the curved floor spray clears the victim on its backward and blade-exit sides',
    out(offset)>15&&along(offset)>10&&vertices.every(p=>out([p[0]+offset[0],p[1]+offset[1]])>4&&along([p[0]+offset[0],p[1]+offset[1]])>10));
  const clots=mark.paths.map(path=>{
    const center=path.points.reduce((a,p)=>[a[0]+p[0]/path.points.length,a[1]+p[1]/path.points.length],[0,0]);
    // Measure each polygon's principal axis independently of the generator.
    const cov=path.points.reduce((a,p)=>{const x=along(p)-along(center),y=out(p)-out(center);return [a[0]+x*x,a[1]+y*y,a[2]+x*y];},[0,0,0]);
    return {x:along(center),y:out(center),angle:.5*Math.atan2(2*cov[2],cov[0]-cov[1])};
  }).sort((a,b)=>a.x-b.x);
  const average=(list,key)=>list.reduce((s,c)=>s+c[key]/list.length,0),near=clots.slice(0,3),far=clots.slice(-4);
  ok('the separated blood drops visibly arc away from the attacker through the slash',
    average(far,'y')>average(near,'y')+6&&average(far,'angle')>average(near,'angle')+.15);
  const area=mark.paths.reduce((sum,path)=>sum+Math.abs(path.points.reduce((a,p,i)=>{
    const q=path.points[(i+1)%path.points.length];return a+p[0]*q[1]-q[0]*p[1];
  },0))/2,0);
  const width=Math.max(...vertices.map(along))-Math.min(...vertices.map(along));
  const height=Math.max(...vertices.map(out))-Math.min(...vertices.map(out));
  ok('separated thin streaks and droplets leave substantial open floor between marks',
    mark.paths.length===13&&area/(width*height)<.3&&mark.spread<50);
}

fresh();probe('screenShake=4;');strike();
ok('a sword hit preserves camera shake from an unrelated source', P('screenShake===4'));

for(const hp of [900,100]) {
  fresh('NORMAL',hp);probe('player.meleeTimer=16;player.meleePhase=4;frameCount++;player.updatePlayer();');
  ok('launching a sword finisher retains its authored camera shake', P('shockwaves.length===1&&screenShake===20'));
  probe('frameCount++;shockwaves[0].update();');
  ok((hp===900?'surviving':'lethal')+' finisher contact retains its launch shake', P('screenShake===20'));
}
fresh();probe('enemiesList=[];player.meleeTimer=16;player.meleePhase=4;frameCount++;player.updatePlayer();');
ok('a sword finisher retains its launch shake even in empty space', P('shockwaves.length===1&&screenShake===20'));

fresh();probe(`player.meleeTimer=0;window.swordWave=new Shockwave(200,200,0,true,player);
  particles=[];frameCount++;swordWave.update();`);
ok('a surviving sword finisher keeps simulation active with its bar and directional blood',
  P('doTick&&swordVictim.hp===400&&!!swordVictim.swordHitFeedback&&corpses.length===0') && floor.length===1 && Math.abs(floor[0].angle)<1e-8);
probe('frameCount++;swordWave.update();');
ok('the same finisher cannot damage or deposit blood on its target twice', P('swordVictim.hp===400') && floor.length===1);

for(const suit of ['NONE','NINJA','CHEMIST','EXPLOSIVE'])for(const hp of [501,500,499]) {
  fresh('NORMAL',hp);
  probe(`ninjaSuitUnlocked=${suit==='NINJA'};chemistSuitUnlocked=${suit==='CHEMIST'};
    explosiveArmorUnlocked=${suit==='EXPLOSIVE'};player.meleeTimer=0;
    window.swordBoundaryWave=new Shockwave(200,200,0,true,player);frameCount++;swordBoundaryWave.update();`);
  ok(suit+' sword finisher deals exactly 500 HP at the survival boundary '+hp,
    P('swordVictim.hp')===hp-500&&P('doTick'));
  ok(suit+' finisher keeps the native surviving or explosive-death path at '+hp,
    hp>500?P('!swordVictim.dead&&corpses.length===0&&!!swordVictim.swordHitFeedback'):
      P('swordVictim.dead&&corpses.length===1&&!!corpses[0].blast&&!corpses[0].sword&&!swordVictim.swordHitFeedback'));
}
for(const suit of ['NONE','NINJA','CHEMIST','EXPLOSIVE']) {
  fresh();probe(`ninjaSuitUnlocked=${suit==='NINJA'};chemistSuitUnlocked=${suit==='CHEMIST'};
    explosiveArmorUnlocked=${suit==='EXPLOSIVE'};`);strike();
  ok(suit+' normal sword swing retains its existing 200 HP damage', P('swordVictim.hp===700'));
}
for(const ninja of [false,true]) {
  fresh('NORMAL',900,'PICKAXE');probe(`ninjaSuitUnlocked=${ninja};player.meleeTimer=0;
    window.nonSwordWave=new Shockwave(200,200,0,false,player);frameCount++;nonSwordWave.update();`);
  ok('a non-sword finisher retains its authored '+(ninja?'156':'130')+' HP damage', P('swordVictim.hp')===900-(ninja?156:130));
}

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
ok('a lethal sword strike adds no camera shake', P('screenShake===0'));
ok('the new nonfatal stencil is not added to the death stain', floor.every(mark=>mark.spread>=50));
fresh();probe('swordVictim.x=700;');strike();ok('a whiff leaves simulation active without target feedback', noSwordFeedback() && floor.length===0);
ok('an ordinary sword whiff adds no camera shake', P('screenShake===0'));
for(const tool of ['NONE','PICKAXE','SHOVEL']) {
  fresh('NORMAL',900,tool);strike();
  ok(tool+' melee retains its own feedback path', noSwordFeedback() && floor.length===0);
  ok(tool+' retains its original camera shake strength', P('screenShake')===(tool==='SHOVEL'?6:12));
}
fresh('NORMAL',900,'PICKAXE');probe('player.meleeTimer=16;player.meleePhase=4;frameCount++;player.updatePlayer();');
ok('another melee tool retains its finisher camera shake', P('screenShake===20'));
fresh();
probe(`swordVictim.isPlayer=true;resetActorStance(swordVictim);
  swordVictim.stance.to=2;swordVictim.stance.durationMs=420;swordVictim.stance.elapsedMs=0;
  swordVictim.stance.dive={};`);
ok('the immune target fixture has committed dive protection', P('proneDiveActive(swordVictim)'));
strike();ok('an evaded sword keeps simulation active without survivor flash, bar or spray', P('swordVictim.hp===900') && noSwordFeedback() && floor.length===0);

fresh();strike();probe('deltaTime=100;');
probe('for(let i=0;i<3;i++){frameCount++;updateSwordHitFeedback();}');
ok('the bar briefly holds the lost-health chunk', P('swordVictim.swordHitFeedback.ghostHp>700'));
probe('for(let i=0;i<30;i++){frameCount++;updateSwordHitFeedback();}');
ok('the temporary health reveal expires and releases its target reference', P('!swordVictim.swordHitFeedback&&swordHitTargets.size===0'));
fresh();strike();probe('swordVictim.dead=true;swordVictim.hp=0;frameCount++;updateSwordHitFeedback();');
ok('death removes surviving-hit transient state immediately', P('!swordVictim.swordHitFeedback&&swordHitTargets.size===0'));
fresh();strike();probe('resetRunState();');
ok('a real reset releases all target feedback references', P('swordHitTargets.size===0&&!swordVictim.swordHitFeedback'));

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
  ok('a crowded frame fits 24 denser sword contacts below the particle ceiling', P("particles.filter(p=>p.t==='COMIC_IMPACT').length===24&&particles.filter(p=>p.t==='HIT_BLOOD').length===24*36&&particles.length===888") && floor.length===25);
  probe('particles=Array(899).fill(null);frameCount++;emitSwordHitBlood(245,200,0,-1,swordVictim,color(90,0,0),false);');
  ok('sword particles respect the shared 900-record ceiling', P('particles.length===900'));
} finally { ctx.random=gameplayRandom; }

fresh();
probe(`window.swordCompareSerial=_comicHitSerial;
  emitComicHit(245,200,0,-1,swordVictim,false,true,color(90,0,0));
  window.swordCompareBaseline=particles.filter(p=>p.t==='HIT_BLOOD');
  window.swordCompareMotion=swordCompareBaseline.map(p=>({vx:p.vx,vy:p.vy,size:p.sz,life:p.fxLife,kind:p.fxKind,seed:p.fxSeed}));
  particles=[];_comicHitSerial=swordCompareSerial;
  emitSwordHitBlood(245,200,0,-1,swordVictim,color(90,0,0));
  window.swordCompareSpray=particles.filter(p=>p.t==='HIT_BLOOD');`);
ok('projectile contact still emits its original twelve blood particles', P('swordCompareBaseline.length===12'));
ok('the denser sword spray preserves matched particle shape and lifetime',
  P('swordCompareBaseline.every((p,i)=>swordCompareSpray[i].fxSeed===p.fxSeed&&swordCompareSpray[i].sz===p.sz&&swordCompareSpray[i].fxLife===p.fxLife&&swordCompareSpray[i].fxKind===p.fxKind)'));
const reachRatios=P(`swordCompareBaseline.map((p,i)=>{
  const q=swordCompareSpray[i],px=p.x,py=p.y,qx=q.x,qy=q.y;
  let steps=0;while((p.a>0||q.a>0)&&steps++<100){p.update();q.update();}
  return Math.hypot(q.x-qx,q.y-qy)/Math.hypot(p.x-px,p.y-py);
})`);
ok('matched sword droplets travel 35 percent farther through their complete lifetime',
  reachRatios.every(r=>Math.abs(r-1.35)<1e-8));
probe(`particles=[];_comicHitSerial=swordCompareSerial;
  emitComicHit(245,200,0,-1,swordVictim,false,true,color(90,0,0));`);
ok('sword travel changes never alter the next projectile spray',
  P(`JSON.stringify(particles.filter(p=>p.t==='HIT_BLOOD').map(p=>({vx:p.vx,vy:p.vy,size:p.sz,life:p.fxLife,kind:p.fxKind,seed:p.fxSeed})))===JSON.stringify(swordCompareMotion)`));

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
console.log(`${checks}/${checks} surviving sword hit, uninterrupted simulation, target bar, spray and floor decal checks passed.`);

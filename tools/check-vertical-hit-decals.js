// Real firearm contacts preserve their transverse shot path while individual
// wound heights vary within the resolved head, body or leg surface. The marks
// retain the existing ellipse art and remain attached through motion and falls.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const {figureCanvas}=require('./figure-canvas');
const P=s=>probe('('+s+')');
// Test the placement distribution independently of the injury state machine.
ctx.tryLegShotInjury=()=>false;
let checks=0,seed=8197,randomCalls=0;
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{
  randomCalls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const u=seed/4294967296;
  return a===undefined?u:Array.isArray(a)?a[Math.floor(u*a.length)]:b===undefined?u*a:a+(b-a)*u;
};
const ok=(label,value)=>{assert.ok(value,label);checks++;};
const close=(a,b,label)=>{assert.ok(Math.abs(a-b)<1e-7,`${label}: ${a} vs ${b}`);checks++;};
function stage(type='NORMAL',facing=0,hp=100000,stance='STAND'){
  seed=8197;randomCalls=0;
  probe(`currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
   isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
   inOverworldView=inTravelMenu=inWorldBuildingMenu=inUpgradeMenu=false;
   window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
   buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
   enemiesList=[];bullets=[];particles=[];corpses=[];invalidateColIndex();resetForestWildlife();resetShovelState();
   viewLeft=viewTop=-10000;viewRight=viewBottom=10000;MAX_KILLS=100000;totalKills=0;
   headshotCounter=bodyOverkillCounter=0;
   player=new Character(-2000,-2000,true);player.hp=player.maxHp=100000;player.shield=0;
   leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
   window.victim=new Character(0,0,false,${JSON.stringify(type)});victim.hp=victim.maxHp=${hp};victim.shield=0;
   victim.isFriendly=victim.isNeutral=false;victim.aimAngle=victim.moveAngle=${facing};
   victim.isMoving=false;victim.walkCycle=victim.gait=0;rememberFigureMotion(victim,0,0);
   setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
   resetActorStance(victim,${JSON.stringify(stance)});enemiesList=[victim];`);
}
function shot(zone='BODY',lateral=0,facing=0,id=1,weapon='PISTOL'){
  if(zone==='LEGS'&&lateral===0&&P("actorStance(victim)==='STAND'"))lateral=6;
  probe(`frameCount++;window.round=spawnBullet(-90*Math.cos(${facing})-(${lateral})*Math.sin(${facing}),
    -90*Math.sin(${facing})+(${lateral})*Math.cos(${facing}),${facing},true,${JSON.stringify(zone)},WEAPONS.${weapon},player);
    round.shotId=${id};for(let i=0;i<12&&round.active;i++)updateBullets();`);
  return P(`({decal:victim.decals[victim.decals.length-1],hp:victim.hp,x:victim.x,y:victim.y,
    hit:!!victim.fallHit,kind:victim.fallHit&&victim.fallHit.kind,dead:victim.dead,
    bullet:{x:round.x,y:round.y,l:round.l,active:round.active}})`);
}
const spread=values=>Math.max(...values)-Math.min(...values);
const distinct=values=>new Set(values.map(x=>x.toFixed(5))).size;

// Identical ballistic paths must no longer leave one repeated height. The
// actor is rebuilt before every shot to remove knockback and old wounds.
for(const facing of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const zone of ['BODY','HEAD']){
  const heights=[],sides=[];
  for(let i=0;i<64;i++){
    stage('NORMAL',facing);const hit=shot(zone,0,facing,1000+i);
    ok(`${zone}/${facing}/${i} actual firearm hits its selected surface`,!!hit.decal&&hit.hit&&hit.hp===100000-(zone==='HEAD'?100:20));
    heights.push(hit.decal.x);sides.push(hit.decal.y);
    close(hit.decal.y,0,`${zone}/${facing}/${i} centerline remains centered`);
  }
  ok(`${zone}/${facing} repeated center shots vary vertically`,distinct(heights)>48&&spread(heights)>(zone==='HEAD'?3:8));
  ok(`${zone}/${facing} variation does not introduce lateral scatter`,spread(sides)<1e-7);
}
// Aim across the body at several transverse offsets. Preserve the exact old
// projected lateral coordinate, including its ellipse-edge clamp; only the
// anatomical-height coordinate is replaced.
for(const facing of [0,.63,Math.PI/2,Math.PI,-Math.PI/2])for(const lateral of [-3,-1.5,0,1.5,3])for(const zone of ['BODY','HEAD']){
  stage('NORMAL',facing);const hit=shot(zone,lateral,facing,4401);
  ok(`${zone}/${facing}/${lateral} lateral ray hits`,!!hit.decal);
  const rw=(zone==='HEAD'?5.5:10.5)*.85,rh=(zone==='HEAD'?5.5:13.5)*.85;
  const localX=hit.bullet.x*Math.cos(facing)+hit.bullet.y*Math.sin(facing),
    localY=-hit.bullet.x*Math.sin(facing)+hit.bullet.y*Math.cos(facing),
    edge=Math.max(1,Math.sqrt((localX/rw)**2+(localY/rh)**2));
  close(hit.decal.y,localY/edge,`${zone}/${facing}/${lateral} existing transverse coordinate is preserved`);
  ok(`${zone}/${facing}/${lateral} sampled height remains inside its body-part ellipse`,
    (hit.decal.x/rw)**2+(hit.decal.y/rh)**2<=1+1e-7);
}

for(const facing of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const lateral of [-5,5]){
  const marks=[];
  for(let i=0;i<64;i++){
    stage('NORMAL',facing);marks.push(shot('LEGS',lateral,facing,7000+i).decal);
  }
  ok(`leg/${facing}/${lateral} all hits remain actual leg decals`,marks.every(d=>d&&d.isLeg&&!d.isHead));
  ok(`leg/${facing}/${lateral} height randomization preserves the path-selected leg`,new Set(marks.map(d=>d.legIndex)).size===1);
  ok(`leg/${facing}/${lateral} height randomization preserves transverse placement`,spread(marks.map(d=>d.legV))<1e-7);
  const height=marks.map(d=>(d.legSegment===0?0:1)+d.legU);
  ok(`leg/${facing}/${lateral} repeated shots cover the thigh and shin`,new Set(marks.map(d=>d.legSegment)).size===2&&distinct(height)>48&&spread(height)>1.3);
  ok(`leg/${facing}/${lateral} normalized leg coordinates remain in their surfaces`,marks.every(d=>[0,1].includes(d.legSegment)&&d.legU>=0&&d.legU<=1&&Math.abs(d.legV)<=.22));
}

// Pellets and paired SMG rounds share one shot/accuracy identity. Even when
// they follow the same ballistic path their body wounds need individual heights.
for(const weapon of ['SHOTGUN','DUAL_SMG'])for(const zone of ['BODY','LEGS']){
  stage();probe('victim.attemptMove=()=>{};');const marks=[];
  for(let i=0;i<12;i++)marks.push(shot(zone,0,0,15501,weapon).decal);
  const height=marks.map(d=>zone==='LEGS'?(d.legSegment===0?0:1)+d.legU:d.x);
  ok(`${weapon}/${zone} one shot identity still distributes pellet heights`,distinct(height)>8);
  ok(`${weapon}/${zone} pellets keep their lateral path`,zone==='LEGS'?
    new Set(marks.map(d=>d.legIndex)).size===1&&spread(marks.map(d=>d.legV))<1e-7:
    spread(marks.map(d=>d.y))<1e-7);
}

// Elevation-to-stance remapping happens before placement. A crouched low shot
// belongs to the torso, and a prone low shot belongs to the head.
for(const [stance,incoming,resolved]of [['CROUCH','BODY','HEAD'],['CROUCH','LEGS','BODY'],['PRONE','LEGS','HEAD']]){
  const heights=[];
  for(let i=0;i<32;i++){
    stage('NORMAL',0,100000,stance);const hit=shot(incoming,0,0,9000+i);
    ok(`${stance}/${incoming}/${i} retains its damage remapping`,hit.kind===resolved&&hit.hp===100000-(resolved==='HEAD'?100:20));
    ok(`${stance}/${incoming}/${i} places the wound on the resolved surface`,hit.decal.isHead===(resolved==='HEAD')&&!hit.decal.isLeg);
    heights.push(hit.decal.x);
  }
  ok(`${stance}/${incoming} resolved wounds vary in height`,distinct(heights)>24&&spread(heights)>3);
}

// Placement is cosmetic and cannot pull new samples out of combat's global
// RNG. Repeating one sample yields the same coordinates, independent of paint.
stage();
const originalRandom=ctx.random;
ctx.random=()=>{throw Error('Cosmetic height mapping used gameplay RNG');};
try{
  probe(`window.heightInput={x:-3,y:2,sz:5,isBulletHole:true,isHead:false};
    window.heightA={...heightInput};window.heightB={...heightInput};
    mapHitDecalHeight(victim,heightA,'BODY',.21);mapHitDecalHeight(victim,heightB,'BODY',.21);
    window.sampleRound={x:-12,y:2,shotId:776};window.sampleA=bulletDecalHeightSample(sampleRound,victim);
    window.sampleB=bulletDecalHeightSample(sampleRound,victim);`);
  ok('body height mapping is repeatable and consumes no combat RNG',P('JSON.stringify(heightA)===JSON.stringify(heightB)&&heightA.y===heightInput.y&&heightA.x!==heightInput.x'));
  ok('private projectile samples are repeatable without advancing combat RNG',P('sampleA===sampleB&&sampleA>=0&&sampleA<1'));
  probe(`window.lowA={x:0,y:0,sz:5};window.lowB={x:0,y:0,sz:5};
    mapLegHitDecal(victim,-12,3,lowA,victim,.21);mapLegHitDecal(victim,-12,3,lowB,victim,.21);`);
  ok('leg mapping is repeatable without advancing combat RNG',P('JSON.stringify(lowA)===JSON.stringify(lowB)'));
}finally{ctx.random=originalRandom;}

// Material and non-firearm systems keep their existing geometric attachment.
for(const type of ['ROBOT','ARMORED','BUG','SNAIL_HYBRID','ALIEN_GATOR','COW','HORSE']){
  const marks=[];
  for(let i=0;i<8;i++){stage(type);marks.push(shot('BODY',0,0,18000+i).decal);}
  ok(`${type} retains its original impact row`,distinct(marks.map(d=>d.x))===1&&distinct(marks.map(d=>d.y))===1);
}
for(const weapon of ['BOW']){
  const marks=[];
  for(let i=0;i<8;i++){stage();marks.push(shot('BODY',0,0,18100+i,weapon).decal);}
  ok(`${weapon} keeps its established non-firearm wound placement`,distinct(marks.map(d=>d.x))===1&&distinct(marks.map(d=>d.y))===1);
}

// The scripted quick-draw rounds use native Corpse art too. Preserve their
// established centerline while giving body and head hits individual heights.
for(const zone of ['BODY','HEAD']){
  stage();probe('_frontierSaloonSession={duel:{corpses:[],effects:[]}};');
  const heights=[];
  for(let i=0;i<32;i++){
    probe(`frameCount++;victim.hp=100;victim.dead=false;
      frontierQuickDrawDeath(victim,{x:0,y:0,vx:35,vy:0,a:0,tH:'${zone}',shotId:${20000+i}});
      window.duelWound=_frontierSaloonSession.duel.corpses[_frontierSaloonSession.duel.corpses.length-1].dec.slice(-1)[0];`);
    const w=P('duelWound');heights.push(w.x);close(w.y,0,`${zone} quick-draw lateral centerline stays fixed`);
  }
  ok(`${zone} quick-draw wounds no longer repeat one row`,distinct(heights)>24&&spread(heights)>3);
}

// Optional comparison with a frozen pre-fix game proves that the extra height
// cannot change damage, knockback, decal size/color, particle counts or random
// draws. It is deliberately independent of the new helper implementation.
if(process.env.VERTICAL_DECAL_BASELINE){
  const harnessPath=require.resolve('./harness'),savedFile=process.env.GAME_JS;
  delete require.cache[harnessPath];process.env.GAME_JS=process.env.VERTICAL_DECAL_BASELINE;
  const baseline=require('./harness');
  if(savedFile===undefined)delete process.env.GAME_JS;else process.env.GAME_JS=savedFile;
  function contact(h,weapon,zone,type){
    let state=21873,draws=0;
    h.ctx.setTimeout=()=>0;h.ctx.random=(a,b)=>{draws++;state=(Math.imul(state,1664525)+1013904223)>>>0;const u=state/4294967296;
      return a===undefined?u:Array.isArray(a)?a[Math.floor(u*a.length)]:b===undefined?u*a:a+(b-a)*u;};
    h.probe(`currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
      isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
      inTownCutscene=inFortCutscene=inDarchonCall=false;townsData={};window.outpostForts={};
      buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
      particles=[];bullets=[];corpses=[];enemiesList=[];invalidateColIndex();resetForestWildlife();
      player=new Character(-1000,-1000,true);leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
      window.target=new Character(80,0,false,'${type}');target.hp=target.maxHp=100000;target.shield=0;
      target.isNeutral=target.isFriendly=false;target.isMoving=false;target.aimAngle=target.moveAngle=0;
      rememberFigureMotion(target,0,0);resetActorStance(target);enemiesList=[target];frameCount=400;`);
    draws=0;
    h.probe(`window.testRound=spawnBullet(0,${zone==='LEGS'?6:0},0,true,'${zone}',WEAPONS.${weapon},player);testRound.shotId=919;
      for(let i=0;i<12&&testRound.active;i++)updateBullets();`);
    const value=h.probe(`JSON.stringify({hp:target.hp,x:target.x,y:target.y,stun:target.stunTimer,
      decals:target.decals.map(d=>({sz:d.sz,col:d.col,isHead:d.isHead,isLeg:d.isLeg,legIndex:d.legIndex,legV:d.legV})),
      kinds:particles.map(p=>p.t),active:testRound.active,l:testRound.l})`);
    return{value,draws,state};
  }
  for(const weapon of ['PISTOL','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','COACH_GUN','REVOLVER'])for(const zone of ['BODY','HEAD','LEGS']){
    const current=contact({ctx,probe},weapon,zone,'NORMAL'),old=contact(baseline,weapon,zone,'NORMAL');
    assert.deepEqual(current,old,`${weapon}/${zone} height changes altered combat or RNG`);checks++;
  }
  ctx.random=originalRandom;
}

// Observe the real ellipse painter against a real Canvas. Stored heights must
// never change while the actor strides, turns, lowers or falls; fatal streams
// must still originate at the new, vertically distributed point of entry.
const {g,c,canvas}=figureCanvas(900,900),originalPaint={};
for(const name of ['push','pop','translate','rotate','scale','fill','stroke','noFill','noStroke','strokeWeight','ellipse','rect','arc','line','quad','triangle','beginShape','vertex','curveVertex','endShape','image']){
  originalPaint[name]=ctx[name];ctx[name]=(...args)=>g[name](...args);
}
ctx.drawingContext=c;ctx.__verticalPaint=g;
const nativeFill=g.fill,nativeEllipse=g.ellipse,ink=[251,0,225,255];let fill=null,marks=[];
g.fill=(...args)=>{fill=args[0]&&args[0].levels?[...args[0].levels]:args;return nativeFill(...args);};
g.ellipse=(x,y,w,h=w)=>{
  if(fill&&fill.join(',')===ink.join(',')){
    const m=c.getTransform();marks.push({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f,w,h});
  }
  return nativeEllipse(x,y,w,h);
};
function observe(code){
  marks=[];fill=null;c.resetTransform();c.clearRect(0,0,canvas.width,canvas.height);probe(code);
  assert(g.balanced(),'vertical wound drawing leaked a transform');
  assert.equal(marks.length,1,'one attached wound should be painted exactly once');
  checks++;return marks[0];
}
try{
  for(const zone of ['BODY','HEAD','LEGS']){
    stage();shot(zone,zone==='HEAD'?1:3,0,27019);probe('victim.decals[0].col=[251,0,225,255];victim.isArmed=true;');
    const stored=P('JSON.stringify(victim.decals[0])');let previous=null,moved=0;
    for(const facing of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const stride of [0,.7,2.1]){
      const p=observe(`frameCount++;victim.aimAngle=victim.moveAngle=${facing};victim.isMoving=${stride!==0};victim.walkCycle=${stride};victim.gait=.9;victim.show();`);
      if(previous&&Math.hypot(previous.x-p.x,previous.y-p.y)>1)moved++;previous=p;
      ok(`${zone} movement keeps its original randomized height frozen`,P('JSON.stringify(victim.decals[0])')===stored);
    }
    ok(`${zone} stored wound follows the actor's actual motion`,moved>4);
  }
  for(const zone of ['BODY','HEAD','LEGS'])for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    stage('NORMAL',heading,1);shot(zone,0,heading,27819);
    probe(`window.body=corpses[0];body.dec[0].col=[251,0,225,255];
      for(const d of body.fatalSpray.wounds)d.col=[251,0,225,255];`);
    const stored=P('JSON.stringify(body.dec[0])');
    for(const age of [0,4,60]){
      probe(`while(body.fall&&!body.fall.done&&body.fall.age<${age}){frameCount++;body.update();}`);
      for(const target of ['','__verticalPaint']){
        const mark=observe(`body.show(${target});`),point=P('fatalWoundPoint(body,body.dec[0])');
        ok(`${zone}/${heading}/${age}/${target} fatal spray tracks the randomized painted wound`,Math.hypot(mark.x-point.x,mark.y-point.y)<1e-4);
        ok(`${zone}/${heading}/${age}/${target} corpse drawing cannot reroll height`,P('JSON.stringify(body.dec[0])')===stored);
      }
    }
  }
}finally{for(const [name,fn]of Object.entries(originalPaint))ctx[name]=fn;g.fill=nativeFill;g.ellipse=nativeEllipse;}
console.log(`${checks}/${checks} vertical bullet decal path, region, distribution, immutable paint and fatal attachment checks passed.`);

// Actual fatal rounds must leave NM-0 standard armor in the same corpse frame
// as other humanoids, including modern body overkill, legacy headshot art and wounds.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,seed=41031;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
const near=(a,b,label)=>{assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} versus ${b}`);checks++;};
const angleNear=(a,b,label)=>near(Math.atan2(Math.sin(a-b),Math.cos(a-b)),0,label);
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;
  return a===undefined?r:Array.isArray(a)?a[Math.floor(r*a.length)]:b===undefined?r*a:a+(b-a)*r;};
probe(`currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
  isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
  inWorldBuildingMenu=inOverworldView=inTravelMenu=false;window.inNM0SecretOverlay=false;
  buildGhost=null;townsData={};window.outpostForts={};
  buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
  player=new Character(-2000,-2000,true);player.hp=player.maxHp=100000;player.shield=0;
  leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
  setMeleeTool('NONE');resetForestWildlife();invalidateColIndex();
  ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=jetpackUnlocked=false;
  frameCount=1000;deltaTime=1000/60;MAX_KILLS=1000000;totalKills=0;
  viewLeft=viewTop=-100000;viewRight=viewBottom=100000;`);

// Observe the transform used by the actual torso/outfit painter. A field-only
// check would miss a corpse that stores the right yaw but paints the other way.
let matrix=[1,0,0,1,0,0],stack=[],painted=[];
const original={};
for(const key of ['push','pop','translate','rotate','scale','drawFallenAttire'])original[key]=ctx[key];
const multiply=u=>{const m=matrix;matrix=[m[0]*u[0]+m[2]*u[1],m[1]*u[0]+m[3]*u[1],
  m[0]*u[2]+m[2]*u[3],m[1]*u[2]+m[3]*u[3],m[0]*u[4]+m[2]*u[5]+m[4],m[1]*u[4]+m[3]*u[5]+m[5]];};
ctx.push=()=>{stack.push([...matrix]);original.push();};
ctx.pop=()=>{assert.ok(stack.length,'unbalanced corpse painter');matrix=stack.pop();original.pop();};
ctx.translate=(x,y)=>{multiply([1,0,0,1,x,y]);original.translate(x,y);};
ctx.rotate=a=>{multiply([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);original.rotate(a);};
ctx.scale=(x,y=x)=>{multiply([x,0,0,y,0,0]);original.scale(x,y);};
ctx.drawFallenAttire=(...args)=>{painted.push([...matrix]);return original.drawFallenAttire(...args);};
function paintFrame(){
  matrix=[1,0,0,1,0,0];stack=[];painted=[];
  probe('directionCorpse.paint();');
  ok('native corpse painting balances its transforms',stack.length===0&&painted.length>0);
  return painted[0];
}
function kill(type,zone='BODY',weapon='SHOTGUN',counter=0,facing=0,moving=false){
  const shot=facing+Math.PI,move=facing+Math.PI/2;
  probe(`frameCount=1000;bullets=[];corpses=[];particles=[];splatters=[];totalKills=0;
    headshotCounter=bodyOverkillCounter=${counter};
    window.directionVictim=new Character(80*Math.cos(${shot}),80*Math.sin(${shot}),false,${JSON.stringify(type)});
    directionVictim.hp=1;directionVictim.shield=0;directionVictim.isFriendly=directionVictim.isNeutral=false;
    directionVictim.aimAngle=${facing};directionVictim.moveAngle=${move};directionVictim.isMoving=${moving};
    directionVictim.currentWeapon=WEAPONS.PISTOL;
    // Isolate corpse direction from armor's different impact knockback. Equal
    // impact roots also give the detached-piece solver the same cosmetic seed;
    // its subsequent travel and the current fall controller remain native.
    directionVictim.attemptMove=()=>({x:0,y:0});
    rememberFigureMotion(directionVictim,${moving?4:0}*Math.cos(${move}),${moving?4:0}*Math.sin(${move}));
    enemiesList=[directionVictim];`);
  // All compared actors receive the same shot and simulation random stream.
  // Their uniform construction may otherwise consume a different draw count.
  seed=41031;
  probe(`window.directionRound=spawnBullet(0,0,${shot},true,${JSON.stringify(zone)},WEAPONS.${weapon},player,81031);
    for(let i=0;i<10&&!corpses.length;i++){frameCount++;updateBullets();}
    window.directionCorpse=corpses[0];window.directionOrigin={x:directionCorpse.x,y:directionCorpse.y};`);
  ok(`${type} ${weapon}/${zone} native fatal round creates one corpse`,P('directionVictim.dead&&corpses.length===1'));
  return {shot,move};
}
function advance(frames){probe(`for(let i=0;i<${frames};i++){frameCount++;directionCorpse.update();}`);}
function sample(){
  const origin=P('directionOrigin'),frame=paintFrame(),wound=P('fatalWoundPoint(directionCorpse,directionCorpse.dec[directionCorpse.dec.length-1])');
  frame[4]-=origin.x;frame[5]-=origin.y;wound.x-=origin.x;wound.y-=origin.y;
  return {state:P(`({x:directionCorpse.x-directionOrigin.x,y:directionCorpse.y-directionOrigin.y,fP:directionCorpse.fP,sep:directionCorpse.sep,
    bT:directionCorpse.bT,bloodTimer:directionCorpse.bloodTimer,stop:directionCorpse.stopMotionTimer,
    poolAge:directionCorpse.poolAge,mA:directionCorpse.mA,aA:directionCorpse.aA,
    bits:directionCorpse.bits.map(b=>({type:b.type,x:b.x,y:b.y,vx:b.vx,vy:b.vy,rot:b.rot,vr:b.vr})),
    parts:(directionCorpse.blast&&directionCorpse.blast.mode?directionCorpse.blast.parts:directionCorpse.overkillBits||[]).map(b=>({...b})),
    gun:directionCorpse.blast&&directionCorpse.blast.mode?{mode:directionCorpse.blast.mode,age:directionCorpse.blast.age,
      done:directionCorpse.blast.done,heading:directionCorpse.blast.heading,gibs:directionCorpse.blast.gibs}:null,
    rag:directionCorpse.rag?{t:directionCorpse.rag.t,done:directionCorpse.rag.done,ang:directionCorpse.rag.ang,
      joints:directionCorpse.rag.limbs.map(l=>[l.a,l.b])}:null})`),
    frame,wound};
}
function equivalent(a,b,label){
  for(let i=0;i<6;i++)near(a.frame[i],b.frame[i],label+' painted frame '+i);
  for(const key of ['x','y','scale'])near(a.wound[key],b.wound[key],label+' attached wound '+key);
  angleNear(a.wound.frameAngle,b.wound.frameAngle,label+' wound frame yaw');
  angleNear(a.state.mA,b.state.mA,label+' stored movement yaw');
  angleNear(a.state.aA,b.state.aA,label+' stored aim yaw');
  for(const key of ['x','y','fP','sep','bT','bloodTimer','stop','poolAge'])
    near(a.state[key],b.state[key],label+' unchanged collapse/timer '+key);
  assert.deepEqual(a.state.rag,b.state.rag,label+' unchanged joint settling');checks++;
  assert.deepEqual(a.state.parts,b.state.parts,label+' unchanged detached part travel');checks++;
  assert.deepEqual(a.state.gun,b.state.gun,label+' shared firearm part simulation');checks++;
  assert.deepEqual(a.state.bits,b.state.bits,label+' unchanged skull fragment travel');checks++;
}

// The three shotgun body outcomes use current anatomy and motion: two bounded
// piece simulations and an intact directional fall. Headshot cycles keep the
// legacy art. Every frame still agrees across matching human identities.
for(const facing of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const zone of ['BODY','HEAD'])for(let counter=0;counter<3;counter++){
  const death=(zone==='BODY'?[2,7,10]:[4,8,9])[counter],snapshots=[];
  for(const type of ['NORMAL','NM0_ROOKIE','ARMORED_STANDARD']){
    kill(type,zone,'SHOTGUN',counter,facing,true);
    ok(type+' native shotgun selects death '+death,P(`directionCorpse.dT===${death}`));
    if(zone==='HEAD')ok(type+' shotgun headshot retains its legacy controller',P('directionCorpse.fall===null&&!directionCorpse.blast'));
    else if(death===7)ok(type+' intact shotgun body uses the current directional fall',P('!!directionCorpse.fall&&!directionCorpse.blast'));
    else ok(type+' separated shotgun body uses current firearm anatomy',P(`directionCorpse.blast?.mode==='${death===2?'SLICE':'BREAKUP'}'&&directionCorpse.fall===null`));
    const samples=[sample()];advance(4);samples.push(sample());advance(196);samples.push(sample());snapshots.push(samples);
  }
  for(let age=0;age<3;age++)for(let type=1;type<3;type++)
    equivalent(snapshots[type][age],snapshots[0][age],`shotgun dT${death}/${facing} age${age} type${type}`);
}

// The ordinary controller already follows recorded movement or the incoming
// shot. Its painted frame must remain identical across the three identities.
for(const facing of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const zone of ['HEAD','BODY'])for(const moving of [false,true]){
  const snapshots=[];
  for(const type of ['NORMAL','NM0_ROOKIE','ARMORED_STANDARD']){
    const {shot,move}=kill(type,zone,'PISTOL',0,facing,moving);
    ok(type+' ordinary '+zone+' retains the current directional fall controller',P('!!directionCorpse.fall'));
    angleNear(P('directionCorpse.fall.a'),moving?move:shot,type+' ordinary fall follows '+(moving?'motion':'the bullet'));
    const samples=[sample()];advance(4);samples.push(sample());advance(96);samples.push(sample());snapshots.push(samples);
  }
  for(let age=0;age<3;age++)for(let type=1;type<3;type++)
    equivalent(snapshots[type][age],snapshots[0][age],`ordinary ${zone}/${moving}/${facing} age${age} type${type}`);
}

// The orb hybrid and gator keep their own native frames; they must not acquire
// the humanoid half-turn or human joint solver as a consequence of this fix.
for(const type of ['ARMORED','ALIEN_GATOR'])for(const facing of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const {move}=kill(type,'BODY','SHOTGUN',0,facing,true);
  angleNear(P('directionCorpse.mA'),move,type+' retains its native movement frame');
  angleNear(P('directionCorpse.aA'),facing,type+' retains its native aim frame');
  ok(type+' remains outside the humanoid fall and joint solvers',P('!directionCorpse.fall&&!directionCorpse.rag'));
  const frame=paintFrame();
  angleNear(Math.atan2(frame[1],frame[0]),type==='ALIEN_GATOR'?move:facing,type+' native painted frame remains unchanged');
}
for(const [key,fn]of Object.entries(original))ctx[key]=fn;
console.log(`${checks}/${checks} native NM-0 corpse direction, current shotgun body/legacy head frames, wound attachment and shared fall/part timing checks passed.`);

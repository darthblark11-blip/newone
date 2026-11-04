// Focused constructor/lifecycle QA for the actual Particle Beam corpse painters.
const assert=require('node:assert/strict');
const {ctx,probe,mkG}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,seed=83127;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const u=seed/4294967296;
 return a===undefined?u:Array.isArray(a)?a[Math.floor(u*a.length)]:b===undefined?u*a:a+(b-a)*u;};
ctx.Math=Object.create(Math);ctx.Math.random=()=>ctx.random();
function stage(){probe(`resetRunState();currentLevel=currentBiome=1;BIOME_ACTIVE=false;
 isStoryMode=false;started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];
 corpses=[];particles=[];bullets=[];invalidateColIndex();
 viewLeft=viewTop=-10000;viewRight=viewBottom=10000;deltaTime=1000/60;
 wipeAllBloodBanks();useBloodBank('particle-death-qa');frameCount++;
 player=new Character(2000,2000,true);MAX_KILLS=1000000;
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};`);}
function make({zone='BODY',side=1,center=true,variant=0,angle=0,type='NORMAL',stale=false}={}){
 ctx.__particleFixture={zone,side,center,variant,angle,type,stale};
 probe(`(()=>{const f=__particleFixture;frameCount++;particles=[];corpses=[];
  const e=window.e=new Character(0,0,false,f.type);e.aimAngle=e.moveAngle=f.angle+PI;e.isMoving=false;
  rememberFigureMotion(e,0,0);const w={x:0,y:0,sz:5,isBulletHole:true,particleBeam:true,beamAge:0,col:[255,121,20,255]};
  if(f.zone==='LEGS'){w.isLeg=true;w.legIndex=f.side<0?0:1;w.legSegment=0;w.legU=.35;w.legV=0;}
  e.decals=[w];e.fallHit={frame:frameCount,kind:f.zone,weapon:WEAPONS.PARTICLE_BEAM,angle:f.angle,force:5,mx:0,my:0,wound:w,fatal:true};
  e.particleBeamHit={zone:f.zone,side:f.side,center:f.center,variant:f.variant,x:0,y:0,dirX:Math.cos(f.angle),dirY:Math.sin(f.angle),
   frame:frameCount-(f.stale?1:0),wound:w};
  let dt=particleBeamDeathType(e,e.particleBeamHit);if(dt===null||dt===undefined)dt=0;
  window.c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,dt,f.angle,e.decals,e.currentWeapon,f.angle,e.eType,e.bodyW,e.bodyH,e);
 })()`);
 return P('c');
}
function advance(n){probe(`for(let i=0;i<${n};i++){frameCount++;c.update();}`);}
function snapshot(){return P('JSON.stringify({particle:c.particleBeamDeath,blast:c.blast,fall:c.fall,rag:c.rag,dec:c.dec,fP:c.fP,bloodTimer:c.bloodTimer})');}
assert.equal(P('typeof initParticleBeamCorpse'),'function','Particle Beam corpse integration is required');
stage();
for(const side of [-1,1]){
 make({zone:'LEGS',side,center:false});
 ok('leg side '+side+' uses physical single-leg separation',P('c.dT===19&&!!c.particleBeamDeath&&!!c.blast'));
 ok('leg side '+side+' keeps anatomical side',P(`c.blast.legIndex===${side<0?0:1}`));
 const p=P('c.blast.parts.find(p=>p.type==="leg")');
 ok('leg side '+side+' starts at selected hip',Math.sign(p.pivot.y)===side);
 advance(18);ok('leg side '+side+' detached limb rises',P('c.blast.parts.find(p=>p.type==="leg").z>0'));
 advance(200);ok('leg side '+side+' settles into a bankable body',P('corpseSettled(c)'));
 make({side,center:false});
 ok('diagonal side '+side+' uses full clipped body pieces',P('c.dT===20&&!!c.particleBeamDeath&&c.blast.parts.length===2'));
 const cut=P('blastCutPlane(c,c.blast.parts[0])');
 ok('diagonal side '+side+' cut points to the selected side',Math.sign(cut.ny)===side);
 advance(220);ok('diagonal side '+side+' retires normally',P('corpseSettled(c)'));
}
// Observe the actual anatomy painter rather than inferring amputation from
// metadata. The retained body paints only the opposite hip/knee/ankle chain;
// the detached piece paints only the struck chain at contact and at rest.
ctx.__particleAnatomyG=mkG();ctx.__particleLimbCalls=[];
probe(`window.__particleNativeFallLimb=drawFallLimb;
 drawFallLimb=function(...args){__particleLimbCalls.push(args[3]);return __particleNativeFallLimb(...args);};`);
try {
 for(const side of [-1,1])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const age of [0,60]) {
  make({zone:'LEGS',side,center:false,angle});advance(age);
  if(age===0) {
   const leg=P('c.blast.parts.find(p=>p.type==="leg")'),body=P('c.blast.parts.find(p=>p.type==="body")');
   const outwardX=-Math.sin(leg.rot)*side,outwardY=Math.cos(leg.rot)*side;
   ok('leg side '+side+'/'+angle+' separates outward in the victim anatomical frame',
    (leg.vx-body.vx)*outwardX+(leg.vy-body.vy)*outwardY>1);
  }
  ctx.__particleLimbCalls.length=0;
  probe('drawBlastAnatomy(__particleAnatomyG,c,c.blast.parts.find(p=>p.type==="body"));');
  const bodyLegs=ctx.__particleLimbCalls.filter(i=>i>=2),hit=side<0?0:1;
  ok('leg side '+side+'/'+angle+'/'+age+' retained body draws exactly the unstruck leg',
    bodyLegs.length===1&&bodyLegs[0]===2+(1-hit));
  ctx.__particleLimbCalls.length=0;
  probe('drawBlastAnatomy(__particleAnatomyG,c,c.blast.parts.find(p=>p.type==="leg"));');
  ok('leg side '+side+'/'+angle+'/'+age+' detached piece draws exactly the struck leg',
    ctx.__particleLimbCalls.length===1&&ctx.__particleLimbCalls[0]===2+hit);
 }
} finally { probe('drawFallLimb=__particleNativeFallLimb;'); }
for(const [variant,kind]of [[0,'HOLE'],[1,'BACKFALL'],[2,'CHEST']])for(const type of ['NORMAL','ARMORED_STANDARD','NM0_ROOKIE_F'])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
 make({variant,type,angle});
 ok(kind+'/'+type+'/'+angle+' custom corpse owns center outcome',P(`c.particleBeamDeath&&c.particleBeamDeath.kind==='${kind}'`));
 advance(20);const active=snapshot();
 probe('corpses=[c];doTick=false;');
 probe('for(let i=0;i<5;i++){frameCount++;updateCorpses();}');
 ok(kind+'/'+type+'/'+angle+' pause freezes physics and cooling',snapshot()===active);
 probe('doTick=true;corpses=[];');advance(220);
 ok(kind+'/'+type+'/'+angle+' settles in a finite number of ticks',P('corpseSettled(c)'));
 const final=snapshot();advance(10);
 ok(kind+'/'+type+'/'+angle+' completed state stays still',snapshot()===final);
 make({variant,type,angle});const beforeParticles=P('particles.length');
 probe('finishCorpsePieces(c);');
 ok(kind+'/'+type+'/'+angle+' offscreen finish settles finite state',P('corpseSettled(c)'));
 ok(kind+'/'+type+'/'+angle+' offscreen finish emits no particles',P('particles.length')===beforeParticles);
 const finished=snapshot();probe('finishCorpsePieces(c);');
 ok(kind+'/'+type+'/'+angle+' offscreen finish is idempotent',snapshot()===finished);
}
make({variant:1});advance(18);
ok('back fall has not raised its feet before back contact',P('particleBeamLegKick(c)===0'));
advance(14);ok('back impact raises both feet into a strong recoil',P('particleBeamLegKick(c)>.95'));
advance(16);ok('feet descend back to the ground after the impact recoil',P('particleBeamLegKick(c)===0'));
make({variant:2});advance(60);
ok('the opened chest remains one connected articulated body',P('c.blast.parts.length===0&&c.particleBeamDeath.kind==="CHEST"'));
make({stale:true});ok('a previous hit cannot override a later unrelated death',!P('!!c.particleBeamDeath'));
for(const type of ['ROBOT','BUG','COW','HORSE','ALIEN_GATOR']){
 make({type});ok(type+' retains its own anatomy',!P('!!c.particleBeamDeath'));
}
console.log(checks+' Particle Beam corpse constructor, side, lifecycle, pause, and offscreen checks passed.');

// Actual blast routes plus the ballistic, paint and banking lifecycle of the
// three added human explosion deaths. Native visual review is separate.
const assert=require('node:assert/strict');
const {ctx,calls,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,seed=78131;
const ok=(name,value)=>{assert.ok(value,name);checks++;};
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const u=seed/4294967296;
 return a===undefined?u:Array.isArray(a)?a[Math.floor(u*a.length)]:b===undefined?u*a:a+(b-a)*u;};
ctx.Math=Object.create(Math);ctx.Math.random=()=>ctx.random();
function stage(){
 probe(`currentLevel=currentBiome=2;isStoryMode=false;BIOME_ACTIVE=false;
  started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=false;
  townsData={};window.outpostForts={};nm0AmbushActive=farmAmbushActive=false;
  buildings=activeBuildings=[];barrels=[];activeParkingCars=[];parkingCars=[];
  particles=[];_particlePool.length=0;corpses=[];enemiesList=[];bullets=[];
  weaponDrops=[];healthPacks=[];floatingScores=[];fires=[];invalidateColIndex();
  resetShovelState();resetForestWildlife();wipeAllBloodBanks();useBloodBank('blast-deaths');
  player=new Character(2000,2000,true);explosiveArmorUnlocked=false;
  consecutiveKills=0;comboTimer=0;totalKills=0;MAX_KILLS=100000;score=0;
  viewLeft=viewTop=-10000;viewRight=viewBottom=10000;frameCount++;
  explosionDeathCounter=0;`);
}
function victim(type='NORMAL',hp=1){
 probe(`window.e=new Character(60,0,false,${JSON.stringify(type)});e.hp=${hp};e.shield=0;
  e.isFriendly=e.isNeutral=false;rememberFigureMotion(e,0,0);enemiesList=[e];corpses=[];`);
}
stage();
const rotation=Array.from(P('EXPLOSION_HUMAN_DEATHS'));
ok('explosion rotation retains prior deaths and adds all three requested forms',
 [18,19,20,5,2,7,10,11].every(dt=>rotation.includes(dt)));
for(const method of ['grenade','rocket']){
 stage();const seen=[];
 for(let i=0;i<rotation.length;i++){
  victim();probe(method==='grenade'?'triggerExplosion(0,0,160,false,true,player);':'triggerRocketExplosion(0,0,true,e,player);');
  seen.push(P('corpses[0].dT'));
  ok(`${method} kill ${i} uses blast blood and kills once`,P('e.dead&&corpses.length===1&&corpses[0].blastBlood&&enemiesList.length===0'));
  ok(`${method} kill ${i} queues the short pool timeline`,P('bloodPools.length>0&&bloodPools.every(p=>p.blastBlood)'));
  probe('bloodPools=[];frameCount++;');
 }
 assert.deepEqual(seen,rotation,`${method} did not advance through the whole explosion rotation`);checks++;
 ok(`${method} retains player combo credit`,P(`consecutiveKills===${rotation.length}`));
}

stage();
for(const type of ['ARMORED','BUG','SNAIL','SNAIL_HYBRID','ALIEN_GATOR','COW','HORSE','ROBOT','SAUCER','SAUCER_RED','AERIAL','AERIAL_PISTOL']){
 victim(type);const next=P('explosionDeathCounter');
 probe('window.dt=explosionDeathType(e,5);');
 ok(`${type} retains its own corpse anatomy without consuming human rotation`,P('dt===5&&explosionDeathCounter===0'));
 assert.equal(P('explosionDeathCounter'),next);
}
for(const type of ['NORMAL','ARMORED_STANDARD','NM0_ROOKIE','NM0_ROOKIE_F']){
 victim(type);const dt=P('explosionDeathType(e,5)');
 ok(`${type} participates in human blast selection`,rotation.includes(dt));
}
for(const type of ['AERIAL','AERIAL_PISTOL']){
 stage();victim(type);probe('triggerRocketExplosion(0,0,true,e,player);');
 ok(`${type} actual rocket kill retains airborne wreckage selection`,P('e.dead&&corpses.length===1&&[5,10,11].includes(corpses[0].dT)&&!corpses[0].blast&&explosionDeathCounter===0'));
}
// The blue jetpack burst performs its own knockback/damage loop rather than
// calling triggerExplosion(), so exercise its actual player-update entry.
function dashVictim(type='NORMAL',hp=1,ninja=false){
 victim(type,hp);
 probe(`particles=[];bloodPools=[];player.x=player.y=0;player.dashTimer=1;player.lastMoveAngle=0;
  player.meleeTimer=0;player.aimHold=0;player.mounted=null;player.dead=false;
  leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
  meleeInputHeld=grenadeInputHeld=cannonInputHeld=false;isCooking=false;
  chemistSuitUnlocked=false;ninjaSuitUnlocked=${ninja};setMeleeTool('NONE');
  jetpackFireExplosion=true;frameCount++;player.updatePlayer();jetpackFireExplosion=false;`);
}
stage();
for(let i=0;i<rotation.length;i++){
 const type=i%2?'ARMORED_STANDARD':'NORMAL';dashVictim(type);
 ok(`${type} dash kill ${i} follows the shared explosion rotation`,P(`e.dead&&corpses.length===1&&corpses[0].dT===${rotation[i]}&&corpses[0].blastBlood&&enemiesList.length===0`));
 ok(`${type} dash kill ${i} uses fast pools`,P('bloodPools.length>0&&bloodPools.every(p=>p.blastBlood)'));
 ok(`${type} dash kill ${i} retains native thirty-unit knockback`,P('Math.abs(e.x-90)<1e-8&&Math.abs(e.y)<1e-8'));
}
ok('the full dash death rotation retains player combo credit',P(`consecutiveKills===${rotation.length}&&explosionDeathCounter===${rotation.length}`));
for(const ninja of [false,true]){
 stage();dashVictim('NORMAL',500,ninja);
 ok(`${ninja?'ninja':'normal'} dash survival preserves native damage`,P(`e.hp===${ninja?380:400}&&!e.dead&&corpses.length===0&&explosionDeathCounter===0`));
 ok(`${ninja?'ninja':'normal'} dash survival preserves knockback`,P('Math.abs(e.x-90)<1e-8&&Math.abs(e.y)<1e-8'));
}
stage();dashVictim('ARMORED');
ok('the red-orb hybrid retains dash death fallback three',P('e.dead&&corpses.length===1&&corpses[0].dT===3&&!corpses[0].blast&&explosionDeathCounter===0'));
ok('the hybrid dash fallback still uses the short blood-pool schedule',P('corpses[0].blastBlood&&bloodPools.length>0&&bloodPools.every(p=>p.blastBlood)'));
stage();dashVictim('ROBOT');
ok('the actual dash retains mechanical corpse and particle isolation',P("e.dead&&corpses.length===1&&corpses[0].eT==='ROBOT'&&!corpses[0].blast&&corpses[0].isIntactBody&&explosionDeathCounter===0&&particles.every(p=>!['BLOOD','GORE','BONE','HIT_BLOOD'].includes(p.t))"));
for(const type of ['AERIAL','AERIAL_PISTOL']){
 stage();victim(type);
 probe(`window.flak=new PlayerGrenade(0,0,0,1);flak.update();`);
 ok(`${type} actual grenade airburst retains jetpack death eleven`,P('e.dead&&corpses.length===1&&corpses[0].dT===11&&!corpses[0].blast&&corpses[0].blastBlood&&explosionDeathCounter===0'));
 ok(`${type} airburst uses only the short blood-pool schedule`,P('bloodPools.length>0&&bloodPools.every(p=>p.blastBlood)'));
 stage();victim(type,500);probe('window.flak=new PlayerGrenade(0,0,0,1);flak.update();');
 ok(`${type} flak survival preserves native three-hundred-fifty damage`,P('e.hp===150&&!e.dead&&corpses.length===0&&explosionDeathCounter===0'));
}
stage();victim();
probe(`window.oldWound={x:3,y:4,sz:3,isHead:true,isBulletHole:true};
 e.fallHit={frame:frameCount,kind:'HEAD',fatal:true,wound:oldWound,angle:-PI/2,force:2,weapon:WEAPONS.PISTOL};
 window.freshBlast=explosionCorpse(e,.7);`);
ok('a same-frame blast replaces stale headshot force and attached bullet spray',
 P("e.fallHit.kind==='BLAST'&&e.fallHit.angle===.7&&!e.fallHit.wound&&!freshBlast.fatalSpray"));

// Real allied victims, allied kill credit, player deaths, survivals and robot
// deaths all retain the damage and ownership rules preceding this art update.
stage();victim();
probe('e.isFriendly=true;triggerExplosion(0,0,160,false,false,null);');
ok('hostile grenade kills an ally with a human blast variant',P('e.dead&&corpses[0].blast&&consecutiveKills===0'));
stage();victim();
probe(`window.ally=new Character(1000,1000,false,'NORMAL');ally.isFriendly=true;
 triggerExplosion(0,0,160,false,true,ally);`);
ok('an allied blast never awards player combo',P('e.dead&&consecutiveKills===0'));
stage();victim('NORMAL',500);
probe('triggerRocketExplosion(0,0,true,e,player);');
ok('a surviving rocket target loses only native direct-hit damage and consumes no death',P('e.hp===150&&!e.dead&&corpses.length===0&&explosionDeathCounter===0'));
for(const method of ['grenade','rocket']){
 stage();probe('player.x=60;player.y=0;player.hp=1;player.shield=0;');
 probe(method==='grenade'?'triggerExplosion(0,0,160,false,false,null);':'triggerRocketExplosion(0,0,false,null,null);');
 ok(`${method} can apply the new death to the player`,P('player.dead&&corpses.length===1&&corpses[0].blast&&corpses[0].blastBlood'));
 ok(`${method} fatal player blood never queues a second slow pool`,P('bloodPools.length>0&&bloodPools.every(p=>p.blastBlood)'));
}
stage();victim('ROBOT');probe('triggerExplosion(0,0,160,false,true,player);');
ok('a robot still leaves an intact mechanical corpse',P("e.dead&&corpses.length===1&&corpses[0].eT==='ROBOT'&&!corpses[0].blast&&corpses[0].isIntactBody"));
for(const dt of [18,19,20]){
 probe(`window.robotBody=new Corpse(0,0,0,0,color(80),color(50),${dt},0,[],null,0,'ROBOT',21,27);`);
 ok(`constructor safety blocks human blast variant ${dt} on a robot`,P('robotBody.dT===0&&!robotBody.blast'));
}

function make(dt,type='NORMAL',angle=0){
 probe(`frameCount++;particles=[];corpses=[];bloodPools=[];
  window.e=new Character(0,0,false,${JSON.stringify(type)});e.aimAngle=.4;e.moveAngle=-.2;
  rememberFigureMotion(e,0,0);window.c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,
  ${dt},${angle},e.decals,e.currentWeapon,${angle},e.eType,e.bodyW,e.bodyH,e);`);
}
const saved={};let depth=0,minDepth=0,clipDepth=0,minClipDepth=0;
for(const name of ['push','pop']){saved[name]=ctx[name];ctx[name]=(...a)=>{
 if(name==='push')depth++;else{depth--;minDepth=Math.min(minDepth,depth);}return saved[name](...a);};}
const canvasSave=ctx.drawingContext.save,canvasRestore=ctx.drawingContext.restore;
ctx.drawingContext.save=()=>{clipDepth++;canvasSave();};
ctx.drawingContext.restore=()=>{clipDepth--;minClipDepth=Math.min(minClipDepth,clipDepth);canvasRestore();};
ctx.__blastTarget={...ctx};
function paint(target=false){
 const before=P('JSON.stringify(c.blast)'),rng=seed;depth=minDepth=clipDepth=minClipDepth=0;
 for(const k of Object.keys(calls))calls[k]=0;
 probe(target?'c.show(__blastTarget);':'c.show();');
 assert.equal(depth,0,'blast painter leaked a transform');assert.equal(minDepth,0,'blast painter over-popped');
 assert.equal(clipDepth,0,'blast painter leaked a clipping mask');assert.equal(minClipDepth,0,'blast painter over-restored a clipping mask');
 assert.equal(P('JSON.stringify(c.blast)'),before,'drawing advanced the ballistic state');
 assert.equal(seed,rng,'drawing consumed game randomness');
 return JSON.stringify(calls);
}
try{
 for(const dt of [18,19,20])for(const type of ['NORMAL','ARMORED_STANDARD','NM0_ROOKIE_F'])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  stage();make(dt,type,angle);
  ok(`${type}/${dt}/${angle} has bounded dismemberment anatomy`,P('!!c.blast&&!c.isIntactBody&&c.blast.parts.length>=1&&c.blast.parts.length<=2&&c.blast.gibs.length>0&&c.blast.gibs.length<=40'));
  const types=Array.from(P('c.blast.parts.map(p=>p.type)'));
  if(dt===18)assert.deepEqual(types,['torso'],'both destroyed legs must leave only a torso');
  if(dt===19)assert.deepEqual([...types].sort(),['body','leg'],'one leg loss must retain one whole leg and the body');
  if(dt===20)assert.deepEqual(types,['diagonalHalf','diagonalHalf'],'diagonal split must leave two figure halves');
  checks++;
  let maxHeight=0,last=0;
  for(const age of [0,5,15,35,90,180,240]){
   probe(`for(let i=${last};i<${age};i++){frameCount++;c.update();}`);last=age;
   maxHeight=Math.max(maxHeight,P('Math.max(...c.blast.parts.map(p=>p.z))'));
   const live=paint();assert.equal(paint(),live,'fixed-age live painting was not deterministic');
   const baked=paint(true);assert.equal(paint(true),baked,'fixed-age stamped painting was not deterministic');
   ok(`${type}/${dt}/${angle}/${age} piece coordinates remain finite`,P('c.blast.parts.concat(c.blast.gibs).every(p=>[p.x,p.y,p.z,p.rot].every(Number.isFinite))'));
  }
  ok(`${type}/${dt}/${angle} visibly rises before landing`,maxHeight>10);
  ok(`${type}/${dt}/${angle} all body pieces and gibs finish on the floor`,P('c.blast.done&&c.blast.parts.concat(c.blast.gibs).every(p=>p.landed&&p.z===0)'));
  const frozen=P('JSON.stringify(c.blast)');probe('for(let i=0;i<60;i++)c.update();');
  assert.equal(P('JSON.stringify(c.blast)'),frozen,'settled blast pieces kept moving');checks++;
  ok(`${type}/${dt}/${angle} completed death can retire`,P('corpseSettled(c)'));
 }
}finally{
 for(const [name,fn]of Object.entries(saved))ctx[name]=fn;
 ctx.drawingContext.save=canvasSave;ctx.drawingContext.restore=canvasRestore;
}

// Observe the actual painted cut line after all figure transforms, rather
// than using blastCutPoint() as its own oracle for airborne blood attachment.
let matrix=[1,0,0,1,0,0],matrixStack=[],stroke=[],edges=[];
const poseFns={};
for(const name of ['push','pop','translate','rotate','scale','stroke','line'])poseFns[name]=ctx[name];
const mul=u=>{const t=matrix;matrix=[t[0]*u[0]+t[2]*u[1],t[1]*u[0]+t[3]*u[1],t[0]*u[2]+t[2]*u[3],t[1]*u[2]+t[3]*u[3],t[0]*u[4]+t[2]*u[5]+t[4],t[1]*u[4]+t[3]*u[5]+t[5]];};
const point=(x,y)=>({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]});
ctx.push=()=>{matrixStack.push({matrix:[...matrix],stroke});poseFns.push();};
ctx.pop=()=>{assert.ok(matrixStack.length);({matrix,stroke}=matrixStack.pop());poseFns.pop();};
ctx.translate=(x,y)=>{mul([1,0,0,1,x,y]);poseFns.translate(x,y);};
ctx.rotate=a=>{mul([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);poseFns.rotate(a);};
ctx.scale=(x,y=x)=>{mul([x,0,0,y,0,0]);poseFns.scale(x,y);};
ctx.stroke=(...a)=>{stroke=a[0]&&a[0].levels?[...a[0].levels]:a;poseFns.stroke(...a);};
ctx.line=(x,y,nx,ny)=>{if(stroke.slice(0,3).join(',')==='55,1,10')edges.push([point(x,y),point(nx,ny)]);poseFns.line(x,y,nx,ny);};
try{for(const dt of [18,19,20])for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const age of [3,18,45]){
 stage();make(dt,'ARMORED_STANDARD',a);
 probe(`for(let i=0;i<${age-1};i++){frameCount++;c.update();}particles=[];frameCount++;c.update();`);
 matrix=[1,0,0,1,0,0];matrixStack=[];stroke=[];edges=[];probe('c.show();');
 const jets=Array.from(P("particles.filter(p=>p.t==='HIT_BLOOD').map(p=>({x:p.x,y:p.y}))"));
 assert.equal(edges.length,P('c.blast.parts.length'),'a surviving body cut was not painted');
 assert.equal(jets.length,edges.length*2,'both sides of each wound should spray');
 for(let i=0;i<edges.length;i++)for(let j=0;j<2;j++){
  const [p,q]=edges[i],u=j?.75:.25,jet=jets[i*2+j];
  ok(`${dt}/${a}/${age} jet ${i*2+j} follows the painted airborne wound`,Math.hypot(jet.x-(p.x+(q.x-p.x)*u),jet.y-(p.y+(q.y-p.y)*u))<1e-7);
 }
}}finally{for(const [name,fn]of Object.entries(poseFns))ctx[name]=fn;}

for(const dt of [18,19,20]){
 stage();make(dt);probe('corpses=[c];doTick=false;');
 const paused=P('JSON.stringify(c.blast)');probe('for(let i=0;i<50;i++)updateCorpses();');
 ok(`paused ${dt} keeps the entire ballistic pose`,P('JSON.stringify(c.blast)')===paused);
 probe('doTick=true;viewLeft=viewTop=10000;viewRight=viewBottom=11000;for(let i=0;i<260&&corpses.length;i++){frameCount++;updateCorpses();}');
 ok(`off-screen ${dt} lands and stamps without retaining a live corpse`,P('c.blast.done&&corpses.length===0&&Object.keys(bloodChunks).some(k=>k.endsWith(",B"))'));
 stage();make(dt);probe('corpses=[c];retireCorpsesToBloodBank();');
 ok(`travel ${dt} finishes its flying pieces before banking`,P('c.blast.done&&corpses.length===0&&c.blast.parts.every(p=>p.z===0)&&Object.keys(bloodChunks).some(k=>k.endsWith(",B"))'));
}
const createGraphics=ctx.createGraphics;
ctx.createGraphics=(w,h)=>{const g=createGraphics(w,h);g.width=w;g.height=h;return g;};
try{for(const dt of [18,19,20]){
 stage();make(dt);probe(`finishBlastDeath(c);c.x=CHUNK_SIZE-3;c.y=CHUNK_SIZE-3;stampCorpse(c);`);
 ok(`baked ${dt} covers every separated piece and gib across chunk seams`,P(`c.blast.parts.concat(c.blast.gibs).every(p=>{
  const x=c.x+p.x,y=c.y+p.y,cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor(y/CHUNK_SIZE),e=bloodChunks[bloodKey(cx,cy,true)];
  return e&&x-cx*CHUNK_SIZE>=e.bx&&x-cx*CHUNK_SIZE<=e.bx+e.pg.width&&y-cy*CHUNK_SIZE>=e.by&&y-cy*CHUNK_SIZE<=e.by+e.pg.height;
 })`));
}}finally{ctx.createGraphics=createGraphics;}
stage();make(20);probe('corpses=[c];explosionDeathCounter=7;resetRunState();');
ok('hard reset discards blast bodies, floor banks and rotation state',P('corpses.length===0&&Object.keys(bloodBanks).length===0&&explosionDeathCounter===0'));
console.log(`${checks}/${checks} explosion death route, anatomy, ballistic, paint, team, pause, off-screen, travel and reset checks passed.`);

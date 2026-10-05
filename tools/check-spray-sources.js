// Verify real bullet history, headshot bursts, and each selected painted hole.
const assert=require('assert'),{ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let seed=9181;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
 return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
probe(`isStoryMode=false;townsData={};startAtLevel(1);started=true;doTick=true;
 activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();
 player.x=10000;player.y=10000;MAX_KILLS=totalKills;corpses=[];enemiesList=[];
 viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;`);
const near=(a,b,label)=>assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-8,label);

// Three actual hits, with knockback between them, create three real holes.
for(const weapon of ['SHOTGUN','ASSAULT_RIFLE','SMG','DUAL_SMG','PISTOL']){
 probe(`frameCount++;corpses=[];particles=[];headshotCounter=0;bodyOverkillCounter=0;
  window.e=new Character(40,0,false,'NORMAL');e.aimAngle=0;e.hp=2*(WEAPONS.${weapon}===WEAPONS.SHOTGUN?25:WEAPONS.${weapon}.bodyDmg)+1;enemiesList=[e];
  for(let n=0;n<3;n++){frameCount++;bullets=[];window.b=spawnBullet(e.x-40,e.y,0,true,'BODY',WEAPONS.${weapon},player);b.startX=-500;
   for(let i=0;i<8&&b.active&&corpses.length===0;i++)updateBullets();}
  window.c=corpses[0];`);
 assert(P('!!c'),weapon+' three hits failed to kill');
 assert.equal(P('e.decals.length'),3);assert(P('e.decals.every(d=>d.isBulletHole&&d.shotA===0)'));
 const count=weapon==='PISTOL'?1:3;
 assert.deepStrictEqual(P('c.fatalSpray.wounds'),P('e.decals.slice(-'+count+')'),weapon+' selected the wrong holes');
 assert.equal(P('c.fatalSpray.left'),210);
}

function fixture(type=0,kind='BODY',age=0,eType='NORMAL',weapon='SMG',facing=-.8){
 seed=9181;
 probe(`frameCount=1000;particles=[];window.e=new Character(0,0,false,'${eType}');
  e.aimAngle=${facing};e.moveAngle=.7;e.isMoving=true;rememberFigureMotion(e,Math.cos(.7)*4,Math.sin(.7)*4);
  window.holes=[{x:-3,y:1},{x:1,y:2},{x:3.1,y:-2.7}].map((d,i)=>({...d,sz:3+i*.4,col:[91,1,i+1,223],isHead:i===0||i===2&&'${kind}'==='HEAD',isBulletHole:true,shotA:-.9+i*.4}));
  e.decals=[{x:9,y:4,sz:10,col:[40,40,40,220]},...holes];window.w=holes[2];
  e.fallHit={frame:frameCount,kind:'${kind}',weapon:WEAPONS.${weapon},angle:-.4,force:6,mx:e.motionX,my:e.motionY,x:0,y:0,fatal:true,wound:w};
  window.c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,${type},.3,e.decals,e.currentWeapon,-.4,e.eType,e.bodyW,e.bodyH,e);
  for(let i=0;i<${age};i++){frameCount++;c.update();}`);
}
// Scorches/hide patterns are not holes; fewer holes remain fewer emitters.
fixture();assert.deepStrictEqual(P('c.fatalSpray.wounds'),P('holes'));
probe('e.decals.unshift({x:-7,y:-4,isBulletHole:true},{x:5,y:6,isBulletHole:true});');
assert.deepStrictEqual(P('buildFatalSpray(e,e.eType).wounds'),P('holes'),'older bullet holes remained selected');
probe('e.decals.splice(2,0,{x:99,y:99,sz:60,isHead:false});');
assert.deepStrictEqual(P('buildFatalSpray(e,e.eType).wounds'),P('holes'));
probe('e.decals=[holes[1],holes[2]];');assert.equal(P('buildFatalSpray(e,e.eType).wounds.length'),2);
probe('e.decals=[holes[2]];');assert.equal(P('buildFatalSpray(e,e.eType).wounds.length'),1);
probe('e.decals=holes;e.fallHit.weapon=WEAPONS.PISTOL;');assert.deepStrictEqual(P('buildFatalSpray(e,e.eType).wounds'),P('[w]'));
const frozen=P('c.fatalSpray.wounds');probe('holes[0].x=99;holes[0].col[0]=0;holes.pop();');
assert.deepStrictEqual(P('c.fatalSpray.wounds'),frozen,'corpse spray reads mutable live wounds');

// Capture the game's drawing transforms rather than duplicating its geometry.
let m=[1,0,0,1,0,0],fill=null,stack=[],marks=[],spatter=[],head=null;
const originals={};
for(const n of ['push','pop','translate','rotate','scale','fill','ellipse','drawFigureHair'])originals[n]=ctx[n];
function mul(u){const t=m;m=[t[0]*u[0]+t[2]*u[1],t[1]*u[0]+t[3]*u[1],t[0]*u[2]+t[2]*u[3],t[1]*u[2]+t[3]*u[3],t[0]*u[4]+t[2]*u[5]+t[4],t[1]*u[4]+t[3]*u[5]+t[5]];}
ctx.push=()=>{stack.push({m:[...m],fill});originals.push();};
ctx.pop=()=>{assert(stack.length,'unbalanced pop');({m,fill}=stack.pop());originals.pop();};
ctx.translate=(x,y)=>{mul([1,0,0,1,x,y]);originals.translate(x,y);};
ctx.rotate=a=>{mul([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);originals.rotate(a);};
ctx.scale=(x,y=x)=>{mul([x,0,0,y,0,0]);originals.scale(x,y);};
ctx.fill=(...a)=>{fill=a[0]&&a[0].levels?[...a[0].levels]:a;originals.fill(...a);};
ctx.ellipse=(x,y,w,h)=>{assert([x,y,w,h].every(Number.isFinite));
 const p={x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]};
 if(fill&&fill[0]===91&&fill[1]===1&&fill[3]===223)marks.push({...p,id:fill[2]});
 if(fill&&fill[0]===96&&fill[1]===6&&fill[2]===6)spatter.push({...p,r:w*.5*Math.hypot(m[0],m[1])});
 originals.ellipse(x,y,w,h);};
ctx.drawFigureHair=(g,id,x,y,sway)=>{head={x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5],r:5.5*Math.hypot(m[0],m[1])};originals.drawFigureHair(g,id,x,y,sway);};
function paint(){m=[1,0,0,1,0,0];fill=null;stack=[];marks=[];spatter=[];head=null;probe('c.show();');assert.equal(stack.length,0);}
let origins=0;
for(const type of [0,1,2,4,6,7,8,9,10,11,12])for(const age of [0,1,7,40,150,209]){
 fixture(type,[1,4,6,8,9,12].includes(type)?'HEAD':'BODY',age);paint();
 for(const [i,w] of P('c.fatalSpray.wounds').entries()){
  const actual=marks.filter(p=>p.id===w.col[2]);assert.equal(actual.length,1,`dT ${type} age ${age}: hole ${i} missing or duplicated`);
  near(P(`fatalWoundPoint(c,c.fatalSpray.wounds[${i}])`),actual[0],`dT ${type} age ${age}: hole ${i} spray missed its decal`);origins++;
 }
 probe('particles=[];c.fatalSpray.left=210;advanceFatalSpray(c);');
 const drops=P('particles.filter(p=>p.t==="WOUND_BLOOD")');assert.equal(drops.length,3);
 for(let i=0;i<3;i++)near(drops[i],P(`fatalWoundPoint(c,c.fatalSpray.wounds[${i}])`),'selected hole emitted at another hole');
 if([1,4,6,8,9].includes(type)){
  assert(spatter.length>8&&head,'missing head spatter');
  for(const p of spatter)assert(Math.hypot(p.x-head.x,p.y-head.y)+p.r<=head.r+1e-8,'head spatter painted over the body');
 }
}
for(const [n,fn]of Object.entries(originals))ctx[n]=fn;

// Legacy timed head jets now start at the exact same wound as the new spray.
const emit=ctx.emit;let jets=[];
ctx.emit=(...a)=>{if(a[4]==='BLOOD'&&a.length===7)jets.push({x:a[0],y:a[1]});return emit(...a);};
for(const type of [1,4,6,8,9,12])for(const eType of ['NORMAL','ARMORED_STANDARD']){
 fixture(type,'HEAD',0,eType);jets=[];
 const frames=type===12?3:2;probe(`for(let i=0;i<${frames};i++){frameCount++;c.update();}`);
 assert.equal(jets.length,1,`dT ${type}: legacy head jet missing`);
 near(jets[0],P('headWoundPoint(c)'),`dT ${type} ${eType}: legacy jet sprayed over the chest`);
}
ctx.emit=emit;

// Real death pipeline: the initial hit and fatal blood/gore/bone bursts move too.
let bursts=0;
for(const weapon of ['PISTOL','SHOTGUN','ASSAULT_RIFLE','SMG','DUAL_SMG'])for(let counter=0;counter<3;counter++){
 probe(`frameCount++;bullets=[];corpses=[];particles=[];headshotCounter=${counter};
  window.e=new Character(40,0,false,'NORMAL');e.hp=1;e.aimAngle=0;enemiesList=[e];
  window.b=spawnBullet(0,0,0,true,'HEAD',WEAPONS.${weapon},player);
  for(let i=0;i<8&&b.active&&corpses.length===0;i++)updateBullets();window.c=corpses[0];`);
 assert(P('!!c'));const p=P('headWoundPoint(c)'),hit=P('particles.slice(e.fallHit.particleStart).filter(q=>["BLOOD","GORE","BONE"].includes(q.t))');
 assert(hit.length>8,'head kill lost its original burst');
 for(const q of hit)near(q,p,weapon+' initial headshot burst remained at the body');bursts++;
}

// All three streams share one 3.5-second timer; no extra or late particles.
fixture();probe('particles=[];doTick=false;corpses=[c];for(let i=0;i<30;i++){frameCount++;updateCorpses();}');
assert.equal(P('c.fatalSpray.left'),210);assert.equal(P('particles.length'),0);
probe('doTick=true;for(let i=0;i<210;i++){frameCount++;advanceFatalSpray(c);}');
assert.equal(P('c.fatalSpray.left'),0);assert.equal(P('particles.filter(p=>p.t==="WOUND_BLOOD").length'),315);
probe('for(let i=0;i<60;i++)advanceFatalSpray(c);');assert.equal(P('particles.length'),315);
console.log(`Spray sources passed: real three-hit histories for all four requested weapons, pistol one-hole behavior, fewer real holes, nonbullet-mark exclusion, frozen metadata, ${origins} mixed head/body painted-hole origins, head-only spatter, 12 legacy head jets, ${bursts} actual initial headshot bursts, pause and exact shared 210-tick cutoff.`);

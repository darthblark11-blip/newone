// Exercise actual bullet kills and compare emitter origins with transformed
// decals painted by the game. No second copy of the corpse geometry.
const assert=require('assert');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let seed=9181;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
 return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
probe(`isStoryMode=false;townsData={};startAtLevel(1);started=true;doTick=true;
 activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();
 player.x=10000;player.y=10000;MAX_KILLS=totalKills;corpses=[];enemiesList=[];
 viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;`);
function shot(weapon,kind,counter=0,range=0,hp=1){
 probe(`frameCount++;bullets=[];corpses=[];particles=[];headshotCounter=${counter};bodyOverkillCounter=${counter};
  window.e=new Character(40,0,false,'NORMAL');e.hp=${hp};e.aimAngle=0;e.isMoving=true;e.moveAngle=HALF_PI;
  rememberFigureMotion(e,0,4);enemiesList=[e];window.b=spawnBullet(0,0,0,true,'${kind}',WEAPONS.${weapon},player);b.startX=-${range};
  for(let i=0;i<5&&b.active&&corpses.length===0;i++)updateBullets();`);
}
for(const w of ['PISTOL','SMG','ASSAULT_RIFLE','SHOTGUN','DUAL_SMG'])for(const kind of ['BODY','HEAD'])for(let n=0;n<3;n++){
 shot(w,kind,n);assert(P('corpses.length===1'),w+' '+kind+' failed to kill');
 assert.equal(P('corpses[0].fatalSpray.left'),210);
 assert.deepStrictEqual(P('corpses[0].fatalSpray.wound'),P('e.fallHit.wound'));
 assert.equal(P('corpses[0].fatalSpray.wound.isHead'),kind==='HEAD');
 assert(!P('corpses[0].fatalSpray.wound===e.fallHit.wound'),'fatal wound is not frozen');
}
shot('PISTOL','BODY',0,0,100);assert.equal(P('corpses.length'),0,'nonfatal hit started a corpse stream');
probe(`window.e=new Character(0,0,false,'NORMAL');e.decals=[{x:3,y:2,sz:6,isHead:false}];
 e.fallHit={frame:frameCount-1,kind:'BODY',angle:0,fatal:true,wound:e.decals[0]};
 window.c=new Corpse(0,0,0,0,e.shirtCol,e.pantsCol,0,0,e.decals,null,0,e.eType,21,27,e);`);
assert.equal(P('c.fatalSpray'),null,'stale bullet wound became a new fatal spray');
probe('e.fallHit.frame=frameCount;c=new Corpse(0,0,0,0,e.shirtCol,e.pantsCol,0,0,e.decals,null,0,"ROBOT",21,27,e);');
assert.equal(P('c.fatalSpray'),null,'robot started bleeding');
probe('e.fallHit.fatal=false;c=new Corpse(0,0,0,0,e.shirtCol,e.pantsCol,0,0,e.decals,null,0,"NORMAL",21,27,e);');
assert.equal(P('c.fatalSpray'),null,'nonfatal same-frame wound became a fatal spray');

// Track the actual painter's transforms and fill, including graphics targets.
let m=[1,0,0,1,0,0],fill=null,stack=[],marks=[],heads=[];
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
 if(fill&&fill.join(',')==='91,1,2,223')marks.push({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});originals.ellipse(x,y,w,h);};
ctx.drawFigureHair=(g,id,x,y,sway)=>{heads.push({axis:[m[0],m[1]],fill});originals.drawFigureHair(g,id,x,y,sway);};
function resetPaint(){m=[1,0,0,1,0,0];fill=null;stack=[];marks=[];heads=[];}
function fixture(type,kind='BODY',age=0,eType='NORMAL',a=.7,facing=-.8,wound=true){
 seed=9181;
 probe(`frameCount=1000;particles=[];window.e=new Character(0,0,false,'${eType}');e.aimAngle=${facing};e.moveAngle=${a};e.isMoving=true;
  e.hairCol=color(51,34,22);e.skinCol=color(235,180,140);rememberFigureMotion(e,Math.cos(${a})*4,Math.sin(${a})*4);
  window.w={x:3.1,y:-2.7,sz:6.1,col:[91,1,2,223],isHead:${kind==='HEAD'}};e.decals=[w];
  e.fallHit={frame:frameCount,kind:'${kind}',weapon:WEAPONS.SHOTGUN,angle:-.4,force:6,mx:e.motionX,my:e.motionY,x:0,y:0,fatal:true,wound:${wound?'w':'null'}};
  window.c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,${type},.3,e.decals,e.currentWeapon,-.4,e.eType,e.bodyW,e.bodyH,e);
  for(let i=0;i<${age};i++){frameCount++;c.update();}`);
}
let origins=0;
for(const [type,kind] of [[0,'BODY'],[0,'HEAD'],[1,'HEAD'],[2,'BODY'],[3,'BODY'],[4,'HEAD'],[5,'BODY'],[5,'HEAD'],[6,'HEAD'],[7,'BODY'],[8,'HEAD'],[9,'HEAD'],[10,'BODY'],[11,'BODY'],[12,'HEAD'],[13,'BODY'],[14,'BODY']])
 for(const age of [0,1,5,7,40,150,209]){
  fixture(type,kind,age);resetPaint();probe('c.show();');assert.equal(stack.length,0);
  const point=P('fatalWoundPoint(c)');assert.equal(marks.length,1,`dT ${type} ${kind}: expected one fatal decal`);
  assert(Math.hypot(point.x-marks[0].x,point.y-marks[0].y)<1e-8,`dT ${type} ${kind} age ${age}: spray missed painted wound`);
  probe('particles=[];advanceFatalSpray(c);');
  const droplet=P('particles.find(p=>p.t==="WOUND_BLOOD")');
  if(droplet)assert(Math.hypot(droplet.x-point.x,droplet.y-point.y)<1e-8,'particle missed wound');
  origins++;
 }
for(const eType of ['ARMORED','ARMORED_STANDARD','SNAIL_HYBRID','BUG','SNAIL','COW','HORSE','ALIEN_GATOR'])for(const kind of ['BODY','HEAD']){
 fixture(0,kind,40,eType);resetPaint();probe('c.show();');assert.equal(stack.length,0);
 const p=P('fatalWoundPoint(c)');assert.equal(marks.length,1,eType+' decal');
 assert(Math.hypot(p.x-marks[0].x,p.y-marks[0].y)<1e-8,eType+' '+kind+' origin');origins++;
}
for(const type of [0,1])for(const age of [0,1,4,7,40]){
 fixture(type,'HEAD',age,'NORMAL',.7,.7+Math.PI);resetPaint();probe('c.show();');
 const p=P('fatalWoundPoint(c)');assert.equal(marks.length,1);
 assert(Math.hypot(p.x-marks[0].x,p.y-marks[0].y)<1e-8,'backward head-roll wound origin');origins++;
}
// Forward/back heads for both stuns and deaths, independent of map direction.
for(const hairy of [false,true])for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const backward of [false,true]){
 const facing=a+(backward?Math.PI:0);
 fixture(0,'BODY',0,'NORMAL',a,facing,false);probe(`e.hairStyle=${hairy?'0':'undefined'};e.stunTimer=0;startPunchStun(e,-.4);`);
 assert.equal(P('e.stunPose.faceDown'),!backward);
 assert.equal(P('e.stunPose.duration'),40,'slow punch stun duration changed');
 probe('for(let i=0;i<20;i++){frameCount++;advanceStun(e);}');assert(P('stunFall(e)<.5'),'punch stun no longer falls slowly');
 probe('for(let i=0;i<40;i++){frameCount++;advanceStun(e);}');resetPaint();probe('drawStunnedFigure(e);');
 assert.equal(stack.length,0);assert.equal(heads.length,1);
 assert.deepStrictEqual(heads[0].fill,hairy&&!backward?[51,34,22,255]:[235,180,140,255]);
 const yaw=P('figureFallYaw(e.stunPose,e.stunPose.rag)'),target=yaw+(backward?Math.PI:0);
 assert(Math.cos(target)*heads[0].axis[0]+Math.sin(target)*heads[0].axis[1]>.79,'stun head rotation');
 probe('c=new Corpse(e.x,e.y,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,0,0,[],null,-.4,e.eType,e.bodyW,e.bodyH,e);');
 assert.equal(P('c.fall.faceDown'),!backward,'death changed already down head side');
 resetPaint();probe('c.show();');assert.deepStrictEqual(heads[0].fill,hairy&&!backward?[51,34,22,255]:[235,180,140,255]);
}
for(const [n,fn] of Object.entries(originals))ctx[n]=fn;

// Full 210-tick duration, pause, off-screen retirement, active piles and pooling.
fixture(0);probe('corpses=[c];particles=[];doTick=false;for(let i=0;i<50;i++){frameCount++;updateCorpses();}');
assert.equal(P('c.fatalSpray.left'),210);assert.equal(P('particles.length'),0);
probe('doTick=true;for(let i=0;i<209;i++){frameCount++;updateCorpses();}');
assert.equal(P('c.fatalSpray.left'),1);assert.equal(P('corpses.length'),1,'corpse retired before spray finished');
assert.equal(P('particles.filter(p=>p.t==="WOUND_BLOOD").length'),105);
probe('frameCount++;updateCorpses();');assert.equal(P('c.fatalSpray.left'),0);assert.equal(P('corpses.length'),0);
probe('for(let i=0;i<60;i++){frameCount++;updateParticles();}');assert.equal(P('particles.length'),0,'spray particles leaked');
fixture(0);probe('c.x=c.y=1e9;corpses=[c];particles=[];for(let i=0;i<209;i++){frameCount++;updateCorpses();}');
assert.equal(P('c.fatalSpray.left'),1);assert.equal(P('particles.length'),0,'off-screen emission');
probe('frameCount++;updateCorpses();');assert.equal(P('corpses.length'),0,'off-screen spray never retired');
fixture(0);probe(`corpses=Array.from({length:CORPSE_STACK_LIMIT+6},()=>c);frameCount=1020;cullCorpseStacks();`);
assert.equal(P('corpses.length'),P('CORPSE_STACK_LIMIT+6'),'pile culling cut an active spray short');
probe('corpses=[c];retireCorpsesToBloodBank();');assert.equal(P('c.fatalSpray.left'),0);assert.equal(P('corpses.length'),0);
probe('window.p=newParticle(0,0,color(90,0,0),"WOUND_BLOOD",2,3);p.init(4,5,color(1),"BLOOD",0,0);');
assert.equal(P('p.t'),'BLOOD');assert.equal(P('p.sz'),5);assert(P('Number.isFinite(p.vx+p.vy+p.l)'));
// Added spray must not change the existing heavy overkill physics or random art.
const state=()=>P('({x:c.x,y:c.y,sep:c.sep,fP:c.fP,bits:c.bits,overkill:c.overkillBits,rag:c.rag})');
for(const type of [2,4,7,8,9,10]){
 fixture(type,type===4||type===8||type===9?'HEAD':'BODY',60,'NORMAL',.7,-.8,false);const old=state(),oldSeed=seed;
 fixture(type,type===4||type===8||type===9?'HEAD':'BODY',60);assert.deepStrictEqual(state(),old,'spray changed overkill state');assert.equal(seed,oldSeed,'spray consumed global random draws');
}
console.log(`Fatal wounds passed: actual firearm killshots, ${origins} painted-decal origins, forward/back corpse and slow-stun heads, downed death continuity, 210-tick cutoff, pause/off-screen/stack/travel retirement, particle recycling and unchanged heavy overkill physics/randomness.`);

// Behavior checks for locomotion-driven falls, impact-only planted reactions,
// wound holding, collision/retirement and orthodox footwork. Uses the game rig.
const assert=require('assert');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let seed=3119;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;
 if(a===undefined)return r;if(Array.isArray(a))return a[Math.floor(r*a.length)];return b===undefined?r*a:a+(b-a)*r;};
probe(`isStoryMode=false;townsData={};startAtLevel(1);started=true;doTick=true;
 activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();enemiesList=[];corpses=[];
 leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
 player.x=10000;player.y=10000;setMeleeTool('NONE');viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;`);
const drop=(expr='0')=>probe(`window.c=new Corpse(e.x,e.y,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,${expr},0,e.decals,e.currentWeapon,HALF_PI,e.eType,e.bodyW,e.bodyH,e);`);
// Opposed movement and weapon force must not silently become a weighted average.
for(const a of [0,.7,Math.PI,-Math.PI/2]){
 probe(`window.e=new Character(0,0,false,'CITY_CITIZEN_M');e.aimAngle=-.2;e.isMoving=true;e.moveAngle=${a};rememberFigureMotion(e,Math.cos(${a})*4,Math.sin(${a})*4);`);drop();
 assert(Math.abs(P('Math.atan2(Math.sin(c.fall.a-('+a+')),Math.cos(c.fall.a-('+a+')))'))<1e-9);
 probe('for(let i=0;i<8;i++){frameCount++;c.update();}');assert(P('c.fP<.1'),'fall still snaps to floor');
 probe('for(let i=0;i<95;i++){frameCount++;c.update();}');assert(P('c.fP===1&&c.rag.done&&c.fall.done'));
 assert(P('Math.abs(c.rag.ang)<=.26'),'impact overrides locomotion through excessive spin');
 const frozen=P('[c.x,c.y,c.rag.t,c.fall.age,...c.rag.limbs.flatMap(l=>[l.a,l.b])]');
 probe('for(let i=0;i<200;i++){frameCount++;c.update();}');assert.deepEqual(P('[c.x,c.y,c.rag.t,c.fall.age,...c.rag.limbs.flatMap(l=>[l.a,l.b])]'),frozen);
}
// A collision-blocked walking intention counts as planted.
probe('window.e=new Character(0,0,false,"NORMAL");e.isMoving=true;e.moveAngle=0;rememberFigureMotion(e,0,0);');drop();assert.equal(P('c.fall.a'),Math.PI/2);assert(!P('c.fall.moving'));
const weak=P('buildFigureFall(e,0,weaponFallForce(WEAPONS.PISTOL),false,0)');
const strong=P('buildFigureFall(e,0,weaponFallForce(WEAPONS.SHOTGUN),false,0)');assert(strong.impulse>weak.impulse&&strong.duration<weak.duration);
// Root movement uses existing collision geometry and respects walls.
probe('window.e=new Character(0,0,false,"NORMAL");rememberFigureMotion(e,0,0);');
probe('window.c=new Corpse(0,0,0,0,e.shirtCol,e.pantsCol,0,0,[],null,0,e.eType,e.bodyW,e.bodyH,e);activeBuildings=[{x:40,y:0,w:10,h:200}];buildings=activeBuildings;invalidateColIndex();for(let i=0;i<90;i++){frameCount++;c.update();}');
assert(P('c.x<=20'),'fallen root crossed wall');
probe('activeBuildings=[];buildings=[];invalidateColIndex();');
// Real bullet pipeline: motion is captured before the existing knockback.
function shot(weapon,kind,counter=0,range=0){
 probe(`frameCount++;bullets=[];corpses=[];headshotCounter=${counter};bodyOverkillCounter=${counter};MAX_KILLS=totalKills;
  window.e=new Character(40,0,false,'NORMAL');e.hp=1;e.isFriendly=false;e.isNeutral=false;e.aimAngle=0;e.isMoving=true;e.moveAngle=HALF_PI;
  rememberFigureMotion(e,0,4);enemiesList=[e];window.b=spawnBullet(0,0,0,true,${JSON.stringify(kind)},WEAPONS.${weapon},player);b.startX=-${range};
  for(let i=0;i<5&&corpses.length===0;i++)updateBullets();`);
 assert(P('corpses.length>0'),weapon+' '+kind+' did not hit');return P('corpses[0].dT');
}
assert.equal(shot('PISTOL','BODY'),0);assert.equal(P('corpses[0].fall.a'),Math.PI/2);assert.equal(P('corpses[0].fall.mx'),0);assert.equal(P('corpses[0].fall.my'),4);
for(const [w,expected] of [['PISTOL',[1,8,9]],['ASSAULT_RIFLE',[6,8,9]],['SHOTGUN',[4,8,9]]])
 for(let i=0;i<3;i++){assert.equal(shot(w,'HEAD',i),expected[i]);assert(!P('corpses[0].fall&&corpses[0].fall.hold'),'headshot clutched a body wound');}
for(let i=0;i<3;i++){assert.equal(shot('SHOTGUN','BODY',i),[2,7,10][i]);assert(!P('corpses[0].fall&&corpses[0].fall.hold'));}
assert.equal(shot('SHOTGUN','BODY',0,500),0);assert.equal(shot('DUAL_SMG','BODY'),10);
// Ordinary body deaths hold a real decal with the arm on the corresponding side.
let held=0,loose=0;
for(let i=0;i<50;i++){
 probe(`frameCount++;window.e=new Character(0,0,false,'CITY_CITIZEN_F');e.aimAngle=0;rememberFigureMotion(e,0,0);
  window.w={x:-2,y:${i%2?7:-7},sz:5,col:[90,0,0,220],isHead:false};e.decals=[w];e.fallHit={frame:frameCount,kind:'BODY',angle:HALF_PI,force:3,mx:0,my:0,wound:w};`);drop();
 if(P('!!c.fall.hold')){held++;assert.equal(P('c.fall.hold.arm'),i%2?1:0);probe('for(let n=0;n<90;n++){frameCount++;c.update();}');
  assert(P(`(()=>{const r=ragRig(c.bW,c.bH),i=c.fall.hold.arm,s=i?1:-1,L=c.rag.limbs[i],a=s*(HALF_PI+L.a),b=s*L.b;
   const x=r.shX+Math.cos(a)*r.upper+Math.cos(a+b)*(r.fore+r.hand*.3),y=s*r.shY+Math.sin(a)*r.upper+Math.sin(a+b)*(r.fore+r.hand*.3);
   return Math.hypot(x-c.fall.hold.x,y-c.fall.hold.y)<r.hand*.55;})()`),'hand missed the wound');
 }else loose++;
}
assert(held>0&&loose>0,'ordinary reaction variety lost');
// A death while stunned continues the already fallen pose.
probe('e.stunTimer=0;e.stunPose=null;startPunchStun(e,PI);for(let i=0;i<50;i++){frameCount++;e.updateEnemy();}');drop();
assert(P('c.fall.age>c.fall.duration*.9&&Math.abs(c.fall.a-e.stunPose.a)<1e-9'));
// Actual player and NPC updates record locomotion, including early-return AI.
probe('player.x=0;player.y=0;player.isArmed=false;leftStick={active:true,dx:1,dy:0,base:{x:0,y:0}};frameCount++;player.updatePlayer();');assert(P('player.motionX>0&&player.motionFrame===frameCount'));
probe('leftStick.active=false;window.e=new Character(200,0,false,"CITY_CITIZEN_M");e.cityDistance=0;e.cityCx=0;e.cityCy=0;frameCount++;e.updateEnemy();');assert(P('e.motionFrame===frameCount'));
// Guard is compact at rest, stays orthodox while stepping, and drives the heel.
probe('player.isMoving=false;player.isArmed=false;player.meleeTimer=0;player.boxingHold=180;player.aimAngle=0;player.moveAngle=0;player.walkCycle=0;');
assert(P('Math.abs(boxerPose(player).hip)<.15&&Math.abs(boxerPose(player).torso)<.2'));
const rest=P('boxingFeet(player,boxerPose(player))');assert(rest[0].x>0&&rest[1].x<0&&rest[0].x-rest[1].x<16);
for(const a of [0,Math.PI,Math.PI/2,-Math.PI/2])for(let n=0;n<20;n++){
 probe(`player.isMoving=true;player.gait=.8;player.moveAngle=${a};player.walkCycle=${n*.32};`);
 const feet=P('boxingFeet(player,boxerPose(player))');assert(feet[0].y<0&&feet[1].y>0,'feet crossed');assert(feet.every(f=>Object.values(f).every(Number.isFinite)));
}
probe('player.isMoving=false;player.meleePhase=2;player.meleeTimer=10;player.punchDuration=20;');assert(P('boxingFeet(player,boxerPose(player))[1].lift>1'));
// No changes to the old death types, and every projected death draws to both targets.
let stack=0;const push=ctx.push,pop=ctx.pop;ctx.push=()=>{stack++;push();};ctx.pop=()=>{stack--;pop();assert(stack>=0);};
const ellipse=ctx.ellipse;ctx.ellipse=(...a)=>{assert(a.every(Number.isFinite));ellipse(...a);};
for(const type of [0,1,2,4,6,7,8,9])for(const age of [0,4,15,32,50,90]){
 probe(`window.e=new Character(0,0,false,'CITY_CITIZEN_F');e.stunTimer=0;e.stunPose=null;`);drop(String(type));probe(`for(let i=0;i<${age};i++){frameCount++;c.update();}c.show();`);assert.equal(stack,0);
}
ctx.push=push;ctx.pop=pop;ctx.ellipse=ellipse;
probe('corpses=[c];retireCorpsesToBloodBank();');assert.equal(P('corpses.length'),0);
console.log('Directional falls and footwork passed: movement/force, slower fall, frozen rest, collision, actual bullet metadata, unchanged headshot/overkill tables, wound holding, downed death continuity, actor motion, compact stance, steps, heel pivot and finite balanced rendering.');

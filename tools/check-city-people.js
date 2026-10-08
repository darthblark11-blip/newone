const assert=require('assert');
const {ctx,probe,mkG}=require('./harness');
const P=s=>probe('('+s+')');
probe(`isStoryMode=false;townsData={};startAtLevel(1);started=true;doTick=true;
  currentLevel=2; // Test animation/punch behavior outside Level 1's fortress buffer.
  activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();enemiesList=[];setMeleeTool("NONE");
  leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
  player.x=0;player.y=0;player.aimAngle=0;player.isArmed=false;
  viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;`);
const skin=new Set(),hair=new Set(),clothes=new Set(),sex=new Set();
for(let i=0;i<180;i++){
  probe(`window.c=new Character(200,100,false,${JSON.stringify(i%2?'CITY_CITIZEN_F':'CITY_CITIZEN_M')});cityAppearance(c,${i+1});`);
  skin.add(P('c.skinCol.levels.join(",")'));hair.add(P('c.hairStyle'));clothes.add(P('c.clothingStyle'));sex.add(P('c.eType'));
  assert(P('c.isNeutral&&c.isFriendly&&!c.isArmed&&c.isUnarmed'));
}
assert.equal(skin.size,3);assert.equal(hair.size,7);assert.equal(clothes.size,4);assert.equal(sex.size,2);
// A shot, including the pooled bullet path, frightens only nearby pedestrians.
probe('window.near=new Character(200,0,false,"CITY_CITIZEN_M");window.far=new Character(1800,0,false,"CITY_CITIZEN_F");cityNoise=[];frameCount=500;spawnBullet(0,0,0,true,"BODY",WEAPONS.PISTOL,player);near.updateEnemy();far.updateEnemy();');
assert.equal(P('near.state'),'FLEE');assert.notEqual(P('far.state'),'FLEE');
assert(P('near.x>200'));assert(P('near.isNeutral&&near.isFriendly&&!near.isArmed'));
const count=P('bullets.length');probe('near.fire(0);');assert.equal(P('bullets.length'),count);
// Panic reaches the shared player's running band, then returns to normal walking.
probe('cityNoise=[];for(let i=0;i<30;i++){frameCount++;near.updateEnemy();}');assert(P('near.gait>.65'));
probe('near.panicTimer=1;near.updateEnemy();near.updateEnemy();');assert.equal(P('near.state'),'WANDER');
// Attacking a pedestrian never converts the town into hostiles. The flee origin
// is the actual attacker, including enemy crossfire.
probe('window.normal=new Character(400,300,false,"FARMER_MALE");enemiesList=[near,far,normal];far.takeDamage(1,{x:1900,y:0});');
assert(P('far.panicX===1900&&far.state==="FLEE"&&far.isNeutral&&normal.isNeutral'));
// Land a real first punch, without calling the stun helper directly.
probe('window.victim=new Character(45,0,false,"CITY_CITIZEN_F");enemiesList=[victim];player.meleePhase=0;player.meleeCooldown=0;player.meleeTimer=0;player.meleeComboTimer=0;player.activateMelee(true);for(let i=0;i<10;i++){frameCount++;player.updatePlayer();}');
assert.equal(P('victim.state'),'STUNNED');assert.equal(P('victim.stunTimer'),240);assert.equal(P('victim.hp'),100);
assert(P('victim.stunPose.impulse>4&&player.boxingHold===180'));
const x=P('victim.x');probe('for(let i=0;i<20;i++){frameCount++;victim.updateEnemy();}');assert(P('victim.x>'+x));
assert(P('stunFall(victim)>.4&&stunFall(victim)<1'));probe('for(let i=0;i<30;i++){frameCount++;victim.updateEnemy();}');assert(P('stunFall(victim)>.85'));
const fallAge=P('victim.stunPose.age');probe('startPunchStun(victim,0);');assert.equal(P('victim.stunPose.age'),fallAge);
// Two-bone drawing stays finite and the recovery is gradual, not a snap.
const oldEllipse=ctx.ellipse;let geometry=[];
ctx.ellipse=(...a)=>{assert(a.every(Number.isFinite),'non-finite character geometry');geometry.push(a);};
for(const age of [0,6,15,28,38,60,150]){
  probe(`victim.stunPose.age=${age};victim.stunTimer=100;victim.show();`);
}
probe('victim.stunTimer=16;victim.show();');assert(P('stunFall(victim)<=.5'));assert(geometry.length>100);
probe('victim.stunTimer=1;victim.updateEnemy();');assert.equal(P('victim.state'),'FLEE');assert(P('victim.isNeutral&&victim.hp===100'));
// Three seconds after the completed punch; firing or a melee tool cancels guard.
probe('player.meleeTimer=0;player.boxingHold=180;player.isArmed=false;');
assert(P('boxerPose(player).active'));
probe('for(let i=0;i<179;i++){frameCount++;player.updatePlayer();}');assert(P('boxerPose(player).active'));
probe('player.updatePlayer();');assert(!P('boxerPose(player).active'));
probe('player.boxingHold=180;player.isArmed=true;');assert(!P('boxerPose(player).active'));
probe('player.isArmed=false;swordPickedUp=true;setMeleeTool("SWORD");');assert(!P('boxerPose(player).active'));
probe('setMeleeTool("NONE");player.meleeTimer=10;player.punchDuration=20;player.meleePhase=1;player.show();');
assert(P('Math.abs(boxerPose(player).hip+.12)<Math.abs(boxerPose(player).torso+.17)'));
ctx.ellipse=oldEllipse;
// Measure rendered boot positions through the full p5 transform stack. The
// lead and rear feet must actually straddle the torso along the aim direction.
let matrix=[1,0,0,1,0,0],stack=[],boots=[];const originals={};
const mul=(u)=>{const t=matrix;matrix=[t[0]*u[0]+t[2]*u[1],t[1]*u[0]+t[3]*u[1],t[0]*u[2]+t[2]*u[3],t[1]*u[2]+t[3]*u[3],t[0]*u[4]+t[2]*u[5]+t[4],t[1]*u[4]+t[3]*u[5]+t[5]];};
for(const name of ['push','pop','translate','rotate','scale','ellipse'])originals[name]=ctx[name];
ctx.push=()=>{stack.push([...matrix]);originals.push();};ctx.pop=()=>{matrix=stack.pop();originals.pop();};
ctx.translate=(x,y)=>{mul([1,0,0,1,x,y]);originals.translate(x,y);};
ctx.rotate=a=>{mul([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);originals.rotate(a);};
ctx.scale=(x,y=x)=>{mul([x,0,0,y,0,0]);originals.scale(x,y);};
const rig=P('figureRig(player.bodyW,player.bodyH)');
ctx.ellipse=(x,y,w,h)=>{if(Math.abs(w-rig.foot)<1e-9&&Math.abs(h-rig.shinW*.8)<1e-9)boots.push(matrix[0]*x+matrix[2]*y+matrix[4]);originals.ellipse(x,y,w,h);};
probe('player.x=0;player.y=0;player.aimAngle=0;player.moveAngle=0;player.isMoving=false;player.meleeTimer=0;player.boxingHold=180;player.show();');
assert.equal(boots.length,2);assert(boots.some(x=>x>5)&&boots.some(x=>x<-5),'boxing feet do not form left lead / right rear');assert.equal(stack.length,0);
for(const name in originals)ctx[name]=originals[name];
// Deterministic residents, patrol pair and posts, bounded and outside story roster.
probe(`currentLevel=1;player.x=72600;player.y=48600;enemiesList=[];biomeState={};authoredChunks=null;authoredCore=null;authoredMask=null;cityPeopleFrame=-99;
  window.mgr={biome:1,chunks:new Map()};`);
let site;
for(let cy=40;cy<60&&!site;cy++)for(let cx=50;cx<70;cx++)if(!P(`cityHasCanal(1,${cy})`)){site={cx,cy};break;}
const {cx,cy}=site;
probe(`player.x=${cx*1200+600};player.y=${cy*1200+600};zoom=2;
  camX=player.x-width/zoom/2;camY=player.y-height/zoom/2;
  viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;
  mgr.chunks.set("${cx},${cy}",{solid:[]});for(let i=0;i<4;i++){frameCount+=21;refreshCityPeople(mgr,${cx},${cy});}`);
assert.equal(P('enemiesList.filter(e=>e.isCityCivilian).length'),6);assert.equal(P('enemiesList.filter(e=>e.isCityPatrol).length'),4);
assert(P('getBiomeState(1).destroyed!==undefined&&getBiomeState(1).discoveredAnchors!==undefined'));
assert(P('enemiesList.every(e=>!e.isPopulation&&!e.isMilitary)'));
probe('window.guards=enemiesList.filter(e=>e.isCityPatrol);window.pair=guards.filter(e=>!e.cityPost);');
assert(P('pair[0].cityFormation===pair[1].cityFormation'));assert.equal(P('guards.filter(e=>e.cityPost).length'),2);
const phase=P('pair[0].cityFormation.distance');probe('frameCount++;updateCityPatrol(pair[0]);updateCityPatrol(pair[1]);');assert(Math.abs(P('pair[0].cityFormation.distance')-phase-1.15)<1e-7);
probe('window.post=guards.find(e=>e.cityPost);post.x=post.cityPost.x;post.y=post.cityPost.y;updateCityPatrol(post);');assert(!P('post.isMoving'));
probe('player.x=post.x+180;player.y=post.y;frameCount+=((post.aiOffset-frameCount%10+10)%10);post.updateEnemy();');assert.equal(P('post.state'),'CHASE');
// Killed residents stay killed through serialization, streaming out and back.
probe('window.person=enemiesList.find(e=>e.isCityCivilian);window.key=person.cityPersonKey;person.takeDamage(1000);enemiesList=[];biomeState=JSON.parse(JSON.stringify(biomeState));frameCount+=21;refreshCityPeople(mgr,'+cx+','+cy+');');
assert(!P('enemiesList.some(e=>e.cityPersonKey===key)'));
// A face-up stunned resident keeps that head side after streaming/save reload.
probe(`person=enemiesList.find(e=>e.isCityCivilian);key=person.cityPersonKey;
  person.aimAngle=PI;person.isMoving=false;rememberFigureMotion(person,0,0);startPunchStun(person,0);
  for(let i=0;i<60;i++){frameCount++;advanceStun(person);}bankCityPerson(person);window.savedStunAge=person.stunPose.age;
  enemiesList=[];biomeState=JSON.parse(JSON.stringify(biomeState));frameCount+=21;refreshCityPeople(mgr,${cx},${cy});
  person=enemiesList.find(e=>e.cityPersonKey===key);`);
assert(P('person&&person.stunPose&&!person.stunPose.faceDown&&person.stunPose.age===savedStunAge&&person.stunPose.done'));
assert(P('person.stunPose.a===0&&person.stunPose.facing===PI&&person.stunPose.impulse===0'));
// Fallen people must also stop casting a standing-height light-rig shadow.
ctx.__material=mkG();const heightColors=[];let mat;
ctx.__material.fill=(...a)=>{mat=a;};ctx.__material.ellipse=(...a)=>heightColors.push({mat,a});
probe('GLRig.hgt=__material;GLRig.hw=600;activeBuildings=[];buildings=[];decor=[];allies=[];enemiesList=[];player.stunTimer=100;startPunchStun(player,0);player.stunPose.age=70;player.x=0;player.y=0;camX=-width/zoom/2;camY=-height/zoom/2;viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;glRigPaintHeight();');
assert(heightColors.some(p=>Math.abs(p.mat[0]-2/P('GLRIG_HEIGHT_MAX')*255)<1e-9&&p.a[2]>40),'stunned height remains standing');
console.log('City people passed: appearance coverage, local gunfire, panic gait, harmless AI, first-punch stun, fall/recovery, 180-frame guard, patrol formation/posts, residency and serialized casualties.');

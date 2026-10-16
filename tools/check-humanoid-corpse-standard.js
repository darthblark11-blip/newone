// Exercise the shared whole-body fall on every human identity, then actual
// blue-pistol/armored killshots. Observe game painters rather than copied art.
const assert=require('assert'),{ctx,probe}=require('./harness'),P=s=>probe('('+s+')');
const types=['NORMAL','FEMALE_PISTOL','NM0_ROOKIE','NM0_ROOKIE_F','MILITARY_NEUTRAL','NM0_GREY_FATIGUE','NM0_CITY_GUARD','ARMORED_STANDARD','AERIAL','AERIAL_PISTOL','MOLOTOV','SIA','DAD','FARMER_MALE','FARMER_FEMALE','COWBOY','COWGIRL','BANDIT','LOCAL_COP','VILLAGER_MALE','VILLAGER_FEMALE','CITY_CITIZEN_M','CITY_CITIZEN_F'];
let seed=4921;ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
 return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
probe(`isStoryMode=false;townsData={};startAtLevel(1);started=true;doTick=true;BIOME_ACTIVE=false;
 activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();player.x=player.y=10000;MAX_KILLS=totalKills;
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;setMeleeTool('NONE');`);
let matrix=[1,0,0,1,0,0],fill=[],stack=[],marks=[],heads=[],helmets=[],events=[],limb=-1,heldArm=-1,rig;
const originals={};for(const n of ['push','pop','translate','rotate','scale','fill','ellipse','arc','drawFigureHair','drawFallLimb','drawFallBone'])originals[n]=ctx[n];
const mul=u=>{const t=matrix;matrix=[t[0]*u[0]+t[2]*u[1],t[1]*u[0]+t[3]*u[1],t[0]*u[2]+t[2]*u[3],t[1]*u[2]+t[3]*u[3],t[0]*u[4]+t[2]*u[5]+t[4],t[1]*u[4]+t[3]*u[5]+t[5]];};
ctx.push=()=>{stack.push({matrix:[...matrix],fill});originals.push();};ctx.pop=()=>{assert(stack.length);({matrix,fill}=stack.pop());originals.pop();};
ctx.translate=(x,y)=>{mul([1,0,0,1,x,y]);originals.translate(x,y);};ctx.rotate=a=>{mul([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);originals.rotate(a);};
ctx.scale=(x,y=x)=>{mul([x,0,0,y,0,0]);originals.scale(x,y);};ctx.fill=(...a)=>{fill=a[0]&&a[0].levels?[...a[0].levels]:a;originals.fill(...a);};
ctx.ellipse=(...a)=>{assert(a.every(Number.isFinite));if(fill.join(',')==='91,1,223,220')marks.push([matrix[0]*a[0]+matrix[2]*a[1]+matrix[4],matrix[1]*a[0]+matrix[3]*a[1]+matrix[5]]);
 if(a[0]===0&&a[1]===0&&a[2]===rig.TL&&a[3]===rig.TW)events.push('torso');originals.ellipse(...a);};
ctx.arc=(...a)=>{if(a[0]===0&&a[1]===0&&a[2]===15&&a[3]===15&&fill[0]===20)helmets.push({x:matrix[4],y:matrix[5]});originals.arc(...a);};
ctx.drawFigureHair=(g,id,x,y,sway)=>{heads.push({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5],angle:Math.atan2(matrix[1],matrix[0])});originals.drawFigureHair(g,id,x,y,sway);};
ctx.drawFallLimb=(...a)=>{limb=a[3];originals.drawFallLimb(...a);limb=-1;};ctx.drawFallBone=(...a)=>{if(heldArm>=0&&limb===heldArm)events.push(a[7]?'fore':'upper');originals.drawFallBone(...a);};
ctx.__humanTarget={...ctx};let origins=0,holds=0;const heldTypes=new Set();
function draw(target=false){
 matrix=[1,0,0,1,0,0];fill=[];stack=[];marks=[];heads=[];helmets=[];events=[];limb=-1;
 rig=P('projectFallRig(c.bW,c.bH,c.fP)');heldArm=P('c.fall.hold?c.fall.hold.arm:-1');const before=seed;
 probe(target?'c.show(__humanTarget);':'c.show();');assert.equal(stack.length,0);assert.equal(seed,before,'drawing consumed random state');
 assert.equal(marks.length,1);const p=P('fatalWoundPoint(c)');assert(Math.hypot(p.x-marks[0][0],p.y-marks[0][1])<1e-8,'human spray missed its painted wound');origins++;
 assert.equal(heads.length,1);if(heldArm>=0){assert.deepEqual(events,P('c.fall.faceDown&&c.fP>.45')?['upper','fore','torso']:['torso','upper','fore']);holds++;}
 if(P('c.fP===1')){const yaw=P('figureFallYaw(c.fall,c.rag)'),x=P('c.x'),y=P('c.y');
  assert((heads[0].x-x)*Math.cos(yaw)+(heads[0].y-y)*Math.sin(yaw)>P('ragRig(c.bW,c.bH).TL*RAG_SCALE*.5'),'head buried inside torso');
  if(P('c.eT==="ARMORED_STANDARD"')){assert.equal(helmets.length,1);const scale=P('RAG_SCALE');assert(Math.hypot(helmets[0].x-heads[0].x-(Math.cos(yaw)*15-Math.sin(yaw)*10)*scale,helmets[0].y-heads[0].y-(Math.sin(yaw)*15+Math.cos(yaw)*10)*scale)<1e-8,'dropped armor helmet rolled with head');}}
}
for(const type of types)for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const back of [false,true])for(const moving of [false,true]){
 const facing=a+(back?Math.PI:0);
 probe(`frameCount++;corpses=[];particles=[];window.e=new Character(0,0,false,'${type}');e.aimAngle=${facing};e.moveAngle=${a};e.isMoving=${moving};rememberFigureMotion(e,${moving?`Math.cos(${a})*4,Math.sin(${a})*4`:'0,0'});
  window.w={x:-2,y:${back?7:-7},sz:3.3,col:[91,1,223,220],isBulletHole:true,isHead:false};e.decals=[w];
  e.fallHit={frame:frameCount,kind:'BODY',weapon:WEAPONS.PISTOL,angle:${moving?a+1:a},force:3,mx:e.motionX,my:e.motionY,wound:w,fatal:true};
  window.c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,0,0,e.decals,e.currentWeapon,0,e.eType,e.bodyW,e.bodyH,e);`);
 assert(P('c.rag&&c.fall'),type+' missed shared fall');assert.equal(P('c.fall.faceDown'),!back);assert.equal(P('c.fall.moving'),moving);
 assert(Math.abs(P(`Math.atan2(Math.sin(c.fall.a-(${a})),Math.cos(c.fall.a-(${a})))`))<1e-9);
 if(P('!!c.fall.hold'))heldTypes.add(type);
 let last=0;for(const age of [0,4,60]){probe(`for(let i=${last};i<${age};i++){frameCount++;c.update();}`);last=age;draw();draw(true);}
 assert(P('c.fP===1&&c.rag.done&&c.fall.done'));
 if(P('!!c.fall.hold')){const i=P('c.fall.hold.arm'),L=P(`c.rag.limbs[${i}]`),r=P('projectFallRig(c.bW,c.bH,1)'),w=P('c.fall.hold'),s=i?1:-1,a=s*(Math.PI/2+L.a),b=s*L.b;
  assert(Math.hypot(r.shX+Math.cos(a)*r.upper+Math.cos(a+b)*(r.fore+r.hand*.3)-w.x,s*r.shY+Math.sin(a)*r.upper+Math.sin(a+b)*(r.fore+r.hand*.3)-w.y)<r.hand*.55,type+' hand missed wound');}
}
for(const type of types)assert(heldTypes.has(type),type+' never held an ordinary wound');
// Real bullet deaths on the reported classes; armor is depleted before the
// fatal shot, as in gameplay. Death selection and damage remain unchanged.
let kills=0;
for(const type of ['NM0_ROOKIE','ARMORED_STANDARD'])for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const front of [false,true])for(const kind of ['BODY','HEAD']){
 const facing=a+(front?Math.PI:0);
 probe(`frameCount++;bullets=[];corpses=[];particles=[];headshotCounter=bodyOverkillCounter=0;MAX_KILLS=totalKills;
  window.e=new Character(60*Math.cos(${a}),60*Math.sin(${a}),false,'${type}');e.hp=1;e.aimAngle=${facing};e.isFriendly=e.isNeutral=e.isMoving=false;rememberFigureMotion(e,0,0);enemiesList=[e];
  spawnBullet(0,0,${a},true,'${kind}',WEAPONS.PISTOL,player);for(let i=0;i<12&&corpses.length===0;i++)updateBullets();window.c=corpses[0];`);
 assert(P('!!c&&!!c.fall'),type+' actual kill missed standard');assert.equal(P('c.fall.faceDown'),!front);assert.equal(P('c.fatalSpray.left'),210);
 const pos=P('[c.x,c.y]');probe('c.update();');assert((P('c.x')-pos[0])*Math.cos(a)+(P('c.y')-pos[1])*Math.sin(a)>0);kills++;
}
for(const [n,fn]of Object.entries(originals))ctx[n]=fn;
for(const type of types){probe(`window.e=new Character(0,0,false,'${type}');e.aimAngle=0;rememberFigureMotion(e,0,0);startPunchStun(e,PI);e.stunTimer=600;`);assert(P('e.stunPose&&e.stunPose.rag&&e.stunPose.duration===40'));probe('for(let i=0;i<20;i++)advanceStun(e);');assert(P('stunFall(e)<.5'));probe('for(let i=0;i<40;i++)advanceStun(e);window.c=new Corpse(e.x,e.y,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,0,0,[],e.currentWeapon,0,e.eType,e.bodyW,e.bodyH,e);');assert(P('c.fall.faceDown===e.stunPose.faceDown&&Math.abs(figureFallYaw(c.fall,c.rag)-figureFallYaw(e.stunPose,e.stunPose.rag))<1e-8'),'downed human pose changed at death');}
console.log(`Humanoid standard passed: ${types.length} human types in four directions, stationary/moving forward/back falls, ${origins} live/stamped wound origins, ${holds} held-arm layer observations, reachable holds on every type, heads outside torso, frozen rest, slow stuns/downed continuity on every type and ${kills} actual blue/armored body/head killshots.`);

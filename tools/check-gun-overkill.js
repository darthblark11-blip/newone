// Native firearm selection and the shared, bounded piece lifecycle. Canvas
// samples verify that clipped wounds remain on their actual moving body part.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const {figureCanvas}=require('./figure-canvas');
const P=s=>probe('('+s+')');
let checks=0,seed=49173;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
const near=(a,b)=>Math.abs(a-b)<1e-7;
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const u=seed/4294967296;
 return a===undefined?u:Array.isArray(a)?a[Math.floor(u*a.length)]:b===undefined?u*a:a+(b-a)*u;};
ctx.Math=Object.create(Math);ctx.Math.random=()=>ctx.random();
function stage(){
 probe(`currentLevel=currentBiome=2;BIOME_ACTIVE=false;isStoryMode=false;started=doTick=true;
  isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
  inOverworldView=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
  window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
  buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
  bullets=[];particles=[];corpses=[];enemiesList=[];invalidateColIndex();resetShovelState();resetForestWildlife();
  player=new Character(2000,2000,true);player.hp=10000;player.shield=0;
  totalKills=totalShotsHit=0;MAX_KILLS=100000;score=0;headshotCounter=bodyOverkillCounter=0;
  viewLeft=viewTop=-10000;viewRight=viewBottom=10000;deltaTime=1000/60;
  leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
  wipeAllBloodBanks();useBloodBank('gun-overkill-check');frameCount++;`);
}
function shot(weapon='SHOTGUN',cycle=0,kind='BODY',type='NORMAL',angle=0,moving=false,hp=1){
 stage();probe(`bodyOverkillCounter=headshotCounter=${cycle};
  window.e=new Character(60*Math.cos(${angle}),60*Math.sin(${angle}),false,'${type}');
  e.hp=e.maxHp=${hp};e.shield=0;e.isFriendly=e.isNeutral=false;e.aimAngle=e.moveAngle=${angle+Math.PI};
  e.isMoving=${moving};rememberFigureMotion(e,${moving?`Math.cos(${angle+Math.PI})*3,Math.sin(${angle+Math.PI})*3`:'0,0'});enemiesList=[e];
  window.round=spawnBullet(-Math.sin(${angle})*${kind==='LEGS'?6:0},Math.cos(${angle})*${kind==='LEGS'?6:0},
   ${angle},true,'${kind}',WEAPONS.${weapon},player);
  for(let i=0;i<12&&round.active;i++)updateBullets();window.c=corpses[0];`);
}
function make(dt=2,type='NORMAL',angle=0,moving=false,weapon=dt===10?'DUAL_SMG':'SHOTGUN'){
 probe(`frameCount++;particles=[];corpses=[];
  window.e=new Character(0,0,false,'${type}');e.aimAngle=${angle+Math.PI};e.moveAngle=${angle+Math.PI};e.isMoving=${moving};
  rememberFigureMotion(e,${moving?`Math.cos(${angle+Math.PI})*3,Math.sin(${angle+Math.PI})*3`:'0,0'});
  e.decals=[{x:0,y:0,sz:3.3,col:[251,1,225,255],isBulletHole:true}];
  e.fallHit={frame:frameCount,kind:'BODY',weapon:WEAPONS.${weapon},angle:${angle},force:weaponFallForce(WEAPONS.${weapon}),
   mx:e.motionX,my:e.motionY,wound:e.decals[0],fatal:true};
  window.c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,${dt},0,e.decals,
   e.currentWeapon,${angle},e.eType,e.bodyW,e.bodyH,e);`);
}
function advance(n){probe(`for(let i=0;i<${n};i++){frameCount++;c.update();}`);}
const physics=()=>P('JSON.stringify({parts:c.blast.parts,gibs:c.blast.gibs})');

for(const [weapon,cycle,id,mode]of [['SHOTGUN',0,2,'SLICE'],['SHOTGUN',1,7,null],['SHOTGUN',2,10,'BREAKUP'],['DUAL_SMG',0,10,'BREAKUP']]){
 shot(weapon,cycle);
 ok(`${weapon}/${cycle} retains its native death selector`,P(`c.dT===${id}&&${mode?`c.blast.mode==='${mode}'`:'!c.blast'}`));
 ok(`${weapon}/${cycle} awards one native death and kill`,P('corpses.length===1&&e.dead&&enemiesList.length===0&&totalKills===1&&totalShotsHit===1'));
}
for(const [weapon,damage]of [['SHOTGUN',25],['DUAL_SMG',20]]){
 shot(weapon,0,'BODY','NORMAL',0,false,1000);
 ok(weapon+' surviving hits keep their authored per-projectile body damage',P(`e.hp===${1000-damage}&&corpses.length===0&&totalKills===0`));
}
shot('SHOTGUN',0,'LEGS');
ok('a lethal physical leg hit can use the same body-overkill mode',P("c.dT===2&&c.blast.mode==='SLICE'&&c.dec[0].isLeg"));

const humans=['NORMAL','FEMALE_PISTOL','NM0_ROOKIE','NM0_ROOKIE_F','MILITARY_NEUTRAL','NM0_GREY_FATIGUE',
 'NM0_CITY_GUARD','ARMORED_STANDARD','AERIAL','AERIAL_PISTOL','MOLOTOV','SIA','DAD','FARMER_MALE','FARMER_FEMALE',
 'COWBOY','COWGIRL','BANDIT','LOCAL_COP','VILLAGER_MALE','VILLAGER_FEMALE','CITY_CITIZEN_M','CITY_CITIZEN_F'];
stage();
for(const type of humans)for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const moving of [false,true])for(const dt of [2,10]){
 make(dt,type,angle,moving);
 ok(`${type}/${dt}/${angle}/${moving} shares current whole-body proportions`,
  P("c.blast&&['TL','TW','headX','hipX','shX','shY','upper','fore','thigh','shin'].every(k=>c.blast.rig[k]===projectFallRig(c.bW,c.bH,1)[k])"));
 ok(`${type}/${dt}/${angle}/${moving} preserves the established motion-vs-stopped heading`,
  P(`Math.abs(Math.atan2(Math.sin(c.blast.heading-(${moving?angle+Math.PI:angle})),Math.cos(c.blast.heading-(${moving?angle+Math.PI:angle}))))<1e-7`));
 ok(`${type}/${dt}/${angle}/${moving} projects body fragments along incoming fire`,
  P(`c.blast.parts.every(p=>p.vx*Math.cos(${angle})+p.vy*Math.sin(${angle})>0)&&c.blast.gibs.every(p=>p.vx*Math.cos(${angle})+p.vy*Math.sin(${angle})>0)`));
 ok(`${type}/${dt}/${angle}/${moving} has a complete bounded anatomy`,
  P(`c.blast.parts.length===${dt===2?2:4}&&c.blast.parts.filter(p=>p.type==='gunUpper').length===1&&c.blast.parts.filter(p=>p.type==='gunLower').length===1&&c.blast.gibs.length===12&&!c.fall&&!c.fatalSpray`));
}

const slopes=new Set();
for(let i=0;i<24;i++){
 make(2);slopes.add(P('c.blast.cut.ny').toFixed(5));
 ok('randomized waist cut remains oblique and inside the current torso',
  P('Math.abs(c.blast.cut.ny)<.5&&c.blast.cut.x<0&&c.blast.cut.x>-c.blast.rig.TL*.5&&c.blast.cut.lo<0&&c.blast.cut.hi>0'));
}
ok('different impacts choose visibly distinct local slice angles',slopes.size>20);
make(2);const originalCut=P('JSON.stringify(c.blast.cut)');
probe('frameCount--;');make(2);
ok('the same impact frame and position reproduce the same cut',P('JSON.stringify(c.blast.cut)')===originalCut);

for(const dt of [2,10]){
 make(dt);advance(6);
 ok(dt+' upper body visibly lifts and travels away from impact',P('c.blast.parts.find(p=>p.type==="gunUpper").z>8&&c.blast.parts.find(p=>p.type==="gunUpper").x>30'));
 advance(54);
 ok(dt+' body pieces land after a brief flight and retain their floor positions',P('c.blast.parts.every(p=>p.landed&&p.z===0)&&c.blast.parts.find(p=>p.type==="gunUpper").x>60'));
 advance(36);const frozen=physics();advance(30);
 ok(dt+' body and small gibs stop moving by the bounded 96-tick settle',physics()===frozen&&P('c.blast.parts.concat(c.blast.gibs).every(p=>p.z===0&&p.vx===0&&p.vy===0&&p.vz===0&&p.vr===0)'));
 make(dt);let emitted=0,lastEmission=0;
 for(let age=1;age<=180;age++){
  probe('particles=[];frameCount++;c.update();');
  const count=P("particles.filter(p=>p.t==='HIT_BLOOD').length");emitted+=count;if(count)lastEmission=age;
  if(age===179)ok(dt+' remains live through the full three-second bleed',P('!c.blast.done&&c.bloodTimer===1&&!corpseSettled(c)'));
 }
 ok(dt+' cuts spray continuously at the native cadence through tick180',emitted===(dt===2?2:4)*2*60&&lastEmission===180);
 ok(dt+' completes exactly at 180 ticks and is ready for banking',P('c.blast.done&&c.bloodTimer===0&&c.blast.age===180&&corpseSettled(c)'));
 const final=P('JSON.stringify(c.blast)');probe('particles=[];');advance(30);
 ok(dt+' has no residual movement or blood after three seconds',P('JSON.stringify(c.blast)')===final&&P('particles.length===0'));
 make(dt);probe('corpses=[c];doTick=false;');const paused=P('JSON.stringify(c.blast)');
 probe('for(let i=0;i<20;i++){frameCount++;updateCorpses();}');
 ok(dt+' pauses the full ballistic and bleeding state',P('JSON.stringify(c.blast)')===paused);
 probe(`doTick=true;viewLeft=viewTop=10000;viewRight=viewBottom=11000;particles=[];
  for(let i=0;i<185;i++){frameCount++;updateCorpses();}`);
 ok(dt+' offscreen updates finish and stamp instead of abandoning the body',P('c.blast.done&&c.blast.parts.concat(c.blast.gibs).every(p=>p.z===0)&&corpses.length===0&&particles.length===0&&Object.keys(bloodChunks).length>0'));
 make(dt);advance(8);probe('corpses=[c];particles=[];retireCorpsesToBloodBank();');
 ok(dt+' travel finishes flying pieces on the floor before stamping',P('c.blast.done&&c.blast.parts.concat(c.blast.gibs).every(p=>p.z===0)&&corpses.length===0&&particles.length===0'));
}

// Real clipping distinguishes a visible wound from its duplicated draw call
// behind the opposite slice mask. Sample native Canvas pixels at the public
// wound origin and at the otherwise identical point on the wrong body half.
const surface=figureCanvas(800,800),g=surface.g,canvasContext=surface.c;
ctx.__gunCanvas=g;
const colors=[[251,1,225,255],[5,245,230,255],[245,235,7,255],[244,10,70,255]];
function hasColor(point,color){
 const x=Math.round(point.x),y=Math.round(point.y),data=canvasContext.getImageData(x-3,y-3,7,7).data;
 for(let i=0;i<data.length;i+=4)if(Math.abs(data[i]-color[0])<20&&Math.abs(data[i+1]-color[1])<20&&Math.abs(data[i+2]-color[2])<20&&data[i+3]>180)return true;
 return false;
}
for(const dt of [2,10])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const age of [0,18,96]){
 make(dt,'ARMORED_STANDARD',angle);advance(age);
 probe(`c.x=c.y=400;c.dec=[
  {x:3,y:2,sz:5,col:${JSON.stringify(colors[0])}},
  {x:-c.blast.rig.TL*.43,y:0,sz:5,col:${JSON.stringify(colors[1])}},
  {x:0,y:0,sz:5,isHead:true,col:${JSON.stringify(colors[2])}},
  {x:0,y:0,sz:5,isLeg:true,legIndex:0,legSegment:1,legU:.5,legV:0,col:${JSON.stringify(colors[3])}}
 ];`);
 const state=P('JSON.stringify(c.blast)'),beforeSeed=seed;
 canvasContext.resetTransform();canvasContext.clearRect(0,0,800,800);probe('c.show(__gunCanvas);');
 ok(`${dt}/${angle}/${age} painting balances transforms and leaves physics/randomness frozen`,surface.g.balanced()&&P('JSON.stringify(c.blast)')===state&&seed===beforeSeed);
 for(let i=0;i<4;i++){
  const actual=P(`fatalWoundPoint(c,c.dec[${i}])`),shared=P(`gunOverkillWoundPoint(c,c.dec[${i}])`);
  ok(`${dt}/${angle}/${age} wound${i} paints on its actual body piece`,near(actual.x,shared.x)&&near(actual.y,shared.y)&&hasColor(actual,colors[i]));
 }
 if(age>0)for(const i of [0,1]){
  const ghost=P(`gunOverkillPoint(c,c.blast.parts.find(p=>p.type==='${i===0?'gunLower':'gunUpper'}'),c.dec[${i}].x,c.dec[${i}].y)`);
  ok(`${dt}/${angle}/${age} opposite cap clips wound${i} instead of painting a ghost`,!hasColor(ghost,colors[i]));
 }
 const head=P('headWoundPoint(c)'),expected=P('gunOverkillWoundPoint(c,{x:0,y:0,isHead:true,shotA:c.hA||0})');
 ok(`${dt}/${angle}/${age} head hit helper follows the airborne head`,near(head.x,expected.x)&&near(head.y,expected.y));
}

// Visibility and stamps must include farthest parts, with their airborne
// height removed only after the simulated floor contact.
make(2);advance(18);
ok('piece reach grows beyond the old fixed corpse draw margin',P('blastCorpseReach(c,true)>150'));
probe(`window.upperPart=c.blast.parts.find(p=>p.type==="gunUpper");window.originalGunShow=c.show;
 window.gunPaintCalls=0;c.show=function(...a){gunPaintCalls++;return originalGunShow.apply(this,a);};
 viewLeft=c.x+upperPart.x-10;viewRight=viewLeft+20;viewTop=c.y+upperPart.y-upperPart.z-10;viewBottom=viewTop+20;
 corpses=[c];doTick=false;updateCorpses();c.show=originalGunShow;`);
ok('a detached airborne torso stays visible while its origin is outside the camera',P('gunPaintCalls>0'));

for(const weapon of ['SHOTGUN','DUAL_SMG'])for(const index of [0,1,2]){
 shot(weapon,index,'HEAD');
 ok(weapon+' headshot variant'+index+' retains its existing head-death path',P('!!c&&!c.blast?.mode'));
}
for(const type of ['ARMORED','ALIEN_GATOR','BUG','SNAIL','SNAIL_HYBRID','COW','HORSE','ROBOT']){
 stage();make(2,type);
 ok(type+' retains its nonhuman anatomy and death path',P('!c.blast?.mode'));
}
stage();make(2,'NORMAL',0,false,'PISTOL');
ok('unrelated firearm deaths do not enter heavy body overkill',P('!c.blast?.mode'));
probe("e.fallHit.kind='BLAST';delete e.fallHit.weapon;window.c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,2,0,[],e.currentWeapon,0,e.eType,e.bodyW,e.bodyH,e);");
ok('legacy explosion death IDs cannot accidentally become firearm slice modes',P('!c.blast?.mode'));
probe('window.c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,20,0,[],e.currentWeapon,0,e.eType,e.bodyW,e.bodyH,e);');
ok('existing modern explosion pieces keep their own 112-tick bleed tuning',P('!!c.blast&&!c.blast.mode&&c.bloodTimer===112'));

console.log(`${checks}/${checks} native firearm overkill selection, shared anatomy, flight, clipped wounds, bleeding and retirement checks passed.`);

// Real projectile contacts create caliber-tagged flesh wounds. The native
// painter is also observed through its actual transforms, not a copied rig.
const assert=require('node:assert/strict');
const {ctx,calls,mkG,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,seed=29171;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const u=seed/4294967296;
 return a===undefined?u:Array.isArray(a)?a[Math.floor(u*a.length)]:b===undefined?u*a:a+(b-a)*u;};
const groups={LIGHT:['PISTOL','SMG','DUAL_SMG'],MEDIUM:['ASSAULT_RIFLE','SHOTGUN','COACH_GUN'],HEAVY:['REVOLVER']};
function stage(type='NORMAL',hp=1000,isPlayer=false){
 probe(`currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
  isStoryMode=isPaused=isDead=isWin=killcamMode=false;
  inTownCutscene=inFortCutscene=inStoryIntro=inDarchonCall=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=false;
  inOverworldView=inTravelMenu=inWorldBuildingMenu=false;
  enemiesList=[];bullets=[];particles=[];corpses=[];barrels=[];activeBuildings=[];buildings=[];
  activeParkingCars=[];parkingCars=[];weaponDrops=[];healthPacks=[];floatingScores=[];
  resetForestWildlife();resetShovelState();invalidateColIndex();wipeAllBloodBanks();useBloodBank('caliber');
  frameCount++;player=new Character(-2000,-2000,true);player.hp=100000;player.shield=100;
  leftStick={active:false,dx:0,dy:0,dist:0,base:{x:80,y:640}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
  window.victim=new Character(200,200,${isPlayer},${JSON.stringify(type)});
  victim.hp=victim.maxHp=${hp};victim.shield=0;victim.aimAngle=victim.moveAngle=0;
  victim.isMoving=false;victim.isFriendly=victim.isNeutral=false;
  ${isPlayer?'player=victim;':'enemiesList=[victim];'}
  MAX_KILLS=100000;totalKills=totalShotsHit=0;nm0AmbushActive=farmAmbushActive=false;
  viewLeft=viewTop=-10000;viewRight=viewBottom=10000;`);
}
function shoot(weapon='PISTOL',aim='BODY',extra=''){
 probe(`window.round=spawnBullet(160,200,0,${P('!victim.isPlayer')},${JSON.stringify(aim)},${weapon.startsWith("'")?weapon:'WEAPONS.'+weapon},
  {x:0,y:200,isPlayer:${P('!victim.isPlayer')},isFriendly:false});${extra}
  for(let i=0;i<12&&round.active;i++)updateBullets();`);
}
for(const [tier,weapons]of Object.entries(groups))for(const weapon of weapons){
 ok(`${weapon} has the requested caliber classification`,P(`WEAPONS.${weapon}.caliber===${JSON.stringify(tier)}`));
 for(const aim of ['BODY','LEGS']){
  stage();const damage=P(`WEAPONS.${weapon}.bodyDmg`);shoot(weapon,aim);
  ok(`${weapon}/${aim} reaches flesh through actual pooled collision`,P('victim.decals.length===1&&!round.active&&victim.hp<1000'));
  ok(`${weapon}/${aim} keeps its native direct-contact damage`,P('victim.hp')===1000-damage);
  ok(`${weapon}/${aim} creates the correct immutable caliber metadata`,P(`victim.decals[0].fleshCaliber===${JSON.stringify(tier)}&&Number.isInteger(victim.decals[0].fleshSeed)&&victim.decals[0].fleshSeed>=0`));
  ok(`${weapon}/${aim} preserves original hole size, bullet direction and wound ownership`,P('victim.decals[0].sz>=4&&victim.decals[0].sz<7&&victim.decals[0].shotA===0&&victim.fallHit.wound===victim.decals[0]'));
  if(aim==='LEGS')ok(`${weapon} leg wound binds to a limb`,P('victim.decals[0].isLeg&&[0,1].includes(victim.decals[0].legIndex)&&Number.isFinite(victim.decals[0].legU)'));
 }
 stage();shoot(weapon,'HEAD');
 ok(`${weapon} head impact keeps its established decal`,P('victim.decals.length===1&&victim.decals[0].isHead&&!victim.decals[0].fleshCaliber'));
}
for(const weapon of ['BOW','TASER','ROCKET_LAUNCHER']){
 ok(`${weapon} is not assigned a bullet caliber`,P(`!WEAPONS.${weapon}.caliber`));
 stage();shoot(weapon);
 ok(`${weapon} stays outside flesh bullet-decal styling`,P('victim.decals.every(d=>!d.fleshCaliber)'));
}
for(const type of ['ARMORED','ARMORED_STANDARD','ROBOT','BUG','SNAIL','SNAIL_HYBRID','ALIEN_GATOR','COW','HORSE']){
 stage(type);shoot('PISTOL');
 ok(`${type} armor or nonhuman marks retain their existing style`,P('victim.decals.every(d=>!d.fleshCaliber)'));
}
stage('ARMORED_STANDARD',49);shoot('PISTOL');
ok('broken standard NM0 armor exposes caliber flesh wounds',P("victim.decals.length===1&&victim.decals[0].fleshCaliber==='LIGHT'"));
for(const type of ['NORMAL','FEMALE_PISTOL','NM0_ROOKIE','NM0_ROOKIE_F','COWBOY','LOCAL_COP']){
 stage(type);shoot('REVOLVER');
 ok(`${type} human clothing supports the heavy wound`,P("victim.decals[0].fleshCaliber==='HEAVY'"));
}
for(const laser of ['RED_LASER','PINK_LASER','ALIEN_LASER','ORANGE_BEAM']){
 stage();shoot("'"+laser+"'");
 ok(`${laser} cannot inherit the ordinary pistol's flesh caliber`,P('victim.decals.every(d=>!d.fleshCaliber)'));
}
stage('NORMAL',1000,true);probe('victim.shield=100;');shoot();
ok('shield-only damage does not mark flesh',P('victim.hp===1000&&victim.decals.length===0'));
stage('NORMAL',1000,true);probe('victim.shield=1;');shoot();
ok('shield overflow keeps the established suppressed-hole policy',P('victim.hp<1000&&victim.decals.length===0'));
stage('NORMAL',1000,true);probe('inTownCutscene=true;');shoot();
ok('immunity never creates a styled flesh wound',P('victim.hp===1000&&victim.decals.every(d=>!d.fleshCaliber)'));
stage();probe("resetActorStance(victim,'CROUCH');");shoot('PISTOL','BODY');
ok('crouched body-vector criticals retain their head impact style',P('victim.decals[0].isHead&&!victim.decals[0].fleshCaliber'));
stage();probe("resetActorStance(victim,'CROUCH');");shoot('PISTOL','LEGS');
ok('crouched low-vector wounds style the compressed torso, not a leg',P("victim.decals[0].fleshCaliber==='LIGHT'&&!victim.decals[0].isHead&&!victim.decals[0].isLeg"));
stage();probe("resetActorStance(victim,'PRONE');");shoot('PISTOL','LEGS');
ok('prone low-vector criticals retain their head impact style',P('victim.decals[0].isHead&&!victim.decals[0].fleshCaliber'));

// The saloon's isolated finite-shot activity has its own death entry point.
// Its body revolver mark shares the tier; a headshot still uses the old art.
for(const zone of ['BODY','HEAD']){
 stage('COWBOY',1);probe(`_frontierSaloonSession={duel:{corpses:[],effects:[]}};
  frontierQuickDrawDeath(victim,{tH:'${zone}',a:.4,shotId:987,x:200,y:200,vx:20,vy:0});`);
 ok(`quick-draw ${zone} keeps the local corpse and cosmetic policy`,P(`_frontierSaloonSession.duel.corpses.length===1&&
  ${zone==='BODY'?"_frontierSaloonSession.duel.corpses[0].dec.some(d=>d.fleshCaliber==='HEAVY')":"_frontierSaloonSession.duel.corpses[0].dec.every(d=>!d.fleshCaliber)"}`));
 probe('_frontierSaloonSession=null;');
}

// Helpers only add compact plain data. Copying an old wound or JSON-decoding
// one does not require rebuilding a canvas or carrying the original actor.
stage();
probe("window.legacyWound={x:2,y:-3,sz:6,col:[90,0,0,220],isHead:false,isBulletHole:true,shotA:.4};window.baseWound=JSON.stringify(legacyWound);");
const beforeSeed=seed;
probe('window.tagged=attachCaliberBodyDecal({...legacyWound},WEAPONS.REVOLVER,9871);');
ok('tagging leaves the source wound untouched',P('JSON.stringify(legacyWound)===baseWound'));
ok('tagging preserves every existing attachment field',P('Object.keys(legacyWound).every(k=>JSON.stringify(tagged[k])===JSON.stringify(legacyWound[k]))'));
ok('tagging consumes no combat randomness',seed===beforeSeed);
ok('new decal data is portable through plain JSON',P('JSON.stringify(JSON.parse(JSON.stringify(tagged)))===JSON.stringify(tagged)'));

// Observe a real drawing target, including the material layers, transforms,
// and numeric coordinates. A second paint must be identical and read-only.
function paintProbe(d,options={}){
 const g=mkG(),record=[],stack=[];let matrix=[1,0,0,1,0,0],ink=null;
 const mul=u=>{const t=matrix;matrix=[t[0]*u[0]+t[2]*u[1],t[1]*u[0]+t[3]*u[1],t[0]*u[2]+t[2]*u[3],t[1]*u[2]+t[3]*u[3],t[0]*u[4]+t[2]*u[5]+t[4],t[1]*u[4]+t[3]*u[5]+t[5]];};
 g.push=()=>stack.push({matrix:[...matrix],ink});g.pop=()=>{assert(stack.length);({matrix,ink}=stack.pop());};
 g.translate=(x,y)=>mul([1,0,0,1,x,y]);g.rotate=a=>mul([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);g.scale=(x,y=x)=>mul([x,0,0,y,0,0]);
 g.fill=(...a)=>{ink=a[0]&&a[0].levels?[...a[0].levels]:a;};g.noStroke=()=>{};
 for(const method of ['ellipse','triangle','line','vertex','curveVertex','rect','arc','quad'])g[method]=(...args)=>{
  assert(args.every(Number.isFinite),method+' received non-finite art');record.push({method,args,ink,matrix:[...matrix]});};
 ctx.__caliberPaint=g;ctx.__caliberDecal=d;
 probe(`drawBodyImpactDecal(__caliberPaint,__caliberDecal,${options.x??2},${options.y??-3},${options.size??6},${options.alpha??1},${options.rotation??0});`);
 assert.equal(stack.length,0,'wound painter leaked transform state');return record;
}
const originalRandom=ctx.random;
ctx.random=()=>{throw Error('decal painting rolled gameplay randomness');};
try{
 const geometry=[];
 for(const [tier,weapons]of Object.entries(groups))for(const aim of [0,.7,Math.PI]){
  probe(`window.tagged=attachCaliberBodyDecal({...legacyWound,shotA:${aim}},WEAPONS.${weapons[0]},67891);`);
  const d=P('tagged'),saved=JSON.stringify(d),a=paintProbe(d),b=paintProbe(d);
  assert.deepEqual(a,b,'a fixed wound changes while painting');checks++;
  ok(`${tier}/${aim} has ragged layered geometry beyond a red dot`,a.length>5&&a.some(p=>p.method==='vertex'||p.method==='triangle'));
  ok(`${tier}/${aim} paint is immutable`,JSON.stringify(d)===saved);
  if(!aim)geometry.push(JSON.stringify(a));
  assert.deepEqual(paintProbe(JSON.parse(saved)),a,'decoded wound painted differently');checks++;
 }
 ok('the three calibers have distinct native geometry',new Set(geometry).size===3);
 const fallback=paintProbe(P('legacyWound'));
 ok('legacy wounds still paint one exact ellipse',fallback.length===1&&fallback[0].method==='ellipse'&&fallback[0].args.join(',')==='2,-3,6,6');
 ok('legacy fallback retains its existing red and alpha',fallback[0].ink.join(',')==='90,0,0,220');
 probe('tagged=attachCaliberBodyDecal({...legacyWound},WEAPONS.REVOLVER,9871);');
 const tagged=P('tagged'),faded=paintProbe(tagged,{alpha:.5});
 ok('styled wounds fade every material layer with their corpse',faded.every(p=>p.ink[3]>0&&p.ink[3]<=110));
 ok('a fully transparent wound performs no shape painting',paintProbe(tagged,{alpha:0}).length===0);
 ok('an invalid zero-size wound performs no shape painting',paintProbe(tagged,{size:0}).length===0);
 probe("for(const caliber of ['LIGHT','MEDIUM','HEAVY'])for(let i=0;i<4000;i++)bodyImpactGeometry(caliber,i);");
 ok('many distinct shot seeds do not grow the geometry cache without bound',P('_bodyImpactGeometry.size<=96'));
 const extents=[];
 for(const weapon of ['PISTOL','ASSAULT_RIFLE','REVOLVER']){
  let extent=0;
  for(let variant=1;variant<=32;variant++){
   probe(`tagged=attachCaliberBodyDecal({...legacyWound,shotA:.41},WEAPONS.${weapon},${variant});`);
   const geometry=paintProbe(P('tagged'),{x:0,y:0});
   for(const p of geometry){
    const pairs=p.method==='vertex'?[p.args]:p.method==='triangle'?[p.args.slice(0,2),p.args.slice(2,4),p.args.slice(4,6)]:[];
    for(const[x,y]of pairs){const m=p.matrix,r=Math.hypot(m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]);
     assert(r<6,'a caliber wound grew beyond its compact body footprint');extent=Math.max(extent,r);}
   }
  }extents.push(extent);
 }
 ok('heavier tiers visibly enlarge their full wound footprint',extents[0]<extents[1]&&extents[1]<extents[2]);
}finally{ctx.random=originalRandom;}

// The actual corpse's transforms place its wound exactly where the fatal
// stream originates. The shared helper is observed only at its call boundary.
const savedFns={},paintMarks=[];let m=[1,0,0,1,0,0],matStack=[];
const mul=u=>{const t=m;m=[t[0]*u[0]+t[2]*u[1],t[1]*u[0]+t[3]*u[1],t[0]*u[2]+t[2]*u[3],t[1]*u[2]+t[3]*u[3],t[0]*u[4]+t[2]*u[5]+t[4],t[1]*u[4]+t[3]*u[5]+t[5]];};
for(const n of ['push','pop','translate','rotate','scale','drawBodyImpactDecal'])savedFns[n]=ctx[n];
ctx.push=(...a)=>{matStack.push([...m]);return savedFns.push(...a);};
ctx.pop=(...a)=>{assert(matStack.length);m=matStack.pop();return savedFns.pop(...a);};
ctx.translate=(x,y)=>{mul([1,0,0,1,x,y]);return savedFns.translate(x,y);};
ctx.rotate=a=>{mul([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);return savedFns.rotate(a);};
ctx.scale=(x,y=x)=>{mul([x,0,0,y,0,0]);return savedFns.scale(x,y);};
ctx.drawBodyImpactDecal=(g,d,x=d.x,y=d.y,...a)=>{
 if(d.fleshSeed===9871)paintMarks.push({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
 return savedFns.drawBodyImpactDecal(g,d,x,y,...a);
};
try{
 for(const stance of ['STAND','CROUCH','PRONE'])for(const leg of [false,true])for(const playerTarget of [false,true]){
  stage('NORMAL',1000,playerTarget);shoot('PISTOL',leg?'LEGS':'BODY');
  probe(`victim.decals[0].fleshSeed=9871;resetActorStance(victim,'${stance}');
   victim.isArmed=true;victim.currentWeapon=WEAPONS.PISTOL;victim.meleeTimer=0;victim.reloadTimer=0;`);
  m=[1,0,0,1,0,0];matStack=[];paintMarks.length=0;const decalBefore=P('JSON.stringify(victim.decals)');
  probe('victim.show();');
  ok(`${playerTarget?'player':'NPC'}/${stance}/${leg?'leg':'body'} paints the caliber wound on its live figure`,paintMarks.length===1);
  ok(`${playerTarget?'player':'NPC'}/${stance}/${leg?'leg':'body'} preserves its decal while painting`,P('JSON.stringify(victim.decals)')===decalBefore&&matStack.length===0);
 }
 for(const dt of [0,2,3,5,7,10,11,13,14])for(const age of [0,7,40,160])for(const target of [false,true]){
  stage();probe(`window.e=new Character(0,0,false,'NORMAL');e.aimAngle=-.8;e.moveAngle=.7;e.isMoving=true;
   rememberFigureMotion(e,Math.cos(.7)*4,Math.sin(.7)*4);
   window.w=attachCaliberBodyDecal({x:3.1,y:-2.7,sz:6.1,col:[90,0,0,220],isHead:false,isBulletHole:true,shotA:.3},WEAPONS.REVOLVER,9871);e.decals=[w];
   e.fallHit={frame:frameCount,kind:'BODY',weapon:WEAPONS.SHOTGUN,angle:-.4,force:6,mx:e.motionX,my:e.motionY,x:0,y:0,fatal:true,wound:w};
   window.c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,${dt},.3,e.decals,e.currentWeapon,-.4,e.eType,e.bodyW,e.bodyH,e);
   for(let i=0;i<${age};i++){frameCount++;c.update();}`);
  m=[1,0,0,1,0,0];matStack=[];paintMarks.length=0;
  if(target){ctx.__caliberTarget={...ctx};probe('c.show(__caliberTarget);');}else probe('c.show();');
  assert.equal(matStack.length,0);assert.equal(paintMarks.length,1,`dT${dt}/${age}: wound did not use shared painter exactly once`);
  const wound=P('fatalWoundPoint(c)');
  ok(`dT${dt}/${age}/${target} keeps the wound center on its fatal stream`,Math.hypot(paintMarks[0].x-wound.x,paintMarks[0].y-wound.y)<1e-7);
 }
 for(const dt of [0,7])for(const age of [0,7,40])for(const target of [false,true]){
  stage();shoot('REVOLVER','LEGS');
  probe(`victim.decals[0].fleshSeed=9871;victim.hp=0;victim.fallHit.fatal=true;
   window.c=new Corpse(victim.x,victim.y,victim.moveAngle,victim.aimAngle,victim.shirtCol,victim.pantsCol,
    ${dt},0,victim.decals,victim.currentWeapon,0,victim.eType,victim.bodyW,victim.bodyH,victim);
   for(let i=0;i<${age};i++){frameCount++;c.update();}`);
  m=[1,0,0,1,0,0];matStack=[];paintMarks.length=0;
  if(target){ctx.__caliberTarget={...ctx};probe('c.show(__caliberTarget);');}else probe('c.show();');
  assert.equal(matStack.length,0);assert.equal(paintMarks.length,1,'leg corpse wound was not painted once');
  const wound=P('fatalWoundPoint(c)');
  ok(`leg dT${dt}/${age}/${target} retains its painted shin attachment and fatal origin`,Math.hypot(paintMarks[0].x-wound.x,paintMarks[0].y-wound.y)<1e-7);
 }
}finally{for(const[n,fn]of Object.entries(savedFns))ctx[n]=fn;}
console.log(`${checks}/${checks} caliber body-decal classification, native contacts, exclusions, immutable paint and fatal attachment checks passed.`);

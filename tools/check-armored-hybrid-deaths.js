// Compare the red-orb hybrid's complete corpse state and real painters with
// the game before it was mistakenly included in the humanoid fall update.
// ARMORED_LEGACY_GAME=/path/to/previous-game.js node tools/check-armored-hybrid-deaths.js
const assert=require('assert'),fs=require('fs'),crypto=require('crypto');
const {execFileSync}=require('child_process'),{ctx,probe}=require('./harness');
const P=s=>probe('('+s+')'),digest=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
let seed=1739;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
 return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
ctx.Math=Object.create(Math);ctx.Math.random=()=>ctx.random();
probe(`isStoryMode=false;townsData={};startAtLevel(1);started=true;doTick=true;BIOME_ACTIVE=false;
 activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();player.x=player.y=10000;
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;setMeleeTool('NONE');`);
assert.equal(P('ragHumanoid("ARMORED",105)'),false,'red-orb hybrid entered human anatomy');
assert.equal(P('ragHumanoid("ARMORED_STANDARD",21)'),true,'pistol armor lost human anatomy');
// The requested back-art removal is the sole difference from this baseline.
// Only the old worker omits that cosmetic layer; the current painter is real.
const bareBaseline=process.argv.includes('--bare-baseline');
if(bareBaseline){const attire=ctx.drawFallenAttire;ctx.drawFallenAttire=(g,id,...a)=>{if(id.eType!=='ARMORED')attire(g,id,...a);};}
let trace=[],recording=false,depth=0;
for(const n of ['push','pop','translate','rotate','scale','fill','stroke','noFill','noStroke','strokeWeight','ellipse','rect','arc','line','quad','triangle','beginShape','vertex','curveVertex','endShape','image']){
 const fn=ctx[n];ctx[n]=(...args)=>{if(recording){if(n==='push')depth++;if(n==='pop')assert(--depth>=0,'unbalanced hybrid painter');
  trace.push([n,args.map(v=>v&&v.levels?[...v.levels]:v)]);}return fn(...args);};
}
ctx.__hybridTarget={...ctx};
function paint(code){trace=[];depth=0;const before=seed;recording=true;probe(code);recording=false;
 if(bareBaseline&&code.startsWith('c.show')&&P('c.dT===7')){for(let i=trace.length-1;i>0;i--){const [n,a]=trace[i];if(n==='ellipse'&&a[0]===0&&a[1]===0&&Math.abs(a[2]-48.6)<1e-9&&Math.abs(a[3]-100.8)<1e-9){assert.equal(trace[i-1][0],'fill');trace.splice(i-1,2);}}}
 assert.equal(depth,0);assert.equal(seed,before,'hybrid drawing consumed randomness');return trace;}
function snapshot(label){
 assert(P('!c.rag&&!c.fall&&!c.spray&&!c.headSpatter'),'hybrid acquired directional limbs, head roll or clothing spray');
 const state=JSON.parse(P('JSON.stringify({corpse:c,particles,bloodPools})'));
 const live=paint('c.show();'),stamp=paint('c.show(__hybridTarget);');
 return {label,hash:digest([state,live,stamp,seed]),liveCalls:live.length,stampCalls:stamp.length};
}
const rows=[];
// All death selectors, weapon reactions, facing/motion combinations, early
// collapse, settled bodies, separated pieces and the final fatal-spray tick.
for(let type=0;type<16;type++)for(const weapon of ['PISTOL','SHOTGUN','DUAL_SMG'])for(const moving of [false,true])for(const front of [false,true]){
 seed=1739;
 const a=-Math.PI/2,facing=a+(front?Math.PI:0),head=[1,4,6,8,9,12].includes(type);
 probe(`frameCount=1000;corpses=[];particles=[];bloodPools=[];_particlePool.length=0;
  window.e=new Character(0,0,false,'ARMORED');e.aimAngle=${facing};e.moveAngle=${a};e.isMoving=${moving};rememberFigureMotion(e,0,${moving?-4:0});
  window.w={x:-2,y:7,sz:3.3,col:[91,1,223,220],isHead:${head},isBulletHole:true};e.decals=[w];
  e.fallHit={frame:frameCount,kind:'${head?'HEAD':'BODY'}',weapon:WEAPONS.${weapon},angle:${a},force:weaponFallForce(WEAPONS.${weapon}),mx:e.motionX,my:e.motionY,wound:w,fatal:true};
  window.c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,${type},.7,e.decals,e.currentWeapon,${a},e.eType,e.bodyW,e.bodyH,e);`);
 let last=0;
 for(const age of [0,4,7,34,60,210]){probe(`for(let i=${last};i<${age};i++){frameCount++;c.update();}`);last=age;
  rows.push(snapshot(`${type}/${weapon}/${moving?'moving':'standing'}/${front?'front':'rear'}/${age}`));}
}
// Real fatal body/head bullets on the reported enemy in each map direction.
let kills=0;
for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const front of [false,true])for(const kind of ['BODY','HEAD']){
 seed=1739;
 probe(`frameCount=1000;bullets=[];corpses=[];particles=[];bloodPools=[];_particlePool.length=0;headshotCounter=bodyOverkillCounter=0;MAX_KILLS=totalKills;
  window.e=new Character(60*Math.cos(${a}),60*Math.sin(${a}),false,'ARMORED');e.hp=1;e.aimAngle=${a+(front?Math.PI:0)};e.isFriendly=e.isNeutral=e.isMoving=false;rememberFigureMotion(e,0,0);enemiesList=[e];
  spawnBullet(0,0,${a},true,'${kind}',WEAPONS.PISTOL,player);for(let i=0;i<12&&corpses.length===0;i++)updateBullets();window.c=corpses[0];`);
 assert(P('!!c'),'actual hybrid kill did not create a corpse');assert.equal(P('c.fatalSpray.left'),210);
 probe('for(let i=0;i<60;i++){frameCount++;c.update();}');rows.push(snapshot(`actual/${a}/${front}/${kind}`));kills++;
}
// The hybrid also stays out of the slow humanoid punch rig.
seed=1739;probe(`window.e=new Character(0,0,false,'ARMORED');e.aimAngle=0;rememberFigureMotion(e,0,0);startPunchStun(e,PI);`);
for(const age of [0,20,60]){probe(`if(${age})for(let i=0;i<${age===20?20:40};i++)advanceStun(e);`);
 assert(P('!e.stunPose'),'hybrid acquired a human stun pose');
 const state=P('[e.x,e.y,e.stunTimer,e.state]'),draw=paint('e.show();');rows.push({label:`stun/${age}`,hash:digest([state,draw,seed]),liveCalls:draw.length});}
if(process.argv.includes('--snapshot'))process.stdout.write(JSON.stringify(rows));
else{
 if(process.env.ARMORED_LEGACY_GAME){
  assert(fs.existsSync(process.env.ARMORED_LEGACY_GAME));
  const old=JSON.parse(execFileSync(process.execPath,[__filename,'--snapshot','--bare-baseline'],{env:{...process.env,GAME_JS:process.env.ARMORED_LEGACY_GAME},maxBuffer:4*1024*1024}));
  assert.equal(rows.length,old.length);for(let i=0;i<rows.length;i++)assert.deepStrictEqual(rows[i],old[i],`red-orb hybrid changed at ${rows[i].label}`);
  console.log(`Legacy hybrid comparison passed: ${rows.length} complete state/painting snapshots match the pre-update version with its requested back-art removal.`);
 }
 console.log(`Red-orb hybrid checks passed: all 16 death forms, original anatomy/collapse on live and stamped targets, ${kills} actual body/head killshots and exclusion from the humanoid punch rig. NMO pistol armor retains the shared rig.`);
}

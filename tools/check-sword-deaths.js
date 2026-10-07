// Real sword strikes/finishers and independent painted-edge/emitter checks.
const assert=require('assert'),{ctx,probe}=require('./harness'),P=s=>probe('('+s+')');
let seed=1309;ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const u=seed/4294967296;
 return a===undefined?u:Array.isArray(a)?a[Math.floor(u*a.length)]:b===undefined?u*a:a+(b-a)*u;};
probe(`isStoryMode=false;townsData={};startAtLevel(1);started=true;doTick=true;BIOME_ACTIVE=false;
 buildings=[];activeBuildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();MAX_KILLS=totalKills;
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 swordPickedUp=window.pickaxeOwned=true;setMeleeTool('SWORD');swordKillCounter=0;`);
function strike(type='NORMAL',hp=1,tool='SWORD'){
 probe(`frameCount++;enemiesList=[];corpses=[];particles=[];player.x=player.y=0;player.hp=100;player.dead=false;player.dashTimer=0;player.aimAngle=0;player.meleeTimer=11;player.meleePhase=1;player.isArmed=false;player.meleeCharge=0;
  setMeleeTool('${tool}');window.e=new Character(45,0,false,'${type}');e.hp=${hp};e.isFriendly=e.isNeutral=false;enemiesList=[e];player.updatePlayer();window.c=corpses[0];`);
 return P('c&&c.dT');
}
const heads=P('headshotCounter'),overkill=P('bodyOverkillCounter');
for(const dt of [16,13,17,16,13,17,16])assert.equal(strike(),dt,'sword deaths did not repeat in order');
assert.equal(P('headshotCounter'),heads);assert.equal(P('bodyOverkillCounter'),overkill);
let next=P('swordKillCounter');assert.equal(strike('NORMAL',500),undefined);assert.equal(P('swordKillCounter'),next,'nonfatal strike consumed a death');
assert.equal(strike('NORMAL',1,'PICKAXE'),3);assert.equal(P('swordKillCounter'),next,'pickaxe consumed sword sequence');
assert.equal(strike('ARMORED'),3);assert(P('!c.sword&&!c.rag'));assert.equal(P('swordKillCounter'),next,'red-orb hybrid entered sword sequence');
probe(`setMeleeTool('SWORD');enemiesList=[];player.meleeTimer=11;player.updatePlayer();`);assert.equal(P('swordKillCounter'),next,'miss consumed a death');
// Finisher ownership is frozen when launched, even if the tool changes later.
probe(`player.x=player.y=0;player.aimAngle=0;player.meleeTimer=16;player.meleePhase=4;shockwaves=[];player.updatePlayer();window.wave=shockwaves[0];setMeleeTool('PICKAXE');
 enemiesList=[new Character(wave.x+30,wave.y,false,'ARMORED_STANDARD')];enemiesList[0].hp=1;corpses=[];wave.update();window.c=corpses[0];`);
assert(P('wave.sword&&!!c.sword'));assert.equal(P('c.dT'),[16,13,17][next]);next=P('swordKillCounter');
probe(`enemiesList=[new Character(30,0,false,'NORMAL')];enemiesList[0].hp=1;corpses=[];new Shockwave(0,0,0,false).update();`);assert.equal(P('swordKillCounter'),next);
// Existing gun deaths retain their own selectors and counters.
probe(`frameCount++;setMeleeTool('NONE');enemiesList=[new Character(60,0,false,'NORMAL')];enemiesList[0].hp=1;corpses=[];bullets=[];spawnBullet(0,0,0,true,'HEAD',WEAPONS.PISTOL,player);for(let i=0;i<12&&!corpses.length;i++)updateBullets();window.c=corpses[0];`);
assert(P('!!c&&!c.sword'));assert.equal(P('swordKillCounter'),next);
let matrix=[1,0,0,1,0,0],stack=[],fill=[],marks=[];
const originals={};for(const n of ['push','pop','translate','rotate','scale','fill','ellipse'])originals[n]=ctx[n];
const mul=u=>{const t=matrix;matrix=[t[0]*u[0]+t[2]*u[1],t[1]*u[0]+t[3]*u[1],t[0]*u[2]+t[2]*u[3],t[1]*u[2]+t[3]*u[3],t[0]*u[4]+t[2]*u[5]+t[4],t[1]*u[4]+t[3]*u[5]+t[5]];};
ctx.push=()=>{stack.push({matrix:[...matrix],fill});originals.push();};ctx.pop=()=>{assert(stack.length);({matrix,fill}=stack.pop());originals.pop();};
ctx.translate=(x,y)=>{mul([1,0,0,1,x,y]);originals.translate(x,y);};ctx.rotate=a=>{mul([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);originals.rotate(a);};ctx.scale=(x,y=x)=>{mul([x,0,0,y,0,0]);originals.scale(x,y);};
ctx.fill=(...a)=>{fill=a[0]&&a[0].levels?[...a[0].levels]:a;originals.fill(...a);};ctx.ellipse=(...a)=>{assert(a.every(Number.isFinite));
 if(a[2]===2.4&&a[3]===2.4&&fill.slice(0,3).join(',')==='90,0,0')marks.push({x:matrix[0]*a[0]+matrix[2]*a[1]+matrix[4],y:matrix[1]*a[0]+matrix[3]*a[1]+matrix[5]});originals.ellipse(...a);};
ctx.__swordTarget={...ctx};let origins=0;
function paint(target){matrix=[1,0,0,1,0,0];stack=[];marks=[];const before=seed;probe(target?'c.show(__swordTarget);':'c.show();');assert.equal(stack.length,0);assert.equal(seed,before,'sword drawing consumed randomness');
 const cuts=P('c.fatalSpray.cuts');assert.equal(marks.length,cuts.length);
 for(let i=0;i<cuts.length;i++){const p=P(`swordCutPoint(c,c.fatalSpray.cuts[${i}])`);assert(Math.hypot(p.x-marks[i].x,p.y-marks[i].y)<1e-8,'cut spray missed the actual painted edge');origins++;}}
for(const type of ['NORMAL','NM0_ROOKIE','NM0_ROOKIE_F','ARMORED_STANDARD','FEMALE_PISTOL','CITY_CITIZEN_F'])for(let dt=0;dt<3;dt++)for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const front of [false,true]){
 probe(`frameCount++;swordKillCounter=${dt};window.e=new Character(0,0,false,'${type}');e.aimAngle=${a+(front?Math.PI:0)};rememberFigureMotion(e,0,0);window.c=swordKillCorpse(e,${a});`);
 assert(P('!!c.sword&&!!c.fall&&!!c.rag'));assert.equal(P('c.fall.faceDown'),!front);
 let last=0;for(const age of [0,4,60]){probe(`for(let i=${last};i<${age};i++){frameCount++;c.update();}`);last=age;paint(false);paint(true);}
 assert(P('c.sword.done&&c.fall.done&&c.rag.done'));const rest=P('JSON.stringify(c.sword.parts)');probe('for(let i=0;i<20;i++)c.update();');assert.equal(P('JSON.stringify(c.sword.parts)'),rest,'settled cut pieces kept moving');
}
for(const [n,fn]of Object.entries(originals))ctx[n]=fn;
// Both cut faces jet outward and share the exact existing 3.5-second cutoff.
for(let dt=0;dt<3;dt++){
 probe(`frameCount++;swordKillCounter=${dt};window.e=new Character(0,0,false,'NM0_ROOKIE');rememberFigureMotion(e,0,0);window.c=swordKillCorpse(e,0);particles=[];`);
 const jets=P('c.fatalSpray.cuts.length');
 for(let i=0;i<210;i++){probe('frameCount++;c.update();');assert.equal(P('c.fatalSpray.left'),209-i);}
 assert.equal(P('particles.filter(p=>p.t==="WOUND_BLOOD").length'),jets*105);probe('c.update();');assert.equal(P('particles.filter(p=>p.t==="WOUND_BLOOD").length'),jets*105);
}
probe(`frameCount++;swordKillCounter=2;window.e=new Character(0,0,false,'ARMORED_STANDARD');window.c=swordKillCorpse(e,0);corpses=[c];viewLeft=viewTop=-1000;viewRight=viewBottom=1000;doTick=false;`);
const paused=P('JSON.stringify([c.fP,c.sword.parts,c.fatalSpray.left])');probe('updateCorpses();');assert.equal(P('JSON.stringify([c.fP,c.sword.parts,c.fatalSpray.left])'),paused);
probe('doTick=true;viewLeft=viewTop=10000;viewRight=viewBottom=11000;for(let i=0;i<230&&corpses.length;i++){frameCount++;updateCorpses();}');assert.equal(P('corpses.length'),0,'off-screen sword corpse never retired');
// Saving keeps the next sword death; older saves start at decapitation.
let slot=null;ctx.localStorage={getItem:()=>slot,setItem:(k,v)=>slot=v,removeItem:()=>slot=null};
probe('swordKillCounter=2;saveGame();swordKillCounter=0;loadGame();');assert.equal(P('swordKillCounter'),2);
const legacy=JSON.parse(slot);delete legacy.swordKillCounter;slot=JSON.stringify(legacy);probe('loadGame();');assert.equal(P('swordKillCounter'),0);
console.log(`Sword deaths passed: repeating real strike/finisher kills; misses, nonfatal hits, pickaxes, guns and hybrids excluded; ${origins} independently painted cut origins; both cut faces; frozen pieces; 210-tick spray; pause/off-screen retirement and save/load continuity.`);

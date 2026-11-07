// Exact gameplay comparisons for the battle broad phase and reused crowd bins.
// The reference is the published version before these optimizations, not an
// alternate implementation of the new grid. Override with CROWD_BASELINE_JS.
// Run: node tools/check-battle-crowd.js
const assert = require('assert');
const fs = require('fs');
const { execFileSync } = require('child_process');
const baseline = process.env.CROWD_BASELINE_JS
  ? fs.readFileSync(process.env.CROWD_BASELINE_JS, 'utf8')
  : execFileSync('git', ['show', '3787c16:game.js'], { cwd: __dirname + '/..', maxBuffer: 8e6 }).toString();
const between = (start, end) => {
  const a = baseline.indexOf(start), b = baseline.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, 'published reference markers exist');
  return baseline.slice(a, b).trim();
};
const originalLOS = between('function hasLOS(', '// ---------------------------------------------------------------------------\n// WADING');
const originalSteer = between('function steerAvoid(', 'function pickHead(');
const originalCol = between('checkCol(nx, ny) {', 'forceNudge() {').replace(/^checkCol\(/, 'function(');
const originalEntities = between('function updateEntities() {', 'function maintainHostiles() {');
let checks = 0, comparisons = 0;
const ok = (condition, label) => { checks++; assert(condition, label); console.log('  ok   ' + label); };
function harness() {
  delete require.cache[require.resolve('./harness')];
  const h = require('./harness');
  let seed = 48271, calls = 0;
  function next() { calls++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }
  h.ctx.random = (a, b) => {
    const n = next();
    if (a === undefined) return n;
    if (Array.isArray(a)) return a[Math.floor(n * a.length)];
    return b === undefined ? n * a : a + n * (b - a);
  };
  h.ctx.Math = Object.create(Math); h.ctx.Math.random = next;
  h.ctx.Date = class extends Date { static now() { return 1700000000000; } };
  h.ctx.setTimeout = () => 0;
  h.randomCalls = () => calls;
  h.seed = n => { seed = n; calls = 0; };
  h.probe(`window.__oldLOS=(${originalLOS}\n);window.__oldSteer=(${originalSteer}\n);
    window.__oldCol=(${originalCol}\n);window.__oldEntities=(${originalEntities}\n);
    window.__newCol=Character.prototype.checkCol;`);
  return h;
}
const h = harness(), { ctx, probe } = h;
const P = s => probe('(' + s + ')');
let fixtureSeed = 96231;
function rand() { fixtureSeed = (Math.imul(fixtureSeed, 1664525) + 1013904223) >>> 0; return fixtureSeed / 4294967296; }
function world() {
  const flags = ['isBlockBuilding','isCropField','isMarket','isFence','isPalm','isAlienPlant',
    'isEnergyPole','isGrassLot','isCar','isRiver','isDeck','isUBarrier'];
  const walls = [], cars = [], drums = [];
  for (let i = 0; i < 400; i++) {
    walls.push({ x: rand()*8000-4000, y: rand()*8000-4000, w: 30+rand()*280, h: 30+rand()*280,
      [flags[i % flags.length]]: true });
    cars.push({ x: rand()*8000-4000, y: rand()*8000-4000 });
    drums.push({ x: rand()*8000-4000, y: rand()*8000-4000 });
  }
  walls.push({x:0,y:600,w:9600,h:100,isGovFortress:true},
    {x:0,y:-600,w:9600,h:100,isGovFortress:true},
    {x:600,y:0,w:200,h:300,isUBarrier:true},
    {x:20000,y:20000,w:100,h:100,isBlockBuilding:true});
  probe(`buildings=${JSON.stringify(walls)};activeBuildings=buildings.slice(0,-1);
    activeParkingCars=${JSON.stringify(cars)};barrels=${JSON.stringify(drums)};
    buildings.push({x:0,y:0},{x:100,y:100,w:-50,h:50},{x:NaN,y:0,w:40,h:40},
      {x:1000,y:1000,w:Infinity,h:20});
    invalidateCrowdSolids();buildColIndex();`);
}
world();
const types = ['NORMAL','ARMORED','ARMORED_STANDARD','NM0_ROOKIE','ALIEN_GATOR','SNAIL_HYBRID',
  'BUG','SNAIL','AERIAL','AERIAL_PISTOL','SAUCER','SAUCER_RED'];
const oldLOS = ctx.__oldLOS, oldCol = ctx.__oldCol, newCol = ctx.__newCol;
for (let level = 1; level <= 7; level++) {
  probe(`currentLevel=${level};currentBiome=${level};nm0AmbushActive=false;
    window.nm0AmbushClearedStatus=false;window.southGateBreachedStatus=false;
    window.undercitySouthBreached=false;window.undercityNorthBreached=false;frameCount++;`);
  for (const type of types) {
    const e = { eType: type, ignoreBldgTimer: 0, isCityCivilian: false };
    for (let i = 0; i < 350; i++) {
      const x = rand()*8500-4250, y = rand()*8500-4250;
      comparisons++; assert.strictEqual(newCol.call(e,x,y),oldCol.call(e,x,y),`body ${level}/${type}/${i}`);
    }
  }
  for (let i = 0; i < 450; i++) {
    const x=rand()*8000-4000,y=rand()*8000-4000,a=rand()*Math.PI*2,r=rand()*1800;
    const ray=[x,y,x+Math.cos(a)*r,y+Math.sin(a)*r];
    comparisons++; assert.strictEqual(ctx.hasLOS(...ray),oldLOS(...ray),`sight ${level}/${i}`);
  }
  ok(true, `Level ${level}: original collision and sampled LOS match`);
}
const boundaries = [
  [0,540,0,660],[-300,500,-300,700],[300,500,300,700],[-299.999,500,-299.999,700],
  [0,-650,0,-550],[500,-200,500,200],[20000,19900,20000,20100],
  [-40000,-40000,40000,40000],[NaN,0,0,0]
];
for (const open of [false,true]) {
  probe(`currentLevel=1;window.southGateBreachedStatus=${open};frameCount++;`);
  for (const ray of boundaries) {
    comparisons++; assert.strictEqual(ctx.hasLOS(...ray),oldLOS(...ray),`boundary sight ${ray}/${open}`);
  }
  for (const [x,y] of [[0,600],[-300,600],[300,600],[-299.999,600],[480,0],[500,0],[600,0],[700,0]]) {
    for (const type of types) {
      const e={eType:type,ignoreBldgTimer:0};
      comparisons++; assert.strictEqual(newCol.call(e,x,y),oldCol.call(e,x,y),`boundary body ${type}/${x}/${open}`);
    }
  }
}
ok(true, 'Doorway boundaries, U-barriers, distant world solids and exceptional coordinates match');
probe(`activeBuildings=[];buildColIndex();activeParkingCars=[];barrels=[];
  for(let i=0;i<80;i++){activeParkingCars.push({x:6000+i*500,y:6000});barrels.push({x:6000+i*500,y:6000});}
  activeParkingCars.push({x:0,y:0});barrels.push({x:500,y:0});invalidateCrowdSolids();`);
for (const type of types.slice(0,8)) {
  const e={eType:type,ignoreBldgTimer:0},r=['ARMORED','ALIEN_GATOR','SNAIL_HYBRID'].includes(type)?28:type==='BUG'?10:15;
  for (const eps of [-1e-9,0,1e-9]) for (const [x,y] of [[25+r+eps,0],[0,45+r+eps],[500+r+12+eps,0],
    [500+(r+12)/Math.SQRT2+eps,(r+12)/Math.SQRT2+eps]]) {
    comparisons++; assert.strictEqual(newCol.call(e,x,y),oldCol.call(e,x,y),`prop boundary ${type}/${eps}`);
  }
}
ok(true, 'Exact parked-car and barrel contact thresholds match every body radius');
probe(`buildings=[];for(let i=0;i<50;i++)buildings.push({x:(i%5)*40,y:Math.floor(i/5)*40,w:500,h:500});
  buildings.push({x:0,y:0,w:9600,h:40});invalidateCrowdSolids();
  window.__candidates=[];window.__near=crowdSolidCandidates(_crowdLOS,buildings,-200,-200,600,600,__candidates,true);`);
ok(P('__near.length===buildings.length&&new Set(__near).size===__near.length&&__near.every((b,i)=>b===buildings[i])'),
  'Wide queries deduplicate multi-cell solids and preserve original hit order');
probe(`window.__firstGrid=_crowdLOS.grid;window.__firstPool=_crowdLOS.pool.slice();
  window.__firstEntries=_crowdLOS.entries.slice();invalidateCrowdSolids();
  crowdSolidCandidates(_crowdLOS,buildings,-200,-200,600,600,__candidates,true);`);
ok(P('_crowdLOS.grid===__firstGrid&&_crowdLOS.pool.every((a,i)=>a===__firstPool[i])&&_crowdLOS.entries.every((e,i)=>e===__firstEntries[i])'),
  'Grid, occupied cell buffers and entry records are reused on a same-size rebuild');
probe('buildings.push(buildings[0]);invalidateCrowdSolids();window.__near=crowdSolidCandidates(_crowdLOS,buildings,-200,-200,600,600,__candidates,true);');
ok(P('__near.length===buildings.length&&__near.every((b,i)=>b===buildings[i])'),
  'Repeated source records retain their distinct original slots');
function sameSight(label) { comparisons++; ok(ctx.hasLOS(-100,0,100,0)===oldLOS(-100,0,100,0),label); }
probe(`buildings=Array.from({length:30},(_,i)=>({x:6000+i*500,y:6000,w:50,h:50}));invalidateCrowdSolids();`);
sameSight('Initial distant-only index matches');
probe('buildings.push({x:0,y:0,w:50,h:50});');
sameSight('Same-frame push is indexed immediately');
probe('buildings.splice(buildings.length-1,1);');
sameSight('Same-frame removal is indexed immediately');
probe('buildings=buildings.slice();buildings[0]={x:0,y:0,w:50,h:50};');
sameSight('Same-frame array replacement is indexed immediately');
probe('buildings[0].x=6000;frameCount++;');
sameSight('Next-frame in-place geometry edits are detected');
probe('buildings[0]={x:0,y:0,w:50,h:50};invalidateCrowdSolids();');
sameSight('Explicit invalidation covers same-frame equal-size replacement');
probe('buildings[0].x=6000;invalidateCrowdSolids();');
sameSight('Explicit invalidation covers same-frame geometry edits');
probe('buildings=buildings.slice(0,16);');
ok(P('crowdSolidCandidates(_crowdLOS,buildings,-10,-10,10,10,__candidates,true)===buildings'),
  'Small collections keep the original allocation-free scan');
probe(`buildings=Array.from({length:2000},(_,i)=>({x:5000+i*300,y:5000,w:50,h:50}));
  buildings.push({x:0,y:0,w:40,h:40});invalidateCrowdSolids();
  window.__near=crowdSolidCandidates(_crowdLOS,buildings,-50,-50,50,50,__candidates,false);`);
ok(P('__near.length===1&&__near[0]===buildings[2000]'), 'Local sight query visits one of 2,001 distant solids');
for (const source of ['activeParkingCars','barrels']) {
  probe(`activeBuildings=[];buildColIndex();activeParkingCars=[];barrels=[];
    ${source}=Array.from({length:40},(_,i)=>({x:6000+i*500,y:6000}));invalidateCrowdSolids();`);
  const e={eType:'NORMAL',ignoreBldgTimer:0};
  function sameProp(label) {
    comparisons++; assert.strictEqual(newCol.call(e,0,0),oldCol.call(e,0,0),source+' '+label);
  }
  sameProp('initial distant list');
  probe(`${source}.push({x:0,y:0});`);sameProp('same-frame push');
  probe(`${source}.splice(${source}.length-1,1);`);sameProp('same-frame removal');
  probe(`${source}=${source}.slice();${source}[0]={x:0,y:0};`);sameProp('same-frame reference replacement');
  probe(`${source}[0].x=6000;frameCount++;`);sameProp('next-frame coordinate change');
  probe(`${source}[0].y=0;${source}[0].x=0;invalidateCrowdSolids();`);sameProp('explicit invalidation');
  probe(`${source}.push({x:NaN,y:0},{x:Infinity,y:0});`);sameProp('exceptional coordinates');
  ok(true, `${source}: live push/removal/reference/geometry mutations retain collision results`);
}

// Actual AI, body separation, LOS, steering, firing, reloads, projectiles and
// particles run in two independent seeded worlds. Only the optimized crowd
// functions are replaced by the published originals in the reference world.
function battle(h, level, crowded) {
  h.seed(95123+level);
  h.probe(`isStoryMode=false;townsData={};window.outpostForts={};startAtLevel(${level});
    started=true;doTick=true;isDead=false;isWin=false;killcamMode=false;
    viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;
    enemiesList=[];townCitizens=[];bullets=[];particles=[];orbs=[];grenades=[];
    nm0AmbushActive=true;nm0AmbushKills=1000000;window.ambushSpawnsRemaining=0;
    player.x=8000;player.y=8000;player.hp=player.maxHp=1e9;player.shield=0;player.isArmed=true;
    player.currentWeapon=WEAPONS.SMG;player.ammo=1e7;
    leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
    buildings=Array.from({length:250},(_,i)=>({x:11000+i*300,y:11000,w:80,h:80}));
    buildings.push({x:8270,y:8000,w:80,h:500,isBlockBuilding:true},
      {x:8000,y:8280,w:450,h:70,isBlockBuilding:true});
    activeBuildings=buildings;activeParkingCars=[];barrels=[];
    for(let i=0;i<100;i++){activeParkingCars.push({x:12000+i*150,y:12000});barrels.push({x:13000+i*150,y:13000});}
    activeParkingCars.push({x:7830,y:7950});barrels.push({x:7990,y:7800});
    invalidateCrowdSolids();buildColIndex();
    const types=['NORMAL','ARMORED_STANDARD','NM0_ROOKIE','ROBOT','ARMORED','BUG','SNAIL','ALIEN_GATOR'];
    for(let i=0;i<${crowded?100:24};i++){
      const a=i*2.399963229728653,r=${crowded?'80+(i%7)*18':'260+(i%8)*28'};
      const e=new Character(8000+Math.cos(a)*r,8000+Math.sin(a)*r,false,types[i%types.length]);
      e.hp=e.maxHp=1e9;e.state='CHASE';e.loseSightTimer=3500;e.lastKnownX=8000;e.lastKnownY=8000;
      e.isFriendly=i%17===0;e.isNeutral=false;e.isArmed=true;e.fireTimer=i%40;enemiesList.push(e);
    }`);
}
const fingerprint = `JSON.stringify([player.x,player.y,player.hp,player.shield,player.fireTimer,
  enemiesList.map(e=>[e.eType,e.x,e.y,e.hp,e.shield,e.state,e.aimAngle,e.fireTimer,e.ammo,
    e.reloadTimer,e.avoidSide,e.avoidAngle,e.avoidHold,e.avoidPanic,e.avoidMark,e.orbChargeTimer]),
  bullets.map(b=>[b.x,b.y,b.px,b.py,b.life,b.angle,b.vx,b.vy,b.dead,b.damage,b.isPlayer]),
  particles.map(p=>[p.x,p.y,p.type,p.life,p.vx,p.vy,p.sz]),
  orbs.map(o=>[o.x,o.y,o.vx,o.vy,o.life])])`;
for (const [level,crowded] of [[1,false],[1,true],[4,false],[6,false]]) {
  const live=harness(),reference=harness();
  reference.probe(`hasLOS=window.__oldLOS;steerAvoid=window.__oldSteer;
    Character.prototype.checkCol=window.__oldCol;updateEntities=window.__oldEntities;`);
  battle(live,level,crowded);battle(reference,level,crowded);
  for (let f=0;f<180;f++) {
    const tick=`frameCount=${1000+f};player.x=8000+Math.cos(${f}*.015)*45;player.y=8000+Math.sin(${f}*.015)*45;
      player.hp=1e9;updateEntities();updateBullets();updateParticles();updateOrbs();`;
    live.probe(tick);reference.probe(tick);
    comparisons++;
    assert.strictEqual(live.probe(fingerprint),reference.probe(fingerprint),`Full AI state ${level}/${crowded}/${f}`);
    assert.strictEqual(live.randomCalls(),reference.randomCalls(),`RNG consumption ${level}/${crowded}/${f}`);
  }
  ok(live.probe('bullets.length+orbs.length+particles.length>0'),
    `Level ${level} battle fixture exercised live shots or hit effects`);
  ok(true, `Level ${level} ${crowded?'100-actor overlap':'24-actor pursuit'}: 180 complete AI/projectile ticks exactly match`);
}
console.log(`\n${checks}/${checks} checks passed; ${comparisons.toLocaleString()} original-result comparisons.`);

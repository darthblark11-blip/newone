// Compare pooled projectiles against the published pre-optimization game.
// Checks slot order, complete trails and real collision/damage/RNG outcomes;
// timings with stubbed drawing are deliberately not presented as frame rates.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'projectile-parity-'));
const reference = path.join(temp, 'game.js');
fs.writeFileSync(reference, process.env.PROJECTILE_BASELINE_JS
  ? fs.readFileSync(process.env.PROJECTILE_BASELINE_JS)
  : execFileSync('git', ['show', '3787c16:game.js'], { cwd: __dirname + '/..', maxBuffer: 8e6 }));
let checks = 0;
function load(file) {
  const previous = process.env.GAME_JS;
  process.env.GAME_JS = file;
  delete require.cache[require.resolve('./harness')];
  const h = require('./harness');
  if (previous === undefined) delete process.env.GAME_JS; else process.env.GAME_JS = previous;
  let seed = 77371, draws = 0;
  const next = () => { draws++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  h.ctx.random = (a, b) => {
    const n = next();
    if (a === undefined) return n;
    if (Array.isArray(a)) return a[Math.floor(n * a.length)];
    return b === undefined ? n * a : a + n * (b - a);
  };
  h.ctx.Math = Object.create(Math); h.ctx.Math.random = next;
  h.ctx.setTimeout = () => 0;
  h.ctx.Date = class extends Date { static now() { return 1700000000000; } };
  h.rng = () => [seed, draws];
  return h;
}
const a = load(reference), b = load(path.join(__dirname, '../game.js'));
const run = src => [a.probe(src), b.probe(src)];
const equal = (src, label) => {
  const result = run('JSON.stringify(' + src + ')');
  assert.strictEqual(result[1], result[0], label);
  assert.deepStrictEqual(b.rng(), a.rng(), label + ' random draws');
  checks++; console.log('  ok   ' + label);
};
try {
  run(`window.bulletSnapshot=()=>bullets.map(q=>({active:q.active,x:q.x,y:q.y,l:q.l,
    vx:q.vx,vy:q.vy,isP:q.isP,tH:q.tH,a:q.a,w:q.w&&q.w.name||q.w,
    history:q.history&&q.history.map(p=>({x:p.x,y:p.y})),retracting:q.retracting,tetherTimer:q.tetherTimer,
    tether:q.tetheredTarget&&q.tetheredTarget.eType,shooter:q.shooter&&q.shooter.tag}));
    bullets=[];enemiesList=[];population=[];isStoryMode=false;currentLevel=3;
    doTick=true;isDead=false;isWin=false;player={x:0,y:0,hp:100000,isPlayer:true};
    viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;`);
  run(`for(let i=0;i<256;i++)spawnBullet(i,0,i*.003,i%2===0,"BODY",WEAPONS.PISTOL,{tag:i,isPlayer:true});`);
  equal('bulletSnapshot()', 'initial projectile pool and firing order');
  // Retire out of order, including repeat retirement and direct manual reuse.
  run(`for(let i=255;i>=0;i-=3){bullets[i].active=false;bullets[i].active=false;}
    bullets[12].init(10,20,.7,false,"HEAD","RED_LASER");window.slots=[];
    for(let i=0;i<100;i++){const q=spawnBullet(20,i,.3,true,"HEAD",WEAPONS.TASER,{tag:i});slots.push(bullets.indexOf(q));}`);
  equal('slots', 'lowest inactive slot retained after out-of-order retirement');
  equal('bulletSnapshot()', 'all reused fields, shooter and taser state reset');
  run(`bullets.length=0;spawnBullet(1,2,.5,false,"BODY",WEAPONS.SHOTGUN);
    bullets=[];spawnBullet(3,4,.9,true,"HEAD","PINK_LASER");`);
  equal('bulletSnapshot()', 'level reset and in-place pool clear');
  // Exercise every trail length, wrapping, reuse across weapon changes and the
  // intentionally invisible ally rounds. State is sampled on every tick.
  const weapons = ['WEAPONS.PISTOL','WEAPONS.ROCKET_LAUNCHER','"RED_LASER"','"PINK_LASER"',
    '"ORANGE_BEAM"','"ALIEN_LASER"','WEAPONS.TASER','WEAPONS.SHOTGUN'];
  for (let i=0;i<weapons.length;i++) {
    run(`for(const q of bullets)q.active=false;spawnBullet(20,30,.732,true,"BODY",${weapons[i]},
      {tag:7,isPlayer:true,x:0,y:0});window.trace=[];
      for(let f=0;f<50;f++){for(const q of bullets)q.update();trace.push(bulletSnapshot());}
      for(const q of bullets)q.active=false;spawnBullet(0,0,.8,true,"BODY",${weapons[i]},
        {tag:9,isPlayer:false,x:0,y:0});
      for(let f=0;f<20;f++){for(const q of bullets)q.update();trace.push(bulletSnapshot());}`);
    equal('trace', 'exact moving and recycled trails: ' + weapons[i]);
  }
  // Dense props ensure both spatial broad phases run; real Character damage
  // and live bullet updates catch target ordering, head hits and knockback.
  run(`bullets=[];particles=[];enemiesList=[];population=[];buildings=[];activeBuildings=[];
    activeParkingCars=[];barrels=[];splatter=[];corpses=[];lightnings=[];orbs=[];
    currentLevel=3;currentBiome=3;nm0AmbushActive=false;player=new Character(0,0,true);
    player.hp=100000;player.shieldHP=100000;window.trace=[];
    for(let i=0;i<64;i++){const e=new Character(130+(i%8)*60,-240+Math.floor(i/8)*60,false,
      ["NORMAL","NM0_GREY_FATIGUE","FEMALE_PISTOL","ROBOT"][i%4]);
      e.hp=100000;e.headHP=100000;e.isNeutral=false;e.isFriendly=i%11===0;enemiesList.push(e);}
    for(let i=0;i<48;i++){activeParkingCars.push({x:450+(i%8)*80,y:-300+Math.floor(i/8)*110});
      barrels.push({x:800+(i%8)*80,y:-300+Math.floor(i/8)*110,hp:100000});}
    buildColIndex();`);
  for (let f=0;f<120;f++) {
    run(`frameCount=${400+f};
      spawnBullet(0,0,(${f}%15-7)*.045,true,${f%3===0?'"HEAD"':'"BODY"'},WEAPONS.PISTOL,player);
      if(${f}%4===0)spawnBullet(350,100,PI+.2,false,"BODY",WEAPONS.PISTOL,enemiesList[0]);
      if(${f}%7===0)spawnBullet(0,0,.1,true,"BODY","RED_LASER",player);
      updateBullets();
      trace.push({bullets:bulletSnapshot(),hp:enemiesList.map(e=>[e.hp,e.x,e.y,e.decals]),
        player:[player.hp,player.shieldHP,player.decals],barrels:barrels.map(q=>q.hp),
        particles:particles.map(q=>[q.x,q.y,q.vx,q.vy,q.l,q.a,q.sz,q.t,q.c.levels]),
        shots:totalShotsFired,hits:totalShotsHit});`);
  }
  equal('trace', '120 crowded collision frames preserve damage, order, effects and random draws');
  b.probe(`window.q=bullets[0];q.active=false;spawnBullet(0,0,0,true,"BODY",WEAPONS.PISTOL,player);
    window.trail=q.history;window.points=q._historyPoints;
    for(let f=0;f<50;f++)q.update();q.active=false;
    spawnBullet(0,0,0,true,"BODY",WEAPONS.PISTOL,player);
    window.sameBuffers=q.history===trail&&q._historyPoints===points;`);
  assert(b.probe('sameBuffers'), 'reused projectile owns the same history buffers'); checks++;
  console.log(`${checks}/${checks} projectile checks passed.`);
} finally { fs.rmSync(temp,{recursive:true,force:true}); }

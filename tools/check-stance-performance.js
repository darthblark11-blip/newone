// Compare hot-path stance shortcuts with the pre-optimization implementation.
// Keep transitions, contact cover and suppression live; no frame-level pose cache.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { ctx, probe } = require('./harness');
const baseline = execFileSync('git', ['show', '37dfd72:game.js'], {
  cwd: __dirname + '/..', maxBuffer: 8e6
}).toString();
function original(name, next) {
  const start = baseline.indexOf('function ' + name + '(');
  const end = baseline.indexOf('function ' + next + '(', start);
  assert(start >= 0 && end > start);
  return baseline.slice(start, end).trim();
}
probe(`window.oldStanceEligibility=(${original('actorCanUseStances','combatStanceContext')});
  window.oldStancePose=(${original('actorStancePose','stanceFacingAngle')});
  currentLevel=currentBiome=2;started=doTick=true;isPaused=false;
  player=new Character(0,0,true);setMeleeTool('NONE');`);
const eligibility = ctx.actorCanUseStances;
const snapshot = pose => JSON.parse(JSON.stringify(pose));
let comparisons = 0;
const types = ['NORMAL','FEMALE_PISTOL','ARMORED_STANDARD','NM0_ROOKIE','ROBOT','ARMORED',
  'SNAIL_HYBRID','ALIEN_GATOR','COW','HORSE','BUG','SNAIL','AERIAL','AERIAL_PISTOL',
  'SAUCER','SAUCER_RED','OCCULT_ZOMBIE','OCCULT_FIRE','DAD','SIA',undefined,null,NaN];
for (const type of types) for (let flags = 0; flags < 8; flags++) {
  const a = {eType:type,isPlayer:!!(flags&1),isNM0Scientist:!!(flags&2),isCorpse:!!(flags&4)};
  assert.equal(eligibility(a),ctx.oldStanceEligibility(a));comparisons++;
}
probe(`window.stancePerfActor=new Character(100,100,false,'NORMAL');
  stancePerfActor.currentWeapon=WEAPONS.SMG;`);
const a = ctx.stancePerfActor;
for (const type of types.slice(0,20)) for (const value of [0,.25,.75,1,1.35,2]) {
  for (const condition of ['none','dead','injury','stun','mounted','boxing','digging','coverLow','coverHigh']) {
    a.eType=type;a.hp=100;a.dead=condition==='dead';a.mounted=condition==='mounted';
    a.stunTimer=condition==='stun'?1:0;a.legInjury=condition==='injury'?{}:null;
    a._boxing=condition==='boxing'?{active:true}:null;
    a.shovelLevel=2;a.shovelDepth=condition==='digging'?60:0;
    a.stance={value,to:value,elapsedMs:0,durationMs:0};a.cover=null;
    if(condition.startsWith('cover')) a.cover={blend:.6,pop:.2,kind:condition==='coverLow'?'LOW':'HIGH'};
    assert.deepEqual(snapshot(ctx.actorStancePose(a)),snapshot(ctx.oldStancePose(a)),
      `${type}/${value}/${condition}`);comparisons++;
  }
}
// An actor may enter cover or be injured between movement probes in one frame.
// A shortcut must read the live state, rather than reuse an earlier frame result.
a.eType='NORMAL';a.dead=false;a.hp=100;a.mounted=false;a.stunTimer=0;a._boxing=null;
a.shovelDepth=0;a.legInjury=null;a.stance={value:0,to:0};a.cover=null;
assert.equal(ctx.actorStancePose(a).crouch,0);
a.cover={blend:1,pop:0,kind:'LOW'};
assert.equal(ctx.actorStancePose(a).crouch,1);
a.stunTimer=1;
assert.equal(ctx.actorStancePose(a).crouch,0);comparisons+=3;
// Verify the intended budget reduction on the actual collision caller.
a.stunTimer=0;a.cover=null;a.stance.value=0;
let eligibilityCalls=0;
ctx.actorCanUseStances=function(actor){eligibilityCalls++;return eligibility(actor);};
probe(`activeBuildings=[];activeParkingCars=[];barrels=[];resetForestWildlife();invalidateColIndex();
  for(let i=0;i<1000;i++)stancePerfActor.checkCol(100+i*.01,100);`);
assert.equal(eligibilityCalls,0,'standing collision probes avoid stance eligibility walks');
ctx.actorCanUseStances=eligibility;
console.log(`${comparisons} stance eligibility/pose parity checks; 1,000 standing collision probes skip eligibility`);

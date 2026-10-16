// The exterior knockdown must keep the locomotion-driven fall that existed
// before c507014 applied the minigame's airborne solver to world civilians.
// Golden samples were recorded from the full game at 55cb435 with the same
// deterministic random seed, actors, collision fixture and native frame steps.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {ctx, calls, probe} = require('./harness');
const fixturePath = path.join(__dirname, 'fixtures/world-knockdown-55cb435.json');
let checks = 0, seed = 911;
const check = (code, label) => { assert.ok(probe(code), label); checks++; };
ctx.random = (a,b) => {
  seed = (Math.imul(seed,1664525)+1013904223)>>>0;
  const n = seed / 4294967296;
  if(Array.isArray(a))return a[Math.floor(n*a.length)];
  return a===undefined?n:b===undefined?n*a:a+(b-a)*n;
};
probe(`isStoryMode=false;townsData={};startAtLevel(2);started=true;doTick=true;
 activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();
 enemiesList=[];corpses=[];particles=[];player.x=player.y=10000;
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;
 var legacyCollisionOriginal=Character.prototype.checkCol;`);
const scenarios = [
  {name:'stationary male, punch from front',type:'CITY_CITIZEN_M',facing:Math.PI,hit:0,motion:[0,0]},
  {name:'stationary female, punch from behind',type:'CITY_CITIZEN_F',facing:0,hit:Math.PI,motion:[0,0]},
  {name:'running female keeps northward momentum',type:'CITY_CITIZEN_F',facing:0,hit:-.4,motion:[0,4]},
  {name:'running hostile keeps westward momentum',type:'NORMAL',facing:Math.PI,hit:0,motion:[-4,0]},
  {name:'body hook retains the exterior buckle',type:'NORMAL',facing:.3,hit:1.3,motion:[0,0],kind:'RIGHT_HOOK',level:'BODY'},
  {name:'collision stops a forward knockdown',type:'CITY_CITIZEN_M',facing:0,hit:0,motion:[0,0],wall:10}
];
const ages = [0,1,10,20,40,56];
function recordScenario(spec) {
  seed = 911;
  probe(`Character.prototype.checkCol=legacyCollisionOriginal;frameCount=2000;
   var legacyActor=new Character(0,0,false,${JSON.stringify(spec.type)});
   legacyActor.aimAngle=${spec.facing};legacyActor.isMoving=${!!Math.hypot(...spec.motion)};
   legacyActor.moveAngle=Math.atan2(${spec.motion[1]},${spec.motion[0]});
   rememberFigureMotion(legacyActor,${spec.motion[0]},${spec.motion[1]});
   ${spec.wall===undefined?'':`Character.prototype.checkCol=function(x,y){return x>${spec.wall};};`}
   startPunchStun(legacyActor,${spec.hit},${JSON.stringify({kind:spec.kind||'LEFT_STRAIGHT',level:spec.level||'HEAD',damage:80})});`);
  const samples = [];
  let previous = 0;
  for(const age of ages) {
    probe(`for(let i=${previous};i<${age};i++){frameCount++;advanceStun(legacyActor);}`);
    const sample=probe(`(()=>{const a=legacyActor,p=a.stunPose,r=p.rag;return {
      values:[a.x,a.y,p.age,p.impulse,stunFall(a),figureFallYaw(p,r),r.ang,
        ...r.limbs.flatMap(L=>[L.a,L.b])],
      faceDown:p.faceDown,done:p.done,stunTimer:a.stunTimer,state:a.state,
      hp:a.hp,neutral:a.isNeutral,knockout:!!p.knockout};})()`);
    calls.sig=0;
    probe('drawStunnedFigure(legacyActor);');
    sample.paintSignature=calls.sig;
    samples.push(sample);
    previous = age;
  }
  probe('Character.prototype.checkCol=legacyCollisionOriginal;');
  return {name:spec.name,samples};
}
const actual = scenarios.map(recordScenario);
// This recording switch only operates on the explicit historical game source;
// normal test runs always compare against the committed golden artifact.
if(process.env.RECORD_WORLD_KNOCKDOWN_LEGACY==='55cb435') {
  assert.ok(process.env.GAME_JS && fs.readFileSync(process.env.GAME_JS,'utf8').includes('function startPunchStun(e,angle) {'),
    'Only the pre-shared historical source can regenerate the legacy fixture');
  fs.writeFileSync(fixturePath,JSON.stringify({source:'55cb435',ages,scenarios:actual},null,2)+'\n');
  console.log('Recorded world knockdown trajectories from 55cb435.');
  process.exit(0);
}
const expected = JSON.parse(fs.readFileSync(fixturePath,'utf8'));
assert.equal(expected.source,'55cb435');
assert.deepStrictEqual(expected.ages,ages);
for(let i=0;i<actual.length;i++)for(let j=0;j<ages.length;j++) {
  const got=actual[i].samples[j],want=expected.scenarios[i].samples[j],label=actual[i].name+' at '+ages[j]+' frames';
  assert.equal(actual[i].name,expected.scenarios[i].name);
  assert.equal(got.values.length,want.values.length);
  got.values.forEach((value,k)=>assert.ok(Number.isFinite(value)&&Math.abs(value-want.values[k])<1e-9,
    `${label}: legacy trajectory/joint ${k} changed (${value} vs ${want.values[k]})`));
  for(const key of ['faceDown','done','stunTimer','state','hp','neutral','knockout','paintSignature'])assert.equal(got[key],want[key],label+': '+key);
  checks++;
}
// Repeated punches extend the established stun without restarting a fall,
// sampling a new gait, turning an already grounded head or lifting it again.
probe(`var legacyRepeat=new Character(0,0,false,'CITY_CITIZEN_F');
 legacyRepeat.aimAngle=PI;rememberFigureMotion(legacyRepeat,0,0);startPunchStun(legacyRepeat,0);
 for(let i=0;i<12;i++)advanceStun(legacyRepeat);
 var legacyRepeatPose=legacyRepeat.stunPose,legacyRepeatBefore=JSON.stringify(legacyRepeatPose);
 legacyRepeat.stunTimer=17;startPunchStun(legacyRepeat,HALF_PI,{kind:'RIGHT_HOOK',level:'BODY',damage:100});`);
check('legacyRepeat.stunPose===legacyRepeatPose&&JSON.stringify(legacyRepeat.stunPose)===legacyRepeatBefore&&legacyRepeat.stunTimer===240',
  'A repeated civilian punch extends the timer without replacing or restarting the historical fall');
check('legacyRepeat.hp===100&&legacyRepeat.isNeutral&&legacyRepeat.isFriendly&&!legacyRepeat.dead&&!legacyRepeat.stunPose.knockout',
  'Repeated exterior punches retain health and neutrality without any minigame solver state');
probe(`for(let i=0;i<50;i++)advanceStun(legacyRepeat);
 var legacySettled={x:legacyRepeat.x,y:legacyRepeat.y,pose:JSON.stringify(legacyRepeat.stunPose)};
 for(let i=0;i<40;i++)advanceStun(legacyRepeat);`);
check('legacyRepeat.x===legacySettled.x&&legacyRepeat.y===legacySettled.y&&JSON.stringify(legacyRepeat.stunPose)===legacySettled.pose',
  'A completed exterior fall stays frozen while its independent stun timer counts down');
probe('legacyRepeat.stunTimer=16;');
check('stunFall(legacyRepeat)===.5', 'The original final 32-frame get-up blend remains gradual');
probe('legacyRepeat.stunTimer=1;advanceStun(legacyRepeat);');
check('legacyRepeat.stunTimer===0&&!legacyRepeat.stunPose&&legacyRepeat.state==="FLEE"&&legacyRepeat.hp===100&&legacyRepeat.isNeutral',
  'A civilian gets up and flees harmlessly after the historical four-second stun');
probe(`var legacyHostile=new Character(0,0,false,'NORMAL');legacyHostile.hp=130;
 startPunchStun(legacyHostile,.3);legacyHostile.stunTimer=1;advanceStun(legacyHostile);`);
check('!legacyHostile.stunPose&&legacyHostile.state==="CHASE"&&legacyHostile.hp===130&&!legacyHostile.dead',
  'Hostile world enemies return to their established chase state without a lethal knockout');

// A banked mid-fall pose is restored to its age by the existing resident
// streaming path. Its next native update must advance exactly one frame.
probe(`var legacyStreamed=new Character(0,0,false,'CITY_CITIZEN_M');
 legacyStreamed.aimAngle=PI;rememberFigureMotion(legacyStreamed,0,0);startPunchStun(legacyStreamed,0);
 legacyStreamed.stunPose.age=25;legacyStreamed.stunTimer=187;advanceStun(legacyStreamed);`);
check('legacyStreamed.stunPose.age===26&&legacyStreamed.stunTimer===186&&!legacyStreamed.stunPose.knockout&&legacyStreamed.stunPose.facing===PI',
  'A streamed world resident continues the banked legacy clock and facing');

// Exercise the public world hit seam as well as the helper: world boxing
// must use native falls even though Peacemaker uses the same punch geometry.
probe(`player.x=-40;player.y=0;player.aimAngle=0;
 var legacyBoxingCivilian=new Character(0,0,false,'FARMER_MALE');
 var legacyBoxingHostile=new Character(0,50,false,'NORMAL');legacyBoxingHostile.hp=130;
 boxingEnter(legacyBoxingHostile,[player],'WORLD');legacyBoxingHostile._boxingWorldManaged=true;
 var legacyWorldCounters={kills:totalKills,score,hp:player.hp};
 worldBoxingHit({attacker:player,defender:legacyBoxingCivilian,outcome:'HIT',
   point:{x:0,y:0},kind:'RIGHT_HOOK',level:'BODY',damage:100});
 for(let i=0;i<3;i++)worldBoxingHit({attacker:player,defender:legacyBoxingHostile,outcome:'HIT',
   point:{x:0,y:50},kind:'LEFT_STRAIGHT',level:'HEAD',damage:100});`);
check('legacyBoxingCivilian.stunTimer===240&&legacyBoxingCivilian.hp===100&&!legacyBoxingCivilian.stunPose.knockout&&legacyBoxingCivilian.stunPose.force===6',
  'A body-hook KO through world boxing still uses the restored civilian fall');
check('legacyBoxingHostile.stunTimer===0&&legacyBoxingHostile.punchHitCount===3&&legacyBoxingHostile.hp===130',
  'World hostile boxing retains its three harmless setup hits');
probe(`worldBoxingHit({attacker:player,defender:legacyBoxingHostile,outcome:'HIT',
 point:{x:0,y:50},kind:'RIGHT_HOOK',level:'BODY',damage:100});`);
check('legacyBoxingHostile.stunTimer===1500&&!legacyBoxingHostile.stunPose.knockout&&!boxingActive(legacyBoxingHostile)&&!legacyBoxingHostile._boxingWorldManaged&&legacyBoxingHostile.hp===130',
  'The fourth world boxing hit exits stance into the separate long native knockdown');
check('totalKills===legacyWorldCounters.kills&&score===legacyWorldCounters.score&&player.hp===legacyWorldCounters.hp',
  'World knockdowns do not change campaign kill credit or player health');

// The retained helper's default WORLD context must be safely routed to the
// old fall rather than becoming a future accidental minigame-physics caller.
probe(`var legacyDefault=new Character(0,0,false,'NORMAL');
 startKnockoutPhysics(legacyDefault,0,{kind:'RIGHT_HOOK',level:'HEAD'});
 var legacyDefaultBefore=JSON.stringify({x:legacyDefault.x,y:legacyDefault.y,pose:legacyDefault.stunPose});
 stepKnockoutPhysics(legacyDefault,1000,()=>{throw new Error('World body entered saloon mover');});`);
check('legacyDefault.stunPose&&!legacyDefault.stunPose.knockout&&JSON.stringify({x:legacyDefault.x,y:legacyDefault.y,pose:legacyDefault.stunPose})===legacyDefaultBefore',
  'Default-context fall helpers cannot enable airborne minigame physics for world actors');

// Actual electrical contact keeps its existing skeleton flash and lazy,
// already-down native pose; it must not inherit a punch launch or floor bounce.
probe(`player.x=player.y=10000;var legacyTaser=new Character(40,0,false,'NORMAL');
 legacyTaser.hp=100;enemiesList=[legacyTaser];bullets=[];
 var legacyDart=spawnBullet(0,0,0,true,'BODY',WEAPONS.TASER,player);
 for(let i=0;i<8&&legacyTaser.stunTimer===0;i++){frameCount++;updateBullets();}`);
check('legacyTaser.stunTimer===15000&&legacyTaser.skeletonTimer===66&&legacyTaser.state==="STUNNED"&&legacyTaser.hp===100',
  'A real taser projectile retains its original harmless electrical stun');
probe('advanceStun(legacyTaser);');
check('legacyTaser.stunPose&&legacyTaser.stunPose.done&&!legacyTaser.stunPose.knockout&&legacyTaser.stunPose.impulse===0&&legacyTaser.skeletonTimer===65',
  'Electrical stuns stay on the legacy grounded pose without airborne minigame effects');
console.log(`World knockdown legacy: ${checks} historical trajectory, painting, collision, recovery, boxing and electrical checks passed.`);

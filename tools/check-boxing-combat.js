// Contact and timing checks for the shared world/saloon boxing simulation.
// Tests use real joint geometry rather than replacing damage with a distance.
const assert=require('assert');
const {probe}=require('./harness');
let checks=0;
function check(code,label){assert.ok(probe(code),label);checks++;}
probe(`var boxingTestVectors={N:[0,-1],S:[0,1],NW:[-1,-1],NE:[1,-1],SW:[-1,1],SE:[1,1],W:[-1,0],E:[1,0]};
function boxingTestPair(distance=40.5){
  let a={x:0,y:0,aimAngle:0,isPlayer:true,hp:100,bodyH:27},b={x:distance,y:0,aimAngle:Math.PI,isPlayer:false,hp:100,bodyH:27};
  boxingEnter(a,[b],'SALOON');boxingEnter(b,[a],'SALOON');return [a,b];
}
function boxingTestStrike(kind,level='HEAD',guard=null,side=0,frames=[500]){
  const [a,b]=boxingTestPair();
  if(guard){boxingSetGuard(b,...boxingTestVectors[guard]);b._boxing.guardMs=400;}
  if(side){boxingRequestDodge(b,side);b._boxing.dodge.elapsedMs=150;}
  boxingRequestPunch(a,kind,level);let events=[];
  for(const dt of frames)events.push(...boxingUpdate(a,dt,[b]));
  return {a,b,events};
}`);
check(`(()=>{let [a,b]=boxingTestPair();let far={x:200,y:10,hp:100},dead={x:5,y:0,hp:0};
  a.aimAngle=1;return boxingTarget(a,[far,dead,b])===b&&a.aimAngle===0;})()`,
  'Stance locks onto the nearest live opponent, ignoring dead actors');
check(`(()=>{let [a,b]=boxingTestPair();boxingRequestPunch(a,'LEFT_HOOK');let c={x:0,y:30,hp:100};
  boxingTarget(a,[c,b]);return a.aimAngle===0;})()`,
  'A winding hook cannot snap onto a new target behind its committed fist');
for(const [sector,vector] of Object.entries({N:[0,-1],S:[0,1],NW:[-1,-1],NE:[1,-1],SW:[-1,1],SE:[1,1],W:[-1,0],E:[1,0]})){
  check(`boxingGuardSector(${vector[0]},${vector[1]})==='${sector}'`,sector+' is a distinct directional guard');
}
check('boxingGuardSector(.05,.04)===null','Stick deadzone leaves guard openings instead of choosing a random side');
for(const kind of ['LEFT_STRAIGHT','RIGHT_JAB','LEFT_HOOK','RIGHT_HOOK']){
  check(`(()=>{const s=boxingTestStrike('${kind}');return s.events.length===1&&s.events[0].outcome==='HIT'&&s.a.hp===100&&s.b.hp===100;})()`,
    kind+' contacts once through its actual fist arc and leaves HP to its caller');
  check(`(()=>{const sector=boxingPunchSector('${kind}','HEAD'),s=boxingTestStrike('${kind}','HEAD',sector);
    return s.events.length===1&&s.events[0].outcome==='BLOCK'&&s.events[0].damage===0;})()`,
    kind+' is intercepted by its matching visible head guard');
  check(`(()=>{const sector=boxingPunchSector('${kind}','BODY'),s=boxingTestStrike('${kind}','BODY',sector);
    return s.events.length===1&&s.events[0].outcome==='BLOCK';})()`,
    kind+' uses separate visible body guard geometry');
}
check(`boxingTestStrike('LEFT_HOOK','HEAD','NW').events[0].outcome==='HIT'`,
  'A right-hook guard leaves the opposite left-hook opening exposed');
check(`boxingTestStrike('LEFT_STRAIGHT','BODY','N').events[0].outcome==='HIT'`,
  'Forearms protecting the face leave the straight body opening exposed');
check(`boxingTestStrike('RIGHT_JAB','HEAD','S').events[0].outcome==='HIT'`,
  'Tucked body elbows leave the face exposed');
check(`boxingTestStrike('LEFT_HOOK','BODY','E').events[0].outcome==='BLOCK'&&
  boxingTestStrike('LEFT_HOOK','BODY','W').events[0].outcome==='HIT'`,
  'The right rib guard covers its flank and leaves the opposite flank open');
check(`boxingTestStrike('RIGHT_HOOK','BODY','W').events[0].outcome==='BLOCK'&&
  boxingTestStrike('RIGHT_HOOK','BODY','E').events[0].outcome==='HIT'`,
  'The left rib guard covers its flank and leaves the opposite flank open');
check(`(()=>{let [a,b]=boxingTestPair();b.aimAngle=0;boxingSetGuard(b,0,-1);b._boxing.guardMs=400;
  boxingRequestPunch(a,'LEFT_STRAIGHT');return boxingUpdate(a,500,[b])[0].outcome==='HIT';})()`,
  'A front guard cannot stop a fist entering from behind the rendered forearms');
check(`boxingTestStrike('LEFT_HOOK','HEAD',null,-1).events.length===0&&
  boxingTestStrike('LEFT_HOOK','HEAD',null,1).events[0].outcome==='HIT'`,
  'A left hook can be slipped on its safe side but catches the opposite sway');
check(`boxingTestStrike('RIGHT_HOOK','HEAD',null,1).events.length===0&&
  boxingTestStrike('RIGHT_HOOK','HEAD',null,-1).events[0].outcome==='HIT'`,
  'A right hook reverses the safe and vulnerable sway sides');
check(`boxingTestStrike('LEFT_STRAIGHT','HEAD',null,-1).events.length===0&&
  boxingTestStrike('LEFT_STRAIGHT','HEAD',null,1).events.length===0`,
  'A correctly timed left or right head slip clears a straight fist');
check(`boxingTestStrike('LEFT_STRAIGHT','BODY',null,-1).events[0].outcome==='HIT'&&
  boxingTestStrike('LEFT_STRAIGHT','BODY',null,1).events[0].outcome==='HIT'`,
  'A head sway has no blanket invulnerability against body punches');
check(`(()=>{let [a,b]=boxingTestPair();boxingRequestDodge(b,-1);let p=boxingPose(b),f=JSON.stringify(p.feet);
  b._boxing.dodge.elapsedMs=150;let q=boxingPose(b);return q.head.y===-15&&q.body.y===-5.25&&JSON.stringify(q.feet)===f;})()`,
  'Upper body sway shifts precise head and rib hurt boxes while feet stay planted');
check(`(()=>{let [a,b]=boxingTestPair();boxingRequestDodge(a,1,1,0);boxingUpdate(a,180,[b]);
  return Math.abs(a.x-BOXING.SIDESTEP_DISTANCE)<.001&&a.y===0;})()`,
  'A held direction adds a measured sidestep to the upper body dodge');
check(`(()=>{let [a,b]=boxingTestPair();a.isMoving=true;a.gait=.6;a.walkCycle=Math.PI/2;a.moveAngle=Math.PI/2;
  let feet=boxingPose(a).feet;return Math.abs(feet[0].x+7)<1e-8&&feet[0].y>-7&&feet[1].y<7;})()`,
  'Lateral boxing footwork strides along movement instead of walking forward in place');
check(`(()=>{let [a,b]=boxingTestPair();boxingRequestDodge(a,1,0,1);boxingUpdate(a,90,[b]);
  let feet=boxingPose(a).feet;return Math.abs(feet[0].x+7)<1e-8&&feet[0].y>-7&&feet[1].y<7;})()`,
  'A directional dodge steps its feet along the measured sidestep even after input releases');
check(`(()=>{let [a,b]=boxingTestPair();boxingRequestDodge(a,1,1,0);boxingUpdate(a,180,[b],()=>false);
  return a.x===0&&boxingPose(a).head.y>0;})()`,
  'Blocked sidesteps respect room or world solids while the upper body still sways');
check(`(()=>{let [a,b]=boxingTestPair();boxingSetGuard(b,0,-1);b._boxing.guardMs=80;
  boxingRequestPunch(a,'LEFT_STRAIGHT');a._boxing.punch.elapsedMs=200;
  let point=boxingWorldPoint(b,{x:14,y:0,z:BOXING.HEAD_HEIGHT});
  let hit=boxingResolvePunch(a,b,point);return hit.outcome==='PARRY'&&hit.stunMs===600&&a._boxing.stunMs===600&&a.x===-12&&b._boxing.parryFlashMs===150;})()`,
  'A timed forearm intercept flashes, pushes back and begins exactly 600 ms of stun');
check(`(()=>{let [a,b]=boxingTestPair();boxingSetGuard(b,0,-1);boxingUpdate(b,180,[a]);
  boxingSetGuard(b,0,-1);let age=b._boxing.guardMs;boxingRequestPunch(a,'LEFT_STRAIGHT');
  let hit=boxingResolvePunch(a,b,boxingWorldPoint(b,{x:14,y:0,z:30}));
  return age===180&&hit.outcome==='BLOCK';})()`,
  'Holding the same stick sector cannot refresh a parry window every frame');
check(`(()=>{let [a,b]=boxingTestPair();boxingSetGuard(b,0,-1);boxingUpdate(b,300,[a]);
  boxingSetGuard(b,1,-1);return b._boxing.guardMs===0&&b._boxing.guardSector==='NE';})()`,
  'Changing guard sector creates a fresh intentional parry timing edge');
check(`(()=>{let [a,b]=boxingTestPair();boxingSetGuard(b,0,-1);boxingRequestPunch(a,'RIGHT_JAB');
  boxingResolvePunch(a,b,boxingWorldPoint(b,{x:14,y:0,z:30}));
  boxingUpdate(a,500,[b]);boxingUpdate(a,99,[b]);let before=a._boxing.stunMs;
  const blocked=boxingRequestPunch(a,'RIGHT_JAB');boxingUpdate(a,1,[b]);
  return before===1&&!blocked&&a._boxing.stunMs===0&&boxingRequestPunch(a,'RIGHT_JAB');})()`,
  'Parry stun prevents the counterattack for 599 ms and releases it at 600 ms');
check(`(()=>{let fine=boxingTestStrike('LEFT_HOOK','HEAD',null,0,Array(50).fill(10));
  let coarse=boxingTestStrike('LEFT_HOOK','HEAD',null,0,[250,250]);
  return fine.events.length===1&&coarse.events.length===1&&fine.events[0].damage===coarse.events[0].damage;})()`,
  'Coarse mobile frames preserve the swept contact and cannot double-hit');
check(`(()=>{let [a,b]=boxingTestPair(95);boxingRequestPunch(a,'LEFT_STRAIGHT');return boxingUpdate(a,500,[b]).length===0;})()`,
  'Punches cannot hit a distant actor through the former broad melee radius');
check(`(()=>{let [a,b]=boxingTestPair();a.aimAngle=1.17;
  let p={x:14,y:-9,z:30},world=boxingWorldPoint(a,p),local=boxingLocalPoint(a,world);
  return Math.abs(local.x-p.x)<1e-8&&Math.abs(local.y-p.y)<1e-8&&local.z===p.z;})()`,
  'Rendered joint positions and contact coordinates share an exact invertible aim transform');
check(`(()=>{let a={x:0,y:0,hp:100,isPlayer:true},b={x:0,y:0,hp:100},c={x:1,y:1,hp:100};
  for(let actor of[a,b,c])boxingEnter(actor,[],'SALOON');boxingSeparateActors([a,b,c]);
  return Math.hypot(a.x-b.x,a.y-b.y)>=33.95&&Math.hypot(a.x-c.x,a.y-c.y)>=33.95&&Math.hypot(b.x-c.x,b.y-c.y)>=33.95;})()`,
  'Simultaneous boxing combatants separate instead of stacking inside each other');
check(`(()=>{let a={x:0,y:0,hp:100,isPlayer:true},bs=[{x:40.5,y:0,hp:100},{x:-20.25,y:35.1,hp:100},{x:-20.25,y:-35.1,hp:100}];
  boxingEnter(a,bs,'SALOON');let starts=[],previous=new Set(),peak=0;
  for(let t=0;t<6000;t+=20){boxingUpdate(a,20,bs);boxingUpdateOpponents(a,bs,20);
    let active=bs.filter(b=>b._boxing.punch);peak=Math.max(peak,active.length);
    for(let b of active)if(!previous.has(b))starts.push({t,b});previous=new Set(active);}
  return peak===1&&starts.length>=4&&new Set(starts.map(s=>s.b)).size===3&&starts.every((s,i)=>i===0||s.t-starts[i-1].t>=290);})()`,
  'Three opponents take staggered attack leases and all get a turn instead of punching in unison');
check(`(()=>{let [a,b]=boxingTestPair();boxingRequestPunch(a,'LEFT_STRAIGHT');let total=0;
  boxingUpdate(a,500,[b],null,e=>{total++;b.hp-=e.damage;});return total===1&&b.hp===75;})()`,
  'A caller receives one explicit damage event for its local or native health system');
check(`(()=>{let [a,b]=boxingTestPair();a._boxing.context='WORLD';boxingUpdate(a,500,[]);
  for(let i=0;i<5;i++)boxingUpdate(a,500,[]);return !boxingActive(a)&&a.hp===100;})()`,
  'An idle world stance expires safely without changing health or equipment');
console.log('Boxing combat: '+checks+' geometry, timing and fairness checks passed.');

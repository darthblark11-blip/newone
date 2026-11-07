// Exercise skill decisions through the shared director and real fist/guard
// geometry. No test injects a landed hit, an AI guard or a requested AI punch.
const assert = require('assert');
const { probe } = require('./harness');
let checks = 0;
function check(code, label) { assert.ok(probe(code), label); checks++; }
probe(`
function gauntletAiPair(skill='BRAWLER',count=1,pressure=0){
  _boxingActorSerial=0;
  const a={x:0,y:0,aimAngle:0,isPlayer:true,hp:100,bodyH:27};
  const bs=Array.from({length:count},(_,i)=>({x:40.5*Math.cos(i*Math.PI*2/count),y:40.5*Math.sin(i*Math.PI*2/count),
    aimAngle:Math.PI,hp:100,bodyH:27,boxingSkill:skill,boxingPressure:pressure}));
  boxingEnter(a,bs,'SALOON');for(const b of bs)boxingEnter(b,[a],'SALOON');
  return[a,bs];
}
function gauntletAiTick(a,bs,dt=6){
  return [...boxingUpdate(a,dt,bs),...boxingUpdateOpponents(a,bs,dt)];
}
function gauntletAiStrike(skill,kind,level='HEAD'){
  const[a,bs]=gauntletAiPair(skill);a._boxing.director={clock:0,nextAttackMs:1e9,turn:0};
  boxingRequestPunch(a,kind,level);let events=[],sectors=[];
  for(let t=0;t<600;t+=6){events.push(...gauntletAiTick(a,bs));sectors.push(bs[0]._boxing.guardSector);}
  return{a,b:bs[0],events,sectors};
}
function gauntletAiTrace(skill,count=3,total=9000,dt=20,pressure=0){
  const[a,bs]=gauntletAiPair(skill,count,pressure),starts=[],events=[],last=new Map();let peak=0,minSeparation=1e9,gaps=0;
  for(let t=0;t<total;t+=dt){
    events.push(...gauntletAiTick(a,bs,dt));
    for(const[i,b]of bs.entries()){
      const p=b._boxing.punch,c=b._boxing.enemyCombo;
      if(c&&!p)gaps++;
      if(p&&last.get(b)!==p.attackId){last.set(b,p.attackId);starts.push({t,i,kind:p.kind,level:p.level,
        combo:p.comboIndex,chain:c?c.chainId:null,windup:p.windupMs,damageScale:p.damageScale});}
    }
    peak=Math.max(peak,bs.filter(b=>b._boxing.punch||b._boxing.enemyCombo).length);
    for(let i=0;i<bs.length;i++)for(let j=i+1;j<bs.length;j++)minSeparation=Math.min(minSeparation,Math.hypot(bs[i].x-bs[j].x,bs[i].y-bs[j].y));
  }
  return{a,bs,starts,events,peak,minSeparation,gaps};
}
function gauntletAiFirstChain(skill='ACE'){
  const[a,bs]=gauntletAiPair(skill);let waited=0;
  while(!bs[0]._boxing.punch&&waited<1500){gauntletAiTick(a,bs);waited+=6;}
  return[a,bs];
}
`);

check(`boxingEnemyProfile({}).name==='ROOKIE'&&boxingEnemyProfile({boxingSkill:'UNKNOWN'}).name==='ROOKIE'`,
  'Unprofiled and unknown world fighters retain the rookie behavior');
for (const [skill, length] of [['ROOKIE',1],['BRAWLER',2],['ACE',3]]) {
  check(`boxingEnemyProfile({boxingSkill:'${skill}'}).comboLength===${length}`, skill+' owns exactly '+length+' strikes per chain');
}
check(`boxingEnemyPressure({boxingPressure:-9})===0&&boxingEnemyPressure({boxingPressure:90})===1&&boxingEnemyPressure({boxingPressure:'bad'})===0`,
  'Wave pressure stays finite and bounded');
for (const kind of ['RIGHT_JAB','LEFT_STRAIGHT','RIGHT_HOOK','LEFT_HOOK']) {
  check(`(()=>{const r=gauntletAiStrike('BRAWLER','${kind}');return r.events.length===1&&r.events[0].outcome==='BLOCK'&&r.events[0].damage===0&&
    r.sectors.includes(boxingPunchSector('${kind}','HEAD'))&&r.b._boxing.guardMs>BOXING.PARRY_MS;})()`,
    'Brawler intercepts '+kind+' with the matching visible arm sector, without a perfect parry');
}
check(`(()=>{const r=gauntletAiStrike('BRAWLER','RIGHT_JAB','BODY');return r.events.some(e=>e.outcome==='HIT')&&r.sectors[0]==='N';})()`,
  'The high guard has a real body-jab opening before the slower reaction');
check(`(()=>{const[a,bs]=gauntletAiPair('BRAWLER');a._boxing.director={clock:0,nextAttackMs:1e9,turn:0};
  boxingRequestPunch(a,'RIGHT_HOOK');for(let t=0;t<84;t+=6)gauntletAiTick(a,bs);
  const before=bs[0]._boxing.guardSector;gauntletAiTick(a,bs);return before==='N'&&bs[0]._boxing.guardSector==='NW';})()`,
  'A brawler watches a hook telegraph for 90 ms before changing its guard');
check(`(()=>{const[a,bs]=gauntletAiPair('BRAWLER');a._boxing.director={clock:0,nextAttackMs:1e9,turn:0};
  boxingRequestPunch(a,'RIGHT_JAB','BODY');let events=[];
  for(let t=0;t<400;t+=6){events.push(...gauntletAiTick(a,bs));if(events.some(e=>e.outcome==='HIT')&&!a._boxing.queuedPunch&&a._boxing.punch?.kind==='RIGHT_JAB')boxingRequestPunch(a,'LEFT_STRAIGHT','HEAD');}
  return events.filter(e=>e.outcome==='HIT').length>=2&&events.some(e=>e.comboIndex===2);})()`,
  'A timely real body-jab/head-straight counter chain can beat the brawler guard');

for (const [skill, length] of [['ROOKIE',1],['BRAWLER',2],['ACE',3]]) {
  probe(`var gauntletTrace${skill}=gauntletAiTrace('${skill}');`);
  check(`gauntletTrace${skill}.peak===1&&new Set(gauntletTrace${skill}.starts.filter(s=>s.combo===1).map(s=>s.i)).size===3`,
    skill+' gives all three opponents staggered turns while retaining one attack lease');
  check(`gauntletTrace${skill}.minSeparation>=33.95&&gauntletTrace${skill}.events.some(e=>e.outcome==='HIT')`,
    skill+' opponents collide normally and land genuine punches on a stationary player');
  if(length>1){
    check(`(()=>{const trace=gauntletTrace${skill};return trace.gaps>0&&trace.starts.filter(s=>s.combo===1).slice(0,-1).every(first=>{
      const chain=trace.starts.filter(s=>s.i===first.i&&s.chain===first.chain);return chain.length===${length}&&chain.every((s,i)=>s.combo===i+1)&&new Set(chain.map(s=>s.level)).size===2;
    });})()`,skill+' completes exactly '+length+' alternating head/body strikes, including real recovery gaps');
    check(`(()=>{const starts=gauntletTrace${skill}.starts;return starts.every((s,i)=>i===0||s.chain===starts[i-1].chain&&s.i===starts[i-1].i||starts[i-1].combo===${length});})()`,
      skill+' keeps other opponents out of its lease until the full chain finishes');
    check(`gauntletTrace${skill}.starts.filter(s=>s.combo>1).every(s=>s.windup>=130&&s.damageScale===1)`,
      skill+' followups keep a readable windup and use ordinary punch damage');
  }else{
    check(`gauntletTraceROOKIE.starts.every(s=>s.combo===1&&s.chain===null)&&gauntletTraceROOKIE.bs.every(b=>!b._boxing.guardSector&&!b._boxing.dodge)`,
      'Rookies keep single shots with no new guard or head movement');
  }
}

check(`(()=>{const[a,bs]=gauntletAiPair('ACE');a._boxing.director={clock:0,nextAttackMs:1e9,turn:0};let seen=[],events=[];
  for(const kind of['LEFT_HOOK','RIGHT_JAB','LEFT_STRAIGHT','RIGHT_HOOK','RIGHT_JAB','LEFT_STRAIGHT','LEFT_STRAIGHT','LEFT_HOOK','RIGHT_HOOK','RIGHT_JAB']){
    boxingRequestPunch(a,kind);
    for(let t=0;t<1050;t+=6){events.push(...gauntletAiTick(a,bs));const d=bs[0]._boxing.dodge;if(d&&!seen.includes(d))seen.push(d);}
  }
  return seen.map(d=>d.kind).join(',')==='FORWARD,BACK,LEFT,RIGHT'&&events.some(e=>e.outcome==='BLOCK')&&events.some(e=>e.outcome==='HIT');})()`,
  'An ace responds to real hooks and straights with all four physical slips, blocks, and vulnerable late slips');
check(`(()=>{const r=gauntletAiStrike('ACE','LEFT_HOOK');return r.events.length===0&&r.b._boxing.enemyDefense.hookSlips===1;})()`,
  'The ace timed forward duck genuinely clears a hook through head geometry');
check(`(()=>{const r=gauntletAiStrike('ACE','RIGHT_JAB','BODY');return r.b._boxing.enemyDefense.hookSlips===0&&r.b._boxing.enemyDefense.straightSlips===0;})()`,
  'Body punches do not trigger meaningless head-slip immunity');

for(const skill of['BRAWLER','ACE']){
  check(`(()=>{const[a,bs]=gauntletAiFirstChain('${skill}'),b=bs[0],p=b._boxing.punch;
    if(!p||!b._boxing.enemyCombo)return false;
    while(b._boxing.punch===p&&p.elapsedMs<p.windupMs-40)gauntletAiTick(a,bs);
    boxingSetGuard(a,0,-1);let events=[];
    for(let t=0;t<180;t+=6)events.push(...gauntletAiTick(a,bs));
    const count=b._boxing.attackCount;
    for(let t=0;t<1200;t+=6)gauntletAiTick(a,bs);
    return events.some(e=>e.outcome==='PARRY')&&!b._boxing.enemyCombo&&!b._boxing.punch&&b._boxing.stunMs>1000&&b._boxing.attackCount===count;})()`,
    skill+' abandons its remaining punches when the player earns a real 2600 ms parry');
  check(`(()=>{const[a,bs]=gauntletAiFirstChain('${skill}'),b=bs[0];b.knockedOut=true;b.hp=0;
    const count=b._boxing.attackCount;boxingUpdate(b,500,[a]);return !b._boxing.enemyCombo&&!b._boxing.punch&&b._boxing.attackCount===count;})()`,
    skill+' knockout cancels the chain instead of resuming a stored followup');
  check(`(()=>{const[a,bs]=gauntletAiFirstChain('${skill}'),b=bs[0];boxingExit(b);return !b._boxing&&!boxingRequestPunch(b,'RIGHT_JAB');})()`,
    skill+' stance exit removes its chain and cannot throw a stray followup');
}
check(`(()=>{const trace=gauntletAiTrace('ACE',6,9000,20,1);return trace.peak<=2&&trace.starts.some(s=>s.combo===3)&&trace.bs.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y));})()`,
  'A crowded high-pressure wave caps simultaneous leases at two and preserves finite movement');
check(`(()=>{const fine=gauntletAiTrace('ACE',1,6000,6),coarse=gauntletAiTrace('ACE',1,6000,100);
  return fine.events.every(e=>e.outcome==='HIT')&&coarse.events.every(e=>e.outcome==='HIT')&&fine.starts.some(s=>s.combo===3)&&coarse.starts.some(s=>s.combo===3)&&
    fine.events.length===coarse.events.length;})()`,
  'Mobile-sized frames still sweep each chain punch once through its contact arc');
console.log('Boxing gauntlet AI: '+checks+' skill, geometry, chain, counter, cancellation and fairness checks passed.');

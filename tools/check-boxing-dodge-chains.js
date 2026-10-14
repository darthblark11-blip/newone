// Real slip handoffs and fist contacts, using the same canonical joints that
// the painter consumes. There is no immunity flag or duplicated hit solver.
const assert=require('assert');
const {probe}=require('./harness');
let checks=0;
function check(code,label){assert.ok(probe(code),label);checks++;}
const kinds=['LEFT','RIGHT','FORWARD','BACK'];
probe(`
function chainPair(angle=0){
  const a={x:0,y:0,aimAngle:angle,isPlayer:true,hp:100,bodyH:27},
    b={x:40.5*Math.cos(angle),y:40.5*Math.sin(angle),aimAngle:angle+Math.PI,isPlayer:false,hp:100,bodyH:27};
  boxingEnter(a,[b],'SALOON');boxingEnter(b,[a],'SALOON');return[a,b];
}
function chainJointList(p){return[p.head,p.body,p.pelvis,...p.shoulders,
  ...p.arms.flatMap(a=>[a.shoulder,a.elbow,a.fist]),...p.feet];}
function chainPoseDelta(a,b){
  const A=chainJointList(a),B=chainJointList(b);
  return Math.max(...A.map((p,i)=>Math.hypot(p.x-B[i].x,p.y-B[i].y,(p.z||0)-(B[i].z||0))),
    Math.abs(a.bodyPitch-b.bodyPitch),Math.abs(a.hip-b.hip),Math.abs(a.torso-b.torso),
    Math.abs(a.legCompression-b.legCompression));
}
function chainPeak(a,first,second){
  boxingRequestDodge(a,first);boxingUpdate(a,40,[]);boxingRequestDodge(a,second);boxingUpdate(a,150,[]);
  return a._boxing.dodge&&a._boxing.dodge.kind===second&&a._boxing.dodge.elapsedMs===95;
}
`);
for(const first of kinds)for(const next of kinds.filter(k=>k!==first)){
  for(const angle of [0,.63,Math.PI/2,Math.PI,-Math.PI/2]){
    check(`(()=>{const[a]=chainPair(${angle});boxingRequestDodge(a,'${first}');boxingUpdate(a,40,[]);
      const before=boxingPose(a);if(!boxingRequestDodge(a,'${next}'))return false;
      if(a._boxing.dodge.kind!=='${first}'||a._boxing.dodge.pending.kind!=='${next}'||chainPoseDelta(before,boxingPose(a))!==0)return false;
      boxingUpdate(a,54.999,[]);if(a._boxing.dodge.kind!=='${first}')return false;
      const previous=boxingPose({...a,_boxing:{...a._boxing,dodge:{...a._boxing.dodge,elapsedMs:95}}});
      boxingUpdate(a,.001,[]);return a._boxing.dodge.kind==='${next}'&&a._boxing.dodge.linked&&
        Math.abs(a._boxing.dodge.elapsedMs)<1e-8&&chainPoseDelta(previous,boxingPose(a))<1e-7;})()`,
      first+'→'+next+' buffers without altering joints and switches continuously at the exact apex at '+angle.toFixed(2));
    for(const movement of [false,true])check(`(()=>{const[a]=chainPair(${angle});
      boxingRequestDodge(a,'${first}',${movement?'Math.cos(a.aimAngle)*(\''+first+'\'===\'BACK\'?-1:1),Math.sin(a.aimAngle)*(\''+first+'\'===\'BACK\'?-1:1)':'0,0'});
      boxingUpdate(a,150,[]);const before=boxingPose(a),x=a.x,y=a.y;
      if(!boxingRequestDodge(a,'${next}',-1,1))return false;
      return a.x===x&&a.y===y&&a._boxing.dodge.elapsedMs===0&&chainPoseDelta(before,boxingPose(a))<1e-7;})()`,
      first+'→'+next+' changes during the apex hold without a head/arm/leg snap'+(movement?' during a step':' with planted feet')+' at '+angle.toFixed(2));
  }
  check(`(()=>{const[a]=chainPair();if(!chainPeak(a,'${first}','${next}'))return false;
    const expected=chainPair()[0];boxingRequestDodge(expected,'${next}');expected._boxing.dodge.elapsedMs=95;
    const peak=boxingPose(a);return chainPoseDelta(peak,boxingPose(expected))<1e-7&&
      peak.dodgeKind==='${next}'&&!a._boxing.dodge.pending;})()`,
    first+'→'+next+' reaches the new physical head, torso, shoulders and knees after its linked rise');
  check(`(()=>{const[a]=chainPair();boxingRequestDodge(a,'${first}');boxingUpdate(a,150,[]);boxingRequestDodge(a,'${next}');
    let previous=boxingPose(a);for(let i=0;i<95;i++){
      boxingUpdate(a,1,[]);const p=boxingPose(a);
      if(chainPoseDelta(previous,p)>.75||!chainJointList(p).every(v=>[v.x,v.y,v.z||0].every(Number.isFinite)))return false;
      const h=boxingWorldPoint(a,p.head),r=boxingWorldPoint(a,p.body);
      if(!boxingHurtContact(a,h,'HEAD',p)||!boxingHurtContact(a,r,'BODY',p))return false;
      previous=p;
    }return true;})()`,
    first+'→'+next+' moves continuously through finite, genuinely vulnerable canonical joints');
  for(const angle of [0,.63,Math.PI/2])for(const punch of ['LEFT_STRAIGHT','RIGHT_JAB','LEFT_HOOK','RIGHT_HOOK'])for(const level of ['HEAD','BODY']){
    let hit=level==='BODY'||(next==='FORWARD'&&!punch.includes('HOOK'))||
      (next==='LEFT'&&punch==='RIGHT_HOOK')||(next==='RIGHT'&&punch==='LEFT_HOOK');
    check(`(()=>{const[a,b]=chainPair(${angle});a.isPlayer=false;b.isPlayer=true;
      if(!chainPeak(b,'${first}','${next}'))return false;
      boxingRequestPunch(a,'${punch}','${level}');let events=[];
      for(let t=0;t<700;t+=6)events.push(...boxingUpdate(a,6,[b]));
      return ${hit?"events.length===1&&events[0].outcome==='HIT'":"events.length===0"};})()`,
      first+'→'+next+' preserves real '+punch+' '+level+' '+(hit?'contact':'clearance')+' at facing '+angle.toFixed(2));
  }
}
for(const first of kinds){
  check(`(()=>{const[a]=chainPair();boxingRequestDodge(a,'${first}');boxingUpdate(a,150,[]);
    const d=a._boxing.dodge,time=d.elapsedMs,cooldown=a._boxing.dodgeCooldownMs;
    for(let i=0;i<20;i++)if(boxingRequestDodge(a,'${first}'))return false;
    return a._boxing.dodge===d&&d.elapsedMs===time&&a._boxing.dodgeCooldownMs===cooldown&&!d.pending;})()`,
    first+' repeat presses cannot extend its pose or cooldown');
  for(const next of kinds.filter(k=>k!==first))for(const at of [206,300,429])for(const angle of [0,.63,Math.PI/2,Math.PI,-Math.PI/2]){
    check(`(()=>{const[a]=chainPair(${angle});boxingRequestDodge(a,'${first}',Math.cos(a.aimAngle)*${first==='BACK'?-1:1},Math.sin(a.aimAngle)*${first==='BACK'?-1:1});
      boxingUpdate(a,${at},[]);const before=boxingPose(a),position={x:a.x,y:a.y},
        oldStep=a._boxing.dodge.stepDone;
      if(!boxingRequestDodge(a,'${next}'))return false;
      const current=a._boxing.dodge;
      if(current.kind!=='${next}'||!current.linked||current.elapsedMs!==0||current.pending||
        current.stepDone!==oldStep||a.x!==position.x||a.y!==position.y||chainPoseDelta(before,boxingPose(a))>1e-7)return false;
      boxingUpdate(a,95,[]);
      const expected=chainPair(${angle})[0];boxingRequestDodge(expected,'${next}');expected._boxing.dodge.elapsedMs=95;
      return Math.hypot(boxingPose(a).head.x-boxingPose(expected).head.x,
        boxingPose(a).head.y-boxingPose(expected).head.y,boxingPose(a).head.z-boxingPose(expected).head.z)<1e-7;})()`,
      first+'→'+next+' accepts a late '+at+' ms recovery input from the actual pose, retaining the step and reaching its next dodge at '+angle.toFixed(2));
  }
  check(`(()=>{const[,a]=chainPair();boxingRequestDodge(a,'${first}');boxingUpdate(a,40,[]);
    return ${kinds.filter(k=>k!==first).map(k=>"!boxingRequestDodge(a,'"+k+"')").join('&&')}&&!a._boxing.dodge.pending;})()`,
    first+' enemy dodge keeps its readable single direction');
}
check(`(()=>{const[a]=chainPair();boxingRequestDodge(a,'LEFT');boxingUpdate(a,40,[]);
  if(!boxingRequestDodge(a,'RIGHT')||boxingRequestDodge(a,'FORWARD')||boxingRequestDodge(a,'BACK'))return false;
  return a._boxing.dodge.pending.kind==='RIGHT';})()`, 'Only one pending physical direction can reserve the next apex');
for(const first of ['LEFT','RIGHT'])for(const punch of ['LEFT_STRAIGHT','RIGHT_JAB']){
  const next=first==='LEFT'?'RIGHT':'LEFT';
  check(`(()=>{const[a,b]=chainPair();a.isPlayer=false;b.isPlayer=true;
    boxingRequestDodge(b,'${first}');boxingUpdate(b,150,[]);boxingRequestDodge(b,'${next}');boxingUpdate(b,47.5,[]);
    const p=boxingPose(b);if(Math.abs(p.head.y)>1e-7||p.head.z>=BOXING.HEAD_HEIGHT-4||p.bodyPitch<=.1)return false;
    boxingRequestPunch(a,'${punch}');let events=[];
    for(let t=0;t<700;t+=6)events.push(...boxingUpdate(a,6,[b]));
    return events.length===1&&events[0].outcome==='HIT';})()`,
    first+'→'+next+' rolls through center on bent knees while an actual '+punch+' still catches its open head');
}
for(const frameMs of [6,100/6,50,100])check(`(()=>{const[a]=chainPair();boxingRequestDodge(a,'LEFT');boxingRequestDodge(a,'RIGHT');
  for(let t=0;t<600;t+=${frameMs})boxingUpdate(a,${frameMs},[]);
  return !a._boxing.dodge&&a._boxing.dodgeCooldownMs===0;})()`,
  'A buffered slip completes normally with '+frameMs.toFixed(2)+' ms simulation frames');
for(const first of kinds)check(`(()=>{const[a]=chainPair();const start={x:a.x,y:a.y};
  boxingRequestDodge(a,'${first}',Math.cos(a.aimAngle)*${first==='BACK'?-1:1},Math.sin(a.aimAngle)*${first==='BACK'?-1:1});
  const sequence=['LEFT','RIGHT','FORWARD','BACK','LEFT','RIGHT'];
  for(const kind of sequence){boxingUpdate(a,100,[]);if(a._boxing.dodge.kind!==kind&&!boxingRequestDodge(a,kind,1,1))return false;}
  boxingUpdate(a,500,[]);return Math.abs(Math.hypot(a.x-start.x,a.y-start.y)-BOXING.SIDESTEP_DISTANCE)<1e-7;})()`,
  first+' long linked sequence preserves one measured step instead of multiplying displacement');
for(const state of ['STUN','KO','EXIT','CANCEL'])check(`(()=>{const[a]=chainPair();boxingRequestDodge(a,'LEFT');boxingUpdate(a,40,[]);boxingRequestDodge(a,'RIGHT');
  ${state==='STUN'?'a._boxing.stunMs=100;boxingUpdate(a,60,[]);':state==='KO'?'a.knockedOut=true;boxingUpdate(a,60,[]);':state==='EXIT'?'boxingExit(a);':'const before=boxingPose(a);boxingCancelDodgeChain(a);if(chainPoseDelta(before,boxingPose(a))!==0)return false;'}
  return !a._boxing||!a._boxing.dodge||!a._boxing.dodge.pending;})()`,
  state+' discards a queued direction so it cannot replay after resumption');
check(`(()=>{const[a,b]=chainPair();boxingRequestDodge(a,'LEFT');a._boxing.dodge.elapsedMs=84;boxingRequestDodge(a,'RIGHT');
  boxingSetGuard(b,0,-1);boxingRequestPunch(a,'RIGHT_JAB');a._boxing.punch.elapsedMs=51;
  const events=boxingUpdate(a,12,[b]);return events.length===1&&events[0].outcome==='PARRY'&&
    a._boxing.stunMs===2594&&a._boxing.dodge.kind==='LEFT'&&a._boxing.dodge.elapsedMs===96&&!a._boxing.dodge.pending;})()`,
  'An actual parry in the first 6 ms substep cancels the pending link before the second substep crosses its apex');
for(const angle of [0,.63,Math.PI/2])for(const releaseAt of [260,280])check(`(()=>{const[a,b]=chainPair(${angle});
  boxingRequestDodge(a,'LEFT');boxingUpdate(a,150,[]);boxingRequestDodge(a,'FORWARD');boxingUpdate(a,${releaseAt},[]);
  boxingRequestPunch(a,'LEFT_STRAIGHT');let events=[];
  for(let t=0;t<200&&!events.length;t++)events.push(...boxingUpdate(a,1,[b]));
  if(events.length!==1||events[0].outcome!=='HIT'||!boxingRequestPunch(a,'RIGHT_JAB')||!a._boxing.queuedPunch)return false;
  for(let t=0;t<150&&a._boxing.punch&&a._boxing.punch.kind!=='RIGHT_JAB';t++)boxingUpdate(a,1,[b]);
  if(!a._boxing.punch||a._boxing.punch.kind!=='RIGHT_JAB')return false;
  let previous=boxingPose(a);for(let t=0;t<60&&a._boxing.dodge;t++){
    boxingUpdate(a,1,[b]);const p=boxingPose(a);if(Math.abs(p.head.z-previous.head.z)>.15)return false;previous=p;
  }
  return !a._boxing.dodge&&a._boxing.punch&&boxingPose(a).head.z===BOXING.HEAD_HEIGHT;})()`,
  'A real landed-hit queued counter captures its current posture and never resurrects the ended duck at '+releaseAt+' ms / '+angle.toFixed(2));
for(const angle of [0,.63,Math.PI/2])for(const releaseAt of [60,120])check(`(()=>{const[a,b]=chainPair(${angle});
  boxingRequestDodge(a,'RIGHT');boxingUpdate(a,${releaseAt},[]);boxingRequestPunch(a,'RIGHT_JAB');let events=[];
  for(let t=0;t<200&&!events.length;t++)events.push(...boxingUpdate(a,1,[b]));
  if(events.length!==1||events[0].outcome!=='HIT'||!boxingRequestPunch(a,'LEFT_STRAIGHT'))return false;
  const q=a._boxing.queuedPunch;if(!q||!q.slipAxes||q.slipAxes.lateral!==1||q.slipAxes.depth!==0)return false;
  if(!boxingRequestDodge(a,'LEFT'))return false;
  for(let t=0;t<150&&a._boxing.punch&&a._boxing.punch.kind!=='LEFT_STRAIGHT';t++)boxingUpdate(a,1,[b]);
  const p=a._boxing.punch,axes=p&&p.slipAxes,d=a._boxing.dodge,pose=boxingPose(a);
  return p&&p.kind==='LEFT_STRAIGHT'&&axes&&axes.lateral<.8&&axes.depth>.1&&
    Math.abs(axes.lateral-boxingDodgeAmount(d))<1e-7&&Math.abs(axes.depth-boxingDodgeDepth(d))<1e-7&&
    Math.abs(pose.head.y-axes.lateral*BOXING.SWAY_DISTANCE)<1e-7&&
    Math.abs(pose.head.z-(BOXING.HEAD_HEIGHT-axes.depth*BOXING.DUCK_HEIGHT))<1e-7;})()`,
  'A real counter queued in an original slip then linked resamples both actual axes when it starts at '+releaseAt+' ms / '+angle.toFixed(2));
for(const first of kinds)for(const next of kinds.filter(k=>k!==first))check(`(()=>{const[a]=chainPair();
  boxingRequestDodge(a,'${first}');boxingUpdate(a,150,[]);boxingRequestDodge(a,'${next}');boxingUpdate(a,38,[]);
  const before=boxingPose(a),punch=boxingDodgeAmount(a._boxing.dodge)>0?'LEFT_STRAIGHT':'RIGHT_JAB';
  boxingRequestPunch(a,punch);const p=a._boxing.punch;if(!p)return false;
  const active=boxingPose(a);a._boxing.dodge=null;const retained=boxingPose(a);
  return Math.hypot(before.head.x-active.head.x,before.head.y-active.head.y,before.head.z-active.head.z)<1e-7&&
    Math.hypot(active.head.x-retained.head.x,active.head.y-retained.head.y,active.head.z-retained.head.z)<1e-7&&
    Math.hypot(active.body.x-retained.body.x,active.body.y-retained.body.y,active.body.z-retained.body.z)<1e-7;})()`,
  first+'→'+next+' mixed lateral/depth posture carries continuously into its physical counter');
check(`(()=>{const[a]=chainPair();boxingRequestDodge(a,'RIGHT');boxingUpdate(a,150,[]);boxingRequestPunch(a,'LEFT_STRAIGHT');
  const before=boxingPose(a);boxingRequestDodge(a,'LEFT');const after=boxingPose(a);
  if(chainPoseDelta(before,after)>1e-7)return false;
  boxingUpdate(a,47.5,[]);const middle=boxingPose(a);return Math.abs(middle.head.y)<1e-7&&middle.duck>.2;})()`,
  'An earlier counter never pins the head to the old side of the next linked roll');
console.log('Boxing dodge chains: '+checks+' handoff timing, anatomical continuity, physical contact, footwork, counter and lifecycle checks passed.');

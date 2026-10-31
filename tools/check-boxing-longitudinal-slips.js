// Longitudinal slips are physical head/torso poses, not attack-type immunity.
// Step the defender and a real incoming fist through native contact timing.
const assert=require('assert');
const {ctx,probe}=require('./harness');
let checks=0;
function check(code,label){assert.ok(probe(code),label);checks++;}
probe(`
function longitudinalPair(angle=0,distance=40.5){
  const attacker={x:0,y:0,aimAngle:angle,isPlayer:false,hp:100,bodyH:27},
    defender={x:distance*Math.cos(angle),y:distance*Math.sin(angle),aimAngle:angle+Math.PI,isPlayer:true,hp:100,bodyH:27};
  boxingEnter(attacker,[defender],'SALOON');boxingEnter(defender,[attacker],'SALOON');return[attacker,defender];
}
function longitudinalIncoming(kind,slip,startMs,level='HEAD',angle=0,frameMs=6){
  const[a,b]=longitudinalPair(angle);boxingRequestPunch(a,kind,level);
  let events=[],requested=false;
  for(let t=0;t<700;t+=frameMs){
    if(t>=startMs&&!requested){requested=boxingRequestDodge(b,slip);}
    boxingUpdate(b,frameMs,[a]);events.push(...boxingUpdate(a,frameMs,[b]));
  }
  return{a,b,events,requested};
}
`);
for(const slip of ['FORWARD','BACK']){
  check(`(()=>{const[,b]=longitudinalPair();const ready=boxingPose(b),boots=JSON.stringify(ready.feet);
    boxingRequestDodge(b,'${slip}');b._boxing.dodge.elapsedMs=150;const p=boxingPose(b);
    return b._boxing.dodge.kind==='${slip}'&&b._boxing.dodge.side===0&&p.dodge===0&&
      JSON.stringify(p.feet)===boots&&p.head.y===ready.head.y&&
      ${slip==='FORWARD'?'p.head.x>ready.head.x+8&&p.head.z<ready.head.z-15&&p.body.x>ready.body.x+3&&p.bodyPitch>.3&&p.backReveal>.9&&p.legCompression>.8':'p.head.x<ready.head.x-15&&p.head.z<ready.head.z&&p.body.x<ready.body.x-3&&p.bodyPitch<-.2&&p.leanBack>.9'};})()`,
    slip+' bends above planted boots, with a real longitudinal head/rib change and readable pitch');
  for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const kind of ['LEFT_HOOK','RIGHT_HOOK']){
    check(`(()=>{const s=longitudinalIncoming('${kind}','${slip}',250,'HEAD',${angle});
      return s.requested&&s.events.length===0&&s.a.hp===100&&s.b.hp===100;})()`,
      'Timed '+slip+' clears the real '+kind+' head arc at facing '+angle.toFixed(2));
    for(const start of [0,450])check(`(()=>{const s=longitudinalIncoming('${kind}','${slip}',${start},'HEAD',${angle});
      return s.events.length===1&&s.events[0].outcome==='HIT';})()`,
      (start===0?'Early ':'Late ')+slip+' is caught by '+kind+' at facing '+angle.toFixed(2));
  }
  if(slip==='FORWARD')for(const angle of [0,.63,Math.PI/2,Math.PI,-Math.PI/2])for(const kind of ['LEFT_STRAIGHT','RIGHT_JAB']){
    for(const start of [150,250,300])check(`(()=>{const s=longitudinalIncoming('${kind}','FORWARD',${start},'HEAD',${angle});
      return s.requested&&s.events.length===1&&s.events[0].outcome==='HIT'&&s.events[0].level==='HEAD';})()`,
      kind+' follows a forward duck instead of missing like a hook at '+start+' ms / facing '+angle.toFixed(2));
  }
  for(const kind of ['LEFT_STRAIGHT','RIGHT_JAB','LEFT_HOOK','RIGHT_HOOK']){
    check(`(()=>{const s=longitudinalIncoming('${kind}','${slip}',250,'BODY');
      return s.events.length===1&&s.events[0].outcome==='HIT'&&s.events[0].level==='BODY';})()`,
      slip+' leaves the ribs vulnerable to actual '+kind+' body contact');
  }
  for(const angle of [0,.63,Math.PI/2,Math.PI,-Math.PI/2]){
    const sign=slip==='FORWARD'?1:-1;
    check(`(()=>{const[,b]=longitudinalPair(${angle});const x=b.x,y=b.y,a=b.aimAngle;
      boxingRequestDodge(b,'${slip}',Math.cos(a)*${sign},Math.sin(a)*${sign});boxingUpdate(b,180,[]);
      const dx=b.x-x,dy=b.y-y;return Math.abs(dx-Math.cos(a)*${sign}*BOXING.SIDESTEP_DISTANCE)<1e-7&&
        Math.abs(dy-Math.sin(a)*${sign}*BOXING.SIDESTEP_DISTANCE)<1e-7;})()`,
      slip+' adds its matching '+(sign>0?'forward':'backward')+' step along facing '+angle.toFixed(2));
  }
  for(const movement of ['opposite','sideways']){
    const sign=slip==='FORWARD'?1:-1;
    check(`(()=>{const[,b]=longitudinalPair(.63);const x=b.x,y=b.y,a=b.aimAngle;
      boxingRequestDodge(b,'${slip}',${movement==='opposite'?`Math.cos(a)*${-sign},Math.sin(a)*${-sign}`:'-Math.sin(a),Math.cos(a)'});
      boxingUpdate(b,180,[]);return b.x===x&&b.y===y&&boxingPose(b).${slip==='FORWARD'?'duck':'leanBack'}===1;})()`,
      slip+' with '+movement+' movement stays a planted upper-body dodge');
  }
  check(`(()=>{const[,b]=longitudinalPair();const x=b.x,y=b.y,a=b.aimAngle;
    boxingRequestDodge(b,'${slip}',Math.cos(a)*${slip==='FORWARD'?1:-1},Math.sin(a)*${slip==='FORWARD'?1:-1});
    boxingUpdate(b,180,[],()=>false);return b.x===x&&b.y===y&&boxingPose(b).${slip==='FORWARD'?'duck':'leanBack'}===1;})()`,
    slip+' cannot step through a room or world collision');
  check(`(()=>{const[,b]=longitudinalPair();boxingRequestDodge(b,'${slip}');b._boxing.dodge.elapsedMs=150;
    const p=boxingPose(b);return boxingHurtContact(b,boxingWorldPoint(b,p.head),'HEAD',p)&&
      boxingHurtContact(b,boxingWorldPoint(b,p.body),'BODY',p);})()`,
    slip+' still accepts contact at its actual head/body centers, with no invulnerability flag');
  check(`(()=>{const[,b]=longitudinalPair();boxingRequestDodge(b,'${slip}');b._boxing.dodge.elapsedMs=150;
    const before=boxingPose(b);boxingRequestPunch(b,'LEFT_STRAIGHT');b._boxing.dodge=null;
    const counter=boxingPose(b),p=b._boxing.punch;return p.slipKind==='${slip}'&&p.slipAmount===1&&
      Math.abs(counter.head.x-before.head.x)<1e-7&&Math.abs(counter.head.z-before.head.z)<1e-7&&
      Math.abs(counter.body.x-before.body.x)<1e-7;})()`,
    slip+' can carry its exact duck/lean into a released counter without snapping upright');
  for(const level of ['HEAD','BODY']){
    check(`(()=>{const[a,b]=longitudinalPair();boxingRequestDodge(b,'${slip}');b._boxing.dodge.elapsedMs=150;
      boxingRequestPunch(b,'LEFT_STRAIGHT','${level}');b._boxing.dodge=null;let events=[];
      for(let i=0;i<90;i++)events.push(...boxingUpdate(b,6,[a]));
      return events.length===1&&events[0].outcome==='HIT'&&events[0].slipCounter&&events[0].level==='${level}';})()`,
      slip+' carries a physical '+level+' counter through one real contact and marks the counter event');
    check(`(()=>{const[,b]=longitudinalPair();boxingRequestDodge(b,'${slip}');b._boxing.dodge.elapsedMs=150;
      boxingRequestPunch(b,'LEFT_STRAIGHT','${level}');b._boxing.dodge=null;const p=b._boxing.punch;
      p.elapsedMs=p.windupMs+p.activeMs-.001;const before=boxingPose(b);
      p.elapsedMs+=.002;const after=boxingPose(b);
      return Math.hypot(after.head.x-before.head.x,after.head.y-before.head.y,after.head.z-before.head.z)<.05&&
        Math.hypot(after.body.x-before.body.x,after.body.y-before.body.y,after.body.z-before.body.z)<.05;})()`,
      slip+' '+level+' counter returns smoothly through the contact/recovery boundary');
    check(`(()=>{const[,b]=longitudinalPair();boxingRequestDodge(b,'${slip}');b._boxing.dodge.elapsedMs=150;
      boxingRequestPunch(b,'LEFT_STRAIGHT','${level}');b._boxing.dodge=null;const p=b._boxing.punch;
      p.elapsedMs=p.windupMs+p.activeMs+p.recoveryMs-.001;const before=boxingPose(b);b._boxing.punch=null;
      const after=boxingPose(b);return Math.hypot(after.head.x-before.head.x,after.head.y-before.head.y,after.head.z-before.head.z)<.05&&
        Math.hypot(after.body.x-before.body.x,after.body.y-before.body.y,after.body.z-before.body.z)<.05;})()`,
      slip+' '+level+' counter settles back into ready without a head/torso snap');
  }
  for(const frameMs of [6,100/6,50,100])check(`(()=>{const s=longitudinalIncoming('RIGHT_HOOK','${slip}',250,'HEAD',.63,${frameMs});
    return s.events.length===0;})()`,
    'Timed '+slip+' preserves hook clearance at '+frameMs.toFixed(2)+' ms native frames');
}
for(const slip of ['LEFT','RIGHT'])for(const angle of [0,.63,Math.PI/2,Math.PI,-Math.PI/2]){
  const side=slip==='LEFT'?-1:1;
  check(`(()=>{const[,b]=longitudinalPair(${angle});const ready=boxingPose(b);
    boxingRequestDodge(b,'${slip}');b._boxing.dodge.elapsedMs=150;const pose=boxingPose(b),
      head=boxingWorldPoint(b,pose.head),center=boxingWorldPoint(b,ready.head),a=b.aimAngle,
      dx=head.x-center.x,dy=head.y-center.y;
    return dx*Math.cos(a)+dy*Math.sin(a)>4&&(-dx*Math.sin(a)+dy*Math.cos(a))*${side}>12&&
      pose.torso*${side}>.2&&(pose.hip-ready.hip)*${side}>.08&&
      pose.body.x>ready.body.x+1&&pose.head.z===ready.head.z&&JSON.stringify(pose.feet)===JSON.stringify(ready.feet)&&
      ${side<0?'pose.shoulders[1].x>ready.shoulders[1].x+3&&pose.shoulders[0].x<ready.shoulders[0].x':
        'pose.shoulders[0].x>ready.shoulders[0].x+3&&pose.shoulders[1].x<ready.shoulders[1].x'};
    })()`, slip+' moves diagonally toward the opponent and turns the anatomical shoulders above planted feet at '+angle.toFixed(2));
  check(`(()=>{const[,b]=longitudinalPair(${angle});boxingRequestDodge(b,'${slip}');b._boxing.dodge.elapsedMs=150;
    const before=boxingPose(b);boxingRequestPunch(b,'${side<0?'RIGHT_JAB':'LEFT_STRAIGHT'}');b._boxing.dodge=null;
    const after=boxingPose(b);return Math.hypot(after.head.x-before.head.x,after.head.y-before.head.y)<.01&&
      Math.abs(after.torso-before.torso)<.01&&Math.hypot(after.body.x-before.body.x,after.body.y-before.body.y)<.01;})()`,
    slip+' carries its diagonal head and turned shoulders into the opposite-hand counter without a posture snap');
}
for(const angle of [0,.63,Math.PI/2,Math.PI,-Math.PI/2])for(const kind of ['LEFT_STRAIGHT','RIGHT_JAB']){
  check(`(()=>{const[a,b]=longitudinalPair(${angle});boxingRequestDodge(b,'FORWARD');b._boxing.dodge.elapsedMs=150;
    boxingRequestPunch(a,'${kind}');const punch=a._boxing.punch;punch.elapsedMs=punch.windupMs+punch.activeMs*.55;
    const attackPose=boxingPose(a),defensePose=boxingPose(b),arm=attackPose.arms.find(arm=>arm.striking),
      world=boxingWorldPoint(a,arm.fist,punch.aimAngle);
    return arm.fist.z<BOXING.HEAD_HEIGHT-15&&arm.elbow.z<BOXING.HEAD_HEIGHT-10&&
      Math.abs(world.z-boxingWorldPoint(b,defensePose.head).z)<.01&&boxingHurtContact(b,world,'HEAD',defensePose);})()`,
    kind+' visibly lowers its real elbow/fist to the forward-ducked head at facing '+angle.toFixed(2));
  for(const escape of ['AWAY','SIDE'])check(`(()=>{const[a,b]=longitudinalPair(${angle});
    boxingRequestPunch(a,'${kind}');boxingRequestDodge(b,'FORWARD');b._boxing.dodge.elapsedMs=150;
    const c=Math.cos(${angle}),s=Math.sin(${angle});
    ${escape==='AWAY'?'b.x+=c*40;b.y+=s*40;':'b.x-=s*35;b.y+=c*35;'}
    a._boxing.punch.elapsedMs=a._boxing.punch.windupMs+a._boxing.punch.activeMs*.55;
    const arm=boxingPose(a).arms.find(arm=>arm.striking),world=boxingWorldPoint(a,arm.fist,a._boxing.punch.aimAngle);
    const events=boxingUpdate(a,300,[b]);return arm.fist.z===BOXING.HEAD_HEIGHT&&
      !boxingHurtContact(b,world,'HEAD')&&events.length===0;})()`,
    kind+' does not track a ducking opponent moving '+escape.toLowerCase()+' beyond its committed reach/line at '+angle.toFixed(2));
}
check(`(()=>{const[a,b]=longitudinalPair();boxingRequestDodge(a,'FORWARD');boxingRequestDodge(b,'FORWARD');
  a._boxing.dodge.elapsedMs=b._boxing.dodge.elapsedMs=150;boxingRequestPunch(a,'RIGHT_JAB');boxingRequestPunch(b,'LEFT_STRAIGHT');
  a._boxing.punch.elapsedMs=a._boxing.punch.windupMs+a._boxing.punch.activeMs*.55;
  b._boxing.punch.elapsedMs=b._boxing.punch.windupMs+b._boxing.punch.activeMs*.55;
  return [boxingPose(a),boxingPose(b)].every(p=>p.arms.every(arm=>[arm.fist.x,arm.fist.y,arm.fist.z,arm.elbow.z].every(Number.isFinite)));})()`,
  'Reciprocal ducking straight counters resolve finite canonical joints without recursive target poses');
for(const angle of [0,.63,Math.PI/2,Math.PI])for(const kind of ['LEFT_STRAIGHT','RIGHT_JAB','LEFT_HOOK','RIGHT_HOOK']){
  check(`(()=>{const[a,b]=longitudinalPair(${angle});a.isPlayer=true;b.isPlayer=false;
    boxingRequestPunch(a,'${kind}');boxingRequestDodge(b,'FORWARD');let events=[];
    for(let t=0;t<450;t+=6){boxingUpdate(b,6,[a]);events.push(...boxingUpdate(a,6,[b]));}
    return ${kind.includes('HOOK')?'events.length===0':"events.length===1&&events[0].outcome==='HIT'"};})()`,
    'Player '+kind+' observes the same hook-only forward-duck rule against an enemy at facing '+angle.toFixed(2));
}
for(const frameMs of [100/6,50,100])for(const kind of ['LEFT_STRAIGHT','RIGHT_JAB']){
  check(`(()=>{const s=longitudinalIncoming('${kind}','FORWARD',250,'HEAD',.63,${frameMs});
    return s.events.length===1&&s.events[0].outcome==='HIT';})()`,
    kind+' catches the forward duck at '+frameMs.toFixed(2)+' ms native frames');
}
for(const kind of ['LEFT_STRAIGHT','RIGHT_JAB'])for(const recovery of [.2,.5,.9]){
  check(`(()=>{const[a,b]=longitudinalPair();a.isPlayer=true;b.isPlayer=false;
    boxingRequestDodge(b,'FORWARD');b._boxing.dodge.elapsedMs=150;boxingRequestPunch(a,'${kind}');
    const punch=a._boxing.punch;punch.elapsedMs=punch.windupMs+punch.activeMs+punch.recoveryMs*${recovery};
    a._boxing.preparedPunch={kind:'${kind==='LEFT_STRAIGHT'?'RIGHT_JAB':'LEFT_STRAIGHT'}',level:'BODY',amount:1};
    const pose=boxingPose(a),untracked=boxingPose(a,false),arm=pose.arms.find(arm=>arm.striking),
      end=untracked.arms.find(arm=>arm.striking);
    return pose.phase==='RECOVERY'&&pose.levelChange===1&&arm.fist.z>=BOXING.BODY_HEIGHT&&
      Math.abs(arm.fist.z-end.fist.z)<.01&&Math.abs(arm.elbow.z-end.elbow.z)<.01;})()`,
    kind+' hands its duck-tracking recovery to a held BODY continuation without lowering the glove twice at '+recovery);
}
check(`(()=>{const[,b]=longitudinalPair();boxingRequestDodge(b,'FORWARD');b._boxing.dodge.elapsedMs=150;
  const p=boxingPose(b),overhead=boxingWorldPoint(b,{x:p.head.x,y:p.head.y,z:BOXING.HEAD_HEIGHT});
  return !boxingHurtContact(b,overhead,'HEAD',p)&&boxingHurtContact(b,boxingWorldPoint(b,p.head),'HEAD',p);})()`,
  'A head hook passes over the duck in physical height instead of an XY-only fake miss');
check(`(()=>{const[,b]=longitudinalPair();const ready=boxingPose(b);boxingRequestDodge(b,'BACK');
  b._boxing.dodge.elapsedMs=150;const p=boxingPose(b),reach=boxingWorldPoint(b,ready.head);
  return !boxingHurtContact(b,reach,'HEAD',p);})()`,
  'Pulling back moves the physical head beyond its former in-pocket contact center');
check(`(()=>{const[,b]=longitudinalPair();if(boxingRequestDodge(b,'INVALID'))return false;
  if(!boxingRequestDodge(b,-1)||b._boxing.dodge.kind!=='LEFT')return false;
  b._boxing.dodge.elapsedMs=150;return boxingDodgeAmount(b._boxing.dodge)===-1&&boxingDodgeDepth(b._boxing.dodge)===0;})()`,
  'Legacy numeric left/right sways remain valid while unknown string directions are rejected');
// Use the native cel painter and trace resolved joint centers in all new poses.
probe(`isStoryMode=false;townsData={};startAtLevel(3);started=true;doTick=false;
  explosiveArmorUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=false;
  player.isMoving=false;player.decals=[];player.hitFlash=0;`);
for(const slip of ['FORWARD','BACK'])for(const angle of [0,.63,Math.PI/2,Math.PI]){
  probe(`player.x=player.y=0;player.aimAngle=${angle};boxingExit(player);boxingEnter(player,[],'SALOON');
    boxingRequestDodge(player,'${slip}');player._boxing.dodge.elapsedMs=150;`);
  const original={},heads=[],ovals=[],stack=[];let m=[1,0,0,1,0,0],finite=true,underflow=false;
  const point=(x,y)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
  const mul=u=>{const t=m;m=[t[0]*u[0]+t[2]*u[1],t[1]*u[0]+t[3]*u[1],t[0]*u[2]+t[2]*u[3],t[1]*u[2]+t[3]*u[3],t[0]*u[4]+t[2]*u[5]+t[4],t[1]*u[4]+t[3]*u[5]+t[5]];};
  for(const key of ['push','pop','translate','rotate','scale','drawFigureHead','figureCelOval'])original[key]=ctx[key];
  ctx.push=()=>stack.push(m.slice());ctx.pop=()=>{if(!stack.length)underflow=true;else m=stack.pop();};
  ctx.translate=(x,y)=>{finite=finite&&[x,y].every(Number.isFinite);mul([1,0,0,1,x,y]);};
  ctx.rotate=a=>{finite=finite&&Number.isFinite(a);mul([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);};
  ctx.scale=(x,y=x)=>mul([x,0,0,y,0,0]);
  ctx.drawFigureHead=(g,id,x,y,...rest)=>{heads.push(point(x,y));return original.drawFigureHead(g,id,x,y,...rest);};
  ctx.figureCelOval=(g,x,y,w,h,...rest)=>{const p=point(x,y);finite=finite&&[p.x,p.y,w,h].every(Number.isFinite);ovals.push({p,w,h});return original.figureCelOval(g,x,y,w,h,...rest);};
  try{probe('paintBoxingFigure(player);');}finally{Object.assign(ctx,original);}
  const pose=probe('boxingPose(player)'),head=probe('boxingWorldPoint(player,boxingPose(player).head)'),
    fists=probe('boxingPose(player).arms.map(a=>boxingWorldPoint(player,a.fist))');
  assert.ok(finite&&!underflow&&stack.length===0&&heads.length===1&&Math.hypot(heads[0].x-head.x,heads[0].y-head.y)<1e-7&&
    fists.every(f=>ovals.some(o=>o.w===8.6&&o.h===8.6&&Math.hypot(o.p.x-f.x,o.p.y-f.y)<1e-7)),
    slip+' native render keeps finite, balanced cel geometry and exact combat head/fists at '+angle.toFixed(2));checks++;
}
console.log('Boxing longitudinal slips: '+checks+' timing, physical contact, footwork, collision, counter and native render checks passed.');

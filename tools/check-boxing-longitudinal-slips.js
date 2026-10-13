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

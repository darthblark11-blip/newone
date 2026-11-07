// Body-shot postures must lower and advance the real hurt boxes, carry a held
// load continuously into release, and keep working through the contact solver.
const assert=require('assert');
const {probe}=require('./harness');
let checks=0;
function check(code,label){assert.ok(probe(code),label);checks++;}
probe(`
function bodyPosturePair(playerPunch=true,angle=0){
  const a={x:0,y:0,aimAngle:angle,isPlayer:playerPunch,hp:100,bodyH:27},
    b={x:40.5*Math.cos(angle),y:40.5*Math.sin(angle),aimAngle:angle+Math.PI,hp:100,bodyH:27};
  boxingEnter(a,[b],'SALOON');boxingEnter(b,[a],'SALOON');return[a,b];
}
function bodyPoseDistance(a,b){
  let max=0;
  const compare=(p,q)=>{max=Math.max(max,Math.hypot(p.x-q.x,p.y-q.y,(p.z||0)-(q.z||0)));};
  compare(a.head,b.head);compare(a.body,b.body);
  for(let i=0;i<2;i++)for(const key of['shoulder','elbow','fist'])compare(a.arms[i][key],b.arms[i][key]);
  for(let i=0;i<2;i++)max=Math.max(max,Math.hypot(a.feet[i].x-b.feet[i].x,a.feet[i].y-b.feet[i].y),
    Math.abs(a.feet[i].heading-b.feet[i].heading),Math.abs(a.feet[i].lift-b.feet[i].lift));
  max=Math.max(max,Math.abs(a.torso-b.torso),Math.abs(a.hip-b.hip));return max;
}
`);
const kinds=['RIGHT_JAB','RIGHT_HOOK','LEFT_STRAIGHT','LEFT_HOOK'];
for(const kind of kinds){
  check(`(()=>{const[a]=bodyPosturePair();const ready=boxingPose(a);
    a._boxing.preparedPunch={kind:'${kind}',level:'BODY',amount:1};const p=boxingPose(a);
    return !a._boxing.punch&&p.head.x>ready.head.x+5&&p.head.z<ready.head.z-5&&
      p.body.x>ready.body.x+1.5&&p.body.z<ready.body.z&&p.legCompression>.5&&
      p.bodyPitch>.15&&p.backReveal>.5&&p.bodyProfileKind==='${kind}';})()`,
    kind+' held load bends forward, lowers real head/ribs/knees and reveals the back before attacking');
  check(`(()=>{const[a]=bodyPosturePair();a._boxing.preparedPunch={kind:'${kind}',level:'BODY',amount:1};
    const held=boxingPose(a);a._boxing.preparedPunch=null;
    boxingRequestPunch(a,'${kind}','BODY',{preparedAmount:1});const release=boxingPose(a);
    return bodyPoseDistance(held,release)<1e-7;})()`,
    kind+' release starts from exactly the held head, torso and arm geometry');
  for(const isPlayer of [true,false]){
    check(`(()=>{const[a]=bodyPosturePair(${isPlayer});const ready=boxingPose(a);
      boxingRequestPunch(a,'${kind}','BODY');const p=a._boxing.punch;p.elapsedMs=p.windupMs*.75;
      const load=boxingPose(a);return load.phase==='WINDUP'&&load.levelChange>.9&&
        load.head.x>ready.head.x+5&&load.head.z<ready.head.z-5&&load.backReveal>.5;})()`,
      kind+' '+(isPlayer?'player':'enemy')+' unheld windup visibly ducks forward before contact');
    check(`(()=>{const[a,b]=bodyPosturePair(${isPlayer});
      boxingRequestPunch(a,'${kind}','BODY',{preparedAmount:1});let events=[];
      for(let i=0;i<100;i++)events.push(...boxingUpdate(a,10,[b]));
      return events.length===1&&events[0].outcome==='HIT'&&events[0].level==='BODY'&&a.hp===100&&b.hp===100;})()`,
      kind+' '+(isPlayer?'player':'enemy')+' loaded body punch still contacts once through the actual fist arc');
    check(`(()=>{const[a,b]=bodyPosturePair(${isPlayer}),sector=boxingPunchSector('${kind}','BODY');
      const vectors={S:[0,1],SW:[-1,1],SE:[1,1]};boxingSetGuard(b,...vectors[sector]);b._boxing.guardMs=400;
      boxingRequestPunch(a,'${kind}','BODY',{preparedAmount:1});let events=[];
      for(let i=0;i<100;i++)events.push(...boxingUpdate(a,10,[b]));
      return events.length===1&&events[0].outcome==='BLOCK'&&events[0].damage===0;})()`,
      kind+' '+(isPlayer?'player':'enemy')+' lower loaded punch is intercepted by the visible matching body guard');
  }
  for(const boundary of ['windupMs','windupMs+p.activeMs']){
    check(`(()=>{const[a]=bodyPosturePair();boxingRequestPunch(a,'${kind}','BODY',{preparedAmount:1});
      const p=a._boxing.punch,t=p.${boundary};p.elapsedMs=t-.001;const before=boxingPose(a);
      p.elapsedMs=t+.001;return bodyPoseDistance(before,boxingPose(a))<.05;})()`,
      kind+' body pose has no joint jump at '+(boundary==='windupMs'?'windup/contact':'contact/recovery')+' handoff');
  }
}
check(`(()=>{const[a]=bodyPosturePair();a._boxing.preparedPunch={kind:'RIGHT_JAB',level:'BODY',amount:1};
  return boxingPose(a).head.y<-2;})()`, 'Right body jab dips forward and to the anatomical left');
check(`(()=>{const[a]=bodyPosturePair();a._boxing.preparedPunch={kind:'RIGHT_HOOK',level:'BODY',amount:1};
  const load=boxingPose(a);a._boxing.preparedPunch=null;boxingRequestPunch(a,'RIGHT_HOOK','BODY',{preparedAmount:1});
  const p=a._boxing.punch;p.elapsedMs=p.windupMs+p.activeMs*.6;const hit=boxingPose(a);
  return load.head.y>2&&load.torso>.3&&hit.torso<-.6&&hit.hip<-.4;})()`,
  'Right body hook lowers to the right, loads the torso right and uncorks through contact');
check(`(()=>{const[a]=bodyPosturePair();a._boxing.preparedPunch={kind:'LEFT_STRAIGHT',level:'BODY',amount:1};
  const load=boxingPose(a);return load.head.x>6&&Math.abs(load.head.y)<1.5;})()`,
  'Rear left body straight keeps its forward dip near the centerline');
check(`(()=>{const[a]=bodyPosturePair();a._boxing.preparedPunch={kind:'LEFT_HOOK',level:'BODY',amount:1};
  const load=boxingPose(a);a._boxing.preparedPunch=null;boxingRequestPunch(a,'LEFT_HOOK','BODY',{preparedAmount:1});
  const p=a._boxing.punch;p.elapsedMs=p.windupMs+p.activeMs*.6;const hit=boxingPose(a);
  return load.head.y<-2&&load.torso<-.3&&hit.torso>.6&&hit.hip>.4;})()`,
  'Rear left body hook lowers left, loads the torso left and uncorks through contact');
for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  check(`(()=>{const[a]=bodyPosturePair(true,${angle});const ready=boxingWorldPoint(a,boxingPose(a).head);
    a._boxing.preparedPunch={kind:'RIGHT_JAB',level:'BODY',amount:1};const held=boxingWorldPoint(a,boxingPose(a).head);
    return (held.x-ready.x)*Math.cos(${angle})+(held.y-ready.y)*Math.sin(${angle})>5&&held.z<ready.z-5;})()`,
    'The forward body duck follows aim in world space at '+angle.toFixed(2)+' radians');
}
probe(`isStoryMode=false;resetStoryProgress();startAtLevel(3);isPaused=false;
  leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
  window.__frontierConsumedTouches=new Set();connectedGamepad=()=>null;keyIsDown=()=>false;mouseIsPressed=false;
`);
for(const kind of kinds){
  check(`(()=>{boxingExit(player);player.x=player.y=player.aimAngle=0;player.isMoving=false;boxingEnter(player,[],'SALOON');
    const state={},button=boxingControlLayout().buttons.find(b=>b.action==='${kind}');touches=[{id:71,x:button.x,y:button.y}];deltaTime=20;
    for(let i=0;i<14;i++)boxingReadInput(player,state);const held=boxingPose(player);
    if(player._boxing.punch||player._boxing.attackCount||player._boxing.preparedPunch.kind!=='${kind}')return false;
    touches=[];boxingReadInput(player,state);const p=player._boxing.punch,released=boxingPose(player);
    boxingReadInput(player,state);return p&&p.kind==='${kind}'&&p.level==='BODY'&&player._boxing.attackCount===1&&
      bodyPoseDistance(held,released)<1e-7&&!player._boxing.preparedPunch;})()`,
    kind+' physical touch hold prepares without firing, then releases one continuous BODY strike');
}
for(const kind of kinds){
  const opener=kind.startsWith('RIGHT')?'LEFT_HOOK':'RIGHT_HOOK';
  check(`(()=>{boxingExit(player);player.x=player.y=player.aimAngle=0;player.isMoving=false;
    const opponent={x:40.5,y:0,aimAngle:Math.PI,hp:100,bodyH:27};boxingEnter(opponent,[player],'SALOON');boxingEnter(player,[opponent],'SALOON');
    const state={};touches=[];boxingReadInput(player,state);boxingRequestPunch(player,'${opener}');
    let event;for(let i=0;i<100&&!event;i++)event=boxingUpdate(player,6,[opponent])[0];
    if(!event||event.outcome!=='HIT')return false;
    const button=boxingControlLayout().buttons.find(b=>b.action==='${kind}');touches=[{id:73,x:button.x,y:button.y}];deltaTime=20;
    for(let i=0;i<10;i++){boxingReadInput(player,state);boxingUpdate(player,20,[opponent]);}
    if(!player._boxing.punch||player._boxing.punch.kind!=='${opener}'||player._boxing.preparedPunch.amount!==1)return false;
    const held=boxingPose(player);touches=[];boxingReadInput(player,state);const released=boxingPose(player),p=player._boxing.punch;
    return p&&p.kind==='${kind}'&&p.level==='BODY'&&p.comboIndex===2&&player._boxing.attackCount===2&&
      bodyPoseDistance(held,released)<1e-7;})()`,
    'A real '+opener+' contact can prepare '+kind+' during recovery and release its BODY combo without a pose jump');
}
console.log('Boxing body postures: '+checks+' direction, continuity, physical contact and release checks passed.');

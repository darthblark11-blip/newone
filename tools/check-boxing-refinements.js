// Behavioral checks for responsive boxing: contact-timed continuations,
// release-only body shots, physical slips and weight transfer before contact.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let checks = 0;
function check(code, label) { assert.ok(probe(code), label); checks++; }
probe(`
function refinementPair(distance=40.5) {
  const a={x:0,y:0,aimAngle:0,isPlayer:true,hp:100,bodyH:27},
    b={x:distance,y:0,aimAngle:Math.PI,isPlayer:false,hp:100,bodyH:27};
  boxingEnter(a,[b],'SALOON');boxingEnter(b,[a],'SALOON');return [a,b];
}
function refinementFirstContact(a,b,kind='LEFT_STRAIGHT',level='HEAD') {
  boxingRequestPunch(a,kind,level);let events=[];
  for(let i=0;i<120&&!events.length;i++)events.push(...boxingUpdate(a,6,[b]));
  return events[0]||null;
}
`);
for (const kind of ['LEFT_STRAIGHT', 'RIGHT_JAB', 'LEFT_HOOK', 'RIGHT_HOOK']) {
  check(`(()=>{const[a,b]=refinementPair();let e=refinementFirstContact(a,b,'${kind}');
    return e&&e.outcome==='HIT'&&a._boxing.nowMs<160;})()`, kind+' reaches actual fist contact quickly');
  check(`(()=>{const[a,b]=refinementPair();boxingRequestPunch(b,'${kind}');const p=b._boxing.punch,d=BOXING_PUNCHES['${kind}'];
    return p.windupMs===d.enemyWindupMs+180&&p.activeMs===d.enemyActiveMs&&p.recoveryMs===d.enemyRecoveryMs;})()`,
    kind+' retains readable enemy telegraph and recovery');
}
check(`(()=>{const[a,b]=refinementPair();boxingRequestPunch(a,'LEFT_STRAIGHT');
  return !boxingReserveCombo(a,'RIGHT_JAB')&&!boxingRequestPunch(a,'RIGHT_JAB')&&!a._boxing.queuedPunch;})()`,
  'Pressing early cannot queue a continuation before contact');
check(`(()=>{const[a,b]=refinementPair();const e=refinementFirstContact(a,b);let old=a._boxing.punch;
  if(!e||e.outcome!=='HIT'||!boxingRequestPunch(a,'RIGHT_JAB'))return false;
  if(a._boxing.punch!==old||!a._boxing.queuedPunch||a._boxing.queuedPunch.comboIndex!==2)return false;
  if(boxingRequestPunch(a,'RIGHT_HOOK')||boxingRequestPunch(a,'LEFT_HOOK'))return false;
  boxingUpdate(a,45,[b]);let p=a._boxing.punch;
  return p&&p.kind==='RIGHT_JAB'&&p.comboIndex===2&&p.windupMs<BOXING_PUNCHES.RIGHT_JAB.windupMs&&p.damageScale>1;})()`,
  'A real landed hit accepts one alternating follow-up and starts it after contact, with faster timing');
check(`(()=>{const[a,b]=refinementPair();refinementFirstContact(a,b);
  return !boxingReserveCombo(a,'LEFT_HOOK')&&!boxingRequestPunch(a,'LEFT_HOOK')&&!a._boxing.queuedPunch;})()`,
  'Same-hand spam cannot turn one landed strike into a combo');
check(`(()=>{const[a,b]=refinementPair(95);boxingRequestPunch(a,'LEFT_STRAIGHT');boxingUpdate(a,140,[b]);
  return !boxingReserveCombo(a,'RIGHT_JAB')&&!boxingRequestPunch(a,'RIGHT_JAB')&&!a._boxing.queuedPunch;})()`,
  'A miss gives no continuation or recovery cancel');
check(`(()=>{const[a,b]=refinementPair();boxingSetGuard(b,0,-1);b._boxing.guardMs=400;
  const e=refinementFirstContact(a,b);return e&&e.outcome==='BLOCK'&&!boxingReserveCombo(a,'RIGHT_JAB')&&!boxingRequestPunch(a,'RIGHT_JAB');})()`,
  'A blocked punch does not earn the landed-hit combo window');
check(`(()=>{const[a,b]=refinementPair();refinementFirstContact(a,b);boxingUpdate(a,121,[b]);
  return !boxingReserveCombo(a,'RIGHT_JAB')&&!boxingRequestPunch(a,'RIGHT_JAB');})()`,
  'A late follow-up cannot cancel recovery after the timing window closes');
check(`(()=>{const[a,b]=refinementPair();refinementFirstContact(a,b);const intent=boxingReserveCombo(a,'RIGHT_JAB');
  boxingUpdate(a,230,[b]);return intent&&boxingRequestPunch(a,'RIGHT_JAB','BODY',{comboIntent:intent,preparedAmount:1})&&
    a._boxing.punch.level==='BODY'&&a._boxing.punch.comboIndex===2&&a._boxing.punch.preparedAmount===1;})()`,
  'A timely press preserves the earned combo while preparing a body shot, which fires on release');
check(`(()=>{const[a,b]=refinementPair();refinementFirstContact(a,b);const intent=boxingReserveCombo(a,'RIGHT_JAB');
  boxingUpdate(a,421,[b]);return boxingRequestPunch(a,'RIGHT_JAB','BODY',{comboIntent:intent,preparedAmount:1})&&a._boxing.punch.comboIndex===1;})()`,
  'An excessively long hold expires its combo reservation and still releases an ordinary body shot');
check(`(()=>{const[a,b]=refinementPair();let hits=[];
  for(let i=0;i<7;i++){
    const kind=i%2?'RIGHT_JAB':'LEFT_STRAIGHT';if(!boxingRequestPunch(a,kind))return false;
    let event=null;for(let f=0;f<60&&!event;f++)event=boxingUpdate(a,6,[b]).find(e=>e.outcome==='HIT');
    if(!event)return false;hits.push(event);boxingUpdate(a,30,[b]);
  }
  return hits.length===7&&hits[0].comboIndex===1&&hits[6].comboIndex===4&&hits.every(e=>e.damage<=BOXING_PUNCHES[e.kind].damage*1.24+.0001);
})()`, 'Sustained alternating contact chains cap the reward rather than escalating indefinitely');
check(`(()=>{const[a,b]=refinementPair();boxingRequestDodge(a,1);a._boxing.dodge.elapsedMs=150;
  boxingRequestPunch(a,'LEFT_STRAIGHT');const p=a._boxing.punch,pose=boxingPose(a);
  return p.slipSide===1&&p.slipAmount===1&&pose.head.y>10&&pose.body.y<7;
})()`, 'Right slip and southpaw left counter share the real displaced head geometry');
check(`(()=>{const[a,b]=refinementPair();boxingRequestDodge(a,1);a._boxing.dodge.elapsedMs=150;
  boxingRequestPunch(a,'RIGHT_JAB');return a._boxing.punch.slipSide===0;
})()`, 'The slip counter links the driving opposite hand rather than rewarding every sway-punch pairing');
check(`(()=>{const[a,b]=refinementPair();const before=boxingPose(a);
  a._boxing.preparedPunch={kind:'LEFT_STRAIGHT',level:'BODY',amount:1};const held=boxingPose(a);
  return !a._boxing.punch&&held.head.z<before.head.z-5&&held.head.x>before.head.x+5&&held.body.z<before.body.z&&held.legCompression>.5;
})()`, 'Body preparation visibly lowers the head, torso and knees before a fist starts travelling');
check(`(()=>{const[a,b]=refinementPair();boxingRequestPunch(b,'RIGHT_HOOK','BODY');b._boxing.punch.elapsedMs=b._boxing.punch.windupMs*.7;
  const pose=boxingPose(b);return pose.phase==='WINDUP'&&pose.levelChange>.95&&pose.head.z<23&&pose.head.x>6;
})()`, 'Enemy body-shot telegraphs change level before the active strike');
check(`(()=>{const[a,b]=refinementPair();boxingRequestPunch(a,'LEFT_HOOK');a._boxing.punch.elapsedMs=a._boxing.punch.windupMs+a._boxing.punch.activeMs*.6;
  const p=boxingPose(a);return Math.abs(p.torso)>.7&&Math.abs(p.hip)>.4&&p.feet[0].lift>1&&Math.abs(p.feet[0].heading-.12)>.3;
})()`, 'A hook drives from hip rotation and a pivoting power heel');

// Actual native input code, not a duplicate of hold or release logic.
probe(`isStoryMode=false;resetStoryProgress();startAtLevel(3);isPaused=false;
  leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
  window.__frontierConsumedTouches=new Set();window.__refinementKeys=new Set();
  connectedGamepad=()=>null;keyIsDown=code=>window.__refinementKeys.has(code);
  function refinementInputActor(){boxingExit(player);player.x=0;player.y=0;player.aimAngle=0;player.isMoving=false;
    boxingEnter(player,[],'SALOON');touches=[];mouseIsPressed=false;isPaused=false;window.__refinementKeys.clear();return {};}
`);
for(const [kind,keyCode,padButton] of [['LEFT_STRAIGHT',69,6],['RIGHT_JAB',82,7],['LEFT_HOOK',81,4],['RIGHT_HOOK',84,5]]) {
  check(`(()=>{const state=refinementInputActor(),button=boxingControlLayout().buttons.find(b=>b.action==='${kind}');
    touches=[{id:17,x:button.x,y:button.y}];deltaTime=20;
    for(let i=0;i<14;i++)boxingReadInput(player,state);
    const before=boxingPose(player),held=player._boxing.preparedPunch;
    if(player._boxing.punch||player._boxing.attackCount!==0||!held||held.amount!==1||before.levelChange!==1)return false;
    touches=[];boxingReadInput(player,state);const p=player._boxing.punch;
    boxingReadInput(player,state);return p&&p.kind==='${kind}'&&p.level==='BODY'&&p.preparedAmount===1&&player._boxing.attackCount===1&&!player._boxing.preparedPunch;})()`,
    kind+' touch hold prepares only, release launches exactly one BODY shot');
  check(`(()=>{const state=refinementInputActor();window.__refinementKeys.add(${keyCode});deltaTime=20;
    for(let i=0;i<14;i++)boxingReadInput(player,state);
    if(player._boxing.punch||player._boxing.attackCount!==0)return false;
    window.__refinementKeys.clear();boxingReadInput(player,state);return player._boxing.punch&&player._boxing.punch.kind==='${kind}'&&player._boxing.punch.level==='BODY';})()`,
    kind+' keyboard hold follows the same release-only BODY contract');
  check(`(()=>{const state=refinementInputActor(),pad={connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false}))};
    connectedGamepad=()=>pad;pad.buttons[${padButton}].pressed=true;deltaTime=20;
    for(let i=0;i<14;i++)boxingReadInput(player,state);
    if(player._boxing.punch||player._boxing.attackCount!==0){connectedGamepad=()=>null;return false;}
    pad.buttons[${padButton}].pressed=false;boxingReadInput(player,state);connectedGamepad=()=>null;
    return player._boxing.punch&&player._boxing.punch.kind==='${kind}'&&player._boxing.punch.level==='BODY';})()`,
    kind+' gamepad hold follows the same release-only BODY contract');
}
check(`(()=>{const state=refinementInputActor();window.__refinementKeys.add(69);deltaTime=20;boxingReadInput(player,state);
  window.__refinementKeys.clear();boxingReadInput(player,state);return player._boxing.punch.level==='HEAD'&&player._boxing.attackCount===1;})()`,
  'A brief physical tap remains a fast head strike');
check(`(()=>{const state=refinementInputActor(),b={x:40.5,y:0,aimAngle:Math.PI,hp:100,bodyH:27};boxingEnter(b,[player],'SALOON');
  boxingTarget(player,[b]);boxingRequestPunch(player,'LEFT_STRAIGHT');
  const button=boxingControlLayout().buttons.find(b=>b.action==='RIGHT_JAB');touches=[{id:31,x:button.x,y:button.y}];
  deltaTime=16;boxingReadInput(player,state);let events=[];for(let i=0;i<40&&!events.length;i++)events=boxingUpdate(player,6,[b]);
  if(!events.some(e=>e.outcome==='HIT'))return false;
  touches=[];boxingReadInput(player,state);
  return player._boxing.attackCount===1&&!player._boxing.queuedPunch&&player._boxing.punch.kind==='LEFT_STRAIGHT';})()`,
  'A physical press before contact cannot earn a combo by releasing immediately after the hit');
check(`(()=>{const state=refinementInputActor(),b={x:40.5,y:0,aimAngle:Math.PI,hp:100,bodyH:27};boxingEnter(b,[player],'SALOON');
  boxingTarget(player,[b]);refinementFirstContact(player,b);
  const button=boxingControlLayout().buttons.find(b=>b.action==='RIGHT_JAB');touches=[{id:32,x:button.x,y:button.y}];
  deltaTime=20;for(let i=0;i<13;i++){boxingReadInput(player,state);boxingUpdate(player,20,[b]);}
  if(player._boxing.attackCount!==1||!player._boxing.preparedPunch||player._boxing.preparedPunch.amount!==1)return false;
  touches=[];boxingReadInput(player,state);const p=player._boxing.punch;
  return p&&p.kind==='RIGHT_JAB'&&p.level==='BODY'&&p.comboIndex===2&&player._boxing.attackCount===2;})()`,
  'A physical press just after a landed hit can hold its body preparation and release an earned combo');
check(`(()=>{const state=refinementInputActor(),button=boxingControlLayout().buttons.find(b=>b.action==='LEFT_STRAIGHT');
  touches=[{id:18,x:button.x,y:button.y}];deltaTime=20;for(let i=0;i<14;i++)boxingReadInput(player,state);
  isPaused=true;boxingReadInput(player,state);isPaused=false;touches=[];boxingReadInput(player,state);
  return !player._boxing.punch&&!player._boxing.preparedPunch&&!player._boxing.queuedPunch&&player._boxing.attackCount===0;})()`,
  'Pausing a charged body shot consumes the held touch and cannot launch it on resume');
check(`(()=>{const state=refinementInputActor(),button=boxingControlLayout().buttons.find(b=>b.action==='LEFT_STRAIGHT');
  touches=[{id:19,x:button.x,y:button.y}];deltaTime=20;for(let i=0;i<14;i++)boxingReadInput(player,state);
  boxingLeaveInput(player,state);boxingExit(player);touches=[];return !player._boxing;
})()`, 'Leaving the stance drops all held body preparation and continuation state');
check(`(()=>{const state=refinementInputActor(),pad={connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false}))};
  connectedGamepad=()=>pad;pad.buttons[7].pressed=true;deltaTime=20;for(let i=0;i<14;i++)boxingReadInput(player,state);
  connectedGamepad=()=>null;boxingReadInput(player,state);
  if(player._boxing.punch||player._boxing.preparedPunch||player._boxing.attackCount||Array.from(state.held.keys()).some(id=>id.startsWith('PAD_')))return false;
  connectedGamepad=()=>pad;boxingReadInput(player,state);
  if(player._boxing.punch||player._boxing.attackCount)return false;
  pad.buttons[7].pressed=false;boxingReadInput(player,state);connectedGamepad=()=>null;
  return player._boxing.attackCount===1&&player._boxing.punch.level==='HEAD';})()`,
  'Disconnect cancels a controller BODY hold; reconnect waits for a deliberate fresh release');
check(`(()=>{const state=refinementInputActor(),pad={connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false}))},
    button=boxingControlLayout().buttons.find(b=>b.action==='RIGHT_JAB');connectedGamepad=()=>pad;pad.buttons[7].pressed=true;
  touches=[{id:35,x:button.x,y:button.y}];deltaTime=20;for(let i=0;i<14;i++)boxingReadInput(player,state);
  connectedGamepad=()=>null;boxingReadInput(player,state);
  if(player._boxing.punch||player._boxing.preparedPunch.kind!=='RIGHT_JAB'||player._boxing.preparedPunch.amount!==1)return false;
  touches=[];boxingReadInput(player,state);return player._boxing.attackCount===1&&player._boxing.punch.kind==='RIGHT_JAB'&&player._boxing.punch.level==='BODY';})()`,
  'Controller loss preserves another finger’s independent prepared BODY strike');
check(`(()=>{const state=refinementInputActor(),layout=boxingControlLayout(),left=layout.buttons.find(b=>b.action==='LEFT_HOOK'),right=layout.buttons.find(b=>b.action==='RIGHT_HOOK');
  touches=[{id:36,x:left.x,y:left.y},{id:37,x:right.x,y:right.y}];deltaTime=20;for(let i=0;i<14;i++)boxingReadInput(player,state);
  touches=[{id:37,x:right.x,y:right.y}];boxingReadInput(player,state);
  if(player._boxing.attackCount!==1||player._boxing.punch.kind!=='LEFT_HOOK'||player._boxing.punch.level!=='BODY'||
    player._boxing.preparedPunch.kind!=='RIGHT_HOOK'||player._boxing.preparedPunch.amount!==1||!state.touches.has(37))return false;
  for(let i=0;i<20;i++){boxingReadInput(player,state);boxingUpdate(player,20,[]);}
  touches=[];boxingReadInput(player,state);
  return player._boxing.attackCount===2&&player._boxing.punch.kind==='RIGHT_HOOK'&&player._boxing.punch.level==='BODY'&&!player._boxing.preparedPunch;})()`,
  'Releasing one charged touch preserves the other hold and never emits its strike prematurely');
console.log('Boxing refinements: '+checks+' contact, timing, stance and native input checks passed.');

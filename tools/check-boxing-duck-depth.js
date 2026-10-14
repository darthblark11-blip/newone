// A punch crossing a lateral slip, or hook above a forward duck, keeps its one
// real fist above the slipping silhouette without changing physical contact.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let checks = 0;
function check(code, name) { assert.ok(probe(code), name); checks++; }
probe(`isStoryMode=false;townsData={};startAtLevel(3);started=true;doTick=false;
  explosiveArmorUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=false;
  var depthPaintEvents=[],depthPaintArm=paintBoxingArm,depthPaintHead=drawFigureHead;
  paintBoxingArm=function(g,e,a,r,s,pass='ALL'){
    if(pass==='FOREARM')depthPaintEvents.push(e.depthName+':'+a.side+':FIST');
    return depthPaintArm(g,e,a,r,s,pass);
  };
  drawFigureHead=function(g,e,...args){depthPaintEvents.push(e.depthName+':HEAD');return depthPaintHead(g,e,...args);};
  function depthBoxer(name,x,y,angle){return {depthName:name,x,y,aimAngle:angle,hp:100,
    bodyW:18,bodyH:26,shirtCol:color(90,120,160),pantsCol:color(50,70,90),skinCol:color(230,175,135),
    decals:[],show(){push();translate(this.x,this.y);scale(boxingRenderScale(this));paintBoxingFigure(this);pop();}};}
  function setupDepthPair(angle,kind='LEFT_HOOK',level='HEAD',dodge='FORWARD',reverse=false,playerDefender=false){
    depthPaintEvents=[];
    window.depthAttacker=depthBoxer('ATTACKER',0,0,angle);
    window.depthDefender=depthBoxer('DEFENDER',42*Math.cos(angle),42*Math.sin(angle),angle+PI);
    depthDefender.isPlayer=playerDefender;
    boxingEnter(depthAttacker,[depthDefender],'SALOON');boxingEnter(depthDefender,[depthAttacker],'SALOON');
    boxingRequestDodge(depthDefender,dodge);depthDefender._boxing.dodge.elapsedMs=150;
    boxingRequestPunch(depthAttacker,kind,level);
    depthAttacker._boxing.punch.elapsedMs=depthAttacker._boxing.punch.windupMs+depthAttacker._boxing.punch.activeMs*.68;
    _depthActors.length=0;_depthOn=false;_legacyActorsQueued=true;
    actorShow(reverse?depthDefender:depthAttacker);actorShow(reverse?depthAttacker:depthDefender);
    drawLegacyActors();
  }`);
for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  for (const kind of ['LEFT_HOOK', 'RIGHT_HOOK']) {
    probe(`setupDepthPair(${angle},'${kind}');`);
    const side = kind === 'LEFT_HOOK' ? -1 : 1;
    check(`depthPaintEvents.indexOf('ATTACKER:${side}:FIST')>depthPaintEvents.indexOf('DEFENDER:HEAD')`,
      `${kind} passes visibly above ducked head facing ${angle}`);
    check(`depthPaintEvents.filter(e=>e==='ATTACKER:${side}:FIST').length===1 && depthPaintEvents.length===6`,
      'Both complete figures retain exactly one head and two fists');
    check('_boxingFigurePass===null && _depthActors.length===0', 'The frame leaves no deferred limb or stale actor');
    probe(`setupDepthPair(${angle},'${kind}','HEAD','FORWARD',true);`);
    check(`depthPaintEvents.indexOf('ATTACKER:${side}:FIST')>depthPaintEvents.indexOf('DEFENDER:HEAD') && depthPaintEvents.length===6`,
      'Reverse actor depth already paints the elevated hook correctly without duplicating it');
  }
}
for (const [kind, level, dodge] of [['LEFT_STRAIGHT','HEAD','FORWARD'], ['RIGHT_HOOK','BODY','FORWARD'], ['LEFT_HOOK','BODY','RIGHT'], ['RIGHT_HOOK','HEAD','BACK']]) {
  probe(`setupDepthPair(0,'${kind}','${level}','${dodge}');`);
  check(`depthPaintEvents.indexOf('ATTACKER:${kind.startsWith('LEFT') ? -1 : 1}:FIST')<depthPaintEvents.indexOf('DEFENDER:HEAD')`,
    `${kind} ${level} against ${dodge} retains normal actor depth`);
}
for(const dodge of ['LEFT','RIGHT'])for(const angle of [0,.63,Math.PI/2,Math.PI,-Math.PI/2]){
  for(const kind of ['LEFT_STRAIGHT','RIGHT_JAB','LEFT_HOOK','RIGHT_HOOK']){
    const side=kind.startsWith('LEFT')?-1:1;
    probe(`setupDepthPair(${angle},'${kind}','HEAD','${dodge}');`);
    check(`depthPaintEvents.indexOf('ATTACKER:${side}:FIST')>depthPaintEvents.indexOf('DEFENDER:HEAD') &&
      depthPaintEvents.filter(e=>e==='ATTACKER:${side}:FIST').length===1 && depthPaintEvents.length===6`,
      `${kind} crosses above the ${dodge.toLowerCase()} slip's head/torso at facing ${angle}`);
    if(!kind.includes('HOOK'))check(`!boxingHurtContact(depthDefender,
      boxingWorldPoint(depthAttacker,boxingPose(depthAttacker).arms.find(a=>a.striking).fist),'HEAD')`,
      'Drawing a straight above the slipped silhouette does not turn its physical miss into a hit');
    probe(`depthPaintEvents=[];
      depthAttacker._boxing.punch.elapsedMs=depthAttacker._boxing.punch.windupMs+depthAttacker._boxing.punch.activeMs+.1;
      _legacyActorsQueued=true;actorShow(depthAttacker);actorShow(depthDefender);drawLegacyActors();`);
    check(`depthPaintEvents.indexOf('ATTACKER:${side}:FIST')>depthPaintEvents.indexOf('DEFENDER:HEAD') && depthPaintEvents.length===6`,
      'A returning punch keeps its crossing depth at the active/recovery boundary');
    probe(`setupDepthPair(${angle},'${kind}','HEAD','${dodge}',true);`);
    check(`depthPaintEvents.indexOf('ATTACKER:${side}:FIST')>depthPaintEvents.indexOf('DEFENDER:HEAD') && depthPaintEvents.length===6`,
      'Opposite ground order paints the same crossing punch above the slip without a second glove');
  }
}
for(const kind of ['LEFT_HOOK','RIGHT_HOOK']){
  probe(`setupDepthPair(0,'${kind}');depthPaintEvents=[];
    depthAttacker._boxing.punch.elapsedMs=depthAttacker._boxing.punch.windupMs+depthAttacker._boxing.punch.activeMs+.1;
    _legacyActorsQueued=true;actorShow(depthAttacker);actorShow(depthDefender);drawLegacyActors();`);
  check(`depthPaintEvents.indexOf('ATTACKER:${kind==='LEFT_HOOK'?-1:1}:FIST')>depthPaintEvents.indexOf('DEFENDER:HEAD') && depthPaintEvents.length===6`,
    'An elevated returning hook preserves its depth across the active/recovery boundary');
}
for(const dodge of ['LEFT','RIGHT','FORWARD','BACK'])for(const angle of [0,.63,Math.PI/2,Math.PI,-Math.PI/2]){
  for(const level of ['HEAD','BODY'])for(const kind of ['LEFT_STRAIGHT','RIGHT_JAB','LEFT_HOOK','RIGHT_HOOK']){
    const side=kind.startsWith('LEFT')?-1:1;
    probe(`setupDepthPair(${angle},'${kind}','${level}','${dodge}',false,true);`);
    check(`['DEFENDER:-1:FIST','DEFENDER:1:FIST'].every(e=>depthPaintEvents.indexOf(e)<depthPaintEvents.indexOf('DEFENDER:HEAD')) &&
      depthPaintEvents.length===6`, 'Both player arms sit beneath the head during '+dodge+' against '+level+' '+kind);
    check(`(()=>{const pose=boxingPose(depthDefender),a=boxingPose(depthAttacker).arms.find(a=>a.striking),
      p=boxingWorldPoint(depthDefender,pose.head),body=boxingWorldPoint(depthDefender,pose.body),
      elbow=boxingWorldPoint(depthAttacker,a.elbow),fist=boxingWorldPoint(depthAttacker,a.fist),
      flat=p=>({...p,z:0}),rig=figureRig(depthAttacker.bodyW,depthAttacker.bodyH),
      overlaps=boxingSegmentDistance(flat(p),flat(elbow),flat(fist))<=pose.head.r+rig.foreW*.4 ||
        boxingSegmentDistance(flat(body),flat(elbow),flat(fist))<=Math.max(pose.body.rx,pose.body.ry)+rig.foreW*.4;
      return !overlaps||depthPaintEvents.indexOf('ATTACKER:${side}:FIST')>depthPaintEvents.indexOf('DEFENDER:HEAD');})()`,
      'A crossing enemy '+level+' '+kind+' remains above the player head/body during '+dodge);
    check(`depthPaintEvents.filter(e=>e==='ATTACKER:${side}:FIST').length===1 && _boxingFigurePass===null &&
      ['ATTACKER:-1:FIST','ATTACKER:1:FIST'].every(e=>depthPaintEvents.indexOf(e)>depthPaintEvents.indexOf('ATTACKER:HEAD'))`,
      'Enemy arms stay above their own head, with one incoming fist and no stale deferred pass');
  }
}
for(const dodge of ['LEFT','RIGHT','FORWARD','BACK'])for(const kind of ['LEFT_STRAIGHT','RIGHT_JAB','LEFT_HOOK','RIGHT_HOOK']){
  if(dodge==='LEFT'&&kind.startsWith('LEFT')||dodge==='RIGHT'&&kind.startsWith('RIGHT'))continue;
  probe(`setupDepthPair(0,'LEFT_HOOK','HEAD','${dodge}',false,true);
    boxingRequestPunch(depthDefender,'${kind}');depthDefender._boxing.dodge=null;
    depthPaintEvents=[];_legacyActorsQueued=true;actorShow(depthAttacker);actorShow(depthDefender);drawLegacyActors();`);
  check(`['DEFENDER:-1:FIST','DEFENDER:1:FIST'].every(e=>depthPaintEvents.indexOf(e)<depthPaintEvents.indexOf('DEFENDER:HEAD')) && depthPaintEvents.length===6`,
    'A carried '+dodge+' counter keeps the player head above both arms for '+kind);
}
// Verify actual furniture/actor interleaving, rather than a limb-only helper.
probe(`setupDepthPair(PI/2);depthPaintEvents=[];
  var depthOriginalMass=drawMassRun,depthOriginalView=inView;
  drawMassRun=function(arr,start,end){for(let i=start;i<end;i++)depthPaintEvents.push(arr[i].depthName);};inView=()=>true;
  activeBuildings=[{x:0,y:25,w:4,h:4,depthName:'MID_TABLE'},{x:0,y:80,w:4,h:4,depthName:'FRONT_WALL'}];
  _standDecor.length=0;_depthActors.length=0;_depthOn=true;
  actorShow(depthDefender);actorShow(depthAttacker);drawDepthSorted();
  drawMassRun=depthOriginalMass;inView=depthOriginalView;activeBuildings=[];`);
check(`depthPaintEvents.indexOf('MID_TABLE')<depthPaintEvents.indexOf('DEFENDER:HEAD') &&
  depthPaintEvents.indexOf('DEFENDER:HEAD')<depthPaintEvents.indexOf('ATTACKER:-1:FIST') &&
  depthPaintEvents.indexOf('ATTACKER:-1:FIST')<depthPaintEvents.indexOf('FRONT_WALL')`,
  'A duck-crossing hook stays inside the real furniture depth pass, below nearer architecture');
// Simulate a painter exception after a limb is deferred; next frame is clean.
probe(`setupDepthPair(0);depthPaintEvents=[];
  var depthOriginalDefenderShow=depthDefender.show;
  depthDefender.show=()=>{throw new Error('depth paint fault');};
  _depthActors.length=0;_legacyActorsQueued=true;actorShow(depthAttacker);actorShow(depthDefender);
  try{drawLegacyActors();}catch(e){if(e.message!=='depth paint fault')throw e;}
  depthDefender.show=depthOriginalDefenderShow;`);
check('_boxingFigurePass===null && _depthActors.length===0 && !_legacyActorsQueued',
  'An interrupted painter cannot leak an elevated limb into the next frame');
probe('paintBoxingArm=depthPaintArm;drawFigureHead=depthPaintHead;');
console.log(`Boxing duck depth: ${checks} production renderer checks passed.`);

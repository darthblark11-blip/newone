// Exercise real corpse controllers against solid wall faces. These checks
// inspect world positions and state transitions, rather than mirroring the
// collision math in the implementation.
const assert=require('node:assert/strict');
const {ctx,probe,mkG}=require('./harness');
const P=s=>probe('('+s+')');
let seed=32117;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;
  return a===undefined?r:Array.isArray(a)?a[Math.floor(r*a.length)]:b===undefined?r*a:a+(b-a)*r;};
probe(`isStoryMode=false;townsData={};startAtLevel(1);started=true;doTick=true;
  currentLevel=currentBiome=1;BIOME_ACTIVE=false;enemiesList=[];corpses=[];
  activeBuildings=buildings=[];activeParkingCars=[];parkingCars=[];barrels=[];
  invalidateColIndex();viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;
  player.x=player.y=10000;`);
function room(a=0,props=''){
  const x=Math.cos(a)*40,y=Math.sin(a)*40,vertical=Math.abs(Math.cos(a))>.5;
  probe(`window.wall={x:${x},y:${y},w:${vertical?8:700},h:${vertical?700:8},isWall:true${props}};
    activeBuildings=buildings=[wall];activeParkingCars=[];barrels=[];invalidateColIndex();`);
}
function drop(type=10,facing=0,x=0,y=0){
  probe(`frameCount++;window.e=new Character(${x},${y},false,'NORMAL');e.aimAngle=e.moveAngle=${facing};
    rememberFigureMotion(e,0,0);e.fallHit={frame:frameCount,kind:'BODY',angle:${facing+Math.PI},force:3,mx:0,my:0};
    window.c=new Corpse(e.x,e.y,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,${type},0,e.decals,e.currentWeapon,0,e.eType,e.bodyW,e.bodyH,e);`);
}
function tick(n=1){probe(`for(let n=0;n<${n};n++){frameCount++;c.update();}`);}
// Include real firearm metadata: those deaths share the newer ballistic body
// anatomy. The metadata-free fixtures below deliberately retain legacy cases.
function blastDrop(type=18,angle=0,weapon=null){
  const gun=weapon!==null;
  probe(`frameCount++;particles=[];corpses=[];window.e=new Character(0,0,false,'NORMAL');
    e.aimAngle=e.moveAngle=${angle+Math.PI};rememberFigureMotion(e,0,0);
    e.decals=[{x:3,y:2,sz:5,col:[251,1,225,255],isBulletHole:true}];
    e.fallHit={frame:frameCount,kind:${JSON.stringify(gun?'BODY':'BLAST')},
      ${gun?`weapon:WEAPONS.${weapon},wound:e.decals[0],fatal:true,`:''}
      angle:${angle},force:6,mx:0,my:0};
    c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,${type},0,e.decals,
      e.currentWeapon,${angle},e.eType,e.bodyW,e.bodyH,e);corpses=[c];`);
}
const families=[[5,'bits'],[9,'bits'],[10,'overkillBits'],[11,'aerialBits'],[14,'halves'],[15,'overkillBits']];
let trajectories=0;
for(const [type,key] of families)for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  room(angle);drop(type);
  probe(`window.pieces=${key==='halves'?'[c.lH,c.rH]':`c.${key}`};
    for(const p of pieces){p.x=p.y=0;p.vx=Math.cos(${angle})*8;p.vy=Math.sin(${angle})*8;p.vr=0;}`);
  for(let frame=0;frame<200;frame++){
    tick();
    if(frame===0)assert(P('pieces.some(p=>Math.hypot(p.x,p.y)>1)'),
      `death ${type} never launched its debris`);
    assert(P(`pieces.every(p=>(c.x+p.x)*Math.cos(${angle})+(c.y+p.y)*Math.sin(${angle})<=36.0001)`),
      `death ${type} passed through wall at angle ${angle}, frame ${frame}`);
    assert(P('pieces.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))'),'debris position became nonfinite');
  }
  assert(P('!corpsePiecesMoving(c)'),`death ${type} never finished moving`);
  const frozen=P('pieces.map(p=>[p.x,p.y,p.rot||0])');tick(80);
  assert.deepEqual(P('pieces.map(p=>[p.x,p.y,p.rot||0])'),frozen,'resting pieces changed position');
  trajectories++;
}
for(const type of [2,4])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  room(angle);drop(type);probe(`c.bA=${angle};`);
  for(let frame=0;frame<200;frame++){
    tick();
    assert(P(`(c.x+c.separatedTorso.x)*Math.cos(${angle})+(c.y+c.separatedTorso.y)*Math.sin(${angle})<=36.0001`),
      `shotgun torso death ${type} passed through wall at ${angle}`);
  }
  assert(P('!!c.separatedTorso.wallImpact'),'shotgun torso did not react to wall');
  assert(P('!corpsePiecesMoving(c)'),'shotgun torso wall reaction never finished');
  trajectories++;
}
for(const type of [3,13])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  room(angle);drop(type);
  probe(type===3?`c.mA=${angle+Math.PI/2};`:`c.aA=${angle};`);
  for(let frame=0;frame<200;frame++){
    tick();
    assert(P(`c.splitPieces.every(p=>(c.x+p.x)*Math.cos(${angle})+(c.y+p.y)*Math.sin(${angle})<=36.0001)`),
      `split death ${type} passed through wall at ${angle}, frame ${frame}`);
  }
  assert(P('!!c.splitPieces[1].wallImpact'),'separated torso did not react to wall');
  assert(P('!corpsePiecesMoving(c)'),'separated torso wall reaction never finished');
  trajectories++;
}
let ballisticTrajectories=0;
const ballisticDeaths=[[18,null],[19,null],[20,null],[2,'SHOTGUN'],[10,'DUAL_SMG']];
for(const [type,weapon] of ballisticDeaths)for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  room(angle);blastDrop(type,angle,weapon);
  assert(P('!!c.blast'),`death ${type} did not use actual ballistic anatomy`);
  if(weapon)assert(P('!!c.blast.mode'),'firearm metadata did not select firearm body pieces');
  probe(`window.parts=c.blast.parts;window.pieces=parts.concat(c.blast.gibs);
    for(const p of pieces){p.x=p.y=p.z=0;p.vx=Math.cos(${angle})*8;p.vy=Math.sin(${angle})*8;p.vz=0;p.vr=0;}`);
  let pinned=false;
  for(let frame=0;frame<240;frame++){
    tick();
    assert(P(`pieces.every(p=>(c.x+p.x)*Math.cos(${angle})+(c.y+p.y)*Math.sin(${angle})<=36.0001)`),
      `ballistic death ${type} tunneled through wall at ${angle}, frame ${frame}`);
    assert(P('pieces.every(p=>[p.x,p.y,p.z,p.rot].every(Number.isFinite))'),'ballistic wall contact became nonfinite');
    if(P('parts.some(p=>p.wallImpact&&!p.wallImpact.done)'))pinned=true;
  }
  assert(pinned,`ballistic death ${type} never held a surviving torso against wall`);
  assert(P('c.blast.done&&pieces.every(p=>p.landed&&p.z===0)&&!corpsePiecesMoving(c)'),
    `ballistic death ${type} did not finish on the floor`);
  const frozen=P('JSON.stringify(c.blast)');tick(40);
  assert.equal(P('JSON.stringify(c.blast)'),frozen,'settled ballistic corpse changed');
  ballisticTrajectories++;
}
// The actual explosive sword-finisher route must feed the same collision
// controller, including each of its three dismemberment variants.
for(let index=0;index<3;index++){
  room();probe(`explosionDeathCounter=${index};frameCount++;particles=[];corpses=[];
    window.e=new Character(0,0,false,'NORMAL');e.hp=1;e.isFriendly=e.isNeutral=false;
    rememberFigureMotion(e,0,0);enemiesList=[e];new Shockwave(-30,0,0,true,player).update();c=corpses[0];`);
  assert(P(`c&&c.blast&&!c.sword&&c.dT===${18+index}`),'explosive finisher did not enter shared ballistic corpse');
  let pinned=false;
  for(let frame=0;frame<180;frame++){
    tick();if(P('c.blast.parts.some(p=>p.wallImpact&&!p.wallImpact.done)'))pinned=true;
    assert(P('c.blast.parts.every(p=>c.x+p.x<=36.0001)'),'actual finisher body crossed its wall');
  }
  assert(pinned,'actual explosive finisher torso never pinned against its wall');
}
// A thin obstacle must catch a fast piece even when its destination is on the
// opposite side of the wall. A destination-overlap test misses this entirely.
room();drop(10);
probe('window.piece=c.overkillBits[0];piece.vx=140;piece.vy=0;piece.vr=0;');tick();
assert(P('c.x+piece.x<=36.0001'),'fast torso tunneled through a thin wall');
assert(P('!!piece.wallImpact'),'fast torso hit did not begin wall reaction');
assert(P('piece.wallImpact.z>0'),'wall impact did not lift torso upright');
const firstZ=P('corpsePiecePose(piece).z');
let held=false,slid=false;
for(let frame=0;frame<160;frame++){
  tick();const impact=P('piece.wallImpact');
  if(impact&&!impact.done&&impact.age<impact.hold)held=true;
  const z=P('corpsePiecePose(piece).z');
  if(impact&&z>0&&z<firstZ-.1)slid=true;
}
assert(held,'torso did not visibly hold against the wall');
assert(slid,'torso did not slide down from the wall');
assert(P('piece.wallImpact.done&&corpsePiecePose(piece).z===0'),'torso did not finish laying on the floor');
// Reaching two perpendicular faces in one motion must resolve both before a
// torso becomes pinned; otherwise the frozen hold keeps it inside one wall.
room();drop(10);
probe(`activeBuildings=buildings=[wall,{x:0,y:40,w:700,h:8,isWall:true}];invalidateColIndex();
  window.piece=c.overkillBits[0];piece.vx=piece.vy=8;piece.vr=0;`);
for(let frame=0;frame<90;frame++){
  tick();
  assert(P('!corpsePieceContact(c,c.x+piece.x,c.y+piece.y,corpsePieceRadius(c,piece))'),
    'corner wall reaction froze torso while penetrating its second wall');
}
// An already pinned torso must finish sliding and retire after the player
// leaves; its wall reaction must not become an immortal off-screen object.
room();drop(10);
probe('c.overkillBits[0].vx=8;c.overkillBits[0].vy=0;');tick(5);
assert(P('!!c.overkillBits[0].wallImpact'),'off-screen fixture never hit its wall');
probe(`corpses=[c];viewLeft=viewTop=10000;viewRight=viewBottom=11000;
  for(let n=0;n<400;n++){frameCount++;updateCorpses();}`);
assert(P('!corpsePiecesMoving(c)&&!corpses.includes(c)'), 'off-screen wall reaction prevented corpse retirement');
probe('viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;');
// Walkable flat surfaces still let the original debris travel across them.
room(0,',isDeck:true');drop(10);
probe('for(const p of c.overkillBits){p.vx=8;p.vy=0;p.vr=0;}');tick(60);
assert(P('c.overkillBits[0].x>44'),'walkable deck blocked flying corpse');

// Breaching a fortress opens its doorway, while the surviving wings remain
// solid despite the slab's zero HP. Drive actual debris through both routes.
probe(`window.__corpseWallSouthBreached=window.southGateBreachedStatus;
  window.southGateBreachedStatus=true;
  window.breachedWall={x:0,y:40,w:1600,h:8,isGovFortress:true,hp:0};
  activeBuildings=buildings=[breachedWall];invalidateColIndex();buildColIndex();`);
assert(P('gateIsOpen(breachedWall)&&inOpenGateway(breachedWall,0)'),
  'breached fortress fixture did not open its real doorway');
for(const x of [0,600]){
  drop(10,0,x,0);
  probe('for(const p of c.overkillBits){p.vx=0;p.vy=8;p.vr=0;}');tick(80);
  if(x===0)assert(P('c.overkillBits[0].y>44&&!c.overkillBits[0].wallImpact'),
    'open fortress doorway blocked corpse debris');
  else assert(P('c.y+c.overkillBits[0].y<=36&&!!c.overkillBits[0].wallImpact&&c.overkillBits[0].wallImpact.b===breachedWall'),
    'breached fortress wing lost its corpse collision when HP reached zero');
}
probe('window.southGateBreachedStatus=window.__corpseWallSouthBreached;');

// Back-to-wall deaths use a persistent seated body. A wall in front or at the
// side must not manufacture that pose.
for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  room(angle);
  for(const type of [0,1,6,8,9]){
    drop(type,angle+Math.PI,Math.cos(angle)*20,Math.sin(angle)*20);
    assert(P('!!c.wallSit'),`rear wall did not seat death ${type} at ${angle}`);
    tick(220);assert(P('c.wallSit.done'),'seated fall did not finish');
    probe('corpses=[c];updateCorpses();');
    assert(P('c.isStatic&&wallCorpseBanks.get(wallCorpseBankKey(wall)).includes(c)'),
      'seated body was lost to floor stamping');
  }
  for(const facing of [angle,angle+Math.PI/2]){
    drop(0,facing,Math.cos(angle)*20,Math.sin(angle)*20);
    assert(P('!c.wallSit'),'front/side wall incorrectly selected sitting death');
  }
}
room();drop(0,Math.PI,20,0);tick(90);
assert(P('!!c.wallSit'),'destroyed-wall fixture did not start seated');
probe('activeBuildings=buildings=[];invalidateColIndex();corpses=[c];');
for(let n=0;n<100;n++)probe('frameCount++;updateCorpses();');
assert(P('!c.wallSit'),'seated body remained suspended after supporting wall disappeared');
room();drop(0,Math.PI,20,0);
probe(`e.shovelLevel=currentLevel;e.shovelDepth=e.shovelDepthTarget=36;
  c=new Corpse(e.x,e.y,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,0,0,e.decals,e.currentWeapon,0,e.eType,e.bodyW,e.bodyH,e);`);
assert(P('!c.wallSit&&!corpsePieceContact(c,39,0,16)'),
  'surface wall caught a corpse on the excavated underground plane');

// Indexed collision must still find a wide torso before its center enters the
// wall's grid cell, including rotated narrow walls.
room();drop(10);
probe(`wall={x:220,y:0,w:16,h:500,isWall:true};activeBuildings=buildings=[wall];buildColIndex();`);
assert(P('!!corpsePieceContact(c,180,0,40)'), 'wide torso missed indexed wall boundary');
probe(`wall={x:240,y:0,w:16,h:500,angle:Math.PI/4,isWall:true};activeBuildings=buildings=[wall];buildColIndex();`);
assert(P('!!corpsePieceContact(c,140,100,40)'), 'wide torso missed rotated indexed wall');
probe(`wall={x:600,y:0,w:16,h:800,angle:Math.PI/4,isHouseWall:true};activeBuildings=buildings=[wall];buildColIndex();`);
assert(P('!!corpsePieceContact(c,330,270,13)'),
  'small corpse piece missed rotated wall beyond its ordinary index cell');

// Observe real painted anchors through the painter's transform stack, then
// compare the fatal emitter. The wall projection is never recomputed here.
// Native decals exercise noncentral coordinates on types 2/3/4; native head
// and torso centers anchor the piece painters which add wounds separately.
let paintMatrix=[1,0,0,1,0,0],paintFill=[],paintStack=[],paintAnchors=[],anchorKind='';
const paintOriginals={};
for(const key of ['push','pop','translate','rotate','scale','fill','ellipse','drawFigureHair'])paintOriginals[key]=ctx[key];
function appendTransform(v){const m=paintMatrix;paintMatrix=[m[0]*v[0]+m[2]*v[1],m[1]*v[0]+m[3]*v[1],
  m[0]*v[2]+m[2]*v[3],m[1]*v[2]+m[3]*v[3],m[0]*v[4]+m[2]*v[5]+m[4],m[1]*v[4]+m[3]*v[5]+m[5]];}
function rememberPaintPoint(x,y){paintAnchors.push({x:paintMatrix[0]*x+paintMatrix[2]*y+paintMatrix[4],
  y:paintMatrix[1]*x+paintMatrix[3]*y+paintMatrix[5]});}
ctx.push=(...a)=>{paintStack.push({m:[...paintMatrix],fill:paintFill});return paintOriginals.push(...a);};
ctx.pop=(...a)=>{assert(paintStack.length,'wound observation popped past painter stack');
  const s=paintStack.pop();paintMatrix=s.m;paintFill=s.fill;return paintOriginals.pop(...a);};
ctx.translate=(x,y)=>{appendTransform([1,0,0,1,x,y]);return paintOriginals.translate(x,y);};
ctx.rotate=a=>{appendTransform([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);return paintOriginals.rotate(a);};
ctx.scale=(x,y=x)=>{appendTransform([x,0,0,y,0,0]);return paintOriginals.scale(x,y);};
ctx.fill=(...a)=>{paintFill=a[0]&&a[0].levels?[...a[0].levels]:a;return paintOriginals.fill(...a);};
ctx.ellipse=(x,y,w,h)=>{
  if(anchorKind==='decal'&&paintFill.join(',')==='91,1,2,223')rememberPaintPoint(x,y);
  if(anchorKind==='torso'&&paintFill.join(',')==='39,119,167,255'&&x===0&&y===0&&w===21&&Math.abs(h-27*.7)<1e-9)rememberPaintPoint(x,y);
  return paintOriginals.ellipse(x,y,w,h);
};
ctx.drawFigureHair=(g,id,x,y,...rest)=>{if(anchorKind==='head')rememberPaintPoint(x,y);return paintOriginals.drawFigureHair(g,id,x,y,...rest);};
let wallWounds=0;
try{
  for(const projected of [false,true])for(const type of [10,11,3,13,2,4])for(const age of [12,28,48]){
    probe(`BIOME_ACTIVE=${projected};camX=-400;camY=-300;zoom=1;`);
    room();anchorKind=type===10?'head':[11,13].includes(type)?'torso':'decal';
    probe(`frameCount++;particles=[];window.e=new Character(0,0,false,'NORMAL');e.aimAngle=e.moveAngle=0;
      rememberFigureMotion(e,0,0);window.w={x:${anchorKind==='decal'?3.1:0},y:${anchorKind==='decal'?-2.7:0},sz:6.1,col:[91,1,2,223],isHead:${anchorKind==='head'}};
      e.decals=[w];e.fallHit={frame:frameCount,kind:${JSON.stringify(anchorKind==='head'?'HEAD':'BODY')},weapon:WEAPONS.PISTOL,angle:0,force:3,mx:0,my:0,fatal:true,wound:w};
      c=new Corpse(0,0,0,0,color(39,119,167),color(48,58,72),${type},0,e.decals,null,0,'NORMAL',21,27,e);
      ${type===3?'c.mA=HALF_PI;':type===13?'c.aA=0;':''}
      corpses=[c];`);
    tick(age);
    paintMatrix=[1,0,0,1,0,0];paintFill=[];paintStack=[];paintAnchors=[];
    probe('c.show();drawWallCorpsePieces(wall);');
    assert.equal(paintStack.length,0);
    assert.equal(paintAnchors.length,1,`death ${type} age ${age}: native wound anchor painted zero or multiple times`);
    const point=P('fatalWoundPoint(c)');
    assert(Math.hypot(point.x-paintAnchors[0].x,point.y-paintAnchors[0].y)<1e-8,
      `death ${type} age ${age}: wall-projected fatal wound missed native painted anchor`);
    probe('particles=[];advanceFatalSpray(c);');const droplet=P('particles.find(p=>p.t==="WOUND_BLOOD")');
    if(droplet)assert(Math.hypot(droplet.x-point.x,droplet.y-point.y)<1e-8,'wall fatal particle missed wound');
    wallWounds++;
  }
}finally{for(const [key,fn] of Object.entries(paintOriginals))ctx[key]=fn;probe('BIOME_ACTIVE=false;');}

// Live and buffer targets must both keep finite drawing arguments and balanced
// p5 transforms, including upright torso and permanently seated paths.
let stack=0,minStack=0;
const push=ctx.push,pop=ctx.pop,ellipse=ctx.ellipse;
ctx.push=(...a)=>{stack++;return push(...a);};
ctx.pop=(...a)=>{stack--;minStack=Math.min(minStack,stack);return pop(...a);};
ctx.ellipse=(...a)=>{assert(a.every(Number.isFinite),'nonfinite corpse ellipse');return ellipse(...a);};
try{
  for(const kind of ['torso','seated'])for(const age of [0,8,20,45,90,200]){
    room();drop(kind==='torso'?10:0,Math.PI,kind==='torso'?0:20,0);
    if(kind==='torso')probe('c.overkillBits[0].vx=8;c.overkillBits[0].vy=0;');
    tick(age);probe('c.show();');assert.equal(stack,0);assert.equal(minStack,0);
    ctx.__corpseWallTarget=mkG();probe('c.show(__corpseWallTarget);');
  }
}finally{ctx.push=push;ctx.pop=pop;ctx.ellipse=ellipse;}
// Wall attachment persists with the sector's blood bank and stable geometry
// key. Reconstructed streamed wall objects must recover the same seated body.
probe('clearWallCorpses();useBloodBank("wall-seat-travel-A");');
room();drop(0,Math.PI,20,0);
probe('window.travelBody=c;corpses=[c];retireCorpsesToBloodBank();');
assert(P('travelBody.wallSit.done&&corpses.length===0'),'travel did not finish supported death');
probe('useBloodBank("wall-seat-travel-B");');
assert(P('!wallCorpseBanks.has(wallCorpseBankKey(wall))'),'seated corpse leaked into another sector');
probe('useBloodBank("wall-seat-travel-A");window.regeneratedWall={...wall};activeBuildings=buildings=[regeneratedWall];invalidateColIndex();');
assert(P('wallCorpseBanks.get(wallCorpseBankKey(regeneratedWall)).includes(travelBody)'),
  'returning to regenerated geometry lost seated corpse');
ctx.__corpseWallTarget=mkG();probe('drawWallCorpses(regeneratedWall,__corpseWallTarget);');
assert(P('travelBody.wallSit.b===regeneratedWall'),'seated corpse retained stale streamed support');
// The wall list has an explicit mobile memory ceiling and genuine reset clears
// both live and banked references. Floor corpses retain their existing budget.
probe('clearWallCorpses();useBloodBank("wall-seat-budget");');room();
for(let n=0;n<P('WALL_CORPSE_LIMIT')+5;n++)drop(0,Math.PI,20,0);
assert(P('wallCorpseOrder.length===WALL_CORPSE_LIMIT'),'seated corpse retention exceeded its ceiling');
assert(P('[...wallCorpseBanks.values()].reduce((n,list)=>n+list.length,0)===WALL_CORPSE_LIMIT'),
  'wall buckets retained evicted seated corpses');
probe('resetRunState();');
assert(P('wallCorpseBanks.size===0&&wallCorpseOrder.length===0'),'run reset retained seated corpses');
console.log(`Corpse walls passed: ${trajectories} legacy and ${ballisticTrajectories} ballistic trajectories, real explosive sword finishers, swept/corner/indexed collision, torso hold/slide/rest, ${wallWounds} observed wound anchors, decks, off-screen retirement, rear-wall sitting, destroyed supports, sector/regeneration persistence, bounded/reset retention and finite balanced render.`);

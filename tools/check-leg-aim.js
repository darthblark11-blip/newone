// Leg aim changes the surface bearing the bullet hole, not combat balance.
// Real projectiles exercise damage/death; real Canvas painters verify that one
// stain follows the actual living and fallen bones instead of the torso.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {ctx,probe}=require('./harness');
const {figureCanvas}=require('./figure-canvas');
const P=s=>probe('('+s+')');
let checks=0,seed=927;
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
  return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
function ok(label,value){assert(value,label);checks++;}
function shot(kind,type='NORMAL',hp=1000,weapon='PISTOL',angle=0,range=80){
  seed=927;
  probe(`currentLevel=currentBiome=1;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=isDead=isWin=isPaused=killcamMode=nm0AmbushActive=farmAmbushActive=false;
    inTownCutscene=inFortCutscene=inDarchonCall=false;townsData={};window.outpostForts={};
    buildings=[];activeBuildings=[];barrels=[];activeParkingCars=[];parkingCars=[];
    bullets=[];particles=[];corpses=[];enemiesList=[];resetForestWildlife();invalidateColIndex();
    viewLeft=viewTop=-10000;viewRight=viewBottom=10000;MAX_KILLS=100000;totalKills=0;
    headshotCounter=bodyOverkillCounter=0;
    player=new Character(-1000,-1000,true);leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
    window.victim=new Character(${range}*Math.cos(${angle}),${range}*Math.sin(${angle}),false,'${type}');
    victim.aimAngle=${angle};victim.moveAngle=${angle};victim.hp=${hp};victim.maxHp=${hp};victim.isNeutral=victim.isFriendly=false;
    victim.isMoving=false;victim.gait=0;enemiesList=[victim];frameCount++;
    window.legBullet=spawnBullet(0,0,${angle},true,'${kind}',WEAPONS.${weapon},player);
    for(let i=0;i<12&&legBullet.active;i++)updateBullets();`);
  return P('({hp:victim.hp,x:victim.x,y:victim.y,stun:victim.stunTimer,wound:victim.decals[0],dead:victim.dead,body:corpses[0]&&corpses[0].dT})');
}
for(const type of ['NORMAL','NM0_ROOKIE','NM0_ROOKIE_F','ARMORED_STANDARD']){
  const body=shot('BODY',type),leg=shot('LEGS',type),head=shot('HEAD',type);
  ok(type+' LEGS hits with unchanged body damage and knockback',leg.hp===body.hp&&leg.x===body.x&&leg.y===body.y&&leg.stun===body.stun);
  ok(type+' LEGS records a normalized real leg surface',leg.wound.isLeg===true&&!leg.wound.isHead&&[0,1].includes(leg.wound.legIndex)&&[0,1].includes(leg.wound.legSegment)&&leg.wound.legU>=0&&leg.wound.legU<=1&&Math.abs(leg.wound.legV)<=.22);
  ok(type+' HEAD/BODY decal destinations stay unchanged',!body.wound.isLeg&&!body.wound.isHead&&!head.wound.isLeg&&head.wound.isHead&&head.hp<body.hp);
}
for(const type of ['ARMORED','ROBOT','BUG','SNAIL','SNAIL_HYBRID','ALIEN_GATOR','SAUCER','COW','HORSE']){
  const body=shot('BODY',type),leg=shot('LEGS',type);
  ok(type+' keeps its existing nonhuman body hit and decal',leg.hp===body.hp&&!leg.wound.isLeg&&!leg.wound.isHead&&leg.wound.x===body.wound.x&&leg.wound.y===body.wound.y);
}
for(const weapon of ['PISTOL','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN']){
  const body=shot('BODY','NORMAL',1,weapon,0,40),leg=shot('LEGS','NORMAL',1,weapon,0,40);
  ok(weapon+' LEGS uses the existing body death rule',leg.dead&&leg.body===body.body);
  if(weapon==='DUAL_SMG'){
    ok('close dual SMG leg hit preserves the body overkill outcome',leg.body===10);
    ok('overkill without a leg surface cannot paint a leg wound on the torso',P('fatalWoundPoint(corpses[0],corpses[0].dec[0])===null'));
    probe('advanceFatalSpray(corpses[0]);');
  }
}
// Wire the actual p5 stand-in to a real Canvas, including the raw-context
// translations used by the optimized living leg painter.
const surface=figureCanvas(960,1120),{g,c,canvas}=surface;
for(const name of ['push','pop','translate','rotate','scale','fill','stroke','noFill','noStroke','strokeWeight','ellipse','rect','arc','line','quad','triangle','beginShape','vertex','curveVertex','endShape','image'])ctx[name]=g[name];
ctx.drawingContext=c;
ctx.__legPaint=g;
const originalLegs=ctx.drawLegDecals,originalOval=ctx.figureCelOval;
const events=[];
ctx.drawLegDecals=(...args)=>{
  const [target,decals,index,sx,sy,kx,ky,ax,ay,hw,kw,aw]=args;
  const selected=(decals||[]).filter(d=>d.isLeg&&d.legIndex===index);
  for(const d of selected){
    const p=ctx.legDecalPoint(d,sx,sy,kx,ky,ax,ay,hw,kw,aw),m=c.getTransform();
    events.push({kind:'leg',x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f,
      index,sx,sy,kx,ky,ax,ay,sz:p.sz});
    const x0=d.legSegment?kx:sx,y0=d.legSegment?ky:sy,x1=d.legSegment?ax:kx,y1=d.legSegment?ay:ky;
    const dx=x1-x0,dy=y1-y0,len=Math.max(.001,Math.hypot(dx,dy));
    const t=((p.x-x0)*dx+(p.y-y0)*dy)/(len*len);
    assert(t>=-1e-8&&t<=1+1e-8,'hole escaped its selected limb segment');
    assert(Math.abs((p.x-x0)*dy-(p.y-y0)*dx)/len<=Math.max(hw,kw,aw)*.23,'hole escaped trouser width');
  }
  return originalLegs(...args);
};
ctx.figureCelOval=(...args)=>{
  if(args[3]>14&&args[4]>14)events.push({kind:'mass'});
  return originalOval(...args);
};
function observation(code){
  events.length=0;c.resetTransform();c.clearRect(0,0,canvas.width,canvas.height);
  probe(code);assert(g.balanced(),'painter transforms leaked');
  const holes=events.filter(e=>e.kind==='leg');
  assert.equal(holes.length,1,'leg hole disappeared or was drawn on another body mass');
  const at=events.indexOf(holes[0]);
  assert(events.slice(at+1).some(e=>e.kind==='mass'),'leg hole was painted above the torso/head layer');
  checks++;return holes[0];
}
// Observe real gait/turn painters. The saved surface coordinates never change.
shot('LEGS','NM0_ROOKIE');
probe('victim.x=300;victim.y=300;victim.decals[0].col=[251,0,225,255];');
const normalized=P('JSON.stringify(victim.decals[0])');
let previous=null,moved=0;
for(const direction of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const stride of [0,.9,2.4]){
  const p=observation(`victim.aimAngle=${direction};victim.moveAngle=${direction};victim.isMoving=${stride!==0};victim.walkCycle=${stride};victim.gait=.9;victim.show();`);
  if(previous&&Math.hypot(p.x-previous.x,p.y-previous.y)>1)moved++;previous=p;
  ok('walking/turning retains normalized wound coordinates',P('JSON.stringify(victim.decals[0])')===normalized);
}
ok('leg stain visibly follows gait and turns',moved>=8);
// Existing boxing and shovel poses also own their leg stains beneath the body.
probe(`window.poseActor=victim;boxingEnter(victim,[player],'WORLD');`);
observation('victim.show();');
probe('boxingExit(victim);startPunchStun(victim,0);victim.stunTimer=600;');
for(const age of [0,20,60]){
  observation(`victim.stunPose.age=${age};push();translate(victim.x,victim.y);drawStunnedFigure(victim);pop();`);
}
// A fatal leg wound shares its exact origin with the same painted falling
// limb, including global rotation and stamping into another target.
for(const type of ['NORMAL','NM0_ROOKIE','ARMORED_STANDARD'])for(const direction of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  shot('LEGS',type,1,'PISTOL',direction);
  probe('window.body=corpses[0];window.wound=body.dec[0];');
  ok(type+' fatal leg shot retains its leg decal and ordinary fall',P('wound.isLeg&&body.rag&&body.fall&&body.fatalSpray'));
  for(const age of [0,4,60]){
    probe(`while(body.fall.age<${age}&&!body.fall.done){frameCount++;body.update();}`);
    for(const target of ['','__legPaint']){
      const p=observation(`body.show(${target});`),w=P('fatalWoundPoint(body,wound)');
      // Canvas transforms use float precision internally; a subpixel tolerance
      // still catches a misplaced limb or mismatched body rotation.
      ok(`${type} age ${age} target ${target||'window'} fatal spray stays on its transformed painted leg`,Math.hypot(p.x-w.x,p.y-w.y)<1e-4);
    }
  }
}
// Make a reviewable scene with the actual red holes, marked by rings outside
// the figure. Clipped panels include idle, stride, impact and settled poses.
const out=process.env.LEG_AIM_OUT||'/tmp/leg-aim-scene.png';
c.resetTransform();c.fillStyle='#18232d';c.fillRect(0,0,canvas.width,canvas.height);
c.fillStyle='#f4e8ca';c.font='25px sans-serif';c.fillText('LEG AIM / ACTUAL LIVE AND FALLEN PAINTERS',20,35);
c.fillStyle='#b7c5cf';c.font='14px sans-serif';c.fillText('Body damage unchanged · red holes stay on trouser legs · no new leg injury behavior',20,60);
const types=['NORMAL','NM0_ROOKIE','ARMORED_STANDARD'],poses=['Idle','Walking stride','Bullet fall','Settled'];
for(let row=0;row<poses.length;row++)for(let col=0;col<types.length;col++){
  const x=10+col*316,y=80+row*255;
  c.fillStyle='#89958d';c.beginPath();c.roundRect(x,y,306,245,7);c.fill();
  c.fillStyle='#142931';c.font='17px sans-serif';c.fillText(types[col]+' / '+poses[row],x+12,y+25);
  shot('LEGS',types[col],row<2?1000:1,'PISTOL',-Math.PI/2);
  probe('victim.x=victim.y=0;victim.aimAngle=victim.moveAngle=-HALF_PI;victim.gait=.95;victim.walkCycle=2.1;victim.isMoving=false;');
  if(row===1)probe('victim.isMoving=true;victim.walkCycle=2.1;');
  if(row>=2){
    probe('window.body=corpses[0];body.x=body.y=0;body.aA=body.mA=-HALF_PI;body.fall.a=body.fall.facing=body.fall.yawFrom=-HALF_PI;');
    probe(row===2?'for(let i=0;i<3;i++){frameCount++;body.update();}':'finishFigureFall(body);while(!body.rag.done)ragStep(body.rag);');
  }
  c.save();c.beginPath();c.rect(x,y+35,306,202);c.clip();
  g.push();g.translate(x+155,y+136);g.scale(3.3);events.length=0;
  probe(row<2?'victim.show();':'body.show(__legPaint);');
  g.pop();c.restore();
  const mark=events.find(e=>e.kind==='leg');
  if(mark){c.strokeStyle='#e9d697';c.lineWidth=1.5;c.beginPath();c.arc(mark.x,mark.y,13,0,Math.PI*2);c.stroke();}
}
assert(g.balanced());fs.writeFileSync(out,canvas.toBuffer('image/png'));
ctx.drawLegDecals=originalLegs;ctx.figureCelOval=originalOval;
console.log(`${checks}/${checks} leg-aim checks passed; real Canvas scene: ${out}`);

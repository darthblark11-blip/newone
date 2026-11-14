// The lethal handoff must continue the height and floor heading the living
// injury already reached. The frozen source shape cannot follow its old actor.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,seed=9181;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
function paintedWound(corpseName='c'){
  const originals={},names=['push','pop','translate','rotate','scale','ellipse'];
  for(const key of names)originals[key]=ctx[key];
  let m=[1,0,0,1,0,0],stack=[],points=[];
  ctx.push=()=>stack.push(m.slice());ctx.pop=()=>{m=stack.pop();};
  ctx.translate=(x,y)=>{m[4]+=m[0]*x+m[2]*y;m[5]+=m[1]*x+m[3]*y;};
  ctx.rotate=a=>{const co=Math.cos(a),si=Math.sin(a),[a0,a1,a2,a3]=m;
    m[0]=a0*co+a2*si;m[1]=a1*co+a3*si;m[2]=-a0*si+a2*co;m[3]=-a1*si+a3*co;};
  ctx.scale=(x,y=x)=>{m[0]*=x;m[1]*=x;m[2]*=y;m[3]*=y;};
  ctx.ellipse=(x,y,w,h)=>points.push({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5],w:w*Math.hypot(m[0],m[1]),h:h*Math.hypot(m[2],m[3])});
  try{probe(`${corpseName}.paint();`);ok('corpse painter balances its native transform stack',stack.length===0);return points;}
  finally{Object.assign(ctx,originals);}
}
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const u=seed/4294967296;
  return a===undefined?u:Array.isArray(a)?a[Math.floor(u*a.length)]:b===undefined?u*a:a+(b-a)*u;};
probe(`currentLevel=currentBiome=2;BIOME_ACTIVE=false;isStoryMode=false;started=doTick=true;
  isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
  buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];invalidateColIndex();
  leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
  player=new Character(2000,2000,true);viewLeft=viewTop=-10000;viewRight=viewBottom=10000;`);

// Model the public injury-pose boundary so every fractional drop/rise can be
// tested, including hp<=0 after the actual fatal-damage branch has run.
const nativePose=ctx.legInjuryPose;
ctx.legInjuryPose=actor=>actor&&actor.__continuityPose||null;
function corpse(phase,down,heading,back=false,seated=false,dt=0){
  probe(`frameCount++;corpses=[];particles=[];
    window.e=new Character(80,40,false,'NORMAL');e.hp=0;e.dead=true;
    e.aimAngle=${heading+(back?Math.PI:0)};e.moveAngle=${heading};
    e.legInjury={phase:'${phase}',legIndex:1,variant:2,outcome:'${seated?'SEATED':'PRONE'}'};
    e.__continuityPose={phase:'${phase}',legIndex:1,variant:2,outcome:'${seated?'SEATED':'PRONE'}',
      down:${down},rise:${phase==='RECOVER'?1-down:0},seated:${seated?down:0},prone:${seated?0:down},
      heading:${heading},progress:${down},ageMs:800,wasMoving:false,moveX:0,moveY:0,reach:0};
    rememberFigureMotion(e,0,0);
    e.decals=[{x:1,y:-2,sz:5,col:[90,0,0,220],isHead:${dt===1},isBulletHole:true}];
    e.fallHit={frame:frameCount,kind:'${dt===1?'HEAD':'BODY'}',weapon:WEAPONS.PISTOL,
      angle:${heading+1.9},force:3,mx:0,my:0,x:e.x,y:e.y,wound:e.decals[0],fatal:true};
    window.livingBody=snapshotLegInjuryBody(e);
    window.c=new Corpse(e.x,e.y,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,${dt},0,e.decals,
      e.currentWeapon,${heading+1.9},e.eType,e.bodyW,e.bodyH,e);`);
}
try{
  for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])
    for(const [phase,down,seated]of [['FALL',.2,false],['FALL',.7,false],['PRONE',1,false],['SEATED',1,true],['RECOVER',.4,false]])
      for(const dt of [0,1]){
        corpse(phase,down,heading,false,seated,dt);
        ok(`${phase}/${heading}/${dt} begins at its current low height`,Math.abs(P('c.fP')-down)<1e-9);
        const floorHeading=heading+(seated?Math.PI:0);
        ok(`${phase}/${heading}/${dt} preserves the planted floor axis`,
          Math.abs(P('c.fall.a')-floorHeading)<1e-9&&Math.abs(P('c.fall.yawFrom')-floorHeading)<1e-9);
        // Sitting falls backward without dragging its forward-pointing feet
        // through the belly. Reframing may rotate local coordinates, but no
        // living landmark is allowed to jump in world space on the fatal frame.
        const live=P('livingBody'),frozen=P('c.injuryFrom.body');
        const world=(p,a)=>({x:Math.cos(a)*p.x-Math.sin(a)*p.y,y:Math.sin(a)*p.x+Math.cos(a)*p.y});
        const landmarks=b=>[b.head,{x:b.chestX,y:b.chestY},...b.joints.flatMap(j=>[j.hip,j.knee,j.ankle,j.shoulder,j.elbow,j.wrist])];
        const oldPoints=landmarks(live),newPoints=landmarks(frozen);
        ok(`${phase}/${heading}/${dt} changing the final floor frame preserves every live world landmark`,oldPoints.every((p,i)=>{
          const a=world(p,heading),b=world(newPoints[i],floorHeading);return Math.hypot(a.x-b.x,a.y-b.y)<1e-8;
        }));
        probe(`window.testLegWound={isLeg:true,legIndex:1,legSegment:1,legU:.7,legV:.13,sz:4};
          window.liveLeg=livingBody.joints[1];window.liveLegMark=legDecalPoint(testLegWound,
            liveLeg.hip.x,liveLeg.hip.y,liveLeg.knee.x,liveLeg.knee.y,liveLeg.ankle.x,liveLeg.ankle.y,
            livingBody.R.thighW*.92,livingBody.R.shinW,livingBody.R.shinW*.8);`);
        const liveMark=world(P('liveLegMark'),heading),deadMark=P('fallenLegDecalPoint(c,testLegWound)');
        ok(`${phase}/${heading}/${dt} injured-leg blood has no world-space handoff jump`,
          Math.hypot(deadMark.x-P('c.x')-liveMark.x*live.size,deadMark.y-P('c.y')-liveMark.y*live.size)<1e-8);
        ok(`${phase}/${heading}/${dt} keeps the native death selection`,P('c.dT')===dt);
        ok(`${phase}/${heading}/${dt} snapshots both body chains`,P('c.injuryFrom.body.joints.length===2&&c.injuryFrom.body.joints.every(j=>j.hip&&j.knee&&j.ankle&&j.shoulder&&j.elbow)'));
        // Observe the geometry consumed by the painter, rather than merely
        // asserting that an otherwise unused source snapshot was retained.
        probe(`window.handoffRig=corpseFallRig(c);window.handoffBody=c.injuryFrom.body;`);
        ok(`${phase}/${heading}/${dt} starts the actual chest at its living location`,P(`
          Math.abs(handoffRig.chestX*RAG_SCALE-handoffBody.chestX*handoffBody.size)<1e-8&&
          Math.abs(handoffRig.chestY*RAG_SCALE-handoffBody.chestY*handoffBody.size)<1e-8&&
          Math.abs(handoffRig.headX*RAG_SCALE-handoffBody.head.x*handoffBody.size)<1e-8&&
          Math.abs(handoffRig.headY*RAG_SCALE-handoffBody.head.y*handoffBody.size)<1e-8`));
        for(let limb=0;limb<4;limb++){
          probe(`window.handoffLimb=fallLimbGeometry(handoffRig,c.rag,${limb},c.fP);window.sourceJoint=handoffBody.joints[${limb%2}];`);
          const start=limb<2?'shoulder':'hip',middle=limb<2?'elbow':'knee',end=limb<2?'wrist':'ankle';
          ok(`${phase}/${heading}/${dt} rendered limb ${limb} begins at the source joints`,P(`
            Math.abs(handoffLimb.ox*RAG_SCALE-sourceJoint.${start}.x*handoffBody.size)<1e-8&&
            Math.abs(handoffLimb.oy*RAG_SCALE-sourceJoint.${start}.y*handoffBody.size)<1e-8&&
            Math.abs(handoffLimb.ex*RAG_SCALE-sourceJoint.${middle}.x*handoffBody.size)<1e-8&&
            Math.abs(handoffLimb.ey*RAG_SCALE-sourceJoint.${middle}.y*handoffBody.size)<1e-8&&
            Math.abs(handoffLimb.hx*RAG_SCALE-sourceJoint.${end}.x*handoffBody.size)<1e-8&&
            Math.abs(handoffLimb.hy*RAG_SCALE-sourceJoint.${end}.y*handoffBody.size)<1e-8`));
        }
        const bones=[],drawBone=ctx.drawFallBone;
        ctx.drawFallBone=(...args)=>{bones.push(args.slice(1,5));return drawBone(...args);};
        probe('c.paint();');ctx.drawFallBone=drawBone;
        ok(`${phase}/${heading}/${dt} the native paint path consumes the source joints`,bones.some(v=>
          Math.abs(v[0]-P('handoffBody.joints[0].hip.x*handoffBody.size/RAG_SCALE'))<1e-8&&
          Math.abs(v[1]-P('handoffBody.joints[0].hip.y*handoffBody.size/RAG_SCALE'))<1e-8));
        for(const age of [0,5,11,12]){
          probe(`c.fall.age=c.injuryFrom.startAge+${age};c.fP=figureFallProgress(c.fall);`);
          const expected=P('fatalWoundPoint(c)'),painted=paintedWound();
          ok(`${phase}/${heading}/${dt} fatal jet stays on the painted wound during blend ${age}`,painted.some(v=>
            Math.abs(v.x-expected.x)<1e-7&&Math.abs(v.y-expected.y)<1e-7&&Math.abs(v.w-P('c.fatalSpray.wound.sz')*expected.scale)<1e-7));
        }
        probe('c.fall.age=c.injuryFrom.startAge;c.fP=figureFallProgress(c.fall);');
        const snapshot=P('JSON.stringify(c.injuryFrom)');
        probe('e.legInjury.phase="RECOVER";e.__continuityPose.down=0;e.x=9999;e.y=9999;e.aimAngle=17;');
        ok(`${phase}/${heading}/${dt} source actor changes cannot alter the corpse handoff`,P('JSON.stringify(c.injuryFrom)')===snapshot);
        if(down===1){
          ok(`${phase}/${heading}/${dt} floor bodies receive no new displacement impulse`,P('c.fall.impulse===0&&c.fall.contacted'));
          const floor=P('({x:c.x,y:c.y})');probe('for(let i=0;i<45;i++){frameCount++;c.update();}');
          assert.deepEqual(P('({x:c.x,y:c.y})'),floor);checks++;
        }
        probe('finishFigureFall(c);while(c.rag&&!c.rag.done)ragStep(c.rag);');
        ok(`${phase}/${heading}/${dt} completes the existing settle`,P('c.fall.done&&c.fP===1&&c.rag.done'));
        ok(`${phase}/${heading}/${dt} the final stamp converges to the ordinary native rig`,P('JSON.stringify(corpseFallRig(c))===JSON.stringify(projectFallRig(c.bW,c.bH,c.fP))'));
      }
  corpse('PRONE',1,.6,true,false,0);
  ok('a back-aiming prone victim retains its exposed face when killed',P('!c.fall.faceDown&&!c.backFacing'));
  corpse('SEATED',1,.6,false,true,0);
  ok('a seated victim falls face up instead of inheriting standing rear-facing art',P('!c.fall.faceDown&&!c.backFacing'));
  // A normal fatal body shot must never take an injury snapshot just because
  // another NPC in the same encounter has one.
  probe(`window.ordinary=new Character(0,0,false,'NORMAL');ordinary.hp=0;ordinary.dead=true;
    window.normalBody=new Corpse(0,0,0,0,ordinary.shirtCol,ordinary.pantsCol,0,0,[],ordinary.currentWeapon,
      .5,ordinary.eType,ordinary.bodyW,ordinary.bodyH,ordinary);`);
  ok('ordinary deaths keep their original standing start and state',P('!normalBody.injuryFrom&&!normalBody.fall.injuryFrom&&normalBody.fP===0'));
}finally{
  if(nativePose)ctx.legInjuryPose=nativePose;else delete ctx.legInjuryPose;
}
console.log(`${checks}/${checks} leg-injury lethal handoff, frozen shape, floor heading and normal-death isolation checks passed.`);

// Player anatomy in real XYZ. X/Y are the game's ground plane, Z is height.
// The orthographic mesh camera drops Z: native contact and muzzle XY remain
// authoritative while the height/IK solve gives the model volume and depth.
// No animation clocks, random numbers or mutable game state live in this file.
const PLAYER3D_HEAD_SCALE = 1.1;
const Player3DMath = (() => {
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number(x)||0));
  const point=(x=0,y=0,z=0)=>({x:Number(x)||0,y:Number(y)||0,z:Number(z)||0});
  const add=(a,b)=>point(a.x+b.x,a.y+b.y,a.z+b.z);
  const sub=(a,b)=>point(a.x-b.x,a.y-b.y,a.z-b.z);
  const mul=(a,k)=>point(a.x*k,a.y*k,a.z*k);
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const cross=(a,b)=>point(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
  const norm=a=>mul(a,1/(Math.hypot(a.x,a.y,a.z)||1));
  const mix=(a,b,t)=>add(mul(a,1-t),mul(b,t));
  const rotate=(p,a)=>point(Math.cos(a)*p.x-Math.sin(a)*p.y,Math.sin(a)*p.x+Math.cos(a)*p.y,p.z);
  const matrix=(p,x,y,z,sx=1,sy=1,sz=1)=>new Float32Array([
    x.x*sx,x.y*sx,x.z*sx,0,y.x*sy,y.y*sy,y.z*sy,0,z.x*sz,z.y*sz,z.z*sz,0,p.x,p.y,p.z,1]);
  const frame=(up,forward)=>{
    const z=norm(up),raw=sub(forward,mul(z,dot(forward,z)));
    const x=norm(Math.hypot(raw.x,raw.y,raw.z)>.001?raw:cross(point(0,1,0),z));
    return {x,y:norm(cross(z,x)),z};
  };
  const postureFrame=(heading,pitch=0)=>{
    const forward=rotate(point(1,0,0),heading),side=rotate(point(0,1,0),heading);
    return {x:add(mul(forward,Math.cos(pitch)),point(0,0,-Math.sin(pitch))),
      y:side,z:add(mul(forward,Math.sin(pitch)),point(0,0,Math.cos(pitch)))};
  };
  const segment=(a,b,w,d=w)=>{
    const v=sub(b,a),length=Math.max(.001,Math.hypot(v.x,v.y,v.z)),x=mul(v,1/length);
    let y=norm(cross(point(0,0,1),x));if(Math.hypot(y.x,y.y,y.z)<.1)y=point(0,1,0);
    const z=norm(cross(x,y));return matrix(mix(a,b,.5),x,y,z,length,w,d);
  };
  // Analytical two-bone IK. Targets carry both XY and real height. The pole
  // determines the bend plane; no projected limb is passed off as a 3D bone.
  const elbow=(shoulder,hand,upper,fore,pole)=>{
    const target=sub(hand,shoulder),distance=Math.max(.0001,Math.hypot(target.x,target.y,target.z)),axis=mul(target,1/distance);
    const d=Math.max(Math.abs(upper-fore)+.001,Math.min(upper+fore-.001,distance));
    const along=(upper*upper-fore*fore+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
    let bend=sub(sub(pole,shoulder),mul(axis,dot(sub(pole,shoulder),axis)));
    if(Math.hypot(bend.x,bend.y,bend.z)<.01)bend=cross(axis,point(0,0,1));
    if(Math.hypot(bend.x,bend.y,bend.z)<.01)bend=point(0,1,0);
    return add(add(shoulder,mul(axis,along)),mul(norm(bend),height));
  };
  const color=(value,fallback)=>{
    const a=value&&value.levels?value.levels:Array.isArray(value)?value:fallback;
    return [0,1,2].map(i=>Math.max(0,Math.min(255,Number(a&&a[i])||0)));
  };
  return {clamp,point,add,sub,mul,dot,cross,norm,mix,rotate,matrix,frame,postureFrame,segment,elbow,color};
})();

function player3DPose(actor, options = {}) {
  if(!actor)return null;
  const M=Player3DMath,{point,add,sub,mul,mix,rotate,clamp}=M;
  // Legacy pose helpers cache calculated geometry on their actor. A shadow
  // receives those caches, so merely looking at a mesh cannot advance/mutate
  // a simulation actor or its frozen corpse identity.
  const c=Object.assign(Object.create(Object.getPrototypeOf(actor)||null),actor);
  for(const key of ['_standingPresentationPose','_stanceBody','_stanceMount','_stancePresentationMount','_injuryMount','_legHitGeometry'])c[key]=null;
  const safe=(fn,fallback)=>{try{const value=fn();return value==null?fallback:value;}catch(_){return fallback;}};
  const bw=Number(c.bodyW||c.bW)||21,bh=Number(c.bodyH||c.bH)||27;
  c.bodyW=bw;c.bodyH=bh;c.x=Number(c.x)||0;c.y=Number(c.y)||0;
  const mode=options.mode||options.kind||'NORMAL';
  let angle=Number.isFinite(options.angle)?options.angle:Number(c.aimAngle)||0;
  if(mode==='QUICKDRAW'&&Number(options.projectionX)>0)angle=Math.atan2(Math.sin(angle),Math.cos(angle)*options.projectionX);
  const identity=options.identity||safe(()=>figureIdentity(c),c)||c;
  const palette={skin:M.color(identity.skinCol||c.skinCol,[235,180,140]),shirt:M.color(identity.shirtCol||c.shirtCol,[200,30,30]),
    pants:M.color(identity.pantsCol||c.pantsCol,[30,80,180]),steel:[59,68,79],wood:[128,77,37],gold:[172,136,61]};
  const armored=!!identity.explosiveArmor,chemist=!armored&&!!identity.chemistSuit,ninja=!armored&&!chemist&&!!identity.ninjaSuit,cowboy=!armored&&!chemist&&!ninja&&!!identity.cowboySuit;
  if(armored){palette.shirt=[60,100,40];palette.pants=[139,115,85];}
  else if(chemist){palette.shirt=[238,242,239];palette.pants=[20,22,25];}
  else if(ninja){palette.shirt=[25,25,33];palette.pants=[22,22,29];}
  else if(cowboy){palette.shirt=[219,196,146];palette.pants=[61,93,118];}
  if(identity.isCharred||c.isCharred)palette.skin=[50,40,40];
  palette.boot=palette.pants.map(x=>x*.55);
  const R=safe(()=>figureRig(bw,bh),{upper:11.4,fore:10.1,hand:7.6,upperW:8.4,foreW:6.72,thigh:15.5,shin:15.5,foot:8.4,thighW:9.6,shinW:7.36,TL:23.3,TW:16.1});
  const low=safe(()=>actorStancePose(c),{crouch:0,prone:0,scaleX:1}),floor=clamp(low.prone),crouch=clamp(low.crouch);
  const cover=safe(()=>stanceCoverPoseActive(c),false);
  const stance=(floor>0||crouch>0||cover||c.legInjury)?safe(()=>stanceBodyPose(c),null):null;
  const frame=typeof frameCount==='number'?frameCount:0,cycle=Number(c.walkCycle)||0;
  const motion=c.mounted?clamp(c.gait||0):safe(()=>standingLowerEligible(c)?standingMotionAmount(c):Number(!!c.isMoving),Number(!!c.isMoving));
  // gaitPose() returns one shared scratch object. Native helper calls below
  // may sample idle gait while the standing motion envelope is still easing.
  // Retain this actor's actual gait before those helpers reuse the scratch.
  const gait={...safe(()=>gaitPose(c.gait||0),{swing:motion,lean:0,twist:0,bob:1,bend:0,band:1})};
  const tool=options.weapon===false||c.isArmed?'NONE':safe(()=>meleeTool(),'NONE');
  const action=safe(()=>leftHandAction(c),0);
  const rotatePoint=(x,y,z,a=angle)=>rotate(point(x,y,z),a);
  const nativeWorld=p=>point(p.x-c.x,p.y-c.y,Number(p.z)||0);
  let p=options.pose||null,weaponRecords=[],kind=mode;
  const gunHeight=24*(1-.42*crouch-.76*floor),chestHeight=17*(1-.37*crouch-.74*floor),headHeight=30*(1-.38*crouch-.76*floor);
  if(!p) {
    let boxing=mode==='BOXING'||safe(()=>boxingActive(c),false)?safe(()=>boxingPose(c,false),null):null;
    if(boxing&&boxing.arms&&boxing.head) {
      const body=boxing.body||{},pelvis=boxing.pelvis||{};
      p={head:rotate(point(boxing.head.x,boxing.head.y,boxing.head.z),angle),
        chest:rotate(point(body.x||0,body.y||0,body.z||17),angle),pelvis:rotate(point(pelvis.x||-3,pelvis.y||0,11*(1-(boxing.legCompression||0)*.25)),angle),
        forward:rotatePoint(1,0,0,angle+(boxing.torso||0)),arms:boxing.arms.map(a=>({shoulder:rotate(a.shoulder,angle),elbow:rotate(a.elbow,angle),fist:rotate(a.fist,angle)})),legs:[]};
      const feet=safe(()=>boxingFeet(c,boxing),boxing.feet||[]);
      p.legs=feet.map((f,i)=>{
        const side=i?1:-1,hip=add(p.pelvis,rotatePoint(0,side*4.6,0,angle+(boxing.hip||0))),ankle=rotate(point(f.x,f.y,1+(f.lift||0)),angle);
        const knee=M.elbow(hip,ankle,R.thigh,R.shin,add(mix(hip,ankle,.5),rotatePoint(7,side*3,0)));
        return {hip,knee,ankle,heading:angle+(f.heading||0)};
      });kind='BOXING';
    } else {
      const heading=stance?safe(()=>stanceFacingAngle(c),angle):angle;
      const size=stance?Number(stance.size)||1:1;
      const lower=!stance?safe(()=>standingLowerPose(c),null):null;
      const presentation=!stance?safe(()=>standingPresentationPose(c),null):null;
      const aiming=!!c.isArmed&&c.meleeTimer<=0&&safe(()=>playerAiming(c),false);
      const twist=stance?stance.yaw||0:presentation?presentation.tw||0:
        c.isMoving&&!aiming?Math.sin(cycle)*gait.twist*motion:0;
      const torsoHeading=heading+twist,hipHeading=stance?heading+(stance.hipYaw||0):lower?lower.angle:safe(()=>entityMoveHeading(c),Number(c.moveAngle)||angle);
      const dive=safe(()=>proneDiveLift(c),0),air=(c.mounted?4:0)+Number(c.jetpackHeight||0);
      let bob=presentation?presentation.bob:(Math.abs(Math.sin(cycle))*2*gait.bob+gait.lean)*motion;
      if(c.mounted)bob*=.4;
      if(c.reloadTimer>0&&!safe(()=>oneHandWeapon(c.currentWeapon),true))bob+=Math.sin(frame*.5)*3;
      const local=(x,y,z,a=heading)=>{const q=rotatePoint(x*size,y*size,z,a);q.y-=dive;return q;};
      const braced=c.isArmed&&c.reloadTimer<=0&&c.meleeTimer<=0&&!c.dead&&
        safe(()=>solidLongGun(c.currentWeapon)||c.currentWeapon===WEAPONS.ROCKET_LAUNCHER,false);
      const presented=presentation?presentation.t:1;
      p={head:stance?local(stance.head.x,stance.head.y,headHeight+air):rotatePoint(bob+(braced?3*presented:0),braced?4*presented:0,headHeight+air,torsoHeading),
        chest:stance?local(stance.chestX,stance.chestY,chestHeight+air):rotatePoint(bob,0,chestHeight+air,torsoHeading),
        pelvis:stance?local(stance.hipX,stance.hipY,10*(1-.38*crouch-.72*floor)+air):rotatePoint(-5,0,10+air,hipHeading),
        forward:rotatePoint(1,0,0,torsoHeading),chestHeading:torsoHeading,hipHeading,
        bodyPitch:floor*Math.PI*.5*(1-2*(stance&&stance.roll?stance.roll.back:0)),
        torsoProjectedLength:(stance?stance.torsoLength:bw*(typeof TORSO_DEPTH==='number'?TORSO_DEPTH:.84))*size,
        torsoProjectedWidth:(stance?stance.torsoWidth:bh)*size,headProjectedDiameter:11*size,
        arms:[],legs:[]};
      const legGeometry=safe(()=>buildHumanLegHitGeometry(c),null);
      if(stance&&stance.joints) {
        p.legs=stance.joints.map(j=>({hip:local(j.hip.x,j.hip.y,p.pelvis.z),
          knee:local(j.knee.x,j.knee.y,Math.max(2,6*(1-crouch))*(1-.65*floor)+air),
          ankle:local(j.ankle.x,j.ankle.y,1+air),heading:heading+Math.atan2(j.ankle.y-j.knee.y,j.ankle.x-j.knee.x),step:j.step,
          widths:[R.thighW*.92*size,R.shinW*size,R.shinW*.8*size]}));
      } else if(legGeometry&&legGeometry.legs) {
        const rear=safe(()=>standingRearPose(c,lower),null);
        const nativeStanding=lower&&!rear&&!safe(()=>shovelMantlePose(c),null)&&
          !safe(()=>tool==='SHOVEL'?shovelDigPose(c,gait,0):null,null);
        const visibleLegs=nativeStanding?legGeometry.legs.map((l,i)=>{
          const side=i?1:-1,th=R.thigh*(typeof STAND_FORE_LEG==='number'?STAND_FORE_LEG:.40),sh=R.shin*(typeof STAND_FORE_LEG==='number'?STAND_FORE_LEG:.40);
          const sx=-10-side*Math.sin(cycle)*12*gait.swing*motion+R.thighW*.5;
          return {...l,sx,sy:side*6,kx:sx+th*.92,ky:side*6,ax:sx+th*.92+sh,ay:side*6};
        }):legGeometry.legs;
        p.legs=visibleLegs.map((l,i)=>{
          const toPoint=(x,y,z)=>rotatePoint(x*(legGeometry.scale||1),y*(legGeometry.scale||1),z,legGeometry.angle||0);
          const lift=c.isMoving?Math.max(0,-Math.cos(cycle+(i?0:Math.PI)))*2*motion:0;
          return {hip:toPoint(l.sx,l.sy,p.pelvis.z),knee:toPoint(l.kx,l.ky,Math.max(2,6*(1-crouch)+lift)*(1-.65*floor)+air),
            ankle:toPoint(l.ax,l.ay,1+lift+air),heading:legGeometry.angle||0};
        });
      }
      if(!p.legs.length)for(const side of [-1,1]) {
        const a=Number(c.moveAngle)||angle,stride=Math.sin(cycle+(side<0?Math.PI:0))*motion*7;
        p.legs.push({hip:rotatePoint(-5,side*5,p.pelvis.z,a),knee:rotatePoint(-1+stride,side*5,6,a),ankle:rotatePoint(5+stride,side*5,1,a),heading:a});
      }
      if(presentation&&presentation.arms) {
        const a=angle+(presentation.tw||0),bobX=presentation.bob||0;
        p.arms=presentation.arms.map(arm=>{
          const side=arm.right?1:-1,hz=gunHeight*(.58+.42*presentation.t);
          const shoulder=rotatePoint(arm.sx+bobX,arm.sy,chestHeight+7+air,a),hand=rotatePoint(arm.hx+bobX,arm.hy,hz+air,a);
          const elbow=rotatePoint(arm.ex+bobX,arm.ey,Math.min(shoulder.z,hand.z)-3,a);
          return {side,shoulder,elbow,fist:hand,handDiameter:8,widths:[R.upperW,(R.upperW+R.foreW)*.5,R.foreW*.84]};
        }).sort((a,b)=>a.side-b.side);
        weaponRecords=presentation.weapons.map(g=>({hand:rotatePoint(g.x+bobX,g.y,gunHeight*(.58+.42*presentation.t)+air,a),
          muzzle:rotatePoint(g.muzzle.x+bobX,g.muzzle.y,gunHeight*(.58+.42*presentation.t)+Math.sin(g.elevation||0)*20+air,a),
          heading:g.heading,elevation:g.elevation||0,index:g.index||0}));
      } else if(stance&&stance.joints) {
        const longGun=safe(()=>solidLongGun(c.currentWeapon)?stanceLongGunPose(c):null,null);
        const bow=safe(()=>c.currentWeapon===WEAPONS.BOW,false),dual=safe(()=>c.currentWeapon===WEAPONS.DUAL_SMG,false);
        const bowTension=bow?safe(()=>bowDrawAmount(c),0):0;
        const wrist=side=>safe(()=>stancePointInBody(c,
          longGun?(side>0?longGun.rear[0]:longGun.fore[0]):bow?(side>0?13-9*bowTension:24):side>0?(c.currentWeapon===WEAPONS.PISTOL?16:22):dual?22:27,
          longGun?(side>0?longGun.rear[1]:longGun.fore[1]):bow?0:side>0?(c.currentWeapon===WEAPONS.PISTOL?8:11):dual?-11:1),{x:16*size,y:8*size});
        p.arms=stance.joints.map(j=>{
          const side=j.side,right=side>0,w=wrist(side),empty=!c.isArmed||!right&&!dual&&safe(()=>weaponHands(c.currentWeapon)!==2,true);
          let hx=empty?j.elbow.x+5:w.x/size,hy=empty?j.elbow.y*.76:w.y/size;
          if(!right&&stance.injury&&stance.grab>0){const knee=stance.joints[stance.injury.legIndex].knee;
            hx+=(knee.x+1-hx)*stance.grab;hy+=(knee.y-hy)*stance.grab;}
          const e=safe(()=>stanceArmElbow(stance,j,hx,hy),j.elbow);
          const shoulder=local(j.shoulder.x,j.shoulder.y,chestHeight+3+air),hand=local(hx,hy,gunHeight*(empty?.7:1)+air);
          return {side,shoulder,elbow:local(e.x,e.y,Math.min(shoulder.z,hand.z)-1.5),fist:hand,
            handDiameter:6.3*size,widths:[R.upperW*size,(R.upperW+R.foreW)*.5*size,R.foreW*.83*size]};
        });
      } else {
        // Native walking elbows were deliberately authored in projection.
        // Keep those exact XY points and reconstruct only their height: solving
        // another IK chain here destroyed the original tucked runner's arms.
        const swing=Math.sin(cycle)*gait.swing*motion,rest=c.isMoving?0:Math.sin(frame*.045+c.x*.01);
        const SH=bh*.425,reach=(R.upper+R.fore)*(typeof STAND_FORE_ARM==='number'?STAND_FORE_ARM:.65);
        const projectedScale=(typeof STAND_FORE_ARM==='number'?STAND_FORE_ARM:.65)+.16*gait.bend;
        const PU=R.upper*projectedScale,PF=R.fore*projectedScale;
        const disc=(q,x,y,r)=>{const dx=q.x-x,dy=q.y-y,d=Math.hypot(dx,dy);if(d>r){q.x=x+dx*r/d;q.y=y+dy*r/d;}};
        for(const side of [-1,1]) {
          let sx=0,sy=side*SH,hx,hy,ex,ey;
          if(!c.isArmed) {
            const sw=side*swing;
            const h={x:-1.5+gait.bend*3+sw*reach*(.44+.13*gait.band),
              y:side*(bh*.49-gait.bend*2-Math.max(0,sw)*gait.bend*5.6+Math.max(0,-sw)*(1.1+gait.bend*.6))+rest*.4};
            disc(h,0,sy,(PU+PF)*.98);hx=h.x;hy=h.y;
            const e={x:(hx+1.5)*.42-gait.bend*1.6,y:side*(SH+.6+gait.bend*1.5)};
            for(let i=0;i<2;i++){disc(e,0,sy,PU);disc(e,hx,hy,PF);}disc(e,0,sy,PU);ex=e.x;ey=e.y;
          } else {
            const two=safe(()=>weaponHands(c.currentWeapon)===2,false),long=two?safe(()=>aimedLongGunPose(c,twist,bob),null):null;
            if(two) {
              sx=bw*(side>0?-.08:.20);sy=bh*(side>0?.35:-.36);
              const q=long?(side>0?long.rear:long.fore):safe(()=>c.currentWeapon===WEAPONS.BOW,false)?[side>0?13-9*safe(()=>bowDrawAmount(c),0):24,0]:[side>0?5:32,side>0?6:7];
              hx=q[0];hy=q[1];ex=side>0?sx-1.8+(hx-sx)*.15:sx+(hx-sx)*.46;ey=side>0?bh*.44:sy+(hy-sy)*.16;
            } else if(side>0) {
              const pistol=safe(()=>c.currentWeapon===WEAPONS.PISTOL,false);hx=pistol?16:22;hy=pistol?8:11;
              sx=pistol?-4:3;sy=hy;ex=sx+12;ey=(sy+hy)*.5+1;
            } else {
              sx=-5*(c.armDrag||0);sy=-14+3*(c.armDrag||0);hx=8-20*(c.armDrag||0);hy=sy;
              if(safe(()=>c.currentWeapon===WEAPONS.DUAL_SMG,false)){sx=3;sy=-11;hx=22;hy=-11;}
              ex=(sx+hx)*.5-2;ey=(sy+hy)*.5-1;
              if(safe(()=>c.currentWeapon===WEAPONS.PISTOL,false)&&c.isMoving&&gait.band>2) {
                const freeRun=Math.max(0,gait.band-2),sw=-Math.sin(cycle)*gait.swing;
                const reach=(R.upper+R.fore)*(typeof STAND_FORE_ARM==='number'?STAND_FORE_ARM:.65);
                const tx=1.5+sw*reach*(.44+.13*gait.band)*.62;
                const ty=-(bh*.49-gait.bend*2-Math.max(0,sw)*gait.bend*3+Math.max(0,-sw)*.8);
                const te=tx<0?tx*.63:(tx+1.5)*.42-gait.bend;
                sx+=(-1.5-sx)*freeRun;sy+=(-bh*.425-sy)*freeRun;
                hx+=(tx-hx)*freeRun;hy+=(ty-hy)*freeRun;
                ex+=(te-ex)*freeRun;ey+=(-bh*.425-.6-ey)*freeRun;
              }
            }
          }
          const toArm=(x,y,z)=>rotatePoint(x+bob,y,z,torsoHeading);
          const shoulder=toArm(sx,sy,chestHeight+7+air),hand=toArm(hx,hy,gunHeight*(c.isArmed?1:.58)+air);
          p.arms.push({side,shoulder,elbow:toArm(ex,ey,Math.min(shoulder.z,hand.z)-3),fist:hand,
            handDiameter:c.isArmed?8:R.hand,widths:[R.upperW,(R.upperW+R.foreW)*.5,R.foreW*.84]});
        }
      }
      // Reload wrists and elbows use the same authored belt/receiver visits
      // as reloadArm(), rather than a replacement sinusoidal animation.
      if(c.reloadTimer>0&&p.arms.length===2) {
        const progress=clamp(1-c.reloadTimer/90),arc=Math.sin(progress*Math.PI),one=safe(()=>oneHandWeapon(c.currentWeapon),false);
        const mount=stance?safe(()=>stanceWeaponMount(c),{x:0,y:0,angle:0,scale:1}):null;
        const map=(x,y,z)=>{
          if(!mount)return rotatePoint(x+bob,y,z,torsoHeading);
          const q=rotatePoint(x*(mount.scale||1),y*(mount.scale||1),z,angle+(mount.angle||0));
          const shift=rotatePoint(mount.x||0,mount.y||0,0);q.x+=shift.x;q.y+=shift.y-dive;return q;
        };
        const reload=(index,sx,sy,hx,hy)=>{
          const a=p.arms[index],right=index===1;a.shoulder=map(sx,sy,chestHeight+5+air);
          a.fist=map(hx,hy,gunHeight*.82+air);
          a.elbow=map(sx+(hx-sx)*.40-2.5,sy+(hy-sy)*.40+(right?2.5:-2.5),gunHeight*.72+air);
        };
        if(one) {
          const pistol=safe(()=>c.currentWeapon===WEAPONS.PISTOL,false),dual=safe(()=>c.currentWeapon===WEAPONS.DUAL_SMG,false);
          const gx=(pistol?16:22)-3*arc,gy=pistol?8:11;
          reload(1,0,bh*.425,gx,gy);
          if(!action) {
            if(dual)reload(0,0,-bh*.425,gx,-gy);
            else {
              const phase=safe(()=>handGunReloadPhase(progress),{belt:arc,rack:0});
              reload(0,0,-bh*.425,gx-3-(gx+2)*phase.belt-phase.rack*3,gy-2-(gy+8)*phase.belt-phase.rack*2);
            }
          }
        } else if(!action)reload(0,0,-bh*.425,2+Math.sin(progress*Math.PI)*10,10);
      }
      // Ordinary unarmed punches use the existing melee phase clock too.
      if(!c.isArmed&&tool==='NONE'&&c.meleeTimer>0&&p.arms.length===2) {
        const t=clamp(1-c.meleeTimer/(c.punchDuration||20)),drive=Math.sin(t*Math.PI),index=c.meleePhase===2?0:1;
        const arm=p.arms[index],side=index?1:-1,target=rotatePoint(13+21*drive,side*(6-3*drive),23);
        arm.fist=mix(arm.fist,target,drive);arm.elbow=M.elbow(arm.shoulder,arm.fist,R.upper,R.fore,rotatePoint(4,side*13,18));
      }
      const digging=safe(()=>shovelDigPose(c,gait,0),null),mantle=safe(()=>shovelMantlePose(c),null);
      const armedTool=tool==='SWORD'||tool==='PICKAXE'||tool==='SHOVEL';
      const swing=armedTool&&c.meleeTimer>0?safe(()=>swordSwingPose(c,gait),null):null;
      const toolPose=mantle||digging||swing;
      if(armedTool||mantle) {
        const carry=safe(()=>tool==='SHOVEL'?shovelCarryPose(c,gait,0):swordCarryPose(c,gait,0),{hx:7,hy:bh*.425,angle:.2,elevation:-.6});
        if(toolPose&&toolPose.right&&toolPose.left) {
          const a=mantle?(mantle.angle||angle)+(mantle.torso||0):angle+(toolPose.torso||0);
          p.arms=[toolPose.left,toolPose.right].map((arm,i)=>{
            const side=i?1:-1,shoulder=rotatePoint(arm.sx,arm.sy,chestHeight+7+air,a),fist=rotatePoint(arm.hx,arm.hy,mantle?gunHeight+4:gunHeight,a);
            return {side,shoulder,elbow:rotatePoint(arm.ex,arm.ey,gunHeight-3,a),fist,widths:[R.upperW,(R.upperW+R.foreW)*.5,R.foreW*.84]};
          });
          if(digging||mantle){p.chest.x+=Math.cos(a)*(toolPose.lean||0);p.chest.y+=Math.sin(a)*(toolPose.lean||0);}
        } else {
          const arm=p.arms[1];arm.fist=rotatePoint(carry.hx,carry.hy,gunHeight*.65+air);arm.elbow=M.elbow(arm.shoulder,arm.fist,R.upper,R.fore,rotatePoint(2,bh*.48,gunHeight*.5));
        }
        const a=mantle?(mantle.angle||angle)+(mantle.torso||0)+(mantle.toolAngle||0):angle+(toolPose?toolPose.angle||0:carry.angle||0);
        const el=mantle?mantle.toolElevation:toolPose?toolPose.elevation:carry.elevation;
        weaponRecords=[{hand:p.arms[1].fist,heading:a,elevation:Number(el)||0,mesh:tool.toLowerCase(),length:tool==='SHOVEL'?65:tool==='PICKAXE'?50:55,index:0}];
      }
      if(action&&p.arms[0]) {
        const native=safe(()=>leftActionPose(c,action),null);
        if(native) {
          const s=safe(()=>stanceSupportMount(c),{x:0,y:0,scale:1}),sc=s.scale||1,a=angle+(s.angle||0);
          const map=(x,y,z)=>{const q=rotatePoint(x*sc,y*sc,z,a);q.x+=Math.cos(angle)*(s.x||0)-Math.sin(angle)*(s.y||0);q.y+=Math.sin(angle)*(s.x||0)+Math.cos(angle)*(s.y||0)-dive;return q;};
          const arm=p.arms[0];arm.shoulder=map(native.sx,native.sy,chestHeight+7);arm.fist=map(native.hx,native.hy,gunHeight+(action===1?6:0));
          arm.elbow=map(native.ex,native.ey,gunHeight-3);
        }
      }
      if(c.mounted)for(const leg of p.legs){leg.knee.z+=3;leg.ankle.z+=2;}
      if(mode==='STUN'||(c.stunTimer>0&&c.stunPose)) {
        const fall=c.stunPose,f=Number.isFinite(options.fall)?clamp(options.fall):fall?safe(()=>fall.knockout?saloonKnockoutProgress(fall)*(c.stunTimer<32?clamp(c.stunTimer/32):1):stunFall(c),1):1;
        const yaw=fall?safe(()=>figureFallYaw(fall,fall.rag,f),angle):angle;
        const forward=rotatePoint(1,0,0,yaw),airborne=Number.isFinite(options.air)?options.air:fall&&fall.knockout&&!fall.done?(fall.knockout.height||0):0;
        const headTarget=add(mul(forward,18*f),point(0,-airborne,3+(1-f)*27));
        const chestTarget=add(mul(forward,1*f),point(0,-airborne,4+(1-f)*13));
        const pelvisTarget=add(mul(forward,-11*f),point(0,-airborne,3+(1-f)*7));
        p.head=mix(p.head,headTarget,f);p.chest=mix(p.chest,chestTarget,f);p.pelvis=mix(p.pelvis,pelvisTarget,f);
        p.forward=forward;
        const rag=fall&&fall.rag;
        for(let i=0;i<2;i++) {
          const side=i?1:-1,arm=p.arms[i],limb=rag&&rag.limbs&&rag.limbs[i];
          const shoulder=add(p.chest,rotatePoint(4,side*8,2,yaw));
          const a=yaw+side*(1.2+(limb?limb.a||0:0));
          const elbow=add(shoulder,rotatePoint(R.upper,0,1,a)),fist=add(elbow,rotatePoint(R.fore,0,0,a+side*(limb?limb.b||0:.5)));
          arm.shoulder=mix(arm.shoulder,shoulder,f);arm.elbow=mix(arm.elbow,elbow,f);arm.fist=mix(arm.fist,fist,f);
          const leg=p.legs[i],legLimb=rag&&rag.limbs&&rag.limbs[i+2],hip=add(p.pelvis,rotatePoint(0,side*5,0,yaw));
          const la=yaw+Math.PI+side*(legLimb?legLimb.a||0:.1),knee=add(hip,rotatePoint(R.thigh,0,0,la)),ankle=add(knee,rotatePoint(R.shin,0,0,la+side*(legLimb?legLimb.b||0:.1)));
          leg.hip=mix(leg.hip,hip,f);leg.knee=mix(leg.knee,knee,f);leg.ankle=mix(leg.ankle,ankle,f);leg.heading=la;
        }
        weaponRecords=[];kind='STUN';
      }
      if(mode==='QUICKDRAW') {
        const draw=clamp(options.draw===undefined?options.quickDraw:options.draw),right=p.arms[1],holster=rotatePoint(-1,bh*.49,13),ready=rotatePoint(17,8,24);
        right.fist=mix(holster,ready,draw);right.elbow=M.elbow(right.shoulder,right.fist,R.upper,R.fore,rotatePoint(3,bh*.5,17));
        const target=rotatePoint(47,11,24),holsterTip=add(right.fist,rotatePoint(11,2,-18,angle+.26));
        weaponRecords=[{hand:right.fist,muzzle:mix(holsterTip,target,draw),heading:angle+.26*(1-draw),elevation:-1.12+draw*1.20,mesh:'revolver',length:31,index:0}];kind='QUICKDRAW';
      }
    }
  }
  if(!p||!p.head||!p.chest||!p.pelvis)return null;
  const widthScale=Number(options.widthScale)>0?Number(options.widthScale):1;
  const parts=[],sockets={head:point(p.head.x,p.head.y,p.head.z),chest:point(p.chest.x,p.chest.y,p.chest.z),pelvis:point(p.pelvis.x,p.pelvis.y,p.pelvis.z)};
  const forward=p.forward||rotatePoint(1,0,0),up=p.up||M.norm(sub(p.head,p.pelvis));
  const nativeFrames=Number.isFinite(p.chestHeading),pitch=Number(p.bodyPitch)||0;
  const basis=nativeFrames?M.postureFrame(p.chestHeading,pitch):M.frame(up,forward);
  const hipBasis=nativeFrames?M.postureFrame(p.hipHeading,pitch):basis;
  const headBasis=nativeFrames?M.postureFrame(p.chestHeading,pitch):basis;
  const include=options.includeParts||options.partMask,exclude=options.excludeParts||options.omitParts;
  const selected=name=>(!include||include.includes(name)||include.includes(name.split('_').slice(0,-1).join('_')))&&(!exclude||!exclude.includes(name));
  const hitFlash=Number(c.hitFlash)>0||(kind==='BOXING'&&Number(c._boxing&&c._boxing.hitFlashMs)>0);
  const flashColor=kind==='BOXING'?[242,217,160]:[255,255,255];
  const addPart=(mesh,color,matrix,part)=>{
    if(!selected(part))return;
    const flash=hitFlash&&['torso','vest','coat','upper_arm','forearm','joint'].includes(mesh);
    parts.push({mesh,color:options.skeleton?[240,244,238]:flash?flashColor:color,matrix,part});
  };
  const oval=(mesh,pos,sx,sy,sz,color,tag,axes=basis)=>addPart(mesh,color,M.matrix(pos,axes.x,axes.y,axes.z,sx,sy,sz),tag);
  const bone=(mesh,a,b,width,color,tag,depth=width)=>addPart(mesh,color,M.segment(a,b,(options.skeleton?width*.32:width)*widthScale,(options.skeleton?depth*.32:depth)*widthScale),tag);
  const assetMeshes=typeof PLAYER3D_ASSET!=='undefined'?PLAYER3D_ASSET.meshes:null;
  // The original painter owns the visible footprint. Keep the model's real
  // height and rotation, but calibrate its projected native axes to that exact
  // authored silhouette instead of deriving chest proportions from head/hips.
  const fittedOval=(mesh,pos,length,width,depth,color,tag,axes,heading)=>{
    const raw=M.matrix(pos,axes.x,axes.y,axes.z,length*.5,width*.5,depth);
    const vertices=assetMeshes&&assetMeshes[mesh]&&assetMeshes[mesh].positions;
    const co=Math.cos(heading),si=Math.sin(heading);
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
    const scan=(vx,vy,vz)=>{
      const x=raw[0]*vx+raw[4]*vy+raw[8]*vz,y=raw[1]*vx+raw[5]*vy+raw[9]*vz;
      const q=x*co+y*si,r=-x*si+y*co;x0=Math.min(x0,q);x1=Math.max(x1,q);y0=Math.min(y0,r);y1=Math.max(y1,r);
    };
    if(vertices)for(let i=0;i<vertices.length;i+=3)scan(vertices[i],vertices[i+1],vertices[i+2]);
    else for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])scan(x,y,z);
    const sx=length/Math.max(.001,x1-x0),sy=width/Math.max(.001,y1-y0);
    for(const column of [0,4,8]) {
      const x=raw[column],y=raw[column+1],q=(x*co+y*si)*sx,r=(-x*si+y*co)*sy;
      raw[column]=co*q-si*r;raw[column+1]=si*q+co*r;
    }
    const dx=(x0+x1)*.5*sx,dy=(y0+y1)*.5*sy;
    raw[12]-=co*dx-si*dy;raw[13]-=si*dx+co*dy;
    addPart(mesh,color,raw,tag);return raw;
  };
  const torsoDepth=Number(p.torsoDepth)||bw*.42,torsoWidth=Number(p.torsoWidth)||bh*.47;
  const torsoLength=Number(p.torsoLength)||Math.max(8,Math.hypot(p.head.x-p.pelvis.x,p.head.y-p.pelvis.y,p.head.z-p.pelvis.z)*.48);
  if(nativeFrames) {
    fittedOval('pelvis',p.pelvis,11+floor*2,bh*.61*(1-(stance&&stance.roll?stance.roll.side*.5:0)),4.5,palette.pants,'pelvis',hipBasis,p.hipHeading);
    fittedOval('torso',p.chest,p.torsoProjectedLength,p.torsoProjectedWidth,torsoLength,palette.shirt,'torso',basis,p.chestHeading);
  } else {
    oval('pelvis',p.pelvis,torsoDepth*.85,torsoWidth*.69,4.5,palette.pants,'pelvis',hipBasis);
    oval('torso',p.chest,torsoDepth,torsoWidth,torsoLength,palette.shirt,'torso');
  }
  const neck=mix(p.chest,p.head,.68);bone('forearm',neck,p.head,4.8,palette.skin,'neck');
  // A genuinely spherical head retains its silhouette through prone rolls
  // and corpse orientations. The previous unequal depth made fallen heads
  // read as eggs, even when their standing XY footprint was fitted round.
  const headRadius=(nativeFrames?p.headProjectedDiameter*.5:Number(p.headRadius)||5.5)*PLAYER3D_HEAD_SCALE;
  oval('head',p.head,headRadius,headRadius,headRadius,palette.skin,'head',headBasis);
  const arms=p.arms||[],legs=p.legs||[];
  arms.forEach((arm,i)=>{
    const side=arm.side===-1||arm.side===1?arm.side:i?1:-1,tag=side<0?'left':'right';
    const shoulder=arm.shoulder,elbow=arm.elbow,hand=arm.fist||arm.hand;
    if(!shoulder||!elbow||!hand)return;
    sockets[tag+'Shoulder']=point(shoulder.x,shoulder.y,shoulder.z);sockets[tag+'Elbow']=point(elbow.x,elbow.y,elbow.z);sockets[tag+'Hand']=point(hand.x,hand.y,hand.z);sockets[tag+'Fist']=sockets[tag+'Hand'];
    bone('upper_arm',shoulder,elbow,arm.widths?arm.widths[0]:R.upperW,palette.shirt,'upper_arm_'+tag);
    bone('forearm',elbow,hand,R.foreW*(arm.widths?arm.widths[0]/R.upperW:1),palette.shirt,'forearm_'+tag);
    if(assetMeshes&&assetMeshes.joint&&!options.skeleton)oval('joint',elbow,(arm.widths?arm.widths[1]:(R.upperW+R.foreW)*.5)*.5*widthScale,(arm.widths?arm.widths[1]:(R.upperW+R.foreW)*.5)*.5*widthScale,(arm.widths?arm.widths[1]:(R.upperW+R.foreW)*.5)*.5*widthScale,palette.shirt,'upper_arm_'+tag,M.postureFrame(0));
    if(nativeFrames)fittedOval('hand',hand,(arm.handDiameter||R.hand)*widthScale,(arm.handDiameter||R.hand)*widthScale,R.hand*.42*widthScale,chemist&&side<0?[177,184,194]:palette.skin,'hand_'+tag,M.postureFrame(p.chestHeading),p.chestHeading);
    else oval('hand',hand,R.hand*.43*widthScale,R.hand*.43*widthScale,R.hand*.42*widthScale,chemist&&side<0?[177,184,194]:palette.skin,'hand_'+tag);
  });
  legs.forEach((leg,i)=>{
    const tag=i?'right':'left';if(!leg.hip||!leg.knee||!leg.ankle)return;
    sockets[tag+'Hip']=point(leg.hip.x,leg.hip.y,leg.hip.z);sockets[tag+'Knee']=point(leg.knee.x,leg.knee.y,leg.knee.z);sockets[tag+'Ankle']=point(leg.ankle.x,leg.ankle.y,leg.ankle.z);
    bone('thigh',leg.hip,leg.knee,R.thighW,palette.pants,'thigh_'+tag);
    bone('shin',leg.knee,leg.ankle,R.shinW,palette.pants,'shin_'+tag);
    const direction=Number.isFinite(leg.heading)?leg.heading:angle;
    if(nativeFrames) {
      const scale=leg.widths?leg.widths[1]/R.shinW:1;
      const center=add(leg.ankle,rotatePoint((stance?1.5*scale:R.foot*.34)*widthScale,0,.2,direction));
      fittedOval('foot',center,R.foot*scale*widthScale,R.shinW*(stance?.82:.80)*scale*widthScale,R.shinW*.45*widthScale,palette.boot,'foot_'+tag,M.postureFrame(direction),direction);
      sockets[tag+'Foot']=center;
    } else {
      const toe=add(leg.ankle,rotatePoint(R.foot*.62*widthScale,0,.2,direction));
      bone('foot',leg.ankle,toe,R.shinW*.82,palette.boot,'foot_'+tag,R.shinW*.7);sockets[tag+'Foot']=toe;
    }
  });
  if(!options.skeleton) {
    if(armored){oval('vest',p.chest,torsoDepth*1.06,torsoWidth*1.04,torsoLength*1.03,[91,104,76],'armor');oval('helmet',p.head,7.1,7.3,7.5,[74,85,74],'helmet');oval('visor',add(p.head,mul(forward,1)),6.7,6.9,7.5,[84,110,124],'headwear');}
    else if(chemist){if(nativeFrames)fittedOval('coat',p.chest,p.torsoProjectedLength,p.torsoProjectedWidth,torsoLength,palette.shirt,'coat',basis,p.chestHeading);else oval('coat',p.chest,torsoDepth*1.02,torsoWidth*1.02,torsoLength*1.07,palette.shirt,'coat');}
    else if(ninja)oval('hood',p.head,6.6,6.8,7.4,[22,23,30],'headwear');
    else if(cowboy)oval('cowboy_hat',add(p.head,mul(basis.z,4)),6.2,6.5,4.5,[108,80,46],'headwear');
    else {
      const hat=safe(()=>headwearOf(identity),null);
      if(hat)oval(hat==='STETSON'?'cowboy_hat':hat==='HOOD'?'hood':'helmet',add(p.head,mul(basis.z,2)),hat==='STETSON'?6.2:7.1,hat==='STETSON'?6.5:7.3,hat==='STETSON'?4.5:7.5,[75,86,80],'headwear');
    }
    if(identity.jetpack){const packCenter=add(p.chest,mul(forward,-bw*(typeof TORSO_DEPTH==='number'?TORSO_DEPTH:.84)*.5-.5));
      if(nativeFrames)fittedOval('jetpack',packCenter,12,24,6.5,[87,94,104],'jetpack',basis,p.chestHeading);
      else oval('jetpack',add(p.chest,mul(forward,-torsoDepth*.82)),14,17,14,[87,94,104],'jetpack');}
  }
  // Socket positions are actor-local, never absolute world coordinates. The
  // forward muzzle vertices of exported weapons are anchored at these exact
  // native projectile/laser origins, including recoil and stance transforms.
  const nativeMuzzle=index=>{
    const q=safe(()=>aimLaserMuzzle(c,index),null);
    return q?point(q.x-c.x,q.y-c.y,gunHeight):null;
  };
  const meshes=typeof PLAYER3D_ASSET!=='undefined'?PLAYER3D_ASSET.meshes:null;
  const weaponKey=safe(()=>{
    if(typeof WEAPONS==='undefined')return String(c.currentWeapon&&c.currentWeapon.name||'PISTOL').toLowerCase();
    for(const key of Object.keys(WEAPONS))if(WEAPONS[key]===c.currentWeapon)return key.toLowerCase();return 'pistol';
  },'pistol');
  const weaponNames={assault_rifle:'rifle',rocket_launcher:'rocket',dual_smg:'smg',machine_gun:'smg',dual_smgs:'smg'};
  const showGun=options.weapon!==false&&!options.skeleton&&kind!=='BOXING'&&kind!=='STUN'&&(c.isArmed||c.reloadTimer>0||mode==='QUICKDRAW'||weaponRecords.some(r=>r.mesh));
  if(showGun) {
    if(!weaponRecords.length) {
      const count=weaponKey==='dual_smg'?2:1;
      for(let i=0;i<count;i++)weaponRecords.push({hand:sockets[i?'leftHand':'rightHand']||sockets.rightHand,heading:angle,index:i});
    }
    for(const record of weaponRecords) {
      if(!record.hand)continue;
      const name=record.mesh||weaponNames[weaponKey]||weaponKey,tag=record.index?'weapon_secondary':'weapon_primary';
      let muzzle=record.mesh?record.muzzle:nativeMuzzle(record.index||0)||record.muzzle;
      // The bow is held by the support hand; the strong hand draws the
      // string. Firearms keep the strong-side grip as their rigid anchor.
      const hand=name==='bow'&&sockets.leftHand?sockets.leftHand:record.hand,heading=Number.isFinite(record.heading)?record.heading:angle,el=Number(record.elevation)||0;
      const grip=(meshes&&meshes[name]&&meshes[name].grip)||[-.28,0,0],muzzleLocal=(meshes&&meshes[name]&&meshes[name].muzzle)||[.5,0,0],span=Math.max(.01,muzzleLocal[0]-grip[0]);
      let length=record.length||(['rifle','shotgun','coach_gun','particle_beam'].includes(name)?49:name==='rocket'?57:name==='bow'?40:name==='revolver'?32:24);
      let axis=rotatePoint(Math.cos(el),0,Math.sin(el),heading);
      if(!muzzle)muzzle=add(hand,mul(axis,length*span));
      else {
        const dx=muzzle.x-hand.x,dy=muzzle.y-hand.y,d=Math.hypot(dx,dy),z=Math.sin(el)*length*span;
        axis=M.norm(point(dx,dy,z));length=Math.max(1,Math.hypot(d,z)/span);muzzle.z=hand.z+z;
      }
      let side=M.norm(M.cross(point(0,0,1),axis));if(Math.hypot(side.x,side.y,side.z)<.01)side=rotatePoint(0,1,0,heading);
      const upAxis=M.norm(M.cross(axis,side));
      const center=sub(hand,add(mul(axis,grip[0]*length),add(mul(side,grip[1]*length),mul(upAxis,grip[2]*length))));
      const sourceMaterial=meshes&&meshes[name]&&meshes[name].material;
      const sourceColor=typeof PLAYER3D_ASSET!=='undefined'&&PLAYER3D_ASSET.palette&&PLAYER3D_ASSET.palette[sourceMaterial];
      const weaponColor=sourceColor?sourceColor.slice(0,3).map(x=>x*255):sourceMaterial==='wood'?palette.wood:palette.steel;
      addPart(name,weaponColor,M.matrix(center,axis,side,upAxis,length,length,length),tag);
      if(name==='bow') {sockets.bowGrip=point(hand.x,hand.y,hand.z);sockets.bowString=sockets.rightHand||hand;}
      sockets[record.index?'secondaryMuzzle':'muzzle']=muzzle;sockets[record.index?'secondaryGrip':'primaryGrip']=point(hand.x,hand.y,hand.z);
    }
  }
  if(!sockets.muzzle)sockets.muzzle=nativeMuzzle(0)||add(p.head,rotatePoint(16,8,gunHeight));
  const leftOrigin=safe(()=>leftActionMuzzle(c,angle),null);
  sockets.leftMuzzle=leftOrigin?point(leftOrigin.x-c.x,leftOrigin.y-c.y,gunHeight):sockets.leftHand||p.head;
  if(action&&options.weapon!==false&&!options.skeleton&&sockets.leftHand) {
    const hand=sockets.leftHand;
    if(action===2) {
      const muzzle=sockets.leftMuzzle,axis=M.norm(sub(muzzle,hand)),center=mix(hand,muzzle,.4);
      addPart('cannon',[149,159,173],M.segment(sub(center,mul(axis,4)),add(center,mul(axis,4)),6,6),'cannon');
    } else if(typeof isCooking!=='undefined'&&isCooking)oval(chemist?'flask':'grenade',add(hand,point(0,0,2)),4,4,5,chemist?[127,192,223]:[66,117,59],'held_grenade');
  }
  // Resolve every wound from its anatomical attachment. The renderer raycasts
  // that part's actual mesh before drawing a depth-tested cap, so a moving hand
  // can cover a torso wound and a deferred arm pass cannot duplicate head blood.
  const stains=[];
  for(const decal of options.skeleton?[]:c.decals||[]) {
    if(!decal)continue;
    let position,part;
    if(decal.isLeg) {
      const index=decal.legIndex===1?1:0,leg=legs[index];if(!leg)continue;
      const shin=decal.legSegment!==0,a=shin?leg.knee:leg.hip,b=shin?leg.ankle:leg.knee;
      if(!a||!b)continue;
      position=mix(a,b,clamp(decal.legU===undefined?.8:decal.legU));
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
      const width=shin?R.shinW:R.thighW,across=(Number(decal.legV)||0)*width;
      position.x-=dy/length*across;position.y+=dx/length*across;
      part=(shin?'shin_':'thigh_')+(index?'right':'left');
    } else {
      const anchor=decal.isHead?p.head:p.chest,q=rotatePoint(Number(decal.x)||0,Number(decal.y)||0,0);
      position=add(anchor,q);part=decal.isHead?'head':armored?'armor':chemist?'coat':'torso';
    }
    if(!selected(part))continue;
    stains.push({x:position.x,y:position.y,z:position.z,part,size:Number(decal.sz)||2,color:decal.col||[102,4,14,220]});
  }
  let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;
  for(const part of parts) {
    const a=part.matrix,unit=['head','hand','torso','pelvis','helmet','hood','cowboy_hat','vest','coat','jetpack','visor','grenade','flask','joint'].includes(part.mesh)?1:.5;
    const rx=(Math.abs(a[0])+Math.abs(a[4])+Math.abs(a[8]))*unit+1.5,ry=(Math.abs(a[1])+Math.abs(a[5])+Math.abs(a[9]))*unit+1.5;
    minx=Math.min(minx,a[12]-rx);maxx=Math.max(maxx,a[12]+rx);miny=Math.min(miny,a[13]-ry);maxy=Math.max(maxy,a[13]+ry);
  }
  if(!parts.length){minx=miny=-1;maxx=maxy=1;}
  const projectedSockets={};for(const name of Object.keys(sockets))projectedSockets[name]=player3DProjectPoint(sockets[name]);
  const origin=actor._player3DWorldOrigin||actor;
  const originZ=Number(origin.z);
  const worldOrigin={x:Number(origin.x)||0,y:Number(origin.y)||0,z:Number.isFinite(originZ)?originZ:safe(()=>groundElev(Number(origin.x)||0,Number(origin.y)||0),0)};
  return {parts,sockets,projectedSockets,bounds:[minx,miny,maxx,maxy],kind,identity,stains,pose:p,palette,worldOrigin};
}

// Renderer and gameplay adapters use the same fixed orthographic projection.
function player3DProjectPoint(p, origin = null) {
  return {x:(Number(p&&p.x)||0)+(Number(origin&&origin.x)||0), y:(Number(p&&p.y)||0)+(Number(origin&&origin.y)||0), z:Number(p&&p.z)||0};
}

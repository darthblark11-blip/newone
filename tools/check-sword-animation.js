// Trace the actual live sword and fitted arm surfaces. A correct mesh alone
// cannot catch a palm painted below its hilt or a running wrist losing a grip.
const {ctx,probe}=require('./harness.js');
const P=s=>probe('('+s+')');
let checks=0,fails=0;
function ok(name,pass,detail){checks++;if(!pass)fails++;console.log((pass?'  ok   ':'  FAIL ')+name+(detail===undefined?'':'  '+detail));}
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

probe(`isStoryMode=false;townsData={};startAtLevel(2);started=true;doTick=true;
  viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;
  enemiesList.length=0;swordPickedUp=true;setMeleeTool("SWORD");
  chemistSuitUnlocked=false;ninjaSuitUnlocked=false;isCooking=false;cannonInputHeld=false;
  leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
  player.isArmed=false;player.aimHold=0;player.hp=100;player.dead=false;
  player.throwAnimTimer=0;player.cannonCharge=0;player.cannonFireDelay=0;
  player.reloadTimer=0;player.dashTimer=0;player.muzzleFlash=0;`);
const rig=P('figureRig(player.bodyW,player.bodyH)');

function trace(setup) {
  probe(setup);
  const saved={};
  for(const key of ['push','pop','translate','rotate','scale','quad','vertex','figureCelOval',
                    'figureCelLimb','drawSwordGrip','drawSwordBlade','drawPickGrip','drawPickHeadSolid','handGunBox'])saved[key]=ctx[key];
  let m=[1,0,0,1,0,0],active=null;const stack=[],events=[],palms=[],arms=[],boxes=[],blades=[];
  const point=(x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
  ctx.push=()=>stack.push(m.slice());
  ctx.pop=()=>{if(stack.length)m=stack.pop();};
  ctx.translate=(x,y)=>{const p=point(x,y);m[4]=p[0];m[5]=p[1];};
  ctx.rotate=a=>{const c=Math.cos(a),s=Math.sin(a),[a0,a1,a2,a3]=m;m[0]=a0*c+a2*s;m[1]=a1*c+a3*s;m[2]=a2*c-a0*s;m[3]=a3*c-a1*s;};
  ctx.scale=(x,y=x)=>{m[0]*=x;m[1]*=x;m[2]*=y;m[3]*=y;};
  let finite=true;
  ctx.vertex=function(...args){if(args.some(v=>!Number.isFinite(v)))finite=false;return saved.vertex(...args);};
  ctx.quad=function(...args){if(args.some(v=>!Number.isFinite(v)))finite=false;return saved.quad(...args);};
  ctx.figureCelOval=function(g,x,y,w,h){
    if(Math.abs(w-rig.hand)<1e-7&&Math.abs(h-rig.hand)<1e-7){
      const palm=point(x,y);palms.push(palm);events.push({kind:'palm',point:palm});
    }
    return saved.figureCelOval(...arguments);
  };
  ctx.figureCelLimb=function(g,sx,sy,ex,ey,hx,hy,w0,w1,w2){
    if(Math.abs(w0-rig.upperW)<1e-7&&Math.abs(w2-rig.foreW*.84)<1e-7){
      arms.push({shoulder:point(sx,sy),elbow:point(ex,ey),wrist:point(hx,hy),
                 upper:Math.hypot(ex-sx,ey-sy),fore:Math.hypot(hx-ex,hy-ey)});
    }
    return saved.figureCelLimb(...arguments);
  };
  for(const name of ['drawSwordGrip','drawPickGrip'])ctx[name]=function(projection){
    const grip=point(...projection.point(0,0,0));events.push({kind:'grip',point:grip});
    const prev=active;active='grip';try{return saved[name](...arguments);}finally{active=prev;}
  };
  for(const [name,tip]of [['drawSwordBlade',46],['drawPickHeadSolid',40]])ctx[name]=function(projection){
    const blade={grip:point(...projection.point(0,0,0)),tip:point(...projection.point(tip,0,0)),
                 guard:point(...projection.point(8,0,0))};
    blades.push(blade);events.push({kind:'blade',point:blade.grip});
    const prev=active;active='blade';try{return saved[name](...arguments);}finally{active=prev;}
  };
  ctx.handGunBox=function(projection,...args){if(active)boxes.push({part:active,bounds:args});return saved.handGunBox(projection,...args);};
  try{probe('player.show();');}finally{Object.assign(ctx,saved);}
  return {events,palms,arms,boxes,blades,finite,balanced:stack.length===0};
}
function layered(r) {
  if(r.blades.length!==1||r.palms.length!==2)return false;
  const i=r.events.findIndex(e=>e.kind==='grip'),j=r.events.findIndex(e=>e.kind==='blade');
  const palm=r.events.findIndex((e,n)=>n>i&&e.kind==='palm'&&distance(e.point,r.blades[0].grip)<1e-7);
  return i>=0&&palm>i&&j>palm;
}
function honestArms(r) {
  return r.arms.length===2&&r.arms.every(a=>a.upper<=rig.upper+1e-7&&a.fore<=rig.fore+1e-7&&
           r.palms.some(h=>distance(h,a.wrist)<1e-7));
}
const headings=[0,Math.PI/2,Math.PI,-Math.PI/2],gaits=[0,.2,.5,1];
let badLayer=null,badBones=null,badPaint=null,badGuard=null;
const carrySignature=[];
let poses=0;
console.log('== sword carry: actual palm/hilt order and arm fit ==');
for(const heading of headings)for(const gait of gaits)for(let phase=0;phase<16;phase++) {
  const r=trace(`player.aimAngle=${heading};player.moveAngle=${heading};player.gait=${gait};
    player.isMoving=${gait>0};player.walkCycle=${phase*Math.PI/8};player.meleeTimer=0;
    player.isArmed=false;player.throwAnimTimer=0;player.cannonCharge=0;chemistSuitUnlocked=false;`);
  poses++;
  if(!layered(r))badLayer={heading,gait,phase,events:r.events};
  if(!honestArms(r))badBones={heading,gait,phase,arms:r.arms};
  if(!r.finite||!r.balanced)badPaint={heading,gait,phase};
  if(r.blades[0]&&distance(r.blades[0].guard,r.blades[0].grip)<rig.hand*.5+.3)badGuard={heading,gait,phase};
  if(heading===0&&gait===0&&phase===0)carrySignature.push(...r.boxes);
}
ok('the leather grip is below the actual fist, with steel and guard painted after it',!badLayer,badLayer&&JSON.stringify(badLayer));
ok('both carried arms end on their palms and keep honest upper/forearm lengths',!badBones,badBones&&JSON.stringify(badBones));
ok('the brass guard stays outside the fingers through all headings and gaits',!badGuard,badGuard&&JSON.stringify(badGuard));
ok('all sword carry geometry is finite and restores painter transforms',!badPaint,`${poses} poses`);

console.log('\n== native slash, backhand and finisher clocks ==');
badLayer=null;badBones=null;badPaint=null;let badHit=null,badMesh=null;
poses=0;
for(const [phase,backhand,duration]of [[1,false,20],[2,true,20],[3,false,20],[4,true,30]]) {
  for(const heading of headings)for(const gait of gaits)for(let timer=duration;timer>0;timer--) {
    const r=trace(`player.meleePhase=${phase};player.isBackhand=${backhand};player.meleeTimer=${timer};
      player.aimAngle=${heading};player.moveAngle=${heading};player.gait=${gait};player.isMoving=${gait>0};
      player.walkCycle=1.1;player.isArmed=false;`);
    poses++;
    if(!layered(r))badLayer={phase,heading,gait,timer};
    if(!honestArms(r))badBones={phase,heading,gait,timer,arms:r.arms};
    if(!r.finite||!r.balanced)badPaint={phase,heading,gait,timer};
    if(JSON.stringify(r.boxes)!==JSON.stringify(carrySignature))badMesh={phase,heading,gait,timer};
    if(timer===duration/2) {
      const b=r.blades[0],angle=Math.atan2(b.tip[1]-b.grip[1],b.tip[0]-b.grip[0]);
      const diff=Math.atan2(Math.sin(angle-heading),Math.cos(angle-heading));
      if(Math.abs(diff)>.25)badHit={phase,heading,gait,timer,diff};
    }
  }
}
ok('all combo stages keep the grip beneath the fist and exactly two palms',!badLayer,badLayer&&JSON.stringify(badLayer));
ok('continuous swing sleeves respect both bones and terminate on actual palms',!badBones,badBones&&JSON.stringify(badBones));
ok('sword faces and hilt keep the same mesh from carrying through the finisher',!badMesh,badMesh&&JSON.stringify(badMesh));
ok('the sword passes through the facing direction on each native damage frame',!badHit,badHit&&JSON.stringify(badHit));
ok('every combo frame emits finite balanced geometry',!badPaint,`${poses} poses`);

console.log('\n== the pick shares the same fitted carry and swing rig ==');
probe('window.pickaxeOwned=true;setMeleeTool("PICKAXE");');
badLayer=null;badBones=null;badPaint=null;badHit=null;badMesh=null;poses=0;
const pickMesh=trace('player.meleeTimer=0;player.isArmed=false;').boxes;
for(const heading of headings)for(const gait of gaits) {
  for(const [phase,backhand,duration]of [[0,false,0],[1,false,20],[2,true,20],[4,true,30]]) {
    for(let timer=Math.max(1,duration);timer>0;timer--) {
      const r=trace(`player.meleePhase=${phase};player.isBackhand=${backhand};player.meleeTimer=${duration?timer:0};
        player.aimAngle=${heading};player.moveAngle=${heading};player.gait=${gait};player.isMoving=${gait>0};
        player.walkCycle=1.1;player.isArmed=false;`);
      poses++;
      if(!layered(r))badLayer={phase,heading,gait,timer};
      if(!honestArms(r))badBones={phase,heading,gait,timer,arms:r.arms};
      if(!r.finite||!r.balanced)badPaint={phase,heading,gait,timer};
      if(JSON.stringify(r.boxes)!==JSON.stringify(pickMesh))badMesh={phase,heading,gait,timer};
      if(duration&&timer===duration/2) {
        const b=r.blades[0],angle=Math.atan2(b.tip[1]-b.grip[1],b.tip[0]-b.grip[0]);
        const diff=Math.atan2(Math.sin(angle-heading),Math.cos(angle-heading));
        if(Math.abs(diff)>.25)badHit={phase,heading,gait,timer,diff};
      }
    }
  }
}
ok('the actual palm wraps above the pick handle through carry, slash and finisher',!badLayer,badLayer&&JSON.stringify(badLayer));
ok('the pick keeps two fitted sleeves without stretching either arm',!badBones,badBones&&JSON.stringify(badBones));
ok('carry and swing retain one rigid shaft and opposed spike head',!badMesh,badMesh&&JSON.stringify(badMesh));
ok('the pick meets the facing direction on its unchanged native hit/harvest frames',!badHit,badHit&&JSON.stringify(badHit));
ok('every pick pose emits finite balanced geometry',!badPaint,`${poses} poses`);
probe('setMeleeTool("SWORD");');

console.log('\n== free hand actions and painting without time ==');
let badAction=null;
for(const action of ['throw','cannon'])for(const timer of [20,10,1]) {
  const r=trace(`player.meleePhase=1;player.meleeTimer=${timer};player.isMoving=true;player.gait=1;
    player.isArmed=false;player.throwAnimTimer=${action==='throw'?12:0};
    chemistSuitUnlocked=${action==='cannon'};player.cannonCharge=${action==='cannon'?65:0};`);
  if(!layered(r)||!honestArms(r)||!r.finite||!r.balanced)badAction={action,timer};
}
ok('throw and cannon poses replace the recovery off hand without creating an extra arm',!badAction,badAction&&JSON.stringify(badAction));
probe('player.throwAnimTimer=0;player.cannonCharge=0;chemistSuitUnlocked=false;player.meleeTimer=11;');
const before=P('({timer:player.meleeTimer,phase:player.meleePhase,cooldown:player.meleeCooldown,combo:player.meleeComboTimer,ammo:player.ammo,hp:player.hp})');
const first=trace(''),second=trace('');
const after=P('({timer:player.meleeTimer,phase:player.meleePhase,cooldown:player.meleeCooldown,combo:player.meleeComboTimer,ammo:player.ammo,hp:player.hp})');
ok('repainting the sword preserves native combat clocks, health and ammo',JSON.stringify(before)===JSON.stringify(after)&&JSON.stringify(first.blades)===JSON.stringify(second.blades));
probe('player.isArmed=true;player.meleeTimer=0;player.muzzleFlash=0;player.currentWeapon=WEAPONS.PISTOL;');
ok('a carried firearm occupies the hand and hides all sword art',trace('').blades.length===0);
probe('rightStick.active=true;player.aimHold=14;');
ok('aiming a firearm hides all sword art',trace('').blades.length===0);

console.log(`\n${checks-fails}/${checks} checks passed`);
process.exit(fails?1:0);

// Trace the live rifle/shotgun meshes and native fire/update methods. A good
// carry drawing is insufficient if aiming silently falls back to the old rects.
const {ctx,probe}=require('./harness.js');
const P=s=>probe('('+s+')');
let checks=0,fails=0;
function ok(name,pass,detail){checks++;if(!pass)fails++;console.log((pass?'  ok   ':'  FAIL ')+name+(detail===undefined?'':'  '+detail));}
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const close=(a,b)=>Math.abs(a-b)<1e-8;

probe(`isStoryMode=false;townsData={};startAtLevel(2);started=true;doTick=true;
       viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;
       enemiesList.length=0;swordPickedUp=false;setMeleeTool("NONE");
       chemistSuitUnlocked=false;ninjaSuitUnlocked=false;isCooking=false;cannonInputHeld=false;
       window.milLvl=0;elevRenderScale=function(){return 1;};
       leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};
       rightStick={active:true,dx:1,dy:0,dist:.5,base:{x:0,y:0}};
       player.forceNudge=function(){};player.checkCol=function(){return false;};`);

function prepare(weapon,heading=0){
  probe(`player.currentWeapon=WEAPONS.${weapon};player.x=5000;player.y=5000;
         player.aimAngle=${heading};player.moveAngle=${heading};player.isMoving=false;
         player.hp=100;player.dead=false;player.ammo=20;player.gait=0;player.walkCycle=0;
         player.weaponKick=0;player.fireTimer=0;player.muzzleFlash=0;player.reloadTimer=0;
         player.meleeTimer=0;player.dashTimer=0;player.throwAnimTimer=0;
         player.cannonCharge=0;player.cannonFireDelay=0;player.armDrag=0;
         player.aimHold=14;player.isArmed=true;rightStick.active=true;
         rightStick.dx=Math.cos(${heading});rightStick.dy=Math.sin(${heading});rightStick.dist=.5;
         bullets.length=0;`);
}

function trace(source){
  const saved={};
  for(const k of ['push','pop','translate','rotate','scale','quad','line','fill','stroke','beginShape','drawLongGunSolid','handGunBox','longGunMuzzle','figureCelOval','figureCelLimb'])saved[k]=ctx[k];
  let m=[1,0,0,1,0,0],activeGun=null,activeBox=null,laserStroke=false,flashFill=false;
  const stack=[],guns=[],palms=[],lasers=[],flashes=[],arms=[];
  const armWidth=P('figureRig(player.bodyW,player.bodyH).upperW');
  const point=(x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
  ctx.push=()=>stack.push(m.slice());
  ctx.pop=()=>{if(stack.length)m=stack.pop();};
  ctx.translate=(x,y)=>{const p=point(x,y);m[4]=p[0];m[5]=p[1];};
  ctx.rotate=a=>{const c=Math.cos(a),s=Math.sin(a),[a0,a1,a2,a3]=m;m[0]=a0*c+a2*s;m[1]=a1*c+a3*s;m[2]=a2*c-a0*s;m[3]=a3*c-a1*s;};
  ctx.scale=(x,y=x)=>{m[0]*=x;m[1]*=x;m[2]*=y;m[3]*=y;};
  ctx.stroke=function(...args){laserStroke=args[0]===255&&args[1]===0&&args[2]===0;return saved.stroke(...args);};
  ctx.fill=function(...args){flashFill=args[0]===255&&args[1]===200&&args[2]===0&&args[3]===200;return saved.fill(...args);};
  ctx.line=function(x,y,x1,y1){if(laserStroke&&x1===800)lasers.push(point(x,y));return saved.line(...arguments);};
  ctx.beginShape=function(){if(flashFill)flashes.push(point(0,0));return saved.beginShape(...arguments);};
  ctx.quad=function(...args){
    if(activeBox)activeBox.quads.push([0,2,4,6].map(i=>point(args[i],args[i+1])));
    return saved.quad(...args);
  };
  ctx.drawLongGunSolid=function(w,projection,kick,pump){
    const rear=projection.point(0,0,0),fore=projection.point(18.5-(pump||0)*6,0,0);
    const gun={weapon:w.name,kick:kick||0,pump:pump||0,boxes:[],rear:point(...rear),fore:point(...fore)};
    guns.push(gun);const old=activeGun;activeGun=gun;
    try{return saved.drawLongGunSolid(...arguments);}finally{activeGun=old;}
  };
  ctx.handGunBox=function(projection,x0,x1,y0,y1,z0,z1,r,g,b){
    const box={bounds:[x0,x1,y0,y1,z0,z1],rgb:[r,g,b],quads:[]};
    if(activeGun)activeGun.boxes.push(box);const old=activeBox;activeBox=box;
    try{return saved.handGunBox(...arguments);}finally{activeBox=old;}
  };
  ctx.longGunMuzzle=function(projection,muzzle){
    if(activeGun)activeGun.muzzle=point(...projection.point(muzzle,0,0));
    return saved.longGunMuzzle(...arguments);
  };
  ctx.figureCelOval=function(g,x,y,w,h){
    if(w===8&&h===8)palms.push(point(x,y));
    return saved.figureCelOval(...arguments);
  };
  ctx.figureCelLimb=function(g,sx,sy,ex,ey,hx,hy,w0){
    if(w0===armWidth)arms.push({local:[sx,sy,ex,ey,hx,hy],shoulder:point(sx,sy),elbow:point(ex,ey),wrist:point(hx,hy)});
    return saved.figureCelLimb(...arguments);
  };
  try{probe(source);}finally{Object.assign(ctx,saved);}
  return {guns,palms,lasers,flashes,arms,balanced:stack.length===0};
}
const part=(gun,rgb,predicate=()=>true)=>gun.boxes.find(b=>b.rgb.every((v,i)=>v===rgb[i])&&predicate(b));
const centre=box=>{const ps=box.quads.flat();return [ps.reduce((n,p)=>n+p[0],0)/ps.length,ps.reduce((n,p)=>n+p[1],0)/ps.length];};
const signature=gun=>JSON.stringify(gun.boxes.map(b=>[b.bounds,b.rgb]));

console.log('== native firing and moving muzzle registration ==');
for(const [weapon,count]of [['ASSAULT_RIFLE',1],['SHOTGUN',4]]){
  let failure=null,gripFailure=null;
  for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    for(const gait of [0,.2,.5,1]){
      for(const phase of [0,Math.PI/2,Math.PI]){
        prepare(weapon,heading);
        probe(`player.isMoving=${gait>0};player.gait=${gait};player.walkCycle=${phase};player.fire(player.aimAngle);`);
        const state=P(`({x:player.x,y:player.y,ammo:player.ammo,cd:player.fireTimer,wantedCd:player.currentWeapon.fireCooldown,kick:player.weaponKick,shots:bullets.map(b=>[b.x,b.y])})`);
        const r=trace('player.show();'),gun=r.guns[0],bob=gait?Math.abs(Math.sin(phase))*2:0;
        const expected=[state.x+Math.cos(heading)*(47+bob)-Math.sin(heading)*6,state.y+Math.sin(heading)*(47+bob)+Math.cos(heading)*6];
        if(!r.balanced||r.guns.length!==1||state.ammo!==19||state.cd!==state.wantedCd||state.kick!==6||state.shots.length!==count||
           !gun||distance(gun.muzzle,expected)>1e-7||state.shots.some(p=>distance(p,expected)>1e-7)||
           r.lasers.length!==1||r.flashes.length!==1||[...r.lasers,...r.flashes].some(p=>distance(p,expected)>1e-7))failure={heading,gait,phase,state,expected,muzzle:gun&&gun.muzzle,lasers:r.lasers,flashes:r.flashes};
        if(!gun||r.palms.length!==2||![gun.rear,gun.fore].every(p=>r.palms.some(h=>distance(h,p)<1e-7)))gripFailure={heading,gait,phase,palms:r.palms,rear:gun&&gun.rear,fore:gun&&gun.fore};
      }
    }
  }
  ok(`${weapon}: native ammo/cooldown and gun/flash/laser/projectile registration survive four headings and all gaits`,!failure,failure&&JSON.stringify(failure));
  ok(`${weapon}: both actual palms sit on their projected grip points while aiming/firing`,!gripFailure,gripFailure&&JSON.stringify(gripFailure));
}

console.log('\n== raised two-handed arm surfaces ==');
for(const weapon of ['ASSAULT_RIFLE','SHOTGUN','BOW','ROCKET_LAUNCHER','COACH_GUN']){
  let bad=null,poses=0;
  for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const gait of [0,.2,.5,1])for(const phase of [0,Math.PI/2,Math.PI,3*Math.PI/2]){
    prepare(weapon,heading);
    probe(`player.isMoving=${gait>0};player.gait=${gait};player.walkCycle=${phase};`);
    const r=trace('player.show();'),[bw,bh]=P('[player.bodyW,player.bodyH]');poses++;
    if(!r.balanced||r.arms.length!==2||r.palms.length!==2)bad={heading,gait,phase,reason:'missing/duplicate arms'};
    for(const a of r.arms){
      const [sx,sy,ex,ey,hx,hy]=a.local,u=[ex-sx,ey-sy],f=[hx-ex,hy-ey];
      const fold=Math.abs(u[0]*f[1]-u[1]*f[0])/(Math.hypot(...u)*Math.hypot(...f));
      if(!a.local.every(Number.isFinite)||(2*sx/bw)**2+(2*sy/bh)**2>=1||Math.abs(ey)>bh*.5||
         fold<.15||!r.palms.some(p=>distance(p,a.wrist)<1e-7))bad={heading,gait,phase,reason:'shoulder/fold/wrist',arm:a.local,fold};
    }
  }
  ok(`${weapon}: raised arms have embedded shoulders, tucked elbows and exact palm contact at all headings/gaits`,!bad,bad?JSON.stringify(bad):`${poses} real poses`);
}
for(const [weapon,expected]of [['BOW',[[24,0],[14,0]]],['ROCKET_LAUNCHER',[[32,7],[8,11]]],['COACH_GUN',[[26,7],[15,11]]]]){
  prepare(weapon);const r=trace('player.show();');
  const contacts=r.arms.map(a=>a.local.slice(4));
  ok(`${weapon}: support and strong wrists meet the drawn grip/string/fore-end`,expected.every(p=>contacts.some(h=>distance(p,h)<1e-8)),JSON.stringify(contacts));
}
prepare('BOW');probe('player.ammo=0;');
ok('empty bow lets the strong hand follow the relaxed string while support stays on its grip',
   trace('player.show();').arms.some(a=>distance(a.local.slice(4),[31,0])<1e-8));

for(const weapon of ['ASSAULT_RIFLE','SHOTGUN']){
  let worst=0;
  for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const gait of [.2,.5,1])for(let n=0;n<32;n++){
    const phase=n*Math.PI/16;prepare(weapon,heading);
    const before=trace(`player.isMoving=true;player.gait=${gait};player.walkCycle=${phase-.001};player.show();`).arms;
    const after=trace(`player.walkCycle=${phase+.001};player.show();`).arms;
    for(let k=0;k<before.length;k++)for(const part of ['shoulder','elbow','wrist'])worst=Math.max(worst,distance(before[k][part],after[k][part]));
  }
  ok(`${weapon}: gait bob passes smoothly through aimed shoulders, elbows and wrists`,worst<.05,`largest phase crossing ${worst.toFixed(5)}`);
}

console.log('\n== one solid model in carry and aim ==');
for(const weapon of ['ASSAULT_RIFLE','SHOTGUN']){
  prepare(weapon);
  const aimed=trace('player.show();').guns[0];
  probe('rightStick.active=false;player.aimHold=0;');
  const carried=trace('player.show();').guns[0];
  ok(`${weapon}: carry and aim reach the same receiver, barrel, stock and sight geometry`,signature(aimed)===signature(carried));
  ok(`${weapon}: the live model paints inked solid faces instead of the old flat rectangles`,aimed.boxes.length>=10&&aimed.boxes.every(b=>b.quads.length===3));
  let bad=null,poses=0;
  for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const gait of [.2,.5,1])for(let i=0;i<8;i++){
    prepare(weapon,heading);
    const r=trace(`rightStick.active=false;player.aimHold=0;player.isMoving=true;player.gait=${gait};player.walkCycle=${i*Math.PI/4};player.show();`);
    const gun=r.guns[0];poses++;
    if(!r.balanced||r.guns.length!==1||!gun||!gun.boxes.every(b=>b.quads.length===3&&b.quads.flat(2).every(Number.isFinite)))bad={heading,gait,phase:i};
  }
  ok(`${weapon}: walk, jog and run remain finite and balanced across four headings`,!bad,bad?JSON.stringify(bad):`${poses} live poses`);
}

console.log('\n== rifle bolt and receiver recoil use native shot frames ==');
prepare('ASSAULT_RIFLE');
const rifleIdle=trace('player.show();').guns[0];
probe('player.fire(player.aimAngle);');
const rifleFrames=[],rifleTimers=[];
for(let i=0;i<=6;i++){
  rifleFrames.push(trace('player.show();').guns[0]);rifleTimers.push(P('player.weaponKick'));
  if(i<6)probe('player.updatePlayer();');
}
const rifleHandle=g=>part(g,[122,133,149]);
const rifleBarrel=g=>part(g,[48,53,62]);
const backs=rifleFrames.map(g=>rifleHandle(rifleIdle).bounds[0]-rifleHandle(g).bounds[0]);
ok('rifle kick consumes exactly one native timer tick per frame',rifleTimers.join(',')==='6,5,4,3,2,1,0',rifleTimers.join(','));
ok('charging handle retracts sharply and returns on every recovery frame',backs[0]>2.9&&close(backs.at(-1),0)&&backs.slice(1).every((v,i)=>v<backs[i]),backs.map(v=>v.toFixed(3)).join(','));
ok('rifle mechanism motion reaches the projected faces while the fixed barrel stays rigid',
   rifleFrames.every(g=>distance(rifleBarrel(g).bounds,rifleBarrel(rifleIdle).bounds)<1e-8)&&
   distance(centre(rifleHandle(rifleFrames[0])),centre(rifleHandle(rifleIdle)))>2);
ok('receiver/wrist pitch recoil settles back into the idle pose',distance(rifleFrames[0].rear,rifleIdle.rear)>1&&distance(rifleFrames.at(-1).rear,rifleIdle.rear)<1e-8);

console.log('\n== shotgun fore-end and support hand pump after the flash ==');
prepare('SHOTGUN');
const shotgunIdle=trace('player.show();').guns[0];
probe('player.fire(player.aimAngle);');
const shotgunFrames=[],shotgunTimers=[];
for(let i=0;i<=20;i++){
  shotgunFrames.push(trace('player.show();').guns[0]);shotgunTimers.push(P('player.fireTimer'));
  if(i<20)probe('player.updatePlayer();');
}
const pumpPart=g=>part(g,[23,26,31],b=>b.bounds[1]-b.bounds[0]>8);
const pumpTravel=shotgunFrames.map(g=>pumpPart(shotgunFrames[0]).bounds[0]-pumpPart(g).bounds[0]);
ok('shotgun consumes its unchanged twenty-frame fire cooldown',shotgunTimers.every((t,i)=>t===20-i));
ok('pump waits through the flash, draws back after kick recovery, and returns before the next shot',
   pumpTravel.slice(0,5).every(v=>v===0)&&pumpTravel[10]>5.9&&pumpTravel.slice(18).every(v=>close(v,0)),pumpTravel.map(v=>v.toFixed(2)).join(','));
ok('pump has a smooth, visible six-unit round trip',pumpTravel.slice(5,11).every((v,i)=>v>pumpTravel[i+4])&&pumpTravel.slice(11,19).every((v,i)=>v<pumpTravel[i+10]));
ok('support grip moves back with the pump and forward into the same handguard',
   distance(shotgunFrames[10].fore,shotgunIdle.fore)>5&&distance(shotgunFrames[20].fore,shotgunIdle.fore)<1e-8);
ok('barrel/muzzle stay registered during all twenty native pump frames',shotgunFrames.every(g=>distance(g.muzzle,[5047,5006])<1e-8));

// An enemy cooldown is longer; the mechanical action still completes in the
// same amount of time. Use a native enemy shot and update, not a fake timer.
probe(`window.longGunEnemy=new Character(7000,7000,false,"NORMAL");
       longGunEnemy.currentWeapon=WEAPONS.SHOTGUN;longGunEnemy.ammo=8;
       longGunEnemy.forceNudge=function(){};longGunEnemy.checkCol=function(){return false;};
       longGunEnemy.fire(0);`);
const enemyPumps=[];
for(let i=0;i<=20;i++){
  enemyPumps.push(P('longGunPump(longGunEnemy)'));
  if(i<20)probe('longGunEnemy.updateEnemy();');
}
ok('native enemy shotgun gets the same mechanical pump cycle with its sixty-frame cadence',enemyPumps.every((v,i)=>close(v,shotgunFrames[i].pump)),enemyPumps.map(v=>v.toFixed(2)).join(','));

console.log('\n== drawing cannot advance combat state ==');
prepare('SHOTGUN');
probe('player.fire(player.aimAngle);for(let i=0;i<8;i++)player.updatePlayer();');
const before=P('({ammo:player.ammo,fire:player.fireTimer,kick:player.weaponKick,reload:player.reloadTimer})');
const first=trace('player.show();'),second=trace('player.show();');
const after=P('({ammo:player.ammo,fire:player.fireTimer,kick:player.weaponKick,reload:player.reloadTimer})');
ok('painting twice preserves timers/ammo and the same mechanical pose',JSON.stringify(before)===JSON.stringify(after)&&signature(first.guns[0])===signature(second.guns[0])&&first.balanced&&second.balanced);
probe('player.reloadTimer=60;');
ok('reload suppresses firing recoil and an unfinished pump',P('aimedLongGunPose(player,0).kick')===0&&P('longGunPump(player)')===0);

console.log(`\n${checks-fails}/${checks} checks passed`);
process.exit(fails?1:0);

// Aim input during a punch bypasses the normal boxing guard. That fallback
// still needs connected cel sleeves and the original fist/attack positions.
// PUNCH_BASELINE=/path/to/game.js optionally compares actual rendered fists.
const {ctx,probe}=require('./harness');
const {spawnSync}=require('child_process');
const P=s=>probe('('+s+')');
const setup=`isStoryMode=false;townsData={};startAtLevel(2);started=true;doTick=false;
  viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;
  swordPickedUp=false;setMeleeTool('NONE');chemistSuitUnlocked=false;
  ninjaSuitUnlocked=false;explosiveArmorUnlocked=false;jetpackUnlocked=false;
  rightStick={active:true,dx:1,dy:0,dist:.5};leftStick={active:false,dx:0,dy:0};
  player.x=0;player.y=0;player.hp=100;player.dead=false;player.hitFlash=0;
  player.stunTimer=0;player.skeletonTimer=0;player.reloadTimer=0;
  player.throwAnimTimer=0;player.cannonCharge=0;player.cannonFireDelay=0;
  player.dashTimer=0;player.muzzleFlash=0;player.currentWeapon=WEAPONS.PISTOL;
  player.boxingHold=180;player.isArmed=false;frameCount=100;`;
ctx.console={...console,log(){},warn(){}};probe(setup);
function trace(){
  const keys=['push','pop','translate','rotate','scale','fill','noFill','ellipse','figureCelLimb','drawComboPunchArms'];
  const real={};for(const key of keys)real[key]=ctx[key];
  let m=[1,0,0,1,0,0],filled=true,fillColor=[],active=false,underflow=false;
  const stack=[],palms=[],limbs=[];
  ctx.push=()=>{stack.push({m:m.slice(),filled,fillColor});return real.push();};
  ctx.pop=()=>{const s=stack.pop();if(s){m=s.m;filled=s.filled;fillColor=s.fillColor;}else underflow=true;return real.pop();};
  ctx.translate=(x,y)=>{m[4]+=m[0]*x+m[2]*y;m[5]+=m[1]*x+m[3]*y;return real.translate(x,y);};
  ctx.rotate=a=>{const c=Math.cos(a),s=Math.sin(a),[x,y,u,v]=m;
    m[0]=x*c+u*s;m[1]=y*c+v*s;m[2]=u*c-x*s;m[3]=v*c-y*s;return real.rotate(a);};
  ctx.scale=(x,y=x)=>{m[0]*=x;m[1]*=x;m[2]*=y;m[3]*=y;return real.scale(x,y);};
  ctx.fill=(...a)=>{filled=true;fillColor=a[0]&&a[0].levels?Array.from(a[0].levels):a;return real.fill(...a);};
  ctx.noFill=()=>{filled=false;return real.noFill();};
  ctx.ellipse=(x,y,w,h)=>{
    // A collapsed sleeve can also be an eight-unit circle. The skin material
    // identifies the fist, instead of counting its clothing as another hand.
    if(filled&&w===8&&h===8&&fillColor[0]===235&&fillColor[1]===180&&fillColor[2]===140)
      palms.push([m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);
    return real.ellipse(x,y,w,h);
  };
  if(real.drawComboPunchArms)ctx.drawComboPunchArms=(...a)=>{
    active=true;try{return real.drawComboPunchArms(...a);}finally{active=false;}
  };
  ctx.figureCelLimb=(...a)=>{if(active)limbs.push(a.slice(1,10));return real.figureCelLimb(...a);};
  try{probe('player.show();');}finally{Object.assign(ctx,real);}
  return {palms,limbs,balanced:!underflow&&stack.length===0};
}
const records=[];let surfaces=true,balance=true,finite=true,clocks=true,guard=true;
for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const gait of [.2,.5,1])
for(const phase of [1,2,3,4])for(const timer of [20,17,13,10,7,3,1]){
  probe(`player.isArmed=false;player.isMoving=true;player.gait=${gait};player.walkCycle=.9;
    player.aimAngle=${heading};player.moveAngle=${heading};player.meleePhase=${phase};
    player.meleeTimer=${timer};`);
  guard=guard&&P('!boxerPose(player).active');
  const before=P('[player.meleeTimer,player.meleeCooldown,player.meleeComboTimer,player.walkCycle,player.x,player.y]');
  const t=trace();surfaces=surfaces&&t.limbs.length===2;
  balance=balance&&t.balanced;
  finite=finite&&t.palms.length===2&&[...t.palms.flat(),...t.limbs.flat()].every(Number.isFinite);
  clocks=clocks&&JSON.stringify(before)===JSON.stringify(P('[player.meleeTimer,player.meleeCooldown,player.meleeComboTimer,player.walkCycle,player.x,player.y]'));
  records.push({heading,gait,phase,timer,palms:t.palms});
}
if(process.argv.includes('--fist-trace')){process.stdout.write(JSON.stringify(records));process.exit(0);}
let checks=0,fails=0;
function ok(label,pass){checks++;if(!pass)fails++;console.log((pass?'ok ':'FAIL ')+label);}
ok('held aim input exercises the fallback rather than the boxing guard',guard);
ok('every fallback punch draws two continuous cel sleeves',surfaces);
ok('all four combos keep two finite fists across headings and gaits',finite);
ok('all fallback punch painters balance their transforms',balance);
ok('repainting never advances punch clocks or locomotion',clocks);
if(process.env.PUNCH_BASELINE){
  const r=spawnSync(process.execPath,[__filename,'--fist-trace'],{
    env:{...process.env,GAME_JS:process.env.PUNCH_BASELINE},encoding:'utf8',maxBuffer:4*1024*1024});
  if(r.status!==0)throw Error(r.stderr);
  const baseline=JSON.parse(r.stdout);
  ok('actual fists retain their previous positions throughout every combo',
    baseline.length===records.length&&baseline.every((a,i)=>a.palms.length===2&&
      a.palms.every((p,j)=>Math.hypot(p[0]-records[i].palms[j][0],p[1]-records[i].palms[j][1])<1e-8)));
}
console.log(`${checks-fails}/${checks} punch surface checks passed (${records.length} poses)`);
process.exitCode=fails?1:0;

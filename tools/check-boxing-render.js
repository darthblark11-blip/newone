// Native figure paint must use the combat solver's resolved joints: extra bob,
// aim twists or visual fist offsets turn a precise slip/guard into a false hit.
const {ctx,probe}=require('./harness');
let checks=0,fails=0;
const P=s=>probe('('+s+')');
function ok(name,value){checks++;if(!value)fails++;console.log((value?'  ok   ':'  FAIL ')+name);}
const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-7;
function trace(draw){
  const undo={},ellipses=[],heads=[],limbs=[],stack=[];
  let m=[1,0,0,1,0,0],underflow=0;
  const point=(x,y)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
  const mul=u=>{const t=m;m=[t[0]*u[0]+t[2]*u[1],t[1]*u[0]+t[3]*u[1],t[0]*u[2]+t[2]*u[3],t[1]*u[2]+t[3]*u[3],t[0]*u[4]+t[2]*u[5]+t[4],t[1]*u[4]+t[3]*u[5]+t[5]];};
  for(const k of ['push','pop','translate','rotate','scale','figureCelOval','figureCelLimb','drawFigureHead'])undo[k]=ctx[k];
  ctx.push=()=>{stack.push(m.slice());};
  ctx.pop=()=>{if(!stack.length)underflow++;else m=stack.pop();};
  ctx.translate=(x,y)=>mul([1,0,0,1,x,y]);
  ctx.rotate=a=>mul([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);
  ctx.scale=(x,y=x)=>mul([x,0,0,y,0,0]);
  ctx.figureCelOval=(g,x,y,w,h,c,...rest)=>{ellipses.push({p:point(x,y),w,h,scale:Math.hypot(m[0],m[1]),color:c&&c.levels?Array.from(c.levels):c});return undo.figureCelOval(g,x,y,w,h,c,...rest);};
  ctx.figureCelLimb=(g,sx,sy,ex,ey,hx,hy,...rest)=>{limbs.push({s:point(sx,sy),e:point(ex,ey),h:point(hx,hy)});return undo.figureCelLimb(g,sx,sy,ex,ey,hx,hy,...rest);};
  ctx.drawFigureHead=(g,id,x,y,...rest)=>{heads.push(point(x,y));return undo.drawFigureHead(g,id,x,y,...rest);};
  try{probe(draw);}finally{Object.assign(ctx,undo);}
  return {ellipses,heads,limbs,depth:stack.length,underflow};
}
probe(`isStoryMode=false;townsData={};startAtLevel(3);started=true;doTick=false;
viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;frameCount=100;
leftStick={active:false,dx:0,dy:0};rightStick={active:true,dx:.7,dy:-.7,dist:1};
swordPickedUp=false;setMeleeTool('NONE');jetpackUnlocked=false;explosiveArmorUnlocked=false;
chemistSuitUnlocked=false;ninjaSuitUnlocked=false;cowboySuitEquipped=false;
player.x=1300;player.y=-1140;player.isArmed=false;player.stunTimer=0;
player.skeletonTimer=0;player.hitFlash=0;player.muzzleFlash=0;player.decals=[];
player.isMoving=true;player.gait=.5;player.walkCycle=1.1;player.aimAngle=.63;
boxingEnter(player,[],'WORLD');`);
const cases=[['ready',''],['forward guard',"boxingSetGuard(player,0,-1);"],['body guard',"boxingSetGuard(player,0,1);"],
  ['left head hook guard',"boxingSetGuard(player,-1,-1);"],['right head hook guard',"boxingSetGuard(player,1,-1);"],
  ['left body hook guard',"boxingSetGuard(player,-1,1);"],['right body hook guard',"boxingSetGuard(player,1,1);"],
  ['left body side guard',"boxingSetGuard(player,-1,0);"],['right body side guard',"boxingSetGuard(player,1,0);"],
  ['left slip',"boxingRequestDodge(player,-1);player._boxing.dodge.elapsedMs=150;"],
  ['right slip',"boxingRequestDodge(player,1);player._boxing.dodge.elapsedMs=150;"],
  ['parry stun',"player._boxing.stunMs=540;"],['parry flash',"boxingSetGuard(player,0,-1);player._boxing.parryFlashMs=100;"]];
cases.push(['canyon floor guard',"player.x=frontierCanyonProfile('Y',-7200,0).center;player.y=-7200;boxingSetGuard(player,0,-1);"]);
cases.push(['canyon floor slip',"player.x=frontierCanyonProfile('Y',-7200,0).center;player.y=-7200;boxingRequestDodge(player,1);player._boxing.dodge.elapsedMs=150;"]);
for(const kind of ['LEFT_STRAIGHT','RIGHT_JAB','LEFT_HOOK','RIGHT_HOOK'])for(const phase of ['windup','contact','recovery']){
  cases.push([kind+' '+phase,`boxingRequestPunch(player,'${kind}');player._boxing.punch.elapsedMs=player._boxing.punch.windupMs${phase==='windup'?'*.8':phase==='contact'?'+player._boxing.punch.activeMs*.55':'+player._boxing.punch.activeMs+player._boxing.punch.recoveryMs*.3'};`]);
}
for(const kind of ['LEFT_STRAIGHT','RIGHT_JAB','LEFT_HOOK','RIGHT_HOOK']){
  for(const amount of [.5,1])cases.push([kind+' body hold '+amount,`player._boxing.preparedPunch={kind:'${kind}',level:'BODY',amount:${amount}};`]);
  for(const phase of ['windup','contact','recovery'])cases.push([kind+' body '+phase,
    `boxingRequestPunch(player,'${kind}','BODY',{preparedAmount:1});player._boxing.punch.elapsedMs=player._boxing.punch.windupMs${phase==='windup'?'*.8':phase==='contact'?'+player._boxing.punch.activeMs*.55':'+player._boxing.punch.activeMs+player._boxing.punch.recoveryMs*.3'};`]);
  for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2])cases.push([kind+' body facing '+angle,
    `player.aimAngle=${angle};player._boxing.preparedPunch={kind:'${kind}',level:'BODY',amount:1};`]);
}
let allHead=true,allFists=true,allBodies=true,allForearms=true,balanced=true,finite=true,guardWithStick=true;
for(const [label,setup] of cases){
  probe(`player.x=1300;player.y=-1140;player.aimAngle=.63;boxingExit(player);boxingEnter(player,[],'WORLD');player.isArmed=false;${setup}`);
  const pose=P('boxingPose(player)'),head=P('boxingWorldPoint(player,boxingPose(player).head)'),body=P('boxingWorldPoint(player,boxingPose(player).body)');
  const fists=P('boxingPose(player).arms.map(a=>boxingWorldPoint(player,a.fist))');
  const r=trace('player.show();'),hands=r.ellipses.filter(q=>Math.abs(q.w-P('BOXING.FIST_RADIUS*2'))<1e-7&&q.w===q.h);
  const torso=r.ellipses.find(q=>q.w===pose.body.rx*2&&q.h===pose.body.ry*2);
  allHead=allHead&&r.heads.length===1&&near(r.heads[0],head);
  allFists=allFists&&hands.length===2&&fists.every(f=>hands.some(h=>near(f,h.p)));
  allBodies=allBodies&&!!torso&&near(torso.p,body);
  allForearms=allForearms&&fists.every(f=>r.limbs.some(l=>near(l.h,f)));
  balanced=balanced&&r.depth===0&&r.underflow===0;
  finite=finite&&r.ellipses.every(q=>[q.p.x,q.p.y,q.w,q.h,q.scale].every(Number.isFinite));
  guardWithStick=guardWithStick&&!P('player.isArmed')&&P('boxingActive(player)');
  if(!allHead||!allFists||!allBodies||!allForearms||!balanced||!finite)console.log('  pose detail '+label,JSON.stringify({head,rHead:r.heads,hands,torso}));
}
ok('all '+cases.length+' native poses paint the exact solver head center',allHead);
ok('both fists use the exact solver contact center and radius throughout punches/guards/slips',allFists);
ok('the rotated torso ellipse uses the exact body hurt-box center and dimensions',allBodies);
ok('bare forearm endpoints reach the same actual fists',allForearms);
ok('canonical poses preserve finite geometry and balanced native canvas transforms',finite&&balanced);
ok('active right stick keeps boxing visible and never draws the gun',guardWithStick);
probe(`player.isMoving=false;boxingExit(player);boxingEnter(player,[],'WORLD');window.__boxingFeetBefore=boxingFeet(player,boxingPose(player));boxingRequestDodge(player,-1);player._boxing.dodge.elapsedMs=150;`);
ok('stationary upper-body dodge keeps both boot contact points planted',JSON.stringify(P('__boxingFeetBefore'))===JSON.stringify(P('boxingFeet(player,boxingPose(player))')));
ok('right boot leads the left rear power foot in southpaw stance',P('boxingPose(player).feet[1].x>boxingPose(player).feet[0].x&&boxingPose(player).feet[1].y>0&&boxingPose(player).feet[0].y<0'));
probe(`boxingExit(player);boxingEnter(player,[],'SALOON');chemistSuitUnlocked=true;`);
const chemist=trace('push();translate(player.x,player.y);paintBoxingFigure(player);pop();');
ok('chemist keeps exactly one silver left cannon fist in boxing',chemist.ellipses.filter(q=>q.w===P('BOXING.FIST_RADIUS*2')&&Array.isArray(q.color)&&q.color[0]===180&&q.color[1]===180&&q.color[2]===190).length===1);
probe(`chemistSuitUnlocked=false;boxingExit(player);`);
ok('inactive stance delegates to the existing native character art',P('paintBoxingFigure(player)===false'));
console.log('\n'+checks+' boxing render checks, '+fails+' failures');process.exitCode=fails?1:0;

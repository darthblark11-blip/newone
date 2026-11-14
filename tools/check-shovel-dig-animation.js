// Exercise the real dig clock, shared tool projection and live character painter.
const assert=require('assert');
const {ctx,probe}=require('./harness');
let checks=0;
const check=(code,label)=>{assert.ok(probe(code),label);checks++;};
probe(`isStoryMode=false;startAtLevel(1);currentLevel=currentBiome=1;started=doTick=true;
 isPaused=isDead=isWin=false;window.shovelOwned=true;setMeleeTool('SHOVEL');
 player.x=player.y=10000;player.hp=100;player.isArmed=false;player.meleeTimer=0;
 player.shovelLevel=1;player.shovelDepth=player.shovelDepthTarget=0;
 player.reloadTimer=player.dashTimer=player.throwAnimTimer=player.cannonCharge=player.cannonFireDelay=0;
 player.mounted=false;chemistSuitUnlocked=ninjaSuitUnlocked=false;
 buildings=activeBuildings=[];enemiesList=[];invalidateColIndex();
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
 leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};
 shovelDigParticles=[];`);
check(`shovelDigPose(player,gaitPose(0),0)===null`,'Idle character does not adopt the dig stance');
probe(`shovelExcavation={};player.shovelCooldownMs=0;player.shovelDigTimer=0;
 var nativeDigStarted=shovelDig('DOWN');`);
check(`nativeDigStarted&&player.shovelDigTimer===SHOVEL_DIG_ANIM.durationMs&&
 player.shovelDepthTarget===SHOVEL.waist&&!shovelDigParticles.length`,
 'The native successful excavation starts a complete two-handed stroke without early debris');
probe(`shovelUpdatePlayer(player,170);`);
check(`player.shovelDigTimer===270&&!shovelDigParticles.length&&shovelPlayerDepth()===0`,
 'Native terrain simulation preserves windup until blade contact');
probe(`var digPlantX=player.x,digPlantY=player.y;player.attemptMove(5,2);`);
check(`player.x===digPlantX&&player.y===digPlantY`, 'The braced stroke cannot walk off its shaft during windup');
probe(`player.activateMelee(true);`);
check(`player.meleeTimer===0&&player.shovelDigTimer===270`, 'A swing input cannot hide an already active two-handed digging stroke');
probe(`shovelUpdatePlayer(player,30);`);
check(`shovelDigParticles.length===18&&player.shovelDigContactDone&&shovelPlayerDepth()>0&&shovelPlayerDepth()<18`,
 'Native player simulation emits debris exactly when the visible blade lands');
probe(`shovelDigParticles=[];player.shovelDepth=player.shovelDepthTarget=0;
 player.shovelCooldownMs=player.shovelDigTimer=0;shovelExcavation={};
 buildings=activeBuildings=[{x:10032,y:10032,w:50,h:50,isBlockBuilding:true}];
 var rejectedDig=shovelDig('DOWN');`);
check(`!rejectedDig&&!player.shovelDigTimer&&!shovelDigParticles.length`,
 'Rejected foundations cannot start an animation or emit successful-contact debris');
probe(`buildings=activeBuildings=[];invalidateColIndex();shovelBeginDigAnimation(player,'DOWN');`);
check(`player.shovelDigTimer===SHOVEL_DIG_ANIM.durationMs&&!player.shovelDigContactDone`,
 'A successful stroke starts its own contact clock');
const rig=probe('figureRig(player.bodyW,player.bodyH)');
let poses=0;
for(const [bodyW,bodyH] of [[21,27],[16,25]])for(const kind of ['DOWN','FORWARD'])for(const heading of [0,.7,Math.PI/2,Math.PI,Math.PI*1.5]) {
 for(const gait of [0,.2,.5,1])for(const phase of [.05,.14,.28,.43,.55,.7,.82,.95]) {
  const pose=probe(`player.bodyW=${bodyW};player.bodyH=${bodyH};player.shovelDigKind='${kind}';player.aimAngle=${heading};player.gait=${gait};
   player.isMoving=${gait>0};shovelDigPose(player,gaitPose(${gait}),0,${phase});`);
  const poseRig=probe('figureRig(player.bodyW,player.bodyH)');
  for(const arm of [pose.right,pose.left]) {
   assert.ok(Object.values(arm).every(Number.isFinite),'Projected shoulders, elbows and palms stay finite');
   assert.ok(Math.hypot(arm.ex-arm.sx,arm.ey-arm.sy)<=poseRig.upper+1e-6,'Upper arm stays inside shared rig length');
   assert.ok(Math.hypot(arm.hx-arm.ex,arm.hy-arm.ey)<=poseRig.fore+1e-6,'Forearm stays inside shared rig length');
  }
  if(pose.blend>.999) {
   // Reconstruct each grip from the actual steel/wood projection; this catches
   // hands independently clamped away from the rigid two-handed tool.
   for(const [station,hand] of [[13,pose.right],[-9,pose.left]]) {
    const expected=probe(`(function(){const p=shovelDigPose(player,gaitPose(${gait}),0,${phase});
      const q=p.projection.point(${station},0,0),co=Math.cos(p.angle),si=Math.sin(p.angle);
      return [p.ox+p.toolScale*(q[0]*co-q[1]*si),p.oy+p.toolScale*(q[0]*si+q[1]*co)];})()`);
    assert.ok(Math.hypot(expected[0]-hand.hx,expected[1]-hand.hy)<.005,'Both fists stay attached to their own shaft stations');
   }
  }
  poses++;
 }
}
checks+=5;
probe(`player.bodyW=21;player.bodyH=27;player.aimAngle=0;player.isMoving=false;player.shovelDigKind='DOWN';
 var digDownContact=shovelDigPose(player,gaitPose(0),0,SHOVEL_DIG_ANIM.contact);
 player.shovelDigKind='FORWARD';var digForwardContact=shovelDigPose(player,gaitPose(0),0,SHOVEL_DIG_ANIM.contact);`);
check(`digDownContact.elevation<-1.3&&digForwardContact.elevation>-.3&&digForwardContact.elevation<0`,
 'Down digs plunge steeply while forward digs point just below the horizon');
check(`Math.abs(digDownContact.hip)>.2&&digDownContact.lean>4&&digDownContact.toolScale<.8`,
 'Planted bladed hips and forward weight transfer drive the contact');

// At forward contact the rear grip must clear the head silhouette, rather
// than merely existing geometrically underneath the head's last paint pass.
for(const [bodyW,bodyH] of [[21,27],[16,25]])for(const heading of [0,.7,Math.PI/2,Math.PI,Math.PI*1.5]) {
 probe(`player.bodyW=${bodyW};player.bodyH=${bodyH};player.shovelDigKind='FORWARD';player.aimAngle=${heading};
  var clearForwardGrip=shovelDigPose(player,gaitPose(0),0,SHOVEL_DIG_ANIM.contact);`);
 check(`Math.hypot(clearForwardGrip.left.hx,clearForwardGrip.left.hy)>5.5+figureRig(player.bodyW,player.bodyH).hand*.25`,
  'The rear left fist remains visibly outside the head during forward contact at heading '+heading);
}

probe('player.bodyW=21;player.bodyH=27;');

// Trace the live show painter, including its layered shaft/palm/blade ordering.
const saved={};let events=[],balance=0,finite=true;
for(const name of ['push','pop','quad','triangle','vertex','drawShovelGrip','drawShovelHeadSolid','figureCelOval'])saved[name]=ctx[name];
ctx.push=()=>{balance++;return saved.push();};ctx.pop=()=>{balance--;return saved.pop();};
for(const name of ['quad','triangle','vertex'])ctx[name]=(...a)=>{finite=finite&&a.every(Number.isFinite);return saved[name](...a);};
ctx.drawShovelGrip=(...a)=>{events.push('shaft');return saved.drawShovelGrip(...a);};
ctx.drawShovelHeadSolid=(...a)=>{events.push('blade');return saved.drawShovelHeadSolid(...a);};
ctx.figureCelOval=(g,x,y,w,h,...a)=>{if(Math.abs(w-rig.hand)<1e-8&&Math.abs(h-rig.hand)<1e-8)events.push('palm');return saved.figureCelOval(g,x,y,w,h,...a);};
try {
 for(const kind of ['DOWN','FORWARD'])for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const phase of [.14,.43,.67,.9]) {
  events=[];balance=0;
  probe(`player.shovelDigKind='${kind}';player.shovelDigTimer=SHOVEL_DIG_ANIM.durationMs*(1-${phase});
    player.aimAngle=player.moveAngle=${heading};player.isMoving=false;player.meleeTimer=0;player.show();`);
  assert.equal(events.filter(e=>e==='shaft').length,1,'Exactly one shaft is drawn');
  assert.equal(events.filter(e=>e==='blade').length,1,'Exactly one solid spade is drawn');
  const a=events.indexOf('shaft'),b=events.indexOf('blade');
  assert.equal(events.slice(a+1,b).filter(e=>e==='palm').length,2,'Both palms cover the same shaft before its blade');
  assert.equal(balance,0,'Every native dig painter restores its transforms');
 }
 assert.ok(finite,'All live shovel facets project to finite coordinates');checks+=5;
} finally {Object.assign(ctx,saved);}

probe(`player.shovelDepth=player.shovelDepthTarget=0;shovelDigParticles=[];
 shovelBeginDigAnimation(player,'DOWN');shovelUpdateDigAnimation(player,180);`);
check(`!shovelDigParticles.length&&!player.shovelDigContactDone`,'Windup produces no premature dirt impact');
probe(`shovelUpdateDigAnimation(player,20);`);
check(`shovelDigParticles.length===18&&player.shovelDigContactDone&&
 shovelDigParticles.filter(p=>p.clod).length===8&&shovelDigParticles.every(p=>p.owner===player)`,
 'Crossing actual blade contact emits a single burst of clods and dust');
probe(`shovelUpdateDigAnimation(player,30);shovelUpdateDigAnimation(player,30);`);
check(`shovelDigParticles.length===18`,'Repeated simulation ticks cannot duplicate a stroke impact');
probe(`shovelUpdateDigAnimation(player,1000);`);
check(`!shovelDigParticles.length&&!player.shovelDigTimer`,'Offscreen expiry releases all particles and the completed stroke');
probe(`shovelBeginDigAnimation(player,'FORWARD');shovelUpdateDigAnimation(player,440);`);
check(`player.shovelDigContactDone&&shovelDigParticles.length===18`,
 'A long frame crossing the whole stroke still resolves contact once');
probe(`shovelDigParticles=[];shovelBeginDigAnimation(player,'UP');shovelUpdateDigAnimation(player,220);`);
check(`!shovelDigParticles.length&&shovelDigPose(player,gaitPose(0),0)===null`,
 'Climbing does not shovel soil or adopt the excavation stance');
probe(`for(let i=0;i<30;i++){shovelBeginDigAnimation(player,'FORWARD');shovelUpdateDigAnimation(player,200);}`);
check(`shovelDigParticles.length>0&&shovelDigParticles.length<=SHOVEL_DIG_ANIM.maxParticles`,
 'Held digging is bounded independently of frame rate and depth');
probe(`shovelDigParticles=[];player.shovelDepth=1800;player.shovelDepthTarget=1800;
 shovelBeginDigAnimation(player,'DOWN');shovelUpdateDigAnimation(player,200);`);
check(`shovelDigParticles.every(p=>p.depth===1800&&p.size<.3&&p.scale===SHOVEL.minScale)`,
 'Pin-sized underground actors also emit proportionally small dirt');
probe(`var digParticleState=JSON.stringify(shovelDigParticles.map(p=>[p.x,p.y,p.ageMs,p.z]));
 shovelDrawDigParticles(0);shovelDrawDigParticles(1800,player);shovelDrawDigParticles(1800,player);`);
check(`digParticleState===JSON.stringify(shovelDigParticles.map(p=>[p.x,p.y,p.ageMs,p.z]))`,
 'Rendering underground cutaways never advances simulation');
console.log(`Shovel dig animation: ${checks} native clock, two-handed rig, stance and bounded FX checks passed (${poses} fitted poses).`);

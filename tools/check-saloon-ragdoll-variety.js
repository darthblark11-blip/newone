// Peacemaker's poses differ in timing, trajectory and articulated rest, while
// the world and lethal fall rigs remain independent of its profile sequence.
const assert=require('assert');
const {ctx,probe}=require('./harness');
let checks=0;
const check=(code,label)=>{assert.ok(probe(code),label);checks++;};
probe(`isStoryMode=false;startAtLevel(3);started=true;
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];enemiesList=[];invalidateColIndex();
 function variedActor(isPlayer=false){const a=new Character(0,0,isPlayer,isPlayer?'NORMAL':'BANDIT');a.aimAngle=PI;
  a.hp=100;a.motionX=a.motionY=0;a.motionFrame=frameCount;a.isMoving=false;a.stunTimer=99999;return a;}
 function variedFree(a,x,y){a.x=x;a.y=y;}
 var variedContacts=[];function variedContact(event){variedContacts.push(event);}
 var variedResponses=[];`);
for(const [kind,level,expected] of [
 ['LEFT_STRAIGHT','HEAD',['BACK_REEL','SIDE_SPILL','KNEE_FOLD']],
 ['RIGHT_HOOK','HEAD',['HOOK_TWIST','SIDE_SPILL','BACK_REEL']],
 ['RIGHT_JAB','BODY',['KNEE_FOLD','FORWARD_FOLD','SIDE_SPILL']]
]){
 probe('saloonKnockoutSequence=0;var variedNames=[];var variedRest=[];');
 for(let i=0;i<3;i++)probe(`{
  const a=variedActor();startSaloonKnockoutPhysics(a,0,{kind:${JSON.stringify(kind)},level:${JSON.stringify(level)},damage:27});
  const trace=[];for(let step=0;step<130;step++){stepSaloonKnockoutPhysics(a,1000/120,variedFree,variedContact);
   if([12,30,55,90,129].includes(step))trace.push([a.x,a.y,stunFall(a),a.stunPose.rag.ang,a.stunPose.knockout.height]);}
  variedNames.push(a.stunPose.knockout.variant);variedRest.push(JSON.stringify([a.x,a.y,a.stunPose.rag.limbs.map(L=>[L.a,L.b])]));
  variedResponses.push({actor:a,kind:${JSON.stringify(kind)},level:${JSON.stringify(level)},trace});
 }`);
 assert.deepEqual(Array.from(probe('variedNames')),expected,'Identical '+kind+' '+level+' impacts rotate eligible responses');checks++;
 check('new Set(variedRest).size===3','Repeated identical impacts produce three different physical rest poses');
}
check('new Set(variedResponses.map(r=>r.actor.stunPose.knockout.variant)).size===5','Both punch levels expose five distinct physical profiles');
check('variedResponses.every(r=>r.actor.stunPose.knockout.settled&&r.actor.stunPose.done&&r.actor.stunPose.rag.done)','Every variation finishes in a finite settled pose');
check('variedResponses.every(r=>Math.hypot(r.actor.x,r.actor.y)<60)','Responses stay close to the hit instead of launching across the room');
check('variedResponses.filter(r=>r.level==="BODY").every(r=>Math.max(...r.trace.map(t=>t[4]))<4)','Body blows keep the collapse near the floor');
check('variedResponses.every(r=>r.actor.stunPose.rag.limbs.every(L=>L.va===0&&L.vb===0))','Resting limbs stop instead of vibrating indefinitely');
check('variedResponses.every(r=>r.actor.hp===100&&!r.actor.dead&&!r.actor.knockedOut)','The pose solver alone cannot change health or manufacture a knockout result');
check('variedContacts.every(e=>e.context==="SALOON"&&Number.isFinite(e.impulse)&&e.impulse>0)','Contact impulses remain finite and activity-local');
for(const variant of ['BACK_REEL','SIDE_SPILL','KNEE_FOLD','HOOK_TWIST','FORWARD_FOLD']){
 const code=`variedResponses.find(r=>r.actor.stunPose.knockout.variant===${JSON.stringify(variant)})`;
 check(`${code}.trace.every(t=>t.every(Number.isFinite))`,variant+' has finite motion and projection');
 check(`${code}.trace[0][2]<${code}.trace[2][2]`,variant+' visibly lowers over time rather than snapping to the ground');
}
// Same complete initial event, including its local variation serial, must
// agree across frame partitions and on player/enemy models.
for(const isPlayer of [false,true]){
 probe(`saloonKnockoutSequence=0;var variedFine=variedActor(${isPlayer});startSaloonKnockoutPhysics(variedFine,.4,{kind:'RIGHT_HOOK'});
  saloonKnockoutSequence=0;var variedCoarse=variedActor(${isPlayer});startSaloonKnockoutPhysics(variedCoarse,.4,{kind:'RIGHT_HOOK'});
  for(let i=0;i<60;i++)stepSaloonKnockoutPhysics(variedFine,1000/60,variedFree);
  for(let i=0;i<10;i++)stepSaloonKnockoutPhysics(variedCoarse,100,variedFree);`);
 check('Math.hypot(variedFine.x-variedCoarse.x,variedFine.y-variedCoarse.y)<1e-8&&Math.abs(variedFine.stunPose.rag.ang-variedCoarse.stunPose.rag.ang)<1e-8&&variedFine.stunPose.rag.limbs.every((L,i)=>Math.abs(L.a-variedCoarse.stunPose.rag.limbs[i].a)<1e-8)',(isPlayer?'Player':'Opponent')+' fall agrees at60Hz and coarse100ms updates');
}
probe(`var variedBounded=true;for(let index=0;index<30;index++){
 const a=variedActor(index%2===0);a.bodyW=index%3===0?25:21;
 startSaloonKnockoutPhysics(a,index*.35,{kind:index%2?'RIGHT_HOOK':'LEFT_STRAIGHT',level:index%3?'HEAD':'BODY',force:index%2?9:3});
 for(let i=0;i<135;i++){
  stepSaloonKnockoutPhysics(a,1000/120,variedFree);const p=a.stunPose,k=p.knockout,r=p.rag,C=SALOON_KNOCKOUT_PHYSICS;
  variedBounded=variedBounded&&[a.x,a.y,p.age,k.height,k.vx,k.vy,k.roll,r.ang].every(Number.isFinite)&&
   k.height>=0&&k.height<=C.MAX_HEIGHT&&Math.abs(k.roll)<=C.ROLL_LIMIT&&Math.abs(r.ang)<=C.TURN_LIMIT&&k.contacts<=C.MAX_CONTACTS&&
   r.limbs.every(L=>L.a>=L.lo&&L.a<=L.hi&&L.b>=0&&L.b<=L.bMax&&ragKnee(L)>=0);
 }variedBounded=variedBounded&&a.stunPose.knockout.settled;
}`);
check('variedBounded','Thirty player/enemy impacts across headings, masses and forces obey every anatomical and height bound');
probe(`var variedWall=variedActor();saloonKnockoutSequence=0;startSaloonKnockoutPhysics(variedWall,.6,{kind:'RIGHT_HOOK'});
 function variedWallMove(a,x,y){a.x=Math.min(9,x);a.y=y;}
 for(let i=0;i<130;i++)stepSaloonKnockoutPhysics(variedWall,1000/120,variedWallMove);`);
check('variedWall.x<=9&&variedWall.y>5&&variedWall.stunPose.knockout.settled','Wall contact blocks penetration and permits a slide along the wall');
probe(`var variedFrozen=JSON.stringify(variedResponses[0].actor);for(let i=0;i<200;i++)stepSaloonKnockoutPhysics(variedResponses[0].actor,1000,variedFree);`);
check('JSON.stringify(variedResponses[0].actor)===variedFrozen','Settled physics remains frozen through later updates');
probe(`var variedWorld=variedActor();var variedSequence=saloonKnockoutSequence;startPunchStun(variedWorld,0);
 var variedWorldPose=JSON.stringify(variedWorld.stunPose),variedWorldXY=[variedWorld.x,variedWorld.y];
 stepSaloonKnockoutPhysics(variedWorld,1000,variedFree);`);
check('!variedWorld.stunPose.knockout&&saloonKnockoutSequence===variedSequence','World knocks never enter or advance the activity profile sequence');
check('JSON.stringify(variedWorld.stunPose)===variedWorldPose&&variedWorld.x===variedWorldXY[0]&&variedWorld.y===variedWorldXY[1]','The saloon integrator ignores a world knockdown completely');
check('startSaloonKnockoutPhysics(variedWorld,0,{},"WORLD")===null','An explicit world context cannot enter the activity initializer');
// Observe actual cel geometry, including the profile-specific limb painter.
const previous={drawFallBone:ctx.drawFallBone,ellipse:ctx.ellipse};let bones=0,shapes=0;
ctx.drawFallBone=(...args)=>{assert(args.slice(1,6).every(Number.isFinite));bones++;return previous.drawFallBone(...args);};
ctx.ellipse=(...args)=>{assert(args.every(Number.isFinite));shapes++;return previous.ellipse(...args);};
probe(`for(const response of variedResponses){const a=response.actor;a.stunTimer=99999;drawStunnedFigure(a);}`);
Object.assign(ctx,previous);
assert(bones>=72&&shapes>0,'All five variants render through connected cel limbs and native costume/head paths');checks++;
console.log('Saloon ragdoll variety: '+checks+' profile, anatomy, scope, collision, timing and rendering checks passed.');

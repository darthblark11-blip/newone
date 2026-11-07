// Exercise the real nonlethal solver independently from scene input/results.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let checks = 0;
const check = (code, label) => { assert.ok(probe(code), label); checks++; };
probe(`isStoryMode=false;townsData={};startAtLevel(2);started=true;doTick=true;
 activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();
 enemiesList=[];viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;
 function koActor(type='NORMAL',x=0,y=0){const a=new Character(x,y,false,type);a.aimAngle=PI;a.isMoving=false;
   a.motionX=a.motionY=0;a.motionFrame=frameCount;return a;}
 function koFreeMove(a,x,y){a.x=x;a.y=y;}
 var koContacts=[];
 function koContact(event){koContacts.push(event);}
 var ko=koActor();var koHp=ko.hp;
 startKnockoutPhysics(ko,0,{kind:'RIGHT_HOOK',level:'HEAD',damage:29},'SALOON');
 ko.stunTimer=99999;`);
check('ko.stunPose.knockout.context==="SALOON"&&ko.hp===koHp&&!ko.dead&&!ko.knockedOut',
  'Starting physical posing alone does not mutate health, death or scene result flags');
probe('stepKnockoutPhysics(ko,250,koFreeMove,koContact);');
check('ko.stunPose.knockout.height>4&&ko.x>8&&stunFall(ko)>0&&stunFall(ko)<1',
  'A real knockout travels from the hit, rises slightly and progressively collapses');
check('Math.abs(ko.stunPose.rag.ang)>.05&&ko.stunPose.rag.limbs.some(L=>Math.abs(L.va)>.005)',
  'Torso rotation and live limb spring velocities accompany the fall');
probe('var koPaused=JSON.stringify({x:ko.x,y:ko.y,p:ko.stunPose});stepKnockoutPhysics(ko,0,koFreeMove,koContact);');
check('JSON.stringify({x:ko.x,y:ko.y,p:ko.stunPose})===koPaused', 'Zero elapsed time keeps paused physics exactly frozen');
probe('stepKnockoutPhysics(ko,1000,koFreeMove,koContact);');
check('ko.stunPose.done&&ko.stunPose.rag.done&&ko.stunPose.knockout.settled',
  'A finite fall reaches the completed minigame pose and freezes its ragdoll');
check('koContacts.length>0&&koContacts.length<=KNOCKOUT_PHYSICS.MAX_CONTACTS&&koContacts.every(e=>e.context==="SALOON"&&Number.isFinite(e.point.x)&&e.impulse>0)',
  'At most two real floor contacts expose local finite effect points');
check('ko.stunPose.knockout.height===0&&ko.stunPose.impulse===0&&ko.stunPose.rag.limbs.every(L=>L.va===0&&L.vb===0)',
  'Completed bodies stop all vertical, translational and limb velocities');
probe('var koFrozen=JSON.stringify({x:ko.x,y:ko.y,p:ko.stunPose});for(let i=0;i<300;i++)stepKnockoutPhysics(ko,1000,koFreeMove,koContact);');
check('JSON.stringify({x:ko.x,y:ko.y,p:ko.stunPose})===koFrozen', 'A settled body cannot drift or spin during later scene updates');
// The same initial random rest pose must produce the same motion when dt is
// partitioned differently. The production solver owns the fixed-step clock.
let seed=91;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=seed/4294967296;
  if(Array.isArray(a))return a[Math.floor(n*a.length)];if(a===undefined)return n;
  return b===undefined?n*a:a+(b-a)*n;};
seed=91;probe("saloonKnockoutSequence=0;var koFine=koActor();startKnockoutPhysics(koFine,.7,{kind:'LEFT_HOOK',level:'BODY'},'SALOON');");
seed=91;probe("saloonKnockoutSequence=0;var koCoarse=koActor();startKnockoutPhysics(koCoarse,.7,{kind:'LEFT_HOOK',level:'BODY'},'SALOON');");
probe('for(let i=0;i<60;i++)stepKnockoutPhysics(koFine,1000/60,koFreeMove);for(let i=0;i<10;i++)stepKnockoutPhysics(koCoarse,100,koFreeMove);');
check('Math.hypot(koFine.x-koCoarse.x,koFine.y-koCoarse.y)<1e-8&&Math.abs(koFine.stunPose.rag.ang-koCoarse.stunPose.rag.ang)<1e-8&&koFine.stunPose.rag.limbs.every((L,i)=>Math.abs(L.a-koCoarse.stunPose.rag.limbs[i].a)<1e-8)',
  '60 Hz and coarse 100 ms updates produce identical physical falls');
probe(`var koLimits=true,koFinite=true,koVariety=[],koPeaks=[];
 for(const kind of ['LEFT_STRAIGHT','RIGHT_JAB','LEFT_HOOK','RIGHT_HOOK'])for(const level of ['HEAD','BODY'])for(let response=0;response<3;response++){
   saloonKnockoutSequence=response;
   const a=koActor();startKnockoutPhysics(a,.48,{kind,level,damage:30},'SALOON');let peak=0;
   for(let i=0;i<130;i++){
     stepKnockoutPhysics(a,1000/120,koFreeMove);
     const p=a.stunPose,k=p.knockout,r=p.rag;peak=Math.max(peak,k.height);
     koFinite=koFinite&&[a.x,a.y,p.age,r.ang,k.height,k.vx,k.vy,k.roll].every(Number.isFinite);
     koLimits=koLimits&&k.height>=0&&k.height<=KNOCKOUT_PHYSICS.MAX_HEIGHT&&Math.abs(k.roll)<=KNOCKOUT_PHYSICS.ROLL_LIMIT&&Math.abs(r.ang)<=KNOCKOUT_PHYSICS.TURN_LIMIT&&k.contacts<=2&&
       r.limbs.every(L=>L.a>=L.lo&&L.a<=L.hi&&L.b>=0&&L.b<=L.bMax&&ragKnee(L)>=0);
   }
   koVariety.push({kind,level,response,variant:a.stunPose.knockout.variant,fold:a.stunPose.knockout.profile.fold,
     yaw:a.stunPose.rag.ang,peak,settled:a.stunPose.knockout.settled});koPeaks.push(peak);
 }`);
check('koFinite&&koLimits&&koVariety.every(p=>p.settled)',
  'All 24 strike/response combinations remain finite, obey every joint/height bound and finish');
check('koVariety.filter(p=>p.kind==="LEFT_HOOK"&&p.level==="HEAD").every(p=>p.yaw<koVariety.find(q=>q.kind==="RIGHT_HOOK"&&q.level===p.level&&q.response===p.response).yaw)',
  'Left and right hooks impart opposite torque for each of the three matching responses');
check('new Set(koVariety.map(p=>p.variant)).size===5&&koVariety.filter(p=>p.level==="BODY").every(p=>p.peak<3&&p.fold>0)&&koVariety.some(p=>p.level==="HEAD"&&p.peak>5)',
  'Five physical responses include low folded body-shot collapses and visibly higher head-shot reels');
// Deliberately block one travel axis using the same absolute-move contract the
// saloon uses. Nothing can tunnel through the wall; the free axis still slides.
probe(`var koWall=koActor();startKnockoutPhysics(koWall,.7,{kind:'RIGHT_HOOK'},'SALOON');
 function koWallMove(a,x,y){a.x=Math.min(10,x);a.y=y;}
 for(let i=0;i<120;i++)stepKnockoutPhysics(koWall,1000/120,koWallMove);`);
check('koWall.x<=10&&koWall.y>15&&koWall.stunPose.knockout.settled&&Number.isFinite(koWall.x)',
  'A collision absorbs its blocked axis and allows bounded movement along the wall');
// Exterior residents use the earlier directional buckle, independently of
// the minigame solver above. Streamed poses continue via the native frame step.
probe(`var koNative=koActor('CITY_CITIZEN_M');startPunchStun(koNative,0);
 var koNativeHp=koNative.hp;for(let i=0;i<10;i++)advanceStun(koNative);
 var koSavedAge=koNative.stunPose.age,koSavedX=koNative.x;
 var koRestored=koActor('CITY_CITIZEN_M',koSavedX);startPunchStun(koRestored,0);
 koRestored.stunPose.age=koSavedAge;advanceStun(koRestored);`);
check('!koNative.stunPose.knockout&&!koRestored.stunPose.knockout&&koRestored.stunPose.age===koSavedAge+1&&koRestored.x>=koSavedX&&koRestored.x-koSavedX<=4.8+1e-9',
  'A streamed native resident advances its legacy fall without minigame lift, roll or contact physics');
probe('var koRestoreBefore=JSON.stringify({x:koRestored.x,y:koRestored.y,p:koRestored.stunPose});stepKnockoutPhysics(koRestored,1000/60,koFreeMove,()=>{throw new Error("Exterior floor contact leaked");});');
check('JSON.stringify({x:koRestored.x,y:koRestored.y,p:koRestored.stunPose})===koRestoreBefore',
  'The minigame step cannot advance an exterior civilian fall');
check('koNative.stunTimer===230&&koNative.hp===koNativeHp&&koNative.isNeutral',
  'Native civilians retain their original 240-frame nonlethal timer, health and neutrality');
probe('koNative.stunTimer=16;');
check('stunFall(koNative)<=.5', 'The native final 32-frame recovery still blends the body back upright');
probe('koNative.stunTimer=1;advanceStun(koNative);');
check('koNative.stunTimer===0&&!koNative.stunPose&&koNative.state==="FLEE"&&koNative.hp===koNativeHp',
  'The harmless native knockdown ends through its established flee/recovery state');
probe('var koHostile=koActor();startPunchStun(koHostile,0);');
check('koHostile.stunTimer===1500&&!koHostile.dead', 'Hostile nonlethal knockouts preserve their existing 1500-frame timer');
// Local physics must never append effects to the exterior campaign arrays.
probe(`var koParticles=particles.length,koBodies=corpses.length,koLocal=koActor();
 startKnockoutPhysics(koLocal,0,{kind:'LEFT_HOOK'},'SALOON');
 stepKnockoutPhysics(koLocal,1000,koFreeMove);`);
check('particles.length===koParticles&&corpses.length===koBodies',
  'Local falls create neither exterior particles nor lethal corpses');
probe('var koInvalidBefore=JSON.stringify(koLocal.stunPose);stepKnockoutPhysics(koLocal,Infinity,koFreeMove);stepKnockoutPhysics(koLocal,NaN,koFreeMove);');
check('JSON.stringify(koLocal.stunPose)===koInvalidBefore', 'Invalid elapsed values cannot mutate or corrupt a body');
// The fallen player paints the suit captured at impact even if global shop
// equipment later changes. Rendering still uses the shared curved cel rig.
probe(`var koPlayer=player;koPlayer.x=koPlayer.y=0;koPlayer.aimAngle=0;koPlayer.isMoving=false;
 var koEquipment={cowboy:cowboySuitEquipped,ninja:ninjaSuitUnlocked,chemist:chemistSuitUnlocked,armor:explosiveArmorUnlocked};
 explosiveArmorUnlocked=ninjaSuitUnlocked=chemistSuitUnlocked=false;cowboySuitEquipped=true;
 startKnockoutPhysics(koPlayer,PI,{kind:'RIGHT_HOOK'},'SALOON');koPlayer.stunTimer=99999;
 cowboySuitEquipped=false;chemistSuitUnlocked=true;`);
check('koPlayer.stunPose.identity.cowboySuit&&!koPlayer.stunPose.identity.chemistSuit&&red(koPlayer.stunPose.identity.shirtCol)===219',
  'The player keeps the exact costume and shirt color frozen at knockout');
const originalGeometry={ellipse:ctx.ellipse,vertex:ctx.vertex,bezierVertex:ctx.bezierVertex};
let primitives=0;
for(const [name,original] of Object.entries(originalGeometry))ctx[name]=(...args)=>{
  assert.ok(args.every(Number.isFinite),`Non-finite knockout ${name}`);primitives++;return original(...args);
};
probe('for(let i=0;i<70;i++){stepKnockoutPhysics(koPlayer,1000/60,koFreeMove);drawStunnedFigure(koPlayer);}');
Object.assign(ctx,originalGeometry);
assert.ok(primitives>100,'Actual knockout painting emitted no cel figure geometry');checks++;
probe('cowboySuitEquipped=koEquipment.cowboy;ninjaSuitUnlocked=koEquipment.ninja;chemistSuitUnlocked=koEquipment.chemist;explosiveArmorUnlocked=koEquipment.armor;player.stunTimer=0;player.stunPose=null;');
console.log(`Knockout physics: ${checks} timing, collision, separated native recovery and rendering checks passed.`);

// The held action samples movement at activation, commits a collision-safe dive,
// and lands in the existing planted prone body without modifying ordinary gaits.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
const near=(a,b,tolerance=1e-7)=>Math.abs(a-b)<tolerance;
const sameAngle=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))<1e-7;
ctx.setTimeout=()=>0;
const keys=new Set();ctx.keyIsDown=k=>keys.has(k);
function fresh(stance='STAND',angle=0){
 keys.clear();ctx.touches=[];ctx.mouseIsPressed=false;
 probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isPaused=isDead=isWin=killcamMode=false;isStoryMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 inOverworldView=false;window.inNM0SecretOverlay=false;buildGhost=null;
 buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
 leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:313,y:690}};
 setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;jetpackUnlocked=false;
 player=new Character(0,0,true);player.hp=player.maxHp=300;player.isArmed=true;
 player.aimAngle=${angle};player.moveAngle=${angle};frameCount=100;deltaTime=1000/60;
 resetActorStance(player,'${stance}');consumeStanceInputs();`);
}
function input(angle){probe(`leftStick.active=true;leftStick.dx=Math.cos(${angle});leftStick.dy=Math.sin(${angle});`);}
function step(ms){probe(`deltaTime=${ms};frameCount++;player.updatePlayer();`);}
function advance(ms,dt=1000/60){for(let t=0;t<ms-1e-7;){const d=Math.min(dt,ms-t);t+=d;step(d);}}
for(const start of ['STAND','CROUCH'])for(let i=0;i<8;i++){
 const angle=i*Math.PI/4;
 fresh(start,angle+Math.PI);input(angle);
 ok(start+' accepts directional dive '+i,P('requestPlayerProne()&&proneDiveActive(player)'));
 ok('the body follows travel even during the initial crouch '+start+i,sameAngle(P('stanceFacingAngle(player)'),angle));
 // Changing both thumbs after launch cannot steer or cancel the committed dive.
 input(angle+Math.PI/2);probe('rightStick.active=true;rightStick.dx=0;rightStick.dy=-1;rightStick.dist=.3;');
 advance(350);
 ok('aim input preserves mid-dive movement heading '+start+i,sameAngle(P('stanceFacingAngle(player)'),angle));
 ok('mid-dive displacement stays on the committed ray '+start+i,
   Math.abs(P('player.x')*Math.sin(angle)-P('player.y')*Math.cos(angle))<1e-7&&P('proneDiveActive(player)'));
 advance(350);
 ok('landing reaches the same endpoint in each direction '+start+i,
   near(P('player.x'),Math.cos(angle)*220)&&near(P('player.y'),Math.sin(angle)*220));
 ok('landing ends immunity in the existing prone pose '+start+i,P('player.stance.value===2&&!proneDiveActive(player)&&!proneDivePoseActive(player)&&stanceProneSpotClear(player)'));
}
for(const start of ['STAND','CROUCH']) {
 fresh(start);input(0);probe('requestPlayerProne();');step(20);
 ok(start+' begins a fast interpolated unfold instead of snapping straight to prone',P('player.stance.value>0&&player.stance.value<2'));
 advance(45);
 ok(start+' reaches a level belly-down body within 65 ms of launch',P('player.stance.value===2&&actorStancePose(player).prone===1&&proneDiveActive(player)'));
 const extended=P('JSON.stringify(stanceBodyPose(player).joints.map(j=>({knee:j.knee,ankle:j.ankle})))');
 probe('player.walkCycle+=2;player.gait=1;');
 ok(start+' keeps its legs extended in flight instead of entering a crawl',P('JSON.stringify(stanceBodyPose(player).joints.map(j=>({knee:j.knee,ankle:j.ankle})))')===extended);
 advance(400);
 ok(start+' remains level through the air while the height arc descends',P('player.stance.value===2&&actorStancePose(player).prone===1&&proneDiveActive(player)'));
}
fresh();input(0);probe('requestPlayerProne();');
ok('the raised dive starts at ground height',P('proneDiveLift(player)===0'));
advance(350);
ok('the dive apex rises fourteen units with a modest uniform size increase',P('Math.abs(proneDiveLift(player)-14)<1e-8&&Math.abs(actorStancePose(player).scaleX/(1-.045-.025*actorStancePose(player).prone)-1.09)<1e-8&&actorStancePose(player).scaleX===actorStancePose(player).scaleY'));
probe(`window.diveRaisedMuzzle=stanceMuzzleWorld(player,player.x+31,player.y+8);
 window.diveRaisedSupport=stanceMuzzleWorld(player,player.x+31,player.y+8,0,true);
 window.diveRaisedUI=actorStanceUIAnchor(player);
 var diveLiftOriginal=proneDiveLift;proneDiveLift=()=>0;
 window.diveGroundMuzzle=stanceMuzzleWorld(player,player.x+31,player.y+8);
 window.diveGroundSupport=stanceMuzzleWorld(player,player.x+31,player.y+8,0,true);
 window.diveGroundUI=actorStanceUIAnchor(player);proneDiveLift=diveLiftOriginal;`);
ok('height lifts main and support shot origins and labels with the actor',P('Math.abs(diveRaisedMuzzle.x-diveGroundMuzzle.x)<1e-8&&Math.abs(diveRaisedMuzzle.y-diveGroundMuzzle.y+14)<1e-8&&Math.abs(diveRaisedSupport.x-diveGroundSupport.x)<1e-8&&Math.abs(diveRaisedSupport.y-diveGroundSupport.y+14)<1e-8&&Math.abs(diveRaisedUI.y-diveGroundUI.y+14)<1e-8'));
advance(350);
ok('landing returns fully to the existing floor height and prone size',P('proneDiveLift(player)===0&&Math.abs(actorStancePose(player).scaleX-.93)<1e-8'));

// Dust is a landing event, not a per-frame effect or a static-prone side effect.
fresh();input(0);probe('requestPlayerProne();');advance(699);
ok('the airborne dive produces no landing dust before floor contact',P("particles.filter(p=>p.t==='PRONE_DUST').length===0&&!player.stance.dive.landed"));
probe('isPaused=true;updateActorStance(player,100);');
ok('pause cannot advance the landing clock or release dust early',P("player.stance.elapsedMs===699&&particles.filter(p=>p.t==='PRONE_DUST').length===0&&!player.stance.dive.landed"));
probe('isPaused=false;');step(1);
const landingDust=P("particles.filter(p=>p.t==='PRONE_DUST').length");
ok('floor contact emits a bounded pooled dust burst exactly at landing',landingDust>0&&landingDust<=32&&P("player.stance.dive.landed&&proneDiveLift(player)===0&&particles.filter(p=>p.t==='PRONE_DUST').every(p=>p.shovelOwner===player)"));
probe('leftStick.active=false;leftStick.dx=leftStick.dy=0;moveProneDive(player);moveProneDive(player);');advance(100);
ok('settled frames and duplicate landing queries cannot emit another burst',P("particles.filter(p=>p.t==='PRONE_DUST').length")===landingDust);
probe(`window.diveDustRefs=particles.filter(p=>p.t==='PRONE_DUST');window.diveDustFrozen=JSON.stringify(diveDustRefs);
 doTick=false;updateParticles();updateParticles();`);
ok('paused dust rendering leaves particle simulation state untouched',P('JSON.stringify(diveDustRefs)===diveDustFrozen'));
probe('doTick=true;for(let i=0;i<26;i++)updateParticles();');
ok('landing dust retires after 26 simulation ticks and releases its actor references',P("particles.filter(p=>p.t==='PRONE_DUST').length===0&&diveDustRefs.every(p=>p.shovelOwner===null&&_particlePool.includes(p))"));
probe('emitProneLandingDust(player);');
ok('a later landing reuses the same bounded puff records with fresh lifetime',P("particles.filter(p=>p.t==='PRONE_DUST').length===8&&particles.filter(p=>p.t==='PRONE_DUST').every(p=>diveDustRefs.includes(p)&&p.fxAge===0&&p.fxLife===26&&p.a===175&&p.shovelOwner===player)"));

fresh();probe('requestPlayerProne();');advance(600);
ok('lowering into prone while stationary does not create impact dust',P("particles.filter(p=>p.t==='PRONE_DUST').length===0"));

for(const fps of [30,60,120]) {
 fresh();keys.add(67);probe('handleDesktopStance();');
 for(let i=0;i<Math.round(fps*.2);i++)probe(`frameCount++;updateActorStance(player,${1000/fps});`);
 ok('the 200 ms hold triggers at its real '+fps+' fps input boundary',P('player.stance.to===2'));
}

const endpoints=[];
for(const fps of [15,30,60,120]){
 fresh();input(-Math.PI/4);probe('requestPlayerProne();');advance(700,1000/fps);
 endpoints.push(P('[player.x,player.y]'));
}
ok('dive distance is independent of frame rate',endpoints.every(p=>near(p[0],endpoints[0][0])&&near(p[1],endpoints[0][1])));
fresh();probe('requestPlayerProne();');advance(300);
ok('a stationary hold lowers in place with no movement or dive pose',P("player.x===0&&player.y===0&&player.stance.value===2&&!player.stance.dive&&!proneDiveActive(player)&&proneDiveLift(player)===0"));

fresh();keys.add(67);probe('handleDesktopStance();');
probe('updateActorStance(player,100);updateActorStance(player,99);');
input(Math.PI/2);probe('updateActorStance(player,1);');
ok('the hold samples the current movement thumb at 200 milliseconds',P('proneDiveActive(player)')&&near(P('player.stance.dive.angle'),Math.PI/2));
ok('the 200-millisecond preparation does not spend the dive animation early',P('player.stance.elapsedMs===0&&player.stance.value===0'));
fresh();input(0);keys.add(67);probe('handleDesktopStance();');
probe('updateActorStance(player,100);updateActorStance(player,99);');
probe('leftStick.active=false;leftStick.dx=leftStick.dy=0;updateActorStance(player,1);');
ok('releasing movement before the threshold produces a stationary drop',P('player.stance.to===2&&!player.stance.dive&&!proneDiveActive(player)'));

fresh();input(0);probe('requestPlayerProne();');advance(140);
const pose=P('JSON.stringify(stanceBodyPose(player))'),heading=P('stanceFacingAngle(player)'),state=P('JSON.stringify(player.stance)');
probe('isPaused=true;updateActorStance(player,100);');
ok('pause freezes the dive clock and all canonical body joints',P('JSON.stringify(player.stance)')===state&&P('JSON.stringify(stanceBodyPose(player))')===pose&&P('stanceFacingAngle(player)')===heading);
probe('isPaused=false;');advance(560);
ok('resuming completes the remainder of the same dive',near(P('player.x'),220)&&P('player.stance.value===2&&!proneDiveActive(player)'));

fresh('STAND',Math.PI/2);probe('buildings=activeBuildings=[{x:0,y:42,w:120,h:10,isWall:true}];invalidateColIndex();');
ok('an aimed stationary footprint is blocked beside cover',!P("requestActorStance(player,'PRONE')"));
input(0);
ok('a moving dive tests the travel footprint rather than the gun direction',P('requestPlayerProne()&&stanceProneSpotClear(player)'));

fresh();probe('buildings=activeBuildings=[{x:90,y:0,w:2,h:400,isWall:true}];invalidateColIndex();');input(0);probe('requestPlayerProne();');advance(700,100);
ok('a long-frame dive cannot tunnel its leading end through thin cover',P('player.x>0&&player.x<=49&&player.y===0&&stanceProneSpotClear(player)'));
fresh();input(0);probe('requestPlayerProne();buildings=activeBuildings=[{x:38,y:0,w:2,h:400,isWall:true}];invalidateColIndex();');step(50);
ok('cover appearing during launch cancels the extended dive safely',P('!proneDiveActive(player)&&!player.stance.dive&&player.stance.to===1&&player.x<=6&&!player.checkCol(player.x,player.y)'));

fresh();input(0);probe('requestPlayerProne();');advance(700);
probe('leftStick.active=false;leftStick.dx=leftStick.dy=0;');step(16);
ok('the dive cannot continue drifting once its displacement is spent',near(P('player.x'),220));
console.log(`${checks}/${checks} prone dive direction, timing, movement, collision and pose checks passed.`);

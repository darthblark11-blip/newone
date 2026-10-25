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
function advance(ms,dt=1000/60){for(let t=0;t<ms;){const d=Math.min(dt,ms-t);t+=d;step(d);}}
for(const start of ['STAND','CROUCH'])for(let i=0;i<8;i++){
 const angle=i*Math.PI/4;
 fresh(start,angle+Math.PI);input(angle);
 ok(start+' accepts directional dive '+i,P('requestPlayerProne()&&proneDiveActive(player)'));
 ok('the body follows travel even during the initial crouch '+start+i,sameAngle(P('stanceFacingAngle(player)'),angle));
 // Changing both thumbs after launch cannot steer or cancel the committed dive.
 input(angle+Math.PI/2);probe('rightStick.active=true;rightStick.dx=0;rightStick.dy=-1;rightStick.dist=.3;');
 advance(210);
 ok('aim input preserves mid-dive movement heading '+start+i,sameAngle(P('stanceFacingAngle(player)'),angle));
 ok('mid-dive displacement stays on the committed ray '+start+i,
   Math.abs(P('player.x')*Math.sin(angle)-P('player.y')*Math.cos(angle))<1e-7&&P('proneDiveActive(player)'));
 advance(210);
 ok('landing reaches the same endpoint in each direction '+start+i,
   near(P('player.x'),Math.cos(angle)*132)&&near(P('player.y'),Math.sin(angle)*132));
 ok('landing ends immunity in the existing prone pose '+start+i,P('player.stance.value===2&&!proneDiveActive(player)&&!proneDivePoseActive(player)&&stanceProneSpotClear(player)'));
}
const endpoints=[];
for(const fps of [15,30,60,120]){
 fresh();input(-Math.PI/4);probe('requestPlayerProne();');advance(420,1000/fps);
 endpoints.push(P('[player.x,player.y]'));
}
ok('dive distance is independent of frame rate',endpoints.every(p=>near(p[0],endpoints[0][0])&&near(p[1],endpoints[0][1])));
fresh();probe('requestPlayerProne();');advance(300);
ok('a stationary hold lowers in place with no movement or dive pose',P("player.x===0&&player.y===0&&player.stance.value===2&&!player.stance.dive&&!proneDiveActive(player)"));

fresh();keys.add(67);probe('handleDesktopStance();');
for(let i=0;i<9;i++)probe('updateActorStance(player,100);');
probe('updateActorStance(player,99);');
input(Math.PI/2);probe('updateActorStance(player,1);');
ok('the hold samples the current movement thumb at one second',P('proneDiveActive(player)')&&near(P('player.stance.dive.angle'),Math.PI/2));
ok('the one-second preparation does not spend the dive animation early',P('player.stance.elapsedMs===0&&player.stance.value===0'));
fresh();input(0);keys.add(67);probe('handleDesktopStance();');
for(let i=0;i<9;i++)probe('updateActorStance(player,100);');
probe('updateActorStance(player,99);');
probe('leftStick.active=false;leftStick.dx=leftStick.dy=0;updateActorStance(player,1);');
ok('releasing movement before the threshold produces a stationary drop',P('player.stance.to===2&&!player.stance.dive&&!proneDiveActive(player)'));

fresh();input(0);probe('requestPlayerProne();');advance(140);
const pose=P('JSON.stringify(stanceBodyPose(player))'),heading=P('stanceFacingAngle(player)'),state=P('JSON.stringify(player.stance)');
probe('isPaused=true;updateActorStance(player,100);');
ok('pause freezes the dive clock and all canonical body joints',P('JSON.stringify(player.stance)')===state&&P('JSON.stringify(stanceBodyPose(player))')===pose&&P('stanceFacingAngle(player)')===heading);
probe('isPaused=false;');advance(280);
ok('resuming completes the remainder of the same dive',near(P('player.x'),132)&&P('player.stance.value===2&&!proneDiveActive(player)'));

fresh('STAND',Math.PI/2);probe('buildings=activeBuildings=[{x:0,y:42,w:120,h:10,isWall:true}];invalidateColIndex();');
ok('an aimed stationary footprint is blocked beside cover',!P("requestActorStance(player,'PRONE')"));
input(0);
ok('a moving dive tests the travel footprint rather than the gun direction',P('requestPlayerProne()&&stanceProneSpotClear(player)'));

fresh();probe('buildings=activeBuildings=[{x:90,y:0,w:2,h:400,isWall:true}];invalidateColIndex();');input(0);probe('requestPlayerProne();');advance(420,100);
ok('a long-frame dive cannot tunnel its leading end through thin cover',P('player.x>0&&player.x<=49&&player.y===0&&stanceProneSpotClear(player)'));
fresh();input(0);probe('requestPlayerProne();buildings=activeBuildings=[{x:38,y:0,w:2,h:400,isWall:true}];invalidateColIndex();');step(50);
ok('cover appearing during launch cancels the extended dive safely',P('!proneDiveActive(player)&&!player.stance.dive&&player.stance.to===1&&player.x<=6&&!player.checkCol(player.x,player.y)'));

fresh();input(0);probe('requestPlayerProne();');advance(420);
probe('leftStick.active=false;leftStick.dx=leftStick.dy=0;');step(16);
ok('the dive cannot continue drifting once its displacement is spent',near(P('player.x'),132));
console.log(`${checks}/${checks} prone dive direction, timing, movement, collision and pose checks passed.`);

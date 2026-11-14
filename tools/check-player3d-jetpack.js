// The backpack is one rigid attached object through turns, dives and rolls.
const assert=require('node:assert/strict');
const {probe}=require('./harness');
const P=s=>probe('('+s+')');let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const near=(a,b,e=.00005)=>Math.abs(a-b)<=e;
probe(`started=doTick=true;isStoryMode=isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inCutscene=inOverworldView=false;
 currentLevel=currentBiome=2;BIOME_ACTIVE=false;window.inNM0SecretOverlay=false;buildGhost=null;
 resetUndergroundRoute();setMeleeTool('NONE');
 chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;jetpackUnlocked=true;
 leftStick={active:false,dx:0,dy:0,dist:0};rightStick={active:true,dx:1,dy:0,dist:.4};
 buildings=activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;`);
const asset=P('PLAYER3D_ASSET');
function fresh(stance='STAND',angle=0){
 probe(`player=new Character(0,0,true);player.currentWeapon=WEAPONS.PISTOL;player.isArmed=true;
 player.aimAngle=player.moveAngle=${angle};player.gait=.6;player.walkCycle=.7;player.aimHold=14;
 player.reloadTimer=player.meleeTimer=player.muzzleFlash=player.hitFlash=player.dashTimer=0;
 resetActorStance(player,${JSON.stringify(stance)});frameCount++;
 if(player.stance){player.stance.proneHeading=${angle};player.stance.proneAimBlend=1;}`);
}
function extrema(part,axis){
 let low=Infinity,high=-Infinity;const p=asset.meshes[part.mesh].positions,m=part.matrix;
 for(let i=0;i<p.length;i+=3){const value=m[axis]*p[i]+m[axis+4]*p[i+1]+m[axis+8]*p[i+2]+m[axis+12];low=Math.min(low,value);high=Math.max(high,value);}
 return [low,high];
}
function sample(label){
 // Native stance sampling refreshes a derived cache after the simulation
 // clock changes. Initialize it before checking the mesh query's purity.
 P('actorStancePose(player)');
 const before=P('JSON.stringify(player)'),s=P('player3DPose(player)'),pack=s.parts.find(p=>p.part==='jetpack');
 ok(!!pack,label+' includes the pack');
 const m=pack.matrix,cols=[[m[0],m[1],m[2]],[m[4],m[5],m[6]],[m[8],m[9],m[10]]],lengths=cols.map(v=>Math.hypot(...v));
 ok(Array.from(m).every(Number.isFinite),label+' finite transform');
 ok(lengths.every(n=>near(n,lengths[0])),label+' equal axis scale preserves source proportions');
 for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)ok(Math.abs(cols[i].reduce((sum,v,k)=>sum+v*cols[j][k],0))<.0002,label+' no shear');
 const n=s.pose.jetpack.backNormal,d={x:m[12]-s.pose.chest.x,y:m[13]-s.pose.chest.y,z:m[14]-s.pose.chest.z};
 const projection=d.x*n.x+d.y*n.y+d.z*n.z;
 ok(projection>0,label+' pack remains on the anatomical back');
 ok(Math.hypot(d.x-n.x*projection,d.y-n.y*projection,d.z-n.z*projection)<.00005,label+' attached center does not drift along the torso');
 const x=extrema(pack,0),y=extrema(pack,1);
 ok((x[1]-x[0])*(y[1]-y[0])>100,label+' projected pack retains visible volume');
 ok(P('JSON.stringify(player)')===before,label+' pose query does not update animation state');
 return {s,pack};
}
for(const stance of ['STAND','CROUCH','PRONE'])for(const heading of [0,.8,Math.PI/2,Math.PI,-Math.PI+.001]){
 fresh(stance,heading);sample(stance+'/'+heading);
}
fresh('PRONE');
let previous=null;
for(let i=0;i<=160;i++){
 const angle=-Math.PI+i*Math.PI*2/160;probe(`player.aimAngle=${angle};frameCount++;`);
 const {s,pack}=sample('prone roll '+i),m=pack.matrix;
 if(previous){
  ok(Math.hypot(m[12]-previous[12],m[13]-previous[13],m[14]-previous[14])<2,'prone roll attachment is continuous');
  ok(Math.max(...[0,1,2,4,5,6,8,9,10].map(k=>Math.abs(m[k]-previous[k])))<2,'prone roll orientation is continuous');
 }
 previous=m;
 if(i===80){
  const torso=s.parts.find(p=>p.part==='torso');
  ok(s.pose.jetpack.backNormal.z>.99,'belly-down posterior points upward');
  ok(extrema(pack,2)[1]>extrema(torso,2)[1]+2,'belly-down pack sits above the back depth');
 }
 if(i===0||i===160)ok(s.pose.jetpack.backNormal.z<-.99,'back-lying pack rotates beneath the torso');
}
// A signed-angle wrap represents the same physical orientation.
fresh('PRONE');probe('player.aimAngle=Math.PI-.00001;');const a=sample('wrap before').pack.matrix;
probe('player.aimAngle=-Math.PI+.00001;');const b=sample('wrap after').pack.matrix;
ok(Array.from(a).every((v,i)=>Math.abs(v-b[i])<.003),'crossing +/-pi cannot flip the pack');

// Use the real moving prone request and native interpolation clock.
fresh();probe('leftStick.active=true;leftStick.dx=1;leftStick.dy=0;leftStick.dist=1;player.aimHold=0;rightStick.active=false;');
ok(P('requestPlayerProne()'),'native moving prone request starts a dive');
const duration=P('player.stance.durationMs');let elapsed=0;
const times=[0,12,24,36,48,65,...Array.from({length:9},(_,i)=>duration*i/8)].sort((a,b)=>a-b);
for(const target of times){
 let remaining=target-elapsed;while(remaining>0){const step=Math.min(100,remaining);probe(`frameCount++;updateActorStance(player,${step});moveProneDive(player);`);remaining-=step;}
 elapsed=target;const {s,pack}=sample('dive '+target.toFixed(2));
 if(P('actorStancePose(player).prone')>.99)ok(extrema(pack,2)[1]>extrema(s.parts.find(p=>p.part==='torso'),2)[1]+2,'pack stays above back through horizontal dive flight');
}
console.log(checks+' jetpack rigidity, attachment, roll and native-dive checks passed');

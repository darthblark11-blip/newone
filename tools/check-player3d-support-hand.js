// Validate the actual projected mesh overlap, not painter insertion order.
const assert=require('node:assert/strict');
const {probe}=require('./harness');
const P=s=>probe('('+s+')');let checks=0,cases=0,overlapCases=0;
const ok=(v,label)=>{assert.ok(v,label);checks++;};
const asset=P('PLAYER3D_ASSET');
probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
 currentLevel=currentBiome=2;BIOME_ACTIVE=false;window.inNM0SecretOverlay=false;buildGhost=null;
 resetUndergroundRoute();setMeleeTool('NONE');chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
 leftStick={active:true,dx:1,dy:0,dist:.6};rightStick={active:true,dx:1,dy:0,dist:.4};
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;`);
function projected(part){
 const mesh=asset.meshes[part.mesh],m=part.matrix,p=mesh.positions,q=[];
 for(let i=0;i<p.length;i+=3)q.push([m[0]*p[i]+m[4]*p[i+1]+m[8]*p[i+2]+m[12],
  m[1]*p[i]+m[5]*p[i+1]+m[9]*p[i+2]+m[13],m[2]*p[i]+m[6]*p[i+1]+m[10]*p[i+2]+m[14]]);
 return {points:q,indices:mesh.indices};
}
function depths(mesh,x,y){
 let low=Infinity,high=-Infinity;const p=mesh.points,ix=mesh.indices;
 for(let i=0;i<ix.length;i+=3){
  const a=p[ix[i]],b=p[ix[i+1]],c=p[ix[i+2]],den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
  if(Math.abs(den)<1e-9)continue;
  const u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/den,
   v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/den,w=1-u-v;
  if(u<-.000001||v<-.000001||w<-.000001)continue;
  const z=u*a[2]+v*b[2]+w*c[2];low=Math.min(low,z);high=Math.max(high,z);
 }
 return [low,high];
}
function setup(weapon,stance,angle,presentation,reload){
 probe(`player=new Character(70,90,true);player.currentWeapon=WEAPONS[${JSON.stringify(weapon)}];
  player.isArmed=true;player.isMoving=true;player.gait=.6;player.walkCycle=1.2;player.aimAngle=${angle};player.moveAngle=${angle+1};
  player.aimHold=${presentation?14:0};player._weaponPresentation={value:${presentation},velocity:0};
  player.meleeTimer=player.muzzleFlash=player.weaponKick=0;player.reloadTimer=${reload};
  resetActorStance(player,${JSON.stringify(stance)});if(player.stance)player.stance.proneAimBlend=1;
  rightStick.active=${presentation>0};frameCount++;`);
}
for(const weapon of ['ASSAULT_RIFLE','SHOTGUN','PARTICLE_BEAM','ROCKET_LAUNCHER','COACH_GUN'])
 for(const stance of ['STAND','CROUCH','PRONE'])for(const angle of [0,.7,Math.PI/2,Math.PI])for(const presentation of [0,.5,1]){
  setup(weapon,stance,angle,presentation,0);const before=P('JSON.stringify(player)'),pose=P('player3DPose(player)');cases++;
  ok(P('JSON.stringify(player)')===before,'mesh support solve preserves actor state');
  const gun=pose.parts.find(p=>p.part==='weapon_primary'),palm=pose.parts.find(p=>p.part==='hand_left');
  ok(!!gun&&!!palm,weapon+' has gun and support palm');
  const model=projected(gun),hand=projected(palm);
  const x0=Math.min(...hand.points.map(p=>p[0])),x1=Math.max(...hand.points.map(p=>p[0])),
   y0=Math.min(...hand.points.map(p=>p[1])),y1=Math.max(...hand.points.map(p=>p[1]));
  let overlap=0;
  for(let xi=0;xi<11;xi++)for(let yi=0;yi<11;yi++){
   const x=x0+(x1-x0)*xi/10,y=y0+(y1-y0)*yi/10,a=depths(hand,x,y),b=depths(model,x,y);
   if(!Number.isFinite(a[1])||!Number.isFinite(b[0]))continue;overlap++;
   ok(a[1]<b[0]-.04,weapon+'/'+stance+' support palm lies below actual gun surfaces');
  }
  if(overlap)overlapCases++;
  const support=pose.sockets.supportGrip;
  ok(!!support,'two-handed firearm exposes its resolved support contact');
  ok(Math.hypot(palm.matrix[12]-support.x,palm.matrix[13]-support.y)<.0001,'hand XY remains on native support contact');
  const native=P('aimLaserMuzzle(player,0)'),m=pose.sockets.muzzle;
  ok(Math.hypot(m.x+70-native.x,m.y+90-native.y)<.0001,'support depth does not move muzzle');
 }
ok(overlapCases>120,'depth checks cover real gun/palm overlap across most poses');
// Reloading may move the free hand off the gun; all resulting transforms
// stay finite and the sampled actor remains unchanged during that transition.
for(const reload of [1,15,30,45,60,75,89]){
 setup('ASSAULT_RIFLE','STAND',.7,1,reload);const before=P('JSON.stringify(player)'),pose=P('player3DPose(player)');
 ok(pose.parts.every(p=>Array.from(p.matrix).every(Number.isFinite)),'reload support transforms remain finite');
 ok(P('JSON.stringify(player)')===before,'reload support solve preserves simulation state');
}
for(const weapon of ['PISTOL','BOW','DUAL_SMG']){
 setup(weapon,'STAND',.7,1,0);const pose=P('player3DPose(player)');
 ok(!pose.sockets.supportGrip,weapon+' does not use long-gun support-depth correction');
}
console.log(checks+' support-hand mesh-depth, native-XY, muzzle and purity checks passed across '+cases+' poses ('+overlapCases+' overlapping)');

// A military helmet is an open-bottom hard shell, not a whole-head cloth wrap.
const assert=require('node:assert/strict');
const {probe}=require('./harness');
const P=s=>probe('('+s+')');let checks=0;
const ok=(v,label)=>{assert.ok(v,label);checks++;};
const near=(a,b,eps=.00003)=>Math.abs(a-b)<=eps;
const asset=P('PLAYER3D_ASSET'),mesh=asset.meshes.helmet;
const p=mesh.positions,ix=mesh.indices;
const extrema=axis=>[Math.min(...p.filter((_,i)=>i%3===axis)),Math.max(...p.filter((_,i)=>i%3===axis))];
const [x0,x1]=extrema(0),[y0,y1]=extrema(1),[z0,z1]=extrema(2);
ok(z0>-.15,'helmet has no cloth skirt below the head center');
ok(z1>1.10&&z1<1.35,'helmet has a raised rigid crown');
ok(x1>1.30&&x1<1.5,'front brim projects along positive X');
ok(x0>-1.4&&x0<-1.1&&y0<-1.05&&y1>1.05,'shell retains the native compact helmet footprint');

// A forward ray from the eye-height face must pass through the actual mesh's
// brow opening. This catches a fully closed sphere even when its bounds fit.
function faceRayHits(){
 const origin=[.98,0,.10],direction=[1,0,0];
 const sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
 for(let i=0;i<ix.length;i+=3){
  const a=p.slice(ix[i]*3,ix[i]*3+3),b=p.slice(ix[i+1]*3,ix[i+1]*3+3),c=p.slice(ix[i+2]*3,ix[i+2]*3+3);
  const e1=sub(b,a),e2=sub(c,a),h=cross(direction,e2),det=dot(e1,h);if(Math.abs(det)<1e-9)continue;
  const s=sub(origin,a),u=dot(s,h)/det;if(u<-.00001||u>1.00001)continue;
  const q=cross(s,e1),v=dot(direction,q)/det;if(v<-.00001||u+v>1.00001)continue;
  if(dot(e2,q)/det>.0001)return true;
 }return false;
}
ok(!faceRayHits(),'face stays exposed below the brow in the actual exported geometry');

probe(`isStoryMode=false;townsData={};startAtLevel(2);started=doTick=true;
 isPaused=isDead=isWin=killcamMode=false;inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inCutscene=inOverworldView=false;
 window.inNM0SecretOverlay=false;buildGhost=null;setMeleeTool('NONE');
 chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
 leftStick={active:false,dx:0,dy:0};rightStick={active:true,dx:1,dy:0,dist:.4};
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;`);
function fresh(type,isPlayer,military,armor,stance,angle,hp=100){
 probe(`explosiveArmorUnlocked=${armor};ninjaSuitUnlocked=cowboySuitEquipped=false;
  player=new Character(120,160,${isPlayer},${JSON.stringify(type)});player.isMilitary=${military};player.hp=${hp};
  player.aimAngle=player.moveAngle=${angle};player.isMoving=false;player.gait=0;player.walkCycle=0;
  player.isArmed=true;player.currentWeapon=WEAPONS.PISTOL;player.aimHold=14;
  player.reloadTimer=player.meleeTimer=player.hitFlash=player.stunTimer=player.skeletonTimer=0;
  resetActorStance(player,${JSON.stringify(stance)});frameCount++;`);
 return P('player3DPose(player)');
}
const cases=[
 {label:'player armor',type:'NORMAL',player:true,military:false,armor:true,color:[74,85,74]},
 {label:'army helmet',type:'MILITARY_NEUTRAL',player:false,military:true,armor:false,color:[40,80,40]},
 {label:'tan military helmet',type:'MILITARY_NEUTRAL',player:false,military:false,armor:false,color:[190,170,130]},
 {label:'grey NM0 helmet',type:'NM0_GREY_FATIGUE',player:false,military:false,armor:false,color:[170,175,180]},
 {label:'city NM0 helmet',type:'NM0_CITY_GUARD',player:false,military:false,armor:false,color:[108,127,118]},
 {label:'heavy guard helmet',type:'ARMORED_STANDARD',player:false,military:false,armor:false,color:[43,49,58]}
];
for(const spec of cases)for(const stance of ['STAND','CROUCH'])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
 const pose=fresh(spec.type,spec.player,spec.military,spec.armor,stance,angle);
 const helmet=pose.parts.find(p=>p.mesh==='helmet'),head=pose.parts.find(p=>p.part==='head');
 const label=spec.label+'/'+stance+'/'+angle;
 ok(!!helmet&&!!head,label+' has a separate shell and round head');
 const h=head.matrix,m=helmet.matrix,r=Math.hypot(h[0],h[1],h[2]);
 ok([0,4,8].every(c=>near(Math.hypot(m[c],m[c+1],m[c+2]),r)),label+' shell scales uniformly to head radius');
 ok([12,13,14].every(c=>near(m[c],h[c])),label+' shell is centered on the head instead of floating over it');
 ok([0,1,2,4,5,6,8,9,10].every(c=>near(m[c],h[c])),label+' shell follows head turning and crouch orientation');
 ok(helmet.color.every((c,i)=>c===spec.color[i]),label+' keeps native helmet palette');
 ok((x1-x0)*r<16.1&&(y1-y0)*r<15,label+' stays within the native helmet footprint');
 ok(z0*r>-r*.16,label+' neck remains outside the shell');
 const before=P('JSON.stringify(player)');P('player3DPose(player)');
 ok(P('JSON.stringify(player)')===before,label+' posing does not change gameplay state');
 if(spec.player){
  const visor=pose.parts.find(p=>p.mesh==='visor');ok(!!visor,label+' preserves armor visor');
  const v=visor.matrix;
  ok(Math.hypot(v[8],v[9],v[10])<r*.75,label+' visor is a narrow brow window rather than a head wrap');
 }
}
for(const hp of [51,50,49])for(const military of [false,true]){
 const pose=fresh('ARMORED_STANDARD',false,military,military,'STAND',.7,hp);
 ok(pose.parts.some(p=>p.mesh==='helmet')===(hp>50),'heavy guard helmet damage threshold '+hp+'/'+military);
 if(hp<=50)ok(!pose.parts.some(p=>p.mesh==='visor'),'broken heavy guard helmet leaves no residual face shell '+hp+'/'+military);
}
fresh('NORMAL',true,false,false,'STAND',.4);
probe('ninjaSuitUnlocked=true;');
ok(P('player3DPose(player).parts.some(p=>p.mesh==="hood")'),'ninja hood remains its existing separate garment');
ok(!P('player3DPose(player).parts.some(p=>p.mesh==="helmet")'),'ninja hood does not become a military helmet');
console.log(checks+' helmet shell, exposed face/neck, mount, palette, orientation and damage checks passed');

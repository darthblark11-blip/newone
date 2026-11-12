// Round heads in arbitrary poses: geometry, proportions and true 3D scaling.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');let checks=0;
const ok=(condition,label)=>{assert.ok(condition,label);checks++;};
const asset=P('PLAYER3D_ASSET'),head=asset.meshes.head;
let maxRadius=0;
for(let i=0;i<head.positions.length;i+=3)maxRadius=Math.max(maxRadius,Math.hypot(...head.positions.slice(i,i+3)));
ok(maxRadius<=1.002,'head has no ears, nose, or other silhouette protrusions');
for(let axis=0;axis<3;axis++){
 const values=head.positions.filter((_,i)=>i%3===axis);
 ok(Math.abs(Math.min(...values)+1)<.002&&Math.abs(Math.max(...values)-1)<.002,'unit sphere bounds axis '+axis);
}
probe(`isStoryMode=false;townsData={};startAtLevel(2);started=doTick=true;
 isPaused=isDead=isWin=killcamMode=false;inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inCutscene=inOverworldView=false;
 window.inNM0SecretOverlay=false;buildGhost=null;setMeleeTool('NONE');
 chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
 leftStick={active:false,dx:0,dy:0};rightStick={active:true,dx:1,dy:0,dist:.4};
 player=new Character(120,160,true);player.isArmed=true;player.currentWeapon=WEAPONS.PISTOL;player.aimHold=14;
 player.reloadTimer=player.meleeTimer=player.hitFlash=player.stunTimer=player.skeletonTimer=0;
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;`);
function sphere(part,label){
 const m=part.matrix,axes=[[m[0],m[1],m[2]],[m[4],m[5],m[6]],[m[8],m[9],m[10]]],r=axes.map(v=>Math.hypot(...v));
 ok(r.every(Number.isFinite)&&r.every(v=>v>0),label+' positive finite radius');
 ok(Math.max(...r)-Math.min(...r)<.00002,label+' uniform XYZ scale prevents egg shape');
 for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)ok(Math.abs(axes[i].reduce((n,v,k)=>n+v*axes[j][k],0))<.0001,label+' orthogonal sphere axes');
}
for(const stance of ['STAND','CROUCH','PRONE'])for(const angle of [0,.8,Math.PI/2,Math.PI]){
 probe(`resetActorStance(player,${JSON.stringify(stance)});player.aimAngle=${angle};player.moveAngle=${angle+1};frameCount++;`);
 const pose=P('player3DPose(player)'),part=pose.parts.find(p=>p.part==='head');sphere(part,stance+'/'+angle);
 const r=Math.hypot(part.matrix[0],part.matrix[1],part.matrix[2]);
 ok(Math.abs(r-pose.pose.headProjectedDiameter*.5*1.1)<.00002,stance+' head is ten percent larger');
 ok(pose.worldOrigin.x===120&&pose.worldOrigin.y===160,'lighting snapshot retains true actor origin');
}
probe("resetActorStance(player,'STAND');boxingEnter(player,[],'WORLD');");
sphere(P('player3DPose(player).parts.find(p=>p.part==="head")'),'boxing');
probe('boxingExit(player);');
const draws=[];ctx.__headMesh=(snapshot)=>{draws.push(snapshot);return true;};
probe('Player3D.enabled=true;Player3D.ensure=()=>true;Player3D.draw=__headMesh;');
for(const type of [0,1,4,7,8,9,11,13,14])for(const progress of [0,.5,1]){
 draws.length=0;probe(`var headCorpse=new Corpse(120,160,0,.8,player.shirtCol,player.pantsCol,${type},0,[],player.currentWeapon,0,'NORMAL',21,27,player);
  headCorpse.fP=${progress};headCorpse.paint(window);`);
 for(const snapshot of draws)for(const part of snapshot.parts)if(part.mesh==='head'&&part.part!=='neck_cut')sphere(part,'corpse '+type+'/'+progress);
}
console.log(checks+' spherical head geometry, size, lighting origin and corpse checks passed');

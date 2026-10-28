// Cover hinges through the waist without changing the torso or bone lengths.
// Head, native guns and support mounts use one exact exposure offset; the
// chest articulates most of that lean while hips and feet remain planted.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
const near=(a,b)=>Math.abs(a-b)<1e-7;
ctx.setTimeout=()=>0;
probe(`resetRunState();started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 currentLevel=currentBiome=2;BIOME_ACTIVE=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 window.inNM0SecretOverlay=false;buildGhost=null;buildings=activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
 leftStick={active:false,dx:0,dy:0};rightStick={active:true,dx:1,dy:0,dist:.4};
 setMeleeTool('NONE');jetpackUnlocked=false;chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
 player=new Character(37,-19,true);player.isArmed=true;player.ammo=30;player.gait=0;player.walkCycle=0;
 player.reloadTimer=player.meleeTimer=player.dashTimer=player.muzzleFlash=0;`);
function pose(level,heading,leanX=0,leanY=0){
 probe(`resetActorStance(player);player.aimAngle=${heading+Math.PI*.6};player.moveAngle=${heading};player.isMoving=false;
 player.cover={active:true,kind:'LOW',blend:1,pop:${1-level},peek:1,validPeek:true,openAim:false,aiming:true,
 nx:${Math.cos(heading)},ny:${Math.sin(heading)},bodyAngle:${heading},offsetX:${leanX},offsetY:${leanY},upper:{x:${leanX},y:${leanY}}};`);
}
for(const level of [0,.5,1])for(let h=0;h<8;h++){
 const heading=h*Math.PI/4;pose(level,heading);
 const base=P('JSON.parse(JSON.stringify(stanceBodyPose(player)))');
 probe('player.cover.upper.x=player.cover.offsetX=13;player.cover.upper.y=player.cover.offsetY=-19;');
 const leaned=P('JSON.parse(JSON.stringify(stanceBodyPose(player)))');
 ok('cover hips and feet stay planted at level '+level+' heading '+h,
   JSON.stringify(leaned.joints.map(j=>[j.hip,j.knee,j.ankle]))===JSON.stringify(base.joints.map(j=>[j.hip,j.knee,j.ankle])));
 for(const [label,a,b] of [['chest',{x:base.chestX,y:base.chestY},{x:leaned.chestX,y:leaned.chestY}],['head',base.head,leaned.head],
   ['shoulder',base.joints[0].shoulder,leaned.joints[0].shoulder],['elbow',base.joints[1].elbow,leaned.joints[1].elbow]]){
  const dx=(b.x-a.x)*base.size,dy=(b.y-a.y)*base.size;
  ok(label+' follows its rigid waist articulation '+level+'/'+h,
    near(Math.cos(heading)*dx-Math.sin(heading)*dy,label==='chest'?13*.75:13)&&near(Math.sin(heading)*dx+Math.cos(heading)*dy,label==='chest'?-19*.75:-19));
 }
}
for(const key of ['PISTOL','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','BOW','REVOLVER','COACH_GUN','TASER'])for(let h=0;h<8;h++){
 const heading=h*Math.PI/4;pose(0,heading);probe(`player.currentWeapon=WEAPONS.${key};`);
 const base=P(`({main:stanceMuzzleWorld(player,player.x+31,player.y+8),support:leftActionMuzzle(player,player.aimAngle),ui:actorStanceUIAnchor(player)})`);
 probe('player.cover.upper.x=player.cover.offsetX=-11;player.cover.upper.y=player.cover.offsetY=17;');
 const shifted=P(`({main:stanceMuzzleWorld(player,player.x+31,player.y+8),support:leftActionMuzzle(player,player.aimAngle),ui:actorStanceUIAnchor(player)})`);
 ok(key+' muzzle, support hand and labels share the same world shift '+h,
   ['main','support','ui'].every(k=>near(shifted[k].x-base[k].x,-11)&&near(shifted[k].y-base[k].y,17)));
}
pose(0,Math.PI);probe('player.cover.kind="HIGH";player.cover.aiming=false;player.cover.peek=0;');
ok('closed wall aim carries the weapon in the outward cover frame',near(P('stanceWeaponMount(player).angle+player.aimAngle'),Math.PI-.25));
pose(0,0);probe('player.isMoving=true;player.moveAngle=Math.PI/2;player.gait=1;');
const shuffles=[];
for(const phase of [0,Math.PI/2,Math.PI,Math.PI*1.5]){probe('player.walkCycle='+phase+';');shuffles.push(P('stanceBodyPose(player).joints.map(j=>({hip:j.hip,knee:j.knee,ankle:j.ankle}))'));}
ok('a lateral wall shuffle steps along the wall while keeping the knees forward',
 shuffles.some((a,i)=>i&&Math.abs(a[0].ankle.y-shuffles[0][0].ankle.y)>1)&&shuffles.every(a=>a.every(j=>j.knee.x>j.hip.x&&j.ankle.x>j.knee.x)));

// A wall's outward hemisphere includes both exact tangents. These poses used
// to leave shoulders halfway behind the gun, pulling the arms out of shape.
for(const kind of ['HIGH','LOW'])for(const level of kind==='HIGH'?[0]:[0,.5,1])
 for(const delta of [-Math.PI/2,-Math.PI/4,0,Math.PI/4,Math.PI/2]){
  pose(level,.7);probe(`player.cover.kind='${kind}';player.aimAngle=.7+${delta};player.currentWeapon=WEAPONS.PISTOL;`);
  const body=P('stanceBodyPose(player)');
  ok(kind+' torso follows complete outward firing arc '+level+'/'+delta,near(body.yaw,delta));
  ok(kind+' has the native rigid shirt dimensions '+level+'/'+delta,
    near(body.torsoLength,P('player.bodyW*TORSO_DEPTH'))&&near(body.torsoWidth,P('player.bodyH')*(1-.10*level)));
  const head=P('stanceHeadLocal(player)');
  ok(kind+' head and collar turn together '+level+'/'+delta,Number.isFinite(head.x)&&Number.isFinite(head.y)&&
    Math.hypot(head.x-body.chestX*body.size,head.y-body.chestY*body.size)<P('player.bodyH')*.65);
  for(const key of ['PISTOL','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN']){
   probe(`player.currentWeapon=WEAPONS.${key};`);
   const bounded=P(`(()=>{
    const b=stanceBodyPose(player),long=player.currentWeapon===WEAPONS.ASSAULT_RIFLE||player.currentWeapon===WEAPONS.SHOTGUN?stanceLongGunPose(player):null;
    const dual=player.currentWeapon===WEAPONS.DUAL_SMG;
    const wrists=[stancePointInBody(player,long?long.fore[0]:dual?22:27,long?long.fore[1]:dual?-11:1),
      stancePointInBody(player,long?long.rear[0]:player.currentWeapon===WEAPONS.PISTOL?16:22,long?long.rear[1]:player.currentWeapon===WEAPONS.PISTOL?8:11)];
    return b.joints.every((j,i)=>{
      if(!i&&!long&&!dual)return true;
      const h={x:wrists[i].x/b.size,y:wrists[i].y/b.size},e=stanceArmElbow(b,j,h.x,h.y);
      return Math.hypot(e.x-j.shoulder.x,e.y-j.shoulder.y)<=b.R.upper+.05&&Math.hypot(e.x-h.x,e.y-h.y)<=b.R.fore+.05;
    });
   })()`);
   ok(kind+' '+key+' keeps both projected arm bones within native reach '+level+'/'+delta,bounded);
  }
 }

// The body is still rigid at the maximum supported edge lean. Arms/head
// remain attached to their real weapon mounts while the waist stays planted.
for(const lean of [-22,22]){
 pose(0,0,0,lean);probe('player.cover.kind="HIGH";player.aimAngle=Math.PI/2;');
 const b=P('stanceBodyPose(player)');
 ok('maximum lateral peek keeps its native rigid shirt '+lean,near(b.torsoLength,P('player.bodyW*TORSO_DEPTH'))&&near(b.torsoWidth,P('player.bodyH')));
 ok('maximum lateral peek keeps head connected to the rigid torso '+lean,
  Math.hypot(b.head.x-b.chestX,b.head.y-b.chestY)<P('player.bodyH')*.6);
}
// A stance change must not choose the other intersection of the arm circles.
// Both intersections are valid lengths, but switching sides makes the elbow pop.
for(const key of ['PISTOL','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN']){
 let previous=null,maxStep=0;
 for(let i=0;i<=100;i++){
  pose(i/100,.7);probe(`player.currentWeapon=WEAPONS.${key};player.aimAngle=.7+Math.PI/2;`);
  const elbows=P(`(()=>{const b=stanceBodyPose(player),long=player.currentWeapon===WEAPONS.ASSAULT_RIFLE||player.currentWeapon===WEAPONS.SHOTGUN,l=long?stanceLongGunPose(player):null;
   return b.joints.map((j,n)=>{const p=stancePointInBody(player,long?(n?l.rear[0]:l.fore[0]):n?(player.currentWeapon===WEAPONS.PISTOL?16:22):22,
    long?(n?l.rear[1]:l.fore[1]):n?(player.currentWeapon===WEAPONS.PISTOL?8:11):-11);return stanceArmElbow(b,j,p.x/b.size,p.y/b.size);});})()`);
  if(previous)for(let n=0;n<2;n++)maxStep=Math.max(maxStep,Math.hypot(elbows[n].x-previous[n].x,elbows[n].y-previous[n].y));
  previous=elbows;
 }
 ok(key+' elbow path stays continuous throughout low-cover pop and duck',maxStep<.5);
}

pose(0,Math.PI);probe('player.cover.upper.y=player.cover.offsetY=19;');
const frozen=P('JSON.stringify(player.cover)');
probe('stanceBodyPose(player);stanceWeaponMount(player);stanceHeadLocal(player);actorStanceUIAnchor(player);');
ok('pose and muzzle queries do not advance the cover controller',P('JSON.stringify(player.cover)')===frozen);
let depth=0,minDepth=0;ctx.push=()=>{depth++;};ctx.pop=()=>{depth--;minDepth=Math.min(minDepth,depth);};
for(const level of [0,.5,1])for(const key of ['PISTOL','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN']){
 pose(level,Math.PI,0,19);probe(`player.currentWeapon=WEAPONS.${key};player.show();`);
 ok('native '+key+' cover painter balances canvas state at '+level,depth===0&&minDepth===0);
}
console.log(`${checks}/${checks} cover upper-chain, planted legs, native weapon, shuffle and painter checks passed.`);

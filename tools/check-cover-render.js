// Cover moves only the upper chain. Native gun, support hand, contacts and UI
// must use that same offset while the hips and feet remain planted.
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
  ok(label+' follows the world upper-body offset '+level+'/'+h,
    near(Math.cos(heading)*dx-Math.sin(heading)*dy,13)&&near(Math.sin(heading)*dx+Math.cos(heading)*dy,-19));
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

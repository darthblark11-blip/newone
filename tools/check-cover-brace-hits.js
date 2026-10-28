// A braced boot belongs to the canonical figure, including when it moves
// beyond the old root circle. Closed geometry must still protect its legs;
// the air gap between them must remain a miss.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
function fresh(face=0,side=1){
 const angle=face*Math.PI/2,nx=Math.round(Math.cos(angle)),ny=Math.round(Math.sin(angle)),tx=-ny,ty=nx;
 probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 inOverworldView=false;window.inNM0SecretOverlay=false;buildGhost=null;
 viewLeft=viewTop=-10000;viewRight=viewBottom=10000;frameCount=100;MAX_KILLS=100000;totalKills=0;
 bullets=[];particles=[];corpses=[];barrels=[];parkingCars=activeParkingCars=[];resetForestWildlife();
 setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 player=new Character(-1000,-1000,true);player.hp=1000;player.shield=0;
 window.braceVictim=new Character(${nx*28+tx*side*71},${ny*28+ty*side*71},false,'NORMAL');
 braceVictim.hp=braceVictim.maxHp=1000;braceVictim.isFriendly=braceVictim.isNeutral=false;
 braceVictim.aimAngle=${Math.atan2(-ny+side*ty*1.2,-nx+side*tx*1.2)};
 braceVictim.moveAngle=${angle};braceVictim.isMoving=false;braceVictim.gait=braceVictim.walkCycle=0;
 resetActorStance(braceVictim);braceVictim.cover={active:true,kind:'HIGH',blend:1,pop:0,peek:1,
 nx:${nx},ny:${ny},tx:${tx},ty:${ty},bodyAngle:${angle},aiming:true,validPeek:true,
 offsetX:${tx*side*22},offsetY:${ty*side*22},upper:{x:${tx*side*22},y:${ty*side*22}}};
 enemiesList=[braceVictim];window.braceWall={x:0,y:0,w:${nx?20:160},h:${nx?160:20},isWall:true};
 buildings=activeBuildings=[braceWall];invalidateColIndex();
 window.braceNormal={x:${nx},y:${ny}};
 window.braceOuter=${side>0?1:0};
 window.braceFoot=index=>{const pose=stanceBodyPose(braceVictim),j=pose.joints[index],
 a=Math.atan2(j.ankle.y-j.knee.y,j.ankle.x-j.knee.x),
 x=j.ankle.x+Math.cos(a)*1.5,y=j.ankle.y+Math.sin(a)*1.5,
 ca=Math.cos(stanceFacingAngle(braceVictim)),sa=Math.sin(stanceFacingAngle(braceVictim));
 return {x:braceVictim.x+(ca*x-sa*y)*pose.size,y:braceVictim.y+(sa*x+ca*y)*pose.size};};
 window.braceRay=(point,fromSide=1)=>{const n=braceNormal;
 const b=spawnBullet(point.x+n.x*40*fromSide,point.y+n.y*40*fromSide,
 Math.atan2(-n.y*fromSide,-n.x*fromSide),true,'LEGS',WEAPONS.PISTOL,player);
 b.vx=-n.x*80*fromSide;b.vy=-n.y*80*fromSide;
 b.x+=b.vx;b.y+=b.vy;return b;};`);
}
for(let face=0;face<4;face++)for(const side of [-1,1]){
 fresh(face,side);
 probe('window.braceShot=braceRay(braceFoot(braceOuter));');
 ok('the outside boot extends beyond the former root circle '+face+'/'+side,
  P('forestShotCircleTime(braceShot,braceVictim.x,braceVictim.y,12)===Infinity'));
 ok('the visible braced outside boot receives a physical contact '+face+'/'+side,
  P('Number.isFinite(stanceProjectileContact(braceShot,braceVictim))'));
 probe('window.innerShot=braceRay(braceFoot(1-braceOuter),-1);');
 ok('the wall still protects its planted inside leg '+face+'/'+side,
  P('stanceProjectileContact(innerShot,braceVictim)===Infinity'));
 probe('window.centerShot=braceRay(braceVictim);');
 ok('low centerline aiming passes through the gap between the braced legs '+face+'/'+side,
  P('stanceProjectileContact(centerShot,braceVictim)===Infinity'));
 probe('window.closedShot=braceRay(braceVictim,-1);');
 ok('the same pelvis stays protected behind the wall '+face+'/'+side,
  P('stanceProjectileContact(closedShot,braceVictim)===Infinity'));
 probe(`window.emptyBraceShot=spawnBullet(braceVictim.x-braceNormal.x*11-braceNormal.y,
 braceVictim.y-braceNormal.y*11+braceNormal.x,0,true,'LEGS',WEAPONS.PISTOL,player);
 emptyBraceShot.x+=braceNormal.y*2;emptyBraceShot.y-=braceNormal.x*2;`);
 ok('empty floor behind the actual trousers is not the former oversized root target '+face+'/'+side,
  P('forestShotCircleTime(emptyBraceShot,braceVictim.x,braceVictim.y,12)!==Infinity&&stanceProjectileContact(emptyBraceShot,braceVictim)===Infinity'));

 // Use the complete native pipeline for the actual exposed boot and wound.
 fresh(face,side);probe(`window.boot=braceFoot(braceOuter);
 window.nativeBraceShot=spawnBullet(boot.x+braceNormal.x*40,boot.y+braceNormal.y*40,
 Math.atan2(-braceNormal.y,-braceNormal.x),true,'LEGS',WEAPONS.PISTOL,player);
 nativeBraceShot.vx=-braceNormal.x*80;nativeBraceShot.vy=-braceNormal.y*80;frameCount++;updateBullets();`);
 ok('real bullets damage the exposed boot and retain its leg-local wound '+face+'/'+side,
  P('braceVictim.hp===980&&braceVictim.decals.length===1&&braceVictim.decals[0].isLeg&&braceVictim.decals[0].legIndex===braceOuter'));
}

fresh();probe('buildings=activeBuildings=[];invalidateColIndex();');
for(const stance of ['STAND','CROUCH','PRONE']){
 probe(`resetActorStance(braceVictim,'${stance}');`);
 ok('ordinary '+stance+' retains its low shot damage mapping',
  P(`stanceHitProfile(braceVictim,'LEGS').zone==='${stance==='STAND'?'LEGS':stance==='CROUCH'?'BODY':'HEAD'}'`));
}
for(const pop of [0,.5,1]){
 probe(`resetActorStance(braceVictim);braceVictim.cover={active:true,kind:'LOW',blend:1,pop:${pop},bodyAngle:0,aiming:true,upper:{x:0,y:0}};
 window.lowShot=braceRay(braceVictim);stanceProjectileContact(lowShot,braceVictim);`);
 ok('LOW cover contacts retain crouch/pop remapping at '+pop,
  P(`stanceHitProfile(braceVictim,'LEGS').zone==='${pop<=.5?'BODY':'LEGS'}'`));
}
probe('resetActorStance(braceVictim);braceVictim.cover={active:true,kind:"HIGH",blend:1,pop:0,bodyAngle:0,aiming:true,upper:{x:0,y:22}};');
for(const zone of ['HEAD','BODY']){
 probe(`window.upperShot=braceRay(coverActorHitCenter(braceVictim,'${zone}'));upperShot.tH='${zone}';`);
 ok(zone+' keeps the existing upper-body contact path',P('Number.isFinite(stanceProjectileContact(upperShot,braceVictim))'));
}
console.log(`${checks}/${checks} canonical standing brace, boot, empty gap, wall protection and leg-wound checks passed.`);

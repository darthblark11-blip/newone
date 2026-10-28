// Injury figures share their actual articulated anatomy and weapon transform
// with hit mapping. Paint may fill finite caches, but must not tick simulation.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,depth=0,minDepth=0,matrix=[1,0,0,1,0,0],stack=[],flashes=[];
const ok=(label,value)=>{assert.ok(value,label);checks++;};
const near=(a,b)=>Math.abs(a-b)<1e-7;
ctx.setTimeout=()=>0;
ctx.figurePainter=()=>null;
const apply=(x,y)=>({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]});
ctx.push=()=>{depth++;stack.push(matrix.slice());};
ctx.pop=()=>{depth--;minDepth=Math.min(minDepth,depth);matrix=stack.pop()||matrix;};
ctx.translate=(x,y)=>{matrix[4]+=matrix[0]*x+matrix[2]*y;matrix[5]+=matrix[1]*x+matrix[3]*y;};
ctx.rotate=a=>{const [a0,a1,a2,a3]=matrix,co=Math.cos(a),si=Math.sin(a);
  matrix[0]=a0*co+a2*si;matrix[1]=a1*co+a3*si;matrix[2]=-a0*si+a2*co;matrix[3]=-a1*si+a3*co;};
ctx.scale=(x,y=x)=>{matrix[0]*=x;matrix[1]*=x;matrix[2]*=y;matrix[3]*=y;};
ctx.triangle=(x,y,x2,y2,x3,y3)=>{
  if(near(x,x3)&&near(y3-y,6)&&near(x2-x,15))flashes.push(apply(x,(y+y3)*.5));
};
probe(`currentLevel=currentBiome=2;BIOME_ACTIVE=false;isStoryMode=false;started=doTick=true;
  isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
  inOverworldView=false;window.inNM0SecretOverlay=false;buildGhost=null;
  buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];invalidateColIndex();
  leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
  jetpackUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=false;setMeleeTool('NONE');
  player=new Character(2000,2000,true);viewLeft=viewTop=-10000;viewRight=viewBottom=10000;`);
function actor(outcome,leg,moving,weapon,phase,progress,angle){
  probe(`frameCount++;window.e=new Character(70,90,false,'NORMAL');e.hp=e.maxHp=1000;e.isArmed=true;
    e.currentWeapon=WEAPONS.${weapon};e.moveAngle=e.aimAngle=-Math.PI/2;e.walkCycle=1.8;e.gait=${moving?.8:0};e.isMoving=${moving};
    rememberFigureMotion(e,0,${moving?-4:0});resetActorStance(e);legInjurySerial=${outcome};
    if(!beginLegInjury(e,{a:-Math.PI/2},${leg}))throw Error('fixture rejected');
    e.legInjury.phase='${phase}';e.legInjury.phaseMs=${progress}*('${phase}'==='FALL'?e.legInjury.fallMs:LEG_INJURY_RECOVER_MS);
    e.legInjury.ageMs=1200+e.legInjury.phaseMs;e.aimAngle=${angle};legInjurySetHeight(e);
    e.fireTimer=0;e.reloadTimer=0;e.ammo=30;e.muzzleFlash=3;e.weaponKick=0;e.hitFlash=3;
    e.decals=[{isLeg:true,legIndex:${leg},legSegment:1,legU:.7,legV:.1,sz:4,col:[90,0,0,220]}];`);
}
for(const outcome of [0,1])for(const phase of ['FALL',outcome?'SEATED':'PRONE','RECOVER'])
  for(const leg of [0,1])for(const weapon of ['PISTOL','ASSAULT_RIFLE'])for(let direction=0;direction<8;direction++){
    const label=`${outcome}/${phase}/leg${leg}/${weapon}/${direction}`;
    actor(outcome,leg,direction%2===0,weapon,phase,.5,direction*Math.PI/4);
    const before=P('JSON.stringify({injury:e.legInjury,stance:e.stance,decals:e.decals,hp:e.hp,hitFlash:e.hitFlash,flash:e.muzzleFlash,fire:e.fireTimer})');
    flashes=[];probe('e.show();e.show();');
    ok(`${label} native figure balances its transforms`,depth===0&&minDepth===0&&stack.length===0);
    ok(`${label} paint does not advance injury/combat/wounds`,before===P('JSON.stringify({injury:e.legInjury,stance:e.stance,decals:e.decals,hp:e.hp,hitFlash:e.hitFlash,flash:e.muzzleFlash,fire:e.fireTimer})'));
    ok(`${label} all articulated landmarks are finite`,P('stanceBodyPose(e).joints.every(j=>[j.hip,j.knee,j.ankle,j.shoulder,j.elbow].every(p=>Number.isFinite(p.x+p.y)))'));
    const mx=weapon==='PISTOL'?31:47,my=weapon==='PISTOL'?8:6;
    probe(`window.renderMuzzle=stanceMuzzleWorld(e,e.x+Math.cos(e.aimAngle)*${mx}-Math.sin(e.aimAngle)*${my},e.y+Math.sin(e.aimAngle)*${mx}+Math.cos(e.aimAngle)*${my});`);
    const expected=P('renderMuzzle');
    ok(`${label} rendered flash matches the physical barrel`,flashes.length===2&&flashes.every(p=>near(p.x,expected.x)&&near(p.y,expected.y)));
    probe(`bullets=[];e.fire(e.aimAngle);`);
    ok(`${label} native shot starts at that same barrel`,P('bullets.length>0&&Math.abs(bullets[0].startX-renderMuzzle.x)<1e-7&&Math.abs(bullets[0].startY-renderMuzzle.y)<1e-7'));
  }
// A moving fall returns to a planted stance at the actor's current aim, not
// to the old frame of running captured several seconds earlier.
for(const weapon of ['PISTOL','ASSAULT_RIFLE'])for(const outcome of [0,1])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  actor(outcome,1,true,weapon,'RECOVER',1,angle);
  probe('window.finalInjury=stanceBodyPose(e);window.finalHead={x:finalInjury.head.x*finalInjury.size,y:finalInjury.head.y*finalInjury.size};window.finalFacing=stanceFacingAngle(e);');
  const h=P('({x:Math.cos(finalFacing)*finalHead.x-Math.sin(finalFacing)*finalHead.y,y:Math.sin(finalFacing)*finalHead.x+Math.cos(finalFacing)*finalHead.y})');
  const legs=P('finalInjury.joints.map(j=>({hip:j.hip,knee:j.knee,ankle:j.ankle}))');
  probe('finishLegInjury(e);window.standingLegs=humanLegHitGeometry(e);window.standingHead=stanceHeadLocal(e);window.standingFacing=stanceFacingAngle(e);');
  const normalHead=P('({x:Math.cos(standingFacing)*standingHead.x-Math.sin(standingFacing)*standingHead.y,y:Math.sin(standingFacing)*standingHead.x+Math.cos(standingFacing)*standingHead.y})');
  ok(`${weapon}/${outcome}/${angle} final recovery head meets the native standing anchor`,near(h.x,normalHead.x)&&near(h.y,normalHead.y));
  const normal=P('standingLegs'),beforeFacing=P('finalFacing');
  const world=(p,a,scale)=>({x:(Math.cos(a)*p.x-Math.sin(a)*p.y)*scale,y:(Math.sin(a)*p.x+Math.cos(a)*p.y)*scale});
  for(let i=0;i<2;i++)for(const [name,x,y]of [['hip','sx','sy'],['knee','kx','ky'],['ankle','ax','ay']]){
    const old=world(legs[i][name],beforeFacing,1),target=world({x:normal.legs[i][x],y:normal.legs[i][y]},normal.angle,normal.scale);
    ok(`${weapon}/${outcome}/${angle} recovery leg${i}/${name} meets its planted standing joint`,near(old.x,target.x)&&near(old.y,target.y));
  }
}
console.log(`${checks}/${checks} leg-injury native anatomy, render purity, muzzle alignment and recovery checks passed.`);

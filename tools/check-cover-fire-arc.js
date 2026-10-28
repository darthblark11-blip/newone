// Cover keeps the full outward half-circle usable. Sweep the actual posed
// muzzles, then fire native rounds at both tangent endpoints on every face.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,directions=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;ctx.navigator.getGamepads=()=>[];
probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 inOverworldView=false;window.inNM0SecretOverlay=false;buildGhost=null;
 parkingCars=activeParkingCars=[];barrels=[];bullets=[];particles=[];enemiesList=[];
 setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;jetpackUnlocked=false;
 leftStick={active:false,dx:0,dy:0};rightStick={active:true,dx:1,dy:0,dist:.4};
 frameCount=100;deltaTime=1000/60;
 window.arcFixture=(kind,quarter)=>{
  const angle=quarter*Math.PI/2,nx=Math.cos(angle),ny=Math.sin(angle);
  window.arcNormal={angle,nx,ny};
  window.arcWall={x:-nx*40,y:-ny*40,w:quarter%2?160:20,h:quarter%2?20:160,
    isWall:kind==='HIGH',isCrateProp:kind==='LOW'};
  buildings=activeBuildings=[arcWall];invalidateColIndex();
  player=new Character(-nx*15,-ny*15,true);player.isArmed=true;player.ammo=30;
  player.currentWeapon=WEAPONS.PISTOL;player.aimAngle=angle;player.gait=0;
  resetActorStance(player);
  for(let i=0;i<20;i++){frameCount++;updateActorCover(player,1000/60,-nx*6,-ny*6,true);}
 };`);
const weapons=['PISTOL','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','REVOLVER','TASER','BOW'];
for(const kind of ['HIGH','LOW'])for(let q=0;q<4;q++){
 probe(`arcFixture('${kind}',${q});`);
 ok(kind+' actually acquires face '+q,P(`player.cover?.active&&player.cover.kind==='${kind}'`));
 for(const weapon of weapons){
  probe(`player.currentWeapon=WEAPONS.${weapon};`);
  const failures=P(`(()=>{
   const failures=[];
   for(let degree=-90;degree<=90;degree++){
    player.aimAngle=arcNormal.angle+degree*Math.PI/180;
    player.isMoving=false;frameCount++;updateActorCover(player,1000/60,0,0,true);
    if(!coverFireAllowed(player))failures.push(degree);
   }
   return failures;
  })()`);
  directions+=181;
  ok(kind+' '+weapon+' has no missing side angles on face '+q+'; blocked: '+failures.join(','),failures.length===0);
  for(const side of [-1,1]){
   probe(`player.aimAngle=arcNormal.angle+${side}*Math.PI/2;
    player.isMoving=true;player.gait=1;player.walkCycle=1.7;player.moveAngle=arcNormal.angle+Math.PI/2;
    frameCount++;updateActorCover(player,1000/60,0,0,true);`);
   ok(kind+' '+weapon+' wall shuffle retains exact tangent aim '+q+'/'+side,P('coverFireAllowed(player)'));
   ok(kind+' '+weapon+' actual tangent muzzles clear the wall '+q+'/'+side,P(`coverWeaponMuzzles(player).every(m=>{
    const ca=Math.cos(player.aimAngle),sa=Math.sin(player.aimAngle),u=coverUpperOffset(player);
    const p=stanceMuzzleWorld(player,player.x+ca*m[0]-sa*m[1],player.y+sa*m[0]+ca*m[1]);
    return coverLineClear(player.x+u.x,player.y+u.y,p.x,p.y,'BODY',player)&&
      coverLineClear(p.x,p.y,p.x+ca*64,p.y+sa*64,'BODY',player);
   })`));
  }
 }
 // A release retracts LOW cover, while HIGH cover stays tall. Neither grants
 // permission to fire back through a sealed wall at the midpoint.
 probe(`player.currentWeapon=WEAPONS.PISTOL;player.isMoving=false;
  player.aimAngle=arcNormal.angle+Math.PI;
  for(let i=0;i<20;i++){frameCount++;updateActorCover(player,1000/60,0,0,true);}`);
 if(kind==='HIGH')ok('a sealed midpoint still rejects inward fire on face '+q,!P('coverFireAllowed(player)'));
 probe(`for(let i=0;i<20;i++){frameCount++;updateActorCover(player,1000/60,0,0,false);}`);
 ok(kind+' release uses its distinct standing/crouched posture on face '+q,
  P(`actorStance(player)==='${kind==='HIGH'?'STAND':'CROUCH'}'`));
}
// Exercise fire(), pooled origins and the actual bullet heading at both end
// angles, not just the geometry permission query above.
for(let q=0;q<4;q++)for(const side of [-1,1]){
 probe(`arcFixture('HIGH',${q});player.aimAngle=arcNormal.angle+${side}*Math.PI/2;
  for(let i=0;i<20;i++){frameCount++;updateActorCover(player,1000/60,0,0,true);}
  player.isMoving=false;player.fireTimer=player.reloadTimer=0;player.ammo=17;bullets=[];
  player.fire(player.aimAngle);`);
 ok('native tangent shot consumes one cartridge '+q+'/'+side,P('player.ammo===16&&bullets.length===1'));
 ok('native tangent shot keeps its true heading and posed muzzle '+q+'/'+side,P(`(()=>{
  const b=bullets[0],ca=Math.cos(player.aimAngle),sa=Math.sin(player.aimAngle);
  const m=stanceMuzzleWorld(player,player.x+ca*31-sa*8,player.y+sa*31+ca*8);
  return Math.abs(Math.atan2(Math.sin(b.a-player.aimAngle),Math.cos(b.a-player.aimAngle)))<1e-8&&
    Math.hypot(b.startX-m.x,b.startY-m.y)<1e-8;
 })()`));
}
console.log(`${checks}/${checks} complete cover firing arc, native tangent shot and distinct posture checks passed (${directions} aim directions).`);

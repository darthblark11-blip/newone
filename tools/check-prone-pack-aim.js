// Real pack surfaces must remain opaque and visible while rolling, and the
// rear-facing pistol must be held by a reachable arm above the abdomen.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 currentLevel=currentBiome=2;BIOME_ACTIVE=false;resetUndergroundRoute();
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
 inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;window.inNM0SecretOverlay=false;
 buildings=activeBuildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:-1,dist:0};
 setMeleeTool('NONE');jetpackUnlocked=true;
 ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
 player=new Character(0,0,true);player.aimAngle=-Math.PI/2;
 player.isArmed=true;player.currentWeapon=WEAPONS.PISTOL;player.aimHold=14;
 player.meleeTimer=player.reloadTimer=player.weaponKick=player.muzzleFlash=0;
 resetActorStance(player,'PRONE');player.stance.proneAimBlend=1;`);
const area=points=>Math.abs(points.reduce((sum,p,i)=>{
 const q=points[(i+1)%points.length];return sum+p.x*q.y-p.y*q.x;
},0))*.5;
let solids=true,opaque=true,smooth=true,drives=true,previous=null,minArea=Infinity;
const painted=[],fills=[],g={};
for(const key of ['push','pop','stroke','strokeWeight','noStroke'])g[key]=()=>{};
g.fill=(...args)=>fills.push(args);g.quad=(...args)=>painted.push(args);
ctx.__packPaint=g;
for(let i=0;i<=160;i++){
 const delta=-Math.PI+i*Math.PI/80;
 probe(`player.aimAngle=stanceFacingAngle(player)+${delta};`);
 const mesh=P('stanceDashPackMesh(stanceBodyPose(player))');
 const total=mesh.faces.reduce((sum,f)=>sum+area(f.points),0);minArea=Math.min(minArea,total);
 solids&&=mesh.faces.length>=5&&Object.values(mesh.bounds).every(Number.isFinite)&&total>100;
 drives&&=mesh.faces.some(f=>f.name==='drive')&&mesh.faces.some(f=>f.name==='exhaust');
 if(previous)smooth&&=Object.keys(mesh.bounds).every(key=>Math.abs(mesh.bounds[key]-previous[key])<1);
 previous=mesh.bounds;painted.length=fills.length=0;
 probe("drawStanceDashPack(__packPaint,player,stanceBodyPose(player),'UNDER');drawStanceDashPack(__packPaint,player,stanceBodyPose(player),'OVER');");
 opaque&&=painted.length===mesh.faces.length&&fills.every(fill=>fill.length===3);
}
ok('the pack retains projected solid area through both side and rear rolls',solids&&minArea>100);
ok('both rolled drive shells and exhaust collars remain rendered',drives);
ok('pack silhouettes change continuously through the full aim sweep',smooth);
ok('depth passes paint every visible pack surface once at full opacity',opaque);
probe('player.aimAngle=stanceFacingAngle(player);');
const belly=P('stanceDashPackMesh(stanceBodyPose(player))');
probe('player.aimAngle=stanceFacingAngle(player)+Math.PI;');
const back=P('({mesh:stanceDashPackMesh(stanceBodyPose(player)),body:stanceBodyPose(player)})');
ok('belly-down pack surfaces lie above the torso and supine surfaces underneath',
 belly.above&&!belly.below&&!back.mesh.above&&back.mesh.below);
ok('the supine torso leaves the outboard engines visible along both sides',
 back.mesh.bounds.minY<-back.body.torsoWidth*.5-2&&back.mesh.bounds.maxY>back.body.torsoWidth*.5+2);
const sleeve=ctx.drawCombatStanceSleeve,body=ctx.drawCombatStanceBody,gun=ctx.carryHandGun;
let arms=[],order=[];
ctx.drawCombatStanceSleeve=(...args)=>{arms.push(args);order.push('arm');return sleeve(...args);};
ctx.drawCombatStanceBody=(...args)=>{order.push('body');return body(...args);};
ctx.carryHandGun=(...args)=>{order.push('gun');return gun(...args);};
try{
 for(const key of ['PISTOL','SMG','REVOLVER']){
  probe(`player.currentWeapon=WEAPONS.${key};`);arms=[];order=[];probe('player.show();');
  const b=P('stanceBodyPose(player)'),right=arms[1],hand={x:right[5],y:right[6]};
  const upper=Math.hypot(right[3]-right[1],right[4]-right[2]);
  const fore=Math.hypot(hand.x-right[3],hand.y-right[4]);
  ok(key+' extends the firing wrist south beyond the pelvis',hand.x<b.hipX-3);
  ok(key+' keeps the extended arm within its native bone lengths',upper<=b.R.upper*1.02&&fore<=b.R.fore*1.02);
  ok(key+' paints the reaching arm above the supine torso and below the gun',
   order.indexOf('body')<order.indexOf('arm')&&order.lastIndexOf('arm')<order.indexOf('gun'));
 }
}finally{ctx.drawCombatStanceSleeve=sleeve;ctx.drawCombatStanceBody=body;ctx.carryHandGun=gun;delete ctx.__packPaint;}
console.log(`${checks}/${checks} prone pack projection, opacity, visibility and rear arm checks passed`);

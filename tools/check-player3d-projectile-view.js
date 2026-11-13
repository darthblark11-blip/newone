// Exercise the actual Canvas projectile painters and compare them with the
// muzzle's mesh socket, while asserting that flight/contact state stays native.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
if(!P("typeof Player3DView!=='undefined'"))probe('window.Player3DView=(()=>{'+fs.readFileSync(path.join(__dirname,'player3d/view.js'),'utf8')+';return Player3DView;})()');
let checks=0,cases=0,maxMuzzleError=0;
const ok=(v,label)=>{assert.ok(v,label);checks++;};
const close=(a,b,label,tolerance=.0001)=>{const error=Math.hypot(a.x-b.x,a.y-b.y);ok(error<tolerance,label+' error '+error);return error;};
const canvas={width:1000,height:700};let matrix={a:1.3,b:0,c:0,d:1.3,e:100,f:50};
ctx.drawingContext.canvas=canvas;ctx.drawingContext.getTransform=()=>matrix;
ctx.setTimeout=()=>0;
probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
 inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
 currentLevel=currentBiome=2;BIOME_ACTIVE=false;isStoryMode=false;window.inNM0SecretOverlay=false;
 buildGhost=null;resetUndergroundRoute();resetShovelState();setMeleeTool('NONE');
 chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
 isCooking=meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;
 leftStick={active:false,dx:0,dy:0,dist:0};rightStick={active:true,dx:1,dy:0,dist:1};
 buildings=activeBuildings=[];barrels=[];activeParkingCars=[];enemiesList=[];bullets=[];
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;Player3D.enabled=true;`);
function fresh({weapon='PISTOL',stance='STAND',presentation=1,angle=.7,enemy=false,zone='BODY',jetpack=0}={}){
 probe(`player=new Character(760,220,true);shooter=${enemy?"new Character(760,220,false,'NORMAL')":"player"};
  shooter.aimAngle=${angle};shooter.moveAngle=${angle+1.2};shooter.currentWeapon=WEAPONS[${JSON.stringify(weapon)}];
  shooter.isArmed=${!enemy};shooter.gait=.7;shooter.walkCycle=1.1;shooter.isMoving=true;
  shooter.jetpackHeight=${jetpack};shooter.aimHold=14;shooter._weaponPresentation=${enemy?'null':'{value:'+presentation+',velocity:0}'};
  shooter.meleeTimer=shooter.reloadTimer=shooter.weaponKick=shooter.hitFlash=0;
  resetActorStance(shooter,${JSON.stringify(stance)});if(shooter.stance)shooter.stance.proneAimBlend=1;
  frameCount+=1;launchMuzzle=aimLaserMuzzle(shooter);round=new Bullet();
  round.init(launchMuzzle.x,launchMuzzle.y,${angle},${!enemy},${JSON.stringify(zone)},shooter.currentWeapon,shooter,true);`);
}
function view(){return P('Player3DView.resolve(drawingContext,{view:true},round._player3DLaunch?Math.max(0,round._player3DLaunch.z):0)');}
// Independent pinhole equation, using the same camera descriptor as meshes.
function project(p,v){const t=(p.z-v.pivotZ)/v.height;return{x:(p.x+v.offsetX*t)/(1-t),y:(p.y+v.offsetY*t)/(1-t)};}
function physics(){return P(`JSON.stringify({x:round.x,y:round.y,prevX:round.prevX,prevY:round.prevY,startX:round.startX,startY:round.startY,
 a:round.a,vx:round.vx,vy:round.vy,l:round.l,active:round.active,history:round.history,historyNext:round._historyNext,
 coverLaunchPending:round.coverLaunchPending,coverLaunchX:round.coverLaunchX,coverLaunchY:round.coverLaunchY,
 coverLaunchLow:round.coverLaunchLow,legShotTravel:round.legShotTravel,legShotAtFloor:round.legShotAtFloor,
 arrowTravel:round.arrowTravel,retracting:round.retracting,tetherTimer:round.tetherTimer})`);}
function paint(call='round.show()'){
 const names=['translate','rotate','scale','line','ellipse','triangle','rect'],old={},draws=[];
 for(const n of names){old[n]=ctx[n];ctx[n]=(...args)=>draws.push({name:n,args});}
 const before=physics(),shooter=P('JSON.stringify(shooter)');
 try{probe(call);}finally{Object.assign(ctx,old);}
 ok(physics()===before,'drawing preserves native projectile state/history');
 ok(P('JSON.stringify(shooter)')===shooter,'drawing preserves shooter state');
 return draws;
}
for(const weapon of ['PISTOL','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','PARTICLE_BEAM','ROCKET_LAUNCHER','REVOLVER','COACH_GUN','BOW','TASER'])
 for(const stance of ['STAND','CROUCH','PRONE'])for(const presentation of [0,.5,1]){
  fresh({weapon,stance,presentation,jetpack:3});cases++;
  const pose=P('player3DPose(shooter)'),scale=P('elevRenderScale(shooter.x,shooter.y)*shovelRenderScale(shooter)');
  const muzzle=pose.sockets.muzzle,world={x:760+muzzle.x*scale,y:220+muzzle.y*scale,z:muzzle.z*scale};
  const launch=P('round._player3DLaunch'),v=view();
  ok(!!launch,'living mesh shooter records presentation launch height');
  maxMuzzleError=Math.max(maxMuzzleError,close({x:launch.z,y:0},{x:world.z,y:0},weapon+'/'+stance+' exact mesh muzzle Z'));
  const painted=P('player3DProjectilePoint(round,round.x,round.y,Player3DView.resolve(drawingContext,{view:true},Math.max(0,round._player3DLaunch.z)),{})');
  maxMuzzleError=Math.max(maxMuzzleError,close(painted,project(world,v),weapon+'/'+stance+' projected launch matches mesh socket'));
 }
for(const stance of ['STAND','CROUCH']){
 fresh({enemy:true,weapon:'ASSAULT_RIFLE',stance});
 const pose=P('player3DPose(shooter)'),z=P('round._player3DLaunch.z');
 ok(Math.abs(z-pose.sockets.muzzle.z)<1e-8,'hostile human presentation uses its real gun height');
}
for(const presentation of [0,.25,.5,.75,1]) {
 fresh({weapon:'DUAL_SMG',presentation});
 probe("launchMuzzle=aimLaserMuzzle(shooter,1);round.init(launchMuzzle.x,launchMuzzle.y,.7,true,'BODY',shooter.currentWeapon,shooter,true)");
 const pose=P('player3DPose(shooter)'),scale=P('elevRenderScale(shooter.x,shooter.y)*shovelRenderScale(shooter)');
 ok(Math.abs(P('round._player3DLaunch.z')-pose.sockets.secondaryMuzzle.z*scale)<1e-8,'dual SMG offhand retains its separate presentation muzzle height');
}
const oldElev=ctx.elevRenderScale,oldShovel=ctx.shovelRenderScale;
for(const figureScale of [1.35,.63]) {
 ctx.elevRenderScale=()=>figureScale;ctx.shovelRenderScale=()=>1;
 fresh({weapon:'ASSAULT_RIFLE',presentation:.5});const pose=P('player3DPose(shooter)'),m=pose.sockets.muzzle;
 const launch=P('round._player3DLaunch'),p=P('player3DProjectilePoint(round,round.startX,round.startY,Player3DView.resolve(drawingContext,{view:true},Math.max(0,round._player3DLaunch.z)),{})');
 close(p,project({x:760+m.x*figureScale,y:220+m.y*figureScale,z:m.z*figureScale},view()),'raised/pit launch offset matches scaled mesh muzzle');
 ok(Math.abs(launch.dx)>1,'raised/pit launch retains a separate visual XY offset');
 probe('round.x=round.startX+Math.cos(round.a)*120;round.y=round.startY+Math.sin(round.a)*120');
 const far=P('player3DProjectilePoint(round,round.x,round.y,Player3DView.resolve(drawingContext,{view:true},Math.max(0,round._player3DLaunch.z)),{})');
 close(far,project({...P('({x:round.x,y:round.y})'),z:launch.z},view()),'figure scale offset settles onto original flight line after120 units');
}
ctx.elevRenderScale=oldElev;ctx.shovelRenderScale=oldShovel;
fresh({weapon:'SHOTGUN'});probe('frameCount++');
const oldPresentation=ctx.standingPresentationPose,oldPose=ctx.player3DPose;let presentationCalls=0;
ctx.standingPresentationPose=(...args)=>{presentationCalls++;return oldPresentation(...args);};
ctx.player3DPose=()=>{throw Error('projectile launch must not solve a full mesh');};
try{probe("for(let i=0;i<9;i++)round.init(launchMuzzle.x,launchMuzzle.y,.7,true,'BODY',shooter.currentWeapon,shooter,true)");}
finally{ctx.standingPresentationPose=oldPresentation;ctx.player3DPose=oldPose;}
ok(presentationCalls===1,'shotgun pellets reuse one inexpensive presentation calculation');
fresh();const oldDraw=P('Player3D.draw');ctx.__restoreProjectileDraw=oldDraw;
probe('Player3D.draw=()=>true;player3DDrawActor(shooter);_player3DProjectileLaunchCache.delete(shooter)');
ctx.standingPresentationPose=()=>{throw Error('fresh successful render socket must be reusable');};
try{probe("round.init(launchMuzzle.x,launchMuzzle.y,.7,true,'BODY',shooter.currentWeapon,shooter,true)");}
finally{ctx.standingPresentationPose=oldPresentation;probe('Player3D.draw=window.__restoreProjectileDraw');delete ctx.__restoreProjectileDraw;}
ok(Math.abs(P('round._player3DLaunch.z')-P('player3DLiveSnapshot(shooter).sockets.muzzle.z'))<1e-8,'fresh successful mesh snapshot supplies launch height');
probe("shooter.weaponKick=6;round.init(launchMuzzle.x,launchMuzzle.y,.7,true,'BODY',shooter.currentWeapon,shooter,true)");
ok(Math.abs(P('round._player3DLaunch.z')-P('player3DPose(shooter).sockets.muzzle.z'))<1e-8,'same-frame recoil change rejects stale mesh snapshot');
// Actual painter heads and history follow the camera; immutable native trail
// points remain safe to reuse for collision and pool bookkeeping.
for(const weapon of ['PISTOL','SHOTGUN','SMG','ROCKET_LAUNCHER','BOW','TASER','PARTICLE_BEAM']){
 fresh({weapon});probe('for(let i=0;i<3;i++)round.update();');
 const v=view(),head=P('player3DProjectilePoint(round,round.x,round.y,Player3DView.resolve(drawingContext,{view:true},Math.max(0,round._player3DLaunch.z)),{})');
 const draws=paint();
 if(['BOW','ROCKET_LAUNCHER','TASER'].includes(weapon)){
  const t=draws.find(d=>d.name==='translate');close({x:t.args[0],y:t.args[1]},head,weapon+' sprite projects at flight head');
 }else if(weapon==='PARTICLE_BEAM'){
  const line=draws.find(d=>d.name==='line');close({x:line.args[2],y:line.args[3]},head,'particle-beam painted endpoint follows projected collision endpoint');
 }else{
  const circle=draws.filter(d=>d.name==='ellipse').at(-1);close({x:circle.args[0],y:circle.args[1]},head,weapon+' painted head projects');
  const native=P('round.history.map(p=>({x:p.x,y:p.y}))');
  for(const p of native){const expected=P(`player3DProjectilePoint(round,${p.x},${p.y},Player3DView.resolve(drawingContext,{view:true},Math.max(0,round._player3DLaunch.z)),{})`);
   ok(draws.some(d=>d.name==='line'&&(Math.hypot(d.args[0]-expected.x,d.args[1]-expected.y)<.0001||Math.hypot(d.args[2]-expected.x,d.args[3]-expected.y)<.0001)),'tracer follows every projected native history sample');}
 }
 const initial=physics(),launch=P('JSON.stringify(round._player3DLaunch)');matrix={...matrix,e:matrix.e+180};
 const panned=paint();ok(physics()===initial&&P('JSON.stringify(round._player3DLaunch)')===launch,'camera pans do not rewrite launch/physics state');
 ok(JSON.stringify(panned)!==JSON.stringify(draws),weapon+' resolves current camera during each draw');
}
fresh({weapon:'TASER'});probe('round.update()');
let draws=paint(),line=draws.find(d=>d.name==='line');
const muzzle=P('aimLaserMuzzle(shooter)'),z=P('player3DProjectileHeight(shooter).z'),expected=project({x:muzzle.x,y:muzzle.y,z},view());
close({x:line.args[2],y:line.args[3]},expected,'taser tether begins at projected live muzzle');
// Every low firearm ray reaches exactly the existing floor endpoint, even
// when its launch had an elevation/pit presentation offset.
for(const stance of ['STAND','CROUCH','PRONE']){
 fresh({stance,zone:'LEGS'});const range=P('round.legShotRange'),start=P('({x:round.startX,y:round.startY})');
 const h=P('round._player3DLaunch.z'),heights=[];
 for(const t of [0,.25,.5,.75,1]){
  const p=P(`player3DProjectilePoint(round,round.startX+Math.cos(round.a)*${range*t},round.startY+Math.sin(round.a)*${range*t},Player3DView.resolve(drawingContext,{view:true},Math.max(0,round._player3DLaunch.z)),{})`);
  heights.push(p.z);if(t===1)close(p,{x:start.x+Math.cos(.7)*range,y:start.y+Math.sin(.7)*range},stance+' leg shot finishes on unchanged native floor endpoint');
 }
 ok(Math.abs(heights[0]-h)<1e-8&&heights.at(-1)<1e-8&&heights.every((v,i)=>!i||v<=heights[i-1]),stance+' leg shot smoothly approaches floor height');
}
// Native/excluded shooters and pooled reuse retain exactly the old art plane.
fresh();probe("shooter=new Character(760,220,false,'OCCULT_BLACK');round.init(30,40,.7,false,'BODY','RED_LASER',shooter)");
ok(P('round._player3DLaunch===null'),'native caster cannot inherit recycled mesh presentation');
draws=paint();const t=draws.find(d=>d.name==='translate');close({x:t.args[0],y:t.args[1]},{x:30,y:40},'native caster keeps original XY painter');
probe("round.init(30,40,.7,false,'BODY',WEAPONS.PISTOL,null)");ok(P('round._player3DLaunch===null'),'anonymous pooled projectile clears launch view');
fresh();probe('Player3D.enabled=false');draws=paint();const circle=draws.filter(d=>d.name==='ellipse').at(-1);
close({x:circle.args[0],y:circle.args[1]},P('round'),'disabled mesh view keeps native head position');probe('Player3D.enabled=true');
fresh();const worldMatrix=matrix;matrix={a:0,b:0,c:0,d:0,e:0,f:0};draws=paint();matrix=worldMatrix;
const fallback=draws.filter(d=>d.name==='ellipse').at(-1);close({x:fallback.args[0],y:fallback.args[1]},P('round'),'unavailable camera retains native projectile art');
// Draw-free update parity uses identical rounds with/without visual metadata.
for(const weapon of ['PISTOL','SHOTGUN','ROCKET_LAUNCHER','BOW','TASER','PARTICLE_BEAM']){
 fresh({weapon,zone:'LEGS'});probe(`nativeRound=new Bullet();nativeRound.init(round.startX,round.startY,round.a,round.isP,round.tH,round.w,shooter,true);nativeRound._player3DLaunch=null;`);
 for(let i=0;i<12;i++){
  probe('round.update();nativeRound.update()');const a=physics();probe('window.savedRound=round;round=nativeRound');const b=physics();probe('round=window.savedRound');
  ok(a===b,weapon+' presentation metadata does not change flight/cover/history');
 }
}
console.log(checks+' projectile view, exact muzzle, native-physics, leg-floor, trail and pool checks passed across '+cases+' launch poses; max muzzle error '+maxMuzzleError.toFixed(6));

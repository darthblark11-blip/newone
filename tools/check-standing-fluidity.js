// Backward movement retains its rear-facing pose through stops and uses the
// original stride clock. Recovery should enter and leave without a joint kick.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')'),near=(a,b,eps=1e-8)=>Math.abs(a-b)<eps;
let checks=0;const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;ctx.navigator.getGamepads=()=>[];
function fresh(degrees=180,gait=1,phase=.8){
 probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
  inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
  currentLevel=currentBiome=2;BIOME_ACTIVE=false;window.inNM0SecretOverlay=false;buildGhost=null;
  resetUndergroundRoute();setMeleeTool('NONE');window.shovelOwned=window.pickaxeOwned=false;
  chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=false;
  jetpackUnlocked=false;isCooking=meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;
  leftStick={active:true,dx:-1,dy:0};rightStick={active:true,dx:1,dy:0,dist:.4};
  player=new Character(70,90,true);player.isArmed=player.isMoving=true;
  player.aimAngle=0;player.moveAngle=${degrees*Math.PI/180};player.gait=${gait};player.walkCycle=${phase};
  player.currentWeapon=WEAPONS.PISTOL;player.aimHold=14;
  player.reloadTimer=player.meleeTimer=player.dashTimer=player.muzzleFlash=0;
  resetActorStance(player,'STAND');frameCount++;deltaTime=1000/60;
  viewLeft=viewTop=-100000;viewRight=viewBottom=100000;
  for(let i=0;i<140;i++){frameCount++;updateStandingFacing(player,1000/60);}`);
}
const legs=()=>P(`(()=>{const pose=standingRearPose(player);if(!pose)return null;
 const R=figureRig(player.bodyW,player.bodyH);return [0,1].map(i=>standingRearLeg(player,pose,R,i));})()`);
function idle(frames=1){for(let i=0;i<frames;i++)probe('player.isMoving=false;frameCount++;updateStandingFacing(player,1000/60);');}

let retained=true,bounded=true,maxStopStep=0;
for(const degrees of [91,100,112,135,180,225,248,260,269])for(const gait of [.2,.5,1])for(let phase=0;phase<8;phase++){
 fresh(degrees,gait,phase*Math.PI/4);const a=legs();idle();const b=legs();
 retained&&=!!a&&!!b;
 if(!a||!b)continue;
 for(let index=0;index<2;index++){
  const step=Math.hypot(a[index].ax-b[index].ax,a[index].ay-b[index].ay);
  maxStopStep=Math.max(maxStopStep,step);bounded&&=step<7;
 }
}
ok('stopping in every rear band retains the same rear leg and heel presentation',retained);
ok('the first stop frame eases the feet rather than switching to a distant front pose',bounded);

fresh(100,1,.8);const beforeStop=P('standingRearPose(player).blend');idle(180);
const stopped=legs(),settledClock=P('player.walkCycle');
ok('a shallow backward stop keeps its rear side after all motion settles',
 stopped&&near(P('standingRearPose(player).blend'),beforeStop)&&P('standingLowerPose(player).motion===0'));
ok('the heel remains a material surface at rest rather than fading with motion',stopped.every(l=>l.heel>0&&l.lift===0&&l.sole===0));
let settled=true;
for(const phase of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
 probe(`player.walkCycle=${phase};`);const sample=legs();
 settled&&=sample.every((l,i)=>['sx','sy','kx','ky','ax','ay','lift','heel','sole'].every(k=>near(l[k],stopped[i][k])));
}
ok('a settled pose has no residual knee, calf or heel lift from its last step phase',settled);
probe(`player.walkCycle=${settledClock};`);
const paused=P('JSON.stringify(player._standingMotion)');
probe('isPaused=true;frameCount++;updateStandingFacing(player,100);isPaused=false;');
ok('pausing freezes the existing hip and motion state',P('JSON.stringify(player._standingMotion)')===paused);
const state=P('JSON.stringify(player._standingMotion)'),clock=P('player.walkCycle');
for(let i=0;i<12;i++)legs();
ok('resolving the pose never advances a separate animation clock',P('JSON.stringify(player._standingMotion)')===state&&P('player.walkCycle')===clock);
idle();const once=P('JSON.stringify(player._standingMotion)');
probe('updateStandingFacing(player,1000/60);');
ok('multiple consumers in one simulation frame cannot advance the motion twice',P('JSON.stringify(player._standingMotion)')===once);

let blendVelocity=true,maxBlendVelocityJump=0;
for(const degrees of [91,100,112,120,135,150,170]){
 fresh(degrees,1);
 const sample=P(`(()=>{
  const lower=standingLowerPose(player),cross=Math.max(0,-Math.cos(player.moveAngle-player.aimAngle)),h=1e-5;
  const read=backward=>standingRearPose(player,{...lower,backward}).blend;
  const a=read(cross-h),b=read(cross),c=read(cross+h);
  return {position:Math.abs(c-a),velocity:Math.abs((c-b)/h-(b-a)/h)};
 })()`);
 maxBlendVelocityJump=Math.max(maxBlendVelocityJump,sample.velocity);
 blendVelocity&&=sample.position<.001&&sample.velocity<.001;
}
ok('raw rear direction and trailing backstep blend meet without a pause or velocity handoff',blendVelocity);

let position=true,velocity=true,maxVelocityJump=0;
for(const gait of [.2,.5,1])for(const degrees of [100,135,180,225,260]){
 fresh(degrees,gait);
 for(const seam of [Math.PI/2,Math.PI*1.5])for(let index=0;index<2;index++){
  const h=1e-5,read=phase=>{probe(`player.walkCycle=${phase};`);return legs()[index];};
  const a=read(seam-h),b=read(seam),c=read(seam+h);
  for(const k of ['sx','sy','kx','ky','ax','ay','lift','heel','sole']){
   position&&=Math.abs(c[k]-a[k])<.001;
   const jump=Math.abs((c[k]-b[k])/h-(b[k]-a[k])/h);
   maxVelocityJump=Math.max(maxVelocityJump,jump);velocity&&=jump<.01;
  }
 }
}
ok('planted and returning leg positions meet continuously',position);
ok('heel recovery enters and exits without an abrupt velocity change',velocity);

fresh(180,1);
const rootSamples=[],ankleSamples=[];
for(let i=0;i<64;i++){
 probe(`player.walkCycle=${i*Math.PI/32};`);const l=legs()[0];rootSamples.push(l.sx);ankleSamples.push(l.ax);
}
const rootSpan=Math.max(...rootSamples)-Math.min(...rootSamples),ankleSpan=Math.max(...ankleSamples)-Math.min(...ankleSamples),foot=P('figureRig(player.bodyW,player.bodyH).foot');
ok('full backward running has a small moving thigh root rather than locked leg sockets',rootSpan>1&&rootSpan<foot);
ok('rear running has a visible stride rather than a short fixed-calf twitch',ankleSpan>foot*1.4);
ok('the thigh follows the stepping foot in the same direction',
 (rootSamples[16]-rootSamples[48])*(ankleSamples[16]-ankleSamples[48])>0);
const runClock=P('player.walkCycle');idle(20);
ok('settling uses the existing motion envelope and leaves the original stride clock unchanged',P('player.walkCycle')===runClock);
probe('player.isMoving=true;player.walkCycle+=gaitPose(player.gait).cadence;frameCount++;updateStandingFacing(player,1000/60);');
ok('restarting resumes the original stride clock without a replacement phase or reset',
 near(P('player.walkCycle')-runClock,P('gaitPose(player.gait).cadence')));
console.log(`${checks}/${checks} standing rear continuity, recovery velocity, settling and stride checks passed; max stop step ${maxStopStep.toFixed(3)}, max recovery/blend velocity seam ${maxVelocityJump.toFixed(6)}/${maxBlendVelocityJump.toFixed(6)}, root/ankle travel ${rootSpan.toFixed(3)}/${ankleSpan.toFixed(3)}`);

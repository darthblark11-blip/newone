// Sample the live XYZ rig in each standing renderer across a full gait cycle.
const assert = require('node:assert/strict');
const {probe} = require('./harness');

probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inCutscene=false;
 inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
 currentLevel=currentBiome=2;isStoryMode=false;buildGhost=null;resetUndergroundRoute();
 leftStick={active:false,dx:0,dy:0,dist:0};rightStick={active:false,dx:0,dy:0,dist:0};
 player=new Character(0,0,true);setMeleeTool('NONE');`);

const delta = (a,b) => [a.x-b.x,a.y-b.y,a.z-b.z];
const dot = (a,b) => a.reduce((sum,v,i) => sum+v*b[i],0);
let samples = 0, plantedFrames = 0;
for (const role of ['player','enemy','city']) {
  const actor = {player:'player',enemy:"new Character(0,0,false,'NORMAL')",city:"new Character(0,0,false,'CITY_CITIZEN_F')"}[role];
  const options = role==='city' ? '{npc:true,weapon:false}' : '{}';
  probe(`var walker=${actor};walker.aimAngle=.3;walker.gait=0;walker.isMoving=false;
    walker.walkCycle=walker.stunTimer=walker.meleeTimer=walker.reloadTimer=0;
    walker.currentWeapon=WEAPONS.PISTOL;resetActorStance(walker,'STAND');`);
  if (role==='city') assert.ok(probe('npc3DLivingEligible(walker)'), 'city fixture qualifies for the resident renderer');
  if (role==='enemy') assert.ok(probe('enemy3DLivingEligible(walker)'), 'enemy fixture qualifies for the hostile renderer');
  const pose = () => probe(`player3DPose(walker,${options}).pose`);
  const rest = pose();
  assert.ok(rest.articulatedStanding,role+' uses the standing rig at rest');
  const thigh = Math.hypot(...delta(rest.legs[0].knee,rest.legs[0].hip));
  const shin = Math.hypot(...delta(rest.legs[0].ankle,rest.legs[0].knee));
  const hipWidth = Math.hypot(...delta(rest.legs[0].hip,rest.pelvis));
  assert.ok(thigh>0 && shin/thigh>.65 && shin/thigh<1.5,role+' has comparable thigh and shin lengths');
  for (const [gait,turn] of [[.4,0],[1,Math.PI/2],[.75,Math.PI]]) {
    const lifts = [];
    for (let step=0;step<8;step++) {
      probe(`walker.isMoving=true;walker.gait=${gait};walker.moveAngle=walker.aimAngle+${turn};
        walker.walkCycle=${step*Math.PI/4};frameCount++;`);
      const p = pose(), label = [role,gait,turn,step].join('/');
      assert.ok(p.articulatedStanding,label+' uses standing articulation');
      assert.equal(p.legs.length,2,label+' has two legs');
      if (turn===Math.PI/2) {
        const twist = p.chestHeading-p.hipHeading;
        assert.ok(Math.abs(Math.atan2(Math.sin(twist),Math.cos(twist)))>.25,label+' torso can turn independently of strafing hips');
      }
      const forward = [Math.cos(p.hipHeading),Math.sin(p.hipHeading),0];
      const lateral = [-forward[1],forward[0],0];
      for (const [i,leg] of p.legs.entries()) {
        const side = i ? 1 : -1, upper = delta(leg.knee,leg.hip), lower = delta(leg.ankle,leg.knee);
        assert.ok([...upper,...lower,leg.heading].every(Number.isFinite),label+' finite leg '+i);
        assert.ok(side*dot(delta(leg.hip,p.pelvis),lateral)>1,label+' hip remains on its own side');
        assert.ok(Math.abs(Math.hypot(...delta(leg.hip,p.pelvis))-hipWidth)<.001,label+' hip stays attached to the pelvis');
        assert.ok(Math.abs(Math.hypot(...upper)-thigh)<.001,label+' fixed thigh length');
        assert.ok(Math.abs(Math.hypot(...lower)-shin)<.001,label+' fixed shin length');
        // Project the knee off the hip-to-ankle axis to isolate the bend direction.
        const axis = delta(leg.ankle,leg.hip), t = dot(upper,axis)/dot(axis,axis);
        const bend = upper.map((v,j) => v-axis[j]*t);
        assert.ok(dot(bend,forward)>0,label+' knee flexes forward in the pelvis frame');
      }
      lifts.push(p.legs[0].ankle.z-p.legs[1].ankle.z);
      samples++;
    }
    assert.ok(Math.min(...lifts)<-.1 && Math.max(...lifts)>.1,role+' alternates support feet at gait '+gait);
  }

  // Walk the actor through a contact exchange using the actual simulation
  // sampling entry point. Compare rendered ankles in world coordinates.
  const turn = {player:0, enemy:Math.PI, city:Math.PI/2}[role];
  probe(`walker.gait=.65;walker.moveAngle=walker.aimAngle+${turn};
    var stepX=Math.cos(walker.moveAngle),stepY=Math.sin(walker.moveAngle);`);
  const floor = rest.legs[0].ankle.z, contacts = [0,0];
  let previous = [];
  for (let frame=0;frame<70;frame++) {
    probe('frameCount++;walker.x+=stepX;walker.y+=stepY;walker.walkCycle+=.2;rememberFigureMotion(walker,stepX,stepY);');
    const [x,y,scale] = probe('[walker.x,walker.y,elevRenderScale(walker.x,walker.y)*shovelRenderScale(walker)]');
    const ankles = pose().legs.map(({ankle}) => ({x:x+scale*ankle.x,y:y+scale*ankle.y,z:ankle.z}));
    for (let i=0;i<2;i++) {
      if (!previous[i] || Math.abs(ankles[i].z-floor)>.00001 || Math.abs(previous[i].z-floor)>.00001) continue;
      const slip = Math.hypot(...delta(ankles[i],previous[i]));
      assert.ok(slip<.02,`${role} foot ${i} slipped ${slip.toFixed(4)} world units on planted frame ${frame}`);
      contacts[i]++;
      plantedFrames++;
    }
    previous=ankles;
  }
  assert.ok(contacts.every(n=>n>=5),role+' exercises consecutive grounded frames on both feet');
}
console.log(samples+' gait samples and '+plantedFrames+' consecutive planted-foot comparisons passed for player, enemy and city resident');

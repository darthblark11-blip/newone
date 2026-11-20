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
// The player's original running silhouette is driven by walkCycle. The wide
// trouser end passes behind the narrow boot on backward and diagonal travel.
const rig=probe('figureRig(player.bodyW,player.bodyH)');
let playerSamples=0;
for(const [gait,turn] of [[0,0],[.4,0],[1,0],[1,Math.PI/2],[1,Math.PI*.75],[1,Math.PI]]){
  probe(`player.isMoving=${gait>0};player.gait=${gait};player.aimAngle=.3;player.moveAngle=.3+${turn};
    player.currentWeapon=WEAPONS.PISTOL;resetActorStance(player,'STAND');`);
  for(let step=0;step<=8;step++){
    probe(`{frameCount++;player.walkCycle=${step*Math.PI/4};
      const dx=player.isMoving?Math.cos(player.moveAngle)*4:0,dy=player.isMoving?Math.sin(player.moveAngle)*4:0;
      player.x+=dx;player.y+=dy;rememberFigureMotion(player,dx,dy);}`);
    const native=probe('buildHumanLegHitGeometry(player)'),{pose,parts}=probe('player3DPose(player)');
    const co=Math.cos(native.angle),si=Math.sin(native.angle);
    for(const [i,leg] of pose.legs.entries()){
      const ref=native.legs[i],side=i?'right':'left',label=[gait,turn,step,side].join('/');
      for(const [joint,x,y] of [[leg.hip,ref.sx,ref.sy],[leg.knee,ref.kx,ref.ky],[leg.ankle,ref.ax,ref.ay]]){
        assert.ok(Math.hypot(joint.x-(co*x-si*y),joint.y-(si*x+co*y))<1e-5,label+' follows original stride phase and reach');
      }
      for(const [mesh,width] of [['thigh',rig.thighW],['shin',rig.shinW]]){
        const m=parts.find(part=>part.part===mesh+'_'+side).matrix;
        assert.ok(Math.abs(Math.hypot(m[4],m[5],m[6])-width)<1e-5,label+' retains full '+mesh+' denim width');
      }
    }
    playerSamples++;
  }
}
let samples = 0, plantedFrames = 0;
for (const role of ['enemy','city']) {
  const actor = {enemy:"new Character(0,0,false,'NORMAL')",city:"new Character(0,0,false,'CITY_CITIZEN_F')"}[role];
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
  const turn = role==='enemy'?Math.PI:Math.PI/2;
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
// At a wall the 3D boots and knees must follow the turned pelvis through the
// inward peek, both tangents and the open outward arc.
const bootVertices=probe('player3DFitVertices(PLAYER3D_ASSET.meshes.foot)');
let coverLengths=null,coverSamples=0;
for(const trackContacts of [false,true])for(const end of [-1,1]){
  probe(`buildings=activeBuildings=[{x:40,y:0,w:20,h:160,isWall:true}];activeParkingCars=[];invalidateColIndex();
    player=new Character(15,${end*70},true);player.currentWeapon=WEAPONS.PISTOL;player.isArmed=true;
    player.aimAngle=0;resetActorStance(player);rightStick.active=true;rightStick.dx=1;rightStick.dist=.4;
    for(let i=0;i<12;i++){frameCount++;updateActorCover(player,1000/60,6,0,true);}`);
  assert.ok(probe("player.cover.kind==='HIGH'&&player.cover.attached&&player.cover.peek===1"),'acquired high-cover corner '+end);
  for(let i=0;i<=24;i++){
    const angle=end*2*Math.PI*i/24;
    probe(`player.aimAngle=Math.atan2(Math.sin(${angle}),Math.cos(${angle}));
      for(let i=0;i<8;i++){frameCount++;updateActorCover(player,1000/60,0,0,true);
        if(${trackContacts})updateStanding3DContacts(player,0,0);}`);
    const {pose,sockets,parts}=probe('player3DPose(player)'),forward=[Math.cos(pose.hipHeading),Math.sin(pose.hipHeading),0];
    const hits=probe('buildHumanLegHitGeometry(player)');
    const scale=probe('elevRenderScale(player.x,player.y)*shovelRenderScale(player)');
    for(const [index,leg] of pose.legs.entries()){
      const side=index?'right':'left',label='corner '+end+', sample '+i+', '+side+' leg';
      const upper=delta(leg.knee,leg.hip),lower=delta(leg.ankle,leg.knee),axis=delta(leg.ankle,leg.hip);
      const thigh=Math.hypot(...upper),shin=Math.hypot(...lower),t=dot(upper,axis)/dot(axis,axis);
      const bend=upper.map((v,j)=>v-axis[j]*t);
      assert.ok(dot(bend,forward)>.1,label+' knee flexes forward of the hip-to-ankle line');
      assert.ok(dot(upper,lower)/(thigh*shin)<.9995,label+' retains knee flexion under load');
      if(!coverLengths)coverLengths=[thigh,shin];
      assert.ok(Math.abs(thigh-coverLengths[0])<.001&&Math.abs(shin-coverLengths[1])<.001,label+' keeps fixed XYZ bone lengths');
      const hit=hits.legs[index];
      assert.equal(hits.scale,scale);
      for(const [joint,x,y] of [[leg.hip,hit.sx,hit.sy],[leg.knee,hit.kx,hit.ky],[leg.ankle,hit.ax,hit.ay]]){
        assert.ok(Math.hypot(joint.x-x,joint.y-y)<.001,label+' leg contact matches the mesh');
      }
      const m=parts.find(part=>part.part==='foot_'+side).matrix;
      for(let j=0;j<bootVertices.length;j+=3){
        const x=m[0]*bootVertices[j]+m[4]*bootVertices[j+1]+m[8]*bootVertices[j+2]+m[12];
        assert.ok(15+scale*x<30,label+' boot mesh clears the wall face');
      }
      const foot=delta(sockets[side+'Foot'],leg.ankle);
      assert.ok(dot(foot,forward)>.65*Math.hypot(foot[0],foot[1]),label+' boot points forward in the pelvis frame');
    }
    coverSamples++;
  }
}
console.log(playerSamples+' original player stride samples, '+samples+' NPC gait samples, '+plantedFrames+' planted-foot comparisons and '+coverSamples+' high-cover poses passed');

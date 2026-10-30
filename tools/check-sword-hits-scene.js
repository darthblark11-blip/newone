// Exercise the real draw loop and inspect the surviving-hit art in Chromium.
// Run with a /workspace HTTP server on port 8000 (or SWORD_SCENE_URL).
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SWORD_SCENE_URL||'http://127.0.0.1:8000/newone-dev/');
  await page.waitForFunction(()=>window.frameCount>3);
  const state=await page.evaluate(()=>{
   noLoop();isStoryMode=false;startAtLevel(8);started=true;doTick=true;
   enemiesList=[];buildings=[];activeBuildings=[];activeParkingCars=[];barrels=[];invalidateColIndex();
   player.x=player.y=0;player.aimAngle=0;player.isArmed=false;
   player.meleeTimer=11;player.meleePhase=1;player.isBackhand=false;
   swordPickedUp=true;setMeleeTool('SWORD');
   leftStick.active=rightStick.active=false;leftStick.dx=leftStick.dy=rightStick.dx=rightStick.dy=0;
   window.swordSceneTarget=new Character(45,0,false,'ARMORED_STANDARD');
   swordSceneTarget.hp=swordSceneTarget.maxHp=700;swordSceneTarget.isFriendly=swordSceneTarget.isNeutral=false;
   enemiesList=[swordSceneTarget];particles=[];bullets=[];corpses=[];
   window.swordSceneTime=1000;window.millis=()=>swordSceneTime;
   frameCount++;player.updatePlayer();
   const atHit={hp:swordSceneTarget.hp,timer:player.meleeTimer,deadline:swordHitStopUntil,particles:particles.length};
   // Aim input keeps asking to move throughout the contact freeze.
   leftStick.active=true;leftStick.dx=1;
   const x=player.x,y=player.y,enemyX=swordSceneTarget.x,enemyY=swordSceneTarget.y;
   const effect=JSON.stringify(swordSceneTarget.swordHitFeedback),poses=particles.map(p=>[p.x,p.y,p.fxAge,p.a]);
   for(const elapsed of [0,25,60,99]){swordSceneTime=1000+elapsed;frameCount++;draw();}
   const frozen={x:player.x,y:player.y,timer:player.meleeTimer,hp:swordSceneTarget.hp,
    enemyX:swordSceneTarget.x,enemyY:swordSceneTarget.y,feedback:JSON.stringify(swordSceneTarget.swordHitFeedback),
    particles:particles.map(p=>[p.x,p.y,p.fxAge,p.a]),doTick};
   swordSceneTime=1100;frameCount++;draw();
   const resumed={x:player.x,timer:player.meleeTimer,doTick};
   return {atHit,frozen,resumed,before:{x,y,enemyX,enemyY,effect,poses}};
  });
  assert.equal(state.atHit.hp,500);assert.equal(state.atHit.deadline,1100);
  assert.equal(state.frozen.x,state.before.x);assert.equal(state.frozen.y,state.before.y);
  assert.equal(state.frozen.enemyX,state.before.enemyX);assert.equal(state.frozen.enemyY,state.before.enemyY);
  assert.equal(state.frozen.timer,state.atHit.timer);assert.equal(state.frozen.hp,500);
  assert.equal(state.frozen.feedback,state.before.effect);assert.deepEqual(state.frozen.particles,state.before.poses);
  assert.equal(state.frozen.doTick,false);assert(state.resumed.doTick);assert(state.resumed.timer<state.atHit.timer);
  // Show the same actual hit at contact, after the flash, and after spray fades.
  await page.evaluate(()=>{
   leftStick.active=false;leftStick.dx=0;resetSwordHitFeedback();
   window.swordGallery=[];
   for(const [index,stance]of ['STAND','CROUCH','PRONE'].entries()){
    resetSwordHitFeedback();useBloodBank('sword-gallery-'+index);particles=[];frameCount++;
    const e=new Character(0,0,false,'ARMORED_STANDARD');e.hp=e.maxHp=700;
    e.aimAngle=Math.PI;e.isArmed=false;e.name='';resetActorStance(e,stance);
    player.x=-45;player.y=0;player.aimAngle=0;player.isBackhand=index===1;
    player.meleeTimer=11;player.meleePhase=index===1?2:1;enemiesList=[e];doTick=true;
    player.updatePlayer();
    swordGallery.push({e,particles,bank:'sword-gallery-'+index,feedback:{...e.swordHitFeedback}});
   }
   background(34,44,46);noStroke();textAlign(CENTER,TOP);textFont('sans-serif');
   fill(239,235,215);textSize(23);text('SURVIVING SWORD HITS',width/2,20);
   textSize(13);fill(177,191,188);text('100 ms contact stop · directional spray · temporary target health',width/2,54);
   const times=[0,220,600];
   for(let row=0;row<3;row++)for(let col=0;col<3;col++){
    const f=swordGallery[col];useBloodBank(f.bank);particles=f.particles;
    f.e.swordHitFeedback={...f.feedback};swordHitTargets.clear();swordHitTargets.add(f.e);
    doTick=true;
    for(let left=times[row];left>0;left-=16.67)updateSwordHitFeedback(Math.min(left,16.67));
    if(row===1)for(let i=0;i<13;i++)for(const p of particles)p.update();
    if(row===2)for(let i=0;i<24;i++)for(const p of particles)p.update();
    doTick=false;push();translate(185+col*365,200+row*210);scale(2.4);
    drawBloodChunks();f.e.show();updateParticles();pop();
    fill(188,203,195);noStroke();textSize(12);textAlign(CENTER,TOP);
    text(['STANDING / FOREHAND','CROUCH / BACKHAND','PRONE / FOREHAND'][col]+' · '+times[row]+' ms',185+col*365,272+row*210);
   }
  });
  await page.screenshot({path:process.env.SWORD_SCENE_OUT||'/tmp/newone-sword-hits.png'});
  assert.deepEqual(errors,[]);
  console.log('Browser sword hits passed: actual draw freezes movement, swing, targets and spray for 100 ms, resumes once, and renders standing/crouch/prone contact and floor marks without errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

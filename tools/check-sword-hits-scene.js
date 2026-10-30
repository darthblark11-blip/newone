// Exercise the real draw loop and inspect the surviving-hit art in Chromium.
// Run with a /workspace HTTP server on port 8000 (or SWORD_SCENE_URL).
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:1050}}),errors=[];
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
   frameCount++;player.updatePlayer();
   const atHit={hp:swordSceneTarget.hp,timer:player.meleeTimer,active:doTick,particles:particles.length,shake:screenShake};
   // The next real draw must advance immediately after contact.
   leftStick.active=true;leftStick.dx=1;
   const x=player.x,flash=swordSceneTarget.swordHitFeedback.flashMs;
   frameCount++;deltaTime=1000/60;draw();
   const next={x:player.x,timer:player.meleeTimer,hp:swordSceneTarget.hp,active:doTick,
    flash:swordSceneTarget.swordHitFeedback.flashMs,
    bloodAges:particles.filter(p=>p.t==='HIT_BLOOD').map(p=>p.fxAge)};
   return {atHit,next,before:{x,flash}};
  });
  assert.equal(state.atHit.hp,500);assert(state.atHit.active);
  assert.equal(state.atHit.shake,0);assert.equal(state.atHit.particles,37);
  assert(state.next.active);assert.equal(state.next.timer,state.atHit.timer-1);
  assert(state.next.x>state.before.x);assert.equal(state.next.hp,500);
  assert(state.next.flash<state.before.flash);assert(state.next.bloodAges.length===36&&state.next.bloodAges.every(age=>age===1));
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
   textSize(13);fill(177,191,188);text('Continuous combat · 3× blood spray · arcing floor splatter · no normal swing shake',width/2,54);
   const times=[0,220,600];
   for(let row=0;row<3;row++)for(let col=0;col<3;col++){
    const f=swordGallery[col];useBloodBank(f.bank);particles=f.particles;
    f.e.swordHitFeedback={...f.feedback};swordHitTargets.clear();swordHitTargets.add(f.e);
    doTick=true;
    for(let left=times[row];left>0;left-=16.67)updateSwordHitFeedback(Math.min(left,16.67));
    if(row===1)for(let i=0;i<13;i++)for(const p of particles)p.update();
    if(row===2)for(let i=0;i<24;i++)for(const p of particles)p.update();
    doTick=false;push();translate(200+col*400,230+row*330);scale(2.2);
    drawBloodChunks();f.e.show();updateParticles();pop();
    fill(188,203,195);noStroke();textSize(12);textAlign(CENTER,TOP);
    text(['STANDING / FOREHAND','CROUCH / BACKHAND','PRONE / FOREHAND'][col]+' · '+times[row]+' ms',200+col*400,302+row*330);
   }
  });
  await page.screenshot({path:process.env.SWORD_SCENE_OUT||'/tmp/newone-sword-hits.png'});
  const finishers=await page.evaluate(()=>{
   resetSwordHitFeedback();leftStick.active=rightStick.active=false;leftStick.dx=leftStick.dy=0;
   MAX_KILLS=10000;totalKills=0;killcamMode=isWin=false;
   const fixtures=[];
   for(let i=0;i<3;i++){
    useBloodBank('sword-finisher-'+i);particles=[];corpses=[];frameCount++;
    const e=new Character(0,0,false,'ARMORED_STANDARD');e.hp=1;e.aimAngle=Math.PI;e.isNeutral=e.isFriendly=false;
    enemiesList=[e];player.x=-45;player.y=0;player.aimAngle=0;
    player.meleePhase=4;player.meleeTimer=16;shockwaves=[];setMeleeTool('SWORD');
    explosionDeathCounter=i;doTick=true;player.updatePlayer();shockwaves[0].update();
    const c=corpses[0];
    fixtures.push({c,particles,bank:'sword-finisher-'+i,tick:0,shake:screenShake,
     dT:c.dT,blast:!!c.blast,cut:!!c.sword,parts:c.blast.parts.length,gibs:c.blast.gibs.length});
   }
   background(34,44,46);textAlign(CENTER,TOP);textFont('sans-serif');noStroke();
   fill(239,235,215);textSize(23);text('EXPLOSIVE SWORD FINISHER',width/2,20);
   fill(177,191,188);textSize(13);text('Explosion shake restored · native ballistic dismemberment · normal sword cuts preserved',width/2,54);
   for(let row=0;row<3;row++)for(let col=0;col<3;col++){
    const f=fixtures[col],age=[0,24,112][row];useBloodBank(f.bank);particles=f.particles;
    doTick=true;deltaTime=1000/60;
    push();translate(-10000,-10000);
    for(;f.tick<age;f.tick++){frameCount++;f.c.update();updateBloodPools();updateParticles();}
    pop();doTick=false;
    push();translate(150+col*400,230+row*330);scale(1.7);
    drawBloodChunks();f.c.show();updateParticles();pop();
    fill(188,203,195);noStroke();textSize(12);textAlign(CENTER,TOP);
    text(['PULVERIZED LEGS','SEVERED LEG','DIAGONAL HALVES'][col]+' · '+Math.round(age*1000/60)+' ms',200+col*400,320+row*330);
   }
   return fixtures.map(({dT,blast,cut,parts,gibs,shake})=>({dT,blast,cut,parts,gibs,shake}));
  });
  assert.deepEqual(finishers.map(f=>f.dT),[18,19,20]);
  assert(finishers.every(f=>f.blast&&!f.cut&&f.parts>0&&f.gibs>0&&f.shake===20));
  await page.screenshot({path:process.env.SWORD_FINISHER_OUT||'/tmp/newone-sword-finisher.png'});
  assert.deepEqual(errors,[]);
  console.log('Browser sword hits passed: uninterrupted next-frame combat, no normal swing shake, restored finisher shake, and all three native blast dismemberment animations render without errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

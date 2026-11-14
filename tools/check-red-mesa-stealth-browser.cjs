// Native p5 1.9.0 integration checks and captures for the Red Mesa sandbox.
// RED_MESA_P5=/path/to/p5-1.9.0.min.js node tools/check-red-mesa-stealth-browser.cjs
// Chromium/SwiftShader CPU timings are not physical-device FPS measurements.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {chromium}=require('playwright-core');
const repo=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(repo,'game.js'),'utf8');
const p5=fs.readFileSync(process.env.RED_MESA_P5||'/workspace/newone-dev/vendor/p5-1.9.0.min.js','utf8');
const out=process.env.RED_MESA_QA_OUT||'/tmp/red-mesa-stealth-qa';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const blank=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR3kAAAAASUVORK5CYII=','base64');
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await context.addInitScript(()=>window.addEventListener('resize',e=>{try{if(typeof leftStick==='undefined'||!leftStick||!rightStick)e.stopImmediatePropagation();}catch(_){e.stopImmediatePropagation();}},true));
 const page=await context.newPage(),errors=[],rendererWarnings=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('console',m=>{if(/setAttributes.*WEBGL renderer/.test(m.text()))rendererWarnings.push(m.text());});
 await page.route('http://red-mesa.local/**',r=>{
  const url=r.request().url();
  if(url.endsWith('/p5.js'))return r.fulfill({contentType:'application/javascript',body:p5});
  if(url.endsWith('/game.js'))return r.fulfill({contentType:'application/javascript',body:source});
  if(/\.(mp3|wav)(\?.*)?$/.test(url))return r.fulfill({status:204,body:''});
  if(/\.png(\?.*)?$/.test(url))return r.fulfill({contentType:'image/png',body:blank});
  return r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html,body{margin:0;overflow:hidden;background:#111;touch-action:none}canvas{display:block}</style><script src="/p5.js"></script><script src="/game.js"></script>'});
 });
 try{
  await page.goto('http://red-mesa.local/',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof leftStick!=='undefined'&&leftStick&&document.querySelector('canvas'));
  const setup=await page.evaluate(()=>{
   noLoop();randomSeed(7);noiseSeed(BIOME_SEED);seedWorldClock();
   isStoryMode=true;started=true;isDead=isWin=isPaused=false;window.outpostForts={};startAtLevel(3);
   inStoryIntro=inStoryRoom=killcamMode=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=inTravelMenu=inOverworldView=false;
   objectiveTimer=streakMsgTimer=0;window.showOnScreenControls=true;window.isDesktop=false;
   leftStick.active=rightStick.active=false;leftStick.dx=leftStick.dy=rightStick.dx=rightStick.dy=rightStick.dist=0;
   const def=FRONTIER_BOUNTY_DEFS.find(d=>d.id==='RED_MESA');
   frontierBounties.activeId=def.id;frontierBountyRecord(def).stage='ACTIVE';
   player.x=def.x;player.y=def.y+345;player.hp=player.maxHp;worldTimeMs=13/24*DAY_MS;updateSunVector();
   zoom=.45;camX=player.x-width/(2*zoom);camY=def.y-height/(2*zoom);
   viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;
   chunkMgr.update(player.x,player.y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();lastActiveUpdate=-100;updateActiveWorld();
   doTick=true;deltaTime=1000/60;frameCount++;updateFrontierBounties();
   glRigInit();GLRig.on=GLRig.ok;
   const actors=[..._frontierBountyActors.values()].filter(e=>e.frontierBountyId==='RED_MESA');
   window.__redMesaQA={buildings,activeBuildings,enemies:enemiesList,actorMap:_frontierBountyActors,actors,def,playerX:player.x,playerY:player.y};
   return {targets:actors.filter(e=>Number.isInteger(e.frontierBountySlot)).length,
    supports:actors.filter(e=>Number.isInteger(e.frontierBountySupportSlot)).length,
    starts:actors.map(e=>({target:e.frontierBountySlot,support:e.frontierBountySupportSlot,state:e.state,clear:!e.checkCol(e.x,e.y)})),
    lowCover:activeBuildings.filter(b=>b.frontierBountyId==='RED_MESA'&&coverSolidKind(b)==='LOW').length};
  });
  assert.equal(setup.targets,5,'The five poster targets remain the contract objective');
  assert.equal(setup.supports,6,'Six distinct supporting henchmen are present');
  assert.ok(setup.starts.every(e=>e.clear),'Every target and supporting guard spawns outside solid geometry');
  assert.ok(setup.starts.every(e=>e.state!=='CHASE'),'Approaching the fortress does not trigger instant global alert');
  assert.ok(setup.lowCover>=4,'The tactical fortress publishes usable low cover');
  const behavior=await page.evaluate(()=>{
   // Controlled actual Character fixtures use a clear local tile. Restore the
   // streamed fortress before rendering; no engine function is replaced.
   const saved=window.__redMesaQA,def=saved.def,results={};
   buildings=[];activeBuildings=[];enemiesList=[];invalidateColIndex();
   const prepare=(distance=220)=>{
    currentLevel=currentBiome=3;frontierBounties.activeId='RED_MESA';frontierBountyRecord(def).stage='ACTIVE';
    redMesaStealthReset();worldTimeMs=13/24*DAY_MS;updateSunVector();
    resetActorStance(player);player.cover=null;player.mounted=false;player.dashTimer=0;player.hp=player.maxHp;
    player.x=def.x+distance;player.y=def.y;player.isMoving=false;player.gait=0;player.aimAngle=0;
    leftStick.dx=leftStick.dy=0;activeBuildings=[];buildings=[];invalidateColIndex();
    const guard=new Character(def.x,def.y,false,'BANDIT');
    guard.frontierBountyId='RED_MESA';guard.frontierBountySlot=1;guard.isFriendly=guard.isNeutral=false;
    guard.state='PATROL';guard.aimAngle=0;guard.fireTimer=99999;guard.postX=guard.x;guard.postY=guard.y;guard.postR=0;
    guard.redMesaPatrol=[{x:guard.x,y:guard.y,waitMs:60000}];enemiesList=[guard];_frontierBountyActors=new Map([['RED_MESA:1',guard]]);return guard;
   };
   const tick=(guard,dt=50)=>{deltaTime=dt;doTick=true;frameCount++;redMesaUpdateNoise(dt);guard.updateEnemy();return guard.redMesaStealth;};
   let guard=prepare();
   results.scope={redMesa:redMesaStealthActor(guard)};currentLevel=1;results.scope.level1=redMesaStealthActor(guard);
   currentLevel=3;guard.frontierBountyId='DUST_RAIL';results.scope.otherBounty=redMesaStealthActor(guard);guard.frontierBountyId='RED_MESA';
   guard.aimAngle=Math.PI;results.awayCone=redMesaStealthVisible(guard,player);
   guard.aimAngle=0;results.frontCone=redMesaStealthVisible(guard,player);
   results.silent=[];
   for(const [name,throwAmount,gait,stance]of [['idle',0,0,'STAND'],['walk',.3,.3,'STAND'],['jog',.65,.65,'STAND'],['released run',.5,1,'STAND'],['crouch',1,1,'CROUCH'],['prone',1,1,'PRONE']]){
    resetActorStance(player,stance);player.isMoving=throwAmount>0;player.gait=gait;leftStick.dx=throwAmount;leftStick.dy=0;
    results.silent.push({name,radius:redMesaRunningRadius(player)});
   }
   resetActorStance(player);player.isMoving=true;player.gait=1;leftStick.dx=1;
   results.runningRadius=redMesaRunningRadius(player);frameCount++;redMesaUpdateNoise(50);
   for(let i=0;i<9;i++){player.x+=6;frameCount++;redMesaUpdateNoise(50);}
   results.runningNoise=_redMesaNoise.events.map(e=>({...e}));
   results.materialRadii={};
   for(const material of ['EARTH','TIMBER','STONE']){
    const zone=material==='EARTH'?{x0:-250,x1:-200,y0:250,y1:280}:RED_MESA_SURFACES.find(z=>z.kind===material);
    player.x=def.x+(zone.x0+zone.x1)/2;player.y=def.y+(zone.y0+zone.y1)/2;results.materialRadii[material]=redMesaRunningRadius(player);
   }
   guard=prepare(210);guard.aimAngle=Math.PI;player.isMoving=true;player.gait=1;leftStick.dx=1;
   for(let i=0;i<12;i++){
    player.x+=6;const state=tick(guard);
    if(state.heardId>0){const event=_redMesaNoise.events.find(e=>e.id===state.heardId);
     results.hearing={phase:state.phase,visible:state.visible,suspicion:state.suspicion,goalX:state.goalX,goalY:state.goalY,angle:guard.aimAngle,event};break;}
   }
   guard=prepare(500);results.curiosity=[];
   for(let i=0;i<100;i++){
    guard.x=def.x;guard.y=def.y;guard.aimAngle=0;
    const state=tick(guard);
    if(i===0||state.phase!==results.curiosity.at(-1).phase)results.curiosity.push({atMs:(i+1)*50,phase:state.phase,suspicion:state.suspicion,state:guard.state});
    if(state.phase==='ALERT')break;
   }
   const lastSeen={x:guard.redMesaStealth.goalX,y:guard.redMesaStealth.goalY};
   const screen={x:def.x+110,y:def.y,w:38,h:6000,coverType:'HIGH',hp:Infinity,maxHp:Infinity};
   activeBuildings=[screen];buildings=[screen];invalidateColIndex();player.x=def.x+350;player.y=def.y+160;
   const loss=[];
   const lossTicks=Math.ceil((RED_MESA_STEALTH.loseMs+RED_MESA_STEALTH.searchMs+2000)/50);
   for(let i=0;i<lossTicks;i++){
    const state=tick(guard);
    if(i===0||state.phase!==loss.at(-1).phase)loss.push({afterHideMs:(i+1)*50,phase:state.phase,visible:state.visible,goalX:state.goalX,goalY:state.goalY});
    if(state.phase==='PATROL')break;
   }
   results.lostSight={lastSeen,playerHiddenAt:{x:player.x,y:player.y},phases:loss};
   guard=prepare(220);const low={x:def.x+110,y:def.y,w:38,h:140,coverType:'LOW',hp:Infinity,maxHp:Infinity};
   activeBuildings=[low];buildings=[low];invalidateColIndex();
   resetActorStance(player,'CROUCH');results.crouchHidden=!redMesaStealthVisible(guard,player);
   resetActorStance(player,'PRONE');results.proneHidden=!redMesaStealthVisible(guard,player);
   resetActorStance(player);results.standingExposed=redMesaStealthVisible(guard,player);
   resetActorStance(player,'CROUCH');player.y=def.y+180;guard.aimAngle=Math.atan2(player.y-guard.y,player.x-guard.x);
   results.aroundEdgeExposed=redMesaStealthVisible(guard,player);
   guard=prepare(148);activeBuildings=[low];buildings=[low];invalidateColIndex();player.aimAngle=Math.PI;
   frameCount++;updateActorCover(player,100,-6,0,false);frameCount++;updateActorCover(player,100,-6,0,false);
   results.lowCoverDuckHidden=!!player.cover&&!redMesaStealthVisible(guard,player);
   for(let i=0;i<3;i++){frameCount++;updateActorCover(player,100,-6,0,true);}
   results.lowCoverPopExposed=!!player.cover&&player.cover.pop>.99&&redMesaStealthVisible(guard,player);
   guard=prepare(178);const high={x:def.x+110,y:def.y,w:100,h:140,coverType:'HIGH',hp:Infinity,maxHp:Infinity};
   activeBuildings=[high];buildings=[high];invalidateColIndex();
   player.y=def.y+56;guard.x=def.x-100;guard.y=def.y+140;player.aimAngle=Math.atan2(guard.y-player.y,guard.x-player.x);
   guard.aimAngle=Math.atan2(player.y-guard.y,player.x-guard.x);results.highCoverHidden=!redMesaStealthVisible(guard,player);
   for(let i=0;i<3;i++){frameCount++;updateActorCover(player,100,-6,0,true);}
   results.highCoverPeek={valid:!!player.cover?.validPeek,upper:player.cover?.upper,
    exposed:redMesaStealthVisible(guard,player),rootStillBlocked:!hasLOS(guard.x,guard.y,player.x,player.y)};
   guard=prepare(220);results.dayIllumination=redMesaIllumination(player);worldTimeMs=0;updateSunVector();frameCount+=6;results.nightIllumination=redMesaIllumination(player);
   worldTimeMs=13/24*DAY_MS;updateSunVector();
   const caster={x:def.x,y:def.y,w:32,h:32,_rise:45,frontierBountyId:'RED_MESA',hp:Infinity};
   player.x=def.x+LIGHT_DX*40;player.y=def.y+LIGHT_DY*40;frameCount+=6;results.sunlitIllumination=redMesaIllumination(player);
   activeBuildings=[caster];buildings=[caster];invalidateColIndex();frameCount+=6;results.shadowIllumination=redMesaIllumination(player);
   buildings=saved.buildings;activeBuildings=saved.activeBuildings;enemiesList=saved.enemies;_frontierBountyActors=saved.actorMap;invalidateColIndex();
   player.x=saved.playerX;player.y=saved.playerY;player.isMoving=false;player.gait=0;resetActorStance(player);
   leftStick.dx=leftStick.dy=0;redMesaStealthReset();worldTimeMs=13/24*DAY_MS;updateSunVector();
   return results;
  });
  fs.writeFileSync(path.join(out,'behavior.json'),JSON.stringify({setup,behavior},null,2));
  assert.deepEqual(behavior.scope,{redMesa:true,level1:false,otherBounty:false},'Stealth belongs exclusively to active Level 3 Red Mesa guards');
  assert.equal(behavior.awayCone,false,'A guard cannot see behind its vision cone');
  assert.equal(behavior.frontCone,true,'Unobstructed player inside the cone is visible');
  assert.ok(behavior.silent.every(r=>r.radius===0),'Walk, jog, crouch, prone and released sprint produce zero footstep sound');
  assert.ok(behavior.runningRadius>0,'Running propagates footstep noise');
  assert.ok(behavior.runningNoise.length>0,'Actual running displacement emits bounded historical sound events');
  assert.ok(behavior.materialRadii.TIMBER>behavior.materialRadii.STONE&&behavior.materialRadii.STONE>behavior.materialRadii.EARTH,'Footstep propagation follows the authored surface material');
  assert.ok(behavior.hearing&&behavior.hearing.visible&&behavior.hearing.phase==='ALERT','A nearby guard immediately faces the sound and spots an exposed runner inside 20 m');
  assert.ok(Math.abs(behavior.hearing.angle)<1e-8,'Native facing keeps the immediate sound orientation');
  assert.equal(behavior.hearing.goalX,behavior.hearing.event.x,'Hearing investigates the historical sound location');
  assert.equal(behavior.hearing.goalY,behavior.hearing.event.y);
  assert.ok(behavior.curiosity[0].phase!=='ALERT','Sight beyond 20 m keeps its recognition grace period');
  assert.ok(behavior.curiosity.some(s=>s.phase==='CURIOUS'),'Vision enters the curious phase');
  assert.equal(behavior.curiosity.at(-1).phase,'ALERT','Sustained clear sight reaches full alert');
  const search=behavior.lostSight.phases.find(s=>s.phase==='SEARCH');
  assert.ok(search&&!search.visible,'An alerted guard searches after the player breaks sight');
  assert.ok(search.afterHideMs>=15000,'Red Mesa guards retain confirmed contact for fifteen seconds after sight breaks');
  assert.deepEqual({x:search.goalX,y:search.goalY},behavior.lostSight.lastSeen,'Search follows the last seen position, not the hidden player');
  assert.equal(behavior.lostSight.phases.at(-1).phase,'PATROL','Unsuccessful search eventually returns to patrol');
  assert.ok(behavior.crouchHidden&&behavior.proneHidden&&behavior.standingExposed&&behavior.aroundEdgeExposed,'Low cover hides a low stance only across the actual observer ray');
  assert.ok(behavior.lowCoverDuckHidden&&behavior.lowCoverPopExposed,'Native low-cover aiming reveals a ducked player as the head pops up');
  assert.ok(behavior.highCoverHidden&&behavior.highCoverPeek.valid&&behavior.highCoverPeek.exposed&&behavior.highCoverPeek.rootStillBlocked,'Native corner lean exposes the upper body while the collision root stays concealed');
  assert.ok(behavior.nightIllumination<behavior.dayIllumination,'Night reduces player illumination');
  assert.ok(behavior.shadowIllumination<behavior.sunlitIllumination,'Authored building shadows reduce player illumination without pixel readback');
  const scenes=[];
  for(const hour of [13,0]){
   const native=await page.evaluate(hour=>{
    const saved=window.__redMesaQA;player.hp=player.maxHp;player.x=saved.playerX;player.y=saved.playerY;
    worldTimeMs=hour/24*DAY_MS;updateSunVector();const times=[],p=p5.instance||window._p5Instance,stack=p?._styles?.length||0;
    for(let i=0;i<5;i++){
     zoom=(.45-.065)/.9;camX=player.x-width/(2*.45);camY=saved.def.y-height/(2*.45);
     deltaTime=1000/60;frameCount++;const t=performance.now();draw();if(i>0)times.push(performance.now()-t);
    }
    return {hour,times,stackBefore:stack,stackAfter:p?._styles?.length||0,
     gl:{ok:GLRig.ok,on:GLRig.on,error:GLRig.gl?.getError(),failure:GLRig.failure},fault:window.FRAME_FAULT||null,
     targets:[..._frontierBountyActors.values()].filter(e=>e.frontierBountyId==='RED_MESA'&&Number.isInteger(e.frontierBountySlot)).length,
     supports:[..._frontierBountyActors.values()].filter(e=>e.frontierBountyId==='RED_MESA'&&Number.isInteger(e.frontierBountySupportSlot)).length};
   },hour);
   native.screenshot=`red-mesa-${hour===13?'day':'night'}.png`;
   await page.screenshot({path:path.join(out,native.screenshot)});scenes.push(native);
   assert.equal(native.stackBefore,native.stackAfter,'Native p5 drawing stack stays balanced');
   assert.ok(native.gl.ok&&native.gl.on,'The advanced lighting rig remains active');
   assert.equal(native.gl.error,0,'Native WebGL has no GPU errors');assert.equal(native.fault,null,'Native draw completes');
   assert.equal(native.targets,5);assert.equal(native.supports,6);
  }
  assert.deepEqual(errors,[],'No uncaught browser errors');assert.deepEqual(rendererWarnings,[],'Canvas2D never requests WebGL attributes');
  const report={createdAt:new Date().toISOString(),sourceSha256:sha(source),p5Sha256:sha(p5),renderer:'Chromium SwiftShader; physical-device performance unmeasured',setup,behavior,scenes,errors,rendererWarnings};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await context.close();await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

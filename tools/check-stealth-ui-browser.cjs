// Native production-p5 checks: ordinary enemy perception and compact bounty UI.
// STEALTH_P5=/path/to/p5-1.9.0.min.js node tools/check-stealth-ui-browser.cjs
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {chromium}=require('playwright-core');
const repo=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(repo,'game.js'),'utf8');
const p5=fs.readFileSync(process.env.STEALTH_P5||'/workspace/newone-dev/vendor/p5-1.9.0.min.js','utf8');
const out=process.env.STEALTH_QA_OUT||'/tmp/stealth-ui-qa';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
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
 await page.route('http://stealth-qa.local/**',r=>{
  const url=r.request().url();
  if(url.endsWith('/p5.js'))return r.fulfill({contentType:'application/javascript',body:p5});
  if(url.endsWith('/game.js'))return r.fulfill({contentType:'application/javascript',body:source});
  if(/\.(mp3|wav)(\?.*)?$/.test(url))return r.fulfill({status:204,body:''});
  if(/\.png(\?.*)?$/.test(url))return r.fulfill({contentType:'image/png',body:blank});
  return r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html,body{margin:0;overflow:hidden;background:#111;touch-action:none}canvas{display:block}</style><script src="/p5.js"></script><script src="/game.js"></script>'});
 });
 try{
  await page.goto('http://stealth-qa.local/',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof leftStick!=='undefined'&&leftStick&&document.querySelector('canvas'));
  await page.evaluate(()=>{
   noLoop();randomSeed(7);noiseSeed(BIOME_SEED);seedWorldClock();
   isStoryMode=true;started=true;isDead=isWin=isPaused=false;window.outpostForts={};startAtLevel(3);
   inStoryIntro=inStoryRoom=killcamMode=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=inTravelMenu=inOverworldView=false;
   objectiveTimer=streakMsgTimer=0;window.showOnScreenControls=true;window.isDesktop=false;
   leftStick.active=rightStick.active=false;leftStick.dx=leftStick.dy=rightStick.dx=rightStick.dy=rightStick.dist=0;
   worldTimeMs=13/24*DAY_MS;updateSunVector();doTick=true;deltaTime=1000/60;glRigInit();GLRig.on=GLRig.ok;
  });
  const behavior=await checkBehavior(page);
  const scenes=await captureScenes(page);
  assert.deepEqual(errors,[],'No uncaught JavaScript exceptions');
  assert.deepEqual(rendererWarnings,[],'No Canvas2D/WebGL renderer warnings');
  const report={createdAt:new Date().toISOString(),sourceSha256:hash(source),p5Sha256:hash(p5),
   renderer:'Chromium SwiftShader; physical-device performance unmeasured',behavior,scenes,errors,rendererWarnings};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(`Native stealth/UI browser checks passed: ${scenes.length} scenes, source ${report.sourceSha256.slice(0,12)}; ${out}/report.json`);
 }finally{await context.close();await browser.close();}
}

async function checkBehavior(page){
 const result=await page.evaluate(()=>{
  const results={levels:[],silent:[],exceptions:{}};
  const sight=(e,t=player)=>typeof stealthPerceptionVisible==='function'?stealthPerceptionVisible(e,t):redMesaStealthVisible(e,t);
  const prepare=(level=1,distance=220)=>{
   currentLevel=currentBiome=level;BIOME_ACTIVE=true;frontierBounties.activeId=null;inOverworldView=level===1;
   nm0AmbushActive=farmAmbushActive=false;
   stealthPerceptionReset();worldTimeMs=13/24*DAY_MS;updateSunVector();
   resetActorStance(player);player.cover=null;player.mounted=false;player.dashTimer=0;player.hp=player.maxHp;
   player.x=5400+distance;player.y=-3600;player.isMoving=false;player.gait=0;player.aimAngle=0;
   leftStick.dx=leftStick.dy=0;activeBuildings=[];buildings=[];invalidateColIndex();
   const guard=new Character(5400,-3600,false,'NORMAL');
   guard.isArmed=true;guard.currentWeapon=WEAPONS.PISTOL;guard.isFriendly=guard.isNeutral=false;
   guard.state='PATROL';guard.aimAngle=0;guard.fireTimer=99999;
   guard.postX=guard.x;guard.postY=guard.y;guard.postR=0;
   enemiesList=[guard];return guard;
  };
  const tick=(e,dt=50)=>{deltaTime=dt;doTick=true;frameCount++;stealthUpdateNoise(dt);e.updateEnemy();return stealthPerceptionState(e);};
  for(const level of [1,3]){
   let guard=prepare(level),row={level,noContract:frontierBounties.activeId===null,eligible:stealthPerceptionActor(guard)};
   guard.aimAngle=Math.PI;row.awayCone=sight(guard);guard.aimAngle=0;row.frontCone=sight(guard);
   row.curiosity=[];
   for(let i=0;i<120;i++){
    guard.x=5400;guard.y=-3600;guard.aimAngle=0;
    const s=tick(guard);
    if(i===0||s.phase!==row.curiosity.at(-1).phase)row.curiosity.push({atMs:(i+1)*50,phase:s.phase,suspicion:s.suspicion,nativeState:guard.state});
    if(s.phase==='ALERT')break;
   }
   const s=stealthPerceptionState(guard),lastSeen={x:s.goalX,y:s.goalY};
   const wall={x:5510,y:-3600,w:38,h:600,coverType:'HIGH',hp:Infinity,maxHp:Infinity};
   activeBuildings=[wall];buildings=[wall];invalidateColIndex();player.x=5750;player.y=-3440;
   row.lostSight={lastSeen,hiddenPlayer:{x:player.x,y:player.y},phases:[]};
   for(let i=0;i<230;i++){
    const s=tick(guard);
    if(i===0||s.phase!==row.lostSight.phases.at(-1).phase)row.lostSight.phases.push({afterMs:(i+1)*50,phase:s.phase,visible:s.visible,goalX:s.goalX,goalY:s.goalY});
    if(s.phase==='PATROL')break;
   }
   guard=prepare(level);const low={x:5510,y:-3600,w:38,h:140,coverType:'LOW',hp:Infinity,maxHp:Infinity};
   activeBuildings=[low];buildings=[low];invalidateColIndex();
   resetActorStance(player,'CROUCH');row.crouchHidden=!sight(guard);
   resetActorStance(player,'PRONE');row.proneHidden=!sight(guard);
   resetActorStance(player);row.standingExposed=sight(guard);
   resetActorStance(player,'CROUCH');player.y=-3420;guard.aimAngle=Math.atan2(player.y-guard.y,player.x-guard.x);row.edgeExposed=sight(guard);
   guard=prepare(level,148);activeBuildings=[low];buildings=[low];invalidateColIndex();player.aimAngle=Math.PI;
   frameCount++;updateActorCover(player,100,-6,0,false);frameCount++;updateActorCover(player,100,-6,0,false);
   row.lowDuckHidden=!!player.cover&&!sight(guard);
   for(let i=0;i<3;i++){frameCount++;updateActorCover(player,100,-6,0,true);}
   row.lowPopExposed=!!player.cover&&player.cover.pop>.99&&sight(guard);
   results.levels.push(row);
  }
  let guard=prepare(1);
  for(const [name,throttle,gait,stance]of [['idle',0,0,'STAND'],['walk',.3,.3,'STAND'],['jog',.65,.65,'STAND'],['released run',.5,1,'STAND'],['crouch',1,1,'CROUCH'],['prone',1,1,'PRONE']]){
   resetActorStance(player,stance);player.isMoving=throttle>0;player.gait=gait;leftStick.dx=throttle;
   results.silent.push({name,radius:stealthRunningRadius(player)});
  }
  guard=prepare(1);guard.aimAngle=Math.PI;player.isMoving=true;player.gait=1;leftStick.dx=1;
  for(let i=0;i<12;i++){
   guard.aimAngle=Math.PI;player.x+=6;const s=tick(guard);
   if(s.heardId>0){const event=_redMesaNoise.events.find(e=>e.id===s.heardId);
    results.hearing={phase:s.phase,visible:s.visible,suspicion:s.suspicion,goalX:s.goalX,goalY:s.goalY,event};break;}
  }
  guard=prepare(3);player.isMoving=true;player.gait=1;leftStick.dx=1;results.materialRadii={};
  for(const kind of ['EARTH','TIMBER','STONE']){
   const zone=kind==='EARTH'?{x0:-250,x1:-200,y0:250,y1:280}:RED_MESA_SURFACES.find(z=>z.kind===kind);
   player.x=5400+(zone.x0+zone.x1)/2;player.y=-3600+(zone.y0+zone.y1)/2;results.materialRadii[kind]=stealthRunningRadius(player);
  }
  guard=prepare(1,178);const high={x:5510,y:-3600,w:100,h:140,coverType:'HIGH',hp:Infinity,maxHp:Infinity};
  activeBuildings=[high];buildings=[high];invalidateColIndex();player.y=-3544;guard.x=5300;guard.y=-3460;
  player.aimAngle=Math.atan2(guard.y-player.y,guard.x-player.x);guard.aimAngle=Math.atan2(player.y-guard.y,player.x-guard.x);
  results.highCoverHidden=!sight(guard);
  for(let i=0;i<3;i++){frameCount++;updateActorCover(player,100,-6,0,true);}
  results.highCoverPeek={valid:!!player.cover?.validPeek,exposed:sight(guard),rootStillBlocked:!hasLOS(guard.x,guard.y,player.x,player.y)};
  guard=prepare(1);results.dayIllumination=stealthIllumination(player);worldTimeMs=0;updateSunVector();frameCount+=6;results.nightIllumination=stealthIllumination(player);
  worldTimeMs=13/24*DAY_MS;updateSunVector();const caster={x:5400,y:-3600,w:32,h:32,_rise:45,hp:Infinity};
  player.x=5400+LIGHT_DX*40;player.y=-3600+LIGHT_DY*40;frameCount+=6;results.sunlitIllumination=stealthIllumination(player);
  activeBuildings=[caster];buildings=[caster];invalidateColIndex();frameCount+=6;results.shadowIllumination=stealthIllumination(player);
  guard=prepare(1);results.exceptions.regular=stealthPerceptionActor(guard);
  guard.isFriendly=true;results.exceptions.ally=stealthPerceptionActor(guard);guard.isFriendly=false;
  guard.isNeutral=true;results.exceptions.neutral=stealthPerceptionActor(guard);guard.isNeutral=false;
  guard.eType='ROBOT';results.exceptions.robot=stealthPerceptionActor(guard);guard.eType='NORMAL';
  guard.isAmbush=true;results.exceptions.scriptedAmbush=stealthPerceptionActor(guard);guard.isAmbush=false;
  guard.aggroTarget=new Character(5350,-3600,false,'NORMAL');guard.aggroTarget.isFriendly=true;
  results.exceptions.nonPlayerCombat=stealthPerceptionActor(guard);guard.aggroTarget=null;
  inTownCutscene=true;results.exceptions.cutscene=stealthPerceptionContext();inTownCutscene=false;inOverworldView=false;
  return results;
 });
 fs.writeFileSync(path.join(out,'behavior.json'),JSON.stringify(result,null,2));
 for(const row of result.levels){
  assert.ok(row.noContract&&row.eligible,`Level ${row.level}: ordinary guards use stealth with no bounty`);
  assert.ok(!row.awayCone&&row.frontCone,`Level ${row.level}: forward cone does not see behind`);
  assert.notEqual(row.curiosity[0].phase,'ALERT','First sight has a recognition grace period');
  assert.ok(row.curiosity.some(s=>s.phase==='CURIOUS'),'Sight passes through a curious phase');
  assert.ok(row.curiosity.some(s=>s.phase==='INVESTIGATE'),'Sustained sight investigates before alert');
  assert.equal(row.curiosity.at(-1).phase,'ALERT','Clear sustained sight confirms recognition');
  assert.equal(row.curiosity.at(-1).nativeState,'CHASE','Confirmed alert returns to native combat');
  const search=row.lostSight.phases.find(s=>s.phase==='SEARCH');
  assert.ok(search&&!search.visible,'Broken sight enters search');
  assert.deepEqual({x:search.goalX,y:search.goalY},row.lostSight.lastSeen,'Search follows history, not hidden player');
  assert.equal(row.lostSight.phases.at(-1).phase,'PATROL','Failed search restores native patrol');
  assert.ok(row.crouchHidden&&row.proneHidden&&row.standingExposed&&row.edgeExposed,'Low cover conceals across its physical rays');
  assert.ok(row.lowDuckHidden&&row.lowPopExposed,'Native low-cover pop exposes a previously ducked player');
 }
 assert.ok(result.silent.every(r=>r.radius===0),'Walk/jog/crouch/prone and eased run release are silent');
 assert.ok(result.hearing&&!result.hearing.visible&&result.hearing.phase==='CURIOUS','Ordinary guard hears running behind it without instant alert');
 assert.equal(result.hearing.goalX,result.hearing.event.x,'Sound goal preserves emission position');
 assert.equal(result.hearing.goalY,result.hearing.event.y);
 assert.ok(result.materialRadii.TIMBER>result.materialRadii.STONE&&result.materialRadii.STONE>result.materialRadii.EARTH,'Authored materials still scale noise outside active bounty');
 assert.ok(result.highCoverHidden&&result.highCoverPeek.valid&&result.highCoverPeek.exposed&&result.highCoverPeek.rootStillBlocked,'Native high-cover lean exposes the upper body while its root remains blocked');
 assert.ok(result.nightIllumination<result.dayIllumination&&result.shadowIllumination<result.sunlitIllumination,'Ordinary enemy illumination reflects night and building shadows');
 assert.deepEqual(result.exceptions,{regular:true,ally:false,neutral:false,robot:false,scriptedAmbush:false,nonPlayerCombat:false,cutscene:false},'Special actors, scripted combat and non-player fighting preserve their loops');
 return result;
}
async function captureScenes(page){
 const scenes=[];
 for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);
  await page.waitForFunction(()=>width===innerWidth&&height===innerHeight);
  await page.evaluate(()=>{
   isStoryMode=true;started=true;isDead=isWin=isPaused=false;startAtLevel(3);
   inStoryIntro=inStoryRoom=killcamMode=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=inTravelMenu=inOverworldView=false;
   objectiveTimer=streakMsgTimer=0;window.showOnScreenControls=true;window.isDesktop=false;
   leftStick.active=rightStick.active=false;leftStick.dx=leftStick.dy=rightStick.dx=rightStick.dy=rightStick.dist=0;
   resetFrontierBounties();const def=FRONTIER_BOUNTY_DEFS[0];frontierBounties.activeId=def.id;frontierBountyRecord(def).stage='ACTIVE';
   player.x=def.x;player.y=def.y+345;player.hp=player.maxHp;worldTimeMs=13/24*DAY_MS;updateSunVector();
   zoom=.45;camX=player.x-width/(2*zoom);camY=def.y-height/(2*zoom);
   viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;
   chunkMgr.update(player.x,player.y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();lastActiveUpdate=-100;updateActiveWorld();
   doTick=true;deltaTime=1000/60;frameCount++;updateFrontierBounties();glRigInit();GLRig.on=GLRig.ok;
   window.__stealthKillTarget=()=>{
    const victim=[..._frontierBountyActors.values()].find(e=>e.frontierBountyId==='RED_MESA'&&Number.isInteger(e.frontierBountySlot)&&!e.dead);
    if(!victim)return false;victim.hp=0;victim.dead=true;processKill(victim.x,victim.y,false,victim.eType,false,victim,player);return true;
   };
   __stealthKillTarget();__stealthKillTarget();
  });
  for(const stage of ['progress','ready']){
   if(stage==='ready')await page.evaluate(()=>{while(__stealthKillTarget());});
   const state=await page.evaluate(()=>{
    const p=p5.instance||window._p5Instance,stack=p?._styles?.length||0;
    const def=FRONTIER_BOUNTY_DEFS[0];
    const frames=frontierBountyRecord(def).stage==='READY'?28:12;
    for(let i=0;i<frames;i++){
     zoom=(.45-.065)/.9;camX=def.x-width/(2*.45);camY=def.y-height/(2*.45);
     deltaTime=1000/60;frameCount++;draw();
    }
    push();hudTextFont();textSize(12);const clockRight=width<380?width-12:width-70;
    const clockBounds={left:clockRight-textWidth(worldClockLabel()+' DAY'),right:clockRight};pop();
    return {width,height,stage:frontierBountyRecord(def).stage,killed:frontierBountyRecord(def).killed.length,
     layout:activityHudLayout(),clockBounds,toast:_frontierBountyToast,toastTicks:_frontierBountyToastTicks,
     stackBefore:stack,stackAfter:p?._styles?.length||0,
     gl:{ok:GLRig.ok,on:GLRig.on,error:GLRig.gl?.getError(),failure:GLRig.failure},fault:window.FRAME_FAULT||null};
   });
   state.screenshot=`bounty-${stage}-${viewport.width}x${viewport.height}.png`;
   await page.screenshot({path:path.join(out,state.screenshot)});scenes.push(state);
   assert.equal(state.stage,stage==='ready'?'READY':'ACTIVE');assert.equal(state.killed,stage==='ready'?5:2);
   assertNative(state);
   const b=state.layout.bounty,s=state.layout.stealth;
   assert.ok(b.h<=28&&b.x>=8&&b.x+b.w<=viewport.width-8,'Bounty stays in a short bounded rail');
   assert.ok(s.h<=24&&s.y>=b.y+b.h+3,'Suspicion has its own compact row');
   assert.ok(b.y+b.h<viewport.height*.5,'Bounty rail stays above the central action');
   if(viewport.width===320)assert.ok(state.clockBounds.left>220,'Narrow-phone climate text stays clear of the health bars');
   if(stage==='progress')assert.equal(state.toastTicks,0,'Individual kills do not create another notification');
  }
 }
 // Actual city exploration remains live while its ordinary guard notices the player.
 await page.evaluate(()=>{
  startAtLevel(1);started=true;isDead=isWin=isPaused=false;
  inStoryIntro=inStoryRoom=killcamMode=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=inTravelMenu=false;
  inOverworldView=true;nm0AmbushActive=farmAmbushActive=false;resetFrontierBounties();
  player.x=0;player.y=300;player.hp=player.maxHp;resetActorStance(player);
  worldTimeMs=13/24*DAY_MS;updateSunVector();objectiveTimer=streakMsgTimer=0;
  zoom=.75;camX=player.x-width/(2*zoom);camY=player.y-height/(2*zoom);
  chunkMgr.update(player.x,player.y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();lastActiveUpdate=-100;updateActiveWorld();
  const guard=new Character(210,300,false,'NORMAL');guard.isArmed=true;guard.currentWeapon=WEAPONS.PISTOL;
  guard.aimAngle=Math.PI;guard.fireTimer=99999;guard.state='PATROL';guard.postX=guard.x;guard.postY=guard.y;guard.postR=0;enemiesList.push(guard);
  window.__ordinaryStealthFixture=guard;stealthPerceptionReset();
 });
 const city=await page.evaluate(()=>{
  const p=p5.instance||window._p5Instance,stack=p?._styles?.length||0;
  for(let i=0;i<12;i++){deltaTime=1000/60;frameCount++;draw();}
  return {width,height,level:currentLevel,exploration:inOverworldView,guardEligible:stealthPerceptionActor(__ordinaryStealthFixture),
   phase:stealthPerceptionState(__ordinaryStealthFixture).phase,suspicion:stealthPerceptionState(__ordinaryStealthFixture).suspicion,
   hud:{..._activityStealthHud},layout:activityHudLayout(),stackBefore:stack,stackAfter:p?._styles?.length||0,
   gl:{ok:GLRig.ok,on:GLRig.on,error:GLRig.gl?.getError(),failure:GLRig.failure},fault:window.FRAME_FAULT||null};
 });
 city.screenshot='ordinary-enemy-stealth-city.png';await page.screenshot({path:path.join(out,city.screenshot)});scenes.push(city);
 assertNative(city);assert.ok(city.exploration&&city.guardEligible,'Native overworld exploration uses ordinary stealth');
 assert.ok(city.suspicion>0&&city.suspicion<1&&city.hud.visible>0,'City guard shows gradual recognition in the compact HUD');
 return scenes;
}
function assertNative(state){
 assert.equal(state.stackBefore,state.stackAfter,'Native p5 drawing stack remains balanced');
 assert.ok(state.gl.ok&&state.gl.on,'Advanced native lighting stays active');
 assert.equal(state.gl.error,0,'Native WebGL reports no rendering errors');
 assert.equal(state.fault,null,'Native full frame completes');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

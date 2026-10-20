// Real p5 city streets and native Character/input/projectile seams. The scene
// uses the generated street collision geometry; only unrelated army spawners
// are disabled so each resident's response can be observed independently.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const deps=process.env.VIS_DEPS||'/workspace/onboarding-newone';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'..','game.js'),'utf8');
const p5=fs.readFileSync(process.env.VIS_P5||'/tmp/p5-1.9.4.min.js','utf8');
const out=process.env.CITY_SUBCLASS_OUT||'/tmp/newone-city-subclasses';
fs.mkdirSync(out,{recursive:true});
const fixture=`
window.preload=function(){};
window.setup=function(){createCanvas(1460,675);pixelDensity(1);noLoop();randomSeed(19);noiseSeed(BIOME_SEED);
 leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
 window.__ready=true;};
window.__cityInit=function(){
 isStoryMode=true;started=true;isPaused=false;startAtLevel(1);
 isDead=isWin=killcamMode=inStoryIntro=inStoryRoom=false;
 inTownCutscene=inDarchonCall=inFarmCutscene=inFarmPostCutscene=false;
 inPostAmbushCutscene=inFortCutscene=inWorldBuildingMenu=inOverworldView=inTravelMenu=false;
 nm0AmbushActive=farmAmbushActive=false;darchonCallCompleted=true;objectiveTimer=0;
 enemiesList.length=townCitizens.length=bullets.length=particles.length=0;
 refreshPopulation=function(){};maintainHostiles=function(){};
 window.__refreshCity=refreshCityPeople;
 worldTimeMs=14/24*DAY_MS;isRaining=false;weather=null;updateSunVector();
 GLRig.on=false;GLRig.failure=GLRIG_SHED_MSG;window.isDesktop=false;
 window.__faults=[];const note=noteFrameFault;
 noteFrameFault=function(where,error){window.__faults.push(where+': '+error.message);return note(where,error);};
 window.__boxingEvents=[];const hit=worldBoxingHit;
 worldBoxingHit=function(e){const before=e.defender.punchHitCount||0;hit(e);
  window.__boxingEvents.push({who:e.defender.isPlayer?'PLAYER':e.defender.cityClass,
   outcome:e.outcome,before,after:e.defender.punchHitCount||0,stun:e.defender.stunTimer,
   hp:e.defender.hp,shield:e.defender.shield});};
 window.__streetShots=[];const shot=spawnBullet;
 spawnBullet=function(x,y,a,side,head,w,owner,...rest){
  window.__streetShots.push({type:owner&&owner.eType,cityClass:owner&&owner.cityClass,side});
  return shot.call(this,x,y,a,side,head,w,owner,...rest);
 };
 window.__pad=null;navigator.getGamepads=()=>window.__pad?[window.__pad]:[];
 window.__place=function(x,y,z=.9){player.x=x;player.y=y;player.forceNudge();zoom=z;
  camX=player.x-width/2/zoom;camY=player.y-height/2/zoom;
  viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;
  chunkMgr.update(x,y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();activeBuildings=buildings;invalidateColIndex();};
 window.__frame=function(n=1){for(let i=0;i<n;i++){deltaTime=1000/60;redraw();}};
 window.__clear=function(){
  if(typeof streetThugStopEncounter==='function')streetThugStopEncounter(0);
  resetCityStreetInputs();window.__pad=null;touches=[];window.isDesktop=false;mouseIsPressed=false;
  getBiomeState(1).streetThugGroups={};
  for(const e of enemiesList)if(boxingActive(e))boxingExit(e);
  if(boxingActive(player))boxingExit(player);finishWorldBoxing(player);
  enemiesList.length=bullets.length=particles.length=corpses.length=0;cityNoise=[];
  refreshCityPeople=function(){};worldTimeMs=14/24*DAY_MS;nm0AmbushActive=false;
  player.hp=player.maxHp=10000;player.shield=10000;player.dead=false;player.decals=[];
  player.currentWeapon=WEAPONS.PISTOL;player.weaponAmmo.PISTOL=100;player.mags.PISTOL=17;
  player.fireTimer=player.reloadTimer=player.meleeTimer=player.meleeCooldown=0;
  player.isArmed=true;player.isUnarmed=false;player.aimAngle=0;
  leftStick.active=rightStick.active=false;rightStick.dist=0;
  setMeleeTool('NONE');window.__boxingEvents=[];window.__streetShots=[];frameCount=1000;
  window.__place(60000,49800);
 };
 window.__person=function(type='CITY_NEUTRAL_M',seed=91,dx=60){
  const e=new Character(player.x+dx,player.y,false,type);cityAppearance(e,seed);
  e.cityCx=Math.floor(e.x/CHUNK_W);e.cityCy=Math.floor(e.y/CHUNK_W);
  e.cityPersonKey=e.cityCx+','+e.cityCy+',people:fixture-'+seed;
  e.cityDistance=0;e.aimAngle=Math.PI;e.cityActivity&&(e.cityActivity.durationMs=1e9);
  if(type==='CITY_THUG_M')restoreStreetThugRecord(e);
  enemiesList.push(e);window.__resident=e;return e;
 };
 window.__personState=function(e=window.__resident){return {x:e.x,y:e.y,hp:e.hp,dead:e.dead,
  state:e.state,stun:e.stunTimer,punches:e.punchHitCount||0,cityClass:e.cityClass,
  friendly:e.isFriendly,neutral:e.isNeutral,armed:e.isArmed,unarmed:e.isUnarmed,
  panic:e.panicTimer,activity:e.cityActivity&&{...e.cityActivity}};};
 window.__thugTalk=function(seed=101){
  window.__clear();worldTimeMs=22/24*DAY_MS;player.isArmed=false;player.isUnarmed=true;
  const e=window.__person('CITY_THUG_M',seed,112);updateCityCivilian(e);
  for(let i=0;i<90&&!(streetThugEncounter()&&streetThugEncounter().ready);i++)window.__frame();
  const a=streetThugEncounter();
  if(!a||!a.ready)throw Error('Night check never reached response range: '+JSON.stringify(window.__personState()));
  return {phrase:a.phrase,members:a.members.length,open:streetThugDialogueOpen(),hour:worldTimeMs/DAY_MS*24};
 };
 window.__dialogueKey=function(key){
  const native=keyIsDown;window.keyIsDown=n=>n===key;
  try{handleDesktop();}finally{window.keyIsDown=native;}
 };
 window.__clear();window.__frame();return {player:{x:player.x,y:player.y},buildings:buildings.length,
  allowed:cityCivilianAllowed(player.x,player.y),blocked:player.checkCol(player.x,player.y)};
};
`;
const html='<!doctype html><style>html,body{margin:0;background:#19252b}</style><script>'+
 '(function(){const m={};Object.defineProperty(window,"localStorage",{value:{getItem:k=>m[k]||null,setItem:(k,v)=>m[k]=String(v),removeItem:k=>delete m[k]}});})();'+
 '</script><script>'+p5+'</script><script>'+source+'</script><script>'+fixture+'</script>';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1460,height:675},hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.setContent(html,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__ready===true);
  const initial=await page.evaluate(()=>window.__cityInit());
  assert(initial.allowed&&!initial.blocked&&initial.buildings>0,'Fixture uses a legal generated city street');
  const walking=await page.evaluate(()=>{
   window.__clear();const e=window.__person();const before=window.__personState();window.__frame(32);
   return {before,after:window.__personState(),bullets:bullets.length,doTick,started,
    blocked:e.checkCol(e.x,e.y),legal:cityCivilianAllowed(e.x,e.y),view:inView(e.x,e.y),faults:window.__faults};
  });
  fs.writeFileSync(path.join(out,'walking-state.json'),JSON.stringify({initial,walking},null,2));
  await page.screenshot({path:path.join(out,'walking-initial.png')});
  assert(Math.hypot(walking.after.x-walking.before.x,walking.after.y-walking.before.y)>15,'Confident resident walks through real street geometry: '+JSON.stringify(walking));
  assert.equal(walking.after.cityClass,'NEUTRAL');assert.equal(walking.bullets,0);
  await page.screenshot({path:path.join(out,'confident-resident-city-day.png')});
  const aim=await page.evaluate(()=>{
   window.__clear();const e=window.__person('CITY_NEUTRAL_M',91,0);e.y+=180;
   rightStick.active=true;rightStick.dx=0;rightStick.dy=.4;rightStick.dist=.4;
   window.__frame(24);return {...window.__personState(),bullets:bullets.length};
  });
  assert.equal(aim.state,'FLEE','A loaded aimed gun scatters the confident resident');
  assert(aim.panic>0&&!aim.armed&&aim.friendly&&aim.neutral);assert.equal(aim.bullets,0);
  await page.screenshot({path:path.join(out,'confident-resident-flees-aim.png')});
  const noise=await page.evaluate(()=>{
   window.__clear();const e=window.__person('CITY_NEUTRAL_M',92,0);e.y+=180;
   player.fire(Math.PI);window.__frame(8);return window.__personState();
  });
  assert.equal(noise.state,'FLEE','A real gunshot frightens a confident civilian');assert(noise.hp===100&&noise.panic>0);
  const passive=await page.evaluate(()=>{
   window.__clear();window.__person('CITY_CITIZEN_F',93,40.5);
   player.activateMelee(true);window.__frame(24);
   return {person:window.__personState(),events:window.__boxingEvents,totalKills,score};
  });
  assert(passive.person.stun>0&&passive.person.hp===100,'Existing passive civilians retain first-punch nonlethal stun');
  await page.screenshot({path:path.join(out,'passive-civilian-first-punch-stun.png')});
  const fighting=await page.evaluate(()=>{
   window.__clear();const e=window.__person('CITY_NEUTRAL_M',94,40.5);
   player.activateMelee(true);window.__frame(24);const first=window.__personState();
   for(let i=0;i<36&&!e.stunTimer;i++){player.activateMelee(true);window.__frame(26);}
   return {first,last:window.__personState(),events:window.__boxingEvents,bullets:bullets.length};
  });
  fs.writeFileSync(path.join(out,'native-boxing-state.json'),JSON.stringify(fighting,null,2));
  assert(fighting.first.punches===1&&fighting.first.stun===0,'First native fist contact starts a confident civilian fight');
  const landed=fighting.events.filter(e=>e.who==='NEUTRAL'&&e.outcome==='HIT');
  assert(landed.length>=6,'Player can land six actual geometric fist contacts against the resident');
  assert(landed.slice(0,5).every(e=>e.stun===0)&&landed[5].stun>0,'Only the sixth actual hit stuns the confident civilian');
  assert(fighting.events.some(e=>e.who==='PLAYER'&&e.outcome==='HIT'),'Confident resident boxes back through native contacts');
  assert(fighting.last.hp===100&&!fighting.last.dead&&fighting.bullets===0,'Street boxing stays nonlethal and cannot emit gunfire');
  await page.screenshot({path:path.join(out,'confident-resident-six-hit-knockdown.png')});
  const fightPanic=await page.evaluate(()=>{
   window.__clear();const e=window.__person('CITY_NEUTRAL_M',95,45);
   startCityStreetFight(e,player);
   const shooter=new Character(player.x-100,player.y+120,false,'NM0_CITY_GUARD');
   shooter.currentWeapon=WEAPONS.PISTOL;shooter.isArmed=true;shooter.aimAngle=Math.PI;shooter.fire(Math.PI);
   window.__frame(3);
   return {person:window.__personState(),boxing:boxingActive(e),managed:e._boxingWorldManaged,fight:e.cityStreetFight};
  });
  fs.writeFileSync(path.join(out,'managed-boxer-gun-panic.json'),JSON.stringify(fightPanic,null,2));
  assert(fightPanic.person.panic>0&&fightPanic.person.state==='FLEE'&&!fightPanic.boxing&&!fightPanic.managed&&!fightPanic.fight,
   'Gunfire interrupts an actively managed street boxer');

  const dialogueLayouts=[];
  for(const size of [{width:1460,height:675},{width:390,height:844},{width:320,height:568},{width:640,height:360}]){
   await page.setViewportSize(size);
   const layout=await page.evaluate(({width:w,height:h})=>{
    resizeCanvas(w,h,true);
    leftStick.base={x:80,y:height-160};rightStick.base={x:width-80,y:height-110};
    const encounter=window.__thugTalk(109);window.__frame();
    const e=window.__resident;
    return {width,height,encounter,buttons:streetThugDialogueButtons(),actor:{x:(e.x-camX)*zoom,y:(e.y-camY)*zoom}};
   },size);
   assert(layout.encounter.open,'The nighttime check remains open at '+size.width+'x'+size.height);
   assert(layout.buttons.length===3&&layout.buttons.every(b=>b.x>=0&&b.y>=0&&b.x+b.w<=size.width&&b.y+b.h<=size.height),
    'All three response buttons remain inside '+size.width+'x'+size.height);
   assert(layout.buttons.every((b,i,a)=>!i||a[i-1].x+a[i-1].w<b.x),
    'Response touch targets do not overlap at '+size.width+'x'+size.height);
   dialogueLayouts.push(layout);
   await page.screenshot({path:path.join(out,'night-check-pending-'+size.width+'x'+size.height+'.png')});
  }
  fs.writeFileSync(path.join(out,'dialogue-layouts.json'),JSON.stringify(dialogueLayouts,null,2));
  await page.setViewportSize({width:1460,height:675});
  await page.evaluate(()=>{resizeCanvas(1460,675,true);leftStick.base={x:80,y:height-160};rightStick.base={x:width-80,y:height-110};});

  const positive=await page.evaluate(()=>{
   const check=window.__thugTalk();window.__dialogueKey(49);
   const e=window.__resident,g=streetThugGroup(e);
   return {check,person:window.__personState(),protected:streetThugCombatProtected(e),open:streetThugDialogueOpen(),
    gunRolls:g.gunRolls,roster:!!(e.isMilitary||e.isRecruit||e.isPopulation),shots:window.__streetShots.length};
  });
  assert(positive.check.open&&!positive.open&&positive.protected&&positive.person.friendly&&!positive.person.neutral,
   'Actual keyboard1 accepts a nighttime check and creates a protected local ally');
  assert(!positive.roster&&positive.gunRolls===0&&positive.shots===0,'A positive response grants neither recruits nor accidental fire');
  await page.screenshot({path:path.join(out,'night-check-positive-alliance.png')});

  const allyCombat=await page.evaluate(()=>{
   const e=window.__resident;let t=null;
   for(let i=0;i<8&&!t;i++){
    const a=i*Math.PI/4,candidate=new Character(e.x+Math.cos(a)*260,e.y+Math.sin(a)*260,false,'NM0_CITY_GUARD');
    candidate.isFriendly=false;candidate.isNeutral=false;candidate.hp=candidate.maxHp=1000;
    if(!candidate.checkCol(candidate.x,candidate.y)&&shovelActorLOS(e,candidate))t=candidate;
   }
   if(!t)throw Error('No clear generated street lane for allied thug versus NM0');
   t.updateEnemy=function(){};enemiesList.push(t);const hp=t.hp;window.__frame(100);
   const allyHp=e.hp,gun=e.cityThugGunDrawn;
   spawnBullet(e.x-35,e.y,0,true,'BODY',WEAPONS.PISTOL,player);
   for(let i=0;i<10;i++)updateBullets();
   const protectedHp=e.hp;nm0AmbushActive=true;
   updateEntities();cityPeopleFrame=-999;window.__refreshCity(chunkMgr,Math.floor(player.x/CHUNK_W),Math.floor(player.y/CHUNK_W));
   const retained=enemiesList.includes(e);nm0AmbushActive=false;
   return {before:hp,enemyHp:t.hp,allyHp,protectedHp,gun,retained,
    alliedShots:window.__streetShots.filter(s=>s.cityClass==='THUG'&&s.side).length,
    relation:e.cityThugRelationship,panic:e.panicTimer,roster:!!(e.isMilitary||e.isRecruit||e.isPopulation)};
  });
  assert(allyCombat.enemyHp<allyCombat.before&&allyCombat.alliedShots>0&&allyCombat.gun,
   'An aligned gang member fires real pistol rounds that damage nearby NM0');
  assert(allyCombat.allyHp===allyCombat.protectedHp&&allyCombat.retained&&!allyCombat.roster&&allyCombat.panic===0,
   'Player fire and ambush pruning preserve allied local thugs');
  await page.screenshot({path:path.join(out,'allied-thug-helps-against-nm0.png')});

  const neutral=await page.evaluate(()=>{
   const check=window.__thugTalk(102),e=window.__resident;window.__dialogueKey(50);
   const before={x:e.x,y:e.y},away=e.cityThugWalkAway;
   window.__frame(16);return {check,before,away,person:window.__personState(),open:streetThugDialogueOpen(),rolls:streetThugGroup(e).gunRolls};
  });
  assert(!neutral.open&&neutral.away>0&&neutral.person.neutral&&neutral.person.friendly&&neutral.rolls===0,
   'Keyboard2 declines the check without hostility or a gun roll');
  assert(Math.hypot(neutral.person.x-neutral.before.x,neutral.person.y-neutral.before.y)>12,'Neutral response visibly walks away');

  const negative=await page.evaluate(()=>{
   const check=window.__thugTalk(103),e=window.__resident;streetThugGroup(e).rng=12345;
   window.__dialogueKey(51);const g=streetThugGroup(e);
   return {check,person:window.__personState(),playerBoxing:boxingActive(player),boxing:boxingActive(e),fight:e.cityStreetFight,
    rolls:g.gunRolls,drawn:e.cityThugGunDrawn,open:streetThugDialogueOpen()};
  });
  assert(!negative.open&&negative.rolls===1&&negative.fight&&negative.boxing&&negative.playerBoxing&&!negative.drawn,
   'Keyboard3 starts the native fistfight after exactly one non-escalating roll');
  await page.screenshot({path:path.join(out,'night-check-negative-fistfight.png')});

  const rareGun=await page.evaluate(()=>{
   window.__thugTalk(104);const e=window.__resident;streetThugGroup(e).rng=1;window.__dialogueKey(51);
   const shield=player.shield;window.__frame(28);
   return {person:window.__personState(),drawn:e.cityThugGunDrawn,rolls:streetThugGroup(e).gunRolls,
    shots:window.__streetShots.filter(s=>s.cityClass==='THUG'&&!s.side).length,shieldBefore:shield,shieldAfter:player.shield};
  });
  assert(rareGun.drawn&&rareGun.person.armed&&rareGun.rolls===1&&rareGun.shots>0,
   'A rare negative escalation draws and fires the actual hostile pistol');
  await page.screenshot({path:path.join(out,'night-check-rare-pistol-escalation.png')});

  const touchReply=await page.evaluate(()=>{
   window.__thugTalk(105);const e=window.__resident,b=streetThugDialogueButtons()[0];
   const finger={id:41,x:b.x+b.w/2,y:b.y+b.h/2};touches=[finger];touchStarted();
   const point={x:player.x,y:player.y};window.__frame(4);const held={x:player.x,y:player.y,bullets:bullets.length};
   touches=[];window.__frame();return {protected:streetThugCombatProtected(e),open:streetThugDialogueOpen(),point,held,
    consumed:!!(window.__streetConsumedTouches&&window.__streetConsumedTouches.has(41))};
  });
  assert(touchReply.protected&&!touchReply.open&&touchReply.held.bullets===0,
   'The actual response touch selects Positive without firing');
  assert(Math.hypot(touchReply.held.x-touchReply.point.x,touchReply.held.y-touchReply.point.y)<.1&&!touchReply.consumed,
   'Holding and lifting the response finger cannot leak into joystick movement');

  const padReply=await page.evaluate(()=>{
   window.__thugTalk(106);const e=window.__resident;
   window.__pad={axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
   handleGamepad();window.__pad.buttons[15].pressed=true;handleGamepad();handleGamepad();
   window.__pad.buttons[0].pressed=true;handleGamepad();
   const first={open:streetThugDialogueOpen(),away:e.cityThugWalkAway,rolls:streetThugGroup(e).gunRolls};
   for(let i=0;i<4;i++)handleGamepad();
   const result={first,person:window.__personState(),rolls:streetThugGroup(e).gunRolls,bullets:bullets.length};
   window.__pad=null;return result;
  });
  assert(!padReply.first.open&&padReply.first.away>0&&padReply.person.neutral&&padReply.rolls===0&&padReply.bullets===0,
   'Standard gamepad D-pad right plus A selects Neutral once while held');
  const padCancel=await page.evaluate(()=>{
   window.__thugTalk(107);const e=window.__resident;
   window.__pad={axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
   handleGamepad();window.__pad.buttons[1].pressed=true;handleGamepad();
   const result={open:streetThugDialogueOpen(),away:e.cityThugWalkAway,rolls:streetThugGroup(e).gunRolls};
   window.__pad=null;return result;
  });
  assert(!padCancel.open&&padCancel.away>0&&padCancel.rolls===0,'Gamepad B safely chooses Neutral');

  const persistence=await page.evaluate(()=>{
   window.__thugTalk(108);window.__dialogueKey(49);const e=window.__resident;
   let point=null;
   for(let i=0;i<16&&!point;i++){
    const a=i*Math.PI/8,x=player.x+Math.cos(a)*1800,y=player.y+Math.sin(a)*1800;
    if(cityCivilianAllowed(x,y)&&!e.checkCol(x,y)&&cityPersonOffscreen(x,y))point={x,y};
   }
   if(!point)throw Error('No legal off-screen resident restoration point');
   e.x=point.x;e.y=point.y;e.cityPersonKey=e.cityCx+','+e.cityCy+',people:0';
   bankCityPerson(e);const key=e.cityPersonKey,savedSeed=e.citySeed,skin=e.skinCol.levels.join(',');
   saveGame();getBiomeState(1).streetThugGroups={};enemiesList=[];loadGame();
   isPaused=isDead=isWin=killcamMode=inStoryIntro=inStoryRoom=false;
   inTownCutscene=inDarchonCall=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=false;
   inWorldBuildingMenu=inOverworldView=inTravelMenu=false;
   GLRig.on=false;GLRig.failure=GLRIG_SHED_MSG;
   window.__place(player.x,player.y);
   for(let i=0;i<5&&!enemiesList.some(n=>n.cityPersonKey===key);i++){
    frameCount+=21;cityPeopleFrame=-999;
    window.__refreshCity(chunkMgr,Math.floor(player.x/CHUNK_W),Math.floor(player.y/CHUNK_W));
   }
   const restored=enemiesList.find(n=>n.cityPersonKey===key),record=getBiomeState(1).cityPeople[key];
   return {restored:!!restored,protected:streetThugCombatProtected(restored),offscreen:restored&&cityPersonOffscreen(restored.x,restored.y),
    seed:restored&&restored.citySeed,savedSeed,skin:restored&&restored.skinCol.levels.join(','),savedSkin:skin,
    class:record&&record.cityClass,relation:record&&record.streetThugRelationship,
    recruit:restored&&!!(restored.isMilitary||restored.isPopulation||restored.isRecruit),
    key,point,player:{x:player.x,y:player.y},record,loaded:chunkMgr.chunks.has(e.cityCx+','+e.cityCy),
    people:enemiesList.filter(e=>e.cityPersonKey).map(e=>e.cityPersonKey)};
  });
  fs.writeFileSync(path.join(out,'save-load-streaming-state.json'),JSON.stringify(persistence,null,2));
  assert(persistence.restored&&persistence.protected&&persistence.offscreen&&!persistence.recruit,
   'A local allied thug restores off screen through actual save/load and resident streaming');
  assert(persistence.seed===persistence.savedSeed&&persistence.skin===persistence.savedSkin&&persistence.class==='THUG'&&persistence.relation==='ALLY',
   'Save/load preserves subclass, seeded appearance and district alliance');
  const faults=await page.evaluate(()=>window.__faults);
  assert.deepEqual(errors,[]);assert.deepEqual(faults,[]);
  fs.writeFileSync(path.join(out,'scene-results.json'),JSON.stringify({sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),
   initial,walking,aim,noise,passive,fighting,fightPanic,dialogueLayouts,positive,allyCombat,neutral,negative,rareGun,touchReply,padReply,padCancel,persistence,errors,faults},null,2));
  console.log('Real city subclass scene passed: walking/activities, native six-hit boxing, gun panic, nighttime keyboard/touch/gamepad choices, rare escalation, allied NM0 combat, friendly-fire protection and save/load streaming.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

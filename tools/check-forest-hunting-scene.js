// Real p5 + real draw(): visit, receive bow, shoot, collect, return, save/load.
// VM checks cover arithmetic; this catches missing UI hooks and scene faults.
const fs=require('fs'),path=require('path'),assert=require('assert');
const deps=process.env.VIS_DEPS||'/workspace/onboarding-newone';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'..','game.js'),'utf8');
const p5=fs.readFileSync(process.env.VIS_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.HUNT_SCENE_OUT||'/tmp/newone-hunting-scene';
fs.mkdirSync(out,{recursive:true});
const fixture=`
window.preload=function(){};
window.setup=function(){createCanvas(1460,675);pixelDensity(1);noLoop();randomSeed(7);noiseSeed(BIOME_SEED);
leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
window.__ready=true;};
window.__initHunt=function(){
 isStoryMode=true;started=true;isPaused=false;startAtLevel(2);
 isDead=false;isWin=false;killcamMode=false;inStoryIntro=false;inStoryRoom=false;
 inTownCutscene=false;inDarchonCall=false;inFarmCutscene=false;inFarmPostCutscene=false;
 inPostAmbushCutscene=false;inFortCutscene=false;inWorldBuildingMenu=false;inOverworldView=false;inTravelMenu=false;
 nm0AmbushActive=false;darchonCallCompleted=true;objectiveTimer=0;
 enemiesList.length=0;townCitizens.length=0;bullets.length=0;particles.length=0;
 refreshPopulation=function(){};refreshCityPeople=function(){};
 resetForestHuntingActivity();resetForestWildlife();
 worldTimeMs=14/24*DAY_MS;isRaining=false;weather=null;updateSunVector();
 GLRig.on=false;GLRig.failure=GLRIG_SHED_MSG;
 window.__faults=[];const note=noteFrameFault;
 noteFrameFault=function(where,error){window.__faults.push(where+': '+error.message);return note(where,error);};
 const s=forestHuntingSite();if(!s)throw Error('No reachable settlement');
 window.__place=function(x,y){player.x=x;player.y=y;player.forceNudge();zoom=.85;
  camX=player.x-width/2/zoom;camY=player.y-height/2/zoom;
  viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;
  chunkMgr.update(x,y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();activeBuildings=buildings;invalidateColIndex();};
 window.__place(s.stewardX,s.stewardY+38);_wildlifeSpawnClock=1e9;redraw();
 return {site:s,lodges:activeBuildings.filter(b=>b.forestHuntingLodge).length,stage:forestHuntingQuest.stage};
};
`;
const html='<!doctype html><style>html,body{margin:0;background:#17251b}</style><script>'+
 '(function(){const m={};Object.defineProperty(window,"localStorage",{value:{getItem:k=>m[k]||null,setItem:(k,v)=>m[k]=String(v),removeItem:k=>delete m[k]}});})();'+
 '</script><script>'+p5+'</script><script>'+source+'</script><script>'+fixture+'</script>';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1460,height:675}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.setContent(html,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__ready===true);
  const initial=await page.evaluate(()=>window.__initHunt());assert.equal(initial.lodges,3);
  assert.equal(initial.stage,'UNMET');
  await page.screenshot({path:path.join(out,'settlement-before.png')});
  async function interact(){await page.keyboard.down('f');await page.evaluate(()=>redraw());
   await page.keyboard.up('f');await page.evaluate(()=>redraw());}
  await interact();
  const bow=await page.evaluate(()=>({stage:forestHuntingQuest.stage,unlocked:player.flags.bowUnlocked,
   weapon:player.currentWeapon.name,arrows:player.weaponAmmo.BOW}));
  assert.deepEqual(bow,{stage:'HUNT',unlocked:true,weapon:'BOW',arrows:24});
  await page.screenshot({path:path.join(out,'bow-granted.png')});
  const shot=await page.evaluate(()=>{
   const s=forestHuntingSite();window.__place(s.x,s.y+135);
   // A stationary elk on verified courtyard approach. We use the real weapon
   // muzzle, pooled Bullet, segment collision and real scene; never call hit().
   const a=wildlifeSpawnAnimal('ELK',player.x+205,player.y);a.angle=0;a.thinkAt=1e9;
   a.goalX=a.x;a.goalY=a.y;window.__huntElk=a;
   player.aimAngle=0;headAimToggle=true;player.fireTimer=0;player.fire(0);
   rightStick.active=false;leftStick.active=false;window.isDesktop=false;
   for(let i=0;i<12;i++)redraw();
   return {dead:a.dead,condition:a.condition,method:a.method,shots:a.shots,arrows:player.weaponAmmo.BOW};
  });
  assert.deepEqual(shot,{dead:true,condition:'PERFECT',method:'BOW_HEAD',shots:1,arrows:23});
  await page.evaluate(()=>{window.__place(window.__huntElk.x,window.__huntElk.y+45);redraw();});
  await page.screenshot({path:path.join(out,'harvest-prompt.png')});
  await interact();
  const harvest=await page.evaluate(()=>({stage:forestHuntingQuest.stage,rows:forestHuntInventory.map(x=>({...x}))}));
  assert.equal(harvest.stage,'RETURN');assert.equal(harvest.rows.length,1);
  assert.equal(harvest.rows[0].condition,'PERFECT');assert.equal(harvest.rows[0].state,'DEAD');assert.equal(harvest.rows[0].count,1);
  await page.evaluate(()=>{isPaused=true;pauseMenuState='TABLET';redraw();});
  // Click the visible tablet row through the game's real touch/mouse handler.
  await page.mouse.click(730,675/2+22);await page.evaluate(()=>redraw());
  assert.equal(await page.evaluate(()=>pauseMenuState),'INVENTORY');
  await page.screenshot({path:path.join(out,'inventory.png')});
  const returned=await page.evaluate(()=>{isPaused=false;const s=forestHuntingSite();window.__place(s.stewardX,s.stewardY+38);
   window.__rewardBefore={wood:resourceCount('WOOD'),stone:resourceCount('STONE')};redraw();return forestHuntingQuest.stage;});
  assert.equal(returned,'RETURN');await interact();
  const reward=await page.evaluate(()=>({stage:forestHuntingQuest.stage,reward:forestHuntingQuest.rewardGranted,
   wood:resourceCount('WOOD')-window.__rewardBefore.wood,stone:resourceCount('STONE')-window.__rewardBefore.stone,
   arrows:player.weaponAmmo.BOW,items:forestHuntInventory.length}));
  assert.deepEqual(reward,{stage:'COMPLETE',reward:true,wood:60,stone:20,arrows:24,items:0});
  await page.screenshot({path:path.join(out,'lesson-complete.png')});
  const restored=await page.evaluate(()=>{saveGame();resetForestHuntingActivity();resetForestWildlife();loadGame();
   return {stage:forestHuntingQuest.stage,unlocked:player.flags.bowUnlocked,arrows:player.weaponAmmo.BOW,items:forestHuntInventory.length};});
  assert.deepEqual(restored,{stage:'COMPLETE',unlocked:true,arrows:24,items:0});
  const faults=await page.evaluate(()=>window.__faults);assert.deepEqual(errors,[]);assert.deepEqual(faults,[]);
  const report={p5:await page.evaluate(()=>window.p5.VERSION),sourceSha:require('crypto').createHash('sha256').update(source).digest('hex'),
   initial,bow,shot,harvest,reward,restored,errors,faults};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

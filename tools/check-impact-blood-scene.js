// Actual p5 renderer and pooled projectiles: human floor impacts, walking
// arrow trails, material/shield exclusions and timed anatomical animal wounds.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const deps=process.env.VIS_DEPS||'/workspace/onboarding-newone';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'..','game.js'),'utf8');
const p5=fs.readFileSync(process.env.VIS_P5||'/tmp/p5-1.9.4.min.js','utf8');
const out=process.env.IMPACT_BLOOD_OUT||'/tmp/newone-impact-blood';
fs.mkdirSync(out,{recursive:true});
const fixture=`
window.preload=function(){};
window.setup=function(){createCanvas(1460,675);pixelDensity(1);noLoop();randomSeed(7);noiseSeed(BIOME_SEED);
 leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
 window.__ready=true;};
window.__initBloodScene=function(){
 isStoryMode=true;started=true;isPaused=false;startAtLevel(2);
 isDead=false;isWin=false;killcamMode=false;inStoryIntro=false;inStoryRoom=false;
 inTownCutscene=false;inDarchonCall=false;inFarmCutscene=false;inFarmPostCutscene=false;
 inPostAmbushCutscene=false;inFortCutscene=false;inWorldBuildingMenu=false;inOverworldView=false;inTravelMenu=false;
 nm0AmbushActive=false;darchonCallCompleted=true;objectiveTimer=0;
 enemiesList.length=0;townCitizens.length=0;bullets.length=0;particles.length=0;
 refreshPopulation=function(){};refreshCityPeople=function(){};
 maintainHostiles=function(){};
 resetForestHuntingActivity();resetForestWildlife();_wildlifeSpawnClock=1e9;
 worldTimeMs=14/24*DAY_MS;isRaining=false;weather=null;updateSunVector();
 GLRig.on=false;GLRig.failure=GLRIG_SHED_MSG;window.isDesktop=false;
 window.__faults=[];const note=noteFrameFault;
 noteFrameFault=function(where,error){window.__faults.push(where+': '+error.message);return note(where,error);};
 window.__stamps=[];const stamp=stampGroundBlobs;
 stampGroundBlobs=function(x,y,blobs,col,spread){
  window.__stamps.push({x,y,spread,blobs:blobs.map(b=>({...b})),col:col.levels&&[...col.levels]});
  return stamp.apply(this,arguments);
 };
 window.__wildHits=[];const hit=applyForestWildlifeHit;
 applyForestWildlifeHit=function(a,h){const result=hit(a,h);window.__wildHits.push({species:a.species,head:h.head,vital:!!h.vital,
  power:h.arrowPower,weapon:h.weapon&&h.weapon.name||h.weapon,x:h.x,y:h.y,result:{...result}});return result;};
 window.__place=function(x,y){player.x=x;player.y=y;player.forceNudge();zoom=.77;
  camX=player.x-width/2/zoom;camY=player.y-height/2/zoom;
  viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;
  chunkMgr.update(x,y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();activeBuildings=buildings;invalidateColIndex();};
 window.__frame=function(ms=1000/60){deltaTime=ms;redraw();};
 window.__clear=function(){
  enemiesList.length=0;bullets.length=0;particles.length=0;corpses.length=0;
  resetForestWildlife();_wildlifeSpawnClock=1e9;wipeAllBloodBanks();useBloodBank('blood-scene');
  window.__stamps=[];window.__wildHits=[];
  player.hp=player.maxHp=100;player.shield=0;player.dead=false;player.decals=[];
  player.fireTimer=0;player.reloadTimer=0;player.isReloading=false;
  player.currentWeapon=WEAPONS.PISTOL;player.weaponAmmo.PISTOL=50;player.weaponAmmo.BOW=50;
  player.isMoving=false;
  leftStick.active=rightStick.active=false;rightStick.dist=0;
 };
 window.__target=function(type='NORMAL',x=player.x+205,y=player.y){
  const t=new Character(x,y,false,type);t.isNeutral=false;t.isFriendly=false;t.isArmed=false;t.aimAngle=0;
  t.updateEnemy=function(){};enemiesList.push(t);window.__victim=t;return t;
 };
 window.__fireAt=function(t,weapon,head=false){
  player.currentWeapon=WEAPONS[weapon];player.fireTimer=0;headAimToggle=head;
  const angle=Math.atan2(t.y-player.y,t.x-player.x);player.aimAngle=angle;
  const forward=weapon==='BOW'?38.9:31,side=weapon==='BOW'?0:8;
  const muzzle={x:player.x+Math.cos(angle)*forward-Math.sin(angle)*side,
   y:player.y+Math.sin(angle)*forward+Math.cos(angle)*side};
  player.fire(Math.atan2(t.y-muzzle.y,t.x-muzzle.x),weapon==='BOW'?{tension:.9,quality:1,dud:false,power:1}:null);
  for(let i=0;i<24&&bullets.some(b=>b.active);i++)window.__frame();
  return {hp:t.hp,headHP:t.headHP,dead:t.dead,stamps:window.__stamps.map(s=>({...s})),holes:t.decals?t.decals.length:0};
 };
 window.__floorPixel=function(x,y){
  const cx=Math.floor(x/CHUNK_SIZE),cy=Math.floor(y/CHUNK_SIZE),e=bloodChunks[bloodKey(cx,cy,false)];
  if(!e)return[0,0,0,0];
  const px=Math.floor(x-cx*CHUNK_SIZE-e.bx),py=Math.floor(y-cy*CHUNK_SIZE-e.by);
  if(px<0||py<0||px>=e.pg.width||py>=e.pg.height)return[0,0,0,0];
  return Array.from(e.pg.drawingContext.getImageData(px,py,1,1).data);
 };
 const s=forestHuntingSite();window.__place(s.x,s.y+135);window.__clear();window.__frame();
 return {site:s,player:{x:player.x,y:player.y},zoom};
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
  const initial=await page.evaluate(()=>window.__initBloodScene());
  const human=await page.evaluate(()=>{
   window.__clear();const t=window.__target();const before=t.hp;
   const result=window.__fireAt(t,'PISTOL');return {before,...result};
  });
  assert(human.hp<human.before&&!human.dead,'Real pistol damages a living human');
  const smallRed=s=>s.blobs.length===3&&s.blobs.every(b=>b.sz>=3&&b.sz<=8)&&s.col[0]===111&&s.col[1]===9&&s.col[2]===16;
  assert(human.stamps.some(smallRed),'Human impact uses the animal\'s three small directional red floor drops');
  await page.screenshot({path:path.join(out,'human-pistol-small-floor-impact.png')});
  const arrow=await page.evaluate(()=>{
   window.__clear();const t=window.__target();t.hp=t.maxHp=1000;
   const shot=window.__fireAt(t,'BOW');
   const first=window.__stamps.find(s=>s.blobs.length===3),b=first&&first.blobs[0];
   const p=b&&{x:first.x+b.ox,y:first.y+b.oy};window.__oldDrop=p;
   window.__oldInk=p&&window.__floorPixel(p.x,p.y);window.__arrowStart={x:t.x,y:t.y,stamps:window.__stamps.length};
   for(let i=0;i<100;i++){t.attemptMove(0,1.8);window.__frame();}
   return {shot,start:window.__arrowStart,end:{x:t.x,y:t.y},stamps:window.__stamps,
    oldDrop:p,oldInk:window.__oldInk,newInk:p&&window.__floorPixel(p.x,p.y)};
  });
  fs.writeFileSync(path.join(out,'walking-arrow-state.json'),JSON.stringify(arrow,null,2));
  assert(Math.hypot(arrow.end.x-arrow.start.x,arrow.end.y-arrow.start.y)>100,
   'Arrow-wounded actor walks through real movement and steers around generated props');
  assert(arrow.stamps.length>arrow.start.stamps+2,'Arrow leaves continuing floor droplets');
  assert(arrow.oldInk&&arrow.oldInk[3]>0&&arrow.newInk[3]>0,'Original blood stays in the painted floor bank after actor moves');
  assert(arrow.stamps.slice(arrow.start.stamps).some(s=>s.y>arrow.start.y+40),'New blood trail follows the moving victim');
  await page.screenshot({path:path.join(out,'walking-human-arrow-trail-mobile-zoom.png')});
  const exclusions=await page.evaluate(()=>{
   const result={};
   for(const type of ['ROBOT','SAUCER','ARMORED','ARMORED_STANDARD']){
    window.__clear();const t=window.__target(type,player.x+95,player.y);
    result[type]=window.__fireAt(t,'PISTOL',true);
   }
   window.__clear();player.shield=100;player.hp=100;const shooter=window.__target('NORMAL',player.x-160,player.y);
   spawnBullet(player.x-80,player.y,0,false,'BODY',WEAPONS.PISTOL,shooter);
   for(let i=0;i<15;i++)window.__frame();
   result.SHIELD={hp:player.hp,shield:player.shield,stamps:window.__stamps,holes:player.decals.length};
   window.__clear();player.shield=2;player.hp=100;const overflowShooter=window.__target('NORMAL',player.x-160,player.y);
   spawnBullet(player.x-80,player.y,0,false,'BODY',WEAPONS.PISTOL,overflowShooter);
   for(let i=0;i<15;i++)window.__frame();
   result.OVERFLOW={hp:player.hp,shield:player.shield,stamps:window.__stamps,holes:player.decals.length};
   return result;
  });
  fs.writeFileSync(path.join(out,'material-exclusion-state.json'),JSON.stringify(exclusions,null,2));
  for(const type of ['ROBOT','SAUCER','ARMORED','ARMORED_STANDARD'])
   assert(!exclusions[type].stamps.some(smallRed),type+' hard-surface hit does not make flesh blood');
  assert(exclusions.ROBOT.headHP<150&&exclusions.SAUCER.hp<750&&exclusions.ARMORED.hp<600&&exclusions.ARMORED_STANDARD.hp<300,
   'Every hard-surface control is a real projectile hit, rather than a missed shot');
  assert(exclusions.SHIELD.shield<100&&exclusions.SHIELD.hp===100&&exclusions.SHIELD.holes===0&&!exclusions.SHIELD.stamps.some(smallRed),
   'Absorbed real projectile leaves the player and floor bloodless');
  assert(exclusions.OVERFLOW.hp<100&&exclusions.OVERFLOW.shield===0&&exclusions.OVERFLOW.stamps.some(smallRed),
   'A real projectile that overruns the shield leaves the small floor blood when health is damaged');
  const vital=await page.evaluate(()=>{
   window.__clear();const a=wildlifeSpawnAnimal('ELK',player.x+205,player.y);a.angle=Math.PI/2;
   a.goalX=a.x;a.goalY=a.y;a.sensorAt=a.thinkAt=1e12;
   // A broadside arrow at the front torso intersects lungs, without crossing
   // the head or pretending a HEAD toggle selects the anatomical target.
   const target={x:a.x,y:a.y+a.bodyR*.24};
   const before=a.hp;window.__fireAt(target,'BOW',false);
   a.sensorAt=a.thinkAt=1e12;a.vx=a.vy=0;a.goalX=a.x;a.goalY=a.y;
   window.__bleedingAnimal=a;
   const started=a.arrowVitalBleed&&a.arrowVitalBleed.remainingMs;
   const hit=window.__wildHits[0];const beforePause=a.hp;
   isPaused=true;updateForestWildlife(3,10000);isPaused=false;
   const pause={hpUnchanged:a.hp===beforePause,timeUnchanged:a.arrowVitalBleed&&a.arrowVitalBleed.remainingMs===started};
   const wait=Math.max(0,started-100);
   for(let ms=0;ms<wait;ms+=100){frameCount++;updateForestWildlife(3,Math.min(100,wait-ms));}
   const almost={hp:a.hp,dead:a.dead,remaining:a.arrowVitalBleed&&a.arrowVitalBleed.remainingMs};
   frameCount++;updateForestWildlife(3,100);
   return {before,started,hit,pause,almost,dead:a.dead,hp:a.hp,condition:a.condition,method:a.method,
    deathType:a.deathType,stamps:window.__stamps.length,shots:a.shots,headshots:a.headshots};
  });
  assert(vital.hit&&!vital.hit.head&&vital.hit.vital,'Real broadside arrow detects a vital body path');
  assert(vital.started>59000&&vital.started<=60000,'Vital wound starts a one-minute active-gameplay timer');
  assert(vital.pause.hpUnchanged&&vital.pause.timeUnchanged,'Pause freezes health loss and the vital deadline');
  assert(!vital.almost.dead&&vital.almost.hp>0&&vital.almost.remaining<=101,'Animal remains alive immediately before one minute');
  assert(vital.dead&&vital.hp===0&&vital.method==='BOW'&&vital.condition==='FAIR'&&vital.deathType==='BODY_COLLAPSE',
   'Minute expires into the existing bow-body corpse and hunting condition');
  await page.evaluate(()=>{window.__frame();});
  await page.screenshot({path:path.join(out,'vital-arrow-one-minute-bleedout.png')});
  const nonvital=await page.evaluate(()=>{
   window.__clear();const a=wildlifeSpawnAnimal('ELK',player.x+205,player.y);a.angle=Math.PI/2;
   a.goalX=a.x;a.goalY=a.y;a.sensorAt=a.thinkAt=1e12;
   const target={x:a.x,y:a.y-a.bodyR*.65};window.__fireAt(target,'BOW',true);
   a.sensorAt=a.thinkAt=1e12;a.vx=a.vy=0;a.goalX=a.x;a.goalY=a.y;
   const afterShot=a.hp;for(let i=0;i<610;i++){frameCount++;updateForestWildlife(3,100);}
   return {hit:window.__wildHits[0],afterShot,hp:a.hp,dead:a.dead,bleed:!!a.arrowVitalBleed,stamps:window.__stamps.length};
  });
  assert(nonvital.hit&&!nonvital.hit.head&&!nonvital.hit.vital,'HEAD mode does not convert rear-body arrow to vital/head');
  assert(!nonvital.dead&&!nonvital.bleed&&nonvital.hp===nonvital.afterShot,'A nonvital body wound drips without a one-minute death');
  const faults=await page.evaluate(()=>window.__faults);assert.deepEqual(errors,[]);assert.deepEqual(faults,[]);
  const report={p5:await page.evaluate(()=>window.p5.VERSION),sourceSha:crypto.createHash('sha256').update(source).digest('hex'),
   initial,human,arrow,exclusions,vital,nonvital,errors,faults};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log('Impact blood scene passed: p5 '+report.p5+'; real human/animal arrows and pistol hits, small floor blood, moving trails, shield/material exclusions, pause and sixty-second vital bleedout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

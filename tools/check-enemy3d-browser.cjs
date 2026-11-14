// Actual Character.show dispatch, GPU appearance, and many-enemy review.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.ENEMY3D_OUT||'/tmp/enemy3d-qa';
const source=fs.readFileSync(process.env.GAME_JS||path.join(root,'game.js'),'utf8');
const p5=fs.readFileSync(process.env.PLAYER3D_P5||'/workspace/.environment/newone/node_modules/p5/lib/p5.min.js','utf8');
fs.mkdirSync(out,{recursive:true});
const bootstrap=`preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(1200,1300);pixelDensity(1);noLoop();window.__ready=true;};`;

async function main(){
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:1300},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||String(e)));
  await page.route('http://enemy3d.local/**',r=>{
   const url=r.request().url();
   if(url.endsWith('/p5.js'))return r.fulfill({contentType:'application/javascript',body:p5});
   if(url.endsWith('/game.js'))return r.fulfill({contentType:'application/javascript',body:source});
   const init=url.includes('/world')?'preload=function(){};':bootstrap;
   return r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0;background:#b2bbb5}canvas{display:block}</style><script src="/p5.js"></script><script src="/game.js"></script><script>'+init+'</script>'});
  });
  await page.goto('http://enemy3d.local/',{waitUntil:'load'});await page.waitForFunction(()=>window.__ready);
  await page.evaluate(()=>{
   started=doTick=true;isStoryMode=isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inCutscene=inOverworldView=false;
   currentLevel=currentBiome=2;BIOME_ACTIVE=false;window.inNM0SecretOverlay=false;buildGhost=null;
   resetUndergroundRoute();setMeleeTool('NONE');buildings=activeBuildings=[];barrels=[];activeParkingCars=[];enemiesList=[];invalidateColIndex();
   chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
   leftStick={active:false,dx:0,dy:0,dist:0};rightStick={active:false,dx:0,dy:0,dist:0};
   camX=camY=0;zoom=1;viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;LIGHT_DX=.7;LIGHT_DY=.7;
   player=new Character(1000,1000,true);
   window.__enemyFresh=(type='NORMAL',weapon='PISTOL',stance='STAND')=>{
    const c=new Character(0,0,false,type);c.currentWeapon=WEAPONS[weapon];c.isArmed=false;c.state='CHASE';c.isFriendly=c.isNeutral=false;
    c.aimAngle=-.8;c.moveAngle=.5;c.isMoving=true;c.gait=.65;c.walkCycle=.9;c.armDrag=.7;c.aimHold=14;c.ammo=100;
    c.reloadTimer=c.meleeTimer=c.weaponKick=c.muzzleFlash=c.hitFlash=c.skeletonTimer=c.stunTimer=0;
    resetActorStance(c,stance);return c;
   };
   window.__enemyPaint=(c,x=160,y=170,size=2.4,native=false)=>{
    const enabled=Player3D.enabled,before=Player3D.stats.draws||0;Player3D.enabled=!native;
    push();translate(x,y);scale(size);c.show();pop();Player3D.enabled=enabled;
    return (Player3D.stats.draws||0)-before;
   };
   window.__enemyCapture=c=>{clear();const used=__enemyPaint(c);return {used,pixels:drawingContext.getImageData(0,0,400,400).data};};
   window.__enemyCases=[
    ['Male rookie','NM0_ROOKIE','PISTOL','STAND'],['Female rookie','NM0_ROOKIE_F','PISTOL','STAND'],
    ['Normal rifle','NORMAL','ASSAULT_RIFLE','STAND'],['Normal shotgun','NORMAL','SHOTGUN','STAND'],
    ['Armored standard','ARMORED_STANDARD','ASSAULT_RIFLE','STAND'],['Armor damaged','ARMORED_STANDARD','ASSAULT_RIFLE','STAND',40],
    ['Grey fatigues','NM0_GREY_FATIGUE','ASSAULT_RIFLE','STAND'],['Military','MILITARY_NEUTRAL','ASSAULT_RIFLE','STAND'],
    ['Bandit','BANDIT','REVOLVER','STAND'],['Female pistol','FEMALE_PISTOL','PISTOL','STAND'],
    ['Rifle crouch','NORMAL','ASSAULT_RIFLE','CROUCH'],['Bandit reload','BANDIT','REVOLVER','STAND',null,45],
    ['Firebomb','MOLOTOV','PISTOL','STAND'],['City guard','NM0_CITY_GUARD','ASSAULT_RIFLE','STAND'],
    ['Explicit armed rifle','NORMAL','ASSAULT_RIFLE','STAND',null,null,true],['Female crouch','NM0_ROOKIE_F','PISTOL','CROUCH']
   ];
  });
  const report=await page.evaluate(()=>{
   const rows=[];background(178,187,181);textFont('sans-serif');textAlign(CENTER);noStroke();fill(28,42,44);textSize(21);text('Human enemies · native / shared 3D',600,30);
   for(let i=0;i<__enemyCases.length;i++){
    const [name,type,weapon,stance,hp,reload,armed]=__enemyCases[i],c=__enemyFresh(type,weapon,stance),x=(i%4)*300,y=Math.floor(i/4)*310+65;
    if(hp)c.hp=hp;if(reload)c.reloadTimer=reload;if(armed!==undefined)c.isArmed=armed;
    const nativeDraws=__enemyPaint(c,x+54,y+160,2.2,true),meshDraws=__enemyPaint(c,x+202,y+160,2.2);
    const pose=player3DPose(c),torso=pose.parts.find(p=>p.part==='torso');
    const paletteMatches=!!torso&&torso.color.every((v,k)=>Math.abs(v-c.shirtCol.levels[k])<1);
    const bottle=pose.parts.find(p=>p.mesh==='flask');
    rows.push({name,type,weapon,stance,hp:c.hp,nativeDraws,meshDraws,paletteMatches,parts:pose.parts.map(p=>p.part),bottleColor:bottle&&bottle.color});
    noStroke();fill(28,42,44);textSize(15);text(name,x+150,y+12);textSize(11);text('native',x+70,y+258);text('shared 3D',x+220,y+258);
   }
   return {gallery:rows,stats:{...Player3D.stats},gpuError:Player3D.gl.getError()};
  });
  await page.screenshot({path:path.join(out,'enemy-contact-sheet.png')});
  for(const row of report.gallery){
   assert.equal(row.nativeDraws,0,'comparison really uses native '+row.name);
   assert.ok(row.meshDraws>0,'Character.show uses the shared mesh for '+row.name);
   assert.ok(row.paletteMatches,'uniform color survives shared mesh '+row.name);
   if(row.type==='MOLOTOV')assert.ok(!row.parts.includes('weapon_primary')&&row.bottleColor&&row.bottleColor[1]>row.bottleColor[0],'firebomb enemy retains green bottle without a pistol');
  }
  assert.equal(report.gpuError,0,'no GPU errors in gallery');
  report.exclusions=await page.evaluate(()=>{
   const rows=[];
   for(const type of ['ARMORED','ROBOT','BUG','SNAIL','COW','HORSE','AERIAL','AERIAL_PISTOL','ALIEN_GATOR','SAUCER','SNAIL_HYBRID']){
    const c=__enemyFresh(type);clear();rows.push({name:type,eligible:enemy3DLivingEligible(c),draws:__enemyPaint(c)});
   }
   const injured=__enemyFresh();const started=beginLegInjury(injured,{a:0},0);
   if(!started)throw Error('native leg-injury fixture did not initialize');
   for(const phase of ['FALL','PRONE','SEATED']){
    injured.legInjury.phase=phase;injured.legInjury.phaseMs=phase==='FALL'?300:0;
    injured.legInjury.outcome=phase==='SEATED'?'SEATED':'PRONE';legInjurySetHeight(injured);clear();
    rows.push({name:'injury '+phase,eligible:enemy3DLivingEligible(injured),draws:__enemyPaint(injured)});
   }
   const prone=__enemyFresh('NORMAL','ASSAULT_RIFLE','PRONE');prone.muzzleFlash=3;clear();
   rows.push({name:'prone firing',eligible:enemy3DLivingEligible(prone),draws:__enemyPaint(prone)});
   for(const [name,setup] of [['friendly rookie',c=>{c.isFriendly=true;}],['neutral military',c=>{c.isNeutral=true;}],
    ['unarmed human',c=>{c.isUnarmed=true;}],['electric skeleton',c=>{c.skeletonTimer=40;}],['stunned',c=>{c.stunTimer=40;}],
    ['civilian',c=>{c.eType='FARMER_MALE';}],['mounted bandit',c=>{c.eType='BANDIT';c.mountUp(.2);}]]){
    const c=__enemyFresh();setup(c);clear();rows.push({name,eligible:enemy3DLivingEligible(c),draws:__enemyPaint(c)});
   }
   const c=__enemyFresh(),corpse=new Corpse(0,0,0,0,c.shirtCol,c.pantsCol,0,0,[],c.currentWeapon,0,c.eType,c.bodyW,c.bodyH,c);
   corpse.fP=1;clear();const before=Player3D.stats.draws||0;push();translate(160,170);scale(2.4);corpse.paint(window);pop();
   rows.push({name:'enemy corpse',draws:(Player3D.stats.draws||0)-before});return rows;
  });
  for(const row of report.exclusions){assert.equal(row.draws,0,'excluded native path '+row.name);if('eligible'in row)assert.equal(row.eligible,false,'eligibility rejects '+row.name);}
  report.effects=await page.evaluate(()=>{
   const difference=(a,b)=>{let pixels=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])+Math.abs(a[i+3]-b[i+3])>25)pixels++;return pixels;};
   const c=__enemyFresh('NORMAL','ASSAULT_RIFLE');c.isMoving=false;c.gait=0;
   const clean=__enemyCapture(c).pixels;c.hitFlash=3;const flashed=__enemyCapture(c).pixels;c.hitFlash=0;
   c.muzzleFlash=3;const fired=__enemyCapture(c).pixels;c.muzzleFlash=0;c.reloadTimer=45;const reloaded=__enemyCapture(c).pixels;
   c.reloadTimer=0;c.decals=[{x:0,y:0,sz:6,isHead:true,col:[255,0,0,255]}];const wounded=__enemyCapture(c).pixels;
   Player3D.enabled=false;const before=Player3D.stats.draws;push();translate(160,170);c.show();pop();Player3D.enabled=true;
   return {flashPixels:difference(clean,flashed),muzzlePixels:difference(clean,fired),reloadPixels:difference(clean,reloaded),woundPixels:difference(clean,wounded),disabledDraws:Player3D.stats.draws-before};
  });
  for(const name of ['flashPixels','muzzlePixels','reloadPixels','woundPixels'])assert.ok(report.effects[name]>20,'visible enemy effect '+name);
  assert.equal(report.effects.disabledDraws,0,'disabled GPU falls back to native enemy');

  const frames=path.join(out,'motion');fs.mkdirSync(frames,{recursive:true});
  await page.setViewportSize({width:1200,height:700});
  await page.evaluate(()=>{resizeCanvas(1200,700);window.__motionEnemies=[__enemyFresh('NM0_ROOKIE'),__enemyFresh('NM0_ROOKIE_F'),__enemyFresh('NORMAL','ASSAULT_RIFLE'),__enemyFresh('ARMORED_STANDARD','SHOTGUN'),__enemyFresh('NM0_GREY_FATIGUE','ASSAULT_RIFLE'),__enemyFresh('BANDIT','REVOLVER')];});
  report.motion=[];
  for(let i=0;i<60;i++){
   report.motion.push(await page.evaluate(i=>{
    frameCount++;background(178,187,181);textFont('sans-serif');textAlign(CENTER);noStroke();fill(28,42,44);textSize(18);
    text('Native',600,30);text('Shared 3D · turn / walk / fire / crouch / reload',600,365);
    let used=0;
    for(let j=0;j<__motionEnemies.length;j++){
     const c=__motionEnemies[j];c.aimAngle=-1+i*.07;c.moveAngle=c.aimAngle+1.2;c.walkCycle=i*.24;c.gait=.65;c.isMoving=true;
     resetActorStance(c,i>=25&&i<45?'CROUCH':'STAND');c.reloadTimer=i>=43?Math.max(1,90-(i-43)*4):0;c.muzzleFlash=i<43&&i%14<3?3:0;
     const x=70+j*200+Math.sin(i*.08+j)*9;__enemyPaint(c,x,180,2.3,true);used+=__enemyPaint(c,x,510,2.3);
     noStroke();fill(28,42,44);textSize(12);text(c.eType,100+j*200,310);text(c.eType,100+j*200,650);
    }
    return {frame:i,meshDraws:used};
   },i));
   await page.screenshot({path:path.join(frames,String(i).padStart(3,'0')+'.png')});
  }
  assert.ok(report.motion.every(f=>f.meshDraws>=6),'all six enemies keep shared meshes through animation');
  const video=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','24','-i',path.join(frames,'%03d.png'),'-c:v','libx264','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'enemy-motion.mp4')]);
  assert.equal(video.status,0,String(video.stderr));
  report.crowd=await page.evaluate(()=>{
   const actors=Array.from({length:24},(_,i)=>__enemyFresh(...[['NM0_ROOKIE','PISTOL'],['NM0_ROOKIE_F','PISTOL'],['NORMAL','ASSAULT_RIFLE'],['ARMORED_STANDARD','SHOTGUN'],['NM0_GREY_FATIGUE','ASSAULT_RIFLE'],['BANDIT','REVOLVER']][i%6]));
   const run=native=>{let used=0;clear();for(let i=0;i<actors.length;i++){
    const c=actors[i];c.aimAngle=-1+i*.12;c.walkCycle=frameCount*.18+i;
    used+=__enemyPaint(c,50+i%8*145,90+Math.floor(i/8)*200,1.25,native);
   }return used;};
   run(false);const before=Player3D.stats.meshUploads,native=[],mesh=[];let draws=0;
   for(let i=0;i<12;i++){frameCount++;let t=performance.now();run(true);native.push(performance.now()-t);t=performance.now();draws+=run(false);mesh.push(performance.now()-t);}
   const summarize=a=>{a.sort((x,y)=>x-y);return {median:a[Math.floor(a.length/2)],p95:a[a.length-1]};};
   return {actors:actors.length,meshDraws:draws,uploadsBefore:before,uploadsAfter:Player3D.stats.meshUploads,nativeMs:summarize(native),sharedMs:summarize(mesh),gpuError:Player3D.gl.getError(),renderer:Player3D.getDiagnostics()};
  });
  await page.screenshot({path:path.join(out,'enemy-crowd.png')});
  assert.equal(report.crowd.meshDraws,24*12,'crowd actors all use meshes');
  assert.equal(report.crowd.uploadsAfter,report.crowd.uploadsBefore,'many enemies reuse GPU meshes');assert.equal(report.crowd.gpuError,0);

  // Exercise actual game setup/draw, depth sorting and scene lighting too.
  await page.goto('http://enemy3d.local/world',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof width==='number'&&width>0&&!!document.querySelector('canvas'));
  report.world=await page.evaluate(()=>{
   noLoop();randomSeed(7);noiseSeed(BIOME_SEED);isStoryMode=true;started=true;isDead=isWin=isPaused=false;
   window.outpostForts={};seedWorldClock();startAtLevel(3);
   inStoryIntro=inStoryRoom=killcamMode=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=inTravelMenu=inOverworldView=false;
   window.showOnScreenControls=false;window.isDesktop=true;leftStick.active=rightStick.active=false;
   player.x=1300;player.y=-1730;player.aimAngle=-Math.PI/2;player.isArmed=true;player.aimHold=14;
   const types=['NM0_ROOKIE','NM0_ROOKIE_F','NORMAL','ARMORED_STANDARD','NM0_GREY_FATIGUE','BANDIT'];
   enemiesList=Array.from({length:18},(_,i)=>{const a=i*Math.PI*2/18,c=new Character(player.x+Math.cos(a)*125,player.y+Math.sin(a)*125,false,types[i%6]);
    c.isFriendly=c.isNeutral=false;c.state='CHASE';c.currentWeapon=i%3?WEAPONS.PISTOL:WEAPONS.ASSAULT_RIFLE;c.isArmed=false;c.aimAngle=a+Math.PI;c.gait=.6;c.walkCycle=i*.6;return c;});
   worldTimeMs=13/24*DAY_MS;updateSunVector();chunkMgr.update(player.x,player.y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();lastActiveUpdate=-100;updateActiveWorld();
   const before=Player3D.stats.draws;for(let i=0;i<3;i++){zoom=(1.7-.065)/.9;camX=player.x-width/3.4;camY=player.y-height/3.4;frameCount++;draw();}
   const firstDraws=Player3D.stats.draws-before,native=[],mesh=[];
   // Freeze simulation while comparing the same real scene and live lighting.
   // SwiftShader timings are evidence about this test machine, not a device FPS promise.
   isPaused=true;for(let i=0;i<6;i++){
    Player3D.enabled=false;frameCount++;let t=performance.now();draw();native.push(performance.now()-t);
    Player3D.enabled=true;frameCount++;t=performance.now();draw();mesh.push(performance.now()-t);
   }
   isPaused=false;frameCount++;draw();
   const summarize=a=>{a.sort((x,y)=>x-y);return {median:a[Math.floor(a.length/2)],p95:a[a.length-1]};};
   return {meshDraws:firstDraws,enemies:enemiesList.length,fault:window.FRAME_FAULT||null,nativeFrameMs:summarize(native),sharedFrameMs:summarize(mesh),worldLighting:{ok:GLRig.ok,on:GLRig.on,failure:GLRig.failure},stats:Player3D.getDiagnostics()};
  });
  await page.screenshot({path:path.join(out,'enemies-in-game.png')});
  assert.ok(report.world.meshDraws>18&&!report.world.fault,'real game world draws shared enemy meshes');
  assert.deepEqual(errors,[],'no uncaught browser errors');report.sourceBytes=Buffer.byteLength(source);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,gallery:report.gallery.length,exclusions:report.exclusions,effects:report.effects,crowd:report.crowd,world:report.world},null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

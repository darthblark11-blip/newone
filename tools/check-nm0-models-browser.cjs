// Inspect the real NM0 soldier dispatch at native game scale and enlarged.
// GAME_JS can point at a saved revision for an exact before/after comparison;
// NM0_MODEL_ALLOW_OLD=1 records an old shell without its known exposure failure.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.NM0_MODEL_OUT||'/tmp/nm0-models-qa';
const source=fs.readFileSync(process.env.GAME_JS||path.join(root,'game.js'),'utf8');
const allowOld=process.env.NM0_MODEL_ALLOW_OLD==='1';
const p5=fs.readFileSync(process.env.PLAYER3D_P5||'/workspace/.environment/newone/node_modules/p5/lib/p5.min.js','utf8');
const blank=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR3kAAAAASUVORK5CYII=','base64');
const bootstrap=`preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(1200,1720);pixelDensity(1);noLoop();window.__ready=true;};`;
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:1200,height:1720},deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack||String(e)));
 await page.route('http://nm0-models.local/**',r=>{
  const u=r.request().url();
  if(u.endsWith('/p5.js'))return r.fulfill({contentType:'application/javascript',body:p5});
  if(u.endsWith('/game.js'))return r.fulfill({contentType:'application/javascript',body:source});
  if(/\.(mp3|wav)(\?.*)?$/.test(u))return r.fulfill({status:204,body:''});
  if(/\.png(\?.*)?$/.test(u))return r.fulfill({contentType:'image/png',body:blank});
  const init=u.includes('/world')?'preload=function(){};':bootstrap;
  return r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#aeb6af}canvas{display:block}</style><script src="/p5.js"></script><script src="/game.js"></script><script>'+init+'</script>'});
 });
 try{
  await page.goto('http://nm0-models.local/',{waitUntil:'load'});await page.waitForFunction(()=>window.__ready);
  await page.evaluate(()=>{
   started=doTick=true;isStoryMode=isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inCutscene=inOverworldView=false;
   currentLevel=currentBiome=2;BIOME_ACTIVE=false;window.inNM0SecretOverlay=false;buildGhost=null;
   resetUndergroundRoute();setMeleeTool('NONE');buildings=activeBuildings=[];barrels=[];activeParkingCars=[];enemiesList=[];invalidateColIndex();
   chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
   leftStick={active:false,dx:0,dy:0,dist:0};rightStick={active:false,dx:0,dy:0,dist:0};
   camX=camY=0;zoom=1;viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;
   player=new Character(1000,1000,true);
   window.__nm0Fresh=(type,weapon='PISTOL',stance='STAND',angle=0,hp=100,npc=true)=>{
    const c=new Character(0,0,!npc,type);c.isFriendly=c.isNeutral=false;c.state='CHASE';
    c.currentWeapon=WEAPONS[weapon];c.hp=c.maxHp=100;c.hp=hp;c.isArmed=!npc;
    c.aimAngle=c.moveAngle=angle;c.aimHold=14;c.isMoving=false;c.gait=c.walkCycle=c.armDrag=0;c.ammo=100;
    c.reloadTimer=c.meleeTimer=c.muzzleFlash=c.hitFlash=c.weaponKick=c.stunTimer=c.skeletonTimer=0;
    resetActorStance(c,stance);return c;
   };
   window.__nm0Specs=[
    ['Grey rifle','NM0_GREY_FATIGUE','ASSAULT_RIFLE','STAND',100],
    ['Grey crouch','NM0_GREY_FATIGUE','ASSAULT_RIFLE','CROUCH',100],
    ['Armored pistol','ARMORED_STANDARD','PISTOL','STAND',100],
    ['Armored crouch','ARMORED_STANDARD','PISTOL','CROUCH',100],
    ['Armor broken','ARMORED_STANDARD','PISTOL','STAND',50],
    ['Female rookie reference','NM0_ROOKIE_F','PISTOL','STAND',100],
    ['Player reference','NORMAL','PISTOL','STAND',100,false]
   ];
   window.__nm0State=c=>JSON.stringify([c.x,c.y,c.hp,c.maxHp,c.state,c.aimAngle,c.moveAngle,c.currentWeapon.name,c.isArmed]);
  });
  const report={sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),allowOld,galleries:[],heads:[],world:[]};
  for(const night of [false,true]){
   const result=await page.evaluate(night=>{
    background(night?65:178,night?78:187,night?78:181);textFont('sans-serif');textAlign(CENTER);noStroke();fill(night?225:28);textSize(22);
    text('NM0 silhouettes · '+(night?'dim / side light':'daylight')+' · actual living dispatch',600,30);
    LIGHT_DX=night?-.7:.7;LIGHT_DY=.7;worldTimeMs=(night?.03:13/24)*DAY_MS;updateSunVector();
    const rows=[];
    for(let row=0;row<__nm0Specs.length;row++)for(let col=0;col<4;col++){
     const [label,type,weapon,stance,hp,npc]=__nm0Specs[row],angle=[0,-Math.PI/2,Math.PI,Math.PI/2][col];
     const c=__nm0Fresh(type,weapon,stance,angle,hp,npc!==false);if(npc===false)player=c;
     const before=__nm0State(c),draws=Player3D.stats.draws,calls=Player3D.stats.gpuDrawCalls;
     const x=150+col*300,y=165+row*232;
     push();translate(x,y);scale(2.8);c.show();const s=player3DLiveSnapshot(c);pop();
     noStroke();fill(night?225:28);textSize(12);text(label+' · '+['east','north','west','south'][col],x,y+73);
     rows.push({label,type,weapon,stance,angle,drawn:Player3D.stats.draws>draws,gpuCalls:Player3D.stats.gpuDrawCalls-calls,
      parts:s?s.parts.map(p=>p.part):[],partCount:s?s.parts.length:0,head:s&&s.sockets.head,view:s&&s.renderView,
      unchanged:__nm0State(c)===before,helmet:s&&s.parts.some(p=>p.mesh==='helmet')});
    }
    return {night,rows,gpuError:Player3D.gl.getError(),stats:{...Player3D.stats}};
   },night);
   report.galleries.push(result);await page.screenshot({path:path.join(out,night?'soldiers-dim.png':'soldiers-day.png')});
   assert.equal(result.gpuError,0);assert.ok(result.rows.every(r=>r.drawn&&r.view&&r.view.enabled&&r.unchanged),'actual dispatch, perspective and gameplay state survive the gallery');
   for(const row of result.rows){
    assert.ok(row.partCount<=48,'soldier part count remains bounded: '+JSON.stringify(row));
    assert.ok(row.gpuCalls<=64,'inspection loadout stays within its small GPU draw budget: '+JSON.stringify(row));
    if(row.type==='ARMORED_STANDARD'&&row.label==='Armor broken')assert.equal(row.helmet,false,'damaged guard removes its helmet');
   }
  }
  await page.setViewportSize({width:1200,height:620});
  report.heads=await page.evaluate(()=>{
   resizeCanvas(1200,620);background(178,187,181);textFont('sans-serif');textAlign(CENTER);fill(28,42,44);noStroke();textSize(20);text('Helmet openings · front / side, source skin versus worn shell',600,30);
   const rows=[],light={lighting:{direction:[-.4,-.5,.85],contrast:1}};
   const headView=(s,turn)=>{
    const h=s.sockets.head,a=-1.35,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(turn),sb=Math.sin(turn);
    return {...s,parts:s.parts.filter(p=>['head','helmet','headwear','neck'].includes(p.part)).map(p=>{
     const m=Array.from(p.matrix);m[12]-=h.x;m[13]-=h.y;m[14]-=h.z;
     for(const k of [0,4,8,12]){const x=m[k],y=m[k+1],z=m[k+2],u=ca*x+sa*z,v=-sa*x+ca*z;m[k]=u;m[k+1]=cb*y-sb*v;m[k+2]=sb*y+cb*v;}
     return {...p,matrix:new Float32Array(m)};
    })};
   };
   const skinPixels=s=>{
    const g=createGraphics(230,230);g.pixelDensity(1);g.clear();g.translate(115,115);g.scale(8);Player3D.draw(s,g.drawingContext,light);
    const px=g.drawingContext.getImageData(0,0,230,230).data;g.remove();let count=0;
    for(let i=0;i<px.length;i+=4)if(px[i+3]>200&&px[i]>px[i+1]*1.22&&px[i+1]>px[i+2]*1.12)count++;
    return count;
   };
   for(let j=0;j<4;j++)for(let i=0;i<2;i++){
    const [type,label,military]=[['NM0_GREY_FATIGUE','NM0 grey'],['ARMORED_STANDARD','NM0 armored'],['NM0_CITY_GUARD','City guard'],['MILITARY_NEUTRAL','Army',true]][j];
    const c=__nm0Fresh(type);c.isMilitary=!!military;const pose=player3DPose(c),s=headView(pose,i*.75);
    const bare={...s,parts:s.parts.filter(p=>p.part==='head')},full=skinPixels(s),reference=skinPixels(bare);
    push();translate(150+j*300,170+i*290);scale(8);Player3D.draw(s,drawingContext,light);pop();
    fill(28,42,44);noStroke();textSize(12);text(label+' '+(i?'side':'front'),150+j*300,285+i*290);
    const top={...pose,parts:pose.parts.filter(p=>['head','helmet','headwear','neck'].includes(p.part)).map(p=>{
     const m=Array.from(p.matrix);m[12]-=pose.sockets.head.x;m[13]-=pose.sockets.head.y;m[14]-=pose.sockets.head.z;return {...p,matrix:new Float32Array(m)};
    })},bareTop={...top,parts:top.parts.filter(p=>p.part==='head')};
    const topSkin=skinPixels(top),topReference=skinPixels(bareTop);
    rows.push({type,label,side:!!i,visibleSkin:full,bareSkin:reference,fraction:full/Math.max(1,reference),
     topVisibleSkin:topSkin,topBareSkin:topReference,topFraction:topSkin/Math.max(1,topReference),
     headRadius:Math.hypot(s.parts.find(p=>p.part==='head').matrix[0],s.parts.find(p=>p.part==='head').matrix[1],s.parts.find(p=>p.part==='head').matrix[2])});
   }
   return rows;
  });
  await page.screenshot({path:path.join(out,'helmet-openings.png')});
  for(const row of report.heads){
   assert.ok(row.fraction>(allowOld?.25:.60),'helmet leaves cheeks and eye area exposed: '+JSON.stringify(row));
   assert.ok(Math.abs(row.headRadius-5.5)<.0001,'helmet refinement preserves native head radius');
   if(!allowOld)assert.ok(row.topFraction>.02,'the overhead game view retains a visible skin crescent: '+JSON.stringify(row));
  }
  if(process.env.NM0_MODEL_MOTION==='1'){
   const frames=path.join(out,'motion');fs.mkdirSync(frames,{recursive:true});
   await page.setViewportSize({width:1200,height:680});
   await page.evaluate(()=>{
    resizeCanvas(1200,680);window.__nm0Motion=[__nm0Fresh('NM0_GREY_FATIGUE','ASSAULT_RIFLE'),__nm0Fresh('ARMORED_STANDARD','PISTOL'),
     __nm0Fresh('NM0_GREY_FATIGUE','ASSAULT_RIFLE'),__nm0Fresh('ARMORED_STANDARD','PISTOL')];
   });
   report.motion=[];
   for(let i=0;i<48;i++){
    report.motion.push(await page.evaluate(i=>{
     frameCount++;background(178,187,181);textFont('sans-serif');textAlign(CENTER);fill(28,42,44);noStroke();textSize(20);
     text('NM0 infantry and pistol armor · independent hips / shoulders · crouch / reload',600,30);
     textSize(13);text('Enlarged inspection',600,330);text('Native game scale',600,645);
     const before=Player3D.stats.draws;
     for(let j=0;j<4;j++){
      const c=__nm0Motion[j];c.aimAngle=-Math.PI/2+i*Math.PI*2/48;c.moveAngle=c.aimAngle+.8;c.walkCycle=i*.30;c.isMoving=true;c.gait=.65;c.armDrag=.7;
      c.reloadTimer=i>=36?Math.max(1,90-(i-36)*6):0;c.muzzleFlash=i<36&&i%16<2?3:0;resetActorStance(c,i>=20&&i<35?'CROUCH':'STAND');
      for(const [y,size]of [[185,3.2],[515,1.7]]){push();translate(150+j*300,y);scale(size);c.show();pop();}
      fill(28,42,44);noStroke();textSize(12);text(j%2?'Armored pistol':'Grey rifle',150+j*300,285);
     }
     return {frame:i,draws:Player3D.stats.draws-before,uploads:Player3D.stats.meshUploads,gpuError:Player3D.gl.getError()};
    },i));
    await page.screenshot({path:path.join(frames,String(i).padStart(3,'0')+'.png')});
   }
   assert.ok(report.motion.every(r=>r.draws===8&&r.gpuError===0),'every moving, crouching and reloading soldier renders');
   assert.ok(report.motion.every(r=>r.uploads===report.motion[0].uploads),'motion reuses the loaded GPU meshes');
   const movie=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','24','-i',path.join(frames,'%03d.png'),'-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'soldier-model-motion.mp4')]);
   assert.equal(movie.status,0,String(movie.stderr));
  }
  await page.setViewportSize({width:960,height:540});
  await page.goto('http://nm0-models.local/world',{waitUntil:'load'});
  await page.waitForFunction(()=>typeof leftStick!=='undefined'&&!!leftStick&&typeof width==='number'&&width>0);
  await page.evaluate(()=>{
   noLoop();randomSeed(7);noiseSeed(BIOME_SEED);isStoryMode=true;started=true;isDead=isWin=isPaused=false;window.outpostForts={};seedWorldClock();startAtLevel(2);objectiveTimer=streakMsgTimer=0;
   inStoryIntro=inStoryRoom=killcamMode=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=inTravelMenu=inOverworldView=false;
   window.showOnScreenControls=false;window.isDesktop=true;leftStick.active=rightStick.active=false;leftStick.dx=leftStick.dy=rightStick.dx=rightStick.dy=0;
   player.x=4000;player.y=1800;player.aimAngle=0;player.isArmed=true;player.aimHold=14;player.currentWeapon=WEAPONS.PISTOL;
   chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
   const cases=[[-150,-45,'NM0_GREY_FATIGUE','ASSAULT_RIFLE',0],[-25,-45,'ARMORED_STANDARD','PISTOL',Math.PI/2],
    [150,-45,'NM0_GREY_FATIGUE','ASSAULT_RIFLE',Math.PI],[-145,85,'ARMORED_STANDARD','PISTOL',0],
    [15,85,'NM0_GREY_FATIGUE','ASSAULT_RIFLE',-Math.PI/2],[145,85,'NM0_ROOKIE_F','PISTOL',Math.PI]];
   enemiesList=cases.map(([x,y,type,w,a],i)=>{const c=new Character(player.x+x,player.y+y,false,type);c.isFriendly=c.isNeutral=false;c.state='CHASE';c.isArmed=false;c.currentWeapon=WEAPONS[w];c.aimAngle=c.moveAngle=a;c.fireTimer=99999;c.gait=0;c.walkCycle=0;c.hp=c.maxHp=100;resetActorStance(c,i===4?'CROUCH':'STAND');return c;});
   worldTimeMs=13/24*DAY_MS;updateSunVector();chunkMgr.update(player.x,player.y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();lastActiveUpdate=-100;updateActiveWorld();
   // Keep the inspection lane clear while retaining native ground, shadows,
   // emitters, sorting and actor dispatch from the real game draw.
   buildings=buildings.filter(b=>Math.abs(b.x-player.x)>280||Math.abs(b.y-player.y)>230);activeBuildings=buildings;invalidateColIndex();
   for(const ch of chunkMgr.chunks.values())ch.decor=ch.decor.filter(d=>Math.abs(d.x-player.x)>310||Math.abs(d.y-player.y)>240);
   zoom=(1.7-.065)/.9;camX=player.x-width/3.4;camY=player.y-height/3.4;isPaused=false;
   const nativeUpdate=updateEntities;updateEntities=function(){const tick=doTick;doTick=false;try{return nativeUpdate();}finally{doTick=tick;}};
  });
  for(const time of [13/24,6.2/24]){
   report.world.push(await page.evaluate(time=>{
    worldTimeMs=time*DAY_MS;updateSunVector();frameCount++;lastActiveUpdate=frameCount;const before=Player3D.stats.draws;draw();
    return {time,enemies:enemiesList.length,draws:Player3D.stats.draws-before,fault:window.FRAME_FAULT||null,
     gpuError:Player3D.gl.getError(),lighting:{ok:GLRig.ok,on:GLRig.on},actors:enemiesList.map(c=>{const s=player3DLiveSnapshot(c);return {type:c.eType,weapon:c.currentWeapon.name,view:s&&s.renderView,parts:s&&s.parts.length};})};
   },time));
   await page.screenshot({path:path.join(out,time>.3?'world-day.png':'world-dawn.png')});
  }
  assert.ok(report.world.every(r=>r.draws>=7&&!r.fault&&r.gpuError===0),'real game world draws all inspected actors without faults');
  assert.deepEqual(errors,[],'no uncaught browser errors');report.errors=errors;
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({out,sourceSha256:report.sourceSha256,galleryRows:report.galleries.map(r=>r.rows.length),heads:report.heads,world:report.world.map(r=>({time:r.time,draws:r.draws,lighting:r.lighting})),errors},null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

// Native fatal projectiles leave the old pooled blood and a new fixed vector
// stain. Review both the actual corpse layer and the unobstructed baked floor.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.KILL_VECTOR_OUT||'/tmp/newone-kill-vector-splatter';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:2000,height:1110},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(2000,1110);pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('__ready');
  await page.evaluate(()=>{
   resetRunState();resetUndergroundRoute();currentLevel=currentBiome=1;BIOME_ACTIVE=false;
   isStoryMode=false;started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
   window.inNM0SecretOverlay=false;buildGhost=null;nm0AmbushActive=farmAmbushActive=false;
   buildings=activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];corpses=[];particles=[];bullets=[];
   invalidateColIndex();setMeleeTool('NONE');jetpackUnlocked=false;
   chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
   leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
   player=new Character(10000,10000,true);player.currentWeapon=WEAPONS.PISTOL;
   viewLeft=viewTop=-100000;viewRight=viewBottom=100000;zoom=1;camX=camY=0;
   // Freeze unrelated spawn timers in this isolated death-rendering fixture.
   window.setTimeout=()=>0;window.__killMarks=[];window.__killFixtures=[];
   window.__killStack={depth:0,minDepth:0};
   const nativeStamp=window.stampKillVectorBlood,oldPush=window.push,oldPop=window.pop;
   window.stampKillVectorBlood=function(...args){const mark=nativeStamp(...args);if(mark)__killMarks.push(mark);return mark;};
   window.push=function(...args){__killStack.depth++;return oldPush(...args);};
   window.pop=function(...args){__killStack.depth--;__killStack.minDepth=Math.min(__killStack.minDepth,__killStack.depth);return oldPop(...args);};
   window.__floorDigest=()=>{
    let hash=2166136261,ink=0,canvases=0;
    for(const key of Object.keys(bloodChunks).sort()){
     if(isBodyLayer(key))continue;
     const e=bloodChunks[key],pixels=e.pg.drawingContext.getImageData(0,0,e.pg.width,e.pg.height).data;canvases++;
     for(let i=0;i<pixels.length;i++){hash=Math.imul(hash^pixels[i],16777619)>>>0;if(i%4===3&&pixels[i])ink++;}
    }
    return {hash,ink,canvases};
   };
   window.__killFixture=(zone,direction,index)=>{
    particles=[];bullets=[];corpses=[];enemiesList=[];frameCount++;randomSeed(7000+index);
    const bank='kill-vector-native-'+index;useBloodBank(bank);const markStart=__killMarks.length;
    const e=new Character(0,0,false,'NORMAL');e.hp=zone==='HEAD'?100:20;e.isNeutral=e.isFriendly=false;
    e.aimAngle=e.moveAngle=-Math.PI/2;e.isMoving=false;e.isArmed=true;e.name='';
    e.walkCycle=e.gait=e.muzzleFlash=e.reloadTimer=e.meleeTimer=e.weaponKick=0;
    resetActorStance(e,'STAND');enemiesList=[e];
    const angle=direction*Math.PI/2,b=spawnBullet(-90*Math.cos(angle),-90*Math.sin(angle),angle,true,zone,WEAPONS.PISTOL,player);
    doTick=true;push();translate(-10000,-10000);
    for(let i=0;i<16&&b.active;i++){frameCount++;deltaTime=1000/60;updateBullets();}pop();
    if(!e.dead||!corpses.length)throw Error('Fatal native projectile did not create a corpse');
    const marks=__killMarks.slice(markStart),poolCount=bloodPools.length,blobCount=bloodPools.reduce((n,p)=>n+p.blobs.length,0);
    const initialFloor=__floorDigest();
    push();translate(-10000,-10000);
    for(let i=0;i<168;i++){frameCount++;deltaTime=1000/60;updateCorpses();updateBloodPools();updateParticles();}pop();
    const settledFloor=__floorDigest(),savedBodies=corpses.slice();
    const before={x:e.x,y:e.y};e.x+=160;e.y-=90;enemiesList=[];corpses=[];
    const afterRemoval=__floorDigest();e.x=before.x;e.y=before.y;corpses=savedBodies;
    const f={zone,angle,bank,e,corpses:savedBodies,marks,poolCount,blobCount,initialFloor,settledFloor,afterRemoval,
     deathTypes:savedBodies.map(c=>c.dT),bodyPositions:savedBodies.map(c=>({x:c.x,y:c.y,fP:c.fP})),
     liveParticles:particles.length,stack:{...__killStack}};
    __killFixtures.push(f);return f;
   };
   window.__killBack=(title,subtitle)=>{
    background(29,41,45);textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);noStroke();
    fill(232,241,234);textSize(23);text(title,width/2,16);fill(165,190,185);textSize(12);text(subtitle,width/2,49);
   };
   window.__killPaint=(f,x,y,magnify,showBody)=>{
    useBloodBank(f.bank);doTick=false;
    push();translate(x,y);scale(magnify);drawBloodLayer(false);if(showBody)for(const corpse of f.corpses)corpse.show();pop();
   };
   window.__killSheet=showBody=>{
    __killBack(showBody?'FATAL GUN HITS / EXISTING CORPSES AND BLOOD POOLS':'FATAL GUN HITS / FIXED FLOOR VECTOR STAINS',
     showBody?'Actual body/head kills after 168 ticks. Old pool and corpse remain; native 1× at left and 2× at right.':'Same floor bank with the corpse hidden. Polygon jet follows each incoming shot; the original rounded pool remains.');
    const labels=['WEST → EAST','NORTH → SOUTH','EAST → WEST','SOUTH → NORTH'];
    for(let i=0;i<__killFixtures.length;i++){
     const f=__killFixtures[i],col=i%4,row=Math.floor(i/4),x=col*500,y=88+row*500;
     fill(20,30,34);noStroke();rect(x+8,y,484,482,10);textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);
     fill(196,220,211);textSize(13);text(f.zone+' / '+labels[col],x+250,y+14);
     __killPaint(f,x+80,y+224,1,showBody);__killPaint(f,x+315,y+224,2,showBody);
     fill(131,165,159);textSize(11);text('1×',x+80,y+445);text('2×',x+315,y+445);
    }
    return {...__killStack};
   };
  });
  const records=await page.evaluate(()=>{
   const records=[];
   for(const zone of ['BODY','HEAD'])for(let direction=0;direction<4;direction++){
    const f=__killFixture(zone,direction,records.length);
    records.push({zone:f.zone,angle:f.angle,marks:f.marks.map(m=>({x:m.x,y:m.y,angle:m.angle,spread:m.spread,paths:m.paths})),
     poolCount:f.poolCount,blobCount:f.blobCount,initialFloor:f.initialFloor,settledFloor:f.settledFloor,afterRemoval:f.afterRemoval,
     deathTypes:f.deathTypes,bodyPositions:f.bodyPositions,liveParticles:f.liveParticles,stack:f.stack});
   }
   return records;
  });
  for(const r of records){
   assert.equal(r.marks.length,1,'real fatal projectile produces exactly one fixed vector stain');
   assert.equal(r.marks[0].paths.length,17,'directional floor stain retains its authored polygon fan');
   assert(Math.abs(Math.atan2(Math.sin(r.marks[0].angle-r.angle),Math.cos(r.marks[0].angle-r.angle)))<1e-8,'floor vector follows incoming projectile');
   assert(r.poolCount>0&&r.blobCount>=8,'existing rounded death pool is still created');
   assert(r.initialFloor.ink>0,'vector stain is immediately baked to the native floor');
   assert(r.settledFloor.ink>=r.initialFloor.ink,'original gradual pool adds floor blood while settling');
   assert.deepEqual(r.settledFloor,r.afterRemoval,'floor ink remains fixed when the victim moves and the corpse is removed');
   assert.equal(r.stack.depth,0);assert.equal(r.stack.minDepth,0);
  }
  const withBodies=await page.evaluate(()=>__killSheet(true));assert.equal(withBodies.depth,0);
  await page.locator('canvas').first().screenshot({path:path.join(out,'kill-vector-with-corpses.png')});
  const exposedFloor=await page.evaluate(()=>__killSheet(false));assert.equal(exposedFloor.depth,0);
  await page.locator('canvas').first().screenshot({path:path.join(out,'kill-vector-floor-only.png')});
  assert.deepEqual(errors,[],'native fatal render produces no page errors');
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({records,withBodies,exposedFloor,errors},null,2));
  console.log(`${records.length} real body/head kills, four incoming vectors, unchanged rounded pools and persistent baked floor checks passed. Previews: ${out}`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});

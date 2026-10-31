// Real pooled projectiles, actor painters and particle updates. These previews
// show one hit evolving; they never respawn a burst to keep it on screen.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.COMIC_IMPACT_OUT||'/tmp/newone-comic-impacts';
const frames=path.join(out,'frames');fs.mkdirSync(frames,{recursive:true});
const fps=30,totalFrames=Number(process.env.COMIC_IMPACT_FRAMES||120);
const expectedBlood=Number(process.env.COMIC_IMPACT_BLOOD_COUNT||12);
const cases=[
 {name:'NORMAL / BODY',type:'NORMAL',hp:900,zone:'BODY',comic:true,blood:true},
 {name:'NORMAL / LEGS',type:'NORMAL',hp:900,zone:'LEGS',comic:true,blood:true},
 {name:'NM-0 / ARMORED BODY',type:'ARMORED_STANDARD',hp:300,zone:'BODY',comic:true,blood:true},
 {name:'NM-0 / EXPOSED BODY',type:'ARMORED_STANDARD',hp:50,zone:'BODY',comic:true,blood:true},
 {name:'ARMORED ORB / BODY',type:'ARMORED',hp:600,zone:'BODY',comic:true,blood:true},
 {name:'NM-0 / HELMET HEADSHOT',type:'ARMORED_STANDARD',hp:300,zone:'HEAD',helmet:true},
 {name:'BARE HEADSHOT / CONTROL',type:'NORMAL',hp:900,zone:'HEAD',head:true},
 {name:'ROBOT CHASSIS / CONTROL',type:'ROBOT',hp:900,zone:'BODY',robot:true}
];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1930},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(1920,1930);pixelDensity(1);noLoop();randomSeed(77);window.__ready=true;};</script>');
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
   leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
   rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
   player=new Character(10000,10000,true);player.isArmed=true;player.currentWeapon=WEAPONS.PISTOL;
   viewLeft=viewTop=-100000;viewRight=viewBottom=100000;zoom=1;camX=camY=0;
   window.__comicStack={depth:0,minDepth:0};window.__comicGeometry={ellipse:0,arc:0,softBlob:0,vertices:0};
   window.__comicKind=null;window.__comicPaintOrder=[];window.__comicFixtures=[];
   const oldPush=window.push,oldPop=window.pop,nativePaint=Particle.prototype.paint;
   window.push=function(...a){__comicStack.depth++;return oldPush(...a);};
   window.pop=function(...a){__comicStack.depth--;__comicStack.minDepth=Math.min(__comicStack.minDepth,__comicStack.depth);return oldPop(...a);};
   Particle.prototype.paint=function(...a){const before=__comicKind;__comicKind=this.t;__comicPaintOrder.push(this.t);try{return nativePaint.apply(this,a);}finally{__comicKind=before;}};
   const isNew=()=>__comicKind==='COMIC_IMPACT'||__comicKind==='HIT_BLOOD';
   for(const [name,key] of [['ellipse','ellipse'],['arc','arc'],['softBlob','softBlob'],['vertex','vertices']]){
    const native=window[name];window[name]=function(...a){if(isNew())__comicGeometry[key]++;return native.apply(this,a);};
   }
   window.__comicNewFixture=(config,index)=>{
    particles=[];bullets=[];corpses=[];enemiesList=[];frameCount++;randomSeed(900+index);
    const bank='comic-native-'+index+'-'+frameCount;useBloodBank(bank);
    const e=new Character(0,0,false,config.type);e.hp=config.hp;e.maxHp=Math.max(e.maxHp,config.hp);
    e.aimAngle=e.moveAngle=-Math.PI/2;e.isMoving=false;e.isArmed=true;e.isFriendly=e.isNeutral=false;
    e.muzzleFlash=e.reloadTimer=e.meleeTimer=e.weaponKick=0;e.walkCycle=0;e.gait=0;e.name='';
    resetActorStance(e,'STAND');enemiesList=[e];
    const angle=config.angle||0;
    const bullet=spawnBullet(-90*Math.cos(angle),-90*Math.sin(angle),angle,true,config.zone,WEAPONS.PISTOL,player);
    let contactTicks=0;doTick=true;
    push();translate(-10000,-10000);for(;contactTicks<16&&bullet.active;contactTicks++){frameCount++;updateBullets();}pop();
    if(e.hp>=config.hp)throw Error('Projectile failed to hit '+config.name);
    const types={};for(const p of particles)types[p.t]=(types[p.t]||0)+1;
    const f={config,e,bank,particles,tick:0,initial:particles.length,types,hp:e.hp,headHP:e.headHP,contactTicks,
     hit:{x:bullet.x,y:bullet.y,angle:bullet.a},snapshots:[]};__comicFixtures.push(f);return f;
   };
   window.__comicUse=f=>{particles=f.particles;enemiesList=[f.e];useBloodBank(f.bank);};
   window.__comicAdvance=(f,toTick)=>{
    __comicUse(f);doTick=true;push();translate(-10000,-10000);
    for(;f.tick<toTick;f.tick++){frameCount++;deltaTime=1000/60;updateParticles();}
    pop();return f.particles.length;
   };
   window.__comicPaint=(f,x,y,magnify=1)=>{
    __comicUse(f);doTick=false;__comicPaintOrder.length=0;
    push();translate(x,y);scale(magnify);drawBloodChunks();f.e.show();updateParticles();pop();
    const order=__comicPaintOrder.filter(t=>t==='COMIC_IMPACT'||t==='HIT_BLOOD');
    const sharp=f.particles.filter(p=>p.t==='HIT_BLOOD'),flash=f.particles.find(p=>p.t==='COMIC_IMPACT');
    const snapshot={tick:f.tick,live:f.particles.length,order,stack:{...__comicStack},flashSize:flash&&flash.sz,
     bloodReach:sharp.length?Math.max(...sharp.map(p=>Math.hypot(p.x-f.hit.x,p.y-f.hit.y))):0};
    f.snapshots.push(snapshot);return snapshot;
   };
   window.__comicBack=(title,subtitle)=>{
    background(29,41,45);noStroke();textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);
    fill(232,241,234);textSize(23);text(title,width/2,16);
    fill(165,190,185);textSize(12);text(subtitle,width/2,49);
   };
  });
  const sheet=await page.evaluate(cases=>{
   __comicBack('GUN CONTACT / NATIVE PARTICLE EVOLUTION','One real pistol hit per row, traveling left to right. Native scale at left; magnified on right. Persistent floor marks are native too.');
   const records=[];
   for(let row=0;row<cases.length;row++){
    const config=cases[row],f=__comicNewFixture(config,row),record={name:config.name,type:config.type,zone:config.zone,
     hp:f.hp,headHP:f.headHP,types:f.types,initial:f.initial,contactTicks:f.contactTicks,hit:f.hit,snapshots:[]};
    for(let col=0;col<4;col++){
     const tick=[0,3,7,12][col];__comicAdvance(f,tick);
     const x=col*480,y=87+row*227;
     noStroke();fill(20,30,34);rect(x+8,y,464,212,9);
     textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(12);fill(196,220,211);
     text(config.name+' / +'+tick+' TICKS',x+240,y+12);
     const magnify=config.type==='ARMORED'?1.65:2.6;
     const native=__comicPaint(f,x+75,y+115,1),large=__comicPaint(f,x+300,y+115,magnify);
     textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(10);fill(126,159,158);
     text('1×',x+75,y+191);text(magnify+'×',x+300,y+191);
     record.snapshots.push({native,large});
    }
    records.push(record);
   }
   return {records,geometry:{...__comicGeometry},stack:{...__comicStack},pool:_particlePool.length,poolMax:PARTICLE_POOL_MAX};
  },cases);
  assert.equal(sheet.records.length,cases.length);assert.equal(sheet.stack.depth,0);assert.equal(sheet.stack.minDepth,0);
  assert(sheet.pool<=sheet.poolMax,'native retirement keeps the particle pool bounded');
  for(const [i,r] of sheet.records.entries()){
   const c=cases[i];
   if(c.comic)assert.equal(r.types.COMIC_IMPACT,1,c.name+' uses one authored comic contact burst');
   if(c.blood)assert.equal(r.types.HIT_BLOOD,expectedBlood,c.name+' uses the expected sharp directional blood volume');
   if(c.helmet){assert.equal(r.types.FLECK,9,'helmet retains nine native metal flecks');assert.equal(r.types.COMIC_IMPACT,1,'helmet adds one comic contact');assert(!r.types.CHIP,'helmet loses debris chips');}
   if(c.head){assert.equal(r.types.BLOOD,8,'bare headshot retains its existing blood');assert.equal(r.types.COMIC_IMPACT,1,'bare headshot adds one comic contact');assert(!r.types.HIT_BLOOD,'bare headshot retains its original blood particle path');}
   if(c.robot){assert.equal(r.types.FLECK,9,'robot retains nine native metal flecks');assert(!r.types.COMIC_IMPACT&&!r.types.HIT_BLOOD,'robot remains a material control');}
   for(const s of r.snapshots){
    assert.equal(s.native.stack.depth,0);assert.equal(s.large.stack.depth,0);
    const order=s.native.order;
    if(order.includes('COMIC_IMPACT')&&order.includes('HIT_BLOOD'))
     assert(order.lastIndexOf('COMIC_IMPACT')<order.indexOf('HIT_BLOOD'),'sharp blood paints above the comic burst in '+c.name);
   }
  }
  assert.equal(sheet.geometry.ellipse,0,'new sharp impact types never paint ellipses');
  assert.equal(sheet.geometry.arc,0,'new sharp impact types never paint round arcs');
  assert.equal(sheet.geometry.softBlob,0,'new sharp impact types never paint round soft blobs');
  await page.locator('canvas').first().screenshot({path:path.join(out,'comic-impact-evolution.png')});
  const directions=await page.evaluate(()=>{
   resizeCanvas(1600,1080);__comicBack('GUN CONTACT / EIGHT INCOMING VECTORS','Actual body impacts after three ticks. Target stays facing north; the projectile and sharp blood cone rotate through all eight incoming directions.');
   const labels=['WEST → EAST','NW → SE','NORTH → SOUTH','NE → SW','EAST → WEST','SE → NW','SOUTH → NORTH','SW → NE'],records=[];
   for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,config={name:labels[i],type:'NORMAL',hp:900,zone:'BODY',angle};
    const f=__comicNewFixture(config,40+i),x=200+(i%4)*400,y=210+Math.floor(i/4)*470;
    __comicAdvance(f,3);noStroke();fill(20,30,34);rect(x-190,y-110,380,405,10);
    textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(13);fill(196,220,211);text(labels[i],x,y-85);
    const native=__comicPaint(f,x-110,y+50,1),large=__comicPaint(f,x+45,y+50,2.7);
    records.push({angle,types:f.types,hit:f.hit,native,large});
   }
   return records;
  });
  await page.setViewportSize({width:1600,height:1080});
  for(const r of directions){assert.equal(r.types.COMIC_IMPACT,1);assert.equal(r.types.HIT_BLOOD,expectedBlood);assert.equal(r.large.stack.depth,0);}
  await page.locator('canvas').first().screenshot({path:path.join(out,'comic-impact-directions.png')});
  await page.setViewportSize({width:1600,height:1080});
  const movieStart=await page.evaluate(cases=>{
   resizeCanvas(1600,1080);window.__comicMovie=cases.map((c,i)=>__comicNewFixture(c,100+i));
   return __comicMovie.map(f=>({name:f.config.name,initial:f.initial}));
  },cases);
  let motion;
  for(let frame=0;frame<totalFrames;frame++){
   motion=await page.evaluate(({frame,fps})=>{
    __comicBack('SINGLE GUN HIT / ACTUAL LIFE AND RETIREMENT','Every target is hit once at movie start. New blood stays sharp; the comic flash and pooled particles finish naturally.');
    const records=[];
    for(let i=0;i<__comicMovie.length;i++){
     const f=__comicMovie[i],x=200+(i%4)*400,y=220+Math.floor(i/4)*470;
     __comicAdvance(f,frame*2);
     noStroke();fill(20,30,34);rect(x-190,y-115,380,390,10);
     textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(11);fill(191,215,208);text(f.config.name,x,y-92);
     __comicPaint(f,x-90,y+20,1);__comicPaint(f,x+45,y+20,f.config.type==='ARMORED'?1.7:2.4);
     textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(11);fill(129,162,160);
     text('+'+f.tick+' TICKS / '+f.particles.length+' LIVE',x,y+228);
     records.push({name:f.config.name,tick:f.tick,live:f.particles.length,initial:f.initial});
    }
    return {records,pool:_particlePool.length,poolMax:PARTICLE_POOL_MAX,geometry:{...__comicGeometry},stack:{...__comicStack}};
   },{frame,fps});
   assert.equal(motion.stack.depth,0);assert.equal(motion.stack.minDepth,0);assert(motion.pool<=motion.poolMax);
   for(const r of motion.records)assert(r.live<=r.initial,'a single hit cannot silently respawn particles');
   await page.locator('canvas').first().screenshot({path:path.join(frames,String(frame).padStart(4,'0')+'.png')});
  }
  assert.deepEqual(errors,[],'native Canvas reports no errors');
  if(totalFrames){
   assert(motion.records.every(r=>r.live===0),'all particles from the single hits retire naturally');
   const encoded=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(frames,'%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',path.join(out,'comic-impact-evolution.mp4')],{encoding:'utf8'});
   if(encoded.error)throw encoded.error;assert.equal(encoded.status,0,encoded.stderr);
  }
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({sheet,directions,movieStart,motion,errors,fps,totalFrames},null,2));
  console.log(`${sheet.records.length} actual projectile materials, ${sheet.records.length*4} timed contact pairs, ${directions.length} incoming vectors and ${totalFrames} native motion frames passed. Previews: ${out}`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});

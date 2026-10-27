// Native projectile contacts and the game's unchanged wound painters. Use
// GAME_JS and VERTICAL_DECAL_OUT to render the same fixtures before a change.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(process.env.VIS_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.VERTICAL_DECAL_OUT||'/tmp/newone-vertical-hit-decals';
const requireSpread=process.env.VERTICAL_REQUIRE_SPREAD!=='0';
const label=process.env.VERTICAL_DECAL_LABEL||'VERTICAL SPACING RESTORED';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1800,height:1300},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(1800,1300);pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('__ready');
  await page.evaluate(()=>{
   resetRunState();resetUndergroundRoute();currentLevel=currentBiome=1;BIOME_ACTIVE=false;
   isStoryMode=false;started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
   window.inNM0SecretOverlay=false;buildGhost=null;nm0AmbushActive=farmAmbushActive=false;
   buildings=activeBuildings=[];activeParkingCars=[];parkingCars=[];barrels=[];enemiesList=[];corpses=[];particles=[];bullets=[];
   invalidateColIndex();resetForestWildlife();setMeleeTool('NONE');jetpackUnlocked=false;
   chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
   leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
   player=new Character(10000,10000,true);player.currentWeapon=WEAPONS.PISTOL;
   viewLeft=viewTop=-100000;viewRight=viewBottom=100000;zoom=1;camX=camY=0;
   window.setTimeout=()=>0;window.__verticalFixtures=[];window.__verticalStack={depth:0,minDepth:0};
   const oldPush=window.push,oldPop=window.pop;
   window.push=function(...a){__verticalStack.depth++;return oldPush(...a);};
   window.pop=function(...a){__verticalStack.depth--;__verticalStack.minDepth=Math.min(__verticalStack.minDepth,__verticalStack.depth);return oldPop(...a);};
   window.__verticalMake=(zone,index,lateral=0,facing=-Math.PI/2,count=7)=>{
    frameCount=5000+index*200;randomSeed(1901+index);doTick=true;particles=[];bullets=[];corpses=[];enemiesList=[];
    const e=new Character(0,0,false,'NORMAL');e.hp=e.maxHp=100000;e.shield=0;
    e.aimAngle=e.moveAngle=facing;e.isMoving=true;e.gait=.95;e.walkCycle=2.1;
    e.isArmed=true;e.isFriendly=e.isNeutral=false;e.name='';
    e.muzzleFlash=e.reloadTimer=e.meleeTimer=e.weaponKick=e.hitFlash=0;resetActorStance(e,'STAND');
    const ca=Math.cos(facing),sa=Math.sin(facing),hits=[];enemiesList=[e];
    for(let i=0;i<count;i++){
     e.x=e.y=0;frameCount++;rememberFigureMotion(e,0,0);
     const before=e.decals.length,startX=-ca*90-sa*lateral,startY=-sa*90+ca*lateral;
     const b=spawnBullet(startX,startY,facing,true,zone,WEAPONS.PISTOL,player,index*100+i+1);
     push();translate(-10000,-10000);
     for(let j=0;j<12&&b.active&&e.decals.length===before;j++){frameCount++;updateBullets();}
     pop();
     if(e.decals.length!==before+1)throw Error('Native fixed ray failed '+zone+'/'+index+'/'+i);
     const d=e.decals[e.decals.length-1];hits.push({...d,col:d.col&&d.col.slice()});
    }
    e.x=e.y=0;e.hitFlash=0;e.stanceDamage=null;particles=[];bullets=[];
    const f={zone,index,lateral,facing,e,hits,original:JSON.stringify(hits)};__verticalFixtures.push(f);return f;
   };
   window.__verticalBack=(title,subtitle)=>{
    background(28,42,46);textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);noStroke();
    fill(235,242,230);textSize(24);text(title,width/2,14);fill(159,191,182);textSize(12);text(subtitle,width/2,49);
   };
   window.__verticalCard=(x,y,w,h,title,subtitle='')=>{
    noStroke();fill(18,31,35);rect(x,y,w,h,10);textAlign(CENTER,TOP);textFont('sans-serif');textStyle(NORMAL);
    fill(211,230,218);textSize(13);text(title,x+w/2,y+13);fill(141,179,167);textSize(11);text(subtitle,x+w/2,y+34);
   };
   window.__verticalPaint=(f,x,y,magnify=3,selected=-1,stance='STAND')=>{
    const e=f.e,decals=e.decals,before=JSON.stringify(f.hits);frameCount++;doTick=false;
    e.decals=selected<0?f.hits:[f.hits[selected]];e.x=e.y=0;
    resetActorStance(e,stance);push();translate(x,y);scale(magnify);e.show();pop();
    e.decals=decals;resetActorStance(e,'STAND');
    if(JSON.stringify(f.hits)!==before)throw Error('Native painting mutated impact data');
    return {...__verticalStack};
   };
   window.__verticalRecord=f=>({zone:f.zone,lateral:f.lateral,facing:f.facing,hits:f.hits,
    heights:f.hits.map(d=>d.isLeg?(d.legSegment===0?d.legU*.5:.5+d.legU*.5):d.x),sides:f.hits.map(d=>d.isLeg?d.legV:d.y),
    selectedLegs:f.hits.map(d=>d.legIndex),hp:f.e.hp,stack:{...__verticalStack}});
   window.__verticalPlot=(f,x,y,w,h)=>{
    // This annotation plots the actual saved attachment coordinates, not a
    // second wound/figure painter. Individual native figures appear beside it.
    push();translate(x,y);noStroke();fill(137,148,127);rect(-w/2,-h/2,w,h,6);
    stroke(93,110,96);strokeWeight(1);line(-w/2,0,w/2,0);line(0,-h/2,0,h/2);noStroke();
    for(let i=0;i<f.hits.length;i++){
     const d=f.hits[i],px=d.isLeg?(d.legV/.22)*w*.35:(d.y/(f.zone==='HEAD'?4.675:f.e.bodyH*.425))*w*.44;
     const legHeight=d.legSegment===0?d.legU*.5:.5+d.legU*.5;
     const py=d.isLeg?(legHeight-.5)*h*.92:-d.x/(f.zone==='HEAD'?4.675:f.e.bodyW*.425)*h*.44;
     fill(98,0,8,220);ellipse(px,py,9,9);fill(246,216,183);textFont('sans-serif');textAlign(CENTER,CENTER);textSize(8);text(i+1,px,py);
    }pop();
   };
  });
  const records=await page.evaluate(label=>{
   __verticalBack(label+' / SAME RAY, SEPARATE WOUND HEIGHTS','Every row fires seven identical finite pistol trajectories. The native figures and coordinate plots show their saved impact positions.');
   const fs=['HEAD','BODY','LEGS'].map((zone,i)=>__verticalMake(zone,i,zone==='LEGS'?3:0));
   for(let row=0;row<fs.length;row++){
    const f=fs[row],y=82+row*398;
    __verticalCard(8,y,1784,382,f.zone+' / ONE IDENTICAL RAY REPEATED SEVEN TIMES','Native painter 3×; first five individual hits, then the same seven marks together. Right: actual attachment coordinates.');
    for(let col=0;col<5;col++){
     __verticalPaint(f,132+col*235,y+195,3,col);
     fill(145,181,169);textAlign(CENTER,TOP);textSize(11);text('HIT '+(col+1),132+col*235,y+326);
    }
    __verticalPaint(f,1365,y+195,3,-1);fill(145,181,169);textAlign(CENTER,TOP);text('7 HITS',1365,y+326);
    __verticalPlot(f,1615,y+191,162,192);fill(145,181,169);textAlign(CENTER,TOP);text('SAVED COORDINATES',1615,y+326);
   }return fs.map(__verticalRecord);
  },label);
  assert(records.every(r=>r.stack.depth===0&&r.stack.minDepth===0),'native transforms balance');
  await page.locator('canvas').first().screenshot({path:path.join(out,'vertical-fixed-ray-hits.png')});
  const lateral=await page.evaluate(label=>{
   resizeCanvas(1800,1240);__verticalBack(label+' / PRESERVED LATERAL MAPPING','Three real ray offsets per region. Height changes within a ray; marks keep the side selected by the projectile rather than scattering horizontally.');
   const fs=[];
   for(let row=0;row<3;row++)for(let col=0;col<3;col++){
    const zone=['HEAD','BODY','LEGS'][row],side=[-3,0,3][col],f=__verticalMake(zone,10+row*3+col,side);fs.push(f);
    const x=col*600,y=82+row*382;__verticalCard(x+8,y,584,367,zone+' / RAY OFFSET '+side,'Actual native wounds 3× beside saved attachment coordinates');
    __verticalPaint(f,x+174,y+190,3,-1);__verticalPlot(f,x+435,y+188,140,190);
    fill(145,181,169);textAlign(CENTER,TOP);textSize(11);text('NATIVE FIGURE',x+174,y+320);text('SAVED COORDINATES',x+435,y+320);
   }return fs.map(__verticalRecord);
  },label);
  await page.locator('canvas').first().screenshot({path:path.join(out,'vertical-lateral-paths.png')});
  const poses=await page.evaluate(label=>{
   resizeCanvas(1800,1060);__verticalBack(label+' / THE SAME WOUNDS FOLLOW THE FIGURE','Actual hit records are reused untouched through stance changes, a moving gait, and the native fallen-body painter. No new decal artwork.');
   const fs=[__verticalMake('BODY',31,-3),__verticalMake('LEGS',32,3)];
   for(let row=0;row<fs.length;row++){
    const f=fs[row],y=82+row*475;
    for(let col=0;col<4;col++){
     const x=col*450,stance=['STAND','CROUCH','PRONE','CORPSE'][col];__verticalCard(x+8,y,434,460,f.zone+' / '+stance,'Same seven saved wound records · native painter 3×');
     if(col<3)__verticalPaint(f,x+220,y+240,3,-1,stance);
     else{
      const e=f.e,decals=e.decals;e.decals=f.hits;resetActorStance(e,'STAND');e.hp=0;e.fallHit=null;
      const c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,0,0,e.decals,e.currentWeapon,.35,e.eType,e.bodyW,e.bodyH,e);
      finishFigureFall(c);while(c.rag&&!c.rag.done)ragStep(c.rag);
      const before=JSON.stringify(f.hits);push();translate(x+220,y+238);scale(3);c.show();pop();e.decals=decals;
      if(JSON.stringify(f.hits)!==before)throw Error('Corpse painter mutated the saved impact coordinates');
     }
    }
   }return fs.map(__verticalRecord);
  },label);
  await page.locator('canvas').first().screenshot({path:path.join(out,'vertical-stance-and-corpse.png')});
  if(requireSpread)for(const r of records){
   const extent=Math.max(...r.heights)-Math.min(...r.heights);
   assert(extent>(r.zone==='LEGS'?.25:2),'fixed-ray '+r.zone+' wounds still occupy one height row: '+JSON.stringify(r.heights));
  }
  for(const r of [...records,...lateral,...poses]){
   assert(r.hits.every(d=>[d.x,d.y,d.sz].every(Number.isFinite)),'all native wound coordinates are finite');
   assert(r.stack.depth===0&&r.stack.minDepth===0,'all native painter transforms balance');
  }
  assert.deepEqual(errors,[],'native figures and projectile contacts raise no browser errors');
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({label,records,lateral,poses,errors,requireSpread},null,2));
  console.log(`Native vertical decals: ${records.length} repeated-ray regions, ${lateral.length} lateral-path fixtures and ${poses.length*4} attached pose views. Output: ${out}`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});

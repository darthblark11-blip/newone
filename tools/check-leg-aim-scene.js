// Exercise the native p5 figure painter in Chromium, including its direct
// Canvas path and the graphics target used to stamp settled corpses.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.LEG_AIM_SCENE_OUT||'/tmp/leg-aim-p5-scene.png';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1050,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>body{margin:0}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};setup=function(){createCanvas(1050,1100);pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('__ready');
  const result=await page.evaluate(()=>{
   let checks=0;const verify=(condition,label)=>{if(!condition)throw Error(label);checks++;};
   started=doTick=true;isStoryMode=isPaused=isDead=isWin=killcamMode=false;currentLevel=currentBiome=1;BIOME_ACTIVE=false;
   leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
   setMeleeTool('NONE');window.farmLvl=0;window.outpostForts={};townsData={};
   // This scene checks a visible shin stain, independently of injury chance.
   tryLegShotInjury=()=>false;bulletDecalHeightSample=()=>.9;
   viewLeft=viewTop=-10000;viewRight=viewBottom=10000;MAX_KILLS=100000;
   const original=drawLegDecals,events=[];
   drawLegDecals=function(...args){
    const [g,decals,index,sx,sy,kx,ky,ax,ay,hw,kw,aw]=args;
    for(const d of decals||[])if(d.isLeg&&d.legIndex===index){
     const p=legDecalPoint(d,sx,sy,kx,ky,ax,ay,hw,kw,aw),m=g.drawingContext.getTransform();
     events.push({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f,sz:p.sz*Math.hypot(m.a,m.b)});
    }
    return original(...args);
   };
   const shot=type=>{
    randomSeed(927);bullets=[];particles=[];corpses=[];enemiesList=[];buildings=[];activeBuildings=[];barrels=[];activeParkingCars=[];parkingCars=[];
    resetForestWildlife();invalidateColIndex();headshotCounter=bodyOverkillCounter=totalKills=0;frameCount++;
    player=new Character(-1000,-1000,true);
    const e=new Character(80,0,false,type);e.hp=e.maxHp=1000;e.isMoving=false;e.aimAngle=e.moveAngle=-HALF_PI;e.isFriendly=e.isNeutral=false;
    enemiesList=[e];const geometry=humanLegHitGeometry(e),leg=geometry.legs[0],
      localX=(leg.kx+leg.ax)*.5,localY=(leg.ky+leg.ay)*.5,
      rayY=e.y+Math.sin(geometry.angle)*localX+Math.cos(geometry.angle)*localY;
    const b=spawnBullet(0,rayY,0,true,'LEGS',WEAPONS.PISTOL,player);
    for(let i=0;i<12&&b.active;i++)updateBullets();
    verify(e.decals.length===1&&e.decals[0].isLeg&&!e.decals[0].isHead,type+' native bullet has one leg wound');
    return e;
   };
   background(24,35,45);noStroke();textFont('sans-serif');textAlign(LEFT,BASELINE);fill(244,232,202);textSize(24);text('LEG AIM / NATIVE p5 CANVAS',20,34);
   fill(183,197,207);textSize(14);text('Real bullet decals follow trouser surfaces through gait and fallen poses.',20,60);
   const types=['NORMAL','NM0_ROOKIE','ARMORED_STANDARD'],poses=['Idle','Walking','Bullet fall','Settled'];
   let visible=0;const pixels=[];
   for(let row=0;row<4;row++)for(let col=0;col<3;col++){
    const x=10+col*346,y=80+row*252,c=drawingContext;
    fill(137,149,141);rect(x,y,336,242,8);fill(20,41,49);textSize(16);text(types[col]+' / '+poses[row],x+12,y+25);
    const e=shot(types[col]);e.x=e.y=0;e.gait=.95;e.walkCycle=2.1;e.isMoving=row===1;
    let body=null;
    if(row>=2){
     e.fallHit.fatal=true;e.hp=0;
     body=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,0,0,e.decals,e.currentWeapon,0,e.eType,e.bodyW,e.bodyH,e);
     if(row===2)for(let i=0;i<3;i++){frameCount++;body.update();}
     else{finishFigureFall(body);while(!body.rag.done)ragStep(body.rag);}
    }
    c.save();c.beginPath();c.rect(x,y+35,336,200);c.clip();push();translate(x+167,y+130);scale(2.8);events.length=0;
    if(body)body.show();else e.show();
    verify(events.length===1,types[col]+' '+poses[row]+' paints the hole once on its leg');
    const mark=events[0];verify(Number.isFinite(mark.x)&&Number.isFinite(mark.y)&&mark.sz>0,'finite leg mark');
    if(body){
     const p=fatalWoundPoint(body,body.dec[0]),m=c.getTransform();
     verify(Math.hypot(mark.x-(m.a*p.x+m.c*p.y+m.e),mark.y-(m.b*p.x+m.d*p.y+m.f))<.001,'native fatal origin matches rendered leg');
    }
    pop();c.restore();
    if(row===1){
     // The walking shin is exposed, so the mark must actually survive later
     // torso/head layers instead of merely invoking the right helper. The
     // existing armor rule burns a dark hole instead of a red blood stain.
     const rgba=c.getImageData(Math.round(mark.x),Math.round(mark.y),1,1).data;
     pixels.push({type:types[col],rgba:Array.from(rgba),mark});
     const burned=types[col]==='ARMORED_STANDARD';
     if(burned?rgba[0]<35&&rgba[1]<35&&rgba[2]<35:rgba[0]>rgba[1]*1.8&&rgba[0]>rgba[2]*1.8)visible++;
    }
    noFill();stroke(233,214,151);strokeWeight(1.5);ellipse(mark.x,mark.y,24);noStroke();
   }
   drawLegDecals=original;
   return {checks,visible,pixels};
  });
  assert.deepEqual(errors,[]);
  await page.locator('canvas').first().screenshot({path:out});
  fs.writeFileSync(out.replace(/\.png$/,'.json'),JSON.stringify(result,null,2));
  assert.equal(result.visible,3,'exposed walking leg wounds survive later torso/head layers: '+JSON.stringify(result.pixels));
  console.log(`${result.checks}/${result.checks} native p5 leg rendering checks passed. Scene: ${out}`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});

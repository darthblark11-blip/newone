// Native p5 review of wall and furniture cover, including both tangent shots.
// VIS_DEPS and VIS_CHROME follow visual-stance-motion.js. Artifacts stay in /tmp.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.COVER_VIS_OUT||'/tmp/newone-collision-cover';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:1080},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};setup=function(){createCanvas(1200,1080);pixelDensity(1);noLoop();window.__ready=true;};windowResized=function(){};</script>');
  await page.waitForFunction('__ready');
  await page.evaluate(()=>{
   randomSeed(583);noiseSeed(BIOME_SEED);resetRunState();
   currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;isStoryMode=false;
   isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
   window.inNM0SecretOverlay=false;buildGhost=null;
   buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];bullets=[];particles=[];
   leftStick={active:false,dx:0,dy:0,base:{x:80,y:920}};rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:970}};
   setMeleeTool('NONE');jetpackUnlocked=false;chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
   window.milLvl=1;zoom=1;camX=camY=0;viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
   window.__coverNative={depth:0,minDepth:0};
   const oldPush=window.push,oldPop=window.pop;
   window.push=function(...args){__coverNative.depth++;return oldPush(...args);};
   window.pop=function(...args){__coverNative.depth--;__coverNative.minDepth=Math.min(__coverNative.minDepth,__coverNative.depth);return oldPop(...args);};
   window.__coverActor=(kind,angle,aiming=true,edge=false,key='ASSAULT_RIFLE',normal=Math.PI)=>{
    const nx=Math.cos(normal),ny=Math.sin(normal),tx=-ny,ty=nx;
    const wall={x:0,y:0,w:Math.abs(nx)>.5?24:80,h:Math.abs(nx)>.5?80:24,
     ...(kind==='HIGH'?{isWall:true}:{hqProp:'BENCH'})};
    buildings=activeBuildings=[wall];invalidateColIndex();
    const edgeAlong=40-(typeof COVER_FOOT_MARGIN==='number'?COVER_FOOT_MARGIN:12);
    const c=new Character(nx*29+tx*(edge?edgeAlong:0),ny*29+ty*(edge?edgeAlong:0),true);
    player=c;c.currentWeapon=WEAPONS[key];c.isArmed=true;c.ammo=100;c.hp=c.maxHp;
    c.aimAngle=angle;c.moveAngle=normal;c.aimHold=aiming?14:0;c.name='';
    c.reloadTimer=c.meleeTimer=c.dashTimer=c.fireTimer=c.muzzleFlash=c.weaponKick=0;
    c.isMoving=false;c.gait=c.walkCycle=0;resetActorStance(c);
    rightStick.active=aiming;rightStick.dx=Math.cos(angle);rightStick.dy=Math.sin(angle);rightStick.dist=.4;
    for(let i=0;i<24;i++){frameCount++;updateActorCover(c,1000/60,-nx*6,-ny*6,aiming);}
    return c;
   };
   window.__coverCard=(title,kind,angle,aiming,edge,x,y,key='ASSAULT_RIFLE')=>{
    const c=__coverActor(kind,angle,aiming,edge,key),wall=activeBuildings[0];
    push();translate(x,y);noStroke();fill(36,48,55);rect(-192,-155,384,300,8);
    fill(225,234,225);textFont('sans-serif');textAlign(CENTER,CENTER);textSize(15);text(title,0,-133);
    fill(140,169,177);textSize(11);text(kind==='HIGH'?'Tall wall · wall-side foot planted':'Waist object · crouch / rise',0,-112);
    push();translate(8,25);scale(2.3);translate(-c.x,-c.y);
    stroke(54,68,75);strokeWeight(.5);
    for(let n=-80;n<=80;n+=20){line(-80,n,80,n);line(n,-80,n,80);}noStroke();
    if(kind==='HIGH'){fill(14,24,32);rect(wall.x-wall.w/2,wall.y-wall.h/2,wall.w,wall.h);fill(72,95,107);rect(wall.x-wall.w/2+1,wall.y-wall.h/2+1,wall.w-2,wall.h-2);}
    else drawNM0LabProp(wall);
    rightStick.active=false;c.show();rightStick.active=aiming;pop();pop();
    return {title,active:!!c.cover?.active,kind:c.cover?.kind,stance:actorStance(c),lean:Math.hypot(coverUpperOffset(c).x,coverUpperOffset(c).y),validPeek:!!c.cover?.validPeek};
   };
  });
  const gallery=await page.evaluate(()=>{
   background(22,31,38);fill(234,240,230);textFont('sans-serif');textAlign(CENTER,CENTER);textSize(24);text('Collision cover · native character review',600,35);
   return [
    __coverCard('Standing cover', 'HIGH', Math.PI,false,false,200,225),
    __coverCard('Full left tangent', 'HIGH', Math.PI/2,true,false,600,225),
    __coverCard('Full right tangent', 'HIGH', Math.PI*1.5,true,false,1000,225),
    __coverCard('Lateral peek · rifle', 'HIGH', -.7,true,true,200,550),
    __coverCard('Lateral peek · pistol', 'HIGH', -.7,true,true,600,550,'PISTOL'),
    __coverCard('Lateral peek · dual SMGs', 'HIGH', -.7,true,true,1000,550,'DUAL_SMG'),
    __coverCard('Crouched object cover', 'LOW',0,false,false,200,875),
    __coverCard('Pop over the top', 'LOW',0,true,false,600,875),
    __coverCard('Pop · tangent shot', 'LOW',Math.PI/2,true,false,1000,875)
   ];
  });
  assert(gallery.every(c=>c.active),'Every gallery pose must acquire actual cover');
  assert(gallery.slice(3,6).every(c=>c.validPeek&&c.lean>0),'All three guns must use a valid lateral peek');
  assert.equal(gallery[6].stance,'CROUCH');assert.equal(gallery[7].stance,'STAND');
  await page.locator('canvas').screenshot({path:path.join(out,'cover-poses.png')});
  // Compare a native barrel's canvas transform to the actual pooled round,
  // at every wall normal and throughout the complete outward half-circle.
  const muzzleChecks=await page.evaluate(()=>{
   const original=window.drawLongGunSolid;let barrel=null,checks=0,maxError=0;
   const point=(m,x,y)=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});
   window.drawLongGunSolid=function(w,P,...args){barrel=point(drawingContext.getTransform(),...P.point(w===WEAPONS.SHOTGUN?37:39,0,0));return original(w,P,...args);};
   try{
    for(const kind of ['HIGH','LOW'])for(let face=0;face<4;face++)for(const key of ['ASSAULT_RIFLE','SHOTGUN'])for(let degree=-90;degree<=90;degree+=15){
     const normal=face*Math.PI/2,c=__coverActor(kind,normal+degree*Math.PI/180,true,false,key,normal);
     bullets=[];c.fire(c.aimAngle);if(!bullets.length)throw Error('Blocked valid '+kind+' '+key+' tangent '+face+'/'+degree);
     const shot={x:bullets[0].startX,y:bullets[0].startY};barrel=null;
     push();translate(340,290);rotate(.21);scale(3.1);const outer=drawingContext.getTransform();c.show();pop();
     if(!barrel)throw Error('Native barrel missing');
     const expected=point(outer,shot.x,shot.y),error=Math.hypot(barrel.x-expected.x,barrel.y-expected.y);
     if(error>1e-4)throw Error('Native barrel detached from round by '+error+' '+kind+'/'+key+'/'+degree);
     maxError=Math.max(maxError,error);checks++;
    }
   }finally{window.drawLongGunSolid=original;}
   return {checks,maxError,canvas:__coverNative};
  });
  assert.deepEqual(errors,[]);assert.equal(muzzleChecks.canvas.depth,0);assert.equal(muzzleChecks.canvas.minDepth,0);
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({gallery,muzzleChecks},null,2));
  if(process.env.COVER_MOVIE==='1'){
   const frames=path.join(out,'frames');fs.mkdirSync(frames,{recursive:true});
   await page.evaluate(()=>{
    window.__coverFilmActors=[];
    for(const kind of ['HIGH','LOW'])for(const key of ['PISTOL','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN']){
     const c=__coverActor(kind,Math.PI,false,kind==='HIGH',key);
     __coverFilmActors.push({c,kind,key,wall:activeBuildings[0]});
    }
    window.__coverFilm=index=>{
     background(22,31,38);fill(234,240,230);textFont('sans-serif');textAlign(CENTER,CENTER);textSize(23);
     text('Standing wall cover / crouched object cover',600,33);
     fill(158,184,188);textSize(14);text(index<30?'Peek / pop up, then release aim':'Full outward 180° aim sweep',600,62);
     for(let i=0;i<__coverFilmActors.length;i++){
      const {c,kind,key,wall}=__coverFilmActors[i],x=150+(i%4)*300,y=i<4?300:790;
      player=c;buildings=activeBuildings=[wall];invalidateColIndex();
      const aiming=index<30?index>=3&&index<19:true;
      c.aimAngle=index<30?(kind==='HIGH'?-.7:0):Math.PI-Math.PI/2+(index-30)*Math.PI/29;
      c.aimHold=aiming?14:0;rightStick.active=aiming;
      for(let step=0;step<2;step++){frameCount++;updateActorCover(c,1000/60,0,0,aiming);}
      push();translate(x,y);noStroke();fill(36,48,55);rect(-145,-190,290,410,8);
      fill(225,234,225);textSize(13);text(key.replaceAll('_',' '),0,-166);
      fill(149,179,184);textSize(11);text(kind==='HIGH'?'Stand / side peek':'Crouch / over top',0,-144);
      push();translate(10,20);scale(2.4);translate(-c.x,-c.y);
      if(kind==='HIGH'){fill(72,95,107);rect(wall.x-wall.w/2,wall.y-wall.h/2,wall.w,wall.h);}
      else drawNM0LabProp(wall);
      rightStick.active=false;c.show();pop();pop();
     }
    };
   });
   for(let i=0;i<60;i++){
    await page.evaluate(i=>__coverFilm(i),i);
    await page.locator('canvas').screenshot({path:path.join(frames,String(i).padStart(4,'0')+'.png')});
   }
   const {spawnSync}=require('node:child_process');
   const film=spawnSync('ffmpeg',['-v','error','-y','-framerate','30','-i',path.join(frames,'%04d.png'),'-c:v','libx264','-crf','19','-pix_fmt','yuv420p',path.join(out,'cover-motion.mp4')],{encoding:'utf8'});
   assert.equal(film.status,0,film.stderr);assert.deepEqual(errors,[]);
  }
  console.log(`${muzzleChecks.checks} native cover barrel/round checks passed. Gallery: ${out}/cover-poses.png`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

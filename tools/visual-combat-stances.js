// Native cel figure comparison: live stand/crouch/drop/prone actors and their
// physical bullet origins, with no substitute sprites or screenshot assets.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.STANCE_VIS_OUT||'/tmp/newone-combat-stances';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1160,height:890},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};setup=function(){createCanvas(1160,890);pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('__ready');
  const result=await page.evaluate(()=>{
   currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
   isPaused=isDead=isWin=killcamMode=false;inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=false;
   buildings=activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
   leftStick={active:false,dx:0,dy:0,base:{x:80,y:730}};
   rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1080,y:780}};
   setMeleeTool('NONE');jetpackUnlocked=false;window.milLvl=1;
   zoom=1;camX=camY=0;viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
   background(44,56,61);stroke(69,80,85);strokeWeight(1);
   for(let x=0;x<width;x+=40)line(x,0,x,height);for(let y=0;y<height;y+=40)line(0,y,width,y);
   fill(220,233,228);noStroke();textFont('sans-serif');textAlign(CENTER,CENTER);textSize(20);
   text('COMBAT STANCES / NATIVE CEL FIGURES',width/2,35);
   const labels=['STANDING','CROUCHED / 150 ms','DROPPING','PRONE / 300 ms'];
   const rows=[{type:'NORMAL',isP:true,w:WEAPONS.PISTOL,a:0,name:'PLAYER / PISTOL'},
    {type:'ARMORED_STANDARD',isP:false,w:WEAPONS.ASSAULT_RIFLE,a:-HALF_PI,name:'NM0 / RIFLE'},
    {type:'FEMALE_PISTOL',isP:false,w:WEAPONS.SMG,a:PI/4,name:'ALLY / SMG'}];
   const records=[];let depth=0,minDepth=0;const nativePush=window.push,nativePop=window.pop;
   window.push=function(...a){depth++;return nativePush(...a);};window.pop=function(...a){depth--;minDepth=Math.min(minDepth,depth);return nativePop(...a);};
   try{
    for(let row=0;row<rows.length;row++)for(let col=0;col<4;col++){
     const spec=rows[row],level=[0,1,1.5,2][col],cx=145+col*290,cy=190+row*240;
     const c=new Character(0,0,spec.isP,spec.type);c.currentWeapon=spec.w;c.isArmed=true;c.ammo=30;
     c.isFriendly=row===2;c.aimHold=14;c.aimAngle=c.moveAngle=spec.a;c.reloadTimer=c.meleeTimer=c.dashTimer=0;
     resetActorStance(c,['STAND','CROUCH','PRONE'][Math.round(level)]);c.stance.value=level;
     if(spec.isP)player=c;c.name='';bullets=[];c.fire(c.aimAngle);const muzzle={x:bullets[0].startX,y:bullets[0].startY};
     c.muzzleFlash=c.weaponKick=0;c.hp=c.maxHp;
     push();translate(cx,cy);scale(3);c.show();
     noFill();stroke(110,230,215,220);strokeWeight(.8);ellipse(muzzle.x,muzzle.y,4,4);pop();
     if(row===0){noStroke();fill(218,232,228);textSize(13);text(labels[col],cx,80);}
     fill(153,177,179);textSize(11);text(spec.name,cx,cy+87);
     records.push({row,col,level,muzzle,pose:{...actorStancePose(c)}});
    }
   }finally{window.push=nativePush;window.pop=nativePop;}
   fill(151,200,195);noStroke();textSize(12);text('Cyan rings show actual projectile origins. Standing art uses its original renderer.',width/2,height-28);
   return {records,depth,minDepth};
  });
  assert.equal(result.records.length,12);assert.equal(result.depth,0);assert.equal(result.minDepth,0);
  assert.deepEqual(errors,[]);
  await page.locator('canvas').first().screenshot({path:path.join(out,'stances.png')});
  fs.writeFileSync(path.join(out,'stances.json'),JSON.stringify(result,null,2));
  await page.setViewportSize({width:940,height:700});
  const scene=await page.evaluate(()=>{
   resizeCanvas(940,700);resetRunState();resetStoryProgress();isStoryMode=true;startAtLevel(8);
   started=doTick=true;isPaused=isDead=isWin=killcamMode=false;setMeleeTool('NONE');
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inOverworldView=false;
   window.inNM0SecretOverlay=false;window.showOnScreenControls=true;window.isDesktop=false;
   player.currentWeapon=WEAPONS.ASSAULT_RIFLE;player.isArmed=true;player.aimHold=14;
   player.hp=player.maxHp=10000;player.shield=0;resetActorStance(player,'PRONE');
   for(let i=16;i<20;i++)resetActorStance(enemiesList[i],['STAND','CROUCH','PRONE','CROUCH'][i-16]);
   leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
   rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
   lastActiveUpdate=0;activeBuildings=[];deltaTime=1000/60;
   for(let i=0;i<45;i++){frameCount++;draw();}
   return {fault:window.FRAME_FAULT||null,guards:enemiesList.length,stance:actorStance(player),
    playerAlive:player.hp>0,lowAim:enemiesList.some(e=>e.stanceAimZone==='LEGS'||e.stanceAimReadying)};
  });
  assert(!scene.fault,'the real laboratory combat scene has no frame fault');
  assert.equal(scene.guards,20);assert.equal(scene.stance,'PRONE');assert(scene.playerAlive);
  assert.deepEqual(errors,[]);
  await page.locator('canvas').first().screenshot({path:path.join(out,'combat-scene.png')});
  fs.writeFileSync(path.join(out,'combat-scene.json'),JSON.stringify(scene,null,2));
  console.log('12 native stance figures and 45 full combat frames pass browser checks. Previews: '+out);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});

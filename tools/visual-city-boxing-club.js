// Native p5 club review. Outputs remain outside the checkout by default.
// VIS_DEPS, VIS_CHROME, VIS_P5 and CITY_BOXING_OUT override local tooling.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const localDeps = path.join(__dirname, '../work/deps');
const deps = process.env.VIS_DEPS || (fs.existsSync(path.join(localDeps,'node_modules/playwright')) ? localDeps :
  '/opt/codex/runtimes/codex-primary-runtime/dependencies/node');
const {chromium} = require(path.join(deps, 'node_modules/playwright'));
const source = fs.readFileSync(process.env.GAME_JS || path.join(__dirname, '../game.js'), 'utf8');
const localP5 = path.join(__dirname, '../work/p5-phone-1.9.0.min.js');
const p5 = fs.readFileSync(process.env.VIS_P5 || (fs.existsSync(localP5) ? localP5 :
  '/workspace/newone-dev/node_modules/p5/lib/p5.min.js'), 'utf8');
const out = process.env.CITY_BOXING_OUT || '/tmp/newone-city-boxing-club';
fs.mkdirSync(out, {recursive:true});
(async () => {
  const browser = await chromium.launch({executablePath:process.env.VIS_CHROME || '/usr/bin/chromium',
    headless:true, args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent('<style>html,body{margin:0;overflow:hidden}</style>'+
      '<script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script>'+
      '<script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};'+
      'setup=function(){createCanvas(390,844);pixelDensity(2);noLoop();window.__ready=true;};</script>');
    await page.waitForFunction('__ready');
    const exterior = await page.evaluate(() => {
      resetRunState();currentLevel=currentBiome=1;BIOME_ACTIVE=true;started=doTick=true;isStoryMode=false;
      isPaused=isDead=isWin=killcamMode=false;
      inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
      inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
      inWorldBuildingMenu=inOverworldView=inTravelMenu=inUpgradeMenu=false;
      window.isDesktop=false;window.showOnScreenControls=true;
      jetpackUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
      jetpackUnlocked=true;
      townsData={1:{towersDown:true}};outpostFortState(1).captured=true;
      // Liberation leaves the live world in this zoomed-out mode. It must not
      // suppress the gym prompt as if it were a modal map screen.
      inOverworldView=true;zoom=.45;
      const chunk=generateChunkContent(1,3,9),site=chunk.solid.find(b=>b.cityVenue==='BOXING'&&!b.cityVenueSecondary);
      buildings=activeBuildings=chunk.solid;parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
      player=new Character(site.x,site.y+site.cityEntrance.face*(site.h/2+300),true);
      player.isArmed=true;player.currentWeapon=WEAPONS.ASSAULT_RIFLE;
      leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
      rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
      // The actual city loop must paint an entry prompt before the private
      // scene is entered. This also exercises native p5 world/HUD routing.
      camX=player.x-width/(2*zoom);camY=player.y-height/(2*zoom);
      deltaTime=16.67;draw();
      const worldPrompt=!!(_frontierSaloonPrompt&&_frontierSaloonPrompt.kind==='CITY_BOXING'&&_frontierSaloonPrompt.unlocked);
      const worldFault=window.FRAME_FAULT||null;
      window.__clubExterior={site,solids:chunk.solid,x:player.x,y:player.y};
      return {worldPrompt,worldFault,marker:cityBoxingClubMarker(),venue:site.cityVenueName};
    });
    assert.equal(exterior.worldPrompt,true);assert.equal(exterior.worldFault,null);assert.equal(exterior.marker,null);
    await page.locator('canvas').first().screenshot({path:path.join(out,'club-exterior-entry-portrait.png')});
    await page.setViewportSize({width:844,height:390});
    const landscapeEntry = await page.evaluate(() => {
      resizeCanvas(844,390);leftStick.base={x:80,y:height-160};rightStick.base={x:width-80,y:height-110};
      camX=player.x-width/(2*zoom);camY=player.y-height/(2*zoom);doTick=true;draw();
      return {button:frontierSaloonButtons()[0],fault:window.FRAME_FAULT||null};
    });
    assert.ok(landscapeEntry.button);assert.equal(landscapeEntry.fault,null);
    await page.locator('canvas').first().screenshot({path:path.join(out,'club-exterior-entry-landscape.png')});
    await page.setViewportSize({width:390,height:844});
    const distant = await page.evaluate(() => {
      resizeCanvas(390,844);leftStick.base={x:80,y:height-160};rightStick.base={x:width-80,y:height-110};
      buildings=activeBuildings=[];invalidateColIndex();player.x=600;player.y=600;
      camX=player.x-width/(2*zoom);camY=player.y-height/(2*zoom);doTick=true;draw();
      return {marker:cityBoxingClubMarker(),prompt:_frontierSaloonPrompt,fault:window.FRAME_FAULT||null};
    });
    assert.equal(distant.marker.edge,true);assert.equal(distant.prompt,null);assert.equal(distant.fault,null);
    await page.locator('canvas').first().screenshot({path:path.join(out,'club-distant-marker-portrait.png')});
    const entry = await page.evaluate(() => {
      buildings=activeBuildings=__clubExterior.solids;invalidateColIndex();
      player.x=__clubExterior.x;player.y=__clubExterior.y;
      camX=player.x-width/(2*zoom);camY=player.y-height/(2*zoom);doTick=true;draw();
      const b=frontierSaloonButtons().find(b=>b.action==='INTERACT');
      mouseX=b.x+b.w/2;mouseY=b.y+b.h/2;mouseButton=LEFT;
      touchStarted();
      const entered=frontierSaloonIsInside()&&_frontierSaloonSession.venue==='CITY_BOXING';
      window.__clubPaint={depth:0,minDepth:0,frames:0};
      const savedPush=window.push,savedPop=window.pop;
      window.push=function(...args){__clubPaint.depth++;return savedPush(...args);};
      window.pop=function(...args){__clubPaint.depth--;__clubPaint.minDepth=Math.min(__clubPaint.minDepth,__clubPaint.depth);return savedPop(...args);};
      window.__clubFrame=(frames=1)=>{
        for(let i=0;i<frames;i++){deltaTime=16.67;frameCount++;updateFrontierSaloonActivity();drawFrontierSaloonScene();__clubPaint.frames++;}
        return {...__clubPaint,fault:window.FRAME_FAULT||null};
      };
      __clubFrame();return {entered,venue:__clubExterior.site.cityVenueName,...__clubPaint};
    });
    assert.equal(entry.entered,true);assert.match(entry.venue,/EIGHT COUNT/);
    assert.equal(entry.depth,0);assert.equal(entry.minDepth,0);
    await page.locator('canvas').first().screenshot({path:path.join(out,'club-entry-portrait.png')});
    const freeWalking = await page.evaluate(() => {
      // Reproduce the phone recording: free walking after a loss, with an
      // owned jetpack and an exterior hip cache left over from the campaign.
      const s=_frontierSaloonSession,oldKeys=window.keyIsDown,oldShow=player.show;
      const dc=drawingContext,oldFill=dc.fill;
      let paintingPlayer=false,orangeDraws=0;
      dc.fill=function(...args){
        if(paintingPlayer&&this.fillStyle==='#ff6400')orangeDraws++;
        return oldFill.apply(this,args);
      };
      player.show=function(...args){paintingPlayer=true;try{return oldShow.apply(this,args);}finally{paintingPlayer=false;}};
      const cache={active:true,angle:Math.PI/2,phase:.7,motion:1,backward:0,cycle:0,frame:-1};
      player._standingMotion=cache;
      const before=JSON.stringify(cache);
      player.x=-340;player.y=300;s.camera=null;s.brawl='LOST';s.grit=0;
      window.keyIsDown=code=>code===68||code===87;
      try{__clubFrame(24);}finally{window.keyIsDown=oldKeys;player.show=oldShow;dc.fill=oldFill;}
      return {orangeDraws,jetpackOwned:jetpackUnlocked,cacheIntact:player._standingMotion===cache&&JSON.stringify(cache)===before,
        walking:player.isMoving,hip:standingLowerPose(player).angle,heading:player.moveAngle,fault:window.FRAME_FAULT||null};
    });
    assert.equal(freeWalking.orangeDraws,0);assert.equal(freeWalking.jetpackOwned,true);
    assert.equal(freeWalking.cacheIntact,true);assert.equal(freeWalking.walking,true);
    assert.ok(Math.abs(freeWalking.hip-freeWalking.heading)<1e-8);assert.equal(freeWalking.fault,null);
    await page.locator('canvas').first().screenshot({path:path.join(out,'club-free-walking-portrait.png')});
    await page.evaluate(()=>{player.x=0;player.y=390;_frontierSaloonSession.brawl='IDLE';_frontierSaloonSession.grit=100;_frontierSaloonSession.camera=null;});
    // A review-only wide framing shows the full native room painter, including
    // the ring, its south gate, the bag aisle and the trainer approach.
    await page.setViewportSize({width:960,height:800});
    const overview = await page.evaluate(() => {
      resizeCanvas(960,800);__clubFrame(245);deltaTime=0;
      _frontierSaloonSession.camera={x:0,y:0,lookX:0,lookY:0,scale:.66,centerX:480,centerY:400};
      drawFrontierSaloonInterior();return {...__clubPaint,fault:window.FRAME_FAULT||null};
    });
    assert.equal(overview.depth,0);assert.equal(overview.minDepth,0);assert.equal(overview.fault,null);
    await page.locator('canvas').first().screenshot({path:path.join(out,'club-room-overview.png')});
    await page.setViewportSize({width:390,height:844});
    const bag = await page.evaluate(() => {
      resizeCanvas(390,844);player.x=-350;player.y=-70;player.aimAngle=-Math.PI/2;_frontierSaloonSession.camera=null;
      return __clubFrame();
    });
    assert.equal(bag.depth,0);assert.equal(bag.fault,null);
    await page.locator('canvas').first().screenshot({path:path.join(out,'club-bags-portrait.png')});
    const fight = await page.evaluate(() => {
      startCityBoxingClubSparring();__clubFrame(80);
      const s=_frontierSaloonSession,c=s.fighters[0];
      return {...__clubPaint,brawl:s.brawl,live:s.fighters.filter(boxingAlive).length,
        boxer:c.cityBoxer,playerGloves:player.cityBoxingGloveOz,opponentGloves:c.cityBoxingGloveOz,
        fault:window.FRAME_FAULT||null};
    });
    assert.equal(fight.brawl,'ACTIVE');assert.equal(fight.live,1);assert.equal(fight.boxer,true);
    assert.equal(fight.playerGloves,8);assert.equal(fight.opponentGloves,8);assert.equal(fight.depth,0);assert.equal(fight.fault,null);
    await page.locator('canvas').first().screenshot({path:path.join(out,'club-sparring-portrait.png')});
    await page.setViewportSize({width:940,height:590});
    const landscape = await page.evaluate(() => {
      resizeCanvas(940,590);_frontierSaloonSession.camera=null;return __clubFrame(12);
    });
    assert.equal(landscape.depth,0);assert.equal(landscape.minDepth,0);assert.equal(landscape.fault,null);
    await page.locator('canvas').first().screenshot({path:path.join(out,'club-sparring-landscape.png')});
    const knockout = await page.evaluate(() => {
      frontierSaloonKnockOut(_frontierSaloonSession.fighters[0],0,{kind:'RIGHT_HOOK',level:'HEAD',damage:50});
      return __clubFrame(36);
    });
    assert.equal(knockout.depth,0);assert.equal(knockout.minDepth,0);assert.equal(knockout.fault,null);
    await page.locator('canvas').first().screenshot({path:path.join(out,'club-knockout-landscape.png')});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({exterior,landscapeEntry,distant,entry,freeWalking,overview,bag,fight,landscape,knockout,errors},null,2));
    console.log('Native city boxing club: entry, bags, portrait/landscape sparring and knockout pass browser/painter checks. Previews: '+out);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.stack||e);process.exit(1);});

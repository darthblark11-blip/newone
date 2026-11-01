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
    const entry = await page.evaluate(() => {
      resetRunState();currentLevel=currentBiome=1;BIOME_ACTIVE=true;started=doTick=true;isStoryMode=false;
      isPaused=isDead=isWin=killcamMode=false;
      inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
      inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
      inWorldBuildingMenu=inOverworldView=inTravelMenu=inUpgradeMenu=false;
      window.isDesktop=false;window.showOnScreenControls=true;
      jetpackUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
      townsData={1:{towersDown:true}};outpostFortState(1).captured=true;
      const chunk=generateChunkContent(1,3,9),site=chunk.solid.find(b=>b.cityVenue==='BOXING'&&!b.cityVenueSecondary);
      buildings=activeBuildings=chunk.solid;parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
      player=new Character(site.cityEntrance.x,site.cityEntrance.y,true);
      player.isArmed=true;player.currentWeapon=WEAPONS.ASSAULT_RIFLE;
      leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
      rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
      // The actual city loop must paint an entry prompt before the private
      // scene is entered. This also exercises native p5 world/HUD routing.
      camX=player.x-width/(2*zoom);camY=player.y-height/(2*zoom);
      deltaTime=16.67;draw();
      const worldPrompt=!!(_frontierSaloonPrompt&&_frontierSaloonPrompt.kind==='CITY_BOXING'&&_frontierSaloonPrompt.unlocked);
      const worldFault=window.FRAME_FAULT||null;
      const entered=interactFrontierSaloonActivity();
      window.__clubPaint={depth:0,minDepth:0,frames:0};
      const savedPush=window.push,savedPop=window.pop;
      window.push=function(...args){__clubPaint.depth++;return savedPush(...args);};
      window.pop=function(...args){__clubPaint.depth--;__clubPaint.minDepth=Math.min(__clubPaint.minDepth,__clubPaint.depth);return savedPop(...args);};
      window.__clubFrame=(frames=1)=>{
        for(let i=0;i<frames;i++){deltaTime=16.67;frameCount++;updateFrontierSaloonActivity();drawFrontierSaloonScene();__clubPaint.frames++;}
        return {...__clubPaint,fault:window.FRAME_FAULT||null};
      };
      __clubFrame();return {entered,worldPrompt,worldFault,venue:site.cityVenueName,...__clubPaint};
    });
    assert.equal(entry.entered,true);assert.match(entry.venue,/EIGHT COUNT/);
    assert.equal(entry.worldPrompt,true);assert.equal(entry.worldFault,null);
    assert.equal(entry.depth,0);assert.equal(entry.minDepth,0);
    await page.locator('canvas').first().screenshot({path:path.join(out,'club-entry-portrait.png')});
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
    fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({entry,overview,bag,fight,landscape,knockout,errors},null,2));
    console.log('Native city boxing club: entry, bags, portrait/landscape sparring and knockout pass browser/painter checks. Previews: '+out);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.stack||e);process.exit(1);});

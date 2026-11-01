// Native p5 acceptance: gate muster -> freed cohort -> casualties -> actual
// killcam draw -> final cutscene tap -> one Directive award -> reload.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const deps=process.env.VIS_DEPS||path.join(__dirname,'../work/deps');
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(process.env.VIS_P5||path.join(__dirname,'../work/p5-phone-1.9.0.min.js'),'utf8');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.setContent('<script>Object.defineProperty(window,"localStorage",{value:{slot:null,getItem(){return this.slot},setItem(k,v){this.slot=v},removeItem(){this.slot=null}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=()=>{};setup=()=>{createCanvas(390,844);pixelDensity(1);noLoop();window.ready=true;};</script>');
    await page.waitForFunction('ready');
    const result=await page.evaluate(()=>{
      resetStoryProgress();isStoryMode=false;startAtLevel(1);started=doTick=true;
      isPaused=isDead=isWin=killcamMode=false;
      inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
      inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
      inWorldBuildingMenu=inOverworldView=inTravelMenu=inUpgradeMenu=false;
      markSectorTowersDown(1);window.towersDefeated=true;
      sectorLedger(1).popGranted=true;townsData[1].established=true;markStoryBeat('L1_TOWN');
      grantCitizens(POP_POOL,5,0);
      leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
      rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
      const timers=[];window.setTimeout=fn=>{timers.push(fn);return timers.length;};
      const def=outpostFortDef(1);player.x=def.x;player.y=def.y+500;
      enemiesList=[];frameCount=30;maintainOutpostGarrison();triggerOutpostAmbush(def);
      for(const b of buildings)if(b.isTower&&b.isOutpost&&outpostFortMatches(b,def))b.hp=0;
      checkOutpostCaptured();
      const pending={freed:outpostFortState(1).freed,captured:outpostFortState(1).captured,
        pool:poolLedger().popTotal,recruits:outpostFortState(1).pendingRecruits.length,
        reserve:outpostFortState(1).musterWaves,directive:inWorldBuildingMenu};
      for(const e of enemiesList.filter(e=>e.isOutpostGarrison&&e.isFriendly).slice(0,7)){
        e.hp=0;e.dead=true;processKill(e.x,e.y,false,e.eType,true,e);
      }
      let defeated=0;
      while(nm0AmbushKills>0&&defeated<500){
        const e=enemiesList.find(e=>e.isAmbush&&!e.dead&&e.hp>0);
        if(!e)throw Error('Fort battle ran out of combatants');
        e.hp=0;e.dead=true;processKill(e.x,e.y,false,e.eType,false,e);defeated++;
        while(timers.length)timers.shift()();
      }
      const beforeHandoff={pool:poolLedger().popTotal,directive:inWorldBuildingMenu};
      killcamTimer=1;deltaTime=16.67;draw();
      const handoff={captured:outpostFortState(1).captured,scene:inFortCutscene,pool:poolLedger().popTotal};
      fortPhase=5;mouseX=width/2;mouseY=height/2;mouseButton=LEFT;touchStarted();
      const award={pool:poolLedger().popTotal,paid:outpostFortState(1).rosterGranted,directive:inWorldBuildingMenu};
      saveGame();loadGame();
      return {pending,defeated,beforeHandoff,handoff,award,reloadedPool:poolLedger().popTotal,fault:window.FRAME_FAULT||null};
    });
    assert.deepEqual(result.pending,{freed:true,captured:false,pool:5,recruits:50,reserve:120,directive:false});
    assert.equal(result.defeated,150);assert.deepEqual(result.beforeHandoff,{pool:5,directive:false});
    assert.deepEqual(result.handoff,{captured:true,scene:true,pool:5});
    assert.deepEqual(result.award,{pool:48,paid:true,directive:true});
    assert.equal(result.reloadedPool,48);assert.equal(result.fault,null);assert.deepEqual(errors,[]);
    console.log('PASS native p5 fortress handoff: 150 enemies cleared, 43/50 freed guards survive, +43 awarded once; reload and browser checks passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

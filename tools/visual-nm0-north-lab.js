// Replay the actual HQ frame through the Light Key gate and northern lab.
// Each scene retains authored collision, props, rendering and finite guards.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
let chromium;
try{({chromium}=require('playwright'));}catch{({chromium}=require(path.join(deps,'node_modules/playwright')));}
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(process.env.VIS_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.NM0_NORTH_OUT||'/tmp/newone-nm0-north-lab';
fs.mkdirSync(out,{recursive:true});
const scenes=[
 {name:'north-door-locked',w:940,h:760,x:-720,y:-2340,zoom:.8,locked:true,guards:true},
 {name:'north-door-open',w:940,h:850,x:-720,y:-2590,zoom:.7,guards:true},
 {name:'corridor-shootout',w:940,h:1100,x:-720,y:-3400,zoom:.55,guards:true},
 {name:'corridor-phone',w:393,h:800,x:-720,y:-3100,zoom:.66,guards:true,touch:true},
 {name:'portal-lab-overview',w:1200,h:1100,x:-720,y:-5050,zoom:.5},
 {name:'portal-machine',w:1100,h:900,x:-1000,y:-5480,zoom:.9},
 {name:'robot-parts-and-tools',w:1100,h:850,x:-1130,y:-5040,zoom:1},
 {name:'server-bank',w:1100,h:800,x:-720,y:-5760,zoom:.9},
 {name:'portal-phone',w:393,h:800,x:-720,y:-5175,zoom:.66,touch:true}
];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 let checks=0;const results=[];
 const ok=(pass,label)=>{assert.ok(pass,label);checks++;};
 try{
  for(const scene of scenes){
   const context=await browser.newContext({viewport:{width:scene.w,height:scene.h},isMobile:!!scene.touch,hasTouch:!!scene.touch,deviceScaleFactor:1});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<style>html,body{margin:0;overflow:hidden;touch-action:none}</style>'+
    '<script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script>'+
    '<script>'+p5+'</script><script>'+source+'</script>'+
    '<script>preload=function(){};setup=function(){createCanvas('+scene.w+','+scene.h+');pixelDensity(1);noLoop();window.__northReady=true;};</script>');
   await page.waitForFunction('__northReady');
   const initial=await page.evaluate(scene=>{
    randomSeed(29117);noiseSeed(BIOME_SEED);resetRunState();resetStoryProgress();
    isStoryMode=true;seedWorldClock();worldTimeMs=12/24*DAY_MS;
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
    startAtLevel(8);started=doTick=true;
    isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=false;
    inOverworldView=inTravelMenu=inLvl4Cutscene=false;
    window.inNM0SecretOverlay=false;window.showOnScreenControls=true;
    resetTouchAimSelection(false);setMeleeTool('NONE');deltaTime=1000/60;
    player.hp=player.maxHp=100;player.shield=100;
    activeBuildings=buildings;invalidateColIndex();
    const before={guards:enemiesList.length,north:nm0HqRoomRemaining('NORTH'),opened:nm0NorthOpened,
     blocked:player.checkCol(NM0_NW_LAB.door.x,NM0_NW_LAB.door.y)};
    let collected=false,opened=false,stable=true;
    if(!scene.locked){
     openNM0Office('EAST');
     const east=NM0_OFFICES.find(r=>r.id==='EAST');player.x=east.key.x-140;player.y=east.key.y;
     collected=nm0OfficeInteraction()?.kind==='KEY'&&useNM0OfficeInteraction()&&window.nm0LightKey;
     player.x=-720;player.y=-2340;const x=player.x,y=player.y;
     opened=nm0OfficeInteraction()?.kind==='NORTH_DOOR'&&useNM0OfficeInteraction()&&nm0NorthOpened;
     stable=x===player.x&&y===player.y&&currentLevel===8;
    }
    const north=enemiesList.filter(e=>e.nm0HqRoom==='NORTH');
    const after={collected,opened,stable,key:!!window.nm0LightKey,guards:enemiesList.length,north:north.length,
     canonical:north.every(e=>e.eType==='NM0_CITY_GUARD'&&!e.isFriendly&&!e.dead),
     blocked:player.checkCol(NM0_NW_LAB.door.x,NM0_NW_LAB.door.y),
     whiteProps:buildings.filter(b=>b.hqWhiteLab).length,
     portal:buildings.filter(b=>b.hqProp==='PORTAL_MACHINE').length};
    if(!scene.guards){enemiesList=[];window.nm0HqCleared=true;}
    streakMsgTimer=0;player.x=scene.x;player.y=scene.y;player.aimAngle=-HALF_PI;
    lastActiveUpdate=-1000;activeBuildings=[];activeParkingCars=[];invalidateColIndex();
    const graphics=window.createGraphics,pushNative=window.push,popNative=window.pop;
    window.__northGraphics=0;window.__northStack={depth:0,min:0};
    window.createGraphics=function(...a){__northGraphics++;return graphics(...a);};
    window.push=function(...a){__northStack.depth++;return pushNative(...a);};
    window.pop=function(...a){__northStack.depth--;__northStack.min=Math.min(__northStack.min,__northStack.depth);return popNative(...a);};
    window.__northFrame=()=>{
     zoom=(scene.zoom-.065)/.9;camX=scene.x-width/scene.zoom/2;camY=scene.y-height/scene.zoom/2;
     window.currentPan=0;rightStick.active=leftStick.active=false;frameCount++;draw();
    };
    __northFrame();
    return {before,after};
   },scene);
   ok(initial.before.guards===20&&initial.before.north===0&&!initial.before.opened&&initial.before.blocked,scene.name+' begins with the locked physical door and no premature north guards');
   if(scene.locked){ok(!initial.after.key&&!initial.after.opened&&initial.after.blocked,scene.name+' remains locked without the Light Key');}
   else{
    ok(initial.after.collected&&initial.after.key,scene.name+' collects and retains the actual east-office key');
    ok(initial.after.opened&&initial.after.stable&&!initial.after.blocked,scene.name+' unlocks the physical passage without teleporting');
    ok(initial.after.north===12&&initial.after.canonical&&initial.after.guards===40,scene.name+' activates exactly twelve canonical city guards once');
   }
   ok(initial.after.whiteProps>=12&&initial.after.portal===1,scene.name+' has authored laboratory equipment and one portal machine');
   const first=await page.evaluate(()=>({graphics:__northGraphics,tiles:nm0LabFloorCache.size,fault:window.FRAME_FAULT||null}));
   await page.evaluate(()=>__northFrame());
   const state=await page.evaluate(()=>({graphics:__northGraphics,tiles:nm0LabFloorCache.size,fault:window.FRAME_FAULT||null,
    level:currentLevel,blocked:player.checkCol(player.x,player.y),x:player.x,y:player.y,
    north:nm0HqRoomRemaining('NORTH'),opened:nm0NorthOpened,key:!!window.nm0LightKey,
    stack:{...__northStack},whiteProps:buildings.filter(b=>b.hqWhiteLab).length}));
   ok(!first.fault&&!state.fault,scene.name+' completes native frames without a fault');
   ok(!state.blocked&&state.level===8,scene.name+' keeps the player on clear same-level floor');
   ok(Math.hypot(state.x-scene.x,state.y-scene.y)<2,scene.name+' has no unexpected position jump');
   ok(state.tiles>0&&state.tiles<=24,scene.name+' keeps the floor cache bounded');
   ok(first.graphics===state.graphics&&first.tiles===state.tiles,scene.name+' reuses its baked floor on repeated frames');
   ok(state.stack.depth===0&&state.stack.min===0,scene.name+' balances native painter transforms');
   if(scene.guards)ok(state.north===(scene.locked?0:12),scene.name+' preserves the finite north roster through native updates');
   assert.deepEqual(errors,[],scene.name+' has no browser exceptions');checks++;
   await page.locator('canvas').first().screenshot({path:path.join(out,scene.name+'.png')});
   results.push({scene:scene.name,...state});await context.close();
  }
  fs.writeFileSync(path.join(out,'scenes.json'),JSON.stringify(results,null,2));
  console.log(`${checks}/${checks} native NM-0 north lab scene checks passed. Screenshots: ${out}`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});

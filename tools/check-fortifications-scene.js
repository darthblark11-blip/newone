// Native p5 touch/keyboard placement: a saved architecture reward is aimed,
// previewed, and confirmed without firing a weapon or spending it on cancel.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.FORT_SCENE_OUT||'/tmp/newone-fortifications';fs.mkdirSync(out,{recursive:true});
function initScene(){
    started=doTick=true;isDead=isWin=killcamMode=isStoryMode=false;currentLevel=currentBiome=2;BIOME_ACTIVE=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inDarchonCall=false;
    inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inLvl4Cutscene=false;
    inTravelMenu=inOverworldView=inWorldBuildingMenu=inUpstairsRoom=false;
    window.farmLvl=window.milLvl=window.sciLvl=1;window.archLvl=2;window.archBarrierReady=true;
    window.popArchitectureM=window.popArchitectureF=0;window.lastPauseTime=-10000;townsData={};
    authoredCore=authoredMask=authoredChunks=null;authoredSolids=[];authoredCars=[];chunkMgr=null;
    buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];enemiesList=[];barrels=[];allies=[];townCitizens=[];
    buildSites=[];playerStructures=[];buildGhost=null;bullets=[];particles=[];lightnings=[];playerGrenades=[];playerFlasks=[];
    resetForestWildlife();invalidateColIndex();setMeleeTool('NONE');resetTouchAimSelection(false);
    player=new Character(0,0,true);player.hp=100;player.currentWeapon=WEAPONS.PISTOL;player.ammo=30;player.isArmed=true;
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
    isPaused=true;pauseMenuState='BUILD';window.isDesktop=false;window.showOnScreenControls=true;
    camX=-width/(2*.66);camY=-height/(2*.66);zoom=.66;frameCount=100;deltaTime=1000/60;
    window.__fortNative={start:0,move:0,end:0};
    for(const [name,key]of[['touchStarted','start'],['touchMoved','move'],['touchEnded','end']]){
     const original=window[name];window[name]=function(...args){__fortNative[key]++;return original(...args);};
    }
    window.__fortStep=()=>{frameCount++;handleTouches();handleGamepad();if(!isPaused)player.updatePlayer();updateBuildPlacement();};
    window.__fortDesktopStep=()=>{frameCount++;handleDeathMenuInput();handleDesktop();if(!isPaused)player.updatePlayer();updateBuildPlacement();};
    window.__fortFresh=()=>{
     isPaused=false;buildGhost=null;playerStructures=[];buildSites=[];buildings=[];activeBuildings=[];bullets=[];
     invalidateColIndex();window.archBarrierReady=true;window.lastPauseTime=-10000;
     player.aimAngle=0;player.ammo=30;player.fireTimer=player.muzzleFlash=player.weaponKick=0;
     rightStick.active=false;rightStick.dx=rightStick.dy=rightStick.dist=0;deathMenuInput.mouseBlocked=false;
     resetTouchAimSelection(false);buildBarrier();updateBuildPlacement();
    };
    window.__fortPaint=()=>{
     resetMatrix();background(30,48,40);stroke(43,67,53);strokeWeight(1);
     for(let x=0;x<width;x+=40)line(x,0,x,height);
     for(let y=0;y<height;y+=40)line(0,y,width,y);
     push();translate(width/2,height/2);scale(.45);player.show();drawBuildGhost();
     drawBuildings(playerStructures.filter(b=>b.buildLevel===currentLevel));
     pop();drawUI();drawJoysticks();drawBuildHud();
    };
    window.__fortState=()=>({paused:isPaused,ready:window.archBarrierReady,ghost:buildGhost?{...buildGhost}:null,
     barriers:playerStructures.filter(b=>b.isUBarrier).map(b=>({x:b.x,y:b.y,w:b.w,h:b.h,hp:b.hp})),
     ammo:player.ammo,angle:player.aimAngle,bullets:bullets.length,flasks:playerFlasks.length,grenades:playerGrenades.length,
     effects:lightnings.length,events:{...__fortNative},fault:window.FRAME_FAULT||null});
}
async function createScene(browser,w,h,touch){
 const context=await browser.newContext({viewport:{width:w,height:h},isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;overflow:hidden;touch-action:none}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};setup=function(){createCanvas('+w+','+h+');pixelDensity(1);noLoop();window.__ready=true;};</script>');
 await page.waitForFunction('__ready');
 await page.evaluate(initScene);
 return {context,page,errors};
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 let checks=0;
 const ok=(condition,label)=>{assert(condition,label);checks++;};
 try{
  for(const [name,w,h] of [['phone320',320,700],['phone393',393,800],['landscape',940,430]]){
   const {context,page,errors}=await createScene(browser,w,h,true);
   const menu=await page.evaluate(()=>{
    const records=[],old=window.text;window.text=function(label,...args){records.push(String(label));return old(label,...args);};
    try{frameCount++;draw();}finally{window.text=old;}
    return {records,button:fortificationsMenuButton(),state:__fortState()};
   });
   ok(menu.records.includes('FORTIFICATIONS'),name+' paints the Fortifications option');
   ok(menu.records.includes('BARRIER READY · AIM AND PLACE INSTANTLY'),name+' explains the available instant barrier');
   ok(menu.button.x>=0&&menu.button.x+menu.button.w<=w&&menu.button.y>=0&&menu.button.y+menu.button.h<=h,name+' Fortifications row fits');
   ok(!menu.state.fault,name+' menu draw has no frame fault');
   await page.locator('canvas').first().screenshot({path:path.join(out,name+'-menu.png')});
   const client=await context.newCDPSession(page);
   const send=async(type,touchPoints,step=true)=>{await client.send('Input.dispatchTouchEvent',{type,touchPoints});if(step)await page.evaluate(()=>__fortStep());};
   const fort={id:1,x:Math.round(menu.button.x+menu.button.w/2),y:Math.round(menu.button.y+menu.button.h/2)};
   await send('touchStart',[fort]);
   let s=await page.evaluate(()=>__fortState());
   ok(!s.paused&&s.ghost&&s.ghost.kind==='BARRIER'&&s.ready,name+' native menu press starts a ready barrier preview');
   ok(s.barriers.length===0&&s.bullets===0&&s.ammo===30,name+' preview does not spend the reward or ammo');
   await send('touchEnd',[]);
   const aimBase=await page.evaluate(()=>buildPlacementAimBase());
   const aim={id:2,x:aimBase.x,y:aimBase.y-60},east={...aim,x:aimBase.x+60,y:aimBase.y};
   await send('touchStart',[aim]);
   s=await page.evaluate(()=>__fortState());
   ok(Math.abs(s.angle+Math.PI/2)<1e-7&&s.ghost.y<0&&s.ready,name+' right touch aims the ghost north');
   await send('touchMove',[east]);
   s=await page.evaluate(()=>__fortState());
   ok(Math.abs(s.angle)<1e-7&&s.ghost.x>0&&s.ghost.ok,name+' dragging the same thumb aims a valid barrier east');
   ok(s.bullets===0&&s.ammo===30&&s.effects===0&&s.flasks===0&&s.grenades===0,name+' placement aiming fires no native weapons');
   await page.evaluate(()=>__fortPaint());
   const controls=await page.evaluate(()=>buildPlacementControls());
   ok(Object.values(controls).every(b=>b.x>=0&&b.x+b.w<=w&&b.y>=0&&b.y+b.h<=h),name+' placement controls fit');
   ok(controls.place.y>h-100,name+' placement buttons sit below the movement stick');
   ok(controls.cancel.y>aimBase.y+60,name+' Cancel sits clear of the right aiming stick');
   await page.locator('canvas').first().screenshot({path:path.join(out,name+'-preview.png')});
   const preview={x:Math.round(s.ghost.x),y:Math.round(s.ghost.y)};
   const place={id:3,x:Math.round(controls.place.x+controls.place.w/2),y:Math.round(controls.place.y+controls.place.h/2)};
   await send('touchStart',[east,place]);
   s=await page.evaluate(()=>__fortState());
   ok(s.ghost===null&&!s.ready&&s.barriers.length===1,name+' native Place creates the barrier immediately');
   ok(s.barriers[0].x===preview.x&&s.barriers[0].y===preview.y&&s.barriers[0].hp===1000,name+' barrier matches the preview with its native HP');
   ok(s.bullets===0&&s.ammo===30,name+' confirming cannot fire a shot');
   await send('touchEnd',[]);await page.evaluate(()=>__fortPaint());
   await page.locator('canvas').first().screenshot({path:path.join(out,name+'-placed.png')});
   await page.evaluate(()=>{playerStructures=[];buildings=[];activeBuildings=[];invalidateColIndex();window.archBarrierReady=true;buildBarrier();updateBuildPlacement();});
   const cancel={id:4,x:Math.round(controls.cancel.x+controls.cancel.w/2),y:Math.round(controls.cancel.y+controls.cancel.h/2)};
   await send('touchStart',[cancel]);s=await page.evaluate(()=>__fortState());
   ok(s.ghost===null&&s.ready&&s.barriers.length===0,name+' native Cancel preserves the reward');
   await send('touchEnd',[]);
   await page.evaluate(()=>{buildBarrier();updateBuildPlacement();});
   await page.keyboard.down('Escape');
   await page.evaluate(()=>{frameCount++;handlePauseMenuInput();});
   s=await page.evaluate(()=>__fortState());
   ok(s.ghost===null&&s.ready&&!s.paused,name+' native Escape cancels without pausing on the same key');
   await page.keyboard.up('Escape');await page.evaluate(()=>{frameCount++;handlePauseMenuInput();});
   await page.evaluate(()=>{buildBarrier();updateBuildPlacement();});
   await page.keyboard.down('Enter');s=await page.evaluate(()=>__fortState());
   ok(s.ghost===null&&!s.ready&&s.barriers.length===1&&!s.paused,name+' native Enter confirms the valid preview');
   await page.keyboard.up('Enter');
   await page.evaluate(()=>{__fortFresh();isPaused=true;pauseMenuState='MAIN';});
   await page.keyboard.down('Enter');s=await page.evaluate(()=>__fortState());
   ok(s.ghost&&s.ready&&s.barriers.length===0,name+' Enter cannot confirm a paused ghost');
   await page.keyboard.up('Enter');
   await page.evaluate(()=>__fortFresh());
   await send('touchStart',[{id:5,...aimBase}]);
   await send('touchMove',[{id:5,x:w-35,y:45}]);s=await page.evaluate(()=>__fortState());
   ok(!s.paused&&s.ghost&&s.ready,name+' dragging an owned aim finger through the pause corner keeps aiming');
   await send('touchEnd',[]);
   await send('touchStart',[{id:6,x:w-35,y:45}]);s=await page.evaluate(()=>__fortState());
   ok(s.paused&&s.ghost&&s.ready,name+' a fresh corner tap pauses placement without spending the reward');
   await send('touchEnd',[]);
   ok(s.events.start>=4&&s.events.move>=1&&s.events.end>=3,name+' uses actual p5 touch callbacks');
   assert.deepEqual(errors,[],name+' has no browser exceptions');
   await context.close();
  }
  // Mouse callbacks use a fresh desktop scene: p5 intentionally suppresses
  // compatibility mouse callbacks after its native touch callbacks.
  {
   const name='desktop',w=940,h=700;
   const {context,page,errors}=await createScene(browser,w,h,false);
   const controls=await page.evaluate(()=>buildPlacementControls());
   let s;
   for(const action of ['place','cancel']){
    await page.evaluate(()=>__fortFresh());
    const b=controls[action];
    await page.mouse.move(Math.round(b.x+b.w/2),Math.round(b.y+b.h/2));
    await page.mouse.down();
    await page.evaluate(()=>{for(let i=0;i<30;i++)__fortDesktopStep();});
    s=await page.evaluate(()=>__fortState());
    ok(!s.ghost&&s.ammo===30&&s.bullets===0,name+' holding mouse after '+action+' cannot fire: '+JSON.stringify(s));
    ok(action==='place'?!s.ready&&s.barriers.length===1:s.ready&&s.barriers.length===0,name+' mouse '+action+' resolves the expected reward state');
    await page.mouse.up();await page.evaluate(()=>__fortDesktopStep());
    await page.mouse.move(Math.round(w/2+80),Math.round(h/2));await page.mouse.down();
    await page.evaluate(()=>__fortDesktopStep());s=await page.evaluate(()=>__fortState());
    ok(s.ammo===29&&s.bullets===1,name+' firing rearms only after release and a fresh click following '+action);
    await page.mouse.up();await page.evaluate(()=>__fortDesktopStep());
   }
   await page.evaluate(()=>__fortPaint());
   await page.locator('canvas').first().screenshot({path:path.join(out,name+'-mouse.png')});
   assert.deepEqual(errors,[],name+' has no browser exceptions');
   await context.close();
  }
  console.log(`${checks}/${checks} native fortification menu, touch, keyboard and mouse checks passed. Screenshots: ${out}`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});

// Real p5 touch events: down selects a body zone, motion uses the floating
// stick, and a release allows the next target. Saves phone/landscape previews.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.TOUCH_AIM_OUT||'/tmp/newone-touch-aim';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  for(const [name,w,h] of [['phone320short',320,568],['phone320',320,700],['phone393',393,800],['landscape',940,430]]){
   const context=await browser.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true,deviceScaleFactor:1});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;overflow:hidden;touch-action:none}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};setup=function(){createCanvas('+w+','+h+');pixelDensity(1);noLoop();window.__ready=true;};</script>');
   await page.waitForFunction('__ready');
   await page.evaluate(()=>{
    isStoryMode=false;townsData={};startAtLevel(2);started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=false;
    inOverworldView=inTravelMenu=inLvl4Cutscene=false;buildGhost=null;
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
    resetTouchAimSelection(false);resetTouchControlFade();setPlayerAimZone('BODY');setMeleeTool('NONE');deltaTime=1000/60;
    player.x=width/2;player.y=height/2;player.isArmed=true;player.ammo=30;
    activeBuildings=[];activeParkingCars=[];buildings=[];enemiesList=[];bullets=[];particles=[];barrels=[];
    invalidateColIndex();window.isDesktop=false;window.showOnScreenControls=true;
    grenadesUnlocked=meleeUnlocked=jetpackUnlocked=true;chemistSuitUnlocked=false;pGrenadeAmmo=3;pFlaskAmmo=2;
    consecutiveKills=15;comboTimer=75;score=1200;worldTimeMs=12/24*DAY_MS;
    window.__nativeAimEvents={start:0,move:0,end:0};
    for(const [name,key]of[['touchStarted','start'],['touchMoved','move'],['touchEnded','end']]){
     const original=window[name];window[name]=function(...a){__nativeAimEvents[key]++;return original(...a);};
    }
    window.__aimStep=()=>{frameCount++;handleTouches();handleGamepad();player.updatePlayer();};
    window.__aimPaint=()=>{
     frameCount++;updateTouchControlFade();
     background(32,50,42);stroke(40,64,50);strokeWeight(1);
     for(let x=0;x<width;x+=40)line(x,0,x,height);
     for(let y=0;y<height;y+=40)line(0,y,width,y);
     player.show();drawUI();drawJoysticks();
    };
    window.__aimState=()=>({zone:playerAimTarget(),owner:touchAimSelection.pointerId,
     origin:rightStick.touchOrigin?{...rightStick.touchOrigin}:null,active:rightStick.active,dist:rightStick.dist,
     bullets:bullets.map(b=>b.tH),events:{...__nativeAimEvents},base:{...rightStick.base},alpha:touchControlFade.alpha});
    __aimPaint();
   });
   const paintColumn=async chemist=>page.evaluate(chemist=>{
    chemistSuitUnlocked=chemist;const records=[],rects=[],original=window.text,originalRect=window.rect;
    window.text=function(label,x,y,...args){records.push({label:String(label),x,y,alpha:drawingContext.globalAlpha});return original(label,x,y,...args);};
    window.rect=function(x,y,w,h,...args){rects.push({x,y,w,h,alpha:drawingContext.globalAlpha});return originalRect(x,y,w,h,...args);};
    try{__aimPaint();}finally{window.text=original;window.rect=originalRect;}
    return {records,rects,layout:touchCombatLayout()};
   },chemist);
   const normal=await paintColumn(false);
   for(const [label,key]of[['GRENADE\n(3)','grenade'],['RELOAD','reload'],['DASH','dash'],['MELEE','melee']]){
    const item=normal.records.find(r=>r.label===label);assert(item,name+' draws '+label);
    assert.equal(item.x,w-35);assert.equal(item.y,normal.layout[key].y);
   }
   assert(!normal.records.some(r=>r.label.startsWith('SCORE:')),name+' omits score from the gameplay HUD');
   assert(!normal.rects.some(r=>r.x===w-60&&r.y===40&&r.w===40&&r.h===40),name+' omits the pause icon');
   assert(normal.rects.some(r=>r.x===20&&r.y===20&&r.alpha===1),name+' leaves the health HUD opaque');
   await page.locator('canvas').first().screenshot({path:path.join(out,name+'-idle.png')});
   const chemist=await paintColumn(true);
   for(const [label,key]of[['FLASK\n(2)','flask'],['RELOAD','reload'],['DASH','dash'],['CANNON\n(4)','cannon']]){
    const item=chemist.records.find(r=>r.label===label);assert(item,name+' draws chemist '+label);
    assert.equal(item.x,w-35);assert.equal(item.y,chemist.layout[key].y);
   }
   assert(!chemist.records.some(r=>r.label==='MELEE'||r.label.startsWith('GRENADE')),name+' uses chemist abilities in replacement slots');
   await page.locator('canvas').first().screenshot({path:path.join(out,name+'-chemist.png')});
   const shopScore=await page.evaluate(()=>{
    const records=[],original=window.text;window.text=function(label,...args){records.push(String(label));return original(label,...args);};
    try{drawUpgradeMenu();}finally{window.text=original;}
    return records.find(r=>r.startsWith('AVAILABLE SCORE:'));
   });
   assert.equal(shopScore,'AVAILABLE SCORE: 1200',name+' keeps score in the shop');
   await page.evaluate(()=>{chemistSuitUnlocked=false;__aimPaint();});
   const client=await context.newCDPSession(page);
   const layout=await page.evaluate(()=>touchAimSilhouetteLayout());
   const head={id:1,x:Math.round(layout.centerX-8),y:Math.round(layout.sections[0].y+22)};
   const send=async(type,points)=>{await client.send('Input.dispatchTouchEvent',{type,touchPoints:points});await page.evaluate(()=>__aimStep());};
   await send('touchStart',[head]);
   let s=await page.evaluate(()=>__aimState());
   assert.equal(s.zone,'HEAD');assert.equal(s.dist,0);assert.equal(s.bullets.length,0);
   assert.deepEqual(s.origin,{x:head.x,y:head.y});assert.equal(s.events.start,1);
   await page.evaluate(()=>__aimPaint());
   await page.locator('canvas').first().screenshot({path:path.join(out,name+'-head-pressed.png')});
   await send('touchMove',[{...head,x:head.x-60}]);
   s=await page.evaluate(()=>__aimState());
   assert.equal(s.zone,'HEAD');assert.equal(s.dist,1);assert.deepEqual(s.bullets,['HEAD']);
   assert.deepEqual(s.origin,{x:head.x,y:head.y});assert.equal(s.events.move,1);
   await page.evaluate(()=>__aimPaint());
   await page.locator('canvas').first().screenshot({path:path.join(out,name+'-head-drag.png')});
   s=await page.evaluate(()=>__aimState());assert(s.alpha>0&&s.alpha<1,name+' passes through a partial control fade');
   await page.evaluate(()=>{for(let i=0;i<15;i++){__aimStep();__aimPaint();}});
   s=await page.evaluate(()=>__aimState());assert.equal(s.alpha,0,name+' fades controls fully during aim');
   const faded=await paintColumn(false);
   assert(faded.records.filter(r=>['RELOAD','DASH','MELEE'].includes(r.label)).every(r=>r.alpha===0),name+' fades only the touch-control layer');
   assert(faded.rects.some(r=>r.x===20&&r.y===20&&r.alpha===1),name+' keeps health opaque while touch controls fade');
   await page.locator('canvas').first().screenshot({path:path.join(out,name+'-aim-faded.png')});
   await send('touchMove',[{...head,y:layout.sections[2].y+24}]);
   s=await page.evaluate(()=>__aimState());assert.equal(s.zone,'HEAD');
   assert.deepEqual(s.origin,{x:head.x,y:head.y});
   await send('touchEnd',[]);s=await page.evaluate(()=>__aimState());
   assert.equal(s.owner,null);assert.equal(s.origin,null);assert.equal(s.active,false);assert.equal(s.events.end,1);
   await page.evaluate(()=>{for(let i=0;i<4;i++){__aimStep();__aimPaint();}});
   s=await page.evaluate(()=>__aimState());assert(s.alpha>0&&s.alpha<1,name+' fades controls back in after release');
   await page.evaluate(()=>{for(let i=0;i<15;i++){__aimStep();__aimPaint();}});
   s=await page.evaluate(()=>__aimState());assert.equal(s.alpha,1,name+' restores idle controls');
   await page.locator('canvas').first().screenshot({path:path.join(out,name+'-idle-restored.png')});
   const leg={id:2,x:Math.round(layout.centerX+3),y:Math.round(layout.sections[2].y+26)};
   await page.evaluate(()=>{player.fireTimer=0;bullets=[];});
   await send('touchStart',[leg]);s=await page.evaluate(()=>__aimState());
   assert.equal(s.zone,'LEGS');assert.deepEqual(s.origin,{x:leg.x,y:leg.y});
   await send('touchMove',[{...leg,x:leg.x-60}]);s=await page.evaluate(()=>__aimState());
   assert.deepEqual(s.bullets,['LEGS']);assert.equal(s.events.start,2);
   await send('touchEnd',[]);
   // A desktop input takeover cancels/consumes the existing finger; keeping
   // that finger down must not recreate the hidden touch stick on next poll.
   await send('touchStart',[head]);
   await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'w'})));
   await page.evaluate(()=>__aimStep());s=await page.evaluate(()=>__aimState());
   assert.equal(s.owner,null);assert.equal(s.active,false);
   await send('touchEnd',[]);
   await send('touchStart',[head]);
   await page.evaluate(()=>window.dispatchEvent(new MouseEvent('mousemove',{clientX:40,clientY:40})));
   await page.evaluate(()=>__aimStep());s=await page.evaluate(()=>__aimState());
   assert.equal(s.owner,null);assert.equal(s.active,false);
   await send('touchEnd',[]);
   const column=await page.evaluate(()=>touchCombatLayout());
   await page.evaluate(()=>{player.reloadTimer=0;player.ammo=2;});
   await send('touchStart',[{id:3,...column.reload}]);
   assert(await page.evaluate(()=>player.reloadTimer>0&&!grenadeInputHeld&&!cannonInputHeld&&!meleeInputHeld),name+' native second-row reload');
   await send('touchEnd',[]);
   await page.evaluate(()=>{chemistSuitUnlocked=true;player.reloadTimer=0;player.dashTimer=0;isCooking=false;pFlaskAmmo=2;playerFlasks=[];playerGrenades=[];lightnings=[];});
   await send('touchStart',[{id:4,...column.flask}]);
   assert(await page.evaluate(()=>isCooking&&meleeInputHeld&&!grenadeInputHeld&&!cannonInputHeld),name+' native top-row flask');
   await send('touchEnd',[]);
   assert(await page.evaluate(()=>playerFlasks.length===1&&playerGrenades.length===0),name+' native flask release');
   await page.evaluate(()=>{player.throwAnimTimer=0;player.cannonCooldown=0;player.cannonFireDelay=0;});
   await send('touchStart',[{id:5,...column.cannon}]);
   assert(await page.evaluate(()=>player.cannonCharge>0&&cannonInputHeld&&!meleeInputHeld&&!grenadeInputHeld),name+' native bottom-row cannon');
   await send('touchEnd',[]);
   assert(await page.evaluate(()=>lightnings.length===1&&playerGrenades.length===0),name+' native cannon release');
   await page.evaluate(()=>{window.lastPauseTime=-10000;});
   await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:7,x:w-35,y:45}]});
   assert(await page.evaluate(()=>isPaused&&pauseMenuState==='MAIN'&&touchAimSelection.pointerId===null),name+' corner down opens pause without polling an input frame');
   await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert(await page.evaluate(()=>isPaused&&touchAimSelection.pointerId===null),name+' zero-frame corner down/up tap remains paused');
   await page.evaluate(()=>{resumeFromPause();window.lastPauseTime=-10000;});
   await send('touchStart',[{id:6,x:w-35,y:45}]);
   assert(await page.evaluate(()=>isPaused&&pauseMenuState==='MAIN'&&touchAimSelection.pointerId===null),name+' invisible top-right tap opens pause');
   await page.evaluate(()=>{resumeFromPause();handleTouches();});
   assert(await page.evaluate(()=>!isPaused&&!rightStick.active&&touchAimSelection.pointerId===null),name+' consumes held pause touch on resume');
   await send('touchEnd',[]);
   assert.deepEqual(errors,[],name+' has no browser exceptions');
   fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(s,null,2));
   await context.close();
  }
  console.log('Native p5 touch targeting, control fades and hidden pause passed at 320px, 393px and landscape. Screenshots: '+out);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});

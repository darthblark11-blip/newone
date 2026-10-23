// Native p5 touch callbacks and the complete frame: stance presses must not
// become movement/fire, and pausing a real drop must preserve its progress.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const deps = process.env.VIS_DEPS || '/workspace/newone-dev';
const { chromium } = require(path.join(deps, 'node_modules/playwright'));
const source = fs.readFileSync(process.env.GAME_JS || path.join(__dirname, '../game.js'), 'utf8');
const p5 = fs.readFileSync(path.join(deps, 'node_modules/p5/lib/p5.min.js'), 'utf8');
const out = process.env.STANCE_SCENE_OUT || '/tmp/newone-stance-scenes'; fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VIS_CHROME || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox'] });
  let checks = 0;
  const ok = (value, label) => { assert(value, label); checks++; };
  try {
    for (const [name, w, h] of [['phone393',393,800],['phone320short',320,568],['landscape',940,430]]) {
      const context = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      const page = await context.newPage(), errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<style>html,body{margin:0;overflow:hidden;touch-action:none}</style>' +
        '<script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script>' +
        '<script>' + p5 + '</script><script>' + source + '</script>' +
        '<script>preload=function(){};setup=function(){createCanvas(' + w + ',' + h + ');pixelDensity(1);noLoop();window.__stanceReady=true;};</script>');
      await page.waitForFunction('__stanceReady');
      const initial = await page.evaluate(() => {
        randomSeed(8223);noiseSeed(BIOME_SEED);resetRunState();resetStoryProgress();isStoryMode=true;
        seedWorldClock();worldTimeMs=12/24*DAY_MS;
        leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
        rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
        startAtLevel(8);started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
        inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
        inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=false;
        inTravelMenu=inOverworldView=inLvl4Cutscene=false;window.inNM0SecretOverlay=false;
        setMeleeTool('NONE');resetTouchAimSelection(false);resetActorStance(player);
        window.showOnScreenControls=true;window.isDesktop=false;window.lastPauseTime=-1000;
        const guards=enemiesList.length,armored=enemiesList.every(e=>e.eType==='ARMORED_STANDARD');
        enemiesList=[]; // Keep native art/geometry; isolate control assertions from hostile AI.
        player.currentWeapon=WEAPONS.PISTOL;player.ammo=17;player.isArmed=true;player.shield=100;
        bullets=[];particles=[];deltaTime=1000/60;
        window.__stanceEvents={start:0,move:0,end:0};
        for(const [fn,key] of [['touchStarted','start'],['touchMoved','move'],['touchEnded','end']]) {
          const original=window[fn];window[fn]=function(...args){__stanceEvents[key]++;return original(...args);};
        }
        window.__stanceStep=(frames=1)=>{for(let i=0;i<frames;i++){frameCount++;deltaTime=1000/60;draw();}};
        window.__stanceState=()=>({stance:actorStance(player),state:{...player.stance},
          x:player.x,y:player.y,angle:player.aimAngle,ammo:player.ammo,paused:isPaused,
          bullets:bullets.filter(b=>b.active).map(b=>({zone:b.tH,x:b.startX,y:b.startY})),
          aim:touchAimSelection.pointerId,aimActive:rightStick.active,move:leftStick.active,
          events:{...__stanceEvents},fault:window.FRAME_FAULT||null});
        __stanceStep();return {guards,armored};
      });
      ok(initial.guards===20&&initial.armored,name+' starts with the native finite HQ roster');
      const client=await context.newCDPSession(page);
      const send=async(type,points)=>{await client.send('Input.dispatchTouchEvent',{type,touchPoints:points});await page.evaluate(()=>__stanceStep());};
      const state=()=>page.evaluate(()=>__stanceState());
      const pill=await page.evaluate(()=>stanceTouchButton());
      ok(pill.x-pill.w/2>=0&&pill.x+pill.w/2<=w&&pill.y-pill.h/2>=0&&pill.y+pill.h/2<=h,name+' stance button fits the viewport');
      const clear=await page.evaluate(()=>{
        const b=stanceTouchButton(),a=combatHudLayout().ammo;
        const outsideAmmo=b.x-b.w/2>a.iconX+a.iconW||b.y-b.h/2>a.iconY+a.iconH;
        const clearStick=Math.abs(b.x-leftStick.base.x)>b.w/2+60||Math.abs(b.y-leftStick.base.y)>b.h/2+60;
        return outsideAmmo&&clearStick;
      });
      ok(clear,name+' stance button clears ammunition and movement controls');
      const press={id:1,x:Math.round(pill.x),y:Math.round(pill.y)};
      await send('touchStart',[press]);let s=await state();
      ok(s.state.to===1&&s.stance==='STAND',name+' a real press begins the150ms jointed crouch without immediate immunity');
      ok(!s.aimActive&&!s.move&&s.ammo===17&&s.bullets.length===0,name+' stance press cannot aim, move or fire');
      await page.evaluate(()=>__stanceStep(40));s=await state();
      ok(s.stance==='CROUCH'&&s.state.value===1,name+' the native frame completes crouch');
      const layout=await page.evaluate(()=>touchAimSilhouetteLayout());
      const head={id:2,x:Math.round(layout.centerX-8),y:Math.round(layout.sections[0].y+22)};
      await send('touchMove',[{...press,x:head.x,y:head.y}]);await page.evaluate(()=>__stanceStep(20));s=await state();
      ok(s.stance==='CROUCH'&&s.aim===null&&s.ammo===17&&s.bullets.length===0,name+' held stance finger cannot become aiming or another stance');
      await send('touchEnd',[]);
      await page.locator('canvas').first().screenshot({path:path.join(out,name+'-crouch.png')});
      await send('touchStart',[press]);await send('touchEnd',[]);await page.evaluate(()=>__stanceStep(40));s=await state();
      ok(s.stance==='PRONE'&&s.state.value===2,name+' a fresh press completes the300ms prone drop');
      ok(s.ammo===17&&s.bullets.length===0,name+' both stance transitions preserve ammunition');
      await page.locator('canvas').first().screenshot({path:path.join(out,name+'-prone.png')});

      const walk=await page.evaluate(()=>({id:3,x:Math.round(leftStick.base.x+45),y:Math.round(leftStick.base.y)}));
      const beforeMove=s.x;await send('touchStart',[walk]);await page.evaluate(()=>__stanceStep(4));s=await state();
      ok(s.move&&s.x>beforeMove&&s.stance==='PRONE',name+' a separate movement finger crawls the real actor');
      await send('touchStart',[walk,head]);s=await state();
      ok(s.aim!==null&&s.ammo===17&&s.bullets.length===0,name+' a separate silhouette press selects aim without firing');
      await send('touchMove',[walk,{...head,x:head.x-60}]);s=await state();
      ok(s.ammo===16&&s.bullets.length===1&&s.bullets[0].zone==='HEAD',name+' dragging the aim thumb fires the selected elevation while prone');
      const bullet=s.bullets[0],forward=(bullet.x-s.x)*Math.cos(s.angle)+(bullet.y-s.y)*Math.sin(s.angle);
      ok(forward>20&&forward<35,name+' the compact prone pistol fires ahead of the head without the old exaggerated reach');
      await send('touchEnd',[]);

      await page.evaluate(()=>{window.lastPauseTime=millis()-1000;player.fireTimer=0;});
      await send('touchStart',[press]);await send('touchEnd',[]);await page.evaluate(()=>__stanceStep(3));
      const corner={id:4,x:w-35,y:45};await send('touchStart',[corner]);s=await state();
      ok(s.paused&&s.state.to===0&&s.state.value>0,name+' a fresh corner tap pauses an active rise');
      const frozen=JSON.stringify(s.state);await page.evaluate(()=>__stanceStep(30));s=await state();
      ok(JSON.stringify(s.state)===frozen,name+' real paused frames freeze stance progress');
      await send('touchEnd',[]);await page.waitForTimeout(350);
      await send('touchStart',[{id:5,x:Math.round(w/2-60),y:Math.round(h/2-190)}]);s=await state();
      ok(!s.paused&&s.state.to===0,name+' Continue resumes the existing stance transition');
      await send('touchEnd',[]);await page.evaluate(()=>__stanceStep(40));s=await state();
      ok(s.stance==='STAND'&&s.state.value===0,name+' resumed simulation finishes standing');
      ok(s.events.start>=7&&s.events.move>=2&&s.events.end>=5,name+' the replay uses actual p5 touch callbacks');
      ok(!s.fault,name+' the complete scene has no frame fault');
      assert.deepEqual(errors,[],name+' has no browser exceptions');
      await page.locator('canvas').first().screenshot({path:path.join(out,name+'-resumed.png')});
      await context.close();
    }
    console.log(`${checks}/${checks} native stance touch, movement, aiming and pause checks passed. Screenshots: ${out}`);
  } finally {await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});

// Native player painters and Canvas transforms verify the visible laser, not
// a second drawing of the query result. Set VIS_DEPS/VIS_CHROME as needed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(process.env.VIS_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.AIM_LASER_OUT||'/tmp/newone-aim-laser';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:2040,height:1180},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(2040,1180);pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('__ready');
  const result=await page.evaluate(()=>{
   let checks=0;const verify=(condition,label)=>{if(!condition)throw Error(label);checks++;};
   verify(typeof drawPlayerAimLaser==='function','native aim laser renderer exists');
   resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;
   started=doTick=true;isStoryMode=isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
   inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
   window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
   setMeleeTool('NONE');jetpackUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
   leftStick={active:false,dx:0,dy:0};rightStick={active:true,dx:1,dy:0,dist:1};
   viewLeft=viewTop=-10000;viewRight=viewBottom=10000;zoom=1;camX=camY=0;
   window.setTimeout=()=>0;deltaTime=1000/60;
   const nativeLaser=drawPlayerAimLaser,nativeElev=elevRenderScale,nativeDepth=shovelRenderScale;
   let frameMatrix=null,events=[];
   const point=(m,x,y)=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});
   drawPlayerAimLaser=function(g,c,index=0,...rest){
    const ray={...tracePlayerAimLaser(c,index)},transform=frameMatrix;
    const proxy=new Proxy(g,{get(target,key){
     if(key==='line')return function(x,y,nx,ny){
      const m=(target.drawingContext||drawingContext).getTransform();
      events.push({index,ray,start:point(m,x,y),end:point(m,nx,ny),
       expectedStart:point(transform,ray.startX,ray.startY),expectedEnd:point(transform,ray.x,ray.y)});
      return target.line(x,y,nx,ny);
     };
     const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
    }});
    return nativeLaser(proxy,c,index,...rest);
   };
   const clear=()=>{
    frameCount++;bullets=[];particles=[];corpses=[];enemiesList=[];
    buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
    invalidateColIndex();resetForestWildlife();resetShovelState();
    player=new Character(0,0,true);player.aimAngle=player.moveAngle=0;player.isArmed=true;
    player.isMoving=false;player.gait=player.walkCycle=player.reloadTimer=player.meleeTimer=player.muzzleFlash=0;
    player.currentWeapon=WEAPONS.PISTOL;player.ammo=30;player.aimHold=AIM_HOLD;resetActorStance(player);
    player.skinCol=color(235,180,140);events=[];
   };
   const enemy=(x,y,stance='STAND')=>{
    const e=new Character(x,y,false,'NORMAL');e.hp=e.maxHp=1000;
    e.aimAngle=e.moveAngle=0;e.isMoving=false;e.gait=e.walkCycle=e.muzzleFlash=0;
    e.isFriendly=e.isNeutral=false;e.isArmed=true;e.currentWeapon=WEAPONS.PISTOL;resetActorStance(e,stance);
    enemiesList.push(e);return e;
   };
   const select=zone=>{playerAimZone=zone;headAimToggle=zone==='HEAD';};
   const floor=()=>{
    stroke(68,88,79,65);strokeWeight(.45);
    for(let x=-30;x<520;x+=20)line(x,-65,x,65);
    for(let y=-60;y<=60;y+=20)line(-30,y,520,y);
   };
   const paint=label=>{
    frameMatrix=drawingContext.getTransform();events=[];
    const before=JSON.stringify({bullets:bullets.length,particles:particles.length,ammo:player.ammo});
    for(const e of enemiesList)e.show();player.show();
    verify(events.length===(player.currentWeapon===WEAPONS.DUAL_SMG?2:1),label+' native figure draws every active barrel');
    for(const event of events){
     verify(Math.hypot(event.start.x-event.expectedStart.x,event.start.y-event.expectedStart.y)<.001,label+' laser starts at its physical world muzzle');
     verify(Math.hypot(event.end.x-event.expectedEnd.x,event.end.y-event.expectedEnd.y)<.001,label+' visible laser ends at the world collision');
    }
    verify(before===JSON.stringify({bullets:bullets.length,particles:particles.length,ammo:player.ammo}),label+' painting has no projectile or ammo side effects');
    return events.map(e=>({index:e.index,...e.ray}));
   };
   background(23,36,41);noStroke();textFont('sans-serif');textAlign(CENTER,TOP);
   fill(239,241,217);textSize(25);text('THREE ELEVATIONS / NATIVE AIM LASER',width/2,17);
   fill(160,190,178);textSize(13);text('Real player weapon painters. Low fire reaches the floor at 15 m standing / 20 m crouched / 26 m prone.',width/2,51);
   const cards=[
    ['HEAD / ABOVE PRONE','A lowered target cannot stop a high ray.',()=>{select('HEAD');enemy(170,8,'PRONE');enemy(370,8);}],
    ['BODY / CROUCHED HEAD','The middle elevation resolves a critical head hit.',()=>{select('BODY');enemy(230,8,'CROUCH');}],
    ['LEGS / EMPTY GAP','The ray passes between both legs, then reaches the floor.',()=>{select('LEGS');enemy(170,8);}],
    ['LEGS / ACTUAL SHIN','One thin leg stops the ray before its stance-based floor limit.',()=>{select('LEGS');enemy(170,2);}],
    ['LEGS / LOW COVER','A low wall intercepts the low elevation.',()=>{select('LEGS');buildings=activeBuildings=[{x:170,y:8,w:14,h:90,isLowWall:true,hp:1000}];enemy(230,2);invalidateColIndex();}],
    ['CROUCH / LOW LAUNCH','Even HEAD selection launches below low cover while crouched.',()=>{select('HEAD');resetActorStance(player,'CROUCH');buildings=activeBuildings=[{x:170,y:8,w:14,h:90,isLowWall:true,hp:1000}];enemy(230,8);invalidateColIndex();}],
    ['PRONE / PLANTED AIM','The posed barrel and physical ray agree on the floor.',()=>{select('LEGS');resetActorStance(player,'PRONE');player.stance.proneHeading=-HALF_PI;player.stance.proneAimBlend=1;enemy(220,8,'PRONE');}],
    ['DUAL / INDEPENDENT BARRELS','Each barrel has its own elevation contact and floor limit.',()=>{select('LEGS');player.currentWeapon=WEAPONS.DUAL_SMG;enemy(180,5);enemy(230,-17);}]
   ];
   const records=[];
   for(let index=0;index<cards.length;index++){
    const [title,subtitle,setup]=cards[index],x=12+index%2*1020,y=83+Math.floor(index/2)*272;
    noStroke();fill(17,29,34);rect(x,y,1004,260,9);
    fill(222,235,221);textSize(15);text(title,x+502,y+12);fill(142,174,164);textSize(11);text(subtitle,x+502,y+36);
    clear();setup();
    drawingContext.save();drawingContext.beginPath();drawingContext.rect(x+5,y+58,994,195);drawingContext.clip();
    push();translate(x+77,y+163);scale(1.72);floor();
    for(const solid of activeBuildings){noStroke();fill(87,104,102);rect(solid.x-solid.w/2,solid.y-solid.h/2,solid.w,solid.h,2);fill(149,168,156);rect(solid.x-solid.w/2,solid.y-solid.h/2,solid.w,3,1);}
    const rays=paint(title),expected=['ACTOR','ACTOR','FLOOR','ACTOR','SOLID','SOLID','FLOOR','ACTOR'][index];
    verify(rays.every(ray=>ray.kind===expected),title+' meets the illustrated surface');
    if(index===1)verify(rays[0].zone==='HEAD','body-height crouched hit resolves critical head anatomy');
    if(expected==='FLOOR')verify(rays.every(ray=>Math.abs(ray.distance-legShotRangeForWeapon('LEGS',player.currentWeapon,player))<1e-7),'low ray reaches its exact physical shooter-stance floor');
    records.push({title,rays});pop();drawingContext.restore();
   }
   // Exercise the same native figure under nontrivial outer transforms and
   // visual root scales, including a moving muzzle and lowered stances.
   let transformCases=0;
   for(const stance of ['STAND','CROUCH','PRONE','HIGH COVER','LOW COVER'])for(const weapon of ['PISTOL','ASSAULT_RIFLE','DUAL_SMG'])for(const angle of [0,.7,Math.PI,-Math.PI/2]){
    clear();select('LEGS');player.currentWeapon=WEAPONS[weapon];resetActorStance(player,stance.endsWith('COVER')?'STAND':stance);
    player.aimAngle=angle;player.moveAngle=angle;player.stance.proneHeading=angle-.9;player.stance.proneAimBlend=1;
    player.isMoving=stance==='STAND';player.walkCycle=1.1;player.gait=.9;
    if(stance.endsWith('COVER')){
     player.x=12;player.y=71;
     buildings=activeBuildings=[{x:40,y:0,w:20,h:160,hp:1000,isWall:stance==='HIGH COVER',isLowWall:stance==='LOW COVER'}];
     player.cover={active:true,kind:stance==='HIGH COVER'?'HIGH':'LOW',blend:1,peek:1,pop:stance==='LOW COVER'?.6:0,
      nx:-1,ny:0,tx:0,ty:-1,bodyAngle:Math.PI,aiming:true,openAim:false,validPeek:true,
      offsetX:0,offsetY:21,upper:{x:0,y:21}};invalidateColIndex();
    }
    elevRenderScale=()=>1.18;shovelRenderScale=()=>.87;
    push();translate(-10000,-10000);rotate(.2);scale(.9,1.1);paint(stance+'/'+weapon+'/'+angle);pop();transformCases++;
   }
   elevRenderScale=nativeElev;shovelRenderScale=nativeDepth;drawPlayerAimLaser=nativeLaser;
   return {checks,transformCases,records};
  });
  assert.deepEqual(errors,[],'native laser scene produces no browser errors');
  await page.locator('canvas').first().screenshot({path:path.join(out,'aim-elevations.png')});
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify(result,null,2));
  console.log(`${result.checks}/${result.checks} native laser drawing checks; ${result.transformCases} transformed player poses. Preview: ${path.join(out,'aim-elevations.png')}`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});

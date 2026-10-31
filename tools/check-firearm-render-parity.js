// Exact firearm pixels/state against an explicitly supplied source snapshot.
// FIREARM_BASELINE=work/firearm-render-before.js FIREARM_P5=work/p5-1.11.11.min.js \
//   node tools/check-firearm-render-parity.js
// Tests ordinary and fallback painters; no simulation or timing substitutes.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),crypto=require('crypto');
const deps=process.env.VIS_DEPS||'/workspace/.environment/newone';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const baseline=process.env.FIREARM_BASELINE;
if(!baseline)throw Error('Set FIREARM_BASELINE to the unchanged game.js');
const candidate=process.env.GAME_JS||path.join(__dirname,'..','game.js');
const p5Source=fs.readFileSync(process.env.FIREARM_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const bootstrap=`Object.defineProperty(window,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
let qaSeed=447;Math.random=()=>{qaSeed=(Math.imul(qaSeed,1664525)+1013904223)>>>0;return qaSeed/4294967296;};`;
const fixture=`
window.preload=()=>{};
window.setup=()=>{createCanvas(1024,3072);pixelDensity(1);noLoop();randomSeed(771);noiseSeed(1337);window.__ready=true;};
window.__firearmPaint=(mode)=>{
 currentLevel=currentBiome=2;BIOME_ACTIVE=false;isStoryMode=false;started=doTick=true;
 isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 inOverworldView=false;window.inNM0SecretOverlay=false;buildGhost=null;
 buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 explosiveArmorUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=jetpackUnlocked=false;
 setMeleeTool('NONE');window.waterDepthAt=()=>0;window.elevRenderScale=()=>1;
 zoom=1;camX=camY=0;frameCount=43;worldTimeMs=13/24*DAY_MS;updateSunVector();
 GLRig.on=GLRig.ok=false;viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
 background(86,93,98);player=new Character(-1000,-1000,true);player.hp=10000;
 const inst=p5.instance,renderer=inst._renderer,savedColor=inst.color;let colorCalls=0;
 inst.color=function(){colorCalls++;return savedColor.apply(this,arguments);};
 if(mode==='custom-rgb')colorMode(RGB,100,200,300,17);
 if(mode==='hsb')colorMode(HSB,360,100,100,1);
 if(mode==='ellipse-corner')ellipseMode(CORNER);
 if(mode==='rect-center')rectMode(CENTER);
 if(mode==='accessible'){
  inst._accessibleOutputs={grid:true,text:true};
  // Keep accessibility's exclusion flag real; avoid requiring a DOM text/grid
  // description just to compare the unchanged p5 rendering fallback.
  inst._addAccsOutput=()=>false;inst._accsOutput=()=>{};
 }
 if(mode==='unknown-p5'){p5.VERSION='unverified';_figurePainter=null;}
 const rejected=figurePainter()===null;
 if(mode==='clipping'){push();beginClip();}
 const clippingRejected=mode==='clipping'?figurePainter()===null:null;
 const weapons=['PISTOL','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','REVOLVER','COACH_GUN','ROCKET_LAUNCHER','TASER'];
 const states=[];let n=0;
 for(const weapon of weapons)for(const heading of [.137,1.4,3.1,-1.9])for(let phase=0;phase<3;phase++){
  push();translate(46+(n%12)*84,42+Math.floor(n/12)*82);rotate(heading);
  const L=figureLight(heading),S=figureSouth(heading),el=[-.65,0,.4][phase];
  if(oneHandWeapon(WEAPONS[weapon])||weapon==='TASER')carryHandGun(WEAPONS[weapon],el,L,S,.1-phase*.15,phase*3,phase*.5,phase*.4);
  else carryLongGun(WEAPONS[weapon],el,L,S);
  pop();n++;
 }
 const directColorCalls=colorCalls;
 // Primitive edge states expose transparent-paint and doFill/doStroke guards.
 for(let i=0;i<8;i++){
  push();translate(20+i*120,800);fill(17,81,116,i&4?0:143);stroke(70,19,34,i&4?0:211);strokeWeight(.65);
  if(i&1)noFill();if(i&2)noStroke();
  const paint=figurePainter(),g=paint?paint.api:window;
  g.quad(.13,-3.1,31.2,-7.8,28.9,14.7,-2.7,11.5);g.line(0,22,33,24);g.line(42,23,42,23);pop();
 }
 if(mode==='clipping'){endClip();fill(227,191,62);noStroke();rect(0,0,width,900);pop();}
 if(mode==='rgb'){
  // Reach the shared helpers through the real living-figure pose delegates.
  const poses=['STAND','WALK','RELOAD','FLASH','CROUCH','PRONE','HIGH','LOW','FALL','SEATED','RECOVER'];
  for(const weapon of weapons.slice(0,7))for(const pose of poses)for(let direction=0;direction<2;direction++){
   const index=n++,c=new Character(48+(index%12)*84,46+Math.floor(index/12)*92,true,'NORMAL');
   c.hp=c.maxHp=1000;c.currentWeapon=WEAPONS[weapon];c.ammo=30;c.isArmed=true;c.aimHold=14;
   c.aimAngle=direction?1.283:-.817;c.moveAngle=c.aimAngle+.4;c.walkCycle=1.8;c.gait=.8;
   c.isMoving=pose==='WALK';c.weaponKick=direction*6;c.muzzleFlash=pose==='FLASH'?3:0;c.reloadTimer=pose==='RELOAD'?41:0;
   resetActorStance(c,pose==='CROUCH'||pose==='PRONE'?pose:'STAND');
   if(pose==='WALK'){c.isArmed=false;c.aimHold=0;}
   if(pose==='HIGH'||pose==='LOW'){
    const wall={x:c.x-28,y:c.y,w:20,h:160,isWall:true};
    c.cover={active:true,attached:true,kind:pose,blend:1,pop:0,peek:1,solid:wall,rectIndex:0,
      nx:1,ny:0,tx:0,ty:1,bodyAngle:0,aiming:true,openAim:false,validPeek:true,offsetX:0,offsetY:22,upper:{x:0,y:22}};
   }
   if(pose==='FALL'||pose==='SEATED'||pose==='RECOVER'){
    c.isPlayer=c.isFriendly=c.isNeutral=false;
    legInjurySerial=pose==='SEATED'?1:0;rememberFigureMotion(c,0,-4);
    if(!beginLegInjury(c,{a:-Math.PI/2},direction))throw Error('Injury fixture rejected');
    c.legInjury.phase=pose;c.legInjury.phaseMs=.5*(pose==='FALL'?c.legInjury.fallMs:LEG_INJURY_RECOVER_MS);
    c.legInjury.ageMs=1200+c.legInjury.phaseMs;legInjurySetHeight(c);
   }
   c.show();states.push([weapon,pose,direction,c.hp,c.isArmed,c.hitFlash,c.muzzleFlash,c.reloadTimer,!!c.legInjury]);
  }
  // Graphics art can run between main-canvas guns without borrowing its renderer.
  const buffer=createGraphics(90,90);buffer.pixelDensity(1);buffer.translate(45,45);
  drawFigureHead(buffer,{eType:'NORMAL',skinCol:color(235,180,140)},0,0);image(buffer,910,2880);buffer.remove();
 }
 const px=drawingContext.getImageData(0,0,width,height).data;let raw='';
 for(let i=0;i<px.length;i+=32768)raw+=String.fromCharCode.apply(null,px.subarray(i,i+32768));
 const m=drawingContext.getTransform();
 return {pixels:btoa(raw),directColorCalls,version:p5.VERSION,states,rejected,clippingRejected,
  paint:[renderer._doFill,renderer._doStroke,renderer._fillSet,renderer._strokeSet,drawingContext.fillStyle,
    drawingContext.strokeStyle,drawingContext.lineWidth,drawingContext.globalAlpha,drawingContext.globalCompositeOperation],
  transform:[m.a,m.b,m.c,m.d,m.e,m.f],stack:frameStackDepth(),poses:n};
};`;
async function capture(browser,source,mode){
 const page=await browser.newPage({viewport:{width:1024,height:3072}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.setContent('<!doctype html><script>'+bootstrap+'</script><script>'+p5Source+'</script><script>'+fs.readFileSync(source,'utf8')+'</script><script>'+fixture+'</script>');
  await page.waitForFunction(()=>window.__ready);
  const result=await page.evaluate(mode=>window.__firearmPaint(mode),mode);
  assert.deepEqual(errors,[],'Browser frame errors');return result;
 }finally{await page.close();}
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
 let checks=0;
 try{for(const mode of ['rgb','custom-rgb','hsb','ellipse-corner','rect-center','accessible','clipping','unknown-p5']){
  const before=await capture(browser,baseline,mode),after=await capture(browser,candidate,mode);
  const a=Buffer.from(before.pixels,'base64'),b=Buffer.from(after.pixels,'base64');
  let changed=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])changed++;
  assert.equal(changed,0,mode+' pixel channels changed');
  const oldColors=before.directColorCalls,newColors=after.directColorCalls;
  delete before.pixels;delete after.pixels;delete before.directColorCalls;delete after.directColorCalls;
  assert.deepEqual(after,before,mode+' painter/gameplay state changed');
  if(mode==='rgb')assert.ok(newColors<oldColors*.25,'Ordinary firearms should avoid at least 75% of p5.Color parsing');
  if(mode==='accessible'||mode==='ellipse-corner')assert.equal(after.rejected,true,mode+' must retain p5 fallback');
  if(mode==='clipping')assert.equal(after.clippingRejected,true,'Clipping must retain p5 fallback');
  console.log('PASS '+after.version+' '+mode+': '+after.poses+' poses; p5.Color '+oldColors+' -> '+newColors+'; sha256 '+crypto.createHash('sha256').update(a).digest('hex'));checks++;
 }}finally{await browser.close();}
 console.log(checks+' exact firearm pixel/state comparisons passed');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

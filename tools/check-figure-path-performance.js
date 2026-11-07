// Direct Canvas cel paths must retain p5's exact pixels, including its two
// closing vertices. Cover dense lowered figures, transforms and Graphics.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const p5Source=fs.readFileSync(process.env.FIGURE_PATH_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const gameSource=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const fixture=`window.preload=()=>{};window.setup=()=>{createCanvas(1024,1792);pixelDensity(1);noLoop();window.ready=true;};
window.comparePaths=()=>{
const original=figureCelContext;let nativeCalls=0,seed=711;
Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function paint(native){
 seed=711;randomSeed(711);noiseSeed(1337);
 figureCelContext=native?g=>{const dc=original(g);if(dc)nativeCalls++;return dc;}:()=>null;
 resetMatrix();background(81,91,97);strokeCap(ROUND);strokeJoin(ROUND);
 currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
 isPaused=isDead=isWin=killcamMode=false;inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 window.inNM0SecretOverlay=false;buildGhost=null;buildings=activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0};setMeleeTool('NONE');
 explosiveArmorUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=jetpackUnlocked=false;
 worldTimeMs=13/24*DAY_MS;updateSunVector();frameCount=43;
 window.elevRenderScale=()=>1;
 const painter=figurePainter(),g=painter?painter.api:window,states=[];
 // Curved contours at fractional coordinates, small and collapsed bones,
 // mirrored transforms, nonuniform scales and translucent materials.
 for(let i=0;i<96;i++){
  const x=48+(i%16)*64,y=36+Math.floor(i/16)*62;
  push();translate(x+.173,y+.391);rotate(i*.373);scale(i%3===0?-.87:1.17,.8+(i%4)*.13);
  const sx=-13.17,sy=-4.09,ex=i%9===0?sx:3.31,ey=i%7===0?sy:8.7,
    hx=i%11===0?ex:17.29,hy=i%13===0?ey:-3.25,c=[55+i,87+i*.4,133-i*.5,i%3===0?153.7:255];
  figureCelLimb(g,sx,sy,ex,ey,hx,hy,7.3,6.7,5.1,c);
  figureCelOval(g,2.73,-13.31,11.3,8.97,c,.67);pop();
 }
 // Standing peeks, crouch/prone transitions and weapon/support articulation
 // call the same paths repeatedly in one dense rendered scene.
 const weapons=['PISTOL','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','BOW','REVOLVER','COACH_GUN','TASER'];
 for(let i=0;i<96;i++){
  const c=new Character(64+(i%8)*128,458+Math.floor(i/8)*106,i%5===0,i%3===0?'NM0_ROOKIE_F':'NORMAL');
  player=c;c.isArmed=true;c.currentWeapon=WEAPONS[weapons[i%weapons.length]];c.aimAngle=i*.39;c.moveAngle=c.aimAngle-.8;
  c.isMoving=!!(i%2);c.walkCycle=i*.247;c.gait=(i%5)/4;c.reloadTimer=i%11===0?41:0;
  c.muzzleFlash=i%13===0?2:0;c.hitFlash=i%17===0?3:0;c.weaponKick=i%4;c.ammo=30;
  resetActorStance(c);c.stance.value=(i%9)*.25;c.stance.from=c.stance.to=c.stance.value;
  if(i%3===0)c.cover={active:true,kind:i%2?'HIGH':'LOW',blend:.75,pop:.3,peek:.8,
    aiming:!!(i%2),validPeek:true,openAim:false,bodyAngle:c.aimAngle+.4,
    nx:-1,ny:0,upper:{x:3,y:-11},offsetX:3,offsetY:-11};
  c.show();states.push([c.hitFlash,c.isArmed,c.decals]);
 }
 const pg=createGraphics(224,128);pg.pixelDensity(1);pg.background(38,44,52);
 pg.translate(97.3,61.7);pg.rotate(.731);pg.scale(1.3,.81);
 figureCelLimb(pg,-32,-9,-4,14,37,-11,19,14,9,[173,71,112,201]);
 figureCelOval(pg,8,-19,37,23,[101,157,89],.85);
 image(pg,20,1630);pg.remove();
 const pixels=drawingContext.getImageData(0,0,width,height).data;
 return {pixels,state:JSON.stringify([states,p5.instance._renderer._doFill,p5.instance._renderer._doStroke,
  drawingContext.fillStyle,drawingContext.strokeStyle,drawingContext.lineWidth,frameStackDepth()])};
}
const reference=paint(false),candidate=paint(true);figureCelContext=original;
let changed=0;for(let i=0;i<reference.pixels.length;i++)if(reference.pixels[i]!==candidate.pixels[i])changed++;
return {version:p5.VERSION,changed,stateEqual:reference.state===candidate.state,nativeCalls};};`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1024,height:1792}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.setContent('<!doctype html><script>Object.defineProperty(window,"localStorage",{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});</script><script>'+p5Source+'</script><script>'+gameSource+'</script><script>'+fixture+'</script>');
  await page.waitForFunction(()=>window.ready);
  const result=await page.evaluate(()=>window.comparePaths());
  assert.equal(errors.length,0,errors.join('\n'));assert.equal(result.changed,0,'native cel paths preserve every pixel');
  assert.equal(result.stateEqual,true,'native cel paths preserve painter/gameplay state');
  assert.ok(result.nativeCalls>500,'dense scene exercises the native path');
  console.log('PASS '+JSON.stringify(result)+'; 96 primitive cells, 96 lowered/cover figures and Graphics match p5 exactly.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

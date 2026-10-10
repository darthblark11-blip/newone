// Exact Canvas pixel and painter-state comparison across live character poses.
// VIS_DEPS=/workspace/onboarding-newone VIS_CHROME=/usr/bin/chromium \
//   CHARACTER_BASELINE=/tmp/game-before.js node tools/check-character-render-parity.js
// The baseline is supplied explicitly so this check also works for later edits.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const deps = process.env.VIS_DEPS || '/workspace/onboarding-newone';
const { chromium } = require(path.join(deps, 'node_modules/playwright'));
const p5Source = fs.readFileSync(process.env.CHARACTER_P5||path.join(deps, 'node_modules/p5/lib/p5.min.js'), 'utf8');
const baseline = process.env.CHARACTER_BASELINE;
if (!baseline) throw Error('Set CHARACTER_BASELINE to the unchanged game.js');
const candidate = process.env.GAME_JS || path.join(__dirname, '..', 'game.js');
const bootstrap = `Object.defineProperty(window,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
let __seed=447;Math.random=()=>{__seed=(Math.imul(__seed,1664525)+1013904223)>>>0;return __seed/4294967296;};`;
const fixture = `window.preload=()=>{};window.setup=()=>{createCanvas(1024,2560);pixelDensity(1);noLoop();
randomSeed(771);noiseSeed(1337);leftStick={active:false};rightStick={active:false};window.__ready=true;};
window.__paint=(biome,quality)=>{
currentLevel=1;currentBiome=1;BIOME_ACTIVE=biome;zoom=.75;camX=0;camY=0;
worldTimeMs=13/24*DAY_MS;updateSunVector();GLRig.on=quality;GLRig.ok=quality;
GLRig.failure=quality?'':GLRIG_SHED_MSG;window.glRigOwnsSunShadows=()=>quality&&BIOME_ACTIVE;frameCount=43;
window.waterDepthAt=(x,y)=>x%256<128?.62:0;window.elevRenderScale=(x,y)=>x%256<128?1.1:1;
explosiveArmorUnlocked=false;chemistSuitUnlocked=false;ninjaSuitUnlocked=false;jetpackUnlocked=false;
background(86,93,98);const actors=[],result=[];
const types=['NORMAL','ARMORED_STANDARD','NM0_ROOKIE','NM0_ROOKIE_F','FEMALE_PISTOL','ROBOT',
'ARMORED','AERIAL','AERIAL_PISTOL','COW','ALIEN_GATOR','BANDIT'];
for(let state=0;state<6;state++)for(let direction=0;direction<2;direction++)for(let ti=0;ti<types.length;ti++){
  const k=actors.length,c=new Character(64+(k%8)*128,64+Math.floor(k/8)*128,false,types[ti]);
  c.aimAngle=direction?1.283:-.817;c.moveAngle=c.aimAngle+.4;c.isMoving=state!==0;
  c.walkCycle=.43+state*.87;c.gait=state/5;c.hitFlash=state===2?4:0;
  c.reloadTimer=state===4?41:0;c.muzzleFlash=state===5?2:0;c.isCharred=state===3;
  c.decals=state===3?[{x:2,y:4,sz:4,col:[90,0,0,220]},
    {x:-2,y:-1,sz:3,isHead:true,col:[90,0,0,220]}]:[];
  c.chargeTimer=state===4?ROBOT_CHARGE*.5:0;c.orbChargeTimer=state===4?45:0;
  c.enraged=state===3;c.isArmed=true;actors.push(c);
}
for(const c of actors){c.show();result.push([c.hitFlash,c.isArmed,c.decals]);}
// A player exercising carry, empty hands, punch, the three suit branches and
// mutable color/body dimensions uses the same painter as the combat crowd.
for(let i=0;i<16;i++){
const c=new Character(64+(i%8)*128,64+(18+Math.floor(i/8))*128,true,'NORMAL');
c.x=64+(i%8)*128;c.y=64+(18+Math.floor(i/8))*128;c.aimAngle=i*.31;c.moveAngle=i*.31+.5;
c.isMoving=!!(i%2);c.walkCycle=.77;c.gait=.82;c.aimHold=0;c.isArmed=i>1;c.meleeTimer=i===1?8:0;
c.boxingHold=10;c.currentWeapon=i%3===0?WEAPONS.ASSAULT_RIFLE:WEAPONS.SMG;
explosiveArmorUnlocked=i===4;chemistSuitUnlocked=i===5;ninjaSuitUnlocked=i===6;
if(i===8){c.bodyW=24;c.bodyH=31;c.shirtCol=color(47,93,129);c.pantsCol=color(80,91,56);}
c.show();result.push([c.hitFlash,c.isArmed,c.decals]);
if(i===8){c.shirtCol.setRed(198);c.pantsCol.setAlpha(142);c.bodyW=29;c.bodyH=33;c.x+=31;c.y+=12;c.show();}
}
const px=drawingContext.getImageData(0,0,width,height).data;let raw='';
for(let j=0;j<px.length;j+=32768)raw+=String.fromCharCode.apply(null,px.subarray(j,j+32768));
return {pixels:btoa(raw),state:result,
styles:frameStackDepth(),paint:[p5.instance._renderer._doFill,p5.instance._renderer._doStroke,
drawingContext.fillStyle,drawingContext.strokeStyle,drawingContext.lineWidth]};};`;
async function capture(browser, source, biome, quality) {
  const page = await browser.newPage({viewport:{width:1024,height:2560}});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.setContent('<!doctype html><script>'+bootstrap+'</script><script>'+p5Source+
    '</script><script>'+fs.readFileSync(source,'utf8')+'</script><script>'+fixture+'</script>');
  await page.waitForFunction(()=>window.__ready);
  const result=await page.evaluate(([biome,quality])=>window.__paint(biome,quality),[biome,quality]);
  if(errors.length)throw Error(errors.join('\n'));
  await page.close();return result;
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
  let checks=0;
  try{for(const [biome,quality] of [[false,false],[true,false],[true,true]]){
    const a=await capture(browser,baseline,biome,quality),b=await capture(browser,candidate,biome,quality);
    const ap=Buffer.from(a.pixels,'base64'),bp=Buffer.from(b.pixels,'base64');let changed=0;
    for(let i=0;i<ap.length;i++)if(ap[i]!==bp[i])changed++;
    if(changed)throw Error('Character pixels differ: '+changed+' channels (biome='+biome+', rig='+quality+')');
    delete a.pixels;delete b.pixels;
    if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Painter state differs');
    console.log('PASS 160 poses, biome='+biome+', rig='+quality+', sha256='+crypto.createHash('sha256').update(ap).digest('hex'));checks++;
  }}finally{await browser.close();}
  console.log(checks+' exact pixel/state comparisons passed');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

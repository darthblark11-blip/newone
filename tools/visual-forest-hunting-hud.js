// Real Canvas/p5 confirmation of objective opacity and marker-only expiry.
const fs=require('fs'),path=require('path'),assert=require('assert');
const deps=process.env.VIS_DEPS||'/workspace/onboarding-newone';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(path.join(__dirname,'..','game.js'),'utf8');
const p5=fs.readFileSync(process.env.VIS_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.HUNT_HUD_OUT||'/tmp/newone-hunting-hud';fs.mkdirSync(out,{recursive:true});
const fixture=`
window.preload=function(){};
window.setup=function(){createCanvas(1460,675);pixelDensity(1);noLoop();
 leftStick={base:{x:80,y:515},active:false};rightStick={base:{x:1380,y:565},active:false};
 started=true;isPaused=false;isDead=false;isWin=false;killcamMode=false;
 inCutscene=false;inTownCutscene=false;inFortCutscene=false;inPostAmbushCutscene=false;
 inFarmCutscene=false;inFarmPostCutscene=false;inWorldBuildingMenu=false;inOverworldView=false;
 inTravelMenu=false;inStoryIntro=false;inDarchonCall=false;doTick=true;currentLevel=2;BIOME_ACTIVE=true;
 forestWildlife.length=0;player={x:0,y:0,flags:{},weaponAmmo:{BOW:0},mags:{BOW:0}};
 resetForestHuntingActivity();forestHuntingQuest.site={x:3000,y:5040,r:235,stewardX:3000,stewardY:5095};
 tickForestHuntingSupply(0);updateForestHuntingActivity(false);
 window.__ready=true;
};
window.draw=function(){};
window.windowResized=function(){};
window.__paintHuntHud=function(){
 resetMatrix();background(11,19,14);const records={rects:[],texts:[],triangles:0};
 const oldRect=window.rect,oldText=window.text,oldTriangle=window.triangle;
 window.rect=function(...a){records.rects.push(a);return oldRect(...a);};
 window.text=function(...a){records.texts.push(a);return oldText(...a);};
 window.triangle=function(...a){records.triangles++;return oldTriangle(...a);};
 try{drawForestHuntingHud();}finally{window.rect=oldRect;window.text=oldText;window.triangle=oldTriangle;}
 const card=forestHuntingObjectiveCard(),pixel=Array.from(drawingContext.getImageData(Math.floor(card.x+8),card.y+8,1,1).data);
 const a=Math.atan2(forestHuntingQuest.site.y-player.y,forestHuntingQuest.site.x-player.x),ex=Math.cos(a),ey=Math.sin(a);
 const reach=Math.min((width/2-24)/Math.max(.001,Math.abs(ex)),(height/2-Math.min(140,height*.30))/Math.max(.001,Math.abs(ey)));
 const ax=width/2+ex*Math.max(20,reach),ay=height/2+ey*Math.max(20,reach);
 const markerPixel=Array.from(drawingContext.getImageData(Math.floor(ax),Math.floor(ay),1,1).data);
 return {age:_forestHuntingObjectiveAgeMs,opacity:forestHuntingNoticeOpacity(_forestHuntingObjectiveAgeMs),card,pixel,markerPixel,...records};
};
window.__stepHud=function(ms){deltaTime=ms;frameCount++;updateForestHuntingActivity();return window.__paintHuntHud();};
`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1460,height:675}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<!doctype html><style>body{margin:0;background:#0b130e}</style><script>'+p5+'</script><script>'+source+'</script><script>'+fixture+'</script>',{waitUntil:'load'});
  await page.waitForFunction(()=>window.__ready);
  const initial=await page.evaluate(()=>window.__paintHuntHud());assert.equal(initial.rects.length,0);assert.equal(initial.triangles,1);
  const half=await page.evaluate(()=>{window.__stepHud(100);return window.__stepHud(75);});assert.equal(half.opacity,.5);
  await page.screenshot({path:path.join(out,'landscape-fade-in.png')});
  const full=await page.evaluate(()=>{window.__stepHud(100);return window.__stepHud(75);});assert.equal(full.opacity,1);
  assert.ok(full.pixel[1]>half.pixel[1]&&half.pixel[1]>initial.pixel[1],'Canvas pixels confirm gradual opacity');
  await page.screenshot({path:path.join(out,'landscape-announcement.png')});
  const fadeOut=await page.evaluate(()=>{for(let i=0;i<39;i++)window.__stepHud(100);return window.__paintHuntHud();});assert.equal(fadeOut.opacity,.5);
  const expired=await page.evaluate(()=>{for(let i=0;i<4;i++)window.__stepHud(100);return window.__paintHuntHud();});
  assert.equal(expired.opacity,0);assert.equal(expired.rects.length,0);assert.equal(expired.texts.length,0);assert.equal(expired.triangles,1);
  assert.deepEqual(expired.pixel,initial.pixel);
  assert.ok(expired.markerPixel[1]>150,'The persistent marker still paints real green pixels');
  await page.screenshot({path:path.join(out,'landscape-marker-only.png')});
  const stepChanged=await page.evaluate(()=>{forestHuntingQuest.stage='HUNT';window.__paintHuntHud();return window.__stepHud(100);});
  assert.equal(stepChanged.age,100);assert.ok(stepChanged.texts.some(t=>String(t[0]).includes('ARROW HEADSHOT')));
  const layouts=[];
  for(const [w,h] of [[734,375],[568,320],[375,812],[320,568]]){
   await page.setViewportSize({width:w,height:h});
   const painted=await page.evaluate(([w,h])=>{resizeCanvas(w,h);_forestHuntingObjectiveAgeMs=350;return window.__paintHuntHud();},[w,h]);
   assert.equal(painted.rects.length,1);assert.equal(painted.triangles,1);
   assert.ok(painted.card.x>=12&&painted.card.x+painted.card.w<=w-12&&painted.card.y+painted.card.h<h/2);
   layouts.push({w,h,...painted});await page.screenshot({path:path.join(out,'notice-'+w+'x'+h+'.png')});
  }
  assert.deepEqual(errors,[]);
  const report={p5:await page.evaluate(()=>window.p5.VERSION),initial,half,full,fadeOut,expired,stepChanged,layouts,errors};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log('Hunting HUD browser: real fade pixels, marker-only expiry, step update and four responsive layouts passed (p5 '+report.p5+').');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

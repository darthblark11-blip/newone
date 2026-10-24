// Native Canvas review of the escalating personal-combo materials and effects.
// No replacement glyphs: every sample calls the real drawComboHud().
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.COMBO_PROGRESSION_OUT||'/tmp/newone-combo-progression';
const frames=path.join(out,'frames');fs.mkdirSync(frames,{recursive:true});
const fps=30,totalFrames=Number(process.env.COMBO_PROGRESSION_FRAMES||120);
const stages=[
 {n:40,label:'40 / VIOLET'}, {n:45,label:'45 / BLOOD ENTERS'},
 {n:50,label:'50 / BLEEDING'}, {n:53,label:'53 / BLACK EDGES, WHITE CORE'},
 {n:55,label:'55 / MONOCHROME'}, {n:58,label:'58 / SPLIT FORMS'},
 {n:60,label:'60 / WHITE LEFT, BLACK RIGHT'}, {n:65,label:'65 / STONE FORMS'},
 {n:69,label:'69 / SOLID ROCK'}, {n:70,label:'70 / SOUL IGNITION',burst:70},
 {n:75,label:'75 / YELLOW-GREEN SOUL'}, {n:79,label:'79 / NEON GREEN'},
 {n:80,label:'80 / SECOND BURST',burst:80}, {n:85,label:'85 / INDIGO FLAME'},
 {n:90,label:'90 / INDIGO'}, {n:95,label:'95 / PEARLESCENT'},
 {n:100,label:'100 / PEARL'}, {n:105,label:'105 / RAINBOW STARS'},
 {n:120,label:'120 / RAINBOW STARS',time:2100}, {n:200,label:'200 / COUNT CONTINUES',time:2700}
];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1120},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(1600,1120);pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('__ready');
  assert(await page.evaluate(async()=>{await initComboHudFont();return comboHudFontReady;}),'bundled font loads');
  await page.evaluate(()=>{
   started=true;doTick=false;isPaused=isDead=isWin=killcamMode=false;currentLevel=1;
   player=null;nm0AmbushActive=farmAmbushActive=false;resetComboHudFade();
   window.__comboVisualStack={depth:0,minDepth:0};
   const nativePush=window.push,nativePop=window.pop;
   window.push=function(...args){__comboVisualStack.depth++;return nativePush(...args);};
   window.pop=function(...args){__comboVisualStack.depth--;__comboVisualStack.minDepth=Math.min(__comboVisualStack.minDepth,__comboVisualStack.depth);return nativePop(...args);};
   window.__comboMaterialSample=(sample,x,y,scaleFactor=1,time=sample.time||1200)=>{
    consecutiveKills=sample.n;comboTimer=100;frameCount++;
    Object.assign(comboHudFade,{visibility:1,kills:sample.n,timer:100,frame:frameCount,
     clockMs:time,burst70:sample.burst===70?(Number.isFinite(sample.burstAt)?sample.burstAt:time-140):-1,
     burst80:sample.burst===80?(Number.isFinite(sample.burstAt)?sample.burstAt:time-140):-1});
    const position=combatHudLayout().combo;
    push();translate(x,y);scale(scaleFactor);translate(-position.x,-position.y);drawComboHud();pop();
    return {n:sample.n,style:comboHudStyle(sample.n,time),timer:comboTimer,stack:{...__comboVisualStack}};
   };
   window.__comboVisualTitle=(title,subtitle)=>{
    background(20,39,43);noStroke();textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);
    fill(228,240,232);textSize(21);text(title,width/2,18);
    fill(154,183,177);textSize(12);text(subtitle,width/2,49);
   };
  });
  const samples=await page.evaluate(stages=>{
   __comboVisualTitle('PERSONAL COMBO / NATIVE MATERIAL PROGRESSION','Actual 18px HUD above; the same renderer at 3× below. Fixed presentation time, full countdown.');
   const records=[];
   for(let i=0;i<stages.length;i++){
    const sample=stages[i],x=200+(i%4)*400,y=92+Math.floor(i/4)*202;
    noStroke();fill(13,27,31);rect(x-190,y,380,188,10);
    textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(11);fill(181,209,201);text(sample.label,x,y+12);
    const native=__comboMaterialSample(sample,x,y+42,1);
    __comboMaterialSample(sample,x,y+98,2.6);
    const image=drawingContext.getImageData(Math.round(x-94),Math.round(y+32),188,50).data;
    let painted=0,minX=188,maxX=-1,minY=50,maxY=-1;
    const glyphHues=new Set();
    for(let yy=0;yy<50;yy++)for(let xx=0;xx<188;xx++){
     const j=(yy*188+xx)*4;
     if(Math.abs(image[j]-13)+Math.abs(image[j+1]-27)+Math.abs(image[j+2]-31)>12){
      painted++;minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);minY=Math.min(minY,yy);maxY=Math.max(maxY,yy);
      if(yy>=12&&yy<30){
       const r=image[j],g=image[j+1],b=image[j+2],high=Math.max(r,g,b),low=Math.min(r,g,b),range=high-low;
       if(high>110&&range>12){
        const hue=(high===r?((g-b)/range+6)%6:high===g?(b-r)/range+2:(r-g)/range+4)*60;
        glyphHues.add(Math.floor(hue/60)%6);
       }
      }
     }
    }
    records.push({...native,painted,glyphHueBuckets:[...glyphHues],bounds:{minX,maxX,minY,maxY}});
   }
   return records;
  },stages);
  for(const r of samples){assert(r.painted>100,'native material remains visible at '+r.n);assert.equal(r.timer,100);assert.equal(r.stack.depth,0);assert.equal(r.stack.minDepth,0);}
  assert(samples.find(r=>r.n===100).glyphHueBuckets.length>=3,'pearlescent sheen spans multiple colors within the actual glyphs');
  assert(samples.find(r=>r.n===105).glyphHueBuckets.length>=4,'rainbow gradient spans multiple hues within the actual glyphs');
  await page.locator('canvas').first().screenshot({path:path.join(out,'combo-progression.png')});
  const phone=await page.evaluate(()=>{
   resizeCanvas(960,820);__comboVisualTitle('PHONE HUD / STAGED COMBOS','Native 320px canvas layout with health, ammo and objective lanes.');
   const records=[];
   for(let i=0;i<3;i++){
    const ox=i*320,originalWidth=width;push();translate(ox,100);
    // Layout uses the phone width; the existing main canvas still owns drawing.
    width=320;fill(27,38,36);noStroke();rect(0,0,320,700);
    fill(55);rect(20,20,200,20,5);fill(218,42,47);rect(20,20,170,20,5);
    fill(42,163,206);rect(20,48,160,8,4);fill(233,78,175);rect(20,65,200,5,3);
    textFont('sans-serif');textSize(10);textStyle(NORMAL);textAlign(LEFT,TOP);fill(211);text('17 / 4',48,112);
    const n=[50,75,105][i],position=combatHudLayout().combo;
    records.push(__comboMaterialSample({n},position.x,position.y,1,1800));
    drawStoryObjectiveBanner('Find a way past the south Great Gate.',210);
    width=originalWidth;pop();
   }
   return records;
  });
  await page.setViewportSize({width:960,height:820});
  await page.locator('canvas').first().screenshot({path:path.join(out,'combo-phone-lanes.png')});
  await page.setViewportSize({width:1200,height:820});
  let motion=[];
  for(let f=0;f<totalFrames;f++){
   motion=await page.evaluate(({f,fps})=>{
    resizeCanvas(1200,820);__comboVisualTitle('PERSONAL COMBO / LIVE MATERIALS','Native animation: blood, soul ignition, indigo, pearl and rainbow star cadence.');
    const records=[],samples=[{n:50,label:'50 / BLEED'},{n:70,label:'70 / SOUL BURST',burst:70},
     {n:80,label:'80 / NEON BURST',burst:80},{n:85,label:'85 / INDIGO'},
     {n:98,label:'98 / PEARL'},{n:120,label:'120 / RAINBOW'}];
    for(let i=0;i<samples.length;i++){
     const sample=samples[i],x=200+(i%3)*400,y=160+Math.floor(i/3)*330;
     fill(13,27,31);noStroke();rect(x-190,y-50,380,285,12);
     textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(13);fill(182,211,202);text(sample.label,x,y-30);
     const ms=1000+f*1000/fps;
     sample.time=ms;sample.burstAt=1000;
     // One ignition at movie start, then let its finite burst decay naturally.
     const native=__comboMaterialSample(sample,x,y+25,1,ms);
     const position=combatHudLayout().combo;
     push();translate(x,y+110);scale(2.8);translate(-position.x,-position.y);drawComboHud();pop();
     records.push(native);
    }
    return records;
   },{f,fps});
   for(const r of motion){assert.equal(r.stack.depth,0);assert.equal(r.stack.minDepth,0);}
   await page.locator('canvas').first().screenshot({path:path.join(frames,String(f).padStart(4,'0')+'.png')});
  }
  assert.deepEqual(errors,[],'native Canvas reports no page errors');
  if(totalFrames){
   const encoded=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(frames,'%04d.png'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-movflags','+faststart',path.join(out,'combo-progression.mp4')],{encoding:'utf8'});
   if(encoded.error)throw encoded.error;assert.equal(encoded.status,0,encoded.stderr);
  }
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({samples,phone,motion,errors,fps,totalFrames},null,2));
  console.log(`${samples.length} native combo stages, ${phone.length} phone layouts and ${totalFrames} motion frames passed. Previews: ${out}`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});

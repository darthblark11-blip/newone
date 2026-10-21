// Real p5 HUD snapshots and text positions at desktop and narrow phone sizes.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.COMBO_HUD_OUT||'/tmp/newone-combo-hud';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
for(const [name,w,h]of [['desktop',1280,720],['phone',320,700]]){
 const page=await browser.newPage({viewport:{width:w,height:h}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>body{margin:0}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};setup=function(){createCanvas('+w+','+h+');pixelDensity(1);noLoop();window.__ready=true;};</script>');
 await page.waitForFunction('__ready');
 const result=await page.evaluate(()=>{
  isStoryMode=true;townsData={};startAtLevel(1);started=true;doTick=false;isPaused=false;isDead=false;isWin=false;
  leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
  nm0AmbushActive=false;farmAmbushActive=false;killcamMode=false;consecutiveKills=40;comboTimer=120;
  player.hp=85;player.shield=60;score=5400;floatingScores=[];worldTimeMs=14/24*DAY_MS;
  background(27,38,36);stroke(37,51,47);strokeWeight(1);
  for(let x=0;x<width;x+=48)line(x,0,x,height);
  for(let y=0;y<height;y+=48)line(0,y,width,y);
  const records=[],paintText=window.text;
  window.text=function(s,...args){records.push({s:String(s),args,fill:drawingContext.fillStyle,size:window._renderer._textSize});return paintText(s,...args);};
  drawUI();
  drawStoryObjectiveBanner('Find a way past\nthe south "Great Gate"!',225);
  window.text=paintText;
  const r=window.random;window.random=()=>{throw Error('combo used random jitter');};
  try{drawComboHud();drawComboHud();}finally{window.random=r;}
  const layout=combatHudLayout(),combo=records.find(t=>t.s==='x40 COMBO');
  return {layout,combo,objective:records.filter(t=>t.s.includes('Find a way')||t.s.includes('Great Gate')),
    color:comboHudColor(consecutiveKills),timer:comboTimer};
 });
 assert.deepEqual(errors,[],'no Canvas errors');assert(result.combo,'combo is painted by drawUI');
 assert.equal(result.combo.args[0],result.layout.combo.x);assert.equal(result.combo.args[1],result.layout.combo.y);
 assert.deepEqual(result.color,[143,60,255]);assert.equal(result.timer,120,'drawing leaves countdown alone');
 assert(result.objective.length>=2,'objective preserves explicit line breaks');
 assert(result.objective.every(t=>t.args[1]>=result.layout.objective.y&&t.args[1]<h/2),'objective stays near the top');
 await page.locator('canvas').first().screenshot({path:path.join(out,name+'.png')});
 fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(result,null,2));await page.close();
}
console.log('Combo/objective Canvas checks passed at 1280 px and 320 px. Screenshots: '+out);
}finally{await browser.close()}})().catch(e=>{console.error(e.stack||e);process.exit(1)});

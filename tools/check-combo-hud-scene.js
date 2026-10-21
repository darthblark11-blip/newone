// Real p5 HUD snapshots and text positions at desktop and narrow phone sizes.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.COMBO_HUD_OUT||'/tmp/newone-combo-hud';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
const cases=[
 {name:'desktop',w:1280,h:720,level:4,weapon:'PISTOL'},
 {name:'phone',w:320,h:700,level:4,weapon:'PISTOL'},
 {name:'phone393',w:393,h:800,level:4,weapon:'PISTOL'},
 {name:'phone375-ambush-bow',w:375,h:800,level:4,weapon:'BOW',ambush:true},
 {name:'phone412-ambush-taser',w:412,h:800,level:4,weapon:'TASER',ambush:true,reload:true},
 {name:'phone320-reloading',w:320,h:700,level:4,weapon:'ASSAULT_RIFLE',reload:true},
 {name:'phone320-hq',w:320,h:700,level:8,weapon:'PISTOL'},
 {name:'phone393-farm-bow',w:393,h:800,level:3,weapon:'BOW',farm:true}
];
for(const fixture of cases){
 const {name,w,h}=fixture;
 const page=await browser.newPage({viewport:{width:w,height:h}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<style>body{margin:0}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};setup=function(){createCanvas('+w+','+h+');pixelDensity(1);noLoop();window.__ready=true;};</script>');
 await page.waitForFunction('__ready');
 const fontReady=await page.evaluate(async()=>{await initComboHudFont();return comboHudFontReady&&document.fonts.check('18px "'+COMBO_HUD_FONT_FAMILY+'"');});
 assert(fontReady,'embedded pop font loads without external assets');
 const result=await page.evaluate(c=>{
  isStoryMode=true;townsData={};startAtLevel(c.level);started=true;doTick=false;isPaused=false;isDead=false;isWin=false;
  leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
  nm0AmbushActive=!!c.ambush;farmAmbushActive=!!c.farm;killcamMode=false;consecutiveKills=40;comboTimer=120;
  window.ambushKillsTotal=300;nm0AmbushKills=180;window.farmAmbushKills=320;enemiesList=[];
  player.currentWeapon=WEAPONS[c.weapon];player.ammo=17;player.mags[player.currentWeapon.name]=4;player.reloadTimer=c.reload?80:0;
  player.hp=85;player.shield=60;score=5400;floatingScores=[];worldTimeMs=14/24*DAY_MS;
  background(27,38,36);stroke(37,51,47);strokeWeight(1);
  for(let x=0;x<width;x+=48)line(x,0,x,height);
  for(let y=0;y<height;y+=48)line(0,y,width,y);
  const records=[],paintText=window.text;
  window.text=function(s,...args){records.push({s:String(s),args,fill:drawingContext.fillStyle,size:window._renderer._textSize,font:drawingContext.font,actualW:textWidth(String(s))});return paintText(s,...args);};
  drawUI();
  const objectiveStart=records.length;
  drawStoryObjectiveBanner(c.ambush?'Defeat the Grey Fatigue Ambush!':c.farm?'Wipe out the pest infestation!':'Make contact with\nthe Tan Army cordon.',225);
  window.text=paintText;
  const r=window.random;window.random=()=>{throw Error('combo used random jitter');};
  try{drawComboHud();drawComboHud();}finally{window.random=r;}
  const layout=combatHudLayout(),combo=records.find(t=>t.s==='x40 COMBO');
  return {layout,combo,ammo:records.find(t=>t.args[0]===layout.ammo.textX&&t.args[1]===layout.ammo.textY),
    objective:records.slice(objectiveStart),status:records.filter(t=>/^(STICK ARMY OUTPOST|NM-0 AMBUSH FORCES|NM-0 HQ ENEMIES|PEST INFESTATION)/.test(t.s)),
    color:comboHudColor(consecutiveKills),timer:comboTimer};
 },fixture);
 assert.deepEqual(errors,[],'no Canvas errors');assert(result.combo,'combo is painted by drawUI');
 assert.equal(result.combo.args[0],result.layout.combo.x);assert.equal(result.combo.args[1],result.layout.combo.y);
 assert.deepEqual(result.color,[143,60,255]);assert.equal(result.timer,120,'drawing leaves countdown alone');
 assert(result.combo.font.includes('UrbanComboPop'),'combo uses the loaded pop font');
 assert(result.ammo,'ammo label is drawn in the compact ammo lane');
 assert(result.ammo.size<=(w<560?11:12),'ammo uses small text');
 assert(result.ammo.actualW<=result.layout.ammo.maxTextW+.1,'ammo text fits its lane');
 if(w<560)assert.equal(result.combo.args[1],82,'phone combo is raised to the top combat strip');
 if(!fixture.ambush&&!fixture.farm)assert(result.objective.length>=2,'objective preserves explicit line breaks');
 for(const row of result.status)assert(row.args[1]>=128||w>=560,'phone status rows remain below ammo and combo');
 assert(result.objective.every(t=>t.args[1]>=result.layout.objective.y&&t.args[1]<h/2),'objective stays near the top');
 await page.locator('canvas').first().screenshot({path:path.join(out,name+'.png')});
 fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(result,null,2));await page.close();
}
console.log('Compact combo/ammo/status Canvas checks passed across eight desktop and phone cases. Screenshots: '+out);
}finally{await browser.close()}})().catch(e=>{console.error(e.stack||e);process.exit(1)});

// Real p5/Character poses: both wrists contact the grip/string, and a released
// arrow starts at its posed tip throughout a draw, while standing or running.
const fs=require('fs'),path=require('path'),assert=require('assert');
const deps=process.env.VIS_DEPS||'/workspace/onboarding-newone';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'..','game.js'),'utf8');
const p5file=process.env.VIS_P5||'/tmp/p5-1.9.4.min.js';
const out=process.env.BOW_DRAW_OUT||'/tmp/newone-bow-draw';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1440}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>body{margin:0}</style><script>'+fs.readFileSync(p5file,'utf8')+
   '</script><script>'+source+'</script><script>window.preload=function(){};window.setup=function(){createCanvas(1280,1440);pixelDensity(1);noLoop();window.__ready=true;};window.draw=function(){};</script>');
  await page.waitForFunction('window.__ready');
  const report=await page.evaluate(()=>{
   background(108,139,104);BIOME_ACTIVE=true;currentBiome=currentLevel=2;
   camX=camY=0;zoom=1;activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];
   GLRig.on=GLRig.ok=false;LIGHT_DX=-.7;LIGHT_DY=.7;
   const originalBow=window.drawHuntingBow,originalOval=window.figureCelOval;
   const tips=[],palms=[],cases=[];
   const point=(m,x,y)=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});
   window.drawHuntingBow=function(arrow,elevation,tension=1){
    if(arrow)tips.push(point(drawingContext.getTransform(),(23-9*tension)*Math.max(.72,Math.cos(elevation||0)),0));
    return originalBow.apply(this,arguments);
   };
   window.figureCelOval=function(g,x,y,w,h){
    if(w===8&&h===8)palms.push(point(drawingContext.getTransform(),x,y));
    return originalOval.apply(this,arguments);
   };
   try{
    for(let moving=0;moving<2;moving++)for(let draw=0;draw<4;draw++)for(let i=0;i<8;i++){
     const tension=[0,.25,.5,1][draw],a=i*Math.PI/4,c=new Character(0,0,true);player=c;
     c.currentWeapon=WEAPONS.BOW;c.weaponAmmo.BOW=24;c.isArmed=true;c.aimAngle=c.moveAngle=a;
     c.isMoving=!!moving;c.walkCycle=1.1;c.gait=.8;c.fireTimer=0;c.aimHold=10;
     c.bowDrawState={phase:'DRAW',tension,quality:1,dud:false};
     rightStick={active:false,dx:Math.cos(a),dy:Math.sin(a),dist:tension};
     const x=80+i*160,y=74+(moving*4+draw)*149,mag=1.9;
     tips.length=palms.length=0;push();translate(x,y);scale(mag);c.show();pop();
     const nativeBob=moving?Math.abs(Math.sin(c.walkCycle))*2:0;
     const expectedGrip={x:x+Math.cos(a)*(24+nativeBob)*mag,y:y+Math.sin(a)*(24+nativeBob)*mag};
     const expectedString={x:x+Math.cos(a)*(13-9*tension+nativeBob)*mag,y:y+Math.sin(a)*(13-9*tension+nativeBob)*mag};
     const distance=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
     const gripError=Math.min(...palms.map(p=>distance(p,expectedGrip)));
     const stringError=Math.min(...palms.map(p=>distance(p,expectedString)));
     bullets=[];c.fire(a,{tension,quality:1,dud:false,power:1});
     const b=bullets[0],tip=tips[0];
     const expected=b?{x:x+b.startX*mag,y:y+b.startY*mag}:null;
     cases.push({heading:i*45,tension,moving:!!moving,tip,expected,
      error:tip&&expected?distance(tip,expected):1e9,gripError,stringError});
     noStroke();fill(236,239,215);textAlign(CENTER,CENTER);textSize(10);
     text((moving?'Running':'Standing')+' · '+tension*100+'% · '+i*45+'°',x,y+59);
    }
    for(let i=0;i<8;i++){
     const c=new Character(0,0,true);player=c;c.currentWeapon=WEAPONS.BOW;c.ammo=24;c.isArmed=true;
     c.aimAngle=c.moveAngle=i*Math.PI/4;c.isMoving=true;c.walkCycle=1.1;c.gait=.4;c.aimHold=0;
     c.bowDrawState={phase:'IDLE',tension:0,quality:0,dud:false};rightStick.active=false;
     push();translate(80+i*160,1273);scale(1.9);c.show();pop();
     noStroke();fill(236,239,215);textAlign(CENTER,CENTER);textSize(10);
     text('Carried · '+i*45+'°',80+i*160,1332);
    }
    const states=[{phase:'IDLE',tension:0,quality:0,dud:false},
     {phase:'DRAW',tension:.5,quality:1,dud:false},{phase:'DRAW',tension:1,quality:1,dud:false},
     {phase:'DRAW',tension:1,quality:0,dud:true}];
    for(let i=0;i<states.length;i++)drawBowDrawHud({ammo:24,bowDrawState:states[i]},60+i*320,1380);
   }finally{window.drawHuntingBow=originalBow;window.figureCelOval=originalOval;}
   return{p5:p5.VERSION,cases};
  });
  assert.deepEqual(errors,[]);
  assert(report.cases.length===64&&report.cases.every(c=>c.tip&&c.error<.001&&c.gripError<.001&&c.stringError<.001),
   JSON.stringify(report.cases.filter(c=>!c.tip||c.error>=.001||c.gripError>=.001||c.stringError>=.001)));
  await page.locator('#defaultCanvas0').screenshot({path:path.join(out,'bow-draw-headings.png')});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({...report,sourceSha:require('crypto').createHash('sha256').update(source).digest('hex')},null,2));
  console.log('Bow draw renderer: 64 arrow tips and both wrists align across 4 tensions, 8 headings, standing/running; 8 carried poses. p5 '+report.p5+'.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

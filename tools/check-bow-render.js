// Real Character art: a bow's posed arrow tip must meet its projectile at
// every heading. The contact sheet also exposes reversed limbs/string.
const fs=require('fs'),path=require('path'),assert=require('assert');
const deps=process.env.VIS_DEPS||'/workspace/onboarding-newone';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'..','game.js'),'utf8');
const p5file=process.env.VIS_P5||'/tmp/p5-1.9.4.min.js';
const out=process.env.BOW_RENDER_OUT||'/tmp/newone-bow-render';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:410}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>body{margin:0}</style><script>'+fs.readFileSync(p5file,'utf8')+
   '</script><script>'+source+'</script><script>window.preload=function(){};window.setup=function(){createCanvas(1280,410);pixelDensity(1);noLoop();window.__ready=true;};window.draw=function(){};</script>');
  await page.waitForFunction('window.__ready');
  const report=await page.evaluate(()=>{
   background(108,139,104);BIOME_ACTIVE=true;currentBiome=currentLevel=2;
   camX=camY=0;zoom=1;activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];
   GLRig.on=GLRig.ok=false;LIGHT_DX=-.7;LIGHT_DY=.7;
   const original=window.drawHuntingBow,tips=[],cases=[];
   window.drawHuntingBow=function(...v){
    if(v[0]){
     const m=drawingContext.getTransform(),tipX=14*Math.max(.72,Math.cos(v[1]||0));
     tips.push({x:m.a*tipX+m.e,y:m.b*tipX+m.f});
    }
    return original.apply(this,v);
   };
   try{
    for(let pose=0;pose<2;pose++)for(let i=0;i<8;i++){
     const a=i*Math.PI/4,c=new Character(0,0,true);player=c;
     c.currentWeapon=WEAPONS.BOW;c.weaponAmmo.BOW=24;c.isArmed=true;c.aimAngle=c.moveAngle=a;
     c.isMoving=pose===1;c.walkCycle=1.1;c.gait=.35;c.fireTimer=0;c.aimHold=pose===0?10:0;
     rightStick={active:pose===0,dx:Math.cos(a),dy:Math.sin(a),dist:1};
     const x=80+i*160,y=94+pose*190,mag=2.2;
     tips.length=0;push();translate(x,y);scale(mag);c.show();pop();
     if(pose===0){
      bullets=[];c.fire(a);const b=bullets[0],tip=tips[0];
      const expected={x:x+b.startX*mag,y:y+b.startY*mag};
      cases.push({heading:i*45,tip,expected,error:tip?Math.hypot(tip.x-expected.x,tip.y-expected.y):Infinity});
     }
     noStroke();fill(236,239,215);textAlign(CENTER,CENTER);textSize(12);
     text((pose?'Carried':'Aimed')+' · '+i*45+'°',x,y+68);
    }
   }finally{window.drawHuntingBow=original;}
   return{p5:p5.VERSION,cases};
  });
  assert.deepEqual(errors,[]);assert(report.cases.every(c=>c.tip&&c.error<.001),JSON.stringify(report.cases));
  await page.locator('#defaultCanvas0').screenshot({path:path.join(out,'bow-headings.png')});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({...report,sourceSha:require('crypto').createHash('sha256').update(source).digest('hex')},null,2));
  console.log('Bow renderer: 8 actual posed arrow tips meet their projectiles; 16 poses rendered with p5 '+report.p5+'.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

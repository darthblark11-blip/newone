// Real p5 sheets and contact checks for the new street models. Run once per
// deployed/candidate p5 version, with no image/assets substituted for the art.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const deps=process.env.VIS_DEPS||'/workspace/onboarding-newone';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'..','game.js'),'utf8');
const p5file=process.env.VIS_P5||'/tmp/p5-1.9.4.min.js';
const out=process.env.CITY_ART_OUT||'/tmp/newone-city-subclasses';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<style>body{margin:0;background:#28353b}</style><script>'+fs.readFileSync(p5file,'utf8')+
   '</script><script>'+source+'</script><script>window.preload=function(){};window.setup=function(){createCanvas(1600,1900);pixelDensity(1);noLoop();window.__ready=true;};window.draw=function(){};</script>');
  await page.waitForFunction('window.__ready');
  const report=await page.evaluate(()=>{
   currentLevel=currentBiome=1;BIOME_ACTIVE=true;GLRig.on=GLRig.ok=false;
   activeBuildings=[];activeParkingCars=[];barrels=[];buildings=[];enemiesList=[];
   camX=camY=0;zoom=1;LIGHT_DX=-.7;LIGHT_DY=.7;
   leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
   swordPickedUp=false;setMeleeTool('NONE');jetpackUnlocked=false;explosiveArmorUnlocked=false;
   chemistSuitUnlocked=false;ninjaSuitUnlocked=false;cowboySuitEquipped=false;
   player=new Character(1000,1000,true);frameCount=140;
   const dc=drawingContext,original={save:dc.save,restore:dc.restore,oval:window.figureCelOval,
    limb:window.figureCelLimb,held:window.drawCityStreetHeld};
   let depth=0,underflow=0,finite=true,record=null;
   const world=(x,y)=>{const m=dc.getTransform();return{x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};};
   dc.save=function(){depth++;return original.save.call(this);};
   dc.restore=function(){depth--;if(depth<0)underflow++;return original.restore.call(this);};
   window.figureCelOval=function(g,x,y,w,h){
    finite&&=[x,y,w,h===undefined?w:h].every(Number.isFinite);
    if(record)record.palms.push({p:world(x,y),w,h});
    return original.oval.apply(this,arguments);
   };
   window.figureCelLimb=function(g,sx,sy,ex,ey,hx,hy){
    finite&&=[sx,sy,ex,ey,hx,hy].every(Number.isFinite);
    if(record)record.limbs.push({s:world(sx,sy),e:world(ex,ey),h:world(hx,hy)});
    return original.limb.apply(this,arguments);
   };
   window.drawCityStreetHeld=function(g,e,p,h){
    if(record)record.props.push({kind:p.kind,p:world(h.x,h.y)});
    return original.held.apply(this,arguments);
   };
   const cases=[];
   window.__streetCard=(row,col,label,e)=>{
    const x=col*200,y=50+row*201;
    noStroke();fill(112+row%3*4,135+row%3*3,126);rect(x+6,y+5,188,190,8);
    fill(227,231,208);textAlign(CENTER,CENTER);textSize(11);text(label,x+100,y+177);
    const state=JSON.stringify([e.x,e.y,e.hp,e.ammo,e.gait,e.cityActivity,e.panicTimer,e.stunTimer]);
    record={label,heading:col*45,palms:[],limbs:[],props:[]};
    push();translate(x+100,y+91);scale(2.7);e.show();pop();
    record.stateStable=state===JSON.stringify([e.x,e.y,e.hp,e.ammo,e.gait,e.cityActivity,e.panicTimer,e.stunTimer]);
    record.depth=depth;record.finite=finite;cases.push(record);record=null;
   };
   try{
    background(37,50,54);noStroke();fill(237,226,189);textSize(23);textAlign(LEFT,TOP);
    text('STREET CIVILIANS / CLOTHING, HAIR, ACTIVITY, EIGHT HEADINGS',24,15);
    for(let kind=0;kind<3;kind++)for(let phase=0;phase<3;phase++)for(let i=0;i<8;i++){
     const k=['PHONE','SMOKE','BOTTLE'][kind],ph=['REACH','USE','LOWER'][phase],e=new Character(0,0,false,'CITY_NEUTRAL_M');
     cityAppearance(e,39+i*101);e.clothingStyle=i%2;e.aimAngle=e.moveAngle=i*Math.PI/4;
     e.isMoving=phase!==1;e.gait=.27;e.walkCycle=1.1;
     e.cityActivity={kind:k,phase:ph,timeMs:phase===1?500:250,durationMs:1000,cycle:0};
     __streetCard(kind*3+phase,i,k+' / '+ph+' / '+i*45+'°',e);
    }
   }finally{
    dc.save=original.save;dc.restore=original.restore;
    window.figureCelOval=original.oval;window.figureCelLimb=original.limb;window.drawCityStreetHeld=original.held;
   }
   window.__cityAppearanceSheet=()=>{
    resizeCanvas(1600,1300);background(37,50,54);noStroke();fill(237,226,189);textSize(23);textAlign(LEFT,TOP);
    text('STREET CIVILIANS / IDENTITY, CONFIDENT WALK, BOXING AND FALLS',24,15);
    for(let row=0;row<6;row++)for(let i=0;i<8;i++){
     const e=new Character(0,0,false,row<3?'CITY_NEUTRAL_M':'CITY_THUG_M');cityAppearance(e,39+i*101);
     e.aimAngle=e.moveAngle=i*Math.PI/4;e.gait=.3;e.isMoving=true;e.walkCycle=1.25;
     e.cityActivity.phase='WAIT';e.clothingStyle=row%2;e.cityHairLength=row%3;
     let name=row<3?'Neutral / '+['short hair','medium hair','long hair'][row]:'Thug / purple & yellow';
     if(row===4){boxingEnter(e,[],'WORLD');boxingRequestPunch(e,'LEFT_STRAIGHT');
      e._boxing.punch.elapsedMs=e._boxing.punch.windupMs+e._boxing.punch.activeMs*.6;name='Thug / native boxing';}
     if(row===5){startPunchStun(e,i*Math.PI/4);e.stunPose.age=50;e.stunTimer=150;name='Thug / nonlethal fall';}
     push();translate(i*200+100,50+row*201+91);scale(row===5?2.0:2.7);e.show();pop();
     noStroke();fill(224,232,211);textAlign(CENTER,CENTER);textSize(11);text(name+' / '+i*45+'°',i*200+100,50+row*201+177);
    }
   };
   return {p5:p5.VERSION,cases,depth,underflow,finite};
  });
  const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<.001;
  assert.deepEqual(errors,[]);
  assert(report.finite&&report.depth===0&&report.underflow===0,'Canvas geometry/state failed');
  assert(report.cases.length===72&&report.cases.every(c=>c.props.length===1&&c.stateStable&&c.depth===0&&
   c.palms.some(h=>h.w>7&&h.w===h.h&&near(h.p,c.props[0].p))&&c.limbs.some(l=>near(l.h,c.props[0].p))),
   JSON.stringify(report.cases.filter(c=>c.props.length!==1||!c.stateStable||c.depth!==0)));
  await page.locator('#defaultCanvas0').screenshot({path:path.join(out,'street-activities-eight-headings.png')});
  await page.evaluate(()=>__cityAppearanceSheet());
  assert.deepEqual(errors,[]);
  await page.locator('#defaultCanvas0').screenshot({path:path.join(out,'street-models-eight-headings.png')});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({...report,sourceSha:crypto.createHash('sha256').update(source).digest('hex')},null,2));
  console.log('City subclasses: 72 real p5 '+report.p5+' activity poses keep props on resolved palms/forearms; 48 costume, boxing and fall previews; no errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

// Offline, native p5/Chromium preview. Nothing duplicates corpse/wall art.
// VIS_DEPS=/path/to/deps VIS_CHROME=/path/to/chromium [VIS_P5=/path/to/p5.min.js]
//   node tools/visual-corpse-walls.js [output-directory]
const fs=require('fs'),path=require('path'),assert=require('assert');
const deps=process.env.VIS_DEPS;
const resolve=name=>require.resolve(name,{paths:deps?[deps,path.join(deps,'node_modules')]:[__dirname]});
const {chromium}=require(resolve('playwright'));
const p5Path=process.env.VIS_P5||(deps&&path.join(deps,'node_modules/p5/lib/p5.min.js'));
if(!p5Path||!fs.existsSync(p5Path))throw Error('Set VIS_DEPS to a directory with p5 installed, or VIS_P5 to p5.min.js');
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const out=path.resolve(process.argv[2]||process.env.VIS_OUT||path.join(__dirname,'out'));
fs.mkdirSync(out,{recursive:true});
const W=1440,H=2600;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<meta charset=utf-8><style>html,body{margin:0;overflow:hidden}</style>'+
   '<script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script>'+
   '<script>'+fs.readFileSync(p5Path,'utf8')+'</script><script>'+source+'</script>'+
   '<script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas('+W+','+H+');pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('window.__ready');
  const result=await page.evaluate(()=>{
   currentLevel=currentBiome=1;BIOME_ACTIVE=true;started=false;doTick=true;
   isStoryMode=isPaused=isDead=isWin=killcamMode=inStoryIntro=false;
   leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
   zoom=2;camX=-width/zoom/2;camY=-height/zoom/2;viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
   buildings=activeBuildings=[];activeParkingCars=[];barrels=[];corpses=[];enemiesList=[];particles=[];
   player=new Character(-10000,-10000,true);started=true;wipeAllBloodBanks();
   const fixtures=[],nativePush=window.push,nativePop=window.pop;
   let stack=0,minStack=0;
   window.push=(...args)=>{stack++;return nativePush(...args);};
   window.pop=(...args)=>{stack--;minStack=Math.min(minStack,stack);return nativePop(...args);};
   const make=(b,type,angle,x,y,bank,frames,gun=false)=>{
    useBloodBank(bank);activeBuildings=buildings=[b];invalidateColIndex();frameCount=1200+type;randomSeed(3051+type);
    const e=new Character(x,y,false,'NM0_ROOKIE');e.aimAngle=e.moveAngle=angle;rememberFigureMotion(e,0,0);
    if(gun)e.fallHit={frame:frameCount,kind:'BODY',weapon:WEAPONS.DUAL_SMG,angle:HALF_PI,force:5,mx:0,my:0};
    const c=new Corpse(x,y,angle,angle,color(48,128,166),color(49,59,76),type,0,[],WEAPONS.PISTOL,
     type===0?angle+PI:HALF_PI,e.eType,e.bodyW,e.bodyH,e);
    corpses=[c];for(let f=0;f<frames;f++){frameCount++;c.update();}
    return {b,c,bank,frames};
   };
   const panel=(x,y,w,h,title,f,magnify=1.6)=>{
    useBloodBank(f.bank);corpses=[f.c];activeBuildings=buildings=[f.b];invalidateColIndex();
    noStroke();fill(163,170,159);rect(x,y,w,h,8);fill(29,48,54);textAlign(LEFT,TOP);textSize(15);text(title,x+12,y+12);
    const dc=drawingContext;dc.save();dc.beginPath();dc.rect(x+1,y+40,w-2,h-41);dc.clip();
    push();translate(x+w/2,y+h*.71);scale(magnify);translate(-f.b.x,-f.b.y);
    f.c.show();if(f.b.isBiomeProp)drawBiomeProps([f.b]);else drawBuildings([f.b]);pop();dc.restore();
   };
   background(24,35,43);noStroke();fill(235,231,209);textFont('sans-serif');textAlign(LEFT,TOP);textSize(26);
   text('CORPSE COLLISION / WALL BLOOD / SUPPORTED DEATHS',22,16);
   textSize(14);fill(169,194,199);text('Native p5 game painters and physics. Timelines advance from the same original death; wall marks remain on their own surface.',22,52);
   const seats=[
    {x:-230,y:170,w:140,h:30,nx:0,ny:-1,label:'North / HQ panel',style:{isWall:true,hqWall:'PANEL'}},
    {x:230,y:-340,w:140,h:30,nx:0,ny:1,label:'South / white lab',style:{isWall:true,hqWall:'WHITE_LAB'}},
    {x:210,y:160,w:30,h:140,nx:-1,ny:0,label:'West / urban hoarding',style:{isBiomeProp:true,propType:'HOARDING',tint:.35}},
    {x:-210,y:-160,w:30,h:140,nx:1,ny:0,label:'East / dungeon stone',style:{isWall:true,undergroundWall:'STONE'}}
   ];
   for(const [i,s] of seats.entries()){
    const b={x:s.x,y:s.y,w:s.w,h:s.h,...s.style};
    const x=b.x+s.nx*(s.nx?b.w/2+20:0),y=b.y+s.ny*(s.ny?b.h/2+20:0),angle=Math.atan2(s.ny,s.nx);
    const f=make(b,0,angle,x,y,'seat-'+i,48);fixtures.push({type:0,seated:!!f.c.wallSit});
    panel(12+i*357,88,345,370,s.label,f,1.65);
   }
   const rows=[{type:18,label:'Blast / torso'},{type:19,label:'Blast / one leg'},
    {type:20,label:'Blast / halves'},{type:10,label:'Gun overkill',gun:true},
    {type:11,label:'Dash explosion'},{type:3,label:'Melee finisher'}];
   const torsoOf=c=>{
    const parts=c.blast?c.blast.parts:c.overkillBits||c.aerialBits||c.splitPieces||[];
    return parts.find(p=>p.type==='torso'||p.type==='body'||p.type==='gunUpper'||p.type==='diagonalHalf'&&p.side>0);
   };
   for(const [row,config] of rows.entries()){
    const type=config.type,angle=type===3?0:HALF_PI,newWall=()=>({x:0,y:200,w:120,h:30,isWall:true,hqWall:'PANEL'});
    const sample=make(newWall(),type,angle,0,150,'sample-'+row,0,config.gun);
    let contactFrame=null,wallImpact=null;
    // Discover the native contact clock rather than forcing every animation
    // into legacy frame numbers. Each snapshot reruns that original controller.
    for(let frame=1;frame<=200;frame++){
     frameCount++;sample.c.update();
     const p=torsoOf(sample.c);
     if(p&&p.wallImpact){contactFrame=frame;wallImpact=p.wallImpact;break;}
    }
    if(contactFrame===null)throw Error('No native wall contact for '+config.label);
    const phases=[['Flight',1],['Contact',contactFrame],['Held on wall',contactFrame+Math.ceil(wallImpact.hold*.5)],
     ['Sliding',contactFrame+Math.ceil(wallImpact.hold+wallImpact.slide*.6)],
     ['Flat corpse',contactFrame+Math.ceil(wallImpact.hold+wallImpact.slide)+3]];
    for(const [col,[label,toFrame]] of phases.entries()){
     const f=make(newWall(),type,angle,0,150,'impact-'+row+'-'+col,toFrame,config.gun);
     const torso=torsoOf(f.c),impact=torso&&torso.wallImpact;
     fixtures.push({type,phase:label,frames:toFrame,impact:!!impact,done:impact&&impact.done,z:impact&&impact.z});
     panel(12+col*285,478+row*352,273,338,config.label+' / '+label,f,1.45);
    }
   }
   return {fixtures,stack,minStack};
  });
  assert.equal(result.stack,0);assert.equal(result.minStack,0);
  assert(result.fixtures.filter(f=>f.type===0).every(f=>f.seated),'a supported death failed to sit');
  assert(result.fixtures.filter(f=>f.phase==='Held on wall').every(f=>f.impact&&!f.done),'a torso failed to hold at its wall');
  assert(result.fixtures.filter(f=>f.phase==='Flat corpse').every(f=>f.done&&f.z===0),'a torso failed to slide down and finish');
  assert.deepEqual(errors,[]);
  const target=path.join(out,'corpse-wall-preview.png');
  await page.locator('canvas').first().screenshot({path:target});
  console.log(JSON.stringify({image:target,errors,fixtures:result.fixtures},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

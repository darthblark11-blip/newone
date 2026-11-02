// Render the native seated/slumped/side profiles, with the ordinary wall mask.
// VIS_P5=/path/to/p5.min.js node tools/visual-corpse-wall-slump.js [output-dir]
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const deps=process.env.VIS_DEPS;
const resolve=name=>require.resolve(name,{paths:deps?[deps,path.join(deps,'node_modules')]:[__dirname]});
async function run(options={}){
 const p5Path=options.p5||process.env.VIS_P5||(deps&&path.join(deps,'node_modules/p5/lib/p5.min.js'));
 if(!p5Path||!fs.existsSync(p5Path))throw Error('Set VIS_P5 to a local p5.min.js, or VIS_DEPS to installed p5.');
 const {chromium}=require(resolve('playwright'));
 const browser=await chromium.launch({headless:true,executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1720,height:1750},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
  await page.setContent('<meta charset=utf-8><style>html,body{margin:0;overflow:hidden;background:#17242a}</style>'+
   '<script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script>'+
   '<script>'+fs.readFileSync(p5Path,'utf8')+'</script><script>'+source+'</script>'+
   '<script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(1720,1750);pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('window.__ready');
  const results=await page.evaluate(()=>{
   currentLevel=currentBiome=1;BIOME_ACTIVE=true;started=false;doTick=true;
   isStoryMode=isPaused=isDead=isWin=killcamMode=inStoryIntro=false;
   leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
   buildings=activeBuildings=[];activeParkingCars=[];barrels=[];corpses=[];enemiesList=[];particles=[];
   player=new Character(-10000,-10000,true);started=true;wipeAllBloodBanks();
   viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
   const rows=[
    {type:'NM0_ROOKIE',outcome:'SEATED',side:1,normal:[0,-1],label:'Blue regular / complete seated slump'},
    {type:'NM0_ROOKIE',outcome:'SIDE',side:-1,normal:[0,-1],label:'Blue regular / left hip'},
    {type:'CITY_CITIZEN_F',outcome:'SIDE',side:1,normal:[0,-1],label:'Civilian / right hip'},
    {type:'ARMORED_STANDARD',outcome:'SIDE',side:-1,normal:[1,0],label:'Armored / left hip / east wall'},
    {type:'COWBOY',outcome:'SIDE',side:1,normal:[-1,0],label:'Cowboy / right hip / west wall'},
    {type:'NM0_ROOKIE_F',outcome:'SIDE',side:-1,normal:[0,1],death:8,label:'Blue regular / injured head / south wall'}
   ];
   const ages=[0,12,24,46,64,94,124,164],records=[];
   background(23,36,42);noStroke();fill(237,231,210);textFont('sans-serif');textSize(25);textAlign(LEFT,TOP);
   text('WALL DEATH / SEATED SLUMP / HIP LANDING',14,16);
   fill(173,197,202);textSize(14);text('Native actor profiles and continuous controller, with the existing roof occlusion. Columns follow the same death through time.',14,49);
   const nativePush=window.push,nativePop=window.pop;let stack=0,minStack=0;
   window.push=(...a)=>{stack++;return nativePush(...a);};window.pop=(...a)=>{stack--;minStack=Math.min(minStack,stack);return nativePop(...a);};
   for(let row=0;row<rows.length;row++){
    const config=rows[row],top=86+row*276;
    fill(233,227,204);textSize(16);text(config.label,14,top);
    for(let column=0;column<ages.length;column++){
     const age=ages[column],[nx,ny]=config.normal,facing=Math.atan2(ny,nx),vertical=nx!==0;
     zoom=1;const centerX=nx*440,centerY=ny*440;camX=centerX-width/2;camY=centerY-height/2;
     useBloodBank('slump-'+row+'-'+column);clearWallCorpses();frameCount=1000;randomSeed(73019+row);
     const b={x:0,y:0,w:vertical?70:180,h:vertical?180:70,isWall:true,hqWall:'PANEL'};
     activeBuildings=buildings=[b];invalidateColIndex();corpses=[];particles=[];
     const nativeRandom=Math.random;let identitySeed=73019+row;
     Math.random=()=>{identitySeed=(Math.imul(identitySeed,1664525)+1013904223)>>>0;return identitySeed/4294967296;};
     const e=new Character(nx*55,ny*55,false,config.type);e.aimAngle=e.moveAngle=facing;rememberFigureMotion(e,0,0);
     if(config.type==='CITY_CITIZEN_F')e.shirtCol=color(177,66,128);
     const c=new Corpse(e.x,e.y,facing,facing,e.shirtCol,e.pantsCol,config.death||0,0,e.decals,e.currentWeapon,facing+PI,e.eType,e.bodyW,e.bodyH,e);
     Math.random=nativeRandom;
     if(!c.wallSit)throw Error('Wall slump fixture missed seated controller: '+config.type);
     c.wallSit.outcome=config.outcome;c.wallSit.side=config.side;corpses=[c];
     for(let tick=0;tick<age;tick++){frameCount++;c.update();}
     const pose=wallCorpseSlumpPose(c),a=seatedCorpseAnatomy(c),x=12+column*213,y=top+25;
     noStroke();fill(162,172,158);rect(x,y,201,238,6);fill(28,49,54);textSize(12);text(`${age}f / ${pose.phase}`,x+8,y+8);
     const dc=drawingContext;dc.save();dc.beginPath();dc.rect(x+2,y+27,197,209);dc.clip();
     push();translate(x+100,y+146);scale(2.35);translate(-c.x,-c.y);
     drawBuildings([b]);pop();dc.restore();
     records.push({type:config.type,outcome:config.outcome,side:config.side,age,phase:pose.phase,done:c.wallSit.done,
       profile:a.profile,headPitch:a.headPitch,hip:a.local.hip,head:a.local.head});
    }
   }
   return{records,stack,minStack,p5Version:p5.VERSION};
  });
  assert.deepEqual(errors,[],'native animation render failed');assert.equal(results.stack,0);assert.equal(results.minStack,0);
  assert(results.records.filter(r=>r.age===164).every(r=>r.done),'timeline did not reach frozen rest');
  assert(results.records.filter(r=>r.age===164&&r.outcome==='SIDE').every(r=>r.profile>.65),'hip landing did not show side profile');
  const output=path.resolve(options.output||process.argv[2]||process.env.VIS_OUT||path.join(__dirname,'out'));
  fs.mkdirSync(output,{recursive:true});const image=path.join(output,'corpse-wall-slump.png');
  await page.locator('canvas').first().screenshot({path:image});
  return{...results,errors,image};
 }finally{await browser.close();}
}
module.exports={run};
if(require.main===module)run().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e);process.exitCode=1;});

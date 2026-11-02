// Native p5 wall/corpse rendering, checked from final pixels rather than a
// second copy of the wall clipping math. VIS_P5 selects the phone's p5 build.
// VIS_P5=/path/to/p5.min.js node tools/visual-corpse-wall-occlusion.js [output-dir]
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const deps=process.env.VIS_DEPS;
const resolve=name=>require.resolve(name,{paths:deps?[deps,path.join(deps,'node_modules')]:[__dirname]});
async function run(options={}) {
 const p5Path=options.p5||process.env.VIS_P5||(deps&&path.join(deps,'node_modules/p5/lib/p5.min.js'));
 if(!p5Path||!fs.existsSync(p5Path))throw Error('Set VIS_P5 to a local p5.min.js or VIS_DEPS to installed p5.');
 const {chromium}=require(resolve('playwright'));
 const browser=await chromium.launch({headless:true,executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
  const page=await browser.newPage({viewport:{width:640,height:480},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
  await page.setContent('<meta charset=utf-8><style>html,body{margin:0;background:#17242a}</style>'+
   '<script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script>'+
   '<script>'+fs.readFileSync(p5Path,'utf8')+'</script><script>'+source+'</script>'+
   '<script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(640,480);pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('window.__ready');
  const results=await page.evaluate(async()=>{
   currentLevel=currentBiome=1;BIOME_ACTIVE=true;started=false;doTick=true;
   isStoryMode=isPaused=isDead=isWin=killcamMode=inStoryIntro=false;
   leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
   buildings=activeBuildings=[];activeParkingCars=[];barrels=[];corpses=[];enemiesList=[];particles=[];
   player=new Character(-10000,-10000,true);started=true;wipeAllBloodBanks();
   viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
   const records=[],images=[];const normals=[[0,-1,'North'],[0,1,'South'],[-1,0,'West'],[1,0,'East']];
   const snapshot=()=>drawingContext.getImageData(0,0,width,height).data;
   const magenta=(pixels,i)=>pixels[i]>240&&pixels[i+1]<25&&pixels[i+2]>180&&pixels[i+3]>240;
   const nativeBlastPart=drawBlastCorpsePart;
   const diag=(r,x,y)=>{r.push();r.noStroke();r.fill(255,0,255);r.rect(x-55,y-55,110,110);r.pop();};
   const render=(b,c,diagnostic=false,second=null)=>{
    clear();push();scale(zoom);translate(-camX,-camY);
    if(diagnostic){
     if(c.wallSit){const real=c.show;c.show=function(r=window){diag(r,c.x,c.y);};try{drawBuildings([b]);}finally{c.show=real;}}
     else {drawBlastCorpsePart=function(r,body,p){const pose=blastPiecePose(p);diag(r,body.x+p.x+pose.dx,body.y+p.y+pose.dy);};try{drawBuildings([b]);}finally{drawBlastCorpsePart=nativeBlastPart;}}
    }else{c.show();drawBuildings([b]);}
    if(second)drawBuildings([second]);pop();return snapshot();
   };
   const renderWallOnly=b=>{
    const realSeat=drawWallCorpses,realPieces=drawWallCorpsePieces;
    drawWallCorpses=drawWallCorpsePieces=function(){};
    try{clear();push();scale(zoom);translate(-camX,-camY);drawBuildings([b]);pop();return snapshot();}
    finally{drawWallCorpses=realSeat;drawWallCorpsePieces=realPieces;}
   };
   for(const [nx,ny,label] of normals)for(const hidden of [false,true])for(const kind of ['seated','pinned'])for(const z of [1,.45,.18]){
    frameCount++;zoom=z;const side=hidden?-1:1;
    const centerX=nx*side*(width/zoom*.5)*.78,centerY=ny*side*(height/zoom*.5)*.78;
    camX=centerX-width/zoom*.5;camY=centerY-height/zoom*.5;
    const b={x:0,y:0,w:nx?70:180,h:nx?180:70,isWall:true,hqWall:'PANEL'};
    const clearance=(nx?b.w:b.h)*.5,angle=Math.atan2(ny,nx),bank=label+hidden+kind+z;
    useBloodBank(bank);buildings=activeBuildings=[b];invalidateColIndex();corpses=[];particles=[];
    const distance=clearance+(kind==='seated'?20:55),e=new Character(nx*distance,ny*distance,false,'NM0_ROOKIE');
    e.aimAngle=e.moveAngle=angle;rememberFigureMotion(e,0,0);
    const c=new Corpse(e.x,e.y,angle,angle,color(57,135,172),color(49,59,74),kind==='seated'?0:18,0,[],WEAPONS.PISTOL,angle+PI,e.eType,e.bodyW,e.bodyH,e);corpses=[c];
    if(kind==='seated'){c.wallSit.outcome='SEATED';for(let i=0;i<480&&!c.wallSit.done;i++){frameCount++;c.update();}frameCount++;updateCorpses();}
    else {
     const p=c.blast.parts.find(p=>p.type==='torso');p.x=p.y=p.z=0;p.vx=-nx*10;p.vy=-ny*10;p.vz=p.vr=0;
     for(let i=0;i<40&&!p.wallImpact;i++){frameCount++;c.update();}
     if(!p.wallImpact)throw Error('Pinned fixture missed wall');
     for(let i=0;i<8;i++){frameCount++;c.update();}
    }
    const baseline=renderWallOnly(b),diagnostic=render(b,c,true),projection=corpseWallProjection(b);
    let roofLeaks=0,hullLeaks=0,diagnosticPixels=0,opaquePixels=0;
    // The actual painter supplies the opaque hull mask, including its side
    // faces. Transparent native contact shadows are intentionally excluded.
    for(let i=0;i<baseline.length;i+=4){
     if(magenta(diagnostic,i))diagnosticPixels++;
     if(baseline[i+3]>=254){opaquePixels++;if(magenta(diagnostic,i))hullLeaks++;}
    }
    // Sample well inside the real roof. Geometry comes from the renderer's
    // public projection, while native alpha confirms that a roof was painted.
    for(let ix=-4;ix<=4;ix++)for(let iy=-4;iy<=4;iy++){
     const x=Math.round((b.x+projection.lx+ix*b.w*.09-camX)*zoom),y=Math.round((b.y+projection.ly+iy*b.h*.09-camY)*zoom);
     if(x<0||x>=width||y<0||y>=height)continue;
     const i=(y*width+x)*4;if(baseline[i+3]>=254&&magenta(diagnostic,i))roofLeaks++;
    }
    const facing=nx*projection.lx+ny*projection.ly;
    render(b,c,false);const canvas=document.getElementById('defaultCanvas0');
    const src=canvas.toDataURL();images.push({src,label:label+' / '+(hidden?'occluded':'visible')+' / '+kind+' / '+z,
      cx:(b.x+projection.lx*.5-camX)*zoom,cy:(b.y+projection.ly*.5-camY)*zoom});
    const anatomy=c.wallSit?seatedCorpseAnatomy(c):null;
    const torso=anatomy&&anatomy.torso;
    records.push({normal:label,hidden,kind,zoom:z,facing,roofLeaks,hullLeaks,diagnosticPixels,opaquePixels,
      banked:!!c.isStatic,torso:torso?{length:torso.length,width:torso.width,yaw:torso.yaw}:null});
   }
   // A later, nearer mass must cover wall-supported bodies just as it covers
   // the native wall. The diagnostic fills the vicinity to make any order leak
   // obvious; the foreground opaque mask comes from its own native painter.
   zoom=1;camX=-320;camY=-360;frameCount++;wipeAllBloodBanks();useBloodBank('foreground');
   const wall={x:0,y:0,w:180,h:70,isWall:true,hqWall:'PANEL'};
   buildings=activeBuildings=[wall];invalidateColIndex();const e=new Character(0,-55,false,'NM0_ROOKIE');e.aimAngle=-HALF_PI;rememberFigureMotion(e,0,0);
   const c=new Corpse(e.x,e.y,0,-HALF_PI,color(57,135,172),color(49,59,74),0,0,[],WEAPONS.PISTOL,HALF_PI,e.eType,e.bodyW,e.bodyH,e);corpses=[c];
   for(let i=0;i<48;i++){frameCount++;c.update();}
   const blocker={x:20,y:-40,w:50,h:50,isWall:true,hqWall:'PANEL'};
   const front=renderWallOnly(blocker),covered=render(wall,c,true,blocker);let foregroundLeaks=0;
   for(let i=0;i<front.length;i+=4)if(front[i+3]>=254&&magenta(covered,i))foregroundLeaks++;
   const sheet=document.createElement('canvas');sheet.id='occlusion-sheet';sheet.width=1800;sheet.height=32+8*250;
   const out=sheet.getContext('2d');out.fillStyle='#17242a';out.fillRect(0,0,sheet.width,sheet.height);out.fillStyle='#e8e2d1';out.font='18px sans-serif';out.fillText('Native wall corpses: all faces, both camera sides, near / far scale',16,23);
   for(let i=0;i<images.length;i++){
    const item=images[i],img=new Image();img.src=item.src;await img.decode();const x=(i%6)*300,y=32+Math.floor(i/6)*250;
    out.fillStyle='#a4ac9f';out.fillRect(x+3,y+3,294,244);out.fillStyle='#20323a';out.font='13px sans-serif';out.fillText(item.label,x+10,y+21);
    out.save();out.beginPath();out.rect(x+4,y+30,292,215);out.clip();
    out.drawImage(img,item.cx-130,item.cy-100,260,200,x+4,y+30,292,215);out.restore();
   }
   document.body.appendChild(sheet);return{records,foregroundLeaks,p5Version:p5.VERSION};
  });
  assert.deepEqual(errors,[],'native browser error');
  const badRoof=results.records.filter(r=>r.roofLeaks!==0);
  const badHidden=results.records.filter(r=>r.facing>=-.01&&r.hullLeaks!==0);
  const missing=results.records.filter(r=>r.opaquePixels===0||r.facing<-.01&&r.diagnosticPixels===0);
  if(options.assertions!==false){
   assert.deepEqual(badRoof,[],'supported corpse painted through an opaque roof');
   assert.deepEqual(badHidden,[],'hidden wall face painted through its opaque hull');
   assert.deepEqual(missing,[],'fixture failed to paint a wall or external corpse region');
   assert.equal(results.foregroundLeaks,0,'foreground mass did not cover corpse');
   const seated=results.records.filter(r=>r.kind==='seated');
   assert(seated.every(r=>r.banked),'seated fixture failed to test retired wall-bank rendering');
   assert(seated.every(r=>r.torso&&Object.values(r.torso).every(Number.isFinite)&&r.torso.length>5&&r.torso.length<40&&r.torso.width>5&&r.torso.width<40),'projected seated torso became degenerate or oversized');
   for(const dimension of ['length','width']){const values=seated.map(r=>r.torso[dimension]);assert(Math.max(...values)/Math.min(...values)<1.15,'seated torso dimensions changed with camera distance or side');}
  }
  if(options.output){fs.mkdirSync(options.output,{recursive:true});const file=path.join(options.output,'corpse-wall-occlusion.png');await page.locator('#occlusion-sheet').screenshot({path:file});results.image=file;}
  return{...results,errors};
 }finally{await browser.close();}
}
module.exports={run};
if(require.main===module)run({output:path.resolve(process.argv.slice(2).find(a=>!a.startsWith('--'))||process.env.VIS_OUT||path.join(__dirname,'out')),assertions:!process.argv.includes('--preview')})
 .then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e);process.exitCode=1;});

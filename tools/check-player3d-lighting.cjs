// Actual WebGL head shading under the game's live sky and street lamps.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.PLAYER3D_LIGHTING_OUT||'/tmp/player3d-lighting-qa';
const begin='// BEGIN GENERATED PLAYER3D — tools/build-player3d.py';
const base=fs.readFileSync(path.join(root,'game.js'),'utf8').split(begin)[0];
const source=base+'\nconst PLAYER3D_ASSET='+fs.readFileSync(path.join(root,'assets/player/player-mesh.json'),'utf8')+';\n'+
 ['pose.js','renderer.js','corpse.js'].map(f=>fs.readFileSync(path.join(root,'tools/player3d',f),'utf8')).join('\n');
const p5=fs.readFileSync(process.env.PLAYER3D_P5||'/workspace/.environment/newone/node_modules/p5/lib/p5.min.js','utf8');
const boot='preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(960,640);pixelDensity(1);noLoop();window.__ready=true;};';
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:960,height:640}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://head-lighting.local/**',r=>{
   const u=r.request().url();
   if(u.endsWith('/p5.js'))return r.fulfill({contentType:'application/javascript',body:p5});
   if(u.endsWith('/game.js'))return r.fulfill({contentType:'application/javascript',body:source});
   return r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}canvas{display:block}</style><script src="/p5.js"></script><script src="/game.js"></script><script>'+boot+'</script>'});
  });
  await page.goto('http://head-lighting.local/');await page.waitForFunction(()=>window.__ready);
  const report=await page.evaluate(()=>{
   currentLevel=currentBiome=2;BIOME_ACTIVE=false;isRaining=false;zoom=1;camX=camY=0;
   viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
   player={x:0,y:0,hp:0,dead:true,aimAngle:0};activeBuildings=[];fires=[];enemiesList=[];
   const radius=6.1,scaleValue=11;
   const snapshot=(angle=0)=>{const c=Math.cos(angle)*radius,s=Math.sin(angle)*radius;
    return{parts:[{mesh:'head',part:'head',color:[235,180,140],matrix:new Float32Array([c,s,0,0,-s,c,0,0,0,0,radius,0,0,0,30,1])}],
     sockets:{head:{x:0,y:0,z:30}},bounds:[-radius,-radius,radius,radius],worldOrigin:{x:0,y:0,z:0}};};
   const setScene=(hour,lampX=null)=>{worldTimeMs=hour/24*DAY_MS;frameCount++;
    BIOME_ACTIVE=lampX!==null;activeBuildings=lampX===null?[]:[{x:lampX,y:0,w:4,h:4,isStreetLight:true}];};
   const luminance=p=>p[0]*.30+p[1]*.59+p[2]*.11;
   const results=[];background(181,190,185);textFont('sans-serif');
   const drawCase=(label,index,hour,lampX=null,angle=0,contextAngle=0)=>{
    setScene(hour,lampX);const x=160+(index%3)*320,y=140+Math.floor(index/3)*320;
    push();translate(x,y);rotate(contextAngle);scale(scaleValue);
    const drawn=Player3D.draw(snapshot(angle),drawingContext);pop();
    const read=offset=>Array.from(drawingContext.getImageData(Math.round(x+offset*radius*scaleValue),y,1,1).data);
    const left=read(-.75),right=read(.75),center=read(0),diagnostics=Player3D.getDiagnostics();
    const pixels=drawingContext.getImageData(Math.round(x-radius*scaleValue),Math.round(y-radius*scaleValue),Math.round(2*radius*scaleValue),Math.round(2*radius*scaleValue));
    noStroke();fill(26,39,42);textAlign(CENTER);textSize(16);text(label,x,y+105);
    textSize(11);text('Relative normal shading; world pass applies brightness',x,y+126);
    const row={label,drawn,left,right,center,leftLuma:luminance(left),rightLuma:luminance(right),lighting:diagnostics.lighting};
    results.push(row);return{row,pixels};
   };
   // Deliberately stale bearing: the real sky query must refresh it before the
   // renderer samples the sun, even when the clock changes in the same frame.
   setScene(10);LIGHT_DX=1;LIGHT_DY=0;
   const lazy=Player3D.sampleLighting(snapshot(),null);
   const lazySkyRefresh=LIGHT_DX<0&&lazy.direction[0]>0;
   const morning=drawCase('Morning sun',0,10),afternoon=drawCase('Afternoon sun',1,17);
   const ambient=drawCase('Night / ambient only',2,23);
   const west=drawCase('Night / lamp on left',3,23,-60),east=drawCase('Night / lamp on right',4,23,60);
   const turned=drawCase('Same sun / head turned 90°',5,10,null,Math.PI/2);
   const meanCentralDifference=(a,b)=>{
    const n=a.width,c=n/2;let delta=0,count=0;
    // Surface facial marks lie outside this top-cap region. This compares
    // lighting on the actual head geometry, not painted facial details.
    for(let y=0;y<a.height;y++)for(let x=0;x<n;x++)if(Math.hypot(x-c,y-c)<n*.30){
     const k=(y*n+x)*4;for(let j=0;j<3;j++){delta+=Math.abs(a.data[k+j]-b.data[k+j]);count++;}}
    return delta/Math.max(1,count);
   };
   const turnDifference=meanCentralDifference(morning.pixels,turned.pixels);
   // A rotated Graphics target must not rotate the world light with the mesh.
   const g=createGraphics(240,240);g.pixelDensity(1);setScene(10);
   g.translate(120,120);g.rotate(Math.PI/2);g.scale(scaleValue);
   const transformedDraw=Player3D.draw(snapshot(),g.drawingContext);
   const rotatedLeft=g.drawingContext.getImageData(Math.round(120-radius*scaleValue*.75),120,1,1).data;
   const rotatedRight=g.drawingContext.getImageData(Math.round(120+radius*scaleValue*.75),120,1,1).data;
   const graphicsWorldLight=transformedDraw&&luminance(rotatedRight)>luminance(rotatedLeft)+2;g.remove();
   // Synthetic cones use the same production emitter sampler and isolate the
   // gate from fixtures/flicker; street-lamp cases above use native gathering.
   const originalEmitters=sceneEmitters;setScene(23);
   let toward=0;sceneEmitters=()=>[{x:60,y:0,z:46,r:330,p:1,c:[1,1,1],aim:toward,half:.4,inner:.2}];
   const outOfCone=Player3D.sampleLighting(snapshot(),null).localWeight;
   toward=Math.PI;const inCone=Player3D.sampleLighting(snapshot(),null).localWeight;
   sceneEmitters=originalEmitters;
   setScene(23,60);
   const nearOrigin=Player3D.sampleLighting(snapshot(),null).direction[0];
   const translated=snapshot();translated.worldOrigin={x:120,y:0,z:0};
   const farOrigin=Player3D.sampleLighting(translated,null).direction[0];
   const translatedWorldOrigin=nearOrigin>0&&farOrigin<0;
   const flatDirection=Array.from(Player3D.sampleLighting(snapshot(),null).direction),originalGround=groundElev;
   groundElev=()=>100;const raised=snapshot();raised.worldOrigin.z=100;
   const hillDirection=Array.from(Player3D.sampleLighting(raised,null).direction);
   activeBuildings[0].isCivic=true;frameCount++;
   const civicDirection=Array.from(Player3D.sampleLighting(raised,null).direction);
   currentBiome=3;frameCount++;
   const canyonDirection=Array.from(Player3D.sampleLighting(raised,null).direction);
   groundElev=originalGround;currentBiome=2;
   const sameDirection=v=>Math.hypot(...v.map((x,i)=>x-flatDirection[i]))<.00001;
   const heightFrames={hill:sameDirection(hillDirection),civic:sameDirection(civicDirection),canyon:sameDirection(canyonDirection)};
   const uploads=Player3D.stats.meshUploads,programs=Player3D.stats.programCreates;
   for(let i=0;i<8;i++){setScene(i%2?10:17);Player3D.sampleLighting(snapshot(),null);}
   return{cases:results,lazySkyRefresh,turnDifference,graphicsWorldLight,outOfCone,inCone,translatedWorldOrigin,heightFrames,
    gpuError:Player3D.gl.getError(),uploadsBefore:uploads,uploadsAfter:Player3D.stats.meshUploads,
    programsBefore:programs,programsAfter:Player3D.stats.programCreates};
  });
  await page.screenshot({path:path.join(out,'head-live-lighting.png')});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  const [morning,afternoon,ambient,west,east]=report.cases;
  assert.ok(report.cases.every(c=>c.drawn),'all head cases produce real GPU output');
  assert.ok(report.lazySkyRefresh,'same-frame sky change refreshes bearing before sampling');
  assert.ok(morning.rightLuma>morning.leftLuma+2,'morning highlights face the actual sun');
  assert.ok(afternoon.leftLuma>afternoon.rightLuma+2,'afternoon moves the highlight to the other side');
  assert.ok(ambient.lighting.contrast===0&&Math.abs(ambient.leftLuma-ambient.rightLuma)<1,'ambient-only night has no phantom solar patch');
  assert.ok(west.lighting.localWeight>0&&west.leftLuma>west.rightLuma+2,'native lamp on left moves the shade');
  assert.ok(east.lighting.localWeight>0&&east.rightLuma>east.leftLuma+2,'native lamp on right moves the shade');
  assert.ok(report.turnDifference<2,'turning the spherical head preserves world-space shading');
  assert.ok(report.graphicsWorldLight,'rotated corpse Graphics target preserves world-space light');
  assert.ok(report.outOfCone===0&&report.inCone>.1,'local spotlight cone gate is respected');
  assert.ok(report.translatedWorldOrigin,'moving the actor past the same world lamp reverses the local key');
  assert.ok(report.heightFrames.hill&&report.heightFrames.civic&&report.heightFrames.canyon,'hill/civic/canyon height encoding preserves physical light direction');
  assert.equal(report.gpuError,0);assert.equal(report.uploadsAfter,report.uploadsBefore);assert.equal(report.programsAfter,report.programsBefore);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

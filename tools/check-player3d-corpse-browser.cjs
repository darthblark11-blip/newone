// Render each player death through real p5, WebGL2 and the native corpse hooks.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.PLAYER3D_CORPSE_OUT||'/tmp/player3d-corpse-qa';
const p5=fs.readFileSync('/workspace/.environment/newone/node_modules/p5/lib/p5.min.js','utf8');
const begin='// BEGIN GENERATED PLAYER3D — tools/build-player3d.py';
const base=fs.readFileSync(path.join(root,'game.js'),'utf8').split(begin)[0];
const source=base+'\nconst PLAYER3D_ASSET='+fs.readFileSync(path.join(root,'assets/player/player-mesh.json'),'utf8')+';\n'+
 ['pose.js','renderer.js','corpse.js'].map(f=>fs.readFileSync(path.join(root,'tools/player3d',f),'utf8')).join('\n');
const boot='preload=function(){};setup=function(){createCanvas(1260,900);pixelDensity(1);noLoop();window.__ready=true;};draw=function(){};windowResized=function(){};';
async function main(){
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1260,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://corpse3d.local/**',r=>{
   const u=r.request().url();
   if(u.endsWith('p5.js'))return r.fulfill({contentType:'application/javascript',body:p5});
   if(u.endsWith('game.js'))return r.fulfill({contentType:'application/javascript',body:source});
   return r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}canvas{display:block}</style><script src="/p5.js"></script><script src="/game.js"></script><script>'+boot+'</script>'});
  });
  await page.goto('http://corpse3d.local/');await page.waitForFunction(()=>window.__ready);
  const result=await page.evaluate(()=>{
   isStoryMode=false;started=true;doTick=false;BIOME_ACTIVE=false;currentLevel=currentBiome=1;
   buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
   explosiveArmorUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
   leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
   zoom=1;camX=camY=0;viewLeft=viewTop=-100000;viewRight=viewBottom=100000;LIGHT_DX=.7;LIGHT_DY=.7;
   background(174,184,174);textFont('sans-serif');textAlign(CENTER);fill(25);textSize(20);text('Player mesh death coverage',width/2,30);
   const cases=[];player=new Character(0,0,true);player.currentWeapon=WEAPONS.PISTOL;player.isArmed=true;
   const paint=(c,x,y,label)=>{const before=Player3D.stats.draws;push();translate(x,y);scale(1.8);c.paint(window);pop();
    push();fill(25);noStroke();textSize(12);text(label,x,y+90);pop();return Player3D.stats.draws>before;};
   for(let dt=0;dt<=20;dt++){
    frameCount++;const c=new Corpse(0,0,0,0,player.shirtCol,player.pantsCol,dt,0,[],WEAPONS.PISTOL,0,'NORMAL',21,27,player);
    c.fP=1;if(c.rag)for(const l of c.rag.limbs){l.a=l.rest;l.b=l.restB;}
    cases.push({dt,mesh:paint(c,90+(dt%7)*180,140+Math.floor(dt/7)*220,'Death '+dt)});
   }
   const g=createGraphics(200,200);g.pixelDensity(1);g.clear();g.push();g.translate(100,100);
   const c=new Corpse(0,0,0,0,player.shirtCol,player.pantsCol,0,0,[],WEAPONS.PISTOL,0,'NORMAL',21,27,player);c.fP=1;
   c.paint(g);g.pop();const data=g.drawingContext.getImageData(0,0,200,200).data;let graphicsPixels=0;
   for(let i=3;i<data.length;i+=4)if(data[i])graphicsPixels++;g.remove();
   return {cases,graphicsPixels,gpuError:Player3D.gl.getError(),stats:Player3D.getDiagnostics()};
  });
  await page.screenshot({path:path.join(out,'player-deaths.png')});
  assert.deepEqual(errors,[]);for(const row of result.cases)assert.ok(row.mesh,'death '+row.dt+' must render3D');
  assert.ok(result.graphicsPixels>100);assert.equal(result.gpuError,0);
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

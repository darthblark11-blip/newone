// A shared WebGL canvas can retain another actor outside the current crop.
// Canvas2D filtering is allowed to sample those texels: compare each draw with
// a fully transparent backing store, including fractional and mirrored copies.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.PLAYER3D_CROP_OUT||'/tmp/player3d-crop-qa';
const source=fs.readFileSync(process.env.GAME_JS||path.join(root,'game.js'),'utf8');
const p5=fs.readFileSync(process.env.PLAYER3D_P5||'/workspace/.environment/newone/node_modules/p5/lib/p5.min.js','utf8');
const boot='preload=function(){};setup=function(){createCanvas(720,720);pixelDensity(1);noLoop();window.__ready=true;};draw=function(){};windowResized=function(){};';
async function main(){
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:720,height:720}}),errors=[];
  page.on('pageerror',error=>errors.push(error.stack||String(error)));
  await page.addInitScript(()=>{
   const get=HTMLCanvasElement.prototype.getContext,seen=new WeakSet();window.__cropContexts=0;
   HTMLCanvasElement.prototype.getContext=function(kind,...args){const value=get.call(this,kind,...args);
    if(kind==='webgl2'&&value&&!seen.has(this)){seen.add(this);__cropContexts++;}return value;};
  });
  await page.route('http://crop-qa.local/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/p5.js')return route.fulfill({contentType:'application/javascript',body:p5});
   if(url.pathname==='/game.js')return route.fulfill({contentType:'application/javascript',body:source});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><script src="/p5.js"></script><script src="/game.js"></script><script>'+boot+'</script>'});
  });
  await page.goto('http://crop-qa.local/');await page.waitForFunction(()=>window.__ready);
  const result=await page.evaluate(()=>{
   started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
   inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
   currentLevel=currentBiome=2;BIOME_ACTIVE=false;window.inNM0SecretOverlay=false;buildGhost=null;
   resetUndergroundRoute();setMeleeTool('NONE');
   chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
   leftStick={active:true,dx:1,dy:0,dist:1};rightStick={active:true,dx:1,dy:0,dist:1};
   camX=camY=0;zoom=1;viewLeft=viewTop=-100000;viewRight=viewBottom=100000;
   function actor(type,weapon,stance='STAND'){
    const a=new Character(0,0,type===null,type||'NORMAL');a.isArmed=true;a.isMoving=true;
    a.currentWeapon=WEAPONS[weapon];a.aimAngle=.3;a.moveAngle=1.8;a.gait=.6;a.walkCycle=.9;a.aimHold=14;
    a.reloadTimer=a.meleeTimer=a.dashTimer=a.muzzleFlash=a.skeletonTimer=0;resetActorStance(a,stance);return a;
   }
   player=actor(null,'PISTOL');
   const pistol=player3DPose(player),rifle=player3DPose(actor(null,'ASSAULT_RIFLE'));
   const prone=player3DPose(actor(null,'ASSAULT_RIFLE','PRONE'));
   const yellow=player3DPose(actor('NORMAL','ASSAULT_RIFLE')),grey=player3DPose(actor('NM0_GREY_FATIGUE','ASSAULT_RIFLE'));
   const heavy=player3DPose(actor('ARMORED_STANDARD','PISTOL'));
   jetpackUnlocked=true;const jetpack=player3DPose(player);jetpackUnlocked=false;
   const body=new Corpse(0,0,0,0,player.shirtCol,player.pantsCol,0,0,[],WEAPONS.PISTOL,0,'NORMAL',21,27,player);body.fP=1;
   if(body.rag)for(const limb of body.rag.limbs){limb.a=limb.rest;limb.b=limb.restB;}
   const corpse=player3DCorpsePose(body);
   const target=document.createElement('canvas');target.width=target.height=512;const ctx=target.getContext('2d');
   function paint(snapshot,config){
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,512,512);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality=config.filter;
    ctx.save();ctx.translate(256.37,256.21);ctx.rotate(config.rotation||0);ctx.scale(config.mirror?-config.scale:config.scale,config.scale*.93);
    const drawn=Player3D.draw(snapshot,ctx,{view:false,resolutionScale:config.resolution});ctx.restore();
    return {drawn,data:ctx.getImageData(0,0,512,512).data};
   }
   Player3D.maxSize=512;const warm=paint(pistol,{scale:30,resolution:1,filter:'low'});
   const before={uploads:Player3D.stats.meshUploads,buffers:Player3D.stats.bufferCreates,
    readbacks:Player3D.stats.validationReadbacks,resizes:Player3D.stats.resizes};
   const gl=Player3D.gl;
   function backing(r,g,b,a){gl.disable(gl.SCISSOR_TEST);gl.colorMask(true,true,true,true);gl.clearColor(r,g,b,a);gl.clear(gl.COLOR_BUFFER_BIT);}
   const configs=[
    ['pistol-low-resolution',pistol,2.7,.25,'low',0,false],
    ['pistol-fractional',pistol,2.37,1,'low',0,false],
    ['rifle-rotated',rifle,2.6,.75,'low',.33,false],
    ['prone-rotated',prone,2.7,1.5,'medium',1.12,false],
    ['jetpack-mirrored',jetpack,1.3,1,'high',-.41,true],
    ['yellow-infantry',yellow,2.4,1,'low',0,false],
    ['grey-minified',grey,1.75,4,'high',.12,true],
    ['armored-minified',heavy,.65,4,'medium',.55,false],
    ['corpse-rotated',corpse,2.3,1,'low',.8,false],
    ['corpse-small',corpse,.85,1.5,'high',-.5,false]
   ];
   const cases=[];let example=null;
   for(const [name,snapshot,scale,resolution,filter,rotation,mirror]of configs){
    const config={scale,resolution,filter,rotation,mirror};backing(0,0,0,0);const clean=paint(snapshot,config);
    // Adversarial history makes even a one-pixel leaked border unambiguous.
    // It is outside the current actor's requested source rectangle.
    backing(1,0,1,1);const dirty=paint(snapshot,config);
    let changed=0,maxDelta=0,opaque=0;
    for(let i=0;i<clean.data.length;i+=4){let differs=false;for(let k=0;k<4;k++){
     const delta=Math.abs(clean.data[i+k]-dirty.data[i+k]);maxDelta=Math.max(maxDelta,delta);if(delta)differs=true;}
     if(differs)changed++;if(clean.data[i+3]>20)opaque++;
    }
    cases.push({name,...config,drawn:clean.drawn&&dirty.drawn,opaque,changed,maxDelta});
    if(name==='pistol-fractional'){
     const gallery=document.createElement('canvas');gallery.width=1024;gallery.height=512;const c=gallery.getContext('2d');
     c.fillStyle='#585d61';c.fillRect(0,0,1024,512);
     const a=document.createElement('canvas');a.width=a.height=512;const ac=a.getContext('2d');
     ac.putImageData(new ImageData(clean.data,512,512),0,0);c.drawImage(a,0,0);
     ac.putImageData(new ImageData(dirty.data,512,512),0,0);c.drawImage(a,512,0);
     c.fillStyle='#fff';c.font='18px sans-serif';c.fillText('Transparent backing reference',30,35);c.fillText('Previously colored backing',542,35);
     example=gallery.toDataURL();
    }
   }
   // Alternate real silhouettes as well as deliberately colored stale texels.
   let historyChanges=0;
   const small={scale:1.7,resolution:1,filter:'high',rotation:.2};
   backing(0,0,0,0);const reference=paint(pistol,small);
   for(const snapshot of [yellow,corpse,heavy,prone]){
    paint(snapshot,{scale:3.7,resolution:1,filter:'high',rotation:0});const next=paint(pistol,small);
    for(let i=0;i<next.data.length;i++)if(next.data[i]!==reference.data[i])historyChanges++;
   }
   return {warm:warm.drawn,cases,historyChanges,before,after:{uploads:Player3D.stats.meshUploads,
    buffers:Player3D.stats.bufferCreates,readbacks:Player3D.stats.validationReadbacks,resizes:Player3D.stats.resizes},
    contexts:__cropContexts,diagnostics:Player3D.getDiagnostics(),gpuError:gl.getError(),example};
  });
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'copy-comparison.png'),Buffer.from(result.example.split(',')[1],'base64'));delete result.example;
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({...result,errors},null,2));
  assert.deepEqual(errors,[],'no browser exceptions');assert.ok(result.warm);
  for(const row of result.cases){assert.ok(row.drawn&&row.opaque>10,row.name+' renders actual visible geometry');
   assert.equal(row.changed,0,row.name+' contains no pixels from outside the actor crop');}
  assert.equal(result.historyChanges,0,'larger living/dead silhouettes cannot leave lines around a later actor');
  assert.deepEqual(result.after,result.before,'stable alternating draws add no allocations, resizing, or readbacks');
  assert.equal(result.contexts,1,'the renderer keeps its single actual WebGL context');
  assert.equal(result.diagnostics.pipeline.validation,'verified','SPCK output validation remains active');
  assert.equal(result.gpuError,0);
  console.log('Actual character crop/filter isolation, rotation, mirrors, living/dead history, and stable GPU resources passed: '+out+'/report.json');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

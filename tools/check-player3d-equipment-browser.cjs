// Real GPU review of support-hand occlusion and rigid jetpack attachment.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.PLAYER3D_EQUIPMENT_OUT||'/tmp/player3d-equipment-qa';
const source=fs.readFileSync(path.join(root,'game.js'),'utf8');
const p5=fs.readFileSync(process.env.PLAYER3D_P5||'/workspace/.environment/newone/node_modules/p5/lib/p5.min.js','utf8');
fs.mkdirSync(out,{recursive:true});
const bootstrap=`preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(1200,1000);pixelDensity(1);noLoop();window.__ready=true;};`;
async function main(){
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:1000},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://equipment.local/**',r=>{const url=r.request().url();
   if(url.endsWith('/p5.js'))return r.fulfill({contentType:'application/javascript',body:p5});
   if(url.endsWith('/game.js'))return r.fulfill({contentType:'application/javascript',body:source});
   return r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}canvas{display:block}</style><script src="/p5.js"></script><script src="/game.js"></script><script>'+bootstrap+'</script>'});
  });
  await page.goto('http://equipment.local/',{waitUntil:'load'});await page.waitForFunction(()=>window.__ready);
  await page.evaluate(()=>{
   started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inCutscene=inOverworldView=false;
   currentLevel=currentBiome=2;BIOME_ACTIVE=false;window.inNM0SecretOverlay=false;buildGhost=null;
   resetUndergroundRoute();setMeleeTool('NONE');buildings=activeBuildings=[];barrels=[];activeParkingCars=[];enemiesList=[];invalidateColIndex();
   chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
   leftStick={active:false,dx:0,dy:0,dist:0};rightStick={active:false,dx:0,dy:0,dist:0};
   camX=camY=0;zoom=1;viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;
   window.__equipmentFresh=(weapon='ASSAULT_RIFLE',stance='STAND',angle=0)=>{
    const c=new Character(0,0,true);player=c;c.currentWeapon=WEAPONS[weapon];c.isArmed=true;c.aimAngle=angle;c.moveAngle=angle;c.aimHold=14;c.ammo=10000;
    c.isMoving=false;c.gait=0;c.walkCycle=0;c.reloadTimer=c.meleeTimer=c.weaponKick=c.muzzleFlash=c.hitFlash=0;
    resetActorStance(c,stance);if(stance==='PRONE'){c.stance.proneHeading=angle;c.stance.proneAimBlend=1;}
    c._weaponPresentation={value:1,velocity:0,frame:frameCount,weapon:c.currentWeapon};return c;
   };
   window.__equipmentLight={lighting:{direction:[-.5,-.6,.85],contrast:1}};
   window.__equipmentDraw=(s,ctx=drawingContext)=>Player3D.draw(s,ctx,__equipmentLight);
   window.__equipmentMask=(s,filter,options)=>{
    const g=createGraphics(300,300);g.pixelDensity(1);g.clear();g.translate(120,140);g.scale(3);
    Player3D.draw({...s,parts:s.parts.filter(filter)},g.drawingContext,options||__equipmentLight);
    const pixels=g.drawingContext.getImageData(0,0,300,300).data;g.remove();return pixels;
   };
  });
  const report=await page.evaluate(()=>{
   const support=[],pack=[];background(178,187,181);textFont('sans-serif');noStroke();fill(28,42,44);textAlign(CENTER);textSize(20);text('Refined grips and jetpack poses',600,30);
   let card=0;
   const paint=(snapshot,label)=>{const x=150+(card%4)*300,y=145+Math.floor(card/4)*235;push();translate(x,y);scale(3.1);__equipmentDraw(snapshot);pop();fill(28,42,44);textSize(12);text(label,x,y+86);card++;};
   const gripCases=[];for(const [weapon,stance] of [['ASSAULT_RIFLE','STAND'],['SHOTGUN','CROUCH'],['PARTICLE_BEAM','PRONE']])for(const angle of [0,Math.PI/2])gripCases.push([weapon,stance,angle,1]);
   gripCases.push(['ASSAULT_RIFLE','STAND',-.3,0],['ASSAULT_RIFLE','STAND',-.3,.5]);
   for(const [weapon,stance,angle,presentation] of gripCases){
    jetpackUnlocked=false;__equipmentFresh(weapon,stance,angle);player._weaponPresentation.value=presentation;if(presentation===0)player.aimHold=0;
    const s=player3DPose(player),flat={lighting:{direction:[0,0,1],contrast:0}};
    const colored={...s,parts:s.parts.map(p=>p.part==='weapon_primary'?{...p,color:[32,64,255],overrideMaterials:true}:p.part==='hand_left'?{...p,color:[255,32,32],overrideMaterials:true}:p)};
    const gun=__equipmentMask(colored,p=>p.part==='weapon_primary',flat),hand=__equipmentMask(colored,p=>p.part==='hand_left',flat);
    const both=__equipmentMask(colored,p=>p.part==='weapon_primary'||p.part==='hand_left',flat);
    let overlap=0,wrong=0;
    for(let i=0;i<gun.length;i+=4)if(gun[i+3]>245&&hand[i+3]>245&&gun[i+2]>240&&hand[i]>240){overlap++;if(Math.abs(gun[i]-both[i])+Math.abs(gun[i+1]-both[i+1])+Math.abs(gun[i+2]-both[i+2])>25)wrong++;}
    support.push({weapon,stance,angle,presentation,overlap,wrong});paint(s,weapon+' / '+stance+' / '+(presentation===0?'carry':presentation===.5?'raising':Math.round(angle*180/Math.PI)+'°'));
   }
   const specs=[['Standing pack','STAND',0],['Turning pack','STAND',1.3],['Prone pack','PRONE',0],['Prone north','PRONE',-Math.PI/2],['Prone west','PRONE',Math.PI],['Crouched pack','CROUCH',.7]];
   for(const [label,stance,angle] of specs){
    jetpackUnlocked=true;__equipmentFresh('PISTOL',stance,angle);const s=player3DPose(player);
    const marked={...s,parts:s.parts.map(p=>p.part==='jetpack'?{...p,color:[255,0,255],overrideMaterials:true}:p)};
    const full=__equipmentMask(s,()=>true),without=__equipmentMask(marked,()=>true);let changed=0;
    for(let i=0;i<full.length;i+=4)if(Math.abs(full[i]-without[i])+Math.abs(full[i+1]-without[i+1])+Math.abs(full[i+2]-without[i+2])+Math.abs(full[i+3]-without[i+3])>35)changed++;
    pack.push({label,stance,angle,visiblePixels:changed});paint(s,label);
   }
   return {support,pack,gpuError:Player3D.gl.getError(),stats:Player3D.getDiagnostics()};
  });
  await page.screenshot({path:path.join(out,'equipment-poses.png')});
  for(const row of report.support){assert.ok(row.overlap>4,'grip overlaps gun in '+JSON.stringify(row));assert.ok(row.wrong<=Math.max(5,row.overlap*.04),'support palm stays underneath '+JSON.stringify(row));}
  for(const row of report.pack)assert.ok(row.visiblePixels>20,'backpack stays visible in '+JSON.stringify(row));
  assert.equal(report.gpuError,0);
  // Exercise native dive/stand state transitions and torso turning in motion.
  const dir=path.join(out,'motion');fs.mkdirSync(dir,{recursive:true});
  await page.setViewportSize({width:1200,height:560});
  await page.evaluate(()=>{resizeCanvas(1200,560);window.__equipmentActors=[__equipmentFresh('PISTOL'),__equipmentFresh('ASSAULT_RIFLE'),__equipmentFresh('PISTOL')];});
  const dive=[];
  for(let i=0;i<108;i++){
   const frame=await page.evaluate(i=>{
    background(178,187,181);fill(28,42,44);noStroke();textFont('sans-serif');textAlign(CENTER);textSize(17);
    let sample;
    for(let j=0;j<3;j++){
     const c=__equipmentActors[j];player=c;jetpackUnlocked=j===2;
     const a=j===2?-Math.PI/2+Math.sin(i*.035)*1.1:i*.055;c.aimAngle=a;c.moveAngle=a;c.aimHold=14;
     leftStick.active=j===2&&i>=18&&i<60;leftStick.dx=leftStick.active?Math.cos(a)*.65:0;leftStick.dy=leftStick.active?Math.sin(a)*.65:0;
     if(j===2&&i===18)requestPlayerProne();if(j===2&&i===75)requestActorStance(c,'STAND');
     frameCount++;deltaTime=1000/60;c.updatePlayer();c.isArmed=true;c.aimHold=14;
     const s=player3DPose(c);push();translate(200+j*400,290);scale(4);__equipmentDraw(s);pop();
     text(j===0?'Standard pistol head':j===1?'Support hand beneath gun':'Pack through dive and turn',200+j*400,40);
     if(j===2){const marked={...s,parts:s.parts.map(p=>p.part==='jetpack'?{...p,color:[255,0,255],overrideMaterials:true}:p)};
      const before=__equipmentMask(s,()=>true),after=__equipmentMask(marked,()=>true);let changed=0;
      for(let k=0;k<before.length;k+=4)if(Math.abs(before[k]-after[k])+Math.abs(before[k+1]-after[k+1])+Math.abs(before[k+2]-after[k+2])+Math.abs(before[k+3]-after[k+3])>35)changed++;
      sample={frame:i,prone:actorStancePose(c).prone,dive:proneDivePoseActive(c),lift:proneDiveLift(c),visiblePixels:changed};}
    }
    return sample;
   },i);dive.push(frame);
   await page.screenshot({path:path.join(dir,String(i).padStart(3,'0')+'.png')});
  }
  assert.ok(dive.some(f=>f.prone>.95)&&dive.some(f=>f.prone<.05),'native motion includes standing and full prone');
  assert.ok(dive.some(f=>f.dive&&f.lift>10),'native moving dive includes the airborne phase');
  assert.ok(dive.filter(f=>f.prone>.1).every(f=>f.visiblePixels>20),'pack does not disappear during native transition');
  const video=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','24','-i',path.join(dir,'%03d.png'),'-c:v','libx264','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'equipment-motion.mp4')]);assert.equal(video.status,0,String(video.stderr));
  assert.deepEqual(errors,[]);report.nativeTransition=dive;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('GPU support-hand and jetpack refinement checks passed: '+out);
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

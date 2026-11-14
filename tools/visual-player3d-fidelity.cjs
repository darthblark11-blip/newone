// Matched native / first-pass / revised poses, driven by the original controls.
// Writes review images and synchronized native-versus-3D animation frames.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.PLAYER3D_FIDELITY_OUT||'/tmp/player3d-fidelity';
const source=fs.readFileSync(path.join(root,'game.js'),'utf8');
const prior=spawnSync('git',['show','b81a4b2:game.js'],{cwd:root,maxBuffer:12*1024*1024,encoding:'utf8'});
if(prior.status!==0)throw Error('The first-pass reference commit b81a4b2 is required');
const p5=fs.readFileSync(process.env.PLAYER3D_P5||'/workspace/.environment/newone/node_modules/p5/lib/p5.min.js','utf8');
fs.mkdirSync(out,{recursive:true});
const cases=[
 {label:'Walk north; aim right',move:-Math.PI/2,aim:0,throttle:.45,stance:'STAND',weapon:'PISTOL'},
 {label:'Strafe right; aim north',move:0,aim:-Math.PI/2,throttle:.65,stance:'STAND',weapon:'ASSAULT_RIFLE'},
 {label:'Backward run; aim north',move:Math.PI/2,aim:-Math.PI/2,throttle:1,stance:'STAND',weapon:'PISTOL'},
 {label:'Run with carried rifle',move:-Math.PI/2,aim:null,throttle:1,stance:'STAND',weapon:'ASSAULT_RIFLE'},
 {label:'Aim / two-handed grip',move:0,aim:0,throttle:0,stance:'STAND',weapon:'SHOTGUN'},
 {label:'Crouch and strafe',move:0,aim:-Math.PI/2,throttle:.65,stance:'CROUCH',weapon:'ASSAULT_RIFLE'},
 {label:'Prone north / belly',move:-Math.PI/2,aim:-Math.PI/2,throttle:0,stance:'PRONE',weapon:'ASSAULT_RIFLE'},
 {label:'Prone right / elbow',move:-Math.PI/2,aim:0,throttle:0,stance:'PRONE',weapon:'ASSAULT_RIFLE'},
 {label:'Prone south / roll',move:-Math.PI/2,aim:Math.PI/2,throttle:0,stance:'PRONE',weapon:'PISTOL'}
];
const init=`preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(420,1680);pixelDensity(1);noLoop();window.__ready=true;};`;
async function main(){
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 const errors=[];const pages=[];
 try{
  for(const [name,title,body,enabled] of [['native','ORIGINAL 2D',source,false],['first-pass','FIRST 3D PASS',prior.stdout,true],['revised','REVISED 3D',source,true]]){
   const page=await browser.newPage({viewport:{width:420,height:1680},deviceScaleFactor:1});pages.push(page);
   page.on('pageerror',e=>errors.push(name+': '+e.message));
   await page.route('http://fidelity.local/**',r=>{const u=r.request().url();
    if(u.endsWith('/p5.js'))return r.fulfill({contentType:'application/javascript',body:p5});
    if(u.endsWith('/game.js'))return r.fulfill({contentType:'application/javascript',body});
    return r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}canvas{display:block}</style><script src="/p5.js"></script><script src="/game.js"></script><script>'+init+'</script>'});
   });
   await page.goto('http://fidelity.local/',{waitUntil:'load'});await page.waitForFunction(()=>window.__ready);
   await page.evaluate(({enabled,title})=>{
    Player3D.enabled=enabled;
    resetRunState();resetUndergroundRoute();currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inCutscene=inOverworldView=false;
    window.inNM0SecretOverlay=false;buildGhost=null;buildings=activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
    setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
    leftStick={active:false,dx:0,dy:0,dist:0,base:{x:60,y:600}};rightStick={active:false,dx:0,dy:0,dist:0,base:{x:360,y:600}};
    zoom=1;camX=camY=0;viewLeft=viewTop=-100000;viewRight=viewBottom=100000;
    LIGHT_DX=.6;LIGHT_DY=.8;
    window.__fidelityTitle=title;
    window.__fresh=(spec)=>{frameCount=100;let seed=447;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
     player=new Character(0,0,true);player.currentWeapon=WEAPONS[spec.weapon];player.isArmed=true;player.ammo=10000;player.aimHold=0;
     player.aimAngle=player.moveAngle=spec.move;player.gait=0;player.walkCycle=0;player.reloadTimer=player.meleeTimer=player.dashTimer=player.muzzleFlash=player.weaponKick=player.fireTimer=0;
     resetActorStance(player,spec.stance);if(spec.stance==='PRONE')player.stance.proneHeading=spec.move;
     return player;};
    window.__step=(spec)=>{frameCount++;deltaTime=1000/60;
     leftStick.active=spec.throttle>0;leftStick.dx=Math.cos(spec.move)*spec.throttle;leftStick.dy=Math.sin(spec.move)*spec.throttle;leftStick.dist=spec.throttle;
     rightStick.active=spec.aim!==null;rightStick.dx=spec.aim===null?0:Math.cos(spec.aim);rightStick.dy=spec.aim===null?0:Math.sin(spec.aim);rightStick.dist=spec.aim===null?0:.4;rightStick.gamepadInput=false;
     player.updatePlayer();player.ammo=10000;player.reloadTimer=0;};
    window.__paint=(x,y,scaleFactor)=>{const active=rightStick.active;rightStick.active=false;player.aimHold=14;
     push();translate(x,y);scale(scaleFactor);translate(-player.x,-player.y);player.show();pop();rightStick.active=active;};
   },{enabled,title});
   const metrics=await page.evaluate(cases=>{
    background(175,184,179);fill(25,38,42);noStroke();textFont('sans-serif');textAlign(CENTER);textSize(19);text(__fidelityTitle,210,32);textSize(11);text('Same controls, clocks and native pose geometry',210,53);
    const metrics=[];
    cases.forEach((spec,i)=>{__fresh(spec);for(let j=0;j<58;j++)__step(spec);
     if(spec.aim===null){player.isArmed=true;player.aimHold=0;}
     const y=135+i*175;stroke(145,158,152);strokeWeight(1);line(30,y,390,y);noStroke();
     const aimHold=player.aimHold;if(spec.aim===null){const a=rightStick.active;rightStick.active=false;push();translate(210,y);scale(3.3);translate(-player.x,-player.y);player.show();pop();rightStick.active=a;}
     else __paint(210,y,3.3);player.aimHold=aimHold;
     fill(25,38,42);textSize(12);text(spec.label,210,y+76);
     metrics.push({label:spec.label,aim:player.aimAngle,move:player.moveAngle,gait:player.gait,cycle:player.walkCycle,
      lower:standingLowerPose(player)?.angle??null,stance:actorStancePose(player).prone});
    });return metrics;
   },cases);
   await page.screenshot({path:path.join(out,name+'.png')});
   fs.writeFileSync(path.join(out,name+'-poses.json'),JSON.stringify(metrics,null,2));
  }
  const nativeState=JSON.parse(fs.readFileSync(path.join(out,'native-poses.json'),'utf8'));
  const revisedState=JSON.parse(fs.readFileSync(path.join(out,'revised-poses.json'),'utf8'));
  assert.deepEqual(revisedState,nativeState,'renderer changes preserve the native simulation fixtures');
  // Contact sheet uses unchanged controls in all three columns.
  const stacked=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',path.join(out,'native.png'),'-i',path.join(out,'first-pass.png'),'-i',path.join(out,'revised.png'),'-filter_complex','hstack=inputs=3','-frames:v','1',path.join(out,'comparison.png')]);
  assert.equal(stacked.status,0,String(stacked.stderr));
  if(process.env.PLAYER3D_FIDELITY_VIDEO!=='0'){
   const selected=[pages[0],pages[2]],frameDir=path.join(out,'motion');fs.mkdirSync(frameDir,{recursive:true});
   for(const page of selected){await page.setViewportSize({width:600,height:640});await page.evaluate(()=>{resizeCanvas(600,640);__fresh({move:-Math.PI/2,weapon:'ASSAULT_RIFLE',stance:'STAND'});});}
   for(let i=0;i<120;i++){
    const spec={weapon:'ASSAULT_RIFLE',throttle:i<85?.65:0,move:i<40?-Math.PI/2:0,
     aim:i<20?-Math.PI/2:i<40?0:i<60?Math.PI:i<100?-Math.PI/2:0,
     stance:i<60?'STAND':i<85?'CROUCH':'PRONE'};
    for(let p=0;p<selected.length;p++){
     await selected[p].evaluate(({i,spec})=>{
      if(i===60||i===85)requestActorStance(player,spec.stance);
      for(let k=0;k<3;k++)__step(spec);
      background(175,184,179);stroke(155,168,161);strokeWeight(1);for(let x=0;x<width;x+=30)line(x,80,x,height);for(let y=80;y<height;y+=30)line(0,y,width,y);
      noStroke();fill(25,38,42);textAlign(CENTER);textFont('sans-serif');textSize(20);text(__fidelityTitle,300,30);textSize(12);text(spec.stance+' — movement and aim turn independently',300,53);
      __paint(300,330,5);fill(25,38,42);textSize(12);text('Native input and animation clocks; no replacement clips',300,600);
     },{i,spec});
     await selected[p].screenshot({path:path.join(frameDir,(p?'revised-':'native-')+String(i).padStart(3,'0')+'.png')});
    }
   }
   const video=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','20','-i',path.join(frameDir,'native-%03d.png'),'-framerate','20','-i',path.join(frameDir,'revised-%03d.png'),'-filter_complex','hstack=inputs=2','-c:v','libx264','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'native-vs-revised.mp4')]);
   assert.equal(video.status,0,String(video.stderr));
  }
  assert.deepEqual(errors,[]);console.log('Matched native / first-pass / revised review written to '+out);
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

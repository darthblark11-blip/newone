// Real WebGL pinhole view: fixed anatomy/yaw at actual viewport positions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.PLAYER3D_VIEW_OUT||'/tmp/player3d-view-qa';
const source=fs.readFileSync(process.env.GAME_JS||path.join(root,'game.js'),'utf8');
const p5=fs.readFileSync(process.env.PLAYER3D_P5||'/workspace/.environment/newone/node_modules/p5/lib/p5.min.js','utf8');
fs.mkdirSync(out,{recursive:true});
const bootstrap=`preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(1200,900);pixelDensity(1);noLoop();window.__ready=true;};`;

async function main(){
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||String(e)));
  await page.route('http://player3d-view.local/**',r=>{
   const url=r.request().url();
   if(url.endsWith('/p5.js'))return r.fulfill({contentType:'application/javascript',body:p5});
   if(url.endsWith('/game.js'))return r.fulfill({contentType:'application/javascript',body:source});
   const init=url.includes('/world')?'preload=function(){};':bootstrap;
   return r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0;background:#b2bbb5}canvas{display:block}</style><script src="/p5.js"></script><script src="/game.js"></script><script>'+init+'</script>'});
  });
  await page.goto('http://player3d-view.local/',{waitUntil:'load'});await page.waitForFunction(()=>window.__ready);
  await page.evaluate(()=>{
   started=doTick=true;isStoryMode=isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inCutscene=inOverworldView=false;
   currentLevel=currentBiome=2;BIOME_ACTIVE=false;window.inNM0SecretOverlay=false;buildGhost=null;
   resetUndergroundRoute();setMeleeTool('NONE');buildings=activeBuildings=[];barrels=[];activeParkingCars=[];enemiesList=[];invalidateColIndex();
   chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
   leftStick={active:false,dx:0,dy:0,dist:0};rightStick={active:false,dx:0,dy:0,dist:0};
   camX=camY=0;zoom=1;viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;LIGHT_DX=.7;LIGHT_DY=.7;
   window.__viewFresh=(npc=false,angle=0,stance='STAND',armor=false)=>{
    explosiveArmorUnlocked=armor;
    const c=new Character(0,0,!npc,npc?'NM0_ROOKIE_F':'NORMAL');if(!npc)player=c;
    c.isFriendly=c.isNeutral=false;c.state='CHASE';c.isArmed=!npc;c.currentWeapon=WEAPONS.ASSAULT_RIFLE;
    c.aimAngle=c.moveAngle=angle;c.aimHold=14;c.isMoving=false;c.gait=c.walkCycle=c.armDrag=0;c.ammo=100;
    c.reloadTimer=c.meleeTimer=c.muzzleFlash=c.hitFlash=c.weaponKick=c.stunTimer=c.skeletonTimer=0;
    resetActorStance(c,stance);if(stance==='PRONE'){c.stance.proneHeading=angle;c.stance.proneAimBlend=1;}
    if(!npc)c._weaponPresentation={value:1,velocity:0,frame:frameCount,weapon:c.currentWeapon};return c;
   };
   window.__viewPositions=[['top left',200,180],['top',600,180],['top right',1000,180],['left',200,450],['center',600,450],['right',1000,450],['bottom left',200,720],['bottom',600,720],['bottom right',1000,720]];
   window.__viewFlat={lighting:{direction:[-.5,-.6,.85],contrast:1}};
   window.__viewGeometry=s=>JSON.stringify([s.parts,s.sockets,s.pose]);
   window.__viewMarker=(x,y,z,size=3,rotation=0)=>{
    clear();push();translate(x,y);rotate(rotation);scale(size);
    const matrix=new Float32Array([.8,0,0,0,0,.8,0,0,0,0,.8,0,0,0,z,1]);
    const s={parts:[{part:'marker',mesh:'head',color:[255,0,255],overrideMaterials:true,matrix}],sockets:{marker:{x:0,y:0,z}}};
    const drawn=Player3D.draw(s,drawingContext,{view:true,outline:false,lighting:{direction:[0,0,1],contrast:0}}),m=drawingContext.getTransform(),v=s.renderView;
    const p=Player3DView.project({x:0,y:0,z},v),independent={x:v.offsetX*(z-v.pivotZ)/(v.height-z+v.pivotZ),y:v.offsetY*(z-v.pivotZ)/(v.height-z+v.pivotZ)};
    const expected={x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f};pop();
    const density=pixelDensity(),pixels=drawingContext.getImageData(0,0,width*density,height*density).data;
    let weight=0,cx=0,cy=0,count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>220&&pixels[i+1]<30&&pixels[i+2]>220&&pixels[i+3]>20){
     const a=pixels[i+3]/255,k=i/4;weight+=a;cx+=(k%(width*density)+.5)*a;cy+=(Math.floor(k/(width*density))+.5)*a;count++;
    }
    return {drawn,x,y,z,size,rotation,density,view:v,pixels:count,expected:{x:expected.x/density,y:expected.y/density},actual:{x:cx/weight/density,y:cy/weight/density},cpuError:Math.hypot(p.x-independent.x,p.y-independent.y),socketError:Math.hypot(s.projectedSockets.marker.x-p.x,s.projectedSockets.marker.y-p.y)};
   };
  });
  const report={gallery:[],markers:[]};
  const cases=[['player-east','Player facing +X',false,0,'STAND',false],['player-west','Player facing −X',false,Math.PI,'STAND',false],
   ['enemy-east','Rookie facing +X',true,0,'STAND',false],['enemy-west','Rookie facing −X',true,Math.PI,'STAND',false],
   ['player-prone','Prone player facing +X',false,0,'PRONE',false],['enemy-crouch','Crouched rookie facing +X',true,0,'CROUCH',false],
   ['player-armor','Armored player facing +X',false,0,'STAND',true],['player-away','Player facing away toward upper right',false,-Math.PI/4,'STAND',false]];
  for(const spec of cases){
   const result=await page.evaluate(spec=>{
    const [id,title,npc,angle,stance,armor]=spec,c=__viewFresh(npc,angle,stance,armor),s=player3DPose(c),before=__viewGeometry(s),rows=[];
    background(178,187,181);textFont('sans-serif');textAlign(CENTER);noStroke();fill(28,42,44);textSize(22);text(title+' · identical pose and world yaw',600,32);
    for(const [label,x,y]of __viewPositions){
     push();translate(x,y);scale(3);stroke(90,110,105,100);strokeWeight(.5);line(-7,0,7,0);line(0,-7,0,7);
     const drawn=Player3D.draw(s,drawingContext,{...__viewFlat,view:true}),v=s.renderView,p={...s.projectedSockets.head};pop();
     noStroke();fill(28,42,44);textSize(13);text(label,x,y+100);
     rows.push({label,x,y,drawn,head:p,rawHead:{...s.sockets.head},view:{...v},unchanged:__viewGeometry(s)===before});
    }
    return {id,npc,stance,angle,rows,gpuError:Player3D.gl.getError()};
   },spec);
   report.gallery.push(result);await page.screenshot({path:path.join(out,spec[0]+'.png')});
   for(const row of result.rows){assert.ok(row.drawn&&row.view.enabled&&row.unchanged,'view changes no anatomy '+result.id+'/'+row.label);}
   const left=result.rows[3],center=result.rows[4],right=result.rows[5];
   assert.ok(left.head.x-left.rawHead.x<center.head.x-center.rawHead.x-.2&&right.head.x-right.rawHead.x>center.head.x-center.rawHead.x+.2,'screen position reveals a different profile '+result.id);
   assert.equal(result.gpuError,0);
  }
  const montage=spawnSync('python3',['-c',"from PIL import Image\nimport sys\nroot=sys.argv[1]; names=sys.argv[2:]\ncanvas=Image.new('RGB',(1200,1800))\nfor i,name in enumerate(names):\n im=Image.open(root+'/'+name+'.png').convert('RGB'); im.thumbnail((600,450)); canvas.paste(im,((i%2)*600,(i//2)*450))\ncanvas.save(root+'/view-contact-sheet.png')",out,...cases.map(s=>s[0])]);assert.equal(montage.status,0,String(montage.stderr));
  report.orthographic=await page.evaluate(()=>{
   const c=__viewFresh(),s=player3DPose(c),rows=[];
   for(const x of [200,1000]){push();translate(x,450);scale(3);Player3D.draw(s,drawingContext,__viewFlat);pop();rows.push({view:s.renderView,head:{...s.projectedSockets.head},raw:{...s.sockets.head}});}
   const g=createGraphics(300,300);g.translate(150,150);g.scale(2);Player3D.draw(s,g.drawingContext,{...__viewFlat,view:true});const graphicsView=s.renderView;g.remove();return {rows,graphicsView};
  });
  for(const row of  report.orthographic.rows){assert.equal(row.view,null);assert.deepEqual(row.head,{...row.raw,w:1});}
  assert.equal(report.orthographic.graphicsView,null,'implicit world view does not affect Graphics stamps');
  for(const density of [1,2]){
   await page.evaluate(d=>{pixelDensity(d);resizeCanvas(1200,900);},density);
   for(const spec of [[200,180,30,3,0],[1000,720,30,3,0],[600,450,50,3,0],[400,300,70,8,0],[800,600,70,8,0],[1000,180,45,2.3,.38]]){
    const row=await page.evaluate(spec=>__viewMarker(...spec),spec);report.markers.push(row);
    assert.ok(row.drawn&&row.pixels>3,'marker survives the projected sprite bounds '+JSON.stringify(spec));
    assert.ok(Math.hypot(row.expected.x-row.actual.x,row.expected.y-row.actual.y)<1.5,'GPU marker matches CPU projection '+JSON.stringify(row));
    assert.ok(row.cpuError<1e-8&&row.socketError<1e-8,'published projected socket uses the same camera');
   }
  }
  for(let i=0;i<6;i++)assert.ok(Math.hypot(report.markers[i].actual.x-report.markers[i+6].actual.x,report.markers[i].actual.y-report.markers[i+6].actual.y)<1,'logical camera angle does not change at DPR2');
  await page.evaluate(()=>{pixelDensity(1);resizeCanvas(1200,900);});
  assert.deepEqual(errors,[],'no browser errors during projection checks');
  if(process.env.VIEW_DIRECT_ONLY){fs.writeFileSync(path.join(out,'direct-report.json'),JSON.stringify(report,null,2));console.log('Finite view direct GPU checks passed: '+out);return;}

  report.living=await page.evaluate(()=>{
   const rows=[];for(const npc of[false,true])for(const [x,y]of[[200,180],[1000,720]]){
    const c=__viewFresh(npc);clear();push();translate(x,y);scale(3);c.show();const s=player3DLiveSnapshot(c),m=drawingContext.getTransform();pop();
    rows.push({npc,x,y,view:s&&s.renderView,head:s&&s.projectedSockets.head,muzzle:s&&s.projectedSockets.muzzle,raw:s&&s.sockets.muzzle,actorIsPlayer:c.isPlayer});
   }return rows;
  });
  for(const row of  report.living)assert.ok(row.view&&row.view.enabled,'actual living dispatch opts into finite camera');
  report.attachments=await page.evaluate(()=>{
   const rows=[],oldHair=drawFigureHair,oldFill=fill,oldTriangle=triangle,oldBegin=beginShape;
   let hair=[],flash=[],lastFill=[];
   drawFigureHair=function(...args){const m=drawingContext.getTransform();hair.push({x:m.e,y:m.f});return oldHair(...args);};
   window.fill=function(...args){lastFill=args;return oldFill(...args);};
   const capture=()=>{const m=drawingContext.getTransform();flash.push({x:m.e,y:m.f});};
   window.triangle=function(...args){if(lastFill[0]===255&&lastFill[1]===218&&lastFill[2]===90)capture();return oldTriangle(...args);};
   window.beginShape=function(...args){if(lastFill[0]===255&&lastFill[1]===200&&lastFill[2]===0)capture();return oldBegin(...args);};
   try{for(const npc of[false,true])for(const [x,y]of[[200,180],[1000,720]]){
    const c=__viewFresh(npc);c.muzzleFlash=3;hair=[];flash=[];clear();push();translate(x,y);scale(3);c.show();
    const s=player3DLiveSnapshot(c),m=drawingContext.getTransform(),toScreen=p=>({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f});pop();
    const head=toScreen(s.projectedSockets.head),muzzle=toScreen(s.projectedSockets.muzzle);
    rows.push({npc,x,y,hairCalls:hair.length,flashCalls:flash.length,
     hairError:hair.length?Math.min(...hair.map(p=>Math.hypot(p.x-head.x,p.y-head.y))):null,
     flashError:flash.length?Math.min(...flash.map(p=>Math.hypot(p.x-muzzle.x,p.y-muzzle.y))):null});
   }}finally{drawFigureHair=oldHair;window.fill=oldFill;window.triangle=oldTriangle;window.beginShape=oldBegin;}
   return rows;
  });
  for(const row of report.attachments){
   assert.ok(row.flashCalls&&row.flashError<.01,'actual muzzle flash uses the projected muzzle '+JSON.stringify(row));
   if(row.npc)assert.ok(row.hairCalls&&row.hairError<.01,'actual native hair follows the projected head '+JSON.stringify(row));
  }
  report.projectiles=await page.evaluate(()=>{
   const rows=[];for(const npc of[false,true])for(const angle of [0,Math.PI,-.65]){
    const c=__viewFresh(npc,angle);c.x=120;c.y=95;clear();push();scale(3);translate(125,100);c.show();
    const s=player3DLiveSnapshot(c),muzzle=aimLaserMuzzle(c),b=new Bullet();b.init(muzzle.x,muzzle.y,angle,c.isPlayer,'BODY',c.currentWeapon,c,true);
    const view=player3DProjectileView(b),p=player3DProjectilePoint(b,b.startX,b.startY,view,{}),expected=s.projectedSockets.muzzle;
    rows.push({npc,angle:angle,launch:!!b._player3DLaunch,error:Math.hypot(p.x-c.x-expected.x,p.y-c.y-expected.y)});pop();
   }return rows;
  });
  for(const row of  report.projectiles)assert.ok(row.launch&&row.error<.05,'native projectile launch meets projected muzzle '+JSON.stringify(row));
  const motion=path.join(out,'motion');fs.mkdirSync(motion,{recursive:true});await page.setViewportSize({width:1200,height:650});
  await page.evaluate(()=>{resizeCanvas(1200,650);window.__viewActors=[__viewFresh(false,0),__viewFresh(true,Math.PI)];});
  report.motion=[];
  const uploads=await page.evaluate(()=>({uploads:Player3D.stats.meshUploads,programs:Player3D.stats.programCreates}));
  for(let i=0;i<60;i++){
   report.motion.push(await page.evaluate(i=>{
    frameCount++;background(178,187,181);textFont('sans-serif');textAlign(CENTER);noStroke();fill(28,42,44);textSize(20);text(i<40?'Fixed world facing · walk across viewport':'Fixed world facing · camera pans',600,35);
    const pan=i<40?0:(i-39)*30,screen=100+Math.min(i,39)*23+(i>=40?(i-39)*6:0)-pan,rows=[];
    for(let j=0;j<2;j++){
     const c=__viewActors[j];c.x=(screen+pan)/2.6;c.y=(j?455:225)/2.6;c.isMoving=true;c.gait=.65;c.walkCycle=i*.25;c.aimAngle=j?Math.PI:0;c.moveAngle=0;
     c.muzzleFlash=i%20<3?3:0;push();scale(2.6);translate(-pan/2.6,0);c.show();const s=player3DLiveSnapshot(c);pop();
     rows.push({npc:j===1,angle:c.aimAngle,view:s&&s.renderView,screenX:screen});
    }
    noStroke();fill(28,42,44);textSize(14);text('Player · facing +X',600,325);text('Rookie · facing −X · native hair',600,600);return rows;
   },i));
   await page.screenshot({path:path.join(motion,String(i).padStart(3,'0')+'.png')});
  }
  for(const rows of  report.motion)for(const row of  rows)assert.ok(row.view&&row.view.enabled&&row.angle===(row.npc?Math.PI:0),'motion camera never changes world facing');
  const video=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate','24','-i',path.join(motion,'%03d.png'),'-c:v','libx264','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'view-motion.mp4')]);assert.equal(video.status,0,String(video.stderr));
  const after=await page.evaluate(()=>({uploads:Player3D.stats.meshUploads,programs:Player3D.stats.programCreates,gpuError:Player3D.gl.getError()}));
  assert.equal(after.uploads,uploads.uploads,'camera movement reuses mesh buffers');assert.equal(after.programs,uploads.programs,'camera movement reuses the same GPU program');assert.equal(after.gpuError,0);report.reuse={before:uploads,after};
  await page.goto('http://player3d-view.local/world',{waitUntil:'load'});await page.waitForFunction(()=>typeof width==='number'&&width>0&&!!document.querySelector('canvas'));
  report.world=await page.evaluate(()=>{
   noLoop();randomSeed(7);noiseSeed(BIOME_SEED);isStoryMode=true;started=true;isDead=isWin=isPaused=false;window.outpostForts={};seedWorldClock();startAtLevel(3);
   inStoryIntro=inStoryRoom=killcamMode=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=inTravelMenu=inOverworldView=false;
   window.showOnScreenControls=false;window.isDesktop=true;leftStick.active=rightStick.active=false;
   player.x=1300;player.y=-1730;player.aimAngle=0;player.isArmed=true;player.aimHold=14;
   const types=['NM0_ROOKIE','NM0_ROOKIE_F','ARMORED_STANDARD','BANDIT'],positions=[[-230,-145],[230,-145],[-230,145],[230,145],[-200,0],[200,0],[0,-140],[0,140]];
   enemiesList=positions.map(([dx,dy],i)=>{const c=new Character(player.x+dx,player.y+dy,false,types[i%4]);c.isFriendly=c.isNeutral=false;c.isArmed=false;c.state='CHASE';c.aimAngle=c.moveAngle=0;c.currentWeapon=WEAPONS.ASSAULT_RIFLE;return c;});
   worldTimeMs=13/24*DAY_MS;updateSunVector();chunkMgr.update(player.x,player.y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();lastActiveUpdate=-100;updateActiveWorld();
   const before=Player3D.stats.draws;for(let i=0;i<3;i++){zoom=(1.7-.065)/.9;camX=player.x-width/3.4;camY=player.y-height/3.4;frameCount++;draw();}
   return {meshDraws:Player3D.stats.draws-before,fault:window.FRAME_FAULT||null,stats:Player3D.getDiagnostics()};
  });
  await page.screenshot({path:path.join(out,'view-in-game.png')});assert.ok(report.world.meshDraws>6&&!report.world.fault,'real world corner actors render without frame faults');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,gallery:report.gallery.length,markers:report.markers.length,living:report.living,projectiles:report.projectiles,reuse:report.reuse,world:report.world},null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

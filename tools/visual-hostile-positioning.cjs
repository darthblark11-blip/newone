// Replay the real deterministic cohort snapshots with the game's actual human
// meshes. The simulation and work counts come from check-hostile-positioning.js.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.HOSTILE_POSITION_OUT||'/tmp/hostile-positioning-qa';
const report=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8'));
const game=fs.readFileSync(process.env.GAME_JS||path.join(root,'game.js'),'utf8');
const p5=fs.readFileSync(process.env.PLAYER3D_P5||'/workspace/.environment/newone/node_modules/p5/lib/p5.min.js','utf8');
async function main(){
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||String(e)));
  await page.route('http://hostile-position.local/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/p5.js')return route.fulfill({contentType:'application/javascript',body:p5});
   if(url.pathname==='/game.js')return route.fulfill({contentType:'application/javascript',body:game});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0;background:#263137}</style><script src="/p5.js"></script><script src="/game.js"></script><script>preload=function(){};setup=function(){createCanvas(1440,900);pixelDensity(1);noLoop();window.__ready=true;};draw=function(){};windowResized=function(){};</script>'});
  });
  await page.goto('http://hostile-position.local/');await page.waitForFunction(()=>window.__ready);
  const result=await page.evaluate(report=>{
   currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
   isPaused=isDead=isWin=killcamMode=false;inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inCutscene=false;
   inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
   leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
   resetUndergroundRoute();setMeleeTool('NONE');
   chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
   buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];
   camX=camY=0;zoom=1;viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
   worldTimeMs=DAY_MS/2;updateSunVector();frameCount=700;
   player=new Character(0,0,true);player.isArmed=true;player.currentWeapon=WEAPONS.PISTOL;player.aimAngle=0;
   background(39,52,56);noStroke();fill(239,232,207);textFont('sans-serif');textAlign(LEFT,TOP);textSize(26);
   text('Enemy approach positions',30,22);fill(172,190,184);textSize(15);
   text('Controlled open-field fixture: 64 human gunners, native movement and body separation, eight firing places',30,61);
   const draws=Player3D.stats.draws;
   function panel(name,row,col){
    const px=col*720;noStroke();fill(76,88,89);rect(px+18,102,684,688,10);
    drawingContext.save();drawingContext.beginPath();drawingContext.rect(px+18,102,684,688);drawingContext.clip();
    push();translate(px+360,420);scale(.65);
    noFill();stroke(135,148,143,55);strokeWeight(1.2);drawingContext.setLineDash([8,10]);
    ellipse(0,0,800,800);drawingContext.setLineDash([]);
    stroke(121,137,130,40);for(let k=-450;k<=450;k+=100){line(k,-450,k,450);line(-450,k,450,k);}
    const actors=row.positions.map(([x,y],i)=>{
     const a=new Character(x,y,false,'NORMAL');a.isFriendly=a.isNeutral=false;a.isArmed=true;
     a.currentWeapon=WEAPONS.PISTOL;a.ammo=17;a.state='CHASE';a.isMoving=false;a.aimHold=14;
     a.aimAngle=a.moveAngle=Math.atan2(-y,-x);a.walkCycle=i*.23;a.gait=0;
     a.reloadTimer=a.meleeTimer=a.muzzleFlash=a.stunTimer=a.hitFlash=0;return a;
    });
    actors.sort((a,b)=>a.y-b.y);
    for(const a of actors){
     fill(14,22,23,75);noStroke();ellipse(a.x,a.y+6,25,19);
     push();translate(a.x,a.y);const drawn=Player3D.draw(player3DPose(a),drawingContext,{view:false});pop();
     if(!drawn)throw Error('Human mesh failed during positioning preview');
    }
    fill(0,0,0,75);ellipse(0,4,27,20);push();
    if(!Player3D.draw(player3DPose(player),drawingContext,{view:false}))throw Error('Player mesh failed');pop();
    noFill();stroke(241,230,183,200);strokeWeight(2);ellipse(0,0,45,45);
    pop();drawingContext.restore();
    noStroke();fill(238,230,201);textSize(22);text(name,px+34,119);
    fill(202,215,207);textSize(15);
    text(row.pairs44+' close body pairs · '+Math.round(row.nearestMedian)+' unit median spacing',px+34,746);
    text(row.work.collision.toLocaleString()+' collision probes in the final 240 frames',px+34,767);
   }
   panel('Previous pursuit',report.baseline.settled,0);panel('Shared approach positions',report.revised.settled,1);
   noStroke();fill(176,194,185);textSize(14);
   text('Geometry replay of measured positions. This image does not measure phone FPS.',30,828);
   return {draws:Player3D.stats.draws-draws,diagnostics:Player3D.getDiagnostics()};
  },report);
  assert.equal(result.draws,130,'both measured cohorts and players use actual game meshes');
  assert.equal(result.diagnostics.pipeline.validation,'verified','the working character transfer path remains verified');
  assert.deepEqual(errors,[],'no browser errors in positioning preview');
  await page.locator('#defaultCanvas0').screenshot({path:path.join(out,'before-after.png')});
  fs.writeFileSync(path.join(out,'visual-report.json'),JSON.stringify({result,errors},null,2));
  console.log('Actual human/player model preview of measured crowd positions passed: '+out+'/before-after.png');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});

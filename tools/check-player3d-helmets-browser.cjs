// Real GPU inspection of military helmets at their actual runtime mounts.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.PLAYER3D_HELMET_OUT||'/tmp/player3d-helmet-qa';
const source=fs.readFileSync(process.env.GAME_JS||path.join(root,'game.js'),'utf8');
const p5=fs.readFileSync(process.env.PLAYER3D_P5||'/workspace/.environment/newone/node_modules/p5/lib/p5.min.js','utf8');
const baseline=process.env.PLAYER3D_HELMET_BASELINE;
fs.mkdirSync(out,{recursive:true});
const bootstrap=`preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(1000,980);pixelDensity(1);noLoop();window.__ready=true;};`;
async function capture(browser,name,body){
 const page=await browser.newPage({viewport:{width:1000,height:980}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://helmets.local/**',r=>{
  const u=r.request().url();
  if(u.endsWith('/p5.js'))return r.fulfill({contentType:'application/javascript',body:p5});
  if(u.endsWith('/game.js'))return r.fulfill({contentType:'application/javascript',body});
  return r.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}canvas{display:block}</style><script src="/p5.js"></script><script src="/game.js"></script><script>'+bootstrap+'</script>'});
 });
 try{
  await page.goto('http://helmets.local/',{waitUntil:'load'});await page.waitForFunction(()=>window.__ready);
  const result=await page.evaluate(name=>{
   started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inCutscene=inOverworldView=false;
   currentLevel=currentBiome=2;BIOME_ACTIVE=false;window.inNM0SecretOverlay=false;buildGhost=null;setMeleeTool('NONE');
   leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0};viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;
   background(175,185,179);textFont('sans-serif');textAlign(CENTER);fill(22,38,40);noStroke();textSize(20);text(name==='after'?'Rigid helmet runtime poses':'Previous helmet runtime poses',500,28);
   const light={lighting:{direction:[-.4,-.5,.85],contrast:1}},cases=[],exposure=[];let index=0;
   const view=snapshot=>{
    // Inspect the opening from the front, slightly above eye height. The
    // overhead game view naturally sees the crown instead of the whole face.
    const center=snapshot.sockets.head,a=-1.35,b=0,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
    return {...snapshot,parts:snapshot.parts.filter(p=>['head','helmet','headwear','neck'].includes(p.part)).map(p=>{
     const m=Array.from(p.matrix);m[12]-=center.x;m[13]-=center.y;m[14]-=center.z;
     for(const k of [0,4,8,12]){const x=m[k],y=m[k+1],z=m[k+2],u=ca*x+sa*z,v=-sa*x+ca*z;
      m[k]=u;m[k+1]=cb*y-sb*v;m[k+2]=sb*y+cb*v;}
     return {...p,matrix:new Float32Array(m)};
    })};
   };
   const skinPixels=snapshot=>{
    const g=createGraphics(220,220);g.pixelDensity(1);g.clear();g.translate(110,110);g.scale(7);
    Player3D.draw(snapshot,g.drawingContext,light);const pixels=g.drawingContext.getImageData(0,0,220,220).data;g.remove();
    let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>200&&pixels[i]>pixels[i+1]*1.22&&pixels[i+1]>pixels[i+2]*1.12)count++;
    return count;
   };
   const paint=(type,isPlayer,military,armor,stance,angle,label,oblique=false,hp=100)=>{
    explosiveArmorUnlocked=armor;ninjaSuitUnlocked=cowboySuitEquipped=chemistSuitUnlocked=jetpackUnlocked=false;
    const c=new Character(0,0,isPlayer,type);player=c;c.isMilitary=military;c.isArmed=isPlayer;c.currentWeapon=WEAPONS.PISTOL;c.hp=hp;
    c.aimAngle=c.moveAngle=angle;c.aimHold=14;c.gait=0;c.isMoving=false;c.reloadTimer=c.meleeTimer=c.hitFlash=0;
    resetActorStance(c,stance);let snapshot=player3DPose(c);if(oblique)snapshot=view(snapshot);
    const x=125+(index%4)*250,y=160+Math.floor(index/4)*300,before=Player3D.stats.draws;
    push();translate(x,y);scale(oblique?7:3.3);
    const drawn=Player3D.draw(snapshot,drawingContext,light);pop();
    fill(22,38,40);noStroke();textSize(12);text(label,x,y+110);index++;
    cases.push({label,drawn,meshDraws:Player3D.stats.draws-before,isArmed:c.isArmed,helmet:snapshot.parts.some(p=>p.mesh==='helmet')});
    if(oblique&&hp>50){
     const bare={...snapshot,parts:snapshot.parts.filter(p=>p.part==='head')},full=skinPixels(snapshot),reference=skinPixels(bare);
     exposure.push({label,visibleSkin:full,bareSkin:reference,fraction:full/Math.max(1,reference)});
    }
   };
   for(const [a,l]of [[0,'east'],[-Math.PI/2,'north'],[Math.PI,'west'],[Math.PI/2,'south']])paint('MILITARY_NEUTRAL',false,true,false,'STAND',a,'Army '+l+' / native unarmed flag');
   paint('NORMAL',true,false,true,'STAND',0,'Armored player');paint('NORMAL',true,false,true,'CROUCH',0,'Armored crouch');
   paint('NM0_CITY_GUARD',false,false,false,'STAND',0,'NM0 city / native unarmed flag');paint('ARMORED_STANDARD',false,false,false,'STAND',0,'Heavy guard / native unarmed flag');
   paint('MILITARY_NEUTRAL',false,true,false,'STAND',0,'Army front opening',true);paint('NORMAL',true,false,true,'STAND',0,'Armor front opening',true);
   paint('ARMORED_STANDARD',false,false,false,'STAND',0,'Guard front opening',true);paint('ARMORED_STANDARD',false,false,false,'STAND',0,'Guard / broken helmet',true,50);
   return {cases,exposure,gpuError:Player3D.gl.getError(),stats:{...Player3D.stats}};
  },name);
  await page.screenshot({path:path.join(out,name+'.png')});assert.deepEqual(errors,[]);return result;
 }finally{await page.close();}
}
async function main(){
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader']});
 try{
  const after=await capture(browser,'after',source),report={after};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  assert.equal(after.gpuError,0);assert.ok(after.cases.every(c=>c.drawn&&c.meshDraws>0),'actual runtime snapshots render through WebGL');
  assert.ok(after.cases.filter(c=>/unarmed flag/.test(c.label)).every(c=>c.isArmed===false),'NPC default native unarmed flag remains unchanged');
  assert.ok(!after.cases.find(c=>/broken helmet/.test(c.label)).helmet,'damaged guard removes its shell');
  for(const row of after.exposure)assert.ok(row.fraction>.25,'face remains exposed beneath the helmet: '+JSON.stringify(row));
  if(baseline){
   report.before=await capture(browser,'before',fs.readFileSync(baseline,'utf8'));
   const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',path.join(out,'before.png'),'-i',path.join(out,'after.png'),'-filter_complex','hstack=inputs=2','-frames:v','1',path.join(out,'before-after.png')]);
   assert.equal(result.status,0,String(result.stderr));
  }
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});

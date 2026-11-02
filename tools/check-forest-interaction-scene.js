// Real phone-sized p5 scene: pass through a bush, walk into/around a log,
// chop generated timber with the actual melee input, collect and save its wood.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const deps=process.env.VIS_DEPS||'/workspace/onboarding-newone';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'..','game.js'),'utf8');
const p5=fs.readFileSync(process.env.VIS_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.FOREST_INTERACTION_OUT||path.join(__dirname,'..','work','forest-interaction','scene');
const timberSpecies=(process.env.FOREST_INTERACTION_KINDS||'LOG,STUMP').split(',').filter(k=>k==='LOG'||k==='STUMP');
fs.mkdirSync(out,{recursive:true});
const fixture=`
window.preload=function(){};
window.setup=function(){createCanvas(540,975);pixelDensity(1);noLoop();randomSeed(7);noiseSeed(BIOME_SEED);
 leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};window.__ready=true;};
window.__prepareScene=function(){
 isStoryMode=false;started=true;isPaused=false;startAtLevel(2);
 isDead=isWin=killcamMode=false;inStoryIntro=inStoryRoom=inTownCutscene=inDarchonCall=false;
 inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=false;
 inWorldBuildingMenu=inOverworldView=inTravelMenu=false;
 nm0AmbushActive=false;darchonCallCompleted=true;objectiveTimer=0;MAX_KILLS=1000000;
 enemiesList=[];townCitizens=[];bullets=[];particles=[];
 refreshPopulation=function(){};refreshCityPeople=function(){};
 resetForestWildlife();_wildlifeSpawnClock=1e9;
 worldTimeMs=14/24*DAY_MS;isRaining=false;weather=null;updateSunVector();
 GLRig.on=false;GLRig.failure=GLRIG_SHED_MSG;window.isDesktop=false;
 player.maxHp=player.hp=1e8;player.shield=100;
 window.resources={WOOD:0,METAL:0,STONE:0};resourceDrops=[];
 window.__faults=[];const note=noteFrameFault;
 noteFrameFault=function(where,error){window.__faults.push(where+': '+error.message);return note(where,error);};
 window.__place=function(x,y){
  player.x=x;player.y=y;player.forceNudge();targetZoom=zoom=.65;
  camX=player.x-width/2/zoom;camY=player.y-height/2/zoom;
  viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;
  chunkMgr.update(x,y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();
  activeBuildings=buildings;invalidateColIndex();resetForestBrushInteractions();
 };
 window.__frame=function(dx=0,dy=0,melee=false){
  leftStick.active=!!(dx||dy);leftStick.dx=dx;leftStick.dy=dy;
  rightStick.active=false;rightStick.dist=rightStick.dx=rightStick.dy=0;
  meleeInputHeld=melee;deltaTime=1000/60;redraw();
 };
 window.__place(15000,6600);window.__frame();
};
window.__chooseBush=function(){
 for(const ch of chunkMgr.chunks.values())for(const d of ch.decor){
  if(d.forestSpecies!=='BUSH'||Math.hypot(d.x-15000,d.y-6600)>1500)continue;
  for(const a of [0,Math.PI/2,Math.PI/4,-Math.PI/4]){
   const nx=Math.cos(a),ny=Math.sin(a);let clear=true;
   for(let t=-100;t<=100;t+=10)if(player.checkCol(d.x+nx*t,d.y+ny*t)){clear=false;break;}
   if(!clear)continue;
   window.__bush=d;
   window.__bushDirection={x:nx,y:ny};window.__place(d.x-nx*100,d.y-ny*100);window.__frame();
   window.__bushRoot={x:d.x,y:d.y,source:JSON.stringify(d)};
   return {x:d.x,y:d.y,s:d.s,angle:a,start:{x:player.x,y:player.y},blocked:player.checkCol(d.x,d.y)};
  }
 }
 throw Error('No generated bush with a clear walk-through route');
};
window.__brushStep=function(){
 const d=window.__bush,n=window.__bushDirection;window.__frame(n.x*.85,n.y*.85);
 const s=forestBrushState(d);
 return {progress:(player.x-d.x)*n.x+(player.y-d.y)*n.y,
  bend:s?Math.hypot(s.x,s.y):0,contacts:_forestBrushStats.contacts,active:_forestBrushStats.active,
  root:{x:d.x,y:d.y},player:{x:player.x,y:player.y}};
};
window.__chooseTimber=function(species){
 const found=activeBuildings.filter(b=>b.isForestTimber&&b.forestSpecies===species);
 for(const b of found){
  if(activeBuildings.some(s=>s!==b&&harvestProfile(s)&&Math.hypot(s.x-b.x,s.y-b.y)<145))continue;
  const a=b.forestTimberAngle||0,n={x:-Math.sin(a),y:Math.cos(a)},v={x:Math.cos(a),y:Math.sin(a)};
  if(player.checkCol(b.x+n.x*95,b.y+n.y*95))continue;
  window.__wood=b;window.__woodNormal=n;window.__woodAxis=v;window.__woodKey=b.chunkKey;
  window.__woodRoot={x:b.x,y:b.y};window.__worth=harvestProfile(b).yield;
  window.__place(b.x+n.x*95,b.y+n.y*95);window.__frame();
  return {key:b.chunkKey,species,x:b.x,y:b.y,yield:window.__worth,
   hp:harvestProfile(b).hp,centerBlocked:player.checkCol(b.x,b.y)};
 }
 throw Error('No isolated generated '+species+' fixture in streamed forest');
};
window.__woodState=function(){
 const key=window.__woodKey,b=window.__wood;
 let resident=0,art=0;
 for(const ch of chunkMgr.chunks.values()){
  resident+=ch.solid.filter(s=>s.chunkKey===key).length;
  art+=ch.decor.filter(d=>d.forestSolidKey===key).length;
 }
 return {hp:harvestProfile(b).hp,world:buildings.some(s=>s.chunkKey===key),
  active:activeBuildings.some(s=>s.chunkKey===key),resident,art,
  remembered:!!getBiomeState(2).destroyed[key],bank:resourceCount('WOOD'),
  drops:resourceDrops.filter(d=>d.kind==='WOOD').reduce((a,d)=>a+d.qty,0),
  blocked:player.checkCol(b.x,b.y)};
};
`;
const html='<!doctype html><style>html,body{margin:0;background:#17251b}</style><script>'+
 '(function(){const m={};Object.defineProperty(window,"localStorage",{value:{getItem:k=>m[k]||null,setItem:(k,v)=>m[k]=String(v),removeItem:k=>delete m[k]}});})();'+
 '</script><script>'+p5+'</script><script>'+source+'</script><script>'+fixture+'</script>';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:540,height:975}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.setContent(html,{waitUntil:'load'});
  await page.waitForFunction(()=>window.__ready===true);await page.evaluate(()=>window.__prepareScene());
  const bush=await page.evaluate(()=>window.__chooseBush());assert.equal(bush.blocked,false);
  await page.screenshot({path:path.join(out,'bush-before.png')});
  let peak=0,maxActive=0,last,frames=0;
  for(;frames<100;frames++){
   last=await page.evaluate(()=>window.__brushStep());peak=Math.max(peak,last.bend);maxActive=Math.max(maxActive,last.active);
   if(last.bend>.6&&frames%5===0)await page.screenshot({path:path.join(out,'bush-brushed.png')});
   if(last.progress>100)break;
  }
  assert(last.progress>100,'native movement should cross through the bush');
  assert(peak>.6,'actual player contact should visibly bend the foliage');
  assert(maxActive<=32,'brush response should retain a bounded active set');
  const settled=await page.evaluate(()=>{
   for(let i=0;i<180;i++)window.__frame();const d=window.__bush,s=forestBrushState(d);
   return {bend:s?Math.hypot(s.x,s.y):0,root:{x:d.x,y:d.y},source:JSON.stringify(d),
    original:window.__bushRoot,active:_forestBrushStats.active};
  });
  assert(settled.bend<.1,'foliage should settle after the player leaves');
  assert.deepEqual(settled.root,{x:bush.x,y:bush.y},'bush roots should remain anchored');
  assert.equal(settled.source,settled.original.source,'brush state should not enter chunk decor metadata');
  await page.screenshot({path:path.join(out,'bush-settled.png')});
  const timber=[];
  for(const species of timberSpecies){
   const initial=await page.evaluate(species=>window.__chooseTimber(species),species);assert(initial.centerBlocked);
   const blocked=await page.evaluate(()=>{
    const b=window.__wood,n=window.__woodNormal,start={x:player.x,y:player.y};
    for(let i=0;i<40;i++)window.__frame(-n.x,-n.y);
    return {distance:Math.hypot(player.x-b.x,player.y-b.y),moved:Math.hypot(player.x-start.x,player.y-start.y)};
   });
   assert(blocked.moved>20&&blocked.distance>18&&blocked.distance<80,'timber should stop actual player movement at its body');
   await page.screenshot({path:path.join(out,species.toLowerCase()+'-blocked.png')});
   const around=await page.evaluate(()=>{
    const b=window.__wood,n=window.__woodNormal,v=window.__woodAxis;
    for(let i=0;i<22;i++)window.__frame(v.x,v.y);
    for(let i=0;i<30;i++)window.__frame(-n.x,-n.y);
    return {side:(player.x-b.x)*n.x+(player.y-b.y)*n.y,position:{x:player.x,y:player.y}};
   });
   assert(around.side<0,'player should be able to walk around the timber');
   const before=await page.evaluate(()=>{
    const b=window.__wood,n=window.__woodNormal;
    window.__place(b.x+n.x*45,b.y+n.y*45);player.aimAngle=Math.atan2(b.y-player.y,b.x-player.x);
    window.pickaxeOwned=true;setMeleeTool('PICKAXE');meleeUnlocked=true;window.meleeFinisherUnlocked=false;
    player.meleeTimer=player.meleeCooldown=0;player.meleePhase=0;player.prevMeleeInputHeld=false;
    window.__frame();return window.__woodState();
   });
   let after=before,swings=0;
   while(after.world&&swings<8){
    after=await page.evaluate(()=>{
     const b=window.__wood;player.aimAngle=Math.atan2(b.y-player.y,b.x-player.x);
     window.__frame(0,0,true);for(let i=0;i<34;i++)window.__frame();return window.__woodState();
    });swings++;
   }
   assert(!after.world&&!after.active&&!after.resident&&!after.art&&!after.blocked&&after.remembered,
    'native melee should remove timber body, collider and art together');
   const collected=await page.evaluate(()=>{for(let i=0;i<150;i++)window.__frame();return window.__woodState();});
   assert.equal(collected.bank-before.bank,initial.yield,'magnet pickup should bank the exact wood yield once');
   assert.equal(collected.drops,0,'all wood bundles should be collected');
   await page.screenshot({path:path.join(out,species.toLowerCase()+'-salvaged.png')});
   const restored=await page.evaluate(()=>{
    const root=window.__woodRoot,key=window.__woodKey,bank=resourceCount('WOOD');saveGame();
    window.resources.WOOD=0;loadGame();enemiesList=[];townCitizens=[];resetForestWildlife();_wildlifeSpawnClock=1e9;
    isPaused=isDead=isWin=killcamMode=false;inTownCutscene=inDarchonCall=inPostAmbushCutscene=inFortCutscene=false;
    window.__place(root.x+80,root.y+80);window.__frame();
    let resident=0,art=0;for(const ch of chunkMgr.chunks.values()){
     resident+=ch.solid.filter(s=>s.chunkKey===key).length;
     art+=ch.decor.filter(d=>d.forestSolidKey===key).length;
    }
    return {bank,restored:resourceCount('WOOD'),resident,art,remembered:!!getBiomeState(2).destroyed[key]};
   });
   assert.equal(restored.restored,restored.bank);assert(!restored.resident&&!restored.art&&restored.remembered);
   timber.push({initial,blocked,around,before,after,collected,restored,swings});
  }
  const faults=await page.evaluate(()=>window.__faults);assert.deepEqual(errors,[]);assert.deepEqual(faults,[]);
  const report={p5:await page.evaluate(()=>p5.VERSION),sourceSha:crypto.createHash('sha256').update(source).digest('hex'),
   bush:{initial:bush,peak,maxActive,frames,settled},timber,errors,faults};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

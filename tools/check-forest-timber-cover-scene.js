// Generated waist-high timber, native player contact and actual pooled rounds
// in the real phone-sized p5 frame. Checks both cover posture and projectile
// elevation, so endpoint-only timber collisions cannot silently return.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const deps=process.env.VIS_DEPS||'/workspace/onboarding-newone';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'..','game.js'),'utf8');
const p5=fs.readFileSync(process.env.VIS_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.FOREST_TIMBER_COVER_OUT||path.join(__dirname,'..','work','forest-waist-cover','scene');
fs.mkdirSync(out,{recursive:true});
const fixture=`
window.preload=function(){};
window.setup=function(){createCanvas(540,975);pixelDensity(1);noLoop();randomSeed(7);noiseSeed(BIOME_SEED);
 leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};window.__ready=true;};
window.__prepare=function(){
 isStoryMode=false;started=true;isPaused=false;startAtLevel(2);
 isDead=isWin=killcamMode=false;inStoryIntro=inStoryRoom=inTownCutscene=inDarchonCall=false;
 inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=false;
 inWorldBuildingMenu=inOverworldView=inTravelMenu=false;
 nm0AmbushActive=false;darchonCallCompleted=true;objectiveTimer=0;MAX_KILLS=1000000;
 enemiesList=[];townCitizens=[];bullets=[];particles=[];
 refreshPopulation=function(){};refreshCityPeople=function(){};resetForestWildlife();_wildlifeSpawnClock=1e9;
 worldTimeMs=14/24*DAY_MS;isRaining=false;weather=null;updateSunVector();
 GLRig.on=false;GLRig.failure=GLRIG_SHED_MSG;window.isDesktop=false;
 chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;jetpackUnlocked=false;
 player.maxHp=player.hp=1e8;player.shield=0;player.isArmed=true;player.currentWeapon=WEAPONS.PISTOL;player.ammo=1000;
 window.resources={WOOD:0,METAL:0,STONE:0};resourceDrops=[];setMeleeTool('NONE');
 window.__faults=[];const note=noteFrameFault;
 noteFrameFault=function(where,error){window.__faults.push(where+': '+error.message);return note(where,error);};
 window.__place=function(x,y){
  player.x=x;player.y=y;player.cover=null;resetActorStance(player,'STAND');
  targetZoom=zoom=.65;camX=x-width/2/zoom;camY=y-height/2/zoom;
  viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;
  chunkMgr.update(x,y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();activeBuildings=buildings;invalidateColIndex();
 };
 window.__frame=function(dx=0,dy=0,aim=false,melee=false){
  player.shield=0;player.shieldRechargeTimer=300;
  leftStick.active=!!(dx||dy);leftStick.dx=dx;leftStick.dy=dy;
  rightStick.active=aim;rightStick.dx=aim?-__normal.x:0;rightStick.dy=aim?-__normal.y:0;rightStick.dist=aim?.4:0;
  meleeInputHeld=melee;deltaTime=1000/60;redraw();
 };
 window.__normal={x:0,y:1};window.__place(15000,6600);window.__frame();
};
window.__choose=function(species){
 enemiesList=[];for(const b of bullets)b.active=false;bullets=[];setMeleeTool('NONE');
 for(const b of activeBuildings){
  if(!b.isForestTimber||b.forestSpecies!==species)continue;
  if(activeBuildings.some(s=>s!==b&&harvestProfile(s)&&Math.hypot(s.x-b.x,s.y-b.y)<160))continue;
  for(const f of coverSolidFaces(b)){
   if(f.edgeMax-f.edgeMin<COVER_FOOT_MARGIN*2+2)continue;
   const along=b.x*f.tx+b.y*f.ty,px=f.nx*(f.plane+95)+f.tx*along,py=f.ny*(f.plane+95)+f.ty*along;
   let clear=true;for(let d=19;d<=95;d+=8)
    if(player.checkCol(f.nx*(f.plane+d)+f.tx*along,f.ny*(f.plane+d)+f.ty*along)){clear=false;break;}
   const sx=b.x-f.nx*200,sy=b.y-f.ny*200,ex=b.x+f.nx*70,ey=b.y+f.ny*70;
   if(player.checkCol(sx,sy))clear=false;
   for(const other of activeBuildings){
    if(other===b||other.isGrassLot||other.isRiver||other.isWater||other.isDeck)continue;
    const hit=other.isForestTimber?forestTimberSegmentTime(other,sx,sy,ex,ey):
     stanceSegmentBoxTime(sx,sy,ex-sx,ey-sy,other.x-other.w*.5-6,other.y-other.h*.5-6,
      other.x+other.w*.5+6,other.y+other.h*.5+6);
    if(hit!==Infinity){clear=false;break;}
   }
   if(!clear)continue;
   window.__wood=b;window.__key=b.chunkKey;window.__normal={x:f.nx,y:f.ny};window.__face=f;
   window.__place(px,py);player.aimAngle=Math.atan2(-f.ny,-f.nx);window.__frame();
   return {species,key:b.chunkKey,x:b.x,y:b.y,angle:b.forestTimberAngle,kind:coverSolidKind(b),
    width:b.forestTimberWidth,depth:b.forestTimberDepth,yield:harvestProfile(b).yield,normal:__normal};
  }
 }
 throw Error('No isolated generated '+species+' low-cover fixture');
};
window.__contact=function(){
 const n=__normal;for(let i=0;i<45;i++)__frame(-n.x,-n.y);for(let i=0;i<15;i++)__frame();
 return {active:!!player.cover?.active,kind:player.cover?.kind,stance:actorStance(player),
  solidKey:player.cover?.solid?.chunkKey,pop:player.cover?.pop,blend:player.cover?.blend,
  x:player.x,y:player.y,blocked:player.checkCol(player.x,player.y)};
};
window.__clearRounds=function(){for(const b of bullets)b.active=false;bullets=[];};
window.__incoming=function(zone,posture,shooterLow=false){
 const b=__wood,n=__normal;__clearRounds();
 if(posture==='STAND'){
  __place(b.x+n.x*55,b.y+n.y*55);player.aimAngle=Math.atan2(-n.y,-n.x);
  for(let i=0;i<18;i++)__frame();
 }else if(posture==='POP')for(let i=0;i<18;i++)__frame(0,0,true);
 else for(let i=0;i<18;i++)__frame();
 const shooter=new Character(b.x-n.x*200,b.y-n.y*200,false,'NORMAL');
 shooter.hp=shooter.maxHp=1e8;shooter.isArmed=true;shooter.currentWeapon=WEAPONS.PISTOL;
 shooter.isFriendly=shooter.isNeutral=false;shooter.updateEnemy=function(){};
 resetActorStance(shooter,shooterLow?'CROUCH':'STAND');enemiesList=[shooter];
 const target=coverActorHitCenter(player,zone,zone),a=Math.atan2(target.y-shooter.y,target.x-shooter.x);
 shooter.aimAngle=a;const hp=player.hp,woodHp=harvestProfile(b).hp,stance=actorStance(player);
 const round=spawnBullet(shooter.x,shooter.y,a,false,zone,WEAPONS.PISTOL,shooter);
 const launchLow=round.coverLaunchLow;
 for(let i=0;i<65;i++)__frame(0,0,posture==='POP');
 const result={zone,posture,shooterLow,launchLow,stance,hpLoss:hp-player.hp,
  woodLoss:woodHp-harvestProfile(b).hp,active:round.active,round:{x:round.x,y:round.y},
  timberImpact:forestTimberPointBlocked(b,round.x,round.y,.05),
  player:{x:player.x,y:player.y,stance:actorStance(player),active:!!player.cover?.active,pop:player.cover?.pop}};
 enemiesList=[];__clearRounds();return result;
};
window.__chop=function(){
 const b=__wood,n=__normal,key=__key,before=resourceCount('WOOD'),worth=harvestProfile(b).yield;
 player.aimAngle=Math.atan2(-n.y,-n.x);window.pickaxeOwned=true;setMeleeTool('PICKAXE');meleeUnlocked=true;
 window.meleeFinisherUnlocked=false;player.meleeTimer=player.meleeCooldown=0;player.meleePhase=0;player.prevMeleeInputHeld=false;
 let swings=0;while(buildings.some(s=>s.chunkKey===key)&&swings<8){
  __frame(0,0,false,true);for(let i=0;i<35;i++)__frame();swings++;
 }
 for(let i=0;i<150;i++)__frame();
 const art=[...chunkMgr.chunks.values()].some(ch=>ch.decor.some(d=>d.forestSolidKey===key));
 return {swings,worth,bank:resourceCount('WOOD')-before,art,
  solid:buildings.some(s=>s.chunkKey===key),activeCover:!!player.cover?.active,renderCover:coverRenderActive(player),
  remembered:!!getBiomeState(2).destroyed[key]};
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
  await page.waitForFunction(()=>window.__ready);await page.evaluate(()=>window.__prepare());
  const cases=[];
  for(const species of ['LOG','STUMP']){
   const initial=await page.evaluate(s=>window.__choose(s),species);assert.equal(initial.kind,'LOW');
   const contact=await page.evaluate(()=>window.__contact());
   assert(contact.active&&contact.kind==='LOW'&&contact.stance==='CROUCH'&&!contact.blocked&&contact.solidKey===initial.key,
    species+' should acquire native crouched cover without putting the root inside the timber: '+JSON.stringify({initial,contact}));
   await page.screenshot({path:path.join(out,species.toLowerCase()+'-ducked.png')});
   const duck=[];for(const zone of ['BODY','HEAD']){
    const shot=await page.evaluate(zone=>window.__incoming(zone,'DUCK'),zone);duck.push(shot);
    assert.equal(shot.stance,'CROUCH');assert.equal(shot.hpLoss,0,species+' should protect its ducked player from '+zone+' shots');
   }
   const pop=await page.evaluate(()=>window.__incoming('BODY','POP'));
   assert.equal(pop.stance,'STAND');assert(pop.hpLoss>0,species+' popped-up player should be exposed above waist cover: '+JSON.stringify(pop));
   await page.screenshot({path:path.join(out,species.toLowerCase()+'-popped.png')});
   const standing=[];for(const zone of ['BODY','HEAD']){
    const shot=await page.evaluate(zone=>window.__incoming(zone,'STAND'),zone);standing.push(shot);
    assert.equal(shot.stance,'STAND');assert(shot.hpLoss>0,species+' should let standing '+zone+' shots pass above it');
    assert.equal(shot.woodLoss,0,'high shots must not damage timber through an old endpoint path');
   }
   const legs=await page.evaluate(()=>window.__incoming('LEGS','STAND'));
   assert.equal(legs.hpLoss,0,species+' should intercept leg-height rounds');assert(!legs.active&&legs.timberImpact,
    'leg-height round must stop at the actual timber, not a different object in the fixture');
   const lowLaunch=await page.evaluate(()=>window.__incoming('HEAD','STAND',true));
   assert(lowLaunch.launchLow&&lowLaunch.hpLoss===0&&!lowLaunch.active&&lowLaunch.timberImpact,
    species+' should intercept rounds actually launched from a crouch');
   const contactAgain=await page.evaluate(()=>window.__contact());assert(contactAgain.active&&contactAgain.solidKey===initial.key);
   const chopped=await page.evaluate(()=>window.__chop());
   assert(!chopped.solid&&!chopped.art&&!chopped.activeCover&&!chopped.renderCover&&chopped.remembered,
    species+' should stop protecting the actor once native pickaxe input removes it');
   assert.equal(chopped.bank,chopped.worth,'native salvage must still collect its exact wood yield');
   await page.screenshot({path:path.join(out,species.toLowerCase()+'-removed.png')});
   cases.push({initial,contact,duck,pop,standing,legs,lowLaunch,chopped});
  }
  const faults=await page.evaluate(()=>window.__faults);assert.deepEqual(errors,[]);assert.deepEqual(faults,[]);
  const report={p5:await page.evaluate(()=>p5.VERSION),sourceSha:crypto.createHash('sha256').update(source).digest('hex'),cases,errors,faults};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

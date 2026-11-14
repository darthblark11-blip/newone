// Run the real shared enemy loop in separate baseline/current VM contexts.
// Stealth now applies to regular hostile humans. Dedicated AI, civilians,
// allies and explicit combat scenes must retain their decisions and RNG use.
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {execFileSync}=require('child_process');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-scope-')),baseline=path.join(folder,'before.js');
fs.writeFileSync(baseline,execFileSync('git',['show','5ec3bc1:game.js'],{cwd:path.join(__dirname,'..'),maxBuffer:16e6}));
function load(file){
 const previous=process.env.GAME_JS;process.env.GAME_JS=file;delete require.cache[require.resolve('./harness')];
 const h=require('./harness');if(previous===undefined)delete process.env.GAME_JS;else process.env.GAME_JS=previous;
 let seed=93417,calls=0;h.ctx.random=(a,b)=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;return a===undefined?r:Array.isArray(a)?a[Math.floor(r*a.length)]:b===undefined?r*a:a+r*(b-a);};
 h.ctx.setTimeout=()=>0;h.ctx.millis=()=>10000;h.rng=()=>[seed,calls];return h;
}
try{
 const before=load(baseline),after=load(path.join(__dirname,'../game.js'));let checks=0;
 const fixtures=[
  ['friendly soldier','NORMAL','scopeGuard.isFriendly=true;'],
  ['neutral wanderer','BANDIT','scopeGuard.isNeutral=true;'],
  ['unarmed civilian','NORMAL','scopeGuard.isUnarmed=true;scopeGuard.isCoward=true;'],
  ...['ROBOT','BUG','SNAIL','SNAIL_HYBRID','ALIEN_GATOR','AERIAL','AERIAL_PISTOL','SAUCER','SAUCER_RED','ARMORED'].map(t=>[t,t,'']),
  ['scripted ambusher','NORMAL','scopeGuard.isAmbush=true;scopeGuard.state="CHASE";'],
  ['active muster','NORMAL','nm0AmbushActive=true;scopeGuard.state="CHASE";'],
  ['active farm battle','NORMAL','farmAmbushActive=true;scopeGuard.state="CHASE";'],
  ['nonplayer aggro','NORMAL','scopeGuard.aggroTarget=new Character(120,20,false);scopeGuard.aggroTimer=500;scopeGuard.state="CHASE";'],
  ['nonplayer leader','NORMAL','scopeGuard.leader=new Character(120,20,false);scopeGuard.state="CHASE";'],
  ['paused','NORMAL','isPaused=true;'],
  ['scripted town scene','NORMAL','inTownCutscene=true;']
 ];
 for(const [label,type,extra]of fixtures){
  const level=3;
  const init=`currentLevel=currentBiome=${level};BIOME_ACTIVE=true;isStoryMode=false;started=doTick=true;
   isPaused=isDead=isWin=killcamMode=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=inTravelMenu=inStoryIntro=inDarchonCall=false;
   nm0AmbushActive=farmAmbushActive=false;inStoryRoom=inLvl4Cutscene=inWorldBuildingMenu=inUpgradeMenu=inOverworldView=false;
   authoredCore=authoredMask=null;buildings=[];activeBuildings=[];activeParkingCars=[];enemiesList=[];barrels=[];
   frontierBounties={activeId:null,contracts:{}};
   player=new Character(0,0,true);player.hp=9999;window.scopeGuard=new Character(240,50,false,${JSON.stringify(type)});
   scopeGuard.aimAngle=Math.PI;scopeGuard.fireTimer=999999;scopeGuard.aiOffset=0;
   ${extra}
   enemiesList=[scopeGuard];invalidateColIndex();`;
  before.probe(init);after.probe(init);
  for(let f=0;f<30;f++){
   const step=`frameCount=${f+10};deltaTime=1000/60;scopeGuard.updateEnemy();
    JSON.stringify([scopeGuard.x,scopeGuard.y,scopeGuard.state,scopeGuard.aimAngle,
    scopeGuard.moveAngle,scopeGuard.loseSightTimer,scopeGuard.cachedCanSee,scopeGuard.lastKnownX,scopeGuard.lastKnownY,scopeGuard.ammo]);`;
   assert.equal(after.probe(step),before.probe(step),`${label} frame ${f}`);
   assert.deepEqual(after.rng(),before.rng(),label+' consumes the same random sequence');checks+=2;
  }
  assert.equal(after.probe('scopeGuard.stealthPerception'),undefined,label+' never acquires shared stealth state');checks++;
 }
 console.log(`Protected AI scope: ${checks} native enemy-decision and RNG parity checks passed.`);
}finally{fs.rmSync(folder,{recursive:true,force:true});}

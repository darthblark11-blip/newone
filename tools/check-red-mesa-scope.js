// Run the real shared enemy loop in separate baseline/current VM contexts.
// Outside active Red Mesa, positions, decisions and RNG consumption must agree.
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {execFileSync}=require('child_process');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'mesa-scope-')),baseline=path.join(folder,'before.js');
fs.writeFileSync(baseline,execFileSync('git',['show','370d076:game.js'],{cwd:path.join(__dirname,'..'),maxBuffer:16e6}));
function load(file){
 const previous=process.env.GAME_JS;process.env.GAME_JS=file;delete require.cache[require.resolve('./harness')];
 const h=require('./harness');if(previous===undefined)delete process.env.GAME_JS;else process.env.GAME_JS=previous;
 let seed=93417,calls=0;h.ctx.random=(a,b)=>{calls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;return a===undefined?r:Array.isArray(a)?a[Math.floor(r*a.length)]:b===undefined?r*a:a+r*(b-a);};
 h.ctx.setTimeout=()=>0;h.ctx.millis=()=>10000;h.rng=()=>[seed,calls];return h;
}
try{
 const before=load(baseline),after=load(path.join(__dirname,'../game.js'));let checks=0;
 for(const [level,bounty,stage]of [[1,null,null],[2,null,null],[3,null,null],[3,'DUST_RAIL','ACTIVE'],[3,'COYOTE_MINE','ACTIVE'],[1,'RED_MESA','ACTIVE'],[3,'RED_MESA','AVAILABLE']]){
  const init=`currentLevel=currentBiome=${level};BIOME_ACTIVE=true;isStoryMode=false;started=doTick=true;
   isPaused=isDead=isWin=killcamMode=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=inTravelMenu=inStoryIntro=inDarchonCall=false;
   authoredCore=authoredMask=null;buildings=[];activeBuildings=[];activeParkingCars=[];enemiesList=[];barrels=[];
   frontierBounties={activeId:${JSON.stringify(bounty)},contracts:{}};
   ${bounty?`frontierBountyRecord(FRONTIER_BOUNTY_DEFS.find(d=>d.id===${JSON.stringify(bounty)})).stage=${JSON.stringify(stage)};`:''}
   player=new Character(0,0,true);player.hp=9999;window.scopeGuard=new Character(240,50,false,'BANDIT');
   scopeGuard.aimAngle=Math.PI;scopeGuard.fireTimer=999999;
   ${bounty?`scopeGuard.frontierBountyId=${JSON.stringify(bounty)};`:''}
   enemiesList=[scopeGuard];invalidateColIndex();`;
  before.probe(init);after.probe(init);
  for(let f=0;f<30;f++){
   const step=`frameCount=${f+10};deltaTime=1000/60;scopeGuard.updateEnemy();
    JSON.stringify([scopeGuard.x,scopeGuard.y,scopeGuard.state,scopeGuard.aimAngle,
    scopeGuard.moveAngle,scopeGuard.loseSightTimer,scopeGuard.cachedCanSee,scopeGuard.lastKnownX,scopeGuard.lastKnownY,scopeGuard.ammo]);`;
   assert.equal(after.probe(step),before.probe(step),`L${level} ${bounty||'ordinary'} ${stage||''} frame ${f}`);
   assert.deepEqual(after.rng(),before.rng(),'Unscoped AI consumes the same random sequence');checks+=2;
  }
  assert.equal(after.probe('scopeGuard.redMesaStealth'),undefined,'Unscoped actors never acquire stealth state');checks++;
 }
 console.log(`Red Mesa scope: ${checks} native enemy-decision and RNG parity checks passed.`);
}finally{fs.rmSync(folder,{recursive:true,force:true});}

// Exact state parity against the published actor-depth controller, including
// native digging/mantling and moving across a pit mouth inside one grid cell.
// SHOVEL_BASELINE_JS can select another compatible source snapshot.
const assert=require('assert/strict');
const fs=require('fs');
const {execFileSync}=require('child_process');
const baseline=process.env.SHOVEL_BASELINE_JS
  ?fs.readFileSync(process.env.SHOVEL_BASELINE_JS,'utf8')
  :execFileSync('git',['show','37dfd722d2524a1810851ffc62905b3aa1d655a4:game.js'],
    {cwd:__dirname+'/..',maxBuffer:8e6}).toString();
function original(name,next){
  const start=baseline.indexOf('function '+name+'('),end=baseline.indexOf('function '+next+'(',start);
  assert(start>=0&&end>start,'Published depth controller markers exist');
  return baseline.slice(start,end).trim();
}
function harness(old){
  delete require.cache[require.resolve('./harness')];
  const h=require('./harness');h.ctx.setTimeout=()=>0;
  h.ctx.Math=Object.create(Math);h.ctx.Math.random=()=>.5;
  if(old)for(const [name,next]of[
    ['shovelSurfaceFallCell','shovelRenderScale'],
    ['shovelSyncPlayerCell','shovelFallImpact'],
    ['shovelUpdateActor','shovelUpdatePlayer']])h.probe(name+'=('+original(name,next)+'\n);');
  h.probe(`currentLevel=currentBiome=1;BIOME_ACTIVE=true;started=doTick=true;
    isStoryMode=false;isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFarmCutscene=inFarmPostCutscene=false;
    inPostAmbushCutscene=inFortCutscene=inDarchonCall=inTravelMenu=inOverworldView=false;
    inWorldBuildingMenu=inUpgradeMenu=inLvl4Cutscene=false;nm0AmbushActive=false;
    buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];barrels=[];
    enemiesList=[];townCitizens=[];corpses=[];particles=[];bullets=[];invalidateColIndex();
    var fixture=(type='NORMAL',isPlayer=false)=>{
      currentLevel=currentBiome=1;shovelExcavation={};corpses=[];particles=[];
      player=new Character(528,720,true,'NORMAL');
      var actor=isPlayer?player:new Character(528,720,false,type);
      actor.hp=actor.maxHp=100;actor.shovelLevel=1;
      actor.shovelDepth=actor.shovelDepthTarget=0;actor._shovelCellKey=null;
      actor.shovelCooldownMs=actor.shovelNoticeMs=0;
      actor.meleeTimer=actor.shovelDigTimer=0;
      setMeleeTool('SHOVEL');window.passiveRouteUnlocked=false;return actor;
    };
    var e=fixture(),snapshot=()=>JSON.stringify({actor:e,excavation:shovelExcavation,
      particles,corpses,level:currentLevel,projection:shovelActorProjection(e),
      surface:!!shovelSurfaceFallCell(e),depth:shovelPlayerDepth(e)});`);
  return h;
}
const before=harness(true),after=harness(false);let comparisons=0;
function both(code,label){
  before.probe(code);after.probe(code);
  assert.equal(after.probe('snapshot()'),before.probe('snapshot()'),label);
  comparisons++;
}

// Broad native-state coverage, including unchanged cell keys and actor types
// that never fall. A fresh controller must make exactly the old state writes.
for(const type of ['NORMAL','ARMORED_STANDARD','ROBOT','HORSE','AERIAL'])
for(const depth of [0,.2,18,36,4000])for(const target of [0,18,36,4096])
for(const dt of [0,1000/60,1000,NaN]){
  both(`e=fixture(${JSON.stringify(type)});shovelMakeCell(5,7,${target},true);
    e.shovelDepth=${depth};e.shovelDepthTarget=${target};
    e._shovelCellKey=shovelCellKey(5,7);e._shovelFall={origin:0,velocity:50};
    shovelUpdateActor(e,${Number.isNaN(dt)?'NaN':dt});`,`${type} depth ${depth}/${target} at ${dt}ms`);
}

both(`e=fixture();shovelMakeCell(5,7,36,true);e.x=483;shovelUpdateActor(e,16);`,
  'Grass outside the narrower visible mouth stays at the surface');
both('e.x=510;shovelSyncPlayerCell(e);shovelUpdateActor(e,16);',
  'Crossing the mouth inside one cell begins the same fall');
for(let i=0;i<75;i++)both('frameCount++;shovelUpdateActor(e,1000/60);','The complete native fall follows the original trajectory');
both('e.x=2000;e.y=2000;shovelUpdateActor(e,16);','A story teleport releases stale underground depth');
both('currentLevel=8;shovelUpdateActor(e,16);','Interior travel clears depth and cell state');
both('currentLevel=2;shovelUpdateActor(e,16);','Returning to the surface initializes the new level');

both(`e=fixture();shovelMakeCell(5,7,18,false,18);shovelUpdateActor(e,16);`,
  'An intact roof does not drop a surface actor');
both('shovelCellAt(e.x,e.y).open=true;shovelUpdateActor(e,16);',
  'Opening a roof inside the unchanged cell triggers descent immediately');
both('shovelMakeCell(6,7,36,true);e.x=580;shovelSyncPlayerCell(e);shovelUpdateActor(e,16);',
  'Connected mouths retain their shared seam');
both('delete shovelExcavation[shovelCellKey(6,7)];shovelUpdateActor(e,16);',
  'Removing the current excavation retains native release behavior');

both(`e=fixture('NORMAL',true);e.shovelDepth=e.shovelDepthTarget=18;
    e._shovelCellKey=shovelCellKey(5,7);shovelMakeCell(5,7,18,true);
    for(let i=0;i<100&&!e.shovelMantle;i++)e.attemptMove(3,0);`,
  'Walking toward a shallow rim starts the native mantle');
assert(after.probe('!!e.shovelMantle'),'The mantle fixture actually starts a mantle');
for(let i=0;i<50;i++)both('frameCount++;shovelUpdateActor(e,1000/60);','Mantle projection and landing retain exact depth state');
both('shovelUpdateActor(e,1000);','The settled mantle landing does not fall back in');
both('e.x=816;shovelSyncPlayerCell(e);e.x=528;shovelSyncPlayerCell(e);shovelUpdateActor(e,16);',
  'Leaving and returning clears the climb guard');

both(`e=fixture('NORMAL',true);shovelDig('DOWN');shovelUpdateActor(e,120);`,
  'Downward digging retains its pre-contact hold');
for(let i=0;i<50;i++)both('frameCount++;shovelUpdateActor(e,1000/60);','Dig animation, contact and depth remain synchronized');
both('shovelDig("DOWN");shovelUpdateActor(e,300);','A second stroke preserves its driving-down depth decay');

// Count real hot-path work rather than checking for source text. The ordinary
// surface crowd no longer rebuilds the same cell key on its fall-mouth checks.
for(const h of [before,after])h.probe(`e=fixture();var keyCalls=0,oldKey=shovelCellKey;
  shovelCellKey=function(){keyCalls++;return oldKey.apply(this,arguments);};
  shovelSyncPlayerCell(e);`);
assert(after.probe('keyCalls')<before.probe('keyCalls'),'Surface crowd synchronization performs fewer cell-key builds');
console.log('Shovel crowd performance: '+comparisons+' exact controller-state comparisons passed; fewer repeated cell lookups.');

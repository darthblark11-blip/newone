// Exact Blender positions determine fitted silhouettes. Removing duplicated
// triangle corners must change the scan cost without changing a single matrix.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {ctx,probe:P}=require('./harness');ctx.setTimeout=()=>0;
const source=fs.readFileSync(path.join(__dirname,'player3d/pose.js'),'utf8');
const cachedScan='const vertices=player3DFitVertices(assetMeshes&&assetMeshes[mesh]);';
const rawScan='const vertices=assetMeshes&&assetMeshes[mesh]&&assetMeshes[mesh].positions;';
assert.equal(source.split(cachedScan).length,2,'the production fitting helper has one vertex source');
ctx.fitTestAsset=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/player/player-mesh.json'),'utf8'));
P('var fitCached=(()=>{const PLAYER3D_ASSET=fitTestAsset;'+source+';return {pose:player3DPose,vertices:player3DFitVertices};})();');
P('var fitRaw=(()=>{const PLAYER3D_ASSET=fitTestAsset;'+source.replace(cachedScan,rawScan)+';return {pose:player3DPose};})();');
let checks=0,cases=0,matrices=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};

// Asset object identity owns the cache. Warm reads do not even reread the
// duplicated position array; a replacement mesh naturally receives its own.
P(`var fitReads=0,fitExample={get positions(){fitReads++;return [0,0,0,2,0,0,0,2,0,.7,.7,1,2,0,0,0,2,0];}};
 var fitFirst=fitCached.vertices(fitExample);for(let i=0;i<100;i++)fitCached.vertices(fitExample);`);
ok(P('fitReads===1&&fitCached.vertices(fitExample)===fitFirst'),'warm fitting reuses one immutable mesh-position cache');
ok(P('fitFirst.length===12&&fitFirst[9]===.7&&fitFirst[10]===.7&&fitFirst[11]===1'),
 'deduplication retains authored interior/non-AABB points exactly');
ok(P('fitCached.vertices({positions:[0,0,0,2,0,0,0,2,0,.7,.7,1]})!==fitFirst'),
 'a replacement mesh object cannot reuse a departed asset cache');

P(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
 inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
 currentLevel=currentBiome=2;BIOME_ACTIVE=false;isStoryMode=false;window.inNM0SecretOverlay=false;
 buildGhost=null;resetUndergroundRoute();setMeleeTool('NONE');
 isCooking=meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;
 leftStick={active:false,dx:0,dy:0,dist:0};rightStick={active:false,dx:0,dy:0,dist:0};
 buildings=activeBuildings=[];barrels=[];activeParkingCars=[];enemiesList=[];
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;player=new Character(0,0,true);`);
for(const spec of [
 {type:'NORMAL',player:true,suit:'NONE'},
 {type:'NORMAL',player:true,suit:'ARMOR'},
 {type:'NORMAL',player:true,suit:'CHEMIST'},
 {type:'NM0_GREY_FATIGUE'}, {type:'ARMORED_STANDARD'}, {type:'BANDIT'}
])for(const stance of ['STAND','CROUCH','PRONE'])for(const angle of [0,.001,.7,Math.PI/2,Math.PI,-Math.PI/2,-Math.PI+.001]){
 P(`chemistSuitUnlocked=${spec.suit==='CHEMIST'};explosiveArmorUnlocked=${spec.suit==='ARMOR'};
  ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
  var fitActor=new Character(0,0,${!!spec.player},${JSON.stringify(spec.type)});
  fitActor.currentWeapon=WEAPONS.ASSAULT_RIFLE;fitActor.aimAngle=${angle};fitActor.moveAngle=${angle+.8};
  fitActor.walkCycle=1.12;fitActor.gait=.9;fitActor.isMoving=true;fitActor.isArmed=!!fitActor.isPlayer;
  fitActor._entityFacing={active:true,motion:.37,move:{angle:${angle+.8}}};
  fitActor.meleeTimer=fitActor.dashTimer=fitActor.hitFlash=fitActor.reloadTimer=fitActor.weaponKick=0;
  resetActorStance(fitActor,${JSON.stringify(stance)});frameCount++;`);
 const cached=P('fitCached.pose(fitActor)'),raw=P('fitRaw.pose(fitActor)');cases++;
 assert.equal(cached.parts.length,raw.parts.length,'fitting cannot add/drop a part');
 for(let i=0;i<cached.parts.length;i++){
  const a=cached.parts[i],b=raw.parts[i];
  assert.equal(a.mesh,b.mesh);assert.equal(a.part,b.part);
  assert.deepEqual(Buffer.from(a.matrix.buffer,a.matrix.byteOffset,a.matrix.byteLength),
    Buffer.from(b.matrix.buffer,b.matrix.byteOffset,b.matrix.byteLength),
    `${spec.type}/${spec.suit||'NONE'}/${stance}/${angle}/${a.part} retains exact Float32 matrix bytes`);
  matrices++;
 }
 checks++;
}
const counts={};
for(const name of ['torso','pelvis','hand','foot','army_webbing','army_platecarrier']){
 const mesh=ctx.fitTestAsset.meshes[name];if(!mesh)continue;
 const unique=P('fitCached.vertices(fitTestAsset.meshes['+JSON.stringify(name)+']).length/3');
 counts[name]={corners:mesh.positions.length/3,unique};
 ok(unique<mesh.positions.length/3,name+' fits fewer exact points than exported triangle corners');
}
console.log(JSON.stringify({cases,matrices,fitPoints:counts}));
console.log(checks+' exact mesh-fit matrix, unique-position cache and asset replacement checks passed');

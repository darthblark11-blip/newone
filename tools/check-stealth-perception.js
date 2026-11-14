// Common perception must preserve native patrol movement and world lifecycles.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');ctx.setTimeout=()=>0;
let checks=0;const ok=(code,message)=>{assert.ok(P(code),message);checks++;};
P(`currentLevel=currentBiome=1;BIOME_ACTIVE=false;started=doTick=true;
 isPaused=isDead=isWin=killcamMode=inStoryIntro=inStoryRoom=inTownCutscene=inFarmCutscene=false;
 inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=inLvl4Cutscene=inWorldBuildingMenu=false;
 inTravelMenu=inUpgradeMenu=inDarchonCall=nm0AmbushActive=farmAmbushActive=false;
 inOverworldView=true;buildings=[];activeBuildings=[];activeParkingCars=[];barrels=[];invalidateColIndex();
 player=new Character(-250,0,true);player.hp=9999;leftStick={dx:0,dy:0};
 var guard=new Character(0,0,false,'NORMAL');guard.aiOffset=0;guard.aimAngle=0;guard.fireTimer=99999;
 guard.postX=0;guard.postY=0;guard.beatX=90;guard.beatY=0;guard.beatTimer=300;
 enemiesList=[guard];deltaTime=50;frameCount=1;stealthPerceptionReset();guard.updateEnemy();`);
ok('stealthPerceptionContext()&&stealthPerceptionActor(guard)',
 'Live overworld exploration and ordinary armed hostiles use common stealth');
ok(`guard.state==='PATROL'&&guard.x>0&&guard.beatTimer===299&&guard.stealthPerception.handled===false`,
 'An unaware posted guard continues its native beat instead of receiving a replacement patrol');
ok(`guard.stealthPerception===guard.redMesaStealth`,
 'The shared memory retains the Red Mesa persistence alias');
P(`stealthEnterPhase(guard,'CURIOUS');guard.state='CHASE';frameCount++;guard.updateEnemy();`);
ok(`guard.stealthPerception.phase==='ALERT'&&guard.state==='CHASE'&&guard.loseSightTimer>0`,
 'An explicit external combat order overrides curiosity and keeps a valid native handoff timer');
P(`stealthPerceptionReset();stealthEmitNoise(10,20,280);currentLevel=2;stealthEmitNoise(30,40,280);`);
ok('_redMesaNoise.events.length===1&&_redMesaNoise.events[0].x===30&&_redMesaNoise.level===2',
 'A shot in a replacement level cannot inherit the previous level sound queue');
P(`frameCount++;stealthUpdateNoise(50);player=new Character(0,0,true);stealthEmitNoise(50,60,280);`);
ok('_redMesaNoise.events.length===1&&_redMesaNoise.events[0].x===50',
 'A new player/run cannot inherit previous player sound locations');
P(`stealthPerceptionReset();for(let i=0;i<30;i++)stealthEmitNoise(i,0,280);`);
ok('_redMesaNoise.events.length===STEALTH_PERCEPTION.noiseCap&&_redMesaNoise.events[0].x===18',
 'A burst of reports stays bounded to the twelve newest acoustic events');
P(`currentLevel=1;stealthPerceptionReset();activeBuildings=[];invalidateColIndex();
 var stone=stealthSurfaceAt(0,0);
 activeBuildings=[{x:0,y:0,w:200,h:200,isGrassLot:true}];invalidateColIndex();var grass=stealthSurfaceAt(0,0);
 activeBuildings=[{x:0,y:0,w:200,h:200,isDeck:true,propType:'BOARDWALK'}];invalidateColIndex();var wood=stealthSurfaceAt(0,0);`);
ok(`stone==='STONE'&&grass==='EARTH'&&wood==='TIMBER'`,
 'City paving, grass and authored boardwalks expose different real acoustic materials');
P(`currentLevel=2;activeBuildings=[];authoredCore=null;invalidateColIndex();var woodland=stealthSurfaceAt(15000,6600);currentLevel=1;`);
ok(`woodland==='EARTH'`, 'Unpaved Level 2 woodland uses soft earth instead of city paving');
P(`activeBuildings=[{x:144,y:48,w:40,h:160,isGiantBarrier:true}];buildings=activeBuildings;invalidateColIndex();
 shovelExcavation={};guard=new Character(48,48,false,'NORMAL');guard.aimAngle=0;enemiesList=[guard];
 player.x=240;player.y=48;
 for(const e of[guard,player]){e.shovelLevel=1;e.shovelDepth=e.shovelDepthTarget=36;}
 shovelMakeCell(0,0,36,true,0);shovelMakeCell(1,0,36,false,18);shovelMakeCell(2,0,36,true,0);`);
ok(`!hasLOS(guard.x,guard.y,player.x,player.y)&&stealthPerceptionVisible(guard,player)`,
 'Surface curtain walls cannot occlude guards looking along a connected excavated tunnel');
P('delete shovelExcavation[shovelCellKey(1,0)];');
ok('!stealthPerceptionVisible(guard,player)',
 'Uncut soil still blocks the common cone detector between separate holes');
// Guard-free acoustic aging is driven by the world loop, not an enemy update.
P(`for(const e of[guard,player]){e.shovelDepth=e.shovelDepthTarget=0;}shovelExcavation={};
 currentLevel=currentBiome=1;buildings=[];activeBuildings=[];activeParkingCars=[];invalidateColIndex();
 enemiesList=[];bullets=[];particles=[];corpses=[];orbs=[];grenades=[];fires=[];sludges=[];healthPacks=[];weaponDrops=[];shockwaves=[];
 player.isMoving=false;stealthPerceptionReset();stealthEmitNoise(12,34,280);`);
P(`for(let i=0;i<11;i++){frameCount++;deltaTime=100;updateEntities();}`);
ok('_redMesaNoise.events.length===0&&_redMesaNoise.clock>=1000',
 'Sound expires on live world frames even when no eligible guards are present');
console.log('Shared stealth: '+checks+' native patrol, material, world-lifecycle and tunnel checks passed.');

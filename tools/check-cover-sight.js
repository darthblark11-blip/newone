// Cover perception follows the exposed head/torso, not the hidden movement
// root. Keep the existing underground and dedicated creature sight routes.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
ctx.setTimeout=()=>0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
function fresh(kind='HIGH',side=1){
 probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 inOverworldView=false;window.inNM0SecretOverlay=false;buildGhost=null;setMeleeTool('NONE');
 chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;jetpackUnlocked=false;
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 parkingCars=activeParkingCars=[];barrels=[];bullets=[];particles=[];enemiesList=[];
 player=new Character(15,${kind==='HIGH'?side*70:0},true);player.currentWeapon=WEAPONS.PISTOL;
 player.hp=player.maxHp=1000;player.shield=100;player.isArmed=true;
 player.aimAngle=${kind==='HIGH'?Math.atan2(side*.8,1):0};player.isMoving=false;resetActorStance(player);
 window.sightGunner=new Character(200,${kind==='HIGH'?side*100:0},false,'NORMAL');
 sightGunner.isFriendly=sightGunner.isNeutral=false;sightGunner.currentWeapon=WEAPONS.PISTOL;
 sightGunner.aimAngle=Math.PI;sightGunner.fireTimer=999;sightGunner.aiOffset=0;sightGunner.state='PATROL';
 window.sightWall={x:40,y:0,w:20,h:160,${kind==='HIGH'?'isWall':'isCrateProp'}:true};
 buildings=activeBuildings=[sightWall];invalidateColIndex();frameCount=100;deltaTime=1000/60;
 for(let i=0;i<20;i++){frameCount++;updateActorCover(player,1000/60,6,0,true);}`);
}
function settle(aiming){probe(`for(let i=0;i<20;i++){frameCount++;updateActorCover(player,1000/60,0,0,${aiming});}`);}
for(const side of [-1,1]){
 fresh('HIGH',side);
 ok('a real edge contact produces a visible high-wall peek '+side,P('player.cover.active&&player.cover.peek===1'));
 ok('the ordinary root stays hidden by the high wall '+side,!P('hasLOS(sightGunner.x,sightGunner.y,player.x,player.y)'));
 ok('an ordinary gunner can see the exposed anatomy '+side,P('shovelActorLOS(sightGunner,player)'));
 probe('sightGunner.isFriendly=true;');
 ok('an allied observer uses the same exposed anatomy '+side,P('shovelActorLOS(sightGunner,player)'));
 probe('sightGunner.isFriendly=false;');settle(false);
 ok('retracting the upper body actually hides the actor '+side,!P('shovelActorLOS(sightGunner,player)'));
 settle(true);
 probe(`window.sightBlock={x:120,y:${side*100},w:30,h:180,isWall:true};buildings=activeBuildings=[sightWall,sightBlock];invalidateColIndex();`);
 ok('a second real wall blocks sight of an exposed peek '+side,!P('shovelActorLOS(sightGunner,player)'));
}
fresh('LOW');
ok('a low-cover pop-up is visible above the object',P("player.cover.active&&actorStance(player)==='STAND'&&shovelActorLOS(sightGunner,player)"));
settle(false);
ok('ducking behind low cover hides the player',P("actorStance(player)==='CROUCH'&&!shovelActorLOS(sightGunner,player)"));
probe('sightGunner.x=-150;');
ok('low cover does not hide an actor from its exposed side',P('shovelActorLOS(sightGunner,player)'));

// The observer's head must also be allowed to see around its own cover.
fresh();probe(`window.sightCovered=player;window.sightOpen=sightGunner;
 sightCovered.isPlayer=false;sightCovered.eType='NORMAL';sightOpen.isPlayer=true;`);
ok('a covered humanoid sees out from its canonical head',P('shovelActorLOS(sightCovered,sightOpen)'));
probe('sightCovered.cover.upper.x=sightCovered.cover.upper.y=0;sightCovered.cover.peek=0;sightCovered.cover.validPeek=false;sightCovered.cover.aiming=false;');
ok('a closed wall posture cannot see through its own wall',!P('shovelActorLOS(sightCovered,sightOpen)'));

// Prove the real enemy sight cache receives the posed result before any shot.
fresh();probe('enemiesList=[sightGunner];frameCount=130;sightGunner.updateEnemy();');
ok('the native enemy cache detects a peeking player',P('sightGunner.cachedCanSee&&sightGunner.state===\'CHASE\''));
settle(false);probe('frameCount=160;sightGunner.updateEnemy();');
ok('the next normal sight slice loses a retracted player',!P('sightGunner.cachedCanSee'));

fresh();probe(`window.sightFoe=player;sightFoe.isPlayer=false;sightFoe.eType='NORMAL';
 player=new Character(-500,-500,true);sightGunner.isFriendly=true;sightGunner.baseState='FOLLOW';
 enemiesList=[sightGunner,sightFoe];frameCount=130;sightGunner.updateEnemy();`);
ok('the native ally cache detects an exposed hostile',P('sightGunner.allyFoe===sightFoe&&sightGunner.allySee'));

fresh();probe('window.sightRayCount=0;window.sightOriginalRay=coverLineClear;coverLineClear=(...args)=>{sightRayCount++;return sightOriginalRay(...args);};shovelActorLOS(sightGunner,player);coverLineClear=sightOriginalRay;');
ok('posed sight uses at most two bounded geometry queries',P('sightRayCount>0&&sightRayCount<=2'));
for(const type of ['OCCULT_BLACK','OCCULT_ZOMBIE','BUG','SNAIL','ROBOT']){
 fresh();probe(`sightGunner.eType='${type}';`);
 ok(type+' retains its dedicated root sight path',!P('shovelActorLOS(sightGunner,player)'));
}
fresh();probe('sightGunner.isPlayer=true;');
ok('player utility LOS keeps its original behavior',!P('shovelActorLOS(sightGunner,player)'));
fresh('LOW');probe('player.cover=null;');
ok('actors outside cover retain the ordinary LOS path',P('shovelActorLOS(sightGunner,player)===hasLOS(sightGunner.x,sightGunner.y,player.x,player.y)'));

// Cover cannot reveal a surface/underground target or replace tunnel sight.
fresh();probe(`currentLevel=currentBiome=1;player.shovelLevel=1;player.shovelDepth=player.shovelDepthTarget=36;
 shovelMakeCell(Math.floor(player.x/96),Math.floor(player.y/96),36,true,0);`);
ok('ground occlusion is checked before any posed sight query',!P('shovelActorLOS(sightGunner,player)'));
probe(`shovelExcavation={};player.x=240;player.y=48;sightGunner.x=48;sightGunner.y=48;
 player.cover=null;player.shovelLevel=sightGunner.shovelLevel=1;
 sightGunner.shovelDepth=sightGunner.shovelDepthTarget=36;
 for(let i=0;i<3;i++)shovelMakeCell(i,0,36,i!==1,i===1?18:0);
 buildings=activeBuildings=[{x:144,y:48,w:40,h:160,isWall:true}];invalidateColIndex();`);
ok('a continuous tunnel still sees beneath surface walls',P('shovelActorLOS(sightGunner,player)'));
probe('delete shovelExcavation[shovelCellKey(1,0)];');
ok('uncut earth still blocks sight between separate tunnels',!P('shovelActorLOS(sightGunner,player)'));
console.log(`${checks}/${checks} exposed cover, native sight cache, bounded-query and underground visibility checks passed.`);

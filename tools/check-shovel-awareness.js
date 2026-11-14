// Native AI must lose a buried actor immediately, including the nine frames
// between sliced LOS checks, rather than merely having its damage suppressed.
const assert=require('assert');
const {ctx,probe:P}=require('./harness');
let checks=0;
const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
ctx.setTimeout=()=>0;
P(`isStoryMode=false;townsData={};startAtLevel(1);started=true;doTick=true;
 isPaused=isDead=isWin=killcamMode=false;nm0AmbushActive=false;
 buildings=[];activeBuildings=[];barrels=[];activeParkingCars=[];enemiesList=[];
 invalidateColIndex();bullets=[];grenades=[];particles=[];corpses=[];
 player.x=336;player.y=48;player.shovelLevel=1;player.shovelDepth=0;player.shovelDepthTarget=0;
 var bury=(e,depth=36)=>{e.shovelLevel=currentLevel;e.shovelDepth=e.shovelDepthTarget=depth;
  e._shovelCellKey=shovelCellKey(Math.floor(e.x/96),Math.floor(e.y/96));
  shovelMakeCell(Math.floor(e.x/96),Math.floor(e.y/96),depth,true,0);};
 var surface=e=>{e.shovelDepth=e.shovelDepthTarget=0;e._shovelCellKey=null;};
 var soldier=(type='NORMAL')=>{const e=new Character(48,48,false,type);e.aiOffset=0;
  e.state='CHASE';e.isFriendly=e.isNeutral=false;e.fireTimer=999;e.reloadTimer=0;
  enemiesList=[e];return e;};
 var updateAI=(e,frame)=>{frameCount=frame;e.updateEnemy();};
 var e=soldier();updateAI(e,100);`);
ok('e.cachedCanSee&&e.lastKnownX===336&&e.lastKnownY===48','a surface enemy sees and remembers an exposed player');
P('var rememberedX=e.lastKnownX,rememberedY=e.lastKnownY,shotCount=bullets.length;bury(player);player.x=432;bury(player);e.fireTimer=0;e.reloadTimer=3;e.weaponKick=3;updateAI(e,101);');
ok('!shovelActorsVisible(e,player)&&!shovelActorLOS(e,player)&&!e.cachedCanSee','fully buried player disappears immediately between LOS slices');
ok('e.lastKnownX===rememberedX&&e.lastKnownY===rememberedY','enemy investigates the frozen last visible position');
ok('bullets.length===shotCount&&e.reloadTimer===2&&e.weaponKick===2','ground occlusion prevents fire while reload and recoil timers still advance');
P('nm0AmbushActive=true;player.x=816;bury(player);updateAI(e,110);');
ok('!e.cachedCanSee&&e.lastKnownX===rememberedX&&e.lastKnownY===rememberedY','ambush chase overrides cannot reveal the live underground position');
P('nm0AmbushActive=false;surface(player);player.x=336;updateAI(e,111);');
ok('e.cachedCanSee&&e.lastKnownX===336','emerging restores detection immediately without waiting for a sliced frame');
P('bury(player,18);updateAI(e,112);');
ok('shovelActorsVisible(e,player)&&e.cachedCanSee','a waist-deep actor remains exposed to surface observers');

for(const type of ['AERIAL','AERIAL_PISTOL','SAUCER','SAUCER_RED','MOLOTOV','SNAIL','SNAIL_HYBRID','BUG']){
 P(`surface(player);player.x=336;player.y=48;shovelExcavation={};e=soldier('${type}');updateAI(e,120);
  bury(player);var beforeProjectiles=bullets.length+grenades.length;player.x=624;bury(player);e.fireTimer=0;updateAI(e,121);`);
 ok('!e.cachedCanSee&&e.lastKnownX===336',type+' cannot track through the ground');
 ok('bullets.length+grenades.length===beforeProjectiles',type+' does not shoot or throw at concealed player');
}
P(`surface(player);player.x=336;player.y=48;shovelExcavation={};e=soldier('ROBOT');updateAI(e,130);
 e.chargeTimer=50;e.burstLeft=2;e.burstGap=0;bury(player);var robotShots=bullets.length;updateAI(e,131);`);
ok('e.chargeTimer===0&&e.burstLeft===0&&bullets.length===robotShots','robot cancels charging and a pending beam burst when player goes underground');
P(`surface(player);e=soldier('ARMORED');updateAI(e,140);e.orbChargeTimer=2;bury(player);
 var oldOrbs=typeof orbs==='undefined'?0:orbs.length;updateAI(e,141);`);
ok('e.orbChargeTimer===0&&(typeof orbs===\'undefined\'||orbs.length===oldOrbs)','an already charged armored enemy cannot emit an orb through the ground');
P(`surface(player);player.x=48;player.y=48;e=soldier('SNAIL_HYBRID');e.enraged=true;
 e.lastKnownX=48;e.lastKnownY=48;bury(player);var playerHp=player.hp;updateAI(e,150);`);
ok('player.hp===playerHp&&!player.dead','enraged hybrid contact kill cannot reach a concealed player at the same map coordinate');

// Already-launched homing attacks must not follow the live underground target.
P(`buildings=[];activeBuildings=[];shovelExcavation={};surface(player);player.x=336;player.y=48;
 var homing=new Orb();homing.init(48,48);homing.update();
 var seenVx=homing.vx,seenVy=homing.vy;bury(player);player.x=624;player.y=240;bury(player);
 homing.update();`);
ok('homing.active&&homing.vx===seenVx&&homing.vy===seenVy','a launched orb coasts without steering toward the concealed live position');
P('homing.x=player.x;homing.y=player.y;homing.vx=homing.vy=0;homing.update();');
ok('homing.active','a surface orb does not proximity-detonate on an underground player');
P('surface(player);player.x+=300;homing.update();');
ok('homing.active&&homing.vx>0','a homing shot can reacquire an exposed target after emergence');

// Underground sight travels through excavated volume, never through uncut dirt
// or through a surface wall just because both actors share an XY projection.
P(`shovelExcavation={};player.x=240;player.y=48;bury(player);e=soldier();bury(e);
 shovelMakeCell(1,0,36,false,18);`);
ok('shovelActorsVisible(e,player)&&shovelActorLOS(e,player)','two actors in one continuous tunnel can see each other');
P(`buildings=[{x:144,y:48,w:40,h:160,isGiantBarrier:true}];activeBuildings=buildings;invalidateColIndex();`);
ok('!hasLOS(e.x,e.y,player.x,player.y)&&shovelActorLOS(e,player)','surface curtain wall does not block sight along a valid tunnel beneath it');
P('delete shovelExcavation[shovelCellKey(1,0)];');
ok('!shovelActorsVisible(e,player)','uncut soil between separate holes blocks underground awareness');
P('shovelMakeCell(1,0,36,false,54);');
ok('!shovelActorsVisible(e,player)','solid earth above a lower tunnel floor also blocks underground sight');
P('shovelMakeCell(1,0,36,false,18);bury(e,90);');
ok('!shovelActorsVisible(e,player)','actors at distinct deep floors cannot see through vertical earth');

// Allied target acquisition and formation steering must not be an alternate
// route for reading a buried target's current position.
P(`buildings=[];activeBuildings=[];invalidateColIndex();shovelExcavation={};surface(player);
 player.x=336;player.y=48;player.aimAngle=0;
 var ally=new Character(48,200,false,'NORMAL');ally.isFriendly=true;ally.aiOffset=0;ally.fireTimer=999;
 var foe=new Character(240,200,false,'NORMAL');enemiesList=[ally,foe];bury(foe);updateAI(ally,160);`);
ok('!ally.allyFoe','allies do not acquire an unseen underground hostile');
P(`var followAnchor=JSON.stringify(ally.allyFollowAnchor);bury(player);player.x=816;bury(player);updateAI(ally,161);`);
ok('JSON.stringify(ally.allyFollowAnchor)===followAnchor','allies wait at a remembered formation anchor instead of following through earth');
P(`surface(foe);updateAI(ally,170);`);
ok('ally.allyFoe===foe','emerging hostile re-enters ally acquisition normally');
P('bury(foe);ally.fireTimer=0;var allyShots=bullets.length;updateAI(ally,171);');
ok('!ally.allyFoe&&bullets.length===allyShots','an ally drops a newly concealed target before the next acquisition slice');

P(`surface(player);player.x=336;player.y=48;shovelExcavation={};
 var coward=new Character(48,48,false,'BARTENDER');coward.state='FLEE';updateAI(coward,180);
 var fearX=coward.fleeThreatX,fearY=coward.fleeThreatY;bury(player);player.x=816;bury(player);updateAI(coward,181);`);
ok('coward.fleeThreatX===fearX&&coward.fleeThreatY===fearY','a fleeing townsman cannot read the buried player location');
P(`var resident=new Character(144,48,false,'CITY_CITIZEN_M');cityNoise=[];frameCount=190;
 civilianNoise(144,48,620,player);noticeCivilianNoise(resident);`);
ok('resident.panicTimer===0','underground firearm noise does not create a precise surface panic source');
P('cityNoise=[];bury(resident);frameCount=191;civilianNoise(resident.x,resident.y,620,player);noticeCivilianNoise(resident);');
ok('resident.panicTimer>0','people sharing the underground layer still hear a nearby report');
P(`surface(player);player.x=48;player.y=48;surface(foe);foe.x=80;foe.y=48;bury(foe);enemiesList=[foe];`);
ok('!worldBoxingTargets(player).includes(foe)','surface boxing cannot acquire an underground opponent');

P(`startAtLevel(2);started=true;doTick=true;isPaused=isDead=isWin=killcamMode=false;
 inCutscene=inStoryIntro=inTownCutscene=inFarmCutscene=inFarmPostCutscene=false;
 inPostAmbushCutscene=inFortCutscene=inWorldBuildingMenu=inOverworldView=inTravelMenu=inDarchonCall=false;
 buildings=[];activeBuildings=[];colGrid=null;_pushBuckets.clear();resetForestWildlife();_wildlifeSpawnClock=1e9;
 player.x=15000;player.y=6600;player.hp=300;player.shield=0;bury(player);
 var bear=wildlifeSpawnAnimal('GRIZZLY_BEAR',15060,6600);_wildlifeClock=8;wildlifeSenseHumans(bear);`);
ok('bear.state===\'GRAZE\'&&!bear.intruder&&!bear.seenHuman','wildlife proximity sensing cannot discover a player beneath the ground');
P(`bear.state='TERRITORIAL';bear.aggressor=player;bear.chaseUntil=1000;
 bear.threatX=14900;bear.threatY=6600;player.x=15100;bury(player);wildlifeBrain(bear);`);
ok('bear.state===\'FLEE\'&&bear.threatX===14900&&bear.threatY===6600','a defensive animal stops tracking underground prey and keeps its remembered threat');
P(`bear.state='TERRITORIAL';bear.aggressor=player;bear.attackAt=0;bear.sensorAt=bear.thinkAt=1e9;
 bear.goalX=bear.x;bear.goalY=bear.y;bear.vx=bear.vy=0;var hpBeforeAnimal=player.hp;updateForestWildlife(.25);`);
ok('player.hp===hpBeforeAnimal&&bear.attackAt===0','a surface animal does not execute a bite through the buried player ceiling');
console.log('Shovel awareness: '+checks+' native sight, concealment, memory, combat and ally checks passed.');

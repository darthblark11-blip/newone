// A human wall slide advances in six-unit steps. It must not have to land in
// a one-unit corner strip before a player can begin the compact peek pose.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;ctx.navigator.getGamepads=()=>[];
function fresh(phase,end,key){
 probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 window.inNM0SecretOverlay=false;buildGhost=null;setMeleeTool('NONE');
 chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;jetpackUnlocked=false;
 parkingCars=activeParkingCars=[];barrels=[];bullets=[];particles=[];enemiesList=[];
 player=new Character(0,${phase*end},true);player.hp=player.maxHp=300;player.shield=100;
 player.currentWeapon=WEAPONS.${key};player.isArmed=true;player.ammo=100;player.aimAngle=0;
 player.reloadTimer=player.fireTimer=player.meleeTimer=player.dashTimer=0;resetActorStance(player);
 leftStick={active:true,dx:1,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 window.peekWall={x:40,y:0,w:20,h:160,isWall:true};buildings=activeBuildings=[peekWall];
 frameCount=100;deltaTime=1000/60;invalidateColIndex();`);
 for(let i=0;i<18;i++)probe('frameCount++;player.updatePlayer();');
 probe(`leftStick.dx=0;leftStick.active=false;rightStick.active=true;rightStick.dx=1;rightStick.dy=${end*.8};rightStick.dist=.4;`);
 for(let i=0;i<20;i++)probe('frameCount++;player.updatePlayer();');
}
function step(){probe('frameCount++;player.updatePlayer();');}
for(const key of ['PISTOL','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN'])for(const end of [-1,1])for(const phase of [0,1,2,3,4,5]){
 fresh(phase,end,key);
 const rootX=P('player.x');probe(`leftStick.active=true;leftStick.dy=${end};`);
 let movingLean=0;
 for(let i=0;i<11;i++){step();movingLean=Math.max(movingLean,P('Math.hypot(coverUpperOffset(player).x,coverUpperOffset(player).y)'));}
 ok(key+' starts a real moving corner peek for end '+end+' step phase '+phase,movingLean>.1);
 probe('leftStick.active=false;leftStick.dy=0;');for(let i=0;i<14;i++)step();
 ok(key+' keeps the reachable stopped corner responsive '+end+'/'+phase,
  P('player.cover?.active&&player.cover.peek>.99&&Math.hypot(coverUpperOffset(player).x,coverUpperOffset(player).y)>2'));
 ok(key+' does not snap the root or exceed the compact lean '+end+'/'+phase,
  Math.abs(P('player.x')-rootX)<1e-8&&Math.abs(P('player.y')-end*(phase+66))<1e-8&&
  P('Math.hypot(coverUpperOffset(player).x,coverUpperOffset(player).y)<=COVER_LEAN_MAX+1e-8'));
 probe('rightStick.active=false;rightStick.dx=rightStick.dy=0;rightStick.dist=0;');for(let i=0;i<16;i++)step();
 ok(key+' retracts the peek on raw aim release '+end+'/'+phase,P('Math.hypot(coverUpperOffset(player).x,coverUpperOffset(player).y)<.1'));
}

fresh(0,1,'PISTOL');probe('leftStick.active=false;leftStick.dx=leftStick.dy=0;rightStick.dx=1;rightStick.dy=0;');
for(let i=0;i<20;i++)step();
ok('a player keeps the raised weapon on raw aim at a sealed wall',P('coverAimActive(player)&&Math.abs(stanceWeaponMount(player).angle)<1e-8&&!player.cover.validPeek&&!player.cover.peek'));
probe('player.y=-65;rightStick.dx=1;rightStick.dy=0;');for(let i=0;i<24;i++)step();
ok('a nearby player begins a bounded partial lean even before the whole barrel clears',P('player.cover.active&&player.cover.peek>.99&&!player.cover.validPeek&&Math.abs(Math.hypot(coverUpperOffset(player).x,coverUpperOffset(player).y)-COVER_LEAN_MAX)<1e-7'));
const head=P("coverActorHitCenter(player,'HEAD')");
ok('a partial lean keeps the actual head outside solid geometry',P(`coverRayClear(${head.x},${head.y},${head.x},${head.y},6)`));
probe('window.peekEnemy=new Character(player.x,player.y,false,"NORMAL");peekEnemy.aimAngle=0;peekEnemy.currentWeapon=WEAPONS.PISTOL;resetActorStance(peekEnemy);window.peekEnemyFace=findCoverContact(peekEnemy,6,0);');
ok('enemies retain strict fully-clear corner selection instead of partial player posing',!P('coverPeekCandidate(peekEnemy,peekEnemyFace,0)'));
console.log(`${checks}/${checks} real player wall-slide, partial peek, raw aim and compact-pose checks passed.`);

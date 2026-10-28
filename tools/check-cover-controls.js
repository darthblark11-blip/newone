// Contact cover must keep movement free, with raw aiming controlling exposure.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,slot=null;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
ctx.localStorage={getItem:()=>slot,setItem:(key,value)=>{slot=value;},removeItem:()=>{slot=null;}};
const keys=new Set();ctx.keyIsDown=k=>keys.has(k);
function fresh(kind='HIGH',y=0){
 keys.clear();ctx.touches=[];ctx.mouseIsPressed=false;
 probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=false;isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 inOverworldView=false;window.inNM0SecretOverlay=false;buildGhost=null;
 parkingCars=activeParkingCars=[];barrels=[];bullets=[];particles=[];enemiesList=[];
 leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:313,y:690}};
 setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;jetpackUnlocked=false;
 player=new Character(0,${y},true);player.hp=player.maxHp=300;player.shield=100;
 player.isArmed=true;player.currentWeapon=WEAPONS.PISTOL;player.ammo=17;player.aimAngle=player.moveAngle=0;
 player.reloadTimer=player.fireTimer=player.meleeTimer=player.dashTimer=0;
 resetActorStance(player);consumeStanceInputs();frameCount=100;deltaTime=1000/60;
 window.controlCover={x:40,y:0,w:20,h:160,${kind==='LOW'?'isCrateProp':'isWall'}:true};
 buildings=activeBuildings=[controlCover];invalidateColIndex();`);
}
function move(x,y){probe(`leftStick.active=${!!(x||y)};leftStick.dx=${x};leftStick.dy=${y};`);}
function aim(x,y,fire=false){probe(`rightStick.active=${!!(x||y)};rightStick.dx=${x};rightStick.dy=${y};rightStick.dist=${fire?1:0.4};`);}
function frames(n=1,dt=1000/60){for(let i=0;i<n;i++)probe(`deltaTime=${dt};frameCount++;player.updatePlayer();`);}
function contact(kind='HIGH',y=0){fresh(kind,y);move(1,0);frames(18);move(0,0);frames(12);}

fresh();frames(20);
ok('standing near a wall without walking into it does not acquire cover',!P('!!player.cover?.active'));
move(1,0);frames(24);
ok('walking into a high wall automatically acquires cover',P("!!player.cover?.active&&player.cover.kind==='HIGH'&&coverRenderActive(player)"));
ok('contact cover keeps the native root outside the wall',P('player.x>0&&player.x<=15&&!player.checkCol(player.x,player.y)'));
const planted=P('[player.x,player.y]');move(0,0);frames(12);
ok('releasing movement retains cover without root snapping',P('!!player.cover?.active')&&P('player.x')===planted[0]&&P('player.y')===planted[1]);
move(-1,0);frames();
ok('moving away moves the player on the first frame',P('player.x')<planted[0]);
frames(30);move(0,0);frames(20);
ok('walking clear restores ordinary standing',P("!coverRenderActive(player)&&actorStance(player)==='STAND'"));

contact();const slideX=P('player.x');move(0,1);frames(6);
ok('parallel movement slides freely along cover',P('player.y>0&&player.cover?.active')&&Math.abs(P('player.x')-slideX)<1e-8);

contact();aim(1,0);frames(15);
ok('aiming through a sealed wall cannot initiate a peek',P('!!player.cover?.active&&!player.cover.peek&&Math.hypot(coverUpperOffset(player).x,coverUpperOffset(player).y)<.01'));
ok('a sealed cover shot is not permitted',!P('coverFireAllowed(player)'));
const ammo=P('player.ammo');aim(1,0,true);frames(20);
ok('holding fire at a sealed wall still fires native rounds for physical impact',P('player.ammo')<ammo&&P('bullets.some(b=>b.coverLaunchPending)'));

contact('HIGH',71);const edgeRoot=P('[player.x,player.y]');aim(1,.8);frames(20);
ok('aiming past an open end permits an upper-body peek',P('!!player.cover?.active&&player.cover.peek>0&&Math.hypot(coverUpperOffset(player).x,coverUpperOffset(player).y)>1'));
ok('standing peeks leave both legs at the planted root',P('player.x')===edgeRoot[0]&&P('player.y')===edgeRoot[1]);
aim(0,0);frames(20);
ok('aim release retracts the upper body',P('!!player.cover?.active&&Math.hypot(coverUpperOffset(player).x,coverUpperOffset(player).y)<1'));

contact('LOW');
ok('waist-high contact automatically crouches',P("!!player.cover?.active&&player.cover.kind==='LOW'&&actorStance(player)==='CROUCH'"));
ok('automatic crouching preserves the selected stance',P('player.stance.to===0&&player.stance.value===0'));
probe('saveGame();');
ok('saving records the selected stance rather than temporary cover posture',JSON.parse(slot).playerStance==='STAND');
aim(1,0);frames(18);
ok('raw aim stands the actor to fire over low cover',P("actorStance(player)==='STAND'&&coverFireAllowed(player)"));
const raised=P('coverStanceLevel(player)');aim(0,0);frames();
ok('aim release immediately begins ducking despite aim hold',P('coverStanceLevel(player)')>raised);
frames(18);
ok('the actor returns to crouched cover',P("actorStance(player)==='CROUCH'&&player.cover.active"));
move(-1,0);frames(25);move(0,0);frames(20);
ok('leaving low cover restores the selected standing stance',P("!coverRenderActive(player)&&actorStance(player)==='STAND'&&player.stance.to===0"));

contact('LOW');probe('cyclePlayerStance();');frames(20);
ok('a manual stand can leave automatic cover without leaving the wall first',P("!player.cover.active&&!coverRenderActive(player)&&actorStance(player)==='STAND'"));

contact('LOW');aim(1,0);frames(4);
const frozen=P('JSON.stringify(player.cover)');probe('isPaused=true;updateActorCover(player,100,0,0,false);updateActorCover(player,100,0,0,false);');
ok('pause freezes contact and posture interpolation',P('JSON.stringify(player.cover)')===frozen);
probe('isPaused=false;');

contact();probe("player.aimAngle=Math.PI/2;requestActorStance(player,'PRONE');");frames(24);
ok('manual prone takes priority when its extended body fits',P("!player.cover?.active&&actorStance(player)==='PRONE'"));

contact('LOW');probe('controlCover.hp=0;invalidateColIndex();');frames(20);
ok('destroyed cover cannot leave an attachment behind',P('!player.cover?.active&&!coverRenderActive(player)'));

console.log(`${checks}/${checks} seamless cover contact, movement, peek and raw-aim checks passed.`);

// Native movement must distinguish aiming near a corner from pressing a wall.
// A soft outward joystick diagonal slides; a deliberate outward throw leaves.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;ctx.navigator.getGamepads=()=>[];
function fresh(q=0,kind='HIGH',end=0,distance=18){
 const angle=q*Math.PI/2,co=Math.cos(angle),si=Math.sin(angle);
 probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 window.inNM0SecretOverlay=false;buildGhost=null;setMeleeTool('NONE');
 chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;jetpackUnlocked=false;
 parkingCars=activeParkingCars=[];barrels=[];bullets=[];particles=[];enemiesList=[];
 player=new Character(${(30-distance)*co-65*end*si},${(30-distance)*si+65*end*co},true);
 player.hp=player.maxHp=300;player.shield=100;player.currentWeapon=WEAPONS.PISTOL;
 player.isArmed=true;player.ammo=100;player.aimAngle=${angle};
 player.reloadTimer=player.fireTimer=player.meleeTimer=player.dashTimer=0;resetActorStance(player);
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 window.latchWall={x:${40*co},y:${40*si},w:${q%2?160:20},h:${q%2?20:160},${kind==='HIGH'?'isWall':'isCrateProp'}:true};
 buildings=activeBuildings=[latchWall];frameCount=100;deltaTime=1000/60;invalidateColIndex();`);
 return {co,si,normal:()=>P(`-player.x*${co}-player.y*${si}`)};
}
function move(x,y){probe(`leftStick.active=${!!(x||y)};leftStick.dx=${x};leftStick.dy=${y};`);}
function aim(x,y){probe(`rightStick.active=${!!(x||y)};rightStick.dx=${x};rightStick.dy=${y};rightStick.dist=.4;`);}
function step(n=1){for(let i=0;i<n;i++)probe('frameCount++;player.updatePlayer();');}
function press(q,kind='HIGH'){
 const r=fresh(q,kind);move(r.co,r.si);step(18);move(0,0);step(10);return r;
}
for(let q=0;q<4;q++)for(const end of [-1,1]){
 const r=fresh(q,'HIGH',end,30),root=P('[player.x,player.y]');
 aim(r.co-end*.8*r.si,r.si+end*.8*r.co);step(24);
 ok('aiming near an open end acquires a peek without pressing, face/end '+q+'/'+end,
   P("player.cover?.active&&player.cover.kind==='HIGH'&&!player.cover.attached&&player.cover.peek>.9"));
 ok('nearby acquisition never moves or snaps the root '+q+'/'+end,
   P('player.x')===root[0]&&P('player.y')===root[1]);
 ok('the nearby lean remains bounded and its head stays clear '+q+'/'+end,
   P('Math.hypot(coverUpperOffset(player).x,coverUpperOffset(player).y)<=COVER_LEAN_MAX+1e-7&&(()=>{const h=coverActorHitCenter(player,"HEAD");return coverRayClear(h.x,h.y,h.x,h.y,6);})()'));
 const before=r.normal();move(-r.co*.2,-r.si*.2);step(3);
 ok('an unpressed nearby peek never glues free movement '+q+'/'+end,r.normal()>before+3);
 move(0,0);aim(0,0);step(22);
 ok('releasing aim leaves an unpressed nearby peek '+q+'/'+end,P('!player.cover.active&&!coverRenderActive(player)'));
}
for(let q=0;q<4;q++)for(const kind of ['HIGH','LOW']){
 let r=press(q,kind),normal=r.normal();
 ok(kind+' pressing the face creates an attachment '+q,P('player.cover?.active&&player.cover.attached'));
 move(-r.co*.18-r.si*.95,-r.si*.18+r.co*.95);step(6);
 ok(kind+' shallow outward diagonal keeps the pressed normal position '+q,Math.abs(r.normal()-normal)<1e-7&&P('player.cover.active&&player.cover.attached'));
 const tangent=P(`-player.x*${r.si}+player.y*${r.co}`);
 ok(kind+' tangent travel remains free while attached '+q,Math.abs(tangent)>10);
 move(-r.co*.49,-r.si*.49);step(4);
 ok(kind+' a soft outward thumb drift does not detach '+q,Math.abs(r.normal()-normal)<1e-7&&P('player.cover.active'));
 move(-r.co*.7-r.si*.7,-r.si*.7+r.co*.7);step();
 ok(kind+' a firm outward diagonal releases on the first movement frame '+q,r.normal()>normal+.5&&P('!player.cover.active'));
 step(12);move(0,0);step(20);
 ok(kind+' leaving restores ordinary standing '+q,P("!coverRenderActive(player)&&actorStance(player)==='STAND'"));
}
for(let q=0;q<4;q++){
 const r=fresh(q,'HIGH',1,18);aim(r.co-.8*r.si,r.si+.8*r.co);move(r.co,r.si);step(18);move(0,0);step(12);
 ok('an aimed corner starts attached after a deliberate press '+q,P('player.cover.active&&player.cover.attached'));
 const before=r.normal();move(-r.co*.7,-r.si*.7);step();move(0,0);step(20);
 ok('a one-frame firm away push remains released while aim is held '+q,r.normal()>before+.5&&P('!player.cover.active&&!coverRenderActive(player)'));
 aim(0,0);step();aim(r.co-.8*r.si,r.si+.8*r.co);step(24);
 ok('fresh aim can start a nearby peek after an intentional exit '+q,P('player.cover.active&&!player.cover.attached'));
 move(r.co,r.si);step(12);move(0,0);step(8);
 ok('pressing back into the wall can attach again '+q,P('player.cover.active&&player.cover.attached'));
}
fresh(0,'HIGH',1,39);aim(1,.8);step(24);
ok('distant aiming cannot acquire a floating wall stance',P('!player.cover?.active'));
fresh(0,'HIGH',0,30);aim(1,0);step(24);
ok('a sealed wall midpoint cannot become a nearby peek',P('!player.cover?.active'));
fresh(0,'LOW',1,30);aim(1,.8);step(24);
ok('nearby aiming leaves approved low-cover contact behavior unchanged',P('!player.cover?.active'));
press(0);probe('latchWall.hp=0;invalidateColIndex();');move(-.2,.8);step();
ok('destroyed contact immediately releases weak outward movement',P('player.x<12&&!player.cover?.active'));
press(0);probe('player.lastMoveAngle=Math.PI;player.activateDash();');move(-1,0);step();
ok('dash exits pressed cover rather than being trapped by its movement filter',P('!player.cover?.active&&player.x<0'));
press(0,'LOW');probe('cyclePlayerStance();');step(22);
ok('manual stand can still release an attached low-cover stance',P("!player.cover.active&&actorStance(player)==='STAND'"));
console.log(`${checks}/${checks} nearby aim, wall attachment, joystick release and native movement checks passed.`);

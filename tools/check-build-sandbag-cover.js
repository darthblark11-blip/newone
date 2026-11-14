// The architecture reward is a physical, waist-high U of sandbags. Exercise
// placed structures and native rounds so an empty interior cannot accidentally
// become an opaque box, immunity volume, or one-way projectile shield.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness');
const P = code => probe('(' + code + ')');
let checks = 0, seed = 65021;
const ok = (label, value) => { assert.ok(value, label); checks++; };
ctx.setTimeout = () => 0;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  return a === undefined ? r : Array.isArray(a) ? a[Math.floor(r * a.length)] : b === undefined ? a * r : a + (b - a) * r;
};
const storage = new Map();
ctx.localStorage = { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };

function fresh() {
  probe(`chunkMgr=null;resetRunState();currentLevel=currentBiome=2;BIOME_ACTIVE=false;
    started=doTick=true;isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
    inOverworldView=false;window.inNM0SecretOverlay=false;townsData={};window.outpostForts={};
    authoredCore=authoredMask=authoredChunks=null;authoredSolids=[];authoredCars=[];biomeState={};
    viewLeft=viewTop=-10000;viewRight=viewBottom=10000;frameCount=100;MAX_KILLS=100000;totalKills=0;
    buildings=[];activeBuildings=[];bullets=[];particles=[];corpses=[];barrels=[];
    parkingCars=activeParkingCars=[];enemiesList=[];allies=[];townCitizens=[];buildSites=[];playerStructures=[];buildGhost=null;
    resetForestWildlife();invalidateColIndex();setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
    leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
    window.archLvl=2;window.archBarrierReady=true;window.popArchitectureM=window.popArchitectureF=0;
    player=new Character(-210,0,true);player.currentWeapon=WEAPONS.PISTOL;player.aimAngle=0;
    player.hp=player.maxHp=1000;player.shield=0;resetActorStance(player);
    buildBarrier();updateBuildPlacement();
    __preview={x:Math.round(buildGhost.x),y:Math.round(buildGhost.y),w:buildGhost.w,h:buildGhost.h};
    confirmBuildPlacement();__bags=playerStructures.find(b=>b.isUBarrier);
    __enemy=new Character(0,0,false,'NORMAL');__enemy.hp=__enemy.maxHp=1000;__enemy.shield=0;
    __enemy.currentWeapon=WEAPONS.PISTOL;__enemy.isFriendly=__enemy.isNeutral=false;
    resetActorStance(__enemy);enemiesList=[__enemy];`);
}
function setupShot(isPlayer = true, from = [0, -250], to = [0, 0], targetStance = 'STAND', shooterStance = 'STAND') {
  probe(`__shooter=${isPlayer ? 'player' : '__enemy'};__target=${isPlayer ? '__enemy' : 'player'};
    __shooter.x=${from[0]};__shooter.y=${from[1]};__target.x=${to[0]};__target.y=${to[1]};
    __shooter.aimAngle=Math.atan2(__target.y-__shooter.y,__target.x-__shooter.x);
    __target.aimAngle=__shooter.aimAngle+Math.PI;
    resetActorStance(__shooter,'${shooterStance}');resetActorStance(__target,'${targetStance}');`);
}
function shoot(zone = 'BODY') {
  probe(`__profile=stanceHitProfile(__target,'${zone}');
    __centre=coverActorHitCenter(__target,'${zone}',__profile?__profile.zone:'${zone}');
    __dx=__centre.x-__shooter.x;__dy=__centre.y-__shooter.y;
    __round=spawnBullet(__shooter.x,__shooter.y,Math.atan2(__dy,__dx),__shooter.isPlayer,'${zone}',WEAPONS.PISTOL,__shooter);
    __round.vx=__dx*1.15;__round.vy=__dy*1.15;frameCount++;updateBullets();`);
}
function brushNorthWall(aiming = false) {
  probe(`player.x=0;player.y=-68;player.aimAngle=-HALF_PI;
    for(let i=0;i<12;i++){frameCount++;updateActorCover(player,20,0,-6,${aiming});}`);
}

fresh();
ok('native placement matches the preview and consumes exactly one reward', P('__bags&&__bags.x===__preview.x&&__bags.y===__preview.y&&__bags.w===__preview.w&&__bags.h===__preview.h&&!window.archBarrierReady&&playerStructures.length===1&&buildSites.length===0'));
ok('the placed reward is waist-high cover', P("coverSolidKind(__bags)==='LOW'&&coverSolidRects(__bags).length===3"));
for (const actor of ['player', '__enemy']) {
  ok(actor + ' collides with all three actual sandbag walls', P(`${actor}.checkCol(-100,0)&&${actor}.checkCol(100,0)&&${actor}.checkCol(0,-100)`));
  ok(actor + ' can occupy the interior and enter through the open south', P(`![0,40,80,100,120,160].some(y=>${actor}.checkCol(0,y))`));
  ok(actor + ' can approach each wall from either side without a phantom full-box collider', P(`![[-68,0],[-132,0],[68,0],[132,0],[0,-68],[0,-132]].some(p=>${actor}.checkCol(p[0],p[1]))`));
}
ok('the ordinary standing sight query sees above the sandbags', P('hasLOS(0,-250,0,0)&&hasLOS(-250,0,0,0)'));
ok('height-aware low rays stop at the wall but cross the interior and south opening', P("!coverLineClear(0,-250,0,0,'LEGS',player)&&coverLineClear(0,60,0,-40,'LEGS',player)&&coverLineClear(0,0,0,250,'LEGS',player)"));
ok('corpse pieces collide with the walls but can pass through the south entrance', P('corpsePieceContact({},-100,0,6)&&!corpsePieceContact({},0,0,6)&&!corpsePieceContact({},0,110,6)'));

// The authored footprint stops at x=250 here, but the east wall extends to
// x=265, across the 256-unit crowd-grid boundary. Exercise the indexed path.
probe(`__bags.x=150;buildings=activeBuildings=[__bags];
  for(let i=0;i<20;i++)activeBuildings.push({x:10000+i*500,y:10000,w:40,h:40,isWall:true});
  invalidateColIndex();frameCount++;`);
ok('crowded height-aware rays find the outer wall beyond its authored AABB and grid cell', P(`!coverLineClear(260,-50,260,50,'LEGS',player)`));
probe(`enemiesList=[];player.x=-500;player.y=500;
  __round=spawnBullet(260,-140,HALF_PI,true,'LEGS',WEAPONS.PISTOL,player);
  __round.vx=0;__round.vy=280;frameCount++;updateBullets();`);
ok('crowded native projectile sweeps hit the outer fifteen units of the sandbag arm', P('!__round.active&&__bags.hp===980&&Math.abs(__round.x-260)<.01&&__round.y>=-100.01&&__round.y<=-99.9'));
// At x=80 the wall ends at 195. A 28-unit enemy at x=222 overlaps it
// across the movement index boundary at 220; the original rectangle did not.
probe('__bags.x=80;invalidateColIndex();');P('__enemy').eType='ARMORED';
ok('indexed movement includes wall thickness plus the largest actor radius', P('__enemy.checkCol(222,0)&&!__enemy.checkCol(224,0)'));

for (const isPlayer of [true, false]) for (const zone of ['BODY', 'HEAD']) {
  fresh();setupShot(isPlayer);shoot(zone);
  ok((isPlayer ? 'player' : 'enemy') + ' standing ' + zone + ' round clears the north wall and hits normally', P(`__target.hp===${zone === 'HEAD' ? 900 : 980}&&__target.decals.length===1&&__bags.hp===1000`));
}
for (const isPlayer of [true, false]) {
  fresh();setupShot(isPlayer);shoot('LEGS');
  ok((isPlayer ? 'player' : 'enemy') + ' leg shot is swept into the actual north wall and damages it', P('__target.hp===1000&&!__round.active&&__round.y>=-115.01&&__round.y<=-84.99&&__bags.hp===980'));
  fresh();setupShot(isPlayer, [0,-250], [0,0], 'STAND', 'CROUCH');shoot('BODY');
  ok((isPlayer ? 'player' : 'enemy') + ' crouched shot cannot pass through sandbags', P('__round.coverLaunchLow&&!__round.active&&__target.hp===1000&&__bags.hp===980'));
}
for (const [from, to, label] of [[[0,60],[0,-40],'interior'],[[0,0],[0,250],'open south']]) {
  fresh();probe('enemiesList=[];player.x=-500;player.y=500;');
  probe(`__round=spawnBullet(${from[0]},${from[1]},Math.atan2(${to[1]-from[1]},${to[0]-from[0]}),true,'LEGS',WEAPONS.PISTOL,player);
    __round.vx=${to[0]-from[0]};__round.vy=${to[1]-from[1]};frameCount++;updateBullets();`);
  ok('a low projectile crosses the ' + label + ' without hitting an invisible full barrier box', P('__round.active&&__bags.hp===1000'));
}

fresh();setupShot(false, [0,-250], [0,-68]);brushNorthWall();
ok('contact with the inside north wall uses normal automatic duck cover', P("player.cover.active&&player.cover.solid===__bags&&player.cover.kind==='LOW'&&actorStance(player)==='CROUCH'&&!player.checkCol(player.x,player.y)"));
ok('ducking hides the player behind the wall from humanoid sight', P('!shovelActorLOS(__enemy,player)'));
shoot();
ok('a standing body shot is stopped by the wall before a ducked player', P('player.hp===1000&&player.decals.length===0'));
brushNorthWall(true);shoot();
ok('aiming pops the player up and exposes the torso above the same wall', P("actorStance(player)==='STAND'&&player.hp===980"));
fresh();setupShot(false, [0,250], [0,-68]);brushNorthWall();
ok('a flanker can see the ducked player through the open rear', P('shovelActorLOS(__enemy,player)'));
shoot();
ok('being inside the U grants no damage immunity to a shot from the open rear', P('player.hp===900&&player.decals.some(d=>d.isHead)&&__bags.hp===1000'));

fresh();setupShot(false);probe('__bags.hp=20;');shoot('LEGS');
ok('the last low round destroys sandbags and removes every owned/world collider immediately', P('__bags.hp<=0&&!playerStructures.includes(__bags)&&!buildings.includes(__bags)&&!activeBuildings.includes(__bags)&&coverSolidKind(__bags)===null&&coverSolidRects(__bags).length===0&&!player.checkCol(0,-100)'));
probe("resetActorStance(player,'CROUCH');");shoot();
ok('the next round can reach a lowered player after the wall is destroyed', P('player.hp===900'));
probe('saveGame();loadGame();');
ok('a destroyed reward stays destroyed and spent after reload', P('!playerStructures.some(b=>b.isUBarrier)&&!window.archBarrierReady'));

fresh();probe(`enemiesList=[];player.x=0;player.y=-250;
  __round=spawnBullet(0,-250,HALF_PI,true,'LEGS',WEAPONS.ROCKET_LAUNCHER,player);
  __round.vx=0;__round.vy=300;frameCount++;updateBullets();`);
ok('a low rocket damages the sandbag wall it directly impacts', P('!__round.active&&__bags.hp===650'));
fresh();probe('triggerExplosion(0,-120,40,false,true,player);');
ok('an ordinary blast within reach of a physical wall damages it', P('__bags.hp===700'));
fresh();probe('triggerExplosion(0,0,30,false,true,player);');
ok('an explosion confined to the empty interior cannot damage a phantom full-box wall', P('__bags.hp===1000'));
fresh();probe('triggerExplosion(0,-120,40,true,true,player);');
ok('molotov flame does not apply structural blast damage', P('__bags.hp===1000'));

fresh();probe('__bags.hp=640;saveGame();');
const legacy = JSON.parse(storage.get('urbanTwinStickSave'));
delete legacy.archBarrierReady;
for (const b of legacy.playerBarriers) { delete b.coverType; delete b.coverHeight; delete b.lowCover; delete b.isLowWall; }
storage.set('urbanTwinStickSave', JSON.stringify(legacy));
probe('loadGame();__bags=playerStructures.find(b=>b.isUBarrier);');
ok('legacy saved barriers migrate to sandbag cover without refilling the spent reward', P("__bags&&__bags.hp===640&&__bags.maxHp===1000&&__bags.buildLevel===2&&coverSolidKind(__bags)==='LOW'&&coverSolidRects(__bags).length===3&&!window.archBarrierReady"));
// Loading regenerates this sector's authored forest; isolate the recovered
// structure before asking whether its own empty interior has a collider.
probe('buildings=activeBuildings=[__bags];invalidateColIndex();');
ok('legacy migration retains the open south and actual wall collision', P('!player.checkCol(__bags.x,__bags.y+110)&&!player.checkCol(__bags.x,__bags.y)&&player.checkCol(__bags.x-100,__bags.y)'));

fresh();probe(`playerStructures=[];buildings=activeBuildings=[];invalidateColIndex();
  window.archBarrierReady=true;buildBarrier();updateBuildPlacement();
  __obstruction={x:128,y:0,w:2,h:400,isAuthored:true};buildings=activeBuildings=[__obstruction];
  invalidateColIndex();updateBuildPlacement();`);
ok('placement reserves the outer half-thickness of the rendered walls', P('!buildGhost.ok&&!confirmBuildPlacement()&&window.archBarrierReady&&playerStructures.length===0'));
probe(`__scatter={x:110,y:0,w:2,h:2,isTreeTrunk:true,girth:1.2};
  buildings=activeBuildings=[__scatter];invalidateColIndex();updateBuildPlacement();
  window.resources={WOOD:0,METAL:0,STONE:0};resourceDrops=[];confirmBuildPlacement();`);
ok('the lot crew clears and salvages scatter underneath the outer half of a sandbag wall', P('!buildings.includes(__scatter)&&resourceCount(\'WOOD\')>0&&resourceDrops.length===0'));
ok('padded clearance retains the same authored wall centres and one-use architecture reward', P('playerStructures.length===1&&playerStructures[0].w===200&&playerStructures[0].h===200&&!window.archBarrierReady&&!buildGhost'));

// Record the real world queue rather than calling painters in a chosen order.
// Standing upper bodies clear the nearby waist-high sacks; ducked bodies stay
// behind those same sacks without pulling a distant part of a side arm forward.
function paintOrder(x,y,stance,wallIndex,tall=false) {
  fresh();
  if(tall)probe('__tall={x:172,y:20,w:20,h:40,isWall:true};buildings.push(__tall);activeBuildings=buildings;invalidateColIndex();');
  probe(`player.x=${x};player.y=${y};resetActorStance(player,'${stance==='POP'?'STAND':stance}');
    if('${stance}'==='POP')player.cover={active:true,kind:'LOW',blend:1,pop:1,peek:0,aiming:true,upper:{x:0,y:0}};
    __beforePaint={x:player.x,y:player.y,stance:actorStance(player)};__paintEvents=[];
    __paintSandbag=paintSandbagBarrierWall;__paintActor=player.show;__paintBuildings=drawBuildings;
    paintSandbagBarrierWall=function(g,b,wallIndex,opts){
      const r=coverSolidRects(b)[wallIndex];
      __paintEvents.push({type:'wall',wallIndex,strip:{x0:r.x0,x1:r.x1,
        y0:Number.isFinite(opts.clipY0)?Math.max(r.y0,opts.clipY0):r.y0,
        y1:Number.isFinite(opts.clipY1)?Math.min(r.y1,opts.clipY1):r.y1}});
    };
    drawBuildings=function(a,s=0,e=a.length){for(let i=s;i<e;i++)__paintEvents.push({type:'high',solid:a[i]});};
    player.show=function(){__paintEvents.push({type:'actor'});};
    try{_depthOn=true;actorShow(player);drawDepthSorted();}
    finally{paintSandbagBarrierWall=__paintSandbag;player.show=__paintActor;drawBuildings=__paintBuildings;}
    __actorPaintIndex=__paintEvents.findIndex(e=>e.type==='actor');
    __nearBagIndex=__paintEvents.findIndex(e=>e.type==='wall'&&e.wallIndex===${wallIndex}&&
      ${wallIndex===2?'e.strip.x0<=player.x&&e.strip.x1>=player.x':'e.strip.y0<=player.y&&e.strip.y1>=player.y'});
    __afterPaint={x:player.x,y:player.y,stance:actorStance(player)};`);
}
for(const [label,x,y,wallIndex] of [
  ['north outside',0,-132,2],['west inside',-68,0,0],['west outside',-132,0,0],
  ['east inside',68,0,1],['east outside',132,0,1]
]) {
  for(const stance of ['STAND','CROUCH']) {
    paintOrder(x,y,stance,wallIndex);
    ok(label+' '+stance+' uses the correct visible height at the nearest sack', P(`__nearBagIndex>=0&&${stance==='STAND'?'__nearBagIndex<__actorPaintIndex':'__nearBagIndex>__actorPaintIndex'}`));
    ok(label+' '+stance+' paint leaves the actor root and effective stance unchanged', P('JSON.stringify(__beforePaint)===JSON.stringify(__afterPaint)'));
    ok(label+' '+stance+' keeps distant south-arm sacks behind their own depth point', P('__paintEvents.every((e,i)=>e.type!==\'wall\'||e.wallIndex===2||e.strip.y0<60||i>__actorPaintIndex)'));
  }
}
paintOrder(132,0,'POP',1);
ok('a fully raised low-cover pop uses standing upper-body order above the nearest sack', P('__beforePaint.stance===\'STAND\'&&__nearBagIndex>=0&&__nearBagIndex<__actorPaintIndex'));
ok('painting a raised cover stance cannot change its root or effective height', P('JSON.stringify(__beforePaint)===JSON.stringify(__afterPaint)'));
paintOrder(132,0,'STAND',1,true);
ok('standing above low sandbags still stays behind a nearby taller wall in the original foreground', P('__paintEvents.findIndex(e=>e.type===\'high\'&&e.solid===__tall)>__actorPaintIndex'));
ok('a nearby tall wall does not undo the visible height over the directly adjacent sandbag', P('__nearBagIndex>=0&&__nearBagIndex<__actorPaintIndex'));
console.log(`${checks}/${checks} native sandbag geometry, cover height, two-way fire, open rear, destruction and legacy migration checks passed.`);

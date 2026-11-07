// Native Light Key access, physical floor/cover, finite northern security and
// campaign persistence for the authored white laboratory beyond the HQ.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=source=>probe('('+source+')');
let checks=0,seed=68123,pad=null;
const keys=new Set(),storage=new Map(),pending=[];
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.keyIsDown=code=>keys.has(code);
ctx.navigator.getGamepads=()=>pad?[pad]:[];
ctx.setTimeout=callback=>{pending.push(callback);return pending.length;};
ctx.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;
 return a===undefined?r:Array.isArray(a)?a[Math.floor(r*a.length)]:b===undefined?a*r:a+(b-a)*r;};
function fresh(){
 keys.clear();pad=null;ctx.touches=[];
 probe(`resetRunState();resetStoryProgress();isStoryMode=true;startAtLevel(8);
  started=doTick=true;isPaused=isDead=isWin=killcamMode=nm0AmbushActive=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
  inWorldBuildingMenu=inOverworldView=inTravelMenu=inUpgradeMenu=false;
  window.inNM0SecretOverlay=false;buildGhost=null;deltaTime=1000/60;
  leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
  activeBuildings=buildings;invalidateColIndex();player.hp=player.maxHp=10000;player.shield=10000;
  viewLeft=viewTop=-10000;viewRight=viewBottom=10000;`);
 pending.length=0;
}
function approach(){probe('player.x=NM0_NW_LAB.door.x;player.y=NM0_NW_LAB.door.y+110;');}
function open(){probe('window.nm0LightKey=true;window.northOpenedResult=openNM0NorthLab();');}
function maintain(){
 probe('for(let i=0;i<80;i++){frameCount=(Math.floor(frameCount/45)+1)*45;maintainHostiles();spawnSingleEnemy();spawnSingleEnemy(true);}');
 for(const callback of pending.splice(0))callback();
}

fresh();approach();
ok('the HQ still starts with only its original twenty finite main guards',
 P("!nm0NorthOpened&&enemiesList.length===20&&nm0HqRoomRemaining('MAIN')===20&&nm0HqRoomRemaining('NORTH')===0&&!window.nm0LightKey"));
ok('the northwest branch advertises Light Key access while the eastern branch stays sealed',
 P('HQ_BRANCH_DOORS.some(d=>d.x===-720&&!d.sealed&&d.lightKey)&&HQ_BRANCH_DOORS.some(d=>d.x===720&&d.sealed)'));
const otherBranches=P('JSON.stringify(HQ_BRANCH_DOORS.filter(d=>d.x!==-720))');
ok('the closed north door has an accessible native interaction requiring the Light Key',
 P("!player.checkCol(player.x,player.y)&&nm0OfficeInteraction()?.kind==='NORTH_DOOR'&&/LIGHT KEY/.test(nm0OfficeInteraction().label)"));
ok('neither the native interaction nor direct opening bypasses the missing key',
 !P('useNM0OfficeInteraction()')&&!P('openNM0NorthLab()')&&P("!nm0NorthOpened&&nm0HqRoomRemaining('NORTH')===0"));
ok('the closed threshold has real collision and blocks sight into the new hallway',
 P('player.checkCol(NM0_NW_LAB.door.x,NM0_NW_LAB.door.y)&&!hasLOS(-720,-2390,-720,-2630)'));
probe('for(let i=0;i<60;i++)player.attemptMove(0,-6);');
ok('ordinary movement cannot cross the locked door',P('player.y>-2450&&!player.checkCol(player.x,player.y)'));

for(const input of ['F','ENTER','TOUCH','GAMEPAD_A']){
 fresh();approach();probe('window.nm0LightKey=true;updateUndergroundRoute(16);');
 const before=P('({x:player.x,y:player.y})');
 if(input==='TOUCH'){
  ctx.mouseX=ctx.width/2;ctx.mouseY=ctx.height-95;
  ctx.touches=[{id:99,x:ctx.mouseX,y:ctx.mouseY}];probe('touchStarted();');ctx.touches=[];
 }else if(input==='GAMEPAD_A'){
  pad={index:0,connected:true,id:'north-lab-check',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  probe('updateUndergroundRoute(16);');pad.buttons[0].pressed=true;probe('updateUndergroundRoute(16);');
  pad=null;
 }else{
  keys.add(input==='F'?70:13);probe('updateUndergroundRoute(16);');keys.clear();probe('updateUndergroundRoute(16);');
 }
 ok(input+' opens the Light Key door through the existing interaction reader',P('nm0NorthOpened&&window.nm0LightKey'));
 ok(input+' opening removes the physical blocker without teleporting the player',
  P('!player.checkCol(NM0_NW_LAB.door.x,NM0_NW_LAB.door.y)&&!buildings.some(b=>b.nm0NorthDoor)&&!activeBuildings.some(b=>b.nm0NorthDoor)')&&
  P('player.x')===before.x&&P('player.y')===before.y);
 ok(input+' creates precisely twelve canonical native rifle guards once',
  P("nm0HqRoomRemaining('NORTH')===12&&enemiesList.filter(e=>e.nm0HqRoom==='NORTH').every(e=>e.eType==='NM0_CITY_GUARD'&&e.currentWeapon===WEAPONS.ASSAULT_RIFLE&&!e.cityPersonKey&&!e.checkCol(e.x,e.y))"));
}
ok('the opened doorway clears native sight from the HQ into the hallway',P('hasLOS(-720,-2390,-720,-2630)'));
ok('the north wing preserves the central descent and sealed eastern branch',P('JSON.stringify(HQ_BRANCH_DOORS.filter(d=>d.x!==-720))')===otherBranches);
ok('the new security is separate from side offices, scientists and the main archive',
 P("enemiesList.length===32&&new Set(enemiesList.map(e=>e.nm0HqGuardId)).size===32&&nm0Scientists.length===3&&!nm0OfficeOpened.WEST&&!nm0OfficeOpened.EAST&&!window.nm0HqCleared"));
ok('repeated opening cannot duplicate the twelve-guard encounter',!P('openNM0NorthLab()')&&P("nm0HqRoomRemaining('NORTH')===12"));
maintain();
ok('generic maintenance and delayed spawns cannot refill or enlarge north security',P("enemiesList.length===32&&nm0HqRoomRemaining('NORTH')===12"));

probe(`window.northBlocked=[];
 for(let y=-2400;y>=-4800;y-=10)if(player.checkCol(-720,y))northBlocked.push([-720,y]);
 for(const x of [-1050,-390]){
  for(let xx=-720;x< -720?xx>=x:xx<=x;xx+=x< -720?-10:10)
   if(player.checkCol(xx,-4800))northBlocked.push([xx,-4800]);
  for(let y=-4800;y>=-5250;y-=10)if(player.checkCol(x,y))northBlocked.push([x,y]);
 }
 for(let x=-1050;x<=-390;x+=10)if(player.checkCol(x,-5250))northBlocked.push([x,-5250]);`);
ok('the complete center hallway and both side approaches to the portal remain walkable',P('northBlocked.length===0'));
ok('the white laboratory and hallway have enclosing physical boundaries',
 P(`player.checkCol(NM0_NW_LAB.corridor.x0-15,-3500)&&player.checkCol(NM0_NW_LAB.corridor.x1+15,-3500)&&
  player.checkCol(NM0_NW_LAB.room.x0-15,-4900)&&player.checkCol(NM0_NW_LAB.room.x1+15,-4900)&&
  player.checkCol(-720,NM0_NW_LAB.room.y0-15)&&player.checkCol(-1400,NM0_NW_LAB.room.y1+15)`));
ok('the portal machine and robot dissection benches are native solid cover',
 P("player.checkCol(NM0_NW_LAB.portal.x,NM0_NW_LAB.portal.y)&&buildings.filter(b=>b.hqWhiteLab&&b.hqProp==='ROBOT_BENCH').length>=4&&buildings.filter(b=>b.hqWhiteLab&&b.hqProp==='ROBOT_BENCH').every(b=>b.lowCover&&player.checkCol(b.x,b.y))"));
ok('the old and new indoor floor rectangles meet continuously along the walked route',
 P(`(()=>{for(let y=-2400;y>=-5250;y-=10)if(!NM0_LAB_FLOOR_RECTS.some(r=>-720>=r.x0&&-720<=r.x1&&y>=r.y0&&y<=r.y1))return false;
  return [-1050,-390].every(x=>[-4800,-5250].every(y=>NM0_LAB_FLOOR_RECTS.some(r=>x>=r.x0&&x<=r.x1&&y>=r.y0&&y<=r.y1)));})()`));

// The existing tile cache may cover many more rooms; its backing surfaces must
// remain bounded and its cropped draws must stay within the floor union.
let allocated=0,removed=0;const nativeGraphics=ctx.createGraphics,nativeImage=ctx.image,crops=[];
ctx.createGraphics=(...a)=>{allocated++;const g=nativeGraphics(...a),remove=g.remove;g.remove=()=>{removed++;remove();};return g;};
ctx.image=(...a)=>{if(a.length>=9)crops.push({x:a[1],y:a[2],w:a[3],h:a[4]});return nativeImage(...a);};
try{
 probe(`resetNM0LabFloor();
  for(const bounds of [[-1000,1000,-2500,1500],[-1100,-350,-4400,-2400],[-1800,400,-6100,-4250],[-3100,3100,-6200,1600]]){
   [viewLeft,viewRight,viewTop,viewBottom]=bounds;drawNM0LabGround();
   if(nm0LabFloorCache.size>24)throw Error('North laboratory exceeded its floor-cache bound');
  }`);
 ok('travel across all lab rooms keeps at most twenty-four baked floor surfaces',P('nm0LabFloorCache.size<=24&&NM0_LAB_FLOOR_CACHE_LIMIT===24')&&allocated>24&&removed>0);
 const floors=P('NM0_LAB_FLOOR_RECTS');
 ok('cropped floor tiles never paint the outdoor void between indoor spaces',crops.length>0&&crops.every(c=>floors.some(r=>c.x>=r.x0&&c.y>=r.y0&&c.x+c.w<=r.x1&&c.y+c.h<=r.y1)));
 const before=allocated;probe('viewLeft=-1200;viewRight=-250;viewTop=-3900;viewBottom=-2850;drawNM0LabGround();');
 const stationary=allocated;probe('drawNM0LabGround();');
 ok('a stationary hall view reuses its baked tiles',allocated===stationary&&stationary>=before);
 probe('resetNM0LabFloor();');ok('reset releases all allocated north floor backing surfaces',removed===allocated&&P('nm0LabFloorCache.size===0'));
}finally{ctx.createGraphics=nativeGraphics;ctx.image=nativeImage;}

fresh();open();
probe(`player.x=-720;player.y=-3300;window.northShooter=enemiesList.find(e=>e.nm0HqRoom==='NORTH');
 northShooter.x=-720;northShooter.y=-3600;northShooter.aimAngle=HALF_PI;
 northShooter.state='CHASE';northShooter.fireTimer=northShooter.reloadTimer=0;northShooter.ammo=northShooter.currentWeapon.maxAmmo;
 bullets=[];for(let i=0;i<240&&!bullets.some(b=>b.shooter===northShooter);i++){
  frameCount++;deltaTime=1000/60;northShooter.updateEnemy();}`);
ok('canonical north guards use their native rifle AI to fire down the physical hallway',
 P('bullets.some(b=>b.active&&b.shooter===northShooter&&!b.isP)&&!northShooter.checkCol(northShooter.x,northShooter.y)'));

fresh();open();
probe(`for(const e of enemiesList)if(e.nm0HqRoom==='NORTH')e.hp=0;
 doTick=false;updateEntities();isPaused=true;frameCount++;draw();`);
ok('north casualties drain only north security and cannot unlock the main archive',
 P("nm0HqRoomRemaining('NORTH')===0&&nm0HqRoomRemaining('MAIN')===20&&totalKills===12&&!window.nm0HqCleared"));
probe(`for(const e of enemiesList.filter(e=>e.nm0HqRoom==='MAIN').slice(0,8))e.hp=0;
 updateEntities();frameCount++;draw();isPaused=false;doTick=true;`);
ok('twenty mixed north and main kills still leave the original archive locked',
 P("totalKills===20&&nm0HqRoomRemaining('MAIN')===12&&!window.nm0HqCleared"));
maintain();ok('a cleared north encounter never repopulates and retains the Light Key',P("nm0HqRoomRemaining('NORTH')===0&&nm0NorthOpened&&window.nm0LightKey&&!openNM0NorthLab()"));

fresh();probe("openNM0Office('WEST');openNM0Office('EAST');");open();
ok('all three optional wings can coexist with the twenty original guards',
 P("enemiesList.length===48&&nm0HqRoomRemaining('NORTH')===12&&nm0Scientists.length===9"));
probe(`for(const e of enemiesList)if(['NORTH-0','NORTH-1'].includes(e.nm0HqGuardId))e.hp=0;
 doTick=false;updateEntities();doTick=true;
 window.northSurvivor=enemiesList.find(e=>e.nm0HqGuardId==='NORTH-2');northSurvivor.hp=137;northSurvivor.ammo=3;
 player.x=-720;player.y=-3400;saveGame();`);
const saved=JSON.parse(storage.get('urbanTwinStickSave'));
ok('campaign saves record the opened north door, retained key and only surviving guards',
 saved.nm0Hq.northOpened&&saved.nm0Hq.lightKey&&saved.nm0Hq.guards.filter(e=>e.room==='NORTH').length===10&&
 !saved.nm0Hq.guards.some(e=>['NORTH-0','NORTH-1'].includes(e.id)));
probe('loadGame();activeBuildings=buildings;invalidateColIndex();');
ok('loading preserves partial north losses, health, ammunition and native guard types',
 P("nm0NorthOpened&&window.nm0LightKey&&nm0HqRoomRemaining('NORTH')===10&&enemiesList.length===46&&!enemiesList.some(e=>['NORTH-0','NORTH-1'].includes(e.nm0HqGuardId))&&enemiesList.find(e=>e.nm0HqGuardId==='NORTH-2').hp===137&&enemiesList.find(e=>e.nm0HqGuardId==='NORTH-2').ammo===3&&enemiesList.filter(e=>e.nm0HqRoom==='NORTH').every(e=>e.eType==='NM0_CITY_GUARD')"));
ok('loading preserves a clear opened threshold and the saved hallway position',
 P('player.x===-720&&player.y===-3400&&!player.checkCol(player.x,player.y)&&!player.checkCol(NM0_NW_LAB.door.x,NM0_NW_LAB.door.y)'));
probe('window.northSnapshot=serializeNM0Hq();restoreNM0Hq(northSnapshot);restoreNM0Hq(northSnapshot);');
ok('repeated restores cannot duplicate north guards or office scientists',P("nm0HqRoomRemaining('NORTH')===10&&enemiesList.length===46&&nm0Scientists.length===9"));
maintain();ok('generic spawning after load cannot resurrect defeated north guards',P("nm0HqRoomRemaining('NORTH')===10&&enemiesList.length===46"));
probe('window.northLegacy=JSON.parse(JSON.stringify(northSnapshot));delete northLegacy.northOpened;restoreNM0Hq(northLegacy);');
ok('older office saves keep the new north wing locked without hidden guards',
 P("!nm0NorthOpened&&window.nm0LightKey&&nm0HqRoomRemaining('NORTH')===0&&nm0HqRoomRemaining('MAIN')===20&&player.checkCol(NM0_NW_LAB.door.x,NM0_NW_LAB.door.y)"));
fresh();
ok('a new campaign relocks the north wing and resets the key and finite roster',
 P("!nm0NorthOpened&&!window.nm0LightKey&&enemiesList.length===20&&nm0HqRoomRemaining('NORTH')===0&&buildings.some(b=>b.nm0NorthDoor)"));
console.log(`${checks}/${checks} native NM-0 north laboratory access, collision, finite combat, floor cache and persistence checks passed.`);

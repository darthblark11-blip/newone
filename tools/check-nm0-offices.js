// The new side offices share native HQ geometry, finite combat rosters,
// scientist escape routes, interaction readers and campaign persistence.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,seed=82130,pad=null;
const keys=new Set(),storage=new Map(),pending=[];
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.keyIsDown=code=>keys.has(code);
ctx.navigator.getGamepads=()=>pad?[pad]:[];
ctx.setTimeout=fn=>{pending.push(fn);return pending.length;};
ctx.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;
 return a===undefined?r:Array.isArray(a)?a[Math.floor(r*a.length)]:b===undefined?r*a:a+r*(b-a);};
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
  activeBuildings=buildings;invalidateColIndex();player.hp=player.maxHp=10000;player.shield=10000;`);
 pending.length=0;
}
function approach(id){probe(`window.office=NM0_OFFICES.find(r=>r.id==='${id}');
 player.x=office.door.x-office.side*110;player.y=office.door.y;`);}
function tapPrompt(){
 ctx.mouseX=ctx.width/2;ctx.mouseY=ctx.height-95;
 ctx.touches=[{id:99,x:ctx.mouseX,y:ctx.mouseY}];probe('touchStarted();');ctx.touches=[];
}
function connect(){pad={index:0,connected:true,id:'office-test',axes:[0,0,0,0],
 buttons:Array.from({length:17},()=>({pressed:false,value:0}))};}
function maintain(){
 probe('for(let i=0;i<60;i++){frameCount=(Math.floor(frameCount/45)+1)*45;maintainHostiles();spawnSingleEnemy();spawnSingleEnemy(true);}');
 for(const fn of pending.splice(0))fn();
}

fresh();
ok('new side doors start closed independently of the existing north branches',
 P("NM0_OFFICES.length===2&&NM0_OFFICES.every(r=>Math.abs(r.door.x)===1000&&r.door.y===800&&!nm0OfficeOpened[r.id])&&HQ_BRANCH_DOORS.filter(d=>d.sealed).every(d=>Math.abs(d.x)===720&&d.y===-2440)"));
ok('unopened offices add no premature guards or fleeing scientists',
 P("enemiesList.length===20&&nm0HqRoomRemaining('MAIN')===20&&nm0Scientists.length===3&&nm0Scientists.every(a=>a.nm0HqRoom==='MAIN')"));
ok('the opening room gains native low cover without blocking its arrival',
 P("buildings.filter(b=>b.hqProp==='BENCH'&&b.y>500).length>=4&&!player.checkCol(0,1200)"));
const northDoors=P('JSON.stringify(HQ_BRANCH_DOORS)');

for(const id of ['WEST','EAST']){
 approach(id);
 ok(id+' has a reachable interaction on the inside of the side wall',
  P(`!player.checkCol(player.x,player.y)&&nm0OfficeInteraction()?.room.id==='${id}'`));
 ok(id+' closed door physically blocks its corridor',P('player.checkCol(office.door.x,office.door.y)'));
 ok(id+' closed door blocks native sight through the side threshold',
  P('!hasLOS(office.door.x-office.side*110,office.door.y,office.door.x+office.side*110,office.door.y)'));
 const before=P('({x:player.x,y:player.y})');
 if(id==='WEST')tapPrompt();
 else{
  probe('updateUndergroundRoute(16);');keys.add(70);probe('updateUndergroundRoute(16);');
  keys.clear();probe('updateUndergroundRoute(16);');
 }
 ok(id+' native '+(id==='WEST'?'touch':'keyboard')+' interaction opens the office',P(`nm0OfficeOpened.${id}`));
 ok(id+' opening removes the real blocker without teleporting the player',
  P('!player.checkCol(office.door.x,office.door.y)&&!buildings.some(b=>b.nm0OfficeDoor===office.id)&&!activeBuildings.some(b=>b.nm0OfficeDoor===office.id)')&&
  P('player.x')===before.x&&P('player.y')===before.y);
 ok(id+' opening clears sight through the side doorway',
  P('hasLOS(office.door.x-office.side*110,office.door.y,office.door.x+office.side*110,office.door.y)'));
 probe(`window.officeBlockedPath=false;
  for(let u=850;u<=1540;u+=10)if(player.checkCol(office.side*u,800))officeBlockedPath=true;
  for(let y=-480;y<=1300;y+=10)if(player.checkCol(office.side*2130,y))officeBlockedPath=true;`);
 ok(id+' entrance hall and office spine are physically walkable',!P('officeBlockedPath'));
 ok(id+' creates exactly eight finite armored guards on clear floor',
  P(`nm0HqRoomRemaining('${id}')===8&&enemiesList.filter(e=>e.nm0HqRoom==='${id}').every(e=>e.eType==='ARMORED_STANDARD'&&!e.checkCol(e.x,e.y))`));
 ok(id+' adds three unarmed scientists outside the combat roster',
  P(`nm0Scientists.filter(a=>a.nm0HqRoom==='${id}').length===3&&nm0Scientists.filter(a=>a.nm0HqRoom==='${id}').every(a=>a.isNM0Scientist&&a.isUnarmed&&!a.isArmed&&!enemiesList.includes(a)&&!a.checkCol(a.x,a.y))`));
 ok(id+' repeated opening cannot duplicate its encounter',!P(`openNM0Office('${id}')`));
}
ok('both offices preserve all original north branches and descent geometry',P('JSON.stringify(HQ_BRANCH_DOORS)')===northDoors);
ok('the complete authored HQ roster contains only thirty-six finite guards',P('enemiesList.length===36&&new Set(enemiesList.map(e=>e.nm0HqGuardId)).size===36'));
maintain();
ok('maintenance and delayed generic spawns cannot increase the office roster',P('enemiesList.length===36'));

probe(`window.officeStaffBlocked=0;
 for(let i=0;i<650;i++){frameCount++;updateNM0Scientists();
  if(nm0Scientists.some(a=>a.checkCol(a.x,a.y)))officeStaffBlocked++;}`);
ok('all nine staff follow collision-safe native escape routes',P('officeStaffBlocked===0'));
ok('office scientists reach their authored cover and remain crouched',
 P("nm0Scientists.length===9&&nm0Scientists.every(a=>a.scientistState==='CROUCH'&&a.scientistCrouch===1&&!a.isMoving)"));
ok('scientist escapes add no damage, projectiles, kills or guards',P('bullets.length===0&&totalKills===0&&enemiesList.length===36'));

// Office kills must not bypass the original twenty-guard archive encounter.
probe(`for(const e of enemiesList)if(e.nm0HqRoom!=='MAIN')e.hp=0;
 for(const e of enemiesList.filter(e=>e.nm0HqRoom==='MAIN').slice(0,4))e.hp=0;
 doTick=false;updateEntities();isPaused=true;frameCount++;draw();`);
ok('twenty mixed office/main kills leave the original archive locked',
 P("totalKills===20&&nm0HqRoomRemaining('MAIN')===16&&!window.nm0HqCleared"));
probe(`for(const e of enemiesList)e.hp=0;updateEntities();frameCount++;draw();isPaused=false;doTick=true;`);
ok('defeating the original main-room roster unlocks its archive',P("nm0HqRoomRemaining('MAIN')===0&&window.nm0HqCleared"));
maintain();
ok('cleared side encounters stay empty without replacements or reopening',
 P("enemiesList.length===0&&nm0OfficeOpened.WEST&&nm0OfficeOpened.EAST&&!openNM0Office('WEST')&&!openNM0Office('EAST')"));

// The Light Key is one persistent collectible, separate from the blueprint.
probe(`window.eastOffice=NM0_OFFICES.find(r=>r.id==='EAST');player.x=eastOffice.key.x-140;player.y=eastOffice.key.y;
 updateUndergroundRoute(16);`);
ok('the single Light Key has a clear reachable approach',P("!player.checkCol(player.x,player.y)&&nm0OfficeInteraction()?.kind==='KEY'&&!window.nm0LightKey"));
connect();probe('updateUndergroundRoute(16);');pad.buttons[0].pressed=true;probe('updateUndergroundRoute(16);');
ok('gamepad A collects the Light Key through the native interaction reader',P('window.nm0LightKey'));
probe('updateUndergroundRoute(16);');
ok('holding collect cannot duplicate a key or modify the blueprint',P('serializeNM0Hq().lightKey===true&&!nm0OfficeInteraction()&&!window.armorBlueprintPickedUp'));
pad=null;
const ellipses=[],ellipse=ctx.ellipse;ctx.ellipse=(...args)=>ellipses.push(args);
probe('drawNM0LightSymbol(0,0,10);');ctx.ellipse=ellipse;
ok('the Light Key symbol is one circle with a centered dot',
 JSON.stringify(ellipses)===JSON.stringify([[0,0,20,20],[0,0,6,6]]));
probe('saveGame();');
const saved=JSON.parse(storage.get('urbanTwinStickSave'));
ok('campaign saves record cleared office rosters and key ownership',
 saved.nm0Hq.lightKey&&saved.nm0Hq.opened.WEST&&saved.nm0Hq.opened.EAST&&saved.nm0Hq.guards.length===0);
probe('loadGame();activeBuildings=buildings;invalidateColIndex();');
ok('loading preserves key ownership and cleared encounters without duplicate guards',
 P('window.nm0LightKey&&nm0OfficeOpened.WEST&&nm0OfficeOpened.EAST&&enemiesList.length===0&&nm0Scientists.length===9&&window.nm0HqCleared'));
ok('loading preserves opened side-door collision and safe saved position',
 P('!player.checkCol(player.x,player.y)&&NM0_OFFICES.every(r=>!player.checkCol(r.door.x,r.door.y))'));
probe('window.officeSnapshot=serializeNM0Hq();restoreNM0Hq(officeSnapshot);restoreNM0Hq(officeSnapshot);');
ok('restoring the same snapshot twice cannot duplicate staff or guards',P('nm0Scientists.length===9&&enemiesList.length===0'));
probe('resetRunState();resetStoryProgress();startAtLevel(8);');
ok('a new campaign resets offices and Light Key to one available pickup',
 P("!window.nm0LightKey&&!nm0OfficeOpened.WEST&&!nm0OfficeOpened.EAST&&enemiesList.length===20&&nm0Scientists.length===3"));

fresh();probe(`openNM0Office('WEST');enemiesList.find(e=>e.nm0HqGuardId==='WEST-0').hp=0;
 doTick=false;updateEntities();window.partialGuard=enemiesList.find(e=>e.nm0HqGuardId==='WEST-1');
 partialGuard.hp=137;partialGuard.ammo=3;saveGame();loadGame();`);
ok('a partly defeated office restores only surviving guards and their health/ammunition',
 P("enemiesList.length===27&&nm0HqRoomRemaining('WEST')===7&&!enemiesList.some(e=>e.nm0HqGuardId==='WEST-0')&&enemiesList.find(e=>e.nm0HqGuardId==='WEST-1').hp===137&&enemiesList.find(e=>e.nm0HqGuardId==='WEST-1').ammo===3"));
ok('partial progress cannot open the other office or create its staff or key',
 P("nm0OfficeOpened.WEST&&!nm0OfficeOpened.EAST&&nm0Scientists.length===6&&!window.nm0LightKey&&buildings.some(b=>b.nm0OfficeDoor==='EAST')&&!window.nm0HqCleared"));

for(const id of ['WEST','EAST']){
 fresh();probe(`openNM0Office('${id}');window.office=NM0_OFFICES.find(r=>r.id==='${id}');
  player.x=office.side*1900;player.y=850;
  window.officeShooter=enemiesList.find(e=>e.nm0HqGuardId==='${id}-0');
  bullets=[];for(let i=0;i<240&&!bullets.some(b=>b.shooter===officeShooter);i++){
    frameCount++;deltaTime=1000/60;officeShooter.updateEnemy();}`);
 ok(id+' guards use native combat to return fire inside the office',
  P('bullets.some(b=>b.active&&b.shooter===officeShooter&&!b.isP)&&!officeShooter.checkCol(officeShooter.x,officeShooter.y)'));
}

console.log(`${checks}/${checks} native NM-0 side-office access, combat, staff, Light Key and persistence checks passed.`);

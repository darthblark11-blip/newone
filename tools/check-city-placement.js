// Residents stay 300 HUD metres from NM-0 strongholds and enter the world unseen.
// Run with: node tools/check-city-placement.js
const assert=require('assert');
const {probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(condition,label)=>{checks++;assert(condition,label);};
probe('isStoryMode=false;startAtLevel(1);started=true;doTick=true;');
function reset(story=false) {
  probe(`currentLevel=1;currentBiome=1;isStoryMode=${story};doTick=true;
    activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();
    enemiesList=[];biomeState={};townsData={};cityNoise=[];cityPeopleFrame=-99;
    authoredChunks=null;authoredCore=null;authoredMask=null;nm0AmbushActive=false;
    window.northGateBreached=false;window.northGateBreachedStatus=false;window.southGateBreachedStatus=false;
    window.outpostForts={};window.mgr={biome:1,chunks:new Map()};`);
}
function camera(x,y,z=2,panX=0,panY=0,shake=0) {
  probe(`zoom=${z};screenShake=${shake};camX=${x}+${panX}-width/zoom/2;camY=${y}+${panY}-height/zoom/2;
    window.pad=screenShake>0?screenShake/zoom+8:0;
    viewLeft=camX-pad;viewRight=camX+width/zoom+pad;
    viewTop=camY-pad;viewBottom=camY+height/zoom+pad;`);
}
function loadChunk(cx,cy) {
  probe(`mgr.chunks.set("${cx},${cy}",{solid:[]});player.x=${cx*1200+600};player.y=${cy*1200+600};`);
}
function refresh(cx,cy,ticks=4) {
  probe(`for(let i=0;i<${ticks};i++){frameCount+=21;refreshCityPeople(mgr,${cx},${cy});}`);
}
function onlyResident(cx,cy,n,record) {
  probe(`window.table=getBiomeState(1).cityPeople={};for(let n=0;n<10;n++)table["${cx},${cy},people:"+n]={dead:true};`);
  if(record)probe(`table["${cx},${cy},people:${n}"]=${JSON.stringify(record)};`);
  else probe(`delete table["${cx},${cy},people:${n}"];`);
}

// The whole opening enclosure is reserved in story mode, including its walls.
reset(true);
for(const [x,y] of [[0,0],[-4700,600],[5900,600],[600,-4600],[600,5800]])
  ok(!P(`cityCivilianAllowed(${x},${y})`),`story enclosure admits civilian at ${x},${y}`);
for(const [x,y] of [[-12000,600],[17000,600],[600,-12000],[600,20000]])
  ok(P(`cityCivilianAllowed(${x},${y})`),`distant story city incorrectly excluded at ${x},${y}`);
probe('isStoryMode=false;');
ok(!P('cityCivilianAllowed(0,0)'),'arcade inner city ignored the 300-metre gate buffer');

// The main fortress and relay compound stay off limits after liberation.
const forbidden=[[600,-4200],[600,5400],[7200,10800],[7200,9500],[8700,10800],
  [-5000,600],[6200,600],[600,-5000],[600,6600],[9600,10800]];
for(const story of [false,true]) {
  probe(`isStoryMode=${story};window.northGateBreached=true;window.northGateBreachedStatus=true;
    window.southGateBreachedStatus=true;outpostFortState(1).breached=true;outpostFortState(1).captured=true;`);
  for(const [x,y] of forbidden)
    ok(!P(`cityCivilianAllowed(${x},${y})`),`open/captured fortress admits civilian in ${story?'story':'arcade'} at ${x},${y}`);
}
// HUD distances use ten world units per metre. These independent fixtures
// cover the 3,000-unit clearance from both fortresses' outer wall faces,
// plus the default 15-unit actor margin. A boundary tangent remains blocked.
const bufferEdges=[
  {name:'north slab top',x:600,y:-7615,dx:0,dy:-1},
  {name:'main curtain wall west',x:-7715,y:-4200,dx:-1,dy:0},
  {name:'main curtain wall east',x:8915,y:-4200,dx:1,dy:0},
  {name:'south slab bottom',x:-6000,y:8815,dx:0,dy:1},
  {name:'relay west wall',x:2675,y:14000,dx:-1,dy:0},
  {name:'relay east wall',x:11725,y:10800,dx:1,dy:0},
  {name:'relay north wall',x:11000,y:6475,dx:0,dy:-1},
  {name:'relay south wall',x:7200,y:15125,dx:0,dy:1}
];
for(const story of [false,true]) {
  probe(`isStoryMode=${story};`);
  for(const {name,x,y,dx,dy} of bufferEdges) {
    ok(!P(`cityCivilianAllowed(${x-dx*.001},${y-dy*.001})`),`${name} admitted a civilian just inside its buffer`);
    ok(!P(`cityCivilianAllowed(${x},${y})`),`${name} admitted a tangent civilian`);
    ok(P(`cityCivilianAllowed(${x+dx*.001},${y+dy*.001})`),`${name} excluded a civilian just beyond its buffer`);
  }
}
ok(!P('cityCivilianAllowed(8800,-7500)'),'main fortress corner escaped the curtain-wall buffer');
ok(!P('cityCivilianAllowed(8900,-4200,0)'),'300-metre gate distance omitted the boundary');
ok(P('cityCivilianAllowed(8900.001,-4200,0)'),'explicit zero actor margin changed the gate clearance');
ok(!P('cityCivilianAllowed(8900.001,-4200)'),'default actor margin was lost');
ok(!P('cityCivilianAllowed(11710,10800,0)'),'300-metre relay distance omitted the outer wall face');
ok(P('cityCivilianAllowed(11710.001,10800,0)'),'relay clearance measured from its centreline');
ok(P('cityCivilianAllowed(600,-9000)'),'former 700-metre restriction still excludes a block beyond 300 metres');
probe('currentLevel=2;');
ok(P('cityCivilianAllowed(0,0)'),'Level 1 restrictions leaked into another level');

// Exercise the population layer, not just the predicates.
reset(true);loadChunk(0,0);camera(600,600);refresh(0,0);
ok(P('enemiesList.length===0'),'story opening enclosure populated');
reset(false);loadChunk(0,0);camera(600,600);refresh(0,0);
ok(P('!enemiesList.some(e=>e.isCityCivilian)'),'arcade inner city populated inside the gate buffer');
reset(true);loadChunk(0,5);camera(600,6600);refresh(0,5);
ok(P('!enemiesList.some(e=>e.isCityCivilian)'),'story civilians populated just outside the south gate');
reset(true);loadChunk(-12,0);camera(-13800,600);refresh(-12,0);
ok(P('enemiesList.filter(e=>e.isCityCivilian).length===6'),'distant story blocks lost their civilians');
ok(P('enemiesList.every(e=>e.isCityCivilian&&!e.isPopulation)'),'story created extra ambient military guards');
reset(true);loadChunk(0,-8);camera(600,-9000);refresh(0,-8);
ok(P('enemiesList.filter(e=>e.isCityCivilian).length===6'),'civilian blocks between the former and current fortress buffers failed to populate');
ok(P('enemiesList.every(e=>cityCivilianAllowed(e.x,e.y)&&!inView(e.x,e.y,100))'),'closer civilians bypassed the 300-metre or off-screen spawn rule');

// A wholly visible chunk remains empty; zooming in provides safe hidden points.
reset(false);loadChunk(50,41);camera(60600,49800,.66);refresh(50,41);
ok(P('enemiesList.length===0'),'new residents appeared inside visible camera bounds');
camera(60600,49800,2);refresh(50,41);
ok(P('enemiesList.filter(e=>e.isCityCivilian).length===6'),'deferred civilians failed to appear after camera change');

// A saved resident waits at its saved location, then keeps its identity/state.
reset(false);loadChunk(50,41);camera(60600,49800);
onlyResident(50,41,0,{x:60600,y:49800,hp:61,dead:false,stun:0,panic:45,px:60400,py:49800,d:123});
refresh(50,41);
ok(P('enemiesList.length===0'),'saved visible resident reappeared on screen');
ok(P('table["50,41,people:0"].x===60600&&table["50,41,people:0"].hp===61'),'defer mutated saved resident');
camera(60600,49800,2,800);refresh(50,41);
ok(P('enemiesList.length===1&&enemiesList[0].cityPersonKey==="50,41,people:0"&&enemiesList[0].hp===61&&enemiesList[0].panicTimer===45'),'saved off-screen resident lost its state');

// Old records do not bypass the new geography rules, even when out of view.
for(const [story,x,y] of [[true,600,600],[false,600,5400],[false,7200,10800],
  [true,-5000,600],[false,600,6600],[false,9600,10800]]) {
  reset(story);loadChunk(0,5);
  probe(`player.x=${x+1000};player.y=${y};`);camera(x+1000,y);
  onlyResident(0,5,0,{x,y,hp:100,dead:false,stun:0,d:0});refresh(0,5);
  ok(P('enemiesList.length===0'),`saved resident spawned in restricted area ${x},${y}`);
}

// An ambush releases existing ambient civilians and stops candidate searching.
// Saved injuries, panic, stun pose and deaths must survive that suspension.
reset(true);loadChunk(50,41);camera(60600,49800);refresh(50,41);
probe(`window.resident=enemiesList[0];window.residentKey=resident.cityPersonKey;
  resident.aimAngle=PI;rememberFigureMotion(resident,0,0);startPunchStun(resident,0);
  for(let i=0;i<60;i++)advanceStun(resident);
  resident.hp=61;resident.panicTimer=45;resident.panicX=60400;resident.panicY=49800;
  window.savedAge=resident.stunPose.age;window.savedTimer=resident.stunTimer;
  window.deadResident=enemiesList[1];window.deadKey=deadResident.cityPersonKey;
  deadResident.hp=0;deadResident.dead=true;
  window.recruit=new Character(61000,49900,false,"FARMER_MALE");recruit.isPopulation=true;
  window.military=new Character(61100,49900,false,"NM0_CITY_GUARD");military.isFriendly=true;military.isMilitary=true;
  enemiesList.push(recruit,military);nm0AmbushActive=true;
  window.realCityRoute=cityRoute;window.routeCalls=0;
  cityRoute=(...args)=>{routeCalls++;return realCityRoute(...args);};`);
refresh(50,41,1);
ok(P('!enemiesList.some(e=>e.isCityCivilian&&e.cityPersonKey&&e.hp>0&&!e.dead)'),'ambush retained a living ambient civilian');
ok(P('routeCalls===0'),'ambush searched candidate sidewalk routes');
ok(P('enemiesList.includes(recruit)&&enemiesList.includes(military)'),'ambush removal affected recruits or military');
ok(P('getBiomeState(1).cityPeople[residentKey].hp===61&&getBiomeState(1).cityPeople[residentKey].panic===45&&getBiomeState(1).cityPeople[residentKey].px===60400&&getBiomeState(1).cityPeople[residentKey].py===49800'), 'ambush banking lost injury or panic state');
ok(P('getBiomeState(1).cityPeople[residentKey].stun===savedTimer&&getBiomeState(1).cityPeople[residentKey].stunAge===savedAge&&getBiomeState(1).cityPeople[residentKey].stunFacing===PI'),'ambush banking lost the stun pose');
ok(P('getBiomeState(1).cityPeople[deadKey].dead'),'ambush banking forgot a dead resident');
refresh(50,41,3);
ok(P('routeCalls===0&&!enemiesList.some(e=>e.cityPersonKey&&e.hp>0&&!e.dead)'),'active ambush resumed ambient spawning');
probe(`cityRoute=realCityRoute;nm0AmbushActive=false;enemiesList=enemiesList.filter(e=>!e.cityPersonKey);
  window.savedResident=getBiomeState(1).cityPeople[residentKey];
  window.table=getBiomeState(1).cityPeople;
  for(let n=0;n<10;n++)if("50,41,people:"+n!==residentKey&&"50,41,people:"+n!==deadKey)table["50,41,people:"+n]={dead:true};`);
const resumeX=P('savedResident.x'),resumeY=P('savedResident.y');
camera(resumeX,resumeY);refresh(50,41,1);
ok(P('!enemiesList.some(e=>e.cityPersonKey===residentKey)'),'post-ambush resident restored into the visible view');
ok(P('savedResident.hp===61&&savedResident.stunAge===savedAge'),'visible post-ambush defer changed saved state');
camera(resumeX,resumeY,2,1000);refresh(50,41,1);
ok(P('enemiesList.some(e=>e.cityPersonKey===residentKey&&e.hp===61&&e.panicTimer===45&&e.panicX===60400&&e.panicY===49800&&e.stunTimer===savedTimer&&e.stunPose.age===savedAge&&e.stunPose.facing===PI)'), 'offscreen post-ambush restoration lost resident state');
ok(P('!enemiesList.some(e=>e.cityPersonKey===deadKey)'),'dead resident returned after an ambush');

// The normal frame loop removes old saved/live residents before separation or
// forceNudge, including on frames where the 20-frame population refresh waits.
for(const ambush of [false,true]) {
  reset(false);loadChunk(50,41);
  const x=ambush?60600:600,y=ambush?49800:6600;
  camera(x,y);
  probe(`player.x=${x};player.y=${y};cityPeopleFrame=frameCount;
    nm0AmbushActive=${ambush};
    window.oldResident=new Character(${x+10},${y},false,"CITY_CITIZEN_M");cityAppearance(oldResident,555);
    oldResident.cityPersonKey="50,41,people:0";oldResident.hp=73;oldResident.panicTimer=19;
    oldResident.updateEnemy=()=>{throw Error("restricted civilian AI ran");};
    oldResident.checkCol=()=>{throw Error("restricted civilian physics ran");};
    window.guard=new Character(${x+100},${y},false,"NM0_CITY_GUARD");guard.cityPersonKey="50,41,people:6";
    window.recruit=new Character(${x+200},${y},false,"FARMER_MALE");recruit.isPopulation=true;
    window.military=new Character(${x+300},${y},false,"NM0_CITY_GUARD");military.isFriendly=true;military.isMilitary=true;
    for(const e of [guard,recruit,military])e.updateEnemy=()=>{};
    enemiesList=[oldResident,guard,recruit,military];
    window.maintenanceNames=["checkAmbushCleared","checkFarmSwarmAlive","maintainHostiles","cullDepartedBands","sweepForeignHostiles","maintainOutpostGarrison","maintainOutpostMuster","checkOutpostCaptured"];
    window.realMaintenance=maintenanceNames.map(name=>window[name]);
    for(const name of maintenanceNames)window[name]=()=>{};
    updateEntities();
    for(let i=0;i<maintenanceNames.length;i++)window[maintenanceNames[i]]=realMaintenance[i];`);
  ok(P('!enemiesList.includes(oldResident)&&!_pushActors.includes(oldResident)'),`${ambush?'ambush':'fortress buffer'} civilian entered physics/AI inside refresh cooldown`);
  ok(P('getBiomeState(1).cityPeople["50,41,people:0"].hp===73&&getBiomeState(1).cityPeople["50,41,people:0"].panic===19'), 'immediate civilian pruning lost banked state');
  ok(P('enemiesList.includes(guard)&&enemiesList.includes(recruit)&&enemiesList.includes(military)'), 'immediate civilian pruning removed guards/recruits/military');
}

// Fixed guards must be checked at their post, not their temporary route point.
reset(false);loadChunk(50,41);onlyResident(50,41,8);
const post=P('cityRoute(50,41,420)');
const route=P('cityRoute(50,41,(Math.abs(Math.imul(50,73856093)^Math.imul(41,19349663))%3664)-76)');
ok(Math.hypot(post.x-route.x,post.y-route.y)>400,'guard fixture needs a distinct route point');
camera(post.x,post.y,4);refresh(50,41);
ok(P('enemiesList.length===0'),'fixed guard appeared at its visible final post');
camera(60600,49800,2);probe(`activeBuildings=[{x:${post.x},y:${post.y},w:60,h:60,isWall:true}];invalidateColIndex();`);
refresh(50,41);
ok(P('enemiesList.length===0'),'fixed guard spawned inside a solid at its final post');
probe('activeBuildings=[];invalidateColIndex();');refresh(50,41);
ok(P(`enemiesList.length===1&&enemiesList[0].x===${post.x}&&enemiesList[0].y===${post.y}`),'hidden clear guard post failed to spawn');

// Loaded corner chunks extend past the retention circle. Reject those distant
// points before they consume the creation budget and stream out again next tick.
reset(false);
probe('player.x=72600;player.y=48600;mgr.chunks.set("58,38",{solid:[]});mgr.chunks.set("60,41",{solid:[]});');
camera(72600,48600);refresh(60,40);
ok(P('enemiesList.every(e=>Math.hypot(e.x-player.x,e.y-player.y)<=3000)'),'corner chunk spawned residents beyond the retention radius');
ok(P('enemiesList.filter(e=>e.isCityCivilian&&e.cityCx===60&&e.cityCy===41).length===6'),'distant corners consumed the nearby civilian budget');
probe('window.beforeResidents=new Map(enemiesList.map(e=>[e.cityPersonKey,e]));');refresh(60,40);
ok(P('enemiesList.length===beforeResidents.size'),'stable loaded chunks repeatedly created/evicted residents');
ok(P('enemiesList.every(e=>beforeResidents.get(e.cityPersonKey)===e)'),'retained resident identity changed without movement');

// Level entry builds chunks before draw publishes the new camera. It must not
// use the previous level's view to create ambient residents during that gap.
reset(false);camera(-100000,-100000);
probe('startAtLevel(1);doTick=true;started=true;');
ok(P('!enemiesList.some(e=>e.cityPersonKey)'),'initial level generation spawned residents with a stale camera');
probe('refreshCityPeople(chunkMgr,Math.floor(player.x/CHUNK_W),Math.floor(player.y/CHUNK_W));');
ok(P('!enemiesList.some(e=>e.cityPersonKey)'),'initial population cooldown did not protect the stale view');
probe('activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();enemiesList=[];biomeState={};authoredChunks=null;authoredCore=null;authoredMask=null;mgr={biome:1,chunks:new Map()};');
loadChunk(50,41);camera(60600,49800);refresh(50,41);
ok(P('enemiesList.filter(e=>e.isCityCivilian).length===6'),'population failed to resume after level-entry camera settled');
ok(P('enemiesList.every(e=>e.x<viewLeft-100||e.x>viewRight+100||e.y<viewTop-100||e.y>viewBottom+100)'),'post-entry residents appeared within the new camera');

// Camera pan, zoom and shake all contribute to the actual visibility rectangle.
for(const [z,panX,panY,shake] of [[.45,0,0,0],[.66,200,-100,12],[1.4,-500,300,0],[2,100,50,20]]) {
  reset(false);loadChunk(50,41);
  probe('for(let cy=40;cy<=42;cy++)for(let cx=49;cx<=51;cx++)mgr.chunks.set(cx+","+cy,{solid:[]});');
  camera(60600,49800,z,panX,panY,shake);
  for(let i=0;i<4;i++) {
    const before=new Set(P('enemiesList.map(e=>e.cityPersonKey)'));refresh(50,41,1);
    const spawned=P('enemiesList.map(e=>({k:e.cityPersonKey,x:e.x,y:e.y}))').filter(e=>!before.has(e.k));
    const v=P('({l:viewLeft,r:viewRight,t:viewTop,b:viewBottom})');
    ok(spawned.every(e=>e.x<v.l-100||e.x>v.r+100||e.y<v.t-100||e.y>v.b+100),`residents appeared on screen at zoom ${z}, pan ${panX},${panY}`);
  }
  ok(P('enemiesList.length>0'),`off-screen loaded blocks failed to populate at zoom ${z}`);
}

// The shared collision gate covers wander, panic, recoil and temporary clipping.
const edges=[{story:true,x:600,y:-7616,dx:0,dy:1,cx:0,cy:-7},
  {story:false,x:-7716,y:-4200,dx:1,dy:0,cx:-7,cy:-4},
  {story:false,x:11726,y:10800,dx:-1,dy:0,cx:9,cy:9}];
for(const edge of edges)for(const mode of ['WANDER','FLEE','STUNNED']) {
  reset(edge.story);camera(edge.x,edge.y);
  probe(`window.c=new Character(${edge.x},${edge.y},false,"CITY_CITIZEN_M");cityAppearance(c,777);
    c.cityCx=${edge.cx};c.cityCy=${edge.cy};c.cityDistance=1200;c.cityPause=0;
    c.ignoreBldgTimer=100;c.aiOffset=719;`);
  ok(P(`c.checkCol(${edge.x+edge.dx*5},${edge.y+edge.dy*5})`),`clip timer bypassed civilian boundary for ${mode}`);
  if(mode==='FLEE')probe(`scareCivilian(c,c.x-(${edge.dx})*120,c.y-(${edge.dy})*120);`);
  if(mode==='STUNNED')probe(`startPunchStun(c,Math.atan2(${edge.dy},${edge.dx}));`);
  probe(`window.allLegal=true;for(let i=0;i<80;i++){frameCount++;${mode==='STUNNED'?'advanceStun(c);':'updateCityCivilian(c);'}if(!cityCivilianAllowed(c.x,c.y))allLegal=false;}`);
  ok(P('allLegal'),`${mode.toLowerCase()} crossed a civilian boundary at ${edge.x},${edge.y}`);
}
console.log(`City placement passed: ${checks} checks for 300-metre fortress buffers, story/arcade geography, open fortresses, off-screen residents/posts, saved state, camera zoom/pan/shake and wander/panic/stun movement.`);

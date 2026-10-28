// Collision cover is acquired by contact intent, and only real openings permit
// a head-and-weapon lean. No test gives an actor immunity or moves its root.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;ctx.navigator.getGamepads=()=>[];
function fresh(x=12,y=0){
 probe(`currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isPaused=isDead=isWin=killcamMode=nm0AmbushActive=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 buildGhost=null;window.inNM0SecretOverlay=false;setMeleeTool('NONE');
 chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;isCooking=cannonInputHeld=false;
 player=new Character(${x},${y},true);player.aimAngle=0;player.currentWeapon=WEAPONS.PISTOL;
 player.throwAnimTimer=player.cannonCharge=0;
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 window.coverWall={x:40,y:0,w:20,h:160,isWall:true};
 buildings=activeBuildings=[coverWall];parkingCars=activeParkingCars=[];barrels=[];
 frameCount++;invalidateColIndex();`);
}
fresh();
for(const key of ['isCrateProp','isHayBale','isDumpster','isFence','isCar'])
 ok(key+' is waist-high collision cover',P(`coverSolidKind({x:0,y:0,w:60,h:60,${key}:true})==='LOW'`));
for(const type of ['HEDGE','CITYCAFETABLE'])
 ok(type+' is readable waist-high cover',P(`coverSolidKind({x:0,y:0,w:60,h:60,propType:'${type}'})==='LOW'`));
ok('a stone altar is waist-high dungeon cover',P("coverSolidKind({x:0,y:0,w:60,h:60,undergroundProp:'ALTAR'})==='LOW'"));
for(const key of ['isGrassLot','isDeck','isRiver','isPond','isUBarrier','isStreetLight'])
 ok(key+' cannot become an invisible cover wall',P(`coverSolidKind({x:0,y:0,w:60,h:60,${key}:true})===null`));
ok('ordinary building slabs are high cover',P("coverSolidKind(coverWall)==='HIGH'"));
ok('destroyed ordinary geometry is not cover',P('coverSolidKind({x:0,y:0,w:60,h:60,hp:0})===null'));
ok('explicit waist height overrides the generic wall class',P("coverSolidKind({x:0,y:0,w:60,h:60,isWall:true,coverHeight:1.1})==='LOW'"));
ok('a stationary nearby actor does not acquire new cover',!P('findCoverContact(player,0,0)'));
ok('a parallel walk does not acquire a wall merely by passing it',!P('findCoverContact(player,0,6)'));
probe('window.coverFace=Object.assign({},findCoverContact(player,6,0));');
ok('walking into the actual blocking face gives its outward normal',P("coverFace.solid===coverWall&&coverFace.kind==='HIGH'&&coverFace.nx===-1&&coverFace.ny===0"));
ok('the face reports wall-normal and tangent extents consistently',P('coverFace.plane===-30&&coverFace.tx===0&&coverFace.ty===-1&&coverFace.edgeMin===-80&&coverFace.edgeMax===80'));
ok('contact discovery leaves the root unchanged',P('player.x===12&&player.y===0'));
ok('releasing the stick retains previously acquired contact',!!P('findCoverContact(player,0,0,coverFace)'));
ok('a held wall contact accepts tangent movement',!!P('findCoverContact(player,0,6,coverFace)'));
ok('walking away releases contact immediately',!P('findCoverContact(player,-6,0,coverFace)'));
ok('a diagonal step with even a small outward component releases contact',!P('findCoverContact(player,-.02,6,coverFace)'));
probe('player.x=8;');
ok('new cover waits until the intended native step really reaches the wall',!P('findCoverContact(player,6,0)'));
probe('player.x=9;');ok('a six-unit remainder still reaches collision contact',!!P('findCoverContact(player,6,0)'));
probe('player.x=12;player.y=72;');
ok('contact releases before the planted leg radius passes a wall end',!P('findCoverContact(player,6,0,coverFace)'));
probe('player.y=71;window.coverFace=Object.assign({},findCoverContact(player,6,0));');
ok('a nine-unit foot margin still permits a natural corner stance',P('coverFace.solid===coverWall'));
ok('aiming outward requires no around-wall lean',!P('coverPeekCandidate(player,coverFace,Math.PI)'));
probe('player.y=0;');ok('a sealed wall midpoint cannot generate a distant peek',!P('coverPeekCandidate(player,coverFace,0)'));
for(const side of [-1,1]){
 probe(`player.y=${71*side};window.coverFace=Object.assign({},findCoverContact(player,6,0));`);
 for(const key of ['PISTOL','DUAL_SMG','ASSAULT_RIFLE']){
  probe(`player.currentWeapon=WEAPONS.${key};window.coverEdge=coverPeekCandidate(player,coverFace,0);`);
  ok(key+' can clear a real open wall end '+side,P('!!coverEdge&&Math.hypot(coverEdge.offsetX,coverEdge.offsetY)<=COVER_LEAN_MAX'));
  ok(key+' keeps the head and every native muzzle outside that end '+side,
   P(`Math.abs(player.y+coverEdge.offsetY)>=92&&coverWeaponMuzzles(player).every(m=>${side}>0?player.y+coverEdge.offsetY+m[1]>=82:player.y+coverEdge.offsetY+m[1]<=-82)`));
  ok(key+' has a clear physical path to each muzzle '+side,
   P('coverWeaponMuzzles(player).every(m=>coverRayClear(player.x+coverEdge.offsetX,player.y+coverEdge.offsetY,player.x+coverEdge.offsetX+m[0],player.y+coverEdge.offsetY+m[1],1))'));
 }
}
for(let quarter=0;quarter<4;quarter++)for(const end of [-1,1]) {
 const angle=quarter*Math.PI/2,co=Math.cos(angle),si=Math.sin(angle);
 fresh();ctx.__coverRotation={angle,co,si,end};
 probe(`coverWall.x=40*__coverRotation.co;coverWall.y=40*__coverRotation.si;
  coverWall.w=${quarter%2?160:20};coverWall.h=${quarter%2?20:160};
  player.x=12*__coverRotation.co-71*__coverRotation.end*__coverRotation.si;
  player.y=12*__coverRotation.si+71*__coverRotation.end*__coverRotation.co;
  player.currentWeapon=WEAPONS.DUAL_SMG;invalidateColIndex();
  window.coverFace=Object.assign({},findCoverContact(player,6*__coverRotation.co,6*__coverRotation.si));
  window.coverEdge=coverPeekCandidate(player,coverFace,__coverRotation.angle);`);
 ok('both SMGs clear a real edge on rotated wall '+quarter+' end '+end,P(`!!coverEdge&&coverWeaponMuzzles(player).every(m=>{
  const x=player.x+coverEdge.offsetX,y=player.y+coverEdge.offsetY;
  const mx=x+__coverRotation.co*m[0]-__coverRotation.si*m[1],my=y+__coverRotation.si*m[0]+__coverRotation.co*m[1];
  return coverRayClear(x,y,mx,my,1)&&coverRayClear(mx,my,mx+__coverRotation.co*64,my+__coverRotation.si*64,1);
 })`));
}
delete ctx.__coverRotation;
fresh(12,65);probe('window.coverFace=Object.assign({},findCoverContact(player,6,0));');
ok('a corner beyond the natural upper-chain reach does not stretch the figure',!P('coverPeekCandidate(player,coverFace,0)'));

fresh(12,71);probe('window.coverFace=Object.assign({},findCoverContact(player,6,0));buildings=activeBuildings=[coverWall,{x:70,y:90,w:80,h:20,isWall:true}];invalidateColIndex();');
ok('a perpendicular wall that seals the corner prevents the peek',!P('coverPeekCandidate(player,coverFace,0)'));
fresh(12,71);probe('window.coverFace=Object.assign({},findCoverContact(player,6,0));buildings=activeBuildings=[coverWall,{x:12,y:84,w:2,h:2,isWall:true}];invalidateColIndex();');
ok('the head sweep cannot cross a small solid in the opening',!P('coverPeekCandidate(player,coverFace,0)'));
fresh();probe('window.coverFrozen=Object.freeze({x:40,y:0,w:20,h:160,isWall:true});window.coverRectFirst=coverSolidRects(coverFrozen);');
ok('frozen streamed geometry is cached without writing onto the prop',P('coverSolidRects(coverFrozen)===coverRectFirst&&coverRectFirst[0].x0===30'));
probe('window.coverMoving={x:40,y:0,w:20,h:160,isWall:true};window.coverOld=coverSolidRects(coverMoving);coverMoving.x=50;');
ok('moving geometry invalidates only its cached physical bounds',P('coverSolidRects(coverMoving)!==coverOld&&coverSolidRects(coverMoving)[0].x0===40'));
probe('coverMoving.hp=0;');ok('destroyed geometry drops all ordinary cover rectangles',P('coverSolidRects(coverMoving).length===0'));
probe('window.coverCar={x:40,y:0};parkingCars=activeParkingCars=[coverCar];player.x=-3;');
ok('native parked cars without dimension fields are low cover',P("coverSolidKind(coverCar)==='LOW'&&coverSolidRects(coverCar)[0].x0===15&&coverSolidRects(coverCar)[0].y0===-45"));
probe('buildings=activeBuildings=[];invalidateColIndex();');
ok('car contact uses its real fifty-by-ninety movement bounds',P('findCoverContact(player,6,0).solid===coverCar'));
fresh();probe(`currentLevel=1;window.southGateBreachedStatus=true;window.coverGate={x:0,y:100,w:1000,h:40,isGovFortress:true,hp:0};
 buildings=activeBuildings=[coverGate];invalidateColIndex();window.coverGateRects=coverSolidRects(coverGate);`);
ok('opening a great gate leaves two solid wings',P('coverGateRects.length===2&&coverGateRects[0].x1===-300&&coverGateRects[1].x0===300'));
probe('player.x=0;player.y=62;');ok('the open doorway cannot catch a character in invisible cover',!P('findCoverContact(player,0,6)'));
probe('player.x=400;');ok('gate wings remain valid high cover',P('findCoverContact(player,0,6).solid===coverGate'));
ok('energy barriers retain their native three-piece footprint for callers',P('coverSolidRects({x:0,y:0,w:100,h:100,isUBarrier:true,hp:100}).length===3'));
fresh();probe('for(let i=0;i<250;i++)activeBuildings.push({x:2000+i*100,y:1000,w:60,h:60,isWall:true});invalidateColIndex();window.coverCalls=0;window.coverKindOriginal=coverSolidKind;coverSolidKind=b=>{coverCalls++;return coverKindOriginal(b);};');
ok('local ray queries reject a nearby wall through the existing broad phase',!P('coverRayClear(0,0,90,0)'));
ok('ray material checks do not scan hundreds of distant buildings',P('coverCalls<10'));
probe('coverSolidKind=coverKindOriginal;');
console.log(`${checks}/${checks} cover collision, material, open-edge and muzzle-envelope checks passed.`);

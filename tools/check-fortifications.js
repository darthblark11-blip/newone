// Architecture's one-use reward must use native placement input, never a
// random spawn or a weapon attack, and survive rebuilding/travel/save/load.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,now=2000,pad=null,seed=771;
ctx.millis=()=>now;ctx.setTimeout=()=>0;
ctx.navigator.getGamepads=()=>pad?[pad]:[];
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;
 return a===undefined?r:Array.isArray(a)?a[Math.floor(r*a.length)]:b===undefined?a*r:a+(b-a)*r;};
const storage=new Map();ctx.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
function ok(label,value){assert(value,label);checks++;}
function reset(){
 pad=null;ctx.touches=[];now+=1000;
 probe(`resetRunState();width=393;height=800;currentLevel=currentBiome=2;BIOME_ACTIVE=false;
  started=doTick=true;isStoryMode=isDead=isWin=isPaused=killcamMode=false;
  player=new Character(0,0,true);player.isArmed=true;player.ammo=20;
  leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
  window.archLvl=2;window.archBarrierReady=true;window.popArchitectureM=window.popArchitectureF=0;
  buildings=[];activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];bullets=[];particles=[];
  playerGrenades=[];playerFlasks=[];lightnings=[];buildSites=[];playerStructures=[];
  authoredCore=authoredMask=null;authoredSolids=[];authoredCars=[];invalidateColIndex();resetForestWildlife();
  window.isDesktop=false;window.showOnScreenControls=true;setMeleeTool('NONE');
  window.lastPauseTime=0;prevGamepadButtons=[];resetTouchAimSelection(false);`);
}
function tap(point,id=1){ctx.touches.push({id,...point});probe('touchStarted();');}
function release(id){ctx.touches=ctx.touches.filter(t=>t.id!==id);probe('touchEnded();handleTouches();');}
function tick(){now+=17;probe('frameCount++;handleTouches();handleGamepad();player.updatePlayer();updateBuildPlacement();');}
function button(key){const b=P('buildPlacementControls().'+key);return{x:b.x+b.w/2,y:b.y+b.h/2};}

reset();
ok('ordinary blueprint list stays unchanged',JSON.stringify(P('BUILD_ORDER'))===JSON.stringify(['WAREHOUSE','LABORATORY','RANGE','FARM']));
probe('isPaused=true;pauseMenuState="MAIN";');
tap({x:393/2-64,y:800/2+210});
ok('level-two reward opens BUILD without assigned architects',P('isPaused&&pauseMenuState==="BUILD"&&buildCrew()===0'));
release(1);const fort=P('fortificationsMenuButton()');tap({x:fort.x+fort.w/2,y:fort.y+fort.h/2},2);
ok('Fortifications starts its preview without spending the reward',P('buildGhost.kind==="BARRIER"&&!isPaused&&window.archBarrierReady&&playerStructures.length===0'));
tick();ok('the menu finger cannot become aim or firing input',P('!rightStick.active&&bullets.length===0'));
release(2);
tap({x:313,y:630},3);tick();
ok('right-thumb placement aims the preview without firing',P('Math.abs(player.aimAngle+HALF_PI)<1e-8&&buildGhost.y<player.y-150&&buildGhost.ok&&bullets.length===0&&player.ammo===20'));
const preview=P('({x:Math.round(buildGhost.x),y:Math.round(buildGhost.y)})');
tap(button('place'),4);tick();
ok('PLACE builds instantly without a work site or crew',P('!buildGhost&&!window.archBarrierReady&&playerStructures.length===1&&buildSites.length===0&&buildCrew()===0'));
ok('the native barrier occupies the rendered preview',P(`playerStructures[0].isUBarrier&&playerStructures[0].x===${preview.x}&&playerStructures[0].y===${preview.y}&&playerStructures[0].hp===1000`));
ok('placed barrier has native collision and the U opening remains passable',P('player.checkCol(playerStructures[0].x-100,playerStructures[0].y)&&!player.checkCol(playerStructures[0].x,playerStructures[0].y+120)'));
ok('confirmation consumes held aiming fingers instead of firing',P('!rightStick.active&&bullets.length===0&&player.ammo===20'));
release(3);release(4);
ok('a spent reward cannot produce another preview',P('buildBarrier()===false&&!buildGhost'));

reset();probe('buildBarrier();updateBuildPlacement();');
ok('clear preview is valid before world changes',P('buildGhost.ok'));
probe('activeBuildings=[{x:buildGhost.x,y:buildGhost.y,w:320,h:300,isBlockBuilding:true}];');
ok('confirmation rechecks a stale valid preview and preserves the token',P('confirmBuildPlacement()===false&&window.archBarrierReady&&buildGhost&&!buildGhost.ok&&!playerStructures.length'));
probe('cancelBuildPlacement();');
ok('cancel preserves the unspent barrier',P('!buildGhost&&window.archBarrierReady'));

reset();probe('player.currentWeapon=WEAPONS.BOW;player.ammo=24;buildBarrier();');
tap({x:373,y:640},8);tick();
ok('bow-equipped placement aims directly and cannot draw or fire arrows',P('Math.abs(player.aimAngle)<1e-8&&bullets.length===0&&player.ammo===24&&player.bowDrawState.phase!=="DRAW"'));
probe('chemistSuitUnlocked=true;cannonInputHeld=meleeInputHeld=grenadeInputHeld=true;player.cannonCharge=20;player.updatePlayer();');
ok('placement suppresses cannon, flasks, grenades and melee',P('!isCooking&&player.cannonCharge===0&&!lightnings.length&&!playerGrenades.length&&!playerFlasks.length&&!boxingActive(player)'));
release(8);probe('cancelBuildPlacement();');

reset();probe('buildBarrier();updateBuildPlacement();');
probe('isPaused=true;');
ok('a paused preview cannot be confirmed or spend its charge',P('confirmBuildPlacement()===false&&buildGhost&&window.archBarrierReady&&!playerStructures.length'));
probe('isPaused=false;');tap({x:363,y:30},6);
ok('a fresh invisible corner tap pauses placement without spending it',P('isPaused&&buildGhost&&window.archBarrierReady&&touchAimSelection.pointerId===null'));
release(6);probe('resumeFromPause();');
tap({x:313,y:580},7);tick();ctx.touches[0].x=363;ctx.touches[0].y=30;probe('touchMoved();handleTouches();');
ok('dragging an existing aim finger across the corner does not pause',P('!isPaused&&buildGhost&&touchAimSelection.pointerId===7'));
release(7);probe('cancelBuildPlacement();');

reset();probe('buildBarrier();updateBuildPlacement();');
ctx.mouseIsPressed=true;ctx.mouseButton=ctx.LEFT;
probe('confirmBuildPlacement();window.isDesktop=true;');
ctx.mouseX=900;ctx.mouseY=300;probe('handleDesktop();player.updatePlayer();');
ok('held mouse confirmation cannot leak into a weapon shot',P('deathMenuInput.mouseBlocked&&bullets.length===0&&player.ammo===20'));
ctx.mouseIsPressed=false;probe('handleDeathMenuInput();handleDesktop();');
ctx.mouseIsPressed=true;probe('handleDesktop();player.updatePlayer();');
ok('a fresh mouse press after release can fire normally',P('bullets.length===1&&player.ammo===19'));
ctx.mouseIsPressed=false;probe('handleDeathMenuInput();');

reset();probe('buildBarrier();updateBuildPlacement();');
pad={index:0,axes:[0,0,0,-1],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
probe('handleGamepad();player.updatePlayer();updateBuildPlacement();');
ok('controller right stick rotates the placement without shooting',P('Math.abs(player.aimAngle+HALF_PI)<1e-8&&bullets.length===0'));
pad.buttons[0]={pressed:true,value:1};probe('handleGamepad();');
ok('controller A confirms the instant reward',P('!buildGhost&&!window.archBarrierReady&&playerStructures.length===1'));

reset();probe('buildBarrier();updateBuildPlacement();confirmBuildPlacement();playerStructures[0].hp=640;');
const saved=P('({x:playerStructures[0].x,y:playerStructures[0].y,level:currentLevel})');
probe('startAtLevel(3);');
ok('travel retains the old sector barrier record without publishing it here',P('playerStructures.some(b=>b.isUBarrier&&b.buildLevel===2&&b.hp===640)&&!buildings.some(b=>b.isUBarrier&&b.buildLevel===2)'));
probe('saveGame();loadGame();');
ok('save/load retains spent reward and barrier health in another sector',P('!window.archBarrierReady&&playerStructures.some(b=>b.isUBarrier&&b.buildLevel===2&&b.hp===640)'));
probe('startAtLevel(2);');
ok('return travel republishes exactly the same barrier',P(`buildings.filter(b=>b.isUBarrier&&b.buildLevel===2).length===1&&buildings.some(b=>b.isUBarrier&&b.x===${saved.x}&&b.y===${saved.y}&&b.hp===640)`));
probe('chunkMgr.rebuildWorldArrays();');
ok('the chunk streamer retains one barrier without duplication',P('buildings.filter(b=>b.isUBarrier&&b.buildLevel===2).length===1'));

reset();probe('saveGame();window.archBarrierReady=false;loadGame();');
ok('saving an unused reward leaves it available after loading',P('window.archBarrierReady'));
console.log(`${checks}/${checks} fortification placement, input and persistence checks passed.`);

// Follow native movement intent through a waist-high rim, including safe
// landing, continuous projection, blocked exits and mid-action persistence.
const assert=require('assert/strict');
const {ctx,probe:P}=require('./harness');
let checks=0;
const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
ctx.setTimeout=()=>0;
P(`currentLevel=currentBiome=1;BIOME_ACTIVE=true;started=doTick=true;
 isStoryMode=false;isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFarmCutscene=inFarmPostCutscene=false;
 inPostAmbushCutscene=inFortCutscene=inDarchonCall=inTravelMenu=inOverworldView=false;
 inWorldBuildingMenu=inUpgradeMenu=inLvl4Cutscene=false;nm0AmbushActive=false;
 var mantleFixture=(depth=18,open=true)=>{
  currentLevel=currentBiome=1;shovelExcavation={};
  buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];
  enemiesList=[];townCitizens=[];barrels=[];corpses=[];particles=[];bullets=[];invalidateColIndex();
  player=new Character(528,720,true,'NORMAL');player.hp=player.maxHp=100;player.dead=false;
  player.shovelLevel=1;player.shovelDepth=player.shovelDepthTarget=depth;
  player._shovelCellKey=shovelCellKey(5,7);player.shovelCooldownMs=0;
  player.meleeTimer=player.shovelDigTimer=0;setMeleeTool('SHOVEL');
  shovelMakeCell(5,7,depth,open);window.passiveRouteUnlocked=false;
  return player;
 };
 var mantleAdvance=(ms,dt=1000/60)=>{for(let left=ms;left>1e-6;){const step=Math.min(dt,left);
  frameCount++;shovelUpdatePlayer(player,step);left-=step;}};
 var walkToMantle=(dx,dy)=>{for(let i=0;i<100&&!player.shovelMantle;i++)player.attemptMove(dx,dy);
  return !!player.shovelMantle;};`);

for(const [dx,dy,label] of [[3,0,'east'],[-3,0,'west'],[0,3,'south'],[0,-3,'north']]){
 P(`mantleFixture();var tookRim=walkToMantle(${dx},${dy});`);
 ok('tookRim','Walking toward the '+label+' rim begins a native mantle');
 ok('player.shovelMantle.startDepth===18&&shovelMantleProgress(player)===0','The '+label+' mantle starts at the existing waist depth');
 P('var m=player.shovelMantle;var lockX=player.x,lockY=player.y;var startProjection=shovelMantleProjection(player);');
 ok('startProjection.scale<1&&Number.isFinite(startProjection.x)&&Number.isFinite(startProjection.y)','The '+label+' mantle starts with a valid pit projection');
 P(`var heldMove=player.attemptMove(${dx}*4,${dy}*4);mantleAdvance(100);`);
 ok('player.x===lockX&&player.y===lockY&&heldMove.x===0&&heldMove.y===0','The '+label+' hand-plant pauses forward movement');
 P('mantleAdvance(220);');
 ok('player.shovelMantle&&shovelMantleProgress(player)>0&&shovelMantleProgress(player)<1&&shovelPlayerDepth(player)<18&&shovelPlayerDepth(player)>0','The '+label+' lift raises the body continuously before landing');
 ok('player.x===lockX&&player.y===lockY','The '+label+' lift cannot move the physical body through the surface');
 P('mantleAdvance(500);');
 ok('!player.shovelMantle&&shovelPlayerDepth(player)===0&&player.shovelDepthTarget===0','The '+label+' mantle ends standing at surface height');
 ok('!shovelSurfaceFallCell(player)&&!player._shovelFall&&player.shovelClimbing','The '+label+' landing clears the opening without immediately falling back');
 ok('!window.passiveRouteUnlocked&&!player.shovelGateCrossing','A shallow '+label+' exit cannot award an underground passive route');
}

P(`mantleFixture();walkToMantle(3,0);var path=[];
 for(let i=0;i<100&&player.shovelMantle;i++){path.push(shovelMantleProjection(player));mantleAdvance(1000/60);}
 var projectionCompleted=!player.shovelMantle;path.push(shovelActorProjection(player));`);
ok('projectionCompleted','A mantle completes within its bounded animation window');
ok('path.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.scale))','Every mantle frame has finite position and perspective scale');
ok('path.every((p,i)=>!i||p.scale>=path[i-1].scale-1e-7)','The mantle scale rises continuously toward the surface');
ok('path.every((p,i)=>!i||Math.hypot(p.x-path[i-1].x,p.y-path[i-1].y)<12)','No mantle frame jumps from beneath the floor to the landing');

P(`mantleFixture();shovelMakeCell(6,7,18,true);var seamMantled=false;
 for(let i=0;i<32;i++){player.attemptMove(3,0);seamMantled=seamMantled||!!player.shovelMantle;}`);
ok('!seamMantled&&player.x>=620&&shovelPlayerDepth(player)===18','Walking between connected shallow cells does not perform a mantle');
P('mantleFixture(36);var deepExit=walkToMantle(3,0);');
ok('!deepExit&&shovelPlayerDepth(player)===36&&player.x<576','A fully buried actor cannot auto-mantle through an unmined wall');
P('mantleFixture(18,false);var coveredExit=walkToMantle(3,0);');
ok('!coveredExit','An intact tunnel roof cannot be treated as an open pit lip');
P(`mantleFixture();var pedestrian=new Character(550,720,false,'NORMAL');
 pedestrian.shovelLevel=1;pedestrian.shovelDepth=pedestrian.shovelDepthTarget=18;
 pedestrian._shovelCellKey=shovelCellKey(5,7);var pedStep=pedestrian.attemptMove(3,0);`);
ok('!pedestrian.shovelMantle&&pedStep.x>0','The player-specific mantle leaves existing NPC shallow movement unchanged');

P(`mantleFixture();buildings=[{x:582,y:720,w:12,h:180,isWall:true}];activeBuildings=buildings;invalidateColIndex();
 var blockedStartX=player.x;var blockedMantle=walkToMantle(3,0);`);
ok('!blockedMantle&&shovelPlayerDepth(player)===18&&player.x<576','A wall above the exit blocks both the mantle and ordinary clipping movement');
P(`mantleFixture();buildings=[{x:570,y:720,w:8,h:180,isWall:true}];activeBuildings=buildings;invalidateColIndex();
 var thinWallMantle=walkToMantle(3,0);`);
ok('!thinWallMantle&&player.x<576&&shovelPlayerDepth(player)===18','A clear far landing cannot permit climbing through a thin wall beside the lip');
P(`mantleFixture();parkingCars=[{x:595,y:720,w:45,h:85}];activeParkingCars=parkingCars;
 var parkedMantle=walkToMantle(3,0);`);
ok('!parkedMantle&&player.x<576&&shovelPlayerDepth(player)===18','A parked car prevents an unsafe rim landing');
P(`mantleFixture();walkToMantle(3,0);var interrupted=player.shovelMantle;
 mantleAdvance(240);buildings=[{x:interrupted.toX,y:interrupted.toY,w:12,h:110,isWall:true}];
 activeBuildings=buildings;invalidateColIndex();mantleAdvance(1000);`);
ok('!player.shovelMantle&&player.x===interrupted.fromX&&player.y===interrupted.fromY&&shovelPlayerDepth(player)===18','A newly obstructed landing safely returns the player to the original pit');

P(`mantleFixture();walkToMantle(3,0);mantleAdvance(325,1000/120);
 var fine={x:shovelMantleProjection(player).x,y:shovelMantleProjection(player).y,depth:shovelPlayerDepth(player)};
 mantleFixture();walkToMantle(3,0);mantleAdvance(325,1000/15);var coarse=shovelMantleProjection(player);`);
ok('Math.abs(fine.x-coarse.x)<.01&&Math.abs(fine.y-coarse.y)<.01&&Math.abs(fine.depth-shovelPlayerDepth(player))<.01','Mantle timing and projection agree at low and high frame rates');

for(const time of [100,325,600]){
 P(`mantleFixture();walkToMantle(3,0);mantleAdvance(${time});
  var beforeSave={projection:shovelMantleProjection(player),elapsed:player.shovelMantle.elapsedMs,rawX:player.x,rawY:player.y};
  var snapshot=JSON.parse(JSON.stringify(serializeShovelState()));
  player=new Character(beforeSave.rawX,beforeSave.rawY,true,'NORMAL');restoreShovelState(snapshot);restoreShovelPlayer(snapshot);`);
 ok('snapshot.player.mantle&&player.shovelMantle&&Math.abs(player.shovelMantle.elapsedMs-beforeSave.elapsed)<1e-6','A save at '+time+'ms retains the mantle stage');
 ok('Math.hypot(shovelMantleProjection(player).x-beforeSave.projection.x,shovelMantleProjection(player).y-beforeSave.projection.y)<.01','Restoring at '+time+'ms does not pop the rendered body');
 P('mantleAdvance(1000);');
 ok('!player.shovelMantle&&shovelPlayerDepth(player)===0&&!shovelSurfaceFallCell(player)','The restored '+time+'ms mantle reaches a safe surface landing');
}
P(`var landedSave=JSON.parse(JSON.stringify(serializeShovelState()));var finalX=player.x,finalY=player.y;
 player=new Character(finalX,finalY,true,'NORMAL');restoreShovelState(landedSave);restoreShovelPlayer(landedSave);mantleAdvance(1000);`);
ok('!player.shovelMantle&&shovelPlayerDepth(player)===0&&!player._shovelFall','A completed mantle save does not replay the lift or start a fall');
// The real player walk uses its native input path, which must begin the
// action even though ordinary NPCs and knockback use attemptMove separately.
P(`mantleFixture();leftStick={active:true,dx:.5,dy:0,base:{x:80,y:640}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:640}};
 meleeInputHeld=grenadeInputHeld=cannonInputHeld=false;isCooking=false;
 for(let i=0;i<80&&!player.shovelMantle;i++){frameCount++;deltaTime=1000/60;player.updatePlayer();}
 var nativeStarted=!!player.shovelMantle;`);
ok('nativeStarted','Holding the actual movement stick starts the mantle through updatePlayer');
P(`var nativeMantle=player.shovelMantle,nativeX=player.x,nativeY=player.y;
 if(nativeMantle){for(let i=0;i<6;i++){frameCount++;player.updatePlayer();}}`);
ok('nativeStarted&&player.x===nativeX&&player.y===nativeY','Held native movement pauses during the hand-plant');
P(`if(nativeMantle){for(let i=0;i<80&&player.shovelMantle;i++){frameCount++;player.updatePlayer();}}`);
ok('nativeStarted&&!player.shovelMantle&&player.x===nativeMantle.toX&&player.y===nativeMantle.toY','The completion frame plants at the landing without an extra held-stick movement step');
P('leftStick.dx=leftStick.dy=0;');

P(`mantleFixture();player.x=549;leftStick.dx=.5;player.meleeTimer=2;
 for(let i=0;i<4;i++){frameCount++;player.updatePlayer();}`);
ok('player.meleeTimer===0&&player.shovelMantle','Holding forward at a busy rim lets the current strike finish before starting the mantle');
P(`mantleFixture();player.x=549;leftStick.dx=.5;player.reloadTimer=2;
 for(let i=0;i<4;i++){frameCount++;player.updatePlayer();}`);
ok('player.reloadTimer===0&&player.shovelMantle','A blocked rim cannot freeze an in-progress reload');
P(`mantleFixture();leftStick.dx=0;player.x=549;player.dashTimer=1;player.lastMoveAngle=0;
 jetpackFireExplosion=true;screenShake=0;frameCount++;player.updatePlayer();`);
ok('player.shovelMantle&&player.dashTimer===0','A native dash meets the rim with the same controlled mantle');
ok('!particles.some(p=>p.t==="EXPLOSION")&&screenShake===0','Starting the mantle cannot accidentally fire the dash-end jetpack explosion');
P('jetpackFireExplosion=false;');

P(`mantleFixture();walkToMantle(3,0);var actionCells=JSON.stringify(shovelExcavation);
 var upBlocked=shovelDig('UP')===false,downBlocked=shovelDig('DOWN')===false;
 var muzzleBefore=bullets.length;setMeleeTool('NONE');player.fire(0);player.activateDash();
 player.triggerReload();player.activateMelee(true);setMeleeTool('SHOVEL');`);
ok('upBlocked&&downBlocked&&JSON.stringify(shovelExcavation)===actionCells','Climb and dig controls cannot interrupt a mantle or mutate its shaft');
ok('bullets.length===muzzleBefore&&player.dashTimer===0&&player.reloadTimer===0&&player.meleeTimer===0','Fire, dash, reload and attack actions wait until after the mantle');
P('var deathMantle=player.shovelMantle;player.hp=0;shovelUpdatePlayer(player,16);');
ok('!player.shovelMantle&&player.x===deathMantle.fromX&&player.y===deathMantle.fromY&&shovelPlayerDepth(player)===18','Death cancels the mantle rather than completing a surface teleport');
P('mantleFixture();walkToMantle(3,0);mantleAdvance(250);player.x=1000;player.y=1000;shovelUpdatePlayer(player,16);');
ok('!player.shovelMantle&&player.x===1000&&player.y===1000','An external teleport cancels the old mantle without moving the player back to its origin');

for(const time of [100,325,600]){
 P(`mantleFixture();walkToMantle(3,0);mantleAdvance(${time});
  _shovelBelowActors.length=0;_depthActors.length=0;_depthOn=false;_legacyActorsQueued=false;
  var nativeClip=shovelClipCells,nativeShow=player.show,clipCount=0,bodyCount=0;
  shovelClipCells=function(){clipCount++;return nativeClip.apply(this,arguments);};
  player.show=function(){bodyCount++;return nativeShow.call(this);};
  actorShow(player);drawShovelUndergroundActor();
  shovelClipCells=nativeClip;player.show=nativeShow;`);
 ok('bodyCount===1&&clipCount===0&&_shovelBelowActors.length===0','The '+time+'ms mantle renders one original player without clipping it underneath the rim');
}
console.log('Shovel mantle: '+checks+' native rim, pause, projection, collision and persistence checks passed.');

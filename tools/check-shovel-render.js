// Real square-pit painters share the terrain grid and depth. Check their joins,
// deferred actor order and height stamps without advancing simulation.
const assert = require('assert');
const {ctx, probe: P, mkG} = require('./harness');
let checks = 0;
function ok(v, label) { assert.ok(v, label); checks++; }
P([
'currentLevel=1;currentBiome=1;BIOME_ACTIVE=true;authoredCore={};',
'width=940;height=700;zoom=1;camX=0;camY=0;viewLeft=0;viewRight=940;viewTop=0;viewBottom=700;',
'buildings=[];activeBuildings=[];activeParkingCars=[];enemiesList=[];townCitizens=[];allies=[];',
'player=new Character(528,720,true);player.shovelLevel=1;player.shovelDepth=0;player.shovelDepthTarget=0;',
'shovelExcavation={};__renderOrder=[];__balance=0;__clipBalance=0;__rects=[];__lines=[];',
'__originalPush=push;__originalPop=pop;__originalRect=rect;__originalLine=line;',
'push=function(){__balance++;__originalPush();};pop=function(){__balance--;__originalPop();};',
'rect=function(...a){__rects.push(a);__originalRect(...a);};line=function(...a){__lines.push(a);__originalLine(...a);};',
'drawingContext.save=function(){__clipBalance++;};drawingContext.restore=function(){__clipBalance--;};',
'player.show=function(){__renderOrder.push("PLAYER");};',
'__pit=shovelMakeCell(5,7,18,true);'
].join('\n'));
ok(P('!shovelBelowGroundActor(player)'), 'Surface player remains in the ordinary actor pass');
P('player.shovelDepth=18;_depthOn=true;_depthActors=[];actorShow(player);');
ok(P('_depthActors.length===0&&_shovelBelowActors.length===1&&_shovelBelowActors[0]===player'), 'Waist-deep player defers past the surface masses');
P('__renderOrder.push("GATE");drawShovelUndergroundActor();');
ok(P('__renderOrder.join(",")==="GATE,PLAYER"'), 'Gate paints before the one local underground actor');
ok(P('_shovelBelowActors.length===0'), 'Cutaway consumes its deferred actor after one show');
P('drawShovelUndergroundActor();');
ok(P('__renderOrder.filter(x=>x==="PLAYER").length===1'), 'Cutaway cannot advance or paint the player twice');
ok(P('__balance===0&&__clipBalance===0'), 'Open shaft balances p5 and native canvas state');
ok(P('shovelPitNeighbors(__pit).every(v=>!v)'), 'Isolated shaft has four earthen walls');
ok(P('(()=>{const b=shovelPitOpeningBounds(__pit);return b[2]-b[0]===72&&b[3]-b[1]===72;})()'), 'Surface mouth is body-sized rather than the full mining grid');
P('__floorSizes=[];__cutSizes=[];for(const d of [18,36,144,1024,4096]){const f=shovelPitFloorBounds(__pit,[false,false,false,false],d);__floorSizes.push(f[2]-f[0]);player.shovelDepth=d;__cutSizes.push(shovelTunnelCutawayBounds(player)[2]);}player.shovelDepth=18;');
ok(P('__floorSizes.every((s,i,a)=>!i||s<a[i-1])'), 'Shaft floor recedes at every tested depth rather than only shrinking the figure');
ok(P('__cutSizes.every((s,i,a)=>!i||s<a[i-1])'), 'Roofed tunnel aperture also scales down with every tested depth');
ok(P('Math.abs(__floorSizes[0]/72-shovelRenderScale(player))<1e-9'), 'Floor and actor share the same perspective ratio');
P('player.x=__pit.x;player.y=__pit.y;player.shovelDepth=0;__surfaceProjection=shovelActorProjection(player);player.shovelDepth=1;__earlyProjection=shovelActorProjection(player);player.shovelDepth=18;__bottomProjection=shovelActorProjection(player);');
ok(P('__surfaceProjection.x===player.x&&__surfaceProjection.y===player.y'), 'Surface actor begins at its unchanged world contact');
ok(P('__earlyProjection.y>player.y&&__earlyProjection.y<__bottomProjection.y'), 'Descent moves into the shaft smoothly instead of snapping onto its floor');
P('__right=shovelMakeCell(6,7,18,true);');
ok(P('shovelPitNeighbors(__pit)[1]&&shovelPitNeighbors(__right)[3]'), 'Adjacent pits remove both internal walls');
ok(P('shovelPitFloorBounds(__pit,shovelPitNeighbors(__pit))[2]===shovelPitFloorBounds(__right,shovelPitNeighbors(__right))[0]'), 'Connected floor planes meet exactly at the cell boundary');
P('player.x=576-.0001;player.y=720;player.shovelDepth=18;__beforeSeam=shovelActorProjection(player);player.x=576+.0001;__afterSeam=shovelActorProjection(player);');
ok(P('Math.hypot(__afterSeam.x-__beforeSeam.x,__afterSeam.y-__beforeSeam.y)<.001'), 'Adjacent connected floor projection crosses its shared seam continuously');
P('__right.open=false;__right.ceiling=18;__right.depth=36;');
ok(P('!shovelPitNeighbors(__pit)[1]'), 'Intact ceiling remains on a roofed tunnel beside a surface shaft');
ok(P('shovelPitNeighbors(__pit,true,36)[1]'), 'The same cells connect at their shared underground layer');
P('player.x=624;player.y=720;player.shovelDepth=36;player.shovelDepthTarget=36;_shovelBelowActors.push(player);__renderOrder=[];drawShovelUndergroundActor();');
ok(P('__renderOrder.join(",")==="PLAYER"'), 'Roofed tunnel draws one actor inside its local cutaway');
ok(P('__balance===0&&__clipBalance===0'), 'Roofed tunnel balances both paint stacks');
P('player.show=function(){throw Error("test painter failure");};_shovelBelowActors.push(player);try{drawShovelUndergroundActor();}catch(e){__caught=e.message;}');
ok(P('__caught==="test painter failure"&&__balance===0&&__clipBalance===0'), 'A failed figure painter restores the clipping and p5 stacks');
P('player.show=function(){__renderOrder.push("PLAYER");};');
for (const depth of [18,36,144,1024,4096]) {
  P('player.shovelDepth='+depth+';');
  const expected = Math.max(.045, 1/(1+depth/76));
  ok(Math.abs(P('shovelRenderScale(player)') - expected) < 1e-9, 'Depth '+depth+' uses the inverse-height size cue');
}
ok(P('shovelRenderScale(player)===SHOVEL.minScale'), 'Very deep excavation reaches the bounded pin-sized figure');
P('camX=480;camY=672;__rects=[];__lines=[];drawShovelExcavationGround();');
ok(P('__rects.length>0&&__lines.length>0'), 'Production pit painter draws visible floor, strata and roots');
ok(P('__balance===0&&__clipBalance===0'), 'Visible pit pass leaves both paint stacks clean');
P('viewLeft=-1e8;viewRight=1e8;viewTop=-1e8;viewBottom=1e8;__cellLookups=0;__nativeCellAt=shovelCellAt;shovelCellAt=function(...a){__cellLookups++;return __nativeCellAt(...a);};shovelRenderCellsInView();');
ok(P('__cellLookups<500'), 'Visible excavation lookup cost follows the camera, not huge world bounds');
P('for(let i=0;i<10000;i++)shovelExcavation["1:"+(-1000-i)+":0"]={level:1,ix:-1000-i,iy:0,x:(-999.5-i)*96,y:48,depth:18,ceiling:0,open:true};__cellLookups=0;shovelRenderCellsInView();');
ok(P('__cellLookups<500'), 'Ten thousand distant saved shafts add no visible scan work');
P('shovelCellAt=__nativeCellAt;__rects=[];drawShovelGrassPatches();');
for (const id of ['HOME_GARDEN','NORTH_VERGE','SOUTH_VERGE']) {
  ok(P('(()=>{const p=SHOVEL_GRASS_PATCHES.find(p=>p.id==="'+id+'");return __rects.some(r=>r[0]===p.x&&r[1]===p.y&&r[2]===p.w&&r[3]===p.h);})()'), id+' artwork uses the same top-left rectangle as dig permission');
}
// A below-ground actor must not stamp a hat onto the intact surface. Nearby
// standing enemies retain their ordinary material and height footprints.
ctx.__heightG=mkG();
P('__heightActors=[];__heightG.ellipse=function(x,y){__heightActors.push([x,y]);};GLRig.hgt=__heightG;GLRig.hw=width/2;chunkMgr=null;activeBuildings=[];player.x=624;player.y=720;player.hp=100;player.dead=false;player.shovelDepth=36;enemiesList=[new Character(700,720,false,"NORMAL")];glRigPaintHeight();');
ok(P('!__heightActors.some(p=>p[0]===624&&p[1]===720)'), 'Underground player leaves no false height silhouette on the surface');
ok(P('__heightActors.some(p=>p[0]===700&&p[1]===720)'), 'Surface enemy retains its normal height and lighting');
P('__buriedEnemy=enemiesList[0];__buriedEnemy.x=624;__buriedEnemy.shovelLevel=1;__buriedEnemy.shovelDepth=36;__buriedEnemy.show=function(){__renderOrder.push("ENEMY");};__buriedCitizen=new Citizen(528,720,"FARMING");__buriedCitizen.shovelLevel=1;__buriedCitizen.shovelDepth=18;__buriedCitizen.show=function(){__renderOrder.push("CITIZEN");};__renderOrder=[];actorShow(player);actorShow(__buriedCitizen);actorShow(__buriedEnemy);actorShow(__buriedEnemy);drawShovelUndergroundActor();');
ok(P('__renderOrder.filter(s=>s==="PLAYER").length===1&&__renderOrder.filter(s=>s==="ENEMY").length===1&&__renderOrder.filter(s=>s==="CITIZEN").length===1'), 'Underground player, enemy and civilian all paint exactly once through their cutaways');
P('__heightActors=[];glRigPaintHeight();');
ok(P('!__heightActors.some(p=>p[0]===624&&p[1]===720)'), 'Underground enemy leaves no false surface height stamp');
P('__buriedEnemy.x=528;__buriedEnemy.y=720;__buriedEnemy.shovelDepth=18;__buriedCitizen.stunTimer=60;__buriedCitizen.show=function(){__renderOrder.push("BODY");};__buriedEnemy.show=function(){__renderOrder.push("STANDING");};__renderOrder=[];actorShow(__buriedEnemy);actorShow(__buriedCitizen);drawShovelUndergroundActor();');
ok(P('__renderOrder.join(",")==="BODY,STANDING"'), 'Knocked-out people in a hole remain beneath standing occupants');
P('__buriedEnemy.x=624;__buriedEnemy.shovelDepth=36;player.shovelDepth=0;__renderOrder=[];actorShow(__buriedEnemy);drawShovelUndergroundActor();');
ok(P('__renderOrder.length===0'), 'Intact underground roofs hide unrelated buried enemies from a surface player');
for (const level of [2,3,4,5,6,7]) {
  P('currentLevel='+level+';player.shovelLevel='+level+';player.shovelDepth=18;');
  ok(P('shovelBelowGroundActor(player)'), 'Grass excavation keeps its below-ground painter in sector '+level);
}
// Exercise Character.show itself: changing depth must reach the real rig,
// including its held tool, while elevation remains a separate multiplier.
P('currentLevel=1;currentBiome=1;player.shovelLevel=1;player.show=Character.prototype.show;rightStick={active:false,dx:0,dy:0,dist:0};leftStick={active:false,dx:0,dy:0};__nativeScale=scale;__scaleCalls=[];scale=function(...a){__scaleCalls.push(a);__nativeScale(...a);};');
for (const depth of [18,36,4096]) {
  P('player.shovelDepth='+depth+';__scaleCalls=[];player.show();');
  ok(P('Math.abs(__scaleCalls[0][0]-elevRenderScale(player.x,player.y)*shovelRenderScale(player))<1e-9'), 'Native Character.show scales the whole held-tool rig at depth '+depth);
}
P('__buriedCitizen.show=Citizen.prototype.show;__buriedCitizen.stunTimer=0;__buriedCitizen.shovelDepth=36;__scaleCalls=[];__buriedCitizen.show();');
ok(P('Math.abs(__scaleCalls[0][0]-shovelRenderScale(__buriedCitizen))<1e-9'), 'Native Citizen.show scales the whole civilian as they descend');
P('__buriedEnemy.show=Character.prototype.show;__buriedEnemy.shovelDepth=36;__scaleCalls=[];__buriedEnemy.show();');
ok(P('Math.abs(__scaleCalls[0][0]-elevRenderScale(__buriedEnemy.x,__buriedEnemy.y)*shovelRenderScale(__buriedEnemy))<1e-9'), 'Native enemy Character.show scales the complete rig in the same shaft');
P('__sourceDepth=shovelPlayerDepth(__buriedEnemy);__buriedCorpse=new Corpse(__buriedEnemy.x,__buriedEnemy.y,0,0,color(120),color(30),0,0,[],WEAPONS.PISTOL,0,"NORMAL",21,27,__buriedEnemy);');
ok(P('shovelPlayerDepth(__buriedCorpse)===__sourceDepth'), 'A death in the shaft retains the source actor depth');
P('__scaleCalls=[];__buriedCorpse.show();');
ok(P('Math.abs(__scaleCalls[0][0]-shovelRenderScale(__buriedCorpse))<1e-9'), 'Native Corpse.show scales every death component within its pit');
P('corpses=[__buriedCorpse];doTick=true;__nativeStampCorpse=stampCorpse;__corpseStamps=0;stampCorpse=function(){__corpseStamps++;};for(let i=0;i<200;i++){frameCount++;_shovelBelowActors.length=0;updateCorpses();}');
ok(P('corpses.length===1&&__buriedCorpse.isStatic&&__corpseStamps===0'), 'Settled underground bodies stay in the shaft and never stamp onto its surface roof');
ok(P('_shovelBelowActors.includes(__buriedCorpse)&&isGroundBodyActor(__buriedCorpse)'), 'Buried corpse enters the same deferred body-first excavation pass');
P('stampCorpse=__nativeStampCorpse;__nativeAcquireBloodChunk=acquireBloodChunk;__bloodAcquires=0;acquireBloodChunk=function(...args){__bloodAcquires++;return __nativeAcquireBloodChunk(...args);};stampCorpse(__buriedCorpse);acquireBloodChunk=__nativeAcquireBloodChunk;');
ok(P('__bloodAcquires===0'), 'Even direct retirement cannot bake an underground body into the surface texture');
P('scale=__nativeScale;');
P('currentLevel=8;');
ok(P('!shovelBelowGroundActor(player)&&shovelRenderCellsInView().length===0'), 'Closed HQ interior does not inherit an underground cutaway');
console.log('Shovel excavation rendering: '+checks+' checks passed');

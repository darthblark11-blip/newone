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
ok(P('_depthActors.length===0&&_shovelBelowActor===player'), 'Waist-deep player defers past the surface masses');
P('__renderOrder.push("GATE");drawShovelUndergroundActor();');
ok(P('__renderOrder.join(",")==="GATE,PLAYER"'), 'Gate paints before the one local underground actor');
ok(P('_shovelBelowActor===null'), 'Cutaway consumes its deferred actor after one show');
P('drawShovelUndergroundActor();');
ok(P('__renderOrder.filter(x=>x==="PLAYER").length===1'), 'Cutaway cannot advance or paint the player twice');
ok(P('__balance===0&&__clipBalance===0'), 'Open shaft balances p5 and native canvas state');
ok(P('shovelPitNeighbors(__pit).every(v=>!v)'), 'Isolated shaft has four earthen walls');
P('__right=shovelMakeCell(6,7,18,true);');
ok(P('shovelPitNeighbors(__pit)[1]&&shovelPitNeighbors(__right)[3]'), 'Adjacent pits remove both internal walls');
ok(P('shovelPitFloorBounds(__pit,shovelPitNeighbors(__pit))[2]===shovelPitFloorBounds(__right,shovelPitNeighbors(__right))[0]'), 'Connected floor planes meet exactly at the cell boundary');
P('__right.open=false;__right.ceiling=18;__right.depth=36;');
ok(P('!shovelPitNeighbors(__pit)[1]'), 'Intact ceiling remains on a roofed tunnel beside a surface shaft');
ok(P('shovelPitNeighbors(__pit,true,36)[1]'), 'The same cells connect at their shared underground layer');
P('player.x=624;player.y=720;player.shovelDepth=36;player.shovelDepthTarget=36;_shovelBelowActor=player;__renderOrder=[];drawShovelUndergroundActor();');
ok(P('__renderOrder.join(",")==="PLAYER"'), 'Roofed tunnel draws one actor inside its local cutaway');
ok(P('__balance===0&&__clipBalance===0'), 'Roofed tunnel balances both paint stacks');
P('player.show=function(){throw Error("test painter failure");};_shovelBelowActor=player;try{drawShovelUndergroundActor();}catch(e){__caught=e.message;}');
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
P('scale=__nativeScale;');
P('currentLevel=8;');
ok(P('!shovelBelowGroundActor(player)&&shovelRenderCellsInView().length===0'), 'Closed HQ interior does not inherit an underground cutaway');
console.log('Shovel excavation rendering: '+checks+' checks passed');

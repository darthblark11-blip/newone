// Canyon crossing art shares native profiles but never enters collision arrays.
const assert = require('assert/strict');
const {ctx, probe, mkG} = require('./harness');
let checks=0;
const ok=(v,label)=>{assert.ok(v,label);checks++;};
probe('BIOME_ACTIVE=true;currentBiome=currentLevel=3;authoredCore=null;seedWorldClock();');
const sites=probe('frontierCanyonLandmarks()');
function view(x,y){
  ctx.rx=x;ctx.ry=y;
  probe('viewLeft=rx-450;viewRight=rx+450;viewTop=ry-450;viewBottom=ry+450;camX=viewLeft;camY=viewTop;');
  return probe('frontierCanyonRails()');
}
for(const site of sites)for(const u of site.bridgeUs){
  ctx.site=site;ctx.u=u;
  const p=probe('frontierCanyonProfile(site.axis,u,site.index)'),
    center=probe('frontierCanyonPoint(site.axis,u,frontierCanyonProfile(site.axis,u,site.index).center)'),
    rails=view(center[0],center[1]).filter(b=>b.axis===site.axis&&b.index===site.index&&b.u===u);
  ok(rails.length>8,site.id+' crossing has real segmented raised timber');
  ok(new Set(rails.map(b=>b.key)).size===rails.length,site.id+' rail segment IDs are unique');
  ok(rails.every(b=>Number.isFinite(b.x+b.y+b.w+b.h)&&b.w>0&&b.h>0),site.id+' geometry is finite');
  ok(rails.every(b=>Math.abs((site.axis==='X'?b.x-center[0]:b.y-center[1]))===90),site.id+' rails preserve the clear 152-unit deck');
  ctx.railCenter=center;
  ok(probe('frontierCanyonHeight(railCenter[0],railCenter[1])===0'),site.id+' native walking plane stays at rim height');
  const nums=[],g=mkG();
  for(const name of ['vertex','line','rect','ellipse']){const original=g[name];g[name]=(...args)=>{nums.push(...args);original(...args);};}
  ctx.railG=g;ctx.testRails=rails;
  probe('testRails.forEach(b=>paintFrontierCanyonRail(railG,b));testRails.forEach(b=>paintFrontierCanyonRail(railG,b,true,.6));');
  ok(nums.length>200&&nums.every(Number.isFinite),site.id+' both art and lighting project finite raised faces');
  ok(probe('frontierCanyonRails()===frontierCanyonRails()'),site.id+' stable live frames reuse the view-window records');
  ok(rails.every(b=>!b.chunkKey&&!b.isBiomeProp&&!b.hp),site.id+' visual rails add no collision/destruction records');
  ok(p.bridge===1,site.id+' uses the existing bridge authority');
}
// The stored window is replaced after distant travel, rather than accumulating
// all the crossings visited during an endless run.
const a=view(-6000,1750),before=JSON.stringify(a);
for(let i=0;i<20;i++)view(i*19200,i*21600);
const b=view(-6000,1750);
ok(before===JSON.stringify(b),'Returning to negative world coordinates reconstructs identical rails');
ok(probe('_frontierCanyonRailRecords.length<180'),'Only the current view window retains geometry');
// Exercise the production sorter, rather than merely inspecting a depth key.
view(-6000,1750);
probe(`var railDrawOriginal=drawBuildings,railTrace=[],railTarget=frontierCanyonRails().find(b=>b.axis==='X');
  activeBuildings=[];_standDecor.length=0;
  drawBuildings=function(list,lo=0,hi=list.length){for(let i=lo;i<hi;i++)railTrace.push(list[i].key);};
  var railActor={x:railTarget.x,y:railTarget.y-100,show(){railTrace.push('ACTOR');}};
  _depthActors.push(railActor);drawDepthSorted();`);
ok(probe(`railTrace.indexOf('ACTOR')<railTrace.indexOf(railTarget.key)`),'A character north of the rail paints behind its raised timber');
probe(`railTrace=[];railActor.y=railTarget.y+railTarget.h/2+30;_depthActors.push(railActor);drawDepthSorted();`);
ok(probe(`railTrace.indexOf('ACTOR')>railTrace.indexOf(railTarget.key)`),'A character south of the rail paints in front of it');
probe('drawBuildings=railDrawOriginal;');
probe('currentBiome=2;');
ok(probe('frontierCanyonRails().length===0'),'Other biomes have no frontier rail rendering');
console.log('Frontier raised rails: '+checks+' checks passed.');

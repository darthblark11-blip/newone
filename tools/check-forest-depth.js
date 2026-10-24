// Crowns are overhead volumes; feet and roots keep their ground depth order.
// Verify the actual queue dispatcher across both sides of a trunk and preserve
// the existing aircraft pass, rather than checking a source-code pattern.
const assert = require('assert');
const { probe } = require('./harness');
let checks = 0;
const ok = (value, message) => { checks++; assert(value, message); };
const P = code => probe('(' + code + ')');
probe(`
  BIOME_ACTIVE=true;currentBiome=currentLevel=2;
  viewLeft=viewTop=-1000;viewRight=viewBottom=1000;frameCount=12;
  __events=[];
  paintForestClutter=function(g,d,t,phase){__events.push(d.id+':'+phase);};
  paintClutter=function(g,d){__events.push(d.id+':whole');};
  drawBuildings=function(a,lo,hi){for(let i=lo;i<hi;i++)__events.push(a[i].id+':building');};
  drawBiomeProps=function(a,lo,hi){for(let i=lo;i<hi;i++)__events.push(a[i].id+':prop');};
  activeBuildings=[{id:'wall',x:0,y:55,w:20,h:20}];
  _standDecor=[
    {id:'northTree',t:'PINE',x:0,y:10,forestSpecies:'DOUGLAS_FIR'},
    {id:'southTree',t:'TREE',x:0,y:90,forestSpecies:'RED_ALDER'},
    {id:'snag',t:'SNAG',x:0,y:70,forestSpecies:'CHARRED_SNAG'}
  ];
  _depthActors=[];_airborneActors=[];_depthOn=true;
  for(const point of [5,50,100]) actorShow({y:point,show(){__events.push('actor'+point);}});
  actorShow({id:'flyer',y:20,hp:100,eType:'AERIAL',show(){__events.push('flyer');}});
  drawDepthSorted();drawAirborneActors();
`);
const events = P('__events');
const pos = name => events.indexOf(name);
for (const tree of ['northTree','southTree']) {
  ok(pos(tree+':shadow') >= 0 && pos(tree+':shadow') < pos('actor5'), `${tree} shade stays below every actor`);
  ok(pos(tree+':crown') > pos('actor100'), `${tree} canopy covers characters on either side of the trunk`);
  ok(pos(tree+':crown') < pos('flyer'), `${tree} canopy stays beneath the airborne pass`);
  ok(events.filter(e=>e===tree+':root').length===1 && events.filter(e=>e===tree+':crown').length===1,
    `${tree} roots and foliage each draw once`);
}
ok(pos('actor5')<pos('northTree:root') && pos('northTree:root')<pos('actor50'), 'northern roots retain their depth beside feet');
ok(pos('actor50')<pos('southTree:root') && pos('southTree:root')<pos('actor100'), 'southern roots retain their depth beside feet');
ok(pos('actor50')<pos('wall:building') && pos('wall:building')<pos('actor100'), 'building contact depth is preserved');
ok(pos('snag:whole')>pos('wall:building') && pos('snag:whole')<pos('actor100'), 'bare snags retain ground depth without imaginary foliage');
ok(P('_depthActors.length===0&&_standDecor.length===0&&_forestCrowns.length===0&&_airborneActors.length===0&&!_depthOn'),
  'all reused queues close after the frame');

// Legacy trees in other biomes keep their original world-art ordering.
probe(`
  __events=[];currentBiome=currentLevel=4;
  activeBuildings=[];_depthOn=true;
  _standDecor=[{id:'legacy',t:'TREE',x:0,y:10}];
  actorShow({y:20,show(){__events.push('legacyActor');}});
  drawDepthSorted();
`);
ok(P('JSON.stringify(__events)===JSON.stringify(["legacy:whole","legacyActor"])'),
  'non-forest standing art keeps its existing depth order');
console.log(`${checks}/${checks} forest depth checks passed.`);

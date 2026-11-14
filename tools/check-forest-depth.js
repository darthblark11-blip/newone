// Crowns are overhead volumes; feet and roots keep their ground depth order.
// Verify the actual queue dispatcher across both sides of a trunk and preserve
// the existing aircraft pass, rather than checking a source-code pattern.
const assert = require('assert');
const { probe } = require('./harness');
let checks = 0;
const ok = (value, message) => { checks++; assert(value, message); };
const P = code => probe('(' + code + ')');

// Enter through the real frame, including drawGround -> drawDecor. Setting
// _depthOn in a dispatcher-only fixture misses a frame-order regression where
// draw() opened the depth queue only after ground decor had already painted.
probe(`
  isStoryMode=false;startAtLevel(2);started=true;isPaused=true;
  inStoryIntro=inStoryRoom=inDarchonCall=inTownCutscene=inFarmCutscene=
    inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inWorldBuildingMenu=
    inOverworldView=inTravelMenu=false;
  isDead=isWin=killcamMode=false;darchonCallCompleted=true;
  leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
  __frameEvents=[];__frameFaults=[];
  noteFrameFault=function(where,e){__frameFaults.push(where+': '+e.message);};
  refreshPopulation=function(){};refreshCityPeople=function(){};
  enemiesList=[];townCitizens=[];
  const witness={id:'frameTree',t:'PINE',x:player.x+80,y:player.y,s:1,
    forestSpecies:'DOUGLAS_FIR',forestRegion:'TIMBER'};
  chunkMgr.chunks.get(Math.floor(player.x/CHUNK_W)+','+Math.floor(player.y/CHUNK_W)).decor.push(witness);
  const actualDecor=ChunkManager.prototype.drawDecor;
  ChunkManager.prototype.drawDecor=function(){
    __frameEvents.push('decor:'+_depthOn);return actualDecor.call(this);
  };
  paintForestClutter=function(g,d,t,phase){
    if(d===witness)__frameEvents.push('tree:'+(phase||'whole'));return true;
  };
  player.show=function(){__frameEvents.push('player');};
  draw();draw();
`);
ok(P('__frameFaults.length===0'), 'real forest frames complete without a scene fault');
ok(P(`JSON.stringify(__frameEvents)===JSON.stringify([
  'decor:true','tree:shadow','tree:root','player','tree:wood','tree:foliage',
  'decor:true','tree:shadow','tree:root','player','tree:wood','tree:foliage'])`),
  'consecutive real frames queue trees before actors and paint the canopy above the player');

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
    {id:'snag',t:'SNAG',x:0,y:70,forestSpecies:'CHARRED_SNAG'},
    {id:'shrub',t:'WEED',x:0,y:30,forestSpecies:'BUSH'},
    {id:'log',t:'LOG',x:0,y:40,forestSpecies:'LOG',forestLiveProp:true},
    {id:'fern',t:'FERN',x:0,y:80,forestSpecies:'FERN',forestLiveProp:true}
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
  ok(pos(tree+':foliage') > pos('actor100'), `${tree} canopy covers characters on either side of the trunk`);
  ok(pos(tree+':foliage') < pos('flyer'), `${tree} canopy stays beneath the airborne pass`);
  ok(events.filter(e=>e===tree+':root').length===1 && events.filter(e=>e===tree+':wood').length===1 &&
    events.filter(e=>e===tree+':foliage').length===1, `${tree} roots, raised wood and foliage each draw once`);
  ok(pos(tree+':wood') > pos('actor100') && pos(tree+':wood') < pos('northTree:foliage'),
    `${tree} raised wood covers actors while staying below every leaf crown`);
}
ok(pos('actor5')<pos('northTree:root') && pos('northTree:root')<pos('actor50'), 'northern roots retain their depth beside feet');
ok(pos('actor50')<pos('southTree:root') && pos('southTree:root')<pos('actor100'), 'southern roots retain their depth beside feet');
ok(pos('actor50')<pos('wall:building') && pos('wall:building')<pos('actor100'), 'building contact depth is preserved');
ok(pos('snag:root')>pos('wall:building') && pos('snag:root')<pos('actor100'), 'bare snag roots retain their ground depth');
ok(pos('snag:shadow')<pos('actor5'), 'bare snag shade remains below every ground actor');
ok(pos('snag:wood')>pos('actor100') && pos('snag:wood')<pos('flyer'), 'raised bare wood covers ground figures and stays below flyers');
ok(pos('snag:wood')<pos('northTree:foliage'), 'bare snag branches remain beneath neighboring leaves');
ok(events.filter(e=>e==='snag:root').length===1 && events.filter(e=>e==='snag:wood').length===1 && !events.includes('snag:whole'),
  'bare snags split rooted and elevated wood exactly once without inventing foliage');
ok(pos('shrub:shadow')<pos('actor5') && pos('shrub:root')>pos('northTree:root') &&
  pos('shrub:root')<pos('actor50') && !events.includes('shrub:crown') && !events.includes('shrub:whole'),
  'raised shrubs cast floor shade then interleave with feet without becoming overhead crowns');
for (const prop of ['log','fern']) {
  ok(pos(prop+':shadow')<pos('actor5') && !events.includes(prop+':whole') && !events.includes(prop+':crown'),
    `${prop} draws contact shade below actors without joining the overhead crown pass`);
  ok(events.filter(e=>e===prop+':root').length===1, `${prop} raised volume draws exactly once`);
}
ok(pos('shrub:root')<pos('log:root') && pos('log:root')<pos('actor50') &&
  pos('actor50')<pos('fern:root') && pos('fern:root')<pos('actor100'),
  'small forest volumes retain their true ground depth on either side of a character');
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

// Exercise the production depth queue and real frontier painters; native
// movement crosses the same entrance stairs the overhead sign must cover.
const assert = require('assert');
const {ctx, probe, mkG} = require('./harness');
let checks = 0;
const ok = (v, name) => { assert.ok(v, name); checks++; };
const P = s => probe(s);
P(`isStoryMode=false;townsData={};currentLevel=3;currentBiome=3;BIOME_ACTIVE=true;
  legacyGenerateMap();authoredSolids=buildings.slice();authoredCore=computeAuthoredCore(authoredSolids);
  authoredChunks=buildAuthoredChunkSet(authoredSolids);authoredMask=buildAuthoredMask(authoredSolids);
  leftStick={active:false,dx:0,dy:0,dist:0};rightStick={active:false,dx:0,dy:0,dist:0};
  player=new Character(1300,240,true);activeBuildings=buildings;activeParkingCars=[];invalidateColIndex();
  width=940;height=700;zoom=1;camX=1300-width/2;camY=0-height/2;
  viewLeft=-10000;viewRight=10000;viewTop=-10000;viewBottom=10000;
  __order=[];__realMasses=drawBuildings;__realPosts=drawFrontierTownEntrancePost;
  __realArch=drawFrontierTownEntranceOverhead;
  drawBuildings=function(a,s,e){for(let i=s;i<e;i++)__order.push(a[i].testId||'OTHER');__realMasses(a,s,e);};
  drawFrontierTownEntrancePost=function(b){__order.push('POST');__realPosts(b);};
  drawFrontierTownEntranceOverhead=function(){if(frontierTownEntranceVisible())__order.push('OVERHEAD');__realArch();};
  function occlusionActor(id,x,y){return {x,y,hp:100,show(){__order.push(id);rect(this.x-5,this.y-5,10,10);}};}
  function occlusionRun(b,actor){activeBuildings=b;_depthActors=[actor];_standDecor=[];
    _depthOn=true;__order=[];drawDepthSorted();return __order.slice();}
`);
const cases = [
  {type:'western shop', flags:'isWesternBldg:true,arch:"FALSE_FRONT",facing:"E"'},
  {type:'barn', flags:'isBarn:true'},
  {type:'house', flags:'isHouse:true'},
  {type:'trailer', flags:'isTrailer:true'},
  {type:'shanty', flags:'isShanty:true'},
  {type:'procedural block', flags:'isBlockBuilding:true,style:0,details:[]'},
  {type:'bounty adobe', flags:'isBlockBuilding:true,isFrontierBountyStructure:true,frontierBountyKind:"ADOBE_KEEP"'}
];
for (const c of cases) {
  P(`__b={x:2800,y:2000,w:200,h:140,_rise:34,testId:'MASS',${c.flags}};`);
  for (const [dx,dy] of [[0,0],[-450,-300],[450,-300],[-450,300],[450,300]]) {
    P(`camX=__b.x+${dx}-width/2;camY=__b.y+${dy}-height/2;`);
    const key=P('massDepth(__b)'), base=2070;
    ok(key>=base,c.type+' retains its foundation in camera '+dx+','+dy);
    P('__roofLean=[0,0];massLean(__b.x,__b.y,buildingRise(__b),__roofLean);');
    const lean=P('__roofLean[1]');
    ok(key>=base+Math.max(0,lean),c.type+' sorts beyond its projected south roof');
    const under=P('occlusionRun([__b],occlusionActor("ACTOR",__b.x, massDepth(__b)-.1))');
    ok(under.indexOf('ACTOR')<under.indexOf('MASS'),c.type+' covers actor under eave');
    const front=P('occlusionRun([__b],occlusionActor("ACTOR",__b.x,massDepth(__b)+20))');
    ok(front.indexOf('MASS')<front.indexOf('ACTOR'),c.type+' leaves actor in street in front');
    ok(front.filter(x=>x==='MASS').length===1,c.type+' paints exactly once');
  }
}
// Follow an actual collision stop at a barn's southern wall, then let the
// production actor queue render the real player rig at that stopped position.
P(`__b={x:2800,y:2000,w:200,h:140,isBarn:true,_rise:34,testId:'MASS'};
  activeBuildings=[__b];activeParkingCars=[];invalidateColIndex();
  player.x=2800;player.y=2190;for(let i=0;i<45;i++)player.attemptMove(0,-5);
  __nativePlayerY=player.y;__realPlayerShow=player.show;
  player.show=function(){__order.push('NATIVE_PLAYER');__realPlayerShow.call(this);};`);
ok(P('__nativePlayerY>2070&&__nativePlayerY<2110'),'native collision keeps player on street beside barn');
for(const offset of [-300,300]){
  P(`camX=2800-width/2;camY=2000+${offset}-height/2;__order=[];
    _depthActors=[];_standDecor=[];_depthOn=true;actorShow(player);drawDepthSorted();`);
  const order=P('__order'), key=P('massDepth(__b)'), y=P('player.y');
  ok(y<key?order.indexOf('NATIVE_PLAYER')<order.indexOf('MASS'):order.indexOf('MASS')<order.indexOf('NATIVE_PLAYER'),
    'native stopped player and real barn painters follow projected eave at camera '+offset);
}
P('player.show=__realPlayerShow;');
// Flat surfaces and low furniture must not acquire building overhang depth.
for(const flags of ['isDeck:true,isBiomeProp:true,propType:"BRIDGE"','isCropField:true','isCrateProp:true','isBiomeProp:true,propType:"BENCH"']){
  ok(P(`massDepth({x:0,y:20,w:100,h:60,${flags}})===50`),'ground surface/furniture preserves original contact: '+flags);
}
P('__b={x:2800,y:2000,w:200,h:140,isWesternBldg:true,arch:"FALSE_FRONT",_rise:34};');
for(const biome of [1,2,4,5,6]){
  ok(P(`currentBiome=${biome};massDepth(__b)===2070`),'biome '+biome+' preserves original depth rule');
}
P('currentBiome=3;currentLevel=3;');
for(const y of [-50,-8,10,30,59,70,115]){
  const order=P(`occlusionRun([],occlusionActor('ACTOR',1300,${y}))`);
  ok(order.indexOf('ACTOR')<order.indexOf('OVERHEAD'),'entrance sign stays over grounded player at y '+y);
  ok(order.filter(v=>v==='POST').length===2,'entrance paints both posts once at y '+y);
  const firstPost=order.indexOf('POST');
  ok(y<60?order.indexOf('ACTOR')<firstPost:firstPost<order.indexOf('ACTOR'),'post bases interleave at y '+y);
}
// The arch has no collision volume; its stairs and all nearby town solids
// remain the genuine player movement path instead of a simulated teleport.
P(`activeBuildings=buildings;activeParkingCars=[];invalidateColIndex();
  player.x=1300;player.y=240;__startHeight=groundElev(player.x,player.y);
  for(let i=0;i<74;i++)player.attemptMove(0,-5);
  __endHeight=groundElev(player.x,player.y);`);
ok(P('player.y < -70'),'native player crosses stairs and under entrance without blockage');
ok(P('__endHeight>__startHeight'),'native crossing still climbs the authored raised ground');
P(`activeBuildings=[];_depthActors=[];_airborneActors=[];_depthOn=true;__order=[];
  actorShow(occlusionActor('PLAYER',1300,-8));
  var flyer=occlusionActor('AIRCRAFT',1300,-8);flyer.eType='AERIAL';actorShow(flyer);
  drawDepthSorted();drawAirborneActors();`);
ok(P('__order.indexOf("OVERHEAD")<__order.indexOf("AIRCRAFT")'),'aircraft still fly above the arch and buildings');
ok(P('_depthActors.length===0&&_airborneActors.length===0&&!_depthOn'),'new layers leave both actor queues clean');
P(`__nativeText=text;__groundSignCount=0;text=function(t,...a){if(t==='DRY GULCH')__groundSignCount++;__nativeText(t,...a);};
  legacyDrawGround(true);`);
ok(P('__groundSignCount===0'),'town ground no longer paints the raised entrance sign');
P('drawFrontierTownEntranceOverhead();');
ok(P('__groundSignCount===1'),'raised pass paints entrance sign once');
// Lighting uses the same projected roof and raised sign bounds. Exercise the
// real height painter after its real character stamp so an occluded hat cannot
// leave a dark, low-height hole in the sign that covers it.
ctx.__heightG=mkG();
P(`__heightRects=[];__heightH=0;__heightEvents=[];__realMat=glRigMat;
  glRigMat=function(g,h,gloss,turns){__heightH=h;__realMat(g,h,gloss,turns);};
  __heightG.rect=function(x,y,w,h){__heightRects.push({x,y,w,h,z:__heightH});};
  __heightG.ellipse=function(x,y){if(x===player.x&&y===player.y)__heightEvents.push('ACTOR_HEIGHT');};
  __realRaisedHeight=glRigFrontierRaisedHeight;
  glRigFrontierRaisedHeight=function(g,wet){__heightEvents.push('RAISED_HEIGHT');__realRaisedHeight(g,wet);};
  activeBuildings=[__b,{x:3000,y:2100,w:240,h:80,isDeck:true,isBiomeProp:true,propType:'BRIDGE'}];
  player.x=1300;player.y=-8;player.hp=100;player.dead=false;player.stunTimer=0;
  enemiesList=[];allies=[];chunkMgr=null;GLRig.hgt=__heightG;GLRig.hw=width/2;
  glRigPaintHeight();`);
ok(P('__heightEvents.indexOf("ACTOR_HEIGHT")<__heightEvents.indexOf("RAISED_HEIGHT")'),'raised lighting surfaces replace occluded actor stamps');
ok(P('__heightRects.some(r=>r.x===1229&&r.y===-26&&r.w===142&&r.h===36&&r.z>groundElev(player.x,player.y)+17)'), 'entrance sign height stays above player hat');
ok(P('__heightRects.some(r=>r.x===1143&&r.y===-47&&r.w===314&&r.h===14)'), 'entrance beam owns its raised height silhouette');
ok(P(`(()=>{const l=[0,0];massLean(__b.x,__b.y,buildingRise(__b),l);
  return __heightRects.some(r=>r.x===__b.x-__b.w/2+l[0]&&r.y===__b.y-__b.h/2+l[1]&&r.w===__b.w&&r.h===__b.h);
})()`),'raised roof height matches camera-projected art bounds');
ok(P('__heightRects.filter(r=>r.w===240&&r.h===80).length===1'),'bridge retains only its walkable ground height stamp');
P('currentBiome=2;__heightRects=[];glRigFrontierRaisedHeight(__heightG,0);');
ok(P('__heightRects.length===0'),'other biomes receive no frontier lighting surfaces');
P('currentBiome=3;');
P('authoredCore=null;__order=[];drawFrontierTownEntranceOverhead();');
ok(P('__order.length===0'),'entrance does not leak into a pure streamed frontier');
console.log('Frontier occlusion: '+checks+' checks passed');

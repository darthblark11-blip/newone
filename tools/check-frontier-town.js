// Dry Gulch: a permanent settlement with usable streets and mission doors.
// Run with node tools/check-frontier-town.js; GAME_JS can select a snapshot.
const {ctx,probe,calls}=require('./harness.js');
const P=s=>probe('('+s+')');
let checks=0,fails=0;
function ok(name,value,detail){checks++;if(!value){fails++;console.log('FAIL '+name+(detail?' — '+detail:''));}}

probe(`currentLevel=3;currentBiome=3;isStoryMode=false;BIOME_ACTIVE=true;
  legacyGenerateMap();authoredSolids=buildings.slice();
  authoredCore=computeAuthoredCore(authoredSolids);
  authoredChunks=buildAuthoredChunkSet(authoredSolids);authoredMask=buildAuthoredMask(authoredSolids);
  activeBuildings=buildings;activeParkingCars=[];invalidateColIndex();
  player=new Character(1300,0,true);`);
const solids=P('buildings'),town=solids.filter(b=>b.isWesternBldg);
const landmarks=P('frontierTownLandmarks()');
ok('western town has more than sixty named premises',town.length>=60,town.length);
ok('civic, saloon and industrial buildings have distinct silhouettes',new Set(town.map(b=>b.arch)).size>=14);
ok('arcade entry retains Dry Gulch',P('hasAuthoredCore(3)'));
probe('isStoryMode=true;townsData={3:{established:true}};');
ok('settlement retains Dry Gulch',P('hasAuthoredCore(3)'));
ok('original farm barn survives',solids.some(b=>b.isBarn&&b.x===-600&&b.y===-400));
ok('original crop field survives',solids.some(b=>b.isCropField&&b.x===-600&&b.y===300));
ok('trailer park remains outside western Main Street',solids.filter(b=>b.isTrailer).length===9&&solids.filter(b=>b.isTrailer).every(b=>b.y>=700));

const overlaps=[];
for(const a of town)for(const b of solids){
  if(a===b||b.isCropField)continue;
  if(Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.y-b.y)<(a.h+b.h)/2)
    overlaps.push(a.signText+' / '+(b.signText||b.x+','+b.y));
}
ok('storefront footprints are clear of all buildings and furniture',overlaps.length===0,overlaps.join('; '));

function clearPath(name,points){
  ctx.__walk=points;
  const blocked=P(`window.__walk.filter(p=>{
    player.x=p[0];player.y=p[1];return player.checkCol(p[0],p[1]);
  })`);
  ok(name,blocked.length===0,JSON.stringify(blocked.slice(0,5)));
}
const main=[];for(let y=-4830;y<=230;y+=12)main.push([1300,y]);
clearPath('Main Street remains walkable for its entire length',main);
const roads=P('DG_ROADS[3]');
for(const street of roads.cross){
  const points=[];for(let x=street.x0+24;x<street.x1-24;x+=12)points.push([x,street.y]);
  clearPath('cross street at '+street.y+' is open',points);
}
const rail=[];
for(let y=roads.sideRoad.y0+25;y<roads.sideRoad.y1-25;y+=12)
  rail.push([P('frontierTownSideRoadX('+y+',DG_ROADS[3].sideRoad)'),y]);
clearPath('railway avenue joins the northern and eastern districts',rail);
clearPath('saloon entrance joins Main Street',Array.from({length:13},(_,i)=>[1300-(1300-landmarks.saloon.doorX)*i/12,landmarks.saloon.doorY]));
clearPath('sheriff board joins Main Street',Array.from({length:13},(_,i)=>[1300+(landmarks.board.x-40-1300)*i/12,landmarks.board.y]));
clearPath('duel plaza has room for both gunfighters',Array.from({length:41},(_,i)=>[1100+i*10,landmarks.duel.y]));
const bar=town.find(b=>b.isFrontierSaloon),sheriff=town.find(b=>b.isFrontierSheriff);
ok('saloon footprint and door use the activity plan',bar&&bar.x===landmarks.saloon.x&&bar.y===landmarks.saloon.y&&bar.w===landmarks.saloon.w&&bar.h===landmarks.saloon.h&&landmarks.saloon.doorX>bar.x+bar.w/2+15);
ok('board is outside the sheriff building',sheriff&&landmarks.board.x+15<sheriff.x-sheriff.w/2);

// Real draw dispatch, including camera projection and the unrotated signs.
probe('viewLeft=-10000;viewRight=10000;viewTop=-10000;viewBottom=10000;seedWorldClock();');
for(const hour of [8,16])for(const facing of ['N','E','S','W']){
  ctx.__faces=town.map(b=>({...b,facing}));
  let err=null;
  try{probe(`worldTimeMs=${hour}/24*DAY_MS;updateSunVector();drawBuildings(window.__faces);legacyDrawGround(true);`);}
  catch(e){err=e.message;}
  ok('all western art draws facing '+facing+' at '+hour+':00',err===null,err);
}
ok('western draw pass paints visible geometry',calls.sig!==0);
for(const [cx,cy] of [[1,-4],[1,-3],[1,-1],[2,-3]]){
  let err=null;try{probe('bakeChunkTerrain(3,'+cx+','+cy+',[])');}catch(e){err=e.message;}
  ok('authored road junction bakes at '+cx+','+cy,err===null,err);
}
const dust=JSON.stringify(P('window.westernDust'));
probe('legacyGenerateMap();');
ok('expanded street dust remains stable after revisiting',dust===JSON.stringify(P('window.westernDust')));

console.log('Frontier town: '+checks+' checks, '+fails+' failures; '+town.length+' premises.');
process.exitCode=fails?1:0;

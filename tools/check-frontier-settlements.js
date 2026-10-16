// Satellite towns share their geometry, roads, population hooks and saved IDs.
// GAME_JS can select a frozen integration snapshot.
const {ctx,probe,calls}=require('./harness.js');
const P=s=>probe('('+s+')');
let checks=0,fails=0;
function ok(label,value,detail=''){checks++;if(!value){fails++;console.log('FAIL '+label+(detail?' — '+detail:''));}}
probe(`currentLevel=3;currentBiome=3;BIOME_ACTIVE=true;isStoryMode=false;
  legacyGenerateMap();authoredSolids=buildings.slice();authoredCore=computeAuthoredCore(authoredSolids);
  authoredChunks=buildAuthoredChunkSet(authoredSolids);authoredMask=buildAuthoredMask(authoredSolids);
  player=new Character(1300,0,true);activeBuildings=buildings;activeParkingCars=[];`);
const sites=P('frontierSettlementSites()');
ok('three named satellite towns supplement Dry Gulch',sites.length===3&&new Set(sites.map(s=>s.name)).size===3);
ok('town economies differ',new Set(sites.map(s=>s.kind)).size===3);
ok('town query leaves the starting saloon independent',P('frontierSettlementAt(940,-1730)')===null);
ok('town query outside site returns no town',P('frontierSettlementAt(100000,100000)')===null);
const identities=[];
for(const site of sites){
  ctx.__site=site;
  const name=site.name;
  const plan=P('frontierSettlementPlan(window.__site)');
  identities.push(plan.filter(p=>p.arch).map(p=>p.arch).join(','));
  ok(name+' has twelve named premises',plan.filter(p=>p.isWesternBldg&&p.signText).length===12);
  ok(name+' resolves its own center',P('frontierSettlementAt(window.__site.x,window.__site.y).id')===site.id);
  ok(name+' owns the exact site boundary',P('frontierSettlementAt(window.__site.x+window.__site.w/2,window.__site.y).id')===site.id);
  ok(name+' does not own desert beyond the boundary',P('frontierSettlementAt(window.__site.x+window.__site.w/2+1,window.__site.y)')===null);
  ok(name+' query margin is explicit',P('frontierSettlementAt(window.__site.x+window.__site.w/2+31,window.__site.y,32).id')===site.id);
  ok(name+' is clear of bounty camps',P('frontierBountySites().every(b=>Math.abs(b.x-window.__site.x)>(b.w+window.__site.w)/2||Math.abs(b.y-window.__site.y)>(b.h+window.__site.h)/2)'));
  ok(name+' is clear of the fort compound',P('Math.abs(outpostFortDef(3).x-window.__site.x)>FORT_HALF_W+window.__site.w/2+460||Math.abs(outpostFortDef(3).y-window.__site.y)>FORT_HALF_H+window.__site.h/2+460'));
  const chunks=[];
  for(let j=Math.floor((site.y-site.h/2)/1200);j<=Math.floor((site.y+site.h/2-1)/1200);j++)
    for(let i=Math.floor((site.x-site.w/2)/1200);i<=Math.floor((site.x+site.w/2-1)/1200);i++)chunks.push([i,j]);
  ctx.__chunks=chunks;
  const content=P('window.__chunks.flatMap(([cx,cy])=>generateChunkContent(3,cx,cy).solid)');
  const town=content.filter(s=>s.frontierSettlementId===site.id);
  ok(name+' materializes its complete plan exactly once',town.length===plan.length&&new Set(town.map(p=>p.frontierSettlementPart)).size===plan.length);
  ok(name+' replaces anonymous overlapping scatter',content.every(p=>p.frontierSettlementId===site.id));
  ok(name+' owns stable namespaced destruction IDs',town.every(p=>p.chunkKey.includes(',settlement:'+site.id+':')));
  ok(name+' deterministically survives reverse chunk generation order',P(`JSON.stringify(window.__chunks.flatMap(([cx,cy])=>generateChunkContent(3,cx,cy).solid).sort((a,b)=>a.chunkKey.localeCompare(b.chunkKey)))===JSON.stringify(window.__chunks.slice().reverse().flatMap(([cx,cy])=>generateChunkContent(3,cx,cy).solid).sort((a,b)=>a.chunkKey.localeCompare(b.chunkKey)))`));
  const overlaps=[];
  for(let i=0;i<town.length;i++)for(let j=i+1;j<town.length;j++){
    const a=town[i],b=town[j];if(a.isCropField||b.isCropField)continue;
    if(Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.y-b.y)<(a.h+b.h)/2)overlaps.push(a.frontierSettlementPart+'/'+b.frontierSettlementPart);
  }
  ok(name+' premises and yard furniture do not overlap',overlaps.length===0,overlaps.join(';'));
  ctx.__town=town;probe('buildings=window.__town;activeBuildings=buildings;invalidateColIndex();');
  const routes=[];
  for(let x=site.x-site.w/2-170;x<=site.x+site.w/2+170;x+=12)routes.push([x,site.y]);
  for(const x of [site.x-600,site.x+600])for(let y=site.y-590;y<=site.y+590;y+=12)routes.push([x,y]);
  ctx.__route=routes;
  const blocked=P('window.__route.filter(([x,y])=>{player.x=x;player.y=y;return player.checkCol(x,y);})');
  ok(name+' east/west street and both north/south approaches are walkable',blocked.length===0,JSON.stringify(blocked.slice(0,4)));
  const points=[];
  for(let y=site.y-560;y<=site.y+560;y+=140)for(let x=site.x-1160;x<=site.x+1160;x+=145)points.push([x,y]);
  ctx.__points=points;
  ok(name+' lies on the canyon-safe town pad',P('window.__points.every(([x,y])=>Math.abs(frontierCanyonHeight(x,y))<.01)'));
  ok(name+' wagon trail meets its crossing from the north and south',P('[-600,600].every(dx=>[-590,590].every(dy=>Math.abs(frontierTrailX(3,Math.floor((window.__site.x+dx)/CHUNK_W),window.__site.y+dy)-(window.__site.x+dx))<.01))'));
  ok(name+' one-pixel chunk-edge road seam matches',P('[-600,600].every(dx=>{const cx=Math.floor((window.__site.x+dx)/CHUNK_W),y=window.__site.y-600;return Math.abs(frontierTrailX(3,cx,y-.00001)-frontierTrailX(3,cx,y+.00001))<.001;})'));
  const selected=town.find(p=>p.isCrateProp||p.isHayBale||p.isWagonProp);
  ctx.__destroy=selected.chunkKey;ctx.__cx=Math.floor(selected.x/1200);ctx.__cy=Math.floor(selected.y/1200);
  probe('markPropDestroyed(3,window.__destroy);');
  ok(name+' a removed yard prop stays removed when streamed again',P('!generateChunkContent(3,window.__cx,window.__cy).solid.some(p=>p.chunkKey===window.__destroy)'));
  const remaining=P('generateChunkContent(3,window.__cx,window.__cy).solid.map(p=>p.chunkKey)');
  ctx.__remaining=remaining;
  probe('biomeState=JSON.parse(JSON.stringify(biomeState));');
  ok(name+' saved destruction survives record serialization',P('JSON.stringify(generateChunkContent(3,window.__cx,window.__cy).solid.map(p=>p.chunkKey))===JSON.stringify(window.__remaining)'));
  ok(name+' a legacy numeric destruction slot cannot erase a new premise',P(`(()=>{const state=getBiomeState(3);for(let i=0;i<100;i++)state.destroyed[window.__cx+','+window.__cy+','+i]=true;return generateChunkContent(3,window.__cx,window.__cy).solid.filter(p=>p.isWesternBldg).length===6;})()`));
  probe('biomeState={};viewLeft=-15000;viewRight=15000;viewTop=-15000;viewBottom=15000;seedWorldClock();');
  let drawError=null;try{probe('drawBuildings(window.__town);window.__chunks.forEach(([cx,cy])=>bakeChunkTerrain(3,cx,cy,[]));');}catch(e){drawError=e.message;}
  ok(name+' art and material bakes render through native dispatch',drawError===null,drawError);
}
ok('all three architectural mixes differ',new Set(identities).size===3);
ok('materials and native structures paint visible geometry',calls.sig!==0);
// The entire settlement feature is inert in every other biome and at distant
// frontier sites; neither filtering nor planning is allowed to advance RNG.
ctx.__sentinel={solid:[{x:8400,y:-6600,w:40,h:40,chunkKey:'old'}],decor:[],decorBake:[],cars:[]};
probe('filterFrontierSettlementContent(2,7,-6,window.__sentinel);');
ok('other sectors retain their scenery even at matching coordinates',P('window.__sentinel.solid.length')===1);
ctx.__sentinel={solid:[{x:40000,y:40000,w:40,h:40,chunkKey:'old'}],decor:[],decorBake:[],cars:[]};
probe('filterFrontierSettlementContent(3,33,33,window.__sentinel);');
ok('distant desert retains its exact native object',P('window.__sentinel.solid[0].chunkKey')==='old');
console.log('Frontier settlements: '+checks+' checks, '+fails+' failures; '+sites.length+' new towns.');
process.exitCode=fails?1:0;

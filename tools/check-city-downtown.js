// Downtown is a connected destination with actual traversable relief. Exercise
// native chunks, Character collision, terrain paint and lighting, not a mock map.
const assert=require('assert');
const {ctx,probe,mkG}=require('./harness');
const P=s=>probe('('+s+')');
probe(`currentLevel=currentBiome=1;BIOME_ACTIVE=true;isStoryMode=false;doTick=true;
  authoredCore=authoredChunks=authoredMask=null;biomeState={};
  buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];barrels=[];enemiesList=[];
  invalidateColIndex();player=new Character(600,8800,true);`);
const sites=[],parks=[],plans=new Set();let canalSamples=0,routeRuns=0;
for(let cy=3;cy<=11;cy++)for(let cx=-5;cx<=4;cx++){
  const plan=P(`cityDowntownBlockPlan(${cx},${cy})`);
  const inside=cx>=-3&&cx<=2&&cy>=5&&cy<=9&&!P(`cityHasCanal(1,${cy})`);
  if(!inside){assert.equal(plan,null,'downtown leaked beyond its fixed neighbourhood or canal');continue;}
  assert([14,15,16].includes(plan),'downtown selected an unrelated city plan');plans.add(plan);
  const ch=P(`generateChunkContent(1,${cx},${cy})`);
  assert.equal(JSON.stringify(ch),JSON.stringify(P(`generateChunkContent(1,${cx},${cy})`)),'downtown changes when regenerated');
  assert(ch.solid.every(b=>b.chunkKey.includes('downtown:v1:')),'downtown fixtures share old district/civic destruction indices');
  assert.equal(P(`cityDistrictGroundPlan(${cx},${cy},cityZoneAt(1,${cx*1200},${cy*1200}))`),plan,'native downtown ground disagrees with its buildings');
  const bs=ch.solid.filter(b=>b.cityArchitecture!==undefined);
  assert((bs.length>0||plan===16&&ch.solid.some(b=>b.propType==='CHECKPOINT'))&&!ch.solid.some(b=>b.isParkingLot||b.isWater||b.propType==='WRECK'),`downtown ${cx},${cy} lost its coherent streetscape`);
  if(plan===14)assert(bs.every(b=>b.cityArchitecture===14&&b.cityStoreys===6&&b._rise>=52&&b._rise<=64),'business block lacks real tall building masses');
  if(plan===15)assert(bs.every(b=>b.cityArchitecture===15),'business arcade lost its roof identity');
  const site={cx,cy,x:cx*1200+600,y:cy*1200+600,ch,plan};sites.push(site);
  if(plan!==16)continue;
  parks.push(site);
  const deck=ch.solid.filter(b=>b.propType==='CITYPARKTERRACE');
  assert.equal(deck.length,1,`native park ${cx},${cy} lost its walkable terrace`);assert(deck[0].isDeck&&deck[0].w===820&&deck[0].h===700,'park surface became a blocking slab');
  const trees=ch.decor.filter(d=>d.cityDowntown&&d.t==='TREE'),trunks=ch.solid.filter(b=>b.cityDowntown&&b.isTreeTrunk);
  assert(trees.length>=5&&trees.length<=6,'park lacks its native tree stand');assert.equal(trees.length,trunks.length);
  assert(trunks.every(b=>b.w===18&&b.h===18&&trees.some(t=>t.x===b.x&&t.y===b.y)),'tree art and ground collision disagree');
  const blockers=ch.solid.filter(b=>!b.noClip&&!b.isDeck&&!b.isGrassLot&&!b.isWater);
  // These are the deck's full cardinal stair/ramp axes, at actual player width.
  for(const axis of['x','y'])for(let d=axis==='x'?-425:-370;d<=(axis==='x'?425:370);d+=10){
    const x=site.x+(axis==='x'?d:0),y=site.y+(axis==='y'?d:0);
    assert(!blockers.some(b=>Math.abs(x-b.x)<b.w/2+12&&Math.abs(y-b.y)<b.h/2+12),`park ${cx},${cy} obstructs its ${axis} cardinal approach`);
  }
}
assert.equal(sites.length,24,'downtown must remain one 6-column neighbourhood around its canal row');
assert.deepEqual([...plans].sort((a,b)=>a-b),[14,15,16]);assert(parks.length>=6,'downtown parks are isolated tokens');
// Load the whole neighbourhood and its perimeter simultaneously. A checkpoint
// owned by a neighbouring chunk must not extend an arm into a downtown roof.
const neighbourhood=[],landAddresses=new Set(sites.map(s=>`${s.cx},${s.cy}`));let openJunctions=0,edgeChunks=0;
const checkpointTypes=new Set(['CHECKPOINT','GUARDBOX','SANDBAG','BLASTWALL']);
for(let cy=4;cy<=10;cy++)for(let cx=-4;cx<=3;cx++){
  const ch=P(`generateChunkContent(1,${cx},${cy})`);neighbourhood.push(...ch.solid);
  const touches=[[-1,-1],[-1,0],[0,-1],[0,0]].some(([dx,dy])=>landAddresses.has(`${cx+dx},${cy+dy}`));
  assert.equal(P(`cityDowntownJunction(${cx},${cy})`),touches,'public junction ownership disagrees with its four adjacent blocks');
  const land=landAddresses.has(`${cx},${cy}`),oldCheckpoint=P(`bnoise(1,${cx}*4096+7717,${cy}*4096+3131,.31)>.62`);
  if(touches){
    assert(!P(`cityIsCheckpoint(1,${cx},${cy})`),'downtown public junction remains a military checkpoint');
    assert(!ch.solid.some(b=>checkpointTypes.has(b.propType)),'checkpoint masses remain at a public downtown junction');openJunctions++;
  }
  if(!land&&touches&&oldCheckpoint){const key=P(`cityLeisureBlockPlan(${cx},${cy})`)!==null?'leisure:v1:':'downtown-edge:v1:';assert(ch.solid.every(b=>b.chunkKey.includes(key)),'removed checkpoint left old edge destruction keys active');edgeChunks++;}
  else if(!land)assert(!ch.solid.some(b=>b.chunkKey.includes('downtown-edge:v1:')),'unchanged city chunk was unnecessarily renamed');
}
assert(edgeChunks>0,'native neighbourhood does not exercise the former checkpoint boundary');
const downtownRoofs=neighbourhood.filter(b=>b.cityArchitecture!==undefined&&b.cityPlan>=14);
for(const roof of downtownRoofs)for(const b of neighbourhood){
  if(b===roof||b.noClip||b.isDeck||b.isGrassLot||b.isWater)continue;
  assert(!(Math.abs(roof.x-b.x)<(roof.w+b.w)/2&&Math.abs(roof.y-b.y)<(roof.h+b.h)/2),`neighbouring ${b.propType||'mass'} intersects a downtown building`);
}

// Trees, pavilion, furniture and deck remain in their real native collision lists.
function loadSolids(ch){ctx.__solids=ch.solid;probe('buildings=__solids;activeBuildings=__solids;parkingCars=[];activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();');}
for(const site of parks){
  loadSolids(site.ch);
  for(const axis of['x','y'])for(const sign of[-1,1]){
    const half=axis==='x'?425:370,distance=half*2;
    const sx=site.x+(axis==='x'?-sign*half:0),sy=site.y+(axis==='y'?-sign*half:0);
    probe(`player=new Character(${sx},${sy},true);`);
    for(let i=0;i<480;i++){
      const p=P('[player.x,player.y]'),travel=axis==='x'?(p[0]-sx)*sign:(p[1]-sy)*sign;
      if(travel>=distance-2)break;
      probe(`player.attemptMove(${axis==='x'?4*sign:0},${axis==='y'?4*sign:0});`);
    }
    const p=P('[player.x,player.y]');
    assert((axis==='x'?(p[0]-sx):(p[1]-sy))*sign>=distance-2,`native player cannot traverse park ${site.cx},${site.cy} along ${axis},${sign}`);routeRuns++;
  }
}
// Native movement feels the hillside even with normal generated cover loaded.
const hillChunk=P('generateChunkContent(1,0,7)');loadSolids(hillChunk);
probe('player=new Character(600,8800,true);');
const initialHeight=P('groundElev(player.x,player.y)'),up=P('player.attemptMove(0,4)'),upY=P('player.y'),upHeight=P('groundElev(player.x,player.y)');
probe('player.x=600;player.y=8800;');
const down=P('player.attemptMove(0,-4)'),downY=P('player.y'),downHeight=P('groundElev(player.x,player.y)');
assert(up.y>0&&up.y<4&&down.y<-4&&down.y>=-4.4,'native Character movement does not distinguish climbing and descending');
assert(Math.abs(upY-8800-up.y)<1e-9&&Math.abs(downY-8800-down.y)<1e-9,'reported movement differs from actual actor displacement');
assert(upHeight>initialHeight&&downHeight<initialHeight,'movement sample is not actually on a hill');
assert(P('elevRenderScale(600,8800)')>1&&P('elevRenderScale(600,5400)')===1,'figure elevation does not follow hill and gate ground');
// Hill joins are C1 across world/chunk boundaries, independent of load order.
const height=(x,y)=>P(`cityDowntownGroundHeight(${x},${y})`);
let seamChecks=0,maxHeight=0;
function continuous(x,y,axis){
  const e=.05,h=height(x,y),lo=height(x-(axis==='x'?e:0),y-(axis==='y'?e:0)),hi=height(x+(axis==='x'?e:0),y+(axis==='y'?e:0));
  assert(Math.abs(hi-lo)<.02,'hill has a height step at a seam');
  assert(Math.abs((h-lo)/e-(hi-h)/e)<.001,'hill has a slope break at a seam');seamChecks++;
}
for(const x of[-4200,-3600,-2400,-1200,0,1200,2400,3600,4200])for(let y=8400;y<=13200;y+=240)continuous(x,y,'x');
for(const y of[8400,9600,10800,12000,13200])for(let x=-4200;x<=4200;x+=240)continuous(x,y,'y');
for(let y=8200;y<=13400;y+=100)for(let x=-4400;x<=4400;x+=200){const h=height(x,y);assert(Number.isFinite(h)&&h>=0&&h<=108.001,'hill exceeds its bounded rise');maxHeight=Math.max(maxHeight,h);}
assert(maxHeight>65,'downtown ridge is visually flat');
for(const [x,y]of[[-4201,9600],[4201,10800],[600,8399],[600,13201],[600,-4200],[600,5400]])assert.equal(height(x,y),0,'hill extends onto gates or outside its ground envelope');
for(const site of parks){
  const park=(dx,dy)=>P(`cityDowntownParkHeight(${site.x+dx},${site.y+dy})`);
  assert.equal(park(0,0),28);assert.equal(P(`groundElev(${site.x},${site.y})`),height(site.x,site.y),'park height was omitted or added twice');
  for(const axis of['x','y']){
    const edge=axis==='x'?410:350;
    for(const sign of[-1,1]){
      const coord=d=>[site.x+(axis==='x'?sign*d:0),site.y+(axis==='y'?sign*d:0)];
      assert.equal(park(axis==='x'?sign*edge:0,axis==='y'?sign*edge:0),0,'park rise does not meet the adjacent street');
      continuous(...coord(edge),axis);continuous(...coord(edge-110),axis);
    }
    let previous=28;
    for(let d=0;d<=edge+20;d+=2){const h=park(axis==='x'?d:0,axis==='y'?d:0);assert(h<=previous+1e-9&&Math.abs(h-previous)<.8,'park stair/ramp height jumps');previous=h;}
  }
}
assert(P('cityHasCanal(1,6)'),'downtown waterfront test row lost its canal');
for(let cx=-3;cx<=2;cx++){
  const ch=P(`generateChunkContent(1,${cx},6)`),water=ch.solid.filter(b=>b.isWater);
  assert(water.length>0,'coherent downtown canal row has no native water');
  for(const b of water){assert.equal(P(`groundElev(${b.x},${b.y})`),0,'downtown ridge lifted native canal water');canalSamples++;}
}
// Preserve original biomes, including the nonzero canyon field, rather than
// assuming every surface outside the city was flat before this change.
const cityHeight=ctx.cityDowntownGroundHeight;let foreignCalls=0;
ctx.cityDowntownGroundHeight=(...args)=>{foreignCalls++;return cityHeight(...args);};
for(const biome of[2,3,4,5,6,7]){
  probe(`currentLevel=currentBiome=${biome};authoredCore=null;`);
  for(const [x,y]of[[600,8800],[-3000,9000],[0,0]]){
    const expected=biome===3?P(`frontierCanyonHeight(${x},${y})`):0;
    assert.equal(P(`groundElev(${x},${y})`),expected,'city hill changed another biome ground field');
  }
}
probe('currentLevel=currentBiome=3;');
assert(P("groundElev(frontierCanyonCenter('Y',0,0),0)")<-100,'existing canyon floor was flattened');
assert.equal(foreignCalls,0,'another biome queried city-only relief');ctx.cityDowntownGroundHeight=cityHeight;
probe('currentLevel=currentBiome=1;BIOME_ACTIVE=false;');assert.equal(P('groundElev(600,8800)'),0,'interior scene inherited downtown relief');probe('BIOME_ACTIVE=true;');
// The static grade wash stays finite, world aligned and bounded at 225 stamps
// per chunk, with its reference sun restored after dawn/night/rain variants.
let gradeBakes=0;
for(const site of sites.filter(s=>s.cy>=7))for(const hour of[8,18,23])for(const rain of[false,true]){
  const g=mkG(),rects=[],colors=[];g.fill=(...a)=>{assert(a.every(Number.isFinite));colors.push(a);};g.rect=(...a)=>{assert(a.every(Number.isFinite));rects.push(a);};ctx.__grade=g;
  probe(`worldTimeMs=${hour}/24*DAY_MS;isRaining=${rain};updateSunVector();`);const sun=P('[LIGHT_DX,LIGHT_DY]');
  probe(`bakeCityDowntownRelief(__grade,1,${site.cx*1200},${site.cy*1200});`);
  assert(rects.length>0&&rects.length<=225&&rects.every(r=>r[2]===80&&r[3]===80),'baked grade exceeds its static mesh budget');
  assert(colors.every(c=>c.length===4&&c.every(Number.isFinite)),'grade colors are not finite');
  assert.equal(JSON.stringify(P('[LIGHT_DX,LIGHT_DY]')),JSON.stringify(sun),'grade bake changed the live sun');gradeBakes++;
}
ctx.__grade=mkG();let foreignPaint=0;ctx.__grade.rect=()=>foreignPaint++;probe('bakeCityDowntownRelief(__grade,2,0,8400);');assert.equal(foreignPaint,0,'city grade paints into another biome');
// The live light mesh reuses a bounded height buffer and samples the exact
// same world field. View size cannot turn one hill into an unbounded mesh.
const triangle=ctx.paintFrontierHeightTriangle;let triangles=0;const meshSamples=new Map();
ctx.paintFrontierHeightTriangle=(g,...a)=>{
  assert(a.every(Number.isFinite),'non-finite hill light mesh');
  for(let i=0;i<9;i+=3)assert(Math.abs(a[i+2]-height(a[i],a[i+1]))<.0001,'light mesh samples a different ground height');
  for(let i=0;i<9;i+=3)meshSamples.set(`${a[i]},${a[i+1]}`,a[i+2]);
  triangles++;return triangle(g,...a);
};
ctx.__hillMesh=mkG();
for(const [left,top,w,h,visible]of[[-3600,8400,7200,4800,true],[-1800,9000,1800,1200,true],[-20000,-10000,40000,30000,true],[6000,6000,1200,1200,false],[-4800,-4600,10800,10600,false]]){
  probe(`viewLeft=${left};viewTop=${top};viewRight=${left+w};viewBottom=${top+h};zoom=.66;GLRig.hw=600;`);triangles=0;
  probe('paintCityDowntownHeightfield(__hillMesh);');assert(triangles<=1080,'hill lighting exceeds the face budget');
  if(visible)assert(triangles>0,'visible hill never enters the light height mesh');else assert.equal(triangles,0,'distant flat city paints hill triangles');
}
// Run the full material painter with a real generated park deck. The generic
// deck branch must not overwrite the sampled hill with one flat centre stamp.
for(const site of parks){
  const g=mkG(),rects=[];g.rect=(...a)=>{assert(a.every(Number.isFinite));rects.push(a);};ctx.__parkMaterial=g;
  ctx.__nativeParkDeck=site.ch.solid.find(b=>b.propType==='CITYPARKTERRACE');
  probe(`GLRig.hgt=__parkMaterial;GLRig.hw=600;zoom=.66;chunkMgr=null;player=null;enemiesList=[];
    activeBuildings=[__nativeParkDeck];viewLeft=${site.cx*1200};viewRight=${(site.cx+1)*1200};
    viewTop=${site.cy*1200};viewBottom=${(site.cy+1)*1200};`);
  meshSamples.clear();triangles=0;probe('glRigPaintHeight();');
  assert(triangles>0,'full material painter omitted park relief');
  assert(!rects.some(r=>r[2]===820&&r[3]===700),'flat park-deck material stamp overwrites the continuous terrain mesh');
  // Grid vertices need not land on the exact park centre (600 is halfway
  // between 80-unit samples). Compare actual nearest material vertices instead.
  const closest=(x,y)=>[...meshSamples].map(([key,z])=>{const [px,py]=key.split(',').map(Number);return{x:px,y:py,z,d:Math.hypot(px-x,py-y)};}).sort((a,b)=>a.d-b.d)[0];
  const center=closest(site.x,site.y),street=closest(site.x+480,site.y);
  assert(center&&street&&center.d<80&&street.d<80&&Math.abs(center.z-street.z)>5,'material buffer lost the park-to-street height difference');
  assert(Math.abs(center.z-height(center.x,center.y))<.0001&&Math.abs(street.z-height(street.x,street.y))<.0001,'native park material height differs from character ground height');
}
ctx.paintFrontierHeightTriangle=triangle;
// Exercise scene emitters on actual positive ground, including already-grounded
// civic fixtures. The native shader-side height must add the grade exactly once.
probe(`player=null;enemiesList=[];fires=[];activeBuildings=[{x:-3000,y:9000,w:16,h:16,isStreetLight:true}];
  viewLeft=-4000;viewRight=-2000;viewTop=8000;viewBottom=10000;frameCount++;_emitFrame=-1;`);
let emitter=P("sceneEmitters().find(e=>e.fix==='LAMP')");assert(emitter,'native hill lamp missing');ctx.__lamp=emitter;
const lampGround=P('glRigEmitterGround(__lamp)'),lampHeight=P('glRigEmitterHeight(__lamp,glRigEmitterGround(__lamp))');
assert(lampGround>0&&Math.abs(lampHeight-(46+lampGround))<1e-9,'ordinary hill lamp omitted or doubled its ground height');
probe('activeBuildings[0].isCivic=true;frameCount++;_emitFrame=-1;');emitter=P("sceneEmitters().find(e=>e.fix==='LAMP')");ctx.__lamp=emitter;
assert(emitter.z>46&&P('glRigEmitterHeight(__lamp,glRigEmitterGround(__lamp))')===emitter.z,'already-grounded civic hill lamp double-counts its grade');
console.log(`City downtown passed: ${sites.length} coherent blocks, ${parks.length} parks, ${routeRuns} native cardinal traversals, ${openJunctions} open junctions / ${edgeChunks} renamed edges, ${seamChecks} height/slope joins, ${canalSamples} native canal volumes, ${gradeBakes} finite weather grade bakes, bounded light meshes and grounded emitters.`);

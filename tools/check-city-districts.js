// Real generator invariants: distinct routes, collision geometry, persistence,
// and rendering at opposite lean directions in daylight, night and rain.
const assert=require('assert');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
probe('currentLevel=1;currentBiome=1;BIOME_ACTIVE=true;authoredCore=null;authoredMask=null;authoredChunks=null;biomeState={};');
const found=new Map(),arches=new Set();let chunks=0;
for(let cy=5;cy<25;cy++)for(let cx=-25;cx<25;cx++){
  const ch=P(`generateChunkContent(1,${cx},${cy})`);chunks++;
  assert.equal(JSON.stringify(ch),JSON.stringify(P(`generateChunkContent(1,${cx},${cy})`)));
  const bs=ch.solid.filter(b=>b.cityArchitecture!==undefined);
  if(!bs.length)continue;
  found.set(bs[0].cityPlan,{cx,cy,ch});
  for(const b of bs){
    arches.add(b.cityArchitecture);assert(b.chunkKey.includes('district:'));
    assert(b.x-b.w/2>=cx*1200+165&&b.x+b.w/2<=cx*1200+1035);
    assert(b.y-b.h/2>=cy*1200+165&&b.y+b.h/2<=cy*1200+1035);
    assert(P(`buildingRise(${JSON.stringify(b)})`)<=42);
  }
  // Every plan leaves a continuous east-west route at player diameter 24.
  // Furniture may provide cover, but buildings must never seal the whole block.
  const cy0=cy*1200+600,cx0=cx*1200+600;
  assert(Array.from({length:61},(_,i)=>cy0-300+i*10).some(y=>
    bs.every(b=>Math.abs(y-b.y)>=b.h/2+12)), 'district lacks a traversable cross route');
  const blockers=ch.solid.filter(b=>!b.isGrassLot&&!b.isDeck&&!b.isWater);
  for(const a of bs)for(const b of blockers){if(a===b)continue;
    assert(!(Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.y-b.y)<(a.h+b.h)/2),'new architecture overlaps cover');
  }
}
assert.equal(found.size,6);assert.equal(arches.size,6);
const ellipse=ctx.ellipse;
ctx.ellipse=(...args)=>{assert(args.every(Number.isFinite),'non-finite foliage geometry');return ellipse(...args);};
// Facade windows must be on the two exposed faces, not covered by the roof.
const quad=ctx.quad,quads=[];ctx.quad=(...a)=>{quads.push(a);return quad(...a);};
probe('drawCityFacades({x:0,y:0,w:200,h:200,cityStoreys:2,cityAccent:0},20,20);');
assert(quads.length>0);assert(quads.every(q=>q[0]<-80||q[1]<-80));ctx.quad=quad;
for(const {cx,cy,ch} of found.values()){
  ctx.__district=ch.solid;
  probe('activeBuildings=__district;buildings=__district;viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;');
  for(const hour of [8,13,23])for(const rain of [false,true])for(const side of [-1,1]){
    probe(`worldTimeMs=${hour}/24*DAY_MS;isRaining=${rain};camX=${cx*1200+600}+${side}*700;camY=${cy*1200+600}+${side}*700;updateSunVector();drawBuildings();drawBiomeProps();`);
  }
  const target=ch.solid.find(b=>b.cityArchitecture!==undefined);
  probe(`getBiomeState(1).destroyed[${JSON.stringify(target.chunkKey)}]=true;`);
  assert(!P(`generateChunkContent(1,${cx},${cy}).solid.some(b=>b.chunkKey===${JSON.stringify(target.chunkKey)})`));
}
console.log(`City districts passed: ${chunks} deterministic chunks, six plans / six architectures, clear footprints, destruction persistence and 72 lighting/view renders.`);

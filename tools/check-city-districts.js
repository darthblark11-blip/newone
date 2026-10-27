// Real generator invariants: distinct routes, collision geometry, persistence,
// authored story landmarks, and projection at opposite views in sun/night/rain.
const assert=require('assert');
const {createHash}=require('crypto');
const {ctx,mkG,probe}=require('./harness');
const P=s=>probe('('+s+')');
probe('currentLevel=1;currentBiome=1;BIOME_ACTIVE=true;authoredCore=null;authoredMask=null;authoredChunks=null;biomeState={};');
const found=new Map(),arches=new Set(),streetProps=new Set();let chunks=0,edgeFixture=null;
const industrial={parking:0,district:0,depot:0,freight:0};let parkingFixture=null;
const expectedNamespace=(cx,cy)=>P(`cityDowntownBlockPlan(${cx},${cy})`)!==null?'downtown:v1:':P(`cityDowntownJunction(${cx},${cy})&&bnoise(1,${cx}*4096+7717,${cy}*4096+3131,.31)>.62`)?'downtown-edge:v1:':'district:v3:';
const blockersOf=solids=>solids.filter(b=>!b.noClip&&!b.isGrassLot&&!b.isDeck&&!b.isWater);
function checkBlock(solids,cx,cy,label) {
  const bs=solids.filter(b=>b.cityArchitecture!==undefined),blockers=blockersOf(solids);
  const furniture=solids.filter(b=>b.cityPlan!==undefined&&b.cityArchitecture===undefined&&!b.isDeck);
  for(const a of furniture){
    streetProps.add(a.propType);
    if(a.propType==='CITYBIKERACK'){
      assert(Math.abs(cx)>4||Math.abs(cy)>4,`${label}: bike rack enters the starting enclosure`);
      assert(a.x-a.w/2>=cx*1200+195&&a.x+a.w/2<=cx*1200+1005&&a.y-a.h/2>=cy*1200+195&&a.y+a.h/2<=cy*1200+1005,`${label}: parked bicycle reaches road or pavement`);
      assert(Math.abs(a.x-cx*1200-600)>=100&&Math.abs(a.y-cy*1200-600)>=100,`${label}: parked bicycle obstructs a central walking strip`);
    }
    for(const b of blockers){if(a===b)continue;
      assert(!(Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.y-b.y)<(a.h+b.h)/2),`${label}: street furniture overlaps another solid`);
    }
  }
  for(const b of solids.filter(b=>b.cityPlan!==undefined))
    assert(b.x-b.w/2>=cx*1200+120&&b.x+b.w/2<=cx*1200+1080&&b.y-b.h/2>=cy*1200+120&&b.y+b.h/2<=cy*1200+1080,`${label}: district furniture enters the main road`);
  assert(bs.length,`${label}: no architecture`);
  if(bs.some(b=>b.cityPlan===13)){
    const orientation=P(`chunkHash(1,${cx},${cy},8175)>>>0`)&3;
    // Canonical painted playfield x420..780,y470..910. Check full collider
    // footprints after applying the address mirrors, including end hoops.
    for(const b of blockers){
      const x=(b.x-cx*1200-600)*(orientation&1?-1:1)+600;
      const y=(b.y-cy*1200-600)*(orientation&2?-1:1)+600;
      assert(!(x+b.w/2>420&&x-b.w/2<780&&y+b.h/2>470&&y-b.h/2<910),`${label}: obstacle ${b.propType||'building'} intrudes on the playing field`);
    }
    const hoops=furniture.filter(b=>b.propType==='CITYCOURTHOOP');
    assert.equal(hoops.length,2,`${label}: recreation court lost an end hoop`);
    assert(hoops.every(b=>b.w===18&&b.h===18),`${label}: hoop collision must stay on the actual footplate`);
  }
  for(const b of bs){
    assert(b.x-b.w/2>=cx*1200+165&&b.x+b.w/2<=cx*1200+1035,`${label}: building leaves usable block`);
    assert(b.y-b.h/2>=cy*1200+165&&b.y+b.h/2<=cy*1200+1035,`${label}: building leaves usable block`);
    const rise=P(`buildingRise(${JSON.stringify(b)})`);
    if(b.cityArchitecture===14)assert(rise>=52&&rise<=64&&b.cityStoreys===6,`${label}: business tower lacks its intended height`);
    else assert(rise<=42,`${label}: excessive building rise`);
    for(const other of blockers){if(b===other)continue;
      assert(!(Math.abs(b.x-other.x)<(b.w+other.w)/2&&Math.abs(b.y-other.y)<(b.h+other.h)/2),`${label}: architecture overlaps cover`);
    }
  }
  // The buildings must leave an interior crossing at player diameter 24.
  const midY=cy*1200+600;
  assert(Array.from({length:61},(_,i)=>midY-300+i*10).some(y=>
    bs.every(b=>Math.abs(y-b.y)>=b.h/2+12)),`${label}: buildings seal all cross routes`);
  // Trace actual ground collision too: furniture cannot close the only route.
  // A 20-unit grid is finer than a player diameter, and each node includes the
  // 12-unit actor margin. Search from west to east through the block interior.
  const n=44,step=20,ox=cx*1200+170,oy=cy*1200+170,clear=new Uint8Array(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const wx=ox+x*step,wy=oy+y*step;
    clear[y*n+x]=blockers.every(b=>Math.abs(wx-b.x)>=b.w/2+12||Math.abs(wy-b.y)>=b.h/2+12)?1:0;
  }
  const queue=[],seen=new Uint8Array(n*n);
  for(let y=0;y<n;y++)if(clear[y*n]){queue.push(y*n);seen[y*n]=1;}
  let reached=false;
  for(let at=0;at<queue.length;at++){
    const id=queue[at],x=id%n,y=(id/n)|0;
    if(x===n-1){reached=true;break;}
    for(const [dx,dy]of[[-1,0],[1,0],[0,-1],[0,1]]){
      const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=n||ny>=n)continue;
      const next=ny*n+nx;if(clear[next]&&!seen[next]){seen[next]=1;queue.push(next);}
    }
  }
  assert(reached,`${label}: furniture blocks the 24-unit pedestrian crossing`);
}
for(let cy=5;cy<25;cy++)for(let cx=-25;cx<25;cx++){
  const ch=P(`generateChunkContent(1,${cx},${cy})`);chunks++;
  assert.equal(JSON.stringify(ch),JSON.stringify(P(`generateChunkContent(1,${cx},${cy})`)));
  const bs=ch.solid.filter(b=>b.cityArchitecture!==undefined);
  if(ch.solid.some(b=>b.chunkKey.includes('downtown-edge:v1:')))edgeFixture={cx,cy,ch};
  // Validate industrial ground against the native generator, rather than two
  // helper functions which might agree with each other while buildings differ.
  const zone=P(`cityZoneAt(1,${cx*1200},${cy*1200})`);
  if(zone==='INDUSTRIAL'&&!P(`cityHasCanal(1,${cy})`)){
    const parking=ch.solid.find(b=>b.cityDistrictParking);
    if(parking||bs.length){
      const ground=P(`cityDistrictGroundPlan(${cx},${cy},'INDUSTRIAL')`);
      assert.equal(P(`cityIndustrialParking(${cx},${cy})`),!!parking,'industrial parking selector disagrees with native geometry');
      if(parking){
        industrial.parking++;parkingFixture={cx,cy,ch};
        assert(parking.isParkingLot&&parking.isGrassLot,'industrial parking lost its native lot footprint');
        assert.equal(bs.length,0,'parking and depot geometry occupy the same address');
        assert.equal(ground,null,'industrial parking receives workshop pedestrian paving');
      }else{
        industrial.district++;
        assert(bs.every(b=>b.cityPlan===ground),'industrial ground identity disagrees with its actual buildings');
        assert([4,5,9,12].includes(ground),'industrial building identity is outside the workshop/depot vocabulary');
        if(ground===9){industrial.depot++;assert(bs.some(b=>b.cityArchitecture===9),'native depot lacks depot architecture');}
        if(ground===12){industrial.freight++;assert(bs.some(b=>b.cityArchitecture===12),'native freight terminal lacks freight architecture');}
      }
      assert(ch.solid.every(b=>b.chunkKey.includes(expectedNamespace(cx,cy))),'industrial replacement left fixtures or parking under old destruction keys');
    }
  }
  if(!bs.length)continue;
  if(bs[0].cityPlan>=10)assert(!ch.solid.some(b=>b.propType==='WRECK'),'new exterior district contains legacy flat wreck scatter');
  found.set(bs[0].cityPlan,{cx,cy,ch});
  for(const b of bs){
    arches.add(b.cityArchitecture);
    assert(b.chunkKey.includes(expectedNamespace(cx,cy)),'district replacement keys must keep their own versioned namespace');
  }
  checkBlock(ch.solid,cx,cy,`streamed ${cx},${cy}`);
}
assert.deepEqual([...found.keys()].sort((a,b)=>a-b),[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],'all seventeen plans generate');
assert.deepEqual([...arches].sort((a,b)=>a-b),[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],'all sixteen roof families generate');
assert(industrial.parking>0&&industrial.district>0&&industrial.depot>0&&industrial.freight>0,'native sample must exercise industrial parking, workshops, depots and freight terminals');
// A previous district or numeric grid key must never erase a replacement prop
// or building. Conversely, destroying a current building must stay persistent.
assert(edgeFixture,'sample must exercise a renamed downtown-edge block');
for(const {cx,cy,ch}of [...found.values(),parkingFixture,edgeFixture]){
  const downtown=ch.solid.some(b=>b.chunkKey.includes('downtown:v1:')||b.chunkKey.includes('downtown-edge:v1:'));
  const oldKeys=ch.solid.flatMap(b=>{const i=b.chunkKey.slice(b.chunkKey.lastIndexOf(':')+1);return[`${cx},${cy},district:${i}`,`${cx},${cy},district:v2:${i}`,`${cx},${cy},${i}`,
    ...(downtown?[`${cx},${cy},district:v3:${i}`,`${cx},${cy},civic:${i}`]:[])];});
  probe(`for(const key of ${JSON.stringify(oldKeys)})getBiomeState(1).destroyed[key]=true;`);
  assert.equal(JSON.stringify(ch),JSON.stringify(P(`generateChunkContent(1,${cx},${cy})`)),'old destruction indices erased a replacement district');
  const target=ch.solid.find(b=>b.cityArchitecture!==undefined||b.cityDistrictParking)||ch.solid.find(b=>!b.isGrassLot&&!b.isDeck);
  probe(`getBiomeState(1).destroyed[${JSON.stringify(target.chunkKey)}]=true;`);
  const remaining=P(`generateChunkContent(1,${cx},${cy})`).solid;
  assert(!remaining.some(b=>b.chunkKey===target.chunkKey));
  assert.equal(remaining.length,ch.solid.length-1,'current destruction must remove only its intended solid');
}
// New expansion identities are strictly outside the gate enclosure, including
// the guard band on every side. Test both selection and native generated data.
for(let cy=-4;cy<=4;cy++)for(let cx=-4;cx<=4;cx++){
  assert(!P(`cityOuterExpansionAllowed(${cx},${cy})`),'expansion eligibility enters the protected gate zone');
  for(const zone of['RESIDENTIAL','COMMERCIAL','INDUSTRIAL'])
    assert(P(`cityBlockPlan(${cx},${cy},'${zone}')`)<10,'new block identity enters the protected gate zone');
  const protectedBlock=P(`generateChunkContent(1,${cx},${cy})`);
  assert(!protectedBlock.solid.some(b=>b.cityArchitecture>=10||b.cityPlan>=10||b.propType==='CITYBIKERACK'),'new architecture or bike parking enters the starting gate zone');
}
// The opening city keeps its previous district vocabulary, while its protagonist's
// house, entertainment landmarks, walls and gate approaches remain authored.
const reserved=new Map([['0,0',null],['0,-3','isCasino'],['-1,-3','isTheater'],['-2,-3','isArena'],['-3,-1','isAmusementPark'],['-3,0','isCircus']]);
const authoredPlans=new Set();
for(let cy=-3;cy<=3;cy++)for(let cx=-3;cx<=3;cx++){
  const key=`${cx},${cy}`,plan=P(`authoredCityBlockPlan(${cx},${cy})`);
  assert.equal(plan,P(`authoredCityBlockPlan(${cx},${cy})`),'authored address selection changes between calls');
  if(reserved.has(key)){assert.equal(plan,null,`authored landmark ${key} was replaced`);continue;}
  assert(Number.isInteger(plan)&&plan>=0&&plan<10,'authored plan outside city vocabulary');authoredPlans.add(plan);
  probe(`window.__authoredDistrict=[];buildCityDistrict(__authoredDistrict,${cx*1200},${cy*1200},'RESIDENTIAL',()=>false,${plan});`);
  const district=P('__authoredDistrict');
  probe(`window.__authoredAgain=[];buildCityDistrict(__authoredAgain,${cx*1200},${cy*1200},'RESIDENTIAL',()=>false,${plan});`);
  assert.equal(JSON.stringify(district),JSON.stringify(P('__authoredAgain')),'authored district geometry is not deterministic');
  checkBlock(district,cx,cy,`authored ${key}`);
}
assert.equal(authoredPlans.size,10,'opening city should contain every new block identity');
for(const prop of['CITYBIKERACK','CITYSTALL','CITYWAYFINDER','CITYCARGO','CITYCOURTHOOP'])assert(streetProps.has(prop),`${prop} never appears in generated or authored blocks`);
// Ground selection must ask the same address helper as its real buildings.
// Include reserved story blocks, whose original surface must remain untouched.
probe('authoredChunks=new Set();');
for(let cy=-3;cy<=3;cy++)for(let cx=-3;cx<=3;cx++){
  probe(`authoredChunks.add('${cx},${cy}');`);
  assert.equal(P(`cityDistrictGroundPlan(${cx},${cy},'PARK')`),P(`authoredCityBlockPlan(${cx},${cy})`),'authored paving uses a different block identity');
}
probe('authoredChunks=null;');
for(let cy=5;cy<15;cy++)for(let cx=-5;cx<5;cx++)for(const zone of['RESIDENTIAL','COMMERCIAL']){
  const plan=P(`cityDistrictGroundPlan(${cx},${cy},'${zone}')`);
  if(P(`cityHasCanal(1,${cy})`))assert.equal(plan,null,'district paving replaces a canal quay');
  else assert.equal(plan,P(`cityBlockPlan(${cx},${cy},'${zone}')`),'streamed paving disagrees with generated buildings');
}
// Exercise every mirror at a different address. Metadata must match the paths
// actually painted into terrain, and transform in lockstep with the buildings.
const mirrorSites=new Map();
for(let cy=-8;cy<=8&&mirrorSites.size<4;cy++)for(let cx=-8;cx<=8&&mirrorSites.size<4;cx++){
  const orientation=P(`chunkHash(1,${cx},${cy},8175)>>>0`)&3;
  mirrorSites.set(orientation,{cx,cy});
}
assert.equal(mirrorSites.size,4);
let groundBakes=0;
for(let plan=0;plan<17;plan++){
  let reference=null;
  for(const [orientation,{cx,cy}]of mirrorSites){
    const ox=cx*1200,oy=cy*1200,g=mkG(),rects=[];
    g.shovelPavedRects=[];
    for(const fn of['rect','ellipse','line']){
      const paint=g[fn];g[fn]=(...args)=>{assert(args.every(Number.isFinite),`non-finite baked ${fn}`);if(fn==='rect')rects.push(args);return paint(...args);};
    }
    ctx.__ground=g;probe(`bakeCityDistrictGround(__ground,${ox},${oy},${plan});`);groundBakes++;
    assert(g.shovelPavedRects.length>0,`plan ${plan} paints no registered route`);
    const normalized=[];
    for(const path of g.shovelPavedRects){
      assert(Object.values(path).every(Number.isFinite)&&path.w>0&&path.h>0,'non-finite or empty paving metadata');
      assert(rects.some(r=>r[0]+r[2]/2===path.x&&r[1]+r[3]/2===path.y&&r[2]===path.w&&r[3]===path.h),'paving collision metadata does not match its painted rectangle');
      normalized.push([(path.x-ox-600)*(orientation&1?-1:1),(path.y-oy-600)*(orientation&2?-1:1),path.w,path.h]);
    }
    const signature=JSON.stringify(normalized);
    if(reference===null)reference=signature;else assert.equal(signature,reference,`plan ${plan} paving fails mirrored address parity`);
    if(plan>=6){
      probe(`window.__pavedBuildings=[];buildCityDistrict(__pavedBuildings,${ox},${oy},'RESIDENTIAL',()=>false,${plan});`);
      for(const b of P('__pavedBuildings.filter(b=>b.cityArchitecture!==undefined)'))
        assert(!g.shovelPavedRects.some(p=>Math.abs(b.x-p.x)<p.w/2&&Math.abs(b.y-p.y)<p.h/2),`plan ${plan} registers a pedestrian route through a building centre`);
    }
  }
}

probe('isStoryMode=false;legacyGenerateMap();');
const authored=P('buildings');
const nativeDistricts=authored.filter(b=>b.cityArchitecture!==undefined);
assert(nativeDistricts.length>100,'ordinary opening blocks did not adopt district architecture');
// Frozen from commit 4f29331 before this outer-city expansion. Exclude furniture:
// the requested removal of bikes changes props, while all 235 building bodies,
// material identities and authored addresses must remain identical.
const coreSignature=nativeDistricts.map(({x,y,w,h,cityArchitecture,cityPlan,style,cityAccent,cityStoreys})=>[x,y,w,h,cityArchitecture,cityPlan,style,cityAccent,cityStoreys]);
assert.equal(createHash('sha256').update(JSON.stringify(coreSignature)).digest('hex'),'251c63fbd24e948966fa5843560c2a4e953af96334c89db8e3e944857976bc51','outer expansion changed the starting city architecture');
assert(!authored.some(b=>b.propType==='CITYBIKERACK'),'bike parking remains inside the authored enclosure');
const house=authored.find(b=>b.isHouse);
assert(house&&house.x===600&&house.y===600&&house.w===160&&house.h===100,'protagonist house footprint changed');
for(const [key,flag]of reserved){
  if(!flag)continue;const [cx,cy]=key.split(',').map(Number);
  assert(authored.some(b=>b[flag]&&b.x===cx*1200+600&&b.y===cy*1200+600),`${flag} landmark missing`);
}
for(const y of[-4200,5400])assert(authored.some(b=>b.isGovFortress&&b.x===600&&b.y===y&&b.w===9600&&b.h===800),'Great Gate footprint changed');
assert.equal(authored.filter(b=>b.isGiantBarrier).length,2,'curtain wall enclosure changed');
for(const b of nativeDistricts){
  const cx=Math.floor(b.x/1200),cy=Math.floor(b.y/1200);
  assert(b.x-b.w/2>=cx*1200+120&&b.x+b.w/2<=cx*1200+1080&&b.y-b.h/2>=cy*1200+120&&b.y+b.h/2<=cy*1200+1080,'authored replacement blocks main streets');
}
probe('legacyGenerateMap();');
assert.equal(JSON.stringify(nativeDistricts),JSON.stringify(P('buildings.filter(b=>b.cityArchitecture!==undefined)')),'regenerating the opening city changes its district footprints');
probe('isStoryMode=true;legacyGenerateMap();');
const story=P('buildings'),towers=story.filter(b=>b.isTower);
assert.equal(towers.length,2,'opening story lost its two transmission towers');
for(const tower of towers){
  assert([-3000,4200].includes(tower.x)&&[-3000,4200].includes(tower.y),'tower moved away from its story corner');
  assert(!story.some(b=>b!==tower&&b.cityArchitecture!==undefined&&Math.hypot(b.x-tower.x,b.y-tower.y)<250),'new architecture prevents the existing tower clearing');
  assert(!story.some(b=>b.cityArchitecture!==undefined&&Math.abs(b.x-tower.x)<(b.w+tower.w)/2&&Math.abs(b.y-tower.y)<(b.h+tower.h)/2),'new building footprint overlaps a story tower');
}
// Every primitive in the live projected art must stay finite. Check real
// drawBuildings/drawBiomeProps, rather than calling only roof helpers directly.
for(const fn of['rect','ellipse','line','quad','triangle']){
  const draw=ctx[fn];ctx[fn]=(...args)=>{assert(args.every(Number.isFinite),`non-finite ${fn} geometry`);return draw(...args);};
}
const quad=ctx.quad,quads=[];ctx.quad=(...a)=>{quads.push(a);return quad(...a);};
probe('drawCityFacades({x:0,y:0,w:200,h:200,cityStoreys:2,cityAccent:0},20,20);');
assert(quads.length>0);assert(quads.every(q=>q[0]<-80||q[1]<-80));ctx.quad=quad;
const painted=new Set(),drawArchitecture=ctx.drawCityArchitecture;
ctx.drawCityArchitecture=b=>{painted.add(b.cityArchitecture);return drawArchitecture(b);};
let renders=0;
for(const {cx,cy,ch}of found.values()){
  ctx.__district=ch.solid;
  probe('activeBuildings=__district;buildings=__district;viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;');
  for(const hour of[8,13,23])for(const rain of[false,true])for(const side of[-1,1]){
    probe(`worldTimeMs=${hour}/24*DAY_MS;isRaining=${rain};camX=${cx*1200+600}+${side}*700;camY=${cy*1200+600}+${side}*700;updateSunVector();drawBuildings();drawBiomeProps();`);renders++;
  }
}
assert.equal(painted.size,16,'native renderer did not paint every roof family');
console.log(`City districts passed: ${chunks} deterministic chunks, seventeen streamed plans / sixteen architectures, ${authoredPlans.size} authored identities, story landmarks, 24-unit routes, versioned destruction, ${groundBakes} mirrored ground bakes, ${industrial.parking} industrial lots / ${industrial.depot} depots / ${industrial.freight} freight terminals and ${renders} lighting/view renders.`);

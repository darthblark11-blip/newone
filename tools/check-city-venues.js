// Exterior venue contracts use native generation, collision and paint. Interiors
// remain a later feature; an entrance marker must still describe real open ground.
const assert=require('assert'),{createHash}=require('crypto');
const {ctx,probe,mkG}=require('./harness');const P=s=>probe('('+s+')');
probe(`currentLevel=currentBiome=1;BIOME_ACTIVE=true;isStoryMode=false;doTick=true;
  authoredCore=authoredChunks=authoredMask=null;biomeState={};
  buildings=[];activeBuildings=[];parkingCars=[];activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();`);
const expected=new Map();
for(const side of[-1,1]){
  for(let i=0;i<3;i++)expected.set(`${side<0?-6+i:3+i},5`,17+i);
  for(let cy=7;cy<=9;cy++)expected.set(`${side<0?-4:3},${cy}`,20+cy-7);
}
const kinds=['RESTAURANT','BAR','LOUNGE','TENNIS','GYM','BOXING'],sites=[],names=new Set(),coverage=new Map();
const canonical=(site,x,y)=>({x:site.cx*1200+600+(x-600)*site.mx,y:site.cy*1200+600+(y-600)*site.my});
const local=(site,x,y)=>({x:(x-site.cx*1200-600)*site.mx+600,y:(y-site.cy*1200-600)*site.my+600});
for(let cy=3;cy<=11;cy++)for(let cx=-7;cx<=6;cx++){
  const key=`${cx},${cy}`,plan=P(`cityLeisureBlockPlan(${cx},${cy})`);
  assert.equal(plan,expected.get(key)??null,'venue region changes an unassigned city address');
  if(plan===null)continue;
  assert(cx<-3||cx>2,'venue replaced a downtown block');
  const ch=P(`generateChunkContent(1,${cx},${cy})`);
  assert.equal(JSON.stringify(ch),JSON.stringify(P(`generateChunkContent(1,${cx},${cy})`)),'venue changes on regeneration');
  assert(ch.solid.every(b=>b.chunkKey.includes('leisure:v1:')),'changed venue retains old saved-destruction indices');
  const buildings=ch.solid.filter(b=>b.cityArchitecture!==undefined),primary=buildings.filter(b=>!b.cityVenueSecondary);
  assert.equal(primary.length,1,'venue has no unique main facade/entrance');const b=primary[0],kind=kinds[plan-17];
  assert(buildings.every(b=>b.cityArchitecture===plan-1&&b.cityVenue===kind&&b.cityPlan===plan),'venue identity differs between wings');
  assert(b.cityVenueName&&typeof b.cityVenueName==='string'&&b.cityVenueName.length>=5,'venue has no readable exterior identity');names.add(b.cityVenueName);
  assert(b.cityEntrance&&[1,-1].includes(b.cityFrontSign)&&b.cityEntrance.face===b.cityFrontSign,'entrance metadata lost its real facade orientation');
  assert(Math.abs(b.cityEntrance.x-b.x)<1e-9&&(b.cityEntrance.y-b.y)*b.cityFrontSign>b.h/2+14,'entrance lies inside a wall or lacks player clearance');
  assert(!P(`insideFortYard(1,${b.x},${b.y},${300+Math.max(b.w,b.h)/2})`),'venue intrudes into the relay fortress reservation');
  if(plan===22)assert(b.cityInterior==='BOXING_GYM'&&b.cityInteriorPending===true,'boxing exterior lost its deferred interior hook');
  const orientation=P(`chunkHash(1,${cx},${cy},8175)>>>0`),site={cx,cy,ch,plan,primary:b,mx:orientation&1?-1:1,my:orientation&2?-1:1};sites.push(site);
  coverage.set(plan,(coverage.get(plan)||0)+1);
}
assert.equal(sites.length,12);assert.equal(names.size,12,'east and west venues lack distinct names');
assert.deepEqual([...coverage].sort((a,b)=>a[0]-b[0]),kinds.map((_,i)=>[17+i,2]),'six venue identities do not occur on both flanks');
// Freeze the complete pre-venue downtown and the existing relay fortress bodies.
// This catches accidental land replacement, tree loss or shifted fort geometry.
const oldDowntown=[];
for(let cy=5;cy<=9;cy++)for(let cx=-3;cx<=2;cx++)if(P(`cityDowntownBlockPlan(${cx},${cy})`)!==null)
  oldDowntown.push([cx,cy,P(`generateChunkContent(1,${cx},${cy})`)]);
assert.equal(createHash('sha256').update(JSON.stringify(oldDowntown)).digest('hex'),'0ff1e534d413831b3ae1a547da13379c5829b7c44c8d363669a710c50a4f49b0','venue expansion changed the existing downtown blocks');
const fort=P('buildOutpostFortress(1)').map(b=>[b.x,b.y,b.w,b.h,b.propType||'',!!b.isGovFortress,!!b.isTower]);
assert.equal(createHash('sha256').update(JSON.stringify(fort)).digest('hex'),'0384f850bcd452732006db2f4955f31c99b94cad5e0c9c11eb9e66b5d4c7e0b5','venue expansion changed the relay fortress');
function load(site){ctx.__venueSolids=site.ch.solid;probe('buildings=__venueSolids;activeBuildings=__venueSolids;parkingCars=[];activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();');}
function walk(x,y){
  for(let i=0;i<400;i++){
    const pos=P('[player.x,player.y]'),dx=x-pos[0],dy=y-pos[1],d=Math.hypot(dx,dy);if(d<3)return;
    probe(`player.attemptMove(${dx/d*Math.min(4,d)},${dy/d*Math.min(4,d)});`);
  }
  assert(Math.hypot(P('player.x')-x,P('player.y')-y)<3,'native player cannot follow the exterior approach');
}
for(const fn of['rect','ellipse','line','quad','triangle','vertex','translate','rotate','scale']){
  const paint=ctx[fn];ctx[fn]=(...a)=>{assert(a.every(Number.isFinite),`non-finite native venue ${fn}`);return paint(...a);};
}
const transform=ctx.drawingContext.transform;
ctx.drawingContext.transform=(...a)=>{assert(a.every(Number.isFinite),'non-finite projected sign label');return transform(...a);};
let approaches=0,tennisRoutes=0,bakes=0,renders=0;
for(const site of sites){
  const {primary:b,plan}=site,entry=b.cityEntrance;load(site);
  assert(!P(`(new Character(${entry.x},${entry.y},true)).checkCol(${entry.x},${entry.y})`),'native entrance point is blocked');
  const start=plan===20?canonical(site,225,368):{x:entry.x,y:entry.y+entry.face*100};
  probe(`player=new Character(${start.x},${start.y},true);`);walk(entry.x,entry.y);approaches++;
  if(plan===17||plan===18)assert(site.ch.solid.filter(b=>b.propType==='CITYCAFETABLE').length>=4,'dining venue lacks its recessed seating');
  assert(site.ch.solid.some(b=>b.propType==='CITYVENUESIGN'),'venue has no upright exterior sign');
  if(plan===20){
    const net=site.ch.solid.filter(b=>b.propType==='CITYTENNISNET'),fences=site.ch.solid.filter(b=>b.propType==='CITYTENNISFENCE');
    assert.equal(net.length,1);assert(net[0].w===460&&net[0].h===8,'net collision disagrees with its real narrow footprint');
    assert.equal(fences.length,6,'tennis perimeter lacks its shared-corner fence runs');
    assert(fences.every(b=>b.w===580&&b.h===8||b.w===8&&b.h===240),'tennis fence footprints do not follow their drawn axes');
    const bounds=P(`cityTennisCourtBounds(${site.cx},${site.cy})`),center=canonical(site,600,710);
    assert(bounds.x===center.x&&bounds.y===center.y&&bounds.w===580&&bounds.h===600,'reserved court differs from the native net/fence layout');
    for(const b of[...net,...fences])assert(P(`player.checkCol(${b.x},${b.y})`),'visible court barrier has no native collision');
    for(const side of[-1,1]){
      const gate=canonical(site,600+side*290,710);assert(!P(`player.checkCol(${gate.x},${gate.y})`),'tennis side gate is blocked');
      const start=canonical(site,600+side*330,710);probe(`player=new Character(${start.x},${start.y},true);`);
      for(const [x,y]of[[600+side*260,710],[600+side*260,800],[600,800]]){const p=canonical(site,x,y);walk(p.x,p.y);}tennisRoutes++;
    }
    const blockedStart=canonical(site,600,660);probe(`player=new Character(${blockedStart.x},${blockedStart.y},true);`);
    for(let i=0;i<30;i++)probe(`player.attemptMove(0,${4*site.my});`);
    const stopped=local(site,P('player.x'),P('player.y'));assert(stopped.y<700,'native player walks straight through the tennis net');
  }
  const g=mkG(),rects=[],lines=[];g.shovelPavedRects=[];
  for(const fn of['rect','ellipse','line','quad','triangle','vertex']){
    const paint=g[fn];g[fn]=(...a)=>{assert(a.every(Number.isFinite),'non-finite venue terrain geometry');if(fn==='rect')rects.push(a);if(fn==='line')lines.push(a);return paint?paint(...a):undefined;};
  }
  ctx.__venueGround=g;probe(`bakeCityDistrictGround(__venueGround,${site.cx*1200},${site.cy*1200},${plan});`);bakes++;
  assert(g.shovelPavedRects.length>0,'venue has no actual paved public approach');
  if(plan===20){
    const paintedRect=(x,y,w,h)=>rects.some(r=>{const c=local(site,r[0]+r[2]/2,r[1]+r[3]/2);return Math.abs(c.x-x-w/2)<1e-9&&Math.abs(c.y-y-h/2)<1e-9&&r[2]===w&&r[3]===h;});
    const paintedLine=(x,y,x1,y1)=>lines.some(r=>{const a=local(site,r[0],r[1]),b=local(site,r[2],r[3]);return Math.abs(a.x-x)+Math.abs(a.y-y)+Math.abs(b.x-x1)+Math.abs(b.y-y1)<1e-8;});
    assert(paintedRect(390,470,420,480),'tennis doubles court lines do not match their intended surface');
    for(const y of[580,840])assert(paintedLine(440,y,760,y),'tennis service line crosses the doubles alleys or is missing');
    assert(paintedLine(600,580,600,840),'tennis center service divider is missing');
  }
  const old=site.ch.solid.map(b=>b.chunkKey.slice(b.chunkKey.lastIndexOf(':')+1)).flatMap(i=>['district:v3:','downtown-edge:v1:','civic:',''].map(prefix=>`${site.cx},${site.cy},${prefix}${i}`));
  probe(`for(const key of ${JSON.stringify(old)})getBiomeState(1).destroyed[key]=true;`);
  assert.equal(JSON.stringify(site.ch),JSON.stringify(P(`generateChunkContent(1,${site.cx},${site.cy})`)),'old district indices erase a replacement venue');
  const removable=site.ch.solid.find(b=>b.propType==='CITYVENUESIGN');probe(`getBiomeState(1).destroyed[${JSON.stringify(removable.chunkKey)}]=true;`);
  assert(!P(`generateChunkContent(1,${site.cx},${site.cy}).solid.some(b=>b.chunkKey===${JSON.stringify(removable.chunkKey)})`),'venue furniture destruction does not persist');
  load(site);probe(`viewLeft=${site.cx*1200-100};viewRight=${(site.cx+1)*1200+100};viewTop=${site.cy*1200-100};viewBottom=${(site.cy+1)*1200+100};`);
  for(const hour of[8,18,23])for(const rain of[false,true])for(const side of[-1,1]){
    probe(`worldTimeMs=${hour}/24*DAY_MS;isRaining=${rain};camX=${site.cx*1200+600}+${side}*650;camY=${site.cy*1200+600}+${side}*550;updateSunVector();drawBuildings();drawBiomeProps();`);renders++;
  }
}
// Public venue junctions own their four approaches, including neighbouring
// owners whose former checkpoint arms used to cross into the new block.
let publicJunctions=0,changedEdges=0;
for(let cy=4;cy<=10;cy++)for(let cx=-7;cx<=6;cx++){
  const touches=[[-1,-1],[-1,0],[0,-1],[0,0]].some(([dx,dy])=>expected.has(`${cx+dx},${cy+dy}`));
  assert.equal(P(`cityLeisureJunction(${cx},${cy})`),touches,'public venue junction ownership disagrees across chunks');
  if(!touches)continue;
  assert(!P(`cityIsCheckpoint(1,${cx},${cy})`),'venue approach still has a checkpoint');publicJunctions++;
  if(expected.has(`${cx},${cy}`)||P(`cityDowntownBlockPlan(${cx},${cy})`)!==null)continue;
  const newEdge=!P(`cityDowntownJunction(${cx},${cy})`)&&P(`bnoise(1,${cx}*4096+7717,${cy}*4096+3131,.31)>.62`);
  const ch=P(`generateChunkContent(1,${cx},${cy})`);
  assert(!ch.solid.some(b=>['CHECKPOINT','GUARDBOX','SANDBAG','BLASTWALL'].includes(b.propType)),'native checkpoint masses remain on a public venue approach');
  assert.equal(ch.solid.some(b=>b.chunkKey.includes('leisure-edge:v1:')),newEdge,'venue edge renames a previously unchanged checkpoint owner');
  if(newEdge)changedEdges++;
}
assert(changedEdges>0,'venue sample never exercises checkpoint-edge migration');
console.log(`City venues passed: ${sites.length} deterministic exteriors, six identities, ${approaches} native entrances, ${tennisRoutes} native net-end routes, ${bakes} surface bakes, ${renders} time/weather/views, ${publicJunctions} public junctions and ${changedEdges} migrated edges.`);

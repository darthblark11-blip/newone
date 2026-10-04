// Procedural civic ground must be the same in generation, traversal and lighting.
const { ctx, probe, mkG } = require('./harness');
const assert = require('assert');
const P = s => probe('('+s+')');
probe('currentLevel=1;currentBiome=1;BIOME_ACTIVE=true;authoredCore=null;authoredMask=null;authoredChunks=null;biomeState={};');
let site;
for(let cy=5;cy<40&&!site;cy++)for(let cx=-25;cx<25;cx++)
  if(P(`hasCivicTerrace(1,${cx},${cy})`)){site={cx,cy,x:cx*1200+600,y:cy*1200+600};break;}
assert(site,'terraces must occur in the generated city');
const {cx,cy,x,y}=site;
const ch=P(`generateChunkContent(1,${cx},${cy})`);
assert.equal(JSON.stringify(ch),JSON.stringify(P(`generateChunkContent(1,${cx},${cy})`)));
assert.equal(ch.solid.filter(b=>b.propType==='CIVICTERRACE').length,1);
assert.equal(ch.solid.filter(b=>b.propType==='ARCADESTALL').length,2);
assert.equal(ch.solid.filter(b=>b.propType==='CIVICPAVILION').length,1);
assert(ch.solid.filter(b=>b.isCivic).every(b=>b.chunkKey.includes('civic:')));
const solids=ch.solid.filter(b=>!b.isDeck&&!b.isGrassLot);
for(let i=0;i<solids.length;i++)for(let j=i+1;j<solids.length;j++) {
  const a=solids[i],b=solids[j];
  assert(!(Math.abs(a.x-b.x)<(a.w+b.w)/2&&Math.abs(a.y-b.y)<(a.h+b.h)/2),'intersecting civic solids');
}
const z=(dx,dy)=>P(`groundElev(${x+dx},${y+dy})`);
assert.equal(z(0,0),56); assert.equal(z(0,280),24); assert.equal(z(0,350),0);
assert.equal(z(410,0),0); assert.equal(z(0,600),0);
for(let d=0;d<600;d++) {
  assert(z(0,d)>=z(0,d+1),'stair profile must rise monotonically');
  assert(Math.abs(z(0,d)-z(0,d+1))<1.1,'no height pop on stairs');
  assert(Math.abs(z(d,0)-z(d+1,0))<1.1,'no height pop on side ramps');
  assert.equal(z(0,d),z(0,-d));
}
assert(P(`elevRenderScale(${x},${y})`)>1.14);
assert.equal(P(`elevRenderScale(${x},${y+600})`),1);
assert(P(`elevSpeedFactor(${x},${y+310},0,-1)`)<1);
assert(P(`elevSpeedFactor(${x},${y+310},0,1)`)>1);
// Every stair approach is genuinely walkable, not just painted on a wall.
for(const side of [-1,1])for(let d=183;d<=420;d+=12)
  for(const b of solids)assert(!(Math.abs(x-b.x)<b.w/2+12&&Math.abs(y+side*d-b.y)<b.h/2+12));
for(const side of [-1,1])for(let d=245;d<=420;d+=12)
  for(const b of solids)assert(!(Math.abs(x+side*d-b.x)<b.w/2+12&&Math.abs(y-b.y)<b.h/2+12));
// An old plaza's destroyed index must not delete its replacement walkable ground.
probe(`getBiomeState(1).destroyed["${cx},${cy},0"]=true;`);
assert(P(`generateChunkContent(1,${cx},${cy}).solid.some(b=>b.propType==='CIVICPAVILION')`));
// All new draw paths, including rain, dawn and night, with balanced p5 state.
ctx.__civicObjects=ch.solid;
probe('activeBuildings=__civicObjects; buildings=__civicObjects;viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;');
for(const hour of [8,13,18,23])for(const rain of [false,true]) {
  probe(`worldTimeMs=${hour}/24*DAY_MS;frameCount++;isRaining=${rain};updateSunVector();drawBiomeDecks();drawBiomeProps();`);
}
// Material buffer must retain the platform height instead of flattening it as a deck.
ctx.__height=mkG();
const painted=[];let material;
ctx.__height.fill=(...args)=>{material=args;};
ctx.__height.rect=(...args)=>painted.push({material,rect:args});
probe('GLRig.hgt=__height;GLRig.hw=600;glRigPaintHeight();');
assert(painted.some(p=>Math.abs(p.material[0]-56/P('GLRIG_HEIGHT_MAX')*255)<1e-9 && p.rect[2]===480),
       'the upper terrace must remain at 56 in the material buffer');
probe(`authoredChunks=new Set(["${cx},${cy}"]);`);
assert(!P(`hasCivicTerrace(1,${cx},${cy})`));assert.equal(z(0,0),0);
probe('authoredChunks=null;');
for(let b=2;b<=7;b++) {
  assert(!P(`hasCivicTerrace(${b},${cx},${cy})`));
  probe(`currentBiome=${b};currentLevel=${b};`);assert.equal(z(0,0),0);
}
console.log('Civic terrace checks passed: deterministic layout, collision, smooth elevation, slope speed, save keys, materials and 8 weather/time renders.');
console.log('Harness site: '+JSON.stringify(site));

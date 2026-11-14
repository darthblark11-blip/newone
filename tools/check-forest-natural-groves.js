// Independent cohorts soften the saved circular copses without moving their
// historical harvest roots, adding seam collisions, or growing unbounded work.
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { ctx, probe } = require('./harness');
const P = code => probe('(' + code + ')');
let checks = 0;
const ok = (label, value) => { assert(value, label); checks++; };
probe('authoredCore=authoredMask=authoredChunks=null;biomeState={};BIOME_ACTIVE=true;currentBiome=currentLevel=2;');
const chunks = new Map(), oldRoots = [], newRoots = [], groups = new Map();
function getChunk(cx, cy) {
  const key = cx + ',' + cy;
  if (!chunks.has(key)) chunks.set(key, P(`generateChunkContent(2,${cx},${cy})`));
  return chunks.get(key);
}
for (let cx=-5;cx<=5;cx++) for (let cy=-5;cy<=5;cy++) {
  const ch = getChunk(cx,cy), added = ch.solid.filter(s=>s.forestStandKey);
  ok('new cohorts retain a separate ten-stem chunk budget', added.length<=P('FOREST_STAND_MAX'));
  ok('every new harvest key is unique', new Set(ch.solid.map(s=>s.chunkKey)).size===ch.solid.length);
  ok('old copse and floor budgets stay intact', ch.solid.filter(s=>s.forestGroveKey).length<=14 &&
    ch.decor.filter(d=>d.forestSpecies==='BUSH').length<=12 && ch.decor.filter(d=>d.forestLiveProp).length<=20);
  for (const root of ch.solid.filter(s=>s.isTreeTrunk)) {
    if (!root.forestStandKey) oldRoots.push({key:root.chunkKey,x:root.x,y:root.y,w:root.w,h:root.h,
      girth:root.girth,species:root.forestSpecies,tier:root.forestTier});
    else {
      newRoots.push(root);
      if (!groups.has(root.forestStandKey)) groups.set(root.forestStandKey, []);
      groups.get(root.forestStandKey).push(root);
      const crown=ch.decor.find(d=>d.forestTrunkKey===root.chunkKey);
      ok('cohort wood and canopy share an exact saved root', crown && crown.x===root.x && crown.y===root.y && crown.s===root.girth);
      ok('new trees own a new namespace rather than moving a saved grove slot', root.chunkKey.includes(',forest:stand:') && !root.forestGroveKey);
      ok('ownership uses the root coordinate across chunk seams', root.x>=cx*1200 && root.x<(cx+1)*1200 && root.y>=cy*1200 && root.y<(cy+1)*1200);
      ctx.__standCrown=crown;
      ok('new crowns keep roads, water and approaches open', !P(`groundReserved(2,${cx},${cy},__standCrown.x,__standCrown.y,forestPropRadius(__standCrown)*2,forestPropRadius(__standCrown)*2,18)`));
    }
  }
}
oldRoots.sort((a,b)=>a.key.localeCompare(b.key));
const historicalHash=crypto.createHash('sha256').update(JSON.stringify(oldRoots)).digest('hex');
ok('all 1,783 historical roots retain exact keys, coordinates, scale and species', oldRoots.length===1783 &&
  historicalHash==='b55dc2e18597e07166144687bc3cbaf555c297cbff13cf5b55439371afba53c0');
ok('natural cohorts form a meaningful, bounded addition', newRoots.length>100 && newRoots.length<121*10);
ok('the expansion includes established trees and younger companions', newRoots.some(s=>s.forestTier==='canopy') && newRoots.some(s=>s.forestTier==='midstory'));
ok('the expansion retains regional tree variety', new Set(newRoots.map(s=>s.forestSpecies)).size>=4);
let seamRoots=0, nearRoots=0;
for (const root of newRoots) {
  const cx=Math.floor(root.x/1200),cy=Math.floor(root.y/1200);let nearest=Infinity;
  for (let nx=cx-1;nx<=cx+1;nx++) for(let ny=cy-1;ny<=cy+1;ny++) {
    for(const other of getChunk(nx,ny).solid) {
      if(other.chunkKey===root.chunkKey || other.isGrassLot&&!other.isPond)continue;
      ok('new trunks leave gaps beside published neighbouring roots, buildings and timber',
        Math.abs(root.x-other.x)>=(root.w+(other.w||0))*.5+28 ||
        Math.abs(root.y-other.y)>=(root.h+(other.h||0))*.5+28);
      if(other.isTreeTrunk)nearest=Math.min(nearest,Math.hypot(root.x-other.x,root.y-other.y));
    }
  }
  if(nearest<165)nearRoots++;
  if(root.x-cx*1200<180 || (cx+1)*1200-root.x<180 || root.y-cy*1200<180 || (cy+1)*1200-root.y<180)seamRoots++;
}
ok('most additions join existing crowns rather than becoming isolated scatter', nearRoots/newRoots.length>.72);
ok('the world plan reaches across texture boundaries', seamRoots>20);
let infill=0,fringe=0,mixedGroups=0;
for(const [key,roots]of groups) {
  const [gx,gy]=key.split(':').map(Number),grove=P(`woodlandGrovePlan(2,${gx},${gy})`);
  if(roots.some(s=>s.forestTier==='canopy')&&roots.some(s=>s.forestTier==='midstory'))mixedGroups++;
  for(const root of roots){
    const radius=Math.hypot(root.x-grove.x,root.y-grove.y)/grove.radius;
    if(radius<.70)infill++;if(radius>1.25)fringe++;
    ok('new formation reach stays inside its bounded seam neighbourhood', Math.hypot(root.x-grove.x,root.y-grove.y)<=P('FOREST_STAND_REACH'));
  }
}
ok('cohorts break both the hollow centre and the uniform outer ring', infill>20 && fringe>50);
ok('mixed-age groups survive real terrain and clearance filtering', mixedGroups>8);
const replay=[...chunks].filter(([key])=>{const [x,y]=key.split(',').map(Number);return Math.abs(x)<=2&&Math.abs(y)<=2;}).map(([key,ch])=>[key,JSON.stringify(ch)]);
probe('_forestStandBases.clear();_forestStandPlans.clear();');
for(const [key,expected]of replay.reverse())ok('reversing generation order cannot move or reshape a cohort', JSON.stringify(P(`generateChunkContent(2,${key})`))===expected);

// Remove neighbouring legacy wood, then force uncached regeneration. It must
// remain a reservation instead of freeing a new tree slot on the next visit.
const witness=newRoots[0],wx=Math.floor(witness.x/1200),wy=Math.floor(witness.y/1200);
const beforeKeys=getChunk(wx,wy).solid.filter(s=>s.forestStandKey).map(s=>s.chunkKey).sort();
const reserved=[];
for(let nx=wx-1;nx<=wx+1;nx++)for(let ny=wy-1;ny<=wy+1;ny++)for(const s of getChunk(nx,ny).solid)
  if(s.isTreeTrunk&&!s.forestStandKey || s.isForestTimber)reserved.push(s.chunkKey);
ctx.__standReserved=reserved;
probe('for(const key of __standReserved)getBiomeState(2).destroyed[key]=true;_forestStandBases.clear();');
ok('harvesting original roots and timber cannot plant new neighbouring trees',
  JSON.stringify(P(`generateChunkContent(2,${wx},${wy})`).solid.filter(s=>s.forestStandKey).map(s=>s.chunkKey).sort())===JSON.stringify(beforeKeys));
ctx.__standVictim=witness.chunkKey;
probe('getBiomeState(2).destroyed[__standVictim]=true;');
const destroyed=P(`generateChunkContent(2,${wx},${wy})`);
ok('harvesting a new cohort removes its exact root and crown', !destroyed.solid.some(s=>s.chunkKey===witness.chunkKey) && !destroyed.decor.some(d=>d.forestTrunkKey===witness.chunkKey));
ok('a felled cohort root never refills another budget slot', JSON.stringify(destroyed.solid.filter(s=>s.forestStandKey).map(s=>s.chunkKey).sort())===JSON.stringify(beforeKeys.filter(key=>key!==witness.chunkKey)));
ok('private reservation and plan caches stay bounded during streaming', P('_forestStandBases.size<=64&&_forestStandPlans.size<=192'));
probe('authoredCore={x0:-120,x1:120,y0:-120,y1:120};woodlandStandCacheContext();');
ok('changing an authored arena releases both reservation and plan caches', P('_forestStandBases.size===0&&_forestStandPlans.size===0'));
console.log(`${checks}/${checks} natural forest cohort checks passed: ${newRoots.length} new roots, ${infill} infill, ${fringe} irregular fringe, ${mixedGroups} mixed-age groups, ${oldRoots.length} saved roots unchanged.`);

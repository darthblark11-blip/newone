// Additional forts must use the same persistent encounter without sharing a record.
const { ctx, probe } = require('./harness');
const assert = require('assert');
const P = s => probe('(' + s + ')');
let seed = 418;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (Array.isArray(a)) return a[Math.floor(r*a.length)];
  return a === undefined ? r : b === undefined ? r*a : a + r*(b-a);
};
ctx.setTimeout = () => 0;
probe('window.outpostForts = {}; townsData = {}; isStoryMode = true;');
for (let b = 1; b <= 7; b++) {
  probe(`startAtLevel(${b}); started=true;`);
  const def = P(`outpostFortDef(${b})`);
  const core = P('authoredCore');
  assert(def, `sector ${b} missing fort`);
  if (core) assert(def.x+1600 < core.x0 || def.x-1600 > core.x1 ||
                   def.y+1500 < core.y0 || def.y-1500 > core.y1, `sector ${b} overlaps core`);
  assert.equal(P('buildings.filter(b=>b.isOutpostGate).length'), 2);
  assert.equal(P('buildings.filter(b=>b.isOutpost && b.isTower).length'), 2);
  const count = P('buildings.filter(b=>b.isOutpost).length');
  probe('chunkMgr.rebuildWorldArrays();');
  assert.equal(P('buildings.filter(b=>b.isOutpost).length'), count);
  const cx = Math.floor(def.x/1200), cy = Math.floor(def.y/1200);
  for (let x = cx-2; x <= cx+2; x++) for (let y = cy-2; y <= cy+2; y++) {
    const ch = P(`generateChunkContent(${b},${x},${y})`);
    for (const s of [...ch.solid, ...ch.decor, ...ch.decorBake])
      assert(!(Math.abs(s.x-def.x)<1500 && Math.abs(s.y-def.y)<1300), `sector ${b}: yard obstructed`);
  }
  probe(`enemiesList=[]; triggerOutpostAmbush(outpostFortDef(${b}));`);
  assert(P(`outpostFortState(${b}).musterOn`));
  assert.equal(P('nm0AmbushKills'), P('enemiesList.filter(e=>e.isAmbush).length + window.ambushSpawnsRemaining'));
  assert(P('buildings.filter(b=>b.isOutpostGate).every(b=>gateIsOpen(b))'));
  probe(`nm0AmbushActive=false; outpostFortState(${b}).musterOn=false;
         enemiesList=[]; player.x=outpostFortDef(${b}).x; player.y=outpostFortDef(${b}).y+250;
         doTick=true; frameCount=60; maintainOutpostGarrison();`);
  assert(P('enemiesList.some(e=>e.isOutpostGarrison)'), 'garrison must spawn in every sector');
  probe('for (const t of buildings) if(t.isOutpost && t.isTower)t.hp=0; checkOutpostCaptured();');
  assert(P(`outpostFortState(${b}).captured`));
  assert(P('enemiesList.filter(e=>e.isOutpostGarrison).every(e=>e.isFriendly)'));
  assert(P('inFortCutscene'), 'freed garrison should start the liberation beat');
  probe('finishFortCapture();');
  assert(P(`storyBeatDone("FORT_${b}")`));
  // Reconstruct the saved record, as a sector re-entry does.
  probe(`outpostFortState(${b}).towerHp[0]=123; window.outpostForts=JSON.parse(JSON.stringify(window.outpostForts));`);
  assert.equal(P(`buildOutpostFortress(${b}).find(b=>b.isTower && b.fortIdx===0).hp`), 123);
  if (b>1) assert.equal(P(`outpostFortState(${b-1}).towerHp[0]`),123);
  console.log(`sector ${b}: anchors, clear yard, breach, muster budget, independent persistence OK`);
}
probe('authoredCore=null; authoredMask=null; authoredChunks=null; biomeState={};');
const seen = new Set();
for (let b=2;b<=7;b++) {
  let n=0;
  for (let i=0;i<300;i++) {
    const x=i%25-12, y=Math.floor(i/25)+10;
    const ch=P(`generateChunkContent(${b},${x},${y})`);
    const parts=ch.solid.filter(s=>s.fieldSite);
    if (!parts.length) continue;
    n++;
    assert.equal(parts.length,3,'a field site must remain a complete group');
    for (const s of parts) seen.add(s.fieldSite);
    const again=P(`generateChunkContent(${b},${x},${y})`);
    assert.equal(JSON.stringify(ch),JSON.stringify(again),'field site is deterministic');
    for (const s of parts) {
      assert(!P(`groundReserved(${b},${x},${y},${s.x},${s.y},${s.w},${s.h},0)`));
      for (const o of ch.solid) if (o!==s)
        assert(!(Math.abs(s.x-o.x)<(s.w+o.w)/2 && Math.abs(s.y-o.y)<(s.h+o.h)/2),'site intersects a solid');
    }
  }
  assert(n>0,`sector ${b} never emits a field site`);
  console.log(`sector ${b}: ${n} deterministic field sites in 300 chunks`);
}
console.log('Field-site regions: '+[...seen].sort().join(', '));
console.log('Biome expansion checks passed');

// A real generated forest tree must stay gone when an adjacent chunk republishes
// the world and when its own chunk is evicted and regenerated. Both original
// numeric save identities and appended forest identities follow this contract.
// GAME_JS may select a baseline source; FOREST_TREE_KINDS=legacy diagnoses it
// without requiring the newer appended fixtures. The default requires both.
const { ctx, probe } = require('./harness.js');
const P = (src) => probe('(' + src + ')');
let checks = 0, fails = 0;
function ok(name, condition, detail) {
  checks++;
  if (!condition) fails++;
  console.log((condition ? 'ok   ' : 'FAIL ') + name + (detail ? ' ' + detail : ''));
}
let seed = 79231;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const n = seed / 4294967296;
  if (a === undefined) return n;
  if (Array.isArray(a)) return a[(n * a.length) | 0];
  return b === undefined ? n * a : a + n * (b - a);
};

const kinds = (process.env.FOREST_TREE_KINDS || 'legacy,appended').split(',');
if (!kinds.length || kinds.some(k => k !== 'legacy' && k !== 'appended')) {
  throw new Error('FOREST_TREE_KINDS must contain legacy and/or appended');
}

function stage(kind) {
  ctx.__fixtureKind = kind;
  probe(`authoredCore=null; authoredMask=null; authoredChunks=null;
    authoredSolids=[]; authoredCars=[]; biomeState={};
    currentLevel=2; currentBiome=2; BIOME_ACTIVE=true;
    buildings=[]; parkingCars=[]; activeBuildings=[]; activeParkingCars=[];
    barrels=[]; particles=[]; playerStructures=[]; buildSites=[];
    resourceDrops=[]; window.resources={WOOD:0,METAL:0,STONE:0};
    frameCount=100; lastActiveUpdate=0;
    viewLeft=4800; viewRight=9600; viewTop=4800; viewBottom=9600;
    chunkMgr=new ChunkManager(2); chunkMgr.anchors=[];
    for(let cx=4;cx<=7;cx++) for(let cy=4;cy<=7;cy++) chunkMgr.adopt(cx,cy);
    chunkMgr.rebuildWorldArrays(); chunkMgr.dirty=false;
    window.__walker={eType:'NORMAL', ignoreBldgTimer:0, isCityCivilian:false};
    window.__tree=null; window.__ch=null;
    (function(){
      const all=activeBuildings;
      for(const ch of chunkMgr.chunks.values()) {
        for(const b of ch.solid) {
          const appended = b.chunkKey && b.chunkKey.includes(',forest:tree:');
          if(!b.isTreeTrunk || (window.__fixtureKind==='appended' ? !appended : appended) ||
            !ch.decor.some(d => ['TREE','PINE','SNAG'].includes(d.t) &&
              (d.forestTrunkKey ? d.forestTrunkKey===b.chunkKey :
                Math.abs(d.x-b.x)<6 && Math.abs(d.y-b.y)<6))) continue;
          // Avoid a false failure caused by a second legitimate solid at the probe.
          activeBuildings=all.filter(s => s!==b); invalidateColIndex();
          const blocked=Character.prototype.checkCol.call(window.__walker,b.x,b.y);
          activeBuildings=all; buildColIndex();
          if(!blocked) {window.__tree=b;window.__ch=ch;return;}
        }
      }
    })();
    if(!window.__tree) throw new Error('Required '+window.__fixtureKind+
      ' generated tree fixture missing (expected appended namespace: ,forest:tree:)');
    window.__worth=harvestProfile(window.__tree).yield;
    window.__work=harvestProfile(window.__tree).maxHp;
    window.__key=window.__tree.chunkKey;
    window.__chunk=ChunkManager.keyOf(window.__ch.cx,window.__ch.cy);
    window.__cx=window.__ch.cx; window.__cy=window.__ch.cy;`);
  return P(`({key:window.__key,chunk:window.__chunk,x:window.__tree.x,y:window.__tree.y,
    worth:window.__worth,generatedSolids:buildings.length})`);
}

function snapshot() {
  return P(`(function(){
    const b=window.__tree, ch=chunkMgr.chunks.get(window.__chunk);
    return {
      live:buildings.some(s=>s.chunkKey===window.__key),
      resident:!!ch && ch.solid.some(s=>s.chunkKey===window.__key),
      active:activeBuildings.some(s=>s.chunkKey===window.__key),
      blocked:Character.prototype.checkCol.call(window.__walker,b.x,b.y),
      crowns:ch ? ch.decor.filter(d=>['TREE','PINE','SNAG'].includes(d.t) &&
        (d.forestTrunkKey ? d.forestTrunkKey===b.chunkKey :
          Math.abs(d.x-b.x)<6 && Math.abs(d.y-b.y)<6)).length : 0,
      remembered:getBiomeState(2).destroyed[window.__key]===true,
      drops:resourceDrops.reduce((n,d)=>n+d.qty,0),
      bank:resourceCount('WOOD')
    };
  })()`);
}

function absent(label, expectedDrops, expectedBank) {
  const s=snapshot();
  console.log(label+' state '+JSON.stringify(s));
  ok(label+' trunk absent from published solids',!s.live&&!s.active);
  ok(label+' trunk absent from resident solids',!s.resident);
  ok(label+' trunk no longer blocks movement',!s.blocked);
  ok(label+' crown absent',s.crowns===0);
  ok(label+' destroyed key remembered',s.remembered);
  ok(label+' credited exactly one yield',s.drops===expectedDrops&&s.bank===expectedBank,
    'drops='+s.drops+', bank='+s.bank);
}

function regenerate() {
  probe(`chunkMgr.chunks.delete(window.__chunk);
    chunkMgr.adopt(window.__cx,window.__cy);
    chunkMgr.rebuildWorldArrays(); chunkMgr.dirty=false;`);
}

console.log('forest lifecycle fixtures: '+kinds.join(', '));
for (const kind of kinds) {
  console.log(kind+' harvest fixture '+JSON.stringify(stage(kind)));
  ok(kind+' generated trunk initially collides and has one crown',snapshot().blocked&&snapshot().crowns===1);
  probe(`window.__swings=0;
    while(harvestProfile(window.__tree).hp>0 && window.__swings<20) {
      damageHarvestable(window.__tree,HARVEST_SWING.PICKAXE); window.__swings++;
    }`);
  ok(kind+' pickaxe takes the expected number of swings',
    P('window.__swings===Math.ceil(window.__work/HARVEST_SWING.PICKAXE)'));
  const worth=P('window.__worth');
  absent(kind+' harvest immediate',worth,0);
  probe('chunkMgr.rebuildWorldArrays(); chunkMgr.dirty=false;');
  absent(kind+' harvest rebuild',worth,0);
  regenerate();
  absent(kind+' harvest regenerate',worth,0);
  probe('damageHarvestable(window.__tree,1);');
  ok(kind+' stale felled-tree reference does not duplicate yield',snapshot().drops===worth,
    'drops='+snapshot().drops+', expected='+worth);

  console.log(kind+' build-lot fixture '+JSON.stringify(stage(kind)));
  probe('window.__won=clearBuildLot(window.__tree.x,window.__tree.y,0,0);');
  const lotWorth=P('window.__worth');
  ok(kind+' clearing the generated tree returns its wood yield',P('window.__won.WOOD')===lotWorth);
  absent(kind+' lot immediate',0,lotWorth);
  probe('chunkMgr.rebuildWorldArrays(); chunkMgr.dirty=false;');
  absent(kind+' lot rebuild',0,lotWorth);
  probe('clearBuildLot(window.__tree.x,window.__tree.y,0,0);');
  ok(kind+' clearing the same lot after a rebuild cannot credit wood twice',snapshot().bank===lotWorth,
    'bank='+snapshot().bank+', expected='+lotWorth);
  regenerate();
  absent(kind+' lot regenerate',0,lotWorth);
  probe('clearBuildLot(window.__tree.x,window.__tree.y,0,0);');
  ok(kind+' clearing the same lot after reload cannot credit wood twice',snapshot().bank===lotWorth,
    'bank='+snapshot().bank+', expected='+lotWorth);
  probe('damageHarvestable(window.__tree,harvestProfile(window.__tree).maxHp);');
  ok(kind+' stale cleared-tree reference cannot also drop its banked wood',
    snapshot().drops===0 && snapshot().bank===lotWorth,
    'drops='+snapshot().drops+', bank='+snapshot().bank+', expected bank='+lotWorth);
}
console.log((checks-fails)+'/'+checks+' checks passed');
process.exit(fails ? 1 : 0);

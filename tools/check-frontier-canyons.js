// Exercise real canyon terrain, level generation and Character movement.
// The ground painter is stubbed; collision, height, chunk identity and saves
// remain the game's own code. Browser review covers the filled rock faces.
const assert = require('assert');
const {ctx, probe, mkG, calls} = require('./harness');
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const run = code => probe(code);
run(`isStoryMode=false;townsData={};startAtLevel(3);
  activeBuildings=[];activeParkingCars=[];colGrid=null;
  inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=false;
  started=true;isPaused=isDead=isWin=false;`);
check(run('hasAuthoredCore(3) && authoredCore && authoredSolids.length>80'), 'Dry Gulch remains authored in arcade and settled play');
check(run('frontierCanyonHeight(1300,-1730)===0 && frontierCanyonHeight(-600,-400)===0'), 'The town and original farmland keep their ground');
check(run('frontierCanyonHeight(outpostFortDef(3).x,outpostFortDef(3).y)===0'), 'Directive fortress foundations remain intact');
check(run(`groundElev(frontierCanyonCenter('Y',0,0),0)<-100`), 'Eastern gulch lowers the shared world-height field');
check(run(`elevRenderScale(frontierCanyonCenter('Y',0,0),0)<elevRenderScale(6600,0)`), 'Characters visibly read deeper on the floor');

// Several consecutive chunk seams and both axes share one contour. Continuity
// is evaluated on the actual height field, not on unrelated noise snapshots.
for (const axis of ['X','Y']) {
  for (const u of [-4800,-2400,0,1200,2400,4800]) {
    const center=run(`frontierCanyonCenter('${axis}',${u},0)`);
    const x=axis==='Y'?center:u, y=axis==='Y'?u:center;
    const epsilon=.00001;
    const h0=run(`frontierCanyonHeight(${x},${y})`);
    const h1=run(`frontierCanyonHeight(${x+(axis==='X'?epsilon:0)},${y+(axis==='Y'?epsilon:0)})`);
    check(Math.abs(h1-h0)<.0001, axis+' contour height stays continuous at '+u);
  }
}

run(`var canyonProfile=frontierCanyonProfile('Y',0,0);
  player.x=canyonProfile.center+canyonProfile.outerHalf+70;player.y=0;
  var canyonBlocked=false;for(let i=0;i<240;i++){
    const m=player.attemptMove(-5,0);if(Math.abs(m.x)<.001){canyonBlocked=true;break;}
  }`);
check(run('canyonBlocked && player.x>canyonProfile.center+canyonProfile.floorHalf'), 'Native walking cannot scale a sheer canyon bank');
check(run(`!frontierCanyonSpawnSafe(canyonProfile.center+canyonProfile.floorHalf+111,0)`), 'Native population cannot spawn stranded on a rock face');
check(run(`frontierCanyonSpawnSafe(canyonProfile.center,0)`), 'The deep canyon floor remains a valid combat spawn');
check(run(`(()=>{const p=frontierCanyonProfile('Y',-600,0);return frontierCanyonSpawnSafe(p.center+p.floorHalf+111,-600);})()`), 'The broad ramp accepts characters at its sloping bank');
check(run(`frontierCanyonSpawnSafe(frontierCanyonCenter('Y',600,0),600)`), 'A timber bridge supports a normal character spawn');
check(run(`popPlace(()=>.5,[],canyonProfile.center+canyonProfile.floorHalf+111,canyonProfile.center+canyonProfile.floorHalf+111,0,0,3)===null`),
  'Native settlement placement rejects a fixed cliff candidate');
check(run(`popPlace(()=>.5,[],canyonProfile.center,canyonProfile.center,0,0,3)!==null`),
  'Native settlement placement accepts a fixed deep-floor candidate');
check(run(`(()=>{const x=canyonProfile.center+canyonProfile.floorHalf+111;
  const point=hostileSpawnPoint(x,0,3);
  return Math.hypot(point.x-x,point.y)>1 && frontierCanyonSpawnSafe(point.x,point.y) && !player.checkCol(point.x,point.y);})()`),
  'Native reinforcement placement relocates a cliff candidate onto safe walkable ground');

function cross(u, name) {
  run(`var crossProfile=frontierCanyonProfile('Y',${u},0);
    player.x=crossProfile.center-crossProfile.outerHalf-65;player.y=${u};
    var crossStart=player.x, crossDistance=crossProfile.outerHalf*2+130;
    var crossTicks=0;for(;crossTicks<1200 && player.x<crossStart+crossDistance-3;crossTicks++)player.attemptMove(5,0);`);
  check(run('player.x>=crossStart+crossDistance-3'), 'Native player crosses the entire '+name+' without teleporting');
}
cross(-600, 'switchback ramp');
cross(600, 'timber bridge');
check(run(`frontierCanyonHeight(frontierCanyonCenter('Y',600,0),600)===0`), 'Bridge walking is at the same height as both rims');
check(run(`frontierCanyonHeight(frontierCanyonCenter('Y',0,0),0)<-100`), 'Away from a crossing the floor remains genuinely lower');
check(run(`frontierCanyonProfile('Y',-600+70,0).ramp===1`), 'Ramp has a broad fully walkable core for directional movement');

// Every camp courtyard remains one floor. A bridge crossing a camp would
// place its gate on an inaccessible different level, the initial route bug.
check(run(`frontierBountySites().every(site=>{
  const a=frontierCanyonSample('X',site.x,site.y,Math.round((site.y-3550)/7200));
  const b=frontierCanyonSample('Y',site.x,site.y,Math.round((site.x-5200)/9200));
  return (a.distance>=a.outerHalf || a.bridge===0) && (b.distance>=b.outerHalf || b.bridge===0);
})`), 'No elevated deck bisects any bounty courtyard');
check(run(`frontierCanyonReserved(frontierCanyonCenter('Y',0,0)+900,0,900,300,0)`), 'A footprint intersecting a scarp is reserved even with its centre outside');

const before=run(`JSON.stringify(generateChunkContent(3,4,0))`);
run('generateChunkContent(3,-8,6);generateChunkContent(3,9,-4);');
check(before===run(`JSON.stringify(generateChunkContent(3,4,0))`), 'Canyon chunk generation is independent of residency order');
check(run(`(()=>{const c=generateChunkContent(3,4,0);
 return [c.solid,c.decor,c.decorBake,c.cars].every(list=>list.every(p=>!frontierCanyonReserved(p.x,p.y,p.w||45,p.h||45,20)));})()`),
 'Procedural stores, cactus and litter cannot stand on the canyon floor or cliff');

// Baked faces survive return visits bit-for-bit and leave the sun untouched.
ctx.canyonG=mkG();
calls.sig=0;calls.fill=0;
run('bakeFrontierCanyons(canyonG,3,4800,0);');
const artHash=calls.sig, fills=calls.fill;
calls.sig=0;
run('bakeFrontierCanyons(canyonG,3,4800,0);');
check(artHash===calls.sig && fills>300, 'Filled sandstone faces, floor and bridge bake deterministically');
calls.sig=0;calls.fill=0;
run('bakeFrontierCanyons(canyonG,2,4800,0);');
check(calls.fill===0 && calls.sig===0, 'Other biomes receive no canyon paint');
run('BIOME_ACTIVE=false;');
check(run(`groundElev(frontierCanyonCenter('Y',0,0),0)===0`), 'Interior and non-biome scenes retain their ground-height field');
console.log('Frontier canyons: '+checks+' checks passed.');

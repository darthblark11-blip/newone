// Checkpoint intake is independent of the finite, recruitable gate roster.
// These fixtures use real generated solids and retain pre-change spawn points.
const { ctx, probe } = require('./harness');
const P = s => probe(s);
// Authored population placement needs distinct samples, unlike the constant
// default used by the pure chunk-generation harness.
let seed = 20260822;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  return b === undefined ? r * a : a + r * (b - a);
};
let checks = 0, failures = 0;
const ok = (name, passed) => {
  checks++;
  if (!passed) { failures++; console.error('FAIL ' + name); }
};
const sites = [
  { biome: 1, cx: 9, cy: -4, positions: [
    [10882.537989513949, -4563.682116214186],
    [10596.388289369643, -4559.205564968288],
    [10854.283046619967, -4543.629818931222],
    [10745.374031411484, -4744.887962341309]
  ] },
  { biome: 2, cx: -29, cy: -30, positions: [
    [-34806.716642705724, -35918.20480750874],
    [-34652.561747608706, -36246.163789974526],
    [-34954.07120557502, -36249.61705236696]
  ] }
];
for (const site of sites) {
  const {biome, cx, cy, positions} = site;
  const rookie = biome === 2 ? 'NM0_ROOKIE_F' : 'NM0_ROOKIE';
  const label = 'Level ' + biome + ': ';
  P(`isStoryMode=true;resetStoryProgress();townsData={};biomeState={};startAtLevel(${biome});
    var postSolids=generateChunkContent(${biome},${cx},${cy}).solid;
    var beforePost=settlementRoster(${biome},${cx},${cy},postSolids);`);
  ok(label + 'fixture is a real overworld checkpoint', P(`cityIsCheckpoint(${biome},${cx},${cy})&&!chunkInAuthoredCore(${cx},${cy})`));
  const before = P('beforePost');
  ok(label + 'rookies man the post while city towers still stand', before && before.length > 0 && before.every(r => r.type === rookie));
  ok(label + 'retains the existing deterministic resident positions', before.length === positions.length && before.every((r, i) => Math.hypot(r.x - positions[i][0], r.y - positions[i][1]) < 1e-6));
  ok(label + 'intake stays leashed to its post', before.every(r => !r.route && r.post && r.post.x === cx * 1200 && r.post.y === cy * 1200));
  P(`markSectorTowersDown(${biome});window.towersDefeated=true;`);
  ok(label + 'tower collapse cannot replace or relocate the intake', P(`JSON.stringify(beforePost)===JSON.stringify(settlementRoster(${biome},${cx},${cy},postSolids))`));
  P(`sectorLedger(${biome}).established=true;`);
  ok(label + 'city establishment cannot change the checkpoint roster', P(`JSON.stringify(beforePost)===JSON.stringify(settlementRoster(${biome},${cx},${cy},postSolids))`));
  P('isStoryMode=false;townsData={};window.towersDefeated=false;');
  ok(label + 'arcade checkpoints use the same independent intake', P(`JSON.stringify(beforePost)===JSON.stringify(settlementRoster(${biome},${cx},${cy},postSolids))`));

  // Drive the same population streamer used while walking the overworld.
  P(`isStoryMode=true;townsData={};enemiesList=[];resetPopulation();
    player.x=${cx * 1200 + 400};player.y=${cy * 1200 + 400};
    var postKey='${cx},${cy}',postMgr={biome:${biome},chunks:new Map([[postKey,{solid:postSolids}]])};
    for(let i=0;i<4;i++)refreshPopulation(postMgr,${cx},${cy});`);
  ok(label + 'streaming activates the whole real checkpoint roster', P(`enemiesList.length===beforePost.length&&enemiesList.every(e=>e.eType==='${rookie}')`));
  ok(label + 'intake is hostile and cannot enter the original city population', P('enemiesList.every(e=>!e.isFriendly&&!e.isPopulation&&!e.isMilitary&&!e.isRecruit&&!e.isAmbush)'));
  ok(label + 'streamed guards retain the post leash', P(`enemiesList.every(e=>e.postX===${cx * 1200}&&e.postY===${cy * 1200}&&e.postR===300&&!e.routeA&&!e.routeB)`));
  P(`var ledgerBefore=JSON.stringify(sectorLedger(${biome}));markSectorTowersDown(${biome});
    var conversion=recruitSectorSurvivors();`);
  ok(label + 'freeing conscripts never converts a checkpoint rookie', P('conversion.converted===0&&enemiesList.every(e=>!e.isFriendly&&!e.isRecruit)'));
  ok(label + 'checkpoint intake cannot enlarge the recruit award', P('conversion.total===0&&poolLedger().popTotal===0'));
  P('var victim=enemiesList[0];victim.hp=0;victim.dead=true;popRelease(postKey,chunkPop.get(postKey));');
  ok(label + 'a dead rookie is recorded as a checkpoint loss', P('popLosses.get(postKey)===1&&enemiesList.length===0'));
  P(`for(let i=0;i<4;i++)refreshPopulation(postMgr,${cx},${cy});`);
  ok(label + 'revisiting after tower collapse preserves losses without restoring conscripts', P(`enemiesList.length===beforePost.length-1&&enemiesList.every(e=>e.eType==='${rookie}'&&!e.isPopulation&&!e.isFriendly)`));
  ok(label + 'repeated streaming cannot duplicate the active intake', P(`(()=>{const n=enemiesList.length;for(let i=0;i<8;i++)refreshPopulation(postMgr,${cx},${cy});return enemiesList.length===n;})()`));
}
// Fortresses keep their separate finite garrison and capture reward, but city
// forts must not introduce another supply of the original gated conscripts.
for (const biome of [1, 2, 4]) {
  const type = biome === 1 ? 'NM0_ROOKIE' : biome === 2 ? 'NM0_ROOKIE_F' : 'NORMAL';
  const label = 'Level ' + biome + ' fortress: ';
  P(`isStoryMode=true;resetStoryProgress();townsData={};biomeState={};window.outpostForts={};
    startAtLevel(${biome});doTick=true;frameCount=30;var postFort=outpostFortDef(${biome});
    player.x=postFort.x;player.y=postFort.y+300;maintainOutpostGarrison();`);
  ok(label + 'retains its separate finite fifty-person garrison', P('enemiesList.filter(e=>e.isOutpostGarrison).length===50&&outpostFortState(currentBiome).garrison===50'));
  ok(label + 'uses only its own sector-specific overworld type', P(`enemiesList.filter(e=>e.isOutpostGarrison).every(e=>e.eType==='${type}'&&!e.isPopulation&&!e.isFriendly)`));
  if (biome < 3) {
    P(`markSectorTowersDown(${biome});recruitSectorSurvivors();`);
    ok(label + 'city towers cannot recruit the fort intake', P('enemiesList.filter(e=>e.isOutpostGarrison).every(e=>!e.isFriendly&&!e.isRecruit)'));
    ok(label + 'the original city roster remains finite and separate', P('enemiesList.filter(e=>e.isPopulation).length===80'));
  }
  P(`var shot=0;for(const e of enemiesList)if(e.isOutpostGarrison&&shot<3){
    e.hp=0;e.dead=true;processKill(e.x,e.y,false,e.eType,false,e);shot++;}
    enemiesList=enemiesList.filter(e=>!e.isOutpostGarrison);maintainOutpostGarrison();`);
  ok(label + 'dead guards stay lost when the fort is streamed again', P('outpostFortState(currentBiome).garrison===47&&enemiesList.filter(e=>e.isOutpostGarrison).length===47'));
  P(`var armyBefore=poolLedger().popTotal,armyM=poolLedger().popUnassignedM,armyF=poolLedger().popUnassignedF;
    for(const b of buildings)if(b.isOutpost&&b.isTower)b.hp=0;checkOutpostCaptured();`);
  ok(label + 'its own masts still recruit the surviving forty-seven', P('outpostFortState(currentBiome).captured&&outpostFortState(currentBiome).garrison===0&&enemiesList.filter(e=>e.isOutpostGarrison&&e.isFriendly&&e.isRecruit).length===47'));
  ok(label + 'capture preserves the independent army reward', P('poolLedger().popTotal===armyBefore+47'));
  ok(label + 'capture awards the correct male/female population', P(biome === 2 ? 'poolLedger().popUnassignedF===armyF+47&&poolLedger().popUnassignedM===armyM' : 'poolLedger().popUnassignedM===armyM+47&&poolLedger().popUnassignedF===armyF'));
  P('checkOutpostCaptured();maintainOutpostGarrison();');
  ok(label + 'capture cannot pay twice or restore a hostile garrison', P('poolLedger().popTotal===armyBefore+47&&!enemiesList.some(e=>e.isOutpostGarrison&&!e.isFriendly)'));
}
console.log(`Checkpoint rookies: ${checks} checks, ${failures} failures.`);
process.exitCode = failures ? 1 : 0;

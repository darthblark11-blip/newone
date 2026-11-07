// Native geometry/projection/persistence checks for the frontier overhaul.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness.js');
const P=s=>probe('('+s+')');let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
probe(`currentLevel=currentBiome=3;BIOME_ACTIVE=true;isStoryMode=false;
 legacyGenerateMap();activeBuildings=buildings;invalidateColIndex();
 player=new Character(1300,0,true);seedWorldClock();
 viewLeft=-15000;viewRight=15000;viewTop=-15000;viewBottom=15000;`);
ok('all 69 named town premises have architecture descriptors',P('buildings.filter(b=>b.isWesternBldg&&b.frontierDesign.primary).length===69'));
ok('store and cooperative names cannot be mistaken for ore or cooper workshops',P("frontierArchitecturePurpose({signText:'GENERAL STORE'})==='MERCHANT'&&frontierArchitecturePurpose({signText:'SEED COOPERATIVE'})==='MARKET'"));
ok('farm and residential structures use the same grounded architecture',P('buildings.filter(b=>b.isBarn||b.isTrailer||b.isShanty||b.isHouse).every(b=>b.frontierDesign&&b.frontierLot)'));
ok('primary signs identify premises only once',P('buildings.filter(b=>b.frontierDesign&&!b.frontierDesign.primary).every(b=>!b.signText)'));
ok('compounds have genuine independent rectangular wings',P('buildings.some(b=>b.frontierPartId===\'return\')'));
ok('compound wings remain inside the original lot',P(`buildings.filter(b=>b.frontierDesign).every(b=>Math.abs(b.x-b.frontierLot.x)+b.w/2<=b.frontierLot.w/2+.001&&Math.abs(b.y-b.frontierLot.y)+b.h/2<=b.frontierLot.h/2+.001)`));
ok('compound wings preserve the original premises construction-clearance policy',P(`buildings.filter(b=>b.frontierDesign).every(b=>buildClearable(b)===(!b.isAuthored&&Math.max(b.frontierLot.w,b.frontierLot.h)<=BUILD_CLEAR_MAX&&b.frontierLot.w*b.frontierLot.h<=BUILD_CLEAR_AREA))`));
ok('architecture does not introduce harvest payout or destructible HP',P(`buildings.filter(b=>b.frontierDesign).every(b=>harvestProfile(b)===null&&b.hp===undefined)`));
ok('a compound courtyard is natively passable',P(`(()=>{
 const b=buildings.find(b=>b.frontierPartId==='return'),lot=b.frontierLot;
 const swap=lot.facing==='E'||lot.facing==='W',span=swap?lot.h:lot.w,depth=swap?lot.w:lot.h;
 const side=(b.frontierDesign.variant&1)?-1:1;
 const p=frontierArchitectureLocal(lot,-side*span*.22,depth*.28);
 player.x=p[0];player.y=p[1];return !player.checkCol(p[0],p[1]);})()`));
ok('all named structures differ geometrically without labels or colour',P(`(()=>{
 const signatures=buildings.filter(b=>b.isWesternBldg&&b.frontierDesign.primary).map(b=>JSON.stringify(frontierRoofMesh(b).faces.map(f=>f.points.map(p=>[+(p[0]-b.x).toFixed(4),+(p[1]-b.y).toFixed(4),+p[2].toFixed(4)]))));
 return new Set(signatures).size===69;})()`));
ok('primary roofs have physical height without requiring an ornament on every building',P(`buildings.filter(b=>b.frontierDesign&&b.frontierDesign.primary).every(b=>new Set(frontierRoofMesh(b).faces.flatMap(f=>f.points.map(p=>p[2]))).size>=2)`));
ok('roof geometry cache is reused',P(`(()=>{const b=buildings.find(b=>b.frontierDesign);return frontierRoofMesh(b)===frontierRoofMesh(b);})()`));
ok('an old save inside replacement geometry moves to clear terrain at the same height',P(`(()=>{
 const b=buildings.find(b=>b.isWesternBldg&&b.frontierDesign.primary&&!b.isFrontierSaloon);
 player.x=b.x;player.y=b.y;const z=groundElev(player.x,player.y);
 const moved=frontierRestoreSafePosition(player);
 return moved&&!player.checkCol(player.x,player.y)&&Math.abs(groundElev(player.x,player.y)-z)<=8;})()`));
ok('a valid saved position is preserved exactly',P(`(()=>{player.x=1300;player.y=-1730;const moved=frontierRestoreSafePosition(player);return !moved&&player.x===1300&&player.y===-1730;})()`));

let balance=0,lowest=0,finite=true;
const oldPush=ctx.push,oldPop=ctx.pop,draws={};
ctx.push=function(){balance++;return oldPush();};ctx.pop=function(){balance--;lowest=Math.min(lowest,balance);return oldPop();};
for(const name of ['quad','triangle','vertex','line','rect','ellipse']){draws[name]=ctx[name];ctx[name]=function(...args){if(args.some(v=>typeof v==='number'&&!Number.isFinite(v)))finite=false;return draws[name](...args);};}
for(const hour of [8,18,23])for(const facing of ['N','E','S','W'])for(const corner of [[-1600,-1000],[1600,1000]]){
 ctx.__f=facing;ctx.__cx=corner[0];ctx.__cy=corner[1];
 probe(`worldTimeMs=${hour}/24*DAY_MS;updateSunVector();camX=window.__cx;camY=window.__cy;
  drawBuildings(buildings.filter(b=>b.frontierDesign).map(b=>({...b,facing:window.__f})));`);
}
ctx.push=oldPush;ctx.pop=oldPop;for(const n in draws)ctx[n]=draws[n];
ok('all orientations and camera sides render finite projected geometry',finite);
ok('all architecture drawing states balance',balance===0&&lowest===0);

for(const site of P('frontierSettlementSites()')){
 ctx.__site=site;probe('biomeState={};');
 ok(site.id+' retains twelve logical premises',P('frontierSettlementPlan(window.__site).filter(b=>b.frontierDesign&&b.frontierDesign.primary).length===12'));
 ok(site.id+' uses varied purpose-built footprints',P('new Set(frontierSettlementPlan(window.__site).filter(b=>b.frontierDesign&&b.frontierDesign.primary).map(b=>b.frontierLot.w+\',\'+b.frontierLot.h)).size===12'));
 const parent=P(`frontierSettlementPlan(window.__site).find(b=>b.frontierPartId==='return')`);
 if(parent){
  ctx.__parent=parent;
  probe(`window.__key=Math.floor(window.__parent.frontierLot.x/CHUNK_W)+','+Math.floor(window.__parent.frontierLot.y/CHUNK_W)+',settlement:'+window.__site.id+':'+window.__parent.frontierParentSettlementPart;markPropDestroyed(3,window.__key);`);
  ok(site.id+' old parent destruction suppresses all replacement wings',P(`(()=>{const p=window.__parent,cx=Math.floor(p.frontierLot.x/CHUNK_W),cy=Math.floor(p.frontierLot.y/CHUNK_W);return !generateChunkContent(3,cx,cy).solid.some(b=>b.frontierPremiseId===p.frontierPremiseId);})()`));
 }
}
probe('biomeState={};authoredMask=null;');
let streamed=0;
for(let cy=8;cy<16;cy++)for(let cx=-5;cx<5;cx++){
 ctx.__cx=cx;ctx.__cy=cy;const native=P('generateChunkContent(3,window.__cx,window.__cy).solid');
 const buildings=native.filter(b=>b.frontierDesign);streamed+=buildings.length;
 ok('streamed geometry has stable namespaced parent identity '+cx+','+cy,buildings.every(b=>b.chunkKey.includes(',frontier:v1:')));
 if(buildings.length){const expected=JSON.stringify(native);probe('generateChunkContent(3,37,-25);');ok('unrelated chunk generation cannot perturb architecture '+cx+','+cy,expected===JSON.stringify(P('generateChunkContent(3,window.__cx,window.__cy).solid')));}
}
ok('streamed frontier fixture includes real buildings',streamed>20);
console.log('Frontier architecture: '+checks+' checks passed; '+streamed+' streamed building wings.');

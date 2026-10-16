// Added side gulches must be native terrain, with playable entries and decks,
// rather than painted gaps which can strand streamed actors or town foundations.
const assert=require('assert');
const {ctx,probe,mkG,calls}=require('./harness');
let checks=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
probe(`isStoryMode=false;townsData={};startAtLevel(3);started=true;
 activeBuildings=[];activeParkingCars=[];colGrid=null;isPaused=isDead=isWin=false;
 inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=false;`);
const sites=Array.from(probe('frontierCanyonLandmarks()')).map(p=>({...p,bridgeUs:Array.from(p.bridgeUs),rampUs:Array.from(p.rampUs)}));
check(sites.length===3&&new Set(sites.map(s=>s.kind)).size===3,'Three geographically distinct side gulches have stable identities');
for(const site of sites){
 const axis=site.axis,index=site.index;
 const point=(u,v)=>axis==='Y'?[v,u]:[u,v];
 const middle=(site.u0+site.u1)/2;
 // Select a real floor away from the bridge/ramp masks and any old junction.
 let floorU;
 for(let u=site.u0+700;u<site.u1-700;u+=100){
  const p=probe(`frontierCanyonProfile('${axis}',${u},${index})`);
  const q=point(u,p.center);
  if(p.ramp===0&&p.bridge===0&&p.depth>65&&probe(`frontierCanyonAt(${q[0]},${q[1]})?.landmark===${JSON.stringify(site.id)}`)){floorU=u;break;}
 }
 check(Number.isFinite(floorU),site.id+' has a genuinely deep floor separate from its crossings');
 const p=probe(`frontierCanyonProfile('${axis}',${floorU},${index})`),[x,y]=point(floorU,p.center);
 check(probe(`frontierCanyonHeight(${x},${y})`)<-55,site.id+' lowers the actual terrain');
 check(probe(`groundElev(${x},${y})`)<-55,site.id+' lowers character elevation and shader terrain together');
 check(probe(`frontierCanyonAt(${x},${y}).landmark===${JSON.stringify(site.id)}`),site.id+' participates in world reservations');
 check(probe(`frontierCanyonReserved(${x},${y},110,110,10)`),site.id+' reserves its floor against random buildings');
 check(probe(`frontierCanyonSpawnSafe(${x},${y})`),site.id+' supports native actor spawns on its floor');
 const bank=point(floorU,p.center+p.floorHalf+111);
 check(!probe(`frontierCanyonSpawnSafe(${bank[0]},${bank[1]})`),site.id+' rejects population spawn on a steep bank');
 probe(`player.x=${bank[0]};player.y=${bank[1]};`);
 const [dx,dy]=axis==='Y'?[5,0]:[0,5];
 check(probe(`frontierCanyonBlocksMove(player.x,player.y,player.x+${dx},player.y+${dy},15)`),site.id+' native movement blocks scaling its cliff');
 // Every authored deck and ramp can be crossed continuously by the player.
 for(const kind of ['bridgeUs','rampUs'])for(const u of site[kind]){
  const cp=probe(`frontierCanyonProfile('${axis}',${u},${index})`),[sx,sy]=point(u,cp.center-cp.outerHalf-50);
  const distance=cp.outerHalf*2+100;
  probe(`player.x=${sx};player.y=${sy};var expandedCrossStart=${axis==='Y'?'player.x':'player.y'};
    var expandedCrossTicks=0;for(;expandedCrossTicks<1400&&${axis==='Y'?'player.x':'player.y'}<expandedCrossStart+${distance}-3;expandedCrossTicks++)player.attemptMove(${axis==='Y'?5:0},${axis==='Y'?0:5});`);
  check(probe(`${axis==='Y'?'player.x':'player.y'}>=expandedCrossStart+${distance}-3`),site.id+' native player traverses '+kind+' at '+u);
  if(kind==='bridgeUs'){
   const [cx,cy]=point(u,cp.center);
   check(probe(`frontierCanyonHeight(${cx},${cy})===0`),site.id+' deck joins both rims at ground height');
  }
 }
 for(const end of [site.u0,site.u1]){
  const direction=end===site.u0?1:-1,entryU=end-direction*35,
    entryV=probe(`frontierCanyonCenter('${axis}',${end+direction*280},${index})`),[ex,ey]=point(entryU,entryV);
  probe(`player.x=${ex};player.y=${ey};var endWalkStart=${axis==='Y'?'player.y':'player.x'};
    for(let t=0;t<160;t++)player.attemptMove(${axis==='Y'?0:direction*5},${axis==='Y'?direction*5:0});`);
  check(probe(`(${axis==='Y'?'player.y':'player.x'}-endWalkStart)*${direction}>650`),site.id+' finite end can be entered by native walking');
  const eps=.00001,a=probe(`frontierCanyonProfile('${axis}',${end-eps},${index})`),b=probe(`frontierCanyonProfile('${axis}',${end+eps},${index})`);
  check(Math.abs(a.depth-b.depth)<.001,site.id+' finite end eases continuously into the desert');
 }
 // Adjacent chunk heights and textures keep world-space seeds on revisit.
 for(let u=Math.ceil(site.u0/1200)*1200;u<site.u1;u+=1200){
  const c=probe(`frontierCanyonCenter('${axis}',${u},${index})`),q=point(u,c),r=point(u+.00001,c);
  check(Math.abs(probe(`frontierCanyonHeight(${q[0]},${q[1]})`)-probe(`frontierCanyonHeight(${r[0]},${r[1]})`))<.001,site.id+' height stays continuous at a chunk seam');
 }
 const g=mkG();ctx.expandedCanyonG=g;
 const [cx,cy]=point(middle,site.center),ox=Math.floor(cx/1200)*1200,oy=Math.floor(cy/1200)*1200;
 calls.sig=0;calls.fill=0;probe(`bakeFrontierCanyons(expandedCanyonG,3,${ox},${oy});`);
 const signature=calls.sig,fillCount=calls.fill;
 check(fillCount>100,site.id+' bakes physical rock/floor planes and landmark detail');
 calls.sig=0;probe(`generateChunkContent(3,-10,7);generateChunkContent(3,11,-9);bakeFrontierCanyons(expandedCanyonG,3,${ox},${oy});`);
 check(signature===calls.sig,site.id+' terrain paint survives residency changes deterministically');
 const before=probe(`JSON.stringify(generateChunkContent(3,${Math.floor(x/1200)},${Math.floor(y/1200)}))`);
 probe('generateChunkContent(3,-9,-9);generateChunkContent(3,12,12);');
 check(before===probe(`JSON.stringify(generateChunkContent(3,${Math.floor(x/1200)},${Math.floor(y/1200)}))`),site.id+' chunk content is independent of visitation order');
}
if(probe("typeof frontierSettlementSites==='function'")){
 check(probe(`frontierSettlementSites().every(s=>{
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)if(frontierCanyonHeight(s.x+i*s.w*.5,s.y+j*s.h*.5)!==0)return false;
  return true;
 })`),'Every new settlement foundation remains completely flat');
}
check(probe(`frontierCanyonLandmark('X',100)===null&&frontierCanyonLandmark('Y',102)===null&&
  frontierCanyonProfile('X',0,100).landmark===null&&frontierCanyonProfile('Y',0,102).landmark===null`),
 'Finite landmark identifiers never shadow distant integer canyon rows');
check(probe(`frontierCanyonHeight(1300,-1730)===0&&frontierCanyonHeight(outpostFortDef(3).x,outpostFortDef(3).y)===0`),'The original town and mission fortress retain their foundations');
console.log('Frontier canyon expansion: '+checks+' native terrain, route, spawn, seam and deterministic bake checks passed.');

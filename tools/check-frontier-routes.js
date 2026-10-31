// Find and physically walk routes from the sheriff's street to every outpost.
// Native collision reads all authored and procedural solids, and canyon ramps
// use the actual movement authority rather than a test-only passability map.
const assert = require('assert');
const {probe} = require('./harness');
function run(code) { return probe(code); }
run(`isStoryMode=false;resetStoryProgress();startAtLevel(3);started=true;
  isPaused=false;isDead=false;isWin=false;killcamMode=false;inTownCutscene=false;
  inFarmCutscene=false;inFarmPostCutscene=false;inFortCutscene=false;
  inPostAmbushCutscene=false;inTravelMenu=false;inDarchonCall=false;inStoryIntro=false;
  doTick=true;player.ignoreBldgTimer=0;barrels=[];activeParkingCars=[];
  var routeSolids=authoredSolids.slice();routeSolids.push(...frontierBountyStructures());
  for(let cy=-4;cy<=2;cy++)for(let cx=-4;cx<=5;cx++)
    routeSolids.push(...generateChunkContent(3,cx,cy).solid);
  activeBuildings=routeSolids;buildColIndex();`);
const routes = run(`(() => {
  const size=60, sx=1300, sy=-2110, minI=-97,maxI=90,minJ=-42,maxJ=77;
  const keys=(i,j)=>i+','+j;
  const starts={i:0,j:0}, pending=[starts], previous=new Map([[keys(0,0),null]]);
  const destinations=frontierBountySites().map(d=>({d,i:Math.round((d.x-sx)/size),
    j:Math.round((d.y+345-sy)/size),found:false}));
  const edge=(ax,ay,bx,by)=>{
    player.x=ax;player.y=ay;
    for(let n=0;n<60;n++) {
      const dx=bx-player.x,dy=by-player.y,d=Math.hypot(dx,dy);
      if(d<.2)return true;
      const step=Math.min(6,d),m=player.attemptMove(dx/d*step,dy/d*step);
      if(Math.abs(m.x)+Math.abs(m.y)<.001)return false;
    }
    return false;
  };
  for(let n=0;n<pending.length;n++) {
    const p=pending[n];
    for(const t of destinations)if(p.i===t.i&&p.j===t.j)t.found=true;
    if(destinations.every(t=>t.found))break;
    for(const [di,dj]of[[1,0],[-1,0],[0,1],[0,-1]]) {
      const i=p.i+di,j=p.j+dj,k=keys(i,j);
      if(i<minI||i>maxI||j<minJ||j>maxJ||previous.has(k))continue;
      if(!edge(sx+p.i*size,sy+p.j*size,sx+i*size,sy+j*size))continue;
      previous.set(k,keys(p.i,p.j));pending.push({i,j});
    }
  }
  return destinations.map(t=>{
    if(!t.found)return{id:t.d.id,found:false,visited:pending.length};
    const path=[];let k=keys(t.i,t.j);
    while(k!==null){const[i,j]=k.split(',').map(Number);path.push({x:sx+i*size,y:sy+j*size});k=previous.get(k);}
    path.reverse();player.x=sx;player.y=sy;
    let ticks=0,blocked=false;
    for(let n=1;n<path.length&&!blocked;n++){
      const to=path[n];let attempts=0;
      while(Math.hypot(to.x-player.x,to.y-player.y)>.2&&attempts++<120){
        const dx=to.x-player.x,dy=to.y-player.y,d=Math.hypot(dx,dy),step=Math.min(6,d);
        const moved=player.attemptMove(dx/d*step,dy/d*step);ticks++;
        if(Math.abs(moved.x)+Math.abs(moved.y)<.001){blocked=true;break;}
      }
      if(attempts>=120)blocked=true;
    }
    return{id:t.d.id,found:true,walked:!blocked,ticks,nodes:path.length,
      remaining:Math.hypot(player.x-(sx+t.i*size),player.y-(sy+t.j*size)),visited:pending.length};
  });
})()`);
for (const route of routes) {
  assert.ok(route.found,route.id+' is reachable through native collision ('+route.visited+' visited cells)');
  assert.ok(route.walked&&route.remaining<1,route.id+' can be physically walked with native elevation, collision and movement');
  console.log(route.id+': '+route.nodes+' route marks, '+route.ticks+' native movement ticks.');
}
console.log('Frontier routes: '+routes.length+' complete sheriff-to-outpost walks passed.');

// Find and then continuously walk the three new township routes. The search
// calls native movement against the authored world and generated collision;
// it does not substitute a test-only canyon or road passability map.
const assert = require('assert');
const {probe} = require('./harness');

probe(`isStoryMode=false;resetStoryProgress();startAtLevel(3);started=true;
  isPaused=false;isDead=false;isWin=false;killcamMode=false;inTownCutscene=false;
  inFarmCutscene=false;inFarmPostCutscene=false;inFortCutscene=false;
  inPostAmbushCutscene=false;inTravelMenu=false;inDarchonCall=false;inStoryIntro=false;
  doTick=true;player.ignoreBldgTimer=0;barrels=[];activeParkingCars=[];
  var settlementRouteBounds={left:-8500,right:10500,top:-8500,bottom:8500};
  var settlementRouteSolids=authoredSolids.slice();
  settlementRouteSolids.push(...frontierBountyStructures());
  for(let cy=Math.floor(settlementRouteBounds.top/CHUNK_SIZE)-1;
      cy<=Math.floor(settlementRouteBounds.bottom/CHUNK_SIZE)+1;cy++)
    for(let cx=Math.floor(settlementRouteBounds.left/CHUNK_SIZE)-1;
        cx<=Math.floor(settlementRouteBounds.right/CHUNK_SIZE)+1;cx++)
      settlementRouteSolids.push(...generateChunkContent(3,cx,cy).solid);
  activeBuildings=settlementRouteSolids;buildColIndex();`);

const routes=probe(`(() => {
  const size=60,sx=1300,sy=-2110,bounds=settlementRouteBounds;
  const minI=Math.ceil((bounds.left-sx)/size),maxI=Math.floor((bounds.right-sx)/size);
  const minJ=Math.ceil((bounds.top-sy)/size),maxJ=Math.floor((bounds.bottom-sy)/size);
  const width=maxI-minI+1,key=(i,j)=>(j-minJ)*width+i-minI;
  const position=k=>({i:k%width+minI,j:Math.floor(k/width)+minJ});
  const edgeCache=new Map();
  // Movement can slide against a wall, so only reaching the exact next grid
  // mark makes an edge passable. Replay uses the same native six-unit steps.
  const walk=(tx,ty)=>{
    let ticks=0;
    while(Math.hypot(tx-player.x,ty-player.y)>1e-7&&ticks<100) {
      const dx=tx-player.x,dy=ty-player.y,d=Math.hypot(dx,dy),step=Math.min(6,d);
      const moved=player.attemptMove(dx/d*step,dy/d*step);ticks++;
      if(Math.abs(moved.x)+Math.abs(moved.y)<.001)break;
    }
    return {clear:Math.hypot(tx-player.x,ty-player.y)<=1e-7,ticks};
  };
  const edge=(from,to)=>{
    const ck=from+':'+to;
    if(edgeCache.has(ck))return edgeCache.get(ck);
    const a=position(from),b=position(to);
    player.x=sx+a.i*size;player.y=sy+a.j*size;
    const clear=walk(sx+b.i*size,sy+b.j*size).clear;
    edgeCache.set(ck,clear);return clear;
  };
  class Heap {
    constructor(){this.a=[];}
    push(v){
      const a=this.a;let i=a.length;a.push(v);
      while(i){const p=(i-1)>>1;if(a[p].f<v.f||a[p].f===v.f&&a[p].h<=v.h)break;a[i]=a[p];i=p;}
      a[i]=v;
    }
    pop(){
      const a=this.a,first=a[0],last=a.pop();
      if(a.length){let i=0;
        while(i*2+1<a.length){let c=i*2+1;
          if(c+1<a.length&&(a[c+1].f<a[c].f||a[c+1].f===a[c].f&&a[c+1].h<a[c].h))c++;
          if(last.f<a[c].f||last.f===a[c].f&&last.h<=a[c].h)break;a[i]=a[c];i=c;}
        a[i]=last;
      }
      return first;
    }
  }
  return frontierSettlementSites().map(site=>{
    const ti=Math.round((site.x-sx)/size),tj=Math.round((site.y-sy)/size);
    const target=key(ti,tj),start=key(0,0),open=new Heap();
    const costs=new Map([[start,0]]),previous=new Map([[start,null]]),closed=new Set();
    const heuristic=(i,j)=>Math.abs(ti-i)+Math.abs(tj-j);
    open.push({k:start,g:0,h:heuristic(0,0),f:heuristic(0,0)});
    let found=false;
    while(open.a.length){
      const current=open.pop();if(closed.has(current.k))continue;
      if(current.k===target){found=true;break;}
      closed.add(current.k);
      const p=position(current.k);
      for(const[di,dj]of[[1,0],[-1,0],[0,1],[0,-1]]){
        const i=p.i+di,j=p.j+dj;
        if(i<minI||i>maxI||j<minJ||j>maxJ)continue;
        const k=key(i,j),g=current.g+1;
        if(closed.has(k)||g>=(costs.get(k)??Infinity)||!edge(current.k,k))continue;
        const h=heuristic(i,j);costs.set(k,g);previous.set(k,current.k);
        open.push({k,g,h,f:g+h});
      }
    }
    if(!found)return{id:site.id,name:site.name,found:false,visited:closed.size};
    const path=[];let k=target;
    while(k!==null){const p=position(k);path.push({x:sx+p.i*size,y:sy+p.j*size});k=previous.get(k);}
    path.reverse();path.push({x:site.x,y:site.y});
    player.x=sx;player.y=sy;
    let ticks=0,blocked=false,failedAt=null;
    for(let n=1;n<path.length;n++){
      const moved=walk(path[n].x,path[n].y);ticks+=moved.ticks;
      if(!moved.clear){blocked=true;failedAt={x:player.x,y:player.y,target:path[n]};break;}
    }
    return{id:site.id,name:site.name,found:true,walked:!blocked,ticks,nodes:path.length,
      remaining:Math.hypot(player.x-site.x,player.y-site.y),visited:closed.size,failedAt};
  });
})()`);

for(const route of routes){
  assert.ok(route.found,route.id+' reachable through native collision ('+route.visited+' searched cells)');
  assert.ok(route.walked&&route.remaining<1,route.id+' continuously walkable: '+JSON.stringify(route));
  console.log(route.id+': '+route.nodes+' route marks, '+route.ticks+' native movement ticks, '+route.visited+' searched cells.');
}
console.log('Frontier settlement routes: '+routes.length+' complete sheriff-to-town walks passed.');

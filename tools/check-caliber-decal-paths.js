// The native Canvas path and p5 fallback must close and fill the same cached
// polygons. Native pixel parity is also checked by the caliber visual review.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
const nativeContext=ctx.figureCelContext;
let paths=0,vertices=0;
try{
 for(const tier of ['LIGHT','MEDIUM','HEAVY'])for(let seed=0;seed<32;seed++){
  const geometry=P(`bodyImpactGeometry(${JSON.stringify(tier)},${seed})`);
  const polygons=[geometry.outer,geometry.deep,geometry.core,geometry.lip,...geometry.tears,...geometry.flecks];
  for(const points of polygons){
   const before=JSON.stringify(points),p5={starts:0,ends:0,points:[]},canvas={starts:0,closes:0,fills:0,strokes:0,points:[]};
   ctx.__caliberPathPoints=points;
   ctx.__caliberPathTarget={
    beginShape(){p5.starts++;},vertex(x,y){p5.points.push([x,y]);},endShape(mode){assert.equal(mode,P('CLOSE'));p5.ends++;}
   };
   ctx.figureCelContext=()=>null;
   probe('bodyImpactPath(__caliberPathTarget,__caliberPathPoints);');
   assert.equal(p5.starts,1);assert.equal(p5.ends,1);assert.equal(JSON.stringify(p5.points),before);
   vertices+=p5.points.length;
   const dc={
    beginPath(){canvas.starts++;},lineTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y));canvas.points.push([x,y]);},
    closePath(){canvas.closes++;},fill(){canvas.fills++;},stroke(){canvas.strokes++;}
   };
   ctx.figureCelContext=()=>dc;
   ctx.__caliberPathTarget={beginShape(){throw Error('native decal allocated a p5 shape');},vertex(){throw Error('native decal allocated a p5 vertex');}};
   probe('bodyImpactPath(__caliberPathTarget,__caliberPathPoints);');
   assert.equal(canvas.starts,1);assert.equal(canvas.closes,1);assert.equal(canvas.fills,1);assert.equal(canvas.strokes,0);
   // Shared figure helpers reproduce p5's duplicate closing vertices. Removing
   // those redundant endpoints must recover the fallback's complete perimeter.
   const first=canvas.points[0];
   while(canvas.points.length>1){const last=canvas.points[canvas.points.length-1];if(last[0]!==first[0]||last[1]!==first[1])break;canvas.points.pop();}
   assert.equal(JSON.stringify(canvas.points),JSON.stringify(p5.points));
   assert.equal(JSON.stringify(points),before,'painting mutated cached decal geometry');
   paths++;
  }
 }
}finally{ctx.figureCelContext=nativeContext;delete ctx.__caliberPathPoints;delete ctx.__caliberPathTarget;}
console.log(`Caliber decal paths: ${paths} cached polygons preserve Canvas/p5 closure and fills; native painting bypasses ${vertices} p5 vertices.`);

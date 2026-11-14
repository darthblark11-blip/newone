// Verify material ownership, native digging and first-frame trail geometry.
const assert=require('assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');let checks=0;
const check=(v,label)=>{assert.ok(v,label);checks++;};
probe(`currentLevel=currentBiome=3;BIOME_ACTIVE=true;authoredCore=null;chunkMgr=null;
  window.surfaceLots=[{x:-40,y:0,w:160,h:100,isWesternBldg:true,facing:'S'},
    {x:80,y:0,w:160,h:100,isWesternBldg:true,facing:'S'}];
  buildings=surfaceLots;authoredSolids=surfaceLots;activeBuildings=surfaceLots;`);
const rects=P('frontierSurfaceRects(surfaceLots)'),timber=rects.filter(r=>r.kind==='TIMBER');
ctx.rects=rects;
const union=P('frontierUnionSurfaces(window.rects,"TIMBER")');
for(let i=0;i<union.length;i++)for(let j=i+1;j<union.length;j++){
  const a=union[i],b=union[j];
  check(Math.min(a.x1,b.x1)<=Math.max(a.x0,b.x0)||Math.min(a.y1,b.y1)<=Math.max(a.y0,b.y0),'Union has no overlapping opaque strips');
}
for(let y=40;y<85;y+=3)for(let x=-140;x<180;x+=3){
  const contains=a=>a.some(r=>x>=r.x0&&x<r.x1&&y>=r.y0&&y<r.y1);
  check(contains(union)===contains(timber),'Union preserves the exact walking surface');
}
const reversed=probe('frontierUnionSurfaces(window.rects.slice().reverse(),"TIMBER")');
assert.deepStrictEqual(union,reversed);checks++;
check(P('frontierSurfaceAt(0,60)==="TIMBER"'),'Overlapping frontage has one timber material');
check(P('shovelFrontierDeckAt(0,60)'),'Native shovel recognizes the visible frontage');
check(P('frontierSurfaceAt(0,0)==="EARTH"'),'Apron remains earth instead of a hidden deck');
probe('buildings=[];authoredSolids=[];activeBuildings=[];invalidateColIndex();');
check(P('frontierSurfaceAt(0,60)===null'),'Changing maps invalidates surface lookup');
probe(`window.surfaceLots=[{x:0,y:-600,w:260,h:160,isWesternBldg:true,facing:'S'}];
  buildings=surfaceLots;authoredSolids=surfaceLots;activeBuildings=surfaceLots;`);
ctx.captureSurface=()=>{
  let fill=[],commands=[];return {commands,push(){},pop(){},noStroke(){},
    fill(...v){fill=v;},stroke(){},strokeWeight(){},line(){},ellipse(){},
    rect(x,y,w,h){commands.push({x,y,w,h,fill:fill.slice()});}};
};
const left=P('(()=>{const g=captureSurface();bakeFrontierSurfaces(g,3,-1,-1,surfaceLots);return g.commands;})()');
const right=P('(()=>{const g=captureSurface();bakeFrontierSurfaces(g,3,0,-1,surfaceLots);return g.commands;})()');
check(left.length>0&&right.length>0,'Both sides of a negative-coordinate seam receive the frontage');
for(const [commands,x0]of [[left,-1200],[right,0]])for(const c of commands)
  check(c.x>=x0&&c.x+c.w<=x0+1200&&c.y>=-1200&&c.y+c.h<=0,'Baked surface is clipped to its own chunk');
const edge=(commands,x)=>commands.filter(c=>c.fill[0]===143&&c.x<=x&&c.x+c.w>=x).map(c=>[c.y,c.h]);
assert.deepStrictEqual(edge(left,0),edge(right,0));checks++;
// A crossroads uses one fill operation per material layer, with all polygon
// windings agreeing so overlapping paths union instead of punching holes.
ctx.roadCapture=()=>{
  const fills=[];let paths=[],points=[];
  return {fills,noStroke(){},fill(){},drawingContext:{
    beginPath(){paths=[];},moveTo(x,y){points=[[x,y]];paths.push(points);},
    lineTo(x,y){points.push([x,y]);},closePath(){},fill(){fills.push(paths);}
  }};
};
const roads=P('(()=>{const g=roadCapture();bakeFrontierRoadNetwork(g,3,1,-1,()=>1300,()=>1,DG_ROADS[3]);return g.fills;})()');
check(roads.length===17,'Crossroads share five shoulder fills and twelve material fills');
check(roads.some(paths=>paths.length>=2),'The crossing is included in the same compound path as its through road');
for(const paths of roads)for(const polygon of paths){
  let area=0;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];area+=a[0]*b[1]-b[0]*a[1];}
  check(area>=0,'Road polygons have consistent nonzero winding');
}
// Every drawing argument must remain finite on the first rocket frame.
for(const name of ['ellipse','fill','rect','line','translate','rotate']){
  const original=ctx[name];ctx[name]=(...args)=>{
    for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),name+' uses finite coordinates');
    return original(...args);
  };
}
probe(`player=new Character(0,0,true);window.testSmoke=new Bullet();
  testSmoke.init(50,70,0,true,'BODY',WEAPONS.ROCKET_LAUNCHER);
  testSmoke.history.push({x:40,y:70});testSmoke.show();`);checks++;
console.log(`Frontier surfaces: ${checks} ownership, seam, shovel and finite-trail checks passed.`);

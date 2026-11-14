// Check physical contact, rotated projection, shared art/height silhouettes and
// stable caches for the Level 1 quay crane and barge. Uses the actual game code.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=source=>probe('('+source+')');
probe('currentLevel=currentBiome=1;BIOME_ACTIVE=true;zoom=1;width=1200;height=900;camX=camY=0;LIGHT_DX=.6;LIGHT_DY=.8;');
let checks=0;
const ok=(value,message)=>{checks++;assert.ok(value,message);};
let paths=[],path=null,stack=0;
ctx.__quayTarget={drawingContext:{
  save(){stack++;},restore(){stack--;},
  beginPath(){path=[];},moveTo(x,y){path.push(x,y);},lineTo(x,y){path.push(x,y);},closePath(){},
  fill(){paths.push({points:path.slice(),style:this.fillStyle});}
}};
const paint=(height=false)=>{
  paths=[];
  ok(P(height?'CityQuayProps3D.paintHeight(__quayTarget,__quayProp,.5)':'CityQuayProps3D.draw(__quayProp,__quayTarget)'),
    height?'height draws':'art draws');
  ok(stack===0,'Canvas state is balanced');
  ok(paths.length>0&&paths.every(p=>p.points.every(Number.isFinite)),'visible paths contain finite coordinates');
  return paths;
};
const fixtures=[];
for(const type of ['QUAYCRANE','BARGE'])for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]) {
  const b={isBiomeProp:true,propType:type,x:600,y:450,w:type==='BARGE'?220:58,
    h:type==='BARGE'?62:58,angle,tint:.45,hp:100};
  ctx.__quayProp=b;const saved=JSON.stringify(b),p=P('CityQuayProps3D.plan(__quayProp)');
  ok(p.faces.length<=(type==='BARGE'?65:100),type+' has a bounded face count');
  ok(p.faces.every(f=>Math.abs(Math.hypot(...f.normal)-1)<1e-8),'physical face normals are normalized');
  const vertices=p.faces.flatMap(f=>f.points),ground=vertices.filter(v=>v[2]===0);
  ok(ground.length>0,'the model has actual ground contacts');
  ok(vertices.every(v=>v.every(Number.isFinite)&&v[2]>=0&&v[2]<=(type==='BARGE'?10:31)),
    'all geometry retains its own bounded height');
  if(type==='QUAYCRANE') {
    const reach=Math.max(...vertices.map(v=>(v[0]-b.x)*Math.cos(angle)+(v[1]-b.y)*Math.sin(angle)));
    ok(Math.abs(reach-106)<1e-7,'the jib rotates toward the same native water-facing direction');
  }
  for(const [cx,cy]of [[0,0],[-650,-500],[650,-500],[650,500],[-650,500]]) {
    probe(`camX=${cx};camY=${cy};`);const projected=P('CityQuayProps3D.project(__quayProp)');
    for(const f of projected.faces)for(let i=0;i<f.points.length;i++)if(f.points[i][2]===0)
      ok(Math.abs(f.projected[i*2]-f.points[i][0])<1e-8&&Math.abs(f.projected[i*2+1]-f.points[i][1])<1e-8,
        'camera movement keeps the visible foot on its physical ground point');
    const art=paint(),height=paint(true);
    ok(JSON.stringify(art.map(f=>f.points))===JSON.stringify(height.map(f=>f.points)),
      'lighting and visible art use identical projected silhouettes');
    ok(P('CityQuayProps3D.depth(__quayProp)')>=Math.max(b.y+b.h/2,projected.bounds[3]),
      'actor depth includes the projected shape');
    const before=P('({...CityQuayProps3D.stats})');paint();paint(true);
    const after=P('({...CityQuayProps3D.stats})');
    ok(after.plans===before.plans&&after.projections===before.projections&&after.pathBuilds===before.pathBuilds,
      'an idle view reuses geometry and projected paths for art and lighting');
  }
  const lit=paint();probe('LIGHT_DX=-.8;LIGHT_DY=-.6;');const turned=paint();
  ok(lit.some((f,i)=>f.style!==turned[i].style),'surface shading follows the actual sun direction');
  probe('LIGHT_DX=.6;LIGHT_DY=.8;');
  ok(JSON.stringify(b)===saved,'rendering does not mutate placement, collision, angle or health');
  fixtures.push({type,angle,faces:p.faces.length});
}
for(const level of [0,2,3,8,9]){probe(`currentLevel=currentBiome=${level};`);ok(!P('CityQuayProps3D.canDraw(__quayProp)'),
  'quay replacements are scoped to Level 1');}
probe('currentLevel=currentBiome=1;');
for(const propType of ['BENCH','BOLLARD','BRIDGE','CANALBRIDGE','WRECK']) {
  ctx.__quayProp={isBiomeProp:true,propType,x:0,y:0,w:58,h:58};
  ok(!P('CityQuayProps3D.canDraw(__quayProp)'),'unrelated props retain their native painter');
}
console.log(checks+' quay prop contact, rotation, shared-height, material, cache and scope checks passed across '+fixtures.length+' models/headings');

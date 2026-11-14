// Blender geometry and native city invariants, without a browser dependency.
// Rendering tests live separately in check-city3d-browser.cjs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {ctx,probe}=require('./harness');
const P=source=>probe('('+source+')');
let checks=0;
function ok(value,label){checks++;assert.ok(value,label);}
const asset=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/buildings/city-buildings.json'),'utf8'));
assert.equal(asset.schemaVersion,1);assert.deepEqual(asset.referenceFootprint,[200,160]);
assert.deepEqual(Object.keys(asset.models).sort(),['quay_house','quay_office','quay_warehouse']);
let faces=0,slopes=0,verticals=0;
for(const [name,model] of Object.entries(asset.models)){
 let count=0;
 for(const part of model.parts){
  ok(part.name&&part.faces.length,name+' has semantic nonempty parts');
  for(const face of part.faces){
   count++;faces++;
   ok(face.points.length>=3&&face.normal.length===3,name+' face topology is present');
   ok(face.normal.every(Number.isFinite)&&Math.abs(Math.hypot(...face.normal)-1)<.0001,name+' normal is finite/unit');
   ok(Array.isArray(asset.palette[face.material])&&asset.palette[face.material].length===3,name+' uses an exported material');
   const points=face.points.map(p=>[p[0]*200,p[1]*160,p[2]]),origin=points[0],n=face.normal;
   let winding=null;
   for(let i=1;i<points.length-1;i++){
    const a=points[i].map((q,k)=>q-origin[k]),b=points[i+1].map((q,k)=>q-origin[k]);
    const cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    if(Math.hypot(...cross)>1e-8){winding=cross;break;}
   }
   ok(winding&&winding.reduce((sum,q,k)=>sum+q*n[k],0)>0,name+' winding agrees with its Blender normal');
   for(let i=0;i<face.points.length;i++){
    const p=face.points[i],q=points[i];
    ok(p.length===3&&p.every(Number.isFinite)&&Math.abs(p[0])<=.501&&Math.abs(p[1])<=.501&&p[2]>=0&&p[2]<=18.001,
     name+' stays inside its native footprint/roof-height budget');
    ok(Math.abs(q.reduce((sum,v,k)=>sum+(v-origin[k])*n[k],0))<.0001,name+' polygon is planar in physical Blender coordinates');
   }
   if(Math.abs(n[2])<.0001)verticals++;
   else if(n[2]>.05&&n[2]<.999)slopes++;
  }
 }
 ok(count===model.faceCount&&count<=160,name+' keeps its exported face budget');
}
ok(faces===asset.validation.faceCount&&slopes>0&&verticals>0,'the kit includes real slopes and upright connected surfaces');

probe('currentLevel=currentBiome=1;BIOME_ACTIVE=true;authoredCore=null;authoredMask=null;authoredChunks=null;biomeState={};zoom=1;');
// Frozen from e2fd618, before the visual overhaul. This includes every mass,
// bridge, water blocker and destruction key, rather than just building centers.
const fixtures=[
 [-3,6,'859b1b6a7bf8e8685f017a5b9247af5afe38691cb92d693628b41fa0113062cf'],
 [-1,6,'1b3fbd2368e96022d6ee20ec79e013cf81d1dba4ce4af91eca65ecbf77eb5be4'],
 [0,6,'fbe27cf5af75aa4fa68468831a232c0513fb5bbd1e45dff8ef230e3e12e99cfc'],
 [1,6,'9a4fc2d224c9faa574db6e79371da9b013e822e036e8b78655cea6a8c8a7888f'],
 [2,6,'6c0d284347c847172da324a3af21019417847353320b069b5a7dfa272b3fbb85'],
 [6,6,'ee7791b5eba6c247c8dd46da6e03c39a2f575fb7400558a2b6194d546c95b21e'],
 [-8,6,'1c090e4bf1a8b28768c3b72f77e9235cef418ca2c594537f65cd8d49e32ba2a1'],
 [2,10,'92e80899b6c92dd2ff60dd02deebffdee797e31eb2c4f1808f10b5e18537d032']
];
for(const [cx,cy,expected] of fixtures){
 const ch=P(`generateChunkContent(1,${cx},${cy})`);
 const fields=ch.solid.map(b=>[b.x,b.y,b.w,b.h,b.propType||null,b.cityArchitecture??null,b.style??null,b.chunkKey||null,
  b.isBlockBuilding||false,b.isWater||false,b.isDeck||false,b.noClip||false]);
 assert.equal(createHash('sha256').update(JSON.stringify(fields)).digest('hex'),expected,
  'visual overhaul changes generated footprints, collision flags, RNG or persistence keys at '+cx+','+cy);checks++;
}

ok(P("typeof CityBuildings3D!=='undefined'"),'the self-contained game embeds the Blender building renderer');
const buildings=[
 {x:600,y:7600,w:190,h:130,style:1,isBlockBuilding:true},
 {x:600,y:8000,w:140,h:190,style:3,isBlockBuilding:true},
 {x:900,y:7600,w:210,h:150,style:0,isBlockBuilding:true},
 ...[0,1,3,4].map((cityArchitecture,i)=>({x:i*300,y:7800,w:i%2?130:300,h:i%2?330:140,isBlockBuilding:true,
  cityArchitecture,cityAccent:2,cityStoreys:3,style:i}))
];
for(const fixture of buildings){
 ctx.__cityFixture=fixture;
 const profile=P('CityBuildings3D.profile(__cityFixture)');
 ok(!!asset.models[profile],'eligible city buildings select an actual Blender model');
 const plan=P('CityBuildings3D.plan(__cityFixture)');
 ok(plan===P('CityBuildings3D.plan(__cityFixture)'),'unchanged building geometry reuses its compiled plan');
 ok(plan.faces.length>0&&plan.roofFaces.length>0&&plan.bodyFaces.length>0,'roof and wall geometry are present');
 if(fixture.cityArchitecture===undefined)ok(plan.facadeFaces.length>0,'previously blank buildings receive facade geometry');
 const rise=P('buildingRise(__cityFixture)');
 ok(plan.rise===rise&&plan.w===fixture.w&&plan.h===fixture.h,'model scaling uses the existing footprint and height');
 for(const face of plan.faces){
  ok(face.points.length>=3&&face.points.every(p=>p.every(Number.isFinite)),'scaled Blender faces are finite');
  ok(face.normal.every(Number.isFinite)&&Math.abs(Math.hypot(...face.normal)-1)<.0001,'nonuniform footprint scaling keeps normalized normals');
 }
 for(const [dx,dy] of [[-400,-300],[400,-300],[-400,300],[400,300],[0,0]]){
  probe(`camX=${fixture.x+dx}-width/2;camY=${fixture.y+dy}-height/2;`);
  const projected=P('CityBuildings3D.project(__cityFixture)');
  ok(projected===plan&&projected.bounds.length===4&&projected.bounds.every(Number.isFinite),'camera movement refreshes the existing finite plan');
  const lean=P('massLean(__cityFixture.x,__cityFixture.y,1,[0,0])');
  let roofMaxY=-Infinity;
  for(const face of plan.faces){
   ok(face.projected.length===face.points.length*2,'projected polygon keeps its exported topology');
   for(let i=0;i<face.points.length;i++){
    const p=face.points[i];
    ok(Math.abs(face.projected[i*2]-(p[0]+lean[0]*p[2]))<1e-6&&
      Math.abs(face.projected[i*2+1]-(p[1]+lean[1]*p[2]))<1e-6,'roof and wall vertices share the same camera basis');
    const b=face.basis,m=face.affine,x=p[0]-b[0],y=p[1]-b[1],z=p[2]-b[2];
    const u=x*b[3]+y*b[4]+z*b[5],v=x*b[6]+y*b[7]+z*b[8];
    ok(Math.abs(m[0]*u+m[2]*v+m[4]-face.projected[i*2])<.0001&&
      Math.abs(m[1]*u+m[3]*v+m[5]-face.projected[i*2+1])<.0001,
      'the reusable local face path reconstructs the actual projected polygon');
   }
   if(face.kind==='roof'&&face.visible)for(let i=1;i<face.projected.length;i+=2)roofMaxY=Math.max(roofMaxY,face.projected[i]);
  }
  const depth=P('CityBuildings3D.depth(__cityFixture)');
  ok(depth>=fixture.y+fixture.h/2-1e-6&&depth>=roofMaxY-1e-6,'depth sorting includes the visible projected south eave');
  const before=P('CityBuildings3D.getDiagnostics()');
  for(let i=0;i<4;i++)P('CityBuildings3D.project(__cityFixture)');
  const after=P('CityBuildings3D.getDiagnostics()');
  ok(before.plans===after.plans&&before.projections===after.projections&&before.pathBuilds===after.pathBuilds,
   'idle camera reuses geometry, projected vertices and paths');
 }
}
for(const fixture of [{x:0,y:0,w:150,h:120,isHouse:true},{x:0,y:0,w:200,h:160,isGovFortress:true},
 {x:0,y:0,w:100,h:100,isBlockBuilding:true,cityArchitecture:14},
 {x:0,y:0,w:100,h:100,isBlockBuilding:true,cityArchitecture:21}]){
 ctx.__cityFixture=fixture;ok(P('CityBuildings3D.profile(__cityFixture)')===null,'special, already-authored or invalid buildings retain their existing painter');
}
ctx.__cityFixture={x:0,y:0,w:0,h:100,isBlockBuilding:true};
ok(P('CityBuildings3D.plan(__cityFixture)')===null,'an empty footprint cannot create invalid render geometry');
for(const biome of [2,3,8]){
 ctx.__cityFixture=buildings[0];probe(`currentLevel=currentBiome=${biome};`);
 ok(P('CityBuildings3D.profile(__cityFixture)')===null,'city Blender art does not replace another biome');
}
console.log(checks+' Blender city geometry, projection, eave depth, cache, scope and eight native placement/key checks passed');

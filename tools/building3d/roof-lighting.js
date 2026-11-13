// Native roof geometry, preprocessed in Blender, supplies cached height proxies.
// The world renderer still owns all lighting, shadow rays, art and collision.
const BuildingRoofLighting = (() => {
  'use strict';
  const cache=new WeakMap(),lean=[0,0];
  const stats={plans:0,planHits:0,blenderPlans:0,runtimePlans:0,invalidExports:0,
    draws:0,faces:0,edgeOn:0,gradients:0,flatFills:0,styleHits:0,pathBuilds:0};
  const quantization=10000,eps=1e-10;
  function geometryKey(b,mesh) {
    let hash=2166136261;
    const text=value=>{for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}};
    for(const face of mesh.faces) {
      for(const p of face.points)text(Math.round((p[0]-b.x)*quantization)+','+
        Math.round((p[1]-b.y)*quantization)+','+Math.round(p[2]*quantization)+';');
      text('|');
    }
    return 'roof-'+(hash>>>0).toString(16).padStart(8,'0');
  }
  function defaultAsset() {return typeof BUILDING3D_ROOF_ASSET!=='undefined'?BUILDING3D_ROOF_ASSET:null;}
  function validExport(model,b,mesh) {
    if(!model||!Array.isArray(model.faces)||model.faces.length!==mesh.faces.length)return false;
    for(let i=0;i<model.faces.length;i++) {
      const face=model.faces[i],points=mesh.faces[i].points,p=face.plane;
      if(!Array.isArray(face.points)||face.points.length!==points.length||!p||p.length!==4||
        !p.every(Number.isFinite)||Math.abs(Math.hypot(p[0],p[1],p[2])-1)>.001||
        !Number.isFinite(face.minZ)||!Number.isFinite(face.maxZ))return false;
      for(let j=0;j<points.length;j++) {
        const q=points[j],v=face.points[j];
        if(!v||v.length!==3||!v.every(Number.isFinite)||Math.abs(v[0]-(q[0]-b.x))>.0002||
          Math.abs(v[1]-(q[1]-b.y))>.0002||Math.abs(v[2]-q[2])>.0002||
          Math.abs(p[0]*(q[0]-b.x)+p[1]*(q[1]-b.y)+p[2]*q[2]+p[3])>.002)return false;
      }
    }
    return true;
  }
  function planeFrom(points) {
    const a=points[0];
    for(let i=1;i<points.length-1;i++) {
      const b=points[i],c=points[i+1],ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],
        vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
      const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx,length=Math.hypot(x,y,z);
      if(length>eps)return [x/length,y/length,z/length,-(x*a[0]+y*a[1]+z*a[2])/length];
    }
    return null;
  }
  function makeFace(points,plane,minZ,maxZ) {
    if(!plane)return null;
    const origin=points[0];let ux=0,uy=0,uz=0,length=0;
    for(let i=1;i<points.length&&length<eps;i++) {
      ux=points[i][0]-origin[0];uy=points[i][1]-origin[1];uz=points[i][2]-origin[2];length=Math.hypot(ux,uy,uz);
    }
    if(length<eps)return null;
    ux/=length;uy/=length;uz/=length;
    // V = N cross U. The exported plane supplies a stable surface basis for
    // validation and edge-on rejection under the live camera projection.
    const vx=plane[1]*uz-plane[2]*uy,vy=plane[2]*ux-plane[0]*uz,vz=plane[0]*uy-plane[1]*ux;
    const vertices=new Float64Array(points.length*2);
    for(let i=0;i<points.length;i++) {
      const p=points[i],x=p[0]-origin[0],y=p[1]-origin[1],z=p[2]-origin[2];
      const a=x*ux+y*uy+z*uz,b=x*vx+y*vy+z*vz;
      vertices[i*2]=a;vertices[i*2+1]=b;
    }
    const meanZ=points.reduce((sum,p)=>sum+p[2],0)/points.length;
    return {origin,plane,u:[ux,uy,uz],v:[vx,vy,vz],vertices,points,minZ,maxZ,meanZ,styles:new WeakMap(),projected:new Float64Array(points.length*2)};
  }
  function compilePlan(b,mesh,asset) {
    const key=geometryKey(b,mesh),model=asset&&asset.schema===1&&asset.quantization===quantization&&asset.models&&asset.models[key];
    const exported=validExport(model,b,mesh);if(model&&!exported)stats.invalidExports++;
    const faces=[];
    for(let i=0;i<mesh.faces.length;i++) {
      const points=mesh.faces[i].points.map(p=>[p[0]-b.x,p[1]-b.y,p[2]]);
      const ex=exported?model.faces[i]:null,plane=ex?ex.plane.slice():planeFrom(points);
      if(!plane)continue;
      if(ex){const length=Math.hypot(plane[0],plane[1],plane[2]);for(let j=0;j<4;j++)plane[j]/=length;}
      let minZ=Infinity,maxZ=-Infinity,coplanar=true;
      for(const p of points){minZ=Math.min(minZ,p[2]);maxZ=Math.max(maxZ,p[2]);
        if(Math.abs(plane[0]*p[0]+plane[1]*p[1]+plane[2]*p[2]+plane[3])>.002)coplanar=false;}
      // Procedural content can supply a non-planar polygon. Fan triangles retain
      // the native face's ordering and interpolate its real vertex heights.
      if(!coplanar)for(let j=1;j<points.length-1;j++) {
        const triangle=[points[0],points[j],points[j+1]],p=planeFrom(triangle);
        const face=makeFace(triangle,p,Math.min(triangle[0][2],triangle[1][2],triangle[2][2]),Math.max(triangle[0][2],triangle[1][2],triangle[2][2]));
        if(face)faces.push(face);
      }else {const face=makeFace(points,plane,minZ,maxZ);if(face)faces.push(face);}
    }
    stats.plans++;if(exported)stats.blenderPlans++;else stats.runtimePlans++;
    return {key,source:exported?'blender':'runtime',faces,mesh,x:b.x,y:b.y,asset};
  }
  function plan(b,mesh) {
    const asset=defaultAsset();let current=cache.get(mesh);
    if(current&&current.x===b.x&&current.y===b.y&&current.asset===asset){stats.planHits++;return current;}
    current=compilePlan(b,mesh,asset);cache.set(mesh,current);return current;
  }
  function projectedHeight(face,x,y,ux,uy,ground=0) {
    const p=face.plane,denominator=p[2]-p[0]*ux-p[1]*uy;
    return Math.abs(denominator)<eps?NaN:-(p[0]*x+p[1]*y+p[3])/denominator+ground;
  }
  function styleFor(ctx,face,ground,wet,origin,range) {
    let current=face.styles.get(ctx);
    if(current&&current.ground===ground&&current.wet===wet&&current.origin===origin&&current.range===range){stats.styleHits++;return current.value;}
    const gloss=(.13+.26*wet)*255;
    const byte=z=>Math.max(0,Math.min(255,(z-origin)*255/range));
    const color=z=>'rgb('+byte(z)+','+gloss+',0)';
    // Retain the established shadow proxy. Continuous ramps amplify sparse
    // sun-march sample gaps into bands; changing that shadow algorithm belongs
    // to its own measured change. Blender planes still provide exact cached
    // polygon projection through the moving camera, without p5 vertex work.
    const value=color(face.meanZ+ground);stats.flatFills++;
    face.styles.set(ctx,{ground,wet,origin,range,value});return value;
  }
  function draw(g,b,mesh,ux,uy,wet=0) {
    const ctx=g&&(g.drawingContext||g);
    if(!ctx||typeof ctx.createLinearGradient!=='function'||typeof ctx.transform!=='function'||typeof ctx.fill!=='function'||!mesh||!mesh.faces)return false;
    const current=plan(b,mesh);
    if(!Number.isFinite(ux)||!Number.isFinite(uy)) {
      if(typeof massLean!=='function')return false;
      massLean(b.x,b.y,1,lean);ux=lean[0];uy=lean[1];
    }
    const ground=typeof groundElev==='function'?groundElev(b.x,b.y):0;
    const origin=typeof glRigHeightOrigin==='function'?glRigHeightOrigin():0;
    const range=typeof glRigHeightRange==='function'?glRigHeightRange():200;
    if(!Number.isFinite(ground)||!Number.isFinite(origin)||!(range>0))return false;
    for(const face of current.faces) {
      const u=face.u,v=face.v,o=face.origin;
      const a=u[0]+ux*u[2],bb=u[1]+uy*u[2],c=v[0]+ux*v[2],d=v[1]+uy*v[2];
      if(Math.abs(a*d-bb*c)<eps){stats.edgeOn++;continue;}
      const style=styleFor(ctx,face,ground,wet,origin,range);
      if(face.lastUx!==ux||face.lastUy!==uy||face.lastX!==b.x||face.lastY!==b.y){
        // Keep projection in the native world coordinate frame. An additional
        // face-local Canvas transform changes subpixel edge rasterization,
        // which can become visible far away in the sparse shadow marcher.
        const p=face.projected;face.projectedPath=typeof Path2D==='function'?new Path2D():null;
        for(let i=0;i<face.points.length;i++){
          const q=face.points[i],x=b.x+q[0]+ux*q[2],y=b.y+q[1]+uy*q[2];p[i*2]=x;p[i*2+1]=y;
          if(face.projectedPath){if(i)face.projectedPath.lineTo(x,y);else face.projectedPath.moveTo(x,y);}
        }
        if(face.projectedPath){face.projectedPath.closePath();stats.pathBuilds++;}
        face.lastUx=ux;face.lastUy=uy;face.lastX=b.x;face.lastY=b.y;
      }
      ctx.save();
      try{
        ctx.fillStyle=style;
        if(face.projectedPath)ctx.fill(face.projectedPath);
        else {const p=face.projected;ctx.beginPath();ctx.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)ctx.lineTo(p[i],p[i+1]);ctx.closePath();ctx.fill();}
      }finally{ctx.restore();}
      stats.faces++;
    }
    stats.draws++;return true;
  }
  return {draw,plan,compilePlan,geometryKey,projectedHeight,stats,getDiagnostics:()=>({...stats})};
})();

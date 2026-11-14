// Blender roof solids share one footprint-anchored projection with their walls,
// lighting proxies and actor occlusion. No additional WebGL context is needed.
const CityBuildings3D = (() => {
  'use strict';
  const cache=new WeakMap(),lean=[0,0];
  const stats={plans:0,cacheHits:0,projections:0,projectionHits:0,pathBuilds:0,
    draws:0,faces:0,heightDraws:0,heightFaces:0};
  const asset=()=>typeof CITY3D_ASSET!=='undefined'?CITY3D_ASSET:null;
  function profile(b) {
    if(typeof currentLevel==='undefined'||currentLevel!==1||currentBiome!==1||!b||!b.isBlockBuilding||
        b.isGovFortress||b.isGiantBarrier||b.isHouse||b.isLandmark||b.isBuiltStructure||
        b.isTower||b.isBiomeProp||b.forestHuntingLodge||b.undergroundWall||b.hqWall)return null;
    const a=b.cityArchitecture;
    if(a===0||a===3)return 'quay_house';
    if(a===1)return 'quay_office';
    if(a===4)return 'quay_warehouse';
    if(a!==undefined)return null;
    return b.style===1||b.style===2?'quay_house':b.style===3?'quay_warehouse':'quay_office';
  }
  function normalOf(points) {
    const a=points[0];
    for(let i=1;i<points.length-1;i++) {
      const b=points[i],c=points[i+1],ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],
        vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
      const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx,n=Math.hypot(x,y,z);
      if(n>1e-9)return [x/n,y/n,z/n];
    }
    return null;
  }
  function face(points,material,kind,order=0) {
    const normal=normalOf(points);if(!normal)return null;
    const meanZ=points.reduce((z,p)=>z+p[2],0)/points.length;
    return {points,normal,material,kind,meanZ,order,projected:new Float64Array(points.length*2),
      visible:false,path:null,heightStyle:null};
  }
  function addFacadeFaces(plan,b) {
    const x0=b.x-b.w/2,x1=b.x+b.w/2,y0=b.y-b.h/2,y1=b.y+b.h/2,r=plan.rise;
    const storeys=plan.profile==='quay_warehouse'?1:Math.min(3,Math.max(2,b.cityStoreys||2));
    const canal=typeof cityHasCanal==='function'&&cityHasCanal(1,Math.floor(b.y/CHUNK_W));
    const front=canal?(b.y<cityCanalY(1,Math.floor(b.y/CHUNK_W),b.x)?1:-1):
      ((Math.abs(Math.floor(b.x/120)+Math.floor(b.y/120))%2)?1:-1);
    // Counter-clockwise in world XY/Z, with outward wall normals.
    for(const wall of [
      [x0,y0,x1,y0,b.w,0,-1],[x1,y1,x0,y1,b.w,0,1],
      [x0,y1,x0,y0,b.h,-1,0],[x1,y0,x1,y1,b.h,1,0]
    ]) {
      const [ax,ay,bx,by,len,nx,ny]=wall,bays=Math.max(2,Math.min(6,Math.floor(len/48)));
      const panel=(u,v,lo,hi,material)=>{
        const point=(t,z)=>[ax+(bx-ax)*t+nx*.035,ay+(by-ay)*t+ny*.035,z*r];
        const f=face([point(u,lo),point(v,lo),point(v,hi),point(u,hi)],material,'facade');
        if(f)plan.facadeFaces.push(f);
      };
      for(let floor=0;floor<storeys;floor++)for(let i=0;i<bays;i++) {
        const u=(i+.20)/bays,v=(i+.80)/bays,lo=(floor+.19)/storeys,hi=(floor+.75)/storeys;
        panel(u-.035/bays,v+.035/bays,lo-.045,hi+.035,'frame');
        panel(u,v,lo,hi,'window');
        panel(u+.025/bays,u+.11/bays,lo+.025,hi-.025,'window_highlight');
      }
      if(ny===front) {
        const half=plan.profile==='quay_warehouse'?.18:.065;
        panel(.5-half-.02,.5+half+.02,0,.59,'frame');
        panel(.5-half,.5+half,.025,.55,plan.profile==='quay_warehouse'?'shutter':'door');
        if(plan.profile==='quay_warehouse')for(const z of [.14,.25,.36,.47])
          panel(.5-half,.5+half,z,z+.018,'metal_dark');
        else panel(.5-half*.72,.5+half*.72,.25,.48,'window');
      }
    }
  }
  function plan(b) {
    const name=profile(b),data=asset(),model=data&&data.models&&data.models[name];
    if(!model||!(b.w>0)||!(b.h>0))return null;
    const rise=buildingRise(b),old=cache.get(b);
    if(old&&old.asset===data&&old.profile===name&&old.x===b.x&&old.y===b.y&&old.w===b.w&&
        old.h===b.h&&old.rise===rise&&old.style===b.style&&old.burnt===!!b.burnt){stats.cacheHits++;return old;}
    const current={asset:data,profile:name,x:b.x,y:b.y,w:b.w,h:b.h,rise,maxZ:rise+model.bounds[1][2],style:b.style,burnt:!!b.burnt,
      faces:[],roofFaces:[],bodyFaces:[],facadeFaces:[],bounds:[0,0,0,0],roofBounds:[0,0,0,0]};
    // A long house has its ridge along its long axis, rather than stretching a
    // short ridge across a whole tenement wing. Ground bounds remain identical.
    const turn=name==='quay_house'&&b.h>b.w*1.15;
    for(const part of model.parts)for(const source of part.faces) {
      const points=source.points.map(p=>[b.x+(turn?-p[1]:p[0])*b.w,b.y+(turn?p[0]:p[1])*b.h,rise+p[2]]);
      const f=face(points,source.material,'roof',part.order||0);if(f)current.roofFaces.push(f);
    }
    const x0=b.x-b.w/2,x1=b.x+b.w/2,y0=b.y-b.h/2,y1=b.y+b.h/2;
    for(const q of [
      [[x0,y0,0],[x1,y0,0],[x1,y0,rise],[x0,y0,rise]],
      [[x1,y1,0],[x0,y1,0],[x0,y1,rise],[x1,y1,rise]],
      [[x0,y1,0],[x0,y0,0],[x0,y0,rise],[x0,y1,rise]],
      [[x1,y0,0],[x1,y1,0],[x1,y1,rise],[x1,y0,rise]]
    ]){const f=face(q,'wall','wall');if(f)current.bodyFaces.push(f);}
    addFacadeFaces(current,b);
    // Painter order within a component is low-to-high; Blender's semantic part
    // order puts roof slopes before the dormers/equipment they support.
    current.roofFaces.sort((a,c)=>a.order-c.order||a.meanZ-c.meanZ);
    current.faces=current.bodyFaces.concat(current.facadeFaces,current.roofFaces);
    for(const f of current.faces){f.color=materialColor(current,f);CityProjectedFaces.prepare(f,stats);}
    cache.set(b,current);stats.plans++;return current;
  }
  function project(b) {
    const p=plan(b);if(!p)return null;
    massLean(b.x,b.y,1,lean);const ux=lean[0],uy=lean[1];
    if(p.ux===ux&&p.uy===uy){stats.projectionHits++;return p;}
    p.ux=ux;p.uy=uy;p.bounds[0]=p.bounds[1]=p.roofBounds[0]=p.roofBounds[1]=Infinity;
    p.bounds[2]=p.bounds[3]=p.roofBounds[2]=p.roofBounds[3]=-Infinity;
    for(const f of p.faces) {
      const q=f.projected;
      for(let i=0;i<f.points.length;i++) {
        const v=f.points[i],x=v[0]+ux*v[2],y=v[1]+uy*v[2];q[i*2]=x;q[i*2+1]=y;
        p.bounds[0]=Math.min(p.bounds[0],x);p.bounds[1]=Math.min(p.bounds[1],y);
        p.bounds[2]=Math.max(p.bounds[2],x);p.bounds[3]=Math.max(p.bounds[3],y);
        if(f.kind==='roof'){
          p.roofBounds[0]=Math.min(p.roofBounds[0],x);p.roofBounds[1]=Math.min(p.roofBounds[1],y);
          p.roofBounds[2]=Math.max(p.roofBounds[2],x);p.roofBounds[3]=Math.max(p.roofBounds[3],y);
        }
      }
      let area=0;for(let i=2;i<q.length-2;i+=2)
        area+=(q[i]-q[0])*(q[i+3]-q[1])-(q[i+1]-q[1])*(q[i+2]-q[0]);
      f.visible=area>1e-7;
      CityProjectedFaces.project(f,ux,uy);
    }
    stats.projections++;return p;
  }
  function materialColor(p,f) {
    const palette=p.asset.palette;
    if(f.material==='wall')return p.style===1?[151,92,70]:p.style===2?[190,180,155]:p.style===3?[96,118,127]:[164,174,171];
    if(f.material==='frame')return [57,66,65];
    if(f.material==='window')return [48,99,112];
    if(f.material==='window_highlight')return [146,192,190];
    if(f.material==='door')return [91,76,56];
    if(f.material==='shutter')return [120,141,144];
    if(p.profile==='quay_house'&&p.style===2&&f.material==='roof_tile')return [83,126,121];
    if(p.profile==='quay_house'&&p.style===2&&f.material==='roof_tile_dark')return [54,85,86];
    return palette[f.material]||[142,153,148];
  }
  function draw(b,g=window) {
    const p=project(b),ctx=g&&(g.drawingContext||g);
    if(!p||!ctx||typeof ctx.fill!=='function')return false;
    const dx=typeof LIGHT_DX==='number'?LIGHT_DX:.6,dy=typeof LIGHT_DY==='number'?LIGHT_DY:.8;
    const daylight=typeof sceneLightDaylight==='function'?sceneLightDaylight():1;
    const ambient=.76+Math.max(0,Math.min(1,daylight))*.06;
    const target=typeof ctx.getTransform==='function'?ctx.getTransform():null;
    ctx.save();
    try{
      const paint=f=>{
        if(!f.visible)return;
        const n=f.normal,c=f.color,diffuse=Math.max(0,(-n[0]*dx-n[1]*dy+n[2]*.9)/1.34536);
        let k=f.kind==='wall'?.53+.34*diffuse:ambient+.23*diffuse;
        if(p.burnt)k*=.38;
        const lit=f.kind==='facade'&&f.material==='window'&&daylight<.48&&Math.floor(f.meanZ+b.x+b.y)%4===0;
        const key=Math.round(k*512)+'|'+lit;
        if(f.colorKey!==key){f.colorKey=key;
          f.colorStyle=lit?'rgb(225,174,94)':'rgb('+Math.round(c[0]*k)+','+Math.round(c[1]*k)+','+Math.round(c[2]*k)+')';}
        ctx.fillStyle=f.colorStyle;
        CityProjectedFaces.fill(ctx,f,target);stats.faces++;
      };
      for(const f of p.bodyFaces)paint(f);
      for(const f of p.facadeFaces)paint(f);
      for(const f of p.roofFaces)paint(f);
    }finally{ctx.restore();}
    stats.draws++;return true;
  }
  function paintHeight(g,b,wet=0) {
    const p=project(b),ctx=g&&(g.drawingContext||g);if(!p||!ctx||typeof ctx.fill!=='function')return false;
    const ground=typeof groundElev==='function'?groundElev(b.x,b.y):0;
    const origin=typeof glRigHeightOrigin==='function'?glRigHeightOrigin():0;
    const range=typeof glRigHeightRange==='function'?glRigHeightRange():200;
    const target=typeof ctx.getTransform==='function'?ctx.getTransform():null;
    ctx.save();
    try{
      for(const f of p.faces){
        if(!f.visible||f.kind==='facade')continue;
        if(f.heightGround!==ground||f.heightWet!==wet||f.heightOrigin!==origin||f.heightRange!==range){
          const h=Math.max(0,Math.min(255,(ground+f.meanZ-origin)*255/range));
          const gloss=(f.material==='glass'?.30:.12)+.26*wet;
          f.heightStyle='rgb('+h+','+Math.min(255,gloss*255)+',0)';
          f.heightGround=ground;f.heightWet=wet;f.heightOrigin=origin;f.heightRange=range;
        }
        ctx.fillStyle=f.heightStyle;CityProjectedFaces.fill(ctx,f,target);stats.heightFaces++;
      }
    }finally{ctx.restore();}
    stats.heightDraws++;return true;
  }
  function depth(b) {
    const p=project(b);return p?Math.max(b.y+b.h/2,p.roofBounds[3]):b.y+(b.h||0)/2;
  }
  return {profile,plan,project,draw,paintHeight,depth,stats,getDiagnostics(){return {...stats};}};
})();

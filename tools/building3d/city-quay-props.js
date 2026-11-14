// Grounded quayside hardware. Local rotation precedes the shared world lean;
// each vertex keeps its own height instead of lifting the entire prop sprite.
const CityQuayProps3D = (() => {
  'use strict';
  const cache=new WeakMap(),lean=[0,0];
  const stats={plans:0,cacheHits:0,projections:0,projectionHits:0,pathBuilds:0,
    draws:0,faces:0,heightDraws:0,heightFaces:0};
  const palette={steel:[74,84,85],ring:[108,115,109],yellow:[205,157,43],
    glass:[49,103,116],cable:[33,39,40],trim:[157,159,141],hold:[38,47,44],
    tarp:[112,119,79],rust:[136,80,43],cabin:[119,132,124]};
  function canDraw(b) {
    return typeof currentLevel!=='undefined'&&currentLevel===1&&currentBiome===1&&!!b&&b.isBiomeProp&&
      (b.propType==='QUAYCRANE'||b.propType==='BARGE')&&b.w>0&&b.h>0&&Number.isFinite(b.x)&&Number.isFinite(b.y);
  }
  function plan(b) {
    if(!canDraw(b))return null;
    const angle=Number(b.angle)||0,tint=Number(b.tint)||0,old=cache.get(b);
    if(old&&old.x===b.x&&old.y===b.y&&old.w===b.w&&old.h===b.h&&old.angle===angle&&old.tint===tint&&old.type===b.propType){
      stats.cacheHits++;return old;
    }
    const ca=Math.cos(angle),sa=Math.sin(angle),p={x:b.x,y:b.y,w:b.w,h:b.h,angle,tint,type:b.propType,
      faces:[],bounds:[0,0,0,0],groundPoints:null};
    const add=(points,material)=>{
      points=points.filter((q,i)=>!i||q.some((n,k)=>n!==points[i-1][k]));
      if(points.length>2&&points[0].every((n,k)=>n===points[points.length-1][k]))points.pop();
      if(points.length<3)return;
      points=points.map(q=>[b.x+q[0]*ca-q[1]*sa,b.y+q[0]*sa+q[1]*ca,q[2]]);
      const a=points[0],u=points[1].map((v,i)=>v-a[i]);let normal=null;
      for(let j=2;j<points.length&&!normal;j++){
        const v=points[j].map((n,i)=>n-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);
        if(l>1e-8)normal=n.map(v=>v/l);
      }
      if(!normal)return;
      p.faces.push({points,normal,material,color:palette[material]||[60+tint*32,78+tint*20,76+tint*17],
        meanZ:points.reduce((sum,v)=>sum+v[2],0)/points.length,projected:new Float64Array(points.length*2)});
    };
    const box=(x0,y0,x1,y1,z0,z1,mat)=>{
      add([[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],mat);
      add([[x1,y1,z0],[x0,y1,z0],[x0,y1,z1],[x1,y1,z1]],mat);
      add([[x0,y1,z0],[x0,y0,z0],[x0,y0,z1],[x0,y1,z1]],mat);
      add([[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]],mat);
      add([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],mat);
    };
    const ring=(radius,z0,z1,mat)=>{
      const q=Array.from({length:8},(_,i)=>[Math.cos(i*Math.PI/4)*radius,Math.sin(i*Math.PI/4)*radius]);
      for(let i=0;i<8;i++){const a=q[i],c=q[(i+1)%8];add([[...a,z0],[...c,z0],[...c,z1],[...a,z1]],mat);}
      add(q.map(v=>[...v,z1]),mat);return q;
    };
    if(b.propType==='QUAYCRANE') {
      const scale=Math.min(b.w,b.h)/58;
      p.groundPoints=ring(28*scale,0,3,'steel');ring(20*scale,3,5,'ring');
      box(-6,-6,6,6,5,25,'yellow');box(-11,-12,12,10,18,30,'yellow');
      box(-30,-12,-11,12,20,27,'steel');
      for(const y of [-8,4])box(10,y,106,y+4,27,31,'yellow');
      for(let i=0;i<6;i++){
        const x=14+i*14,ya=i%2?6:-6,yb=-ya,dx=11,dy=yb-ya,l=Math.hypot(dx,dy),nx=-dy/l,ny=dx/l;
        const a=[x+nx,ya+ny],c=[x+dx+nx,yb+ny],d=[x+dx-nx,yb-ny],e=[x-nx,ya-ny];
        for(const [v,w]of[[e,d],[d,c],[c,a],[a,e]])add([[...v,29],[...w,29],[...w,31],[...v,31]],'yellow');
        add([[...e,31],[...d,31],[...c,31],[...a,31]],'yellow');
      }
      add([[-9,-12.04,22],[10,-12.04,22],[10,-12.04,28],[-9,-12.04,28]],'glass');
      add([[12.04,-10,22],[12.04,8,22],[12.04,8,28],[12.04,-10,28]],'glass');
      add([[-9,10.04,28],[10,10.04,28],[10,10.04,22],[-9,10.04,22]],'glass');
      // Crossed thin cable planes remain visible as the camera crosses the jib.
      add([[99.4,0,11],[100.6,0,11],[100.6,0,29],[99.4,0,29]],'cable');
      add([[99.4,0,29],[100.6,0,29],[100.6,0,11],[99.4,0,11]],'cable');
      add([[100,-.6,29],[100,.6,29],[100,.6,11],[100,-.6,11]],'cable');
      add([[100,-.6,11],[100,.6,11],[100,.6,29],[100,-.6,29]],'cable');
      box(96,-4,104,4,9,13,'steel');
      add([[99,-2,7],[103,-2,7],[103,-2,10],[101,-2,10],[101,-2,8],[99,-2,8]],'cable');
    } else {
      const hw=b.w/2,hh=b.h/2,outline=(inset)=>[
        [-hw+8+inset,-hh+inset],[hw-8-inset,-hh+inset],[hw-inset,-hh+8+inset],[hw-inset,hh-8-inset],
        [hw-8-inset,hh-inset],[-hw+8+inset,hh-inset],[-hw+inset,hh-8-inset],[-hw+inset,-hh+8+inset]];
      const outer=outline(0),inner=outline(3.5);p.groundPoints=outer;
      const hx0=-hw+24,hx1=hw-53,hy0=-hh+11,hy1=hh-11;
      const hole=[[hx0,hy0],[hx1,hy0],[hx1,hy0],[hx1,hy1],[hx1,hy1],[hx0,hy1],[hx0,hy1],[hx0,hy0]];
      for(let i=0;i<8;i++){
        const j=(i+1)%8,a=outer[i],c=outer[j],d=inner[j],e=inner[i];
        add([[...a,0],[...c,0],[...c,4],[...a,4]],'hull');
        add([[...a,4],[...c,4],[...c,7],[...a,7]],'steel');
        add([[...d,4],[...e,4],[...e,7],[...d,7]],'steel');
        add([[...a,7],[...c,7],[...d,7],[...e,7]],'trim');
        add([[...e,4],[...d,4],[...hole[j],4],[...hole[i],4]],'hull');
      }
      add([[hx0,hy0,1],[hx1,hy0,1],[hx1,hy1,1],[hx0,hy1,1]],'hold');
      const corners=[[hx0,hy0],[hx1,hy0],[hx1,hy1],[hx0,hy1]];
      for(let i=0;i<4;i++){const a=corners[i],c=corners[(i+1)%4];add([[...c,1],[...a,1],[...a,4],[...c,4]],'steel');}
      box(hx0+5,hy0+4,hx1-4,hy1-4,1,3,'tarp');
      box(hw-46,-hh+10,hw-14,hh-10,4,10,'cabin');
      add([[hw-46.04,hh-14,6],[hw-46.04,-hh+14,6],[hw-46.04,-hh+14,9],[hw-46.04,hh-14,9]],'glass');
      add([[hw-42,-hh+9.96,6],[hw-18,-hh+9.96,6],[hw-18,-hh+9.96,9],[hw-42,-hh+9.96,9]],'glass');
      add([[hw-42,hh-9.96,9],[hw-18,hh-9.96,9],[hw-18,hh-9.96,6],[hw-42,hh-9.96,6]],'glass');
      for(const t of [.3,.7]){const x=hx0+(hx1-hx0)*t;add([[x-1,hy0+4,3.02],[x+1,hy0+4,3.02],[x+1,hy1-4,3.02],[x-1,hy1-4,3.02]],'trim');}
      for(const t of [.22,.50,.76]){const x=-hw+b.w*t;add([[x,hh+.025,3.8],[x+4,hh+.025,3.8],[x+4,hh+.025,.8],[x,hh+.025,.8]],'rust');}
    }
    p.faces.sort((a,c)=>a.meanZ-c.meanZ);
    for(const f of p.faces)CityProjectedFaces.prepare(f,stats);
    cache.set(b,p);stats.plans++;return p;
  }
  function project(b) {
    const p=plan(b);if(!p)return null;massLean(b.x,b.y,1,lean);
    if(p.ux===lean[0]&&p.uy===lean[1]){stats.projectionHits++;return p;}
    p.ux=lean[0];p.uy=lean[1];p.bounds[0]=p.bounds[1]=Infinity;p.bounds[2]=p.bounds[3]=-Infinity;
    for(const f of p.faces){
      const q=f.projected;for(let i=0;i<f.points.length;i++){
        const v=f.points[i],x=v[0]+p.ux*v[2],y=v[1]+p.uy*v[2];q[i*2]=x;q[i*2+1]=y;
        p.bounds[0]=Math.min(p.bounds[0],x);p.bounds[1]=Math.min(p.bounds[1],y);p.bounds[2]=Math.max(p.bounds[2],x);p.bounds[3]=Math.max(p.bounds[3],y);
      }
      let area=0;for(let i=2;i<q.length-2;i+=2)area+=(q[i]-q[0])*(q[i+3]-q[1])-(q[i+1]-q[1])*(q[i+2]-q[0]);
      f.visible=area>1e-7;CityProjectedFaces.project(f,p.ux,p.uy);
    }
    stats.projections++;return p;
  }
  function draw(b,g=window) {
    const p=project(b),ctx=g&&(g.drawingContext||g);if(!p||!ctx||typeof ctx.fill!=='function')return false;
    const dx=typeof LIGHT_DX==='number'?LIGHT_DX:.6,dy=typeof LIGHT_DY==='number'?LIGHT_DY:.8;
    const target=typeof ctx.getTransform==='function'?ctx.getTransform():null;
    ctx.save();try{for(const f of p.faces){if(!f.visible)continue;
      const n=f.normal,c=f.color,k=.68+.35*Math.max(0,(-n[0]*dx-n[1]*dy+n[2]*.9)/1.34536),key=Math.round(k*512);
      if(f.colorKey!==key){f.colorKey=key;f.colorStyle='rgb('+Math.round(c[0]*k)+','+Math.round(c[1]*k)+','+Math.round(c[2]*k)+')';}
      ctx.fillStyle=f.colorStyle;CityProjectedFaces.fill(ctx,f,target);stats.faces++;
    }}finally{ctx.restore();}stats.draws++;return true;
  }
  function paintHeight(g,b,wet=0) {
    const p=project(b),ctx=g&&(g.drawingContext||g);if(!p||!ctx||typeof ctx.fill!=='function')return false;
    const ground=typeof groundElev==='function'?groundElev(b.x,b.y):0,origin=typeof glRigHeightOrigin==='function'?glRigHeightOrigin():0,
      range=typeof glRigHeightRange==='function'?glRigHeightRange():200;
    const target=typeof ctx.getTransform==='function'?ctx.getTransform():null;
    const key=ground+'|'+origin+'|'+range+'|'+wet;
    ctx.save();try{for(const f of p.faces){if(!f.visible)continue;
      if(f.heightKey!==key){f.heightKey=key;f.heightStyle='rgb('+Math.max(0,Math.min(255,(ground+f.meanZ-origin)*255/range))+','+Math.min(255,(.20+.30*wet)*255)+',0)';}
      ctx.fillStyle=f.heightStyle;CityProjectedFaces.fill(ctx,f,target);stats.heightFaces++;
    }}finally{ctx.restore();}stats.heightDraws++;return true;
  }
  function depth(b){const p=project(b);return p?Math.max(b.y+(b.h||0)/2,p.bounds[3]):b.y+(b.h||0)/2;}
  return {canDraw,draw,paintHeight,depth,plan,project,stats};
})();

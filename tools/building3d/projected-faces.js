// Cache a face in its own plane once. The live camera changes six affine
// coefficients, rather than allocating a new Path2D for every face on a pan.
const CityProjectedFaces = (() => {
  'use strict';
  function prepare(face,stats) {
    const o=face.points[0],n=face.normal;
    let ux=0,uy=0,uz=0,length=0;
    for(let i=1;i<face.points.length&&length<1e-9;i++){
      const p=face.points[i];ux=p[0]-o[0];uy=p[1]-o[1];uz=p[2]-o[2];length=Math.hypot(ux,uy,uz);
    }
    if(length<1e-9)return;
    ux/=length;uy/=length;uz/=length;
    const vx=n[1]*uz-n[2]*uy,vy=n[2]*ux-n[0]*uz,vz=n[0]*uy-n[1]*ux;
    face.basis=new Float64Array([o[0],o[1],o[2],ux,uy,uz,vx,vy,vz]);
    face.affine=new Float64Array(6);
    if(typeof Path2D==='function'){
      face.path=new Path2D();
      for(let i=0;i<face.points.length;i++){
        const p=face.points[i],x=p[0]-o[0],y=p[1]-o[1],z=p[2]-o[2];
        const a=x*ux+y*uy+z*uz,b=x*vx+y*vy+z*vz;
        if(i)face.path.lineTo(a,b);else face.path.moveTo(a,b);
      }
      face.path.closePath();stats.pathBuilds++;
    }
  }
  function project(face,ux,uy) {
    const b=face.basis,a=face.affine;if(!b||!a)return;
    a[0]=b[3]+ux*b[5];a[1]=b[4]+uy*b[5];
    a[2]=b[6]+ux*b[8];a[3]=b[7]+uy*b[8];
    a[4]=b[0]+ux*b[2];a[5]=b[1]+uy*b[2];
  }
  function fill(ctx,face,target) {
    if(face.path&&target&&typeof ctx.setTransform==='function'){
      const a=face.affine;
      // Compose with the original target transform on every face; the context
      // currently carries the preceding face's transform, not the world one.
      ctx.setTransform(target.a*a[0]+target.c*a[1],target.b*a[0]+target.d*a[1],
        target.a*a[2]+target.c*a[3],target.b*a[2]+target.d*a[3],
        target.a*a[4]+target.c*a[5]+target.e,target.b*a[4]+target.d*a[5]+target.f);
      ctx.fill(face.path);return;
    }
    const q=face.projected;ctx.beginPath();ctx.moveTo(q[0],q[1]);
    for(let i=2;i<q.length;i+=2)ctx.lineTo(q[i],q[i+1]);ctx.closePath();ctx.fill();
  }
  return {prepare,project,fill};
})();

// A shared pinhole view for meshes and their Canvas attachments. Coordinates
// are in the target context's local frame; the principal point uses backing
// pixels, so pixel density never changes the logical camera angle.
const Player3DView = (() => {
  'use strict';
  const orthographic=Object.freeze({enabled:false,offsetX:0,offsetY:0,height:Infinity,invH:0,pivotZ:0,scale:1});
  const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;

  function resolve(target,options={},maxZ=0) {
    options=options||{};
    const setting=options.view;
    if(setting!==true&&(!setting||typeof setting!=='object'||Array.isArray(setting)))return orthographic;
    const explicit=setting===true?null:setting;
    if(explicit&&explicit.enabled===false)return orthographic;
    const context=target&&(target.drawingContext||target),canvas=context&&context.canvas;
    // A p5.Graphics stamp has a different coordinate system and lifetime. It
    // needs an explicit camera descriptor before it can use the world view.
    if(!explicit&&(typeof drawingContext==='undefined'||!drawingContext||!canvas||canvas!==drawingContext.canvas))return orthographic;
    let matrix=null;
    try{if(context&&typeof context.getTransform==='function')matrix=context.getTransform();}catch(_){}
    const valid=matrix&&['a','b','c','d','e','f'].every(key=>Number.isFinite(matrix[key]));
    const determinant=valid?matrix.a*matrix.d-matrix.b*matrix.c:0;
    const invertible=Number.isFinite(determinant)&&Math.abs(determinant)>1e-12;
    const scale=invertible?Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d)):1;
    const vw=finite(explicit&&explicit.viewportWidth,finite(canvas&&canvas.width,0));
    const vh=finite(explicit&&explicit.viewportHeight,finite(canvas&&canvas.height,0));
    const manual=explicit&&Number.isFinite(explicit.offsetX)&&Number.isFinite(explicit.offsetY)&&Number.isFinite(explicit.height)&&explicit.height>0;
    if(!manual&&(!invertible||!(vw>0)||!(vh>0)))return orthographic;
    const principalX=finite(explicit&&explicit.principalX,vw*.5);
    const principalY=finite(explicit&&explicit.principalY,vh*.5);
    // inverse(A)*(translation-principal): the actor's displacement from the
    // optical axis expressed in the same units as its XYZ mesh positions.
    const dx=invertible?matrix.e-principalX:0,dy=invertible?matrix.f-principalY:0;
    const offsetX=finite(explicit&&explicit.offsetX,invertible?(matrix.d*dx-matrix.c*dy)/determinant:0);
    const offsetY=finite(explicit&&explicit.offsetY,invertible?(-matrix.b*dx+matrix.a*dy)/determinant:0);
    const pivotZ=finite(explicit&&explicit.pivotZ,0);
    // At ordinary zoom the longest viewport axis subtends about 58 degrees.
    // Keep the eye well beyond raised limbs, rather than bending individual
    // vertices by clamping their projective denominator.
    let height=finite(explicit&&explicit.height,.9*Math.max(vw,vh)/scale);
    let actorScale=finite(explicit&&explicit.actorScale,1);
    if(!(explicit&&Number.isFinite(explicit.actorScale))&&canvas&&typeof drawingContext!=='undefined'&&drawingContext&&canvas===drawingContext.canvas&&
       typeof width==='number'&&width>0&&typeof zoom==='number'&&zoom>0) {
      const density=canvas.width/width;
      if(density>0)actorScale=scale/(density*zoom);
    }
    if(!(actorScale>0))actorScale=1;
    height=Math.max(height,256/actorScale,finite(maxZ,0)-pivotZ+128);
    if(!(height>0)||!Number.isFinite(height)||!Number.isFinite(offsetX)||!Number.isFinite(offsetY))return orthographic;
    return {enabled:true,offsetX,offsetY,height,invH:1/height,pivotZ,scale,actorScale,principalX,principalY};
  }

  function projectXYZ(x,y,z,view,out) {
    out=out||{};
    if(view&&view.enabled) {
      const t=(z-view.pivotZ)*view.invH,w=1-t;
      out.x=(x+view.offsetX*t)/w;out.y=(y+view.offsetY*t)/w;out.w=w;
    }else {out.x=x;out.y=y;out.w=1;}
    out.z=z;return out;
  }

  function project(point,view,out) {
    return projectXYZ(finite(point&&point.x,0),finite(point&&point.y,0),finite(point&&point.z,0),view,out);
  }

  // Convenience for a world-space Canvas context, before actor translations.
  // Resolve once and call projectXYZ directly when drawing a repeated path.
  function worldPoint(point,context,options={view:true},out) {
    return project(point,resolve(context,options,finite(options&&options.maxZ,finite(point&&point.z,0))),out);
  }
  return {resolve,project,projectXYZ,worldPoint};
})();

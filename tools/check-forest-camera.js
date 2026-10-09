// A camera pan must translate elevated foliage, never turn its outline.
// Capture actual painter vertices in each crown helper's local frame. A check
// for rotate() would miss the previous bug: camera-dependent ax/ay coordinates
// spun the trees without calling rotate at all.
const assert = require('assert');
const { probe } = require('./harness');
let checks = 0;
const ok = (value, message) => { checks++; assert(value, message); };
const P = text => probe('(' + text + ')');
const near = (a, b) => Math.abs(a - b) < 1e-7;
const samePaths = (a,b) => a.length===b.length&&a.every((path,i)=>
  path.length===b[i].length&&path.every((point,j)=>
    near(point[0],b[i][j][0])&&near(point[1],b[i][j][1])));

probe(`
  BIOME_ACTIVE=true; currentLevel=currentBiome=2;
  width=900; height=500; zoom=.66;
  shadowDensity=function(){return 1;}; shadowLengthScale=function(){return 1;};
  glRigOwnsSunShadows=function(){return true;};
  LIGHT_DX=.6; LIGHT_DY=.8;
  forestPolygonPainter=function(g){return g;};
  __forestCameraHelpers=[]; __forestCameraCapture=null;
  __forestCameraStack=[]; __forestCameraOrigin=[0,0]; __forestCameraBasis=[1,0,0,1];
  __forestCameraLines=[]; __forestCameraRoot=[];
  push=function(){__forestCameraStack.push([__forestCameraOrigin.slice(),__forestCameraBasis.slice()]);};
  pop=function(){const saved=__forestCameraStack.pop();__forestCameraOrigin=saved[0];__forestCameraBasis=saved[1];};
  translate=function(x,y){
    if(!__forestCameraRoot.length)__forestCameraRoot=[x,y];
    const b=__forestCameraBasis;
    __forestCameraOrigin[0]+=b[0]*x+b[2]*y;__forestCameraOrigin[1]+=b[1]*x+b[3]*y;
  };
  rotate=function(angle){
    if(__forestCameraCapture) __forestCameraCapture.rotations.push(angle);
    const b=__forestCameraBasis,c=Math.cos(angle),s=Math.sin(angle);
    __forestCameraBasis=[b[0]*c+b[2]*s,b[1]*c+b[3]*s,-b[0]*s+b[2]*c,-b[1]*s+b[3]*c];
  };
  scale=function(x,y){const b=__forestCameraBasis;if(y===undefined)y=x;
    __forestCameraBasis=[b[0]*x,b[1]*x,b[2]*y,b[3]*y];};
  beginShape=function(){if(__forestCameraCapture)__forestCameraCapture.paths.push([]);};
  vertex=function(x,y){
    if(__forestCameraCapture){
      const paths=__forestCameraCapture.paths;
      const b=__forestCameraBasis,o=__forestCameraOrigin,c=__forestCameraCapture.origin;
      if(paths.length)paths[paths.length-1].push([b[0]*x+b[2]*y+o[0]-c[0],b[1]*x+b[3]*y+o[1]-c[1]]);
    }
  };
  endShape=function(){};
  line=function(x0,y0,x1,y1){const b=__forestCameraBasis,dx=x1-x0,dy=y1-y0;
    __forestCameraLines.push([b[0]*dx+b[2]*dy,b[1]*dx+b[3]*dy]);};
  // Both generations of the painter are instrumented. The old evergreen
  // helper consequently reaches the same assertion and fails it, rather than
  // failing just because the replacement function name does not exist.
  function forestCameraWrap(name,fn){return function(){
    const previous=__forestCameraCapture;
    const captured={name,origin:__forestCameraOrigin.slice(),paths:[],rotations:[]};
    __forestCameraCapture=captured;
    try{return fn.apply(this,arguments);}finally{
      __forestCameraCapture=previous;__forestCameraHelpers.push(captured);
    }
  };}
  if(typeof forestTreeCrown==='function')forestTreeCrown=forestCameraWrap('crown',forestTreeCrown);
  if(typeof forestTreeBough==='function')forestTreeBough=forestCameraWrap('bough',forestTreeBough);
  if(typeof forestTreeBoughFacet==='function')forestTreeBoughFacet=forestCameraWrap('bough facet',forestTreeBoughFacet);
  if(typeof forestCrownPath==='function')forestCrownPath=forestCameraWrap('broadleaf',forestCrownPath);
  if(typeof forestEvergreenTier==='function')forestEvergreenTier=forestCameraWrap('evergreen',forestEvergreenTier);
  function forestCameraPaint(d,nx,ny){
    const hw=width/zoom*.5,hh=height/zoom*.5;
    camX=d.x-hw*(1+nx);camY=d.y-hh*(1+ny);
    __forestCameraHelpers=[];__forestCameraLines=[];__forestCameraRoot=[];
    __forestCameraStack=[];__forestCameraOrigin=[0,0];__forestCameraBasis=[1,0,0,1];
    const before=JSON.stringify(d);
    paintForestClutter(window,d,100);
    const mass=forestCanopyMass(d),lean=massLean(d.x,d.y,mass[0]*(d.s||1),[0,0]);
    return {helpers:__forestCameraHelpers,lines:__forestCameraLines,
      root:__forestCameraRoot,lean,balanced:__forestCameraStack.length===0,
      untouched:before===JSON.stringify(d)};
  }
`);

const species = P('Object.keys(FOREST_PROPS).filter(s=>FOREST_PROPS[s].canopyMass)');
// At this y, massLean's parallax cancels the camera tilt. The old normalized
// axis flips 180 degrees when x passes through zero, despite smooth translation.
const flipY = -P('MASS_TILT/MASS_LEAN');
const positions = [[-.02,flipY],[0,flipY],[.02,flipY],[-.65,-.4],[.65,.4],[0,0]];
for (const name of species) for (const scale of [.65,1,1.9]) for (const crown of [.3,1]) {
  const d = {t:name==='RED_ALDER'?'TREE':name==='CHARRED_SNAG'?'SNAG':'PINE',
    x:300,y:600,s:scale,r:.47,c:.61,forestSpecies:name,
    forestRegion:'TIMBER',forestCrownScale:crown};
  const frames = positions.map(([nx,ny]) => P(`forestCameraPaint(${JSON.stringify(d)},${nx},${ny})`));
  const first = frames[0];
  ok(name==='CHARRED_SNAG'||first.helpers.length>0, `${name}: actual foliage helper was exercised`);
  for (let f=0;f<frames.length;f++) {
    const frame=frames[f];
    ok(frame.root[0]===d.x&&frame.root[1]===d.y, `${name}: camera ${f} keeps the ground root fixed`);
    ok(frame.balanced&&frame.untouched, `${name}: camera ${f} balances transforms and preserves prop metadata`);
    ok(frame.helpers.length===first.helpers.length, `${name}: camera ${f} retains its canopy layers`);
    for (let i=0;i<first.helpers.length;i++) {
      const base=first.helpers[i],current=frame.helpers[i];
      ok(current.name===base.name&&samePaths(current.paths,base.paths)&&
        JSON.stringify(current.rotations)===JSON.stringify(base.rotations),
        `${name}: crown layer ${i} local geometry stays fixed at camera ${f}`);
    }
    if(name==='CHARRED_SNAG') {
      ok(frame.lines.length===first.lines.length&&frame.lines.every((v,i)=>
        near(v[0],first.lines[i][0])&&near(v[1],first.lines[i][1])),
        `${name}: camera ${f} translates broken limbs without turning them`);
    }
  }
  // Projected layer origins must interpolate through the old axis flip.
  // This checks the height cue still exists, rather than accepting static art.
  if(first.helpers.length) {
    let moved=false;
    for(let i=0;i<first.helpers.length;i++) {
      const a=frames[0].helpers[i].origin,m=frames[1].helpers[i].origin,b=frames[2].helpers[i].origin;
      ok(near(m[0],(a[0]+b[0])*.5)&&near(m[1],(a[1]+b[1])*.5),
        `${name}: canopy layer ${i} translates continuously across the old spin boundary`);
      moved=moved||Math.hypot(b[0]-a[0],b[1]-a[1])>.01;
    }
    ok(moved,`${name}: elevated canopy layers still carry camera depth`);
  }
  ok(near(frames[1].lean[0],(frames[0].lean[0]+frames[2].lean[0])*.5)&&
    near(frames[1].lean[1],(frames[0].lean[1]+frames[2].lean[1])*.5),
    `${name}: shared mass projection is continuous`);
}
console.log(`Forest camera: ${checks}/${checks} checks passed`);

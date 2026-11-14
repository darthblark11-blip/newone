// Taller crowns must expose actual wood without moving saved ground contacts.
// Record the production painters and height profiles, not replacement geometry.
const assert=require('node:assert/strict');
const {probe}=require('./harness');
const P=code=>probe('('+code+')');
let checks=0;
function ok(label,value){assert(value,label);checks++;}
probe(`BIOME_ACTIVE=true;currentBiome=currentLevel=2;worldTimeMs=DAY_MS/2;isRaining=false;updateSunVector();
 width=900;height=600;zoom=.66;groundElev=function(){return 0;};
 activeBuildings=[];activeParkingCars=[];enemiesList=[];allies=[];player=null;
 forestPolygonPainter=function(g){return g;};glRigOwnsSunShadows=function(){return true;};
 __tallPart='ground';__tallPoints={};__tallFaces=0;__tallMatrix=[1,0,0,1,0,0];__tallStack=[];
 push=function(){__tallStack.push(__tallMatrix.slice());};pop=function(){__tallMatrix=__tallStack.pop();};
 translate=function(x,y){const m=__tallMatrix;m[4]+=m[0]*x+m[2]*y;m[5]+=m[1]*x+m[3]*y;};
 scale=function(x,y=x){const m=__tallMatrix;m[0]*=x;m[1]*=x;m[2]*=y;m[3]*=y;};
 rotate=function(a){const m=__tallMatrix,c=Math.cos(a),s=Math.sin(a),x=m[0],y=m[1];
   m[0]=x*c+m[2]*s;m[1]=y*c+m[3]*s;m[2]=m[2]*c-x*s;m[3]=m[3]*c-y*s;};
 function tallPoint(x,y){const m=__tallMatrix,p=__tallPoints[__tallPart]||(__tallPoints[__tallPart]=[]);
   p.push([m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);}
 vertex=tallPoint;quad=function(){if(__tallPart==='bole')__tallFaces++;for(let i=0;i<8;i+=2)tallPoint(arguments[i],arguments[i+1]);};
 line=function(x,y,u,v){tallPoint(x,y);tallPoint(u,v);};
 function tallTag(part,fn){return function(){const before=__tallPart;__tallPart=part;try{return fn.apply(this,arguments);}finally{__tallPart=before;}};}
 paintForestTreeBole=tallTag('bole',paintForestTreeBole);
 forestTreeCrown=tallTag('crown',forestTreeCrown);
 forestTreeBough=tallTag('crown',forestTreeBough);
 forestTreeBoughFacet=tallTag('crown',forestTreeBoughFacet);
 function tallSample(d,nx,ny){
   camX=d.x-width/zoom*.5*(1+nx);camY=d.y-height/zoom*.5*(1+ny);
   __tallPoints={};__tallFaces=0;__tallMatrix=[1,0,0,1,0,0];__tallStack=[];
   const before=JSON.stringify(d);paintForestClutter(window,d,100);
   const cp=forestCanopyMass(d),lean=massLean(d.x,d.y,cp[0]*(d.s||1),[0,0]);
   return {points:__tallPoints,faces:__tallFaces,lean,balanced:__tallStack.length===0,
     untouched:before===JSON.stringify(d)};
 }
`);
const oldRise={DOUGLAS_FIR:34,WESTERN_CEDAR:36,SITKA_SPRUCE:32,RED_ALDER:28,LODGEPOLE_PINE:30,CHARRED_SNAG:30};
for(const [species,previous]of Object.entries(oldRise)) {
  const profile=P('FOREST_PROPS['+JSON.stringify(species)+']');
  ok(species+' has a genuinely taller mature structure',profile.canopyMass[0]>=previous*2.5);
  const d={t:species==='RED_ALDER'?'TREE':species==='CHARRED_SNAG'?'SNAG':'PINE',
    forestSpecies:species,forestRegion:'TIMBER',x:420,y:380,s:1.5,r:.61,c:.71};
  probe('__tallTree='+JSON.stringify(d)+';__wood=forestTreeTrunkPlan(__tallTree,FOREST_PROPS[__tallTree.forestSpecies].trunkWidth*__tallTree.s);__woodPoints=__wood.points;__woodNormals=__wood.normals;__woodSignature=JSON.stringify(Array.from(__woodPoints));');
  for(const [nx,ny]of [[0,0],[-.65,-.25],[.65,.25],[.85,-.35]]) {
    const sample=P('tallSample(__tallTree,'+nx+','+ny+')');
    const bole=sample.points.bole||[],crown=sample.points.crown||[];
    ok(species+' paints volumetric bark faces at camera '+nx+','+ny,sample.faces>=6);
    ok(species+' keeps its root record and transforms intact',sample.balanced&&sample.untouched);
    ok(species+' retains a rooted flare',bole.filter(p=>Math.hypot(p[0]-d.x,p[1]-d.y)<profile.trunkWidth*d.s*1.2).length>=4);
    const length=Math.hypot(...sample.lean),u=sample.lean.map(v=>v/(length||1));
    const project=p=>(p[0]-d.x)*u[0]+(p[1]-d.y)*u[1];
    ok(species+' wood reaches continuously into the raised crown',Math.max(...bole.map(project))>=length*.9);
    if(species!=='CHARRED_SNAG') {
      ok(species+' crowns are separate from ground brush at camera '+nx+','+ny,
        crown.length>0&&Math.min(...crown.map(project))>=profile.trunkWidth*d.s*.7);
      const pad=P('forestPropCullPad(__tallTree)');
      ok(species+' visibility bounds cover all raised crown points',crown.every(p=>Math.abs(p[0]-d.x)<=pad&&Math.abs(p[1]-d.y)<=pad));
    }
    probe('worldTimeMs+=DAY_MS/12;isRaining=!isRaining;updateSunVector();tallSample(__tallTree,'+nx+','+ny+');');
    ok(species+' camera/sun/weather reuse the same wood geometry',P('forestTreeTrunkPlan(__tallTree,__wood.tw)===__wood&&__wood.points===__woodPoints&&__wood.normals===__woodNormals&&JSON.stringify(Array.from(__wood.points))===__woodSignature'));
  }
}

// Rendering high mature tops over a hill needs sufficient encoding range.
probe('groundElev=function(){return 74;};__maxTop=0;__heightG=createGraphics();__heightG.fill=__heightG.stroke=function(h){__maxTop=Math.max(__maxTop,h);};');
for(const species of Object.keys(oldRise)) {
  probe('__highTree={t:"PINE",forestSpecies:'+JSON.stringify(species)+',x:420,y:380,s:1.9,r:.61,c:.71};__cp=forestCanopyMass(__highTree);__maxTop=0;glRigForestCanopyHeight(__heightG,__highTree,__cp);');
  ok(species+' hilltop crown is encoded without clipping',P('__cp[0]*1.9+74<glRigHeightRange()&&__maxTop>0&&__maxTop<255'));
}
probe('currentBiome=currentLevel=1;');
ok('tall forest encoding does not change other biome height ranges',P('glRigHeightRange()===GLRIG_HEIGHT_MAX-glRigHeightOrigin()'));
probe('currentBiome=currentLevel=2;groundElev=function(){return 0;};');

// Cache the maximum reach from actual residents, including an unusually tall
// saved tree. Both decor and lighting cull use this shared conservative bound.
probe('__tallChunk={cx:0,cy:0,decor:[{t:"PINE",forestSpecies:"WESTERN_CEDAR",x:20,y:20,s:2.3,c:.5}]};__chunkPad=forestChunkDecorPad(__tallChunk);__oldDecor=__tallChunk.decor;');
ok('chunk visibility uses the actual tallest resident',P('__chunkPad>=forestPropCullPad(__tallChunk.decor[0])'));
ok('unchanged chunk decor reuses its cached reach',P('forestChunkDecorPad(__tallChunk)===__chunkPad'));
probe('__tallChunk.decor=__oldDecor.concat({t:"PINE",forestSpecies:"RED_ALDER",x:10,y:10,s:3,c:.2});');
ok('a republished taller resident invalidates chunk visibility reach',P('forestChunkDecorPad(__tallChunk)>__chunkPad&&forestChunkDecorPad(__tallChunk)>=forestPropCullPad(__tallChunk.decor[1])'));

// The 17-unit standing figure is the actual overlap boundary. Interpolated
// rings share one exact edge, while camera/time changes reuse both slices.
for(const species of ['DOUGLAS_FIR','CHARRED_SNAG'])for(const scale of [.65,1.9]) {
  probe('__splitTree={t:"PINE",forestSpecies:'+JSON.stringify(species)+',x:420,y:380,s:'+scale+',r:.61,c:.71};__splitCp=forestCanopyMass(__splitTree);__splitPlan=forestTreeTrunkPlan(__splitTree,FOREST_PROPS[__splitTree.forestSpecies].trunkWidth*__splitTree.s);__lower=forestTreeTrunkPoints(__splitPlan,"root");__upper=forestTreeTrunkPoints(__splitPlan,"crown");');
  ok(species+' '+scale+' caches both wood slices',P('forestTreeTrunkPoints(__splitPlan,"root")===__lower&&forestTreeTrunkPoints(__splitPlan,"crown")===__upper'));
  ok(species+' '+scale+' shares the exact ring at character height',P('Array.from(__lower.slice(-24)).every((v,i)=>v===__upper[i])&&Math.abs(__lower[__lower.length-1]*__splitPlan.rise-17)<1e-8'));
  ok(species+' '+scale+' draws only grounded wood before actors',P('__lower.every((v,i)=>i%3!==2||v*__splitPlan.rise<=17+1e-8)'));
  ok(species+' '+scale+' draws only elevated wood after actors',P('__upper.every((v,i)=>i%3!==2||v*__splitPlan.rise>=17-1e-8)'));
  for(const phase of ['root','crown']) {
    probe('__gradientPoints=[];__gradientStops=[];__gradientOrigins=[];__gradientCount=0;__gradientFills=0;__gradientG=createGraphics();__gradientContext=__gradientG.drawingContext;__gradientContext.createLinearGradient=function(){__gradientCount++;return {addColorStop:function(...args){__gradientStops.push(args);}};};__gradientContext.translate=function(x,y){__gradientOrigins.push([x,y]);};__gradientContext.moveTo=__gradientContext.lineTo=function(x,y){__gradientPoints.push([x,y]);};__gradientContext.fill=function(){__gradientFills++;};glRigForestTreeTrunkHeight(__gradientG,__splitTree,__splitCp,'+JSON.stringify(phase)+');massLean(__splitTree.x,__splitTree.y,__splitPlan.rise,_leanTmp);__slice=forestTreeTrunkPoints(__splitPlan,'+JSON.stringify(phase)+');');
    ok(species+' '+phase+' lighting has one bounded axial gradient',P('__gradientCount===1&&__gradientFills===1&&__gradientPoints.length===__slice.length/12'));
    ok(species+' '+phase+' lighting stays at the saved root',P('__gradientOrigins[0][0]===__splitTree.x&&__gradientOrigins[0][1]===__splitTree.y'));
    ok(species+' '+phase+' lighting uses actual projected wood vertices',P('__gradientPoints.every(q=>{for(let i=0;i<__slice.length;i+=3)if(Math.abs(q[0]-__slice[i]-_leanTmp[0]*__slice[i+2])<1e-8&&Math.abs(q[1]-__slice[i+1]-_leanTmp[1]*__slice[i+2])<1e-8)return true;return false;})'));
    ok(species+' '+phase+' gradient decodes the complete physical height',P('__gradientStops.length===2&&Math.abs(parseFloat(__gradientStops[1][1].slice(4))-glRigHeightByte(__splitPlan.rise))<1e-8'));
  }
}

// A cached native crown reuses its caller's fill flag. Bole details must not
// leave noFill() behind and turn the following foliage into an ink outline.
for(const initialFill of [true,false]) {
  probe('__scopeG=createGraphics();__scopeG.flags={fill:'+initialFill+',stroke:true};__scopeStack=[];__scopeG.push=function(){__scopeStack.push({...this.flags});};__scopeG.pop=function(){this.flags=__scopeStack.pop();};__scopeG.fill=function(){this.flags.fill=true;};__scopeG.noFill=function(){this.flags.fill=false;};__scopeG.stroke=function(){this.flags.stroke=true;};__scopeG.noStroke=function(){this.flags.stroke=false;};__scopeBefore=JSON.stringify(__scopeG.flags);paintForestTreeBole(__scopeG,__splitTree,__scopeG,80,100,__splitPlan.tw,2,"crown");');
  ok('upper wood restores caller material flags (fill='+initialFill+')',P('JSON.stringify(__scopeG.flags)===__scopeBefore&&__scopeStack.length===0'));
}

// Exercise the real sorted renderer. Grounded lower wood follows the root's
// y order; raised wood and branches sit above actors but below aircraft.
probe('__phaseEvents=[];__phaseBole=paintForestTreeBole;__phaseCrown=forestTreeCrown;paintForestTreeBole=function(){__phaseEvents.push("wood:"+arguments[7]);return __phaseBole.apply(this,arguments);};forestTreeCrown=function(){__phaseEvents.push("foliage");return __phaseCrown.apply(this,arguments);};');
for(const species of ['DOUGLAS_FIR','CHARRED_SNAG']) {
  probe('__depthTree={t:'+JSON.stringify(species==='CHARRED_SNAG'?'SNAG':'PINE')+',forestSpecies:'+JSON.stringify(species)+',forestRegion:"TIMBER",x:420,y:380,s:1.5,r:.61,c:.71};__phaseEvents=[];viewLeft=viewTop=-1000;viewRight=viewBottom=2000;activeBuildings=[];_standDecor=[__depthTree];_depthActors=[];_airborneActors=[];_depthOn=true;actorShow({x:420,y:350,show(){__phaseEvents.push("north actor");}});actorShow({x:420,y:430,show(){__phaseEvents.push("south actor");}});actorShow({x:420,y:400,eType:"AERIAL",hp:100,show(){__phaseEvents.push("flyer");}});drawDepthSorted();drawAirborneActors();');
  ok(species+' lower wood retains the ordinary root depth',P('__phaseEvents.indexOf("north actor")<__phaseEvents.indexOf("wood:root")&&__phaseEvents.indexOf("wood:root")<__phaseEvents.indexOf("south actor")'));
  ok(species+' elevated wood covers actors and stays below aircraft',P('__phaseEvents.indexOf("wood:crown")>__phaseEvents.indexOf("south actor")&&__phaseEvents.indexOf("wood:crown")<__phaseEvents.indexOf("flyer")'));
  ok(species+' each wood slice paints exactly once',P('__phaseEvents.filter(e=>e==="wood:root").length===1&&__phaseEvents.filter(e=>e==="wood:crown").length===1'));
  if(species==='CHARRED_SNAG')ok('bare raised wood does not invent a foliage layer',P('!__phaseEvents.includes("foliage")'));
  else ok('the canopy paints above the elevated wood',P('__phaseEvents.indexOf("foliage")>__phaseEvents.indexOf("wood:crown")'));
}

// The RGB fast path writes Canvas styles directly. It must still enable the
// renderer's fill flag when an earlier actor/prop entered with noFill().
probe(`__nativeG=createGraphics();__nativeOpaque=__nativeTotal=__nativeQuads=0;__nativeStack=[];
 __nativeG._colorMode='rgb';__nativeG._colorMaxes={rgb:[255,255,255,255]};
 __nativeG._renderer={drawingContext:__nativeG.drawingContext,_doFill:false,_doStroke:false,
   _setFill:function(c){this._cachedFillStyle=c;},quad:function(){__nativeQuads++;}};
 __nativeG.push=function(){__nativeStack.push([this._renderer._doFill,this._renderer._doStroke]);};
 __nativeG.pop=function(){const f=__nativeStack.pop();this._renderer._doFill=f[0];this._renderer._doStroke=f[1];};
 __nativeG.fill=function(){this._renderer._doFill=true;};__nativeG.noFill=function(){this._renderer._doFill=false;};
 __nativeG.stroke=function(){this._renderer._doStroke=true;};__nativeG.noStroke=function(){this._renderer._doStroke=false;};
 __nativePath={beginShape:function(){},vertex:function(){},endShape:function(){if(__tallPart==='crown'){__nativeTotal++;if(__nativeG._renderer._doFill)__nativeOpaque++;}}};
 _forestPolygonPainters.set(__nativeG._renderer,__nativePath);__savedPath=forestPolygonPainter;forestPolygonPainter=function(){return __nativePath;};
 try{paintForestClutter(__nativeG,{t:'PINE',forestSpecies:'DOUGLAS_FIR',forestRegion:'TIMBER',x:420,y:380,s:1.5,r:.61,c:.71},100,'crown');}
 finally{forestPolygonPainter=__savedPath;}`);
ok('the native RGB foliage route was exercised',P('__nativeQuads>0&&__nativeTotal>8'));
ok('native foliage remains fully filled after noFill entry',P('__nativeOpaque===__nativeTotal'));
ok('native foliage restores the caller noFill state and stack',P('!__nativeG._renderer._doFill&&__nativeStack.length===0'));

// Tall boughs project beyond the broad crown. Their exact cached outlines and
// origins must enter the height field too, in ascending physical height.
probe(`__maskCrown=forestTreeCrown;__maskBough=forestTreeBough;__maskKind=__maskSource=null;
 forestTreeCrown=function(){const old=[__maskKind,__maskSource];__maskKind='crown';__maskSource=arguments[5];try{return __maskCrown.apply(this,arguments);}finally{__maskKind=old[0];__maskSource=old[1];}};
 forestTreeBough=function(){const old=[__maskKind,__maskSource];__maskKind='bough';__maskSource=arguments[6];try{return __maskBough.apply(this,arguments);}finally{__maskKind=old[0];__maskSource=old[1];}};
 __maskG=createGraphics();__maskEvents=[];__maskOrigin=[0,0];__maskScale=1;__maskStack=[];__maskHeight=0;
 __maskG.push=function(){__maskStack.push([__maskOrigin.slice(),__maskScale]);};
 __maskG.pop=function(){const f=__maskStack.pop();__maskOrigin=f[0];__maskScale=f[1];};
 __maskG.translate=function(x,y){__maskOrigin[0]+=x;__maskOrigin[1]+=y;};__maskG.scale=function(r){__maskScale*=r;};
 __maskG.fill=function(h){__maskHeight=h;};__maskG.beginShape=function(){__maskEvents.push({kind:__maskKind,source:__maskSource,origin:__maskOrigin.slice(),scale:__maskScale,height:__maskHeight});};`);
for(const [species,style]of [['DOUGLAS_FIR','NEEDLE'],['WESTERN_CEDAR','COMIC'],['RED_ALDER','NEEDLE']]) {
  probe('__maskTree={t:"PINE",forestSpecies:'+JSON.stringify(species)+',forestCanopyStyle:'+JSON.stringify(style)+',forestRegion:"TIMBER",x:420,y:380,s:1.9,r:.61,c:.71};__maskCp=forestCanopyMass(__maskTree);__maskPlan=forestTreePlan(__maskTree,__maskCp[1]*__maskTree.s*.5,__maskCp[2]*__maskTree.s*.5,__maskTree.c,__maskTree.forestSpecies,__maskTree.r);__maskStamps=__maskPlan.heightStamps;__maskEvents=[];__maskOrigin=[0,0];__maskScale=1;__maskStack=[];massLean(__maskTree.x,__maskTree.y,__maskCp[0]*__maskTree.s,_leanTmp);__maskLean=_leanTmp.slice();glRigForestCanopyHeight(__maskG,__maskTree,__maskCp);');
  ok(species+' caches nine bounded height descriptors',P('__maskStamps.length===9&&__maskStamps.filter(s=>!s.branch).length===4&&__maskStamps.filter(s=>s.branch).length===5'));
  ok(species+' all actual boughs own a height descriptor',P('__maskPlan.branches.every(b=>__maskStamps.some(s=>s.branch===b))'));
  ok(species+' higher surfaces cannot be overwritten by lower boughs',P('__maskStamps.every((s,i)=>!i||s.height>=__maskStamps[i-1].height)&&__maskEvents.length===9&&__maskEvents.every((e,i)=>!i||e.height>=__maskEvents[i-1].height)'));
  ok(species+' height masks reuse exact visible crown and bough paths',P('__maskEvents.every((e,i)=>{const s=__maskStamps[i];return s.branch?e.kind==="bough"&&e.source===s.branch.points:e.kind==="crown"&&e.source===__maskPlan.crown;})'));
  ok(species+' height masks match actual raised foliage origins and scales',P('__maskEvents.every((e,i)=>{const s=__maskStamps[i],b=s.branch,f=b?b.height:s.projected;return Math.abs(e.origin[0]-__maskTree.x-(b?b.x:0)-__maskLean[0]*f)<1e-8&&Math.abs(e.origin[1]-__maskTree.y-(b?b.y:0)-__maskLean[1]*f)<1e-8&&e.scale===(b?1:s.radius)&&Math.abs(e.height-glRigHeightByte(__maskCp[0]*__maskTree.s*s.height))<1e-8;})'));
  probe('worldTimeMs+=DAY_MS/8;isRaining=!isRaining;updateSunVector();camX+=120;glRigForestCanopyHeight(__maskG,__maskTree,__maskCp);');
  ok(species+' camera and weather retain cached height descriptors',P('forestTreePlan(__maskTree,__maskPlan.rx,__maskPlan.ry,__maskTree.c,__maskTree.forestSpecies,__maskTree.r)===__maskPlan&&__maskPlan.heightStamps===__maskStamps'));
}
console.log(checks+'/'+checks+' tall forest bole, camera, cached geometry, height and visibility checks passed.');

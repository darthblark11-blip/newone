// Moving Level 2 sunlight changes materials, never world generation or bake
// ownership. These headless checks record native render commands and height
// profiles; browser pixel/FPS checks are separate and require a working runtime.
const assert = require('node:assert/strict');
const {ctx, probe, mkG, calls} = require('./harness');
const P = code => probe('(' + code + ')');
let checks = 0;
const ok = (label, value) => { assert(value, label); checks++; };
function hour(h, rain = false) {
  probe('worldTimeMs=DAY_MS*'+h+'/24;isRaining='+rain+';updateSunVector();');
  return P('({...forestSunLighting()})');
}
probe('BIOME_ACTIVE=true;currentBiome=currentLevel=2;authoredCore=authoredMask=authoredChunks=null;activeBuildings=[];activeParkingCars=[];enemiesList=[];allies=[];player=null;camX=camY=0;zoom=1;GLRig.on=GLRig.ok=false;');
const dawn=hour(6), noon=hour(12), dusk=hour(18), midnight=hour(0);
ok('the material light follows sunrise, high noon and sunset elevation', dawn.up===0 && noon.up===1 && dusk.up===0);
ok('night has no direct cel highlight', midnight.direct===0 && P('forestSunShade(-LIGHT_DX,-LIGHT_DY,0,.5,1,1.5)===1'));
ok('dawn and dusk face opposite horizontal directions', dawn.dx<-.9 && dusk.dx>.9);
const clear=hour(12), rain=hour(12,true);
ok('rain softens direct material contrast at the same hour', rain.direct<clear.direct);
ok('rain never rotates the sun', rain.dx===clear.dx && rain.dy===clear.dy);
for (const h of [0,6,8,12,16,18,22]) {
  hour(h);
  probe('__sunVector=[LIGHT_DX,LIGHT_DY];__sunKey=forestSunLighting().key;__sunRead=forestSunLighting();');
  ok('material lookup leaves the continuous sun vector unchanged at '+h+'h', P('LIGHT_DX===__sunVector[0]&&LIGHT_DY===__sunVector[1]'));
  ok('unchanged material reads reuse the same state at '+h+'h', P('forestSunLighting()===__sunRead&&forestSunLighting().key===__sunKey'));
}
hour(12);
probe('__exactSun=[LIGHT_DX,LIGHT_DY];__materialKey=forestSunLighting().key;worldTimeMs+=1;updateSunVector();__tinySun=[LIGHT_DX,LIGHT_DY];forestSunLighting();');
ok('shadows continue moving between material cache steps', P('LIGHT_DX!==__exactSun[0]||LIGHT_DY!==__exactSun[1]'));
ok('a sub-band sun movement reuses material colours', P('forestSunLighting().key===__materialKey'));
ok('reading quantized colours does not snap actual shadow direction', P('LIGHT_DX===__tinySun[0]&&LIGHT_DY===__tinySun[1]'));

probe('__tree={t:"PINE",forestSpecies:"DOUGLAS_FIR",forestRegion:"TIMBER",x:420,y:380,s:1.3,r:.61,c:.3};__cm=forestCanopyMass(__tree);__plan=forestTreePlan(__tree,__cm[1]*1.3*.5,__cm[2]*1.3*.5,.3,"DOUGLAS_FIR",.61);__treeRecord=JSON.stringify(__tree);__crown=__plan.crown;__branches=__plan.branches;');
for (const h of [6,8,12,16,18,0]) {
  hour(h,h===16);
  ok('sun/weather reuse cached crown geometry at '+h+'h', P('forestTreePlan(__tree,__cm[1]*1.3*.5,__cm[2]*1.3*.5,.3,"DOUGLAS_FIR",.61)===__plan&&__plan.crown===__crown&&__plan.branches===__branches'));
}
ok('lighting cannot change the generated tree record', P('JSON.stringify(__tree)===__treeRecord'));
probe('__nativeStyle={_colorMode:"rgb",_colorMaxes:{rgb:[255,255,255,255]},_renderer:{}};__palette=forestTreePalette("DOUGLAS_FIR","TIMBER");');
hour(8);
probe('__firstStyle=forestTreeSideStyle(__nativeStyle,{},"DOUGLAS_FIR",32,...__palette);__styleCount=Object.keys(_forestTreeSideColours).length;__repeatStyle=forestTreeSideStyle(__nativeStyle,{},"DOUGLAS_FIR",32,...__palette);');
ok('trees reuse the cached side ramp for unchanged light', P('__firstStyle.colours===__repeatStyle.colours'));
hour(16);
probe('__lastStyle=forestTreeSideStyle(__nativeStyle,{},"DOUGLAS_FIR",32,...__palette);');
ok('afternoon light recolours the same material cache entry', P('__firstStyle.colours!==__lastStyle.colours&&Object.keys(_forestTreeSideColours).length===__styleCount'));
ok('east and west faces exchange illumination through the day', P('__firstStyle.colours[15]!==__lastStyle.colours[15]||__firstStyle.colours[31]!==__lastStyle.colours[31]'));

// Reference-lit micro-art must remain deterministic when newly streamed at
// different hours. The nested guard pins both vectors and light material state.
let bakedSignature=null;
for (const h of [6,12,18,0]) {
  hour(h,h===18);
  probe('__beforeBake=[LIGHT_DX,LIGHT_DY];__bakedState=withBakedSun(()=>{__a=forestSunLighting();return withBakedSun(()=>forestSunLighting()===__a&&LIGHT_DX===SUN_REF_DX&&LIGHT_DY===SUN_REF_DY);});');
  ok('nested baking holds its reference sun at '+h+'h', P('__bakedState&&!_bakingSun&&LIGHT_DX===__beforeBake[0]&&LIGHT_DY===__beforeBake[1]'));
  calls.sig=0;
  probe('withBakedSun(()=>paintForestClutter(createGraphics(),{t:"LITTER",forestSpecies:"LITTER",forestRegion:"TIMBER",x:120,y:80,s:1.2,r:.42,c:.7},100));');
  if(bakedSignature===null)bakedSignature=calls.sig;
  ok('micro-art bake is independent of current hour at '+h+'h', calls.sig===bakedSignature);
}
hour(8);
probe('worldTimeMs=DAY_MS*16/24;withBakedSun(()=>shadowDensity());forestSunLighting();');
ok('a bake that first reads the changed clock cannot retain the earlier live sun', P('LIGHT_DX>.7&&LIGHT_DY>.5'));
probe('__restoredSun=[LIGHT_DX,LIGHT_DY];try{withBakedSun(()=>{throw new Error("bake guard probe");});}catch(e){}');
ok('a failed bake restores the live vector and guard', P('!_bakingSun&&LIGHT_DX===__restoredSun[0]&&LIGHT_DY===__restoredSun[1]'));

const relief = ['BUSH','LOG','STUMP','FERN','REED','PEBBLE','LUPINE','FOXGLOVE','SUN_DAISY','AMBER_FUNGUS','BOG_HUMMOCK','BOG_SEDGE','BOG_MOSS'];
probe('groundElev=function(){return 0;};__oldPush=push;__oldPop=pop;__oldFill=fill;__oldStroke=stroke;__oldOwner=glRigOwnsSunShadows;');
for(const name of relief) {
  probe('__relief={t:'+JSON.stringify(name)+',forestSpecies:'+JSON.stringify(name)+',forestRegion:"TIMBER",forestLiveProp:true,x:420,y:380,s:1.3,r:.61,c:.99};__reliefBefore=JSON.stringify(__relief);__caps=[];__glg=createGraphics();__glg.ellipse=function(){__caps.push(Array.from(arguments));};glRigForestFloorHeight(__glg,__relief);');
  ok(name+' has a bounded thin/folded lighting profile', P('__caps.length>0&&__caps.length<=5&&__caps.every(p=>p.every(Number.isFinite))'));
  ok(name+' lighting profile preserves saved decor', P('JSON.stringify(__relief)===__reliefBefore'));
  for(const owned of [false,true]) {
    hour(12);
    probe('__shadowFills=0;fill=function(){if(arguments.length===4&&arguments[3]>0&&arguments[3]<255)__shadowFills++;};stroke=fill;glRigOwnsSunShadows=function(){return '+owned+';};paintForestClutter(window,__relief,100,"shadow");');
    ok(name+' chooses one moving-sun shadow owner ('+(owned?'GL':'Canvas')+')', P(owned?'__shadowFills===0':'__shadowFills>0'));
  }
}
probe('fill=__oldFill;stroke=__oldStroke;glRigOwnsSunShadows=__oldOwner;');
for(const name of ['LITTER','GRASS','MUSHROOM']) {
  probe('__caps=[];__quiet={forestSpecies:'+JSON.stringify(name)+',x:420,y:380,s:1,r:0,c:0};glRigForestFloorHeight(__glg,__quiet);');
  ok(name+' ground scatter never becomes a tall occluder', P('forestSunRelief(__quiet)===null&&__caps.length===0'));
}
probe('__translations=[];__stamps=[];__scales=[];__canopyG=createGraphics();__canopyG.translate=function(x,y){__translations.push([x,y]);};__canopyG.beginShape=function(){__stamps.push(true);};__canopyG.scale=function(v){__scales.push(v);};massLean(__tree.x,__tree.y,__cm[0]*__tree.s,_leanTmp);__expectedLean=_leanTmp.slice();glRigForestCanopyHeight(__canopyG,__tree,__cm);');
ok('forest crowns use four cached crown and five real bough height stamps', P('__stamps.length===9&&JSON.stringify(__scales)===JSON.stringify([1,1,.83,.62])'));
const canopyStamps=P('__plan.heightStamps'),canopyLean=P('__expectedLean'),canopyTranslations=P('__translations');
for(let i=0;i<canopyStamps.length;i++) {
  const stamp=canopyStamps[i],fraction=stamp.branch?stamp.branch.height:stamp.projected;
  const x=(stamp.branch?stamp.branch.x:0)+canopyLean[0]*fraction;
  const y=(stamp.branch?stamp.branch.y:0)+canopyLean[1]*fraction;
  ok('canopy height stamp '+i+' follows its visible crown or bough origin',
    Math.abs(canopyTranslations[i+1][0]-x)<1e-8&&Math.abs(canopyTranslations[i+1][1]-y)<1e-8);
}

// Exercise the actual ordinary painter materials, rather than only the light
// arithmetic: every raised asset family must respond to the same moving sun.
for(const name of ['DOUGLAS_FIR','RED_ALDER','CHARRED_SNAG',...relief]) {
  const colours=[];
  for(const h of [8,16,0,12]) {
    hour(h);
    probe('__sunColours=[];__sunG=createGraphics();__sunG.fill=function(){__sunColours.push(Array.from(arguments));};paintForestClutter(__sunG,{forestSpecies:'+JSON.stringify(name)+',t:"PINE",forestRegion:"TIMBER",x:300,y:300,s:1.3,r:.61,c:.71},100,'+JSON.stringify(name==='DOUGLAS_FIR'||name==='RED_ALDER'?'crown':'root')+');');
    colours.push(JSON.stringify(P('__sunColours')));
  }
  ok(name+' visible material follows the sun across the sky', colours[0]!==colours[1]);
  ok(name+' visible material relinquishes direct highlights at night', colours[2]!==colours[3]);
}
probe('__windShrub={t:"WEED",forestSpecies:"BUSH",forestRegion:"TIMBER",x:420,y:380,s:1.3,r:.61,c:.7};__windRecord=JSON.stringify(__windShrub);__windCaps=[];__windG=createGraphics();__windG.ellipse=function(){__windCaps.push(Array.from(arguments));};glRigForestFloorHeight(__windG,__windShrub);__stillCaps=__windCaps;__windCaps=[];_forestBrushStates.set(__windShrub,{x:6,y:-2.5});glRigForestFloorHeight(__windG,__windShrub);__movingCaps=__windCaps;');
ok('brushed shrubs retain three bounded lighting lobes', P('__movingCaps.length===3&&__stillCaps.length===3'));
ok('brush lighting moves without changing the shrub root or profile shape', P('JSON.stringify(__windShrub)===__windRecord&&__movingCaps.every((p,i)=>p[2]===__stillCaps[i][2]&&p[3]===__stillCaps[i][3])'));
for(let lobe=0;lobe<3;lobe++) {
  probe('__q=_FOREST_RELIEF_SHRUBS['+lobe+'];__ca=Math.cos(__windShrub.r);__sa=Math.sin(__windShrub.r);__bx=6*__ca-2.5*__sa;__by=-6*__sa-2.5*__ca;__tw=Math.max(-.065,Math.min(.065,__by*.006/__windShrub.s));');
  ok('brushed lighting lobe '+lobe+' stays attached to its visible foliage', P('Math.abs(__movingCaps['+lobe+'][0]-__stillCaps['+lobe+'][0]-.78*(__bx*__q[4]-__q[1]*__windShrub.s*__tw))<1e-8&&Math.abs(__movingCaps['+lobe+'][1]-__stillCaps['+lobe+'][1]-.78*(__by*__q[4]+__q[0]*__windShrub.s*__tw))<1e-8'));
}
probe('_forestBrushStates.delete(__windShrub);');

// RGB fast-path conversion and ordinary numeric fills agree for the same
// sunlight values; unsupported modes still hand control to p5.
ctx.RADIANS='radians';
probe('__rgb=[];__floorNative={_renderer:{_ellipseMode:CENTER,_setFill:function(c){__rgb.push(c);}},_angleMode:RADIANS,_colorMode:"rgb",_colorMaxes:{rgb:[255,255,255,255]}};__floorFast=forestFloorPainter(__floorNative,{});');
for(const h of [6,12,18,0]) {
  hour(h);
  probe('__k=forestSunShade(-.6,.4,.7,.65,1,1.25);__ordinary=[83*__k,151*__k,69*__k];__floorFast.fill(...__ordinary);__expectedRGB="#"+__ordinary.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,"0")).join("");');
  ok('native and ordinary floor material bytes agree at '+h+'h', P('__rgb[__rgb.length-1]===__expectedRGB'));
}
probe('__floorNative._colorMode="hsb";');
ok('alternate colour modes retain ordinary p5 shading', P('forestFloorPainter(__floorNative,{})===null'));
ok('the public renderer fallback remains available', P('forestFloorPainter(__floorNative,__floorNative)===null'));

// A continuously changing sky must not retain every RGB combination seen
// during an endless walk. Eviction changes lookup cost, never colour bytes.
probe('__evictionStyle=forestFloorOpaqueStyle(255,254,253);__evictionKey=255*65536+254*256+253;for(let i=0;i<5000;i++)forestFloorOpaqueStyle(i%256,Math.floor(i/256),0);__wasEvicted=_forestFloorOpaqueStyles[__evictionKey]===undefined;');
ok('the moving-light RGB cache stays bounded after thousands of unique colours', P('Object.keys(_forestFloorOpaqueStyles).length<=4096&&_forestFloorOpaqueCount===4096'));
probe('__recentStyle=forestFloorOpaqueStyle(135,19,0);__cursorBeforeRepeat=_forestFloorOpaqueCursor;__sameRecentStyle=forestFloorOpaqueStyle(135,19,0);');
ok('repeated material colours retain exact bytes without cycling the cache', P('__recentStyle==="#871300"&&__sameRecentStyle===__recentStyle&&_forestFloorOpaqueCursor===__cursorBeforeRepeat'));
probe('__recomputedStyle=forestFloorOpaqueStyle(255,254,253);');
ok('an evicted material recomputes to the identical RGB value', P('__wasEvicted&&__recomputedStyle===__evictionStyle&&__recomputedStyle==="#fffefd"&&Object.keys(_forestFloorOpaqueStyles).length<=4096'));

let created=0,uploads=0,removed=0;
const originalGraphics=ctx.createGraphics;
ctx.createGraphics=(w,h)=>{const g=mkG();g.width=w;g.height=h;g.pixels=new Uint8ClampedArray(w*h*4);g.updatePixels=()=>{uploads++;};g.remove=()=>{removed++;};created++;return g;};
probe('_forestRidgeSunCache.clear();__ridge={cells:1,stride:2,maximum:20,heights:new Float32Array([20,20,20,20]),normalsX:new Float32Array([.25,.25,.25,.25]),normalsY:new Float32Array([0,0,0,0])};__ridgeSun={key:700,dx:1,dy:0,up:.5,horizon:.86,direct:1};__ridgeTex=forestRidgeSunTexture(__ridge,__ridgeSun);');
ok('the fallback uses one small 64-pixel light texture', created===1&&P('__ridgeTex.width===64&&__ridgeTex.height===64'));
const firstUploads=uploads;
probe('__sameRidge=forestRidgeSunTexture(__ridge,__ridgeSun);');
ok('an unchanged sun reuses the texture without uploading pixels', uploads===firstUploads&&P('__sameRidge===__ridgeTex'));
probe('__ridgeSun={...__ridgeSun,key:701,dx:-1};__changedRidge=forestRidgeSunTexture(__ridge,__ridgeSun);');
ok('a changed sun recolours the existing light texture', uploads===firstUploads+1&&created===1&&P('__changedRidge===__ridgeTex'));
probe('__ridgeSun={...__ridgeSun,key:702,direct:0};forestRidgeSunTexture(__ridge,__ridgeSun);');
ok('night contributes no stale painted ridge highlight', P('__ridgeTex.pixels.every((v,i)=>i%4!==3||v===0)'));
probe('for(let i=0;i<129;i++){forestRidgeSunTexture({...__ridge},__ridgeSun);}');
ok('walking indefinitely cannot grow the ridge light cache', P('_forestRidgeSunCache.size===128')&&removed===2);
probe('__oldRidge=forestRidgeGrid;__oldLight=forestSunLighting;__oldGlActive=glRigActive;__oldBake=bakeChunkTerrain;__bakeCalls=0;__imageCalls=0;__ridgeSun={...__ridgeSun,key:703,direct:1};forestRidgeGrid=function(){return __ridge;};forestSunLighting=function(){return __ridgeSun;};glRigActive=function(){return false;};bakeChunkTerrain=function(){__bakeCalls++;throw new Error("unexpected terrain rebake");};chunkMgr={biome:2,chunks:new Map([["0,0",{cx:0,cy:0,tex:"retained terrain"}]])};viewLeft=viewTop=0;viewRight=viewBottom=CHUNK_W-1;');
const oldImage=ctx.image;ctx.image=()=>{probe('__imageCalls++;');};
probe('drawForestRidgeSunlight();');
ok('moving ridge light preserves the full terrain bake', P('__imageCalls===1&&__bakeCalls===0&&chunkMgr.chunks.get("0,0").tex==="retained terrain"'));
probe('glRigActive=function(){return true;};drawForestRidgeSunlight();');
ok('the GPU and Canvas ridge light never stack', P('__imageCalls===1'));
probe('forestRidgeGrid=__oldRidge;forestSunLighting=__oldLight;glRigActive=__oldGlActive;bakeChunkTerrain=__oldBake;');
ctx.image=oldImage;ctx.createGraphics=originalGraphics;
console.log(checks+'/'+checks+' forest sunlight, cached material, bake guard, moving shadow owner and height alignment checks passed.');

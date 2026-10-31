// Forest art shares dimensions with culling and the deferred height field.
// Exercise the runtime paths, including legacy canopy fallback and both shadow
// owners, rather than relying on source strings for the new species contract.
const assert = require('assert');
const { probe } = require('./harness');
let checks = 0;
function ok(condition, message) { checks++; assert(condition, message); }
const P = s => probe('(' + s + ')');
probe(`
  BIOME_ACTIVE=true; currentLevel=currentBiome=2;
  authoredCore=authoredChunks=authoredMask=null;
  activeBuildings=[]; enemiesList=[]; allies=[]; player=null;
  camX=camY=0; zoom=.65; width=540; height=1170;
  viewLeft=0; viewTop=0; viewRight=width/zoom; viewBottom=height/zoom;
  __g=createGraphics(); __ellipses=[]; __material=null; __balance=0; __lowest=0;
  __polygons=[]; __branches=[]; __scales=[]; __scale=1;
  __g.fill=function(){__material=Array.from(arguments);};
  __g.stroke=function(){__strokeMaterial=Array.from(arguments);};
  __g.ellipse=function(x,y,w,h){__ellipses.push({x,y,w,h,material:__material});};
  __g.scale=function(x){__scale*=x;};
  __g.beginShape=function(){__polygons.push({points:[],material:__material,scale:__scale});};
  __g.vertex=function(x,y){__polygons[__polygons.length-1].points.push([x,y]);};
  __g.line=function(){__branches.push({line:Array.from(arguments),material:__strokeMaterial});};
  __g.push=function(){__balance++;__scales.push(__scale);};
  __g.pop=function(){__balance--;__lowest=Math.min(__lowest,__balance);__scale=__scales.pop();};
  GLRig.hgt=__g; GLRig.hw=width/2; GLRig.on=GLRig.ok=false;
  function heightFor(d) {
    __ellipses=[]; __polygons=[]; __branches=[]; __scales=[]; __scale=1; __balance=__lowest=0;
    chunkMgr={biome:2,chunks:new Map([['0,0',{cx:0,cy:0,decor:[d]}]])};
    glRigPaintHeight(); return __ellipses;
  }
`);
const species = P('Object.keys(FOREST_PROPS).filter(s=>FOREST_PROPS[s].canopyMass)');
for (const name of species) for (const scale of [.65, 1, 1.9]) for (const crown of [.3, 1]) {
  const d = {t:name === 'RED_ALDER' ? 'TREE' : name === 'CHARRED_SNAG' ? 'SNAG' : 'PINE',
    x:300,y:600,s:scale,r:.47,c:.61,forestSpecies:name,forestRegion:'TIMBER',forestCrownScale:crown};
  const base = P(`FOREST_PROPS[${JSON.stringify(name)}].canopyMass`);
  const result = P(`heightFor(${JSON.stringify(d)})`);
  ok(result.length === 0, `${name} no longer casts a solid oval pillar shadow`);
  const contours = P('__polygons'), branches = P('__branches');
  const expectedHeight = Math.min(255, base[0] * scale / P('GLRIG_HEIGHT_MAX') * 255);
  if (name === 'CHARRED_SNAG') {
    ok(contours.length === 0 && branches.length === 5, 'a bare snag casts only its trunk and branches');
    ok(Math.abs(branches[0].material[0] - expectedHeight) < 1e-8, 'a snag preserves its authored height');
  } else {
    ok(contours.length === 3, `${name} tapers in three bounded foliage contours`);
    ok(contours[0].material[0] < contours[1].material[0] && contours[1].material[0] < contours[2].material[0],
      `${name} is thinner at the foliage edge than its centre`);
    ok(contours[0].scale > contours[1].scale && contours[1].scale > contours[2].scale,
      `${name} height bands narrow toward the crown centre`);
    ok(Math.abs(contours[2].material[0] - expectedHeight) < 1e-8, `${name} crown narrowing preserves height`);
    ok(contours[0].points.every(([x,y])=>Math.abs(x)<=base[1]*scale*crown/2 && Math.abs(y)<=base[2]*scale*crown/2),
      `${name} height contour stays within scaled crown dimensions`);
  }
  const radius = P(`forestPropRadius(${JSON.stringify(d)})`);
  ok(radius >= Math.max(base[1]*scale*crown,base[2]*scale*crown) / 2 - 1e-8, `${name} reserves its entire crown`);
  ok(P('__balance===0 && __lowest===0'), `${name} height pass balances transforms`);
}
const legacy = P('heightFor({t:"PINE",x:300,y:600,s:1.2,r:0,c:0})');
ok(legacy.length === 1 && legacy[0].w === 34*1.2 && legacy[0].h === 34*1.2,
  'canopy metadata leaves the non-forest pine silhouette unchanged');
ok(P('forestCanopyMass({t:"FERN",forestSpecies:"FERN"})===null'),
  'baked underbrush cannot become a canopy occluder');
ok(P('FOREST_PROPS.BOULDER.rise===PROP_RISE.BOULDER[0]'),
  'granite art and material metadata use the same established rock rise');
ok(P('forestPropRadius({forestSpecies:"BOULDER",w:180,h:110})===90'),
  'solid granite reserves its actual retained footprint rather than a default size');

// Every species and floor conversion can paint into either target without
// corrupting p5's transform stack or changing the deterministic prop record.
probe(`
  __shadowCount=0; __level=__minLevel=0; __shadowDensity=1;
  __oldPush=push; __oldPop=pop; __oldFill=fill; __oldStroke=stroke;
  push=function(){__level++;}; pop=function(){__level--;__minLevel=Math.min(__minLevel,__level);};
  fill=function(){if(arguments.length===4&&arguments[3]<255)__shadowCount++;};
  stroke=function(){if(arguments.length===4&&arguments[3]<255)__shadowCount++;};
  shadowDensity=function(){return __shadowDensity;};
  shadowLengthScale=function(){return 1;};
  glRigOwnsSunShadows=function(){return __owned;};
`);
for (const name of P('Object.keys(FOREST_PROPS).filter(s=>s!=="BOULDER")')) {
  const d = {t: species.includes(name) ? 'PINE' : name, x:300,y:600,s:1,r:.47,c:.61,
    forestSpecies:name, forestRegion:'MARSH',forestTier:'underbrush'};
  for (const owned of [false, true]) {
    const source = JSON.stringify(d);
    probe(`__level=__minLevel=__shadowCount=0;__owned=${owned};__d=${source};paintClutter(window,__d,100);`);
    ok(P('__level===0 && __minLevel===0'), `${name} live painter balances transforms`);
    ok(P('JSON.stringify(__d)') === source, `${name} painter preserves generation data`);
    if (species.includes(name)) ok(owned ? P('__shadowCount===0') : P('__shadowCount>0'),
      `${name} chooses exactly one sun shadow owner`);
  }
}

// A high crown near a chunk/view edge must be considered by both live art and
// the height field; the original +/-120 clamp prematurely discarded it.
probe(`
  __edge={t:'PINE',x:-160,y:600,s:1.9,r:.47,c:.61,forestSpecies:'DOUGLAS_FIR',forestRegion:'TIMBER'};
  chunkMgr=new ChunkManager(2);
  chunkMgr.chunks=new Map([['-1,0',{cx:-1,cy:0,decor:[__edge]}]]);
  _depthOn=true;_standDecor=[];chunkMgr.drawDecor();
`);
ok(P('_standDecor.length===1 && _standDecor[0]===__edge'),
  'projected crown edge survives live decor culling');
probe('__ellipses=[];__polygons=[];glRigPaintHeight();');
ok(P('__polygons.length===3 && __ellipses.length===0'), 'the same edge crown survives lighting culling');
ok(P('forestPropCullPad(__edge)>=forestPropRadius(__edge)+FOREST_PROPS.DOUGLAS_FIR.canopyMass[0]*1.9*(MASS_LEAN+MASS_TILT)'),
  'visibility padding covers crown radius plus maximum projected height');
console.log(`${checks}/${checks} forest rendering checks passed.`);

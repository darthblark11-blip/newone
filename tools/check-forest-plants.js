// The live floor props must project fixed world geometry. Moving a camera
// changes their raised layers, never their ground roots or seeded headings.
const assert = require('assert');
const { probe } = require('./harness');
const P = code => probe('(' + code + ')');
probe(`
  BIOME_ACTIVE=true;currentBiome=currentLevel=2;zoom=1;width=1200;height=800;
  __level=0;__floorRecords=[];__floorRotations=[];__floorAlpha=0;
  push=function(){__level++;};pop=function(){__level--;};
  shadowDensity=function(){return .8;};shadowLengthScale=function(){return 1;};
  fill=function(){if(arguments.length===4&&arguments[3]<255)__floorAlpha++;};
  rotate=function(a){__floorRotations.push(a);};
  for(const name of ['vertex','bezierVertex','quad','triangle','bezier','ellipse','line'])
    window[name]=function(){__floorRecords.push({kind:name,args:Array.from(arguments)});};
  function floorCapture(d,phase,cx,cy){
    camX=cx;camY=cy;__floorRecords=[];__floorRotations=[];__floorAlpha=0;
    paintForestClutter(window,d,100,phase);
    return {geometry:__floorRecords,rotations:__floorRotations,alpha:__floorAlpha};
  }
`);
let samples=0;
for (const species of ['FERN','REED','GRASS','PEBBLE']) {
  const d={t:species,forestSpecies:species,forestRegion:'MARSH',x:420,y:380,s:1.3,r:.61,c:.37};
  probe('__floorProp='+JSON.stringify(d)+';');
  const a=P("floorCapture(__floorProp,'root',0,0)");
  const b=P("floorCapture(__floorProp,'root',120,-90)");
  const shadeA=P("floorCapture(__floorProp,'shadow',0,0)");
  const shadeB=P("floorCapture(__floorProp,'shadow',120,-90)");
  assert.deepEqual(shadeA,shadeB,`${species} contact shade must remain on the ground`);
  assert(shadeA.alpha>0 && a.alpha===0 && b.alpha===0,`${species} root pass must omit duplicate floor shade`);
  assert.deepEqual(a.rotations,b.rotations,`${species} heading must not follow the camera`);
  assert.equal(a.geometry.length,b.geometry.length,`${species} must retain its world geometry`);
  probe('camX=0;camY=0;');
  const liftA=P('forestFloorLift(__floorProp,FOREST_PROPS[__floorProp.forestSpecies].rise*__floorProp.s,true,[0,0])');
  probe('camX=120;camY=-90;');
  const liftB=P('forestFloorLift(__floorProp,FOREST_PROPS[__floorProp.forestSpecies].rise*__floorProp.s,true,[0,0])');
  const dx=liftB[0]-liftA[0],dy=liftB[1]-liftA[1];
  const norm=dx*dx+dy*dy;
  let fixed=0,raised=0;
  for(let primitive=0;primitive<a.geometry.length;primitive++) {
    const before=a.geometry[primitive],after=b.geometry[primitive];
    assert.equal(before.kind,after.kind);
    for(let i=0;i<before.args.length;i+=2) {
      const x=after.args[i]-before.args[i],y=after.args[i+1]-before.args[i+1];
      assert(Number.isFinite(x)&&Number.isFinite(y),`${species} emitted non-finite geometry`);
      assert(Math.abs(x*dy-y*dx)<1e-7,`${species} changed a physical contour instead of projecting its height`);
      const fraction=(x*dx+y*dy)/norm;
      assert(fraction>=-1e-8&&fraction<=1.03,`${species} raised layer exceeds its shared height profile`);
      if(Math.abs(fraction)<1e-8)fixed++;else raised++;
      samples++;
    }
  }
  assert(fixed>0&&raised>0,`${species} must contain both fixed contacts and raised faces`);
  assert(P('__level===0 && JSON.stringify(__floorProp)')===JSON.stringify(d),
    `${species} must balance transforms and preserve generated metadata`);
}
console.log(`Forest floor plants passed: ${samples} projected points, fixed roots, stable headings, independent floor shade.`);

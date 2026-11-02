// Timber must keep its ground contacts while the bark, sawn ends and moss
// project at their actual heights. Shadow/root phases must never duplicate art.
const assert = require('assert');
const { probe } = require('./harness');
const P = code => probe('(' + code + ')');
probe(`
  BIOME_ACTIVE=true;currentBiome=currentLevel=2;
  width=1200;height=800;zoom=1;camX=camY=0;
  __level=0;push=function(){__level++;};pop=function(){__level--;};
  shadowDensity=function(){return .8;};shadowLengthScale=function(){return 1;};
  function captureTimber(d,phase,x,y){
    camX=x;camY=y;__paths=[];__ellipses=[];__lines=[];
    beginShape=function(){__paths.push([]);};
    vertex=function(x,y){__paths[__paths.length-1].push([x,y]);};
    ellipse=function(){__ellipses.push(Array.from(arguments));};
    line=function(){__lines.push(Array.from(arguments));};
    paintForestClutter(window,d,100,phase);
    return {paths:__paths,ellipses:__ellipses,lines:__lines};
  }
  function timberUnit(d,x,y){
    camX=x;camY=y;const p=massLean(d.x,d.y,1,[0,0]),c=Math.cos(d.r),s=Math.sin(d.r);
    return [p[0]*c+p[1]*s,-p[0]*s+p[1]*c];
  }
`);
let cases = 0;
for (const species of ['LOG','STUMP']) for (const scale of [.75,1.3,1.9])
  for (const angle of [.2,.8,1.7,2.8]) for (const seed of [.28,.72]) {
    probe(`__d=${JSON.stringify({t:species,forestSpecies:species,forestRegion:'TIMBER',
      x:310,y:260,s:scale,r:angle,c:seed})};__original=JSON.stringify(__d);`);
    const shadow = P("captureTimber(__d,'shadow',0,0)");
    assert(shadow.ellipses.length === 1 && shadow.paths.length === 0 && shadow.lines.length === 0,
      `${species} shadow phase should paint only its oriented floor contact`);
    const first = P("captureTimber(__d,'root',0,0)");
    const moved = P("captureTimber(__d,'root',30,-20)");
    assert(first.ellipses.length === 0 && moved.ellipses.length === 0,
      `${species} root phase duplicates its contact shade`);
    assert(first.paths.flat().flat().every(Number.isFinite) && moved.paths.flat().flat().every(Number.isFinite),
      `${species} emitted invalid geometry`);
    assert(P('__level===0&&JSON.stringify(__d)===__original'),
      `${species} changed generated data or leaked its transform stack`);
    if (species === 'STUMP') {
      assert.deepEqual(first.paths[0], moved.paths[0], 'stump root flare moves with the camera');
      const unitA = P('timberUnit(__d,0,0)'), unitB = P('timberUnit(__d,30,-20)');
      const rise = P('FOREST_PROPS.STUMP.rise');
      for (let i = 0; i < 9; i++) {
        const a = first.paths[i+1], b = moved.paths[i+1];
        assert.deepEqual(a.slice(0,2),b.slice(0,2),'stump bark lost its fixed lower edge');
        for (const [vertex, topIndex] of [[2,(i+1)%9],[3,i]]) {
          const z = rise * (seed > .56 && topIndex === 2 ? 1.24 : seed > .56 && topIndex === 3 ? 1.10 : 1);
          assert(Math.abs(b[vertex][0]-a[vertex][0]-(unitB[0]-unitA[0])*z*scale)<1e-8 &&
            Math.abs(b[vertex][1]-a[vertex][1]-(unitB[1]-unitA[1])*z*scale)<1e-8,
            'stump top must follow its own seeded height rather than a fixed baked tilt');
        }
      }
    } else {
      assert(first.paths[0].length===10 && moved.paths[0].length===10,
        'log needs a complete cylinder cross-section');
      assert.deepEqual(first.paths[0][5],moved.paths[0][5],
        'the bottom of the fallen cylinder must remain on the ground');
      assert(first.paths.some(p=>p.length===6), 'log body lost its tapered bark faces');
    }
    cases++;
  }
console.log(`Forest timber passed: ${cases} camera/scale/rotation cases, fixed roots, projected bark and separate contact shade.`);

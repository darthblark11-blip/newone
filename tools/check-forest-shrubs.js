// Raised shrubs must move with the city's camera projection while their roots
// stay on the floor. A baked bush can pass an ordinary prop rendering smoke.
const assert = require('assert');
const { probe } = require('./harness');
const P = code => probe('(' + code + ')');
probe(`
  BIOME_ACTIVE=true;currentBiome=currentLevel=2;
  width=1200;height=800;zoom=1;camX=camY=0;
  __shrub={t:'WEED',x:420,y:380,s:1.3,r:.61,c:.3,
    forestSpecies:'BUSH',forestRegion:'TIMBER',forestHabitat:'VIBRANT'};
  __original=JSON.stringify(__shrub);__level=0;
  push=function(){__level++;};pop=function(){__level--;};
  shadowDensity=function(){return .8;};shadowLengthScale=function(){return 1;};
  function captureShrub(phase,x,y){
    camX=x;camY=y;__paths=[];__sides=[];__ellipses=[];
    beginShape=function(){__paths.push([]);};
    vertex=function(x,y){__paths[__paths.length-1].push([x,y]);};
    quad=function(){__sides.push(Array.from(arguments));};
    ellipse=function(){__ellipses.push(Array.from(arguments));};
    paintForestClutter(window,__shrub,100,phase);
    return {paths:__paths,sides:__sides,ellipses:__ellipses};
  }
`);
const shadow = P("captureShrub('shadow',0,0)");
assert(shadow.paths.length === 1 && shadow.paths[0].length === 2 && shadow.sides.length === 0,
  'shadow phase must paint only floor contact shade');
const first = P("captureShrub('root',0,0)");
const moved = P("captureShrub('root',120,-90)");
assert(first.paths.length === 3 && first.paths.every(p => p.length === 8),
  'shrub should have three closed faceted crowns');
assert(first.ellipses.length === 0 && first.sides.length === 27,
  'root phase should paint raised sides and facets without a duplicate floor shadow');
const heights = [.63, .74, 1];
for (let lobe = 0; lobe < 3; lobe++) {
  const rise = P('FOREST_PROPS.BUSH.rise*__shrub.s') * heights[lobe];
  const a = P(`massLean(__shrub.x,__shrub.y,${rise},[0,0]).slice()`);
  probe('camX=0;camY=0;');
  const b = P(`massLean(__shrub.x,__shrub.y,${rise},[0,0]).slice()`);
  probe('camX=120;camY=-90;');
  const rot = P('__shrub.r'), dx = a[0] - b[0], dy = a[1] - b[1];
  const localX = dx * Math.cos(rot) + dy * Math.sin(rot);
  const localY = -dx * Math.sin(rot) + dy * Math.cos(rot);
  for (let i = 0; i < 8; i++) {
    assert(Math.abs(moved.paths[lobe][i][0] - first.paths[lobe][i][0] - localX) < 1e-8 &&
      Math.abs(moved.paths[lobe][i][1] - first.paths[lobe][i][1] - localY) < 1e-8,
    'camera should translate each crown by its projected rise without changing its silhouette');
    const side = lobe * 9 + i;
    assert.deepEqual(first.sides[side].slice(0,4), moved.sides[side].slice(0,4),
      'each side must keep its lower rim on the same world root');
  }
}
assert(P('__level===0 && JSON.stringify(__shrub)===__original'),
  'shrubs should balance transforms and preserve their generated records');
probe('__shrub.c=.7;');
const berriesA = P("captureShrub('root',0,0)");
const berriesB = P("captureShrub('root',120,-90)");
assert(berriesA.ellipses.length === 2 && berriesB.ellipses.length === 2,
  'fruiting shrubs should carry a bounded pair of berries');
const crownDX = berriesB.paths[1][0][0] - berriesA.paths[1][0][0];
const crownDY = berriesB.paths[1][0][1] - berriesA.paths[1][0][1];
for (let i = 0; i < 2; i++)
  assert(Math.abs(berriesB.ellipses[i][0] - berriesA.ellipses[i][0] - crownDX) < 1e-8 &&
    Math.abs(berriesB.ellipses[i][1] - berriesA.ellipses[i][1] - crownDY) < 1e-8,
    'berries should remain attached to the projected front leaf mass');
console.log('Raised forest shrubs passed: separate floor shade, three projected crowns, fixed roots and camera-stable geometry.');

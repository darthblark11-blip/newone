// Lighting arithmetic for a canyon below the desert rim. The byte encoding,
// lamp grounding and native shader uniforms must agree on one height origin.
const assert = require('assert');
const fs = require('fs');
const {ctx, probe} = require('./harness');
let checks = 0;
const test = (code, message) => { assert.ok(probe(code), message); checks++; };
probe('BIOME_ACTIVE=true;currentBiome=3;');
test('glRigHeightOrigin()===-160 && glRigHeightRange()===360', 'Frontier lighting includes the negative canyon floor');
test('glRigHeightByte(-136)>0 && glRigHeightByte(-136)<glRigHeightByte(0)', 'The floor remains distinct from the desert rim');
test('glRigHeightByte(0)<glRigHeightByte(84) && glRigHeightByte(84)<255', 'Roofs remain distinct from both floor and rim');
test('[-136,-80,0,84,196].every(h=>Math.abs(glRigHeightByte(h)/255*glRigHeightRange()+glRigHeightOrigin()-h)<1e-10)', 'Encoding preserves signed world heights');
test('glRigHeightByte(-200)===0 && glRigHeightByte(300)===255', 'The height buffer safely clamps extreme geometry');
let fill;
const g = {fill(...args){ fill=args; }};
ctx.__frontierLightG=g;
probe('glRigMat(__frontierLightG,-136,.2,.5);');
assert.ok(Math.abs(fill[0]-24/360*255)<1e-10 && fill[1]===51 && fill[2]===127.5, 'The material painter packs negative geometry into a real byte'); checks++;
probe('var __frontierGroundOriginal=groundElev;groundElev=()=>-136;');
test('glRigEmitterGround({x:0,y:0,z:22})===-136 && glRigEmitterHeight({x:0,y:0,z:22},-136)===46', 'A canyon-floor weapon light has the same height origin as its bearer');
test('glRigEmitterHeight({x:0,y:0,z:40,b:{isCivic:true}},-136)===200', 'Already grounded civic lights are shifted exactly once');
// The occlusion shader measures the blocker above the source ground, rather
// than mistaking the positive encoding offset for an occluder.
test(`[-136,-80,0,96].every(h=>{
  const ground=h-glRigHeightOrigin(),lamp=glRigEmitterHeight({z:22},h);
  const flat=glRigHeightByte(h)/255*glRigHeightRange();
  const wall=glRigHeightByte(h+40)/255*glRigHeightRange();
  return Math.abs((flat-ground)/(lamp-ground))<1e-10 && (wall-ground)/(lamp-ground)>1;
})`, 'Bare ground casts no false lamp shadow, while a real wall still blocks it');
probe('groundElev=__frontierGroundOriginal;');
for (const biome of [1,2,4,5,6,7]) {
  probe('currentBiome='+biome+';');
  test('glRigHeightOrigin()===0 && glRigHeightRange()===200 && glRigHeightByte(0)===0 && glRigHeightByte(100)===127.5', 'Biome '+biome+' retains the original height encoding');
  test('glRigEmitterGround({x:0,y:0,z:22})===0 && glRigEmitterHeight({z:22},0)===22', 'Biome '+biome+' retains the original lamp grounding');
}
probe('currentBiome=3;BIOME_ACTIVE=false;');
test('glRigHeightOrigin()===0 && glRigHeightRange()===200', 'Nonstreamed interiors retain the original lighting range');
const source=fs.readFileSync(process.env.GAME_JS || __dirname+'/../game.js','utf8');
const shaders=probe('[GLRIG_FS_OCC,GLRIG_FS_SUN,GLRIG_FS_LIGHT]');
assert.ok(shaders[0].includes('uniform float uGroundZ;') && shaders[0].includes('(h - uGroundZ) / max(uLightZ - uGroundZ, 1.0)'), 'The native occlusion shader removes the encoded origin');checks++;
const frame=source.slice(source.indexOf('function glRigFrame()'),source.indexOf('function drawBiomeScreenLayer()'));
assert.strictEqual((frame.match(/uHeightMax, heightRange/g)||[]).length,3,'Sun, occlusion and local-light shaders use the same signed range');checks++;
assert.strictEqual((frame.match(/uLightZ, emitterHeight/g)||[]).length,2,'Occlusion and local shading use the same grounded lamp height');checks++;
assert.ok(frame.includes('uGroundZ, encodedGround') && frame.includes('relief = 5.5 * heightRange / GLRIG_HEIGHT_MAX'),'Lamp occlusion and normal relief both compensate for the height origin');checks++;
console.log('Frontier lighting: '+checks+' checks passed.');

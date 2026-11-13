#!/usr/bin/env node
// Capture the authored frontier roof geometry, without advancing the world.
// Blender consumes this source; runtime keys use the exact same quantization.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUTPUT = path.join(ROOT, 'assets/buildings/roof-lighting-source.json');
const QUANTIZATION = 10000;

function canonicalGeometry(faces) {
  return faces.map(face => face.points.map(point => point.map(value =>
    Math.round(value * QUANTIZATION)).join(',') + ';').join('') + '|').join('');
}

function geometryKey(faces) {
  const text = canonicalGeometry(faces);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return 'roof-' + (hash >>> 0).toString(16).padStart(8, '0');
}

function boundsOf(faces) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const face of faces) for (const point of face.points) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], point[axis]); max[axis] = Math.max(max[axis], point[axis]);
  }
  return [min, max];
}

function extract() {
  const {probe} = require('./harness.js');
  const records = JSON.parse(JSON.stringify(probe(`
    currentLevel=currentBiome=3;BIOME_ACTIVE=true;legacyGenerateMap();
    buildings.filter(b=>b.frontierDesign).map(b=>({
      origin:[b.x,b.y,0],native:{id:b.frontierDesign.id,part:b.frontierPartId||'main',
        facing:b.facing||'S',roof:b.frontierDesign.roof,role:b.frontierDesign.role,
        width:b.w,depth:b.h,rise:buildingRise(b)},
      faces:frontierRoofMesh(b).faces.map(f=>({
        points:f.points.map(p=>[p[0]-b.x,p[1]-b.y,p[2]]),color:f.color.slice()}))
    }));`)));
  const models = {}, canonical = new Map();
  for (const record of records) {
    for (const face of record.faces) {
      if (face.points.length < 3 || face.points.some(p => p.length !== 3 || p.some(v => !Number.isFinite(v))))
        throw new Error('Invalid native roof face: ' + record.native.id);
    }
    const key = geometryKey(record.faces), text = canonicalGeometry(record.faces);
    if (canonical.has(key) && canonical.get(key) !== text) throw new Error('Roof geometry hash collision: ' + key);
    if (models[key]) throw new Error('Duplicate authored model requires explicit instances: ' + key);
    canonical.set(key, text);
    models[key] = {...record, bounds:boundsOf(record.faces)};
  }
  const ordered = Object.fromEntries(Object.keys(models).sort().map(key => [key, models[key]]));
  const geometryDigest = crypto.createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
  return {schema:1, quantization:QUANTIZATION,
    source:{sector:3,generator:'legacyGenerateMap',geometry:'frontierRoofMesh',
      coordinates:'Native local XY with Z above ground; object origins retain authored world XY.'},
    geometryDigest, modelCount:records.length,
    faceCount:records.reduce((sum, record) => sum + record.faces.length, 0), models:ordered};
}

function main() {
  const args = process.argv.slice(2), check = args.includes('--check');
  const option = args.indexOf('--output');
  if (option >= 0 && (!args[option + 1] || args[option + 1].startsWith('--')))
    throw new Error('--output requires a file path');
  const output = option < 0 ? DEFAULT_OUTPUT : path.resolve(args[option + 1] || '');
  const unknown = args.filter((arg,index) => arg !== '--check' && arg !== '--output' && !(option >= 0 && index === option + 1));
  if (unknown.length) throw new Error('Usage: node tools/extract-building-lighting.cjs [--check] [--output path]');
  const data = extract(), serialized = JSON.stringify(data, null, 2) + '\n';
  if (check) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== serialized)
      throw new Error('Building lighting source is stale. Run node tools/extract-building-lighting.cjs and regenerate with Blender.');
  } else {
    fs.mkdirSync(path.dirname(output), {recursive:true});
    fs.writeFileSync(output, serialized);
  }
  console.log(JSON.stringify({action:check?'validated':'extracted',path:path.relative(ROOT,output),
    models:data.modelCount,faces:data.faceCount,geometryDigest:data.geometryDigest}));
}

module.exports = {QUANTIZATION,canonicalGeometry,geometryKey,boundsOf,extract};
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode=1; }
}

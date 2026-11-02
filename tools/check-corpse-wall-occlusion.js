// Observe the real native wall silhouette at near and distant camera scales.
// No clipping implementation is repeated here: the visual tool reads final
// p5 pixels and uses the wall painter's opaque alpha as its reference mask.
const {run}=require('./visual-corpse-wall-occlusion');
run({assertions:true}).then(r=>{
 console.log(`Corpse wall occlusion passed: ${r.records.length} native ${r.p5Version} seated/pinned face-camera-scale fixtures, opaque roof/hull protection, foreground order and zero browser errors.`);
}).catch(e=>{console.error(e);process.exitCode=1;});

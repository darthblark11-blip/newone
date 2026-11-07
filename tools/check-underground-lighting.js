// The closed underground route must stay dark at noon, with the same ambient
// and emitter selection when WebGL is active or its canvas fallback carries it.
const assert=require('assert/strict');
const {ctx,probe:P}=require('./harness');
let checks=0;
const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
P(`currentLevel=currentBiome=9;BIOME_ACTIVE=false;frameCount=110;
 player=new Character(0,700,true);player.hp=100;player.dead=false;player.aimAngle=-Math.PI/2;
 viewLeft=-900;viewRight=900;viewTop=-2000;viewBottom=1400;
 activeBuildings=[{x:40,y:700,isStreetLight:true}];fires=[{x:0,y:700,r:200,life:100}];
 worldTimeMs=DAY_MS/2;updateSunVector();_emitFrame=-1;`);
const nativeFill=ctx.fill;let legacyShadowPaints=0;ctx.fill=()=>legacyShadowPaints++;
P('drawBuildingShadows();');ctx.fill=nativeFill;
assert.equal(legacyShadowPaints,0,'Closed cave geometry does not receive legacy outdoor shadow paint');checks++;
ok('sceneLightDaylight()===0&&sceneLightAmbient()===UNDERGROUND_AMBIENT&&UNDERGROUND_AMBIENT<.2',
 'Noon has no underground sunlight and retains a small playable ambient floor');
P('var caveLightAtNoon=sceneLightAmbient();worldTimeMs=0;updateSunVector();');
ok('sceneLightDaylight()===0&&sceneLightAmbient()===caveLightAtNoon','Surface time cannot brighten or darken the chamber');
P('var dungeonSources=sceneEmitters();');
ok('dungeonSources.length>1&&dungeonSources.every(l=>l.undergroundTorch||l.undergroundFlashlight)',
 'The authored chamber gathers only tiki torches and the carried flashlight');
ok('dungeonSources[0].undergroundFlashlight&&dungeonSources[0].d2===-1',
 'The carried flashlight always owns the first lighting slot');
ok('dungeonSources.filter(l=>l.undergroundTorch).every(l=>l.c[0]>l.c[1]&&l.c[1]>l.c[2]&&l.z===38)',
 'Tiki sources carry warm color and stand above the ground');
ok('dungeonSources[0].z===24&&dungeonSources[0].r===460&&dungeonSources[0].half<1&&dungeonSources[0].rMin>=38',
 'The flashlight has a forward cone and clears its bearer for occlusion');
ok('dungeonSources.every((l,i)=>!i||l.d2>=dungeonSources[i-1].d2)',
 'Fixed lamps spend the shared bounded budget nearest first');
for(const key of ['PISTOL','REVOLVER','SHOTGUN','BOW']) {
 P(`player.currentWeapon=WEAPONS.${key};frameCount++;`);
 ok('sceneEmitters()[0].undergroundFlashlight','A '+key+' does not remove the carried dungeon light');
}
P(`setMeleeTool('SHOVEL');frameCount++;`);
ok('sceneEmitters()[0].undergroundFlashlight','Holstering a gun for the shovel retains the flashlight');
P('player.hp=0;frameCount++;');
ok('sceneEmitters().every(l=>!l.undergroundFlashlight)','A dead player no longer carries an active beam');
P('player.hp=100;currentLevel=8;_emitFrame=-1;sceneEmitters();currentLevel=9;');
ok('sceneEmitters()[0].undergroundFlashlight','Entering Level9 in the same render frame cannot reuse the old interior light list');
P('GLRig.lightTier=0;GLRig.ms=16;worldTimeMs=DAY_MS/2;updateSunVector();var caveBudget=glRigLightBudget();worldTimeMs=0;updateSunVector();');
ok('glRigLightBudget()===caveBudget&&caveBudget>=GLRIG_LIGHTS_MIN','The dungeon retains its local-light budget at every surface hour');

// Exercise the native canvas fallback and inspect the darkness it paints.
const create=ctx.createGraphics,paints=[];
ctx.createGraphics=(...args)=>{const g=create(...args),fill=g.fill;g.fill=(...values)=>{paints.push(values);fill.apply(g,values);};return g;};
P('_lightBuf=null;frameCount++;worldTimeMs=DAY_MS/2;updateSunVector();drawLightPass();');
assert.ok(paints.some(v=>v[0]===0&&v[1]===0&&v[2]===0&&Math.abs(v[3]-(1-.16)*255)<1e-8),
 'The canvas fallback paints the same neutral 16% ambient darkness');checks++;
ctx.createGraphics=create;
P('var previousLightImage=image,gradeImages=0;image=function(){gradeImages++;};drawBiomeScreenLayer();image=previousLightImage;');
ok('gradeImages===0&&!_rigTookHaze','Surface fog and golden-hour grading cannot be applied over the chamber');

// Run the production GL frame against a recording context: its scene uniforms
// must agree with the canvas fallback, not merely a helper used only by one.
const uniforms={};let program='';
const gl=new Proxy({}, {get(target,key){
 if(key==='useProgram')return value=>{program=value.name;};
 if(String(key).startsWith('uniform'))return (name,...values)=>{uniforms[program+'.'+name]=values;};
 if(typeof key==='string'&&key===key.toUpperCase())return 0;
 return ()=>{};
}});
ctx.__caveTestGL=gl;
P(`var savedCaveGl={clock:glRigClock,active:glRigActive,paint:glRigPaintHeight,upload:glRigUploadCanvas,
 bind:glRigBindTex,draw:glRigDraw,watch:glRigWatchdog};
 glRigClock=function(){};glRigActive=function(){return true;};glRigPaintHeight=function(){};
 glRigUploadCanvas=glRigBindTex=glRigDraw=glRigWatchdog=function(){};
 GLRig.gl=__caveTestGL;GLRig.w=width;GLRig.h=height;GLRig.lw=width/2;GLRig.lh=height/2;
 GLRig.hw=width/2;GLRig.hh=height/2;GLRig.hgt={canvas:{}};GLRig.resize=false;GLRig.canvas={};GLRig.tex={diffuse:{},height:{},atlas:{}};
 for(const key of ['normal','light','occ','polar'])GLRig.fbo[key]={fbo:{},tex:{}};
 for(const key of ['normal','sun','occ','polar','light','comp'])GLRig.prog[key]={name:key,_u:new Proxy({},{get:(_,k)=>k})};
 worldTimeMs=DAY_MS/2;updateSunVector();frameCount++;var dungeonGlFrame=glRigFrame();`);
ok('dungeonGlFrame','The native WebGL frame completes with the underground scene terms');
assert.deepEqual(uniforms['sun.uSunPow'],[0],'The underground GPU path casts no sun');checks++;
assert.deepEqual(uniforms['sun.uSpec'],[0],'The underground GPU path adds no sunlight highlights');checks++;
assert.ok(uniforms['sun.uAmbCol'].every(v=>Math.abs(v-.16)<1e-10),'The GPU ambient matches the neutral canvas fallback');checks++;
assert.deepEqual(uniforms['comp.uHazeA'],[0],'The GPU composite carries no surface fog underground');checks++;
assert.deepEqual(uniforms['comp.uVignette'],[.12],'The cave uses a small neutral vignette');checks++;
P(`glRigClock=savedCaveGl.clock;glRigActive=savedCaveGl.active;glRigPaintHeight=savedCaveGl.paint;
 glRigUploadCanvas=savedCaveGl.upload;glRigBindTex=savedCaveGl.bind;glRigDraw=savedCaveGl.draw;glRigWatchdog=savedCaveGl.watch;
 currentLevel=currentBiome=1;BIOME_ACTIVE=true;worldTimeMs=DAY_MS/2;updateSunVector();`);
ok('sceneLightDaylight()===daylight()&&sceneLightAmbient()===.50+.50*daylight()',
 'Returning to the surface preserves the original daylight model');
console.log('Underground lighting: '+checks+' emitter, ambient, fallback and native GPU uniform checks passed.');

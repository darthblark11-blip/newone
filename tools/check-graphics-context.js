// Diagnostics must describe existing contexts without probing a new GPU or
// turning a WebGL/ANGLE/Vulkan label into an unsupported hardware claim.
const assert=require('node:assert/strict');
const {ctx,probe:P}=require('./harness');
let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const info=gl=>ctx.gameGraphicsContextInfo(gl);
function context(renderer,options={}){
 const calls={parameters:0,extensions:0,attributes:0,lost:0};
 const gl={VENDOR:1,RENDERER:2,VERSION:3,SHADING_LANGUAGE_VERSION:4,
  currentRenderer:renderer,contextLost:false,
  attributes:{alpha:true,depth:true,preserveDrawingBuffer:true,powerPreference:'default'},
  getParameter(key){calls.parameters++;if(options.throwParameters)throw Error('Privacy restricted');
   return {1:'WebKit',2:options.masked||'WebKit WebGL',3:'WebGL 2.0 (OpenGL ES 3.0 Chromium)',
    4:'WebGL GLSL ES 3.00',5:options.vendor||'Reported driver vendor',6:gl.currentRenderer}[key];},
  getExtension(){calls.extensions++;if(options.throwExtension)throw Error('Extension restricted');
   return options.maskedOnly?null:{UNMASKED_VENDOR_WEBGL:5,UNMASKED_RENDERER_WEBGL:6};},
  getContextAttributes(){calls.attributes++;return gl.attributes;},
  isContextLost(){calls.lost++;return gl.contextLost;}};
 return {gl,calls};
}
ok(info(null).state==='not-created','no context is reported as not created');
ok(info({}).state==='unavailable','a non-WebGL host object is unavailable');
ok(info(null).renderer===null&&info(null).backend==='unknown','uncreated contexts do not invent a GPU');
const optionalHelper=ctx.gameGraphicsContextInfo;
try{ctx.gameGraphicsContextInfo=undefined;
 ok(P('Player3D.getDiagnostics().context===null'),'the standalone renderer remains usable without the optional shared helper');
}finally{ctx.gameGraphicsContextInfo=optionalHelper;}

for(const [renderer,backend,acceleration]of[
 ['ANGLE (Qualcomm, Adreno (TM) 740, Vulkan 1.3.0)','vulkan','hardware-reported'],
 ['ANGLE (Samsung, Xclipse 940, Vulkan 1.3.0)','vulkan','hardware-reported'],
 ['ANGLE (ARM, Mali-G715, OpenGL ES 3.2)','opengl','hardware-reported'],
 ['ANGLE (Apple, Apple M3, Metal)','metal','hardware-reported'],
 ['ANGLE (Intel, Intel Iris Xe, Direct3D11)','d3d','hardware-reported'],
 ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))','vulkan','software'],
 ['ANGLE (Microsoft, Direct3D11 WARP)','d3d','software'],
 ['Mesa llvmpipe (LLVM 15.0.7, 256 bits)','unknown','software'],
 ['Mesa lavapipe Vulkan 1.3','vulkan','software'],
 ['Mesa softpipe','unknown','software'],
 ['ANGLE (Microsoft Basic Render Driver, D3D11)','d3d','software'],
 ['ANGLE','unknown','unknown']
]){
 const {gl}=context(renderer),row=info(gl);
 ok(row.backend===backend,renderer+' reports only its explicit backend');
 ok(row.acceleration===acceleration,renderer+' keeps hardware and software evidence distinct');
}

const cached=context('ANGLE (Qualcomm, Adreno 740, Vulkan 1.3.0)'),first=info(cached.gl);
const reads=JSON.stringify(cached.calls);
for(let i=0;i<1000;i++)assert.equal(info(cached.gl),first);
ok(JSON.stringify(cached.calls)===reads,'one thousand repeat reports make no additional driver queries');
ok(first.contextAttributes.powerPreference==='default'&&first.requestedPowerPreference==='high-performance',
 'a high-performance request does not pretend that the browser honored it');
ok(Object.isFrozen(first)&&Object.isFrozen(first.contextAttributes),'callers cannot mutate cached metadata');
cached.gl.attributes.powerPreference='low-power';
ok(info(cached.gl).contextAttributes.powerPreference==='default','reported attributes are a snapshot, not a live mutable host object');
cached.gl.currentRenderer='ANGLE (Google, Vulkan SwiftShader)';ctx.gameGraphicsForgetContext(cached.gl);
ok(info(cached.gl).acceleration==='software'&&cached.calls.parameters>JSON.parse(reads).parameters,
 'explicit lifecycle invalidation refreshes changed driver information');

const masked=context('unused',{maskedOnly:true,masked:'ANGLE'}),maskedInfo=info(masked.gl);
ok(maskedInfo.unmaskedRenderer===null&&maskedInfo.acceleration==='unknown','privacy-masked ANGLE is not proof of hardware acceleration');
ok(maskedInfo.backend==='unknown','OpenGL ES text in the WebGL version does not imply an OpenGL driver backend');
const privateContext=context('unused',{throwExtension:true,throwParameters:true});
ok(info(privateContext.gl).renderer===null&&info(privateContext.gl).backend==='unknown',
 'privacy exceptions produce unavailable fields rather than breaking the game');
const lost=context('ANGLE (Qualcomm, Adreno 740, Vulkan)');lost.gl.contextLost=true;
ok(info(lost.gl).state==='lost'&&lost.calls.parameters===0,'a lost context does not query invalid driver parameters');
const lostReads=JSON.stringify(lost.calls);info(lost.gl);
ok(JSON.stringify(lost.calls)===lostReads,'lost context metadata is bounded too');
lost.gl.contextLost=false;ctx.gameGraphicsForgetContext(lost.gl);
ok(info(lost.gl).state==='ready','restoration invalidation permits a fresh ready report');

// The public API reads the existing owners, including an uncreated character
// renderer, without initializing any renderer or manufacturing a test canvas.
const nativeDocument=ctx.document,lighting=context('ANGLE (Qualcomm, Adreno 740, Vulkan)');
let creations=0;ctx.document={createElement(){creations++;throw Error('A diagnostic tried to create a context');}};
ctx.__graphicsFixture=lighting.gl;
ctx.navigator={userAgent:'Mozilla/5.0 (Linux; Android 15; device; wv) AppleWebKit/537.36 Version/4.0 Chrome/140 Mobile Safari/537.36'};
ctx.location={href:'http://localhost:7700/index.html'};ctx.isSecureContext=true;
try{
 P("GLRig.gl=__graphicsFixture;GLRig.on=GLRig.ok=true;GLRig.contextState='ready';");
 const report=ctx.getGameGraphicsDiagnostics();
 ok(creations===0&&report.characters.context.state==='not-created','reporting never creates a missing character context');
 ok(report.lighting.ready&&report.lighting.context.backend==='vulkan','the public report reads the actual lighting owner');
 ok(report.environment.androidWebViewHint===true&&report.environment.url===ctx.location.href,
  'the report identifies the local WebView environment without assuming its driver');
 const beforeLost=JSON.stringify(lighting.calls);
 P("gameGraphicsForgetContext(GLRig.gl);GLRig.contextState='lost';GLRig.ok=GLRig.on=false;");
 const lostReport=ctx.getGameGraphicsDiagnostics();
 ok(lostReport.lighting.context.state==='lost'&&!lostReport.lighting.ready&&JSON.stringify(lighting.calls)===beforeLost,
  'loss is reported without querying or labeling the previous hardware as current');
 P("gameGraphicsForgetContext(GLRig.gl);GLRig.contextState='ready';GLRig.ok=GLRig.on=true;");
 ok(ctx.getGameGraphicsDiagnostics().lighting.context.state==='ready','a restored owner refreshes its physical-context report');
}finally{ctx.document=nativeDocument;}
console.log(checks+' actual-owner, cached-query, software/backend, privacy and lifecycle diagnostic checks passed');

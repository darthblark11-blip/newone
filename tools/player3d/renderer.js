// The Blender exporter and this renderer are embedded into game.js at build time.
// The offscreen canvas is deliberately not a DOM overlay: its pixels are painted
// at the existing actor/body-part slot, under that slot's transform and clip.
const Player3D = (() => {
  'use strict';
  const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
uniform mat4 uModel;
uniform mat3 uNormal;
uniform vec4 uBounds;
uniform vec2 uDepth;
uniform float uOutline;
out vec3 vNormal;
void main() {
  vec3 n = normalize(uNormal * aNormal);
  vec3 p = (uModel * vec4(aPosition, 1.0)).xyz + n * uOutline;
  gl_Position = vec4((p.x-uBounds.x)*uBounds.z*2.0-1.0,
    1.0-(p.y-uBounds.y)*uBounds.w*2.0,
    1.0-(p.z-uDepth.x)*uDepth.y*2.0, 1.0);
  vNormal = n;
}`;
  const fragmentSource = `#version 300 es
precision highp float;
in vec3 vNormal;
uniform vec3 uLight;
uniform vec3 uColor;
uniform vec3 uBands;
uniform vec2 uThresholds;
uniform float uInk;
uniform float uAlpha;
out vec4 oColor;
void main() {
  float diffuse = dot(normalize(vNormal), uLight)*0.5+0.5;
  float shade = diffuse < uThresholds.x ? uBands.x :
    diffuse < uThresholds.y ? uBands.y : uBands.z;
  vec3 color = mix(uColor*shade, vec3(0.055,0.045,0.055), uInk);
  oColor = vec4(color, uAlpha);
}`;
  const stats = { draws:0, meshUploads:0, triangles:0, gpuDrawCalls:0,
    contextLosses:0, contextRestores:0, resizes:0, failures:0,
    bufferCreates:0, programCreates:0, stainDraws:0, lastDrawMs:0, totalDrawMs:0 };
  const normal = new Float32Array(9), color = new Float32Array(3);
  const stainMatrix=new Float32Array([0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,1]);
  const emptyOptions={}, defaultBands=[.48,.78,1.06], defaultThresholds=[.32,.72], defaultColor=[.65,.65,.68];
  const bounds = new Float64Array(6);
  let canvas = null, gl = null, program = null, uniforms = null;
  let meshes = Object.create(null), source = null, failure = '', failed = false;
  let lost = false, generation = 0;
  const now = () => typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  const api = { enabled:true, maxSize:1024, stats, ensure, draw, validateAsset, dispose,
    get canvas(){return canvas;}, get gl(){return gl;},
    get failure(){return failure;}, get ready(){return !!program&&!lost&&!failed;},
    getDiagnostics(){return {enabled:api.enabled,ready:api.ready,failure,generation,
      width:canvas?canvas.width:0,height:canvas?canvas.height:0,...stats};} };

  function validateAsset(asset) {
    const errors = []; let triangles = 0, count = 0;
    if (!asset || asset.schemaVersion !== 1 || !asset.meshes) {
      return {ok:false,errors:['Expected Blender player mesh schemaVersion 1'],meshes:0,triangles:0};
    }
    for (const name of Object.keys(asset.meshes)) {
      const mesh = asset.meshes[name], p = mesh.positions, n = mesh.normals, ix = mesh.indices;
      count++;
      if (!p || !n || !ix || !p.length || p.length%3 || n.length!==p.length || !ix.length || ix.length%3) {
        errors.push(name+': invalid vertex/normal/index lengths'); continue;
      }
      let invalid = false;
      for (let i=0;i<p.length;i++) if (!Number.isFinite(p[i]) || !Number.isFinite(n[i])) {invalid=true;break;}
      if (invalid) errors.push(name+': non-finite geometry');
      for (let i=0;i<n.length;i+=3) {
        const length=Math.hypot(n[i],n[i+1],n[i+2]);
        if (length<.9 || length>1.1) {errors.push(name+': invalid normal length');break;}
      }
      const vertices=p.length/3;
      for (let i=0;i<ix.length;i++) if (!Number.isInteger(ix[i]) || ix[i]<0 || ix[i]>=vertices) {
        errors.push(name+': index outside vertex range');break;
      }
      if (mesh.materialGroups) for (const group of mesh.materialGroups) {
        if (!Number.isInteger(group.start)||!Number.isInteger(group.count)||group.start<0||group.count<0||
          group.start%3||group.count%3||group.start+group.count>ix.length) {
          errors.push(name+': invalid material group');break;
        }
      }
      triangles+=ix.length/3;
    }
    if (!count) errors.push('No player meshes');
    return {ok:errors.length===0,errors,meshes:count,triangles};
  }

  function shader(type, text) {
    const s=gl.createShader(type);
    if(!s) throw Error('Unable to allocate player shader');
    gl.shaderSource(s,text);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) {
      const message=gl.getShaderInfoLog(s)||'Player shader compilation failed';
      gl.deleteShader(s);throw Error(message);
    }
    return s;
  }

  function releaseResources() {
    if(gl&&!lost) {
      for(const name of Object.keys(meshes)) {
        const mesh=meshes[name];
        for(const buffer of mesh.buffers) gl.deleteBuffer(buffer);
        gl.deleteVertexArray(mesh.vao);
      }
      if(program) gl.deleteProgram(program);
    }
    meshes=Object.create(null);program=null;uniforms=null;
  }

  function contextLost(event) {
    event.preventDefault();lost=true;stats.contextLosses++;
    failure='Player WebGL context lost; native rendering remains available';
    // Lost WebGL handles cannot be reused after restoration.
    meshes=Object.create(null);program=null;uniforms=null;
  }

  function contextRestored() {
    lost=false;failed=false;failure='';stats.contextRestores++;
    // Rebuild lazily when the next player is actually visible.
  }

  function ensure(asset) {
    if(!api.enabled||lost) return false;
    asset=asset||(typeof PLAYER3D_ASSET!=='undefined'?PLAYER3D_ASSET:null);
    if(!asset) return false;
    if(source!==asset) {releaseResources();source=asset;failed=false;failure='';}
    if(program) return true;
    if(failed) return false;
    try {
      const checked=validateAsset(asset);
      if(!checked.ok) throw Error(checked.errors.join('; '));
      if(!canvas) {
        if(typeof document==='undefined'||!document.createElement) return false;
        canvas=document.createElement('canvas');canvas.width=canvas.height=32;
        canvas.addEventListener('webglcontextlost',contextLost,false);
        canvas.addEventListener('webglcontextrestored',contextRestored,false);
      }
      if(!gl) gl=canvas.getContext('webgl2',{alpha:true,depth:true,stencil:true,
        antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true,
        powerPreference:'low-power',failIfMajorPerformanceCaveat:false});
      if(!gl) throw Error('WebGL2 is unavailable for the player renderer');
      const vertex=shader(gl.VERTEX_SHADER,vertexSource),fragment=shader(gl.FRAGMENT_SHADER,fragmentSource);
      program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);
      gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program)||'Player shader link failed');
      stats.programCreates++;uniforms={};
      for(const name of ['uModel','uNormal','uBounds','uDepth','uOutline','uLight','uColor','uBands','uThresholds','uInk','uAlpha'])
        uniforms[name]=gl.getUniformLocation(program,name);
      for(const name of Object.keys(asset.meshes)) {
        const mesh=asset.meshes[name],vao=gl.createVertexArray(),buffers=[];
        gl.bindVertexArray(vao);
        for(const [location,values] of [[0,mesh.positions],[1,mesh.normals]]) {
          const buffer=gl.createBuffer();buffers.push(buffer);
          gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.STATIC_DRAW);
          gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);
        }
        const buffer=gl.createBuffer();buffers.push(buffer);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,buffer);
        const wide=mesh.positions.length/3>65535,indexData=wide?new Uint32Array(mesh.indices):new Uint16Array(mesh.indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indexData,gl.STATIC_DRAW);
        const box=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
        for(let i=0;i<mesh.positions.length;i+=3)for(let j=0;j<3;j++) {
          box[j]=Math.min(box[j],mesh.positions[i+j]);box[j+3]=Math.max(box[j+3],mesh.positions[i+j]);
        }
        meshes[name]={vao,buffers,box,geometry:mesh,count:mesh.indices.length,
          type:wide?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,bytes:wide?4:2,
          material:mesh.material,groups:mesh.materialGroups&&mesh.materialGroups.length?mesh.materialGroups:
            [{start:0,count:mesh.indices.length,material:mesh.material}]};
        stats.meshUploads++;stats.bufferCreates+=3;
      }
      gl.bindVertexArray(null);stats.triangles=checked.triangles;generation++;failed=false;failure='';
      return true;
    } catch(error) {
      failure=String(error&&error.message||error);failed=true;stats.failures++;
      releaseResources();return false;
    }
  }

  function contains(list,value) {
    return typeof list.has==='function'?list.has(value):list.indexOf(value)!==-1;
  }

  function selected(part, options) {
    const name=part.part||part.name||part.mesh;
    return (!options.includeParts||contains(options.includeParts,name))&&
      (!options.excludeParts||!contains(options.excludeParts,name));
  }

  function validMatrix(m) {
    if(!m||m.length!==16) return false;
    for(let i=0;i<16;i++) if(!Number.isFinite(m[i])) return false;
    return true;
  }

  function normalMatrix(m) {
    const ax=m[0],ay=m[1],az=m[2],bx=m[4],by=m[5],bz=m[6],cx=m[8],cy=m[9],cz=m[10];
    const x=by*cz-bz*cy,y=bz*cx-bx*cz,z=bx*cy-by*cx;
    const determinant=ax*x+ay*y+az*z;
    if(Math.abs(determinant)<1e-12) return 0;
    const inv=1/determinant;
    normal[0]=x*inv;normal[1]=y*inv;normal[2]=z*inv;
    normal[3]=(cy*az-cz*ay)*inv;normal[4]=(cz*ax-cx*az)*inv;normal[5]=(cx*ay-cy*ax)*inv;
    normal[6]=(ay*bz-az*by)*inv;normal[7]=(az*bx-ax*bz)*inv;normal[8]=(ax*by-ay*bx)*inv;
    return determinant;
  }

  function measure(snapshot,options) {
    bounds[0]=bounds[1]=bounds[2]=Infinity;bounds[3]=bounds[4]=bounds[5]=-Infinity;
    let count=0;
    for(const part of snapshot.parts) {
      const mesh=meshes[part.mesh],m=part.matrix;
      if(!mesh||!selected(part,options)||!validMatrix(m)) continue;
      const b=mesh.box;
      for(let corner=0;corner<8;corner++) {
        const x=b[corner&1?3:0],y=b[corner&2?4:1],z=b[corner&4?5:2];
        for(let row=0;row<3;row++) {
          const value=m[row]*x+m[row+4]*y+m[row+8]*z+m[row+12];
          bounds[row]=Math.min(bounds[row],value);bounds[row+3]=Math.max(bounds[row+3],value);
        }
      }
      count++;
    }
    return count;
  }

  function groupColor(part,mesh,group) {
    let value=part.materials&&part.materials[group.material],byteColor=false;
    if(!value&&part.color&&(group.material===mesh.material||part.overrideMaterials)) {
      value=part.color.levels||part.color;byteColor=true;
    }
    if(!value) value=source.palette&&source.palette[group.material];
    if(!value) {value=part.color&& (part.color.levels||part.color);byteColor=!!value;}
    value=value||defaultColor;
    // Exporter palette is normalized sRGB; actor color overrides use p5 bytes.
    const k=byteColor?1/255:1;
    color[0]=value[0]*k;color[1]=value[1]*k;color[2]=value[2]*k;
    gl.uniform3fv(uniforms.uColor,color);
  }

  function pass(snapshot,options,ink,outline) {
    gl.uniform1f(uniforms.uInk,ink);gl.uniform1f(uniforms.uOutline,outline);
    gl.cullFace(ink?gl.FRONT:gl.BACK);gl.depthMask(!ink);
    const markParts=!ink&&snapshot.stains&&snapshot.stains.length;
    if(markParts){gl.enable(gl.STENCIL_TEST);gl.stencilMask(255);gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE);}
    else gl.disable(gl.STENCIL_TEST);
    for(let partIndex=0;partIndex<snapshot.parts.length;partIndex++) {
      const part=snapshot.parts[partIndex];
      const mesh=meshes[part.mesh],matrix=part.matrix;
      if(!mesh||!selected(part,options)||!validMatrix(matrix)) continue;
      const determinant=normalMatrix(matrix);if(!determinant)continue;
      if(markParts)gl.stencilFunc(gl.ALWAYS,partIndex%254+1,255);
      // The overhead projection flips Y. Mirrored part transforms flip it back.
      gl.frontFace(determinant<0?gl.CCW:gl.CW);
      gl.uniformMatrix4fv(uniforms.uModel,false,matrix);gl.uniformMatrix3fv(uniforms.uNormal,false,normal);
      gl.uniform1f(uniforms.uAlpha,Number.isFinite(part.alpha)?Math.max(0,Math.min(1,part.alpha)):1);
      gl.bindVertexArray(mesh.vao);
      if(ink) {gl.drawElements(gl.TRIANGLES,mesh.count,mesh.type,0);stats.gpuDrawCalls++;}
      else for(const group of mesh.groups) {
        groupColor(part,mesh,group);
        gl.drawElements(gl.TRIANGLES,group.count,mesh.type,group.start*mesh.bytes);stats.gpuDrawCalls++;
      }
    }
  }

  // Intersect the overhead ray with the exported triangles, rather than using
  // a guessed torso/head height. This is only evaluated for visible wounds.
  function stainSurface(part,x,y) {
    const mesh=meshes[part.mesh],geometry=mesh.geometry,p=geometry.positions,ix=geometry.indices,m=part.matrix;
    let top=-Infinity;
    for(let i=0;i<ix.length;i+=3) {
      const ai=ix[i]*3,bi=ix[i+1]*3,ci=ix[i+2]*3;
      const ax=m[0]*p[ai]+m[4]*p[ai+1]+m[8]*p[ai+2]+m[12];
      const ay=m[1]*p[ai]+m[5]*p[ai+1]+m[9]*p[ai+2]+m[13];
      const bx=m[0]*p[bi]+m[4]*p[bi+1]+m[8]*p[bi+2]+m[12];
      const by=m[1]*p[bi]+m[5]*p[bi+1]+m[9]*p[bi+2]+m[13];
      const cx=m[0]*p[ci]+m[4]*p[ci+1]+m[8]*p[ci+2]+m[12];
      const cy=m[1]*p[ci]+m[5]*p[ci+1]+m[9]*p[ci+2]+m[13];
      if(x<Math.min(ax,bx,cx)-.001||x>Math.max(ax,bx,cx)+.001||y<Math.min(ay,by,cy)-.001||y>Math.max(ay,by,cy)+.001)continue;
      const denominator=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(denominator)<1e-10)continue;
      const a=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/denominator;
      const b=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/denominator,c=1-a-b;
      if(a<-.0001||b<-.0001||c<-.0001)continue;
      const az=m[2]*p[ai]+m[6]*p[ai+1]+m[10]*p[ai+2]+m[14];
      const bz=m[2]*p[bi]+m[6]*p[bi+1]+m[10]*p[bi+2]+m[14];
      const cz=m[2]*p[ci]+m[6]*p[ci+1]+m[10]*p[ci+2]+m[14];
      top=Math.max(top,a*az+b*bz+c*cz);
    }
    return top;
  }

  function drawStains(snapshot,options) {
    const cap=meshes.cap;if(!cap||!snapshot.stains||!snapshot.stains.length)return;
    gl.enable(gl.STENCIL_TEST);gl.stencilMask(0);gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);
    gl.depthMask(false);gl.cullFace(gl.BACK);gl.frontFace(gl.CW);
    gl.uniform1f(uniforms.uInk,0);gl.uniform1f(uniforms.uOutline,0);gl.bindVertexArray(cap.vao);
    for(const stain of snapshot.stains) {
      if(!Number.isFinite(stain.x)||!Number.isFinite(stain.y)||!Number.isFinite(stain.size)||stain.size<=0)continue;
      const partIndex=snapshot.parts.findIndex(p=>(p.part||p.name||p.mesh)===(stain.part||'torso'));
      if(partIndex<0)continue;
      const part=snapshot.parts[partIndex];if(!selected(part,options)||!meshes[part.mesh]||!validMatrix(part.matrix))continue;
      const z=stainSurface(part,stain.x,stain.y);if(!Number.isFinite(z))continue;
      // The cap is authored in the YZ plane. Rotate its thin X dimension into
      // height and retain the native wound diameter in the overhead plane.
      stainMatrix[6]=stainMatrix[9]=0;
      stainMatrix[2]=.08;stainMatrix[4]=stain.size;stainMatrix[9]=stain.size;
      stainMatrix[12]=stain.x;stainMatrix[13]=stain.y;stainMatrix[14]=z+.08;
      normalMatrix(stainMatrix);
      gl.uniformMatrix4fv(uniforms.uModel,false,stainMatrix);gl.uniformMatrix3fv(uniforms.uNormal,false,normal);
      const value=stain.color&&(stain.color.levels||stain.color)||[102,4,14,220];
      color[0]=value[0]/255;color[1]=value[1]/255;color[2]=value[2]/255;gl.uniform3fv(uniforms.uColor,color);
      gl.uniform1f(uniforms.uAlpha,value[3]===undefined?1:Math.max(0,Math.min(1,value[3]/255)));
      // A part ID is written only by visible base fragments. Blood therefore
      // stays inside its actual surface silhouette and beneath crossing limbs.
      gl.stencilFunc(gl.EQUAL,partIndex%254+1,255);
      gl.drawElements(gl.TRIANGLES,cap.count,cap.type,0);stats.gpuDrawCalls++;stats.stainDraws++;
    }
    gl.stencilMask(255);gl.disable(gl.STENCIL_TEST);
  }

  function draw(snapshot,targetContext,options) {
    options=options||emptyOptions;
    const context=targetContext&&(targetContext.drawingContext||targetContext);
    if(!api.enabled||!snapshot||!Array.isArray(snapshot.parts)||!context||typeof context.drawImage!=='function'||!ensure()) return false;
    if(gl.isContextLost()){lost=true;return false;}
    const started=now();
    try {
      if(!measure(snapshot,options)) return true;
      const transform=typeof context.getTransform==='function'?context.getTransform():null;
      const sx=transform?Math.hypot(transform.a,transform.b):1,sy=transform?Math.hypot(transform.c,transform.d):1;
      const quality=Number.isFinite(options.resolutionScale)?Math.max(.25,options.resolutionScale):1;
      const scale=Math.max(.1,sx,sy),outline=options.outline===false?0:Math.min(.55,Math.max(.12,.85/scale));
      const pad=outline+1;
      const x=bounds[0]-pad,y=bounds[1]-pad,w=Math.max(.1,bounds[3]-bounds[0]+pad*2),h=Math.max(.1,bounds[4]-bounds[1]+pad*2);
      const limit=Math.max(32,Math.min(2048,api.maxSize||1024));
      const pixelW=Math.max(16,Math.min(limit,Math.ceil(w*sx*quality))),pixelH=Math.max(16,Math.min(limit,Math.ceil(h*sy*quality)));
      // Grow a bucketed backing canvas, but render/clear only the used rectangle.
      // Alternating a standing actor and wide corpse never reallocates it per draw.
      let backingW=canvas.width,backingH=canvas.height;
      while(backingW<pixelW)backingW*=2;while(backingH<pixelH)backingH*=2;
      if(backingW!==canvas.width||backingH!==canvas.height) {
        canvas.width=backingW;canvas.height=backingH;stats.resizes++;
      }
      gl.useProgram(program);gl.enable(gl.SCISSOR_TEST);
      gl.viewport(0,canvas.height-pixelH,pixelW,pixelH);gl.scissor(0,canvas.height-pixelH,pixelW,pixelH);
      gl.colorMask(true,true,true,true);gl.depthMask(true);gl.stencilMask(255);
      gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.clearStencil(0);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);
      gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.STENCIL_TEST);gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.uniform4f(uniforms.uBounds,x,y,1/w,1/h);
      const minZ=bounds[2]-pad,maxZ=bounds[5]+pad;
      gl.uniform2f(uniforms.uDepth,minZ,1/Math.max(.1,maxZ-minZ));
      const dx=typeof LIGHT_DX==='number'?LIGHT_DX:.6,dy=typeof LIGHT_DY==='number'?LIGHT_DY:.8;
      const slope=typeof shadowLengthScale==='function'?1/Math.max(.35,shadowLengthScale()*1.35):.8;
      let lx=-dx,ly=-dy;
      if(transform) {
        const determinant=transform.a*transform.d-transform.b*transform.c;
        if(Math.abs(determinant)>1e-12) {
          const x=(transform.d*lx-transform.c*ly)/determinant;
          const y=(-transform.b*lx+transform.a*ly)/determinant;
          const length=Math.hypot(x,y),magnitude=Math.hypot(dx,dy);
          if(length>1e-12){lx=x/length*magnitude;ly=y/length*magnitude;}
        }
      }
      const length=Math.hypot(dx,dy,slope)||1;
      // Mesh coordinates have screen-down Y; the world's shadow bearing points
      // away from the sun. Absolute daylight/lamps remain in the world pass.
      gl.uniform3f(uniforms.uLight,lx/length,ly/length,slope/length);
      const toon=source.toon||emptyOptions,bands=toon.bands||defaultBands,thresholds=toon.thresholds||defaultThresholds;
      gl.uniform3f(uniforms.uBands,bands[0],bands[1],bands[2]);
      gl.uniform2f(uniforms.uThresholds,thresholds[0],thresholds[1]);
      if(outline) pass(snapshot,options,1,outline);
      pass(snapshot,options,0,0);drawStains(snapshot,options);gl.bindVertexArray(null);gl.depthMask(true);
      // Immediate copy is required: another actor/part can reuse this canvas in
      // the same frame, including an offscreen p5.Graphics corpse stamp.
      context.drawImage(canvas,0,0,pixelW,pixelH,x,y,w,h);
      stats.draws++;stats.lastDrawMs=now()-started;stats.totalDrawMs+=stats.lastDrawMs;
      return true;
    } catch(error) {
      failure=String(error&&error.message||error);stats.failures++;
      if(gl&&gl.isContextLost())lost=true;
      return false;
    }
  }

  function dispose() {
    releaseResources();
    if(canvas) {
      canvas.removeEventListener('webglcontextlost',contextLost,false);
      canvas.removeEventListener('webglcontextrestored',contextRestored,false);
    }
    canvas=null;gl=null;source=null;lost=false;failed=false;failure='';
  }
  return api;
})();

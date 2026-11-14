// Pure camera math: no browser or game simulation is needed for these checks.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'player3d/view.js'),'utf8');
const sandbox={width:1200,height:900,zoom:1};vm.createContext(sandbox);
vm.runInContext(source+'\nglobalThis.cameraMath=Player3DView;',sandbox);
const V=sandbox.cameraMath;let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const close=(actual,expected,label,tolerance=1e-9)=>ok(Math.abs(actual-expected)<=tolerance,label+': '+actual+' ~= '+expected);
const canvas={width:1200,height:900};let reads=0;
function context(matrix,host=canvas){return {canvas:host,getTransform(){reads++;return Object.freeze({...matrix});}};}
const matrix=(scale=1,e=600,f=450)=>({a:scale,b:0,c:0,d:scale,e,f});
const main=context(matrix());sandbox.drawingContext=main;
const point=Object.freeze({x:13,y:-8,z:30});
for(const options of [undefined,{},null,{view:false},{view:0},{view:'true'},{view:[]},{view:{enabled:false}}]) {
 const before=reads,view=V.resolve(main,options);ok(!view.enabled,'view is opt-in');
 close(reads,before,'disabled view does not inspect Canvas state');
 const result=V.project(point,view);close(result.x,13,'ortho x');close(result.y,-8,'ortho y');close(result.z,30,'ortho z');close(result.w,1,'ortho w');
}
let view=V.resolve(main,{view:true});ok(view.enabled,'main Canvas enables camera');
close(view.offsetX,0,'principal x');close(view.offsetY,0,'principal y');close(view.height,1080,'viewport focal height');
close(V.project(point,view).x,13/(1-30/1080),'finite pinhole scale at center');
const offscreen=context(matrix(),{width:1200,height:900});
ok(!V.resolve(offscreen,{view:true}).enabled,'offscreen stamp retains orthographic projection');
ok(V.resolve(offscreen,{view:{}}).enabled,'explicit camera opts offscreen into finite view');
const manual=Object.freeze({offsetX:320,offsetY:-190,height:900,pivotZ:12});
const manualView=V.resolve(null,{view:manual},60);ok(manualView.enabled,'explicit descriptor works without Canvas');
for(const key of ['offsetX','offsetY','height','pivotZ'])close(manualView[key],manual[key],'explicit '+key);
close(manualView.principalX,0,'manual camera has finite principal x');
close(manualView.principalY,0,'manual camera has finite principal y');
const fixed=V.projectXYZ(-27,41,12,manualView);close(fixed.x,-27,'reference plane preserves native x');close(fixed.y,41,'reference plane preserves native y');
const result={retained:true};ok(V.project(point,manualView,result)===result,'optional output reused');ok(result.retained,'optional output retains unrelated fields');
const raw=JSON.stringify(point),descriptor=JSON.stringify(manual);V.project(point,manualView);V.resolve(null,{view:manual},100);
ok(JSON.stringify(point)===raw&&JSON.stringify(manual)===descriptor,'input point and options remain unchanged');

// Equivalent logical views at different DPR, zoom and actor render scales.
for(const density of [1,1.5,2,3])for(const zoom of [.35,.9,1,1.8,3])for(const actorScale of [.7,1,1.4]) {
 sandbox.zoom=zoom;canvas.width=1200*density;canvas.height=900*density;
 const s=density*zoom*actorScale,ctx=context(matrix(s,(600+320*zoom)*density,(450-170*zoom)*density));sandbox.drawingContext=ctx;
 const v=V.resolve(ctx,{view:true},55);
 close(v.offsetX,320/actorScale,'DPR/zoom local x');close(v.offsetY,-170/actorScale,'DPR/zoom local y');
 const expected=Math.max(.9*1200/zoom/actorScale,256/actorScale,55+128);
 close(v.height,expected,'DPR/zoom focal height');close(v.actorScale,actorScale,'native actor scale');
 const projected=V.project(point,v),t=30/expected;
 close(projected.x,(point.x+320/actorScale*t)/(1-t),'shared logical projection x');
 close(projected.y,(point.y-170/actorScale*t)/(1-t),'shared logical projection y');
}
canvas.width=1200;canvas.height=900;sandbox.zoom=1;sandbox.drawingContext=main;

// Derive the same local camera through rotated, mirrored and sheared frames.
for(const [a,b,c,d] of [[0,2,-2,0],[-1,0,0,1],[1.4,.2,-.1,1.1],[.7,-.6,.6,.7]]) {
 const ox=180,oy=-90,ctx=context({a,b,c,d,e:600+a*ox+c*oy,f:450+b*ox+d*oy});sandbox.drawingContext=ctx;
 const v=V.resolve(ctx,{view:true});close(v.offsetX,ox,'inverse CTM x');close(v.offsetY,oy,'inverse CTM y');
 const p=V.project(point,v),w=1-point.z/v.height;
 const sx=a*p.x+c*p.y+600+a*ox+c*oy,sy=b*p.x+d*p.y+450+b*ox+d*oy;
 close(sx,600+(a*(point.x+ox)+c*(point.y+oy))/w,'homogeneous screen x');
 close(sy,450+(b*(point.x+ox)+d*(point.y+oy))/w,'homogeneous screen y');
}
sandbox.drawingContext=main;
const corners=[];
for(const x of [-600,0,600])for(const y of [-450,0,450]) {
 const ctx=context(matrix(1,600+x,450+y));sandbox.drawingContext=ctx;
 const v=V.resolve(ctx,{view:true},45),p=V.projectXYZ(0,0,30,v);corners.push(p);
 close(p.x,x*30/(1080-30),'edge radial parallax x');close(p.y,y*30/(1080-30),'edge radial parallax y');
 ok(p.w>0&&Number.isFinite(p.x)&&Number.isFinite(p.y),'corner stays finite');
}
close(corners[0].x,-corners[8].x,'opposite corners symmetric x');close(corners[0].y,-corners[8].y,'opposite corners symmetric y');
for(let pan=-1000;pan<=1000;pan+=10) {
 const ctx=context(matrix(1,600+pan,450-pan*.3));sandbox.drawingContext=ctx;
 const v=V.resolve(ctx,{view:true}),p=V.projectXYZ(3,8,35,v);
 close(p.x,(3+pan*35/1080)/(1-35/1080),'smooth horizontal camera pan');
 close(p.y,(8-pan*.3*35/1080)/(1-35/1080),'smooth vertical camera pan');
}
sandbox.drawingContext=main;
const safe=V.resolve(main,{view:true},2200);close(safe.height,2328,'near safety raises focal height for high geometry');
ok(V.projectXYZ(0,0,2200,safe).w>0,'raised geometry remains in front of eye');
for(const invalid of [null,{},context({a:0,b:0,c:0,d:0,e:0,f:0}),context({...matrix(),a:NaN}),{canvas,getTransform(){throw Error('unavailable');}}]) {
 ok(!V.resolve(invalid,{view:true}).enabled,'invalid derived camera falls back');
}
const explicit=V.resolve(offscreen,{view:{viewportWidth:2000,viewportHeight:800,principalX:300,principalY:400,height:1200}});
close(explicit.offsetX,300,'explicit backing principal x');close(explicit.offsetY,50,'explicit backing principal y');close(explicit.height,1200,'explicit focal height');
const world=context(matrix(2,-400,-700));sandbox.drawingContext=world;sandbox.zoom=2;
const wp=V.worldPoint(point,world),wp2=V.project(point,V.resolve(world,{view:true},point.z));
close(wp.x,wp2.x,'world helper shared x');close(wp.y,wp2.y,'world helper shared y');
close(main.getTransform().e,600,'resolve never changes Canvas transform');close(canvas.width,1200,'resolve never resizes Canvas');
const noGlobals={};vm.createContext(noGlobals);vm.runInContext(source+'\nglobalThis.cameraMath=Player3DView;',noGlobals);
ok(!noGlobals.cameraMath.resolve(main,{view:true}).enabled,'standalone module tolerates missing world globals');
ok(noGlobals.cameraMath.resolve(null,{view:manual}).enabled,'explicit camera works without world globals');
console.log(checks+' finite-camera projection, DPR, zoom, edge, near safety and state purity checks passed');

// Verify actual floor painting as blood accumulates, crosses seams and travels.
const assert=require('assert'),{ctx,mkG,probe}=require('./harness');
const P=s=>probe('('+s+')');
let seed=837;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
 return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
ctx.createGraphics=(w,h)=>{
 const g=mkG();g.width=w;g.height=h;g.marks=[];g.ink=null;
 g.fill=(...a)=>{g.ink=a[0]&&a[0].levels?[...a[0].levels]:a;};
 g.ellipse=(x,y,w,h=w)=>{assert([x,y,w,h].every(Number.isFinite));g.marks.push({x,y,w,h,col:[...g.ink]});};
 g.clear=()=>{g.marks=[];};
 g.image=(src,x,y)=>{g.marks.push(...src.marks.map(p=>({...p,x:p.x+x,y:p.y+y})));};
 return g;
};
probe(`doTick=true;wipeAllBloodBanks();useBloodBank('test');
 viewLeft=-1000;viewTop=-1000;viewRight=1000;viewBottom=1000;`);
const tick=n=>probe(`for(let i=0;i<${n};i++){frameCount++;updateBloodPools();}`);
const marks=()=>P(`Object.entries(bloodChunks).flatMap(([key,e])=>{
 const xy=key.split(',').map(Number);return e.pg.marks.map(p=>({...p,key,x:p.x+e.bx+xy[0]*CHUNK_SIZE,y:p.y+e.by+xy[1]*CHUNK_SIZE}));})`);

// No instant full puddle; first droplets are small, then spread and persist.
probe('spawnSplatter(CHUNK_SIZE,CHUNK_SIZE,"BLOOD",color(90,0,0,220));window.pool=bloodPools[0];');
const pattern=P('pool.blobs.map(b=>({x:pool.x+b.ox,y:pool.y+b.oy,sz:b.sz}))'),afterRoll=seed;
assert.equal(P('bloodPools.length'),1);assert.equal(marks().length,0,'blood puddle appeared all at once');
tick(1);const first=marks();assert.equal(P('Object.keys(bloodChunks).length'),4,'corner puddle did not cross all four seams');
assert(first.length>0&&first.length<pattern.length*4,'all blobs appeared on the first tick');
for(const p of first){const final=pattern.find(b=>Math.hypot(b.x-p.x,b.y-p.y)<1e-8);assert(final&&p.w<final.sz,'first droplet already at final size');}
tick(29);const middle=marks();assert(middle.length>first.length,'puddle failed to build up');
assert(P('pool.blobs.some(b=>b.stage<4)'),'full puddle appeared too early');
tick(60);assert.equal(P('bloodPools.length'),0,'finished puddle retained a live animation');
const final=marks();
for(const b of pattern)assert.equal(final.filter(p=>Math.hypot(p.x-b.x,p.y-b.y)<1e-8&&Math.abs(p.w-b.sz)<1e-8).length,4,'final blob shape disagrees across chunk seams');
assert(final.every(p=>!p.key.endsWith(',B')),'floor blood painted over stamped bodies');
assert.equal(seed,afterRoll,'growing blood consumed animation/gore random draws');
tick(30);assert.equal(marks().length,final.length,'finished puddle continued stamping');

// Simulation pause freezes deposition, rather than using render-frame time.
probe('spawnSplatter(100,100,"BLOOD");window.pausedPool=bloodPools[0];');tick(10);
const age=P('pausedPool.age'),painted=marks().length;
probe('doTick=false;');tick(90);
assert.equal(P('pausedPool.age'),age);assert.equal(marks().length,painted);
probe('doTick=true;');tick(80);assert.equal(P('bloodPools.length'),0);

// Pending growth belongs to its biome, never the destination's floor.
probe('useBloodBank("home");spawnSplatter(150,90,"BLOOD");window.homePool=bloodPools[0];');tick(12);
const homeMarks=marks().length;
probe('useBloodBank("away");');tick(90);
assert.equal(marks().length,0,'travelling painted the old puddle into the new biome');
assert.equal(P('homePool.age'),12,'inactive biome timer advanced in another biome');
probe('useBloodBank("home");');assert.equal(marks().length,homeMarks);assert.equal(P('bloodPools[0]===homePool'),true);
tick(78);assert.equal(P('bloodPools.length'),0,'returned puddle failed to finish');
probe('spawnSplatter(0,0,"BLOOD");useBloodBank("other");spawnSplatter(0,0,"BLOOD");wipeAllBloodBanks();');
assert.equal(P('bloodPools.length'),0);assert.equal(P('Object.keys(bloodBanks).length'),0);
assert.equal(P('bloodSurfaces'),0);tick(120);assert.equal(marks().length,0,'restart resurrected queued blood');

// Scorch is immediate; blood colors and off-screen persistence are preserved.
probe('useBloodBank("colors");spawnSplatter(400,400,"SCORCH");');
assert(marks().length>0);assert.equal(P('bloodPools.length'),0);
for(const col of [[90,0,0,220],[200,230,40,220],[0,100,0,220],[20,18,14,220]]){
 probe(`wipeAllBloodBanks();useBloodBank('color');spawnSplatter(0,0,'BLOOD',color(${col.join(',')}));
  viewLeft=viewTop=5000;viewRight=viewBottom=6000;`);tick(90);
 assert.equal(P('bloodPools.length'),0);assert(marks().length>0,'off-screen pool was lost');
 assert(marks().every(p=>JSON.stringify(p.col)===JSON.stringify(col)),'puddle color changed');
}

// The built-in face-down pool also grows without changing the corpse motion.
const fill=ctx.fill,ellipse=ctx.ellipse;let ink=[],bodyPool=[];
ctx.fill=(...a)=>{ink=a;fill(...a);};
ctx.ellipse=(x,y,w,h)=>{if(ink[0]===90&&ink[1]===0&&ink[2]===0&&((x===-4&&y===0)||(x===-15&&y===-12)))bodyPool.push({w,h,a:ink[3]});ellipse(x,y,w,h);};
for(const type of ['NORMAL','ALIEN_GATOR']){
 probe(`window.c=new Corpse(0,0,.3,.3,color(63,128,153),color(56,62,78),7,0,[],null,0,'${type}',21,27);`);
 bodyPool=[];probe('c.show();');assert.equal(bodyPool.length,1);assert.equal(bodyPool[0].a,0,'face-down pool appeared immediately');
 probe('for(let i=0;i<30;i++){frameCount++;c.update();}');bodyPool=[];probe('c.show();');const mid=bodyPool[0];
 probe('for(let i=0;i<60;i++){frameCount++;c.update();}');bodyPool=[];probe('c.show();');const end=bodyPool[0];
 assert(mid.a>0&&mid.a<end.a&&mid.w<end.w&&mid.h<end.h,'face-down pool did not grow');
 const state=P('({x:c.x,y:c.y,rag:c.rag,fP:c.fP})');probe('for(let i=0;i<60;i++)c.update();');
 assert.deepStrictEqual(P('({x:c.x,y:c.y,rag:c.rag,fP:c.fP})'),state,'settled corpse moved as its pool grew');
}
ctx.fill=fill;ctx.ellipse=ellipse;
console.log('Blood pools passed: incremental center-out deposition, small-to-large droplets, shared seam geometry, permanent floor layer, unchanged random sequence, pause, biome banking/return, restart, colors, off-screen completion, immediate scorch and gradual human/gator face-down pools with unchanged settled motion.');

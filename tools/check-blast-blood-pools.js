// Explosion deaths have a short hold; ordinary death pools retain their slow build.
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
probe(`doTick=true;wipeAllBloodBanks();useBloodBank('blast');
 viewLeft=viewTop=-1000;viewRight=viewBottom=1000;`);
const tick=n=>probe(`for(let i=0;i<${n};i++){frameCount++;updateBloodPools();}`);
const marks=()=>P(`Object.entries(bloodChunks).flatMap(([key,e])=>{
 const xy=key.split(',').map(Number);return e.pg.marks.map(p=>({...p,key,x:p.x+e.bx+xy[0]*CHUNK_SIZE,y:p.y+e.by+xy[1]*CHUNK_SIZE}));})`);

// The timing tag changes only deposition, never the rolled final pattern or RNG.
seed=837;probe('spawnSplatter(CHUNK_SIZE,CHUNK_SIZE,"BLOOD",color(90,0,0,220),null,"BLAST");window.blast=bloodPools[0];');
const pattern=P('blast.blobs.map(b=>({x:blast.x+b.ox,y:blast.y+b.oy,sz:b.sz}))'),afterRoll=seed;
assert.equal(P('blast.blastBlood'),true);assert.equal(marks().length,0);
tick(6);assert.equal(marks().length,0,'blast blood should retain its very slight delay');
tick(1);const first=marks();assert(first.length>0,'blast puddle failed to begin after six ticks');
assert.equal(P('Object.keys(bloodChunks).length'),4,'blast pool did not cross all four floor seams');
assert(P('blast.blobs.some(b=>b.stage<4)'),'blast pool appeared fully grown on its first tick');
tick(24);assert(P('blast.blobs.some(b=>b.stage===4)'),'blast central ovals should complete promptly');
assert(P('blast.blobs.some(b=>b.stage<4)'),'blast outer ovals should keep growing');
tick(23);assert.equal(P('bloodPools.length'),0,'blast pool should complete at54 ticks');
const blastMarks=marks();
for(const b of pattern)assert.equal(blastMarks.filter(p=>Math.hypot(p.x-b.x,p.y-b.y)<1e-8&&Math.abs(p.w-b.sz)<1e-8).length,4,'final blast oval differs at a seam');
assert.equal(seed,afterRoll,'blast growth consumed gameplay RNG');
assert(blastMarks.every(p=>!p.key.endsWith(',B')),'blast pool painted above bodies');
seed=837;probe('wipeAllBloodBanks();useBloodBank("ordinary");spawnSplatter(CHUNK_SIZE,CHUNK_SIZE,"BLOOD",color(90,0,0,220));window.ordinary=bloodPools[0];');
assert.equal(seed,afterRoll,'blast tag changed pattern RNG consumption');
assert.equal(JSON.stringify(P('ordinary.blobs.map(b=>({x:ordinary.x+b.ox,y:ordinary.y+b.oy,sz:b.sz}))')),JSON.stringify(pattern),'blast tag changed final oval geometry');
tick(45);assert.equal(marks().length,0,'ordinary hold changed');
tick(9);assert.equal(P('bloodPools.length'),1,'ordinary pool adopted the fast blast finish');
tick(306);assert.equal(P('bloodPools.length'),0,'ordinary pool no longer completes at360');
const sorted=a=>a.sort((p,q)=>p.key.localeCompare(q.key)||p.x-q.x||p.y-q.y||p.w-q.w);
assert.deepStrictEqual(sorted(marks()),sorted(blastMarks),'blast timing changed final floor painting');

// Corpse ownership supplies the same schedule without a timing argument.
probe('wipeAllBloodBanks();useBloodBank("owner");spawnSplatter(50,50,"BLOOD",null,{blastBlood:true});window.ownerPool=bloodPools[0];');
assert.equal(P('ownerPool.blastBlood'),true);tick(7);
const painted=marks().length,age=P('ownerPool.age');assert(painted>0);
probe('doTick=false;');tick(100);assert.equal(P('ownerPool.age'),age);assert.equal(marks().length,painted,'pause continued blast blood deposition');
probe('doTick=true;viewLeft=viewTop=5000;viewRight=viewBottom=6000;');tick(47);
assert.equal(P('bloodPools.length'),0,'offscreen blast pool failed to complete');

// Timing stays banked with the source sector and is cleared on a hard restart.
probe('useBloodBank("home");spawnSplatter(80,80,"BLOOD",null,null,"BLAST");window.homeBlast=bloodPools[0];');tick(8);
probe('useBloodBank("away");');tick(100);assert.equal(P('homeBlast.age'),8,'inactive sector advanced blast timing');
assert.equal(marks().length,0,'blast pool leaked into destination sector');
probe('useBloodBank("home");');tick(46);assert.equal(P('bloodPools.length'),0);
probe('spawnSplatter(0,0,"BLOOD",null,null,"BLAST");wipeAllBloodBanks();');tick(100);
assert.equal(P('bloodPools.length'),0);assert.equal(marks().length,0,'reset resurrected blast pools');

// Face-down pools and below-ground pools must use the short schedule too.
assert.equal(P('bloodPoolProgress(6,true)'),0);assert.equal(P('bloodPoolProgress(54,true)'),1);
assert.equal(P('bloodPoolProgress(54)'),9/315,'ordinary built-in pool timing changed');
assert.equal(P('corpseSettled({dT:7,fP:1,sep:0,poolAge:53,blastBlood:true})'),false);
assert.equal(P('corpseSettled({dT:7,fP:1,sep:0,poolAge:54,blastBlood:true})'),true,'blast face-down pool still waits six seconds');
for(const type of ['NORMAL','ALIEN_GATOR']){
 probe(`window.c=new Corpse(0,0,.3,.3,color(63,128,153),color(56,62,78),7,0,[],null,0,'${type}',21,27);c.blastBlood=true;
 for(let i=0;i<54;i++){frameCount++;c.update();}`);
 assert.equal(P('c.poolAge'),54);probe('c.show();');
}
probe(`currentLevel=2;viewLeft=viewTop=-1000;viewRight=viewBottom=1000;
 shovelBloodMarks=[];window.pitOwner={x:0,y:0,shovelLevel:2,shovelDepth:80,shovelDepthTarget:80};
 spawnSplatter(0,0,'BLOOD',color(90,0,0),pitOwner,'BLAST');window.pitPool=shovelBloodMarks[0];`);
assert(P('pitPool.slowPool&&pitPool.blastBlood'),'pit blast pool lost the timing tag');
const cell=ctx.shovelCellAt,depthPaint=ctx.shovelPaintDepthEffect,oval=ctx.ellipse;let pitSizes=[];
ctx.shovelCellAt=()=>({open:true});ctx.shovelPaintDepthEffect=(mark,paint)=>paint();ctx.ellipse=(x,y,w)=>pitSizes.push(w);
try{
 tick(6);probe('drawShovelBloodMarks();');assert(pitSizes.every(s=>s===0));
 tick(1);pitSizes=[];probe('drawShovelBloodMarks();');assert(pitSizes.every(s=>s>0),'pit blast pool began too late');
 tick(47);pitSizes=[];probe('drawShovelBloodMarks();');
 assert.equal(JSON.stringify(pitSizes),JSON.stringify(P('pitPool.blobs.map(b=>b.sz)')),'pit blast pool did not complete at54');
}finally{ctx.shovelCellAt=cell;ctx.shovelPaintDepthEffect=depthPaint;ctx.ellipse=oval;}
console.log('Blast blood pools passed: six-tick hold /54-tick finish, unchanged ordinary45/360 schedule, final pattern/RNG/colors, seam coverage, ownership, pause, offscreen completion, biome banks, hard reset and face-down/pit timing.');

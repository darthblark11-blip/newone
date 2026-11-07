// Bound and isolate the cosmetic comic-contact/spray paths. Gameplay damage,
// corpse bleeding and floor deposits are checked by the existing suites.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
probe(`started=doTick=true;isPaused=false;currentLevel=currentBiome=2;
 viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
 particles=[];_particlePool.length=0;frameCount++;
 window.comicTestOwner={x:20,y:30,shovelLevel:currentLevel,shovelDepth:0};`);
const nativeRandom=ctx.random;
ctx.random=()=>{throw Error('Cosmetic comic impact consumed gameplay randomness');};
try{
 probe('emitComicHit(20,30,20,0,comicTestOwner,true,true);');
 ok('one contact emits bounded dense spray and one coherent burst',P("particles.length===13&&particles.filter(p=>p.t==='HIT_BLOOD').length===12&&particles.filter(p=>p.t==='COMIC_IMPACT').length===1"));
 ok('most blood follows the shot and a smaller cone rebounds from it',P("particles.filter(p=>p.t==='HIT_BLOOD'&&p.vx>0).length===9&&particles.filter(p=>p.t==='HIT_BLOOD'&&p.vx<0).length===3"));
 ok('two consecutive variants cover all four blood silhouettes',P("new Set(particles.filter(p=>p.t==='HIT_BLOOD').map(p=>p.fxKind)).size===4"));
 probe('window.comicPoseBefore=JSON.stringify(particles);');
 const native={shape:ctx.beginShape,vertex:ctx.vertex,bezier:ctx.bezierVertex,triangle:ctx.triangle,ellipse:ctx.ellipse};
 let commands=[],ovals=0;
 ctx.beginShape=(...a)=>{commands.push(['shape',...a]);return native.shape(...a);};
 ctx.vertex=(...a)=>{commands.push(['vertex',...a]);return native.vertex(...a);};
 ctx.bezierVertex=(...a)=>{commands.push(['bezier',...a]);return native.bezier(...a);};
 ctx.triangle=(...a)=>{commands.push(['triangle',...a]);return native.triangle(...a);};
 ctx.ellipse=(...a)=>{ovals++;return native.ellipse(...a);};
 try{
  probe('for(const p of particles)p.paint();');const first=JSON.stringify(commands);commands=[];
  probe('for(const p of particles)p.paint();');
  ok('painting a frozen contact is deterministic',JSON.stringify(commands)===first);
  ok('blood and comic contact use ink shapes instead of oval clouds',ovals===0&&commands.filter(c=>c[0]==='shape').length>=9);
  ok('all sampled shape vertices are finite',commands.every(c=>c.slice(1).every(Number.isFinite)));
 }finally{Object.assign(ctx,{beginShape:native.shape,vertex:native.vertex,bezierVertex:native.bezier,triangle:native.triangle,ellipse:native.ellipse});}
 ok('painting does not advance or mutate contact state',P('JSON.stringify(particles)===comicPoseBefore'));
 const order=[],nativeBurst=ctx.drawComicImpactParticle,nativeBlood=ctx.drawHitBloodParticle;
 ctx.drawComicImpactParticle=p=>{order.push('burst');return nativeBurst(p);};
 ctx.drawHitBloodParticle=p=>{order.push('blood');return nativeBlood(p);};
 try{
  probe('doTick=false;updateParticles();');
  ok('the native particle pass layers spray over its flash',order[0]==='burst'&&order.slice(1).every(t=>t==='blood')&&order.length===13);
  ok('a paused particle pass preserves the complete effect state',P('JSON.stringify(particles)===comicPoseBefore'));
 }finally{ctx.drawComicImpactParticle=nativeBurst;ctx.drawHitBloodParticle=nativeBlood;}
 probe('doTick=true;updateParticles();');
 ok('active simulation advances contact age once',P('particles.every(p=>p.fxAge===1)'));

 // The old spray's maximum possible range was a 7.1-unit initial speed,
 // damped by .89 for at most 21 updates. Measure the new trajectories rather
 // than restating their speed/lifetime formulas.
 const priorMaxReach=7.1*(1-Math.pow(.89,21))/(1-.89);
 const reach=P(`(()=>{let reach=0;for(const p of particles){if(p.t!=='HIT_BLOOD')continue;
  const x=p.x,y=p.y;let steps=0;while(p.a>0&&steps++<60)p.update();
  reach=Math.max(reach,Math.hypot(p.x-x,p.y-y));}return reach;})()`);
 ok('the dense spray visibly travels beyond the prior maximum range',reach>priorMaxReach*1.1);

 probe('particles=[];frameCount++;for(let i=0;i<100;i++)emitComicHit(0,0,20,0,comicTestOwner,true,true);');
 ok('a crowded frame accepts at most 24 new impacts',P("particles.filter(p=>p.t==='COMIC_IMPACT').length===24&&particles.length===24*13"));
 probe('frameCount++;emitComicHit(0,0,20,0,comicTestOwner,false,false);');
 ok('the per-frame budget resumes without queuing a backlog',P("particles.filter(p=>p.t==='COMIC_IMPACT').length===25&&particles.length===24*13+1"));
 probe('particles=Array(899).fill(null);frameCount++;emitComicHit(0,0,20,0,comicTestOwner,true,true);window.comicAtCap=particles.length;emitComicHit(0,0,20,0,comicTestOwner,true,true);');
 ok('new effects stop at the existing 900-particle ceiling',P('comicAtCap===900&&particles.length===900'));

 probe(`particles=[];_particlePool.length=0;frameCount++;
  window.comicRecycled=newParticle(1,2,color(90,0,0),'COMIC_IMPACT',20,0,comicTestOwner);
  comicRecycled.fxMaterial='ARMOR';comicRecycled.fxAge=comicRecycled.fxLife;comicRecycled.a=0;
  particles.push(comicRecycled);updateParticles();
  window.comicWound=newParticle(7,8,color(90,0,0),'WOUND_BLOOD',3,-2);`);
 ok('retired contacts release their owner and return to the existing pool',P('comicWound===comicRecycled&&comicWound.shovelOwner===null'));
 ok('the early-return wound path clears every new transient field',P("comicWound.fxSeed===0&&comicWound.fxAge===0&&comicWound.fxLife===0&&comicWound.fxAngle===0&&comicWound.fxMaterial===''&&comicWound.fxKind===0&&comicWound.fxStretch===1"));
 ok('the continuous wound emitter keeps its original size, motion and lifetime',P('comicWound.sz===2.8&&comicWound.vx===3&&comicWound.vy===-2&&comicWound.l===16'));
}finally{ctx.random=nativeRandom;}
console.log(`${checks}/${checks} comic contact budget, layering, pool, deterministic art and pause checks passed.`);

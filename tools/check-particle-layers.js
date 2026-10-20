// Blood must remain above smoke in either emission order without changing the
// simulation tick, culling, pool ownership or survivor ordering.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness');
probe('viewLeft=viewTop=-100;viewRight=viewBottom=100;currentLevel=2;');
for (const kinds of [['SMOKE','BLOOD','EXPLOSION','GORE','BLOOD_SMOKE','WOUND_BLOOD','BONE'],
                     ['BONE','WOUND_BLOOD','BLOOD_SMOKE','GORE','EXPLOSION','BLOOD','SMOKE']]) {
  for (const tick of [true,false]) {
    const draws = [];
    ctx.__draws = draws;
    const result = JSON.parse(probe(`JSON.stringify((()=>{
      const owner={x:0,y:0,shovelLevel:currentLevel,shovelDepth:0};
      particles=[];_particlePool.length=0;doTick=${tick};
      for(const t of ${JSON.stringify(kinds)}){
        const p=newParticle(0,0,color(70),t,0,0,owner);
        p.updates=0;p.update=function(){this.updates++;};
        p.show=function(){window.__draws.push(this.t);};particles.push(p);
      }
      const hidden=newParticle(1000,1000,color(70),'BLOOD',0,0,owner);
      hidden.show=function(){throw Error('culled particle painted');};particles.push(hidden);
      updateParticles();
      const result={types:particles.slice(0,-1).map(p=>p.t),
        updates:particles.slice(0,-1).map(p=>p.updates),
        owners:particles.every(p=>p.shovelOwner===owner)};
      const dead=particles[1];dead.a=0;updateParticles();
      result.survivors=particles.slice(0,-1).map(p=>p.t);
      result.retired=_particlePool.length===1&&_particlePool[0]===dead&&dead.shovelOwner===null;
      return result;
    })())`));
    const firstFrame = draws.slice(0,kinds.length);
    const clouds = ['SMOKE','EXPLOSION','BLOOD_SMOKE'];
    const cloudEnd = Math.max(...clouds.map(t=>firstFrame.indexOf(t)));
    assert(['BLOOD','GORE','WOUND_BLOOD','BONE'].every(t=>firstFrame.indexOf(t)>cloudEnd),'blood paints after all clouds');
    assert.equal(firstFrame.length,kinds.length,'draw each visible particle once');
    assert.deepEqual(result.types,kinds,'retain original survivor ordering');
    assert(result.updates.every(n=>n===(tick?1:0)),'update once per tick and freeze while paused');
    assert(result.owners,'retain shovel projection ownership for live effects');
    assert.deepEqual(result.survivors,kinds.filter((_,i)=>i!==1),'compact expired particles without reordering');
    assert(result.retired,'recycle expired particles and clear their owner');
  }
}
console.log('Particle blood/smoke layering, ticks, culling, ownership and pooling passed.');

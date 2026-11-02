// Exercise the actual p5 hill overlay at adjacent texture edges. The numeric
// companion test checks exact shared height/normal nodes; this catches raster
// alpha borders, missing edge pixels and a chunk-local material coordinate.
const assert = require('assert');
const fs = require('fs'), path = require('path');
const deps = process.env.VIS_DEPS || '/workspace/newone/work/visual-deps';
const { chromium } = require(path.join(deps, 'node_modules/playwright'));
const p5 = process.env.VIS_P5 || path.join(deps, 'node_modules/p5/lib/p5.min.js');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VIS_CHROME || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<script>'+fs.readFileSync(p5,'utf8')+'</script><script>'+
      fs.readFileSync(process.env.GAME_JS || path.join(__dirname,'..','game.js'),'utf8')+
      '</script><script>window.preload=function(){};window.setup=function(){'+
      'createCanvas(16,16);pixelDensity(1);noLoop();noiseSeed(BIOME_SEED);'+
      'BIOME_ACTIVE=true;currentBiome=currentLevel=2;authoredCore=authoredChunks=authoredMask=null;'+
      'biomeState={};window.__ready=true;};window.draw=function(){};</script>');
    await page.waitForFunction(() => window.__ready);
    const result = await page.evaluate(() => {
      const fixtures=[],visited=new Set();
      for(let iy=-6;iy<=6&&fixtures.length<16;iy++)for(let ix=-6;ix<=6&&fixtures.length<16;ix++){
        const site=forestLandscapeSite(2,ix,iy);if(!site||site.kind!=='RIDGE')continue;
        const cx=Math.floor(site.x/CHUNK_W),cy=Math.floor(site.y/CHUNK_W);
        for(let y=cy-1;y<=cy+1&&fixtures.length<16;y++)for(let x=cx-1;x<=cx+1&&fixtures.length<16;x++)
          for(const axis of ['x','y']){
            const key=x+','+y+axis;if(visited.has(key))continue;visited.add(key);
            const a=forestRidgeGrid(x,y),b=forestRidgeGrid(x+(axis==='x'?1:0),y+(axis==='y'?1:0));
            if(a.maximum<12||b.maximum<12)continue;
            fixtures.push({cx:x,cy:y,axis});
          }
      }
      const bake=(cx,cy)=>{
        const g=createGraphics(CHUNK_TEX,CHUNK_TEX);g.pixelDensity(1);
        g.scale(CHUNK_TEX/CHUNK_W);g.translate(-cx*CHUNK_W,-cy*CHUNK_W);
        withBakedSun(()=>bakeForestRidges(g,2,cx,cy));
        const pixels=g.drawingContext.getImageData(0,0,CHUNK_TEX,CHUNK_TEX).data;
        g.remove();return pixels;
      };
      const pixel=(p,x,y,c)=>{const i=(y*CHUNK_TEX+x)*4;return c===3?p[i+3]:p[i+c]*p[i+3]/255;};
      const results=[];
      for(const f of fixtures){
        const a=bake(f.cx,f.cy),b=bake(f.cx+(f.axis==='x'?1:0),f.cy+(f.axis==='y'?1:0));
        const jumps=[];let maxJump=0,nearbyJump=0,visible=0;
        for(let i=0;i<CHUNK_TEX;i++){
          let jump=0;
          for(let c=0;c<4;c++){
            const av=f.axis==='x'?pixel(a,CHUNK_TEX-1,i,c):pixel(a,i,CHUNK_TEX-1,c);
            const bv=f.axis==='x'?pixel(b,0,i,c):pixel(b,i,0,c);
            jump=Math.max(jump,Math.abs(av-bv));
            for(let d=1;d<=4;d++){
              const p0=f.axis==='x'?pixel(a,CHUNK_TEX-d-1,i,c):pixel(a,i,CHUNK_TEX-d-1,c);
              const p1=f.axis==='x'?pixel(a,CHUNK_TEX-d,i,c):pixel(a,i,CHUNK_TEX-d,c);
              const q0=f.axis==='x'?pixel(b,d-1,i,c):pixel(b,i,d-1,c);
              const q1=f.axis==='x'?pixel(b,d,i,c):pixel(b,i,d,c);
              nearbyJump=Math.max(nearbyJump,Math.abs(p1-p0),Math.abs(q1-q0));
            }
          }
          const alphaA=f.axis==='x'?pixel(a,CHUNK_TEX-1,i,3):pixel(a,i,CHUNK_TEX-1,3);
          const alphaB=f.axis==='x'?pixel(b,0,i,3):pixel(b,i,0,3);
          if(alphaA>8||alphaB>8)visible++;
          jumps.push(jump);maxJump=Math.max(maxJump,jump);
        }
        jumps.sort((a,b)=>a-b);
        results.push({...f,maxJump,nearbyJump,mean:jumps.reduce((a,b)=>a+b,0)/jumps.length,
          p95:jumps[Math.floor(jumps.length*.95)],visible});
      }
      return results;
    });
    assert.deepEqual(errors,[],'hill seam probe raised browser errors');
    assert(result.length===16 && result.filter(r=>r.visible>20).length>=10,
      'seam fixtures must cross visible hill surfaces on both axes');
    for(const seam of result){
      assert(seam.maxJump<42 && seam.mean<3.5 && seam.p95<12,
        'hill overlay has an abrupt texture edge: '+JSON.stringify(seam));
      assert(seam.maxJump<=seam.nearbyJump+9,
        'chunk edge is sharper than the adjacent physical rock/moss transitions: '+JSON.stringify(seam));
    }
    console.log('Forest ridge raster seams passed: 16 real p5 texture boundaries, shared moss/limestone and alpha edges.');
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

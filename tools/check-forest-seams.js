// Real Canvas regression: natural forest materials must cross texture borders.
// VIS_DEPS/VIS_CHROME/VIS_P5 override the external browser dependencies.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const deps = process.env.VIS_DEPS || '/workspace/onboarding-newone';
const { chromium } = require(path.join(deps, 'node_modules/playwright'));
const p5 = process.env.VIS_P5 || path.join(deps, 'node_modules/p5/lib/p5.min.js');
const game = process.env.GAME_JS || path.join(__dirname, '..', 'game.js');
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.VIS_CHROME || '/usr/bin/chromium',
    headless: true, args: ['--no-sandbox']
  });
  try {
    const page = await browser.newPage(), faults = [];
    page.on('pageerror', error => faults.push(error.message));
    await page.setContent('<script>' + fs.readFileSync(p5, 'utf8') + '</script><script>' +
      fs.readFileSync(game, 'utf8') + '</script><script>' +
      'window.preload=function(){};window.setup=function(){createCanvas(10,10);' +
      'pixelDensity(1);noLoop();noiseSeed(BIOME_SEED);authoredCore=null;' +
      'authoredChunks=null;authoredMask=null;biomeState={};window.__done=true;};' +
      'window.draw=function(){};</script>');
    await page.waitForFunction(() => window.__done);
    const results = await page.evaluate(() => {
      const scenes = [[0,-4],[6,-5],[-2,9],[20,-28],[0,4]];
      const size = CHUNK_TEX, ratio = size / CHUNK_W;
      const prepare = (w,h,ox,oy) => {
        const g=createGraphics(w,h);g.pixelDensity(1);g.background(74,111,63);
        g.noStroke();g.scale(ratio);g.translate(-ox,-oy);return g;
      };
      const read=g=>g.drawingContext.getImageData(0,0,g.width,g.height).data;
      const materials = scenes.map(([cx,cy])=>{
        const ox=cx*CHUNK_W,oy=cy*CHUNK_W;
        const reference=prepare(size*2,size*2,ox,oy);
        // A single canvas provides the reference without an internal clip.
        bakeWoodlandFloorArea(reference,2,ox,oy,ox+CHUNK_W*2,oy+CHUNK_W*2);
        const expected=read(reference);
        let maxDifference=0,maxInteriorDifference=0,maxGuardedDifference=0;
        let sharedError=0,clippedError=0,samples=0;
        let minFeatureCount=Infinity,maxFeatureCount=0;
        for(const [dx,dy] of [[0,0],[1,0],[0,1],[1,1]]){
          const x=cx+dx,y=cy+dy;
          const g=prepare(size,size,x*CHUNK_W,y*CHUNK_W);
          const clipped=prepare(size,size,x*CHUNK_W,y*CHUNK_W);
          // Chromium clips a stroke's antialias coverage slightly differently
          // in the first/last two texels of a standalone Canvas. A two-texel
          // guard band proves that any extra error is Canvas clipping, rather
          // than a missing or differently positioned neighbouring feature.
          const padded=prepare(size+4,size+4,x*CHUNK_W-2/ratio,y*CHUNK_W-2/ratio);
          bakeSharedWoodlandPatches(g,2,x,y);
          bakeSharedWoodlandPatches(padded,2,x,y);
          // A deliberately broken owner-only renderer omits neighbour cells.
          // This verifies that the fixture actually notices border clipping.
          const cell=WOODLAND_FLOOR_CELL;
          for(let ix=Math.ceil(x*CHUNK_W/cell);ix<Math.floor((x+1)*CHUNK_W/cell);ix++)
            for(let iy=Math.ceil(y*CHUNK_W/cell);iy<Math.floor((y+1)*CHUNK_W/cell);iy++)
              woodlandGroundPatches(clipped,2,ix,iy);
          const count=(Math.floor(((x+1)*CHUNK_W+WOODLAND_FLOOR_REACH)/cell)-
            Math.floor((x*CHUNK_W-WOODLAND_FLOOR_REACH)/cell)+1)*
            (Math.floor(((y+1)*CHUNK_W+WOODLAND_FLOOR_REACH)/cell)-
            Math.floor((y*CHUNK_W-WOODLAND_FLOOR_REACH)/cell)+1);
          minFeatureCount=Math.min(minFeatureCount,count);maxFeatureCount=Math.max(maxFeatureCount,count);
          const actual=read(g),broken=read(clipped);
          const guarded=padded.drawingContext.getImageData(2,2,size,size).data;
          for(let py=0;py<size;py++)for(let px=0;px<size;px++){
            if(Math.abs(dx*size+px-size)>16&&Math.abs(dy*size+py-size)>16)continue;
            const a=4*(py*size+px),b=4*((dy*size+py)*size*2+dx*size+px);
            for(let channel=0;channel<3;channel++){
              const difference=Math.abs(actual[a+channel]-expected[b+channel]);
              maxDifference=Math.max(maxDifference,difference);sharedError+=difference;
              if(px>=2&&py>=2&&px<size-2&&py<size-2)
                maxInteriorDifference=Math.max(maxInteriorDifference,difference);
              maxGuardedDifference=Math.max(maxGuardedDifference,
                Math.abs(guarded[a+channel]-expected[b+channel]));
              clippedError+=Math.abs(broken[a+channel]-expected[b+channel]);samples++;
            }
          }
          g.remove();clipped.remove();padded.remove();
        }
        reference.remove();
        return {cx,cy,maxDifference,maxInteriorDifference,maxGuardedDifference,sharedError:sharedError/samples,
          clippedError:clippedError/samples,minFeatureCount,maxFeatureCount,samples};
      });
      const rivers=[];
      for(const [cx,cy] of [[0,4],[-2,9]]) {
        const ox=cx*CHUNK_W,oy=cy*CHUNK_W;
        const centre=x=>woodRiverY(2,cy,x),half=x=>woodRiverHalf(2,cy,x);
        const ford={x:ox+CHUNK_W,y:centre(ox+CHUNK_W)};
        const paint=(g,x,span)=>{
          bakeWoodlandWatercourse(g,2,cy,x,centre,half,span);
          bakeWoodlandRiverBanks(g,2,cy,x,centre,half,span);
          bakeWoodlandFord(g,ford,centre,half);
        };
        const reference=prepare(size*2,size,ox,oy);paint(reference,ox,CHUNK_W*2);
        const expected=read(reference);
        let maxDifference=0,sharedError=0,samples=0;
        for(let dx=0;dx<2;dx++) {
          const g=prepare(size,size,ox+dx*CHUNK_W,oy);paint(g,ox+dx*CHUNK_W,CHUNK_W);
          const actual=read(g);
          for(let py=0;py<size;py++)for(let px=0;px<size;px++) {
            if(Math.abs(dx*size+px-size)>16)continue;
            const a=4*(py*size+px),b=4*(py*size*2+dx*size+px);
            for(let channel=0;channel<3;channel++) {
              const diff=Math.abs(actual[a+channel]-expected[b+channel]);
              maxDifference=Math.max(maxDifference,diff);sharedError+=diff;samples++;
            }
          }
          g.remove();
        }
        reference.remove();rivers.push({cx,cy,maxDifference,sharedError:sharedError/samples,samples});
      }
      const dry=prepare(size,size,0,0),before=Array.from(read(dry));
      bakeWoodlandWatercourse(dry,2,0,0,x=>CHUNK_W*0.5,()=>0);
      bakeWoodlandRiverBanks(dry,2,0,0,x=>CHUNK_W*0.5,()=>0);
      const after=read(dry),taperedDry=before.every((value,i)=>value===after[i]);dry.remove();
      return {materials,rivers,taperedDry};
    });
    assert.deepEqual(faults,[],'forest material bake raised browser errors');
    assert(results.taperedDry,'closed channel taper painted water over dry authored ground');
    for(const result of results.materials){
      assert(result.maxDifference<=4&&result.maxInteriorDifference<=3&&
        result.maxGuardedDifference<=3&&result.sharedError<0.02,
        `forest floor differs from continuous reference: ${JSON.stringify(result)}`);
      assert(result.maxFeatureCount<=25,'world feature replay exceeded the bake budget');
    }
    for(const result of results.rivers){
      assert(result.maxDifference<=4&&result.sharedError<0.02,
        `river/ford material differs across chunk seam: ${JSON.stringify(result)}`);
    }
    assert(results.materials.reduce((n,r)=>n+r.clippedError,0)>0.15,
      'seam fixtures did not detect omitted neighbouring material cells');
    console.log('Forest material seams passed: '+results.materials.length+
      ' floor patches, '+results.rivers.length+' river/ford patches; bounded bake work; continuous Canvas reference matches.');
    console.log(JSON.stringify(results));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

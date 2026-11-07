// Soil/moss colour must blend through ecology edges, rather than turning the
// material lattice's cells into squared patches. Exercise real p5 noise.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const deps = process.env.VIS_DEPS || '/workspace/onboarding-newone';
const { chromium } = require(path.join(deps, 'node_modules/playwright'));
const p5 = process.env.VIS_P5 || path.join(deps, 'node_modules/p5/lib/p5.min.js');
const game = process.env.GAME_JS || path.join(__dirname, '..', 'game.js');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VIS_CHROME || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage(), faults = [];
    page.on('pageerror', error => faults.push(error.message));
    await page.setContent('<script>' + fs.readFileSync(p5, 'utf8') + '</script><script>' +
      fs.readFileSync(game, 'utf8') + '</script><script>' +
      'window.preload=function(){};window.setup=function(){createCanvas(16,16);pixelDensity(1);' +
      'noLoop();noiseSeed(BIOME_SEED);authoredCore=authoredChunks=authoredMask=null;' +
      'biomeState={};window.__ready=true;};window.draw=function(){};</script>');
    await page.waitForFunction(() => window.__ready);
    const result = await page.evaluate(() => {
      const boundaries = [], habitats = new Set();
      const colour = (x,y,discrete) => {
        const growth = bnoise(2,x,y,.00085), roughness = bnoise(2,x,y,.0042);
        const exposure = bnoise(2,x+3700,y-2900,.00021);
        return discrete ? woodlandFloorColour(forestHabitatAt(x,y,2),growth,roughness,exposure) :
          woodlandFloorColourAt(2,x,y,growth,roughness,exposure);
      };
      let maxJump = 0, oldMaxJump = 0;
      for (let x=-24000;x<24000;x+=600) for (let y=-24000;y<24000;y+=600) {
        const region = forestHabitatAt(x,y,2);habitats.add(region);
        if (region === forestHabitatAt(x+600,y,2)) continue;
        // Narrow a real ecology edge to a hundredth of a world unit.
        let lo=x,hi=x+600;
        while (hi-lo>.01) {
          const mid=(lo+hi)*.5;
          if(forestHabitatAt(mid,y,2)===region)lo=mid;else hi=mid;
        }
        const a=colour(lo,y,false),b=colour(hi,y,false);
        const oldA=colour(lo,y,true),oldB=colour(hi,y,true);
        const jump=Math.max(...a.map((c,i)=>Math.abs(c-b[i])));
        const oldJump=Math.max(...oldA.map((c,i)=>Math.abs(c-oldB[i])));
        maxJump=Math.max(maxJump,jump);oldMaxJump=Math.max(oldMaxJump,oldJump);
        if(boundaries.length<12)boundaries.push({x:(lo+hi)*.5,y,from:region,
          to:forestHabitatAt(hi,y,2),jump,oldJump});
      }
      // Identical world-space samples reached from either chunk must agree.
      // This also catches floor colours accidentally keyed to an owning chunk.
      let seamError=0;
      for(let cx=-8;cx<=8;cx++)for(let cy=-8;cy<=8;cy++) {
        const x=(cx+1)*CHUNK_W,y=cy*CHUNK_W+433;
        const a=colour(x-.001,y,false),b=colour(x+.001,y,false);
        seamError=Math.max(seamError,...a.map((c,i)=>Math.abs(c-b[i])));
      }
      // Exercise the complete production base bake, including its 200px noise
      // layer and filtered upscale into the 384px chunk texture. Disabling
      // vector stamps isolates the material transition from roads and props.
      bakeBiomeDetail=bakeFrontierCanyons=bakeCivicTerrace=
        bakeCityDowntownRelief=bakeFortHardstanding=function(){};
      const baseSeams=[];
      for(const [cx,cy,axis] of [[-5,3,'x'],[1,3,'x'],[-9,6,'y'],[-5,-9,'y']]) {
        const a=bakeChunkTerrainAt(2,cx-(axis==='x'?1:0),cy-(axis==='y'?1:0),[]);
        const b=bakeChunkTerrainAt(2,cx,cy,[]),size=CHUNK_TEX;
        const pa=a.drawingContext.getImageData(0,0,size,size).data;
        const pb=b.drawingContext.getImageData(0,0,size,size).data;
        let jump=0;
        for(let i=0;i<size;i++)for(let c=0;c<3;c++) {
          const ia=axis==='x'?4*(i*size+size-1)+c:4*((size-1)*size+i)+c;
          const ib=axis==='x'?4*i*size+c:4*i+c;
          jump=Math.max(jump,Math.abs(pa[ia]-pb[ib]));
        }
        baseSeams.push({cx,cy,axis,jump});a.remove();b.remove();
      }
      return {habitats:[...habitats],boundaries,maxJump,oldMaxJump,seamError,baseSeams};
    });
    assert.deepEqual(faults,[],'forest floor transition probe raised browser errors');
    assert(result.habitats.length===7,'transition fixtures must sample all seven forest habitats');
    assert(result.boundaries.length===12 && result.oldMaxJump>10,
      'transition fixtures did not expose the former categorical colour steps');
    assert(result.maxJump<.1,'material colour still jumps at ecology edges: '+JSON.stringify(result));
    assert(result.seamError<.05,'material colour snaps at a chunk edge: '+JSON.stringify(result));
    assert(result.baseSeams.every(seam=>seam.jump<=10),
      'complete base texture has a habitat colour seam beyond its dither/filter variation: '+JSON.stringify(result.baseSeams));
    console.log('Forest floor transitions passed: seven habitats, ecology boundaries and complete base-texture seams.');
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

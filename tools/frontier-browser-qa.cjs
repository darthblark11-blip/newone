// Native Level 3 browser captures and CPU timing. No game functions are replaced.
// GAME_JS=game.js FRONTIER_P5=/path/to/p5-1.9.0.min.js node tools/frontier-browser-qa.cjs
// FRONTIER_OUT=/tmp/frontier-candidate FRONTIER_FRAMES=24 FRONTIER_MODES=fallback,advanced
// Chromium/SwiftShader timings describe this host, not physical Galaxy S25 FPS.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { chromium } = require('playwright-core');
const sourcePath = process.env.GAME_JS || path.resolve(__dirname, '../game.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const p5Path = process.env.FRONTIER_P5 || '/tmp/frontier-qa/p5-1.9.0.min.js';
const p5 = fs.readFileSync(p5Path, 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const out = process.env.FRONTIER_OUT || '/tmp/frontier-candidate';
const frames = Number(process.env.FRONTIER_FRAMES || 12);
const warmFrames = Number(process.env.FRONTIER_WARM || 3);
const measureRaf = process.env.FRONTIER_RAF === '1';
const modes = (process.env.FRONTIER_MODES || 'fallback,advanced').split(',');
const scenes = [
  { id: 'dry-gulch', x: 1300, y: -1730 },
  { id: 'copper-wash', x: -6000, y: 600 },
  { id: 'sunspur', x: 8400, y: -6600 },
  { id: 'mesa-relay', x: 1200, y: 6600 },
  { id: 'canyon-bridge', canyon: -6000 },
  { id: 'canyon-floor', canyon: -5500 }
];
const viewports = process.env.FRONTIER_WIDTH ? [{id:'panorama',width:Number(process.env.FRONTIER_WIDTH),height:Number(process.env.FRONTIER_HEIGHT||800)}] : [{ id: 'portrait', width: 360, height: 780 }, { id: 'landscape', width: 940, height: 390 }].filter(v=>!process.env.FRONTIER_VIEWPORT||v.id===process.env.FRONTIER_VIEWPORT);
const dpr = Number(process.env.FRONTIER_DPR || 3);
const selected = (process.env.FRONTIER_SCENES || scenes.map(s => s.id).join(',')).split(',');
const stats = values => { const a = values.slice().sort((a,b)=>a-b); return { count:a.length, median:a[Math.floor(a.length*.5)], p95:a[Math.min(a.length-1,Math.floor(a.length*.95))], p99:a[Math.min(a.length-1,Math.floor(a.length*.99))], max:a[a.length-1] }; };
const blank = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR3kAAAAASUVORK5CYII=', 'base64');
async function run() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.VIS_CHROME || '/usr/bin/chromium', headless:true,
    args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
  const report = { createdAt:new Date().toISOString(), sourcePath, sourceSha256:sha(source), p5Sha256:sha(p5), renderer:'Chromium SwiftShader; physical-device performance unmeasured', cases:[] };
  try {
    for (const viewport of viewports) for (const mode of modes) {
      const context = await browser.newContext({ viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:dpr,isMobile:true,hasTouch:true });
      await context.addInitScript(() => window.addEventListener('resize', e=>{try{if(typeof leftStick==='undefined'||!leftStick||!rightStick)e.stopImmediatePropagation();}catch(_){e.stopImmediatePropagation();}},true));
      const page = await context.newPage(); const errors=[],consoleErrors=[];
      page.on('pageerror',e=>errors.push(e.stack||String(e)));
      page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
      await page.route('http://frontier.local/**',r=>{
        const url = r.request().url();
        if(url.endsWith('/p5.js'))return r.fulfill({status:200,contentType:'application/javascript',body:p5});
        if(url.endsWith('/game.js'))return r.fulfill({status:200,contentType:'application/javascript',body:source});
        if(/\.(mp3|wav)(\?.*)?$/.test(url))return r.fulfill({status:204,body:''});
        if(/\.png(\?.*)?$/.test(url))return r.fulfill({status:200,contentType:'image/png',body:blank});
        return r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>html,body{margin:0;overflow:hidden;background:#111;touch-action:none}canvas{display:block}</style><script src="/p5.js"></script><script src="/game.js"></script>'});
      });
      await page.goto('http://frontier.local/',{waitUntil:'load'});
      await page.waitForFunction(()=>typeof width==='number'&&width>0&&typeof setup==='function'&&!!document.querySelector('canvas'));
      await page.evaluate(mode=>{
        noLoop();randomSeed(7);noiseSeed(BIOME_SEED);
        isStoryMode=true;started=true;isDead=isWin=isPaused=false;
        window.outpostForts={};seedWorldClock();startAtLevel(3);
        inStoryIntro=inStoryRoom=killcamMode=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inDarchonCall=inTravelMenu=inOverworldView=false;
        objectiveTimer=0;streakMsgTimer=0;frontierBountyHudAlpha();_frontierBountyHud.clockMs=10000;
        window.showOnScreenControls=true;window.isDesktop=false;
        leftStick.active=rightStick.active=false;leftStick.dx=leftStick.dy=rightStick.dx=rightStick.dy=rightStick.dist=0;
        glRigClock=function(){};glRigWatchdog=function(){};
        if(mode==='advanced'){glRigInit();GLRig.on=GLRig.ok;}else GLRig.on=false;
      },mode);
      for (const scene of scenes.filter(s=>selected.includes(s.id))) {
        const placed = await page.evaluate(scene=>{
          let x=scene.x,y=scene.y;
          if(scene.canyon){const p=frontierCanyonProfile('X',scene.canyon,100.125);x=scene.canyon;y=p.center;}
          player.x=x;player.y=y;player.hp=player.maxHp;player.aimAngle=-Math.PI/2;
          worldTimeMs=13/24*DAY_MS;updateSunVector();zoom=.65;
          camX=x-width/(2*zoom);camY=y-height/(2*zoom);
          viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;
          chunkMgr.update(x,y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();lastActiveUpdate=-100;updateActiveWorld();
          updateFrontierExplorationNotice(1);_frontierExplorationNotice.ageMs=10000;
          return {x,y,elevation:groundElev(x,y)};
        },scene);
        const result = await page.evaluate(async ({frames,warmFrames,measureRaf})=>{
          const p=p5.instance||window._p5Instance,stackBefore=p?._styles?.length||0,times=[],intervals=[];let previous=null;
          for(let i=0;i<warmFrames;i++){deltaTime=1000/60;frameCount++;draw();}
          for(let i=0;i<frames;i++){if(measureRaf)await new Promise(resolve=>requestAnimationFrame(resolve));deltaTime=1000/60;frameCount++;const t=performance.now();draw();times.push(performance.now()-t);if(previous!==null)intervals.push(t-previous);previous=t;}
          return {times,intervals,stackBefore,stackAfter:p?._styles?.length||0,level:currentLevel,biome:currentBiome,
            density:pixelDensity(),actors:enemiesList.length,solids:activeBuildings.length,canvases:document.querySelectorAll('canvas').length,
            chunks:chunkMgr.chunks.size,retiredTextures:chunkMgr.texCache?.size??chunkMgr.texCache?.length,
            gl:{ok:GLRig.ok,on:GLRig.on,tier:GLRig.tier,error:GLRig.gl?.getError(),failure:GLRig.failure,w:GLRig.w,h:GLRig.h},fault:window.FRAME_FAULT||null,
            architecturalLandmarks:activeBuildings.filter(b=>/HOIST|MINE HEAD/.test(b.signText||'')).map(b=>({name:b.signText,x:b.x,y:b.y,arch:b.arch,design:b.frontierDesign,
              maxRoofHeight:b.frontierDesign?Math.max(...frontierRoofMesh(b).faces.flatMap(f=>f.points.map(p=>p[2]))):null}))};
        },{frames,warmFrames,measureRaf});
        const filename=`${viewport.id}-${mode}-${scene.id}.png`;
        await page.screenshot({path:path.join(out,filename)});
        const row={scene:scene.id,viewport:viewport.id,mode,placed,screenshot:filename,cpuDrawMs:stats(result.times),...(measureRaf?{frameIntervalMs:stats(result.intervals)}:{}),...result,errors:errors.slice(),consoleErrors:consoleErrors.slice()};delete row.times;delete row.intervals;
        report.cases.push(row);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
        console.log(JSON.stringify({scene:row.scene,viewport:row.viewport,mode,cpuDrawMs:row.cpuDrawMs,errors:row.errors,stack:[row.stackBefore,row.stackAfter],gl:row.gl}));
        if(row.errors.length||row.stackBefore!==row.stackAfter||row.gl.error||row.fault||(mode==='advanced'&&!row.gl.on))process.exitCode=1;
      }
      await context.close();
    }
  } finally { await browser.close(); }
}
run().catch(e=>{console.error(e);process.exitCode=1;});

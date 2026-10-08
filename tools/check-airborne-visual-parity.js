// Same-browser, exact-pixel regression for optimizations that must not change
// the aircraft, their flight paths, or the existing effects and lighting.
//
// Capture the unmodified version before editing:
//   AIRBORNE_BASELINE_JS=/tmp/before.js node tools/check-airborne-visual-parity.js --capture
// Compare the working version with that capture:
//   VIS_DEPS=/path/to/p5-and-playwright node tools/check-airborne-visual-parity.js
// The capture lives outside the repository. No image-diff package is required:
// raw RGBA buffers and every frame's actor/effect state are compared exactly.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const deps = process.env.VIS_DEPS || '/workspace/onboarding-newone';
const { chromium } = require(path.join(deps, 'node_modules/playwright'));
const p5Source = fs.readFileSync(path.join(deps, 'node_modules/p5/lib/p5.min.js'), 'utf8');
const out = process.env.AIRBORNE_PARITY_OUT || '/tmp/newone-airborne-visual-parity';
const capture = process.argv.includes('--capture');
const game = capture ? process.env.AIRBORNE_BASELINE_JS : (process.env.GAME_JS || path.join(__dirname, '..', 'game.js'));
assert(game, 'Set AIRBORNE_BASELINE_JS to an immutable copy of game.js when capturing.');
// One immutable snapshot per run: scenes and metadata must describe the same
// source even if another editor saves game.js while Chromium is rendering.
const gameSource = fs.readFileSync(game, 'utf8');
fs.mkdirSync(out, { recursive: true });

function documentFor(w, h) {
  return `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#111}</style>
  <script>
  let seed=2928173;
  Math.random=function(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  Date.now=function(){return 1700000000000;};
  Object.defineProperty(window,'localStorage',{value:{getItem(){return null;},setItem(){},removeItem(){}}});
  </script>
  <script>${p5Source}</script>
  <script>${gameSource}</script>
  <script>
  window.preload=function(){};
  window.setup=function(){
    createCanvas(${w},${h});pixelDensity(1);noLoop();randomSeed(728194);noiseSeed(1337);
    window.millis=function(){return window.__clock||0;};
    window.__ready=true;
  };
  </script>`;
}

async function runScene(page, hour) {
  return page.evaluate(({hour}) => {
    randomSeed(728194);noiseSeed(1337);window.__clock=0;
    started=true;isStoryMode=false;isHardMode=false;isPaused=false;
    currentLevel=3;currentBiome=3;BIOME_ACTIVE=true;doTick=true;
    nm0AmbushActive=false;townsData={};weather=null;isRaining=false;
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
    // Pin the full-quality Canvas lighting path. A runtime watchdog change
    // would be a separate graphics configuration, not a visual regression.
    GLRig.on=false;GLRig.ok=false;GLRig.tried=true;
    worldTimeMs=DAY_MS*hour/24;clockLastMs=0;updateSunVector();
    zoom=width<800?0.52:0.78;camX=-width/(2*zoom);camY=-height/(2*zoom);
    viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;
    buildings=[
      {x:-210,y:-185,w:430,h:290,hp:900},
      {x:255,y:170,w:330,h:240,hp:900},
      {x:-370,y:265,w:210,h:220,hp:900},
      {x:80,y:-370,w:16,h:16,isStreetLight:true,hp:900},
      {x:360,y:-50,w:16,h:16,isStreetLight:true,hp:900}
    ];
    activeBuildings=buildings.slice();parkingCars=[];activeParkingCars=[];
    invalidateColIndex();buildColIndex();
    particles=[];bullets=[];grenades=[];barrels=[];corpses=[];townCitizens=[];
    _particlePool.length=0;
    player=new Character(520,-90,true);player.hp=100000;player.maxHp=100000;
    player.currentWeapon=WEAPONS.DUAL_SMG;player.aimAngle=Math.PI;
    window.__flights=['AERIAL','AERIAL_PISTOL','SAUCER','SAUCER_RED'].map((type,i)=>{
      const points=[[-300,-220],[210,140],[-400,-210],[-120,60]];
      const e=new Character(points[i][0],points[i][1],false,type);
      e.state='CHASE';e.loseSightTimer=3500;e.aiOffset=0;e.strafeDir=1;
      e.hp=100000;e.maxHp=100000;
      return e;
    });
    const ally=new Character(470,-145,false,'NORMAL');ally.isFriendly=true;ally.isMilitary=true;
    ally.aimAngle=Math.PI;ally.hp=100000;ally.maxHp=100000;
    __flights[2].aggroTarget=ally;__flights[2].aggroTimer=9999;
    const armored=new Character(25,285,false,'ARMORED_STANDARD');armored.aimAngle=-Math.PI/2;
    armored.hp=100000;armored.maxHp=100000;
    enemiesList=__flights.concat([ally,armored]);
    const states=[],images=[];
    const record=()=>({
      flights:__flights.map(e=>({type:e.eType,x:e.x,y:e.y,aim:e.aimAngle,move:e.moveAngle,
        walking:e.walkCycle,arm:e.armDrag,moving:e.isMoving,hp:e.hp,ammo:e.ammo,
        fire:e.fireTimer,reload:e.reloadTimer,station:e.airborneStation&&{
          x:e.airborneStation.x,y:e.airborneStation.y,clear:e.airborneStation.clearLane,
          targetX:e.airborneStation.targetX,targetY:e.airborneStation.targetY}})),
      particles:particles.map(p=>({x:p.x,y:p.y,vx:p.vx,vy:p.vy,sz:p.sz,l:p.l,a:p.a,t:p.t})),
      bullets:bullets.map(b=>({x:b.x,y:b.y,active:b.active})),
      grenades:grenades.map(g=>({x:g.x,y:g.y})),
      sun:[LIGHT_DX,LIGHT_DY],clock:worldTimeMs
    });
    // Advance the actual AI, effect updates, and painter order for 120 frames.
    // We own time/camera/population here to exclude wall-clock load and random
    // ambient spawning from an exact visual comparison.
    for(let f=0;f<=120;f++){
      frameCount=f+1;deltaTime=1000/60;window.__clock=f*1000/60;
      if(f>0)for(const e of __flights)e.updateEnemy();
      if(f%30===0){
        emit(armored.x-12,armored.y-6,10,color(255,150,0),'SPARK');
        emit(armored.x,armored.y,5,color(100,100,100),'CHIP');
        emit(-30,-15,5,color(60,70,80),'SMOKE');
      }
      background(210,180,140);
      push();scale(zoom);translate(-camX,-camY);
      stroke(174,145,112);strokeWeight(1);
      for(let x=-900;x<=900;x+=100)line(x,-1200,x,1200);
      for(let y=-1200;y<=1200;y+=100)line(-900,y,900,y);
      _depthOn=true;_depthActors.length=0;_airborneActors.length=0;_standDecor.length=0;
      actorShow(player);for(const e of enemiesList)actorShow(e);
      drawBuildingShadows();drawDepthSorted();drawAirborneActors();
      updateBullets();updateGrenades();updateParticles();drawNightLights();
      pop();drawLightPass();drawBiomeScreenLayer();
      states.push(record());
      if([0,30,60,120].includes(f)){
        const rgba=drawingContext.getImageData(0,0,width,height).data;
        // Encode RGBA without a giant spread() call or an image dependency.
        let raw='';for(let p=0;p<rgba.length;p+=8192)
          raw+=String.fromCharCode.apply(null,rgba.subarray(p,p+8192));
        images.push({frame:f,rgba:btoa(raw),png:canvas.toDataURL('image/png')});
      }
    }
    return {states,images,drawFault:window.FRAME_FAULT||null};
  }, {hour});
}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',
    args:['--no-sandbox','--disable-gpu']});
  const manifest={game:crypto.createHash('sha256').update(gameSource).digest('hex'),scenes:[]};
  let checks=0;
  try{
    for(const [device,w,h] of [['phone',540,1170],['desktop',1440,900]]){
      for(const [lighting,hour] of [['day-shadow',9.5],['night-fog',20.4]]){
        const name=device+'-'+lighting;
        const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
        const errors=[];page.on('pageerror',e=>errors.push(String(e.stack||e)));
        await page.setContent(documentFor(w,h));await page.waitForFunction('window.__ready');
        const result=await runScene(page,hour);
        assert.deepEqual(errors,[],name+' browser errors');checks++;
        assert.equal(result.drawFault,null,name+' guarded renderer error');checks++;
        assert(result.states[0].flights.every((e,i)=>
          Math.hypot(e.x-result.states[120].flights[i].x,e.y-result.states[120].flights[i].y)>30),
          name+' fixture must advance every flyer');checks++;
        const prefix=path.join(out,name);
        const stateJSON=JSON.stringify(result.states);
        fs.writeFileSync(prefix+(capture?'-before':'-after')+'-state.json',stateJSON);
        if(!capture){
          const beforeJSON=fs.readFileSync(prefix+'-before-state.json','utf8');
          if(stateJSON!==beforeJSON){
            const before=JSON.parse(beforeJSON);
            const frame=result.states.findIndex((s,i)=>JSON.stringify(s)!==JSON.stringify(before[i]));
            assert.fail(name+' flight/effect state changed at frame '+frame+'; inspect '+prefix+'-before-state.json and -after-state.json');
          }
          checks++;
        }
        const frames=[];
        for(const im of result.images){
          const rgba=Buffer.from(im.rgba,'base64');
          const base=prefix+'-f'+im.frame;
          fs.writeFileSync(base+(capture?'-before':'-after')+'.png',Buffer.from(im.png.split(',')[1],'base64'));
          if(capture)fs.writeFileSync(base+'-before.rgba',rgba);
          else {
            const before=fs.readFileSync(base+'-before.rgba');
            let changed=0,maxDelta=0;
            for(let i=0;i<rgba.length;i++)if(rgba[i]!==before[i]){changed++;maxDelta=Math.max(maxDelta,Math.abs(rgba[i]-before[i]));}
            assert.equal(changed,0,name+' frame '+im.frame+': '+changed+' RGBA channels differ, max delta '+maxDelta);checks++;
          }
          frames.push({frame:im.frame,rgba:crypto.createHash('sha256').update(rgba).digest('hex')});
        }
        manifest.scenes.push({name,frames});
        console.log(name+': '+(capture?'baseline captured':'121 identical state frames; 4 pixel-identical images'));
        await page.close();
      }
    }
    fs.writeFileSync(path.join(out,capture?'baseline.json':'after.json'),JSON.stringify(manifest,null,2));
    console.log(checks+' exact parity checks passed; artifacts: '+out);
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});

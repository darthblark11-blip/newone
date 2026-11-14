// Neighboring elevated wood must never repaint opaque foliage. Record the
// production painters, not a replacement tree or a source-code pattern.
// Optional real p5 pixel check: CANOPY_NATIVE=1 node tools/check-forest-canopy-occlusion.js
// Use --native-only with GAME_JS to compare an older renderer independently.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let checks = 0;
function ok(value, label) { assert(value, label); checks++; }

function checkQueue() {
  const {probe} = require('./harness');
  const P = code => probe('(' + code + ')');
  probe(`
    BIOME_ACTIVE=true;currentBiome=currentLevel=2;
    width=900;height=700;zoom=1;groundElev=function(){return 0;};
    GLRig.ok=GLRig.on=false;activeBuildings=[];activeParkingCars=[];
    enemiesList=[];allies=[];player=null;worldTimeMs=DAY_MS*13/24;updateSunVector();
    forestPolygonPainter=function(g){return g;};
    __occlusionEvents=[];__occlusionDecor=null;__occlusionPhase=null;
    const originalClutter=paintForestClutter,originalBole=paintForestTreeBole;
    const originalCrown=forestTreeCrown,originalLine=line;
    paintForestClutter=function(g,d,t,phase){
      const savedD=__occlusionDecor,savedPhase=__occlusionPhase;
      __occlusionDecor=d;__occlusionPhase=phase;
      __occlusionEvents.push(d.id+':pass:'+phase);
      try{return originalClutter(g,d,t,phase);}
      finally{__occlusionDecor=savedD;__occlusionPhase=savedPhase;}
    };
    paintForestTreeBole=function(g,d,path,lx,ly,tw,ink,phase){
      __occlusionEvents.push(d.id+':bole:'+__occlusionPhase);
      return originalBole.apply(this,arguments);
    };
    forestTreeCrown=function(){
      if(__occlusionDecor)__occlusionEvents.push(__occlusionDecor.id+':leaf:'+__occlusionPhase);
      return originalCrown.apply(this,arguments);
    };
    line=function(){
      if(__occlusionDecor&&__occlusionDecor.forestSpecies==='CHARRED_SNAG')
        __occlusionEvents.push('snag:branch:'+__occlusionPhase);
      return originalLine.apply(this,arguments);
    };
    __occlusionTrees=[
      {id:'cedar',t:'PINE',forestSpecies:'WESTERN_CEDAR',forestRegion:'TIMBER',x:420,y:10,s:1.7,r:.72,c:.37},
      {id:'fir',t:'PINE',forestSpecies:'DOUGLAS_FIR',forestRegion:'TIMBER',x:350,y:90,s:1.7,r:.72,c:.69},
      {id:'snag',t:'SNAG',forestSpecies:'CHARRED_SNAG',forestRegion:'BURN',x:390,y:110,s:1.6,r:.9,c:.42}
    ];
    __occlusionRecords=JSON.stringify(__occlusionTrees);
  `);
  for (const [nx,ny] of [[-.6,.2],[0,.2],[.6,.2],[.5,-.4]]) {
    for (const warm of [false,true]) {
      probe(`
        camX=420-width*.5*(1+${nx});camY=10-height*.5*(1+${ny});
        viewLeft=viewTop=-2000;viewRight=viewBottom=2000;
        __occlusionEvents=[];_standDecor=__occlusionTrees.slice();
        _depthActors=[];_airborneActors=[];_depthOn=true;
        for(const y of [0,60,150])actorShow({y,show(){__occlusionEvents.push('actor:'+y);}});
        actorShow({y:100,hp:100,eType:'AERIAL',show(){__occlusionEvents.push('flyer');}});
        drawDepthSorted();drawAirborneActors();
      `);
      const events = P('__occlusionEvents');
      const index = e => events.indexOf(e);
      const firstLeaf = events.findIndex(e => e.includes(':leaf:'));
      const lastWood = Math.max(...events.map((e,i) => /:bole:wood$|:branch:wood$/.test(e) ? i : -1));
      const label = `${nx},${ny} ${warm?'warm':'cold'}`;
      ok(index('actor:150')<lastWood && lastWood<firstLeaf,
        'all neighboring upper wood finishes before the first opaque leaf at '+label);
      for (const d of ['cedar','fir','snag']) {
        ok(events.filter(e => e===d+':bole:root').length===1 &&
          events.filter(e => e===d+':bole:wood').length===1 &&
          !events.includes(d+':bole:foliage'), d+' paints each wood slice exactly once at '+label);
        ok(index(d+':bole:wood')>index('actor:150') && index(d+':bole:wood')<index('flyer'),
          d+' raised wood covers ground actors and stays below aircraft at '+label);
      }
      ok(index('actor:0')<index('cedar:bole:root') && index('cedar:bole:root')<index('actor:60') &&
        index('actor:60')<index('fir:bole:root') && index('fir:bole:root')<index('actor:150'),
        'lower wood retains contact depth beside actors at '+label);
      ok(events.filter(e => e==='snag:branch:wood').length===15 &&
        !events.some(e => /^snag:(leaf|branch):foliage$/.test(e)),
        'bare snag branches render only in elevated wood, below neighboring foliage at '+label);
      ok(events.filter(e => /:leaf:foliage$/.test(e)).length===4 &&
        events.filter(e => /:leaf:foliage$/.test(e)).every(e => index(e)<index('flyer')),
        'both trees paint opaque foliage exactly once below aircraft at '+label);
      ok(P('JSON.stringify(__occlusionTrees.map(({_depthKey,...record})=>record))===__occlusionRecords&&_forestCrowns.length===0&&!_depthOn'),
        'cached rendering preserves decor and clears the overhead queue at '+label);
    }
  }

  // Dispatch through the actual deferred height pass. A correct visible leaf
  // must retain its leaf material/height when a neighboring shaft overlaps it.
  probe(`
    authoredCore=authoredChunks=authoredMask=null;
    __gpuEvents=[];__gpuDecor=null;__gpuPhase=null;
    const originalHeight=glRigForestCanopyHeight,originalHeightWood=glRigForestTreeTrunkHeight;
    const originalHeightCrown=forestTreeCrown,originalHeightBough=forestTreeBough;
    glRigForestCanopyHeight=function(g,d,cp,phase){
      const savedD=__gpuDecor,savedPhase=__gpuPhase;__gpuDecor=d;__gpuPhase=phase;
      try{return originalHeight.apply(this,arguments);}
      finally{__gpuDecor=savedD;__gpuPhase=savedPhase;}
    };
    glRigForestTreeTrunkHeight=function(g,d,cp,phase='root'){
      __gpuEvents.push(d.id+':wood:'+phase);
      return originalHeightWood.apply(this,arguments);
    };
    forestTreeCrown=function(){
      if(__gpuDecor)__gpuEvents.push(__gpuDecor.id+':leaf:'+__gpuPhase);
      return originalHeightCrown.apply(this,arguments);
    };
    forestTreeBough=function(){
      if(__gpuDecor)__gpuEvents.push(__gpuDecor.id+':leaf:'+__gpuPhase);
      return originalHeightBough.apply(this,arguments);
    };
    __gpuG=createGraphics();GLRig.hgt=__gpuG;GLRig.hw=width/2;
    __gpuG.ellipse=function(){__gpuEvents.push('actor');};
    __gpuG.line=function(){if(__gpuDecor)__gpuEvents.push(__gpuDecor.id+':branch:'+__gpuPhase);};
    player={x:420,y:60,hp:100,aimAngle:0};
    chunkMgr={biome:2,chunks:new Map([['0,0',{cx:0,cy:0,decor:__occlusionTrees}]])};
  `);
  for (const nx of [-.6,.6]) for (const warm of [false,true]) {
    probe(`camX=420-width*.5*(1+${nx});camY=10-height*.5*1.2;__gpuEvents=[];glRigPaintHeight();`);
    const events=P('__gpuEvents'),actor=events.indexOf('actor');
    const firstLeaf=events.findIndex(e=>e.includes(':leaf:'));
    const lastWood=Math.max(...events.map((e,i)=>/:wood:crown$|:branch:wood$/.test(e)?i:-1));
    const label=nx+' '+(warm?'warm':'cold');
    ok(events.filter(e=>e==='actor').length===1 && actor<lastWood && lastWood<firstLeaf,
      'actual height dispatcher paints actors, then every upper shaft, then leaves at '+label);
    for(const d of ['cedar','fir','snag']) {
      ok(events.indexOf(d+':wood:root')<actor &&
        events.filter(e=>e===d+':wood:root').length===1 &&
        events.filter(e=>e===d+':wood:crown').length===1,
        d+' height field retains one root and one upper slice at '+label);
    }
    ok(events.filter(e=>e==='snag:branch:wood').length===5 &&
      !events.some(e=>/^snag:(leaf|branch):foliage$/.test(e)),
      'actual height dispatcher puts bare branches beneath neighboring leaves at '+label);
    ok(events.filter(e=>/:leaf:foliage$/.test(e)).length===18 &&
      !events.some(e=>/:leaf:wood$/.test(e)) && P('_glForestCanopies.length===0'),
      'actual height dispatcher emits each tree\'s nine leaf masks once and clears its queue at '+label);
  }
}

async function checkNative() {
  const deps=process.env.VIS_DEPS||path.resolve('work/visual-deps');
  const {chromium}=require(path.join(deps,'node_modules/playwright'));
  const p5=fs.readFileSync(process.env.VIS_P5||path.resolve('work/visual-deps-p5-190/node_modules/p5/lib/p5.min.js'),'utf8');
  const source=fs.readFileSync(process.env.GAME_JS||path.resolve('game.js'),'utf8');
  const out=path.resolve(process.env.CANOPY_OUT||'work/tree-canopy-occlusion/native');
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:900,height:820}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.setContent('<style>body{margin:0}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null;},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};setup=function(){createCanvas(900,820);pixelDensity(1);noLoop();window.__ready=true;};</script>');
    await page.waitForFunction('__ready');
    await page.evaluate(()=>{
      started=doTick=true;isPaused=isDead=isWin=isStoryMode=killcamMode=false;
      currentLevel=currentBiome=2;BIOME_ACTIVE=true;worldTimeMs=DAY_MS*13/24;isRaining=false;updateSunVector();
      GLRig.ok=GLRig.on=false;activeBuildings=[];activeParkingCars=[];townCitizens=[];
      barrels=[];fires=[];allies=[];enemiesList=[];zoom=1;
      leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
      window.__nativeTrees=[];
      window.__nativeCanopy=(nx,withSnag,reference)=>{
        camX=-width*.5-nx*width*.5;camY=-height*.5-.05*height*.5;
        viewLeft=camX;viewRight=camX+width;viewTop=camY;viewBottom=camY+height;
        if(!__nativeTrees.length){
          const mk=(x,y,c,species)=>({t:species==='CHARRED_SNAG'?'SNAG':'PINE',forestSpecies:species,forestRegion:'TIMBER',forestHabitat:'VIBRANT',x,y,s:1.5,r:.72,c});
          __nativeTrees=[mk(0,0,.37,'WESTERN_CEDAR'),mk(Math.sign(nx)*70,80,.69,'DOUGLAS_FIR')];
          if(withSnag)__nativeTrees.push(mk(Math.sign(nx)*45,100,.42,'CHARRED_SNAG'));
        }
        const trees=__nativeTrees;
        resetMatrix();background(102,139,75);push();translate(-camX,-camY);
        _standDecor.length=0;_depthActors.length=0;_depthOn=true;_standDecor.push(...trees);
        const actual=paintForestClutter,bole=paintForestTreeBole;
        if(reference)paintForestClutter=(g,d,t,phase)=>['crown','wood','foliage'].includes(phase)?true:actual(g,d,t,phase);
        drawDepthSorted();paintForestClutter=actual;
        if(reference){
          for(const d of trees){
            if(d.forestSpecies==='CHARRED_SNAG'){actual(window,d,frameCount,'crown');continue;}
            const cm=forestCanopyMass(d),fp=forestPropProfile(d),lean=[];
            massLean(d.x,d.y,cm[0]*d.s,lean);push();translate(d.x,d.y);
            bole(window,d,forestPolygonPainter(window),lean[0],lean[1],(fp.trunkWidth||9)*d.s,(fp.outline||1.8)*d.s,'crown');pop();
          }
          paintForestTreeBole=()=>{};
          for(const d of trees)if(d.forestSpecies!=='CHARRED_SNAG')actual(window,d,frameCount,'crown');
          paintForestTreeBole=bole;
        }
        pop();return drawingContext.getImageData(0,0,width,height).data;
      };
    });
    const results=[];
    for(const [view,nx] of [['left',-.4],['center',0],['right',.4]])for(const withSnag of [false,true])for(const warm of [false,true]) {
      const label=view+(withSnag?'-snag':'-trees')+(warm?'-warm':'-cold');
      const result=await page.evaluate(({nx,withSnag,warm})=>{
        if(!warm)__nativeTrees=[];
        const actual=__nativeCanopy(nx,withSnag,false);
        window.__actualCanopy=actual;
        return {pixels:actual.length/4};
      },{nx,withSnag,warm});
      await page.locator('canvas').first().screenshot({path:path.join(out,label+'-actual.png')});
      Object.assign(result,await page.evaluate(({nx,withSnag})=>{
        const expected=__nativeCanopy(nx,withSnag,true),actual=__actualCanopy;
        let changed=0;
        for(let i=0;i<actual.length;i+=4)if(actual[i]!==expected[i]||actual[i+1]!==expected[i+1]||actual[i+2]!==expected[i+2])changed++;
        return {changed};
      },{nx,withSnag}));
      await page.locator('canvas').first().screenshot({path:path.join(out,label+'-reference.png')});
      results.push({label,...result});
    }
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));
    ok(errors.length===0,'native overlapping forest frames have no browser errors');
    for(const result of results)ok(result.changed===0,result.label+' matches independent all-wood-before-leaf reference ('+result.changed+' differing pixels)');
  } finally { await browser.close(); }
}

(async()=>{
  if(!process.argv.includes('--native-only'))checkQueue();
  if(process.env.CANOPY_NATIVE==='1'||process.argv.includes('--native-only'))await checkNative();
  console.log(`${checks}/${checks} neighboring forest canopy checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});

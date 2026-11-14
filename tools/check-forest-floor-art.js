// Native floor styles must match ordinary p5 and restore both Canvas and p5
// caches before neighboring trees and figures draw. Exercise moving views,
// partial depth phases and every guarded renderer/color-mode fallback.
const assert = require('assert');
const fs = require('fs'), path = require('path');
const deps = process.env.VIS_DEPS || '/workspace/onboarding-newone';
const { chromium } = require(path.join(deps, 'node_modules/playwright'));
const files = process.env.VIS_P5_FILES ? process.env.VIS_P5_FILES.split(path.delimiter) :
  [process.env.VIS_P5 || path.join(deps, 'node_modules/p5/lib/p5.min.js')];
const game = fs.readFileSync(process.env.GAME_JS || path.join(__dirname, '..', 'game.js'), 'utf8');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VIS_CHROME || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-gpu'] });
  try {
    for (const file of files) {
      const page = await browser.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setContent('<script>' + fs.readFileSync(file, 'utf8') + '</script><script>' + game +
        '</script><script>window.preload=function(){};window.setup=function(){createCanvas(640,920);' +
        'pixelDensity(1);noLoop();window.__ready=true;};window.draw=function(){};</script>');
      await page.waitForFunction(() => window.__ready);
      const result = await page.evaluate(() => {
        BIOME_ACTIVE=true;currentBiome=currentLevel=2;zoom=1;
        rightStick={active:false};GLRig.on=GLRig.ok=false;
        shadowDensity=()=>.8;shadowLengthScale=()=>1;
        LIGHT_DX=-.7;LIGHT_DY=.7;
        const native=forestFloorPainter,version=p5.VERSION,inst=p5.instance,renderer=inst._renderer;
        const species=['BUSH','LOG','STUMP','FERN','REED','PEBBLE','GRASS','MUSHROOM','LITTER',
          'LUPINE','FOXGLOVE','SUN_DAISY','AMBER_FUNGUS','BOG_HUMMOCK','BOG_SEDGE','BOG_MOSS'];
        const props=species.map((name,i)=>({t:name==='BUSH'?'WEED':name,
          forestSpecies:name,forestRegion:i%2?'MARSH':'TIMBER',forestHabitat:i%3?'TIMBER':'VIBRANT',
          x:80+i%3*160,y:100+Math.floor(i/3)*125,s:1.4,r:.47+i*.31,c:.67,forestLiveProp:true}));
        const tree={t:'PINE',forestSpecies:'DOUGLAS_FIR',forestRegion:'TIMBER',
          x:540,y:120,s:1.7,r:.7,c:.3};
        const character=new Character(535,310,true,'NORMAL');character.aimAngle=.6;character.isArmed=true;
        const scenarios=[
          {name:'RGB255',mode:[RGB,255],native:true},
          {name:'RGB100',mode:[RGB,100]},
          {name:'RGB-alpha1',mode:[RGB,255,255,255,1]},
          {name:'HSB',mode:[HSB,360,100,100,1]},
          {name:'unknown-p5',mode:[RGB,255],unknown:true},
          {name:'corner-ellipse',mode:[RGB,255],corner:true},
          {name:'degree-angles',mode:[RGB,255],degrees:true}
        ];
        let checks=0,fallbacks=0;const failures=[];
        function paint(enabled,split){
          forestFloorPainter=enabled?native:()=>null;
          clear();background(97,131,76);
          // A repeated p5 color before and after each native prop catches a
          // stale _cachedFillStyle even if the prop itself paints correctly.
          for(let i=0;i<props.length;i++){
            const d=props[i];
            fill(73,151,73);stroke(35,72,43);strokeWeight(1.2);
            ellipse(d.x-36,d.y+20,9,11);
            if(split){paintForestClutter(window,d,100,'shadow');paintForestClutter(window,d,100,'root');}
            else paintForestClutter(window,d,100);
            fill(73,151,73);stroke(35,72,43);strokeWeight(1.2);
            ellipse(d.x+36,d.y+20,9,11);
            if(i===2){paintForestClutter(window,tree,100);character.show();}
          }
          forestFloorPainter=native;
          return drawingContext.getImageData(0,0,width,height).data;
        }
        for(const scenario of scenarios){
          colorMode(...scenario.mode);p5.VERSION=scenario.unknown?'unverified':version;
          ellipseMode(scenario.corner?CORNER:CENTER);angleMode(scenario.degrees?DEGREES:RADIANS);
          const active=native(window,forestPolygonPainter(window))!==null;
          if(active!==!!scenario.native)failures.push({scenario:scenario.name,wrongGuard:active});
          if(!active)fallbacks++;
          for(const [x,y]of [[0,0],[-100,80],[120,-100]])for(const split of [false,true]){
            camX=x;camY=y;
            const expected=paint(false,split),actual=paint(true,split);
            let different=0;for(let i=0;i<expected.length;i++)if(expected[i]!==actual[i])different++;
            checks++;if(different)failures.push({scenario:scenario.name,x,y,split,different});
          }
        }
        colorMode(RGB,255);ellipseMode(CENTER);angleMode(RADIANS);p5.VERSION=version;
        for(const key of ['_clipping','isP3D','_isErasing']){
          const previous=renderer[key];renderer[key]=true;
          if(native(window,forestPolygonPainter(window))!==null)failures.push({missingGuard:key});
          else fallbacks++;
          renderer[key]=previous;
        }
        const accessible=inst._accessibleOutputs;inst._accessibleOutputs={grid:true,text:false};
        if(native(window,forestPolygonPainter(window))!==null)failures.push({missingGuard:'accessibility'});
        else fallbacks++;
        inst._accessibleOutputs=accessible;
        // A cached facade must follow a replacement accessibility settings
        // object when output is toggled off again, including nested shadows.
        const oldGrid=accessible.grid;
        try {
          accessible.grid=true;inst._accessibleOutputs={grid:false,text:false};
          const active=native(window,forestPolygonPainter(window));
          if(!active||active._accessibleOutputs!==inst._accessibleOutputs)
            failures.push({staleAccessibility:true});
          const expected=paint(false,true),actual=paint(true,true);
          let different=0;for(let i=0;i<expected.length;i++)if(expected[i]!==actual[i])different++;
          checks++;if(different)failures.push({replacedAccessibility:true,different});
        } finally { accessible.grid=oldGrid;inst._accessibleOutputs=accessible; }
        return {version,checks,fallbacks,failures};
      });
      assert.deepEqual(errors,[],'mixed forest scene raised browser errors');
      assert.deepEqual(result.failures,[],'native floor styles changed mixed-scene pixels or escaped a fallback guard');
      assert.equal(result.fallbacks,10,'all guarded floor modes must retain ordinary p5');
      console.log(`Forest floor art: ${result.checks} exact mixed tree/prop/figure comparisons and ${result.fallbacks} fallbacks passed with p5 ${result.version}.`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});

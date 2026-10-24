// Actual p5 character painters at eight aim/movement bearings, plus a real
// pixel comparison of the complete tree painter with its three depth phases.
const assert = require('assert');
const fs = require('fs'), path = require('path');
const deps = process.env.VIS_DEPS || '/workspace/onboarding-newone';
const { chromium } = require(path.join(deps,'node_modules/playwright'));
const game = fs.readFileSync(process.env.GAME_JS || path.join(__dirname,'..','game.js'),'utf8');
const p5file = process.env.VIS_P5 || '/tmp/p5-1.9.4.min.js';
const out = process.env.FOREST_ANGLES_OUT || '/workspace/onboarding-newone/logs/forest-hunting/angles';
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser = await chromium.launch({executablePath:process.env.VIS_CHROME || '/usr/bin/chromium',args:['--no-sandbox','--disable-gpu']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:930}}), errors=[];
    page.on('pageerror', e=>errors.push(e.message));
    await page.setContent('<style>html,body{margin:0}</style><script>'+fs.readFileSync(p5file,'utf8')+'</script><script>'+game+
      '</script><script>window.preload=function(){};window.setup=function(){createCanvas(1440,930);pixelDensity(1);noLoop();window.__ready=true;};window.draw=function(){};</script>');
    await page.waitForFunction('window.__ready');
    const report = await page.evaluate(()=>{
      BIOME_ACTIVE=true;currentBiome=currentLevel=2;frameCount=100;
      camX=camY=0;zoom=1;activeBuildings=[];GLRig.on=GLRig.ok=false;
      rightStick={active:false};
      LIGHT_DX=-.7;LIGHT_DY=.7;shadowDensity=()=>.8;shadowLengthScale=()=>1;
      background(112,139,108);textFont('sans-serif');
      const models=[['Player','NORMAL',true],['NM0 infantry','ARMORED_STANDARD',false],['Robot','ROBOT',false],['Player strafing','NORMAL',true],['NM0 heavy (half scale)','ARMORED',false]];
      for(let row=0;row<models.length;row++)for(let i=0;i<8;i++){
        const [name,type,isPlayer]=models[row], angle=i*TWO_PI/8;
        const cellx=90+i*180,celly=110+row*180;
        push();translate(cellx,celly);scale(type==='ARMORED'?1.3:2.6);
        const c=new Character(0,0,isPlayer,type);c.aimAngle=angle;c.moveAngle=row===3?0:angle;
        c.lastMoveAngle=c.moveAngle;c.isMoving=true;c.gait=.35;c.walkCycle=1.1;c.isArmed=true;
        c.show();pop();
        noStroke();fill(232,243,216);textAlign(CENTER,CENTER);textSize(14);
        text(name+' · '+Math.round(angle*180/PI)+'°',cellx,celly+69);
      }
      // Same renderer, same world geometry: splitting the tree into depth
      // phases must neither redraw foliage nor alter any edge pixels.
      const buffer=createGraphics(300,300);buffer.pixelDensity(1);
      const cases=[];
      for(const species of ['DOUGLAS_FIR','WESTERN_CEDAR','RED_ALDER','CHARRED_SNAG'])
        for(const style of [undefined,'COMIC']){
          const d={x:145,y:140,t:species==='CHARRED_SNAG'?'SNAG':'PINE',s:1.8,r:.61,c:.32,
            forestSpecies:species,forestRegion:'TIMBER',forestHabitat:style?'VIBRANT':'TIMBER',forestCanopyStyle:style};
          buffer.clear();paintForestClutter(buffer,d,100);
          const original=buffer.drawingContext.getImageData(0,0,300,300).data;
          buffer.clear();paintForestClutter(buffer,d,100,'shadow');paintForestClutter(buffer,d,100,'root');
          if(species!=='CHARRED_SNAG')paintForestClutter(buffer,d,100,'crown');
          const split=buffer.drawingContext.getImageData(0,0,300,300).data;
          let different=0;for(let i=0;i<original.length;i++)if(original[i]!==split[i])different++;
          cases.push({species,style:style||'original',different});
        }
      buffer.remove();return{p5:p5.VERSION,angles:40,split:cases};
    });
    assert.deepStrictEqual(errors,[],'character painter browser errors');
    assert(report.split.every(t=>t.different===0),'tree phase split changes pixels: '+JSON.stringify(report.split));
    await page.locator('#defaultCanvas0').screenshot({path:path.join(out,'actor-angles.png')});
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

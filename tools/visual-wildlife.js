// Review the actual wildlife painter with both catalogue scale and all headings.
// VIS_DEPS/VIS_CHROME/VIS_P5 match the repository's other Chromium art tools.
const fs=require('fs'),path=require('path');
const deps=process.env.VIS_DEPS||'/workspace/onboarding-newone';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const p5Path=process.env.VIS_P5||path.join(deps,'node_modules/p5/lib/p5.min.js');
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'..','game.js'),'utf8');
const out=process.env.WILDLIFE_VIS_OUT||path.join(__dirname,'out','wildlife');
fs.mkdirSync(out,{recursive:true});
const html=`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#45694d}</style>
<script>${fs.readFileSync(p5Path,'utf8')}</script><script>${source}</script><script>
window.preload=function(){};window.setup=function(){createCanvas(1600,1120);pixelDensity(1);noLoop();redraw();};
window.draw=function(){
  background(79,119,81);zoom=1;currentLevel=currentBiome=2;BIOME_ACTIVE=true;LIGHT_DX=.6;LIGHT_DY=.8;
  const names=Object.keys(WILDLIFE_SPECIES),cols=8,cw=200,ch=160;
  textAlign(CENTER,TOP);textSize(11);
  for(let i=0;i<names.length;i++){
    const x=(i%cols)*cw,y=Math.floor(i/cols)*ch,spec=WILDLIFE_SPECIES[names[i]];
    noStroke();fill(27,52,35,55);rect(x+4,y+4,cw-8,ch-8,8);
    fill(239,238,210);text(spec.name,x+cw/2,y+12);fill(199,218,187);text(spec.family+' · world radius '+spec.size,x+cw/2,y+29);
    const a={id:i+2,species:names[i],x:0,y:0,angle:-.50,state:'GRAZE',bodyR:spec.size,clock:150,phase:1,wingPhase:1,airborne:spec.family==='raptor'||spec.family==='owl'||spec.family==='bird'&&!['WILD_TURKEY','DUSKY_GROUSE'].includes(names[i])};
    camX=-width/2;camY=-height/2-height*.11;
    push();translate(x+cw*.55,y+ch*.60);scale(2.45);paintWildlifeAnimal(a);pop();
    push();translate(x+cw*.81,y+ch*.80);scale(.66);paintWildlifeAnimal(a);pop();
  }
  const selected=['ELK','GRIZZLY_BEAR','GRAY_WOLF','BIGHORN_SHEEP','BALD_EAGLE','TIMBER_RATTLESNAKE','EASTERN_BOX_TURTLE','EASTERN_GRAY_SQUIRREL'];
  for(let i=0;i<selected.length;i++){
    const x=i*cw,spec=WILDLIFE_SPECIES[selected[i]];fill(240);text(selected[i]+' · turning / prone',x+cw/2,820);
    for(let n=0;n<4;n++){const a={id:2,species:selected[i],x:0,y:0,angle:n*Math.PI/2,state:n===3?'DEAD':'GRAZE',bodyR:spec.size,phase:1,wingPhase:.4,airborne:spec.family==='raptor'};
      camX=-width/2+(n%2?width*.3:-width*.3);camY=-height/2+(n<2?height*.3:-height*.3);
      push();translate(x+(n%2?cw*.72:cw*.29),875+Math.floor(n/2)*120);scale(1.25);paintWildlifeAnimal(a);pop();
    }
  }
  window.__wildlifeDone=true;
};</script>`;
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:1600,height:1120}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.setContent(html,{waitUntil:'load'});
    await page.waitForFunction(()=>window.__wildlifeDone,{timeout:30000});
    if(errors.length)throw Error(errors.join('\n'));
    await page.screenshot({path:path.join(out,'wildlife.png')});
    const version=await page.evaluate(()=>p5.VERSION);fs.writeFileSync(path.join(out,'index.html'),html);
    console.log(JSON.stringify({image:path.join(out,'wildlife.png'),p5:version}));
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});

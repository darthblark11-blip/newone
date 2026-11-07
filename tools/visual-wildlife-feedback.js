// Actual game-size wildlife beside the player, plus wounded and directional
// corpse poses. No enlarged sprite showcase: both sheets use real game zoom.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const deps=process.env.VIS_DEPS||'/workspace/onboarding-newone';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const p5file=process.env.VIS_P5||'/tmp/p5-1.9.4.min.js';
const game=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'..','game.js'),'utf8');
const out=process.env.WILDLIFE_VIS_OUT||'/workspace/onboarding-newone/logs/wildlife-corrections/feedback';
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',
    headless:true,args:['--no-sandbox','--disable-gpu']});
  try{
    const page=await browser.newPage({viewport:{width:1600,height:1160}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.setContent('<style>html,body{margin:0}</style><script>'+fs.readFileSync(p5file,'utf8')+'</script><script>'+game+
      '</script><script>window.preload=function(){};window.setup=function(){createCanvas(1600,1160);pixelDensity(1);noLoop();window.__ready=true;};window.draw=function(){};</script>');
    await page.waitForFunction(()=>window.__ready);
    const reports=[];
    for(const scale of [.65,.77]){
      const report=await page.evaluate(z=>{
        currentBiome=currentLevel=2;BIOME_ACTIVE=true;zoom=z;frameCount=100;
        LIGHT_DX=-.6;LIGHT_DY=.8;camX=-width/2;camY=-height/2;activeBuildings=[];GLRig.on=GLRig.ok=false;
        rightStick={active:false};shadowDensity=()=>.75;shadowLengthScale=()=>1;
        background(103,135,91);textFont('sans-serif');textAlign(CENTER,CENTER);
        noStroke();fill(26,44,33);textSize(22);text('Wildlife scale and combat feedback · actual game zoom '+z,800,27);
        fill(235,234,209);textSize(13);text('Player reference: 24 × 27 world units · unchanged species palette · fixed facing through every fall',800,55);
        const selected=['PLAYER','GRIZZLY_BEAR','MOOSE','ELK','GRAY_WOLF','MULE_DEER','PIKA','BALD_EAGLE'];
        const cells=[],poses=['LIVE','WOUNDED','BODY_COLLAPSE','HEADSHOT','SHOTGUN','OVERKILL','EXPLOSIVE','BIRD_DROP'];
        function animal(species,state,deathType,progress,angle){
          const s=WILDLIFE_SPECIES[species],prone=state==='DEAD'||state==='STUNNED';
          return{id:2,species,x:0,y:0,bodyR:s.size,angle,state,phase:1,clock:0,wingPhase:1,
            airborne:['bird','raptor','owl'].includes(s.family)&&!(s.traits||[]).includes('ground')&&(!prone||progress<1),
            deathType,fallTilt:-1,fall:prone?{progress,drop:progress,grounded:progress===1}:null,
            decals:state==='GRAZE'&&deathType==='LIVE'?[]:[{x:-.20,y:.07,size:.20,head:false},{x:s.headForward/s.size,y:0,size:.14,head:true}]};
        }
        function person(){
          const c=new Character(0,0,true,'NORMAL');c.aimAngle=c.moveAngle=-.50;c.lastMoveAngle=c.moveAngle;
          c.isMoving=false;c.isArmed=true;c.currentWeapon=WEAPONS.PISTOL;c.show();
        }
        function cell(x,y,label,draw){
          push();noStroke();fill(29,48,36,55);rect(x-95,y-66,190,145,7);fill(240,238,211);textSize(12);text(label,x,y+57);
          translate(x,y);scale(z);draw();pop();
        }
        for(let i=0;i<selected.length;i++){
          const id=selected[i],x=100+i*200,y=150;
          cell(x,y,id==='PLAYER'?'PLAYER · 24×27':WILDLIFE_SPECIES[id].name,()=>{
            if(id==='PLAYER')person();else paintWildlifeAnimal(animal(id,'GRAZE','LIVE',0,-.50));
          });
          cells.push({species:id,zoom:z,radius:id==='PLAYER'?null:WILDLIFE_SPECIES[id].size});
        }
        const rows=['ELK','GRIZZLY_BEAR','GRAY_WOLF','BALD_EAGLE'];
        for(let row=0;row<rows.length;row++)for(let col=0;col<poses.length;col++){
          const species=rows[row],pose=poses[col],state=col<2?'GRAZE':'DEAD',x=100+col*200,y=345+row*170;
          cell(x,y,WILDLIFE_SPECIES[species].name+' · '+pose.replace('_',' '),()=>paintWildlifeAnimal(animal(species,state,pose,1,-.50)));
        }
        // A short fall changes height and folded anatomy while retaining the
        // shot's fixed facing; alternating facing shows both side poses.
        fill(26,44,33);textSize(14);text('Headshot collapse · 0 / 25 / 50 / 75 / 100% · fixed heading',450,980);
        for(let i=0;i<5;i++)cell(90+i*180,1070,Math.round(i*25)+'%',()=>paintWildlifeAnimal(animal('ELK','DEAD','HEADSHOT',i/4,-.50)));
        cell(1090,1070,'Small fauna · squirrel',()=>paintWildlifeAnimal(animal('EASTERN_GRAY_SQUIRREL','GRAZE','WOUNDED',0,-.50)));
        cell(1290,1070,'Ground bird · turkey',()=>paintWildlifeAnimal(animal('WILD_TURKEY','DEAD','BODY_COLLAPSE',1,.50)));
        cell(1490,1070,'Taser · intact stunned',()=>paintWildlifeAnimal({...animal('ELK','STUNNED','STUN',1,.50),decals:[]}));
        return{zoom:z,p5:p5.VERSION,cells,poses:rows.length*poses.length};
      },scale);
      const filename='wildlife-feedback-z'+Math.round(scale*100)+'.png';
      await page.locator('#defaultCanvas0').screenshot({path:path.join(out,filename)});
      reports.push({...report,image:path.join(out,filename)});
    }
    if(errors.length)throw Error(errors.join('\n'));
    const report={sourceSha256:crypto.createHash('sha256').update(game).digest('hex'),reports};
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});

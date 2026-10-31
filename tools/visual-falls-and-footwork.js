// Real p5 rendering of the shared directional fall and footwork rigs.
// VIS_DEPS=/path/to/deps VIS_CHROME=/path/to/chrome node tools/visual-falls-and-footwork.js animate
const fs=require('fs'),path=require('path');
const deps=process.env.VIS_DEPS,chrome=process.env.VIS_CHROME;
if(!deps||!chrome)throw Error('Set VIS_DEPS and VIS_CHROME');
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const out=path.join(__dirname,'out');fs.mkdirSync(out,{recursive:true});
const animate=process.argv.includes('animate'),W=1080,H=790;
const page=`<!doctype html><meta charset=utf-8><style>html,body{margin:0;background:#1b232b}</style>
<script>${fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8')}</script>
<script>${fs.readFileSync(path.join(__dirname,'../game.js'),'utf8')}</script>
<script>
window.preload=function(){};window.loadImage=()=>({width:1,height:1});window.loadSound=()=>({isLoaded:()=>false,play(){},stop(){},setVolume(){}});window.loadFont=()=>null;
window.setup=function(){createCanvas(${W},${H});pixelDensity(1);noLoop();randomSeed(231);noiseSeed(BIOME_SEED);
 currentLevel=1;currentBiome=1;BIOME_ACTIVE=true;authoredChunks=null;authoredCore=null;authoredMask=null;buildings=[];activeBuildings=[];barrels=[];activeParkingCars=[];enemiesList=[];invalidateColIndex();
 worldTimeMs=13/24*DAY_MS;updateSunVector();setMeleeTool('NONE');jetpackUnlocked=false;
 leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
 const citizen=(type,seed)=>{const e=new Character(0,0,false,type);cityAppearance(e,seed);e.aimAngle=0;return e;};
 const body=e=>new Corpse(e.x,e.y,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,0,0,e.decals,e.currentWeapon,HALF_PI,e.eType,e.bodyW,e.bodyH,e);
 let e=citizen('CITY_CITIZEN_M',45);e.isMoving=true;e.moveAngle=0;rememberFigureMotion(e,4,0);
 e.fallHit={frame:frameCount,kind:'BODY',angle:HALF_PI,force:4.5,mx:4,my:0,wound:null};window.__moving=body(e);
 e=citizen('CITY_CITIZEN_F',92);e.shirtCol=color(48,154,157);rememberFigureMotion(e,0,0);
 const w={x:-2,y:-7,sz:5,col:[104,9,12,230],isHead:false};e.decals=[w];e.fallHit={frame:frameCount,kind:'BODY',angle:HALF_PI,force:3,mx:0,my:0,wound:w};window.__planted=body(e);
 __planted.fall.hold=woundHold(__planted.rag,ragRig(e.bodyW,e.bodyH),w);
 window.__stun=citizen('CITY_CITIZEN_F',319);__stun.aimAngle=0;__stun.isMoving=true;__stun.moveAngle=PI;rememberFigureMotion(__stun,-3.8,0);startPunchStun(__stun,HALF_PI);
 player=new Character(0,0,true);player.isArmed=false;player.aimAngle=-HALF_PI;player.moveAngle=-HALF_PI;
 window.__frame=0;redraw();window.__done=true;
};
window.__advance=function(){frameCount++;__frame++;__moving.update();__planted.update();if(__stun.stunTimer>0)__stun.updateEnemy();};
window.draw=function(){background(29,38,46);textFont('sans-serif');noStroke();fill(239,232,207);textAlign(LEFT,TOP);textSize(26);text('DIRECTIONAL FALLS / ORTHODOX FOOTWORK',24,18);textSize(15);fill(177,198,204);text('Shared joint rig • preserved death types • '+(__frame/60).toFixed(2)+' seconds',24,53);
 const arrow=(x,y,a,label,col)=>{push();translate(x,y);rotate(a);stroke(...col);strokeWeight(3);line(0,0,36,0);line(36,0,28,-5);line(36,0,28,5);pop();noStroke();fill(...col);textSize(13);text(label,x-2,y+16);};
 const panel=(col,row,title,subtitle,fn,sc=3.3)=>{const x=20+col*530,y=86+row*348;noStroke();fill(113,131,133);rect(x,y,510,328,10);fill(232,235,220);textSize(19);text(title,x+16,y+14);textSize(14);fill(223,229,219);text(subtitle,x+16,y+42);
 push();translate(x+244,y+177);scale(sc);fn();pop();return {x,y};};
 let q=panel(0,0,'Moving / lateral rifle hit','The body continues along the running vector',()=>__moving.show());
 arrow(q.x+22,q.y+85,0,'travel',[125,239,173]);arrow(q.x+122,q.y+85,HALF_PI,'shot',[254,200,119]);
 q=panel(1,0,'Planted / ordinary body shot','Shot force drives the fall; a hand reaches the decal',()=>__planted.show());
 arrow(q.x+22,q.y+85,HALF_PI,'shot',[254,200,119]);
 q=panel(0,1,'Punch stun / moving civilian',__stun.stunTimer>32?'Sharper buckle, contact recoil, then a bounded settle':__stun.stunTimer>0?'Gradual recovery':'Recovered; still neutral',()=>__stun.show());
 arrow(q.x+22,q.y+85,PI,'travel',[125,239,173]);arrow(q.x+122,q.y+85,HALF_PI,'punch',[254,200,119]);
 const f=__frame;player.x=0;player.y=0;player.isMoving=f>=90&&f<255;player.gait=player.isMoving?.45:0;player.walkCycle=f*.21;
 player.moveAngle=player.aimAngle+(f<150?0:f<205?PI:HALF_PI);player.meleePhase=f<60?1:2;
 player.meleeTimer=f<20?20-f:f>=60&&f<80?80-f:0;player.punchDuration=20;player.boxingHold=Math.max(0,260-f);
 panel(1,1,'Boxing / compact left lead',f<20?'Jab: lead step, shoulders drive, hips follow':f<60?'Relaxed three-second guard':f<80?'Cross: rear heel lift and pivot':f<90?'Hands return to the guard':f<150?'Advance: alternating planted steps':f<205?'Retreat: maintain the orthodox stance':f<255?'Lateral step: feet stay on their own side':'Guard release',()=>player.show());
};
</script>`;
(async()=>{const browser=await chromium.launch({executablePath:chrome,args:['--no-sandbox','--disable-gpu']});const p=await browser.newPage({viewport:{width:W,height:H}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.setContent(page,{waitUntil:'load'});await p.waitForFunction('window.__done',null,{timeout:30000});
 const frames=path.join(out,'falls-motion');if(animate)fs.mkdirSync(frames,{recursive:true});
 for(let i=0;i<(animate?91:16);i++){
  if(i>0)await p.evaluate(()=>{for(let j=0;j<3;j++)__advance();redraw();});
  if(animate)await p.locator('#defaultCanvas0').screenshot({path:path.join(frames,String(i).padStart(3,'0')+'.png')});
  if(i===15)await p.locator('#defaultCanvas0').screenshot({path:path.join(out,'falls-and-footwork.png')});
 }
 await browser.close();if(errors.length)throw Error([...new Set(errors)].join('\n'));console.log('Rendered falls-and-footwork.png'+(animate?' and 91 animation frames':''));
})().catch(e=>{console.error(e);process.exitCode=1;});

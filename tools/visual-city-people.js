// Real p5 character sheet + optional 20fps animation frames, no mocked draw calls.
const fs=require('fs'),path=require('path');
const deps=process.env.VIS_DEPS,chrome=process.env.VIS_CHROME;
if(!deps||!chrome)throw Error('Set VIS_DEPS and VIS_CHROME as in visual-world.js');
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const out=path.join(__dirname,'out');fs.mkdirSync(out,{recursive:true});
const animated=process.argv.includes('animate'),W=1200,H=1120;
const page=`<!doctype html><style>html,body{margin:0;background:#191e25}</style>
<script>${fs.readFileSync(path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8')}</script>
<script>${fs.readFileSync(path.join(__dirname,'../game.js'),'utf8')}</script>
<script>
window.preload=function(){};window.loadImage=()=>({width:1,height:1});window.loadSound=()=>({isLoaded:()=>false,play(){},stop(){},setVolume(){}});window.loadFont=()=>null;
window.setup=function(){createCanvas(${W},${H});pixelDensity(1);noLoop();randomSeed(19);noiseSeed(BIOME_SEED);
 currentLevel=1;currentBiome=1;BIOME_ACTIVE=true;authoredChunks=null;authoredCore=null;authoredMask=null;buildings=[];activeBuildings=[];enemiesList=[];invalidateColIndex();
 worldTimeMs=13/24*DAY_MS;updateSunVector();setMeleeTool('NONE');jetpackUnlocked=false;player=new Character(0,0,true);
 leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
 window.__models=[];
 for(let i=0;i<12;i++){const c=new Character(0,0,false,i<6?'CITY_CITIZEN_M':'CITY_CITIZEN_F');cityAppearance(c,39+i*101);c.skinCol=color(...CITY_SKIN[Math.floor((i%6)/2)]);c.hairStyle=i%7;__models.push(c);}
 window.__stun=new Character(0,0,false,'CITY_CITIZEN_F');cityAppearance(__stun,391);startPunchStun(__stun,0);redraw();window.__done=true;
};
window.__time=0;
window.draw=function(){if(window.__animate){drawPeopleMotion();return;}background(31,39,48);textFont('sans-serif');noStroke();fill(237,228,198);textSize(26);textAlign(LEFT,TOP);text('CITY PEOPLE / MOVEMENT / IMPACT',28,20);
 const cell=(row,col,label,figure,sc=3.1)=>{const x=col*200,y=70+row*205;noStroke();fill(117+row*3,133+row*2,133+row*2);rect(x+8,y+5,184,184,8);fill(232,223,198);textSize(14);textAlign(CENTER,TOP);text(label,x+100,y+190);push();translate(x+100,y+91);scale(sc);figure();pop();};
 for(let i=0;i<12;i++)cell(Math.floor(i/6),i%6,(i<6?'Citizen M':'Citizen F')+' / '+(['deep','medium','light'][Math.floor((i%6)/2)]),()=>{const c=__models[i];c.aimAngle=.7;c.moveAngle=.7;c.show();});
 const gait=[.22,.55,.95];for(let i=0;i<3;i++)cell(2,i,['Walk','Jog','Scared run'][i],()=>{const c=__models[i+6];c.isMoving=true;c.gait=gait[i];c.walkCycle=.7+__time*(.14+i*.07);c.aimAngle=-HALF_PI;c.moveAngle=-HALF_PI;c.show();});
 cell(2,3,'NM-0 / armored post',()=>{const e=new Character(0,0,false,'NM0_CITY_GUARD');e.aimAngle=-HALF_PI;e.show();},1.8);
 cell(2,4,'NM-0 / march',()=>{const e=new Character(0,0,false,'NM0_CITY_GUARD');e.aimAngle=-HALF_PI;e.moveAngle=-HALF_PI;e.isMoving=true;e.gait=.28;e.walkCycle=__time*.18+.5;e.show();},1.8);
 cell(2,5,'Unarmed / neutral',()=>{const c=__models[3];c.aimAngle=0;c.isMoving=false;c.gait=0;c.show();});
 const punch=['Guard / left lead','Jab / hip turn','Cross / rear pivot','Recover guard','Move in guard','Guard released'];
 for(let i=0;i<6;i++)cell(3,i,punch[i],()=>{player.isArmed=false;player.boxingHold=i===5?0:180;player.meleePhase=i===2?2:1;player.meleeTimer=(i===1||i===2)?10:0;player.punchDuration=20;player.aimAngle=-HALF_PI;player.moveAngle=-HALF_PI;player.isMoving=i===4;player.gait=.3;player.walkCycle=__time*.15;player.show();});
 const ages=[0,8,20,38,110,224];for(let i=0;i<6;i++)cell(4,i,['Impact','Buckle','Side roll','Contact / rebound','Down / breathing','Push up / recovery'][i],()=>{const c=__stun;c.stunPose.age=ages[i];c.stunTimer=i===5?16:100;const r=c.stunPose.rag;r.done=false;r.t=0;r.ang=.06;for(let k=0;k<4;k++){r.limbs[k].a=k<2?.65:.22;r.limbs[k].b=k<2?1.0:.35;}c.aimAngle=0;c.show();},2.1);
};
window.drawPeopleMotion=function(){
 background(31,39,48);textFont('sans-serif');noStroke();textAlign(LEFT,TOP);fill(237,228,198);textSize(25);text('UNARMED GAIT / ORTHODOX GUARD / NONLETHAL IMPACT',25,20);
 const panel=(x,y,w,h,label,fn,sc=2.8)=>{fill(117,135,134);rect(x,y,w,h,8);fill(232,223,198);textSize(16);text(label,x+15,y+h-29);push();translate(x+w*.5,y+h*.45);scale(sc);fn();pop();};
 for(let i=0;i<3;i++)panel(20+i*310,65,295,210,['Walk','Jog','Scared run'][i],()=>{const c=__models[i+6];c.x=0;c.y=0;c.gait=[.22,.55,.95][i];c.walkCycle=__time*[.15,.24,.30][i];c.isMoving=true;c.aimAngle=-HALF_PI;c.moveAngle=-HALF_PI;c.show();});
 panel(20,290,295,280,'Jab -> three-second guard',()=>{player.x=0;player.y=0;player.isArmed=false;player.meleePhase=1;player.punchDuration=20;player.meleeTimer=Math.max(0,20-__time);player.boxingHold=Math.max(0,200-__time);player.isMoving=false;player.aimAngle=-HALF_PI;player.show();});
 panel(330,290,605,280,__stun.stunTimer>0?'Impact -> buckle -> settle -> push up':'Recovered: still neutral',()=>{__stun.show();},2.5);
};
</script>`;
(async()=>{const browser=await chromium.launch({executablePath:chrome,args:['--no-sandbox','--disable-gpu']});const p=await browser.newPage({viewport:{width:W,height:H}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.setContent(page,{waitUntil:'load'});await p.waitForFunction('window.__done',null,{timeout:30000});
 await p.locator('#defaultCanvas0').screenshot({path:path.join(out,'city-people.png')});
 if(animated){
   await p.setViewportSize({width:960,height:600});
   await p.evaluate(()=>{resizeCanvas(960,600);window.__animate=true;__stun.x=0;__stun.y=0;__stun.aimAngle=0;__stun.stunTimer=0;__stun.stunPose=null;startPunchStun(__stun,0);});
   const frames=path.join(out,'people-motion');fs.mkdirSync(frames,{recursive:true});
   for(let i=0;i<80;i++){
     await p.evaluate(t=>{window.__time=t;for(let n=0;n<3;n++){frameCount++;if(__stun.stunTimer>0)__stun.updateEnemy();}redraw();},i*3);
     await p.locator('#defaultCanvas0').screenshot({path:path.join(frames,String(i).padStart(3,'0')+'.png')});
   }
 }
 await browser.close();if(errors.length)throw Error([...new Set(errors)].join('\n'));console.log('Rendered city-people.png'+(animated?' and 80 animation frames':''));
})().catch(e=>{console.error(e);process.exitCode=1;});

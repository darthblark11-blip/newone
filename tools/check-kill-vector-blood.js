// Actual mortal shots plus baked vector geometry, blood-bank seams and depth.
const assert=require('node:assert/strict'),{ctx,mkG,probe}=require('./harness');
const P=s=>probe('('+s+')');let checks=0;
const ok=(name,value)=>{assert(value,name);checks++;};
ctx.setTimeout=()=>0;
ctx.createGraphics=(w,h)=>{
 const g=mkG();g.width=w;g.height=h;g.paths=[];g.ovals=[];let points=[];
 g.beginShape=()=>{points=[];};g.vertex=(x,y)=>points.push([x,y]);
 g.endShape=()=>g.paths.push(points);g.ellipse=(...a)=>g.ovals.push(a);
 g.clear=()=>{g.paths=[];g.ovals=[];};
 g.image=(src,x,y)=>{g.paths.push(...src.paths.map(p=>p.map(v=>[v[0]+x,v[1]+y])));g.ovals.push(...src.ovals);};
 return g;
};
probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 currentLevel=currentBiome=2;BIOME_ACTIVE=false;isStoryMode=false;
 inTownCutscene=inFortCutscene=inStoryIntro=inStoryRoom=inDarchonCall=false;
 inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inOverworldView=false;
 inTravelMenu=inWorldBuildingMenu=false;nm0AmbushActive=farmAmbushActive=false;
 buildings=activeBuildings=[];barrels=[];activeParkingCars=[];parkingCars=[];
 invalidateColIndex();resetShovelState();wipeAllBloodBanks();useBloodBank('kill-vector');
 player=new Character(-2000,-2000,true);MAX_KILLS=100000;totalKills=0;
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;
 window.vectorMarks=[];window.captureKillVector=stampKillVectorBlood;
 stampKillVectorBlood=function(...args){const mark=captureKillVector(...args);if(mark)vectorMarks.push(mark);return mark;};`);
function shoot(hp,angle=0,type='NORMAL'){
 probe(`frameCount++;bullets=[];particles=[];corpses=[];vectorMarks=[];
  window.vectorVictim=new Character(200,200,false,'${type}');vectorVictim.hp=${hp};
  vectorVictim.aimAngle=0;vectorVictim.isFriendly=vectorVictim.isNeutral=false;enemiesList=[vectorVictim];
  window.vectorRound=spawnBullet(200-Math.cos(${angle})*40,200-Math.sin(${angle})*40,
   ${angle},true,'BODY',WEAPONS.PISTOL,player);
  for(let i=0;i<10&&vectorRound.active;i++)updateBullets();`);
}
shoot(1000);
ok('a nonfatal projectile keeps small impact drops without adding a kill stain',P('vectorMarks.length===0&&!vectorVictim._killVectorBloodStamped'));
for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2]){
 shoot(1,a);
 ok('a real fatal shot adds exactly one vector stain at '+a,P('vectorMarks.length===1&&vectorVictim.dead'));
 ok('the final projectile vector controls the stain at '+a,Math.abs(Math.atan2(Math.sin(P('vectorMarks[0].angle')-a),Math.cos(P('vectorMarks[0].angle')-a)))<1e-8);
 ok('the original oval death pool is still created at '+a,P('bloodPools.length>0'));
 const count=P('Object.values(bloodChunks).reduce((n,e)=>n+e.pg.paths.length,0)');
 probe('stampKillVectorBlood(vectorVictim,player,vectorVictim.x,vectorVictim.y);');
 ok('repeated death dispatch cannot stamp the victim twice at '+a,P('Object.values(bloodChunks).reduce((n,e)=>n+e.pg.paths.length,0)')===count);
}
for(const type of ['ROBOT','SAUCER','BUG','SNAIL','ALIEN_GATOR','COW']){
 probe(`frameCount++;window.vectorOther=new Character(200,200,false,'${type}');vectorOther.hp=0;`);
 ok(type+' does not receive human vector blood',P('stampKillVectorBlood(vectorOther,player,200,200)===null'));
}
const nativeRandom=ctx.random;ctx.random=()=>{throw Error('vector blood consumed combat randomness');};
try{
 const first=P('buildKillVectorBlood(.6,713)'),again=P('buildKillVectorBlood(.6,713)');
 ok('the same contact seed produces the same fixed polygon geometry',JSON.stringify(first)===JSON.stringify(again));
 ok('the stain uses bounded ragged polygons and tapered satellites',first.paths.length===17&&first.paths.every(p=>p.points.length>=4&&p.points.every(v=>v.every(Number.isFinite)))&&first.spread<100);
 const east=P('buildKillVectorBlood(0,713)'),south=P('buildKillVectorBlood(Math.PI/2,713)');
 ok('the whole pattern rotates with the attack vector',east.paths.every((p,i)=>p.points.every((v,j)=>Math.abs(south.paths[i].points[j][0]+v[1])<1e-8&&Math.abs(south.paths[i].points[j][1]-v[0])<1e-8)));
 probe(`wipeAllBloodBanks();useBloodBank('seam');frameCount++;
  window.seamVictim={x:CHUNK_SIZE-1,y:CHUNK_SIZE-1,hp:0,eType:'NORMAL',bodyW:21,bodyH:27,aimAngle:0};
  window.seamMark=stampKillVectorBlood(seamVictim,{x:0,y:0},seamVictim.x,seamVictim.y);`);
 const seams=P(`Object.entries(bloodChunks).map(([key,e])=>{
  const [cx,cy]=key.split(',').map(Number);return {key,polygons:e.pg.paths.map(p=>p.map(v=>[v[0]+e.bx+cx*CHUNK_SIZE,v[1]+e.by+cy*CHUNK_SIZE]))};})`);
 ok('a corner-crossing stain uses only the existing floor layer',seams.length===4&&seams.every(s=>!s.key.endsWith(',B')));
 const reference=seams[0].polygons;
 ok('crossed canvases receive the same world-space polygon seam geometry',seams.every(s=>s.polygons.every((p,i)=>p.every((v,j)=>Math.hypot(v[0]-reference[i][j][0],v[1]-reference[i][j][1])<1e-8))));
 ok('surface vector marks are baked without a new oval or persistent mark list',P('shovelBloodMarks.length===0&&Object.values(bloodChunks).every(e=>e.pg.ovals.length===0)&&bloodBytes>0'));
 probe(`const before=JSON.stringify(Object.keys(bloodChunks));useBloodBank('elsewhere');useBloodBank('seam');window.seamBankReturned=JSON.stringify(Object.keys(bloodChunks))===before;`);
 ok('travel away and back restores the same baked floor stain',P('seamBankReturned'));
 probe(`frameCount++;window.mixedVictim={x:200,y:200,hp:0,eType:'NORMAL',bodyW:21,bodyH:27,
  aimAngle:0,fallHit:{frame:frameCount,angle:Math.PI,fatal:false}};
  window.mixedMark=stampKillVectorBlood(mixedVictim,{x:100,y:200},200,200);`);
 ok('a same-frame nonfatal bullet cannot steal another finishing attack vector',P('mixedMark.angle===0'));
 probe(`wipeAllBloodBanks();useBloodBank('pit');frameCount++;
  window.pitVictim={x:200,y:200,hp:0,eType:'NORMAL',bodyW:21,bodyH:27,aimAngle:0,
   shovelLevel:currentLevel,shovelDepth:18,shovelDepthTarget:240};
  window.pitVector=stampKillVectorBlood(pitVictim,{x:100,y:200},200,200);
  pitVictim.shovelDepth=140;updateBloodPools();`);
 ok('a falling pit kill binds its vector stain to depth without painting the ceiling',P('Object.keys(bloodChunks).length===0&&shovelBloodMarks.length===1&&pitVector.vectors.length===17&&shovelEffectDepth(pitVector)===140'));
 probe('pitVictim.shovelDepth=240;updateBloodPools();pitVictim.shovelDepth=0;pitVictim.shovelDepthTarget=0;pitVictim.x+=100;updateBloodPools();');
 ok('the settled pit stain detaches and stays fixed on its own floor',P('shovelEffectDepth(pitVector)===240&&pitVector.shovelOwner===null&&pitVector.x===200&&pitVector.y===200'));
 probe(`wipeAllBloodBanks();useBloodBank('budget');frameCount++;window.vectorAccepted=0;
  for(let i=0;i<50;i++){const v={x:200+i,y:200,hp:0,eType:'NORMAL',bodyW:21,bodyH:27,aimAngle:0};if(stampKillVectorBlood(v,player,v.x,v.y))vectorAccepted++;}`);
 ok('kill splatter work is capped at 24 accepted marks per frame',P('vectorAccepted===24'));
 probe('wipeAllBloodBanks();');
 ok('a genuine restart releases every floor and pit vector surface',P('bloodBytes===0&&bloodSurfaces===0&&Object.keys(bloodChunks).length===0&&shovelBloodMarks.length===0'));
}finally{ctx.random=nativeRandom;}
console.log(`${checks}/${checks} kill-vector blood, real mortal hits, seam, bank, depth and budget checks passed.`);

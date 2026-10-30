// Wall stains are anchored vectors: projected with their actual wall, clipped
// to its face, banked by sector, and bounded across a long campaign.
const assert=require('assert'),{ctx,probe}=require('./harness');
const P=s=>probe('('+s+')'),run=s=>probe(s);
run(`currentLevel=currentBiome=1;BIOME_ACTIVE=true;started=doTick=true;
  width=1200;height=800;zoom=2;camX=-300;camY=-200;
  viewLeft=viewTop=-10000;viewRight=viewBottom=10000;
  wipeAllBloodBanks();useBloodBank('wall-test');
  window.wall={x:0,y:200,w:300,h:28,isWall:true};
  activeBuildings=[wall];buildings=activeBuildings;invalidateColIndex();
  window.body={x:0,y:160,eT:'NORMAL',bW:21,bH:27,dT:0};`);
let randomCalls=0;ctx.random=()=>{randomCalls++;return .5;};
run('spawnCorpseWallBlood(body);');
assert.equal(P('wallBloodCount'),1);
assert.equal(P('wallBloodMarks.get(wallBloodKey(wall)).length'),1);
assert(P(`(()=>{const m=wallBloodMarks.get(wallBloodKey(wall))[0];
  return m.y===186&&m.nx===0&&m.ny===-1&&m.blobs.length===21&&m.col.join(',')==='90,0,0,220';})()`));
assert.equal(randomCalls,0,'wall blood advanced the combat random stream');

const painted=[],matrices=[],clips=[];
ctx.ellipse=(...v)=>{assert(v.every(Number.isFinite));painted.push(v);};
ctx.applyMatrix=(...v)=>{assert(v.every(Number.isFinite));matrices.push(v);};
ctx.drawingContext={save(){},restore(){},beginPath(){},rect(...v){clips.push(v);},clip(){}};
run('drawBuildingWallBlood(wall);');
assert.equal(painted.length,21,'visible wall face did not draw its stain');
assert.equal(matrices.length,1);
assert.equal(matrices[0][0],1);assert.equal(matrices[0][1],0);
assert(P('corpseWallProjection(wall).ly>0'));
assert(clips[0][0]<-100&&clips[0][2]===299,'stain is not clipped to its wall span');
const paints=painted.length;
run('camY=100;drawBuildingWallBlood(wall);');
assert.equal(painted.length,paints,'blood showed through the hidden face/roof');
run('camY=-200;wall.hp=0;drawBuildingWallBlood(wall);');
assert.equal(painted.length,paints,'destroyed wall left a floating decal');
run('delete wall.hp;useBloodBank("other-wall-test");drawBuildingWallBlood(wall);');
assert.equal(painted.length,paints,'another sector inherited the wall stain');
run('useBloodBank("wall-test");drawBuildingWallBlood({...wall});');
assert.equal(painted.length,paints+21,'regenerated wall lost the geometry-anchored stain');

// A new death near open ground, water, a tree, or a buried corpse cannot leave
// blood hovering over an unrelated surface. Machines do not spill red blood.
for(const target of ["{x:0,y:200,w:300,h:28,isPond:true}",
  "{x:0,y:200,w:300,h:28,isTreeTrunk:true}","{...wall,noClip:true}"]){
 run(`activeBuildings=[${target}];spawnCorpseWallBlood(body);`);
 assert.equal(P('wallBloodCount'),1);
}
run('activeBuildings=[wall];body.eT="ROBOT";spawnCorpseWallBlood(body);body.eT="NORMAL";body.shovelLevel=currentLevel;body.shovelDepth=40;spawnCorpseWallBlood(body);');
assert.equal(P('wallBloodCount'),1);
run('body.shovelDepth=0;body.shovelDepthTarget=40;spawnCorpseWallBlood(body);');
assert.equal(P('wallBloodCount'),1);
run('body.shovelDepthTarget=0;body.eT="BUG";spawnCorpseWallBlood(body);');
assert(P('wallBloodMarks.get(wallBloodKey(wall))[1].col.join(",")==="200,230,40,220"'));

// Smacks use the corrected piece centre but put paint on the wall plane.
run('body.eT="NORMAL";spawnCorpseWallImpactBlood(body,{b:wall,x:18,y:170,nx:0,ny:-1});');
assert(P('wallBloodMarks.get(wallBloodKey(wall))[2].y===186'));
run(`window.rotatedWall={x:200,y:200,w:180,h:20,isHouseWall:true,angle:PI/4};
 spawnCorpseWallImpactBlood(body,{b:rotatedWall,x:220,y:180,nx:Math.SQRT1_2,ny:-Math.SQRT1_2});`);
assert(P(`(()=>{const m=wallBloodMarks.get(wallBloodKey(rotatedWall))[0];
 const f=wallBloodFrame(rotatedWall),localY=-(m.x-200)*f.sa+(m.y-200)*f.ca;
 return Math.abs(localY+10)<1e-8&&m.faceY===-1&&m.faceX===0;})()`),'rotated wall rejected or misplaced its blood');
run('drawBuildingWallBlood(rotatedWall);');
assert(Math.abs(matrices.at(-1)[0]-Math.SQRT1_2)<1e-8,'rotated wall tangent was not projected');
run(`window.oldGateIsOpen=gateIsOpen;gateIsOpen=()=>true;
 window.openGate={x:0,y:200,w:1000,h:28,isGovFortress:true};
 spawnCorpseWallImpactBlood(body,{b:openGate,x:-315,y:170,nx:0,ny:-1});
 drawBuildingWallBlood(openGate);gateIsOpen=oldGateIsOpen;`);
assert(clips.at(-1)[2]<400,'splatter crossed the open gateway');
// New blast and ballistic gun-overkill controllers still go through the same
// constructor-end wall deposition. Their faster floor-pool timing stays native.
run(`useBloodBank('latest-blasts');activeBuildings=buildings=[wall];invalidateColIndex();
 for(const dT of [18,19,20]){
   const src={aimAngle:HALF_PI,bodyW:21,bodyH:27,eType:'NORMAL'};
   const c=new Corpse(0,160,HALF_PI,HALF_PI,color(55,125,165),color(48,58,72),dT,0,[],WEAPONS.PISTOL,
     HALF_PI,'NORMAL',21,27,src);
   if(!c.blast||!c.blastBlood)throw Error('Native blast controller missing');
 }
 for(const dT of [2,10]){
   const src={aimAngle:HALF_PI,bodyW:21,bodyH:27,eType:'NORMAL',
     fallHit:{frame:frameCount,kind:'BODY',weapon:WEAPONS.DUAL_SMG,angle:HALF_PI,force:5,mx:0,my:0}};
   const c=new Corpse(0,160,HALF_PI,HALF_PI,color(55,125,165),color(48,58,72),dT,0,[],WEAPONS.DUAL_SMG,
     HALF_PI,'NORMAL',21,27,src);
   if(!c.blast||!c.blast.mode)throw Error('Native gun overkill controller missing');
 }`);
assert.equal(P('wallBloodMarks.get(wallBloodKey(wall)).length'),5,'new blast/overkill deaths missed wall deposition');
assert.equal(P('BLOOD_POOL_FRAMES'),360,'normal floor-pool timing changed');
assert.equal(P('BLAST_BLOOD_POOL_FRAMES'),54,'blast floor-pool timing changed');
run(`wipeAllBloodBanks();useBloodBank('budget');
 for(let sector=0;sector<6;sector++){
   useBloodBank('budget-'+sector);
   for(let n=0;n<240;n++){
     const b={x:n*300,y:200,w:100,h:28,isWall:true};
     spawnCorpseWallImpactBlood(body,{b,x:b.x,y:170,nx:0,ny:-1});
   }
 }`);
assert.equal(P('wallBloodCount'),P('WALL_BLOOD_TOTAL_MAX'));
assert(P('Array.from(wallBloodMarks.values()).reduce((n,a)=>n+a.length,0)<=WALL_BLOOD_BANK_MAX'));
run('wipeAllBloodBanks();');assert.equal(P('wallBloodCount'),0);assert.equal(P('wallBloodMarks.size'),0);
console.log('Wall blood passed: nearby-wall placement, surface projection/clipping, hidden faces, destroyed walls, sector banking/regeneration, colors, buried/machine exclusions, impact placement, unchanged combat RNG and global/per-sector budgets.');

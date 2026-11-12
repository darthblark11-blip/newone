// The mesh adapter must keep native death physics and painter targets intact.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {ctx,probe,mkG,calls}=require('./harness');
for(const [file,guard] of [['pose.js','player3DPose'],['corpse.js','drawPlayer3DCorpse']]){
  if(probe('typeof '+guard)==='undefined')vm.runInContext(fs.readFileSync(__dirname+'/player3d/'+file,'utf8'),ctx,{filename:file});
}
const captured=[];
ctx.__drawMesh=(snapshot,target)=>{
  assert.ok(snapshot&&snapshot.parts,'snapshot');
  assert.ok(snapshot.bounds.every(Number.isFinite),'finite mesh bounds');
  for(const part of snapshot.parts){
    assert.equal(part.matrix.length,16,'matrix size');
    assert.ok(Array.from(part.matrix).every(Number.isFinite),'finite transform '+part.part);
    assert.ok(part.color.every(Number.isFinite),'finite material '+part.part);
  }
  captured.push({snapshot,target});return true;
};
probe(`if(typeof Player3D==='undefined')globalThis.Player3D={};
  Player3D.enabled=true;Player3D.ensure=()=>true;Player3D.draw=__drawMesh;
  isStoryMode=false;townsData={};startAtLevel(1);started=true;doTick=false;
  explosiveArmorUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
  leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
  buildings=[];activeBuildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();
  player=new Character(160,190,true);player.isArmed=true;player.currentWeapon=WEAPONS.PISTOL;`);
ctx.__target=mkG();
let checks=0;
assert.ok(probe("player3DCorpsePartIs({part:'helmet'},'head')"),'armored helmet belongs to severed head');checks++;
for(let type=0;type<=20;type++){
  for(const progress of [0,.45,1]){
    captured.length=0;
    probe(`frameCount++;globalThis.c=new Corpse(player.x,player.y,player.moveAngle||0,player.aimAngle||0,
      player.shirtCol,player.pantsCol,${type},0,[],player.currentWeapon,0,'NORMAL',21,27,player);
      c.fP=${progress};`);
    const before=probe('JSON.stringify([c.x,c.y,c.bT,c.bloodTimer,c.smokeTimer,c.poolAge,c.fP,c.rag,c.blast&&c.blast.age])');
    probe('c.paint(__target)');
    const after=probe('JSON.stringify([c.x,c.y,c.bT,c.bloodTimer,c.smokeTimer,c.poolAge,c.fP,c.rag,c.blast&&c.blast.age])');
    assert.equal(after,before,'painting changed death simulation '+type);
    assert.ok(captured.length>0,'death subtype has no mesh '+type);
    assert.ok(captured.every(draw=>draw.target===ctx.__target.drawingContext),'corpse target context '+type);
    checks++;
  }
}
// The fragment compositor must not restore missing legs onto a pinned torso.
captured.length=0;probe('drawPlayer3DCorpseFragment(__target,c,"torso")');
assert.ok(captured.length>0);assert.ok(captured.every(d=>d.snapshot.parts.every(p=>!/^(thigh|shin|foot)_/.test(p.part))));checks++;
// Beam central deaths keep their native hole/hinge clips around mesh surfaces.
for(const variant of [0,1,2]){
  captured.length=0;
  probe(`frameCount++;player.x=160;player.y=190;
    player.particleBeamHit={frame:frameCount,zone:'BODY',side:1,center:true,variant:${variant},wound:{x:0,y:0,sz:6,particleBeam:true}};
    c=new Corpse(160,190,0,0,player.shirtCol,player.pantsCol,0,0,[],WEAPONS.PARTICLE_BEAM,0,'NORMAL',21,27,player);
    c.paint(__target);`);
  assert.ok(captured.length>0,'central beam mesh '+variant);checks++;
}
probe('delete player.particleBeamHit;');
// The facade adapter follows the existing real XYZ seated/hip controller.
for(const outcome of ['SEATED','SIDE'])for(const age of [0,35,100,156]){
  captured.length=0;
  probe(`frameCount++;globalThis.wall={x:0,y:0,w:280,h:70,isWall:true,hqWall:'PANEL'};
    activeBuildings=buildings=[wall];invalidateColIndex();player.x=0;player.y=-55;player.aimAngle=-Math.PI/2;
    rememberFigureMotion(player,0,0);player.fallHit={frame:frameCount,kind:'BODY',angle:Math.PI/2,force:3,mx:0,my:0};
    c=new Corpse(0,-55,-Math.PI/2,-Math.PI/2,player.shirtCol,player.pantsCol,0,0,[],player.currentWeapon,Math.PI/2,'NORMAL',21,27,player);
    if(!c.wallSit)throw Error('missing seated fixture');c.wallSit.outcome='${outcome}';c.wallSit.age=${age};
    c.paint(__target);`);
  assert.ok(captured.length>0,'wall body mesh '+outcome+'/'+age);checks++;
}
// GPU absence routes every subtype back through the existing native painter.
probe('Player3D.enabled=false;');captured.length=0;const count=calls.shape;
probe('c.paint(__target)');assert.equal(captured.length,0);assert.ok(calls.shape>count);checks++;
console.log('Player 3D corpse adapter: '+checks+' cases passed');

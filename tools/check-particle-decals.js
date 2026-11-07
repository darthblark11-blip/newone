// The Particle Beam's heat is attached to its resolved wound, and only the
// simulation advances it. Settled/offscreen corpses must never bake hot orange.
const assert = require('node:assert/strict');
const {ctx, probe} = require('./harness');
const {figureCanvas} = require('./figure-canvas');
const P = source => probe('(' + source + ')');
let checks = 0;
const ok = (name, condition) => { assert(condition, name); checks++; };
probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;BIOME_ACTIVE=false;
  currentLevel=currentBiome=2;isStoryMode=false;inStoryIntro=inStoryRoom=false;
  inTownCutscene=inFortCutscene=inPostAmbushCutscene=inFarmCutscene=inFarmPostCutscene=inDarchonCall=false;
  inTravelMenu=inWorldBuildingMenu=inUpgradeMenu=false;buildGhost=null;
  buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];corpses=[];
  bullets=[];particles=[];invalidateColIndex();resetShovelState();resetForestWildlife();
  player=new Character(0,0,true);player.shield=0;leftStick={active:false,dx:0,dy:0};
  rightStick={active:false,dx:0,dy:0,dist:0};viewLeft=viewTop=-1000;viewRight=viewBottom=1000;`);

probe(`window.w={x:2.25,y:-3,sz:5,col:[90,0,0,220],isBulletHole:true};
  player.decals=[w];markParticleBeamWound(w,player,{shotId:71});`);
ok('impact enlarges the mark without moving its resolved contact',
  P('Math.abs(w.sz-6.6)<1e-8&&w.x===2.25&&w.y===-3&&w.particleBeam&&w.particleBeamState.age===0'));
probe('markParticleBeamWound(w,player,{shotId:71});');
ok('marking the same impact is idempotent',P('Math.abs(w.sz-6.6)<1e-8'));
probe('window.snapshot={...w,col:w.col.slice()};for(let i=0;i<60;i++)ageParticleBeamWounds(player.decals);');
ok('the wound remains orange for one full simulation second',
  P('particleBeamWoundHeat(w)===1&&w.particleBeamState.age===60&&w.col[0]===255&&w.col[1]===135'));
probe('isPaused=true;for(let i=0;i<100;i++)ageParticleBeamWounds(player.decals);');
ok('pause freezes the thermal clock',P('w.particleBeamState.age===60'));
probe('isPaused=false;for(let i=0;i<9;i++)ageParticleBeamWounds(player.decals);');
ok('the short cooling transition remains shared by fatal wound snapshots',
  P('particleBeamWoundHeat(w)===.5&&particleBeamWoundHeat(snapshot)===.5&&w.particleBeamState===snapshot.particleBeamState'));
probe('for(let i=0;i<9;i++)ageParticleBeamWounds(player.decals);');
ok('cooled stains become dark blood red and stop doing thermal work',
  P('particleBeamWoundHeat(w)===0&&w.col[0]===85&&w.col[1]===8&&w.col[2]===20&&player.decals._particleBeamHot===false'));
probe('for(let i=0;i<500;i++)ageParticleBeamWounds(player.decals);');
ok('cold age is bounded',P('w.particleBeamState.age===78'));

probe(`window.headMark={x:0,y:0,sz:7,isHead:true};markParticleBeamWound(headMark,player,{shotId:72});`);
ok('the head scorch stays bounded by the head surface',P('headMark.sz===7.5'));
probe(`window.legMark={x:2,y:-1,sz:5,isLeg:true,legIndex:1,legSegment:0,legU:.4,legV:.12};
  markParticleBeamWound(legMark,player,{shotId:73});`);
ok('marking never changes the anatomical leg attachment',
  P('legMark.legIndex===1&&legMark.legSegment===0&&legMark.legU===.4&&legMark.legV===.12'));

// Use the real corpse update, then the normal offscreen retirement branch.
probe(`window.e=new Character(3000,3000,false,'NORMAL');e.aimAngle=e.moveAngle=0;
  e.decals=[{x:0,y:0,sz:5,isBulletHole:true}];markParticleBeamWound(e.decals[0],e,{shotId:74});
  window.c=new Corpse(e.x,e.y,0,0,e.shirtCol,e.pantsCol,0,0,e.decals,e.currentWeapon,0,e.eType,e.bodyW,e.bodyH,e);
  c.update();`);
ok('native corpse updates advance the wound before motion early returns',P('c.dec[0].particleBeamState.age===1'));
ok('hot bodies cannot be stamped permanently into the blood texture',!P('corpseSettled(c)'));
probe('corpses=[c];frameCount++;updateCorpses();');
ok('offscreen bodies also advance heat instead of remaining orange forever',P('c.dec[0].particleBeamState.age===2'));
probe('finishParticleBeamWounds(c.dec);');
ok('forced travel retirement finishes shared thermal marks before stamping',
  P('c.dec[0].particleBeamState.age===78&&c.dec._particleBeamHot===false&&particleBeamWoundHeat(c.dec[0])===0'));

function scorch(age) {
  const {canvas,c,g}=figureCanvas(128,128);
  c.fillStyle='#2c3746';c.fillRect(0,0,128,128);
  ctx.__scorchG=g;
  probe(`window.renderW={x:0,y:0,sz:6,isBulletHole:true};markParticleBeamWound(renderW,null,{shotId:9});
    renderW.particleBeamState.age=${age};particleBeamWoundColour(renderW);`);
  const before=P('JSON.stringify(renderW)');
  g.push();g.translate(64,64);g.scale(10,10);probe('drawParticleBeamWound(__scorchG,renderW);');g.pop();
  ok('thermal paint preserves metadata and Canvas stack at age '+age,
    before===P('JSON.stringify(renderW)')&&g.balanced());
  return {canvas,pixels:c.getImageData(0,0,128,128).data};
}
const hot=scorch(0),cold=scorch(78);
let orangeHot=0,orangeCold=0,darkRed=0;
for(let i=0;i<hot.pixels.length;i+=4) {
  const orange=p=>p[i]>180&&p[i+1]>70&&p[i+1]<225&&p[i+2]<130;
  orangeHot+=orange(hot.pixels);orangeCold+=orange(cold.pixels);
  if(cold.pixels[i]>=60&&cold.pixels[i]<130&&cold.pixels[i+1]<22&&cold.pixels[i+2]<45)darkRed++;
}
ok('actual Canvas pixels contain a hot orange rim then a cooled blood-red stain',orangeHot>1200&&orangeCold===0&&darkRed>1200);
const normal={x:0,y:0,sz:5,col:[90,0,0,220]};ctx.__normal=normal;
ok('ordinary bullet decals retain their existing renderer',!P('drawParticleBeamWound(__scorchG,__normal)'));

// The painter cannot draw beyond a collision-clipped terminal segment, even
// when the round has already become inactive on its final impact frame.
const originalLine=ctx.line,lines=[];ctx.line=(...a)=>lines.push(a);
try { probe('paintParticleBeamSegment({prevX:11,prevY:23,x:41,y:23,active:false});'); }
finally {ctx.line=originalLine;}
ok('beam ink, blue plane and cyan core share exactly the clipped segment',
  lines.length===3&&lines.every(a=>a[0]===11&&a[1]===23&&a[2]===41&&a[3]===23));
console.log(`Particle Beam decals: ${checks} thermal lifetime, pause, corpse retirement, anatomical attachment and Canvas paint checks passed.`);

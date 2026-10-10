// Render actual corpse controllers, decals, legacy jets and fatal spray.
const fs=require('fs'),path=require('path'),{figureCanvas}=require('./figure-canvas');
const {ctx,probe}=require('./harness');
const {canvas,c,g}=figureCanvas(1080,750),out=path.join(__dirname,'out');
fs.mkdirSync(out,{recursive:true});ctx.__paint=g;
for(const n of ['push','pop','translate','rotate','scale','fill','stroke','noFill','noStroke','strokeWeight','ellipse','rect','arc','line','quad','triangle','beginShape','vertex','curveVertex','endShape','image'])ctx[n]=g[n];
ctx.createGraphics=(w,h)=>figureCanvas(w,h).g;
let seed=4487;ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
 return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
probe('doTick=true;currentLevel=1;BIOME_ACTIVE=false;activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();window.__cases=[];wipeAllBloodBanks();viewLeft=viewTop=-1000;viewRight=viewBottom=1000;');
const cases=[
 ['Pistol / head','Restored collar/chest stain; jet stays at head',1,'PISTOL','HEAD',1,Math.PI],
 ['Assault rifle / head','Chest stain + 3 random wound-jet directions',6,'ASSAULT_RIFLE','HEAD',3,.2],
 ['Shotgun / head','Chest stain + ground blood building up',4,'SHOTGUN','HEAD',3,.2],
 ['SMG / body','3 wound jets fan out in separate directions',0,'SMG','BODY',3,Math.PI],
 ['Dual machine guns / body','Random jets remain on the moving torso',10,'DUAL_SMG','BODY',3,-Math.PI/2],
 ['Shotgun / face-down body','Pool grows gradually beneath the body',7,'SHOTGUN','BODY',3,.2]
];
for(const [i,row] of cases.entries()){
 const [,,type,weapon,kind,count,facing]=row;
 probe(`particles=[];window.e=new Character(0,0,false,'CITY_CITIZEN_F');
  e.hairStyle=3;e.hairCol=color(54,33,22);e.skinCol=color(235,180,140);e.shirtCol=color(63,128,153);e.pantsCol=color(56,62,78);
  e.aimAngle=${facing};e.moveAngle=.2;e.isMoving=true;rememberFigureMotion(e,Math.cos(.2)*4,Math.sin(.2)*4);
  e.decals=[0,1,2].slice(-${count}).map(n=>{const isHead='${kind}'==='HEAD'||${i}===5&&n===0;
    const d=(isHead?[{x:-3,y:-2},{x:2.5,y:-1},{x:1,y:3.5}]:[{x:-5,y:-6},{x:4,y:0},{x:2,y:7}])[n];
    return {...d,sz:3.2,col:[90,0,0,220],isHead,isBulletHole:true,shotA:${-facing}};});
  window.w=e.decals[e.decals.length-1];
  e.fallHit={frame:frameCount,kind:'${kind}',weapon:WEAPONS.${weapon},angle:0,force:3,mx:e.motionX,my:e.motionY,x:0,y:0,fatal:true,wound:w};
  useBloodBank('preview-${i}');
  __cases.push({body:new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,${type},.5,e.decals,e.currentWeapon,0,e.eType,e.bodyW,e.bodyH,e),bank:'preview-${i}',particles});
  window.__previewWound=fatalWoundPoint(__cases[${i}].body);spawnSplatter(__previewWound.x,__previewWound.y,'BLOOD',color(90,0,0,220));`);
}
function draw(frame){
 c.resetTransform();c.fillStyle='#1c2831';c.fillRect(0,0,1080,750);
 c.font='25px sans-serif';c.fillStyle='#eee8ce';c.fillText('CLOTHING STAINS + RANDOM JETS + GROWING PUDDLES',20,33);
 c.font='15px sans-serif';c.fillStyle='#adc8cc';c.fillText(`Actual game drawing / ${(frame/60).toFixed(2)} s / puddle buildup 1.50 s / fatal spray 3.50 s`,20,58);
 for(let i=0;i<cases.length;i++){
  const x=14+(i%3)*357,y=78+Math.floor(i/3)*328;
  c.fillStyle='#a0a6a3';c.beginPath();c.roundRect(x,y,344,310,8);c.fill();
  c.fillStyle='#f8f6e9';c.font='18px sans-serif';c.fillText(cases[i][0],x+12,y+27);
  c.font='12px sans-serif';c.fillText(cases[i][1],x+12,y+46);
  c.fillStyle='#8f9a98';c.fillRect(x,y+247,344,8);
  c.save();c.beginPath();c.rect(x,y+54,344,218);c.clip();
  g.push();g.translate(x+(i===4?120:i===2?126:172),y+156);g.scale(i===4?1.45:2.5);
  probe(`window.v=__cases[${i}];useBloodBank(v.bank);__paint.translate(-v.body.x,-v.body.y);drawBloodChunks();v.body.show(__paint);for(const p of v.particles)p.show();`);
  g.pop();c.restore();
  const left=probe(`__cases[${i}].body.fatalSpray.left`);
  c.font='13px sans-serif';c.fillStyle=left>0?'#75291f':'#205348';
  c.fillText(left>0?`${cases[i][5]} hole${cases[i][5]>1?'s':''} spraying / ${(left/60).toFixed(2)} s left`:'Fatal wound spray finished',x+12,y+295);
 }
 if(!g.balanced())throw Error('Unbalanced game drawing');
}
const animated=process.argv.includes('animate'),frames=path.join(out,'spray-source-motion');
if(animated)fs.mkdirSync(frames,{recursive:true});
for(let i=0;i<(animated?91:21);i++){
 if(i)probe(`for(let n=0;n<3;n++){frameCount++;for(const v of __cases){useBloodBank(v.bank);particles=v.particles;
   updateBloodPools();for(const p of particles)p.update();particles=particles.filter(p=>p.a>0);v.body.update();v.particles=particles;}}`);
 draw(i*3);
 if(animated)fs.writeFileSync(path.join(frames,String(i).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
 if(i===20)fs.writeFileSync(path.join(out,'spray-sources.png'),canvas.toBuffer('image/png'));
}
console.log('Rendered spray-sources.png'+(animated?' and 91 simulation-driven frames':''));

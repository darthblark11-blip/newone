// Paint the real game heads, fall controllers, wound decals and particles.
// This Canvas target supplies p5 drawing calls; it contains no game geometry.
const fs=require('fs'),path=require('path'),{figureCanvas}=require('./figure-canvas');
const {ctx,probe}=require('./harness');
const {canvas,c,g}=figureCanvas(1080,1000),out=path.join(__dirname,'out');
fs.mkdirSync(out,{recursive:true});ctx.__paint=g;
for(const n of ['push','pop','translate','rotate','scale','fill','stroke','noFill','noStroke','strokeWeight','ellipse','rect','arc','line','quad','triangle','beginShape','vertex','curveVertex','endShape'])ctx[n]=g[n];
let seed=4487;ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
 return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
probe('currentLevel=1;BIOME_ACTIVE=false;activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();window.__cases=[];');
const cases=[
 ['Death / falling forward','Face down: back of head and hair',0,'PISTOL',0,0,false,'BODY'],
 ['Death / falling backward','Face up: skin, closed eyes and nose',0,'PISTOL',0,Math.PI,false,'BODY'],
 ['Death / forward toward south','Same face-down head in another direction',0,'PISTOL',Math.PI/2,Math.PI/2,false,'BODY'],
 ['Stun / falling forward','Slow punch fall; face down',0,'PISTOL',0,0,true,'BODY'],
 ['Stun / falling backward','Slow punch fall; face up',0,'PISTOL',0,Math.PI,true,'BODY'],
 ['Stun / backward toward south','Face up depends on facing versus fall',0,'PISTOL',Math.PI/2,-Math.PI/2,true,'BODY'],
 ['Fatal head hit','Spray follows the fatal head decal',1,'PISTOL',.4,Math.PI+.4,false,'HEAD'],
 ['Shotgun / body overkill','Existing face-down animation and wound spray',7,'SHOTGUN',.2,.2,false,'BODY'],
 ['Dual-SMG / body overkill','Spray stays on the moving torso',10,'DUAL_SMG',.4,-Math.PI/2,false,'BODY']
];
for(let i=0;i<cases.length;i++){
 const [,,type,weapon,a,facing,stun,kind]=cases[i];
 probe(`particles=[];window.e=new Character(0,0,false,'${stun?'FEMALE_PISTOL':'CITY_CITIZEN_F'}');
  e.hairStyle=3;e.hairCol=color(54,33,22);e.skinCol=color(235,180,140);e.shirtCol=color(63,128,153);e.pantsCol=color(56,62,78);
  e.aimAngle=${facing};e.moveAngle=${a};e.isMoving=true;rememberFigureMotion(e,Math.cos(${a})*4,Math.sin(${a})*4);
  if(${stun}){startPunchStun(e,${a});__cases.push({body:e,stun:true,particles});}
  else{window.w={x:${kind==='HEAD'?3:2},y:${kind==='HEAD'?1:-6},sz:5,col:[90,0,0,220],isHead:${kind==='HEAD'}};e.decals=[w];
    e.fallHit={frame:frameCount,kind:'${kind}',weapon:WEAPONS.${weapon},angle:0,force:3,mx:e.motionX,my:e.motionY,x:0,y:0,fatal:true,wound:w};
    __cases.push({body:new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,${type},.5,e.decals,e.currentWeapon,0,e.eType,e.bodyW,e.bodyH,e),stun:false,particles});}`);
}
function draw(frame){
 c.resetTransform();c.fillStyle='#1c2831';c.fillRect(0,0,1080,1000);
 c.font='25px sans-serif';c.fillStyle='#eee8ce';c.fillText('FORWARD / BACKWARD HEADS + FATAL-WOUND SPRAY',20,33);
 c.font='15px sans-serif';c.fillStyle='#adc8cc';c.fillText(`Actual game painters and simulation / ${(frame/60).toFixed(2)} s / spray stops at 3.50 s`,20,58);
 for(let i=0;i<cases.length;i++){
  const x=14+(i%3)*357,y=77+Math.floor(i/3)*301;
  c.fillStyle='#98a1a1';c.beginPath();c.roundRect(x,y,344,287,8);c.fill();
  c.fillStyle='#e9eee0';c.font='18px sans-serif';c.fillText(cases[i][0],x+12,y+27);
  c.font='12px sans-serif';c.fillText(cases[i][1],x+12,y+46);
  c.fillStyle='#879696';c.fillRect(x,y+220,344,8);
  c.save();c.beginPath();c.rect(x,y+53,344,209);c.clip();
  g.push();g.translate(x+(i===8?115:172),y+(i===2||i===5?172:147));g.scale(i===8?1.45:2.3);
  probe(`window.v=__cases[${i}];__paint.translate(-v.body.x,-v.body.y);
    if(v.stun){__paint.translate(v.body.x,v.body.y);drawStunnedFigure(v.body);}else v.body.show(__paint);
    for(const p of v.particles)p.show();`);
  g.pop();c.restore();
  if(!cases[i][6]){
   const left=probe(`__cases[${i}].body.fatalSpray.left`);
   c.font='13px sans-serif';c.fillStyle=left>0?'#75291f':'#205348';c.fillText(left>0?`Fatal wound spraying: ${(left/60).toFixed(2)} s left`:'Fatal wound spray finished',x+12,y+275);
  }
 }
 if(!g.balanced())throw Error('Unbalanced game drawing');
}
const animated=process.argv.includes('animate'),frames=path.join(out,'fatal-wound-motion');
if(animated)fs.mkdirSync(frames,{recursive:true});
for(let i=0;i<(animated?91:21);i++){
 if(i)probe(`for(let n=0;n<3;n++){frameCount++;for(const v of __cases){particles=v.particles;
   for(const p of particles)p.update();particles=particles.filter(p=>p.a>0);
   if(v.stun)advanceStun(v.body);else v.body.update();v.particles=particles;}}`);
 draw(i*3);
 if(animated)fs.writeFileSync(path.join(frames,String(i).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
 if(i===20)fs.writeFileSync(path.join(out,'fatal-wounds.png'),canvas.toBuffer('image/png'));
}
console.log('Rendered fatal-wounds.png'+(animated?' and 91 simulation-driven frames':''));

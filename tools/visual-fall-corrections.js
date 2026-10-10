// Render the actual Corpse.show() on a Canvas vector target. Advance real
// controllers; keep each body centered so head and limb orientation are clear.
const fs=require('fs'),path=require('path'),{figureCanvas}=require('./figure-canvas');
const {ctx,probe}=require('./harness');
const {canvas,c,g}=figureCanvas(1080,1030),out=path.join(__dirname,'out');
fs.mkdirSync(out,{recursive:true});ctx.__paint=g;
let seed=914;ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
probe('currentLevel=1;activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();window.__bodies=[];');
const cases=[
 ['North / ordinary death','Forward-facing head retained',0,'PISTOL',-Math.PI/2],
 ['South / ordinary death','Face-up head; body keeps its direction',0,'PISTOL',Math.PI/2],
 ['Stationary / ordinary death','Original speed; incoming force directs the fall',0,'PISTOL',0],
 ['Shotgun / body separation','Previous overkill animation',2,'SHOTGUN',.7],
 ['Shotgun / face-down death','Previous overkill animation',7,'SHOTGUN',-.7],
 ['Dual-SMG / dismemberment','Previous overkill animation',10,'DUAL_SMG',.7],
 ['Shotgun / headshot','Previous overkill animation',4,'SHOTGUN',-.7],
 ['Shotgun / partial headshot','Previous overkill animation',8,'SHOTGUN',.7],
 ['Shotgun / skull fragments','Previous overkill animation',9,'SHOTGUN',-.7]
];
for(let i=0;i<cases.length;i++){
 const [,,type,w,a]=cases[i];
 probe(`window.e=new Character(0,0,false,'CITY_CITIZEN_F');cityAppearance(e,${31+i*97});e.hairStyle=3;e.hairCol=color(59,38,27);e.shirtCol=color(60,133,168);e.pantsCol=color(49,58,74);e.aimAngle=${a};e.moveAngle=${a};e.isMoving=${i!==2};
 rememberFigureMotion(e,${i===2?0:Math.cos(a)*4},${i===2?0:Math.sin(a)*4});
 e.fallHit={frame:frameCount,kind:${JSON.stringify(i>5?'HEAD':'BODY')},weapon:WEAPONS.${w},angle:${a},force:3,mx:e.motionX,my:e.motionY,wound:null};
 __bodies.push(new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,${type},.4,[],WEAPONS.PISTOL,${a},e.eType,e.bodyW,e.bodyH,e));`);
}
function draw(frame){
 c.resetTransform();c.fillStyle='#1c2831';c.fillRect(0,0,1080,1030);c.font='25px sans-serif';c.fillStyle='#eee8ce';c.fillText('RESTORED CORPSE SPEED / LEGACY OVERKILL / HEAD ORIENTATION',20,34);
 c.font='15px sans-serif';c.fillStyle='#adc8cc';c.fillText(`Actual game vector painters and update controllers / ${(frame/60).toFixed(2)} seconds`,20,59);
 for(let i=0;i<cases.length;i++){
  const x=14+(i%3)*357,y=78+Math.floor(i/3)*313;
  c.fillStyle='#849698';c.beginPath();c.roundRect(x,y,344,298,8);c.fill();c.fillStyle='#eff0dc';c.font='18px sans-serif';c.fillText(cases[i][0],x+12,y+27);c.font='12px sans-serif';c.fillText(cases[i][1],x+12,y+47);
  c.save();c.beginPath();c.rect(x,y+55,344,243);c.clip();
  g.push();g.translate(x+172,y+(i<3?178:i===5?145:165));g.scale(i<3?2.2:i===5?.9:1.9);
  probe(`__paint.translate(-__bodies[${i}].x,-__bodies[${i}].y);__bodies[${i}].show(__paint);`);g.pop();c.restore();
 }
 if(!g.balanced())throw Error('Unbalanced game drawing');
}
const animated=process.argv.includes('animate'),frames=path.join(out,'fall-correction-motion');
if(animated)fs.mkdirSync(frames,{recursive:true});
for(let i=0;i<(animated?41:15);i++){
 if(i)probe('for(let n=0;n<3;n++){frameCount++;for(const b of __bodies)b.update();}');
 draw(i*3);
 if(animated)fs.writeFileSync(path.join(frames,String(i).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));
 if(i===14)fs.writeFileSync(path.join(out,'fall-corrections.png'),canvas.toBuffer('image/png'));
}
console.log('Rendered fall-corrections.png'+(animated?' and 41 controller-driven frames':''));

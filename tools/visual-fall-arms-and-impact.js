// Render the game's own corpse/stun painters to inspect arm proportions and
// front/rear stationary impacts. No duplicate limb or corpse geometry.
const fs=require('fs'),path=require('path'),{figureCanvas}=require('./figure-canvas'),{ctx,probe}=require('./harness');
const out=process.env.FALL_ARM_OUT||path.join(__dirname,'out');fs.mkdirSync(out,{recursive:true});
const {canvas,c,g}=figureCanvas(1080,748);ctx.__armPaint=g;
for(const n of ['push','pop','translate','rotate','scale','fill','stroke','noFill','noStroke','strokeWeight','ellipse','rect','arc','line','quad','triangle','beginShape','vertex','curveVertex','endShape','image'])ctx[n]=g[n];
let seed=8192;ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
 return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
probe('frameCount=1000;doTick=true;BIOME_ACTIVE=false;currentLevel=1;activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();window.__armCases=[];');
const cases=[
 ['Forward / left wound hold','Upper arm → forearm and hand → torso','FEMALE_PISTOL',-6,false,false],
 ['Forward / right wound hold','Slim sleeves; the held hand stays underneath','FEMALE_PISTOL',6,false,false],
 ['Loose arms / regular','Tapered upper arm, forearm and palm','NORMAL',null,false,false],
 ['Stationary / hit from front','Falls backward, away from shooter; face up','NORMAL',-6,true,false],
 ['Stationary / hit from behind','Falls forward, away from shooter; back visible','NORMAL',6,false,false],
 ['Punched / slow stun','Same narrower arm proportions; slow fall retained','FEMALE_PISTOL',null,false,true]
];
for(const [i,[,,type,side,front,stun]] of cases.entries()){
 const a=front?Math.PI/2:-Math.PI/2,moving=i<3;
 probe(`window.e=new Character(0,0,false,'${type}');e.aimAngle=-HALF_PI;e.moveAngle=-HALF_PI;e.isMoving=${moving};rememberFigureMotion(e,0,${moving?-4:0});
  window.w=${side===null?'null':`{x:-2,y:${side},sz:3.3,col:[90,0,0,220],isHead:false,isBulletHole:true}`};e.decals=w?[w]:[];
  e.fallHit={frame:frameCount,kind:'BODY',weapon:WEAPONS.PISTOL,angle:${a},force:3,mx:0,my:${moving?-4:0},wound:w};
  if(${stun}){startPunchStun(e,-HALF_PI);__armCases.push({actor:e,stun:true});}
  else{window.body=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,0,0,e.decals,e.currentWeapon,${a},e.eType,e.bodyW,e.bodyH,e);
   if(w)body.fall.hold=woundHold(body.rag,projectFallRig(e.bodyW,e.bodyH,1),w);__armCases.push({actor:body,stun:false});}`);
}
function advance(){probe('frameCount++;for(const v of __armCases){if(v.stun)advanceStun(v.actor);else v.actor.update();}');}
function draw(frame){
 c.resetTransform();c.fillStyle='#1c2831';c.fillRect(0,0,1080,748);
 c.font='24px sans-serif';c.fillStyle='#eee8ce';c.fillText('ARM LAYERS + PROPORTIONS + STATIONARY IMPACTS',20,32);
 c.font='14px sans-serif';c.fillStyle='#adc8cc';c.fillText(`Actual game painters / ${(frame/60).toFixed(2)} s / corpse fall 7 ticks / punch stun 40 ticks`,20,57);
 for(let i=0;i<cases.length;i++){
  const x=14+i%3*357,y=78+Math.floor(i/3)*329;
  c.fillStyle='#a0aaa5';c.beginPath();c.roundRect(x,y,344,312,8);c.fill();
  c.fillStyle='#172f36';c.font='18px sans-serif';c.fillText(cases[i][0],x+12,y+27);c.font='12px sans-serif';c.fillText(cases[i][1],x+12,y+47);
  if(i===3||i===4){const upward=i===4;
   c.strokeStyle='#415960';c.lineWidth=2;c.beginPath();c.moveTo(x+38,y+102);c.lineTo(x+38,y+148);c.moveTo(x+38,y+(upward?102:148));c.lineTo(x+33,y+(upward?109:141));c.moveTo(x+38,y+(upward?102:148));c.lineTo(x+43,y+(upward?109:141));c.stroke();
   c.font='12px sans-serif';c.fillText('fall',x+25,y+170);
  }
  c.save();c.beginPath();c.rect(x,y+53,344,247);c.clip();g.push();g.translate(x+177,y+(i===3?213:159));g.scale(2.7);
  probe(`window.v=__armCases[${i}];__armPaint.translate(-v.actor.x,-v.actor.y);if(v.stun){push();translate(v.actor.x,v.actor.y);drawStunnedFigure(v.actor);pop();}else v.actor.show(__armPaint);`);
  g.pop();c.restore();if(!g.balanced())throw Error('Unbalanced arm preview');
 }
}
const animate=process.argv.includes('animate'),frames=path.join(out,'arm-impact-motion');if(animate)fs.mkdirSync(frames,{recursive:true});
for(let f=0;f<=90;f++){if(f)advance();if(animate)draw(f);if(animate)fs.writeFileSync(path.join(frames,String(f).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));}
draw(90);fs.writeFileSync(path.join(out,'fall-arms-and-impact.png'),canvas.toBuffer('image/png'));
console.log('Rendered fall-arms-and-impact.png'+(animate?' and 91 motion frames':''));

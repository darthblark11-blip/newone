// Inspect the real shared corpse painter, clipped pieces and cut emitters.
const fs=require('fs'),path=require('path'),{figureCanvas}=require('./figure-canvas'),{ctx,probe}=require('./harness');
const out=process.env.SWORD_DEATH_OUT||path.join(__dirname,'out');fs.mkdirSync(out,{recursive:true});
const {canvas,c,g}=figureCanvas(1080,748);ctx.__swordPaint=g;
for(const n of ['push','pop','translate','rotate','scale','fill','stroke','noFill','noStroke','strokeWeight','ellipse','rect','arc','line','quad','triangle','beginShape','vertex','curveVertex','endShape','image'])ctx[n]=g[n];
let seed=911;ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const u=seed/4294967296;
 return a===undefined?u:Array.isArray(a)?a[Math.floor(u*a.length)]:b===undefined?u*a:a+(b-a)*u;};
probe(`frameCount=1000;doTick=true;BIOME_ACTIVE=false;currentLevel=1;buildings=[];activeBuildings=[];activeParkingCars=[];barrels=[];invalidateColIndex();viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;window.__swordViews=[];`);
const labels=['1 / Head off','2 / Waist split','3 / Diagonal split'];
for(let i=0;i<6;i++)probe(`window.e=new Character(0,0,false,'${i<3?'NM0_ROOKIE':'ARMORED_STANDARD'}');e.aimAngle=-HALF_PI;rememberFigureMotion(e,0,0);swordKillCounter=${i%3};window.body=swordKillCorpse(e,${i<3?-Math.PI/2:Math.PI/2});__swordViews.push({body,particles:[]});`);
function advance(){probe('frameCount++;for(const v of __swordViews){particles=v.particles;v.body.update();updateParticles();v.particles=particles;}');}
function draw(frame){
 c.resetTransform();c.fillStyle='#1c2831';c.fillRect(0,0,1080,748);c.fillStyle='#eee8ce';c.font='24px sans-serif';c.fillText('SWORD KILLS / HEAD → WAIST → DIAGONAL → REPEAT',20,32);
 c.font='14px sans-serif';c.fillStyle='#adc8cc';c.fillText(`Actual corpse painters + cut jets / ${(frame/60).toFixed(2)} s / 3.5-second blood spray`,20,57);
 for(let i=0;i<6;i++){
  const x=14+i%3*357,y=78+Math.floor(i/3)*329;
  c.fillStyle='#a0aaa5';c.beginPath();c.roundRect(x,y,344,312,8);c.fill();c.fillStyle='#172f36';c.font='18px sans-serif';c.fillText(labels[i%3],x+12,y+27);
  c.font='12px sans-serif';c.fillText(i<3?'Blue pistol / forward fall':'NMO pistol armor / backward fall',x+12,y+47);
  c.save();c.beginPath();c.rect(x,y+53,344,247);c.clip();g.push();g.translate(x+174,y+171);g.scale(2.2);
  probe(`window.v=__swordViews[${i}];__swordPaint.translate(-v.body.x,-v.body.y);v.body.show(__swordPaint);for(const p of v.particles)p.show();`);
  g.pop();c.restore();if(!g.balanced())throw Error('Unbalanced sword preview');
 }
}
const animate=process.argv.includes('animate'),frames=path.join(out,'sword-motion');if(animate)fs.mkdirSync(frames,{recursive:true});
for(let f=0;f<=240;f++){if(f)advance();if(f===90){draw(f);fs.writeFileSync(path.join(out,'sword-deaths.png'),canvas.toBuffer('image/png'));}
 if(animate&&f%3===0){draw(f);fs.writeFileSync(path.join(frames,String(f).padStart(3,'0')+'.png'),canvas.toBuffer('image/png'));}}
console.log('Rendered sword-deaths.png'+(animate?' and 81 motion frames':''));

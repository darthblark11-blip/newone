// Canvas target for the game's existing vector painters when p5/Chromium is
// unavailable. No game geometry is duplicated here; this supplies drawing APIs.
const path=require('path');
const deps=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||path.join(process.env.VIS_DEPS||'.','node_modules');
const {createCanvas}=require(require.resolve('@napi-rs/canvas',{paths:[deps]}));
function figureCanvas(width,height){
 const canvas=createCanvas(width,height),c=canvas.getContext('2d');
 let fill=true,stroke=false,vertices=[];const stack=[];
 const rgba=args=>{
  let a=args[0]&&args[0].levels?[...args[0].levels]:args;
  if(a.length===1)a=[a[0],a[0],a[0],255];else if(a.length===2)a=[a[0],a[0],a[0],a[1]];
  return `rgba(${a[0]},${a[1]},${a[2]},${(a[3]===undefined?255:a[3])/255})`;
 };
 const paint=()=>{if(fill)c.fill();if(stroke)c.stroke();};
 const polygon=points=>{c.beginPath();c.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();paint();};
 const g={canvas,drawingContext:c,width,height,
  push(){c.save();stack.push([fill,stroke]);},pop(){if(!stack.length)throw Error('Unbalanced canvas pop');c.restore();[fill,stroke]=stack.pop();},
  translate(x,y){c.translate(x,y);},rotate(a){c.rotate(a);},scale(x,y=x){c.scale(x,y);},
  fill(...a){fill=true;c.fillStyle=rgba(a);},noFill(){fill=false;},stroke(...a){stroke=true;c.strokeStyle=rgba(a);},noStroke(){stroke=false;},strokeWeight(w){c.lineWidth=w;},
  ellipse(x,y,w,h=w){c.beginPath();c.ellipse(x,y,Math.abs(w)*.5,Math.abs(h)*.5,0,0,Math.PI*2);paint();},
  rect(x,y,w,h,r=0){c.beginPath();if(r)c.roundRect(x,y,w,h,Math.max(0,r));else c.rect(x,y,w,h);paint();},
  arc(x,y,w,h,start,end,mode){while(end<start)end+=Math.PI*2;c.beginPath();if(mode==='pie')c.moveTo(x,y);c.ellipse(x,y,Math.abs(w)*.5,Math.abs(h)*.5,0,start,end);if(mode==='pie'||mode==='chord')c.closePath();paint();},
  line(x,y,nx,ny){if(!stroke)return;c.beginPath();c.moveTo(x,y);c.lineTo(nx,ny);c.stroke();},
  triangle(...a){polygon([[a[0],a[1]],[a[2],a[3]],[a[4],a[5]]]);},quad(...a){polygon([[a[0],a[1]],[a[2],a[3]],[a[4],a[5]],[a[6],a[7]]]);},
  beginShape(){vertices=[];},vertex(x,y){vertices.push([x,y]);},curveVertex(x,y){vertices.push([x,y]);},
  endShape(mode){if(!vertices.length)return;c.beginPath();c.moveTo(...vertices[0]);for(const v of vertices.slice(1))c.lineTo(...v);if(mode==='close')c.closePath();paint();},
  image(src,x,y,w,h){if(w===undefined)c.drawImage(src.canvas||src,x,y);else c.drawImage(src.canvas||src,x,y,w,h);},
  pixelDensity(){},remove(){},
  clear(){c.clearRect(0,0,width,height);},balanced(){return stack.length===0;}
 };
 c.lineJoin='round';c.lineCap='round';return {canvas,c,g};
}
module.exports={figureCanvas};

// Export the game's authored firearm surfaces and animated assemblies for Blender.
// These boxes/details are the original art, not a second approximate weapon.
const fs=require('node:fs'),path=require('node:path');
const {ctx,probe}=require('./harness');
const models={};let current;
ctx.handGunBox=(P,x0,x1,y0,y1,z0,z1,r,g,b)=>current.boxes.push({bounds:[x0,x1,y0,y1,z0,z1],color:[r,g,b]});
ctx.handGunDetail=(P,x0,y0,z0,x1,y1,z1,r,g,b,width=.65)=>current.details.push({a:[x0,y0,z0],b:[x1,y1,z1],color:[r,g,b],width});
ctx.longGunMuzzle=(P,x,r,g,b)=>current.boxes.push({bounds:[x-.9,x,-1.9,1.9,-1.9,1.9],color:[r,g,b]});
for(const [semantic,weapon,muzzle] of [['rifle','ASSAULT_RIFLE',39],['shotgun','SHOTGUN',37],['particle_beam','PARTICLE_BEAM',39]]){
 current={boxes:[],details:[],grip:[0,0,0],muzzle:[muzzle,0,0]};
 probe(`drawLongGunSolid(WEAPONS.${weapon},{point:(x,y,z)=>[x,y],view:[0,0,1],light:[.2,.4,.9]},0,0);`);
 if(!current.boxes.length)throw Error('No native weapon geometry: '+weapon);
 models[semantic]=current;
}
// Compare the authored solids at rest, under recoil and during a magazine
// change. The moving artwork can then share one rigid transform per assembly.
ctx.gunMuzzle=()=>{};
function sidearmSample(weapon,kick,mag) {
 current={boxes:[],details:[]};
 probe(`drawHandGunSolid(WEAPONS.${weapon},0,[.2,.3,.9],[0,1],0,${kick},${mag},0)`);
 return current;
}
for(const [name,weapon,rear,muzzle,boreZ,action] of [
 ['pistol','PISTOL',-2,15,1.9,'pistol_slide'],['smg','SMG',-9,16,1.5,'smg_bolt']
]){
 const rest=sidearmSample(weapon,0,0),shot=sidearmSample(weapon,6,0),reload=sidearmSample(weapon,0,1);
 const magazine=name+'_magazine';
 for(const key of [name,action,magazine])models[key]={boxes:[],details:[],frame:[rear,muzzle,boreZ]};
 const base=models[name];
 base.crown=true;
 for(const type of ['boxes','details'])for(const [i,shape] of rest[type].entries()){
  const first=p=>p.bounds?[p.bounds[0],p.bounds[2],p.bounds[4]]:p.a;
  const home=first(shape),slide=home[0]-first(shot[type][i])[0],drop=home[2]-first(reload[type][i])[2];
  const owner=slide>0?action:drop>0?magazine:name;
  if(slide>0)base.actionTravel=slide;
  if(drop>0)base.magazineTravel=drop;
  models[owner][type].push(shape);
 }
 if(!base.actionTravel||!base.magazineTravel)throw Error('Missing animation in '+weapon);
}
const output=path.resolve(__dirname,'../assets/player/native-weapons.json');
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,source:'game.js drawLongGunSolid and drawHandGunSolid',models},null,2)+'\n');
console.log('Extracted original weapon geometry:',Object.keys(models).join(', '));

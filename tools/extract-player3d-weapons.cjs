// Export the existing game's authored long-gun solids for Blender conversion.
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
const output=path.resolve(__dirname,'../assets/player/native-weapons.json');
fs.writeFileSync(output,JSON.stringify({schemaVersion:1,source:'game.js native drawLongGunSolid',models},null,2)+'\n');
console.log('Extracted original weapon geometry:',Object.keys(models).join(', '));

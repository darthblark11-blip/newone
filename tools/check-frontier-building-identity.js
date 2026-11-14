// Regressions from the actual Level 3 recording: filled roof grain, missing
// church landmarks, lost explicit architectural types and repeated badges.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');let checks=0;
const ok=(v,s)=>{assert.ok(v,s);checks++;};
probe(`currentLevel=currentBiome=3;BIOME_ACTIVE=true;legacyGenerateMap();
 activeBuildings=buildings;player=new Character(1300,-180,true);seedWorldClock();
 viewLeft=-20000;viewRight=20000;viewTop=-20000;viewBottom=20000;`);
for(const [name,role,family]of [
 ['CHURCH','CHURCH','CHAPEL'],['SCHOOLHOUSE','SCHOOL','CHAPEL'],
 ['COUNTY COURT','COURT','COURTHOUSE'],['OPERA HOUSE','OPERA','ARCADE'],
 ['COPPER SPUR SALOON','SALOON','SALOON'],['RAILWAY STATION','DEPOT','DEPOT'],
 ['PACIFIC FREIGHT','WAREHOUSE','WAREHOUSE'],['WATER COMPANY','WATERWORKS','WORKSHOP'],
 ['STEAM LAUNDRY','LAUNDRY','WORKSHOP'],['MUSIC & BOOKS','BOOKSHOP','FALSE_FRONT'],
 ['MINE HEAD','MINE','HEADFRAME']]){
 ctx.targetName=name;const d=P('buildings.find(b=>b.signText===targetName).frontierDesign');
 ok(d.role===role&&d.roof===family,name+' retains its own function and structural family');
}
ok(P('typeof drawFrontierTradeEmblem==="undefined"'),'The universal medallion renderer is removed');
ok(P(`(()=>{const b=buildings.find(b=>b.signText==='CHURCH'),m=frontierRoofMesh(b);
 return m.palette.roof[1]>m.palette.roof[0]&&m.palette.wall.every(v=>v>200)&&
 Math.max(...m.faces.flatMap(f=>f.points.map(p=>p[2])))>buildingRise(b)+80;})()`),'Church retains teal roof, white walls and a tall raised cross');
ok(P(`(()=>{const b=frontierSettlementPlan(frontierSettlementSites()[1]).find(b=>b.signText==='SUNSPUR MISSION');
 return b.frontierDesign.roof==='CHAPEL'&&frontierRoofMesh(b).commands.length>30;})()`),'Mission materials do not replace its pitched roof and bell tower with a flat slab');
ok(P(`(()=>{const c=buildings.find(b=>b.signText==='CHURCH'),s=buildings.find(b=>b.signText==='SCHOOLHOUSE');
 const height=b=>Math.max(...frontierRoofMesh(b).faces.flatMap(f=>f.points.map(p=>p[2])))-buildingRise(b);
 return s.hasBell&&height(c)>height(s)+10;})()`),'School bell tower remains distinct from the church cross');
// Observe real draw commands, not the source spelling. An open rib must be a
// stroked path; a fill here recreates the triangular planes in the recording.
let fillOn=true,openFilled=0,ribs=0;
const original={};for(const n of ['fill','noFill','endShape'])original[n]=ctx[n];
ctx.fill=(...v)=>{fillOn=true;return original.fill(...v);};
ctx.noFill=()=>{fillOn=false;return original.noFill();};
ctx.endShape=(close)=>{if(close===undefined){ribs++;if(fillOn)openFilled++;}return original.endShape(close);};
probe('for(const b of buildings.filter(b=>b.frontierDesign))paintFrontierRoofMesh(window,b);');
ok(ribs>100,'Actual material and equipment outlines were rendered');
ok(openFilled===0,'Roof grain never fills triangles or covers raised architectural details');
for(const n in original)ctx[n]=original[n];
console.log(`Frontier building identity: ${checks} checks passed.`);

// Exercise actual living, stunned, corpse and stamped outfit painters.
const assert=require('assert'),{ctx,mkG,probe}=require('./harness');
const P=s=>probe('('+s+')');
probe(`currentLevel=1;BIOME_ACTIVE=false;buildings=[];activeBuildings=[];activeParkingCars=[];barrels=[];invalidateColIndex();
 explosiveArmorUnlocked=ninjaSuitUnlocked=chemistSuitUnlocked=jetpackUnlocked=false;frameCount=1000;`);
let seed=479;ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
 return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
let matrix=[1,0,0,1,0,0],fill=[],stack=[],draws=[],badges=[],attire=[],events=[];
const originals={},names=['push','pop','translate','rotate','scale','fill','ellipse','rect','arc','line','triangle','vertex','drawFallenAttire','drawNmoInsignia'];
for(const n of names)originals[n]=ctx[n];
const mul=u=>{const t=matrix;matrix=[t[0]*u[0]+t[2]*u[1],t[1]*u[0]+t[3]*u[1],t[0]*u[2]+t[2]*u[3],t[1]*u[2]+t[3]*u[3],t[0]*u[4]+t[2]*u[5]+t[4],t[1]*u[4]+t[3]*u[5]+t[5]];};
ctx.push=()=>{stack.push({matrix:[...matrix],fill});originals.push();};
ctx.pop=()=>{assert(stack.length,'unbalanced outfit pop');({matrix,fill}=stack.pop());originals.pop();};
ctx.translate=(x,y)=>{mul([1,0,0,1,x,y]);originals.translate(x,y);};
ctx.rotate=a=>{mul([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);originals.rotate(a);};
ctx.scale=(x,y=x)=>{mul([x,0,0,y,0,0]);originals.scale(x,y);};
ctx.fill=(...a)=>{fill=a[0]&&a[0].levels?[...a[0].levels]:a;originals.fill(...a);};
for(const n of ['ellipse','rect','arc','line','triangle','vertex'])ctx[n]=(...a)=>{
 assert(a.filter(v=>typeof v==='number').every(Number.isFinite),`${n} has non-finite outfit geometry`);
 const d={kind:n,args:a,col:[...fill],matrix:[...matrix]};draws.push(d);events.push(d);originals[n](...a);
};
ctx.drawNmoInsignia=(g,small)=>{const d={badge:true,small:!!small,matrix:[...matrix]};badges.push(d);events.push(d);originals.drawNmoInsignia(g,small);};
ctx.drawFallenAttire=(g,id,TL,TW,back,f,half)=>{attire.push({type:id.eType,back:!!back,f,half,TL,TW});originals.drawFallenAttire(g,id,TL,TW,back,f,half);};
function reset(){matrix=[1,0,0,1,0,0];fill=[];stack=[];draws=[];badges=[];attire=[];events=[];}
function fixture(type='NORMAL',back=true,death=0,player=false,a=-Math.PI/2){
 seed=479;probe(`frameCount=1000;corpses=[];particles=[];window.e=new Character(0,0,${player},'${type}');
 e.aimAngle=${a+(back?0:Math.PI)};e.moveAngle=${a};e.isMoving=true;rememberFigureMotion(e,Math.cos(${a})*4,Math.sin(${a})*4);
 e.decals=[{x:-5,y:3,sz:3,col:[91,1,223,220],isBulletHole:true,isHead:false}];
 window.c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,${death},0,e.decals,e.currentWeapon,${a},e.eType,e.bodyW,e.bodyH,e);
 for(let i=0;i<60;i++){frameCount++;c.update();}`);
}
function paint(code='c.show();'){reset();const before=seed;probe(code);assert.equal(stack.length,0,'unbalanced outfit transform');assert.equal(seed,before,'outfit drawing consumed global RNG');}
// Bald identities stay skin coloured even if a hair colour was assigned alone.
for(const id of [{eType:'NM0_ROOKIE',hairStyle:3,hairCol:[30,20,10]},{eType:'NORMAL'},{eType:'NORMAL',isPlayer:true},{eType:'NORMAL',hairCol:[30,20,10]},{eType:'CITY_CITIZEN_M',hairStyle:6}]){
 probe(`window.id={...${JSON.stringify(id)},skinCol:color(176,121,83)};if(Array.isArray(id.hairCol))id.hairCol=color(...id.hairCol);`);
 for(const f of [0,.3,1])assert.deepStrictEqual(P(`fallenHeadColor(id,{faceDown:true},${f},id.skinCol).levels`),[176,121,83,255]);
}
probe('window.id={eType:"FEMALE_PISTOL",skinCol:color(176,121,83)};');
assert.deepStrictEqual(P('fallenHeadColor(id,{faceDown:true},1,id.skinCol).levels'),[15,15,15,255]);
probe('id={eType:"CITY_CITIZEN_F",hairStyle:3,hairCol:color(76,45,30)};');
assert.deepStrictEqual(P('fallenHeadColor(id,{faceDown:true},1,color(176,121,83)).levels'),[76,45,30,255]);
// Front/right is anatomical, not tied to a north/south map direction.
for(const regular of ['NORMAL','NM0_ROOKIE','NM0_ROOKIE_F'])for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2]){
 fixture(regular,true,0,false,a);paint();assert(attire[0].back);assert.equal(badges.length,1);assert(!badges[0].small,'face-down uniform needs the full NMO insignia');
 assert(draws.some(d=>d.kind==='ellipse'&&d.args[2]===11.5&&d.col.slice(0,3).join(',')==='30,78,178'),'blue circle is missing');
 const badgeIndex=events.findIndex(d=>d.badge),woundIndex=events.findIndex(d=>d.col&&d.col[0]===91&&d.col[2]===223);
 assert(badgeIndex<woundIndex,'insignia covers the wound');
 fixture(regular,false,0,false,a);paint();assert(!attire[0].back);assert.equal(badges.length,1);assert(badges[0].small,'face-up shirt needs the chest emblem');
 const base=P('({a:figureFallYaw(c.fall,c.rag),x:c.x,y:c.y,s:RAG_SCALE})');
 const x=(badges[0].matrix[4]-base.x)*Math.cos(base.a)+(badges[0].matrix[5]-base.y)*Math.sin(base.a);
 const y=-(badges[0].matrix[4]-base.x)*Math.sin(base.a)+(badges[0].matrix[5]-base.y)*Math.cos(base.a);
 assert(x>0&&y>0,'small emblem is not on the upper right chest');
}
for(const type of ['NORMAL','NM0_ROOKIE','NM0_ROOKIE_F']){fixture(type);paint('e.isMoving=false;e.isArmed=false;e.show();');assert.equal(badges.length,1);assert(badges[0].small,'living regular lost the matching chest badge');}
fixture('NM0_ROOKIE');paint('drawFigureHair(window,{eType:"NM0_ROOKIE",hairStyle:3,hairCol:color(58,44,32)},0,0);');assert.equal(draws.length,0,'bald blue regular drew hair');
fixture('NM0_ROOKIE');probe('startPunchStun(e,e.moveAngle);for(let i=0;i<60;i++)advanceStun(e);');paint('drawStunnedFigure(e);');assert.equal(badges.length,1);assert(!badges[0].small,'stunned blue regular lost the full insignia');assert(!draws.some(d=>d.col.slice(0,3).join(",")==="58,44,32"),'stunned blue regular gained hair');
fixture('NORMAL',true,7);paint();assert(draws.some(d=>d.kind==='ellipse'&&d.args[2]===11&&d.args[3]===11&&d.col.slice(0,3).join(',')==='235,180,140'),'shotgun face-down death gave the bald regular hair');
fixture('NORMAL',true,0,true);paint();assert.equal(badges.length,0,'player was given an enemy uniform badge');
fixture('NORMAL',true,0,true);probe('startPunchStun(e,e.moveAngle);e.stunTimer=600;for(let i=0;i<60;i++)advanceStun(e);');paint('drawStunnedFigure(e);');assert(attire[0].back);assert.equal(badges.length,0);
assert(draws.some(d=>d.kind==='ellipse'&&d.args[2]===11&&d.col.slice(0,3).join(',')==='235,180,140'),'stunned bald player gained hair');
// Every rendered entity gets deterministic attire/texture in its own frame.
const types=['NORMAL','FEMALE_PISTOL','NM0_ROOKIE','NM0_ROOKIE_F','MILITARY_NEUTRAL','NM0_GREY_FATIGUE','NM0_CITY_GUARD','ARMORED_STANDARD','ARMORED','AERIAL','AERIAL_PISTOL','MOLOTOV','SIA','DAD','FARMER_MALE','FARMER_FEMALE','COWBOY','COWGIRL','BANDIT','LOCAL_COP','VILLAGER_MALE','VILLAGER_FEMALE','CITY_CITIZEN_M','CITY_CITIZEN_F','BUG','SNAIL','SNAIL_HYBRID','COW','HORSE','ALIEN_GATOR','ROBOT'];
for(const type of types){fixture(type);paint();assert(attire.length,`${type} bypassed corpse outfit/texture drawing`);}
for(const death of [0,1,2,3,4,6,7,8,9,10,11,12,13,14,15]){fixture('NORMAL',true,death);paint();assert(attire.length,`death ${death} omitted remaining outfit details`);}
fixture('FEMALE_PISTOL',true);paint();assert(!draws.some(d=>d.kind==='ellipse'&&JSON.stringify(d.args)==='[4,-6,12,10]'),'front-only breast shapes appear on the back');
fixture('FEMALE_PISTOL',false);paint();assert(draws.some(d=>d.kind==='ellipse'&&JSON.stringify(d.args)==='[4,-6,12,10]'),'front shapes were removed from face-up corpse');
// Outfit choice is frozen when the person dies, including hood and jetpack.
for(const suit of ['ninjaSuitUnlocked','chemistSuitUnlocked','explosiveArmorUnlocked','jetpackUnlocked']){
 probe(`${suit}=true;`);fixture('NORMAL',true,0,true);const id=P('c.id');probe(`${suit}=false;`);paint();assert.deepStrictEqual(P('c.id'),id);
 if(suit==='ninjaSuitUnlocked')assert.equal(P('headwearOf(c.id)'),'HOOD');
 if(suit==='explosiveArmorUnlocked')assert.equal(P('headwearOf(c.id)'),'VISOR');
}
fixture('CITY_CITIZEN_M');const clothing=P('c.id.clothingStyle');probe('e.clothingStyle=(e.clothingStyle+1)%4;e.shirtCol=color(255,0,255);');assert.equal(P('c.id.clothingStyle'),clothing);assert.notDeepStrictEqual(P('c.id.shirtCol.levels'),[255,0,255,255]);
// A jetpack stays on the back even when a player also wears a suit.
probe('ninjaSuitUnlocked=jetpackUnlocked=true;');fixture('NORMAL',true,0,true);
probe('ninjaSuitUnlocked=jetpackUnlocked=false;');paint();
assert(draws.some(d=>d.kind==='rect'&&d.col.slice(0,3).join(',')==='43,49,55'),'suit suppressed the captured jetpack');
// Added dorsal gator art retains the actual body/head wound frames.
fixture('ALIEN_GATOR',true,7);probe(`e.decals=[{x:-5,y:3,sz:3,col:[91,1,201,220],isBulletHole:true},
 {x:2,y:4,sz:3,col:[91,1,202,220],isBulletHole:true,isHead:true},
 {x:5,y:-3,sz:3,col:[91,1,203,220],isBulletHole:true}];
 e.fallHit={frame:frameCount,kind:'BODY',weapon:WEAPONS.SHOTGUN,angle:0,fatal:true,wound:e.decals[2]};
 c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,7,0,e.decals,e.currentWeapon,0,e.eType,e.bodyW,e.bodyH,e);
 for(let i=0;i<60;i++){frameCount++;c.update();}`);paint();
for(const [i,w]of P('c.fatalSpray.wounds').entries()){
 const d=draws.filter(d=>d.kind==='ellipse'&&d.col[0]===91&&d.col[2]===w.col[2]);assert.equal(d.length,1);
 const a=d[0].args,m=d[0].matrix,p=P(`fatalWoundPoint(c,c.fatalSpray.wounds[${i}])`);
 assert(Math.hypot(p.x-(m[0]*a[0]+m[2]*a[1]+m[4]),p.y-(m[1]*a[0]+m[3]*a[1]+m[5]))<1e-8,'gator dorsal detail moved a spray origin');
}
// Retirement uses the same body details on a graphics target.
fixture();paint();const visible=attire.map(d=>({...d}));
ctx.createGraphics=(w,h)=>{const g=mkG();g.width=w;g.height=h;for(const n of names.slice(0,-2))g[n]=ctx[n];return g;};
probe('wipeAllBloodBanks();useBloodBank("backs");');paint('stampCorpse(c);');assert(attire.length);for(const d of attire)assert.deepStrictEqual(d,visible[0]);assert(badges.every(b=>!b.small));
for(const [n,fn]of Object.entries(originals))ctx[n]=fn;
console.log('Corpse backs passed: bald player/yellow and blue male regular/receding scalp, true hair, full NMO back and anatomical right-chest badges on yellow/blue/female-blue uniforms in 4 directions, blood layering, living/stunned/corpse/stamped rendering, 31 entity types, 15 remaining-body death forms, front/back clothing, frozen suits/civilian attire and unchanged drawing RNG.');

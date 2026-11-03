// Follow the actual wall-death controller and anatomy through contact, seated
// relaxation and both hip landings. No easing or joint math is repeated here.
const assert=require('node:assert/strict');
const {ctx,probe,mkG}=require('./harness');
const P=s=>probe('('+s+')');
let seed=73019;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;
 return a===undefined?r:Array.isArray(a)?a[Math.floor(r*a.length)]:b===undefined?r*a:a+(b-a)*r;};
probe(`isStoryMode=false;townsData={};startAtLevel(1);started=doTick=true;
 currentLevel=currentBiome=1;BIOME_ACTIVE=true;enemiesList=[];corpses=[];
 activeBuildings=buildings=[];activeParkingCars=[];parkingCars=[];barrels=[];
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;
 width=1200;height=800;zoom=1;camX=-600;camY=-600;player.x=player.y=10000;`);
function drop({normal=[0,-1],outcome='SIDE',side=1,type='NM0_ROOKIE',death=0}={}){
 const [nx,ny]=normal,a=Math.atan2(ny,nx),vertical=nx!==0;
 probe(`frameCount++;clearWallCorpses();useBloodBank('wall-slump');particles=[];
  window.wall={x:0,y:0,w:${vertical?70:280},h:${vertical?280:70},isWall:true,hqWall:'PANEL'};
  activeBuildings=buildings=[wall];invalidateColIndex();
  window.e=new Character(${nx*55},${ny*55},false,${JSON.stringify(type)});e.aimAngle=e.moveAngle=${a};rememberFigureMotion(e,0,0);
  e.fallHit={frame:frameCount,kind:'BODY',angle:${a+Math.PI},force:3,mx:0,my:0};
  window.c=new Corpse(e.x,e.y,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,${death},0,e.decals,e.currentWeapon,${a+Math.PI},e.eType,e.bodyW,e.bodyH,e);
  corpses=[c];if(!c.wallSit)throw Error('Wall seated fixture was not selected');
  c.wallSit.outcome=${JSON.stringify(outcome)};c.wallSit.side=${side};`);
}
function tick(n=1){probe(`for(let i=0;i<${n};i++){frameCount++;c.update();}`);}
const anatomy=()=>P('seatedCorpseAnatomy(c)');
const points=a=>[a.hip,a.head,...a.shoulders,...a.knees,...a.heels,...a.elbows,...a.hands];
const finite=a=>points(a).every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y));
let trajectories=0,maxStep=0;
for(const normal of [[0,-1],[0,1],[-1,0],[1,0]])for(const [outcome,side] of [['SEATED',1],['SIDE',-1],['SIDE',1]]){
 drop({normal,outcome,side});
 let previous=anatomy();assert(finite(previous),'initial anatomy became nonfinite');
 const snapshots={0:previous};
 for(let frame=1;frame<=220;frame++){
  tick();const a=anatomy();assert(finite(a),'animated anatomy became nonfinite');
  for(let i=0;i<points(a).length;i++){
   const distance=Math.hypot(points(a)[i].x-points(previous)[i].x,points(a)[i].y-points(previous)[i].y);
   maxStep=Math.max(maxStep,distance);
   assert(distance<3.2*a.scale,`wall slump jumped ${distance.toFixed(3)} at joint${i}, frame${frame}, normal${normal} for ${outcome}/${side}`);
  }
  if([24,64,82,138,156,220].includes(frame))snapshots[frame]=a;
  previous=a;
 }
 assert(P('c.wallSit.done'),'wall slump did not terminate');
 const pose=P('wallCorpseSlumpPose(c)');assert.equal(pose.tip,outcome==='SIDE'?1:0);
 const local24=snapshots[24].local,local64=snapshots[64].local;
 assert(local64.head.x>local24.head.x+.2,'head did not slump forward from seated');
 assert(local64.head.z<local24.head.z-.5,'head did not drop with relaxed posture');
 const gap=a=>Math.abs(a.heels[0].y-a.heels[1].y);
 assert(gap(local64)<gap(local24)-.5,'relaxed heels did not move toward each other');
 assert(local64.hands.reduce((n,p)=>n+p.z,0)<local24.hands.reduce((n,p)=>n+p.z,0)-.2,
  'arms did not settle lower as they relaxed');
 const final=snapshots[220];
 if(outcome==='SIDE'){
  assert(final.profile>.65,'hip landing did not expose side-profile anatomy');
  assert(final.local.head.z<local64.head.z-5,'head remained upright after tipping onto hip');
  assert((final.local.head.y-local64.head.y)*side>5,'side landing did not follow the selected hip');
  assert(Math.abs(final.local.hip.x-local64.hip.x)<5*final.scale,'hip pulled away from supporting wall');
  const support=final.local.hips.concat(final.local.heels);
  assert(support.every(p=>p.z>=-.01),'a settled hip or heel passed below the floor');
  assert(Math.min(...support.map(p=>p.z))<4.5*final.scale,'side corpse floated above its hip/heel contacts');
 }else {
  assert(final.profile<.2,'relaxed seated outcome unexpectedly turned onto its side');
  const l=final.local,shoulderHeight=l.shoulders.reduce((sum,p)=>sum+p.z,0)/2,
    kneeForward=l.knees.reduce((sum,p)=>sum+p.x,0)/2;
  assert(l.head.z<shoulderHeight,'neutral head stayed upright above the shoulders');
  assert(l.head.x>kneeForward,'neutral head did not hang forward over the lap');
  assert(l.chest.x>l.hip.x+1,'neutral chest stayed upright against the wall');
 }
 const frozen=P('JSON.stringify([c.x,c.y,c.wallSit,seatedCorpseAnatomy(c)])');tick(100);
 assert.equal(P('JSON.stringify([c.x,c.y,c.wallSit,seatedCorpseAnatomy(c)])'),frozen,'completed wall death kept moving');
 trajectories++;
}
// A ledge too short to support either back retains the seated end. Near one
// end of a longer wall, a side outcome must choose the inward hip. Choosing
// these variants must not consume randomness used by combat or spawn code.
drop();
probe(`for(let stamp=1;stamp<50;stamp++){c.bornAt=stamp;chooseCorpseWallOutcome(c);if(c.wallSit.outcome==='SIDE')break;}
 window.shortWall={...wall,w:20};activeBuildings=buildings=[shortWall];invalidateColIndex();
 c.wallSit.b=shortWall;c.wallSit.key=wallBloodKey(shortWall);`);
let randomCalls=0;const realRandom=ctx.random;
ctx.random=(...a)=>{randomCalls++;return realRandom(...a);};
try{
 probe('chooseCorpseWallOutcome(c);');
 assert.equal(P('c.wallSit.outcome'),'SEATED','short support left a body tipping into unsupported air');
 assert.equal(randomCalls,0,'short-wall outcome changed the combat random stream');
 drop();probe(`wall.w=180;c.x=80;invalidateColIndex();
  for(let stamp=1;stamp<50;stamp++){c.bornAt=stamp;chooseCorpseWallOutcome(c);if(c.wallSit.outcome==='SIDE')break;}`);
 assert.equal(P('c.wallSit.outcome'),'SIDE','corner fixture never chose a side outcome');
 assert.equal(P('c.wallSit.side'),-1,'corner corpse tipped off the end of its support');
 // Character construction above legitimately uses random; only repeat the
 // isolated event selector to observe whether this new choice changes it.
 randomCalls=0;probe('for(let repeat=0;repeat<20;repeat++)chooseCorpseWallOutcome(c);');
 assert.equal(randomCalls,0,'wall outcome changed the combat random stream');
}finally{ctx.random=realRandom;}
// Pausing freezes the sequence, and the normal update pass banks only the
// completed pose. Offscreen and travel finish the same sequence without leaks.
for(const outcome of ['SEATED','SIDE']){
 drop({outcome,side:-1});tick(54);
 const before=P('JSON.stringify([c.wallSit,seatedCorpseAnatomy(c)])');
 probe('doTick=false;for(let i=0;i<60;i++){frameCount++;updateCorpses();}');
 assert.equal(P('JSON.stringify([c.wallSit,seatedCorpseAnatomy(c)])'),before,'pause advanced wall slump');
 probe('doTick=true;viewLeft=viewTop=10000;viewRight=viewBottom=11000;for(let i=0;i<420;i++){frameCount++;updateCorpses();}');
 assert(P('c.wallSit.done&&c.isStatic&&!corpses.includes(c)'), 'offscreen wall slump failed to bank');
 assert(P('wallCorpseBanks.get(wallCorpseBankKey(wall)).includes(c)'), 'completed wall death disappeared');
 probe('viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;');
 drop({outcome});tick(58);probe('retireCorpsesToBloodBank();');
 assert(P('c.wallSit.done&&corpses.length===0'),'travel left incomplete slump animation');
}
// Human identities and retained head injuries use the same live and buffer
// painters throughout the turn. Every primitive stays finite and balanced.
let stack=0;const originals={};
for(const name of ['push','pop','ellipse','translate','rotate','scale'])originals[name]=ctx[name];
ctx.push=(...a)=>{stack++;return originals.push(...a);};
ctx.pop=(...a)=>{stack--;assert(stack>=0,'corpse painter popped beyond its stack');return originals.pop(...a);};
for(const name of ['ellipse','translate','rotate','scale'])ctx[name]=(...a)=>{assert(a.every(Number.isFinite),name+' received nonfinite geometry');return originals[name](...a);};
let painters=0;
try{
 for(const type of ['NM0_ROOKIE','NM0_ROOKIE_F','ARMORED_STANDARD','CITY_CITIZEN_F','COWBOY'])
 for(const death of [0,1,6,8,9])for(const age of [24,64,108,156]){
  drop({type,death,outcome:'SIDE',side:painters%2?1:-1});tick(age);probe('c.show();');assert.equal(stack,0);
  ctx.__slumpTarget=mkG();probe('c.show(__slumpTarget);');assert.equal(stack,0);painters++;
 }
}finally{for(const [name,fn] of Object.entries(originals))ctx[name]=fn;}
console.log(`Corpse wall slump passed: ${trajectories} seated/left/right trajectories, max joint step ${maxStep.toFixed(3)}, relaxed head/heels/arms, side-profile hip landings, frozen rest, pause/offscreen/travel and ${painters} finite identity/injury painters.`);

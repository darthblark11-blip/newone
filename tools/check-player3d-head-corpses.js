// Settled player bodies keep live shading without retaining death simulation.
const assert=require('node:assert/strict');
const {ctx,probe,mkG}=require('./harness');
const P=s=>probe('('+s+')');let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
probe(`Player3D.enabled=true;Player3D.ensure=()=>true;
 currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
 isPaused=isDead=isWin=killcamMode=false;buildGhost=null;
 viewLeft=viewTop=-100000;viewRight=viewBottom=100000;`);
const nativeStamp=ctx.stampCorpse;
const stamped=[],draws=[];
ctx.stampCorpse=c=>stamped.push(c.testId);
ctx.shovelBelowGroundActor=c=>!!c.buried;
ctx.shovelUpdateActor=()=>{};ctx.releaseUnsupportedWallCorpses=()=>{};
ctx.cullCorpseStacks=()=>{};
function body(id,isPlayer=true){return {testId:id,x:10,y:20,id:{isPlayer},isCorpse:true,
 isStatic:false,dT:0,fP:1,bT:0,bloodTimer:0,smokeTimer:0,poolAge:1000,sep:0,dec:[],
 bW:21,bH:27,rag:{done:true},updates:0,update(){this.updates++;},show(){draws.push(this.testId);}};}
function setBodies(list){ctx.__bodies=list;probe('corpses=__bodies;');}
const floor=Array.from({length:10},(_,i)=>body(i)),npc=body('NPC',false);
setBodies([...floor,npc]);probe('updateCorpses();');
ok(P('corpses.length')===8,'only newest eight player bodies remain live');
assert.deepEqual(Array.from(P('corpses.map(c=>c.testId)')),[2,3,4,5,6,7,8,9]);checks++;
assert.deepEqual(stamped,['NPC',0,1]);checks++;
ok(P('corpses.every(c=>c.isStatic&&c._player3DLightingLive)'),'retained bodies no longer advance death physics');
const updates=floor.map(c=>c.updates);draws.length=0;
probe('updateCorpses();');
assert.deepEqual(floor.map(c=>c.updates),updates,'settled rendering does not advance timers or physics');checks++;
ok(draws.length===8,'settled player meshes redraw under the current world light');

// Floor quota never deletes unsupported wall/shaft bodies: stampCorpse cannot
// represent them in the ordinary surface texture.
const wall={...body('wall'),wallSit:{done:true},_player3DLightingLive:true,isStatic:true};
const buried={...body('buried'),buried:true,_player3DLightingLive:true,isStatic:true};
const marked=Array.from({length:10},(_,i)=>({...body('f'+i),_player3DLightingLive:true,isStatic:true}));
ctx.__trim=[wall,buried,...marked];stamped.length=0;probe('player3DTrimLiveCorpses(__trim);');
ok(ctx.__trim.includes(wall)&&ctx.__trim.includes(buried),'floor quota preserves separate wall and shaft passes');
assert.deepEqual(stamped,['f0','f1']);checks++;

// Map exit converts retained statics into ordinary permanent blood-bank art.
for(const name of ['finishParticleBeamWounds','finishFigureFall','finishSwordParts','finishBlastDeath','finishCorpsePieces'])ctx[name]=()=>{};
const exiting=[{...body('exit'),isStatic:true,_player3DLightingLive:true}];
setBodies(exiting);stamped.length=0;probe('retireCorpsesToBloodBank();');
assert.deepEqual(stamped,['exit']);checks++;
ok(exiting.length===0,'map exit clears the live list after stamping');

// Unsupported graphics preserve ordinary native retirement.
probe('Player3D.enabled=false;');const fallback=body('fallback');setBodies([fallback]);stamped.length=0;
probe('updateCorpses();');
assert.deepEqual(stamped,['fallback']);checks++;
ok(P('corpses.length')===0,'disabled mesh path does not retain extra bodies');
probe('Player3D.enabled=true;Player3D.ensure=()=>false;');
setBodies([body('failed')]);stamped.length=0;probe('updateCorpses();');
assert.deepEqual(stamped,['failed']);checks++;
probe('Player3D.ensure=()=>true;');

// Distant culling keeps permanent floor art for a retained player body.
const distant={...body('distant'),x:100000,y:100000,isStatic:true,_player3DLightingLive:true};
setBodies([distant]);stamped.length=0;
probe('player={x:0,y:0};enemiesList=[];frameCount=90;cullDistantEnemies();');
assert.deepEqual(stamped,['distant']);checks++;
ok(P('corpses.length')===0,'distant retained body leaves the live list');

// Temporary chunk-space coordinates must not redirect light sampling or leak
// out of an exception while a corpse is being stamped.
ctx.stampCorpse=nativeStamp;ctx.groundElev=()=>7;
ctx.acquireBloodChunk=()=>({bx:13,by:17,pg:mkG()});ctx.bloodKey=()=> 'head-light-test';
ctx.shovelBelowGroundActor=c=>!!c.buried;
const originReads=[];const stampBody={x:1100,y:2200,bW:21,bH:27,id:{isPlayer:true},
 show(){originReads.push(P('player3DCorpseWorldOrigin(__stampBody)'));throw Error('intentional stamp draw failure');}};
ctx.__stampBody=stampBody;
assert.throws(()=>probe('stampCorpse(__stampBody);'),/intentional stamp draw failure/);checks++;
assert.deepEqual({x:stampBody.x,y:stampBody.y},{x:1100,y:2200});checks++;
ok(!Object.hasOwn(stampBody,'_player3DStampWorldOrigin'),'temporary origin is restored after stamp failure');
ok(originReads.length===1&&originReads[0].x===1100&&originReads[0].y===2200&&originReads[0].z===7,
 'stamp lighting keeps the true world position');

// Direct detached heads and skull fragments are isotropic, including their
// enlarged visual scale. They keep using the caller's Canvas context.
const captures=[];ctx.__capture=(s,target)=>{captures.push({s,target});return true;};
probe('Player3D.draw=__capture;Player3D.ensure=()=>true;');ctx.__headTarget=mkG();
probe("drawPlayer3DFallenHead(__headTarget,{isPlayer:true,eType:'NORMAL'},null,1,false);");
const part=captures[0].s.parts.find(p=>p.part==='head');
const length=i=>Math.hypot(part.matrix[i],part.matrix[i+1],part.matrix[i+2]);
ok(Math.abs(length(0)-length(4))<1e-6&&Math.abs(length(0)-length(8))<1e-6,'detached head is spherical');
ok(Math.abs(length(0)-6.05)<.001,'detached head is ten percent larger');
const gibs=P("player3DCorpseGibParts({isCharred:false},[{type:'skull',sz:8},{type:'skull_frag',sz:5}])");
for(const g of gibs){const m=g.matrix,scale=i=>Math.hypot(m[i],m[i+1],m[i+2]);
 ok(Math.abs(scale(0)-scale(4))<1e-6&&Math.abs(scale(0)-scale(8))<1e-6,'skull part has no egg-shaped axis');}
console.log(checks+' corpse head, live-light retention and world-origin checks passed');

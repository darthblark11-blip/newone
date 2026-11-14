// Compare hostile-human mesh joints with the original living painter, rather
// than asserting a second copy of the replacement's pose arithmetic.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
// Validate the source module even before the generated standalone is rebuilt.
probe('player3DPose=(()=>{'+fs.readFileSync(path.join(__dirname,'player3d/pose.js'),'utf8')+';return player3DPose;})()');
let checks=0,cases=0,maxError=0;
const ok=(v,s)=>{assert.ok(v,s);checks++;};
const close=(a,b,s)=>{const error=Math.hypot(a.x-b.x,a.y-b.y);maxError=Math.max(maxError,error);ok(error<.025,s+' error '+error);};
const rgb=c=>Array.from(c&&c.levels||c||[]).slice(0,3);
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<.001);
probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
 inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
 currentLevel=currentBiome=2;BIOME_ACTIVE=false;isStoryMode=false;window.inNM0SecretOverlay=false;
 buildGhost=null;resetUndergroundRoute();setMeleeTool('NONE');
 chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
 isCooking=meleeInputHeld=cannonInputHeld=grenadeInputHeld=false;
 leftStick={active:false,dx:0,dy:0,dist:0};rightStick={active:false,dx:0,dy:0,dist:0};
 buildings=activeBuildings=[];barrels=[];activeParkingCars=[];enemiesList=[];
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;`);
function fresh(type,weapon,angle,stance='STAND',reload=0){
 probe(`enemy=new Character(0,0,false,${JSON.stringify(type)});enemy.currentWeapon=WEAPONS[${JSON.stringify(weapon)}];
  enemy.isNeutral=enemy.isFriendly=false;enemy.aimAngle=${angle};enemy.moveAngle=${angle+1.2};
  enemy.walkCycle=1.12;enemy.gait=.9;enemy.isMoving=true;enemy.isArmed=false;
  enemy._entityFacing={active:true,motion:.37,move:{angle:${angle+1.2}}};
  enemy.meleeTimer=enemy.dashTimer=enemy.muzzleFlash=enemy.hitFlash=enemy.weaponKick=0;enemy.reloadTimer=${reload};
  resetActorStance(enemy,${JSON.stringify(stance)});frameCount++;`);
}
function nativeTrace(){
 const old={},stack=[],limbs=[],heads=[];let m=[1,0,0,1,0,0];
 const save=()=>stack.push(m.slice()),restore=()=>{assert.ok(stack.length);m=stack.pop();};
 const multiply=u=>{const a=m;m=[a[0]*u[0]+a[2]*u[1],a[1]*u[0]+a[3]*u[1],a[0]*u[2]+a[2]*u[3],a[1]*u[2]+a[3]*u[3],a[0]*u[4]+a[2]*u[5]+a[4],a[1]*u[4]+a[3]*u[5]+a[5]];};
 const point=(x,y)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
 const replacements={push:save,pop:restore,translate:(x,y)=>multiply([1,0,0,1,x,y]),
  rotate:a=>multiply([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]),
  scale:(x,y=x)=>multiply([x,0,0,y,0,0]),applyMatrix:(...u)=>multiply(u),
  figureCelLimb:(g,sx,sy,ex,ey,hx,hy,w0,w1,w2,c)=>limbs.push({shoulder:point(sx,sy),elbow:point(ex,ey),hand:point(hx,hy),color:rgb(c)}),
  drawFigureHead:(g,c,x,y)=>heads.push(point(x,y))};
 for(const [k,v] of Object.entries(replacements)){old[k]=ctx[k];ctx[k]=v;}
 const enabled=P('Player3D.enabled');
 try{probe('Player3D.enabled=false;enemy.show();');}
 finally{probe('Player3D.enabled='+JSON.stringify(enabled));Object.assign(ctx,old);}
 assert.equal(stack.length,0,'native painter balances transforms');
 let arms=limbs.filter(l=>same(l.color,[84,104,124]));
 if(arms.length===4&&Math.hypot(arms[0].hand.x-arms[1].shoulder.x,arms[0].hand.y-arms[1].shoulder.y)<.025)
  arms=[0,2].map(i=>({shoulder:arms[i].shoulder,elbow:arms[i].hand,hand:arms[i+1].hand}));
 return {arms,head:heads[0]};
}
for(const weapon of ['PISTOL','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','PARTICLE_BEAM','ROCKET_LAUNCHER','REVOLVER','COACH_GUN','BOW'])
 for(const stance of ['STAND','CROUCH'])for(const angle of [0,.7,Math.PI,-Math.PI+.01]){
  fresh('NORMAL',weapon,angle,stance);
  probe('enemy.shirtCol=color(84,104,124);enemy.pantsCol=color(31,43,51);');
  const trace=nativeTrace(),before=P('JSON.stringify(enemy)'),pose=P('player3DPose(enemy)');cases++;
  ok(P('JSON.stringify(enemy)')===before,'enemy render does not mutate actor or cached facing');
  ok(P('enemy.isArmed===false&&!enemy.isPlayer'),'enemy simulation armed/player flags preserved');
  ok(pose.parts.some(p=>p.part==='weapon_primary'),weapon+' visible despite NPC isArmed=false');
  ok(pose.parts.every(p=>Array.from(p.matrix).every(Number.isFinite)),'all mesh transforms finite');
  const muzzle=P('aimLaserMuzzle(enemy,0)');close(pose.sockets.muzzle,muzzle,weapon+'/'+stance+' native muzzle');
  close(pose.sockets.head,trace.head,weapon+'/'+stance+' native head');
  ok(trace.arms.length===2,weapon+'/'+stance+' native arms recorded');
  for(let i=0;i<2;i++)for(const [socket,key] of [['Shoulder','shoulder'],['Elbow','elbow'],['Hand','hand']])
   close(pose.sockets[(i?'right':'left')+socket],trace.arms[i][key],weapon+'/'+stance+' '+key);
  if(stance==='STAND')ok(Math.abs(pose.pose.hipHeading-P('standingLowerPose(enemy).angle'))<1e-8,'native independent hip heading');
 }
// Outfit colors remain enemy identity, including steel damage thresholds.
for(const [type,shirt,pants] of [['NORMAL',[220,200,20],[30,30,30]],['FEMALE_PISTOL',[255,105,180],[20,20,20]],
 ['NM0_GREY_FATIGUE',[170,175,180],[100,105,110]],['MILITARY_NEUTRAL',[190,170,130],[139,115,85]],
 ['ARMORED_STANDARD',[40,80,200],[30,30,30]],['BANDIT',[74,62,58],[52,46,44]]]){
 fresh(type,type==='BANDIT'?'REVOLVER':'ASSAULT_RIFLE',.7);const pose=P('player3DPose(enemy)');
 ok(same(pose.palette.shirt,shirt)&&same(pose.palette.pants,pants),type+' retains its uniform colors');
 if(type==='ARMORED_STANDARD'){
  ok(pose.parts.some(p=>p.part==='armor'&&same(p.color,[100,104,112])),'standard armored enemy wears steel plate');
  ok(pose.parts.some(p=>p.part==='helmet'&&same(p.color,[64,77,73])),'healthy standard armor wears an open army helmet');
  probe('enemy.hp=50');ok(!P('player3DPose(enemy)').parts.some(p=>p.part==='helmet'),'standard helmet disappears at native hp50 threshold');
 }
 if(type==='BANDIT'){
  ok(pose.parts.some(p=>p.mesh==='cowboy_hat'&&same(p.color,[34,30,30])),'bandit wears a dark cowboy hat');
  ok(pose.parts.some(p=>p.part==='vest'&&same(p.color,[58,48,44])),'bandit keeps dark duster identity');
  ok(pose.parts.some(p=>p.part==='bandana'&&same(p.color,P('Array.from(enemy.kerchiefCol.levels).slice(0,3)'))),'bandit keeps its kerchief color');
 }
 if(type==='NM0_GREY_FATIGUE'){
  ok(pose.parts.some(p=>p.part==='headwear'&&same(p.color,[112,124,118])),'grey infantry helmet contrasts with its fatigues');
  ok(pose.parts.some(p=>p.mesh==='army_webbing'&&same(p.color,[68,77,83])),'grey infantry wears separate charcoal field webbing');
 }
 if(type==='MILITARY_NEUTRAL')ok(pose.parts.some(p=>p.part==='headwear'&&same(p.color,shirt)),'military helmet matches native tan color');
}
// Player inventory choices must never place a shovel/blade in an NPC hand.
fresh('NORMAL','PISTOL',.7);probe("window.shovelOwned=true;setMeleeTool('SHOVEL');isCooking=true;");
let pose=P('player3DPose(enemy)');
ok(!pose.parts.some(p=>['shovel','pickaxe','sword','held_grenade','cannon'].includes(p.part)||['shovel','pickaxe','sword'].includes(p.mesh)),'NPC ignores player melee and support-action inventory');
probe("setMeleeTool('NONE');isCooking=false;enemy.isUnarmed=true;");
ok(!P('player3DPose(enemy)').parts.some(p=>p.part==='weapon_primary'),'unarmed NPC does not acquire a firearm');
for(const weapon of ['PISTOL','ASSAULT_RIFLE'])for(const reload of [15,45,75]){
 fresh('NORMAL',weapon,.7,'STAND',reload);probe('enemy.shirtCol=color(84,104,124)');
 const trace=nativeTrace(),before=P('JSON.stringify(enemy)'),pose=P('player3DPose(enemy)');
 ok(P('JSON.stringify(enemy)')===before,'enemy reload pose is read only');
 for(let i=0;i<2;i++)close(pose.sockets[(i?'right':'left')+'Hand'],trace.arms[i].hand,'NPC native reload wrist');
}
fresh('MOLOTOV','PISTOL',.7);pose=P('player3DPose(enemy)');
ok(pose.parts.some(p=>p.part==='held_molotov'&&p.mesh==='flask'&&same(p.color,[30,120,30])),'molotov enemy holds its green bottle');
ok(!pose.parts.some(p=>p.part==='weapon_primary'),'molotov bottle does not add an invented firearm');
const wick=pose.sockets.molotovWick,hand=pose.sockets.rightHand;
close(wick,{x:hand.x+Math.cos(pose.pose.chestHeading)*4+Math.sin(pose.pose.chestHeading)*3,
 y:hand.y+Math.sin(pose.pose.chestHeading)*4-Math.cos(pose.pose.chestHeading)*3},'molotov wick keeps native offset from wrist');
fresh('NORMAL','BOW',.7);probe('enemy._coverBowMuzzles=[[123,456]]');
const staleBow=P('JSON.stringify(enemy)');P('player3DPose(enemy)');
ok(P('JSON.stringify(enemy)')===staleBow,'NPC bow projection never mutates an existing nested muzzle cache');
console.log(checks+' enemy native-joint, muzzle, material, hip and purity checks passed across '+cases+' poses; max XY error '+maxError.toFixed(6));

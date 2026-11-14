// Asset validity and simulation-side pose contracts; no WebGL stubs are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {ctx, probe} = require('./harness');
const P = s => probe('(' + s + ')');
const asset = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/player/player-mesh.json')));
let checks = 0;
const ok = (value, label) => { assert.ok(value, label); checks++; };
ok(asset.schemaVersion === 1, 'versioned Blender export');
for (const name of ['head','torso','pelvis','upper_arm','forearm','hand','thigh','shin','foot',
  'helmet','hood','cowboy_hat','jetpack','pistol','revolver','rifle','shotgun','bow','sword','shovel']) {
  ok(!!asset.meshes[name], 'mesh: ' + name);
}
for (const [name, mesh] of Object.entries(asset.meshes)) {
  ok(mesh.positions.length > 0 && mesh.positions.length % 3 === 0, name + ' vertices');
  ok(mesh.normals.length === mesh.positions.length, name + ' normal count');
  ok(mesh.positions.every(Number.isFinite) && mesh.normals.every(Number.isFinite), name + ' finite geometry');
  ok(mesh.indices.length > 0 && mesh.indices.length % 3 === 0 &&
    mesh.indices.every(i => Number.isInteger(i) && i >= 0 && i < mesh.positions.length / 3), name + ' triangle indices');
  let unit = true;
  for (let i = 0; i < mesh.normals.length; i += 3) {
    if (Math.abs(Math.hypot(...mesh.normals.slice(i,i+3)) - 1) > .015) unit = false;
  }
  ok(unit, name + ' unit normals');
}
for (const extension of ['blend','glb']) ok(fs.statSync(path.join(__dirname,'../assets/player/player.'+extension)).size > 1024, 'editable/exported ' + extension);

probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
 inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=inCutscene=false;
 currentLevel=currentBiome=2;BIOME_ACTIVE=false;window.inNM0SecretOverlay=false;buildGhost=null;
 resetUndergroundRoute();setMeleeTool('NONE');
 chemistSuitUnlocked=explosiveArmorUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=false;jetpackUnlocked=false;
 leftStick={active:true,dx:1,dy:0};rightStick={active:true,dx:1,dy:0,dist:1};
 player=new Character(70,90,true);player.isArmed=true;player.isMoving=true;
 player.aimAngle=.63;player.moveAngle=2.2;player.gait=1;player.walkCycle=.9;player.aimHold=14;
 player.reloadTimer=player.meleeTimer=player.dashTimer=player.muzzleFlash=0;
 player.currentWeapon=WEAPONS.PISTOL;resetActorStance(player,'STAND');
 viewLeft=viewTop=-100000;viewRight=viewBottom=100000;`);
function valid(label) {
  ok(P(`(()=>{const p=player3DPose(player);return p&&p.parts.length>8&&p.parts.every(s=>
   PLAYER3D_ASSET.meshes[s.mesh]&&s.matrix.length===16&&Array.from(s.matrix).every(Number.isFinite))&&
   p.bounds.length===4&&p.bounds.every(Number.isFinite)&&p.bounds[2]>p.bounds[0]&&p.bounds[3]>p.bounds[1];})()`), label);
}
const weapons = P('Object.keys(WEAPONS).filter(k=>WEAPONS[k]&&typeof WEAPONS[k]==="object")');
for (const weapon of weapons) for (const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]) {
  probe(`player.currentWeapon=WEAPONS[${JSON.stringify(weapon)}];player.aimAngle=${angle};frameCount++;`);
  valid(weapon + ' at ' + angle);
}
for (const stance of ['STAND','CROUCH','PRONE']) {
  probe(`resetActorStance(player,${JSON.stringify(stance)});`);valid(stance);
  for(const weapon of weapons){
    probe(`player.currentWeapon=WEAPONS[${JSON.stringify(weapon)}];`);
    ok(P(`(()=>{const s=player3DPose(player),m=aimLaserMuzzle(player,0),q=s.sockets.muzzle;
      return q&&Math.hypot(q.x+player.x-m.x,q.y+player.y-m.y)<.0001;})()`),stance+' '+weapon+' muzzle equals gameplay origin');
    ok(P(`(()=>{const s=player3DPose(player),p=s.parts.find(p=>p.part==='weapon_primary');
      if(!p)return true;const a=PLAYER3D_ASSET.meshes[p.mesh],v=a.muzzle||[.5,0,0],m=p.matrix,q=s.sockets.muzzle;
      return Math.hypot(m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+m[12]-q.x,
       m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13]-q.y)<.001;})()`),stance+' '+weapon+' visible muzzle vertex matches socket');
  }
}
probe("resetActorStance(player,'STAND');player.currentWeapon=WEAPONS.PISTOL;");
for (const outfit of ['explosiveArmorUnlocked','chemistSuitUnlocked','ninjaSuitUnlocked','cowboySuitEquipped','jetpackUnlocked']) {
  probe(outfit+'=true;'); valid(outfit);probe(outfit+'=false;');
}
probe('cowboySuitEquipped=true;');
function gearSpan(tag,max){return P(`(()=>{const p=player3DPose(player).parts.find(p=>p.part===${JSON.stringify(tag)}),m=p.matrix,a=PLAYER3D_ASSET.meshes[p.mesh].positions;
 let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
 for(let i=0;i<a.length;i+=3){const x=m[0]*a[i]+m[4]*a[i+1]+m[8]*a[i+2],y=m[1]*a[i]+m[5]*a[i+1]+m[9]*a[i+2];
 x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 return x1-x0<${max}&&y1-y0<${max};})()`);}
ok(gearSpan('headwear',30),'cowboy hat retains character-scale proportions');
probe('cowboySuitEquipped=false;player.currentWeapon=WEAPONS.BOW;');
ok(gearSpan('weapon_primary',70),'bow retains character-scale proportions');
probe("player.currentWeapon=WEAPONS.PISTOL;boxingEnter(player,[],'WORLD');");
valid('boxing');
probe('boxingExit(player);');
const before=P('JSON.stringify(player)');
const first=P('JSON.stringify(player3DPose(player))');
for(let i=0;i<4;i++) P('player3DPose(player)');
ok(P('JSON.stringify(player)')===before, 'pose queries do not advance or mutate the player');
ok(P('JSON.stringify(player3DPose(player))')===first, 'repeated pose queries are deterministic');
probe('player.aimAngle+=.7;');
ok(P('JSON.stringify(player3DPose(player))')!==first, 'same-frame aim changes are observed');
ok(P('typeof Player3D!=="undefined" && Player3D.enabled===true'), '3D is enabled by default');
ok(P('Player3D.draw(player3DPose(player),null)===false'), 'unavailable target returns native fallback');
console.log(checks + ' player 3D asset, pose, purity and fallback checks passed');

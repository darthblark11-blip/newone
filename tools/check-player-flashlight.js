// The player's flashlight is body-mounted and follows the surface night,
// while the permanently dark Level 9 keeps the same carried light at noon.
// Exercise the shared gather and both native light consumers.
const assert = require('node:assert/strict');
const {ctx, probe} = require('./harness');
const P = code => probe('(' + code + ')');
let checks = 0;
const ok = (label, value) => { assert.ok(value, label); checks++; };
const near = (a, b) => Math.abs(a - b) < 1e-8;
function hour(value) { probe(`worldTimeMs=DAY_MS*${value}/24;updateSunVector();`); }
function light() { return P('sceneEmitters().find(l=>l.playerFlashlight)||null'); }
function fresh() {
  probe(`currentLevel=currentBiome=2;BIOME_ACTIVE=true;frameCount=110;started=doTick=true;
    isPaused=isDead=isWin=killcamMode=false;inStoryIntro=inStoryRoom=false;
    authoredCore=authoredMask=authoredChunks=null;activeBuildings=[];activeParkingCars=[];
    enemiesList=[];allies=[];fires=[];player=new Character(100,200,true);
    player.hp=100;player.dead=false;player.aimAngle=0;player.muzzleFlash=0;
    player.currentWeapon=WEAPONS.PISTOL;player.isArmed=true;setMeleeTool('NONE');
    viewLeft=viewTop=-10000;viewRight=viewBottom=10000;camX=camY=0;zoom=1;
    GLRig.lightTier=0;GLRig.ms=16;_emitFrame=-1;resetActorStance(player);`);
  hour(0);
}

fresh();
for (const [h, expected] of [[0,true],[5.999,true],[6,false],[12,false],[17.999,false],
    [18,true],[23.999,true],[24,true],[30,false],[42,true],[-1,true],[-18,false]]) {
  hour(h);
  ok('surface flashlight follows the strict 18:00–06:00 night at ' + h + 'h',
    P('playerFlashlightEnabled()') === expected && !!light() === expected);
}
hour(0);
const mounted = light();
ok('the carried beam uses the Level 9 body mount and bearer clearance',
  mounted && near(mounted.x,118) && near(mounted.y,200) && mounted.z===24 && mounted.rMin===40);
ok('the body beam keeps the Level 9 cone, spill and light power',
  mounted.r===460 && mounted.p===.98 && mounted.spill===.45 && mounted.spillR===42 &&
  near(mounted.half,P('TORCH_OUTER')) && near(mounted.inner,P('TORCH_INNER')) &&
  mounted.fix===null && JSON.stringify(mounted.c)===JSON.stringify([.94,.97,1]));
ok('one player beam owns the first emitter slot',
  P('sceneEmitters().filter(l=>l.playerFlashlight).length===1&&sceneEmitters()[0].playerFlashlight&&sceneEmitters()[0].d2===-1'));

for (const key of ['PISTOL','REVOLVER','SHOTGUN','COACH_GUN','BOW','PARTICLE_BEAM','TASER']) {
  probe(`player.currentWeapon=WEAPONS.${key};frameCount++;`);
  const value = light();
  ok(key + ' does not move or remove the body flashlight',
    value && near(value.x,mounted.x) && near(value.y,mounted.y) && value.z===mounted.z);
}
probe('player.isArmed=false;setMeleeTool("SHOVEL");frameCount++;');
ok('the holstered shovel retains the same body flashlight', near(light().x,118) && near(light().y,200));
probe('setMeleeTool("NONE");player.currentWeapon=null;frameCount++;');
ok('an empty gun selection does not remove a carried body flashlight', !!light());
probe('player.currentWeapon=WEAPONS.PARTICLE_BEAM;player.isArmed=true;player.isMoving=true;player.walkCycle=Math.PI/2;');
for (const stance of ['STAND','CROUCH','PRONE']) {
  probe(`resetActorStance(player,'${stance}');frameCount++;`);
  const value = light();
  ok(stance + ' and the weapon gait cannot drag the body mount onto a muzzle',
    value && near(value.x,118) && near(value.y,200) && value.z===24 && near(value.aim,0));
}
for (const angle of [0,Math.PI/2,Math.PI,-Math.PI/2,2.19]) {
  probe(`player.aimAngle=${angle};frameCount++;`);
  const value = light();
  ok('the carried beam follows body facing at ' + angle,
    value && near(value.x,100+Math.cos(angle)*18) && near(value.y,200+Math.sin(angle)*18) && near(value.aim,angle));
}

// Same-frame transitions must not reuse the list gathered for another hour,
// scene type or alive state. No manual _emitFrame reset is used here.
hour(12);
ok('changing to daytime in the same frame removes the beam', light()===null);
hour(0);
ok('changing to night in the same frame restores the beam', !!light());
probe('player.dead=true;');
ok('a dead player cannot retain a cached flashlight', light()===null);
probe('player.dead=false;player.hp=0;');
ok('zero health cannot retain a cached flashlight', light()===null);
probe('player.hp=100;');
ok('a respawn can regain the beam in the same frame', !!light());
probe('BIOME_ACTIVE=false;');
ok('an unlit legacy surface interior cannot reuse a streamed biome beam', light()===null);
hour(12);probe('currentLevel=currentBiome=9;');
ok('Level 9 remains lit by a carried body beam at surface noon',
  !!light() && light().undergroundFlashlight===true && P('sceneLightDaylight()===0'));
hour(0);
const cave = light();
ok('surface time does not move or dim the underground body mount',
  cave && cave.p===.98 && cave.z===24 && cave.rMin===40);
hour(12);probe('currentLevel=currentBiome=2;BIOME_ACTIVE=true;');
ok('leaving the cave at noon removes its cached flashlight immediately', light()===null);

fresh();
probe(`__enemy=new Character(400,500,false,'NORMAL');__enemy.hp=100;__enemy.aimAngle=.7;
  __enemy.currentWeapon=WEAPONS.PISTOL;__enemy.muzzleFlash=3;enemiesList=[__enemy];
  player.muzzleFlash=3;
  for(let i=0;i<24;i++)activeBuildings.push({x:100+i*12,y:200,w:16,h:16,isStreetLight:true});
  frameCount++;`);
ok('a crowded street still spends its first light slot on the carried beam',
  P('sceneEmitters()[0].playerFlashlight&&sceneEmitters().filter(l=>l.playerFlashlight).length===1'));
probe('__firstBeam=sceneEmitters()[0];__oldBudget=glRigLightBudget;glRigLightBudget=function(){return 1;};');
ok('the native GPU gather keeps the same first shared body emitter',
  P('glRigGatherLights().length===1&&glRigGatherLights()[0]===__firstBeam'));
probe('glRigLightBudget=__oldBudget;');
hour(12);
ok('daytime disables only the flashlight while gun flashes and fixed lamps survive',
  P('!sceneEmitters().some(l=>l.playerFlashlight)&&sceneEmitters().some(l=>l.fix==="LAMP")&&sceneEmitters().filter(l=>l.d2<0&&l.aim===undefined).length===2'));
probe('__enemyMuzzle=weaponLightMuzzle(__enemy,WEAPON_MUZZLE.PISTOL);');
const muzzle = P('__enemyMuzzle');
ok('enemy gunfire retains its moving weapon muzzle emitter',
  P(`sceneEmitters().some(l=>l.aim===undefined&&l.d2<0&&Math.abs(l.x-${muzzle.x})<1e-8&&Math.abs(l.y-${muzzle.y})<1e-8)`));

// Both renderers consume the common source instead of choosing their own
// flashlight position. Record the actual Canvas fallback addLight call.
fresh();
probe('__nativeAddLight=addLight;__canvasLights=[];addLight=function(buf,x,y,r,p,aim,half,spill,spillRatio){__canvasLights.push({x,y,r,p,aim,half,spill,spillRatio});};drawLightPass();addLight=__nativeAddLight;');
const canvas = P('__canvasLights');
ok('the Canvas fallback paints exactly one body flashlight', canvas.length===1);
ok('the Canvas beam starts at the same body point as the shared/GPU emitter',
  near(canvas[0].x,118*P('LIGHT_W/width')) && near(canvas[0].y,200*P('LIGHT_W/width')) &&
  canvas[0].p===.98 && canvas[0].aim===0 && canvas[0].spill===.45);
hour(12);
probe('__canvasLights=[];addLight=function(){__canvasLights.push(true);};drawLightPass();addLight=__nativeAddLight;');
ok('the daytime Canvas fallback cannot leave an old carried beam on screen', P('__canvasLights.length===0'));

console.log(`${checks}/${checks} body flashlight night, mount, ownership, cache and renderer checks passed.`);

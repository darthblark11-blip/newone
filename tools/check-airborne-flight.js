// Exercise the actual flyer AI and ballistics: roofs may be crossed, but are
// never a safe place for an airborne enemy to stop and attack from cover.
const { ctx, probe } = require('./harness.js');
const P = expression => probe('(' + expression + ')');
let checks = 0, failures = 0;
const ok = (name, condition, detail) => {
  checks++;
  if (!condition) {
    failures++;
    console.log('FAIL ' + name + (detail === undefined ? '' : ': ' + JSON.stringify(detail)));
  }
};
let seed = 2928173;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const n = seed / 4294967296;
  return a === undefined ? n : Array.isArray(a) ? a[Math.floor(n * a.length)] : b === undefined ? n * a : a + n * (b - a);
};
probe(`isStoryMode=false;townsData={};startAtLevel(3);started=true;doTick=true;
  viewLeft=-10000;viewRight=10000;viewTop=-10000;viewBottom=10000;`);

const types = ['AERIAL', 'AERIAL_PISTOL', 'SAUCER', 'SAUCER_RED'];
function fixture(type, roofs, start, target) {
  ctx.__testRoofs = roofs;
  probe(`currentLevel=3;currentBiome=3;nm0AmbushActive=false;isHardMode=false;
    buildings=window.__testRoofs;activeBuildings=buildings.slice();invalidateColIndex();buildColIndex();
    enemiesList=[];bullets=[];grenades=[];particles=[];barrels=[];corpses=[];townCitizens=[];
    player=new Character(${target.x},${target.y},true);player.hp=100;player.dead=false;
    window.__flight=new Character(${start.x},${start.y},false,${JSON.stringify(type)});
    window.__flight.state='CHASE';window.__flight.loseSightTimer=3500;
    window.__flight.aiOffset=0;window.__flight.strafeDir=1;
    enemiesList.push(window.__flight);`);
}
function run(ticks) {
  return P(`(() => {
    const e=window.__flight;let roofTicks=0, stationaryRoofTicks=0, roofAttacks=0, firstOpen=-1, openTail=0;
    for(let i=0;i<${ticks};i++) {
      frameCount++;const x=e.x,y=e.y;
      const shots=bullets.length, bombs=grenades.length;
      e.updateEnemy();
      const overRoof=!airbornePositionOpen(e.x,e.y,0);
      if(overRoof) {
        roofTicks++;
        if(Math.hypot(e.x-x,e.y-y)<0.01)stationaryRoofTicks++;
        if(bullets.length>shots||grenades.length>bombs)roofAttacks++;
        openTail=0;
      } else {if(firstOpen<0)firstOpen=i;openTail++;}
      bullets.length=0;grenades.length=0;particles.length=0;
    }
    const t=e.aggroTarget&&e.aggroTarget.hp>0&&!e.aggroTarget.dead?e.aggroTarget:player;
    return {x:e.x,y:e.y,roofTicks,stationaryRoofTicks,roofAttacks,firstOpen,openTail,
      open:airbornePositionOpen(e.x,e.y),clear:airborneReturnFireClear(t,e.x,e.y),
      distance:Math.hypot(e.x-t.x,e.y-t.y)};
  })()`);
}
function actualShot(source, weapon = 'PISTOL') {
  return P(`(() => {
    const e=window.__flight,oldHp=e.hp;
    bullets.length=0;grenades.length=0;particles.length=0;
    const shooter=${source === 'ally' ? "new Character(player.x,player.y,false,'NORMAL')" : 'player'};
    shooter.isFriendly=true;shooter.isNeutral=false;
    const angle=Math.atan2(e.y-shooter.y,e.x-shooter.x);
    const oldRandom=random,oldHeadAim=headAimToggle;
    let shots;
    try {
      random=(a,b)=>a===undefined?0.5:Array.isArray(a)?a[0]:b===undefined?a*0.5:(a+b)/2;
      headAimToggle=false;shooter.aimAngle=angle;shooter.isMoving=false;
      shooter.currentWeapon=WEAPONS.${weapon};shooter.ammo=shooter.currentWeapon.maxAmmo;
      shooter.fire(angle);shots=bullets.slice();
      for(let i=0;i<100&&shots.some(b=>b.active);i++){frameCount++;updateBullets();}
    } finally {random=oldRandom;headAimToggle=oldHeadAim;}
    return {damage:oldHp-e.hp,active:shots.some(b=>b.active),x:shots[0].x,y:shots[0].y,
      rounds:shots.map(b=>({x:b.x,y:b.y,startX:b.startX,startY:b.startY,active:b.active}))};
  })()`);
}

for (const type of types) {
  fixture(type, [{x:0,y:0,w:280,h:240}], {x:0,y:0}, {x:400,y:0});
  ok(type + ' is classified as airborne', P('isAirborneEnemy(window.__flight)'));
  const small = run(420);
  ok(type + ' escapes a roof beneath its starting position', small.open, small);
  ok(type + ' never hovers or attacks while inside the roof', small.stationaryRoofTicks === 0 && small.roofAttacks === 0, small);
  ok(type + ' engages from a bullet-clear street', small.clear && small.distance < 600, small);
  ok(type + ' can be hit by a player round after leaving cover', actualShot('player').damage > 0);
  ok(type + ' can be hit by an ally round after leaving cover', actualShot('ally').damage > 0);

  fixture(type, [{x:0,y:0,w:200,h:200}], {x:-300,y:104}, {x:300,y:104});
  ok(type + ' recognizes that a clear centerline can hide the actual muzzle ray', P('airborneClearShot(player.x,player.y,window.__flight.x,window.__flight.y)') && !P('airborneReturnFireClear(player,window.__flight.x,window.__flight.y)'));
  const edgeBlocked = actualShot('player');
  ok(type + ' real player muzzle is blocked before replanning the roof edge', edgeBlocked.damage === 0 && !edgeBlocked.active, edgeBlocked);
  const edge = run(400);
  ok(type + ' moves to a station clear of the player muzzle near a roof edge', edge.open && P('airborneReturnFireClear(player,window.__flight.x,window.__flight.y)'), edge);
  ok(type + ' real player fire hits after replanning the roof edge', actualShot('player').damage > 0);

  fixture(type, [{x:0,y:0,w:200,h:200}], {x:-300,y:104}, {x:300,y:104});
  probe(`window.__edgeAlly=new Character(player.x,player.y,false,'NORMAL');window.__edgeAlly.isFriendly=true;
    window.__flight.aggroTarget=window.__edgeAlly;window.__flight.aggroTimer=9999;enemiesList.push(window.__edgeAlly);`);
  run(400);
  ok(type + ' clears the aggro ally muzzle ray near the roof edge', P('airborneReturnFireClear(window.__edgeAlly,window.__flight.x,window.__flight.y)'));
  ok(type + ' real ally fire hits after replanning the roof edge', actualShot('ally').damage > 0);

  fixture(type, [{x:0,y:0,w:200,h:200}], {x:-300,y:104}, {x:300,y:104});
  probe('player.currentWeapon=WEAPONS.DUAL_SMG;');
  ok(type + ' rejects a dual-gun lane when only one muzzle clears the roof', !P('airborneReturnFireClear(player,window.__flight.x,window.__flight.y)'));
  const partialDual = actualShot('player', 'DUAL_SMG');
  ok(type + ' real dual-gun edge shot confirms one barrel is obstructed', partialDual.damage > 0 && partialDual.rounds.filter(b => Math.hypot(b.x+300,b.y-104) < 55).length === 1, partialDual);
  const dualEdge = run(400);
  ok(type + ' clears both actual dual-gun muzzle rays at its new station', dualEdge.open && P('airborneReturnFireClear(player,window.__flight.x,window.__flight.y)'), dualEdge);
  const dualHit = actualShot('player', 'DUAL_SMG');
  const targetPoint = P('({x:window.__flight.x,y:window.__flight.y})');
  ok(type + ' both real dual-gun rounds reach the flyer after roof-edge replanning', dualHit.damage > 0 && dualHit.rounds.length === 2 && dualHit.rounds.every(b => Math.hypot(b.x-targetPoint.x,b.y-targetPoint.y) < 55), dualHit);

  fixture(type, [{x:0,y:0,w:600,h:360}], {x:-750,y:0}, {x:500,y:0});
  const crossing = run(750);
  ok(type + ' may traverse above a roof without ground collision', small.roofTicks > 0 && P('!window.__flight.checkCol(0,0)'), crossing);
  ok(type + ' crosses without stopping or firing inside the roof', crossing.stationaryRoofTicks === 0 && crossing.roofAttacks === 0, crossing);
  ok(type + ' finishes roof transit in a clear engagement lane', crossing.open && crossing.clear && crossing.openTail > 60, crossing);

  fixture(type, [{x:0,y:0,w:1800,h:1300}], {x:0,y:0}, {x:1250,y:0});
  const large = run(1100);
  ok(type + ' leaves the center of a large roof', large.open && large.clear, large);
  ok(type + ' keeps moving until it leaves the large roof', large.stationaryRoofTicks === 0 && large.roofAttacks === 0, large);

  fixture(type, [{x:-80,y:0,w:400,h:300},{x:150,y:100,w:420,h:400}], {x:0,y:0}, {x:650,y:0});
  const overlapping = run(600);
  ok(type + ' leaves overlapping roof volumes', overlapping.open && overlapping.clear && overlapping.openTail > 60, overlapping);
  ok(type + ' does not settle in the neighboring roof', overlapping.stationaryRoofTicks === 0 && overlapping.roofAttacks === 0, overlapping);

  fixture(type, [{x:300,y:0,w:160,h:700}], {x:600,y:0}, {x:0,y:0});
  const occluded = run(650);
  ok(type + ' moves out of cover when a wall blocks return fire', occluded.open && occluded.clear, occluded);
  probe('player.x=600;player.y=-450;');
  const moving = run(450);
  ok(type + ' replans after the player moves behind a wall', moving.open && moving.clear && moving.distance < 650, moving);

  fixture(type, [{x:0,y:0,w:450,h:400}], {x:0,y:0}, {x:800,y:0});
  probe(`window.__ally=new Character(-450,0,false,'NORMAL');window.__ally.isFriendly=true;
    window.__flight.aggroTarget=window.__ally;window.__flight.aggroTimer=9999;enemiesList.push(window.__ally);`);
  const allyTarget = run(500);
  ok(type + ' leaves its roof and acquires a clear lane toward an aggro ally', allyTarget.open && allyTarget.clear && allyTarget.distance < 600, allyTarget);
  ok(type + ' retains the live ally as its combat target', P('window.__flight.aggroTarget===window.__ally'));
  probe('window.__ally.hp=0;window.__ally.dead=true;');
  const fallenAlly = run(600);
  ok(type + ' reacquires the player when its ally target dies', fallenAlly.open && fallenAlly.clear && P('!window.__flight.airborneStation || window.__flight.airborneStation.target===player'), fallenAlly);

  fixture(type, [{x:0,y:0,w:1600,h:1100}], {x:0,y:0}, {x:1150,y:0});
  probe(`frameCount++;window.__flight.updateEnemy();
    window.__oldStation=window.__flight.airborneStation;
    if(window.__oldStation)buildings.push({x:window.__oldStation.x,y:window.__oldStation.y,w:220,h:220});
    activeBuildings=buildings.slice();invalidateColIndex();buildColIndex();`);
  const blockedStation = run(1000);
  ok(type + ' invalidates a station that becomes obstructed', P('window.__oldStation !== window.__flight.airborneStation') && blockedStation.open && blockedStation.clear, blockedStation);

  // A round fired through a roof must still collide with the building. The
  // counterplay is moving the flyer into a clear lane, not shooting through it.
  fixture(type, [{x:0,y:0,w:300,h:300}], {x:0,y:0}, {x:-500,y:0});
  const blocked = actualShot('player');
  ok(type + ' remains protected only during roof transit', blocked.damage === 0 && !blocked.active && blocked.x < -100, blocked);

  fixture(type, [], {x:600,y:0}, {x:5000,y:0});
  const terrain = P(`(() => {
    const e=window.__flight,oldElevation=elevSpeedFactor;let terrainProbes=0;
    try {
      elevSpeedFactor=()=>{terrainProbes++;return 0.9;};
      activeBuildings=[{x:0,y:0,w:10000,h:10000,isPond:true}];invalidateColIndex();
      e.state='PATROL';e.patrolTimer=999;e.patrolCorner=0;
      e.targetBuilding={x:0,y:0,w:200,h:200};e.cachedTargetDist=5000;e.cachedCanSee=false;
      frameCount=6;const x=e.x,y=e.y;e.updateEnemy();
      return {distance:Math.hypot(e.x-x,e.y-y),terrainProbes,
        splashes:particles.filter(p=>p.t==='SPARK').length};
    } finally {elevSpeedFactor=oldElevation;}
  })()`);
  const patrolSpeed = 1.4 * (type === 'AERIAL' ? 1.25 : 1.47);
  ok(type + ' patrol flight ignores terrain elevation and wading slowdown', Math.abs(terrain.distance-patrolSpeed) < 0.0001 && terrain.terrainProbes === 0, terrain);
  ok(type + ' patrol flight makes no wading splash particles', terrain.splashes === 0, terrain);
}

for (const weapon of ['PISTOL', 'SMG', 'DUAL_SMG', 'ASSAULT_RIFLE', 'SHOTGUN', 'ROCKET_LAUNCHER', 'TASER']) {
  fixture('SAUCER', [{x:0,y:0,w:200,h:200}], {x:-300,y:104}, {x:300,y:104});
  probe(`player.currentWeapon=WEAPONS.${weapon};`);
  ok(weapon + ' muzzle geometry rejects a grazing roof corner', !P('airborneReturnFireClear(player,window.__flight.x,window.__flight.y)'));
  probe('player.y=122;window.__flight.y=122;');
  ok(weapon + ' muzzle geometry admits sufficient roof-edge clearance', P('airborneReturnFireClear(player,window.__flight.x,window.__flight.y)'));
  if (['PISTOL', 'SMG', 'DUAL_SMG', 'ASSAULT_RIFLE'].includes(weapon)) {
    const shot = actualShot('player', weapon);
    ok(weapon + ' real firing path reaches the flyer with roof-edge clearance', shot.damage > 0, shot);
  }
}

fixture('AERIAL', [{x:0,y:0,w:200,h:200}], {x:400,y:0}, {x:-400,y:0});
ok('ordinary ground actors do not enter the airborne layer', !P("isAirborneEnemy(new Character(0,0,false,'NORMAL'))"));
ok('the player does not become an airborne enemy', !P("isAirborneEnemy(new Character(0,0,true,'AERIAL'))"));
probe('window.__flight.hp=0;window.__flight.dead=true;');
ok('dead flyers leave the airborne layer', !P('isAirborneEnemy(window.__flight)'));
ok('exact lane geometry rejects a thin intervening wall', !P('airborneClearShot(-300,99,300,99)'));
ok('exact lane geometry allows an unobstructed parallel shot', P('airborneClearShot(-300,110,300,110)'));

probe(`currentLevel=1;currentBiome=1;window.southGateBreachedStatus=false;window.towersDefeated=false;
  townsData={};window.nm0AmbushClearedStatus=false;
  buildings=[{x:0,y:200,w:1800,h:100,isGovFortress:true}];activeBuildings=buildings.slice();invalidateColIndex();`);
ok('a closed gate blocks an airborne firing lane', !P('airborneClearShot(0,0,0,400)'));
probe('window.southGateBreachedStatus=true;');
ok('an open gateway admits an airborne firing lane', P('airborneClearShot(0,0,0,400)'));
ok('an open gate keeps its side walls bullet-solid', !P('airborneClearShot(600,0,600,400)'));
ok('an open gate admits a clear stopping point in its doorway', P('airbornePositionOpen(0,200,40)'));
ok('an open gate disallows camping over a side wall', !P('airbornePositionOpen(600,200,40)'));

console.log(`${checks} checks, ${failures} failures`);
process.exitCode = failures ? 1 : 0;

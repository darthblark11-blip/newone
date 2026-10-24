// Exercise the real duel projectiles and native corpse art rather than calling
// the death helper directly. Cosmetic succession must never award town kills.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let count = 0, now = 9000, seed = 13;
ctx.millis = () => now;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const u = seed / 4294967296;
  if (a === undefined) return u;
  if (b === undefined) return Array.isArray(a) ? a[Math.floor(u * a.length)] : u * a;
  return a + u * (b - a);
};
const run = code => probe(code);
function check(code, label) { assert.ok(run(code), label); count++; }
function tick(n = 1) {
  for (let i = 0; i < n; i++) {
    ctx.frameCount++; ctx.deltaTime = 16.67; now += 16.67;
    run('updateFrontierSaloonActivity();');
  }
}
function cue() {
  check('startFrontierQuickDraw()', 'A real rematch starts');
  run('_frontierSaloonSession.duel.remainingMs=1;'); tick();
  check('_frontierSaloonSession.duel.phase===\'DRAW\'', 'The timer opens the draw window');
}
// Aim the visible muzzle, including its offset, at the target center. This is
// a test aim assist; rounds still use finite native Bullet flight/contact.
function aim(opposing = false) {
  run(`(()=>{const actor=${opposing ? '_frontierSaloonSession.opponent' : 'player'},
    target=${opposing ? 'player' : '_frontierSaloonSession.opponent'};
    actor.aimAngle=atan2(target.y-actor.y,target.x-actor.x);
    for(let i=0;i<12;i++){const m=frontierQuickDrawMuzzle(actor);actor.aimAngle=atan2(target.y-m.y,target.x-m.x);}
  })();`);
}
function fire() {
  const b = run('frontierSaloonButtons().find(b=>b.action===\'FIRE\')');
  assert.ok(b, 'The native FIRE control is visible'); count++;
  run(`handleFrontierSaloonTap(${b.x + b.w / 2},${b.y + b.h / 2});`);
  check('_frontierSaloonSession.duel.projectiles.length===1', 'FIRE launches a finite round before awarding a result');
}
function impact(won) {
  let n = 0;
  while (n++ < 220 && run('_frontierSaloonSession.duel.phase!==\'RESULT\'')) tick();
  check(`_frontierSaloonSession.duel.phase==='RESULT'&&_frontierSaloonSession.duel.won===${won}`, 'Actual projectile impact determines the result');
}
run(`leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
 isStoryMode=false;resetStoryProgress();startAtLevel(3);
 started=true;isPaused=isDead=isWin=killcamMode=false;doTick=true;
 inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inWorldBuildingMenu=inOverworldView=inTravelMenu=inStoryIntro=inDarchonCall=false;
 player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;enterFrontierSaloon();
 headshotCounter=2;frontierSaloonProgress.duelWon=true;score=300;
 var duelOutside={enemies:enemiesList.slice(),corpses:corpses.slice(),particles:particles.slice(),bullets:bullets.slice(),
   pools:bloodPools.slice(),kills:totalKills,streak:killStreak,consecutive:consecutiveKills,flawless:flawlessHits,
   shots:totalShotsFired,hits:totalShotsHit,score,body:bodyOverkillCounter,lightning:lightningCounter,sword:swordKillCounter,
   time:worldTimeMs,ammo:JSON.stringify(player.weaponAmmo),mags:JSON.stringify(player.mags)};`);
function isolated() {
  check(`totalKills===duelOutside.kills&&killStreak===duelOutside.streak&&consecutiveKills===duelOutside.consecutive&&
    flawlessHits===duelOutside.flawless&&score===duelOutside.score&&totalShotsFired===duelOutside.shots&&
    totalShotsHit===duelOutside.hits&&bodyOverkillCounter===duelOutside.body&&lightningCounter===duelOutside.lightning&&
    swordKillCounter===duelOutside.sword&&!isDead&&!killcamMode&&worldTimeMs===duelOutside.time`,
    'Duel animation changes never affect campaign credit, other variant counters, spawns or world time');
  check(`['enemies','corpses','particles','bullets','pools'].every((key,i)=>{const a=[enemiesList,corpses,particles,bullets,bloodPools][i];
    return a.length===duelOutside[key].length&&a.every((v,j)=>v===duelOutside[key][j]);})&&
    JSON.stringify(player.weaponAmmo)===duelOutside.ammo&&JSON.stringify(player.mags)===duelOutside.mags`,
    'Corpses, particles, pools, bullets, actors and ammunition remain local to the activity');
}
for (const [i, expected] of [9, 1, 8, 9, 1, 8].entries()) {
  const before = run('headshotCounter'); cue();
  check(`headshotCounter===${before}`, 'Starting a farther/faster rematch preserves the cosmetic counter');
  aim(); run('headAimToggle=true;'); fire();
  check('_frontierSaloonSession.duel.projectiles[0].tH===\'HEAD\'', 'The real head aim toggle is carried by the round');
  if (i === 2) {
    run('isPaused=true;openPauseSettings();pauseMenuState="GAMEPAD_CONTROLS";setGamepadControlSetting("shooting","R2");var pausedFlight=JSON.stringify(_frontierSaloonSession.duel.projectiles.map(b=>[b.x,b.y,b.l]));');
    tick(30);
    check(`headshotCounter===${before}&&JSON.stringify(_frontierSaloonSession.duel.projectiles.map(b=>[b.x,b.y,b.l]))===pausedFlight`,
      'Pause and a controls change freeze the live shot without resetting or consuming a headshot');
    run('resumeFromPause();');
  }
  impact(true);
  check(`_frontierSaloonSession.duel.opponentCorpse instanceof Corpse&&_frontierSaloonSession.duel.opponentCorpse.dT===${expected}&&headshotCounter===${before + 1}`,
    'A confirmed headshot selects the next native revolver variant and increments exactly once');
  run('drawFrontierSaloonScene();'); count++;
  if (expected === 9) {
    run('var fragmentsBefore=JSON.stringify(_frontierSaloonSession.duel.opponentCorpse.bits.map(b=>[b.x,b.y,b.rot]));'); tick(12);
    check('_frontierSaloonSession.duel.opponentCorpse.bits.length===9&&JSON.stringify(_frontierSaloonSession.duel.opponentCorpse.bits.map(b=>[b.x,b.y,b.rot]))!==fragmentsBefore',
      'The native fragment headshot actually animates its detached pieces');
  }
  if (expected === 8) {
    tick(16);
    check('_frontierSaloonSession.duel.opponentCorpse.sep===35', 'The native split headshot reaches its normal separation');
  }
  tick(240);
  check(`headshotCounter===${before + 1}&&_frontierSaloonSession.duel.opponentCorpse.stopMotionTimer===0`, 'Result/settling frames never advance succession and finish the local corpse clock');
  check('_frontierSaloonSession.duel.opponentCorpse.bits.every(b=>b.vx===0&&b.vy===0&&b.vr===0)', 'Detached head pieces come to rest');
  isolated();
}
run('var beforeNonHead=headshotCounter;'); cue(); aim(); run('headAimToggle=false;'); fire(); impact(true);
check('_frontierSaloonSession.duel.opponentCorpse.dT===0&&headshotCounter===beforeNonHead', 'A body kill retains its native fall without consuming the headshot sequence');
cue(); run('headAimToggle=true;player.aimAngle=HALF_PI;'); fire(); tick(10);
check('headshotCounter===beforeNonHead&&_frontierSaloonSession.duel.phase===\'DRAW\'', 'An aimed headshot that misses cannot consume a death variant');
impact(false);
check('_frontierSaloonSession.duel.playerCorpse.dT===0&&headshotCounter===beforeNonHead&&!player.dead', 'An opponent body kill remains a local body death');
cue(); aim(true);
run('frontierQuickDrawSpawnRound(_frontierSaloonSession.opponent,false,true);'); impact(false);
check('headshotCounter===beforeNonHead+1&&_frontierSaloonSession.duel.playerCorpse.dT===[1,8,9][beforeNonHead%3]&&!player.dead',
  'A real opponent headshot uses the same succession for the player without campaign death');
isolated();
run('var beforeFalseStart=headshotCounter;startFrontierQuickDraw();frontierSaloonFire();');
check('_frontierSaloonSession.duel.result===\'FALSE START\'&&headshotCounter===beforeFalseStart', 'A false start consumes no headshot death');
run('exitFrontierSaloon();player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;enterFrontierSaloon();');
cue(); aim(); run('headAimToggle=true;'); fire(); impact(true);
check('headshotCounter===beforeFalseStart+1&&_frontierSaloonSession.duel.opponentCorpse.dT===[1,8,9][beforeFalseStart%3]', 'Leaving/reentering the activity continues the same native succession');
isolated();
// Mix in an actual outdoor fatal hit: the duel shares only its cosmetic
// counter, so the next normal kill continues exactly where it left off.
run(`exitFrontierSaloon();var beforeOutdoorHead=headshotCounter;MAX_KILLS=totalKills;bullets=[];corpses=[];activeBuildings=[];
 buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;var nativeVictim=new Character(40,0,false,'NORMAL');
 nativeVictim.hp=1;nativeVictim.isFriendly=nativeVictim.isNeutral=false;enemiesList=[nativeVictim];
 spawnBullet(0,0,0,true,'HEAD',WEAPONS.REVOLVER,player);
 for(let i=0;i<5&&corpses.length===0;i++)updateBullets();`);
check('corpses.length===1&&corpses[0].dT===[1,8,9][beforeOutdoorHead%3]&&headshotCounter===beforeOutdoorHead+1',
  'The next actual outdoor revolver headshot continues the sequence rather than restarting it');
console.log('Frontier duel death succession: '+count+' checks passed.');

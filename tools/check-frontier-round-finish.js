// Directed real-contact fixtures: force one-hit health only to examine every
// finishing hand/height. Strikes, contacts, falls and recovery use scene input
// and the normal solver; no knockout or wave-clear seam is called directly.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let checks = 0, now = 7000;
ctx.millis = () => now;
const keys = new Set();
ctx.keyIsDown = code => keys.has(code);
function run(code) { return probe(code); }
function check(code, label) { assert.ok(run(code), label); checks++; }
function tick(n = 1) {
  for (let i = 0; i < n; i++) {
    now += 16.67; ctx.deltaTime = 16.67; run('updateFrontierSaloonActivity();');
  }
}
run(`leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
 isStoryMode=false;resetStoryProgress();startAtLevel(3);started=true;
 isPaused=isDead=isWin=killcamMode=false;
 inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inStoryIntro=inDarchonCall=inWorldBuildingMenu=inOverworldView=inTravelMenu=false;
 var roundOutside={hp:player.hp,score,kills:totalKills,clock:worldTimeMs,corpses:corpses.length,
  enemies:enemiesList.length,bullets:bullets.length,particles:particles.length};
 var roundContacts=[],roundHitOriginal=frontierSaloonBoxingHit;
 frontierSaloonBoxingHit=function(e){roundContacts.push({kind:e.kind,level:e.level,outcome:e.outcome});return roundHitOriginal(e);};`);
function begin(kind, level, angle, wave = 1) {
  keys.clear(); ctx.touches = [];
  run(`if(_frontierSaloonSession)exitFrontierSaloon();
   player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;
   enterFrontierSaloon();startFrontierSaloonBrawl();
   if(${wave}>1)frontierSaloonStartWave(_frontierSaloonSession,${wave},true);
   var roundRig=player._boxing,roundFoe=_frontierSaloonSession.fighters[0];
   _frontierSaloonSession.fighters=[roundFoe];roundFoe.boxingSkill='ROOKIE';
   roundFoe.x=player.x+Math.cos(${angle})*40.5;roundFoe.y=player.y+Math.sin(${angle})*40.5;
   roundFoe.hp=1;roundFoe._boxing.enemyRestMs=1e9;
   roundRig.director={clock:0,nextAttackMs:1e9,turn:0};roundContacts=[];`);
  const code = {LEFT_STRAIGHT:69, RIGHT_JAB:82, LEFT_HOOK:81, RIGHT_HOOK:84}[kind];
  keys.add(code); tick(level === 'BODY' ? 14 : 1);
  run('var roundPunchBeforeRelease=player._boxing.punch;');
  keys.clear(); tick();
  run('var roundPunch=player._boxing.punch;');
  let frames = 0;
  while (frames++ < 50 && !run('roundFoe.knockedOut')) tick();
  check(`roundContacts.some(e=>e.kind==='${kind}'&&e.level==='${level}'&&e.outcome==='HIT')&&roundFoe.knockedOut`, kind + ' ' + level + ' wins through physical contact');
  check('_frontierSaloonSession.brawl==="INTERMISSION"&&_frontierSaloonSession.gauntlet.phase==="SETTLE"&&_frontierSaloonSession.gauntlet.finishMs===0', 'The final contact enters a fresh settling interval');
  check('player._boxing===roundRig&&roundRig.punch===roundPunch&&boxingActive(player)&&boxingPose(player).phase==="ACTIVE"', 'The finishing hand retains its active punch and the same boxing model');
  check('roundFoe.stunPose.knockout.ageMs>0&&!roundFoe.stunPose.knockout.settled&&_frontierSaloonToastMs===0', 'The live knockout fall starts before any victory toast');
}
const attacks = ['LEFT_STRAIGHT','RIGHT_JAB','LEFT_HOOK','RIGHT_HOOK'];
for (const level of ['HEAD','BODY']) for (let i = 0; i < attacks.length; i++) {
  begin(attacks[i], level, [0,-Math.PI/2,Math.PI,Math.PI/2][i]);
  const elapsed = run('roundPunch.elapsedMs');
  tick();
  check(`roundRig.punch===roundPunch&&roundPunch.elapsedMs>${elapsed}&&boxingPose(player).extension>0`, 'The winning punch follows through on the next frame');
  let sawRecovery = false, frames = 0;
  while (frames++ < 50 && run('!!roundRig.punch')) {
    sawRecovery ||= run('boxingPose(player).phase==="RECOVERY"');
    tick();
  }
  assert.ok(sawRecovery, 'The finishing strike visibly returns through recovery'); checks++;
  check('!roundRig.punch&&player._boxing===roundRig&&boxingPose(player).active&&boxingPose(player).phase==="READY"', 'Natural punch completion retains the boxing guard pose');
  while (run('_frontierSaloonSession.gauntlet.finishMs<1900')) tick();
  check('_frontierSaloonSession.gauntlet.phase==="SETTLE"&&_frontierSaloonToastMs===0&&roundFoe.stunPose.knockout.settled', 'The fallen body settles while the victory presentation waits two seconds');
  while (run('_frontierSaloonSession.gauntlet.finishMs<2050')) tick();
  check('_frontierSaloonSession.gauntlet.phase==="BREAK"&&_frontierSaloonToastMs>0&&boxingActive(player)', 'The result appears after the physical finish without changing the player model');
  while (run('_frontierSaloonSession.gauntlet.finishMs<2500')) tick();
  check('_frontierSaloonSession.brawl==="INTERMISSION"&&_frontierSaloonSession.gauntlet.wave===1', 'No new attackers arrive before the couple-second post-knockout hold');
  while (run('_frontierSaloonSession.brawl!=="ACTIVE"')) tick();
  check('_frontierSaloonSession.gauntlet.wave===2&&player._boxing===roundRig&&boxingActive(player)&&!roundRig.punch&&_frontierSaloonSession.downFighters.includes(roundFoe)', 'The next wave keeps the same stance and the previous floor body');
}
// Pausing and held controls cannot skip the finish or release a stale strike.
begin('LEFT_HOOK', 'HEAD', 0);
keys.add(69); tick(8);
run('isPaused=true;var roundPaused=JSON.stringify({g:_frontierSaloonSession.gauntlet,punch:roundRig.punch.elapsedMs,fall:roundFoe.stunPose});');
tick(130);
check('JSON.stringify({g:_frontierSaloonSession.gauntlet,punch:roundRig.punch.elapsedMs,fall:roundFoe.stunPose})===roundPaused', 'Pause freezes both the final fist and the articulated knockout');
run('isPaused=false;');
while (run('_frontierSaloonSession.brawl!=="ACTIVE"')) tick();
check('player._boxing===roundRig&&!roundRig.punch&&!roundRig.preparedPunch&&!roundRig.queuedPunch&&!roundRig.comboIntent', 'Holding an attack through intermission cannot queue a new-wave punch');
keys.clear(); tick();
check('!roundRig.punch', 'Releasing the consumed held attack does not fire after the next wave begins');
keys.add(69); tick(); keys.clear(); tick();
check('roundRig.punch&&roundRig.punch.kind==="LEFT_STRAIGHT"', 'A fresh press and release still launches a next-wave punch');

for (const wave of [6,13]) {
  // One passive opponent isolates the last real punch before each authored
  // arena transition. Skill/combo behavior has separate director coverage.
  begin('RIGHT_HOOK', 'BODY', 0, wave);
  tick(150);
  check('_frontierSaloonSession.brawl==="INTERMISSION"&&boxingActive(player)&&roundFoe.stunPose.knockout.settled', 'Arena changes wait for the finishing punch and complete fall');
  while (run('_frontierSaloonSession.brawl!=="TRANSITION"')) tick();
  check(`_frontierSaloonSession.transition.kind==='${wave===6?'TACKLE':'BRIDGE'}'&&player._boxing===roundRig&&boxingActive(player)`, 'The arena cinematic keeps the player boxing rig');
  while (run('_frontierSaloonSession.brawl!=="ACTIVE"')) tick();
  check(`_frontierSaloonSession.gauntlet.wave===${wave+1}&&player._boxing===roundRig&&boxingActive(player)&&!player.knockedOut&&!player.stunPose`, 'The new arena resumes the same live boxing stance');
}
check('player.hp===roundOutside.hp&&score===roundOutside.score&&totalKills===roundOutside.kills&&worldTimeMs===roundOutside.clock&&corpses.length===roundOutside.corpses&&enemiesList.length===roundOutside.enemies&&bullets.length===roundOutside.bullets&&particles.length===roundOutside.particles', 'Finishes and local scene transitions leave campaign health, rewards, time and arrays untouched');
run('exitFrontierSaloon();');
check('!boxingActive(player)&&!player.knockedOut&&!player.stunPose', 'Deliberately leaving the local activity still clears the boxing model');
console.log('Frontier round finish: ' + checks + ' contact, recovery, settling and stance checks passed.');

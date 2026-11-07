// Liberated-sector exploration is gameplay, not a modal map. Replay the
// tower-ambush handoff and use the real touch callbacks after the Directive.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness');
const P = s => probe('(' + s + ')');
let checks = 0, seed = 8221, now = 1000, touchId = 0, slot = null;
ctx.millis = () => now;
ctx.setTimeout = () => 0;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[Math.floor(r * a.length)];
  return b === undefined ? r * a : a + r * (b - a);
};
ctx.localStorage = { getItem: () => slot, setItem: (k, v) => { slot = v; }, removeItem: () => { slot = null; } };
const ok = (label, condition) => { assert.ok(condition, label); checks++; };
function release() { ctx.touches = []; probe('touchEnded();handleTouches();'); }
function press(x, y) {
  const t = { id: ++touchId, x, y };
  ctx.touches.push(t); probe('touchStarted();handleTouches();');
  return t;
}
function tap(x, y) { release(); now += 400; press(x, y); release(); }
function step(n = 1) {
  for (let i = 0; i < n; i++) { now += 1000 / 60; probe('frameCount++;player.updatePlayer();'); }
}
function screen(w, h) {
  ctx.touches = [];
  probe(`width=${w};height=${h};
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
    resetTouchAimSelection(false);`);
}
function aimPoint(zone = 'BODY') {
  const p = P('touchAimSilhouetteLayout()'), s = p.sections.find(s => s.zone === zone);
  return { x: p.centerX, y: s.y + s.h / 2 };
}
function finishTowerAmbush(level) {
  ctx.touches = [];
  probe(`resetRunState();resetStoryProgress();isStoryMode=true;startAtLevel(${level});
    inStoryIntro=inStoryRoom=inUpstairsRoom=inTownCutscene=inDarchonCall=false;
    inFarmCutscene=inFarmPostCutscene=inPostAmbushCutscene=inFortCutscene=inLvl4Cutscene=false;
    started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
    for(const t of sectorTowers())t.hp=0;
    markSectorTowersDown(currentLevel);window.towersDefeated=true;recruitSectorSurvivors();
    enemiesList=enemiesList.filter(e=>e.isPopulation);
    window.ambushKind='TOWER';window.ambushSpawnsRemaining=0;window.ambushKillsTotal=150;
    nm0AmbushActive=true;nm0AmbushKills=1;
    var finalAmbusher=newHostileCharacter(player.x+200,player.y,'ARMORED_STANDARD');
    finalAmbusher.isAmbush=true;enemiesList.push(finalAmbusher);
    finalAmbusher.hp=0;doTick=false;updateEntities();killcamTimer=1;`);
  screen(393, 800);
  probe('frameCount++;draw();');
  ok('L' + level + ' final ambush death exits the killcam', P('!killcamMode && !nm0AmbushActive && window.nm0AmbushClearedStatus'));
  // Sector 1 opens the Directive after its south gate unlock; Sector 2 runs
  // the post-ambush dialogue first. Both must end at the same controls.
  for (let i = 0; i < 8 && P('inPostAmbushCutscene'); i++) tap(20, 150);
  ok('L' + level + ' liberation reaches the initial Directive', P('inWorldBuildingMenu && !inOverworldView'));
  ok('L' + level + ' survivor award is a finite eighty-person roster', P('poolLedger().popTotal===80'));
  probe('frameCount++;draw();');
}

for (const level of [1, 2]) {
  finishTowerAmbush(level);
  // BACK is allowed before assigning everybody, and must return to live play.
  if (level === 1) tap(P('width/2-85'), P('height-20'));
  else {
    probe(`window.popFarmingM+=window.popUnassignedM;window.popUnassignedM=0;
      window.popFarmingF+=window.popUnassignedF;window.popUnassignedF=0;frameCount++;draw();`);
    tap(P('width/2'), P('height-65'));
    ok('L2 establishing the Directive commits the town', P('townsData[2].established && poolLedger().popFarmingF===80'));
  }
  ok('L' + level + ' leaving the Directive enters exploration', P('inOverworldView && !inWorldBuildingMenu && !isPaused'));
  ok('L' + level + ' exploration allows the touch controls', P('touchAimControlsAllowed()'));
  const before = P('player.x');
  press(125, 640); step(4); release();
  ok('L' + level + ' real movement touch moves the player after liberation', P('player.x') > before);

  probe('setMeleeTool("NONE");player.currentWeapon=WEAPONS.PISTOL;player.ammo=30;player.fireTimer=0;bullets=[];');
  const p = aimPoint('HEAD'), t = press(p.x, p.y);
  Object.assign(t, { x: p.x - 60 }); probe('touchMoved();handleTouches();'); step();
  ok('L' + level + ' silhouette aiming fires the selected headshot after liberation', P('rightStick.active && bullets.length===1 && bullets[0].tH==="HEAD"'));
  release();

  // The old town circles had no matching drawing, but still opened the panel.
  for (const [w, h] of [[320, 700], [393, 800], [940, 430]]) {
    screen(w, h);
    for (let town = 1; town <= level; town++) {
      const x = w / 2 - 150 + (town - 1) * 300;
      if (x < 0 || x > w) continue;
      for (const dx of [-30, 0, 30]) tap(x + dx, h / 2);
    }
    ok('L' + level + ' old town-node taps cannot open menus at ' + w + 'x' + h,
      P('inOverworldView && !inWorldBuildingMenu && !inTravelMenu && !isPaused'));
  }
  screen(393, 800);
  tap(358, 45); now += 400;
  ok('L' + level + ' the explicit pause corner still pauses exploration', P('isPaused'));
  tap(P('width/2'), P('height/2-40'));
  ok('L' + level + ' the pause-menu Directive remains available', P('isPaused && pauseMenuState==="GOV_DIRECTIVE" && !inWorldBuildingMenu'));
  tap(P('width/2-85'), P('height-20'));
  tap(P('width/2-60'), P('height/2-190'));
  ok('L' + level + ' pause-menu return restores exploration controls', P('!isPaused && !inWorldBuildingMenu && touchAimControlsAllowed()'));
}

probe('saveGame();loadGame();');screen(393, 800);
ok('a liberated-sector save restores live exploration controls', P('inOverworldView && !inWorldBuildingMenu && !isPaused && touchAimControlsAllowed()'));

// A bow is a weapon in the live overworld too: exercise its native release.
probe(`player.currentWeapon=WEAPONS.BOW;player.ammo=24;player.fireTimer=player.reloadTimer=0;
  player.meleeTimer=player.dashTimer=player.throwAnimTimer=0;isCooking=false;bullets=[];`);
const p = aimPoint('LEGS'), t = press(p.x, p.y);
for (let i = 1; i <= 54; i++) {
  Object.assign(t, { x: p.x - 60 * .92 * i / 54 }); probe('touchMoved();handleTouches();'); step();
}
ok('exploration allows the finite bow to charge', P('player.bowDrawState.phase==="DRAW" && player.bowDrawState.power>.99 && bullets.length===0'));
release(); step();
ok('exploration releases one aimed arrow', P('bullets.length===1 && bullets[0].isArrow && bullets[0].tH==="LEGS"'));

// Grass at the known opening-city shovel fixture; the live-world flag must
// not suppress the native dig mutation either.
probe(`currentLevel=currentBiome=1;BIOME_ACTIVE=true;window.shovelOwned=true;setMeleeTool('SHOVEL');
  player.x=528;player.y=720;player.shovelLevel=1;player.shovelDepth=player.shovelDepthTarget=0;
  player.shovelCooldownMs=player.meleeTimer=player.dashTimer=0;player._shovelCellKey=null;
  shovelExcavation={};buildings=[];activeBuildings=[];invalidateColIndex();`);
ok('exploration keeps shovel controls available', P('inOverworldView && shovelControlsAvailable()'));
ok('exploration accepts the native dig action', P('shovelDig("DOWN") && shovelCellAt(player.x,player.y).depth===18'));

// Genuine modal states still consume an existing gesture until it is lifted.
probe('setMeleeTool("NONE");player.currentWeapon=WEAPONS.PISTOL;');
for (const flag of ['isPaused', 'killcamMode', 'inTownCutscene', 'inPostAmbushCutscene', 'inWorldBuildingMenu', 'inTravelMenu']) {
  const p = aimPoint(); press(p.x, p.y);
  probe(`${flag}=true;syncTouchAimControlContext();${flag}=false;handleTouches();`);
  ok(flag + ' still consumes a held aiming pointer', P('touchAimSelection.pointerId===null && !rightStick.active'));
  release();
}
console.log(`${checks}/${checks} post-ambush exploration control checks passed`);

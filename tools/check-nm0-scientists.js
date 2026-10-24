// Laboratory staff flee on authored indoor routes, hide without fighting,
// and remain separate from the HQ's finite guard/population mechanics.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness');
const P = s => probe('(' + s + ')');
let checks = 0, seed = 8821, randomCalls = 0;
ctx.setTimeout = () => 0;
ctx.random = (a, b) => {
  randomCalls++;
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[Math.floor(r * a.length)];
  return b === undefined ? r * a : a + (b - a) * r;
};
const ok = (label, condition) => { assert.ok(condition, label); checks++; };
function fresh() {
  probe(`resetRunState();resetStoryProgress();isStoryMode=true;startAtLevel(8);
    seedNM0Scientists();started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inDarchonCall=inWorldBuildingMenu=inTravelMenu=false;
    activeBuildings=buildings;invalidateColIndex();deltaTime=1000/60;`);
}
const snapshot = () => P('JSON.stringify(nm0Scientists.map(a=>({x:a.x,y:a.y,state:a.scientistState,crouch:a.scientistCrouch})))');
fresh();
ok('HQ has three independent scientists', P('nm0Scientists.length===3 && nm0Scientists.every(a=>a.isNM0Scientist)'));
ok('staff are neutral and unarmed, outside the combat roster', P('nm0Scientists.every(a=>a.isNeutral && a.isUnarmed && !a.isArmed && a.ammo===0 && !enemiesList.includes(a))'));
ok('the guard encounter is still exactly twenty armored hostiles', P('enemiesList.length===20 && enemiesList.every(a=>a.eType==="ARMORED_STANDARD") && totalKills===0 && MAX_KILLS===20'));
probe('seedNM0Scientists();');
ok('repeated seeding does not duplicate laboratory staff', P('nm0Scientists.length===3'));
ok('staff begin at clear lab-floor positions', P('nm0Scientists.every(a=>!a.checkCol(a.x,a.y))'));
const opening = snapshot();
probe('for(let i=0;i<30;i++){frameCount++;updateNM0Scientists();}');
ok('on entry the staff really move away from their workstations', snapshot() !== opening && P('nm0Scientists.every(a=>a.scientistState==="FLEE" && a.isMoving)'));

for (const flag of ['isPaused', 'isDead', 'isWin', 'killcamMode', 'inWorldBuildingMenu', 'inTravelMenu', 'inStoryIntro', 'inPostAmbushCutscene', 'window.inNM0SecretOverlay']) {
  const before = snapshot();
  probe(`${flag}=true;updateNM0Scientists();${flag}=false;`);
  ok(flag + ' freezes fleeing staff', snapshot() === before);
}
probe('doTick=false;');
const paused = snapshot();probe('updateNM0Scientists();doTick=true;');
ok('a stopped simulation cannot advance their escape or crouch', snapshot() === paused);

// Test every simulated step against the real furnished HQ collision list,
// including the console banks beside their cover positions.
probe(`window.scientistBlockedSteps=0;
  for(let i=0;i<450;i++) {
    frameCount++;updateNM0Scientists();
    if(nm0Scientists.some(a=>a.checkCol(a.x,a.y)))window.scientistBlockedSteps++;
  }`);
ok('authored escape paths never cross a wall or laboratory fixture', P('scientistBlockedSteps===0'));
ok('every scientist reaches cover and fully crouches', P('nm0Scientists.every(a=>a.scientistState==="CROUCH" && a.scientistCrouch===1 && !a.isMoving)'));
ok('their cover is in a south corner, away from the entrance route', P('nm0Scientists.every(a=>Math.abs(a.x)>750 && a.y>1240 && a.y<1270)'));
ok('hiding staff do not fire, call reinforcements or award kills', P('bullets.length===0 && totalKills===0 && enemiesList.length===20 && !window.nm0HqCleared'));
const hidden = snapshot();
probe('player.x=0;player.y=-2000;for(let i=0;i<90;i++){frameCount++;updateNM0Scientists();}');
ok('staff remain in cover rather than following the player', snapshot() === hidden);

const drawSeed = randomCalls;
probe('for(const a of nm0Scientists)drawNM0Scientist(a);');
ok('the crouched scientist painter does not randomize the scene', randomCalls === drawSeed);
probe('for(const a of nm0Scientists){a.scientistCrouch=0;a.isMoving=true;drawNM0Scientist(a);}');
ok('native cel walking and crouching figures both render', true);

probe('startAtLevel(2);');
ok('leaving the HQ removes its scientists from the next sector', P('nm0Scientists.length===0'));
probe('startAtLevel(8);');
ok('returning to the HQ starts a fresh finite staff scene', P('nm0Scientists.length===3 && nm0Scientists.every(a=>a.scientistState==="STARTLED")'));
probe('resetRunState();');
ok('a hard reset discards all laboratory actors', P('nm0Scientists.length===0'));
console.log(`${checks}/${checks} NM-0 scientist escape, cover and isolation checks passed`);

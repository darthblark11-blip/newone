// The actual quest HUD must relinquish the play field after announcing a step.
// These checks use the real notice clock and painter, not copied fade formulas.
const assert = require('assert');
const { ctx, probe } = require('./harness');
let checks = 0;
function check(code, message) { assert.ok(probe(code), message); checks++; }
function step(ms) { ctx.deltaTime = ms; probe('frameCount++;updateForestHuntingActivity();'); }
probe(`started=true;isDead=false;isWin=false;isPaused=false;killcamMode=false;
  inCutscene=false;inTownCutscene=false;inFortCutscene=false;inPostAmbushCutscene=false;
  inFarmCutscene=false;inFarmPostCutscene=false;inWorldBuildingMenu=false;
  inOverworldView=false;inTravelMenu=false;inStoryIntro=false;inDarchonCall=false;
  doTick=true;currentLevel=2;BIOME_ACTIVE=true;forestWildlife.length=0;
  player={x:0,y:0,flags:{},weaponAmmo:{BOW:0},mags:{BOW:0}};
  resetForestHuntingActivity();forestHuntingQuest.site={x:659,y:5040,r:235,stewardX:659,stewardY:5095};
  tickForestHuntingSupply(0);updateForestHuntingActivity(false);`);
check('_forestHuntingObjectiveAgeMs===0&&forestHuntingNoticeOpacity(_forestHuntingObjectiveAgeMs)===0',
  'The first objective frame starts transparent');
step(100);step(75);
check('Math.abs(forestHuntingNoticeOpacity(_forestHuntingObjectiveAgeMs)-.5)<1e-9', 'The objective fades in over 350 ms');
step(100);step(75);
check('forestHuntingNoticeOpacity(_forestHuntingObjectiveAgeMs)===1', 'The objective reaches full opacity');
for(let i=0;i<35;i++)step(100);
check('_forestHuntingObjectiveAgeMs===3850&&forestHuntingNoticeOpacity(_forestHuntingObjectiveAgeMs)===1',
  'The objective holds for 3.5 seconds after its fade in');
for(let i=0;i<4;i++)step(100);
check('forestHuntingNoticeOpacity(_forestHuntingObjectiveAgeMs)===.5', 'The objective fades out over 800 ms');
for(let i=0;i<4;i++)step(100);
check('forestHuntingNoticeOpacity(_forestHuntingObjectiveAgeMs)===0', 'The objective fully disappears');
let texts=[], triangles=0, rects=[];
const original={text:ctx.text,triangle:ctx.triangle,rect:ctx.rect};
ctx.text=(...a)=>{texts.push(String(a[0]));return original.text(...a);};
ctx.triangle=(...a)=>{triangles++;return original.triangle(...a);};
ctx.rect=(...a)=>{rects.push(a);return original.rect(...a);};
probe('drawForestHuntingHud();drawForestHuntingHud();updateForestHuntingActivity(false);');
assert.equal(texts.length,0,'Expired objectives leave no permanent text');checks++;
assert.equal(rects.length,0,'Expired objectives leave no permanent panel');checks++;
assert.equal(triangles,2,'Guidance arrows remain after the notice expires');checks++;
check('_forestHuntingObjectiveAgeMs===4650','Painting and interaction probes cannot restart the notice');
probe(`forestHuntingQuest.stage='HUNT';drawForestHuntingHud();`);
check('_forestHuntingObjectiveAgeMs===0&&_forestHuntingObjectiveStage===\'HUNT\'', 'A new quest step announces once');
step(100);
const age=probe('_forestHuntingObjectiveAgeMs');
for(const flag of ['isPaused','inCutscene','inTownCutscene','inFortCutscene','inFarmCutscene',
  'inFarmPostCutscene','inPostAmbushCutscene','inWorldBuildingMenu','inOverworldView','inTravelMenu','inStoryIntro','inDarchonCall']) {
  probe(`${flag}=true;`);step(100);probe(`${flag}=false;`);
  assert.equal(probe('_forestHuntingObjectiveAgeMs'),age,`${flag} freezes transient notices`);checks++;
}
probe('updateForestHuntingActivity();');
const resumedAge=probe('_forestHuntingObjectiveAgeMs');
probe('updateForestHuntingActivity();');
assert.equal(probe('_forestHuntingObjectiveAgeMs'),resumedAge,'Multiple updates in one frame cannot consume a notice');checks++;
probe('currentLevel=3;tickForestHuntingSupply(0);currentLevel=2;tickForestHuntingSupply(0);updateForestHuntingActivity(false);');
check('_forestHuntingObjectiveAgeMs===0&&forestHuntingQuest.stage===\'HUNT\'', 'Travel back reannounces without changing the quest');
probe(`player.flags.bowUnlocked=true;player.weaponAmmo.BOW=17;var hudSave=serializeForestHuntingActivity();
  restoreForestHuntingActivity(hudSave);updateForestHuntingActivity(false);`);
check('_forestHuntingObjectiveAgeMs===0&&forestHuntingQuest.stage===\'HUNT\'&&player.weaponAmmo.BOW===17',
  'Load starts a fresh transient announcement and preserves quest/ammo');
check('!Object.keys(hudSave).some(k=>/age|notice|toast|objective/i.test(k))', 'Transient UI timers are never saved');
for(const [w,h] of [[1460,675],[734,375],[568,320],[375,812],[320,568]]) {
  ctx.width=w;ctx.height=h;
  const card=probe('forestHuntingObjectiveCard()');
  assert.ok(card.x>=12&&card.y>=0&&card.x+card.w<=w-12&&card.y+card.h<h/2,
    `${w}x${h} notice stays in the upper field and within the canvas`);checks++;
  assert.ok(card.x>=232||card.y>=150||card.x+card.w<=20,
    `${w}x${h} notice avoids the fixed health/ammo HUD`);checks++;
  assert.ok(card.y>=80||card.x+card.w<=w-180,
    `${w}x${h} notice avoids the clock and pause HUD`);checks++;
}
ctx.width=1460;ctx.height=675;
probe(`forestHuntingNotify('A harvest was collected.');`);
step(100);step(75);
check('Math.abs(forestHuntingNoticeOpacity((300-_forestHuntingToastTicks)/.06,3850)-.5)<1e-9',
  'Harvest toasts also fade in instead of flashing a large box');
for(let i=0;i<49;i++)step(100);
check('_forestHuntingToastTicks===0','Toast duration is elapsed-time based and fully expires');
probe(`forestHuntingQuest.stage='COMPLETE';drawForestHuntingHud();`);
check('_forestHuntingObjectiveStage===\'COMPLETE\'&&!Number.isFinite(_forestHuntingObjectiveAgeMs)',
  'Completed lessons do not leave objective banners');
Object.assign(ctx,original);
console.log('Forest hunting HUD: '+checks+' fade, lifecycle, pause and layout checks passed.');

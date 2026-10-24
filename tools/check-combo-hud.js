// HUD-only contracts: continuous color milestones, stable positions, separate
// mobile rows and a wrapped objective that leaves health and combo readable.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness');
const read = s => JSON.parse(probe('JSON.stringify(' + s + ')'));
for (const [kills, color] of [[0,[255,150,0]],[2,[255,150,0]],[10,[255,235,0]],
  [20,[255,190,35]],[30,[190,75,225]],[40,[143,60,255]]]) {
  assert.deepEqual(read('comboHudColor('+kills+')'), color, 'combo milestone '+kills);
}
assert.deepEqual(read('comboHudColor(6)'),[255,192.5,0],'colors blend between milestones');
for(let n=3;n<=40;n++) {
  const a=read('comboHudColor('+(n-1)+')'),b=read('comboHudColor('+n+')');
  assert(b.every((v,i)=>Math.abs(v-a[i])<=19),'each kill changes color gradually');
}
for(const w of [320,375,559,560,760,960,1440]) {
  probe(`width=${w};currentLevel=1;nm0AmbushActive=false;farmAmbushActive=false;consecutiveKills=40;player=null;`);
  const {combo,objective}=read('combatHudLayout()');
  assert(combo.x-combo.w/2>=12&&combo.x+combo.w/2<=w-12,'combo stays on screen');
  if(w>=560) {
    assert(combo.x-combo.w/2>=232,'combo leaves health bars clear');
    assert(combo.x+combo.w/2<=w-190,'combo leaves pause, score and climate clear');
    assert.equal(combo.y,12,'wide combo is raised at the top');
  } else {
    assert.equal(combo.x,w/2,'phone combo stays centered');
    assert.equal(combo.y,82,'phone combo is raised beside compact ammo');
  }
  assert(objective.x>=12&&objective.x+objective.w<=w-12,'objective stays on screen');
  if(w>=760) assert(objective.x>=232,'wide objective clears health and ammo');
  else assert(objective.y>=combo.y+43,'stacked objective clears combo');
}
probe(`width=320;currentLevel=8;player={currentWeapon:WEAPONS.BOW};consecutiveKills=40;`);
const bowLayout=read('combatHudLayout()');
assert.equal(bowLayout.combo.y,82,'bow and extra status bars do not push the combo down');
assert(bowLayout.ammo.bowY>=bowLayout.status.hq.labelY+14,'bow feedback clears HQ label');
assert(bowLayout.objective.y>=bowLayout.ammo.bowY+34,'objective clears bow feedback');
for(const w of [320,375,393,412,960]) {
  probe(`width=${w};currentLevel=4;nm0AmbushActive=true;farmAmbushActive=false;player={currentWeapon:WEAPONS.PISTOL};`);
  const p=read('combatHudLayout()');
  assert.equal(p.status.outpost.barY-p.status.nm0.barY,24,'simultaneous ambush and outpost get separate rows');
  assert(p.status.outpost.barY>=p.status.nm0.labelY+14,'labels do not touch the next bar');
  assert.equal(p.ammo.fontSize,w<560?11:12,'ammo is much smaller than the old 24px text');
  if(w<560) {
    assert(p.ammo.textX+p.ammo.maxTextW/2<p.combo.x-p.combo.w/2,'ammo and combo have separate horizontal lanes');
    assert(p.status.nm0.barY>=128,'status rows stay below combo and ammo');
    assert(p.objective.y>=p.status.outpost.labelY+26,'objective clears final status label');
  } else assert(p.ammo.iconY>=p.status.outpost.labelY+14,'desktop ammo clears level4 outpost label');
}
probe('width=320;currentLevel=8;nm0AmbushActive=false;');
const text=[],rect=[],fill=[];
ctx.text=(...a)=>text.push(a);ctx.rect=(...a)=>rect.push(a);ctx.fill=(...a)=>fill.push(a);
ctx.textWidth=s=>s.length*8;
ctx.random=()=>{throw Error('HUD should not jitter or consume combat randomness');};
probe('resetComboHudFade();isPaused=false;deltaTime=15;consecutiveKills=20;comboTimer=50;frameCount++;drawComboHud();');
assert(fill[0][3]>0&&fill[0][3]<255,'combo enters at partial opacity instead of popping in');
assert.equal(read('comboTimer'),50,'visual fade does not spend the combo window');
const first=JSON.stringify({text,rect,fill});text.length=rect.length=fill.length=0;
probe('drawComboHud();');assert.equal(JSON.stringify({text,rect,fill}),first,'repeated frames are stable');
for(let n=0;n<5;n++){
  text.length=rect.length=fill.length=0;
  probe('frameCount++;drawComboHud();');
}
assert.deepEqual(fill[0],[255,190,35,255],'label reaches full combo gold after a quick 90ms fade');
assert.deepEqual(fill[2],fill[0],'timer shares the combo color');
assert.equal(rect[1][2],rect[0][2]/2,'timer width reflects remaining time');
text.length=rect.length=fill.length=0;
probe('consecutiveKills=0;comboTimer=0;deltaTime=20;frameCount++;drawComboHud();');
assert.equal(text[0][0],'x20 COMBO','expired combo keeps its label during the exit');
assert.deepEqual(fill[0].slice(0,3),[255,190,35],'exit preserves its existing color');
assert(fill[0][3]>0&&fill[0][3]<255,'expired combo fades instead of vanishing');
assert.equal(rect[1][2],rect[0][2]/2,'exit retains the last timer presentation');
assert.equal(read('consecutiveKills'),0,'exit does not resurrect the gameplay combo');
const exitAlpha=fill[0][3];
text.length=rect.length=fill.length=0;
probe('isPaused=true;frameCount++;drawComboHud();');
assert.equal(fill[0][3],exitAlpha,'pause freezes an in-progress fade');
probe('isPaused=false;');
for(let n=0;n<6;n++){
  text.length=rect.length=fill.length=0;
  probe('frameCount++;drawComboHud();');
}
assert.equal(text.length,0,'combo disappears after its short exit transition');
probe('consecutiveKills=4;comboTimer=100;frameCount++;drawComboHud();');
assert.equal(text[0][0],'x4 COMBO','a new combo begins with the current kill count');
assert(fill[0][3]>0&&fill[0][3]<255,'a new combo fades in again');
probe('resetComboHudFade();');
assert.equal(read('comboHudFade.visibility'),0,'run and travel resets can discard transient fade state');
text.length=rect.length=fill.length=0;
probe('objectiveTimer=60;isPaused=true;drawStoryObjectiveBanner("Find a way past the south Great Gate before entering NM-0 HQ.",180);');
assert.equal(read('objectiveTimer'),60,'painting preserves timer and pause handling');
assert(text.length>1,'long mobile objective wraps');
assert(text.every(t=>ctx.textWidth(t[0])<=read('combatHudLayout().objective.w')-24),'wrapped text fits the card');
assert.deepEqual(fill[1],[255,255,255,180],'objective retains its requested fade');
assert(rect[0][1]+rect[0][3]<320,'objective stays in the top part of the screen');
// The extra tiers are visual only. Use representative interior points rather
// than tying threshold labels to the blend implementation.
for(const [kills,stage] of [[40,'base'],[45,'blood'],[52,'mono'],[57,'split'],
  [65,'stone'],[75,'soul'],[85,'indigo'],[95,'pearl'],[101,'rainbow'],[123,'rainbow']]) {
  const style=read(`comboHudStyle(${kills},1234)`);
  assert.equal(style.stage,stage,'combo material tier at '+kills);
  assert(style.color.length===3&&style.color.every(v=>Number.isFinite(v)&&v>=0&&v<=255),
    'finite render colors at '+kills);
  for(const field of ['t','blood','mono','split','stone','flame','pearl','rainbow'])
    assert(Number.isFinite(style[field])&&style[field]>=0&&style[field]<=1,
      'bounded '+field+' at '+kills);
  assert.deepEqual(style,read(`comboHudStyle(${kills},1234)`),'style sampling is deterministic');
}
for(const kills of [2,10,20,30,40]) {
  const style=read(`comboHudStyle(${kills},1000)`);
  assert.deepEqual(style.color,read(`comboHudColor(${kills})`),'original palette at '+kills);
  assert(['blood','mono','split','stone','flame','pearl','rainbow'].every(f=>style[f]===0),
    'original palette stays free of advanced effects at '+kills);
}
assert(read('comboHudStyle(45).blood')>0,'blood begins inside the purple tier');
assert(read('comboHudStyle(50).blood')>0,'the completed red letters still bleed at 50');
assert(read('comboHudStyle(52).mono')>0,'black-and-white develops after blood');
assert(read('comboHudStyle(57).split')>0,'left/right split develops after the middle radiance');
assert(read('comboHudStyle(65).stone')>0,'stone develops before the first burst');
assert(read('comboHudStyle(75).flame')>0&&read('comboHudStyle(85).flame')>0,'both flame tiers are active');
assert(read('comboHudStyle(95).pearl')>0,'the late tier has a pearlescent sheen');
assert(read('comboHudStyle(101).rainbow')>0,'100-plus streaks enter rainbow cadence');

function comboVisualStep(kills,timer=100,ms=20) {
  probe(`consecutiveKills=${kills};comboTimer=${timer};deltaTime=${ms};frameCount++;updateComboHudFade();`);
  return read('comboHudFade');
}
probe('resetComboHudFade();isPaused=false;');
let visual=comboVisualStep(69);
assert.equal(visual.burst70,-1,'the first burst waits for 70 kills');
assert.equal(visual.burst80,-1,'the second burst waits for 80 kills');
visual=comboVisualStep(70);
assert(visual.burst70>=0&&visual.burst70<=visual.clockMs,'crossing 70 starts the soul burst');
const firstBurst=visual.burst70,clock=visual.clockMs;
const repeated=JSON.stringify(visual);
probe('updateComboHudFade();drawComboHud();');
assert.equal(JSON.stringify(read('comboHudFade')),repeated,'repeat painting cannot advance effects or retrigger a burst');
visual=comboVisualStep(71);
assert.equal(visual.burst70,firstBurst,'later kills do not restart the first burst');
assert(visual.clockMs>clock,'the effect clock advances with the active HUD');
visual=comboVisualStep(80);
assert(visual.burst80>=visual.burst70&&visual.burst80<=visual.clockMs,'crossing 80 starts the second burst');
const secondBurst=visual.burst80;
visual=comboVisualStep(85);
assert.equal(visual.burst80,secondBurst,'later kills do not restart the second burst');
probe('isPaused=true;');
const paused=read('comboHudFade');
visual=comboVisualStep(85,100,100);
assert.equal(visual.clockMs,paused.clockMs,'pause freezes flame, pearl and cadence time');
assert.equal(visual.burst70,paused.burst70,'pause preserves first burst progress');
assert.equal(visual.burst80,paused.burst80,'pause preserves second burst progress');
probe('isPaused=false;');
visual=comboVisualStep(0,0);
assert.equal(visual.kills,85,'exit retains the final material and count');
assert.equal(visual.burst80,secondBurst,'exit does not restart the burst');
for(let i=0;i<7;i++)comboVisualStep(0,0);
visual=comboVisualStep(2);
assert.equal(visual.burst70,-1,'a new combo clears the previous soul burst');
assert.equal(visual.burst80,-1,'a new combo clears the previous indigo burst');
visual=comboVisualStep(81);
assert(visual.burst70>=0&&visual.burst80>=0,'a multi-kill crossing both thresholds creates both bursts');
comboVisualStep(0,0);
visual=comboVisualStep(2);
assert.equal(visual.burst70,-1,'a new combo during fade-out clears the old first burst');
assert.equal(visual.burst80,-1,'a new combo during fade-out clears the old second burst');

text.length=rect.length=fill.length=0;
comboVisualStep(123);
probe('drawComboHud();');
assert(text.some(t=>t[0]==='x123 COMBO'),'the rendered counter remains readable above 99');
assert.equal(read('consecutiveKills'),123,'rendering does not cap or change the gameplay count');
assert.equal(read('comboTimer'),100,'advanced tiers cannot spend the countdown');
probe('resetComboHudFade();');
assert.equal(read('comboHudFade.clockMs'),0,'run/travel reset clears the effect clock');
assert.equal(read('comboHudFade.burst70'),-1,'run/travel reset clears the first burst');
assert.equal(read('comboHudFade.burst80'),-1,'run/travel reset clears the second burst');
console.log('Combo HUD colors, material progression, bursts, pause, counts, layout and fade checks passed.');

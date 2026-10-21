// HUD-only contracts: continuous color milestones, stable positions, separate
// mobile rows and a wrapped objective that leaves health and combo readable.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness');
const read = s => JSON.parse(probe('JSON.stringify(' + s + ')'));
for (const [kills, color] of [[0,[255,150,0]],[2,[255,150,0]],[10,[255,235,0]],
  [20,[255,190,35]],[30,[190,75,225]],[40,[143,60,255]],[80,[143,60,255]]]) {
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
    assert.equal(combo.y,20,'wide combo remains at the top');
  } else {
    assert.equal(combo.x,w/2,'phone combo stays centered');
    assert(combo.y>=142,'phone combo clears status and ammo');
  }
  assert(objective.x>=12&&objective.x+objective.w<=w-12,'objective stays on screen');
  if(w>=760) assert(objective.x>=232,'wide objective clears health and ammo');
  else assert(objective.y>=combo.y+43,'stacked objective clears combo');
}
probe(`width=320;currentLevel=8;player={currentWeapon:WEAPONS.BOW};consecutiveKills=40;`);
assert(read('combatHudLayout().combo.y')>=189,'bow, ammo and extra status bars stay clear');
const text=[],rect=[],fill=[];
ctx.text=(...a)=>text.push(a);ctx.rect=(...a)=>rect.push(a);ctx.fill=(...a)=>fill.push(a);
ctx.textWidth=s=>s.length*8;
ctx.random=()=>{throw Error('HUD should not jitter or consume combat randomness');};
probe('consecutiveKills=20;comboTimer=50;drawComboHud();');
const first=JSON.stringify({text,rect,fill});text.length=rect.length=fill.length=0;
probe('drawComboHud();');assert.equal(JSON.stringify({text,rect,fill}),first,'repeated frames are stable');
assert.deepEqual(fill[0],[255,190,35],'label uses the combo gold');
assert.deepEqual(fill[2],fill[0],'timer shares the combo color');
assert.equal(rect[1][2],rect[0][2]/2,'timer width reflects remaining time');
text.length=rect.length=fill.length=0;
probe('objectiveTimer=60;isPaused=true;drawStoryObjectiveBanner("Find a way past the south Great Gate before entering NM-0 HQ.",180);');
assert.equal(read('objectiveTimer'),60,'painting preserves timer and pause handling');
assert(text.length>1,'long mobile objective wraps');
assert(text.every(t=>ctx.textWidth(t[0])<=read('combatHudLayout().objective.w')-24),'wrapped text fits the card');
assert.deepEqual(fill[1],[255,255,255,180],'objective retains its requested fade');
assert(rect[0][1]+rect[0][3]<320,'objective stays in the top part of the screen');
console.log('Combo HUD color, stability, layout, wrapping and fade checks passed.');

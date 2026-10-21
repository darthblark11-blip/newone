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

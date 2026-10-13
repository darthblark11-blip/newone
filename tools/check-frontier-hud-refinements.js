// Exercise actual HUD paint: GRIT stays outside the responsive fading header;
// sheriff identity fades while its navigation marker and interactions survive.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let checks = 0;
const check = (code, label) => { assert.ok(probe(code), label); checks++; };
function paint(code) {
  const result = {texts: [], rects: [], arrows: []};
  const originals = {text:ctx.text, rect:ctx.rect, triangle:ctx.triangle, textSize:ctx.textSize};
  let size = 12;
  ctx.textSize = value => { size = value; };
  ctx.text = (label, x, y) => result.texts.push({label:String(label), x, y, size});
  ctx.rect = (...args) => result.rects.push(args);
  ctx.triangle = (...args) => result.arrows.push(args);
  try { probe(code); } finally { Object.assign(ctx, originals); }
  return result;
}
function tick(count, dt=100) {
  ctx.deltaTime = dt;
  for (let i=0;i<count;i++) probe('updateFrontierBounties();');
}
probe(`isStoryMode=false;resetStoryProgress();startAtLevel(3);started=true;
  isPaused=isDead=isWin=killcamMode=false;doTick=true;
  inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inWorldBuildingMenu=inOverworldView=inTravelMenu=inStoryIntro=inDarchonCall=false;
  window.isDesktop=false;window.showOnScreenControls=true;
  leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
  enterFrontierSaloon();startFrontierSaloonBrawl();var headerScene=_frontierSaloonSession;`);
for (const [width, height] of [[320,568],[390,844],[940,390]]) {
  ctx.width=width;ctx.height=height;
  const captured=paint('drawFrontierSaloonHud();');
  const grit=captured.texts.find(t=>t.label.startsWith('GRIT '));
  assert(grit&&grit.x<width/3&&grit.y===22,'GRIT occupies its own upper-left combat bar');checks++;
  const bar=captured.rects.find(r=>r[0]===8&&r[1]===8&&r[3]===28);
  const info=captured.rects.find(r=>r[0]===8&&r[1]===46&&r[2]===width-16&&r[3]===76);
  assert(bar&&info&&bar[1]+bar[3]<info[1],'The fading information panel has its own row below GRIT');checks++;
  assert(bar[0]+bar[2]<width-61,'The persistent bar leaves space for the permanent pause control');checks++;
  assert(!captured.rects.some(r=>r[1]===98&&r[3]===27),'The old separate middle-screen GRIT box is gone');checks++;
  const title=captured.texts.find(t=>t.y===67&&!t.label.startsWith('GRIT '));
  assert(title&&title.size>=10&&title.x===width/2,'The responsive title stays readable on its own lower row');checks++;
}
probe('headerScene.elapsedMs+=3900;');
check('frontierSaloonHudAlpha(headerScene)===0','Informational text retains the shared 3.5-second fade');
const faded=paint('drawFrontierSaloonHud();');
assert(faded.texts.some(t=>t.label==='GRIT 100/100')&&!faded.texts.some(t=>/^HEALTH |^COPPER SPUR|^PEACEMAKER/.test(t.label)),'Combat health stays visible when the information panel fades');checks++;
assert(faded.rects.some(r=>r[0]===ctx.width-61&&r[1]===12&&r[2]===45),'The pause button remains usable after fading');checks++;
probe('headerScene.grit=37;');
const damaged=paint('drawFrontierSaloonHud();');
assert(damaged.texts.some(t=>t.label==='GRIT 37/100')&&probe('frontierSaloonHudAlpha(headerScene)===0'),'GRIT updates without reviving informational text');checks++;
const damagedBar=damaged.rects.find(r=>r[0]===8&&r[1]===8&&r[3]===28);
assert(damaged.rects.some(r=>r[0]===10&&r[1]===10&&Math.abs(r[2]-(damagedBar[2]-4)*.37)<.000001),'Persistent fill reflects the live knockout health value');checks++;
for (const phase of ['KNOCKOUT','INTERMISSION','TRANSITION','LOST']) {
  probe(`headerScene.brawl='${phase}';frontierSaloonHudAlpha(headerScene);headerScene.elapsedMs+=3900;`);
  const phasePaint=paint('drawFrontierSaloonHud();');
  assert(phasePaint.texts.some(t=>t.label==='GRIT 37/100')&&!phasePaint.rects.some(r=>r[1]===46&&r[3]===76),`GRIT remains visible after the ${phase} information panel fades`);checks++;
}
probe(`headerScene.brawl='ACTIVE';`);
probe(`headerScene.gauntlet={wave:4,phase:'FIGHT'};headerScene.arena='SALOON';`);
check('frontierSaloonHudAlpha(headerScene)===1','A fresh gauntlet level refreshes the informational header');
assert(paint('drawFrontierSaloonHud();').texts.some(t=>/^LEVEL 4 · \d+\/\d+ STANDING · SALOON$/.test(t.label)),'The header reports the actual level and fighter count');checks++;
probe(`headerScene.elapsedMs+=3900;headerScene.arena='SALOON';headerScene.gauntlet.wave=6;headerScene.gauntlet.nextWave=7;headerScene.brawl='TRANSITION';`);
check('frontierSaloonHudAlpha(headerScene)===1','A new arena and transition briefly reveal progress');
assert(paint('drawFrontierSaloonHud();').texts.some(t=>t.label==='THROUGH THE SALOON DOORS'),'The saloon departure has its own transition label');checks++;
probe(`headerScene.gauntlet.wave=13;headerScene.gauntlet.nextWave=14;headerScene.arena='STREET';`);
assert(paint('drawFrontierSaloonHud();').texts.some(t=>t.label==='TO THE CANYON BRIDGE'),'The bridge transition has its own label');checks++;
probe(`headerScene.brawl='ACTIVE';headerScene.gauntlet.wave=14;headerScene.gauntlet.nextWave=null;headerScene.arena='BRIDGE';`);
assert(paint('drawFrontierSaloonHud();').texts.some(t=>t.label.includes('LEVEL 14')&&t.label.endsWith('CANYON BRIDGE')),'The active bridge level shows the new arena');checks++;
probe(`exitFrontierSaloon();resetFrontierBounties();player.x=600;player.y=0;`);
let bounty=paint('drawFrontierBountyHud();');
assert(bounty.texts.some(t=>t.label==='DRY GULCH · SHERIFF BOUNTIES'),'The sheriff heading begins visible');checks++;
assert(bounty.arrows.length===1&&bounty.texts.some(t=>/^\d+ m$/.test(t.label)),'The heading has a directional arrow and distance');checks++;
tick(30);
check('frontierBountyHudAlpha()===1','The sheriff heading holds for exactly three seconds');
tick(2);
check('Math.abs(frontierBountyHudAlpha()-.5)<.000001','The sheriff heading smoothly fades after three seconds');
tick(2);
bounty=paint('drawFrontierBountyHud();');
assert(!bounty.texts.some(t=>t.label.includes('SHERIFF BOUNTIES')||t.label.includes('WANTED BOARD')),'The heading and descriptive text fully disappear');checks++;
assert(bounty.arrows.length===1&&bounty.texts.some(t=>/^\d+ m$/.test(t.label)),'The arrow and distance persist after the heading fades');checks++;
assert(!bounty.rects.some(r=>r[1]===75&&r[3]===43)&&bounty.rects.some(r=>r[1]===4&&r[2]===86),'Faded headings leave only the northern compact marker, without the large empty panel');checks++;
for (const [width,height] of [[320,568],[390,844],[940,390]]) {
  ctx.width=width;ctx.height=height;
  probe('rightStick.base={x:width-72,y:height-108};');
  const actualWorldHud=paint('drawUI();drawFrontierBountyHud();');
  const marker=actualWorldHud.rects.find(r=>r[0]===width/2-43&&r[1]===4&&r[2]===86&&r[3]===15);
  const distance=actualWorldHud.texts.find(t=>/^\d+ m$/.test(t.label));
  assert(marker&&marker[1]+marker[3]<20&&marker[0]>=8&&marker[0]+marker[2]<=width-8,'The northern waypoint fits above actual campaign health, score, climate and pause controls');checks++;
  assert(distance&&distance.y===12&&paint('drawFrontierBountyHud();').arrows.length===1,'Distance and direction remain at the same northern position at every viewport size');checks++;
}
probe(`player.x+=400;player.hp-=5;`);tick(1);
check('frontierBountyHudAlpha()===0','Movement, changing distance and damage do not keep reviving the sheriff heading');
probe(`isPaused=true;var bountyPauseClock=_frontierBountyHud.clockMs;`);tick(20);
check('_frontierBountyHud.clockMs===bountyPauseClock','Pause freezes sheriff heading lifetime');
probe(`isPaused=false;player.x=frontierBountyBoard().x-40;player.y=frontierBountyBoard().y;updateFrontierBounties(false);`);
bounty=paint('drawFrontierBountyHud();');
assert(bounty.texts.some(t=>t.label==='ACCEPT SHERIFF BOUNTY'),'The actual interaction remains visible after the heading fades');checks++;
check('frontierBountyHudAlpha()===0','Approaching the board does not refresh the noninteractive heading');
probe('interactFrontierBountyBoard();');
check('frontierBountyHudAlpha()===1','Accepting a new contract briefly reveals its meaningful status');
tick(34);paint('drawFrontierBountyHud();');
probe('frontierBountyRecord(FRONTIER_BOUNTY_DEFS[0]).killed.push(0);');
check('frontierBountyHudAlpha()===1','A confirmed bounty casualty briefly reveals new contract progress');
probe('resetFrontierBounties();');
check('_frontierBountyHud.clockMs===0&&_frontierBountyHud.key===null','A campaign reset clears transient HUD timing');
console.log(`Frontier HUD refinements: ${checks} responsive placement, fade and interaction checks passed.`);

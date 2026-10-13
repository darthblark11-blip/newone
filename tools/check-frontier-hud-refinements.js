// Exercise actual HUD paint: GRIT stays inside the responsive fading header;
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
for (const [width, height] of [[320,568],[390,844],[940,430]]) {
  ctx.width=width;ctx.height=height;
  const captured=paint('drawFrontierSaloonHud();');
  const grit=captured.texts.find(t=>t.label.startsWith('GRIT '));
  assert(grit&&grit.x<width/3&&grit.y===29,'GRIT is at the upper left, inside the header');checks++;
  assert(captured.rects.some(r=>r[0]===8&&r[1]===8&&r[2]===width-16&&r[3]===76),'The same compact fading information panel holds GRIT');checks++;
  assert(captured.rects.filter(r=>r[1]===18&&r[3]===22).every(r=>r[0]>=8&&r[0]+r[2]<=width-72),'GRIT leaves space for the title and permanent pause control');checks++;
  assert(!captured.rects.some(r=>r[1]===98&&r[3]===27),'The old separate middle-screen GRIT box is gone');checks++;
  const title=captured.texts.find(t=>t.y===29&&!t.label.startsWith('GRIT '));
  assert(title&&title.size>=10&&title.x<width-72,'The responsive title fits beside the pause button');checks++;
}
probe('headerScene.elapsedMs+=3900;');
check('frontierSaloonHudAlpha(headerScene)===0','Header GRIT retains the shared 3.5-second fade');
const faded=paint('drawFrontierSaloonHud();');
assert(!faded.texts.some(t=>/^GRIT |^HEALTH |^COPPER SPUR|^PEACEMAKER/.test(t.label)),'All informational header text fades together');checks++;
assert(faded.rects.some(r=>r[0]===ctx.width-61&&r[1]===12&&r[2]===45),'The pause button remains usable after fading');checks++;
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
assert(!bounty.rects.some(r=>r[1]===75&&r[3]===43)&&bounty.rects.some(r=>r[1]===122&&r[2]===86),'Faded headings leave only the compact marker, without the large empty panel');checks++;
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

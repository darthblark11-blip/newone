// ---------------------------------------------------------------------------
// LOOK AT THE WORLD, NOT AT ONE PROP.
//
// tools/visual.js draws a contact sheet of props on a flat background, which is
// the right tool for judging one piece of art and the WRONG tool for finding
// the things players actually complain about: a ring baked into the terrain, a
// deck lying across a road, two props stacked on one another. Those are
// properties of a generated chunk, not of a prop.
//
// This runs the real streamer -- generateChunkContent, bakeChunkTerrain,
// drawTerrain, drawDecor, drawBiomeDecks, the shadow pass and the depth-sorted
// pass -- over a real patch of a real biome, and screenshots it.
//
//   node tools/visual-world.js 4              # biome 4 at the origin
//   node tools/visual-world.js 4 3600 -2400   # ... at that world position
//   node tools/visual-world.js 2 0 0 0.45     # ... at that zoom
//
// Deps are the same as tools/visual.js; see its header.
// ---------------------------------------------------------------------------
const fs = require('fs'), path = require('path');
const SP = process.env.VIS_DEPS ||
  '/tmp/claude-0/-home-user-newone/8482112a-c646-5134-bd53-0f1ebb34fae6/scratchpad';
const CHROME = process.env.VIS_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const { chromium } = require(path.join(SP, 'node_modules/playwright'));
const P5 = process.env.VIS_P5 || path.join(SP, 'node_modules/p5/lib/p5.min.js');
const GAME = process.env.GAME_JS || path.join(__dirname, '..', 'game.js');
const GAME_SOURCE = fs.readFileSync(GAME, 'utf8');
const GAME_HASH = require('crypto').createHash('sha256').update(GAME_SOURCE).digest('hex');
const OUT = process.env.VIS_OUT || path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const BIOME = +(process.argv[2] || 4);
const WX = +(process.argv[3] || 0), WY = +(process.argv[4] || 0);
const ZOOM = +(process.argv[5] || 0.66);
// `legacy` draws the AUTHORED map instead of the streamed one: Level 1 and 2's
// hand-placed sector, which is what the player is standing in for the whole
// story arc and which the chunk streamer never touches.
const LEGACY = process.argv.includes('legacy');
// `labels` writes each solid's own flag over it. Guessing which branch drew a
// given rectangle is how two rounds of this went wrong.
const LABELS = process.argv.includes('labels');
// `night` runs the clock round to 23:00 and adds the two passes that only
// exist after dark: the fixtures (drawNightLights) and the light rig's pool
// (drawLightPass). Judging a lamp at midday tells you nothing about a lamp.
const NIGHT = process.argv.includes('night');
// `district=0..5` finds a complete generated city plan at real p5 noise.
// `civic` finds a real generated Level 1 terrace with p5's actual noise.
const CIVIC = process.argv.includes('civic');
const DISTRICT = +(process.argv.find(a => /^district=/.test(a)) || 'district=-1').split('=')[1];
const RAIN = process.argv.includes('rain');
const PEOPLE = process.argv.includes('people');
const ACTORS = process.argv.includes('actors');
const ADVANCED = process.argv.includes('advanced');
// `hour=N` puts the world clock at that hour. The sun travels now, so which
// hour a screenshot was taken at is a property of the picture -- a shadow
// sweeping the wrong way is invisible in any single frame.
const HOURARG = (process.argv.find(a => /^hour=/.test(a)) || '').split('=')[1];
const HOUR = HOURARG === undefined ? (NIGHT ? 23 : 13) : +HOURARG;
const W = +(process.env.VW_W || 900), H = +(process.env.VW_H || 1400);

const page = `<!doctype html><meta charset=utf8>
<style>html,body{margin:0;background:#111}</style>
<script>${fs.readFileSync(P5, 'utf8')}</script>
<script>${GAME_SOURCE}</script>
<script>
window.preload = function () {};
window.loadImage = function () { return { width: 1, height: 1 }; };
window.loadSound = function () { return { isLoaded: function(){return false;},
  play: function(){}, stop: function(){}, setVolume: function(){} }; };
window.loadFont = function () { return null; };
window.__done = false; window.__errs = [];
window.setup = function () {
  createCanvas(${W}, ${H});
  pixelDensity(1); noLoop();
  // Reproducible: legacyGenerateMap() runs against p5's global RNG, so without
  // this the same command renders a different city every time and two shots
  // cannot be compared. noise() is seeded for the same reason on the streamed
  // side -- the game does it at startup and this harness skips setup().
  randomSeed(${+(process.env.VW_SEED || 7)}); noiseSeed(BIOME_SEED);
  seedWorldClock();
  worldTimeMs = ${HOUR} / 24 * DAY_MS;     // 13:00 by default: the hour the palettes are for
  updateSunVector();                      // the sun travels; put it where the clock says
  BIOME_ACTIVE = true;
  currentLevel = ${BIOME}; currentBiome = ${BIOME};
  authoredCore = null; authoredChunks = null; authoredMask = null;
  biomeState = {};
  weather = null;                          // no screen layer; this is about the ground
  isRaining = ${RAIN};
  window.__wx = ${WX}; window.__wy = ${WY};
  if (${CIVIC}) {
    let found = false;
    for (let cy=5;cy<35 && !found;cy++) for (let cx=-18;cx<18;cx++) {
      if (!hasCivicTerrace(${BIOME},cx,cy)) continue;
      window.__wx=cx*CHUNK_W+600; window.__wy=cy*CHUNK_W+600; found=true; break;
    }
    if (!found) window.__errs.push('No civic terrace found');
  }
  if (${DISTRICT} >= 0) {
    let found=false;
    for(let cy=5;cy<40&&!found;cy++)for(let cx=-18;cx<18;cx++){
      const ch=generateChunkContent(1,cx,cy);
      if(ch.solid.filter(b=>b.cityPlan===${DISTRICT}&&b.isBlockBuilding).length<4)continue;
      window.__wx=cx*CHUNK_W+600;window.__wy=cy*CHUNK_W+600;found=true;break;
    }
    if(!found)window.__errs.push('No city district found');
  }
  rightStick = { active: false };
  if (${PEOPLE || ACTORS || ADVANCED}) {
    player=new Character(window.__wx,window.__wy,true);doTick=true;enemiesList=[];
  }
  // refreshPopulation() wants a player and a budget. Neither is what this tool
  // is looking at, and both drag in half the entity system.
  refreshPopulation = function () {};
  zoom = ${ZOOM};
  camX = window.__wx - width / zoom * 0.5;
  camY = window.__wy - height / zoom * 0.5;
  viewLeft = camX; viewRight = camX + width / zoom;
  viewTop  = camY; viewBottom = camY + height / zoom;
  if (${LEGACY}) {
    buildings = []; enemiesList = [];
    try { legacyGenerateMap(); } catch (e) { window.__errs.push('legacy: ' + e.message); }
  } else {
    chunkMgr = new ChunkManager(${BIOME});
    try {
      chunkMgr.update(window.__wx, window.__wy);
      chunkMgr.warmUp(120);                // no per-frame bake budget here
      chunkMgr.rebuildWorldArrays();
    } catch (e) { window.__errs.push('stream: ' + e.message); }
  }
  activeBuildings = buildings;invalidateColIndex();
  if(${ACTORS}&&chunkMgr){
    const trees=[];
    for(const ch of chunkMgr.chunks.values())for(const d of ch.decor||[])
      if(d.forestSpecies&&d.forestSpecies!=='CHARRED_SNAG'&&inView(d.x,d.y,0))trees.push(d);
    trees.sort((a,b)=>Math.hypot(a.x-window.__wx,a.y-window.__wy)-Math.hypot(b.x-window.__wx,b.y-window.__wy));
    if(trees.length){const tree=trees[0];
      player.x=tree.x+5;player.y=tree.y+12;player.isArmed=true;
      for(const [dx,dy,type]of[[95,35,'ARMORED_STANDARD'],[-105,-60,'NORMAL'],[160,-120,'AERIAL_PISTOL']]){
        const e=new Character(tree.x+dx,tree.y+dy,false,type);e.aimAngle=.7;e.isArmed=true;enemiesList.push(e);
      }
    }else window.__errs.push('No visible rooted forest tree for actor depth staging');
  }
  if(${PEOPLE}&&chunkMgr){
    const pcx=Math.floor(window.__wx/CHUNK_W),pcy=Math.floor(window.__wy/CHUNK_W);
    for(let i=0;i<20;i++){frameCount+=21;refreshCityPeople(chunkMgr,pcx,pcy);}
    for(const e of enemiesList){e.isMoving=!e.cityPost;e.gait=e.isCityCivilian?.25:.3;e.walkCycle=e.x*.03;}
    console.log('City people: '+enemiesList.filter(e=>e.isCityCivilian).length+' civilians / '+enemiesList.filter(e=>e.isCityPatrol).length+' guards');
  }
  if(${ADVANCED}){
    glRigWatchdog=function(){};glRigClock=function(){};
    if(!glRigInit())window.__errs.push('Advanced lighting initialization: '+GLRig.failure);
    GLRig.on=true;GLRig.tier=0;GLRig.lightTier=0;GLRig.resize=true;
  }
  redraw();
};
window.draw = function () {
  const sky = (BIOMES[${BIOME}] || BIOMES[1]).sky;
  background(sky[0], sky[1], sky[2]);
  push();
  scale(zoom); translate(-camX, -camY);
  const step = (name, fn) => { try { fn(); } catch (e) { window.__errs.push(name + ': ' + e.message); } };
  // The real ground stack, in the real order.
  if (chunkMgr) step('terrain', () => chunkMgr.drawTerrain());
  else          step('ground', () => { noStroke(); fill(86, 90, 96);
                  rect(camX, camY, width / zoom, height / zoom); });
  _depthOn = true;                          // so standing decor queues, as in game
  if (chunkMgr) step('decor', () => chunkMgr.drawDecor());
  step('decks',   () => drawBiomeDecks());
  ${process.env.VW_NOSHADOW ? '' : "step('shadows', () => drawBuildingShadows());"}
  if (${PEOPLE || ACTORS}) step('people',()=>{for(const e of enemiesList)if(inView(e.x,e.y,90))actorShow(e);});
  if (${ACTORS}) step('player',()=>actorShow(player));
  // This draws every visible mass and every queued tree in one
  // sorted pass -- which is exactly what the game does between characters.
  step('sorted',  () => drawDepthSorted());
  step('airborne',() => drawAirborneActors());
  if (${NIGHT}) step('fixtures', () => drawNightLights());
  pop();
  if (${ADVANCED}) step('advanced',()=>{if(!glRigFrame())throw Error('Advanced lighting did not composite: '+GLRig.failure);});
  else if (${NIGHT}) step('lightpass', () => drawLightPass());
  if (${LABELS}) {
    push(); scale(zoom); translate(-camX, -camY);
    textAlign(CENTER, CENTER); textSize(11 / zoom);
    for (const b of activeBuildings) {
      if (!inView(b.x, b.y, 400)) continue;
      let k = '';
      for (const q in b) if (q.charAt(0) === 'i' && q.charAt(1) === 's' && b[q] === true) { k = q.slice(2); break; }
      if (b.propType) k = b.propType;
      if (!k) continue;
      noStroke(); fill(0, 0, 0, 170);
      rect(b.x - 46 / zoom, b.y - 8 / zoom, 92 / zoom, 16 / zoom, 3 / zoom);
      fill(255, 235, 120); text(k, b.x, b.y);
    }
    pop();
  }

  // A scale bar, because "that oval is huge" needs a number behind it.
  push(); noStroke();
  fill(0, 0, 0, 150); rect(12, height - 44, 240, 32, 4);
  fill(255); textSize(12);
  text('1 chunk = ' + CHUNK_W + 'u', 22, height - 24);
  stroke(255); strokeWeight(2);
  line(120, height - 28, 120 + CHUNK_W * zoom * 0.25, height - 28);
  noStroke(); fill(255);
  text((CHUNK_W * 0.25) + 'u', 124, height - 34);
  pop();
  window.__done = true;
};
</script>`;

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME,
    args: ['--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader'] });
  const p = await browser.newPage({ viewport: { width: W, height: H } });
  const bad = [];
  p.on('pageerror', e => bad.push('page: ' + e.message));
  await p.setContent(page, { waitUntil: 'load' });
  await p.waitForFunction('window.__done === true', null, { timeout: 60000 })
        .catch(() => bad.push('draw() never completed'));
  const nCanvas = await p.evaluate('document.querySelectorAll("canvas").length');
  if (!nCanvas) {
    console.log('  no canvas: ' + JSON.stringify(await p.evaluate('window.__errs')));
    console.log('  ' + bad.join('\n  '));
    await browser.close(); process.exit(1);
  }
  const errs = await p.evaluate('window.__errs || []');
  const position = await p.evaluate('({x:window.__wx,y:window.__wy})');
  if (CIVIC) console.log('Civic terrace at ' + position.x + ', ' + position.y);
  const rig=await p.evaluate('({on:GLRig.on,ok:GLRig.ok,tier:GLRig.tier,lightTier:GLRig.lightTier,failure:GLRig.failure})');
  const file = path.join(OUT, `world-b${BIOME}${CIVIC ? '-civic' : ''}${PEOPLE ? '-people' : ''}${ACTORS ? '-actors' : ''}${ADVANCED ? '-advanced' : ''}${DISTRICT >= 0 ? '-district'+DISTRICT : ''}${RAIN ? '-rain' : ''}${LEGACY ? '-legacy' : ''}-h${HOUR}-${WX}_${WY}.png`);
  const snapshot=path.join(OUT,'game-'+GAME_HASH+'.js');
  fs.writeFileSync(snapshot,GAME_SOURCE);
  fs.writeFileSync(file.replace(/\.png$/,'.json'),JSON.stringify({game:GAME,gameSnapshot:snapshot,gameHash:GAME_HASH,p5:P5,position,zoom:ZOOM,hour:HOUR,rig,errors:errs.concat(bad)},null,2));
  try { await p.locator('#defaultCanvas0').screenshot({ path: file, timeout: 15000 }); }
  catch (e) {
    console.log('  screenshot failed: ' + e.message.split('\n')[0]);
    console.log('  canvases=' + nCanvas + ' done=' + await p.evaluate('window.__done'));
    console.log('  errs=' + JSON.stringify(await p.evaluate('window.__errs')));
    console.log('  page=' + bad.slice(0,3).join(' | '));
    await p.screenshot({ path: file });
  }
  await browser.close();
  if (errs.length) console.log('  ' + Array.from(new Set(errs)).join('\n  '));
  if (bad.length)  console.log('  ' + Array.from(new Set(bad)).slice(0, 3).join('\n  '));
  console.log('-> ' + file);
  if (errs.length || bad.length) process.exitCode = 1;
})();

// Real p5, real draw(), real Character.fire and pooled Bullet impacts. This
// fixture isolates hunting by omitting armies, but keeps generated geometry,
// particle pooling, blood floor banks, wildlife movement and the actual HUD.
const fs = require('fs'), path = require('path'), assert = require('assert'), crypto = require('crypto');
const deps = process.env.VIS_DEPS || '/workspace/onboarding-newone';
const { chromium } = require(path.join(deps, 'node_modules/playwright'));
const source = fs.readFileSync(process.env.GAME_JS || path.join(__dirname, '..', 'game.js'), 'utf8');
const p5 = fs.readFileSync(process.env.VIS_P5 || '/tmp/p5-1.9.4.min.js', 'utf8');
const out = process.env.WILDLIFE_SCENE_OUT || '/tmp/newone-wildlife-gameplay';
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'source-game.js'), source);
const fixture = `
window.preload=function(){};
window.setup=function(){createCanvas(1460,675);pixelDensity(1);noLoop();randomSeed(7);noiseSeed(BIOME_SEED);
 leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
 window.__ready=true;};
window.__initScene=function(){
 isStoryMode=true;started=true;isPaused=false;startAtLevel(2);
 isDead=false;isWin=false;killcamMode=false;inStoryIntro=false;inStoryRoom=false;
 inTownCutscene=false;inDarchonCall=false;inFarmCutscene=false;inFarmPostCutscene=false;
 inPostAmbushCutscene=false;inFortCutscene=false;inWorldBuildingMenu=false;inOverworldView=false;inTravelMenu=false;
 nm0AmbushActive=false;darchonCallCompleted=true;objectiveTimer=0;
 enemiesList.length=0;townCitizens.length=0;bullets.length=0;particles.length=0;
 refreshPopulation=function(){};refreshCityPeople=function(){};
 resetForestHuntingActivity();resetForestWildlife();_wildlifeSpawnClock=1e9;
 worldTimeMs=14/24*DAY_MS;isRaining=false;weather=null;updateSunVector();
 GLRig.on=false;GLRig.failure=GLRIG_SHED_MSG;window.isDesktop=false;
 window.__faults=[];const note=noteFrameFault;
 noteFrameFault=function(where,error){window.__faults.push(where+': '+error.message);return note(where,error);};
 window.__hits=[];const apply=applyForestWildlifeHit;
 applyForestWildlifeHit=function(a,h){const result=apply(a,h);window.__hits.push({id:a.id,weapon:h.weapon.name,
  x:h.x,y:h.y,angle:h.angle,head:h.head,damage:h.damage,result:{...result}});return result;};
 const paint=drawForestHuntingHud;
 drawForestHuntingHud=function(){
  const rectOld=window.rect,textOld=window.text,triangleOld=window.triangle;
  const seen={rects:[],texts:[],markers:0};
  window.rect=function(...args){seen.rects.push(args);return rectOld(...args);};
  window.text=function(...args){seen.texts.push(String(args[0]));return textOld(...args);};
  window.triangle=function(...args){if(args.join(',')==='12,0,-8,-7,-8,7')seen.markers++;return triangleOld(...args);};
  try{paint();}finally{window.rect=rectOld;window.text=textOld;window.triangle=triangleOld;}
  window.__hud={ageMs:_forestHuntingObjectiveAgeMs,opacity:forestHuntingNoticeOpacity(_forestHuntingObjectiveAgeMs),...seen};
 };
 window.__place=function(x,y){
  player.x=x;player.y=y;player.forceNudge();zoom=.77;
  camX=player.x-width/2/zoom;camY=player.y-height/2/zoom;
  viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;
  chunkMgr.update(x,y);chunkMgr.warmUp(120);chunkMgr.rebuildWorldArrays();activeBuildings=buildings;invalidateColIndex();
 };
 // p5 noLoop redraw() invokes the real scene. Explicit deltaTime makes these
 // deterministic frames represent the elapsed time a phone HUD experiences.
 window.__frame=function(ms=100){deltaTime=ms;redraw();return window.__hud;};
 const s=forestHuntingSite();window.__place(s.stewardX,s.stewardY+38);window.__frame();
 return {site:s,lodges:activeBuildings.filter(b=>b.forestHuntingLodge).length};
};
window.__clearHuntApproach=function(){
 const s=forestHuntingSite();window.__place(s.x,s.y+135);
 const a=wildlifeSpawnAnimal('ELK',player.x+205,player.y);a.angle=0;a.thinkAt=1e9;
 a.goalX=a.x;a.goalY=a.y;window.__elk=a;
 // Check the actual enlarged collider and production cover query, without
 // clearing props or stubbing collision in order to manufacture a hit.
 const stand=wildlifeCanStand(a,a.x,a.y);
 const cover=forestShotCover({prevX:player.x+28,prevY:player.y,x:a.x,y:a.y,w:WEAPONS.PISTOL},[],[]);
 return {stand,cover:{t:Number.isFinite(cover.t)?cover.t:null,kind:cover.kind||null},
  player:{x:player.x,y:player.y},animal:{x:a.x,y:a.y,r:a.bodyR,headR:a.headR},zoom};
};
window.__animalState=function(){const a=window.__elk;return {id:a.id,hp:a.hp,maxHp:a.maxHp,dead:a.dead,state:a.state,
 bodyR:a.bodyR,zoom,condition:a.condition,method:a.method,shots:a.shots,decals:a.decals.map(x=>({...x})),
 angle:a.angle,fall:a.fall&&{...a.fall},deathType:a.deathType,
 x:a.x,y:a.y,particles:particles.filter(p=>p.t==='BLOOD'||p.t==='BLOOD_SMOKE').map(p=>({type:p.t,x:p.x,y:p.y})),
 bloodChunks:Object.keys(bloodChunks).length,bloodPools:bloodPools.length};};
`;
const html = '<!doctype html><style>html,body{margin:0;background:#17251b}</style><script>' +
  '(function(){const m={};Object.defineProperty(window,"localStorage",{value:{getItem:k=>m[k]||null,setItem:(k,v)=>m[k]=String(v),removeItem:k=>delete m[k]}});})();' +
  '</script><script>' + p5 + '</script><script>' + source + '</script><script>' + fixture + '</script>';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VIS_CHROME || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1460, height: 675 } }), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true);
    const initial = await page.evaluate(() => window.__initScene());
    assert.equal(initial.lodges, 3);
    // Test the real game's entry notice away from the village before accepting
    // the quest. Its stage and timer advance only through normal scene draws.
    const notice = await page.evaluate(() => {
      const s=forestHuntingSite();window.__place(s.x+2200,s.y+900);window.__frame(100);
      const initial=window.__hud;for(let i=0;i<3;i++)window.__frame(100);
      return {initial,shown:window.__hud};
    });
    assert.ok(notice.initial.opacity > 0 && notice.initial.opacity < 1);
    assert.equal(notice.shown.opacity, 1); assert.equal(notice.shown.markers, 1);
    assert.ok(notice.shown.texts.some(t => t.includes('BOW LESSON')));
    await page.screenshot({ path: path.join(out, 'objective-brief-notice.png') });
    const expired = await page.evaluate(() => {for(let i=0;i<48;i++)window.__frame(100);return window.__hud;});
    assert.ok(expired.ageMs >= 4650); assert.equal(expired.opacity, 0);
    assert.equal(expired.markers, 1); assert.equal(expired.rects.length, 0); assert.equal(expired.texts.length, 0);
    await page.screenshot({ path: path.join(out, 'objective-marker-only.png') });
    await page.evaluate(() => {const s=forestHuntingSite();window.__place(s.stewardX,s.stewardY+38);window.__frame();});
    // Keyboard interaction is the actual game's F edge-trigger path.
    await page.keyboard.down('f'); await page.evaluate(() => window.__frame());
    await page.keyboard.up('f'); await page.evaluate(() => window.__frame());
    assert.equal(await page.evaluate(() => forestHuntingQuest.stage), 'HUNT');
    assert.equal(await page.evaluate(() => player.currentWeapon.name), 'BOW');
    const approach = await page.evaluate(() => window.__clearHuntApproach());
    assert.equal(approach.stand, true, 'The enlarged elk stands outside actual colliders');
    assert.equal(approach.cover.kind, null, 'Generated geometry leaves a clear shooting corridor');
    assert.ok(approach.animal.r > 31, 'The visible elk has the enlarged world-space body radius');
    await page.evaluate(() => { window.__frame(); });
    await page.screenshot({ path: path.join(out, 'live-elk-and-bow.png') });
    // A real pistol body shot leaves this large mammal alive. Stop on the first
    // production hit so the evidence retains its transient blood particles.
    const wounded = await page.evaluate(() => {
      player.currentWeapon=WEAPONS.PISTOL;player.mags.PISTOL=17;player.weaponAmmo.PISTOL=100;
      headAimToggle=false;player.aimAngle=0;player.fireTimer=0;player.fire(0);
      for(let i=0;i<30&&!window.__hits.length;i++)window.__frame(16.6667);
      return window.__animalState();
    });
    assert.equal(wounded.dead, false); assert.equal(wounded.hp, wounded.maxHp - 20);
    assert.equal(wounded.decals.length, 1); assert.equal(wounded.shots, 1);
    assert.ok(wounded.particles.some(p => p.type === 'BLOOD_SMOKE'));
    assert.ok(wounded.particles.some(p => p.type === 'BLOOD'));
    assert.ok(wounded.bloodChunks > 0);
    await page.screenshot({ path: path.join(out, 'living-elk-wound-blood.png') });
    const persistent = await page.evaluate(() => {for(let i=0;i<18;i++)window.__frame(16.6667);return window.__animalState();});
    assert.equal(persistent.decals.length, 1); assert.equal(persistent.dead, false);
    assert.deepEqual(persistent.decals, wounded.decals);
    await page.screenshot({ path: path.join(out, 'living-elk-persistent-wound.png') });
    // The wounded animal is fleeing normally. Aim a real arrow at its current
    // root using the game's HEAD mode rather than calling the hit helper.
    const lethal = await page.evaluate(() => {
      const a=window.__elk;player.currentWeapon=WEAPONS.BOW;headAimToggle=true;player.fireTimer=0;
      const angle=Math.atan2(a.y-player.y,a.x-player.x);player.aimAngle=angle;player.fire(angle);
      for(let i=0;i<30&&!a.dead;i++)window.__frame(16.6667);
      return window.__animalState();
    });
    assert.equal(lethal.dead, true); assert.equal(lethal.condition, 'PERFECT');
    assert.equal(lethal.method, 'BOW_HEAD'); assert.equal(lethal.deathType, 'HEADSHOT');
    assert.equal(lethal.decals.length, 2); assert.ok(lethal.fall.progress < 1);
    const impacts = await page.evaluate(() => window.__hits);
    assert.equal(impacts.length, 2);
    assert.ok(impacts.every(h => [h.x, h.y, h.angle].every(Number.isFinite)), 'Real pooled impacts supply contact position and incoming angle');
    await page.screenshot({ path: path.join(out, 'arrow-headshot-fall-start.png') });
    const settled = await page.evaluate(() => {for(let i=0;i<45;i++)window.__frame(16.6667);return window.__animalState();});
    assert.equal(settled.fall.progress, 1); assert.equal(settled.fall.poolStamped, true);
    assert.equal(settled.fall.angle, lethal.fall.angle); assert.equal(settled.angle, lethal.angle);
    assert.equal(settled.decals.length, 2); assert.ok(settled.bloodChunks > 0);
    await page.screenshot({ path: path.join(out, 'settled-carcass-wounds-baked-blood.png') });
    const faults = await page.evaluate(() => window.__faults);
    assert.deepEqual(errors, []); assert.deepEqual(faults, []);
    const report = { p5: await page.evaluate(() => window.p5.VERSION), sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
      initial, approach, wounded, persistent, lethal, impacts, settled, notice, expired, errors, faults };
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log('Wildlife real gameplay scene: enlarged elk, pistol wound/smoke, persistent decal, real arrow headshot, directional fall/baked blood and transient HUD passed (p5 ' + report.p5 + ').');
  } finally { await browser.close(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });

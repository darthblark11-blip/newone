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
window.__bowFrame=function(amount,angle){
 window.isDesktop=false;
 rightStick.active=amount>0;rightStick.dist=amount;
 rightStick.dx=-Math.cos(angle)*amount;rightStick.dy=-Math.sin(angle)*amount;
 leftStick.active=false;return window.__frame(1000/60);
};
window.__drawBow=function(angle){
 player.currentWeapon=WEAPONS.BOW;player.fireTimer=0;window.__bowFrame(0,angle);
 const arrows=player.weaponAmmo.BOW;
 for(let i=0;i<54;i++)window.__bowFrame(.12+.80*i/53,angle);
 return {arrowsBefore:arrows,arrowsDuring:player.weaponAmmo.BOW,aimAngle:player.aimAngle,
  tension:bowDrawAmount(player),quality:player.bowDrawState.quality,phase:player.bowDrawState.phase};
};
window.__walkFrame=function(dx,dy){
 window.isDesktop=false;rightStick.active=false;rightStick.dist=0;
 leftStick.active=!!(dx||dy);leftStick.dx=dx;leftStick.dy=dy;
 return window.__frame(1000/60);
};
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
      // Shooting from behind meets torso first even with HEAD mode enabled.
      headAimToggle=true;player.aimAngle=0;player.fireTimer=0;player.fire(0);
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
    // Return this effects fixture to the verified clear approach after its
    // natural flight response, then freeze it. Separate
    // cases below exercise live fear/aggression. Face it toward the shooter so
    // the anatomical head is exposed: BODY mode must still allow a real face
    // hit. The bow is drawn using production analog input and fired on release.
    const draw = await page.evaluate(approach => {
      const a=window.__elk;a.x=approach.animal.x;a.y=approach.animal.y;_wildlifeGridDirty=true;
      a.angle=Math.PI;a.vx=a.vy=0;a.goalX=a.x;a.goalY=a.y;
      a.thinkAt=a.sensorAt=1e9;a.state='GRAZE';a.alarm=0;
      headAimToggle=false;const head=wildlifeHeadPoint(a);
      window.__arrowAngle=Math.atan2(head.y-player.y,head.x-player.x);
      return window.__drawBow(window.__arrowAngle);
    }, approach);
    assert.equal(draw.arrowsDuring, draw.arrowsBefore, 'Holding the string cannot auto-fire');
    assert.ok(draw.tension>=.8&&draw.quality>=.7);
    await page.screenshot({ path: path.join(out, 'smooth-bow-draw-ready.png') });
    const lethal = await page.evaluate(() => {
      const a=window.__elk;window.__bowFrame(0,window.__arrowAngle);
      const arrow=bullets.find(b=>b.w===WEAPONS.BOW);
      window.__arrowRelease=arrow&&{power:arrow.arrowPower,dud:arrow.arrowDud,speed:Math.hypot(arrow.vx,arrow.vy)};
      for(let i=0;i<30&&!a.dead;i++)window.__bowFrame(0,window.__arrowAngle);
      return window.__animalState();
    });
    fs.writeFileSync(path.join(out,'arrow-impact-state.json'),JSON.stringify(await page.evaluate(()=>({
      angle:window.__arrowAngle,aimAngle:player.aimAngle,release:window.__arrowRelease,hits:window.__hits,
      animal:window.__animalState(),head:wildlifeHeadPoint(window.__elk),
      bullets:bullets.map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,weapon:b.w&&b.w.name,power:b.arrowPower,dud:b.arrowDud})),
      cover:forestShotCover({prevX:player.x+38,prevY:player.y,x:window.__elk.x,y:window.__elk.y,w:WEAPONS.BOW},[],[])
    })),null,2));
    assert.equal(lethal.dead, true); assert.equal(lethal.condition, 'PERFECT');
    assert.equal(lethal.method, 'BOW_HEAD'); assert.equal(lethal.deathType, 'HEADSHOT');
    assert.equal(lethal.decals.length, 2); assert.ok(lethal.fall.progress < 1);
    const impacts = await page.evaluate(() => window.__hits);
    assert.equal(impacts.length, 2);
    assert.equal(impacts[0].head, false, 'HEAD toggle cannot convert a rump hit into a headshot');
    assert.equal(impacts[1].head, true, 'BODY toggle cannot suppress a clean anatomical face hit');
    const release = await page.evaluate(() => window.__arrowRelease);
    assert.ok(release.power>=.55&&!release.dud);
    assert.ok(impacts.every(h => [h.x, h.y, h.angle].every(Number.isFinite)), 'Real pooled impacts supply contact position and incoming angle');
    await page.screenshot({ path: path.join(out, 'arrow-headshot-fall-start.png') });
    const settled = await page.evaluate(() => {for(let i=0;i<45;i++)window.__frame(16.6667);return window.__animalState();});
    assert.equal(settled.fall.progress, 1); assert.equal(settled.fall.poolStamped, true);
    assert.equal(settled.fall.angle, lethal.fall.angle); assert.equal(settled.angle, lethal.angle);
    assert.equal(settled.decals.length, 2); assert.ok(settled.bloodChunks > 0);
    await page.screenshot({ path: path.join(out, 'settled-carcass-wounds-baked-blood.png') });
    // Snap to the endstop: an unprepared string produces one short, weak
    // arrow, then stays latched even while the stick is held fully deflected.
    const abrupt = await page.evaluate(() => {
      resetForestWildlife();_wildlifeSpawnClock=1e9;bullets.length=0;
      const s=forestHuntingSite();window.__place(s.x,s.y+135);
      const a=wildlifeSpawnAnimal('ELK',player.x+205,player.y);a.angle=Math.PI;
      a.thinkAt=a.sensorAt=1e9;a.goalX=a.x;a.goalY=a.y;window.__elk=a;
      const h=wildlifeHeadPoint(a),angle=Math.atan2(h.y-player.y,h.x-player.x);
      player.currentWeapon=WEAPONS.BOW;player.fireTimer=0;window.__bowFrame(0,angle);
      const before=player.weaponAmmo.BOW;window.__bowFrame(1,angle);
      const b=bullets.find(b=>b.w===WEAPONS.BOW);
      const arrow=b&&{power:b.arrowPower,dud:b.arrowDud,speed:Math.hypot(b.vx,b.vy)};
      for(let i=0;i<36;i++)window.__bowFrame(1,angle);
      window.__endstopAngle=angle;
      return {before,after:player.weaponAmmo.BOW,arrow,phase:player.bowDrawState.phase,hp:a.hp,maxHp:a.maxHp,dead:a.dead};
    });
    assert.equal(abrupt.after,abrupt.before-1,'A held endstop cannot auto-fire a quiver');
    assert.ok(abrupt.arrow.dud&&abrupt.arrow.power<=.08&&abrupt.arrow.speed<7);
    assert.equal(abrupt.phase,'LATCHED'); assert.equal(abrupt.dead,false); assert.equal(abrupt.hp,abrupt.maxHp);
    await page.screenshot({ path: path.join(out, 'abrupt-bow-dud-reset-required.png') });
    const endstop = await page.evaluate(() => {
      const angle=window.__endstopAngle,draw=window.__drawBow(angle);
      window.__bowFrame(1,angle);const b=bullets.find(b=>b.w===WEAPONS.BOW);
      const arrow=b&&{power:b.arrowPower,dud:b.arrowDud,speed:Math.hypot(b.vx,b.vy)};
      for(let i=0;i<36;i++)window.__bowFrame(1,angle);
      return {draw,arrow,after:player.weaponAmmo.BOW,phase:player.bowDrawState.phase,animal:window.__animalState()};
    });
    assert.equal(endstop.after,endstop.draw.arrowsBefore-1);
    assert.ok(!endstop.arrow.dud&&endstop.arrow.power>=.55);
    assert.equal(endstop.phase,'LATCHED'); assert.equal(endstop.animal.dead,true);
    assert.equal(endstop.animal.condition,'PERFECT'); assert.equal(endstop.animal.method,'BOW_HEAD');
    await page.screenshot({ path: path.join(out, 'controlled-draw-endstop-release.png') });
    const collision = await page.evaluate(() => {
      resetForestWildlife();_wildlifeSpawnClock=1e9;bullets.length=0;rightStick.active=false;rightStick.dist=0;
      const s=forestHuntingSite();window.__place(s.x,s.y+135);player.currentWeapon=WEAPONS.PISTOL;
      const start={x:player.x,y:player.y},a=wildlifeSpawnAnimal('ELK',player.x+110,player.y);
      a.angle=0;a.thinkAt=a.sensorAt=1e9;a.goalX=a.x;a.goalY=a.y;
      for(let i=0;i<80;i++)window.__walkFrame(1,0);
      const blocked={x:player.x,y:player.y,metric:wildlifeBodyMetric(a,player.x,player.y,wildlifeActorRadius(player))};
      for(let i=0;i<35;i++)window.__walkFrame(0,1);
      for(let i=0;i<90;i++)window.__walkFrame(1,0);
      leftStick.active=false;
      return {start,blocked,passed:{x:player.x,y:player.y},animal:{x:a.x,y:a.y,r:a.bodyR}};
    });
    fs.writeFileSync(path.join(out,'collision-state.json'),JSON.stringify(collision,null,2));
    assert.ok(collision.blocked.x>collision.start.x+10,'The real walking input reaches the animal');
    assert.ok(collision.blocked.x<collision.animal.x&&collision.blocked.metric>=1,'A large animal stops player penetration');
    assert.ok(collision.passed.x>collision.animal.x+20,'Walking around the animal remains possible');
    await page.screenshot({ path: path.join(out, 'large-animal-collision-walk-around.png') });
    const fear = await page.evaluate(() => {
      const s=forestHuntingSite(),rows=[];
      for(const species of ['MULE_DEER','BLACK_BEAR']){
        resetForestWildlife();_wildlifeSpawnClock=1e9;window.__place(s.x,s.y+135);
        const a=wildlifeSpawnAnimal(species,player.x+205,player.y);a.angle=0;
        a.goalX=a.x;a.goalY=a.y;a.thinkAt=1e9;
        const initial=Math.hypot(a.x-player.x,a.y-player.y);
        for(let i=0;i<24;i++)window.__frame(1000/60);
        rows.push({species,initial,distance:Math.hypot(a.x-player.x,a.y-player.y),state:a.state,aggressor:!!a.aggressor});
      }
      return rows;
    });
    assert.ok(fear.every(a=>a.state==='FLEE'&&!a.aggressor),'Timid grazers and black bears flee human proximity');
    assert.ok(fear.every(a=>a.distance>a.initial+15),'Flight starts before the human can walk into the animal');
    await page.screenshot({ path: path.join(out, 'shy-black-bear-human-flight.png') });
    const warning = await page.evaluate(() => {
      resetForestWildlife();_wildlifeSpawnClock=1e9;const s=forestHuntingSite();window.__place(s.x,s.y+135);
      const a=wildlifeSpawnAnimal('GRIZZLY_BEAR',player.x+115,player.y);a.angle=Math.PI;
      a.goalX=a.x;a.goalY=a.y;window.__grizzly=a;player.shield=100;
      const health=player.hp,armor=player.shield;
      for(let i=0;i<16;i++)window.__frame(1000/60);
      return {state:a.state,intrusion:a.intrusion,aggressor:!!a.aggressor,hp:player.hp,armor:player.shield,healthBefore:health,armorBefore:armor};
    });
    assert.equal(warning.state,'WARNING');assert.equal(warning.aggressor,false);
    assert.equal(warning.hp,warning.healthBefore);assert.equal(warning.armor,warning.armorBefore);
    await page.screenshot({ path: path.join(out, 'grizzly-personal-space-warning.png') });
    const aggression = await page.evaluate(() => {
      for(let i=0;i<95;i++)window.__frame(1000/60);
      const a=window.__grizzly;return {state:a.state,intrusion:a.intrusion,aggressor:a.aggressor===player,
        hp:player.hp,armor:player.shield,distance:Math.hypot(a.x-player.x,a.y-player.y)};
    });
    assert.equal(aggression.state,'TERRITORIAL');assert.equal(aggression.aggressor,true);
    assert.ok(aggression.hp<warning.hp||aggression.armor<warning.armor,'Lingering in grizzly space can cause a real melee hit');
    await page.screenshot({ path: path.join(out, 'grizzly-lingering-player-charge.png') });
    const retreat = await page.evaluate(() => {
      const a=window.__grizzly;window.__place(a.x-500,a.y);
      for(let i=0;i<24;i++)window.__frame(1000/60);
      return {state:a.state,aggressor:!!a.aggressor,retreatUntil:a.retreatUntil,clock:_wildlifeClock};
    });
    assert.equal(retreat.state,'FLEE');assert.equal(retreat.aggressor,false);assert.ok(retreat.retreatUntil>retreat.clock);
    await page.screenshot({ path: path.join(out, 'grizzly-disengages-after-player-retreat.png') });
    const faults = await page.evaluate(() => window.__faults);
    assert.deepEqual(errors, []); assert.deepEqual(faults, []);
    const report = { p5: await page.evaluate(() => window.p5.VERSION), sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
      initial, approach, wounded, persistent, draw, release, lethal, impacts, settled, abrupt, endstop, collision, fear,
      warning, aggression, retreat, notice, expired, errors, faults };
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log('Wildlife real gameplay scene: anatomical toggle-independent impacts, wounds/blood/death, inverted smooth draw/release, abrupt dud/endstop latch and transient HUD passed (p5 ' + report.p5 + ').');
  } finally { await browser.close(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });

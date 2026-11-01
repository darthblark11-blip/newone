// Club progression uses the existing boxing solver. The first opponent is
// beaten with native keyboard input; later explicit knockouts exercise the
// one-at-a-time ladder and lifecycle without pretending to be a playthrough.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let checks = 0, now = 7000, stored = null;
ctx.millis = () => now;
ctx.mouseButton = ctx.LEFT;
ctx.localStorage = {getItem(){return stored;}, setItem(k, v){stored = v;}, removeItem(){stored = null;}};
const keys = new Set(); ctx.keyIsDown = code => keys.has(code);
const run = source => probe(source);
function check(source, label){assert.ok(run(source), label); checks++;}
function tick(n = 1){
  for(let i = 0; i < n; i++){
    ctx.deltaTime = 16.67; now += 16.67;
    run('updateFrontierSaloonActivity();');
  }
}
function ready(){run(`started=true;doTick=true;isPaused=isDead=isWin=killcamMode=false;
  inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inWorldBuildingMenu=inOverworldView=inTravelMenu=inStoryIntro=inDarchonCall=false;`);}
function button(action){
  const b = run(`frontierSaloonButtons().find(b=>b.action===${JSON.stringify(action)})`);
  assert.ok(b, 'Visible '+action+' club control'); checks++;
  ctx.mouseX=b.x+b.w/2;ctx.mouseY=b.y+b.h/2;run('touchStarted();');
}
function settleRound(){
  let frames = 0;
  while(frames++ < 420 && run('_frontierSaloonSession.brawl==="INTERMISSION"')) tick();
  assert.ok(frames < 420, 'The committed punch and knockout finish the breather'); checks++;
}
function nextRound(){
  settleRound();
  check('_frontierSaloonSession.brawl==="READY"&&!boxingActive(player)&&!player.cityBoxingGloves', 'Between opponents the player can rest with gloves and stance removed');
  run('player.x=0;player.y=CITY_BOXING_CLUB_RING.bottom-24;interactFrontierSaloonActivity();');
  button('BRAWL');
  check('_frontierSaloonSession.brawl==="ACTIVE"', 'The trainer admits the next boxer only on request');
}
run(`leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
  isStoryMode=false;resetStoryProgress();startAtLevel(1);`); ready();
run(`var clubChunk=generateChunkContent(1,3,9);
  var clubSite=clubChunk.solid.find(b=>b.cityVenue==='BOXING'&&!b.cityVenueSecondary);
  buildings=clubChunk.solid;activeBuildings=buildings;invalidateColIndex();
  player.x=clubSite.cityEntrance.x;player.y=clubSite.cityEntrance.y;`);
run('var clubPlayerBefore=player;player=null;var clubMissingPlayer=cityBoxingClubSites();player=clubPlayerBefore;');
check('clubMissingPlayer===null', 'An absent player cannot resolve a city entrance');
check('clubSite&&/EIGHT COUNT/.test(clubSite.cityVenueName)', 'The authored Eight Count exterior supplies a real entrance');
check('!player.checkCol(player.x,player.y)', 'The generated entrance is on reachable exterior ground');
check('cityBoxingClubInteraction()&&!cityBoxingClubInteraction().unlocked&&!enterCityBoxingClub(clubSite)', 'A new campaign sees the locked club and cannot enter');
check('!cityBoxingClubMarker()', 'A locked campaign has no gym navigation marker');
check('!enterFrontierSaloon()&&!enterFrontierSaloon("SALOON",clubSite)', 'Generic and direct scene entry cannot bypass the locked city doorway');
run('updateFrontierSaloonActivity(false);');
check('_frontierSaloonPrompt&&_frontierSaloonPrompt.kind==="CITY_BOXING"&&!_frontierSaloonPrompt.unlocked&&frontierSaloonButtons().some(b=>/LOCKED/.test(b.label))', 'The public city prompt identifies the locked club');
run(`player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;
  updateFrontierSaloonActivity(false);`);
check('!_frontierSaloonPrompt', 'The old Copper Spur doorstep cannot show a Level 3 prompt in the city');
run('player.x=clubSite.cityEntrance.x;player.y=clubSite.cityEntrance.y;');
run('markSectorTowersDown(1);');
check('!cityBoxingClubUnlocked()&&!enterCityBoxingClub(clubSite)', 'Owning the starting fortress alone does not open the club');
check('!cityBoxingClubMarker()', 'The gym marker waits for both original fortresses');
run('outpostFortState(1,"RELAY_SW").captured=true;');
check('!cityBoxingClubUnlocked()&&!enterCityBoxingClub(clubSite)', 'Capturing a later relay does not substitute for the primary NM-0 relay');
run('outpostFortState(1).captured=true;');
check('cityBoxingClubUnlocked()&&cityBoxingClubInteraction().unlocked', 'Owning both required fortresses opens Eight Count');
check('!cityBoxingClubMarker()&&cityBoxingClubDestination().x===clubSite.cityEntrance.x&&cityBoxingClubDestination().y===clubSite.cityEntrance.y', 'The unlocked destination matches the real doorstep and hides navigation nearby');
run('var navBuildings=buildings;buildings=[];camX=camY=0;player.x=clubSite.cityEntrance.x-1500;');
check('cityBoxingClubMarker().edge&&buildings.length===0', 'The distant gym stays marked while its chunk is unloaded without adding world geometry');
run('player.x=clubSite.cityEntrance.x-900;');
check('!cityBoxingClubMarker()', 'The gym arrow hides at the 900-unit nearby boundary');
run('player.x=clubSite.cityEntrance.x-901;');
check('cityBoxingClubMarker().edge', 'The gym arrow appears beyond the nearby boundary');
run('isPaused=true;');check('!cityBoxingClubMarker()', 'Pause hides world gym navigation');
run('isPaused=false;buildings=navBuildings;player.x=clubSite.cityEntrance.x;');
run('inOverworldView=true;updateFrontierSaloonActivity(false);');
check('!cityBoxingClubMarker()&&cityBoxingClubInteraction().unlocked&&frontierSaloonButtons().some(b=>b.action==="INTERACT")', 'Liberated overworld exploration keeps nearby entry available without a navigation marker');
button('INTERACT');
check('frontierSaloonIsInside()&&inOverworldView', 'The real touch button enters from zoomed-out city exploration');
run('exitFrontierSaloon();');
check('inOverworldView&&player.x===clubSite.cityEntrance.x&&player.y===clubSite.cityEntrance.y', 'Leaving preserves the original exploration mode and position');
run('inOverworldView=false;');

// The reported missing button happened on the visible forecourt, farther than
// the old 100-unit doorstep circle. Both mirrored venues use the same lane.
for(const cx of [3,-4]){
  run(`var approachChunk=generateChunkContent(1,${cx},9);
    var approachGym=approachChunk.solid.find(b=>b.cityVenue==='BOXING'&&!b.cityVenueSecondary);
    buildings=activeBuildings=approachChunk.solid;invalidateColIndex();
    var approachFace=approachGym.cityEntrance.face;
    player.x=approachGym.x;player.y=approachGym.y+approachFace*(approachGym.h/2+300);
    var approachOutside={x:player.x,y:player.y};updateFrontierSaloonActivity(false);`);
  check('!player.checkCol(player.x,player.y)&&cityBoxingClubInteraction().unlocked', 'The '+cx+' gym offers entry from its reachable central forecourt');
  button('INTERACT');
  check('frontierSaloonIsInside()&&!cityBoxingClubMarker()', 'The '+cx+' forecourt entry button opens the gym and hides its exterior marker');
  run('exitFrontierSaloon();');
  check('player.x===approachOutside.x&&player.y===approachOutside.y', 'Leaving returns to the exact forecourt entry position');
  for(const [label,position] of [
    ['side lane','player.x=approachGym.x+101;'],
    ['interior footprint','player.x=approachGym.x;player.y=approachGym.y;'],
    ['rear wall','player.x=approachGym.x;player.y=approachGym.y-approachFace*(approachGym.h/2+30);'],
    ['distant courtyard','player.x=approachGym.x;player.y=approachGym.y+approachFace*(approachGym.h/2+441);']
  ]){
    run(position+'updateFrontierSaloonActivity(false);');
    check('!cityBoxingClubInteraction()&&!enterCityBoxingClub(approachGym)&&!enterFrontierSaloon("SALOON",approachGym)', 'The '+cx+' '+label+' cannot enter through a wall or from outside the approach');
  }
}
run('buildings=activeBuildings=clubChunk.solid;invalidateColIndex();player.x=clubSite.cityEntrance.x;player.y=clubSite.cityEntrance.y;updateFrontierSaloonActivity(false);');
const priorSize={w:ctx.width,h:ctx.height};
for(const [w,h] of [[390,844],[844,390]]){
  ctx.width=w;ctx.height=h;
  const layout=run('({button:frontierSaloonButtons()[0],aim:touchAimSilhouetteLayout(),stance:stanceTouchButton()})');
  const b=layout.button,overlaps=r=>b.x<r.x+r.w&&b.x+b.w>r.x&&b.y<r.y+r.h&&b.y+b.h>r.y;
  assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=w&&b.y+b.h<=h,'The entry button fits '+w+'×'+h);checks++;
  assert.ok(!overlaps(layout.aim)&&!overlaps({...layout.stance,x:layout.stance.x-layout.stance.w/2,y:layout.stance.y-layout.stance.h/2}),'The entry button clears aiming and crouch controls at '+w+'×'+h);checks++;
}
ctx.width=390;ctx.height=844;
run('var navView={zoom,camX,camY};zoom=.45;player.y=clubSite.y+clubSite.cityEntrance.face*(clubSite.h/2+300);camX=player.x-width/(2*zoom);camY=player.y-height/(2*zoom);updateFrontierSaloonActivity(false);');
check('!cityBoxingClubMarker()&&frontierSaloonButtons().some(b=>b.action==="INTERACT")', 'The nearby portrait approach keeps its entry button without a doorway pin');
run('player.x=clubSite.cityEntrance.x-1500;camX=camY=0;');
const markerPaint={rects:[],arrows:[],labels:[]},markerNative={rect:ctx.rect,triangle:ctx.triangle,text:ctx.text};
ctx.rect=(...args)=>{markerPaint.rects.push(args);return markerNative.rect(...args);};
ctx.triangle=(...args)=>{markerPaint.arrows.push(args);return markerNative.triangle(...args);};
ctx.text=(label,...args)=>{markerPaint.labels.push(String(label));return markerNative.text(label,...args);};
try{run('drawCityBoxingClubMarker();');}finally{Object.assign(ctx,markerNative);}
assert.ok(markerPaint.arrows.length>0&&markerPaint.labels.some(label=>/EIGHT COUNT|BOXING/.test(label))&&markerPaint.labels.some(label=>/\d+\s*m\b/.test(label)), 'Distant gym navigation paints an arrow, venue label and distance');checks++;
assert.ok(markerPaint.rects.length===0&&!markerPaint.labels.includes('8'), 'Gym navigation uses no banner rectangle or local eight pin');checks++;
run('zoom=navView.zoom;camX=navView.camX;camY=navView.camY;player.x=clubSite.cityEntrance.x;player.y=clubSite.cityEntrance.y;');
ctx.width=priorSize.w;ctx.height=priorSize.h;
run('player.x=clubSite.cityEntrance.x+200;');
check('!enterCityBoxingClub(clubSite)&&!enterFrontierSaloon("SALOON",clubSite)', 'Unlocked entry still requires the real exterior doorstep');
run('player.x=clubSite.cityEntrance.x;');
// Exercise the real world input dispatchers as well as the interior controls.
run('_frontierSaloonPrompt=null;');
const clubHudLabels=[],oldText=ctx.text;
ctx.text=(label,...args)=>{clubHudLabels.push(String(label));return oldText(label,...args);};
try{run('draw();');}finally{ctx.text=oldText;}
check('_frontierSaloonPrompt&&_frontierSaloonPrompt.kind==="CITY_BOXING"&&_frontierSaloonPrompt.unlocked', 'The main city draw loop refreshes the club doorway prompt');
assert.ok(clubHudLabels.some(label=>/ENTER EIGHT COUNT/.test(label)), 'The main city HUD paints the club entry control');checks++;
run('setMeleeTool("NONE");window.__huntKeyWas=false;');
keys.add(70);run('handleDesktop();');keys.clear();
check('frontierSaloonIsInside()&&_frontierSaloonSession.venue==="CITY_BOXING"', 'Desktop F enters through the Level 1 world dispatcher');
run('exitFrontierSaloon();window.__huntKeyWas=false;');
let clubPad={connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:i===0,value:i===0?1:0}))};
const oldGamepads=ctx.navigator.getGamepads;
ctx.navigator.getGamepads=()=>[clubPad];
run('prevGamepadButtons=[];handleGamepad();');
check('frontierSaloonIsInside()&&_frontierSaloonSession.venue==="CITY_BOXING"', 'Gamepad A enters through the Level 1 world dispatcher');
clubPad=null;ctx.navigator.getGamepads=oldGamepads;run('exitFrontierSaloon();prevGamepadButtons=[];');
run('beginWorldBoxing(player);interactWorldBoxingActivity();');
check('frontierSaloonIsInside()&&!boxingActive(player)', 'World boxing interaction lowers the stance and enters the city club');
run('exitFrontierSaloon();');
run(`swordPickedUp=shotgunUnlocked=rocketLauncherUnlocked=true;
  setMeleeTool('SWORD');player.currentWeapon=WEAPONS.SHOTGUN;
  player.weaponAmmo.SHOTGUN=3;player.mags.SHOTGUN=2;
  player.weaponAmmo['ROCKET LAUNCHER']=1;player.mags['ROCKET LAUNCHER']=4;
  player.isArmed=true;player.mountUp(.4);cowboyCostumeOwned=cowboySuitEquipped=true;
  var clubOutside={x:player.x,y:player.y,weapon:player.currentWeapon,mounted:player.mounted,
    ammo:JSON.stringify(player.weaponAmmo),mags:JSON.stringify(player.mags),
    horse:JSON.stringify([player.mountCoat.levels,player.mountMane.levels,player.mountSock,player.mountWalk]),score,kills:totalKills,
    enemies:enemiesList.slice(),buildings:buildings.slice(),corpses:corpses.length,
    particles:particles.length,bullets:bullets.length,hp:player.hp,
    skin:player.skinCol,shirt:player.shirtCol,pants:player.pantsCol,
    gloves:Object.hasOwn(player,'cityBoxingGloves'),gloveOz:Object.hasOwn(player,'cityBoxingGloveOz')};
  updateFrontierSaloonActivity(false);`);
check('_frontierSaloonPrompt&&_frontierSaloonPrompt.kind==="CITY_BOXING"&&_frontierSaloonPrompt.unlocked&&frontierSaloonButtons().some(b=>/ENTER EIGHT COUNT/.test(b.label))', 'The unlocked public prompt offers Eight Count entry');
button('INTERACT');
check('frontierSaloonIsInside()&&_frontierSaloonSession.venue==="CITY_BOXING"&&_frontierSaloonSession.arena==="CITY_BOXING"', 'The club reuses the isolated activity session');
check('!player.mounted&&!player.isArmed&&meleeTool()==="NONE"&&!frontierSaloonBlocked(player.x,player.y)', 'Entry holsters campaign gear on an open indoor floor');
check('!player.cityBoxingGloves&&!frontierSaloonBlocked(0,CITY_BOXING_CLUB_RING.bottom)&&frontierSaloonBlocked(CITY_BOXING_CLUB_RING.right,0)', 'Free walking leaves the south ring gate open and the side ropes solid');
check('enemiesList.length===clubOutside.enemies.length&&clubOutside.enemies.every((e,i)=>enemiesList[i]===e)&&clubOutside.buildings.every((b,i)=>buildings[i]===b)', 'Local club actors leave campaign arrays in place');
check('!startFrontierQuickDraw()', 'Club entry cannot start the western quick-draw activity');
run('drawFrontierSaloonScene();'); checks++;
// Reach the trainer through the public scene interaction. The trainer is the
// club equivalent of Mae, so its approach uses the shared counter seam.
run(`player.x=CITY_BOXING_CLUB_ROOM.trainer.x;player.y=CITY_BOXING_CLUB_ROOM.trainer.y+45;
  interactFrontierSaloonActivity();`);
check('_frontierSaloonSession.menu&&!frontierSaloonButtons().some(b=>b.action==="DUEL")', 'Talking to the trainer opens a sparring-only menu');
button('BRAWL');
check('_frontierSaloonSession.brawl==="ACTIVE"&&_frontierSaloonSession.fighters.length===1&&boxingActive(player)', 'The trainer starts exactly one live opponent with native boxing controls');
check('_frontierSaloonSession.fighters.every(c=>boxingActive(c)&&c.isUnarmed&&!c.dead&&!enemiesList.includes(c))', 'Sparring opponents are nonlethal local boxers');
check('player.cityBoxingGloves&&player.cityBoxingGloveOz===8&&_frontierSaloonSession.fighters.every(c=>c.cityBoxer&&c.cityBoxingGloves&&c.cityBoxingGloveOz===8)', 'The activity gives both fighters compact eight-ounce gloves');
check('_frontierSaloonSession.fighters.every(c=>c.cityBoxer&&c.shirtCol===c.skinCol&&!c.vestCol&&!headwearOf(c))', 'The local boxer uses the bare muscular torso and has no western headwear');
check('frontierSaloonBlocked(CITY_BOXING_CLUB_RING.right,0)&&frontierSaloonBlocked(0,CITY_BOXING_CLUB_RING.bottom)&&!frontierSaloonBlocked(0,0)', 'Active sparring closes the south gate and bounds native movement to the ring');
check('!startFrontierSaloonBrawl()&&!startFrontierQuickDraw()', 'An active club round cannot be reset or changed into a duel');
check('!frontierSaloonCanLeave()&&!frontierSaloonButtons().some(b=>b.action==="EXIT")', 'The doorway does not interrupt an active bout');
run(`var clubEvents=[],clubHit=frontierSaloonBoxingHit;
  frontierSaloonBoxingHit=function(e){clubEvents.push(e.outcome);return clubHit(e);};`);
const guardKeys={N:[38],NE:[38,39],E:[39],SE:[39,40],S:[40],SW:[40,37],W:[37],NW:[37,38]};
let holding = false, frames = 0;
const skins = new Set([run('_frontierSaloonSession.fighters[0].skinCol.levels.slice(0,3).join(",")')]);
const names = new Set([run('_frontierSaloonSession.fighters[0].name')]);
for(; frames < 2100 && run('_frontierSaloonSession.brawl==="ACTIVE"'); frames++){
  keys.clear();
  const q=run(`(()=>{const s=_frontierSaloonSession,t=boxingTarget(player,s.fighters),
    incoming=s.fighters.find(c=>boxingActive(c)&&c._boxing.punch&&c._boxing.punch.elapsedMs>c._boxing.punch.windupMs-95);
    return {distance:t?Math.hypot(t.x-player.x,t.y-player.y):999,
      guard:incoming?boxingPunchSector(incoming._boxing.punch.kind,incoming._boxing.punch.level):null,
      ready:!player._boxing.punch&&player._boxing.cooldownMs<=0};})()`);
  if(q.guard) for(const code of guardKeys[q.guard]) keys.add(code);
  if(q.distance<43&&q.ready&&!holding){keys.add(69);holding=true;}else holding=false;
  tick();
}
keys.clear();tick();
assert.ok(frames < 2100, 'Native E/guard input finishes the first club round'); checks++;
check('_frontierSaloonSession.brawl==="INTERMISSION"&&clubEvents.includes("HIT")', 'Actual contact defeats the first opponent and starts a breather');
check('_frontierSaloonSession.fighters.length===1&&_frontierSaloonSession.fighters[0].knockedOut&&!_frontierSaloonSession.fighters[0].dead', 'The defeated boxer has a native nonfatal knockout');
check('totalKills===clubOutside.kills&&corpses.length===clubOutside.corpses', 'Sparring does not create campaign kills or corpses');
for(let round=2;round<=8;round++){
  nextRound();
  check('_frontierSaloonSession.fighters.length===1&&_frontierSaloonSession.fighters.filter(boxingAlive).length===1', 'Round '+round+' admits one live boxer');
  check('_frontierSaloonSession.fighters.every(c=>c.cityBoxer&&c.shirtCol===c.skinCol&&!c.vestCol&&!headwearOf(c)&&c.cityBoxingGloveOz===8)', 'Round '+round+' keeps the shirtless compact-glove appearance');
  skins.add(run('_frontierSaloonSession.fighters[0].skinCol.levels.slice(0,3).join(",")'));
  names.add(run('_frontierSaloonSession.fighters[0].name'));
  check('_frontierSaloonSession.arena==="CITY_BOXING"&&!frontierSaloonBlocked(player.x,player.y)&&_frontierSaloonSession.fighters.every(c=>!frontierSaloonBlocked(c.x,c.y))', 'Round '+round+' stays within the club ring');
  run('_frontierSaloonSession.fighters.forEach(c=>frontierSaloonKnockOut(c,0,{kind:"LEFT_HOOK",level:"HEAD",damage:100}));');tick();
}
assert.equal(skins.size,8, 'The eight opponents have distinct skin palettes'); checks++;
assert.equal(names.size,8, 'The circuit presents eight named opponents'); checks++;
settleRound();
check('_frontierSaloonSession.brawl==="CLEARED"&&_frontierSaloonSession.club.completed&&!boxingActive(player)&&!player.cityBoxingGloves', 'Eight defeated opponents complete the circuit and leave the player free to exit');
check('_frontierSaloonSession.downFighters.length<=12&&_frontierSaloonSession.arena==="CITY_BOXING"&&!frontierSaloonProgress.brawlCleared', 'The finite circuit has a bounded floor-body pool and never awards the western gauntlet');
run('player.x=0;player.y=CITY_BOXING_CLUB_RING.bottom-24;interactFrontierSaloonActivity();');button('BRAWL');
check('_frontierSaloonSession.brawl==="ACTIVE"&&_frontierSaloonSession.club.round===1', 'The trainer offers a fresh circuit after eight rounds');
run('isPaused=true;var clubPause=JSON.stringify({x:player.x,y:player.y,brawl:_frontierSaloonSession.brawl,gauntlet:_frontierSaloonSession.gauntlet,club:_frontierSaloonSession.club});');tick(60);
check('JSON.stringify({x:player.x,y:player.y,brawl:_frontierSaloonSession.brawl,gauntlet:_frontierSaloonSession.gauntlet,club:_frontierSaloonSession.club})===clubPause', 'Pause freezes round progression and player coordinates');
run('saveGame();');
const saved = JSON.parse(stored);
assert.equal(saved.playerX,run('clubOutside.x'),'Save records the exterior X'); checks++;
assert.equal(saved.playerY,run('clubOutside.y'),'Save records the exterior Y'); checks++;
assert.equal(saved.meleeToolSel,'SWORD','Save records the original melee tool'); checks++;
run('exitFrontierSaloon();');
check('player.x===clubOutside.x&&player.y===clubOutside.y&&player.currentWeapon===clubOutside.weapon&&player.mounted&&meleeTool()==="SWORD"&&cowboySuitEquipped&&!boxingActive(player)', 'Exit restores the exact exterior position, gear, mount and costume');
check('player.skinCol===clubOutside.skin&&player.shirtCol===clubOutside.shirt&&player.pantsCol===clubOutside.pants', 'Club participation preserves the player clothing and skin');
check('Object.hasOwn(player,"cityBoxingGloves")===clubOutside.gloves&&Object.hasOwn(player,"cityBoxingGloveOz")===clubOutside.gloveOz', 'Exit removes only the club temporary glove properties');
check('JSON.stringify(player.weaponAmmo)===clubOutside.ammo&&JSON.stringify(player.mags)===clubOutside.mags', 'Club boxing does not spend or refill campaign ammo');
run('loadGame();'); ready();
check('!frontierSaloonIsInside()&&!boxingActive(player)&&player.x===clubOutside.x&&player.y===clubOutside.y&&player.currentWeapon===clubOutside.weapon&&meleeTool()==="SWORD"&&cowboySuitEquipped', 'Loading a club save resumes outside with original equipment and owned costume');
check('!Object.hasOwn(player,"cityBoxingGloves")&&!Object.hasOwn(player,"cityBoxingGloveOz")', 'Loading resumes without temporary activity gloves');
check('!cityBoxingClubMarker()&&cityBoxingClubUnlocked()&&cityBoxingClubDestination()', 'Loading owned fortresses keeps the unlocked destination while nearby navigation stays hidden');
check('JSON.stringify(player.weaponAmmo)===clubOutside.ammo&&JSON.stringify(player.mags)===clubOutside.mags', 'Loading the activity snapshot retains exact nonfull ammo and reserves');
check('player.mounted&&JSON.stringify([player.mountCoat.levels,player.mountMane.levels,player.mountSock,player.mountWalk])===clubOutside.horse', 'Loading the activity restores the exterior horse and its appearance');
run(`buildings=clubChunk.solid;activeBuildings=buildings;invalidateColIndex();
  player.x=clubSite.cityEntrance.x;player.y=clubSite.cityEntrance.y;
  enterCityBoxingClub(clubSite);startCityBoxingClubSparring();_frontierSaloonSession.grit=0;
  var clubBeforeKO=player.hp;`);tick();
check('_frontierSaloonSession.brawl==="KNOCKOUT"&&player.knockedOut&&player.stunPose&&player.hp===Math.max(1,clubBeforeKO-12)', 'Losing uses the existing native player knockout with one nonfatal penalty');
tick(180);
check('_frontierSaloonSession.brawl==="LOST"&&!player.knockedOut&&!player.stunPose&&player.hp===Math.max(1,clubBeforeKO-12)', 'The native get-up completes into a clean retry state');
check('startCityBoxingClubSparring()&&_frontierSaloonSession.fighters.length===1&&boxingActive(player)', 'A recovered player can retry a fresh one-on-one bout');
run(`player.x=CITY_BOXING_CLUB_RING.right-17;player.y=0;
  boxingRequestDodge(player,'RIGHT',1,0);
  for(let step=0;step<30;step++)boxingUpdate(player,16.67,_frontierSaloonSession.fighters,frontierSaloonBoxingMove);`);
check('player.x<=CITY_BOXING_CLUB_RING.right-16&&!frontierSaloonBlocked(player.x,player.y)', 'Native stepped head movement remains inside the closed ring');
// Exit the stance, ask the reachable trainer to stop, then walk through the
// reopened ring gate to the actual door. This is distinct from the pause exit.
run(`boxingExit(player);player.x=0;player.y=CITY_BOXING_CLUB_RING.bottom-24;
  interactFrontierSaloonActivity();`);
check('_frontierSaloonSession.menu&&frontierSaloonButtons().some(b=>b.action==="CLUB_STOP")', 'The trainer can end sparring while the player has lowered the stance');
button('CLUB_STOP');
check('_frontierSaloonSession.brawl==="IDLE"&&!boxingActive(player)&&!player.cityBoxingGloves', 'Ending sparring clears combat and removes temporary player gloves');
run('for(let step=0;step<70;step++)frontierSaloonMove(player,0,4);');
check('player.y>CITY_BOXING_CLUB_ROOM.door.y-50&&frontierSaloonCanLeave()', 'The player can walk through the ring gate back to the exit');
button('EXIT');
check('!frontierSaloonIsInside()&&player.x===clubOutside.x&&player.y===clubOutside.y', 'The actual doorway leaves at the saved city position');
run('enterCityBoxingClub(clubSite);startCityBoxingClubSparring();');
run(`isPaused=true;frontierSaloonAction('SHOP');`);
check('!frontierSaloonIsInside()&&isPaused&&pauseMenuState==="SHOP"&&player.x===clubOutside.x&&player.y===clubOutside.y&&!boxingActive(player)', 'The existing pause-to-shop path cleanly restores the city exterior');
run(`isPaused=false;player.cityBoxingGloves=color(24,51,83);player.cityBoxingGloveOz=4;
  var clubOriginalGloves=player.cityBoxingGloves;
  enterCityBoxingClub(clubSite);startCityBoxingClubSparring();cityBoxingClubStopSparring();`);
check('player.cityBoxingGloves===clubOriginalGloves&&player.cityBoxingGloveOz===4', 'Stopping restores preexisting glove metadata exactly');
run('exitFrontierSaloon();');
check('player.cityBoxingGloves===clubOriginalGloves&&player.cityBoxingGloveOz===4', 'Leaving preserves preexisting appearance properties instead of deleting them');
run('delete player.cityBoxingGloves;delete player.cityBoxingGloveOz;');
console.log('City boxing club: '+checks+' gate, native contact, sequential round and lifecycle checks passed.');

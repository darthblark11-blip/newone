// Run the real isolated scene controls, complete a three-opponent bout without
// teleporting fighters or editing HP, and check aimed duel/save transitions.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let count = 0, now = 7000, stored = null;
ctx.millis = () => now; ctx.mouseButton = ctx.LEFT;
ctx.localStorage = {getItem(){return stored;},setItem(k,v){stored=v;},removeItem(){stored=null;}};
const keys = new Set(); ctx.keyIsDown = code => keys.has(code);
function run(code){return probe(code);}
function check(code,label){assert.ok(run(code),label);count++;}
function ready(){run(`started=true;isPaused=isDead=isWin=killcamMode=false;doTick=true;
 inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inWorldBuildingMenu=inOverworldView=inTravelMenu=inStoryIntro=inDarchonCall=false;`);}
function tick(n=1){for(let i=0;i<n;i++){ctx.deltaTime=16.67;now+=16.67;run('updateFrontierSaloonActivity();');}}
function tap(x,y){ctx.mouseX=x;ctx.mouseY=y;run('touchStarted();');}
function button(action){const b=run(`frontierSaloonButtons().find(b=>b.action===${JSON.stringify(action)})`);assert.ok(b,'Visible '+action+' control');tap(b.x+b.w/2,b.y+b.h/2);}
function cue(){run('startFrontierQuickDraw();_frontierSaloonSession.duel.remainingMs=1;');tick();}
run(`leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
 isStoryMode=false;resetStoryProgress();startAtLevel(3);`);ready();
run(`var saloonSite=frontierSaloonSites();player.x=saloonSite.door.x;player.y=saloonSite.door.y;
 swordPickedUp=true;window.pickaxeOwned=true;setMeleeTool('SWORD');player.currentWeapon=WEAPONS.SHOTGUN;
 player.isArmed=true;player.mounted=true;var oldWeapon=player.currentWeapon,
 oldAmmo=JSON.stringify(player.weaponAmmo),oldMags=JSON.stringify(player.mags),oldKills=totalKills,oldScore=score,
 outdoorEnemies=enemiesList.slice(),outdoorBuildings=buildings.slice(),outsideX=player.x,outsideY=player.y,
 outsideCorpses=corpses.length,outsideParticles=particles.length,outsideBullets=bullets.length;
 updateFrontierSaloonActivity(false);`);
check('frontierSaloonContext()&&!player.checkCol(player.x,player.y)','The exterior doorway remains reachable');
button('INTERACT');
check('frontierSaloonIsInside()&&player.y===FRONTIER_SALOON_ROOM.entry.y','The actual visible touch control enters the enlarged room');
check('!player.mounted&&!player.isArmed&&meleeTool()===\'NONE\'','Entry holsters guns/tools and dismounts');
check('!frontierSaloonBlocked(player.x,player.y)&&FRONTIER_SALOON_ROOM.right-FRONTIER_SALOON_ROOM.left>=1300','The larger room has an open entrance');
check(`enemiesList.length===outdoorEnemies.length&&outdoorEnemies.every((e,i)=>enemiesList[i]===e)&&buildings.length===outdoorBuildings.length`,'Local actors cannot replace exterior enemies or buildings');
check('frontierSaloonSavePlayer().x===outsideX&&frontierSaloonSavePlayer().currentWeapon===oldWeapon','Save captures the original outside position and native weapon');
run('drawFrontierSaloonScene();');count++;
ctx.touches=[{x:72,y:ctx.height-164,id:41}];tick(10);ctx.touches=[];
check('player.y<FRONTIER_SALOON_ROOM.entry.y-20&&player.isMoving','The private mobile stick moves through the new room');
// Walk the central aisle to Mae, without teleporting through furniture.
keys.add(87);tick(210);keys.clear();
check('player.y>=-295&&player.y<-270&&frontierSaloonNearCounter()','The long counter is reachable along the open aisle and blocks further walking');
button('INTERACT');check('_frontierSaloonSession.menu','Mae opens the activity menu');button('BRAWL');
check('_frontierSaloonSession.brawl===\'ACTIVE\'&&_frontierSaloonSession.fighters.length===3&&boxingActive(player)','The mission starts three isolated boxers and the southpaw stance');
check('_frontierSaloonSession.fighters.every(c=>!c.isNeutral&&c.isUnarmed&&!enemiesList.includes(c)&&boxingActive(c))','Boxers cannot trigger the town hostility cascade');
check('boxingTarget(player,_frontierSaloonSession.fighters)===_frontierSaloonSession.fighters[0]','Stance immediately faces and locks the nearest opponent');
run(`var boxingEvents=[],boxingHitOriginal=frontierSaloonBoxingHit;
 frontierSaloonBoxingHit=function(e){boxingEvents.push({outcome:e.outcome,kind:e.kind,level:e.level});return boxingHitOriginal(e);};`);
let holding = false, maxLeases=0, minSeparation=Infinity, frames=0;
const guardKeys={N:[38],NE:[38,39],E:[39],SE:[39,40],S:[40],SW:[40,37],W:[37],NW:[37,38]};
// React to the visible windup, release E for a left straight, and wait out its
// real recovery. Everyone reaches punching distance through the normal AI.
for(;frames<1800&&run('_frontierSaloonSession.brawl===\'ACTIVE\'');frames++){
 keys.clear();
 const q=run(`(()=>{const s=_frontierSaloonSession,t=boxingTarget(player,s.fighters),
  incoming=s.fighters.find(c=>boxingActive(c)&&c._boxing.punch&&c._boxing.punch.elapsedMs>c._boxing.punch.windupMs-95),
  live=[player,...s.fighters].filter(boxingAlive);let separation=Infinity;
  for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++)separation=Math.min(separation,Math.hypot(live[i].x-live[j].x,live[i].y-live[j].y));
  return {d:t?Math.hypot(t.x-player.x,t.y-player.y):999,guard:incoming?boxingPunchSector(incoming._boxing.punch.kind,incoming._boxing.punch.level):null,
  ready:!player._boxing.punch&&player._boxing.cooldownMs<=0,leases:s.fighters.filter(c=>boxingActive(c)&&c._boxing.punch).length,separation};})()`);
 maxLeases=Math.max(maxLeases,q.leases);minSeparation=Math.min(minSeparation,q.separation);
 if(q.guard)for(const code of guardKeys[q.guard])keys.add(code);
 if(q.d<43&&q.ready&&!holding){keys.add(69);holding=true;}else holding=false;
 tick();
}
keys.clear();tick();
assert.ok(frames<1800,'A full input-driven bout finishes without artificial health edits');count++;
assert.equal(maxLeases,1,'Three opponents take staggered turns rather than all wind up together');count++;
assert.ok(minSeparation>=BOXING_RADIUS()-0.05,'Live fighters and the player do not overlap');count++;
function BOXING_RADIUS(){return run('BOXING.BODY_RADIUS*2');}
check('_frontierSaloonSession.brawl===\'WON\'&&frontierSaloonProgress.brawlCleared','Actual E/guard input wins Barroom Peacemaker');
check('boxingEvents.some(e=>e.outcome===\'HIT\')&&boxingEvents.some(e=>e.outcome===\'PARRY\')','The full bout includes precise hits and timed parries');
check('_frontierSaloonSession.fighters.every(c=>c.knockedOut&&c.stunPose&&!c.dead)','Bar knockouts use directional nonlethal falls');
check('score===oldScore+75&&totalKills===oldKills&&!killcamMode&&!boxingActive(player)','Only the one-time mission reward is paid, and stance closes');
run('drawFrontierSaloonScene();');count++;
run(`var rewardScore=score;startFrontierSaloonBrawl();_frontierSaloonSession.fighters.forEach(c=>frontierSaloonKnockOut(c,0));`);tick();
check('score===rewardScore','Repeated brawls cannot duplicate rewards');
run('startFrontierSaloonBrawl();_frontierSaloonSession.grit=0;var hpBeforeKO=player.hp;');tick();
check('_frontierSaloonSession.brawl===\'LOST\'&&player.hp===Math.max(1,hpBeforeKO-12)&&player.y===FRONTIER_SALOON_ROOM.entry.y&&!boxingActive(player)','Losing leaves a nonfatal penalty and clear retry route');
run('startFrontierSaloonBrawl();startFrontierQuickDraw();');
check('!boxingActive(player)&&_frontierSaloonSession.mode===\'DUEL\'','A duel transition clears boxing guard, punch and input state');
const pad=run('frontierQuickDrawControls()');
ctx.touches=[{id:70,x:pad.x+pad.r*.5,y:pad.y}];tap(ctx.touches[0].x,ctx.touches[0].y);tick(10);ctx.touches=[];tick();
check('_frontierSaloonSession.duel.phase===\'WAIT\'&&_frontierSaloonSession.duel.aiming===false&&player.aimAngle===0','The inner right-stick ring aims during WAIT without a false start');
ctx.touches=[{id:73,x:pad.x+pad.r*.35,y:pad.y-pad.r*.35}];tap(ctx.touches[0].x,ctx.touches[0].y);tick();
check('Math.abs(Math.atan2(Math.sin(player.aimAngle),Math.cos(player.aimAngle)*frontierQuickDrawProjection().x)+QUARTER_PI)<.00001','A diagonal right-stick direction produces the same diagonal on the visible gun and trajectory');
ctx.touches=[];tick();
ctx.touches=[{id:71,x:pad.x+pad.r*.9,y:pad.y}];tap(ctx.touches[0].x,ctx.touches[0].y);tick();ctx.touches=[];tick();
check('_frontierSaloonSession.duel.result===\'FALSE START\'&&!frontierSaloonProgress.duelWon&&!cowboyCostumeOwned','Crossing the outer fire ring before DRAW loses without awarding the costume');
cue();run('player.aimAngle=HALF_PI;');button('FIRE');tick(90);
check('!_frontierSaloonSession.duel.won&&_frontierSaloonSession.duel.playerCorpse instanceof Corpse','An out-of-angle shot misses and the opponent triggers a normal local death animation');
check('!isDead&&!player.dead&&player.hp>0&&corpses.length===outsideCorpses&&particles.length===outsideParticles&&bullets.length===outsideBullets','Local duel death/effects/projectiles preserve the live outdoor campaign');
cue();run('isPaused=true;var duelPauseReaction=_frontierSaloonSession.duel.reactionMs;');tick(20);
check('_frontierSaloonSession.duel.reactionMs===duelPauseReaction','Pause cannot consume the draw window');run('isPaused=false;');tick();
ctx.touches=[{id:72,x:pad.x+pad.r*.9,y:pad.y}];tap(ctx.touches[0].x,ctx.touches[0].y);tick();
check('_frontierSaloonSession.duel.ammo===5&&_frontierSaloonSession.duel.projectiles.length===1&&!_frontierSaloonSession.duel.won','Crossing the fire ring creates one finite round and waits for impact');
tick(25);ctx.touches=[];tick();
check('_frontierSaloonSession.duel.ammo===5','Holding the outer right-stick ring cannot repeat-fire the duel round');
check('_frontierSaloonSession.duel.won&&frontierSaloonProgress.duelWon&&cowboyCostumeOwned','A correctly aimed outer-ring shot awards the cowboy costume on actual impact');
check('_frontierSaloonSession.duel.opponentCorpse instanceof Corpse&&_frontierSaloonSession.opponent.dead&&totalKills===oldKills','The winning projectile produces a native corpse without campaign kill credit');
check('score===rewardScore+120&&!cowboySuitEquipped&&frontierSaloonProgress.duelTier===1','The first reward and next challenge tier update exactly once');
run('drawFrontierSaloonScene();');count++;
run('var duelScore=score,oldDistance=_frontierSaloonSession.duel.distance,oldDeadline=_frontierSaloonSession.duel.deadlineMs;');cue();
check('_frontierSaloonSession.duel.distance>oldDistance&&_frontierSaloonSession.duel.deadlineMs<oldDeadline','The next opponent stands farther away and draws faster');
keys.add(32);tick();keys.clear();tick(35);
check('_frontierSaloonSession.duel.won&&score===duelScore&&frontierSaloonProgress.duelTier===2','Desktop Space uses actual rounds and a rematch advances difficulty without duplicate payout');
cue();tick(110);
check('_frontierSaloonSession.duel.phase===\'RESULT\'&&!_frontierSaloonSession.duel.won&&_frontierSaloonSession.duel.playerCorpse','Waiting lets the opponent projectile produce the defeat animation');
run('saveGame();');const saved=JSON.parse(stored);
assert.equal(saved.playerX,run('outsideX'),'Save writes outside X');count++;
assert.equal(saved.playerY,run('outsideY'),'Save writes outside Y');count++;
assert.equal(saved.meleeToolSel,'SWORD','Save preserves the campaign tool');count++;
assert.ok(saved.frontierSaloon.duelWon&&saved.frontierSaloon.brawlCleared&&saved.frontierSaloon.duelTier===2,'Save stores activity rewards and duel progression');count++;
run('exitFrontierSaloon();');
check('player.x===outsideX&&player.y===outsideY&&player.currentWeapon===oldWeapon&&player.mounted&&meleeTool()===\'SWORD\'&&!boxingActive(player)','Exit restores outside position, equipment, mount and tool together');
check('JSON.stringify(player.weaponAmmo)===oldAmmo&&JSON.stringify(player.mags)===oldMags','Activities never consume/refill campaign ammo');
run('resetFrontierSaloonActivity();loadGame();');ready();
check('!frontierSaloonIsInside()&&frontierSaloonProgress.duelWon&&frontierSaloonProgress.brawlCleared&&frontierSaloonProgress.duelTier===2&&cowboyCostumeOwned','Save/load resumes outdoors with both missions and challenge tier retained');
run('player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;enterFrontierSaloon();startFrontierSaloonBrawl();window.travelArrival=\'NORTH\';startAtLevel(4);');
check('!frontierSaloonIsInside()&&!boxingActive(player)&&currentLevel===4&&frontierSaloonProgress.duelTier===2','Travel closes boxing without resetting saved mission progression');
run('restoreFrontierSaloonActivity({duelWon:true,brawlCleared:true,duelAttempts:-99,duelTier:Infinity});');
check('frontierSaloonProgress.duelAttempts===0&&frontierSaloonProgress.duelTier<=99','Loaded activity counters are sanitized');
run('restoreFrontierSaloonActivity({version:1,duelWon:true,brawlCleared:true});');
check('frontierSaloonProgress.duelTier===0&&cowboyCostumeOwned','Old saves retain earned costume and begin the new challenge ladder at its baseline');
run('resetStoryProgress();');
check('!frontierSaloonProgress.duelWon&&!frontierSaloonProgress.brawlCleared&&frontierSaloonProgress.duelTier===0&&!frontierSaloonIsInside()','New campaign resets isolated activities');
console.log('Frontier saloon: '+count+' integration checks passed.');

// A passive player loses to normal opponent contacts. No GRIT/HP rewrites or
// fighter teleporting are used to manufacture the knockout or its recovery.
const assert=require('assert');
const {ctx,probe}=require('./harness');
let checks=0,now=7000,stored=null;
ctx.millis=()=>now;
ctx.localStorage={getItem(){return stored;},setItem(k,v){stored=v;},removeItem(){stored=null;}};
const keys=new Set();ctx.keyIsDown=k=>keys.has(k);
function run(s){return probe(s);}
function check(s,label){assert.ok(run(s),label);checks++;}
function tick(n=1){for(let i=0;i<n;i++){ctx.deltaTime=16.67;now+=16.67;run('updateFrontierSaloonActivity();');}}
function keyTap(code){keys.add(code);tick();keys.delete(code);tick();}
run(`leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
 isStoryMode=false;resetStoryProgress();startAtLevel(3);started=true;isPaused=isDead=isWin=killcamMode=false;
 inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=inStoryIntro=inDarchonCall=false;
 inWorldBuildingMenu=inOverworldView=inTravelMenu=false;
 player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;
 cowboySuitEquipped=true;swordPickedUp=true;setMeleeTool('SWORD');player.currentWeapon=WEAPONS.SHOTGUN;
 player.isArmed=true;player.mountUp(.35);
 var koOutside={x:player.x,y:player.y,weapon:player.currentWeapon,ammo:JSON.stringify(player.weaponAmmo),mags:JSON.stringify(player.mags),
  hp:player.hp,score,kills:totalKills,enemies:enemiesList.length,corpses:corpses.length,particles:particles.length,bullets:bullets.length};
 enterFrontierSaloon();startFrontierSaloonBrawl();
 var koEvents=[],koOriginalHit=frontierSaloonBoxingHit;
 frontierSaloonBoxingHit=function(e){koEvents.push({outcome:e.outcome,attacker:e.attacker===player?'PLAYER':e.attacker.name,
  defender:e.defender===player?'PLAYER':e.defender.name,point:{...e.point},angle:e.attacker.aimAngle,damage:e.damage,
  beforeGrit:_frontierSaloonSession.grit,time:_frontierSaloonSession.elapsedMs});return koOriginalHit(e);};`);
let losingFrames=0;
while(losingFrames++<2400&&run('_frontierSaloonSession.brawl===\'ACTIVE\''))tick();
assert.ok(losingFrames<2400,'Native enemies reach and knock out a passive player');checks++;
check('_frontierSaloonSession.brawl===\'KNOCKOUT\'&&_frontierSaloonSession.grit===0','GRIT zero starts the visible player knockout phase');
check('koEvents.some(e=>e.outcome===\'HIT\'&&e.defender===\'PLAYER\')&&koEvents.filter(e=>e.defender===\'PLAYER\'&&e.outcome===\'HIT\').reduce((n,e)=>n+Math.max(7,Math.round(e.damage*.75)),0)>=100','Loss follows only actual enemy punch contacts');
check('player.stunPose&&player.stunPose.knockout&&player.stunPose.rag&&!boxingActive(player)','Player enters the shared articulated physics fall');
check('!player.dead&&!isDead&&!killcamMode&&player.hp===Math.max(1,koOutside.hp-12)','The getting-knocked-out animation applies the nonfatal penalty once without a campaign death');
check('Math.hypot(player.x-FRONTIER_SALOON_ROOM.entry.x,player.y-FRONTIER_SALOON_ROOM.entry.y)>100&&_frontierSaloonSession.fighters.length===3','The player falls at the hit location and the opponents remain in the scene');
check('_frontierSaloonSession.fighters.every(c=>!boxingActive(c))','The referee stops further punches while the player falls');
check('isGroundBodyActor(player)','The knocked-out player enters the corpse floor render pass');
run(`var koDrawOrder=[],koPlayerShow=player.show,koBrawlerPaint=paintFrontierSaloonBrawler;
 player.show=function(){koDrawOrder.push('PLAYER_DOWN');return koPlayerShow.call(this);};
 paintFrontierSaloonBrawler=function(c){koDrawOrder.push(c.knockedOut?'ENEMY_DOWN':'ENEMY_STANDING');return koBrawlerPaint(c);};
 drawFrontierSaloonInterior();player.show=koPlayerShow;paintFrontierSaloonBrawler=koBrawlerPaint;`);
check('koDrawOrder.indexOf(\'PLAYER_DOWN\')<koDrawOrder.indexOf(\'ENEMY_STANDING\')&&koDrawOrder.filter(x=>x===\'PLAYER_DOWN\').length===1','Production scene draws the fallen player beneath each standing opponent exactly once');
keys.add(87);keys.add(69);tick(8);keys.clear();tick();
check('!player.isMoving&&!boxingActive(player)&&!player._boxing','Movement and attack input cannot interrupt the knockout');
check('!frontierSaloonButtons().some(b=>b.action===\'EXIT\'||b.action===\'INTERACT\')','Knockout has no door exit or talk action');
keyTap(80);check('isPaused','Pause remains available while falling');
run('var koPausedPose=JSON.stringify(player.stunPose),koPausedPosition={x:player.x,y:player.y},koPausedElapsed=_frontierSaloonSession.elapsedMs;');
tick(100);
check('JSON.stringify(player.stunPose)===koPausedPose&&player.x===koPausedPosition.x&&player.y===koPausedPosition.y&&_frontierSaloonSession.elapsedMs===koPausedElapsed','Pause freezes physics nodes, fall position and recovery time');
run('saveGame();');
let saved=JSON.parse(stored);
assert.equal(saved.playerX,run('koOutside.x'),'A mid-knockout save resumes at the campaign position');checks++;
assert.equal(saved.playerY,run('koOutside.y'),'A mid-knockout save preserves campaign Y');checks++;
assert.equal(saved.meleeToolSel,'SWORD','A mid-knockout save preserves the campaign melee equipment');checks++;
check('frontierSaloonSavePlayer().currentWeapon===koOutside.weapon','Save keeps the exterior gun despite local fists and the ragdoll');
keyTap(80);
run('var koBeforeRecoveryElapsed=_frontierSaloonSession.playerKnockout.ageMs;');
let recoveryFrames=0;
while(recoveryFrames++<360&&run('_frontierSaloonSession.brawl===\'KNOCKOUT\'')){
 tick();
 assert.ok(run('Number.isFinite(player.x)&&Number.isFinite(player.y)'), 'Every physics frame remains finite');
}
assert.ok(recoveryFrames<360,'Physics settles and the knockout eventually recovers');checks++;
assert.ok(run('koBeforeRecoveryElapsed')+(recoveryFrames-1)*16.67>=2700,'Fall hold and native get-up stay visible for the complete sequence');checks++;
check('_frontierSaloonSession.brawl===\'LOST\'&&player.hp===Math.max(1,koOutside.hp-12)','The full fall and get-up preserve the one nonfatal health penalty');
check('!player.stunPose&&!player.knockedOut&&player.stunTimer===0&&!player.dead&&!isDead','Recovery clears every transient player knockout flag');
check('Math.hypot(player.x-FRONTIER_SALOON_ROOM.entry.x,player.y-FRONTIER_SALOON_ROOM.entry.y)>100&&_frontierSaloonSession.fighters.length===3','The player recovers at the final floor position without teleporting or removing opponents');
run('var koPenaltyHP=player.hp;');tick(180);
check('player.hp===koPenaltyHP&&score===koOutside.score&&totalKills===koOutside.kills','Repeated result updates cannot duplicate the penalty or award kills/rewards');
check('corpses.length===koOutside.corpses&&particles.length===koOutside.particles&&bullets.length===koOutside.bullets&&enemiesList.length===koOutside.enemies','Local physics and impacts do not leak into campaign arrays');
check('JSON.stringify(player.weaponAmmo)===koOutside.ammo&&JSON.stringify(player.mags)===koOutside.mags','Local knockout cannot consume or refill campaign ammunition');
run('startFrontierSaloonBrawl();');
check('_frontierSaloonSession.brawl===\'ACTIVE\'&&_frontierSaloonSession.grit===100&&boxingActive(player)&&!player.stunPose&&!player.knockedOut','A retry starts a clean fresh stance and GRIT after recovery');
// Test pause -> shop while a second naturally triggered knockout is in flight.
losingFrames=0;while(losingFrames++<2400&&run('_frontierSaloonSession.brawl===\'ACTIVE\''))tick();
check('_frontierSaloonSession.brawl===\'KNOCKOUT\'','A second real loss reaches the same staged fall');
keyTap(80);const shop=run("frontierSaloonButtons().find(b=>b.action==='SHOP')");assert.ok(shop,'Pause exposes the shop exit');checks++;
ctx.mouseX=shop.x+shop.w/2;ctx.mouseY=shop.y+shop.h/2;run('touchStarted();');
check('!frontierSaloonIsInside()&&!player.stunPose&&!player.knockedOut&&player.stunTimer===0&&!boxingActive(player)','Leaving through the pause shop action discards local physics and control ownership');
check('player.x===koOutside.x&&player.y===koOutside.y&&player.currentWeapon===koOutside.weapon&&player.mounted&&meleeTool()===\'SWORD\'','Shop exit restores the exact exterior position, weapon, mount and tool');
check('player.hp>0&&!player.dead&&!isDead&&cowboySuitEquipped','Leaving a fall preserves a live campaign player and the equipped costume');
console.log(`Frontier player knockout: ${checks} native contact, lifecycle and render checks passed.`);

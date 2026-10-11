// Exercise the public saloon scene through campaign entry, private controls,
// nonlethal combat and real save/load. Local fights must not progress outdoors.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let count = 0, now = 7000, stored = null;
ctx.millis = () => now;
ctx.mouseButton = ctx.LEFT;
ctx.localStorage = {getItem(){ return stored; }, setItem(k,v){ stored = v; }, removeItem(){ stored = null; }};
const keys = new Set(); ctx.keyIsDown = code => keys.has(code);
function run(code){ return probe(code); }
function check(code,label){ assert.ok(run(code), label); count++; }
function ready(){ run(`started=true;isPaused=false;isDead=false;isWin=false;killcamMode=false;doTick=true;
  inTownCutscene=false;inFarmCutscene=false;inFarmPostCutscene=false;inFortCutscene=false;
  inPostAmbushCutscene=false;inWorldBuildingMenu=false;inOverworldView=false;
  inTravelMenu=false;inStoryIntro=false;inDarchonCall=false;`); }
function tick(n=1){ for(let i=0;i<n;i++){ctx.deltaTime=16.67;now+=16.67;run('updateFrontierSaloonActivity();');} }
function tap(x,y){ ctx.mouseX=x; ctx.mouseY=y; run('touchStarted();'); }
run(`leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
  isStoryMode=false;resetStoryProgress();startAtLevel(3);`);
ready();
run('var saloonSite=frontierSaloonSites();player.x=saloonSite.door.x;player.y=saloonSite.door.y;');
check('frontierSaloonContext()&&!player.checkCol(player.x,player.y)', 'The actual exterior door is reachable');
run(`swordPickedUp=true;window.pickaxeOwned=true;setMeleeTool('SWORD');
  player.currentWeapon=WEAPONS.SHOTGUN;player.isArmed=true;player.mounted=true;
  var oldWeapon=player.currentWeapon,oldAmmo=JSON.stringify(player.weaponAmmo),oldMags=JSON.stringify(player.mags);
  var outdoorEnemies=enemiesList.slice(),outdoorBuildings=buildings.slice(),oldKills=totalKills,oldScore=score;
  var outsideX=player.x,outsideY=player.y;updateFrontierSaloonActivity(false);`);
check('_frontierSaloonPrompt&&_frontierSaloonPrompt.kind===\'SALOON\'', 'Door proximity publishes the mobile interaction');
tap(ctx.width/2,ctx.height-100);
check('frontierSaloonIsInside()&&_frontierSaloonSession.mode===\'SALOON\'&&player.y===242', 'The real touch hook enters the bounded room');
check('!player.mounted&&!player.isArmed&&meleeTool()===\'NONE\'', 'Room entry safely holsters weapons and mounts');
check(`enemiesList.length===outdoorEnemies.length&&outdoorEnemies.every((e,i)=>enemiesList[i]===e)&&buildings.length===outdoorBuildings.length`,
  'Indoor NPCs never overwrite or enter the exterior population');
check('frontierSaloonSavePlayer().x===outsideX&&frontierSaloonSavePlayer().currentWeapon===oldWeapon', 'Save snapshots retain exterior position and native weapon');
run('drawFrontierSaloonScene();');count++;
ctx.touches=[{x:72,y:ctx.height-164,id:41}]; tick(10);ctx.touches=[];
check('player.y<235&&player.isMoving', 'Private mobile movement actually moves the player');
run('player.x=0;player.y=-137;'); keys.add(87);tick(20);keys.clear();
check('player.y>=-147', 'The counter has real room collision while moving');
run('player.x=FRONTIER_SALOON_ROOM.right-16;player.y=80;');keys.add(68);tick(10);keys.clear();
check('player.x<=FRONTIER_SALOON_ROOM.right-16', 'Private movement cannot leave the room walls');
run('player.x=0;player.y=-128;');tap(ctx.width/2,ctx.height-230);
check('_frontierSaloonSession.menu', 'Counter touch interaction opens both side missions');
tap(ctx.width/2,ctx.height/2-18);
check('_frontierSaloonSession.brawl===\'ACTIVE\'&&_frontierSaloonSession.fighters.length===3', 'The brawl mission starts three distinct fighters');
check('_frontierSaloonSession.fighters.every(c=>!c.isNeutral&&c.isUnarmed&&!enemiesList.includes(c))', 'Brawlers cannot trigger the town hostility cascade');
check('!frontierSaloonBlocked(0,160)', 'The brawl entry point has unobstructed footwork');
// Stand off and let the opponent walk, wind up and connect. Those punches use
// local grit and no bullet/kill/death machinery from the world.
run('player.x=0;player.y=100;_frontierSaloonSession.fighters.forEach((c,i)=>{c.x=(i-1)*34;c.y=145;c.saloonPunchMs=0;});');
tick(27);
check('_frontierSaloonSession.grit<100&&player.hp>0', 'Troublemakers have a working nonlethal attack');
check('totalKills===oldKills&&!killcamMode&&enemiesList.length===outdoorEnemies.length', 'Opponent attacks do not alter campaign counters');
// Strike with the actual touch attack and phase update, keeping the remaining
// fighters away to test one hit and prevent a knock-out interrupting this probe.
run(`player.x=0;player.y=90;_frontierSaloonSession.grit=100;
  _frontierSaloonSession.fighters.forEach((c,i)=>{c.x=i===0?0:300;c.y=i===0?38:100+i*50;c.saloonPunchMs=99999;});
  var fistTarget=_frontierSaloonSession.fighters[0],fistHP=fistTarget.hp;`);
tap(ctx.width-72,ctx.height-108);tick(12);
check('fistTarget.hp<fistHP&&player.meleeTimer>0', 'A real touch punch animates and damages its local target');
check('totalKills===oldKills&&score===oldScore', 'A landed fist does not count as a campaign kill');
// Complete each local opponent through native scene input, checking the
// one-time side-mission payout and directional nonlethal pose.
for(let target=0;target<3;target++){
  for(let hit=0;hit<4;hit++){
    run(`var t=_frontierSaloonSession.fighters[${target}];
      if(!t.knockedOut){player.x=0;player.y=100;t.x=0;t.y=42;t.saloonPunchMs=99999;t.saloonWindupMs=0;
      _frontierSaloonSession.fighters.forEach((c,i)=>{if(i!==${target}&&!c.knockedOut){c.x=300;c.y=110+i*40;c.saloonPunchMs=99999;}});}`);
    tap(ctx.width-72,ctx.height-108);tick(22);
  }
}
check('_frontierSaloonSession.brawl===\'WON\'&&frontierSaloonProgress.brawlCleared', 'All three local knockouts complete Barroom Peacemaker');
check('_frontierSaloonSession.fighters.every(c=>c.knockedOut&&c.stunPose)', 'Knockouts reuse directional falls without producing dead campaign entities');
check('score===oldScore+75&&totalKills===oldKills&&!killcamMode', 'Only the side-mission reward is paid');
run('drawFrontierSaloonScene();');count++;
run(`var rewardScore=score;startFrontierSaloonBrawl();
  _frontierSaloonSession.fighters.forEach(c=>frontierSaloonKnockOut(c,0));`);tick();
check('score===rewardScore', 'Repeat brawls cannot duplicate completion rewards');
run('startFrontierSaloonBrawl();_frontierSaloonSession.grit=0;var hpBeforeKO=player.hp;');tick();
check('_frontierSaloonSession.brawl===\'LOST\'&&player.hp===Math.max(1,hpBeforeKO-12)&&player.y===240', 'A lost brawl leaves a nonfatal penalty and a clear retry route');
run('startFrontierQuickDraw();var attemptHP=player.hp;');
check('_frontierSaloonSession.mode===\'DUEL\'&&_frontierSaloonSession.duel.phase===\'WAIT\'', 'The duel begins in an untelegraphed wait');
tap(ctx.width/2,ctx.height-135);
check('_frontierSaloonSession.duel.result===\'FALSE START\'&&!frontierSaloonProgress.duelWon', 'A premature mobile shot loses the duel');
check('!cowboyCostumeOwned&&player.hp===Math.max(1,attemptHP-12)', 'An early shot cannot award the cowboy costume');
run('startFrontierQuickDraw();_frontierSaloonSession.duel.remainingMs=100;');
run('isPaused=true;var duelPauseRemaining=_frontierSaloonSession.duel.remainingMs;');tick(20);
check('_frontierSaloonSession.duel.remainingMs===duelPauseRemaining', 'Paused time cannot consume the draw cue');
run('isPaused=false;');tick(7);
check('_frontierSaloonSession.duel.phase===\'DRAW\'', 'Elapsed simulation time publishes the draw cue');
run('drawFrontierSaloonScene();');count++;
tap(ctx.width/2,ctx.height-135);
check('_frontierSaloonSession.duel.won&&frontierSaloonProgress.duelWon&&cowboyCostumeOwned', 'A prompt mobile draw instantly awards the owned cowboy costume');
check('_frontierSaloonSession.opponent.knockedOut&&_frontierSaloonSession.opponent.stunPose&&totalKills===oldKills', 'The winning shot produces a directional fall within the isolated duel');
check('score===rewardScore+120&&!cowboySuitEquipped', 'The one-time duel payout preserves the player’s current costume selection');
run('var duelScore=score;startFrontierQuickDraw();_frontierSaloonSession.duel.remainingMs=1;');tick();
keys.add(32);tick();keys.clear();tick();
check('_frontierSaloonSession.duel.won&&score===duelScore', 'Desktop Space shoots the cue and cannot duplicate the first reward');
run('startFrontierQuickDraw();_frontierSaloonSession.duel.remainingMs=1;');tick();tick(45);
check('_frontierSaloonSession.duel.result===\'TOO SLOW\'&&_frontierSaloonSession.duel.phase===\'RESULT\'', 'Waiting too long lets the opponent draw first');
run('saveGame();');
const saved=JSON.parse(stored);
assert.strictEqual(saved.playerX,run('outsideX'),'Real save writes exterior X');count++;
assert.strictEqual(saved.playerY,run('outsideY'),'Real save writes exterior Y');count++;
assert.strictEqual(saved.meleeToolSel,'SWORD','Real save preserves the campaign tool');count++;
assert.ok(saved.frontierSaloon.duelWon&&saved.frontierSaloon.brawlCleared,'Real save captures both one-time missions');count++;
run('exitFrontierSaloon();');
check('player.x===outsideX&&player.y===outsideY&&player.currentWeapon===oldWeapon&&player.mounted&&meleeTool()===\'SWORD\'', 'Exit restores position, gun, mount and tool together');
check('JSON.stringify(player.weaponAmmo)===oldAmmo&&JSON.stringify(player.mags)===oldMags', 'Activities cannot consume or refill campaign ammo pools');
run('resetFrontierSaloonActivity();loadGame();');ready();
check('!frontierSaloonIsInside()&&frontierSaloonProgress.duelWon&&frontierSaloonProgress.brawlCleared&&cowboyCostumeOwned', 'Save/load resumes outdoors with both mission rewards retained');
run('player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;enterFrontierSaloon();window.travelArrival=\'NORTH\';startAtLevel(4);');
check('!frontierSaloonIsInside()&&currentLevel===4&&frontierSaloonProgress.duelWon', 'Travel safely closes the room without resetting its progress');
run('restoreFrontierSaloonActivity({duelWon:true,brawlCleared:true,duelAttempts:-99});');
check('frontierSaloonProgress.duelAttempts===0&&frontierSaloonProgress.duelWon', 'Loaded activity counters are sanitized');
run('resetStoryProgress();');
check('!frontierSaloonProgress.duelWon&&!frontierSaloonProgress.brawlCleared&&!frontierSaloonIsInside()', 'A new campaign resets the isolated activities');
console.log('Frontier saloon: '+count+' integration checks passed.');

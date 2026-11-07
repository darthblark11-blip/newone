// This deliberately clears opponents through the public knockout seam to
// exercise progression, scene transitions and persistence. Native contact
// playthrough coverage lives in check-frontier-saloon/player-knockout.
const assert=require('assert');
const {ctx,probe}=require('./harness');
let checks=0,now=7000,slot=null;
ctx.millis=()=>now;
ctx.localStorage={getItem(){return slot;},setItem(k,v){slot=v;},removeItem(){slot=null;}};
const keys=new Set();ctx.keyIsDown=code=>keys.has(code);
function run(code){return probe(code);}
function check(code,label){assert.ok(run(code),label);checks++;}
function tick(n=1){for(let i=0;i<n;i++){ctx.deltaTime=16.67;now+=16.67;run('updateFrontierSaloonActivity();');}}
function active(){let n=0;while(n++<450&&run('_frontierSaloonSession.brawl!=="ACTIVE"'))tick();assert.ok(n<450,'A breather/transition eventually returns to fighting');}
function clear(){run('_frontierSaloonSession.fighters.forEach(c=>frontierSaloonKnockOut(c,player.aimAngle,{kind:"LEFT_HOOK",level:"HEAD",damage:100}));');tick();}
run(`leftStick={active:false,dx:0,dy:0,base:{x:80,y:height-160}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:width-80,y:height-110}};
 isStoryMode=false;resetStoryProgress();startAtLevel(3);started=true;isPaused=isDead=isWin=killcamMode=false;
 inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=inStoryIntro=inDarchonCall=false;
 inWorldBuildingMenu=inOverworldView=inTravelMenu=false;
 player.x=frontierSaloonSites().door.x;player.y=frontierSaloonSites().door.y;
 cowboySuitEquipped=true;swordPickedUp=true;setMeleeTool('SWORD');player.currentWeapon=WEAPONS.SHOTGUN;
 player.isArmed=true;player.mountUp(.35);
 var gauntletOutside={x:player.x,y:player.y,hp:player.hp,ammo:JSON.stringify(player.weaponAmmo),mags:JSON.stringify(player.mags),
  score,kills:totalKills,clock:worldTimeMs,enemies:enemiesList.length,corpses:corpses.length,particles:particles.length,bullets:bullets.length};
 enterFrontierSaloon();startFrontierSaloonBrawl();`);
const waveShapes=[[1,'ROOKIE',62],[1,'BRAWLER',80],[2,'ROOKIE',62],[2,'BRAWLER',84],[3,'BRAWLER',88],[1,'ACE',112]];
for(let wave=1;wave<=6;wave++){
 active();const [count,skill,hp]=waveShapes[wave-1];
 check(`_frontierSaloonSession.gauntlet.wave===${wave}&&_frontierSaloonSession.arena==='SALOON'`, 'Authored saloon wave '+wave+' starts in order');
 check(`_frontierSaloonSession.fighters.length===${count}&&_frontierSaloonSession.fighters.every(c=>c.boxingSkill==='${skill}'&&c.maxHp===${hp}&&boxingActive(c)&&!c.dead&&!enemiesList.includes(c))`, 'Wave '+wave+' has the requested opponent count, skill and health');
 check('_frontierSaloonSession.fighters.every(c=>!frontierSaloonBlocked(c.x,c.y))&&!frontierSaloonBlocked(player.x,player.y)', 'Wave '+wave+' starts all fighters on walkable floor');
 if(wave===1){
  run('_frontierSaloonSession.grit=77;var gauntletStart=JSON.stringify({wave:_frontierSaloonSession.gauntlet.wave,fighters:_frontierSaloonSession.fighters.map(c=>[c.x,c.y,c.hp]),grit:_frontierSaloonSession.grit});');
  check('!startFrontierSaloonBrawl()&&JSON.stringify({wave:_frontierSaloonSession.gauntlet.wave,fighters:_frontierSaloonSession.fighters.map(c=>[c.x,c.y,c.hp]),grit:_frontierSaloonSession.grit})===gauntletStart', 'An active run cannot be restarted to refill GRIT');
 }
 clear();
 check('_frontierSaloonSession.brawl==="INTERMISSION"&&frontierSaloonProgress.bestWave==='+wave, 'Clear '+wave+' records its exact best completed wave and enters a breather');
 check('score===gauntletOutside.score&&!frontierSaloonProgress.brawlCleared&&totalKills===gauntletOutside.kills', 'Early wave '+wave+' gives no premature milestone score or campaign kill');
 check('_frontierSaloonSession.fighters.every(c=>c.knockedOut&&c.stunPose&&!c.dead)', 'Wave '+wave+' ends with native nonlethal floor bodies');
 if(wave===1){
  run('isPaused=true;var gauntletPaused=JSON.stringify({gauntlet:_frontierSaloonSession.gauntlet,grit:_frontierSaloonSession.grit,poses:_frontierSaloonSession.fighters.map(c=>c.stunPose)});');tick(120);
  check('JSON.stringify({gauntlet:_frontierSaloonSession.gauntlet,grit:_frontierSaloonSession.grit,poses:_frontierSaloonSession.fighters.map(c=>c.stunPose)})===gauntletPaused', 'Pause freezes breather, GRIT and knockout physics');run('isPaused=false;');
  active();check('_frontierSaloonSession.grit===89&&player.hp===gauntletOutside.hp', 'The first breather restores only 12 GRIT without healing campaign health');
 }
}
// The level-seven scene is a real timed cutscene; pause mid-tackle and check
// the player location/proxy physics cannot advance while the menu is open.
let wait=0;while(wait++<180&&run('_frontierSaloonSession.brawl!=="TRANSITION"'))tick();
check('_frontierSaloonSession.brawl==="TRANSITION"&&_frontierSaloonSession.transition.kind==="TACKLE"', 'Clearing the great fighter begins the level-seven door tackle');
tick(45);run('isPaused=true;var tacklePause=JSON.stringify({transition:_frontierSaloonSession.transition,x:player.x,y:player.y});');tick(90);
check('JSON.stringify({transition:_frontierSaloonSession.transition,x:player.x,y:player.y})===tacklePause', 'Pause freezes the actual tackle proxy and carried player');run('isPaused=false;');
check('!frontierSaloonButtons().some(b=>["EXIT","INTERACT","BOXING"].includes(b.action))', 'The door tackle owns controls without an exit, talk or stance button');
active();
check('_frontierSaloonSession.gauntlet.wave===7&&_frontierSaloonSession.arena==="STREET"&&!_frontierSaloonSession.transition', 'The tackle finishes in front of the saloon and starts wave seven');
check('!player.stunPose&&!player.knockedOut&&boxingActive(player)&&Number.isFinite(player.x)&&Number.isFinite(player.y)', 'The cinematic leaves a clean live player stance');
for(let wave=7;wave<=13;wave++){
 active();
 check(`_frontierSaloonSession.gauntlet.wave===${wave}&&_frontierSaloonSession.arena==='STREET'`, 'Street wave '+wave+' stays in the correct arena');
 check('_frontierSaloonSession.fighters.length>=2&&_frontierSaloonSession.fighters.length<=6&&_frontierSaloonSession.fighters.every(c=>!frontierSaloonBlocked(c.x,c.y))', 'Street wave '+wave+' uses bounded, reachable opponents');
 clear();
 check('_frontierSaloonSession.downFighters.length<=12&&score===gauntletOutside.score', 'Street bodies stay bounded and the milestone has not been paid early');
}
wait=0;while(wait++<180&&run('_frontierSaloonSession.brawl!=="TRANSITION"'))tick();
check('_frontierSaloonSession.transition&&_frontierSaloonSession.transition.kind==="BRIDGE"', 'Clearing wave thirteen begins the canyon-bridge scene');
active();
check('_frontierSaloonSession.gauntlet.wave===14&&_frontierSaloonSession.arena==="BRIDGE"&&_frontierSaloonSession.fighters.length===6&&_frontierSaloonSession.fighters.every(c=>c.boxingSkill==="ACE")', 'Wave fourteen is a six-ace canyon bridge gauntlet');
check('_frontierSaloonSession.fighters.every(c=>!frontierSaloonBlocked(c.x,c.y))&&!frontierSaloonBlocked(player.x,player.y)', 'Bridge entrants stand on the safe deck');
const bounds=run('frontierSaloonArenaInfo("BRIDGE").bounds');
check(`frontierSaloonBlocked(0,${bounds.top-30})&&frontierSaloonBlocked(0,${bounds.bottom+30})`, 'The deep canyon sides reject movement off the bridge');
// A player may finish a wave near either railing. The following wave must
// choose valid entrants instead of centering an unchecked circle off the deck.
run(`frontierSaloonBoxingMove(player,player.x,frontierSaloonArenaInfo('BRIDGE').bounds.top+24);`);
clear();
check('frontierSaloonProgress.bestWave===14&&frontierSaloonProgress.brawlCleared&&score===gauntletOutside.score+75', 'The first bridge clear awards exactly the existing 75-score milestone');
active();
check('_frontierSaloonSession.gauntlet.wave===15&&_frontierSaloonSession.arena==="BRIDGE"&&_frontierSaloonSession.fighters.length<=8', 'Survival continues beyond fourteen with bounded opponents');
check('_frontierSaloonSession.fighters.every(c=>!frontierSaloonBlocked(c.x,c.y))', 'A wave cleared near the railing still spawns its next opponents on the bridge');
clear();check('score===gauntletOutside.score+75&&frontierSaloonProgress.bestWave===15', 'Later waves improve the record without repeating the one-time reward');
check('totalKills===gauntletOutside.kills&&worldTimeMs===gauntletOutside.clock&&enemiesList.length===gauntletOutside.enemies&&corpses.length===gauntletOutside.corpses&&particles.length===gauntletOutside.particles&&bullets.length===gauntletOutside.bullets', 'All three local arenas preserve campaign combat arrays and world time');
check('JSON.stringify(player.weaponAmmo)===gauntletOutside.ammo&&JSON.stringify(player.mags)===gauntletOutside.mags&&player.hp===gauntletOutside.hp', 'Survival waves do not spend ammo or alter campaign health');
run('saveGame();');const saved=JSON.parse(slot);
assert.equal(saved.playerX,run('gauntletOutside.x'));assert.equal(saved.playerY,run('gauntletOutside.y'));checks+=2;
assert.equal(saved.frontierSaloon.bestWave,15,'Only the completed record is persisted');checks++;
assert.ok(!Object.hasOwn(saved.frontierSaloon,'fighters')&&!Object.hasOwn(saved.frontierSaloon,'transition')&&!Object.hasOwn(saved.frontierSaloon,'gauntlet'),'Save stores no live local actor or cutscene state');checks++;
run('exitFrontierSaloon();');
check('player.x===gauntletOutside.x&&player.y===gauntletOutside.y&&player.currentWeapon===WEAPONS.SHOTGUN&&player.mounted&&meleeTool()==="SWORD"&&cowboySuitEquipped&&!boxingActive(player)', 'Leaving any local arena restores the exact campaign position and gear');
run('loadGame();isPaused=false;enterFrontierSaloon();startFrontierSaloonBrawl();');
check('frontierSaloonProgress.bestWave===15&&frontierSaloonProgress.brawlCleared&&_frontierSaloonSession.gauntlet.wave===1&&_frontierSaloonSession.arena==="SALOON"', 'Load retains the record while a new survival run begins at level one');
run('restoreFrontierSaloonActivity({version:3,brawlCleared:true,bestWave:Infinity});');
check('frontierSaloonProgress.bestWave===9999&&frontierSaloonProgress.brawlCleared&&!frontierSaloonIsInside()', 'A malformed high record is sanitized without restoring live local combat');
run('restoreFrontierSaloonActivity({version:2,brawlCleared:true,duelWon:true});');
check('frontierSaloonProgress.bestWave===0&&frontierSaloonProgress.brawlCleared&&frontierSaloonProgress.duelWon&&cowboyCostumeOwned', 'An old save retains earned rewards without inventing a new survival record');
run('resetStoryProgress();');
check('frontierSaloonProgress.bestWave===0&&!frontierSaloonProgress.brawlCleared&&!frontierSaloonProgress.duelWon&&!frontierSaloonIsInside()', 'A new campaign resets the survival record with its other frontier rewards');
console.log('Frontier gauntlet: '+checks+' explicit progression, scene and persistence checks passed.');

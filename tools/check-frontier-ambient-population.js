// Exercise the frontier's ambient admission at its native spawn/death seams.
// Authored forces and sheriff actors retain their own finite rosters.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let checks = 0, seed = 901;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  return b === undefined ? r * a : a + r * (b - a);
};
function run(code) { return probe(code); }
function check(code, message) { assert.ok(run(code), message); checks++; }
function active() {
  run(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inFarmCutscene=inFarmPostCutscene=false;
    inPostAmbushCutscene=inDarchonCall=inWorldBuildingMenu=inOverworldView=inTravelMenu=inUpgradeMenu=false;
    nm0AmbushActive=farmAmbushActive=false;player.dead=false;player.hp=player.maxHp;
    player.fireTimer=player.muzzleFlash=player.meleeTimer=0;bullets=[];grenades=[];`);
}
function country() {
  run(`player.x=7000;player.y=10000;_outerFrame=-99;enemiesList=[];resetFrontierAmbient();`);
  active();
}
function quiet(ticks=24) { run(`for(let i=0;i<${ticks};i++)frontierAmbientTick();`); }

run('isStoryMode=true;resetStoryProgress();startAtLevel(3);');active();
check('!enemiesList.some(e=>e.isFrontierAmbient)', 'A story arrival does not create ambient attackers inside the main town');
country();
check('inBiomeOverworld() && inOuterRegion(player.x,player.y)', 'The fixture stands on real frontier open country');
run('for(let i=0;i<100;i++)spawnSingleEnemy();');
check('enemiesList.length===0', 'Native spawn and queued-death callbacks cannot bypass the initial quiet interval');
check('!frontierAmbientMaySpawn()', 'Ordinary replenishment waits after arrival');
quiet(23);
check('!frontierAmbientMaySpawn()', 'Seventeen active seconds do not expire the quiet interval');
quiet(1);
check('frontierAmbientMaySpawn()', 'Eighteen active quiet seconds admit one arrival');
run(`var passer=frontierAmbientCreated(new Character(player.x+1600,player.y,false,'BANDIT'));
  enemiesList.push(passer);`);
check("passer.isNeutral && passer.isFriendly && passer.state==='RIDE_BY' && passer.bandGroup>0",
  'A new ambient bandit is a neutral traveller with an independent provocation group');
check('frontierAmbientCount()===1 && !frontierAmbientMaySpawn()', 'Neutral travellers count toward the cap and start the next quiet interval');

// Frame time in menus and room activities cannot advance replenishment.
run('isPaused=true;');quiet(200);run('isPaused=false;');
check('!frontierAmbientMaySpawn()', 'Pause time cannot consume the quiet interval');
run('_frontierSaloonSession={mode:"SALOON"};');quiet(200);run('_frontierSaloonSession=null;');
check('!frontierAmbientMaySpawn()', 'A saloon visit cannot consume the outside quiet interval');
quiet();
run('player.fireTimer=8;');
check('!frontierAmbientMaySpawn()', 'Firing immediately closes admission, including delayed death callbacks');
run('player.fireTimer=0;');quiet(23);
check('!frontierAmbientMaySpawn()', 'The full quiet interval restarts after gunfire');quiet(1);
check('frontierAmbientMaySpawn()', 'The admission reopens after the actual quiet interval');
run(`var bullet={x:player.x+100,y:player.y};bullets=[bullet];`);
check('!frontierAmbientMaySpawn()', 'Nearby live projectiles keep the frontier in combat');
run('bullets=[];');quiet();
run(`var pursuer=new Character(player.x+600,player.y,false,'BANDIT');pursuer.state='CHASE';enemiesList.push(pursuer);`);
check('!frontierAmbientMaySpawn()', 'A nearby active pursuer blocks reinforcements before he fires');
run('pursuer.dead=true;pursuer.hp=0;');quiet();
check('frontierAmbientMaySpawn()', 'A dead pursuer does not keep combat active forever');
run('processKill(pursuer.x,pursuer.y,false,"BANDIT",false,pursuer);');
check('!frontierAmbientMaySpawn()', 'Native death credit renews quiet time before replacement callbacks run');

country();quiet();
run('spawnSingleEnemy();var nativeCount=enemiesList.length;');
check("nativeCount===1 && enemiesList.every(e=>e.eType==='BANDIT'&&e.isFrontierAmbient&&e.isNeutral&&e.isFriendly)",
  'Native admission makes one neutral bandit without falling into the old pistol, aerial or bug ladders');
run('for(let i=0;i<100;i++)spawnSingleEnemy();');
check('enemiesList.length===nativeCount', 'A burst of real replacement calls cannot stack arrivals in the same quiet interval');
run('player.fire(0);');
check('bullets.length>0 && !frontierAmbientMaySpawn()', 'Actual weapon fire immediately suppresses replenishment');
run('frameCount=Math.ceil(frameCount/45)*45;for(let i=0;i<100;i++){frameCount+=45;player.fireTimer=5;maintainHostiles();}');
check('enemiesList.length===nativeCount', 'Native maintenance supplies no attackers throughout sustained firing');
run('player.fireTimer=player.muzzleFlash=0;bullets=[];');
run('for(let i=0;i<24;i++){frameCount+=45;maintainHostiles();}');
check('enemiesList.length>nativeCount && enemiesList.length<=nativeCount+3',
  'Native maintenance resumes with one traveller or a small passing group after eighteen quiet seconds');

// Old saves lack the explicit ambient marker. Their ordinary bandits still
// consume space, while campaign actors and wanted gangs do not.
country();
run(`for(let i=0;i<10;i++)enemiesList.push(new Character(player.x+2400+i*20,player.y,false,'BANDIT'));`);
quiet();
check('frontierAmbientCount()===10 && !frontierAmbientMaySpawn()', 'Older untagged bandits occupy the same ten-person cap');
run(`enemiesList[0].frontierBountyId='RED_MESA';enemiesList[1].isAmbush=true;
  enemiesList[2].isOutpostGarrison=true;enemiesList[3].isMilitary=true;`);
check('frontierAmbientCount()===6', 'Bounties, scripted waves, garrisons and escorts retain independent rosters');

country();
run(`for(let i=0;i<4;i++){
  if(frontierAmbientMaySpawn(true))enemiesList.push(frontierAmbientCreated(new Character(player.x+2000+i*30,player.y,false,'BANDIT'),true));
}`);
check('frontierAmbientCount()===4 && !frontierAmbientMaySpawn(true)', 'An outer-country seed is at most four, independently of the ten-person cap');
run('enemiesList=[];');
for(let i=0;i<12;i++) {
  quiet();
  check('frontierAmbientMaySpawn()', 'Quiet admission permits budgeted traveller '+(i+1));
  run(`frontierAmbientCreated(new Character(player.x+2000,player.y,false,'BANDIT'));`);
}
quiet(400);
check('!frontierAmbientMaySpawn() && _frontierAmbient.spawned===16', 'A visit cannot supply an endless stream after its sixteen arrivals are exhausted');

// Story groups share the same cap, budget and cooldown as lone travellers.
country();quiet();
run('banditRollTimer=BANDIT_ROLL_FRAMES;');
const savedRandom=ctx.random;ctx.random=(a,b)=>a===undefined?0:b===undefined?0:a;
run('maintainBanditPosse(0);');ctx.random=savedRandom;
check('frontierAmbientCount()>0 && frontierAmbientCount()<=3', 'A story posse contains at most three riders');
check("enemiesList.every(e=>e.isFrontierAmbient&&e.isNeutral&&e.isFriendly&&e.state==='RIDE_BY')",
  'Story posses pass through peacefully rather than charging the player');
check('new Set(enemiesList.map(e=>e.bandGroup)).size===1', 'The passing posse responds as one local group');
check('!frontierAmbientMaySpawn()', 'A posse starts the shared cooldown before a lone spawn can follow it');
run(`var firstBand=enemiesList[0].bandGroup;
  var otherBand=frontierAmbientCreated(new Character(player.x+2400,player.y,false,'BANDIT'));enemiesList.push(otherBand);
  turnBandGroup(firstBand);`);
check('enemiesList.filter(e=>e.bandGroup===firstBand).every(e=>!e.isNeutral&&!e.isFriendly)', 'Provoking a passing band turns its own riders');
check('otherBand.isNeutral && otherBand.isFriendly', 'A separate passing band stays neutral');

// Town retaliation is local in frontier story mode. Elsewhere the established
// campaign behavior is preserved.
country();
run(`var local=new Character(player.x+100,player.y,false,'COWBOY');
  var witness=new Character(player.x+400,player.y,false,'COWBOY');
  var distant=new Character(player.x+2500,player.y,false,'COWBOY');
  enemiesList=[local,witness,distant];local.takeDamage(1,player);`);
check('!local.isNeutral && !witness.isNeutral && distant.isNeutral', 'A local shooting does not enlist a distant frontier town');
country();quiet();
run(`var settlement=[];for(let i=0;i<4;i++)settlement.push(new Character(player.x+30*i,player.y,false,'COWBOY'));
  chunkPop.set('ambient-test',settlement);_outerFrame=-99;`);
check('!frontierAmbientMaySpawn()', 'Ambient riders do not appear inside an occupied settlement');
run("chunkPop.delete('ambient-test');_outerFrame=-99;");
for(const flag of ['inTravelMenu','inWorldBuildingMenu','inFarmCutscene','farmAmbushActive','nm0AmbushActive']) {
  run(flag+'=true;');check('!frontierAmbientMaySpawn()', flag+' suppresses ambient admission');run(flag+'=false;');
}
run('isStoryMode=false;');
check('!frontierAmbientStory() && frontierAmbientMaySpawn()', 'Arcade keeps its existing population rules');
run('isStoryMode=true;currentLevel=2;');
check('!frontierAmbientStory() && frontierAmbientMaySpawn()', 'Other story sectors keep their independent population rules');
console.log('Frontier ambient population: '+checks+' checks passed.');

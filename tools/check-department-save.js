// Department rewards belong to one campaign. Exercise real save/load and run
// replacement, including legacy pending-barrier migration and player creation.
const assert = require('node:assert/strict');
const { ctx, probe } = require('./harness.js');
const run = code => probe(code);
let checks = 0, slot = null, seed = 9157;
const ok = (label, code) => { assert.ok(run(code), label); checks++; };
ctx.setTimeout = () => 0;
ctx.touches = [];
ctx.navigator.getGamepads = () => [];
ctx.localStorage = {
  getItem: key => key === 'urbanTwinStickSave' ? slot : null,
  setItem: (key, value) => { if (key === 'urbanTwinStickSave') slot = value; },
  removeItem: key => { if (key === 'urbanTwinStickSave') slot = null; }
};
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const r = seed / 4294967296;
  if (a === undefined) return r;
  if (Array.isArray(a)) return a[(r * a.length) | 0];
  return b === undefined ? a * r : a + r * (b - a);
};
// Observe native construction rather than merely checking final global values:
// late restoration can refill the player while leaving spawned actors stale.
run(`window.departmentPlayerCreations=[];
  const departmentTestCharacter=Character;
  Character=class extends departmentTestCharacter {
    constructor(...args) {
      super(...args);
      if(args[2])departmentPlayerCreations.push({farm:window.farmLvl,mil:window.milLvl,
        sci:window.sciLvl,arch:window.archLvl,maxHp:this.maxHp,pistol:this.weaponAmmo.PISTOL});
    }
  };
  resetRunState();
  for(const dept of ['farm','mil','sci','arch']){window[dept+'Lvl']=2;window[dept+'XP']=75;}
  window.archBarrierReady=true;
  smgUnlocked=dualSmgUnlocked=shotgunUnlocked=arUnlocked=rocketLauncherUnlocked=revolverUnlocked=true;
  isStoryMode=false;startAtLevel(2);player.hp=113;player.shield=0;
  saveGame();`);
const high = JSON.parse(slot);
assert.equal(high.archBarrierReady, true, 'save records the pending architecture reward'); checks++;
function load(snapshot) {
  slot = JSON.stringify(snapshot);
  run(`departmentPlayerCreations=[];loadGame();`);
}
run(`for(const dept of ['farm','mil','sci','arch']){window[dept+'Lvl']=1;window[dept+'XP']=0;}
  window.archBarrierReady=false;player.hp=7;`);
load(high);
ok('all four department rewards exist before native player construction',
  `departmentPlayerCreations.length===1&&departmentPlayerCreations[0].farm===2&&
   departmentPlayerCreations[0].mil===2&&departmentPlayerCreations[0].sci===2&&
   departmentPlayerCreations[0].arch===2&&departmentPlayerCreations[0].maxHp===125&&
   departmentPlayerCreations[0].pistol===WEAPONS.PISTOL.maxAmmo*2`);
ok('load restores injured farming health and an empty shield without refilling either',
  'player.maxHp===125&&player.hp===113&&player.shield===0');
ok('all saved department experience and the pending barrier return',
  `['farm','mil','sci','arch'].every(dept=>window[dept+'Lvl']===2&&window[dept+'XP']===75)&&window.archBarrierReady`);
for (const weapon of ['PISTOL','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','ROCKET_LAUNCHER','TASER','REVOLVER','COACH_GUN']) {
  ok(weapon + ' keeps the military magazine capacity after load',
    `player.weaponAmmo[WEAPONS.${weapon}.name]===WEAPONS.${weapon}.maxAmmo*2`);
}
ok('science reach is derived from the restored campaign', 'chemistCannonRange(player,300)===345');
assert.equal(slot, JSON.stringify(high), 'loading does not rewrite the save'); checks++;

// An explicit spent flag remains authoritative even when the barrier no
// longer exists. Neither load nor a repeated level check may mint a new one.
run('window.archBarrierReady=false;playerStructures=[];saveGame();');
const spent = JSON.parse(slot);
assert.equal(spent.archBarrierReady, false, 'save records a consumed reward'); checks++;
for (let n = 0; n < 2; n++) {
  run('window.archBarrierReady=true;'); load(spent);
  run('checkLevelUps();');
  ok('spent barrier stays spent on load ' + (n + 1), '!window.archBarrierReady&&!playerStructures.some(b=>b.isUBarrier)');
}

const oldPlaced = { ...high, playerHp: 999, playerBarriers: [
  {x:10000,y:10000,w:200,h:200,hp:0,maxHp:1000,level:2}
] };
delete oldPlaced.archBarrierReady;
load(oldPlaced);
ok('legacy placed barrier history consumes the architecture reward', '!window.archBarrierReady');
ok('loading a destroyed legacy barrier does not resurrect it', '!playerStructures.some(b=>b.isUBarrier&&b.hp>0)');
ok('saved health is clamped to the farming maximum', 'player.hp===125&&player.maxHp===125');

const oldPending = { ...high, playerBarriers: [] };
delete oldPending.archBarrierReady;
load(oldPending);
ok('legacy level two without a placed barrier receives its pending reward', 'window.archBarrierReady');

// Loading an older file after a level-two campaign must derive fresh defaults
// rather than inherit the previous player's rewards or saved over-cap health.
const oldLow = { ...high, playerBarriers: [], chemistSuitUnlocked: false, chemistOwned: false };
for (const dept of ['farm','mil','sci','arch']) {
  delete oldLow[dept+'Lvl']; delete oldLow[dept+'XP'];
}
delete oldLow.archBarrierReady;
load(oldLow);
ok('missing old-file department fields use level-one defaults',
  `['farm','mil','sci','arch'].every(dept=>window[dept+'Lvl']===1&&window[dept+'XP']===0)`);
ok('an older file cannot inherit farming, military, science or architecture rewards',
  `player.maxHp===100&&player.hp===100&&player.ammo===player.currentWeapon.maxAmmo&&
   chemistCannonRange(player,300)===300&&!window.archBarrierReady&&!chemistSuitUnlocked&&!window.chemistOwned`);

run(`for(const dept of ['farm','mil','sci','arch']){window[dept+'Lvl']=2;window[dept+'XP']=75;}
  window.archBarrierReady=true;pendingLevel=2;pendingStoryMode=false;beginSelectedRun();`);
ok('starting a new run clears every department reward and its experience',
  `['farm','mil','sci','arch'].every(dept=>window[dept+'Lvl']===1&&window[dept+'XP']===0)&&
   player.maxHp===100&&player.ammo===player.currentWeapon.maxAmmo&&!window.archBarrierReady`);
run(`enemiesList=[];player.hp=75;
  for(const dept of ['farm','mil','sci','arch'])window[dept+'XP']=49.9;
  checkLevelUps();`);
ok('department rewards do not unlock before the accrual threshold',
  `['farm','mil','sci','arch'].every(dept=>window[dept+'Lvl']===1)&&player.hp===75&&!window.archBarrierReady`);
run(`for(const dept of ['farm','mil','sci','arch'])window[dept+'XP']=50;checkLevelUps();`);
ok('the accrual threshold grants all four level-two rewards',
  `['farm','mil','sci','arch'].every(dept=>window[dept+'Lvl']===2)&&
   player.maxHp===125&&player.hp===100&&player.reloadTimer>0&&window.archBarrierReady&&
   chemistSuitUnlocked&&window.chemistOwned&&chemistCannonRange(player,300)===345`);
run('player.hp=80;window.archBarrierReady=false;checkLevelUps();checkLevelUps();');
ok('rechecking earned levels neither heals again nor recreates a spent barrier',
  'player.hp===80&&player.maxHp===125&&!window.archBarrierReady');

console.log(`${checks}/${checks} department save, migration and accrual checks passed.`);

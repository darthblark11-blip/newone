// Exercise the real city actors, encounter state, relationship records and
// private escalation RNG. UI/native input is covered by the browser scene.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let checks = 0;
const run = s => probe(s), P = s => probe('(' + s + ')');
function check(s, message) { assert(P(s), message); checks++; }
function reset(hour = 22) {
  run(`isStoryMode=false;started=true;doTick=true;currentLevel=1;currentBiome=1;BIOME_ACTIVE=true;
    isPaused=false;isDead=false;isWin=false;killcamMode=false;nm0AmbushActive=false;
    inStoryIntro=false;inStoryRoom=false;inTownCutscene=false;inFortCutscene=false;
    inPostAmbushCutscene=false;inFarmCutscene=false;inFarmPostCutscene=false;
    inDarchonCall=false;inWorldBuildingMenu=false;inOverworldView=false;inTravelMenu=false;inUpgradeMenu=false;
    activeBuildings=[];buildings=[];activeParkingCars=[];barrels=[];invalidateColIndex();
    enemiesList=[];bullets=[];cityNoise=[];biomeState={};frameCount=120;deltaTime=1000/60;
    resetStreetThugEncounters();worldTimeMs=DAY_MS*${hour}/24;
    player=new Character(15000,15000,true);player.hp=100;player.isArmed=false;player.isUnarmed=true;
    rightStick={active:false,dist:0,dx:0,dy:0};leftStick={active:false,dx:0,dy:0};
    viewLeft=14000;viewRight=16000;viewTop=14000;viewBottom=16000;
    window.thug=new Character(15120,15000,false,'CITY_THUG_M');cityAppearance(thug,91);
    thug.cityCx=12;thug.cityCy=12;thug.cityPersonKey='12,12,people:5';
    restoreStreetThugRecord(thug);enemiesList=[thug];`);
}
function talk() { run('frameCount++;updateCityCivilian(thug);'); check('streetThugEncounter()&&streetThugEncounter().ready', 'nearby night thug opens an actionable check'); }
reset();
for (const [hour, expected] of [[20.999,false],[21,true],[23.99,true],[0,true],[3.499,true],[3.5,false],[8,false]]) {
  run(`worldTimeMs=DAY_MS*${hour}/24;`); assert.equal(P('streetThugNight()'), expected, 'night boundary ' + hour); checks++;
}
run('worldTimeMs=DAY_MS*12/24;updateCityCivilian(thug);');
check('!streetThugEncounter()&&thug.isNeutral&&!thug.cityStreetFight', 'daytime thugs stay neutral');
run('worldTimeMs=DAY_MS*22/24;'); talk();
check('STREET_THUG_PHRASES.includes(streetThugEncounter().phrase)', 'check uses one of the requested exact phrases');
check('enemiesList.length===1&&!thug.isMilitary&&!thug.isPopulation', 'checks use residents without recruitment/spawn side effects');
run('window.group=streetThugGroup(thug);window.rngBefore=group.rng;');
check('chooseStreetThugResponse("NEUTRAL")', 'neutral response accepts once');
check('!chooseStreetThugResponse("NEGATIVE")&&group.gunRolls===0&&group.rng===rngBefore', 'dismissed checks cannot reroll or consume escalation RNG');
run('frameCount++;updateCityCivilian(thug);');
check('thug.isNeutral&&!thug.cityStreetFight&&thug.x>15120&&!streetThugEncounter()', 'neutral response walks away and remains neutral');
check('group.cooldown>2000', 'neutral response has a long harassment cooldown');

reset(); talk(); run('chooseStreetThugResponse("POSITIVE");');
check('streetThugCombatProtected(thug)&&thug.isFriendly&&!thug.isNeutral&&!thug.cityStreetFight', 'positive response establishes protected alliance');
run('window.old=JSON.parse(JSON.stringify(streetThugRecord(thug)));biomeState=JSON.parse(JSON.stringify(biomeState));enemiesList=[];resetStreetThugEncounters();');
run(`window.restored=new Character(15120,15000,false,'CITY_THUG_M');cityAppearance(restored,91);
  restored.cityCx=12;restored.cityCy=12;restoreStreetThugRecord(restored,old);enemiesList=[restored];`);
check('streetThugCombatProtected(restored)&&restored.isFriendly&&!restored.isNeutral', 'alliance survives record and biome JSON reload');
run(`window.newcomer=new Character(15190,15000,false,'CITY_THUG_M');cityAppearance(newcomer,92);
  newcomer.cityCx=13;newcomer.cityCy=12;restoreStreetThugRecord(newcomer);`);
check('streetThugCombatProtected(newcomer)', 'a newly streamed member inherits its stable district relationship');
check('!restored.isMilitary&&!restored.isPopulation&&!restored.isRecruit', 'alliance does not grant military or recruit ledger flags');

for (const [seed, armed] of [[1,true],[12345,false]]) {
  reset();
  run(`for(let i=0;i<6;i++){const e=new Character(15120+i*16,15030,false,'CITY_THUG_M');cityAppearance(e,100+i);
    e.cityCx=12;e.cityCy=12;restoreStreetThugRecord(e);enemiesList.push(e);}`);
  talk(); check('streetThugEncounter().members.length===4', 'existing local gang check has a four-member ceiling');
  run(`window.group=streetThugGroup(thug);group.rng=${seed};window.checkMembers=streetThugEncounter().members.slice();chooseStreetThugResponse('NEGATIVE');`);
  check('group.gunRolls===1', 'negative encounter makes one private escalation roll');
  assert.equal(P('checkMembers.filter(e=>e.cityThugGunDrawn).length'), armed ? 1 : 0); checks++;
  check('checkMembers.every(e=>!e.isFriendly&&!e.isNeutral)', 'negative group is hostile rather than a friendly boxing target');
  check('checkMembers.filter(e=>!e.cityThugGunDrawn).every(e=>e.cityStreetFight)', 'all non-gun members enter the shared fistfight');
  for (let i=0;i<15;i++)run('frameCount++;for(const e of checkMembers)updateCityCivilian(e);');
  check('group.gunRolls===1&&!chooseStreetThugResponse("NEGATIVE")', 'later AI frames and repeated responses do not reroll');
  if (armed) check('thug.currentWeapon===WEAPONS.PISTOL&&thug.isArmed&&!thug.isUnarmed&&bullets.some(b=>b.shooter===thug)', 'rare escalation draws and fires a real hostile pistol');
}
// Invert the private PRNG only in this fixture so the two adjacent integer
// samples straddling exactly 9% exercise the production probability boundary.
function undoLeft(value, shift) { let n=value; for(let i=0;i<32;i+=shift)n=value^(n<<shift); return n>>>0; }
function undoRight(value, shift) { let n=value; for(let i=0;i<32;i+=shift)n=value^(n>>>shift); return n>>>0; }
for(const [sample, armed] of [[Math.ceil(.09*4294967296)-1,true],[Math.ceil(.09*4294967296),false]]) {
  reset();talk();
  const seed=undoLeft(undoRight(undoLeft(sample,5),17),13);
  run(`streetThugGroup(thug).rng=${seed};chooseStreetThugResponse('NEGATIVE');`);
  assert.equal(P('streetThugGroup(thug).rng'),sample);checks++;
  assert.equal(P('thug.cityThugGunDrawn'),armed,'nine percent boundary sample '+sample);checks++;
}

for (const reason of ['isPaused=true','inTravelMenu=true','nm0AmbushActive=true','worldTimeMs=DAY_MS*12/24','player.x+=1000','player.shovelLevel=1;player.shovelDepth=SHOVEL.underground+20','thug.hp=0']) {
  reset(); talk(); run(reason + ';'); check('!streetThugEncounter()', 'check cancels on ' + reason);
}
reset(); talk();
run('player.isArmed=true;player.isUnarmed=false;player.currentWeapon=WEAPONS.PISTOL;player.aimAngle=0;rightStick.active=true;rightStick.dx=1;rightStick.dist=1;');
check('!streetThugEncounter()', 'pointing a gun cancels dialogue');
run('frameCount++;updateCityCivilian(thug);'); check('thug.state==="FLEE"&&thug.panicTimer>0', 'an unarmed neutral thug flees a gun threat');
reset(); talk();
run('civilianNoise(player.x,player.y,620,player);frameCount++;updateCityCivilian(thug);');
check('!streetThugEncounter()&&thug.state==="FLEE"', 'gunfire cancels the check and sends a neutral thug fleeing');
reset(); talk(); run('chooseStreetThugResponse("POSITIVE");civilianNoise(player.x,player.y,620,player);frameCount++;updateCityCivilian(thug);');
check('streetThugCombatProtected(thug)&&!thug.panicTimer', 'an allied member stays available through nearby gunfire');
run(`window.foe=new Character(15380,15000,false,'NORMAL');foe.isFriendly=false;foe.isNeutral=false;enemiesList.push(foe);
  for(let i=0;i<15;i++){frameCount++;updateCityCivilian(thug);}`);
check('thug.cityThugTarget===foe&&thug.cityThugGunDrawn&&bullets.some(b=>b.shooter===thug&&b.isP)', 'aligned thug targets hostile NM0 and fires friendly projectiles');
run('streetThugOnDamage(thug,foe);'); check('thug.isFriendly&&!thug.isNeutral&&!thug.panicTimer', 'enemy damage does not revoke alliance or impose civilian panic');
console.log(`Street thug encounters passed: ${checks} checks (night boundaries, choices, nine-percent private roll, group cap, cancellation, alliance persistence and armed assistance).`);

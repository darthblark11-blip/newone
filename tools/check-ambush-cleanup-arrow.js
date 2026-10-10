// The last fifth of an NM-0 muster should point at the nearest body that can
// drain its counter, including conscripted fort combatants. Exercise the real
// HUD ratio and measure the arrow after its screen transforms.
const assert = require('assert');
const { ctx, probe } = require('./harness.js');
let checks = 0;
function ok(name, condition) {
  assert(condition, name);
  checks++;
}
const close = (a, b) => Math.abs(a - b) < 1e-8;
const enemy = (props = {}) => ({ x: 400, y: 600, hp: 100,
  eType: 'ARMORED_STANDARD', isAmbush: true, ...props });
function roster(list) {
  ctx.cleanupTestRoster = list;
  probe('enemiesList = window.cleanupTestRoster;');
}
function reset() {
  probe(`player = new Character(100, 200, true); started = true;
    currentLevel = 3; BIOME_ACTIVE = false; isStoryMode = false;
    nm0AmbushActive = true; nm0AmbushKills = 30; window.ambushKillsTotal = 150;
    isDead = isWin = isPaused = killcamMode = false;
    inStoryIntro = inStoryRoom = inTownCutscene = inFortCutscene = false;
    inFarmCutscene = inFarmPostCutscene = inPostAmbushCutscene = false;
    inLvl4Cutscene = inDarchonCall = inWorldBuildingMenu = inTravelMenu = inUpgradeMenu = false;
    window.nm0AmbushCleared = window.inNM0SecretOverlay = false;
    camX = camY = 0; zoom = 1; buildings = []; buildSites = [];
    rightStick = { base: { x: 1000, y: 700 } };
    leftStick = { base: { x: 200, y: 700 } };`);
  roster([enemy()]);
}

// Record primitives using the same affine composition as p5. A balanced stack
// alone cannot detect an arrow painted at a stale camera centre or zoomed twice.
let matrix, fillColor, stack, arrows;
ctx.push = () => stack.push({ matrix: matrix.slice(), fillColor });
ctx.pop = () => {
  assert(stack.length, 'drawing must not pop past the starting stack');
  ({ matrix, fillColor } = stack.pop());
};
ctx.translate = (x, y) => {
  matrix[4] += matrix[0] * x + matrix[2] * y;
  matrix[5] += matrix[1] * x + matrix[3] * y;
};
ctx.rotate = angle => {
  const c = Math.cos(angle), s = Math.sin(angle), [a, b, d, e] = matrix;
  matrix[0] = a * c + d * s; matrix[1] = b * c + e * s;
  matrix[2] = d * c - a * s; matrix[3] = e * c - b * s;
};
ctx.scale = (x, y = x) => {
  matrix[0] *= x; matrix[1] *= x; matrix[2] *= y; matrix[3] *= y;
};
ctx.fill = (...args) => { fillColor = args; };
ctx.triangle = (...args) => {
  if (!fillColor || fillColor.join(',') !== '255,50,50,240') return;
  const vertices = [];
  for (let i = 0; i < args.length; i += 2) {
    const x = args[i], y = args[i + 1];
    vertices.push([matrix[0] * x + matrix[2] * y + matrix[4],
                   matrix[1] * x + matrix[3] * y + matrix[5]]);
  }
  arrows.push(vertices);
};
function capture(statement = 'drawUI();') {
  matrix = [1, 0, 0, 1, 0, 0]; fillColor = null; stack = []; arrows = [];
  probe(statement);
  assert.strictEqual(stack.length, 0, 'HUD must restore its drawing stack');
  assert.deepStrictEqual(matrix, [1, 0, 0, 1, 0, 0], 'HUD must restore its screen transform');
  return arrows;
}
const drawArrow = () => capture('drawNM0AmbushCleanupArrow(Math.max(0, nm0AmbushKills) / (window.ambushKillsTotal || 300));');

console.log('== the HUD starts pointing at 20% remaining ==');
for (const total of [150, 300, 450, 151]) {
  reset();
  const lastFifth = Math.floor(total / 5);
  probe(`window.ambushKillsTotal = ${total}; nm0AmbushKills = ${total};`);
  ok(`a fresh ${total}-body muster has no arrow`, capture().length === 0);
  probe(`nm0AmbushKills = ${lastFifth + 1};`);
  ok(`${total}: above the last fifth has no arrow`, capture().length === 0);
  probe(`nm0AmbushKills = ${lastFifth};`);
  ok(`${total}: the last fifth has one arrow`, capture().length === 1);
  probe('nm0AmbushKills = 1;');
  ok(`${total}: the last enemy still has an arrow`, capture().length === 1);
  probe('nm0AmbushKills = 0;');
  ok(`${total}: no arrow after the count clears`, capture().length === 0);
}
reset();
probe('window.ambushKillsTotal = 0; nm0AmbushKills = 61;');
ok('a legacy missing total uses the HUD fallback of 300', capture().length === 0);
probe('nm0AmbushKills = 60;');
ok('the legacy threshold includes exactly 20%', capture().length === 1);

console.log('== only actual live counter members are eligible ==');
reset();
const wanted = enemy({ x: 700, y: 200 });
const exclusions = [
  { isAmbush: false }, { isFriendly: true }, { isNeutral: true },
  { isPopulation: true }, { isOutpostGarrison: true }, { cityPersonKey: 'resident' },
  { dead: true }, { hp: 0 }, { hp: -1 }, { isPlayer: true },
  { eType: 'BUG' }, { eType: 'DAD' }, { eType: 'MILITARY_NEUTRAL' },
  { eType: 'CITY_CITIZEN_M' }, { eType: 'CITY_CITIZEN_F' }, { isCityCivilian: true },
  { eType: 'FARMER_MALE' }, { eType: 'FARMER_FEMALE' },
  { eType: 'VILLAGER_MALE', isUnarmed: true }
];
for (const flags of exclusions) {
  roster([null, enemy({ x: 101, y: 200, ...flags }), wanted]);
  ok(`ignore ${JSON.stringify(flags)}`, probe('nearestNM0AmbushEnemy()') === wanted);
}
for (const type of ['SAUCER', 'SAUCER_RED', 'SNAIL', 'SNAIL_HYBRID', 'ALIEN_GATOR']) {
  roster([enemy({ x: 101, y: 200, eType: type, isAmbush: false }), wanted]);
  ok(`an unrelated ${type} is not the target`, probe('nearestNM0AmbushEnemy()') === wanted);
}
for (const type of ['ARMORED_STANDARD', 'ARMORED', 'AERIAL', 'AERIAL_PISTOL',
                    'NM0_GREY_FATIGUE', 'NM0_ROOKIE', 'NM0_ROOKIE_F', 'ROBOT', 'NORMAL']) {
  const member = enemy({ x: 101, y: 200, eType: type, isUnarmed: type === 'ROBOT' });
  roster([wanted, member]);
  ok(`a tagged ${type} remains count-relevant`, probe('nearestNM0AmbushEnemy()') === member);
}
// Fort conscription is about membership rather than a faction name. If it
// genuinely tags a combatant whose kill drains the counter, that body counts.
const conscriptedAlien = enemy({ x: 101, y: 200, eType: 'ALIEN_GATOR' });
roster([wanted, conscriptedAlien]);
ok('a genuinely conscripted combatant remains eligible', probe('nearestNM0AmbushEnemy()') === conscriptedAlien);
roster(exclusions.map(flags => enemy(flags)));
ok('no eligible live body produces no arrow', drawArrow().length === 0);
roster([]);
ok('an empty field produces no arrow while reserves are pending', drawArrow().length === 0);

console.log('== nearest means exact distance, with stable ties ==');
reset();
const farther = enemy({ x: 130, y: 240 }); // 50 units
const nearer = enemy({ x: 148, y: 200 });  // 48 units
roster([farther, nearer]);
ok('select by squared Euclidean distance', probe('nearestNM0AmbushEnemy()') === nearer);
const tied = enemy({ x: 100, y: 248 });
roster([nearer, tied]);
ok('equal-distance ties retain the first actor', probe('nearestNM0AmbushEnemy()') === nearer);
roster([tied, nearer]);
ok('tie behavior follows stable list order', probe('nearestNM0AmbushEnemy()') === tied);
roster([enemy({ x: NaN, y: 200 }), nearer]);
ok('invalid coordinates cannot mask a valid nearest enemy', probe('nearestNM0AmbushEnemy()') === nearer);
roster([enemy({ x: 100, y: 200 })]);
ok('coincident bodies do not produce an undefined direction', drawArrow().length === 0);

// No visibility queries are necessary to point through a building. Position
// getters also bound the work to one distance read per eligible enemy.
let positionReads = 0;
const many = Array.from({ length: 2000 }, (_, i) => {
  const actor = enemy({ y: 200 });
  Object.defineProperty(actor, 'x', { get() { positionReads++; return 2100 - i; } });
  return actor;
});
roster(many);
const savedLOS = ctx.hasLineOfSight;
ctx.hasLineOfSight = () => { throw Error('cleanup search must not perform LOS'); };
ok('the nearest actor can be at the end of a large roster', probe('nearestNM0AmbushEnemy()') === many[many.length - 1]);
ok('the search reads each eligible position once', positionReads === many.length);
ctx.hasLineOfSight = savedLOS;

console.log('== suppressed states do not scan the field ==');
const suppressed = ['nm0AmbushActive = false', 'nm0AmbushKills = 0',
  'nm0AmbushKills = 31', 'started = false', 'player = null', 'player.hp = 0',
  'player.dead = true', 'isDead = true', 'isWin = true', 'isPaused = true',
  'killcamMode = true', 'inStoryIntro = true',
  'inStoryRoom = true', 'inTownCutscene = true', 'inFortCutscene = true',
  'inFarmCutscene = true', 'inFarmPostCutscene = true', 'inPostAmbushCutscene = true',
  'inLvl4Cutscene = true', 'inDarchonCall = true', 'inWorldBuildingMenu = true',
  'inTravelMenu = true', 'inUpgradeMenu = true', 'window.inNM0SecretOverlay = true'];
for (const state of suppressed) {
  reset();
  roster(new Proxy([], { get() { throw Error('suppressed arrow scanned the field'); } }));
  probe(`${state};`);
  ok(`no arrow or scan when ${state}`, drawArrow().length === 0);
}

console.log('== screen direction follows the player through camera pan and zoom ==');
for (const [camX, camY, zoom] of [[0, 0, 1], [-500, -200, 0.25], [-300, -100, 2]]) {
  reset();
  probe(`camX = ${camX}; camY = ${camY}; zoom = ${zoom};`);
  const arrow = drawArrow()[0];
  const expectedX = (100 - camX) * zoom + 0.6 * 64;
  const expectedY = (200 - camY) * zoom + 0.8 * 64;
  ok(`pan ${camX},${camY}, zoom ${zoom}: correct tip position`,
     close(arrow[0][0], expectedX) && close(arrow[0][1], expectedY));
  const baseX = (arrow[1][0] + arrow[2][0]) / 2;
  const baseY = (arrow[1][1] + arrow[2][1]) / 2;
  ok('tip points toward the enemy in screen space',
     close(arrow[0][0] - baseX, 18 * 0.6) && close(arrow[0][1] - baseY, 18 * 0.8));
  ok('arrow size stays constant across zooms',
     close(Math.hypot(arrow[1][0] - arrow[2][0], arrow[1][1] - arrow[2][1]), 18));
}
for (const [dx, dy] of [[1000, 0], [-1000, 0], [0, -1000], [0, 1000]]) {
  reset(); roster([enemy({ x: 100 + dx, y: 200 + dy })]);
  const arrow = drawArrow()[0];
  ok(`cardinal bearing ${dx},${dy} stays finite and correct`,
     arrow.flat().every(Number.isFinite) &&
     close(arrow[0][0], 100 + Math.sign(dx) * 64) &&
     close(arrow[0][1], 200 + Math.sign(dy) * 64));
}
reset(); roster([enemy({ x: 112, y: 200 })]);
probe('camX = -100; camY = 50; zoom = 0.5;');
const nearTip = drawArrow()[0][0];
ok('the arrow does not overshoot a nearby target', close(nearTip[0], 106) && close(nearTip[1], 75));

console.log('== real grey waves and fort conscription use the same membership ==');
reset();
probe('currentLevel = 4; enemiesList = []; triggerLvl4Ambush();');
ok('a real grey muster starts at 150 without a cleanup arrow',
   probe('nm0AmbushKills === 150 && window.ambushKillsTotal === 150') && drawArrow().length === 0);
ok('its spawned wave contains eligible live targets', !!probe('nearestNM0AmbushEnemy()'));
probe('nm0AmbushKills = 30;');
ok('the real grey muster begins pointing at 30 remaining', drawArrow().length === 1);
reset();
probe(`currentLevel = currentBiome = 1; BIOME_ACTIVE = true; window.outpostForts = {};
       nm0AmbushActive = false; nm0AmbushKills = 0; window.ambushKillsTotal = 0;
       window.nm0AmbushCleared = true;
       enemiesList = []; triggerOutpostAmbush(outpostFortDef(1));
       player.x = outpostFortDef(1).x; player.y = outpostFortDef(1).y;`);
ok('a real fort muster starts at its own full total',
   probe('nm0AmbushKills === window.ambushKillsTotal && nm0AmbushKills >= 150') && drawArrow().length === 0);
ctx.cleanupConscript = enemy({ x: probe('player.x + 1'), y: probe('player.y'),
                              eType: 'NM0_ROOKIE', isAmbush: false });
probe('enemiesList.push(window.cleanupConscript); conscriptIntoMuster(window.cleanupConscript);');
ok('fort conscription joins the live counter and initial total together',
   probe('window.cleanupConscript.isAmbush && nm0AmbushKills === window.ambushKillsTotal'));
ok('a freshly conscripted rookie can become the nearest target',
   probe('nearestNM0AmbushEnemy()') === ctx.cleanupConscript);
probe('nm0AmbushKills = Math.floor(window.ambushKillsTotal / 5);');
ok('the fort threshold follows its changed total', drawArrow().length === 1);
ok('an old story clear flag does not hide the current fort muster',
   probe('window.nm0AmbushCleared === true') && drawArrow().length === 1);

console.log(`${checks} checks passed`);

// Exercise squad orders through the real command dispatcher and AI update.
// Speed is measured from positions after movement, including combat/return
// paths, rather than by inspecting the tuning constant.
const { ctx, probe } = require('./harness.js');
const P = expression => probe('(' + expression + ')');
let checks = 0, failures = 0;
const ok = (name, condition, detail) => {
  checks++;
  console.log((condition ? 'ok ' : 'FAIL ') + name +
    (detail === undefined ? '' : ': ' + JSON.stringify(detail)));
  if (!condition) failures++;
};
const near = (a, b) => Math.abs(a - b) < 1e-8;
let seed = 21943;
ctx.random = (a, b) => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  const n = seed / 4294967296;
  return a === undefined ? n : Array.isArray(a) ? a[Math.floor(n * a.length)] :
    b === undefined ? n * a : a + n * (b - a);
};

function stage(types = ['ARMORED_STANDARD'], walls = []) {
  probe(`currentLevel = 2; BIOME_ACTIVE = false; authoredCore = null;
    nm0AmbushActive = false; isHardMode = false; ninjaSuitUnlocked = false;
    buildings = ${JSON.stringify(walls)}; activeBuildings = buildings.slice();
    activeParkingCars = []; barrels = []; townCitizens = []; cityNoise = [];
    bullets = []; particles = []; enemiesList = []; frameCount = 101;
    viewLeft = viewTop = -1e6; viewRight = viewBottom = 1e6;
    player = new Character(1000, 0, true); player.aimAngle = 0;
    window.__allies = ${JSON.stringify(types)}.map((type, i) => {
      const e = new Character(0, i * 100, false, type);
      e.isFriendly = true; e.isNeutral = false; e.aiOffset = 0;
      e.fireTimer = 10000; e.allySlot = i; return e;
    });
    enemiesList = window.__allies.slice(); buildColIndex();`);
}
function order(command, direction = 'NORTH') {
  probe(`issueSquadCommand(${JSON.stringify(command)}, ${JSON.stringify(direction)});`);
}
function step(frames = 1) {
  return P(`(() => {
    const e = window.__allies[0], x = e.x, y = e.y;
    for (let i = 0; i < ${frames}; i++) {
      frameCount++; for (const a of window.__allies) a.updateEnemy();
    }
    return {x: e.x, y: e.y, dx: e.x - x, dy: e.y - y,
      distance: Math.hypot(e.x - x, e.y - y), moving: e.isMoving};
  })()`);
}
function foe(x, y = 0) {
  probe(`window.__foe = new Character(${x}, ${y}, false, 'NORMAL');
    enemiesList.push(window.__foe);`);
}

for (const [direction, dx, dy] of [
  ['NORTH', 0, -4], ['SOUTH', 0, 4], ['EAST', 4, 0], ['WEST', -4, 0]
]) {
  stage(); order('SEARCH', direction);
  const moved = step();
  ok(`SEARCH ${direction} moves four units`, near(moved.dx, dx) && near(moved.dy, dy), moved);
}

stage(['ARMORED_STANDARD', 'ARMORED_STANDARD', 'ARMORED_STANDARD', 'ARMORED_STANDARD']);
order('SPREAD'); step();
const spread = P('window.__allies.map((e, i) => [e.x, e.y - i * 100])');
ok('SPREAD moves each ally four units in its assigned direction',
  spread.every(([dx, dy], i) => near(dx, [0, 0, 4, -4][i]) && near(dy, [-4, 4, 0, 0][i])), spread);

stage(); order('FOLLOW');
const follow = step();
ok('FOLLOW moves four units toward its formation slot', near(follow.distance, 4) && follow.dx > 0 && follow.dy < 0, follow);
step(300);
ok('FOLLOW stops when it reaches its formation slot', near(step().distance, 0));

stage(); order('HOLD');
ok('HOLD stays stationary at its post', near(step(20).distance, 0));
probe('window.__allies[0].x = 120;');
const returning = step();
ok('HOLD returns to its post at four units per update', near(returning.dx, -4) && near(returning.dy, 0), returning);
step(40);
ok('HOLD stops inside its existing post tolerance', near(step(20).distance, 0) && P('Math.abs(window.__allies[0].x)') <= 50);

for (const command of ['FOLLOW', 'HOLD', 'SPREAD', 'SEARCH']) {
  stage(); order(command); foe(260);
  const moved = step();
  ok(`${command} approaches a nearby foe at four units per update`, near(moved.dx, 4) && near(moved.dy, 0), moved);
  step(40);
  const targetDistance = P('Math.hypot(window.__allies[0].x - window.__foe.x, window.__allies[0].y - window.__foe.y)');
  ok(`${command} retains its combat stopping distance`, near(step().distance, 0) &&
    targetDistance <= (command === 'HOLD' ? 150 : 200), targetDistance);
}

stage(); order('HOLD'); foe(350);
ok('HOLD does not chase a foe outside its perimeter', near(step(20).distance, 0));
stage(); order('FOLLOW'); foe(260);
probe('window.__allies[0].fireTimer = 0;'); step();
ok('commanded allies still fire at a visible hostile', P('bullets.length') > 0 && P('window.__allies[0].fireTimer') > 0);

stage(['ARMORED']); order('SEARCH', 'EAST');
ok('armored ally retains its speed multiplier', near(step().distance, 4 * 0.65));
stage(); probe('window.__allies[0].mountUp(0.3);'); order('FOLLOW');
ok('mounted ally retains its speed multiplier', near(step().distance, 4 * 2.15));
for (const [type, multiplier] of [['AERIAL', 1.25], ['AERIAL_PISTOL', 1.47], ['SAUCER', 1.47], ['SAUCER_RED', 1.47]]) {
  stage([type]); order('SEARCH', 'EAST');
  ok(`${type} friendly command retains its type multiplier`, near(step().distance, 4 * multiplier));
}

// The increased pace still passes through the same steering/collision path.
stage(['ARMORED_STANDARD'], [{x: 300, y: 0, w: 60, h: 400, isBlockBuilding: true}]);
order('SEARCH', 'EAST');
const wallWalk = P(`(() => {
  const e = window.__allies[0]; let inside = 0, maxStep = 0;
  for (let i = 0; i < 250; i++) {
    const x = e.x, y = e.y; frameCount++; e.updateEnemy();
    maxStep = Math.max(maxStep, Math.hypot(e.x - x, e.y - y));
    if (e.checkCol(e.x, e.y)) inside++;
  }
  return {x: e.x, y: e.y, inside, maxStep};
})()`);
ok('faster SEARCH steers past a wall without entering it', wallWalk.x > 350 && wallWalk.inside === 0, wallWalk);
ok('steering does not add speed on top of command movement', wallWalk.maxStep <= 4 + 1e-8, wallWalk.maxStep);

// Orders must not accelerate the earlier civilian/neutral branches or the
// hostile movement code that runs after the friendly branch returns.
stage(['NORMAL']); probe('window.__allies[0].isFriendly = false; window.__allies[0].state = "CHASE"; window.__allies[0].loseSightTimer = 1000;');
order('SEARCH', 'WEST');
ok('hostile ground chase keeps its existing pace', near(step().distance, 2.45));
stage(['AERIAL']); probe('window.__allies[0].isFriendly = false; window.__allies[0].state = "CHASE"; window.__allies[0].loseSightTimer = 1000;');
order('SEARCH', 'WEST');
ok('hostile aerial chase keeps its existing pace', near(step().distance, 2.45 * 1.25));

stage(['MILITARY_NEUTRAL']);
probe(`const neutral = window.__allies[0]; neutral.isNeutral = true;
  neutral.state = 'PATROL'; neutral.patrolTimer = 1000; neutral.patrolCorner = 0;
  neutral.targetBuilding = {x: 500, y: 0, w: 100, h: 100};`);
order('SEARCH', 'EAST');
ok('neutral patrol keeps its existing pace', near(step().distance, 1));
stage(['CITY_CITIZEN_M']);
probe('window.__allies[0].x = 142; window.__allies[0].y = 142; window.__allies[0].cityDistance = 0; window.__allies[0].cityPause = 0;');
order('SEARCH', 'WEST');
ok('city civilian walking keeps its existing pace', near(step().distance, 1.15));
stage(['FARMER_MALE']);
probe('window.__allies[0].x = 142; window.__allies[0].y = 142; window.__allies[0].cityDistance = 0; window.__allies[0].cityPause = 0;');
order('SEARCH', 'WEST');
ok('unarmed farmer walking keeps its existing pace', near(step().distance, 1.15));

stage();
const citizenWalk = P(`(() => {
  const c = new Citizen(0, 0, 'FARMING', 'MALE'); c.state = 'WANDER';
  c.timer = 100; c.tx = 500; c.ty = 0; c.update(); return Math.hypot(c.x, c.y);
})()`);
ok('department citizen walking keeps its existing pace', near(citizenWalk, 0.8));

console.log(`${checks} checks, ${failures} failures`);
process.exitCode = failures ? 1 : 0;

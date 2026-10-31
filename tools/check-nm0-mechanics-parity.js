// This rendering pass must keep the established mechanics implementation.
// Source identity guards complement the seeded full-world replay: a selected
// state fingerprint cannot prove that an unvisited combat branch is unchanged.
// The separately requested wildlife encounter gate is checked by its own test.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {ctx,probe}=require('./harness');
const baseline=execFileSync('git',['show','37dfd722d2524a1810851ffc62905b3aa1d655a4:game.js'],
  {cwd:__dirname+'/..',maxBuffer:8e6}).toString();
const candidate=fs.readFileSync(process.env.GAME_JS||__dirname+'/../game.js','utf8');
// A fresh lexical scope gives V8 the parsing job, including nested template
// literals, regexes, class accessors and comments. Platform stubs come from the
// normal harness; no reference functions are substituted into the candidate.
const reference={...ctx};reference.window=reference;reference.globalThis=reference;
vm.createContext(reference);vm.runInContext(baseline,reference,{filename:'mechanics-reference.js'});
const before=expression=>vm.runInContext(expression,reference);
let functions=0,methods=0,constants=0,constructors=0;
function sameFunction(name){
  assert.equal(probe(`typeof ${name}`),'function',name+' exists');
  assert.equal(probe(`${name}.toString()`),before(`${name}.toString()`),
    name+' must remain exactly the directional-falls branch implementation');
  functions++;
}
function namesBetween(start,end){
  const a=baseline.indexOf(start),b=baseline.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'baseline mechanics region exists');
  return [...baseline.slice(a,b).matchAll(/^function (\w+)\(/gm)].map(m=>m[1]);
}
const guarded=new Set([
  ...namesBetween('function actorCanUseStances(','const SPATIAL_CELL_SIZE'),
  ...namesBetween('function shovelCellKey(','function resourceCount('),
  ...namesBetween('function combatAimElevation(','class Character {'),
  ...namesBetween('function projectileBuckets(','function drawPlayerAimLaser('),
  'setPlayerAimZone','playerAimTarget','togglePlayerHeadAim',
  'distSq','cellKey','buildSpatialBuckets','querySpatialBuckets','getSpatialKey',
  'buildColIndex','colNear','invalidateColIndex','newCrowdSolidIndex',
  'invalidateCrowdSolids','clearCrowdSolidIndex','rebuildCrowdSolidIndex',
  'ensureCrowdSolidIndex','crowdSolidCandidates','crowdSolidOrder',
  'crowdNearbyBarrels','crowdNearbyCars','updateActiveWorld','hasLOS',
  'patrolCornerX','patrolCornerY','getPatrolBuilding','steerAvoid',
  'elevSpeedFactor','waterBodies','waterDepthAt','spawnBullet','spawnOrb',
  'updateBullets','forestShotCover','legShotRangeForWeapon',
  'buildHumanLegHitGeometry','humanLegHitGeometry','mapHitDecalHeight','mapLegHitDecal',
  'resolveSurvivingSwordHit','stanceBodyPose','legInjuryBodyPose','stanceWeaponMount',
  'stanceLocalPoint','stanceSupportMount','stancePointInBody','stanceMuzzleWorld',
  'updateGrenades','updateOrbs','triggerExplosion','processKill','buildPushBuckets',
  'updateEntities','updateWorldBoxingPlayer','updateWorldBoxingOpponents','advanceStun',
  'triggerGateAmbush','spawnSingleEnemy','spawnAmbushReinforcement','checkAmbushCleared',
  'triggerOutpostAmbush','conscriptIntoMuster','maintainOutpostMuster',
  'gateIsOpen','recordSectorGateBreach','recordSouthGateBreached','outpostFortState',
  'activeFortMuster','startingFortressOwned','sectorTowersAreDown','checkShovelPassiveRoute',
  // Existing animals still collide and react with precisely their original
  // mechanics; only the new-encounter scheduling exception is allowed.
  'wildlifeActorBlocked','wildlifeBodyMetric','wildlifeBodySweep','wildlifeSolidAnimal',
  'wildlifeHumanContact','wildlifeHumanBlocks','wildlifeCanStand','wildlifeBrain',
  'wildlifeSenseHumans','wildlifeRebuildGrid','notifyForestWildlifeThreat'
]);
for(const name of guarded)if(!name.startsWith('draw'))sameFunction(name);

// Lock all non-render methods, including accessors and uncommon weapon paths.
// Constructor bodies are checked separately because a class constructor's
// Function#toString includes its rendering methods too.
for(const className of ['Character','Bullet','Orb','Grenade','Molotov','PlayerGrenade']){
  const oldDescriptors=before(`Object.getOwnPropertyDescriptors(${className}.prototype)`);
  const newDescriptors=probe(`Object.getOwnPropertyDescriptors(${className}.prototype)`);
  assert.deepEqual(Object.keys(newDescriptors).sort(),Object.keys(oldDescriptors).sort(),className+' method roster');
  for(const [name,oldDescriptor]of Object.entries(oldDescriptors)){
    if(name==='constructor'||name==='show')continue;
    for(const kind of ['value','get','set'])if(typeof oldDescriptor[kind]==='function'){
      assert.equal(String(newDescriptors[name][kind]),String(oldDescriptor[kind]),className+'.'+name+' '+kind+' mechanics');
      methods++;
    }
  }
  // Every constructor here is followed by a getter or ordinary first method.
  const next=className==='Character'?'get ammo\\(\\)':className==='Bullet'?'get active\\(\\)':
    className==='Orb'?'init\\(':'update\\(\\)';
  const extract=source=>{
    const start=source.indexOf('class '+className+' {'),match=source.slice(start).match(new RegExp('\\n\\s*'+next));
    const end=match?start+match.index:-1;
    assert.ok(start>=0&&end>start,className+' constructor markers');return source.slice(start,end);
  };
  assert.equal(extract(candidate),extract(baseline),className+' constructor mechanics');constructors++;
}

const scalarConstants=['STANCE_HOLD_MS','PRONE_DIVE_MS','PRONE_DIVE_DISTANCE','PRONE_DIVE_LEVEL_MS',
  'LEG_INJURY_CHANCE','LEG_INJURY_RECOVER_MS','LEG_INJURY_COOLDOWN_MS','LEG_INJURY_DOWNED_MS',
  'LEG_INJURY_SUPINE_MS','LEG_INJURY_SIT_UP_MS','ENEMY_COVER_DIVE_MS','ENEMY_COVER_DIVE_DISTANCE',
  'COVER_FOOT_MARGIN','COVER_LEAN_MAX','COVER_NEAR_DISTANCE','SPATIAL_CELL_SIZE','COL_CELL','COL_PAD',
  'CROWD_SOLID_CELL','ENEMY_BULLET_SPEED','PLAYER_BULLET_SPEED','LEG_SHOT_DAMAGE_SCALE','ALLY_COMMAND_SPEED',
  'SHOVEL_MANTLE_MS','ROBOT_HEAD_HP','ROBOT_CHARGE','ROBOT_BEAM_DMG','ROBOT_BURST','ROBOT_BURST_GAP',
  'ROBOT_COOLDOWN','ROBOT_FUSE','ROBOT_OIL_AT','ROBOT_BLAST_R','ROBOT_MELEE_KB','GAIT_EASE','GAIT_FULL'];
const tableConstants=['COMBAT_STANCES','STANDING_STANCE_POSE','LEG_INJURY_OUTCOMES',
  'LEG_INJURY_SEATED_BODY','LEG_INJURY_SEATED_LEGS','COLLISION_COVER','ENEMY_SHOT_REACTIONS',
  'STANCE_PROJECTILE_PROFILES','LEG_SHOT_RANGES','WEAPONS','SHOVEL','SHOVEL_DIG_ANIM'];
for(const name of [...scalarConstants,...tableConstants]){
  const expression=`JSON.stringify(${name},(key,value)=>typeof value==='number'&&!Number.isFinite(value)?String(value):value)`;
  assert.equal(probe(expression),before(expression),name+' gameplay values');constants++;
}
for(const name of ['ENEMY_COVER_WEAPONS','SHOVEL_AIRBORNE_TYPES']){
  const expression=`JSON.stringify(Array.from(${name},value=>value&&value.name||value))`;
  assert.equal(probe(expression),before(expression),name+' eligibility set');constants++;
}
assert.ok(!candidate.includes('const STANCE_EXCLUDED_TYPES'),'the previous stance shortcut is removed');
console.log(`PASS mechanics source lock: ${functions} functions, ${methods} methods/accessors, ${constructors} constructors and ${constants} tuning tables/constants match 37dfd72 exactly.`);

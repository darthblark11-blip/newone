// Excavation follows real architecture, including painted courtyard lawns
// which never had a grass collider. Exercise native digs and movement rather
// than requiring a particular surface-material catalog.
const assert = require('assert/strict');
const {ctx, mkG, probe} = require('./harness');
let checks = 0;
const ok = (value, label) => { assert.ok(value, label); checks++; };
const P = code => probe('(' + code + ')');

probe(`isStoryMode=false;resetStoryProgress();startAtLevel(1);started=true;doTick=true;
  isPaused=isDead=isWin=killcamMode=false;inTownCutscene=inPostAmbushCutscene=false;
  inDarchonCall=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inStoryIntro=inStoryRoom=false;
  window.shovelOwned=true;setMeleeTool('SHOVEL');barrels=[];activeParkingCars=[];
  var foundationReset=(x=528,y=720,depth=0)=>{
    shovelExcavation={};player.x=x;player.y=y;player.shovelLevel=currentLevel;
    player.shovelDepth=depth;player.shovelDepthTarget=depth;player.shovelCooldownMs=0;
    player._shovelCellKey=null;player.shovelClimbing=false;player.shovelGateCrossing=null;
    player.aimAngle=0;player.isDashing=false;player.dashTimer=0;player.ignoreBldgTimer=0;
    if(depth)shovelMakeCell(Math.floor(x/96),Math.floor(y/96),depth,true);
  };
  var foundationStream=(x,y)=>{
    foundationReset(x,y);chunkMgr.lastKey=null;chunkMgr.update(x,y);
    activeBuildings=buildings.slice();activeParkingCars=[];buildColIndex();
  };`);

// Coordinates from the west-end screenshot. Use native chunk residency: an
// authored-only map misses both the old turf bug and adjacent generated roofs.
probe('foundationStream(-4080,4368);');
ok(P('shovelSurfaceSoftAt(player.x,player.y)&&shovelDig("DOWN")'),
  'Existing west-end landscaped ground accepts a native dig after streaming');
ok(P('shovelCellAt(-4080,4368).depth===18'),
  'The west-end dig creates the actual waist-deep square');

// The harness uses its own deterministic noise, so its nearest residential
// courtyard is west of the curtain wall. The real painter still owns its turf.
probe('foundationStream(-5280,-432);');
ok(P('cityBlockPlan(-5,-1,"RESIDENTIAL")===2&&cityZoneAt(1,-6000,-1200)==="RESIDENTIAL"'),
  'The regression fixture is a generated courtyard district');
ok(P('buildings.filter(b=>b.isBlockBuilding&&b.cityPlan===2&&b.x>=-6000&&b.x<-4800&&b.y>=-1200&&b.y<0).length===4'),
  'All four detached courtyard wings are resident');
ok(P('!buildings.some(b=>b.isGrassLot&&shovelOverlapsRect(player.x,player.y,0,b))'),
  'The visible courtyard turf does not depend on an isGrassLot collider');
const painted = [], g = mkG();
let ink = [];
g.fill = (...args) => { ink = args; };
g.rect = (...args) => { if (ink[0]===64&&ink[1]===93&&ink[2]===72) painted.push(args); };
ctx.__foundationGround = g;
probe('bakeBiomeDetail(__foundationGround,BIOMES[1],1,-5,-1,-6000,-1200,makeRng(19),()=>0,0,undefined,"CITY");');
ok(painted.some(a=>a[0]===-5635&&a[1]===-835&&a[2]===470&&a[3]===470),
  'The native ground painter actually draws the untagged green courtyard');
ok(P('shovelDig("DOWN")'), 'A native dig recognizes that painted courtyard lawn');
probe('foundationReset(-5280,-432,36);player.shovelCooldownMs=0;player.aimAngle=-Math.PI/2;');
ok(P('shovelDig("FORWARD")'), 'The courtyard tunnel can extend through ordinary untagged open ground');
probe('shovelUpdatePlayer(player,500);player.aimAngle=0;');
const wing = P('buildings.find(b=>b.isBlockBuilding&&b.cityPlan===2&&b.x>=-6000&&b.x<-4800&&b.y>=-1200&&b.y<0)');
ok(P(`!shovelSurfaceSoftAt(${wing.x},${wing.y})`),
  'An actual generated wing keeps its foundation protected beside the diggable court');

// Architecture comes from many generators. All these records describe actual
// roofs, rather than merely being solid obstacles in the buildings array.
const architecture = [
  ...['isBlockBuilding','isHouse','isBarn','isTrailer','isShanty','isMarket',
    'isGasStation','isLiquorStore','isApartment','isWesternBldg','isMall',
    'isCasino','isTheater','isArena','isAlienBldg','isChip','isPyramid',
    'isTower','isBuiltStructure','isBuildSite'].map(flag=>({label:flag,shape:{[flag]:true}})),
  ...['CABIN','SITEHUT','GUARDBOX','BUNKER','CIVICPAVILION','OUTPOST','KIOSK','WATCHTOWER']
    .map(propType=>({label:propType,shape:{isBiomeProp:true,propType}})),
  {label:'legacy roof with residency metadata',shape:{details:[],style:1,isAuthored:true,isChunkSolid:true,isLandmark:true}}
];
for (const {label,shape} of architecture) {
  ctx.__foundationShape = shape;
  probe(`buildings=[Object.assign({x:624,y:720,w:96,h:96},__foundationShape)];
    activeBuildings=buildings.slice();buildColIndex();foundationReset(624,720);`);
  ok(P('!shovelDig("DOWN")&&Object.keys(shovelExcavation).length===0'),
    label + ': surface digging cannot remove a building foundation');
  probe('foundationReset(528,720,36);');
  ok(P('!shovelDig("FORWARD")&&!shovelCellAt(624,720)'),
    label + ': underground tunneling cannot bypass the same foundation');
}

// Furniture, flora and terrain are not houses. Their collision still matters
// above ground, but does not impose an authored tunnel route underneath them.
const scenery = [
  ...['isGrassLot','isParkingLot','isPond','isWater','isRiver','isDeck','isCropField',
    'isCar','isParkingCar','isBuildTruck','isTreeTrunk','isPalm','isRock','isDumpster',
    'isStreetLight','isFence','isWall','isUBarrier','isGiantBarrier','isGovFortress']
    .map(flag=>({label:flag,shape:{[flag]:true}})),
  ...['TERRACEPLANTER','PLANTER','BENCH','FOUNTAIN','HYDRANT','POSTBOX','HEDGE',
    'SANDBAG','BOULDER','MATERIALS','SPOIL','BUSSTOP','ARCADESTALL','BORDERWALL',
    'HOARDING','RUINWALL','CANAL','BRIDGE','CANALBRIDGE','CIVICTERRACE']
    .map(propType=>({label:propType,shape:{isBiomeProp:true,propType}}))
];
for (const {label,shape} of scenery) {
  ctx.__foundationShape = shape;
  probe(`buildings=[Object.assign({x:624,y:720,w:96,h:96},__foundationShape)];
    activeBuildings=buildings.slice();buildColIndex();foundationReset(528,720,36);`);
  ok(P('shovelDig("FORWARD")&&shovelCellAt(624,720).depth===36'),
    label + ': scenery and terrain permit a player-chosen tunnel underneath');
}
probe('buildings=[];foundationReset(912,1104);');
ok(P('shovelDig("DOWN")'), 'Open untagged land starts a shaft without a grass catalog entry');
probe('foundationReset(912,1104);');
ok(P('shovelDig("FORWARD")&&shovelCellAt(1008,1104).depth===18'),
  'Surface forward excavation is also free on untagged open land');
probe('buildings=[{x:517,y:709,w:4,h:4,isHouse:true}];foundationReset();');
ok(P('shovelSurfaceSoftAt(528,720)&&!shovelDig("DOWN")&&!shovelCellAt(528,720)'),
  'A small real foundation between sampling points cannot be swallowed by a whole-square dig');

// Save migration: earlier excavation permitted tunnels under any collider.
// Reject enlarging those invalid columns while leaving a usable way back out.
probe(`buildings=[{x:624,y:720,w:96,h:96,isHouse:true}];activeBuildings=buildings.slice();buildColIndex();
  foundationReset(528,720,54);shovelMakeCell(6,7,36,false,18);`);
ok(P('!shovelDig("FORWARD")&&shovelCellAt(624,720).depth===36'),
  'A preexisting saved pit under a house cannot be deepened from outside');
probe('foundationReset(624,720,36);');
ok(P('!shovelDig("DOWN")&&shovelCellAt(624,720).depth===36'),
  'A player already below an old foundation cannot dig deeper through it');
ok(P('!shovelDig("UP")&&player.shovelDepthTarget===36'),
  'An old tunnel cannot become an exit through the house above');
probe('foundationReset(528,720,36);shovelMakeCell(6,7,36,false,18);');
ok(P('player.checkCol(624,720)'),
  'Native underground collision rejects entry into a legacy or tampered foundation pit');
probe('var beforeFoundationMove=player.x;player.attemptMove(96,0);');
ok(P('player.x<576-SHOVEL.bodyRadius&&player.x>=beforeFoundationMove'),
  'Native movement cannot cross into that foundation volume');
probe('foundationReset(624,720,36);shovelMakeCell(5,7,36,true);var foundationBackedOut=true;for(let n=0;n<16;n++){let m=player.attemptMove(-6,0);if(Math.abs(m.x+6)>.01)foundationBackedOut=false;}');
ok(P('foundationBackedOut&&player.x===528&&shovelPlayerDepth()===36'),
  'An old save already under a foundation can physically back out to its clear tunnel');

// A wall is intentionally tunnelable, but cannot become an unsafe surface
// emergence. This preserves the purpose of bypassing an intact Great Gate.
probe(`buildings=[{x:624,y:720,w:96,h:96,isGiantBarrier:true}];activeBuildings=buildings.slice();buildColIndex();
  foundationReset(528,720,18);var wallWaistDug=shovelDig('FORWARD');shovelUpdatePlayer(player,500);`);
ok(P('wallWaistDug&&shovelCellAt(624,720).depth===18'),
  'A forward dig can remove waist-deep soil at the wall without removing the wall itself');
ok(P('player.checkCol(624,720)'),
  'The exposed upper body still collides with a wall above a waist-deep square');
probe('player.attemptMove(96,0);');
ok(P('player.x<576-SHOVEL.bodyRadius&&shovelPlayerDepth()===18'),
  'Native waist-deep movement cannot bypass an intact curtain wall');
ok(P('shovelDig("DOWN")'), 'The blocked player can deepen the clear approach shaft');
probe('shovelUpdatePlayer(player,500);var wallDeepDug=shovelDig("FORWARD");shovelUpdatePlayer(player,500);');
ok(P('wallDeepDug&&shovelPlayerDepth()===36&&shovelCellAt(624,720).depth===36'),
  'A fully underground dig deepens the same blocked square into a traversable tunnel');
probe(`var wallTunnelDistance=624-player.x;
  var wallTunnelMove=player.attemptMove(wallTunnelDistance,0);shovelUpdatePlayer(player,500);player.shovelCooldownMs=0;`);
ok(P('wallTunnelMove.x===wallTunnelDistance&&player.x===624&&shovelPlayerDepth()===36'),
  'The native player can traverse a carved tunnel below an intact curtain wall');
ok(P('!shovelDig("UP")&&player.shovelDepthTarget===36'),
  'Climbing cannot put the player inside the wall at ground level');
probe('player.aimAngle=0;player.shovelCooldownMs=0;shovelDig("FORWARD");shovelUpdatePlayer(player,500);player.attemptMove(96,0);shovelUpdatePlayer(player,500);');
ok(P('shovelDig("UP")'), 'The player can make an exit beyond the wall on ordinary ground');
probe('shovelUpdatePlayer(player,500);shovelDig("UP");shovelUpdatePlayer(player,500);');
ok(P('player.x===720&&shovelPlayerDepth()===0'),
  'The freely chosen tunnel has a complete safe surface recovery');
probe(`foundationReset(624,720,18);shovelMakeCell(5,7,18,true);
  var shallowWallBackedOut=true;
  for(let n=0;n<16;n++){let m=player.attemptMove(-6,0);if(Math.abs(m.x+6)>.01)shallowWallBackedOut=false;}`);
ok(P('shallowWallBackedOut&&player.x===528&&shovelPlayerDepth()===18'),
  'An old save already waist-deep inside a wall can physically back out without getting trapped');

// These are solid barriers emitted by city checkpoints, civic terraces and
// jungle cordons. They need the same upper-body clearance as the Great Gates,
// while still permitting a tunnel and a surface exit beyond the obstruction.
for (const propType of ['BLASTWALL','CHECKPOINT','CIVICBALUSTRADE','REVETMENT']) {
  ctx.__foundationBarrier = propType;
  probe(`buildings=[{x:624,y:720,w:36,h:150,isBiomeProp:true,propType:__foundationBarrier}];
    activeBuildings=buildings.slice();buildColIndex();foundationReset(528,720,18);
    var propWaistDug=shovelDig('FORWARD');shovelUpdatePlayer(player,500);`);
  ok(P('propWaistDug&&shovelCellAt(624,720).depth===18&&player.checkCol(624,720)'),
    propType + ': waist-deep excavation leaves upper-body barrier collision intact');
  probe('var propWaistMove=player.attemptMove(96,0);');
  ok(P('propWaistMove.x===0&&player.x===528&&shovelPlayerDepth()===18'),
    propType + ': native waist-deep movement cannot sweep through the barrier');
  ok(P('shovelDig("DOWN")'), propType + ': the clear approach can be dug fully underground');
  probe('shovelUpdatePlayer(player,500);var propDeepDug=shovelDig("FORWARD");shovelUpdatePlayer(player,500);');
  ok(P('propDeepDug&&shovelCellAt(624,720).depth===36&&!player.checkCol(624,720)'),
    propType + ': the same square becomes traversable once fully buried');
  probe('var propDeepMove=player.attemptMove(96,0);shovelUpdatePlayer(player,500);');
  ok(P('propDeepMove.x===96&&player.x===624&&shovelPlayerDepth()===36'),
    propType + ': native movement reaches the tunnel beneath the intact barrier');
  ok(P('!shovelDig("UP")&&player.shovelDepthTarget===36'),
    propType + ': climbing cannot emerge inside the surface barrier');
  probe('var propExitDug=shovelDig("FORWARD");shovelUpdatePlayer(player,500);var propExitMove=player.attemptMove(96,0);shovelUpdatePlayer(player,500);');
  ok(P('propExitDug&&propExitMove.x===96&&player.x===720&&shovelDig("UP")'),
    propType + ': the player can extend the passage and climb beyond the barrier');
  probe('shovelUpdatePlayer(player,500);var propSurfaceClimb=shovelDig("UP");shovelUpdatePlayer(player,500);');
  ok(P('propSurfaceClimb&&player.x===720&&shovelPlayerDepth()===0'),
    propType + ': a clear-ground exit restores normal surface movement');
}

console.log('Shovel foundations: '+checks+' native terrain, architecture and save-recovery checks passed.');

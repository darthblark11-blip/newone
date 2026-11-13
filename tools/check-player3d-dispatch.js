// The GPU/browser check validates pixels. This check verifies that production
// painter branches actually dispatch meshes, retain status effects and fall
// back without changing combat state when their renderer cannot draw.
const assert = require('assert');
const {ctx, probe} = require('./harness');
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };

probe(`isStoryMode=false;townsData={};startAtLevel(2);started=true;doTick=true;
  leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
  setMeleeTool('NONE');swordPickedUp=false;frameCount=100;
  explosiveArmorUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
  player.x=0;player.y=0;player.isMoving=false;player.isArmed=false;
  player.stance=null;player.stunTimer=player.skeletonTimer=player.hitFlash=player.muzzleFlash=0;
  window.__player3DDispatch=[];
  Player3D.draw=(snapshot,target,options)=>{__player3DDispatch.push({snapshot,target,options});return true;};`);
const dispatch = setup => {
  ctx.__player3DDispatch.length = 0;
  probe(setup + ';player.show();');
  check(ctx.__player3DDispatch.length === 1, setup + ' renders one player mesh');
  const pass = ctx.__player3DDispatch[0];
  check(pass.snapshot.parts.length > 0, 'the dispatch contains actual mesh parts');
  check(pass.target === ctx.drawingContext, 'the current Canvas target owns compositing');
  return pass;
};

for (const weapon of ['PISTOL','ASSAULT_RIFLE','SHOTGUN','BOW','DUAL_SMG']) {
  const pass = dispatch(`player.isArmed=true;player.currentWeapon=WEAPONS.${weapon}`);
  check(pass.options.mode === 'NORMAL', weapon + ' retains the ordinary actor slot');
}
dispatch('player.reloadTimer=45');
dispatch('player.reloadTimer=0;player.stance={value:1,from:1,to:1,elapsed:150,duration:150}');
dispatch('player.stance={value:2,from:2,to:2,elapsed:300,duration:300,proneHeading:0}');
const skeleton = dispatch('player.stance=null;player.skeletonTimer=40;frameCount=102');
check(skeleton.options.skeleton === true, 'electric skeleton flashes use the mesh path');
const stunned = dispatch('player.skeletonTimer=0;player.stunTimer=50;player.stunPose=null');
check(stunned.options.mode === 'STUN', 'the native nonlethal floor slot renders the mesh');
probe('player.stunTimer=0;player.stance=null;player.isArmed=false;boxingEnter(player,[],"WORLD");');
const boxer = dispatch('player._boxing.stunMs=0');
check(boxer.options.mode === 'BOXING', 'the separate boxing painter renders the player mesh');

// A late crossing arm is a separate mesh-part pass, not a second full body.
probe(`var meshBoxingTarget=new Character(20,10,false);
  var meshBoxingArm=boxingPose(player).arms[0];
  _boxingFigurePass={overlays:new Map([[meshBoxingTarget,[{actor:player,arm:meshBoxingArm}]]])};
  __player3DDispatch.length=0;boxingFlushFigureOverlays(meshBoxingTarget);`);
check(ctx.__player3DDispatch.length === 1, 'deferred boxing contact draws once');
check(ctx.__player3DDispatch[0].snapshot.parts.every(p => ['forearm_left','hand_left'].includes(p.part)),
  'deferred contact contains only the crossing forearm and hand');
probe('_boxingFigurePass=null;boxingExit(player);');

probe(`var meshProxy=Object.create(player);meshProxy.x=15;meshProxy.y=22;
  boxingEnter(meshProxy,[],'WORLD');__player3DDispatch.length=0;
  push();translate(meshProxy.x,meshProxy.y);paintBoxingFigure(meshProxy);pop();`);
check(ctx.__player3DDispatch.length === 1, 'saloon-style inherited player proxies render meshes');
probe(`var meshSavedSession=_frontierSaloonSession;
  _frontierSaloonSession={duel:{playerFired:true,opponentFired:false,phase:'DRAW',reactionMs:200,deadlineMs:300}};
  __player3DDispatch.length=0;paintFrontierQuickDrawPerson(player,false,.7);
  _frontierSaloonSession=meshSavedSession;`);
check(ctx.__player3DDispatch.length === 1 && ctx.__player3DDispatch[0].options.mode === 'QUICKDRAW',
  'the duel-specific draw/holster painter renders the mesh');

// Effects are still produced by the live painter around its mesh. Timers and
// ammunition stay owned by update/fire, including a renderer failure.
probe(`player._boxing=null;player.stance=null;player.stunTimer=0;
  player.isArmed=true;player.currentWeapon=WEAPONS.PISTOL;
  player.reloadTimer=45;player.shieldBurstTimer=8;player.shieldFlashTimer=6;player.hitFlash=3;`);
const oldArc = ctx.arc, oldEllipse = ctx.ellipse;
let arcs=0, ellipses=0;
ctx.arc=(...args)=>{arcs++;return oldArc(...args);};
ctx.ellipse=(...args)=>{ellipses++;return oldEllipse(...args);};
const before = probe('({ammo:player.ammo,reload:player.reloadTimer,burst:player.shieldBurstTimer,shield:player.shieldFlashTimer})');
try { probe('player.show();'); } finally { ctx.arc=oldArc;ctx.ellipse=oldEllipse; }
check(arcs > 0 && ellipses >= 6, 'reload progress and shield feedback survive mesh replacement');
check(probe('player.hitFlash') === 2, 'successful mesh rendering consumes the native hit flash once');
const after = probe('({ammo:player.ammo,reload:player.reloadTimer,burst:player.shieldBurstTimer,shield:player.shieldFlashTimer})');
assert.deepStrictEqual(after,before);checks++;

ctx.__player3DDispatch.length=0;
probe("new Character(0,0,false,'BUG').show();");
check(ctx.__player3DDispatch.length === 0, 'nonhuman enemy painting remains on its native path');
for (const draw of ['()=>false', "()=>{throw Error('context lost');}"]) {
  probe(`Player3D.draw=${draw};player.hitFlash=3;player.show();`);
  check(probe('player.hitFlash') === 2, 'unavailable mesh rendering uses native fallback exactly once');
}
console.log(checks + ' player mesh dispatch, effects, state and fallback checks passed.');

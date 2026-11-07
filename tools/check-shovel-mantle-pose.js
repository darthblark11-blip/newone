// The mantle reuses the live player's identity and cel surfaces while fitting
// both arms to the rim and lifting one knee through the change in level.
const assert=require('assert/strict');
const {ctx,probe}=require('./harness');
let checks=0;
const ok=(code,label)=>{assert.ok(probe(code),label);checks++;};
probe(`currentLevel=currentBiome=1;isStoryMode=false;started=doTick=true;
 player=new Character(528,720,true,'NORMAL');player.shovelLevel=1;
 player.shovelDepth=player.shovelDepthTarget=18;window.shovelOwned=true;setMeleeTool('SHOVEL');
 player.isArmed=false;player.meleeTimer=player.reloadTimer=player.muzzleFlash=0;
 player.gait=0;player.isMoving=false;player.mounted=false;
 player.shovelDigTimer=player.throwAnimTimer=player.cannonCharge=player.cannonFireDelay=0;
 chemistSuitUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=explosiveArmorUnlocked=false;
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
 leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};`);
ok('shovelMantlePose(player)===null','Ordinary standing does not enter the mantle pose');
probe(`player.shovelMantle={elapsedMs:0,durationMs:650,angle:0,handReach:30};
 var begin=shovelMantlePose(player,0),brace=shovelMantlePose(player,.22),
 crest=shovelMantlePose(player,.6),end=shovelMantlePose(player,1);`);
ok('begin.brace===0&&end.brace===0&&begin.lean===0&&end.lean===0','Both ends join the normal carry without a leftover crouch');
ok('brace.fold>.99&&brace.lean>=9&&crest.plant>.5','The sequence leans onto the hands before the lead leg plants');
ok('Math.abs(brace.right.hx+brace.lean-30)<.01&&Math.abs(brace.left.hx+brace.lean-30)<.01',
 'Both palms meet a reachable rim after accounting for torso lean');
ok('end.toolScale===1&&end.headX===0&&end.hip===0','The carry tool and head recover fully when the step finishes');
let poses=0;
for(const [w,h] of [[21,27],[16,25]])for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2]){
 for(const reach of [8,18,30,34])for(let i=0;i<=20;i++){
  const p=probe(`player.bodyW=${w};player.bodyH=${h};player.shovelMantle.angle=${a};
    player.shovelMantle.handReach=${reach};shovelMantlePose(player,${i/20});`);
  const rig=probe('figureRig(player.bodyW,player.bodyH)');
  for(const arm of [p.left,p.right]){
   assert.ok(Object.values(arm).every(Number.isFinite),'Every fitted joint remains finite');
   assert.ok(Math.hypot(arm.ex-arm.sx,arm.ey-arm.sy)<=rig.upper+1e-6,'Upper arm keeps its native length');
   assert.ok(Math.hypot(arm.hx-arm.ex,arm.hy-arm.ey)<=rig.fore+1e-6,'Forearm keeps its native length');
  }
  assert.ok([p.hip,p.torso,p.lean,p.toolAngle,p.toolElevation,p.toolRoll,p.toolScale].every(Number.isFinite));
  poses++;
 }
}
checks+=4;
const names=['push','pop','drawFigureHead','drawShovelGrip','drawShovelHeadSolid','drawHandGunSolid'];
const saved=Object.fromEntries(names.map(n=>[n,ctx[n]]));
let balance=0,heads=0,grips=0,spades=0,guns=0;
ctx.push=(...a)=>{balance++;return saved.push(...a)};
ctx.pop=(...a)=>{balance--;return saved.pop(...a)};
ctx.drawFigureHead=(...a)=>{heads++;return saved.drawFigureHead(...a)};
ctx.drawShovelGrip=(...a)=>{grips++;return saved.drawShovelGrip(...a)};
ctx.drawShovelHeadSolid=(...a)=>{spades++;return saved.drawShovelHeadSolid(...a)};
ctx.drawHandGunSolid=(...a)=>{guns++;return saved.drawHandGunSolid(...a)};
try{
 for(const outfit of ['PLAIN','CHEMIST','COWBOY'])for(const a of [0,.8,Math.PI])for(const p of [.05,.22,.55,.82,.99]){
  balance=heads=grips=spades=guns=0;
  probe(`player.bodyW=21;player.bodyH=27;player.aimAngle=player.moveAngle=${a};
    chemistSuitUnlocked=${outfit==='CHEMIST'};cowboySuitEquipped=${outfit==='COWBOY'};
    player.shovelMantle={elapsedMs:650*${p},durationMs:650,angle:${a},handReach:30};
    player.meleeTimer=player.reloadTimer=0;player.isArmed=false;player.show();`);
  assert.equal(heads,1,'The existing player head and outfit are painted once');
  assert.equal(grips,1,'The carried shovel keeps exactly one grip');
  assert.equal(spades,1,'The carried shovel keeps exactly one steel spade');
  assert.equal(guns,0,'Climbing does not add a firearm to the tool hands');
  assert.equal(balance,0,'The mantle restores every graphics transform');
 }
 checks+=5;
 for(const weapon of ['PISTOL','TASER','ASSAULT_RIFLE']){
  balance=heads=guns=0;
  probe(`setMeleeTool('NONE');window.swordEquipped=false;player.currentWeapon=WEAPONS.${weapon};
    player.isArmed=true;player.muzzleFlash=3;player.reloadTimer=10;rightStick.active=true;
    player.shovelMantle={elapsedMs:300,durationMs:650,angle:0,handReach:30};player.show();`);
  assert.equal(heads,1,'The same head remains visible with a holstered firearm');
  assert.equal(guns,0,'Mantle hand plants suppress firearm rendering');
  assert.equal(balance,0,'A prior reload or muzzle flash cannot leak a graphics transform');
 }
 checks+=3;
}finally{Object.assign(ctx,saved);}
console.log('Shovel mantle pose: '+checks+' checks passed across '+poses+' fitted joint poses.');

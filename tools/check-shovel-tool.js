// Exercise the actual owned-tool cycle, native melee clock and shared hand rig.
// Shovels must remain useful before combat upgrades and harmless to buildings.
const assert=require('assert');
const {ctx,probe}=require('./harness');
let checks=0;
const check=(code,label)=>{assert.ok(probe(code),label);checks++;};
probe(`isStoryMode=false;townsData={};startAtLevel(2);started=true;doTick=true;
 currentBiome=currentLevel=2;BIOME_ACTIVE=true;
 activeBuildings=[];buildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();
 enemiesList=[];corpses=[];particles=[];shockwaves=[];resourceDrops=[];
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;
 player.x=player.y=10000;player.aimAngle=0;player.mounted=false;player.hp=100;
 player.reloadTimer=0;player.dashTimer=0;player.muzzleFlash=0;
 player.throwAnimTimer=0;player.cannonCharge=0;player.cannonFireDelay=0;
 player.forceNudge=function(){};leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
 chemistSuitUnlocked=false;ninjaSuitUnlocked=false;isCooking=false;cannonInputHeld=false;
 grenadeInputHeld=false;meleeInputHeld=false;window.shovelOwned=false;
 swordPickedUp=true;window.pickaxeOwned=true;setMeleeTool('SHOVEL');`);
check(`meleeTool()==='NONE'&&!meleeToolOptions().includes('SHOVEL')`,'Unfound shovels are unavailable in the melee cycle');
probe(`window.shovelOwned=true;setMeleeTool('SHOVEL');`);
check(`meleeTool()==='SHOVEL'&&!window.swordEquipped&&meleeToolOptions().join(',')==='NONE,SWORD,PICKAXE,SHOVEL'`,'Found shovel enters the owned-tool cycle and hides the sword');
probe(`cycleMeleeTool();`);
check(`meleeTool()==='NONE'`,'The final owned tool wraps back to unarmed');
probe(`cycleMeleeTool();`);check(`meleeTool()==='SWORD'&&window.swordEquipped`,'Sword selection remains synchronized');
probe(`cycleMeleeTool();`);check(`meleeTool()==='PICKAXE'&&!window.swordEquipped`,'Pickaxe selection remains unchanged');
probe(`cycleMeleeTool();`);check(`meleeTool()==='SHOVEL'`,'Owned shovel is reached by normal cycling');
check(`HARVEST_SWING.SHOVEL===0&&HARVEST_SWING.PICKAXE===100&&HARVEST_SWING.SWORD===26&&HARVEST_SWING.NONE===7`,'Shovel adds no harvest damage and retains existing tool strengths');

probe(`meleeUnlocked=false;meleeComboUnlocked=false;window.meleeFinisherUnlocked=true;
 player.meleeTimer=player.meleeCooldown=player.meleePhase=player.meleeComboTimer=0;
 player.prevMeleeInputHeld=false;player.meleeCharge=0;player.isArmed=false;
 var shovelHostile=new Character(10042,10000,false,'NORMAL');shovelHostile.hp=1;
 var shovelCivilian=new Character(10045,10018,false,'CITY_CITIZEN_F');shovelCivilian.hp=73;
 var shovelAlly=new Character(10048,9990,false,'NORMAL');shovelAlly.isFriendly=true;shovelAlly.isNeutral=false;
 var shovelRear=new Character(9870,10000,false,'NORMAL');
 var shovelAir=new Character(10035,10000,false,'AERIAL');
 var shovelFar=new Character(10300,10000,false,'NORMAL');
 enemiesList=[shovelHostile,shovelCivilian,shovelAlly,shovelRear,shovelAir,shovelFar];
 var shovelTree={x:10055,y:10000,w:34,h:34,isTreeTrunk:true,girth:1.4,chunkKey:'99,99,shovel'};
 activeBuildings=buildings=[shovelTree];invalidateColIndex();
 var shovelTreeHP=harvestProfile(shovelTree).hp;
 var shovelCounters={kills:totalKills,score,corpses:corpses.length,hp:player.hp};
 meleeInputHeld=true;frameCount++;player.updatePlayer();`);
check(`player.meleeTimer===19&&player.meleePhase===1&&player.meleeCharge===0&&!boxingActive(player)`,
 'Native input starts a shovel swing immediately without melee or combo upgrades');
check(`shovelHostile.stunTimer===0&&shovelCivilian.stunTimer===0`,'Swing windup does not hit early');
probe(`for(let i=0;i<9;i++){frameCount++;player.updatePlayer();}`);
check(`player.meleeTimer===10&&shovelHostile.stunTimer===1500&&shovelHostile.hp===1&&!shovelHostile.dead`,
 'Contact frame gives even a one-health hostile the existing nonlethal long knockout');
check(`shovelCivilian.stunTimer===240&&shovelCivilian.hp===73&&shovelCivilian.isNeutral&&!shovelCivilian.dead`,
 'Civilians retain their ordinary harmless fall and shorter recovery');
check(`!!shovelHostile.stunPose&&!shovelHostile.stunPose.knockout&&!!shovelCivilian.stunPose&&!shovelCivilian.stunPose.knockout`,
 'Shovel KOs use restored world falls rather than saloon ragdolls');
check(`!shovelAlly.stunTimer&&!shovelRear.stunTimer&&!shovelAir.stunTimer&&!shovelFar.stunTimer`,
 'Allies, actors behind the arc, aircraft and distant opponents are untouched');
check(`enemiesList.length===6&&totalKills===shovelCounters.kills&&score===shovelCounters.score&&corpses.length===shovelCounters.corpses&&player.hp===shovelCounters.hp`,
 'The landing cannot create corpses, kill credit, score or self damage');
check(`harvestProfile(shovelTree).hp===shovelTreeHP&&buildings.includes(shovelTree)&&resourceDrops.length===0`,
 'A native shovel hit does not chip, harvest or destroy a tree in its arc');
check(`shockwaves.length===0&&!particles.some(p=>p.type==='BLOOD'||p.type==='GORE')`,
 'Shovel impact uses dry contact particles without blood or shockwaves');
probe(`for(let i=0;i<50;i++){frameCount++;player.updatePlayer();}`);
check(`player.meleeTimer===0&&player.meleeCharge===0&&shockwaves.length===0`,
 'Holding swing through an unlocked charge finisher never arms a lethal strike');
probe(`meleeInputHeld=false;frameCount++;player.updatePlayer();`);
check(`player.meleeTimer===0&&shockwaves.length===0`,'Releasing a held shovel cannot execute a finisher');
probe(`player.meleeCooldown=0;player.executeFinisher();`);
check(`player.meleePhase===1&&player.meleeTimer===20&&player.meleeCharge===0`,
 'Direct finisher requests are safely converted into ordinary tool swings');
probe(`player.meleeTimer=0;player.meleeCooldown=0;player.meleePhase=3;player.meleeComboTimer=60;player.advanceMeleeCombo();`);
check(`player.meleePhase===1&&player.meleeTimer===20&&player.meleeComboTimer===0`,
 'Stale sword combo state cannot turn the spade into a charged finisher');
probe(`player.meleeTimer=16;player.meleePhase=4;shockwaves=[];frameCount++;player.updatePlayer();`);
check(`shockwaves.length===0`,'Even a stale phase-four animation cannot emit a shovel shockwave');

// Trace real show() calls at multiple gaits and headings. The grip must paint
// below its holding palm and the same solid blade must paint above that palm.
probe(`activeBuildings=buildings=[];enemiesList=[];invalidateColIndex();
 player.meleeTimer=player.meleeCooldown=player.meleePhase=0;player.isArmed=false;
 player.aimHold=0;meleeInputHeld=false;player.shovelDigTimer=0;
 var shovelRig=figureRig(player.bodyW,player.bodyH);`);
const rig=probe('shovelRig');
const saved={};
for(const name of ['push','pop','vertex','quad','triangle','drawShovelGrip','drawShovelHeadSolid','figureCelOval','figureCelLimb'])saved[name]=ctx[name];
let events=[],balance=0,finite=true,armFit=true,paintCount=0;
ctx.push=()=>{balance++;return saved.push();};ctx.pop=()=>{balance--;return saved.pop();};
for(const name of ['vertex','quad','triangle'])ctx[name]=function(...a){if(a.some(v=>!Number.isFinite(v)))finite=false;return saved[name](...a);};
ctx.drawShovelGrip=function(...a){events.push('grip');return saved.drawShovelGrip(...a);};
ctx.drawShovelHeadSolid=function(...a){events.push('blade');paintCount++;return saved.drawShovelHeadSolid(...a);};
ctx.figureCelOval=function(g,x,y,w,h,...a){if(Math.abs(w-rig.hand)<1e-8&&Math.abs(h-rig.hand)<1e-8)events.push('palm');return saved.figureCelOval(g,x,y,w,h,...a);};
ctx.figureCelLimb=function(g,sx,sy,ex,ey,hx,hy,w0,w1,w2,...a){
 if(Math.abs(w0-rig.upperW)<1e-8&&Math.abs(w2-rig.foreW*.84)<1e-8&&
  (Math.hypot(ex-sx,ey-sy)>rig.upper+1e-7||Math.hypot(hx-ex,hy-ey)>rig.fore+1e-7))armFit=false;
 return saved.figureCelLimb(g,sx,sy,ex,ey,hx,hy,w0,w1,w2,...a);
};
let poses=0;
try {
 for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const gait of [0,.2,.5,1]) {
  for(const clock of [0,1,3,5])for(const timer of [0,20,15,10,5,1]) {
   events=[];balance=0;
   probe(`player.aimAngle=${angle};player.moveAngle=${angle};player.gait=${gait};player.isMoving=${gait>0};
    player.walkCycle=${clock};player.meleeTimer=${timer};player.meleePhase=${timer?1:0};player.show();`);
   const grip=events.indexOf('grip'),blade=events.indexOf('blade');
   assert.equal(events.filter(e=>e==='grip').length,1,'One held shaft in every native pose');
   assert.equal(events.filter(e=>e==='blade').length,1,'One spade blade in every native pose');
   assert.ok(grip>=0&&events.slice(grip+1,blade).includes('palm'),'Holding fist covers the shaft before the blade paints');
   assert.equal(balance,0,'Shovel character painters restore all transforms');poses++;
  }
 }
 probe(`rightStick.active=true;rightStick.dx=1;rightStick.dy=0;player.isArmed=true;player.meleeTimer=0;player.show();`);
 check(`!player.isArmed`, 'Aiming the dig direction keeps the shovel in hand instead of drawing a firearm');
 probe(`rightStick.active=false;player.meleeTimer=0;player.shovelDigTimer=180;player.shovelDigKind='DOWN';player.show();
  var shovelDigPose=shovelCarryPose(player,gaitPose(.2),0),shovelRestPose=swordCarryPose(player,gaitPose(.2),0);`);
 check(`shovelDigPose.hx>shovelRestPose.hx+8&&shovelDigPose.elevation<-1.3`,
  'Dig-down has its own visible reaching and downward-spade animation without a melee clock');
} finally {Object.assign(ctx,saved);}
assert.ok(finite&&armFit&&paintCount>=poses,'All projected mesh points are finite and the shared arm rig stays fitted');checks+=5;
console.log(`Shovel tool: ${checks} ownership, native impact, nonlethal, upgrade, structure and pose checks passed (${poses} live carry/swing poses).`);

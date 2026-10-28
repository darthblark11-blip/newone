// Cover dives share the native stance/figure solver while retaining their own
// original timing and collision-swept trajectory. Player tuning stays separate.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
function fresh(direction=0,type='NORMAL',cover=true){
  const angle=direction*Math.PI/4,co=Math.cos(angle),si=Math.sin(angle);
  probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=isPaused=isDead=isWin=killcamMode=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
    inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
    window.inNM0SecretOverlay=false;buildGhost=null;
    buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];
    bullets=[];particles=[];corpses=[];resetForestWildlife();invalidateColIndex();
    leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
    player=new Character(${-350*co},${-350*si},true);player.hp=player.maxHp=1000;player.shield=0;
    window.diver=new Character(0,0,false,${JSON.stringify(type)});diver.hp=diver.maxHp=1000;
    diver.isFriendly=diver.isNeutral=false;diver.currentWeapon=WEAPONS.PISTOL;diver.isArmed=true;
    diver.aimAngle=diver.moveAngle=${angle+Math.PI};diver.isMoving=false;diver.walkCycle=diver.gait=0;
    resetActorStance(diver);enemiesList=[diver];frameCount=100;deltaTime=1000/60;
    setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=false;
    window.diveCover={x:${20*co-140*si},y:${20*si+140*co},w:${direction%2?100:Math.abs(co)>.5?80:100},
      h:${direction%2?100:Math.abs(co)>.5?100:80},isLowWall:true,hp:1000};
    ${cover?'buildings=activeBuildings=[diveCover];':''}invalidateColIndex();`);
}
function advance(ms,dt=1000/60){
  probe(`for(let left=${ms};left>1e-7;){const step=Math.min(left,${dt});
    frameCount++;deltaTime=step;updateEnemyCoverDive(diver,step);left-=step;}`);
}
ok('enemy timing is the original420ms with a270unit maximum',P('ENEMY_COVER_DIVE_MS===420&&ENEMY_COVER_DIVE_DISTANCE===270'));
ok('player tuning stays at700ms and220units',P('PRONE_DIVE_MS===700&&PRONE_DIVE_DISTANCE===220'));
for(let direction=0;direction<8;direction++){
  fresh(direction);
  ok('safe covered landing exists in direction'+direction,P('beginEnemyCoverDive(diver,player)'));
  const dive=P('({...diver.stance.dive})');
  ok('direction'+direction+' commits a finite nearby trajectory',dive.distance>=60&&dive.distance<=270&&P('diver.stance.durationMs===420'));
  ok('direction'+direction+' owns the enemy pose without granting immunity',P('enemyCoverDiveActive(diver)&&proneDivePoseActive(diver)&&!proneDiveActive(diver)'));
  advance(65);
  ok('direction'+direction+' unfolds into a level belly within65ms',P('diver.stance.value===2&&actorStance(diver)===\'PRONE\''));
  const heading=P('stanceFacingAngle(diver)');
  probe('diver.aimAngle+=1;');
  ok('direction'+direction+' thumb/target changes cannot steer the planted body',Math.abs(P('stanceFacingAngle(diver)')-heading)<1e-8);
  advance(145);
  ok('direction'+direction+' native apex rises14units',Math.abs(P('proneDiveLift(diver)')-14)<1e-7);
  const hp=P('diver.hp');probe('diver.takeDamage(1,player);');
  ok('direction'+direction+' remains damageable while diving',P('diver.hp')===hp-1);
  ok('direction'+direction+' swept midpoint does not intersect cover',P('stanceProneSpotClear(diver)'));
  advance(210);
  ok('direction'+direction+' lands exactly at its selected covered point',
    Math.hypot(P('diver.x')-dive.landingX,P('diver.y')-dive.landingY)<1e-7);
  ok('direction'+direction+' releases movement ownership at420ms',P('!enemyCoverDiveActive(diver)&&diver.stance.dive.landed&&!proneDivePoseActive(diver)&&!diver.isMoving'));
  ok('direction'+direction+' lands fully on the floor and behind low cover',P("proneDiveLift(diver)===0&&stanceProneSpotClear(diver)&&!coverLineClear(player.x,player.y,diver.x,diver.y,'LEGS',player,diver)"));
  ok('direction'+direction+' emits only one bounded landing burst',P("particles.filter(p=>p.t==='PRONE_DUST').length===8"));
  advance(200);
  ok('direction'+direction+' settled updates cannot repeat the landing burst',P("particles.filter(p=>p.t==='PRONE_DUST').length===8"));
}
const endpoints=[];
for(const hz of [15,30,60,120]){
  fresh();probe('beginEnemyCoverDive(diver,player);');advance(420,1000/hz);
  endpoints.push(P('[diver.x,diver.y]'));
}
ok('all supported frame rates reach the same swept landing',endpoints.every(p=>Math.hypot(p[0]-endpoints[0][0],p[1]-endpoints[0][1])<1e-7));
fresh();probe('beginEnemyCoverDive(diver,player);diver.stanceDamage={leftMs:500,amount:20,critical:false};');advance(100);
ok('native stance feedback ages once while the dive owns combat timers',Math.abs(P('diver.stanceDamage.leftMs')-400)<1e-7);
for(const gate of ['doTick=false','isPaused=true','inTravelMenu=true','inWorldBuildingMenu=true']){
  fresh();probe('beginEnemyCoverDive(diver,player);');advance(125);
  const frozen=P('JSON.stringify({s:diver.stance,x:diver.x,y:diver.y,fire:diver.fireTimer})');
  probe(gate);advance(500);
  ok(gate+' freezes trajectory, pose and native timers',frozen===P('JSON.stringify({s:diver.stance,x:diver.x,y:diver.y,fire:diver.fireTimer})'));
}
for(const type of ['ROBOT','ARMORED','COW','HORSE','AERIAL','OCCULT_ZOMBIE','MOLOTOV','DAD','SIA']){
  fresh(0,type);ok(type+' retains its existing movement system',!P('beginEnemyCoverDive(diver,player)'));
}
for(const flag of ['isFriendly','isNeutral','isUnarmed','isNM0Scientist','mounted','dead','knockedOut']){
  fresh();probe(`diver.${flag}=true;`);ok(flag+' cannot acquire a hostile cover dive',!P('beginEnemyCoverDive(diver,player)'));
}
fresh(0,'NORMAL',false);
ok('open floor without actual cover falls back to the reaction selector',!P('beginEnemyCoverDive(diver,player)'));
fresh();probe('diveCover.x=900;invalidateColIndex();');
ok('distant cover cannot cause an overlong leap',!P('beginEnemyCoverDive(diver,player)'));
fresh();probe('buildings=activeBuildings=[{x:-80,y:0,w:5,h:1000,isWall:true,hp:1000}];invalidateColIndex();');
ok('a wall between the actor and a proposed landing cannot be tunneled through',!P('enemyCoverDivePathClear(diver,-160,0,PI)'));
fresh();probe('beginEnemyCoverDive(diver,player);');advance(100);
probe(`window.diveWall={x:60,y:95,w:300,h:4,isWall:true,hp:1000};buildings.push(diveWall);invalidateColIndex();`);
advance(320);
ok('new cover on the committed path stops the full footprint before penetration',P('stanceProneSpotClear(diver)&&diver.y<65'));
ok('a blocked dive still finishes in bounded time without teleporting to its target',P('!enemyCoverDiveActive(diver)&&Math.hypot(diver.x-diver.stance.dive.landingX,diver.y-diver.stance.dive.landingY)>10'));
fresh();probe('beginEnemyCoverDive(diver,player);');advance(100);probe('diver.isFriendly=true;updateEnemyCoverDive(diver,20);');
ok('an allegiance change safely releases dive ownership',P('!enemyCoverDiveActive(diver)&&!diver.stance.dive'));
fresh();probe('beginEnemyCoverDive(diver,player);');advance(100);probe('diver.stunTimer=20;updateEnemyCoverDive(diver,20);');
ok('an existing stun takes control without extending the dive',P('!enemyCoverDiveActive(diver)&&diver.stunTimer===20'));
fresh();probe("diver.shotReaction={action:'DIVE',remainingMs:300};beginEnemyCoverDive(diver,player);");advance(420);
ok('a completed tactical reaction rises into crouched cover instead of staying pinned prone',
  P("!enemyCoverDiveActive(diver)&&diver.stance.to===1&&diver.shotReaction.action==='CROUCH'&&diver.shotReaction.remainingMs>=1200"));
probe('for(let i=0;i<18;i++){frameCount++;updateActorStance(diver,1000/60);}');
ok('the post-dive rise settles into the existing crouch pose',P("actorStance(diver)==='CROUCH'&&diver.stance.value===1"));
console.log(`${checks}/${checks} enemy dive cover, timing, swept collision, vulnerability and ownership checks passed.`);

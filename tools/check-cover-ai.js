// Ordinary human shooters use the same physical contact, edge and pop-up solver
// as the player, with bounded decisions and no work added to dungeon hordes.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,seed=73291;
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;return a===undefined?r:Array.isArray(a)?a[Math.floor(r*a.length)]:b===undefined?r*a:a+(b-a)*r;};
const ok=(label,value)=>{assert.ok(value,label);checks++;};
function fresh(type='NORMAL'){
 probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
 inOverworldView=false;window.inNM0SecretOverlay=false;buildGhost=null;
 buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];enemiesList=[];bullets=[];particles=[];invalidateColIndex();
 setMeleeTool('NONE');leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 player=new Character(180,-80,true);player.hp=player.maxHp=10000;player.shield=10000;
 window.coverGunner=new Character(0,0,false,'${type}');coverGunner.isFriendly=coverGunner.isNeutral=false;
 coverGunner.currentWeapon=WEAPONS.PISTOL;coverGunner.ammo=17;coverGunner.aiOffset=1;
 coverGunner.aimAngle=0;coverGunner.state='CHASE';coverGunner.lastKnownX=180;coverGunner.lastKnownY=-80;
 coverGunner.cachedTargetDist=197;coverGunner.cachedTargetAngle=-.418;coverGunner.cachedCanSee=true;
 enemiesList=[coverGunner];frameCount=100;deltaTime=1000/60;viewLeft=viewTop=-2000;viewRight=viewBottom=2000;
 resetForestWildlife();`);
}
function step(n=1){probe(`for(let i=0;i<${n};i++){frameCount++;deltaTime=1000/60;coverGunner.updateEnemy();}`);}
function low(){probe('window.aiCover={x:60,y:40,w:40,h:80,isCrateProp:true};buildings=activeBuildings=[aiCover];invalidateColIndex();');}
function noDirectCover(label){
 low();probe(`coverGunner.x=23;coverGunner.y=40;
  coverGunner.cover={active:true,kind:'LOW',blend:1,pop:0,upper:{x:0,y:0}};`);
 ok(label+' cannot render a stale cover posture',!P('coverRenderActive(coverGunner)'));
 probe('updateActorCover(coverGunner,100,6,0,true);');
 ok(label+' clears stale cover through the direct contact controller',P('coverGunner.cover===null'));
 probe('frameCount++;updateActorCover(coverGunner,100,6,0,true);');
 ok(label+' cannot acquire cover when pressed against a wall',P('coverGunner.cover===null'));
}

fresh();ok('a normal firearm enemy is eligible for shared cover',P('enemyCoverEligible(coverGunner)'));
for(const weapon of ['PISTOL','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','REVOLVER','COACH_GUN']){
 fresh();low();probe(`coverGunner.currentWeapon=WEAPONS.${weapon};coverGunner.x=23;coverGunner.y=40;`);
 ok(weapon+' human gunner remains eligible for tactical cover',P('enemyCoverEligible(coverGunner)'));
 probe('updateActorCover(coverGunner,100,6,0,true);');
 ok(weapon+' human gunner can acquire native wall contact',P('coverGunner.cover?.active&&coverRenderActive(coverGunner)'));
}
for(const type of ['OCCULT_ZOMBIE','OCCULT_BLACK','OCCULT_RED','OCCULT_BLUE','BUG','HORSE','ROBOT','MOLOTOV','SNAIL_HYBRID']){
 fresh(type);ok(type+' keeps its dedicated combat/navigation path',!P('enemyCoverEligible(coverGunner)'));
 noDirectCover(type);
}
fresh();probe('coverGunner.isNeutral=true;');ok('neutral armed civilians do not acquire combat cover goals',!P('enemyCoverEligible(coverGunner)'));
noDirectCover('neutral civilian');
probe('coverGunner.isNeutral=false;coverGunner.isUnarmed=true;');ok('unarmed civilians keep their native flee behavior',!P('enemyCoverEligible(coverGunner)'));
noDirectCover('unarmed civilian');
for(const weapon of ['BOW','TASER','ROCKET_LAUNCHER','RED_LASER','PINK_LASER','ALIEN_LASER','ORANGE_BEAM']){
 fresh();probe(`coverGunner.currentWeapon=WEAPONS.${weapon}||'${weapon}';`);
 ok(weapon+' NPCs do not receive normal firearm cover decisions',!P('enemyCoverEligible(coverGunner)'));
 noDirectCover(weapon+' NPC');
}

fresh();low();probe('window.aiSearch={};window.aiGoal=enemyCoverGoal(coverGunner,player.x,player.y,aiSearch);');
ok('nearby waist cover produces a safe accessible goal',P("aiGoal&&aiGoal.kind==='LOW'&&!coverGunner.checkCol(aiGoal.x,aiGoal.y)"));
ok('the selected wall face lies between the gunner and the threat',P('(player.x-aiGoal.x)*aiGoal.nx+(player.y-aiGoal.y)*aiGoal.ny<0'));
step(120);
ok('the native enemy loop walks into actual waist-cover contact',P("coverGunner.cover&&coverGunner.cover.active&&coverGunner.cover.kind==='LOW'"));
ok('the native root remains outside the solid',P('!coverGunner.checkCol(coverGunner.x,coverGunner.y)'));
const phases=new Set();let maxRounds=0;
for(let i=0;i<160;i++){step();phases.add(P('actorStance(coverGunner)'));maxRounds=Math.max(maxRounds,P('bullets.length'));}
ok('an enemy alternates actual crouch and standing pop-up postures',phases.has('CROUCH')&&phases.has('STAND'));
ok('a valid raised enemy fires native pooled rounds from cover',maxRounds>0);
ok('cover AI leaves the manually selected stance untouched',P('coverGunner.stance.to===0&&coverGunner.stance.value===0'));
probe('coverGunner._enemyCover.seenMs=0;coverGunner.cachedCanSee=false;coverGunner.loseSightTimer=0;');
probe('frameCount++;updateEnemyCoverAI(coverGunner,player,false,200,100);');
ok('expired sight memory releases the cover decision',P('!coverGunner._enemyCover.goal&&!coverGunner.cover.active'));

fresh();probe('window.aiWall={x:60,y:0,w:40,h:140,isWall:true};buildings=activeBuildings=[aiWall];invalidateColIndex();window.aiGoal=enemyCoverGoal(coverGunner,180,-80,{});');
ok('high-cover goals sit near a physically valid edge',P("aiGoal&&aiGoal.kind==='HIGH'&&!!coverPeekCandidate({x:aiGoal.x,y:aiGoal.y,currentWeapon:coverGunner.currentWeapon},aiGoal,Math.atan2(-80-aiGoal.y,180-aiGoal.x))"));
ok('the standing cover goal keeps nine units of leg clearance',P('aiGoal.x*aiGoal.tx+aiGoal.y*aiGoal.ty>=aiGoal.edgeMin+COVER_FOOT_MARGIN&&aiGoal.x*aiGoal.tx+aiGoal.y*aiGoal.ty<=aiGoal.edgeMax-COVER_FOOT_MARGIN'));

fresh();probe('coverGunner.y=-100;window.aiWall={x:60,y:0,w:40,h:140,isWall:true};buildings=activeBuildings=[aiWall];invalidateColIndex();');
let highPeeks=0,highCover=0;
for(let i=0;i<220;i++){step();if(P("coverGunner.cover?.active&&coverGunner.cover.kind==='HIGH'"))highCover++;if(P('coverGunner.cover?.peek>0'))highPeeks++;}
ok('a gunner approaches and settles into real high-wall contact',highCover>100&&P('!coverGunner.checkCol(coverGunner.x,coverGunner.y)'));
ok('high-wall enemies lean out at a valid end and fire native rounds',highPeeks>0&&P('bullets.length>0'));

fresh();low();probe('coverGunner.isFriendly=true;coverGunner.baseState="FOLLOW";player.x=-100;player.y=-100;window.coverFoe=new Character(180,-80,false,"NORMAL");coverFoe.isFriendly=coverFoe.isNeutral=false;enemiesList=[coverGunner,coverFoe];');step(120);
ok('armed allies use the same cover contact solver',P('!!coverGunner.cover&&coverGunner.cover.active'));

fresh();low();step(100);
const state=P('JSON.stringify(coverGunner._enemyCover)'),cover=P('JSON.stringify(coverGunner.cover)');
probe('isPaused=true;updateEnemyCoverAI(coverGunner,player,true,200,100);');
ok('pause does not consume enemy cover timing or posture',P('JSON.stringify(coverGunner._enemyCover)')===state&&P('JSON.stringify(coverGunner.cover)')===cover);
probe('isPaused=false;aiCover.hp=0;invalidateColIndex();');step(15);
ok('destroyed cover cannot strand an enemy in the contact pose',P('!coverGunner.cover?.active'));

// A crowd's cover choice must not resurrect full-world scans or per-zombie work.
fresh();probe(`window.aiProbeCalls=0;var aiOriginalCheck=coverGunner.checkCol.bind(coverGunner);
 coverGunner.checkCol=(...args)=>{aiProbeCalls++;return aiOriginalCheck(...args);};
 buildings=activeBuildings=Array.from({length:80},(_,i)=>({x:40+i*25,y:65,w:20,h:30,isCrateProp:true}));
 invalidateColIndex();enemyCoverGoal(coverGunner,180,-80,{});`);
ok('a local cover search keeps its collision work bounded',P('aiProbeCalls<=270'));
fresh('OCCULT_ZOMBIE');probe('window.aiCalls=0;var aiOriginalGoal=enemyCoverGoal;enemyCoverGoal=(...args)=>{aiCalls++;return aiOriginalGoal(...args);};for(let i=0;i<200;i++)updateEnemyCoverAI(coverGunner,player,true,200,16.7);enemyCoverGoal=aiOriginalGoal;');
ok('zombie updates never run the cover search',P('aiCalls===0&&!coverGunner._enemyCover'));
console.log(`${checks}/${checks} shared enemy cover, pop-up fire, memory, ally and bounded-search checks passed.`);

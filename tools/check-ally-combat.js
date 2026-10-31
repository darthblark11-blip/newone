// Native allied target-pool, idle perception and crowded firing regressions.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
function fresh(count=40){
 probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
 inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
 window.inNM0SecretOverlay=false;buildGhost=null;townsData={};window.outpostForts={};
 setMeleeTool('NONE');resetForestWildlife();resetShovelState();
 ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=false;
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 ALLY_COMBAT.enabled=true;HOSTILE_FRONTLINE.enabled=true;isHardMode=false;
 player=new Character(-1000,0,true);player.hp=player.maxHp=1000000;player.shield=1000000;
 buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
 enemiesList=[];bullets=[];particles=[];corpses=[];invalidateColIndex();frameCount=100;deltaTime=1000/60;
 window.foe=new Character(0,0,false,'NORMAL');foe.hp=foe.maxHp=1000000;enemiesList.push(foe);
 window.gunners=[];
 for(let i=0;i<${count};i++){
  const a=new Character(100+i*3,0,false,'NORMAL');a.hp=a.maxHp=1000;
  a.isFriendly=true;a.isNeutral=false;a.isArmed=true;a.baseState='FOLLOW';a.state='IDLE';
  a.currentWeapon=WEAPONS.PISTOL;a.ammo=weaponMagazineCapacity(a);
  a.fireTimer=a.reloadTimer=a.meleeTimer=a.stunTimer=0;a.aiOffset=7;
  a.allyFoe=a.allySeeOf=foe;a.allySee=true;a.allyTick=99;
  a.aimAngle=a.moveAngle=Math.PI;resetActorStance(a);gunners.push(a);enemiesList.push(a);
 }
 window.allowed=()=>gunners.filter(a=>allyCombatFireAllowed(a,a.allyFoe));`);
}
const baseline=execFileSync('git',['show','f92e3d1:game.js'],{maxBuffer:8e6}).toString();
const candidate=fs.readFileSync(process.env.GAME_JS||__dirname+'/../game.js','utf8');
function scan(source){
 const start=source.indexOf('let best = null, bestD2 = Infinity;',source.indexOf('updateEnemy() {'));
 const end=source.indexOf('this.allyFoe = best;',start);
 assert(start>=0&&end>start);return 'function(){'+source.slice(start,end)+'return {target:best,d2:bestD2};}';
}
probe(`window.oldScan=(${scan(baseline)});window.newScan=(${scan(candidate)});`);
fresh(3);
ok('Pool retains hostile roster order and excludes friendly actors',P('allyTargetCandidates().length===1&&allyTargetCandidates()[0]===foe'));
probe('window.samePool=allyTargetCandidates();');
ok('Repeated target queries share one pool during the frame',P('allyTargetCandidates()===samePool'));
probe('window.newFoe=new Character(20,0,false);enemiesList.push(newFoe);');
ok('Roster growth invalidates the shared pool immediately',P('allyTargetCandidates().length===2&&allyTargetCandidates()[1]===newFoe'));
probe('enemiesList=[newFoe,foe,...gunners];');
ok('Roster replacement invalidates the shared pool immediately',P('allyTargetCandidates()[0]===newFoe'));
probe('foe.isFriendly=true;');
ok('Current target faction is revalidated by the actual scan',P('newScan.call(gunners[0]).target===newFoe'));

// Compare the exact published loops against mixed native depth visibility.
let seed=7331;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function actor(x,y,extra={}){return {x,y,hp:100,dead:false,isFriendly:false,eType:'NORMAL',shovelLevel:2,shovelDepth:0,...extra};}
function compareScan(observer,roster,label){
 ctx.__observer=observer;ctx.__roster=roster;
 probe('currentLevel=2;frameCount++;enemiesList=__roster;');
 const old=P('oldScan.call(__observer)'),next=P('newScan.call(__observer)');
 assert.equal(next.target,old.target,label+' actor identity');assert.equal(next.d2,old.d2,label+' distance');checks++;
}
probe('currentLevel=2;shovelExcavation={};for(let x=-4;x<=4;x++)shovelMakeCell(x,0,36,true);');
compareScan(actor(0,48,{isFriendly:true}),[actor(10,48),actor(-10,48)],'First roster index wins a tie');
compareScan(actor(0,48,{isFriendly:true}),[actor(1,48,{shovelDepth:36}),actor(10,48)],'Invisible near target cannot hide visible target');
compareScan(actor(0,48,{isFriendly:true,shovelDepth:36}),[actor(96,48,{shovelDepth:36}),actor(192,48,{shovelDepth:36})],'Connected underground');
probe('delete shovelExcavation[shovelCellKey(1,0)];');
compareScan(actor(48,48,{isFriendly:true,shovelDepth:36}),[actor(240,48,{shovelDepth:36})],'Broken underground connection');
for(let trial=0;trial<250;trial++){
 const roster=Array.from({length:trial%65},()=>actor(random()*2400-1200,random()*2400-1200,
  {isFriendly:random()<.5,dead:random()<.1,hp:random()<.1?0:100,shovelDepth:random()<.2?36:0}));
 compareScan(actor(random()*500-250,random()*500-250,{isFriendly:true,shovelDepth:trial%3===0?36:0}),roster,'Seeded roster '+trial);
}
for(const count of [0,1,16,23,24]){fresh(count);ok(count+' allies keep unrestricted firing',P('allowed().length===gunners.length&&!_allyCombat.limited'));}
fresh(25);ok('25 engaged followers activate a 16-gunner front',P('allowed().length===16&&_allyCombat.limited'));
ok('One threat keeps the nearest supporting rank',P('allowed().every((a,i)=>a===gunners[i])'));
fresh();probe(`window.secondFoe=new Character(400,0,false);secondFoe.hp=1000000;enemiesList.push(secondFoe);
 gunners[39].allyFoe=gunners[39].allySeeOf=secondFoe;`);
ok('A distinct threat retains a representative before support slots fill',P('allowed().length===16&&allowed().includes(gunners[39])'));
fresh();probe('allowed();gunners[0].fireTimer=40;frameCount++;');
ok('Weapon cooldowns retain ownership',P('allyCombatFireAllowed(gunners[0],foe)&&!allyCombatFireAllowed(gunners[16],foe)'));
for(const [name,change]of[
 ['death','gunners[0].dead=true'],['conversion','gunners[0].isFriendly=false'],['stun','gunners[0].stunTimer=30'],
 ['reload','gunners[0].reloadTimer=90'],['visibility','gunners[0].allySee=false'],['range','gunners[0].x=601'],
 ['invalid target','gunners[0].allyFoe=null']
]){
 fresh();probe('allowed();'+change+';frameCount++;');
 ok(name+' promotes the next follower',P('allyCombatFireAllowed(gunners[16],foe)&&!_allyCombat.allowed.has(gunners[0])'));
}
fresh();probe('allowed();foe.dead=true;frameCount++;');
ok('A dead foe cannot hold firing places',P('gunners.every(a=>!allyCombatEligible(a))'));
for(const [name,change]of[
 ['Hold order',"gunners[39].baseState='HOLD_PERIMETER'"],['Search order',"gunners[39].baseState='SEARCH_DIRECTION'"],
 ['player','gunners[39].isPlayer=true'],['hostile','gunners[39].isFriendly=false'],['neutral','gunners[39].isNeutral=true'],
 ['bow','gunners[39].currentWeapon=WEAPONS.BOW'],['rocket','gunners[39].currentWeapon=WEAPONS.ROCKET_LAUNCHER'],
 ['robot',"gunners[39].eType='ROBOT'"],['mounted','gunners[39].mounted=true'],['injury','gunners[39].legInjury={}']
]){
 fresh();probe(change+';');ok(name+' bypasses following-army fire limits',P('allyCombatFireAllowed(gunners[39],foe)'));
}
fresh();ok('Scripted firing without a combat target remains unrestricted',P('allyCombatFireAllowed(gunners[39],null)'));
ok('A different actual target does not reuse another threat permission',P('allyCombatFireAllowed(gunners[39],player)'));
probe('window.nativeRandom=random;window.nativeMathRandom=Math.random;random=()=>{throw Error("RNG");};Math.random=()=>{throw Error("RNG");};');
try{ok('Roster and owner decisions consume no RNG',P('allyTargetCandidates().length===1&&allowed().length===16'));}
finally{probe('random=nativeRandom;Math.random=nativeMathRandom;');}

const shotResults=[];
for(const enabled of [true,false]){
 fresh(80);probe(`ALLY_COMBAT.enabled=${enabled};window.shotStart=_huntShotSequence;
 for(const a of gunners)a.fire(Math.PI,null,foe);`);
 const r=P('({enabled:ALLY_COMBAT.enabled,shots:_huntShotSequence-shotStart,projectiles:bullets.length})');
 ok((enabled?'Enabled':'Disabled')+' 80 followers create expected real shots',r.shots===(enabled?16:80)&&r.projectiles===(enabled?16:80));shotResults.push(r);
}
fresh();probe(`window.rear=gunners[39];window.pre={ammo:rear.ammo,timer:rear.fireTimer,flash:rear.muzzleFlash,kick:rear.weaponKick,
 shots:_huntShotSequence,bullets:bullets.length,particles:particles.length};window.rejected=rear.fire(Math.PI,null,foe);`);
ok('Denied actual fire reports false',P('rejected===false'));
ok('Denied actual fire consumes no ammunition/cooldown/effects',P('pre.ammo===rear.ammo&&pre.timer===rear.fireTimer&&pre.flash===rear.muzzleFlash&&pre.kick===rear.weaponKick&&pre.shots===_huntShotSequence&&pre.bullets===bullets.length&&pre.particles===particles.length'));
probe('window.oldX=rear.x;window.oldY=rear.y;rear.updateEnemy();');
ok('Standby follower continues actual approach movement',P('rear.x!==oldX||rear.y!==oldY'));
ok('Standby follower does not shoot while moving',P('bullets.length===0&&rear.fireTimer===0'));

for(const order of ['FOLLOW','HOLD_PERIMETER','SEARCH_DIRECTION']){
 fresh(1);probe(`enemiesList=[gunners[0]];window.idle=gunners[0];idle.x=500;idle.y=0;idle.allyFoe=null;idle.allySeeOf=null;
 idle.allyTick=undefined;idle.baseState='${order}';idle.holdPos={x:0,y:0};idle.searchDir='NORTH';
 window.nativeLOS=shovelActorLOS;window.idleSight=0;shovelActorLOS=function(){idleSight++;return nativeLOS.apply(this,arguments);};
 window.oldX=idle.x;window.oldY=idle.y;idle.updateEnemy();`);
 try{
  ok(order+' idle ally performs no unused wall LOS',P('idleSight===0'));
  ok(order+' idle ally retains native command movement',P('idle.x!==oldX||idle.y!==oldY'));
  probe('enemiesList.push(foe);idle.allyTick=undefined;idle.updateEnemy();');
  ok(order+' acquires and sights a real foe on its first acquisition',P('idle.allyFoe===foe&&idle.allySeeOf===foe&&idleSight>0'));
 }finally{probe('shovelActorLOS=nativeLOS;');}
}
fresh();probe(`window.coverRear=gunners[39];coverRear.y=40;
 window.crate={x:coverRear.x+37,y:40,w:40,h:80,isCrateProp:true};buildings=activeBuildings=[crate];invalidateColIndex();
 updateActorCover(coverRear,100,6,0,true);coverRear._enemyCover={searchMs:500,cycleMs:0,seenMs:1800,target:foe,lastX:foe.x,lastY:foe.y,goal:null};`);
ok('Rear ally fixture has actual low-cover contact',P("coverRear.cover?.active&&coverRear.cover.kind==='LOW'"));
ok('Rear cover ally is outside the firing front',P('!allyCombatFireAllowed(coverRear,foe)'));
probe('window.nativeCoverLine=coverLineClear;window.coverChecks=0;coverLineClear=function(){coverChecks++;return nativeCoverLine.apply(this,arguments);};');
try{
 probe('window.handled=updateEnemyCoverAI(coverRear,foe,true,Math.hypot(coverRear.x,coverRear.y),16);');
 ok('Rear ally keeps cover pose/cycle updates',P('handled&&coverRear.cover.active&&coverRear._enemyCover.cycleMs===16'));
 ok('Rear ally skips expensive firing-ray work and shots',P('coverChecks===0&&bullets.length===0'));
}finally{probe('coverLineClear=nativeCoverLine;');}
fresh();probe('allowed();allyTargetCandidates();resetRunState();');
ok('New run clears pooled targets and firing owners',P('_allyCombat.targetFrame===-1&&_allyCombat.fireFrame===-1&&_allyCombat.targets.length===0&&_allyCombat.allowed.size===0'));
fresh();probe('allowed();gunners[0].dead=true;currentLevel=currentBiome=2;allyTargetCandidates();');
ok('Target-pool level refresh does not hide a same-frame firing-cache level change',P('allyCombatFireAllowed(gunners[16],foe)&&_allyCombat.limited&&!_allyCombat.allowed.has(gunners[0])'));
console.log(JSON.stringify({actual80AllySameFrame:shotResults}));
console.log('Allied combat: '+checks+' native targeting, idle perception, command and firing checks passed.');

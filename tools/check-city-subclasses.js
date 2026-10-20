// Seeded street populations, ambient gestures, and visible gun threats.
// Run with: node tools/check-city-subclasses.js
const assert=require('assert');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(value,label)=>{checks++;assert(value,label);};
probe(`isStoryMode=false;startAtLevel(1);started=true;doTick=true;currentLevel=2;
  buildings=[];activeBuildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();
  enemiesList=[];cityNoise=[];deltaTime=1000/60;frameCount=100;
  player.x=0;player.y=0;player.aimAngle=0;player.isArmed=false;
  leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};`);

// Legacy people retain their gender, skins, clothing distribution and harmless
// single-hit behavior; new types have separate seeded identities.
ok(P('CITY_CIVILIANS[0]==="CITY_CITIZEN_M"&&CITY_CIVILIANS[1]==="CITY_CITIZEN_F"'),'legacy type ordering changed');
const skins=new Set(),hair=new Set(),lengths=new Set(),clothes=new Set(),activities=new Set();
for(let seed=0;seed<150;seed++){
  probe(`window.a=new Character(200,0,false,"CITY_NEUTRAL_M");cityAppearance(a,${seed});`);
  skins.add(P('a.skinCol.levels.join(",")'));hair.add(P('a.hairStyle'));lengths.add(P('a.cityHairLength'));
  clothes.add(P('a.clothingStyle'));activities.add(P('a.cityActivity.kind'));
  ok(P('a.cityClass==="NEUTRAL"&&a.isNeutral&&a.isFriendly&&a.isUnarmed&&!a.isArmed'),'new neutral is armed or hostile');
}
ok(skins.size===7,'neutral skin palette coverage');ok(hair.size===7,'neutral hair styles');
ok(lengths.size===3,'neutral short/medium/long hair');ok(clothes.size===2,'neutral tee/sleeveless coverage');
ok(activities.size===3,'neutral phone, cigarette and bottle coverage');
probe('window.a=new Character(200,0,false,"CITY_THUG_M");cityAppearance(a,1234);');
ok(P('a.cityClass==="THUG"&&a.isNeutral&&a.isFriendly&&!a.isArmed'),'new thug starts hostile');
ok(P('a.skinCol.levels[0]===194&&a.shirtCol.levels[2]===151&&a.cityAccentCol.levels[0]===244'),'thug tan/purple/yellow palette');
probe('window.first=JSON.stringify([a.skinCol.levels,a.hairCol.levels,a.hairStyle,a.cityHairLength,a.cityActivity]);cityAppearance(a,1234);');
ok(P('first===JSON.stringify([a.skinCol.levels,a.hairCol.levels,a.hairStyle,a.cityHairLength,a.cityActivity])'),'appearance changed for same seed');
for(const [cx,cy] of [[0,0],[50,41],[-31,27],[231,-109]]){
  const mix=[];
  for(let slot=0;slot<6;slot++)mix.push(P(`cityCivilianType(${cx},${cy},${slot})`));
  ok(mix.filter(t=>t.startsWith('CITY_CITIZEN')).length===3,'block passive mix');
  ok(mix.filter(t=>t==='CITY_NEUTRAL_M').length===2,'block neutral mix');
  ok(mix.filter(t=>t==='CITY_THUG_M').length===1,'block thug mix');
}
ok(P('cityCivilianType(50,41,5,{hp:40})==="CITY_CITIZEN_F"'),'legacy injured resident silently became a thug');
ok(P('cityCivilianType(50,41,0,{cityClass:"NEUTRAL"})==="CITY_NEUTRAL_M"'),'neutral saved type lost');
ok(P('cityCivilianType(50,41,0,{cityClass:"THUG"})==="CITY_THUG_M"'),'thug saved type lost');

// Activities advance without touching the combat RNG and traverse an actual
// hand-out / use / hand-back sequence. Phone use alternates standing and walking.
probe('window.a=new Character(200,0,false,"CITY_NEUTRAL_M");cityAppearance(a,76);');
const random=ctx.random;ctx.random=()=>{throw new Error('ambient gesture consumed shared RNG');};
for(const kind of ['PHONE','SMOKE','BOTTLE']){
  probe(`a.cityActivity={kind:${JSON.stringify(kind)},phase:"WAIT",timeMs:0,durationMs:100,cycle:0};`);
  const phases=new Set(),paused=new Set(),amounts=[];
  for(let i=0;i<1200;i++){
    probe('updateCityActivity(a);');phases.add(P('a.cityActivity.phase'));
    const pose=P('cityActivityPose(a)');
    if(pose){amounts.push(pose.amount);if(pose.phase==='USE')paused.add(pose.paused);}
  }
  ok(phases.size===4,kind+' omitted an activity phase');
  ok(amounts.every(n=>Number.isFinite(n)&&n>=0&&n<=1),kind+' invalid activity blend');
  ok(amounts.some(n=>n>0&&n<1),kind+' has no smooth reach/putaway');
  if(kind==='PHONE')ok(paused.has(true)&&paused.has(false),'phone never alternates talking pause and walking');
}
ctx.random=random;
probe('a.cityActivity={kind:"PHONE",phase:"USE",timeMs:100,durationMs:12500,cycle:0};scareCivilian(a,0,0);');
ok(P('a.cityActivity.phase==="WAIT"&&cityActivityPose(a)===null'),'panic keeps using a phone');
ok(P('a.panicTimer===360&&a.isNeutral&&a.isFriendly&&!a.isArmed'),'panic neutrality changed');
probe('a.panicTimer=0;a.cityActivity.phase="USE";a.cityStreetFight=true;');
ok(P('cityActivityPose(a)===null'),'boxing arm and phone arm compete');
probe('a.cityStreetFight=false;a.cityThugChecking=true;');
ok(P('cityActivityPose(a)===null'),'encounter keeps using ambient props');

// The extra confidence is movement, not a shortcut around wall/fortress checks.
probe(`window.passive=new Character(60142,48142,false,"CITY_CITIZEN_M");
  window.confident=new Character(60142,48142,false,"CITY_NEUTRAL_M");
  for(const e of [passive,confident]){e.cityCx=50;e.cityCy=40;e.cityDistance=0;e.cityPause=0;
    e.panicTimer=0;e.forceNudge=()=>{};e.checkCol=()=>false;
    e.attemptMove=function(x,y){this.x+=x;this.y+=y;return{x,y};};}
  confident.cityActivity.phase="WAIT";confident.cityActivity.timeMs=0;confident.cityActivity.durationMs=9000;
  updateCityCivilian(passive);updateCityCivilian(confident);`);
ok(P('Math.abs(passive.cityDistance-1.15)<1e-9'),'passive movement changed');
ok(P('Math.abs(confident.cityDistance-1.65)<1e-9&&confident.x>passive.x'),'neutral stride is not faster');

// Threat tests use actual aim presentation, angle, distance, cover and surface
// visibility. A civilian cannot know that an aimed firearm is empty.
function threat(changes=''){
  probe(`window.a=new Character(220,0,false,"CITY_NEUTRAL_M");cityAppearance(a,2);
    player.x=0;player.y=0;player.isArmed=true;player.isUnarmed=false;player.currentWeapon=WEAPONS.PISTOL;
    player.ammo=10;player.aimAngle=0;player.aimHold=14;player.reloadTimer=0;player.meleeTimer=0;player.hp=100;player.dead=false;
    buildings=[];activeBuildings=[];invalidateColIndex();frameCount+=11;${changes}noticeCivilianAim(a);`);
  return P('a.panicTimer>0');
}
ok(threat(),'presented loaded firearm did not scare neutral');
ok(!threat('player.aimHold=0;'),'carried gun counted as aimed');
ok(threat('player.ammo=0;'),'aimed empty firearm failed to frighten a bystander');
ok(!threat('player.aimAngle=Math.PI;'),'backwards aim frightened neutral');
ok(!threat('a.y=100;'),'bystander well outside aim cone frightened');
ok(!threat('a.x=900;'),'distant aim frightened neutral');
ok(!threat('player.currentWeapon=WEAPONS.BOW;player.ammo=10;'),'bow counted as firearm threat');
ok(!threat('player.reloadTimer=30;'),'reloading gun counted as aimed');
ok(!threat('buildings=[{x:110,y:0,w:60,h:150}];invalidateColIndex();'),'gun threat saw through solid building');
ok(!threat('a.cityClass="PASSIVE";'),'new aim behavior changed legacy passive people');
probe('cityNoise=[];player.isArmed=false;window.a=new Character(220,0,false,"CITY_NEUTRAL_M");frameCount+=20;civilianNoise(0,0,620,player);noticeCivilianNoise(a);');
ok(P('a.panicTimer===360'),'neutral did not flee nearby gunfire');
console.log(`City subclasses passed: ${checks} identity, distribution, gesture, confidence and gun-threat checks.`);

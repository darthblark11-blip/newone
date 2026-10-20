// Real input routing and nonlethal street combat, not direct choice callbacks.
const assert=require('assert'),{ctx,probe}=require('./harness');
const run=s=>probe(s),P=s=>probe('('+s+')');
let checks=0,pad=null,keys=new Set();
ctx.navigator.getGamepads=()=>pad?[pad]:[];ctx.keyIsDown=k=>keys.has(k);ctx.millis=()=>10000;
ctx.setTimeout=()=>0;
const check=(s,label)=>{assert(P(s),label);checks++;};
function reset(){
  pad=null;keys.clear();ctx.touches=[];ctx.mouseIsPressed=false;
  run(`isStoryMode=false;started=doTick=true;currentLevel=currentBiome=1;BIOME_ACTIVE=true;
    isPaused=isDead=isWin=killcamMode=nm0AmbushActive=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inDarchonCall=inWorldBuildingMenu=inOverworldView=inTravelMenu=inUpgradeMenu=false;
    activeBuildings=[];buildings=[];activeParkingCars=[];barrels=[];invalidateColIndex();
    enemiesList=[];bullets=[];cityNoise=[];biomeState={};frameCount=120;deltaTime=1000/60;
    resetStreetThugEncounters();resetCityStreetInputs();worldTimeMs=DAY_MS*22/24;
    player=new Character(15000,15000,true);player.isArmed=false;player.isUnarmed=true;
    meleeUnlocked=true;chemistSuitUnlocked=false;setMeleeTool('NONE');
    rightStick={active:false,dist:0,dx:0,dy:0,base:{x:1120,y:690}};
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
    viewLeft=14000;viewRight=16000;viewTop=14000;viewBottom=16000;
    window.thug=new Character(15120,15000,false,'CITY_THUG_M');cityAppearance(thug,91);
    thug.cityCx=12;thug.cityCy=12;thug.cityPersonKey='12,12,people:5';
    restoreStreetThugRecord(thug);enemiesList=[thug];prevGamepadButtons=[];
    window.isDesktop=false;window.__frontierConsumedTouches=new Set();
    frameCount++;updateCityCivilian(thug);`);
  check('streetThugDialogueOpen()','A real resident update opens an actionable night check');
}
function gamepad(buttons=[]){
  pad={axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:buttons.includes(i)}))};
  run('handleGamepad();');
}
reset();keys.add(49);run('handleDesktop();');
check('!streetThugEncounter()&&streetThugCombatProtected(thug)&&!thug.isNeutral&&thug.isFriendly',
  'Keyboard 1 aligns the gang without turning the member into a neutral target');
reset();keys.add(50);run('handleDesktop();');
check('!streetThugEncounter()&&thug.cityThugWalkAway>0&&thug.isNeutral&&!thug.cityStreetFight',
  'Keyboard 2 sends a neutral member away');
reset();keys.add(51);run('streetThugGroup(thug).rng=12345;handleDesktop();');
check('!streetThugEncounter()&&thug.cityStreetFight&&boxingActive(player)&&boxingActive(thug)',
  'Keyboard 3 enters the real outdoor fistfight');
reset();gamepad();gamepad([0]);
check('streetThugCombatProtected(thug)&&!streetThugEncounter()','Gamepad A confirms the highlighted positive response');
reset();gamepad();gamepad([15]);gamepad([]);gamepad([0]);
check('thug.cityThugWalkAway>0&&!thug.cityStreetFight','D-pad right selects neutral and A confirms it');
reset();run('streetThugGroup(thug).rng=12345;');gamepad();gamepad([14]);gamepad([]);gamepad([0]);
check('thug.cityStreetFight&&streetThugGroup(thug).gunRolls===1','D-pad left selects negative and makes exactly one escalation roll');
for(let i=0;i<5;i++)gamepad([0]);
check('streetThugGroup(thug).gunRolls===1','Holding confirmation cannot repeat a negative decision');
reset();gamepad();gamepad([1]);
check('thug.cityThugWalkAway>0&&!streetThugCombatProtected(thug)','Gamepad B leaves the encounter neutral');

reset();run('prevGamepadButtons=Array(17).fill(false);prevGamepadButtons[0]=true;');gamepad([0]);
check('streetThugDialogueOpen()','An A button held before the conversation cannot choose automatically');
gamepad([]);gamepad([0]);check('streetThugCombatProtected(thug)','Releasing and pressing A deliberately confirms');
reset();
const button=P('streetThugDialogueButtons()[0]');
ctx.touches=[{id:321,x:button.x+button.w/2,y:button.y+button.h/2}];
run('touchStarted();handleTouches();');
check('streetThugCombatProtected(thug)&&!rightStick.active&&!meleeInputHeld&&bullets.length===0',
  'The actual positive touch button is consumed instead of firing a gun');
run('handleTouches();');
check('!rightStick.active&&window.__frontierConsumedTouches.has(321)',
  'A held response finger stays consumed on later gameplay frames');
ctx.touches=[];run('handleTouches();');
check('!window.__streetConsumedTouches.size&&!window.__frontierConsumedTouches.size','Lifting the response finger releases its input record');

// Confident civilians get six successful punches, with no damage to HP.
reset();run(`streetThugStopEncounter(0);enemiesList=[];worldTimeMs=DAY_MS/2;
  window.fighter=new Character(15040,15000,false,'CITY_NEUTRAL_M');cityAppearance(fighter,67);
  fighter.cityPersonKey='12,12,people:4';enemiesList=[fighter];
  for(let i=0;i<5;i++)registerCityStreetPunch(fighter,player);`);
check('fighter.punchHitCount===5&&fighter.stunTimer===0&&fighter.hp===100&&fighter.cityStreetFight',
  'Five successful punches leave the confident man standing and fighting');
run('registerCityStreetPunch(fighter,player);');
check('fighter.stunTimer===240&&fighter.state===\'STUNNED\'&&fighter.hp===100&&!fighter.cityStreetFight',
  'The sixth punch produces the ordinary nonlethal civilian fall');
reset();run(`streetThugStopEncounter(0);enemiesList=[];worldTimeMs=DAY_MS/2;
  window.fighter=new Character(15040,15000,false,'CITY_NEUTRAL_M');cityAppearance(fighter,67);enemiesList=[fighter];
  registerCityStreetPunch(fighter,player);civilianNoise(player.x,player.y,620,player);updateWorldBoxingOpponents();`);
check('fighter.state===\'FLEE\'&&fighter.panicTimer>0&&!fighter.cityStreetFight&&!boxingActive(fighter)',
  'Gunfire interrupts even an opponent whose movement is owned by boxing');

// Allied street residents remain local, protected and separate from recruitment.
reset();gamepad();gamepad([0]);
run(`window.oldHp=thug.hp;player.x=thug.x-40;player.y=thug.y;player.isArmed=true;
  spawnBullet(player.x,player.y,0,true,'BODY',WEAPONS.PISTOL,player);
  for(let i=0;i<8;i++){frameCount++;updateBullets();}`);
check('thug.hp===oldHp','Real player projectiles pass an allied gang member without hurting him');
check('!worldBoxingTargets().includes(thug)','An allied gang member is absent from player boxing locks');
run('thug.isFriendly=false;thug.isNeutral=true;');
run(`spawnBullet(thug.x-40,thug.y,0,true,'BODY',WEAPONS.PISTOL,player);
  for(let i=0;i<8;i++){frameCount++;updateBullets();}`);
check('thug.hp===oldHp','The alliance protects a member even while temporary combat flags change');
run('streetThugSetDisposition(thug);nm0AmbushActive=true;frameCount++;updateEntities();');
check('enemiesList.includes(thug)&&streetThugCombatProtected(thug)','An NM0 ambush retains existing allied helpers');
run('nm0AmbushActive=false;bankCityPerson(thug);window.record=getBiomeState(1).cityPeople[thug.cityPersonKey];');
check('record.cityClass===\'THUG\'&&record.eType===\'CITY_THUG_M\'&&record.citySeed===thug.citySeed&&record.streetThugRelationship===\'ALLY\'',
  'The actual resident bank stores subclass identity and alliance');
run('window.restored=new Character(thug.x,thug.y,false,record.eType);cityAppearance(restored,record.citySeed);restoreStreetThugRecord(restored,JSON.parse(JSON.stringify(record)));');
check('streetThugCombatProtected(restored)&&restored.skinCol.levels.join()===thug.skinCol.levels.join()',
  'A banked member restores the same appearance and alliance');
run(`window.savedResidentKey=thug.cityPersonKey;enemiesList=[];cityPeopleFrame=-99;
  player.x=thug.x+900;player.y=thug.y+900;
  viewLeft=player.x-200;viewRight=player.x+200;viewTop=player.y-200;viewBottom=player.y+200;
  window.residentMgr={biome:1,chunks:new Map([['12,12',{solid:[]}]])};
  for(let i=0;i<4;i++){frameCount+=21;refreshCityPeople(residentMgr,12,12);}
  window.reloadedResident=enemiesList.find(e=>e.cityPersonKey===savedResidentKey);`);
check('reloadedResident&&streetThugCombatProtected(reloadedResident)&&reloadedResident.isFriendly&&!reloadedResident.isNeutral',
  'The real off-screen streamer restores alliance before any actor AI tick');
run('currentLevel=3;sectorLedger(3).popSeeded=0;');
run('enemiesList=[reloadedResident];');
check('sectorSurvivorCount(3)===0','A local allied gang member cannot become a campaign recruit');

const savedW=ctx.width,savedH=ctx.height;
for(const [w,h] of [[320,568],[390,844],[640,360],[1460,675]]){
  ctx.width=w;ctx.height=h;
  check('streetThugDialogueButtons().every(b=>b.x>=12&&b.y>=0&&b.x+b.w<=width-12&&b.y+b.h<height)',
    `All three choices remain visible on ${w}x${h}`);
}
ctx.width=savedW;ctx.height=savedH;
console.log(`${checks}/${checks} street dialogue, boxing and residency controls passed.`);

// Native AI heading changes keep shoulders, shots and lights on one continuous
// frame of reference. Dedicated action solvers retain their existing heading.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')'),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>a===undefined?.1:Array.isArray(a)?a[0]:b===undefined?a*.1:a+(b-a)*.1;
function fresh(type='NORMAL',angle=Math.PI,distance=180){
  probe(`resetRunState();currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
    isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=farmAmbushActive=false;
    inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
    inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inCutscene=false;
    inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=inOverworldView=false;
    window.inNM0SecretOverlay=false;buildGhost=null;resetUndergroundRoute();resetShovelState();
    setMeleeTool('NONE');ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=false;
    leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
    player=new Character(${distance},0,true);player.hp=player.maxHp=1000000;player.shield=1000000;
    window.turner=new Character(0,0,false,${JSON.stringify(type)});
    turner.hp=turner.maxHp=10000;turner.shield=0;turner.isArmed=true;
    turner.isFriendly=turner.isNeutral=false;turner.currentWeapon=WEAPONS.PISTOL;
    turner.ammo=100000;turner.aiOffset=1;turner.aimAngle=turner.moveAngle=${angle};
    turner.isMoving=false;turner.gait=turner.walkCycle=0;resetActorStance(turner);
    turner.state='CHASE';turner.loseSightTimer=10000;turner.fireTimer=10000;
    buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];enemiesList=[turner];
    bullets=[];particles=[];corpses=[];invalidateColIndex();resetForestWildlife();
    frameCount=100;deltaTime=1000/60;viewLeft=viewTop=-10000;viewRight=viewBottom=10000;`);
}
function tick(n=1){probe(`for(let i=0;i<${n};i++){frameCount++;deltaTime=1000/60;turner.updateEnemy();}`);}

for(const type of ['NORMAL','ARMORED_STANDARD','FEMALE_PISTOL','MILITARY_NEUTRAL']){
  fresh(type,Math.PI,300);tick();
  const first=P('turner.aimAngle');
  ok(type+' native AI turns through an intermediate shoulder heading',Math.abs(wrap(first-Math.PI))>0&&Math.abs(wrap(first-Math.PI))<9/60);
  ok(type+' steering retains immediate commanded travel',P('Math.abs(turner.x-2.45)<1e-8&&Math.abs(turner.y)<1e-8'));
  tick(120);
  ok(type+' settles on the target instead of retaining visual aim drift',Math.abs(wrap(P('turner.aimAngle')))<1e-5);
}

fresh();probe('turner.fireTimer=0;');tick();
const shot=P('({a:turner.aimAngle,b:bullets[0],ammo:turner.ammo,m:aimLaserMuzzle(turner)})');
ok('a turning enemy fires immediately instead of waiting for its pose',shot.b&&shot.ammo===16);
ok('native enemy projectile follows its visible intermediate barrel',Math.abs(wrap(shot.b.a-shot.a))<1e-8&&Math.abs(shot.a)>3);
ok('native enemy shot starts at the same muzzle used by the laser and lighting',Math.hypot(shot.b.startX-shot.m.x,shot.b.startY-shot.m.y)<1e-8);
const turnState=P('JSON.stringify(turner._entityFacing)');
probe('finishEntityFacing(turner,1000/60);');
ok('firing and the end-of-update consumer advance the turn only once',P('JSON.stringify(turner._entityFacing)')===turnState);

fresh('NORMAL',0);probe('beginEntityFacing(turner);turner.aimAngle=PI/2;turner.fire(PI/2+.08);finishEntityFacing(turner);');
ok('enemy aiming error/spread stays relative to the animated barrel',Math.abs(wrap(P('bullets[0].a-turner.aimAngle')-.08))<1e-8);
fresh('NORMAL',.4);probe('turner.fire(.5);');
ok('an explicit fire outside an AI update keeps its explicit angle',Math.abs(P('bullets[0].a')-.5)<1e-8&&!P('turner._entityFacing'));

fresh();tick(7);const velocity=P('turner._entityFacing.velocity');
probe('frameCount++;beginEntityFacing(turner);turner.aimAngle=PI*1.5;finishEntityFacing(turner);');
ok('an opposite direction request first brakes the existing turn',velocity<0&&P('turner._entityFacing.velocity')<0&&P('turner._entityFacing.velocity')>velocity);
let bounded=true,previous=P('turner.aimAngle');
for(let i=0;i<80;i++){
  probe('frameCount++;beginEntityFacing(turner);turner.aimAngle=PI*1.5;finishEntityFacing(turner);');
  const now=P('turner.aimAngle');bounded&&=Math.abs(wrap(now-previous))<=9/60+1e-8;previous=now;
}
ok('every enemy turn remains bounded through reversal and angle wrapping',bounded&&Math.abs(wrap(previous-Math.PI*1.5))<1e-5);
probe('window.frozenTurn=JSON.stringify(turner._entityFacing);isPaused=true;frameCount++;beginEntityFacing(turner);turner.aimAngle=.4;finishEntityFacing(turner,100);');
ok('pause freezes heading and angular momentum',P('JSON.stringify(turner._entityFacing)===frozenTurn')&&Math.abs(wrap(P('turner.aimAngle')-previous))<1e-8);
probe('isPaused=false;doTick=false;frameCount++;turner.aimAngle=.1;finishEntityFacing(turner,100);');
ok('a suspended simulation retains the final rendered direction',P('JSON.stringify(turner._entityFacing)===frozenTurn')&&Math.abs(wrap(P('turner.aimAngle')-previous))<1e-8);

fresh('NORMAL',Math.PI-.03);probe('frameCount++;beginEntityFacing(turner);turner.aimAngle=-PI+.03;finishEntityFacing(turner);');
ok('the seam between positive and negative pi follows the shortest turn',Math.abs(wrap(P('turner.aimAngle')-(Math.PI-.03)))<.03);
probe('window.sameTurn=turner._entityFacing;for(let i=0;i<300;i++){frameCount++;beginEntityFacing(turner);turner.aimAngle=.5;finishEntityFacing(turner);}');
ok('settled updates reuse one bounded state record per actor',P('turner._entityFacing===sameTurn&&Object.keys(sameTurn).length===8'));
const rateSamples=[];
for(const hz of [15,30,60,120])rateSamples.push(P(`(()=>{
  const state={angle:0,velocity:0};
  for(let left=300;left>1e-7;){const ms=Math.min(left,1000/${hz});
    entityTurnHeading(state,Math.PI,ms,9,70);left-=ms;}
  return state.angle;})()`));
ok('angular acceleration covers the same distance through dropped frames',
  rateSamples.every(a=>Math.abs(a-rateSamples[0])<1e-8));

for(const type of ['ROBOT','ARMORED','BUG','SNAIL_HYBRID','HORSE','AERIAL','AERIAL_PISTOL','OCCULT_ZOMBIE','OCCULT_RED']){
  fresh(type);ok(type+' shares the living entity turn policy',P('entityFacingEligible(turner)'));
}
fresh('DAD');ok('scripted dialogue retains its dedicated heading',!P('entityFacingEligible(turner)'));
for(const state of ['turner.legInjury={};','turner.stunTimer=30;','turner.mounted=true;','turner.meleeTimer=10;','turner.shovelMantle={};']){
  fresh();probe(state);ok(state+' retains action-owned heading',!P('entityFacingEligible(turner)'));
}

fresh('NORMAL',Math.PI,300);tick();
ok('physical travel can reverse immediately while its drawn heading connects through intermediate frames',
  P('turner.moveAngle===0&&Math.abs(Math.atan2(Math.sin(entityMoveHeading(turner)-PI),Math.cos(entityMoveHeading(turner)-PI)))<9/60&&Math.abs(entityMoveHeading(turner))>3'));
const moveState=P('JSON.stringify(turner._entityFacing.move)');probe('finishEntityFacing(turner,100);');
ok('secondary travel heading also advances only once per simulation frame',P('JSON.stringify(turner._entityFacing.move)')===moveState);

fresh('AERIAL_PISTOL');probe('turner.fireTimer=0;');tick();
ok('aerial pistol native fire follows its animated body heading and own muzzle',P(`
  bullets.length===1&&Math.abs(bullets[0].a-turner.aimAngle)<1e-8&&
  Math.hypot(bullets[0].startX-(turner.x+Math.cos(turner.aimAngle)*51-Math.sin(turner.aimAngle)*16),
    bullets[0].startY-(turner.y+Math.sin(turner.aimAngle)*51+Math.cos(turner.aimAngle)*16))<1e-8&&
  Math.abs(turner.aimAngle)>3`));
fresh('ROBOT');probe('turner.burstLeft=1;turner.burstGap=0;');tick();
ok('a native robot burst follows the intermediate cannon heading and origin',P(`
  bullets.length===1&&Math.abs(bullets[0].a-turner.aimAngle)<1e-8&&Math.abs(turner.aimAngle)>3&&
  Math.hypot(bullets[0].startX-Math.cos(turner.aimAngle)*34+Math.sin(turner.aimAngle)*13,
    bullets[0].startY-Math.sin(turner.aimAngle)*34-Math.cos(turner.aimAngle)*13)<1e-8`));
fresh('SNAIL_HYBRID');probe('turner.fireTimer=0;turner.burstCooldown=0;');tick();
ok('both native hybrid beams follow its intermediate eye heading',P(`
  bullets.length===2&&bullets.every(b=>Math.abs(b.a-turner.aimAngle)<1e-8)&&Math.abs(turner.aimAngle)>3&&
  Math.hypot(bullets[0].startX-Math.cos(turner.aimAngle)*70+Math.sin(turner.aimAngle)*10,
    bullets[0].startY-Math.sin(turner.aimAngle)*70-Math.cos(turner.aimAngle)*10)<1e-8&&
  Math.hypot(bullets[1].startX-Math.cos(turner.aimAngle)*70-Math.sin(turner.aimAngle)*10,
    bullets[1].startY-Math.sin(turner.aimAngle)*70+Math.cos(turner.aimAngle)*10)<1e-8`));

function occultFresh(kind){
  fresh();probe(`currentLevel=currentBiome=9;resetOccultWorld();
    player.x=0;player.y=${kind==='BLACK'?-500:-1000};
    turner=${kind==='ZOMBIE'?"createOccultZombie(0,-1200,'transition-owner','transition-zombie','chamber')":`createOccultMagician('${kind}',0,-1200,'transition-mage','chamber')`};
    turner.aimAngle=turner.moveAngle=-PI/2;enemiesList=[turner];
    ${kind==='ZOMBIE'?'turner.occultZombie.emergeMs=0;':'turner.occult.cooldownMs=0;'}
    deltaTime=1000/60;`);
}
occultFresh('ZOMBIE');tick();
ok('the actual underground zombie AI turns its torso through a finite intermediate heading',
  P('turner.aimAngle<-1.4&&turner.y>-1200&&entityMoveHeading(turner)<-1.4&&turner.moveAngle>1.4'));
for(const kind of ['RED','BLUE','BLACK']){
  occultFresh(kind);tick();
  ok(kind+' native caster begins its turn without snapping to the raw spell bearing',P(`
    Math.abs(Math.atan2(Math.sin(turner.aimAngle+PI/2),Math.cos(turner.aimAngle+PI/2)))<11/60&&
    Math.abs(turner.aimAngle+PI/2)>0&&Math.abs(turner.occult.angle-PI/2)<1e-8`));
}
occultFresh('RED');tick();
probe(`for(let i=0;i<20;i++){frameCount++;deltaTime=1000/60;turner.updateEnemy();}
  player.y=-1600;turner.occult.chargeMs=350;
  frameCount++;deltaTime=20;turner.updateEnemy();
  window.castBearing=turner.occult.angle;window.lateTurnAngle=turner.aimAngle;
  for(let i=0;i<30&&occultProjectiles.length===0;i++){frameCount++;deltaTime=20;turner.updateEnemy();}`);
ok('the late committed cast about-face remains continuous when its target changes sides',
  P('Math.abs(Math.atan2(Math.sin(lateTurnAngle-castBearing),Math.cos(lateTurnAngle-castBearing)))>1'));
ok('the caster settles before release while retaining the original telegraph and projectile direction',P(`
  occultProjectiles.length===1&&turner.occult.phase==='RECOVER'&&
  Math.abs(Math.atan2(Math.sin(turner.aimAngle-castBearing),Math.cos(turner.aimAngle-castBearing)))<.001&&
  Math.abs(turner.occult.angle-castBearing)<1e-8&&
  Math.abs(occultProjectiles[0].angle-castBearing)<1e-8`));

// Capture the actual custom painters' leg rectangles at a deliberately large
// stride. Their old boolean stop jumped straight from this stride to zero.
function customFeet(){
  const oldRect=ctx.rect,rects=[];
  ctx.rect=(...args)=>{rects.push(args.slice(0,4));return oldRect(...args);};
  try{probe('turner.show();');}finally{ctx.rect=oldRect;}
  assert(rects.length>=4,'custom native leg rectangles were exercised');
  return rects.slice(0,4);
}
const maxFootDelta=(a,b)=>Math.max(...a.map((foot,i)=>Math.abs(foot[0]-b[i][0])));
for(const type of ['COW','ROBOT','HORSE']){
  fresh(type,0);probe(`turner.walkCycle=PI/2;turner.isMoving=true;turner.hitFlash=0;
    ${type==='HORSE'?'turner.boltTimer=100;':''}
    frameCount++;beginEntityFacing(turner);finishEntityFacing(turner);`);
  const moving=customFeet();
  probe('frameCount++;beginEntityFacing(turner);turner.isMoving=false;finishEntityFacing(turner);');
  const stopping=customFeet(),stopDelta=maxFootDelta(moving,stopping);
  ok(type+' native feet settle through an intermediate stop instead of resetting their stride',
    stopDelta>0&&stopDelta<1.25&&P('entityMotionAmount(turner)>0&&entityMotionAmount(turner)<1'));
  probe('for(let i=0;i<100;i++){frameCount++;beginEntityFacing(turner);finishEntityFacing(turner);}');
  const idle=customFeet();
  ok(type+' planted pose reaches an exact stable rest',P('entityMotionAmount(turner)===0'));
  probe('frameCount++;beginEntityFacing(turner);turner.isMoving=true;finishEntityFacing(turner);');
  const startDelta=maxFootDelta(idle,customFeet());
  ok(type+' native feet unfold through an intermediate start',startDelta>0&&startDelta<1.25);
  const state=P('JSON.stringify(turner._entityFacing)');customFeet();customFeet();
  probe('isPaused=true;frameCount++;beginEntityFacing(turner);turner.isMoving=false;finishEntityFacing(turner,100);');
  ok(type+' repeated rendering and pause leave the motion envelope untouched',P('JSON.stringify(turner._entityFacing)')===state);
}
function horseGeometry(motion){
  const names=['rect','quad','rotate','translate'],saved={},geometry=[];
  for(const name of names){saved[name]=ctx[name];ctx[name]=(...args)=>{geometry.push([name,...args]);return saved[name](...args);};}
  try{probe(`drawHorseArt(color(92,62,40),color(35,23,16),1.1,${motion},true,true,.4);`);}
  finally{for(const name of names)ctx[name]=saved[name];}
  return JSON.stringify(geometry);
}
ok('horse static/moving bool fixtures retain the same native geometry at numeric endpoints',
  horseGeometry('false')===horseGeometry('0')&&horseGeometry('true')===horseGeometry('1'));

console.log(`${checks}/${checks} enemy heading, native muzzle and transition checks passed.`);

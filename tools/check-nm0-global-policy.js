// Cross-sector acceptance for the existing shared ambush optimizations.
// Exercise native entry points and actual gunfire, not just tuning constants.
const assert = require('node:assert/strict');
const {ctx, probe} = require('./harness');
let checks=0, seed=20261102;
ctx.random=(a,b)=>{
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  const n=seed/4294967296;
  return Array.isArray(a)?a[Math.floor(n*a.length)]:a===undefined?n:b===undefined?n*a:a+n*(b-a);
};
ctx.setTimeout=()=>0;
const check=(source,label)=>{assert.ok(probe('('+source+')'),label);checks++;};
function clearFight(){
  probe(`doTick=true;nm0AmbushActive=false;nm0AmbushKills=0;window.ambushKillsTotal=0;
    window.ambushSpawnsRemaining=0;window.ambushFort=window.ambushOrigin=null;
    window.ambushKind=null;window.outpostForts={};
    enemiesList=[globalPolicyAlly];bullets=[];particles=[];resetHostileFrontline();`);
}
for(const level of [1,2,3,4,5,6,7]){
  probe(`resetStoryProgress();townsData={};window.outpostForts={};isStoryMode=true;
    startAtLevel(${level});started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
    inDarchonCall=inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=false;
    inPostAmbushCutscene=inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=false;
    inWorldBuildingMenu=inOverworldView=inTravelMenu=false;
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
    window.showOnScreenControls=false;
    window.globalPolicyAlly=new Character(player.x,player.y,false,'NORMAL');
    globalPolicyAlly.isFriendly=true;`);
  clearFight();
  probe('inTownCutscene=true;townPhase=7;draw();');
  check('enemiesList.filter(e=>e.isAmbush).length===20&&nm0AmbushKills===300&&window.ambushSpawnsRemaining===280',
    'Level '+level+' shared tower beat uses the reduced opening and full reserve');
  check('!globalPolicyAlly.isAmbush','Level '+level+' tower beat leaves allies uncounted');
  check('enemiesList.filter(e=>e.isAmbush&&(e.eType==="AERIAL"||e.eType==="AERIAL_PISTOL")).length===2',
    'Level '+level+' tower opening halves four combined air slots to two');

  for(const north of [false,true]){
    clearFight();
    probe(`triggerGateAmbush(${north?-4400:level===1?5400:3000},${north});`);
    check('enemiesList.length===21&&enemiesList.filter(e=>e.isAmbush).length===20&&nm0AmbushKills===150&&window.ambushSpawnsRemaining===130',
      'Level '+level+' '+(north?'north':'south')+' gate uses all three smaller flank groups');
    check('!globalPolicyAlly.isAmbush','Level '+level+' gate beat leaves allies uncounted');
    check('enemiesList.filter(e=>e.isAmbush&&(e.eType==="AERIAL"||e.eType==="AERIAL_PISTOL")).length===1',
      'Level '+level+' gate opening halves three combined air slots down to one');
  }

  clearFight();
  probe(`buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];invalidateColIndex();
    window.globalPolicyFort=outpostFortDef(currentBiome);
    player.x=globalPolicyFort.x;player.y=globalPolicyFort.y;
    triggerOutpostAmbush(globalPolicyFort);`);
  check('enemiesList.filter(e=>e.isAmbush).length===20&&nm0AmbushKills===150&&window.ambushSpawnsRemaining===130',
    'Level '+level+' relay uses twenty initial attackers and 130 reserves');
  check('enemiesList.filter(e=>e.isAmbush&&(e.eType==="AERIAL"||e.eType==="AERIAL_PISTOL")).length===1',
    'Level '+level+' relay opening halves three combined air slots down to one');
  for(const [i,count] of [2,2,3,2,3].entries()){
    probe(`enemiesList=[globalPolicyAlly];frameCount=${120+i*24};maintainOutpostMuster();`);
    check(`enemiesList.filter(e=>e.isAmbush).length===${count}`,
      'Level '+level+' relay refill phase '+i+' keeps the smaller batch');
  }

  clearFight();
  probe(`player.x=player.y=0;player.hp=player.maxHp=1e6;player.shield=1e6;
    inCutscene=false;HOSTILE_FRONTLINE.enabled=true;frameCount++;
    for(let i=0;i<40;i++){
      const e=new Character(100+i*3,0,false,'ARMORED_STANDARD');
      e.currentWeapon=WEAPONS.PISTOL;e.isArmed=true;e.isUnarmed=false;
      e.state='CHASE';e.cachedTargetActor=player;e.cachedCanSee=true;
      e.fireTimer=e.reloadTimer=e.stunTimer=0;e.ammo=17;enemiesList.push(e);
    }
    for(const e of enemiesList)if(e!==globalPolicyAlly)e.fire(Math.PI,null,player);`);
  check('bullets.length===8&&_hostileFrontline.limited',
    'Level '+level+' native firearm path retains the shared eight active ranged owners');
  check('hostileFrontlineFireAllowed(globalPolicyAlly,player)',
    'Level '+level+' allies keep unrestricted firing');
}

// The bespoke Grey Fatigue encounter uses the same reduced-batch policy.
probe('currentLevel=currentBiome=4;');clearFight();probe('triggerLvl4Ambush();');
check('nm0AmbushKills===150&&window.ambushSpawnsRemaining===130&&enemiesList.filter(e=>e.isAmbush).length===20',
  'Grey Fatigue opening retains twenty attackers and 130 reserves');
check('enemiesList.filter(e=>e.isAmbush).every(e=>e.eType==="NM0_GREY_FATIGUE")',
  'The bespoke encounter keeps its authored enemy type');
console.log(checks+' cross-level NM-0 policy checks passed across sectors 1–7.');

// Particle hits must leave flying enemies on their original exploding corpse
// paths, including variants which deliberately do not create a humanoid rag.
const assert = require('node:assert/strict');
const {ctx, probe, mkG} = require('./harness');
const P = source => probe('(' + source + ')');
ctx.setTimeout = () => 0;
ctx.__aerialGraphics = mkG();
const nativeRandom = ctx.random;
let choice = 0, checks = 0;
ctx.random = (a,b) => a === 3 && b === undefined ? choice + .1 : nativeRandom(a,b);

probe(`window.aerialRegressionFixture=function(type,zone,offset=0){
 resetRunState();currentLevel=currentBiome=1;BIOME_ACTIVE=false;started=doTick=true;
 isStoryMode=isPaused=isDead=isWin=killcamMode=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
 inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;window.inNM0SecretOverlay=false;
 buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];
 enemiesList=[];corpses=[];bullets=[];particles=[];invalidateColIndex();
 viewLeft=viewTop=-10000;viewRight=viewBottom=10000;MAX_KILLS=100000;totalKills=0;
 player=new Character(-2000,-2000,true);player.shield=0;
 frameCount++;particleBeamCenterCycle=2;
 window.aerialVictim=new Character(90,offset,false,type);
 aerialVictim.aimAngle=aerialVictim.moveAngle=0;aerialVictim.isMoving=false;
 aerialVictim.isFriendly=aerialVictim.isNeutral=false;aerialVictim.shield=0;
 aerialVictim.hp=aerialVictim.maxHp=70;enemiesList=[aerialVictim];
 let x=0,y=0;
 if(zone==='LEGS'){
  const geometry=humanLegHitGeometry(aerialVictim),leg=geometry.legs[0];
  x=geometry.x-80*geometry.scale;y=geometry.y+(leg.ky+leg.ay)*.5*geometry.scale;
 }
 window.aerialRound=spawnBullet(x,y,0,true,zone,WEAPONS.PARTICLE_BEAM,player);
 for(let tick=0;tick<20&&aerialRound.active;tick++){frameCount++;updateBullets();}
 window.aerialCorpse=corpses[0];
};`);

for (const type of ['AERIAL','AERIAL_PISTOL']) {
  for (const zone of ['BODY','HEAD','LEGS']) for (const variant of zone === 'HEAD' ? [0] : [0,1,2]) {
    choice = variant;
    const offsets = zone === 'BODY' ? [0,7,-7] : [0];
    for (const offset of offsets) {
      ctx.__aerialType=type;ctx.__aerialZone=zone;ctx.__aerialOffset=offset;
      assert.doesNotThrow(() => probe('aerialRegressionFixture(__aerialType,__aerialZone,__aerialOffset);'),
        `${type} ${zone} variant ${variant} must construct its native death`);
      assert(P('aerialVictim.dead&&corpses.length===1'),`${type} ${zone} should die from the native beam impact`);
      assert.equal(P('aerialCorpse.dT'),zone === 'HEAD' ? 12 : [11,5,10][variant]);
      assert.equal(P('!!aerialCorpse.particleBeamDeath'),false,'airborne death acquired ground-only beam anatomy');
      assert.equal(P('!!aerialVictim.particleBeamHit'),false,'airborne hit reserved a humanoid-only fatal descriptor');
      assert.equal(P('particleBeamCenterCycle'),2,'an aerial death consumed the human centre-hit cycle');
      assert.doesNotThrow(() => probe(`aerialCorpse.show(__aerialGraphics);
        for(let tick=0;tick<320;tick++){
          frameCount++;aerialCorpse.update();
          if(tick===11||tick===59||tick===179||tick===319)aerialCorpse.show(__aerialGraphics);
        }`), `${type} ${zone} variant ${variant} must render through its full explosion lifecycle`);
      assert(P('corpseSettled(aerialCorpse)'),'native aerial corpse did not remain eligible for retirement');
      checks++;
    }
  }
}
assert(P('particleBeamAnatomyTarget("NORMAL",22)&&particleBeamAnatomyTarget("ARMORED_STANDARD",26)'),
  'ground humanoids lost their custom beam death eligibility');
console.log(`${checks} Particle Beam aerial native death selections, side hits, render lifecycles and retirement checks passed.`);

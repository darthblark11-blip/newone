// Falling uses elapsed time and actual drop height, then resolves one native
// death at contact. Controlled excavation is not an accumulated lethal fall.
const assert=require('assert/strict');
const {ctx,probe:P}=require('./harness');
let checks=0;
const ok=(code,label)=>{assert.ok(P(code),label);checks++;};
ctx.setTimeout=()=>0;
P(`isStoryMode=false;resetStoryProgress();startAtLevel(1);started=true;doTick=true;
 isPaused=isDead=isWin=killcamMode=false;nm0AmbushActive=false;
 inCutscene=inStoryIntro=inStoryRoom=inTownCutscene=inFarmCutscene=inFarmPostCutscene=false;
 inPostAmbushCutscene=inFortCutscene=inDarchonCall=inTravelMenu=inOverworldView=false;
 inWorldBuildingMenu=inUpgradeMenu=inLvl4Cutscene=false;MAX_KILLS=10000;
 buildings=[];activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];townCitizens=[];
 bullets=[];grenades=[];corpses=[];particles=[];invalidateColIndex();
 var fallSlot=0;
 var fallFixture=()=>{shovelExcavation={};corpses=[];particles=[];enemiesList=[];townCitizens=[];fallSlot=0;
   isDead=isWin=killcamMode=false;nm0AmbushActive=false;frameCount=101;
   player=new Character(960,720,true,'NORMAL');player.hp=300;player.shield=100;
   player.dead=false;player.meleeTimer=0;playerRespawnTimer=0;setMeleeTool('SHOVEL');};
 var fallingBody=(depth,type='NORMAL',from=0)=>{const ix=5+fallSlot++;shovelMakeCell(ix,7,depth,true);
   const e=new Character((ix+.5)*SHOVEL.cell,720,false,type);e.shovelLevel=1;e.shovelDepth=from;
   e.shovelDepthTarget=depth;e._shovelCellKey=shovelCellKey(ix,7);return e;};
 var fallAdvance=(e,ms,dt=1000/60)=>{let left=ms;while(left>1e-7){const step=Math.min(dt,left);
   frameCount++;shovelUpdateActor(e,step);left-=step;}};
 var fallLand=(e,dt=1000/60)=>{let ms=0;while(shovelPlayerDepth(e)<e.shovelDepthTarget-.001&&ms<12000){
   frameCount++;shovelUpdateActor(e,dt);ms+=dt;}return ms;};
 fallFixture();var shortDrop=fallingBody(40),deepDrop=fallingBody(400);
 shovelUpdateActor(shortDrop,1000/60);shovelUpdateActor(deepDrop,1000/60);`);
ok('shovelPlayerDepth(deepDrop)>0&&shovelRenderScale(deepDrop)>.99','A deep fall begins at the rim rather than shrinking to its floor scale instantly');
ok('Math.abs(shovelPlayerDepth(shortDrop)-shovelPlayerDepth(deepDrop))<.001','Initial falling speed does not jump in proportion to the final hole depth');
P('var shallowMs=fallLand(shortDrop),deepMs=fallLand(deepDrop);');
ok('deepMs>shallowMs*2&&shallowMs>300','A taller drop visibly lasts longer than a shallow drop');
ok('shortDrop.hp>0&&!shortDrop.shovelFallFatal','A short fall remains nonlethal');

P(`fallFixture();var fine=fallingBody(400),coarse=fallingBody(400);
 fallAdvance(fine,1000,1000/120);fallAdvance(coarse,1000,1000/15);`);
ok('Math.abs(shovelPlayerDepth(fine)-shovelPlayerDepth(coarse))<.01','Fall distance is stable across high and low frame rates');
ok('shovelPlayerDepth(fine)>80&&shovelPlayerDepth(fine)<120','One second of descent reflects gravity rather than a fixed animation duration');
P('var lastDepth=shovelPlayerDepth(fine),lastScale=shovelRenderScale(fine);fallAdvance(fine,250);');
ok('shovelPlayerDepth(fine)>lastDepth&&shovelRenderScale(fine)<lastScale','Perspective scale progresses continuously with the falling body');

P('fallFixture();var safe=fallingBody(SHOVEL.lethalFall-1);fallLand(safe);');
ok('safe.hp>0&&!safe.shovelFallFatal&&corpses.length===0','A 199-unit drop remains below the ten-metre fatal threshold');
P('var fatal=fallingBody(SHOVEL.lethalFall);fallLand(fatal);');
ok('fatal.hp<=0&&fatal.shovelFallFatal&&corpses.length===1','A ten-metre drop creates one fatal impact and corpse');
ok('shovelPlayerDepth(corpses[0])===SHOVEL.lethalFall&&corpses[0].shovelDepthTarget===SHOVEL.lethalFall','The impact corpse stays on the floor where the victim landed');
P('var corpseAtImpact=corpses[0];fallAdvance(fatal,500);shovelFallImpact(fatal,SHOVEL.lethalFall);');
ok('corpses.length===1&&corpses[0]===corpseAtImpact','Further updates or a repeated contact cannot create another corpse');

P('fallFixture();var belowGroundSafe=fallingBody(500,"NORMAL",320);fallLand(belowGroundSafe);');
ok('belowGroundSafe.hp>0&&!belowGroundSafe.shovelFallFatal','Fatal distance measures the actual drop rather than absolute depth below the surface');
P('var belowGroundFatal=fallingBody(500,"NORMAL",300);fallLand(belowGroundFatal);');
ok('belowGroundFatal.hp<=0&&belowGroundFatal.shovelFallFatal','A ten-metre drop between two underground floors is still fatal');
P(`fallFixture();var extending=fallingBody(100);fallAdvance(extending,500);
 shovelCellAt(extending.x,extending.y).depth=300;fallLand(extending);`);
ok('extending.shovelFallFatal&&extending.hp<=0&&corpses.length===1','Deepening a shaft during an uninterrupted fall retains the original drop height');

P(`fallFixture();totalKills=0;var ledger=sectorLedger(1);ledger.popGranted=false;
 ledger.popSeeded=80;ledger.popKilled=0;var rosterVictim=fallingBody(220);
 rosterVictim.isPopulation=true;enemiesList=[rosterVictim];fallLand(rosterVictim);
 frameCount=103;updateEntities();`);
ok('!enemiesList.includes(rosterVictim)&&totalKills===1&&ledger.popKilled===1','Native enemy cleanup removes the fallen enemy and accounts for one roster death');
ok('corpses.length===1','Native enemy cleanup preserves the one impact corpse');
P('frameCount=104;updateEntities();');
ok('totalKills===1&&ledger.popKilled===1&&corpses.length===1','The following simulation frame cannot count the landing again');

P(`fallFixture();var cityVictim=fallingBody(220,'CITY_CITIZEN_M');
 cityVictim.cityPersonKey='FALL_IMPACT_CIVILIAN';enemiesList=[cityVictim];
 bankCityPerson(cityVictim);fallLand(cityVictim);frameCount=103;updateEntities();`);
ok('getBiomeState(1).cityPeople[cityVictim.cityPersonKey].dead&&getBiomeState(1).cityPeople[cityVictim.cityPersonKey].hp<=0','A fatal city-civilian fall persists its death instead of allowing streaming to resurrect it');

P(`fallFixture();player.x=528;player.y=720;shovelMakeCell(5,7,240,true);
 player.shovelLevel=1;player.shovelDepth=0;player.shovelDepthTarget=240;
 player._shovelCellKey=shovelCellKey(5,7);fallLand(player);`);
ok('player.hp<=0&&player.dead&&player.shovelFallFatal&&playerRespawnTimer>0','A player fatal fall uses the native death delay even with a full shield');
ok('corpses.length===1&&shovelPlayerDepth(corpses[0])===240','The player leaves a corpse at the bottom of the fall');

P(`fallFixture();shovelMakeCell(5,7,220,true);
 var resident=new Citizen(528,720,'SCIENCE','FEMALE');townCitizens=[resident];
 shovelUpdateActor(resident,0);fallLand(resident);`);
ok('resident.dead&&resident.shovelFallFatal&&corpses.length===1','A falling civilian also receives a fatal impact and corpse');
ok('corpses[0].bW===resident.bodyW&&corpses[0].bH===resident.bodyH','The civilian corpse keeps its original body proportions');

P(`fallFixture();player.x=528;player.y=720;var strokes=0;
 for(let n=0;n<16;n++){if(shovelDig('DOWN'))strokes++;fallAdvance(player,700);}`);
ok('strokes===16&&shovelPlayerDepth(player)>SHOVEL.lethalFall&&player.hp>0&&!player.shovelFallFatal','Sixteen deliberate shovel strokes safely reach beyond ten metres without becoming one accumulated fall');

P(`fallFixture();var interrupted=fallingBody(400);fallAdvance(interrupted,500);
 var bodyDepth=shovelPlayerDepth(interrupted),bodyVelocity=interrupted._shovelFall.velocity;
 var fallingCorpse=new Corpse(interrupted.x,interrupted.y,interrupted.moveAngle,interrupted.aimAngle,
 interrupted.shirtCol,interrupted.pantsCol,0,0,interrupted.decals,interrupted.currentWeapon,0,
 interrupted.eType,interrupted.bodyW,interrupted.bodyH,interrupted);`);
ok('shovelPlayerDepth(fallingCorpse)===bodyDepth&&fallingCorpse.shovelDepthTarget===400','A midair death preserves its current height and remaining descent');
ok('fallingCorpse._shovelFall&&fallingCorpse._shovelFall!==interrupted._shovelFall&&fallingCorpse._shovelFall.velocity===bodyVelocity','The corpse receives an independent copy of the in-flight velocity');
P('fallAdvance(fallingCorpse,250);');
ok('shovelPlayerDepth(fallingCorpse)>bodyDepth&&shovelPlayerDepth(fallingCorpse)<400','A corpse continues falling instead of snapping to the floor');

P(`fallFixture();player.x=528;player.y=720;shovelMakeCell(5,7,400,true);
 player.shovelLevel=1;player.shovelDepth=0;player.shovelDepthTarget=400;
 player._shovelCellKey=shovelCellKey(5,7);fallAdvance(player,1000);
 var saved=JSON.parse(JSON.stringify(serializeShovelState()));
 var savedDepth=shovelPlayerDepth(player),savedVelocity=player._shovelFall.velocity;
 player=new Character(528,720,true,'NORMAL');restoreShovelState(saved);restoreShovelPlayer(saved);`);
ok('saved.player.fall&&shovelPlayerDepth(player)===savedDepth&&player._shovelFall.velocity===savedVelocity','Saving and restoring midway retains fall height and velocity');
P('fallLand(player);');
ok('player.shovelFallFatal&&player.hp<=0&&corpses.length===1','Restoring midway does not erase the continuous drop needed for fatal impact');

P(`fallFixture();player.x=528;player.y=720;shovelMakeCell(5,7,400,true);
 player.shovelLevel=1;player.shovelDepth=player.shovelDepthTarget=400;
 player._shovelCellKey=shovelCellKey(5,7);var settledSave=JSON.parse(JSON.stringify(serializeShovelState()));
 player=new Character(528,720,true,'NORMAL');restoreShovelState(settledSave);restoreShovelPlayer(settledSave);
 fallAdvance(player,1000);`);
ok('player.hp>0&&!player.shovelFallFatal&&shovelPlayerDepth(player)===400','A saved actor already settled underground does not replay a historical fatal fall');

P(`fallFixture();townsData={};var workerLedger=poolLedger();workerLedger.popScienceF=1;
 workerLedger.popTotal=sectorPopSum(workerLedger);var otherWorkerLedger=sectorLedger(2);
 otherWorkerLedger.popScienceF=2;otherWorkerLedger.popTotal=sectorPopSum(otherWorkerLedger);
 var nativeWorkerPoint=getOwnedFortressSpawnPoint;
 getOwnedFortressSpawnPoint=()=>({x:528,y:720,fortress:null});
 deployDirectivePopulation();var worker=townCitizens[0];`);
ok('townCitizens.length===1&&worker.directiveHome===POP_POOL&&worker.directiveDept==="Science"&&worker.gender==="FEMALE"','A deployed worker keeps the department, source ledger and sex needed for casualty accounting');
P('shovelMakeCell(5,7,220,true);shovelUpdateActor(worker,0);fallLand(worker);');
ok('worker.dead&&workerLedger.popScienceF===0&&workerLedger.popTotal===0&&otherWorkerLedger.popScienceF===2','A fatal worker fall debits only its own female department slot');
P('var workersAfterFall=globalPopulation;directiveCitizenCasualty(worker);shovelFallImpact(worker,220);');
ok('globalPopulation===workersAfterFall&&workerLedger.popScienceF===0','Repeated casualty or impact processing cannot deduct a second worker');
P(`townsData=JSON.parse(JSON.stringify(townsData));deployDirectivePopulation();
 getOwnedFortressSpawnPoint=nativeWorkerPoint;`);
ok('townCitizens.length===0&&sectorLedger(POP_POOL).popScienceF===0&&sectorLedger(2).popScienceF===2','Reloading the strategic ledgers and rebuilding the resident roster does not resurrect the dead worker');

console.log('Shovel fall impacts: '+checks+' height, timing, death, corpse and persistence checks passed.');

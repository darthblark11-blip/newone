// Native grounded actors share the player's shaft depth; the surface crowd,
// aircraft and roofed tunnels keep their own physical layer.
const assert=require('assert/strict');
const {probe:P}=require('./harness');let checks=0;
function ok(code,label){assert.ok(P(code),label);checks++;}
P(`isStoryMode=false;resetStoryProgress();startAtLevel(1);started=true;doTick=true;
 isPaused=isDead=isWin=killcamMode=false;inTownCutscene=inPostAmbushCutscene=inDarchonCall=false;
 inStoryIntro=inStoryRoom=inFarmCutscene=inFarmPostCutscene=inFortCutscene=false;
 buildings=[];activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];townCitizens=[];buildColIndex();
 setMeleeTool('SHOVEL');player.x=528;player.y=720;player.meleeTimer=0;
 player.shovelLevel=1;player.shovelDepth=0;player.shovelDepthTarget=0;player._shovelCellKey=null;
 var fallTick=(e,n)=>{for(let i=0;i<n;i++){frameCount++;shovelUpdateActor(e,1000/60);}};
 shovelDig('DOWN');shovelUpdatePlayer(player,500);shovelDig('DOWN');shovelUpdatePlayer(player,500);
 player.x=1500;player.y=720;shovelUpdatePlayer(player,500);`);
ok('shovelCellAt(528,720).open&&shovelCellAt(528,720).depth===36','The fall fixture is an actual player-dug open shaft');
P('var fallingEnemy=new Character(528,720,false,"NORMAL");enemiesList=[fallingEnemy];frameCount++;fallingEnemy.updateEnemy();');
ok('shovelPlayerDepth(fallingEnemy)>0&&shovelPlayerDepth(fallingEnemy)<36','Native enemy simulation begins a smooth descent into an open shaft');
ok('fallingEnemy.shovelDepthTarget===36&&fallingEnemy.checkCol(534,720)','A falling enemy cannot skate over the mouth before reaching the floor');
P('var enemyDepth=shovelPlayerDepth(fallingEnemy);fallTick(fallingEnemy,5);');
ok('shovelPlayerDepth(fallingEnemy)>enemyDepth&&shovelPlayerDepth(fallingEnemy)<36','Descent progresses over multiple frames rather than changing scale instantly');
P('fallTick(fallingEnemy,45);');
ok('shovelPlayerDepth(fallingEnemy)===36&&shovelRenderScale(fallingEnemy)<.7','The enemy reaches the shaft floor with the same depth scale as the player');
ok('fallingEnemy.checkCol(528,816)','The buried enemy cannot wander through unexcavated soil');
P('var fallingCitizen=new Citizen(528,720,"SCIENCE");townCitizens=[fallingCitizen];frameCount++;fallingCitizen.update();');
ok('shovelPlayerDepth(fallingCitizen)>0&&fallingCitizen.shovelDepthTarget===36','The separate Citizen simulation also begins falling');
P('fallTick(fallingCitizen,50);');
ok('shovelPlayerDepth(fallingCitizen)===36&&shovelRenderScale(fallingCitizen)===shovelRenderScale(fallingEnemy)','Civilian and hostile bodies use matching shaft depth and size');
ok('fallingCitizen.citizenBlocked(528,816)','A buried civilian is constrained by the excavated space');
P(`var roofedEnemy=new Character(624,720,false,'NORMAL');shovelMakeCell(6,7,36,false,18);fallTick(roofedEnemy,40);`);
ok('shovelPlayerDepth(roofedEnemy)===0&&roofedEnemy.shovelDepthTarget===0','Standing above an intact tunnel roof never causes a fall');
P(`var rimCitizen=new Citizen(483,720,'SCIENCE');fallTick(rimCitizen,10);`);
ok('shovelPlayerDepth(rimCitizen)===0','Walking on grass outside the narrower drawn mouth remains at surface height');
P('rimCitizen.x=510;fallTick(rimCitizen,1);');
ok('shovelPlayerDepth(rimCitizen)>0','Crossing the drawn mouth within one logical square triggers the fall');
for(const type of ['AERIAL','AERIAL_PISTOL','SAUCER','SAUCER_RED']){
 P(`var flyer=new Character(528,720,false,${JSON.stringify(type)});fallTick(flyer,40);`);
 ok('shovelPlayerDepth(flyer)===0&&flyer.shovelDepthTarget===0',type+' remains airborne above the open shaft');
}
P('shovelCellAt(528,720).depth=1800;fallTick(fallingEnemy,65);fallTick(fallingCitizen,65);');
ok('shovelPlayerDepth(fallingEnemy)>36&&shovelPlayerDepth(fallingEnemy)<1800&&shovelPlayerDepth(fallingCitizen)<1800','A very deep drop remains in flight after one second instead of snapping to its floor');
ok('fallingEnemy.hp>0&&!fallingCitizen.dead','Fall damage waits for floor impact');
P('fallTick(fallingEnemy,300);fallTick(fallingCitizen,300);');
ok('shovelPlayerDepth(fallingEnemy)===1800&&shovelPlayerDepth(fallingCitizen)===1800','Gravity eventually carries both actors to the deep floor');
ok('fallingEnemy.hp===0&&fallingCitizen.dead&&corpses.length===2','Long drops create one fatal floor impact and corpse for each actor');
ok('shovelRenderScale(fallingEnemy)===SHOVEL.minScale&&shovelRenderScale(fallingCitizen)===SHOVEL.minScale','Both actors reach the bounded pin-sized deep projection');
// Independently settled survivors exercise visibility and movement below the
// surface without turning a lethal-drop corpse into a living test subject.
P(`fallingEnemy=new Character(528,720,false,'NORMAL');fallingCitizen=new Citizen(528,720,'SCIENCE');
 for(const e of [fallingEnemy,fallingCitizen]){e.shovelLevel=1;e.shovelDepth=e.shovelDepthTarget=1800;e._shovelCellKey=shovelCellKey(5,7);}`);
P('var hpEnemy=fallingEnemy.hp;fallingEnemy.takeDamage(100,player);');
ok('fallingEnemy.hp===hpEnemy','A surface attacker cannot hurt an enemy below the ground');
P('var bulletCount=bullets.length;fallingEnemy.fire(0);');
ok('bullets.length===bulletCount','A buried enemy cannot emit a gunshot into the surface layer');
P('var bx=fallingCitizen.x,by=fallingCitizen.y;player.x=bx+1;player.y=by;fallingCitizen.resolveCollisions();');
ok('fallingCitizen.x===bx&&fallingCitizen.y===by','Surface body separation cannot push a buried civilian into solid soil');
P('fallingEnemy.x=2000;fallingEnemy.y=2000;fallTick(fallingEnemy,1);');
ok('shovelPlayerDepth(fallingEnemy)===0&&fallingEnemy.shovelDepthTarget===0','A story teleport onto solid ground releases stale depth');
P(`shovelCellAt(528,720).depth=36;player.x=528;player.y=720;player.shovelDepth=0;
 player.shovelDepthTarget=0;player.shovelClimbing=true;player._shovelCellKey=shovelCellKey(5,7);
 fallTick(player,10);`);
ok('shovelPlayerDepth(player)===0','Finishing a climb does not immediately drop the player back down');
P('player.x=816;shovelSyncPlayerCell(player);player.x=528;shovelSyncPlayerCell(player);fallTick(player,1);');
ok('shovelPlayerDepth(player)>0','Leaving the shaft clears the climb guard so entering another hole falls normally');
P('currentLevel=8;shovelUpdateActor(fallingCitizen,16);');
ok('shovelPlayerDepth(fallingCitizen)===0&&fallingCitizen.shovelDepthTarget===0','Interior travel resets the civilian depth state');
console.log('Shovel falling: '+checks+' native grounded actor, mouth, layer and recovery checks passed.');

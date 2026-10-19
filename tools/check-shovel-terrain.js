// Exercise the excavation through the actual map, Character collision and
// movement, including traversing an intact Great Gate below its wall.
const assert=require('assert');
const{probe}=require('./harness');let checks=0;
function check(code,message){assert.ok(probe(code),message);checks++;}
function run(code){return probe(code);}
run(`isStoryMode=false;resetStoryProgress();startAtLevel(1);started=true;doTick=true;
 isPaused=false;isDead=false;isWin=false;barrels=[];activeParkingCars=[];
 activeBuildings=buildings.slice();buildColIndex();window.shovelOwned=true;setMeleeTool('SHOVEL');
 player.x=528;player.y=720;player.shovelLevel=1;player.shovelDepth=0;player.shovelDepthTarget=0;
 player.dashTimer=0;player.isDashing=false;player.ignoreBldgTimer=0;
 var shovelSettle=()=>shovelUpdatePlayer(player,500);
 var shovelWalk=(dx,dy)=>{let n=Math.ceil(Math.hypot(dx,dy)/6),x=player.x,y=player.y;
   for(let i=0;i<n;i++)player.attemptMove(dx/n,dy/n);
   return Math.hypot(player.x-x-dx,player.y-y-dy)<.01;};`);
// Visit the real streamed world before asserting these lawns. Authored-only
// fixtures miss the east-verge buildings that become resident on arrival.
run(`var shovelStreamChecks=[];
 for(const patch of SHOVEL_GRASS_PATCHES){
  player.x=patch.x+patch.w/2;player.y=patch.y+patch.h/2;
  chunkMgr.lastKey=null;chunkMgr.update(player.x,player.y);
  activeBuildings=buildings.slice();activeParkingCars=parkingCars.slice();buildColIndex();
  for(let y=patch.y+48;y<patch.y+patch.h;y+=96)for(let x=patch.x+48;x<patch.x+patch.w;x+=96){
   shovelExcavation={};player.x=x;player.y=y;player.shovelDepth=0;player.shovelDepthTarget=0;
   player.shovelLevel=1;player.shovelCooldownMs=0;player._shovelCellKey=null;
   shovelStreamChecks.push({patch:patch.id,x,y,clear:!player.checkCol(x,y),
    soft:shovelSurfaceCellSoft(Math.floor(x/96),Math.floor(y/96)),dug:shovelDig('DOWN')});
  }
 }
 shovelExcavation={};player.x=528;player.y=720;player.shovelDepth=0;player.shovelDepthTarget=0;
 player.shovelLevel=1;player.shovelCooldownMs=0;player._shovelCellKey=null;
 chunkMgr.lastKey=null;chunkMgr.update(player.x,player.y);activeBuildings=buildings.slice();
 activeParkingCars=[];buildColIndex();`);
for(const result of run(`shovelStreamChecks`)){
 assert.ok(result.clear&&result.soft&&result.dug,result.patch+' '+result.x+','+result.y+' remains diggable after native chunk residency');checks++;
}
run(`var originalShovelFilter=filterShovelGrassContent;
 var withShovelFilter=generateChunkContent(1,4,3);
 filterShovelGrassContent=(biome,content)=>content;
 var withoutShovelFilter=generateChunkContent(1,4,3),distantUnfiltered=generateChunkContent(1,7,7);
 filterShovelGrassContent=originalShovelFilter;
 var distantFiltered=generateChunkContent(1,7,7);`);
check(`withShovelFilter.solid.length<withoutShovelFilter.solid.length`, 'The actual verge chunk loses the streamed foundation that previously buried its lawn');
check(`withShovelFilter.solid.every(b=>withoutShovelFilter.solid.some(old=>old.chunkKey===b.chunkKey&&JSON.stringify(old)===JSON.stringify(b)))`,
 'Surviving nearby structures retain their exact legacy destruction keys');
check(`JSON.stringify(distantFiltered)===JSON.stringify(distantUnfiltered)`, 'Distant city generation remains byte-identical');
run(`var syntheticShovelContent={solid:[{x:5136,y:4560,w:10,h:10},{x:9000,y:9000,w:10,h:10}],
 cars:[{x:5136,y:4560}],decor:[{x:5136,y:4560,s:1}],decorBake:[{x:5136,y:4560,s:1}]};
 filterShovelGrassContent(1,syntheticShovelContent);`);
check(`syntheticShovelContent.solid.length===1&&syntheticShovelContent.solid[0].x===9000&&
 syntheticShovelContent.cars.length===0&&syntheticShovelContent.decor.length===0&&syntheticShovelContent.decorBake.length===0`,
 'All four streamed geometry and decoration lists reserve the lawn footprint');
run(`var otherBiomeShovelContent={solid:[{x:5136,y:4560,w:10,h:10}],cars:[],decor:[],decorBake:[]};
 filterShovelGrassContent(2,otherBiomeShovelContent);`);
check(`otherBiomeShovelContent.solid.length===1`, 'The authored lawn reservation never changes another biome');
check(`SHOVEL_GRASS_PATCHES.every(p=>{
 for(let y=p.y+48;y<p.y+p.h;y+=96)for(let x=p.x+48;x<p.x+p.w;x+=96)
  if(!shovelSurfaceCellSoft(Math.floor(x/96),Math.floor(y/96)))return false;return true;})`,
 'Every authored grass-square garden and gate verge is clear on the real city map');
check(`shovelSurfaceSoftAt(528,720)&&shovelSurfaceSoftAt(0,0)&&shovelSurfaceSoftAt(1200,720)`,
 'Grass, street asphalt and sidewalks all permit excavation without marked routes');
check(`!shovelSurfaceSoftAt(600,600)&&shovelSurfaceSoftAt(5136,5400)&&!!shovelSurfaceWallAt(5136,5400)`,
 'House foundations block digging while the intact Great Gate permits tunneling beneath its wall');
run(`var savedTerrainBuildings=buildings;buildings=[{x:528,y:720,w:96,h:96,isParkingLot:true,isGrassLot:true}];`);
check(`shovelSurfaceSoftAt(528,720)&&shovelSurfaceCellSoft(5,7)`, 'Car parks do not become building foundations through their legacy grass flag');
run(`buildings=[{x:528,y:720,w:96,h:96,isPond:true,isGrassLot:true,isWater:true}];`);
check(`shovelSurfaceSoftAt(528,720)&&shovelSurfaceCellSoft(5,7)`, 'Water surfaces do not add an excavation restriction beyond buildings');
run(`buildings=[{x:517,y:709,w:4,h:4}];`);
check(`!shovelSurfaceCellSoft(5,7)`, 'A foundation entirely between samples also prevents digging');
run(`buildings=savedTerrainBuildings;`);
run(`window.shovelOwned=false;`);check(`!shovelDig('DOWN')&&Object.keys(shovelExcavation).length===0`, 'An unowned shovel cannot excavate');
run(`window.shovelOwned=true;setMeleeTool('NONE');`);check(`!shovelDig('DOWN')`, 'Digging requires the shovel to be selected');
run(`setMeleeTool('SHOVEL');isPaused=true;`);check(`!shovelDig('DOWN')`, 'Pause rejects native dig calls');
run(`isPaused=false;doTick=false;`);check(`!shovelDig('DOWN')`, 'A frozen simulation cannot excavate');
run(`doTick=true;killcamMode=true;`);check(`!shovelDig('DOWN')`, 'Kill cameras reject excavation');
run(`killcamMode=false;inTownCutscene=true;`);check(`!shovelDig('DOWN')`, 'Story cutscenes retain their normal action lock');
run(`inTownCutscene=false;player.x=0;player.y=0;`);
check(`shovelDig('DOWN')&&shovelCellAt(0,0).depth===18`, 'An unmarked paved street can start its own shaft');
run(`shovelExcavation={};player.x=528;player.y=720;player.shovelDepth=0;player.shovelDepthTarget=0;player.shovelCooldownMs=0;player._shovelCellKey=null;`);
check(`shovelDig('DOWN')&&shovelCellAt(528,720).depth===18&&player.shovelDepthTarget===18&&shovelPlayerDepth()===0`,
 'First dig opens one waist-deep square and begins a smooth fall');
check(`!shovelDig('DOWN')`, 'Held dig input respects an action cooldown');
run(`shovelUpdatePlayer(player,40);`);check(`shovelPlayerDepth()>0&&shovelPlayerDepth()<18`, 'The fall visibly interpolates depth');
check(`player.shovelDigTimer>0&&player.shovelDigKind==='DOWN'`, 'Digging has its own animation pose without a melee impact');
run(`shovelSettle();`);check(`shovelPlayerDepth()===18&&shovelRenderScale(player)<1&&shovelRenderScale(player)>.6`, 'Waist depth reduces player size');
check(`shovelDig('DOWN')`, 'A second dig deepens the player square');run(`shovelSettle();`);
check(`shovelPlayerDepth()===36&&shovelCellAt(528,720).depth===36&&shovelCellAt(528,720).open`, 'Second dig reaches fully underground with an entry shaft');
check(`player.checkCol(528,820)`, 'Undug soil blocks underground movement');
run(`var beforeNudge={x:player.x,y:player.y};player.forceNudge();`);
check(`player.x===beforeNudge.x&&player.y===beforeNudge.y`, 'Force-nudge cannot teleport a digger through soil');
run(`player.aimAngle=0;`);check(`shovelDig('FORWARD')`, 'Underground forward dig opens the next connected square');run(`shovelSettle();`);
check(`shovelCellAt(624,720).depth===36&&!shovelCellAt(624,720).open&&shovelCellAt(624,720).ceiling===18`,
 'A tunnel retains an overhead earth ceiling');
check(`!shovelDig('FORWARD')&&shovelCellAt(624,720).depth===36`, 'Repeated outside digs cannot deepen an unreachable forward square');
check(`shovelWalk(96,0)`, 'Native movement crosses the excavated connection');run(`shovelSettle();`);
check(`player.x===624&&shovelPlayerDepth()===36`, 'Movement reaches the actual adjacent tunnel floor');
check(`player.checkCol(624,790)&&player.checkCol(624,650)`, 'The full player footprint cannot pass through an undug side wall');
run(`shovelMakeCell(8,7,36,false,18);`);
check(`player.checkCol(816,720)`, 'A disconnected dug square does not allow crossing the unexcavated gap');
check(`shovelDig('UP')`, 'Up opens a roof on clear ground');run(`shovelSettle();`);
check(`shovelPlayerDepth()===18&&shovelCellAt(624,720).open&&shovelCellAt(624,720).ceiling===0`, 'Grass overhead becomes a safe climbable exit shaft');
check(`shovelDig('UP')`, 'Another up action climbs to the surface');run(`shovelSettle();`);
check(`shovelPlayerDepth()===0&&shovelCellAt(624,720).depth===36`, 'Climbing never fills or loses the original excavation');
run(`shovelExcavation={};player.x=528;player.y=720;player._shovelCellKey=null;player.aimAngle=0;player.shovelCooldownMs=0;`);
check(`shovelDig('FORWARD')&&shovelCellAt(624,720).depth===18&&!shovelCellAt(528,720)`, 'Surface forward dig opens only the square ahead');run(`shovelSettle();`);
check(`!shovelDig('FORWARD')&&shovelCellAt(624,720).depth===18`, 'Surface forward digging stops at waist depth until entry');
check(`shovelWalk(96,0)`, 'The player walks into the forward-dug hole');run(`shovelSettle();`);
check(`shovelPlayerDepth()===18`, 'Entering the new hole actually lowers the player');
check(`shovelDig('DOWN')`, 'Digging can continue after entering the forward square');run(`shovelSettle();`);
// Huge depth is one bounded column, not thousands of extra render/collision cells.
run(`var deepDigs=0;while(shovelPlayerDepth()<SHOVEL.maxDepth&&deepDigs<300){if(shovelDig('DOWN'))deepDigs++;shovelSettle();}`);
check(`shovelPlayerDepth()===SHOVEL.maxDepth&&deepDigs<300`, 'Depth reaches a very deep stable bedrock bound');
check(`Object.keys(shovelExcavation).length===1&&Number.isFinite(shovelRenderScale())&&shovelRenderScale()===SHOVEL.minScale`,
 'Extreme depth stays pin-sized and costs only one column');
check(`!shovelDig('DOWN')&&shovelCellAt(player.x,player.y).depth===SHOVEL.maxDepth`, 'Bedrock cannot overflow depth');
check(`shovelDig('UP')`, 'Even the deepest shaft supports recovery');run(`shovelSettle();`);
check(`shovelPlayerDepth()<SHOVEL.maxDepth&&player.shovelClimbing`, 'Deep ascent changes depth without teleporting sideways');
// Physically dig and walk the whole intact south gate, including its approach.
run(`shovelExcavation={};player.x=5136;player.y=4560;player.aimAngle=Math.PI/2;
 player.shovelLevel=1;player.shovelDepth=0;player.shovelDepthTarget=0;player._shovelCellKey=null;player.shovelCooldownMs=0;
 var untouchedGate=buildings.find(b=>b.isGovFortress&&b.y>0),gateHpBefore=untouchedGate.hp;
 var surfaceGateBlocked=player.checkCol(5136,5400);shovelDig('DOWN');shovelSettle();shovelDig('DOWN');shovelSettle();
 var dugGateWalk=true;
 for(let n=0;n<14;n++){if(!shovelDig('FORWARD')){dugGateWalk=false;break;}shovelSettle();if(!shovelWalk(0,96)){dugGateWalk=false;break;}shovelSettle();}`);
check(`surfaceGateBlocked`, 'The original Great Gate is solid at ground level');
check(`dugGateWalk&&player.y===5904&&shovelPlayerDepth()===36`, 'The actual player digs and walks below the entire 800-unit Great Gate');
check(`untouchedGate.hp===gateHpBefore&&untouchedGate.hp>0&&!window.southGateBreachedStatus`, 'The passive tunnel never damages or breaches the gate');
check(`shovelSurfaceCellSoft(Math.floor(player.x/96),Math.floor(player.y/96))&&shovelDig('UP')`,
 'The far-side south lawn permits an underground exit after traversing the gate');run(`shovelSettle();`);
check(`shovelDig('UP')`, 'The outside shaft can be climbed to ground level');run(`shovelSettle();`);
check(`shovelPlayerDepth()===0&&player.y===5904`, 'The player emerges outside the south gate at the excavated exit');
run(`shovelDig('DOWN');shovelSettle();shovelDig('DOWN');shovelSettle();player.aimAngle=-Math.PI/2;`);
check(`shovelWalk(0,-14*96)`, 'The complete tunnel remains connected and can be walked back');run(`shovelSettle();`);
check(`shovelDig('UP')`, 'The original grass shaft remains recoverable after the gate crossing');run(`shovelSettle();shovelDig('UP');shovelSettle();`);
check(`shovelPlayerDepth()===0&&player.y===4560`, 'Recovery returns to the same original entry position');
// A tunnel may pass below a wall, but cannot surface inside that solid wall.
run(`player.x=5136;player.y=5040;player.shovelDepth=0;player.shovelDepthTarget=0;player._shovelCellKey=null;player.shovelCooldownMs=0;`);
check(`!shovelDig('DOWN')&&!shovelCellAt(player.x,player.y).open`, 'Standing inside an intact gate wall cannot open its saved tunnel roof');
run(`player.shovelDepth=36;player.shovelDepthTarget=36;player.shovelLevel=1;player._shovelCellKey=shovelCellKey(Math.floor(player.x/96),Math.floor(player.y/96));`);
check(`!shovelDig('UP')&&player.shovelDepthTarget===36`, 'Climbing cannot emerge inside the intact gate wall');
// The north route has the same complete underground-to-overworld recovery.
run(`shovelExcavation={};player.x=5136;player.y=-3408;player.aimAngle=-Math.PI/2;
 player.shovelLevel=1;player.shovelDepth=0;player.shovelDepthTarget=0;player._shovelCellKey=null;player.shovelCooldownMs=0;
 chunkMgr.lastKey=null;chunkMgr.update(player.x,player.y);activeBuildings=buildings.slice();activeParkingCars=[];buildColIndex();
 var northGate=buildings.find(b=>b.isGovFortress&&b.y<0),northGateHp=northGate.hp;
 shovelDig('DOWN');shovelSettle();shovelDig('DOWN');shovelSettle();var dugNorthWalk=true;
 for(let n=0;n<14;n++){if(!shovelDig('FORWARD')){dugNorthWalk=false;break;}shovelSettle();
  if(!shovelWalk(0,-96)){dugNorthWalk=false;break;}shovelSettle();}
 chunkMgr.lastKey=null;chunkMgr.update(player.x,player.y);activeBuildings=buildings.slice();activeParkingCars=[];buildColIndex();`);
check(`dugNorthWalk&&player.y===-4752&&shovelPlayerDepth()===36`, 'The player can dig and physically walk beneath the full north gate');
check(`shovelSurfaceCellSoft(Math.floor(player.x/96),Math.floor(player.y/96))&&shovelDig('UP')`, 'The far-side north lawn supports a real exit shaft');
run(`shovelSettle();shovelDig('UP');shovelSettle();`);
check(`shovelPlayerDepth()===0&&player.y===-4752&&northGate.hp===northGateHp&&northGate.hp>0`,
 'The player emerges north without damaging the gate or breaking through concrete');
run(`var p0={isPlayer:true,shovelLevel:1,shovelDepth:0},p18={isPlayer:true,shovelLevel:1,shovelDepth:18},p36={isPlayer:true,shovelLevel:1,shovelDepth:36},p54={isPlayer:true,shovelLevel:1,shovelDepth:54};`);
check(`shovelSameLayer(p0,p18)&&!shovelSameLayer(p0,p36)&&!shovelSameLayer(p18,p36)&&shovelSameLayer(p36,p54)`,
 'Combat permits waist-level contact while fully underground is a separate layer');
run(`var originalLevel=currentLevel;currentLevel=2;buildings=[{x:528,y:720,w:192,h:192,isGrassLot:true}];
 player.x=528;player.y=720;player.shovelLevel=2;player.shovelDepth=0;player.shovelDepthTarget=0;player.shovelCooldownMs=0;player._shovelCellKey=null;`);
check(`shovelSurfaceCellSoft(5,7)&&shovelDig('DOWN')&&shovelCellAt(528,720,2).depth===18`, 'Grass lots support the owned shovel in other mapped levels');
check(`shovelSurfaceSoftAt(5136,4560)`, 'Open ground in another biome works without a Level 1 lawn record');
run(`shovelSettle();currentLevel=3;shovelUpdatePlayer(player,16);`);
check(`shovelPlayerDepth()===0&&player.shovelDepthTarget===0&&shovelCellAt(528,720,2).depth===18`, 'Changing levels resets actor depth without deleting the previous excavation');
console.log('Shovel terrain: '+checks+' checks passed.');

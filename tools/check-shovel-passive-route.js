// Walk real excavated cells beneath intact Great Gates. Passive travel is a
// separate route, never a gate breach, tower victory, or recruitment grant.
const assert = require('assert/strict');
const {ctx, probe} = require('./harness');
let checks = 0, slot = null;
const ok = (value, label) => { assert.ok(value, label); checks++; };
const P = code => probe('(' + code + ')');
ctx.setTimeout = () => 0;
ctx.localStorage = {getItem: () => slot, setItem: (_, value) => {slot = value;}, removeItem: () => {slot = null;}};
function fresh(side = 'SOUTH', story = true, depth = 36) {
  probe(`resetStoryProgress();window.outpostForts={};window.travelArrival=null;
    isStoryMode=${story};startAtLevel(1);started=true;doTick=true;
    isPaused=isDead=isWin=killcamMode=false;inTownCutscene=inDarchonCall=inStoryIntro=inStoryRoom=false;
    inFortCutscene=inPostAmbushCutscene=inTravelMenu=inOverworldView=false;
    darchonCallCompleted=true;inWorldBuildingMenu=false;inUpstairsRoom=false;upstairsPhase=0;
    leftStick={active:false,dx:0,dy:0,base:{x:80,y:640}};
    rightStick={active:false,dx:0,dy:0,dist:0,base:{x:1120,y:690}};
    window.shovelOwned=true;setMeleeTool('SHOVEL');
    shovelExcavation={};
    var passiveGate=sectorGates().find(g=>${JSON.stringify(side)}==='SOUTH'?g.y>0:g.y<0);
    var passiveSign=passiveGate.y>0?1:-1, passiveX=(Math.floor((passiveGate.x+1320)/SHOVEL.cell)+.5)*SHOVEL.cell;
    var passiveStart=passiveGate.y-passiveSign*(passiveGate.h/2+48);
    for(let iy=Math.floor((passiveGate.y-passiveGate.h/2-180)/SHOVEL.cell);iy<=Math.floor((passiveGate.y+passiveGate.h/2+180)/SHOVEL.cell);iy++)
      for(let ix=Math.floor(passiveX/SHOVEL.cell)-1;ix<=Math.floor(passiveX/SHOVEL.cell)+1;ix++){
        shovelExcavation['1:'+ix+':'+iy]={x:(ix+.5)*SHOVEL.cell,y:(iy+.5)*SHOVEL.cell,level:1,ix,iy,depth:${depth},ceiling:0,open:true};
      }
    player.x=passiveX;player.y=passiveStart;player.shovelLevel=1;
    player.shovelDepth=${depth};player.shovelDepthTarget=${depth};player.shovelGateCrossing=null;
    player.ignoreBldgTimer=0;activeBuildings=buildings.slice();activeParkingCars=[];barrels=[];buildColIndex();
    var passiveGateHp=passiveGate.hp, passiveKills=totalKills, passiveScore=score;
    var passivePopulation=globalPopulation,passivePopTotal=popTotal;
  `);
}
function walkTo(progress) {
  return P(`(() => {
    let ticks=0;
    while(passiveSign*(player.y-passiveGate.y)<${progress}&&ticks++<400){
      const m=player.attemptMove(0,passiveSign*6);
      if(Math.abs(m.y)<.001)return false;
    }
    return passiveSign*(player.y-passiveGate.y)>=${progress};
  })()`);
}
function unchanged(label) {
  ok(P('passiveGate.hp===passiveGateHp&&!gateIsOpen(passiveGate)'), label + ': gate geometry and health remain intact');
  ok(P('!window.southGateBreachedStatus&&!window.northGateBreachedStatus&&!window.towersDefeated&&!nm0AmbushActive'), label + ': no breach, tower victory or ambush');
  ok(P('totalKills===passiveKills&&score===passiveScore&&globalPopulation===passivePopulation&&popTotal===passivePopTotal'), label + ': no score, casualties or recruitment grant');
  ok(P('!townsData[1]||!townsData[1].established'), label + ': the city is not falsely established');
  ok(P('!storyArcCleared(1)||!isStoryMode'), label + ': unfinished story objectives remain unfinished');
}

fresh();
ok(P('!canTravel("SOUTH")&&!sectorOverworldAvailable()'), 'An intact gate initially locks south travel and the overworld');
ok(walkTo(-160), 'Native underground movement reaches the middle of the south gate');
ok(P('!!player.shovelGateCrossing&&!window.passiveRouteUnlocked'), 'Entering the slab starts a crossing without unlocking it early');
probe('saveGame();loadGame();passiveGate=sectorGates().find(g=>g.y>0);');
ok(P('player.shovelGateCrossing&&Math.hypot(player.x-player.shovelGateCrossing.lastX,player.y-player.shovelGateCrossing.lastY)<.01'), 'A mid-tunnel save resumes the actual continuous crossing');
ok(walkTo(408), 'The player can traverse the entire intact south gate natively');
ok(P('!window.passiveRouteUnlocked'), 'An actor still partly below the gate has not escaped yet');
ok(walkTo(430), 'The player reaches the exterior with their whole body clear');
ok(P('window.passiveRouteUnlocked&&window.passiveRouteExit.side==="SOUTH"&&window.passiveRouteExit.level===1'), 'A full south crossing records the passive route');
ok(P('canTravel("SOUTH")&&travelDestination("SOUTH")===2&&sectorOverworldAvailable()'), 'The passive route unlocks the normal southern travel destination and pause overworld');
ok(P('!canTravel("NORTH")&&travelBlockedReason("NORTH").includes("SECTOR 09")'), 'The unmapped northern destination remains blocked');
ok(P('!overworldTownManageable(1)'), 'The overworld cannot turn an unliberated city into a government population grant');
unchanged('South escape');
probe('saveGame();window.passiveRouteUnlocked=false;window.passiveRouteExit=null;loadGame();');
ok(P('window.passiveRouteUnlocked&&window.passiveRouteExit.side==="SOUTH"&&canTravel("SOUTH")'), 'An awarded passive exit and travel access survive reload');
probe('inOverworldView=true;isPaused=false;startExtraction("SOUTH");');
ok(P('extraction&&extraction.dest===2&&extraction.passive'), 'Normal travel starts a quiet departure into Level 2');
probe('for(let i=0;i<87;i++)updateExtraction();');
ok(P('currentLevel===2&&currentBiome===2'), 'The actual extraction transitions the passive player to Level 2');
ok(P('!window.southGateBreachedStatus&&(!townsData[1]||!townsData[1].established)'), 'Arriving in Level 2 does not invent a liberated Stick City');
probe('extraction=null;window.travelArrival="NORTH";startAtLevel(1);');
ok(P('canTravel("SOUTH")&&sectorOverworldAvailable()&&!southGateOpen()'), 'Returning to the unfinished city retains passive travel independently of physical gate state');

fresh('NORTH');
ok(walkTo(430), 'Native movement can also cross the full north slab from the city side');
ok(P('window.passiveRouteUnlocked&&window.passiveRouteExit.side==="NORTH"&&canTravel("SOUTH")&&!canTravel("NORTH")'), 'North tunneling opens the passive system while Sector 09 remains unmapped');
unchanged('North escape');

fresh('SOUTH', false);
ok(walkTo(430)&&P('window.passiveRouteUnlocked'), 'Level 1 arcade play can discover the same passive tool route');

fresh('SOUTH', true, 18);
walkTo(430);
ok(P('!window.passiveRouteUnlocked&&!player.shovelGateCrossing'), 'Waist-deep excavation cannot pass as a fully underground gate escape');

fresh();
probe(`var gapY=Math.floor(passiveGate.y/SHOVEL.cell);
  for(let ix=Math.floor(passiveX/SHOVEL.cell)-1;ix<=Math.floor(passiveX/SHOVEL.cell)+1;ix++)delete shovelExcavation['1:'+ix+':'+gapY];`);
walkTo(430);
ok(P('!window.passiveRouteUnlocked'), 'An unexcavated gap breaks the continuous passage');

fresh();
probe('var tunnelFromX=player.x,tunnelFromY=player.y;player.y=passiveGate.y+passiveSign*450;checkShovelPassiveRoute(player,tunnelFromX,tunnelFromY);');
ok(P('!window.passiveRouteUnlocked&&!player.shovelGateCrossing'), 'Teleporting from the city to the country cannot award an escape');
probe('saveGame();loadGame();player.attemptMove(0,6);');
ok(P('!window.passiveRouteUnlocked&&!player.shovelGateCrossing'), 'Loading outside the gate without a crossing does not award passive travel');

fresh();
ok(walkTo(-100), 'The interrupted-crossing fixture reaches the tunnel');
probe('player.y+=120;player.attemptMove(0,6);');
ok(P('!window.passiveRouteUnlocked&&!player.shovelGateCrossing'), 'A discontinuity during an existing crossing clears the cursor');

fresh();
probe('var nativeTunnelFrom=player.y;player.x=passiveGate.x+passiveGate.w/2+30;player.y=passiveGate.y-passiveGate.h/2-6;player.y+=12;checkShovelPassiveRoute(player,player.x,player.y-12);');
ok(P('!window.passiveRouteUnlocked&&!player.shovelGateCrossing'), 'Going around a gate wing is not an underground crossing of its slab');

console.log('Shovel passive route: '+checks+' native crossing, persistence, travel and isolation checks passed.');

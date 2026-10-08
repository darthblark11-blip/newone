// Compare the flight broad phase against the previous full-world predicates.
// This guards gameplay parity, including gates, world edits and off-camera roofs.
const {ctx,probe}=require('./harness.js');
let checks=0,failures=0,queries=0;
function ok(name,value,detail) {
  checks++;
  if (!value) {failures++;console.log('FAIL '+name+(detail?' '+JSON.stringify(detail):''));}
}
probe(`
function referenceFlightPositionOpen(x,y,pad=60) {
  for (const b of buildings) {
    if (!airborneBuildingBlocks(b)) continue;
    if (Math.abs(x-b.x)>=b.w/2+pad || Math.abs(y-b.y)>=b.h/2+pad) continue;
    if (b.isGovFortress && gateIsOpen(b) && Math.abs(x-b.x)+pad<GATE_DOOR_HALF) continue;
    return false;
  }
  return !parkingCars.some(c=>Math.abs(x-c.x)<25+pad && Math.abs(y-c.y)<45+pad);
}
function referenceFlightClearShot(x1,y1,x2,y2) {
  const minX=Math.min(x1,x2),maxX=Math.max(x1,x2),minY=Math.min(y1,y2),maxY=Math.max(y1,y2);
  for (const b of buildings) {
    const left=b.x-b.w/2,top=b.y-b.h/2,right=b.x+b.w/2,bottom=b.y+b.h/2;
    if (right<minX||left>maxX||bottom<minY||top>maxY||!airborneBuildingBlocks(b)) continue;
    if (b.isGovFortress&&gateIsOpen(b)) {
      if (airborneLineHitsRect(x1,y1,x2,y2,left,top,b.x-GATE_DOOR_HALF,bottom)||
          airborneLineHitsRect(x1,y1,x2,y2,b.x+GATE_DOOR_HALF,top,right,bottom)) return false;
    } else if (airborneLineHitsRect(x1,y1,x2,y2,left,top,right,bottom)) return false;
  }
  return !parkingCars.some(c=>airborneLineHitsRect(x1,y1,x2,y2,c.x-25,c.y-45,c.x+25,c.y+45));
}
window.__originalFlightGateIsOpen=gateIsOpen;
gateIsOpen=b=>!!b.testGateOpen;
window.__flightSpatialSeed=714389;
function spatialRandom() {
  window.__flightSpatialSeed=(Math.imul(window.__flightSpatialSeed,1664525)+1013904223)>>>0;
  return window.__flightSpatialSeed/4294967296;
}
function compareFlightQueries(count) {
  let differences=0,first=null;
  for (let i=0;i<count;i++) {
    const x=(spatialRandom()-.5)*24000,y=(spatialRandom()-.5)*24000;
    const x2=x+(spatialRandom()-.5)*2400,y2=y+(spatialRandom()-.5)*2400;
    const pad=[0,15,60,120,-5][i%5];
    const position=airbornePositionOpen(x,y,pad),referencePosition=referenceFlightPositionOpen(x,y,pad);
    const shot=airborneClearShot(x,y,x2,y2),referenceShot=referenceFlightClearShot(x,y,x2,y2);
    if (position!==referencePosition||shot!==referenceShot) {
      differences++;if (!first) first={x,y,x2,y2,pad,position,referencePosition,shot,referenceShot};
    }
  }
  return {differences,first};
}
buildings=[];parkingCars=[];activeBuildings=[];activeParkingCars=[];
for (let i=0;i<1300;i++) {
  const b={x:(spatialRandom()-.5)*24000,y:(spatialRandom()-.5)*24000,
    w:20+spatialRandom()*900,h:20+spatialRandom()*650};
  const flag=['isRiver','isDeck','isPalm','isAlienPlant','isEnergyPole','isGrassLot'][i%14];
  if (flag) b[flag]=true;
  buildings.push(b);
}
for (let i=0;i<140;i++) parkingCars.push({x:(spatialRandom()-.5)*24000,y:(spatialRandom()-.5)*24000});
buildings.push({x:-6400,y:-4200,w:9600,h:800,isGovFortress:true,testGateOpen:true});
buildings.push({x:600,y:5400,w:9600,h:800,isGovFortress:true,testGateOpen:false});
buildings.push({x:-4900,y:600,w:500,h:11000,isWall:true});
`);
for (let level=0;level<=8;level++) {
  probe(`currentLevel=${level};frameCount++;`);
  const result=probe('compareFlightQueries(1600)');queries+=3200;
  ok('Level '+level+' indexed predicates equal full-world predicates',result.differences===0,result.first);
}

function fixture(roofs,cars=[],level=3) {
  ctx.__spatialRoofs=roofs;ctx.__spatialCars=cars;
  probe(`currentLevel=${level};buildings=window.__spatialRoofs;parkingCars=window.__spatialCars;
    activeBuildings=[];activeParkingCars=[];frameCount++;`);
}
fixture([{x:5000,y:5000,w:200,h:200}]);
ok('Station probes see roofs beyond the active/camera ring',!probe('airbornePositionOpen(5000,5000)'));
ok('Shot probes see roofs beyond the active/camera ring',!probe('airborneClearShot(4800,5000,5200,5000)'));
fixture([{x:-256,y:-512,w:256,h:128}],[{x:-512,y:-256}]);
for (const point of [[-444,-512],[-443,-512],[-68,-512],[-69,-512],[-512,-361],[-512,-360],[-427,-256],[-426,-256]]) {
  ctx.__spatialPoint=point;
  ok('Negative-coordinate boundary '+point,probe('airbornePositionOpen(...window.__spatialPoint)===referenceFlightPositionOpen(...window.__spatialPoint)'));
}
for (const ray of [[-600,-576,-100,-576],[-600,-575.999,-100,-575.999],[-256,-800,-256,-300],[-256,-512,-256,-512],[-256,-400,-256,-400]]) {
  ctx.__spatialRay=ray;
  ok('Exact boundary/tangent/zero-length ray '+ray,probe('airborneClearShot(...window.__spatialRay)===referenceFlightClearShot(...window.__spatialRay)'));
}
fixture([{x:600,y:5400,w:9600,h:800,isGovFortress:true,testGateOpen:false}]);
ok('Huge closed gate stops a doorway ray',!probe('airborneClearShot(600,4800,600,6000)'));
probe('buildings[0].testGateOpen=true;');
ok('Same-frame gate opening is queried live',probe('airborneClearShot(600,4800,600,6000)&&airbornePositionOpen(600,5400)'));
ok('Open huge gate retains its wings',!probe('airborneClearShot(1100,4800,1100,6000)'));
probe('buildings[0].testGateOpen=false;');
ok('Same-frame gate closing is queried live',!probe('airborneClearShot(600,4800,600,6000)'));
fixture([{x:0,y:0,w:200,h:200,isPalm:true}],[],4);
ok('Ignored biome prop can change blocking flags within the frame',probe('airbornePositionOpen(0,0)'));
probe('buildings[0].isPalm=false;');
ok('Live changed prop flags do not leave a stale exclusion',!probe('airbornePositionOpen(0,0)'));
probe('currentLevel=6;buildings[0].isAlienPlant=true;');
ok('Level-specific blockers are evaluated live',probe('airbornePositionOpen(0,0)'));

fixture([{x:0,y:0,w:200,h:200}],[{x:1000,y:1000}]);
probe('airbornePositionOpen(0,0);buildings=[{x:1000,y:0,w:200,h:200}];');
ok('Same-frame same-length world-array replacement is detected',probe('airbornePositionOpen(0,0)&&!airbornePositionOpen(1000,0)'));
probe('buildings.push({x:0,y:0,w:100,h:100});');
ok('Same-frame solid addition is detected',!probe('airbornePositionOpen(0,0)'));
probe('buildings.splice(1,1);');
ok('Same-frame solid destruction is detected',probe('airbornePositionOpen(0,0)'));
probe('buildings[0]={x:-1000,y:0,w:200,h:200};frameCount++;');
ok('Next-frame same-length in-place replacement is detected',probe('airbornePositionOpen(1000,0)&&!airbornePositionOpen(-1000,0)'));
probe('buildings[0].x=0;buildings[0].y=2000;frameCount++;');
ok('Next-frame moved roof is detected automatically',probe('airbornePositionOpen(-1000,0)&&!airbornePositionOpen(0,2000)'));
probe('buildings[0].w=900;buildings[0].h=900;frameCount++;');
ok('Next-frame resized roof is detected automatically',!probe('airbornePositionOpen(400,2000)'));
probe('parkingCars[0].x=-2000;parkingCars[0].y=-2000;frameCount++;');
ok('Next-frame moved parked car is detected automatically',probe('airbornePositionOpen(1000,1000)&&!airbornePositionOpen(-2000,-2000)'));
probe('buildings[0].x=3000;parkingCars[0].x=3000;invalidateAirborneIndex();');
ok('Explicit invalidation detects same-frame geometry moves',probe('airbornePositionOpen(0,2000)&&!airbornePositionOpen(3000,2000)&&!airbornePositionOpen(3000,-2000)'));
probe('buildings.splice(0,1,{x:-3000,y:2000,w:200,h:200});invalidateAirborneIndex();');
ok('Explicit invalidation detects same-frame remove/replace with unchanged length',probe('airbornePositionOpen(3000,2000)&&!airbornePositionOpen(-3000,2000)'));
probe('parkingCars=[{x:-5000,y:-5000}];');
ok('Same-frame same-length parked-car array replacement is detected',!probe('airbornePositionOpen(-5000,-5000)'));
fixture([{x:0,y:0,w:50,h:50,isPlayerBuilt:true}]);
probe('airbornePositionOpen(0,0);playerStructures=[];buildSites=[{level:3,kind:"WAREHOUSE",x:3000,y:0,w:50,h:50,done:true}];republishPlayerStructures();');
ok('Structure publication invalidates a same-count replacement within the frame',probe('buildings.length===1&&airbornePositionOpen(0,0)&&!airbornePositionOpen(3000,0)'));

fixture([{x:256,y:0,w:512,h:512},{x:-256,y:0,w:512,h:512},{x:0,y:0,w:1200,h:80},{x:20,y:0,w:80,h:80}]);
ok('Ordered candidate requests retain source order and deduplicate cells',probe('airborneBuildingCandidates(-600,-300,600,300,true).every((b,i)=>b===buildings[i])'));
ok('A caller-owned candidate buffer survives nested geometry probes',probe(`(()=>{const out=[];
  const list=airborneBuildingCandidates(-600,-300,600,300,true,out);
  const before=list.slice();airbornePositionOpen(2000,2000);airborneClearShot(2000,2000,2100,2100);
  return list.length===before.length&&list.every((b,i)=>b===before[i]);})()`));
ok('Long-ray fallback retains exact full-world behavior',probe('airborneClearShot(-100000,-100000,100000,100000)===referenceFlightClearShot(-100000,-100000,100000,100000)'));
fixture([{x:0,y:0,w:0,h:50},{x:0,y:0,w:-50,h:50},{x:0,y:0,w:Infinity,h:20},{x:NaN,y:0,w:20,h:20}]);
const irregular=probe('compareFlightQueries(200)');queries+=400;
ok('Degenerate/non-finite geometry preserves old predicates without unbounded grid loops',irregular.differences===0,irregular.first);

fixture(Array.from({length:2000},(_,i)=>({x:2000+(i%100)*400,y:2000+Math.floor(i/100)*400,w:150,h:150})));
probe('buildings.unshift({x:0,y:0,w:100,h:100});airbornePositionOpen(0,0);');
ok('A local probe narrows a 2001-solid world to one candidate',probe('airborneBuildingCandidates(-60,-60,60,60).length===1'));
probe('gateIsOpen=window.__originalFlightGateIsOpen;');
console.log(checks+' checks, '+queries+' randomized query comparisons, '+failures+' failures');
if (failures) process.exitCode=1;

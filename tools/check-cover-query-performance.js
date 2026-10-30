// Compare the optimized cover broad phase with the branch's original exact
// solvers. Keep endpoint/tangent hits, gate wings, unusual geometry and the
// first swept impact unchanged while rejecting coarse-cell false positives.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {ctx,probe}=require('./harness');
const baseline=process.env.COVER_QUERY_BASELINE_JS?
  fs.readFileSync(process.env.COVER_QUERY_BASELINE_JS,'utf8'):
  execFileSync('git',['show','37dfd722d2524a1810851ffc62905b3aa1d655a4:game.js'],
    {cwd:__dirname+'/..',maxBuffer:8e6}).toString();
function original(start,end) {
  const a=baseline.indexOf('function '+start+'('),b=baseline.indexOf('function '+end+'(',a);
  assert.ok(a>=0&&b>a,'baseline markers exist');
  return baseline.slice(a,b).trim();
}
probe(`window.__referenceCoverRay=(${original('coverRayClear','coverPeekHeadClear')});
  window.__referenceCoverLine=(${original('coverLineClear','coverActorHitCenter')});
  window.__referenceCoverBullet=(${original('coverBulletBlock','legShotBoneTime').split('// Low standing shots')[0]});
  currentLevel=currentBiome=2;started=doTick=true;isPaused=isDead=isWin=false;
  window.southGateBreachedStatus=false;window.nm0AmbushClearedStatus=false;
  nm0AmbushActive=false;buildings=activeBuildings=[];activeParkingCars=[];`);
const P=s=>probe('('+s+')');
let comparisons=0,seed=348121;
function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function check(ray,radius,zone,launchLow) {
  ctx.__query={ray,radius,zone,launchLow};
  probe(`window.__r=__query.ray;window.__bullet={prevX:__r[0],prevY:__r[1],x:__r[2],y:__r[3],
    tH:__query.zone,coverLaunchLow:__query.launchLow,shooter:null};`);
  assert.equal(P('coverRayClear(...__r,__query.radius)'),P('__referenceCoverRay(...__r,__query.radius)'),
    'peek envelope: '+ray+'/'+radius);
  assert.equal(P('coverLineClear(...__r,__query.zone,null,null,__query.launchLow)'),
    P('__referenceCoverLine(...__r,__query.zone,null,null,__query.launchLow)'), 'height-aware line: '+ray);
  const optimized=P('(()=>{const h=coverBulletBlock(__bullet);return {t:h.t,solid:activeBuildings.indexOf(h.solid),car:h.car};})()');
  const reference=P('(()=>{const h=__referenceCoverBullet(__bullet);return {t:h.t,solid:activeBuildings.indexOf(h.solid),car:h.car};})()');
  assert.deepEqual(optimized,reference,'first swept impact: '+ray);
  comparisons+=3;
}
for(const indexed of [false,true]) {
  const props=[];
  for(let i=0;i<(indexed?300:12);i++) {
    const flags=['isWall','isLowWall','isCrateProp','isGrassLot','isUBarrier','isDeck','isRock','noCover'];
    props.push({x:random()*1400-700,y:random()*1400-700,w:2+random()*160,h:2+random()*160,
      hp:i%17?100:0,[flags[i%flags.length]]:true});
  }
  ctx.__props=props;
  probe(`buildings=activeBuildings=__props;activeParkingCars=[];frameCount++;
    invalidateCrowdSolids();`);
  for(let i=0;i<1800;i++) {
    const x=random()*1600-800,y=random()*1600-800,a=random()*Math.PI*2,d=random()*600;
    check([x,y,x+Math.cos(a)*d,y+Math.sin(a)*d],i%7, ['HEAD','BODY','LEGS'][i%3],i%2===0);
  }
}
// Explicit edges and replacements are checked without a rebuild between
// mutations: the cover cache must keep using live HP, dimensions and gates.
probe(`window.__gate={x:0,y:100,w:1000,h:40,isGovFortress:true,hp:100};
  window.__wall={x:40,y:0,w:20,h:160,isWall:true,hp:100};
  window.__car={x:150,y:0,isParkingCar:true,w:1,h:1,hp:100};
  activeBuildings=buildings=[__wall,__gate,__car,
    {x:0,y:0,w:100,h:100,isUBarrier:true,hp:100},
    {x:300,y:0,w:-20,h:-160,coverType:'HIGH'},
    {x:500,y:0,w:0,h:100,coverType:'HIGH'},
    {x:NaN,y:0,w:100,h:100}, {x:Infinity,y:0,w:100,h:100},
    {x:0,y:500,w:Infinity,h:20,coverType:'HIGH'},
    {x:2e8,y:-2e8,w:1e7,h:1e7,coverType:'HIGH'}];
  activeParkingCars=[__car,{x:200,y:100,hp:100}];frameCount++;`);
const edges=[
  [0,80,80,80],[0,80+1e-9,80,80+1e-9],[30,-100,30,100],
  [0,0,30,0],[30,0,30,0],[30-1e-9,0,30-1e-9,0],
  [0,50,0,150],[400,50,400,150],[-300,50,-300,150],[300,50,300,150],
  [120,0,180,0],[100,0,200,0],[250,0,350,0],[-1e9,0,1e9,0],
  [2e8-1e7,-2e8,2e8+1e7,-2e8],[NaN,0,100,0],[Infinity,0,0,0],
  [0,-Infinity,0,Infinity],[1e308,1e308,-1e308,-1e308],
  [40,0,40+1e-10,0],[0,0,100,1e-10]
];
for(let mutation=0;mutation<6;mutation++) {
  if(mutation===1)probe('window.southGateBreachedStatus=true;');
  if(mutation===2)probe('__wall.hp=0;__car.hp=0;');
  if(mutation===3)probe('__wall.hp=100;__wall.x=60;__wall.w=60;__gate.w=1200;');
  if(mutation===4)probe('activeBuildings=buildings=activeBuildings.slice();__wall.y=20;frameCount++;');
  if(mutation===5)probe('window.southGateBreachedStatus=false;__gate.hp=0;');
  for(const ray of edges)for(const radius of [0,1,6,-1,NaN,Infinity])
    for(const zone of ['HEAD','BODY','LEGS'])check(ray,radius,zone,mutation%2===0);
}
probe(`activeParkingCars=[];activeBuildings=buildings=[];
  for(let i=0;i<200;i++)activeBuildings.push({x:100+(i%10)*10,y:100+Math.floor(i/10)*5,w:2,h:2,isWall:true});
  frameCount++;window.__kind=coverSolidKind;window.__kindCalls=0;
  coverSolidKind=b=>{__kindCalls++;return __kind(b);};`);
for(const call of ['coverRayClear(0,0,50,0,6)',"coverLineClear(0,0,50,0,'BODY',null,null,false)",
  "coverBulletBlock({prevX:0,prevY:0,x:50,y:0,tH:'BODY',coverLaunchLow:false})"]) {
  probe('__kindCalls=0;'+call+';');
  assert.equal(P('__kindCalls'),0,'coarse-cell misses skip material classification');
}
probe('coverSolidKind=__kind;');
// Small collections have always tolerated missing optional records. Keep
// their native material rejection ahead of any attempt to read bounds.
probe(`activeBuildings=buildings=[null,undefined,{x:40,y:0,w:20,h:160,isWall:true}];frameCount++;`);
for(const ray of [[0,0,80,0],[0,100,80,100],[30,80,30,80]])
  for(const zone of ['HEAD','BODY','LEGS'])check(ray,6,zone,false);
console.log(`${comparisons} cover ray, height and swept-impact parity comparisons passed; coarse-cell misses classify zero materials.`);

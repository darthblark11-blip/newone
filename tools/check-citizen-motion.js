// Civilian navigation remains responsive while the visible body turns and
// settles through intermediate poses. Painting never advances that motion.
const assert=require('node:assert/strict');
const {probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
probe(`
  currentLevel=currentBiome=2;BIOME_ACTIVE=false;started=doTick=true;
  isPaused=isDead=isWin=killcamMode=false;isStoryMode=false;
  resetShovelState();buildings=activeBuildings=[];activeParkingCars=[];
  townCitizens=[];player={x:-1000,y:-1000,hp:100};invalidateColIndex();
  viewLeft=viewTop=-2000;viewRight=viewBottom=2000;
  deltaTime=1000/60;frameCount=101;
  var walker=new Citizen(0,0,'SCIENCE');
  walker.moveAngle=walker._citizenMotion.angle=0;
  walker.state='WANDER';walker.timer=10000;walker.speed=1;
  walker.tx=1000;walker.ty=0;
`);
function tick(n=1){for(let i=0;i<n;i++)probe('frameCount++;walker.update();');}
tick();
ok('walking starts with a partial stride instead of a full-cycle jump',P('walker.x>0&&walker._citizenMotion.motion>0&&walker._citizenMotion.motion<.2'));
tick(60);
ok('steady walking reaches the stride for its actual travel speed',P('walker._citizenMotion.motion>.79&&walker._citizenMotion.motion<.81'));
const startX=P('walker.x');
probe('walker.tx=-1000;');tick();
ok('a requested reversal moves immediately while the body begins its turn',P('walker.x')<startX&&P('walker._citizenMotion.angle>0&&walker._citizenMotion.angle<.15'));
let previous=P('walker._citizenMotion.angle'),bounded=true;
for(let i=0;i<90;i++){
  tick();const next=P('walker._citizenMotion.angle');
  bounded&&=Math.abs(wrap(next-previous))<=7/60+1e-8;previous=next;
}
ok('a civilian completes a bounded shortest-arc turn',bounded&&Math.abs(wrap(previous-Math.PI))<.001);
probe('walker.state="IDLE";');tick();
ok('stopping retains a partial stride and the previous facing',P('walker._citizenMotion.motion>0&&walker._citizenMotion.motion<1')&&Math.abs(wrap(P('walker._citizenMotion.angle')-Math.PI))<.001);
tick(90);
ok('idle settles the arms and legs without resetting body direction',P('walker._citizenMotion.motion===0')&&Math.abs(wrap(P('walker._citizenMotion.angle')-Math.PI))<.001);
probe('var motionBefore=JSON.stringify(walker._citizenMotion);walker.updateMotion(20,0);');
ok('multiple consumers cannot advance the same simulation frame twice',P('JSON.stringify(walker._citizenMotion)===motionBefore'));
probe('walker.show();walker.show();');
ok('repeated rendering does not advance transition state',P('JSON.stringify(walker._citizenMotion)===motionBefore'));
probe('isPaused=true;frameCount++;walker.moveAngle=0;walker.updateMotion(20,0,100);');
ok('pause freezes turn momentum and stride envelope',P('JSON.stringify(walker._citizenMotion)===motionBefore'));
console.log(`${checks}/${checks} civilian transition checks passed.`);

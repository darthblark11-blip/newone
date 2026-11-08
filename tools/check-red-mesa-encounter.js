// The stealth sandbox owns a fixed encounter, not ambient bandit spawns.
// Exercise real movement/collision, casualty hooks and save restoration.
const assert=require('assert');
const {probe}=require('./harness');
const run=code=>probe(code);
let checks=0;
function check(code,message){assert.ok(run(code),message);checks++;}
run(`isStoryMode=false;resetStoryProgress();startAtLevel(3);started=true;
  isPaused=false;isDead=false;isWin=false;killcamMode=false;inTownCutscene=false;
  inFarmCutscene=false;inFarmPostCutscene=false;inFortCutscene=false;
  inPostAmbushCutscene=false;inTravelMenu=false;inDarchonCall=false;inStoryIntro=false;
  doTick=true;barrels=[];player.ignoreBldgTimer=0;
  var mesaDef=FRONTIER_BOUNTY_DEFS[0],mesaQ=frontierBountyRecord(mesaDef);
  frontierBounties.activeId=mesaDef.id;mesaQ.stage='ACTIVE';
  player.x=mesaDef.x;player.y=mesaDef.y+360;
  chunkMgr.update(player.x,player.y);lastActiveUpdate=0;updateActiveWorld();updateFrontierBounties();
  var mesaActors=()=>enemiesList.filter(e=>e.frontierBountyId==='RED_MESA'&&!e.dead&&e.hp>0);
  var mesaTargets=()=>mesaActors().filter(e=>Number.isInteger(e.frontierBountySlot));
  var mesaSupports=()=>mesaActors().filter(e=>Number.isInteger(e.frontierBountySupportSlot));`);
check('mesaTargets().length===5&&mesaSupports().length===6&&_frontierBountyActors.size===11',
  'Exactly five wanted targets and six independently keyed supporting sentries spawn');
check(`mesaActors().every(e=>e.redMesaGuard&&e.state==='PATROL'&&!e.checkCol(e.x,e.y))`,
  'Approaching the compound does not trigger the legacy instant alert');
check(`frontierBountyStructures().filter(b=>b.frontierBountyId==='RED_MESA').every(b=>
  Math.abs(b.x-mesaDef.x)+b.w/2<=mesaDef.w/2&&Math.abs(b.y-mesaDef.y)+b.h/2<=mesaDef.h/2)`,
  'Every new fortress solid fits the existing procedural reservation');
check(`frontierBountyStructures().filter(b=>b.frontierBountyId==='RED_MESA'&&coverSolidKind(b)==='LOW').length===5`,
  'Five real collision solids provide eligible waist-high cover');
check(`mesaActors().every(e=>e.redMesaPatrol.length>=4&&e.redMesaPatrol.every((p,i,route)=>{
  const to=route[(i+1)%route.length],steps=Math.ceil(Math.hypot(to.x-p.x,to.y-p.y)/4);
  for(let n=0;n<=steps;n++)if(e.checkCol(p.x+(to.x-p.x)*n/steps,p.y+(to.y-p.y)*n/steps))return false;
  return true;
}))`, 'Every segment of all eleven closed patrol routes clears native collision');
// Flood using real player attemptMove, including native canyon height handling.
// Check all four entries and every wanted target against the same reachable field.
check(`(() => {
  const size=10,start=[0,360],queue=[start],seen=new Set(['0,360']);
  const reach=(ax,ay,bx,by)=>{
    player.x=mesaDef.x+ax;player.y=mesaDef.y+ay;
    for(let n=0;n<8;n++){
      const dx=mesaDef.x+bx-player.x,dy=mesaDef.y+by-player.y,d=Math.hypot(dx,dy);
      if(d<.05)return true;
      const step=Math.min(3,d),m=player.attemptMove(dx/d*step,dy/d*step);
      if(Math.abs(m.x)+Math.abs(m.y)<.001)return false;
    }return false;
  };
  for(let i=0;i<queue.length;i++){
    const [x,y]=queue[i];
    for(const [dx,dy]of[[10,0],[-10,0],[0,10],[0,-10]]){
      const nx=x+dx,ny=y+dy,key=nx+','+ny;
      if(nx< -410||nx>410||ny< -370||ny>370||seen.has(key)||!reach(x,y,nx,ny))continue;
      seen.add(key);queue.push([nx,ny]);
    }
  }
  const goals=[[-410,80],[410,80],[120,-370],...mesaTargets().map(e=>[
    Math.round((e.x-mesaDef.x)/10)*10,Math.round((e.y-mesaDef.y)/10)*10])];
  return goals.every(([x,y])=>seen.has(x+','+y));
})()`, 'South, west, east and north entrances share native walkable routes to every wanted outlaw');
check(`redMesaSurfaceAt(mesaDef.x,mesaDef.y+280)==='TIMBER'&&
  redMesaSurfaceAt(mesaDef.x,mesaDef.y-110)==='STONE'&&
  redMesaSurfaceAt(mesaDef.x,mesaDef.y+170)==='EARTH'&&
  redMesaSurfaceAt(0,0)===null`, 'Audible surface materials match authored visible pads only inside Red Mesa');
run(`player.x=mesaDef.x;player.y=mesaDef.y+360;
  var supportVictim=mesaSupports().find(e=>e.frontierBountySupportSlot===0);
  var supportWounded=mesaSupports().find(e=>e.frontierBountySupportSlot===1);
  var targetWounded=mesaTargets().find(e=>e.frontierBountySlot===1);
  supportWounded.hp=47;targetWounded.hp=63;
  restoreRedMesaStealthActor(supportWounded,{phase:'INVESTIGATE',suspicion:.55,goalX:mesaDef.x,goalY:mesaDef.y+170,patrolIndex:2});
  restoreRedMesaStealthActor(targetWounded,{phase:'CURIOUS',suspicion:.35,goalX:mesaDef.x,goalY:mesaDef.y+160,patrolIndex:1});
  var mesaScoreBefore=score,mesaKillsBefore=totalKills;
  supportVictim.hp=0;supportVictim.dead=true;
  processKill(supportVictim.x,supportVictim.y,false,'BANDIT',false,supportVictim);
  processKill(supportVictim.x,supportVictim.y,false,'BANDIT',false,supportVictim);`);
check('mesaQ.supportKilled.join()===\'0\'&&mesaQ.killed.length===0&&score===mesaScoreBefore&&totalKills===mesaKillsBefore',
  'A support casualty is recorded once without wanted-head progress, campaign kills or bounty score');
run('var mesaSnapshot=serializeFrontierBounties();releaseFrontierBountyActors();restoreFrontierBounties(mesaSnapshot);updateFrontierBounties();mesaQ=frontierBountyRecord(mesaDef);');
check(`mesaTargets().length===5&&mesaSupports().length===5&&
  !mesaSupports().some(e=>e.frontierBountySupportSlot===0)&&
  mesaSupports().find(e=>e.frontierBountySupportSlot===1).hp===47&&
  mesaTargets().find(e=>e.frontierBountySlot===1).hp===63`,
  'Save/restore and encounter release preserve independent support deaths and all surviving wounds');
check(`mesaSupports().find(e=>e.frontierBountySupportSlot===1).redMesaStealth.phase==='INVESTIGATE'&&
  mesaSupports().find(e=>e.frontierBountySupportSlot===1).redMesaStealth.suspicion===.55&&
  mesaTargets().find(e=>e.frontierBountySlot===1).redMesaStealth.phase==='CURIOUS'&&
  mesaTargets().find(e=>e.frontierBountySlot===1).redMesaStealth.suspicion===.35`,
  'Support and target suspicion, investigation phases and patrol memory survive re-formation');
run(`var mesaSnapshotDetached=serializeFrontierBounties();
  mesaQ.supportSurvivors[1].hp=1;mesaQ.survivors[1].hp=1;
  mesaQ.supportSurvivors[1].stealth.suspicion=0;mesaQ.survivors[1].stealth.suspicion=0;`);
check('mesaSnapshotDetached.contracts.RED_MESA.supportSurvivors[1].hp===47&&mesaSnapshotDetached.contracts.RED_MESA.survivors[1].hp===63&&mesaSnapshotDetached.contracts.RED_MESA.supportSurvivors[1].stealth.suspicion===.55&&mesaSnapshotDetached.contracts.RED_MESA.survivors[1].stealth.suspicion===.35',
  'Saved target and support survivor records are detached from mutable live records');
run(`for(const e of mesaTargets().slice()){
  e.hp=0;e.dead=true;processKill(e.x,e.y,false,'BANDIT',false,e);
}`);
check(`mesaQ.stage==='READY'&&mesaQ.killed.length===5&&mesaQ.supportKilled.length===1&&
  _frontierBountyActors.size===0&&mesaActors().every(e=>e.dead||e.hp<=0)&&score===mesaScoreBefore+25`,
  'Only the five original targets finish the poster; remaining supports release at READY');
run(`restoreFrontierBounties({activeId:'RED_MESA',contracts:{RED_MESA:{stage:'ACTIVE',
  supportKilled:[0,0,-1,6,99,'2'],supportSurvivors:{0:{hp:100,x:0,y:0},1:{hp:999,x:NaN,y:Infinity}}}}});
  mesaQ=frontierBountyRecord(mesaDef);`);
check('mesaQ.supportKilled.join()===\'0\'&&!mesaQ.supportSurvivors[0]&&mesaQ.supportSurvivors[1].hp===100&&Number.isFinite(mesaQ.supportSurvivors[1].x)',
  'Malformed supporting-guard slots and wounds are sanitized without changing five-head progress');
check(`FRONTIER_BOUNTY_DEFS[1].count===6&&FRONTIER_BOUNTY_DEFS[2].count===7&&
  !('supportKilled' in frontierBountyRecord(FRONTIER_BOUNTY_DEFS[1]))`,
  'Dust Rail and Coyote Mine retain their original rosters and contract schema');
console.log('Red Mesa encounter: '+checks+' integration checks passed.');

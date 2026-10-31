// Native shotgun body outcome7 uses the current human fall rig, its wound
// frames, and the same painter when live or permanently stamped on the floor.
const assert=require('node:assert/strict');
const {ctx,mkG,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0,seed=68131;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
const near=(a,b,label)=>{assert.ok(Math.abs(a-b)<1e-7,label+': '+a+' versus '+b);checks++;};
const angleNear=(a,b,label)=>near(Math.atan2(Math.sin(a-b),Math.cos(a-b)),0,label);
ctx.setTimeout=()=>0;
ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const r=seed/4294967296;
  return a===undefined?r:Array.isArray(a)?a[Math.floor(r*a.length)]:b===undefined?r*a:a+(b-a)*r;};
probe(`currentLevel=currentBiome=8;BIOME_ACTIVE=false;started=doTick=true;
  isStoryMode=isPaused=isDead=isWin=killcamMode=nm0AmbushActive=false;
  inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
  inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
  inWorldBuildingMenu=inOverworldView=inTravelMenu=false;window.inNM0SecretOverlay=false;
  buildGhost=null;townsData={};window.outpostForts={};
  buildings=activeBuildings=[];parkingCars=activeParkingCars=[];barrels=[];invalidateColIndex();
  player=new Character(-2000,-2000,true);player.hp=player.maxHp=100000;
  leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
  setMeleeTool('NONE');resetForestWildlife();
  ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=jetpackUnlocked=false;
  frameCount=1000;deltaTime=1000/60;MAX_KILLS=1000000;totalKills=0;
  viewLeft=viewTop=-100000;viewRight=viewBottom=100000;`);
let matrix=[1,0,0,1,0,0],fill=[],stack=[],bodies=[],heads=[],limbs=[],bones=[],marks=[],pools=[],limb=-1;
const original={};
for(const key of ['push','pop','translate','rotate','scale','fill','ellipse','drawFallenAttire','drawFallenHead','drawFallLimb','drawFallBone','createGraphics'])original[key]=ctx[key];
const multiply=u=>{const m=matrix;matrix=[m[0]*u[0]+m[2]*u[1],m[1]*u[0]+m[3]*u[1],
  m[0]*u[2]+m[2]*u[3],m[1]*u[2]+m[3]*u[3],m[0]*u[4]+m[2]*u[5]+m[4],m[1]*u[4]+m[3]*u[5]+m[5]];};
ctx.push=()=>{stack.push({matrix:[...matrix],fill});original.push();};
ctx.pop=()=>{assert.ok(stack.length,'unbalanced shotgun painter');({matrix,fill}=stack.pop());original.pop();};
ctx.translate=(x,y)=>{multiply([1,0,0,1,x,y]);original.translate(x,y);};
ctx.rotate=a=>{multiply([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);original.rotate(a);};
ctx.scale=(x,y=x)=>{multiply([x,0,0,y,0,0]);original.scale(x,y);};
ctx.fill=(...args)=>{fill=args[0]&&args[0].levels?[...args[0].levels]:args;original.fill(...args);};
ctx.ellipse=(x,y,w,h)=>{
  assert.ok([x,y,w,h,...matrix].every(Number.isFinite),'finite shotgun anatomy');
  if(fill[0]===91&&fill[1]===1&&fill[3]===223)marks.push({id:fill[2],x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]});
  if(fill[0]===90&&fill[1]===0&&fill[2]===0&&Math.abs(x+4)<1e-8&&y===0)pools.push({w,h,alpha:fill[3]});
  original.ellipse(x,y,w,h);
};
ctx.drawFallenAttire=(r,id,TL,TW,back,f,...args)=>{bodies.push({TL,TW,back,f,matrix:[...matrix]});return original.drawFallenAttire(r,id,TL,TW,back,f,...args);};
ctx.drawFallenHead=(r,id,p,f,wear)=>{heads.push({faceDown:!!p.faceDown,matrix:[...matrix]});return original.drawFallenHead(r,id,p,f,wear);};
ctx.drawFallLimb=(...args)=>{const previous=limb;limb=args[3];limbs.push({i:limb,faceDown:args[10],rig:args[1]});
  const result=original.drawFallLimb(...args);limb=previous;return result;};
ctx.drawFallBone=(...args)=>{bones.push({i:limb,x:args[1],y:args[2],nx:args[3],ny:args[4],width:args[5],tip:args[8]});return original.drawFallBone(...args);};
function resetPaint(){matrix=[1,0,0,1,0,0];fill=[];stack=[];bodies=[];heads=[];limbs=[];bones=[];marks=[];pools=[];limb=-1;}
function paint(stamp=false){
  resetPaint();const before=P('JSON.stringify({fall:c.fall,rag:c.rag,pool:c.poolAge,x:c.x,y:c.y})');
  if(stamp)probe('stampCorpse(c);');else probe('c.show();');
  ok('painting balances transforms and leaves simulation frozen',stack.length===0&&before===P('JSON.stringify({fall:c.fall,rag:c.rag,pool:c.poolAge,x:c.x,y:c.y})'));
}
function kill(type,shot,moving,back){
  const heading=moving?shot+Math.PI/2:shot,facing=heading+(back?0:Math.PI);
  probe(`frameCount=1000;bullets=[];corpses=[];particles=[];splatters=[];totalKills=0;bodyOverkillCounter=1;
    window.e=new Character(80*Math.cos(${shot}),80*Math.sin(${shot}),false,${JSON.stringify(type)});
    e.hp=1;e.shield=0;e.isFriendly=e.isNeutral=false;e.aimAngle=${facing};e.moveAngle=${heading};e.isMoving=${moving};
    e.decals=[{x:-3.2,y:2.1,sz:4,col:[91,1,201,223],isBulletHole:true},
      {x:2.2,y:-1.3,sz:4,col:[91,1,202,223],isHead:true,isBulletHole:true},
      {isLeg:true,legIndex:1,legSegment:1,legU:.7,legV:.1,sz:4,col:[91,1,203,223],isBulletHole:true}];
    rememberFigureMotion(e,${moving?4:0}*Math.cos(${heading}),${moving?4:0}*Math.sin(${heading}));enemiesList=[e];`);
  seed=68131;
  probe(`window.round=spawnBullet(0,0,${shot},true,'BODY',WEAPONS.SHOTGUN,player,68131);
    for(let i=0;i<10&&!corpses.length;i++){frameCount++;updateBullets();}window.c=corpses[0];`);
  ok(type+' native close shotgun chooses intact body outcome7',P('corpses.length===1&&e.dead&&c.dT===7&&!!c.fall&&!!c.rag&&c.isIntactBody'));
  angleNear(P('c.fall.a'),heading,'shotgun fall follows '+(moving?'recorded movement':'the incoming shot'));
  ok('native fall keeps its actual front/back classification',P('c.fall.faceDown')===back);
}
function advance(frames){probe(`for(let i=0;i<${frames};i++){frameCount++;c.update();}`);}
function verifyPose(age){
  paint();
  ok('all four limbs use the current projected fall painter',limbs.length===4&&[0,1,2,3].every(i=>limbs.some(l=>l.i===i)));
  const rig=P('corpseFallRig(c)'),back=P('c.fall.faceDown'),f=P('c.fP');
  near(bodies[0].TL,rig.TL,'current torso length');near(bodies[0].TW,rig.TW,'current torso width');
  ok('head and uniform agree with actual fall side',bodies[0].back===back&&heads[0].faceDown===back);
  angleNear(Math.atan2(bodies[0].matrix[1],bodies[0].matrix[0]),P('figureFallYaw(c.fall,c.rag)'),'painted torso follows current fall yaw');
  if(age===0){
    near(bodies[0].TL*P('RAG_SCALE'),P('e.bodyW*TORSO_DEPTH'),'collapse starts at living torso length');
    near(bodies[0].TW*P('RAG_SCALE'),P('e.bodyH'),'collapse starts at living torso width');
    near(Math.hypot(heads[0].matrix[0],heads[0].matrix[1]),1,'collapse starts at living head scale');
  }
  if(f===1)ok('settled sleeves, forearms and palms retain current human proportions',
    bones.filter(b=>b.i<2).every(b=>b.width<8&&(b.tip===undefined||b.tip<8)));
  for(const id of [201,202,203]){
    const painted=marks.filter(p=>p.id===id),point=P(`fatalWoundPoint(c,c.dec.find(d=>d.col&&d.col[2]===${id}))`);
    ok('one painted body/head/leg wound survives its native attachment '+id,painted.length===1&&!!point);
    near(painted[0].x,point.x,'attached wound X '+id);near(painted[0].y,point.y,'attached wound Y '+id);
  }
  ok('the original floor pool remains gradual',pools.length===1&&(age===0?pools[0].w===0&&pools[0].alpha===0:age>=400?pools[0].w>0&&pools[0].alpha>200:true));
}

for(const type of ['NORMAL','NM0_ROOKIE','ARMORED_STANDARD','FEMALE_PISTOL'])
  for(const shot of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const moving of [false,true])for(const back of [false,true]){
    kill(type,shot,moving,back);verifyPose(0);advance(4);verifyPose(4);advance(76);verifyPose(80);advance(320);verifyPose(400);
    const frozen=P('JSON.stringify({x:c.x,y:c.y,fall:c.fall,rag:c.rag,pool:c.poolAge,f:c.fP})');advance(60);
    ok('settled shotgun body and joints stay frozen',frozen===P('JSON.stringify({x:c.x,y:c.y,fall:c.fall,rag:c.rag,pool:c.poolAge,f:c.fP})'));
  }

// A surviving seated injury can receive a low body overkill. The corpse must
// start from those planted joints instead of briefly rebuilding a standing man.
probe(`frameCount++;e.dead=false;e.hp=1000;e.x=80;e.y=0;e.aimAngle=e.moveAngle=0;
  e.fallHit=null;e.legInjuryCooldownMs=0;resetActorStance(e);rememberFigureMotion(e,0,0);
  legInjurySerial=1;beginLegInjury(e,{a:0},1);
  for(let left=e.legInjury.fallMs+LEG_INJURY_SUPINE_MS+LEG_INJURY_SIT_UP_MS;left>1e-7;){
    const step=Math.min(left,100);frameCount++;updateLegInjuryActor(e,step);left-=step;}
  window.seatedShotSnapshot=snapshotLegInjuryBody(e,PI);e.hp=1;corpses=[];bullets=[];enemiesList=[e];bodyOverkillCounter=1;
  spawnBullet(e.x-80,e.y,0,true,'LEGS',WEAPONS.SHOTGUN,player,68132);
  for(let i=0;i<10&&!corpses.length;i++){frameCount++;updateBullets();}c=corpses[0];`);
ok('native seated low-shot overkill preserves the downed handoff',P("c.dT===7&&c.injuryFrom&&c.injuryFrom.phase==='SEATED'&&c.injuryFrom.outcome==='SEATED'"));
paint();
const seated=P('seatedShotSnapshot'),seatedScale=seated.size/P('RAG_SCALE');
near(bodies[0].TL*P('RAG_SCALE'),seated.torsoLength*seated.size,'seated torso starts at its actual downed length');
near(bodies[0].TW*P('RAG_SCALE'),seated.torsoWidth*seated.size,'seated torso starts at its actual downed width');
for(let i=0;i<4;i++){
  const pair=bones.filter(b=>b.i===i),j=seated.joints[i%2],start=i<2?j.shoulder:j.hip,middle=i<2?j.elbow:j.knee,end=i<2?j.wrist:j.ankle;
  near(pair[0].x,start.x*seatedScale,'downed joint root X '+i);near(pair[0].y,start.y*seatedScale,'downed joint root Y '+i);
  near(pair[0].nx,middle.x*seatedScale,'downed hinge X '+i);near(pair[0].ny,middle.y*seatedScale,'downed hinge Y '+i);
  near(pair[1].nx,end.x*seatedScale,'downed hand/foot X '+i);near(pair[1].ny,end.y*seatedScale,'downed hand/foot Y '+i);
}
for(const id of [201,202,203]){
  const mark=marks.find(p=>p.id===id),point=P(`fatalWoundPoint(c,c.dec.find(d=>d.col&&d.col[2]===${id}))`);
  near(mark.x,point.x,'seated handoff wound X '+id);near(mark.y,point.y,'seated handoff wound Y '+id);
}

// A permanent blood-bank stamp uses the same current anatomy and material
// frames, including the smaller sleeves and attached leg/head wounds.
ctx.createGraphics=(w,h)=>{const g=mkG();g.width=w;g.height=h;
  for(const key of ['push','pop','translate','rotate','scale','fill','ellipse'])g[key]=ctx[key];return g;};
kill('ARMORED_STANDARD',.7,true,true);advance(400);paint();
const liveBody=bodies[0],liveLimbs=limbs.map(l=>({i:l.i,TL:l.rig.TL,TW:l.rig.TW}));
probe('wipeAllBloodBanks();useBloodBank("shotgun-face-down-test");');paint(true);
ok('stamping paints the same current torso and actual fall side',bodies.length>0&&bodies.every(b=>b.TL===liveBody.TL&&b.TW===liveBody.TW&&b.back===liveBody.back));
ok('stamping retains all four current limbs for each painted copy',limbs.length===bodies.length*4&&limbs.every(l=>liveLimbs.some(v=>v.i===l.i&&v.TL===l.rig.TL&&v.TW===l.rig.TW)));
ok('stamping keeps all three anatomical wound attachments',marks.length===bodies.length*3);
for(const [key,fn]of Object.entries(original))ctx[key]=fn;
console.log(`${checks}/${checks} native shotgun outcome7 direction, current anatomy, wounds, frozen settling and live/stamped painter checks passed.`);

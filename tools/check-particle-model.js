// The particle rifle is a real two-handed solid in every live pose. Its model,
// light and cover muzzle must agree, and drawing must never advance its heat.
const assert=require('assert');
const {ctx,probe,mkG}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const check=(value,label)=>{assert(value,label);checks++;};
probe(`isStoryMode=false;townsData={};startAtLevel(2);started=doTick=true;
 isPaused=isDead=isWin=killcamMode=false;BIOME_ACTIVE=false;
 inStoryIntro=inStoryRoom=inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=inDarchonCall=false;
 buildings=activeBuildings=[];activeParkingCars=[];barrels=[];enemiesList=[];invalidateColIndex();
 player=new Character(5000,5000,true);player.forceNudge=()=>{};
 player.currentWeapon=WEAPONS.PARTICLE_BEAM;player.isArmed=true;player.ammo=100;
 player.reloadTimer=player.meleeTimer=player.dashTimer=player.throwAnimTimer=0;
 player.fireTimer=player.weaponKick=player.muzzleFlash=0;
 setMeleeTool('NONE');chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=isCooking=false;
 leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};
 rightStick={active:true,dx:1,dy:0,dist:.5,base:{x:0,y:0}};
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;elevRenderScale=()=>1;`);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function trace(source){
  const methods=['push','pop','translate','rotate','scale','drawLongGunSolid','handGunBox','longGunMuzzle','figureCelOval','drawParticleBeamFlash'];
  const old=Object.fromEntries(methods.map(k=>[k,ctx[k]])),stack=[],guns=[],palms=[],flashes=[];
  let m=[1,0,0,1,0,0],gun=null;
  const point=(x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
  ctx.push=()=>stack.push(m.slice());ctx.pop=()=>{assert(stack.length,'unbalanced particle model pop');m=stack.pop();};
  ctx.translate=(x,y)=>{const p=point(x,y);m[4]=p[0];m[5]=p[1];};
  ctx.rotate=a=>{const co=Math.cos(a),si=Math.sin(a),[a0,a1,a2,a3]=m;
    m[0]=a0*co+a2*si;m[1]=a1*co+a3*si;m[2]=a2*co-a0*si;m[3]=a3*co-a1*si;};
  ctx.scale=(x,y=x)=>{m[0]*=x;m[1]*=x;m[2]*=y;m[3]*=y;};
  ctx.drawLongGunSolid=function(w,p,kick,pump){
    const record={weapon:w,view:p.view.slice(),rear:point(...p.point(0,0,0)),boxes:[]};
    guns.push(record);const previous=gun;gun=record;
    try{return old.drawLongGunSolid(...arguments);}finally{gun=previous;}
  };
  ctx.handGunBox=function(p,x0,x1,y0,y1,z0,z1,r,g,b){
    if(gun)gun.boxes.push({bounds:[x0,x1,y0,y1,z0,z1],rgb:[r,g,b]});
    return old.handGunBox(...arguments);
  };
  ctx.longGunMuzzle=function(p,x){if(gun)gun.muzzle=point(...p.point(x,0,0));return old.longGunMuzzle(...arguments);};
  ctx.figureCelOval=function(g,x,y,w,h){if(w===h&&w>=6&&w<=8.1)palms.push(point(x,y));return old.figureCelOval(...arguments);};
  ctx.drawParticleBeamFlash=function(g,x,y){flashes.push(point(x,y));return old.drawParticleBeamFlash(...arguments);};
  try{probe(source);}finally{Object.assign(ctx,old);}
  return {guns,palms,flashes,balanced:stack.length===0};
}
check(P('weaponHands(WEAPONS.PARTICLE_BEAM)===2&&solidLongGun(WEAPONS.PARTICLE_BEAM)'), 'particle rifle must use both authored grips');
check(JSON.stringify(P('coverWeaponMuzzles(player)'))==='[[47,6]]','cover rays use the rifle muzzle');
check(JSON.stringify(P('WEAPON_MUZZLE.PARTICLE_BEAM'))==='[47,6]','torch muzzle agrees with native rifle fire');
let poses=0;
for(const stance of ['STAND','CROUCH','PRONE'])for(let direction=0;direction<8;direction++)for(const hot of [false,true]) {
  const angle=direction*Math.PI/4;
  probe(`resetActorStance(player,'${stance}');player.aimAngle=player.moveAngle=${angle};
    player.isMoving=false;player.aimHold=14;rightStick.active=true;
    player.particleBeamState={shots:${hot?60:0},heat:${hot?1:0},venting:${hot},ventTicks:${hot?24:0}};
    player.muzzleFlash=3;player.weaponKick=0;player.fireTimer=0;`);
  const before=P('JSON.stringify([player.particleBeamState,player.ammo,player.weaponKick,player.fireTimer,player.muzzleFlash])');
  const result=trace('player.show();'),gun=result.guns[0];poses++;
  check(result.balanced&&result.guns.length===1&&gun.boxes.length>=22,'one complete balanced rifle solid in '+stance+' heading '+direction);
  const expected=P(`(()=>{const a=player.aimAngle;return stanceMuzzleWorld(player,
    player.x+Math.cos(a)*47-Math.sin(a)*6,player.y+Math.sin(a)*47+Math.cos(a)*6);})()`);
  check(distance(gun.muzzle,[expected.x,expected.y])<1e-6,'visible muzzle drifts from native '+stance+' heading '+direction);
  check(result.flashes.length===1&&distance(result.flashes[0],gun.muzzle)<1e-6,'blue flash must leave the real barrel');
  check(gun.boxes.every(b=>b.bounds.every(Number.isFinite)),'nonfinite particle geometry');
  const chambers=gun.boxes.filter(b=>b.rgb[0]===(hot?255:228)&&b.rgb[1]===(hot?178:113)&&b.bounds[1]-b.bounds[0]>10);
  check(chambers.length===2,'both orange side chambers must remain part of the solid');
  check((chambers[1].bounds[2]-chambers[0].bounds[2])*gun.view[1]>=-1e-8,'far chamber must draw before the near chamber');
  check(P('JSON.stringify([player.particleBeamState,player.ammo,player.weaponKick,player.fireTimer,player.muzzleFlash])')===before,'paint advanced a heat or firing timer');
}
for(let direction=0;direction<8;direction++) {
  probe(`resetActorStance(player,'STAND');player.aimAngle=player.moveAngle=${direction*Math.PI/4};
    player.muzzleFlash=0;rightStick.active=false;player.aimHold=0;player.isMoving=true;player.gait=.7;player.walkCycle=1.3;`);
  const result=trace('player.show();'),gun=result.guns[0];
  check(result.balanced&&result.guns.length===1&&result.palms.length===2,'carried particle rifle retains two hands');
  check(result.palms.some(p=>distance(p,gun.rear)<1e-6),'carried stock grip drifts away from its palm');
}
// Native firing kicks the receiver while the actual emitter remains pinned.
for(const stance of ['STAND','CROUCH','PRONE'])for(let direction=0;direction<8;direction++) {
  probe(`resetActorStance(player,'${stance}');player.cover=null;player.aimAngle=player.moveAngle=${direction*Math.PI/4};
    player.isMoving=false;rightStick.active=true;player.aimHold=14;
    player.ammo=100;player.reloadTimer=player.fireTimer=player.weaponKick=player.muzzleFlash=0;bullets=[];`);
  const drawn=trace('player.fire(player.aimAngle);player.show();'),bullet=P('bullets[0]');
  check(!!bullet&&drawn.guns.length===1&&P('player.ammo')===99,'native particle shot must use its real model path');
  check(distance(drawn.guns[0].muzzle,[bullet.startX,bullet.startY])<1e-6,'fired beam starts outside its visible muzzle');
}
for(const kind of ['HIGH','LOW'])for(let direction=0;direction<8;direction++)for(const ducked of [false,true]) {
  const heading=direction*Math.PI/4;
  probe(`resetActorStance(player,'STAND');player.aimAngle=player.moveAngle=${heading};player.isMoving=false;
    player.weaponKick=player.fireTimer=player.muzzleFlash=0;rightStick.active=true;player.aimHold=14;
    player.cover={active:true,kind:'${kind}',blend:1,pop:${ducked?0:1},peek:1,validPeek:true,openAim:false,aiming:true,
      nx:Math.cos(${heading}),ny:Math.sin(${heading}),bodyAngle:${heading},offsetX:13,offsetY:-9,upper:{x:13,y:-9}};`);
  const drawn=trace('player.show();'),gun=drawn.guns[0];
  const expected=P(`(()=>{const a=player.aimAngle;return stanceMuzzleWorld(player,
    player.x+Math.cos(a)*47-Math.sin(a)*6,player.y+Math.sin(a)*47+Math.cos(a)*6);})()`);
  check(drawn.balanced&&drawn.guns.length===1&&distance(gun.muzzle,[expected.x,expected.y])<1e-6,
    kind+' cover offsets detached the particle barrel at heading '+direction);
}
// A stamped corpse passes a graphics target. None of its weapon's faces may
// escape onto the live canvas when that target owns the draw.
const buffer=mkG(),nativeQuad=ctx.quad;let bufferFaces=0,escapedFaces=0;
buffer.quad=(...values)=>{assert(values.every(Number.isFinite));bufferFaces++;};
ctx.quad=()=>escapedFaces++;ctx.__particleDropTarget=buffer;
try{probe('drawParticleBeamDrop(__particleDropTarget,.82,.7);');}
finally{ctx.quad=nativeQuad;}
check(bufferFaces>60&&escapedFaces===0,'corpse weapon faces escaped their graphics target');
console.log(`Particle model: ${checks} checks across ${poses} aim/heat poses, eight carry headings, 24 native shots and 32 cover poses; solid chambers, muzzle/flash alignment, pure heat paint and corpse-buffer isolation.`);

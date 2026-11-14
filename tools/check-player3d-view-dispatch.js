// The renderer's browser tests cover perspective pixels. Exercise the real
// living dispatch and Canvas attachments at an off-center camera position.
const assert=require('node:assert/strict');
const {ctx,probe,mkG}=require('./harness');
const P=s=>probe('('+s+')');let checks=0;
const check=(value,label)=>{assert.ok(value,label);checks++;};
const near=(a,b)=>Math.abs(a-b)<1e-6;
const closePoint=(a,b)=>near(a[0],b.x)&&near(a[1],b.y);
ctx.drawingContext.canvas={width:800,height:600};
ctx.drawingContext.getTransform=()=>({a:1,b:0,c:0,d:1,e:650,f:430});
probe(`isStoryMode=false;townsData={};startAtLevel(2);started=doTick=true;
 isDead=isWin=isPaused=false;setMeleeTool('NONE');swordPickedUp=false;frameCount=200;
 leftStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
 rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
 explosiveArmorUnlocked=chemistSuitUnlocked=ninjaSuitUnlocked=cowboySuitEquipped=jetpackUnlocked=false;
 player.x=30;player.y=40;player.isArmed=true;player.isMoving=false;
 player.aimAngle=.4;player.moveAngle=1.1;player.currentWeapon=WEAPONS.DUAL_SMG;
 player.reloadTimer=player.meleeTimer=player.muzzleFlash=0;resetActorStance(player,'STAND');
 window.__viewPasses=[];
 window.__installViewDraw=()=>{Player3D.draw=(snapshot,target,options)=>{
   const view=Player3DView.resolve(target,options,80);
   snapshot.renderView=view.enabled?view:null;
   snapshot.projectedSockets={};
   for(const [name,p]of Object.entries(snapshot.sockets))snapshot.projectedSockets[name]=Player3DView.project(p,view);
   __viewPasses.push({snapshot,target,options});return true;
 };};__installViewDraw();`);
const state=()=>P('JSON.stringify([player.x,player.y,player.aimAngle,player.moveAngle,player.isArmed,player.ammo,player.reloadTimer,player.meleeTimer,player.stance])');
const before=state(),keys=P('Object.keys(player).sort().join()');
check(P("player3DDrawActor(player,window,{mode:'NORMAL'})"),'normal living dispatch succeeds');
const first=ctx.__viewPasses.at(-1),snapshot=first.snapshot;
check(first.options.view===true&&snapshot.renderView.enabled,'actual main Canvas opts into the finite camera');
check(P('player3DLiveSnapshot(player)')===snapshot,'successful snapshot is available through the external cache');
check(state()===before&&P('Object.keys(player).sort().join()')===keys,'camera/cache writes do not change the actor or its facing');
check(snapshot.renderActorState.frame===200&&snapshot.renderActorState.weapon===P('player.currentWeapon')&&
 snapshot.renderActorState.isArmed&&snapshot.renderActorState.stance.prone===0,'launch cache carries frame, weapon and stance identity');
check(!near(snapshot.projectedSockets.muzzle.x,snapshot.sockets.muzzle.x),'off-center elevated muzzle actually projects away from native XY');

ctx.__viewOther=mkG();ctx.__viewOther.drawingContext.canvas={width:128,height:128};
ctx.__viewOther.drawingContext.getTransform=ctx.drawingContext.getTransform;
probe("player3DDrawActor(player,__viewOther,{mode:'NORMAL'});");
check(ctx.__viewPasses.at(-1).options.view===false&&P('player3DLiveSnapshot(player).renderView===null'),
 'alternate Graphics draws retain orthographic camera isolation');
for(const options of ["{mode:'QUICKDRAW'}","{mode:'NORMAL',view:false}"]){
 probe('player3DDrawActor(player,window,'+options+');');
 check(ctx.__viewPasses.at(-1).options.view===false,'explicit or staged orthographic draw stays isolated: '+options);
}
for(const draw of ['()=>false',"()=>{throw Error('lost view context');}"]){
 probe("__installViewDraw();player3DDrawActor(player,window,{mode:'NORMAL'});Player3D.draw="+draw+';');
 check(!P("player3DDrawActor(player,window,{mode:'NORMAL'})")&&P('player3DLiveSnapshot(player)===null'),
  'failed mesh draw discards its formerly successful attachment cache');
}
probe("__installViewDraw();player3DDrawActor(player,window,{mode:'NORMAL'});");

const project=(s,p)=>P('Player3DView').project(p,s.renderView,{});
const translations=[],rotations=[],lines=[],frames=[];
const original={translate:ctx.translate,rotate:ctx.rotate,line:ctx.line,transform:ctx.drawingContext.transform,
 trace:ctx.tracePlayerAimLaser,point:ctx.leftActionMuzzle};
ctx.translate=(...p)=>translations.push(p);ctx.rotate=a=>rotations.push(a);ctx.line=(...p)=>lines.push(p);
ctx.drawingContext.transform=(...p)=>frames.push(p);
const clear=()=>{translations.length=rotations.length=lines.length=frames.length=0;};
try{
 // Real dual-gun sockets, with the renderer's actual view; no fake muzzle
 // values are fed to the production effect painter.
 probe('player.muzzleFlash=3;rightStick.active=false;');clear();
 probe('drawPlayer3DWeaponEffects(player);');
 let s=P('player3DLiveSnapshot(player)');
 check(translations.some(p=>closePoint(p,project(s,s.sockets.muzzle)))&&
  translations.some(p=>closePoint(p,project(s,s.sockets.secondaryMuzzle))),
  'both firearm flashes attach to the actual projected barrel sockets');
 // A pitched barrel requires its projected XYZ endpoint, not the actor's
 // native planar aim angle, to orient the Canvas flash.
 const gun=s.parts.find(p=>p.part==='weapon_primary');gun.matrix[2]=Math.hypot(gun.matrix[0],gun.matrix[1])*.4;
 clear();probe('drawPlayer3DWeaponEffects(player);');
 const m=s.sockets.muzzle,a=project(s,m),b=project(s,{x:m.x+gun.matrix[0],y:m.y+gun.matrix[1],z:m.z+gun.matrix[2]});
 check(rotations.some(angle=>near(angle,Math.atan2(b.y-a.y,b.x-a.x))),
  'flash heading follows the projected barrel direction, including its height');

 ctx.tracePlayerAimLaser=()=>({startX:60,startY:45,x:330,y:140,distance:300,kind:'RANGE',zone:'BODY'});
 clear();probe('player.muzzleFlash=0;rightStick.active=true;drawPlayer3DWeaponEffects(player);');
 const scale=P('elevRenderScale(player.x,player.y)*shovelRenderScale(player)'),
 end=project(s,{x:(330-30)/scale,y:(140-40)/scale,z:s.sockets.muzzle.z});
 check(lines.some(p=>closePoint(p,project(s,s.sockets.muzzle))&&near(p[2],end.x)&&near(p[3],end.y)),
  'laser starts at the rendered gun and projects its traced endpoint at the same presentation height');
 ctx.tracePlayerAimLaser=()=>({startX:60,startY:45,x:330,y:140,distance:300,kind:'FLOOR',zone:'LEGS'});
 clear();probe('drawPlayer3DWeaponEffects(player);');
 const floor=project(s,{x:(330-30)/scale,y:(140-40)/scale,z:0});
 check(lines.some(p=>near(p[2],floor.x)&&near(p[3],floor.y)),'leg-shot laser terminates at its native ground contact');
 ctx.tracePlayerAimLaser=original.trace;probe('rightStick.active=false;');

 clear();probe('player.shieldBurstTimer=8;drawPlayer3DShield(player);');
 check(frames.some(p=>closePoint(p.slice(4),project(s,s.pose.chest))),
  'body shield uses the mesh chest projection while ground UI remains separate');

 probe(`chemistSuitUnlocked=true;player.cannonCharge=12;
  player3DDrawActor(player,window,{mode:'NORMAL'});`);
 s=P('player3DLiveSnapshot(player)');clear();probe('drawPlayer3DWeaponEffects(player);');
 check(translations.some(p=>closePoint(p,project(s,s.sockets.leftMuzzle))),
  'charged off-hand cannon follows its own projected muzzle socket');
 probe(`chemistSuitUnlocked=false;player.cannonCharge=0;player.isArmed=false;
  boxingEnter(player,[],'WORLD');player3DDrawActor(player,window,{mode:'BOXING'});
  window.viewBoxing=boxingPose(player);viewBoxing.parryFlash=1;viewBoxing.stunMs=40;`);
 s=P('player3DLiveSnapshot(player)');clear();probe('drawPlayer3DBoxingEffects(player,viewBoxing);');
 const arm=P('viewBoxing.arms.find(a=>a.guard)||viewBoxing.arms[0]');
 check(frames.some(p=>closePoint(p.slice(4),project(s,s.sockets[arm.side<0?'leftFist':'rightFist']))),
  'boxing parry feedback follows the projected fist');
 check(frames.some(p=>closePoint(p.slice(4),project(s,s.pose.head))),
  'boxing stun feedback follows the projected head');
 probe('boxingExit(player);');

 probe(`window.viewEnemy=new Character(130,140,false,'FEMALE_PISTOL');
  viewEnemy.isFriendly=viewEnemy.isNeutral=false;viewEnemy.isMoving=false;viewEnemy.aimAngle=.7;
  viewEnemy.reloadTimer=viewEnemy.meleeTimer=viewEnemy.muzzleFlash=0;resetActorStance(viewEnemy,'STAND');`);
 clear();check(P('drawEnemy3DLiving(viewEnemy)'),'ordinary human enemy uses the shared live view');
 s=P('player3DLiveSnapshot(viewEnemy)');const head=s.parts.find(p=>p.part==='head'),hm=head.matrix;
 const hp=project(s,{x:hm[12],y:hm[13],z:hm[14]}),hx=project(s,{x:hm[12]+hm[0]/5.5,y:hm[13]+hm[1]/5.5,z:hm[14]+hm[2]/5.5}),
 hy=project(s,{x:hm[12]+hm[4]/5.5,y:hm[13]+hm[5]/5.5,z:hm[14]+hm[6]/5.5});
 const expected=[hx.x-hp.x,hx.y-hp.y,hy.x-hp.x,hy.y-hp.y,hp.x,hp.y];
 check(frames.some(p=>p.every((n,i)=>near(n,expected[i]))),'female hair follows projected head center and both mesh basis derivatives');

 probe(`window.viewBottle=new Character(130,140,false,'MOLOTOV');
  viewBottle.isFriendly=viewBottle.isNeutral=false;viewBottle.aimAngle=.7;
  viewBottle.reloadTimer=viewBottle.meleeTimer=0;resetActorStance(viewBottle,'STAND');`);
 clear();check(P('drawEnemy3DLiving(viewBottle)'),'Molotov human uses the shared live view');
 s=P('player3DLiveSnapshot(viewBottle)');
 check(translations.some(p=>closePoint(p,project(s,s.sockets.molotovWick))),
  'bottle flame follows its elevated projected wick');
}finally{
 ctx.translate=original.translate;ctx.rotate=original.rotate;ctx.line=original.line;
 ctx.drawingContext.transform=original.transform;ctx.tracePlayerAimLaser=original.trace;
}
console.log(checks+' living view isolation, cache, fallback and Canvas attachment checks passed');

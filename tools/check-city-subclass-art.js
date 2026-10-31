// Exercise native Character/corpse painters. Actions must keep a prop on the
// resolved wrist in every heading, without changing simulation or passive art.
const assert=require('assert'),{ctx,probe,calls}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
function ok(label,value){assert(value,label);checks++;console.log('  ok '+label);}
function trace(draw){
 const names=['push','pop','translate','rotate','scale','figureCelOval','figureCelLimb','drawCityStreetHeld','carryHandGun'];
 const undo={};for(const n of names)undo[n]=ctx[n];
 let m=[1,0,0,1,0,0],underflow=0;
 const stack=[],palms=[],limbs=[],props=[],guns=[];
 const pt=(x,y)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
 const mul=u=>{const t=m;m=[t[0]*u[0]+t[2]*u[1],t[1]*u[0]+t[3]*u[1],t[0]*u[2]+t[2]*u[3],t[1]*u[2]+t[3]*u[3],t[0]*u[4]+t[2]*u[5]+t[4],t[1]*u[4]+t[3]*u[5]+t[5]];};
 ctx.push=()=>stack.push(m.slice());ctx.pop=()=>{if(stack.length)m=stack.pop();else underflow++;};
 ctx.translate=(x,y)=>mul([1,0,0,1,x,y]);
 ctx.rotate=a=>mul([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);
 ctx.scale=(x,y=x)=>mul([x,0,0,y,0,0]);
 ctx.figureCelOval=(g,x,y,w,h,c,...a)=>{palms.push({p:pt(x,y),w,h,color:c&&c.levels?Array.from(c.levels):c});return undo.figureCelOval(g,x,y,w,h,c,...a);};
 ctx.figureCelLimb=(g,sx,sy,ex,ey,hx,hy,...a)=>{limbs.push({s:pt(sx,sy),e:pt(ex,ey),h:pt(hx,hy),args:a});return undo.figureCelLimb(g,sx,sy,ex,ey,hx,hy,...a);};
 ctx.drawCityStreetHeld=(g,e,p,h)=>{props.push({p:pt(h.x,h.y),kind:p.kind});return undo.drawCityStreetHeld(g,e,p,h);};
 ctx.carryHandGun=function(){guns.push(pt(0,0));return undo.carryHandGun.apply(this,arguments);};
 try{probe(draw);}finally{Object.assign(ctx,undo);}
 return {palms,limbs,props,guns,depth:stack.length,underflow};
}
probe(`isStoryMode=false;townsData={};startAtLevel(1);started=true;doTick=true;
 viewLeft=viewTop=-1e6;viewRight=viewBottom=1e6;
 buildings=[];activeBuildings=[];barrels=[];activeParkingCars=[];enemiesList=[];invalidateColIndex();
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 swordPickedUp=false;setMeleeTool('NONE');jetpackUnlocked=false;explosiveArmorUnlocked=false;
 chemistSuitUnlocked=false;ninjaSuitUnlocked=false;cowboySuitEquipped=false;
 window.subject=new Character(0,0,false,'CITY_NEUTRAL_M');player.x=300;player.y=300;`);
const same=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<1e-7;
let poses=0,finite=true,balanced=true,grips=true,oneProp=true,stable=true;
for(const kind of ['PHONE','SMOKE','BOTTLE'])for(const [phase,progress] of [['REACH',.25],['REACH',.75],['USE',.45],['LOWER',.25],['LOWER',.8]]){
 for(let heading=0;heading<8;heading++)for(const moving of [false,true]){
  probe(`subject=new Character(0,0,false,'CITY_NEUTRAL_M');cityAppearance(subject,181);
   subject.aimAngle=subject.moveAngle=${heading*Math.PI/4};subject.isMoving=${moving};subject.gait=.25;subject.walkCycle=1.2;
   subject.cityActivity={kind:'${kind}',phase:'${phase}',timeMs:${progress*1000},durationMs:1000,cycle:0};`);
  const state=P('JSON.stringify([subject.x,subject.y,subject.hp,subject.ammo,subject.gait,subject.cityActivity,subject.panicTimer,subject.stunTimer])');
  const r=trace('subject.show();');poses++;
  finite&&=r.palms.every(v=>[v.p.x,v.p.y,v.w,v.h].every(Number.isFinite))&&r.limbs.every(l=>[l.s.x,l.s.y,l.e.x,l.e.y,l.h.x,l.h.y].every(Number.isFinite));
  balanced&&=r.depth===0&&r.underflow===0;
  oneProp&&=r.props.length===1&&r.props[0].kind===kind;
  grips&&=r.props.length===1&&r.palms.some(h=>h.w>7&&h.w===h.h&&same(h.p,r.props[0].p))&&r.limbs.some(l=>same(l.h,r.props[0].p));
  stable&&=state===P('JSON.stringify([subject.x,subject.y,subject.hp,subject.ammo,subject.gait,subject.cityActivity,subject.panicTimer,subject.stunTimer])');
 }
}
ok(poses+' reach/use/lower poses keep exactly one correct prop',oneProp);
ok('every prop is anchored to the actual palm and connected forearm in all 8 headings',grips);
ok('idle and walking actions have finite anatomy and balanced transforms',finite&&balanced);
ok('painting cannot advance action clocks, gait, health, ammo or movement',stable);
for(const condition of ['subject.panicTimer=20','subject.stunTimer=20;startPunchStun(subject,0)','subject.dead=true','subject.hp=0','subject.cityStreetFight=true']){
 probe(`subject=new Character(0,0,false,'CITY_NEUTRAL_M');subject.cityActivity={kind:'PHONE',phase:'USE',timeMs:500,durationMs:1000};${condition};`);
 ok(condition+' suppresses the idle activity',P('cityActivityPose(subject)===null'));
}
probe(`subject=new Character(0,0,false,'CITY_NEUTRAL_M');subject.cityActivity={kind:'PHONE',phase:'USE',timeMs:500,durationMs:1000};boxingEnter(subject,[],'WORLD');`);
const fighter=trace('subject.show();');
ok('a boxing resident drops the activity and preserves the native two fist rig',!fighter.props.length&&fighter.palms.filter(q=>q.w===P('BOXING.FIST_RADIUS*2')&&q.h===q.w).length===2);
let drawnGun=true;
for(let i=0;i<8;i++){
 probe(`subject=new Character(0,0,false,'CITY_THUG_M');subject.cityThugGunDrawn=true;subject.isArmed=true;subject.isUnarmed=false;
  subject.aimAngle=subject.moveAngle=${i*Math.PI/4};subject.currentWeapon=WEAPONS.PISTOL;
  subject.cityActivity={kind:'SMOKE',phase:'USE',timeMs:500,durationMs:1000};`);
 const r=trace('subject.show();');
 drawnGun&&=r.guns.length===1&&!r.props.length&&r.depth===0&&r.underflow===0&&r.palms.some(p=>p.w===8&&p.h===8&&same(p.p,r.guns[0]));
}
ok('an armed thug holds exactly one real native pistol on its resolved wrist in all 8 headings',drawnGun);
const bare=trace(`subject.clothingStyle=1;drawCityStreetUpperArm(window,subject,0,0,5,2,10,1,7,6,5,subject.skinCol);`);
const shirt=trace(`subject.clothingStyle=0;drawCityStreetUpperArm(window,subject,0,0,5,2,10,1,7,6,5,subject.skinCol);`);
ok('cut-off sleeves use one continuous exposed skin surface',bare.limbs.length===1&&JSON.stringify(bare.limbs[0].args[3])===JSON.stringify(P('subject.skinCol')));
ok('T-shirt sleeve ends on the upper arm, leaving the elbow and forearm bare',shirt.limbs.length===2&&shirt.limbs[1].h.x>0&&shirt.limbs[1].h.x<shirt.limbs[0].e.x);
const skins=new Set(),styles=new Set(),lengths=new Set(),colors=new Set(),cuts=new Set();
for(let i=0;i<160;i++){
 probe(`subject=new Character(0,0,false,'CITY_NEUTRAL_M');cityAppearance(subject,${i+1});`);
 skins.add(P('subject.skinCol.levels.join(",")'));styles.add(P('subject.hairStyle'));lengths.add(P('subject.cityHairLength'));colors.add(P('subject.hairCol.levels.join(",")'));cuts.add(P('subject.clothingStyle'));
}
ok('seeded neutral population spans 7 skin tones, 7 styles, 3 lengths, 5 hair colors and both shirt cuts',skins.size===7&&styles.size===7&&lengths.size===3&&colors.size===5&&cuts.size===2);
for(const type of ['CITY_NEUTRAL_M','CITY_THUG_M']){
 probe(`subject=new Character(0,0,false,'${type}');cityAppearance(subject,199);window.identity=figureIdentity(subject);`);
 ok(type+' corpse identity keeps skin, hair length/color, shirt cut, subclass and gang accent',P('identity.skinCol===subject.skinCol&&identity.hairCol===subject.hairCol&&identity.cityHairLength===subject.cityHairLength&&identity.clothingStyle===subject.clothingStyle&&identity.cityClass===subject.cityClass&&identity.cityAccentCol===subject.cityAccentCol'));
 probe(`window.body=new Corpse(0,0,0,0,subject.shirtCol,subject.pantsCol,0,0,[],subject.currentWeapon,0,subject.eType,subject.bodyW,subject.bodyH,subject);finishFigureFall(body);`);
 const corpse=trace('body.paint(window);');
 ok(type+' fallen model retains finite surfaces and balanced transforms',corpse.limbs.length>0&&corpse.depth===0&&corpse.underflow===0&&corpse.palms.every(v=>[v.p.x,v.p.y,v.w,v.h].every(Number.isFinite)));
}
probe(`subject=new Character(0,0,false,'CITY_THUG_M');`);
ok('thugs retain the requested tan skin and purple/yellow palette',P('subject.skinCol.levels.slice(0,3).join(",")==="194,143,95"&&subject.shirtCol.levels.slice(0,3).join(",")==="105,56,151"&&subject.cityAccentCol.levels.slice(0,3).join(",")==="244,197,54"'));
// Adding inactive metadata cannot repaint the old civilians. Compare actual
// traced primitives rather than only checking the subclass dispatch string.
for(const type of ['CITY_CITIZEN_M','CITY_CITIZEN_F']){
 probe(`subject=new Character(0,0,false,'${type}');cityAppearance(subject,181);subject.aimAngle=.7;subject.isMoving=true;subject.gait=.22;subject.walkCycle=1.2;subject.cityClass=undefined;`);
 calls.sig=0;const a=trace('subject.show();'),sig=calls.sig;
 probe('subject.cityClass="PASSIVE";subject.cityHairLength=2;subject.cityActivity={kind:"PHONE",phase:"USE",timeMs:500,durationMs:1000};');
 calls.sig=0;const b=trace('subject.show();');
 ok(type+' passive geometry remains identical with new metadata present',JSON.stringify(a)===JSON.stringify(b)&&sig===calls.sig);
}
console.log(checks+' city subclass art checks passed.');

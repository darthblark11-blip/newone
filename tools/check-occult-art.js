// Native cel painters: every staff/book must remain on its fitted wrist, spell
// preparation may change the pose but never the actor's simulation state, and
// fallen bodies keep the same hooded gold-trimmed identity.
const assert=require('assert/strict');
const {ctx,probe:P}=require('./harness');
let checks=0,poses=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
P(`currentLevel=9;currentBiome=1;started=doTick=true;BIOME_ACTIVE=false;
 isPaused=isDead=isWin=killcamMode=false;
 var occultArtSubject=new Character(0,0,false,'OCCULT_BLACK');
 occultArtSubject.bodyW=24;occultArtSubject.bodyH=30;occultArtSubject.skinCol=color(179,159,139);
 LIGHT_DX=.3;LIGHT_DY=.7;`);
const names=['push','pop','translate','rotate','scale','fill','stroke','strokeWeight','ellipse','line','rect',
 'triangle','quad','vertex','bezier','bezierVertex','arc','drawOccultStaff','drawOccultBook','figureCelOval'];
const saved=Object.fromEntries(names.map(n=>[n,ctx[n]]));
let stack=[],matrix=[1,0,0,1,0,0],underflow=0,finite=true,props=[],hands=[];
const point=(x,y)=>({x:matrix[0]*x+matrix[2]*y+matrix[4],y:matrix[1]*x+matrix[3]*y+matrix[5]});
const mul=u=>{const m=matrix;matrix=[m[0]*u[0]+m[2]*u[1],m[1]*u[0]+m[3]*u[1],m[0]*u[2]+m[2]*u[3],m[1]*u[2]+m[3]*u[3],m[0]*u[4]+m[2]*u[5]+m[4],m[1]*u[4]+m[3]*u[5]+m[5]];};
function resetTrace(){stack=[];matrix=[1,0,0,1,0,0];underflow=0;finite=true;props=[];hands=[];}
ctx.push=()=>stack.push(matrix.slice());ctx.pop=()=>{if(stack.length)matrix=stack.pop();else underflow++;};
ctx.translate=(x,y)=>mul([1,0,0,1,x,y]);ctx.rotate=a=>mul([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);
ctx.scale=(x,y=x)=>mul([x,0,0,y,0,0]);
for(const name of names.filter(n=>!['push','pop','translate','rotate','scale','drawOccultStaff','drawOccultBook','figureCelOval'].includes(n)))
 ctx[name]=(...args)=>{finite&&=args.every(v=>typeof v!=='number'||Number.isFinite(v));return saved[name](...args);};
ctx.drawOccultStaff=(...a)=>{props.push({kind:'STAFF',point:point(0,0)});return saved.drawOccultStaff(...a);};
ctx.drawOccultBook=(...a)=>{props.push({kind:'BOOK',point:point(0,0)});return saved.drawOccultBook(...a);};
ctx.figureCelOval=(g,x,y,w,h,c,...args)=>{hands.push({point:point(x,y),w,h});return saved.figureCelOval(g,x,y,w,h,c,...args);};
let fitted=true,balanced=true,stable=true,anchored=true,single=true;
try{
 for(const kind of ['BLACK','RED','BLUE'])for(const phase of ['IDLE','CHARGE','CAST','RECOVER'])
 for(const progress of [0,.25,.65,1])for(const angle of [0,.7,Math.PI/2,Math.PI,Math.PI*1.5])for(const moving of [false,true]){
  P(`occultArtSubject.eType='OCCULT_${kind}';occultArtSubject.occultKind='${kind}';
   occultArtSubject.occult={kind:'${kind}',phase:'${phase}',cast:'SHARD',spell:'SHARD',
    chargeMs:${progress*1000},chargeDurationMs:1000,elapsedMs:${progress*1000},durationMs:1000};
   occultArtSubject.aimAngle=${angle};occultArtSubject.isMoving=${moving};occultArtSubject.walkCycle=1.4;`);
  const snapshot=P('JSON.stringify(occultArtSubject)'),pose=P('occultFigurePose(occultArtSubject)'),rig=P('figureRig(24,30)');
  for(const arm of [pose.left,pose.right])fitted&&=Object.values(arm).every(Number.isFinite)&&
   Math.hypot(arm.ex-arm.sx,arm.ey-arm.sy)<=rig.upper+1e-6&&Math.hypot(arm.hx-arm.ex,arm.hy-arm.ey)<=rig.fore+1e-6;
  resetTrace();P('drawOccultMagician(occultArtSubject);');poses++;
  balanced&&=stack.length===0&&underflow===0&&finite;
  single&&=props.length===2&&props.filter(p=>p.kind==='STAFF').length===1&&props.filter(p=>p.kind==='BOOK').length===1;
  anchored&&=props.every(p=>hands.some(h=>Math.hypot(h.point.x-p.point.x,h.point.y-p.point.y)<1e-6));
  stable&&=snapshot===P('JSON.stringify(occultArtSubject)');
 }
 ok('All '+poses+' idle/walking/casting/recovery poses have fitted native arm lengths',fitted);
 ok('Each magician carries exactly one staff and one open book',single);
 ok('Every book and staff is anchored to its cel shaded palm in all headings',anchored);
 ok('All cel geometry is finite and restores every graphics transform',balanced);
 ok('Rendering never advances charge clocks, movement, health or weapon state',stable);
 const oldRandom=ctx.random;ctx.random=()=>{throw Error('Art consumed gameplay random');};
 try{P('drawOccultMagician(occultArtSubject);');ok('Cloak, book and spell ornament never consume gameplay randomness',true);}finally{ctx.random=oldRandom;}
 P("occultArtSubject.occult.phase='IDLE';var idleOccultPose=occultFigurePose(occultArtSubject);occultArtSubject.occult.phase='CAST';occultArtSubject.occult.elapsedMs=occultArtSubject.occult.chargeMs=1000;var chargedOccultPose=occultFigurePose(occultArtSubject);");
 ok('Charge visibly raises and points the staff while presenting the book',P('chargedOccultPose.right.hx>idleOccultPose.right.hx&&chargedOccultPose.left.hy<idleOccultPose.left.hy&&chargedOccultPose.staffAngle<idleOccultPose.staffAngle'));
 const colors=['BLACK','RED','BLUE'].map(kind=>P('OCCULT_ART_PALETTES.'+kind+'.cloth.join(",")'));
 ok('Black, red and blue robes keep distinct primary cloth colors',new Set(colors).size===3);
 for(const kind of ['BLACK','RED','BLUE'])for(const back of [false,true])for(const half of [-1,0,1]){
  resetTrace();const handled=P(`drawOccultFallenAttire(window,{eType:'OCCULT_${kind}'},30,20,${back},.7,${half});`);
  assert.equal(handled,true);assert.equal(stack.length,0);assert.equal(underflow,0);assert(finite);
 }
 checks++;
 ok('Ordinary native corpses are not repainted as occult robes',P("drawOccultFallenAttire(window,{eType:'NORMAL'},30,20,false)===false"));
 for(const kind of ['BLACK','RED','BLUE']){
  resetTrace();P(`drawOccultHood(window,{eType:'OCCULT_${kind}'},1,0,.5);`);
  assert.equal(stack.length,0);assert.equal(underflow,0);assert(finite);
 }
 checks++;
 let zombies=true;
 for(const moving of [false,true])for(const windup of [0,200,420])for(const angle of [0,.8,Math.PI]){
  P(`occultArtSubject.eType='OCCULT_ZOMBIE';occultArtSubject.aimAngle=${angle};occultArtSubject.isMoving=${moving};occultArtSubject.occultZombie={windupMs:${windup},windupDurationMs:420};`);
  const before=P('JSON.stringify(occultArtSubject)');resetTrace();P('drawOccultZombie(occultArtSubject);');
  zombies&&=finite&&stack.length===0&&underflow===0&&before===P('JSON.stringify(occultArtSubject)')&&props.length===0;
 }
 ok('Undead shuffles and reaching attacks stay finite, unarmed and simulation-independent',zombies);
 const nativeNames=['drawOccultMagician','drawOccultZombie','drawOccultHood','drawOccultFallenAttire'];
 const nativeSaved=Object.fromEntries(nativeNames.map(n=>[n,ctx[n]]));
 let mageCalls=0,zombieCalls=0,hoodCalls=0,clothCalls=0;
 ctx.drawOccultMagician=(...a)=>{mageCalls++;return nativeSaved.drawOccultMagician(...a);};
 ctx.drawOccultZombie=(...a)=>{zombieCalls++;return nativeSaved.drawOccultZombie(...a);};
 ctx.drawOccultHood=(...a)=>{hoodCalls++;return nativeSaved.drawOccultHood(...a);};
 ctx.drawOccultFallenAttire=(...a)=>{const handled=nativeSaved.drawOccultFallenAttire(...a);if(handled)clothCalls++;return handled;};
 try{
  let nativeLive=true,nativeFallen=true;
  for(const kind of ['BLACK','RED','BLUE']){
   P(`occultArtSubject=createOccultMagician('${kind}',0,0);`);
   resetTrace();mageCalls=zombieCalls=hoodCalls=clothCalls=0;P('occultArtSubject.show();');
   nativeLive&&=mageCalls===1&&zombieCalls===0&&hoodCalls===1&&props.length===2&&stack.length===0&&finite;
   P(`var artCorpse=new Corpse(0,0,0,0,occultArtSubject.shirtCol,occultArtSubject.pantsCol,0,0,[],
    occultArtSubject.currentWeapon,0,occultArtSubject.eType,occultArtSubject.bodyW,occultArtSubject.bodyH,occultArtSubject);
    finishFigureFall(artCorpse);`);
   resetTrace();mageCalls=zombieCalls=hoodCalls=clothCalls=0;P('artCorpse.paint(window);');
   nativeFallen&&=hoodCalls>0&&clothCalls>0&&stack.length===0&&finite&&P('artCorpse.id.isUnarmed');
  }
  ok('Native Character.show routes each magician to exactly one equipped occult figure',nativeLive);
  ok('Native settled corpses preserve gold cloak and hood without a phantom firearm',nativeFallen);
  P('occultArtSubject=createOccultZombie(0,0,null);');
  resetTrace();mageCalls=zombieCalls=hoodCalls=clothCalls=0;P('occultArtSubject.show();');
  ok('Native zombie rendering stays on its own unarmed figure route',zombieCalls===1&&mageCalls===0&&props.length===0&&stack.length===0&&finite);
 }finally{Object.assign(ctx,nativeSaved);}
}finally{Object.assign(ctx,saved);}
console.log('Occult art: '+checks+' checks passed across '+poses+' fitted magician poses.');

// Behavioral checks for soft figure surfaces and helmet-only line detail.
// SOFT_BASELINE=/path/to/pre-ink/game.js compares surface and protected art traces.
const {ctx,probe}=require('./harness');
const {spawnSync}=require('child_process');
const P=s=>probe('('+s+')');
let checks=0,fails=0;
function ok(name,value,detail){checks++;if(!value)fails++;console.log((value?'  ok   ':'  FAIL ')+name+(detail===undefined?'':'  '+detail));}
const rgba=a=>a.length===1&&a[0]&&a[0].levels?Array.from(a[0].levels):
  a.length===1?[a[0],a[0],a[0],255]:a.length===2?[a[0],a[0],a[0],a[1]]:
    [a[0],a[1],a[2],a.length>3?a[3]:255];
function capture(draw){
  const names=['push','pop','fill','stroke','strokeWeight','noStroke','noFill',
    'ellipse','arc','rect','quad','triangle','line','bezier','beginShape','vertex','bezierVertex','endShape'];
  const original={},shapes=[],groups=[],stack=[];
  let state={fill:[0,0,0,255],stroke:[0,0,0,255],filled:true,outlined:false,weight:1},group=null,path=null;
  const copy=()=>({...state,fill:state.fill.slice(),stroke:state.stroke.slice()});
  const emit=(kind,args)=>{const s={kind,args,state:copy()};shapes.push(s);if(group)group.shapes.push(s);};
  for(const k of names)original[k]=ctx[k];
  ctx.push=()=>{stack.push(copy());original.push();};
  ctx.pop=()=>{if(stack.length)state=stack.pop();original.pop();};
  ctx.fill=(...a)=>{state.fill=rgba(a);state.filled=true;original.fill(...a);};
  ctx.stroke=(...a)=>{state.stroke=rgba(a);state.outlined=true;original.stroke(...a);};
  ctx.strokeWeight=w=>{state.weight=w;original.strokeWeight(w);};
  ctx.noStroke=()=>{state.outlined=false;original.noStroke();};
  ctx.noFill=()=>{state.filled=false;original.noFill();};
  for(const k of ['ellipse','arc','rect','quad','triangle','line','bezier'])ctx[k]=(...a)=>{emit(k,a);original[k](...a);};
  ctx.beginShape=()=>{path=[];original.beginShape();};
  ctx.vertex=(...a)=>{if(path)path.push(['vertex',...a]);original.vertex(...a);};
  ctx.bezierVertex=(...a)=>{if(path)path.push(['bezier',...a]);original.bezierVertex(...a);};
  ctx.endShape=(...a)=>{if(path)emit('path',path);path=null;original.endShape(...a);};
  for(const key of ['figureCelOval','figureCelLimb']){
    original[key]=ctx[key];
    ctx[key]=function(){const parent=group;group={kind:key,args:Array.from(arguments).slice(1),shapes:[]};groups.push(group);
      try{return original[key].apply(this,arguments);}finally{group=parent;}};
  }
  try{probe(draw);}finally{Object.assign(ctx,original);}
  return {shapes,groups,depth:stack.length};
}
const setup=`isStoryMode=false;townsData={};startAtLevel(2);started=true;doTick=false;
viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;
leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0};
swordPickedUp=false;setMeleeTool("NONE");chemistSuitUnlocked=false;explosiveArmorUnlocked=false;
ninjaSuitUnlocked=false;jetpackUnlocked=false;frameCount=100;`;
const surfaceCases=[
  ['opaque torso','figureCelOval(window,2,3,21,27,[200,225,245],1,1,0);'],
  ['transparent head','figureCelOval(window,-1,3,11,11,[235,180,140,153],.65,0,-1);'],
  ['bent sleeve','figureCelLimb(window,0,0,8,0,10,7,7,5.5,4,[80,110,150,153]);'],
  ['collapsed sleeve','figureCelLimb(window,0,0,0,0,10,7,7,5.5,4,[80,110,150]);'],
  ['metal plate','entityCelPlate(window,_robotCelHull,[88,95,104],.5,.8,.2,.97,.14);']
];
if(process.argv.includes('--surface-trace')){
  const records=surfaceCases.map(([label,draw])=>({label,shapes:capture(draw).shapes}));
  require('fs').writeFileSync(1,JSON.stringify(records));process.exit(0);
}
if(process.argv.includes('--protected-trace')){
  ctx.console={...console,log(){},warn(){}};
  let seed=811;ctx.Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  probe(setup);
  const records=[];
  function trace(draw){
    const steps=[],undo=[];
    const value=a=>a&&a.levels?{rgba:Array.from(a.levels)}:
      typeof a==='number'?Math.round(a*1e9)/1e9:
      a===undefined?'undefined':a===null?null:typeof a==='object'?{width:a.width,height:a.height}:a;
    function wrap(g,prefix){
      for(const k of ['push','pop','translate','rotate','scale','fill','stroke','strokeWeight','noFill','noStroke',
        'ellipse','arc','rect','quad','triangle','line','bezier','beginShape','vertex','bezierVertex','endShape','image']){
        const fn=g[k];if(typeof fn!=='function')continue;
        g[k]=function(...a){steps.push([prefix+k,...a.map(value)]);return fn.apply(this,a);};
        undo.push(()=>{g[k]=fn;});
      }
      const dc=g.drawingContext;
      if(dc)for(const k of ['save','restore','translate','rotate','scale','transform','beginPath','closePath','lineTo','moveTo','ellipse',
        'arc','rect','clip','fill','stroke','bezierCurveTo','quadraticCurveTo']){
        const fn=dc[k];if(typeof fn!=='function')continue;
        dc[k]=function(...a){steps.push([prefix+'dc.'+k,...a.map(value)]);return fn.apply(this,a);};
        undo.push(()=>{dc[k]=fn;});
      }
    }
    wrap(ctx,'main.');
    if(ctx.__inkBuffer)wrap(ctx.__inkBuffer,'buffer.');
    try{probe(draw);}finally{for(const fn of undo.reverse())fn();}
    return steps;
  }
  for(const biome of [false,true])for(const angle of [-.82,1.28]){
    probe(`BIOME_ACTIVE=${biome};frameCount=100;`);
    for(const state of ['idle','walk','run','fire','reload']){
      seed=811;
      probe(`window.__inkFigure=new Character(0,0,false,'FEMALE_PISTOL');
        __inkFigure.aimAngle=${angle};__inkFigure.moveAngle=${angle+.4};__inkFigure.walkCycle=1.1;
        __inkFigure.isMoving=${state!=='idle'};__inkFigure.gait=${state==='walk'?.2:.9};
        __inkFigure.currentWeapon=WEAPONS.PISTOL;__inkFigure.reloadTimer=${state==='reload'?41:0};
        __inkFigure.weaponKick=${state==='fire'?6:0};__inkFigure.muzzleFlash=0;`);
      records.push({label:'female pistol '+state+', biome='+biome+', angle='+angle,steps:trace('__inkFigure.show();')});
    }
    for(const type of ['NORMAL','FEMALE_PISTOL','ARMORED_STANDARD','COWBOY'])for(const age of [0,30,90]){
      seed=811;
      probe(`window.__inkSource=new Character(0,0,false,${JSON.stringify(type)});__inkSource.aimAngle=${angle};
        window.__inkCorpse=new Corpse(0,0,${angle},${angle},__inkSource.shirtCol,__inkSource.pantsCol,
          0,.2,[],WEAPONS.PISTOL,.7,${JSON.stringify(type)},__inkSource.bodyW,__inkSource.bodyH,__inkSource);
        for(let i=0;i<${age};i++)__inkCorpse.update();
        window.__inkBuffer=createGraphics(384,384);`);
      records.push({label:type+' corpse at '+age+', biome='+biome+', angle='+angle,
        steps:trace('__inkCorpse.show();__inkCorpse.show(__inkBuffer);')});
    }
  }
  require('fs').writeFileSync(1,JSON.stringify(records));process.exit(0);
}
probe(setup);
const dark=s=>s.state.outlined&&s.state.stroke.slice(0,3).every(v=>v<=26)&&s.state.stroke[3]>=225;
const defaultOval=()=>JSON.stringify(capture('figureCelOval(window,2,3,21,27,[200,225,245,153],1,1,0);').shapes);
const defaultTrace=defaultOval();
console.log('== soft cel figure surfaces ==');
for(const [label,draw] of surfaceCases){
  const r=capture(draw);
  ok(label+' paints every surface rather than a second hard outline',r.shapes.length>=3&&r.shapes.every(s=>s.state.filled));
  ok(label+' keeps broad shade planes unoutlined',r.shapes.slice(1).every(s=>!s.state.outlined));
  ok(label+' keeps material-colored contour alpha',r.shapes[0].state.outlined&&r.shapes[0].state.stroke[3]<=225&&
    r.shapes[0].state.stroke.slice(0,3).some(v=>v>0));
}
for(const [label,type,player,suit] of [
  ['male regular','NORMAL',false],['player','NORMAL',true],['chemist','NORMAL',true,'chemist'],
  ['ninja','NORMAL',true,'ninja'],['armored player','NORMAL',true,'armor'],
  ['armored guard','ARMORED_STANDARD',false],['heavy guard','ARMORED',false],
  ['rookie','NM0_ROOKIE',false],['city guard','NM0_CITY_GUARD',false],
  ['military','MILITARY_NEUTRAL',false],['bandit','BANDIT',false],['cowboy','COWBOY',false],
  ['female pistol','FEMALE_PISTOL',false],['cow','COW',false],['bug','BUG',false],
  ['snail','SNAIL',false],['saucer','SAUCER',false]]){
  probe(`chemistSuitUnlocked=${suit==='chemist'};explosiveArmorUnlocked=${suit==='armor'};ninjaSuitUnlocked=${suit==='ninja'};
    window.__softFigure=new Character(0,0,${!!player},${JSON.stringify(type)});
    __softFigure.isArmed=${!player};__softFigure.isMoving=true;__softFigure.gait=.8;
    __softFigure.walkCycle=1.1;__softFigure.moveAngle=.5;__softFigure.aimAngle=.8;
    __softFigure.aimHold=0;__softFigure.meleeTimer=0;`);
  const r=capture('__softFigure.show();'),g=r.groups.filter(q=>q.shapes.length);
  ok(label+' keeps rounded anatomy free of a second ink silhouette',g.length>0&&g.every(q=>q.shapes.length===3&&q.shapes.every(s=>s.state.filled)));
  ok(label+' keeps cel bands unoutlined and material alpha on the contour',g.every(q=>
    q.shapes[0].state.outlined&&q.shapes[0].state.stroke[3]<225&&q.shapes.slice(1).every(s=>!s.state.outlined)));
  ok(label+' leaves the painter balanced and soft surfaces unchanged',r.depth===0&&defaultOval()===defaultTrace);
}
probe('chemistSuitUnlocked=false;explosiveArmorUnlocked=false;ninjaSuitUnlocked=false;');
console.log('\n== line detail belongs to helmet equipment ==');
for(const [label,identity,kind] of [
  ['green army shell',`{eType:'MILITARY_NEUTRAL',isMilitary:true}`,'HELMET'],
  ['grey army shell',`{eType:'NM0_GREY_FATIGUE',isMilitary:false}`,'HELMET'],
  ['tan army shell',`{eType:'MILITARY_NEUTRAL',isMilitary:false}`,'HELMET'],
  ['military visor shell',`{eType:'NORMAL',isPlayer:true}`,'VISOR'],
  ['city guard shell',`{eType:'NM0_CITY_GUARD'}`,'NM0_HELMET']]){
  const r=capture(`drawHeadwear(window,${identity},${JSON.stringify(kind)});`);
  const edges=r.shapes.filter(dark);
  ok(label+' has a dark final metal perimeter and brow seam',edges.length===2&&edges.every(s=>!s.state.filled));
  ok(label+' retains its original three-tone curved shell',r.groups.length>0&&r.groups.every(q=>q.shapes.length===3&&q.shapes.slice(1).every(s=>!s.state.outlined)));
  ok(label+' keeps line weight inside its shell and restores soft anatomy',edges.every(s=>s.state.weight<=1.05)&&r.depth===0&&defaultOval()===defaultTrace);
}
const armor=capture('drawArmoredHelmet(window);'),armorEdges=armor.shapes.filter(dark);
ok('heavy face shell has a dark perimeter and distinct brow',armorEdges.length===2&&armorEdges.every(s=>!s.state.filled));
ok('heavy face shell has rounded cel planes instead of a flat black dome',armor.groups.length===1&&armor.groups[0].shapes.length===3&&armor.groups[0].shapes.every(s=>s.state.filled));
ok('heavy face shell exposes a thin steel brow highlight',armor.shapes.some(s=>s.kind==='bezier'&&s.state.outlined&&s.state.stroke[0]===105&&s.state.weight===.65));
for(const kind of ['HOOD','BANDIT_HAT','STETSON','COP_HAT','FLAT_CAP','BONNET','STRAW']){
  const r=capture(`drawHeadwear(window,{eType:'NORMAL'},${JSON.stringify(kind)});`);
  ok(kind+' keeps its previous material contour',!r.shapes.some(s=>dark(s)&&!s.state.filled));
}
const realHelmet=ctx.drawArmoredHelmet;let heavyCalls=0;
ctx.drawArmoredHelmet=function(...a){heavyCalls++;return realHelmet(...a);};
try{
  probe(`window.__softFigure=new Character(0,0,false,'ARMORED_STANDARD');__softFigure.hp=300;__softFigure.show();`);
  ok('live armored guard actually uses the detailed face shell',heavyCalls===1);
  probe(`__softFigure.hp=50;__softFigure.show();`);
  ok('broken armor exposes the unchanged soft head',heavyCalls===1);
}finally{ctx.drawArmoredHelmet=realHelmet;}
probe(`window.__softFigure=new Character(0,0,false,'NORMAL');startPunchStun(__softFigure,.3);
  __softFigure.stunPose.age=30;__softFigure.stunTimer=100;`);
const stunned=capture('__softFigure.show();');
ok('nonlethal fallen anatomy keeps the original soft surface profile',stunned.groups.every(q=>!q.shapes.length||q.shapes.every(s=>s.state.filled)));

// Optional exact comparisons cover contour colors, alpha, cubic shade paths,
// clipping, protected female poses and main/Graphics corpse stamps.
if(process.env.SOFT_BASELINE){
  for(const mode of ['--surface-trace','--protected-trace']){
    const baseline=spawnSync(process.execPath,[__filename,mode],{env:{...process.env,GAME_JS:process.env.SOFT_BASELINE},encoding:'utf8',maxBuffer:32*1024*1024});
    const current=spawnSync(process.execPath,[__filename,mode],{env:{...process.env,GAME_JS:process.env.GAME_JS||require('path').join(__dirname,'..','game.js')},encoding:'utf8',maxBuffer:32*1024*1024});
    if(baseline.status!==0||current.status!==0)throw Error('Soft profile trace failed: '+baseline.stderr+current.stderr);
    const a=JSON.parse(baseline.stdout),b=JSON.parse(current.stdout);
    for(let i=0;i<a.length;i++)ok(a[i].label+' exactly preserves the pre-ink painter trace',JSON.stringify(a[i])===JSON.stringify(b[i]));
  }
}
console.log('\n'+(checks-fails)+'/'+checks+' checks passed');process.exitCode=fails?1:0;

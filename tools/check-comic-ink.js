// Behavioral checks for selective live comic ink. The default cel profile is
// shared with fallen figures, so scopes must restore it after every live model.
// COMIC_BASELINE=/path/to/unchanged/game.js adds exact protected painter traces.
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
    'ellipse','arc','rect','quad','triangle','line','beginShape','vertex','bezierVertex','endShape'];
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
  for(const k of ['ellipse','arc','rect','quad','triangle','line'])ctx[k]=(...a)=>{emit(k,a);original[k](...a);};
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
const defaultOval=()=>capture('figureCelOval(window,2,3,21,27,[200,225,245,153],1,1,0);').shapes;
const defaultTrace=JSON.stringify(defaultOval());
const black=s=>s.state.outlined&&s.state.stroke.slice(0,3).every(v=>v<=26)&&s.state.stroke[3]>=225;
console.log('== ink stays on the existing surfaces ==');
for(const [label,draw] of [
  ['torso','figureCelOval(window,2,3,21,27,[200,225,245,153],1,1,0);'],
  ['bent sleeve','figureCelLimb(window,0,0,8,0,10,7,7,5.5,4,[80,110,150,153]);']]){
  const base=capture(draw).shapes;
  const live=capture(`_figureComicInk=1;try{${draw}}finally{_figureComicInk=0;}`).shapes;
  ok(label+' keeps the same material and curved shade geometry',live.length===base.length+1&&base.every((s,i)=>
    s.kind===live[i].kind&&JSON.stringify(s.args)===JSON.stringify(live[i].args)&&JSON.stringify(s.state.fill)===JSON.stringify(live[i].state.fill)));
  const rim=live[live.length-1];
  ok(label+' puts only an unfilled black contour over its original silhouette',rim.state.outlined&&!rim.state.filled&&
    rim.state.stroke.slice(0,3).every(v=>v===0)&&JSON.stringify(rim.args)===JSON.stringify(base[0].args));
  ok(label+' preserves material transparency in its black outline',rim.state.stroke[3]===153);
}
console.log('== selective live silhouettes ==');
for(const [label,type,player,suit] of [
  ['male regular','NORMAL',false],['player','NORMAL',true],['chemist','NORMAL',true,'chemist'],
  ['ninja','NORMAL',true,'ninja'],['armored player','NORMAL',true,'armor'],
  ['armored guard','ARMORED_STANDARD',false],['rookie','NM0_ROOKIE',false],
  ['city guard','NM0_CITY_GUARD',false],['military','MILITARY_NEUTRAL',false],
  ['bandit','BANDIT',false],['cowboy','COWBOY',false]]){
  probe(`chemistSuitUnlocked=${suit==='chemist'};explosiveArmorUnlocked=${suit==='armor'};ninjaSuitUnlocked=${suit==='ninja'};
    window.__inkFigure=new Character(0,0,${!!player},${JSON.stringify(type)});
    __inkFigure.isArmed=${!player};__inkFigure.isMoving=true;__inkFigure.gait=.8;
    __inkFigure.walkCycle=1.1;__inkFigure.moveAngle=.5;__inkFigure.aimAngle=.8;
    __inkFigure.aimHold=0;__inkFigure.meleeTimer=0;`);
  const r=capture('__inkFigure.show();'),g=r.groups.filter(q=>q.shapes.length);
  const hard=g.filter(q=>black(q.shapes[q.shapes.length-1]));
  ok(label+' has decisive black final silhouettes',hard.length>=3,hard.length+' rounded masses');
  ok(label+' final silhouettes do not repaint the shade',hard.every(q=>!q.shapes[q.shapes.length-1].state.filled));
  ok(label+' cel bands stay unoutlined',hard.every(q=>q.shapes.filter(s=>s.state.filled).slice(-2).every(s=>!s.state.outlined)));
  const scoped=JSON.stringify(defaultOval())===defaultTrace;
  ok(label+' keeps the default profile scoped and the painter balanced',r.depth===0&&scoped,
    'depth='+r.depth+', default='+scoped);
}
probe('chemistSuitUnlocked=false;explosiveArmorUnlocked=false;ninjaSuitUnlocked=false;');
console.log('\n== protected soft profile and early returns ==');
for(const type of ['FEMALE_PISTOL','COW','BUG','SNAIL','SAUCER']){
  probe(`window.__inkFigure=new Character(0,0,false,${JSON.stringify(type)});__inkFigure.isMoving=true;__inkFigure.gait=.8;__inkFigure.walkCycle=1.1;`);
  const r=capture('__inkFigure.show();');
  ok(type+' keeps the original rounded contour profile',r.groups.every(q=>!q.shapes.length||q.shapes.filter(s=>s.state.filled).length===q.shapes.length));
  ok(type+' early return cannot leak live ink',JSON.stringify(defaultOval())===defaultTrace);
}
probe(`window.__inkFigure=new Character(0,0,false,'NORMAL');startPunchStun(__inkFigure,.3);
  __inkFigure.stunPose.age=30;__inkFigure.stunTimer=100;`);
const stunned=capture('__inkFigure.show();');
ok('nonlethal fallen figure keeps the original rounded profile',stunned.groups.every(q=>!q.shapes.length||q.shapes.filter(s=>s.state.filled).length===q.shapes.length));
ok('nonlethal fall restores default ink',JSON.stringify(defaultOval())===defaultTrace);
probe(`window.__inkFigure=new Character(0,0,false,'NORMAL');__inkFigure.skeletonTimer=20;frameCount=102;`);
capture('__inkFigure.show();');
ok('skeleton flash early return restores default ink',JSON.stringify(defaultOval())===defaultTrace);
const realElev=ctx.elevRenderScale;
ctx.elevRenderScale=()=>{throw Error('ink scope probe');};
try{probe(`window.__inkFigure=new Character(0,0,false,'NORMAL');__inkFigure.show();`);}catch(e){if(!String(e).includes('ink scope probe'))throw e;}
finally{ctx.elevRenderScale=realElev;}
ok('drawing exception restores the default ink profile',JSON.stringify(defaultOval())===defaultTrace);

// An optional baseline compares the full protected p5 call stream rather than
// just colors or shape counts. The trace includes material alpha, cubic control
// points, buffers, clipping paths, layering and every outline state.
if(process.env.COMIC_BASELINE){
  const baseline=spawnSync(process.execPath,[__filename,'--protected-trace'],{env:{...process.env,GAME_JS:process.env.COMIC_BASELINE},encoding:'utf8',maxBuffer:32*1024*1024});
  const current=spawnSync(process.execPath,[__filename,'--protected-trace'],{env:{...process.env,GAME_JS:process.env.GAME_JS||require('path').join(__dirname,'..','game.js')},encoding:'utf8',maxBuffer:32*1024*1024});
  if(baseline.status!==0||current.status!==0)throw Error('Protected trace failed: '+baseline.stderr+current.stderr);
  const a=JSON.parse(baseline.stdout),b=JSON.parse(current.stdout);
  for(let i=0;i<a.length;i++)ok(a[i].label+' exactly preserves its protected painter trace',JSON.stringify(a[i])===JSON.stringify(b[i]));
}
console.log('\n'+(checks-fails)+'/'+checks+' checks passed');process.exitCode=fails?1:0;

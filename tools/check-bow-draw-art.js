// The string and shaft move together through the draw. This also checks that
// repeated HUD paints never advance gameplay or prolong release feedback.
const assert=require('assert');
const {ctx,probe}=require('./harness');
let checks=0;
const names=['line','triangle','text','rect','push','pop'];
const old=Object.fromEntries(names.map(n=>[n,ctx[n]]));
let lines=[],triangles=[],labels=[],rects=[],depth=0;
ctx.line=(...v)=>lines.push(v);ctx.triangle=(...v)=>triangles.push(v);
ctx.text=(...v)=>labels.push(v);ctx.rect=(...v)=>rects.push(v);
ctx.push=()=>depth++;ctx.pop=()=>depth--;
const ok=(v,label)=>{assert(v,label);checks++;};
try {
  for(const t of [0,.25,.5,1]) {
    lines=[];triangles=[];
    probe(`drawHuntingBow(true,0,${t});`);
    ok(lines[0][2]===lines[1][0]&&lines[0][3]===0,
      'The string halves meet on the shaft at draw '+t);
    ok(Math.abs(triangles[0][0]-lines[0][2]-34)<1e-9,
      'Arrowhead travels with the string without stretching at draw '+t);
    ok(lines[2][2]-lines[2][0]===35,
      'Shaft retains its authored length at draw '+t);
    ok(triangles[0][0]>triangles[0][2]&&triangles.slice(1).every(v=>v[0]<lines[0][2]),
      'The pointed head stays ahead and fletching stays behind the nock at draw '+t);
    ok(depth===0,'Draw '+t+' leaves the canvas scope balanced');
  }
  lines=[];triangles=[];probe('drawHuntingBow(false,.4,1);');
  ok(lines.every(v=>v[0]===v[2])&&!triangles.length,'An empty carried bow has an unpulled string');
  const samples=[
    ['IDLE',0,0,false,0,'','PULL BACK'],
    ['DRAW',.25,.9,false,0,'','25% · SMOOTH'],
    ['DRAW',.81,1,false,0,'','SMOOTH'],
    ['DRAW',1,.84,false,0,'','SMOOTH'],
    ['DRAW',.82,.85,false,0,'','SMOOTH'],
    ['DRAW',1,.85,false,0,'','READY'],
    ['DRAW',1,0,true,0,'','DUD'],
    ['LATCHED',0,.9,false,500,'PERFECT','PERFECT RELEASE'],
    ['LATCHED',0,0,true,500,'DUD','DUD ARROW'],
    ['LATCHED',0,.2,false,500,'WEAK','WEAK RELEASE'],
    ['LATCHED',0,0,false,0,'','EASE OFF']
  ];
  for(const [phase,tension,quality,dud,feedbackMs,lastOutcome,label] of samples) {
    probe(`window.artBow={ammo:24,bowDrawState:${JSON.stringify({phase,tension,quality,dud,feedbackMs,lastOutcome})}};
      window.artBowBefore=JSON.stringify(artBow);`);
    labels=[];rects=[];
    probe('for(let i=0;i<6;i++)drawBowDrawHud(artBow,90,97);');
    ok(labels.length===6&&labels.every(v=>String(v[0]).includes(label)),phase+' gives useful draw feedback');
    ok(rects.every(v=>v[2]>=0&&v[2]<=126),phase+' stays inside the compact meter');
    ok(probe('JSON.stringify(artBow)===artBowBefore')&&depth===0,
      phase+' paint cannot advance tension or extend release feedback');
  }
  probe('artBow.ammo=0;');labels=[];probe('drawBowDrawHud(artBow,90,97);');
  ok(labels[0][0]==='QUIVER EMPTY','A depleted quiver has clear feedback');
  const savedWidth=ctx.width,savedHeight=ctx.height;
  ctx.width=390;ctx.height=844;
  probe('player=new Character(0,0,true);player.currentWeapon=WEAPONS.BOW;nm0AmbushActive=false;');
  ok(probe('forestHuntingObjectiveCard().y===156'),
    'A portrait hunting notice clears the ordinary bow meter');
  probe('nm0AmbushActive=true;');
  ok(probe('forestHuntingObjectiveCard().y>=181'),
    'An ambush portrait notice clears the lowered bow meter and status');
  probe('player.currentWeapon=WEAPONS.PISTOL;');
  ok(probe('forestHuntingObjectiveCard().y===156'),
    'Firearm portrait notices retain their existing position');
  ctx.width=640;ctx.height=360;
  ok(probe('forestHuntingObjectiveCard().y===88&&forestHuntingObjectiveCard().x>=244'),
    'A narrow landscape notice leaves health and ammo clear');
  ctx.width=savedWidth;ctx.height=savedHeight;
} finally {Object.assign(ctx,old);}
console.log(`${checks}/${checks} bow draw geometry and HUD checks passed.`);

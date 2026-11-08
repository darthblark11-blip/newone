// Exercise native bounty notifications, responsive HUD paint and board input.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
let checks=0;
const check=(code,label)=>{assert.ok(probe(code),label);checks++;};
function paint(code='drawFrontierBountyHud();'){
  const result={texts:[],rects:[],triangles:[]},saved={text:ctx.text,rect:ctx.rect,triangle:ctx.triangle,textWidth:ctx.textWidth,textSize:ctx.textSize};
  let size=12;ctx.textSize=v=>{size=v;};ctx.textWidth=label=>String(label).length*size*.6;
  ctx.text=(label,x,y)=>result.texts.push({label:String(label),x,y,w:ctx.textWidth(label)});
  ctx.rect=(...args)=>result.rects.push(args);ctx.triangle=(...args)=>result.triangles.push(args);
  try{probe(code);}finally{Object.assign(ctx,saved);}return result;
}
probe(`isStoryMode=false;resetStoryProgress();startAtLevel(3);started=doTick=true;
 isPaused=isDead=isWin=killcamMode=false;
 inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inWorldBuildingMenu=inOverworldView=inTravelMenu=inStoryIntro=inDarchonCall=false;
 window.isDesktop=false;window.showOnScreenControls=true;
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 player.x=5400;player.y=-3255;resetFrontierBounties();
 frontierBounties.activeId='RED_MESA';frontierBountyRecord(FRONTIER_BOUNTY_DEFS[0]).stage='ACTIVE';
 _frontierBountyPrompt=null;consecutiveKills=0;comboTimer=0;comboHudFade.visibility=0;`);
for(const [w,h]of [[320,568],[390,844],[844,390],[1280,720]]){
  ctx.width=w;ctx.height=h;
  const l=JSON.parse(probe('JSON.stringify(activityHudLayout())')),painted=paint();
  assert(l.bounty.x>=84&&l.bounty.x+l.bounty.w<=w-8,'Compact activity lane leaves the native ammo icon and viewport edges clear');checks++;
  assert.equal(l.bounty.h,26,'Bounty rail uses one compact row');checks++;
  assert(l.stealth.y>=l.bounty.y+l.bounty.h+4,'Stealth and bounty lanes never overlap');checks++;
  assert(painted.texts.some(t=>t.label==='RED MESA')&&painted.texts.some(t=>t.label==='0/5'),'Live contract identity and target count remain available');checks++;
  assert(!painted.rects.some(r=>r[3]>=40),'No informational box covers the action area');checks++;
  assert(painted.triangles.length===1&&painted.texts.some(t=>/^\d+ m$/.test(t.label)),'Northern navigation remains present');checks++;
  if(w<560){
    probe('consecutiveKills=3;comboTimer=80;');
    const combo=JSON.parse(probe('JSON.stringify(activityHudLayout())'));
    assert(combo.bounty.y>=116,'Portrait kill combo owns a separate row above activities');checks++;
    probe('consecutiveKills=0;comboTimer=0;');
  }
  const climate=paint('drawClimateReadout();').texts.filter(t=>t.y===42||t.y===56);
  assert(climate.every(t=>t.x===(w<380?w-12:w-70)),'Climate preserves landscape placement and uses the free right lane on narrow phones');checks++;
  if(w===320){assert(climate.every(t=>t.x-t.w>220),'Narrow climate text clears the 200px health and shield bars');checks++;}
}
probe('frontierBountyHudAlpha();_frontierBountyHud.clockMs=4000;');
check('frontierBountyHudAlpha()===0','Initial contract information expires normally');
for(let slot=0;slot<5;slot++){
  probe(`frontierBountyOnKill({frontierBountyId:'RED_MESA',frontierBountySlot:${slot},dead:true,hp:0});`);
  const killed=paint();
  assert(!killed.rects.some(r=>r[1]===153||r[3]===64||r[3]===43),'Casualties never recreate either old brown banner');checks++;
  check('_frontierBountyToastTicks===0&&_frontierBountyToast===""','Casualties enqueue no duplicate text notifications');
  if(slot<4){
    check('frontierBountyHudAlpha()===0','Casualties do not revive the transient introduction');
    assert(killed.texts.some(t=>t.label===`${slot+1}/5`),'Existing counter updates in place');checks++;
  }else{
    assert.equal(killed.texts.filter(t=>t.label==='RETURN TO SHERIFF').length,1,'Final casualty has one compact return instruction');checks++;
    assert(killed.texts.some(t=>t.label==='+125'),'The same rail carries the unclaimed reward');checks++;
  }
}
probe('player.x=frontierBountyBoard().x-40;player.y=frontierBountyBoard().y;updateFrontierBounties(false);');
const prompt=JSON.parse(probe('JSON.stringify(activityHudLayout().prompt)'));
check('!!_frontierBountyPrompt','Board remains an explicit nearby interaction');
const board=paint();
assert(board.texts.some(t=>t.label==='CLAIM +125 SCORE'),'The claim action has its own intentional board prompt');checks++;
check(`handleFrontierBountyTap(${prompt.x+prompt.w/2},${prompt.y+prompt.h/2})`,'Visible prompt center activates its exact shared hitbox');
check("frontierBountyRecord(FRONTIER_BOUNTY_DEFS[0]).rewardGranted&&frontierBounties.activeId===null",'Claiming still pays the completed contract once');
const paid=paint();
assert(paid.texts.some(t=>t.label==='BOUNTY PAID · +125 SCORE'),'Payment uses one compact acknowledgement');checks++;
assert(!paid.rects.some(r=>r[1]===153||r[3]===64),'Payment does not restore the old toast');checks++;
probe('isPaused=true;var pauseHudClock=_frontierBountyHud.clockMs;updateFrontierBounties();');
check('_frontierBountyHud.clockMs===pauseHudClock','Pause freezes acknowledgement lifetimes');
assert.equal(paint().texts.length,0,'Paused world draws no activity overlay');checks++;
probe('isPaused=false;resetFrontierBounties();');
check('_frontierBountyHud.toastUntilMs===0&&_frontierBountyHud.progressAtMs<0','Reset clears transient notification and pulse state');
console.log(`Bounty HUD: ${checks} responsive layout, kill notification and board interaction checks passed.`);

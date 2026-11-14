// New places identify themselves briefly without adding persistent HUD clutter.
const assert=require('assert');
const {ctx,probe}=require('./harness');
let checks=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++;};
probe(`isStoryMode=false;townsData={};startAtLevel(3);started=true;doTick=true;
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
 inTownCutscene=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inPostAmbushCutscene=inDarchonCall=false;
 inTravelMenu=inOverworldView=isPaused=isDead=isWin=false;`);
for(const town of probe('frontierSettlementSites()')){
 const place=probe(`frontierExplorationLocaleAt(${town.x},${town.y})`);
 check(place.id==='TOWN:'+town.id&&place.label===town.name,'Actual settlement footprint identifies '+town.name);
 probe(`player.x=${town.x};player.y=${town.y};updateFrontierExplorationNotice(16);`);
 check(probe('_frontierExplorationNotice.ageMs===0&&frontierExplorationNoticeAlpha()===1'),'Entering a new town reveals its name');
 probe('for(let i=0;i<30;i++)updateFrontierExplorationNotice(100);');
 check(probe('_frontierExplorationNotice.ageMs===3000&&frontierExplorationNoticeAlpha()===1'),'A stationary place name is not refreshed each frame');
 probe('updateFrontierExplorationNotice(100);updateFrontierExplorationNotice(100);');
 check(probe('frontierExplorationNoticeAlpha()>0&&frontierExplorationNoticeAlpha()<1'),'Place name fades after three seconds');
 probe('for(let i=0;i<4;i++)updateFrontierExplorationNotice(100);');
 check(probe('frontierExplorationNoticeAlpha()===0'),'Place name disappears completely by3.5seconds');
}
for(const site of probe('frontierCanyonLandmarks()')){
 const u=(site.u0+site.u1)/2,p=probe(`frontierCanyonProfile('${site.axis}',${u},${site.index})`),
   x=site.axis==='Y'?p.center:u,y=site.axis==='Y'?u:p.center;
 const locale=probe(`frontierExplorationLocaleAt(${x},${y})`);
 check(locale&&locale.id==='CANYON:'+site.id,'Actual canyon floor identifies '+site.name);
}
probe(`player.x=-6000;player.y=600;updateFrontierExplorationNotice(16);var noticeAge=_frontierExplorationNotice.ageMs;
 isPaused=true;for(let i=0;i<20;i++)updateFrontierExplorationNotice(100);`);
check(probe('_frontierExplorationNotice.ageMs===noticeAge'),'Pause freezes arrival notice time');
probe('isPaused=false;doTick=false;updateFrontierExplorationNotice(100);');
check(probe('_frontierExplorationNotice.ageMs===noticeAge'),'Frozen simulation cannot consume notice time');
probe('doTick=true;player.x=24000;player.y=24000;updateFrontierExplorationNotice(16);');
check(probe('_frontierExplorationNotice.id===null&&frontierExplorationNoticeAlpha()===0'),'Leaving the locale removes the badge');
probe('player.x=-6000;player.y=600;updateFrontierExplorationNotice(16);');
check(probe('_frontierExplorationNotice.ageMs===0'),'Reentry identifies the place once again');
const seen=[],rects=[],text=ctx.text,rect=ctx.rect;
ctx.text=(...args)=>{seen.push(args);return text(...args);};ctx.rect=(...args)=>{rects.push(args);return rect(...args);};
for(const [w,h] of [[320,568],[390,844],[940,390]]){
 ctx.width=w;ctx.height=h;seen.length=rects.length=0;probe('drawFrontierExplorationNotice();');
 check(seen.some(x=>String(x[0]).includes('COPPER WASH')),'The arrival name renders at '+w+'x'+h);
 check(rects.length===1&&rects[0][0]>=0&&rects[0][1]>=h-59&&rects[0][0]+rects[0][2]<=w&&rects[0][1]+rects[0][3]<=h,'Badge fits below movement sticks at '+w+'x'+h);
}
probe('isPaused=true;');seen.length=rects.length=0;probe('drawFrontierExplorationNotice();');
check(seen.length===0&&rects.length===0,'Arrival badge never paints over a pause/settings screen');
probe('isPaused=false;currentLevel=2;currentBiome=2;updateFrontierExplorationNotice(100);');
check(probe('_frontierExplorationNotice.id===null&&frontierExplorationNoticeAlpha()===0'),'Other levels clear the Frontier notice');
ctx.text=text;ctx.rect=rect;
console.log('Frontier exploration notices: '+checks+' identity, fade, pause and responsive HUD checks passed.');

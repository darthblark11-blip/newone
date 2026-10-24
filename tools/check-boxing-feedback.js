// Contact feedback must remain tied to solver outcomes, and lock-on changes
// must never become camera jumps. These exercise the shared production APIs.
const assert = require('assert');
const { ctx, probe } = require('./harness');
let count = 0;
function check(code, label) { assert.ok(probe(code), label); count++; }
ctx.width = 390; ctx.height = 844; ctx.deltaTime = 1000 / 60;
probe(`isPaused=false;window.isDesktop=false;window.showOnScreenControls=true;
  player={x:0,y:0,hp:100,isPlayer:true,aimAngle:0,
    _boxing:{active:true,context:'SALOON',target:{x:100,y:30,hp:100}}};
  var feedbackScene={brawl:'ACTIVE',camera:null,boxingEffects:[]};
  var feedbackCamera=frontierSaloonCamera(feedbackScene,0);`);
check('feedbackCamera.x===0&&feedbackCamera.y===-48&&feedbackCamera.lookX===0', 'Entry starts on the player rather than snapping to a target midpoint');
check('feedbackCamera.centerX===width*.34&&feedbackCamera.scale>=1.35', 'Portrait boxing keeps its close view clear of the attack buttons');
probe('for(let i=0;i<90;i++)frontierSaloonCamera(feedbackScene,1000/60);var feedbackOldX=feedbackCamera.x,feedbackOldY=feedbackCamera.y;');
check('feedbackCamera.x>19&&feedbackCamera.x<23', 'The camera gently anticipates a nearby opponent');
probe(`player._boxing.target={x:-100,y:-30,hp:100};
  var feedbackAim=player.aimAngle;frontierSaloonCamera(feedbackScene,1000/60);`);
check('Math.hypot(feedbackCamera.x-feedbackOldX,feedbackCamera.y-feedbackOldY)<1', 'Swapping to the opposite opponent advances less than one world unit on the first frame');
check('feedbackScene.camera===feedbackCamera&&player.aimAngle===feedbackAim', 'Target changes preserve camera state and drawing does not mutate combat aim');
probe('var feedbackPaused=JSON.stringify(feedbackCamera);isPaused=true;frontierSaloonCamera(feedbackScene,100);');
check('JSON.stringify(feedbackCamera)===feedbackPaused', 'Pausing freezes look-ahead, follow and framing');
probe('isPaused=false;frontierSaloonCamera(feedbackScene,0);');
check('JSON.stringify(feedbackCamera)===feedbackPaused', 'A draw without elapsed simulation time cannot advance the camera');
probe(`player.x=400;player.y=230;var feedbackStepX=feedbackCamera.x,feedbackStepY=feedbackCamera.y;
  frontierSaloonCamera(feedbackScene,1000/60);`);
check('Math.hypot(feedbackCamera.x-feedbackStepX,feedbackCamera.y-feedbackStepY)<=.42*(1000/60)+1e-8', 'Large position changes obey the camera travel limit');
probe(`player.x=0;player.y=0;player._boxing.target={x:100,y:30,hp:100};
  var feedback60={brawl:'ACTIVE',camera:null},feedback120={brawl:'ACTIVE',camera:null};
  frontierSaloonCamera(feedback60,0);frontierSaloonCamera(feedback120,0);
  for(let i=0;i<60;i++)frontierSaloonCamera(feedback60,1000/60);
  for(let i=0;i<120;i++)frontierSaloonCamera(feedback120,1000/120);`);
check('Math.hypot(feedback60.camera.x-feedback120.camera.x,feedback60.camera.y-feedback120.camera.y)<.1', 'Camera follow remains consistent at 60 and 120 updates per second');
probe('var feedbackLockedX=feedback60.camera.x;player._boxing.target=null;frontierSaloonCamera(feedback60,1000/60);');
check('Math.abs(feedback60.camera.x-feedbackLockedX)<1', 'Losing a target eases the anticipation away');

for(const [width,height] of [[320,568],[390,844],[940,390]]){
  ctx.width=width;ctx.height=height;
  probe(`var finishCameraScene={brawl:'ACTIVE',camera:null};
    var finishCamera=frontierSaloonCamera(finishCameraScene,0),
      finishFraming={x:finishCamera.centerX,y:finishCamera.centerY,scale:finishCamera.scale};
    finishCameraScene.brawl='INTERMISSION';frontierSaloonCamera(finishCameraScene,1000/60);`);
  check('finishCamera.centerX===finishFraming.x&&finishCamera.centerY===finishFraming.y&&finishCamera.scale===finishFraming.scale',
    'The final knockout keeps touch fight framing and zoom on its first finishing frame at '+width+'x'+height);
  probe('for(let i=0;i<156;i++)frontierSaloonCamera(finishCameraScene,1000/60);');
  check('finishCamera.centerX===finishFraming.x&&finishCamera.centerY===finishFraming.y&&finishCamera.scale===finishFraming.scale',
    'The full post-knockout interval keeps the same composition while the punch and fall finish');
  probe("finishCameraScene.brawl='ACTIVE';frontierSaloonCamera(finishCameraScene,1000/60);");
  check('finishCamera.centerX===finishFraming.x&&finishCamera.centerY===finishFraming.y&&finishCamera.scale===finishFraming.scale',
    'The next wave does not kick the camera into a different framing');
}
ctx.width=390;ctx.height=844;

probe(`_boxingWorldEffects.length=0;var feedbackParticles=particles.length;
  var feedbackEvent={outcome:'HIT',point:{x:13.5,y:-7.25,z:30},attacker:player};
  var feedbackHit=boxingEmitContactEffect(feedbackEvent,feedbackScene.boxingEffects);
  var feedbackBlock=boxingEmitContactEffect({...feedbackEvent,outcome:'BLOCK'},feedbackScene.boxingEffects);
  var feedbackParry=boxingEmitContactEffect({...feedbackEvent,outcome:'PARRY'},feedbackScene.boxingEffects);`);
check('feedbackHit.x===13.5&&feedbackHit.y===-7.25&&feedbackHit.ageMs===0', 'The impact starts at the actual resolved fist contact');
check('feedbackScene.boxingEffects.length===3&&_boxingWorldEffects.length===0&&particles.length===feedbackParticles', 'Saloon feedback stays local and cannot leak into outdoor particles');
check('feedbackBlock.radius<feedbackHit.radius&&feedbackHit.radius<feedbackParry.radius', 'Block sparks are smaller than hits and the parry has the largest burst');
check('feedbackParry.lifeMs>feedbackHit.lifeMs&&feedbackParry.rays>feedbackBlock.rays', 'A parry has a longer and denser distinct flash');
probe('var feedbackBeforeMiss=feedbackScene.boxingEffects.length;var feedbackMiss=boxingEmitContactEffect({...feedbackEvent,outcome:"MISS"},feedbackScene.boxingEffects);');
check('feedbackMiss===null&&feedbackScene.boxingEffects.length===feedbackBeforeMiss', 'A missed punch produces no contact feedback');
probe('var feedbackInvalid=boxingEmitContactEffect({...feedbackEvent,point:{x:NaN,y:0}},feedbackScene.boxingEffects);');
check('feedbackInvalid===null&&feedbackScene.boxingEffects.length===feedbackBeforeMiss', 'Invalid contacts cannot insert nonfinite drawing coordinates');
const originalLine = ctx.line;
let feedbackRays = 0, feedbackCoordinatesFinite = true;
ctx.line = (...args) => { feedbackRays++; feedbackCoordinatesFinite &&= args.every(Number.isFinite); return originalLine(...args); };
probe('boxingDrawContactEffects(feedbackScene.boxingEffects);');
ctx.line = originalLine;
assert.ok(feedbackRays > 20 && feedbackCoordinatesFinite, 'All three outcomes draw visible rays with finite coordinates'); count++;
probe('boxingAdvanceContactEffects(feedbackScene.boxingEffects,0);');
check('feedbackHit.ageMs===0', 'Paused local effects retain their age');
probe('for(let i=0;i<3;i++)boxingAdvanceContactEffects(feedbackScene.boxingEffects,100);');
check('feedbackScene.boxingEffects.length===1&&feedbackScene.boxingEffects[0]===feedbackParry', 'Hits and block sparks expire while the larger parry remains briefly');
probe('boxingAdvanceContactEffects(feedbackScene.boxingEffects,100);');
check('feedbackScene.boxingEffects.length===0', 'Expired feedback is removed completely');
probe('for(let i=0;i<300;i++)boxingEmitContactEffect(feedbackEvent);');
check('_boxingWorldEffects.length===BOXING_CONTACT_FX.maxCount', 'A crowded fight keeps a bounded contact effect pool');
check('_boxingWorldEffects[0].seed<_boxingWorldEffects[_boxingWorldEffects.length-1].seed', 'Capping retires old effects and retains contact order');
probe('for(let i=0;i<4;i++)boxingAdvanceContactEffects(_boxingWorldEffects,100);');
check('_boxingWorldEffects.length===0', 'World feedback also retires without leaving particles or permanent markers');
console.log(`Boxing camera and feedback: ${count} checks passed.`);

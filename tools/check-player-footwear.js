// Restore trouser-derived dark footwear across player poses, suits and death.
const assert=require('node:assert/strict');
const {ctx,probe}=require('./harness');
const P=s=>probe('('+s+')');
let checks=0;
const ok=(label,value)=>{assert.ok(value,label);checks++;};
ctx.setTimeout=()=>0;
probe(`started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
 currentLevel=currentBiome=2;BIOME_ACTIVE=false;resetUndergroundRoute();
 inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
 inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=false;
 inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;window.inNM0SecretOverlay=false;
 buildings=activeBuildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();
 leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:1,dy:0,dist:0};
 viewLeft=viewTop=-100000;viewRight=viewBottom=100000;
 setMeleeTool('NONE');jetpackUnlocked=false;
 ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
 player=new Character(0,0,true);player.isArmed=true;player.currentWeapon=WEAPONS.PISTOL;
 player.aimAngle=player.moveAngle=0;player.aimHold=0;player.walkCycle=1.3;player.gait=.7;
 player.isMoving=true;player.meleeTimer=player.reloadTimer=player.dashTimer=player.muzzleFlash=0;
 resetActorStance(player,'STAND');`);
ok('the yellow shoe override and palette are removed',
 P("typeof PLAYER_SHOE_COLOR==='undefined'&&typeof figureFootwearColor==='undefined'"));
const original=ctx.figureCelOval;let shoes=[];
ctx.figureCelOval=(...args)=>{
 const c=args[5]&&(args[5].levels||args[5]),pants=P('player.pantsCol.levels');
 if(c&&pants.slice(0,3).every((v,i)=>Math.abs(c[i]-v*.55)<1)&&args[3]>5&&args[3]<=11)
  shoes.push({w:args[3],h:args[4],color:c.slice(0,3)});
 return original(...args);
};
const draw=(label,code)=>{
 shoes=[];probe(code);
 ok(label+' paints both original dark shoes',shoes.length===2);
 ok(label+' keeps the original compact shoe outline',shoes.every(s=>s.w>0&&s.w<=11&&s.h>0&&s.h<=10));
};
try{
 draw('ordinary standing movement','player.show();');
 draw('aimed standing movement','player.aimHold=14;rightStick.active=true;frameCount++;player.show();');
 for(const stance of ['CROUCH','PRONE'])
  draw(stance,`rightStick.active=false;resetActorStance(player,'${stance}');player.show();`);
 for(const suit of ['chemistSuitUnlocked','ninjaSuitUnlocked','explosiveArmorUnlocked','cowboySuitEquipped']){
  draw(suit,`chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
   ${suit}=true;resetActorStance(player,'STAND');player.aimHold=0;player.show();`);
 }
 probe('chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;');
 draw('mantling','drawShovelMantleLegs(player,{lean:1,tuck:.5,fold:.3,plant:.4},figureRig(player.bodyW,player.bodyH));');
 draw('digging','drawShovelDigLegs(player,{blend:.7,effort:.4},figureRig(player.bodyW,player.bodyH));');
 draw('boxing','drawBoxingLegs(player,{hip:0,extension:.3},figureRig(player.bodyW,player.bodyH));');
 for(const death of [0,7])
  draw('fallen player type '+death,`window.__shoeCorpse=new Corpse(0,0,0,0,player.shirtCol,player.pantsCol,${death},0,[],WEAPONS.PISTOL,0,player.eType,player.bodyW,player.bodyH,player);
   __shoeCorpse.fP=1;__shoeCorpse.show();`);

}finally{ctx.figureCelOval=original;}
console.log(`${checks}/${checks} restored dark footwear, pose and corpse checks passed`);

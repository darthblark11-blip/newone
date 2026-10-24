// Player shoes are one identity material across poses and death, while NPC
// boots retain their original trousers-derived colour and every foot outline.
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
const yellow=P('PLAYER_SHOE_COLOR');
ok('the player shoe upper reads as yellow',yellow[0]>210&&yellow[1]>155&&yellow[2]<70);
ok('repeated player shoe painting reuses the shared palette',
 P('figureFootwearColor(player,player.pantsCol)===PLAYER_SHOE_COLOR&&figureFootwearColor(player,[2,2,2])===PLAYER_SHOE_COLOR'));
const npc=P('figureFootwearColor({isPlayer:false},[60,100,140])');
ok('NPC footwear retains the original dark trouser material',
 npc.every((value,i)=>Math.abs(value-[33,55,77][i])<1e-8));
ok('fading player bodies retain yellow footwear with their actual alpha',
 P('JSON.stringify(figureFootwearColor(figureIdentity(player),player.pantsCol,91))===JSON.stringify([...PLAYER_SHOE_COLOR,91])'));
ok('burned player remains retain their charred boot material',
 P('figureFootwearColor({isPlayer:true,isCharred:true},[20,20,20]).every(v=>v===11)'));

const original=ctx.figureCelOval;let shoes=[];
ctx.figureCelOval=(...args)=>{
 const c=args[5]&&(args[5].levels||args[5]);
 if(c&&yellow.every((v,i)=>c[i]===v))shoes.push({w:args[3],h:args[4]});
 return original(...args);
};
const draw=(label,code)=>{
 shoes=[];probe(code);
 ok(label+' paints both yellow shoes',shoes.length===2);
 ok(label+' keeps the original compact shoe outline',shoes.every(s=>s.w>0&&s.w<=11&&s.h>0&&s.h<=10));
};
try{
 draw('ordinary standing movement','player.show();');
 draw('aimed standing movement','player.aimHold=14;rightStick.active=true;frameCount++;updateDirectionalFootwork(player,1000/60);player.show();');
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
 shoes=[];probe('window.__shoeNpc=new Character(0,0,false,"NORMAL");__shoeNpc.show();');
 ok('ordinary NPC painting never acquires player shoe colours',shoes.length===0);
}finally{ctx.figureCelOval=original;}
console.log(`${checks}/${checks} player shoe identity, material, pose and corpse checks passed`);

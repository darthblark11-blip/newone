// Exercise purchases through their real touch targets, native firing/reload,
// reward ownership, outfit swaps and the living/fallen rendering paths.
const {ctx,probe,calls}=require('./harness');
const P=s=>probe('('+s+')');let checks=0,fails=0;
function ok(n,v,d){checks++;if(!v)fails++;console.log((v?'  ok   ':'  FAIL ')+n+(d===undefined?'':'  '+d));}
probe(`isStoryMode=false;currentLevel=3;BIOME_ACTIVE=false;started=true;doTick=true;
player=new Character(5000,5000,true);enemiesList=[];buildings=[];cars=[];
leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};
rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
window.milLvl=0;window.farmLvl=0;swordPickedUp=false;setMeleeTool('NONE');
ninjaSuitUnlocked=false;explosiveArmorUnlocked=false;chemistSuitUnlocked=false;
viewLeft=-1e6;viewRight=1e6;viewTop=-1e6;viewBottom=1e6;
resetFrontierEquipment();width=390;height=844;`);
function tap(id){return P(`(()=>{const a=upgradeShopItems(),i=a.findIndex(q=>q.id==='${id}'),L=upgradeShopLayout(a.length);return handleShopClicks(L.startX+(i%L.cols)*L.spacingX,L.startY+Math.floor(i/L.cols)*L.spacingY);})()`);}
probe('score=99;');ok('99 score cannot buy the revolver',!tap('REVOLVER')&&P('!revolverUnlocked&&score===99'));
probe('score=100;');ok('real revolver touch target costs exactly 100',tap('REVOLVER')&&P('score===0&&revolverUnlocked&&player.currentWeapon===WEAPONS.REVOLVER'));
ok('purchase loads six rounds and three finite speed loaders',P('player.ammo===6&&player.mags.REVOLVER===3'));
probe('score=100;player.ammo=1;player.mags.REVOLVER=0;');
ok('repeated refill still costs 100 and restores ammo',tap('REVOLVER')&&P('score===0&&player.ammo===6&&player.mags.REVOLVER===3'));
probe('player.currentWeapon=WEAPONS.PISTOL;');const cycle=P('cyclePlayerWeapon(1)');
ok('keyboard weapon cycle reaches earned revolver',cycle&&P('player.currentWeapon===WEAPONS.REVOLVER'));
const damage=P('[player.currentWeapon.bodyDmg,player.currentWeapon.headDmg]');
ok('revolver keeps its magnum damage',damage[0]===75&&damage[1]===250);
probe('player.aimAngle=0;player.isMoving=false;player.isArmed=true;player.fireTimer=0;player.reloadTimer=0;bullets.length=0;');
probe('player.fire(player.aimAngle);');ok('native shot consumes one round and uses revolver cooldown',P('player.ammo===5&&player.fireTimer===53&&bullets.length===1&&bullets[0].w===WEAPONS.REVOLVER'));
ok('native bullet starts at the new model muzzle',P('Math.abs(bullets[0].x-player.x-47)<.001&&Math.abs(bullets[0].y-player.y-11)<.001'));
probe('player.triggerReload();');ok('reload consumes one finite loader',P('player.ammo===0&&player.reloadTimer===90&&player.mags.REVOLVER===2'));
probe('player.mags.REVOLVER=0;player.reloadTimer=0;player.triggerReload();');
ok('empty reserve holsters revolver safely',P('player.currentWeapon===WEAPONS.PISTOL&&player.reloadTimer===0'));
probe('score=500;');ok('cowboy cannot be purchased before duel reward',!tap('COWBOY')&&P('!cowboyCostumeOwned&&!cowboySuitEquipped&&score===500'));
ok('duel awards ownership immediately once',P('awardCowboyCostume()')&&!P('awardCowboyCostume()')&&P('cowboyCostumeOwned&&!cowboySuitEquipped'));
probe('ninjaSuitUnlocked=true;window.ninjaOwned=true;');ok('earned cowboy equips free and removes prior suit',tap('COWBOY')&&P('cowboySuitEquipped&&!ninjaSuitUnlocked&&!chemistSuitUnlocked&&!explosiveArmorUnlocked&&score===500'));
ok('player has a separate cel shaded western hat',P(`headwearOf(player)==='FRONTIER_STETSON'`));
probe('window.__westernIdentity=figureIdentity(player);');tap('NINJA');
ok('switching to an owned suit is free and exclusive',P('ninjaSuitUnlocked&&!cowboySuitEquipped&&score===500'));
ok('fallen identity keeps awarded outfit after a live swap',P(`__westernIdentity.cowboySuit&&headwearOf(__westernIdentity)==='FRONTIER_STETSON'`));
probe('window.chemistOwned=true;');tap('CHEMIST');
ok('chemist and cowboy outfits remain exclusive',P('chemistSuitUnlocked&&!ninjaSuitUnlocked&&!cowboySuitEquipped&&score===500'));
tap('COWBOY');probe('player.weaponAmmo.REVOLVER=4;player.mags.REVOLVER=1;');const saved=P('JSON.stringify(serializeFrontierEquipment())');
probe('resetFrontierEquipment();');ok('new campaign resets earned gear',P('!revolverUnlocked&&!cowboyCostumeOwned&&!cowboySuitEquipped'));
probe(`restoreFrontierEquipment(JSON.parse(${JSON.stringify(saved)}));`);
ok('saved ownership and chosen outfit restore',P('revolverUnlocked&&cowboyCostumeOwned&&cowboySuitEquipped&&!chemistSuitUnlocked'));
probe('restoreFrontierEquipment({cowboyOwned:false,cowboyEquipped:true,revolverUnlocked:"yes"});');
ok('malformed saves cannot equip an unearned cowboy outfit',P('!cowboySuitEquipped&&!cowboyCostumeOwned&&!revolverUnlocked'));
probe(`restoreFrontierEquipment(JSON.parse(${JSON.stringify(saved)}));window.__newFrontierPlayer=new Character(0,0,true);applyFrontierEquipment(__newFrontierPlayer);`);
ok('saved player receives the exact remaining rounds and reserve',P('__newFrontierPlayer.weaponAmmo.REVOLVER===4&&__newFrontierPlayer.mags.REVOLVER===1'));
probe('__newFrontierPlayer.weaponAmmo.REVOLVER=2;applyFrontierEquipment(__newFrontierPlayer);');
ok('reapplying equipment does not mint ammo during play',P('__newFrontierPlayer.weaponAmmo.REVOLVER===2'));
for(const [w,h] of [[390,844],[320,568],[800,390]]){
  probe(`width=${w};height=${h};`);
  const l=P('upgradeShopLayout(upgradeShopItems().length)'),n=P('upgradeShopItems().length');
  let inside=true;
  for(let i=0;i<n;i++){const x=l.startX+(i%l.cols)*l.spacingX,y=l.startY+Math.floor(i/l.cols)*l.spacingY;inside&&=x-l.boxW/2>=0&&x+l.boxW/2<=w&&y-l.boxH/2>=100&&y+l.boxH/2<h-70;}
  ok(`${w}x${h} shop targets stay onscreen above footer`,inside);
}
const originalText=ctx.text,labels=[];ctx.text=(s)=>labels.push(String(s));
probe('width=390;height=844;score=500;drawUpgradeMenu();');ctx.text=originalText;
ok('shop labels advertise actual revolver and rocket refill costs',labels.includes('REFILL & EQUIP: 100')&&labels.includes('REFILL & EQUIP: 1000'));
const oldSolid=ctx.drawRevolverSolid,oldAttire=ctx.drawCowboyAttire,oldHat=ctx.drawHeadwear;
let solids=0,attire=0,hats=0;
ctx.drawRevolverSolid=function(...a){solids++;return oldSolid(...a);};
ctx.drawCowboyAttire=function(...a){attire++;return oldAttire(...a);};
ctx.drawHeadwear=function(g,id,kind){if(kind==='FRONTIER_STETSON')hats++;return oldHat(g,id,kind);};
for(const state of ['walk','jog','run','aim','fire','reload']){
  const before=solids;
  probe(`player.currentWeapon=WEAPONS.REVOLVER;player.weaponAmmo.REVOLVER=6;
  player.gait=${state==='walk'?.2:state==='jog'?.55:.95};player.isMoving=${['walk','jog','run'].includes(state)};
  player.walkCycle=.8;player.moveAngle=.7;player.aimAngle=.7;player.isArmed=true;
  player.meleeTimer=0;player.dashTimer=0;player.throwAnimTimer=0;player.cannonCharge=0;player.cannonFireDelay=0;
  rightStick.active=${['aim','fire','reload'].includes(state)};player.aimHold=${state==='aim'?14:0};
  player.reloadTimer=${state==='reload'?50:0};player.weaponKick=${state==='fire'?5:0};player.muzzleFlash=${state==='fire'?3:0};player.show();`);
  ok(state+' paints the shared 3D revolver',solids>before);
}
ok('living costume renders vest and hat',attire>=6&&hats>=6);
const beforeAttire=attire,beforeHats=hats;
probe('drawFallenAttire(window,__westernIdentity,30,20,true);drawFallenHead(window,__westernIdentity,{faceDown:true},1,true);');
ok('fallen costume uses shared vest and hat art',attire>beforeAttire&&hats>beforeHats);
ctx.drawRevolverSolid=oldSolid;ctx.drawCowboyAttire=oldAttire;ctx.drawHeadwear=oldHat;
console.log(`\n${checks-fails}/${checks} checks passed`);process.exitCode=fails?1:0;

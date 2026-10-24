// Preview the actual corpse and stunned-body painters; no duplicated art.
const fs=require('fs'),path=require('path'),{figureCanvas}=require('./figure-canvas'),{ctx,probe}=require('./harness');
const out=path.join(__dirname,'out');fs.mkdirSync(out,{recursive:true});
const cases=[
 ['Pistol regular / back','NORMAL',false,'',true],['Pistol regular / front','NORMAL',false,'',false],
 ['Player / back','NORMAL',true,'',true],['Female pistol','FEMALE_PISTOL'],
 ['NM-0 rookie','NM0_ROOKIE'],['Female rookie','NM0_ROOKIE_F'],['Grey fatigue','NM0_GREY_FATIGUE'],['Military neutral','MILITARY_NEUTRAL'],
 ['City guard','NM0_CITY_GUARD'],['Armored regular','ARMORED_STANDARD'],['Red-orb hybrid / original death','ARMORED'],
 ['Aerial rifle','AERIAL'],['Aerial pistol','AERIAL_PISTOL'],['Molotov carrier','MOLOTOV'],['SIA','SIA'],['Dad','DAD'],
 ['Farmer / overalls','FARMER_MALE'],['Farmer / apron ties','FARMER_FEMALE'],['Cowboy / leather vest','COWBOY'],['Cowgirl / vest & braid','COWGIRL'],
 ['Bandit / duster','BANDIT'],['Local cop / coat','LOCAL_COP'],['Villager / braces','VILLAGER_MALE'],['Villager / pinafore','VILLAGER_FEMALE'],
 ['City / jacket','CITY_CITIZEN_M',false,'clothingStyle=1'],['City / suspenders','CITY_CITIZEN_M',false,'clothingStyle=2'],['City / striped shirt','CITY_CITIZEN_F',false,'clothingStyle=3'],
 ['Player / ninja','NORMAL',true,'ninjaSuitUnlocked'],['Player / chemist','NORMAL',true,'chemistSuitUnlocked'],['Player / armor','NORMAL',true,'explosiveArmorUnlocked'],['Player / jetpack','NORMAL',true,'jetpackUnlocked'],
 ['Bug / carapace','BUG'],['Snail / shell','SNAIL'],['Hybrid / spiral shell','SNAIL_HYBRID'],['Cow / hide','COW'],['Horse / mane','HORSE'],['Gator / dorsal scales','ALIEN_GATOR'],['Robot / service panel','ROBOT']
];
let seed=8831;ctx.random=(a,b)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;const v=seed/4294967296;
 return a===undefined?v:Array.isArray(a)?a[Math.floor(v*a.length)]:b===undefined?v*a:a+(b-a)*v;};
probe(`currentLevel=1;BIOME_ACTIVE=false;frameCount=1000;buildings=[];activeBuildings=[];barrels=[];activeParkingCars=[];invalidateColIndex();rightStick={active:false,dx:0,dy:0,dist:0};leftStick={active:false,dx:0,dy:0};window.__backs=[];`);
for(const [label,type,player=false,variant='',back=true] of cases){
 probe(`ninjaSuitUnlocked=chemistSuitUnlocked=explosiveArmorUnlocked=jetpackUnlocked=false;
 ${variant.endsWith('Unlocked')?variant+'=true;':''}
 window.e=new Character(0,0,${player},'${type}');${variant.startsWith('clothing')?'e.'+variant+';':''}
 e.aimAngle=${back?-Math.PI/2:Math.PI/2};e.moveAngle=-HALF_PI;e.isMoving=true;rememberFigureMotion(e,0,-4);
 if('${type}'.startsWith('CITY_')){e.hairStyle=3;e.hairCol=color(76,45,30);}
 if(e.isPlayer)e.show();
 window.c=new Corpse(0,0,e.moveAngle,e.aimAngle,e.shirtCol,e.pantsCol,0,0,[],e.currentWeapon,-HALF_PI,e.eType,e.bodyW,e.bodyH,e);
 for(let i=0;i<60;i++){frameCount++;c.update();}c.aA=c.mA=-HALF_PI;
 __backs.push(c);`);
}
function render(indices,cols,cellW,cellH,file,title){
 const rows=Math.ceil(indices.length/cols),width=cols*cellW+24,height=rows*cellH+98;
 const {canvas,c,g}=figureCanvas(width,height);ctx.__backPaint=g;
 c.fillStyle='#1c2831';c.fillRect(0,0,width,height);c.fillStyle='#eee8ce';c.font='24px sans-serif';c.fillText(title,20,32);
 c.fillStyle='#adc8cc';c.font='14px sans-serif';c.fillText('Actual game corpse painters / bald heads keep skin / clothing beneath wounds',20,58);
 indices.forEach((index,n)=>{
  const x=12+(n%cols)*cellW,y=78+Math.floor(n/cols)*cellH;
  c.fillStyle='#a0aaa5';c.beginPath();c.roundRect(x,y,cellW-12,cellH-12,7);c.fill();
  c.fillStyle='#172f36';c.font=`${cellW>280?18:12}px sans-serif`;c.fillText(cases[index][0],x+12,y+25);
  let scale=cellW>280?2.7:1.7;
  if(['ARMORED','ALIEN_GATOR','SNAIL_HYBRID'].includes(cases[index][1]))scale*=.53;
  if(['COW','HORSE'].includes(cases[index][1]))scale*=.85;
  c.save();c.beginPath();c.rect(x,y+34,cellW-12,cellH-50);c.clip();
  g.push();g.translate(x+(cellW-12)/2,y+cellH*.48);g.scale(scale);
  probe(`__backPaint.translate(-__backs[${index}].x,-__backs[${index}].y);__backs[${index}].show(__backPaint);`);
  g.pop();c.restore();if(!g.balanced())throw Error('Unbalanced corpse preview');
 });
 fs.writeFileSync(path.join(out,file),canvas.toBuffer('image/png'));
}
render([0,1,2,8,16,18],3,350,340,'corpse-backs.png','BALD HEADS + NMO INSIGNIA + DISTINCT BACKS');
render(cases.map((_,i)=>i),6,210,240,'corpse-back-gallery.png','ENTITY BACKS / ACTUAL CORPSE DRAWING');
console.log('Rendered corpse-backs.png and corpse-back-gallery.png');

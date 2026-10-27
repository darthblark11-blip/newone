// Native projectiles and native figure/decal painters. One persistent mark per
// fixture; particles/floor pools are omitted so the attached wound stays visible.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const deps=process.env.VIS_DEPS||'/workspace/newone-dev';
const {chromium}=require(path.join(deps,'node_modules/playwright'));
const source=fs.readFileSync(process.env.GAME_JS||path.join(__dirname,'../game.js'),'utf8');
const p5=fs.readFileSync(process.env.VIS_P5||path.join(deps,'node_modules/p5/lib/p5.min.js'),'utf8');
const out=process.env.CALIBER_DECAL_OUT||'/tmp/newone-caliber-body-decals';fs.mkdirSync(out,{recursive:true});
const weapons=['PISTOL','SMG','DUAL_SMG','ASSAULT_RIFLE','SHOTGUN','COACH_GUN','REVOLVER'];
const tierFor=key=>['PISTOL','SMG','DUAL_SMG'].includes(key)?'LIGHT':key==='REVOLVER'?'HEAVY':'MEDIUM';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.VIS_CHROME||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1800,height:1640},deviceScaleFactor:1}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<style>html,body{margin:0;overflow:hidden}</style><script>Object.defineProperty(window,"localStorage",{value:{getItem(){return null},setItem(){},removeItem(){}}});</script><script>'+p5+'</script><script>'+source+'</script><script>preload=function(){};draw=function(){};windowResized=function(){};setup=function(){createCanvas(1800,1640);pixelDensity(1);noLoop();window.__ready=true;};</script>');
  await page.waitForFunction('__ready');
  await page.evaluate(()=>{
   resetRunState();resetUndergroundRoute();currentLevel=currentBiome=1;BIOME_ACTIVE=false;
   isStoryMode=false;started=doTick=true;isPaused=isDead=isWin=killcamMode=false;
   inStoryIntro=inStoryRoom=inTownCutscene=inFortCutscene=inPostAmbushCutscene=false;
   inFarmCutscene=inFarmPostCutscene=inLvl4Cutscene=inDarchonCall=inWorldBuildingMenu=inTravelMenu=inUpgradeMenu=false;
   window.inNM0SecretOverlay=false;buildGhost=null;nm0AmbushActive=farmAmbushActive=false;
   buildings=activeBuildings=[];activeParkingCars=[];parkingCars=[];barrels=[];enemiesList=[];corpses=[];particles=[];bullets=[];
   invalidateColIndex();setMeleeTool('NONE');jetpackUnlocked=false;
   chemistSuitUnlocked=ninjaSuitUnlocked=explosiveArmorUnlocked=cowboySuitEquipped=false;
   leftStick={active:false,dx:0,dy:0};rightStick={active:false,dx:0,dy:0,dist:0};
   player=new Character(10000,10000,true);player.currentWeapon=WEAPONS.PISTOL;
   viewLeft=viewTop=-100000;viewRight=viewBottom=100000;zoom=1;camX=camY=0;
   window.setTimeout=()=>0;window.__caliberFixtures=[];window.__caliberStack={depth:0,minDepth:0};
   const oldPush=window.push,oldPop=window.pop;
   window.push=function(...a){__caliberStack.depth++;return oldPush(...a);};
   window.pop=function(...a){__caliberStack.depth--;__caliberStack.minDepth=Math.min(__caliberStack.minDepth,__caliberStack.depth);return oldPop(...a);};
   window.__caliberMake=(key,index,zone='BODY',type='NORMAL',hp=900)=>{
    // Equal native RNG starts keep legacy per-hit size jitter and actor traits
    // comparable across calibers; the real shot IDs still vary wound geometry.
    frameCount++;randomSeed(1000);particles=[];bullets=[];corpses=[];enemiesList=[];
    const e=new Character(0,0,false,type);e.hp=hp;e.maxHp=Math.max(e.maxHp,hp);e.shield=0;
    e.aimAngle=e.moveAngle=-Math.PI/2;e.isMoving=false;e.isArmed=true;e.isFriendly=e.isNeutral=false;
    e.name='';e.muzzleFlash=e.reloadTimer=e.meleeTimer=e.weaponKick=e.hitFlash=e.walkCycle=e.gait=0;
    resetActorStance(e,'STAND');enemiesList=[e];const before=e.hp;
    const bullet=spawnBullet(-90,0,0,true,zone,WEAPONS[key],player);doTick=true;
    for(let i=0;i<16&&bullet.active;i++){frameCount++;updateBullets();}
    if(e.hp>=before)throw Error('Native projectile failed to hit '+key+'/'+zone+'/'+type);
    const d=e.decals[e.decals.length-1];if(!d)throw Error('Native projectile left no decal');
    e.hitFlash=0;e.stanceDamage=null;
    const f={key,zone,type,e,d,hpBefore:before,hpAfter:e.hp,bullet:{x:bullet.x,y:bullet.y,a:bullet.a},original:JSON.stringify(e.decals)};
    __caliberFixtures.push(f);return f;
   };
   window.__caliberPaint=(f,x,y,scaleBy=1)=>{
    const before=JSON.stringify(f.e.decals);doTick=false;frameCount++;
    push();translate(x,y);scale(scaleBy);f.e.show();pop();
    if(JSON.stringify(f.e.decals)!==before)throw Error('Figure painting mutated wound geometry');
    return {key:f.key,zone:f.zone,type:f.type,hpBefore:f.hpBefore,hpAfter:f.hpAfter,
     decal:{...f.d},stack:{...__caliberStack}};
   };
   window.__caliberCard=(x,y,w,h,title,subtitle='')=>{
    noStroke();fill(20,31,35);rect(x,y,w,h,10);textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);
    fill(218,232,224);textSize(13);text(title,x+w/2,y+12);fill(148,182,174);textSize(11);if(subtitle)text(subtitle,x+w/2,y+33);
   };
   window.__caliberBack=(title,subtitle)=>{
    background(30,43,47);noStroke();textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);
    fill(235,241,226);textSize(23);text(title,width/2,15);fill(163,192,183);textSize(12);text(subtitle,width/2,48);
   };
   window.__caliberMacro=(d,x,y,scaleBy=10,material='cloth')=>{
    push();translate(x,y);scale(scaleBy);noStroke();
    fill(material==='skin'?color(229,174,135):color(200,183,97));rect(-10,-9,20,18,2);
    const before=JSON.stringify(d);drawBodyImpactDecal(window,d,0,0,d.sz,1,0);
    if(JSON.stringify(d)!==before)throw Error('Decal painter mutated persistent metadata');pop();
   };
  });
  const weaponRecords=await page.evaluate(weapons=>{
   __caliberBack('CALIBER / PERSISTENT BODY BULLET DECALS','Actual native projectiles. One round or pellet per target; persistent skin/clothing marks shown after the contact particles have ended.');
   const records=[];
   for(let i=0;i<weapons.length;i++){
    const f=__caliberMake(weapons[i],i),y=82+i*219,tier=f.d.fleshCaliber;
    __caliberCard(10,y,1780,207,weapons[i]+' / '+tier,'Native 1× · figure 3× · same persistent wound at 8× on cloth and skin');
    records.push(__caliberPaint(f,150,y+112,1));__caliberPaint(f,390,y+120,3);
    __caliberMacro(f.d,870,y+116,8,'cloth');__caliberMacro(f.d,1330,y+116,8,'skin');
   }return records;
  },weapons);
  for(const r of weaponRecords){assert.equal(r.decal.fleshCaliber,tierFor(r.key));assert.equal(r.stack.depth,0);assert.equal(r.stack.minDepth,0);}
  await page.locator('canvas').first().screenshot({path:path.join(out,'caliber-weapon-comparison.png')});
  await page.setViewportSize({width:1800,height:1080});
  const stanceRecords=await page.evaluate(()=>{
   resizeCanvas(1800,1080);__caliberBack('ATTACHED WOUNDS / STANCES AND FALLEN FIGURES','The same actual hit remains fixed to its original figure through standing, crouch, prone and the native settled corpse painter.');
   const records=[],keys=['PISTOL','ASSAULT_RIFLE','REVOLVER'],poses=['STAND','CROUCH','PRONE','CORPSE'];
   for(let row=0;row<3;row++){
    const f=__caliberMake(keys[row],30+row);f.e.currentWeapon=WEAPONS.PISTOL;
    const c=new Corpse(f.e.x,f.e.y,f.e.moveAngle,f.e.aimAngle,f.e.shirtCol,f.e.pantsCol,0,0,f.e.decals,f.e.currentWeapon,0,f.e.eType,f.e.bodyW,f.e.bodyH,f.e);
    for(let i=0;i<50;i++){frameCount++;c.update();}c.fatalSpray=null;
    for(let col=0;col<4;col++){
     const x=col*450+8,y=84+row*325;__caliberCard(x,y,434,309,keys[row]+' / '+poses[col],f.d.fleshCaliber+' · native painter 3×');
     if(col===3){push();translate(x+220,y+190);scale(3);translate(-c.x,-c.y);c.show();pop();}
     else{resetActorStance(f.e,poses[col]);records.push(__caliberPaint(f,x+217,y+185,3));}
    }
   }return records;
  });
  assert(stanceRecords.every(r=>r.stack.depth===0&&r.stack.minDepth===0));
  await page.locator('canvas').first().screenshot({path:path.join(out,'caliber-stance-and-corpse.png')});
  const legRecords=await page.evaluate(()=>{
   resizeCanvas(1800,1080);__caliberBack('LEG WOUNDS / FOUR STEPS OF THE ORIGINAL NATIVE GAIT','One real low-elevation projectile per row. The wound follows its own shin; every frame uses the actual leg painter and attachment data.');
   const records=[],keys=['PISTOL','ASSAULT_RIFLE','REVOLVER'];
   for(let row=0;row<3;row++){
    const f=__caliberMake(keys[row],50+row,'LEGS');f.e.isMoving=true;f.e.gait=.65;f.e.moveAngle=f.e.aimAngle;
    for(let col=0;col<4;col++){
     const x=col*450+8,y=84+row*325;frameCount++;f.e.walkCycle=col*Math.PI/2;f.e.hitFlash=0;
     __caliberCard(x,y,434,309,keys[row]+' / STEP '+(col+1),f.d.fleshCaliber+' · native painter 3×');
     records.push(__caliberPaint(f,x+217,y+185,3));
    }
   }return records;
  });
  assert(legRecords.every(r=>r.decal.isLeg&&r.stack.depth===0&&r.stack.minDepth===0));
  await page.locator('canvas').first().screenshot({path:path.join(out,'caliber-leg-attachment.png')});
  await page.setViewportSize({width:1600,height:660});
  const controls=await page.evaluate(()=>{
   resizeCanvas(1600,660);__caliberBack('PRESERVED CONTROLS / EXISTING NON-FLESH AND HEAD MARKS','Caliber art is limited to eligible human body/leg flesh hits. Existing helmet/metal marks, animal wounds and headshot decals remain on their native paths.');
   const cases=[['NORMAL / HEAD','NORMAL','HEAD',900],['NM0 / PLATE','ARMORED_STANDARD','BODY',900],['ROBOT / METAL','ROBOT','BODY',900],['COW / BODY','COW','BODY',900]],records=[];
   for(let i=0;i<cases.length;i++){
    const [name,type,zone,hp]=cases[i],f=__caliberMake('REVOLVER',70+i,zone,type,hp),x=i*400+8;
    __caliberCard(x,87,384,552,name,'Unchanged native decal · 3×');
    records.push(__caliberPaint(f,x+192,340,type==='COW'?1.8:3));
    textFont('sans-serif');textStyle(NORMAL);textAlign(CENTER,TOP);textSize(11);fill(148,182,174);
    text('Caliber tag: '+(f.d.fleshCaliber||'none'),x+192,598);
   }return records;
  });
  assert(controls.every(r=>!r.decal.fleshCaliber&&r.stack.depth===0&&r.stack.minDepth===0));
  await page.locator('canvas').first().screenshot({path:path.join(out,'caliber-preserved-controls.png')});
  assert.deepEqual(errors,[],'native caliber decal review produced browser errors');
  fs.writeFileSync(path.join(out,'review.json'),JSON.stringify({weaponRecords,stanceRecords,legRecords,controls,errors},null,2));
  console.log(`Native caliber decal review passed: ${weaponRecords.length} actual weapon routes, ${stanceRecords.length} stance figures, ${legRecords.length} leg phases and ${controls.length} preserved controls. Previews: ${out}`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exit(1);});

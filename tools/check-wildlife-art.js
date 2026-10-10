// Wildlife art and ecology review: real Canvas pixels expose stale painter
// state; actual resident chunks expose encounter and movement mistakes.
// VIS_DEPS, VIS_CHROME and VIS_P5_FILES use the same external setup as visual.js.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { probe } = require('./harness');
let behaviorChecks = 0;
function ok(code, message) { assert.ok(probe(code), message); behaviorChecks++; }
probe(`
  currentBiome=currentLevel=2;BIOME_ACTIVE=true;isStoryMode=false;
  authoredCore=authoredMask=authoredChunks=null;biomeState={};
  isPaused=isDead=isWin=killcamMode=false;doTick=true;
  inDarchonCall=inTownCutscene=inFarmCutscene=inFarmPostCutscene=false;
  inPostAmbushCutscene=inFortCutscene=inWorldBuildingMenu=false;
  inOverworldView=inTravelMenu=inStoryIntro=false;
  player={x:15000,y:6600,hp:300,isPlayer:true,takeDamage(n,source){this.hp-=n;this.lastAttacker=source;}};
  viewLeft=14400;viewRight=15600;viewTop=6200;viewBottom=7000;
  chunkMgr=new ChunkManager(2);chunkMgr.refreshResidency(12,5);
  chunkMgr.rebuildWorldArrays();buildColIndex();
  restoreForestWildlife({seed:354});
  var wildlifeArtHerdSize=wildlifeSpawnEncounter();
`);
ok(`wildlifeArtHerdSize>=20&&forestWildlife.every(a=>a.species==='ELK')`,
  'A large elk herd actually spawns among resident forest geometry');
ok(`forestWildlife.every(a=>!inView(a.x,a.y,a.bodyR+100)&&wildlifeCanStand(a,a.x,a.y))`,
  'Every member starts off screen and outside a solid');
ok(`forestWildlife.every(a=>!groundReserved(2,Math.floor(a.x/CHUNK_W),Math.floor(a.y/CHUNK_W),a.x,a.y,(WILDLIFE_SPECIES[a.species].size+18)*2,(WILDLIFE_SPECIES[a.species].size+18)*2,24))`,
  'The large herd leaves actual army routes clear');
probe(`
  _wildlifeSpawnClock=1e9;
  var wildlifeArtArmyCount=enemiesList.length;
  for(let i=0;i<300;i++)updateForestWildlife(1);
`);
ok(`forestWildlife.every(a=>wildlifeCanStand(a,a.x,a.y))`,
  'Five seconds of a dense herd do not walk through trunks or compound walls');
ok(`enemiesList.length===wildlifeArtArmyCount`, 'Herds never become military objective actors');
probe(`
  var wildlifeArtSeed=serializeForestWildlife().seed;
  var wildlifeArtChunkBefore=JSON.stringify(generateChunkContent(2,20,8));
  for(let i=0;i<100;i++)wildlifeRandom();
  var wildlifeArtChunkAfter=JSON.stringify(generateChunkContent(2,20,8));
`);
ok(`wildlifeArtChunkBefore===wildlifeArtChunkAfter`, 'Encounter RNG never changes procedural prop identities');
probe(`
  resetForestWildlife();activeBuildings=[];colGrid=null;chunkMgr=null;
  var wildlifeArtPredator=wildlifeSpawnAnimal('BLACK_BEAR',player.x+25,player.y);
  applyForestWildlifeHit(wildlifeArtPredator,{weapon:'PISTOL',damage:1,head:false,shotId:1,owner:player});
  wildlifeBrain(wildlifeArtPredator);_wildlifeSpawnClock=1e9;updateForestWildlife(1);
`);
ok(`wildlifeArtPredator.state==='TERRITORIAL'&&player.hp===282&&player.lastAttacker===wildlifeArtPredator`,
  'A player-wounded bear defends itself and attributes its real player damage');
probe(`for(let i=0;i<10;i++)updateForestWildlife(1);`);
ok(`player.hp===282`, 'A predator attack has a cooldown rather than doing damage each frame');
probe(`
  resetForestWildlife();player.hp=300;
  wildlifeArtPredator=wildlifeSpawnAnimal('BLACK_BEAR',player.x+25,player.y);
  applyForestWildlifeHit(wildlifeArtPredator,{weapon:'PISTOL',damage:1,head:false,shotId:2,owner:{x:player.x-50,y:player.y,isPlayer:false}});
  wildlifeBrain(wildlifeArtPredator);_wildlifeSpawnClock=1e9;updateForestWildlife(1);
`);
ok(`wildlifeArtPredator.state==='FLEE'&&player.hp===300`, 'Enemy crossfire does not make a predator blame the player');
probe(`
  applyForestWildlifeHit(wildlifeArtPredator,{weapon:'PISTOL',damage:1,head:false,shotId:3,owner:player});
  player={x:15000,y:6600,hp:300,isPlayer:true,takeDamage(){throw Error('old predator attacked a replacement player');}};
  wildlifeBrain(wildlifeArtPredator);
`);
ok(`wildlifeArtPredator.state==='FLEE'&&!wildlifeArtPredator.aggressor`, 'A replaced player does not inherit an old wildlife grievance');
for (const flag of ['inTravelMenu','inOverworldView','inStoryIntro']) {
  probe(`var wildlifeArtFrozen=wildlifeArtPredator.clock;${flag}=true;updateForestWildlife(1);${flag}=false;`);
  ok(`wildlifeArtPredator.clock===wildlifeArtFrozen`, flag+' pauses ecological time');
}
probe(`BIOME_ACTIVE=false;updateForestWildlife(1);`);
ok(`!forestWildlife.length`, 'Leaving streaming gameplay releases live wildlife');
// Exercise the real actor dispatch and crown queue together.
probe(`
  BIOME_ACTIVE=true;currentBiome=currentLevel=2;viewLeft=viewTop=-1000;viewRight=viewBottom=1000;
  __wildlifeArtEvents=[];resetForestWildlife();activeBuildings=[];
  paintForestClutter=function(g,d,t,phase){__wildlifeArtEvents.push('tree:'+phase);};
  paintWildlifeAnimal=function(a){__wildlifeArtEvents.push(a.species);};
  _standDecor=[{t:'PINE',x:0,y:0,forestSpecies:'DOUGLAS_FIR'}];
  _depthActors=[];_depthOn=true;
  wildlifeSpawnAnimal('ELK',0,100);wildlifeSpawnAnimal('BALD_EAGLE',0,-100);
  drawForestWildlifeAnimals();drawDepthSorted();drawForestWildlifeAirborne();
`);
ok(`__wildlifeArtEvents.indexOf('ELK')<__wildlifeArtEvents.indexOf('tree:crown')&&__wildlifeArtEvents.indexOf('BALD_EAGLE')>__wildlifeArtEvents.indexOf('tree:crown')`,
  'Ground animals stand under crowns and living flying birds pass above them');
ok(`!_wildlifeBirdDrawQueue.length&&!_depthActors.length&&!_forestCrowns.length`, 'Wildlife depth queues close every frame');

const deps = process.env.VIS_DEPS || '/workspace/onboarding-newone';
const { chromium } = require(path.join(deps, 'node_modules/playwright'));
const files = process.env.VIS_P5_FILES ? process.env.VIS_P5_FILES.split(path.delimiter) :
  [path.join(deps, 'node_modules/p5/lib/p5.min.js')];
const source = fs.readFileSync(process.env.GAME_JS || path.join(__dirname, '..', 'game.js'), 'utf8');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.VIS_CHROME || '/usr/bin/chromium',
    headless:true,args:['--no-sandbox','--disable-gpu']});
  try {
    for (const file of files) {
      const page=await browser.newPage(), errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.setContent('<script>'+fs.readFileSync(file,'utf8')+'</script><script>'+source+
        '</script><script>window.preload=function(){};window.setup=function(){createCanvas(256,256);pixelDensity(1);noLoop();window.__ready=true;};window.draw=function(){};</script>');
      await page.waitForFunction(()=>window.__ready);
      const result=await page.evaluate(()=>{
        currentBiome=currentLevel=2;BIOME_ACTIVE=true;zoom=1;LIGHT_DX=.6;LIGHT_DY=.8;
        const failures=[];let comparisons=0,styleChecks=0,poseChecks=0;
        function snapshot(a) {
          clear();fill(191,37,101);stroke(71,169,223);strokeWeight(3.25);
          const ctx=drawingContext, transform=ctx.getTransform();
          const before=[ctx.fillStyle,ctx.strokeStyle,ctx.lineWidth,ctx.globalAlpha,ctx.globalCompositeOperation,transform.a,transform.b,transform.c,transform.d,transform.e,transform.f];
          ctx.save();ctx.translate(128,128);paintWildlifeAnimal(a);ctx.restore();
          const afterTransform=ctx.getTransform();
          const after=[ctx.fillStyle,ctx.strokeStyle,ctx.lineWidth,ctx.globalAlpha,ctx.globalCompositeOperation,afterTransform.a,afterTransform.b,afterTransform.c,afterTransform.d,afterTransform.e,afterTransform.f];
          styleChecks++;if(JSON.stringify(before)!==JSON.stringify(after))failures.push({species:a.species,styleLeak:true});
          return ctx.getImageData(0,0,256,256).data;
        }
        for(let i=0;i<WILDLIFE_SPECIES_IDS.length;i++){
          const species=WILDLIFE_SPECIES_IDS[i],s=WILDLIFE_SPECIES[species];
          const a={id:i+2,species,x:0,y:0,bodyR:s.size,angle:0,state:'GRAZE',phase:2.3,clock:0,wingPhase:0,airborne:!s.traits.includes('ground')&&['bird','raptor','owl'].includes(s.family)};
          for(let angle=0;angle<8;angle++)for(const state of ['GRAZE','FLEE','STUNNED','DEAD']){
            a.angle=angle*Math.PI/4;a.state=state;a.clock=angle*137;a.bodyR=s.size*(angle%2?.9:1.1);a.wingPhase=angle*.37;
            camX=-128+Math.cos(a.angle)*95;camY=-128+Math.sin(a.angle)*95;
            const metadata=JSON.stringify(a),actual=snapshot(a),fresh=snapshot({...a});
            let ink=0,diff=0;for(let n=0;n<actual.length;n++){if(actual[n]!==fresh[n])diff++;if(n%4===3&&actual[n])ink++;}
            comparisons++;if(diff||!ink||metadata!==JSON.stringify(a))failures.push({species,angle,state,diff,ink,metadataMutated:metadata!==JSON.stringify(a)});
          }
          // The same object changes species as well as heading and pose.
          a.species=WILDLIFE_SPECIES_IDS[(i+1)%WILDLIFE_SPECIES_IDS.length];a.bodyR=WILDLIFE_SPECIES[a.species].size;
          const actual=snapshot(a),fresh=snapshot({...a});
          if(actual.some((v,n)=>v!==fresh[n]))failures.push({species,staleSpeciesStyle:true});
          poseChecks++;
        }
        // A legitimate wing phase of zero must connect smoothly to the next
        // tick instead of falling back to the unrelated grazing phase.
        const a={id:2,species:'BALD_EAGLE',x:0,y:0,angle:0,state:'GRAZE',bodyR:12,phase:2.3,wingPhase:0,airborne:true};
        const zero=snapshot(a);a.wingPhase=1e-8;const next=snapshot(a);
        let changes=0;for(let n=0;n<zero.length;n++)if(zero[n]!==next[n])changes++;
        if(changes>8)failures.push({wingPhaseZeroDiscontinuity:changes});
        return {p5:p5.VERSION,comparisons,styleChecks,poseChecks,failures};
      });
      assert.deepStrictEqual(errors,[],'No wildlife Canvas runtime errors');
      assert.deepStrictEqual(result.failures,[],'Cached wildlife must paint the same pixels as fresh state and restore native styles');
      console.log(`${result.comparisons} cached/fresh heading and pose comparisons, ${result.poseChecks} species changes and ${result.styleChecks} style scopes passed with p5 ${result.p5}.`);
      await page.close();
    }
    console.log(`Wildlife ecology and depth: ${behaviorChecks} checks passed.`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error.stack);process.exit(1);});

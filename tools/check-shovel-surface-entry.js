// Surface material limits and free underground tunneling are separate rules.
// Use native terrain records, grids and canyon profiles without changing RNG.
const assert = require('assert/strict');
const {probe} = require('./harness');
let checks=0;
const run=code=>probe(code);
const ok=(code,label)=>{assert.ok(run(code),label);checks++;};
run(`isStoryMode=false;resetStoryProgress();startAtLevel(1);started=true;doTick=true;
 isPaused=isDead=isWin=killcamMode=false;inTownCutscene=inPostAmbushCutscene=false;
 inDarchonCall=inFarmCutscene=inFarmPostCutscene=inFortCutscene=inStoryIntro=inStoryRoom=false;
 window.shovelOwned=true;setMeleeTool('SHOVEL');barrels=[];activeParkingCars=[];
 var surfaceReset=(x=528,y=720,depth=0)=>{
  shovelExcavation={};player.x=x;player.y=y;player.shovelLevel=currentLevel;
  player.shovelDepth=depth;player.shovelDepthTarget=depth;player.shovelCooldownMs=0;
  player.shovelDigTimer=player.meleeTimer=0;player.shovelClimbing=false;player._shovelCellKey=null;
  player.aimAngle=0;player.isDashing=false;player.dashTimer=0;player.ignoreBldgTimer=0;
  if(depth)shovelMakeCell(Math.floor(x/96),Math.floor(y/96),depth,true);
 };
 var originalSurfaceBuildings=buildings;
 buildings=[];activeBuildings=[];buildColIndex();`);
ok('shovelSurfaceSoftAt(528,720)&&shovelSurfaceCellSoft(5,7)', 'Existing discovery grass remains an entry point');
for(const [x,y,label] of [[48,720,'asphalt'],[144,720,'sidewalk'],[720,144,'sidewalk corner']]) {
 run(`surfaceReset(${x},${y});`);
 ok('!shovelDig("DOWN")&&!shovelCellAt(player.x,player.y)', label+' cannot be penetrated from the surface');
}
run('surfaceReset(144,720);player.aimAngle=Math.PI;');
ok('!shovelDig("FORWARD")&&!shovelCellAt(48,720)', 'A surface scoop cannot open the adjacent asphalt square');
run('surfaceReset(144,720,18);player.aimAngle=Math.PI;');
ok('!shovelDig("FORWARD")&&!shovelCellAt(48,720)', 'Waist-depth scoops cannot remove the street roof');
run('surfaceReset(144,720,36);player.aimAngle=Math.PI;');
ok('shovelDig("FORWARD")&&shovelCellAt(48,720).depth===36&&!shovelCellAt(48,720).open',
 'A fully underground player can freely tunnel under the same street');
run('surfaceReset(48,720,36);shovelCellAt(48,720).open=false;shovelCellAt(48,720).ceiling=18;');
ok('shovelDig("DOWN")&&shovelCellAt(48,720).depth===54', 'Digging deeper beneath pavement does not recheck surface softness');
run('surfaceReset(48,720,36);shovelCellAt(48,720).open=false;shovelCellAt(48,720).ceiling=18;');
ok('!shovelDig("UP")&&player.shovelDepthTarget===36&&!shovelCellAt(48,720).open',
 'A covered street tunnel cannot break through its hard roof to emerge');
run('shovelCellAt(48,720).open=true;shovelCellAt(48,720).ceiling=0;');
ok('shovelDig("UP")&&player.shovelDepthTarget===18', 'A legacy open shaft remains climbable for save recovery');
run('surfaceReset(-5280,-432);');
ok('shovelSurfaceSoftAt(player.x,player.y)&&shovelDig("DOWN")', 'Painted courtyard turf works without an isGrassLot collider');
ok('!shovelSurfaceSoftAt(-5400,-600)', 'The stone cross-path through the same courtyard stays hard');
run('var surfacePads=[];for(const ch of chunkMgr.chunks.values())if(ch.tex)for(const p of ch.tex.shovelPavedRects||[])surfacePads.push(p);');
ok('surfacePads.length>0', 'Native terrain buffers expose their exact already-painted concrete pad bounds');
ok('surfacePads.every(p=>!shovelSurfaceSoftAt(p.x,p.y))', 'Every painted concrete pad rejects surface penetration');
for(const shape of ['isParkingLot:true,isGrassLot:true','isDeck:true','isBiomeProp:true,propType:"HELIPAD",noClip:true','isWater:true','isPond:true,isGrassLot:true']) {
 run(`buildings=[{x:528,y:720,w:96,h:96,${shape}}];surfaceReset();`);
 ok('!shovelDig("DOWN")&&!shovelCellAt(528,720)', shape+' does not inherit soil permission from surrounding lawn');
}
run('buildings=[{x:48,y:720,w:96,h:96,isHouse:true}];surfaceReset(144,720,36);player.aimAngle=Math.PI;');
ok('!shovelDig("FORWARD")&&!shovelCellAt(48,720)', 'Underground freedom still stops at a building foundation');
run(`startAtLevel(3);started=true;doTick=true;isPaused=isDead=isWin=false;
 inFarmCutscene=inFarmPostCutscene=inTownCutscene=false;window.shovelOwned=true;setMeleeTool('SHOVEL');
 buildings=[];activeBuildings=[];buildColIndex();surfaceReset(720,720);
 var canyonFloor=null,canyonDeck=null;
 for(const y of [1800,4200,6600,9000]){
  const p=frontierCanyonProfile('Y',y,0),x=(Math.floor(p.center/96)+.5)*96,yy=(Math.floor(y/96)+.5)*96;
  const c=frontierCanyonAt(x,yy);
  if(c&&c.height<-100&&!shovelFrontierDeckAt(x,yy)&&shovelSurfaceCellSoft(Math.floor(x/96),Math.floor(yy/96))){canyonFloor={x,y:yy};break;}
 }
 for(const y of [600,3000,5400,7800,10200]){
  const p=frontierCanyonProfile('Y',y,0),x=p.center;
  if(shovelFrontierDeckAt(x,y)&&Math.abs(frontierCanyonHeight(x,y))<.1){canyonDeck={x,y};break;}
 }
`);
ok('canyonFloor&&canyonDeck', 'The native canyon fixture contains both dirt floor and an elevated crossing');
run('surfaceReset(canyonFloor.x,canyonFloor.y);');
ok('shovelSurfaceSoftAt(player.x,player.y)&&shovelDig("DOWN")', 'Level 3 canyon floor counts as dirt and starts a shaft');
run('surfaceReset(canyonDeck.x,canyonDeck.y);');
ok('!shovelSurfaceSoftAt(player.x,player.y)&&!shovelDig("DOWN")', 'Wooden canyon bridge decking cannot be excavated like dirt');
run('surfaceReset(720,720);');
ok('shovelDig("DOWN")', 'Unpaved desert ground remains freely diggable');
console.log('Shovel surface entry: '+checks+' native material, tunneling and canyon checks passed.');

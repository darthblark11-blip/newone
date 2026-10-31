// Authoring, collision and bounded floor-cache checks for the closed HQ lab.
const assert = require('node:assert/strict');
const { ctx, probe, calls } = require('./harness');
const P = source => probe('(' + source + ')');
let checks = 0;
const ok = (label, value) => { assert.ok(value, label); checks++; };
ctx.setTimeout = () => 0;
probe(`resetRunState();isStoryMode=true;startAtLevel(8);
  activeBuildings=buildings;invalidateColIndex();
  width=940;height=700;zoom=.66;camX=-700;camY=500;
  viewLeft=camX;viewRight=camX+width/zoom;viewTop=camY;viewBottom=camY+height/zoom;`);
ok('HQ stays a closed indoor map', P('currentLevel===8 && !BIOME_ACTIVE && chunkMgr===null'));
ok('all four laboratory fixtures are authored',
  P("['CONSOLE','BENCH','CLONE_POD','CABINET'].every(kind=>buildings.some(b=>b.hqProp===kind))"));
ok('the main lab keeps eight specimen capsules and adds two cover computer stations',
  P("buildings.filter(b=>b.hqProp==='CLONE_POD'&&!b.hqWhiteLab).length===8 && buildings.filter(b=>b.hqProp==='CONSOLE'&&!b.hqOffice&&!b.hqWhiteLab).length===16"));
ok('each side office has eight physical computer workstations',
  P("NM0_OFFICES.every(o=>buildings.filter(b=>b.hqProp==='CONSOLE'&&b.hqOffice===o.id).length===8)"));
ok('the original secret door and blueprint coordinates remain',
  P("buildings.some(b=>b.hqWall==='AIRLOCK'&&b.x===0&&b.y===-800) && buildings.some(b=>b.hqBlueprint&&b.x===0&&b.y===-2000)"));
ok('the exit remains at the south boundary', P("buildings.some(b=>b.hqWall==='ENTRY'&&b.y===1500)"));
ok('the player arrives in a clear entrance', P('player.x===0 && player.y===1200 && !player.checkCol(player.x,player.y)'));
ok('all twenty guard stations clear the furnished floor',
  P('enemiesList.length===20 && enemiesList.every(e=>!e.checkCol(e.x,e.y))'));
probe(`window.hqBlockedAisle=false;
  for(let y=1200;y>=-700;y-=20)if(player.checkCol(0,y))window.hqBlockedAisle=true;
  for(const x of [-600,600])for(let y=1200;y>=-2100;y-=20)
    if(player.checkCol(x,y))window.hqBlockedAisle=true;`);
ok('the central combat aisle and both lab service aisles stay walkable', !P('hqBlockedAisle'));
probe(`window.hqBlockedStaffRoute=false;
  for(const a of nm0Scientists){
    const points=[[a.x,a.y],...a.scientistRoute];
    for(let i=1;i<points.length;i++){
      const from=points[i-1],to=points[i],steps=Math.ceil(Math.hypot(to[0]-from[0],to[1]-from[1])/3);
      for(let j=0;j<=steps;j++)if(a.checkCol(from[0]+(to[0]-from[0])*j/steps,
          from[1]+(to[1]-from[1])*j/steps))hqBlockedStaffRoute=true;
    }
  }`);
ok('all three original scientist routes remain clear of added cover',
  P('nm0Scientists.length===3&&!hqBlockedStaffRoute'));
ok('HQ fixtures and actors share the native depth sorter', P('depthSortActive()'));

let graphics = 0, removed = 0;
const createGraphics = ctx.createGraphics;
ctx.createGraphics = (...args) => {
  graphics++;
  const tile = createGraphics(...args), remove = tile.remove;
  tile.remove = () => { removed++; remove(); };
  return tile;
};
probe('drawNM0LabGround();');
ok('the entry floor bakes only visible half-resolution tiles', graphics > 0 && graphics <= 6);
const firstBake = graphics;
probe('drawNM0LabGround();');
ok('a stationary second frame reuses the baked floor', graphics === firstBake);
probe('viewLeft=-1000;viewRight=1000;viewTop=-2500;viewBottom=1500;drawNM0LabGround();');
ok('the main floor view includes its two connecting hallway tiles', P('nm0LabFloorCache.size') === 12 && graphics === 12);
probe('viewLeft=-3100;viewRight=3100;viewTop=-2700;viewBottom=1600;drawNM0LabGround();');
ok('both offices and the main lab use twenty-two tiles within the twenty-four tile bound',
  P('nm0LabFloorCache.size===22&&nm0LabFloorCache.size<=NM0_LAB_FLOOR_CACHE_LIMIT&&NM0_LAB_FLOOR_CACHE_LIMIT===24')&&graphics===22);
const before = calls.sig;
probe('drawBuildingPads();');
ok('indoor fixtures never acquire outdoor concrete aprons', calls.sig === before);
probe('drawBuildings();');
ok('lab walls and props draw real geometry', calls.sig !== before);
probe('resetNM0LabFloor();');
ok('floor surfaces release their backing canvases on reset', removed === graphics && P('nm0LabFloorCache.size===0'));
ctx.createGraphics = createGraphics;
probe('drawNM0LabGround();resetRunState();');
ok('hard reset clears laboratory surfaces and staff', P('nm0LabFloorCache.size===0 && nm0Scientists.length===0'));
probe('currentLevel=0;');
ok('the prologue retains its existing interior ordering', !P('depthSortActive()'));
console.log(`${checks}/${checks} NM-0 laboratory authoring, access and floor-cache checks passed`);

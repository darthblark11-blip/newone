// The new forest hills are a shared walkable surface, not painted collision.
// Test exact adjoining mesh samples and their movement/render/light consumers.
const assert = require('assert');
const { probe, ctx, mkG } = require('./harness');
probe('BIOME_ACTIVE=true;currentBiome=currentLevel=2;authoredCore=authoredChunks=authoredMask=null;biomeState={};');
const result = probe(`(()=>{
  const sites=[];
  for(let iy=-8;iy<=8;iy++)for(let ix=-8;ix<=8;ix++){
    const site=forestLandscapeSite(2,ix,iy);
    if(site&&site.kind==='RIDGE')sites.push(site);
  }
  let maximum=0,seamError=0,normalError=0,jump=0,largestRise=0,roadHeight=0;
  let raised=0,climbs=0,descents=0,scale=1,fixture=null;
  const visited=new Set();
  for(const site of sites.slice(0,18)){
    for(let dy=-720;dy<=720;dy+=80)for(let dx=-720;dx<=720;dx+=80){
      const x=site.x+dx,y=site.y+dy,h=forestRidgeHeight(x,y);
      if(h>maximum){maximum=h;fixture={x,y,h};scale=elevRenderScale(x,y);}
      if(h>8)raised++;
      assertFinite(h);
      for(const [vx,vy]of[[1,0],[0,1],[-1,0],[0,-1]]){
        const factor=elevSpeedFactor(x,y,vx,vy);
        if(factor<.995)climbs++;if(factor>1.005)descents++;
        largestRise=Math.max(largestRise,Math.abs(forestRidgeHeight(x+vx*26,y+vy*26)-h));
      }
    }
    const cx=Math.floor(site.x/CHUNK_W),cy=Math.floor(site.y/CHUNK_W);
    for(let row=cy-1;row<=cy+1;row++)for(let col=cx-1;col<=cx+1;col++){
      const key=col+','+row;if(visited.has(key))continue;visited.add(key);
      const g=forestRidgeGrid(col,row),right=forestRidgeGrid(col+1,row),down=forestRidgeGrid(col,row+1),s=g.stride;
      for(let k=0;k<s;k++){
        seamError=Math.max(seamError,Math.abs(g.heights[k*s+g.cells]-right.heights[k*s]),
          Math.abs(g.heights[g.cells*s+k]-down.heights[k]));
        normalError=Math.max(normalError,Math.abs(g.normalsX[k*s+g.cells]-right.normalsX[k*s]),
          Math.abs(g.normalsY[k*s+g.cells]-right.normalsY[k*s]),
          Math.abs(g.normalsX[g.cells*s+k]-down.normalsX[k]),
          Math.abs(g.normalsY[g.cells*s+k]-down.normalsY[k]));
      }
      for(let offset=70;offset<CHUNK_W;offset+=113){
        const x=(col+1)*CHUNK_W,y=row*CHUNK_W+offset;
        jump=Math.max(jump,Math.abs(forestRidgeHeight(x-.001,y)-forestRidgeHeight(x+.001,y)));
        if(woodHasTrunk(2,col))roadHeight=Math.max(roadHeight,
          forestRidgeHeight(woodTrailX(2,col,y),y));
        if(woodHasLink(2,row))roadHeight=Math.max(roadHeight,
          forestRidgeHeight(col*CHUNK_W+offset,woodLinkY(2,row,col*CHUNK_W+offset)));
      }
    }
  }
  return {sites:sites.length,visited:visited.size,maximum,seamError,normalError,jump,
    largestRise,roadHeight,raised,climbs,descents,scale,fixture,cache:_forestRidgeGrids.size};
  function assertFinite(v){if(!Number.isFinite(v)||v<0||v>76.001)throw Error('Invalid hill height '+v);}
})()`);
assert(result.sites >= 12 && result.raised > 500, 'fixtures must find broad raised forest ground');
assert(result.maximum > 65 && result.maximum <= 76.001, 'ridge crowns need visible, bounded relief');
assert(result.seamError < 1e-5, 'height grid changes at a chunk boundary: '+JSON.stringify(result));
assert(result.normalError < 1e-5, 'baked slope normals change at a chunk boundary: '+JSON.stringify(result));
assert(result.jump < .003, 'interpolated height snaps across a seam: '+JSON.stringify(result));
assert(result.largestRise < 16, 'forest hills must remain gentle and walkable: '+JSON.stringify(result));
assert(result.roadHeight < .15, 'an existing road was lifted into a scarp: '+JSON.stringify(result));
assert(result.climbs > 200 && result.descents > 200 && result.scale > 1.16,
  'actors and walking must read the same raised ground');
assert(result.cache <= 128, 'an endless walk grows the terrain cache');

// The live light mesh encodes the very same surface under actors and emitters.
const lightFaces=[];
ctx.__ridgeFixture=result.fixture;
ctx.__recordRidgeFace=(...values)=>lightFaces.push(values);
probe(`viewLeft=__ridgeFixture.x-320;viewTop=__ridgeFixture.y-320;
  viewRight=viewLeft+640;viewBottom=viewTop+640;zoom=.65;
  paintFrontierHeightTriangle=function(ctx,ax,ay,az,bx,by,bz,cx,cy,cz){
    __recordRidgeFace(ax,ay,az,bx,by,bz,cx,cy,cz);
  };`);
ctx.__ridgeGraphics=mkG();
probe('paintForestRidgeHeightfield(__ridgeGraphics);');
assert(lightFaces.length > 0 && lightFaces.length <= 1080, 'ridge light mesh must be present and bounded');
for(const face of lightFaces)for(let i=0;i<9;i+=3){
  const actual=probe(`forestRidgeHeight(${face[i]},${face[i+1]})`);
  assert(Math.abs(actual-face[i+2])<1e-5, 'light terrain drifts from the shared height mesh');
}
assert(Math.abs(probe('glRigEmitterGround(__ridgeFixture)')-result.fixture.h)<1e-5,
  'forest light emitters remain below raised ground');
probe('BIOME_ACTIVE=false;');
assert.equal(probe('elevRenderScale(__ridgeFixture.x,__ridgeFixture.y)'),1);
assert.equal(probe('elevSpeedFactor(__ridgeFixture.x,__ridgeFixture.y,1,0)'),1);
console.log('Forest ridges passed: shared height/normal seams, gentle climbs, flat roads, grounded actors/lights and bounded caches.');
console.log(JSON.stringify({...result,lightFaces:lightFaces.length}));

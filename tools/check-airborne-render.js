// Exercise the real actor dispatcher and full scene ordering. Roof painters
// record their place in the schedule; aircraft use their actual enemy types.
const assert = require('assert');
const { probe } = require('./harness');
const P = src => probe('(' + src + ')');
let checks = 0;
function check(name, test) {
  test(); checks++;
  console.log('  ok   ' + name);
}

probe(`
  __airRenderOrder = [];
  function renderActor(type, y, extra) {
    return Object.assign({eType:type, x:0, y:y, hp:100, dead:false,
      show:function(){__airRenderOrder.push(this.eType);}}, extra || {});
  }
  viewLeft=-5000; viewRight=5000; viewTop=-5000; viewBottom=5000;
  __savedDrawBuildings=drawBuildings; __savedDrawBiomeProps=drawBiomeProps;
  drawBuildings=function(list,start,end){
    const a=list || activeBuildings;
    for(let n=start===undefined?0:start;n<(end===undefined?a.length:end);n++)
      __airRenderOrder.push(a[n].id);
  };
  drawBiomeProps=function(list,start,end){
    const a=list || activeBuildings;
    for(let n=start===undefined?0:start;n<(end===undefined?a.length:end);n++)
      __airRenderOrder.push(a[n].id);
  };
`);

for (const sorted of [false, true]) {
  for (const type of ['AERIAL', 'AERIAL_PISTOL', 'SAUCER', 'SAUCER_RED']) {
    for (const y of [-180, 0, 180]) {
      check(`${type} at y=${y} draws once over a roof, sorted=${sorted}`, () => {
        probe(`
          BIOME_ACTIVE=${sorted}; _depthOn=${sorted};
          _depthActors.length=0; _airborneActors.length=0; __airRenderOrder=[];
          activeBuildings=[{id:'ROOF',x:0,y:0,w:400,h:400}];
          actorShow(renderActor('PLAYER',0,{isPlayer:true}));
          actorShow(renderActor('${type}',${y}));
          if(_depthOn) drawDepthSorted(); else drawBuildings();
        `);
        assert(!P(`__airRenderOrder.includes('${type}')`));
        probe('drawAirborneActors();');
        assert.deepEqual(Array.from(P('__airRenderOrder')), ['PLAYER', 'ROOF', type]);
        assert.equal(P('_airborneActors.length'), 0);
        assert.equal(P('_depthActors.length'), 0);
      });
    }
  }
}

check('grounded actors still interleave with buildings at their feet', () => {
  probe(`
    _depthOn=true; _depthActors.length=0; _airborneActors.length=0;
    __airRenderOrder=[];
    activeBuildings=[{id:'ROOF',x:0,y:0,w:200,h:200}];
    actorShow(renderActor('PISTOL',-200));
    actorShow(renderActor('MILITARY',200,{isFriendly:true}));
    drawDepthSorted(); drawAirborneActors();
  `);
  assert.deepEqual(Array.from(P('__airRenderOrder')), ['PISTOL', 'ROOF', 'MILITARY']);
});

check('a player using a jetpack retains the grounded character schedule', () => {
  probe(`
    _depthOn=true; _depthActors.length=0; _airborneActors.length=0;
    __airRenderOrder=[]; activeBuildings=[{id:'ROOF',x:0,y:0,w:200,h:200}];
    actorShow(renderActor('AERIAL',0,{isPlayer:true}));
    drawDepthSorted(); drawAirborneActors();
  `);
  assert.deepEqual(Array.from(P('__airRenderOrder')), ['AERIAL', 'ROOF']);
});

check('fallen flyers are not lifted back above roofs', () => {
  probe(`
    _depthOn=true; _depthActors.length=0; _airborneActors.length=0;
    __airRenderOrder=[]; activeBuildings=[{id:'ROOF',x:0,y:0,w:200,h:200}];
    actorShow(renderActor('AERIAL',0,{dead:true,hp:0}));
    drawDepthSorted(); drawAirborneActors();
  `);
  assert.deepEqual(Array.from(P('__airRenderOrder')), ['AERIAL', 'ROOF']);
});

check('aircraft sort against each other and the queue empties between frames', () => {
  probe(`
    __airRenderOrder=[]; _depthOn=false;
    actorShow(renderActor('SAUCER',200)); actorShow(renderActor('AERIAL',-200));
    actorShow(renderActor('SAUCER_RED',0)); drawAirborneActors();
  `);
  assert.deepEqual(Array.from(P('__airRenderOrder')), ['AERIAL', 'SAUCER_RED', 'SAUCER']);
  probe('drawAirborneActors();');
  assert.equal(P('__airRenderOrder.length'), 3);
});

check('a failed aircraft painter cannot leave a stale queue', () => {
  probe(`
    _airborneActors=[renderActor('AERIAL',0,{show:function(){throw Error('air painter');}})];
  `);
  assert.throws(() => probe('drawAirborneActors();'), /air painter/);
  assert.equal(P('_airborneActors.length'), 0);
});

// Run draw(), not a reconstruction of the layer sequence. World residency is
// frozen to one building so the real frame's camera/culling remains in play.
probe(`
  isStoryMode=false; townsData={}; startAtLevel(3); started=true;
  isPaused=true; inStoryIntro=false; inStoryRoom=false;
  leftStick={active:false,dx:0,dy:0,base:{x:0,y:0}};
  rightStick={active:false,dx:0,dy:0,dist:0,base:{x:0,y:0}};
  townCitizens=[]; barrels=[];
  manageChunkMemory=function(){};
  updateActiveWorld=function(){activeBuildings=[{id:'ROOF',x:0,y:0,w:200,h:200}];};
  drawParkingCars=function(){__airRenderOrder.push('CARS');};
  updateParticles=function(){__airRenderOrder.push('EFFECTS');};
  player.x=0; player.y=0; player.show=function(){__airRenderOrder.push('PLAYER');};
  camX=-300; camY=-200; zoom=1;
`);
for (const sorted of [false, true]) {
  check(`actual draw places all four aircraft over roofs and cars, below effects (${sorted})`, () => {
    probe(`
      BIOME_ACTIVE=${sorted}; __airRenderOrder=[];
      enemiesList=['AERIAL','AERIAL_PISTOL','SAUCER','SAUCER_RED'].map(type => {
        const e=new Character(0,0,false,type);
        e.show=function(){__airRenderOrder.push(this.eType);}; return e;
      });
      draw();
    `);
    const order = Array.from(P('__airRenderOrder'));
    for (const type of ['AERIAL', 'AERIAL_PISTOL', 'SAUCER', 'SAUCER_RED']) {
      assert.equal(order.filter(x => x === type).length, 1, order.join(' '));
      assert(order.indexOf(type) > order.indexOf('ROOF'), order.join(' '));
      assert(order.indexOf(type) > order.indexOf('CARS'), order.join(' '));
      assert(order.indexOf(type) < order.indexOf('EFFECTS'), order.join(' '));
    }
    assert.equal(P('_airborneActors.length'), 0);
  });
}

console.log(`\n${checks}/${checks} airborne render checks passed`);

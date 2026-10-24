// Anatomical wildlife contact is independent of army HEAD/BODY aim modes.
// Segments enter the first facing-relative shape; the hunter cannot shoot
// through an animal's body to claim a clean arrow headshot behind it.
const assert = require('assert');
const { probe } = require('./harness');
let checks = 0;
const run = code => probe(code);
function check(code, message) { assert.ok(run(code), message); checks++; }
run(`currentBiome=currentLevel=2;BIOME_ACTIVE=true;isStoryMode=false;
  player={x:15000,y:6600,hp:300};resetForestWildlife();
  function anatomyAnimal(id,heading=0) {
    resetForestWildlife();var a=wildlifeSpawnAnimal(id,128*117+127,6600);
    var s=WILDLIFE_SPECIES[id];a.bodyR=s.size;a.headR=s.headR;a.angle=heading;
    return a;
  }
  function anatomySegment(a,x0,y0,x1,y1,mode='BODY') {
    var c=Math.cos(a.angle),s=Math.sin(a.angle);
    return forestWildlifeHitTest({prevX:a.x+c*x0-s*y0,prevY:a.y+s*x0+c*y0,
      x:a.x+c*x1-s*y1,y:a.y+s*x1+c*y1,tH:mode});
  }
  var qaAnatomy;`);
for (const id of run('WILDLIFE_SPECIES_IDS')) {
  for (let heading=0;heading<8;heading++) {
    run(`qaAnatomy=anatomyAnimal('${id}',${heading}*Math.PI/4);`);
    check(`['HEAD','BODY'].every(mode=>{var h=anatomySegment(qaAnatomy,-200,0,200,0,mode);
      return h&&h.animal===qaAnatomy&&!h.head;})`, id+' rear shot hits torso first at heading '+heading);
    check(`['HEAD','BODY'].every(mode=>{var h=anatomySegment(qaAnatomy,200,0,-200,0,mode);
      return h&&h.animal===qaAnatomy&&h.head;})`, id+' face shot hits head first at heading '+heading);
  }
  check(`var s=WILDLIFE_SPECIES.${id},h=wildlifeHeadPoint(qaAnatomy);
    Math.abs(Math.hypot(h.x-qaAnatomy.x,h.y-qaAnatomy.y)-s.headForward)<1e-8&&
    qaAnatomy.headR<=qaAnatomy.bodyR*.375`, id+' head has its drawn facing anchor and bounded anatomical size');
  // Approach a real head from its exposed front cap, including a near-tangent
  // hit. Stop before its center, so the separate torso cannot supply a hit.
  check(`var f=WILDLIFE_SPECIES.${id}.headForward,r=qaAnatomy.headR+1;
    var h=anatomySegment(qaAnatomy,f+r+10,r-.05,f+.5,r-.05,'BODY');
    h&&h.head`, id+' visible head cap accepts a grazing face hit');
  check(`var f=WILDLIFE_SPECIES.${id}.headForward,r=qaAnatomy.headR+1;
    anatomySegment(qaAnatomy,f+r+10,r+.05,f+2,r+.05,'HEAD')===null`, id+' just outside head cap misses despite HEAD selection');
}
run(`qaAnatomy=anatomyAnimal('GRIZZLY_BEAR');`);
check(`!anatomySegment(qaAnatomy,-2,0,2,0,'HEAD').head`, 'Actor-root HEAD shortcut is removed');
check(`var s=_WILDLIFE_SHOT_BODY.bear;
  var h=anatomySegment(qaAnatomy,-100,qaAnatomy.bodyR*s[1]+.8,100,qaAnatomy.bodyR*s[1]+.8,'HEAD');
  h&&!h.head`, 'A torso grazing shot remains body damage in HEAD mode');
check(`anatomySegment(qaAnatomy,-100,qaAnatomy.bodyR*.65+1.05,100,qaAnatomy.bodyR*.65+1.05,'BODY')===null`,
  'A round outside the ink tolerance misses the entire torso');
check(`var h=forestWildlifeHitTest({prevX:qaAnatomy.x+80,prevY:qaAnatomy.y,
  x:qaAnatomy.x+50,y:qaAnatomy.y,tH:'BODY'});h&&h.head&&h.animal===qaAnatomy`,
  'A front-cap hit finds the root across a wildlife grid cell boundary');
check(`forestWildlifeHitTest({prevX:NaN,prevY:0,x:NaN,y:0})===null&&
  forestWildlifeHitTest({prevX:-1e6,prevY:-1e6,x:1e6,y:1e6})===null`,
  'Invalid and unbounded segments do not widen the spatial query');
run(`var qaSeed=serializeForestWildlife().seed;for(let i=0;i<100;i++)anatomySegment(qaAnatomy,200,0,-200,0,'HEAD');`);
check(`serializeForestWildlife().seed===qaSeed`, 'Anatomical probing consumes no encounter RNG');
for(const fields of ['arrowDud:true,arrowPower:1','arrowPower:.54']) {
  run(`qaAnatomy=anatomyAnimal('GRIZZLY_BEAR');
    applyForestWildlifeHit(qaAnatomy,{weapon:'BOW',head:true,damage:1,shotId:'weak',${fields}});`);
  check(`!qaAnatomy.dead&&qaAnatomy.hp===qaAnatomy.maxHp-1&&qaAnatomy.method!=='BOW_HEAD'`,
    fields+' cannot turn a head contact into an instant PERFECT kill');
  run(`applyForestWildlifeHit(qaAnatomy,{weapon:'BOW',head:true,damage:1000,shotId:'weak-lethal',${fields}});`);
  check(`qaAnatomy.dead&&qaAnatomy.method==='BOW'&&qaAnatomy.condition!=='PERFECT'`,
    fields+' cannot grant PERFECT quality on an ordinary lethal head impact');
}
for(const count of [1,2,4]) {
  run(`qaAnatomy=anatomyAnimal('PIKA');
    for(let i=0;i<${count}-1;i++)applyForestWildlifeHit(qaAnatomy,
      {weapon:'BOW',head:i%2===0,damage:1,shotId:'weak-history-'+i,arrowPower:.2});
    applyForestWildlifeHit(qaAnatomy,{weapon:'BOW',head:true,damage:24,
      shotId:'weak-last',arrowPower:.2});`);
  check(`qaAnatomy.dead&&qaAnatomy.shots===${count}&&qaAnatomy.method==='BOW'&&
    qaAnatomy.condition===${JSON.stringify(count===1?'GOOD':count===2?'FAIR':'BAD')}`,
    count+' weak arrows retain shot-history quality without a PERFECT override');
}
run(`qaAnatomy=anatomyAnimal('GRIZZLY_BEAR');
  applyForestWildlifeHit(qaAnatomy,{weapon:'BOW',head:true,damage:1,shotId:'clean',arrowDud:false,arrowPower:.55});`);
check(`qaAnatomy.dead&&qaAnatomy.method==='BOW_HEAD'&&qaAnatomy.condition==='PERFECT'`,
  'A sufficiently drawn clean anatomical arrow headshot keeps the perfect hunting reward');
console.log(`${checks}/${checks} wildlife anatomy checks passed.`);

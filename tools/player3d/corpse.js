// Blender player bodies use the same floor motion, wall clips and retirement
// buffers as native corpses. The adapter owns appearance, never death physics.
function player3DCorpseReady(r, c) {
  return !!(c && c.id && c.id.isPlayer && r && r.drawingContext &&
    typeof Player3D !== 'undefined' && Player3D.enabled !== false &&
    typeof player3DPose === 'function' && Player3D.ensure());
}

function player3DCorpseColour(c, fallback) {
  const value = c && (c.levels || c);
  return value && value.length >= 3 ? [value[0], value[1], value[2]] : fallback;
}

function player3DCorpseMatrix(x, y, z, sx, sy, sz, angle = 0) {
  const co = Math.cos(angle), si = Math.sin(angle);
  return new Float32Array([co*sx,si*sx,0,0,-si*sy,co*sy,0,0,0,0,sz,0,x,y,z,1]);
}

function player3DCorpsePrimitive(mesh, x, y, z, sx, sy, sz, colour, angle = 0, part = mesh) {
  return {mesh, color:colour, matrix:player3DCorpseMatrix(x,y,z,sx,sy,sz,angle), part};
}

function player3DCorpseSnapshot(parts) {
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const p of parts){
    const m=p.matrix;
    // All exported parts fit the unit cube/sphere; the sum is conservative
    // under arbitrary rotation and includes room for the silhouette ink.
    const rx=Math.abs(m[0])+Math.abs(m[4])+Math.abs(m[8])+1.5;
    const ry=Math.abs(m[1])+Math.abs(m[5])+Math.abs(m[9])+1.5;
    x0=Math.min(x0,m[12]-rx);x1=Math.max(x1,m[12]+rx);
    y0=Math.min(y0,m[13]-ry);y1=Math.max(y1,m[13]+ry);
  }
  return {parts,sockets:{},bounds:parts.length?[x0,y0,x1,y1]:[-1,-1,1,1]};
}

function player3DCorpseProxy(c) {
  return {x:0,y:0,isPlayer:true,isCorpse:true,eType:c.eT||'NORMAL',
    bodyW:c.bW||21,bodyH:c.bH||27,shirtCol:c.sC,pantsCol:c.pC,
    skinCol:c.id&&c.id.skinCol,aimAngle:0,moveAngle:0,decals:[],
    currentWeapon:c.cW,isArmed:false,isMoving:false};
}

function player3DCorpseIdentity(c) {
  const id={...c.id,shirtCol:c.sC,pantsCol:c.pC};
  if(c.isCharred||id.isCharred){
    id.shirtCol=c.sC;id.pantsCol=c.pC;
    id.explosiveArmor=id.chemistSuit=id.ninjaSuit=id.cowboySuit=id.jetpack=false;
  }
  return id;
}

// The old fall solver supplies the projected endpoints. Resolve the missing
// heights explicitly: an upright shoulder descends with the existing fall,
// a bent knee rises from the floor, and the final joints keep garment thickness.
// This is an actual XYZ skeleton, rather than treating the projected rig as one.
function player3DCorpsePose(c, options = {}) {
  const f=Math.max(0,Math.min(1,Number(options.progress===undefined?c.fP:options.progress)||0));
  const rig=options.rig || (c.fall?corpseFallRig(c):ragRig(c.bW||21,c.bH||27));
  const scale=options.scale===undefined?(typeof RAG_SCALE==='number'?RAG_SCALE:.8):options.scale;
  const yaw=options.angle===undefined?(c.fall?figureFallYaw(c.fall,c.rag):
    (c.dT===7?c.mA:c.aA)||0)+(c.fall?0:c.rag&&c.rag.ang||0):options.angle;
  const co=Math.cos(yaw),si=Math.sin(yaw);
  const point=(x,y,z)=>({x:(co*x-si*y)*scale,y:(si*x+co*y)*scale,z:z*scale});
  const standing=1-f,faceDown=!!(c.backFacing||c.fall&&c.fall.faceDown);
  const chestZ=4+standing*22,hipZ=3+standing*10;
  const pose={head:point(rig.headX===undefined?Math.max(18,rig.TL*.5+3.5):rig.headX,
      rig.headY||0,5.5+standing*30),
    chest:point(rig.chestX||0,rig.chestY||0,chestZ),pelvis:point(rig.hipX,0,hipZ),
    arms:[],legs:[],forward:{x:co,y:si,z:0},
    torsoWidth:rig.TW*.5*scale,torsoLength:rig.TL*.5*scale,torsoDepth:(4+standing*1.5)*scale,
    headRadius:5.5*(rig.headScale||1)*scale};
  const rag=c.rag||{limbs:[{a:.7,b:.2},{a:.7,b:.2},{a:.12,b:.2},{a:.12,b:.2}]};
  for(let i=0;i<4;i++){
    const g=fallLimbGeometry(rig,rag,i,f,faceDown),arm=i<2;
    const startZ=arm?chestZ:hipZ;
    const bend=rag.limbs[i].b||0;
    // At rest the elbow lies on the same floor as the sleeve, while knee
    // flexion retains a real height and self-occlusion in the depth buffer.
    const middleZ=arm?3.5+standing*14:3+Math.abs(Math.sin(bend*f))*rig.shin*.52+standing*5;
    const endZ=arm?3+standing*12:2+standing*1.5;
    if(arm)pose.arms.push({shoulder:point(g.ox,g.oy,startZ),elbow:point(g.ex,g.ey,middleZ),fist:point(g.hx,g.hy,endZ)});
    else pose.legs.push({hip:point(g.ox,g.oy,startZ),knee:point(g.ex,g.ey,middleZ),ankle:point(g.hx,g.hy,endZ),heading:yaw+Math.PI});
  }
  if(c.particleBeamDeath&&typeof particleBeamLegKick==='function'){
    const kick=particleBeamLegKick(c);
    for(const leg of pose.legs){leg.knee.z+=12*kick;leg.ankle.z+=22*kick;
      leg.knee.x+=co*12*kick*scale;leg.knee.y+=si*12*kick*scale;
      leg.ankle.x+=co*27*kick*scale;leg.ankle.y+=si*27*kick*scale;}
  }
  return player3DPose(player3DCorpseProxy(c),{identity:player3DCorpseIdentity(c),pose,weapon:false,
    widthScale:scale/(typeof RAG_SCALE==='number'?RAG_SCALE:.8),
    includeParts:options.includeParts,excludeParts:options.excludeParts});
}

function player3DCorpseFilter(snapshot, filter) {
  return {...snapshot,parts:snapshot.parts.filter(filter)};
}

function player3DCorpsePartIs(p, region) {
  const tag=p.part||'';
  if(region==='head')return tag==='head'||tag==='headwear'||tag==='helmet';
  if(region==='legs')return tag==='pelvis'||/^(thigh|shin|foot)_/.test(tag);
  if(region==='torso')return !player3DCorpsePartIs(p,'legs');
  if(region==='leftArm')return /^(upper_arm|forearm|hand)_left$/.test(tag);
  if(region==='rightArm')return /^(upper_arm|forearm|hand)_right$/.test(tag);
  if(region==='leftLeg')return /^(thigh|shin|foot)_left$/.test(tag);
  if(region==='rightLeg')return /^(thigh|shin|foot)_right$/.test(tag);
  return tag===region;
}

function player3DCorpseRender(r, snapshot, options) {
  return !snapshot.parts.length || Player3D.draw(snapshot,r.drawingContext,options||{});
}

function player3DCorpseDecals(r,c) {
  r.push();r.noStroke();
  try{
    for(const d of c.dec||[]){
      if((c.swordHeadless||c.dT===4||c.dT===9)&&d.isHead)continue;
      const p=fatalWoundPoint(c,d);
      if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
      if(typeof drawParticleBeamWound==='function'&&drawParticleBeamWound(r,d,p.x,p.y,d.sz*(p.scale||1)))continue;
      r.fill(...(d.col||[90,0,0,220]));r.ellipse(p.x,p.y,d.sz*(p.scale||1),d.sz*(p.scale||1));
    }
  }finally{r.pop();}
}

function player3DCorpseSpray(r,c,snapshot) {
  if(!c.spray&&!c.headSpatter)return;
  const yaw=c.fall?figureFallYaw(c.fall,c.rag):(c.aA||0)+(c.rag&&c.rag.ang||0);
  const co=Math.cos(yaw),si=Math.sin(yaw),sc=typeof RAG_SCALE==='number'?RAG_SCALE:.8;
  r.push();r.noStroke();
  try{
    for(const sp of c.spray||[]){r.fill(96,6,6,sp.a);r.ellipse(c.x+(co*sp.x-si*sp.y)*sc,c.y+(si*sp.x+co*sp.y)*sc,sp.r*2*sc,sp.r*1.74*sc);}
    const head=snapshot.sockets.head,ht=yaw+figureHeadTurn(c.fall,c.fP),hx=Math.cos(ht),hy=Math.sin(ht);
    if(head)for(const sp of c.headSpatter||[]){r.fill(96,6,6,sp.a);r.ellipse(c.x+head.x+(hx*sp.x-hy*sp.y)*sc,c.y+head.y+(hy*sp.x+hx*sp.y)*sc,sp.r*2*sc,sp.r*1.74*sc);}
  }finally{r.pop();}
}

function player3DCorpseSector(r,snapshot,center,start,end) {
  const dc=r.drawingContext;
  dc.save();
  try{
    dc.beginPath();dc.moveTo(center.x,center.y);
    for(let i=0;i<=32;i++){const a=start+(end-start)*i/32;dc.lineTo(center.x+Math.cos(a)*100,center.y+Math.sin(a)*100);}
    dc.closePath();dc.clip();player3DCorpseRender(r,snapshot);
  }finally{dc.restore();}
}

function player3DCorpseDamagedHead(r,c,snapshot) {
  const head=snapshot.sockets.head;if(!head)return;
  const only=player3DCorpseFilter(snapshot,p=>player3DCorpsePartIs(p,'head'));
  const yaw=(c.fall?figureFallYaw(c.fall,c.rag):(c.aA||0)+(c.rag&&c.rag.ang||0))+figureHeadTurn(c.fall,c.fP)+(c.hA||0);
  if(c.dT===1)player3DCorpseSector(r,only,head,yaw+Math.PI/4,yaw+Math.PI*2-Math.PI/4);
  else if(c.dT===8)player3DCorpseSector(r,only,head,yaw,yaw+Math.PI*1.5);
  else if(c.dT===6){
    const spread=Math.min((c.sep||0)*.4,8)*(typeof RAG_SCALE==='number'?RAG_SCALE:.8);
    for(const sign of [-1,1]){
      const dx=-Math.sin(yaw)*sign*spread,dy=Math.cos(yaw)*sign*spread;
      const shifted={...only,parts:only.parts.map(p=>{const matrix=new Float32Array(p.matrix);matrix[12]+=dx;matrix[13]+=dy;return{...p,matrix};})};
      shifted.bounds=[only.bounds[0]+dx,only.bounds[1]+dy,only.bounds[2]+dx,only.bounds[3]+dy];
      player3DCorpseSector(r,shifted,{x:head.x+dx,y:head.y+dy},yaw+(sign<0?Math.PI:0),yaw+(sign<0?Math.PI*2:Math.PI));
    }
  }
}

function player3DCorpseHeadwear(r,c,snapshot) {
  if(!c.hatOff)return;
  const hw=headwearOf(c.id);if(!hw||!headwearFalls(hw))return;
  const head=snapshot.sockets&&snapshot.sockets.head||{x:0,y:0,z:0};
  const mesh=hw==='STETSON'?'cowboy_hat':hw==='HOOD'?'hood':'helmet';
  const col=player3DCorpseColour(c.id.hatCol,[103,78,46]);
  const part=player3DCorpsePrimitive(mesh,head.x+c.hatOff.x*.8,head.y+c.hatOff.y*.8,1.5,7,7,2.6,col,c.hatOff.r,'fallen_headwear');
  player3DCorpseRender(r,player3DCorpseSnapshot([part]));
}

function player3DCorpseDroppedWeapons(c,snapshot) {
  if(!c.cW||c.id.isUnarmed||c.swordHeadless)return snapshot;
  const key=String(c.cW.name||'PISTOL').toLowerCase().replace(/ /g,'_');
  const aliases={assault_rifle:'rifle',rocket_launcher:'rocket',dual_smg:'smg',dual_smgs:'smg',machine_gun:'smg',particle_beam:'particle_beam'};
  const mesh=aliases[key]||key,dual=key==='dual_smg'||key==='dual_smgs',long=['rifle','shotgun','coach_gun','particle_beam','rocket'].includes(mesh);
  const f=c.fP||0,sc=typeof RAG_SCALE==='number'?RAG_SCALE:.8;
  const yaw=c.fall?figureFallYaw(c.fall,c.rag):(c.aA||0)+(c.rag&&c.rag.ang||0),co=Math.cos(yaw),si=Math.sin(yaw);
  const extra=[];
  for(let i=0;i<(dual?2:1);i++){
    const wa=(i?-1:1)*f*Math.PI*.5,wx=20-10*f,wy=i?-14-15*f:8+15*f;
    const localX=wx+Math.cos(wa)*23-Math.sin(wa)*7,localY=wy+Math.sin(wa)*23+Math.cos(wa)*7;
    const len=(long?42:mesh==='smg'?26:mesh==='revolver'?24:18)*sc;
    extra.push(player3DCorpsePrimitive(mesh,(co*localX-si*localY)*sc,(si*localX+co*localY)*sc,2,len,len,len,[65,70,77],yaw+wa,'dropped_weapon_'+i));
  }
  const parts=snapshot.parts.concat(extra),bounds=player3DCorpseSnapshot(parts).bounds;
  return {...snapshot,parts,bounds};
}

function drawPlayer3DSeatedCorpse(r,c) {
  const a=seatedCorpseAnatomy(c),l=a.local,sc=a.scale;
  // The wall solver's local XYZ is authoritative; its own height projection
  // moves the same joints into the facade without inventing a second camera.
  const point=q=>{const p=a.point(q.x,q.y,q.z);return{x:p.x-c.x,y:p.y-c.y,z:q.z*sc};};
  const pose={head:point(l.head),chest:point(l.chest),pelvis:point(l.hip),
    arms:l.shoulders.map((q,i)=>({shoulder:point(q),elbow:point(l.elbows[i]),fist:point(l.hands[i])})),
    legs:l.hips.map((q,i)=>({hip:point(q),knee:point(l.knees[i]),ankle:point(l.heels[i])})),
    torsoWidth:c.bH*.35,torsoDepth:3.5*sc,headRadius:5.5*sc};
  const snapshot=player3DPose(player3DCorpseProxy(c),{identity:player3DCorpseIdentity(c),pose,weapon:false});
  if(c.dT===9||c.dT===4)snapshot.parts=snapshot.parts.filter(p=>!player3DCorpsePartIs(p,'head'));
  r.push();r.translate(c.x,c.y);
  try{player3DCorpseRender(r,snapshot);player3DCorpseHeadwear(r,c,snapshot);}finally{r.pop();}
  player3DCorpseDecals(r,c);return true;
}

// A clipped sword half deliberately reuses body.paint(), just as the old
// painter did. Its current context already carries the pivot and half-plane.
// The detached skull is a mesh too, rather than a restored whole body.
function drawPlayer3DFallenHead(r,id,fall,progress,wear=true) {
  if(!id||!id.isPlayer||typeof Player3D==='undefined'||!Player3D.enabled||!Player3D.ensure()||!r.drawingContext)return false;
  const skin=player3DCorpseColour(id.skinCol,[235,180,140]);
  const parts=[player3DCorpsePrimitive('head',0,0,5.5,5.5,5.5,5.5,skin,0,'head')];
  if(wear){const hw=headwearOf(id),mesh=hw==='STETSON'?'cowboy_hat':hw==='HOOD'?'hood':hw?'helmet':null;
    if(mesh)parts.push(player3DCorpsePrimitive(mesh,0,0,8,6,6,3,player3DCorpseColour(id.hatCol,[57,59,64]),0,'headwear'));}
  return player3DCorpseRender(r,player3DCorpseSnapshot(parts));
}

function drawPlayer3DCorpseFragment(r,c,kind) {
  if(!player3DCorpseReady(r,c))return false;
  const shirt=player3DCorpseColour(c.sC,[200,30,30]),skin=player3DCorpseColour(c.id.skinCol,[235,180,140]);
  const pants=player3DCorpseColour(c.pC,[30,80,180]);
  let parts=[];
  if(kind==='torso'||kind==='upper'){
    const h={x:0,y:-c.bH*.4,z:6},ch={x:0,y:0,z:5},hip={x:0,y:c.bH*.35,z:4};
    const pose={head:h,chest:ch,pelvis:hip,arms:[],legs:[],torsoWidth:c.bW*.5,torsoLength:c.bH*.35,torsoDepth:4,forward:{x:0,y:-1,z:0}};
    const s=player3DPose(player3DCorpseProxy(c),{identity:player3DCorpseIdentity(c),pose,weapon:false});
    parts=s.parts.filter(p=>['head','headwear','helmet','torso','jetpack','armor','coat'].includes(p.part));
  }else if(kind==='legs'){
    for(const side of [-1,1]){
      parts.push(player3DCorpsePrimitive('thigh',-2,side*6,4,18,8,8,pants,0,'thigh_'+(side<0?'left':'right')));
      parts.push(player3DCorpsePrimitive('foot',-10,side*6,3,7,6,5,pants.map(n=>n*.55),Math.PI,'foot_'+(side<0?'left':'right')));
    }
  }else if(kind==='leftArm'||kind==='rightArm'){
    const side=kind==='leftArm'?'left':'right';
    parts=[player3DCorpsePrimitive('upper_arm',-3,0,4,10,8,8,shirt,0,'upper_arm_'+side),
      player3DCorpsePrimitive('forearm',5,0,4,9,6.5,6.5,shirt,0,'forearm_'+side),
      player3DCorpsePrimitive('hand',11,0,4,4,3,3,skin,0,'hand_'+side)];
  }
  return player3DCorpseRender(r,player3DCorpseSnapshot(parts));
}

function player3DCorpseGibParts(c, bits) {
  const bone= c.isCharred?[40,40,40]:[220,200,190];
  return (bits||[]).map((b,i)=>{
    const type=b.type||'meat',sz=b.sz||7;
    const mesh=type==='skull'||type==='skull_frag'?'head':type==='bone'?'shin':type==='pelvis'?'pelvis':'torso';
    const colour=type==='cloth'?player3DCorpseColour(c.pC,[30,80,180]):/skull|ribcage|pelvis|bone/.test(type)?bone:
      type==='brain'?[173,78,107]:c.isCharred?[28,23,24]:[119,7,24];
    const sx=type==='bone'?sz: type==='ribcage'?7:sz*.52,sy=type==='bone'?3:type==='ribcage'?9:sz*.44;
    return player3DCorpsePrimitive(mesh,b.x||0,(b.y||0)-(b.z||0),2+(b.z||0),sx,sy,Math.max(1.2,sz*.32),colour,b.rot||0,'gib_'+i);
  });
}

function player3DCorpseHalfClip(dc, plane, side, draw) {
  if(!dc||!dc.clip){draw();return;}
  const E=400;
  dc.save();
  try{dc.beginPath();dc.moveTo(plane.x-plane.tx*E,(plane.y||0)-plane.ty*E);
    dc.lineTo(plane.x+plane.tx*E,(plane.y||0)+plane.ty*E);
    dc.lineTo(plane.x+plane.tx*E+side*plane.nx*E,(plane.y||0)+plane.ty*E+side*plane.ny*E);
    dc.lineTo(plane.x-plane.tx*E+side*plane.nx*E,(plane.y||0)-plane.ty*E+side*plane.ny*E);
    dc.closePath();dc.clip();draw();
  }finally{dc.restore();}
}

// Called inside the native ballistic piece's transform, including its real
// floor x/y, airborne z and wall flattening. No ballistic state is changed.
function drawPlayer3DBlastAnatomy(r,c,p) {
  if(!player3DCorpseReady(r,c))return false;
  const b=c.blast,scale=1,rig=b.rig;
  let s=player3DCorpsePose(c,{progress:1,rig,scale,angle:0});
  const leg=b.legIndex===1?'rightLeg':'leftLeg';
  if(p.type==='leg')s=player3DCorpseFilter(s,q=>player3DCorpsePartIs(q,leg));
  else if(p.type==='gunArm')s=player3DCorpseFilter(s,q=>player3DCorpsePartIs(q,p.limb===1?'rightArm':'leftArm'));
  else if(p.type==='gunLower')s=player3DCorpseFilter(s,q=>player3DCorpsePartIs(q,'legs')||q.part==='torso');
  else if(p.type==='gunUpper')s=player3DCorpseFilter(s,q=>!player3DCorpsePartIs(q,'legs')&&
    (b.mode==='SLICE'||!player3DCorpsePartIs(q,'leftArm')&&!player3DCorpsePartIs(q,'rightArm')));
  else if(c.dT===18)s=player3DCorpseFilter(s,q=>!player3DCorpsePartIs(q,'legs'));
  else if(c.dT===19)s=player3DCorpseFilter(s,q=>!player3DCorpsePartIs(q,leg));
  if(b.particleDiagonal){
    const arm=b.beamSide<0?'leftArm':'rightArm';
    s=player3DCorpseFilter(s,q=>p.side<0?player3DCorpsePartIs(q,arm):!player3DCorpsePartIs(q,arm));
  }
  if(b.mode&&p.type!=='gunArm')player3DCorpseHalfClip(r.drawingContext,blastCutPlane(c,p),p.side,()=>player3DCorpseRender(r,s));
  else player3DCorpseRender(r,s);
  drawBlastCut(r,c,p);return true;
}

function drawPlayer3DBlastGibs(r,c) {
  if(!player3DCorpseReady(r,c))return false;
  r.push();r.translate(c.x,c.y);
  try{player3DCorpseRender(r,player3DCorpseSnapshot(player3DCorpseGibParts(c,c.blast.gibs)));}finally{r.pop();}
  return true;
}

function drawPlayer3DBeamTorso(r,c,rig,progress) {
  if(!player3DCorpseReady(r,c))return false;
  const s=player3DCorpsePose(c,{progress,rig,scale:1,angle:0});
  return player3DCorpseRender(r,player3DCorpseFilter(s,p=>p.part==='torso'||p.part==='pelvis'||p.part==='jetpack'));
}

function drawPlayer3DBeamLeg(r,c,rig,index,progress) {
  if(!player3DCorpseReady(r,c))return false;
  const s=player3DCorpsePose(c,{progress,rig,scale:1,angle:0});
  const region=index===1?'rightLeg':'leftLeg';
  return player3DCorpseRender(r,player3DCorpseFilter(s,p=>player3DCorpsePartIs(p,region)));
}

function drawPlayer3DFallLimb(r,rig,rg,i,f,shirt,pants,skin,boot,faceDown,id) {
  if(!id||!id.isPlayer||!r.drawingContext||typeof Player3D==='undefined'||!Player3D.enabled||!Player3D.ensure())return false;
  const c={id,bW:21,bH:27,sC:shirt,pC:pants,rag:rg,fP:f,backFacing:faceDown,dec:[]};
  const s=player3DCorpsePose(c,{progress:f,rig,scale:1,angle:0});
  const region=i<2?(i===0?'leftArm':'rightArm'):(i===2?'leftLeg':'rightLeg');
  return player3DCorpseRender(r,player3DCorpseFilter(s,p=>player3DCorpsePartIs(p,region)));
}

function drawPlayer3DCorpse(r,c) {
  if(!player3DCorpseReady(r,c))return false;
  // Existing specialized painters retain their half-plane clips, cuts, floor
  // shadows and effects; their body/head/limb dispatches below are mesh draws.
  if(drawParticleBeamCorpse(r,c))return true;
  if(c.blast){drawBlastCorpse(r,c);return true;}
  if(c.wallSit)return drawPlayer3DSeatedCorpse(r,c);
  if(corpsePiecePinned(c.separatedTorso)&&!c._drawWallOverlay)return true;
  if(c.sword){drawSwordCorpse(r,c);return true;}
  if(c.dT===12&&c.exploded)return true;
  if(c.dT===5){r.push();r.translate(c.x,c.y);try{player3DCorpseRender(r,player3DCorpseSnapshot(player3DCorpseGibParts(c,c.bits)));}finally{r.pop();}return true;}
  if(c.dT===10||c.dT===11||c.dT===15){
    r.push();r.translate(c.x,c.y);
    try{
      for(const p of c.overkillBits||c.aerialBits||[]){if(corpsePiecePinned(p))continue;r.push();
        try{corpsePieceTransform(r,p);drawPlayer3DCorpseFragment(r,c,p.type==='torso'?'torso':p.type==='legs'?'legs':p.type==='lArm'?'leftArm':'rightArm');}finally{r.pop();}}
      if(c.dT!==11){r.push();r.rotate(c.mA);r.translate(-15*(c.fP||0),0);r.scale(1-.4*(c.fP||0),1);drawPlayer3DCorpseFragment(r,c,'legs');r.pop();}
    }finally{r.pop();}player3DCorpseDecals(r,c);return true;
  }
  if(c.dT===3||c.dT===13){
    const halves=corpseSplitPieces(c);r.push();r.translate(c.x,c.y);
    try{for(let i=0;i<2;i++){if(corpsePiecePinned(halves[i]))continue;r.push();try{corpsePieceTransform(r,halves[i]);drawPlayer3DCorpseFragment(r,c,i?'upper':'legs');}finally{r.pop();}}}finally{r.pop();}
    player3DCorpseDecals(r,c);return true;
  }
  let snapshot=player3DCorpsePose(c);
  snapshot=player3DCorpseDroppedWeapons(c,snapshot);
  if(c.hatOff)snapshot=player3DCorpseFilter(snapshot,p=>p.part!=='headwear'&&p.part!=='helmet');
  if(c.swordHeadless||c.dT===4||c.dT===9)snapshot=player3DCorpseFilter(snapshot,p=>!player3DCorpsePartIs(p,'head'));
  if(c._drawWallOverlay)snapshot=player3DCorpseFilter(snapshot,p=>!player3DCorpsePartIs(p,'legs'));
  r.push();r.translate(c.x,c.y);
  try{
    if(c.dT===7){const pool=bloodPoolProgress(c.poolAge,c.blastBlood),spread=Math.sqrt(pool);r.noStroke();r.fill(90,0,0,217*pool);r.ellipse(-4,0,42*spread,25*spread);}
    if(c.dT===9)player3DCorpseRender(r,player3DCorpseSnapshot(player3DCorpseGibParts(c,c.bits)));
    if(c.dT===14){
      for(const side of [-1,1]){const p=side<0?c.lH:c.rH;r.push();
        try{r.translate(p.x,p.y);r.rotate(c.splitA||0);player3DCorpseHalfClip(r.drawingContext,{x:0,y:0,nx:1,ny:0,tx:0,ty:1},side,()=>player3DCorpseRender(r,snapshot));}finally{r.pop();}}
    }else{
      if(c.dT===2||c.dT===4){const p=c.separatedTorso;
        if(p){const t=corpsePiecePose(p);r.translate(p.x+t.dx,p.y+t.dy);if(p.wallImpact){r.rotate(t.rot-((c.aA||0)+(c.rag&&c.rag.ang||0)));r.scale(t.sx,t.sy);}}
        else r.translate(Math.cos(c.bA||0)*(c.sep||0),Math.sin(c.bA||0)*(c.sep||0));}
      if(c.dT===1||c.dT===6||c.dT===8){
        player3DCorpseRender(r,player3DCorpseFilter(snapshot,p=>!player3DCorpsePartIs(p,'head')));
        player3DCorpseDamagedHead(r,c,snapshot);
      }else player3DCorpseRender(r,snapshot);
      if(c.dT===4||c.dT===9){const head=snapshot.sockets.head;
        if(head)player3DCorpseRender(r,player3DCorpseSnapshot([player3DCorpsePrimitive('head',head.x,head.y,head.z-2,5,4.8,1.3,[90,0,0],0,'neck_cut')]));}
      player3DCorpseHeadwear(r,c,snapshot);
    }
  }finally{r.pop();}
  player3DCorpseSpray(r,c,snapshot);player3DCorpseDecals(r,c);return true;
}

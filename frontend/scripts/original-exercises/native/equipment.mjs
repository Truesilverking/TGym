// Original TGym equipment geometry. Private prototype; no third-party viewer code.
// World: metres, +Y up, athlete faces +Z. Machines remain fixed in world space.
export function createEquipment(art,key){
 const T=art.THREE,root=new T.Group();root.name=`equipment:${key}`;art.scene.add(root);
 const mats={frame:new T.MeshStandardMaterial({color:0xbac0c5,roughness:.48,metalness:.55}),metal:new T.MeshStandardMaterial({color:0x848d96,roughness:.35,metalness:.7}),bright:new T.MeshStandardMaterial({color:0xd2d5d7,roughness:.34,metalness:.65}),pad:new T.MeshStandardMaterial({color:0x292c30,roughness:.92,metalness:0}),rubber:new T.MeshStandardMaterial({color:0x44484d,roughness:.95,metalness:0}),weight:new T.MeshStandardMaterial({color:0x50565d,roughness:.62,metalness:.25}),cable:new T.MeshStandardMaterial({color:0x41454b,roughness:.65,metalness:.4})};
 const V=a=>new T.Vector3(...a),arr=v=>v.toArray(),mid=(a,b)=>arr(V(a).add(V(b)).multiplyScalar(.5));
 const joint=(j,n,f)=>Array.isArray(j?.[n])&&j[n].length===3&&j[n].every(Number.isFinite)?j[n]:f;
 const add=(g,m,p=[0,0,0],parent=root)=>{const o=new T.Mesh(g,typeof m==='string'?mats[m]:m);o.position.set(...p);parent.add(o);return o};
 const box=(size,p,m='frame',parent=root)=>add(new T.BoxGeometry(...size),m,p,parent);
 const ball=(r,p,m='metal',parent=root)=>add(new T.SphereGeometry(r,12,8),m,p,parent);
 const orient=(o,a,b)=>{const d=V(b).sub(V(a)),len=d.length();o.visible=len>1e-6;if(len){o.position.copy(V(a).add(V(b)).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.divideScalar(len));o.scale.set(1,len,1);}return o};
 const link=(a,b,r=.018,m='frame',parent=root,sides=12)=>orient(add(new T.CylinderGeometry(r,r,1,sides),m,[0,0,0],parent),a,b);
 const segments=(points,r=.018,m='frame',parent=root)=>points.slice(1).map((p,i)=>link(points[i],p,r,m,parent));
 const pad=(size,p,parent=root)=>{const o=box(size,p,'pad',parent);return o};
 const torus=(radius,tube,p,m='metal',parent=root)=>add(new T.TorusGeometry(radius,tube,8,24),m,p,parent);
 const feet=(x,z,w=.45,d=.45,parent=root)=>{box([w,.045,d],[x,.035,z],'metal',parent);for(const sx of [-1,1])for(const sz of [-1,1])box([.065,.025,.065],[x+sx*(w/2-.05),.012,z+sz*(d/2-.05)],'rubber',parent)};
 const group=(name,p=[0,0,0],parent=root)=>{const g=new T.Group();g.name=name;g.position.set(...p);parent.add(g);return g};
 const cfg={key,personFaces:'+Z',anchors:{},diagnostics:{}};let update=()=>{},initialized=false;
 function wheel(p,r=.055,parent=root){const w=add(new T.CylinderGeometry(r,r,.035,20),'weight',p,parent);w.rotation.z=Math.PI/2;const rim=torus(r,.004,p,'bright',parent);rim.rotation.y=Math.PI/2;const axle=link([p[0]-.045,p[1],p[2]],[p[0]+.045,p[1],p[2]],.012,'bright',parent);return{w,rim,axle}}
 function tower(anchor,{x=0,z=-.88,high=true}={}){
  const g=group('fixed-cable-tower');feet(x,z,.58,.55,g);
  for(const dx of [-.22,.22])link([x+dx,.055,z],[x+dx,2.15,z],.026,'frame',g);
  link([x-.25,2.15,z],[x+.25,2.15,z],.026,'frame',g);box([.42,.07,.27],[x,1.65,z],'frame',g);
  for(const dx of [-.12,.12])link([x+dx,.16,z],[x+dx,1.53,z],.009,'bright',g);
  for(let i=0;i<11;i++)box([.32,.027,.22],[x,.16+i*.032,z],'weight',g);
  const stack=group('selected-moving-plates',[0,0,0],g);for(let i=0;i<3;i++)box([.32,.027,.22],[x,.16+(11+i)*.032,z],'weight',stack);
  wheel([x,2.08,z+.055],.06,g);wheel(anchor,.055,g);
  link([x,.60,z+.055],[x,2.08,z+.055],.0027,'cable',g);
  link([x,2.08,z+.055],anchor,.0027,'cable',g);
  const cable=link(anchor,[anchor[0],anchor[1]-.2,anchor[2]+.3],.0032,'cable',root);
  const carriage=box([.105,.12,.12],anchor,'metal',g);carriage.position.z-=.018;
  return{cable,stack,anchor};
 }
 function dHandle(){const g=group('held-D-handle');segments([[-.055,0,0],[-.055,.035,0],[0,.09,0],[.055,.035,0],[.055,0,0]],.006,'bright',g);link([-.052,0,0],[.052,0,0],.012,'rubber',g);const eye=torus(.013,.004,[0,.099,0],'bright',g);return{g,eye}}
 function alignHandle(h,p,anchor){const d=V(anchor).sub(V(p)).normalize();h.g.position.set(...p);h.g.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d);return arr(new T.Vector3(0,.11,0).applyQuaternion(h.g.quaternion).add(V(p)))}
 function palm(j,side,fallback,dist=.065){const exact=joint(j,`${side}Grip`,null);if(exact)return exact;const w=joint(j,`${side}Wrist`,fallback),e=joint(j,`${side}Elbow`,[w[0],w[1]+.25,w[2]]);return arr(V(w).add(V(w).sub(V(e)).normalize().multiplyScalar(dist)))}
 function dumbbell(parent=root){const g=group('one-dumbbell',[0,0,0],parent);link([0,0,-.115],[0,0,.115],.013,'bright',g);for(const z of [-.10,.10]){const h=add(new T.CylinderGeometry(.078,.078,.08,6),'weight',[0,0,z],g);h.rotation.x=Math.PI/2;const inset=add(new T.CylinderGeometry(.034,.034,.086,16),'metal',[0,0,z],g);inset.rotation.x=Math.PI/2;}return g}
 function ribbon(a,b,width=.052,thick=.008,parent=root){const o=box([thick,width,1],[0,0,0],'rubber',parent);const d=V(b).sub(V(a));o.position.copy(V(a).add(V(b)).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),d.clone().normalize());o.scale.z=d.length();return o}
 function orientRibbon(o,a,b){const d=V(b).sub(V(a));o.position.copy(V(a).add(V(b)).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),d.clone().normalize());o.scale.z=d.length();}
 if(key==='overhead-cable-triceps-ez-bar'){
  const anchor=[0,.14,-.80];cfg.anchors.pulley=anchor;cfg.anchors.barDefault=[0,1.5,.10];cfg.anchors.barGripSpan=.30;
  const c=tower(anchor,{z:-.88}),bar=group('held-short-wavy-EZ-attachment');const pp=[[-.255,0,0],[-.19,0,0],[-.13,0,-.04],[-.07,0,.018],[.07,0,.018],[.13,0,-.04],[.19,0,0],[.255,0,0]];segments(pp,.011,'bright',bar);for(const side of [-1,1])link([side*.09,0,.006],[side*.16,0,-.02],.013,'rubber',bar);torus(.018,.005,[0,-.027,.018],'bright',bar);link([0,-.027,.018],[0,0,.018],.007,'bright',bar);
  update=(t,j,phase)=>{const l=palm(j,'left',[-.15,1.5,.1],.055),r=palm(j,'right',[.15,1.5,.1],.055),center=mid(l,r);bar.position.set(...center);const axis=V(l).sub(V(r)).normalize();bar.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),axis);const eye=arr(new T.Vector3(0,-.04,.018).applyQuaternion(bar.quaternion).add(V(center)));orient(c.cable,anchor,eye);c.stack.position.y=.09*Math.max(0,Math.min(1,phase||0));cfg.diagnostics.barCenter=center;cfg.diagnostics.cableEnds=[anchor,eye];};
 }else if(key==='bayesian-cable-curl'||key==='cross-body-lat-pull-around'){
  // A diagonal rear/outboard low cable clears the continuous forearm skin
  // throughout the fixed-elbow curl instead of passing through it at the top.
  const bay=key==='bayesian-cable-curl',anchor=bay?[-.80,.14,-.8]:[-.88,1.85,.18];cfg.anchors.pulley=anchor;cfg.anchors.workingSide=bay?'right':'left';
  const c=tower(anchor,{x:bay?-.80:-1.02,z:bay?-.88:.08,high:!bay}),h=dHandle();
  update=(t,j,phase)=>{const side=cfg.anchors.workingSide,p=palm(j,side,bay?[-.24,.84,-.1]:[.12,1.35,.30]);const eye=alignHandle(h,p,anchor);orient(c.cable,anchor,eye);c.stack.position.y=.09*Math.max(0,Math.min(1,phase||0));cfg.diagnostics.hand=p;cfg.diagnostics.cableEnds=[anchor,eye];};
 }else if(key==='dead-hang'){
  cfg.anchors.barHeight=2.20;cfg.anchors.grips=[[-.26,2.20,0],[.26,2.20,0]];
  for(const x of [-.63,.63]){feet(x,0,.30,.65);link([x,.05,0],[x,2.24,0],.026,'frame');link([x,.06,-.28],[x,.65,0],.018,'frame');}
  link([-.66,2.20,0],[.66,2.20,0],.016,'bright');for(const x of [-.26,.26])link([x-.095,2.20,0],[x+.095,2.20,0],.018,'rubber');
  update=(t,j)=>{if(initialized)return;const l=joint(j,'leftGrip',null),r=joint(j,'rightGrip',null);if(!l||!r)return;initialized=true;root.position.z=(l[2]+r[2])/2;cfg.anchors.barZ=root.position.z;cfg.anchors.grips=cfg.anchors.grips.map(p=>[p[0],p[1],root.position.z]);};
 }else if(key==='captains-chair-knee-raise'){
  cfg.anchors.elbows=[[-.24,1.42,.02],[.24,1.42,.02]];cfg.anchors.wrists=[[-.24,1.42,.29],[.24,1.42,.29]];
  const fixed=group('fixed-captains-chair');const pieces=[];
  update=(t,j)=>{if(initialized)return;initialized=true;const el=[joint(j,'leftElbow',[.24,1.42,.02]),joint(j,'rightElbow',[-.24,1.42,.02])],wr=[joint(j,'leftWrist',[.24,1.42,.29]),joint(j,'rightWrist',[-.24,1.42,.29])];cfg.anchors.elbows=el;cfg.anchors.wrists=wr;
   const y=(el[0][1]+el[1][1])/2,z=Math.min(el[0][2],el[1][2])-.23;
   for(let i=0;i<2;i++){const x=el[i][0],a=el[i],w=wr[i],dir=V(w).sub(V(a)).normalize();feet(x,z,.22,.62,fixed);link([x,.05,z],[x,y+.02,z],.024,'frame',fixed);link([x,y-.06,z],[x,y-.06,w[2]+.09],.02,'frame',fixed);const center=V(a).add(V(w)).multiplyScalar(.5);center.y-=.074;const rest=pad([.12,.072,Math.max(.28,V(w).distanceTo(V(a))+.10)],arr(center),fixed);rest.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),dir);const grip=V(joint(j,i?'rightGrip':'leftGrip',arr(V(w).addScaledVector(dir,.065))));link([grip.x,grip.y-.09,grip.z],[grip.x,grip.y+.08,grip.z],.015,'rubber',fixed);link([x,.05,z],[x,y-.10,z+.22],.015,'frame',fixed);pad([.16,.04,.20],[x+Math.sign(x)*.04,.20,z+.17],fixed);}
   link([el[0][0],.10,z],[el[1][0],.10,z],.025,'frame',fixed);const shoulder=mid(joint(j,'leftShoulder',[.18,y+.1,0]),joint(j,'rightShoulder',[-.18,y+.1,0]));pad([.34,.48,.075],[0,shoulder[1]-.10,shoulder[2]-.14],fixed);link([-.24,y-.08,z],[.24,y-.08,z],.025,'frame',fixed);
  };
 }else if(key==='machine-hip-thrust'){
  cfg.anchors.shoulderSupport=[0,.63,-.44];cfg.anchors.footplate=[0,.1385,.482];cfg.anchors.footplateTop=.166;cfg.anchors.leverPivot=[0,.63,-.44];cfg.anchors.leverRadius=.5245;cfg.anchors.hipPadSurfaceOffset=.09;
  const fixed=group('dedicated-hip-thrust-machine'),lever=group('fixed-radius-hip-restraint-lever');const pivot=cfg.anchors.leverPivot;
  for(const x of [-.40,.40]){link([x,.05,-.70],[x,.05,.97],.03,'frame',fixed);link([x,.05,-.52],[x,.48,-.47],.026,'frame',fixed);feet(x,.12,.20,1.58,fixed);}
  link([-.40,.05,-.65],[.40,.05,-.65],.03,'frame',fixed);link([-.40,.05,.91],[.40,.05,.91],.03,'frame',fixed);
  const fp=box([.66,.055,.42],cfg.anchors.footplate,'rubber',fixed);for(const x of [-.24,-.12,0,.12,.24])box([.008,.003,.36],[x,.1675,.482],'metal',fixed);
  const support=add(new T.CylinderGeometry(.085,.085,.55,20),'pad',[0,.48,-.44],fixed);support.rotation.z=Math.PI/2;box([.50,.07,.20],[0,.40,-.50],'metal',fixed);
  for(const x of [-.40,.40]){const b=add(new T.CylinderGeometry(.055,.055,.08,16),'metal',[x,pivot[1],pivot[2]],fixed);b.rotation.z=Math.PI/2;}
  const arms=[link([-.40,pivot[1],pivot[2]],[-.28,.54,.05],.026,'metal',lever),link([.40,pivot[1],pivot[2]],[.28,.54,.05],.026,'metal',lever)];
  // A narrow rounded lap pad self-levels in the hip crease. Its floating
  // mounts join the unchanged fixed-radius lever; the athlete is never moved
  // to accommodate equipment. This avoids a rigid flat block cutting through
  // the thigh/abdomen fold at the bottom of the movement.
  cfg.anchors.hipPadRadius=.035;cfg.anchors.hipPadWidth=.32;cfg.anchors.hipPadSoftContact=.0015;
  const lap=add(new T.CylinderGeometry(.035,.035,.32,36),'pad',[0,.56,.05],lever);lap.name='hip-lap-roller';lap.rotation.z=Math.PI/2;
  const shaft=link([-.30,.56,.05],[.30,.56,.05],.014,'metal',lever),strap=box([.31,.008,.022],[0,.62,.05],'rubber',lever);
  const floatingMounts=[link([-.28,.54,.05],[-.28,.58,.05],.018,'bright',lever),link([.28,.54,.05],[.28,.58,.05],.018,'bright',lever)];
  const mountJoints=[ball(.026,[-.28,.54,.05],'metal',lever),ball(.026,[.28,.54,.05],'metal',lever)];
  const load=add(new T.CylinderGeometry(.14,.14,.045,28),'weight',[.48,.45,-.34],lever);load.rotation.z=Math.PI/2;
  const grips=[link([-.27,.61,0],[-.17,.61,0],.014,'rubber',lever),link([.17,.61,0],[.27,.61,0],.014,'rubber',lever)],gripStays=[link([-.30,.56,.05],[-.27,.61,0],.009,'bright',lever),link([.30,.56,.05],[.27,.61,0],.009,'bright',lever)];
  update=(t,j)=>{const hip=joint(j,'pelvis',mid(joint(j,'leftHip',[.0835,.63,.0845]),joint(j,'rightHip',[-.0835,.63,.0845])));if(!initialized){initialized=true;const s=mid(joint(j,'leftShoulder',[.18,.63,-.44]),joint(j,'rightShoulder',[-.18,.63,-.44]));support.position.set(0,s[1]-.15,s[2]-.015);cfg.anchors.shoulderSupport=s;}
   const raw=new T.Vector3(0,hip[1]-pivot[1],hip[2]-pivot[2]),unit=raw.clone().normalize(),d=unit.clone().multiplyScalar(cfg.anchors.leverRadius),outward=new T.Vector3(0,unit.z,-unit.y).multiplyScalar(cfg.anchors.hipPadSurfaceOffset),mount=V(pivot).add(d).add(outward),c=V(hip);
   // Sample the actual visible continuous skin, not the hidden atlas body.
   // The lower half-circle clears that surface with 1.5mm soft-pad contact.
   const skin=art.envelope?.mesh||art.body,r=cfg.anchors.hipPadRadius,w=cfg.anchors.hipPadWidth/2;
   skin.updateMatrixWorld(true);skin.skeleton.update();const vertex=new T.Vector3();let centerY=-Infinity;
   for(let n=0;n<skin.geometry.attributes.position.count;n++){skin.getVertexPosition(n,vertex).applyMatrix4(skin.matrixWorld);const dz=vertex.z-hip[2];if(Math.abs(vertex.x)<=w&&Math.abs(dz)<=r)centerY=Math.max(centerY,vertex.y+Math.sqrt(r*r-dz*dz));}
   c.y=Number.isFinite(centerY)?centerY-cfg.anchors.hipPadSoftContact:hip[1]+.15;
   for(let i=0;i<2;i++){const sign=i?1:-1;orient(arms[i],[sign*.40,pivot[1],pivot[2]],[sign*.28,mount.y,mount.z]);orient(floatingMounts[i],[sign*.28,mount.y,mount.z],[sign*.28,c.y,c.z]);mountJoints[i].position.set(sign*.28,mount.y,mount.z);}
   lap.position.copy(c);strap.position.set(0,c.y+r,c.z);orient(shaft,[-.30,c.y,c.z],[.30,c.y,c.z]);load.position.set(.48,pivot[1]+d.y*.65,pivot[2]+d.z*.65);for(let i=0;i<2;i++){const side=i?'right':'left',sign=i?-1:1,p=palm(j,side,[sign*.22,hip[1]+.1,hip[2]-.06]);orient(grips[i],[p[0]-.05,p[1],p[2]],[p[0]+.05,p[1],p[2]]);orient(gripStays[i],[sign*.30,c.y,c.z],[p[0]+sign*.05,p[1],p[2]]);}cfg.diagnostics.hipPadCenter=arr(c);cfg.diagnostics.hipPadMountCenter=arr(mount);cfg.diagnostics.hipPadGap=Math.abs(raw.length()-cfg.anchors.leverRadius);
  };
 }else if(key==='spanish-squat-hold'){
  cfg.anchors.post=[0,.48,1.0];const fixed=group('fixed-spanish-squat-anchor');feet(0,1.0,.52,.42,fixed);link([0,.05,1.0],[0,1.08,1.0],.03,'frame',fixed);const straps=[];
  for(let s=0;s<2;s++)for(let i=0;i<8;i++)straps.push(ribbon([0,.5,1],[.1,.5,0],.055,.007));
  update=(t,j)=>{const knees=[joint(j,'leftKnee',[.11,.46,.27]),joint(j,'rightKnee',[-.11,.46,.27])];if(!initialized){initialized=true;cfg.anchors.post[1]=(knees[0][1]+knees[1][1])/2-.025;const cuff=torus(.045,.01,cfg.anchors.post,'rubber',fixed);cuff.rotation.y=Math.PI/2;}
   for(let s=0;s<2;s++){const k=knees[s],r=.062,pts=[];for(let i=0;i<7;i++){const a=Math.PI*i/6;pts.push([k[0]+Math.cos(a)*r,k[1]-.025,k[2]-Math.sin(a)*r]);}const anchor=[cfg.anchors.post[0]+(s?-.018:.018),cfg.anchors.post[1],cfg.anchors.post[2]];const route=[anchor,...pts,anchor];for(let i=0;i<8;i++)orientRibbon(straps[s*8+i],route[i],route[i+1]);}cfg.diagnostics.kneeBandCenters=knees;
  };
 }else if(key==='nordic-hold'){
  cfg.anchors.knees=[[.10,.085,0],[-.10,.085,0]];cfg.anchors.ankles=[[.10,.10,-.43],[-.10,.10,-.43]];const fixed=group('fixed-nordic-knee-and-ankle-support');
  update=(t,j)=>{if(initialized)return;initialized=true;const ks=[joint(j,'leftKnee',cfg.anchors.knees[0]),joint(j,'rightKnee',cfg.anchors.knees[1])],as=[joint(j,'leftAnkle',cfg.anchors.ankles[0]),joint(j,'rightAnkle',cfg.anchors.ankles[1])];cfg.anchors.knees=ks;cfg.anchors.ankles=as;const km=mid(...ks),am=mid(...as);box([.60,.035,Math.abs(km[2]-am[2])+.45],[0,.027,(km[2]+am[2])/2],'metal',fixed);for(const k of ks)pad([.22,.065,.22],[k[0],k[1]-.06,k[2]],fixed);
   const roller=add(new T.CylinderGeometry(.075,.075,.48,24),'pad',[am[0],am[1]+.055,am[2]],fixed);roller.rotation.z=Math.PI/2;for(const x of [-.28,.28])link([x,.045,am[2]],[x,am[1]+.055,am[2]],.022,'frame',fixed);link([-.29,am[1]+.055,am[2]],[.29,am[1]+.055,am[2]],.012,'bright',fixed);
  };
 }else if(key==='plate-pinch-hold'){
  cfg.anchors.contactOffset=[0,-.090,.020];cfg.anchors.plateRadius=.105;cfg.anchors.plateThickness=.014;cfg.anchors.platePairThickness=.030;
  const discs=['left','right'].map(side=>{const g=group(`${side}-two-smooth-pinch-discs`);for(const z of [-.008,.008]){const disc=add(new T.CylinderGeometry(.105,.105,.014,48),'weight',[0,0,z],g);disc.rotation.x=Math.PI/2;const hole=add(new T.CylinderGeometry(.010,.010,.0145,20),'metal',[0,0,z],g);hole.rotation.x=Math.PI/2;}return g});
  update=(t,j)=>{for(let i=0;i<2;i++){const side=i?'right':'left',grip=joint(j,`${side}Grip`,null);if(grip)discs[i].position.set(grip[0],grip[1]-.105,grip[2]);else{const w=joint(j,`${side}Wrist`,[i?-.23:.23,.85,0]);discs[i].position.set(w[0],w[1]-.195,w[2]+.020);}}cfg.diagnostics.gripType='thumb opposes fingertips across smooth outward faces; no rim or handles';};
 }else if(key==='suitcase-carry'){
  cfg.anchors.workingSide='left';cfg.anchors.handleAxis=[0,0,1];const d=dumbbell();
  update=(t,j)=>{const p=palm(j,cfg.anchors.workingSide,[-.23,.84,.02]);d.position.set(...p);cfg.diagnostics.handleCenter=p;};
 }else if(key==='standing-bent-knee-calf-raise'){
  cfg.anchors.support=[0,1.18,.46];cfg.anchors.forefootStepTop=.10;cfg.anchors.forefootStepRearZ=.06;box([.32,.10,.26],[.097,.05,.19],'rubber');const fixed=group('fixed-two-hand-calf-support');update=(t,j)=>{if(initialized)return;initialized=true;const l=palm(j,'left',[.22,1.18,.40]),r=palm(j,'right',[-.22,1.18,.40]),c=mid(l,r);cfg.anchors.support=c;const span=Math.max(.34,Math.abs(l[0]-r[0])/2+.10);link([-span,c[1],c[2]],[span,c[1],c[2]],.018,'rubber',fixed);for(const x of [-span,span]){feet(x,c[2],.19,.42,fixed);link([x,.05,c[2]],[x,c[1],c[2]],.022,'frame',fixed);}};
 }else if(key==='stepmill-continuous-walk'){
  cfg.anchors.treadPitch=.19;cfg.anchors.treadDepth=.25;cfg.anchors.frontStep=[0,.11,-.15];cfg.anchors.handrailGrips=[[.38,1.30,.29],[-.38,1.30,.29]];cfg.tread={rise:.19,run:.25,frontY:.129,frontZ:-.15,cycleTreads:2,countVisible:3};cfg.anchors.treads=cfg.tread;cfg.footContactOffset=.066;cfg.railAnchors=cfg.anchors.handrailGrips;const fixed=group('fixed-stepmill-housing');feet(0,.14,.90,1.24,fixed);box([.78,.08,1.05],[0,.07,.15],'metal',fixed);
  for(const x of [-.40,.40]){const side=box([.055,.10,.80],[x,.28,.20],'frame',fixed);side.rotation.x=-.65;link([x,.05,-.25],[x,.56,.52],.016,'frame',fixed);const railX=Math.sign(x)*.38;segments([[railX,.10,-.32],[railX,1.00,-.30],[railX,1.30,.17],[railX,1.30,.42],[railX,1.54,.66]],.022,'frame',fixed);link([railX,1.30,.17],[railX,1.30,.42],.025,'rubber',fixed);}
  link([-.40,1.54,.64],[.40,1.54,.64],.020,'frame',fixed);const console=box([.43,.20,.08],[0,1.56,.65],'pad',fixed);console.rotation.x=-.28;box([.31,.11,.006],[0,1.58,.606],'weight',fixed);
  const stairs=Array.from({length:8},(_,i)=>{const g=group(`revolving-tread-${i}`);box([.70,.038,.25],[0,0,0],'rubber',g);box([.70,.17,.018],[0,-.085,-.117],'metal',g);for(const x of [-.24,-.12,0,.12,.24])box([.007,.003,.22],[x,.021,0],'metal',g);return g});
  update=(t)=>{const q=((t%1)+1)%1;for(let i=0;i<stairs.length;i++){const v=(i-2*q+8)%8;stairs[i].visible=v<3;stairs[i].position.set(0,.11+v*.19,-.15+v*.25);}cfg.diagnostics.conveyorTravelTreads=q*2;};
 }else if(key==='walking-flat-ground'){
  cfg.anchors.equipment='none';
 }else throw Error(`Unknown exercise equipment key: ${key}`);
 const api={objects:[root],config:cfg,update(t=0,joints={},phase=0){update(t,joints,phase);root.updateMatrixWorld(true);return cfg.diagnostics},dispose(){root.removeFromParent();const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])ms.add(m)});for(const g of gs)g.dispose();for(const m of ms)m.dispose();for(const m of Object.values(mats))if(!ms.has(m))m.dispose();}};
 return api;
}


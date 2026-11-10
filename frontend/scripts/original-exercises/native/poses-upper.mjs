// Original TGym exercise poses for the licensed native anatomical rig.
// Metres, Y up, athlete faces +Z. Bone lengths and mesh are never changed.
const TAU=Math.PI*2,rad=d=>d*Math.PI/180;
const supported=new Set(['overhead-cable-triceps-ez-bar','bayesian-cable-curl','cross-body-lat-pull-around','dead-hang']);
const xyz=v=>v.toArray(),phaseAt=t=>(1-Math.cos(TAU*((Number(t)||0)%1)))/2;
const source={
 overhead:'https://www.muscleandstrength.com/exercises/standing-low-pulley-overhead-tricep-extension.html',
 bayesian:'https://mennohenselmans.com/bayesian-curls/',
 cross:'https://www.youtube.com/watch?v=4xHF_pMbEsk',
 hang:'https://vimeo.com/699467769',
};
function direction(art,a){return art.V(a).normalize();}
function armFromDirections(art,side,upper,fore,hand={}){
 art.aim(`upperarm${side}`,`forearm${side}`,upper);
 art.aim(`forearm${side}`,`hand${side}`,fore);
 art.hand(side,{direction:fore,curl:.98,...hand});
}
function plantedLeg(art,side,ankle,bend=[0,0,1]){
 const result=art.ik('leg',side,ankle,bend);
 art.foot(side,{pitch:0,yaw:0});
 return result;
}
function positionList(j,names){return Object.fromEntries(names.map(n=>[n,j[n]]));}

export function motionA(key,t,art){
 if(!supported.has(key))return null;
 const p=phaseAt(t),metadata={authored:'original native-rig FK/IK; no image-derived poses',isometric:false};
 let camera,targets,phase=p;
 if(key==='overhead-cable-triceps-ez-bar'){
  // User-confirmed LOW rear pulley, upright torso and short cable EZ bar.
  // Humeri remain vertical beside the ears. Only the elbows extend; hands
  // move from behind the head to overhead without a shoulder press or hinge.
  art.base([0,.830,0],0);
  plantedLeg(art,'L',[.13,.0655,.18]);
  plantedLeg(art,'R',[-.13,.0655,-.14]);
  const flex=rad(105-93*p),fore=[0,Math.cos(flex),-Math.sin(flex)];
  for(const side of ['L','R']){
   armFromDirections(art,side,[0,1,0],fore,{roll:0,curl:.99});
   // Keep the hand's transverse grip axis parallel to the fixed EZ bar.
   // A constant shortest-arc wrist roll would rotate the palm sideways as
   // the forearm crosses overhead, making its actual grip slide on the bar.
   const axis=direction(art,fore),across=art.wp(`index_01${side}`).sub(art.wp(`pinky_01${side}`));
   across.addScaledVector(axis,-across.dot(axis)).normalize();
   const wanted=art.V([side==='L'?-1:1,0,0]);
   const roll=Math.atan2(axis.dot(across.clone().cross(wanted)),across.dot(wanted));
   art.hand(side,{direction:fore,roll,curl:.99});
  }
  targets=['triceps_brachii'];
  camera={position:[3.7,1.70,-3.2],target:[0,1.05,-.20],span:2.65};
  Object.assign(metadata,{source:source.overhead,sourceScope:'Low-pulley upright mechanics; short curved EZ cable attachment and split stance are user-confirmed, whereas the primary guide uses a straight cable bar. Authored 105-to-12-degree flexion is an illustrative controlled range, not a clinical prescription.',pulley:[0,.14,-.8],torsoLeanFromVerticalDeg:0,elbowFlexionDeg:105-93*p,upperArmsFixed:true,upperArmElevationFromVerticalDeg:0,attachment:'short wavy cable EZ bar; both actual grip centers',fixedFeet:[[.13,.0655,.18],[-.13,.0655,-.14]]});
 }else if(key==='bayesian-cable-curl'){
  // RIGHT working arm (-X) matches the fixed rear-low cable tower. The
  // modest shoulder extension is fixed; elbow flexion supplies the curl.
  art.base([0,.830,0],rad(4));
  plantedLeg(art,'R',[-.13,.0655,.18]);
  plantedLeg(art,'L',[.13,.0655,-.14]);
  const behind=rad(12),flex=rad(12+123*p),a=-behind+flex;
  armFromDirections(art,'R',[0,-Math.cos(behind),-Math.sin(behind)],[0,-Math.cos(a),Math.sin(a)],{roll:0,curl:.98});
  art.ik('arm','L',[.235,.845,.07],[0,0,1]);
  art.hand('L',{direction:[0,-1,.08],curl:.12});
  targets=['biceps_brachii@R'];
  camera={position:[-4.1,1.60,3.2],target:[-.25,1.04,-.22],span:2.65};
  Object.assign(metadata,{source:source.bayesian,pulley:[-.80,.14,-.8],workingSide:'R',elbowFlexionDeg:12+123*p,upperArmShoulderExtensionDeg:12,elbowFixed:true,torsoLeanFromVerticalDeg:4,grip:'supinated single D-handle; actual rightGrip'});
 }else if(key==='cross-body-lat-pull-around'){
  // Machine is on the RIGHT/negative-X side of the person. Working LEFT
  // arm is the FAR arm and therefore crosses the torso toward the machine.
  art.base([0,.480,0],0);
  art.ik('leg','R',[-.13,.0655,-.40],[0,-1,1]);
  art.foot('R',{pitch:0,yaw:Math.PI});
  plantedLeg(art,'L',[.155,.0655,.42]);
  const start=art.V([-.235,1.300,.180]),finish=art.V([.170,.640,.230]);
  const wrist=start.lerp(finish,p);
  // A small forward arc keeps the cable and hand ahead of the sternum.
  wrist.z+=.055*Math.sin(Math.PI*p);
  // The elbow finishes DOWN beside the torso, not flared out at shoulder
  // height like an ordinary row. At full reach it is nearly straight.
  art.ik('arm','L',xyz(wrist),[.20,-.55,-1]);
  const fore=art.wp('handL').sub(art.wp('forearmL')).normalize();
  art.hand('L',{direction:fore,roll:0,curl:.98});
  // Free hand rests near the forward thigh instead of grabbing a second
  // handle or swinging across the moving cable.
  art.ik('arm','R',[-.115,.635,.285],[0,0,.9]);
  art.hand('R',{direction:[0,-.65,.45],curl:.20});
  targets=['latissimus_dorsi@L'];
  camera={position:[3.4,1.50,-3.8],target:[-.18,1.04,.04],span:2.65};
  Object.assign(metadata,{source:source.cross,pulley:[-.88,1.85,.18],workingSide:'L',nearKnee:'R',nearKneeGrounded:true,farFootForward:true,torsoRotationDuringRepDeg:0,handPath:'far-arm crossbody high reach to working-side hip',wristTarget:xyz(wrist)});
 }else{
  // A dead hang is an isometric suspension, not a pull-up or a repeated
  // scapular pull. The whole figure is translated once to the fixed bar.
  const barHeight=2.20;
  function hangAt(y,z){
   art.base([0,y,z],0);
   for(const side of ['L','R']){
    const sign=side==='L'?1:-1,u=direction(art,[sign*.15,1,0]);
    armFromDirections(art,side,u,u,{direction:[0,1,0],roll:Math.PI,curl:.99});
    art.aim(`thigh${side}`,`shin${side}`,[0,-1,0]);
    art.aim(`shin${side}`,`foot${side}`,[0,-1,0]);
    art.foot(side,{pitch:.08,yaw:0});
   }
   return art.joints();
  }
  const first=hangAt(1.060,0);
  const gripY=(first.leftGrip[1]+first.rightGrip[1])/2,gripZ=(first.leftGrip[2]+first.rightGrip[2])/2;
  hangAt(1.060+barHeight-gripY,-gripZ);
  phase=0;
  targets=['latissimus_dorsi','flexor_digitorum_superficialis','flexor_digitorum_profundus'];
  camera={position:[3.2,1.55,4.2],target:[0,1.18,0],span:2.70};
  Object.assign(metadata,{source:source.hang,isometric:true,barHeight,barZ:0,armsStraight:true,pullupRepetitions:0,handAnchor:'actual leftGrip/rightGrip centered on fixed bar',feetFree:true});
 }
 const j=art.joints();
 metadata.contacts=positionList(j,['leftGrip','rightGrip','leftAnkle','rightAnkle','leftElbow','rightElbow','leftKnee','rightKnee']);
 metadata.poseErrors=art.poseErrors.map(e=>({...e}));
 return{phase,targets,camera,metadata};
}

export function extendRig(art){
 const {THREE,bones,rest,model}=art,V=(p)=>p?.isVector3?p.clone():new THREE.Vector3(...p),n=s=>s.replaceAll('.','');
 const wp=s=>bones[n(s)].getWorldPosition(new THREE.Vector3());
 function worldQ(name,q){const b=bones[n(name)],parent=b.parent.getWorldQuaternion(new THREE.Quaternion());b.quaternion.copy(parent.invert().multiply(q));model.updateMatrixWorld(true);}
 function aim(name,child,direction,roll=0){name=n(name);child=n(child);const wanted=V(direction).normalize(),base=rest[child].pos.clone().sub(rest[name].pos).normalize(),q=new THREE.Quaternion().setFromUnitVectors(base,wanted).multiply(rest[name].world);if(roll)q.premultiply(new THREE.Quaternion().setFromAxisAngle(wanted,roll));worldQ(name,q);}
 const errors=[];
 function base(position=[0,.85,0],tilt=0){art.reset();errors.length=0;bones.pelvis.position.set(...position);worldQ('pelvis',new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),tilt).multiply(rest.pelvis.world));}
 function ik(kind,side,end,bend=[0,0,1]){
  const names=kind==='arm'?[`upperarm${side}`,`forearm${side}`,`hand${side}`]:[`thigh${side}`,`shin${side}`,`foot${side}`],a=wp(names[0]),e=V(end),l1=rest[names[0]].pos.distanceTo(rest[names[1]].pos),l2=rest[names[1]].pos.distanceTo(rest[names[2]].pos),d=e.clone().sub(a),distance=d.length(),reach=Math.max(Math.abs(l1-l2)+1e-5,Math.min(l1+l2-1e-5,distance));
  d.normalize();const bendVector=V(bend).addScaledVector(d,-V(bend).dot(d));if(bendVector.length()<1e-5)bendVector.set(1,0,0).addScaledVector(d,-d.x);bendVector.normalize();const along=(l1*l1-l2*l2+reach*reach)/(2*reach),height=Math.sqrt(Math.max(0,l1*l1-along*along)),joint=a.clone().addScaledVector(d,along).addScaledVector(bendVector,height),actualEnd=a.clone().addScaledVector(d,reach);
  aim(names[0],names[1],joint.clone().sub(a));aim(names[1],names[2],actualEnd.clone().sub(wp(names[1])));
  const error=wp(names[2]).distanceTo(e);if(error>.003)errors.push({kind,side,error,target:e.toArray(),actual:wp(names[2]).toArray()});return{root:a.toArray(),joint:wp(names[1]).toArray(),end:wp(names[2]).toArray(),error,unreachable:Math.abs(distance-reach)>.003};
 }
 function foot(side,{pitch=0,yaw=0}={}){const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ')).multiply(rest[`foot${side}`].world);worldQ(`foot${side}`,q);}
 function gripArm(side,target,bend,options={direction:[0,0,1],curl:1}){art.hand(side,options);const k=side==='L'?'leftGrip':'rightGrip',delta=V(art.grips()[k]).sub(wp(`hand${side}`));const result=ik('arm',side,V(target).sub(delta),bend);art.hand(side,options);return result;}
 function joints(){const result={};for(const [long,short]of[['left','L'],['right','R']])for(const [name,bone]of[['Shoulder','upperarm'],['Elbow','forearm'],['Wrist','hand'],['Hip','thigh'],['Knee','shin'],['Ankle','foot'],['Toes','toes']])result[long+name]=wp(bone+short).toArray();for(const name of ['pelvis','head','neck'])result[name]=wp(name).toArray();return result;}
 Object.assign(art,{V,wp,worldQ,aim,base,ik,foot,gripArm,joints,poseErrors:errors});return art;
}

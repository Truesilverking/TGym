const PI=Math.PI,rad=x=>x*PI/180,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),cycle=t=>(1-Math.cos(2*PI*t))/2;
const camera=(position,target,span)=>({position,target,span});
const standing=art=>{for(const s of ['L','R']){art.ik('leg',s,[s==='L'?.11:-.11,.065,0],[0,0,1]);art.foot(s);}};
function armsForward(art){for(const s of ['L','R']){art.aim(`upperarm${s}`,`forearm${s}`,[0,0,1]);art.aim(`forearm${s}`,`hand${s}`,[0,0,1]);art.hand(s,{direction:[0,0,1],curl:.05});}}
function armsCrossed(art){for(const s of ['L','R']){const sh=art.wp(`upperarm${s}`),other=s==='L'?-.11:.11;art.ik('arm',s,[other,sh.y-.12,sh.z+.16],[s==='L'?1:-1,-.3,.1]);art.hand(s,{curl:.1});}}
function walk(art,t,carry=false){
 const travel=.70*t;art.base([0,.818+.006*Math.cos(4*PI*t),travel],rad(3));
 for(const [side,offset,x]of[['L',0,.105],['R',.5,-.105]]){
  const total=t+offset,round=Math.floor(total),p=total-round,ground=.18+.70*round-.70*offset,stance=.62,u=clamp((p-stance)/(1-stance));
  const ankle=[x,.065+(p<stance?0:.13*Math.sin(PI*u)),p<stance?ground:ground+.70*(u*u*(3-2*u))];
  art.ik('leg',side,ankle,[0,0,1]);art.foot(side,{pitch:p<stance?0:-.12*Math.sin(2*PI*u)});
  const a=(side==='L'?-1:1)*rad(22)*Math.cos(2*PI*t),holding=carry&&side==='L',angle=holding?a*.12:a;
  art.aim(`upperarm${side}`,`forearm${side}`,[0,-Math.cos(angle),Math.sin(angle)]);
  art.aim(`forearm${side}`,`hand${side}`,[0,-Math.cos(angle+(holding?.08:.26)),Math.sin(angle+(holding?.08:.26))]);
  art.hand(side,{curl:holding?1.05:.2,roll:holding?-PI/2:0});
 }
 return{phase:cycle(t),targets:carry?['external_oblique','quadratus_lumborum','forearms@L']:['quads','gluteus_maximus','calves'],camera:camera([2.6,1.45,4.1+travel],[0,.86,travel],2.05),metadata:{mode:'gait',travel,stanceFraction:.62,stepLength:.35,forwardDirection:'+Z',carrySide:carry?'L':null}};
}
export function motionRoot(key,t,art){
 let phase=cycle(t),result;
 if(key==='walking-flat-ground'||key==='suitcase-carry')return walk(art,t,key==='suitcase-carry');
 if(key==='plate-pinch-hold'){
  art.base();standing(art);for(const side of ['L','R']){art.aim(`upperarm${side}`,`forearm${side}`,[side==='L'?.22:-.22,-.975,0]);art.aim(`forearm${side}`,`hand${side}`,[0,-1,0]);art.hand(side,{direction:[0,-1,0],roll:side==='L'?-PI/2:PI/2,pinch:true,curl:.1});}
  result={targets:['forearms'],camera:camera([2.6,1.35,4],[0,.84,0],2.02),metadata:{mode:'isometric',pinch:true}};
 }else if(key==='spanish-squat-hold'){
  art.base([0,.470,-.390]);for(const side of ['L','R']){art.ik('leg',side,[side==='L'?.11:-.11,.065,0],[0,0,1]);art.foot(side);}armsForward(art);
  result={targets:['quads'],camera:camera([3,1.5,2.4],[0,.64,.22],2.20),metadata:{mode:'isometric',strapLocation:'proximal lower leg behind both knees',torso:'upright'}};
 }else if(key==='nordic-hold'){
  const lean=rad(30),l=art.rest.thighL.pos.distanceTo(art.rest.shinL.pos),kneeY=.115;art.base([0,kneeY+l*Math.cos(lean),l*Math.sin(lean)],lean);
  for(const side of ['L','R']){art.aim(`thigh${side}`,`shin${side}`,[0,-Math.cos(lean),-Math.sin(lean)]);art.aim(`shin${side}`,`foot${side}`,[0,0,-1]);art.foot(side,{yaw:PI});}armsCrossed(art);
  result={targets:['hamstrings'],camera:camera([3,1.25,-2.7],[0,.63,.0],1.9),metadata:{mode:'isometric',leanDegrees:30,bodyLine:'shoulder-hip-knee',kneesFixed:true,anklesFixed:true}};
 }else if(key==='captains-chair-knee-raise'){
  art.base([0,1.0,0]);const hipFlex=rad(4+86*phase),kneeFlex=rad(12+85*phase);
  for(const side of ['L','R']){art.aim(`thigh${side}`,`shin${side}`,[0,-Math.cos(hipFlex),Math.sin(hipFlex)]);art.aim(`shin${side}`,`foot${side}`,[0,-Math.cos(hipFlex-kneeFlex),Math.sin(hipFlex-kneeFlex)]);art.foot(side);
   art.aim(`upperarm${side}`,`forearm${side}`,[side==='L'?.1:-.1,-.995,0]);art.aim(`forearm${side}`,`hand${side}`,[0,0,1]);art.hand(side,{direction:[0,1,0],curl:1.0});}
  result={targets:['rectus_abdominis'],camera:camera([2.8,1.65,3.7],[0,1.0,.05],2.3),metadata:{mode:'repetition',hipFlexionDegrees:4+86*phase,kneeFlexionDegrees:12+85*phase,backAndForearmsFixed:true}};
 }else if(key==='machine-hip-thrust'){
  const S=[0,.63,-.44],v=art.rest.upperarmL.pos.clone().add(art.rest.upperarmR.pos).multiplyScalar(.5).sub(art.rest.pelvis.pos),R=Math.hypot(v.y,v.z),hipY=.38+.25*phase,tilt=Math.atan2(-v.z,v.y)-Math.acos((S[1]-hipY)/R),offZ=v.y*Math.sin(tilt)+v.z*Math.cos(tilt),hipZ=S[2]-offZ;
  art.base([0,hipY,hipZ],tilt);for(const side of ['L','R']){art.ik('leg',side,[side==='L'?.12:-.12,.232,.482],[0,0,1]);art.foot(side);const shoulder=art.wp(`upperarm${side}`);art.ik('arm',side,[side==='L'?.21:-.21,hipY+.10,hipZ-.06],[side==='L'?.4:-.4,-1,0]);art.hand(side,{curl:1.0});}
  result={targets:['gluteus_maximus'],camera:camera([3,1.35,1.35],[0,.68,.01],2.2),metadata:{mode:'repetition',shoulderAnchor:S,hipArcRadius:R,hipArcCenter:S,feetFixed:true,topBodyLine:phase>.99}};
 }else if(key==='standing-bent-knee-calf-raise'){
  const pitch=rad(25)*phase,half=rad(20),l1=art.rest.thighL.pos.distanceTo(art.rest.shinL.pos),l2=art.rest.shinL.pos.distanceTo(art.rest.footL.pos),offset=art.rest.footL.pos.clone().sub(art.rest.toesL.pos).applyAxisAngle(new art.THREE.Vector3(1,0,0),pitch),toe=[.0971,.10,.12],ankle=offset.add(art.V(toe));
  art.base([0,ankle.y+(l1+l2)*Math.cos(half),ankle.z-(l1-l2)*Math.sin(half)]);
  art.aim('thighL','shinL',[0,-Math.cos(half),Math.sin(half)]);art.aim('shinL','footL',[0,-Math.cos(half),-Math.sin(half)]);art.foot('L',{pitch});
  art.ik('leg','R',[-.13,.40,-.22],[0,0,1]);art.foot('R',{pitch:-.35});
  for(const side of ['L','R']){art.ik('arm',side,[side==='L'?.22:-.22,1.18,.40],[side==='L'?.25:-.25,-1,0]);art.hand(side,{direction:[0,0,1],curl:.95});}
  result={targets:['soleus@L'],camera:camera([2.9,1.35,-2.6],[0,.87,.08],2.0),metadata:{mode:'repetition',kneeFlexionDegrees:40,forefootAnchor:toe,unilateral:'L',heelPitchDegrees:25*phase}};
 }else if(key==='stepmill-continuous-walk'){
  const config=art.equipment?.config?.tread||{},rise=config.rise??.19,run=config.run??.25,baseY=config.frontY??.129,baseZ=config.frontZ??-.15,ankleOffset=.065;
  art.base([0,.98+.006*Math.cos(4*PI*t),-.03],rad(5));
  for(const [side,offset,x]of[['L',0,.11],['R',.5,-.11]]){const p=(t+offset)%1,stance=.62,u=clamp((p-stance)/(1-stance));let y,z;if(p<stance){y=baseY+2*rise-2*rise*p+ankleOffset;z=baseZ+2*run-2*run*p-.04;}else{const smooth=u*u*(3-2*u);y=baseY+2*rise-2*rise*stance+ankleOffset+2*rise*stance*smooth+.17*Math.sin(PI*u);z=baseZ+2*run-2*run*stance-.04+2*run*stance*smooth;}art.ik('leg',side,[x,y,z],[0,0,1]);art.foot(side);
   art.gripArm(side,[side==='L'?.38:-.38,1.30,.29],[side==='L'?.3:-.3,-1,0],{direction:[0,0,1],curl:.9});}
  result={targets:['quads','gluteus_maximus','calves'],camera:camera([3,1.8,3.5],[0,.92,.05],2.35),metadata:{mode:'conveyor-gait',rise,run,baseY,baseZ,stanceFraction:.62,treadVelocity:[0,-2*rise,-2*run]}};
 }else return null;
 return{phase,...result};
}

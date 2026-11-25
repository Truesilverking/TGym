import {extendRig} from './rig.mjs';
import {motionRoot} from './poses-main.mjs';
import {motionA} from './poses-upper.mjs';
import {createEquipment} from './equipment.mjs';
import {addHands} from './hands.mjs';
import {createAvatar} from './avatar.mjs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const scene=new THREE.Scene();scene.background=new THREE.Color('white');
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(768,768);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;document.body.append(renderer.domElement);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const camera=new THREE.OrthographicCamera(-1.05,1.05,1.05,-1.05,.01,30);camera.position.set(2.8,1.6,4.5);camera.lookAt(0,.85,0);
scene.add(new THREE.HemisphereLight(0xffffff,0x555b64,1.3));const key=new THREE.DirectionalLight(0xffffff,2.1);key.position.set(-2,4,5);scene.add(key);const fill=new THREE.DirectionalLight(0xffffff,.7);fill.position.set(3,2,-4);scene.add(fill);
key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:12});key.shadow.normalBias=.008;key.shadow.bias=-.0002;
const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.ShadowMaterial({color:0x54606b,opacity:.14}));floor.receiveShadow=true;floor.rotation.x=-Math.PI/2;floor.position.y=-.006;scene.add(floor);
const vocabulary=await fetch('/muscles.json').then(r=>r.json()),gltf=await new GLTFLoader().loadAsync('/body.glb'),model=gltf.scene;scene.add(model);
let body;model.traverse(n=>{if(n.isSkinnedMesh)body=n});
const positions=body.geometry.attributes.position; // The inverse bind matrices already dequantize SHORT positions into metres.
body.frustumCulled=false;const parts=body.geometry.attributes._part_id,tendons=body.geometry.attributes._tendon;
const colors=new Float32Array(positions.count*3);body.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
body.material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:0,roughness:.8,side:THREE.DoubleSide});
body.castShadow=true;body.receiveShadow=true;
const targetGroups=new Set(['triceps']);
function recolor(groups=[]){targetGroups.clear();for(const id of groups)targetGroups.add(id);for(let i=0;i<positions.count;i++){const code=parts.getX(i),p=code>0?vocabulary.parts[Math.floor((code-1)/2)]:null,m=p&&vocabulary.muscles.find(x=>x.id===p.muscle||x.id===p.id),side=(code-1)%2===0?'L':'R';const active=p&&[p.id,p.muscle,m?.group].some(id=>targetGroups.has(id)||targetGroups.has(id+'@'+side));const tendon=tendons.getX(i),y=positions.getY(i)*.0001,x=positions.getX(i)*.0001,shorts=!active&&y>.72&&y<.94&&Math.abs(x)<.23;const col=new THREE.Color(active?'#bf1724':shorts?'#202328':'#92969c');if(tendon>.5&&!shorts)col.lerp(new THREE.Color('#d8d9db'),tendon*.6);col.toArray(colors,i*3);}body.geometry.attributes.color.needsUpdate=true;}
recolor(['triceps_brachii']);
model.updateMatrixWorld(true);const bones=Object.fromEntries(body.skeleton.bones.map(b=>[b.name,b]));const rest=Object.fromEntries(body.skeleton.bones.map(b=>[b.name,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone(),world:b.getWorldQuaternion(new THREE.Quaternion()),pos:b.getWorldPosition(new THREE.Vector3())}]));
function reset(){for(const [name,b]of Object.entries(bones)){b.position.copy(rest[name].p);b.quaternion.copy(rest[name].q);b.scale.copy(rest[name].s);}model.updateMatrixWorld(true);}
function aim(name,child,direction){const b=bones[name],base=rest[child].pos.clone().sub(rest[name].pos).normalize(),wanted=new THREE.Vector3(...direction).normalize(),delta=new THREE.Quaternion().setFromUnitVectors(base,wanted),world=delta.multiply(rest[name].world.clone()),parent=b.parent.getWorldQuaternion(new THREE.Quaternion());b.quaternion.copy(parent.invert().multiply(world));model.updateMatrixWorld(true);}
function point(name){return bones[name].getWorldPosition(new THREE.Vector3()).toArray();}
function setCamera(position,target=[0,.85,0],span=2.1){camera.position.set(...position);camera.lookAt(...target);camera.left=-span/2;camera.right=span/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();}
let avatar=null,currentKey;
function draw(){avatar?.update(currentKey);model.updateMatrixWorld(true);scene.traverse(node=>{if(node.isMesh&&node!==floor)node.castShadow=true});renderer.render(scene,camera);}
window.nativeArt=addHands(extendRig({THREE,scene,renderer,camera,model,body,bones,rest,reset,aim,point,recolor,setCamera,draw,vocabulary}));
avatar=await createAvatar(nativeArt);nativeArt.avatar=avatar;
nativeArt.renderPose=(key,t)=>{if(key!==currentKey){nativeArt.equipment?.dispose();nativeArt.equipment=createEquipment(nativeArt,key);currentKey=key;}const pose=motionRoot(key,t,nativeArt)||motionA(key,t,nativeArt);if(!pose)throw Error('Unknown motion: '+key);recolor(pose.targets);const joints=nativeArt.joints();nativeArt.equipment.update(t,{...joints,meta:pose.metadata},pose.phase);if(pose.camera)setCamera(pose.camera.position,pose.camera.target,pose.camera.span);draw();return{key,t,phase:pose.phase,joints,errors:structuredClone(nativeArt.poseErrors),metadata:pose.metadata,equipment:nativeArt.equipment.config};};
draw();window.ready=true;

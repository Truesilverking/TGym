/** CC0 MakeHuman envelope fitted to the unmodified Heatsy rest rig.
 * Body surface only; native anatomical hands/feet/head keep their contact skin.
 * Combined derivative follows the target model's CC BY-SA 4.0; see provenance.
 */
export async function attachBodyEnvelope(art, {baseUrl=new URL('./assets/',import.meta.url), keepHead=false}={}) {
  const {THREE,body,model}=art;
  art.reset();model.updateMatrixWorld(true);
  const [info,bin]=await Promise.all([
    fetch(new URL('body-envelope.mesh.json',baseUrl)).then(r=>{if(!r.ok)throw Error('Envelope metadata '+r.status);return r.json()}),
    fetch(new URL('body-envelope.mesh.bin',baseUrl)).then(r=>{if(!r.ok)throw Error('Envelope geometry '+r.status);return r.arrayBuffer()})
  ]);
  const constructors={'<f4':Float32Array,'<u2':Uint16Array,'<u4':Uint32Array};
  const read=name=>{const a=info.attributes[name];return new (constructors[a.dtype])(bin,a.offset,a.length)};
  const geometry=new THREE.BufferGeometry();
  for(const [source,dest] of [['position','position'],['normal','normal'],['skinIndex','skinIndex'],['skinWeight','skinWeight'],['partId','_part_id'],['fiber','_fiber'],['tendon','_tendon']]) {
    geometry.setAttribute(dest,new THREE.BufferAttribute(read(source),info.attributes[source].itemSize));
  }
  // Immutable target-model bind-rest metres. Texture shaders can project this
  // attribute while the very same native bones deform the visible surface.
  geometry.setAttribute('_rest_position',new THREE.BufferAttribute(read('position').slice(),3));
  geometry.setIndex(new THREE.BufferAttribute(read('index'),1));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const sourceColors=body.geometry.getAttribute('color');
  geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(info.vertices*3),3));
  geometry.setAttribute('_active_weight',new THREE.BufferAttribute(new Float32Array(info.vertices),1));
  const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:0,roughness:.77,side:THREE.DoubleSide});
  const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='CC0_continuous_body_envelope';mesh.frustumCulled=false;
  mesh.castShadow=true;mesh.receiveShadow=true;model.add(mesh);model.updateMatrixWorld(true);
  const bones=info.bones.map(name=>{const bone=art.bones[name];if(!bone)throw Error('Missing native bone '+name);return bone});
  // Native source POSITION is quantized SHORT. Its inverse binds therefore
  // include 1e-4 dequantization and CANNOT be reused with Float32 metre vertices.
  // These fresh binds preserve the existing skeleton, all motion, and scale.
  const skeleton=new THREE.Skeleton(bones,bones.map(b=>b.matrixWorld.clone().invert()));
  mesh.bind(skeleton,mesh.matrixWorld.clone());mesh.normalizeSkinWeights();
  const nativeGeometry=body.geometry,skinIndex=nativeGeometry.getAttribute('skinIndex'),skinWeight=nativeGeometry.getAttribute('skinWeight'),position=nativeGeometry.getAttribute('position');
  const contactVertex=new Uint8Array(position.count),nativeBones=body.skeleton.bones;
  for(let i=0;i<position.count;i++) {
    let contact=0;
    for(let j=0;j<4;j++) {
      const name=nativeBones[skinIndex.getComponent(i,j)].name;
      const selected=/^(hand|index_|middle_|ring_|pinky_|thumb_|foot|toes)/.test(name)||(keepHead&&/^(head|neck)$/.test(name));
      if(selected)contact+=skinWeight.getComponent(i,j);
    }
    // Slight overlap avoids visible open cuts at the wrists/ankles.
    const y=position.getY(i)*.0001,x=Math.abs(position.getX(i)*.0001);
    contactVertex[i]=Number((contact>.20&&y<.94&&x>.242)||y<.12||(keepHead&&y>1.435));
  }
  const originalIndex=nativeGeometry.getIndex().array,contactIndices=[];
  for(let i=0;i<originalIndex.length;i+=3)if(contactVertex[originalIndex[i]]||contactVertex[originalIndex[i+1]]||contactVertex[originalIndex[i+2]])contactIndices.push(originalIndex[i],originalIndex[i+1],originalIndex[i+2]);
  const contactGeometry=new THREE.BufferGeometry();
  for(const [name,attribute] of Object.entries(nativeGeometry.attributes))contactGeometry.setAttribute(name,attribute);
  contactGeometry.setIndex(contactIndices);
  const contacts=new THREE.SkinnedMesh(contactGeometry,body.material);contacts.name='Unchanged_native_hand_foot_head_contacts';contacts.frustumCulled=false;contacts.castShadow=true;contacts.receiveShadow=true;
  model.add(contacts);model.updateMatrixWorld(true);contacts.bind(body.skeleton,body.bindMatrix.clone());body.visible=false;
  const nearest=read('nearestNative');
  const edges=read('index'),degree=new Uint32Array(info.vertices);
  for(let i=0;i<edges.length;i+=3)for(let j=0;j<3;j++)degree[edges[i+j]]+=2;
  const offsets=new Uint32Array(info.vertices+1);for(let i=0;i<info.vertices;i++)offsets[i+1]=offsets[i]+degree[i];
  const adjacency=new Uint32Array(offsets[info.vertices]),cursor=offsets.slice();
  for(let i=0;i<edges.length;i+=3)for(let j=0;j<3;j++){const a=edges[i+j];adjacency[cursor[a]++]=edges[i+(j+1)%3];adjacency[cursor[a]++]=edges[i+(j+2)%3]}
  const activeCache=new Map(),illustrationMasks={};let currentKey='__rest__',appliedKey;
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
  function projectSoleus(mask){
    const part=art.vocabulary.parts.findIndex(p=>p.id==='soleus'||p.muscle==='soleus'),code=part*2+1,partIds=nativeGeometry.getAttribute('_part_id'),seeds=[];
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<position.count;i++)if(partIds.getX(i)===code){const p=[position.getX(i)*.0001,position.getY(i)*.0001,position.getZ(i)*.0001];seeds.push(p);for(let c=0;c<3;c++){lo[c]=Math.min(lo[c],p[c]);hi[c]=Math.max(hi[c],p[c])}}
    if(!seeds.length)throw Error('Expected anatomical left soleus source vertices');
    const surface=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),region=new Float32Array(info.vertices),height=hi[1]-lo[1];
    for(let i=0;i<info.vertices;i++){
      const x=surface.getX(i),y=surface.getY(i),z=surface.getZ(i);if(x<=0||y<lo[1]-.015||y>hi[1]+.01)continue;
      const posterior=smooth(.10,.60,-normal.getZ(i)),lateral=smooth(.45,.85,Math.abs(normal.getX(i)))*smooth(-.01,.02,hi[2]-z);
      const lower=1-smooth(lo[1]+height*.55,lo[1]+height*.75,y),upper=1-smooth(hi[1]-.04,hi[1]+.005,y);
      region[i]=Math.max(posterior*lower,lateral*upper)*smooth(lo[1]-.015,lo[1]+.015,y)*smooth(0,.04,x);
      if(region[i]===0)continue;let best=Infinity;
      for(const p of seeds){const d=(p[0]-x)**2+(p[1]-y)**2+(p[2]-z)**2;if(d<best)best=d}
      // The soleus lies beneath gastrocnemius. Project its real 3D extent
      // through the continuous skin only at distal/posterolateral borders;
      // retain the source part IDs and do not paint the proximal calf heads.
      mask[i]=Math.max(mask[i],(1-smooth(.030,.055,Math.sqrt(best)))*region[i]);
    }
    illustrationMasks.soleus={muscle:'soleus',side:'L',sourceVertices:seeds.length,sourceBounds:{min:lo,max:hi},method:'bounded deep-muscle illustration projection onto distal posterior and lateral surface; source IDs unchanged',projectionDistanceMetres:[.030,.055]};return region;
  }
  function syncColors(key=currentKey) {
    currentKey=key;
    const color=geometry.getAttribute('color');
    for(let i=0;i<info.vertices;i++)for(let c=0;c<3;c++)color.array[i*3+c]=sourceColors.array[nearest[i]*3+c];
    color.needsUpdate=true;
    if(!activeCache.has(key)) {
      let mask=new Float32Array(info.vertices);
      for(let i=0;i<info.vertices;i++){const k=nearest[i]*3,r=sourceColors.array[k],g=sourceColors.array[k+1];mask[i]=Number(r>1.6*g&&r>.13)}
      const region=key==='standing-bent-knee-calf-raise'?projectSoleus(mask):null;
      for(let pass=0;pass<10;pass++) {
        const next=new Float32Array(info.vertices);
        for(let i=0;i<info.vertices;i++){let sum=0;for(let e=offsets[i];e<offsets[i+1];e++)sum+=mask[adjacency[e]];next[i]=degree[i]>.0?.45*mask[i]+.55*sum/degree[i]:mask[i]}
        mask=next;
      }
      if(region)for(let i=0;i<mask.length;i++)mask[i]*=region[i];
      activeCache.set(key,mask);
    }
    if(appliedKey!==key){const active=geometry.getAttribute('_active_weight');active.array.set(activeCache.get(key));active.needsUpdate=true;appliedKey=key}
  }
  syncColors();
  const record={sourceModelSha256:info.sourceModelSha256,targetModelSha256:info.targetModelSha256,vertices:info.vertices,triangles:info.triangles,contactTriangles:contactIndices.length/3,bones:bones.length,unchangedBoneObjects:bones.every((b,i)=>body.skeleton.bones[i]===b),nativeBindMatrix:body.bindMatrix.toArray(),envelopeBindMatrix:mesh.bindMatrix.toArray(),nearestNativeDistanceMetres:info.nearestNativeDistanceMetres,illustrationMasks};
  art.envelope={mesh,contacts,geometry,info,record,syncColors,activeCache,dispose(){mesh.parent?.remove(mesh);contacts.parent?.remove(contacts);geometry.dispose();contactGeometry.dispose();material.dispose();body.visible=true;}};
  return art.envelope;
}

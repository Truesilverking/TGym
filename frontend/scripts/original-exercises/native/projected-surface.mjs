// One static four-view painted surface, projected in the rig's fixed bind pose.
// A single texture deforms with the mesh; no animation frames are redrawn.
export async function createProjectedSurface(art,{positionScale=.0001,activeWeight=false}={}){
 const T=art.THREE,texture=await new T.TextureLoader().loadAsync(new URL('./assets/anatomy-surface-atlas.png',import.meta.url).href);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(8,art.renderer.capabilities.getMaxAnisotropy());texture.generateMipmaps=true;
 const material=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,metalness:0,roughness:.87,side:T.DoubleSide});
 const showThroughShorts={value:0};if(activeWeight)material.defines={USE_SMOOTH_ANATOMY_MASK:1};
 material.onBeforeCompile=shader=>{
  shader.uniforms.anatomySurface={value:texture};shader.uniforms.anatomyPositionScale={value:positionScale};shader.uniforms.showThroughShorts=showThroughShorts;
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float anatomyPositionScale;varying vec3 vSurfaceBindPosition;varying vec3 vSurfaceBindNormal;\n#ifdef USE_SMOOTH_ANATOMY_MASK\nattribute float _active_weight;varying float vActiveAnatomy;\n#endif\n').replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceBindPosition=position*anatomyPositionScale;vSurfaceBindNormal=normal;\n#ifdef USE_SMOOTH_ANATOMY_MASK\nvActiveAnatomy=_active_weight;\n#endif\n');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
uniform sampler2D anatomySurface;uniform float showThroughShorts;varying vec3 vSurfaceBindPosition;varying vec3 vSurfaceBindNormal;
#ifdef USE_SMOOTH_ANATOMY_MASK
varying float vActiveAnatomy;
#endif
vec3 anatomySample(vec2 localUV,vec2 cell){return texture2D(anatomySurface,(clamp(localUV,0.002,0.998)+cell)*0.5).rgb;}
`).replace('#include <color_fragment>',`#include <color_fragment>
float activeMuscle=step(diffuseColor.g*1.6,diffuseColor.r)*step(0.13,diffuseColor.r);
#ifdef USE_SMOOTH_ANATOMY_MASK
activeMuscle=smoothstep(0.15,0.85,vActiveAnatomy);
#endif
vec3 p=vSurfaceBindPosition;vec3 n=normalize(vSurfaceBindNormal);float v=(p.y+0.07)/1.85;
vec3 front=anatomySample(vec2(0.5+p.x/1.85,v),vec2(0.0,1.0));
vec3 back=anatomySample(vec2(0.5-p.x/1.85,v),vec2(1.0,1.0));
vec3 left=anatomySample(vec2(0.5-p.z/1.85,v),vec2(0.0,0.0));
vec3 right=anatomySample(vec2(0.5+p.z/1.85,v),vec2(1.0,0.0));
float frontal=pow(abs(n.z),4.0),lateral=pow(abs(n.x),4.0);float sideMix=lateral/(frontal+lateral+0.00001);
// Side reference arms occlude the neutral waist. Use the unobstructed front/
// back paint for that torso region rather than baking an arm onto the ribs.
float torsoRegion=step(0.70,p.y)*(1.0-step(1.44,p.y))*(1.0-step(0.205,abs(p.x)));sideMix*=1.0-torsoRegion;
vec3 painted=mix(n.z>=0.0?front:back,n.x>=0.0?left:right,sideMix);
float garmentBand=smoothstep(0.711,0.722,p.y)*(1.0-smoothstep(0.932,0.943,p.y))*(1.0-step(0.24,abs(p.x)));
painted=mix(painted,vec3(0.013,0.014,0.016),garmentBand);
float luminosity=dot(painted,vec3(0.2126,0.7152,0.0722));
float shortsRegion=step(0.66,p.y)*(1.0-step(0.98,p.y));float clothMask=(1.0-smoothstep(0.025,0.13,luminosity))*shortsRegion;
activeMuscle*=1.0-clothMask*(1.0-showThroughShorts);
float redLuminosity=mix(luminosity,max(luminosity,0.32),clothMask*showThroughShorts);
vec3 red=vec3(redLuminosity*1.3,redLuminosity*0.085,redLuminosity*0.105);
diffuseColor.rgb=mix(painted,red,activeMuscle);
`);
 };return{material,texture,setExercise(key){showThroughShorts.value=key==='machine-hip-thrust'?1:0},dispose(){material.dispose();texture.dispose()}};
}
export async function applyProjectedSurface(art,{redraw=true}={}){const surface=await createProjectedSurface(art);art.body.material.dispose();art.body.material=surface.material;art.renderer.toneMappingExposure=1.04;art.scene.traverse(n=>{if(n.isHemisphereLight)n.intensity=1.15;if(n.isDirectionalLight)n.intensity=n.position.z>0?1.8:.9;});if(redraw)art.draw();return surface;}

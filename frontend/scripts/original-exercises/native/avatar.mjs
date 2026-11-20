// TGym authoring code: AGPL-3.0-or-later. Artwork/source licenses: assets/NOTICE.md.
import {applyProjectedSurface,createProjectedSurface} from './projected-surface.mjs';
import {attachHead} from './head.mjs';
import {attachBodyEnvelope} from './body-envelope.mjs';

/** Initialize the continuous avatar once. Pose rendering calls update, then
 * performs one scene draw. Geometry/rig objects are never recreated per frame.
 */
export async function createAvatar(art){
 const contactsSurface=await applyProjectedSurface(art,{redraw:false});
 const head=await attachHead(art,{paint:true});
 const envelope=await attachBodyEnvelope(art,{keepHead:false});
 const bodySurface=await createProjectedSurface(art,{positionScale:1,activeWeight:true});
 envelope.mesh.material.dispose();envelope.mesh.material=bodySurface.material;
 return{
  head,envelope,contactsSurface,bodySurface,
  update(key='__rest__'){
   envelope.syncColors(key);
   contactsSurface.setExercise(key);
   bodySurface.setExercise(key);
  },
  dispose(){head.dispose();envelope.dispose();bodySurface.dispose();contactsSurface.dispose()},
 };
}

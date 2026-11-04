import {createAquariumSchool} from './aquarium.js';
import {updateAllDeployedModels} from '../templates/smart-deploy.js';
import {injectWaterCaustics,InteractiveBubbleSystem} from '../templates/underwater-fx.js';

/** Existing client scene/floor + manifests. This helper owns the one animation updater call. */
export function createUnderwaterAquarium({scene,bounds,floorMaterial,bubbleCount=400,...schoolOptions}){
 if(!bounds?.isBox3)throw new Error('Supply audited world-space aquarium bounds');
 const controllers=[];const patchedMaterials=new Set();let school,bubbles,disposed=false;
 function attach(material,intensity){
  if(patchedMaterials.has(material))return;
  controllers.push(injectWaterCaustics(material,{intensity,waterLevel:bounds.max.y}));patchedMaterials.add(material);
 }
 function dispose(){if(disposed)return;disposed=true;for(const controller of controllers.reverse())controller.dispose();bubbles?.dispose();school?.dispose();patchedMaterials.clear();}
 try{
  for(const material of Array.isArray(floorMaterial)?floorMaterial:[floorMaterial])attach(material,1.6);
  bubbles=new InteractiveBubbleSystem(scene,bubbleCount,bounds,{seed:42});
  school=createAquariumSchool({scene,bounds,...schoolOptions});
 }catch(error){dispose();throw error;}
 const ready=school.ready.then(()=>{
  if(disposed)return;
  // Patch surfaces AFTER Bio-Motion cloned them; teardown reverses this order.
  for(const handle of school.handles)handle.model?.traverse(node=>{
   if(node.isMesh)for(const material of Array.isArray(node.material)?node.material:[node.material])attach(material,.65);
  });
 }).catch(error=>{dispose();throw error;});
 return {school,bubbles,caustics:controllers,ready,
  update(delta,elapsed){if(disposed)return;school.update(delta);for(const controller of controllers)controller.update(elapsed);bubbles.update(delta,elapsed,school.aquarium.fishInstances);updateAllDeployedModels(delta,elapsed);},
  dispose
 };
}

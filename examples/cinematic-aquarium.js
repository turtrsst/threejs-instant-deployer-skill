import * as THREE from 'three';
import {createUnderwaterSurface} from '../templates/underwater-surface.js';
import {CinematicCameraDirector} from '../templates/cinematic-camera-director.js';
import {DayNightAquariumCycle} from '../templates/day-night-cycle.js';
import {InteractiveFishFeeder} from '../templates/interactive-feeder.js';
import {loadInstancedAquarium} from './instanced-aquarium.js';
import {createAquariumPostProcessing} from '../templates/underwater-postprocessing.js';
import {injectWaterCaustics,InteractiveBubbleSystem} from '../templates/underwater-fx.js';
import {updateAllDeployedModels} from '../templates/smart-deploy.js';

/** Owns the loaded school, FX, post stack and ONE global animation updater call per frame.
 * Scene, camera, renderer, controls, lighting, floor and obstacles stay caller-owned.
 */
export async function createCinematicAquarium({renderer,scene,camera,controls,url,manifest,bounds,obstacles=[],count=500,floorMaterial,bubbleCount=350,postOptions={},bubbleOptions={},schoolOptions={},feedingOptions=null,dayNightOptions=null,cameraOptions=null,surfaceOptions=null}){
 if(!bounds?.isBox3)throw new Error('Audited world aquarium bounds required');
 let school,post,bubbles,feeder,dayNightCycle,cameraDirector,waterSurface,disposed=false;const caustics=[],patched=new Set();
 function dispose(){if(disposed)return;disposed=true;waterSurface?.dispose();cameraDirector?.dispose();dayNightCycle?.dispose();post?.dispose();feeder?.dispose();for(const c of caustics.reverse())c.dispose();bubbles?.dispose();school?.dispose();patched.clear();}
 function attach(material,intensity){if(!material||patched.has(material))return;patched.add(material);caustics.push(injectWaterCaustics(material,{intensity,waterLevel:bounds.max.y}));}
 try{
  school=await loadInstancedAquarium({...schoolOptions,scene,url,manifest,count,bounds,obstacles,renderer});
  if(feedingOptions){feeder=new InteractiveFishFeeder(scene,camera,renderer.domElement,{...feedingOptions,bounds:feedingOptions.bounds??bounds});school.manager.setFeeder(feeder);}
  for(const m of Array.isArray(floorMaterial)?floorMaterial:[floorMaterial])attach(m,1.6);
  for(const mesh of school.manager.instancedMeshes)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])attach(m,.65);
  if(surfaceOptions){waterSurface=createUnderwaterSurface({...surfaceOptions,width:bounds.max.x-bounds.min.x,depth:bounds.max.z-bounds.min.z,centerX:(bounds.min.x+bounds.max.x)/2,centerZ:(bounds.min.z+bounds.max.z)/2,surfaceY:bounds.max.y});scene.add(waterSurface.mesh);waterSurface.update(0,surfaceOptions.sunLight??dayNightOptions?.sunLight);if(feeder)waterSurface.bindFeeder(feeder);}
  bubbles=new InteractiveBubbleSystem(scene,bubbleCount,bounds,bubbleOptions);
  post=createAquariumPostProcessing(renderer,scene,camera,postOptions);
  if(dayNightOptions){
   dayNightCycle=new DayNightAquariumCycle({...dayNightOptions,scene,camera,postFX:post,causticControllers:caustics});
   const patternBounds=new THREE.Box3();for(const geometry of school.manager.geometries){if(!geometry.boundingBox)geometry.computeBoundingBox();patternBounds.union(geometry.boundingBox);}
   const axis=['x','y','z'][school.manager.shaderUniforms.uSpineAxis.value];
   for(const mesh of school.manager.instancedMeshes)dayNightCycle.registerMesh(mesh,'fish',{bounds:patternBounds,axis,upAxis:axis==='y'?'z':'y'});
  }
  // GPU fish cannot be CPU raycast targets. Track a coarse CPU cluster center instead.
  if(postOptions.autoFocusTarget===undefined)post.setFocusTarget(school.manager.clusterRecords[0].mesh);
  if(cameraOptions)cameraDirector=new CinematicCameraDirector({...cameraOptions,camera,controls,postFX:post,fishAquarium:school.manager,bounds:cameraOptions.bounds??bounds});
 }catch(error){dispose();throw error;}
 return {school,bubbles,caustics,post,feeder,dayNightCycle,cameraDirector,waterSurface,
  render(delta,elapsed){if(disposed)return;school.update(delta,elapsed);for(const c of caustics)c.update(elapsed);bubbles.update(delta,elapsed,school.manager.getInteractionSources());updateAllDeployedModels(delta,elapsed);if(cameraDirector)cameraDirector.update(delta,elapsed);else controls?.update(delta);dayNightCycle?.update(delta,elapsed);waterSurface?.update(elapsed,surfaceOptions?.sunLight??dayNightOptions?.sunLight);post.render(delta,elapsed);},
  dispose
 };
}

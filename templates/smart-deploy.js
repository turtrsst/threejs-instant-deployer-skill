import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {injectBioMotion,inferPresetFromName} from './bio-motion-injector.js';
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const active=new Set();
function release(root){root.traverse(n=>{n.geometry?.dispose();for(const m of Array.isArray(n.material)?n.material:n.material?[n.material]:[]){for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();}});}
/** Use one delta and accumulated elapsed timestamp from the application's render loop. */
export function updateAllDeployedModels(delta,elapsed){
 if(!Number.isFinite(delta)||delta<0||!Number.isFinite(elapsed)||elapsed<0)throw new Error('Expected nonnegative delta/elapsed seconds');
 for(const handle of active){handle.mixer?.update(Math.min(delta,.1));handle.bioController?.update(elapsed);}
}
/** New-object API: position is already the normalized bottom-center, not primitive center. */
export function deploySmart3DModel(urlOrDataUri,{scene,position=new THREE.Vector3(),rotationY=0,recommendedScale,manifest,bioPreset,bioOptions={},onLoaded=null,onError=null}={}){
 const scale=recommendedScale??manifest?.recommendedScale;
 if(!Number.isFinite(scale)||scale<=0)throw new Error('Use the computed manifest recommendedScale; no guessed default scale');
 if(!scene?.add)throw new Error('A target scene/group is required');
 const handle={model:null,mixer:null,bioController:null,animationMode:'loading',warnings:[],disposed:false,
  dispose(){if(handle.disposed)return;handle.disposed=true;active.delete(handle);handle.mixer?.stopAllAction();if(handle.mixer&&handle.model)handle.mixer.uncacheRoot(handle.model);handle.bioController?.dispose();if(handle.model){handle.model.removeFromParent();release(handle.model);}}
 };
 handle.ready=new Promise((resolve,reject)=>loader.load(urlOrDataUri,gltf=>{
  const model=gltf.scene;
  if(handle.disposed){release(model);resolve(null);return;}
  handle.model=model;
  try{
   model.position.copy(position);model.rotation.y=rotationY;model.scale.setScalar(scale);
   model.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;for(const m of Array.isArray(n.material)?n.material:[n.material])if(m){m.envMapIntensity=1.2;m.needsUpdate=true;}}});
   const clips=(gltf.animations||[]).filter(c=>c.tracks.length>0);
   if(clips.length){handle.mixer=new THREE.AnimationMixer(model);const action=handle.mixer.clipAction(clips[0]);action.time=Math.random()*clips[0].duration;action.play();handle.animationMode='native-animation';}
   else{
    const requested=bioPreset===undefined?manifest?.bioMotion?.preset:bioPreset;
    const preset=requested===null||requested==='none'?null:requested&&requested!=='auto'?requested:inferPresetFromName(manifest?.assetName||manifest?.query||model.name||'');
    if(preset){handle.bioController=injectBioMotion(model,{...bioOptions,preset});handle.warnings.push(...handle.bioController.warnings);handle.animationMode='procedural-vertex-shader';}
    else handle.animationMode='static';
   }
   scene.add(model);active.add(handle);onLoaded?.(handle);resolve(handle);
  }catch(error){handle.dispose();handle.animationMode='error';try{onError?.(error);}finally{reject(error);}}
 },undefined,error=>{handle.animationMode='error';try{onError?.(error);}finally{reject(error);}}));
 return handle;
}
export function disposeAllDeployedModels(){for(const handle of [...active])handle.dispose();}

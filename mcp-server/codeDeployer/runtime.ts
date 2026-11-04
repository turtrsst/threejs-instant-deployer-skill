import {createBioMotionInjector} from './bioMotion.js';
export {createBioMotionInjector,inferBioMotionPreset} from './bioMotion.js';
/** Serializable: AST embedding supplies the fifth factory argument explicitly. */
export function createAssetDeployer(THREE:any,GLTFLoader:any,MeshoptDecoder:any,RoomEnvironment:any,bioFactory=createBioMotionInjector) {
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 const bio=bioFactory(THREE);const active=new Set<any>();let previous=performance.now(),elapsed=0;
 function release(root:any){root.traverse((n:any)=>{n.geometry?.dispose();for(const m of Array.isArray(n.material)?n.material:n.material?[n.material]:[]){for(const v of Object.values(m) as any[])if(v?.isTexture)v.dispose();m.dispose();}});}
 function deploy(primitive:any,manifest:any,url:string,renderer?:any,scene?:any,options:any={}) {
  if(!primitive?.isMesh)throw new Error('Deployment target must be a Mesh');
  if(!Number.isFinite(manifest.recommendedScale)||manifest.recommendedScale<=0)throw new Error('Manifest scale is required');
  const params=primitive.geometry.parameters;
  const height=params.height??(params.radius!==undefined?params.radius*2:undefined);
  if(!Number.isFinite(height))throw new Error('Unsupported primitive height');
  const wasVisible=primitive.visible;
  const handle:any={model:null,mixer:null,bioController:null,animationMode:'loading',disposed:false,environment:null,warnings:[]};
  handle.dispose=()=>{
   if(handle.disposed)return;handle.disposed=true;
   handle.mixer?.stopAllAction();if(handle.mixer&&handle.model)handle.mixer.uncacheRoot(handle.model.children[0]);
   handle.bioController?.dispose();
   if(handle.model){handle.model.removeFromParent();release(handle.model);}
   if(handle.environment){if(scene?.environment===handle.environment.texture)scene.environment=null;handle.environment.dispose();}
   primitive.visible=wasVisible;active.delete(handle);
  };
  active.add(handle);
  handle.ready=new Promise((resolve,reject)=>loader.load(url,(gltf:any)=>{
   if(handle.disposed){release(gltf.scene);resolve(null);return;}
   const model=gltf.scene;
   try{
    if(!primitive.parent)throw new Error('Primitive has no parent at load completion');
    const group=new THREE.Group();group.name=`${primitive.name||'asset'}_normalized`;
    group.position.copy(primitive.position);group.quaternion.copy(primitive.quaternion);group.scale.copy(primitive.scale);
    group.position.add(new THREE.Vector3(0,-height*primitive.scale.y/2,0).applyQuaternion(primitive.quaternion));
    model.scale.setScalar(manifest.recommendedScale);group.add(model);handle.model=group;
    model.traverse((child:any)=>{if(child.isMesh){child.castShadow=true;child.receiveShadow=true;for(const material of Array.isArray(child.material)?child.material:[child.material])if(material){material.envMapIntensity=1.2;material.needsUpdate=true;}}});
    if(scene&&!scene.environment&&renderer){const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();try{handle.environment=pmrem.fromScene(room,0.04);scene.environment=handle.environment.texture;}finally{room.dispose();pmrem.dispose();}}
    const clips=(gltf.animations||[]).filter((clip:any)=>clip.tracks?.length>0);
    if(clips.length){
     handle.mixer=new THREE.AnimationMixer(model);handle.mixer.clipAction(clips[0]).play();handle.animationMode='native-animation';
    }else{
     const requested=options.bioPreset===undefined?manifest.bioMotion?.preset:options.bioPreset;
     const preset=requested===null||requested==='none'?null:requested&&requested!=='auto'?requested:bio.inferPresetFromName(manifest.assetName||manifest.query||model.name||'');
     if(preset){handle.bioController=bio.injectBioMotion(model,{...(manifest.bioMotion?.options||{}),...(options.bioOptions||{}),preset});handle.warnings.push(...handle.bioController.warnings);handle.animationMode='procedural-vertex-shader';}
     else handle.animationMode='static';
    }
    primitive.parent.add(group);primitive.visible=false;resolve(handle);
   }catch(error){if(handle.model)handle.dispose();else{release(model);active.delete(handle);}handle.animationMode='error';reject(error);}
  },undefined,(error:any)=>{active.delete(handle);primitive.visible=wasVisible;handle.animationMode='error';reject(error);}));
  return handle;
 }
 function update(delta?:number,elapsedTime?:number){
  const now=performance.now();
  if(delta!==undefined&&(!Number.isFinite(delta)||delta<0))throw new Error('delta must be finite and nonnegative');
  if(elapsedTime!==undefined&&(!Number.isFinite(elapsedTime)||elapsedTime<0))throw new Error('elapsed time must be finite and nonnegative');
  const dt=delta??Math.max(0,(now-previous)/1000);previous=now;elapsed=elapsedTime??elapsed+dt;
  for(const h of active){h.mixer?.update(Math.min(dt,0.1));h.bioController?.update(elapsed);}
 }
 function dispose(){for(const h of [...active])h.dispose();}
 return {deploy,update,dispose};
}

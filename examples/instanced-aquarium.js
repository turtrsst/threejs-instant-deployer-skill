import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {InstancedBoidsAquariumManager} from '../templates/instanced-boids-manager.js';

function releaseSource(root){
 const geometries=new Set(),materials=new Set(),textures=new Set();
 root.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:node.material?[node.material]:[]){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
 for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();for(const texture of textures)texture.dispose();
}
/** Async helper owns this loader's source GLTF resources; keep source textures until manager disposal. */
export async function loadInstancedAquarium({scene,url,manifest,count=500,renderer,loader,...options}){
 if(!Number.isFinite(manifest?.recommendedScale)||manifest.recommendedScale<=0)throw new Error('Measured manifest recommendedScale required');
 const gltf=await(loader||new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)).loadAsync(url);
 let manager;
 try{manager=InstancedBoidsAquariumManager.fromGLTF(scene,gltf,count,{...options,recommendedScale:manifest.recommendedScale});if(renderer)manager.validateRenderer(renderer);}
 catch(error){manager?.dispose();releaseSource(gltf.scene);throw error;}
 let disposed=false;
 return {manager,source:gltf,
  update(delta,elapsed){if(!disposed)return manager.update(delta,elapsed);},
  dispose(){if(disposed)return;disposed=true;manager.dispose();releaseSource(gltf.scene);}
 };
}

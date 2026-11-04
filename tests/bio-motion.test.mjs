import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBioMotionInjector,inferBioMotionPreset,createAssetDeployer,injectThreeCode} from '../dist/index.js';
import {injectBioMotion as templateInject} from '../templates/bio-motion-injector.js';
const api=createBioMotionInjector(THREE);
function fixture(){const root=new THREE.Group();root.name='Barramundi Fish';const material=new THREE.MeshStandardMaterial();const a=new THREE.Mesh(new THREE.BoxGeometry(4,1,1),material);const b=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);b.position.x=2.5;root.add(a,b);return {root,a,b,material};}
function compile(material,vertexShader=THREE.ShaderLib.standard.vertexShader){const shader={uniforms:{},vertexShader};material.onBeforeCompile(shader,{});return shader;}
test('auto-spine uses coherent model-local bounds across translated meshes and world transforms',()=>{
 const {root,a,b}=fixture();root.position.set(8,5,-2);root.rotation.y=.8;root.scale.setScalar(.1);const controller=api.injectBioMotion(root,{phaseOffset:0});
 assert.equal(controller.uniforms.uSpineAxis.value,0);assert.deepEqual(controller.bounds.min.toArray().map(x=>Math.round(x*1e8)/1e8),[-2,-.5,-.5]);assert.ok(Math.abs(controller.uniforms.uBBoxSize.value.x-5)<1e-8);
 const sa=compile(a.material),sb=compile(b.material);assert.equal(sa.uniforms.uBBoxMin,sb.uniforms.uBBoxMin);assert.equal(sa.uniforms.uBioTime,sb.uniforms.uBioTime);assert.ok(Math.abs(sb.uniforms.uBioToRoot.value.elements[12]-2.5)<1e-8);controller.dispose();
});
test('shader corrects normals/tangents before defaultnormal; position and both shadow types share deformation',()=>{
 const {root,a}=fixture();const c=api.injectBioMotion(root,{phaseOffset:1});
 const surface=compile(a.material);assert.ok(surface.vertexShader.indexOf('objectNormal=normalize')<surface.vertexShader.indexOf('#include <defaultnormal_vertex>'));assert.match(surface.vertexShader,/objectTangent=normalize/);assert.match(surface.vertexShader,/cross\(J\[1\],J\[2\]\)/);assert.doesNotMatch(surface.vertexShader,/#ifdef USE_NORMAL/);
 for(const [mat,shader] of [[a.customDepthMaterial,THREE.ShaderLib.depth.vertexShader],[a.customDistanceMaterial,THREE.ShaderLib.distanceRGBA.vertexShader]]){const out=compile(mat,shader);assert.equal(out.uniforms.uBioTime,surface.uniforms.uBioTime);assert.equal(out.uniforms.uBioSpeed,surface.uniforms.uBioSpeed);assert.match(out.vertexShader,/transformed=\(uBioFromRoot/);assert.equal(mat.type==='MeshDepthMaterial'||mat.type==='MeshDistanceMaterial',true);}
 c.update(3.25);c.setSpeed(2);assert.equal(surface.uniforms.uBioTime.value,3.25);assert.equal(surface.uniforms.uBioSpeed.value,2);c.dispose();
});
test('material arrays, original shader hooks/cache keys, culling, prior shadow materials are restored',()=>{
 const {root,a,material}=fixture();let hooks=0;material.onBeforeCompile=function(shader){assert.ok(this.isMeshStandardMaterial);hooks++;shader.uniforms.previous={value:42};};material.customProgramCacheKey=()=> 'project-v7';a.material=[material,material];const previousDepth=new THREE.MeshDepthMaterial(),previousDistance=new THREE.MeshDistanceMaterial();a.customDepthMaterial=previousDepth;a.customDistanceMaterial=previousDistance;let disposed=0;material.addEventListener('dispose',()=>{throw new Error('Original material must not be disposed');});
 const c=api.injectBioMotion(root,{preset:'fish_swim'});const clones=a.material;for(const m of clones)m.addEventListener('dispose',()=>disposed++);assert.equal(compile(clones[0]).uniforms.previous.value,42);assert.equal(hooks,1);assert.match(clones[0].customProgramCacheKey(),/project-v7\|bio-motion/);assert.equal(a.frustumCulled,false);assert.equal(material.onBeforeCompile===clones[0].onBeforeCompile,false);
 c.dispose();c.dispose();assert.equal(a.material[0],material);assert.equal(a.customDepthMaterial,previousDepth);assert.equal(a.customDistanceMaterial,previousDistance);assert.equal(a.frustumCulled,true);assert.equal(disposed,2);assert.equal(root.userData.bioMotion,undefined);
});
test('controller setters work before shader compilation and all modes have independent instance state',()=>{
 for(const preset of Object.keys(api.BIO_MOTION_PRESETS)){const one=fixture(),two=fixture();const c=api.injectBioMotion(one.root,{preset,phaseOffset:0,spineAxis:2,spineDirection:-1});const d=api.injectBioMotion(two.root,{preset,phaseOffset:2});c.setSpeed(0);c.update(9);assert.equal(compile(one.a.material).uniforms.uBioSpeed.value,0);assert.equal(d.timeUniform.value,0);assert.notEqual(c.uniforms.uBioPhase.value,d.uniforms.uBioPhase.value);c.dispose();d.dispose();}
});
test('unknown objects stay inanimate, invalid controls/reinjection and unsupported meshes fail safely',()=>{
 assert.equal(inferBioMotionPreset('weathered rock lantern'),null);assert.equal(inferBioMotionPreset('anubias plant'),'aquatic_plant');assert.equal(inferBioMotionPreset('soft coral'),'soft_coral');
 const {root}=fixture();for(const options of [{preset:'invalid'},{speed:NaN},{spineAxis:1},{spineDirection:0},{phaseOffset:Infinity},{headStiffness:1}])assert.throws(()=>api.injectBioMotion(root,options));const c=api.injectBioMotion(root);assert.throws(()=>api.injectBioMotion(root),/already attached/);assert.throws(()=>c.update(NaN));assert.throws(()=>c.setSpeed(-1));c.dispose();
 const unsupported=new THREE.Group();const skin=new THREE.SkinnedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());unsupported.add(skin);assert.throws(()=>api.injectBioMotion(unsupported,{preset:'fish_swim'}),/No supported static geometry/);
});
test('template is standalone and generated from the same factory, including Z-axis detection',()=>{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,5),new THREE.MeshStandardMaterial());mesh.name='Fish';const c=templateInject(mesh);assert.equal(c.uniforms.uSpineAxis.value,2);c.dispose();
});
class FakeLoader{setMeshoptDecoder(){return this;}load(url,onLoad,onProgress,onError){queueMicrotask(()=>{const {root}=fixture();root.name='';const tracks=url==='native'?[new THREE.NumberKeyframeTrack('.rotation[y]',[0,1],[0,.1])]:[];onLoad({scene:root,animations:tracks.length?[new THREE.AnimationClip('Swim',1,tracks)]:[]});});}}
function primitive(){const p=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());new THREE.Scene().add(p);return p;}
test('deployer prioritizes native clips, auto-falls back for organisms, and keeps rocks/opt-out static',async()=>{
 const deployer=createAssetDeployer(THREE,FakeLoader,{},null);
 for(const [url,manifest,mode] of [['native',{assetName:'Fish'},'native-animation'],['static',{assetName:'Fish'},'procedural-vertex-shader'],['static',{assetName:'Rock'},'static'],['static',{assetName:'Fish',bioMotion:{preset:null}},'static']]){
 const p=primitive();const h=deployer.deploy(p,{recommendedScale:.5,...manifest},url);await h.ready;assert.equal(h.animationMode,mode);assert.equal(!!h.mixer,mode==='native-animation');assert.equal(!!h.bioController,mode==='procedural-vertex-shader');deployer.update(.02,4);if(h.bioController)assert.equal(h.bioController.timeUniform.value,4);h.dispose();assert.equal(p.visible,true);
 }deployer.dispose();
});
test('AST output embeds the self-contained bio factory and passes explicit preset/opt-out',()=>{
 const source=`import * as THREE from 'three'; const fish=new THREE.Mesh(new THREE.SphereGeometry(.2));function animate(){}`;
 for(const preset of ['fish_swim','none']){const out=injectThreeCode(source,{target:'fish',manifest:{recommendedScale:.25},url:'/models/fish.glb',bioPreset:preset});assert.match(out,/function createBioMotionInjector/);assert.match(out,/bioMotion/);assert.match(out,preset==='none'?/"preset": null/:/"preset": "fish_swim"/);}
});
test('embedded AST source executes without a skill-module closure dependency',async()=>{
 const source=`import * as THREE from 'three'; const fish=new THREE.Mesh(new THREE.SphereGeometry(.2));scene.add(fish);function animate(){}`;
 const out=injectThreeCode(source,{target:'fish',manifest:{recommendedScale:.5},url:'static',bioPreset:'fish_swim'});
 const body=out.replace(/^import .*;\n/gm,'');
 const handle=new Function('__assetTHREE','__AssetLoader','__AssetDecoder','__AssetRoom','THREE','renderer','scene',body+'\nreturn __instantHandle;')(THREE,FakeLoader,{},null,THREE,undefined,new THREE.Scene());
 await handle.ready;assert.equal(handle.animationMode,'procedural-vertex-shader');handle.dispose();
});
test('smart-deploy template registers, updates and disposes fallback; actual animation still wins',async()=>{
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 const {deploySmart3DModel,updateAllDeployedModels,disposeAllDeployedModels}=await import('../templates/smart-deploy.js');
 const original=GLTFLoader.prototype.load;GLTFLoader.prototype.load=FakeLoader.prototype.load;
 try{
  const scene=new THREE.Scene();assert.throws(()=>deploySmart3DModel('static',{scene,bioPreset:'fish_swim'}),/recommendedScale/);
  const h=deploySmart3DModel('static',{scene,manifest:{recommendedScale:.25},bioPreset:'fish_swim'});await h.ready;assert.equal(h.animationMode,'procedural-vertex-shader');assert.equal(h.model.scale.x,.25);updateAllDeployedModels(.1,2);assert.equal(h.bioController.timeUniform.value,2);disposeAllDeployedModels();assert.equal(scene.children.length,0);
  const native=deploySmart3DModel('native',{scene,recommendedScale:1,bioPreset:'fish_swim'});await native.ready;assert.equal(native.animationMode,'native-animation');native.dispose();
  const late=deploySmart3DModel('static',{scene,recommendedScale:1,bioPreset:'fish_swim'});late.dispose();assert.equal(await late.ready,null);assert.equal(scene.children.length,0);
 }finally{disposeAllDeployedModels();GLTFLoader.prototype.load=original;}
});

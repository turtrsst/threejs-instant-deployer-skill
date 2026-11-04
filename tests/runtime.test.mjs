import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAssetDeployer,auditThreeCode} from '../dist/index.js';
class Loader{setMeshoptDecoder(){return this;}load(url,success,progress,error){queueMicrotask(()=>{if(url==='fail'){error(new Error('load failed'));return;}const scene=new THREE.Group();const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial());scene.add(mesh);success({scene,animations:[new THREE.AnimationClip('Spin',1,[new THREE.NumberKeyframeTrack('.rotation[y]',[0,1],[0,1])])]});});}}
test('runtime preserves oriented bottom offset, scales once, plays mixer, restores fallback',async()=>{
 const scene=new THREE.Scene();const primitive=new THREE.Mesh(new THREE.BoxGeometry(2,4,6),new THREE.MeshStandardMaterial());primitive.position.set(2,7,3);primitive.scale.set(2,3,4);primitive.rotation.z=.2;scene.add(primitive);
 const expected=primitive.position.clone().add(new THREE.Vector3(0,-6,0).applyQuaternion(primitive.quaternion));const api=createAssetDeployer(THREE,Loader,{},null);const h=api.deploy(primitive,{recommendedScale:.5},'ok');await h.ready;
 assert.ok(h.model.position.distanceTo(expected)<1e-10);assert.deepEqual(h.model.scale.toArray(),[2,3,4]);assert.equal(h.model.children[0].scale.x,.5);assert.equal(primitive.visible,false);assert.ok(h.mixer);assert.ok(h.model.children[0].children[0].castShadow);api.update();api.dispose();assert.equal(primitive.visible,true);assert.equal(scene.children.length,1);
});
test('loader failure keeps fallback and rejects handle.ready',async()=>{const p=new THREE.Mesh(new THREE.SphereGeometry(1),new THREE.MeshStandardMaterial());new THREE.Scene().add(p);const api=createAssetDeployer(THREE,Loader,{},null);const h=api.deploy(p,{recommendedScale:1},'fail');await assert.rejects(h.ready,/load failed/);assert.equal(p.visible,true);api.dispose();});
test('static audit evaluates constants without executing dynamic input',()=>{const result=auditThreeCode(`import {Mesh as M,BoxGeometry as B} from 'three'; const h=2*3; const rock=new M(new B(2,h,4)); const dynamic=new M(new B(foo(),2,3));`);assert.equal(result.targets.length,1);assert.deepEqual(result.targets[0].targetSize,[2,6,4]);});
test('dispose during pending load cleans the eventual asset and preserves primitive',async()=>{
 const p=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());const scene=new THREE.Scene();scene.add(p);const api=createAssetDeployer(THREE,Loader,{},null);const h=api.deploy(p,{recommendedScale:1},'ok');h.dispose();assert.equal(await h.ready,null);assert.equal(p.visible,true);assert.equal(scene.children.length,1);
});

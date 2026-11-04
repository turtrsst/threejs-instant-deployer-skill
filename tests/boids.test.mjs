import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBoidsAquariumManager} from '../dist/index.js';
import {BoidsAquariumManager as TemplateManager} from '../templates/boids-manager.js';
const Manager=createBoidsAquariumManager(THREE);
const bounds=()=>new THREE.Box3(new THREE.Vector3(-5,-3,-5),new THREE.Vector3(5,3,5));
function setup(options={}){const scene=new THREE.Scene();return {scene,manager:new Manager(scene,{bounds:bounds(),seed:42,...options})};}
function fish(scene,x=0,y=0,z=0){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.2,.1,.4),new THREE.MeshStandardMaterial());mesh.position.set(x,y,z);scene.add(mesh);return mesh;}
const noWeights={separation:0,alignment:0,cohesion:0,avoidance:0,bounds:0};
test('fixed steps give the same seeded trajectory at 30 and 60 FPS',()=>{
 function run(frames,delta){const {scene,manager}=setup();for(let i=0;i<6;i++)manager.addFish(fish(scene,i*.3-1,0,.2*i),null,{radius:.1});for(let i=0;i<frames;i++)manager.update(delta);return manager.fishInstances;}
 const a=run(120,1/60),b=run(60,1/30);for(let i=0;i<a.length;i++){assert.ok(a[i].position.distanceTo(b[i].position)<1e-10);assert.ok(a[i].velocity.distanceTo(b[i].velocity)<1e-10);assert.ok(a[i].mesh.quaternion.angleTo(b[i].mesh.quaternion)<1e-7);}
});
test('flocking uses snapshot separation, alignment and cohesion; exact overlap separates symmetrically',()=>{
 const {scene,manager}=setup({boundsMargin:.01});const a=manager.addFish(fish(scene,-.1),null,{radius:.1,velocity:new THREE.Vector3(1,0,0),speedMultiplier:1});const b=manager.addFish(fish(scene,.1),null,{radius:.1,velocity:new THREE.Vector3(0,0,1),speedMultiplier:1});manager.update(1/60);assert.ok(a.separation.x<0);assert.ok(b.separation.x>0);assert.ok(a.alignment.z>0);assert.ok(a.cohesion.x>0);
 const two=setup();const c=two.manager.addFish(fish(two.scene),null,{radius:.1,velocity:new THREE.Vector3(0,0,1)});const d=two.manager.addFish(fish(two.scene),null,{radius:.1,velocity:new THREE.Vector3(0,0,1)});two.manager.update(1/60);assert.ok(c.separation.length()>0);assert.ok(d.separation.length()>0);assert.ok(c.separation.x*d.separation.x<0||c.separation.z*d.separation.z<0);
});
test('look-ahead detects real off-center geometry bounds and adds a lateral turn',()=>{
 const {scene,manager}=setup({avoidanceLookAhead:2});const group=new THREE.Group();const rock=new THREE.Mesh(new THREE.BoxGeometry(.4,1,1),new THREE.MeshStandardMaterial());rock.position.x=1.2;group.add(rock);scene.add(group);const obstacle=manager.addObstacle(group);assert.ok(obstacle.box.min.x>.9);
 const f=manager.addFish(fish(scene),null,{radius:.1,velocity:new THREE.Vector3(1,0,0),speedMultiplier:1});const avoidance=manager.computeObstacleAvoidance(f);assert.ok(avoidance.x<0);assert.ok(Math.abs(avoidance.z)>0);f.velocity.set(-1,0,0);assert.equal(manager.computeObstacleAvoidance(f).length(),0);
});
test('swept expanded-box collision cannot tunnel through a thin obstacle at high speed',()=>{
 const {scene,manager}=setup({maxSpeed:20,minSpeed:0,maxForce:.001,weights:noWeights});manager.addObstacle(new THREE.Box3(new THREE.Vector3(.3,-2,-4),new THREE.Vector3(.32,2,4)));
 const f=manager.addFish(fish(scene),null,{radius:.1,velocity:new THREE.Vector3(20,0,0),speedMultiplier:1});manager.update(1/60);assert.ok(f.position.x<=.200001);assert.ok(f.position.x>=0);for(let i=0;i<60;i++)manager.update(1/60);assert.ok(f.position.x<.21);
});
test('root sphere stays inside inset aquarium bounds under large/irregular deltas',()=>{
 const {scene,manager}=setup({maxSpeed:4,minSpeed:.2});const f=manager.addFish(fish(scene,4.7,2.7,4.7),null,{radius:.2,velocity:new THREE.Vector3(4,4,4),speedMultiplier:1});for(let i=0;i<250;i++){manager.update(i%5===0?.5:.017);assert.ok(f.inner.containsPoint(f.position));assert.ok(f.velocity.length()<=4+1e-8);}assert.ok(manager.stats.droppedTime>0);
});
test('overlapping spawn is depenetrated and impossible spaces are reported as blocked',()=>{
 const {scene,manager}=setup();const proxy=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5));manager.addObstacle(proxy);const f=manager.addFish(fish(scene),null,{radius:.1});manager.update(1/60);assert.equal(proxy.clone().expandByScalar(.1).containsPoint(f.position),false);
 const impossible=setup();impossible.manager.addObstacle(bounds());impossible.manager.addFish(fish(impossible.scene),null,{radius:.1});const stats=impossible.manager.update(1/60);assert.equal(stats.blockedFish,1);
});
test('static/dynamic obstacle cache and explicit refresh/removal have distinct lifecycles',()=>{
 const {scene,manager}=setup();const a=fish(scene,1),b=fish(scene,-1);const staticProxy=manager.addObstacle(a),moving=manager.addObstacle(b,{dynamic:true,padding:.1});a.position.x=3;b.position.x=-3;manager.update(0);assert.ok(staticProxy.box.max.x<2);assert.ok(moving.box.max.x<-2);manager.refreshObstacle(a);assert.ok(staticProxy.box.min.x>2);assert.equal(manager.removeObstacle(moving),true);assert.equal(manager.removeObstacle(moving),false);
});
test('world-space movement and heading work under translated/rotated uniformly-scaled parents',()=>{
 const {scene,manager}=setup({weights:noWeights,maxSpeed:1,minSpeed:0,turnRate:100});const parent=new THREE.Group();parent.position.set(1,0,1);parent.rotation.y=.7;parent.scale.setScalar(.5);scene.add(parent);const mesh=fish(scene);parent.add(mesh);const f=manager.addFish(mesh,null,{radius:.1,velocity:new THREE.Vector3(1,0,0),speedMultiplier:1,forwardAxis:0,forwardSign:-1});const initial=f.position.clone();for(let i=0;i<60;i++)manager.update(1/60);assert.ok(mesh.getWorldPosition(new THREE.Vector3()).distanceTo(initial.clone().add(new THREE.Vector3(1,0,0)))<1e-8);const head=new THREE.Vector3(-1,0,0).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()));assert.ok(head.dot(new THREE.Vector3(1,0,0))>.999);
});
test('bio spine direction determines the head, never a hardcoded rotateY correction or time update',()=>{
 for(const axis of [0,2])for(const dir of [-1,1]){const {scene,manager}=setup({turnRate:100,weights:noWeights});let updates=0;const bio={uniforms:{uSpineAxis:{value:axis},uSpineDir:{value:dir}},update(){updates++;}};const mesh=fish(scene);manager.addFish(mesh,bio,{radius:.1,velocity:new THREE.Vector3(0,0,1)});for(let i=0;i<20;i++)manager.update(1/60);const forward=new THREE.Vector3(axis===0?-dir:0,0,axis===2?-dir:0).applyQuaternion(mesh.quaternion);assert.ok(forward.z>.999);assert.equal(updates,0);}
});
test('spatial hash avoids all-pairs work for far-spaced fish',()=>{
 const {scene,manager}=setup({bounds:new THREE.Box3(new THREE.Vector3(-50,-5,-50),new THREE.Vector3(50,5,50))});for(let x=0;x<10;x++)for(let z=0;z<10;z++)manager.addFish(fish(scene,x*5-25,0,z*5-25),null,{radius:.1});const stats=manager.update(1/60);assert.ok(stats.neighborChecks<100*10);assert.equal(stats.fishCount,100);
});
test('random spawn is deterministic and avoids obstacles; normal registration preserves original position',()=>{
 const {scene,manager}=setup();manager.addObstacle(new THREE.Box3(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1)));const mesh=fish(scene,2,0,0);const a=manager.addFish(mesh,null,{radius:.1});assert.equal(a.position.x,2);const b=manager.addFish(fish(scene),null,{radius:.1,randomizePosition:true});assert.ok(b.inner.containsPoint(b.position));assert.equal(manager.obstacles[0].box.clone().expandByScalar(.1).containsPoint(b.position),false);
});
test('validation, no-op delta, detach pruning and dispose do not own render resources',()=>{
 const {scene,manager}=setup();for(const options of [{maxSpeed:0},{neighborRadius:NaN},{maxSubSteps:1.2},{seed:NaN},{minSpeed:4},{weights:{cohesion:-1}}])assert.throws(()=>new Manager(scene,options));const mesh=fish(scene);const f=manager.addFish(mesh,null,{radius:.1});assert.throws(()=>manager.addFish(mesh));assert.throws(()=>manager.update(NaN));assert.throws(()=>manager.update(-1));const before=mesh.position.clone();assert.equal(manager.update(0).subSteps,0);assert.ok(mesh.position.equals(before));assert.equal(manager.removeFish(f),true);manager.addFish(mesh,null,{radius:.1});mesh.removeFromParent();assert.equal(manager.update(0).fishCount,0);scene.add(mesh);manager.addFish(mesh,null,{radius:.1});let disposed=0;mesh.geometry.addEventListener('dispose',()=>disposed++);manager.dispose();manager.dispose();assert.equal(disposed,0);assert.equal(mesh.parent,scene);assert.equal(manager.fishInstances.length,0);assert.throws(()=>manager.update(0),/disposed/);
});
test('standalone generated template exposes the same manager and bounds are cloned',()=>{
 const scene=new THREE.Scene(),box=bounds(),manager=new TemplateManager(scene,{bounds:box});box.min.x=-500;assert.equal(manager.bounds.min.x,-5);manager.dispose();
});
test('smart deploy + manager share one loop without double-updating Bio-Motion, then detach cleanly',async()=>{
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const {deploySmart3DModel,updateAllDeployedModels}=await import('../templates/smart-deploy.js');const original=GLTFLoader.prototype.load;
 GLTFLoader.prototype.load=function(url,onLoad){queueMicrotask(()=>{const root=new THREE.Group();root.name='Fish';root.add(new THREE.Mesh(new THREE.BoxGeometry(.5,.15,.2),new THREE.MeshStandardMaterial()));onLoad({scene:root,animations:[]});});};
 const {scene,manager}=setup();let handle;
 try{handle=deploySmart3DModel('fixture',{scene,manifest:{recommendedScale:.5},bioPreset:'fish_swim',onLoaded:({model,bioController})=>manager.addFish(model,bioController,{radius:.2,randomizePosition:true})});await handle.ready;for(let i=0;i<60;i++){manager.update(1/60);updateAllDeployedModels(1/60,(i+1)/60);}assert.equal(handle.bioController.timeUniform.value,1);assert.equal(manager.fishInstances.length,1);handle.dispose();assert.equal(manager.update(0).fishCount,0);}
 finally{manager.dispose();handle?.dispose();GLTFLoader.prototype.load=original;}
});

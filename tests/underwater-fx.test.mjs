import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createUnderwaterFX,createBioMotionInjector} from '../dist/index.js';
import {InteractiveBubbleSystem as TemplateBubbles} from '../templates/underwater-fx.js';
const fx=createUnderwaterFX(THREE),bio=createBioMotionInjector(THREE);
function shader(material){const s={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(s,{});return s;}
const bounds=()=>new THREE.Box3(new THREE.Vector3(-4,0,-3),new THREE.Vector3(4,4,3));
test('caustics uses post-deformation world position and linear outgoingLight before tone mapping',()=>{
 const mat=new THREE.MeshStandardMaterial();const c=fx.injectWaterCaustics(mat,{intensity:1.6,waterLevel:3});const s=shader(mat);
 assert.ok(s.vertexShader.indexOf('// WATER_CAUSTICS_WORLD_POSITION')>s.vertexShader.indexOf('#include <project_vertex>'));assert.match(s.vertexShader,/vec4\(transformed,1.0\)/);assert.doesNotMatch(s.vertexShader,/vec4\(position, 1.0\)/);assert.match(s.vertexShader,/USE_INSTANCING/);
 assert.ok(s.fragmentShader.indexOf('outgoingLight+=')<s.fragmentShader.indexOf('#include <opaque_fragment>'));assert.ok(s.fragmentShader.indexOf('outgoingLight+=')<s.fragmentShader.indexOf('#include <tonemapping_fragment>'));assert.match(s.fragmentShader,/sqrt\(second\)-sqrt\(first\)/);
 c.update(4);c.setIntensity(.7);assert.equal(s.uniforms.uCausticTime.value,4);assert.equal(s.uniforms.uCausticIntensity.value,.7);c.value=8;assert.equal(s.uniforms.uCausticTime.value,8);c.dispose();
});
test('compile hooks/cache/userData are composed and restored without disposing caller material',()=>{
 const mat=new THREE.MeshPhysicalMaterial();let calls=0,disposed=0;mat.addEventListener('dispose',()=>disposed++);const previous=function(s){assert.equal(this,mat);calls++;s.uniforms.projectUniform={value:1};};const previousKey=()=> 'custom-v8';const prior={existing:true};mat.onBeforeCompile=previous;mat.customProgramCacheKey=previousKey;mat.userData.causticUniforms=prior;
 const c=fx.injectWaterCaustics(mat);assert.equal(shader(mat).uniforms.projectUniform.value,1);assert.equal(calls,1);assert.match(mat.customProgramCacheKey(),/custom-v8\|water-caustics/);assert.throws(()=>fx.injectWaterCaustics(mat),/already attached/);c.dispose();c.dispose();assert.equal(mat.onBeforeCompile,previous);assert.equal(mat.customProgramCacheKey,previousKey);assert.equal(mat.userData.causticUniforms,prior);assert.equal(disposed,0);assert.equal(c.uniforms.uCausticIntensity.value,0);
});
test('caustics composes with Bio-Motion in either order, with safe cloning and one projection',()=>{
 for(const order of ['bio-first','water-first']){
  const root=new THREE.Group();root.name='Fish';const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,1,1),new THREE.MeshStandardMaterial());root.add(mesh);let c,controller;
  if(order==='water-first'){c=fx.injectWaterCaustics(mesh.material);assert.doesNotThrow(()=>mesh.material.clone());controller=bio.injectBioMotion(root);}
  else{controller=bio.injectBioMotion(root);c=fx.injectWaterCaustics(mesh.material);}
  const s=shader(mesh.material);assert.equal((s.fragmentShader.match(/\/\/ WATER_CAUSTICS_V1/g)||[]).length,1);assert.ok(s.vertexShader.indexOf('transformed=(uBioFromRoot')<s.vertexShader.indexOf('// WATER_CAUSTICS_WORLD_POSITION'));assert.ok(s.uniforms.uBioTime);assert.ok(s.uniforms.uCausticTime);c.dispose();controller.dispose();
 }
});
test('later hook composition is not clobbered on disposal; reinjection is idempotent GLSL',()=>{
 const mat=new THREE.MeshStandardMaterial();const first=fx.injectWaterCaustics(mat);const originalWrapper=mat.onBeforeCompile;mat.onBeforeCompile=function(s,r){originalWrapper.call(this,s,r);s.uniforms.later={value:1};};const later=mat.onBeforeCompile;first.dispose();assert.equal(mat.onBeforeCompile,later);
 const second=fx.injectWaterCaustics(mat,{intensity:2});const s=shader(mat);assert.equal((s.fragmentShader.match(/\/\/ WATER_CAUSTICS_V1/g)||[]).length,1);assert.equal(s.uniforms.uCausticIntensity.value,2);assert.equal(s.uniforms.later.value,1);second.dispose();
});
test('caustic invalid/unsupported material and controls fail explicitly',()=>{
 for(const value of [new THREE.ShaderMaterial(),new THREE.MeshDepthMaterial(),null])assert.throws(()=>fx.injectWaterCaustics(value));
 for(const options of [{intensity:-1},{speed:NaN},{scale:0},{waterLevel:Infinity},{depthFalloff:-2}])assert.throws(()=>fx.injectWaterCaustics(new THREE.MeshStandardMaterial(),options));const c=fx.injectWaterCaustics(new THREE.MeshStandardMaterial());assert.throws(()=>c.update(NaN));assert.throws(()=>c.setIntensity(-1));c.dispose();
});
test('seeded bubbles have identical fixed-step trajectories at 30 and 60 FPS including respawns',()=>{
 function run(frames,delta){const b=new fx.InteractiveBubbleSystem(new THREE.Scene(),30,bounds(),{seed:15});for(let i=0;i<frames;i++)b.update(delta,(i+1)*delta,[new THREE.Vector3(0,1,0)]);const p=Array.from(b.positions),respawns=b.stats.respawns;b.dispose();return {p,respawns};}
 const a=run(240,1/60),b=run(120,1/30);assert.deepEqual(a,b);assert.ok(a.respawns>0);
});
test('bubble buffers, circular sprites, delta-zero no-op and bounded positions/large pause handling',()=>{
 const system=new fx.InteractiveBubbleSystem(new THREE.Scene(),20,bounds(),{seed:5});assert.equal(system.geometry.attributes.position.usage,THREE.DynamicDrawUsage);assert.equal(system.material.depthWrite,false);assert.match(system.material.fragmentShader,/gl_PointCoord/);assert.match(system.material.fragmentShader,/discard/);assert.match(system.material.vertexShader,/projectionMatrix/);const before=Array.from(system.positions),version=system.geometry.attributes.position.version;system.update(0,0);assert.deepEqual(Array.from(system.positions),before);assert.equal(system.geometry.attributes.position.version,version);
 for(let i=0;i<60;i++){system.update(.5,(i+1)*.5);for(let j=0;j<20;j++)assert.ok(bounds().expandByScalar(1e-6).containsPoint(new THREE.Vector3().fromArray(system.positions,j*3)));}assert.ok(system.stats.droppedTime>0);system.dispose();
});
test('fish interaction accepts world boids records, caps push and resolves coincident positions without NaN',()=>{
 const b=new fx.InteractiveBubbleSystem(new THREE.Scene(),1,bounds(),{seed:1,minRiseSpeed:0,maxRiseSpeed:0,pushStrength:.6});b.positions.set([0,1,0]);b.wobbleAmps[0]=0;const record={position:new THREE.Vector3(0,1,0)};b.update(1/60,1/60,[record]);assert.ok(b.positions.every(Number.isFinite));assert.ok(Math.hypot(b.positions[0],b.positions[2])>0);assert.ok(Math.hypot(b.positions[0],b.positions[2])<=.6/60+1e-6);assert.ok(b.stats.neighborChecks>0);b.dispose();
});
test('spatial hash skips distant fish instead of doing all particle-fish pairs',()=>{
 const b=new fx.InteractiveBubbleSystem(new THREE.Scene(),100,bounds());const distant=Array.from({length:100},(_,i)=>new THREE.Vector3(100+i,1,100));b.update(1/60,1/60,distant);assert.equal(b.stats.neighborChecks,0);b.dispose();
});
test('world-space bubble geometry remains world-space under moving transformed scene parents',()=>{
 const scene=new THREE.Scene(),parent=new THREE.Group();parent.position.set(5,2,-3);parent.rotation.y=.4;parent.scale.set(2,1,3);scene.add(parent);const b=new fx.InteractiveBubbleSystem(parent,1,bounds());b.update(0,0);for(let i=0;i<16;i++)assert.ok(Math.abs(b.points.matrixWorld.elements[i]-new THREE.Matrix4().elements[i])<1e-9);parent.position.x+=2;b.points.onBeforeRender({getDrawingBufferSize(v){v.set(800,600);}});assert.equal(b.material.uniforms.uBubbleViewportHeight.value,600);for(let i=0;i<16;i++)assert.ok(Math.abs(b.points.matrixWorld.elements[i]-new THREE.Matrix4().elements[i])<1e-9);b.dispose();
});
test('bubble validation, explicit reset and idempotent disposal release only owned render resources',()=>{
 const scene=new THREE.Scene();for(const count of [-1,1.5,100001])assert.throws(()=>new fx.InteractiveBubbleSystem(scene,count));for(const options of [{seed:NaN},{fixedDelta:0},{interactionRadius:0},{pushStrength:-1},{maxSubSteps:1.2},{size:0},{minRiseSpeed:2,maxRiseSpeed:1}])assert.throws(()=>new fx.InteractiveBubbleSystem(scene,1,bounds(),options));assert.equal(scene.children.length,0);
 const b=new fx.InteractiveBubbleSystem(scene,1,bounds());let disposed=0;b.geometry.addEventListener('dispose',()=>disposed++);b.material.addEventListener('dispose',()=>disposed++);assert.throws(()=>b.resetParticle(-1));b.resetParticle(0);assert.equal(b.positions[1],0);assert.throws(()=>b.update(-1,0));assert.throws(()=>b.update(0,0,[new THREE.Vector3(NaN,0,0)]));b.update(0,2);assert.throws(()=>b.update(.1,1));b.dispose();b.dispose();assert.equal(disposed,2);assert.equal(scene.children.length,0);assert.throws(()=>b.update(0,3),/disposed/);
});
test('generated template supports zero particles without a browser context',()=>{
 const b=new TemplateBubbles(new THREE.Scene(),0,bounds());assert.equal(b.positions.length,0);b.update(1/60,1/60);b.dispose();
});
test('full aquarium helper composes Boids, Bio-Motion, caustics and bubbles with one updater',async()=>{
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const {createUnderwaterAquarium}=await import('../examples/underwater-aquarium.js');const previous=GLTFLoader.prototype.load;
 GLTFLoader.prototype.load=function(url,onLoad){queueMicrotask(()=>{const root=new THREE.Group();root.name=url==='fish'?'Fish':'Rock';root.add(new THREE.Mesh(new THREE.BoxGeometry(.6,.2,.2),new THREE.MeshStandardMaterial()));onLoad({scene:root,animations:[]});});};
 const scene=new THREE.Scene(),floor=new THREE.MeshStandardMaterial();const original=floor.onBeforeCompile;let aquarium;
 try{aquarium=createUnderwaterAquarium({scene,bounds:bounds(),floorMaterial:floor,bubbleCount:5,fishCount:2,fishUrl:'fish',rockUrl:'rock',fishManifest:{recommendedScale:.5},rockManifest:{recommendedScale:1}});await aquarium.ready;aquarium.update(1/60,1/60);assert.equal(aquarium.school.aquarium.stats.fishCount,2);assert.ok(aquarium.caustics.length>=4);for(const c of aquarium.caustics)assert.equal(c.value,1/60);const fish=aquarium.school.handles[1];assert.equal(fish.bioController.timeUniform.value,1/60);assert.ok(shader(fish.model.children[0].material).uniforms.uCausticTime);aquarium.dispose();assert.equal(scene.children.length,0);assert.equal(floor.onBeforeCompile,original);}
 finally{aquarium?.dispose();GLTFLoader.prototype.load=previous;}
});
test('aquarium helper disposes pending loads and rejects invalid floor setup without orphan particles',async()=>{
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const {createUnderwaterAquarium}=await import('../examples/underwater-aquarium.js');const previous=GLTFLoader.prototype.load;
 GLTFLoader.prototype.load=function(url,onLoad){queueMicrotask(()=>{const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(.2,.2,.2),new THREE.MeshStandardMaterial()));onLoad({scene:root,animations:[]});});};
 const scene=new THREE.Scene();let aquarium;
 try{assert.throws(()=>createUnderwaterAquarium({scene,bounds:bounds(),floorMaterial:null}));assert.equal(scene.children.length,0);aquarium=createUnderwaterAquarium({scene,bounds:bounds(),floorMaterial:new THREE.MeshStandardMaterial(),bubbleCount:5,fishCount:1,rockUrl:'rock',fishUrl:'fish',rockManifest:{recommendedScale:1},fishManifest:{recommendedScale:1}});aquarium.dispose();await aquarium.ready;assert.equal(scene.children.length,0);}
 finally{aquarium?.dispose();GLTFLoader.prototype.load=previous;}
});
test('caustic cache composition preserves dynamic custom keys and distinguishes previous default hooks',()=>{
 const a=new THREE.MeshStandardMaterial(),b=new THREE.MeshStandardMaterial();a.onBeforeCompile=function(s){s.uniforms.a={value:1};};b.onBeforeCompile=function(s){s.uniforms.b={value:2};};const ca=fx.injectWaterCaustics(a),cb=fx.injectWaterCaustics(b);assert.notEqual(a.customProgramCacheKey(),b.customProgramCacheKey());ca.dispose();cb.dispose();
 let variant='a';a.customProgramCacheKey=()=>variant;const c=fx.injectWaterCaustics(a);assert.equal(a.customProgramCacheKey(),'a|water-caustics-v1');variant='b';assert.equal(a.customProgramCacheKey(),'b|water-caustics-v1');c.dispose();
});
test('all advertised built-in surface shader families expose compatible linear-light anchors',()=>{
 for(const [Material,library] of [[THREE.MeshBasicMaterial,'basic'],[THREE.MeshLambertMaterial,'lambert'],[THREE.MeshPhongMaterial,'phong'],[THREE.MeshStandardMaterial,'standard'],[THREE.MeshPhysicalMaterial,'physical']]){
  const m=new Material(),controller=fx.injectWaterCaustics(m);const s={uniforms:{},vertexShader:THREE.ShaderLib[library].vertexShader,fragmentShader:THREE.ShaderLib[library].fragmentShader};assert.doesNotThrow(()=>m.onBeforeCompile(s,{}));assert.match(s.fragmentShader,/outgoingLight\+=/);controller.dispose();
 }
});

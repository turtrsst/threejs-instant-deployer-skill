import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createBoidsAquariumManager} from '../mcp-server/codeDeployer/boidsManager.ts';
import {createUnderwaterFX} from '../mcp-server/codeDeployer/underwaterFx.ts';
import {createBioMotionInjector} from '../mcp-server/codeDeployer/bioMotion.ts';
const fx=createUnderwaterFX(THREE),Manager=createBoidsAquariumManager(THREE),bio=createBioMotionInjector(THREE),stage=document.querySelector('#stage');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;stage.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.1,80);camera.position.set(10,8,11);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,1.5,0);controls.enableDamping=true;
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;pmrem.dispose();room.dispose();
scene.add(new THREE.HemisphereLight(0xd4ffef,0x3d5544,2));const light=new THREE.DirectionalLight(0xffe9ba,3);light.position.set(4,8,4);light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-6;light.shadow.camera.right=6;light.shadow.camera.top=6;light.shadow.camera.bottom=-6;scene.add(light);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:0x5d6952,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const worldBounds=new THREE.Box3(new THREE.Vector3(-4,.25,-3),new THREE.Vector3(4,3.5,3));const tank=new THREE.Box3Helper(worldBounds,0x557f69);scene.add(tank);
const staticCaustics=[fx.injectWaterCaustics(floor.material,{intensity:1.4,waterLevel:3.5})];
const bubbles=new fx.InteractiveBubbleSystem(scene,400,new THREE.Box3(new THREE.Vector3(-4,0,-3),new THREE.Vector3(4,3.5,3)),{seed:42});
const obstacles=[];for(const [x,y,z,s] of [[0,.65,0,.85],[-2,.4,1.1,.55],[2,.5,-1,.7]]){const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(s,1),new THREE.MeshStandardMaterial({color:0x556553,roughness:.85}));mesh.position.set(x,y,z);mesh.scale.set(1,1.1,.8);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);obstacles.push(mesh);staticCaustics.push(fx.injectWaterCaustics(mesh.material,{intensity:.65,waterLevel:3.5}));}
let manager,school=[],helpers=[],paused=false,elapsed=0,last=performance.now();
const underwater=document.querySelector('#underwater');
const count=document.querySelector('#count'),speed=document.querySelector('#speed'),proxy=document.querySelector('#proxies');
function reset(){
 manager?.dispose();for(const item of school){for(const c of item.caustics)c.dispose();item.controller.dispose();scene.remove(item.root);item.root.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});}for(const h of helpers){scene.remove(h);h.geometry.dispose();h.material.dispose();}school=[];helpers=[];
 manager=new Manager(scene,{bounds:worldBounds,seed:42,maxSpeed:Number(speed.value),minSpeed:.25,separationDist:.95,neighborRadius:1.8});
 for(const obstacle of obstacles){const record=manager.addObstacle(obstacle,{padding:.05});const helper=new THREE.Box3Helper(record.box,0xd8ad69);helper.visible=proxy.checked;scene.add(helper);helpers.push(helper);}
 for(let i=0;i<Number(count.value);i++){
  const root=new THREE.Group();root.name='Fish';const material=new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.13+(i%5)*.025,.25,.52),metalness:.3,roughness:.3});
  const body=new THREE.Mesh(new THREE.SphereGeometry(1,20,12).scale(1,.28,.22),material);body.position.y=.3;const tail=new THREE.Mesh(new THREE.ConeGeometry(.35,.55,12).rotateZ(Math.PI/2).scale(1,1,.25),material);tail.position.set(1.1,.3,0);root.add(body,tail);root.scale.setScalar(.3);root.traverse(n=>{if(n.isMesh){n.castShadow=true;n.receiveShadow=true;}});scene.add(root);
  const controller=bio.injectBioMotion(root,{preset:'fish_swim',phaseOffset:i*1.618});manager.addFish(root,controller,{randomizePosition:true,deformationMargin:.14});const caustics=[];root.traverse(n=>{if(n.isMesh)caustics.push(fx.injectWaterCaustics(n.material,{intensity:underwater.checked ? .65 : 0,waterLevel:3.5}));});school.push({root,controller,caustics});
 }
 document.querySelector('#count-label').textContent=count.value;document.querySelector('#speed-label').textContent=speed.value;
}
underwater.onchange=()=>{bubbles.points.visible=underwater.checked;staticCaustics.forEach((c,i)=>c.setIntensity(underwater.checked?(i===0?1.4:.65):0));for(const fish of school)for(const c of fish.caustics)c.setIntensity(underwater.checked ? .65 : 0);};
count.onchange=reset;speed.onchange=reset;proxy.onchange=()=>{for(const helper of helpers)helper.visible=proxy.checked;};document.querySelector('#reset').onclick=reset;document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'Resume simulation':'Pause simulation';};
new ResizeObserver(()=>{renderer.setSize(stage.clientWidth,stage.clientHeight);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();}).observe(stage);reset();
let frame=0;renderer.setAnimationLoop(()=>{const now=performance.now(),delta=Math.min((now-last)/1000,.2);last=now;let stats=manager.stats;if(!paused){elapsed+=delta;stats=manager.update(delta);for(const c of staticCaustics)c.update(elapsed);for(const fish of school){fish.controller.update(elapsed);for(const c of fish.caustics)c.update(elapsed);}if(underwater.checked)bubbles.update(delta,elapsed,manager.fishInstances);}controls.update();renderer.render(scene,camera);if(frame++%15===0)document.querySelector('#stats').textContent=`fish: ${stats.fishCount}\nneighbor checks/frame: ${stats.neighborChecks}\nproxy checks/frame: ${stats.obstacleChecks}\nfixed steps/frame: ${stats.subSteps}\nblocked fish: ${stats.blockedFish||0}\nbubble neighbor checks: ${bubbles.stats.neighborChecks}\ndropped time: ${stats.droppedTime.toFixed(3)}s`;});

import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createBioMotionInjector} from '../mcp-server/codeDeployer/bioMotion.ts';
const api=createBioMotionInjector(THREE),stage=document.querySelector('#stage');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;stage.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.1,50);camera.position.set(6,4,7);const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,1.2,0);orbit.enableDamping=true;
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();const env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xd9fff2,0x314a3b,2));const sun=new THREE.DirectionalLight(0xffe2b1,3);sun.position.set(3,6,3);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
const point=new THREE.PointLight(0x80dfdc,25,12);point.position.set(-3,3,-1);point.castShadow=true;point.shadow.mapSize.set(512,512);scene.add(point);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0x53624a,roughness:.85}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const grid=new THREE.GridHelper(12,24,0x778674,0x65735b);grid.position.y=.002;scene.add(grid);
new ResizeObserver(()=>{renderer.setSize(stage.clientWidth,stage.clientHeight);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();}).observe(stage);
let root,controller,paused=false,elapsed=0,last=performance.now();
const preset=document.querySelector('#preset'),axis=document.querySelector('#axis'),direction=document.querySelector('#direction'),speed=document.querySelector('#speed');
function build(){
 if(root){controller?.dispose();scene.remove(root);root.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});}
 root=new THREE.Group();const material=new THREE.MeshStandardMaterial({color:preset.value==='fish_swim'?0xb9c5a4:preset.value==='aquatic_plant'?0x669c53:0xb7848b,metalness:.25,roughness:.3});
 const add=(geo,x,y,z)=>{const mesh=new THREE.Mesh(geo,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
 if(preset.value==='fish_swim'){
  add(new THREE.SphereGeometry(1,48,24).scale(1.6,.55,.42),0,0,0);
  add(new THREE.ConeGeometry(.6,.9,24).rotateZ(Math.PI/2).scale(1,1,.3),1.8,0,0);
  const fin=new THREE.ConeGeometry(.25,.8,12).rotateZ(-.5).scale(1,1,.15);add(fin,0,.55,0);
  root.position.y=1.6;
 }else if(preset.value==='aquatic_plant'){
  for(let i=0;i<7;i++){const angle=i*Math.PI*2/7;const height=1.6+(i%3)*.3;add(new THREE.SphereGeometry(1,16,24).scale(.11,height/2,.06),Math.sin(angle)*.25,height/2,Math.cos(angle)*.25);}
 }else{
  for(let i=0;i<9;i++){const angle=i*Math.PI*2/9;const h=1.4+(i%3)*.2;add(new THREE.CylinderGeometry(.06,.12,h,10,24),Math.sin(angle)*.5,h/2,Math.cos(angle)*.5);}
 }
 scene.add(root);elapsed=0;
 controller=api.injectBioMotion(root,{preset:preset.value,spineAxis:axis.value==='auto'?undefined:Number(axis.value),spineDirection:Number(direction.value),phaseOffset:0});
 speed.value=api.BIO_MOTION_PRESETS[preset.value].speed;document.querySelector('#speed-value').textContent=speed.value;
 document.querySelector('#details').textContent=`axis: ${controller.uniforms.uSpineAxis.value===0?'X':'Z'}\nnormal: inverse-transpose Jacobian\nshadows: depth + distance\nmeshes: ${root.children.length}\nroot: model-local bounds`;
}
for(const control of [preset,axis,direction])control.onchange=build;
speed.oninput=()=>{controller.setSpeed(Number(speed.value));document.querySelector('#speed-value').textContent=speed.value;};
document.querySelector('#pause').onclick=()=>{paused=!paused;document.querySelector('#pause').textContent=paused?'Resume motion':'Pause motion';};
build();
renderer.setAnimationLoop(()=>{const now=performance.now(),delta=Math.min((now-last)/1000,.1);last=now;if(!paused)elapsed+=delta;controller.update(elapsed);orbit.update();renderer.render(scene,camera);});

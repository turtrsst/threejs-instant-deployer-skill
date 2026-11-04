import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createAssetDeployer} from '../mcp-server/codeDeployer/runtime.ts';
const stage=document.querySelector('#stage');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;stage.append(renderer.domElement);
const scene=new THREE.Scene();const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.set(6,4,7);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.8,0);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xe1f4d5,0x4b4435,2));const sun=new THREE.DirectionalLight(0xffe6c1,4);sun.position.set(3,6,4);sun.castShadow=true;scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0x202a21,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(16,32,0x5c7350,0x33432f);grid.position.y=.002;scene.add(grid);
const primitive=new THREE.Mesh(new THREE.BoxGeometry(1,2,3),new THREE.MeshStandardMaterial({color:0x87a574,wireframe:true}));primitive.position.y=1;scene.add(primitive);
const deployer=createAssetDeployer(THREE,GLTFLoader,MeshoptDecoder,RoomEnvironment);
new ResizeObserver(()=>{renderer.setSize(stage.clientWidth,stage.clientHeight);camera.aspect=stage.clientWidth/stage.clientHeight;camera.updateProjectionMatrix();}).observe(stage);
renderer.setAnimationLoop(()=>{deployer.update();controls.update();renderer.render(scene,camera);});
try{const m=await(await fetch('/manifest.json')).json();const h=deployer.deploy(primitive,m,m.dataUri,renderer,scene);await h.ready;document.querySelector('#scale').textContent=m.recommendedScale.toFixed(4);document.querySelector('#bytes').textContent=`${m.fileSizeKB.toFixed(1)} KB / Meshopt`;document.querySelector('#status').textContent='✓ Bounds measured · origin grounded';document.querySelector('#xray').textContent=JSON.stringify({meshes:m.meshes.map(x=>x.name),animations:m.animations.map(x=>x.name)},null,2);const button=document.querySelector('#toggle');button.disabled=false;button.textContent='Show primitive fallback';button.onclick=()=>{h.model.visible=!h.model.visible;primitive.visible=!h.model.visible;button.textContent=h.model.visible?'Show primitive fallback':'Show normalized GLB';};}catch(e){document.querySelector('#status').textContent=e.message;}

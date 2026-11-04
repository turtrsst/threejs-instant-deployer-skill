// Bundler entry point. Requires processed static BarramundiFish GLB + measured manifest
// in public/models/. Copy this file beside cinematic-aquarium.js and instanced-aquarium.js.
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createCinematicAquarium} from './cinematic-aquarium.js';
import {UnderwaterAudioSynthesizer} from '../templates/underwater-audio-synth.js';
import {createAquariumDirectorGUI} from '../templates/aquarium-director-gui.js';

const container=document.createElement('div');container.style.cssText='position:fixed;inset:0;overflow:hidden';document.body.append(container);
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(container.clientWidth,container.clientHeight);renderer.shadowMap.enabled=true;container.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x041421);scene.fog=new THREE.FogExp2(0x041421,.035);
const camera=new THREE.PerspectiveCamera(45,container.clientWidth/container.clientHeight,.1,100);camera.position.set(10,7,13);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,2.5,0);controls.update();
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
const hemi=new THREE.HemisphereLight(0x9de1ef,0x123126,1.5);scene.add(hemi);const sun=new THREE.DirectionalLight(0xd4fbff,2.8);sun.position.set(2,8,3);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;scene.add(sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(40,40),new THREE.MeshStandardMaterial({color:0x526252,roughness:.8}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
// Explicitly synthetic obstacle, not a downloaded model with guessed scale.
const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.8,1),new THREE.MeshStandardMaterial({color:0x667066,roughness:.85}));rock.position.set(0,.8,0);rock.castShadow=rock.receiveShadow=true;scene.add(rock);
const bounds=new THREE.Box3(new THREE.Vector3(-8,.5,-6),new THREE.Vector3(8,5.5,6));
const audioSynth=new UnderwaterAudioSynthesizer({masterVolume:.25,zenChimesEnabled:false});
let system,director,disposed=false;
function silenceAudio(){if(audioSynth.disposed)return;audioSynth.setMuted(true);if(audioSynth.ctx?.state==='running')void audioSynth.ctx.suspend().catch(console.warn);director?.syncDisplay();}
function audioVisibility(){if(document.hidden)silenceAudio();else director?.syncDisplay();}
document.addEventListener('visibilitychange',audioVisibility);
function dispose(){if(disposed)return;disposed=true;renderer.setAnimationLoop(null);document.removeEventListener('visibilitychange',audioVisibility);director?.dispose();void audioSynth.dispose().catch(console.warn);system?.dispose();controls.dispose();environment.dispose();sun.shadow.dispose();for(const mesh of [floor,rock]){mesh.geometry.dispose();mesh.material.dispose();}renderer.dispose();container.remove();}
window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();else silenceAudio();});
async function start(){
 try{
  const response=await fetch('/models/BarramundiFish.manifest.json');if(!response.ok)throw new Error(`Manifest HTTP ${response.status}`);const manifest=await response.json();if(disposed)return;
  const loaded=await createCinematicAquarium({renderer,scene,camera,controls,url:'/models/BarramundiFish.glb',manifest,bounds,obstacles:[rock],count:1000,floorMaterial:floor.material,
   schoolOptions:{castShadow:false,activeCount:500,maxAmplitude:.45},
   surfaceOptions:{sunLight:sun,segments:96},
   cameraOptions:{floorY:0,keyboardTarget:window},
   dayNightOptions:{sunLight:sun,hemiLight:hemi,orbitRadius:9},
   feedingOptions:{audioSynth,bounds:new THREE.Box3(new THREE.Vector3(-8,0,-6),new THREE.Vector3(8,5.5,6)),floorY:0},
   postOptions:{container,maxPixelRatio:1.5,focusObjects:[rock,floor],aperture:.0014,maxBlur:.006,bloomStrength:.42,bloomThreshold:.72,godRayIntensity:.18}
  });
  if(disposed){loaded.dispose();return;}system=loaded;
  director=createAquariumDirectorGUI({renderer,scene,sunLight:sun,postFX:system.post,fishAquarium:system.school.manager,fishFeeder:system.feeder,dayNightCycle:system.dayNightCycle,cameraDirector:system.cameraDirector,waterSurface:system.waterSurface,audioSynth,causticControllers:system.caustics,bubbles:system.bubbles});
  const clock=new THREE.Clock();let elapsed=0;
  renderer.setAnimationLoop(()=>{const delta=clock.getDelta();elapsed+=delta;system.render(delta,elapsed);director.syncDisplay();});
 }catch(error){console.error('Cinematic aquarium setup failed:',error);dispose();}
}
start();

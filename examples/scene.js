import * as THREE from 'three';
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(4, 3, 6);
camera.lookAt(0, 1, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);
const rock = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), new THREE.MeshStandardMaterial({ color: 0x839275 }));
rock.position.y = 1;
scene.add(rock);
scene.add(new THREE.HemisphereLight(0xffffff, 0x334433, 2));
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

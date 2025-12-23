import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const TICKS_PER_SECOND = 20;
const FRAME_TIME_TICKS = 25;
const FRAME_TIME_MS = (FRAME_TIME_TICKS / TICKS_PER_SECOND) * 1000;
const FRAME_HEIGHT = 16;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(2.4, 2.0, 2.4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(5, 8, 6);
scene.add(dirLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const geometry = new THREE.BoxGeometry(1, 1, 1);
const loader = new THREE.TextureLoader();

const shellTexture = loader.load("./assets/controller.png");
shellTexture.magFilter = THREE.NearestFilter;
shellTexture.minFilter = THREE.NearestFilter;

const lightsTexture = loader.load("./assets/controller_lights.png");
lightsTexture.magFilter = THREE.NearestFilter;
lightsTexture.minFilter = THREE.NearestFilter;
lightsTexture.wrapS = THREE.ClampToEdgeWrapping;
lightsTexture.wrapT = THREE.RepeatWrapping;

const shellMaterial = new THREE.MeshStandardMaterial({ map: shellTexture, side: THREE.DoubleSide });
const lightsMaterial = new THREE.MeshBasicMaterial({ map: lightsTexture, transparent: true, side: THREE.DoubleSide });

const shellMesh = new THREE.Mesh(geometry, shellMaterial);
scene.add(shellMesh);

const lightsMesh = new THREE.Mesh(geometry, lightsMaterial);
scene.add(lightsMesh);

const startTime = performance.now();

function updateLights() {
  if (!lightsTexture.image) return;
  const frameCount = lightsTexture.image.height / FRAME_HEIGHT;
  if (lightsTexture.repeat.y === 1) {
    lightsTexture.repeat.set(1, 1 / frameCount);
  }
  const elapsed = performance.now() - startTime;
  const exactFrame = (elapsed / FRAME_TIME_MS) % frameCount;
  lightsTexture.offset.y = exactFrame / frameCount;
}

function render() {
  updateLights();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

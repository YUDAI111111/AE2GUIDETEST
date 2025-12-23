import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/*
  AE2 ME Controller Web Demo (ONLINE - simplified inside)
  - shell (powered)
  - inside (emissive core)
  - lights (mcmeta interpolate)
  - DoubleSide materials (no face disappearing)
*/

// =========================
// mcmeta constants
// =========================
const TICKS_PER_SECOND = 20;
const FRAME_TIME_TICKS = 25;
const FRAME_TIME_MS = (FRAME_TIME_TICKS / TICKS_PER_SECOND) * 1000;
const FRAME_HEIGHT = 16;

// =========================
// State
// =========================
const isOnline = true;

// =========================
// Scene / Camera / Renderer
// =========================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(2.6, 2.1, 2.6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// =========================
// Lights
// =========================
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// =========================
// Controls
// =========================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// =========================
// Geometry
// =========================
const shellGeometry = new THREE.BoxGeometry(1, 1, 1);
const insideGeometry = new THREE.BoxGeometry(0.78, 0.78, 0.78);

// =========================
// Textures
// =========================
const loader = new THREE.TextureLoader();

const shellTexture = loader.load("./assets/controller_powered.png", (t) => {
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
});

const lightsTexture = loader.load("./assets/controller_lights.png", (t) => {
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
});

// =========================
// Materials
// =========================
const shellMaterial = new THREE.MeshStandardMaterial({
  map: shellTexture,
  side: THREE.DoubleSide
});

const insideMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0xcfffff),
  emissive: new THREE.Color(0x9ffcff),
  emissiveIntensity: 1.2,
  transparent: true,
  opacity: 0.95,
  side: THREE.DoubleSide
});

const lightsMaterial = new THREE.MeshStandardMaterial({
  map: lightsTexture,
  transparent: true,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 1.0,
  side: THREE.DoubleSide
});

// =========================
// Meshes
// =========================
const shellMesh = new THREE.Mesh(shellGeometry, shellMaterial);
scene.add(shellMesh);

const insideMesh = new THREE.Mesh(insideGeometry, insideMaterial);
insideMesh.visible = isOnline;
scene.add(insideMesh);

const lightsMesh = new THREE.Mesh(shellGeometry, lightsMaterial);
lightsMesh.visible = isOnline;
scene.add(lightsMesh);

// =========================
// mcmeta animation (interpolate)
// =========================
const startTime = performance.now();

function updateLightsAnimation() {
  if (!isOnline) return;
  if (!lightsTexture.image) return;

  const frameCount = lightsTexture.image.height / FRAME_HEIGHT;

  if (lightsTexture.repeat.y === 1) {
    lightsTexture.repeat.set(1, 1 / frameCount);
  }

  const now = performance.now();
  const elapsed = now - startTime;

  const exactFrame = (elapsed / FRAME_TIME_MS) % frameCount;
  lightsTexture.offset.y = exactFrame / frameCount;
}

// =========================
// Render loop
// =========================
function render() {
  updateLightsAnimation();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

render();

// =========================
// Resize
// =========================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/*
  AE2 ME Controller Web Demo (STABLE)
  - DoubleSide materials (fix backface culling)
  - controller_powered + lights + mcmeta interpolate
  - GitHub Pages compatible
*/

// =========================
// Constants (mcmeta)
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
camera.position.set(2.5, 2.0, 2.5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// =========================
// Lights
// =========================
scene.add(new THREE.AmbientLight(0xffffff, 0.6));

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// =========================
// Controls
// =========================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// =========================
// Geometry (temporary cube)
// =========================
const geometry = new THREE.BoxGeometry(1, 1, 1);

// =========================
// Textures
// =========================
const loader = new THREE.TextureLoader();

const baseTexture = loader.load("./assets/controller_powered.png", (t) => {
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
// Materials (DoubleSide FIX)
// =========================
const baseMaterial = new THREE.MeshStandardMaterial({
  map: baseTexture,
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
const baseMesh = new THREE.Mesh(geometry, baseMaterial);
scene.add(baseMesh);

const lightsMesh = new THREE.Mesh(geometry, lightsMaterial);
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

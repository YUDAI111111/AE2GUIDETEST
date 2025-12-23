import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/*
  AE2 ME Controller - FIXED
  - lights は MeshBasicMaterial（必ず光る）
  - mcmeta interpolate: true を滑らか再現
  - 余計な inside / PBR / emissive を全撤去
*/

// =========================
// mcmeta constants
// =========================
const TICKS_PER_SECOND = 20;
const FRAME_TIME_TICKS = 25; // controller_lights.png.mcmeta
const FRAME_TIME_MS = (FRAME_TIME_TICKS / TICKS_PER_SECOND) * 1000;
const FRAME_HEIGHT = 16;

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
// Controls
// =========================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// =========================
// Geometry
// =========================
const geometry = new THREE.BoxGeometry(1, 1, 1);

// =========================
// Textures
// =========================
const loader = new THREE.TextureLoader();

const shellTexture = loader.load("./assets/controller.png", (t) => {
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

// 外殻（普通の描画）
const shellMaterial = new THREE.MeshStandardMaterial({
  map: shellTexture,
  side: THREE.DoubleSide
});

// ライト（自己発光・必ず見える）
const lightsMaterial = new THREE.MeshBasicMaterial({
  map: lightsTexture,
  transparent: true,
  side: THREE.DoubleSide
});

// =========================
// Meshes
// =========================
const shellMesh = new THREE.Mesh(geometry, shellMaterial);
scene.add(shellMesh);

const lightsMesh = new THREE.Mesh(geometry, lightsMaterial);
scene.add(lightsMesh);

// =========================
// mcmeta animation (interpolate: true)
// =========================
const startTime = performance.now();

function updateLightsAnimation() {
  if (!lightsTexture.image) return;

  const frameCount = lightsTexture.image.height / FRAME_HEIGHT;

  // repeat 設定は一度だけ
  if (lightsTexture.repeat.y === 1) {
    lightsTexture.repeat.set(1, 1 / frameCount);
  }

  const now = performance.now();
  const elapsed = now - startTime;

  // 連続フレーム（滑らか）
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

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/*
  AE2 ME Controller - Online (powered) minimal web demo
  - Base: controller_powered.png
  - Overlay: controller_lights.png (+ mcmeta interpolate: true, frametime: 25)
  - Goal: match the "powered" look (not offline) + animated lights
*/

// =========================
// Constants (from mcmeta)
// =========================
const TICKS_PER_SECOND = 20;
const FRAME_TIME_TICKS = 25; // controller_lights.png.mcmeta
const FRAME_TIME_MS = (FRAME_TIME_TICKS / TICKS_PER_SECOND) * 1000;
const FRAME_HEIGHT = 16;

// =========================
// State (fixed ONLINE)
// =========================
const isOnline = true;

// =========================
// HUD
// =========================
const hud = document.getElementById("hud");
function setHudOK(msg) {
  hud.innerHTML = `<span class="ok">OK</span> ${msg}`;
}
function setHudErr(msg) {
  hud.innerHTML = `<span class="err">ERROR</span> ${msg}`;
}

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

// Lights (simple)
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7);
scene.add(dirLight);

// Controls
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

const baseTexture = loader.load(
  "./assets/controller_powered.png",
  (tex) => {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
  },
  undefined,
  () => setHudErr("Failed to load ./assets/controller_powered.png")
);

const lightsTexture = loader.load(
  "./assets/controller_lights.png",
  (tex) => {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  },
  undefined,
  () => setHudErr("Failed to load ./assets/controller_lights.png")
);

// Base mesh
const baseMaterial = new THREE.MeshStandardMaterial({ map: baseTexture });
const baseMesh = new THREE.Mesh(geometry, baseMaterial);
scene.add(baseMesh);

// Lights overlay mesh (ONLINE only)
const lightsMaterial = new THREE.MeshStandardMaterial({
  map: lightsTexture,
  transparent: true,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 1.0
});
const lightsMesh = new THREE.Mesh(geometry, lightsMaterial);
lightsMesh.visible = isOnline;
scene.add(lightsMesh);

// =========================
// mcmeta interpolate animation
// =========================
const startTime = performance.now();

function updateLightsAnimation() {
  if (!isOnline) return;
  if (!lightsTexture.image) return;

  const frameCount = lightsTexture.image.height / FRAME_HEIGHT;

  // Set repeat once
  if (lightsTexture.repeat.y === 1) {
    lightsTexture.repeat.set(1, 1 / frameCount);
  }

  const now = performance.now();
  const elapsed = now - startTime;

  // continuous frame index (interpolate: true)
  const exactFrame = (elapsed / FRAME_TIME_MS) % frameCount;

  // Move UV continuously across stacked frames
  lightsTexture.offset.y = exactFrame / frameCount;
}

// Set HUD once we can compute frameCount
function trySetHud() {
  if (!lightsTexture.image) return;
  const frameCount = lightsTexture.image.height / FRAME_HEIGHT;
  setHudOK(
    `online=true | base=controller_powered.png | lights frames=${frameCount}, frametime=${FRAME_TIME_TICKS}tick (${(FRAME_TIME_MS/1000).toFixed(2)}s), interpolate=true`
  );
}
lightsTexture.onUpdate = trySetHud;

// Fallback: some browsers do not fire onUpdate reliably for initial load
setTimeout(trySetHud, 300);

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

// Resize
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

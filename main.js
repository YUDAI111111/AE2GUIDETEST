import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ===== JAR true timing =====
const TICKS_PER_SECOND = 20;
const FRAME_TIME_TICKS = 25;             // controller_lights.png.mcmeta (AE2)
const FRAME_TIME_MS = (FRAME_TIME_TICKS / TICKS_PER_SECOND) * 1000;
const FRAME_W = 16;
const FRAME_H = 16;

// ===== Scene =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(2.4, 2.0, 2.4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Lighting: keep powered base looking like MC (not pitch black)
scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const dir = new THREE.DirectionalLight(0xffffff, 0.55);
dir.position.set(5, 8, 6);
scene.add(dir);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ===== Geometry =====
const baseGeo = new THREE.BoxGeometry(1, 1, 1);

// inside: slightly smaller so it sits "inside" the shell
const insideGeo = new THREE.BoxGeometry(0.92, 0.92, 0.92);

// ===== Loaders =====
const loader = new THREE.TextureLoader();

function mcNearest(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Base (powered)
const baseTex = loader.load("./assets/controller_powered.png", mcNearest);

// Lights sheet (animated)
const lightsSheetTex = loader.load("./assets/controller_lights.png", mcNearest);

// Inside A/B powered
const insideATex = loader.load("./assets/controller_inside_a_powered.png", mcNearest);
const insideBTex = loader.load("./assets/controller_inside_b_powered.png", mcNearest);

// ===== Lights: extract 16x16 frames from vertical sheet into CanvasTexture =====
const lightsCanvas = document.createElement("canvas");
lightsCanvas.width = FRAME_W;
lightsCanvas.height = FRAME_H;
const lightsCtx = lightsCanvas.getContext("2d", { alpha: true });
lightsCtx.imageSmoothingEnabled = false;

const lightsTex = new THREE.CanvasTexture(lightsCanvas);
lightsTex.colorSpace = THREE.SRGBColorSpace;
lightsTex.magFilter = THREE.NearestFilter;
lightsTex.minFilter = THREE.NearestFilter;
lightsTex.generateMipmaps = false;
lightsTex.wrapS = THREE.ClampToEdgeWrapping;
lightsTex.wrapT = THREE.ClampToEdgeWrapping;

// ===== Materials =====
// powered base
const baseMat = new THREE.MeshStandardMaterial({ map: baseTex });

// lights overlay: use emissive map so the texture keeps its own colors (NOT white-fixed)
const lightsMat = new THREE.MeshStandardMaterial({
  transparent: true,
  map: lightsTex,
  emissiveMap: lightsTex,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 1.0
});

// inside: subtle emissive so it's visible like MC "core"
const insideMat = new THREE.MeshStandardMaterial({
  map: insideATex,
  emissiveMap: insideATex,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 0.45
});

// ===== Meshes =====
const baseMesh = new THREE.Mesh(baseGeo, baseMat);
scene.add(baseMesh);

const lightsMesh = new THREE.Mesh(baseGeo, lightsMat);
scene.add(lightsMesh);

const insideMesh = new THREE.Mesh(insideGeo, insideMat);
scene.add(insideMesh);

// ===== Animation state =====
let sheetImg = null;
let frameCount = 0;

function ensureSheetReady() {
  if (!lightsSheetTex.image) return false;
  if (sheetImg) return true;
  sheetImg = lightsSheetTex.image;
  frameCount = Math.max(1, Math.floor(sheetImg.height / FRAME_H));
  return true;
}

function drawLightsFrame(frameIdx) {
  const sy = frameIdx * FRAME_H;
  lightsCtx.clearRect(0, 0, FRAME_W, FRAME_H);
  lightsCtx.drawImage(sheetImg, 0, sy, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
  lightsTex.needsUpdate = true;
}

const start = performance.now();

function tickIndex() {
  const elapsed = performance.now() - start;
  return Math.floor(elapsed / FRAME_TIME_MS);
}

function animate() {
  if (ensureSheetReady()) {
    const t = tickIndex();

    // lights: frame switch (no scrolling)
    const frame = t % frameCount;
    drawLightsFrame(frame);

    // inside: A/B toggle each frame (jar-like)
    const useA = (t % 2) === 0;
    const tex = useA ? insideATex : insideBTex;
    insideMesh.material.map = tex;
    insideMesh.material.emissiveMap = tex;
    insideMesh.material.needsUpdate = true;
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

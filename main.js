import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Jar-like animation (NO scrolling UV). Fade between frames (interpolate:true).
const TICKS_PER_SECOND = 20;
const FRAME_TIME_TICKS = 25; // matches controller_lights.png.mcmeta
const FRAME_TIME_MS = (FRAME_TIME_TICKS / TICKS_PER_SECOND) * 1000;
const FRAME_W = 16;
const FRAME_H = 16;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(2.4, 2.0, 2.4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// minimal lighting for shell
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(5, 8, 6);
scene.add(dirLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const geometry = new THREE.BoxGeometry(1, 1, 1);

const loader = new THREE.TextureLoader();

const shellTexture = loader.load("./assets/controller.png", (t) => {
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
});

const sheetTexture = loader.load("./assets/controller_lights.png", (t) => {
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
});

// canvas for single 16x16 frame output
const canvas = document.createElement("canvas");
canvas.width = FRAME_W;
canvas.height = FRAME_H;
const ctx = canvas.getContext("2d", { alpha: true });
ctx.imageSmoothingEnabled = false;

const lightsTexture = new THREE.CanvasTexture(canvas);
lightsTexture.magFilter = THREE.NearestFilter;
lightsTexture.minFilter = THREE.NearestFilter;
lightsTexture.wrapS = THREE.ClampToEdgeWrapping;
lightsTexture.wrapT = THREE.ClampToEdgeWrapping;

const shellMaterial = new THREE.MeshStandardMaterial({ map: shellTexture, side: THREE.DoubleSide });
const lightsMaterial = new THREE.MeshBasicMaterial({ map: lightsTexture, transparent: true, opacity: 0.9, side: THREE.DoubleSide });

const shellMesh = new THREE.Mesh(geometry, shellMaterial);
scene.add(shellMesh);

const lightsMesh = new THREE.Mesh(geometry, lightsMaterial);
scene.add(lightsMesh);

let sheetImage = null;
let frameCount = 0;

function ensureSheetReady() {
  if (!sheetTexture.image) return false;
  if (sheetImage) return true;
  sheetImage = sheetTexture.image;
  frameCount = Math.floor(sheetImage.height / FRAME_H);
  return frameCount > 0;
}

function drawFrame(frameIndex, alpha) {
  const sy = frameIndex * FRAME_H;
  ctx.globalAlpha = alpha;
  ctx.drawImage(sheetImage, 0, sy, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
}

const startTime = performance.now();

function updateLights() {
  if (!ensureSheetReady()) return;

  const elapsed = performance.now() - startTime;
  const t = (elapsed / FRAME_TIME_MS) % frameCount;

  const base = Math.floor(t);
  const frac = t - base;
  const next = (base + 1) % frameCount;

  ctx.clearRect(0, 0, FRAME_W, FRAME_H);
  drawFrame(base, 1.0 - frac);
  drawFrame(next, frac);
  ctx.globalAlpha = 1.0;

  lightsTexture.needsUpdate = true;
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

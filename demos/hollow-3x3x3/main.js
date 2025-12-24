// demos/hollow-3x3x3/main.js（このファイルを全文置き換え）

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// -------------------------------
// Scene
// -------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0b);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(5, 5, 7);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.style.margin = "0";
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0, 0);
controls.update();

const hemi = new THREE.HemisphereLight(0xffffff, 0x202020, 0.8);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(6, 10, 6);
scene.add(dir);

// -------------------------------
// Grid / Layout
// -------------------------------
const GRID_SIZE = 3;               // 3x3x3
const SPACING = 1.0;               // keep tight to avoid “gaps”
const OFFSET = (GRID_SIZE - 1) * 0.5 * SPACING;

// Hollow cube shell: each face is filled, but face centers and cube center are empty.
function shouldPlace(x, y, z) {
  // bounds
  if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE || z < 0 || z >= GRID_SIZE) return false;

  const isSurface = (x === 0 || x === GRID_SIZE - 1 || y === 0 || y === GRID_SIZE - 1 || z === 0 || z === GRID_SIZE - 1);
  if (!isSurface) return false;

  const mid = Math.floor(GRID_SIZE / 2);

  // remove centers of each face
  if (x === mid && y === mid) return false; // z-surface centers
  if (x === mid && z === mid) return false; // y-surface centers
  if (y === mid && z === mid) return false; // x-surface centers

  // remove cube center (only exists if odd)
  if (x === mid && y === mid && z === mid) return false;

  return true;
}

const placed = new Set();
function key(x, y, z) { return `${x},${y},${z}`; }

for (let x = 0; x < GRID_SIZE; x++) {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      if (shouldPlace(x, y, z)) placed.add(key(x, y, z));
    }
  }
}

function hasBlock(x, y, z) {
  return placed.has(key(x, y, z));
}

// -------------------------------
// Textures
// -------------------------------
const loader = new THREE.TextureLoader();

function loadTex(url) {
  const t = loader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  return t;
}

const texBlockBase = loadTex("./assets/controller_powered.png");
const texColumnBase = loadTex("./assets/controller_column_powered.png");

// lights are sprite-sheets (stacked frames)
const texBlockSheet = loadTex("./assets/controller_lights.png");
const texColumnSheet = loadTex("./assets/controller_column_lights.png");

// inside textures (powered) - used for “inside” controllers
const texInsideA = loadTex("./assets/controller_inside_a_powered.png");
const texInsideB = loadTex("./assets/controller_inside_b_powered.png");

// -------------------------------
// Materials helpers
// -------------------------------
const baseGeo = new THREE.BoxGeometry(1, 1, 1);
const insideGeo = new THREE.BoxGeometry(0.92, 0.92, 0.92);

// BoxGeometry material order: [right, left, top, bottom, front, back]
const FACE_RIGHT = 0, FACE_LEFT = 1, FACE_TOP = 2, FACE_BOTTOM = 3, FACE_FRONT = 4, FACE_BACK = 5;

// Rotate only top/bottom faces to align “pulled” look with X/Z lines.
// (Rotation angle: Math.PI/2 for X-pull, 0 for Z-pull; null = no override)
function makeFaceMaterials(baseTexture, emissiveIntensity, topBottomRotation) {
  const makeMat = (t) => new THREE.MeshStandardMaterial({
    map: t,
    emissiveMap: t,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity
  });

  // Default: all faces share the same texture object
  const mats = Array(6).fill(null).map(() => makeMat(baseTexture));

  if (topBottomRotation != null) {
    // Clone texture objects for top/bottom only, so rotation doesn't affect other faces.
    const topTex = baseTexture.clone();
    const botTex = baseTexture.clone();
    topTex.center.set(0.5, 0.5);
    botTex.center.set(0.5, 0.5);
    topTex.rotation = topBottomRotation;
    botTex.rotation = topBottomRotation;
    topTex.needsUpdate = true;
    botTex.needsUpdate = true;

    mats[FACE_TOP] = makeMat(topTex);
    mats[FACE_BOTTOM] = makeMat(botTex);
  }
  return mats;
}

const W = 16, H = 16;

// Create a CanvasTexture from a canvas, optionally rotated for top/bottom.
function mkCanvasTex(canvas, rotation) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapNearestFilter;

  if (rotation != null) {
    tex.center.set(0.5, 0.5);
    tex.rotation = rotation;
  }
  tex.needsUpdate = true;
  return tex;
}

function makeLightsLayer(sheetTexture, topBottomRotation) {
  // We double-buffer two canvas textures for smooth cross-fade.
  const canvasA = document.createElement("canvas");
  canvasA.width = W; canvasA.height = H;
  const canvasB = document.createElement("canvas");
  canvasB.width = W; canvasB.height = H;

  const ctxA = canvasA.getContext("2d");
  const ctxB = canvasB.getContext("2d");

  const texA = mkCanvasTex(canvasA, null);
  const texB = mkCanvasTex(canvasB, null);

  const texA_tb = topBottomRotation != null ? mkCanvasTex(canvasA, topBottomRotation) : null;
  const texB_tb = topBottomRotation != null ? mkCanvasTex(canvasB, topBottomRotation) : null;

  const makeLightMat = (t) => new THREE.MeshStandardMaterial({
    map: t,
    transparent: true,
    opacity: 0.0,
    emissiveMap: t,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 2.0,
    depthWrite: false
  });

  const matsA = Array(6).fill(null).map(() => makeLightMat(texA));
  const matsB = Array(6).fill(null).map(() => makeLightMat(texB));

  if (topBottomRotation != null) {
    matsA[FACE_TOP] = makeLightMat(texA_tb);
    matsA[FACE_BOTTOM] = makeLightMat(texA_tb);
    matsB[FACE_TOP] = makeLightMat(texB_tb);
    matsB[FACE_BOTTOM] = makeLightMat(texB_tb);
  }

  const meshA = new THREE.Mesh(baseGeo, matsA);
  const meshB = new THREE.Mesh(baseGeo, matsB);
  // Slight scale to avoid z-fighting
  meshA.scale.setScalar(1.001);
  meshB.scale.setScalar(1.001);

  return {
    sheetTexture,
    sheetImg: null,
    frames: 1,
    ctxA, ctxB,
    // track textures to update
    texA, texB, texA_tb, texB_tb,
    matsA, matsB,
    meshA, meshB,
    topBottomRotation
  };
}

function drawFrame(ctx, img, idx) {
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, 0, idx * H, W, H, 0, 0, W, H);
}

// -------------------------------
// AE2-like connectivity classification
// -------------------------------

// Decide controller render type using AE2-like "sandwiched axis" logic:
// - If sandwiched on exactly one axis => column_{axis}
// - If sandwiched on 2+ axes => inside (checkerboard)
// - Else => block
function classifyAxis(x, y, z) {
  const sx = hasBlock(x - 1, y, z) && hasBlock(x + 1, y, z);
  const sy = hasBlock(x, y - 1, z) && hasBlock(x, y + 1, z);
  const sz = hasBlock(x, y, z - 1) && hasBlock(x, y, z + 1);

  const count = (sx ? 1 : 0) + (sy ? 1 : 0) + (sz ? 1 : 0);
  if (count >= 2) return "inside";  // inside_a / inside_b will be chosen separately
  if (sx) return "column_x";
  if (sy) return "column_y";
  if (sz) return "column_z";
  return "block";
}

// Determine "pull axis" for any block that belongs to a line of 3+ controllers.
// This aligns TOP/BOTTOM faces even for end pieces (1 and 3 in a 3-line).
function pullAxisFor(x, y, z) {
  const x3 =
    (hasBlock(x - 2, y, z) && hasBlock(x - 1, y, z)) ||
    (hasBlock(x - 1, y, z) && hasBlock(x + 1, y, z)) ||
    (hasBlock(x + 1, y, z) && hasBlock(x + 2, y, z));

  const y3 =
    (hasBlock(x, y - 2, z) && hasBlock(x, y - 1, z)) ||
    (hasBlock(x, y - 1, z) && hasBlock(x, y + 1, z)) ||
    (hasBlock(x, y + 1, z) && hasBlock(x, y + 2, z));

  const z3 =
    (hasBlock(x, y, z - 2) && hasBlock(x, y, z - 1)) ||
    (hasBlock(x, y, z - 1) && hasBlock(x, y, z + 1)) ||
    (hasBlock(x, y, z + 1) && hasBlock(x, y, z + 2));

  const count = (x3 ? 1 : 0) + (y3 ? 1 : 0) + (z3 ? 1 : 0);
  if (count >= 2) return null; // ambiguous -> inside logic
  if (x3) return "x";
  if (y3) return "y";
  if (z3) return "z";
  return null;
}

// -------------------------------
// Build blocks
// -------------------------------

// Tuning: make powered base look "on"
const BASE_EMISSIVE = 0.45;
const INSIDE_EMISSIVE = 0.7;

function makeBlock(type, topBottomRotation) {
  const isInside = (type === "inside");
  const isColumn = type.startsWith("column");

  // Base texture selection: column uses column texture, otherwise normal powered
  const baseTex = isColumn ? texColumnBase : texBlockBase;
  const baseMats = makeFaceMaterials(baseTex, BASE_EMISSIVE, topBottomRotation);
  const baseMesh = new THREE.Mesh(baseGeo, baseMats);

  // Lights sheet selection: column uses column lights, otherwise normal lights
  const lights = makeLightsLayer(isColumn ? texColumnSheet : texBlockSheet, topBottomRotation);

  // Inside mesh: only meaningful for inside blocks (checker)
  const insideTex = ((Math.random() < 0.5) ? texInsideA : texInsideB);
  const insideMat = new THREE.MeshStandardMaterial({
    map: insideTex,
    emissiveMap: insideTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: INSIDE_EMISSIVE,
    transparent: false
  });
  const insideMesh = new THREE.Mesh(insideGeo, insideMat);

  const group = new THREE.Group();
  group.add(baseMesh, lights.meshA, lights.meshB);

  // Only add inside overlay for inside blocks
  if (isInside) group.add(insideMesh);

  // Match AE2 blockstate rotations for column variants:
  // column_y: no rotation
  // column_z: x=90
  // column_x: x=90, y=90
  if (type === "column_z") {
    group.rotation.x = Math.PI / 2;
  } else if (type === "column_x") {
    group.rotation.x = Math.PI / 2;
    group.rotation.y = Math.PI / 2;
  }

  return { group, baseMesh, lights, insideMesh, topBottomRotation, type };
}

const instances = [];
for (let x = 0; x < GRID_SIZE; x++) {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let z = 0; z < GRID_SIZE; z++) {
      if (!hasBlock(x, y, z)) continue;

      const type = classifyAxis(x, y, z);

      // Top/Bottom alignment: X/Z “3連”なら上下面もその列方向へ（端ブロックも含む）
      const pullAxis = pullAxisFor(x, y, z);
      const topBottomRotation = (pullAxis === "x") ? (Math.PI / 2) : (pullAxis === "z") ? 0 : null;

      const inst = makeBlock(type, topBottomRotation);
      inst.group.position.set((x * SPACING) - OFFSET, (y * SPACING) - OFFSET, (z * SPACING) - OFFSET);

      // Deterministic inside checker: position parity picks A/B
      if (type === "inside") {
        const parity = (x + y + z) & 1;
        inst.insideMesh.material.map = parity ? texInsideA : texInsideB;
        inst.insideMesh.material.emissiveMap = inst.insideMesh.material.map;
        inst.insideMesh.material.needsUpdate = true;
      }

      scene.add(inst.group);
      instances.push({ x, y, z, ...inst });
    }
  }
}

// -------------------------------
// Lights animation (sprite-sheet)
// -------------------------------
function initSheet(l) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      l.sheetImg = img;
      l.frames = Math.max(1, Math.floor(img.height / H));
      resolve();
    };
    img.src = l.sheetTexture.image?.src || l.sheetTexture.source?.data?.src || l.sheetTexture.url || l.sheetTexture.image;
  });
}

// Some loaders hide URL; fallback to explicit in our known cases
function ensureSheetSrc(l, fallbackUrl) {
  const img = new Image();
  return new Promise((resolve) => {
    img.onload = () => {
      l.sheetImg = img;
      l.frames = Math.max(1, Math.floor(img.height / H));
      resolve();
    };
    img.src = fallbackUrl;
  });
}

async function initAllSheets() {
  // Find unique layer objects
  const layers = new Set();
  for (const inst of instances) layers.add(inst.lights);

  for (const l of layers) {
    // Try direct init; if url is not accessible, use fallback based on sheet selection.
    try {
      await initSheet(l);
      if (!l.sheetImg) throw new Error("no sheetImg");
    } catch {
      // fallback: decide by reference texture object
      const isColumn = (l.sheetTexture === texColumnSheet);
      await ensureSheetSrc(l, isColumn ? "./assets/controller_column_lights.png" : "./assets/controller_lights.png");
    }

    // Prime initial frames
    drawFrame(l.ctxA, l.sheetImg, 0);
    l.texA.needsUpdate = true;
    if (l.texA_tb) l.texA_tb.needsUpdate = true;

    drawFrame(l.ctxB, l.sheetImg, 1 % l.frames);
    l.texB.needsUpdate = true;
    if (l.texB_tb) l.texB_tb.needsUpdate = true;
  }
}
await initAllSheets();

let t = 0;
let frameA = 0;
let frameB = 1;
let alpha = 0;

function updateLights(dt) {
  t += dt;

  // speed: tune here
  const cycleSeconds = 0.18; // shorter = faster
  const phase = (t % cycleSeconds) / cycleSeconds;

  // Smoothstep for “滑らか”
  alpha = phase * phase * (3 - 2 * phase);

  // When we wrap to new cycle, advance frames and redraw
  if (phase < (dt / cycleSeconds)) {
    frameA = (frameA + 1) % 64; // will be modded by frames in draw
    frameB = (frameA + 1);

    const layers = new Set();
    for (const inst of instances) layers.add(inst.lights);

    for (const l of layers) {
      if (!l.sheetImg) continue;
      const a = frameA % l.frames;
      const b = frameB % l.frames;

      drawFrame(l.ctxA, l.sheetImg, a);
      l.texA.needsUpdate = true;
      if (l.texA_tb) l.texA_tb.needsUpdate = true;

      drawFrame(l.ctxB, l.sheetImg, b);
      l.texB.needsUpdate = true;
      if (l.texB_tb) l.texB_tb.needsUpdate = true;
    }
  }

  // Apply crossfade to every instance
  for (const inst of instances) {
    for (const m of inst.lights.matsA) m.opacity = 1.0 - alpha;
    for (const m of inst.lights.matsB) m.opacity = alpha;
  }
}

// -------------------------------
// Render loop
// -------------------------------
let last = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = (now - last) / 1000;
  last = now;

  controls.update();
  updateLights(dt);
  renderer.render(scene, camera);
}
animate();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

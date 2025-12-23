import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/*
  AE2 ME Controller - Online web preview (model JSON driven)
  - Loads AE2 model JSON (elements) and textures extracted from ae2 jar.
  - Rebuilds meshes in three.js.
  - Replays controller_lights.png.mcmeta (frametime=25, interpolate=true) via UV offset.
*/

// =========================
// Config
// =========================
const ONLINE = true;

// Paths in this demo bundle
const MODEL_BLOCK_ONLINE = "./models/controller_block_online.json";
const MODEL_BLOCK_LIGHTS = "./models/controller_block_lights.json";
const MODEL_INSIDE_A = "./models/controller_inside_a.json";
const MODEL_INSIDE_B = "./models/controller_inside_b.json";

const TEXTURES = {
  "ae2:block/controller_powered": "./assets/controller_powered.png",
  "ae2:block/controller_lights": "./assets/controller_lights.png",
  "ae2:block/controller_inside_a": "./assets/controller_inside_a.png",
  "ae2:block/controller_inside_b": "./assets/controller_inside_b.png",
};

// mcmeta facts for controller_lights.png (confirmed from jar)
const TICKS_PER_SECOND = 20;
const FRAME_TIME_TICKS = 25;
const FRAME_TIME_MS = (FRAME_TIME_TICKS / TICKS_PER_SECOND) * 1000;
const FRAME_HEIGHT = 16;

// =========================
// HUD helpers
// =========================
const hud = document.getElementById("hud");
function hudOK(msg) { hud.innerHTML = `<span class="ok">OK</span> ${msg}`; }
function hudERR(msg) { hud.innerHTML = `<span class="err">ERROR</span> ${msg}`; }

// =========================
// three.js bootstrap
// =========================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(2.6, 2.0, 2.6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// lights
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const dir = new THREE.DirectionalLight(0xffffff, 0.85);
dir.position.set(5, 10, 7);
scene.add(dir);

// controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// =========================
// Utility: fetch JSON
// =========================
async function loadJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return await res.json();
}

// =========================
// Built-in vanilla parents (minimal)
// =========================
function builtinParent(id) {
  // Only what we need for AE2 controller models in this demo.
  // - block/block: no elements
  // - block/cube_all: a full cube with #all texture
  if (id === "block/block") {
    return { textures: {}, elements: [] };
  }
  if (id === "block/cube_all") {
    return {
      textures: { },
      elements: [
        {
          from: [0, 0, 0],
          to: [16, 16, 16],
          faces: {
            down:  { uv: [0,0,16,16], texture: "#all" },
            up:    { uv: [0,0,16,16], texture: "#all" },
            north: { uv: [0,0,16,16], texture: "#all" },
            south: { uv: [0,0,16,16], texture: "#all" },
            west:  { uv: [0,0,16,16], texture: "#all" },
            east:  { uv: [0,0,16,16], texture: "#all" },
          },
        },
      ],
    };
  }
  throw new Error(`Unsupported parent: ${id}`);
}

// =========================
// Model resolve: parent merge
// =========================
async function resolveModel(path, seen = new Set()) {
  if (seen.has(path)) throw new Error(`Circular model parent chain: ${path}`);
  seen.add(path);

  const model = await loadJson(path);
  let base = { textures: {}, elements: [], render_type: model.render_type };
  if (model.parent) {
    if (model.parent.startsWith("block/")) {
      base = builtinParent(model.parent);
    } else if (model.parent.startsWith("ae2:")) {
      // Only parent we need is controller_block_lights which is bundled
      const name = model.parent.split("/").pop() + ".json";
      base = await resolveModel("./models/" + name, seen);
    } else {
      // Not needed for this demo
      throw new Error(`Unsupported parent namespace: ${model.parent}`);
    }
  }

  // merge: child overrides textures; if child has elements, use them else inherit
  const merged = {
    textures: { ...(base.textures || {}), ...(model.textures || {}) },
    elements: (model.elements && model.elements.length) ? model.elements : (base.elements || []),
    render_type: model.render_type || base.render_type,
  };
  return merged;
}

// =========================
// Texture / Material cache
// =========================
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();
const materialCache = new Map();

function loadTexture(texId) {
  const path = TEXTURES[texId];
  if (!path) throw new Error(`Texture not mapped in demo: ${texId}`);
  if (textureCache.has(texId)) return textureCache.get(texId);

  const tex = textureLoader.load(path);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;

  textureCache.set(texId, tex);
  return tex;
}

function getMaterial(texId, opts = {}) {
  const key = `${texId}|${opts.transparent ? "t" : "o"}|${opts.cutout ? "c" : "n"}|${opts.emissive ? "e" : "n"}|${opts.polygonOffset ? "p" : "n"}`;
  if (materialCache.has(key)) return materialCache.get(key);

  const tex = loadTexture(texId);

  // If this is the lights texture, it needs repeating for animation
  if (texId === "ae2:block/controller_lights") {
    tex.wrapT = THREE.RepeatWrapping;
  }

  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: !!opts.transparent,
    alphaTest: opts.cutout ? 0.01 : 0.0,
    emissive: opts.emissive ? new THREE.Color(0xffffff) : new THREE.Color(0x000000),
    emissiveIntensity: opts.emissive ? 1.0 : 0.0,
  });

  if (opts.polygonOffset) {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = opts.polygonOffsetFactor ?? 1;
    mat.polygonOffsetUnits = opts.polygonOffsetUnits ?? 1;
  }

  materialCache.set(key, mat);
  return mat;
}

// =========================
// Element -> meshes
// =========================
function pxToUnit(v) {
  // Model coords are 0..16, map to -0.5..0.5 cube
  return (v / 16) - 0.5;
}
function uvTo01(u, v) {
  // model UV is 0..16, origin top-left. three.js uses origin bottom-left.
  const U = u / 16;
  const V = 1 - (v / 16);
  return [U, V];
}

function buildFaceGeometry(face, from, to) {
  // Returns BufferGeometry for one face quad, with UVs.
  const geom = new THREE.BufferGeometry();

  const [x1,y1,z1] = from.map(pxToUnit);
  const [x2,y2,z2] = to.map(pxToUnit);

  // Determine positions for each face
  let verts = [];
  let normal = [0,0,0];

  switch (face) {
    case "up":    // y2
      normal=[0,1,0];
      verts=[[x1,y2,z2],[x2,y2,z2],[x2,y2,z1],[x1,y2,z1]];
      break;
    case "down":  // y1
      normal=[0,-1,0];
      verts=[[x1,y1,z1],[x2,y1,z1],[x2,y1,z2],[x1,y1,z2]];
      break;
    case "north": // z1
      normal=[0,0,-1];
      verts=[[x2,y2,z1],[x1,y2,z1],[x1,y1,z1],[x2,y1,z1]];
      break;
    case "south": // z2
      normal=[0,0,1];
      verts=[[x1,y2,z2],[x2,y2,z2],[x2,y1,z2],[x1,y1,z2]];
      break;
    case "west":  // x1
      normal=[-1,0,0];
      verts=[[x1,y2,z1],[x1,y2,z2],[x1,y1,z2],[x1,y1,z1]];
      break;
    case "east":  // x2
      normal=[1,0,0];
      verts=[[x2,y2,z2],[x2,y2,z1],[x2,y1,z1],[x2,y1,z2]];
      break;
    default:
      throw new Error(`Unknown face: ${face}`);
  }

  // UV mapping: use face.uv if present else default full
  const uv = (face.uv && face.uv.length === 4) ? face.uv : [0,0,16,16];
  const [u1,v1,u2,v2] = uv;

  // Map quad verts to UV corners (top-left origin in MC)
  // We'll map as:
  // v0 -> (u1,v2) bottom-left in MC coords? We use conversion function.
  // We'll follow typical Minecraft model mapping.
  const uv0 = uvTo01(u1, v2);
  const uv1 = uvTo01(u2, v2);
  const uv2 = uvTo01(u2, v1);
  const uv3 = uvTo01(u1, v1);

  const positions = new Float32Array([
    ...verts[0], ...verts[1], ...verts[2],
    ...verts[0], ...verts[2], ...verts[3],
  ]);
  const normals = new Float32Array([
    ...normal, ...normal, ...normal,
    ...normal, ...normal, ...normal,
  ]);
  const uvs = new Float32Array([
    ...uv0, ...uv1, ...uv2,
    ...uv0, ...uv2, ...uv3,
  ]);

  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  return geom;
}

function resolveTextureRef(textures, ref) {
  if (!ref) return null;
  if (ref.startsWith("#")) {
    const k = ref.slice(1);
    const v = textures[k];
    if (!v) return null;
    return resolveTextureRef(textures, v);
  }
  return ref;
}

function buildModelGroup(resolvedModel, materialOptsByTexId = {}) {
  const group = new THREE.Group();

  for (const el of resolvedModel.elements || []) {
    const from = el.from;
    const to = el.to;
    const faces = el.faces || {};

    for (const faceName of Object.keys(faces)) {
      const f = faces[faceName];
      const texId = resolveTextureRef(resolvedModel.textures, f.texture);
      if (!texId) continue;

      const opts = materialOptsByTexId[texId] || {};
      const mat = getMaterial(texId, opts);
      const geom = buildFaceGeometry(faceName, from, to);
      const mesh = new THREE.Mesh(geom, mat);
      if (el.shade === false) {
        mesh.material = mesh.material.clone();
        mesh.material.flatShading = true;
        mesh.material.needsUpdate = true;
      }
      group.add(mesh);
    }
  }

  return group;
}

// =========================
// Build AE2 ME Controller (online)
// =========================
let lightsTexture = null;

async function buildController() {
  // Resolve models
  const blockOnline = await resolveModel(MODEL_BLOCK_ONLINE); // inherits elements from controller_block_lights
  const insideA = await resolveModel(MODEL_INSIDE_A);
  const insideB = await resolveModel(MODEL_INSIDE_B);

  // Materials behavior:
  // - lights: cutout + emissive
  // - block: opaque
  // - inside: cutout (their textures have alpha), slightly inset to avoid z-fight
  const opts = {
    "ae2:block/controller_lights": { transparent: true, cutout: true, emissive: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 },
    "ae2:block/controller_powered": { transparent: false, cutout: false, emissive: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 },
    "ae2:block/controller_inside_a": { transparent: true, cutout: true, emissive: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 },
    "ae2:block/controller_inside_b": { transparent: true, cutout: true, emissive: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 },
  };

  const group = new THREE.Group();

  // Inside first (slightly scaled to reduce z-fighting)
  const insideGroupA = buildModelGroup(insideA, opts);
  const insideGroupB = buildModelGroup(insideB, opts);
  insideGroupA.scale.setScalar(0.999);
  insideGroupB.scale.setScalar(0.998);
  group.add(insideGroupA);
  group.add(insideGroupB);

  // Block + lights in one model (elements include two cubes: lights then block)
  const blockGroup = buildModelGroup(blockOnline, opts);
  group.add(blockGroup);

  // Grab lights texture ref for animation
  lightsTexture = loadTexture("ae2:block/controller_lights");
  lightsTexture.wrapT = THREE.RepeatWrapping;

  // Set initial repeat once image is ready
  if (lightsTexture.image) {
    const frameCount = lightsTexture.image.height / FRAME_HEIGHT;
    lightsTexture.repeat.set(1, 1 / frameCount);
  }

  scene.add(group);

  // HUD
  hudOK(`online=${ONLINE} | layers=shell+inside_a+inside_b+lights | mcmeta: frametime=${FRAME_TIME_TICKS}tick (${(FRAME_TIME_MS/1000).toFixed(2)}s), interpolate=true`);
}

// =========================
// Lights animation (mcmeta interpolate=true)
// =========================
const startTime = performance.now();
function updateLights() {
  if (!ONLINE) return;
  if (!lightsTexture || !lightsTexture.image) return;

  const frameCount = lightsTexture.image.height / FRAME_HEIGHT;
  if (lightsTexture.repeat.y === 1) {
    lightsTexture.repeat.set(1, 1 / frameCount);
  }

  const now = performance.now();
  const elapsed = now - startTime;

  // continuous frame index
  const exactFrame = (elapsed / FRAME_TIME_MS) % frameCount;
  lightsTexture.offset.y = exactFrame / frameCount;
}

// =========================
// Render loop
// =========================
function render() {
  updateLights();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// =========================
// Start
// =========================
(async () => {
  try {
    await buildController();
    render();
  } catch (e) {
    console.error(e);
    hudERR(e?.message || String(e));
  }
})();

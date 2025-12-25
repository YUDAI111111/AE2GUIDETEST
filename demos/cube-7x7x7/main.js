// demos/cube-7x7x7/main.js
// Clean rebuild: AE2 Controller type logic (column/inside) + stable lights crossfade + debug panel.
// Constraints honored:
// - Column direction is expressed via whole-block mesh rotation (no per-face UV "pillar direction" hacks).
// - Special +90° rotation for specific face numbers is applied to BOTH base and lights on those faces.
// - Single file; no external deps beyond Three.js + OrbitControls.
//
// Notes:
// - This file assumes the same folder structure as the original repo.
// - Assets referenced here are the existing demo assets used by your current pages.
//
// Authoring intent: stable, no ReferenceError, deterministic scope.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// -----------------------------
// Utilities / constants
// -----------------------------
const GRID = 7;
const SPACING = 1.0;
const OFFSET = (GRID - 1) * 0.5 * SPACING;

const FACE_RIGHT = 0;  // +X
const FACE_LEFT  = 1;  // -X
const FACE_TOP   = 2;  // +Y
const FACE_BOTTOM= 3;  // -Y
const FACE_FRONT = 4;  // +Z (south)
const FACE_BACK  = 5;  // -Z (north)

const ROT_90 = Math.PI / 2;

const ROT90_NORTH_SOUTH = new Set([16, 20, 30, 34]);
const ROT90_UP_DOWN = new Set([11, 39]);

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function posKey(x,y,z){ return `${x},${y},${z}`; }

function layerY(layerIndex1to7){
  // layer 1 is top => y=6 ; layer 7 is bottom => y=0
  return GRID - layerIndex1to7;
}

function idxToXZ(n1to49){
  // numbering: left-top -> right, row-major; 1..49
  const i = n1to49 - 1;
  const row = Math.floor(i / GRID);
  const col = i % GRID;
  return { x: col, z: row };
}

function faceNumNorth(x,y,z){
  // north face: z==0, numbering left=west (x 0..6), top=up (y 6..0)
  const row = (GRID - 1) - y; // y6 -> row0
  const col = x;
  return row * GRID + col + 1;
}
function faceNumSouth(x,y,z){
  // south face: z==6, "south face as seen looking north": left=west, top=up
  const row = (GRID - 1) - y;
  const col = x;
  return row * GRID + col + 1;
}
function faceNumUp(x,y,z){
  // top face y==6: 04 side is north => north edge center is (x=3,z=0) => 4.
  const row = z; // z 0..6 north->south
  const col = x;
  return row * GRID + col + 1;
}
function faceNumDown(x,y,z){
  // bottom face y==0: same orientation spec
  const row = z;
  const col = x;
  return row * GRID + col + 1;
}

function needsRot90ForFace(x,y,z,faceIndex){
  // Apply ONLY to the specified face-number rules (for both base + lights)
  if (faceIndex === FACE_BACK && z === 0) { // north face
    return ROT90_NORTH_SOUTH.has(faceNumNorth(x,y,z));
  }
  if (faceIndex === FACE_FRONT && z === GRID-1) { // south face
    return ROT90_NORTH_SOUTH.has(faceNumSouth(x,y,z));
  }
  if (faceIndex === FACE_TOP && y === GRID-1) { // up
    return ROT90_UP_DOWN.has(faceNumUp(x,y,z));
  }
  if (faceIndex === FACE_BOTTOM && y === 0) { // down
    return ROT90_UP_DOWN.has(faceNumDown(x,y,z));
  }
  return false;
}

function safeNowMs(){ return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(); }

// -----------------------------
// Debug UI
// -----------------------------
function makeDebugUI(){
  const __DBG_KEY = "cube7x7x7_debug_hidden";
  const __dbgHidden = (localStorage.getItem(__DBG_KEY) === "1");

  const root = document.createElement("div");
  root.style.cssText = [
    "position:fixed;top:10px;right:10px;z-index:9999",
    "font:12px/1.35 ui-monospace,Consolas,monospace",
    "color:#eaeaea;background:rgba(0,0,0,0.65)",
    "border:1px solid rgba(255,255,255,0.15)",
    "border-radius:8px;padding:10px;min-width:260px",
    "user-select:none"
  ].join(";");

  const title = document.createElement("div");
  title.textContent = "cube-7x7x7 DEBUG";
  title.style.cssText = "font-weight:700;margin-bottom:8px";
  root.appendChild(title);

  const mkToggle = (label, initial, onChange)=>{
    const wrap = document.createElement("label");
    wrap.style.cssText = "display:flex;gap:8px;align-items:center;margin:4px 0;";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!initial;
    cb.addEventListener("change", ()=> onChange(cb.checked));
    const sp = document.createElement("span");
    sp.textContent = label;
    wrap.appendChild(cb);
    wrap.appendChild(sp);
    root.appendChild(wrap);
    return cb;
  };

  const mkSelect = (label, options, onChange)=>{
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:6px";
    const sp = document.createElement("span");
    sp.textContent = label;
    const sel = document.createElement("select");
    sel.style.cssText = "flex:1;background:#111;color:#eee;border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:2px 6px";
    for (const o of options){
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", ()=> onChange(sel.value));
    wrap.appendChild(sp);
    wrap.appendChild(sel);
    root.appendChild(wrap);
    return sel;
  };

  const pickBox = document.createElement("div");
  pickBox.style.cssText = "margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.15)";
  pickBox.innerHTML = `<div style="font-weight:600;margin-bottom:4px">Pick</div><div id="pickText">Pick: none</div>`;
  root.appendChild(pickBox);
  const pickText = pickBox.querySelector("#pickText");

  const texBox = document.createElement("div");
  texBox.style.cssText = "margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.15)";
  texBox.innerHTML = `<div style="font-weight:600;margin-bottom:4px">Textures</div><div id="texList"></div>`;
  root.appendChild(texBox);
  const texList = texBox.querySelector("#texList");

  const hint = document.createElement("div");
  hint.style.cssText = "margin-top:8px;color:rgba(255,255,255,0.8)";
  hint.textContent = "Click a block to inspect its (x,y,z), type, rotations. Use Material=UV test to verify per-face UV.";
  root.appendChild(hint);

  document.body.appendChild(root);
  // Close button (persist)
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.title = "Close debug";
  closeBtn.style.cssText = "position:absolute;right:6px;top:6px;width:26px;height:26px;border-radius:6px;border:0;" +
                           "background:rgba(255,255,255,0.15);color:#fff;cursor:pointer;font-size:18px;line-height:26px;";
  closeBtn.addEventListener("click", () => {
    root.style.display = "none";
    localStorage.setItem(__DBG_KEY, "1");
    showBtn.style.display = "block";
    requestRender && requestRender();
  });
  root.style.position = "fixed"; // ensure absolute close works
  root.appendChild(closeBtn);

  // Re-open button
  const showBtn = document.createElement("button");
  showBtn.textContent = "Show DEBUG";
  showBtn.title = "Show debug panel";
  showBtn.style.cssText = "position:fixed;right:12px;top:12px;z-index:99999;padding:6px 10px;border-radius:10px;" +
                          "border:0;background:rgba(0,0,0,0.7);color:#fff;cursor:pointer;font:12px/1.2 ui-monospace,Consolas,monospace;";
  showBtn.addEventListener("click", () => {
    root.style.display = "block";
    localStorage.setItem(__DBG_KEY, "0");
    showBtn.style.display = "none";
    requestRender && requestRender();
  });
  document.body.appendChild(showBtn);

  if (__dbgHidden){
    root.style.display = "none";
    showBtn.style.display = "block";
  } else {
    showBtn.style.display = "none";
  }


  return { root, mkToggle, mkSelect, pickText, texList };
}

// -----------------------------
// AE2 controller placement: 7x7x7 demo layout
// -----------------------------
function buildPlacedSet(){
  // From your description (same as previous demo):
  // layer1 blanks: {4, 9, 13, 18, 22, 24, 25, 26, 28, 32, 37, 41, 46}
  // layer2 filled: {1, 3, 4, 5, 7, 15, 17, 18, 19, 21, 22, 24, 26, 28, 29, 31, 32, 33, 35, 43, 45, 46, 47, 49}
  // layer4 filled: {2, 6, 8, 10, 12, 14, 16, 20, 30, 34, 36, 38, 40, 42, 44, 48}
  const layer1Blanks = new Set([4, 9, 13, 18, 22, 24, 25, 26, 28, 32, 37, 41, 46]);
  const layer2Filled = new Set([1, 3, 4, 5, 7, 15, 17, 18, 19, 21, 22, 24, 26, 28, 29, 31, 32, 33, 35, 43, 45, 46, 47, 49]);
  const layer4Filled = new Set([2, 6, 8, 10, 12, 14, 16, 20, 30, 34, 36, 38, 40, 42, 44, 48]);

  const placed = new Set();

  for (let layer = 1; layer <= 7; layer++){
    const y = layerY(layer);
    for (let n = 1; n <= 49; n++){
      let fill = false;
      if (layer === 1 || layer === 3 || layer === 5 || layer === 7){
        fill = !layer1Blanks.has(n);
      } else if (layer === 2 || layer === 6){
        fill = layer2Filled.has(n);
      } else if (layer === 4){
        fill = layer4Filled.has(n);
      }
      if (!fill) continue;
      const { x, z } = idxToXZ(n);
      placed.add(posKey(x,y,z));
    }
  }
  return placed;
}

// -----------------------------
// AE2 classify logic (facts from user)
// -----------------------------
function classifyType(x,y,z, placed){
  const has = (xx,yy,zz)=> placed.has(posKey(xx,yy,zz));
  const sx = has(x-1,y,z) && has(x+1,y,z);
  const sy = has(x,y-1,z) && has(x,y+1,z);
  const sz = has(x,y,z-1) && has(x,y,z+1);

  const count = (sx?1:0) + (sy?1:0) + (sz?1:0);

  if (count >= 2){
    const parity = (Math.abs(x)+Math.abs(y)+Math.abs(z)) & 1;
    return parity === 0 ? "inside_a" : "inside_b";
  }
  if (count === 1){
    if (sx) return "column_x";
    if (sy) return "column_y";
    return "column_z"; // sz true
  }
  return "block";
}

// -----------------------------
// Textures
// -----------------------------
const ASSET_BASE = "../hollow-3x3x3/assets"; // same base used by your current demos

const TEX = {
  block:           `${ASSET_BASE}/controller_powered.png`,
  column:          `${ASSET_BASE}/controller_column_powered.png`,
  inside_a:        `${ASSET_BASE}/controller_inside_a_powered.png`,
  inside_b:        `${ASSET_BASE}/controller_inside_b_powered.png`,
  // lights (sprite sheets)
  block_l:         `${ASSET_BASE}/controller_lights.png`,
  column_l:        `${ASSET_BASE}/controller_column_lights.png`,
  inside_a_l:      `${ASSET_BASE}/controller_lights.png`,
  inside_b_l:      `${ASSET_BASE}/controller_lights.png`,
};

// -----------------------------
// UV-consistent cube geometry (Minecraft-like orientation)
// -----------------------------
// Three.js BoxGeometry's UV orientation differs per face; this creates "mixed" appearance even without logic issues.
// This custom geometry enforces a consistent UV convention per face: U increases to +X (or +Z) and V increases to +Y,
// matching typical Minecraft block UV expectations.
function makeMCBoxGeometry(size=1.0){
  const s = size * 0.5;

  // vertices per face (2 triangles)
  // For each face, define positions and UVs consistently.
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const groups = []; // [{start,count,materialIndex}]
  let vbase = 0;

  function addFace(p0,p1,p2,p3, n, materialIndex){
    // p0..p3 are corners in CCW order when looking at the face from outside
    positions.push(...p0, ...p1, ...p2, ...p3);
    normals.push(...n, ...n, ...n, ...n);

    // UV: p0 (0,0), p1 (1,0), p2 (1,1), p3 (0,1)
    uvs.push(0,0, 1,0, 1,1, 0,1);

    // two triangles: 0-1-2 and 0-2-3
    const i0 = vbase + 0;
    const i1 = vbase + 1;
    const i2 = vbase + 2;
    const i3 = vbase + 3;

    const start = indices.length;
    indices.push(i0,i1,i2,  i0,i2,i3);
    groups.push({ start, count: 6, materialIndex });

    vbase += 4;
  }

  // Face order matches FACE_* indices used elsewhere:
  // FACE_RIGHT(+X)=0, FACE_LEFT(-X)=1, FACE_TOP(+Y)=2, FACE_BOTTOM(-Y)=3, FACE_FRONT(+Z)=4, FACE_BACK(-Z)=5

  // +X (east/right): looking from +X, up=+Y, right=-Z
  addFace([ s,-s, s],[ s,-s,-s],[ s, s,-s],[ s, s, s],[1,0,0], FACE_RIGHT);
  // -X (west/left): looking from -X, up=+Y, right=+Z
  addFace([-s,-s,-s],[-s,-s, s],[-s, s, s],[-s, s,-s],[-1,0,0], FACE_LEFT);
  // +Y (top): looking from +Y, up=-Z, right=+X
  addFace([-s, s, s],[ s, s, s],[ s, s,-s],[-s, s,-s],[0,1,0], FACE_TOP);
  // -Y (bottom): looking from -Y, up=+Z, right=+X
  addFace([-s,-s,-s],[ s,-s,-s],[ s,-s, s],[-s,-s, s],[0,-1,0], FACE_BOTTOM);
  // +Z (south/front): looking from +Z, up=+Y, right=+X
  addFace([-s,-s, s],[ s,-s, s],[ s, s, s],[-s, s, s],[0,0,1], FACE_FRONT);
  // -Z (north/back): looking from -Z, up=+Y, right=-X (but we keep UV right=+X, so vertex order reflects that)
  addFace([ s,-s,-s],[-s,-s,-s],[-s, s,-s],[ s, s,-s],[0,0,-1], FACE_BACK);

  const g = new THREE.BufferGeometry();
  g.setIndex(indices);
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

  // IMPORTANT: Multi-material meshes require groups; without this Three.js will not render the mesh.
  for (const gr of groups){
    g.addGroup(gr.start, gr.count, gr.materialIndex);
  }

  g.computeBoundingSphere();
  return g;
}

// -----------------------------
// Light shader mix material factory
// -----------------------------
function makeMixMaterial(texA, texB, mixUniform){
  // Additive overlay for lights: must never hide the base texture.
  const mat = new THREE.MeshBasicMaterial({
    map: texA,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  mat.toneMapped = false;

  mat.onBeforeCompile = (shader)=>{
    shader.uniforms.mapB = { value: texB };
    shader.uniforms.mixAlpha = mixUniform;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      "#include <common>\nuniform sampler2D mapB;\nuniform float mixAlpha;\n"
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `
#ifdef USE_MAP
  vec4 texelColorA = texture2D( map, vMapUv );
  vec4 texelColorB = texture2D( mapB, vMapUv );
  vec4 texelColor = mix(texelColorA, texelColorB, mixAlpha);
  texelColor = mapTexelToLinear( texelColor );
  float a = max(max(texelColor.r, texelColor.g), texelColor.b);
  diffuseColor.rgb *= texelColor.rgb;
  diffuseColor.a *= a;
#endif
      `
    );
  };
  return mat;
}

function rotateTexture90(tex){
  // Clone and apply +90° rotation around center (0.5,0.5)
  const t = tex.clone();
  t.center.set(0.5,0.5);
  t.rotation = ROT_90;
  t.needsUpdate = true;
  return t;
}



// -----------------------------
// Lights sheet decoding (robust, no scoping bugs)
// -----------------------------
const LIGHT_CACHE = new Map(); // key -> LightSource

function drawFrame(ctx, img, frameIndex, frameW, frameH){
  ctx.clearRect(0,0,frameW,frameH);
  ctx.drawImage(img, 0, frameIndex*frameH, frameW, frameH, 0,0,frameW,frameH);
}

function makeLightSource(sheetUrl){
  if (LIGHT_CACHE.has(sheetUrl)) return LIGHT_CACHE.get(sheetUrl);

  const frameW = 16;
  const frameH = 16;

  const canvasA = document.createElement("canvas");
  canvasA.width = frameW;
  canvasA.height = frameH;
  const canvasB = document.createElement("canvas");
  canvasB.width = frameW;
  canvasB.height = frameH;

  const ctxA = canvasA.getContext("2d");
  const ctxB = canvasB.getContext("2d");

  const texA = new THREE.CanvasTexture(canvasA);
  const texB = new THREE.CanvasTexture(canvasB);
  texA.magFilter = THREE.NearestFilter;
  texA.minFilter = THREE.NearestFilter;
  texB.magFilter = THREE.NearestFilter;
  texB.minFilter = THREE.NearestFilter;

  const mixUniform = { value: 0.0 };

  // Always define faceMap arrays (no conditional scoping).
  const faceMapA = new Array(6).fill(texA);
  const faceMapB = new Array(6).fill(texB);

  const matsVisible = new Array(6);
  for (let i=0;i<6;i++){
    matsVisible[i] = makeMixMaterial(faceMapA[i], faceMapB[i], mixUniform);
  }

  const invisible = new THREE.MeshStandardMaterial({ transparent:true, opacity:0.0, depthWrite:false });

  const img = new Image();
  img.decoding = "async";
  img.src = sheetUrl;

  const src = {
    url: sheetUrl,
    img,
    frameW, frameH,
    frames: 1,
    ready: false,
    ctxA, ctxB,
    texA, texB,
    faceMapA, faceMapB,
    matsVisible,
    invisible,
    mixUniform,
    _t: 0,
    _aFrame: 0,
    _bFrame: 1,
  };

  img.onload = ()=>{
    src.frames = Math.max(1, Math.floor(img.height / frameH));
    src._aFrame = 0;
    src._bFrame = (src.frames>1) ? 1 : 0;

    drawFrame(src.ctxA, img, src._aFrame, frameW, frameH);
    drawFrame(src.ctxB, img, src._bFrame, frameW, frameH);
    src.texA.needsUpdate = true;
    src.texB.needsUpdate = true;

    src.ready = true;
  };
  img.onerror = (e)=>{
    console.error("Failed to load lights sheet:", sheetUrl, e);
    src.ready = false;
  };

  LIGHT_CACHE.set(sheetUrl, src);
  return src;
}

function stepLightSource(src, dt, speed=1.0){
  if (!src.ready || src.frames <= 1) return;
  // Crossfade A -> B over 1.0s (scaled by speed). When completed, advance frames.
  src._t += dt * speed;
  const t = src._t;
  const phase = t % 1.0;
  src.mixUniform.value = phase;

  if (t >= 1.0){
    src._t = 0;
    src._aFrame = src._bFrame;
    src._bFrame = (src._bFrame + 1) % src.frames;
    drawFrame(src.ctxA, src.img, src._aFrame, src.frameW, src.frameH);
    drawFrame(src.ctxB, src.img, src._bFrame, src.frameW, src.frameH);
    src.texA.needsUpdate = true;
    src.texB.needsUpdate = true;
  }
}

// -----------------------------
// Main
// -----------------------------
(async function main(){
  // Basic page setup
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.body.style.background = "#000";

  const dbg = makeDebugUI();

  // Scene / camera / renderer
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070707);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(11, 11, 13);

  const renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // Ensure correct color management for textured materials
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.addEventListener("change", () => { requestRender(); });
  // --- Wheel zoom tuning (mouse wheel) ---
  controls.zoomSpeed = 0.25;
  controls.minDistance = 4;
  controls.maxDistance = 180;

  // Prevent page scroll while the pointer is over the canvas.
  renderer.domElement.addEventListener("wheel", (e) => { e.preventDefault(); }, { passive: false });

  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.target.set(0,0,0);
  controls.update();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x101010, 0.8);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(7, 10, 6);
  scene.add(dir);

  // Groups
  const worldGroup = new THREE.Group();
  worldGroup.name = "world";
  scene.add(worldGroup);

  // Settings (toggles)
  let PURE_AE2 = true;        // always true in this rebuild (kept for UI compatibility)
  let LIGHTS_ENABLED = false;
  let ANIM_ENABLED = false;
  let WIREFRAME = false;
  let LABELS_ENABLED = false;
  let MATERIAL_MODE = "ae2";  // "ae2" | "uv" | "faces"

  const cbPure = dbg.mkToggle("Pure AE2", PURE_AE2, (v)=>{ PURE_AE2=v; rebuildWorld();   if (ANIM_ENABLED) { __startAnimLoop(); } else { requestRender(); }
});
  cbPure.disabled = true; // by design in clean rebuild; no legacy mode.
  const cbLights = dbg.mkToggle("Lights", LIGHTS_ENABLED, (v)=>{ LIGHTS_ENABLED=v; rebuildWorld(); });
  const cbAnim = dbg.mkToggle("Anim", ANIM_ENABLED, (v)=>{ ANIM_ENABLED = v; if (ANIM_ENABLED) { __startAnimLoop(); } else { __stopAnimLoop(); requestRender(); } });
  const cbWire = dbg.mkToggle("Wire", WIREFRAME, (v)=>{ WIREFRAME=v; rebuildWorld(); });
  const cbLabels = dbg.mkToggle("Labels", LABELS_ENABLED, (v)=>{ LABELS_ENABLED=v; rebuildWorld(); });

  dbg.mkSelect("Material", [
    { value:"ae2", label:"AE2 textures" },
    { value:"uv", label:"UV test" },
    { value:"faces", label:"Face colors" },
  ], (v)=>{ MATERIAL_MODE=v; console.log("[UI] Material=", v); rebuildWorld(); });

  // Raycast pick
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let pickInfo = null;
  renderer.domElement.addEventListener("pointerdown", (ev)=>{
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(worldGroup.children, true);
    if (!hits.length){
      pickInfo = null;
      dbg.pickText.textContent = "Pick: none";
      return;
    }
    // find top-level block group
    let o = hits[0].object;
    while (o && o.parent && o.parent !== worldGroup) o = o.parent;
    if (!o || !o.userData || !o.userData.block) {
      pickInfo = null;
      dbg.pickText.textContent = "Pick: none";
      return;
    }
    pickInfo = o.userData.block;
    dbg.pickText.textContent = `Pick: (${pickInfo.x},${pickInfo.y},${pickInfo.z}) type=${pickInfo.type} rot=(${pickInfo.rx.toFixed(2)},${pickInfo.ry.toFixed(2)},${pickInfo.rz.toFixed(2)})`;
    console.log("[PICK]", pickInfo);
  });

  // Texture loader with status list
  const texLoader = new THREE.TextureLoader();
  const texStatus = new Map(); // url -> {status, err?}

  function setTexStatus(url, status, err){
    texStatus.set(url, { status, err });
    renderTexList();
  }
  function renderTexList(){
    dbg.texList.innerHTML = "";
    for (const [url, info] of texStatus.entries()){
      const row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:space-between;gap:8px";
      const left = document.createElement("div");
      left.textContent = url;
      left.style.cssText = "max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.95";
      const right = document.createElement("div");
      right.textContent = info.status;
      right.style.cssText = info.status === "ok" ? "color:#b8ffb8" : info.status === "loading" ? "color:#ffeaa7" : "color:#ff9b9b";
      row.appendChild(left);
      row.appendChild(right);
      dbg.texList.appendChild(row);
    }
  }

  async function loadTexture(url){
    setTexStatus(url, "loading");
    return await new Promise((resolve)=>{
      texLoader.load(url, (tex)=>{
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        setTexStatus(url, "ok");
        resolve(tex);
      }, undefined, (err)=>{
        setTexStatus(url, "error", err);
        resolve(null);
      });
    });
  }

  // UV test / Face colors
  function makeUVTestTexture(){
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#111"; ctx.fillRect(0,0,c.width,c.height);
    ctx.strokeStyle = "#666";
    for (let i=0;i<=8;i++){
      const p = i*16;
      ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,128); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,p); ctx.lineTo(128,p); ctx.stroke();
    }
    ctx.fillStyle = "#fff";
    ctx.font = "14px ui-monospace,Consolas,monospace";
    ctx.fillText("U→", 8, 20);
    ctx.fillText("V↓", 8, 40);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  const uvTestTex = makeUVTestTexture();
  const faceColorTex = (()=> {
    // not needed; we'll use per-face solid materials
    return null;
  })();

  // Load base textures
  const [texBlock, texColumn, texInsideA, texInsideB] = await Promise.all([
    loadTexture(TEX.block),
    loadTexture(TEX.column),
    loadTexture(TEX.inside_a),
    loadTexture(TEX.inside_b),
  ]);

  // Lights (sprite sheets) - loaded via Image, still show status.
  function preflightImage(url){
    setTexStatus(url, "loading");
    return new Promise((resolve)=>{
      const img = new Image();
      img.decoding = "async";
      img.onload = ()=> { setTexStatus(url, "ok"); resolve(true); };
      img.onerror = ()=> { setTexStatus(url, "error"); resolve(false); };
      img.src = url;
    });
  }
  await Promise.all([
    preflightImage(TEX.block_l),
    preflightImage(TEX.column_l),
    preflightImage(TEX.inside_a_l),
    preflightImage(TEX.inside_b_l),
  ]);

  // Shared geometry
  const geom = makeMCBoxGeometry(1.0);

  // Base materials (created from loaded textures)
  function baseMaterialFromTexture(tex){
    if (!tex) {
      // fallback to obvious error material
      return new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe:WIREFRAME, side: THREE.DoubleSide });
    }
    return new THREE.MeshBasicMaterial({ map: tex, wireframe:WIREFRAME, side: THREE.DoubleSide });
  }

  const invisibleMat = new THREE.MeshBasicMaterial({ transparent:true, opacity:0.0, depthWrite:false, side: THREE.DoubleSide });

  // Labels
  function makeLabel(text){
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.clearRect(0,0,128,128);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0,0,128,128);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px ui-sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent:true });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(0.8,0.8,0.8);
    return sp;
  }

  // Build placed set once
  const placed = buildPlacedSet();

  // Light sources per type
  const lightSrcByType = {
    block:     makeLightSource(TEX.block_l),
    column:    makeLightSource(TEX.column_l),
    inside_a:  makeLightSource(TEX.inside_a_l),
    inside_b:  makeLightSource(TEX.inside_b_l),
  };

  // World rebuild
  function clearGroup(g){
    // IMPORTANT: do not dispose shared geometry/material on UI toggles.
    // Disposing the shared Box/MC geometry causes meshes to become invisible after the first rebuild.
    while (g.children.length){
      const c = g.children.pop();
      if (c.parent) c.parent.remove(c);
    }
  }

  function typeToBaseTexture(type){
    if (type === "column_x" || type === "column_y" || type === "column_z") return texColumn;
    if (type === "inside_a") return texInsideA;
    if (type === "inside_b") return texInsideB;
    return texBlock;
  }

  function typeToLightSource(type){
    if (type === "column_x" || type === "column_y" || type === "column_z") return lightSrcByType.column;
    if (type === "inside_a") return lightSrcByType.inside_a;
    if (type === "inside_b") return lightSrcByType.inside_b;
    return lightSrcByType.block;
  }

  function makeFaceColorMats(){
    const mk = (c)=> new THREE.MeshBasicMaterial({ color:c, wireframe:WIREFRAME, side: THREE.DoubleSide });
    const m = new Array(6);
    m[FACE_RIGHT] = mk(0xff5555);
    m[FACE_LEFT]  = mk(0x55ff55);
    m[FACE_TOP]   = mk(0x5555ff);
    m[FACE_BOTTOM]= mk(0xffff55);
    m[FACE_FRONT] = mk(0xff55ff);
    m[FACE_BACK]  = mk(0x55ffff);
    return m;
  }

  function buildMaterialsForBlock(x,y,z,type){
    // Base: 6 materials, default same; apply special rot90 by cloning texture.
    let baseMats;
    if (MATERIAL_MODE === "uv"){
      const mat = baseMaterialFromTexture(uvTestTex);
      baseMats = new Array(6).fill(mat);
    } else if (MATERIAL_MODE === "faces"){
      baseMats = makeFaceColorMats();
    } else {
      const baseTex = typeToBaseTexture(type);
      // For special rot90, create per-face material only when needed; otherwise share one.
      const sharedMat = baseMaterialFromTexture(baseTex);
      baseMats = new Array(6).fill(sharedMat);
      for (let f=0; f<6; f++){
        if (!needsRot90ForFace(x,y,z,f)) continue;
        if (!baseTex) continue;
        const t = rotateTexture90(baseTex);
        baseMats[f] = baseMaterialFromTexture(t);
      }
    }

    // Lights: 6 materials, default from light source; apply special rot90 by rotating BOTH texA/texB (via clone) per face.
    let lightMats = null;
    if (LIGHTS_ENABLED && MATERIAL_MODE === "ae2"){
      const src = typeToLightSource(type);
      // Use src mats but clone and apply rot90 when needed.
      lightMats = new Array(6);
      for (let f=0; f<6; f++){
        // if face should be invisible (interior), we still draw but it's ok; for now we always show as in AE2 demo.
        if (!needsRot90ForFace(x,y,z,f)){
          lightMats[f] = src.matsVisible[f];
        } else {
          // Create a one-off mixed mat with rotated textures, sharing mix uniform.
          const tA = rotateTexture90(src.faceMapA[f]);
          const tB = rotateTexture90(src.faceMapB[f]);
          const m = makeMixMaterial(tA, tB, src.mixUniform);
          lightMats[f] = m;
        }
        lightMats[f].wireframe = WIREFRAME;
      }
    }
    return { baseMats, lightMats };
  }

  function applyBlockRotation(group, type){
    // Column direction by mesh rotation only
    group.rotation.set(0,0,0);
    if (type === "column_y") return;
    if (type === "column_z"){
      group.rotation.x = ROT_90;
      return;
    }
    if (type === "column_x"){
      group.rotation.x = ROT_90;
      group.rotation.y = ROT_90;
      return;
    }
  }

  function rebuildWorld(){
    const __t0 = safeNowMs();
    clearGroup(worldGroup);

    const faceMatsCache = null; // not used; per block computed
    for (let y=0; y<GRID; y++){
      for (let z=0; z<GRID; z++){
        for (let x=0; x<GRID; x++){
          if (!placed.has(posKey(x,y,z))) continue;

          const type = classifyType(x,y,z, placed);

          const g = new THREE.Group();
          g.position.set((x*SPACING)-OFFSET, (y*SPACING)-OFFSET, (z*SPACING)-OFFSET);
          applyBlockRotation(g, type);

          const { baseMats, lightMats } = buildMaterialsForBlock(x,y,z,type);

          const baseMesh = new THREE.Mesh(geom, baseMats);
          g.add(baseMesh);

          if (LIGHTS_ENABLED && lightMats){
            // Slightly larger to prevent z-fighting
            const lightMesh = new THREE.Mesh(geom, lightMats);
            lightMesh.scale.set(1.002, 1.002, 1.002);
            g.add(lightMesh);
          }

          if (LABELS_ENABLED){
            const sp = makeLabel(`${x},${y},${z}`);
            sp.position.set(0, 0.7, 0);
            g.add(sp);
          }

          g.userData.block = {
            x,y,z,type,
            rx: g.rotation.x, ry: g.rotation.y, rz: g.rotation.z,
          };

          worldGroup.add(g);
        }
      }
    }
  }

  rebuildWorld();
  // show block count immediately
  try { dbg.pickText.textContent = `Pick: none (blocks=${worldGroup.children.length})`; } catch(e) {}
  // ---- DevTools exposure (module scope -> window) ----
  // This is required because ES modules do not create global variables; without this, `scene` / `rebuildWorld`
  // are `undefined` in the console. Expose minimal handles for fact-based debugging.
  window.__cube7x7x7 = {
    scene, camera, renderer, controls,
    worldGroup,
    get settings(){ return { LIGHTS_ENABLED, ANIM_ENABLED, WIREFRAME, LABELS_ENABLED, MATERIAL_MODE }; },
    rebuildWorld,
  };
  // Convenience aliases
  window.scene = scene;
  window.rebuildWorld = rebuildWorld;
  window.worldGroup = worldGroup;


  // Resize
  window.addEventListener("resize", ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Animation loop
  let last = safeNowMs();
  // ---- Performance: cap animation FPS + stop loop when not needed ----
  const __ANIM_FPS_CAP = 30;
  const __MIN_FRAME_MS = 1000 / __ANIM_FPS_CAP;
  let __animRaf = null;
  let __lastFrameMs = 0;

  function __startAnimLoop(){
    if (__animRaf != null) return;
    __lastFrameMs = 0;
    __animRaf = __animRaf = requestAnimationFrame(tick);
  }
  function __stopAnimLoop(){
    if (__animRaf == null) return;
    cancelAnimationFrame(__animRaf);
    __animRaf = null;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) __stopAnimLoop();
    else if (ANIM_ENABLED) __startAnimLoop();
  });

  // Render-on-demand when animation is OFF
  let __renderRequested = false;
  function requestRender(){
    if (__renderRequested) return;
    __renderRequested = true;
    requestAnimationFrame(() => {
      __renderRequested = false;
      renderer.render(scene, camera);
    });
  }

  function tick(t){
    // Stop continuous rendering unless animation is enabled and tab is visible
    if (!ANIM_ENABLED || document.hidden){
      __stopAnimLoop();
      requestRender();
      return;
    }
    if (!t) t = performance.now();
    if (__lastFrameMs && (t - __lastFrameMs) < __MIN_FRAME_MS){
      __animRaf = __animRaf = requestAnimationFrame(tick);
      return;
    }
    __lastFrameMs = t;

    requestAnimationFrame(tick);
    controls.update();

    const now = safeNowMs();
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;

    if (ANIM_ENABLED && LIGHTS_ENABLED){
      // advance all light sheets
      stepLightSource(lightSrcByType.block, dt, 1.0);
      stepLightSource(lightSrcByType.column, dt, 1.0);
      stepLightSource(lightSrcByType.inside_a, dt, 1.0);
      stepLightSource(lightSrcByType.inside_b, dt, 1.0);
    }
    renderer.render(scene, camera);
  }
  tick();
})().catch((e)=>{
  console.error(e);
  const pre = document.createElement("pre");
  pre.style.cssText = "position:fixed;inset:0;background:#000;color:#ffb4b4;white-space:pre-wrap;padding:12px;margin:0;z-index:99999;overflow:auto;font:12px/1.4 ui-monospace,Consolas,monospace";
  pre.textContent = String(e?.stack || e);
  document.body.appendChild(pre);
});

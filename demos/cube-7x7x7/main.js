// demos/cube-7x7x7/main.js（このファイルを全文置き換え）

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

function fatal(e) {
  console.error(e);
  const pre = document.createElement("pre");
  pre.style.cssText =
    "position:fixed;inset:0;white-space:pre-wrap;word-break:break-word;margin:0;padding:12px;" +
    "background:#0b0b0b;color:#ffb4b4;font:12px/1.4 ui-monospace,Consolas,monospace;z-index:9999;overflow:auto;";
  pre.textContent = String(e?.stack || e);
  document.body.appendChild(pre);
}

try {
  // -------------------------------
  // Scene
  // -------------------------------
  const scene = new THREE.Scene();

  // -------------------------------
  // Layer groups (1..7) + Compass group (toggleable)
  // -------------------------------
  const layerGroups = Array.from({ length: 7 }, (_, i) => {
    const g = new THREE.Group();
    g.name = `layer-${i + 1}`;
    return g;
  });
  for (const g of layerGroups) scene.add(g);

  const compassGroup = new THREE.Group();
  compassGroup.name = "compass";
  scene.add(compassGroup);
  scene.background = new THREE.Color(0x0b0b0b);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(11.0, 11.0, 13.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);
  controls.update();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x202020, 0.8));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(6, 10, 6);
  scene.add(dir);

  // -------------------------------
  // Hollow 3×3×3 shell layout
  // -------------------------------
    const GRID_SIZE = 7;
  const SPACING = 1.0;
  const OFFSET = (GRID_SIZE - 1) * 0.5 * SPACING; // 3.0

  // -------------------------------
  // Layout: 7×7, Layers 1–7 (top-down numbering 1..49, 4番側が北)
// - Layer 1: blocks exist except blanks {4, 9, 13, 18, 22, 24, 25, 26, 28, 32, 37, 41, 46}
// - Layer 2: blocks exist at {1, 3, 4, 5, 7, 15, 17, 18, 19, 21, 22, 24, 26, 28, 29, 31, 32, 33, 35, 43, 45, 46, 47, 49}
// - Layer 3: same as Layer 1
// - Layer 4: blocks exist at {2, 6, 8, 10, 12, 14, 16, 20, 30, 34, 36, 38, 40, 42, 44, 48}
// - Layer 5: same as Layer 1
// - Layer 6: same as Layer 2
// - Layer 7: same as Layer 1
// Y mapping (7-high world): layer1->y=6 ... layer7->y=0
// -------------------------------
  const layer1Blanks = new Set([4, 9, 13, 18, 22, 24, 25, 26, 28, 32, 37, 41, 46]);
  const layer2Filled = new Set([1, 3, 4, 5, 7, 15, 17, 18, 19, 21, 22, 24, 26, 28, 29, 31, 32, 33, 35, 43, 45, 46, 47, 49]);
  const layer4Filled = new Set([2, 6, 8, 10, 12, 14, 16, 20, 30, 34, 36, 38, 40, 42, 44, 48]);

  const key = (x, y, z) => `${x},${y},${z}`;
  const placed = new Set();

  function idxToXZ(idx) {
    const row = Math.floor((idx - 1) / GRID_SIZE); // 0..6 (north->south)
    const col = (idx - 1) % GRID_SIZE;             // 0..6 (west->east)
    return { x: col, z: row };
  }

  function placeLayerFromRule(y, isFilledFn) {
    for (let idx = 1; idx <= GRID_SIZE * GRID_SIZE; idx++) {
      if (!isFilledFn(idx)) continue;
      const { x, z } = idxToXZ(idx);
      placed.add(key(x, y, z));
    }
  }

  // Layer 1 (y=6): filled when NOT blank
  placeLayerFromRule(6, (idx) => !layer1Blanks.has(idx));
  // Layer 2 (y=5): filled when listed
  placeLayerFromRule(5, (idx) => layer2Filled.has(idx));
  // Layer 3 (y=4): same as Layer 1
  placeLayerFromRule(4, (idx) => !layer1Blanks.has(idx));
  // Layer 4 (y=3): filled when listed
  placeLayerFromRule(3, (idx) => layer4Filled.has(idx));
  // Layer 5 (y=2): same as Layer 1
  placeLayerFromRule(2, (idx) => !layer1Blanks.has(idx));
  // Layer 6 (y=1): same as Layer 2
  placeLayerFromRule(1, (idx) => layer2Filled.has(idx));
  // Layer 7 (y=0): same as Layer 1
  placeLayerFromRule(0, (idx) => !layer1Blanks.has(idx));

  const hasBlock = (x, y, z) => placed.has(key(x, y, z));
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

  // base
  const texBlockBase = loadTex("../hollow-3x3x3/assets/controller_powered.png");
  const texColumnBase = loadTex("../hollow-3x3x3/assets/controller_column_powered.png");

  // lights sheets
  const LIGHT_SHEET_BLOCK_URL = "../hollow-3x3x3/assets/controller_lights.png";
  const LIGHT_SHEET_COLUMN_URL = "../hollow-3x3x3/assets/controller_column_lights.png";

  // inside
  const texInsideA = loadTex("../hollow-3x3x3/assets/controller_inside_a_powered.png");
  const texInsideB = loadTex("../hollow-3x3x3/assets/controller_inside_b_powered.png");

  // -------------------------------
  // Geometry / Face indices (BoxGeometry order)
  // [right, left, top, bottom, front, back]
  // -------------------------------
  const baseGeo = new THREE.BoxGeometry(1, 1, 1);
  const insideGeo = new THREE.BoxGeometry(0.92, 0.92, 0.92);

  const FACE_RIGHT = 0, FACE_LEFT = 1, FACE_TOP = 2, FACE_BOTTOM = 3, FACE_FRONT = 4, FACE_BACK = 5;

  // -------------------------------
  // AE2-like connectivity rules
  // -------------------------------

  // Sandwiched on axis => column_axis
  // Sandwiched on 2+ axes => inside (A/B parity)
  // else => block
  function classifyType(x, y, z) {
    const sx = hasBlock(x - 1, y, z) && hasBlock(x + 1, y, z);
    const sy = hasBlock(x, y - 1, z) && hasBlock(x, y + 1, z);
    const sz = hasBlock(x, y, z - 1) && hasBlock(x, y, z + 1);

    const count = (sx ? 1 : 0) + (sy ? 1 : 0) + (sz ? 1 : 0);
    if (count >= 2) return "inside";
    if (sx) return "column_x";
    if (sy) return "column_y";
    if (sz) return "column_z";
    return "block";
  }

  // 任意の連続3ブロックがあれば、その軸方向に「引っ張られる」扱い（端も含む）
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
    if (count >= 2) return null; // inside/ambiguous
    if (x3) return "x";
    if (y3) return "y";
    if (z3) return "z";
    return null;
  }

  // 上下面（立方体の上の面・下の面）の向きを “列方向” に合わせるための回転
  // X方向に引っ張る: 90deg
  // Z方向に引っ張る: 0deg
  // Y方向: ここでは回転不要（column_y時はモデル回転で表現）
  function topBottomRotationFor(pullAxis) {
    if (pullAxis === "x") return Math.PI / 2;
    if (pullAxis === "z") return 0;
    return null;
  }

  // -------------------------------
  // Materials
  // -------------------------------
  const BASE_EMISSIVE = 0.45;
  const INSIDE_EMISSIVE = 0.75;

  function makeBaseMaterials(baseTexture, topBottomRotation) {
    const makeMat = (t) =>
      new THREE.MeshStandardMaterial({
        map: t,
        emissiveMap: t,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: BASE_EMISSIVE,
      });

    const mats = Array(6).fill(null).map(() => makeMat(baseTexture));

    if (topBottomRotation != null) {
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

  // -------------------------------
  // Lights (sprite-sheet -> canvas textures -> crossfade)
  // -------------------------------
  const W = 16, H = 16;

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

  function drawFrame(ctx, img, idx) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, 0, idx * H, W, H, 0, 0, W, H);
  }

  function makeLightsLayer(sheetUrl, topBottomRotation) {
    const canvasA = document.createElement("canvas");
    const canvasB = document.createElement("canvas");
    canvasA.width = W; canvasA.height = H;
    canvasB.width = W; canvasB.height = H;

    const ctxA = canvasA.getContext("2d");
    const ctxB = canvasB.getContext("2d");

    const texA = mkCanvasTex(canvasA, null);
    const texB = mkCanvasTex(canvasB, null);
    const texA_tb = topBottomRotation != null ? mkCanvasTex(canvasA, topBottomRotation) : null;
    const texB_tb = topBottomRotation != null ? mkCanvasTex(canvasB, topBottomRotation) : null;

    const makeLightMat = (t) =>
      new THREE.MeshStandardMaterial({
        map: t,
        transparent: true,
        opacity: 0.0,
        emissiveMap: t,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 2.0,
        depthWrite: false,
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
    meshA.scale.setScalar(1.001);
    meshB.scale.setScalar(1.001);

    const img = new Image();
    img.decoding = "async";
    img.src = sheetUrl;

    const layer = {
      sheetUrl,
      img,
      frames: 1,
      ready: false,
      ctxA, ctxB,
      texA, texB, texA_tb, texB_tb,
      matsA, matsB,
      meshA, meshB,
      topBottomRotation,
    };

    img.onload = () => {
      layer.frames = Math.max(1, Math.floor(img.height / H));
      drawFrame(layer.ctxA, img, 0);
      layer.texA.needsUpdate = true;
      if (layer.texA_tb) layer.texA_tb.needsUpdate = true;

      drawFrame(layer.ctxB, img, 1 % layer.frames);
      layer.texB.needsUpdate = true;
      if (layer.texB_tb) layer.texB_tb.needsUpdate = true;

      layer.ready = true;
    };

    img.onerror = (e) => {
      console.error("Failed to load lights sheet:", sheetUrl, e);
      layer.ready = false;
    };

    return layer;
  }

  // -------------------------------
  // Build instances
  // -------------------------------
  function makeInstance(x, y, z) {
    const type = classifyType(x, y, z);

    const pullAxis = pullAxisFor(x, y, z);
    const topBottomRotation = topBottomRotationFor(pullAxis);

    const isColumn = type.startsWith("column");
    const baseTex = isColumn ? texColumnBase : texBlockBase;

    const baseMats = makeBaseMaterials(baseTex, topBottomRotation);
    const baseMesh = new THREE.Mesh(baseGeo, baseMats);

    // lights
    const sheetUrl = isColumn ? LIGHT_SHEET_COLUMN_URL : LIGHT_SHEET_BLOCK_URL;
    const lights = makeLightsLayer(sheetUrl, topBottomRotation);

    // inside overlay (only for inside)
    let insideMesh = null;
    if (type === "inside") {
      const parity = (x + y + z) & 1;
      const tex = parity ? texInsideA : texInsideB;
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: INSIDE_EMISSIVE,
      });
      insideMesh = new THREE.Mesh(insideGeo, mat);
    }

    const group = new THREE.Group();
    group.add(baseMesh, lights.meshA, lights.meshB);
    if (insideMesh) group.add(insideMesh);

    // AE2-like rotations for column variants (model orientation)
    if (type === "column_z") {
      group.rotation.x = Math.PI / 2;
    } else if (type === "column_x") {
      group.rotation.x = Math.PI / 2;
      group.rotation.y = Math.PI / 2;
    }
    // column_y: no rotation

    group.position.set((x * SPACING) - OFFSET, (y * SPACING) - OFFSET, (z * SPACING) - OFFSET);

    return { x, y, z, type, group, lights };
  }

  const instances = [];
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        if (!hasBlock(x, y, z)) continue;
        const inst = makeInstance(x, y, z);
          const layerIndex =
    (y === 6) ? 0 :
    (y === 5) ? 1 :
    (y === 4) ? 2 :
    (y === 3) ? 3 :
    (y === 2) ? 4 :
    (y === 1) ? 5 :
    (y === 0) ? 6 :
    -1;
  if (layerIndex >= 0) layerGroups[layerIndex].add(inst.group);
  else scene.add(inst.group);
instances.push(inst);
      }
    }
  }

  // -------------------------------
  // Debug: world compass labels inside the 3D scene (北/東/南/西)
  // -------------------------------
  function makeCompassSprite(label) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // background
    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.stroke();

    // text
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "800 56px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, size / 2, size / 2 + 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;

    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    mat.depthTest = false;   // keep readable even if behind blocks
    mat.depthWrite = false;

    const spr = new THREE.Sprite(mat);
    spr.renderOrder = 9999;
    spr.scale.set(0.9, 0.9, 0.9);
    return spr;
  }

  function addWorldCompassLabels() {
    if (!instances.length) return;

    const box = new THREE.Box3();
    for (const inst of instances) box.expandByObject(inst.group);

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const margin = Math.max(size.x, size.z) * 0.20 + 0.35;

    const north = makeCompassSprite("北"); // -Z
    const south = makeCompassSprite("南"); // +Z
    const west  = makeCompassSprite("西"); // -X
    const east  = makeCompassSprite("東"); // +X

    // place at mid-height, outside each side
    const y = center.y;

    // ---- Rotation hotfix (block-wise, applied per 3×3 sub-cube) ----
    // Same approach as the completed 3×3×3 demo:
    // rotate the 4 'edge-center' blocks (x=mid within the 3×3, z=min/max, y=min/max) by +90°.
    // Here, the pattern exists in 4 corners of the 7×7 grid: (0..2,0..2), (4..6,0..2), (0..2,4..6), (4..6,4..6).
    const rotateMatTexture = (mat, delta) => {
      if (!mat) return;

      const tex = mat.map || mat.emissiveMap || null;
      if (!tex) return;

      const isCanvasTex =
        !!tex.isCanvasTexture ||
        (tex.image &&
          (tex.image instanceof HTMLCanvasElement || tex.image?.tagName === "CANVAS"));

      if (isCanvasTex) {
        tex.center?.set(0.5, 0.5);
        tex.rotation = (tex.rotation || 0) + delta;
        tex.needsUpdate = true;
        mat.needsUpdate = true;
        return;
      }

      const base = tex;
      const t = base.clone();
      t.center.set(0.5, 0.5);
      t.rotation = (base.rotation || 0) + delta;
      t.needsUpdate = true;

      if (mat.map) mat.map = t;
      if ("emissiveMap" in mat && mat.emissiveMap) mat.emissiveMap = t;
      mat.needsUpdate = true;
    };

    const rotateAllFacesInMesh = (mesh, delta) => {
      if (!mesh || !mesh.material) return;

      const seenCanvas = new Set();

      const rotateOne = (mat) => {
        if (!mat) return;
        const tex = mat.map || mat.emissiveMap || null;
        if (!tex) return;

        const isCanvasTex =
          !!tex.isCanvasTexture ||
          (tex.image &&
            (tex.image instanceof HTMLCanvasElement || tex.image?.tagName === "CANVAS"));

        if (isCanvasTex) {
          if (seenCanvas.has(tex)) return;
          seenCanvas.add(tex);
        }
        rotateMatTexture(mat, delta);
      };

      if (Array.isArray(mesh.material) && mesh.material.length >= 6) {
        for (let fi = 0; fi < 6; fi++) rotateOne(mesh.material[fi]);
      } else {
        rotateOne(mesh.material);
      }
    };

    const rotateBlockTextures = (group, delta) => {
      if (!group) return;
      group.traverse((obj) => {
        if (obj && obj.isMesh) rotateAllFacesInMesh(obj, delta);
      });
    };

    const findInst = (x, y, z) =>
      instances.find(
        (i) =>
          i &&
          typeof i.x === "number" &&
          typeof i.y === "number" &&
          typeof i.z === "number" &&
          Math.abs(i.x - x) < 1e-6 &&
          Math.abs(i.y - y) < 1e-6 &&
          Math.abs(i.z - z) < 1e-6
      );

    const Q = Math.PI / 2;

    // 4 corner 3×3 sub-cubes in 7×7 grid
    const corners = [
      { x0: 0, z0: 0 },
      { x0: 4, z0: 0 },
      { x0: 0, z0: 4 },
      { x0: 4, z0: 4 },
    ];

    const applyHotfixForYRange = (minY, maxY) => {
      for (const c of corners) {
        const midX = c.x0 + 1;
        const minZ = c.z0;
        const maxZ = c.z0 + 2;

        const targets = [
          { x: midX, y: maxY, z: minZ },
          { x: midX, y: minY, z: minZ },
          { x: midX, y: maxY, z: maxZ },
          { x: midX, y: minY, z: maxZ },
        ];

        for (const t of targets) {
          const inst = findInst(t.x, t.y, t.z);
          if (inst) rotateBlockTextures(inst.group, Q);
        }
      }
    };

    // Top 3 layers (1..3): y=6,5,4
    applyHotfixForYRange(4, 6);
    // Bottom 3 layers (5..7): y=2,1,0
    applyHotfixForYRange(0, 2);

    }


    north.position.set(center.x, y, box.min.z - margin);
    south.position.set(center.x, y, box.max.z + margin);
    west.position.set(box.min.x - margin, y, center.z);
    east.position.set(box.max.x + margin, y, center.z);

    compassGroup.add(north, south, west, east);
  }

  addWorldCompassLabels();

  // -------------------------------
  // UI: Layer visibility + Compass toggle
  // -------------------------------
  function createVisibilityPanel() {
    const panel = document.createElement("div");
    panel.id = "visibility-panel";
    panel.style.cssText = [
      "position:fixed",
      "right:12px",
      "top:12px",
      "z-index:10000",
      "padding:10px 12px",
      "border-radius:12px",
      "background:rgba(0,0,0,.55)",
      "color:#fff",
      "font:12px/1.3 system-ui,-apple-system,Segoe UI,sans-serif",
      "backdrop-filter: blur(4px)",
      "pointer-events:auto",
      "user-select:none"
    ].join(";");

    const title = document.createElement("div");
    title.textContent = "表示切替";
    title.style.cssText = "font-weight:700;margin-bottom:8px;";
    panel.appendChild(title);

    const mkRow = (labelText, checked, onChange) => {
      const row = document.createElement("label");
      row.style.cssText = "display:flex;align-items:center;gap:8px;margin:6px 0;cursor:pointer;";

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = checked;
      cb.addEventListener("change", () => onChange(cb.checked));

      const txt = document.createElement("span");
      txt.textContent = labelText;

      row.appendChild(cb);
      row.appendChild(txt);
      return row;
    };

    // Layers 1..7
    for (let i = 0; i < 7; i++) {
      const initial = true; // layers 1..7
      layerGroups[i].visible = initial;
      panel.appendChild(
        mkRow(`Layer ${i + 1}`, initial, (v) => (layerGroups[i].visible = v))
      );
    }

    // Compass
    compassGroup.visible = true;
    panel.appendChild(document.createElement("hr")).style.cssText =
      "border:none;border-top:1px solid rgba(255,255,255,.18);margin:10px 0;";

    panel.appendChild(
      mkRow("Compass", true, (v) => (compassGroup.visible = v))
    );

    document.body.appendChild(panel);
  }

  createVisibilityPanel();

  // -------------------------------
  // Animate lights
  // -------------------------------
  let t = 0;
  let frameA = 0;
  let frameB = 1;

  function smoothstep(x) {
    return x * x * (3 - 2 * x);
  }

  function updateLights(dt) {
    t += dt;

    const cycleSeconds = 0.18; // ここを速くしたければ小さく
    const phase = (t % cycleSeconds) / cycleSeconds;
    const alpha = smoothstep(phase);

    // advance frames at cycle boundary
    if (phase < (dt / cycleSeconds)) {
      frameA++;
      frameB = frameA + 1;

      for (const inst of instances) {
        const l = inst.lights;
        if (!l.ready) continue;
        const a = frameA % l.frames;
        const b = frameB % l.frames;

        drawFrame(l.ctxA, l.img, a);
        l.texA.needsUpdate = true;
        if (l.texA_tb) l.texA_tb.needsUpdate = true;

        drawFrame(l.ctxB, l.img, b);
        l.texB.needsUpdate = true;
        if (l.texB_tb) l.texB_tb.needsUpdate = true;
      }
    }

    // apply crossfade
    for (const inst of instances) {
      const l = inst.lights;
      for (const m of l.matsA) m.opacity = (l.ready ? (1.0 - alpha) : 0.0);
      for (const m of l.matsB) m.opacity = (l.ready ? alpha : 0.0);
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
} catch (e) {
  fatal(e);
}

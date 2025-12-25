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

  // Render-on-demand helpers (used by wheel/UI handlers)
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.body.appendChild(renderer.domElement);
  // Picking for debug
  const __ray = new THREE.Raycaster();
  const __mouse = new THREE.Vector2();
  let __pickHelper = null;

  function __pickFromEvent(ev) {
    const rect = renderer.domElement.getBoundingClientRect();
    __mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    __mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    __ray.setFromCamera(__mouse, camera);

    // collect base meshes only
    const targets = [];
    for (const inst of (typeof instances !== "undefined" ? instances : [])) {
      if (inst?.baseMesh) targets.push(inst.baseMesh);
    }
    const hits = __ray.intersectObjects(targets, false);
    if (!hits.length) {
      window.__lastPick = null;
      __setPickText("Pick: none");
      if (__pickHelper) { scene.remove(__pickHelper); __pickHelper = null; }
      return;
    }
    const hit = hits[0];
    const inst = (typeof instances !== "undefined") ? instances.find(i => i.baseMesh === hit.object) : null;
    if (!inst) return;

    // build diagnostic
    const faceMask = [
      !hasBlock(inst.x + 1, inst.y, inst.z),
      !hasBlock(inst.x - 1, inst.y, inst.z),
      !hasBlock(inst.x, inst.y + 1, inst.z),
      !hasBlock(inst.x, inst.y - 1, inst.z),
      !hasBlock(inst.x, inst.y, inst.z + 1),
      !hasBlock(inst.x, inst.y, inst.z - 1),
    ];
    const diag = {
      x: inst.x, y: inst.y, z: inst.z,
      type: inst.type,
      rotX: inst.group.rotation.x,
      rotY: inst.group.rotation.y,
      rotZ: inst.group.rotation.z,
      faceMask,
      pureAE2: DEBUG_PURE_AE2,
      matMode: DEBUG_MAT_MODE,
    };
    window.__lastPick = diag;
    __setPickText(`Pick: (${diag.x},${diag.y},${diag.z})  ${diag.type}  rot(x,y)=(${diag.rotX.toFixed(2)},${diag.rotY.toFixed(2)})`);

    // helper
    if (__pickHelper) scene.remove(__pickHelper);
    __pickHelper = new THREE.BoxHelper(inst.group, 0xffffff);
    scene.add(__pickHelper);
    __requestRender();
  }

  renderer.domElement.addEventListener("click", (ev) => __pickFromEvent(ev));


  const controls = new OrbitControls(camera, renderer.domElement);
  
  // Controls tuning:
  // - disable panning to avoid "where did it go?" after zooming
  // - disable dolly-to-cursor behavior (trackpads can feel like drifting)
  // - set sane min/max distance and provide a reset button in UI
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.zoomSpeed = 0.25;
  controls.rotateSpeed = 0.55;
  controls.minDistance = 4.0;
  controls.maxDistance = 80.0;
  

  // Fine-grained zoom: disable OrbitControls' default wheel zoom and implement small-step dolly.
  controls.enableZoom = false;
  const __zoomBase = 1.00025; // smaller = finer zoom (trackpad-friendly)
  renderer.domElement.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      // Normalize: use magnitude but clamp per event (trackpads can emit huge deltas)
      const dy = e.deltaY;
      const mag = Math.min(240, Math.abs(dy));
      const factor = Math.pow(__zoomBase, mag);
      if (dy > 0) {
        // zoom out
        camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
      } else if (dy < 0) {
        // zoom in
        camera.position.sub(controls.target).multiplyScalar(1 / factor).add(controls.target);
      }
      // clamp distance
      const d = camera.position.distanceTo(controls.target);
      if (d < controls.minDistance) {
        camera.position.sub(controls.target).setLength(controls.minDistance).add(controls.target);
      } else if (d > controls.maxDistance) {
        camera.position.sub(controls.target).setLength(controls.maxDistance).add(controls.target);
      }
      controls.update();
      __requestRender();
    },
    { passive: false }
  );
controls.screenSpacePanning = false;
  if ("dollyToCursor" in controls) controls.dollyToCursor = false;
  // Touch: avoid 2-finger pan (use dolly+rotate)
  if (controls.touches && typeof THREE !== "undefined" && THREE.TOUCH && THREE.TOUCH.DOLLY_ROTATE != null) {
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  }
controls.enableDamping = true;
  controls.target.set(0, 0, 0);
  controls.update();

  controls.addEventListener('change', () => { if (!ANIM_ENABLED) __requestRender(); });
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
  // Debug Panel (always on for development)
  // -------------------------------
  let DEBUG_PURE_AE2 = true;          // Disable non-AE2 pull-axis/top-bottom UV hacks
  let DEBUG_MAT_MODE = "ae2";         // "ae2" | "uv" | "faces"
  let DEBUG_SHOW_LABELS = false;      // Coordinate/type labels (heavy)
  let DEBUG_SHOW_WIREFRAME = false;   // Wireframe overlay
  const __texStatus = new Map();      // name -> {url,state}

  let __debugEl = null;
  function __ensureDebugPanel() {
    if (__debugEl) return __debugEl;
    const el = document.createElement("div");
    el.style.cssText = [
      "position:fixed",
      "right:12px",
      "top:12px",
      "z-index:9999",
      "background:rgba(0,0,0,0.72)",
      "color:#fff",
      "font:12px/1.35 ui-monospace,Consolas,monospace",
      "padding:10px 12px",
      "border-radius:10px",
      "max-width:360px",
      "max-height:70vh",
      "overflow:auto",
      "box-shadow:0 8px 24px rgba(0,0,0,0.35)"
    ].join(";");
    el.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px;">cube-7x7x7 DEBUG</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
        <label style="white-space:nowrap;"><input id="dbg_pure" type="checkbox" checked> Pure AE2</label>
        <label style="white-space:nowrap;"><input id="dbg_lights" type="checkbox" checked> Lights</label>
        <label style="white-space:nowrap;"><input id="dbg_anim" type="checkbox" checked> Anim</label>
        <label style="white-space:nowrap;"><input id="dbg_wire" type="checkbox"> Wire</label>
        <label style="white-space:nowrap;"><input id="dbg_labels" type="checkbox"> Labels</label>
      </div>
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px;">
        <div style="white-space:nowrap;">Material</div>
        <select id="dbg_mat" style="flex:1;min-width:160px;">
          <option value="ae2">AE2 textures</option>
          <option value="uv">UV test</option>
          <option value="faces">Face colors</option>
        </select>
        <button id="dbg_dump" style="padding:3px 8px;">Dump pick</button>
      </div>
      <div id="dbg_pick" style="margin:6px 0 10px 0;color:#bff;">Pick: none</div>
      <div style="font-weight:700;margin:6px 0;">Textures</div>
      <div id="dbg_tex"></div>
      <div style="margin-top:10px;color:#ddd;">
        Click a block to inspect its (x,y,z), type, rotations, faceMask. If textures show error, check URL paths.
      </div>
    `;
    document.body.appendChild(el);
    __debugEl = el;

    const $ = (id) => el.querySelector(id);

    $("#dbg_pure").addEventListener("change", (e) => {
      DEBUG_PURE_AE2 = !!e.target.checked;
      __rebuildWorld();
    });
    $("#dbg_lights").addEventListener("change", (e) => {
      if (typeof LIGHTS_ENABLED !== "undefined") LIGHTS_ENABLED = !!e.target.checked;
      __applyVisibility();
      __requestRender();
    });
    $("#dbg_anim").addEventListener("change", (e) => {
      if (typeof ANIM_ENABLED !== "undefined") ANIM_ENABLED = !!e.target.checked;
      __requestRender();
    });
    $("#dbg_wire").addEventListener("change", (e) => {
      DEBUG_SHOW_WIREFRAME = !!e.target.checked;
      __applyMaterialMode();
      __requestRender();
    });
    $("#dbg_labels").addEventListener("change", (e) => {
      DEBUG_SHOW_LABELS = !!e.target.checked;
      __applyLabels();
      __requestRender();
    });
    $("#dbg_mat").addEventListener("change", (e) => {
      DEBUG_MAT_MODE = e.target.value;
      __applyMaterialMode();
      __requestRender();
    });
    $("#dbg_dump").addEventListener("click", () => {
      if (window.__lastPick) console.log("[Pick Dump]", window.__lastPick);
    });

    return el;
  }

  function __refreshDebugPanel() {
    const el = __ensureDebugPanel();
    const texEl = el.querySelector("#dbg_tex");
    const rows = [];
    for (const [name, s] of __texStatus.entries()) {
      const c = s.state === "ok" ? "#9f9" : (s.state === "error" ? "#f99" : "#ff9");
      rows.push(`<div style="display:flex;gap:8px;align-items:center;margin:2px 0;">
        <span style="width:10px;height:10px;border-radius:3px;background:${c};display:inline-block;"></span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${s.url}">${name}</span>
        <span style="opacity:0.85;">${s.state}</span>
      </div>`);
    }
    texEl.innerHTML = rows.join("") || `<div style="opacity:0.8;">(no texture loads yet)</div>`;
  }

  function __setPickText(text) {
    const el = __ensureDebugPanel();
    const pick = el.querySelector("#dbg_pick");
    pick.textContent = text;
  }

  // procedural UV test texture
  function __makeUVTestTexture() {
    const s = 256;
    const c = document.createElement("canvas");
    c.width = s; c.height = s;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#111"; ctx.fillRect(0,0,s,s);
    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    for (let i=0;i<=8;i++){
      const p = (s*i)/8;
      ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,p); ctx.lineTo(s,p); ctx.stroke();
    }
    // arrow U direction →
    ctx.strokeStyle = "rgba(0,255,255,0.9)";
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(40, s-40); ctx.lineTo(s-60, s-40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s-60, s-40); ctx.lineTo(s-85, s-55); ctx.lineTo(s-85, s-25); ctx.closePath(); ctx.fillStyle="rgba(0,255,255,0.9)"; ctx.fill();
    // arrow V direction ↑
    ctx.strokeStyle = "rgba(255,0,255,0.9)";
    ctx.beginPath(); ctx.moveTo(40, s-40); ctx.lineTo(40, 60); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40,60); ctx.lineTo(25,85); ctx.lineTo(55,85); ctx.closePath(); ctx.fillStyle="rgba(255,0,255,0.9)"; ctx.fill();
    // labels
    ctx.fillStyle="#fff"; ctx.font="bold 28px ui-monospace,Consolas,monospace";
    ctx.fillText("U→", 60, s-50);
    ctx.fillText("V↑", 10, 80);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapNearestFilter;
    return tex;
  }

// -------------------------------
  // Textures
  // -------------------------------
  const loader = new THREE.TextureLoader();

  function loadTex(url, label) {
    const name = label || url;
    __texStatus.set(name, { url, state: "loading" });
    __refreshDebugPanel();
    const t = loader.load(
      url,
      () => { __texStatus.set(name, { url, state: "ok" }); __refreshDebugPanel(); __requestRender(); },
      undefined,
      (err) => { console.error("Texture load failed:", url, err); __texStatus.set(name, { url, state: "error" }); __refreshDebugPanel(); }
    );
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
  let LIGHTS_ENABLED = true;
  let ANIM_ENABLED = true;
  let LIGHTS_FPS = 6; // reduced for performance

  // -------------------------------
    // OPT(A+B): single-mesh crossfade (shader patch) + shared sources (update once per sheet/rotation)
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

  // Patch MeshStandardMaterial to blend map(A) and mapB with a shared mixAlpha uniform.
  function makeCrossfadeLightMat(mapA, mapB, sharedMixAlpha, uvRot) {
    const mat = new THREE.MeshStandardMaterial({
      map: mapA,
      transparent: true,
      opacity: 1.0,
      emissiveMap: mapA,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 2.0,
      depthWrite: false,
    });

    mat.userData.__mixAlpha = sharedMixAlpha;
    mat.userData.__uvRot = uvRot || 0.0;

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.mapB = { value: mapB };
      shader.uniforms.mixAlpha = sharedMixAlpha;
      shader.uniforms.uvRot = { value: mat.userData.__uvRot };

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D mapB;\nuniform float mixAlpha;\nuniform float uvRot;\n\nvec2 __rotUv(vec2 uv, float a){\n  if(a==0.0) return uv;\n  uv -= vec2(0.5);\n  float s = sin(a);\n  float c = cos(a);\n  uv = mat2(c,-s,s,c) * uv;\n  uv += vec2(0.5);\n  return uv;\n}"
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
#ifdef USE_MAP
  vec2 __uvA = __rotUv( vMapUv, uvRot );
  vec4 texelColorA = texture2D( map, __uvA );
  vec4 texelColorB = texture2D( mapB, __uvA );
  vec4 texelColor = mix( texelColorA, texelColorB, mixAlpha );
  texelColor = mapTexelToLinear( texelColor );
  diffuseColor *= texelColor;
#endif
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `
#ifdef USE_EMISSIVEMAP
  vec2 __uvE = __rotUv( vEmissiveMapUv, uvRot );
  vec4 emissiveColorA = texture2D( emissiveMap, __uvE );
  vec4 emissiveColorB = texture2D( mapB, __uvE );
  emissiveColorA = emissiveMapTexelToLinear( emissiveColorA );
  emissiveColorB = emissiveMapTexelToLinear( emissiveColorB );
  totalEmissiveRadiance *= mix( emissiveColorA.rgb, emissiveColorB.rgb, mixAlpha );
#endif
        `
      );
    };

    return mat;
  }

  const __LIGHT_SOURCE_CACHE = new Map();

  function __getLightSource(sheetUrl, topBottomRotation) {
    const key = `${sheetUrl}|${topBottomRotation == null ? "n" : String(topBottomRotation)}`;
    if (__LIGHT_SOURCE_CACHE.has(key)) return __LIGHT_SOURCE_CACHE.get(key);

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

    const sharedMixAlpha = { value: 0.0 };

    const matsVisible = [];
    matsVisible[FACE_RIGHT] = makeCrossfadeLightMat(texA, texB, sharedMixAlpha, 0.0);
    matsVisible[FACE_LEFT]  = makeCrossfadeLightMat(texA, texB, sharedMixAlpha, 0.0);
    matsVisible[FACE_FRONT] = makeCrossfadeLightMat(texA, texB, sharedMixAlpha, 0.0);
    matsVisible[FACE_BACK]  = makeCrossfadeLightMat(texA, texB, sharedMixAlpha, 0.0);

    if (topBottomRotation != null) {
      matsVisible[FACE_TOP]    = makeCrossfadeLightMat(texA_tb, texB_tb, sharedMixAlpha, 0.0);
      matsVisible[FACE_BOTTOM] = makeCrossfadeLightMat(texA_tb, texB_tb, sharedMixAlpha, 0.0);
    } else {
      matsVisible[FACE_TOP]    = makeCrossfadeLightMat(texA, texB, sharedMixAlpha, 0.0);
      matsVisible[FACE_BOTTOM] = makeCrossfadeLightMat(texA, texB, sharedMixAlpha, 0.0);

    const faceMapA = [];
    const faceMapB = [];
    faceMapA[FACE_RIGHT] = texA; faceMapB[FACE_RIGHT] = texB;
    faceMapA[FACE_LEFT]  = texA; faceMapB[FACE_LEFT]  = texB;
    faceMapA[FACE_FRONT] = texA; faceMapB[FACE_FRONT] = texB;
    faceMapA[FACE_BACK]  = texA; faceMapB[FACE_BACK]  = texB;
    if (topBottomRotation != null) {
      faceMapA[FACE_TOP]    = texA_tb; faceMapB[FACE_TOP]    = texB_tb;
      faceMapA[FACE_BOTTOM] = texA_tb; faceMapB[FACE_BOTTOM] = texB_tb;
    } else {
      faceMapA[FACE_TOP]    = texA; faceMapB[FACE_TOP]    = texB;
      faceMapA[FACE_BOTTOM] = texA; faceMapB[FACE_BOTTOM] = texB;
    }
    }

    const invisible = new THREE.MeshStandardMaterial({
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });

    const img = new Image();
    img.decoding = "async";
    img.src = sheetUrl;

    const source = {
      sheetUrl,
      img,
      frames: 1,
      ready: false,
      ctxA, ctxB,
      texA, texB, texA_tb, texB_tb,
      matsVisible,
      faceMapA, faceMapB,
      invisible,
      sharedMixAlpha,
      topBottomRotation,
      rotMats: new Map(),
    };

    img.onload = () => {
      source.frames = Math.max(1, Math.floor(img.height / H));
      drawFrame(source.ctxA, img, 0);
      source.texA.needsUpdate = true;
      if (source.texA_tb) source.texA_tb.needsUpdate = true;

      drawFrame(source.ctxB, img, 1 % source.frames);
      source.texB.needsUpdate = true;
      if (source.texB_tb) source.texB_tb.needsUpdate = true;

      source.ready = true;
    };

    img.onerror = (e) => {
      console.error("Failed to load lights sheet:", sheetUrl, e);
      source.ready = false;
    };

    __LIGHT_SOURCE_CACHE.set(key, source);
    return source;
  }

  
  // Face-specific 7x7 numbering rotations (lights)
  // SOUTH/ NORTH faces: number from (x,y) with top row = y=GRID_SIZE-1, left col = x=0
  // TOP/ BOTTOM faces: number from (x,z) with top row = z=0 (04 side = north)
  const __LIGHT_ROT90 = {
    south: new Set([16, 20, 30, 34]),
    north: new Set([16, 20, 30, 34]),
    top:   new Set([11, 39]),
    bottom:new Set([11, 39]),
  };

  function __numXY(x, y) {
    const row = (GRID_SIZE - 1) - y; // y=6 => row0
    const col = x; // x=0 => col0
    return row * GRID_SIZE + col + 1;
  }

  function __numXZ(x, z) {
    const row = z; // z=0 (north) => row0
    const col = x;
    return row * GRID_SIZE + col + 1;
  }

  function __needsLightRot90(faceIndex, x, y, z) {
    if (z === GRID_SIZE - 1 && faceIndex === FACE_FRONT) { // south
      return __LIGHT_ROT90.south.has(__numXY(x, y));
    }
    if (z === 0 && faceIndex === FACE_BACK) { // north
      return __LIGHT_ROT90.north.has(__numXY(x, y));
    }
    if (y === GRID_SIZE - 1 && faceIndex === FACE_TOP) { // top
      return __LIGHT_ROT90.top.has(__numXZ(x, z));
    }
    if (y === 0 && faceIndex === FACE_BOTTOM) { // bottom
      return __LIGHT_ROT90.bottom.has(__numXZ(x, z));
    }
    return false;
  }

  function makeLightsLayer(sheetUrl, topBottomRotation, faceVisibleMask, x, y, z) {
    const source = __getLightSource(sheetUrl, topBottomRotation);

    const mats = Array(6);
    for (let fi = 0; fi < 6; fi++) {
      if (!(faceVisibleMask && faceVisibleMask[fi])) {
        mats[fi] = source.invisible;
        continue;
      }

      if (__needsLightRot90(fi, x, y, z)) {
        const k = `fi:${fi}:rot90`;
        if (!source.rotMats.has(k)) {
          const mapA = source.faceMapA[fi];
          const mapB = source.faceMapB[fi];
          source.rotMats.set(k, makeCrossfadeLightMat(mapA, mapB, source.sharedMixAlpha, Math.PI / 2));
        }
        mats[fi] = source.rotMats.get(k);
      } else {
        mats[fi] = source.matsVisible[fi];
      }
    }

    const mesh = new THREE.Mesh(baseGeo, mats);
    mesh.scale.setScalar(1.001);

    return { source, mesh };
  }


  // -------------------------------
  // Build instances
  // -------------------------------
  function makeInstance(x, y, z) {
    const type = classifyType(x, y, z);

    const pullAxis = DEBUG_PURE_AE2 ? null : pullAxisFor(x, y, z);
    const topBottomRotation = DEBUG_PURE_AE2 ? null : topBottomRotationFor(pullAxis);

    

    const faceMask = [
      !hasBlock(x + 1, y, z), // RIGHT
      !hasBlock(x - 1, y, z), // LEFT
      !hasBlock(x, y + 1, z), // TOP
      !hasBlock(x, y - 1, z), // BOTTOM
      !hasBlock(x, y, z + 1), // FRONT (south)
      !hasBlock(x, y, z - 1), // BACK (north)
    ];
const isColumn = type.startsWith("column");
    const baseTex = isColumn ? texColumnBase : texBlockBase;

    const baseMats = makeBaseMaterials(baseTex, topBottomRotation);
    const baseMesh = new THREE.Mesh(baseGeo, baseMats);

    // lights
    const sheetUrl = isColumn ? LIGHT_SHEET_COLUMN_URL : LIGHT_SHEET_BLOCK_URL;
    const lights = makeLightsLayer(sheetUrl, topBottomRotation, faceMask, x, y, z);
// inside overlay (only for inside)
    let insideMesh = null;
    if (type === "inside") {
      const parity = (Math.abs(x) + Math.abs(y) + Math.abs(z)) & 1;
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
    group.add(baseMesh, lights.mesh);
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

    return { x, y, z, type, group, lights, baseMesh, insideMesh };
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
  // -------------------------------
  // Debug helpers operating on built instances
  // -------------------------------
  const __uvTestTex = __makeUVTestTexture();
  const __uvTestMat = new THREE.MeshStandardMaterial({
    map: __uvTestTex,
    emissiveMap: __uvTestTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.3,
  });

  const __faceColors = [
    new THREE.MeshBasicMaterial({ color: 0xff6666 }), // RIGHT
    new THREE.MeshBasicMaterial({ color: 0x66ff66 }), // LEFT
    new THREE.MeshBasicMaterial({ color: 0x6666ff }), // TOP
    new THREE.MeshBasicMaterial({ color: 0xffff66 }), // BOTTOM
    new THREE.MeshBasicMaterial({ color: 0xff66ff }), // FRONT
    new THREE.MeshBasicMaterial({ color: 0x66ffff }), // BACK
  ];

  const __wireframeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.20 });

  function __applyVisibility() {
    for (const inst of instances) {
      if (!inst || !inst.group) continue;
      // lights
      if (inst.lights && inst.lights.mesh) inst.lights.mesh.visible = !!LIGHTS_ENABLED;
      // inside overlay stays visible as authored
    }
  }

  function __applyMaterialMode() {
    for (const inst of instances) {
      if (!inst || !inst.baseMesh) continue;

      // cache original
      if (!inst.__origBaseMats) inst.__origBaseMats = inst.baseMesh.material;
      if (inst.insideMesh && !inst.__origInsideMat) inst.__origInsideMat = inst.insideMesh.material;

      if (DEBUG_MAT_MODE === "uv") {
        inst.baseMesh.material = [__uvTestMat, __uvTestMat, __uvTestMat, __uvTestMat, __uvTestMat, __uvTestMat];
        if (inst.insideMesh) inst.insideMesh.visible = false;
      } else if (DEBUG_MAT_MODE === "faces") {
        inst.baseMesh.material = __faceColors;
        if (inst.insideMesh) inst.insideMesh.visible = false;
      } else {
        inst.baseMesh.material = inst.__origBaseMats;
        if (inst.insideMesh) { inst.insideMesh.material = inst.__origInsideMat; inst.insideMesh.visible = true; }
      }

      // optional wireframe overlay: add/remove a helper mesh
      if (DEBUG_SHOW_WIREFRAME) {
        if (!inst.__wire) {
          inst.__wire = new THREE.Mesh(inst.baseMesh.geometry, __wireframeMat);
          inst.__wire.scale.setScalar(1.002);
          inst.group.add(inst.__wire);
        }
        inst.__wire.visible = true;
      } else {
        if (inst.__wire) inst.__wire.visible = false;
      }
    }
  }

  function __clearLabels() {
    for (const inst of instances) {
      if (inst.__label) {
        inst.group.remove(inst.__label);
        inst.__label.material?.map?.dispose?.();
        inst.__label.material?.dispose?.();
        inst.__label = null;
      }
    }
  }

  function __makeLabelSprite(text) {
    const w = 256, h = 128;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.strokeRect(2,2,w-4,h-4);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 22px ui-monospace,Consolas,monospace";
    const lines = text.split("\n");
    for (let i=0;i<lines.length;i++) ctx.fillText(lines[i], 10, 30 + i*26);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const spr = new THREE.Sprite(mat);
    spr.scale.set(1.2, 0.6, 1);
    spr.position.set(0, 0.65, 0);
    return spr;
  }

  function __applyLabels() {
    __clearLabels();
    if (!DEBUG_SHOW_LABELS) return;
    for (const inst of instances) {
      const txt = `(${inst.x},${inst.y},${inst.z})\n${inst.type}`;
      inst.__label = __makeLabelSprite(txt);
      inst.group.add(inst.__label);
    }
  }

  // rebuild: clear all groups and rebuild instances in-place (for toggling Pure AE2)
  function __rebuildWorld() {
    // clear groups
    for (const g of layerGroups) {
      while (g.children.length) g.remove(g.children[0]);
    }
    while (compassGroup.children.length) compassGroup.remove(compassGroup.children[0]);

    instances.length = 0;

    // (re-run the build loop) — easiest: reload page state via location.reload for correctness
    // but we keep it in-process to avoid cache issues.
    // NOTE: This rebuild assumes placed set is constant and makeInstance uses DEBUG_PURE_AE2.
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

    // re-add compass labels and re-apply modes
    addWorldCompassLabels();
    __applyVisibility();
    __applyMaterialMode();
    __applyLabels();
    __requestRender();
  }


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

    north.position.set(center.x, y, box.min.z - margin);
    south.position.set(center.x, y, box.max.z + margin);
    west.position.set(box.min.x - margin, y, center.z);
    east.position.set(box.max.x + margin, y, center.z);

    compassGroup.add(north, south, west, east);
  }

  addWorldCompassLabels();
  __applyVisibility();
  __applyMaterialMode();
  __applyLabels();
  __refreshDebugPanel();
  __requestRender();


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
      "user-select:none",
      "max-width:220px"
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
      const initial = true;
      layerGroups[i].visible = initial;
      panel.appendChild(
        mkRow(`Layer ${i + 1}`, initial, (v) => (layerGroups[i].visible = v))
      );
    }
    // Animate (pause lights animation without hiding)
    panel.appendChild(
      mkRow("Animate", true, (v) => {
        ANIM_ENABLED = v;
        // Reset time accumulator so re-enabling does not "jump"
        if (v) last = performance.now();
        __requestRender();})
    );



    // Lights
    panel.appendChild(
      mkRow("Lights", true, (v) => {
        LIGHTS_ENABLED = v;
        __requestRender();
        for (const inst of instances) {
          if (!inst.lights || !LIGHTS_ENABLED) continue;
          inst.lights.mesh.visible = v;
        }
      })
    );

    // Lights FPS
    const fpsRow = document.createElement("div");
    fpsRow.style.cssText = "display:flex;gap:8px;margin:6px 0;align-items:center;";
    const fpsLabel = document.createElement("span");
    fpsLabel.textContent = "Lights FPS";
    const fpsValue = document.createElement("span");
    fpsValue.textContent = String(LIGHTS_FPS);
    fpsValue.style.cssText = "opacity:.9;";
    fpsLabel.style.cssText = "opacity:.85;min-width:70px;";
    const mkFpsBtn = (v) => {
      const b = document.createElement("button");
      b.textContent = String(v);
      b.style.cssText = "padding:6px 8px;border-radius:10px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;cursor:pointer;";
      b.addEventListener("click", () => { LIGHTS_FPS = v; fpsValue.textContent = String(v);
        __requestRender(); });
      return b;
    };
    fpsRow.appendChild(fpsLabel);
    fpsRow.appendChild(fpsValue);
    fpsRow.appendChild(mkFpsBtn(3));
    fpsRow.appendChild(mkFpsBtn(6));
    fpsRow.appendChild(mkFpsBtn(12));
    panel.appendChild(fpsRow);

    // Separator
    const hr = document.createElement("hr");
    hr.style.cssText = "border:none;border-top:1px solid rgba(255,255,255,.18);margin:10px 0;";
    panel.appendChild(hr);

    // Compass
    compassGroup.visible = true;
    panel.appendChild(
      mkRow("Compass", true, (v) => (compassGroup.visible = v))
    );

    // Reset view
    const btn = document.createElement("button");
    btn.textContent = "Reset View";
    btn.style.cssText = [
      "margin-top:10px",
      "width:100%",
      "padding:8px 10px",
      "border-radius:10px",
      "border:1px solid rgba(255,255,255,.22)",
      "background:rgba(255,255,255,.08)",
      "color:#fff",
      "cursor:pointer"
    ].join(";");
    btn.addEventListener("click", () => {
      camera.position.set(11.0, 11.0, 13.5);
      controls.target.set(0, 0, 0);
      controls.update();
    });
    panel.appendChild(btn);

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

    if (!LIGHTS_ENABLED) return;
    const cycleSeconds = 1 / Math.max(1, LIGHTS_FPS);
    const phase = (t % cycleSeconds) / cycleSeconds;
    const alpha = smoothstep(phase);

    // advance frames at cycle boundary
    if (phase < (dt / cycleSeconds)) {
      frameA++;
      frameB = frameA + 1;

      // Update each unique light source once (A+B)
      for (const src of __LIGHT_SOURCE_CACHE.values()) {
        if (!src.ready) continue;
        const a = frameA % src.frames;
        const b = frameB % src.frames;

        drawFrame(src.ctxA, src.img, a);
        src.texA.needsUpdate = true;
        if (src.texA_tb) src.texA_tb.needsUpdate = true;

        drawFrame(src.ctxB, src.img, b);
        src.texB.needsUpdate = true;
        if (src.texB_tb) src.texB_tb.needsUpdate = true;
      }
    }

    // apply crossfade alpha (shared uniform per source)
    for (const src of __LIGHT_SOURCE_CACHE.values()) {
      src.sharedMixAlpha.value = (src.ready ? alpha : 0.0);
    }
  }

  
  __ensureDebugPanel();
  __refreshDebugPanel();
// -------------------------------
  // Render loop
  // -------------------------------
  let __needsRender = true;
  const __requestRender = () => { __needsRender = true; };
  let last = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;

    controls.update();

    if (ANIM_ENABLED) {
      updateLights(dt);
      renderer.render(scene, camera);
    } else {
      // When animation is paused, only render when something changed.
      if (__needsRender) {
        renderer.render(scene, camera);
        __needsRender = false;
      }
    }
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

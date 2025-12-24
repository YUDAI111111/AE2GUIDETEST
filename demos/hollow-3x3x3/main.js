// demos/hollow-3x3x3/main.js（このファイルを全文置き換え）

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
  scene.background = new THREE.Color(0x0b0b0b);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);
  camera.position.set(6.5, 6.5, 8.0);

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
  const GRID_SIZE = 3;
  const SPACING = 1.0;
  const OFFSET = (GRID_SIZE - 1) * 0.5 * SPACING;

  function shouldPlace(x, y, z) {
    const isSurface =
      x === 0 || x === GRID_SIZE - 1 ||
      y === 0 || y === GRID_SIZE - 1 ||
      z === 0 || z === GRID_SIZE - 1;

    if (!isSurface) return false;

    const mid = Math.floor(GRID_SIZE / 2);

    // remove centers of each face
    if (x === mid && y === mid) return false; // z-faces
    if (x === mid && z === mid) return false; // y-faces
    if (y === mid && z === mid) return false; // x-faces

    // remove cube center (odd only)
    if (x === mid && y === mid && z === mid) return false;

    return true;
  }

  const placed = new Set();
  const key = (x, y, z) => `${x},${y},${z}`;
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        if (shouldPlace(x, y, z)) placed.add(key(x, y, z));
      }
    }
  }
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
  const texBlockBase = loadTex("./assets/controller_powered.png");
  const texColumnBase = loadTex("./assets/controller_column_powered.png");

  // lights sheets
  const LIGHT_SHEET_BLOCK_URL = "./assets/controller_lights.png";
  const LIGHT_SHEET_COLUMN_URL = "./assets/controller_column_lights.png";

  // inside
  const texInsideA = loadTex("./assets/controller_inside_a_powered.png");
  const texInsideB = loadTex("./assets/controller_inside_b_powered.png");

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

  function makeBaseMaterials(baseTexture, topBottomRotation, sideRotationLR) {
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
    
    if (sideRotationLR != null) {
      matsA[FACE_LEFT] = makeLightMat(texA_lr);
      matsA[FACE_RIGHT] = makeLightMat(texA_lr);
      matsB[FACE_LEFT] = makeLightMat(texB_lr);
      matsB[FACE_RIGHT] = makeLightMat(texB_lr);
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

  function makeLightsLayer(sheetUrl, topBottomRotation, sideRotationLR) {
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

    const texA_lr = sideRotationLR != null ? mkCanvasTex(canvasA, sideRotationLR) : null;
    const texB_lr = sideRotationLR != null ? mkCanvasTex(canvasB, sideRotationLR) : null;

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
      texA_lr, texB_lr,
      matsA, matsB,
      meshA, meshB,
      topBottomRotation,
    };

    img.onload = () => {
      layer.frames = Math.max(1, Math.floor(img.height / H));
      drawFrame(layer.ctxA, img, 0);
      layer.texA.needsUpdate = true;
      if (layer.texA_tb) layer.texA_tb.needsUpdate = true;
      if (layer.texA_lr) layer.texA_lr.needsUpdate = true;
drawFrame(layer.ctxB, img, 1 % layer.frames);
      layer.texB.needsUpdate = true;
      if (layer.texB_tb) layer.texB_tb.needsUpdate = true;
      if (layer.texB_lr) layer.texB_lr.needsUpdate = true;
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

    
    const sideRotationLR = (pullAxis === \"z\") ? (Math.PI / 2) : null;
const isColumn = type.startsWith("column");
    const baseTex = isColumn ? texColumnBase : texBlockBase;

    const baseMats = makeBaseMaterials(baseTex, topBottomRotation, sideRotationLR);
    const baseMesh = new THREE.Mesh(baseGeo, baseMats);

    // lights
    const sheetUrl = isColumn ? LIGHT_SHEET_COLUMN_URL : LIGHT_SHEET_BLOCK_URL;
    const lights = makeLightsLayer(sheetUrl, topBottomRotation, sideRotationLR);

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
        scene.add(inst.group);
        instances.push(inst);
      }
    }
  }

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
        if (l.texA_lr) l.texA_lr.needsUpdate = true;
drawFrame(l.ctxB, l.img, b);
        l.texB.needsUpdate = true;
        if (l.texB_tb) l.texB_tb.needsUpdate = true;
        if (l.texB_lr) l.texB_lr.needsUpdate = true;
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

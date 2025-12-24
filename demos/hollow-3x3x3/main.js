// demos/hollow-3x3x3/main.js（このファイルを全文置き換え）
//
// 修正点（要点だけ）
// - “回転でごまかす”のをやめ、ブロックの「向き（軸）」を決めてテクスチャを全6面まとめて同じ向きに回転
// - 「任意の連続3ブロック」が成立する軸（X/Y/Z）をブロック単位で判定し、その軸に引っ張られる
// - X/Y/Z のうち2軸以上で連続3が成立する場合は inside（inside_a/b）
//
// これで、上面の前列(3つ)の“真ん中”は必ず X 方向に引っ張られ（横向き）になります。
// （回転はブロック全体に適用されるので、左面の該当ブロックも同時に揃います）

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

  scene.add(new THREE.HemisphereLight(0xffffff, 0x202020, 0.85));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(6, 10, 6);
  scene.add(dir);

  // -------------------------------
  // Layout: hollow 3×3×3 shell (face centers + cube center empty)
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
    if (x === mid && y === mid) return false; // z-faces centers
    if (x === mid && z === mid) return false; // y-faces centers
    if (y === mid && z === mid) return false; // x-faces centers

    // remove cube center (odd)
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

  // lights sheets (sprite sheets)
  const LIGHT_SHEET_BLOCK_URL = "./assets/controller_lights.png";
  const LIGHT_SHEET_COLUMN_URL = "./assets/controller_column_lights.png";

  // inside
  const texInsideA = loadTex("./assets/controller_inside_a_powered.png");
  const texInsideB = loadTex("./assets/controller_inside_b_powered.png");

  // -------------------------------
  // Geometry
  // -------------------------------
  const baseGeo = new THREE.BoxGeometry(1, 1, 1);

  // BoxGeometry material order: [right, left, top, bottom, front, back]
  const FACE_RIGHT = 0, FACE_LEFT = 1, FACE_TOP = 2, FACE_BOTTOM = 3, FACE_FRONT = 4, FACE_BACK = 5;

  // -------------------------------
  // Core rule: “任意の連続3ブロック” が成立する軸をブロック単位で決める
  // -------------------------------
  function has3X(x, y, z) {
    return (
      (hasBlock(x - 2, y, z) && hasBlock(x - 1, y, z)) ||
      (hasBlock(x - 1, y, z) && hasBlock(x + 1, y, z)) ||
      (hasBlock(x + 1, y, z) && hasBlock(x + 2, y, z))
    );
  }
  function has3Y(x, y, z) {
    return (
      (hasBlock(x, y - 2, z) && hasBlock(x, y - 1, z)) ||
      (hasBlock(x, y - 1, z) && hasBlock(x, y + 1, z)) ||
      (hasBlock(x, y + 1, z) && hasBlock(x, y + 2, z))
    );
  }
  function has3Z(x, y, z) {
    return (
      (hasBlock(x, y, z - 2) && hasBlock(x, y, z - 1)) ||
      (hasBlock(x, y, z - 1) && hasBlock(x, y, z + 1)) ||
      (hasBlock(x, y, z + 1) && hasBlock(x, y, z + 2))
    );
  }

  // 返り値:
  // - {mode:"inside"} … 2軸以上で連続3成立（= 2点以上に引っ張られる）
  // - {mode:"axis", axis:"x"|"y"|"z"} … 1軸のみ成立（= その軸に引っ張られる）
  // - {mode:"none"} … 連続3が無い（= 単体扱い）
  function pullMode(x, y, z) {
    const x3 = has3X(x, y, z);
    const y3 = has3Y(x, y, z);
    const z3 = has3Z(x, y, z);
    const count = (x3 ? 1 : 0) + (y3 ? 1 : 0) + (z3 ? 1 : 0);

    if (count >= 2) return { mode: "inside" };
    if (x3) return { mode: "axis", axis: "x" };
    if (y3) return { mode: "axis", axis: "y" };
    if (z3) return { mode: "axis", axis: "z" };
    return { mode: "none" };
  }

  // 軸→テクスチャ回転（ブロック全体6面に同じ回転を適用）
  // X方向に引っ張る: 90deg（横向き）
  // Z方向に引っ張る: 0deg
  // Y方向に引っ張る: 0deg（縦方向は見た目が崩れにくいので回転なし。必要ならここだけ変える）
  function rotationForAxis(axis) {
    if (axis === "x") return Math.PI / 2;
    if (axis === "z") return 0;
    if (axis === "y") return 0;
    return 0;
  }

  function rotatedClone(tex, rot) {
    const t = tex.clone();
    t.center.set(0.5, 0.5);
    t.rotation = rot;
    t.needsUpdate = true;
    return t;
  }

  // -------------------------------
  // Materials
  // -------------------------------
  const BASE_EMISSIVE = 0.45;

  function makeAllFacesMaterial(texture, emissiveIntensity) {
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity
    });
    // 6面“同一の向き”が要件なので、面ごとの別回転などはしない
    return [mat, mat, mat, mat, mat, mat];
  }

  // -------------------------------
  // Lights (sprite sheet -> canvas texture -> crossfade)
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

  function makeLightsLayer(sheetUrl, rotAllFaces) {
    const canvasA = document.createElement("canvas");
    const canvasB = document.createElement("canvas");
    canvasA.width = W; canvasA.height = H;
    canvasB.width = W; canvasB.height = H;

    const ctxA = canvasA.getContext("2d");
    const ctxB = canvasB.getContext("2d");

    // “全6面が同一向き” 要件に合わせ、CanvasTexture自体に回転を入れて6面同一を作る
    const texA = mkCanvasTex(canvasA, rotAllFaces);
    const texB = mkCanvasTex(canvasB, rotAllFaces);

    const makeLightMat = (t) =>
      new THREE.MeshStandardMaterial({
        map: t,
        transparent: true,
        opacity: 0.0,
        emissiveMap: t,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 2.0,
        depthWrite: false
      });

    // 6面全部同一
    const matsA = Array(6).fill(null).map(() => makeLightMat(texA));
    const matsB = Array(6).fill(null).map(() => makeLightMat(texB));

    const meshA = new THREE.Mesh(baseGeo, matsA);
    const meshB = new THREE.Mesh(baseGeo, matsB);
    meshA.scale.setScalar(1.001);
    meshB.scale.setScalar(1.001);

    const img = new Image();
    img.decoding = "async";
    img.src = sheetUrl;

    const layer = {
      img,
      frames: 1,
      ready: false,
      ctxA, ctxB,
      texA, texB,
      matsA, matsB,
      meshA, meshB
    };

    img.onload = () => {
      layer.frames = Math.max(1, Math.floor(img.height / H));
      drawFrame(layer.ctxA, img, 0);
      layer.texA.needsUpdate = true;
      drawFrame(layer.ctxB, img, 1 % layer.frames);
      layer.texB.needsUpdate = true;
      layer.ready = true;
    };
    img.onerror = (e) => {
      console.error("Failed to load lights sheet:", sheetUrl, e);
      layer.ready = false;
    };

    return layer;
  }

  // -------------------------------
  // Build blocks
  // -------------------------------
  function makeInstance(x, y, z) {
    const pm = pullMode(x, y, z);

    // inside: inside_a/b を全面に貼る（全6面同一向き）
    if (pm.mode === "inside") {
      const parity = (x + y + z) & 1;
      const insideTex = parity ? texInsideA : texInsideB;

      const baseMats = makeAllFacesMaterial(insideTex, 0.70);
      const baseMesh = new THREE.Mesh(baseGeo, baseMats);

      // inside も lights を重ねる（見た目合わせ）
      // inside は column/normal どちらでも良いが、囲まれの雰囲気として通常を使う
      const lights = makeLightsLayer(LIGHT_SHEET_BLOCK_URL, 0);

      const group = new THREE.Group();
      group.add(baseMesh, lights.meshA, lights.meshB);

      group.position.set((x * SPACING) - OFFSET, (y * SPACING) - OFFSET, (z * SPACING) - OFFSET);

      return { group, lights };
    }

    // axis: 連続3が成立する軸があるなら column テクスチャ（端も含む）
    // none: 単体なら通常テクスチャ
    const isAxis = (pm.mode === "axis");
    const axis = isAxis ? pm.axis : null;

    const rot = isAxis ? rotationForAxis(axis) : 0;

    const baseTexRaw = isAxis ? texColumnBase : texBlockBase;
    const baseTex = (isAxis ? rotatedClone(baseTexRaw, rot) : baseTexRaw);

    const baseMats = makeAllFacesMaterial(baseTex, BASE_EMISSIVE);
    const baseMesh = new THREE.Mesh(baseGeo, baseMats);

    // lights sheet: columnなら column_lights
    const sheetUrl = isAxis ? LIGHT_SHEET_COLUMN_URL : LIGHT_SHEET_BLOCK_URL;
    const lights = makeLightsLayer(sheetUrl, isAxis ? rot : 0);

    const group = new THREE.Group();
    group.add(baseMesh, lights.meshA, lights.meshB);

    group.position.set((x * SPACING) - OFFSET, (y * SPACING) - OFFSET, (z * SPACING) - OFFSET);

    return { group, lights };
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

    const cycleSeconds = 0.18; // 速度はここ
    const phase = (t % cycleSeconds) / cycleSeconds;
    const alpha = smoothstep(phase);

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
        drawFrame(l.ctxB, l.img, b);
        l.texB.needsUpdate = true;
      }
    }

    for (const inst of instances) {
      const l = inst.lights;
      for (const m of l.matsA) m.opacity = (l.ready ? (1.0 - alpha) : 0.0);
      for (const m of l.matsB) m.opacity = (l.ready ? alpha : 0.0);
    }
  }

  // -------------------------------
  // Render
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

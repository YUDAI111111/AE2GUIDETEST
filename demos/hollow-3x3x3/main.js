import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ===== Settings =====
const GRID_SIZE = 3;               // 3x3x3
const SPACING = 1.0;               // no visible gaps between blocks
const FRAME_MS = (12/20)*1000;     // smooth crossfade speed (same as single demo)
const BASE_EMISSIVE = 0.35;        // guide-look: make powered base look "on"
const INSIDE_EMISSIVE = 0.45;
const LIGHTS_EMISSIVE = 1.0;

// ===== Hollow definition =====
// holes: face centers (6) + core (1)
function isHole(x,y,z){
  const core = (x===1 && y===1 && z===1);
  const faceCenters =
    (x===1 && y===1 && (z===0 || z===2)) ||
    (x===1 && z===1 && (y===0 || y===2)) ||
    (y===1 && z===1 && (x===0 || x===2));
  return core || faceCenters;
}
function hasKey(set,x,y,z){ return set.has(`${x},${y},${z}`); }

// build set of blocks
const blocks = new Set();
for(let x=0;x<GRID_SIZE;x++){
  for(let y=0;y<GRID_SIZE;y++){
    for(let z=0;z<GRID_SIZE;z++){
      if(isHole(x,y,z)) continue;
      blocks.add(`${x},${y},${z}`);
    }
  }
}
function hasBlock(x,y,z){ return hasKey(blocks,x,y,z); }

// ===== Scene =====
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 200);
camera.position.set(6.5, 6.0, 6.5);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(10, 14, 12);
scene.add(dir);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set((GRID_SIZE-1)*SPACING/2, (GRID_SIZE-1)*SPACING/2, (GRID_SIZE-1)*SPACING/2);
controls.update();

// ===== Textures =====
const loader = new THREE.TextureLoader();
function mc(tex){
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}
function mcClone(src){
  // clone keeps image, but we must re-apply MC settings (filters, wrap, colorspace)
  const t = src.clone();
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

const texBlockBase   = loader.load("./assets/controller_powered.png", mc);
const texColumnBase  = loader.load("./assets/controller_column_powered.png", mc);

const texBlockSheet  = loader.load("./assets/controller_lights.png", mc);
const texColumnSheet = loader.load("./assets/controller_column_lights.png", mc);

const insideATex = loader.load("./assets/controller_inside_a_powered.png", mc);
const insideBTex = loader.load("./assets/controller_inside_b_powered.png", mc);

// ===== Geometry =====
const baseGeo = new THREE.BoxGeometry(1,1,1);
const insideGeo = new THREE.BoxGeometry(0.92,0.92,0.92);

// BoxGeometry material order: [right, left, top, bottom, front, back]
const FACE_RIGHT = 0, FACE_LEFT = 1, FACE_TOP = 2, FACE_BOTTOM = 3, FACE_FRONT = 4, FACE_BACK = 5;

// ===== Column axis classification (same as earlier "good" build) =====
function classifyAxis(x,y,z){
  const nx = hasBlock(x-1,y,z), px = hasBlock(x+1,y,z);
  const ny = hasBlock(x,y-1,z), py = hasBlock(x,y+1,z);
  const nz = hasBlock(x,y,z-1), pz = hasBlock(x,y,z+1);

  const cx = nx && px;
  const cy = ny && py;
  const cz = nz && pz;

  const otherXY = (ny||py||nz||pz);
  const otherYX = (nx||px||nz||pz);
  const otherZX = (nx||px||ny||py);

  if(cx && !otherXY) return "column_x";
  if(cy && !otherYX) return "column_y";
  if(cz && !otherZX) return "column_z";
  return "block";
}

// ===== Top/Bottom rule you stated =====
// If (on the same Y layer) there is a horizontal run (adjacent controllers) along X => top/bottom should look "pulled" to X (horizontal)
// If run along Z => pulled to Z
// Corners / junctions => keep default block top/bottom (no override)
function topBottomModeFor(x,y,z){
  const xRun = hasBlock(x-1,y,z) || hasBlock(x+1,y,z);
  const zRun = hasBlock(x,y,z-1) || hasBlock(x,y,z+1);
  if(xRun && !zRun) return "x";
  if(zRun && !xRun) return "z";
  return "none";
}

function makeBaseMat(mapTex){
  return new THREE.MeshStandardMaterial({
    map: mapTex,
    emissiveMap: mapTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: BASE_EMISSIVE
  });
}

function rotatedTexFromColumn(rotQ){
  if(rotQ === 0) return texColumnBase;
  const t = mcClone(texColumnBase);
  t.center.set(0.5,0.5);
  t.rotation = rotQ * (Math.PI/2);
  t.needsUpdate = true;
  return t;
}

// ===== Lights (smooth crossfade) =====
const W=16,H=16;

function makeCanvasTex(canvas, rotQ){
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  if(rotQ){
    t.center.set(0.5,0.5);
    t.rotation = rotQ * (Math.PI/2);
  }
  return t;
}

function makeMat(tex, opacity){
  return new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: LIGHTS_EMISSIVE,
    transparent:true,
    opacity,
    depthWrite:false
  });
}

function drawFrame(ctx, img, idx){
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(img, 0, idx*H, W,H, 0,0, W,H);
}

function makeAnimPair(){
  const canvasA = document.createElement("canvas");
  const canvasB = document.createElement("canvas");
  canvasA.width = canvasB.width = W;
  canvasA.height = canvasB.height = H;

  const ctxA = canvasA.getContext("2d");
  const ctxB = canvasB.getContext("2d");
  ctxA.imageSmoothingEnabled = false;
  ctxB.imageSmoothingEnabled = false;

  const texA0  = makeCanvasTex(canvasA, 0);
  const texB0  = makeCanvasTex(canvasB, 0);
  const texA90 = makeCanvasTex(canvasA, 1);
  const texB90 = makeCanvasTex(canvasB, 1);

  return { canvasA, canvasB, ctxA, ctxB, texA0, texB0, texA90, texB90 };
}

// ===== Build one instance =====
function makeInstance(x,y,z){
  const type = classifyAxis(x,y,z);
  const isColumn = type.startsWith("column");
  const baseTexDefault = isColumn ? texColumnBase : texBlockBase;

  // Determine top/bottom override requirements
  const topExposed = !hasBlock(x, y+1, z);
  const botExposed = !hasBlock(x, y-1, z);
  const tbMode = topBottomModeFor(x,y,z);  // x / z / none
  const tbRotQ = (tbMode === "x") ? 1 : 0; // x-run => rotate 90deg, z-run => 0deg

  // ===== Base mesh materials per face =====
  const baseMats = new Array(6);
  for(let i=0;i<6;i++) baseMats[i] = makeBaseMat(baseTexDefault);

  // Apply override ONLY for exposed top/bottom, and ONLY when tbMode != none
  if(tbMode !== "none"){
    const t = rotatedTexFromColumn(tbRotQ);
    if(topExposed) baseMats[FACE_TOP] = makeBaseMat(t);
    if(botExposed) baseMats[FACE_BOTTOM] = makeBaseMat(t);
  }

  const baseMesh = new THREE.Mesh(baseGeo, baseMats);

  // ===== Lights: we animate BOTH sheets, then assign per-face =====
  const animBlock = makeAnimPair();
  const animCol   = makeAnimPair();

  // Side faces: default to (isColumn ? column sheet : block sheet)
  // Top/bottom: if override => column sheet with rotation; else follow default
  const matsA = new Array(6);
  const matsB = new Array(6);
  for(let fi=0; fi<6; fi++){
    const useColumn = isColumn;
    const A = useColumn ? animCol.texA0 : animBlock.texA0;
    const B = useColumn ? animCol.texB0 : animBlock.texB0;
    matsA[fi] = makeMat(A, 1);
    matsB[fi] = makeMat(B, 0);
  }
  if(tbMode !== "none"){
    const A = (tbMode === "x") ? animCol.texA90 : animCol.texA0;
    const B = (tbMode === "x") ? animCol.texB90 : animCol.texB0;
    if(topExposed){ matsA[FACE_TOP] = makeMat(A, 1); matsB[FACE_TOP] = makeMat(B, 0); }
    if(botExposed){ matsA[FACE_BOTTOM] = makeMat(A, 1); matsB[FACE_BOTTOM] = makeMat(B, 0); }
  }

  const lightsA = new THREE.Mesh(baseGeo, matsA);
  const lightsB = new THREE.Mesh(baseGeo, matsB);
  lightsA.scale.setScalar(1.001);
  lightsB.scale.setScalar(1.001);

  // ===== Inside =====
  const insideMat = new THREE.MeshStandardMaterial({
    map: insideATex,
    emissiveMap: insideATex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: INSIDE_EMISSIVE
  });
  const insideMesh = new THREE.Mesh(insideGeo, insideMat);

  // ===== Group + AE2-like rotations for column axis (restores good side behavior) =====
  const group = new THREE.Group();
  group.add(baseMesh, lightsA, lightsB, insideMesh);

  // column_y: no rotation
  // column_z: x=90
  // column_x: x=90, y=90
  if(type === "column_z"){
    group.rotation.x = Math.PI / 2;
  }else if(type === "column_x"){
    group.rotation.x = Math.PI / 2;
    group.rotation.y = Math.PI / 2;
  }

  group.position.set(x*SPACING, y*SPACING, z*SPACING);

  return {
    group,
    animBlock,
    animCol,
    matsA, matsB,
    insideMesh,
    blockImg: null, colImg: null,
    blockFrames: 1, colFrames: 1
  };
}

function ensureSheets(inst){
  if(!inst.blockImg && texBlockSheet.image){
    inst.blockImg = texBlockSheet.image;
    inst.blockFrames = Math.max(1, Math.floor(inst.blockImg.height / H));
  }
  if(!inst.colImg && texColumnSheet.image){
    inst.colImg = texColumnSheet.image;
    inst.colFrames = Math.max(1, Math.floor(inst.colImg.height / H));
  }
  return !!(inst.blockImg && inst.colImg);
}

// ===== Build structure =====
const instances = [];
for(let x=0;x<GRID_SIZE;x++){
  for(let y=0;y<GRID_SIZE;y++){
    for(let z=0;z<GRID_SIZE;z++){
      if(!hasBlock(x,y,z)) continue;
      const inst = makeInstance(x,y,z);
      scene.add(inst.group);
      instances.push(inst);
    }
  }
}

// ===== Animation =====
const start = performance.now();

function animate(){
  const t = (performance.now()-start)/FRAME_MS;
  const i = Math.floor(t);
  const f = t - i;

  const useA = (i % 2) === 0;
  const itex = useA ? insideATex : insideBTex;

  for(const inst of instances){
    if(ensureSheets(inst)){
      // draw frames for block sheet
      const bi = i % inst.blockFrames;
      const bn = (bi + 1) % inst.blockFrames;
      drawFrame(inst.animBlock.ctxA, inst.blockImg, bi);
      drawFrame(inst.animBlock.ctxB, inst.blockImg, bn);

      // draw frames for column sheet
      const ci = i % inst.colFrames;
      const cn = (ci + 1) % inst.colFrames;
      drawFrame(inst.animCol.ctxA, inst.colImg, ci);
      drawFrame(inst.animCol.ctxB, inst.colImg, cn);

      // update all textures that reference canvases
      inst.animBlock.texA0.needsUpdate = true;
      inst.animBlock.texB0.needsUpdate = true;
      inst.animBlock.texA90.needsUpdate = true;
      inst.animBlock.texB90.needsUpdate = true;

      inst.animCol.texA0.needsUpdate = true;
      inst.animCol.texB0.needsUpdate = true;
      inst.animCol.texA90.needsUpdate = true;
      inst.animCol.texB90.needsUpdate = true;

      // crossfade on all faces
      for(const m of inst.matsA) m.opacity = 1 - f;
      for(const m of inst.matsB) m.opacity = f;
    }

    inst.insideMesh.material.map = itex;
    inst.insideMesh.material.emissiveMap = itex;
    inst.insideMesh.material.needsUpdate = true;
  }

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

addEventListener("resize", ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ===== Settings =====
const GRID_SIZE = 3;               // 3x3x3
const SPACING = 1.0;               // no visible gaps between blocks
const FRAME_MS = (12/20)*1000;     // lights smooth speed
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
function hasBlock(x,y,z){ return blocks.has(`${x},${y},${z}`); }

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

function cloneRot(tex, rotQuarterTurns){
  if(rotQuarterTurns === 0) return tex;
  const t = tex.clone();
  t.center.set(0.5,0.5);
  t.rotation = rotQuarterTurns * (Math.PI/2);
  t.needsUpdate = true;
  return t;
}

function makeBaseMat(t){
  return new THREE.MeshStandardMaterial({
    map: t,
    emissiveMap: t,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: BASE_EMISSIVE
  });
}

// ===== Lights: two-sheet crossfade (block + column) =====
const W=16,H=16;

function makeAnimPair(){
  const canvasA = document.createElement("canvas");
  const canvasB = document.createElement("canvas");
  canvasA.width=canvasB.width=W;
  canvasA.height=canvasB.height=H;
  const ctxA = canvasA.getContext("2d");
  const ctxB = canvasB.getContext("2d");
  ctxA.imageSmoothingEnabled=false;
  ctxB.imageSmoothingEnabled=false;

  const mkTex = (canvas, rotQ)=>{
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
  };

  // 0 and 90deg variants
  const texA_0 = mkTex(canvasA, 0);
  const texB_0 = mkTex(canvasB, 0);
  const texA_90 = mkTex(canvasA, 1);
  const texB_90 = mkTex(canvasB, 1);

  return { canvasA, canvasB, ctxA, ctxB, texA_0, texB_0, texA_90, texB_90 };
}

function makeLightsMat(t, opacity){
  return new THREE.MeshStandardMaterial({
    map: t,
    emissiveMap: t,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: LIGHTS_EMISSIVE,
    transparent: true,
    opacity,
    depthWrite: false
  });
}

function drawFrame(ctx, img, idx){
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(img, 0, idx*H, W,H, 0,0, W,H);
}

// ===== Classification =====
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

// For TOP/BOTTOM faces: decide pull direction from neighbors on the same layer.
// Rule: if 3 blocks along X -> X, if 3 along Z -> Z. (Ends are also pulled.)
function topBottomModeFor(x,y,z){
  const xRun = hasBlock(x-1,y,z) || hasBlock(x+1,y,z);
  const zRun = hasBlock(x,y,z-1) || hasBlock(x,y,z+1);
  if(xRun && !zRun) return "x";
  if(zRun && !xRun) return "z";
  return "none";
}

// ===== Build one block instance =====
function makeBlockInstance(x,y,z){
  const type = classifyAxis(x,y,z);
  const isColumn = type.startsWith("column");

  // Which base texture is used on non-top/bottom faces
  const baseTexDefault = isColumn ? texColumnBase : texBlockBase;

  // On TOP/BOTTOM: if face is exposed, it should be pulled by X/Z run on that plane.
  const topExposed = !hasBlock(x, y+1, z);
  const botExposed = !hasBlock(x, y-1, z);
  const tbMode = topBottomModeFor(x,y,z); // x / z / none

  // Build per-face base materials
  const baseMats = new Array(6);
  for(let i=0;i<6;i++){
    baseMats[i] = makeBaseMat(baseTexDefault);
  }

  // Apply top/bottom overrides: use COLUMN texture on top/bottom when there is a run.
  // Rotation: X-run => 90deg, Z-run => 0deg (so Z is "default", X is rotated)
  const rotQ = (tbMode === "x") ? 1 : 0;
  if(topExposed && tbMode !== "none"){
    const t = cloneRot(texColumnBase, rotQ);
    baseMats[FACE_TOP] = makeBaseMat(t);
  }
  if(botExposed && tbMode !== "none"){
    const t = cloneRot(texColumnBase, rotQ);
    baseMats[FACE_BOTTOM] = makeBaseMat(t);
  }

  const baseMesh = new THREE.Mesh(baseGeo, baseMats);

  // ===== Lights materials per face, using BOTH sheets =====
  // We animate two sheets in parallel (block + column), then pick which one each face uses.
  const animBlock = makeAnimPair();
  const animCol   = makeAnimPair();

  const matsA = new Array(6);
  const matsB = new Array(6);

  for(let fi=0; fi<6; fi++){
    // default sheet choice per face
    const wantColumn = isColumn; // column blocks use column sheet on sides
    const useColumnSheet = wantColumn;

    const texA = useColumnSheet ? animCol.texA_0 : animBlock.texA_0;
    const texB = useColumnSheet ? animCol.texB_0 : animBlock.texB_0;
    matsA[fi] = makeLightsMat(texA, 1);
    matsB[fi] = makeLightsMat(texB, 0);
  }

  // Top/bottom override: if exposed and in a run, force COLUMN sheet and rotate for X-run.
  if(topExposed && tbMode !== "none"){
    const texA = (tbMode === "x") ? animCol.texA_90 : animCol.texA_0;
    const texB = (tbMode === "x") ? animCol.texB_90 : animCol.texB_0;
    matsA[FACE_TOP] = makeLightsMat(texA, 1);
    matsB[FACE_TOP] = makeLightsMat(texB, 0);
  }
  if(botExposed && tbMode !== "none"){
    const texA = (tbMode === "x") ? animCol.texA_90 : animCol.texA_0;
    const texB = (tbMode === "x") ? animCol.texB_90 : animCol.texB_0;
    matsA[FACE_BOTTOM] = makeLightsMat(texA, 1);
    matsB[FACE_BOTTOM] = makeLightsMat(texB, 0);
  }

  const lightsA = new THREE.Mesh(baseGeo, matsA);
  const lightsB = new THREE.Mesh(baseGeo, matsB);
  lightsA.scale.setScalar(1.001);
  lightsB.scale.setScalar(1.001);

  const insideMat = new THREE.MeshStandardMaterial({
    map: insideATex,
    emissiveMap: insideATex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: INSIDE_EMISSIVE
  });
  const insideMesh = new THREE.Mesh(insideGeo, insideMat);

  const group = new THREE.Group();
  group.add(baseMesh, lightsA, lightsB, insideMesh);

  // Position
  group.position.set(x*SPACING, y*SPACING, z*SPACING);

  return {
    group,
    animBlock,
    animCol,
    matsA,
    matsB,
    insideMesh,
    // Cache for images
    blockImg: null,
    colImg: null,
    blockFrames: 1,
    colFrames: 1
  };
}

function ensureSheet(inst){
  // Block sheet
  if(!inst.blockImg && texBlockSheet.image){
    inst.blockImg = texBlockSheet.image;
    inst.blockFrames = Math.max(1, Math.floor(inst.blockImg.height / H));
  }
  // Column sheet
  if(!inst.colImg && texColumnSheet.image){
    inst.colImg = texColumnSheet.image;
    inst.colFrames = Math.max(1, Math.floor(inst.colImg.height / H));
  }
  return !!(inst.blockImg && inst.colImg);
}

// ===== Build all instances =====
const instances = [];
for(let x=0;x<GRID_SIZE;x++){
  for(let y=0;y<GRID_SIZE;y++){
    for(let z=0;z<GRID_SIZE;z++){
      if(!hasBlock(x,y,z)) continue;
      const inst = makeBlockInstance(x,y,z);
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
  const f = t - i; // 0..1

  // inside A/B toggle stays as before
  const useA = (i % 2) === 0;
  const itex = useA ? insideATex : insideBTex;

  for(const inst of instances){
    if(ensureSheet(inst)){
      // Draw frames for BOTH sheets
      const bFrame = i % inst.blockFrames;
      const bNext  = (bFrame + 1) % inst.blockFrames;
      drawFrame(inst.animBlock.ctxA, inst.blockImg, bFrame);
      drawFrame(inst.animBlock.ctxB, inst.blockImg, bNext);

      const cFrame = i % inst.colFrames;
      const cNext  = (cFrame + 1) % inst.colFrames;
      drawFrame(inst.animCol.ctxA, inst.colImg, cFrame);
      drawFrame(inst.animCol.ctxB, inst.colImg, cNext);

      // Update textures
      inst.animBlock.texA_0.needsUpdate = true;
      inst.animBlock.texB_0.needsUpdate = true;
      inst.animBlock.texA_90.needsUpdate = true;
      inst.animBlock.texB_90.needsUpdate = true;

      inst.animCol.texA_0.needsUpdate = true;
      inst.animCol.texB_0.needsUpdate = true;
      inst.animCol.texA_90.needsUpdate = true;
      inst.animCol.texB_90.needsUpdate = true;

      // Apply crossfade opacity to all lights materials
      for(const m of inst.matsA) m.opacity = 1 - f;
      for(const m of inst.matsB) m.opacity = f;
    }

    inst.insideMesh.material.map = itex;
    inst.insideMesh.material.emissiveMap = itex;
    inst.insideMesh.material.needsUpdate = true;
  }

  controls.update();
  renderer.render(scene,camera);
  requestAnimationFrame(animate);
}
animate();

addEventListener("resize", ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

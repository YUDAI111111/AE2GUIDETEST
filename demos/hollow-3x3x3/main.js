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

// Rotate only top/bottom faces when block is sandwiched vertically.
// This matches the "pulled to the sides" look you described for stacked controllers.
function makeFaceMaterials(baseTexture, emissiveIntensity, rotateTopBottom){
  const makeMat = (t)=> new THREE.MeshStandardMaterial({
    map: t,
    emissiveMap: t,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity
  });

  // Default: all faces share the same texture object
  const mats = Array(6).fill(null).map(()=> makeMat(baseTexture));

  if(rotateTopBottom){
    // Clone texture objects for top/bottom only, so rotation doesn't affect other faces.
    const topTex = baseTexture.clone();
    const botTex = baseTexture.clone();
    topTex.center.set(0.5,0.5);
    botTex.center.set(0.5,0.5);
    topTex.rotation = Math.PI/2;
    botTex.rotation = Math.PI/2;
    topTex.needsUpdate = true;
    botTex.needsUpdate = true;

    mats[FACE_TOP] = makeMat(topTex);
    mats[FACE_BOTTOM] = makeMat(botTex);
  }
  return mats;
}

const W=16,H=16;

// Lights layer with smooth crossfade.
// We need per-face materials too, because only top/bottom should be rotated in the y-sandwiched case.
function makeLightsLayer(sheetTexture, rotateTopBottom){
  const canvasA = document.createElement("canvas");
  const canvasB = document.createElement("canvas");
  canvasA.width=canvasB.width=W;
  canvasA.height=canvasB.height=H;

  const ctxA = canvasA.getContext("2d");
  const ctxB = canvasB.getContext("2d");
  ctxA.imageSmoothingEnabled=false;
  ctxB.imageSmoothingEnabled=false;

  const mkCanvasTex = (canvas, rot)=>{
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    if(rot){
      t.center.set(0.5,0.5);
      t.rotation = Math.PI/2;
    }
    return t;
  };

  const texA = mkCanvasTex(canvasA, false);
  const texB = mkCanvasTex(canvasB, false);
  const texA_tb = rotateTopBottom ? mkCanvasTex(canvasA, true) : null;
  const texB_tb = rotateTopBottom ? mkCanvasTex(canvasB, true) : null;

  const makeMat = (t, opacity)=> new THREE.MeshStandardMaterial({
    map: t,
    emissiveMap: t,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: LIGHTS_EMISSIVE,
    transparent: true,
    opacity,
    depthWrite: false
  });

  // Default: same texture on all faces
  const matsA = Array(6).fill(null).map(()=> makeMat(texA, 1));
  const matsB = Array(6).fill(null).map(()=> makeMat(texB, 0));

  if(rotateTopBottom){
    matsA[FACE_TOP] = makeMat(texA_tb, 1);
    matsA[FACE_BOTTOM] = makeMat(texA_tb, 1);
    matsB[FACE_TOP] = makeMat(texB_tb, 0);
    matsB[FACE_BOTTOM] = makeMat(texB_tb, 0);
  }

  const meshA = new THREE.Mesh(baseGeo, matsA);
  const meshB = new THREE.Mesh(baseGeo, matsB);
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
    rotateTopBottom
  };
}

function drawFrame(ctx, img, idx){
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(img, 0, idx*H, W,H, 0,0, W,H);
}

function ensureSheet(lightsObj){
  if(!lightsObj.sheetTexture.image) return false;
  if(lightsObj.sheetImg) return true;
  lightsObj.sheetImg = lightsObj.sheetTexture.image;
  lightsObj.frames = Math.max(1, Math.floor(lightsObj.sheetImg.height / H));
  return true;
}

// Determine if a block is vertically sandwiched (has both above and below).
function isYSandwiched(x,y,z){
  return hasBlock(x, y-1, z) && hasBlock(x, y+1, z);
}

// Simple type decision remains the same (block vs column axis)
function classifyAxis(x,y,z){
  const nx = hasBlock(x-1,y,z), px = hasBlock(x+1,y,z);
  const ny = hasBlock(x,y-1,z), py = hasBlock(x,y+1,z);
  const nz = hasBlock(x,y,z-1), pz = hasBlock(x,y,z+1);

  // prefer axis with both sides connected if it is "pure" along that axis
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

function makeBlock(type, rotateTopBottom){
  const isColumn = type.startsWith("column");
  const baseTex = isColumn ? texColumnBase : texBlockBase;

  // Base face materials (rotate top/bottom only when y-sandwiched)
  const baseMats = makeFaceMaterials(baseTex, BASE_EMISSIVE, rotateTopBottom);
  const baseMesh = new THREE.Mesh(baseGeo, baseMats);

  // Lights per-face materials
  const lights = makeLightsLayer(isColumn ? texColumnSheet : texBlockSheet, rotateTopBottom);

  // Inside (keep as before; no special rotation applied)
  const insideMat = new THREE.MeshStandardMaterial({
    map: insideATex,
    emissiveMap: insideATex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: INSIDE_EMISSIVE
  });
  const insideMesh = new THREE.Mesh(insideGeo, insideMat);

  const group = new THREE.Group();
  group.add(baseMesh, lights.meshA, lights.meshB, insideMesh);

  // Match AE2 blockstate rotations for column variants:
  // column_y: no rotation
  // column_z: x=90
  // column_x: x=90, y=90
  if(type === "column_z"){
    group.rotation.x = Math.PI / 2;
  }else if(type === "column_x"){
    group.rotation.x = Math.PI / 2;
    group.rotation.y = Math.PI / 2;
  }

  return { group, baseMesh, lights, insideMesh, rotateTopBottom };
}

// Build instances
const instances = [];
for(let x=0;x<GRID_SIZE;x++){
  for(let y=0;y<GRID_SIZE;y++){
    for(let z=0;z<GRID_SIZE;z++){
      if(!hasBlock(x,y,z)) continue;

      const type = classifyAxis(x,y,z);
      const rotateTopBottom = isYSandwiched(x,y,z); // <-- fix requested: top/bottom when "挟まれている"
      const inst = makeBlock(type, rotateTopBottom);

      inst.group.position.set(x*SPACING, y*SPACING, z*SPACING);
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
  const useA = (i % 2) === 0;
  const itex = useA ? insideATex : insideBTex;

  for(const inst of instances){
    const L = inst.lights;
    if(ensureSheet(L)){
      const frame = i % L.frames;
      const next = (frame + 1) % L.frames;

      drawFrame(L.ctxA, L.sheetImg, frame);
      drawFrame(L.ctxB, L.sheetImg, next);

      // update all relevant textures (including rotated top/bottom variants)
      L.texA.needsUpdate = true;
      L.texB.needsUpdate = true;
      if(L.texA_tb) L.texA_tb.needsUpdate = true;
      if(L.texB_tb) L.texB_tb.needsUpdate = true;

      // set opacity on all face materials
      for(const m of L.matsA) m.opacity = 1 - f;
      for(const m of L.matsB) m.opacity = f;
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

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ===== Settings =====
const GRID_SIZE = 3;               // 3x3x3
const SPACING = 1.05;              // slight gap to avoid z-fighting
const FRAME_MS = (12/20)*1000;     // lights smooth speed (only affects lights crossfade + inside toggle)
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
function inBounds(x,y,z){
  return x>=0 && x<GRID_SIZE && y>=0 && y<GRID_SIZE && z>=0 && z<GRID_SIZE;
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

// column rule (simple, deterministic):
// if both sides along an axis are connected and there are NO connections on other axes -> column_axis, else block
function classify(x,y,z){
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

// ===== Per-block render object =====
const W=16,H=16;

function makeLightsLayer(sheetTexture){
  // Two canvases for crossfade
  const canvasA = document.createElement("canvas");
  const canvasB = document.createElement("canvas");
  canvasA.width=canvasB.width=W;
  canvasA.height=canvasB.height=H;

  const ctxA = canvasA.getContext("2d");
  const ctxB = canvasB.getContext("2d");
  ctxA.imageSmoothingEnabled=false;
  ctxB.imageSmoothingEnabled=false;

  const texA = new THREE.CanvasTexture(canvasA);
  const texB = new THREE.CanvasTexture(canvasB);
  [texA,texB].forEach(t=>{
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps=false;
  });

  const matA = new THREE.MeshStandardMaterial({
    map: texA, emissiveMap: texA, emissive: new THREE.Color(0xffffff),
    emissiveIntensity: LIGHTS_EMISSIVE, transparent:true, opacity:1
  });
  const matB = new THREE.MeshStandardMaterial({
    map: texB, emissiveMap: texB, emissive: new THREE.Color(0xffffff),
    emissiveIntensity: LIGHTS_EMISSIVE, transparent:true, opacity:0
  });

  const meshA = new THREE.Mesh(baseGeo, matA);
  const meshB = new THREE.Mesh(baseGeo, matB);

  return { sheetTexture, sheetImg:null, frames:1, ctxA, ctxB, texA, texB, matA, matB, meshA, meshB };
}

function drawFrame(ctx, img, idx){
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(img, 0, idx*H, W,H, 0,0, W,H);
}

function makeBlock(type){
  const isColumn = type.startsWith("column");
  const baseTex = isColumn ? texColumnBase : texBlockBase;
  const baseMat = new THREE.MeshStandardMaterial({
    map: baseTex,
    emissiveMap: baseTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: BASE_EMISSIVE
  });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);

  const lights = makeLightsLayer(isColumn ? texColumnSheet : texBlockSheet);

  const insideMat = new THREE.MeshStandardMaterial({
    map: insideATex,
    emissiveMap: insideATex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: INSIDE_EMISSIVE
  });
  const insideMesh = new THREE.Mesh(insideGeo, insideMat);

  const group = new THREE.Group();
  group.add(baseMesh, lights.meshA, lights.meshB, insideMesh);

  return { group, baseMesh, lights, insideMesh };
}

// build blocks
const instances = [];
for(let x=0;x<GRID_SIZE;x++){
  for(let y=0;y<GRID_SIZE;y++){
    for(let z=0;z<GRID_SIZE;z++){
      if(!hasBlock(x,y,z)) continue;
      const type = classify(x,y,z);
      const inst = makeBlock(type);
      inst.group.position.set(x*SPACING, y*SPACING, z*SPACING);
      scene.add(inst.group);
      instances.push(inst);
    }
  }
}

// ===== Animation =====
const start = performance.now();

function ensureSheet(lightsObj){
  if(!lightsObj.sheetTexture.image) return false;
  if(lightsObj.sheetImg) return true;
  lightsObj.sheetImg = lightsObj.sheetTexture.image;
  lightsObj.frames = Math.max(1, Math.floor(lightsObj.sheetImg.height / H));
  return true;
}

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
      L.texA.needsUpdate = true;
      L.texB.needsUpdate = true;
      L.matA.opacity = 1 - f;
      L.matB.opacity = f;
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

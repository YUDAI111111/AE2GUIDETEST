import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 100);
camera.position.set(2.4,2.0,2.4);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 1.0));
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(5,8,6);
scene.add(dir);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const baseGeo = new THREE.BoxGeometry(1,1,1);
const insideGeo = new THREE.BoxGeometry(0.92,0.92,0.92);

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

const baseTex     = loader.load("./assets/controller_powered.png", mc);
const lightsSheet = loader.load("./assets/controller_lights.png", mc);
const insideATex  = loader.load("./assets/controller_inside_a_powered.png", mc);
const insideBTex  = loader.load("./assets/controller_inside_b_powered.png", mc);

const W=16,H=16;
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

const baseMat = new THREE.MeshStandardMaterial({
  map: baseTex,
  emissiveMap: baseTex,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 0.35
});

const lightsMatA = new THREE.MeshStandardMaterial({
  map: texA, emissiveMap: texA,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 1.0,
  transparent:true, opacity:1
});
const lightsMatB = new THREE.MeshStandardMaterial({
  map: texB, emissiveMap: texB,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 1.0,
  transparent:true, opacity:0
});

const insideMat = new THREE.MeshStandardMaterial({
  map: insideATex,
  emissiveMap: insideATex,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 0.45
});

const baseMesh   = new THREE.Mesh(baseGeo, baseMat);
const lightsA   = new THREE.Mesh(baseGeo, lightsMatA);
const lightsB   = new THREE.Mesh(baseGeo, lightsMatB);
const insideMesh= new THREE.Mesh(insideGeo, insideMat);
scene.add(baseMesh, lightsA, lightsB, insideMesh);

const FRAME_MS = (12/20)*1000;

let sheetImg=null;
const start = performance.now();

function drawFrameTo(ctx, img, idx){
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(img, 0, idx*H, W,H, 0,0, W,H);
}

function animate(){
  if(lightsSheet.image){
    if(!sheetImg) sheetImg = lightsSheet.image;
    const frames = Math.max(1, Math.floor(sheetImg.height/H));
    const t = (performance.now()-start)/FRAME_MS;

    const i = Math.floor(t) % frames;
    const n = (i+1) % frames;
    const f = t - Math.floor(t);

    drawFrameTo(ctxA, sheetImg, i);
    drawFrameTo(ctxB, sheetImg, n);
    texA.needsUpdate = true;
    texB.needsUpdate = true;
    lightsMatA.opacity = 1 - f;
    lightsMatB.opacity = f;

    const useA = (Math.floor(t) % 2) === 0;
    const itex = useA ? insideATex : insideBTex;
    insideMesh.material.map = itex;
    insideMesh.material.emissiveMap = itex;
    insideMesh.material.needsUpdate = true;
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

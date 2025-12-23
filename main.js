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

scene.add(new THREE.AmbientLight(0xffffff,1.0));
const dir = new THREE.DirectionalLight(0xffffff,0.6);
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
  return tex;
}

const baseTex = loader.load("./assets/controller_powered.png", mc);
const lightsSheet = loader.load("./assets/controller_lights.png", mc);
const insideATex = loader.load("./assets/controller_inside_a_powered.png", mc);
const insideBTex = loader.load("./assets/controller_inside_b_powered.png", mc);

const canvas = document.createElement("canvas");
canvas.width = 16; canvas.height = 16;
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const lightsTex = new THREE.CanvasTexture(canvas);
lightsTex.colorSpace = THREE.SRGBColorSpace;
lightsTex.magFilter = THREE.NearestFilter;
lightsTex.minFilter = THREE.NearestFilter;

const baseMat = new THREE.MeshStandardMaterial({
  map: baseTex,
  emissiveMap: baseTex,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 0.35
});

const lightsMat = new THREE.MeshStandardMaterial({
  map: lightsTex,
  emissiveMap: lightsTex,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 1.0,
  transparent: true
});

const insideMat = new THREE.MeshStandardMaterial({
  map: insideATex,
  emissiveMap: insideATex,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 0.45
});

const baseMesh = new THREE.Mesh(baseGeo, baseMat);
const lightsMesh = new THREE.Mesh(baseGeo, lightsMat);
const insideMesh = new THREE.Mesh(insideGeo, insideMat);
scene.add(baseMesh, lightsMesh, insideMesh);

const FRAME_MS = (1/20)*1000;
let sheetImg=null;
const start = performance.now();

function drawFrame(i){
  ctx.clearRect(0,0,16,16);
  ctx.drawImage(sheetImg,0,i*16,16,16,0,0,16,16);
  lightsTex.needsUpdate = true;
}

function animate(){
  if(lightsSheet.image){
    if(!sheetImg) sheetImg = lightsSheet.image;
    const frames = Math.floor(sheetImg.height/16);
    const t = Math.floor((performance.now()-start)/FRAME_MS);
    drawFrame(t%frames);
    const useA = (t%2)===0;
    const tex = useA?insideATex:insideBTex;
    insideMesh.material.map = tex;
    insideMesh.material.emissiveMap = tex;
    insideMesh.material.needsUpdate = true;
  }
  controls.update();
  renderer.render(scene,camera);
  requestAnimationFrame(animate);
}
animate();

addEventListener("resize",()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Jar timing
const TICKS_PER_SECOND = 20;
const FRAME_TIME_TICKS = 25;
const FRAME_TIME_MS = (FRAME_TIME_TICKS / TICKS_PER_SECOND) * 1000;
const FRAME_W = 16;
const FRAME_H = 16;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 100);
camera.position.set(2.4,2.0,2.4);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// lighting (powered look)
scene.add(new THREE.AmbientLight(0xffffff,0.85));
const d = new THREE.DirectionalLight(0xffffff,0.6);
d.position.set(5,8,6);
scene.add(d);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const geometry = new THREE.BoxGeometry(1,1,1);

const loader = new THREE.TextureLoader();
const baseTex = loader.load("./assets/controller_powered.png", t=>{
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
});
const sheetTex = loader.load("./assets/controller_lights.png", t=>{
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
});

// canvas for lights frames
const canvas = document.createElement("canvas");
canvas.width = FRAME_W;
canvas.height = FRAME_H;
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const lightsTex = new THREE.CanvasTexture(canvas);
lightsTex.magFilter = THREE.NearestFilter;
lightsTex.minFilter = THREE.NearestFilter;

const baseMat = new THREE.MeshStandardMaterial({ map: baseTex });
const lightsMat = new THREE.MeshStandardMaterial({
  map: lightsTex,
  emissive: new THREE.Color(0xffffff),
  emissiveIntensity: 1.0,
  transparent: true
});

const baseMesh = new THREE.Mesh(geometry, baseMat);
scene.add(baseMesh);
const lightsMesh = new THREE.Mesh(geometry, lightsMat);
scene.add(lightsMesh);

let img=null, frames=0;
function ready(){
  if(!sheetTex.image) return false;
  if(img) return true;
  img = sheetTex.image;
  frames = Math.floor(img.height / FRAME_H);
  return frames>0;
}

function drawFrame(i){
  const sy = i * FRAME_H;
  ctx.clearRect(0,0,FRAME_W,FRAME_H);
  ctx.drawImage(img, 0, sy, FRAME_W, FRAME_H, 0,0,FRAME_W,FRAME_H);
  lightsTex.needsUpdate = true;
}

const start = performance.now();
function update(){
  if(!ready()) return;
  const t = Math.floor((performance.now()-start)/FRAME_TIME_MS) % frames;
  drawFrame(t);
}

function render(){
  update();
  controls.update();
  renderer.render(scene,camera);
  requestAnimationFrame(render);
}
render();

window.addEventListener("resize",()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});

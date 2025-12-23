import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Jar-like timing
const TICKS_PER_SECOND = 20;
const FRAME_TIME_TICKS = 25;
const FRAME_TIME_MS = (FRAME_TIME_TICKS / TICKS_PER_SECOND) * 1000;
const FRAME_W = 16;
const FRAME_H = 16;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(2.4, 2.0, 2.4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Lighting for shell
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(5,8,6);
scene.add(dir);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const geometry = new THREE.BoxGeometry(1,1,1);
const edgeGeometry = new THREE.BoxGeometry(1.04,1.04,1.04); // slight expansion for glowing edges

const loader = new THREE.TextureLoader();
const shellTex = loader.load("./assets/controller.png", t=>{
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
});

const sheetTex = loader.load("./assets/controller_lights.png", t=>{
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
});

// Canvas frame extraction (Jar-like)
const canvas = document.createElement("canvas");
canvas.width = FRAME_W;
canvas.height = FRAME_H;
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const lightsTex = new THREE.CanvasTexture(canvas);
lightsTex.magFilter = THREE.NearestFilter;
lightsTex.minFilter = THREE.NearestFilter;

const shellMat = new THREE.MeshStandardMaterial({ map: shellTex });
const lightsMat = new THREE.MeshBasicMaterial({ map: lightsTex, transparent:true, opacity:0.9 });

// Edge glow: additive emissive shell
const edgeMat = new THREE.MeshBasicMaterial({
  map: lightsTex,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  opacity: 0.6
});

const shell = new THREE.Mesh(geometry, shellMat);
scene.add(shell);

const lights = new THREE.Mesh(geometry, lightsMat);
scene.add(lights);

const edge = new THREE.Mesh(edgeGeometry, edgeMat);
scene.add(edge);

let sheetImage=null, frameCount=0;
function ready(){
  if(!sheetTex.image) return false;
  if(sheetImage) return true;
  sheetImage = sheetTex.image;
  frameCount = Math.floor(sheetImage.height/FRAME_H);
  return frameCount>0;
}

function drawFrame(i,a){
  const sy=i*FRAME_H;
  ctx.globalAlpha=a;
  ctx.drawImage(sheetImage,0,sy,FRAME_W,FRAME_H,0,0,FRAME_W,FRAME_H);
}

const start = performance.now();
function update(){
  if(!ready()) return;
  const t=((performance.now()-start)/FRAME_TIME_MS)%frameCount;
  const b=Math.floor(t), f=t-b, n=(b+1)%frameCount;
  ctx.clearRect(0,0,FRAME_W,FRAME_H);
  drawFrame(b,1-f);
  drawFrame(n,f);
  ctx.globalAlpha=1;
  lightsTex.needsUpdate=true;
}

function render(){
  update();
  controls.update();
  renderer.render(scene,camera);
  requestAnimationFrame(render);
}
render();

window.addEventListener("resize",()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});

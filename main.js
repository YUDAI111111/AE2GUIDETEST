import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.1, 100);
camera.position.set(2.4,2.0,2.4);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth,window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// lighting for shell only
scene.add(new THREE.AmbientLight(0xffffff,0.7));
const d = new THREE.DirectionalLight(0xffffff,0.6);
d.position.set(5,8,6);
scene.add(d);

// controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// geometry
const box = new THREE.BoxGeometry(1,1,1);
const edges = new THREE.EdgesGeometry(box);

// textures
const loader = new THREE.TextureLoader();
const shellTex = loader.load("./assets/controller.png", t=>{
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
});

// shell
const shellMat = new THREE.MeshStandardMaterial({map:shellTex});
const shell = new THREE.Mesh(box, shellMat);
scene.add(shell);

// edge glow: explicit edges, constant emission (Jar ON look)
const edgeMat = new THREE.LineBasicMaterial({
  color: 0xff66aa,   // AE2 Guide pink-ish
  linewidth: 2,
  transparent: true,
  opacity: 0.9
});
const edgeLines = new THREE.LineSegments(edges, edgeMat);
scene.add(edgeLines);

// render loop
function render(){
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

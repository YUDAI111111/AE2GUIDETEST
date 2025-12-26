// demos/cube-7x7x7/main.js
// Clean rebuild: AE2 Controller type logic (column/inside) + stable lights crossfade + debug panel.
// Constraints honored:
// - Column direction is expressed via whole-block mesh rotation (no per-face UV "pillar direction" hacks).
// - Special +90° rotation for specific face numbers is applied to BOTH base and lights on those faces.
// - Single file; no external deps beyond Three.js + OrbitControls.
//
// Notes:
// - This file assumes the same folder structure as the original repo.
// - Assets referenced here are the existing demo assets used by your current pages.
//
// Authoring intent: stable, no ReferenceError, deterministic scope.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// -----------------------------
// Utilities / constants
// -----------------------------
const GRID = 7;
const SPACING = 1.0;
const OFFSET = (GRID - 1) * 0.5 * SPACING;

const FACE_RIGHT = 0;  // +X
const FACE_LEFT  = 1;  // -X
const FACE_TOP   = 2;  // +Y
const FACE_BOTTOM= 3;  // -Y
const FACE_FRONT = 4;  // +Z (south)
const FACE_BACK  = 5;  // -Z (north)

const ROT_90 = Math.PI / 2;
// Face index mapping (matches makeMCBoxGeometry groups)
// 0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z
const __FACE_NAME_BY_INDEX = ["EAST(+X)","WEST(-X)","UP(+Y)","DOWN(-Y)","SOUTH(+Z)","NORTH(-Z)"];
function __dirName(dir){
  if (!dir) return "UNKNOWN";
  const x=dir[0], y=dir[1], z=dir[2];
  if (x===1) return "EAST(+X)";
  if (x===-1) return "WEST(-X)";
  if (y===1) return "UP(+Y)";
  if (y===-1) return "DOWN(-Y)";
  if (z===1) return "SOUTH(+Z)";
  if (z===-1) return "NORTH(-Z)";
  return `(${x},${y},${z})`;
}

// Per-block per-face rotation overrides (quarter turns 0..3). Stored in localStorage.
const __ROT_DB_KEY = "cube7x7x7_face_rot_db_v1";
// Baseline (expected correct) face rotation database derived from user-verified fixes.
const __BASELINE_FACE_ROT_DB = {"1,0,0|0":{rx:1,ry:0,rz:0},"1,0,0|1":{rx:1,ry:0,rz:0},"1,0,2|0":{rx:1,ry:0,rz:0},"1,0,2|1":{rx:1,ry:0,rz:0},"1,0,4|0":{rx:1,ry:0,rz:0},"1,0,4|1":{rx:1,ry:0,rz:0},"1,0,6|0":{rx:1,ry:0,rz:0},"1,0,6|1":{rx:1,ry:0,rz:0},"1,2,0|1":{rx:1,ry:0,rz:0},"1,2,2|1":{rx:1,ry:0,rz:0},"1,2,4|1":{rx:1,ry:0,rz:0},"1,2,6|1":{rx:1,ry:0,rz:0},"1,4,0|0":{rx:1,ry:0,rz:0},"1,4,2|0":{rx:1,ry:0,rz:0},"1,4,4|0":{rx:1,ry:0,rz:0},"1,4,6|0":{rx:1,ry:0,rz:0},"1,6,0|0":{rx:1,ry:0,rz:0},"1,6,0|1":{rx:1,ry:0,rz:0},"1,6,2|0":{rx:1,ry:0,rz:0},"1,6,2|1":{rx:1,ry:0,rz:0},"1,6,4|0":{rx:1,ry:0,rz:0},"1,6,4|1":{rx:1,ry:0,rz:0},"1,6,6|0":{rx:1,ry:0,rz:0},"1,6,6|1":{rx:1,ry:0,rz:0},"3,0,1|0":{rx:1,ry:0,rz:0},"3,0,1|1":{rx:1,ry:0,rz:0},"3,0,1|3":{rx:0,ry:2,rz:0},"3,0,5|0":{rx:1,ry:0,rz:0},"3,0,5|1":{rx:1,ry:0,rz:0},"3,0,5|3":{rx:0,ry:2,rz:0},"3,1,0|0":{rx:1,ry:0,rz:0},"3,1,0|1":{rx:1,ry:0,rz:0},"3,1,2|0":{rx:1,ry:0,rz:0},"3,1,2|1":{rx:1,ry:0,rz:0},"3,1,4|0":{rx:1,ry:0,rz:0},"3,1,4|1":{rx:1,ry:0,rz:0},"3,1,6|0":{rx:1,ry:0,rz:0},"3,1,6|1":{rx:1,ry:0,rz:0},"3,2,1|0":{rx:1,ry:0,rz:0},"3,2,1|1":{rx:1,ry:0,rz:0},"3,2,5|0":{rx:1,ry:0,rz:0},"3,2,5|1":{rx:1,ry:0,rz:0},"3,4,1|0":{rx:1,ry:0,rz:0},"3,4,1|1":{rx:1,ry:0,rz:0},"3,4,5|0":{rx:1,ry:0,rz:0},"3,4,5|1":{rx:1,ry:0,rz:0},"3,5,0|0":{rx:1,ry:0,rz:0},"3,5,0|1":{rx:1,ry:0,rz:0},"3,5,2|0":{rx:1,ry:0,rz:0},"3,5,2|1":{rx:1,ry:0,rz:0},"3,5,4|0":{rx:1,ry:0,rz:0},"3,5,4|1":{rx:1,ry:0,rz:0},"3,5,6|0":{rx:1,ry:0,rz:0},"3,6,1|0":{rx:1,ry:0,rz:0},"3,6,1|1":{rx:1,ry:0,rz:0},"3,6,1|2":{rx:0,ry:1,rz:0},"3,6,5|0":{rx:1,ry:0,rz:0},"3,6,5|1":{rx:1,ry:0,rz:0},"3,6,5|2":{rx:0,ry:1,rz:0},"4,0,1|4":{rx:2,ry:0,rz:0},"4,0,5|4":{rx:2,ry:1,rz:2},"5,0,0|0":{rx:1,ry:0,rz:0},"5,0,0|1":{rx:1,ry:0,rz:0},"5,0,2|0":{rx:1,ry:0,rz:0},"5,0,2|1":{rx:1,ry:0,rz:0},"5,0,4|0":{rx:1,ry:0,rz:0},"5,0,4|1":{rx:1,ry:0,rz:0},"5,0,6|0":{rx:1,ry:0,rz:0},"5,0,6|1":{rx:1,ry:0,rz:0},"5,2,0|1":{rx:1,ry:0,rz:0},"5,2,2|1":{rx:1,ry:0,rz:0},"5,2,4|1":{rx:1,ry:0,rz:0},"5,2,6|1":{rx:1,ry:0,rz:0},"5,4,0|0":{rx:1,ry:0,rz:0},"5,4,2|0":{rx:1,ry:0,rz:0},"5,4,4|0":{rx:1,ry:0,rz:0},"5,4,6|0":{rx:1,ry:0,rz:0},"5,6,0|0":{rx:1,ry:0,rz:0},"5,6,0|1":{rx:1,ry:0,rz:0},"5,6,2|0":{rx:1,ry:0,rz:0},"5,6,2|1":{rx:1,ry:0,rz:0},"5,6,4|0":{rx:1,ry:0,rz:0},"5,6,4|1":{rx:1,ry:0,rz:0},"5,6,6|0":{rx:1,ry:0,rz:0},"5,6,6|1":{rx:1,ry:0,rz:0}};
const __faceRotDb = new Map(); // key "x,y,z|face" -> {rx,ry,rz}
function __rk(x,y,z,face){ return `${x},${y},${z}|${face}`; }
function __loadRotDb(){
  // Always start from a clean map so baseline defaults apply deterministically.
  __faceRotDb.clear();

  // 1) Load user overrides (if any)
  try{
    const raw = localStorage.getItem(__ROT_DB_KEY);
    if (raw){
      const obj = JSON.parse(raw);
      for (const k of Object.keys(obj)){
        const v = obj[k];
        if (!v) continue;
        __faceRotDb.set(k, { rx:(v.rx|0)&3, ry:(v.ry|0)&3, rz:(v.rz|0)&3 });
      }
    }
  }catch(e){ console.warn("[rotDB] load failed", e); }

  // 2) Apply baseline defaults for any missing keys (baseline is the intended default)
  try{
    for (const k of Object.keys(__BASELINE_FACE_ROT_DB)){
      if (__faceRotDb.has(k)) continue;
      const v = __BASELINE_FACE_ROT_DB[k];
      __faceRotDb.set(k, { rx:(v.rx|0)&3, ry:(v.ry|0)&3, rz:(v.rz|0)&3 });
    }
  }catch(e){ console.warn("[rotDB] baseline apply failed", e); }
}
function __saveRotDb(){
  try{
    const obj = {};
    for (const [k,v] of __faceRotDb.entries()) obj[k] = { rx:(v.rx|0)&3, ry:(v.ry|0)&3, rz:(v.rz|0)&3 };
    localStorage.setItem(__ROT_DB_KEY, JSON.stringify(obj));
  }catch(e){ console.warn("[rotDB] save failed", e); }
}
function __defaultRotXYZ(x,y,z,face){
  // Baseline (intended default) takes precedence over heuristic.
  const bk = __rk(x,y,z,face);
  const bv = __BASELINE_FACE_ROT_DB[bk];
  if (bv) return { rx:(bv.rx|0)&3, ry:(bv.ry|0)&3, rz:(bv.rz|0)&3 };
  const r = { rx:0, ry:0, rz:0 };
  const q = needsRot90ForFace(x,y,z,face) ? 1 : 0;
  if (face===0||face===1) r.rx=q;
  else if (face===2||face===3) r.ry=q;
  else r.rz=q;
  return r;
}
function __getRotXYZ(x,y,z,face){
  const k = __rk(x,y,z,face);
  if (__faceRotDb.has(k)) return __faceRotDb.get(k);
  const d = __defaultRotXYZ(x,y,z,face);
  __faceRotDb.set(k,d);
  return d;
}
function __getRotQ(x,y,z,face){
  const r = __getRotXYZ(x,y,z,face);
  if (face===0||face===1) return (r.rx|0)&3;
  if (face===2||face===3) return (r.ry|0)&3;
  return (r.rz|0)&3;
}


const ROT90_NORTH_SOUTH = new Set([16, 20, 30, 34]);
const ROT90_UP_DOWN = new Set([11, 39]);

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function posKey(x,y,z){ return `${x},${y},${z}`; }

function layerY(layerIndex1to7){
  // layer 1 is top => y=6 ; layer 7 is bottom => y=0
  return GRID - layerIndex1to7;
}

function idxToXZ(n1to49){
  // numbering: left-top -> right, row-major; 1..49
  const i = n1to49 - 1;
  const row = Math.floor(i / GRID);
  const col = i % GRID;
  return { x: col, z: row };
}

function faceNumNorth(x,y,z){
  // north face: z==0, numbering left=west (x 0..6), top=up (y 6..0)
  const row = (GRID - 1) - y; // y6 -> row0
  const col = x;
  return row * GRID + col + 1;
}
function faceNumSouth(x,y,z){
  // south face: z==6, "south face as seen looking north": left=west, top=up
  const row = (GRID - 1) - y;
  const col = x;
  return row * GRID + col + 1;
}
function faceNumUp(x,y,z){
  // top face y==6: 04 side is north => north edge center is (x=3,z=0) => 4.
  const row = z; // z 0..6 north->south
  const col = x;
  return row * GRID + col + 1;
}
function faceNumDown(x,y,z){
  // bottom face y==0: same orientation spec
  const row = z;
  const col = x;
  return row * GRID + col + 1;
}

function needsRot90ForFace(x,y,z,faceIndex){
  // Apply ONLY to the specified face-number rules (for both base + lights)
  if (faceIndex === FACE_BACK && z === 0) { // north face
    return ROT90_NORTH_SOUTH.has(faceNumNorth(x,y,z));
  }
  if (faceIndex === FACE_FRONT && z === GRID-1) { // south face
    return ROT90_NORTH_SOUTH.has(faceNumSouth(x,y,z));
  }
  if (faceIndex === FACE_TOP && y === GRID-1) { // up
    return ROT90_UP_DOWN.has(faceNumUp(x,y,z));
  }
  if (faceIndex === FACE_BOTTOM && y === 0) { // down
    return ROT90_UP_DOWN.has(faceNumDown(x,y,z));
  }
  return false;
}

function safeNowMs(){ return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(); }

// -----------------------------
// Debug UI
// -----------------------------
function makeDebugUI(){
  const __DBG_KEY = "cube7x7x7_debug_hidden";
  const __dbgHidden = (localStorage.getItem(__DBG_KEY) === "1");

  const root = document.createElement("div");
  root.style.cssText = [
    "position:fixed;top:10px;right:10px;z-index:9999",
    "font:12px/1.35 ui-monospace,Consolas,monospace",
    "color:#eaeaea;background:rgba(0,0,0,0.65)",
    "border:1px solid rgba(255,255,255,0.15)",
    "border-radius:8px;padding:10px;min-width:260px",
    "user-select:none"
  ].join(";");

  const title = document.createElement("div");
  title.textContent = "cube-7x7x7 DEBUG";
  title.style.cursor = "move";
  let __dbgDragActive = false;
  let __dbgDragDX = 0;
  let __dbgDragDY = 0;
  title.addEventListener("pointerdown", (ev)=>{
    if (ev.button !== 0) return;
    ev.preventDefault();
    const r = root.getBoundingClientRect();
    // Switch from right-based to left-based positioning so it can move.
    root.style.left = r.left + "px";
    root.style.top = r.top + "px";
    root.style.right = "auto";
    root.style.bottom = "auto";
    __dbgDragActive = true;
    __dbgDragDX = ev.clientX - r.left;
    __dbgDragDY = ev.clientY - r.top;
    root.setPointerCapture(ev.pointerId);
  });
  title.addEventListener("pointermove", (ev)=>{
    if (!__dbgDragActive) return;
    const x = ev.clientX - __dbgDragDX;
    const y = ev.clientY - __dbgDragDY;
    root.style.left = Math.max(6, x) + "px";
    root.style.top = Math.max(6, y) + "px";
  });
  title.addEventListener("pointerup", (ev)=>{
    if (!__dbgDragActive) return;
    __dbgDragActive = false;
    try{ root.releasePointerCapture(ev.pointerId); }catch(e){}
  });
  title.style.cssText = "font-weight:700;margin-bottom:8px";
  root.appendChild(title);

  const mkToggle = (label, initial, onChange)=>{
    const wrap = document.createElement("label");
    wrap.style.cssText = "display:flex;gap:8px;align-items:center;margin:4px 0;";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!initial;
    cb.addEventListener("change", ()=> onChange(cb.checked));
    const sp = document.createElement("span");
    sp.textContent = label;
    wrap.appendChild(cb);
    wrap.appendChild(sp);
    root.appendChild(wrap);
    return cb;
  };

  const mkSelect = (label, options, onChange)=>{
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:6px";
    const sp = document.createElement("span");
    sp.textContent = label;
    const sel = document.createElement("select");
    sel.style.cssText = "flex:1;background:#111;color:#eee;border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:2px 6px";
    for (const o of options){
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", ()=> onChange(sel.value));
    wrap.appendChild(sp);
    wrap.appendChild(sel);
    root.appendChild(wrap);
    return sel;
  };

  const pickBox = document.createElement("div");
  pickBox.style.cssText = "margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.15)";
  pickBox.innerHTML = `<div style="font-weight:600;margin-bottom:4px">Pick</div><div id="pickText">Pick: none</div>
<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.12)">
  <div style="font-weight:600;margin-bottom:6px">Rotate (per block, per face)</div>
  <div id="rotSel" style="white-space:pre-wrap;color:rgba(255,255,255,0.9)">No selection</div>
  <div style="margin-top:6px;display:grid;grid-template-columns:auto 1fr;gap:6px;align-items:center">
    <div>FACE</div><div><button id="rotFm">-90</button><button id="rotFp">+90</button> <span id="rqv"></span></div>
    <div>X</div><div><button id="rxm">-90</button><button id="rxp">+90</button> <span id="rxv"></span></div>
    <div>Y</div><div><button id="rym">-90</button><button id="ryp">+90</button> <span id="ryv"></span></div>
    <div>Z</div><div><button id="rzm">-90</button><button id="rzp">+90</button> <span id="rzv"></span></div>
  </div>
  <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
    <button id="rotReset">Reset to rule</button>
    <button id="rotCopy">Copy report</button>
  </div>
</div>
`;
  root.appendChild(pickBox);
  const pickText = pickBox.querySelector("#pickText");
  const rotSel = pickBox.querySelector("#rotSel");
  const rotFm = pickBox.querySelector("#rotFm");
  const rotFp = pickBox.querySelector("#rotFp");
  const rqv = pickBox.querySelector("#rqv");
  const rxm = pickBox.querySelector("#rxm");
  const rxp = pickBox.querySelector("#rxp");
  const rym = pickBox.querySelector("#rym");
  const ryp = pickBox.querySelector("#ryp");
  const rzm = pickBox.querySelector("#rzm");
  const rzp = pickBox.querySelector("#rzp");
  const rxv = pickBox.querySelector("#rxv");
  const ryv = pickBox.querySelector("#ryv");
  const rzv = pickBox.querySelector("#rzv");
  const rotReset = pickBox.querySelector("#rotReset");
  const rotCopy = pickBox.querySelector("#rotCopy");

  const texBox = document.createElement("div");
  texBox.style.cssText = "margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.15)";
  texBox.innerHTML = `<div style="font-weight:600;margin-bottom:4px">Textures</div><div id="texList"></div>`;
  root.appendChild(texBox);
  const texList = texBox.querySelector("#texList");

  const hint = document.createElement("div");
  hint.style.cssText = "margin-top:8px;color:rgba(255,255,255,0.8)";
  hint.textContent = "Click a block to inspect its (x,y,z), type, rotations. Use Material=UV test to verify per-face UV.";
  root.appendChild(hint);

  document.body.appendChild(root);
  // Close button (persist)
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.title = "Close debug";
  closeBtn.style.cssText = "position:absolute;right:6px;top:6px;width:26px;height:26px;border-radius:6px;border:0;" +
                           "background:rgba(255,255,255,0.15);color:#fff;cursor:pointer;font-size:18px;line-height:26px;";
  closeBtn.addEventListener("click", () => {
    root.style.display = "none";
    localStorage.setItem(__DBG_KEY, "1");
    showBtn.style.display = "block";
    requestRender && requestRender();
  });
  root.style.position = "fixed"; // ensure absolute close works
  root.appendChild(closeBtn);

  // Re-open button
  const showBtn = document.createElement("button");
  showBtn.textContent = "Show DEBUG";
  showBtn.title = "Show debug panel";
  showBtn.style.cssText = "position:fixed;right:12px;top:12px;z-index:99999;padding:6px 10px;border-radius:10px;" +
                          "border:0;background:rgba(0,0,0,0.7);color:#fff;cursor:pointer;font:12px/1.2 ui-monospace,Consolas,monospace;";
  showBtn.addEventListener("click", () => {
    root.style.display = "block";
    localStorage.setItem(__DBG_KEY, "0");
    showBtn.style.display = "none";
    requestRender && requestRender();
  });
  document.body.appendChild(showBtn);

  if (__dbgHidden){
    root.style.display = "none";
    showBtn.style.display = "block";
  } else {
    showBtn.style.display = "none";
  }


  return { root, mkToggle, mkSelect, pickText, texList, rotSel, rotFm, rotFp, rqv, rxm, rxp, rym, ryp, rzm, rzp, rxv, ryv, rzv, rotReset, rotCopy };
}

// -----------------------------
// AE2 controller placement: 7x7x7 demo layout
// -----------------------------
function buildPlacedSet(){
  // From your description (same as previous demo):
  // layer1 blanks: {4, 9, 13, 18, 22, 24, 25, 26, 28, 32, 37, 41, 46}
  // layer2 filled: {1, 3, 4, 5, 7, 15, 17, 18, 19, 21, 22, 24, 26, 28, 29, 31, 32, 33, 35, 43, 45, 46, 47, 49}
  // layer4 filled: {2, 6, 8, 10, 12, 14, 16, 20, 30, 34, 36, 38, 40, 42, 44, 48}
  const layer1Blanks = new Set([4, 9, 13, 18, 22, 24, 25, 26, 28, 32, 37, 41, 46]);
  const layer2Filled = new Set([1, 3, 4, 5, 7, 15, 17, 18, 19, 21, 22, 24, 26, 28, 29, 31, 32, 33, 35, 43, 45, 46, 47, 49]);
  const layer4Filled = new Set([2, 6, 8, 10, 12, 14, 16, 20, 30, 34, 36, 38, 40, 42, 44, 48]);

  const placed = new Set();

  for (let layer = 1; layer <= 7; layer++){
    const y = layerY(layer);
    for (let n = 1; n <= 49; n++){
      let fill = false;
      if (layer === 1 || layer === 3 || layer === 5 || layer === 7){
        fill = !layer1Blanks.has(n);
      } else if (layer === 2 || layer === 6){
        fill = layer2Filled.has(n);
      } else if (layer === 4){
        fill = layer4Filled.has(n);
      }
      if (!fill) continue;
      const { x, z } = idxToXZ(n);
      placed.add(posKey(x,y,z));
    }
  }
  return placed;
}

// -----------------------------
// AE2 classify logic (facts from user)
// -----------------------------
function classifyType(x,y,z, placed){
  const has = (xx,yy,zz)=> placed.has(posKey(xx,yy,zz));
  const sx = has(x-1,y,z) && has(x+1,y,z);
  const sy = has(x,y-1,z) && has(x,y+1,z);
  const sz = has(x,y,z-1) && has(x,y,z+1);

  const count = (sx?1:0) + (sy?1:0) + (sz?1:0);

  if (count >= 2){
    const parity = (Math.abs(x)+Math.abs(y)+Math.abs(z)) & 1;
    return parity === 0 ? "inside_a" : "inside_b";
  }
  if (count === 1){
    if (sx) return "column_x";
    if (sy) return "column_y";
    return "column_z"; // sz true
  }
  return "block";
}

// -----------------------------
// Textures
// -----------------------------
const ASSET_BASE = "../hollow-3x3x3/assets"; // same base used by your current demos

const TEX = {
  block:           `${ASSET_BASE}/controller_powered.png`,
  column:          `${ASSET_BASE}/controller_column_powered.png`,
  inside_a:        `${ASSET_BASE}/controller_inside_a_powered.png`,
  inside_b:        `${ASSET_BASE}/controller_inside_b_powered.png`,
  // lights (sprite sheets)
  block_l:         `${ASSET_BASE}/controller_lights.png`,
  column_l:        `${ASSET_BASE}/controller_column_lights.png`,
  inside_a_l:      `${ASSET_BASE}/controller_lights.png`,
  inside_b_l:      `${ASSET_BASE}/controller_lights.png`,
};

// -----------------------------
// UV-consistent cube geometry (Minecraft-like orientation)
// -----------------------------
// Three.js BoxGeometry's UV orientation differs per face; this creates "mixed" appearance even without logic issues.
// This custom geometry enforces a consistent UV convention per face: U increases to +X (or +Z) and V increases to +Y,
// matching typical Minecraft block UV expectations.
function makeMCBoxGeometry(size=1.0){
  const s = size * 0.5;

  // vertices per face (2 triangles)
  // For each face, define positions and UVs consistently.
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const groups = []; // [{start,count,materialIndex}]
  let vbase = 0;

  function addFace(p0,p1,p2,p3, n, materialIndex){
    // p0..p3 are corners in CCW order when looking at the face from outside
    positions.push(...p0, ...p1, ...p2, ...p3);
    normals.push(...n, ...n, ...n, ...n);

    // UV: p0 (0,0), p1 (1,0), p2 (1,1), p3 (0,1)
    uvs.push(0,0, 1,0, 1,1, 0,1);

    // two triangles: 0-1-2 and 0-2-3
    const i0 = vbase + 0;
    const i1 = vbase + 1;
    const i2 = vbase + 2;
    const i3 = vbase + 3;

    const start = indices.length;
    indices.push(i0,i1,i2,  i0,i2,i3);
    groups.push({ start, count: 6, materialIndex });

    vbase += 4;
  }

  // Face order matches FACE_* indices used elsewhere:
  // FACE_RIGHT(+X)=0, FACE_LEFT(-X)=1, FACE_TOP(+Y)=2, FACE_BOTTOM(-Y)=3, FACE_FRONT(+Z)=4, FACE_BACK(-Z)=5

  // +X (east/right): looking from +X, up=+Y, right=-Z
  addFace([ s,-s, s],[ s,-s,-s],[ s, s,-s],[ s, s, s],[1,0,0], FACE_RIGHT);
  // -X (west/left): looking from -X, up=+Y, right=+Z
  addFace([-s,-s,-s],[-s,-s, s],[-s, s, s],[-s, s,-s],[-1,0,0], FACE_LEFT);
  // +Y (top): looking from +Y, up=-Z, right=+X
  addFace([-s, s, s],[ s, s, s],[ s, s,-s],[-s, s,-s],[0,1,0], FACE_TOP);
  // -Y (bottom): looking from -Y, up=+Z, right=+X
  addFace([-s,-s,-s],[ s,-s,-s],[ s,-s, s],[-s,-s, s],[0,-1,0], FACE_BOTTOM);
  // +Z (south/front): looking from +Z, up=+Y, right=+X
  addFace([-s,-s, s],[ s,-s, s],[ s, s, s],[-s, s, s],[0,0,1], FACE_FRONT);
  // -Z (north/back): looking from -Z, up=+Y, right=-X (but we keep UV right=+X, so vertex order reflects that)
  addFace([ s,-s,-s],[-s,-s,-s],[-s, s,-s],[ s, s,-s],[0,0,-1], FACE_BACK);

  const g = new THREE.BufferGeometry();
  g.setIndex(indices);
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

  // IMPORTANT: Multi-material meshes require groups; without this Three.js will not render the mesh.
  for (const gr of groups){
    g.addGroup(gr.start, gr.count, gr.materialIndex);
  }

  g.computeBoundingSphere();
  return g;
}

// -----------------------------
// Light shader mix material factory
// -----------------------------
function makeMixMaterial(texA, texB, mixUniform){
  // JAR-like "lights" behavior: this is simply an animated light-pattern texture drawn on top.
  // No additive glow / no shader crossfade. If the PNG has transparency, it will naturally overlay.
  const mat = new THREE.MeshBasicMaterial({
    map: texA,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    alphaTest: 0.0,
  });
  mat.toneMapped = false;
  return mat;
}

function rotateTextureByQ(tex, q){
  const qq = ((q|0)%4+4)%4;
  if (qq===0) return tex;
  const t = tex.clone();
  t.center.set(0.5,0.5);
  t.rotation = ROT_90 * qq;
  t.needsUpdate = true;
  return t;
}

function rotateTexture90(tex){
  // Clone and apply +90° rotation around center (0.5,0.5)
  const t = tex.clone();
  t.center.set(0.5,0.5);
  t.rotation = ROT_90;
  t.needsUpdate = true;
  return t;
}



// -----------------------------
// Lights sheet decoding (robust, no scoping bugs)
// -----------------------------
const LIGHT_CACHE = new Map(); // key -> LightSource

function drawFrame(ctx, img, frameIndex, frameW, frameH){
  ctx.clearRect(0,0,frameW,frameH);
  ctx.drawImage(img, 0, frameIndex*frameH, frameW, frameH, 0,0,frameW,frameH);
}

function makeLightSource(sheetUrl){
  if (LIGHT_CACHE.has(sheetUrl)) return LIGHT_CACHE.get(sheetUrl);

  const frameW = 16;
  const frameH = 16;

  const canvasA = document.createElement("canvas");
  canvasA.width = frameW;
  canvasA.height = frameH;
  const canvasB = document.createElement("canvas");
  canvasB.width = frameW;
  canvasB.height = frameH;

  const ctxA = canvasA.getContext("2d");
  const ctxB = canvasB.getContext("2d");

  const texA = new THREE.CanvasTexture(canvasA);
  const texB = new THREE.CanvasTexture(canvasB);
  texA.magFilter = THREE.NearestFilter;
  texA.minFilter = THREE.NearestFilter;
  texB.magFilter = THREE.NearestFilter;
  texB.minFilter = THREE.NearestFilter;

  const mixUniform = { value: 0.0 };

  // Always define faceMap arrays (no conditional scoping).
  const faceMapA = new Array(6).fill(texA);
  const faceMapB = new Array(6).fill(texB);

  const matsVisible = new Array(6);
  for (let i=0;i<6;i++){
    matsVisible[i] = makeMixMaterial(faceMapA[i], faceMapB[i], mixUniform);
  }

  const invisible = new THREE.MeshStandardMaterial({ transparent:true, opacity:0.0, depthWrite:false });

  const img = new Image();
  img.decoding = "async";
  img.src = sheetUrl;

  const src = {
    url: sheetUrl,
    img,
    frameW, frameH,
    frames: 1,
    ready: false,
    ctxA, ctxB,
    texA, texB,
    faceMapA, faceMapB,
    matsVisible,
    invisible,
    mixUniform,
    _t: 0,
    _aFrame: 0,
    _bFrame: 1,
  };

  img.onload = ()=>{
    src.frames = Math.max(1, Math.floor(img.height / frameH));
    src._aFrame = 0;
    src._bFrame = (src.frames>1) ? 1 : 0;

    drawFrame(src.ctxA, img, src._aFrame, frameW, frameH);
    drawFrame(src.ctxB, img, src._bFrame, frameW, frameH);
    src.texA.needsUpdate = true;
    src.texB.needsUpdate = true;

    src.ready = true;
  };
  img.onerror = (e)=>{
    console.error("Failed to load lights sheet:", sheetUrl, e);
    src.ready = false;
  };

  LIGHT_CACHE.set(sheetUrl, src);
  return src;
}

function stepLightSource(src, globalFrame){
  if (!src || !src.ready || src.frames <= 1) return;

  // Sync animation across all sheet types by using a single global frame index.
  // This avoids phase offsets caused by differing image load timing.
  const f = ((globalFrame % src.frames) + src.frames) % src.frames;
  if ((src._aFrame|0) === f) return;

  src._aFrame = f;
  drawFrame(src.ctxA, src.img, src._aFrame, src.frameW, src.frameH);
  src.texA.needsUpdate = true;
}


// -----------------------------
// Main
// -----------------------------
(async function main(){
  var __renderRequested = false; // render request latch (var to avoid TDZ)

  // Basic page setup
  document.body.style.margin = "0";
  document.body.style.overflow = "hidden";
  document.body.style.background = "#000";

  const dbg = makeDebugUI();
  __loadRotDb();

  // Scene / camera / renderer
  const scene = new THREE.Scene();
  // Pick highlight (block outline + selected face)
  const __pickHLGroup = new THREE.Group();
  __pickHLGroup.visible = false;
  scene.add(__pickHLGroup);

  const __pickHLBoxGeom = new THREE.EdgesGeometry(new THREE.BoxGeometry(1,1,1));
  const __pickHLBoxMat = new THREE.LineBasicMaterial({ transparent:true, opacity:0.95, depthTest:false, depthWrite:false });
  const __pickHLBox = new THREE.LineSegments(__pickHLBoxGeom, __pickHLBoxMat);
  __pickHLGroup.add(__pickHLBox);

  const __pickHLFaceGeom = new THREE.PlaneGeometry(1.02, 1.02);
  const __pickHLFaceMat = new THREE.MeshBasicMaterial({ transparent:true, opacity:0.28, side:THREE.DoubleSide, depthTest:false, depthWrite:false });
  const __pickHLFace = new THREE.Mesh(__pickHLFaceGeom, __pickHLFaceMat);
  __pickHLGroup.add(__pickHLFace);
  __pickHLBox.renderOrder = 999;
  __pickHLFace.renderOrder = 1000;

  function __updatePickHighlight(meta){
    if (!meta){
      __pickHLGroup.visible = false;
      return;
    }
    const pos = new THREE.Vector3((meta.x*SPACING)-OFFSET, (meta.y*SPACING)-OFFSET, (meta.z*SPACING)-OFFSET);
    __pickHLGroup.position.copy(pos);

    // Face plane orientation uses WORLD direction (after block rotation)
    const d = meta.worldDir || [0,0,1];
    const nx = d[0], ny = d[1], nz = d[2];
    // normal -> quaternion
    const n = new THREE.Vector3(nx,ny,nz).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), n);
    __pickHLFace.quaternion.copy(q);
    __pickHLFace.position.set(0,0,0).add(n.multiplyScalar(0.51));

    __pickHLGroup.visible = true;
  }

  scene.background = new THREE.Color(0x070707);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(11, 11, 13);

  const renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // Ensure correct color management for textured materials
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.addEventListener("change", () => { requestRender(); });
  // --- Wheel zoom tuning (mouse wheel) ---
  // The default OrbitControls wheel zoom can be finicky on some trackpads; use a
  // deterministic fine-grained dolly instead.
  controls.enableZoom = false;
  controls.zoomSpeed = 0.25; // kept for completeness (unused when enableZoom=false)
  controls.minDistance = 4;
  controls.maxDistance = 180;

  // Ensure OrbitControls receives wheel / touch gestures consistently.
  renderer.domElement.style.touchAction = "none";
  if ("zoomToCursor" in controls) controls.zoomToCursor = true;

  // Fine-grained zoom (trackpad/mouse wheel). This also prevents page scrolling.
  const __zoomBase = 1.00025; // smaller = finer zoom
  renderer.domElement.addEventListener("wheel", (e) => {
    e.preventDefault();
    const dy = e.deltaY;
    if (!dy) return;
    const mag = Math.min(240, Math.abs(dy));
    const factor = Math.pow(__zoomBase, mag);
    const v = new THREE.Vector3().copy(camera.position).sub(controls.target);
    if (dy > 0) v.multiplyScalar(factor); else v.multiplyScalar(1 / factor);
    // Clamp to min/max distance
    const len = v.length();
    if (len < controls.minDistance) v.setLength(controls.minDistance);
    if (len > controls.maxDistance) v.setLength(controls.maxDistance);
    camera.position.copy(controls.target).add(v);
    controls.update();
    requestRender();
  }, { passive: false });

  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.target.set(0,0,0);
  controls.update();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x101010, 0.8);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(7, 10, 6);
  scene.add(dir);

  // Groups
  const worldGroup = new THREE.Group();
  worldGroup.name = "world";
  scene.add(worldGroup);

  // Settings (toggles)
  let PURE_AE2 = true;        // always true in this rebuild (kept for UI compatibility)
  let LIGHTS_ENABLED = false;
  let ANIM_ENABLED = false;
  let WIREFRAME = false;
  let LABELS_ENABLED = false;
  let __lightGlobalT = 0; // global lights timeline (sync across types)
  let MATERIAL_MODE = "ae2";  // "ae2" | "uv" | "faces"

  const cbPure = dbg.mkToggle("Pure AE2", PURE_AE2, (v)=>{ PURE_AE2=v; rebuildWorld();   if (ANIM_ENABLED) { __startAnimLoop(); } else { requestRender(); }
});
  cbPure.disabled = true; // by design in clean rebuild; no legacy mode.
  const cbLights = dbg.mkToggle("Lights", LIGHTS_ENABLED, (v)=>{ LIGHTS_ENABLED=v; __lightGlobalT=0; rebuildWorld(); requestRender(); if (ANIM_ENABLED && LIGHTS_ENABLED) { __startAnimLoop(); } });
  const cbAnim = dbg.mkToggle("Anim", ANIM_ENABLED, (v)=>{ ANIM_ENABLED = v; if (ANIM_ENABLED) { __startAnimLoop(); } else { __stopAnimLoop(); requestRender(); } });
  const cbWire = dbg.mkToggle("Wire", WIREFRAME, (v)=>{ WIREFRAME=v; rebuildWorld(); });
  const cbLabels = dbg.mkToggle("Labels", LABELS_ENABLED, (v)=>{ LABELS_ENABLED=v; rebuildWorld(); });

  dbg.mkSelect("Material", [
    { value:"ae2", label:"AE2 textures" },
    { value:"uv", label:"UV test" },
    { value:"faces", label:"Face colors" },
  ], (v)=>{ MATERIAL_MODE=v; console.log("[UI] Material=", v); rebuildWorld(); });

  // Raycast pick
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let pickInfo = null;
  renderer.domElement.addEventListener("pointerdown", (ev)=>{
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(worldGroup.children, true);
    const hit = hits.find(h => h && h.object && h.object.isInstancedMesh && h.instanceId != null && h.object.userData && h.object.userData.instanceMeta);
    if (!hit){
      pickInfo = null;
      dbg.pickText.textContent = "Pick: none";
      __updatePickHighlight && __updatePickHighlight(null);
      return;
    }
    const meta = hit.object.userData.instanceMeta[hit.instanceId];
    if (!meta){
      pickInfo = null;
      dbg.pickText.textContent = "Pick: none";
      __updatePickHighlight && __updatePickHighlight(null);
      return;
    }
    pickInfo = meta;
    __updatePickHighlight && __updatePickHighlight(pickInfo);
    const wd = meta.worldDir ? ` worldDir=(${meta.worldDir[0]},${meta.worldDir[1]},${meta.worldDir[2]})` : "";
    const localName = __FACE_NAME_BY_INDEX[meta.face] || `face${meta.face}`;
    const worldName = __dirName(meta.worldDir);
    dbg.pickText.textContent = `Pick: (${meta.x},${meta.y},${meta.z}) type=${meta.type} localFace=${meta.face} ${localName} world=${worldName} blockRot=(${meta.rx.toFixed(2)},${meta.ry.toFixed(2)},${meta.rz.toFixed(2)}) texRotQ=${meta.rotQ}`;
    console.log("[PICK]", meta);
    function __updateRotUI(sel){
      if (!dbg.rotSel) return;
      if (!sel){
        dbg.rotSel.textContent = "No selection";
        dbg.rxv.textContent = dbg.ryv.textContent = dbg.rzv.textContent = "";
        return;
      }
      const r = __getRotXYZ(sel.x, sel.y, sel.z, sel.face);
      dbg.rotSel.textContent = `Selected: (${sel.x},${sel.y},${sel.z})\n`+
        `localFace=${sel.face} ${__FACE_NAME_BY_INDEX[sel.face]||""}\n`+
        `world=${__dirName(sel.worldDir)}\n`+
        `rotQ(face)=${__getRotQ(sel.x,sel.y,sel.z,sel.face)}\n`+
        `stored quarters: X=${r.rx} Y=${r.ry} Z=${r.rz}`;
      dbg.rxv.textContent = `${r.rx} (${r.rx*90}°)`;
      dbg.ryv.textContent = `${r.ry} (${r.ry*90}°)`;
      dbg.rzv.textContent = `${r.rz} (${r.rz*90}°)`;
    }
    
    // Wire rotation buttons once (they operate on current pickInfo)
    if (!window.__rotUiWired){
      window.__rotUiWired = true;

      function __refresh(){
        __updateRotUI(pickInfo);
        __updatePickHighlight && __updatePickHighlight(pickInfo);
      }

      function __bump(axis, delta){
        if (!pickInfo) return;
        const k = __rk(pickInfo.x, pickInfo.y, pickInfo.z, pickInfo.face);
        const cur = __getRotXYZ(pickInfo.x, pickInfo.y, pickInfo.z, pickInfo.face);
        const next = { rx:cur.rx, ry:cur.ry, rz:cur.rz };
        if (axis==="x") next.rx = (next.rx + delta) & 3;
        if (axis==="y") next.ry = (next.ry + delta) & 3;
        if (axis==="z") next.rz = (next.rz + delta) & 3;
        __faceRotDb.set(k, next);
        __saveRotDb();
        rebuildWorld();
        __refresh();
      }

      function __bumpFace(delta){
        if (!pickInfo) return;
        // Rotate texture around the selected face normal.
        const axis = (pickInfo.face===0||pickInfo.face===1) ? "x" : (pickInfo.face===2||pickInfo.face===3) ? "y" : "z";
        __bump(axis, delta);
      }

      dbg.rxm && dbg.rxm.addEventListener("click", ()=>__bump("x",-1));
      dbg.rxp && dbg.rxp.addEventListener("click", ()=>__bump("x", 1));
      dbg.rym && dbg.rym.addEventListener("click", ()=>__bump("y",-1));
      dbg.ryp && dbg.ryp.addEventListener("click", ()=>__bump("y", 1));
      dbg.rzm && dbg.rzm.addEventListener("click", ()=>__bump("z",-1));
      dbg.rzp && dbg.rzp.addEventListener("click", ()=>__bump("z", 1));

      dbg.rotReset && dbg.rotReset.addEventListener("click", ()=>{
        if (!pickInfo) return;
        const k = __rk(pickInfo.x, pickInfo.y, pickInfo.z, pickInfo.face);
        __faceRotDb.set(k, __defaultRotXYZ(pickInfo.x, pickInfo.y, pickInfo.z, pickInfo.face));
        __saveRotDb();
        rebuildWorld();
        __refresh();
      });

      dbg.rotCopy && dbg.rotCopy.addEventListener("click", async ()=>{
        if (!pickInfo) return;
        const r = __getRotXYZ(pickInfo.x, pickInfo.y, pickInfo.z, pickInfo.face);
        const line =
          `(${pickInfo.x},${pickInfo.y},${pickInfo.z})` +
          ` localFace=${pickInfo.face} ${__FACE_NAME_BY_INDEX[pickInfo.face]||""}` +
          ` world=${__dirName(pickInfo.worldDir)}` +
          ` rotXYZ_quarters={x:${r.rx},y:${r.ry},z:${r.rz}}` +
          ` rotQ(face)=${__getRotQ(pickInfo.x,pickInfo.y,pickInfo.z,pickInfo.face)}`;
        try{
          await navigator.clipboard.writeText(line);
        }catch(e){
          console.log("[COPY]", line);
        }
      });

      // Ensure highlight reacts to selection changes
      __refresh();
    }

  });

  // Texture loader with status list
  const texLoader = new THREE.TextureLoader();
  const texStatus = new Map(); // url -> {status, err?}

  function setTexStatus(url, status, err){
    texStatus.set(url, { status, err });
    renderTexList();
  }
  function renderTexList(){
    dbg.texList.innerHTML = "";
    for (const [url, info] of texStatus.entries()){
      const row = document.createElement("div");
      row.style.cssText = "display:flex;justify-content:space-between;gap:8px";
      const left = document.createElement("div");
      left.textContent = url;
      left.style.cssText = "max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0.95";
      const right = document.createElement("div");
      right.textContent = info.status;
      right.style.cssText = info.status === "ok" ? "color:#b8ffb8" : info.status === "loading" ? "color:#ffeaa7" : "color:#ff9b9b";
      row.appendChild(left);
      row.appendChild(right);
      dbg.texList.appendChild(row);
    }
  }

  async function loadTexture(url){
    setTexStatus(url, "loading");
    return await new Promise((resolve)=>{
      texLoader.load(url, (tex)=>{
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        setTexStatus(url, "ok");
        resolve(tex);
      }, undefined, (err)=>{
        setTexStatus(url, "error", err);
        resolve(null);
      });
    });
  }

  // UV test / Face colors
  function makeUVTestTexture(){
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#111"; ctx.fillRect(0,0,c.width,c.height);
    ctx.strokeStyle = "#666";
    for (let i=0;i<=8;i++){
      const p = i*16;
      ctx.beginPath(); ctx.moveTo(p,0); ctx.lineTo(p,128); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,p); ctx.lineTo(128,p); ctx.stroke();
    }
    ctx.fillStyle = "#fff";
    ctx.font = "14px ui-monospace,Consolas,monospace";
    ctx.fillText("U→", 8, 20);
    ctx.fillText("V↓", 8, 40);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }

  const uvTestTex = makeUVTestTexture();
  const faceColorTex = (()=> {
    // not needed; we'll use per-face solid materials
    return null;
  })();

  // Load base textures
  const [texBlock, texColumn, texInsideA, texInsideB] = await Promise.all([
    loadTexture(TEX.block),
    loadTexture(TEX.column),
    loadTexture(TEX.inside_a),
    loadTexture(TEX.inside_b),
  ]);

  // Lights (sprite sheets) - loaded via Image, still show status.
  function preflightImage(url){
    setTexStatus(url, "loading");
    return new Promise((resolve)=>{
      const img = new Image();
      img.decoding = "async";
      img.onload = ()=> { setTexStatus(url, "ok"); resolve(true); };
      img.onerror = ()=> { setTexStatus(url, "error"); resolve(false); };
      img.src = url;
    });
  }
  await Promise.all([
    preflightImage(TEX.block_l),
    preflightImage(TEX.column_l),
    preflightImage(TEX.inside_a_l),
    preflightImage(TEX.inside_b_l),
  ]);

  // -----------------------------
  // Shared geometry (PERF): render ONLY visible faces using InstancedMesh
  // -----------------------------
  // Front face plane matching makeMCBoxGeometry's FACE_FRONT vertex order + UV.
  function makeMCFacePlaneGeometry(size=1.0, zOffset=0.5){
    const s = size * 0.5;
    const pos = [
      -s, -s,  zOffset,
       s, -s,  zOffset,
       s,  s,  zOffset,
      -s,  s,  zOffset,
    ];
    const nrm = [0,0,1, 0,0,1, 0,0,1, 0,0,1];
    const uv  = [0,0, 1,0, 1,1, 0,1];
    const idx = [0,1,2, 0,2,3];
    const g = new THREE.BufferGeometry();
    g.setIndex(idx);
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.computeBoundingSphere();
    return g;
  }

  // Visible surface geometry: base + a slightly offset copy for additive lights.
  const faceGeom = makeMCFacePlaneGeometry(1.0, 0.5);
  const faceGeomLight = makeMCFacePlaneGeometry(1.0, 0.501);

  // Local face orientation matrices (from a +Z plane).
  const __faceRotEuler = [
    new THREE.Euler(0, ROT_90, 0),           // RIGHT  (+X)
    new THREE.Euler(0, -ROT_90, 0),          // LEFT   (-X)
    new THREE.Euler(-ROT_90, 0, 0),          // TOP    (+Y)
    new THREE.Euler(ROT_90, 0, 0),           // BOTTOM (-Y)
    new THREE.Euler(0, 0, 0),                // FRONT  (+Z)
    new THREE.Euler(0, Math.PI, 0),          // BACK   (-Z)
  ];

  // Pre-baked face transforms (rotation * translate(+Z 0.5)).
  const __faceMat = new Array(6);
  const __tmpQ = new THREE.Quaternion();
  for (let f=0; f<6; f++){
    const r = __faceRotEuler[f];
    __tmpQ.setFromEuler(r);
    // Translation is already embedded in the face geometry's zOffset.
    __faceMat[f] = new THREE.Matrix4().makeRotationFromQuaternion(__tmpQ);
  }

  // Base materials (created from loaded textures)
  function baseMaterialFromTexture(tex){
    if (!tex) {
      // fallback to obvious error material
      return new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe:WIREFRAME, side: THREE.DoubleSide });
    }
    return new THREE.MeshBasicMaterial({ map: tex, wireframe:WIREFRAME, side: THREE.DoubleSide });
  }

  const invisibleMat = new THREE.MeshBasicMaterial({ transparent:true, opacity:0.0, depthWrite:false, side: THREE.DoubleSide });

  // Labels
  function makeLabel(text){
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.clearRect(0,0,128,128);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0,0,128,128);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px ui-sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent:true });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(0.8,0.8,0.8);
    return sp;
  }

  // Build placed set once
  const placed = buildPlacedSet();

  // Light sources per type
  const lightSrcByType = {
    block:     makeLightSource(TEX.block_l),
    column:    makeLightSource(TEX.column_l),
    inside_a:  makeLightSource(TEX.inside_a_l),
    inside_b:  makeLightSource(TEX.inside_b_l),
  };

  // World rebuild
  function clearGroup(g){
    // IMPORTANT: do not dispose shared geometry/material on UI toggles.
    // Disposing the shared Box/MC geometry causes meshes to become invisible after the first rebuild.
    while (g.children.length){
      const c = g.children.pop();
      if (c.parent) c.parent.remove(c);
    }
  }

  function typeToBaseTexture(type){
    if (type === "column_x" || type === "column_y" || type === "column_z") return texColumn;
    if (type === "inside_a") return texInsideA;
    if (type === "inside_b") return texInsideB;
    return texBlock;
  }

  function typeToLightSource(type){
    if (type === "column_x" || type === "column_y" || type === "column_z") return lightSrcByType.column;
    if (type === "inside_a") return lightSrcByType.inside_a;
    if (type === "inside_b") return lightSrcByType.inside_b;
    return lightSrcByType.block;
  }

  function makeFaceColorMats(){
    const mk = (c)=> new THREE.MeshBasicMaterial({ color:c, wireframe:WIREFRAME, side: THREE.DoubleSide });
    const m = new Array(6);
    m[FACE_RIGHT] = mk(0xff5555);
    m[FACE_LEFT]  = mk(0x55ff55);
    m[FACE_TOP]   = mk(0x5555ff);
    m[FACE_BOTTOM]= mk(0xffff55);
    m[FACE_FRONT] = mk(0xff55ff);
    m[FACE_BACK]  = mk(0x55ffff);
    return m;
  }

  function buildMaterialsForBlock(x,y,z,type){
    // Base: 6 materials, default same; apply special rot90 by cloning texture.
    let baseMats;
    if (MATERIAL_MODE === "uv"){
      const mat = baseMaterialFromTexture(uvTestTex);
      baseMats = new Array(6).fill(mat);
    } else if (MATERIAL_MODE === "faces"){
      baseMats = makeFaceColorMats();
    } else {
      const baseTex = typeToBaseTexture(type);
      // For special rot90, create per-face material only when needed; otherwise share one.
      const sharedMat = baseMaterialFromTexture(baseTex);
      baseMats = new Array(6).fill(sharedMat);
      for (let f=0; f<6; f++){
        if (!needsRot90ForFace(x,y,z,f)) continue;
        if (!baseTex) continue;
        const t = rotateTexture90(baseTex);
        baseMats[f] = baseMaterialFromTexture(t);
      }
    }

    // Lights: 6 materials, default from light source; apply special rot90 by rotating BOTH texA/texB (via clone) per face.
    let lightMats = null;
    if (LIGHTS_ENABLED && MATERIAL_MODE === "ae2"){
      const src = typeToLightSource(type);
      // Use src mats but clone and apply rot90 when needed.
      lightMats = new Array(6);
      for (let f=0; f<6; f++){
        // if face should be invisible (interior), we still draw but it's ok; for now we always show as in AE2 demo.
        if (!needsRot90ForFace(x,y,z,f)){
          lightMats[f] = src.matsVisible[f];
        } else {
          // Create a one-off mixed mat with rotated textures, sharing mix uniform.
          const tA = rotateTexture90(src.faceMapA[f]);
          const tB = rotateTexture90(src.faceMapB[f]);
          const m = makeMixMaterial(tA, tB, src.mixUniform);
          lightMats[f] = m;
        }
        lightMats[f].wireframe = WIREFRAME;
      }
    }
    return { baseMats, lightMats };
  }

  function applyBlockRotation(group, type){
    // Column direction by mesh rotation only
    group.rotation.set(0,0,0);
    if (type === "column_y") return;
    if (type === "column_z"){
      group.rotation.x = ROT_90;
      return;
    }
    if (type === "column_x"){
      group.rotation.x = ROT_90;
      group.rotation.y = ROT_90;
      return;
    }
  }

  // Rebuild stats for quick sanity checks.
  let __lastWorldStats = { blocks: 0, faces: 0, meshes: 0 };

  function rebuildWorld(){
    clearGroup(worldGroup);

    // -----------------------------
    // Materials cache per rebuild
    // -----------------------------
    const __rotTexCache = new WeakMap();
    const __baseMatCache = new Map();
    const __lightMatCache = new Map();
    const __uvMat = baseMaterialFromTexture(uvTestTex);
    __uvMat.wireframe = WIREFRAME;
    const __faceColorMats = (MATERIAL_MODE === "faces") ? makeFaceColorMats() : null;

    function __getRotTex(tex, q){
      if (!tex) return tex;
      const qq = ((q|0)%4+4)%4;
      if (qq===0) return tex;
      let m = __rotTexCache.get(tex);
      if (!m){ m = new Map(); __rotTexCache.set(tex, m); }
      if (m.has(qq)) return m.get(qq);
      const t = rotateTextureByQ(tex, qq);
      m.set(qq, t);
      return t;
    }

    function __baseMatFor(type, faceIndex, rotQ){
      if (MATERIAL_MODE === "uv") return __uvMat;
      if (MATERIAL_MODE === "faces") return __faceColorMats[faceIndex];

      const baseTex = typeToBaseTexture(type);
      const useTex = __getRotTex(baseTex, rotQ);
      const key = `ae2|${type}|${rotQ}|${useTex?useTex.uuid:"null"}|wf=${WIREFRAME}`;
      if (__baseMatCache.has(key)) return __baseMatCache.get(key);
      const mat = baseMaterialFromTexture(useTex);
      __baseMatCache.set(key, mat);
      return mat;
    }

    function __lightMatFor(type, rotQ){
      if (!(LIGHTS_ENABLED && MATERIAL_MODE === "ae2")) return null;
      const src = typeToLightSource(type);
      const key = `${src.url}|${rotQ}|wf=${WIREFRAME}`;
      if (__lightMatCache.has(key)) return __lightMatCache.get(key);

      // In this demo, the light sheets are the same for all faces (faceMapA/B are filled with texA/texB),
      // so we can use a single mix material per type (+ optional rot90).
      let tA = src.texA;
      let tB = src.texB;
      if ((rotQ|0)!==0){
        tA = __getRotTex(tA, rotQ);
        tB = __getRotTex(tB, rotQ);
      }
      const mat = makeMixMaterial(tA, tB, src.mixUniform);
      mat.wireframe = WIREFRAME;
      __lightMatCache.set(key, mat);
      return mat;
    }

    // -----------------------------
    // Instancing groups
    // -----------------------------
    const groups = new Map(); // key -> { geom, mat, matrices: Matrix4[], meta: any[] }
    function __push(groupKey, geom, mat, matrix, meta){
      let g = groups.get(groupKey);
      if (!g){
        g = { geom, mat, matrices: [], meta: [] };
        groups.set(groupKey, g);
      }
      g.matrices.push(matrix);
      g.meta.push(meta);
    }

    // Local normals in face-index order
    const __localNormals = [
      new THREE.Vector3( 1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3( 0, 1, 0),
      new THREE.Vector3( 0,-1, 0),
      new THREE.Vector3( 0, 0, 1),
      new THREE.Vector3( 0, 0,-1),
    ];

    function __dirFromNormal(n){
      const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      if (ax > 0.5) return [n.x > 0 ? 1 : -1, 0, 0];
      if (ay > 0.5) return [0, n.y > 0 ? 1 : -1, 0];
      return [0, 0, n.z > 0 ? 1 : -1];
    }

    function __blockEuler(type){
      // Same as applyBlockRotation, but returned as Euler for math.
      if (type === "column_z") return new THREE.Euler(ROT_90, 0, 0);
      if (type === "column_x") return new THREE.Euler(ROT_90, ROT_90, 0);
      return new THREE.Euler(0, 0, 0); // block, inside_*, column_y
    }

    const __one = new THREE.Vector3(1,1,1);
    const __pos = new THREE.Vector3();
    const __quat = new THREE.Quaternion();
    const __mBlock = new THREE.Matrix4();
    const __m = new THREE.Matrix4();
    const __worldN = new THREE.Vector3();

    const blocksCount = placed.size;
    let facesCount = 0;

    for (let y=0; y<GRID; y++){
      for (let z=0; z<GRID; z++){
        for (let x=0; x<GRID; x++){
          if (!placed.has(posKey(x,y,z))) continue;

          const type = classifyType(x,y,z, placed);
          const e = __blockEuler(type);
          __quat.setFromEuler(e);
          __pos.set((x*SPACING)-OFFSET, (y*SPACING)-OFFSET, (z*SPACING)-OFFSET);
          __mBlock.compose(__pos, __quat, __one);

          // Optional labels (debug) - keep identical behavior, but only when enabled.
          if (LABELS_ENABLED){
            const sp = makeLabel(`${x},${y},${z}`);
            sp.position.copy(__pos).add(new THREE.Vector3(0, 0.7, 0));
            worldGroup.add(sp);
          }

          for (let f=0; f<6; f++){
            // Determine which WORLD direction this LOCAL face points to after block rotation,
            // then cull faces that are adjacent to another block in that direction.
            __worldN.copy(__localNormals[f]).applyEuler(e);
            const dir = __dirFromNormal(__worldN);
            const nx = x + dir[0];
            const ny = y + dir[1];
            const nz = z + dir[2];
            const neighborInside = (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID && nz >= 0 && nz < GRID) && placed.has(posKey(nx,ny,nz));
            if (neighborInside) continue;

            const rotQ = __getRotQ(x,y,z,f);
            const baseMat = __baseMatFor(type, f, rotQ);
            __m.copy(__mBlock).multiply(__faceMat[f]);
            __push(`B|${baseMat.uuid}`, faceGeom, baseMat, __m.clone(), { x,y,z,type, face:f, rx:e.x, ry:e.y, rz:e.z, worldDir:dir, rotQ: rotQ, rotXYZ: __getRotXYZ(x,y,z,f) });
            facesCount++;

            const lightMat = __lightMatFor(type, rotQ);
            if (lightMat){
              // Same transform; geometry is slightly offset to prevent z-fighting.
              __push(`L|${lightMat.uuid}`, faceGeomLight, lightMat, __m.clone(), { x,y,z,type, face:f, rx:e.x, ry:e.y, rz:e.z, worldDir:dir, rotQ: rotQ, rotXYZ: __getRotXYZ(x,y,z,f) });
            }
          }
        }
      }
    }

    // Build instanced meshes
    for (const g of groups.values()){
      const count = g.matrices.length;
      if (!count) continue;
      const inst = new THREE.InstancedMesh(g.geom, g.mat, count);
      // Safer for small demos: avoid bounding-sphere issues with instancing.
      inst.frustumCulled = false;
      inst.userData.instanceMeta = g.meta;
      for (let i=0; i<count; i++) inst.setMatrixAt(i, g.matrices[i]);
      inst.instanceMatrix.needsUpdate = true;
      worldGroup.add(inst);
    }

    __lastWorldStats = { blocks: blocksCount, faces: facesCount, meshes: worldGroup.children.length };
    requestRender();
  }

  rebuildWorld();
  // show block count immediately
  try {
    dbg.pickText.textContent = `Pick: none (blocks=${__lastWorldStats.blocks}, visibleFaces=${__lastWorldStats.faces}, meshes=${__lastWorldStats.meshes})`;
  } catch(e) {}
  // ---- DevTools exposure (module scope -> window) ----
  // This is required because ES modules do not create global variables; without this, `scene` / `rebuildWorld`
  // are `undefined` in the console. Expose minimal handles for fact-based debugging.
  window.__cube7x7x7 = {
    scene, camera, renderer, controls,
    worldGroup,
    get settings(){ return { LIGHTS_ENABLED, ANIM_ENABLED, WIREFRAME, LABELS_ENABLED, MATERIAL_MODE }; },
    rebuildWorld,
  };
  // Convenience aliases
  window.scene = scene;
  window.rebuildWorld = rebuildWorld;
  window.worldGroup = worldGroup;


  // Resize
  window.addEventListener("resize", ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Animation loop
  let last = safeNowMs();
  // ---- Performance: cap animation FPS + stop loop when not needed ----
  const __ANIM_FPS_CAP = 30;
  const __MIN_FRAME_MS = 1000 / __ANIM_FPS_CAP;
  let __animRaf = null;
  let __lastFrameMs = 0;

  function __startAnimLoop(){
    if (__animRaf != null) return;
    __lastFrameMs = 0;
    __animRaf = __animRaf = requestAnimationFrame(tick);
  }
  function __stopAnimLoop(){
    if (__animRaf == null) return;
    cancelAnimationFrame(__animRaf);
    __animRaf = null;
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) __stopAnimLoop();
    else if (ANIM_ENABLED) __startAnimLoop();
  });

  // Render-on-demand when animation is OFF
  function requestRender(){
    if (__renderRequested) return;
    __renderRequested = true;
    requestAnimationFrame(() => {
      __renderRequested = false;
      renderer.render(scene, camera);
    });
  }

  function tick(t){
    // Stop continuous rendering unless animation is enabled and tab is visible
    if (!ANIM_ENABLED || document.hidden){
      __stopAnimLoop();
      requestRender();
      return;
    }
    if (!t) t = performance.now();
    if (__lastFrameMs && (t - __lastFrameMs) < __MIN_FRAME_MS){
      __animRaf = __animRaf = requestAnimationFrame(tick);
      return;
    }
    __lastFrameMs = t;

    requestAnimationFrame(tick);
    controls.update();

    const now = safeNowMs();
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;

    if (ANIM_ENABLED && LIGHTS_ENABLED){
      // advance all light sheets (globally synchronized)
      __lightGlobalT += dt;
      const __gFrame = Math.floor(__lightGlobalT / 0.20);
      stepLightSource(lightSrcByType.block, __gFrame);
      stepLightSource(lightSrcByType.column, __gFrame);
      stepLightSource(lightSrcByType.inside_a, __gFrame);
      stepLightSource(lightSrcByType.inside_b, __gFrame);
    }
    renderer.render(scene, camera);
  }
  tick();
})().catch((e)=>{
  console.error(e);
  const pre = document.createElement("pre");
  pre.style.cssText = "position:fixed;inset:0;background:#000;color:#ffb4b4;white-space:pre-wrap;padding:12px;margin:0;z-index:99999;overflow:auto;font:12px/1.4 ui-monospace,Consolas,monospace";
  pre.textContent = String(e?.stack || e);
  document.body.appendChild(pre);
});

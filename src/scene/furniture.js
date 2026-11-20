// =============================================================
// scene/furniture.js
// 방을 채우는 가구·소품 "만드는 함수" 모음. (배치는 room1.js / room2.js에서)
// 각지지 않게: 모서리를 둥글린 상자(RoundedBoxGeometry), 선반으로 깎은 다리(LatheGeometry),
// 아치형 벽난로(ExtrudeGeometry), 진짜처럼 흔들리는 불꽃(Sprite)을 쓴다.
// - 가죽 소파·안락의자, 둥근 탁자, 벽난로, 진열장, 궤짝, 나무 상자, 종이 상자, 탁자, 의자
// - 촛불, 러그, 액자, 거미줄, 흩어진 종이, 말라 죽은 화분, 천을 덮은 형체, 쓰러진 스탠드, 촛대
// 각 함수는 Group을 돌려준다. collide 옵션이 있으면 충돌 박스도 등록한다.
// =============================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { addCollider, mat, handPrintMesh } from './helpers.js';
import { createCandleFlame, createFireSheet } from './flame.js';
import { LIGHT_BUS } from './lighting.js';

const M = {
  wood: mat(0x3e2416, { roughness: 0.6 }),
  darkWood: mat(0x22140c, { roughness: 0.55 }),
  leather: new THREE.MeshPhysicalMaterial({ color: 0x6a0a0a, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.3 }),
  brass: mat(0x8a6a34, { metalness: 0.85, roughness: 0.35 }),
  wax: mat(0xd8ccb0, { roughness: 0.6 }),
  soot: mat(0x0a0706, { roughness: 1 }),
};

const V2 = (arr) => arr.map(([a, b]) => new THREE.Vector2(a, b));

function place(ctx, g, x, z, rotY = 0, y = 0) {
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  ctx.scene.add(g);
  return g;
}

/** 모서리가 둥근 상자 */
function rb(parent, { w, h, d, x = 0, y, z = 0, material, r = 0.03, seg = 4 }) {
  const radius = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, radius), material);
  m.position.set(x, y ?? h / 2, z);
  parent.add(m);
  return m;
}

/** 선반으로 깎은 듯한 가구 다리 (높이 h) */
const legCache = {};
function turnedLeg(parent, x, z, h, material, r = 0.035) {
  const key = `${h}_${r}`;
  if (!legCache[key]) {
    const prof = [[0.6, 0], [1, 0.04], [0.7, 0.1], [0.55, 0.3], [0.9, 0.42], [0.6, 0.5], [0.5, 0.8], [0.8, 0.9], [0.8, 1]];
    legCache[key] = new THREE.LatheGeometry(V2(prof.map(([rr, yy]) => [rr * r, yy * h])), 14);
  }
  const m = new THREE.Mesh(legCache[key], material);
  m.position.set(x, 0, z);
  parent.add(m);
  return m;
}

function tweenRot(ctx, obj, axis, to, duration) {
  ctx.animations.push({ obj, prop: 'rotation', axis, from: obj.rotation[axis], to, t: 0, duration });
}
function tweenPos(ctx, obj, axis, to, duration) {
  ctx.animations.push({ obj, prop: 'position', axis, from: obj.position[axis], to, t: 0, duration });
}

function colliderFor(ctx, x, z, w, d, rotY) {
  const along = Math.abs(Math.sin(rotY)) > 0.5;
  addCollider(ctx, x, z, along ? d : w, along ? w : d);
}

let _glow;
function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

// ---------------- 촛불 ----------------
const waxMat = new THREE.MeshPhysicalMaterial({ color: 0xe8dcc4, roughness: 0.55, sheen: 0.4, emissive: 0x2a1204, emissiveIntensity: 0.6 });
const wickMat = mat(0x111111);

/** 촛불 하나 (parent 기준 좌표, 바닥 y). 셰이더 불꽃이 진짜처럼 흔들린다 */
export function candle(ctx, parent, x, y, z, h = 0.15, r = 0.024) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  // 위가 살짝 녹아 오목한 기둥 + 흘러내린 촛농
  const prof = [[0, 0], [r * 1.02, 0], [r, h * 0.5], [r * 0.98, h], [r * 0.7, h - 0.004], [r * 0.2, h - 0.008], [0, h - 0.008]];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 20), waxMat));
  for (let i = 0; i < 2 + ((Math.random() * 2) | 0); i++) {
    const a = Math.random() * Math.PI * 2;
    const len = h * (0.2 + Math.random() * 0.5);
    const d = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.12, len, 4, 6), waxMat);
    d.position.set(Math.cos(a) * r * 0.98, h - len / 2 - 0.004, Math.sin(a) * r * 0.98);
    g.add(d);
  }
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.012, 5), wickMat);
  wick.position.y = h - 0.002;
  wick.rotation.z = 0.15;
  g.add(wick);
  const flame = createCandleFlame(0.045 + r * 0.6);
  flame.position.y = h + 0.002;
  g.add(flame);
  parent.add(g);
  return g;
}

/** 은은한 촛불 빛 (그림자 없음). 너무 많이 쓰면 느려지니 방마다 1~2개만 */
export function candleLight(ctx, x, y, z, intensity = 2.5) {
  const l = new THREE.PointLight(0xff9a40, intensity, 4, 2);
  l.position.set(x, y, z);
  ctx.scene.add(l);
  let t = Math.random() * 5;
  ctx.updaters.push((dt) => {
    t += dt;
    l.intensity = intensity * (0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7));
  });
  return l;
}

// ---------------- 소파 / 안락의자 ----------------
/** 광택 있는 붉은 가죽 소파 (seats=2) 또는 안락의자 (seats=1). 로컬 +z가 등받이, 앞은 -z */
export function sofa(ctx, x, z, rotY, { seats = 2 } = {}) {
  const g = new THREE.Group();
  const seatW = 0.82;
  const inner = seatW * seats;
  const W = inner + 0.48;
  const L = M.leather;
  rb(g, { w: W - 0.1, h: 0.28, d: 0.86, y: 0.24, material: L, r: 0.07 });
  for (let i = 0; i < seats; i++) {
    const cx = -inner / 2 + seatW * (i + 0.5);
    rb(g, { w: seatW - 0.02, h: 0.17, d: 0.7, x: cx, y: 0.46, z: -0.05, material: L, r: 0.08, seg: 6 });
    const back = rb(g, { w: seatW - 0.03, h: 0.5, d: 0.2, x: cx, y: 0.78, z: 0.22, material: L, r: 0.09, seg: 6 });
    back.rotation.x = -0.14;
  }
  rb(g, { w: W - 0.1, h: 0.62, d: 0.2, y: 0.66, z: 0.36, material: L, r: 0.09 });
  for (const s of [-1, 1]) {
    const ax = s * (inner / 2 + 0.12);
    rb(g, { w: 0.22, h: 0.4, d: 0.86, x: ax, y: 0.43, material: L, r: 0.08 });
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.88, 28), L); // 둥글게 말린 팔걸이
    roll.rotation.x = Math.PI / 2;
    roll.scale.set(1, 1, 0.85);
    roll.position.set(ax + s * 0.02, 0.64, 0);
    g.add(roll);
    for (const lz of [-0.33, 0.33]) turnedLeg(g, ax, lz, 0.1, M.darkWood, 0.03);
  }
  colliderFor(ctx, x, z, W, 0.9, rotY);
  return place(ctx, g, x, z, rotY);
}

export const armchair = (ctx, x, z, rotY) => sofa(ctx, x, z, rotY, { seats: 1 });

// ---------------- 탁자·의자 ----------------
export function roundTable(ctx, x, z, r = 0.3, h = 0.6) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.LatheGeometry(V2([[0, -0.02], [r - 0.015, -0.02], [r, 0], [r - 0.015, 0.02], [0, 0.02]]), 40), M.wood);
  top.position.y = h;
  g.add(top);
  const prof = [[0.2, 0], [0.22, 0.02], [0.08, 0.06], [0.05, 0.12], [0.07, 0.3], [0.04, 0.55], [0.05, 0.8], [0.03, 0.95], [0.07, 1]];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(V2(prof.map(([a, b]) => [a * (r / 0.3), b * (h - 0.02)])), 24), M.darkWood));
  addCollider(ctx, x, z, r * 2, r * 2);
  return place(ctx, g, x, z);
}

export function table(ctx, x, z, w = 1.4, d = 0.8, rotY = 0) {
  const g = new THREE.Group();
  rb(g, { w, h: 0.06, d, y: 0.76, material: M.wood, r: 0.025 });
  rb(g, { w: w - 0.14, h: 0.1, d: d - 0.14, y: 0.68, material: M.darkWood, r: 0.015 });
  for (const [lx, lz] of [[-w / 2 + 0.08, -d / 2 + 0.08], [w / 2 - 0.08, -d / 2 + 0.08], [-w / 2 + 0.08, d / 2 - 0.08], [w / 2 - 0.08, d / 2 - 0.08]]) {
    turnedLeg(g, lx, lz, 0.73, M.darkWood, 0.04);
  }
  colliderFor(ctx, x, z, w, d, rotY);
  return place(ctx, g, x, z, rotY);
}

export function chair(ctx, x, z, rotY = 0) {
  const g = new THREE.Group();
  rb(g, { w: 0.46, h: 0.05, d: 0.46, y: 0.46, material: M.darkWood, r: 0.02 });
  const back = rb(g, { w: 0.44, h: 0.5, d: 0.04, y: 0.76, z: 0.21, material: M.darkWood, r: 0.018 });
  back.rotation.x = -0.1;
  for (const [lx, lz] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) turnedLeg(g, lx, lz, 0.44, M.darkWood, 0.025);
  return place(ctx, g, x, z, rotY);
}

// ---------------- 벽난로 ----------------


let _brickTex;
function brickTexture() {
  if (_brickTex) return _brickTex;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#4a4038'; // 줄눈
  g.fillRect(0, 0, 512, 512);
  const bh = 30;
  const bw = 84;
  for (let row = 0; row < 512 / bh + 1; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < 512 / bw + 1; col++) {
      const v = 120 + Math.random() * 45;
      const warm = Math.random() * 12;
      g.fillStyle = `rgb(${(v + warm) | 0},${(v * 0.9) | 0},${(v * 0.78) | 0})`;
      const x = col * bw + off + 2;
      const y = row * bh + 2;
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, bw - 5, bh - 5, 4);
      else g.rect(x, y, bw - 5, bh - 5);
      g.fill();
      // 표면 얼룩과 패인 자국
      for (let k = 0; k < 60; k++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,240,220'},${Math.random() * 0.12})`;
        g.fillRect(x + Math.random() * (bw - 6), y + Math.random() * (bh - 6), 1 + Math.random() * 3, 1 + Math.random() * 2);
      }
    }
  }
  _brickTex = new THREE.CanvasTexture(c);
  _brickTex.colorSpace = THREE.SRGBColorSpace;
  _brickTex.wrapS = _brickTex.wrapT = THREE.RepeatWrapping;
  return _brickTex;
}

/** 벽돌 재질 (meter 단위로 텍스처가 반복되도록 repeat 지정) */
function brickMat(rx, ry, tint = 0xffffff) {
  const t = brickTexture().clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  return new THREE.MeshStandardMaterial({ map: t, color: tint, roughness: 0.92, bumpMap: t, bumpScale: 2 });
}

let _barkTex;
function barkTexture() {
  if (_barkTex) return _barkTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2a1c12';
  g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 300; i++) {
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? '10,6,4' : '90,66,44'},${0.3 + Math.random() * 0.5})`;
    g.lineWidth = 1 + Math.random() * 2;
    const y = Math.random() * 64;
    g.beginPath();
    g.moveTo(Math.random() * 256, y);
    g.lineTo(Math.random() * 256, y + (Math.random() - 0.5) * 6);
    g.stroke();
  }
  _barkTex = new THREE.CanvasTexture(c);
  _barkTex.colorSpace = THREE.SRGBColorSpace;
  return _barkTex;
}

let _emberTex;
function emberTexture() {
  if (_emberTex) return _emberTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 64);
  // 숯 표면의 갈라진 틈에서 빛나는 불씨
  for (let i = 0; i < 70; i++) {
    g.strokeStyle = `rgba(255,${80 + Math.random() * 100},20,${0.5 + Math.random() * 0.5})`;
    g.lineWidth = 0.8 + Math.random() * 2.5;
    let x = Math.random() * 256;
    let y = Math.random() * 64;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (Math.random() - 0.3) * 20;
      y += (Math.random() - 0.5) * 10;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  _emberTex = new THREE.CanvasTexture(c);
  return _emberTex;
}

/** 벽돌 아치 벽난로 (사진 같은 형태). 로컬 +z가 방 안쪽. 장작 위로 불길이 일렁인다 */
export function fireplace(ctx, x, z, rotY) {
  const g = new THREE.Group();
  const W = 2.5;
  const H = 2.25;
  const ow = 1.15; // 아치 폭
  const oh = 0.55; // 아치가 시작되는 높이
  const r = ow / 2;

  // 굴뚝 정면 (아치 구멍)
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, 0);
  shape.lineTo(W / 2, 0);
  shape.lineTo(W / 2, H);
  shape.lineTo(-W / 2, H);
  shape.lineTo(-W / 2, 0);
  const hole = new THREE.Path();
  hole.moveTo(-r, 0.12);
  hole.lineTo(-r, oh);
  hole.absarc(0, oh, r, Math.PI, 0, true);
  hole.lineTo(r, 0.12);
  hole.lineTo(-r, 0.12);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 32 });
  // 텍스처 좌표를 미터 단위로 (정면은 x,y / 옆면은 z도 섞어서)
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + pos.getZ(i)) / 1.6, pos.getY(i) / 1.6);
  const front = new THREE.Mesh(geo, brickMat(1, 1));
  front.position.z = -0.12;
  g.add(front);

  // 아치를 따라 둘러쌓은 큰 돌 (사진처럼 부채꼴)
  const stoneM = new THREE.MeshStandardMaterial({ map: brickTexture(), color: 0xd8ccb8, roughness: 0.95, bumpMap: brickTexture(), bumpScale: 1.5 });
  const n = 15;
  for (let i = 0; i < n; i++) {
    const a = Math.PI - (i + 0.5) * (Math.PI / n);
    const key = i === (n - 1) / 2;
    const v = new THREE.Mesh(new RoundedBoxGeometry(key ? 0.17 : 0.13, key ? 0.3 : 0.25, 0.08, 2, 0.015), stoneM);
    const rr = r + 0.13 + (key ? 0.02 : 0);
    v.position.set(Math.cos(a) * rr, oh + Math.sin(a) * rr, 0.2);
    v.rotation.z = a - Math.PI / 2;
    g.add(v);
  }
  // 아치 아래 기둥 돌
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const st = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.16, 0.08, 2, 0.015), stoneM);
    st.position.set(s * (r + 0.13), 0.22 + k * 0.17, 0.2);
    g.add(st);
  }

  // 화실: 안쪽으로 비스듬히 좁아지는 그을린 벽돌 벽
  const soot = brickMat(0.8, 0.6, 0x4a3a32);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(ow * 0.8, oh + r), soot);
  back.position.set(0, (oh + r) / 2 + 0.12, -0.55);
  g.add(back);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(0.48, oh + r), soot);
    side.position.set(s * ow * 0.45, (oh + r) / 2 + 0.12, -0.33);
    side.rotation.y = -s * 1.2;
    g.add(side);
  }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(ow, 0.5), mat(0x080605));
  top.rotation.x = Math.PI / 2;
  top.position.set(0, oh + r + 0.1, -0.33);
  g.add(top);
  // 그을음 (아치 위쪽 검게)
  const sootDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(1.3, 0.9),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false })
  );
  sootDecal.position.set(0, oh + r + 0.1, 0.25);
  g.add(sootDecal);

  // 바닥 돌판 (앞으로 튀어나온 단)
  const hearth = rb(g, { w: W * 0.95, h: 0.12, d: 0.6, y: 0.06, z: 0.42, material: brickMat(2.4, 0.4, 0xb0a090), r: 0.02 });
  rb(g, { w: ow, h: 0.12, d: 0.55, y: 0.06, z: -0.3, material: soot, r: 0.01 });

  // 장작 받침 (무쇠)
  const iron = new THREE.MeshStandardMaterial({ color: 0x141210, metalness: 0.7, roughness: 0.5 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.32, 10), iron);
    post.position.set(s * 0.32, 0.28, 0.0);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), iron);
    ball.position.set(s * 0.32, 0.45, 0.0);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 8), iron);
    foot.rotation.x = Math.PI / 2;
    foot.position.set(s * 0.32, 0.15, -0.18);
    g.add(post, ball, foot);
  }
  for (const [yy, zz] of [[0.18, 0.0], [0.18, -0.2], [0.18, -0.38]]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.66, 8), iron);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, yy, zz);
    g.add(bar);
  }

  // 장작 (나무껍질) + 타고 있는 숯
  const barkM = new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 1 });
  const charM = new THREE.MeshStandardMaterial({ color: 0x0c0806, roughness: 1, emissive: 0xffffff, emissiveMap: emberTexture(), emissiveIntensity: 1.5 });
  const logs = [
    [-0.08, 0.22, -0.15, 0.25, barkM],
    [0.1, 0.22, -0.22, -0.2, charM],
    [0.0, 0.31, -0.18, 0.05, charM],
    [-0.15, 0.3, -0.3, -0.5, barkM],
  ];
  for (const [lx, ly, lz, ry, m] of logs) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.62, 16), m);
    log.rotation.set(0, ry, Math.PI / 2);
    log.position.set(lx, ly, lz);
    g.add(log);
  }
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.4, 24), new THREE.MeshStandardMaterial({ color: 0x2a2624, roughness: 1, emissive: 0xff3a08, emissiveMap: emberTexture(), emissiveIntensity: 0.6 }));
  ash.rotation.x = -Math.PI / 2;
  ash.scale.set(1, 0.6, 1);
  ash.position.set(0, 0.125, -0.25);
  g.add(ash);

  // 불길: 셰이더 불꽃 여러 장
  const fires = [
    [0, 0.24, -0.2, 0.62, 0.72],
    [-0.16, 0.24, -0.15, 0.4, 0.5],
    [0.17, 0.24, -0.25, 0.42, 0.55],
    [0.02, 0.3, -0.12, 0.3, 0.38],
  ];
  for (const [fx, fy, fz, fw, fh] of fires) {
    const f = createFireSheet(fw, fh);
    f.position.set(fx, fy, fz);
    g.add(f);
  }
  // 튀어 오르는 불티
  const sparkN = 40;
  const sp = new Float32Array(sparkN * 3);
  const sv = new Float32Array(sparkN);
  const resetSpark = (i) => {
    sp[i * 3] = (Math.random() - 0.5) * 0.4;
    sp[i * 3 + 1] = 0.3 + Math.random() * 0.2;
    sp[i * 3 + 2] = -0.2 + (Math.random() - 0.5) * 0.2;
    sv[i] = 0.3 + Math.random() * 0.6;
  };
  for (let i = 0; i < sparkN; i++) {
    resetSpark(i);
    sp[i * 3 + 1] += Math.random() * 0.8;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({ color: 0xffa040, size: 0.018, map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  g.add(sparks);

  const glow = new THREE.PointLight(0xff6a1a, 7, 7, 2);
  glow.position.set(0, 0.55, 0.5);
  g.add(glow);
  let t = 0;
  ctx.updaters.push((dt) => {
    t += dt;
    const k = 0.8 + 0.2 * Math.sin(t * 8.3) * Math.sin(t * 5.1) + Math.random() * 0.06;
    glow.intensity = 7 * k;
    charM.emissiveIntensity = 1.2 + 0.6 * k;
    for (let i = 0; i < sparkN; i++) {
      sp[i * 3 + 1] += sv[i] * dt;
      sp[i * 3] += Math.sin(t * 3 + i) * 0.05 * dt;
      if (sp[i * 3 + 1] > oh + r - 0.05) resetSpark(i);
    }
    sparkGeo.attributes.position.needsUpdate = true;
  });

  // 사진처럼 바닥 단 위에 놓인 기둥 초들
  const candles = [[-0.95, 0.12, 0.45, 0.26, 0.045], [-0.82, 0.12, 0.6, 0.16, 0.04], [-1.05, 0.12, 0.62, 0.12, 0.035], [0.88, 0.12, 0.5, 0.22, 0.045], [1.02, 0.12, 0.62, 0.14, 0.04]];
  for (const [cx, cy, cz, ch, cr] of candles) candle(ctx, g, cx, cy, cz, ch, cr);

  colliderFor(ctx, x, z, W * 0.95, 0.9, rotY);
  return place(ctx, g, x, z, rotY);
}

// ---------------- 수납 ----------------
/** 유리 진열장 (안에 병과 해골) — 로컬 +z가 앞 */
export function cabinet(ctx, x, z, rotY) {
  // 속이 빈 진열장: 아래는 닫힌 수납장, 위는 유리문 진열칸
  const g = new THREE.Group();
  const W = 1.1, D = 0.45, Y0 = 0.06, Y1 = 2.0, GL = 0.74; // GL = 유리칸 시작 높이
  const H = Y1 - Y0;
  rb(g, { w: W, h: H, d: 0.03, y: Y0 + H / 2, z: -D / 2 + 0.015, material: M.darkWood, r: 0.01 }); // 뒤판
  for (const sx of [-1, 1]) rb(g, { w: 0.04, h: H, d: D, x: sx * (W / 2 - 0.02), y: Y0 + H / 2, material: M.darkWood, r: 0.012 });
  rb(g, { w: W, h: GL - Y0, d: D, y: Y0 + (GL - Y0) / 2, material: M.darkWood, r: 0.02 }); // 아래 수납부
  for (const sx of [-0.25, 0.25]) {
    rb(g, { w: 0.46, h: 0.5, d: 0.02, x: sx, y: 0.4, z: D / 2, material: M.wood, r: 0.01 });
    rb(g, { w: 0.03, h: 0.08, d: 0.03, x: sx + (sx < 0 ? 0.18 : -0.18), y: 0.42, z: D / 2 + 0.02, material: M.brass, r: 0.01 });
  }
  rb(g, { w: W, h: 0.04, d: D, y: Y1 - 0.02, material: M.darkWood, r: 0.01 }); // 천장판
  rb(g, { w: 1.2, h: 0.08, d: 0.52, y: Y1 + 0.03, material: M.darkWood, r: 0.03 }); // 상판 장식
  for (const [fx, fz] of [[-0.48, -0.17], [0.48, -0.17], [-0.48, 0.17], [0.48, 0.17]]) turnedLeg(g, fx, fz, 0.06, M.darkWood, 0.04);

  // 안쪽 붉은 벨벳 안감 (어둠 속에서도 형체가 보이게 살짝 발광)
  const lining = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.1, Y1 - GL - 0.06),
    mat(0x3a0a0a, { roughness: 1, emissive: 0x1c0404 })
  );
  lining.position.set(0, (GL + Y1) / 2, -D / 2 + 0.032);
  g.add(lining);
  // 선반 두 칸
  const sh1 = 1.12, sh2 = 1.55;
  for (const sy of [sh1, sh2]) rb(g, { w: W - 0.08, h: 0.025, d: D - 0.06, y: sy, z: -0.01, material: M.wood, r: 0.008 });

  // 아래 칸: 포르말린 병
  const jarMat = new THREE.MeshPhysicalMaterial({ color: 0x6a5a2a, transparent: true, opacity: 0.55, roughness: 0.08, clearcoat: 1, emissive: 0x140c02 });
  const liquid = mat(0x8a7a3a, { roughness: 0.3, emissive: 0x1a1404, transparent: true, opacity: 0.8 });
  const lidM = mat(0x2a2420, { metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const h = 0.2 + (i % 2) * 0.08;
    const jx = -0.36 + i * 0.24;
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h, 18), jarMat);
    jar.position.set(jx, GL + 0.02 + h / 2, -0.02);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, h * 0.8, 16), liquid);
    liq.position.set(jx, GL + 0.02 + h * 0.4, -0.02);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 18), lidM);
    lid.position.set(jx, GL + 0.02 + h + 0.012, -0.02);
    // 병 속에 떠 있는 무언가
    const thing = new THREE.Mesh(new THREE.SphereGeometry(0.032 + (i % 3) * 0.008, 10, 8), mat(0xb8a088, { roughness: 0.6 }));
    thing.scale.set(1, 1.3, 0.9);
    thing.position.set(jx + 0.01, GL + 0.02 + h * 0.45, -0.02);
    g.add(jar, liq, lid, thing);
  }
  // 가운데 칸: 해골 (선반 위에 놓임)
  const bone = mat(0xcfc2a4, { roughness: 0.7, emissive: 0x100c08 });
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 18), bone);
  skull.scale.set(0.9, 1, 1.1);
  skull.position.set(0.05, sh1 + 0.14, -0.02);
  const jaw = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.05, 0.1, 3, 0.02), bone);
  jaw.position.set(0.05, sh1 + 0.04, 0.03);
  const eyeM = mat(0x050202);
  for (const ex of [0.01, 0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), eyeM);
    eye.position.set(ex, sh1 + 0.15, 0.08);
    g.add(eye);
  }
  g.add(skull, jaw);
  // 명패 '수집품 No.47'
  const pc = document.createElement('canvas');
  pc.width = 256; pc.height = 64;
  const p2 = pc.getContext('2d');
  p2.fillStyle = '#8a6a2a'; p2.fillRect(0, 0, 256, 64);
  p2.strokeStyle = '#4a3410'; p2.lineWidth = 6; p2.strokeRect(3, 3, 250, 58);
  p2.fillStyle = '#1a0e04'; p2.font = 'bold 30px serif'; p2.textAlign = 'center'; p2.textBaseline = 'middle';
  p2.fillText('수집품 No.47', 128, 34);
  const plaqueTex = new THREE.CanvasTexture(pc);
  plaqueTex.colorSpace = THREE.SRGBColorSpace;
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.04), new THREE.MeshStandardMaterial({ map: plaqueTex, metalness: 0.5, roughness: 0.4, emissive: 0x1a1206, emissiveMap: plaqueTex }));
  plaque.position.set(0.05, sh1 - 0.02, D / 2 - 0.035);
  g.add(plaque);
  // 위 칸: 낡은 책과 촛대
  rb(g, { w: 0.2, h: 0.05, d: 0.15, x: -0.25, y: sh2 + 0.04, material: mat(0x3a1a12), r: 0.01 });
  rb(g, { w: 0.06, h: 0.22, d: 0.16, x: 0.3, y: sh2 + 0.12, material: mat(0x2a1a10), r: 0.01 });

  // 유리문 틀
  const fz = D / 2 - 0.01;
  const gH = Y1 - 0.04 - GL, gC = (GL + Y1 - 0.04) / 2;
  for (const sx of [-1, 1]) rb(g, { w: 0.05, h: gH, d: 0.03, x: sx * (W / 2 - 0.045), y: gC, z: fz, material: M.darkWood, r: 0.01 });
  rb(g, { w: W - 0.04, h: 0.05, d: 0.03, y: Y1 - 0.065, z: fz, material: M.darkWood, r: 0.01 });
  rb(g, { w: W - 0.04, h: 0.05, d: 0.03, y: GL + 0.025, z: fz, material: M.darkWood, r: 0.01 });
  rb(g, { w: 0.03, h: gH, d: 0.03, y: gC, z: fz, material: M.darkWood, r: 0.008 }); // 가운데 문살
  rb(g, { w: 0.02, h: 0.07, d: 0.02, x: 0.04, y: gC, z: fz + 0.025, material: M.brass, r: 0.006 });

  // 유리 안쪽 면에 찍힌 피 손자국 — 안에서 밖으로 밀어낸 모양이라 좌우 반전
  const gz = fz - 0.012;
  const prints = [
    { x: -0.22, y: gC + 0.2, s: 0.22, r: 0.15, o: 1 },
    { x: 0.24, y: gC + 0.05, s: 0.23, r: -0.2, o: 1 },
    { x: -0.16, y: gC - 0.25, s: 0.2, r: 0.4, o: 0.85 }, // 미끄러지며 흘러내린 자국
  ];
  for (const pp of prints) {
    const hp = handPrintMesh(pp.s);
    hp.material.emissive = new THREE.Color(0x3a0202);
    hp.material.color = new THREE.Color(0x9a1010);
    hp.material.emissiveMap = hp.material.map;
    hp.material.opacity = pp.o;
    hp.position.set(pp.x, pp.y, gz);
    hp.rotation.z = pp.r;
    hp.scale.x = -1;
    hp.renderOrder = 2;
    g.add(hp);
  }
  // 김 서린 듯한 유리 (손자국 위에 그려지도록 나중에)
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.1, gH),
    new THREE.MeshPhysicalMaterial({ color: 0x99aaaa, transparent: true, opacity: 0.08, roughness: 0.35, clearcoat: 0.25, depthWrite: false })
  );
  glass.position.set(0, gC, fz);
  glass.renderOrder = 3;
  g.add(glass);

  colliderFor(ctx, x, z, 1.1, 0.45, rotY);
  return place(ctx, g, x, z, rotY);
}

/** 궤짝. 클릭하면 뚜껑이 열린다 (g.userData.open) */
export function chest(ctx, x, z, rotY = 0) {
  const g = new THREE.Group();
  rb(g, { w: 0.9, h: 0.45, d: 0.5, material: M.wood, r: 0.03 });
  for (const bx of [-0.3, 0.3]) rb(g, { w: 0.05, h: 0.47, d: 0.52, x: bx, material: M.brass, r: 0.01 });
  rb(g, { w: 0.1, h: 0.12, d: 0.04, y: 0.38, z: 0.26, material: M.brass, r: 0.01 });
  // 안에 든 것 (뚜껑이 열리면 보임)
  const doll = new THREE.Mesh(new THREE.SphereGeometry(0.08, 18, 14), mat(0xd8c8b8, { roughness: 0.4 }));
  doll.position.set(-0.15, 0.42, 0);
  const dollEyes = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(0x050202));
  dollEyes.scale.set(1.6, 0.6, 0.5);
  dollEyes.position.set(-0.15, 0.44, 0.075);
  const album = rb(g, { w: 0.3, h: 0.06, d: 0.24, x: 0.15, y: 0.42, material: mat(0x3a1a12), r: 0.01 });
  g.add(doll, dollEyes);
  // 뚜껑 (뒤쪽 경첩)
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.45, -0.25);
  g.add(pivot);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.9, 28, 1, false, 0, Math.PI), M.wood);
  lid.rotation.z = Math.PI / 2;
  lid.position.set(0, 0, 0.25);
  pivot.add(lid);
  for (const bx of [-0.3, 0.3]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.256, 0.256, 0.05, 28, 1, true, 0, Math.PI), M.brass);
    band.rotation.z = Math.PI / 2;
    band.position.set(bx, 0, 0.25);
    pivot.add(band);
  }
  g.userData.open = () => tweenRot(ctx, pivot, 'x', -1.35, 1.4);
  addCollider(ctx, x, z, 0.9, 0.9);
  return place(ctx, g, x, z, rotY);
}

/** 나무 상자. 클릭하면 뚜껑이 들썩이며 비껴 열린다 */
export function crate(ctx, x, z, s = 0.6, y = 0, rotY = 0, collide = true) {
  const g = new THREE.Group();
  const plank = mat(new THREE.Color(0x4a3018).offsetHSL(0, 0, (Math.random() - 0.5) * 0.04), { roughness: 0.95 });
  rb(g, { w: s, h: s - 0.04, d: s, material: plank, r: 0.012 });
  for (const yy of [0.06, s / 2]) rb(g, { w: s + 0.015, h: 0.05, d: s + 0.015, y: yy, material: M.darkWood, r: 0.01 });
  // 안의 짚
  rb(g, { w: s * 0.9, h: 0.03, d: s * 0.9, y: s - 0.08, material: mat(0x8a7444, { roughness: 1 }), r: 0.01 });
  const lid = rb(g, { w: s + 0.02, h: 0.04, d: s + 0.02, y: s - 0.02, material: M.darkWood, r: 0.01 });
  g.userData.open = () => {
    tweenRot(ctx, lid, 'z', 0.25, 0.6);
    tweenPos(ctx, lid, 'x', s * 0.45, 0.6);
    tweenPos(ctx, lid, 'y', s + 0.02, 0.3);
  };
  if (collide) addCollider(ctx, x, z, s, s);
  return place(ctx, g, x, z, rotY, y);
}

/** 낡은 종이 상자. 닫힌 상자는 클릭하면 덮개가 열린다 (g.userData.open) */
export function cardboardBox(ctx, x, z, { w = 0.55, h = 0.4, d = 0.45, y = 0, rotY = 0, open = false, collide = true } = {}) {
  const g = new THREE.Group();
  const cm = mat(new THREE.Color(0x6e4e2c).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06), { roughness: 1 });
  // 속이 빈 상자 (옆면 4장 + 바닥)
  rb(g, { w, h: 0.01, d, y: 0.005, material: cm, r: 0.003 });
  rb(g, { w, h, d: 0.012, z: d / 2, material: cm, r: 0.004 });
  rb(g, { w, h, d: 0.012, z: -d / 2, material: cm, r: 0.004 });
  rb(g, { w: 0.012, h, d, x: w / 2, material: cm, r: 0.004 });
  rb(g, { w: 0.012, h, d, x: -w / 2, material: cm, r: 0.004 });
  // 내용물: 종이 뭉치, 오래된 편지
  rb(g, { w: w * 0.8, h: h * 0.5, d: d * 0.8, material: mat(0xa89c84), r: 0.01 });
  // 덮개 두 장 (경첩은 앞뒤 모서리)
  const flaps = [];
  for (const sgn of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, h, (sgn * d) / 2);
    const flap = new THREE.Mesh(new RoundedBoxGeometry(w, 0.008, d / 2, 2, 0.003), cm);
    flap.position.z = (-sgn * d) / 4;
    pivot.add(flap);
    if (sgn === 1) {
      const tape = rb(pivot, { w: 0.07, h: 0.004, d: d / 2, y: 0.005, z: -d / 4, material: mat(0x9a8866, { roughness: 0.5 }), r: 0.001 });
      tape.userData.tape = true;
    }
    g.add(pivot);
    flaps.push({ pivot, sgn });
  }
  const openNow = (dur) => flaps.forEach(({ pivot, sgn }) => tweenRot(ctx, pivot, 'x', sgn * 2.1, dur));
  if (open) openNow(0.001);
  g.userData.open = () => openNow(0.9);
  if (collide) addCollider(ctx, x, z, Math.max(w, d), Math.max(w, d));
  return place(ctx, g, x, z, rotY, y);
}

// ---------------- 작은 소품 ----------------
/** 와인잔 */
export function wineGlass(parent, x, y, z, filled = true) {
  const gm = new THREE.MeshPhysicalMaterial({ color: 0xccdddd, transparent: true, opacity: 0.3, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide });
  const prof = [[0, 0], [0.03, 0], [0.03, 0.004], [0.005, 0.012], [0.004, 0.09], [0.02, 0.1], [0.036, 0.13], [0.034, 0.17]];
  const glass = new THREE.Mesh(new THREE.LatheGeometry(V2(prof), 20), gm);
  glass.position.set(x, y, z);
  parent.add(glass);
  if (filled) {
    const wine = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.02, 0.035, 18), new THREE.MeshPhysicalMaterial({ color: 0x3a0006, roughness: 0.05, clearcoat: 1 }));
    wine.position.set(x, y + 0.12, z);
    parent.add(wine);
  }
}

/** 문양 러그 (클릭 이동이 되도록 floors에 등록) — 낡고 색이 바랜 느낌 */
export function rug(ctx, x, z, w, d) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const g = canvas.getContext('2d');
  g.fillStyle = '#3a0c0c';
  g.fillRect(0, 0, 512, 384);
  g.strokeStyle = '#6a5428';
  g.lineWidth = 9;
  g.strokeRect(20, 20, 472, 344);
  g.lineWidth = 3;
  g.strokeRect(42, 42, 428, 300);
  g.fillStyle = '#4a1610';
  g.beginPath();
  g.ellipse(256, 192, 140, 90, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#6a5428';
  g.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.beginPath();
    g.arc(256 + Math.cos(a) * 110, 192 + Math.sin(a) * 65, 10, 0, Math.PI * 2);
    g.stroke();
  }
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '120,90,70'},${Math.random() * 0.12})`;
    g.fillRect(Math.random() * 512, Math.random() * 384, 3, 3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.003, z);
  ctx.scene.add(m);
  ctx.floors.push(m);
  return m;
}

let _ghostTex;
/** 액자 속에서 튀어나오는 창백한 얼굴 */
export function ghostTexture() {
  if (_ghostTex) return _ghostTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#050303';
  g.fillRect(0, 0, 256, 320);
  // 긴 검은 머리카락
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(128, 150, 105, 160, 0, 0, Math.PI * 2);
  g.fill();
  // 창백한 얼굴
  const face = g.createRadialGradient(128, 150, 10, 128, 160, 90);
  face.addColorStop(0, '#d8d4cc');
  face.addColorStop(0.7, '#a8a49c');
  face.addColorStop(1, '#3a3836');
  g.fillStyle = face;
  g.beginPath();
  g.ellipse(128, 160, 62, 88, 0, 0, Math.PI * 2);
  g.fill();
  // 앞머리가 얼굴을 가림
  g.fillStyle = '#000';
  for (let i = 0; i < 26; i++) {
    g.beginPath();
    const x = 70 + i * 4.6;
    g.moveTo(x, 50);
    g.quadraticCurveTo(x + (Math.random() - 0.5) * 20, 130, x + (Math.random() - 0.5) * 30, 110 + Math.random() * 90);
    g.lineWidth = 3 + Math.random() * 3;
    g.strokeStyle = '#000';
    g.stroke();
  }
  // 텅 빈 검은 눈과 피눈물
  for (const ex of [100, 156]) {
    const e = g.createRadialGradient(ex, 150, 2, ex, 150, 20);
    e.addColorStop(0, '#000');
    e.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = e;
    g.beginPath();
    g.ellipse(ex, 150, 20, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(110,0,0,0.9)';
    g.fillRect(ex - 2, 158, 4, 40 + Math.random() * 30);
  }
  // 벌어진 입
  const m = g.createRadialGradient(128, 222, 2, 128, 222, 22);
  m.addColorStop(0, '#000');
  m.addColorStop(1, 'rgba(0,0,0,0.2)');
  g.fillStyle = m;
  g.beginPath();
  g.ellipse(128, 222, 15, 26, 0, 0, Math.PI * 2);
  g.fill();
  _ghostTex = new THREE.CanvasTexture(c);
  _ghostTex.colorSpace = THREE.SRGBColorSpace;
  return _ghostTex;
}

/** 귀신 얼굴 평면 (처음엔 투명). 액자 안쪽에 붙인다 */
export function ghostPlane(w, h) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: ghostTexture(), transparent: true, opacity: 0, fog: false }));
  m.visible = false;
  m.userData.isGhost = true;
  return m;
}

/** 벽에 거는 액자 (벽 안쪽 위치, 벽이 바라보는 방향 rotY). 오래 보면 귀신이 나타날 수 있다 */
export function frame(ctx, x, y, z, rotY, w = 0.6, h = 0.8, tilt = 0) {
  const g = new THREE.Group();
  const f = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.05, 3, 0.015), mat(0x5a3e16, { metalness: 0.5, roughness: 0.45 }));
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.12, h - 0.12), mat(0x1a100e));
  pic.position.z = 0.027;
  const shape = new THREE.Mesh(new THREE.CircleGeometry(w * 0.18, 24), mat(0x2e1a14));
  shape.position.set(0, h * 0.08, 0.029);
  const ghost = ghostPlane(w - 0.12, h - 0.12);
  ghost.position.z = 0.032;
  g.add(f, pic, shape, ghost);
  g.userData.ghost = ghost;
  g.position.set(x, y, z);
  g.rotation.set(0, rotY, tilt);
  ctx.scene.add(g);
  ctx.cutaway.push(g);
  return g;
}

/** 모서리 거미줄 (방 구석 위쪽). sx, sz = 방 안쪽 방향(±1) */
export function cobweb(ctx, x, y, z, sx, sz, size = 0.7) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const g = canvas.getContext('2d');
  g.strokeStyle = 'rgba(220,210,200,0.45)';
  g.lineWidth = 1.2;
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI;
    g.beginPath();
    g.moveTo(128, 0);
    g.lineTo(128 + Math.cos(a) * 180, Math.sin(a) * 180);
    g.stroke();
  }
  for (let r = 20; r < 180; r += 22) {
    g.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI;
      const rr = r + Math.sin(i * 2.3) * 5;
      const px = 128 + Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false })
  );
  m.geometry.translate(0, -size / 2, 0);
  m.position.set(x, y, z);
  m.lookAt(x + sx, y - 0.3, z + sz);
  ctx.scene.add(m);
  ctx.cutaway.push(m);
  return m;
}

/** 바닥에 흩어진 종이 (살짝 구겨진 느낌) */
export function papers(ctx, cx, cz, n = 6, spread = 0.8) {
  const pm = mat(0xb8ae94, { side: THREE.DoubleSide });
  const group = new THREE.Group();
  ctx.scene.add(group);
  for (let i = 0; i < n; i++) {
    const geo = new THREE.PlaneGeometry(0.21, 0.29, 4, 4);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) p.setZ(k, (Math.random() - 0.5) * 0.008);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, pm);
    m.rotation.set(-Math.PI / 2, 0, Math.random() * Math.PI);
    m.position.set(cx + (Math.random() - 0.5) * spread, 0.01 + i * 0.001, cz + (Math.random() - 0.5) * spread);
    group.add(m);
  }
  return group;
}

/** 말라 죽은 화분 */
export function deadPlant(ctx, x, z) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.LatheGeometry(V2([[0, 0], [0.15, 0], [0.17, 0.03], [0.21, 0.36], [0.23, 0.38], [0.22, 0.4]]), 24), mat(0x5a3020)));
  const twig = mat(0x2e2014);
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.014, 0.7 + Math.random() * 0.4, 6), twig);
    s.position.y = 0.7;
    s.rotation.set((Math.random() - 0.5) * 0.9, 0, (Math.random() - 0.5) * 0.9);
    g.add(s);
  }
  addCollider(ctx, x, z, 0.45, 0.45);
  return place(ctx, g, x, z);
}

/** 천을 덮어씌운 사람 형체. 클릭하면 천이 흘러내리며 안의 마네킹이 드러난다 */
export function coveredShape(ctx, x, z, rotY = 0) {
  const g = new THREE.Group();
  const L = 2.0;
  const D = 1.0;
  const geo = new THREE.PlaneGeometry(L, D, 60, 30);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const blob = (px, pz, cx, cz, rx, rz, h) => {
    const d = ((px - cx) / rx) ** 2 + ((pz - cz) / rz) ** 2;
    return d < 1 ? h * Math.sqrt(1 - d) : 0;
  };
  for (let i = 0; i < p.count; i++) {
    const px = p.getX(i);
    const pz = p.getZ(i);
    let hgt = Math.max(
      blob(px, pz, 0.75, 0, 0.14, 0.12, 0.2),
      blob(px, pz, 0.3, 0, 0.42, 0.24, 0.22),
      blob(px, pz, -0.4, 0.1, 0.5, 0.09, 0.14),
      blob(px, pz, -0.4, -0.1, 0.5, 0.09, 0.14),
      blob(px, pz, -0.88, 0.1, 0.06, 0.06, 0.2),
      blob(px, pz, -0.88, -0.1, 0.06, 0.06, 0.2)
    );
    const near = Math.max(blob(px, pz, 0.3, 0, 0.62, 0.42, 0.1), blob(px, pz, -0.4, 0, 0.7, 0.32, 0.07));
    hgt = Math.max(hgt, near, 0.01) + Math.sin(px * 13 + pz * 7) * 0.005;
    p.setY(i, hgt);
  }
  geo.computeVertexNormals();
  const sheetGroup = new THREE.Group();
  sheetGroup.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8e8270, roughness: 1, side: THREE.DoubleSide })));
  const stain = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), new THREE.MeshStandardMaterial({ color: 0x3a0306, roughness: 0.3, transparent: true, opacity: 0.85 }));
  stain.rotation.x = -Math.PI / 2;
  stain.position.set(0.32, 0.226, 0.04);
  stain.scale.set(1.4, 1, 1);
  sheetGroup.add(stain);
  g.add(sheetGroup);
  // 천 아래: 창백한 마네킹 머리와 피 묻은 손
  const plastic = mat(0xcfc6bc, { roughness: 0.35 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), plastic);
  head.scale.set(1.1, 0.9, 0.95);
  head.position.set(0.76, 0.1, 0);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), mat(0x5a0a0a, { roughness: 0.3 }));
  hand.scale.set(1.5, 0.5, 1);
  hand.position.set(0.55, 0.04, 0.32);
  g.add(head, hand);
  g.userData.open = () => {
    tweenPos(ctx, sheetGroup, 'x', -0.65, 1.2);
    tweenPos(ctx, sheetGroup, 'y', -0.04, 1.2);
    tweenRot(ctx, sheetGroup, 'y', 0.18, 1.2);
  };
  addCollider(ctx, x, z, 1.4, 1.4);
  return place(ctx, g, x, z, rotY);
}

/** 쓰러진 스탠드 조명 */
export function fallenLamp(ctx, x, z, rotY = 0) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.5, 12), M.brass);
  pole.rotation.z = Math.PI / 2;
  pole.position.set(0, 0.05, 0);
  const base = new THREE.Mesh(new THREE.LatheGeometry(V2([[0, 0], [0.17, 0], [0.16, 0.03], [0.04, 0.06], [0.02, 0.07]]), 24), M.brass);
  base.rotation.z = Math.PI / 2.2;
  base.position.set(-0.75, 0.15, 0);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.24, 0.3, 24, 1, true), mat(0x5a4030, { side: THREE.DoubleSide }));
  shade.rotation.z = -Math.PI / 2.4;
  shade.position.set(0.8, 0.18, 0);
  g.add(pole, base, shade);
  return place(ctx, g, x, z, rotY);
}

/** 세워진 촛대 (3갈래) */
export function candelabra(ctx, x, z) {
  const g = new THREE.Group();
  const prof = [[0.2, 0], [0.19, 0.03], [0.06, 0.08], [0.03, 0.2], [0.05, 0.5], [0.025, 0.7], [0.04, 1.0], [0.025, 1.2], [0.04, 1.28], [0, 1.3]];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(V2(prof), 24), M.brass));
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.012, 8, 24, Math.PI), M.brass);
  arm.rotation.z = Math.PI;
  arm.position.y = 1.31;
  g.add(arm);
  candle(ctx, g, -0.24, 1.31, 0, 0.18);
  candle(ctx, g, 0, 1.31, 0, 0.22);
  candle(ctx, g, 0.24, 1.31, 0, 0.14);
  addCollider(ctx, x, z, 0.35, 0.35);
  return place(ctx, g, x, z);
}

/**
 * 둥글둥글한 버섯 모양 탁상 조명 (켜져 있음).
 * 반투명 호박색 유리 갓 안에서 전구가 따뜻하게 빛나고, 책상 위에 둥근 빛 웅덩이를 만든다.
 * 정전/암전 때는 같이 꺼지고, 가끔 미세하게 떨린다. parent 기준 (x, y, z)에 놓임.
 */
const BULB_COL = new THREE.Color(0xfff0d0);
export function deskLamp(ctx, parent, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const brass = new THREE.MeshStandardMaterial({ color: 0x9a7a40, metalness: 0.85, roughness: 0.3 });
  // 동글납작한 받침
  const base = new THREE.Mesh(new THREE.LatheGeometry(V2([[0, 0], [0.095, 0], [0.105, 0.012], [0.1, 0.03], [0.07, 0.045], [0.025, 0.055], [0, 0.056]]), 40), brass);
  // 살짝 배가 부른 기둥
  const stem = new THREE.Mesh(new THREE.LatheGeometry(V2([[0.02, 0], [0.016, 0.05], [0.028, 0.13], [0.03, 0.17], [0.016, 0.22], [0.012, 0.26], [0, 0.265]]), 24), brass);
  stem.position.y = 0.05;
  // 버섯 갓 (둥근 돔, 반투명 호박색 유리)
  const domeProfile = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 0.5;
    domeProfile.push([Math.sin(a) * 0.17 + 0.0001, Math.cos(a) * 0.13]);
  }
  domeProfile.push([0.175, -0.008], [0.165, -0.012]);
  const shadeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffb060,
    emissive: 0xff8a30,
    emissiveIntensity: 1.1,
    roughness: 0.35,
    transmission: 0,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    clearcoat: 0.6,
  });
  const shade = new THREE.Mesh(new THREE.LatheGeometry(V2(domeProfile), 48), shadeMat);
  shade.position.y = 0.3;
  // 갓 꼭대기 장식
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), brass);
  knob.position.y = 0.435;
  // 갓 안쪽 전구 (아래에서 보면 하얗게 빛남)
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), bulbMat);
  bulb.position.y = 0.33;
  // 갓 둘레의 은은한 빛 번짐
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff9a50, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(0.9, 0.7, 1);
  halo.position.y = 0.36;
  g.add(base, stem, shade, knob, bulb, halo);
  // 실제 빛: 책상 위를 비추는 따뜻한 점광원
  const light = new THREE.PointLight(0xffa860, 5, 3.2, 1.6);
  light.position.y = 0.28;
  g.add(light);
  parent.add(g);

  let t = Math.random() * 10;
  ctx.updaters.push((dt) => {
    t += dt;
    let level = 1 - (Math.sin(t * 13) * Math.sin(t * 3.1) > 0.97 ? 0.35 : 0); // 가끔 미세하게 떨림
    if (LIGHT_BUS.blackout > 0) level = Math.random() < 0.04 ? 0.3 : 0;
    light.intensity = 5 * level;
    // (책상이 조사 대상으로 등록되며 재질이 복제되므로 매번 현재 재질을 참조)
    shade.material.emissiveIntensity = 0.08 + 1.05 * level;
    bulb.material.color.copy(BULB_COL).multiplyScalar(0.15 + 0.85 * level);
    halo.material.opacity = 0.55 * level;
  });
  return g;
}

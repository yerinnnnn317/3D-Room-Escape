// =============================================================
// scene/window.js
// 서재 서쪽 벽의 창문 + 붉은 벨벳 커튼.
// - 커튼: 주름(플리츠)이 잡힌 두꺼운 벨벳 천. 처음엔 닫혀서 창문을 가리고,
//         클릭하면(g.userData.open) 촥 젖혀지며 술 달린 끈에 묶인다. 왼쪽 폭은 아래가 찢겨 있음.
//         틈새 바람에 천이 물결치듯 살랑거린다 (정점을 매 프레임 움직임)
// - 유리: 문살 없는 통유리. 창밖은 비가 쉬지 않고 내리는 해 질 녘 (빗줄기 2겹이 계속 흘러내림),
//         유리엔 김 서림 + 흘러내리는 물방울 + 피 묻은 손가락으로 쓴 붉은 '나가지 마'
// - 번개: 가끔 창밖이 번쩍이며 방 전체가 하얗게 밝아지고, 그 순간 글씨가 또렷이 보인다
//         (ctx.onLightning 이 있으면 호출 → main.js에서 천둥소리)
// =============================================================
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------------- 텍스처 ----------------
function velvetTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#7a1210';
  g.fillRect(0, 0, 256, 512);
  // 세로 결 (벨벳 털 방향) + 미세한 얼룩
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 512;
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '20,0,0' : '200,60,50'},${Math.random() * 0.08})`;
    g.fillRect(x, y, 1, 2 + Math.random() * 10);
  }
  // 아래쪽은 먼지와 오래된 얼룩으로 탁하게
  const grad = g.createLinearGradient(0, 380, 0, 512);
  grad.addColorStop(0, 'rgba(30,10,5,0)');
  grad.addColorStop(1, 'rgba(30,10,5,0.45)');
  g.fillStyle = grad;
  g.fillRect(0, 380, 256, 132);
  // 마른 핏자국 한 점
  g.fillStyle = 'rgba(40,0,0,0.55)';
  g.beginPath();
  g.ellipse(170, 300, 18, 30, 0.3, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 찢긴 아랫단을 위한 알파 (흰색=천, 검정=구멍) */
function tornAlpha() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#000';
  g.beginPath();
  g.moveTo(0, 256);
  let y = 236;
  for (let x = 0; x <= 128; x += 8) {
    y = 222 + Math.random() * 34 - (x > 60 && x < 100 ? 40 : 0);
    g.lineTo(x, y);
  }
  g.lineTo(128, 256);
  g.fill();
  return new THREE.CanvasTexture(c);
}

/** 창밖 풍경: 비 내리는 해 질 녘. 먹구름, 붉게 꺼져가는 지평선, 앙상한 나무, 불 꺼진 먼 집 */
function outsideTexture() {
  const W = 512, H = 600;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a0c1c');
  sky.addColorStop(0.3, '#1c1838');
  sky.addColorStop(0.52, '#4a2240');
  sky.addColorStop(0.64, '#9a3a22'); // 구름 아래로 겨우 남은 핏빛 노을
  sky.addColorStop(0.7, '#c2552a');
  sky.addColorStop(0.76, '#3a1418');
  sky.addColorStop(1, '#060406');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  // 낮게 깔린 먹구름 덩어리
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * W;
    const y = Math.random() * 300;
    const r = 40 + Math.random() * 90;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.18 + Math.random() * 0.2;
    grd.addColorStop(0, `rgba(18,16,24,${a})`);
    grd.addColorStop(1, 'rgba(18,16,24,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 먼 언덕
  g.fillStyle = '#120c0e';
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 16) g.lineTo(x, 430 + Math.sin(x * 0.012) * 18 + Math.sin(x * 0.05) * 5);
  g.lineTo(W, H);
  g.fill();
  // 언덕 위 외딴집 (창 하나만 희미하게 켜져 있음)
  g.fillStyle = '#0a0708';
  g.fillRect(330, 392, 70, 46);
  g.beginPath();
  g.moveTo(322, 394);
  g.lineTo(365, 360);
  g.lineTo(408, 394);
  g.fill();
  g.fillRect(385, 366, 8, 18);
  g.fillStyle = 'rgba(200,120,60,0.55)';
  g.fillRect(345, 405, 9, 11);
  // 앙상한 나무들
  const tree = (x, base, h, w) => {
    g.strokeStyle = '#060405';
    g.lineCap = 'round';
    const branch = (x0, y0, ang, len, wd, depth) => {
      const x1 = x0 + Math.sin(ang) * len;
      const y1 = y0 - Math.cos(ang) * len;
      g.lineWidth = wd;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      if (depth <= 0) return;
      const n = 2 + (Math.random() < 0.4 ? 1 : 0);
      for (let k = 0; k < n; k++) branch(x1, y1, ang + (Math.random() - 0.5) * 1.3, len * (0.6 + Math.random() * 0.2), wd * 0.62, depth - 1);
    };
    branch(x, base, (Math.random() - 0.5) * 0.15, h, w, 5);
  };
  tree(70, 610, 150, 14);
  tree(190, 600, 90, 8);
  tree(470, 610, 170, 16);
  // 앞쪽 땅
  const ground = g.createLinearGradient(0, 470, 0, H);
  ground.addColorStop(0, 'rgba(8,5,6,0)');
  ground.addColorStop(1, 'rgba(4,2,3,1)');
  g.fillStyle = ground;
  g.fillRect(0, 470, W, H - 470);
  // 빗줄기에 뿌옇게 번진 대기
  g.fillStyle = 'rgba(60,60,85,0.06)';
  g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 떨어지는 빗줄기 (세로로 반복, 매 프레임 아래로 흘려 보냄) */
function rainTexture(n, alpha) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const len = 10 + Math.random() * 26;
    g.strokeStyle = `rgba(190,200,225,${alpha * (0.4 + Math.random() * 0.6)})`;
    g.lineWidth = 0.6 + Math.random() * 0.9;
    for (const oy of [0, -256, 256]) {
      g.beginPath();
      g.moveTo(x, y + oy);
      g.lineTo(x - len * 0.12, y + len + oy);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 유리에 맺혀 천천히 흘러내리는 물방울 (꼬리 달린 방울) */
function dropsTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 512;
    const r = 0.8 + Math.random() * 2.2;
    g.fillStyle = `rgba(230,235,245,${0.25 + Math.random() * 0.3})`;
    g.beginPath();
    g.ellipse(x, y, r * 0.75, r, 0, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 512;
    const len = 40 + Math.random() * 120;
    const grd = g.createLinearGradient(0, y - len, 0, y);
    grd.addColorStop(0, 'rgba(220,225,240,0)');
    grd.addColorStop(1, 'rgba(220,225,240,0.35)');
    g.fillStyle = grd;
    g.fillRect(x - 1, y - len, 2, len);
    g.fillStyle = 'rgba(235,240,250,0.6)';
    g.beginPath();
    g.ellipse(x, y, 2.6, 3.4, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** 김 서린 유리막 (가장자리일수록 뿌옇고 가운데는 비교적 맑음) */
function fogTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 300;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(128, 150, 40, 128, 150, 190);
  rg.addColorStop(0, 'rgba(90,82,92,0.03)');
  rg.addColorStop(1, 'rgba(90,82,92,0.2)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 256, 300);
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = `rgba(200,195,205,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 256, Math.random() * 300, 2, 2);
  }
  return new THREE.CanvasTexture(c);
}

/** 피 묻은 손가락으로 쓴 붉은 '나가지 마' (투명 배경, 글씨만) */
function writingTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 600;
  const o = c.getContext('2d');
  o.font = 'bold 118px "Nanum Pen Script", "Gaegu", cursive, sans-serif';
  o.textAlign = 'center';
  o.textBaseline = 'middle';
  // 글씨 주변을 손으로 문질러 김을 닦아낸 자국
  const wipe = o.createRadialGradient(256, 285, 20, 256, 285, 230);
  wipe.addColorStop(0, 'rgba(20,10,12,0.35)');
  wipe.addColorStop(1, 'rgba(20,10,12,0)');
  o.fillStyle = wipe;
  o.fillRect(0, 120, 512, 330);
  o.lineJoin = 'round';
  o.strokeStyle = 'rgba(40,0,0,0.85)';
  o.lineWidth = 7;
  o.strokeText('나가지 마', 256, 285);
  o.shadowColor = 'rgba(255,40,30,0.6)';
  o.shadowBlur = 10;
  o.fillStyle = '#d0140e';
  o.fillText('나가지 마', 256, 285);
  o.shadowBlur = 0;
  const m = o.measureText('나가지 마');
  for (let i = 0; i < 16; i++) {
    const x = 256 - m.width / 2 + 20 + Math.random() * (m.width - 40);
    const y = 305 + Math.random() * 18;
    const len = 30 + Math.random() * 170;
    const w = 2 + Math.random() * 4;
    o.fillStyle = 'rgba(170,12,10,0.95)';
    o.fillRect(x - w / 2, y, w, len);
    o.beginPath();
    o.ellipse(x, y + len, w * 0.8, w * 1.1, 0, 0, Math.PI * 2);
    o.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------- 커튼 천 ----------------
/** 한 가지 모양(닫힘 또는 열림)의 정점 위치 계산 */
function curtainShape(geo, w, h, { gather = 0, gatherSide = 1, gatherY = 0.55, spread = 1 }) {
  const pos = geo.attributes.position;
  const out = new Float32Array(pos.count * 3);
  const pleats = 7; // 주름 개수
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * spread;
    const y = pos.getY(i);
    const t = -y / h; // 0 = 위, 1 = 아래
    const amp = (0.035 + 0.03 * t) / Math.max(spread, 0.6);
    let z = Math.sin((pos.getX(i) / w + 0.5) * pleats * Math.PI * 2) * amp;
    let nx = x;
    if (gather) {
      // 묶은 끈 높이에서 천이 한쪽으로 모였다가 아래로 다시 퍼짐
      const d = Math.abs(t - gatherY);
      const k = gather * Math.exp(-d * d * 18);
      const edge = (gatherSide * w * spread) / 2;
      nx = x + (edge - x) * k;
      z *= 1 + k * 1.5;
    }
    out[i * 3] = nx;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z + 0.06;
  }
  return out;
}

/**
 * 커튼 한 폭. 닫힌 모양 ↔ 열린 모양을 userData.blend(0~1)로 섞는다.
 * (로컬: 위쪽 가운데가 원점, 아래로 늘어짐)
 */
function curtainPanel({ w, h, closed, open, torn = false, map }) {
  const geo = new THREE.PlaneGeometry(w, h, 40, 30);
  geo.translate(0, -h / 2, 0);
  const shapeClosed = curtainShape(geo, w, h, closed);
  const shapeOpen = curtainShape(geo, w, h, open);
  geo.attributes.position.array.set(shapeClosed);
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({
    map,
    color: 0xffffff,
    roughness: 0.92,
    sheen: 1.0,
    sheenColor: new THREE.Color(0xff6a5a),
    sheenRoughness: 0.45, // 벨벳 특유의 결 따라 번들거림
    side: THREE.DoubleSide,
    alphaMap: torn ? tornAlpha() : null,
    alphaTest: torn ? 0.5 : 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  Object.assign(mesh.userData, { shapeClosed, shapeOpen, h, blend: 0, xClosed: closed.x, xOpen: open.x });
  mesh.position.x = closed.x;
  return mesh;
}

/** 열림 정도(blend)에 맞춰 모양을 섞고, 틈새 바람에 아래쪽일수록 크게 물결 */
function sway(mesh, t, phase) {
  const { shapeClosed: A, shapeOpen: B, h, blend } = mesh.userData;
  const pos = mesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = A[i * 3] + (B[i * 3] - A[i * 3]) * blend;
    const y = A[i * 3 + 1];
    const z = A[i * 3 + 2] + (B[i * 3 + 2] - A[i * 3 + 2]) * blend;
    const k = (-y / h) ** 1.6;
    const wave = Math.sin(t * 1.3 + phase + x * 3 + y * 1.5) * 0.035 + Math.sin(t * 0.7 + phase * 2 + y * 3) * 0.02;
    pos.setXYZ(i, x, y, z + wave * k);
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.position.x = mesh.userData.xClosed + (mesh.userData.xOpen - mesh.userData.xClosed) * blend;
}

export function buildWindow(ctx, { x, y, z, rotY }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY; // 로컬 +z가 방 안쪽
  const wood = new THREE.MeshStandardMaterial({ color: 0x2a160c, roughness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: 0x8a6a34, metalness: 0.85, roughness: 0.35 });

  // ---- 통유리 한 장: 겹겹이 쌓은 평면 (창밖 풍경 → 빗줄기 2겹 → 김 서림 → 물방울 → 글씨) ----
  const GW = 1.2, GH = 1.4;
  const layer = (material, z, order) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(GW, GH), material);
    m.position.z = z;
    m.renderOrder = order;
    g.add(m);
    return m;
  };
  const outsideMat = new THREE.MeshBasicMaterial({ map: outsideTexture(), fog: false, color: 0xffffff });
  layer(outsideMat, 0.004, 1);
  const rainFar = rainTexture(150, 0.28);
  rainFar.repeat.set(2.2, 1.8);
  const rainNear = rainTexture(60, 0.5);
  rainNear.repeat.set(1.2, 1);
  const rainMat = (map, op) => new THREE.MeshBasicMaterial({ map, transparent: true, opacity: op, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const rainFarMat = rainMat(rainFar, 0.35);
  const rainNearMat = rainMat(rainNear, 0.5);
  layer(rainFarMat, 0.006, 2);
  layer(rainNearMat, 0.008, 3);
  layer(new THREE.MeshBasicMaterial({ map: fogTexture(), transparent: true, depthWrite: false, fog: false }), 0.01, 4);
  const drops = dropsTexture();
  drops.repeat.set(1.5, 1.2);
  const dropsMat = new THREE.MeshStandardMaterial({ map: drops, transparent: true, depthWrite: false, roughness: 0.05, metalness: 0.2, emissive: 0x1a161c, emissiveMap: drops, opacity: 0.8 });
  layer(dropsMat, 0.012, 5);
  // 글씨는 맨 앞, 조명과 상관없이 붉게 보이도록
  const writeMat = new THREE.MeshBasicMaterial({ map: writingTexture(), transparent: true, depthWrite: false, fog: false, color: 0xffffff });
  layer(writeMat, 0.014, 6);
  // 손글씨 폰트가 늦게 받아지면 그때 글씨를 다시 그림
  document.fonts?.load('118px "Nanum Pen Script"').then(() => {
    writeMat.map = writingTexture();
    writeMat.needsUpdate = true;
  });
  // 창틀 (바깥 틀만 — 가운데 문살 없는 통유리라 글씨를 가리지 않음)
  for (const [w, h, fx, fy] of [[1.38, 0.09, 0, 0.745], [1.38, 0.09, 0, -0.745], [0.09, 1.58, -0.645, 0], [0.09, 1.58, 0.645, 0]]) {
    const f = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.07, 2, 0.012), wood);
    f.position.set(fx, fy, 0.035);
    g.add(f);
  }
  const sill = new THREE.Mesh(new RoundedBoxGeometry(1.55, 0.05, 0.2, 2, 0.015), wood);
  sill.position.set(0, -0.8, 0.09);
  g.add(sill);
  // 창턱 위 촛농과 꺼진 초
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.06, 12), new THREE.MeshStandardMaterial({ color: 0xd8ccb0 }));
  stub.position.set(0.45, -0.745, 0.12);
  g.add(stub);

  // 커튼봉 + 장식 + 고리
  const rodY = 0.98;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 2.5, 14), brass);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, rodY, 0.13);
  g.add(rod);
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), brass);
    fin.position.set(s * 1.27, rodY, 0.13);
    const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 8), brass);
    bracket.rotation.x = Math.PI / 2;
    bracket.position.set(s * 1.1, rodY, 0.065);
    g.add(fin, bracket);
  }

  // 커튼 두 폭: 처음엔 닫혀서 창문을 가림. 열면 양옆으로 젖혀지고 끈에 묶여 모임
  //   왼쪽 폭은 아랫단이 찢겨 너덜거림
  const tex = velvetTexture();
  tex.repeat.set(2, 1);
  const left = curtainPanel({
    w: 0.9, h: 2.5, torn: true, map: tex,
    closed: { x: -0.43 },
    open: { x: -0.86, spread: 0.75, gather: 0.6, gatherSide: -1 },
  });
  const right = curtainPanel({
    w: 0.9, h: 2.5, map: tex,
    closed: { x: 0.43 },
    open: { x: 0.86, spread: 0.75, gather: 0.65, gatherSide: 1 },
  });
  left.position.y = right.position.y = rodY - 0.02;
  left.position.z = right.position.z = 0.07;
  g.add(left, right);
  // 커튼 고리 (천과 함께 움직임)
  const rings = [];
  for (const panel of [left, right]) {
    for (let i = 0; i <= 6; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 16), brass);
      ring.position.set(0, rodY, 0.13);
      g.add(ring);
      rings.push({ ring, panel, u: i / 6 - 0.5 });
    }
  }
  // 묶은 끈 + 술(태슬) — 커튼을 열면 나타남
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.7 });
  const ties = [];
  for (const sgn of [-1, 1]) {
    const tie = new THREE.Group();
    const rope = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 8, 24), ropeMat);
    rope.rotation.y = Math.PI / 2;
    rope.scale.set(1, 0.5, 1);
    const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 12), ropeMat);
    tassel.position.set(-sgn * 0.08, -0.12, 0.08);
    tie.add(rope, tassel);
    tie.position.set(sgn * 1.12, rodY - 0.02 - 2.5 * 0.55, 0.12);
    tie.visible = false;
    g.add(tie);
    ties.push(tie);
  }

  // 클릭하면 촥— 열림 (조금 튕기듯이)
  let opening = -1;
  g.userData.open = () => {
    opening = 0;
    ties.forEach((t) => (t.visible = true));
  };

  // 번개 빛
  // 번개 빛은 별도 조명 없이 방 전체 환경광을 잠깐 올려서 표현 (조명 수를 줄여 가볍게)
  ctx.lightning = 0;
  let nextBolt = 12 + Math.random() * 10;
  let bolt = 0;
  let t = 0;
  ctx.updaters.push((dt) => {
    t += dt;
    // 비는 멈추지 않고 계속 내린다
    rainFar.offset.y += dt * 1.1;
    rainFar.offset.x += dt * 0.05;
    rainNear.offset.y += dt * 2.0;
    rainNear.offset.x += dt * 0.1;
    drops.offset.y += dt * 0.012;
    if (opening >= 0 && opening < 1) {
      opening = Math.min(1, opening + dt / 0.65);
      const e = 1 - Math.pow(1 - opening, 3);
      const over = Math.sin(opening * Math.PI) * 0.08; // 살짝 튕김
      left.userData.blend = right.userData.blend = Math.min(1.05, e + over);
    }
    sway(left, t, 0);
    sway(right, t, 1.7);
    for (const r of rings) {
      const p = r.panel;
      const width = 0.9 * (1 + (0.75 - 1) * p.userData.blend);
      r.ring.position.x = p.position.x + r.u * width;
    }
    // 번개: 두 번 연달아 번쩍
    nextBolt -= dt;
    if (nextBolt <= 0) {
      nextBolt = 18 + Math.random() * 25;
      bolt = 0.9;
      ctx.onLightning?.();
    }
    if (bolt > 0) {
      bolt -= dt;
      const p = 0.9 - bolt;
      const k = p < 0.08 ? 1 : p < 0.18 ? 0.15 : p < 0.26 ? 0.8 : Math.max(0, 1 - (p - 0.26) * 2);
      ctx.lightning = k;
      outsideMat.color.setRGB(1 + 1.4 * k, 1 + 1.5 * k, 1 + 1.9 * k);
      rainFarMat.opacity = 0.35 + 0.5 * k;
    } else {
      ctx.lightning = 0;
      outsideMat.color.setHex(0xffffff);
      rainFarMat.opacity = 0.35;
    }
  });

  ctx.scene.add(g);
  return g;
}

// =============================================================
// scene/bloodTextures.js
// 사진처럼 보이는 핏자국 텍스처를 캔버스로 직접 그린다. (이미지 파일 없음)
// - handTexture()   : 실제 손 윤곽의 손바닥 자국 + 손금 + 흘러내린 핏줄기
// - poolTexture()   : 바닥에 고인 피웅덩이 (검붉은 중심, 마르기 시작한 가장자리)
// - splatTexture()  : 떨어져 튄 핏방울
// - smearTexture()  : 문질러 끌린 자국
// 종이처럼 보이지 않도록: 가장자리를 살짝 흐리게(blur), 색은 검붉게,
// 재질은 젖은 광택 + 범프(두께감)를 준다.
// =============================================================
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);
const cache = {};

function makeTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function variants(key, n, draw) {
  if (!cache[key]) cache[key] = Array.from({ length: n }, () => makeTex(draw()));
  return cache[key][(Math.random() * n) | 0];
}

/** 피 색: 신선한 피(선홍) ~ 굳은 피(검붉은 갈색) */
function blood(fresh = 0.5, a = 1) {
  const r = Math.round(60 + fresh * 70);
  const gb = Math.round(fresh * 6);
  return `rgba(${r},${gb},${Math.round(gb * 1.4)},${a})`;
}

/** 캔버스 전체를 살짝 흐리게 해서 종이를 오린 듯한 날카로운 가장자리 제거 */
function soften(c, px = 1.2) {
  const tmp = document.createElement('canvas');
  tmp.width = c.width;
  tmp.height = c.height;
  const t = tmp.getContext('2d');
  t.filter = `blur(${px}px)`;
  t.drawImage(c, 0, 0);
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(tmp, 0, 0);
}

/** 아래로 흘러내린 핏줄기 (위는 굵고 아래로 가늘어지다 방울로 맺힘) */
function drip(g, x, y, len, w, fresh = 0.7) {
  g.fillStyle = blood(fresh);
  g.beginPath();
  g.moveTo(x - w / 2, y);
  g.bezierCurveTo(x - w * 0.45, y + len * 0.3, x - w * 0.2, y + len * 0.7, x - w * 0.18, y + len);
  g.lineTo(x + w * 0.18, y + len);
  g.bezierCurveTo(x + w * 0.2, y + len * 0.7, x + w * 0.45, y + len * 0.3, x + w / 2, y);
  g.fill();
  g.beginPath();
  g.ellipse(x, y + len + w * 0.3, w * 0.42, w * 0.6, 0, 0, Math.PI * 2);
  g.fill();
}

/** 피부 결처럼 군데군데 덜 묻은 곳 */
function speckle(g, cx, cy, rx, ry, count, maxR) {
  g.save();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random());
    g.globalAlpha = rand(0.15, 0.7);
    g.beginPath();
    g.arc(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, rand(0.6, maxR), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// ---------------- 손바닥 자국 ----------------
// 실제 피 묻은 손을 벽에 찍은 것처럼: 손 윤곽 안에서도 피가 고르게 묻지 않고
// (손금·지문·피부 결 사이가 비고, 손가락 끝과 손바닥 가장자리가 진함)
// 찍은 뒤 아래로 살짝 미끄러진 자국과 가는 핏줄기가 남는다.

// 값 노이즈 (픽셀 단위 얼룩용)
function makeNoise(seed) {
  const perm = new Uint8Array(512);
  const p = [...Array(256).keys()].sort(() => Math.random() - 0.5);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h, x, y) => ((h & 1 ? -x : x) + (h & 2 ? -y : y));
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const noise = (x, y) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = fade(x);
    const v = fade(y);
    const a = perm[X] + Y;
    const b = perm[X + 1] + Y;
    const l1 = grad(perm[a], x, y) + u * (grad(perm[b], x - 1, y) - grad(perm[a], x, y));
    const l2 = grad(perm[a + 1], x, y - 1) + u * (grad(perm[b + 1], x - 1, y - 1) - grad(perm[a + 1], x, y - 1));
    return l1 + v * (l2 - l1);
  };
  return (x, y, oct = 4) => {
    let v = 0;
    let amp = 0.5;
    let f = 1;
    for (let i = 0; i < oct; i++) {
      v += amp * noise(x * f + seed, y * f - seed);
      f *= 2.1;
      amp *= 0.5;
    }
    return v; // 대략 -0.5 ~ 0.5
  };
}

function drawHand() {
  const W = 256;
  const H = 420;
  // 1) 손 모양 마스크 (손가락 마디 사이는 살짝 끊김, 손바닥 가운데 오목한 곳은 약함)
  const m = document.createElement('canvas');
  m.width = W;
  m.height = H;
  const g = m.getContext('2d');
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  const seg = (x1, y1, x2, y2, w) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  };
  const j = () => rand(-2, 2);
  // 손가락: [밑동x, 밑동y, 각도, 마디 길이 3개, 굵기]
  const fingers = [
    [92, 188, -0.16, [36, 28, 24], 23],
    [124, 180, -0.03, [40, 30, 26], 24],
    [155, 185, 0.08, [37, 28, 24], 23],
    [183, 198, 0.22, [30, 22, 20], 19],
  ];
  for (const [bx, by, ang, lens, w] of fingers) {
    let x = bx + j();
    let y = by + j();
    lens.forEach((len, k) => {
      const nx = x + Math.sin(ang) * len;
      const ny = y - Math.cos(ang) * len;
      // 마디 사이 2~3px 띄워서 지문처럼 끊긴 느낌
      seg(x + Math.sin(ang) * 3, y - Math.cos(ang) * 3, nx, ny, w * (1 - k * 0.08));
      x = nx + Math.sin(ang) * 2;
      y = ny - Math.cos(ang) * 2;
    });
  }
  // 엄지 (두 마디, 바깥으로 벌어짐)
  seg(84, 262, 52, 222, 30);
  seg(50, 218, 30, 186, 25);
  // 손바닥 (볼록한 두 덩어리: 엄지두덩·새끼두덩)
  g.beginPath();
  g.ellipse(132, 240, 66, 64, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(100, 280, 40, 48, -0.3, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(168, 282, 34, 46, 0.25, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(134, 312, 44, 26, 0, 0, Math.PI * 2);
  g.fill();
  const mask = g.getImageData(0, 0, W, H).data;

  // 2) 피 묻은 정도: 노이즈 얼룩 + 손금(비는 선) + 가장자리 진함
  const n1 = makeNoise(Math.random() * 100);
  const n2 = makeNoise(Math.random() * 100);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const og = out.getContext('2d');
  const img = og.createImageData(W, H);
  const d = img.data;
  const creases = [
    // 손금 (중심x, 중심y, 반지름x, 반지름y, 시작각, 끝각)
    [150, 280, 70, 40, 3.5, 4.6],
    [140, 300, 72, 46, 3.4, 4.4],
    [60, 300, 60, 90, 5.6, 6.5],
  ];
  const inCrease = (x, y) => {
    for (const [cx, cy, rx, ry, a0, a1] of creases) {
      const a = Math.atan2((y - cy) / ry, (x - cx) / rx);
      const aa = a < 0 ? a + Math.PI * 2 : a;
      if (aa < a0 || aa > a1) continue;
      const r = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (Math.abs(r - 1) < 0.035) return true;
    }
    return false;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const mk = mask[i + 3] / 255;
      if (mk < 0.01) continue;
      // 가장자리까지 거리 근사: 주변 마스크 샘플
      let edge = 0;
      for (const [ox, oy] of [[6, 0], [-6, 0], [0, 6], [0, -6]]) {
        const xx = Math.min(W - 1, Math.max(0, x + ox));
        const yy = Math.min(H - 1, Math.max(0, y + oy));
        if (mask[(yy * W + xx) * 4 + 3] < 128) edge++;
      }
      const blot = n1(x / 38, y / 38) + 0.35 * n2(x / 6, y / 6, 2); // 큰 얼룩 + 피부 결
      let cover = 0.62 + blot * 1.5 + edge * 0.12;
      // 손바닥 한가운데(오목한 곳)는 덜 묻음
      const hollow = Math.exp(-(((x - 135) / 34) ** 2 + ((y - 262) / 30) ** 2));
      cover -= hollow * 0.55;
      if (inCrease(x, y)) cover -= 0.6;
      // 손가락 끝 지문 결
      if (y < 175 && Math.sin((x * 0.9 + y * 1.4) * 0.9 + n2(x / 20, y / 20) * 6) > 0.6) cover -= 0.35;
      cover = Math.max(0, Math.min(1, cover)) * mk;
      if (cover <= 0.02) continue;
      // 색: 두껍게 묻은 곳은 검붉게, 얇은 곳은 붉게 비침
      const thick = Math.min(1, cover * 1.2 + edge * 0.1);
      d[i] = 150 - thick * 85 + blot * 20;
      d[i + 1] = 6 - thick * 4;
      d[i + 2] = 8 - thick * 5;
      d[i + 3] = Math.min(255, cover * 255 * (0.75 + 0.25 * thick));
    }
  }
  og.putImageData(img, 0, 0);

  // 3) 찍은 뒤 아래로 살짝 미끄러진 잔상 (흐릿하게)
  const fin = document.createElement('canvas');
  fin.width = W;
  fin.height = H;
  const fg = fin.getContext('2d');
  fg.globalAlpha = 0.18;
  for (let k = 1; k <= 6; k++) fg.drawImage(out, rand(-1, 1), k * 2.2);
  fg.globalAlpha = 1;
  fg.drawImage(out, 0, 0);

  // 4) 가는 핏줄기 (진한 곳 아래로)
  const tips = [[100, 330], [125, 338], [150, 334], [172, 318], [44, 238], [96, 182], [128, 176]];
  for (const [x, y] of tips) {
    if (Math.random() < 0.35) continue;
    drip(fg, x + rand(-4, 4), y - 6, rand(20, H - y - 16), rand(3, 7), rand(0.45, 0.7));
  }
  soften(fin, 0.6);
  return fin;
}

// ---------------- 피웅덩이 ----------------
function drawPool() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const cx = S / 2;
  const cy = S / 2;

  // 둥근 원들을 겹쳐 유기적인 윤곽 (원 끝이 보이지 않게 크기를 고르게)
  const shape = new Path2D();
  const n = 36;
  const radii = [];
  for (let i = 0; i < n; i++) radii.push(rand(120, 175));
  for (let k = 0; k < 2; k++) for (let i = 0; i < n; i++) radii[i] = (radii[i] + radii[(i + 1) % n] + radii[(i + n - 1) % n]) / 3;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = radii[i % n];
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.85;
    i ? shape.lineTo(x, y) : shape.moveTo(x, y);
  }
  shape.closePath();
  // 가장자리 쪽은 말라서 갈색, 가운데는 두껍고 검붉음
  const grad = g.createRadialGradient(cx, cy, 10, cx, cy, 190);
  grad.addColorStop(0, 'rgba(32,0,2,1)');
  grad.addColorStop(0.55, 'rgba(58,2,4,1)');
  grad.addColorStop(0.88, 'rgba(92,8,8,1)');
  grad.addColorStop(1, 'rgba(70,14,10,0.9)');
  g.fillStyle = grad;
  g.fill(shape);
  // 마른 테두리 링
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(45,6,4,0.8)';
  g.stroke(shape);

  // 흘러나간 갈래
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2;
    const len = rand(170, 235);
    g.strokeStyle = 'rgba(62,3,5,1)';
    g.lineCap = 'round';
    g.lineWidth = rand(12, 22);
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 120, cy + Math.sin(a) * 100);
    g.quadraticCurveTo(cx + Math.cos(a + 0.15) * len * 0.85, cy + Math.sin(a + 0.15) * len * 0.8, cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.9);
    g.stroke();
  }
  // 주변에 튄 작은 방울
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = rand(195, 245);
    g.fillStyle = blood(rand(0.2, 0.5));
    g.beginPath();
    g.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, rand(1.5, 6), rand(1.5, 5), a, 0, Math.PI * 2);
    g.fill();
  }
  soften(c, 1.5);
  return c;
}

// ---------------- 튄 핏방울 ----------------
function drawSplat() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const cx = S / 2;
  const cy = S / 2;
  const base = rand(0.35, 0.6);
  g.fillStyle = blood(base);
  g.beginPath();
  g.ellipse(cx, cy, rand(20, 30), rand(17, 26), rand(0, 3), 0, Math.PI * 2);
  g.fill();
  // 가장자리 톱니 + 바깥 방울 (한쪽으로 몰리게 = 떨어진 방향)
  const bias = Math.random() * Math.PI * 2;
  const n = 14 + ((Math.random() * 10) | 0);
  for (let i = 0; i < n; i++) {
    const a = bias + rand(-1.4, 1.4);
    const len = rand(26, 80);
    g.fillStyle = blood(base);
    g.beginPath();
    g.ellipse(cx + Math.cos(a) * len * 0.5, cy + Math.sin(a) * len * 0.5, len * 0.5, rand(2, 5), a, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(cx + Math.cos(a) * (len + rand(4, 20)), cy + Math.sin(a) * (len + rand(4, 20)), rand(1.5, 5), 0, Math.PI * 2);
    g.fill();
  }
  // 가운데 진하게
  const grad = g.createRadialGradient(cx, cy, 2, cx, cy, 30);
  grad.addColorStop(0, 'rgba(25,0,0,0.7)');
  grad.addColorStop(1, 'rgba(25,0,0,0)');
  g.save();
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  g.restore();
  soften(c, 1);
  return c;
}

// ---------------- 문질러 끌린 자국 ----------------
function drawSmear() {
  const W = 512;
  const H = 192;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.lineCap = 'round';
  for (let k = 0; k < 40; k++) {
    const y = H / 2 + rand(-58, 58);
    const fade = 1 - Math.abs(y - H / 2) / 70;
    g.strokeStyle = blood(rand(0.3, 0.55), Math.max(0.05, fade * rand(0.3, 0.75)));
    g.lineWidth = rand(2, 9);
    g.beginPath();
    const x0 = rand(20, 70);
    g.moveTo(x0, y);
    g.bezierCurveTo(W * 0.35, y + rand(-10, 10), W * 0.65, y + rand(-12, 12), rand(W * 0.55, W - 20), y + rand(-18, 18));
    g.stroke();
  }
  // 시작 부분은 진하게 뭉쳐 있음
  const grad = g.createRadialGradient(60, H / 2, 5, 60, H / 2, 70);
  grad.addColorStop(0, blood(0.3, 0.95));
  grad.addColorStop(1, blood(0.3, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 160, H);
  // 끝으로 갈수록 옅어짐
  g.save();
  g.globalCompositeOperation = 'destination-in';
  const fadeG = g.createLinearGradient(0, 0, W, 0);
  fadeG.addColorStop(0, 'rgba(0,0,0,1)');
  fadeG.addColorStop(0.7, 'rgba(0,0,0,0.8)');
  fadeG.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fadeG;
  g.fillRect(0, 0, W, H);
  g.restore();
  speckle(g, W / 2, H / 2, W / 2, H / 2, 600, 2);
  soften(c, 1.2);
  return c;
}

export const handTexture = () => variants('hand', 4, drawHand);
export const poolTexture = () => variants('pool', 3, drawPool);
export const splatTexture = () => variants('splat', 4, drawSplat);
export const smearTexture = () => variants('smear', 3, drawSmear);

/** 핏자국용 재질: 젖은 광택 + 텍스처 자체를 범프로 써서 두께감 */
export function bloodMaterial(map) {
  return new THREE.MeshStandardMaterial({
    map,
    bumpMap: map,
    bumpScale: 1.5,
    transparent: true,
    roughness: 0.18,
    metalness: 0.05,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
}

/** 손바닥 자국 메시 (size = 손바닥 폭, 미터). 평면은 로컬 +z를 바라본다 */
export function handPrintMesh(size = 0.2) {
  const h = size * (420 / 256);
  const geo = new THREE.PlaneGeometry(size, h);
  geo.translate(0, -h * 0.05, 0);
  return new THREE.Mesh(geo, bloodMaterial(handTexture()));
}

// =============================================================
// scene/room1.js
// 방 1 — 피해자의 서재 (x: -5~5, z: -5~5, 천장 높이 3)
// 배치: 쓰러진 시신, 책상 + 잠긴 서랍, 책장, 멈춘 벽시계(11:47),
//       핏자국, 북쪽(z=-5) 잠긴 문 → 방 2(와인 저장고)로 이어짐
// 물체 id는 scenario.json의 interactables 키와 반드시 같아야 한다.
// =============================================================
import * as THREE from 'three';
import { drawCalendar } from './calendarTexture.js';
import { box, addCollider, registerInteractable, tween, bloodDecal, dragDecal, wallDecal, textPlane, mat, handPrintMesh } from './helpers.js';
import { createRedLight } from './lighting.js';
import { createChandelier } from './chandelier.js';
import { createDust } from './atmosphere.js';
import * as F from './furniture.js';
import { buildCorpse, loadVictimModel } from './corpse.js';
import { buildWindow } from './window.js';
import { gameState } from '../game/gameState.js';

// 방 크기: 처음 10m×10m로 배치한 뒤, 북쪽 벽(z=-5, 지하로 가는 문)을 기준으로 STUDY_SCALE만큼 줄인다
export const STUDY_SCALE = 0.84;
const SX = (x) => x * STUDY_SCALE;
const SZ = (z) => (z + 5) * STUDY_SCALE - 5;
const RAW_BOUNDS = { minX: -5, maxX: 5, minZ: -5, maxZ: 5 };
export const STUDY_BOUNDS = { minX: SX(-5), maxX: SX(5), minZ: -5, maxZ: SZ(5) };
export const STUDY_SPAWN = { x: SX(-1.4), z: SZ(3.5) }; // 들어온 문(남쪽 벽) 바로 앞

export function buildStudy(ctx) {
  const S = ctx.scene;
  const startChildren = S.children.length;
  const startColliders = ctx.colliders.length;
  const wallM = mat(0x5a2420); // 검붉은 벽지
  const floorM = mat(0x3e2016, { roughness: 0.65 });
  const ceilM = mat(0x2a1614);
  const wood = mat(0x4a2e1a);
  const darkWood = mat(0x2a1a10);
  const paper = mat(0x8a8070);

  // ---------- 바닥 / 천장 ----------
  // 방 모양: 정사각형이 아니라 북서쪽 모서리가 비스듬히 깎여 있고,
  //          서쪽 벽엔 창문이 쑥 들어간 창가 공간(alcove)이 있다
  const OUTLINE = [
    [-3.7, -5], [5, -5], [5, 5], [-5, 5],
    [-5, -0.15], [-6, -0.15], [-6, -3.05], [-5, -3.05], // 창가 공간
    [-5, -3.7], // 비스듬한 모서리
  ];
  const floorShape = new THREE.Shape(OUTLINE.map(([x, z]) => new THREE.Vector2(x, -z)));
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(floorShape), floorM);
  floor.rotation.x = -Math.PI / 2;
  S.add(floor);
  ctx.floors.push(floor);
  const ceilShape = new THREE.Shape(OUTLINE.map(([x, z]) => new THREE.Vector2(x, z)));
  const ceil = new THREE.Mesh(new THREE.ShapeGeometry(ceilShape), ceilM);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 3;
  S.add(ceil);
  ctx.ceilings.push(ceil);

  // ---------- 벽 (안쪽 면이 ±5에 오도록) ----------
  box(ctx, { w: 10.4, h: 3, d: 0.2, x: 0, z: 5.1, material: wallM, collide: true, wall: true });
  box(ctx, { w: 0.2, h: 3, d: 10.4, x: 5.1, z: 0, material: wallM, collide: true, wall: true });
  // 서쪽 벽: 창가 공간(z -3.05 ~ -0.15) 앞뒤로 나뉨
  box(ctx, { w: 0.2, h: 3, d: 5.45, x: -5.1, z: 2.575, material: wallM, collide: true, wall: true });
  box(ctx, { w: 0.2, h: 3, d: 0.85, x: -5.1, z: -3.425, material: wallM, collide: true, wall: true });
  // 창가 공간: 뒷벽, 양옆 벽, 입구 위 상인방(천장보다 낮게 내려온 벽)
  box(ctx, { w: 0.2, h: 3, d: 3.3, x: -6.1, z: -1.6, material: wallM, collide: true, wall: true });
  box(ctx, { w: 1.2, h: 3, d: 0.2, x: -5.6, z: -3.15, material: wallM, collide: true, wall: true });
  box(ctx, { w: 1.2, h: 3, d: 0.2, x: -5.6, z: -0.05, material: wallM, collide: true, wall: true });
  box(ctx, { w: 0.24, h: 0.32, d: 3.1, x: -5.0, y: 2.84, z: -1.6, material: mat(0x2a1610), wall: true });
  // 북서쪽 비스듬한 벽 (-5,-3.7) ~ (-3.7,-5)
  const diag = box(ctx, { w: 2.1, h: 3, d: 0.2, x: -4.35 - 0.07, z: -4.35 - 0.07, material: wallM, wall: true });
  diag.rotation.y = Math.PI / 4;
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    addCollider(ctx, -5 + 1.3 * t - 0.12, -3.7 - 1.3 * t - 0.12, 0.42, 0.42);
  }
  // 북쪽 벽: 가운데 문 구멍(x -0.8 ~ 0.8)
  box(ctx, { w: 3.0, h: 3, d: 0.2, x: -2.3, z: -5.1, material: wallM, collide: true, wall: true });
  box(ctx, { w: 4.4, h: 3, d: 0.2, x: 3.0, z: -5.1, material: wallM, collide: true, wall: true });
  box(ctx, { w: 1.6, h: 0.8, d: 0.2, x: 0, y: 2.6, z: -5.1, material: wallM, wall: true });

  // ---------- 잠긴 문 (study_door) ----------
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.8, 0, -5.1);
  S.add(doorPivot);
  const doorMesh = box(ctx, { w: 1.6, h: 2.2, d: 0.08, x: 0.8, y: 1.1, z: 0, material: mat(0x3b2414), parent: doorPivot });
  ctx.walls.push(doorMesh);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), mat(0x8a7240, { metalness: 0.8, roughness: 0.3 }));
  knob.position.set(1.4, 1.05, 0.07);
  doorPivot.add(knob);
  const doorCollider = addCollider(ctx, 0, -5.1, 1.6, 0.2, 'study_door');
  registerInteractable(ctx, 'study_door', doorPivot);
  ctx.cutaway.push(doorPivot);
  ctx.openers.study_door = () => {
    tween(ctx, doorPivot, 'rotation', 'y', 1.45, 1.8);
    doorCollider.enabled = false;
  };

  // ---------- 책상 + 서랍 ----------
  const desk = new THREE.Group();
  desk.position.set(-2.8, 0, -2.6);
  S.add(desk);
  box(ctx, { w: 2, h: 0.08, d: 1, y: 0.76, material: wood, parent: desk });
  for (const [lx, lz] of [[-0.92, -0.42], [-0.92, 0.42], [0.92, -0.42]]) {
    box(ctx, { w: 0.08, h: 0.72, d: 0.08, x: lx, z: lz, material: darkWood, parent: desk });
  }
  // 서랍장 몸체(오른쪽 아래)
  box(ctx, { w: 0.7, h: 0.5, d: 0.92, x: 0.6, y: 0.47, material: darkWood, parent: desk });
  box(ctx, { w: 0.7, h: 0.22, d: 0.92, x: 0.6, y: 0.11, material: darkWood, parent: desk });
  // 일기장 + 얼룩
  const diary = box(ctx, { w: 0.36, h: 0.04, d: 0.26, x: -0.3, y: 0.82, material: paper, parent: desk });
  diary.rotation.y = 0.25;
  bloodDecal(ctx, -0.2, 0.1, 0.06, diary).position.set(0.05, 0.025, 0.02);
  // 켜져 있는 둥근 버섯 모양 탁상 조명 (일기장 옆)
  F.deskLamp(ctx, desk, -0.72, 0.8, -0.22);
  addCollider(ctx, -2.8, -2.6, 2, 1);
  registerInteractable(ctx, 'desk', desk);

  // 서랍 (drawer) — 책상 오른쪽 서랍장 앞면. 손잡이가 눈에 띄게 앞으로 살짝 튀어나와 있음
  const drawer = new THREE.Group();
  drawer.position.set(-2.2, 0.6, -2.07);
  S.add(drawer);
  const brassM = mat(0xb08a3a, { metalness: 0.85, roughness: 0.3 });
  box(ctx, { w: 0.64, h: 0.2, d: 0.05, y: 0, z: 0, material: wood, parent: drawer });
  box(ctx, { w: 0.56, h: 0.12, d: 0.7, y: -0.02, z: -0.37, material: darkWood, parent: drawer });
  box(ctx, { w: 0.2, h: 0.035, d: 0.05, y: 0, z: 0.045, material: brassM, parent: drawer }); // 손잡이
  // 서랍 속: J가 보낸 봉투 더미 + 그 위의 작은 놋쇠 열쇠 (집으면 사라짐)
  const envM = mat(0xd8ccb0, { roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const env = box(ctx, { w: 0.22, h: 0.008, d: 0.13, x: -0.12 + (i % 3) * 0.12, y: 0.05 + i * 0.009, z: -0.3 - (i % 2) * 0.12, material: envM, parent: drawer });
    env.rotation.y = (i * 0.7) % 0.5 - 0.25;
  }
  const smallKey = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 20), brassM);
  ring.rotation.x = Math.PI / 2;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.008, 0.012), brassM);
  shaft.position.x = 0.058;
  const bit = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.022), brassM);
  bit.position.set(0.088, 0, 0.012);
  smallKey.add(ring, shaft, bit);
  smallKey.position.set(0.02, 0.11, -0.3);
  smallKey.rotation.y = 0.4;
  smallKey.scale.setScalar(1.4); // 집기 쉽게 살짝 크게
  registerInteractable(ctx, 'drawer', drawer);
  // 열쇠는 서랍과 따로 클릭해서 줍는다 (서랍이 열려야 보임)
  drawer.add(smallKey);
  smallKey.visible = false;
  registerInteractable(ctx, 'drawer_key', smallKey);
  ctx.hideOnItem.small_key = smallKey; // 열쇠를 챙기면 서랍 속에서 사라짐
  ctx.openers.drawer = () => {
    tween(ctx, drawer, 'position', 'z', drawer.position.z + 0.42, 1.0); // 지금 자리에서 앞으로 0.42m (방 크기 조절과 무관)
    if (!gameState.state.taken.includes('small_key')) setTimeout(() => (smallKey.visible = true), 250);
  };

  // 넘어진 의자
  const chair = new THREE.Group();
  chair.position.set(-1.6, 0, -1.4);
  chair.rotation.set(0, 0.7, Math.PI / 2.2);
  box(ctx, { w: 0.45, h: 0.05, d: 0.45, y: 0.25, material: darkWood, parent: chair });
  box(ctx, { w: 0.45, h: 0.5, d: 0.05, y: 0.5, z: -0.2, material: darkWood, parent: chair });
  S.add(chair);
  registerInteractable(ctx, 'fallen_chair', chair);

  // ---------- 책장 (서쪽 벽) ----------
  const shelf = new THREE.Group();
  shelf.position.set(-4.72, 0, 1.5);
  S.add(shelf);
  box(ctx, { w: 0.05, h: 2.4, d: 2.4, x: -0.2, material: darkWood, parent: shelf });
  box(ctx, { w: 0.5, h: 2.4, d: 0.05, z: -1.18, material: darkWood, parent: shelf });
  box(ctx, { w: 0.5, h: 2.4, d: 0.05, z: 1.18, material: darkWood, parent: shelf });
  const bookColors = [0x3b1010, 0x1f2a1a, 0x1a1f2e, 0x3a2d14, 0x2a1a24, 0x4a3b2a];
  const bookMats = bookColors.map((c) => mat(c));
  for (const sy of [0.04, 0.62, 1.2, 1.78, 2.36]) {
    box(ctx, { w: 0.5, h: 0.04, d: 2.36, y: sy, material: darkWood, parent: shelf });
    if (sy > 2.3) continue;
    if (sy === 1.2) {
      namedBooks(sy);
      continue;
    }
    let z = -1.1;
    while (z < 1.05) {
      const bw = 0.05 + Math.random() * 0.06;
      const bh = 0.32 + Math.random() * 0.18;
      if (Math.random() < 0.08) {
        z += bw + 0.08;
        continue;
      }
      const b = box(ctx, { w: 0.34, h: bh, d: bw, x: 0.02, y: sy + 0.02 + bh / 2, z: z + bw / 2, material: bookMats[(Math.random() * bookMats.length) | 0], parent: shelf });
      if (Math.random() < 0.1) b.rotation.x = 0.15;
      z += bw + 0.005;
    }
  }
  // 제목이 보이는 책들 (scenario.json의 bookshelf)
  // 책장 앞에서 볼 때 왼쪽→오른쪽 순서가 책장 화면과 같도록 배치 (책장을 바라보면 -z 쪽이 오른쪽)
  // 빨간 책 세 권은 책등 위쪽에 금박 숫자 Ⅰ Ⅱ Ⅲ
  function namedBooks(sy) {
    const books = gameState.scenario.bookshelf.books;
    let z = 1.08;
    books.forEach((bk, i) => {
      const red = !!bk.num;
      const bw = red ? 0.1 : 0.075 + ((i * 13) % 3) * 0.008;
      const bh = red ? 0.42 : 0.33 + ((i * 37) % 5) * 0.02;
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 320;
      const g = c.getContext('2d');
      g.fillStyle = bk.color;
      g.fillRect(0, 0, 64, 320);
      const sh = g.createLinearGradient(0, 0, 64, 0);
      sh.addColorStop(0, 'rgba(0,0,0,.5)');
      sh.addColorStop(0.3, 'rgba(255,255,255,.08)');
      sh.addColorStop(1, 'rgba(0,0,0,.5)');
      g.fillStyle = sh;
      g.fillRect(0, 0, 64, 320);
      g.fillStyle = '#c8a050';
      g.fillRect(4, 10, 56, 3);
      g.fillRect(4, 300, 56, 3);
      g.textAlign = 'center';
      let y0 = 50;
      if (red) {
        g.font = 'bold 40px "Times New Roman", serif';
        g.fillStyle = '#f2cf6a';
        g.shadowColor = 'rgba(255,200,90,.8)';
        g.shadowBlur = 8;
        g.fillText(bk.num, 32, 58);
        g.shadowBlur = 0;
        g.fillRect(10, 72, 44, 2);
        y0 = 104;
      }
      // 금박 책은 제목 전체(마지막 글자까지)가 보이게 글자 간격을 줄임
      const chars = [...bk.title.replace(/ /g, '')].slice(0, 8);
      const step = red ? Math.min(28, 190 / chars.length) : 28;
      g.font = `bold ${red ? Math.round(step * 0.9) : 26}px serif`;
      g.fillStyle = red ? '#f2d488' : '#e8d090';
      chars.forEach((ch, k) => g.fillText(ch, 32, y0 + k * step));
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const cover = mat(bk.color);
      const spineM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: red ? 0x220402 : 0x000000 });
      const mats = [spineM, cover, cover, cover, cover, cover]; // 옆면(+x)이 책등
      const bmesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, bh, bw), mats);
      bmesh.position.set(red ? 0.035 : 0.02, sy + 0.02 + bh / 2, z - bw / 2);
      shelf.add(bmesh);
      z -= bw + 0.006;
    });
  }
  addCollider(ctx, -4.72, 1.5, 0.5, 2.4);
  registerInteractable(ctx, 'bookshelf', shelf);

  // ---------- 벽시계 (동쪽 벽, 11:47에 멈춤) ----------
  const clock = new THREE.Group();
  clock.position.set(4.97, 2.0, -1.5);
  clock.rotation.y = -Math.PI / 2; // 로컬 +z가 방 안쪽(-x)을 향함
  S.add(clock);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 48), mat(0x8e8470, { roughness: 0.6 }));
  face.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.035, 8, 32), darkWood);
  clock.add(face, rim);
  const tickMat = mat(0x111111);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.02, i % 3 === 0 ? 0.07 : 0.04, 0.01), tickMat);
    tick.position.set(Math.sin(a) * 0.29, Math.cos(a) * 0.29, 0.03);
    tick.rotation.z = -a;
    clock.add(tick);
  }
  const makeHand = (len, width, angle) => {
    const g = new THREE.BoxGeometry(width, len, 0.01);
    g.translate(0, len / 2, 0);
    const h = new THREE.Mesh(g, tickMat);
    h.position.z = 0.04;
    h.rotation.z = -angle;
    clock.add(h);
  };
  makeHand(0.17, 0.025, ((11 + 47 / 60) / 12) * Math.PI * 2); // 시침
  makeHand(0.26, 0.015, (47 / 60) * Math.PI * 2); // 분침
  const smear = handPrintMesh(0.34); // 유리판에 찍힌 피 묻은 손바닥
  smear.rotation.z = 0.35;
  smear.position.set(0.04, -0.06, 0.05);
  clock.add(smear);
  registerInteractable(ctx, 'clock', clock);
  ctx.cutaway.push(clock);

  // ---------- 쓰러진 시신 (scene/corpse.js) ----------
  const { body, figure, paperScrap, watch, phoneHand } = buildCorpse();
  body.position.set(1.6, 0, 0.6);
  body.rotation.y = 0.6;
  S.add(body);
  registerInteractable(ctx, 'body', body);
  registerInteractable(ctx, 'pocket_watch', watch); // 11:47에 멈춘 회중시계 (따로 조사)
  ctx.hideOnItem.label_half = paperScrap;
  // public/models/victim.glb 가 있으면 진짜 3D 모델로 교체 (main.js에서 클릭 대상에 추가)
  ctx.victimModel = loadVictimModel(body, figure);

  // 사인(死因) 단서: 머리맡에 흩어진 초록 와인병 조각 + 와인이 섞인 피
  const shards = new THREE.Group();
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0x0c3a18, roughness: 0.08, metalness: 0.1, transmission: 0.3, transparent: true, opacity: 0.85, clearcoat: 1 });
  for (let i = 0; i < 14; i++) {
    const sh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.02 + Math.random() * 0.035), glassM);
    const a = Math.random() * Math.PI * 2;
    const rr = 0.08 + Math.random() * 0.35;
    sh.position.set(Math.cos(a) * rr, 0.012, Math.sin(a) * rr);
    sh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    sh.scale.y = 0.35;
    shards.add(sh);
  }
  const bottleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 18, 1, true), glassM);
  bottleBase.rotation.z = Math.PI / 2.3;
  bottleBase.position.set(0.22, 0.03, -0.1);
  shards.add(bottleBase);
  body.updateMatrixWorld(true);
  const headWorld = body.localToWorld(new THREE.Vector3(0.95, 0, -0.05));
  shards.position.set(headWorld.x + 0.25, 0, headWorld.z - 0.1);
  S.add(shards);
  registerInteractable(ctx, 'glass_shards', shards);

  // 왼손에 쥔 휴대폰 (따로 조사 가능, 화면이 희미하게 빛남)
  const phone = makePhone();
  phone.position.copy(phoneHand);
  phone.rotation.y = 0.5;
  body.add(phone);
  registerInteractable(ctx, 'phone', phone);
  let pt = 0;
  ctx.updaters.push((dt) => {
    pt += dt;
    // 알림이 올 때마다 화면이 깜빡
    const on = (pt % 6) < 0.25 ? 1.6 : 0.8;
    phone.userData.screen.material.emissiveIntensity = on;
  });

  // 시신 아래 피웅덩이 + 주변 핏자국
  bloodDecal(ctx, 2.15, 0.25, 0.75);
  bloodDecal(ctx, 1.7, 0.9, 0.45);
  bloodDecal(ctx, -1.2, -2.0, 0.25); // 책상 앞
  bloodDecal(ctx, -2.4, -1.6, 0.15);

  // 시신에서 문 쪽으로 질질 끌린 자국
  dragDecal(ctx, 1.2, -0.1, 0.55, -2.6, 0.42);
  dragDecal(ctx, 0.55, -2.6, 0.15, -4.7, 0.35);

  // 문 쪽으로 이어지는 핏자국 (blood_trail)
  const trail = new THREE.Group();
  S.add(trail);
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = THREE.MathUtils.lerp(1.4, 0.1, t) + (Math.random() - 0.5) * 0.3;
    const z = THREE.MathUtils.lerp(-0.2, -4.7, t);
    bloodDecal(ctx, x, z, 0.12 + Math.random() * 0.15, trail);
  }
  registerInteractable(ctx, 'blood_trail', trail);

  // ---------- 조명 ----------
  ctx.updaters.push(createChandelier(S, new THREE.Vector3(0.3, 3.0, 0.5))); // 크리스털 샹들리에
  ctx.updaters.push(createRedLight(S, new THREE.Vector3(4.5, 0.5, 4.5), 3.5, 6)); // 구석의 붉은 기운
  ctx.updaters.push(createRedLight(S, new THREE.Vector3(-3.9, 2.6, -3.9), 2.5, 6));
  ctx.updaters.push(createDust(S, RAW_BOUNDS)); // (아래 shrinkStudy에서 같이 줄어듦)

  // ---------- 벽 달력 (휴대폰 비밀번호 단서: 11월 3일 '하은 생일') ----------
  {
    const c = document.createElement('canvas');
    c.width = 384;
    c.height = 512;
    drawCalendar(c);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const cal = new THREE.Group();
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(0.48, 0.64),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: 0x2a2620, emissiveMap: tex })
    );
    const nail = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), mat(0x8a8070, { metalness: 0.8 }));
    nail.position.set(0, 0.33, 0.01);
    cal.add(sheet, nail);
    cal.position.set(-2.4, 1.6, -4.985);
    S.add(cal);
    registerInteractable(ctx, 'calendar', cal);
  }

  // ---------- 들어온 문 (남쪽 벽) — 들어오자마자 저절로 잠김 ----------
  {
    const door = new THREE.Group();
    const wood = mat(0x3a2012, { roughness: 0.8 });
    door.add(box(ctx, { w: 1.0, h: 2.1, d: 0.06, y: 1.05, material: wood }));
    for (const [py, ph] of [[0.55, 0.6], [1.5, 0.8]]) door.add(box(ctx, { w: 0.74, h: ph, d: 0.02, y: py, z: 0.04, material: mat(0x2e180c) }));
    const frameM = mat(0x24120a);
    door.add(box(ctx, { w: 1.2, h: 0.1, d: 0.1, y: 2.15, material: frameM }));
    for (const fx of [-0.55, 0.55]) door.add(box(ctx, { w: 0.1, h: 2.2, d: 0.1, x: fx, y: 1.1, material: frameM }));
    door.add(box(ctx, { w: 0.06, h: 0.06, d: 0.08, x: 0.38, y: 1.05, z: 0.06, material: mat(0xb08a3a, { metalness: 0.8, roughness: 0.3 }) }));
    door.add(box(ctx, { w: 0.12, h: 0.16, d: 0.04, x: 0.38, y: 1.25, z: 0.05, material: mat(0x1a1612, { metalness: 0.6 }) })); // 번호 자물쇠
    door.position.set(-1.4, 0, 4.96);
    door.rotation.y = Math.PI;
    S.add(door);
    registerInteractable(ctx, 'entry_door', door);
  }

  // ---------- 공포 소품 (퍼즐과 무관한 분위기) ----------
  // 서쪽 벽(책장 옆) 핏빛 글씨
  const msg = textPlane(['보고 있어'], { width: 1.9, height: 0.66, font: 'bold 118px serif' });
  msg.position.set(-4.985, 1.85, 3.75);
  msg.rotation.y = Math.PI / 2;
  S.add(msg);
  ctx.cutaway.push(msg);
  registerInteractable(ctx, 'wall_msg', msg);
  // 벽 손자국들
  wallDecal(ctx, 4.985, 1.3, 2.2, -Math.PI / 2, 0.14, { hand: true });
  wallDecal(ctx, 4.985, 1.05, 2.6, -Math.PI / 2, 0.12, { hand: true });
  wallDecal(ctx, -0.95, 1.4, -4.985, 0, 0.13, { hand: true }); // 문 옆
  wallDecal(ctx, 0.6, 0.9, 4.985, Math.PI, 0.2);
  wallDecal(ctx, -4.985, 1.9, -3.4, Math.PI / 2, 0.16, { hand: true });

  // ---------- 가구·소품 ----------
  const reg = (id, obj) => {
    registerInteractable(ctx, id, obj);
    if (obj.userData.open) ctx.openers[id] = obj.userData.open;
    return obj;
  };
  const group = (...objs) => {
    const g = new THREE.Group();
    S.add(g);
    objs.forEach((o) => g.add(o));
    return g;
  };
  F.rug(ctx, 0.6, 0.4, 4.4, 3.2); // 시신 아래 깔린 러그
  reg('fireplace', F.fireplace(ctx, 2.8, 4.68, Math.PI)); // 남쪽 벽 벽돌 벽난로
  reg('sofa', F.sofa(ctx, 2.5, 2.0, Math.PI)); // 벽난로를 향한 붉은 가죽 소파 (벽난로와 넉넉히 떨어짐)
  const side = F.roundTable(ctx, 0.95, 2.1, 0.28); // 소파 왼쪽 끝 옆 (벽난로·진열장 가는 길을 막지 않게)
  F.candle(ctx, side, -0.08, 0.62, 0.05, 0.14, 0.03);
  F.wineGlass(side, 0.1, 0.62, -0.05, true);
  reg('side_table', side);
  F.candleLight(ctx, 0.95, 0.95, 2.1, 2.2);
  reg('cabinet', F.cabinet(ctx, 4.75, 3.4, -Math.PI / 2)); // 동쪽 벽 진열장 (해골)
  reg('chest', F.chest(ctx, 0.62, 4.42, Math.PI)); // 벽난로 옆 궤짝 (작은 열쇠로 열림)
  reg('candelabra', F.candelabra(ctx, -1.7, -4.45)); // 문 옆 촛대
  F.candleLight(ctx, -1.7, 1.7, -4.3, 2.5);
  reg('dead_plant', F.deadPlant(ctx, 4.45, -4.45));
  reg('fallen_lamp', F.fallenLamp(ctx, 3.75, 1.3, 0.3));
  reg('papers', group(F.papers(ctx, -1.5, -1.5, 7, 1.0), F.papers(ctx, 0.9, -0.6, 3, 0.5)));
  F.candle(ctx, S, -3.45, 0.8, -2.85, 0.16, 0.028); // 책상 위 촛불
  F.candle(ctx, S, -3.3, 0.8, -2.9, 0.1, 0.024);
  const fN1 = reg('frame_n1', F.frame(ctx, 3.0, 1.8, -4.98, 0, 0.7, 0.9, 0.12));
  const fS1 = reg('frame_s1', F.frame(ctx, -4.0, 1.75, 4.98, Math.PI, 0.6, 0.8, -0.08));
  const fN2 = reg('frame_n2', F.frame(ctx, 2.0, 1.9, -4.98, 0, 0.4, 0.5, -0.05));
  ctx.ghostFrames.push({ id: 'frame_n1', ghost: fN1.userData.ghost }, { id: 'frame_s1', ghost: fS1.userData.ghost }, { id: 'frame_n2', ghost: fN2.userData.ghost });
  // 쌓인 상자들 (닫힌 상자는 클릭하면 열림)
  const stackBottom = F.cardboardBox(ctx, 3.55, -4.5, { w: 0.6, h: 0.45, d: 0.5, rotY: 0.1 });
  const stackTop = F.cardboardBox(ctx, 3.55, -4.5, { w: 0.5, h: 0.35, d: 0.42, y: 0.45, rotY: -0.2, collide: false });
  const stack = group(stackBottom, stackTop);
  stack.userData.open = stackTop.userData.open;
  reg('box_stack', stack);
  reg('box_open', F.cardboardBox(ctx, 4.4, -3.5, { w: 0.55, h: 0.4, d: 0.5, open: true, rotY: 0.4 }));
  reg('box_corner', F.cardboardBox(ctx, -4.35, 3.25, { w: 0.5, h: 0.5, d: 0.5, rotY: 0.2 }));
  reg('crate_study', F.crate(ctx, -3.7, 4.45, 0.5, 0, 0.1));
  reg('box_door', F.cardboardBox(ctx, -2.2, -4.55, { w: 0.45, h: 0.3, d: 0.4, open: true, rotY: -0.3 }));
  F.cobweb(ctx, 4.98, 2.98, -4.98, -1, 1);
  F.cobweb(ctx, -4.98, 2.98, 4.98, 1, -1);
  F.cobweb(ctx, 4.98, 2.98, 4.98, -1, -1, 0.9);

  // 눈이 긁혀 나간 초상화 (동쪽 벽)
  const portrait = makePortrait();
  portrait.position.set(4.97, 1.75, 1.2);
  portrait.rotation.y = -Math.PI / 2;
  portrait.rotation.z = 0.06; // 살짝 기울어짐
  S.add(portrait);
  ctx.cutaway.push(portrait);
  registerInteractable(ctx, 'portrait', portrait);
  ctx.ghostFrames.push({ id: 'portrait', ghost: portrait.userData.ghost });

  // 붉은 벨벳 커튼이 달린 창문 (서쪽 벽) — 처음엔 커튼이 닫혀 있음, 유리에 붉은 '나가지 마', 가끔 번개
  const win = buildWindow(ctx, { x: -5.98, y: 1.6, z: -1.6, rotY: Math.PI / 2 }); // 창가 공간 안쪽 벽
  ctx.cutaway.push(win);
  registerInteractable(ctx, 'window', win);
  ctx.openers.window = win.userData.open; // 클릭하면 커튼이 촥 열림

  shrinkStudy(ctx, startChildren, startColliders);
  return { bounds: STUDY_BOUNDS, spawn: STUDY_SPAWN };
}

/**
 * 서재를 STUDY_SCALE만큼 작게: 가구·소품은 크기 그대로 자리만 안쪽으로 모으고,
 * 벽·바닥·천장·벽 충돌 상자는 길이를 줄인다. (북쪽 벽 z=-5는 그대로라 지하 저장고와 이어짐)
 */
function shrinkStudy(ctx, startChildren, startColliders) {
  const k = STUDY_SCALE;
  const walls = new Set(ctx.walls);
  const flat = new Set([...ctx.floors, ...ctx.ceilings]);
  for (const o of ctx.scene.children.slice(startChildren)) {
    o.position.x = SX(o.position.x);
    o.position.z = SZ(o.position.z);
    if (walls.has(o)) {
      o.scale.x *= k;
      o.scale.z *= k;
    } else if (flat.has(o)) {
      o.scale.x *= k;
      o.scale.y *= k; // 바닥·천장은 눕혀 놓은 평면이라 로컬 y가 월드 z
    } else if (o.isPoints) {
      o.scale.x *= k; // 먼지
      o.scale.z *= k;
    }
  }
  for (const c of ctx.colliders.slice(startColliders)) {
    if (c.wall) {
      c.minX = SX(c.minX);
      c.maxX = SX(c.maxX);
      c.minZ = SZ(c.minZ);
      c.maxZ = SZ(c.maxZ);
    } else {
      const cx = (c.minX + c.maxX) / 2;
      const cz = (c.minZ + c.maxZ) / 2;
      const dx = SX(cx) - cx;
      const dz = SZ(cz) - cz;
      c.minX += dx;
      c.maxX += dx;
      c.minZ += dz;
      c.maxZ += dz;
    }
  }
}

/** 눈 부분이 긁혀 나간 초상화 (캔버스 텍스처) */
function makePortrait() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const g = canvas.getContext('2d');
  g.fillStyle = '#2a1a12';
  g.fillRect(0, 0, 256, 320);
  // 실루엣
  g.fillStyle = '#4a3428';
  g.beginPath();
  g.ellipse(128, 130, 55, 70, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(50, 210, 156, 110);
  // 긁힌 눈
  g.strokeStyle = '#b01010';
  g.lineWidth = 5;
  for (let i = 0; i < 9; i++) {
    const x = 85 + Math.random() * 80;
    g.beginPath();
    g.moveTo(x, 105 + Math.random() * 10);
    g.lineTo(x + (Math.random() - 0.5) * 30, 140 + Math.random() * 20);
    g.stroke();
  }
  g.fillStyle = '#100404';
  g.fillRect(92, 118, 26, 12);
  g.fillRect(140, 118, 26, 12);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.05), mat(0x5a3a14, { metalness: 0.5, roughness: 0.5 }));
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.96), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  pic.position.z = 0.03;
  const ghost = F.ghostPlane(0.76, 0.96);
  ghost.position.z = 0.035;
  group.add(frame, pic, ghost);
  group.userData.ghost = ghost;
  return group;
}

/** 금 간 화면의 휴대폰 (잠금화면이 그려진 텍스처) */
function makePhone() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1a2a4a');
  grad.addColorStop(1, '#06080f');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#e8eefc';
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center';
  g.fillText('23:47', 64, 70);
  g.font = '11px sans-serif';
  g.fillText('11월 17일 화요일', 64, 88);
  for (let i = 0; i < 3; i++) {
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(10, 110 + i * 32, 108, 26);
  }
  g.fillStyle = 'rgba(200,20,20,0.85)'; // 화면 위 핏방울
  g.beginPath();
  g.arc(90, 190, 14, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.7)'; // 거미줄처럼 금 간 유리
  g.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    g.beginPath();
    g.moveTo(30, 200);
    g.lineTo(30 + Math.cos(a) * 120, 200 + Math.sin(a) * 120);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const group = new THREE.Group();
  const caseM = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.009, 0.155), mat(0x0c0c10, { metalness: 0.6, roughness: 0.3 }));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.068, 0.145),
    new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.8 })
  );
  screen.rotation.x = -Math.PI / 2;
  screen.position.y = 0.0052;
  group.add(caseM, screen);
  group.userData.screen = screen;
  return group;
}

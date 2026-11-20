// =============================================================
// scene/room2.js
// 방 2 — 지하 와인 저장고 (x: -4~4, z: -15~-5, 양옆 벽감은 x ±4.9까지)
// 서재 북쪽 문(z=-5)을 열어야 들어올 수 있다.
// 배치: 와인 선반 4개, 깨진 병, 벽의 핏빛 글씨, 금고, 북쪽 출구 철문
// 물체 id는 scenario.json의 interactables 키와 같아야 한다.
// =============================================================
import * as THREE from 'three';
import { box, addCollider, registerInteractable, tween, bloodDecal, wallDecal, textPlane, mat, handPrintMesh } from './helpers.js';
import { createRedLight, createFlickerLight } from './lighting.js';
import { createDust, createDrip } from './atmosphere.js';
import * as F from './furniture.js';

// 저장고는 처음 서재 바로 뒤(z -5~-15, 바닥 0)에 배치한 뒤, 계단 길이만큼 북쪽으로 밀고 아래로 내린다
export const CELLAR_SHIFT_Z = -3.6; // 계단 통로 길이만큼 북쪽으로
export const CELLAR_FLOOR_Y = -2.2; // 지하 바닥 높이
const RAW_BOUNDS = { minX: -4, maxX: 4, minZ: -15, maxZ: -5.2 };
export const CELLAR_BOUNDS = { minX: -4, maxX: 4, minZ: -15 + CELLAR_SHIFT_Z, maxZ: -5.2 + CELLAR_SHIFT_Z };

// 계단: 서재 문(z -5.1) → 위 층계참 → 13단 → 아래 층계참 → 저장고 입구(z -8.6)
export const STAIRS = { x0: -0.8, x1: 0.8, zTop: -5.6, zBottom: -8.4, zEnd: -5 + CELLAR_SHIFT_Z, steps: 13 };

/** (x, z) 위치의 바닥 높이 — 서재 0, 계단에선 점점 낮아지고, 저장고는 CELLAR_FLOOR_Y */
export function floorHeightAt(x, z) {
  if (z >= STAIRS.zTop) return 0;
  if (z <= STAIRS.zBottom) return CELLAR_FLOOR_Y;
  const t = (STAIRS.zTop - z) / (STAIRS.zTop - STAIRS.zBottom);
  return CELLAR_FLOOR_Y * t;
}

export function buildCellar(ctx) {
  const S = ctx.scene;
  const startChildren = S.children.length;
  const startColliders = ctx.colliders.length;
  const stone = mat(0x4a2a24);
  const floorM = mat(0x2e1e1a, { roughness: 0.95 });
  const rackWood = mat(0x2b1b10);
  const metal = mat(0x2a2a2e, { metalness: 0.7, roughness: 0.45 });

  // ---------- 바닥 / 천장 ----------
  // 방 모양: 길쭉한 저장고. 양옆 벽엔 상자를 넣어 둔 움푹한 벽감(niche),
  //          출구 쪽 두 모서리는 비스듬히 깎여 있다
  const OUTLINE = [
    [-4, -5], [4, -5], [4, -9.55], [4.9, -9.55], [4.9, -10.45], [4, -10.45],
    [4, -14.4], [3.4, -15], [-3.4, -15], [-4, -14.4],
    [-4, -10.45], [-4.9, -10.45], [-4.9, -9.55], [-4, -9.55],
  ];
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(OUTLINE.map(([x, z]) => new THREE.Vector2(x, -z)))), floorM);
  floor.rotation.x = -Math.PI / 2;
  S.add(floor);
  ctx.floors.push(floor);
  const ceil = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(OUTLINE.map(([x, z]) => new THREE.Vector2(x, z)))), mat(0x121110));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 2.8, 0);
  S.add(ceil);
  ctx.ceilings.push(ceil);
  // 낮은 천장 들보
  for (const z of [-7, -10, -13]) ctx.ceilings.push(box(ctx, { w: 8, h: 0.18, d: 0.25, y: 2.7, z, material: rackWood }));

  // ---------- 벽 ----------
  for (const s of [-1, 1]) {
    // 옆벽 (벽감 앞뒤로 나뉨)
    box(ctx, { w: 0.2, h: 3, d: 4.55, x: s * 4.1, z: -7.275, material: stone, collide: true, wall: true });
    box(ctx, { w: 0.2, h: 3, d: 3.95, x: s * 4.1, z: -12.425, material: stone, collide: true, wall: true });
    // 벽감: 뒷벽, 양옆, 입구 위 돌 아치(상인방)
    box(ctx, { w: 0.2, h: 3, d: 1.3, x: s * 5.0, z: -10, material: stone, collide: true, wall: true });
    box(ctx, { w: 1.0, h: 3, d: 0.2, x: s * 4.45, z: -9.45, material: stone, collide: true, wall: true });
    box(ctx, { w: 1.0, h: 3, d: 0.2, x: s * 4.45, z: -10.55, material: stone, collide: true, wall: true });
    box(ctx, { w: 0.3, h: 0.75, d: 1.1, x: s * 4.05, y: 2.43, z: -10, material: mat(0x3a2420), wall: true });
    // 출구 쪽 비스듬한 모서리
    const diag = box(ctx, { w: 1.1, h: 3, d: 0.2, x: s * (3.7 + 0.07), z: -14.7 - 0.07, material: stone, wall: true });
    diag.rotation.y = s * Math.PI / 4;
    for (let i = 0; i <= 3; i++) {
      const t = i / 3;
      addCollider(ctx, s * (4 - 0.6 * t + 0.1), -14.4 - 0.6 * t - 0.1, 0.36, 0.36);
    }
  }
  box(ctx, { w: 2.7, h: 3, d: 0.2, x: -2.15, z: -15.1, material: stone, collide: true, wall: true });
  box(ctx, { w: 2.7, h: 3, d: 0.2, x: 2.15, z: -15.1, material: stone, collide: true, wall: true });
  box(ctx, { w: 1.6, h: 0.8, d: 0.2, x: 0, y: 2.6, z: -15.1, material: stone, wall: true });

  // ---------- 와인 선반 ----------
  const glassMats = [0x0f2414, 0x2a120c, 0x161616].map((c) => mat(c, { roughness: 0.15, metalness: 0.2 }));
  const bottleGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.32, 10);
  bottleGeo.rotateX(Math.PI / 2); // 눕힌 병 (로컬 z 방향)

  function makeRack(x, z, rotY, { emptySlot = false } = {}) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY; // 로컬 +z 가 선반 앞면
    S.add(g);
    box(ctx, { w: 3, h: 2.2, d: 0.04, z: -0.32, material: rackWood, parent: g });
    for (const px of [-1.48, -0.5, 0.5, 1.48]) box(ctx, { w: 0.06, h: 2.2, d: 0.66, x: px, material: rackWood, parent: g });
    for (let r = 0; r < 5; r++) {
      const y = 0.15 + r * 0.42;
      box(ctx, { w: 3, h: 0.03, d: 0.66, y: y - 0.06, material: rackWood, parent: g });
      for (let c = 0; c < 9; c++) {
        if (emptySlot && r === 2 && c === 4) continue; // 빠진 병 한 칸
        if (Math.random() < 0.06) continue;
        const b = new THREE.Mesh(bottleGeo, glassMats[(Math.random() * glassMats.length) | 0]);
        b.position.set(-1.3 + c * 0.325, y + 0.05, 0);
        g.add(b);
      }
    }
    if (emptySlot) {
      // 빈 칸 앞의 붉은 손자국
      const print = handPrintMesh(0.17);
      print.rotation.z = -0.3;
      print.position.set(0, 0.15 + 2 * 0.42 + 0.08, 0.34);
      g.add(print);
    }
    return g;
  }
  const rackW1 = makeRack(-3.6, -8, Math.PI / 2);
  const rackW2 = makeRack(-3.6, -12, Math.PI / 2);
  const mainRack = makeRack(3.6, -8, -Math.PI / 2, { emptySlot: true });
  const rackE2 = makeRack(3.6, -12, -Math.PI / 2);
  const others = new THREE.Group();
  S.add(others);
  others.add(rackW1, rackW2, rackE2);
  for (const [x, z] of [[-3.6, -8], [-3.6, -12], [3.6, -8], [3.6, -12]]) addCollider(ctx, x, z, 0.7, 3);
  registerInteractable(ctx, 'wine_rack', mainRack);
  registerInteractable(ctx, 'wine_rack_2', others);

  // ---------- 깨진 병 ----------
  const broken = new THREE.Group();
  broken.position.set(-0.9, 0, -9.4);
  S.add(broken);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.045, 0.2, 10), glassMats[0]);
  neck.rotation.set(0, 0.4, Math.PI / 2);
  neck.position.set(0, 0.045, 0);
  broken.add(neck);
  const shardGeo = new THREE.TetrahedronGeometry(0.04);
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(shardGeo, glassMats[0]);
    s.position.set((Math.random() - 0.5) * 0.6, 0.015, (Math.random() - 0.5) * 0.6);
    s.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    broken.add(s);
  }
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.06), mat(0xcab890, { side: THREE.DoubleSide }));
  label.rotation.x = -Math.PI / 2;
  label.position.set(0.18, 0.012, 0.1);
  broken.add(label);
  bloodDecal(ctx, 0, 0, 0.5, broken); // 와인인지 피인지 모를 웅덩이
  registerInteractable(ctx, 'broken_bottle', broken);

  // 바닥 핏자국: 계단 쪽에서 금고 쪽으로
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    bloodDecal(ctx, THREE.MathUtils.lerp(0.1, 2.2, t), THREE.MathUtils.lerp(-5.6, -13.5, t), 0.1 + Math.random() * 0.15);
  }

  // ---------- 벽의 핏빛 글씨 (북쪽 벽 왼쪽) ----------
  const writing = textPlane(['그 해의 와인이', '나를 죽였다'], { width: 2.2, height: 1.1 });
  writing.position.set(-2.25, 1.6, -14.99);
  S.add(writing);
  const arrow = textPlane(['→'], { width: 0.6, height: 0.4, font: 'bold 160px serif' });
  arrow.position.set(-1.0, 0.9, -14.99);
  S.add(arrow);
  const wallGroup = new THREE.Group();
  S.add(wallGroup);
  wallGroup.add(writing, arrow);
  registerInteractable(ctx, 'wall_writing', wallGroup);
  ctx.cutaway.push(wallGroup);

  // ---------- 금고 ----------
  const safe = new THREE.Group();
  safe.position.set(2.6, 0, -14.4);
  S.add(safe);
  box(ctx, { w: 0.9, h: 1.0, d: 0.8, y: 0.5, material: metal, parent: safe });
  const safePivot = new THREE.Group();
  safePivot.position.set(-0.45, 0.5, 0.41); // 앞면 왼쪽 경첩
  safe.add(safePivot);
  box(ctx, { w: 0.86, h: 0.94, d: 0.05, x: 0.43, y: 0, z: 0, material: mat(0x34343a, { metalness: 0.8, roughness: 0.35 }), parent: safePivot });
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 20), mat(0x888070, { metalness: 0.9, roughness: 0.3 }));
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0.55, 0.12, 0.04);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.04), mat(0x888070, { metalness: 0.9 }));
  handle.position.set(0.72, -0.1, 0.05);
  safePivot.add(dial, handle);
  const exitKeyMesh = box(ctx, { w: 0.16, h: 0.02, d: 0.05, x: 0, y: 0.4, z: 0.1, material: mat(0x0a0a0a, { metalness: 0.9 }), parent: safe });
  addCollider(ctx, 2.6, -14.4, 0.9, 0.8);
  registerInteractable(ctx, 'safe', safe);
  ctx.openers.safe = () => {
    tween(ctx, safePivot, 'rotation', 'y', -1.75, 2.0);
    setTimeout(() => (exitKeyMesh.visible = false), 2200);
  };

  // ---------- 출구 철문 ----------
  const exitPivot = new THREE.Group();
  exitPivot.position.set(-0.8, 0, -15.1);
  S.add(exitPivot);
  const exitDoor = box(ctx, { w: 1.6, h: 2.2, d: 0.1, x: 0.8, y: 1.1, material: metal, parent: exitPivot });
  ctx.walls.push(exitDoor);
  for (const bx of [0.3, 0.8, 1.3]) box(ctx, { w: 0.06, h: 2.1, d: 0.04, x: bx, y: 1.1, z: 0.07, material: mat(0x1a1a1a, { metalness: 0.8 }), parent: exitPivot });
  const lock = box(ctx, { w: 0.14, h: 0.2, d: 0.08, x: 1.4, y: 1.1, z: 0.1, material: mat(0x5a4a2a, { metalness: 0.8 }), parent: exitPivot });
  const exitCollider = addCollider(ctx, 0, -15.1, 1.6, 0.2, 'exit_door');
  registerInteractable(ctx, 'exit_door', exitPivot);
  ctx.cutaway.push(exitPivot);
  // 문 너머 새벽빛 (문이 열리면 보인다)
  const dawn = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.4), new THREE.MeshBasicMaterial({ color: 0xd8e4ff, fog: false }));
  dawn.position.set(0, 1.2, -15.4);
  S.add(dawn);
  ctx.openers.exit_door = () => {
    lock.visible = false;
    tween(ctx, exitPivot, 'rotation', 'y', 1.5, 2.2);
    exitCollider.enabled = false;
  };

  // 오래된 술통 (분위기 + 충돌)
  // 배가 볼록한 오크통 + 쇠 테
  const barrelM = mat(0x3a2414, { roughness: 0.8 });
  const hoopM = mat(0x1a1816, { metalness: 0.7, roughness: 0.5 });
  const prof = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    prof.push(new THREE.Vector2(0.28 + 0.06 * Math.sin(t * Math.PI), t * 0.85));
  }
  const barrels = new THREE.Group();
  S.add(barrels);
  for (const [x, z] of [[3.1, -5.9], [2.4, -6.0], [-3.1, -14.3]]) {
    const b = new THREE.Group();
    b.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 28), barrelM));
    for (const hy of [0.08, 0.3, 0.55, 0.77]) {
      const r = 0.28 + 0.06 * Math.sin((hy / 0.85) * Math.PI) + 0.004;
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 6, 32), hoopM);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = hy;
      b.add(hoop);
    }
    const lid = new THREE.Mesh(new THREE.CircleGeometry(0.28, 28), barrelM);
    lid.rotation.x = -Math.PI / 2;
    lid.position.y = 0.85;
    b.add(lid);
    b.position.set(x, 0, z);
    barrels.add(b);
    addCollider(ctx, x, z, 0.66, 0.66);
  }
  registerInteractable(ctx, 'barrels', barrels);

  // ---------- 조명 ----------
  ctx.updaters.push(createRedLight(S, new THREE.Vector3(0, 2.45, -10)));
  ctx.updaters.push(createRedLight(S, new THREE.Vector3(2.0, 2.3, -13.8), 8, 7));
  ctx.updaters.push(createFlickerLight(S, new THREE.Vector3(-1.5, 2.2, -6.5), { cordLength: 0.35 }));
  ctx.updaters.push(createDust(S, RAW_BOUNDS, 200)); // (아래에서 저장고와 같이 옮겨짐)

  // ---------- 공포 소품 ----------
  // 들보에 매달린 쇠사슬
  const linkGeo = new THREE.TorusGeometry(0.045, 0.012, 6, 12);
  const linkMat = mat(0x3a3330, { metalness: 0.8, roughness: 0.5 });
  const chains = [];
  const chainGroup = new THREE.Group();
  S.add(chainGroup);
  for (const [cx, cz, n] of [[-1.8, -10, 14], [1.2, -13, 10], [0.4, -7, 8]]) {
    const chain = new THREE.Group();
    chain.position.set(cx, 2.62, cz);
    for (let i = 0; i < n; i++) {
      const l = new THREE.Mesh(linkGeo, linkMat);
      l.position.y = -i * 0.075;
      l.rotation.y = i % 2 ? Math.PI / 2 : 0;
      l.rotation.x = Math.PI / 2;
      chain.add(l);
    }
    // 끝에 달린 갈고리
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 12, Math.PI * 1.3), linkMat);
    hook.position.y = -n * 0.075 - 0.05;
    chain.add(hook);
    chainGroup.add(chain);
    chains.push(chain);
  }
  registerInteractable(ctx, 'chains', chainGroup);
  let ct = 0;
  ctx.updaters.push((dt) => {
    ct += dt;
    chains.forEach((c, i) => (c.rotation.z = Math.sin(ct * 0.9 + i * 2) * 0.05));
  });

  // 천장에서 떨어지는 핏방울 + 고인 자국
  for (const [x, z] of [[-1.8, -11.2], [1.6, -8.6], [0.3, -12.6]]) {
    bloodDecal(ctx, x, z, 0.22);
    ctx.updaters.push(createDrip(S, x, z, 2.75));
  }

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
  const c1a = F.crate(ctx, -3.15, -5.85, 0.6);
  const c1b = F.crate(ctx, -3.15, -5.85, 0.48, 0.6, 0.4, false); // 위에 쌓인 상자
  const c1c = F.crate(ctx, -2.45, -5.75, 0.5, 0, -0.3);
  const st1 = group(c1a, c1b, c1c);
  st1.userData.open = c1b.userData.open;
  reg('crate_c1', st1);
  const tbl = F.table(ctx, -2.2, -12.8, 1.4, 0.8);
  F.candle(ctx, tbl, -0.45, 0.79, -0.1, 0.18, 0.03);
  F.candle(ctx, tbl, -0.3, 0.79, 0.12, 0.1, 0.026);
  F.wineGlass(tbl, 0.1, 0.79, 0.1, true);
  F.wineGlass(tbl, 0.35, 0.79, -0.15, false);
  const bottle = new THREE.Mesh(
    new THREE.LatheGeometry([[0, 0], [0.045, 0], [0.045, 0.2], [0.02, 0.26], [0.014, 0.32], [0.016, 0.33], [0, 0.33]].map(([a, b]) => new THREE.Vector2(a, b)), 20),
    new THREE.MeshPhysicalMaterial({ color: 0x0c2a14, roughness: 0.1, clearcoat: 1 })
  );
  bottle.position.set(0.5, 0.79, 0.1);
  tbl.add(bottle);
  const chairA = F.chair(ctx, -2.0, -12.0, 0.2);
  const fallen = F.chair(ctx, -1.2, -13.3, 1.2);
  fallen.rotation.z = Math.PI / 2;
  fallen.position.y = 0.22;
  reg('cellar_table', group(tbl, chairA, fallen));
  F.candleLight(ctx, -2.5, 1.2, -12.8, 3);
  reg('covered_shape', F.coveredShape(ctx, 1.8, -11.2, 0.35)); // 천을 덮은 형체
  reg('crate_c2', F.crate(ctx, -4.42, -10.0, 0.6, 0, 0.15)); // 서쪽 벽감 안
  const c3a = F.crate(ctx, 4.42, -10.0, 0.55, 0, -0.2); // 동쪽 벽감 안
  const c3b = F.crate(ctx, 4.42, -10.0, 0.42, 0.55, 0.3, false);
  const st3 = group(c3a, c3b);
  st3.userData.open = c3b.userData.open;
  reg('crate_c3', st3);
  reg('box_cellar', F.cardboardBox(ctx, 1.55, -6.0, { w: 0.55, h: 0.45, d: 0.5, open: true, rotY: 0.3 }));
  const bxa = F.cardboardBox(ctx, -1.7, -14.45, { w: 0.5, h: 0.35, d: 0.45, rotY: -0.2 });
  const bxb = F.cardboardBox(ctx, -1.7, -14.45, { w: 0.4, h: 0.3, d: 0.35, y: 0.35, rotY: 0.25, collide: false });
  const st4 = group(bxa, bxb);
  st4.userData.open = bxb.userData.open;
  reg('box_cellar2', st4);
  F.cobweb(ctx, -4.88, 2.78, -10.43, 1, 1, 0.7); // 벽감 구석
  F.cobweb(ctx, 4.88, 2.78, -9.57, -1, -1, 0.7);
  F.cobweb(ctx, -3.98, 2.78, -5.22, 1, -1);
  F.cobweb(ctx, 3.98, 2.78, -5.22, -1, -1);

  // 벽 손자국
  wallDecal(ctx, -3.985, 2.35, -6.0, Math.PI / 2, 0.14, { hand: true });
  wallDecal(ctx, 4.885, 1.6, -10.0, -Math.PI / 2, 0.15, { hand: true }); // 동쪽 벽감 안쪽 벽
  wallDecal(ctx, 1.4, 1.5, -14.985, 0, 0.14, { hand: true });
  wallDecal(ctx, 1.65, 1.3, -14.985, 0, 0.12, { hand: true });
  wallDecal(ctx, -0.9, 0.6, -14.985, 0, 0.25);

  // 저장고 전체를 지하로: 북쪽으로 CELLAR_SHIFT_Z, 아래로 CELLAR_FLOOR_Y
  for (const o of S.children.slice(startChildren)) {
    o.position.z += CELLAR_SHIFT_Z;
    o.position.y += CELLAR_FLOOR_Y;
  }
  for (const c of ctx.colliders.slice(startColliders)) {
    c.minZ += CELLAR_SHIFT_Z;
    c.maxZ += CELLAR_SHIFT_Z;
  }
  buildStairs(ctx, stone);
  return { bounds: CELLAR_BOUNDS };
}

/** 서재 문에서 지하 저장고로 내려가는 좁은 돌계단 통로 */
function buildStairs(ctx, stoneMat) {
  const S = ctx.scene;
  const { x0, x1, zTop, zBottom, zEnd, steps } = STAIRS;
  const W = x1 - x0;
  const stepM = mat(0x3a2a24, { roughness: 0.95 });
  const edgeM = mat(0x2a1c18, { roughness: 0.9 });
  // 위 층계참 (서재 문 바로 뒤)
  const landing = box(ctx, { w: W, h: 0.2, d: zTop - -5.1 + 0.1, y: -0.1, z: (-5.1 + zTop) / 2, material: stepM });
  ctx.floors.push(landing);
  // 계단 13단 (각 단은 바닥까지 꽉 찬 돌덩이)
  const run = (zTop - zBottom) / steps;
  const rise = -CELLAR_FLOOR_Y / steps;
  for (let i = 0; i < steps; i++) {
    const top = -(i + 1) * rise;
    const h = top - CELLAR_FLOOR_Y + 0.02;
    const zc = zTop - (i + 0.5) * run;
    const st = box(ctx, { w: W, h, d: run + 0.005, y: CELLAR_FLOOR_Y + h / 2 - 0.01, z: zc, material: stepM });
    ctx.floors.push(st);
    // 닳은 모서리 (계단 끝선)
    box(ctx, { w: W, h: 0.03, d: 0.05, y: top - 0.015, z: zc + run / 2 - 0.025, material: edgeM });
  }
  // 아래 층계참
  const low = box(ctx, { w: W, h: 0.2, d: zBottom - zEnd + 0.2, y: CELLAR_FLOOR_Y - 0.1, z: (zBottom + zEnd) / 2, material: stepM });
  ctx.floors.push(low);
  // 양옆 돌벽 (서재 바닥 위 3m부터 지하 바닥까지)
  const wallH = 3 - CELLAR_FLOOR_Y;
  for (const sx of [x0 - 0.1, x1 + 0.1]) {
    box(ctx, { w: 0.2, h: wallH, d: zEnd - -5.1 + 0.4, x: sx, y: CELLAR_FLOOR_Y + wallH / 2, z: (-5.1 + zEnd) / 2, material: stoneMat, collide: true, wall: true });
  }
  // 저장고 남쪽 벽 (계단 입구만 뚫림)
  const cellarH = 2.8 + 0.2;
  for (const [cx, w] of [[-2.4, 3.2], [2.4, 3.2]]) {
    box(ctx, { w, h: cellarH, d: 0.2, x: cx, y: CELLAR_FLOOR_Y + cellarH / 2, z: zEnd + 0.1, material: stoneMat, collide: true, wall: true });
  }
  // 비스듬히 내려가는 천장
  const ceilLen = Math.hypot(zTop - zEnd + 0.5, 2.6 - (CELLAR_FLOOR_Y + 2.8));
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.4, ceilLen), mat(0x1a1210));
  ceil.position.set(0, (2.6 + CELLAR_FLOOR_Y + 2.8) / 2, (-5.1 + zEnd) / 2);
  ceil.rotation.x = Math.PI / 2 - Math.atan2(2.6 - (CELLAR_FLOOR_Y + 2.8), -5.1 - zEnd);
  S.add(ceil);
  ctx.ceilings.push(ceil);
  // 왼쪽 벽 나무 난간 (벽 고정쇠 포함)
  const railM = mat(0x3a2414, { roughness: 0.7 });
  const railLen = Math.hypot(zTop - zBottom, -CELLAR_FLOOR_Y);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, railLen, 10), railM);
  rail.position.set(x0 + 0.06, CELLAR_FLOOR_Y / 2 + 0.9, (zTop + zBottom) / 2);
  rail.rotation.x = Math.PI / 2 + Math.atan2(-CELLAR_FLOOR_Y, zTop - zBottom);
  S.add(rail);
  // 계단 중간 벽 램프 (어둡지만 발밑은 보이게)
  const lampM = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffa050, emissiveIntensity: 1.3 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), lampM);
  bulb.position.set(x1 - 0.05, CELLAR_FLOOR_Y / 2 + 1.9, (zTop + zBottom) / 2);
  S.add(bulb);
  const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, wireframe: true }));
  cage.position.copy(bulb.position);
  S.add(cage);
  const light = new THREE.PointLight(0xffb070, 6, 6, 1.6);
  light.position.copy(bulb.position).add(new THREE.Vector3(-0.2, -0.1, 0));
  S.add(light);
  let t = 0;
  ctx.updaters.push((dt) => {
    t += dt;
    const flick = Math.sin(t * 17) * Math.sin(t * 4.3) > 0.94 ? 0.25 : 1;
    light.intensity = 6 * flick;
    lampM.emissiveIntensity = 1.3 * flick;
  });
}

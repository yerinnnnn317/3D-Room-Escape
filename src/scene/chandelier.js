// =============================================================
// scene/chandelier.js
// 서재 천장의 크리스털 샹들리에.
// - 금빛 천장 장식 + 사슬 + 금·유리 기둥
// - S자로 휘어진 유리 팔 6개 끝에 크리스털 받침과 불꽃 모양 전구
// - 팔 사이를 잇는 구슬 줄(스웨그)과 주렁주렁 매달린 물방울 크리스털
// - 아주 천천히 흔들리고, 전구는 가끔 지직거림 / 10초 정전 / 짧은 정전 연출을 함께 받음
//   (lighting.js의 LIGHT_BUS를 그대로 사용)
// =============================================================
import * as THREE from 'three';
import { LIGHT_BUS, LIGHT_CONFIG } from './lighting.js';

const V2 = (arr) => arr.map(([a, b]) => new THREE.Vector2(a, b));

/** ceil: 천장 고정점 위치 */
export function createChandelier(scene, ceil, { room = 'study' } = {}) {
  const C = LIGHT_CONFIG;
  const pivot = new THREE.Group();
  pivot.position.copy(ceil);
  scene.add(pivot);

  const gold = new THREE.MeshStandardMaterial({ color: 0xc8963c, metalness: 0.9, roughness: 0.28 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xd8ccb8, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.45, clearcoat: 1, clearcoatRoughness: 0.05 });
  // (방이 작아져 전구 빛이 크리스털에 바로 닿으므로 반사를 줄여 눈부시지 않게)
  const crystal = new THREE.MeshPhysicalMaterial({ color: 0x8a8278, roughness: 0.22, metalness: 0.2, transparent: true, opacity: 0.6, clearcoat: 0.3, emissive: 0xffd8a0, emissiveIntensity: 0.02 });
  // 구슬·물방울 크리스털은 수가 많아서 한 번에 그리는 InstancedMesh로 모음 (가볍게)
  const beads = [];
  const drops = [];
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: C.bulbColor, emissiveIntensity: 0.7 });

  // 천장 장식 + 사슬
  const rose = new THREE.Mesh(new THREE.LatheGeometry(V2([[0, 0], [0.16, 0], [0.15, -0.03], [0.06, -0.06], [0.03, -0.09], [0, -0.09]]), 24), gold);
  pivot.add(rose);
  const linkGeo = new THREE.TorusGeometry(0.018, 0.005, 6, 12);
  for (let i = 0; i < 8; i++) {
    const l = new THREE.Mesh(linkGeo, gold);
    l.position.y = -0.11 - i * 0.032;
    l.rotation.y = i % 2 ? Math.PI / 2 : 0;
    pivot.add(l);
  }

  // 흔들리는 본체
  const body = new THREE.Group();
  body.position.y = -0.38;
  pivot.add(body);
  // 기둥: 금 → 유리 → 금
  body.add(new THREE.Mesh(new THREE.LatheGeometry(V2([[0, 0], [0.03, 0], [0.05, -0.05], [0.025, -0.1], [0.06, -0.14], [0.04, -0.18], [0, -0.18]]), 24), gold));
  const col = new THREE.Mesh(new THREE.LatheGeometry(V2([[0, -0.18], [0.04, -0.18], [0.07, -0.26], [0.045, -0.36], [0.06, -0.42], [0, -0.42]]), 24), glass);
  body.add(col);
  const hub = new THREE.Mesh(new THREE.LatheGeometry(V2([[0, -0.42], [0.09, -0.43], [0.13, -0.47], [0.1, -0.51], [0.04, -0.55], [0.03, -0.62], [0, -0.64]]), 32), gold);
  body.add(hub);

  // 팔 6개 (S자 유리 팔) + 끝에 받침·전구
  const arms = 6;
  const bulbs = [];
  const tips = [];
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const P = (r, y) => new THREE.Vector3(dir.x * r, y, dir.z * r);
    const curve = new THREE.CatmullRomCurve3([P(0.08, -0.48), P(0.22, -0.6), P(0.4, -0.58), P(0.5, -0.46), P(0.5, -0.36)]);
    body.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.016, 8, false), glass));
    // 크리스털 받침 (꽃잎처럼 벌어진 접시)
    const tip = P(0.5, -0.36);
    tips.push(tip);
    const dish = new THREE.Mesh(new THREE.LatheGeometry(V2([[0, 0], [0.03, 0], [0.08, 0.025], [0.09, 0.035], [0.075, 0.03]]), 16), crystal);
    dish.position.copy(tip);
    body.add(dish);
    // 금색 초 모양 소켓 + 불꽃 모양 전구
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.09, 12), gold);
    sleeve.position.copy(tip).add(new THREE.Vector3(0, 0.07, 0));
    body.add(sleeve);
    const bulb = new THREE.Mesh(new THREE.LatheGeometry(V2([[0, 0], [0.018, 0.005], [0.022, 0.025], [0.014, 0.05], [0.004, 0.07], [0, 0.075]]), 12), bulbMat);
    bulb.position.copy(tip).add(new THREE.Vector3(0, 0.115, 0));
    body.add(bulb);
    bulbs.push(bulb);
    // 받침에 매달린 물방울 크리스털
    for (let k = 0; k < 3; k++) {
      const b = k * ((Math.PI * 2) / 3) + a;
      drops.push([tip.clone().add(new THREE.Vector3(Math.cos(b) * 0.075, -0.01, Math.sin(b) * 0.075)), 0.05 + Math.random() * 0.03]);
    }
  }
  // 팔 사이를 잇는 구슬 줄
  for (let i = 0; i < arms; i++) {
    const p0 = tips[i].clone().add(new THREE.Vector3(0, 0.0, 0));
    const p1 = tips[(i + 1) % arms].clone();
    for (let k = 1; k < 12; k++) {
      const t = k / 12;
      const p = p0.clone().lerp(p1, t);
      p.y -= Math.sin(t * Math.PI) * 0.14;
      beads.push(p);
    }
  }
  // 가운데 아래로 늘어진 크리스털 줄들
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = 0.09;
    const len = 4 + (i % 3);
    for (let k = 0; k < len; k++) beads.push(new THREE.Vector3(Math.cos(a) * r, -0.6 - k * 0.025, Math.sin(a) * r));
    drops.push([new THREE.Vector3(Math.cos(a) * r, -0.6 - len * 0.025, Math.sin(a) * r), 0.06]);
  }
  drops.push([new THREE.Vector3(0, -0.66, 0), 0.11]); // 맨 아래 큰 물방울
  // 인스턴스로 한꺼번에 배치
  const m4 = new THREE.Matrix4();
  const beadMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.008, 8, 6), crystal, beads.length);
  beads.forEach((p, i) => beadMesh.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z)));
  body.add(beadMesh);
  const dropGeo = new THREE.LatheGeometry(V2([[0, 0], [0.25, -0.2], [0.38, -0.55], [0.3, -0.85], [0, -1]]), 6);
  const dropMesh = new THREE.InstancedMesh(dropGeo, crystal, drops.length);
  drops.forEach(([p, size], i) => dropMesh.setMatrixAt(i, m4.makeScale(size, size, size).setPosition(p)));
  body.add(dropMesh);

  // 위쪽 유리 잎 장식
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), glass);
    leaf.scale.set(0.35, 1.3, 0.12);
    leaf.position.set(Math.cos(a) * 0.08, -0.1, Math.sin(a) * 0.08);
    leaf.rotation.set(0, -a, Math.cos(a) * 0.6);
    leaf.lookAt(Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3);
    body.add(leaf);
  }

  // 빛: 가운데 따뜻한 빛 하나 (그림자 없음)
  const light = new THREE.PointLight(C.bulbColor, C.bulbIntensity * 0.6, 13, 2);
  light.position.y = -0.95; // 크리스털보다 아래에 두어 천장·크리스털이 하얗게 타지 않게
  body.add(light);

  const rand = (a, b) => a + Math.random() * (b - a);
  let nextEvent = rand(3, 7);
  let offTime = 0;
  let t = Math.random() * 10;
  const state = { out: 0, room };
  LIGHT_BUS.bulbs.push(state);

  return function update(dt) {
    t += dt;
    // 아주 천천히 흔들림
    pivot.rotation.z = Math.sin(t * 0.6) * 0.025;
    pivot.rotation.x = Math.sin(t * 0.45 + 1) * 0.018;
    body.rotation.y = Math.sin(t * 0.3) * 0.05;

    let level;
    if (state.out > 0) {
      state.out -= dt;
      const edge = state.out > 9.2 || state.out < 0.8;
      level = edge && Math.random() < 0.35 ? 0.6 : 0;
    } else if (LIGHT_BUS.blackout > 0) {
      level = Math.random() < 0.05 ? 0.4 : 0;
    } else if (offTime > 0) {
      offTime -= dt;
      level = Math.random() < 0.2 ? 0.5 : 0.1;
    } else {
      nextEvent -= dt;
      if (nextEvent <= 0) {
        offTime = rand(0.08, 0.4);
        nextEvent = rand(3, 9);
      }
      level = 0.88 + Math.random() * 0.12;
    }
    light.intensity = C.bulbIntensity * 0.6 * level;
    bulbMat.emissiveIntensity = 0.7 * level;
    crystal.emissiveIntensity = 0.02 * level;
  };
}

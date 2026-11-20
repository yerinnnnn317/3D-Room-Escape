// =============================================================
// scene/corpse.js
// 바닥에 엎드려 쓰러진 피해자(한도윤)의 몸.
// 피해자 디자인 이미지의 '뒷모습'을 그대로 입힌다 (src/assets/victim_back.png).
// - 이미지 속 자세(팔을 A자로 살짝 벌림) 그대로 엎드린 몸을 캡슐들로 만들고,
//   위에서 내려다본 방향으로 이미지를 투영해서 조끼 뒤판·허리끈·걷은 소매·머리 모양이 보이게 한다
// - 뒤통수 상처와 셔츠 깃에 밴 피는 이미지에 그려 넣음 (사인 단서)
// - 한 손은 찢어진 라벨을 쥐고, 다른 손 옆에는 휴대폰, 바닥엔 11:47에 멈춘 회중시계
// - public/models/victim.glb 파일이 있으면 그 3D 모델로 대신 교체 (loadVictimModel)
// 좌표는 몸 그룹 기준: +x = 머리 방향, y = 위, z = 몸의 왼쪽(+)/오른쪽(-)
// =============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import victimBackUrl from '../assets/victim_back.png'; // 피해자 뒷모습 이미지 (엎드린 몸에 덧입힘)

/** 이 경로에 3D 모델(.glb)이 있으면 기본 도형 시신 대신 그 모델을 엎드린 자세로 쓴다 */
export const VICTIM_MODEL_URL = '/models/victim.glb';

const UP = new THREE.Vector3(0, 1, 0);

/** 두 점 a→b를 잇는 캡슐 (팔다리) */
function limb(parent, a, b, r, material, { flat = 1, wide = 1, r2 } = {}) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const len = dir.length();
  let geo;
  if (r2 !== undefined) {
    // 끝으로 갈수록 가늘어지는 팔다리 (원기둥 + 양끝 구)
    geo = new THREE.CylinderGeometry(r2, r, len, 20, 1);
  } else {
    geo = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 8, 20);
  }
  const m = new THREE.Mesh(geo, material);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  m.scale.set(wide, 1, flat);
  parent.add(m);
  if (r2 !== undefined) {
    sphere(parent, a, r, material);
    sphere(parent, b, r2, material);
  }
  return m;
}

function sphere(parent, p, r, material, scale = [1, 1, 1]) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), material);
  m.position.set(...p);
  m.scale.set(...scale);
  parent.add(m);
  return m;
}

/** 손: 손등이 위를 향한 채 바닥에 놓인 손. dir = 손가락 방향(y축 회전), curl = 쥔 정도 */
function hand(parent, p, dir, skin, curl = 0.3) {
  const g = new THREE.Group();
  g.position.set(...p);
  g.rotation.y = dir;
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.045, 18, 14), skin);
  palm.scale.set(1.3, 0.42, 1.05);
  g.add(palm);
  const lens = [0.055, 0.065, 0.06, 0.046];
  for (let i = 0; i < 4; i++) {
    const z = -0.032 + i * 0.021;
    const L = lens[i];
    const k1 = [0.048, -0.004, z];
    const k2 = [0.048 + L * 0.55 * Math.cos(curl), -0.006 - L * 0.55 * Math.sin(curl) * 0.5, z * 1.08];
    const k3 = [k2[0] + L * 0.45 * Math.cos(curl * 1.8), k2[1] - L * 0.45 * Math.sin(curl * 1.8) * 0.6, z * 1.12];
    limb(g, k1, k2, 0.0095, skin);
    limb(g, k2, k3, 0.0085, skin);
  }
  limb(g, [0.005, -0.004, 0.042], [0.04, -0.01, 0.072], 0.011, skin); // 엄지
  parent.add(g);
  return g;
}

/** 11:47에 멈춘 회중시계 */
function pocketWatch(parent, p, silver) {
  const g = new THREE.Group();
  g.position.set(...p);
  const caseM = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.01, 28), silver);
  g.add(caseM);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#e8e0cc';
  x.beginPath();
  x.arc(32, 32, 30, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = '#111';
  x.lineWidth = 3;
  const hand = (ang, len) => {
    x.beginPath();
    x.moveTo(32, 32);
    x.lineTo(32 + Math.sin(ang) * len, 32 - Math.cos(ang) * len);
    x.stroke();
  };
  hand(((11 + 47 / 60) / 12) * Math.PI * 2, 14);
  hand((47 / 60) * Math.PI * 2, 22);
  // 금 간 유리
  x.strokeStyle = 'rgba(255,255,255,0.8)';
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(10, 20);
  x.lineTo(40, 36);
  x.lineTo(56, 30);
  x.stroke();
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.023, 28), new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), roughness: 0.2 }));
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.0055;
  g.add(face);
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.002, 6, 12), silver);
  bow.position.set(0.03, 0.002, 0);
  bow.rotation.x = Math.PI / 2;
  g.add(bow);
  parent.add(g);
  return g;
}

// ---------------------------------------------------------------
// 뒷모습 이미지(assets/victim_back.png)를 위에서 몸에 덧입힌다.
// 엎드린 시신은 위에서 보면 등만 보이므로, 이미지 속 인물과 똑같은 자세(A자로 팔을 벌린 자세)로
// 몸을 만들고 이미지 좌표 → 몸 좌표를 1:1로 맞춘다. (이미지 1px = 3.38mm, 키 약 175cm)
// 좌표: 이미지 세로(머리→발) = 몸 +x → -x, 이미지 가로 = 몸 z
// ---------------------------------------------------------------
const K = 0.00338;
const IMG = { x0: 690, y0: 25, w: 270, h: 535 }; // 원본 이미지에서 잘라 낸 영역 (px)
const BX = (py) => 0.98 - (py - 37) * K; // 이미지 y(px) → 몸 x
const BZ = (px) => -(px - 822) * K; // 이미지 x(px) → 몸 z
const J = (px, py, h) => [BX(py), h, BZ(px)];

/** 몸 좌표 (x, z) → 텍스처 좌표 (u, v) */
function projectUV(x, z) {
  const px = 822 - z / K;
  const py = 37 + (0.98 - x) / K;
  return [(px - IMG.x0) / IMG.w, 1 - (py - IMG.y0) / IMG.h];
}

export function buildCorpse() {
  const root = new THREE.Group(); // 시신 + 주변 소품(라벨, 회중시계)
  const body = new THREE.Group(); // 몸 (3D 모델 파일을 불러오면 숨김)
  root.add(body);

  const tex = new THREE.TextureLoader().load(victimBackUrl);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const skinTex = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xb8b8b8, metalness: 0.95, roughness: 0.25 });

  // ----- 머리·목 -----
  sphere(body, J(822, 72, 0.1), 0.1, skinTex, [1.18, 0.95, 0.96]);
  limb(body, J(822, 100, 0.1), J(822, 122, 0.11), 0.05, skinTex);
  // ----- 몸통 (조끼) · 골반 (바지) -----
  limb(body, J(822, 138, 0.115), J(822, 262, 0.11), 0.12, skinTex, { wide: 1.0, flat: 1.45 });
  limb(body, J(822, 262, 0.106), J(822, 330, 0.1), 0.118, skinTex, { wide: 0.95, flat: 1.5 });
  sphere(body, J(776, 142, 0.105), 0.068, skinTex);
  sphere(body, J(868, 142, 0.105), 0.068, skinTex);
  // ----- 팔 (걷은 셔츠 소매 → 맨살 아래팔 → 손) -----
  limb(body, J(774, 148, 0.08), J(728, 236, 0.066), 0.052, skinTex, { r2: 0.046 });
  limb(body, J(727, 242, 0.06), J(707, 292, 0.048), 0.036, skinTex, { r2: 0.03 });
  hand(body, J(703, 312, 0.032), 1.45, skinTex, 0.45); // 이미지 왼쪽 손 (휴대폰 쪽)
  limb(body, J(870, 148, 0.08), J(917, 236, 0.066), 0.052, skinTex, { r2: 0.046 });
  limb(body, J(918, 242, 0.06), J(936, 292, 0.048), 0.036, skinTex, { r2: 0.03 });
  hand(body, J(940, 312, 0.032), -1.45, skinTex, 0.95); // 이미지 오른쪽 손 (라벨을 꽉 쥠)
  // ----- 다리 · 구두 -----
  limb(body, J(802, 332, 0.1), J(800, 422, 0.085), 0.075, skinTex, { r2: 0.062 });
  limb(body, J(800, 422, 0.085), J(797, 520, 0.07), 0.062, skinTex, { r2: 0.05 });
  limb(body, J(845, 332, 0.1), J(846, 422, 0.085), 0.075, skinTex, { r2: 0.062 });
  limb(body, J(846, 422, 0.085), J(849, 520, 0.07), 0.062, skinTex, { r2: 0.05 });
  sphere(body, J(797, 540, 0.06), 0.05, skinTex, [1.1, 1, 1]);
  sphere(body, J(850, 540, 0.06), 0.05, skinTex, [1.1, 1, 1]);

  // ----- 이미지를 위에서 투영하도록 각 메시의 UV를 다시 계산 -----
  body.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  body.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry = o.geometry.clone();
    const pos = o.geometry.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const [u, w] = projectUV(v.x, v.z);
      uv[i * 2] = u;
      uv[i * 2 + 1] = w;
    }
    o.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  });

  // ----- 조끼 주머니에서 흘러나온 회중시계 (11:47에 멈춤) -----
  const chain = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const link = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0015, 4, 8), silver);
    link.position.set(0.2 - i * 0.012, 0.004, -0.19 - Math.sin(i * 0.5) * 0.02 - i * 0.006);
    link.rotation.set(Math.PI / 2, 0, i % 2 ? Math.PI / 2 : 0);
    chain.add(link);
  }
  root.add(chain);
  const watch = pocketWatch(root, [0.02, 0.006, -0.3], silver);
  watch.add(chain); // 시계줄도 회중시계와 함께 조사
  chain.position.set(-0.02, -0.006, 0.3);

  // 오른손(이미지 오른쪽 손)에 쥔 찢어진 라벨 (주우면 사라짐)
  const [hx, , hz] = J(946, 322, 0);
  const paperScrap = new THREE.Mesh(
    new THREE.PlaneGeometry(0.07, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xcab890, side: THREE.DoubleSide })
  );
  paperScrap.rotation.x = -Math.PI / 2;
  paperScrap.rotation.z = 0.4;
  paperScrap.position.set(hx - 0.02, 0.05, hz - 0.03);
  root.add(paperScrap);

  root.scale.setScalar(0.93);
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  // 휴대폰을 쥔 손 위치 (몸 좌표)
  const [lx, , lz] = J(703, 318, 0);
  return { body: root, figure: body, paperScrap, watch, phoneHand: new THREE.Vector3(lx, 0.03, lz + 0.03) };
}

/**
 * public/models/victim.glb 가 있으면 불러와서 엎드려 쓰러진 자세로 눕힌다.
 * - 서 있는 모델(T/A 포즈, 얼굴이 +z)을 얼굴이 바닥을 향하게 눕히고, 머리를 +x(문 반대쪽)로
 * - 키를 약 1.75m로 맞추고, 몸이 바닥에 닿도록 높이 조정
 * - 핏기 없게 색을 살짝 어둡고 차갑게
 * 파일이 없으면 아무것도 하지 않고 기본 도형 시신을 그대로 쓴다.
 * @returns {Promise<THREE.Mesh[]|null>} 불러온 모델의 메시들 (조사 클릭용)
 */
export function loadVictimModel(root, figure, url = VICTIM_MODEL_URL) {
  return new Promise((resolve) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        const model = gltf.scene;
        // 1) 키 맞추기
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const s = 1.75 / 0.93 / Math.max(size.y, 0.001); // root가 0.93배라 미리 나눠 둠
        model.scale.setScalar(s);
        // 2) 눕히기: 얼굴(+z)이 바닥(-y)으로, 머리(+y)가 +x로
        const lay = new THREE.Group();
        lay.add(model);
        model.rotation.x = Math.PI / 2; // 머리 → +z, 얼굴 → 바닥
        lay.rotation.y = Math.PI / 2; // 머리 +z → +x
        root.add(lay);
        // 3) 바닥에 닿게 하고, 머리가 기존 시신 머리 위치(약 x=0.9)에 오도록
        root.updateMatrixWorld(true);
        const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
        const b2 = new THREE.Box3().setFromObject(lay).applyMatrix4(inv);
        lay.position.y -= b2.min.y - 0.005;
        lay.position.x += 0.98 - b2.max.x;
        lay.position.z -= (b2.min.z + b2.max.z) / 2;
        // 4) 시신 느낌: 살짝 어둡고 푸르스름하게, 그림자
        const meshes = [];
        model.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.receiveShadow = true;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (m.color) m.color.multiply(new THREE.Color(0.82, 0.8, 0.84));
            if ('roughness' in m) m.roughness = Math.max(m.roughness, 0.55);
          });
          o.userData.interactId = 'body';
          meshes.push(o);
        });
        figure.visible = false; // 기본 도형 시신 숨김
        resolve(meshes);
      },
      undefined,
      () => resolve(null) // 파일이 없으면 기본 도형 시신 유지
    );
  });
}
